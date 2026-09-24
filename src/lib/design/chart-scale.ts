// Escalas para las gráficas SVG. Funciones puras, sin dependencias: el
// proyecto no usa librerías de gráficas (misma regla que el sistema de diseño).

/**
 * Escala lineal de un dominio a un rango.
 *
 * El rango puede ir invertido (`[alto, 0]`), que es lo normal en el eje Y de un
 * SVG, donde y crece hacia abajo.
 *
 * Un dominio degenerado (min = max) devuelve el centro del rango en vez de
 * dividir por cero: ocurre con un solo punto de datos.
 */
export function linearScale(
  [domainMin, domainMax]: [number, number],
  [rangeMin, rangeMax]: [number, number],
): (value: number) => number {
  const domainSpan = domainMax - domainMin;
  if (domainSpan === 0) {
    const center = (rangeMin + rangeMax) / 2;
    return () => center;
  }
  const rangeSpan = rangeMax - rangeMin;
  return (value) => rangeMin + ((value - domainMin) / domainSpan) * rangeSpan;
}

/** Marcas «redondas» que cubren [min, max], aproximadamente `count`. */
export function niceTicks(min: number, max: number, count: number): number[] {
  if (min === max) {
    // Un valor único: una marca a cada lado para que el eje tenga sentido.
    const step = Math.abs(min) > 0 ? Math.abs(min) / 2 : 1;
    return [min - step, min, min + step];
  }

  const span = max - min;
  const rawStep = span / Math.max(1, count);
  const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  const normalized = rawStep / magnitude;
  const niceNormalized =
    normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  const step = niceNormalized * magnitude;

  const start = Math.floor(min / step) * step;
  const end = Math.ceil(max / step) * step;

  const ticks: number[] = [];
  for (let t = start; t <= end + step / 2; t += step) {
    ticks.push(Number(t.toFixed(10)));
  }
  return ticks;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Día (entero, UTC) de una fecha ISO `YYYY-MM-DD`, contado desde 1970-01-01. */
export function isoDay(iso: string): number {
  return Math.round(Date.parse(`${iso}T00:00:00Z`) / MS_PER_DAY);
}

/** Fecha ISO `YYYY-MM-DD` de un día contado desde 1970-01-01 (UTC). */
function dayToIso(day: number): string {
  return new Date(day * MS_PER_DAY).toISOString().slice(0, 10);
}

/**
 * Escala de fechas ISO a un rango, lineal en DÍAS (Fase 18). Con visitas
 * irregulares el eje por índice de visita exagera la pendiente de los
 * intervalos largos; el tiempo real no.
 */
export function timeScale(
  dates: string[],
  range: [number, number],
): (iso: string) => number {
  const days = dates.map(isoDay);
  const scale = linearScale([Math.min(...days), Math.max(...days)], range);
  return (iso) => scale(isoDay(iso));
}

/** Unas `count` fechas «redondas» (en días) entre `first` y `last`, incluidas. */
export function timeTicks(first: string, last: string, count: number): string[] {
  const a = isoDay(first);
  const b = isoDay(last);
  if (a === b) return [first];
  return niceTicks(a, b, count)
    .filter((d) => d >= a && d <= b)
    .map(dayToIso);
}
