import { describe, expect, it } from "vitest";
import { poligonalEjemplo } from "./poligonal-ejemplo";

describe("la poligonal del hero", () => {
  const p = poligonalEjemplo();

  it("sale del motor con el cierre de la cartera TT4", () => {
    expect(p).not.toBeNull();
    expect(Math.round(p!.errorAngular)).toBe(12);
    expect(Math.round(p!.precision)).toBe(7045);
    expect(p!.orden).toBe("tercer_orden");
    expect(p!.perimetro).toBeCloseTo(115.712, 3);
  });

  it("tiene los seis lados, de V10 a V10", () => {
    expect(p!.lados.map((l) => `${l.desde}→${l.hasta}`)).toEqual([
      "V10→D1",
      "D1→D2",
      "D2→D3",
      "D3→D4",
      "D4→D5",
      "D5→V10",
    ]);
    expect(p!.lados[0]!.distancia).toBe(20.744);
  });

  it("el dibujo de la ajustada cierra en el arranque", () => {
    const primero = p!.vertices[0]!;
    const ultimo = p!.vertices.at(-1)!;
    expect(p!.vertices).toHaveLength(7);
    expect(ultimo.north).toBeCloseTo(primero.north, 6);
    expect(ultimo.east).toBeCloseTo(primero.east, 6);
  });
});
