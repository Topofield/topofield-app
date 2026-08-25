"use client";

import { useState } from "react";
import { Alert } from "@/components/design-system";
import { linearScale, niceTicks } from "@/lib/design/chart-scale";
import type { PointInput, VisitResult } from "@/types/settlement";

interface SettlementChartProps {
  points: PointInput[];
  /** Visitas ya calculadas, en orden cronológico. */
  visits: VisitResult[];
}

/** Marcadores por índice de serie. El color solo refuerza; la forma distingue. */
const SERIES_MARKERS = [
  "circle",
  "square",
  "triangle",
  "diamond",
  "cross",
] as const;
type SeriesMarker = (typeof SERIES_MARKERS)[number];

/**
 * Colores de refuerzo por índice de serie (canal secundario, no el único).
 *
 * Formas y colores ciclan con longitudes COPRIMAS (5 y 4), así que la
 * combinación forma+color no se repite hasta la serie 20 (mcm(5,4)). Con
 * longitudes iguales, la serie 6 habría repetido forma y color de la
 * primera y las dos habrían sido indistinguibles por cualquiera de los dos
 * canales a la vez: un lugar con 9 puntos de control (una grilla 3×3 es
 * disposición estándar en el marco teórico de este dominio, y el caso de la
 * presa usa 10) lo habría provocado de inmediato al seleccionar todos.
 *
 * `warning-500` se dejó fuera de los 4: es un marrón-anaranjado demasiado
 * cercano a `semaphore-orange`, el color menos distinguible del resto.
 */
const SERIES_COLORS = [
  "#187aae", // primary-500
  "#1e8e4e", // semaphore-green
  "#c25e08", // semaphore-orange
  "#c0392b", // danger-500
] as const;

/**
 * A partir de esta cantidad de series seleccionadas, alguna pareja repite
 * forma y color a la vez: mcm(longitud de formas, longitud de colores).
 */
function lcm(a: number, b: number): number {
  function gcd(x: number, y: number): number {
    return y === 0 ? x : gcd(y, x % y);
  }
  return (a * b) / gcd(a, b);
}
const MAX_DISTINGUISHABLE_SERIES = lcm(
  SERIES_MARKERS.length,
  SERIES_COLORS.length,
);

const MARKER_SIZE = 5;

const CHART_WIDTH = 720;
const CHART_HEIGHT = 320;
const MARGIN = { top: 16, right: 24, bottom: 48, left: 56 };
const PLOT_WIDTH = CHART_WIDTH - MARGIN.left - MARGIN.right;
const PLOT_HEIGHT = CHART_HEIGHT - MARGIN.top - MARGIN.bottom;

/** Dibuja el marcador de forma de una serie, centrado en (cx, cy). */
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
        <rect
          x={cx - r}
          y={cy - r}
          width={r * 2}
          height={r * 2}
          fill={color}
        />
      );
    case "triangle": {
      const points = `${cx},${cy - r} ${cx + r},${cy + r} ${cx - r},${cy + r}`;
      return <polygon points={points} fill={color} />;
    }
    case "diamond": {
      const points = `${cx},${cy - r} ${cx + r},${cy} ${cx},${cy + r} ${cx - r},${cy}`;
      return <polygon points={points} fill={color} />;
    }
    case "cross":
      return (
        <g stroke={color} strokeWidth={2} strokeLinecap="round">
          <line x1={cx - r} y1={cy - r} x2={cx + r} y2={cy + r} />
          <line x1={cx - r} y1={cy + r} x2={cx + r} y2={cy - r} />
        </g>
      );
    default:
      return null;
  }
}

