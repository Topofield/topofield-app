import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { evaluateWorkbook, formulaMismatches } from "./formula-check";

function libro() {
  const wb = new ExcelJS.Workbook();
  const a = wb.addWorksheet("Datos");
  const b = wb.addWorksheet("Cotas ajustadas");
  a.getCell("A1").value = 1.5;
  a.getCell("A2").value = 2.25;
  a.getCell("A3").value = { formula: "A1+A2", result: 3.75 };
  a.getCell("A4").value = { formula: "MOD(A3*100,360)", result: 15 };
  a.getCell("A5").value = { formula: "SUMPRODUCT(A1:A2,A1:A2)", result: 7.3125 };
  a.getCell("A6").value = { formula: 'IF(A3>3,"CUMPLE","NO CUMPLE")', result: "CUMPLE" };
  a.getCell("A7").value = new Date(Date.UTC(2022, 2, 31));
  a.getCell("A8").value = new Date(Date.UTC(2022, 2, 24));
  a.getCell("A9").value = { formula: "DAYS(A7,A8)", result: 7 };
  a.getCell("B1").value = "AUX 1";
  a.getCell("B2").value = { formula: 'SUBSTITUTE(B1," ","")', result: "AUX1" };
  b.getCell("A1").value = { formula: "Datos!A3*2", result: 7.5 };
  b.getCell("A2").value = { formula: "'Cotas ajustadas'!A1+COS(RADIANS(60))", result: 8 };
  return wb;
}

describe("formula-check", () => {
  it("evalúa fórmulas encadenadas, de otra hoja, con texto y con fechas", () => {
    const values = evaluateWorkbook(libro());
    expect(values.get("'Datos'!A3")).toBeCloseTo(3.75, 12);
    expect(values.get("'Datos'!A6")).toBe("CUMPLE");
    expect(values.get("'Datos'!A9")).toBe(7);
    expect(values.get("'Datos'!B2")).toBe("AUX1");
    expect(values.get("'Cotas ajustadas'!A2")).toBeCloseTo(8, 12);
  });

  it("un libro coherente no tiene diferencias", () => {
    expect(formulaMismatches(libro())).toEqual([]);
  });

  it("señala la fórmula cuyo resultado guardado no es el que calcula", () => {
    const wb = libro();
    wb.getWorksheet("Datos")!.getCell("A3").value = { formula: "A1+A2", result: 4 };
    const diffs = formulaMismatches(wb);
    expect(diffs.map((d) => d.cell)).toContain("'Datos'!A3");
  });

  it("evalúa desde los datos crudos: cambiar un dato recalcula toda la cadena", () => {
    const values = evaluateWorkbook(libro(), { "'Datos'!A1": 10 });
    expect(values.get("'Datos'!A3")).toBeCloseTo(12.25, 12);
    expect(values.get("'Cotas ajustadas'!A1")).toBeCloseTo(24.5, 12);
  });
});
