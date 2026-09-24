"use client";

import { useState } from "react";
import { settlementAxis, type ThresholdMagnitudes } from "@/lib/design/chart-domain";
import { linearScale, timeScale, timeTicks } from "@/lib/design/chart-scale";
import {
  ChartSvg,
  DataTableDetails,
  FALLBACK_WIDTH,
  FONT_SIZE,
  TABLE_HEAD_ROW,
  TABLE_ROW,
  TABLE_TD,
  TABLE_TH,
  ThresholdLegendItems,
  ThresholdLines,
  XAxis,
  YAxis,
  formatMm,
  pressableProps,
  shortDate,
  textWidth,
  thresholdLabel,
  timeTickLabels,
  useContainerWidth,
} from "./chart-parts";

/**
 * Umbrales de acumulado del lugar como magnitudes positivas (mm). Las
 * gráficas los dibujan en negativo: precaución en −caution, etc.
 */
export type ChartThresholds = ThresholdMagnitudes;

export interface TrendVisit {
  visitId: string;
  /** «Visita 3», o «Visita 0 (base)». */
  label: string;
  /** ISO `YYYY-MM-DD`. */
  date: string;
  /** Acumulado promedio de la visita (mm). Null si no tiene lecturas. */
  mean: number | null;
  /** Acumulado más negativo (el punto más hundido). */
  min: number | null;
  /** Acumulado menos negativo, o el mayor levantamiento. */
  max: number | null;
}

interface TrendChartProps {
  /** En orden cronológico. */
  visits: TrendVisit[];
  thresholds: ChartThresholds;
  /** Si se pasa, cada visita es pulsable y la abre. */
  onSelectVisit?: (visitId: string) => void;
}

const HEIGHT = 300;
const MARGIN = { top: 12, right: 12, bottom: 32, left: 56 };
/** Aire a los lados para que la primera y la última visita no pisen el eje. */
const PAD_X = 10;

type Pt = { x: number; y: number };

/** Parte en tramos contiguos: un null corta la línea, nunca se dibuja en 0. */
function segments<T>(items: T[], toPoint: (item: T) => Pt | null): Pt[][] {
  const out: Pt[][] = [];
  let current: Pt[] = [];
  for (const item of items) {
    const p = toPoint(item);
    if (p === null) {
      if (current.length > 0) out.push(current);
      current = [];
    } else {
      current.push(p);
    }
  }
  if (current.length > 0) out.push(current);
  return out;
}

function visitLabel(visit: TrendVisit): string {
  const range =
    visit.min !== null && visit.max !== null
      ? `; entre ${formatMm(visit.min)} y ${formatMm(visit.max)} mm`
      : "";
  return `${visit.label}, ${shortDate(visit.date)}: promedio ${visit.mean === null ? "sin dato" : `${formatMm(visit.mean)} mm`}${range}`;
}

/**
 * Tendencia del lugar (Fase 18): el acumulado promedio de cada visita como
 * línea, con una banda del punto más hundido al menos hundido, las líneas de
 * los umbrales y el tiempo real en el eje X.
 *
 * El eje X va en días, no por índice de visita: con visitas irregulares el
 * índice exagera la pendiente de los intervalos largos. El acumulado negativo
 * (descenso) se dibuja hacia abajo, y el eje llega al umbral siguiente al
 * punto más hundido, para que se vea cuánto falta.
 */
