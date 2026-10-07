import { describe, expect, it } from "vitest";
import { computeLevelingDetected } from "@/lib/calculations/leveling";
import { NIVELACION_VERJON, nivelacionTramo2, type LecturaNivelacionDemo, type NivelacionDemo } from "@/lib/demo/fixtures";
import type { LevelingInput, ReadingInput } from "@/types/leveling";
import { comparisonData, compensationRows, pointReadings } from "./comparison-data";

const lectura = (r: LecturaNivelacionDemo): ReadingInput => ({
  pointCode: r.code,
  pointType: r.type,
  backsight: r.back ?? null,
  foresight: r.fore ?? null,
  backUpperM: null,
  backLowerM: null,
  foreUpperM: null,
  foreLowerM: null,
  backDistanceM: r.backDistanceM ?? null,
  foreDistanceM: r.foreDistanceM ?? null,
  distanceAccumulatedKm: null,
});

function nivelar(n: NivelacionDemo, sinVuelta = false) {
  const input: Omit<LevelingInput, "order" | "compensation"> = {
    type: n.type,
    startElevation: n.startElevation,
    endElevation: n.endElevation ?? null,
    forward: n.forward.map(lectura),
    return: n.return && !sinVuelta ? n.return.map(lectura) : null,
  };
  return { input, result: computeLevelingDetected(input).result };
}

const verjon = nivelar(NIVELACION_VERJON);
const tramo2 = nivelar(nivelacionTramo2());
const at = <T extends { code: string }>(rows: T[], code: string) => rows.find((r) => r.code.replace(/\s/g, "") === code)!;

describe("el gráfico de la compensación", () => {
  // Las cifras en mm, a la décima que se muestra: la cota ajustada no se redondea.
  it("El Verjón: la ida en C 1 a +1.0 mm de la ajustada, la vuelta a −6.0, y las dos a −2.5 en D4", () => {
    const data = comparisonData(verjon.result, verjon.input)!;
    expect(data.lengthM).toBeCloseTo(384.3, 6);
    expect(at(data.forward, "C1").diffMm).toBeCloseTo(1.0, 1);
    expect(at(data.back!, "C1").diffMm).toBeCloseTo(-6.0, 1);
    expect(data.forward.at(-1)!.diffMm).toBeCloseTo(-2.5, 1);
    expect(data.back![0]!.diffMm).toBeCloseTo(-2.5, 1);
    expect(data.back!.at(-1)!.diffMm).toBeCloseTo(-5.0, 1);
    // La vuelta va sobre la ida: cada punto homólogo, en la misma distancia.
    expect(at(data.back!, "C1").x).toBeCloseTo(at(data.forward, "C1").x, 9);
    expect(at(data.adjusted, "C1").elevation).toBeCloseTo(3289.44, 4);
    expect(at(data.adjusted, "D1").known).toBe(true);
  });

  it("las cifras de los extremos: +1.0 y −2.5 en la ida, −6.0 y −5.0 en la vuelta; −2.5 una sola vez", () => {
    const data = comparisonData(verjon.result, verjon.input)!;
    const labels = data.labels.map((l) => {
      const p = (l.series === "forward" ? data.forward : data.back!)[l.index]!;
      return `${l.series} ${p.code.replace(/\s/g, "")} ${p.diffMm.toFixed(1)}`;
    });
    expect(labels.sort()).toEqual(["back C1 -6.0", "back D1 -5.0", "forward C1 1.0", "forward D4 -2.5"]);
  });

  it("el tramo 2: cerrada, sin vuelta, llega 0.4 mm abajo del BM", () => {
    const data = comparisonData(tramo2.result, tramo2.input)!;
    expect(data.back).toBeNull();
    expect(data.forward.at(-1)!.diffMm).toBeCloseTo(-0.4, 1);
    expect(data.forward[0]!.diffMm).toBeCloseTo(0, 9);
  });

  it("la abierta sin vuelta no tiene gráfico de compensación", () => {
    const solo = nivelar(NIVELACION_VERJON, true);
    expect(comparisonData(solo.result, solo.input)).toBeNull();
  });
});

describe("la tabla de la compensación", () => {
  it("El Verjón: cada punto de la ida con su homólogo de la vuelta, las correcciones y la cota ajustada", () => {
    const rows = compensationRows(verjon.result, verjon.input);
    expect(rows).toHaveLength(12);
    const c1 = at(rows, "C1");
    expect(c1.distanceM).toBeCloseTo(60, 6);
    expect(c1.forward!.elevation).toBeCloseTo(3289.441, 6);
    expect(c1.back!.elevation).toBeCloseTo(3289.434, 6);
    expect(c1.diffMm).toBeCloseTo(-7, 1);
    expect(c1.forward!.correctionMm).toBeCloseTo(0.38, 2);
    expect(c1.back!.correctionMm).toBeCloseTo(4.61, 2);
    expect(c1.adjusted).toBeCloseTo(3289.44, 4);
    const d1 = rows[0]!;
    expect(d1).toMatchObject({ code: "D1", known: true });
    expect(d1.back!.correctionMm).toBeCloseTo(5.0, 1);
    expect(d1.adjusted).toBeCloseTo(3288.5, 9);
    expect(at(rows, "AUX1").back).not.toBeNull();
  });

  it("el tramo 2: una fila por lectura de la ida; el BM, con su cota conocida al salir y al llegar", () => {
    const rows = compensationRows(tramo2.result, tramo2.input);
    expect(rows).toHaveLength(tramo2.input.forward.length);
    expect(rows.every((r) => r.back === null && r.diffMm === null)).toBe(true);
    expect(rows[0]!.known && rows.at(-1)!.known).toBe(true);
    expect(rows.at(-1)!.forward!.correctionMm).toBeCloseTo(0.4, 1);
    expect(rows.at(-1)!.adjusted).toBeCloseTo(tramo2.input.startElevation, 9);
  });
});

describe("las lecturas de cada punto", () => {
  it("el tramo 2: nueve puntos; los leídos al ir y al volver, con sus dos lecturas", () => {
    const points = pointReadings(tramo2.result, tramo2.input);
    expect(points.map((p) => p.code)).toEqual(["C10", "C11", "C12", "C13", "C14", "C15", "C16", "C17", "C18"]);
    expect(points[0]).toMatchObject({ known: true, readings: [2541.7545, expect.closeTo(2541.7541, 4)] });
    expect(points[7]!.readings).toEqual([expect.closeTo(2542.7313, 4), expect.closeTo(2542.7289, 4)]);
    expect(points[7]!.adjusted).toBeCloseTo(2542.7303, 4);
    expect(points[8]!.readings).toHaveLength(1);
  });
});
