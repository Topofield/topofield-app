import { describe, expect, it } from "vitest";
import { computeLeveling } from "@/lib/calculations/leveling";
import { NIVELACION_VERJON, nivelacionTramo2, type LecturaNivelacionDemo, type NivelacionDemo } from "@/lib/demo/fixtures";
import type { ReadingInput } from "@/types/leveling";
import { levelingProfile } from "./profile-data";

// Fase 22: el perfil de la nivelación con las carteras reales de la demo.

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

const nivelar = (n: NivelacionDemo) =>
  computeLeveling({
    type: n.type,
    startElevation: n.startElevation,
    endElevation: n.endElevation ?? null,
    order: n.precisionOrder,
    forward: n.forward.map(lectura),
    return: n.return ? n.return.map(lectura) : null,
  });

describe("levelingProfile", () => {
  it("el tramo 2: la ida va de 0 a 1397 m, arranca y termina en C10, sin vuelta", () => {
    const p = levelingProfile(nivelar(nivelacionTramo2()));
    expect(p.back).toBeNull();
    expect(p.totalM).toBeCloseTo(1397.288, 3);
    expect(p.forward[0]).toMatchObject({ code: "C10", distanceM: 0, elevation: 2541.7545 });
    const ultimo = p.forward[p.forward.length - 1]!;
    expect(ultimo.code).toBe("C10");
    expect(ultimo.distanceM).toBeCloseTo(1397.288, 3);
    // Cerrada y compensada: vuelve a su cota.
    expect(ultimo.elevation).toBeCloseTo(2541.7545, 4);
  });

  it("El Verjón: la vuelta arranca al final de la ida y llega al origen", () => {
    const p = levelingProfile(nivelar(NIVELACION_VERJON));
    expect(p.back).not.toBeNull();
    const back = p.back!;
    expect(back[0]!.distanceM).toBeCloseTo(p.totalM, 6);
    expect(back[back.length - 1]!.distanceM).toBeCloseTo(0, 6);
    // Las distancias de la vuelta decrecen: recorre el camino al revés.
    for (let i = 1; i < back.length; i++) {
      expect(back[i]!.distanceM).toBeLessThanOrEqual(back[i - 1]!.distanceM + 1e-9);
    }
  });
});
