// Las filas de la libreta como las muestra el paso 1 (Fase 36, libreta B): la
// tabla de la hoja, la lista por armada del teléfono y la comprobación
// aritmética. Sin «use client»: lo usan la pantalla y las pruebas.
import type { ReadingDraft } from "@/app/(app)/projects/[id]/leveling/[pid]/actions";
import type { ComputedReading, LevelingType, RunResult, RunType } from "@/types/leveling";
import { armadaSpans } from "./armadas";

export type SheetBadge = "BM" | "intermedia" | "fin de la ida";

export interface SheetRow {
  pointCode: string;
  badge: SheetBadge | null;
  /** V+ y su distancia: la fila abre una armada. */
  backsight: number | null;
  backDistanceM: number | null;
  instrumentHeight: number | null;
  /** V− de un punto de cambio o de un BM, y su distancia. */
  foresight: number | null;
  foreDistanceM: number | null;
  /** VI: la lectura de una vista intermedia. */
  intermediate: number | null;
  /** Cota sin compensar; `null` si aún no se calcula. */
  elevation: number | null;
  /** La armada que abre el lápiz: la que la fila cierra, o la primera. */
  armada: number | null;
}

const finite = (v: number | null | undefined): number | null => (v != null && Number.isFinite(v) ? v : null);

/** La armada a la que pertenece cada fila: la que cierra o en la que es intermedia. */
function armadaOfRows(rows: readonly ReadingDraft[]): (number | null)[] {
  const spans = armadaSpans(rows);
  const of: (number | null)[] = rows.map(() => null);
  spans.forEach((s, k) => {
    if (s.closer != null) of[s.closer] = k;
    for (const i of s.intermediates) of[i] = k;
  });
  if (spans[0] && of[spans[0].opener] == null) of[spans[0].opener] = 0;
  return of;
}

/**
 * La tabla de la hoja: Punto, V+ y su distancia, AI, V− y su distancia, VI y
 * la cota sin compensar. En una abierta, el punto donde termina la ida —y
 * empieza la vuelta— lleva «fin de la ida».
 */
export function sheetRows(
  rows: readonly ReadingDraft[],
  computed: readonly ComputedReading[],
  { run, type }: { run: RunType; type: LevelingType },
): SheetRow[] {
  const armadas = armadaOfRows(rows);
  const last = rows.length - 1;
  return rows.map((row, i) => {
    const c = computed[i];
    const mid = row.pointType === "intermediate";
    const turn =
      type === "open" && row.pointType === "bm" && ((run === "forward" && i === last && i > 0) || (run === "return" && i === 0));
    return {
      pointCode: row.pointCode,
      badge: mid ? "intermedia" : turn ? "fin de la ida" : row.pointType === "bm" ? "BM" : null,
      backsight: mid ? null : row.backsight,
      backDistanceM: mid || row.backsight == null ? null : (c?.backDistanceResolvedM ?? row.backDistanceM),
      instrumentHeight: finite(c?.instrumentHeight),
      foresight: mid ? null : row.foresight,
      foreDistanceM: mid || row.foresight == null ? null : (c?.foreDistanceResolvedM ?? row.foreDistanceM),
      intermediate: mid ? row.foresight : null,
      elevation: c ? finite(c.elevationCalculated) : null,
      armada: armadas[i] ?? null,
    };
  });
}

export interface ArmadaSummary {
  k: number;
  from: string;
  /** El punto adelante; `null` en una armada a medias. */
  to: string | null;
  backsight: number | null;
  backDistanceM: number | null;
  foresight: number | null;
  foreDistanceM: number | null;
  intermediates: { pointCode: string; reading: number | null; elevation: number | null }[];
  /** Cota sin compensar del punto adelante. */
  elevation: number | null;
  /** La armada llega al fin del recorrido. */
  ends: boolean;
}

/** La libreta por armada, para el teléfono: de → a, con sus visuales y la cota adelante. */
export function armadaSummaries(rows: readonly ReadingDraft[], computed: readonly ComputedReading[]): ArmadaSummary[] {
  const last = rows.length - 1;
  return armadaSpans(rows).map((s, k) => {
    const o = rows[s.opener]!;
    const c = s.closer != null ? rows[s.closer]! : null;
    return {
      k,
      from: o.pointCode,
      to: c?.pointCode ?? null,
      backsight: o.backsight,
      backDistanceM: computed[s.opener]?.backDistanceResolvedM ?? o.backDistanceM,
      foresight: c?.foresight ?? null,
      foreDistanceM: s.closer != null ? (computed[s.closer]?.foreDistanceResolvedM ?? c!.foreDistanceM) : null,
      intermediates: s.intermediates.map((i) => ({
        pointCode: rows[i]!.pointCode,
        reading: rows[i]!.foresight,
        elevation: finite(computed[i]?.elevationCalculated),
      })),
      elevation: s.closer != null ? finite(computed[s.closer]?.elevationCalculated) : null,
      ends: s.closer === last && c?.pointType === "bm",
    };
  });
}

export interface ArithmeticCheck {
  sumBack: number;
  sumFore: number;
  /** Cota final − inicial de la cadena. */
  heightDifference: number;
  ok: boolean;
  distanceM: number;
}

/** Σ V+ − Σ V− frente a cota final − inicial, sin las intermedias, y la distancia del recorrido. */
export function arithmeticOf(run: RunResult): ArithmeticCheck {
  let sumBack = 0;
  let sumFore = 0;
  for (const r of run.readings) {
    if (r.pointType === "intermediate") continue;
    sumBack += r.backsight ?? 0;
    sumFore += r.foresight ?? 0;
  }
  return {
    sumBack,
    sumFore,
    heightDifference: run.heightDifference,
    ok: run.arithmeticCheckOk,
    distanceM: run.distanceKm * 1000,
  };
}

/** Una lectura de mira: tres decimales, o cuatro si vienen del nivel digital. */
export function formatReading(value: number | null): string {
  if (value == null) return "—";
  const mm = value * 1000;
  return Math.abs(mm - Math.round(mm)) < 1e-6 ? value.toFixed(3) : value.toFixed(4);
}
