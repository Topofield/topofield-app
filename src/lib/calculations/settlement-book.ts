// Libreta de nivelación de una visita de asentamientos (Fase 18).
// Funciones puras de TypeScript: sin React, sin hooks, sin Supabase.
//
// La visita NO trae motor de nivelación propio: su libreta es un circuito
// cerrado sobre el BM de amarre y la calcula `computeLeveling` tal cual. Lo que
// añade este módulo es el paso de la libreta a las cotas de los puntos de
// control —que dejan de teclearse— y la plantilla para capturar en campo. Ver
// docs/prds/17-libreta-panel-asentamientos.md.

import { computeLeveling, samePointCode } from "./leveling";
import { isPointActiveOn } from "./settlement";
import type {
  LevelingResult,
  PointType,
  ReadingInput as BookRowInput,
} from "@/types/leveling";
import type { PrecisionOrder } from "@/types/project";
import type {
  BookIssue,
  BookRowPayload,
  DerivedElevation,
  PointInput,
  SettlementBookReading,
} from "@/types/settlement";

/**
 * Una fila de libreta, tal como llega de la base, lista para el editor y el
 * motor. El `Number()` no es decorativo: PostgREST entrega las columnas
 * `DECIMAL` como cadena (ver `pointInputOf`).
 */
export function bookRowOf(
  row: Pick<
    SettlementBookReading,
    | "point_code"
    | "point_type"
    | "backsight"
    | "foresight"
    | "back_upper_m"
    | "back_lower_m"
    | "fore_upper_m"
    | "fore_lower_m"
    | "back_distance_m"
    | "fore_distance_m"
  >,
): BookRowPayload {
  const n = (v: number | string | null) => (v === null ? null : Number(v));
  return {
    pointCode: row.point_code,
    pointType: row.point_type,
    backsight: n(row.backsight),
    foresight: n(row.foresight),
    backUpperM: n(row.back_upper_m),
    backLowerM: n(row.back_lower_m),
    foreUpperM: n(row.fore_upper_m),
    foreLowerM: n(row.fore_lower_m),
    backDistanceM: n(row.back_distance_m),
    foreDistanceM: n(row.fore_distance_m),
  };
}

/** La fila como entra al motor: el acumulado lo deriva él, no el cliente. */
export function bookRowInputOf(row: BookRowPayload): BookRowInput {
  return { ...row, distanceAccumulatedKm: null };
}

/**
 * Calcula la libreta de una visita: circuito cerrado que arranca y termina en
 * el BM de amarre, sin vuelta (decisiones 7 y 9 del PRD de la Fase 18).
 *
 * Una libreta A MEDIAS —capturando en vivo, sin la V− de cierre todavía— se
 * calcula como recorrido abierto: sin cierre ni compensación. Como cerrada,
 * el motor compararía la cota del último punto de la cadena con la del amarre
 * y daría un «error de cierre» de metros, que se guardaría y se pintaría como
 * fuera de tolerancia.
 */
export function computeVisitBook(
  rows: BookRowInput[],
  referenceElevation: number,
  order: PrecisionOrder,
): LevelingResult {
  const closes = rows.length >= 2 && rows.at(-1)!.foresight != null;
  return computeLeveling({
    type: closes ? "closed" : "open",
    startElevation: referenceElevation,
    endElevation: null,
    order,
    forward: rows,
    return: null,
  });
}

/**
 * Redondeo a la resolución de `settlement_readings.elevation` (4 decimales).
 * Las cotas derivadas se comparan con las persistidas para decidir qué
 * reescribir: sin redondear aquí, cada guardado vería una diferencia de coma
 * flotante y reescribiría lecturas que no cambiaron.
 */
function round4(value: number): number {
  const r = Math.round(value * 1e4) / 1e4;
  return Object.is(r, -0) ? 0 : r;
}

/** Orden natural de códigos: PC-2 antes que PC-10. */
function byCode(a: PointInput, b: PointInput): number {
  return a.code.localeCompare(b.code, "es", { numeric: true });
}

