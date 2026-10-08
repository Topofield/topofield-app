import type ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { evaluateWorkbook, formulaMismatches } from "./formula-check";
import { buildSettlementWorkbook } from "./settlement-workbook";
import { siteFixture } from "./settlement-workbook.fixtures";

/** La celda de un grupo de «Comparación»: la fila del punto y la columna del rótulo «Visita N» más `offset`. */
function celda(ws: ExcelJS.Worksheet, punto: string, visita: number, offset: number): ExcelJS.Cell {
  let fila = 0;
  let columna = 0;
  ws.eachRow((row, r) => {
    row.eachCell((c, k) => {
      if (c.value === `Visita ${visita}`) columna = k;
      if (k === 1 && c.value === punto) fila = r;
    });
  });
  return ws.getCell(fila, columna + offset);
}

describe("Excel de asentamientos — fórmulas contra el motor", () => {
  it.each(["alameda", "cartera", "salto"] as const)("%s: toda fórmula da el valor del motor", (caso) => {
    expect(formulaMismatches(buildSettlementWorkbook(siteFixture(caso)))).toEqual([]);
  });

  it("un punto que se salta una visita compara contra la última en que se midió", () => {
    const ws = buildSettlementWorkbook(siteFixture("salto")).getWorksheet("Comparación")!;
    const cota1 = celda(ws, "P-2", 1, 0).address;
    expect(celda(ws, "P-2", 2, 0).value).toBeNull();             // sin lectura en la visita 2
    expect(celda(ws, "P-2", 3, 2).formula).toContain(cota1);     // PARCIAL de la 3 contra la COTA de la 1
  });

  it("cambiar una lectura en la libreta recalcula su cota en la comparación", () => {
    const wb = buildSettlementWorkbook(siteFixture("salto"));
    const comp = wb.getWorksheet("Comparación")!;
    const cota = celda(comp, "P-1", 3, 0);
    const origen = /'Libretas'!F(\d+)/.exec(cota.formula)![1]!;
    const lib = wb.getWorksheet("Libretas")!;
    const lectura = lib.getCell(Number(origen), 5).value as number;   // VI
    const antes = evaluateWorkbook(wb).get(`'Comparación'!${cota.address}`) as number;
    const despues = evaluateWorkbook(wb, { [`'Libretas'!E${origen}`]: lectura + 0.002 }).get(`'Comparación'!${cota.address}`) as number;
    expect(despues).toBeCloseTo(antes - 0.002, 9);
  });

  it("las hojas: libretas, comparación y resumen", () => {
    expect(buildSettlementWorkbook(siteFixture("cartera")).worksheets.map((w) => w.name)).toEqual([
      "Libretas", "Comparación", "Resumen",
    ]);
  });
});
