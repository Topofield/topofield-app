// Cálculo de poligonales — funciones puras (PRD § 6.2-6.6, marco teórico
// mt-poligonales.docx). Sin React, sin Supabase. Solo aritmética topográfica.
//
// Convención de azimuts (la del marco teórico mt-poligonales.docx; las dos
// orientaciones del recorrido producen polígonos espejo que igualmente cierran,
// por eso la convención debe ser fija, no autodetectable):
//  - Cerrada: Az_i = Az_{i-1} + 180° − ángulo interno_i (caso 1 del documento).
//  - Abierta sin control: Az_i = Az_{i-1} + 180° + ángulo horizontal_i (caso 3).
//  - Abierta con control: Az_i = Az_{i-1} ± deflexión_i (+ derecha, − izquierda).

import { cosDeg, degreesToSeconds, normalizeAzimuth, sinDeg } from "./angles";
import { adjustByConditions } from "./least-squares";
import { angularTolerance, minRelativePrecision } from "./tolerances";
import type {
  CorrectionMethod,
  LeastSquaresAdjustment,
  LeastSquaresWeights,
  ReadingInput,
  PolygonalInput,
  PolygonalResult,
  StationInput,
  StationResult,
} from "@/types/polygonal";

function isNum(x: number | null | undefined): x is number {
  return typeof x === "number" && Number.isFinite(x);
}

/** `null` en vez de NaN o undefined: la ausencia de un dato no es un número. */
function finiteOrNull(x: number | null | undefined): number | null {
  return isNum(x) ? x : null;
}

/** Dispersión entre lecturas de un mismo ángulo, en segundos de arco. */
function dispersionSeconds(readings: ReadingInput[]): number | null {
  if (readings.length < 2) return null;
  const values = readings.map((r) => r.angle);
  return degreesToSeconds(Math.max(...values) - Math.min(...values));
}

/** Resultado por estación vacío (datos insuficientes para calcular). */
function blankStations(stations: StationInput[]): StationResult[] {
  return stations.map((s) => ({
    pointCode: s.pointCode,
    correctedAngle: null,
    azimuth: null,
    deltaNorth: null,
    deltaEast: null,
    correctedDeltaNorth: null,
    correctedDeltaEast: null,
    north: null,
    east: null,
    readingDispersion: dispersionSeconds(s.readings),
  }));
}

/** Aplica un método de corrección a las proyecciones de los lados. */
function correctDeltas(
  method: CorrectionMethod,
  deltaN: number[],
  deltaE: number[],
  distances: number[],
  azimuths: number[],
  errorN: number,
  errorE: number,
  perimeter: number,
): { correctedDeltaN: number[]; correctedDeltaE: number[] } {
  const n = deltaN.length;
  const correctedDeltaN: number[] = [];
  const correctedDeltaE: number[] = [];

  if (method === "bowditch") {
    for (let i = 0; i < n; i++) {
      const ratio = perimeter > 0 ? (distances[i] ?? 0) / perimeter : 0;
      correctedDeltaN.push((deltaN[i] ?? 0) - errorN * ratio);
      correctedDeltaE.push((deltaE[i] ?? 0) - errorE * ratio);
    }
    return { correctedDeltaN, correctedDeltaE };
  }

  if (method === "transit") {
    const sumAbsN = deltaN.reduce((a, d) => a + Math.abs(d), 0);
    const sumAbsE = deltaE.reduce((a, d) => a + Math.abs(d), 0);
    for (let i = 0; i < n; i++) {
      const rN = sumAbsN > 0 ? Math.abs(deltaN[i] ?? 0) / sumAbsN : 0;
      const rE = sumAbsE > 0 ? Math.abs(deltaE[i] ?? 0) / sumAbsE : 0;
      correctedDeltaN.push((deltaN[i] ?? 0) - errorN * rN);
      correctedDeltaE.push((deltaE[i] ?? 0) - errorE * rE);
    }
    return { correctedDeltaN, correctedDeltaE };
  }

  // Crandall: ángulos fijos; corrige las distancias por mínimos cuadrados
  // ponderados (peso 1/d). Sistema 2×2 con λ1, λ2 y δd_i = d_i(λ1·cosAz+λ2·sinAz).
  let a11 = 0;
  let a12 = 0;
  let a22 = 0;
  for (let i = 0; i < n; i++) {
    const d = distances[i] ?? 0;
    const c = cosDeg(azimuths[i] ?? 0);
    const s = sinDeg(azimuths[i] ?? 0);
    a11 += d * c * c;
    a12 += d * c * s;
    a22 += d * s * s;
  }
  const det = a11 * a22 - a12 * a12;
  let lambda1 = 0;
  let lambda2 = 0;
  if (Math.abs(det) > 1e-12) {
    lambda1 = (a22 * -errorN - a12 * -errorE) / det;
    lambda2 = (-a12 * -errorN + a11 * -errorE) / det;
  }
  for (let i = 0; i < n; i++) {
    const d = distances[i] ?? 0;
    const c = cosDeg(azimuths[i] ?? 0);
    const s = sinDeg(azimuths[i] ?? 0);
    const deltaD = d * (lambda1 * c + lambda2 * s);
    correctedDeltaN.push((deltaN[i] ?? 0) + deltaD * c);
    correctedDeltaE.push((deltaE[i] ?? 0) + deltaD * s);
  }
  return { correctedDeltaN, correctedDeltaE };
}

