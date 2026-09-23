import { describe, it, expect } from "vitest";
import {
  computeRun,
  computeLeveling,
  applyProportionalCorrection,
  stadiaDistance,
  distanceFromWires,
  resolveVisualDistances,
  accumulateDistances,
  totalDistanceFromReadings,
} from "./leveling";
import type { LevelingInput, PointType, ReadingInput } from "@/types/leveling";

/** Fila con todo a null; se sobrescribe lo que cada test necesite. */
function bare(over: Partial<ReadingInput> = {}): ReadingInput {
  return {
    pointCode: "P",
    pointType: "pc",
    backsight: null,
    foresight: null,
    backUpperM: null,
    backLowerM: null,
    foreUpperM: null,
    foreLowerM: null,
    backDistanceM: null,
    foreDistanceM: null,
    distanceAccumulatedKm: null,
    ...over,
  };
}

function r(
  pointCode: string,
  pointType: PointType,
  backsight: number | null,
  foresight: number | null,
  distanceAccumulatedKm: number | null,
): ReadingInput {
  return bare({
    pointCode,
    pointType,
    backsight,
    foresight,
    distanceAccumulatedKm,
  });
}

describe("stadiaDistance", () => {
  it("D = (HS − HI)·100", () => {
    expect(stadiaDistance(1.5, 1.3)).toBeCloseTo(20.0, 6);
  });

  it("reproduce la primera armada de El Verjón", () => {
    // Cartera real: I3 = (1.367 − 1.052)·100 = 31.5 m
    expect(stadiaDistance(1.367, 1.052)).toBeCloseTo(31.5, 6);
    // K6 = (0.410 − 0.125)·100 = 28.5 m
    expect(stadiaDistance(0.41, 0.125)).toBeCloseTo(28.5, 6);
  });

  it("admite otra constante estadimétrica", () => {
    expect(stadiaDistance(1.5, 1.3, 50)).toBeCloseTo(10.0, 6);
  });
});

describe("resolveVisualDistances", () => {
  it("deriva de los hilos cuando están", () => {
    const row = bare({ backUpperM: 1.367, backLowerM: 1.052 });
    expect(resolveVisualDistances(row).back).toBeCloseTo(31.5, 6);
  });

  it("usa la distancia tecleada cuando no hay hilos", () => {
    expect(resolveVisualDistances(bare({ backDistanceM: 30 })).back).toBe(30);
  });

  it("los hilos ganan sobre la distancia tecleada", () => {
    // La distancia es un campo autocompletado desde los hilos: si ambos están,
    // los hilos son la medición y la distancia su resultado.
    const row = bare({ backUpperM: 1.5, backLowerM: 1.3, backDistanceM: 999 });
    expect(resolveVisualDistances(row).back).toBeCloseTo(20.0, 6);
  });
});

describe("accumulateDistances", () => {
  it("una armada acumula sus dos visuales", () => {
    const rows = [
      bare({ backDistanceM: 30 }),
      bare({ foreDistanceM: 30, backDistanceM: 25 }),
    ];
    expect(accumulateDistances(rows)).toEqual([30, 85]);
  });

  it("un intermedio no acumula, hereda, y LA CADENA CONTINÚA", () => {
    // Es el fallo exacto de la cartera de El Verjón: la vista intermedia
    // AUX 1 rompió la cadena de sumas de la hoja y se perdieron 24.7 m de
    // la distancia total, que es la que alimenta la tolerancia K·√D.
    const rows = [
      bare({ backDistanceM: 30 }),
      bare({ pointType: "intermediate" }),
      bare({ foreDistanceM: 20, backDistanceM: 25 }),
      bare({ foreDistanceM: 15 }),
    ];
    expect(accumulateDistances(rows)).toEqual([30, 30, 75, 90]);
  });

  it("una fila sin distancias no rompe la cadena: aporta 0", () => {
    const rows = [
      bare({ backDistanceM: 30 }),
      bare({}),
      bare({ foreDistanceM: 20 }),
    ];
    expect(accumulateDistances(rows)).toEqual([30, 30, 50]);
  });

  it("libreta vacía devuelve lista vacía", () => {
    expect(accumulateDistances([])).toEqual([]);
  });
});

