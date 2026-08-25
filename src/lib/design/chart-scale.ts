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
