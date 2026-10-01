// Las cotas adoptadas de una nivelación guardada (Fase 28), para el informe y
// el Excel: se derivan de las filas guardadas, sin recalcular.

import { adoptedElevations, knownBmsOf } from "@/lib/calculations/leveling";
import type { AdoptedElevation, LevelingType } from "@/types/leveling";

interface StoredLevelingProcess {
  type: string;
  meets_tolerance: boolean | null;
  start_bm_elevation: number | string | null;
  end_bm_elevation: number | string | null;
}

interface StoredLevelingReading {
  run_type: string;
  reading_order: number;
  point_code: string;
  elevation_corrected: number | string | null;
}

/**
 * Una cota por punto a partir de las filas guardadas, o `null` si el trabajo
 * no se compensó: el veredicto guardado no es «cumple» (no cumple, o es una
 * abierta sin vuelta, que no tiene contra qué cerrar).
 */
export function storedAdoptedElevations(
  process: StoredLevelingProcess,
  readings: readonly StoredLevelingReading[],
): AdoptedElevation[] | null {
  if (process.meets_tolerance !== true || process.start_bm_elevation == null) return null;
  const run = (runType: string) =>
    readings
      .filter((r) => r.run_type === runType)
      .sort((a, b) => a.reading_order - b.reading_order);
  const forward = run("forward");
  const known = knownBmsOf(
    forward.map((r) => ({ pointCode: r.point_code })),
    {
      type: process.type as LevelingType,
      startElevation: Number(process.start_bm_elevation),
      endElevation: process.end_bm_elevation == null ? null : Number(process.end_bm_elevation),
    },
  );
  const rows = [...forward, ...run("return")]
    .filter((r) => r.elevation_corrected != null)
    .map((r) => ({ pointCode: r.point_code, elevation: Number(r.elevation_corrected) }));
  return adoptedElevations(rows, known);
}

/** La nota de una fila de la tabla: de dónde sale su cota. */
export function adoptedNote(a: AdoptedElevation): string {
  if (a.known) return "BM de cota conocida";
  return a.readings > 1 ? `Promedio de ${a.readings} cotas compensadas` : "";
}
