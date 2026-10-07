// La captura por armada de la visita (Fase 37, decisión 8), sobre el modelo
// por punto de la libreta: una fila es un punto; su V+ abre una armada y su
// V− cierra la anterior. Lo que añade la visita: una armada puede salir de un
// BM del lugar (abre un tramo, `startsSection`) y su V− es opcional.
import { samePointCode } from "@/lib/calculations/leveling";
import type { LibretaRow } from "@/lib/import/leveling";
import type { BookRowPayload } from "@/types/settlement";

export interface VisitVisual {
  reading: number | null;
  distanceM: number | null;
  upperM: number | null;
  lowerM: number | null;
}

export interface VisitArmada {
  /** De dónde sale la V+: un BM del lugar (abre un tramo) o el punto de cambio de la armada anterior. */
  from: "bm" | "pc";
  backCode: string;
  back: VisitVisual;
  /** Las vistas a los puntos (VI), en orden. */
  points: { pointCode: string; reading: number | null }[];
  /** La V−: a un BM del lugar o a un punto de cambio; null sin vista adelante. */
  fore: { pointCode: string; pointType: "bm" | "pc"; visual: VisitVisual } | null;
}

export interface VisitArmadaSpan {
  opener: number;
  intermediates: number[];
  /** La fila de la V−; `null` en una armada sin vista adelante. */
  closer: number | null;
}

const blank = {
  backsight: null, foresight: null, backUpperM: null, backLowerM: null,
  foreUpperM: null, foreLowerM: null, backDistanceM: null, foreDistanceM: null,
} as const;
const starts = (rows: readonly BookRowPayload[], i: number) => i === 0 || Boolean(rows[i]!.startsSection);

export function visitArmadaSpans(rows: readonly BookRowPayload[]): VisitArmadaSpan[] {
  const spans: VisitArmadaSpan[] = [];
  let open: VisitArmadaSpan | null = null;
  const last = rows.length - 1;
  rows.forEach((row, i) => {
    const start = starts(rows, i);
    if (!start && row.pointType === "intermediate") {
      open?.intermediates.push(i);
      return;
    }
    if (open) {
      if (!start) open.closer = i;
      spans.push(open);
      open = null;
    }
    // Una fila abre armada si arranca un tramo, o si la siguiente no lo
    // arranca y es un punto de cambio o tiene V+.
    if (start || (i < last && !starts(rows, i + 1) && (row.pointType === "pc" || row.backsight != null))) {
      open = { opener: i, intermediates: [], closer: null };
    }
  });
  if (open) spans.push(open);
  return spans;
}

const backOf = (row: BookRowPayload): VisitVisual => ({
  reading: row.backsight, distanceM: row.backDistanceM, upperM: row.backUpperM, lowerM: row.backLowerM,
});
const foreOf = (row: BookRowPayload): VisitVisual => ({
  reading: row.foresight, distanceM: row.foreDistanceM, upperM: row.foreUpperM, lowerM: row.foreLowerM,
});
const withBack = (row: BookRowPayload, b: VisitVisual): BookRowPayload => ({
  ...row, backsight: b.reading, backDistanceM: b.distanceM, backUpperM: b.upperM, backLowerM: b.lowerM,
});
const withFore = (row: BookRowPayload, f: VisitVisual): BookRowPayload => ({
  ...row, foresight: f.reading, foreDistanceM: f.distanceM, foreUpperM: f.upperM, foreLowerM: f.lowerM,
});
const pointRow = (p: { pointCode: string; reading: number | null }): BookRowPayload => ({
  pointCode: p.pointCode.trim(), pointType: "intermediate", startsSection: false, ...blank, foresight: p.reading,
});

export function visitArmadaAt(rows: readonly BookRowPayload[], k: number): VisitArmada {
  const span = visitArmadaSpans(rows)[k];
  if (!span) throw new Error(`No hay armada ${k + 1}.`);
  const o = rows[span.opener]!;
  const c = span.closer != null ? rows[span.closer]! : null;
  return {
    from: starts(rows, span.opener) ? "bm" : "pc",
    backCode: o.pointCode,
    back: backOf(o),
    points: span.intermediates.map((i) => ({ pointCode: rows[i]!.pointCode, reading: rows[i]!.foresight })),
    fore: c ? { pointCode: c.pointCode, pointType: c.pointType === "bm" ? "bm" : "pc", visual: foreOf(c) } : null,
  };
}

