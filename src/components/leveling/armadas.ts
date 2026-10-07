// La captura por armada (Fase 36, hallazgo 7). Una fila de la libreta es un
// punto: su V− cierra la armada anterior y su V+ abre la siguiente. Una armada
// es la V+ de un punto, las vistas intermedias que la siguen y la V− del
// siguiente punto que no es intermedio. Sin «use client»: lo usan el popup y
// las pruebas.
import type { ReadingDraft } from "@/app/(app)/projects/[id]/leveling/[pid]/actions";
import type { PointType } from "@/types/leveling";

export interface Visual {
  reading: number | null;
  distanceM: number | null;
  /** Hilos opcionales: con los dos, la distancia sale de ellos. */
  upperM: number | null;
  lowerM: number | null;
}

export interface Armada {
  back: Visual;
  forePoint: string;
  foreType: PointType;
  fore: Visual;
  intermediates: { pointCode: string; reading: number | null }[];
}

export interface ArmadaSpan {
  opener: number;
  intermediates: number[];
  /** La fila de la V−; `null` en una armada a medias. */
  closer: number | null;
}

const blankVisual: Visual = { reading: null, distanceM: null, upperM: null, lowerM: null };

export function emptyRow(pointCode: string, pointType: PointType): ReadingDraft {
  return {
    pointCode,
    pointType,
    backsight: null,
    foresight: null,
    backUpperM: null,
    backLowerM: null,
    foreUpperM: null,
    foreLowerM: null,
    backDistanceM: null,
    foreDistanceM: null,
  };
}

/** Un recorrido recién empezado: solo su punto de partida. */
export function startRun(pointCode: string, pointType: PointType): ReadingDraft[] {
  return [emptyRow(pointCode, pointType)];
}

export function armadaSpans(rows: readonly ReadingDraft[]): ArmadaSpan[] {
  const spans: ArmadaSpan[] = [];
  let open: ArmadaSpan | null = null;
  rows.forEach((row, i) => {
    if (row.pointType === "intermediate") {
      open?.intermediates.push(i);
      return;
    }
    if (open) {
      open.closer = i;
      spans.push(open);
      open = null;
    }
    if (row.backsight != null) open = { opener: i, intermediates: [], closer: null };
  });
  if (open) spans.push(open);
  return spans;
}

export function armadaAt(rows: readonly ReadingDraft[], k: number): Armada {
  const span = armadaSpans(rows)[k];
  if (!span) throw new Error(`No hay armada ${k + 1}.`);
  const o = rows[span.opener]!;
  const c = span.closer != null ? rows[span.closer]! : null;
  return {
    back: { reading: o.backsight, distanceM: o.backDistanceM, upperM: o.backUpperM, lowerM: o.backLowerM },
    forePoint: c?.pointCode ?? "",
    foreType: c?.pointType ?? "pc",
    fore: c
      ? { reading: c.foresight, distanceM: c.foreDistanceM, upperM: c.foreUpperM, lowerM: c.foreLowerM }
      : blankVisual,
    intermediates: span.intermediates.map((i) => ({ pointCode: rows[i]!.pointCode, reading: rows[i]!.foresight })),
  };
}

/**
 * Escribe la armada `k`: la V+ en la fila que la abre, sus intermedias y la V−
 * en la fila del punto adelante. Con `k` igual al número de armadas, añade una
 * nueva que abre la última fila del recorrido. La fila que cierra conserva su
 * V+, que abre la armada siguiente.
 */
export function writeArmada(rows: readonly ReadingDraft[], k: number, a: Armada): ReadingDraft[] {
  const spans = armadaSpans(rows);
  const withBack = (row: ReadingDraft): ReadingDraft => ({
    ...row,
    backsight: a.back.reading,
    backDistanceM: a.back.distanceM,
    backUpperM: a.back.upperM,
    backLowerM: a.back.lowerM,
  });
  const closer = (base: ReadingDraft | null): ReadingDraft => ({
    ...(base ?? emptyRow(a.forePoint, a.foreType)),
    pointCode: a.forePoint,
    pointType: a.foreType,
    foresight: a.fore.reading,
    foreDistanceM: a.fore.distanceM,
    foreUpperM: a.fore.upperM,
    foreLowerM: a.fore.lowerM,
  });
  const mids = a.intermediates.map((m) => ({ ...emptyRow(m.pointCode, "intermediate"), foresight: m.reading }));

  if (k < spans.length) {
    const span = spans[k]!;
    const end = span.closer ?? span.opener + span.intermediates.length;
    return [
      ...rows.slice(0, span.opener),
      withBack(rows[span.opener]!),
      ...mids,
      closer(span.closer != null ? rows[span.closer]! : null),
      ...rows.slice(end + 1),
    ];
  }
  if (k !== spans.length) throw new Error(`La armada ${k + 1} no sigue a la última.`);
  const last = rows.length - 1;
  if (last < 0) throw new Error("El recorrido no tiene punto de partida.");
  return [...rows.slice(0, last), withBack(rows[last]!), ...mids, closer(null)];
}

/** Quita la última armada: su punto adelante y la V+ del punto que la abría. */
export function removeLastArmada(rows: readonly ReadingDraft[]): ReadingDraft[] {
  const last = armadaSpans(rows).at(-1);
  if (!last) return [...rows];
  const opener = { ...rows[last.opener]!, backsight: null, backDistanceM: null, backUpperM: null, backLowerM: null };
  return [...rows.slice(0, last.opener), opener];
}
