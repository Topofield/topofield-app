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
    precision_order: "tercer_orden",
    equipment_brand: null,
    equipment_model: null,
    equipment_serial: null,
    equipment_calibration_date: null,
    angular_precision_seconds: null,
    distance_precision_mm: null,
    distance_precision_ppm: null,
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
  });

  // El agujero que abrió la Fase 8: `reports` solo guarda ids y la impresión
  // leía `project.*` en vivo, así que reeditar el equipo del proyecto
  // reescribía el Excel de un proceso ya cerrado e inmutable. El orden y el
  // equipo viven ahora en el PROCESO, no en el proyecto — el libro debe
  // leerlos de ahí aunque el proyecto pasado no los tenga (ya no puede
  // tenerlos: `projects` perdió esas columnas).
  it("el resumen lleva el equipo y el orden del proceso, no los del proyecto", () => {
    const wb = buildPolygonalWorkbook(
      process({
        status: "closed",
        closed_at: "2026-08-26T00:00:00Z",
        closed_by: "user-1",
        precision_order: "primer_orden",
        equipment_brand: "Sokkia",
        equipment_model: "CX-52",
        equipment_serial: "SK-9",
        equipment_calibration_date: "2026-01-15",
        angular_precision_seconds: 2,
        distance_precision_mm: 3,
        distance_precision_ppm: 2,
      }),
      [station()],
      {
        name: "Lote catastral",
        client: "Cliente Demo",
        location: "Bogotá",
        datum: "MAGNA-SIRGAS",
        projection: "Origen Bogotá",
      },
    );
    const res = wb.getWorksheet("Resumen")!;
    const etiquetas = res.getColumn(1).values;
    const fila = (label: string) => etiquetas.findIndex((v) => v === label);

    expect(res.getCell(fila("Equipo"), 2).value).toBe("Sokkia CX-52 · s/n SK-9");
    expect(res.getCell(fila("Orden de precisión"), 2).value).toBe(
      "Primer orden",
    );
    expect(res.getCell(fila('Precisión angular (")'), 2).value).toBe(2);
    expect(
      res.getCell(fila("Precisión de distancia — término constante (mm)"), 2)
        .value,
    ).toBe(3);
    expect(
      res.getCell(
        fila("Precisión de distancia — término proporcional (ppm)"),
        2,
      ).value,
    ).toBe(2);
  });

  // Un proceso sin equipo capturado deja la celda vacía: un guion ahí sería un
  // dato inventado, y un 0 se leería como una precisión real de cero.
  it("deja vacío el equipo si el proceso no lo capturó", () => {
    const wb = buildPolygonalWorkbook(process(), [station()]);
    const res = wb.getWorksheet("Resumen")!;
    const etiquetas = res.getColumn(1).values;
    const fila = etiquetas.findIndex((v) => v === "Equipo");
    // Sin esto el test no probaría nada: `findIndex` devuelve -1 si la
    // etiqueta no está, y `getCell(-1, 2).value` de ExcelJS devuelve null,
    // que es justo lo que se afirma abajo. Renombrar «Equipo» dejaría el
    // test en verde.
    expect(fila).toBeGreaterThan(0);
    expect(res.getCell(fila, 2).value).toBeNull();
  });

  // `formatDistancePrecision` devuelve "—" ante un par a medias, porque una
  // precisión de distancia con un solo término no es un dato usable. El libro
  // escribía los dos términos como filas independientes, así que el mismo
  // proceso se leía "—" en el informe y como un número suelto en el Excel.
  it("deja vacíos los dos términos de distancia si solo se capturó uno", () => {
    const wb = buildPolygonalWorkbook(
      process({ distance_precision_mm: 3, distance_precision_ppm: null }),
      [station()],
    );
    const res = wb.getWorksheet("Resumen")!;
    const etiquetas = res.getColumn(1).values;
    const fila = (label: string) => etiquetas.findIndex((v) => v === label);

    const filaMm = fila("Precisión de distancia — término constante (mm)");
    const filaPpm = fila("Precisión de distancia — término proporcional (ppm)");
    expect(filaMm).toBeGreaterThan(0);
    expect(filaPpm).toBeGreaterThan(0);
    expect(res.getCell(filaMm, 2).value).toBeNull();
    expect(res.getCell(filaPpm, 2).value).toBeNull();
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
describe("buildPolygonalWorkbook — mínimos cuadrados (Fase 14)", () => {
  const adjustment = {
    status: "adjusted" as const,
    angleCorrectionsSec: [0.757],
    distanceCorrectionsM: [-0.00393],
    adjustedDistances: [32.953],
    sigma0: 0.6981,
    conditions: 3,
    iterations: 3,
  };
  const ls = process({
    correction_method: "least_squares",
    ls_sigma_angle_seconds: "2.00",
    ls_sigma_distance_m: "0.0110",
    ls_distance_measurements: 2,
  });

  function summaryValue(wb: ReturnType<typeof buildPolygonalWorkbook>, label: string) {
    const s = wb.getWorksheet("Resumen")!;
    for (let r = 1; r <= s.rowCount; r++) {
      if (s.getCell(r, 1).value === label) return s.getCell(r, 2).value;
    }
    return undefined;
  }

  it("añade a «Cálculos» la corrección angular y la distancia ajustada", () => {
    const calc = buildPolygonalWorkbook(ls, [station()], null, adjustment).getWorksheet(
      "Cálculos",
    )!;
    expect(calc.getCell("K3").value).toBe("Corrección angular (″)");
    expect(calc.getCell("L3").value).toBe("Distancia ajustada (m)");
    expect(calc.getCell("K4").value).toBe(0.757);
    expect(calc.getCell("L4").value).toBe(32.953);
  });

  it("muestra en «Resumen» los pesos y σ₀", () => {
    const wb = buildPolygonalWorkbook(ls, [station()], null, adjustment);
    expect(summaryValue(wb, "σ angular (\")")).toBe(2);
    expect(summaryValue(wb, "σ de distancia (m)")).toBe(0.011);
    expect(summaryValue(wb, "Mediciones por distancia")).toBe(2);
    expect(summaryValue(wb, "σ₀")).toBe(0.698);
  });

  it("no añade nada con otro método", () => {
    const wb = buildPolygonalWorkbook(process(), [station()], null, adjustment);
    expect(wb.getWorksheet("Cálculos")!.getCell("K3").value).toBeNull();
    expect(summaryValue(wb, "σ₀")).toBeUndefined();
  });
});

describe("buildPolygonalWorkbook — georreferenciación (Fase 15)", () => {
  function summaryValue(wb: ReturnType<typeof buildPolygonalWorkbook>, label: string) {
    const s = wb.getWorksheet("Resumen")!;
    for (let r = 1; r <= s.rowCount; r++) {
      if (s.getCell(r, 1).value === label) return s.getCell(r, 2).value;
    }
    return undefined;
  }

  it("muestra en «Resumen» la última georreferenciación", () => {
    const wb = buildPolygonalWorkbook(
      process({
        georef_at: "2026-09-24T15:00:00Z",
        georef_point_a_code: "D1",
        georef_point_b_code: "D3",
        georef_rotation_deg: 35,
        georef_rotation_min: 0,
        georef_rotation_sec: "7.8",
        georef_scale_factor: "1.000000274",
      }),
      [station()],
    );
    expect(summaryValue(wb, "Puntos de control")).toBe("D1 y D3");
    expect(summaryValue(wb, "Rotación")).toBe("35° 0' 7.8\"");
    expect(summaryValue(wb, "Factor de escala")).toBe(1.000000274);
  });

  it("sin georreferenciar, no hay sección", () => {
    expect(summaryValue(buildPolygonalWorkbook(process(), [station()]), "Puntos de control")).toBeUndefined();
  });
});