/** Encadena coordenadas a partir del punto de partida y las proyecciones. */
function chainCoordinates(
  startNorth: number,
  startEast: number,
  deltaN: number[],
  deltaE: number[],
): { north: number[]; east: number[] } {
  const north = [startNorth];
  const east = [startEast];
  for (let i = 0; i < deltaN.length; i++) {
    north.push((north[i] ?? 0) + (deltaN[i] ?? 0));
    east.push((east[i] ?? 0) + (deltaE[i] ?? 0));
  }
  return { north, east };
}

// ----------------------------------------------------------------------------
// Poligonal cerrada
// ----------------------------------------------------------------------------

function computeClosed(input: PolygonalInput): PolygonalResult {
  const { stations } = input;
  const n = stations.length;
  const angles = stations.map((s) => s.angle);
  const distances = stations.map((s) => s.distance);

  // Con orientación, la última fila es de control y no abre lado: los vértices
  // son stations.length - 1. Sin orientación, cada fila es un vértice.
  const vertexCount = input.hasOrientation ? n - 1 : n;
  // Solo las filas de vértice aportan lado; la de control no. Sin fila de
  // cierre esa última fila repite el primer lado a modo de chequeo (cartera
  // Vivero), así que su distancia NO puede entrar al perímetro: si entra,
  // Bowditch reparte sobre un perímetro inflado y la poligonal deja de cerrar.
  const sideCount = vertexCount;
  const perimeter = distances
    .slice(0, sideCount)
    .reduce<number>((a, d) => (isNum(d) ? a + d : a), 0);

  // Qué ángulos entran en la condición de cierre angular. Con fila de cierre
  // entran todos, incluido el de orientación, y el vértice de arranque aporta
  // sus dos lecturas: de ahí el +360 de la suma teórica. Sin fila de cierre el
  // de orientación solo fija el datum y queda fuera de la suma — es el esquema
  // de la cartera Vivero (hallazgo 4 del PRD de fase).
  const firstParticipating =
    input.hasOrientation && !input.hasClosingRow ? 1 : 0;

  const theoreticalSumFor = (vertices: number): number => {
    const base =
      input.angleType === "exterior"
        ? (vertices + 2) * 180
        : (vertices - 2) * 180;
    return base + (input.hasOrientation && input.hasClosingRow ? 360 : 0);
  };

  const hasAllData =
    vertexCount >= 3 &&
    angles.every(isNum) &&
    distances.slice(0, sideCount).every(isNum);

  if (!hasAllData) {
    return {
      angleSum: null,
      theoreticalSum: vertexCount >= 3 ? theoreticalSumFor(vertexCount) : null,
      angularError: null,
      angularTolerance: null,
      anglesMeetTolerance: null,
      errorNorth: null,
      errorEast: null,
      linearError: null,
      perimeter,
      relativePrecision: null,
      meetsLinearTolerance: null,
      reorientationError: null,
      meetsTolerance: null,
      stations: blankStations(stations),
    };
  }

  // Verificación angular
  const participating = angles.slice(firstParticipating);
  const angleSum = participating.reduce((a, b) => a + b, 0);
  const theoreticalSum = theoreticalSumFor(vertexCount);
  const angularErrorDeg = angleSum - theoreticalSum;
  const angularError = degreesToSeconds(angularErrorDeg);
  const tolerance = angularTolerance(input.order, participating.length);
  const anglesMeetTolerance = Math.abs(angularError) <= tolerance;
  const correctionPerAngle = -angularErrorDeg / participating.length;
  const correctedAngles = angles.map((a, i) =>
    i >= firstParticipating ? a + correctionPerAngle : a,
  );

  // Azimuts. El instrumento pone cero en la vista atrás y gira a la derecha,
  // así que el ángulo SE SUMA. Con orientación el primer azimut sale del azimut
  // de amarre más el ángulo de orientación, sin el ±180: `startAzimuth` ya
  // apunta del arranque HACIA la referencia.
  const azimuths: number[] = [
    input.hasOrientation
      ? normalizeAzimuth(input.startAzimuth + (correctedAngles[0] ?? 0))
      : input.startAzimuth,
  ];
  for (let i = 1; i < n; i++) {
    azimuths.push(
      normalizeAzimuth((azimuths[i - 1] ?? 0) + 180 + (correctedAngles[i] ?? 0)),
    );
  }

  // Control de reorientación: el último azimut de la cadena debe volver al
  // azimut de amarre (con fila de cierre) o al del primer lado (sin ella).
  // No condiciona el veredicto de cierre: es control de calidad del
  // levantamiento, no criterio de tolerancia.
  let reorientationError: number | null = null;
  if (input.hasOrientation) {
    const target = input.hasClosingRow
      ? normalizeAzimuth(input.startAzimuth)
      : (azimuths[0] ?? 0);
    const diff = normalizeAzimuth((azimuths[n - 1] ?? 0) - target);
    reorientationError = degreesToSeconds(diff > 180 ? diff - 360 : diff);
  }

  const sideAzimuths = azimuths.slice(0, sideCount);
  const sideDistances = distances
    .slice(0, sideCount)
    .map((d) => (isNum(d) ? d : 0));
  const deltaN = sideAzimuths.map((az, i) => (sideDistances[i] ?? 0) * cosDeg(az));
  const deltaE = sideAzimuths.map((az, i) => (sideDistances[i] ?? 0) * sinDeg(az));
  const errorN = deltaN.reduce((a, b) => a + b, 0);
  const errorE = deltaE.reduce((a, b) => a + b, 0);
  const base = {
    azimuths,
    deltaN,
    deltaE,
    errorN,
    errorE,
    linearError: Math.hypot(errorN, errorE),
  };

  const proportional = correctDeltas(
    input.method,
    base.deltaN,
    base.deltaE,
    sideDistances,
    sideAzimuths,
    base.errorN,
    base.errorE,
    perimeter,
  );

  // Mínimos cuadrados (Fase 14): parte de las observaciones CRUDAS y sustituye
  // ángulos, azimuts y proyecciones corregidas. El veredicto de arriba no
  // cambia: se juzga con el error antes de ajustar. Sin pesos no hay ajuste ni
  // coordenadas: se dice, no se inventan.
  const ls =
    input.method !== "least_squares"
      ? null
      : weightsValid(input.leastSquares)
        ? leastSquaresClosed(
            input,
            sideCount,
            firstParticipating,
            theoreticalSum,
            input.leastSquares,
          )
        : ("missing_weights" as const);
  const nullsOf = (len: number) => Array.from({ length: len }, () => Number.NaN);
  const correctedDeltaN =
    ls === "missing_weights" ? nullsOf(sideCount) : (ls?.deltaN ?? proportional.correctedDeltaN);
  const correctedDeltaE =
    ls === "missing_weights" ? nullsOf(sideCount) : (ls?.deltaE ?? proportional.correctedDeltaE);
  const finalAngles = ls && ls !== "missing_weights" ? ls.angles : correctedAngles;
  const finalAzimuths = ls && ls !== "missing_weights" ? ls.azimuths : base.azimuths;

  // Coordenadas: la última estación cierra sobre el punto de partida, así que
  // solo se conservan las primeras coordenadas encadenadas.
  const coords = chainCoordinates(
    input.startNorth,
    input.startEast,
    correctedDeltaN,
    correctedDeltaE,
  );

  const linearError = base.linearError;
  // Umbral de exactitud: un cierre "perfecto" no da linearError === 0 sino un
  // residuo de punto flotante (del orden de 1e-14) por la acumulación de senos
  // y cosenos en el encadenamiento de coordenadas. 1e-9 m (1 nanómetro) está
  // diez órdenes de magnitud por debajo de cualquier precisión instrumental
  // real y muy por encima de ese residuo, así que sirve como umbral de "cierre
  // exacto" sin arriesgar falsos positivos.
  const relativePrecision =
    linearError > 1e-9 ? perimeter / linearError : Infinity;
  const meetsLinearTolerance =
    relativePrecision >= minRelativePrecision(input.order);

  const stationResults: StationResult[] = stations.map((s, i) => ({
    pointCode: s.pointCode,
    correctedAngle: ls === "missing_weights" ? null : (finalAngles[i] ?? null),
    azimuth: finalAzimuths[i] ?? null,
    deltaNorth: base.deltaN[i] ?? null,
    deltaEast: base.deltaE[i] ?? null,
    correctedDeltaNorth: finiteOrNull(correctedDeltaN[i]),
    correctedDeltaEast: finiteOrNull(correctedDeltaE[i]),
    north: finiteOrNull(coords.north[i]),
    east: finiteOrNull(coords.east[i]),
    readingDispersion: dispersionSeconds(s.readings),
  }));

  return {
    angleSum,
    theoreticalSum,
    angularError,
    angularTolerance: tolerance,
    anglesMeetTolerance,
    errorNorth: base.errorN,
    errorEast: base.errorE,
    linearError,
    perimeter,
    relativePrecision,
    meetsLinearTolerance,
    reorientationError,
    meetsTolerance: anglesMeetTolerance && meetsLinearTolerance,
    stations: stationResults,
    ...(ls === null
      ? {}
      : { adjustment: ls === "missing_weights" ? { status: "missing_weights" } : ls.adjustment }),
  };
}

