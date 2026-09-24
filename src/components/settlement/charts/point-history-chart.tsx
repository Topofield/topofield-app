"use client";

import { settlementAxis } from "@/lib/design/chart-domain";
import { linearScale, timeScale, timeTicks } from "@/lib/design/chart-scale";
import { seriesStyle } from "@/lib/design/series-markers";
import { cn } from "@/lib/utils/cn";
import {
  ChartSvg,
  DataTableDetails,
  FALLBACK_WIDTH,
  HaloText,
  Marker,
  SMALL_FONT_SIZE,
  TABLE_HEAD_ROW,
  TABLE_ROW,
  TABLE_TD,
  TABLE_TH,
  ThresholdLines,
  XAxis,
  YAxis,
  formatMm,
  shortDate,
  thresholdLabel,
  timeTickLabels,
  useContainerWidth,
} from "./chart-parts";
import type { ChartThresholds } from "./trend-chart";

interface PointHistoryChartProps {
  /** Código del punto, con sus marcas de baja o alta si las tiene. */
  label: string;
  /** Acumulado (mm) por fecha, en orden cronológico, hasta la visita actual. */
  values: { date: string; value: number }[];
  /** Fecha de la visita que se está viendo: su lectura se resalta. */
  currentDate: string;
  /** Índice de la serie del punto, para usar su mismo marcador que en el panel. */
  seriesIndex: number;
  thresholds: ChartThresholds;
}

const HEIGHT = 220;
const MARGIN = { top: 12, right: 12, bottom: 30, left: 52 };
const PAD_X = 12;

/**
 * Historial de un punto de control hasta la visita que se está viendo (Fase
 * 18), para el panel lateral de la vista de la visita: el acumulado en el
 * tiempo, con el marcador de su serie, las líneas de los umbrales y la
 * lectura de esta visita resaltada con su valor.
 */
