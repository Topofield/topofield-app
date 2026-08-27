// Gráfica de asentamiento para el INFORME (§ 4.7): la misma serie temporal
// que muestra el panel del lugar, pero estática y renderizada en el servidor.
//
// No se reutiliza `settlement-chart.tsx` porque aquel es un Client Component
// con selección de puntos por checkbox — estado que un documento impreso no
// puede tener. Lo que sí se comparte es todo lo que decide la FORMA: las
// escalas (`chart-scale`) y el catálogo de marcadores (`series-markers`), que
// son funciones puras con sus propios tests. Así el informe no puede dibujar
// una geometría distinta de la que se ve en pantalla.

import { linearScale, niceTicks } from "@/lib/design/chart-scale";
import { seriesStyle, type SeriesMarker } from "@/lib/design/series-markers";
import type { PointInput, VisitResult } from "@/types/settlement";

const MARKER_SIZE = 4;
const CHART_WIDTH = 680;
const CHART_HEIGHT = 280;
const MARGIN = { top: 12, right: 20, bottom: 44, left: 52 };
const PLOT_WIDTH = CHART_WIDTH - MARGIN.left - MARGIN.right;
const PLOT_HEIGHT = CHART_HEIGHT - MARGIN.top - MARGIN.bottom;

/** Marcador de forma, centrado en (cx, cy). Idéntico al del panel. */
function Marker({
  shape,
  cx,
  cy,
  color,
}: {
  shape: SeriesMarker;
  cx: number;
  cy: number;
  color: string;
}) {
  const r = MARKER_SIZE;
  switch (shape) {
    case "circle":
      return <circle cx={cx} cy={cy} r={r} fill={color} />;
    case "square":
      return (
        <rect x={cx - r} y={cy - r} width={r * 2} height={r * 2} fill={color} />
      );
    case "triangle":
      return (
        <polygon
          points={`${cx},${cy - r} ${cx + r},${cy + r} ${cx - r},${cy + r}`}
          fill={color}
        />
      );
    case "diamond":
      return (
        <polygon
          points={`${cx},${cy - r} ${cx + r},${cy} ${cx},${cy + r} ${cx - r},${cy}`}
          fill={color}
        />
      );
    case "cross":
      return (
        <g stroke={color} strokeWidth={1.8} strokeLinecap="round">
          <line x1={cx - r} y1={cy - r} x2={cx + r} y2={cy + r} />
          <line x1={cx - r} y1={cy + r} x2={cx + r} y2={cy - r} />
        </g>
      );
    case "triangle-down":
      return (
        <polygon
          points={`${cx},${cy + r} ${cx + r},${cy - r} ${cx - r},${cy - r}`}
          fill={color}
        />
      );
    case "plus":
      return (
        <g stroke={color} strokeWidth={2.2} strokeLinecap="round">
          <line x1={cx - r} y1={cy} x2={cx + r} y2={cy} />
          <line x1={cx} y1={cy - r} x2={cx} y2={cy + r} />
        </g>
      );
    case "star": {
      const i = r * 0.4;
      return (
        <polygon
          points={[
            `${cx},${cy - r}`,
            `${cx + i},${cy - i}`,
            `${cx + r},${cy}`,
            `${cx + i},${cy + i}`,
            `${cx},${cy + r}`,
            `${cx - i},${cy + i}`,
            `${cx - r},${cy}`,
            `${cx - i},${cy - i}`,
          ].join(" ")}
          fill={color}
        />
      );
    }
    case "ring":
      return (
        <circle
          cx={cx}
          cy={cy}
          r={r - 0.8}
          fill="none"
          stroke={color}
          strokeWidth={2}
        />
      );
    case "square-hollow":
      return (
        <rect
          x={cx - r + 0.8}
          y={cy - r + 0.8}
          width={(r - 0.8) * 2}
          height={(r - 0.8) * 2}
          fill="none"
          stroke={color}
          strokeWidth={2}
        />
      );
    default:
      return null;
  }
}