// ----------------------------------------------------------------------------
// Poligonal abierta con control (deflexiones, punto de llegada conocido)
// ----------------------------------------------------------------------------

function computeOpenControlled(input: PolygonalInput): PolygonalResult {
  const { stations } = input;
  const n = stations.length;
  // n estaciones, n-1 lados; el último lado llega al punto conocido.
  const sideCount = n - 1;
  const distances = stations.slice(0, sideCount).map((s) => s.distance);
  const perimeter = distances.reduce<number>((a, d) => (isNum(d) ? a + d : a), 0);
  const hasEnd = isNum(input.endNorth) && isNum(input.endEast);

  // Cierre angular (§6.6 Paso 2): requiere azimut de llegada conocido + la
  // deflexión en la última estación, que conecta el último lado con la
  // dirección de llegada. Si falta cualquiera, el cierre angular se omite y
  // solo se hace el lineal (degrada con elegancia).
  const lastStation = stations[n - 1];
  const hasEndAzimuth = isNum(input.endAzimuth);
  const hasClosingDeflection =
    lastStation != null && isNum(lastStation.angle);
  const doAngularClosure = hasEndAzimuth && hasClosingDeflection;
  const requiredDeflectionsLast = doAngularClosure ? n - 1 : n - 2;
  const deflectionsValid = stations
    .slice(1, requiredDeflectionsLast + 1)
    .every((s) => isNum(s.angle));
  const hasData = n >= 2 && distances.every(isNum) && deflectionsValid;

  if (!hasData || !hasEnd) {
    return {
      angleSum: null,
      theoreticalSum: null,
      angularError: null,
      angularTolerance: null,
      anglesMeetTolerance: null,
      errorNorth: null,
      errorEast: null,
      linearError: null,
      perimeter,
      relativePrecision: null,
      meetsLinearTolerance: null,
      reorientationError: null,
      meetsTolerance: null,
      stations: blankStations(stations),
    };
  }

  // Cierre angular: propaga deflexiones crudas hasta la dirección de llegada y
  // compara contra el azimut conocido. La corrección se reparte equitativa.
  let angularError: number | null = null;
  let angularToleranceValue: number | null = null;
  let anglesMeetTolerance: boolean | null = null;
  let correctionPerDeflection = 0;
  if (doAngularClosure) {
    let azCalc = input.startAzimuth;
    for (let i = 1; i <= n - 1; i++) {
      const st = stations[i];
      const dir = st?.deflectionDirection === "left" ? -1 : 1;
      azCalc = normalizeAzimuth(azCalc + dir * (st?.angle ?? 0));
    }
    let errorDeg = azCalc - (input.endAzimuth ?? 0);
    // Normaliza a (-180, 180] para tomar el error en valor absoluto menor.
    errorDeg = ((errorDeg + 540) % 360) - 180;
    angularError = degreesToSeconds(errorDeg);
    angularToleranceValue = angularTolerance(input.order, n - 1);
    anglesMeetTolerance = Math.abs(angularError) <= angularToleranceValue;
    correctionPerDeflection = -errorDeg / (n - 1);
  }

  // Azimut de cada lado con la deflexión corregida (la corrección es 0 si no
  // hubo cierre angular).
  const azimuths: number[] = [input.startAzimuth];
  for (let i = 1; i < sideCount; i++) {
    const station = stations[i];
    const dir = station?.deflectionDirection === "left" ? -1 : 1;
    const signedDefl = dir * (station?.angle ?? 0) + correctionPerDeflection;
    azimuths.push(normalizeAzimuth((azimuths[i - 1] ?? 0) + signedDefl));
  }
  const deltaN = azimuths.map((az, i) => (distances[i] ?? 0) * cosDeg(az));
  const deltaE = azimuths.map((az, i) => (distances[i] ?? 0) * sinDeg(az));

  // Cierre lineal contra el punto de llegada conocido.
  const rawNorth = chainCoordinates(
    input.startNorth,
    input.startEast,
    deltaN,
    deltaE,
  );
  const lastIdx = sideCount;
  const errorN = (rawNorth.north[lastIdx] ?? 0) - (input.endNorth ?? 0);
  const errorE = (rawNorth.east[lastIdx] ?? 0) - (input.endEast ?? 0);
  const linearError = Math.hypot(errorN, errorE);

  const proportional = correctDeltas(
    input.method,
    deltaN,
    deltaE,
    distances,
    azimuths,
    errorN,
    errorE,
    perimeter,
  );

  // Mínimos cuadrados (Fase 14): igual que en la cerrada, desde las
  // observaciones crudas; el veredicto de arriba no cambia.
  const ls =
    input.method !== "least_squares"
      ? null
      : weightsValid(input.leastSquares)
        ? leastSquaresOpenControlled(input, doAngularClosure, input.leastSquares)
        : ("missing_weights" as const);
  const nans = (len: number) => Array.from({ length: len }, () => Number.NaN);
  const correctedDeltaN =
    ls === "missing_weights" ? nans(sideCount) : (ls?.deltaN ?? proportional.correctedDeltaN);
  const correctedDeltaE =
    ls === "missing_weights" ? nans(sideCount) : (ls?.deltaE ?? proportional.correctedDeltaE);
  const finalAzimuths = ls && ls !== "missing_weights" ? ls.azimuths : azimuths;
  const coords = chainCoordinates(
    input.startNorth,
    input.startEast,
    correctedDeltaN,
    correctedDeltaE,
  );

  const relativePrecision =
    linearError > 0 ? perimeter / linearError : Infinity;
  const meetsLinearTolerance =
    relativePrecision >= minRelativePrecision(input.order);

  const stationResults: StationResult[] = stations.map((s, i) => ({
    pointCode: s.pointCode,
    readingDispersion: dispersionSeconds(s.readings),
    correctedAngle: ls && ls !== "missing_weights" ? (ls.angles[i] ?? null) : null,
    azimuth: finalAzimuths[i] ?? null,
    deltaNorth: deltaN[i] ?? null,
    deltaEast: deltaE[i] ?? null,
    correctedDeltaNorth: finiteOrNull(correctedDeltaN[i]),
    correctedDeltaEast: finiteOrNull(correctedDeltaE[i]),
    north: finiteOrNull(coords.north[i]),
    east: finiteOrNull(coords.east[i]),
  }));

  return {
    angleSum: null,
    theoreticalSum: null,
    angularError,
    angularTolerance: angularToleranceValue,
    anglesMeetTolerance,
    errorNorth: errorN,
    errorEast: errorE,
    linearError,
    perimeter,
    relativePrecision,
    meetsLinearTolerance,
    reorientationError: null,
    meetsTolerance:
      (anglesMeetTolerance ?? true) && meetsLinearTolerance,
    stations: stationResults,
    ...(ls === null
      ? {}
      : { adjustment: ls === "missing_weights" ? { status: "missing_weights" } : ls.adjustment }),
  };
}

