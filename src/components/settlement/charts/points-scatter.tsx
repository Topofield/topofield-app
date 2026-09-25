"use client";

import { useState } from "react";
import { Alert } from "@/components/design-system";
import { settlementAxis } from "@/lib/design/chart-domain";
import { isoDay, linearScale, niceTicks } from "@/lib/design/chart-scale";
import {
  MAX_DISTINGUISHABLE_SERIES,
  seriesStyle,
} from "@/lib/design/series-markers";
import { cn } from "@/lib/utils/cn";
import {
  ChartSvg,
  DataTableDetails,
  FALLBACK_WIDTH,
  Marker,
  TABLE_HEAD_ROW,
  TABLE_ROW,
  TABLE_TD,
  TABLE_TH,
  ThresholdLines,
  XAxis,
  YAxis,
  formatMm,
  shortDate,
  useContainerWidth,
} from "./chart-parts";
import type { ChartThresholds } from "./trend-chart";

export interface ScatterSeries {
  pointId: string;
  /** Código del punto; puede llevar «(de baja)» o «(alta 3 mar 2025)». */
  label: string;
  /** Acumulado (mm) por fecha ISO `YYYY-MM-DD`. */
  values: { date: string; value: number }[];
}

interface PointsScatterProps {
  series: ScatterSeries[];
  /** Fecha de la lectura base: el día 0 del eje X. */
  baseDate: string;
  thresholds: ChartThresholds;
}

const HEIGHT = 320;
const MARGIN = { top: 12, right: 12, bottom: 48, left: 56 };
const PAD_X = 8;
const MARKER_R = 5;
const MUTED_R = 3.5;

function byDate(a: { date: string }, b: { date: string }): number {
  return a.date < b.date ? -1 : a.date > b.date ? 1 : 0;
}

/** Último acumulado de la serie por fecha, o null si no tiene lecturas. */
function lastValue(series: ScatterSeries): number | null {
  return [...series.values].sort(byDate).at(-1)?.value ?? null;
}

/**
 * Evolución por punto (Fase 18): el acumulado de cada punto de control como
 * marcadores, con los días desde la lectura base en el eje X. Sustituye a
 * `settlement-chart.tsx` en el panel.
 *
 * Cada serie lleva la forma y el color de `seriesStyle`; la forma distingue y
 * el color solo refuerza. Los chips hacen de leyenda y resaltan un punto: sus
 * marcadores se unen con una línea en orden de fecha y los demás se atenúan.
 * La tabla plegada repite los datos en texto.
 */
