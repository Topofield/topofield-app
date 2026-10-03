// Tolerancias por orden de precisión — constantes y fórmulas (PRD § 5.4).
// Funciones puras. Las tolerancias viven aquí, nunca hardcodeadas en componentes.
//
// Tolerancias de poligonal (Fase 3) y nivelación (Fase 4).

import type { PrecisionOrder } from "@/types/project";

/** Coeficiente K de la tolerancia angular K·√n, en segundos de arco. */
export const ANGULAR_TOLERANCE_K: Record<PrecisionOrder, number> = {
  primer_orden: 1,
  segundo_orden: 5,
  tercer_orden: 15,
  ordinario: 30,
};

/** Precisión relativa mínima exigida, expresada como el X de 1:X. */
export const MIN_RELATIVE_PRECISION: Record<PrecisionOrder, number> = {
  primer_orden: 100000,
  segundo_orden: 20000,
  tercer_orden: 5000,
  ordinario: 3000,
};

/**
 * Tolerancia angular en segundos de arco: K·√n, donde n es el número de
 * ángulos que entran en la condición: los vértices en una cerrada (más el de
 * cierre si hay fila de cierre) y las deflexiones en una abierta con control.
 */
export function angularTolerance(order: PrecisionOrder, n: number): number {
  return ANGULAR_TOLERANCE_K[order] * Math.sqrt(n);
}

/** Precisión relativa mínima exigida para el orden dado (el X de 1:X). */
export function minRelativePrecision(order: PrecisionOrder): number {
  return MIN_RELATIVE_PRECISION[order];
}

/**
 * Coeficiente K de la tolerancia de nivelación K·√D, en milímetros
 * (PRD § 5.4). Coinciden con la tabla del marco teórico § 8; su «Segundo
 * Orden Clase II» es nuestro `segundo_orden`. Las clases del marco teórico
 * están corridas una respecto a la FGCS (1984), donde 6 mm·√D es segundo orden
 * clase I (auditoría del cálculo, § 6). Los niveles «Clase I» (K=4) y
 * «Expedita» (K=50) del marco teórico no están modelados en el tipo
 * `PrecisionOrder` (decisión #4 del PRD de la Fase 4). Desde la Fase 8 el
 * orden lo declara cada proceso —`leveling_processes.precision_order` y
 * `settlement_visits.precision_order`—, no el proyecto.
 */
export const LEVELING_TOLERANCE_K: Record<PrecisionOrder, number> = {
  primer_orden: 3,
  segundo_orden: 6,
  tercer_orden: 12,
  ordinario: 24,
};

/**
 * Equilibrado de visuales: diferencia máxima admisible entre la distancia de
 * la V+ y la de la V− dentro de una misma armada, en metros.
 *
 * Equilibrar las visuales cancela el error de colimación del nivel: si la
 * visual sale inclinada, el mismo error entra con signo opuesto en las dos
 * lecturas y se anula al restarlas. Cuanto más exigente el orden, menos
 * desequilibrio se admite.
 *
 * Esta validación quedó pendiente desde la Fase 4, que registró como deuda que
 * una sola `distance_m` por fila no permitía comprobarla: el equilibrado
 * compara d_V+ con d_V− DENTRO de una armada. La Fase 9 captura las
 * dos distancias por separado y la deuda se paga aquí.
 *
 * Los límites son los de la FGCS (1984), § 3.5, p. 3-7, y NGS 3, tabla 3-1
 * (Fase 32, D-3): 2 m en primer orden clase I, 5 m en segundo orden clase I y
 * 10 m en tercer orden, que son los de la K de cada orden de la app. El marco
 * teórico (§ 7) da los mismos. Ordinario no está en la norma y toma el del
 * tercer orden, el más laxo. Hasta la Fase 32 eran 2/3/4/6 m, sin fuente.
 */
export const SIGHT_BALANCE_LIMIT_M: Record<PrecisionOrder, number> = {
  primer_orden: 2,
  segundo_orden: 5,
  tercer_orden: 10,
  ordinario: 10,
};

