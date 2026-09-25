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

/**
 * Fila de un fixture expresada por su distancia ACUMULADA, como se escribían
 * antes de la Fase 9.
 *
 * Desde la Fase 9 el acumulado se deriva de las distancias por visual, así que
 * el helper traduce: reparte el tramo respecto de la fila anterior entre las
 * dos visuales de la armada. Los fixtures conservan así la geometría que
 * verificaron a mano en las Fases 3-4, sin reintroducir un campo que el modelo
 * ya no tiene.
 *
 * `fromAccum()` es quien hace la traducción: necesita la fila anterior.
 */
interface AccumRow {
  pointCode: string;
  pointType: PointType;
  backsight: number | null;
  foresight: number | null;
  accumKm: number | null;
}

function r(
  pointCode: string,
  pointType: PointType,
  backsight: number | null,
  foresight: number | null,
  accumKm: number | null,
): AccumRow {
  return { pointCode, pointType, backsight, foresight, accumKm };
}

/**
 * Traduce filas por acumulado a filas con distancias por visual.
 *
 * El tramo de cada fila es la diferencia con el acumulado del punto anterior,
 * y ese tramo es UNA ARMADA: la V+ del punto anterior y la V− de este. Se parte
 * por mitades entre esas dos visuales (o entero a la que exista). Hasta la
 * Fase 19 se repartía entre la V− y la V+ de la MISMA fila —el reparto de los
 * procesos reconstruidos por el backfill de la Fase 9—, y con él la regla
 * vieja del acumulado cuadraba por casualidad y ocultaba N8.
 */