describe("totalDistanceFromReadings", () => {
  it("devuelve el acumulado de la última fila, en km", () => {
    const rows = [
      bare({ backDistanceM: 300 }),
      bare({ foreDistanceM: 300, backDistanceM: 150 }),
      bare({ foreDistanceM: 150 }),
    ];
    expect(totalDistanceFromReadings(rows)).toBeCloseTo(0.9, 9);
  });

  it("libreta vacía devuelve 0, nunca NaN ni Infinity", () => {
    // La Fase 4 tuvo un «NaN mm» en pantalla; no se repite.
    const total = totalDistanceFromReadings([]);
    expect(total).toBe(0);
    expect(Number.isFinite(total)).toBe(true);
  });

  it("una sola fila sin distancias devuelve 0", () => {
    expect(totalDistanceFromReadings([bare({})])).toBe(0);
  });

  it("un intermedio al final no altera el total", () => {
    const rows = [
      bare({ backDistanceM: 300 }),
      bare({ foreDistanceM: 300 }),
      bare({ pointType: "intermediate" }),
    ];
    expect(totalDistanceFromReadings(rows)).toBeCloseTo(0.6, 9);
  });
});

describe("la invariante de la cadena", () => {
  it("el acumulado terminal es igual al total, por construcción", () => {
    const rows = [
      bare({ backDistanceM: 31.5 }),
      bare({ foreDistanceM: 28.5, backDistanceM: 28.1 }),
      bare({ foreDistanceM: 15.7 }),
    ];
    const acc = accumulateDistances(rows);
    expect(acc[acc.length - 1] / 1000).toBeCloseTo(
      totalDistanceFromReadings(rows),
      12,
    );
  });

  it("vale igual en el recorrido de vuelta", () => {
    // La vuelta es una libreta independiente con su propia cadena. Un fallo
    // aquí no lo vería ningún test de la ida.
    const vuelta = [
      bare({ backDistanceM: 14.3 }),
      bare({ foreDistanceM: 13.5, backDistanceM: 15.2 }),
      bare({ foreDistanceM: 22.6 }),
    ];
    const acc = accumulateDistances(vuelta);
    expect(acc[acc.length - 1] / 1000).toBeCloseTo(
      totalDistanceFromReadings(vuelta),
      12,
    );
  });
});

describe("distanceFromWires", () => {
  it("con un solo hilo devuelve null: no hay distancia derivable", () => {
    expect(distanceFromWires(1.5, null)).toBeNull();
    expect(distanceFromWires(null, 1.3)).toBeNull();
    expect(distanceFromWires(null, null)).toBeNull();
  });

  it("con los dos hilos deriva la distancia", () => {
    expect(distanceFromWires(1.5, 1.3)).toBeCloseTo(20.0, 6);
  });
});

// Fixture verificado a mano. Circuito cerrado de 0.900 km que sale del BM-1
// (cota 100.000) y regresa a él con un error deliberado de −8.0 mm.
//   ΣL.At = 4.500 · ΣL.Ad = 4.508 · diferencia = −0.008 = Δcota. Cuadra.
const CLOSED_RUN: ReadingInput[] = [
  r("BM-1", "bm", 1.5, null, 0.0),
  r("PC-1", "pc", 2.0, 1.2, 0.3),
  r("PC-2", "pc", 1.0, 2.5, 0.6),
  r("BM-1", "bm", null, 0.808, 0.9),
];

describe("computeRun — cálculo base", () => {
  const run = computeRun(CLOSED_RUN, 100.0);

  it("calcula la AI solo en las filas con lectura atrás", () => {
    expect(run.readings.map((x) => x.instrumentHeight)).toEqual([
      101.5, 102.3, 100.8, null,
    ]);
  });

  it("consume la AI anterior antes de generar la nueva", () => {
    // PC-1: cota = AI(BM-1) 101.5 − L.Ad 1.2 = 100.3
    //       y SOLO DESPUÉS AI = 100.3 + 2.0 = 102.3
    expect(run.readings[1]?.elevationCalculated).toBeCloseTo(100.3, 6);
    expect(run.readings[1]?.instrumentHeight).toBeCloseTo(102.3, 6);
  });

  it("encadena las cotas del recorrido", () => {
    // La última cota (100.8 − 0.808) no es representable exacto en binario
    // (da 99.99199999999999 en IEEE-754), así que esa posición se compara con
    // toBeCloseTo en vez de toEqual. El valor esperado sigue siendo 99.992.
    const elevations = run.readings.map((x) => x.elevationCalculated);
    expect(elevations.slice(0, 3)).toEqual([100.0, 100.3, 99.8]);
    expect(elevations[3]).toBeCloseTo(99.992, 6);
  });

  it("calcula el desnivel de la sección", () => {
    expect(run.heightDifference).toBeCloseTo(-0.008, 6);
  });

  it("cuadra la comprobación aritmética ΣLA − ΣLD = Δcota", () => {
    expect(run.sumBacksights).toBeCloseTo(4.5, 6);
    expect(run.sumForesights).toBeCloseTo(4.508, 6);
    expect(run.arithmeticCheckOk).toBe(true);
  });
});

