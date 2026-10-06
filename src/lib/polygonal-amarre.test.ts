// Fase 35, decisión 9: los puntos del amarre van al catálogo del proyecto, sin
// reescribir las coordenadas de un punto que ya usan otros procesos.
import { describe, expect, it } from "vitest";
import { resolveCatalogPoint } from "./polygonal-amarre";

const catalog = [
  { id: "a", code: "TT4", north: 100142.809, east: 101436.5 },
  { id: "b", code: "V10", north: null, east: null },
];

describe("resolveCatalogPoint", () => {
  it("el mismo código con las mismas coordenadas se reutiliza", () => {
    expect(resolveCatalogPoint(catalog, { code: "TT4", north: 100142.809, east: 101436.5 })).toEqual({
      kind: "reuse",
      id: "a",
    });
  });

  it("una diferencia de redondeo menor de medio milímetro también", () => {
    expect(resolveCatalogPoint(catalog, { code: "TT4", north: 100142.8094, east: 101436.5003 })).toEqual({
      kind: "reuse",
      id: "a",
    });
  });

  it("un código nuevo se crea", () => {
    expect(resolveCatalogPoint(catalog, { code: "D1", north: 1, east: 2 })).toEqual({ kind: "create" });
  });

  it("el mismo código con otras coordenadas es un conflicto, con el mensaje", () => {
    expect(resolveCatalogPoint(catalog, { code: "TT4", north: 100142.9, east: 101436.5 })).toEqual({
      kind: "conflict",
      message: "TT4 ya está en el catálogo con otras coordenadas: tómalo del catálogo o usa otro nombre.",
    });
  });

  it("un punto del catálogo sin coordenadas las recibe", () => {
    expect(resolveCatalogPoint(catalog, { code: "V10", north: 5, east: 6 })).toEqual({
      kind: "complete",
      id: "b",
    });
  });

  it("el código se compara sin espacios sobrantes", () => {
    expect(resolveCatalogPoint(catalog, { code: " TT4 ", north: 100142.809, east: 101436.5 })).toEqual({
      kind: "reuse",
      id: "a",
    });
  });
});
