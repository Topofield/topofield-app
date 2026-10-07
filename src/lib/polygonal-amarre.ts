// Los puntos del amarre de una poligonal en el catálogo del proyecto (Fase 35,
// decisión 9). Reglas puras: las aplican el popup del amarre y
// `savePolygonalProcessAction`.
//
// El amarre vive en `reference_points`, como desde la Fase 7: así otras
// poligonales y la georreferenciación lo reutilizan. Al principio, un código
// existente con otras coordenadas era un conflicto, para no cambiar lo que mide
// otra poligonal; pero así el amarre no se podía corregir sin rehacer la
// poligonal. Desde las correcciones de la Fase 35 el popup mueve el punto, y
// antes de guardar avisa cuáles se mueven y qué otras poligonales los usan. Los
// puntos se escriben con el proceso, en la misma transacción
// (`planCatalogWrites` y `save_polygonal_process`).

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

/** Un punto con nombre y coordenadas, como lo teclea el popup. */
export interface NamedPoint {
  code: string;
  north: number;
  east: number;
}

/** Un punto de `reference_points` como lo lee la base: las coordenadas llegan como texto o nulas. */
export function catalogPointOf(p: {
  id: string;
  code: string;
  north: number | string | null;
  east: number | string | null;
}): CatalogPoint {
  return {
    id: p.id,
    code: p.code,
    north: p.north == null ? null : Number(p.north),
    east: p.east == null ? null : Number(p.east),
  };
}

/** Medio milímetro: lo que separa dos coordenadas guardadas con 3 o 4 decimales. */
const SAME_COORDINATE_M = 0.0005;

const sameCoordinates = (a: { north: number; east: number }, b: { north: number; east: number }) =>
  Math.abs(a.north - b.north) <= SAME_COORDINATE_M && Math.abs(a.east - b.east) <= SAME_COORDINATE_M;

export function resolveCatalogPoint(catalog: readonly CatalogPoint[], point: NamedPoint): CatalogResolution {
  const code = point.code.trim();
  const existing = catalog.find((p) => p.code.trim() === code);
  if (!existing) return { kind: "create" };
  if (existing.north === null || existing.east === null) {
    return { kind: "complete", id: existing.id };
  }
  return sameCoordinates({ north: existing.north, east: existing.east }, point)
    ? { kind: "reuse", id: existing.id }
    : { kind: "move", id: existing.id };
}

/**
 * El primer nombre que se repite con otras coordenadas entre los puntos del
 * amarre: como un punto existente se corrige, el segundo pisaría al primero.
 */
export function repeatedPointName(points: readonly NamedPoint[]): string | null {
  for (const [i, p] of points.entries()) {
    const code = p.code.trim();
    if (points.slice(i + 1).some((q) => q.code.trim() === code && !sameCoordinates(p, q))) return code;
  }
  return null;
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
  points: readonly NamedPoint[],
  others: readonly CatalogUser[],
): CatalogMove[] {
  return points.flatMap((point) => {
    const code = point.code.trim();
    const existing = catalog.find((p) => p.code.trim() === code);
    if (!existing || resolveCatalogPoint([existing], point).kind !== "move") return [];
    const usedBy = others
      .filter(
        (o) => o.referencePointId === existing.id || o.startCode?.trim() === code || o.endCode?.trim() === code,
      )
      .map((o) => o.name);
    return [{ code, north: Number(existing.north), east: Number(existing.east), usedBy }];
  });
}

/** Los puntos del amarre que el guardado lleva al catálogo; `null` si uno no va. */
export interface AmarrePoints {
  start: NamedPoint | null;
  reference: NamedPoint | null;
  end: NamedPoint | null;
}

/** Una fila del catálogo que escribe `save_polygonal_process`. */
export type CatalogWrite =
  | { kind: "insert"; id: string; code: string; north: number; east: number }
  | { kind: "update"; id: string; north: number; east: number };

/** El papel de un punto en el amarre. */
export type AmarreRole = keyof AmarrePoints;

/**
 * Qué escribe en el catálogo el guardado del amarre, y el id de la referencia
 * —el de un punto que ya estaba o el que da `newId` para uno nuevo: en la
 * referencia, el que propuso el cliente, que así lo tiene en su borrador desde
 * el primer momento—. Los puntos se resuelven en orden contra el catálogo que
 * van dejando: uno nuevo que se repite en el mismo sitio se inserta una vez.
 */
export function planCatalogWrites(
  catalog: readonly CatalogPoint[],
  points: AmarrePoints,
  newId: (role: AmarreRole) => string,
): { writes: CatalogWrite[]; referenceId: string | null } {
  const working = [...catalog];
  const writes: CatalogWrite[] = [];
  const idOf = (point: NamedPoint, role: AmarreRole): string => {
    const p = { code: point.code.trim(), north: point.north, east: point.east };
    const resolution = resolveCatalogPoint(working, p);
    switch (resolution.kind) {
      case "reuse":
        return resolution.id;
      case "complete":
      case "move": {
        writes.push({ kind: "update", id: resolution.id, north: p.north, east: p.east });
        const i = working.findIndex((c) => c.id === resolution.id);
        working[i] = { ...working[i]!, north: p.north, east: p.east };
        return resolution.id;
      }
      case "create": {
        const id = newId(role);
        writes.push({ kind: "insert", id, ...p });
        working.push({ id, ...p });
        return id;
      }
    }
  };
  if (points.start) idOf(points.start, "start");
  const referenceId = points.reference ? idOf(points.reference, "reference") : null;
  if (points.end) idOf(points.end, "end");
  return { writes, referenceId };
}

/** El mensaje de dos puntos del amarre con el mismo nombre y otras coordenadas. */
export const repeatedPointMessage = (code: string) =>
  `${code} está dos veces con coordenadas distintas: cada punto necesita su propio nombre.`;

/**
 * Por qué no valen los puntos que la carga lleva al catálogo, o `null`. La
 * acción es alcanzable con una carga hecha a mano: la partida y la llegada
 * tienen que ser las del amarre, y la referencia, la que nombra.
 */
export function catalogPointsProblem(
  amarre: {
    startPointCode: string;
    startNorth: number;
    startEast: number;
    referencePointCode: string | null;
    endPointCode: string | null;
    endNorth: number | null;
    endEast: number | null;
  },
  points: AmarrePoints,
): string | null {
  const is = (p: NamedPoint, code: string | null, north: number | null, east: number | null) =>
    p.code.trim() === code?.trim() && p.north === north && p.east === east;
  const matches =
    (!points.start || is(points.start, amarre.startPointCode, amarre.startNorth, amarre.startEast)) &&
    (!points.end || is(points.end, amarre.endPointCode, amarre.endNorth, amarre.endEast)) &&
    (!points.reference || points.reference.code.trim() === amarre.referencePointCode?.trim());
  if (!matches) return "Los puntos del amarre no coinciden con los del proceso.";
  const repeated = repeatedPointName(
    [points.start, points.reference, points.end].filter((p): p is NamedPoint => p !== null),
  );
  return repeated ? repeatedPointMessage(repeated) : null;
}