/**
 * Equilibrado acumulado de una sección —de BM a BM—: diferencia máxima entre
 * la suma de las distancias de las V+ y la de las V− de sus armadas, en metros
 * (Fase 32, D-3).
 *
 * El error de colimación de una sección es −C·ΣΔs (NGS 3, § 5.5.2): depende
 * del desequilibrio acumulado, no del de cada armada, y armadas dentro de su
 * límite pueden sumar uno grande. Una ida y vuelta que se desequilibran igual
 * se sesgan igual, y la discrepancia entre las dos no lo ve.
 *
 * FGCS (1984), § 3.5, p. 3-7, y NGS 3, tabla 3-1: 4 m en primer orden clase I
 * y 10 m en los demás. Ordinario, como el tercer orden.
 */
export const SECTION_BALANCE_LIMIT_M: Record<PrecisionOrder, number> = {
  primer_orden: 4,
  segundo_orden: 10,
  tercer_orden: 10,
  ordinario: 10,
};

/**
 * Tolerancia de la comprobación del hilo medio, en metros.
 *
 * El hilo medio debe ser el promedio de los otros dos: `m = (HS + HI)/2`. La
 * cifra es de lectura de mira, no de cálculo: 2 mm admite el error de
 * apreciación al leer tres hilos sobre una mira centimetrada sin dejar pasar
 * una transcripción equivocada.
 */
export const MIDDLE_WIRE_TOLERANCE_M = 0.002;

/**
 * Antigüedad de la calibración a partir de la cual el formulario de equipo
 * avisa (Fase 25). Doce meses es la revisión periódica habitual de un
 * instrumento topográfico; la ISO 17123 no fija un plazo. Avisa, no bloquea:
 * la fecha la juzga el topógrafo.
 */
export const CALIBRATION_MAX_MONTHS = 12;

/**
 * Tolerancia de cierre de nivelación en milímetros: K·√D_km.
 *
 * IMPORTANTE: `distanceKm` es la longitud del recorrido en UN SOLO SENTIDO,
 * nunca ida+vuelta (decisión #9 del PRD de fase). Las fuentes discrepan en
 * este punto — FGCS distingue D (sección, un sentido) de F (perímetro de
 * circuito) — y usar el recorrido total inflaría la tolerancia en √2 (≈41 %).
 */
export function levelingTolerance(
  order: PrecisionOrder,
  distanceKm: number,
): number {
  return LEVELING_TOLERANCE_K[order] * Math.sqrt(distanceKm);
}

// ============================================================================
// Tolerancias de asentamientos (Fase 5).
// ============================================================================

import type { StructureType } from "@/types/site";
import type { Thresholds } from "@/types/settlement";

/**
 * Días de un mes, para convertir un intervalo entre visitas a meses.
 *
 * 365.25/12 — el promedio del año gregoriano. Se fija como constante porque el
 * marco teórico nunca define el mes y por eso calcula mal la velocidad: sus
 * tablas copian el asentamiento parcial en la columna de velocidad siempre que
 * el intervalo sea «un mes», ignorando que los meses tienen 28, 30 o 31 días
 * (verificado: 3 de los 7 intervalos del histórico de P-09 no coinciden con
 * ningún cálculo válido). Ver docs/prds/04-asentamientos.md, hallazgo 2 y
 * decisión #3.
 */
export const DAYS_PER_MONTH = 365.25 / 12;

/**
 * Longitud de referencia de un circuito de monitoreo alrededor de una
 * estructura, en km, para el margen del aviso de lectura fuera de tendencia
 * (Fase 12).
 *
 * Es una DECISIÓN, no una norma: 250 m es razonable para un edificio y puede
 * quedarse corto para una presa. Vive como constante con nombre para que se
 * vea y se pueda discutir sin tocar la regla. Ver
 * docs/prds/11-lectura-desfasada.md, «El margen».
 */
export const TREND_DEVIATION_REFERENCE_KM = 0.25;

