import { describe, expect, it } from "vitest";
import {
  appendVisitArmada, bookFromLibreta, dropBookRow, finishVisitArmada, pendingChangePoint, removeLastVisitArmada,
  visitArmadaAt, visitArmadaSpans, writeVisitArmada, type VisitArmada,
} from "./visit-armadas";
import type { BookRowPayload } from "@/types/settlement";
import type { PointType } from "@/types/leveling";

function r(pointCode: string, pointType: PointType, backsight: number | null, foresight: number | null, startsSection = false): BookRowPayload {
  return { pointCode, pointType, backsight, foresight, backUpperM: null, backLowerM: null,
    foreUpperM: null, foreLowerM: null, backDistanceM: null, foreDistanceM: null, startsSection };
}
const v = (reading: number | null) => ({ reading, distanceM: null, upperM: null, lowerM: null });
const alameda12 = [
  r("BM-1", "bm", 1.8637, null, true),
  r("TA-01", "intermediate", null, 1.2682),
  r("CP-1", "pc", 0.6263, 1.2152),
  r("TA-05", "intermediate", null, 0.8349),
  r("BM-1", "bm", null, 1.2764),
];
const BMS = [{ code: "BM-1" }, { code: "BM-2" }];

describe("las armadas de una visita", () => {
  it("dos armadas por un punto de cambio", () => {
    expect(visitArmadaSpans(alameda12)).toEqual([
      { opener: 0, intermediates: [1], closer: 2 },
      { opener: 2, intermediates: [3], closer: 4 },
    ]);
  });

  it("un tramo nuevo no cierra la armada anterior, que termina en sus puntos", () => {
    const rows = [r("BM-1", "bm", 1.5, null, true), r("TA-01", "intermediate", null, 1), r("BM-2", "bm", 1.2, null, true), r("TA-05", "intermediate", null, 1)];
    expect(visitArmadaSpans(rows)).toEqual([
      { opener: 0, intermediates: [1], closer: null },
      { opener: 2, intermediates: [3], closer: null },
    ]);
  });

  it("la plantilla sin lecturas ya muestra sus armadas", () => {
    const blank = alameda12.map((x) => ({ ...x, backsight: null, foresight: null }));
    expect(visitArmadaSpans(blank)).toHaveLength(2);
  });

  it("lee una armada", () => {
    expect(visitArmadaAt(alameda12, 1)).toEqual({
      from: "pc", backCode: "CP-1", back: v(0.6263),
      points: [{ pointCode: "TA-05", reading: 0.8349 }],
      fore: { pointCode: "BM-1", pointType: "bm", visual: v(1.2764) },
    });
  });

  it("escribe una armada sin tocar las otras", () => {
    const a = { ...visitArmadaAt(alameda12, 0), points: [{ pointCode: "TA-01", reading: 1.27 }, { pointCode: "TA-02", reading: 1.3 }] };
    const out = writeVisitArmada(alameda12, 0, a);
    expect("rows" in out && out.rows.map((x) => [x.pointCode, x.backsight, x.foresight])).toEqual([
      ["BM-1", 1.8637, null], ["TA-01", null, 1.27], ["TA-02", null, 1.3], ["CP-1", 0.6263, 1.2152], ["TA-05", null, 0.8349], ["BM-1", null, 1.2764],
    ]);
  });

  it("quitar la V− de una armada de la que sale otra es un error", () => {
    const out = writeVisitArmada(alameda12, 0, { ...visitArmadaAt(alameda12, 0), fore: null });
    expect(out).toEqual({ error: "La armada 2 sale de CP-1: quítala antes de quitar esta vista adelante." });
  });

  it("agrega una armada desde un BM del lugar: abre un tramo", () => {
    const a: VisitArmada = { from: "bm", backCode: "BM-2", back: v(1.2), points: [{ pointCode: "TA-09", reading: 1.1 }], fore: null };
    const out = appendVisitArmada(alameda12, a);
    expect("rows" in out && out.rows.slice(5).map((x) => [x.pointCode, x.pointType, x.backsight, x.foresight, x.startsSection])).toEqual([
      ["BM-2", "bm", 1.2, null, true], ["TA-09", "intermediate", null, 1.1, false],
    ]);
  });

  it("agrega una armada desde el punto de cambio: la V+ va en su fila", () => {
    const rows = alameda12.slice(0, 3).map((x, i) => (i === 2 ? { ...x, backsight: null } : x));
    expect(pendingChangePoint(rows, BMS)).toBe("CP-1");
    const out = appendVisitArmada(rows, { from: "pc", backCode: "CP-1", back: v(0.6263), points: [{ pointCode: "TA-05", reading: 0.8349 }], fore: { pointCode: "BM-1", pointType: "bm", visual: v(1.2764) } });
    expect("rows" in out && out.rows.map((x) => [x.pointCode, x.backsight, x.foresight])).toEqual([
      ["BM-1", 1.8637, null], ["TA-01", null, 1.2682], ["CP-1", 0.6263, 1.2152], ["TA-05", null, 0.8349], ["BM-1", null, 1.2764],
    ]);
  });

  it("tras cerrar en un BM no hay punto de cambio", () => {
    expect(pendingChangePoint(alameda12, BMS)).toBeNull();
  });

  it("«Terminar armada» quita sus puntos sin leer", () => {
    const rows = [r("BM-1", "bm", 1.5, null, true), r("TA-01", "intermediate", null, 1), r("TA-02", "intermediate", null, null)];
    expect(finishVisitArmada(rows, 0).map((x) => x.pointCode)).toEqual(["BM-1", "TA-01"]);
  });

  it("el punto repetido solo se quita si es una vista a un punto", () => {
    expect(dropBookRow(alameda12, 1)).toEqual({ rows: alameda12.filter((_, i) => i !== 1) });
    expect(dropBookRow(alameda12, 2)).toEqual({ error: "Esa lectura es parte de la cadena de armadas: no se puede quitar aquí." });
  });
});

describe("removeLastVisitArmada", () => {
  it("la que sale de un BM del lugar se va entera", () => {
    const rows = [...alameda12, r("BM-2", "bm", 1.1, null, true), r("TA-09", "intermediate", null, 1.3)];
    expect(removeLastVisitArmada(rows)).toEqual(alameda12);
  });

  it("la que sale de un punto de cambio deja el punto como V− de la anterior", () => {
    const rows = removeLastVisitArmada(alameda12);
    expect(rows).toEqual([alameda12[0], alameda12[1], { ...alameda12[2], backsight: null }]);
  });

  it("sin armadas, nada cambia", () => {
    expect(removeLastVisitArmada([])).toEqual([]);
  });
});

describe("bookFromLibreta (importar .L o CSV)", () => {
  it("es un tramo desde el BM de su primera fila", () => {
    const rows = bookFromLibreta([
      { pointCode: "PISCINA/BM", pointType: "pc", backsight: 1.45, foresight: null, backDistanceM: null, foreDistanceM: null },
      { pointCode: "B4", pointType: "intermediate", backsight: null, foresight: 4.058, backDistanceM: null, foreDistanceM: null },
    ]);
    expect(rows[0]).toMatchObject({ pointCode: "PISCINA/BM", pointType: "bm", startsSection: true, backsight: 1.45 });
    expect(rows[1]).toMatchObject({ pointCode: "B4", pointType: "intermediate", startsSection: false, foresight: 4.058 });
  });
});
