import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { EMPTY_LEVEL, EMPTY_TOTAL_STATION } from "@/types/project";
import type { Equipment } from "@/types/equipment";

// La acción del catálogo no se ejecuta al renderizar; se sustituye para no
// cargar el cliente de Supabase del servidor.
vi.mock("@/app/(app)/equipos/actions", () => ({ createEquipmentAction: vi.fn() }));

const { EquipmentCatalogProvider } = await import("./catalog-context");
const { LevelEquipment, TotalStationEquipment } = await import("./equipment-picker");

// Fase 25: los formularios de equipo ofrecen el catálogo del tipo, avisan de
// una calibración de más de un año y no duplican lo que ya está guardado.

const leica: Equipment = {
  id: "e1",
  user_id: "u1",
  kind: "total_station",
  brand: "Leica",
  model: "TS06 Plus",
  serial: "LCS-1",
  calibration_date: "2025-01-10",
  angular_precision_seconds: 5,
  distance_precision_mm: 1.5,
  distance_precision_ppm: 2,
  level_type: null,
  km_precision_mm: null,
  created_at: "",
  updated_at: "",
};
const dini: Equipment = {
  ...leica,
  id: "e2",
  kind: "level",
  brand: "Trimble",
  model: "DiNi 12",
  serial: null,
  angular_precision_seconds: null,
  distance_precision_mm: null,
  distance_precision_ppm: null,
  level_type: "digital",
  km_precision_mm: 0.3,
};

function render(element: ReturnType<typeof createElement>, equipment: Equipment[] = [leica, dini]) {
  return renderToStaticMarkup(
    createElement(EquipmentCatalogProvider, { equipment, today: "2026-09-30" }, element),
  );
}

describe("selector del catálogo en los formularios de equipo", () => {
  it("solo ofrece los equipos de su tipo", () => {
    const html = render(createElement(TotalStationEquipment, { value: EMPTY_TOTAL_STATION, onChange: () => {} }));
    expect(html).toContain("Tomar del catálogo");
    expect(html).toContain("Leica TS06 Plus · s/n LCS-1");
    expect(html).not.toContain("DiNi 12");
  });

  it("sin equipos del tipo no hay selector, pero sí se puede guardar", () => {
    const html = render(createElement(LevelEquipment, { value: EMPTY_LEVEL, onChange: () => {} }), [leica]);
    expect(html).not.toContain("Tomar del catálogo");
    expect(html).toContain("Guardar en el catálogo");
  });

  it("lo que ya está en el catálogo no se duplica", () => {
    const html = render(
      createElement(TotalStationEquipment, {
        value: { ...EMPTY_TOTAL_STATION, equipmentBrand: "leica", equipmentModel: "TS06 PLUS", equipmentSerial: "lcs-1" },
        onChange: () => {},
      }),
    );
    expect(html).toContain("Ya está en el catálogo");
  });

  it("avisa de una calibración de más de un año, a hoy o a la fecha de la visita", () => {
    const value = { ...EMPTY_LEVEL, equipmentBrand: "Trimble", equipmentCalibrationDate: "2025-01-10" };
    expect(render(createElement(LevelEquipment, { value, onChange: () => {} }))).toContain(
      "Calibración de hace más de un año",
    );
    expect(
      render(createElement(LevelEquipment, { value, onChange: () => {}, referenceDate: "2025-06-01" })),
    ).not.toContain("Calibración de hace más de un año");
  });

  it("deshabilitado —un proceso cerrado— no ofrece ni guarda", () => {
    const html = render(
      createElement(TotalStationEquipment, { value: EMPTY_TOTAL_STATION, onChange: () => {}, disabled: true }),
    );
    expect(html).not.toContain("Tomar del catálogo");
    expect(html).not.toContain("Guardar en el catálogo");
  });
});
