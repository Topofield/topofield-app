"use client";

// Piezas compartidas por las gráficas SVG de asentamientos (Fase 18): el ancho
// real del contenedor, los ejes, las líneas de umbral, los marcadores de serie
// y la tabla alternativa. El proyecto no usa librerías de gráficas.

import {
  useCallback,
  useState,
  type KeyboardEvent,
  type ReactNode,
  type SVGProps,
} from "react";
import type { PlacedThreshold, ThresholdLevel } from "@/lib/design/chart-domain";
import type { SeriesMarker } from "@/lib/design/series-markers";
import { ALERT_LEVEL_LABELS } from "@/types/settlement";
import {
  FONT_SIZE,
  fitXLabels,
  formatThresholdMm,
  formatTick,
} from "@/lib/design/chart-labels";

// Los formateadores y rótulos viven en `lib/design/chart-labels` (Fase 22),
// para que la gráfica del informe, que es de servidor, los comparta.
export {
  FONT_SIZE,
  fitXLabels,
  formatMm,
  formatThresholdMm,
  shortDate,
  textWidth,
  timeTickLabels,
} from "@/lib/design/chart-labels";

/** Ancho con que se dibuja antes de medir el contenedor (y en el servidor). */
export const FALLBACK_WIDTH = 640;
/** Por debajo de este ancho la gráfica se escala en vez de estrecharse más. */
const MIN_WIDTH = 260;

/** Tamaño del texto secundario (umbrales, valores de barra). Nunca menos. */
export const SMALL_FONT_SIZE = 11;

/**
 * Ancho real del contenedor, en píxeles, o `null` antes de medirlo.
 *
 * La gráfica usa ese ancho como ancho del viewBox, para que una unidad sea un
 * píxel: con un viewBox fijo de 720, en un teléfono de 390 px el texto de 12
 * se encogía a unos 6 px (lección de la Fase 13, ver
 * `polygonal-plot-viewer.tsx`). Redondea hacia abajo: medio píxel de más
 * sacaba una barra de desplazamiento horizontal.
 *
 * Es una ref de función, no un efecto: el contenedor puede montarse después
 * (cuando llegan los primeros datos) y aun así se mide.
 */
