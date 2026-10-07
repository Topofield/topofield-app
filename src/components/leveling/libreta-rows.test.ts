import { describe, expect, it } from "vitest";
import { CARTERA_VERJON } from "@/lib/demo/carteras";
import { computeLevelingDetected } from "@/lib/calculations/leveling";
import type { ReadingDraft } from "@/app/(app)/projects/[id]/leveling/[pid]/actions";
import { emptyRow } from "./armadas";
import { arithmeticOf, armadaSummaries, formatReading, sheetRows } from "./libreta-rows";

const toDraft = (x: (typeof CARTERA_VERJON.ida)[number]): ReadingDraft => ({
  ...emptyRow(x.code, x.type),
  backsight: x.backsight,
  foresight: x.foresight,
  backDistanceM: x.backDistanceM,
  foreDistanceM: x.foreDistanceM,
});
const ida = CARTERA_VERJON.ida.map(toDraft);
const vuelta = CARTERA_VERJON.vuelta.map(toDraft);
const input = (rows: ReadingDraft[]) => rows.map((d) => ({ ...d, distanceAccumulatedKm: null }));
const { result } = computeLevelingDetected({
  type: "open",
  startElevation: CARTERA_VERJON.startElevation,
  endElevation: null,
  forward: input(ida),
  return: input(vuelta),
});

describe("la tabla de la hoja", () => {
  const rows = sheetRows(ida, result.forward.readings, { run: "forward", type: "open" });

  it("cada fila con sus lecturas, la AI y la cota sin compensar, como la hoja", () => {
    expect(rows).toHaveLength(ida.length);
    expect(rows[0]).toMatchObject({ pointCode: "D1", badge: "BM", backsight: 1.209, backDistanceM: 31.5, foresight: null });
    expect(rows[0]!.instrumentHeight).toBeCloseTo(3289.709, 4);
    expect(rows[1]).toMatchObject({ pointCode: "C 1", foresight: 0.268, foreDistanceM: 28.5, badge: null });
    expect(rows[1]!.elevation).toBeCloseTo(3289.441, 4);
    const aux = rows.find((r) => r.pointCode === "AUX1")!;
    expect(aux).toMatchObject({ badge: "intermedia", intermediate: 0.194, foresight: null, backsight: null });
    expect(aux.elevation).toBeCloseTo(3299.627, 4);
    expect(rows.at(-1)).toMatchObject({ pointCode: "D4", badge: "fin de la ida" });
    expect(rows.at(-1)!.elevation).toBeCloseTo(3315.083, 4);
  });

  it("el lápiz abre la armada que la fila cierra; el BM de partida, la primera; la intermedia, la suya", () => {
    expect(rows.map((r) => r.armada)).toEqual([0, 0, 1, 2, 3, 3, 4, 5, 6, 7, 8, 9]);
  });

  it("en la vuelta de una abierta, el punto de partida es el fin de la ida", () => {
    const back = sheetRows(vuelta, result.return!.readings, { run: "return", type: "open" });
    expect(back[0]).toMatchObject({ pointCode: "D4", badge: "fin de la ida" });
    expect(back.at(-1)).toMatchObject({ pointCode: "D1", badge: "BM" });
  });

  it("sin armadas, solo la fila del BM y sin lápiz", () => {
    const only = sheetRows([emptyRow("D1", "bm")], [], { run: "forward", type: "closed" });
    expect(only).toEqual([expect.objectContaining({ pointCode: "D1", badge: "BM", armada: null, elevation: null })]);
  });
});

describe("la lista por armada del teléfono", () => {
  it("de → a, con sus visuales, la intermedia y la cota adelante", () => {
    const list = armadaSummaries(ida, result.forward.readings);
    expect(list).toHaveLength(10);
    expect(list[0]).toMatchObject({ k: 0, from: "D1", to: "C 1", backsight: 1.209, foresight: 0.268 });
    expect(list[3]!.intermediates).toEqual([expect.objectContaining({ pointCode: "AUX1", reading: 0.194 })]);
    expect(list[3]!.intermediates[0]!.elevation).toBeCloseTo(3299.627, 4);
    expect(list[9]).toMatchObject({ from: "C 8", to: "D4", ends: true });
    expect(list[9]!.elevation).toBeCloseTo(3315.083, 4);
  });
});

describe("la comprobación aritmética", () => {
  it("la ida de El Verjón: Σ V+ − Σ V− = 26.583 m, cuadra, 384.3 m", () => {
    const check = arithmeticOf(result.forward);
    expect(check.sumBack - check.sumFore).toBeCloseTo(26.583, 6);
    expect(check.heightDifference).toBeCloseTo(26.583, 6);
    expect(check.ok).toBe(true);
    expect(check.distanceM).toBeCloseTo(384.3, 6);
  });
});

describe("formatReading", () => {
  it("tres decimales, o cuatro si vienen del nivel digital", () => {
    expect(formatReading(1.209)).toBe("1.209");
    expect(formatReading(0.5)).toBe("0.500");
    expect(formatReading(1.2345)).toBe("1.2345");
    expect(formatReading(null)).toBe("—");
  });
});
