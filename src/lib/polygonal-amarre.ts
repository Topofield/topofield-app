// Los puntos del amarre de una poligonal en el catálogo del proyecto (Fase 35,
// decisión 9). Regla pura: la aplica `ensureCatalogPointAction`.
//
// El amarre vive en `reference_points`, como desde la Fase 7: así otras
// poligonales y la georreferenciación lo reutilizan. Pero un punto del catálogo
// ya puede estar en uso, y el proceso guarda el azimut con el que se calculó:
// reescribir sus coordenadas desde el popup de una poligonal cambiaría lo que
// otra mide sin avisar. Por eso un código existente con otras coordenadas es un
// conflicto, no una actualización.

export interface CatalogPoint {
  id: string;
  code: string;
  north: number | null;
  east: number | null;
}

export type CatalogResolution =
  | { kind: "reuse"; id: string }
  /** El código existe sin coordenadas: se le completan. */
  | { kind: "complete"; id: string }
  | { kind: "create" }
  | { kind: "conflict"; message: string };

/** Medio milímetro: lo que separa dos coordenadas guardadas con 3 o 4 decimales. */
const SAME_COORDINATE_M = 0.0005;

export function resolveCatalogPoint(
  catalog: readonly CatalogPoint[],
  point: { code: string; north: number; east: number },
): CatalogResolution {
  const code = point.code.trim();
  const existing = catalog.find((p) => p.code.trim() === code);
  if (!existing) return { kind: "create" };
  if (existing.north === null || existing.east === null) {
    return { kind: "complete", id: existing.id };
  }
  const same =
    Math.abs(Number(existing.north) - point.north) <= SAME_COORDINATE_M &&
    Math.abs(Number(existing.east) - point.east) <= SAME_COORDINATE_M;
  return same
    ? { kind: "reuse", id: existing.id }
    : {
        kind: "conflict",
        message: `${code} ya está en el catálogo con otras coordenadas: tómalo del catálogo o usa otro nombre.`,
      };
}
