// Fase 35, decisión 9: los puntos del amarre van al catálogo del proyecto. Desde
// las correcciones de la Fase 35, el popup también corrige sus coordenadas.
import { describe, expect, it } from "vitest";
import {
  catalogMoves,
  catalogPointOf,
  catalogPointsProblem,
  planCatalogWrites,
  repeatedPointName,
  resolveCatalogPoint,
} from "./polygonal-amarre";

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

// El guardado del amarre lleva sus puntos al catálogo en la misma transacción
// que el proceso: la acción decide qué escribir y la función de base lo escribe.
describe("planCatalogWrites", () => {
  const ids = () => {
    let n = 0;
    return () => `nuevo-${++n}`;
  };

  it("un punto nuevo se inserta con un id generado; uno igual se reutiliza sin escribir", () => {
    expect(
      planCatalogWrites(
        catalog,
        {
          start: { code: "TT4", north: 100142.809, east: 101436.5 },
          reference: { code: "D1", north: 100117.462, east: 101515.6333 },
          end: null,
        },
        ids(),
      ),
    ).toEqual({
      writes: [{ kind: "insert", id: "nuevo-1", code: "D1", north: 100117.462, east: 101515.6333 }],
      referenceId: "nuevo-1",
    });
  });

  it("uno con otras coordenadas, o sin ellas, se actualiza por su id", () => {
    expect(
      planCatalogWrites(
        catalog,
        {
          start: { code: "TT4", north: 100142.9, east: 101436.5 },
          reference: { code: "V10", north: 5, east: 6 },
          end: null,
        },
        ids(),
      ),
    ).toEqual({
      writes: [
        { kind: "update", id: "a", north: 100142.9, east: 101436.5 },
        { kind: "update", id: "b", north: 5, east: 6 },
      ],
      referenceId: "b",
    });
  });

  it("un punto nuevo que se repite —partida y llegada, el mismo sitio— se inserta una vez", () => {
    const plan = planCatalogWrites(
      [],
      { start: { code: "E1", north: 1, east: 2 }, reference: null, end: { code: "E1", north: 1, east: 2 } },
      ids(),
    );
    expect(plan.writes).toEqual([{ kind: "insert", id: "nuevo-1", code: "E1", north: 1, east: 2 }]);
    expect(plan.referenceId).toBeNull();
  });

  it("el id de cada punto nuevo sale de su papel: la referencia, el que propone el cliente", () => {
    const plan = planCatalogWrites(
      [],
      {
        start: { code: "E1", north: 1, east: 1 },
        reference: { code: "R1", north: 2, east: 1 },
        end: { code: "L1", north: 3, east: 1 },
      },
      (role) => (role === "reference" ? "propuesto" : `nuevo-${role}`),
    );
    expect(plan.writes.map((w) => w.id)).toEqual(["nuevo-start", "propuesto", "nuevo-end"]);
    expect(plan.referenceId).toBe("propuesto");
  });

  it("el código se guarda sin espacios sobrantes", () => {
    expect(
      planCatalogWrites([], { start: null, reference: { code: " R1 ", north: 1, east: 2 }, end: null }, ids())
        .writes,
    ).toEqual([{ kind: "insert", id: "nuevo-1", code: "R1", north: 1, east: 2 }]);
  });
});

describe("catalogPointsProblem", () => {
  const amarre = {
    startPointCode: "E1",
    startNorth: 1000,
    startEast: 1000,
    referencePointCode: "R1",
    endPointCode: "L1",
    endNorth: 2000,
    endEast: 2000,
  };
  const E1 = { code: "E1", north: 1000, east: 1000 };
  const R1 = { code: "R1", north: 1100, east: 1000 };
  const L1 = { code: "L1", north: 2000, east: 2000 };

  it("los puntos que coinciden con el amarre de la carga pasan", () => {
    expect(catalogPointsProblem(amarre, { start: E1, reference: R1, end: L1 })).toBeNull();
    expect(catalogPointsProblem(amarre, { start: null, reference: R1, end: null })).toBeNull();
  });

  it("una partida, una llegada o una referencia que no son las del amarre se rechazan", () => {
    const message = "Los puntos del amarre no coinciden con los del proceso.";
    expect(catalogPointsProblem(amarre, { start: { ...E1, north: 1 }, reference: null, end: null })).toBe(message);
    expect(catalogPointsProblem(amarre, { start: null, reference: null, end: { ...L1, code: "L2" } })).toBe(message);
    expect(catalogPointsProblem(amarre, { start: null, reference: { ...R1, code: "R2" }, end: null })).toBe(message);
  });

  it("el mismo nombre con otras coordenadas, también", () => {
    expect(
      catalogPointsProblem(
        { ...amarre, referencePointCode: "E1" },
        { start: E1, reference: { code: "E1", north: 1100, east: 1000 }, end: null },
      ),
    ).toBe("E1 está dos veces con coordenadas distintas: cada punto necesita su propio nombre.");
  });
});
