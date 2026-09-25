// Catálogo de marcadores de serie para las gráficas.
//
// Vive fuera del componente para poder testearlo: el proyecto no tiene
// infraestructura de tests de componentes (`vitest` corre en entorno `node`),
// y lo que importa aquí no es el SVG sino la regla — cuántas formas distintas
// hay y a partir de qué serie se repiten.

/**
 * Formas de marcador, una por serie.
 *
 * Son DIEZ porque la forma es el único canal que queda con acromatopsia, y el
 * marco teórico de este dominio dimensiona los catálogos en 9 puntos (grilla
 * 3×3 del edificio) y 10 (presa). Con menos formas, seleccionar el catálogo
 * completo daba dos series con el mismo marcador.
 *
 * Las siluetas son deliberadamente distintas entre sí: relleno vs hueco no
 * basta cuando el problema es de forma.
 */
export const SERIES_MARKERS = [
  "circle",
  "square",
  "triangle",
  "diamond",
  "cross",
  "triangle-down",
  "plus",
  "star",
  "ring",
  "square-hollow",
] as const;

export type SeriesMarker = (typeof SERIES_MARKERS)[number];

/**
 * Colores de refuerzo. Canal SECUNDARIO: nunca el único.
 *
 * Tokens y no hexadecimales (Fase 20): la gráfica sigue al tema, y al
 * imprimir sale en claro. Los cuatro cumplen 3:1 como gráfico sobre la
 * tarjeta en los dos temas (`pairings.test.ts`).
 */
export const SERIES_COLORS = [
  "var(--color-ink)",
  "var(--color-mira-strong)",
  "var(--color-success)",
  "var(--color-danger)",
] as const;

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

function lcm(a: number, b: number): number {
  return (a * b) / gcd(a, b);
}

/**
 * A partir de esta cantidad de series, alguna pareja repite forma **y** color
 * a la vez: `mcm(formas, colores)`.
 */
export const MAX_DISTINGUISHABLE_SERIES = lcm(
  SERIES_MARKERS.length,
  SERIES_COLORS.length,
);

/** Forma y color de la serie `index`. */
export function seriesStyle(index: number): {
  shape: SeriesMarker;
  color: string;
} {
  return {
    shape: SERIES_MARKERS[index % SERIES_MARKERS.length] ?? "circle",
    color: SERIES_COLORS[index % SERIES_COLORS.length] ?? "var(--color-ink)",
  };
}
