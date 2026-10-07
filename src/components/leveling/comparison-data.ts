// Los datos del paso de compensación (Fase 36): la tabla de cotas medidas,
// correcciones y cota ajustada, y el gráfico único —la cota ajustada a escala y
// lo medido separado de ella con la diferencia ×1000—. Funciones puras.
//
// La vuelta se dibuja sobre la ida: cada punto homólogo, en la distancia de la
// ida; uno que solo está en la vuelta, en su distancia contada desde el final
// y escalada al largo de la ida.

import { accumulateDistances, adoptedElevationsOf, samePointCode } from "@/lib/calculations/leveling";
import type { AdoptedElevation, ComputedReading, LevelingInput, LevelingResult } from "@/types/leveling";

type Known = Pick<LevelingInput, "type" | "startElevation" | "endElevation">;

export interface SeriesPoint {
  code: string;
  x: number;
  /** La cota ajustada del punto. */
  adjusted: number;
  /** Medida − ajustada, en mm. */
  diffMm: number;
  intermediate: boolean;
}

export interface AdjustedPoint {
  code: string;
  x: number;
  elevation: number;
  /** BM de cota conocida: no se compensa. */
  known: boolean;
  intermediate: boolean;
}

export interface ComparisonData {
  /** La cota ajustada a lo largo de la ida. */
  adjusted: AdjustedPoint[];
  forward: SeriesPoint[];
  back: SeriesPoint[] | null;
  /** Largo de la ida, en metros. */
  lengthM: number;
  /** Las cifras que se rotulan: los extremos de cada serie y su final. */
  labels: { series: "forward" | "back"; index: number }[];
}

/**
 * Empareja cada fila de la ida con su homóloga de la vuelta, por código. La
 * vuelta recorre el camino al revés, así que se busca desde su final: en una
 * cerrada con vuelta, el BM de salida de la ida casa con el de llegada de la
 * vuelta.
 */
function pairRuns(forward: readonly ComputedReading[], back: readonly ComputedReading[]): (number | null)[] {
  const used = new Set<number>();
  return forward.map((f) => {
    for (let j = back.length - 1; j >= 0; j--) {
      if (!used.has(j) && samePointCode(back[j]!.pointCode, f.pointCode)) {
        used.add(j);
        return j;
      }
    }
    return null;
  });
}

function adoptedLookup(adopted: readonly AdoptedElevation[] | null) {
  return (code: string) => adopted?.find((a) => samePointCode(a.pointCode, code)) ?? null;
}

/** Los índices que se rotulan: el mayor y el menor de la serie y el último, sin ceros. */
function extremes(series: readonly SeriesPoint[]): number[] {
  if (series.length === 0) return [];
  let max = 0;
  let min = 0;
  series.forEach((p, i) => {
    if (p.diffMm > series[max]!.diffMm) max = i;
    if (p.diffMm < series[min]!.diffMm) min = i;
  });
  return [...new Set([max, min, series.length - 1])].filter((i) => Math.abs(series[i]!.diffMm) >= 0.05);
}

/** Las series del gráfico, o `null` si el trabajo no se compensó. */
export function comparisonData(result: LevelingResult, input: Known): ComparisonData | null {
  const adopted = adoptedElevationsOf(result, input);
  if (!adopted) return null;
  const of = adoptedLookup(adopted);
  const forward = result.forward.readings;
  const back = result.return?.readings ?? null;
  const accF = accumulateDistances(forward);
  const lengthM = accF.at(-1) ?? 0;

  const point = (r: ComputedReading, x: number): SeriesPoint[] => {
    const a = of(r.pointCode);
    if (!a || !Number.isFinite(r.elevationCalculated)) return [];
    return [
      {
        code: r.pointCode,
        x,
        adjusted: a.elevation,
        diffMm: (r.elevationCalculated - a.elevation) * 1000,
        intermediate: r.pointType === "intermediate",
      },
    ];
  };

  const forwardSeries = forward.flatMap((r, i) => point(r, accF[i]!));
  let backSeries: SeriesPoint[] | null = null;
  if (back && back.length > 0) {
    const accR = accumulateDistances(back);
    const lengthR = accR.at(-1) ?? 0;
    const pairs = pairRuns(forward, back);
    const xOfBack = new Map<number, number>();
    pairs.forEach((j, i) => j != null && xOfBack.set(j, accF[i]!));
    backSeries = back.flatMap((r, j) =>
      point(r, xOfBack.get(j) ?? (lengthR > 0 ? ((lengthR - accR[j]!) * lengthM) / lengthR : 0)),
    );
  }

  const adjusted = forward.flatMap((r, i) => {
    const a = of(r.pointCode);
    return a
      ? [{ code: r.pointCode, x: accF[i]!, elevation: a.elevation, known: a.known, intermediate: r.pointType === "intermediate" }]
      : [];
  });

  const labels: ComparisonData["labels"] = extremes(forwardSeries).map((index) => ({ series: "forward", index }));
  if (backSeries) {
    for (const index of extremes(backSeries)) {
      const p = backSeries[index]!;
      const repeated = labels.some((l) => {
        const q = forwardSeries[l.index]!;
        return Math.abs(q.x - p.x) < 1e-6 && q.diffMm.toFixed(1) === p.diffMm.toFixed(1);
      });
      if (!repeated) labels.push({ series: "back", index });
    }
  }
  return { adjusted, forward: forwardSeries, back: backSeries, lengthM, labels };
}

export interface CompensationRow {
  code: string;
  /** Distancia acumulada en la ida; `null` en un punto que solo está en la vuelta. */
  distanceM: number | null;
  forward: { elevation: number; correctionMm: number } | null;
  back: { elevation: number; correctionMm: number } | null;
  /** Vuelta − ida, en mm. */
  diffMm: number | null;
  /** La cota ajustada; `null` si el trabajo no se compensó. */
  adjusted: number | null;
  known: boolean;
}

const measured = (r: ComputedReading) => ({ elevation: r.elevationCalculated, correctionMm: r.correctionApplied * 1000 });

/**
 * Las filas de la tabla: cada lectura de la ida, con su homóloga de la vuelta
 * si la hay, y después los puntos que solo están en la vuelta.
 */
export function compensationRows(result: LevelingResult, input: Known): CompensationRow[] {
  const of = adoptedLookup(adoptedElevationsOf(result, input));
  const forward = result.forward.readings;
  const back = result.return?.readings ?? [];
  const accF = accumulateDistances(forward);
  const pairs = pairRuns(forward, back);
  const rows: CompensationRow[] = forward.map((f, i) => {
    const b = pairs[i] != null ? back[pairs[i]!]! : null;
    const a = of(f.pointCode);
    return {
      code: f.pointCode,
      distanceM: accF[i]!,
      forward: measured(f),
      back: b ? measured(b) : null,
      diffMm: b ? (b.elevationCalculated - f.elevationCalculated) * 1000 : null,
      adjusted: a?.elevation ?? null,
      known: a?.known ?? false,
    };
  });
  const paired = new Set(pairs.filter((j): j is number => j != null));
  back.forEach((b, j) => {
    if (paired.has(j)) return;
    const a = of(b.pointCode);
    rows.push({
      code: b.pointCode,
      distanceM: null,
      forward: null,
      back: measured(b),
      diffMm: null,
      adjusted: a?.elevation ?? null,
      known: a?.known ?? false,
    });
  });
  return rows;
}
