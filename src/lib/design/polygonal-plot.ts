// Geometría del dibujo de la poligonal (Fase 13). Funciones puras: sin React.
//
// Separada del componente por la misma razón que `chart-scale.ts`: es la
// parte que puede equivocarse en silencio —un factor mal elegido o un eje
// escalado aparte deforman el dibujo sin que nada falle— y así se prueba sin
// renderizar.

import type { TracePoint } from "@/lib/calculations/polygonal";

/**
 * Qué fracción de la extensión del dibujo ocupa el mayor desplazamiento una vez
 * exagerado. Decisión con nombre, como las de la Fase 12: 5 % se ve sin
 * deformar la figura. Ver docs/prds/12-canvas-poligonal.md, «El factor de
 * exageración».
 */
export const EXAGGERATION_TARGET_FRACTION = 0.05;

export interface PlanePoint {
  north: number;
  east: number;
}

/** El mayor número «redondo» (1, 2 o 5 × 10ⁿ) que no supera `value`. */
export function niceFloor(value: number): number {
  const power = 10 ** Math.floor(Math.log10(value));
  for (const step of [5, 2, 1]) {
    if (step * power <= value * (1 + 1e-12)) return step * power;
  }
  return power;
}

/**
 * Factor ×k con que se exagera la poligonal sin compensar: el mayor número
 * redondo que lleva el mayor desplazamiento al 5 % de la extensión mayor de la
 * ajustada, **nunca menor que 1** (un error que ya se ve no se encoge).
 *
 * `null` si no hay desplazamiento: cierre perfecto o abierta sin control, donde
 * no hay trazo sin compensar que dibujar.
 */
export function exaggerationFactor(traces: TracePoint[]): number | null {
  let maxShift = 0;
  for (const t of traces) {
    maxShift = Math.max(
      maxShift,
      Math.hypot(t.unadjusted.north - t.adjusted.north, t.unadjusted.east - t.adjusted.east),
    );
  }
  // 1 µm: por debajo, es residuo de punto flotante y no una corrección.
  if (maxShift < 1e-6) return null;

  const norths = traces.map((t) => t.adjusted.north);
  const easts = traces.map((t) => t.adjusted.east);
  const extent = Math.max(
    Math.max(...norths) - Math.min(...norths),
    Math.max(...easts) - Math.min(...easts),
  );
  const raw = (EXAGGERATION_TARGET_FRACTION * extent) / maxShift;
  return raw < 1 ? 1 : niceFloor(raw);
}

/** Cada vértice sin compensar, desplazado ×k desde su posición ajustada. */
export function exaggeratedPoints(traces: TracePoint[], k: number): PlanePoint[] {
  return traces.map((t) => ({
    north: t.adjusted.north + k * (t.unadjusted.north - t.adjusted.north),
    east: t.adjusted.east + k * (t.unadjusted.east - t.adjusted.east),
  }));
}

export interface PlotFrame {
  /** Metros por píxel, IGUAL en los dos ejes: es un plano, no una gráfica. */
  metersPerPixel: number;
  toX: (east: number) => number;
  toY: (north: number) => number;
  /** Rango visible en coordenadas del terreno. */
  east: [number, number];
  north: [number, number];
}

/**
 * Encuadre de los puntos en un lienzo de `width × height` con margen `padding`,
 * con **proporción 1:1**: escalar Norte y Este por separado deformaría los
 * ángulos, que son lo que se midió. El Norte crece hacia arriba.
 *
 * `zoom` (≥ 1 acerca) y `center` permiten el acercamiento del editor; sin
 * ellos, el encuadre muestra todos los puntos.
 */
export function plotFrame(
  points: PlanePoint[],
  width: number,
  height: number,
  padding: number,
  view: { zoom?: number; center?: PlanePoint } = {},
): PlotFrame {
  const norths = points.map((p) => p.north);
  const easts = points.map((p) => p.east);
  const minN = Math.min(...norths);
  const maxN = Math.max(...norths);
  const minE = Math.min(...easts);
  const maxE = Math.max(...easts);
  // Un solo punto no tiene extensión: se le da 1 m para no dividir por cero.
  const spanN = Math.max(maxN - minN, 1);
  const spanE = Math.max(maxE - minE, 1);

  const usableW = width - 2 * padding;
  const usableH = height - 2 * padding;
  const zoom = view.zoom ?? 1;
  const metersPerPixel = Math.max(spanE / usableW, spanN / usableH) / zoom;
  const center = view.center ?? { north: (minN + maxN) / 2, east: (minE + maxE) / 2 };

  const halfW = (width / 2) * metersPerPixel;
  const halfH = (height / 2) * metersPerPixel;
  return {
    metersPerPixel,
    toX: (e) => width / 2 + (e - center.east) / metersPerPixel,
    toY: (n) => height / 2 - (n - center.north) / metersPerPixel,
    east: [center.east - halfW, center.east + halfW],
    north: [center.north - halfH, center.north + halfH],
  };
}

/** Longitud redonda de la barra de escala, en metros, cercana a `targetPixels`. */
export function scaleBarMeters(metersPerPixel: number, targetPixels: number): number {
  return niceFloor(metersPerPixel * targetPixels);
}
