// Los puntos del amarre de una poligonal en el catálogo del proyecto (Fase 35,
// decisión 9). Regla pura: la aplica `ensureCatalogPointAction`.
//
// El amarre vive en `reference_points`, como desde la Fase 7: así otras
// poligonales y la georreferenciación lo reutilizan. Al principio, un código
// existente con otras coordenadas era un conflicto, para no cambiar lo que mide
// otra poligonal; pero así el amarre no se podía corregir sin rehacer la
// poligonal. Desde las correcciones de la Fase 35 el popup mueve el punto, y
// antes de guardar avisa cuáles se mueven y qué otras poligonales los usan.

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
  /** El código existe con otras coordenadas: toma las nuevas. */
  | { kind: "move"; id: string }
  | { kind: "create" };

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
  return same ? { kind: "reuse", id: existing.id } : { kind: "move", id: existing.id };
}

/** Otra poligonal del proyecto, por los puntos de su amarre. */
export interface CatalogUser {
  name: string;
  startCode: string | null;
  endCode: string | null;
  referencePointId: string | null;
}

/** Un punto del catálogo que el amarre mueve: sus coordenadas de antes y quién más lo usa. */
export interface CatalogMove {
  code: string;
  north: number;
  east: number;
  usedBy: string[];
}

/** Los puntos del catálogo que cambian de coordenadas al guardar el amarre. */
export function catalogMoves(
  catalog: readonly CatalogPoint[],
  points: readonly { code: string; north: number; east: number }[],
  others: readonly CatalogUser[],
): CatalogMove[] {
  return points.flatMap((point) => {
    const resolution = resolveCatalogPoint(catalog, point);
    if (resolution.kind !== "move") return [];
    const existing = catalog.find((p) => p.id === resolution.id)!;
    const code = existing.code.trim();
    const usedBy = others
      .filter(
        (o) => o.referencePointId === existing.id || o.startCode?.trim() === code || o.endCode?.trim() === code,
      )
      .map((o) => o.name);
    return [{ code, north: Number(existing.north), east: Number(existing.east), usedBy }];
  });
}
