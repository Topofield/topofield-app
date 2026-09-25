"use client";

import { useEffect, useRef, useState, type PointerEvent } from "react";
import { Button } from "@/components/design-system";
import {
  DEFAULT_VIEW,
  PLOT_WIDTH,
  PolygonalPlot,
  type PlotView,
} from "@/components/polygonal/polygonal-plot";

import type { PolygonalInput, PolygonalResult } from "@/types/polygonal";

/**
 * Alto del dibujo para un ancho dado: 2:3, pero nunca menos de 320 px, para
 * que en un teléfono la figura no quede aplastada.
 */
function heightFor(width: number): number {
  return Math.max(320, Math.round((width * 2) / 3));
}

const ZOOM_STEP = 2;
/** Cuánto desplaza cada botón de flecha, en fracción del ancho visible. */
const PAN_FRACTION = 0.2;
const MAX_ZOOM = 256;

interface PolygonalPlotViewerProps {
  input: PolygonalInput;
  result: PolygonalResult;
  reference?: { code: string; north: number; east: number } | null;
}

/**
 * El dibujo de la poligonal con acercar, alejar, restablecer y arrastrar
 * (Fase 13). Sin zoom con la rueda: capturaría el desplazamiento de la página
 * del editor, que es larga. El factor de exageración no cambia al acercarse.
 */
export function PolygonalPlotViewer({ input, result, reference }: PolygonalPlotViewerProps) {
  const [view, setView] = useState<PlotView>(DEFAULT_VIEW);
  const drag = useRef<{ x: number; y: number; view: PlotView; scale: number } | null>(null);
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

  // Acercar alrededor del centro visible: el desplazamiento, en píxeles del
  // dibujo, escala con el zoom para que el mismo punto quede en el centro.
  function zoomBy(factor: number) {
    setView((v) => {
      const zoom = Math.min(MAX_ZOOM, Math.max(1, v.zoom * factor));
      const applied = zoom / v.zoom;
      return { zoom, offsetX: v.offsetX * applied, offsetY: v.offsetY * applied };
    });
  }

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    const svg = event.currentTarget.querySelector("svg");
    if (!svg) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = {
      x: event.clientX,
      y: event.clientY,
      view,
      // Píxeles de pantalla → unidades del viewBox (≈ 1 con el ancho real).
      scale: width / svg.getBoundingClientRect().width,
    };
  }

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    const d = drag.current;
    if (!d) return;
    setView({
      ...d.view,
      offsetX: d.view.offsetX + (event.clientX - d.x) * d.scale,
      offsetY: d.view.offsetY + (event.clientY - d.y) * d.scale,
    });
  }

  function onPointerUp() {
    drag.current = null;
  }

  // Desplazar con botones: el arrastre no es accesible con el teclado.
  // Mover la vista hacia el Norte baja el dibujo, de ahí el signo.
  function panBy(dx: number, dy: number) {
    const step = width * PAN_FRACTION;
    setView((v) => ({ ...v, offsetX: v.offsetX - dx * step, offsetY: v.offsetY - dy * step }));
  }

  const moved = view.zoom !== 1 || view.offsetX !== 0 || view.offsetY !== 0;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="secondary" onClick={() => zoomBy(ZOOM_STEP)} disabled={view.zoom >= MAX_ZOOM}>
          Acercar
        </Button>
        <Button size="sm" variant="secondary" onClick={() => zoomBy(1 / ZOOM_STEP)} disabled={view.zoom <= 1}>
          Alejar
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setView(DEFAULT_VIEW)} disabled={!moved}>
          Restablecer
        </Button>
        <span role="group" aria-label="Desplazar el dibujo" className="inline-flex gap-1">
          <Button size="sm" variant="ghost" aria-label="Desplazar al oeste" onClick={() => panBy(-1, 0)}>←</Button>
          <Button size="sm" variant="ghost" aria-label="Desplazar al norte" onClick={() => panBy(0, -1)}>↑</Button>
          <Button size="sm" variant="ghost" aria-label="Desplazar al sur" onClick={() => panBy(0, 1)}>↓</Button>
          <Button size="sm" variant="ghost" aria-label="Desplazar al este" onClick={() => panBy(1, 0)}>→</Button>
        </span>
        <span className="text-xs text-ink-2">
          {view.zoom > 1 ? `Acercamiento ×${view.zoom}. ` : ""}Arrastra el dibujo o usa las flechas para desplazarlo.
        </span>
      </div>
      <div
        ref={container}
        className="cursor-grab active:cursor-grabbing"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <PolygonalPlot
          input={input}
          result={result}
          reference={reference}
          view={view}
          width={width}
          height={heightFor(width)}
        />
      </div>
    </div>
  );
}
