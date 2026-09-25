"use client";

import { settlementAxis } from "@/lib/design/chart-domain";
import { linearScale } from "@/lib/design/chart-scale";
import { cn } from "@/lib/utils/cn";
import { ALERT_LEVEL_LABELS, type AlertLevel } from "@/types/settlement";
import {
  ChartSvg,
  DataTableDetails,
  FALLBACK_WIDTH,
  FONT_SIZE,
  HALO,
  SMALL_FONT_SIZE,
  TABLE_HEAD_ROW,
  TABLE_ROW,
  TABLE_TD,
  TABLE_TH,
  ThresholdLegendItems,
  ThresholdLines,
  YAxis,
  formatMm,
  pressableProps,
  textWidth,
  thresholdLabel,
  useContainerWidth,
} from "./chart-parts";
import type { ChartThresholds } from "./trend-chart";

export interface PointBar {
  pointId: string;
  label: string;
  /** mm. Null si el punto no tiene dato en esta visita: sin barra, «—». */
  value: number | null;
  level?: AlertLevel;
}

interface PointBarsChartProps {
  bars: PointBar[];
  /** Título del eje Y: «Asentamiento (mm)» o «Variación (mm)». */
  axisLabel: string;
  ariaLabel: string;
  /** Solo en la del acumulado: la variación no se compara con los umbrales. */
  thresholds?: ChartThresholds;
  selectedPointId?: string | null;
  onSelectPoint?: (pointId: string) => void;
}

/** Relleno por nivel del semáforo. El valor rotulado es el segundo canal. */
const LEVEL_FILL: Record<AlertLevel, string> = {
  normal: "fill-ink-2",
  caution: "fill-semaphore-yellow",
  alert: "fill-semaphore-orange",
  alarm: "fill-semaphore-red",
};

const PLOT_HEIGHT = 220;
const MARGIN = { top: 12, right: 12, left: 56 };
/**
 * Ancho mínimo de cada barra con su hueco. También es la zona pulsable, así
 * que no baja de 24 px; con más puntos de los que caben, la gráfica se
 * desplaza en horizontal en vez de encoger los rótulos.
 */
const MIN_BAND = 26;
const MAX_BAR_WIDTH = 36;
/** Código del punto en el eje: se recorta si es muy largo (la tabla lo da entero). */
const MAX_LABEL_CHARS = 12;

function axisText(label: string): string {
  return label.length > MAX_LABEL_CHARS ? `${label.slice(0, MAX_LABEL_CHARS - 1)}…` : label;
}

/**
 * Barra de `y0` (el 0) a `y1` (el valor), con las esquinas del extremo del
 * dato redondeadas y la base recta sobre el 0.
 */
function barPath(x: number, w: number, y0: number, y1: number): string {
  const r = Math.min(4, w / 2, Math.abs(y1 - y0));
  const dir = y1 < y0 ? 1 : -1; // hacia arriba (positivo) o hacia abajo
  return [
    `M${x},${y0}`,
    `V${y1 + dir * r}`,
    `Q${x},${y1} ${x + r},${y1}`,
    `H${x + w - r}`,
    `Q${x + w},${y1} ${x + w},${y1 + dir * r}`,
    `V${y0}`,
    "Z",
  ].join(" ");
}

function barLabel(bar: PointBar): string {
  const value = bar.value === null ? "sin dato" : `${formatMm(bar.value)} mm`;
  return `${bar.label}: ${value}${bar.level ? `, ${ALERT_LEVEL_LABELS[bar.level]}` : ""}`;
}

/**
 * Barras por punto de control (Fase 18), para la vista de la visita: el
 * acumulado (con los umbrales) o la variación desde la visita anterior. Las
 * barras parten del 0 y el descenso va hacia abajo.
 *
 * El relleno sigue el semáforo, pero cada barra lleva además su valor
 * rotulado: el color nunca es el único canal. Con un punto seleccionado, las
 * demás barras se atenúan y su código se aligera. Si se pasa `onSelectPoint`,
 * cada columna es pulsable.
 */