export function PointHistoryChart({
  label,
  values,
  currentDate,
  seriesIndex,
  thresholds,
}: PointHistoryChartProps) {
  const { ref, width } = useContainerWidth();

  const W = width ?? FALLBACK_WIDTH;
  const plotW = W - MARGIN.left - MARGIN.right;
  const plotH = HEIGHT - MARGIN.top - MARGIN.bottom;

  const { shape, color } = seriesStyle(seriesIndex);
  const sorted = [...values].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  const current = sorted.find((v) => v.date === currentDate) ?? null;

  const axis = settlementAxis(
    sorted.map((v) => v.value),
    thresholds,
    Math.max(3, Math.round(plotH / 50)),
  );
  const yScale = linearScale(axis.domain, [plotH, 0]);

  // El eje llega hasta la visita actual aunque el punto no tenga lectura en
  // ella (de baja): así se ve desde cuándo no se mide.
  const dates = [...sorted.map((v) => v.date), currentDate];
  const first = dates.reduce((a, b) => (b < a ? b : a));
  const last = dates.reduce((a, b) => (b > a ? b : a));
  const xScale = timeScale(dates, [PAD_X, plotW - PAD_X]);
  const ticks = timeTicks(first, last, Math.max(2, Math.floor(plotW / 110)));
  const tickLabels = timeTickLabels(ticks);

  const points = sorted.map((v) => ({ ...v, x: xScale(v.date), y: yScale(v.value) }));

  const ariaLabel =
    sorted.length === 0
      ? `Historial de ${label} sin lecturas para dibujarse.`
      : `Historial del asentamiento acumulado de ${label} en milímetros: ${sorted.length} lectura(s) del ${shortDate(sorted[0]?.date ?? first)} al ${shortDate(sorted[sorted.length - 1]?.date ?? last)}` +
        (current
          ? `; en esta visita, el ${shortDate(currentDate)}, ${formatMm(current.value)} mm.`
          : `; sin lectura en esta visita, el ${shortDate(currentDate)}.`) +
        (axis.thresholds.length > 0
          ? ` Umbrales dibujados: ${axis.thresholds.map(thresholdLabel).join(", ")}.`
          : "");

  // Rótulo del valor actual: hacia el lado con más sitio en horizontal, y en
  // vertical al lado contrario del tramo que llega (si el punto viene de más
  // arriba, debajo), para no pisar la línea ni el marcador anterior. Si ahí
  // se sale del dibujo, al otro lado.
  const currentIndex = points.findIndex((p) => p.date === currentDate);
  const currentPoint = points[currentIndex] ?? null;
  const previousPoint = currentIndex > 0 ? points[currentIndex - 1] : undefined;
  const labelRight = currentPoint ? currentPoint.x < plotW / 2 : false;
  const above = (currentPoint?.y ?? 0) - 14;
  const below = (currentPoint?.y ?? 0) + 14 + SMALL_FONT_SIZE;
  const preferBelow = previousPoint !== undefined && currentPoint !== null && previousPoint.y < currentPoint.y;
  const labelY = preferBelow
    ? below <= plotH - 2 ? below : above
    : above >= SMALL_FONT_SIZE ? above : below;

  return (
    <div ref={ref} className="flex min-w-0 flex-col gap-3">
      {sorted.length === 0 ? (
        <p className="text-sm text-neutral-500">
          Este punto todavía no tiene lecturas para dibujar su historial.
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
                title="Acumulado (mm)"
              />
              <XAxis
                ticks={ticks.map((t, i) => ({ x: xScale(t), label: tickLabels[i] ?? t }))}
                plotWidth={plotW}
                plotHeight={plotH}
              />

              {/* Guía vertical en la fecha de esta visita */}
              <line
                x1={xScale(currentDate)}
                x2={xScale(currentDate)}
                y1={0}
                y2={plotH}
                strokeWidth={1}
                className="stroke-neutral-200"
              />

              <ThresholdLines
                thresholds={axis.thresholds}
                yScale={yScale}
                plotWidth={plotW}
                plotHeight={plotH}
              />

              {points.length > 1 && (
                <polyline
                  points={points.map((p) => `${p.x},${p.y}`).join(" ")}
                  fill="none"
                  stroke={color}
                  strokeWidth={2}
                  strokeLinejoin="round"
                />
              )}
              {points.map((p) =>
                p.date === currentDate ? null : (
                  <Marker key={p.date} shape={shape} cx={p.x} cy={p.y} r={4.5} color={color} />
                ),
              )}

              {/* Lectura de esta visita: marcador mayor, con anillo y su valor */}
              {currentPoint && (
                <g>
                  <circle
                    cx={currentPoint.x}
                    cy={currentPoint.y}
                    r={11}
                    fill="white"
                    stroke={color}
                    strokeWidth={1.5}
                  />
                  <Marker shape={shape} cx={currentPoint.x} cy={currentPoint.y} r={7} color={color} />
                  <HaloText
                    x={currentPoint.x + (labelRight ? 14 : -14)}
                    y={labelY}
                    textAnchor={labelRight ? "start" : "end"}
                    fontWeight={600}
                    className="fill-neutral-900"
                  >
                    {formatMm(currentPoint.value)} mm
                  </HaloText>
                </g>
              )}
            </g>
          </ChartSvg>
        </div>
      )}

      <DataTableDetails caption={`Asentamiento acumulado de ${label} en milímetros por fecha`}>
        <thead>
          <tr className={TABLE_HEAD_ROW}>
            <th className={TABLE_TH}>Fecha</th>
            <th className={TABLE_TH}>Acumulado (mm)</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((v) => {
            const isCurrent = v.date === currentDate;
            const td = cn(TABLE_TD, isCurrent && "font-medium text-neutral-900");
            return (
              <tr key={v.date} className={TABLE_ROW}>
                <td className={td}>
                  {shortDate(v.date)}
                  {isCurrent && " (esta visita)"}
                </td>
                <td className={td}>
                  {formatMm(v.value)}
                </td>
              </tr>
            );
          })}
          {sorted.length === 0 && (
            <tr>
              <td className="py-4 text-center text-neutral-500" colSpan={2}>
                Sin lecturas registradas.
              </td>
            </tr>
          )}
        </tbody>
      </DataTableDetails>
    </div>
  );
}