export function useContainerWidth() {
  const [width, setWidth] = useState<number | null>(null);
  const ref = useCallback((el: HTMLDivElement | null) => {
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setWidth(Math.max(MIN_WIDTH, Math.floor(entry.contentRect.width)));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return { ref, width };
}

/** Marcas y rótulos de un eje X, bajo el área del gráfico. */
export function XAxis({
  ticks,
  plotWidth,
  plotHeight,
  title,
}: {
  ticks: { x: number; label: string }[];
  plotWidth: number;
  plotHeight: number;
  title?: string;
}) {
  const fitted = fitXLabels(ticks, plotWidth);
  return (
    <g>
      <line
        x1={0}
        x2={plotWidth}
        y1={plotHeight}
        y2={plotHeight}
        className="stroke-rule"
        strokeWidth={1}
      />
      {fitted.map((tick) => (
        <g key={`${tick.x}-${tick.label}`}>
          <line
            x1={tick.x}
            x2={tick.x}
            y1={plotHeight}
            y2={plotHeight + 4}
            className="stroke-rule-strong"
            strokeWidth={1}
          />
          <text
            x={tick.x}
            y={plotHeight + 18}
            textAnchor={tick.anchor}
            fontSize={FONT_SIZE}
            className="fill-ink-3"
          >
            {tick.label}
          </text>
        </g>
      ))}
      {title && (
        <text
          x={plotWidth / 2}
          y={plotHeight + 38}
          textAnchor="middle"
          fontSize={FONT_SIZE}
          className="fill-ink-3"
        >
          {title}
        </text>
      )}
    </g>
  );
}

/**
 * Rejilla y rótulos del eje Y, la línea del 0 (la lectura base, siempre
 * visible y más marcada) y el título girado.
 */
export function YAxis({
  ticks,
  yScale,
  plotWidth,
  plotHeight,
  marginLeft,
  title,
}: {
  ticks: number[];
  yScale: (value: number) => number;
  plotWidth: number;
  plotHeight: number;
  marginLeft: number;
  title: string;
}) {
  const step = ticks.length > 1 ? Math.abs((ticks[1] ?? 0) - (ticks[0] ?? 0)) : 1;
  return (
    <g>
      {ticks.map((tick) => {
        const y = yScale(tick);
        return (
          <g key={tick}>
            <line
              x1={0}
              x2={plotWidth}
              y1={y}
              y2={y}
              className="stroke-rule"
              strokeWidth={1}
            />
            <text
              x={-8}
              y={y}
              textAnchor="end"
              dominantBaseline="middle"
              fontSize={FONT_SIZE}
              className="fill-ink-3"
            >
              {formatTick(tick, step)}
            </text>
          </g>
        );
      })}
      <line
        x1={0}
        x2={plotWidth}
        y1={yScale(0)}
        y2={yScale(0)}
        className="stroke-rule-strong"
        strokeWidth={1.5}
      />
      <text
        transform={`translate(${-marginLeft + 14},${plotHeight / 2}) rotate(-90)`}
        textAnchor="middle"
        fontSize={FONT_SIZE}
        className="fill-ink-3"
      >
        {title}
      </text>
    </g>
  );
}

// --- Umbrales ---

/**
 * Trazo de cada umbral. El trazo discontinuo es el segundo canal: el color
 * nunca es el único que distingue un nivel de otro.
 */
export const THRESHOLD_STYLES: Record<
  ThresholdLevel,
  { stroke: string; dash: string | undefined }
> = {
  caution: { stroke: "stroke-semaphore-yellow", dash: "6 4" },
  alert: { stroke: "stroke-semaphore-orange", dash: "3 3" },
  alarm: { stroke: "stroke-semaphore-red", dash: undefined },
};

/** «Precaución −25 mm». */
export function thresholdLabel(threshold: PlacedThreshold): string {
  return `${ALERT_LEVEL_LABELS[threshold.level]} ${formatThresholdMm(threshold.value)} mm`;
}

/** Halo del texto que cae sobre la rejilla o los datos, del color de la tarjeta. */
export const HALO = {
  // La tarjeta del tema, no blanco: en oscuro un halo blanco rodearía el
  // texto claro de un contorno visible (Fase 20).
  stroke: "var(--color-card)",
  strokeWidth: 3,
  strokeLinejoin: "round" as const,
  paintOrder: "stroke" as const,
};

/**
 * Dónde va el rótulo de cada umbral: encima de su línea, o debajo si se
 * montaría sobre el anterior (un eje muy amplio); `null` si tampoco cabe.
 */
function placeThresholdLabels(
  thresholds: PlacedThreshold[],
  yScale: (value: number) => number,
  plotHeight: number,
): { t: PlacedThreshold; y: number; labelY: number | null }[] {
  const LINE_GAP = SMALL_FONT_SIZE + 3;
  let lastBaseline = -Infinity;
  const out: { t: PlacedThreshold; y: number; labelY: number | null }[] = [];
  for (const t of [...thresholds].sort((a, b) => yScale(a.value) - yScale(b.value))) {
    const y = yScale(t.value);
    let labelY: number | null = y - 4;
    if (labelY - lastBaseline < LINE_GAP || labelY < SMALL_FONT_SIZE) {
      const below = y + SMALL_FONT_SIZE + 2;
      labelY = below - lastBaseline >= LINE_GAP && below <= plotHeight ? below : null;
    }
    if (labelY !== null) lastBaseline = labelY;
    out.push({ t, y, labelY });
  }
  return out;
}

/**
 * Líneas horizontales de los umbrales, con su rótulo a la derecha. Un rótulo
 * que no cabe se omite: la leyenda y la tabla siguen diciéndolo.
 *
 * `showLabels={false}` deja solo las líneas, para las gráficas donde los
 * rótulos chocarían con los datos (las barras) y van en una leyenda.
 */
export function ThresholdLines({
  thresholds,
  yScale,
  plotWidth,
  plotHeight,
  showLabels = true,
  labelAlign = "end",
}: {
  thresholds: PlacedThreshold[];
  yScale: (value: number) => number;
  plotWidth: number;
  plotHeight: number;
  showLabels?: boolean;
  /**
   * Dónde van los rótulos. `start` (a la izquierda) cuando el extremo derecho
   * está ocupado: en el historial de un punto, el marcador de la visita actual
   * cae siempre allí y tapaba el rótulo del umbral más cercano.
   */
  labelAlign?: "start" | "end";
}) {
  const placed = placeThresholdLabels(thresholds, yScale, plotHeight);

  return (
    <g>
      {placed.map(({ t, y, labelY }) => {
        const style = THRESHOLD_STYLES[t.level];
        return (
          <g key={t.level}>
            <line
              x1={0}
              x2={plotWidth}
              y1={y}
              y2={y}
              className={style.stroke}
              strokeWidth={1.5}
              strokeDasharray={style.dash}
            />
            {showLabels && labelY !== null && (
              <text
                x={labelAlign === "end" ? plotWidth - 4 : 4}
                y={labelY}
                textAnchor={labelAlign}
                fontSize={SMALL_FONT_SIZE}
                className="fill-ink"
                {...HALO}
              >
                {thresholdLabel(t)}
              </text>
            )}
          </g>
        );
      })}
    </g>
  );
}

/** Muestra de la línea de un umbral para la leyenda. */
export function ThresholdSwatch({ level }: { level: ThresholdLevel }) {
  const style = THRESHOLD_STYLES[level];
  return (
    <svg width={24} height={8} aria-hidden className="shrink-0">
      <line
        x1={0}
        x2={24}
        y1={4}
        y2={4}
        className={style.stroke}
        strokeWidth={1.5}
        strokeDasharray={style.dash}
      />
    </svg>
  );
}

/** Leyenda de los umbrales dibujados: muestra del trazo y «Precaución −25 mm». */
export function ThresholdLegendItems({ thresholds }: { thresholds: PlacedThreshold[] }) {
  return (
    <>
      {thresholds.map((t) => (
        <li key={t.level} className="inline-flex items-center gap-2">
          <ThresholdSwatch level={t.level} />
          {thresholdLabel(t)}
        </li>
      ))}
    </>
  );
}

/** Texto con halo, para rótulos que caen sobre los datos. */
export function HaloText(props: SVGProps<SVGTextElement>) {
  return <text fontSize={SMALL_FONT_SIZE} {...HALO} {...props} />;
}

// --- Marcadores ---

/**
 * Marcador de forma de una serie, centrado en (cx, cy). El color solo
 * refuerza; la forma distingue. Mismo dibujo que el de `settlement-chart.tsx`,
 * con el radio como parámetro para atenuar o resaltar.
 */
export function Marker({
  shape,
  cx,
  cy,
  r = 5,
  color,
}: {
  shape: SeriesMarker;
  cx: number;
  cy: number;
  r?: number;
  color: string;
}) {
  switch (shape) {
    case "circle":
      return <circle cx={cx} cy={cy} r={r} fill={color} />;
    case "square":
      return <rect x={cx - r} y={cy - r} width={r * 2} height={r * 2} fill={color} />;
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
        <g stroke={color} strokeWidth={2} strokeLinecap="round">
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
        <g stroke={color} strokeWidth={2.5} strokeLinecap="round">
          <line x1={cx - r} y1={cy} x2={cx + r} y2={cy} />
          <line x1={cx} y1={cy - r} x2={cx} y2={cy + r} />
        </g>
      );
    case "star": {
      // Estrella de cuatro puntas: rombo con los lados hundidos hacia el
      // centro. Silueta inconfundible frente al rombo lleno.
      const i = r * 0.4;
      const points = [
        `${cx},${cy - r}`,
        `${cx + i},${cy - i}`,
        `${cx + r},${cy}`,
        `${cx + i},${cy + i}`,
        `${cx},${cy + r}`,
        `${cx - i},${cy + i}`,
        `${cx - r},${cy}`,
        `${cx - i},${cy - i}`,
      ].join(" ");
      return <polygon points={points} fill={color} />;
    }
    case "ring":
      return (
        <circle cx={cx} cy={cy} r={r - 1} fill="none" stroke={color} strokeWidth={2.5} />
      );
    case "square-hollow":
      return (
        <rect
          x={cx - r + 1}
          y={cy - r + 1}
          width={(r - 1) * 2}
          height={(r - 1) * 2}
          fill="none"
          stroke={color}
          strokeWidth={2.5}
        />
      );
    default:
      return null;
  }
}

// --- Marco y accesibilidad ---

/**
 * El dibujo, como imagen con su descripción, y encima —si la gráfica es
 * interactiva— una segunda capa SVG con las marcas pulsables.
 *
 * Van en capas separadas porque los hijos de un `role="img"` son
 * presentacionales: un botón dentro de la imagen no lo anuncia el lector de
 * pantalla. La capa de encima es un grupo con nombre; solo lleva las zonas
 * pulsables y su foco, el dibujo sigue debajo.
 *
 * `minWidth` fuerza un ancho mayor que el contenedor (desplazamiento
 * horizontal) cuando las marcas no caben.
 */
export function ChartSvg({
  width,
  height,
  ariaLabel,
  children,
  overlay,
  overlayLabel,
  minWidth,
}: {
  width: number;
  height: number;
  ariaLabel: string;
  children: ReactNode;
  overlay?: ReactNode;
  overlayLabel?: string;
  minWidth?: number;
}) {
  return (
    <div className="relative w-full" style={minWidth ? { minWidth } : undefined}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="block h-auto w-full select-none"
        role="img"
        aria-label={ariaLabel}
      >
        {children}
      </svg>
      {overlay && (
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="absolute inset-0 h-full w-full"
          role="group"
          aria-label={overlayLabel}
        >
          {overlay}
        </svg>
      )}
    </div>
  );
}

/**
 * Atributos de una marca SVG pulsable: foco con el tabulador, rol de botón y
 * activación con Enter o Espacio, como un `<button>`.
 */
export function pressableProps(label: string, onActivate: () => void) {
  return {
    role: "button" as const,
    tabIndex: 0,
    "aria-label": label,
    onClick: onActivate,
    onKeyDown: (event: KeyboardEvent<SVGElement>) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        onActivate();
      }
    },
  };
}

/** Clases de la tabla alternativa, las de `settlement-chart.tsx`. */
export const TABLE_HEAD_ROW = "border-b border-rule text-left text-xs text-ink-2";
export const TABLE_TH = "py-2 pr-3 font-medium";
export const TABLE_ROW = "border-b border-rule last:border-0";
export const TABLE_TD = "py-2 pr-3 text-ink-2 tabular-nums";

/**
 * Alternativa textual: la misma información que la gráfica, en una tabla
 * plegada bajo «Ver datos en tabla».
 */
export function DataTableDetails({
  caption,
  children,
}: {
  caption: string;
  children: ReactNode;
}) {
  return (
    <details className="text-sm">
      <summary className="cursor-pointer select-none font-medium text-ink hover:underline">
        Ver datos en tabla
      </summary>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full text-sm">
          <caption className="sr-only">{caption}</caption>
          {children}
        </table>
      </div>
    </details>
  );
}