function fromAccum(rows: AccumRow[]): ReadingInput[] {
  const out = rows.map((row) =>
    bare({
      pointCode: row.pointCode,
      pointType: row.pointType,
      backsight: row.backsight,
      foresight: row.foresight,
    }),
  );
  let prevIndex: number | null = null;
  let prevAccum = 0;
  rows.forEach((row, i) => {
    if (row.pointType === "intermediate") return;
    const accum = row.accumKm ?? prevAccum;
    const tramoM = Math.max((accum - prevAccum) * 1000, 0);
    if (prevIndex !== null && tramoM > 0) {
      const opener = out[prevIndex]!;
      const closer = out[i]!;
      const hasBack = opener.backsight != null;
      const hasFore = closer.foresight != null;
      if (hasBack && hasFore) {
        opener.backDistanceM = (opener.backDistanceM ?? 0) + tramoM / 2;
        closer.foreDistanceM = tramoM / 2;
      } else if (hasFore) {
        closer.foreDistanceM = tramoM;
      } else if (hasBack) {
        opener.backDistanceM = (opener.backDistanceM ?? 0) + tramoM;
      }
    }
    prevIndex = i;
    prevAccum = accum;
  });
  return out;
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

describe("computeLeveling con la cadena derivada", () => {
  it("el BM final cierra EXACTAMENTE contra su cota conocida", () => {
    // La prueba que el contrato del JSDoc nunca pudo hacer. Antes de la Fase 9
    // una fila con el acumulado mal puesto dejaba el cierre en 99.992 mientras
    // el proceso informaba que cumplía.
    const result = computeLeveling({
      type: "closed",
      startElevation: 100.0,
      endElevation: null,
      order: "tercer_orden",
      forward: [
        bare({ pointCode: "BM-1", pointType: "bm", backsight: 1.5, backDistanceM: 150 }),
        bare({ pointCode: "PC-1", pointType: "pc", foresight: 1.2, backsight: 2.0,
               foreDistanceM: 150, backDistanceM: 150 }),
        bare({ pointCode: "PC-2", pointType: "pc", foresight: 2.5, backsight: 1.0,
               foreDistanceM: 150, backDistanceM: 150 }),
        bare({ pointCode: "BM-1", pointType: "bm", foresight: 0.808, foreDistanceM: 150 }),
      ],
      return: null,
    });

    const last = result.forward.readings.at(-1);
    expect(last?.elevationCorrected).toBeCloseTo(100.0, 10);
  });

  it("deriva totalDistanceKm de las lecturas", () => {
    const result = computeLeveling({
      type: "closed", startElevation: 100, endElevation: null, order: "tercer_orden",
      forward: [
        bare({ pointType: "bm", backsight: 1.5, backDistanceM: 450 }),
        bare({ pointType: "bm", foresight: 1.5, foreDistanceM: 450 }),
      ],
      return: null,
    });
    // 900 m → K·√0.9 con K=12
    expect(result.toleranceMm).toBeCloseTo(12 * Math.sqrt(0.9), 6);
  });

  it("sin distancias no calcula tolerancia, y no produce NaN", () => {
    const result = computeLeveling({
      type: "closed", startElevation: 100, endElevation: null, order: "tercer_orden",
      forward: [
        bare({ pointType: "bm", backsight: 1.5 }),
        bare({ pointType: "bm", foresight: 1.5 }),
      ],
      return: null,
    });
    expect(result.toleranceMm).toBeNull();
    expect(result.meetsTolerance).toBeNull();
    expect(result.closureErrorMm).not.toBeNaN();
  });

  it("expone la distancia RESUELTA de cada visual, derivada de los hilos", () => {
    // Lo que se persiste es esto, no la distancia tecleada: un proceso
    // capturado por taquimetría no teclea ninguna, y el informe y el export
    // leen la fila sin recalcular.
    const result = computeLeveling({
      type: "closed", startElevation: 100, endElevation: null, order: "tercer_orden",
      forward: [
        bare({ pointType: "bm", backsight: 1.5, backUpperM: 2.25, backLowerM: 0.75 }),
        bare({ pointType: "bm", foresight: 1.5, foreUpperM: 2.25, foreLowerM: 0.75 }),
      ],
      return: null,
    });
    expect(result.forward.readings[0]?.backDistanceResolvedM).toBeCloseTo(150, 6);
    expect(result.forward.readings[1]?.foreDistanceResolvedM).toBeCloseTo(150, 6);
  });

  it("escribe el acumulado derivado en cada fila", () => {
    const result = computeLeveling({
      type: "closed", startElevation: 100, endElevation: null, order: "tercer_orden",
      forward: [
        bare({ pointType: "bm", backsight: 1.5, backDistanceM: 300 }),
        bare({ pointType: "bm", foresight: 1.5, foreDistanceM: 300 }),
      ],
      return: null,
    });
    // Desde la Fase 19 (N8) el acumulado de un punto es el recorrido HASTA él:
    // el BM de partida está en 0, aunque ya tenga su V+ de 300 m.
    expect(result.forward.readings[0]?.distanceAccumulatedKm).toBeCloseTo(0, 9);
    expect(result.forward.readings[1]?.distanceAccumulatedKm).toBeCloseTo(0.6, 9);
  });
});

describe("las distancias de un intermedio no cuentan", () => {
  it("una radiación con distancia capturada NO la aporta al acumulado", () => {
    // El SQL del paso 3 de la migración sí las sumaba, así que la columna
    // persistida y el motor daban números distintos para el mismo punto.
    const rows = [
      bare({ pointType: "bm", backsight: 1.5, backDistanceM: 150 }),
      bare({ pointType: "pc", foresight: 1.2, backsight: 2.0,
             foreDistanceM: 150, backDistanceM: 150 }),
      bare({ pointType: "intermediate", foresight: 1.0, foreDistanceM: 50 }),
      bare({ pointType: "bm", foresight: 1.5, foreDistanceM: 150 }),
    ];
    // La radiación hereda el acumulado de su armada (hasta el instrumento,
    // 450 m); el punto de cambio está a 300 m del origen (Fase 19, N8).
    expect(accumulateDistances(rows)).toEqual([0, 300, 450, 600]);
  });

  it("tampoco entran en el total", () => {
    const rows = [
      bare({ pointType: "bm", backsight: 1.5, backDistanceM: 150 }),
      bare({ pointType: "intermediate", foresight: 1.0, foreDistanceM: 999 }),
      bare({ pointType: "bm", foresight: 1.5, foreDistanceM: 150 }),
    ];
    expect(totalDistanceFromReadings(rows)).toBeCloseTo(0.3, 9);
  });

  it("el motor no expone distancia resuelta en una radiación", () => {
    // Lo que se persiste sale de aquí: si el motor la expusiera, el export
    // imprimiría metros que el total no incluye.
    const result = computeLeveling({
      type: "closed", startElevation: 100, endElevation: null, order: "tercer_orden",
      forward: [
        bare({ pointType: "bm", backsight: 1.5, backDistanceM: 150 }),
        bare({ pointType: "intermediate", foresight: 1.0, foreDistanceM: 50 }),
        bare({ pointType: "bm", foresight: 1.5, foreDistanceM: 150 }),
      ],
      return: null,
    });
    expect(result.forward.readings[1]?.foreDistanceResolvedM).toBeNull();
    expect(result.forward.readings[1]?.backDistanceResolvedM).toBeNull();
  });
});

describe("hilos inválidos no envenenan la cadena", () => {
  it("hilos iguales NO anulan la distancia tecleada", () => {
    // `stadiaDistance` daría 0, y `0 ?? 30` es 0: la tecleada se perdía.
    const row = bare({ backUpperM: 1.4, backLowerM: 1.4, backDistanceM: 30 });
    expect(resolveVisualDistances(row).back).toBe(30);
  });

  it("hilos invertidos NO restan del acumulado", () => {
    // (1.2 − 1.5)·100 = −30, que restaba del total.
    const row = bare({ backUpperM: 1.2, backLowerM: 1.5, backDistanceM: 30 });
    expect(resolveVisualDistances(row).back).toBe(30);
  });

  it("un par inválido sin distancia tecleada deja la visual sin distancia", () => {
    const row = bare({ backUpperM: 1.4, backLowerM: 1.4 });
    expect(resolveVisualDistances(row).back).toBeNull();
  });

  it("el acumulado nunca decrece con hilos invertidos", () => {
    // Una ruta que llama a computeLeveling sin validar antes (seed, demo)
    // obtenía un total envenenado.
    const rows = [
      bare({ backDistanceM: 100 }),
      bare({ foreUpperM: 1.2, foreLowerM: 1.5, foreDistanceM: 50 }),
    ];
    const acc = accumulateDistances(rows);
    expect(acc[1]).toBeGreaterThanOrEqual(acc[0] ?? 0);
    expect(acc[1]).toBe(150);
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
  it("el acumulado de un punto es el recorrido hasta él, sin su propia V+ (N8)", () => {
    // El primer punto está en el origen. El segundo, a su armada entera
    // (30 + 30 m); sus 25 m de V+ son la visual hacia la armada siguiente.
    const rows = [
      bare({ backDistanceM: 30 }),
      bare({ foreDistanceM: 30, backDistanceM: 25 }),
    ];
    expect(accumulateDistances(rows)).toEqual([0, 60]);
  });

  it("un proceso reconstruido conserva la regla anterior", () => {
    // El backfill de la Fase 9 partió cada tramo entre la V− y la V+ de la
    // MISMA fila: allí la V+ es la mitad del tramo que llega al punto.
    const rows = [
      bare({ backDistanceM: 30 }),
      bare({ foreDistanceM: 30, backDistanceM: 25 }),
    ];
    expect(accumulateDistances(rows, { reconstructed: true })).toEqual([30, 85]);
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
    // El intermedio hereda la distancia hasta el instrumento de su armada.
    expect(accumulateDistances(rows)).toEqual([0, 30, 50, 90]);
  });

  it("una fila sin distancias no rompe la cadena: aporta 0", () => {
    const rows = [
      bare({ backDistanceM: 30 }),
      bare({}),
      bare({ foreDistanceM: 20 }),
    ];
    expect(accumulateDistances(rows)).toEqual([0, 30, 50]);
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
    expect((acc.at(-1) ?? 0) / 1000).toBeCloseTo(
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
    expect((acc.at(-1) ?? 0) / 1000).toBeCloseTo(
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
//   ΣV+ = 4.500 · ΣV− = 4.508 · diferencia = −0.008 = Δcota. Cuadra.
const CLOSED_RUN: ReadingInput[] = fromAccum([
  r("BM-1", "bm", 1.5, null, 0.0),
  r("PC-1", "pc", 2.0, 1.2, 0.3),
  r("PC-2", "pc", 1.0, 2.5, 0.6),
  r("BM-1", "bm", null, 0.808, 0.9),
]);

describe("computeRun — cálculo base", () => {
  const run = computeRun(CLOSED_RUN, 100.0);

  it("calcula la AI solo en las filas con V+", () => {
    expect(run.readings.map((x) => x.instrumentHeight)).toEqual([
      101.5, 102.3, 100.8, null,
    ]);
  });

  it("consume la AI anterior antes de generar la nueva", () => {
    // PC-1: cota = AI(BM-1) 101.5 − V− 1.2 = 100.3
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

  it("cuadra la comprobación aritmética ΣV+ − ΣV− = Δcota", () => {
    expect(run.sumBacksights).toBeCloseTo(4.5, 6);
    expect(run.sumForesights).toBeCloseTo(4.508, 6);
    expect(run.arithmeticCheckOk).toBe(true);
  });
});

describe("computeRun — puntos intermedios", () => {
  // Un intermedio cuelga de la AI vigente y NO la actualiza.
  const withIntermediate: ReadingInput[] = fromAccum([
    r("BM-1", "bm", 1.5, null, 0.0),
    r("A", "intermediate", null, 1.1, 0.1),
    r("PC-1", "pc", 2.0, 1.2, 0.3),
    r("BM-2", "bm", null, 2.5, 0.6),
  ]);
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
    // ΣV+ = 1.5 + 2.0 = 3.5 (el intermedio no aporta V+, y su V− se ignora)
    // ΣV− = 1.2 + 2.5 = 3.7 → diferencia −0.2 = 99.8 − 100.0. Cuadra.
    expect(run.sumBacksights).toBeCloseTo(3.5, 6);
    expect(run.sumForesights).toBeCloseTo(3.7, 6);
    expect(run.arithmeticCheckOk).toBe(true);
  });
});

describe("computeRun — el orden consumir → generar", () => {
  // Este es el test que protege contra el error más difícil de ver a ojo:
  // invertir el orden dentro de la fila desplaza TODAS las cotas del recorrido
  // de forma coherente, así que el resultado sigue pareciendo plausible.
  it("no usa la V+ de la propia fila para calcular su cota", () => {
    const run = computeRun(
      fromAccum([
        r("BM-1", "bm", 1.5, null, 0.0),
        // Si la implementación generase la AI antes de consumirla, la cota de
        // PC-1 saldría de 100.0 + 1.5 + 2.0 − 1.2, no de 101.5 − 1.2.
        r("PC-1", "pc", 2.0, 1.2, 0.3),
      ]),
      100.0,
    );
    expect(run.readings[1]?.elevationCalculated).toBeCloseTo(100.3, 6);
    expect(run.readings[1]?.elevationCalculated).not.toBeCloseTo(102.3, 6);
  });

  it("deja la primera fila en la cota de partida, sin V− que consumir", () => {
    const run = computeRun(fromAccum([r("BM-1", "bm", 1.5, null, 0.0)]), 100.0);
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

  it("el BM de partida no se compensa: su cota es conocida (Fase 19, N8)", () => {
    const first = result.forward.readings[0]!;
    expect(first.correctionApplied).toBe(0);
    expect(first.elevationCorrected).toBe(100.0);
  });

  it("cotas compensadas del circuito del seed con la distancia desde el origen", () => {
    // Hasta la Fase 19: 100.0013 / 100.3040 / 99.8067 / 100.0000. El cambio
    // es la V+ de cada punto, que el acumulado ya no incluye.
    const corrected = result.forward.readings.map((x) => Number(x.elevationCorrected.toFixed(4)));
    expect(corrected).toEqual([100.0, 100.3027, 99.8053, 100.0]);
  });

  it("un proceso reconstruido conserva la compensación anterior", () => {
    // Mismas filas, reparto de la Fase 9: el tramo, entre la V− y la V+ de la
    // misma fila. Con la marca, el acumulado —y la compensación— son los de
    // antes de la Fase 19.
    const halves: ReadingInput[] = [
      bare({ pointCode: "BM-1", pointType: "bm", backsight: 1.5 }),
      bare({ pointCode: "PC-1", pointType: "pc", backsight: 2.0, foresight: 1.2, foreDistanceM: 150, backDistanceM: 150 }),
      bare({ pointCode: "PC-2", pointType: "pc", backsight: 1.0, foresight: 2.5, foreDistanceM: 150, backDistanceM: 150 }),
      bare({ pointCode: "BM-1", pointType: "bm", foresight: 0.808, foreDistanceM: 300 }),
    ];
    const r = computeLeveling({ ...CLOSED_INPUT, forward: halves, distancesReconstructed: true });
    const corrections = r.forward.readings.map((x) => Number((x.correctionApplied * 1000).toFixed(2)));
    expect(corrections).toEqual([0.0, 2.67, 5.33, 8.0]);
  });

  it("hace que el BM final cierre exacto tras la corrección", () => {
    const last = result.forward.readings.at(-1);
    expect(last?.elevationCorrected).toBeCloseTo(100.0, 6);
  });
});

describe("computeLeveling — enlace", () => {
  // BM-A 250.000 → BM-B conocida 248.700. Cadena que llega a 248.685: −15 mm.
  const linkRun: ReadingInput[] = fromAccum([
    r("BM-A", "bm", 1.0, null, 0.0),
    r("PC-1", "pc", 2.0, 1.5, 1.1),
    r("BM-B", "bm", null, 2.815, 2.2),
  ]);
  const result = computeLeveling({
    type: "link",
    startElevation: 250.0,
    endElevation: 248.7,
    order: "tercer_orden",
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
    forward: fromAccum([
      r("BM-X", "bm", 1.325, null, 0.0),
      r("PC-1", "pc", 0.654, 0.876, 0.08),
      r("PC-2", "pc", null, 1.987, 0.16),
    ]),
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

describe("computeLeveling — abierta con vuelta (Fase 16, hallazgo 3)", () => {
  // Ida BM-X → PC-2 (+0.5 m), vuelta PC-2 → BM-X (−0.5 m). Sin cota de llegada
  // conocida, la vuelta arranca en la cota CALCULADA de PC-2, no en la de BM-X.
  const result = computeLeveling({
    type: "open",
    startElevation: 500.0,
    endElevation: null,
    order: "tercer_orden",
    forward: fromAccum([
      r("BM-X", "bm", 1.5, null, 0.0),
      r("PC-2", "bm", null, 1.0, 0.08),
    ]),
    return: fromAccum([
      r("PC-2", "bm", 1.0, null, 0.0),
      r("BM-X", "bm", null, 1.5, 0.08),
    ]),
  });

  it("la vuelta parte de la cota final de la ida", () => {
    expect(result.return!.readings[0]!.elevationCalculated).toBeCloseTo(500.5, 6);
    expect(result.return!.readings.at(-1)!.elevationCalculated).toBeCloseTo(500.0, 6);
  });

  it("la discrepancia y el error de la vuelta no cambian", () => {
    expect(result.discrepancyMm).toBeCloseTo(0, 6);
    expect(result.return!.errorMm).toBeNull();
  });
});

describe("computeLeveling — ida y vuelta", () => {
  // La vuelta es una medición INDEPENDIENTE: distintos puntos de cambio y
  // distinto número de armadas que la ida. Solo comparten los BM extremos.
  //   ida:    3 armadas, Δh = −0.008
  //   vuelta: 2 armadas, Δh = +0.010 (sentido opuesto)
  const returnRun: ReadingInput[] = fromAccum([
    r("BM-1", "bm", 1.2, null, 0.0),
    r("PV-1", "pc", 1.6, 0.9, 0.45),
    r("BM-1", "bm", null, 1.89, 0.9),
  ]);

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
      return: fromAccum([
        r("BM-1", "bm", 1.2, null, 0.0),
        r("BM-1", "bm", null, 1.17, 0.9),
      ]), // Δh = +0.030 → discrepancia |−0.008 + 0.030| = 22 mm
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
  // recorrido necesita que el BM de cierre lleve V+ (algo inusual en la
  // práctica de campo, pero es exactamente el escenario que hace que el
  // bug se manifieste: una fila después del BM de cierre con una AI
  // vigente y V− 0.805, tal como lo reportó la revisión).
  const closedRunWithBacksightAtClose: ReadingInput[] = fromAccum([
    r("BM-1", "bm", 1.5, null, 0.0),
    r("PC-1", "pc", 2.0, 1.2, 0.3),
    r("PC-2", "pc", 1.0, 2.5, 0.6),
    r("BM-1", "bm", 1.5, 0.808, 0.9), // BM de cierre, ahora con V+ propia
    r("RAD-1", "intermediate", null, 0.805, 0.9), // radiación tras el cierre
  ]);

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
    const withMiddleIntermediate: ReadingInput[] = fromAccum([
      r("BM-1", "bm", 1.5, null, 0.0),
      r("A", "intermediate", null, 1.1, 0.1),
      r("PC-1", "pc", 2.0, 1.2, 0.3),
      r("PC-2", "pc", 1.0, 2.5, 0.6),
      r("BM-1", "bm", null, 0.808, 0.9),
    ]);
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
    const returnWithTrailingIntermediate: ReadingInput[] = fromAccum([
      r("BM-1", "bm", 1.2, null, 0.0),
      r("PV-1", "pc", 1.6, 0.9, 0.45),
      r("BM-1", "bm", 1.0, 1.89, 0.9), // BM de cierre de la vuelta, con V+
      r("RAD-V", "intermediate", null, 0.5, 0.9), // radiación tras el cierre
    ]);
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

  // Desde la Fase 9 la distancia NO se teclea, así que `NaN` y los negativos
  // dejan de ser representables: la entrada inválida llega ahora por una sola
  // puerta, una libreta SIN distancias capturadas. La protección sigue siendo
  // la misma y estos tests la ejercen por esa puerta.
  const SIN_DISTANCIAS: ReadingInput[] = [
    bare({ pointCode: "BM-1", pointType: "bm", backsight: 1.5 }),
    bare({ pointCode: "PC-1", pointType: "pc", foresight: 1.2, backsight: 2.0 }),
    bare({ pointCode: "PC-2", pointType: "pc", foresight: 2.5, backsight: 1.0 }),
    bare({ pointCode: "BM-1", pointType: "bm", foresight: 0.808 }),
  ];

  it("sin distancias capturadas deja tolerancia y cumplimiento en null, sin tocar el error de cierre", () => {
    const result = computeLeveling({ ...CLOSED_INPUT, forward: SIN_DISTANCIAS });
    expect(result.closureErrorMm).toBeCloseTo(-8.0, 4);
    expect(result.toleranceMm).toBeNull();
    expect(result.meetsTolerance).toBeNull();
  });

  it("una libreta vacía deja tolerancia y cumplimiento en null", () => {
    const result = computeLeveling({ ...CLOSED_INPUT, forward: [] });
    expect(result.toleranceMm).toBeNull();
    expect(result.meetsTolerance).toBeNull();
  });

  it("no aplica corrección proporcional sin tolerancia calculable", () => {
    const result = computeLeveling({ ...CLOSED_INPUT, forward: SIN_DISTANCIAS });
    for (const reading of result.forward.readings) {
      expect(reading.correctionApplied).toBe(0);
      expect(reading.elevationCorrected).toBeCloseTo(
        reading.elevationCalculated,
        6,
      );
    }
  });

  it("en ida y vuelta, sin distancias deja discrepancyToleranceMm y meetsDiscrepancy en null", () => {
    const returnSinDistancias: ReadingInput[] = [
      bare({ pointCode: "BM-1", pointType: "bm", backsight: 1.2 }),
      bare({ pointCode: "PV-1", pointType: "pc", foresight: 0.9, backsight: 1.6 }),
      bare({ pointCode: "BM-1", pointType: "bm", foresight: 1.89 }),
    ];
    const result = computeLeveling({
      ...CLOSED_INPUT,
      forward: SIN_DISTANCIAS,
      return: returnSinDistancias,
    });
    // La discrepancia en sí (no depende de K, solo de los dos desniveles) se
    // sigue calculando; solo la tolerancia contra la que se compara queda null.
    expect(result.discrepancyMm).toBeCloseTo(2.0, 4);
    expect(result.discrepancyToleranceMm).toBeNull();
    expect(result.meetsDiscrepancy).toBeNull();
  });

  it("no produce NaN en ningún campo numérico del resultado", () => {
    const returnRun: ReadingInput[] = fromAccum([
      r("BM-1", "bm", 1.2, null, 0.0),
      r("PV-1", "pc", 1.6, 0.9, 0.45),
      r("BM-1", "bm", null, 1.89, 0.9),
    ]);
    const result = computeLeveling({
      ...CLOSED_INPUT,
      forward: SIN_DISTANCIAS,
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
