// Validación del proceso poligonal — funciones puras (PRD § 5.1 capa de
// captura). Sin React, sin Supabase. La capa de cierre (§ 5.2) se fue con el
// cierre de la poligonal (Fase 35): el orden se detecta (`tolerances.ts`).

import {
  averageReadings,
  azimuthFromCoordinates,
  decimalToDms,
  dmsToDecimal,
  type Dms,
} from "@/lib/calculations/angles";
import type { PolygonalType } from "@/types/polygonal";

// --- Capa 1: validación en captura (§ 5.1) ------------------------------------

export interface StationCaptureInput {
  /** Código del punto. Obligatorio siempre: `point_code` es `not null`. */
  pointCode: string;
  angleDeg: number | null;
  angleMin: number | null;
  angleSec: number | null;
  distance: number | null;
  /**
   * Las lecturas del ángulo tal como se guardan en `polygonal_angle_readings`
   * (Fase 24). El ángulo de la estación es su promedio, que llega ya
   * normalizado: una lectura de 65″ se convierte en 1′05″ y la regla de rango
   * de arriba nunca la vería. Sin lecturas, no se revisan.
   */
  readings?: readonly { deg: number; min: number; sec: number }[];
}

/** Issues de captura de una estación, indexados por celda. */
export interface CaptureIssues {
  errors: Partial<Record<"pointCode" | "angle" | "distance", string>>;
  warnings: Partial<Record<"pointCode" | "angle" | "distance", string>>;
}

/**
 * Qué celdas son obligatorias para una estación según su tipo de poligonal y
 * su posición dentro del recorrido.
 *
 * Vive aquí (no en el editor) para que el cliente y la revalidación del
 * servidor apliquen exactamente la misma regla: una estación inicial sin
 * ángulo, o una final sin ángulo ni distancia, es captura parcial legítima
 * (§ 5.1), no un error — y ambos lados deben coincidir en cuál es cuál.
 */
export function expectStationCapture(
  type: PolygonalType,
  index: number,
  total: number,
  hasClosingRow = false,
  hasOrientation = false,
): { angle: boolean; distance: boolean } {
  if (type === "closed") {
    // La fila de cierre es de control: lleva el ángulo contra el amarre y no
    // abre ningún lado, así que no pide distancia. Sin ella, la última es el
    // punto pendiente, el ángulo del vértice de arranque (Vivero) o el lado
    // que vuelve a P1: la captura se guarda en cada popup (Fase 35), y nada de
    // eso es obligatorio a medias.
    if (index === total - 1) return { angle: hasClosingRow, distance: false };
    // Sin amarre, el ángulo en P1 se mide al cerrar, entre el último punto y P2.
    if (index === 0 && !hasOrientation) return { angle: false, distance: true };
    return { angle: true, distance: true };
  }
  // En una abierta amarrada, la primera fila lleva el ángulo de orientación
  // desde el amarre: sin él no hay azimut del primer lado (Fase 26, C-2).
  if (index === 0) return { angle: hasOrientation, distance: true };
  if (index === total - 1) return { angle: false, distance: false };
  return { angle: true, distance: true };
}

/**
 * Valida la captura de una estación. `expect` indica qué celdas son obligatorias
 * para esta estación (varía según tipo de poligonal y posición).
 */
export function validatePolygonalStation(
  station: StationCaptureInput,
  expect: { angle: boolean; distance: boolean },
): CaptureIssues {
  const errors: CaptureIssues["errors"] = {};
  const warnings: CaptureIssues["warnings"] = {};

  // Código: obligatorio SIEMPRE, con independencia de `expect`. Una estación
  // sin ángulo ni distancia (la última de una abierta) sigue siendo un punto
  // del levantamiento y necesita identificarse; además `point_code` es
  // `not null` en la base. La regla es la misma que `validateReadingCapture`
  // aplica en nivelación desde la Fase 4.
  if (station.pointCode.trim() === "") {
    errors.pointCode = "El punto necesita un código.";
  }

  // Distancia: ≤ 0 o > 1000 m bloquea; vacía obligatoria bloquea.
  const { distance } = station;
  if (distance == null) {
    if (expect.distance) errors.distance = "La distancia es obligatoria.";
  } else if (distance <= 0) {
    errors.distance = "La distancia debe ser mayor que cero.";
  } else if (distance > 1000) {
    errors.distance = "La distancia no puede superar los 1000 m.";
  } else if (hasMoreDecimals(distance, 4)) {
    errors.distance = "La distancia admite hasta cuatro decimales.";
  }

  // Ángulo: minutos/segundos fuera de [0,60) bloquean; 0° o 360° advierten.
  const { angleDeg, angleMin, angleSec } = station;
  const angleComplete =
    angleDeg != null && angleMin != null && angleSec != null;

  if (!angleComplete) {
    if (expect.angle) errors.angle = "El ángulo es obligatorio.";
  } else if (angleMin < 0 || angleMin >= 60) {
    errors.angle = "Los minutos deben estar entre 0 y 59.";
  } else if (angleSec < 0 || angleSec >= 60) {
    errors.angle = "Los segundos deben estar entre 0 y 59.";
  } else if (hasMoreDecimals(angleSec, 1)) {
    errors.angle = SECONDS_DECIMALS_MESSAGE;
  } else if (
    angleMin === 0 &&
    angleSec === 0 &&
    (angleDeg === 0 || angleDeg === 360)
  ) {
    warnings.angle = "Ángulo de 0° o 360°: posible error de captura.";
  }

  // Cada lectura, además del promedio (Fase 24): es lo que se guarda.
  if (errors.angle == null) {
    const bad = (station.readings ?? [])
      .map((r, i) => ({ i, error: readingDmsError(r) }))
      .find((r) => r.error != null);
    if (bad) {
      errors.angle = `Lectura ${bad.i + 1}: ${bad.error}`;
      delete warnings.angle;
    }
  }

  return { errors, warnings };
}

