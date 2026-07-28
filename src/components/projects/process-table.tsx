import Link from "next/link";
import { Badge } from "@/components/design-system";
import { ProcessCard } from "@/components/projects/process-card";
import { formatDate, formatRelativeDate } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";
import type { ProcessFilters, SortKey } from "@/lib/process-list";
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

/** Enlace de encabezado que alterna el orden de su columna. */
function SortLink({
  columna,
  etiqueta,
  projectId,
  filters,
}: {
  columna: SortKey;
  etiqueta: string;
  projectId: string;
  filters: ProcessFilters;
}) {
  const activa = filters.orden === columna;
  const dir = activa && filters.dir === "desc" ? "asc" : "desc";

  const params = new URLSearchParams();
  params.set("tab", "processes");
  if (filters.q !== "") params.set("q", filters.q);
  if (filters.estado !== "todos") params.set("estado", filters.estado);
  if (filters.tipo !== "todos") params.set("tipo", filters.tipo);
  params.set("orden", columna);
  params.set("dir", dir);

  return (
    <Link
      href={`/projects/${projectId}?${params.toString()}`}
      className={cn(
        "inline-flex items-center gap-1 transition-colors hover:text-primary-600",
        activa && "text-neutral-900",
      )}
    >
      {etiqueta}
      {activa && (
        <span aria-hidden>{filters.dir === "asc" ? "↑" : "↓"}</span>
      )}
    </Link>
  );
}

/**
 * Encabezado de columna ordenable. `aria-sort` es propiedad del `<th>`
 * (role="columnheader"), no de su hijo interactivo — WAI-ARIA lo exige
 * así para que un lector de pantalla lo asocie con la celda.
 */
function SortableHeader({
  columna,
  etiqueta,
  projectId,
  filters,
}: {
  columna: SortKey;
  etiqueta: string;
  projectId: string;
  filters: ProcessFilters;
}) {
  const activa = filters.orden === columna;
  const ariaSort = activa
    ? filters.dir === "asc"
      ? "ascending"
      : "descending"
    : undefined;

  return (
    <th scope="col" className="px-4 py-3 font-medium" aria-sort={ariaSort}>
      <SortLink
        columna={columna}
        etiqueta={etiqueta}
        projectId={projectId}
        filters={filters}
      />
    </th>
  );
}

/** Semáforo de tolerancia. El color no es el único canal: lleva texto. */
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
  return (
    <span className="text-neutral-500">
      <span aria-hidden>—</span>
      <span className="sr-only">Sin verificación</span>
    </span>
  );
}

export function ProcessTable({
  projectId,
  processes,
  filters,
}: {
  projectId: string;
  processes: PolygonalProcess[];
  filters: ProcessFilters;
}) {
  return (
    <>
      {/* Escritorio */}
      <div className="hidden overflow-x-auto rounded-lg border border-neutral-200 bg-white md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-100 text-left text-xs text-neutral-500">
              <SortableHeader
                columna="nombre"
                etiqueta="Proceso"
                projectId={projectId}
                filters={filters}
              />
              <th scope="col" className="px-4 py-3 font-medium">Estado</th>
              <SortableHeader
                columna="precision"
                etiqueta="Precisión"
                projectId={projectId}
                filters={filters}
              />
              <th scope="col" className="px-4 py-3 text-center font-medium">Cumple</th>
              <SortableHeader
                columna="actividad"
                etiqueta="Última actividad"
                projectId={projectId}
                filters={filters}
              />
            </tr>
          </thead>
          <tbody>
            {processes.map((p) => {
              const fueraDeTolerancia =
                p.status === "closed" && p.meets_tolerance === false;
              return (
                <tr
                  key={p.id}
                  className="border-b border-neutral-100 last:border-0 transition-colors hover:bg-primary-50"
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/projects/${projectId}/polygonal/${p.id}`}
                      className="font-medium text-neutral-900 hover:text-primary-600"
                    >
                      {p.name}
                    </Link>
                    <p className="text-xs text-neutral-500">
                      Poligonal · {POLYGONAL_TYPE_LABELS[p.type]}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <Badge
                      tone={
                        fueraDeTolerancia ? "warning" : STATUS_TONE[p.status]
                      }
                    >
                      {fueraDeTolerancia
                        ? "Cerrado fuera de tolerancia"
                        : PROCESS_STATUS_LABELS[p.status]}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 font-mono tabular-nums text-neutral-700">
                    {p.relative_precision ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <ToleranceMark meets={p.meets_tolerance} />
                  </td>
                  <td
                    className="whitespace-nowrap px-4 py-3 text-neutral-500"
                    title={formatDate(p.updated_at)}
                  >
                    {formatRelativeDate(p.updated_at)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Móvil: se conservan las tarjetas ya existentes. */}
      <div className="grid gap-4 md:hidden">
        {processes.map((p) => (
          <ProcessCard key={p.id} projectId={projectId} process={p} />
        ))}
      </div>
    </>
  );
}
