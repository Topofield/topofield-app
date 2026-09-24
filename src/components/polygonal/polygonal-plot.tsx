// Dibujo de la poligonal (Fase 13): la ajustada a escala y la sin compensar
// exagerada ×k. SVG sin estado, compartido por el editor (dentro de
// `PolygonalPlotViewer`, con zoom) y el informe imprimible (estático).
//
// Los colores van como variables CSS del sistema de diseño, que el navegador
// resuelve también al imprimir.

import { niceTicks } from "@/lib/design/chart-scale";
import {
  exaggeratedPoints,
  exaggerationFactor,
  plotFrame,
  scaleBarMeters,
  type PlanePoint,
} from "@/lib/design/polygonal-plot";
import { polygonalTraces } from "@/lib/calculations/polygonal";
import type { PolygonalInput, PolygonalResult } from "@/types/polygonal";

export const PLOT_WIDTH = 720;
export const PLOT_HEIGHT = 480;
const PADDING = 48;

/** Desplazamiento y acercamiento del editor. Sin él, se ve todo. */
export interface PlotView {
  zoom: number;
  /** Desplazamiento en unidades del viewBox (píxeles del dibujo). */
  offsetX: number;
  offsetY: number;
}

export const DEFAULT_VIEW: PlotView = { zoom: 1, offsetX: 0, offsetY: 0 };

interface PolygonalPlotProps {
  input: PolygonalInput;
  result: PolygonalResult;
  /** Punto de amarre con coordenadas, si el proceso lo tiene. */
  reference?: { code: string; north: number; east: number } | null;
  view?: PlotView;
}

/**
 * Coordenada de la grilla, SIN separador de miles: en es-CO el separador es el
 * punto, y «N 100.140» se leería como cien con decimales cuando son 100 140 m.
 */
function coord(value: number): string {
  return value.toLocaleString("es-CO", { maximumFractionDigits: 2, useGrouping: false });
}

function factorLabel(k: number): string {
  return `×${k.toLocaleString("es-CO")}`;
}

const TYPE_LABELS: Record<PolygonalInput["type"], string> = {
  closed: "cerrada",
  open_controlled: "abierta con control",
  open_uncontrolled: "abierta sin control",
};

/**
 * La poligonal a escala, con proporción 1:1, grilla de coordenadas, flecha de
 * norte, barra de escala y la sin compensar exagerada ×k. Ver
 * docs/prds/12-canvas-poligonal.md, «El dibujo».
 */
