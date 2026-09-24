"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Badge, StatusIndicator } from "@/components/design-system";
import { formatDateShort, formatSignedMm, formatBookClosure } from "@/lib/utils/format";
import {
  ALERT_LEVEL_LABELS,
  VISIT_STATUS_LABELS,
  type AlertLevel,
  type CaptureMode,
  type VisitStatus,
} from "@/types/settlement";

const STATUS_TONE = {
  draft: "neutral",
  calculated: "primary",
  closed: "success",
} as const;

/** Una fila de la tabla: la visita ya resumida en el servidor. */
export interface VisitTableRow {
  visitId: string;
  visitNumber: number;
  date: string;
  status: VisitStatus;
  captureMode: CaptureMode;
  mean: number | null;
  maxSettlement: { code: string; value: number } | null;
  maxMove: { code: string; value: number } | null;
  amarre: { code: string; elevation: number | null } | null;
  closureErrorMm: number | null;
  toleranceMm: number | null;
  meetsTolerance: boolean | null;
  worstAlert: AlertLevel;
}

interface VisitsTableProps {
  /** En orden cronológico; la tabla las muestra de la más reciente a la más antigua. */
  rows: VisitTableRow[];
  /** `/projects/…/settlement/…/visits`, al que se añade el id. */
  hrefBase: string;
}

/**
 * Visitas del lugar (Fase 18), con las columnas del prototipo: promedio,
 * máximo, amarre, mayor movimiento y cierre de la libreta, además del nivel
 * de alerta y del estado del proceso. La fila entera abre la visita; el
 * enlace de la primera columna es la navegación real para teclado y lector.
 */
export function VisitsTable({ rows, hrefBase }: VisitsTableProps) {
  const router = useRouter();

  if (rows.length === 0) {
    return (
      <p className="text-sm text-neutral-500">
        Aún no hay visitas registradas en este lugar.
      </p>
    );
  }

  return (
    // `relative`: el texto `sr-only` de las celdas es absoluto, y sin un
    // contenedor posicionado escapa del recorte y ensancha la página entera
    // en un teléfono.
    <div className="relative max-h-[28rem] overflow-auto">
      <table className="w-full text-sm">
        <thead className="sticky top-0 z-10 bg-white">
          <tr className="border-b border-neutral-200 text-left text-xs text-neutral-500">
            <th className="py-2 pr-3 font-medium">Visita</th>
            <th className="py-2 pr-3 font-medium">Fecha</th>
            <th className="py-2 pr-3 text-right font-medium">Promedio (mm)</th>
            <th className="py-2 pr-3 text-right font-medium">Máximo (mm)</th>
            <th className="py-2 pr-3 font-medium">Amarre</th>
            <th className="py-2 pr-3 text-right font-medium">Mayor Δ (mm)</th>
            <th className="py-2 pr-3 text-right font-medium">Cierre (mm)</th>
            <th className="py-2 pr-3 font-medium">Alerta</th>
            <th className="py-2 pr-3 font-medium">Estado</th>
          </tr>
        </thead>
        <tbody>
          {[...rows].reverse().map((row) => {
            const href = `${hrefBase}/${row.visitId}`;
            const closure =
              row.captureMode === "book"
                ? formatBookClosure(row.closureErrorMm, row.toleranceMm, row.meetsTolerance)
                : null;
            return (
              <tr
                key={row.visitId}
                onClick={() => router.push(href)}
                className="cursor-pointer border-b border-neutral-100 last:border-0 hover:bg-neutral-50"
              >
                <td className="whitespace-nowrap py-2 pr-3">
                  <Link
                    href={href}
                    onClick={(e) => e.stopPropagation()}
                    className="font-medium text-primary-600 hover:underline"
                  >
                    Visita {row.visitNumber}
                  </Link>
                  {row.visitNumber === 0 && (
                    <span className="ml-1 text-neutral-500">(base)</span>
                  )}
                </td>
                <td className="whitespace-nowrap py-2 pr-3 text-neutral-700">
                  {formatDateShort(row.date)}
                </td>
                <td className="py-2 pr-3 text-right font-mono tabular-nums">
                  {formatSignedMm(row.mean)}
                </td>
                <td className="whitespace-nowrap py-2 pr-3 text-right font-mono tabular-nums">
                  {row.maxSettlement ? (
                    <>
                      {formatSignedMm(row.maxSettlement.value)}{" "}
                      <span className="font-sans text-neutral-500">{row.maxSettlement.code}</span>
                    </>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="whitespace-nowrap py-2 pr-3">
                  {row.amarre ? (
                    <>
                      {row.amarre.code}{" "}
                      {row.amarre.elevation != null && (
                        <span className="font-mono tabular-nums text-neutral-500">
                          {row.amarre.elevation.toFixed(4)}
                        </span>
                      )}
                    </>
                  ) : (
                    <span className="text-neutral-500">—</span>
                  )}
                </td>
                <td className="whitespace-nowrap py-2 pr-3 text-right font-mono tabular-nums">
                  {row.visitNumber !== 0 && row.maxMove ? (
                    <>
                      {formatSignedMm(row.maxMove.value)}{" "}
                      <span className="font-sans text-neutral-500">{row.maxMove.code}</span>
                    </>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="whitespace-nowrap py-2 pr-3 text-right font-mono tabular-nums">
                  {closure ? (
                    <span
                      className={closure.status === "out" ? "font-semibold text-warning-500" : undefined}
                      title={closure.detail}
                    >
                      {closure.status === "out" && <span aria-hidden>⚠ </span>}
                      {closure.value.replace(" mm", "")}
                      {closure.status === "out" && (
                        <span className="sr-only"> (fuera de tolerancia)</span>
                      )}
                    </span>
                  ) : (
                    formatSignedMm(row.closureErrorMm)
                  )}
                </td>
                <td className="whitespace-nowrap py-2 pr-3">
                  <StatusIndicator
                    level={row.worstAlert}
                    label={ALERT_LEVEL_LABELS[row.worstAlert]}
                  />
                </td>
                <td className="py-2 pr-3">
                  <Badge tone={STATUS_TONE[row.status]}>
                    {VISIT_STATUS_LABELS[row.status]}
                  </Badge>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