describe("computeRun — puntos intermedios", () => {
  // Un intermedio cuelga de la AI vigente y NO la actualiza.
  const withIntermediate: ReadingInput[] = [
    r("BM-1", "bm", 1.5, null, 0.0),
    r("A", "intermediate", null, 1.1, 0.1),
    r("PC-1", "pc", 2.0, 1.2, 0.3),
    r("BM-2", "bm", null, 2.5, 0.6),
  ];
  const run = computeRun(withIntermediate, 100.0);

  it("calcula la cota del intermedio contra la AI vigente", () => {
    // AI vigente = 101.5 → cota A = 101.5 − 1.1 = 100.4
    expect(run.readings[1]?.elevationCalculated).toBeCloseTo(100.4, 6);
  });

  it("no deja que el intermedio genere AI ni propague cota", () => {
    expect(run.readings[1]?.instrumentHeight).toBeNull();
    // PC-1 sigue colgando de la AI del BM-1, no de la del intermedio.
    expect(run.readings[2]?.elevationCalculated).toBeCloseTo(100.3, 6);
  });

  it("excluye los intermedios de la comprobación aritmética", () => {
    // ΣLA = 1.5 + 2.0 = 3.5 (el intermedio no aporta L.At, y su L.Ad se ignora)
    // ΣLD = 1.2 + 2.5 = 3.7 → diferencia −0.2 = 99.8 − 100.0. Cuadra.
    expect(run.sumBacksights).toBeCloseTo(3.5, 6);
    expect(run.sumForesights).toBeCloseTo(3.7, 6);
    expect(run.arithmeticCheckOk).toBe(true);
  });
});

describe("computeRun — el orden consumir → generar", () => {
  // Este es el test que protege contra el error más difícil de ver a ojo:
  // invertir el orden dentro de la fila desplaza TODAS las cotas del recorrido
  // de forma coherente, así que el resultado sigue pareciendo plausible.
  it("no usa la L.At de la propia fila para calcular su cota", () => {
    const run = computeRun(
      [
        r("BM-1", "bm", 1.5, null, 0.0),
        // Si la implementación generase la AI antes de consumirla, la cota de
        // PC-1 saldría de 100.0 + 1.5 + 2.0 − 1.2, no de 101.5 − 1.2.
        r("PC-1", "pc", 2.0, 1.2, 0.3),
      ],
      100.0,
    );
    expect(run.readings[1]?.elevationCalculated).toBeCloseTo(100.3, 6);
    expect(run.readings[1]?.elevationCalculated).not.toBeCloseTo(102.3, 6);
  });

  it("deja la primera fila en la cota de partida, sin L.Ad que consumir", () => {
    const run = computeRun([r("BM-1", "bm", 1.5, null, 0.0)], 100.0);
    expect(run.readings[0]?.elevationCalculated).toBeCloseTo(100.0, 6);
    expect(run.readings[0]?.instrumentHeight).toBeCloseTo(101.5, 6);
    expect(run.heightDifference).toBeCloseTo(0, 6);
  });
});

const CLOSED_INPUT: LevelingInput = {
  type: "closed",
  startElevation: 100.0,
  endElevation: null,
  order: "tercer_orden",
  totalDistanceKm: 0.9,
  forward: CLOSED_RUN,
  return: null,
};

