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

/** Ancho con que se dibuja antes de medir el contenedor (y en el servidor). */
export const FALLBACK_WIDTH = 640;
/** Por debajo de este ancho la gráfica se escala en vez de estrecharse más. */
const MIN_WIDTH = 260;

/** Tamaño del texto de ejes y rótulos, en píxeles reales (≥ 11 a 390 px). */
export const FONT_SIZE = 12;
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

/** Ancho aproximado de un texto, para decidir si un rótulo cabe. */
export function textWidth(text: string, fontSize: number = FONT_SIZE): number {
  return text.length * fontSize * 0.6;
}

// --- Formato ---

/** Signo menos tipográfico: el guion se confunde con un separador. */
function withMinus(text: string): string {
  return text.replace(/^-/, "−");
}

/** mm con un decimal, en es-CO («−12,3»). Un −0,0 se muestra como 0,0. */
export function formatMm(value: number): string {
  const text = value.toLocaleString("es-CO", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
  return text === "-0,0" ? "0,0" : withMinus(text);
}

/** Valor de un umbral, sin decimales si no los tiene («−25», «−12,5»). */
export function formatThresholdMm(value: number): string {
  return withMinus(value.toLocaleString("es-CO", { maximumFractionDigits: 1 }));
}

/** Rótulo de una marca del eje Y, con los decimales que pida el paso. */
function formatTick(value: number, step: number): string {
  const decimals =
    step >= 1 ? 0 : Math.min(4, Math.ceil(-Math.log10(step) - 1e-9));
  const text = value.toLocaleString("es-CO", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  return /^-0(,0*)?$/.test(text) ? text.slice(1) : withMinus(text);
}

/**
 * Meses abreviados fijos, no los de `Intl`: el ICU del servidor y el del
 * navegador no siempre coinciden («sep» / «sept») y la diferencia rompería la
 * hidratación.
 */
const MONTHS = [
  "ene",
  "feb",
  "mar",
  "abr",
  "may",
  "jun",
  "jul",
  "ago",
  "sep",
  "oct",
  "nov",
  "dic",
];

function splitIso(iso: string): [number, number, number] | null {
  const [year, month, day] = iso.split("-").map(Number);
  if (!year || !month || !day) return null;
  return [year, month, day];
}

/** «7 ene 2025». Sin zona horaria: una fecha sin hora no se desplaza. */
export function shortDate(iso: string): string {
  const parts = splitIso(iso);
  if (!parts) return iso;
  const [year, month, day] = parts;
  return `${day} ${MONTHS[month - 1]} ${year}`;
}

/**
 * Rótulos de las marcas de un eje de fechas: «7 ene», con el año en la
 * primera y cada vez que cambia («3 ene 2026»).
 */
export function timeTickLabels(ticks: string[]): string[] {
  let lastYear: number | null = null;
  return ticks.map((iso) => {
    const parts = splitIso(iso);
    if (!parts) return iso;
    const [year, month, day] = parts;
    const label =
      year === lastYear ? `${day} ${MONTHS[month - 1]}` : `${day} ${MONTHS[month - 1]} ${year}`;
    lastYear = year;
    return label;
  });
}

// --- Rótulos del eje X ---

/**
 * Qué rótulos de un eje X se dibujan: de izquierda a derecha, uno que se
 * montaría sobre el anterior se omite. Los extremos anclan hacia adentro.
 */
export function fitXLabels(
  items: { x: number; label: string }[],
  plotWidth: number,
): { x: number; label: string; anchor: "start" | "middle" | "end" }[] {
  const out: { x: number; label: string; anchor: "start" | "middle" | "end" }[] = [];
  let lastRight = -Infinity;
  for (const item of items) {
    const w = textWidth(item.label);
    const anchor =
      item.x - w / 2 < 0 ? "start" : item.x + w / 2 > plotWidth ? "end" : "middle";
    const left = anchor === "start" ? item.x : anchor === "end" ? item.x - w : item.x - w / 2;
    if (left < lastRight + 8) continue;
    out.push({ ...item, anchor });
    lastRight = left + w;
  }
  return out;
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
        className="stroke-neutral-200"
        strokeWidth={1}
      />
      {fitted.map((tick) => (
        <g key={`${tick.x}-${tick.label}`}>
          <line
            x1={tick.x}
            x2={tick.x}
            y1={plotHeight}
            y2={plotHeight + 4}
            className="stroke-neutral-400"
            strokeWidth={1}
          />
          <text
            x={tick.x}
            y={plotHeight + 18}
            textAnchor={tick.anchor}
            fontSize={FONT_SIZE}
            className="fill-neutral-500"
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
          className="fill-neutral-500"
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
              className="stroke-neutral-100"
              strokeWidth={1}
            />
            <text
              x={-8}
              y={y}
              textAnchor="end"
              dominantBaseline="middle"
              fontSize={FONT_SIZE}
              className="fill-neutral-500"
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
        className="stroke-neutral-400"
        strokeWidth={1.5}
      />
      <text
        transform={`translate(${-marginLeft + 14},${plotHeight / 2}) rotate(-90)`}
        textAnchor="middle"
        fontSize={FONT_SIZE}
        className="fill-neutral-500"
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

/** Halo blanco del texto que cae sobre la rejilla o los datos. */
export const HALO = {
  stroke: "white",
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
}: {
  thresholds: PlacedThreshold[];
  yScale: (value: number) => number;
  plotWidth: number;
  plotHeight: number;
  showLabels?: boolean;
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
                x={plotWidth - 4}
                y={labelY}
                textAnchor="end"
                fontSize={SMALL_FONT_SIZE}
                className="fill-neutral-800"
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
export const TABLE_HEAD_ROW = "border-b border-neutral-100 text-left text-xs text-neutral-500";
export const TABLE_TH = "py-2 pr-3 font-medium";
export const TABLE_ROW = "border-b border-neutral-100 last:border-0";
export const TABLE_TD = "py-2 pr-3 text-neutral-700 tabular-nums";

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
      <summary className="cursor-pointer select-none font-medium text-primary-600 hover:underline">
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
