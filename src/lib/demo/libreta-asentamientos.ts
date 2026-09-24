// Genera la libreta de nivelación de una visita de asentamientos para el seed
// y el proyecto demo (Fase 18). Puro y determinista.
//
// Se construye HACIA ATRÁS: se parte de las cotas que la visita debe dar —la
// serie del seed o del fixture— y se eligen las lecturas para que, al pasar la
// libreta por el motor, las cotas COMPENSADAS de los puntos de control sean
// exactamente esas (a la resolución de la base). Así la libreta no cambia las
// series ni los escenarios que el seed ya verifica: la libreta es la causa y
// la serie la consecuencia, pero los números salen iguales.

import { levelingTolerance } from "@/lib/calculations/tolerances";
import type { PrecisionOrder } from "@/types/project";
import type { BookRowPayload } from "@/types/settlement";

export interface GeneratedBookSpec {
  amarre: { code: string; elevation: number };
  /** Cota compensada que debe salir para cada punto de control, en orden de medición. */
  targets: { code: string; elevation: number }[];
  /** Error de cierre deseado, en mm; múltiplo de 0.1 (la resolución de la mira). */
  closureMm: number;
  order: PrecisionOrder;
  seed: number;
  /** Puntos de control por armada; 4, como en el prototipo. */
  perSetup?: number;
}

/** Generador congruencial de Lehmer, el del prototipo: reproducible sin dependencias. */
function lehmer(seed: number): () => number {
  let state = Math.max(1, Math.floor(seed) % 2147483647);
  return () => {
    state = (state * 16807) % 2147483647;
    return state / 2147483647;
  };
}

const round = (v: number, d: number) => Number(v.toFixed(d));

function row(
  pointCode: string,
  pointType: BookRowPayload["pointType"],
  fields: Partial<BookRowPayload> = {},
): BookRowPayload {
  return {
    pointCode,
    pointType,
    backsight: null,
    foresight: null,
    backUpperM: null,
    backLowerM: null,
    foreUpperM: null,
    foreLowerM: null,
    backDistanceM: null,
    foreDistanceM: null,
    ...fields,
  };
}

/**
 * La libreta: amarre, una armada por cada `perSetup` puntos de control (como
 * vistas intermedias), un punto de cambio `CP-n` entre armadas y el cierre en
 * el amarre con `closureMm` de error.
 *
 * Por qué sale exacta: la compensación de una intermedia es −E·d/D, con d la
 * distancia acumulada de su armada (Fase 9), así que la cota calculada que
 * hay que provocar es `objetivo + E·d/D`. Si el cierre no cumple la
 * tolerancia el motor no compensa, y entonces la calculada es la objetivo.
 */
export function generateVisitBook(spec: GeneratedBookSpec): BookRowPayload[] {
  const rnd = lehmer(spec.seed);
  const per = spec.perSetup ?? 4;
  const chunks: GeneratedBookSpec["targets"][] = [];
  for (let i = 0; i < spec.targets.length; i += per) {
    chunks.push(spec.targets.slice(i, i + per));
  }
  if (chunks.length === 0) chunks.push([]);

  const back = chunks.map(() => round(28 + rnd() * 17, 3));
  const fore = chunks.map(() => round(28 + rnd() * 17, 3));
  const totalM = back.reduce((a, b) => a + b, 0) + fore.reduce((a, b) => a + b, 0);
  const closureM = spec.closureMm / 1000;
  const compensates =
    Math.abs(spec.closureMm) <= levelingTolerance(spec.order, totalM / 1000);
  const correction = (accumulatedM: number) =>
    compensates ? (-closureM * accumulatedM) / totalM : 0;

  const rows: BookRowPayload[] = [];
  let start = spec.amarre.elevation;
  let accumulated = 0;

  chunks.forEach((chunk, k) => {
    // La AI queda entre 0.6 y 1.4 m por encima del punto más alto de la
    // armada: todas las lecturas caen dentro de la mira.
    const highest = Math.max(start, ...chunk.map((t) => t.elevation));
    const backsight = round(highest + 0.6 + rnd() * 0.8 - start, 4);
    const ai = start + backsight;
    if (k === 0) {
      rows.push(row(spec.amarre.code, "bm", { backsight, backDistanceM: back[k] }));
    } else {
      // El punto de cambio lleva en la misma fila la V− de la armada anterior
      // y la V+ de esta, como en la cartera.
      Object.assign(rows.at(-1)!, { backsight, backDistanceM: back[k] });
    }

    const setupAccumulated = accumulated + back[k]!;
    for (const t of chunk) {
      const calculated = t.elevation - correction(setupAccumulated);
      rows.push(row(t.code, "intermediate", { foresight: round(ai - calculated, 4) }));
    }
    accumulated = setupAccumulated + fore[k]!;

    if (k < chunks.length - 1) {
      const foresight = round(1 + rnd() * 0.8, 4);
      rows.push(row(`CP-${k + 1}`, "pc", { foresight, foreDistanceM: fore[k] }));
      start = ai - foresight;
    } else {
      const foresight = round(ai - (spec.amarre.elevation + closureM), 4);
      rows.push(row(spec.amarre.code, "bm", { foresight, foreDistanceM: fore[k] }));
    }
  });

  return rows;
}
