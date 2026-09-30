// Formato y rótulos de las gráficas de asentamientos (Fase 22).
//
// Funciones puras que vivían en `components/settlement/charts/chart-parts.tsx`.
// Ese módulo es un Client Component, y la gráfica del informe —que se dibuja
// en el servidor— no puede llamar funciones de un módulo cliente. Aquí las
// usan las dos; `chart-parts` las reexporta.

/** Tamaño del texto de ejes y rótulos, en píxeles reales (≥ 11 a 390 px). */
export const FONT_SIZE = 12;

/** Ancho aproximado de un texto, para decidir si un rótulo cabe. */
export function textWidth(text: string, fontSize: number = FONT_SIZE): number {
  return text.length * fontSize * 0.6;
}

// --- Formato ---
//
// Con punto decimal y guion, como las tablas y los KPIs (Fase 22). Las
// gráficas escribían «−9,3» (coma de es-CO y menos tipográfico) junto a
// tablas con «-9.3»; la Fase 20 fijó el punto para la presentación.

/** Un cero negativo redondeado («-0.0») sin signo. */
function sinCeroNegativo(text: string): string {
  return /^-0(\.0*)?$/.test(text) ? text.slice(1) : text;
}

/** mm con un decimal («-12.3»). */
export function formatMm(value: number): string {
  return sinCeroNegativo(value.toFixed(1));
}

/** Valor de un umbral, sin decimales si no los tiene («-25», «-12.5»). */
export function formatThresholdMm(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

/** Rótulo de una marca del eje Y, con los decimales que pida el paso. */
export function formatTick(value: number, step: number): string {
  const decimals =
    step >= 1 ? 0 : Math.min(4, Math.ceil(-Math.log10(step) - 1e-9));
  return sinCeroNegativo(value.toFixed(decimals));
}

/**
 * Meses abreviados fijos, no los de `Intl`: el ICU del servidor y el del
 * navegador no siempre coinciden («sep» / «sept») y la diferencia rompería la
 * hidratación.
 */
export const MONTHS = [
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

export function splitIso(iso: string): [number, number, number] | null {
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