export function PolygonalPlot({
  input,
  result,
  reference = null,
  view = DEFAULT_VIEW,
}: PolygonalPlotProps) {
  const traces = polygonalTraces(input, result);
  if (!traces) {
    return (
      <p className="text-sm text-neutral-500">
        Todavía no se puede dibujar: faltan ángulos o distancias en alguna
        estación, o las coordenadas y el azimut de partida. El dibujo aparece
        en cuanto el cálculo tenga coordenadas.
      </p>
    );
  }

  // Sin control no hay compensación: aunque el factor salga, no hay nada
  // «sin compensar» distinto de lo ajustado.
  const k = input.type === "open_uncontrolled" ? null : exaggerationFactor(traces);
  const exaggerated = k ? exaggeratedPoints(traces, k) : null;
  const adjusted: PlanePoint[] = traces.map((t) => t.adjusted);

  const all: PlanePoint[] = [
    ...adjusted,
    ...(exaggerated ?? []),
    ...(reference ? [reference] : []),
  ];

  const base = plotFrame(all, PLOT_WIDTH, PLOT_HEIGHT, PADDING);
  const baseCenter = {
    east: (base.east[0] + base.east[1]) / 2,
    north: (base.north[0] + base.north[1]) / 2,
  };
  const mpp = base.metersPerPixel / view.zoom;
  const frame = plotFrame(all, PLOT_WIDTH, PLOT_HEIGHT, PADDING, {
    zoom: view.zoom,
    center: {
      east: baseCenter.east - view.offsetX * mpp,
      north: baseCenter.north + view.offsetY * mpp,
    },
  });

  // Solo las marcas cuyo rótulo cabe: una marca pegada al borde sale cortada.
  const LABEL_MARGIN = 36;
  const eastTicks = niceTicks(frame.east[0], frame.east[1], 6).filter((v) => {
    const x = frame.toX(v);
    return x >= LABEL_MARGIN && x <= PLOT_WIDTH - LABEL_MARGIN;
  });
  const northTicks = niceTicks(frame.north[0], frame.north[1], 5).filter((v) => {
    const y = frame.toY(v);
    return y >= LABEL_MARGIN && y <= PLOT_HEIGHT - LABEL_MARGIN;
  });

  const toPoints = (ps: PlanePoint[]) =>
    ps.map((p) => `${frame.toX(p.east)},${frame.toY(p.north)}`).join(" ");

  const barMeters = scaleBarMeters(frame.metersPerPixel, 120);
  const barPixels = barMeters / frame.metersPerPixel;

  // En una cerrada, el último vértice repite el arranque: se rotula una vez.
  const labelled = input.type === "closed" ? traces.slice(0, -1) : traces;

  const summary =
    `Dibujo de la poligonal ${TYPE_LABELS[input.type]} con ${labelled.length} vértices` +
    (result.linearError !== null
      ? `, error de cierre ${result.linearError.toLocaleString("es-CO", { minimumFractionDigits: 3, maximumFractionDigits: 3 })} m`
      : "") +
    (k ? `. La poligonal sin compensar se dibuja con los desplazamientos exagerados ${factorLabel(k)}.` : ".");

  return (
    <figure className="flex flex-col gap-2">
      <svg
        viewBox={`0 0 ${PLOT_WIDTH} ${PLOT_HEIGHT}`}
        className="h-auto w-full max-w-full touch-none select-none rounded-md border border-neutral-200 bg-white"
        role="img"
        aria-label={summary}
      >
        <defs>
          <clipPath id="polygonal-plot-area">
            <rect x={0} y={0} width={PLOT_WIDTH} height={PLOT_HEIGHT} />
          </clipPath>
        </defs>

        <g clipPath="url(#polygonal-plot-area)">
          {/* Grilla de coordenadas */}
          {eastTicks.map((e) => (
            <g key={`e${e}`}>
              <line
                x1={frame.toX(e)}
                x2={frame.toX(e)}
                y1={0}
                y2={PLOT_HEIGHT}
                stroke="var(--color-neutral-200)"
                strokeWidth={1}
              />
              <text
                x={frame.toX(e)}
                y={PLOT_HEIGHT - 6}
                textAnchor="middle"
                fontSize={10}
                fill="var(--color-neutral-500)"
              >
                E {coord(e)}
              </text>
            </g>
          ))}
          {northTicks.map((n) => (
            <g key={`n${n}`}>
              <line
                x1={0}
                x2={PLOT_WIDTH}
                y1={frame.toY(n)}
                y2={frame.toY(n)}
                stroke="var(--color-neutral-200)"
                strokeWidth={1}
              />
              <text
                x={6}
                y={frame.toY(n) - 4}
                fontSize={10}
                fill="var(--color-neutral-500)"
              >
                N {coord(n)}
              </text>
            </g>
          ))}

          {/* Amarre y línea de orientación hasta el arranque */}
          {reference && adjusted[0] && (
            <g>
              <line
                x1={frame.toX(reference.east)}
                y1={frame.toY(reference.north)}
                x2={frame.toX(adjusted[0].east)}
                y2={frame.toY(adjusted[0].north)}
                stroke="var(--color-neutral-500)"
                strokeWidth={1}
                strokeDasharray="2 3"
              />
              <polygon
                points={(() => {
                  const x = frame.toX(reference.east);
                  const y = frame.toY(reference.north);
                  return `${x},${y - 7} ${x + 6},${y + 5} ${x - 6},${y + 5}`;
                })()}
                fill="var(--color-neutral-900)"
              />
              <text
                x={frame.toX(reference.east) + 9}
                y={frame.toY(reference.north) + 4}
                fontSize={11}
                fill="var(--color-neutral-900)"
              >
                {reference.code} (amarre)
              </text>
            </g>
          )}

          {/* Sin compensar, exagerada ×k: discontinua */}
          {exaggerated && (
            <g>
              <polyline
                points={toPoints(exaggerated)}
                fill="none"
                stroke="var(--color-warning-500)"
                strokeWidth={1.5}
                strokeDasharray="6 4"
              />
              {exaggerated.map((p, i) => (
                <circle
                  key={i}
                  cx={frame.toX(p.east)}
                  cy={frame.toY(p.north)}
                  r={3}
                  fill="white"
                  stroke="var(--color-warning-500)"
                  strokeWidth={1.5}
                />
              ))}
            </g>
          )}

          {/* Ajustada: continua, con vértices rotulados */}
          <polyline
            points={toPoints(adjusted)}
            fill="none"
            stroke="var(--color-primary-500)"
            strokeWidth={2}
          />
          {labelled.map((t, i) => (
            <g key={`${t.code}-${i}`}>
              <circle
                cx={frame.toX(t.adjusted.east)}
                cy={frame.toY(t.adjusted.north)}
                r={4}
                fill="var(--color-primary-600)"
              />
              <text
                x={frame.toX(t.adjusted.east) + 7}
                y={frame.toY(t.adjusted.north) - 7}
                fontSize={12}
                fontWeight={600}
                fill="var(--color-neutral-900)"
              >
                {t.code}
              </text>
            </g>
          ))}
        </g>

        {/* Flecha de norte */}
        <g transform={`translate(${PLOT_WIDTH - 30}, 18)`}>
          <polygon points="0,0 7,18 0,13 -7,18" fill="var(--color-neutral-900)" />
          <text x={0} y={32} textAnchor="middle" fontSize={11} fontWeight={600} fill="var(--color-neutral-900)">
            N
          </text>
        </g>

        {/* Barra de escala */}
        <g transform={`translate(12, ${PLOT_HEIGHT - 28})`}>
          <rect x={0} y={0} width={barPixels} height={4} fill="var(--color-neutral-900)" />
          <text x={barPixels / 2} y={-4} textAnchor="middle" fontSize={10} fill="var(--color-neutral-900)">
            {barMeters.toLocaleString("es-CO")} m
          </text>
        </g>
      </svg>

      <figcaption className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-neutral-700">
        <span className="inline-flex items-center gap-2">
          <svg width={24} height={8} aria-hidden>
            <line x1={0} x2={24} y1={4} y2={4} stroke="var(--color-primary-500)" strokeWidth={2} />
          </svg>
          Ajustada
        </span>
        {exaggerated && k ? (
          <span className="inline-flex items-center gap-2">
            <svg width={24} height={8} aria-hidden>
              <line x1={0} x2={24} y1={4} y2={4} stroke="var(--color-warning-500)" strokeWidth={1.5} strokeDasharray="6 4" />
            </svg>
            Sin compensar (desplazamientos {factorLabel(k)})
          </span>
        ) : (
          <span>
            {input.type === "open_uncontrolled"
              ? "Abierta sin control: no se compensa."
              : "Sin correcciones: la poligonal cierra exacta."}
          </span>
        )}
      </figcaption>
    </figure>
  );
}
