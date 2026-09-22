import { describe, expect, it } from "vitest";
import {
  buildLevelingWorkbook,
  type LevelingProcessRow,
  type LevelingReadingRow,
} from "./leveling-workbook";

function reading(over: Partial<LevelingReadingRow> = {}): LevelingReadingRow {
  return {
    run_type: "forward",
    reading_order: 1,
    point_code: "BM-1",
    point_type: "bm",
    backsight: "1.2345",
    foresight: null,
    distance_m: "30.000",
    distance_accumulated_km: "0.030",
    instrument_height: "101.2345",
    elevation_calculated: "100.0000",
    elevation_corrected: "100.0000",
    correction_applied: "0.0000",
    ...over,
  };
}

function process(over: Partial<LevelingProcessRow> = {}): LevelingProcessRow {
  return {
    name: "Circuito BM-1",
    type: "closed",
    status: "closed",
    start_bm_code: "BM-1",
    start_bm_elevation: "100.0000",
    end_bm_code: "BM-1",
    end_bm_elevation: "100.0000",
    has_return_run: false,
    total_distance_km: "1.200",
    closure_error_mm: "-8.0",
    tolerance_mm: "13.1",
    meets_tolerance: true,
    forward_error_mm: null,
    return_error_mm: null,
    discrepancy_mm: null,
    closed_at: "2026-08-12T00:00:00Z",
    closed_by: "user-1",
    notes: null,
    created_at: "2026-08-01T00:00:00Z",
    precision_order: "tercer_orden",
    equipment_brand: null,
    equipment_model: null,
    equipment_serial: null,
    equipment_calibration_date: null,
    level_type: null,
    km_precision_mm: null,
    ...over,
  };
}

describe("buildLevelingWorkbook", () => {
  it("crea las tres hojas del § 4.8", () => {
    const wb = buildLevelingWorkbook(process(), [reading()]);
    expect(wb.worksheets.map((w) => w.name)).toEqual([
      "Datos Crudos",
      "Cálculos",
      "Resumen",
    ]);
  });

  it("aplica 4 decimales a las cotas y a las lecturas", () => {
    const wb = buildLevelingWorkbook(process(), [reading()]);
    const raw = wb.getWorksheet("Datos Crudos")!;
    expect(raw.getCell("E4").numFmt).toBe("0.0000");
    expect(raw.getCell("E4").value).toBe(1.2345);
  });

  // Las etiquetas salen de los mapas del propio dominio, no de una copia local:
  // `pc` es «Punto de cambio», no el literal de la base.
  it("traduce los enums con las etiquetas del dominio", () => {
    const wb = buildLevelingWorkbook(process(), [
      reading({ point_type: "pc", run_type: "return" }),
    ]);
    const raw = wb.getWorksheet("Datos Crudos")!;
    expect(raw.getCell("A4").value).toBe("Vuelta");
    expect(raw.getCell("D4").value).toBe("Punto de cambio");
  });

  it("etiqueta el tipo de proceso «de enlace», que son tres y no dos", () => {
    const wb = buildLevelingWorkbook(process({ type: "link" }), [reading()]);
    const valores = wb
      .getWorksheet("Resumen")!
      .getColumn(2)
      .values.filter((v): v is string => typeof v === "string");
    expect(valores).toContain("De enlace");
  });

  it("pone la ida antes que la vuelta, y ordena dentro de cada recorrido", () => {
    const wb = buildLevelingWorkbook(process({ has_return_run: true }), [
      reading({ run_type: "return", reading_order: 1, point_code: "V-1" }),
      reading({ run_type: "forward", reading_order: 2, point_code: "F-2" }),
      reading({ run_type: "forward", reading_order: 1, point_code: "F-1" }),
    ]);
    const raw = wb.getWorksheet("Datos Crudos")!;
    expect([
      raw.getCell("C4").value,
      raw.getCell("C5").value,
      raw.getCell("C6").value,
    ]).toEqual(["F-1", "F-2", "V-1"]);
  });

  // Sin vuelta, los errores de ida/vuelta y la discrepancia no existen. Un 0
  // se leería como «no hubo discrepancia», que es una afirmación distinta.
  it("deja vacías las métricas de doble recorrido cuando no hay vuelta", () => {
    const wb = buildLevelingWorkbook(process({ has_return_run: false }), [
      reading(),
    ]);
    const res = wb.getWorksheet("Resumen")!;
    const fila = res
      .getColumn(1)
      .values.findIndex((v) => v === "Discrepancia ida/vuelta (mm)");
    // Mismo motivo que en `polygonal-workbook.test.ts`: con la etiqueta
    // ausente, `findIndex` da -1 y `getCell(-1, 2).value` da null, que es lo
    // que se afirma. Sin esta guarda el test pasaría sin probar nada.
    expect(fila).toBeGreaterThan(0);
    expect(res.getCell(fila, 2).value).toBeNull();
  });

  it("distingue «sin evaluar» de «no cumple»", () => {
    const wb = buildLevelingWorkbook(process({ meets_tolerance: null }), [
      reading(),
    ]);
    const valores = wb
      .getWorksheet("Resumen")!
      .getColumn(2)
      .values.filter((v): v is string => typeof v === "string");
    expect(valores).toContain("Sin evaluar");
  });

  it("exporta un proceso sin lecturas sin romperse", () => {
    expect(buildLevelingWorkbook(process(), []).worksheets).toHaveLength(3);
  });

  // Mismo agujero que en poligonal (§ Fase 8): el orden y el equipo del nivel
  // viven en el PROCESO, no en el proyecto, para que reeditar el equipo del
  // proyecto no reescriba el Excel de una nivelación ya cerrada.
  it("el resumen lleva el equipo y el orden del proceso, no los del proyecto", () => {
    const wb = buildLevelingWorkbook(
      process({
        precision_order: "primer_orden",
        equipment_brand: "Leica",
        equipment_model: "NA2",
        equipment_serial: "LC-7",
        level_type: "automatico",
        km_precision_mm: "0.7",
      }),
      [reading()],
      { name: "Lote catastral", client: null, location: null, datum: null, projection: null },
    );
    const res = wb.getWorksheet("Resumen")!;
    const etiquetas = res.getColumn(1).values;
    const fila = (label: string) => etiquetas.findIndex((v) => v === label);

    expect(res.getCell(fila("Equipo"), 2).value).toBe("Leica NA2 · s/n LC-7");
    expect(res.getCell(fila("Orden de precisión"), 2).value).toBe(
      "Primer orden",
    );
    expect(res.getCell(fila("Tipo de nivel"), 2).value).toBe("Automático");
    expect(
      res.getCell(fila("Desviación típica (mm/km, doble nivelación)"), 2)
        .value,
    ).toBe(0.7);
  });
});
