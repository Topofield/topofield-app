"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
} from "react";
import {
  DEFAULT_VIEW,
  PLOT_WIDTH,
  PolygonalPlot,
  type PlotView,
} from "@/components/polygonal/polygonal-plot";
import { MAX_PLOT_ZOOM, zoomAt } from "@/lib/design/polygonal-plot";
import { cn } from "@/lib/utils/cn";

import type { PolygonalInput, PolygonalResult } from "@/types/polygonal";

/**
 * Alto del dibujo para un ancho dado: 2:3, pero nunca menos de 320 px, para
 * que en un teléfono la figura no quede aplastada.
 */
function heightFor(width: number): number {
  return Math.max(320, Math.round((width * 2) / 3));
}

const ZOOM_STEP = 2;
/** Cuánto desplaza cada flecha del teclado, en fracción del ancho visible. */
const PAN_FRACTION = 0.2;
/** Sensibilidad de Ctrl + rueda: un paso de rueda (100 px) acerca ×1,22. */
const WHEEL_SENSITIVITY = 0.002;
/** Cuánto se ve el aviso de Ctrl + rueda. */
const HINT_MS = 1500;

interface PolygonalPlotViewerProps {
  input: PolygonalInput;
  result: PolygonalResult;
  reference?: { code: string; north: number; east: number } | null;
  /** Lo medido, sin ajustar: ver `PolygonalPlot`. */
  field?: boolean;
}

/**
 * El dibujo de la poligonal, que se mueve como un mapa (Fase 41): arrastrar
 * desplaza; Ctrl + rueda, doble clic y pellizcar acercan hacia el punto; los
 * botones + / − y encuadrar flotan sobre el dibujo, y con el foco en él las
 * flechas, + / − y 0 hacen lo mismo. La rueda sola sigue bajando la página
 * del editor, que es larga. El factor de exageración no cambia al acercarse.
 */
