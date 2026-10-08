import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { ANGULAR_TOLERANCE_K, LEVELING_TOLERANCE_K, MIN_RELATIVE_PRECISION } from "@/lib/calculations/tolerances";
import { PRECISION_ORDERS } from "@/types/project";
import { at, col, putData, putFormula, ref, roundHalfUp, writeLevelingTolerances, writePolygonalTolerances, writeSheetHeader } from "./cells";
import { evaluateWorkbook, formulaMismatches } from "./formula-check";

describe("primitivas de celda", () => {
  it("nombra columnas y celdas como Excel", () => {
    expect([col(1), col(26), col(27), col(52)]).toEqual(["A", "Z", "AA", "AZ"]);
    expect(at(3, 5)).toBe("C5");
    expect(ref("Cotas ajustadas", "B4")).toBe("'Cotas ajustadas'!B4");
  });

  it("una fórmula lleva su resultado guardado y un dato su estilo", () => {
    const ws = new ExcelJS.Workbook().addWorksheet("H");
    putData(ws, 1, 1, 1.2345, "0.0000");
    putFormula(ws, 1, 2, "A1*2", 2.469, "0.0000");
    expect(ws.getCell("A2").formula).toBe("A1*2");
    expect(ws.getCell("A2").result).toBe(2.469);
    expect(ws.getCell("A1").numFmt).toBe("0.0000");
  });

  it("roundHalfUp redondea los medios como Math.round, también los negativos", () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("H");
    const casos = [-2.45, -2.449999, 2.45, -0.05, 12.35];
    casos.forEach((x, i) => {
      putData(ws, 1, i + 1, x);
      putFormula(ws, 2, i + 1, roundHalfUp(`A${i + 1}`, 1), Math.round(x * 10) / 10);
    });
    expect(formulaMismatches(wb)).toEqual([]);
    const v = evaluateWorkbook(wb);
    expect(v.get("'H'!B1")).toBeCloseTo(-2.4, 12);
  });

  it("los bloques de tolerancias copian tolerances.ts", () => {
    const ws = new ExcelJS.Workbook().addWorksheet("H");
    const lev = writeLevelingTolerances(ws, 10, 2);
    const pol = writePolygonalTolerances(ws, 14, 2);
    for (const o of PRECISION_ORDERS) {
      expect(ws.getCell(lev[o]).value).toBe(LEVELING_TOLERANCE_K[o]);
      expect(ws.getCell(pol[o].angularK).value).toBe(ANGULAR_TOLERANCE_K[o]);
      expect(ws.getCell(pol[o].minPrecision).value).toBe(MIN_RELATIVE_PRECISION[o]);
    }
  });

  it("el encabezado de cada hoja dice cuándo se exportó y que lo generó TopoField (PRD § F)", () => {
    const ws = new ExcelJS.Workbook().addWorksheet("H");
    writeSheetHeader(ws, "Título", [["Proyecto", "Edificio"]]);
    const textos: string[] = [];
    ws.eachRow((row) => row.eachCell((c) => { if (typeof c.value === "string") textos.push(c.value); }));
    expect(textos).toContain("Exportado");
    expect(textos.some((t) => t.endsWith("· Generado por TopoField"))).toBe(true);
  });
});