// ----------------------------------------------------------------------------
// Poligonal abierta sin control (sin cierre ni corrección)
// ----------------------------------------------------------------------------

function computeOpenUncontrolled(input: PolygonalInput): PolygonalResult {
  const { stations } = input;
  const n = stations.length;
  const sideCount = n - 1;
  const distances = stations.slice(0, sideCount).map((s) => s.distance);
  const perimeter = distances.reduce<number>((a, d) => (isNum(d) ? a + d : a), 0);
  const hasData =
    n >= 2 &&
    distances.every(isNum) &&
    stations.slice(1, sideCount).every((s) => isNum(s.angle));

  if (!hasData) {
    return {
      angleSum: null,
      theoreticalSum: null,
      angularError: null,
      angularTolerance: null,
      anglesMeetTolerance: null,
      errorNorth: null,
      errorEast: null,
      linearError: null,
      perimeter,
      relativePrecision: null,
      meetsLinearTolerance: null,
      reorientationError: null,
      meetsTolerance: null,
      stations: blankStations(stations),
    };
  }

  const azimuths: number[] = [input.startAzimuth];
  for (let i = 1; i < sideCount; i++) {
    azimuths.push(
      normalizeAzimuth((azimuths[i - 1] ?? 0) + 180 + (stations[i]?.angle ?? 0)),
    );
  }
  const deltaN = azimuths.map((az, i) => (distances[i] ?? 0) * cosDeg(az));
  const deltaE = azimuths.map((az, i) => (distances[i] ?? 0) * sinDeg(az));
  const coords = chainCoordinates(
    input.startNorth,
    input.startEast,
    deltaN,
    deltaE,
  );

  const stationResults: StationResult[] = stations.map((s, i) => ({
    pointCode: s.pointCode,
    readingDispersion: dispersionSeconds(s.readings),
    correctedAngle: null,
    azimuth: azimuths[i] ?? null,
    deltaNorth: deltaN[i] ?? null,
    deltaEast: deltaE[i] ?? null,
    // Sin cierre no hay corrección: las proyecciones corregidas son las crudas.
    correctedDeltaNorth: deltaN[i] ?? null,
    correctedDeltaEast: deltaE[i] ?? null,
    north: coords.north[i] ?? null,
    east: coords.east[i] ?? null,
  }));

  return {
    angleSum: null,
    theoreticalSum: null,
    angularError: null,
    angularTolerance: null,
    anglesMeetTolerance: null,
    errorNorth: null,
    errorEast: null,
    linearError: null,
    perimeter,
    relativePrecision: null,
    meetsLinearTolerance: null,
    reorientationError: null,
    meetsTolerance: null,
    stations: stationResults,
  };
}

