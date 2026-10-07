import { describe, expect, it } from "vitest";
import { CARTERA_VERJON, type LecturaCartera } from "@/lib/demo/carteras";
import type { LevelingProcess, LevelingReading } from "@/types/leveling";
import { computeLevelingDetected } from "@/lib/calculations/leveling";
import { draftWithImport, levelingDraftOf, levelingInputOf, levelingPayloadOf } from "./leveling-save";

const process = {
  id: "00000000-0000-4000-8000-000000000001",
  name: "El Verjón — ida y vuelta",
  type: "open",
  start_bm_code: "D1",
  start_bm_elevation: 3288.5,
  end_bm_code: null,
  end_bm_elevation: null,
  has_return_run: true,
  location: "El Verjón",
  responsible_name: "Andrea Rojas",
  responsible_role: "Topógrafa de campo",
  equipment_brand: null,
  equipment_model: null,
  equipment_serial: null,
  notes: null,
  updated_at: "2026-10-06T00:00:00Z",
} as unknown as LevelingProcess;

function rowsOf(run: "forward" | "return", cartera: LecturaCartera[]): LevelingReading[] {
  return cartera.map(
    (x, i) =>
      ({
        run_type: run,
        reading_order: i + 1,
        point_code: x.code,
        point_type: x.type,
        backsight: x.backsight,
        foresight: x.foresight,
        back_upper_m: null,
        back_lower_m: null,
        fore_upper_m: null,
        fore_lower_m: null,
        back_distance_m: x.backDistanceM,
        fore_distance_m: x.foreDistanceM,
      }) as unknown as LevelingReading,
  );
}

const asDraft = (x: LecturaCartera) => ({
  pointCode: x.code,
  pointType: x.type,
  backsight: x.backsight,
  foresight: x.foresight,
  backUpperM: null,
  backLowerM: null,
  foreUpperM: null,
  foreLowerM: null,
  backDistanceM: x.backDistanceM,
  foreDistanceM: x.foreDistanceM,
});

describe("leveling-save", () => {
  // Las filas llegan de la base sin orden garantizado: se ordenan por recorrido y reading_order.
  const stored = [...rowsOf("return", CARTERA_VERJON.vuelta), ...rowsOf("forward", CARTERA_VERJON.ida)].reverse();

  it("el borrador de El Verjón trae la libreta de la hoja, en orden", () => {
    const draft = levelingDraftOf(process, stored);
    expect(draft.forward).toEqual(CARTERA_VERJON.ida.map(asDraft));
    expect(draft.return).toEqual(CARTERA_VERJON.vuelta.map(asDraft));
    expect(draft.bm).toEqual({ startCode: "D1", startElevation: 3288.5, endCode: null, endElevation: null });
    expect(draft.details.location).toBe("El Verjón");
  });

  it("la carga lleva los datos del alta y no manda el orden: se detecta", () => {
    const payload = levelingPayloadOf(process.id, levelingDraftOf(process, stored));
    expect(payload.forward).toHaveLength(CARTERA_VERJON.ida.length);
    expect(payload.responsibleName).toBe("Andrea Rojas");
    expect(payload.responsibleRole).toBe("Topógrafa de campo");
    expect("precisionOrder" in payload).toBe(false);
  });

  it("la entrada del motor desde el borrador detecta segundo orden en El Verjón", () => {
    const { order } = computeLevelingDetected(levelingInputOf(levelingDraftOf(process, stored)));
    expect(order).toBe("segundo_orden");
  });

  it("una importación reemplaza la libreta, el tipo, la vuelta y el BM de partida", () => {
    const imported = {
      type: "closed" as const,
      startBm: { code: "C10", elevation: 2541.7545 },
      forward: [{ pointCode: "C10", pointType: "bm" as const, backsight: 1.649, foresight: null, backDistanceM: 48.843, foreDistanceM: null }],
      return: null,
    };
    const next = draftWithImport(levelingDraftOf(process, stored), imported);
    expect(next.details.type).toBe("closed");
    expect(next.details.hasReturnRun).toBe(false);
    expect(next.bm).toMatchObject({ startCode: "C10", startElevation: 2541.7545 });
    expect(next.forward).toHaveLength(1);
    expect(next.forward[0]).toMatchObject({ pointCode: "C10", backsight: 1.649, backUpperM: null });
    expect(next.return).toEqual([]);
  });
});