describe("computeLeveling — cerrada", () => {
  const result = computeLeveling(CLOSED_INPUT);

  it("cierra contra el BM de partida: error −8.0 mm", () => {
    expect(result.closureErrorMm).toBeCloseTo(-8.0, 4);
  });

  it("compara contra K·√D = 12·√0.9 = 11.38 mm y cumple", () => {
    expect(result.toleranceMm).toBeCloseTo(11.3842, 3);
    expect(result.meetsTolerance).toBe(true);
  });

  it("distribuye la corrección proporcional a la distancia acumulada", () => {
    // Corr_i = −error × (d_i / D) → +8.0 mm × (d_i / 0.9)
    const corrections = result.forward.readings.map((x) =>
      Number((x.correctionApplied * 1000).toFixed(2)),
    );
    expect(corrections).toEqual([0.0, 2.67, 5.33, 8.0]);
  });

  it("hace que el BM final cierre exacto tras la corrección", () => {
    const last = result.forward.readings.at(-1);
    expect(last?.elevationCorrected).toBeCloseTo(100.0, 6);
  });
});

describe("computeLeveling — enlace", () => {
  // BM-A 250.000 → BM-B conocida 248.700. Cadena que llega a 248.685: −15 mm.
  const linkRun: ReadingInput[] = [
    r("BM-A", "bm", 1.0, null, 0.0),
    r("PC-1", "pc", 2.0, 1.5, 1.1),
    r("BM-B", "bm", null, 2.815, 2.2),
  ];
  const result = computeLeveling({
    type: "link",
    startElevation: 250.0,
    endElevation: 248.7,
    order: "tercer_orden",
    totalDistanceKm: 2.2,
    forward: linkRun,
    return: null,
  });

  it("cierra contra la cota conocida del BM de llegada", () => {
    // 250 + 1.0 = 251.0 AI; PC-1 = 249.5; AI = 251.5; BM-B = 248.685
    expect(result.forward.readings.at(-1)?.elevationCalculated).toBeCloseTo(
      248.685,
      6,
    );
    expect(result.closureErrorMm).toBeCloseTo(-15.0, 4);
  });

  it("cumple tercer orden: 15 mm < 12·√2.2 = 17.8 mm", () => {
    expect(result.toleranceMm).toBeCloseTo(17.7986, 3);
    expect(result.meetsTolerance).toBe(true);
  });

  it("corrige hasta hacer coincidir el BM-B con su cota conocida", () => {
    expect(result.forward.readings.at(-1)?.elevationCorrected).toBeCloseTo(
      248.7,
      6,
    );
  });
});

describe("computeLeveling — abierta sin control", () => {
  const result = computeLeveling({
    type: "open",
    startElevation: 500.0,
    endElevation: null,
    order: "tercer_orden",
    totalDistanceKm: 0.4,
    forward: [
      r("BM-X", "bm", 1.325, null, 0.0),
      r("PC-1", "pc", 0.654, 0.876, 0.08),
      r("PC-2", "pc", null, 1.987, 0.16),
    ],
    return: null,
  });

  it("no calcula error de cierre ni tolerancia", () => {
    expect(result.closureErrorMm).toBeNull();
    expect(result.toleranceMm).toBeNull();
    expect(result.meetsTolerance).toBeNull();
  });

  it("no aplica corrección: cota corregida = cota calculada", () => {
    for (const reading of result.forward.readings) {
      expect(reading.elevationCorrected).toBeCloseTo(
        reading.elevationCalculated,
        6,
      );
      expect(reading.correctionApplied).toBe(0);
    }
  });
});

describe("computeLeveling — fuera de tolerancia", () => {
  it("marca meetsTolerance false y NO corrige", () => {
    const result = computeLeveling({
      ...CLOSED_INPUT,
      order: "primer_orden", // tolerancia 3·√0.9 = 2.85 mm < 8.0 mm de error
    });
    expect(result.meetsTolerance).toBe(false);
    // Sin cumplir tolerancia el trabajo se repite; no se compensa.
    expect(result.forward.readings.at(-1)?.correctionApplied).toBe(0);
  });
});