/**
 * Calcula una poligonal completa. Es total: nunca lanza; con datos insuficientes
 * devuelve un resultado con los campos no calculables en `null`.
 */
export function computePolygonal(input: PolygonalInput): PolygonalResult {
  switch (input.type) {
    case "closed":
      return computeClosed(input);
    case "open_controlled":
      return computeOpenControlled(input);
    case "open_uncontrolled":
      return computeOpenUncontrolled(input);
  }
}

// ----------------------------------------------------------------------------
// Trazas para el dibujo (Fase 13)
// ----------------------------------------------------------------------------

/** Un vértice del dibujo: dónde queda ajustado y dónde quedaría sin compensar. */
export interface TracePoint {
  code: string;
  adjusted: { north: number; east: number };
  unadjusted: { north: number; east: number };
}

/**
 * La poligonal ajustada y la sin compensar, vértice a vértice, para dibujarlas.
 *
 * No hay matemática nueva: las dos se encadenan desde el arranque con las
 * proyecciones que el motor ya calculó — las corregidas para la ajustada y las
 * originales (`deltaNorth`, `deltaEast`, con el azimut ya corregido
 * angularmente) para la sin compensar. Por construcción:
 *
 * - en una **cerrada**, el último punto repite el arranque: ajustado, cae en
 *   él; sin compensar, queda a `(errorNorth, errorEast)` de él;
 * - en una **abierta con control**, el último punto sin compensar queda a
 *   `(errorNorth, errorEast)` del punto de llegada conocido;
 * - en una **abierta sin control**, las dos coinciden: no hay nada que
 *   compensar.
 *
 * Devuelve `null` si el motor aún no tiene proyecciones (datos incompletos).
 */