/**
 * Cuánto puede superar una lectura el ritmo anterior de su punto antes de
 * avisar como «excesiva»: el doble. Holgado a propósito — una aceleración real
 * menor es asunto del indicador de aceleración y de los umbrales de
 * velocidad, no de este aviso.
 */
export const TREND_DEVIATION_RATE_FACTOR = 2;

/**
 * Margen, en mm, que absorbe el ruido de medición en el aviso de lectura fuera
 * de tendencia: la tolerancia de cierre `K·√D` de un circuito de referencia,
 * con la K de nivelación del orden que declaró la visita. Da 1.5 / 3 / 6 / 12
 * mm de primer orden a ordinario.
 */
export function trendDeviationMargin(order: PrecisionOrder): number {
  return levelingTolerance(order, TREND_DEVIATION_REFERENCE_KM);
}

/**
 * Umbrales de alerta por tipo de estructura (marco teórico § 4.1).
 *
 * El § 3.2 del PRD principal daba un único default (10/25/50) que son los
 * umbrales de PRESA, de modo que un edificio se clasificaba con criterio de
 * presa: habría marcado alarma a los 50 mm cuando su propio marco de referencia
 * sitúa ahí el umbral de alerta. El preset se aplica al elegir el tipo de
 * estructura y siempre queda editable (decisión #2).
 */
export const SETTLEMENT_THRESHOLD_PRESETS: Record<StructureType, Thresholds> = {
  edificio: {
    velocityCaution: 2,
    velocityAlert: 5,
    velocityAlarm: 10,
    accumulatedCaution: 25,
    accumulatedAlert: 50,
    accumulatedAlarm: 75,
  },
  presa: {
    velocityCaution: 2,
    velocityAlert: 5,
    velocityAlarm: 10,
    accumulatedCaution: 10,
    accumulatedAlert: 25,
    accumulatedAlarm: 50,
  },
  terraplen: {
    velocityCaution: 2,
    velocityAlert: 5,
    velocityAlarm: 10,
    accumulatedCaution: 25,
    accumulatedAlert: 50,
    accumulatedAlarm: 75,
  },
  otro: {
    velocityCaution: 2,
    velocityAlert: 5,
    velocityAlarm: 10,
    accumulatedCaution: 25,
    accumulatedAlert: 50,
    accumulatedAlarm: 75,
  },
};

/** Preset de umbrales del tipo de estructura dado. */
export function thresholdsFor(structureType: StructureType): Thresholds {
  return SETTLEMENT_THRESHOLD_PRESETS[structureType];
}

/**
 * Las seis columnas de umbral de un lugar, tal como llegan de la base.
 *
 * Se declara estructuralmente y no como `Site` para que sirva igual a un
 * `Site` completo y a un `select` parcial que solo pidió los umbrales, que es
 * como lo consultan las páginas del módulo.
 */
export interface SiteThresholdColumns {
  velocity_caution: number;
  velocity_alert: number;
  velocity_alarm: number;
  accumulated_caution: number;
  accumulated_alert: number;
  accumulated_alarm: number;
}

/**
 * Umbrales de un lugar, listos para `classifyAlert`.
 *
 * El `Number()` no es decorativo: Postgres entrega las columnas `DECIMAL` como
 * **cadena** a través de PostgREST, y comparar número contra cadena en JS falla
 * en silencio —`25 > "9"` es `false`—, de modo que un acumulado superaría o no
 * su umbral según cómo hubiera viajado el dato. Convertir aquí, en el único
 * punto por el que pasan todos los consumidores, es lo que evita esa clase de
 * fallo plausible.
 */
export function thresholdsOf(site: SiteThresholdColumns): Thresholds {
  return {
    velocityCaution: Number(site.velocity_caution),
    velocityAlert: Number(site.velocity_alert),
    velocityAlarm: Number(site.velocity_alarm),
    accumulatedCaution: Number(site.accumulated_caution),
    accumulatedAlert: Number(site.accumulated_alert),
    accumulatedAlarm: Number(site.accumulated_alarm),
  };
}