describe("applyProportionalCorrection", () => {
  // Readings reales (con elevationCalculated ya resuelto) sobre las que
  // ejercitar la función directamente, sin pasar por computeLeveling.
  const readings = computeRun(CLOSED_RUN, 100.0).readings;

  it("con totalDistanceKm = 0 no reparte nada y no produce NaN/Infinity", () => {
    const corrected = applyProportionalCorrection(readings, -8.0, 0);
    for (const reading of corrected) {
      expect(reading.correctionApplied).toBe(0);
      expect(reading.elevationCorrected).toBeCloseTo(
        reading.elevationCalculated,
        6,
      );
      expect(Number.isFinite(reading.correctionApplied)).toBe(true);
      expect(Number.isFinite(reading.elevationCorrected)).toBe(true);
    }
  });

  it("la corrección de la fila con distancia = D_total iguala −error", () => {
    const errorMm = -8.0;
    const corrected = applyProportionalCorrection(readings, errorMm, 0.9);
    // La fila del punto final trae distanceAccumulatedKm = 0.9 = D_total, así
    // que su corrección es exactamente −error (en metros): la propiedad que
    // hace cerrar exacto el punto final (ver test de computeLeveling —
    // cerrada, que comprueba lo mismo end-to-end vía elevationCorrected).
    const last = corrected.at(-1);
    expect(last?.correctionApplied).toBeCloseTo(-errorMm / 1000, 6);
  });

  it("una fila con distanceAccumulatedKm null recibe corrección 0 (contrato documentado)", () => {
    // Fija el comportamiento del `?? 0`: una fila sin distancia acumulada se
    // trata como si estuviera en el origen, así que su reparto sale 0 en vez
    // del que le correspondería. Si esta fila fuera el punto final del
    // recorrido, el cierre exacto NO se produciría — ver el CONTRATO en el
    // JSDoc de applyProportionalCorrection.
    const withNullDistance = [{ ...readings[3]!, distanceAccumulatedKm: null }];
    const [corrected] = applyProportionalCorrection(
      withNullDistance,
      -8.0,
      0.9,
    );
    expect(corrected!.correctionApplied).toBe(0);
    expect(corrected!.elevationCorrected).toBeCloseTo(
      corrected!.elevationCalculated,
      6,
    );
  });
});

describe("computeLeveling — ida y vuelta", () => {
  // La vuelta es una medición INDEPENDIENTE: distintos puntos de cambio y
  // distinto número de armadas que la ida. Solo comparten los BM extremos.
  //   ida:    3 armadas, Δh = −0.008
  //   vuelta: 2 armadas, Δh = +0.010 (sentido opuesto)
  const returnRun: ReadingInput[] = [
    r("BM-1", "bm", 1.2, null, 0.0),
    r("PV-1", "pc", 1.6, 0.9, 0.45),
    r("BM-1", "bm", null, 1.89, 0.9),
  ];

  const result = computeLeveling({
    ...CLOSED_INPUT,
    return: returnRun,
  });

  it("calcula cada recorrido de forma independiente", () => {
    expect(result.forward.readings).toHaveLength(4);
    expect(result.return?.readings).toHaveLength(3);
  });

  it("obtiene el desnivel de sección de cada recorrido", () => {
    expect(result.forward.heightDifference).toBeCloseTo(-0.008, 6);
    expect(result.return?.heightDifference).toBeCloseTo(0.01, 6);
  });

  it("calcula el error de cierre de la vuelta contra el BM de partida de la ida", () => {
    // La vuelta arranca en 100.000 (known) y su desnivel es +0.010, así que
    // cierra en 100.010 contra el BM-1 de partida (100.000): error +10.0 mm.
    // Distinto de la discrepancia (2.0 mm), que compara ida contra vuelta.
    expect(result.return?.errorMm).toBeCloseTo(10.0, 4);
  });

  it("calcula la discrepancia entre recorridos", () => {
    // |Δh_ida − (−Δh_vuelta)| = |−0.008 + 0.010| = 0.002 m = 2.0 mm
    expect(result.discrepancyMm).toBeCloseTo(2.0, 4);
  });

  it("compara la discrepancia contra T·√2", () => {
    // 12·√0.9·√2 = 16.10 mm
    expect(result.discrepancyToleranceMm).toBeCloseTo(16.0997, 3);
    expect(result.meetsDiscrepancy).toBe(true);
  });

  it("adopta el desnivel promediado", () => {
    // (Δh_ida − Δh_vuelta) / 2 = (−0.008 − 0.010) / 2 = −0.009
    expect(result.adoptedHeightDifference).toBeCloseTo(-0.009, 6);
  });

  it("marca la discrepancia fuera de tolerancia con órdenes exigentes", () => {
    const strict = computeLeveling({
      ...CLOSED_INPUT,
      order: "primer_orden", // T·√2 = 3·√0.9·√2 = 4.02 mm
      return: [
        r("BM-1", "bm", 1.2, null, 0.0),
        r("BM-1", "bm", null, 1.17, 0.9),
      ], // Δh = +0.030 → discrepancia |−0.008 + 0.030| = 22 mm
      forward: CLOSED_RUN,
    });
    expect(strict.discrepancyMm).toBeCloseTo(22.0, 4);
    expect(strict.meetsDiscrepancy).toBe(false);
  });
});

