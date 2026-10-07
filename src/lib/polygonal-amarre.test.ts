// Fase 35, decisión 9: los puntos del amarre van al catálogo del proyecto. Desde
// las correcciones de la Fase 35, el popup también corrige sus coordenadas.
import { describe, expect, it } from "vitest";
import { catalogMoves, catalogPointOf, repeatedPointName, resolveCatalogPoint } from "./polygonal-amarre";

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

  it("el mismo código con otras coordenadas mueve el punto: el popup las corrige", () => {
    expect(resolveCatalogPoint(catalog, { code: "TT4", north: 100142.9, east: 101436.5 })).toEqual({
      kind: "move",
      id: "a",
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

describe("catalogMoves", () => {
  const others = [
    { name: "Poligonal V10", startCode: "TT4", endCode: null, referencePointId: null },
    { name: "Poligonal Vivero", startCode: "D1", endCode: null, referencePointId: "a" },
    { name: "Abierta al D3", startCode: "D1", endCode: "TT4", referencePointId: null },
    { name: "Otra", startCode: "P1", endCode: null, referencePointId: "b" },
  ];

  it("lista los puntos del catálogo que cambian de coordenadas, con las anteriores", () => {
    expect(
      catalogMoves(catalog, [{ code: "TT4", north: 100142.9, east: 101436.5 }], []),
    ).toEqual([{ code: "TT4", north: 100142.809, east: 101436.5, usedBy: [] }]);
  });

  it("y las otras poligonales que lo usan de partida, de referencia o de llegada", () => {
    expect(
      catalogMoves(catalog, [{ code: "TT4", north: 100142.9, east: 101436.5 }], others)[0]!.usedBy,
    ).toEqual(["Poligonal V10", "Poligonal Vivero", "Abierta al D3"]);
  });

  it("no cuenta los que se reutilizan, se completan o se crean", () => {
    expect(
      catalogMoves(
        catalog,
        [
          { code: "TT4", north: 100142.8094, east: 101436.5 },
          { code: "V10", north: 5, east: 6 },
          { code: "D9", north: 1, east: 2 },
        ],
        others,
      ),
    ).toEqual([]);
  });
});

describe("repeatedPointName", () => {
  it("el mismo nombre con otras coordenadas se repite", () => {
    expect(
      repeatedPointName([
        { code: "E1", north: 1000, east: 1000 },
        { code: "R1", north: 1100, east: 1000 },
        { code: "E1", north: 1000.5, east: 1000 },
      ]),
    ).toBe("E1");
  });

  it("dentro del medio milímetro es el mismo punto, como en el catálogo", () => {
    expect(
      repeatedPointName([
        { code: "TT4", north: 100142.809, east: 101436.5 },
        { code: "TT4", north: 100142.8093, east: 101436.5 },
      ]),
    ).toBeNull();
  });

  it("nombres distintos no se repiten", () => {
    expect(
      repeatedPointName([
        { code: "E1", north: 1, east: 1 },
        { code: "E2", north: 1, east: 1 },
      ]),
    ).toBeNull();
  });
});

describe("catalogPointOf", () => {
  it("las coordenadas de la base, que llegan como texto o nulas, pasan a número o null", () => {
    expect(catalogPointOf({ id: "a", code: "TT4", north: "100142.8090", east: null })).toEqual({
      id: "a",
      code: "TT4",
      north: 100142.809,
      east: null,
    });
  });
});
