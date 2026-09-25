// Carteras de campo reales, transcritas de docs/carteras/*.xlsx. Son a la vez
// los casos de prueba del motor y los datos del seed: si el seed replicara
// aparte estos números, dejaría de verificar lo mismo que los tests.
//
// Los ángulos son a la derecha (cero en la vista atrás, giro horario), que es
// como mide el instrumento. Ver docs/prds/06-motor-captura-poligonal.md.

export interface CarteraStation {
  pointCode: string;
  /** Lecturas del ángulo en DMS. Las carteras reales traen una sola. */
  readings: [number, number, number][];
  /** Distancia horizontal del lado. `null` en la fila de cierre. */
  distance: number | null;
}

export interface Cartera {
  name: string;
  angleType: "interior" | "exterior";
  hasOrientation: boolean;
  hasClosingRow: boolean;
  startPointCode: string;
  startNorth: number;
  startEast: number;
  referencePointCode: string;
  referenceNorth: number;
  referenceEast: number;
  stations: CarteraStation[];
}

/**
 * docs/carteras/poligonales.xlsx — 6 vértices, amarre en TT4, cierre CONTRA EL
 * AMARRE: el último ángulo va del último lado de vuelta a TT4.
 * Suma teórica (6-2)·180 + 360 = 1080; observada 1080°00'12".
 */
export const CARTERA_TT4: Cartera = {
  name: "Poligonal V10 — cartera TT4",
  angleType: "interior",
  hasOrientation: true,
  hasClosingRow: true,
  startPointCode: "V10",
  startNorth: 100135.666,
  startEast: 101440.525,
  referencePointCode: "TT4",
  referenceNorth: 100142.809,
  referenceEast: 101436.5,
  stations: [
    { pointCode: "V10", readings: [[211, 15, 7]], distance: 20.744 },
    { pointCode: "D1", readings: [[124, 29, 42]], distance: 11.606 },
    { pointCode: "D2", readings: [[148, 41, 41]], distance: 12.835 },
    { pointCode: "D3", readings: [[91, 1, 1]], distance: 36.985 },
    { pointCode: "D4", readings: [[100, 27, 43]], distance: 18.117 },
    { pointCode: "D5", readings: [[104, 46, 7]], distance: 15.425 },
    { pointCode: "V10", readings: [[299, 18, 51]], distance: null },
  ],
};

/**
 * docs/carteras/Ajuste_Poligonal_Minimos_Cuadrados.xlsx — U. Distrital Sede
 * Vivero, 2021-11-04. 5 vértices, amarre en 14_IS1, cierre CONTRA EL PRIMER
 * LADO: el último ángulo es el interior del vértice de arranque y el de
 * orientación solo fija el datum.
 * Suma teórica (5-2)·180 = 540; observada 539°59'56".
 *
 * Su ajuste por mínimos cuadrados llega en la Fase 14; aquí se calcula con los
 * tres métodos actuales.
 *
 * Las coordenadas de 14_IS1 no vienen en la hoja: solo trae el azimut
 * 35°00'08.02". Se derivan proyectando ese azimut 25 m desde el arranque, que
 * es lo único que el datum necesita — al amarre se le visa, no se le mide
 * distancia, así que la distancia elegida es arbitraria y no entra en ningún
 * cálculo.
 */
export const CARTERA_VIVERO: Cartera = {
  name: "Poligonal Famarena — Sede Vivero",
  angleType: "interior",
  hasOrientation: true,
  hasClosingRow: false,
  startPointCode: "Famarena_5",
  startNorth: 100139.844,
  startEast: 101491.444,
  referencePointCode: "14_IS1",
  referenceNorth: 100160.322,
  referenceEast: 101505.784,
  stations: [
    { pointCode: "Famarena_5", readings: [[97, 46, 32]], distance: 32.957 },
    { pointCode: "D1", readings: [[155, 23, 13]], distance: 13.76 },
    { pointCode: "D2", readings: [[109, 22, 40]], distance: 87.103 },
    { pointCode: "D3", readings: [[79, 16, 2]], distance: 25.846 },
    { pointCode: "D4", readings: [[114, 24, 14]], distance: 86.295 },
    { pointCode: "Famarena_5", readings: [[81, 33, 47]], distance: 32.956 },
  ],
};

