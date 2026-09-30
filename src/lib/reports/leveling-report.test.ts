import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { LevelingReportSection } from "@/components/reports/sections/leveling-section";
import type { LevelingSectionData, ReportSection } from "./sections";
import { precisionSummaryRows } from "./summary";

// Fase 23: en una abierta con vuelta el informe muestra la discrepancia, que
// es su veredicto; en una cerrada, el cierre y además la discrepancia.

function nivelacion(over: Partial<LevelingSectionData["process"]>): LevelingSectionData {
  return {
    process: {
      id: "l1",
      project_id: "p1",
      name: "El Verjón",
      type: "open",
      status: "calculated",
      has_return_run: true,
      closure_error_mm: null,
      tolerance_mm: null,
      meets_tolerance: true,
      discrepancy_mm: 5,
      discrepancy_tolerance_mm: 10.5,
      meets_discrepancy: true,
      total_distance_km: 0.384,
      precision_order: "tercer_orden",
      equipment_brand: null,
      equipment_model: null,
      equipment_serial: null,
      level_type: "automatic",
      km_precision_mm: null,
      ...over,
    } as LevelingSectionData["process"],
    readings: [],
  };
}

const seccion = (data: LevelingSectionData): ReportSection => ({
  kind: "leveling",
  entry: { type: "leveling", id: data.process.id, name: data.process.name, order: 0 },
  data,
});

describe("informe de una nivelación con vuelta (Fase 23)", () => {
  it("abierta con vuelta: la discrepancia y su tolerancia, sin filas de cierre", () => {
    const html = renderToStaticMarkup(createElement(LevelingReportSection, { data: nivelacion({}) }));
    expect(html).toContain("Discrepancia ida y vuelta");
    expect(html).toContain("5.0 mm (tolerancia 10.5 mm)");
    expect(html).not.toContain("Error de cierre");
  });

  it("fuera de tolerancia lo dice", () => {
    const html = renderToStaticMarkup(
      createElement(LevelingReportSection, {
        data: nivelacion({ discrepancy_mm: 12, meets_discrepancy: false, meets_tolerance: false }),
      }),
    );
    expect(html).toContain("fuera de tolerancia");
  });

  it("cerrada con vuelta: el cierre y además la discrepancia", () => {
    const html = renderToStaticMarkup(
      createElement(LevelingReportSection, {
        data: nivelacion({ type: "closed", closure_error_mm: -0.4, tolerance_mm: 14.2 }),
      }),
    );
    expect(html).toContain("Error de cierre");
    expect(html).toContain("Discrepancia ida y vuelta");
  });

  it("en el resumen, la abierta con vuelta se juzga por la discrepancia", () => {
    const [fila] = precisionSummaryRows([seccion(nivelacion({}))]);
    expect(fila!.precision).toBe("Δ 5.0 mm (tol. 10.5)");
    expect(fila!.cumple).toBe(true);
  });

  it("en el resumen, la cerrada sigue con su cierre", () => {
    const [fila] = precisionSummaryRows([
      seccion(nivelacion({ type: "closed", closure_error_mm: -0.4, tolerance_mm: 14.2 })),
    ]);
    expect(fila!.precision).toBe("-0.4 mm (tol. 14.2)");
  });
});
