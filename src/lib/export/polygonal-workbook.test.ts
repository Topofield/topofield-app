import { describe, expect, it } from "vitest";
import {
  buildPolygonalWorkbook,
  type PolygonalProcessRow,
  type StationRow,
} from "./polygonal-workbook";
import { safeFilename } from "./workbook";

function station(over: Partial<StationRow> = {}): StationRow {
  return {
    station_order: 1,
    point_code: "E-1",
    angle_deg: 90,
    angle_min: 0,
    angle_sec: 0,
    deflection_direction: null,
    horizontal_distance: "100.000",
    corrected_angle_deg: 90,
    corrected_angle_min: 0,
    corrected_angle_sec: 12,
    azimuth_deg: 45,
    azimuth_min: 30,
    azimuth_sec: 0,
    delta_north: "70.711",
    delta_east: "70.711",
    corrected_delta_north: "70.710",
    corrected_delta_east: "70.712",
    north: "1070.710",
    east: "1070.712",
    ...over,
  };
}

function process(over: Partial<PolygonalProcessRow> = {}): PolygonalProcessRow {
  return {
    name: "Cuadrado de prueba",
    type: "closed",
    status: "calculated",
    correction_method: "bowditch",
    start_point_code: "E-1",
    start_north: "1000.000",
    start_east: "1000.000",
    end_point_code: null,
    angular_error_seconds: "12",
    linear_error: "0.400",
    perimeter: "400.000",
    relative_precision: "1:1001",
    meets_tolerance: false,
    closed_at: null,
    closed_by: null,
    notes: null,
    created_at: "2026-08-26T00:00:00Z",
    ...over,
  };
}

