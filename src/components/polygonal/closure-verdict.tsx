import { cn } from "@/lib/utils/cn";
import {
  ANGULAR_TOLERANCE_K,
  minRelativePrecision,
} from "@/lib/calculations/tolerances";
import type { PolygonalResult, PolygonalType } from "@/types/polygonal";
import { PRECISION_ORDER_LABELS, type PrecisionOrder } from "@/types/project";
import { formatPrecision } from "@/lib/utils/format";

type Tone = "ok" | "danger" | "neutral";

export interface Verdict {
  tone: Tone;
  title: string;
  /** Precisión alcanzada, ya formateada (o null si no aplica). */
  achieved: string | null;
  /** Precisión exigida por el orden, ya formateada (o null si no aplica). */
  required: string | null;
  /**
   * Matiz que acota el alcance del veredicto (o null si no hace falta).
   *
   * Hoy solo se usa para el caso del equipo insuficiente: el veredicto verde
   * y el aviso de equipo son dos afirmaciones verdaderas sobre cosas
   * distintas —la conformidad de las MEDIDAS y la capacidad del
   * INSTRUMENTO—, y hasta ahora se ignoraban mutuamente en pantalla.
   */
  caveat: string | null;
}

/**
 * Decide el veredicto de cierre. Función pura: testeable sin render.
 *
 * `instrumentMeetsOrder` NO entra en el cálculo: no cambia `tone` ni `title`
 * ni tiene nada que ver con `meets_tolerance`. Mantener separadas la
 * capacidad del instrumento y la conformidad de las medidas es deliberado
 * —son cantidades distintas y el aviso de equipo es informativo, no
 * bloqueante—; lo único que aporta aquí es el matiz que impide que el verde
 * se lea como una afirmación sobre el instrumento.
 */
export function verdictFor(
  result: PolygonalResult,
  type: PolygonalType,
  order: PrecisionOrder,
  instrumentMeetsOrder: boolean,
): Verdict {
  const orderLabel = PRECISION_ORDER_LABELS[order].toLowerCase();
  // `null` y no "—" cuando no hay precisión: quien renderiza oculta el bloque
  // entero si `achieved` es nulo, en vez de mostrar un guion suelto.
  const achieved =
    result.relativePrecision == null
      ? null
      : formatPrecision(result.relativePrecision);
  const required = formatPrecision(minRelativePrecision(order));

  if (type === "open_uncontrolled") {
    return {
      tone: "neutral",
      title: "Sin verificación de cierre",
      achieved: null,
      required: null,
      caveat: null,
    };
  }
  if (result.meetsTolerance === true) {
    return {
      tone: "ok",
      title: `Cumple ${orderLabel}`,
      achieved,
      required,
      // El verde es la afirmación más fuerte que hace la aplicación, y sale
      // de un único estadístico de cierre que un cuadrado sintético perfecto
      // satisface sin esfuerzo. Si además el equipo declarado no da para el
      // orden declarado, decirlo sin matizar induce a error.
      caveat: instrumentMeetsOrder
        ? null
        : `El cierre cumple, pero el equipo declarado no alcanza el orden declarado (K = ${ANGULAR_TOLERANCE_K[order]}″): el veredicto es sobre las medidas, no sobre la capacidad del instrumento.`,
    };
  }
  if (result.meetsTolerance === false) {
    return {
      tone: "danger",
      title: `No cumple ${orderLabel}`,
      achieved,
      required,
      caveat: null,
    };
  }
  return {
    tone: "neutral",
    title: "Datos incompletos",
    achieved: null,
    required: null,
    caveat: null,
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
  /**
   * ¿La estación total declarada puede entregar el orden declarado?
   * (`totalStationMeetsOrder`). Solo matiza el texto del veredicto verde.
   */
  instrumentMeetsOrder: boolean;
  className?: string;
}

/** Veredicto de cierre: el resultado que el topógrafo busca al abrir el proceso. */
export function ClosureVerdict({
  result,
  type,
  order,
  instrumentMeetsOrder,
  className,
}: ClosureVerdictProps) {
  const v = verdictFor(result, type, order, instrumentMeetsOrder);

  return (
    <section
      aria-label="Veredicto de cierre"
      className={cn("rounded-lg border p-5", TONE_CLASSES[v.tone], className)}
    >
      <p
        role="status"
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

      {v.caveat && (
        <p className="mt-3 border-t border-neutral-200 pt-3 text-sm text-neutral-600">
          {v.caveat}
        </p>
      )}
    </section>
  );
}