/**
 * Por qué una lectura DMS no puede guardarse, o `null` (Fase 24). Los grados
 * y los minutos son columnas enteras; el CHECK de `polygonal_angle_readings`
 * exige los mismos rangos. Un número que no es número lo marca la celda
 * (`NumberInput`), no esta regla.
 *
 * 360°00′00″ exacto pasa, como en la regla de la estación, que solo avisa: es
 * lo que da `decimalToDms` al redondear 359.99999° en grados decimales, y
 * rechazarlo bloquearía una lectura legítima.
 */
export function readingDmsError(reading: {
  deg: number;
  min: number;
  sec: number;
}): string | null {
  const { deg, min, sec } = reading;
  if (![deg, min, sec].every(Number.isFinite)) return null;
  if (!Number.isInteger(deg) || !Number.isInteger(min)) {
    return "Los grados y los minutos van sin decimales.";
  }
  const fullTurn = deg === 360 && min === 0 && sec === 0;
  if (deg < 0 || (deg >= 360 && !fullTurn)) return "Los grados deben estar entre 0 y 359.";
  if (min < 0 || min >= 60) return "Los minutos deben estar entre 0 y 59.";
  if (sec < 0 || sec >= 60) return "Los segundos deben estar entre 0 y 59.";
  if (hasMoreDecimals(sec, 1)) return SECONDS_DECIMALS_MESSAGE;
  return null;
}

const SECONDS_DECIMALS_MESSAGE = "Los segundos admiten una sola cifra decimal.";

/**
 * ¿Tiene `value` más cifras decimales que `digits`? Las columnas guardan los
 * segundos a la décima y las distancias a la diezmilésima: un valor más fino se
 * redondearía al guardarlo y el cálculo del servidor no sería el que se guarda
 * (Fase 26, C-4). El margen absorbe la representación binaria (12.3 × 10 no da
 * 123 exacto).
 */
function hasMoreDecimals(value: number, digits: number): boolean {
  const scaled = value * 10 ** digits;
  return Math.abs(scaled - Math.round(scaled)) > 1e-6;
}

/** Una estación tal como llega al guardado (`StationDraft` de la acción). */
export interface StationCaptureDraft {
  pointCode: string;
  angleDeg: number | null;
  angleMin: number | null;
  angleSec: number | null;
  readings: readonly { deg: number; min: number; sec: number }[];
  horizontalDistance: number | null;
}

/**
 * Los issues de captura de cada estación de un guardado. El ángulo de una
 * estación con lecturas es su promedio, el mismo que el servidor guarda: la
 * carga de la pantalla por pasos solo manda las lecturas (Fase 35). Sin
 * lecturas, vale el ángulo que venga.
 */
export function stationCaptureIssues(
  type: PolygonalType,
  stations: readonly StationCaptureDraft[],
  hasClosingRow: boolean,
  hasOrientation: boolean,
): CaptureIssues[] {
  return stations.map((st, i) => {
    const avg = averageReadings(st.readings.map((r) => dmsToDecimal(r.deg, r.min, r.sec)));
    const dms = avg !== null && Number.isFinite(avg) ? decimalToDms(avg) : null;
    return validatePolygonalStation(
      {
        pointCode: st.pointCode,
        angleDeg: dms?.deg ?? st.angleDeg,
        angleMin: dms?.min ?? st.angleMin,
        angleSec: dms?.sec ?? st.angleSec,
        distance: st.horizontalDistance,
        readings: st.readings,
      },
      expectStationCapture(type, i, stations.length, hasClosingRow, hasOrientation),
    );
  });
}

/** ¿Tiene la lista de issues algún error bloqueante? */
export function hasCaptureErrors(issues: CaptureIssues[]): boolean {
  return issues.some((i) => Object.keys(i.errors).length > 0);
}

/** ¿Tiene `value` como mucho `decimals` decimales? Con holgura de coma flotante. */
function fitsScale(value: number, decimals: number): boolean {
  const scaled = value * 10 ** decimals;
  return Math.abs(scaled - Math.round(scaled)) < 1e-6;
}

