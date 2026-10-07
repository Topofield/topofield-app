import { describe, expect, it } from "vitest";
import { CARTERA_VERJON, type LecturaCartera } from "@/lib/demo/carteras";
import type { LevelingProcess, LevelingReading } from "@/types/leveling";
import { computeLevelingDetected } from "@/lib/calculations/leveling";
import {
  draftWithBm,
  draftWithImport,
  levelingDraftOf,
  levelingInputOf,
  levelingPayloadOf,
  returnStartCode,
  runRowsOf,
} from "./leveling-save";

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

  it("cambiar el código del BM renombra los extremos de la libreta que lo llevan", () => {
    const draft = levelingDraftOf(process, stored);
    const next = draftWithBm(draft, { startCode: "BM-1", startElevation: 3290, endCode: null, endElevation: null });
    expect(next.bm.startElevation).toBe(3290);
    expect(next.forward[0]!.pointCode).toBe("BM-1");
    // La vuelta de El Verjón llega a D1: su última fila también cambia.
    expect(next.return.at(-1)!.pointCode).toBe("BM-1");
    // D4, el fin de la ida y el comienzo de la vuelta, no es el BM: no cambia.
    expect(next.forward.at(-1)!.pointCode).toBe("D4");
    expect(next.return[0]!.pointCode).toBe("D4");
    expect(next.forward.slice(1)).toEqual(draft.forward.slice(1));
  });

  it("en la de enlace, el de llegada renombra el fin de la ida y el comienzo de la vuelta", () => {
    const draft = { ...levelingDraftOf(process, stored), bm: { startCode: "D1", startElevation: 3288.5, endCode: "D4", endElevation: 3315.0855 } };
    draft.details = { ...draft.details, type: "link" };
    const next = draftWithBm(draft, { ...draft.bm, endCode: "BM-2" });
    expect(next.forward.at(-1)!.pointCode).toBe("BM-2");
    expect(next.return[0]!.pointCode).toBe("BM-2");
    expect(next.forward[0]!.pointCode).toBe("D1");
  });

  it("la vuelta parte del BM de partida (cerrada), del de llegada (enlace) o del fin de la ida (abierta)", () => {
    const draft = levelingDraftOf(process, stored);
    expect(returnStartCode(draft)).toBe("D4");
    expect(returnStartCode({ ...draft, details: { ...draft.details, type: "closed" } })).toBe("D1");
    expect(
      returnStartCode({ ...draft, details: { ...draft.details, type: "link" }, bm: { ...draft.bm, endCode: "BM-2" } }),
    ).toBe("BM-2");
  });

  it("un recorrido vacío empieza en su punto de partida", () => {
    const draft = { ...levelingDraftOf(process, stored), return: [] };
    expect(runRowsOf(draft, "return")).toEqual([expect.objectContaining({ pointCode: "D4", pointType: "bm", backsight: null })]);
    expect(runRowsOf({ ...draft, forward: [] }, "forward")).toEqual([
      expect.objectContaining({ pointCode: "D1", pointType: "bm" }),
    ]);
    expect(runRowsOf(draft, "forward")).toBe(draft.forward);
  });
});
