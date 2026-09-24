"use client";

import { useRef, useState, type PointerEvent } from "react";
import { Button } from "@/components/design-system";
import {
  DEFAULT_VIEW,
  PLOT_WIDTH,
  PolygonalPlot,
  type PlotView,
} from "@/components/polygonal/polygonal-plot";
import type { PolygonalInput, PolygonalResult } from "@/types/polygonal";

const ZOOM_STEP = 2;
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
      // Píxeles de pantalla → unidades del viewBox.
      scale: PLOT_WIDTH / svg.getBoundingClientRect().width,
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
        <span className="text-xs text-neutral-500">
          {view.zoom > 1 ? `Acercamiento ×${view.zoom}. ` : ""}Arrastra el dibujo para desplazarlo.
        </span>
      </div>
      <div
        className="cursor-grab active:cursor-grabbing"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <PolygonalPlot input={input} result={result} reference={reference} view={view} />
      </div>
    </div>
  );
}