export const CARTERAS: Cartera[] = [CARTERA_TT4, CARTERA_VIVERO];

// --- Nivelación --------------------------------------------------------------

/** Una fila de una libreta de nivelación real. */
export interface LecturaCartera {
  code: string;
  type: "bm" | "pc" | "intermediate";
  /** V+ y V−: el hilo medio. Una radiación lleva su vista intermedia como V−. */
  backsight: number | null;
  foresight: number | null;
  /** Distancia a la mira de cada visual, (HS − HI)·100, en metros. */
  backDistanceM: number | null;
  foreDistanceM: number | null;
}

export interface CarteraNivelacion {
  name: string;
  startCode: string;
  startElevation: number;
  ida: LecturaCartera[];
  vuelta: LecturaCartera[];
}

const l = (
  code: string,
  type: LecturaCartera["type"],
  backsight: number | null,
  foresight: number | null,
  backDistanceM: number | null,
  foreDistanceM: number | null,
): LecturaCartera => ({ code, type, backsight, foresight, backDistanceM, foreDistanceM });

/**
 * docs/carteras/TRABAJO NIVELACION EL VERJON-corregido.xlsx — nivelación y
 * contranivelación por los mismos puntos, de D1 (3288.5) a D4. Nivel
 * automático con tres hilos: V+ y V− son el hilo medio y cada distancia es
 * (HS − HI)·100, recalculada de la hoja fila a fila. En la vuelta, las V+ de
 * C 6 y C 3 no traen hilo inferior —caía bajo el cero de la mira— y la hoja lo
 * extrapola en su columna A (−0.087 y −0.063): de ahí 25.7 y 14.8 m.
 *
 * Los códigos van como en la hoja: `AUX1` en la ida y `AUX 1` en la vuelta, y
 * `C 3 ` con un espacio final en la vuelta. Los puntos homólogos (Fase 17)
 * tienen que emparejarlos igual.
 */
export const CARTERA_VERJON: CarteraNivelacion = {
  name: "El Verjón — ida y vuelta",
  startCode: "D1",
  startElevation: 3288.5,
  ida: [
    l("D1", "bm", 1.209, null, 31.5, null),
    l("C 1", "pc", 3.275, 0.268, 28.1, 28.5),
    l("C 2", "pc", 3.469, 0.224, 21.9, 17.3),
    l("C 3", "pc", 3.952, 0.092, 25.5, 11.7),
    l("AUX1", "intermediate", null, 0.194, null, null),
    l("C 4", "pc", 3.314, 0.244, 19.6, 15.1),
    l("C 5", "pc", 3.013, 0.124, 18.1, 16.6),
    l("C 6", "pc", 3.549, 0.145, 23.1, 15.5),
    l("C 7", "pc", 3.16, 0.132, 24.2, 14.9),
    l("D3", "pc", 2.395, 0.87, 14.7, 8.4),
    l("C 8", "pc", 2.349, 0.195, 12.1, 21.8),
    l("D4", "bm", null, 0.808, null, 15.7),
  ],
  vuelta: [
    l("D4", "bm", 0.865, null, 14.3, null),
    l("C 8", "pc", 0.802, 2.407, 15.2, 13.5),
    l("D3", "pc", 0.531, 3.003, 14.8, 22.6),
    l("C 7", "pc", 0.092, 2.821, 17.0, 18.1),
    l("C 6", "pc", 0.083, 3.51, 25.7, 20.9),
    l("C 5", "pc", 0.266, 2.953, 16.8, 16.2),
    l("C 4", "pc", 0.157, 3.456, 15.7, 20.2),
    l("AUX 1", "intermediate", null, 0.107, null, null),
    l("C 3 ", "pc", 0.022, 3.865, 14.8, 24.7),
    l("C 2", "pc", 0.134, 3.4, 18.0, 21.1),
    l("C 1", "pc", 0.452, 3.186, 20.4, 27.5),
    l("D1", "bm", null, 1.391, null, 40.1),
  ],
};
