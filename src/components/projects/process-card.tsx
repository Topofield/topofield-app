import Link from "next/link";
import { Badge } from "@/components/design-system";
import { formatDate, formatPrecision, formatRelativeDate } from "@/lib/utils/format";
import {
  POLYGONAL_TYPE_LABELS,
  PROCESS_STATUS_LABELS,
  type PolygonalProcess,
  type ProcessStatus,
} from "@/types/polygonal";
import { LEVELING_TYPE_LABELS, type LevelingProcess } from "@/types/leveling";

const STATUS_TONE: Record<
  ProcessStatus,
  "neutral" | "primary" | "success" | "danger" | "warning"
> = {
  draft: "neutral",
  in_progress: "neutral",
  calculated: "primary",
  closed: "success",
  rejected: "danger",
};

/** Semáforo de tolerancia. El color no es el único canal: lleva texto.
 *  Mismo criterio y textos que `ToleranceMark` en `process-table.tsx`. */
function ToleranceMark({ meets }: { meets: boolean | null }) {
  if (meets === true) {
    return (
      <span className="text-success-500">
        <span aria-hidden>✓</span>
        <span className="sr-only">Cumple la tolerancia</span>
      </span>
    );
  }
  if (meets === false) {
    return (
      <span className="text-danger-500">
        <span aria-hidden>✕</span>
        <span className="sr-only">No cumple la tolerancia</span>
      </span>
    );
  }
  return null;
}

/**
 * Tarjeta de proceso del hub. Acepta poligonal o nivelación: cada una define
 * su propia ruta de edición y su propia etiqueta de tipo, el resto de la
 * tarjeta (estado, precisión/tolerancia, actividad) es común a ambas.
 */
type ProcessCardProps =
  | { projectId: string; process: PolygonalProcess; kind?: "polygonal" }
  | { projectId: string; process: LevelingProcess; kind: "leveling" };

function typeLabel(props: ProcessCardProps): string {
  if (props.kind === "leveling") {
    return `Nivelación · ${LEVELING_TYPE_LABELS[props.process.type]}`;
  }
  return `Poligonal · ${POLYGONAL_TYPE_LABELS[props.process.type]}`;
}

function editorHref(props: ProcessCardProps): string {
  const { projectId, process } = props;
  return props.kind === "leveling"
    ? `/projects/${projectId}/leveling/${process.id}`
    : `/projects/${projectId}/polygonal/${process.id}`;
}

/** Sin verificación de cierre: solo aplica a la poligonal abierta sin control
 *  y a la nivelación abierta sin control (`open`). */
function noClosureCheck(props: ProcessCardProps): boolean {
  if (props.kind === "leveling") return props.process.type === "open";
  return props.process.type === "open_uncontrolled";
}

/** Métrica principal de la tarjeta: precisión relativa en poligonal, error de
 *  cierre en nivelación (no comparten la misma columna en el schema). */
function metricLabel(props: ProcessCardProps): string | null {
  if (props.kind === "leveling") {
    return props.process.closure_error_mm != null
      ? `Error de cierre ${props.process.closure_error_mm.toFixed(1)} mm`
      : null;
  }
  return props.process.relative_precision
    ? `Precisión ${formatPrecision(props.process.relative_precision)}`
    : null;
}

export function ProcessCard(props: ProcessCardProps) {
  const { process } = props;
  const outOfTolerance =
    process.status === "closed" && process.meets_tolerance === false;

  const tone = outOfTolerance ? "warning" : STATUS_TONE[process.status];
  const label = outOfTolerance
    ? "Cerrado fuera de tolerancia"
    : PROCESS_STATUS_LABELS[process.status];

  return (
    <Link
      href={editorHref(props)}
      className="block rounded-lg border border-neutral-200 bg-white p-5 shadow-sm transition-colors hover:border-primary-200 hover:bg-primary-50"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
            {typeLabel(props)}
          </p>
          <h3 className="mt-0.5 font-semibold">
            {process.name}
          </h3>
        </div>
        <Badge tone={tone}>{label}</Badge>
      </div>
      <div className="mt-4 flex items-center justify-between gap-3 text-xs text-neutral-500">
        <span className="inline-flex items-center gap-1.5">
          {metricLabel(props) ??
            (noClosureCheck(props) ? "Sin verificación de cierre" : "Sin calcular")}
          <ToleranceMark meets={process.meets_tolerance} />
        </span>
        <span className="shrink-0" title={formatDate(process.updated_at)}>
          {formatRelativeDate(process.updated_at)}
        </span>
      </div>
    </Link>
  );
}