export function polygonalTraces(
  input: PolygonalInput,
  result: PolygonalResult,
): TracePoint[] | null {
  const { stations } = result;
  // Sin arranque no hay dónde anclar el dibujo: con el Norte o el Este en
  // blanco las proyecciones siguen siendo finitas, y sin esta guarda todos los
  // puntos saldrían NaN.
  if (!isNum(input.startNorth) || !isNum(input.startEast)) return null;

  // Lados con proyección, en orden. En una cerrada la fila de control (con
  // orientación) no abre lado y trae las proyecciones en null.
  const legs: { dN: number; dE: number; cN: number; cE: number }[] = [];
  // Solo la abierta sin control dibuja la proyección cruda como «ajustada»:
  // no se corrige. En las demás, sin proyección corregida no hay ajustada que
  // dibujar —p. ej., mínimos cuadrados sin pesos— y no se inventa.
  const uncorrected = input.type === "open_uncontrolled";
  for (const s of stations) {
    if (!isNum(s.deltaNorth) || !isNum(s.deltaEast)) break;
    const cN = isNum(s.correctedDeltaNorth) ? s.correctedDeltaNorth : uncorrected ? s.deltaNorth : null;
    const cE = isNum(s.correctedDeltaEast) ? s.correctedDeltaEast : uncorrected ? s.deltaEast : null;
    if (cN === null || cE === null) break;
    legs.push({ dN: s.deltaNorth, dE: s.deltaEast, cN, cE });
  }

  // Una abierta tiene un punto por estación (la última no abre lado: su
  // distancia es 0); una cerrada, uno por lado más el de cierre.
  const pointCount = input.type === "closed" ? legs.length + 1 : stations.length;
  const legsUsed = pointCount - 1;
  if (legsUsed < 1 || legs.length < legsUsed) return null;

  const points: TracePoint[] = [];
  let adjusted = { north: input.startNorth, east: input.startEast };
  let unadjusted = { ...adjusted };
  for (let i = 0; i < pointCount; i++) {
    const code =
      input.type === "closed" && i === pointCount - 1
        ? (stations[0]?.pointCode ?? "")
        : (stations[i]?.pointCode ?? "");
    points.push({ code, adjusted, unadjusted });
    const leg = legs[i];
    if (i < legsUsed && leg) {
      adjusted = { north: adjusted.north + leg.cN, east: adjusted.east + leg.cE };
      unadjusted = {
        north: unadjusted.north + leg.dN,
        east: unadjusted.east + leg.dE,
      };
    }
  }
  return points;
}

// ----------------------------------------------------------------------------
// Mínimos cuadrados por ecuaciones de condición (Fase 14)
// ----------------------------------------------------------------------------

const RHO_SECONDS = 206264.80624709636;
const D2R = Math.PI / 180;