export function TrendChart({ visits, thresholds, onSelectVisit }: TrendChartProps) {
  const { ref, width } = useContainerWidth();
  // Visita señalada con el ratón o el foco: su resumen sale en un recuadro.
  const [activeId, setActiveId] = useState<string | null>(null);

  const W = width ?? FALLBACK_WIDTH;
  const plotW = W - MARGIN.left - MARGIN.right;
  const plotH = HEIGHT - MARGIN.top - MARGIN.bottom;

  const values = visits.flatMap((v) =>
    [v.mean, v.min, v.max].filter((x): x is number => x !== null),
  );
  const hasData = visits.some((v) => v.mean !== null);

  const axis = settlementAxis(values, thresholds, Math.max(3, Math.round(plotH / 55)));
  const yScale = linearScale(axis.domain, [plotH, 0]);

  const dates = visits.map((v) => v.date);
  const first = dates[0] ?? "";
  const last = dates[dates.length - 1] ?? "";
  const xScale = dates.length > 0 ? timeScale(dates, [PAD_X, plotW - PAD_X]) : () => 0;
  const ticks = dates.length > 0 ? timeTicks(first, last, Math.max(2, Math.floor(plotW / 110))) : [];
  const tickLabels = timeTickLabels(ticks);

  const lineSegments = segments(visits, (v) =>
    v.mean === null ? null : { x: xScale(v.date), y: yScale(v.mean) },
  );
  // La banda: por arriba el máximo de izquierda a derecha, y de vuelta por
  // abajo el mínimo. Se corta igual que la línea.
  const bandSegments = segments(visits, (v) =>
    v.min === null || v.max === null
      ? null
      : { x: xScale(v.date), y: yScale(v.max) },
  );
  const bandLows = segments(visits, (v) =>
    v.min === null || v.max === null
      ? null
      : { x: xScale(v.date), y: yScale(v.min) },
  );

  const marks = visits
    .filter((v): v is TrendVisit & { mean: number } => v.mean !== null)
    .map((v) => ({ visit: v, x: xScale(v.date), y: yScale(v.mean) }));

  const lastWithMean = marks[marks.length - 1]?.visit;
  const ariaLabel = hasData
    ? `Tendencia del asentamiento acumulado promedio en milímetros, ${visits.length} visitas del ${shortDate(first)} al ${shortDate(last)}, con la banda entre el punto más y el menos hundido de cada visita.` +
      (lastWithMean ? ` Última: ${visitLabel(lastWithMean)}.` : "") +
      (axis.thresholds.length > 0
        ? ` Umbrales dibujados: ${axis.thresholds.map(thresholdLabel).join(", ")}.`
        : "")
    : "Gráfica de tendencia sin lecturas suficientes para dibujarse.";

  const active = marks.find((m) => m.visit.visitId === activeId) ?? null;

  if (visits.length === 0) {
    return (
      <p className="text-sm text-neutral-500">
        Todavía no hay visitas para dibujar la tendencia.
      </p>
    );
  }

  return (
    <div ref={ref} className="flex min-w-0 flex-col gap-3">
      {!hasData ? (
        <p className="text-sm text-neutral-500">
          Todavía no hay lecturas para dibujar la tendencia.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <ChartSvg
            width={W}
            height={HEIGHT}
            ariaLabel={ariaLabel}
            overlayLabel="Visitas de la tendencia: pulsa una para abrirla"
            overlay={
              onSelectVisit ? (
                <g transform={`translate(${MARGIN.left},${MARGIN.top})`}>
                  {marks.map(({ visit, x, y }) => (
                    <g
                      key={visit.visitId}
                      {...pressableProps(visitLabel(visit), () => onSelectVisit(visit.visitId))}
                      className="group cursor-pointer outline-none"
                      onFocus={() => setActiveId(visit.visitId)}
                      onBlur={() => setActiveId((cur) => (cur === visit.visitId ? null : cur))}
                      onMouseEnter={() => setActiveId(visit.visitId)}
                      onMouseLeave={() => setActiveId((cur) => (cur === visit.visitId ? null : cur))}
                    >
                      {/* Zona pulsable de 24 px, mayor que la marca */}
                      <circle cx={x} cy={y} r={12} fill="transparent" />
                      <circle
                        cx={x}
                        cy={y}
                        r={8}
                        fill="none"
                        strokeWidth={2}
                        className="stroke-primary-600 opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100"
                      />
                    </g>
                  ))}
                  {active && (
                    <Tooltip
                      visit={active.visit}
                      x={active.x}
                      y={active.y}
                      minX={-MARGIN.left + 2}
                      maxX={plotW + MARGIN.right - 2}
                      minY={-MARGIN.top + 2}
                    />
                  )}
                </g>
              ) : undefined
            }
          >
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
                ticks={ticks.map((t, i) => ({ x: xScale(t), label: tickLabels[i] ?? t }))}
                plotWidth={plotW}
                plotHeight={plotH}
              />

              {/* Banda de mínimo a máximo */}
              {bandSegments.map((top, i) => {
                const low = bandLows[i] ?? [];
                if (top.length === 1 && top[0] && low[0]) {
                  // Una visita aislada: la banda es un trazo vertical.
                  return (
                    <line
                      key={i}
                      x1={top[0].x}
                      x2={low[0].x}
                      y1={top[0].y}
                      y2={low[0].y}
                      strokeWidth={8}
                      strokeLinecap="round"
                      className="stroke-primary-500/15"
                    />
                  );
                }
                const points = [...top, ...[...low].reverse()]
                  .map((p) => `${p.x},${p.y}`)
                  .join(" ");
                return <polygon key={i} points={points} className="fill-primary-500/15" />;
              })}

              <ThresholdLines
                thresholds={axis.thresholds}
                yScale={yScale}
                plotWidth={plotW}
                plotHeight={plotH}
              />

              {/* Promedio */}
              {lineSegments.map((seg, i) => (
                <polyline
                  key={i}
                  points={seg.map((p) => `${p.x},${p.y}`).join(" ")}
                  fill="none"
                  strokeWidth={2}
                  strokeLinejoin="round"
                  className="stroke-primary-600"
                />
              ))}
              {marks.map(({ visit, x, y }) => (
                <circle
                  key={visit.visitId}
                  cx={x}
                  cy={y}
                  r={4}
                  strokeWidth={1.5}
                  className="fill-primary-600 stroke-white"
                />
              ))}
            </g>
          </ChartSvg>
        </div>
      )}

      {hasData && (
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-neutral-700">
          <li className="inline-flex items-center gap-2">
            <svg width={24} height={10} aria-hidden className="shrink-0">
              <line x1={0} x2={24} y1={5} y2={5} strokeWidth={2} className="stroke-primary-600" />
              <circle cx={12} cy={5} r={3.5} className="fill-primary-600" />
            </svg>
            Promedio
          </li>
          <li className="inline-flex items-center gap-2">
            <svg width={24} height={10} aria-hidden className="shrink-0">
              <rect x={0} y={0} width={24} height={10} rx={2} className="fill-primary-500/15" />
            </svg>
            Rango entre puntos
          </li>
          <ThresholdLegendItems thresholds={axis.thresholds} />
        </ul>
      )}

      <DataTableDetails caption="Asentamiento acumulado promedio, mínimo y máximo por visita, en milímetros">
        <thead>
          <tr className={TABLE_HEAD_ROW}>
            <th className={TABLE_TH}>Visita</th>
            <th className={TABLE_TH}>Fecha</th>
            <th className={TABLE_TH}>Promedio (mm)</th>
            <th className={TABLE_TH}>Mínimo (mm)</th>
            <th className={TABLE_TH}>Máximo (mm)</th>
          </tr>
        </thead>
        <tbody>
          {visits.map((v) => (
            <tr key={v.visitId} className={TABLE_ROW}>
              <td className={TABLE_TD}>{v.label}</td>
              <td className={TABLE_TD}>{shortDate(v.date)}</td>
              <td className={TABLE_TD}>{v.mean === null ? "—" : formatMm(v.mean)}</td>
              <td className={TABLE_TD}>{v.min === null ? "—" : formatMm(v.min)}</td>
              <td className={TABLE_TD}>{v.max === null ? "—" : formatMm(v.max)}</td>
            </tr>
          ))}
        </tbody>
      </DataTableDetails>
    </div>
  );
}