export function PolygonalPlotViewer({ input, result, reference, field }: PolygonalPlotViewerProps) {
  const [view, setView] = useState<PlotView>(DEFAULT_VIEW);
  // El dibujo se hace con el ancho REAL del contenedor, para que una unidad
  // del viewBox sea un píxel: con un viewBox fijo de 720, en un teléfono de
  // 390 px el texto se encogía a menos de la mitad y era ilegible.
  const container = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(PLOT_WIDTH);
  useEffect(() => {
    const el = container.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setWidth(Math.max(280, Math.round(entry.contentRect.width)));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  const height = heightFor(width);

  const viewport = useRef<HTMLDivElement>(null);
  /** Los punteros apoyados, en coordenadas de pantalla. */
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const [hint, setHint] = useState<string | null>(null);
  const hintTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  /**
   * Un punto de la pantalla, medido desde el centro del dibujo en unidades
   * del viewBox (≈ píxeles con el ancho real).
   */
  function fromCenter(clientX: number, clientY: number): { dx: number; dy: number; scale: number } {
    const rect = viewport.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return { dx: 0, dy: 0, scale: 1 };
    const scale = width / rect.width;
    return {
      dx: (clientX - rect.left) * scale - width / 2,
      dy: (clientY - rect.top) * scale - height / 2,
      scale,
    };
  }

  // Ctrl + rueda acerca; la rueda sola baja la página y avisa. React registra
  // `onWheel` como pasivo y no deja cancelar el desplazamiento: va a mano.
  const wheelHandler = useRef<(event: WheelEvent) => void>(() => {});
  useEffect(() => {
    wheelHandler.current = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) {
        const mac = /Mac|iPhone|iPad/.test(navigator.platform);
        setHint(`Usa ${mac ? "⌘" : "Ctrl"} + rueda para acercar`);
        clearTimeout(hintTimer.current);
        hintTimer.current = setTimeout(() => setHint(null), HINT_MS);
        return;
      }
      event.preventDefault();
      setHint(null);
      // Las ruedas por líneas (Firefox) dan ~3 por paso, no ~100.
      const delta = event.deltaMode === 1 ? event.deltaY * 33 : event.deltaY;
      const { dx, dy } = fromCenter(event.clientX, event.clientY);
      setView((v) => zoomAt(v, Math.exp(-delta * WHEEL_SENSITIVITY), dx, dy));
    };
  });
  // Ref de callback y no un efecto al montar: el dibujo aparece después si
  // la primera vez faltaban datos, y el efecto se quedaba sin elemento.
  const viewportRef = useCallback((el: HTMLDivElement | null) => {
    viewport.current = el;
    if (!el) return;
    const listener = (event: WheelEvent) => wheelHandler.current(event);
    el.addEventListener("wheel", listener, { passive: false });
    return () => el.removeEventListener("wheel", listener);
  }, []);
  useEffect(() => () => clearTimeout(hintTimer.current), []);

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
  }

  // Un puntero desplaza; dos pellizcan alrededor de su punto medio, que
  // además arrastra el dibujo.
  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    const map = pointers.current;
    const last = map.get(event.pointerId);
    if (!last) return;
    const others = [...map].filter(([id]) => id !== event.pointerId).map(([, p]) => p);
    const now = { x: event.clientX, y: event.clientY };
    map.set(event.pointerId, now);

    if (others.length === 0) {
      const { scale } = fromCenter(now.x, now.y);
      setView((v) => ({
        ...v,
        offsetX: v.offsetX + (now.x - last.x) * scale,
        offsetY: v.offsetY + (now.y - last.y) * scale,
      }));
      return;
    }
    const other = others[0]!;
    const before = Math.hypot(last.x - other.x, last.y - other.y);
    const after = Math.hypot(now.x - other.x, now.y - other.y);
    if (before === 0) return;
    const midBefore = { x: (last.x + other.x) / 2, y: (last.y + other.y) / 2 };
    const midAfter = { x: (now.x + other.x) / 2, y: (now.y + other.y) / 2 };
    const { dx, dy, scale } = fromCenter(midAfter.x, midAfter.y);
    setView((v) => {
      const moved = {
        ...v,
        offsetX: v.offsetX + (midAfter.x - midBefore.x) * scale,
        offsetY: v.offsetY + (midAfter.y - midBefore.y) * scale,
      };
      return zoomAt(moved, after / before, dx, dy);
    });
  }

  function onPointerUp(event: PointerEvent<HTMLDivElement>) {
    pointers.current.delete(event.pointerId);
  }

  function onDoubleClick(event: { clientX: number; clientY: number }) {
    const { dx, dy } = fromCenter(event.clientX, event.clientY);
    setView((v) => zoomAt(v, ZOOM_STEP, dx, dy));
  }

  // Mover la vista hacia el Norte baja el dibujo, de ahí el signo.
  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const step = width * PAN_FRACTION;
    const pan: Record<string, [number, number]> = {
      ArrowLeft: [step, 0],
      ArrowRight: [-step, 0],
      ArrowUp: [0, step],
      ArrowDown: [0, -step],
    };
    const delta = pan[event.key];
    if (delta) {
      setView((v) => ({ ...v, offsetX: v.offsetX + delta[0], offsetY: v.offsetY + delta[1] }));
    } else if (event.key === "+" || event.key === "=") {
      setView((v) => zoomAt(v, ZOOM_STEP));
    } else if (event.key === "-" || event.key === "_") {
      setView((v) => zoomAt(v, 1 / ZOOM_STEP));
    } else if (event.key === "0") {
      setView(DEFAULT_VIEW);
    } else {
      return;
    }
    event.preventDefault();
  }

  const moved = view.zoom !== 1 || view.offsetX !== 0 || view.offsetY !== 0;

  // Los controles no arrastran ni acercan con doble clic: paran el evento.
  const controls = (
    <div
      className="absolute right-3 bottom-3 flex flex-col items-end gap-2"
      onPointerDown={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
    >
      {moved && (
        <MapButton label="Encuadrar la poligonal" onClick={() => setView(DEFAULT_VIEW)} className="rounded-md">
          <FrameIcon />
        </MapButton>
      )}
      <div className="flex flex-col overflow-hidden rounded-md border border-rule bg-card shadow-md">
        <MapButton
          label="Acercar"
          onClick={() => setView((v) => zoomAt(v, ZOOM_STEP))}
          disabled={view.zoom >= MAX_PLOT_ZOOM}
          bare
        >
          <path d="M9 4v10M4 9h10" />
        </MapButton>
        <span className="mx-2 h-px bg-rule" aria-hidden />
        <MapButton
          label="Alejar"
          onClick={() => setView((v) => zoomAt(v, 1 / ZOOM_STEP))}
          disabled={view.zoom <= 1}
          bare
        >
          <path d="M4 9h10" />
        </MapButton>
      </div>
    </div>
  );

  const overlay = (
    <>
      <div
        aria-hidden={!hint}
        className={cn(
          "pointer-events-none absolute inset-0 flex items-center justify-center rounded-md bg-black/40 transition-opacity duration-300 motion-reduce:transition-none",
          hint ? "opacity-100" : "opacity-0",
        )}
      >
        <span className="mx-4 rounded-md bg-ink px-4 py-2 text-center text-sm font-medium text-paper shadow-md">{hint}</span>
      </div>
      {controls}
    </>
  );

  return (
    <div ref={container}>
      <PolygonalPlot
        input={input}
        result={result}
        reference={reference}
        view={view}
        width={width}
        height={height}
        field={field}
        viewport={{
          props: {
            ref: viewportRef,
            tabIndex: 0,
            role: "group",
            "aria-label":
              "Dibujo de la poligonal. Arrastra para desplazarlo; Ctrl + rueda, doble clic o pellizcar para acercar. Con el teclado: flechas para desplazar, + y − para acercar y alejar, 0 para encuadrar.",
            className:
              "cursor-grab rounded-md active:cursor-grabbing focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mira-strong",
            onPointerDown,
            onPointerMove,
            onPointerUp,
            onPointerCancel: onPointerUp,
            onDoubleClick,
            onKeyDown,
          },
          overlay,
        }}
      />
    </div>
  );
}

/** Un botón cuadrado del control flotante, con un icono de 18 px. */
function MapButton({
  label,
  onClick,
  disabled,
  bare,
  className,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  /** Dentro del grupo + / −, que ya lleva borde y sombra. */
  bare?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex size-10 cursor-pointer items-center justify-center bg-card text-ink transition-colors hover:bg-sel disabled:cursor-not-allowed disabled:text-ink-3 disabled:hover:bg-card",
        !bare && "border border-rule shadow-md",
        className,
      )}
    >
      <svg
        width={18}
        height={18}
        viewBox="0 0 18 18"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        {children}
      </svg>
    </button>
  );
}

/** Cuatro esquinas: volver a ver toda la poligonal. */
function FrameIcon() {
  return <path d="M3 7V3h4M11 3h4v4M15 11v4h-4M7 15H3v-4" />;
}
