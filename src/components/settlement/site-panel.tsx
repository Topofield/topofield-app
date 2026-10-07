"use client";

import { useState } from "react";
import { Card, EmptyState, StatusIndicator } from "@/components/design-system";
import type { SiteSummary } from "@/lib/calculations/settlement-summary";
import { cn } from "@/lib/utils/cn";
import { formatSignedMm } from "@/lib/utils/format";
import type { Thresholds } from "@/types/settlement";
import { PointsScatter, type ScatterSeries } from "./charts/points-scatter";
import { TrendChart, type ChartThresholds, type TrendVisit } from "./charts/trend-chart";
import { VisitsTable, type VisitTableRow } from "./visits-table";

interface SitePanelProps {
  summary: SiteSummary;
  /** Código de cada punto, por id. */
  codes: Record<string, string>;
  thresholds: Thresholds;
  rows: VisitTableRow[];
  hrefBase: string;
  trendVisits: TrendVisit[];
  scatterSeries: ScatterSeries[];
  chartThresholds: ChartThresholds;
  /** Los avisos de tendencia de todas las visitas, ya redactados. */
  warnings: { id: string; title: string; text: string }[];
  /** Los puntos normales de la última visita y los tres más asentados. */
  lastVisitNote: string | null;
}

/** Un indicador de la franja: rótulo, valor y su detalle. */
function Kpi({ label, value, unit, hint }: { label: string; value: string; unit?: string; hint?: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <span className="text-xs text-ink-2">{label}</span>
      <span className="font-mono text-lg font-semibold tabular-nums">
        {value}
        {unit && <span className="ml-1 font-sans text-sm font-normal text-ink-2">{unit}</span>}
      </span>
      {hint && <span className="text-xs text-ink-2">{hint}</span>}
    </div>
  );
}

/**
 * El panel del lugar (Fase 37, lienzo «Lugar B»): los indicadores en una
 * franja, la tabla de visitas y, fija al lado, la tendencia. Elegir una visita
 * la resalta en la tendencia; su enlace la abre. El semáforo completo de cada
 * punto vive en los Resultados de la visita.
 */
export function SitePanel({
  summary,
  codes,
  thresholds,
  rows,
  hrefBase,
  trendVisits,
  scatterSeries,
  chartThresholds,
  warnings,
  lastVisitNote,
}: SitePanelProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const [view, setView] = useState<"mean" | "points">("mean");
  const last = summary.latest;
  const code = (id: string | undefined) => (id ? (codes[id] ?? "—") : "—");
  const hasReadings = trendVisits.some((v) => v.mean !== null);

  return (
    <div className="flex flex-col gap-4">
      <section className="flex flex-wrap gap-x-8 gap-y-3 rounded-lg border border-rule bg-card px-5 py-4 shadow-sm">
        <Kpi
          label="Asentamiento máximo"
          value={last?.maxSettlement ? formatSignedMm(last.maxSettlement.value) : "—"}
          unit={last?.maxSettlement ? `mm · ${code(last.maxSettlement.pointId)}` : undefined}
        />
        <Kpi label="Promedio actual" value={last?.mean != null ? formatSignedMm(last.mean) : "—"} unit="mm" />
        <Kpi
          label="Velocidad máxima"
          value={last?.maxVelocity ? last.maxVelocity.value.toFixed(2) : "—"}
          unit={last?.maxVelocity ? `mm/mes · ${code(last.maxVelocity.pointId)}` : undefined}
        />
        <Kpi label="Visitas en alerta" value={String(summary.visitsInAlert)} unit={`de ${summary.visits.length}`} />
        <Kpi
          label="Umbrales"
          value={`${thresholds.accumulatedCaution} · ${thresholds.accumulatedAlert} · ${thresholds.accumulatedAlarm}`}
          unit={`mm · ${thresholds.velocityCaution} · ${thresholds.velocityAlert} · ${thresholds.velocityAlarm} mm/mes`}
        />
      </section>

      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[3fr_2fr]">
        <div className="flex min-w-0 flex-col gap-4">
          <Card title="Visitas" description="Elige una para resaltarla en la tendencia; ábrela para ver sus lecturas.">
            <VisitsTable rows={rows} hrefBase={hrefBase} selectedId={selected} onSelect={setSelected} />
          </Card>
          {warnings.length > 0 && (
            <Card title="Avisos">
              <ul className="flex flex-col gap-2 text-sm">
                {warnings.map((w) => (
                  <li key={w.id}>
                    <strong>{w.title}:</strong> {w.text}
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>

        <aside className="min-w-0 lg:sticky lg:top-[calc(var(--barra-alto)+1rem)]">
          <Card
            title={view === "mean" ? "Tendencia" : "Evolución por punto"}
            actions={
              <div role="group" aria-label="Qué se dibuja" className="inline-flex overflow-hidden rounded-md border border-rule-strong">
                {(
                  [
                    ["mean", "Promedio"],
                    ["points", "Por punto"],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    aria-pressed={view === id}
                    onClick={() => setView(id)}
                    className={cn(
                      "min-h-9 px-3 text-sm font-medium",
                      view === id ? "bg-mira-bg text-mira-strong" : "text-ink-2 hover:bg-sel",
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            }
          >
            {!hasReadings ? (
              <EmptyState title="Todavía no hay lecturas" description="La tendencia se dibuja con las visitas que ya tienen cotas." />
            ) : view === "mean" ? (
              <TrendChart visits={trendVisits} thresholds={chartThresholds} highlightId={selected} />
            ) : summary.baseDate ? (
              <PointsScatter series={scatterSeries} baseDate={summary.baseDate} thresholds={chartThresholds} />
            ) : null}
            {lastVisitNote && (
              <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-rule pt-3 text-sm text-ink-2">
                <StatusIndicator level={last?.worstAlert ?? "normal"} label={lastVisitNote} />
              </div>
            )}
          </Card>
        </aside>
      </div>
    </div>
  );
}
