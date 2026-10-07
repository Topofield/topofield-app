import { describe, expect, it } from "vitest";
import { CARTERA_VERJON } from "@/lib/demo/carteras";
import { nivelacionTramo2 } from "@/lib/demo/fixtures";
import {
  adoptedElevationsOf,
  computeLeveling,
  computeLevelingDetected,
} from "./leveling";
import type { LevelingInput, PointType, ReadingInput } from "@/types/leveling";

function r(
  pointCode: string,
  pointType: PointType,
  backsight: number | null,
  foresight: number | null,
  backDistanceM: number | null,
  foreDistanceM: number | null,
): ReadingInput {
  return {
    pointCode,
    pointType,
    backsight,
    foresight,
    backUpperM: null,
    backLowerM: null,
    foreUpperM: null,
    foreLowerM: null,
    backDistanceM,
    foreDistanceM,
    distanceAccumulatedKm: null,
  };
}

const fromCartera = (rows: typeof CARTERA_VERJON.ida) =>
  rows.map((x) => r(x.code, x.type, x.backsight, x.foresight, x.backDistanceM, x.foreDistanceM));

const verjon: Omit<LevelingInput, "order" | "compensation"> = {
  type: "open",
  startElevation: CARTERA_VERJON.startElevation,
  endElevation: null,
  forward: fromCartera(CARTERA_VERJON.ida),
  return: fromCartera(CARTERA_VERJON.vuelta),
};

// Cerrada de 0.2 km que llega 100 mm arriba: no alcanza ni el ordinario (10.7 mm).
const fueraDeOrden: Omit<LevelingInput, "order" | "compensation"> = {
  type: "closed",
  startElevation: 100,
  endElevation: null,
  forward: [
    r("BM", "bm", 1.0, null, 50, null),
    r("P1", "pc", 1.0, 1.2, 50, 50),
    r("BM", "bm", null, 0.7, null, 50),
  ],
  return: null,
};

describe("computeLevelingDetected", () => {
  it("El Verjón alcanza segundo orden y da las cotas ajustadas del lienzo", () => {
    const { result, order, verifiable } = computeLevelingDetected(verjon);
    expect(verifiable).toBe(true);
    expect(order).toBe("segundo_orden");
    expect(result.discrepancyMm).toBeCloseTo(5.0, 6);
    expect(result.discrepancyToleranceMm).toBeCloseTo(5.26, 2);
    expect(result.compensated).toBe(true);
    const adopted = adoptedElevationsOf(result, verjon);
    const cota = (code: string) =>
      adopted!.find((a) => a.pointCode.replace(/\s/g, "") === code)!.elevation;
    expect(cota("D1")).toBeCloseTo(3288.5, 4);
    expect(cota("C1")).toBeCloseTo(3289.44, 4);
    expect(cota("C7")).toBeCloseTo(3309.0535, 4);
    expect(cota("D4")).toBeCloseTo(3315.0855, 4);
  });

  it("el tramo 2 cierra en −0.4 mm y alcanza primer orden", () => {
    const t = nivelacionTramo2();
    const input: Omit<LevelingInput, "order" | "compensation"> = {
      type: "closed",
      startElevation: t.startElevation,
      endElevation: null,
      forward: t.forward.map((x) =>
        r(x.code, x.type, x.back ?? null, x.fore ?? null, x.backDistanceM ?? null, x.foreDistanceM ?? null),
      ),
      return: null,
    };
    const { result, order } = computeLevelingDetected(input);
    expect(result.closureErrorMm).toBeCloseTo(-0.4, 6);
    expect(order).toBe("primer_orden");
  });

  it("fuera del ordinario no hay orden, pero se compensa igual", () => {
    const { result, order, verifiable } = computeLevelingDetected(fueraDeOrden);
    expect(verifiable).toBe(true);
    expect(order).toBeNull();
    expect(result.closureErrorMm).toBeCloseTo(100, 6);
    expect(result.compensated).toBe(true);
    expect(result.forward.readings[1]!.elevationCorrected).toBeCloseTo(99.75, 9);
    expect(result.forward.readings[2]!.elevationCorrected).toBeCloseTo(100, 9);
  });

  it("la abierta sin vuelta no tiene orden ni se compensa", () => {
    const { result, order, verifiable } = computeLevelingDetected({ ...verjon, return: null });
    expect(verifiable).toBe(false);
    expect(order).toBeNull();
    expect(result.compensated).toBe(false);
  });
});

describe("computeLeveling — la regla de la visita no cambia", () => {
  it("dentro de tolerancia (por omisión), fuera de ella no compensa", () => {
    const result = computeLeveling({ ...fueraDeOrden, order: "tercer_orden" });
    expect(result.compensated).toBe(false);
    expect(result.forward.readings[1]!.elevationCorrected).toBeCloseTo(99.8, 9);
  });
});

describe("la libreta a medias (Fase 36, captura por armada)", () => {
  it("El Verjón y el tramo 2 completos no quedan pendientes", () => {
    expect(computeLevelingDetected(verjon).pending).toBeNull();
    expect(computeLevelingDetected(fueraDeOrden).pending).toBeNull();
  });

  it("sin armadas, la libreta queda pendiente, también en una abierta sin vuelta", () => {
    const onlyBm = [r("D1", "bm", null, null, null, null)];
    expect(computeLevelingDetected({ ...verjon, forward: onlyBm, return: null }).pending).toBe("forward");
    expect(computeLevelingDetected({ ...fueraDeOrden, forward: onlyBm }).pending).toBe("forward");
  });

  it("una cerrada que aún no vuelve al BM queda pendiente: sin orden y sin compensar", () => {
    const partial = { ...fueraDeOrden, forward: fueraDeOrden.forward.slice(0, 2) };
    const { result, order, verifiable, pending } = computeLevelingDetected(partial);
    expect(pending).toBe("forward");
    expect(order).toBeNull();
    expect(verifiable).toBe(false);
    expect(result.compensated).toBe(false);
    expect(result.forward.readings[1]!.elevationCorrected).toBeCloseTo(99.8, 9);
  });

  it("la abierta con vuelta: la ida sin terminar, y después la vuelta, quedan pendientes", () => {
    const idaAMedias = verjon.forward.slice(0, 5);
    expect(computeLevelingDetected({ ...verjon, forward: idaAMedias, return: [] }).pending).toBe("forward");
    expect(computeLevelingDetected({ ...verjon, return: [] }).pending).toBe("return");
    const { pending, order, result } = computeLevelingDetected({ ...verjon, return: verjon.return!.slice(0, 6) });
    expect(pending).toBe("return");
    expect(order).toBeNull();
    expect(result.compensated).toBe(false);
  });

  it("la abierta sin vuelta no queda pendiente aunque no termine en un BM", () => {
    expect(computeLevelingDetected({ ...verjon, forward: verjon.forward.slice(0, 5), return: null }).pending).toBeNull();
  });

  it("una vuelta vieja que llega al BM de partida como punto de cambio no queda pendiente", () => {
    const back = verjon.return!.map((x, i, all) => (i === all.length - 1 ? { ...x, pointType: "pc" as const } : x));
    expect(computeLevelingDetected({ ...verjon, return: back }).pending).toBeNull();
  });
});

describe("computeLeveling — «never» no compensa", () => {
  it("ni dentro de tolerancia", () => {
    const t = computeLeveling({ ...verjon, order: "ordinario", compensation: "never" });
    expect(t.compensated).toBe(false);
    expect(t.forward.readings.every((x) => x.correctionApplied === 0)).toBe(true);
    expect(t.return!.readings.every((x) => x.correctionApplied === 0)).toBe(true);
  });
});