/**
 * Recuadro con el resumen de la visita señalada. Decorativo para el lector de
 * pantalla: la marca ya lleva el mismo texto en su `aria-label`.
 */
function Tooltip({
  visit,
  x,
  y,
  minX,
  maxX,
  minY,
}: {
  visit: TrendVisit;
  x: number;
  y: number;
  minX: number;
  maxX: number;
  minY: number;
}) {
  const lines = [
    `${visit.label} · ${shortDate(visit.date)}`,
    `Promedio ${visit.mean === null ? "—" : `${formatMm(visit.mean)} mm`}`,
    ...(visit.min !== null && visit.max !== null
      ? [`Entre ${formatMm(visit.min)} y ${formatMm(visit.max)} mm`]
      : []),
  ];
  const LINE = FONT_SIZE + 4;
  const boxW = Math.max(...lines.map((l) => textWidth(l))) + 16;
  const boxH = lines.length * LINE + 8;
  const left = Math.min(Math.max(x - boxW / 2, minX), maxX - boxW);
  const above = y - 14 - boxH;
  const top = above >= minY ? above : y + 14;
  return (
    <g aria-hidden pointerEvents="none">
      <rect
        x={left}
        y={top}
        width={boxW}
        height={boxH}
        rx={6}
        className="fill-white stroke-neutral-200"
      />
      {lines.map((line, i) => (
        <text
          key={i}
          x={left + 8}
          y={top + 4 + LINE * (i + 1) - 4}
          fontSize={FONT_SIZE}
          fontWeight={i === 0 ? 600 : 400}
          className={i === 0 ? "fill-neutral-900" : "fill-neutral-800"}
        >
          {line}
        </text>
      ))}
    </g>
  );
}
