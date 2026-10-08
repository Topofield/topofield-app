import { describe, expect, it } from "vitest";
import { computeLevelingDetected } from "@/lib/calculations/leveling";
import { NIVELACION_VERJON, nivelacionTramo2, type NivelacionDemo } from "@/lib/demo/fixtures";
import type { ReadingInput } from "@/types/leveling";
import { evaluateWorkbook, formulaMismatches } from "./formula-check";
import { buildLevelingWorkbook } from "./leveling-workbook";

const lectura = (r: NivelacionDemo["forward"][number]): ReadingInput => ({
  pointCode: r.code, pointType: r.type, backsight: r.back ?? null, foresight: r.fore ?? null,
  backUpperM: r.backUpperM ?? null, backLowerM: r.backLowerM ?? null,
  foreUpperM: r.foreUpperM ?? null, foreLowerM: r.foreLowerM ?? null,
  backDistanceM: r.backDistanceM ?? null, foreDistanceM: r.foreDistanceM ?? null,
  distanceAccumulatedKm: null,
});

/** Una cerrada con hilos en todas las visuales, y una vista intermedia: la demo no trae hilos. */
const CON_HILOS: NivelacionDemo = {
  ...NIVELACION_VERJON,
  name: "Cerrada con hilos",
  type: "closed",
  startBmCode: "BM-1",
  startElevation: 100,
  endBmCode: undefined,
  endElevation: undefined,
  forward: [
    { code: "BM-1", type: "bm", back: 1.5, backUpperM: 1.65, backLowerM: 1.35 },
    { code: "PC-1", type: "pc", fore: 1.2, foreUpperM: 1.33, foreLowerM: 1.07, back: 1.4, backUpperM: 1.52, backLowerM: 1.28 },
    { code: "P-1", type: "intermediate", fore: 1.1, foreUpperM: 1.2, foreLowerM: 1.0 },
    { code: "BM-1", type: "bm", fore: 1.703, foreUpperM: 1.823, foreLowerM: 1.583 },
  ],
  return: undefined,
};

function libro(n: NivelacionDemo, sinVuelta = false) {
  const input = {
    type: n.type, startElevation: n.startElevation, endElevation: n.endElevation ?? null,
    forward: n.forward.map(lectura), return: sinVuelta || !n.return ? null : n.return.map(lectura),
  };
  const detected = computeLevelingDetected(input);
  const wb = buildLevelingWorkbook({
    process: { name: n.name, type: n.type, startBmCode: n.startBmCode, endBmCode: n.endBmCode ?? null,
      equipment: null, levelType: null, notes: null },
    project: null, input, detected,
  });
  return { wb, detected };
}

describe("Excel de la nivelación — fórmulas contra el motor", () => {
  it.each([
    ["El Verjón, abierta con vuelta", () => libro(NIVELACION_VERJON)],
    ["el tramo 2, cerrada", () => libro(nivelacionTramo2())],
    ["El Verjón sin vuelta: abierta sin verificación", () => libro(NIVELACION_VERJON, true)],
    ["una cerrada con hilos: tres filas por punto", () => libro(CON_HILOS)],
  ])("%s: toda fórmula da el valor del motor", (_, make) => {
    expect(formulaMismatches(make().wb)).toEqual([]);
  });

  it("las hojas de El Verjón: ida, vuelta, cotas ajustadas y resumen", () => {
    expect(libro(NIVELACION_VERJON).wb.worksheets.map((w) => w.name)).toEqual([
      "Nivelación", "Contranivelación", "Cotas ajustadas", "Resumen",
    ]);
  });

  it("el orden alcanzado de El Verjón es el que detecta la app", () => {
    const { wb, detected } = libro(NIVELACION_VERJON);
    const values = evaluateWorkbook(wb);
    const orden = [...values.entries()].find(([k, v]) => k.startsWith("'Nivelación'") && v === "Segundo orden");
    expect(detected.order).toBe("segundo_orden");
    expect(orden).toBeDefined();
  });

  it("cambiar una V− en el Excel recalcula las cotas que siguen", () => {
    const { wb } = libro(nivelacionTramo2());
    const ws = wb.getWorksheet("Nivelación")!;
    let fila = 0;
    ws.eachRow((row, r) => { if (!fila && typeof row.getCell(5).value === "number") fila = r; });
    const antes = evaluateWorkbook(wb);
    const despues = evaluateWorkbook(wb, { [`'Nivelación'!E${fila}`]: (ws.getCell(`E${fila}`).value as number) + 0.01 });
    expect(despues.get(`'Nivelación'!G${fila}`)).toBeCloseTo((antes.get(`'Nivelación'!G${fila}`) as number) - 0.01, 9);
  });

  it("con hilos, la distancia sale de ellos por fórmula: (superior − inferior) × 100", () => {
    const ws = libro(CON_HILOS).wb.getWorksheet("Nivelación")!;
    const formulas: string[] = [];
    ws.getColumn(8).eachCell((c) => { if (c.formula) formulas.push(c.formula); });
    expect(formulas[0]).toMatch(/^\(C\d+-C\d+\)\*100$/);
  });
});