describe("computeLeveling — el cierre usa la cota de la CADENA, no la última fila (hallazgo 1)", () => {
  // Reproduce el hallazgo crítico de la revisión final: si la libreta termina
  // con una radiación (`intermediate`) DESPUÉS del BM de cierre, el error de
  // cierre no debe tomar la cota de esa radiación — debe seguir usando la
  // cota de la cadena bm/pc, que es la del BM de cierre real.
  //
  // Para que la radiación final tenga una AI vigente de la que colgar, el
  // recorrido necesita que el BM de cierre lleve L.At (algo inusual en la
  // práctica de campo, pero es exactamente el escenario que hace que el
  // bug se manifieste: una fila después del BM de cierre con una AI
  // vigente y lectura adelante 0.805, tal como lo reportó la revisión).
  const closedRunWithBacksightAtClose: ReadingInput[] = [
    r("BM-1", "bm", 1.5, null, 0.0),
    r("PC-1", "pc", 2.0, 1.2, 0.3),
    r("PC-2", "pc", 1.0, 2.5, 0.6),
    r("BM-1", "bm", 1.5, 0.808, 0.9), // BM de cierre, ahora con L.At propia
    r("RAD-1", "intermediate", null, 0.805, 0.9), // radiación tras el cierre
  ];

  const result = computeLeveling({
    ...CLOSED_INPUT,
    forward: closedRunWithBacksightAtClose,
  });

  it("el error de cierre sigue siendo el del BM de cierre (−8.0 mm), no el de la radiación", () => {
    expect(result.closureErrorMm).toBeCloseTo(-8.0, 4);
  });

  it("el BM de cierre corregido cierra exacto en 100.0000, no la radiación", () => {
    const bmFinal = result.forward.readings.at(-2);
    expect(bmFinal?.pointCode).toBe("BM-1");
    expect(bmFinal?.elevationCorrected).toBeCloseTo(100.0, 6);
  });

  it("una radiación en MEDIO del recorrido (no al final) sigue funcionando como antes", () => {
    // Caso de regresión: reordenar computeRun no debe alterar el cálculo
    // normal de un intermedio interior, ya cubierto en el describe de
    // "computeRun — puntos intermedios" pero verificado aquí también a
    // nivel de computeLeveling end-to-end.
    const withMiddleIntermediate: ReadingInput[] = [
      r("BM-1", "bm", 1.5, null, 0.0),
      r("A", "intermediate", null, 1.1, 0.1),
      r("PC-1", "pc", 2.0, 1.2, 0.3),
      r("PC-2", "pc", 1.0, 2.5, 0.6),
      r("BM-1", "bm", null, 0.808, 0.9),
    ];
    const midResult = computeLeveling({
      ...CLOSED_INPUT,
      forward: withMiddleIntermediate,
    });
    expect(midResult.closureErrorMm).toBeCloseTo(-8.0, 4);
    expect(midResult.forward.readings.at(-1)?.elevationCorrected).toBeCloseTo(
      100.0,
      6,
    );
  });

  it("el error de cierre de la VUELTA también usa la cadena, no la última fila", () => {
    const returnWithTrailingIntermediate: ReadingInput[] = [
      r("BM-1", "bm", 1.2, null, 0.0),
      r("PV-1", "pc", 1.6, 0.9, 0.45),
      r("BM-1", "bm", 1.0, 1.89, 0.9), // BM de cierre de la vuelta, con L.At
      r("RAD-V", "intermediate", null, 0.5, 0.9), // radiación tras el cierre
    ];
    const rtResult = computeLeveling({
      ...CLOSED_INPUT,
      return: returnWithTrailingIntermediate,
    });
    // Igual que en el test "ida y vuelta" original: vuelta arranca en 100.000
    // y cierra en 100.010 contra el BM-1 de partida → error +10.0 mm, SIN
    // que la radiación final (que colgaría de una cota distinta) lo altere.
    expect(rtResult.return?.errorMm).toBeCloseTo(10.0, 4);
  });
});