/** Lo que el ajuste aporta a una poligonal: observaciones y geometría ajustadas. */
interface LeastSquaresOutcome {
  /** Ángulo ajustado de cada estación (grados); las fijas quedan como se midieron. */
  angles: number[];
  /** Distancia ajustada de cada lado (m), por índice de lado. */
  distances: number[];
  azimuths: number[];
  deltaN: number[];
  deltaE: number[];
  adjustment: Extract<LeastSquaresAdjustment, { status: "adjusted" }>;
}

/** σ efectivos: el angular en radianes y el de distancia sobre √mediciones. */
function sigmasOf(weights: LeastSquaresWeights) {
  return {
    angle: weights.sigmaAngleSeconds / RHO_SECONDS,
    distance: weights.sigmaDistanceM / Math.sqrt(weights.distanceMeasurements),
  };
}

function weightsValid(w: LeastSquaresWeights | null | undefined): w is LeastSquaresWeights {
  return (
    w != null &&
    isNum(w.sigmaAngleSeconds) &&
    w.sigmaAngleSeconds > 0 &&
    isNum(w.sigmaDistanceM) &&
    w.sigmaDistanceM > 0 &&
    isNum(w.distanceMeasurements) &&
    w.distanceMeasurements >= 1
  );
}

/** Correcciones por estación a partir de las del ajuste. */
function perStation<T>(n: number, pairs: [number, T][]): (T | null)[] {
  const out: (T | null)[] = Array.from({ length: n }, () => null);
  for (const [i, v] of pairs) out[i] = v;
  return out;
}

/**
 * Cerrada. Observaciones: los ángulos que entran en la condición angular salvo
 * el de orientación, que es datum (PRD, decisión 6), y las distancias de los
 * lados. Condiciones: suma angular, Σ ΔN = 0 y Σ ΔE = 0.
 *
 * El azimut del lado k es el de partida más los ángulos 1..k: un ángulo i ≥ 1
 * arrastra los lados k ≥ i. El de la estación 0 solo cuenta si es el de
 * orientación, que no se ajusta; sin orientación no arrastra ningún lado.
 */
function leastSquaresClosed(
  input: PolygonalInput,
  sideCount: number,
  firstParticipating: number,
  theoreticalSum: number,
  weights: LeastSquaresWeights,
): LeastSquaresOutcome {
  const angles0 = input.stations.map((s) => s.angle);
  const distances0 = input.stations.slice(0, sideCount).map((s) => s.distance ?? 0);
  const adjustable: number[] = [];
  for (let i = firstParticipating; i < angles0.length; i++) {
    if (!(input.hasOrientation && i === 0)) adjustable.push(i);
  }
  const sig = sigmasOf(weights);
  const na = adjustable.length;

  const geometry = (l: number[]) => {
    const angles = [...angles0];
    adjustable.forEach((idx, j) => (angles[idx] = l[j]! / D2R));
    const distances = l.slice(na);
    const azimuths: number[] = [
      input.hasOrientation
        ? normalizeAzimuth(input.startAzimuth + (angles[0] ?? 0))
        : input.startAzimuth,
    ];
    for (let i = 1; i < angles.length; i++) {
      azimuths.push(normalizeAzimuth((azimuths[i - 1] ?? 0) + 180 + (angles[i] ?? 0)));
    }
    const deltaN = distances.map((d, k) => d * cosDeg(azimuths[k] ?? 0));
    const deltaE = distances.map((d, k) => d * sinDeg(azimuths[k] ?? 0));
    return { angles, distances, azimuths, deltaN, deltaE };
  };

  const result = adjustByConditions({
    observations: [...adjustable.map((i) => angles0[i]! * D2R), ...distances0],
    sigmas: [...adjustable.map(() => sig.angle), ...distances0.map(() => sig.distance)],
    evaluate: (l) => {
      const g = geometry(l);
      const angleSum = g.angles.slice(firstParticipating).reduce((a, b) => a + b, 0);
      const f = [
        (angleSum - theoreticalSum) * D2R,
        g.deltaN.reduce((a, b) => a + b, 0),
        g.deltaE.reduce((a, b) => a + b, 0),
      ];
      const rowAngle = [...adjustable.map(() => 1), ...distances0.map(() => 0)];
      const rowN: number[] = [];
      const rowE: number[] = [];
      for (const idx of adjustable) {
        let sN = 0;
        let sE = 0;
        if (idx >= 1) {
          for (let k = idx; k < sideCount; k++) {
            sN -= g.deltaE[k] ?? 0;
            sE += g.deltaN[k] ?? 0;
          }
        }
        rowN.push(sN);
        rowE.push(sE);
      }
      for (let k = 0; k < sideCount; k++) {
        rowN.push(cosDeg(g.azimuths[k] ?? 0));
        rowE.push(sinDeg(g.azimuths[k] ?? 0));
      }
      return { f, A: [rowAngle, rowN, rowE] };
    },
  });

  const g = geometry(result.adjusted);
  const n = input.stations.length;
  return {
    ...g,
    adjustment: {
      status: "adjusted",
      angleCorrectionsSec: perStation(
        n,
        adjustable.map((idx, j) => [idx, (result.corrections[j] ?? 0) * RHO_SECONDS]),
      ),
      distanceCorrectionsM: perStation(
        n,
        distances0.map((_, k) => [k, result.corrections[na + k] ?? 0]),
      ),
      adjustedDistances: perStation(n, g.distances.map((d, k) => [k, d])),
      sigma0: result.sigma0,
      conditions: 3,
      iterations: result.iterations,
    },
  };
}

