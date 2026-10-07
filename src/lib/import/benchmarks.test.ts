import { describe, expect, it } from "vitest";
import { benchmarksFromLeveling, parseBenchmarkCsv } from "./benchmarks";

describe("importar BM", () => {
  it("de una nivelación: código y cota ajustada, con su origen", () => {
    expect(benchmarksFromLeveling([{ pointCode: "C14", elevation: 2542.2271 }], "Nivelación «Tramo 2», 7 oct 2026")).toEqual([
      { code: "C14", elevation: 2542.2271, description: null, source: "Nivelación «Tramo 2», 7 oct 2026" },
    ]);
  });
  it("de un CSV con coma decimal y punto y coma", () => {
    expect(parseBenchmarkCsv("codigo;cota;descripcion\nBM-1;100,0000;Andén norte\n\nBM-2;100,845;\n")).toEqual({
      items: [
        { code: "BM-1", elevation: 100, description: "Andén norte" },
        { code: "BM-2", elevation: 100.845, description: null },
      ],
    });
  });
  it("una cota que no es número dice su línea", () => {
    expect(parseBenchmarkCsv("codigo,cota\nBM-1,abc")).toEqual({ error: "Línea 2: la cota de BM-1 no es un número." });
  });
  it("un código repetido dice su línea", () => {
    expect(parseBenchmarkCsv("codigo,cota\nBM-1,100\nbm-1,101")).toEqual({ error: "Línea 3: BM-1 está repetido." });
  });
});