/** Las filas de una armada a partir de su apertura: la V+, las vistas y la V−. */
function armadaRows(opener: BookRowPayload, a: VisitArmada, closer: BookRowPayload | null): BookRowPayload[] {
  const head = withBack({ ...opener, pointCode: a.backCode.trim() }, a.back);
  const fore = a.fore
    ? [withFore({ ...(closer ?? { ...blank, startsSection: false }), pointCode: a.fore.pointCode.trim(), pointType: a.fore.pointType } as BookRowPayload, a.fore.visual)]
    : [];
  return [head, ...a.points.map(pointRow), ...fore];
}

export function writeVisitArmada(rows: readonly BookRowPayload[], k: number, a: VisitArmada): { rows: BookRowPayload[] } | { error: string } {
  const spans = visitArmadaSpans(rows);
  const span = spans[k];
  if (!span) return { error: `No hay armada ${k + 1}.` };
  const next = spans[k + 1];
  const closerOpensNext = span.closer != null && next?.opener === span.closer;
  if (!a.fore && closerOpensNext) {
    return { error: `La armada ${k + 2} sale de ${rows[span.closer!]!.pointCode.trim()}: quítala antes de quitar esta vista adelante.` };
  }
  const end = span.closer ?? span.intermediates.at(-1) ?? span.opener;
  const closer = span.closer != null ? rows[span.closer]! : null;
  const replaced = armadaRows(rows[span.opener]!, a, closer);
  return { rows: [...rows.slice(0, span.opener), ...replaced, ...rows.slice(end + 1)] };
}

export function pendingChangePoint(rows: readonly BookRowPayload[], benchmarks: readonly { code: string }[]): string | null {
  const last = rows.at(-1);
  if (!last || rows.length < 2 || last.pointType === "intermediate" || starts(rows, rows.length - 1)) return null;
  if (last.foresight == null) return null;
  return benchmarks.some((b) => samePointCode(b.code, last.pointCode)) ? null : last.pointCode.trim();
}

export function appendVisitArmada(rows: readonly BookRowPayload[], a: VisitArmada): { rows: BookRowPayload[] } | { error: string } {
  if (a.from === "pc") {
    const last = rows.at(-1);
    if (!last || last.pointType === "intermediate" || !samePointCode(last.pointCode, a.backCode)) {
      return { error: "No hay un punto de cambio desde el que salir: la armada anterior no terminó en uno." };
    }
    return { rows: [...rows.slice(0, -1), ...armadaRows(last, a, null)] };
  }
  const opener: BookRowPayload = { pointCode: a.backCode, pointType: "bm", startsSection: true, ...blank };
  return { rows: [...rows, ...armadaRows(opener, a, null)] };
}

export function finishVisitArmada(rows: readonly BookRowPayload[], k: number): BookRowPayload[] {
  const span = visitArmadaSpans(rows)[k];
  if (!span) return [...rows];
  const drop = new Set(span.intermediates.filter((i) => rows[i]!.foresight == null));
  return rows.filter((_, i) => !drop.has(i));
}

export function dropBookRow(rows: readonly BookRowPayload[], index: number): { rows: BookRowPayload[] } | { error: string } {
  if (rows[index]?.pointType !== "intermediate") {
    return { error: "Esa lectura es parte de la cadena de armadas: no se puede quitar aquí." };
  }
  return { rows: rows.filter((_, i) => i !== index) };
}

/**
 * Quita la última armada. La que sale de un BM del lugar se va entera; la que
 * sale de un punto de cambio deja el punto, sin su V+, como la V− de la
 * anterior.
 */
export function removeLastVisitArmada(rows: readonly BookRowPayload[]): BookRowPayload[] {
  const span = visitArmadaSpans(rows).at(-1);
  if (!span) return [...rows];
  if (starts(rows, span.opener)) return rows.slice(0, span.opener);
  return [...rows.slice(0, span.opener), withBack(rows[span.opener]!, { reading: null, distanceM: null, upperM: null, lowerM: null })];
}

/**
 * La libreta de un `.L` o un CSV importado (Fase 37, decisión 5): un tramo
 * desde el BM de su primera fila. Se guardan las lecturas; las cotas las
 * calcula la visita.
 */
export function bookFromLibreta(rows: readonly LibretaRow[]): BookRowPayload[] {
  return rows.map((row, i) => ({
    ...blank,
    pointCode: row.pointCode.trim(),
    pointType: i === 0 ? "bm" : row.pointType,
    startsSection: i === 0,
    backsight: row.backsight,
    foresight: row.foresight,
    backDistanceM: row.backDistanceM,
    foreDistanceM: row.foreDistanceM,
  }));
}
