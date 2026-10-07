import { describe, expect, it } from "vitest";
import { computeLevelingDetected } from "@/lib/calculations/leveling";
import { NIVELACION_VERJON, nivelacionTramo2, type LecturaNivelacionDemo, type NivelacionDemo } from "@/lib/demo/fixtures";
import type { ReadingInput } from "@/types/leveling";
import { levelingOrderChecks } from "./order-verdict";

const lectura = (r: LecturaNivelacionDemo): ReadingInput => ({
  pointCode: r.code,
  pointType: r.type,
  backsight: r.back ?? null,
  foresight: r.fore ?? null,
  backUpperM: null,
  backLowerM: null,
  foreUpperM: null,
  foreLowerM: null,
  backDistanceM: r.backDistanceM ?? null,
  foreDistanceM: r.foreDistanceM ?? null,
  distanceAccumulatedKm: null,
});

const nivelar = (n: NivelacionDemo, sinVuelta = false) =>
  computeLevelingDetected({
    type: n.type,
    startElevation: n.startElevation,
    endElevation: n.endElevation ?? null,
    forward: n.forward.map(lectura),
    return: n.return && !sinVuelta ? n.return.map(lectura) : null,
  }).result;

describe("levelingOrderChecks — el «Por qué» del orden", () => {
  it("El Verjón: la discrepancia de 5.0 mm frente a K·√D·√2 con D = 0.3843 km; alcanza segundo orden", () => {
    const checks = levelingOrderChecks(nivelar(NIVELACION_VERJON), "open");
    expect(checks.map((c) => c.k)).toEqual([3, 6, 12, 24]);
    expect(checks.map((c) => c.tolerancesMm[0]!.toFixed(1))).toEqual(["2.6", "5.3", "10.5", "21.0"]);
    expect(checks.map((c) => c.meets)).toEqual([false, true, true, true]);
    expect(checks.filter((c) => c.reached).map((c) => c.order)).toEqual(["segundo_orden"]);
  });

  it("el tramo 2: el cierre de −0.4 mm frente a K·√D; alcanza primer orden", () => {
    const checks = levelingOrderChecks(nivelar(nivelacionTramo2()), "closed");
    expect(checks.every((c) => c.meets)).toBe(true);
    expect(checks[0]).toMatchObject({ order: "primer_orden", reached: true });
    expect(checks[0]!.tolerancesMm[0]).toBeCloseTo(3 * Math.sqrt(1.397288), 6);
  });

  it("la abierta sin vuelta no tiene con qué juzgar", () => {
    expect(levelingOrderChecks(nivelar(NIVELACION_VERJON, true), "open")).toEqual([]);
  });
});