/**
 * Deriva la cota de cada punto de control de la libreta ya calculada.
 *
 * - Una fila con V− cuyo código es el de un punto de control da su cota. Vale
 *   para cualquier tipo de fila: un punto de control puede ser punto de cambio.
 * - La cota es la COMPENSADA (`elevationCorrected`). Si la libreta no se
 *   compensó —fuera de tolerancia o sin distancias—, el motor la deja igual a
 *   la calculada, así que no hay caso aparte (decisión 4).
 * - El mismo punto con V− en dos filas es un error y no da cota: no hay
 *   criterio obvio para elegir una.
 * - Un punto no vigente en la fecha de la visita avisa y no da cota: el trigger
 *   de vigencia la rechazaría de todas formas (Fase 11).
 * - Un punto vigente que no aparece avisa. Se puede guardar así; cerrar la
 *   visita sigue exigiendo todas las lecturas.
 * - Un código que no es punto de control (el amarre, un punto de cambio, un
 *   auxiliar) es una radiación normal y no dice nada.
 */
export function deriveControlElevations(
  result: LevelingResult,
  points: PointInput[],
  visitDate: string,
): { readings: DerivedElevation[]; issues: BookIssue[] } {
  const rowsByPoint = new Map<string, number[]>();
  result.forward.readings.forEach((r, index) => {
    if (r.foresight == null) return;
    const match = points.find((p) => samePointCode(p.code, r.pointCode));
    if (!match) return;
    rowsByPoint.set(match.id, [...(rowsByPoint.get(match.id) ?? []), index]);
  });

  const readings: DerivedElevation[] = [];
  const issues: BookIssue[] = [];

  for (const p of [...points].sort(byCode)) {
    const rows = rowsByPoint.get(p.id);
    const active = isPointActiveOn(p, visitDate);
    if (!rows) {
      if (active) {
        issues.push({ kind: "missing", level: "warning", pointId: p.id, code: p.code });
      }
      continue;
    }
    if (rows.length > 1) {
      issues.push({ kind: "duplicate", level: "error", pointId: p.id, code: p.code, rows });
      continue;
    }
    const rowIndex = rows[0]!;
    if (!active) {
      issues.push({ kind: "inactive", level: "warning", pointId: p.id, code: p.code, row: rowIndex });
      continue;
    }
    readings.push({
      pointId: p.id,
      elevation: round4(result.forward.readings[rowIndex]!.elevationCorrected),
      rowIndex,
    });
  }

  // Avisos en el orden en que aparecen en la libreta; los ausentes al final.
  const position = (i: BookIssue) =>
    i.kind === "missing" ? Infinity : i.kind === "duplicate" ? i.rows[0]! : i.row;
  issues.sort((a, b) => position(a) - position(b));
  readings.sort((a, b) => a.rowIndex - b.rowIndex);
  return { readings, issues };
}

export interface TemplateRow {
  pointCode: string;
  pointType: PointType;
}

/**
 * La libreta que el editor propone cuando la visita no tiene ninguna, para que
 * en campo solo haya que llenar lecturas (decisión 16).
 *
 * - Con la libreta de la visita anterior: su secuencia de códigos y tipos, con
 *   la primera y la última fila cambiadas al amarre de esta visita (si ya lo
 *   tiene), sin los puntos de control que ya no están vigentes y con los que se
 *   dieron de alta añadidos antes del cierre.
 * - Sin ella: amarre, los puntos de control vigentes como intermedias —una
 *   sola armada— y amarre. El nivelador inserta los puntos de cambio que
 *   necesite.
 */
export function buildBookTemplate(
  previous: TemplateRow[] | null,
  points: PointInput[],
  visitDate: string,
  amarreCode: string,
): TemplateRow[] {
  const amarre = amarreCode.trim();
  const active = points.filter((p) => isPointActiveOn(p, visitDate)).sort(byCode);

  if (!previous || previous.length < 2) {
    return [
      { pointCode: amarre, pointType: "bm" },
      ...active.map((p) => ({ pointCode: p.code, pointType: "intermediate" as const })),
      { pointCode: amarre, pointType: "bm" },
    ];
  }

  const controlOf = (code: string) => points.find((p) => samePointCode(p.code, code));
  const middle = previous.slice(1, -1).filter((r) => {
    const p = controlOf(r.pointCode);
    return !p || isPointActiveOn(p, visitDate);
  });
  const added = active
    .filter((p) => !middle.some((r) => samePointCode(r.pointCode, p.code)))
    .map((p) => ({ pointCode: p.code, pointType: "intermediate" as const }));

  const first = amarre || previous[0]!.pointCode;
  const last = amarre || previous.at(-1)!.pointCode;
  return [
    { pointCode: first, pointType: "bm" },
    ...middle.map((r) => ({ pointCode: r.pointCode, pointType: r.pointType })),
    ...added,
    { pointCode: last, pointType: "bm" },
  ];
}
