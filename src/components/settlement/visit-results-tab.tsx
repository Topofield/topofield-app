"use client";

import { useState } from "react";
import { Card, StatusIndicator } from "@/components/design-system";
import { cn } from "@/lib/utils/cn";
import { formatSignedMm } from "@/lib/utils/format";
import { ALERT_LEVEL_LABELS } from "@/types/settlement";
import { PointBarsChart } from "./charts/point-bars-chart";
import type { ChartThresholds } from "./charts/trend-chart";
import { Kpi } from "./site-panel";
import type { VisitResults } from "./visit-results";

const TREND_LABELS = { converging: "Converge", accelerating: "Acelera" } as const;

/** «A», «A y B», «N puntos». */
function who(codes: string[]): string {
  if (codes.length > 2) return `${codes.length} puntos`;
  return codes.join(" y ");
}

/**
 * Paso 2 · Resultados de la visita (Fase 37, decisión 20, lienzo
 * «Resultados»): la franja de indicadores, la nota de la visita y, por punto,
 * cota, parcial, acumulado, velocidad, estado y tendencia; fijo al lado, el
 * gráfico «Acumulado | Desde la anterior».
 */
export function VisitResultsTab({
  results,
  note,
  thresholds,
}: {
  results: VisitResults;
  note: string | null;
  thresholds: ChartThresholds;
}) {
  const [view, setView] = useState<"accumulated" | "partial">("accumulated");
  const { max, mean, move, alert, rows } = results;

  if (rows.length === 0) {
    return (
      <p className="rounded-lg border border-rule bg-card px-5 py-4 text-sm text-ink-2 shadow-sm">
        La visita todavía no tiene puntos leídos: sus resultados salen de la libreta.
      </p>
    );
  }

  const bars = rows.map((r) => ({
    pointId: r.pointId,
    label: r.code,
    value: view === "accumulated" ? r.accumulated : r.partial,
    level: view === "accumulated" ? r.alert : undefined,
  }));

  return (
    <div className="flex flex-col gap-4">
      <section className="flex flex-wrap gap-x-8 gap-y-3 rounded-lg border border-rule bg-card px-5 py-4 shadow-sm">
        <Kpi
          label="Asentamiento máximo"
          value={max ? formatSignedMm(max.value) : "—"}
          unit={max ? `mm · ${who(max.codes)}` : undefined}
        />
        <Kpi
          label="Promedio"
          value={mean ? formatSignedMm(mean.value) : "—"}
          unit={
            mean
              ? mean.change != null
                ? `mm · ${formatSignedMm(mean.change)} frente a la visita ${mean.previousNumber}`
                : "mm · la base"
              : undefined
          }
        />
        <Kpi
          label="Mayor movimiento"
          value={move ? formatSignedMm(move.value) : "—"}
          unit={move ? `mm · ${who(move.codes)}${move.days != null ? ` en ${move.days} días` : ""}` : undefined}
        />
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="text-xs text-ink-2">Alerta</span>
          <span className="flex items-center gap-2 text-sm">
            <StatusIndicator level={alert.level} label={ALERT_LEVEL_LABELS[alert.level]} />
            <span className="text-ink-2">
              · {alert.count} de {alert.total} en precaución o más
            </span>
          </span>
        </div>
      </section>

      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[3fr_2fr]">
        <div className="flex min-w-0 flex-col gap-4">
          <Card title="Nota de la visita">
            <p className={cn("text-sm", !note && "text-ink-2")}>
              {note ?? "Sin nota. Se escribe en «Editar datos»."}
            </p>
          </Card>
          <Card title="Puntos de control">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-rule text-left text-ink-2">
                    <th scope="col" className="py-2 pr-3 font-medium">Punto</th>
                    <th scope="col" className="py-2 pr-3 text-right font-medium">Cota (m)</th>
                    <th scope="col" className="py-2 pr-3 text-right font-medium">Parcial (mm)</th>
                    <th scope="col" className="py-2 pr-3 text-right font-medium">Acumulado (mm)</th>
                    <th scope="col" className="py-2 pr-3 text-right font-medium">Velocidad (mm/mes)</th>
                    <th scope="col" className="py-2 pr-3 font-medium">Estado</th>
                    <th scope="col" className="py-2 font-medium">Tendencia</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.pointId} className="border-b border-rule last:border-b-0">
                      <td className="py-2 pr-3 font-semibold whitespace-nowrap">{r.code}</td>
                      <td className="py-2 pr-3 text-right font-mono tabular-nums">{r.elevation.toFixed(4)}</td>
                      <td className="py-2 pr-3 text-right font-mono tabular-nums">
                        {r.partial == null ? "—" : formatSignedMm(r.partial)}
                      </td>
                      <td className="py-2 pr-3 text-right font-mono tabular-nums">
                        {r.accumulated == null ? "—" : formatSignedMm(r.accumulated)}
                      </td>
                      <td className="py-2 pr-3 text-right font-mono tabular-nums">
                        {r.velocity == null ? "—" : r.velocity.toFixed(2)}
                      </td>
                      <td className="py-2 pr-3 whitespace-nowrap">
                        <StatusIndicator level={r.alert} label={ALERT_LEVEL_LABELS[r.alert]} />
                      </td>
                      <td className="py-2 whitespace-nowrap text-ink-2">{r.trend ? TREND_LABELS[r.trend] : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>

        <div className="min-w-0 lg:sticky lg:top-[calc(var(--barra-alto)+1rem)]">
          <Card
            title={view === "accumulated" ? "Acumulado por punto" : "Movimiento desde la anterior"}
            actions={
              <div role="group" aria-label="Gráfico" className="inline-flex overflow-hidden rounded-md border border-rule-strong">
                {(
                  [
                    ["accumulated", "Acumulado"],
                    ["partial", "Desde la anterior"],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    aria-pressed={view === id}
                    onClick={() => setView(id)}
                    className={cn(
                      "min-h-9 border-r border-rule px-3 text-sm font-medium last:border-r-0",
                      view === id ? "bg-mira-bg text-mira-ink" : "text-ink-2 hover:bg-sel",
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            }
          >
            <PointBarsChart
              bars={bars}
              axisLabel={view === "accumulated" ? "Asentamiento (mm)" : "Variación (mm)"}
              ariaLabel={view === "accumulated" ? "Acumulado de cada punto" : "Movimiento de cada punto desde la visita anterior"}
              thresholds={view === "accumulated" ? thresholds : undefined}
            />
          </Card>
        </div>
      </div>
    </div>
  );
}
