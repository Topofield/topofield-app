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
