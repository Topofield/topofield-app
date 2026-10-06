// Paso de las filas de la base a la entrada del cálculo de poligonal.
//
// Sin «use client»: lo usan el informe imprimible, el Excel y la
// georreferenciación (servidor y cliente). Es el mismo camino que la pantalla
// por pasos —`draftOf` e `inputOf`, Fase 35—, así que el informe calcula por
// construcción lo mismo que Datos y Ajuste.

import { computePolygonalDetected } from "@/lib/calculations/polygonal";
import { parseNumber } from "@/lib/utils/parse";
import type { PrecisionOrder } from "@/types/project";
import type {
  LeastSquaresWeights,
  PolygonalInput,
  PolygonalProcess,
  PolygonalStationWithReadings,
} from "@/types/polygonal";
import { draftOf, inputOf } from "./polygonal-save";

/** Pesos del ajuste por mínimos cuadrados como los teclea el usuario (Fase 14). */
export interface LeastSquaresWeightsDraft {
  sigmaAngleSeconds: string;
  sigmaDistanceM: string;
  distanceMeasurements: string;
}

/**
 * Los pesos del borrador, o `null` si falta alguno. Sin validar el signo: eso
 * lo decide el motor (que no ajusta con pesos no positivos) y el guardado.
 */
export function weightsFromDraft(draft: LeastSquaresWeightsDraft): LeastSquaresWeights | null {
  const sigmaAngleSeconds = parseNumber(draft.sigmaAngleSeconds);
  const sigmaDistanceM = parseNumber(draft.sigmaDistanceM);
  const distanceMeasurements = parseNumber(draft.distanceMeasurements);
  return sigmaAngleSeconds != null && sigmaDistanceM != null && distanceMeasurements != null
    ? { sigmaAngleSeconds, sigmaDistanceM, distanceMeasurements }
    : null;
}

/**
 * La entrada del cálculo directamente desde las filas de un proceso, con el
 * orden y el tipo de ángulo detectados (Fase 35), no los guardados: una
 * poligonal anterior a la fase guarda los que eligió el usuario.
 */
export function polygonalInputOf(
  process: PolygonalProcess,
  stations: PolygonalStationWithReadings[],
): PolygonalInput {
  const base = inputOf(draftOf(process, stations), null);
  const { order, angleType } = computePolygonalDetected(base);
  return { ...base, order: order ?? "ordinario", angleType };
}

/**
 * El orden alcanzado por lo guardado, detectado como en la pantalla por pasos.
 * Una poligonal anterior a la Fase 35 guarda en `precision_order` el que
 * declaró el usuario hasta su primer guardado, y la cabecera no debe decir otro
 * orden que el paso de Ajuste. `verifiable`: hay un cierre que juzgar.
 */
export function detectedOrderOf(
  process: PolygonalProcess,
  stations: PolygonalStationWithReadings[],
): { order: PrecisionOrder | null; verifiable: boolean } {
  const { result, order } = computePolygonalDetected(inputOf(draftOf(process, stations), null));
  return { order, verifiable: process.type !== "open_uncontrolled" && result.relativePrecision != null };
}