/**
 * Abierta con control. Observaciones: las deflexiones con signo de las
 * estaciones 1.. (la última solo si hay cierre angular) y las distancias de
 * los lados. Condiciones: azimut final contra el de llegada (si lo hay) y
 * llegada al punto conocido en N y en E.
 */
function leastSquaresOpenControlled(
  input: PolygonalInput,
  doAngularClosure: boolean,
  weights: LeastSquaresWeights,
): LeastSquaresOutcome {
  const { stations } = input;
  const n = stations.length;
  const sideCount = n - 1;
  const lastDeflection = doAngularClosure ? n - 1 : n - 2;
  const deflIdx: number[] = [];
  for (let i = 1; i <= lastDeflection; i++) deflIdx.push(i);
  const dir = (i: number) => (stations[i]?.deflectionDirection === "left" ? -1 : 1);
  const signed0 = deflIdx.map((i) => dir(i) * (stations[i]?.angle ?? 0));
  const distances0 = stations.slice(0, sideCount).map((s) => s.distance ?? 0);
  const sig = sigmasOf(weights);
  const nd = deflIdx.length;

  const geometry = (l: number[]) => {
    const signed = l.slice(0, nd).map((x) => x / D2R);
    const distances = l.slice(nd);
    const azimuths: number[] = [input.startAzimuth];
    for (let k = 1; k < sideCount; k++) {
      azimuths.push(normalizeAzimuth((azimuths[k - 1] ?? 0) + (signed[k - 1] ?? 0)));
    }
    const deltaN = distances.map((d, k) => d * cosDeg(azimuths[k] ?? 0));
    const deltaE = distances.map((d, k) => d * sinDeg(azimuths[k] ?? 0));
    return { signed, distances, azimuths, deltaN, deltaE };
  };

  const result = adjustByConditions({
    observations: [...signed0.map((s) => s * D2R), ...distances0],
    sigmas: [...signed0.map(() => sig.angle), ...distances0.map(() => sig.distance)],
    evaluate: (l) => {
      const g = geometry(l);
      const f: number[] = [];
      const A: number[][] = [];
      if (doAngularClosure) {
        let az = input.startAzimuth + g.signed.reduce((a, b) => a + b, 0) - (input.endAzimuth ?? 0);
        az = ((((az + 180) % 360) + 360) % 360) - 180;
        f.push(az * D2R);
        A.push([...deflIdx.map(() => 1), ...distances0.map(() => 0)]);
      }
      f.push(
        input.startNorth + g.deltaN.reduce((a, b) => a + b, 0) - (input.endNorth ?? 0),
        input.startEast + g.deltaE.reduce((a, b) => a + b, 0) - (input.endEast ?? 0),
      );
      const rowN: number[] = [];
      const rowE: number[] = [];
      for (const i of deflIdx) {
        let sN = 0;
        let sE = 0;
        for (let k = i; k < sideCount; k++) {
          sN -= g.deltaE[k] ?? 0;
          sE += g.deltaN[k] ?? 0;
        }
        rowN.push(sN);
        rowE.push(sE);
      }
      for (let k = 0; k < sideCount; k++) {
        rowN.push(cosDeg(g.azimuths[k] ?? 0));
        rowE.push(sinDeg(g.azimuths[k] ?? 0));
      }
      A.push(rowN, rowE);
      return { f, A };
    },
  });

  const g = geometry(result.adjusted);
  const angles = stations.map((s) => s.angle);
  deflIdx.forEach((i, j) => (angles[i] = Math.abs(g.signed[j] ?? 0)));
  return {
    angles,
    distances: g.distances,
    azimuths: g.azimuths,
    deltaN: g.deltaN,
    deltaE: g.deltaE,
    adjustment: {
      status: "adjusted",
      angleCorrectionsSec: perStation(
        n,
        deflIdx.map((i, j) => [i, dir(i) * (result.corrections[j] ?? 0) * RHO_SECONDS]),
      ),
      distanceCorrectionsM: perStation(
        n,
        distances0.map((_, k) => [k, result.corrections[nd + k] ?? 0]),
      ),
      adjustedDistances: perStation(n, g.distances.map((d, k) => [k, d])),
      sigma0: result.sigma0,
      conditions: doAngularClosure ? 3 : 2,
      iterations: result.iterations,
    },
  };
}
