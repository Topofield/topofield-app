import { describe, expect, it } from "vitest";
import { CARTERA_VERJON } from "@/lib/demo/carteras";
import type { ReadingDraft } from "@/app/(app)/projects/[id]/leveling/[pid]/actions";
import { armadaAt, armadaSpans, emptyRow, removeLastArmada, startRun, writeArmada } from "./armadas";

const toDraft = (x: (typeof CARTERA_VERJON.ida)[number]): ReadingDraft => ({
  ...emptyRow(x.code, x.type),
  backsight: x.backsight,
  foresight: x.foresight,
  backDistanceM: x.backDistanceM,
  foreDistanceM: x.foreDistanceM,
});
const ida = CARTERA_VERJON.ida.map(toDraft);

describe("armadas", () => {
  it("la ida de El Verjón tiene 10 armadas; la 4 con la intermedia AUX1", () => {
    const spans = armadaSpans(ida);
    expect(spans).toHaveLength(10);
    expect(armadaAt(ida, 3).intermediates).toEqual([{ pointCode: "AUX1", reading: 0.194 }]);
  });

  it("la armada 2 es C 1 → C 2 con sus lecturas y distancias", () => {
    const a = armadaAt(ida, 1);
    expect(a.back).toEqual({ reading: 3.275, distanceM: 28.1, upperM: null, lowerM: null });
    expect(a.forePoint).toBe("C 2");
    expect(a.fore).toEqual({ reading: 0.224, distanceM: 17.3, upperM: null, lowerM: null });
  });

  it("capturar armada por armada reproduce la libreta de la hoja", () => {
    const rebuilt = armadaSpans(ida).reduce(
      (rows, _span, k) => writeArmada(rows, k, armadaAt(ida, k)),
      startRun("D1", "bm"),
    );
    expect(rebuilt).toEqual(ida);
  });

  it("editar una armada del medio solo cambia sus filas, y el punto de cambio conserva su V+", () => {
    const a = { ...armadaAt(ida, 1), fore: { reading: 0.25, distanceM: 18, upperM: null, lowerM: null } };
    const edited = writeArmada(ida, 1, a);
    expect(edited).toHaveLength(ida.length);
    expect(edited[2]!.foresight).toBe(0.25);
    expect(edited[2]!.backsight).toBe(3.469);
    expect(edited.filter((_r, i) => i !== 2)).toEqual(ida.filter((_r, i) => i !== 2));
  });

  it("una armada a medias al final se reconoce y se completa", () => {
    const half = removeLastArmada(ida).map((row, i, all) =>
      i === all.length - 1 ? { ...row, backsight: 2.349, backDistanceM: 12.1 } : row,
    );
    const spans = armadaSpans(half);
    expect(spans.at(-1)!.closer).toBeNull();
    const done = writeArmada(half, spans.length - 1, armadaAt(ida, 9));
    expect(done).toEqual(ida);
  });

  it("una intermedia colgada después del último punto no se pierde al editar otra armada", () => {
    const withTail = [...ida, { ...emptyRow("R1", "intermediate"), foresight: 1.5 }];
    expect(writeArmada(withTail, 0, armadaAt(withTail, 0))).toEqual(withTail);
  });

  it("quitar la última armada deja el punto anterior sin V+", () => {
    const less = removeLastArmada(ida);
    expect(less).toHaveLength(ida.length - 1);
    expect(less.at(-1)!.pointCode).toBe("C 8");
    expect(less.at(-1)!.backsight).toBeNull();
  });
});
