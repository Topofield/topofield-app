"use client";

import Link from "next/link";
import { Badge, StatusIndicator } from "@/components/design-system";
import { cn } from "@/lib/utils/cn";
import { formatDateShort, formatSignedMm } from "@/lib/utils/format";
import { ALERT_LEVEL_LABELS, type AlertLevel, type VisitStatus } from "@/types/settlement";

/** Una fila de la tabla: la visita ya resumida en el servidor. */
export interface VisitTableRow {
  visitId: string;
  visitNumber: number;
  date: string;
  status: VisitStatus;
  mean: number | null;
  maxSettlement: { code: string; value: number } | null;
  maxMove: { code: string; value: number } | null;
  /** «BM-2 no nivela con BM-1», si algún BM leído de paso no nivela (Fase 30). */
  bmWarning: string | null;
  worstAlert: AlertLevel;
}

interface VisitsTableProps {
  /** En orden cronológico; la tabla las muestra de la más reciente a la más antigua. */
  rows: VisitTableRow[];
  /** `/projects/…/settlement/…/visits`, al que se añade el id. */
  hrefBase: string;
  /** La visita elegida, resaltada aquí y en la tendencia de al lado (Fase 37). */
  selectedId?: string | null;
  onSelect?: (visitId: string) => void;
}

/**
 * Visitas del lugar (Fase 18; columnas de la Fase 37, lienzo «Lugar B»):
 * promedio, máximo, mayor movimiento y alerta. Pulsar la fila la elige para
 * resaltarla en la tendencia; el enlace de la primera columna abre la visita.
 */
export function VisitsTable({ rows, hrefBase, selectedId = null, onSelect }: VisitsTableProps) {
  if (rows.length === 0) {
    return <p className="text-sm text-ink-2">Aún no hay visitas registradas en este lugar.</p>;
  }

  return (
    // `relative`: el texto `sr-only` de las celdas es absoluto, y sin un
    // contenedor posicionado escapa del recorte y ensancha la página entera
    // en un teléfono.
    <div className="relative max-h-[32rem] overflow-auto">
      <table className="w-full text-sm">
        <thead className="sticky top-0 z-10 bg-card">
          <tr className="border-b border-rule text-left text-xs text-ink-2">
            <th className="py-2 pr-3 font-medium">Visita</th>
            <th className="py-2 pr-3 font-medium">Fecha</th>
            <th className="py-2 pr-3 text-right font-medium">Promedio (mm)</th>
            <th className="py-2 pr-3 text-right font-medium">Máximo (mm)</th>
            <th className="py-2 pr-3 text-right font-medium">Mayor Δ (mm)</th>
            <th className="py-2 pr-3 font-medium">Alerta</th>
          </tr>
        </thead>
        <tbody>
          {[...rows].reverse().map((row) => {
            const href = `${hrefBase}/${row.visitId}`;
            const selected = row.visitId === selectedId;
            return (
              <tr
                key={row.visitId}
                onClick={onSelect ? () => onSelect(row.visitId) : undefined}
                aria-selected={onSelect ? selected : undefined}
                className={cn(
                  "border-b border-rule last:border-0",
                  onSelect && "cursor-pointer hover:bg-paper",
                  selected && "bg-mira-bg",
                )}
              >
                <td className="whitespace-nowrap py-2 pr-3">
                  <Link
                    href={href}
                    onClick={(e) => e.stopPropagation()}
                    className="font-medium text-ink hover:underline"
                  >
                    Visita {row.visitNumber}
                  </Link>
                  {row.visitNumber === 0 && <span className="ml-1 text-ink-2">(base)</span>}
                  {row.status === "in_progress" && (
                    <Badge tone="neutral" className="ml-2">
                      En medición
                    </Badge>
                  )}
                </td>
                <td className="whitespace-nowrap py-2 pr-3 text-ink-2">
                  {formatDateShort(row.date)}
                  {row.bmWarning && (
                    <span className="font-semibold text-warning" title={row.bmWarning}>
                      <span aria-hidden> ⚠</span>
                      <span className="sr-only"> ({row.bmWarning})</span>
                    </span>
                  )}
                </td>
                <td className="py-2 pr-3 text-right font-mono tabular-nums">{formatSignedMm(row.mean)}</td>
                <td className="whitespace-nowrap py-2 pr-3 text-right font-mono tabular-nums">
                  {row.maxSettlement ? (
                    <>
                      {formatSignedMm(row.maxSettlement.value)}{" "}
                      <span className="font-sans text-ink-2">{row.maxSettlement.code}</span>
                    </>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="whitespace-nowrap py-2 pr-3 text-right font-mono tabular-nums">
                  {row.visitNumber !== 0 && row.maxMove ? (
                    <>
                      {formatSignedMm(row.maxMove.value)}{" "}
                      <span className="font-sans text-ink-2">{row.maxMove.code}</span>
                    </>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="whitespace-nowrap py-2 pr-3">
                  <StatusIndicator level={row.worstAlert} label={ALERT_LEVEL_LABELS[row.worstAlert]} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