function mm(value: number): string {
  return value.toLocaleString("es-CO", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
}

function fecha(value: string): string {
  const [y, m, d] = value.split("-");
  return y && m && d ? `${d}/${m}` : value;
}

interface SettlementPlotProps {
  points: PointInput[];
  visits: VisitResult[];
}

/**
 * Serie temporal de asentamiento acumulado, en SVG estático.
 *
 * Dibuja **todos** los puntos del catálogo: en el panel el usuario elige
 * cuáles ver, pero un informe documenta el monitoreo completo.
 */
export function SettlementPlot({ points, visits }: SettlementPlotProps) {
  const series = points.map((point, index) => ({
    point,
    ...seriesStyle(index),
    values: visits.map(
      (v) =>
        v.readings.find((r) => r.pointId === point.id)?.accumulatedSettlement ??
        null,
    ),
  }));

  const todos = series
    .flatMap((s) => s.values)
    .filter((v): v is number => v !== null);
  if (todos.length === 0 || visits.length === 0) return null;

  // El dominio incluye siempre el 0 (la línea base C0), para que el punto de
  // partida sea visible aunque todas las lecturas ya se hayan hundido.
  const yTicks = niceTicks(Math.min(0, ...todos), Math.max(0, ...todos), 5);
  const yScale = linearScale(
    [yTicks[0] ?? 0, yTicks[yTicks.length - 1] ?? 0],
    [PLOT_HEIGHT, 0],
  );
  const xScale = linearScale([0, Math.max(1, visits.length - 1)], [0, PLOT_WIDTH]);

  return (
    <div className="report-plot">
      <svg
        viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
        width={CHART_WIDTH}
        role="img"
        aria-label={`Asentamiento acumulado en milímetros a lo largo de ${visits.length} visitas, para ${points.length} punto(s): ${points.map((p) => p.code).join(", ")}.`}
      >
        <g transform={`translate(${MARGIN.left},${MARGIN.top})`}>
          {yTicks.map((tick) => (
            <g key={tick}>
              <line
                x1={0}
                x2={PLOT_WIDTH}
                y1={yScale(tick)}
                y2={yScale(tick)}
                stroke="#e5e7eb"
                strokeWidth={1}
              />
              <text
                x={-8}
                y={yScale(tick)}
                textAnchor="end"
                dominantBaseline="middle"
                fontSize={10}
                fill="#5d6d7e"
              >
                {mm(tick)}
              </text>
            </g>
          ))}

          <line
            x1={0}
            x2={PLOT_WIDTH}
            y1={yScale(0)}
            y2={yScale(0)}
            stroke="#828c98"
            strokeWidth={1.4}
          />

          {visits.map((visit, i) => (
            <text
              key={visit.visitId}
              x={xScale(i)}
              y={PLOT_HEIGHT + 18}
              textAnchor={
                i === 0 ? "start" : i === visits.length - 1 ? "end" : "middle"
              }
              fontSize={10}
              fill="#5d6d7e"
            >
              {fecha(visit.date)}
            </text>
          ))}

          <text
            transform={`translate(${-MARGIN.left + 12},${PLOT_HEIGHT / 2}) rotate(-90)`}
            textAnchor="middle"
            fontSize={10}
            fill="#5d6d7e"
          >
            Acumulado (mm)
          </text>

          {series.map(({ point, shape, color, values }) => {
            // Los tramos se cortan donde falta lectura: unir por encima de un
            // hueco dibujaría una pendiente que nadie midió.
            const tramos: { i: number; v: number }[][] = [];
            let actual: { i: number; v: number }[] = [];
            values.forEach((v, i) => {
              if (v === null) {
                if (actual.length > 0) tramos.push(actual);
                actual = [];
              } else {
                actual.push({ i, v });
              }
            });
            if (actual.length > 0) tramos.push(actual);

            return (
              <g key={point.id}>
                {tramos.map((tramo, k) => (
                  <polyline
                    key={k}
                    fill="none"
                    stroke={color}
                    strokeWidth={1.4}
                    points={tramo
                      .map(({ i, v }) => `${xScale(i)},${yScale(v)}`)
                      .join(" ")}
                  />
                ))}
                {tramos.flat().map(({ i, v }) => (
                  <Marker
                    key={i}
                    shape={shape}
                    cx={xScale(i)}
                    cy={yScale(v)}
                    color={color}
                  />
                ))}
              </g>
            );
          })}
        </g>
      </svg>

      {/* Leyenda: el marcador se identifica sin recordar el orden de las series. */}
      <ul className="report-plot-legend">
        {series.map(({ point, shape, color }) => (
          <li key={point.id}>
            <svg width={12} height={12} aria-hidden>
              <Marker shape={shape} cx={6} cy={6} color={color} />
            </svg>
            {point.code}
          </li>
        ))}
      </ul>
    </div>
  );
}
