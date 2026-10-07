import { describe, expect, it } from "vitest";
import { computeLeveling, computeLevelingDetected } from "@/lib/calculations/leveling";
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
  computeLevelingDetected({
    type: n.type,
    startElevation: n.startElevation,
    endElevation: n.endElevation ?? null,
    forward: n.forward.map(lectura),
    return: n.return ? n.return.map(lectura) : null,
  }).result;

describe("levelingProfile (Fase 36: miras, visuales y la contraparte)", () => {
  const verjon = nivelar(NIVELACION_VERJON);

  it("El Verjón, la ida: cada armada con su mira atrás, el nivel a la altura del instrumento y la mira adelante", () => {
    const p = levelingProfile(verjon, "forward")!;
    expect(p.lengthM).toBeCloseTo(384.3, 6);
    expect(p.active.armadas).toHaveLength(10);
    const a = p.active.armadas[0]!;
    expect(a.backX).toBeCloseTo(0, 9);
    expect(a.instrumentX).toBeCloseTo(31.5, 9);
    expect(a.foreX).toBeCloseTo(60, 9);
    expect(a.instrumentHeight).toBeCloseTo(3289.709, 6);
    expect(a.backElevation).toBeCloseTo(3288.5, 6);
    expect(a.foreElevation).toBeCloseTo(3289.441, 6);
    // La intermedia AUX1 cuelga del nivel de su armada.
    const aux = p.active.points.find((x) => x.code === "AUX1")!;
    expect(aux.x).toBeCloseTo(p.active.armadas[3]!.instrumentX, 9);
    expect(aux.elevation).toBeCloseTo(3299.627, 6);
  });

  it("con vuelta, la contraparte va en el sentido de la ida, escalada a su largo", () => {
    const p = levelingProfile(verjon, "forward")!;
    const back = p.other!.points;
    expect(back[0]).toMatchObject({ code: "D4" });
    expect(back[0]!.x).toBeCloseTo(384.3, 6);
    expect(back.at(-1)!.x).toBeCloseTo(0, 6);
    expect(p.other!.armadas).toHaveLength(10);
  });

  it("en la vuelta, el eje es su propio largo y D1 sigue a la izquierda", () => {
    const p = levelingProfile(verjon, "return")!;
    expect(p.lengthM).toBeCloseTo(397.6, 6);
    expect(p.active.points[0]!.x).toBeCloseTo(397.6, 6);
    expect(p.active.points.at(-1)!.x).toBeCloseTo(0, 6);
    expect(p.other!.points[0]!.x).toBeCloseTo(0, 6);
    expect(p.other!.points.at(-1)!.x).toBeCloseTo(397.6, 6);
  });

  it("el tramo 2, sin vuelta: sin contraparte", () => {
    const p = levelingProfile(nivelar(nivelacionTramo2()), "forward")!;
    expect(p.other).toBeNull();
    expect(p.lengthM).toBeCloseTo(1397.288, 3);
  });

  it("sin armadas no hay perfil", () => {
    const solo = computeLeveling({
      type: "closed",
      startElevation: 100,
      endElevation: null,
      order: "ordinario",
      forward: [lectura({ code: "BM", type: "bm" } as LecturaNivelacionDemo)],
      return: null,
    });
    expect(levelingProfile(solo, "forward")).toBeNull();
  });
});