describe("buildPolygonalWorkbook", () => {
  it("crea las tres hojas que pide el § 4.8, en orden", () => {
    const wb = buildPolygonalWorkbook(process(), [station()]);
    expect(wb.worksheets.map((w) => w.name)).toEqual([
      "Datos Crudos",
      "Cálculos",
      "Resumen",
    ]);
  });

  // Un DECIMAL de Postgres llega como cadena. Si se escribiera tal cual, Excel
  // guardaría texto y la celda no podría sumarse ni promediarse — lo primero
  // que alguien hace en una hoja de cálculo.
  it("escribe los números como número, no como texto", () => {
    const wb = buildPolygonalWorkbook(process(), [station()]);
    const calc = wb.getWorksheet("Cálculos")!;
    expect(typeof calc.getCell("I4").value).toBe("number");
    expect(calc.getCell("I4").value).toBe(1070.71);
    expect(calc.getCell("I4").numFmt).toBe("0.000");
  });

  it("aplica 3 decimales a coordenadas y distancias", () => {
    const wb = buildPolygonalWorkbook(process(), [station()]);
    expect(wb.getWorksheet("Datos Crudos")!.getCell("F4").numFmt).toBe("0.000");
  });

  it("compone el ángulo y el azimut en DMS, no en decimal", () => {
    const wb = buildPolygonalWorkbook(process(), [station()]);
    const calc = wb.getWorksheet("Cálculos")!;
    expect(calc.getCell("C4").value).toBe("90° 0' 12\"");
    expect(calc.getCell("D4").value).toBe("45° 30' 0\"");
  });

  // Un borrador se exporta igual (§ 4.8: «cualquier estado»), y sus celdas sin
  // calcular quedan VACÍAS. Escribir 0 sería inventar un dato: en topografía
  // un 0.000 de coordenada es una posición, no una ausencia.
  it("deja vacías las celdas sin calcular de un borrador", () => {
    const wb = buildPolygonalWorkbook(
      process({ status: "draft", relative_precision: null }),
      [
        station({
          corrected_angle_deg: null,
          corrected_angle_min: null,
          corrected_angle_sec: null,
          north: null,
          east: null,
        }),
      ],
    );
    const calc = wb.getWorksheet("Cálculos")!;
    expect(calc.getCell("C4").value).toBeNull();
    expect(calc.getCell("I4").value).toBeNull();
  });

  it("ordena las estaciones por station_order aunque lleguen desordenadas", () => {
    const wb = buildPolygonalWorkbook(process(), [
      station({ station_order: 3, point_code: "E-3" }),
      station({ station_order: 1, point_code: "E-1" }),
      station({ station_order: 2, point_code: "E-2" }),
    ]);
    const raw = wb.getWorksheet("Datos Crudos")!;
    expect([
      raw.getCell("B4").value,
      raw.getCell("B5").value,
      raw.getCell("B6").value,
    ]).toEqual(["E-1", "E-2", "E-3"]);
  });

  // La columna de deflexión solo tiene sentido en la abierta con control; en
  // los otros dos tipos sería una columna siempre vacía.
  it("incluye la columna de deflexión solo en la abierta con control", () => {
    const conControl = buildPolygonalWorkbook(
      process({ type: "open_controlled" }),
      [station({ deflection_direction: "right" })],
    );
    expect(conControl.getWorksheet("Datos Crudos")!.getCell("F3").value).toBe(
      "Deflexión",
    );
    expect(conControl.getWorksheet("Datos Crudos")!.getCell("F4").value).toBe(
      "Derecha",
    );

    const cerrada = buildPolygonalWorkbook(process({ type: "closed" }), [
      station(),
    ]);
    expect(cerrada.getWorksheet("Datos Crudos")!.getCell("F3").value).toBe(
      "Distancia (m)",
    );
  });

  // El libro no debe introducir una tercera representación de la precisión:
  // usa el mismo formateador que el listado y el editor.
  it("formatea la precisión como el resto de la aplicación", () => {
    const wb = buildPolygonalWorkbook(
      process({ relative_precision: "1:1001" }),
      [station()],
    );
    const resumen = wb.getWorksheet("Resumen")!;
    const valores = resumen
      .getColumn(2)
      .values.filter((v): v is string => typeof v === "string");
    expect(valores).toContain("1:1.001");
  });

  it("distingue «sin evaluar» de «no cumple» en la tolerancia", () => {
    const sinEvaluar = buildPolygonalWorkbook(
      process({ meets_tolerance: null }),
      [station()],
    );
    const valores = sinEvaluar
      .getWorksheet("Resumen")!
      .getColumn(2)
      .values.filter((v): v is string => typeof v === "string");
    expect(valores).toContain("Sin evaluar");
    expect(valores).not.toContain("No");
  });

  it("exporta un proceso sin estaciones sin romperse", () => {
    const wb = buildPolygonalWorkbook(process(), []);
    expect(wb.worksheets).toHaveLength(3);
  });

  // Un .xlsx viaja suelto: se adjunta a un correo y se abre meses después,
  // fuera de la aplicación. Sin datum, «N=1000.000» no identifica el sistema
  // de referencia y las coordenadas son ambiguas.
  it("incluye los metadatos geodésicos del proyecto en el resumen", () => {
    const wb = buildPolygonalWorkbook(process(), [station()], {
      name: "Lote catastral",
      client: "Cliente Demo",
      location: "Bogotá",
      datum: "MAGNA-SIRGAS",
      projection: "Origen Bogotá",
      precision_order: "tercer_orden",
      equipment_brand: "Leica",
      equipment_model: "TS06 Plus",
      equipment_serial: "LCS-2026-001",
    });
    const res = wb.getWorksheet("Resumen")!;
    const etiquetas = res
      .getColumn(1)
      .values.filter((v): v is string => typeof v === "string");
    const valores = res
      .getColumn(2)
      .values.filter((v): v is string => typeof v === "string");

    expect(etiquetas).toContain("Datum");
    expect(etiquetas).toContain("Proyección");
    expect(valores).toContain("MAGNA-SIRGAS");
    expect(valores).toContain("Tercer orden");
    expect(valores).toContain("Leica TS06 Plus · s/n LCS-2026-001");
  });

  // Sin proyecto el libro sigue siendo válido: la sección simplemente no sale.
  it("omite la sección de proyecto si no se pasa", () => {
    const wb = buildPolygonalWorkbook(process(), [station()]);
    const etiquetas = wb
      .getWorksheet("Resumen")!
      .getColumn(1)
      .values.filter((v): v is string => typeof v === "string");
    expect(etiquetas).not.toContain("Datum");
    expect(etiquetas).toContain("Nombre");
  });
});

describe("safeFilename", () => {
  it("transcribe acentos y espacios", () => {
    expect(safeFilename("Pentágono — Caso 1", "poligonal")).toBe(
      "Pentagono-Caso-1-poligonal.xlsx",
    );
  });

  it("no deja comillas ni caracteres que rompan Content-Disposition", () => {
    expect(safeFilename('Proceso "raro"/con\\barras', "poligonal")).toBe(
      "Proceso-raro-con-barras-poligonal.xlsx",
    );
  });

  it("cae a un nombre por defecto si no queda nada utilizable", () => {
    expect(safeFilename("///", "poligonal")).toBe("proceso-poligonal.xlsx");
  });
});