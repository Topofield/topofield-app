import Link from "next/link";
import { Badge } from "@/components/design-system";
import { formatDate, formatRelativeDate } from "@/lib/utils/format";
import {
  POLYGONAL_TYPE_LABELS,
  PROCESS_STATUS_LABELS,
  type PolygonalProcess,
  type ProcessStatus,
} from "@/types/polygonal";

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

export function ProcessCard({
  projectId,
  process,
}: {
  projectId: string;
  process: PolygonalProcess;
}) {
  const outOfTolerance =
    process.status === "closed" && process.meets_tolerance === false;

  const tone = outOfTolerance ? "warning" : STATUS_TONE[process.status];
  const label = outOfTolerance
    ? "Cerrado fuera de tolerancia"
    : PROCESS_STATUS_LABELS[process.status];

  return (
    <Link
      href={`/projects/${projectId}/polygonal/${process.id}`}
      className="block rounded-lg border border-neutral-200 bg-white p-5 shadow-sm transition-colors hover:border-primary-200 hover:bg-primary-50"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
            Poligonal · {POLYGONAL_TYPE_LABELS[process.type]}
          </p>
          <h3 className="mt-0.5 font-semibold">
            {process.name}
          </h3>
        </div>
        <Badge tone={tone}>{label}</Badge>
      </div>
      <div className="mt-4 flex items-center justify-between gap-3 text-xs text-neutral-500">
        <span className="inline-flex items-center gap-1.5">
          {process.relative_precision
            ? `Precisión ${process.relative_precision}`
            : process.type === "open_uncontrolled"
              ? "Sin verificación de cierre"
              : "Sin calcular"}
          <ToleranceMark meets={process.meets_tolerance} />
        </span>
        <span className="shrink-0" title={formatDate(process.updated_at)}>
          {formatRelativeDate(process.updated_at)}
        </span>
      </div>
    </Link>
  );
}
