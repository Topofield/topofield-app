import { cn } from "@/lib/utils/cn";
import { formatSignedMm } from "@/lib/utils/format";
import type { LevelingResult, LevelingType } from "@/types/leveling";
import { PRECISION_ORDER_LABELS, type PrecisionOrder } from "@/types/project";

type Tone = "ok" | "danger" | "neutral";

export interface LevelingVerdict {
  tone: Tone;
  title: string;
  /** El valor que decide, ya formateado («−0.4 mm»), o null si no hay. */
  value: string | null;
  /** Su tolerancia, ya formateada, o null. */
  required: string | null;
  /** Qué es el valor: «Error de cierre sobre 1.397 km», «Discrepancia…». */
  detail: string | null;
}

/**
 * Veredicto de una nivelación (Fase 22), el equivalente del de la poligonal.
 * Función pura.
 *
 * Una cerrada o de enlace se juzga por su error de cierre; una abierta con
 * vuelta, por la discrepancia entre ida y vuelta; una abierta sin vuelta no
 * cierra contra nada.
 */
export function levelingVerdictFor(
  result: LevelingResult,
  type: LevelingType,
  order: PrecisionOrder,
  totalKm: number,
): LevelingVerdict {
  const orderLabel = PRECISION_ORDER_LABELS[order].toLowerCase();
  const incompletos: LevelingVerdict = {
    tone: "neutral",
    title: "Datos incompletos",
    value: null,
    required: null,
    detail: null,
  };

  if (type !== "open") {
    if (result.meetsTolerance === null || result.closureErrorMm === null) return incompletos;
    return {
      tone: result.meetsTolerance ? "ok" : "danger",
      title: `${result.meetsTolerance ? "Cumple" : "No cumple"} ${orderLabel}`,
      value: `${formatSignedMm(result.closureErrorMm)} mm`,
      required:
        result.toleranceMm === null ? null : `tolerancia ±${result.toleranceMm.toFixed(1)} mm`,
      detail: `Error de cierre sobre ${totalKm.toFixed(3)} km`,
    };
  }

  if (result.return !== null) {
    if (result.meetsDiscrepancy === null || result.discrepancyMm === null) return incompletos;
    return {
      tone: result.meetsDiscrepancy ? "ok" : "danger",
      title: `${result.meetsDiscrepancy ? "Cumple" : "No cumple"} ${orderLabel}`,
      value: `${result.discrepancyMm.toFixed(1)} mm`,
      required:
        result.discrepancyToleranceMm === null
          ? null
          : `tolerancia ${result.discrepancyToleranceMm.toFixed(1)} mm`,
      detail: "Discrepancia entre ida y vuelta",
    };
  }

  return {
    tone: "neutral",
    title: "Sin verificación de cierre",
    value: null,
    required: null,
    detail: "Una nivelación abierta sin vuelta no cierra contra ninguna cota conocida.",
  };
}

const TONE_CLASSES: Record<Tone, string> = {
  ok: "border-success/30 bg-success-bg",
  danger: "border-danger/30 bg-danger-bg",
  neutral: "border-rule bg-paper",
};

const TITLE_CLASSES: Record<Tone, string> = {
  ok: "text-success",
  danger: "text-danger",
  neutral: "text-ink-2",
};

interface LevelingVerdictProps {
  result: LevelingResult;
  type: LevelingType;
  order: PrecisionOrder;
  totalKm: number;
}

/** Veredicto de cierre de la nivelación, arriba de la pantalla, como en la poligonal. */
export function LevelingVerdictBanner({ result, type, order, totalKm }: LevelingVerdictProps) {
  const v = levelingVerdictFor(result, type, order, totalKm);
  return (
    <section
      aria-label="Veredicto de cierre"
      className={cn("rounded-lg border p-5", TONE_CLASSES[v.tone])}
    >
      <p
        role="status"
        className={cn("text-xs font-semibold uppercase tracking-wide", TITLE_CLASSES[v.tone])}
      >
        {v.title}
      </p>
      {v.value && (
        <div className="mt-2 flex flex-wrap items-baseline gap-x-6 gap-y-1">
          <span className="font-mono text-3xl font-semibold tabular-nums text-ink">{v.value}</span>
          {v.required && (
            <span className="font-mono text-sm tabular-nums text-ink-2">{v.required}</span>
          )}
        </div>
      )}
      {v.detail && <p className="mt-2 text-sm text-ink-2">{v.detail}</p>}
    </section>
  );
}
