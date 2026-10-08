import { describe, expect, it } from "vitest";
import { computePolygonalDetected } from "@/lib/calculations/polygonal";
import { PROCESOS_DEMO, type ProcesoDemo } from "@/lib/demo/fixtures";
import { resultadosDe } from "@/lib/demo/insertar-poligonal";
import type { CorrectionMethod, PolygonalInput } from "@/types/polygonal";
import { evaluateWorkbook, formulaMismatches } from "./formula-check";
import { buildPolygonalWorkbook } from "./polygonal-workbook";

const TT4 = PROCESOS_DEMO.find((p) => p.name.startsWith("Poligonal V10"))!;

function libro(p: ProcesoDemo, method: CorrectionMethod = p.correctionMethod ?? "bowditch") {
  const { resultado, input, order, angleType } = resultadosDe({ ...p, correctionMethod: method });
  return buildPolygonalWorkbook({
    process: { name: p.name, type: p.type, method, startPointCode: p.startPointCode, equipment: null,
      georeference: null, notes: null },
    project: null,
    input: { ...input, order: order ?? "ordinario", angleType },
    detected: { result: resultado, order, angleType },
  });
}

const abierta = (type: "open_controlled" | "open_uncontrolled"): Omit<PolygonalInput, "order" | "angleType"> => ({
  type, method: "bowditch", startNorth: 1000, startEast: 2000, startAzimuth: 45,
  endNorth: 1061.204, endEast: 2133.578, endAzimuth: 120.0042,
  hasOrientation: false, hasClosingRow: false, leastSquares: null,
  stations: [
    { pointCode: "A", angle: 0, deflectionDirection: null, distance: 50.123, readings: [] },
    { pointCode: "B", angle: type === "open_controlled" ? 30.5 : 210.5, deflectionDirection: "right", distance: 60.456, readings: [] },
    { pointCode: "C", angle: type === "open_controlled" ? 15.25 : 164.75, deflectionDirection: "left", distance: 40.789, readings: [] },
    { pointCode: "D", angle: 59.7539, deflectionDirection: "right", distance: null, readings: [] },
  ],
});

function libroDe(input: Omit<PolygonalInput, "order" | "angleType">) {
  const detected = computePolygonalDetected(input);
  return buildPolygonalWorkbook({
    process: { name: "Sintética", type: input.type, method: input.method, startPointCode: "A", equipment: null,
      georeference: { date: "2026-10-08", points: "A y D", rotationDeg: 1.25, scale: 1.0001 }, notes: null },
    project: null,
    input: { ...input, order: detected.order ?? "ordinario", angleType: detected.angleType },
    detected,
  });
}

describe("Excel de la poligonal — fórmulas contra el motor", () => {
  it.each(["bowditch", "transit", "crandall"] as const)("la TT4 por %s", (m) => {
    expect(formulaMismatches(libro(TT4, m))).toEqual([]);
  });

  it.each(["open_controlled", "open_uncontrolled"] as const)("la abierta %s", (t) => {
    expect(formulaMismatches(libroDe(abierta(t)))).toEqual([]);
  });

  it("la abierta con control con Crandall y Tránsito", () => {
    expect(formulaMismatches(libroDe({ ...abierta("open_controlled"), method: "crandall" }))).toEqual([]);
    expect(formulaMismatches(libroDe({ ...abierta("open_controlled"), method: "transit" }))).toEqual([]);
  });

  it("la hoja lleva el nombre del método", () => {
    expect(libro(TT4, "crandall").worksheets[0]!.name).toBe("CRANDALL");
    expect(libroDe(abierta("open_uncontrolled")).worksheets[0]!.name).toBe("ABIERTA SIN CONTROL");
  });

  it("el orden alcanzado de la TT4 es el que detecta la app", () => {
    const { order } = resultadosDe(TT4);
    const values = [...evaluateWorkbook(libro(TT4)).values()];
    expect(order).toBe("tercer_orden");
    expect(values).toContain("Tercer orden");
  });

  it("cambiar una distancia recalcula las coordenadas", () => {
    const wb = libro(TT4, "bowditch");
    const ws = wb.worksheets[0]!;
    let fila = 0;
    ws.eachRow((row, r) => { if (!fila && typeof row.getCell(16).value === "number") fila = r; });
    const antes = evaluateWorkbook(wb);
    const despues = evaluateWorkbook(wb, { [`'BRÚJULA'!P${fila}`]: (ws.getCell(`P${fila}`).value as number) + 0.5 });
    expect(despues.get(`'BRÚJULA'!W${fila + 1}`)).not.toBeCloseTo(antes.get(`'BRÚJULA'!W${fila + 1}`) as number, 6);
  });

  it("la georreferenciada lleva su bloque con la rotación y la escala como datos", () => {
    const ws = libroDe(abierta("open_controlled")).worksheets[0]!;
    const textos: string[] = [];
    ws.eachRow((row) => row.eachCell((c) => { if (typeof c.value === "string") textos.push(c.value); }));
    expect(textos).toEqual(expect.arrayContaining(["Georreferenciación", "Rotación (°)", "Escala"]));
  });
});
