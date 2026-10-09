// La cartera real de asentamientos (Fase 37, decisión 23): la hoja «Control de
// asentamientos» de docs/carteras/Control_asentamiento_estructural_ REAL.xlsx,
// como dato. Es la primera serie real de asentamientos de la app (Torre
// Alameda es simulada).
//
// Cada visita es una armada desde el BM de la piscina (fila 11 de la hoja,
// 156.299): la V+ (columnas D, I, N, S, X, AC y AH) y una lectura por punto
// (E, J, O, T, Y, AD y AI, filas 5-10 y 12-21), sin vista adelante. La cota es
// 156.299 + V+ − lectura, que la hoja escribe a tres decimales.
//
// Decisiones del usuario (2026-10-03):
// - La visita 7 es del 2022-06-05: la celda AF2 dice 2022-05-06 porque Excel
//   leyó día/mes; las demás fechas están en texto mes/día.
// - «AA3» es el código correcto, no un error de «A3».
// - B10 en la visita 3, tal cual la cartera (lectura 4.120, cota 153.629, −50
//   mm), aunque la nota de la hoja diga «ya se corrigió».
// - Los puntos no tienen C0: su línea base es la lectura de la visita 1.

import type { BookRowPayload } from "@/types/settlement";

export interface CarteraVisita {
  date: string;
  /** La V+ al BM de la piscina. */
  backsight: number;
  /** La lectura a cada punto, en el orden de `points`. */
  readings: number[];
}

export const CARTERA_ASENTAMIENTOS = {
  name: "Control de asentamiento estructural",
  description:
    "Edificio con 16 puntos de control y un BM en la piscina. Siete visitas de una armada, de marzo a junio de 2022. Cartera de campo real.",
  benchmark: { code: "PISCINA/BM", elevation: 156.299 },
  /** Los 16 puntos, en el orden de la hoja. */
  points: [
    "A4(8-7A)", "A4(6B-6A)", "A4(5A-4B)", "A4(3B-4A)", "A4(3A-2B)", "A4(2A-1B)",
    "A1", "A2", "AA3", "B4", "B5", "B6", "B7", "B8", "B9", "B10",
  ],
  visits: [
    {
      date: "2022-03-24",
      backsight: 1.218,
      readings: [0.82, 0.813, 0.808, 0.821, 0.815, 0.805, 3.828, 3.883, 3.835, 3.825, 3.835, 3.828, 3.824, 3.826, 3.835, 3.828],
    },
    {
      date: "2022-03-31",
      backsight: 1.28,
      readings: [0.883, 0.877, 0.871, 0.883, 0.877, 0.868, 3.89, 3.934, 3.899, 3.887, 3.899, 3.893, 3.885, 3.885, 3.897, 3.9],
    },
    {
      date: "2022-04-12",
      backsight: 1.45,
      readings: [1.053, 1.048, 1.047, 1.054, 1.048, 1.047, 4.062, 4.105, 4.071, 4.058, 4.072, 4.066, 4.055, 4.055, 4.068, 4.12],
    },
    {
      date: "2022-04-19",
      backsight: 1.156,
      readings: [0.761, 0.76, 0.755, 0.761, 0.756, 0.755, 3.769, 3.81, 3.777, 3.765, 3.775, 3.771, 3.76, 3.76, 3.776, 3.781],
    },
    {
      date: "2022-04-29",
      backsight: 1.258,
      readings: [0.865, 0.866, 0.863, 0.864, 0.859, 0.859, 3.874, 3.913, 3.879, 3.867, 3.877, 3.874, 3.863, 3.863, 3.879, 3.883],
    },
    {
      date: "2022-05-16",
      backsight: 1.179,
      readings: [0.787, 0.788, 0.786, 0.786, 0.781, 0.781, 3.797, 3.832, 3.801, 3.789, 3.799, 3.796, 3.784, 3.784, 3.801, 3.805],
    },
    {
      date: "2022-06-05",
      backsight: 1.059,
      readings: [0.668, 0.668, 0.666, 0.667, 0.661, 0.661, 3.678, 3.712, 3.682, 3.669, 3.68, 3.676, 3.664, 3.664, 3.681, 3.686],
    },
  ] satisfies CarteraVisita[],
};

const blank = {
  backsight: null, foresight: null, backUpperM: null, backLowerM: null,
  foreUpperM: null, foreLowerM: null, backDistanceM: null, foreDistanceM: null,
} as const;

/** La libreta de una visita: una armada desde el BM, con una VI por punto y sin V−. */
export function carteraBook(visit: CarteraVisita): BookRowPayload[] {
  return [
    {
      ...blank,
      pointCode: CARTERA_ASENTAMIENTOS.benchmark.code,
      pointType: "bm",
      startsSection: true,
      backsight: visit.backsight,
    },
    ...CARTERA_ASENTAMIENTOS.points.map(
      (code, i): BookRowPayload => ({
        ...blank,
        pointCode: code,
        pointType: "intermediate",
        startsSection: false,
        foresight: visit.readings[i]!,
      }),
    ),
  ];
}

/**
 * Las visitas como las guarda la demo y el seed: la hoja las numera de la 1 a
 * la 7, la aplicación de la 0 (base) a la 6, y así se guardan (Fase 43).
 */
export function carteraVisitas(): { visitNumber: number; date: string; rows: BookRowPayload[] }[] {
  return CARTERA_ASENTAMIENTOS.visits.map((v, i) => ({ visitNumber: i, date: v.date, rows: carteraBook(v) }));
}