function formatMm(value: number): string {
  return value.toLocaleString("es-CO", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
}

function formatDate(value: string): string {
  const [year, month, day] = value.split("-");
  if (!year || !month || !day) return value;
  return `${day}/${month}/${year}`;
}

/**
 * Gráfica de asentamiento acumulado vs tiempo, una serie por punto
 * seleccionado.
 *
 * SVG escrito a mano: el proyecto no usa librerías de gráficas. El eje Y
 * queda invertido a propósito respecto al SVG «crudo» — el acumulado es
 * negativo (descenso), y aquí un acumulado más negativo se dibuja más abajo,
 * para que la curva «baje» como espera un topógrafo.
 *
 * Cada serie lleva un marcador de forma distinto además del color, para que
 * se distinga en escala de grises. La tabla que sigue a la gráfica repite los
 * mismos datos en texto: la información no depende del canal visual.
 */
export function SettlementChart({ points, visits }: SettlementChartProps) {
  // Selección de puntos: estado legítimo, la controla el usuario con los
  // checkboxes. Arranca con todos los puntos marcados para que la gráfica
  // muestre algo sin interacción previa.
  const [selectedPointIds, setSelectedPointIds] = useState<string[]>(() =>
    points.map((p) => p.id),
  );

  function togglePoint(pointId: string) {
    setSelectedPointIds((current) =>
      current.includes(pointId)
        ? current.filter((id) => id !== pointId)
        : [...current, pointId],
    );
  }

  const selectedPoints = points.filter((p) => selectedPointIds.includes(p.id));

  // Serie por punto seleccionado: un valor (o null) por visita, en el mismo
  // orden que `visits`. Null cuando el punto no tiene lectura en esa visita
  // (recién agregado al catálogo, o sin C0) — nunca se sustituye por 0.
  const series = selectedPoints.map((point, index) => {
    const values = visits.map((visit) => {
      const reading = visit.readings.find((r) => r.pointId === point.id);
      return reading?.accumulatedSettlement ?? null;
    });
    return {
      point,
      shape: SERIES_MARKERS[index % SERIES_MARKERS.length] ?? "circle",
      color: SERIES_COLORS[index % SERIES_COLORS.length] ?? "#187aae",
      values,
    };
  });

  const allValues = series.flatMap((s) => s.values).filter((v): v is number => v !== null);
  const hasData = allValues.length > 0 && visits.length > 0;

  // Dominio Y: siempre incluye 0 (la línea base, C0) para que el punto de
  // partida sea visible aunque todas las lecturas ya se hayan hundido.
  const rawMin = hasData ? Math.min(0, ...allValues) : -1;
  const rawMax = hasData ? Math.max(0, ...allValues) : 1;
  const yTicks = niceTicks(rawMin, rawMax, 5);
  const yDomainMin = yTicks[0] ?? rawMin;
  const yDomainMax = yTicks[yTicks.length - 1] ?? rawMax;

  // Y invertida a propósito: el valor más negativo (mayor asentamiento) cae
  // en `PLOT_HEIGHT` (abajo del plot) y el menos negativo en `0` (arriba).
  const yScale = linearScale(
    [yDomainMin, yDomainMax],
    [PLOT_HEIGHT, 0],
  );

  const xScale = linearScale(
    [0, Math.max(1, visits.length - 1)],
    [0, PLOT_WIDTH],
  );

  const ariaLabel = hasData
    ? `Gráfica de asentamiento acumulado en milímetros a lo largo de ${visits.length} visitas, para ${selectedPoints.length} punto(s): ${selectedPoints.map((p) => p.code).join(", ")}.`
    : "Gráfica de asentamiento acumulado sin datos suficientes para dibujarse.";

  return (
    <div className="flex flex-col gap-4">
      <fieldset className="flex flex-wrap gap-x-4 gap-y-2">
        <legend className="mb-1 text-sm font-medium text-neutral-800">
          Puntos a mostrar
        </legend>
        {points.map((point) => (
          <label
            key={point.id}
            className="inline-flex items-center gap-2 text-sm text-neutral-700"
          >
            <input
              type="checkbox"
              checked={selectedPointIds.includes(point.id)}
              onChange={() => togglePoint(point.id)}
              className="h-4 w-4 rounded border-neutral-300"
            />
            {point.code}
          </label>
        ))}
      </fieldset>

      {selectedPoints.length > MAX_DISTINGUISHABLE_SERIES && (
        <Alert variant="warning">
          Hay {selectedPoints.length} puntos seleccionados: a partir de{" "}
          {MAX_DISTINGUISHABLE_SERIES + 1} algunas series repiten forma y
          color a la vez y dejan de distinguirse con claridad. Selecciona
          menos puntos, o usa la tabla de abajo para leer los valores exactos.
        </Alert>
      )}

      {!hasData || selectedPoints.length === 0 ? (
        <p className="text-sm text-neutral-500">
          {points.length === 0
            ? "El catálogo todavía no tiene puntos."
            : selectedPoints.length === 0
              ? "Selecciona al menos un punto para dibujar su evolución."
              : "Todavía no hay lecturas para dibujar la gráfica."}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <svg
            viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
            preserveAspectRatio="xMinYMid meet"
            className="h-auto min-w-[480px]"
            style={{ width: CHART_WIDTH }}
            role="img"
            aria-label={ariaLabel}
          >
            <g transform={`translate(${MARGIN.left},${MARGIN.top})`}>
              {/* Rejilla y marcas del eje Y */}
              {yTicks.map((tick) => {
                const y = yScale(tick);
                return (
                  <g key={tick}>
                    <line
                      x1={0}
                      x2={PLOT_WIDTH}
                      y1={y}
                      y2={y}
                      stroke="#f2f3f4"
                      strokeWidth={1}
                    />
                    <text
                      x={-8}
                      y={y}
                      textAnchor="end"
                      dominantBaseline="middle"
                      fontSize={11}
                      fill="#5d6d7e"
                    >
                      {formatMm(tick)}
                    </text>
                  </g>
                );
              })}

              {/* Línea de referencia en 0 (C0), más marcada */}
              <line
                x1={0}
                x2={PLOT_WIDTH}
                y1={yScale(0)}
                y2={yScale(0)}
                stroke="#828c98"
                strokeWidth={1.5}
              />

              {/* Marcas del eje X: fechas de visita. Los extremos anclan
                  hacia adentro para que el texto no se corte contra el
                  borde del viewBox. */}
              {visits.map((visit, i) => (
                <text
                  key={visit.visitId}
                  x={xScale(i)}
                  y={PLOT_HEIGHT + 20}
                  textAnchor={
                    i === 0 ? "start" : i === visits.length - 1 ? "end" : "middle"
                  }
                  fontSize={11}
                  fill="#5d6d7e"
                >
                  {formatDate(visit.date)}
                </text>
              ))}

              <text
                transform={`translate(${-MARGIN.left + 14},${PLOT_HEIGHT / 2}) rotate(-90)`}
                textAnchor="middle"
                fontSize={11}
                fill="#5d6d7e"
              >
                Acumulado (mm)
              </text>

              {/* Series: una polilínea (partida en tramos por los null) más marcadores */}
              {series.map(({ point, shape, color, values }) => {
                // Parte la serie en tramos contiguos sin null: un valor
                // ausente corta la línea en vez de dibujarse en 0 o en NaN.
                const segments: { x: number; y: number }[][] = [];
                let current: { x: number; y: number }[] = [];
                values.forEach((value, i) => {
                  if (value === null) {
                    if (current.length > 0) {
                      segments.push(current);
                      current = [];
                    }
                    return;
                  }
                  current.push({ x: xScale(i), y: yScale(value) });
                });
                if (current.length > 0) segments.push(current);

                return (
                  <g key={point.id}>
                    {segments.map((segment, segIndex) => (
                      <polyline
                        key={segIndex}
                        points={segment.map((p) => `${p.x},${p.y}`).join(" ")}
                        fill="none"
                        stroke={color}
                        strokeWidth={2}
                      />
                    ))}
                    {values.map((value, i) =>
                      value === null ? null : (
                        <Marker
                          key={i}
                          shape={shape}
                          cx={xScale(i)}
                          cy={yScale(value)}
                          color={color}
                        />
                      ),
                    )}
                  </g>
                );
              })}
            </g>
          </svg>
        </div>
      )}

      {/* Leyenda: forma + color + código, para que el marcador se identifique sin depender de recordar el orden */}
      {series.length > 0 && (
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-neutral-700">
          {series.map(({ point, shape, color }) => (
            <li key={point.id} className="inline-flex items-center gap-2">
              <svg width={14} height={14} aria-hidden>
                <Marker shape={shape} cx={7} cy={7} color={color} />
              </svg>
              {point.code}
            </li>
          ))}
        </ul>
      )}

      {/* Alternativa textual: misma información que la gráfica, en tabla */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <caption className="sr-only">
            Asentamiento acumulado en milímetros por punto y visita
          </caption>
          <thead>
            <tr className="border-b border-neutral-100 text-left text-xs text-neutral-500">
              <th className="py-2 pr-3 font-medium">Visita</th>
              {selectedPoints.map((point) => (
                <th key={point.id} className="py-2 pr-3 font-medium">
                  {point.code} (mm)
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visits.map((visit, i) => (
              <tr
                key={visit.visitId}
                className="border-b border-neutral-100 last:border-0"
              >
                <td className="py-2 pr-3 text-neutral-700">
                  {formatDate(visit.date)}
                </td>
                {series.map(({ point, values }) => {
                  const value = values[i] ?? null;
                  return (
                    <td key={point.id} className="py-2 pr-3 text-neutral-700">
                      {value === null ? "—" : formatMm(value)}
                    </td>
                  );
                })}
              </tr>
            ))}
            {visits.length === 0 && (
              <tr>
                <td
                  className="py-4 text-center text-neutral-500"
                  colSpan={1 + selectedPoints.length}
                >
                  Sin visitas registradas.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