export function PointBarsChart({
  bars,
  axisLabel,
  ariaLabel,
  thresholds,
  selectedPointId,
  onSelectPoint,
}: PointBarsChartProps) {
  const { ref, width } = useContainerWidth();

  const available = width ?? FALLBACK_WIDTH;
  const needed = MARGIN.left + MARGIN.right + bars.length * MIN_BAND;
  const W = Math.max(available, needed);
  const plotW = W - MARGIN.left - MARGIN.right;
  const band = plotW / Math.max(1, bars.length);
  const barW = Math.min(MAX_BAR_WIDTH, band * 0.62);

  // Códigos del eje: horizontales si caben en su columna; si no, a 45°.
  const labels = bars.map((b) => axisText(b.label));
  const maxLabelW = Math.max(0, ...labels.map((l) => textWidth(l)));
  const rotateLabels = maxLabelW > band - 4;
  const bottom = rotateLabels ? Math.ceil(maxLabelW * 0.72) + 22 : 28;
  const HEIGHT = MARGIN.top + PLOT_HEIGHT + bottom;

  // Valores: sobre la punta de la barra; girados si no caben a lo ancho. El
  // eje reserva su sitio para que no se salgan del dibujo.
  const valueTexts = bars.map((b) => (b.value === null ? "—" : formatMm(b.value)));
  const maxValueW = Math.max(0, ...valueTexts.map((t) => textWidth(t, SMALL_FONT_SIZE)));
  const rotateValues = maxValueW > band - 4;
  const valueRoom = rotateValues ? maxValueW + 8 : SMALL_FONT_SIZE + 6;
  const hasBelow = bars.some((b) => b.value !== null && b.value < 0);
  const hasAbove = bars.some((b) => b.value === null || b.value >= 0);
  const padBottom = hasBelow ? valueRoom : 6;
  const padTop = hasAbove ? valueRoom : 6;

  const values = bars.map((b) => b.value).filter((v): v is number => v !== null);
  const axis = settlementAxis(values, thresholds, Math.max(3, Math.round(PLOT_HEIGHT / 55)));
  const yScale = linearScale(axis.domain, [PLOT_HEIGHT - padBottom, padTop]);
  const y0 = yScale(0);

  const hasSelection = selectedPointId !== undefined && selectedPointId !== null;
  const isMuted = (bar: PointBar) => hasSelection && bar.pointId !== selectedPointId;

  if (bars.length === 0) {
    return <p className="text-sm text-ink-2">No hay puntos para dibujar.</p>;
  }

  return (
    <div ref={ref} className="flex min-w-0 flex-col gap-3">
      <div className="overflow-x-auto">
        <ChartSvg
          width={W}
          height={HEIGHT}
          ariaLabel={
            axis.thresholds.length > 0
              ? `${ariaLabel} Umbrales dibujados: ${axis.thresholds.map(thresholdLabel).join(", ")}.`
              : ariaLabel
          }
          minWidth={needed > available ? W : undefined}
          overlayLabel="Puntos: pulsa una barra para seleccionar el punto"
          overlay={
            onSelectPoint ? (
              <g transform={`translate(${MARGIN.left},${MARGIN.top})`}>
                {bars.map((bar, i) => (
                  <g
                    key={bar.pointId}
                    {...pressableProps(barLabel(bar), () => onSelectPoint(bar.pointId))}
                    aria-pressed={selectedPointId === undefined ? undefined : bar.pointId === selectedPointId}
                    className="group cursor-pointer outline-none"
                  >
                    {/* La columna entera, con su código, es la zona pulsable */}
                    <rect
                      x={band * i}
                      y={0}
                      width={band}
                      height={PLOT_HEIGHT + bottom - 4}
                      className="fill-transparent group-hover:fill-sel"
                    />
                    <rect
                      x={band * i + 1}
                      y={1}
                      width={band - 2}
                      height={PLOT_HEIGHT + bottom - 6}
                      rx={4}
                      fill="none"
                      strokeWidth={2}
                      className="stroke-mira-strong opacity-0 group-focus-visible:opacity-100"
                    />
                  </g>
                ))}
              </g>
            ) : undefined
          }
        >
          <g transform={`translate(${MARGIN.left},${MARGIN.top})`}>
            <YAxis
              ticks={axis.ticks}
              yScale={yScale}
              plotWidth={plotW}
              plotHeight={PLOT_HEIGHT}
              marginLeft={MARGIN.left}
              title={axisLabel}
            />

            {bars.map((bar, i) => {
              if (bar.value === null) return null;
              const y1 = yScale(bar.value);
              if (Math.abs(y1 - y0) < 0.5) return null;
              const x = band * i + (band - barW) / 2;
              return (
                <path
                  key={bar.pointId}
                  d={barPath(x, barW, y0, y1)}
                  className={isMuted(bar) ? "fill-rule-strong" : LEVEL_FILL[bar.level ?? "normal"]}
                />
              );
            })}

            {/* El 0 otra vez, encima de las bases de las barras */}
            <line x1={0} x2={plotW} y1={y0} y2={y0} strokeWidth={1.5} className="stroke-rule-strong" />

            {/* Sin rótulos en la línea: chocarían con los valores de las
                barras. Van en la leyenda de abajo. */}
            <ThresholdLines
              thresholds={axis.thresholds}
              yScale={yScale}
              plotWidth={plotW}
              plotHeight={PLOT_HEIGHT}
              showLabels={false}
            />

            {/* Valor de cada barra, más allá de su punta */}
            {bars.map((bar, i) => {
              const cx = band * i + band / 2;
              const text = valueTexts[i] ?? "—";
              const muted = isMuted(bar);
              const fill = muted ? "fill-ink-3" : "fill-ink";
              const below = bar.value !== null && bar.value < 0;
              const tip = bar.value === null ? y0 : yScale(bar.value);
              // «—» no se gira: es un solo carácter y girado parecería una barra.
              if (!rotateValues || bar.value === null) {
                return (
                  <text
                    key={bar.pointId}
                    x={cx}
                    y={below ? tip + SMALL_FONT_SIZE + 3 : tip - 4}
                    textAnchor="middle"
                    fontSize={SMALL_FONT_SIZE}
                    className={cn("tabular-nums", fill)}
                    {...HALO}
                  >
                    {text}
                  </text>
                );
              }
              return (
                <text
                  key={bar.pointId}
                  transform={`translate(${cx + SMALL_FONT_SIZE * 0.35},${below ? tip + 4 : tip - 4}) rotate(-90)`}
                  textAnchor={below ? "end" : "start"}
                  fontSize={SMALL_FONT_SIZE}
                  className={cn("tabular-nums", fill)}
                  {...HALO}
                >
                  {text}
                </text>
              );
            })}

            {/* Códigos de los puntos bajo el dibujo */}
            {bars.map((bar, i) => {
              const cx = band * i + band / 2;
              const selected = hasSelection && bar.pointId === selectedPointId;
              const className = cn(
                selected ? "fill-ink" : isMuted(bar) ? "fill-ink-3" : "fill-ink-2",
              );
              return rotateLabels ? (
                <text
                  key={bar.pointId}
                  transform={`translate(${cx + 4},${PLOT_HEIGHT + 12}) rotate(-45)`}
                  textAnchor="end"
                  fontSize={FONT_SIZE}
                  fontWeight={selected ? 600 : 400}
                  className={className}
                >
                  {labels[i]}
                </text>
              ) : (
                <text
                  key={bar.pointId}
                  x={cx}
                  y={PLOT_HEIGHT + 18}
                  textAnchor="middle"
                  fontSize={FONT_SIZE}
                  fontWeight={selected ? 600 : 400}
                  className={className}
                >
                  {labels[i]}
                </text>
              );
            })}
          </g>
        </ChartSvg>
      </div>

      {axis.thresholds.length > 0 && (
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink-2">
          <ThresholdLegendItems thresholds={axis.thresholds} />
        </ul>
      )}

      <DataTableDetails caption={`${axisLabel} por punto de control`}>
        <thead>
          <tr className={TABLE_HEAD_ROW}>
            <th className={TABLE_TH}>Punto</th>
            <th className={TABLE_TH}>{axisLabel}</th>
            <th className={TABLE_TH}>Nivel</th>
          </tr>
        </thead>
        <tbody>
          {bars.map((bar) => (
            <tr key={bar.pointId} className={TABLE_ROW}>
              <td className={TABLE_TD}>{bar.label}</td>
              <td className={TABLE_TD}>{bar.value === null ? "—" : formatMm(bar.value)}</td>
              <td className={TABLE_TD}>{bar.level ? ALERT_LEVEL_LABELS[bar.level] : "—"}</td>
            </tr>
          ))}
        </tbody>
      </DataTableDetails>
    </div>
  );
}