/**
 * ¿Son válidos los pesos del ajuste por mínimos cuadrados? (Fase 14.)
 * Devuelve el motivo o null.
 *
 * Se exigen completos solo con ese método, que además no aplica a la abierta
 * sin control: no tiene redundancia que ajustar. Pero los que vengan se
 * validan **siempre**, con cualquier método: se guardan igual, y un valor que
 * no cabe en su columna tumbaría el guardado con un error opaco.
 *
 * Los límites y los decimales son los de las columnas —`decimal(6,2)` y
 * `decimal(8,4)`—: un σ con más decimales se guardaría redondeado, y el
 * ajuste recalculado al reabrir no coincidiría con las coordenadas guardadas.
 */
export function validateLeastSquaresWeights(
  method: string,
  type: string,
  weights: {
    sigmaAngleSeconds: number | null;
    sigmaDistanceM: number | null;
    distanceMeasurements: number | null;
  },
): string | null {
  const { sigmaAngleSeconds: a, sigmaDistanceM: d, distanceMeasurements: m } = weights;
  if (a != null && !(a >= 0.01 && a <= 9999.99 && fitsScale(a, 2))) {
    return "El σ angular debe estar entre 0.01″ y 9999.99″, con dos decimales como mucho.";
  }
  if (d != null && !(d >= 0.0001 && d <= 9999.9999 && fitsScale(d, 4))) {
    return "El σ de distancia debe estar entre 0.0001 m y 9999.9999 m, con cuatro decimales como mucho.";
  }
  if (m != null && !(Number.isInteger(m) && m >= 1 && m <= 1000)) {
    return "El número de mediciones debe ser un entero entre 1 y 1000.";
  }
  if (method !== "least_squares") return null;
  if (type === "open_uncontrolled") {
    return "La abierta sin control no tiene nada que ajustar: elija otro método.";
  }
  if (a == null || d == null || m == null) {
    return "Faltan los pesos del ajuste: σ angular, σ de distancia y número de mediciones.";
  }
  return null;
}

/**
 * ¿Sirven estos dos puntos de control para georreferenciar? (Fase 15.)
 * Devuelve el motivo o null. Los índices son de `stations`, las filas del
 * proceso en orden; `north`/`east` son sus coordenadas calculadas.
 */
export function validateGeoreferencePoints(
  stations: { pointCode: string; north: number | null; east: number | null }[],
  a: { index: number | null; north: number | null; east: number | null },
  b: { index: number | null; north: number | null; east: number | null },
): string | null {
  const sa = a.index != null ? stations[a.index] : undefined;
  const sb = b.index != null ? stations[b.index] : undefined;
  if (!sa || !sb) return "Elija las dos estaciones de control.";
  // Con fila de cierre u orientación, el arranque aparece dos veces: es el
  // mismo punto aunque sean filas distintas.
  if (a.index === b.index || sa.pointCode === sb.pointCode) {
    return "Las dos estaciones de control deben ser puntos distintos.";
  }
  if (sa.north == null || sa.east == null || sb.north == null || sb.east == null) {
    return "Las dos estaciones deben tener coordenadas calculadas.";
  }
  if (
    a.north == null || a.east == null || b.north == null || b.east == null ||
    ![a.north, a.east, b.north, b.east].every(Number.isFinite)
  ) {
    return "Faltan las coordenadas reales de las dos estaciones.";
  }
  // El límite de `decimal(12,4)`: más allá, la base rechazaría el guardado
  // con un error que no dice por qué.
  if (![a.north, a.east, b.north, b.east].every((v) => Math.abs(v) < 1e8)) {
    return "Las coordenadas reales deben estar por debajo de 100 000 000.";
  }
  if (Math.hypot(b.north - a.north, b.east - a.east) < 0.001) {
    return "Las coordenadas reales de las dos estaciones coinciden.";
  }
  if (Math.hypot(sb.north - sa.north, sb.east - sa.east) < 0.001) {
    return "Las dos estaciones están en el mismo sitio: no definen una dirección.";
  }
  return null;
}

// --- Azimut de partida desde el punto de amarre ------------------------------

/**
 * El azimut del arranque hacia el punto de amarre, en DMS, o por qué no se
 * puede calcular (Fase 27, PU15). Lo usa la acción de guardado, que se puede
 * llamar con una carga hecha a mano: el selector del editor solo ofrece
 * puntos del proyecto con coordenadas, pero el servidor no puede suponerlo.
 * `reference` es `null` si el punto no existe en el catálogo del proyecto.
 */
export function referenceStartAzimuth(
  start: { north: number; east: number },
  reference: { north: number | string | null; east: number | string | null } | null,
): Dms | { error: string } {
  if (reference === null) {
    return { error: "El punto de amarre no está en el catálogo del proyecto." };
  }
  if (reference.north == null || reference.east == null) {
    return { error: "El punto de amarre no tiene coordenadas." };
  }
  return decimalToDms(
    azimuthFromCoordinates(start.north, start.east, Number(reference.north), Number(reference.east)),
  );
}
