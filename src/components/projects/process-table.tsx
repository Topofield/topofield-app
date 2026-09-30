import Link from "next/link";
import type { ReactNode } from "react";
import { Badge } from "@/components/design-system";
import { ProcessRowActions, type RowKind } from "@/components/projects/process-row-actions";
import { formatDate, formatRelativeDate } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";
import type { ProcessFilters, SortKey } from "@/lib/process-list";
import type { StatusTone } from "@/lib/process-status";

/**
 * Una fila del listado del hub, ya armada en el servidor (Fase 22). Es la
 * misma para poligonales, nivelaciones y lugares: cada módulo decide su tipo,
 * su resultado y su veredicto.
 */
export interface ProcessRow {
  id: string;
  kind: RowKind;
  name: string;
  href: string;
  /** «Poligonal · Cerrada», «Nivelación · De enlace», «Edificio · 14 visitas». */
  kindLabel: string;
  statusLabel: string;
  statusTone: StatusTone;
  /** Lo que el proceso dio: precisión, cierre, peor alerta. */
  result: ReactNode;
  /** ¿Cumple la tolerancia? `undefined` si el módulo no tiene esa columna. */
  meets?: boolean | null;
  updatedAt: string;
  /** Cerrado o rechazado: solo se puede duplicar. */
  closed: boolean;
}

/** Destino de una columna ordenable, conservando filtros y módulo. */
function sortHref(
  projectId: string,
  modulo: string,
  filters: ProcessFilters,
  columna: SortKey,
): string {
  const activa = filters.orden === columna;
  const params = new URLSearchParams();
  params.set("tab", "processes");
  params.set("modulo", modulo);
  if (filters.q !== "") params.set("q", filters.q);
  if (filters.estado !== "todos") params.set("estado", filters.estado);
  if (filters.tipo !== "todos") params.set("tipo", filters.tipo);
  params.set("orden", columna);
  params.set("dir", activa && filters.dir === "desc" ? "asc" : "desc");
  return `/projects/${projectId}?${params.toString()}`;
}

/**
 * Encabezado de columna ordenable. `aria-sort` es propiedad del `<th>`
 * (role="columnheader"), no de su hijo interactivo — WAI-ARIA lo exige así
 * para que un lector de pantalla lo asocie con la celda.
 */
function SortableHeader({
  columna,
  etiqueta,
  href,
  filters,
}: {
  columna: SortKey;
  etiqueta: string;
  href: string;
  filters: ProcessFilters;
}) {
  const activa = filters.orden === columna;
  const ariaSort = activa ? (filters.dir === "asc" ? "ascending" : "descending") : undefined;
  return (
    <th scope="col" className="px-4 py-3 font-medium" aria-sort={ariaSort}>
      <Link
        href={href}
        className={cn(
          "inline-flex items-center gap-1 transition-colors hover:text-ink",
          activa && "text-ink",
        )}
      >
        {etiqueta}
        {activa && <span aria-hidden>{filters.dir === "asc" ? "↑" : "↓"}</span>}
      </Link>
    </th>
  );
}

/** Semáforo de tolerancia. El color no es el único canal: lleva texto. */
function ToleranceMark({ meets }: { meets: boolean | null }) {
  if (meets === true) {
    return (
      <span className="text-success">
        <span aria-hidden>✓</span>
        <span className="sr-only">Cumple la tolerancia</span>
      </span>
    );
  }
  if (meets === false) {
    return (
      <span className="text-danger">
        <span aria-hidden>✕</span>
        <span className="sr-only">No cumple la tolerancia</span>
      </span>
    );
  }
  return (
    <span className="text-ink-2">
      <span aria-hidden>—</span>
      <span className="sr-only">Sin verificación</span>
    </span>
  );
}

/**
 * Listado del hub (Fase 22): tabla en escritorio y tarjetas en móvil, con los
 * mismos campos y las mismas acciones — la regla de la § 8. Las tarjetas no
 * son un enlace entero: llevan botones, y un botón dentro de un enlace no es
 * HTML válido.
 */
export function ProcessTable({
  projectId,
  modulo,
  rows,
  filters,
  resultLabel,
}: {
  projectId: string;
  modulo: string;
  rows: ProcessRow[];
  filters: ProcessFilters;
  /** Encabezado de la columna de resultado: «Precisión», «Cierre», «Alerta». */
  resultLabel: string;
}) {
  const conCumple = rows.some((r) => r.meets !== undefined);
  const href = (c: SortKey) => sortHref(projectId, modulo, filters, c);

  return (
    <>
      {/* Escritorio */}
      <div className="hidden overflow-x-auto rounded-lg border border-rule bg-card md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-rule text-left text-xs text-ink-2">
              <SortableHeader columna="nombre" etiqueta="Nombre" href={href("nombre")} filters={filters} />
              <th scope="col" className="px-4 py-3 font-medium">Estado</th>
              <SortableHeader columna="precision" etiqueta={resultLabel} href={href("precision")} filters={filters} />
              {conCumple && (
                <th scope="col" className="px-4 py-3 text-center font-medium">Cumple</th>
              )}
              <SortableHeader
                columna="actividad"
                etiqueta="Última actividad"
                href={href("actividad")}
                filters={filters}
              />
              <th scope="col" className="px-4 py-3">
                <span className="sr-only">Acciones</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-rule last:border-0 transition-colors hover:bg-sel">
                <td className="px-4 py-3">
                  <Link href={r.href} className="font-medium text-ink underline-offset-2 hover:underline">
                    {r.name}
                  </Link>
                  <p className="text-xs text-ink-2">{r.kindLabel}</p>
                </td>
                <td className="px-4 py-3">
                  <Badge tone={r.statusTone}>{r.statusLabel}</Badge>
                </td>
                <td className="px-4 py-3 font-mono tabular-nums text-ink-2">{r.result}</td>
                {conCumple && (
                  <td className="px-4 py-3 text-center">
                    <ToleranceMark meets={r.meets ?? null} />
                  </td>
                )}
                <td className="whitespace-nowrap px-4 py-3 text-ink-2" title={formatDate(r.updatedAt)}>
                  {formatRelativeDate(r.updatedAt)}
                </td>
                <td className="px-4 py-3">
                  <ProcessRowActions kind={r.kind} id={r.id} name={r.name} closed={r.closed} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Móvil: los mismos campos, en tarjetas. */}
      <ul className="grid gap-3 md:hidden">
        {rows.map((r) => (
          <li key={r.id} className="rounded-lg border border-rule bg-card p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs text-ink-2">{r.kindLabel}</p>
                <Link href={r.href} className="mt-0.5 block font-semibold text-ink underline-offset-2 hover:underline">
                  {r.name}
                </Link>
              </div>
              <Badge tone={r.statusTone}>{r.statusLabel}</Badge>
            </div>
            <div className="mt-3 flex items-center justify-between gap-3 text-xs text-ink-2">
              <span className="inline-flex items-center gap-1.5 font-mono tabular-nums">
                {r.result}
                {r.meets !== undefined && <ToleranceMark meets={r.meets} />}
              </span>
              <span className="shrink-0" title={formatDate(r.updatedAt)}>
                {formatRelativeDate(r.updatedAt)}
              </span>
            </div>
            <div className="mt-2 border-t border-rule pt-2">
              <ProcessRowActions kind={r.kind} id={r.id} name={r.name} closed={r.closed} />
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