describe("computeLeveling — distancia total inválida (hallazgo crítico Tarea 11)", () => {
  // Un proceso recién creado no tiene distancia total: el formulario de
  // creación no la pide (vive solo en el editor), así que `buildInput` la
  // convierte en `Number.NaN`. Antes del fix, `levelingTolerance(order, NaN)`
  // propagaba `NaN` a `toleranceMm`, y `meetsTolerance` salía `false` sin más
  // (toda comparación con NaN es false) — un "no cumple" que no significaba
  // nada, visible en el panel como un literal "NaN mm" antes de escribir una
  // sola lectura. El error de cierre SÍ debe seguir calculándose: no depende
  // de la distancia.

  it("con totalDistanceKm NaN dejar tolerancia y cumplimiento en null, sin tocar el error de cierre", () => {
    const result = computeLeveling({ ...CLOSED_INPUT, totalDistanceKm: Number.NaN });
    expect(result.closureErrorMm).toBeCloseTo(-8.0, 4);
    expect(result.toleranceMm).toBeNull();
    expect(result.meetsTolerance).toBeNull();
  });

  it("con totalDistanceKm = 0 dejar tolerancia y cumplimiento en null", () => {
    const result = computeLeveling({ ...CLOSED_INPUT, totalDistanceKm: 0 });
    expect(result.closureErrorMm).toBeCloseTo(-8.0, 4);
    expect(result.toleranceMm).toBeNull();
    expect(result.meetsTolerance).toBeNull();
  });

  it("con totalDistanceKm negativo dejar tolerancia y cumplimiento en null", () => {
    const result = computeLeveling({ ...CLOSED_INPUT, totalDistanceKm: -1 });
    expect(result.toleranceMm).toBeNull();
    expect(result.meetsTolerance).toBeNull();
  });

  it("no aplica corrección proporcional sin tolerancia calculable", () => {
    const result = computeLeveling({ ...CLOSED_INPUT, totalDistanceKm: Number.NaN });
    for (const reading of result.forward.readings) {
      expect(reading.correctionApplied).toBe(0);
      expect(reading.elevationCorrected).toBeCloseTo(
        reading.elevationCalculated,
        6,
      );
    }
  });

  it("en ida y vuelta, con totalDistanceKm NaN deja discrepancyToleranceMm y meetsDiscrepancy en null", () => {
    const returnRun: ReadingInput[] = [
      r("BM-1", "bm", 1.2, null, 0.0),
      r("PV-1", "pc", 1.6, 0.9, 0.45),
      r("BM-1", "bm", null, 1.89, 0.9),
    ];
    const result = computeLeveling({
      ...CLOSED_INPUT,
      totalDistanceKm: Number.NaN,
      return: returnRun,
    });
    // La discrepancia en sí (no depende de K, solo de los dos desniveles) se
    // sigue calculando; solo la tolerancia contra la que se compara queda null.
    expect(result.discrepancyMm).toBeCloseTo(2.0, 4);
    expect(result.discrepancyToleranceMm).toBeNull();
    expect(result.meetsDiscrepancy).toBeNull();
  });

  it("no produce NaN en ningún campo numérico del resultado", () => {
    const returnRun: ReadingInput[] = [
      r("BM-1", "bm", 1.2, null, 0.0),
      r("PV-1", "pc", 1.6, 0.9, 0.45),
      r("BM-1", "bm", null, 1.89, 0.9),
    ];
    const result = computeLeveling({
      ...CLOSED_INPUT,
      totalDistanceKm: Number.NaN,
      return: returnRun,
    });
    const numericFields = [
      result.closureErrorMm,
      result.toleranceMm,
      result.discrepancyMm,
      result.discrepancyToleranceMm,
      result.adoptedHeightDifference,
      result.forward.heightDifference,
      result.forward.errorMm,
      result.return?.heightDifference ?? null,
      result.return?.errorMm ?? null,
    ];
    for (const value of numericFields) {
      if (value != null) {
        expect(Number.isNaN(value)).toBe(false);
      }
    }
    for (const reading of result.forward.readings) {
      expect(Number.isNaN(reading.correctionApplied)).toBe(false);
      expect(Number.isNaN(reading.elevationCorrected)).toBe(false);
    }
  });
});