export function PointsScatter({ series, baseDate, thresholds }: PointsScatterProps) {
  const { ref, width } = useContainerWidth();
  // Punto resaltado: estado legítimo, lo elige el usuario con los chips.
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Si el punto resaltado deja de estar en las series, se vuelve a «Todos».
  const active = series.some((s) => s.pointId === selectedId) ? selectedId : null;

  const W = width ?? FALLBACK_WIDTH;
  const plotW = W - MARGIN.left - MARGIN.right;
  const plotH = HEIGHT - MARGIN.top - MARGIN.bottom;

  const base = isoDay(baseDate);
  const daysOf = (date: string) => isoDay(date) - base;

  const styled = series.map((s, index) => ({
    ...s,
    ...seriesStyle(index),
    sorted: [...s.values].sort(byDate),
  }));
  const allValues = series.flatMap((s) => s.values.map((v) => v.value));
  const allDays = series.flatMap((s) => s.values.map((v) => daysOf(v.date)));
  const hasData = allValues.length > 0;

  const axis = settlementAxis(allValues, thresholds, Math.max(3, Math.round(plotH / 55)));
  const yScale = linearScale(axis.domain, [plotH, 0]);

  // Eje X numérico, de 0 (o antes, si algo precede a la base) a un número
  // redondo de días. Con solo la base, al menos 1 día para no degenerar. Con
  // pocos días el paso sale fraccionario: se rotulan solo los días enteros.
  const xTicksAll = niceTicks(
    Math.min(0, ...allDays),
    Math.max(1, ...allDays),
    Math.max(2, Math.floor(plotW / 70)),
  );
  const xTicks = xTicksAll.filter((d) => Number.isInteger(d));
  const xScale = linearScale(
    [xTicksAll[0] ?? 0, xTicksAll[xTicksAll.length - 1] ?? 1],
    [PAD_X, plotW - PAD_X],
  );

  const activeSeries = styled.find((s) => s.pointId === active) ?? null;
  const ariaLabel = hasData
    ? `Asentamiento acumulado en milímetros de ${series.length} punto(s) de control según los días desde la lectura base del ${shortDate(baseDate)}: ${series.map((s) => s.label).join(", ")}.` +
      (activeSeries ? ` Resaltado: ${activeSeries.label}.` : "")
    : "Gráfica de evolución por punto sin lecturas suficientes para dibujarse.";

  const chip = (pressed: boolean) =>
    cn(
      "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm transition-colors motion-reduce:transition-none",
      pressed
        ? "border-mira-strong bg-sel text-ink"
        : "border-rule bg-card text-ink-2 hover:bg-paper",
    );

  if (series.length === 0) {
    return <p className="text-sm text-ink-2">El catálogo todavía no tiene puntos.</p>;
  }

  return (
    <div ref={ref} className="flex min-w-0 flex-col gap-3">
      {/* Chips: leyenda (forma, color, código y último valor) y selector */}
      <div role="group" aria-label="Resaltar un punto" className="flex flex-wrap gap-2">
        <button
          type="button"
          aria-pressed={active === null}
          onClick={() => setSelectedId(null)}
          className={chip(active === null)}
        >
          Todos
        </button>
        {styled.map((s) => {
          const last = lastValue(s);
          const pressed = active === s.pointId;
          return (
            <button
              key={s.pointId}
              type="button"
              aria-pressed={pressed}
              onClick={() => setSelectedId(pressed ? null : s.pointId)}
              className={chip(pressed)}
            >
              <svg width={14} height={14} aria-hidden className="shrink-0">
                <Marker shape={s.shape} cx={7} cy={7} color={s.color} />
              </svg>
              <span>{s.label}</span>
              <span className="tabular-nums text-ink-2">
                {last === null ? "—" : `${formatMm(last)} mm`}
              </span>
            </button>
          );
        })}
      </div>

      {series.length > MAX_DISTINGUISHABLE_SERIES && (
        <Alert variant="warning">
          Hay {series.length} puntos: a partir de {MAX_DISTINGUISHABLE_SERIES + 1}{" "}
          algunas series repiten forma y color a la vez y dejan de distinguirse
          con claridad. Resalta un punto con los chips, o usa la tabla para leer
          los valores exactos.
        </Alert>
      )}

      {!hasData ? (
        <p className="text-sm text-ink-2">
          Todavía no hay lecturas para dibujar la gráfica.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <ChartSvg width={W} height={HEIGHT} ariaLabel={ariaLabel}>
            <g transform={`translate(${MARGIN.left},${MARGIN.top})`}>
              <YAxis
                ticks={axis.ticks}
                yScale={yScale}
                plotWidth={plotW}
                plotHeight={plotH}
                marginLeft={MARGIN.left}
                title="Asentamiento (mm)"
              />
              <XAxis
                ticks={xTicks.map((d) => ({ x: xScale(d), label: d.toLocaleString("es-CO") }))}
                plotWidth={plotW}
                plotHeight={plotH}
                title="Días desde la lectura base"
              />
              <ThresholdLines
                thresholds={axis.thresholds}
                yScale={yScale}
                plotWidth={plotW}
                plotHeight={plotH}
              />

              {/* Atenuadas primero, para que la resaltada quede encima */}
              {activeSeries && (
                <g className="text-ink-3">
                  {styled
                    .filter((s) => s.pointId !== active)
                    .map((s) =>
                      s.sorted.map((v) => (
                        <Marker
                          key={`${s.pointId}-${v.date}`}
                          shape={s.shape}
                          cx={xScale(daysOf(v.date))}
                          cy={yScale(v.value)}
                          r={MUTED_R}
                          color="currentColor"
                        />
                      )),
                    )}
                </g>
              )}

              {(activeSeries ? [activeSeries] : styled).map((s) => (
                <g key={s.pointId}>
                  {activeSeries && s.sorted.length > 1 && (
                    <polyline
                      points={s.sorted
                        .map((v) => `${xScale(daysOf(v.date))},${yScale(v.value)}`)
                        .join(" ")}
                      fill="none"
                      stroke={s.color}
                      strokeWidth={1.5}
                      strokeLinejoin="round"
                    />
                  )}
                  {s.sorted.map((v) => (
                    <Marker
                      key={v.date}
                      shape={s.shape}
                      cx={xScale(daysOf(v.date))}
                      cy={yScale(v.value)}
                      r={MARKER_R}
                      color={s.color}
                    />
                  ))}
                </g>
              ))}
            </g>
          </ChartSvg>
        </div>
      )}

      <DataTableDetails caption="Asentamiento acumulado en milímetros por punto y fecha">
        <thead>
          <tr className={TABLE_HEAD_ROW}>
            <th className={TABLE_TH}>Punto</th>
            <th className={TABLE_TH}>Fecha</th>
            <th className={TABLE_TH}>Días</th>
            <th className={TABLE_TH}>Acumulado (mm)</th>
          </tr>
        </thead>
        <tbody>
          {styled.flatMap((s) =>
            s.sorted.length === 0
              ? [
                  <tr key={s.pointId} className={TABLE_ROW}>
                    <td className={TABLE_TD}>{s.label}</td>
                    <td className={TABLE_TD}>—</td>
                    <td className={TABLE_TD}>—</td>
                    <td className={TABLE_TD}>—</td>
                  </tr>,
                ]
              : s.sorted.map((v) => (
                  <tr key={`${s.pointId}-${v.date}`} className={TABLE_ROW}>
                    <td className={TABLE_TD}>{s.label}</td>
                    <td className={TABLE_TD}>{shortDate(v.date)}</td>
                    <td className={TABLE_TD}>{daysOf(v.date).toLocaleString("es-CO")}</td>
                    <td className={TABLE_TD}>{formatMm(v.value)}</td>
                  </tr>
                )),
          )}
        </tbody>
      </DataTableDetails>
    </div>
  );
}
