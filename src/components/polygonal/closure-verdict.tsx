import { cn } from "@/lib/utils/cn";
import { minRelativePrecision } from "@/lib/calculations/tolerances";
import type { PolygonalResult, PolygonalType } from "@/types/polygonal";
import { PRECISION_ORDER_LABELS, type PrecisionOrder } from "@/types/project";

type Tone = "ok" | "danger" | "neutral";

export interface Verdict {
  tone: Tone;
  title: string;
  /** Precisión alcanzada, ya formateada (o null si no aplica). */
  achieved: string | null;
  /** Precisión exigida por el orden, ya formateada (o null si no aplica). */
  required: string | null;
}

function formatPrecision(x: number | null): string | null {
  if (x == null) return null;
  if (!Number.isFinite(x)) return "1:∞";
  return `1:${Math.round(x).toLocaleString("es-CO")}`;
}

/** Decide el veredicto de cierre. Función pura: testeable sin render. */
export function verdictFor(
  result: PolygonalResult,
  type: PolygonalType,
  order: PrecisionOrder,
): Verdict {
  const orderLabel = PRECISION_ORDER_LABELS[order].toLowerCase();
  const achieved = formatPrecision(result.relativePrecision);
  const required = formatPrecision(minRelativePrecision(order));

  if (type === "open_uncontrolled") {
    return {
      tone: "neutral",
      title: "Sin verificación de cierre",
      achieved: null,
      required: null,
    };
  }
  if (result.meetsTolerance === true) {
    return { tone: "ok", title: `Cumple ${orderLabel}`, achieved, required };
  }
  if (result.meetsTolerance === false) {
    return {
      tone: "danger",
      title: `No cumple ${orderLabel}`,
      achieved,
      required,
    };
  }
  return {
    tone: "neutral",
    title: "Datos incompletos",
    achieved: null,
    required: null,
  };
}

const TONE_CLASSES: Record<Tone, string> = {
  ok: "border-success-500/30 bg-success-500/5",
  danger: "border-danger-500/30 bg-danger-500/5",
  neutral: "border-neutral-200 bg-neutral-50",
};

const TITLE_CLASSES: Record<Tone, string> = {
  ok: "text-success-500",
  danger: "text-danger-500",
  neutral: "text-neutral-500",
};

function formatMeters(value: number | null, decimals = 3): string {
  return value == null ? "—" : value.toFixed(decimals);
}

interface ClosureVerdictProps {
  result: PolygonalResult;
  type: PolygonalType;
  order: PrecisionOrder;
  className?: string;
}

/** Veredicto de cierre: el resultado que el topógrafo busca al abrir el proceso. */
export function ClosureVerdict({
  result,
  type,
  order,
  className,
}: ClosureVerdictProps) {
  const v = verdictFor(result, type, order);

  return (
    <section
      aria-label="Veredicto de cierre"
      className={cn("rounded-lg border p-5", TONE_CLASSES[v.tone], className)}
    >
      <p
        className={cn(
          "text-xs font-semibold uppercase tracking-wide",
          TITLE_CLASSES[v.tone],
        )}
      >
        {v.title}
      </p>

      {v.achieved && (
        <div className="mt-2 flex flex-wrap items-baseline gap-x-6 gap-y-1">
          <span className="font-mono text-3xl font-semibold tabular-nums text-neutral-900">
            {v.achieved}
          </span>
          {v.required && (
            <span className="font-mono text-sm tabular-nums text-neutral-500">
              requerido {v.required}
            </span>
          )}
        </div>
      )}

      {result.linearError != null && (
        <p className="mt-2 font-mono text-sm tabular-nums text-neutral-500">
          Error de cierre {formatMeters(result.linearError, 4)} m · Perímetro{" "}
          {formatMeters(result.perimeter)} m
        </p>
      )}
    </section>
  );
}
