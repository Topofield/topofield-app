// Libro de Excel de un proceso de nivelación (§ 4.8).

import type ExcelJS from "exceljs";
import {
  DECIMALS,
  newWorkbook,
  projectPairs,
  type ProjectMetadata,
  setHeaders,
  setSheetTitle,
  writePairs,
  writeRow,
  writeSection,
} from "./workbook";
import { PROCESS_STATUS_LABELS, type ProcessStatus } from "@/types/polygonal";
import { PRECISION_ORDER_LABELS, type PrecisionOrder } from "@/types/project";
import {
  LEVELING_TYPE_LABELS,
  POINT_TYPE_LABELS,
  RUN_TYPE_LABELS,
  type LevelingType,
  type PointType,
  type RunType,
} from "@/types/leveling";

/** Fila de `leveling_readings`, tal como llega de la base. */
export interface LevelingReadingRow {
  run_type: string;
  reading_order: number;
  point_code: string;
  point_type: string;
  backsight: number | string | null;
  foresight: number | string | null;
  distance_m: number | string | null;
  distance_accumulated_km: number | string | null;
  instrument_height: number | string | null;
  elevation_calculated: number | string | null;
  elevation_corrected: number | string | null;
  correction_applied: number | string | null;
}

/** Cabecera de `leveling_processes`. */
export interface LevelingProcessRow {
  name: string;
  type: string;
  status: ProcessStatus;
  start_bm_code: string;
  start_bm_elevation: number | string | null;
  end_bm_code: string | null;
  end_bm_elevation: number | string | null;
  has_return_run: boolean | null;
  total_distance_km: number | string | null;
  closure_error_mm: number | string | null;
  tolerance_mm: number | string | null;
  meets_tolerance: boolean | null;
  forward_error_mm: number | string | null;
  return_error_mm: number | string | null;
  discrepancy_mm: number | string | null;
  closed_at: string | null;
  closed_by: string | null;
  notes: string | null;
  created_at: string | null;
}

function num(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function sheetRawData(
  wb: ExcelJS.Workbook,
  process: LevelingProcessRow,
  readings: LevelingReadingRow[],
): void {
  const s = wb.addWorksheet("Datos Crudos");
  s.columns = [
    { width: 9 }, { width: 8 }, { width: 14 }, { width: 17 },
    { width: 13 }, { width: 13 }, { width: 13 },
  ];

  setSheetTitle(s, `${process.name} — lecturas de campo sin modificar`);
  setHeaders(s, 3, [
    "Recorrido",
    "Orden",
    "Punto",
    "Tipo",
    "Atrás (m)",
    "Adelante (m)",
    "Distancia (m)",
  ]);

  const formats = [
    null, null, null, null,
    DECIMALS.elevation, DECIMALS.elevation, DECIMALS.coordinate,
  ];

  readings.forEach((r, i) => {
    writeRow(
      s,
      4 + i,
      [
        RUN_TYPE_LABELS[r.run_type as RunType] ?? r.run_type,
        r.reading_order,
        r.point_code,
        POINT_TYPE_LABELS[r.point_type as PointType] ?? r.point_type,
        num(r.backsight),
        num(r.foresight),
        num(r.distance_m),
      ],
      formats,
    );
  });
}

function sheetCalculations(
  wb: ExcelJS.Workbook,
  process: LevelingProcessRow,
  readings: LevelingReadingRow[],
): void {
  const s = wb.addWorksheet("Cálculos");
  s.columns = [
    { width: 9 }, { width: 8 }, { width: 14 }, { width: 15 },
    { width: 16 }, { width: 15 }, { width: 17 }, { width: 18 },
  ];

  setSheetTitle(s, `${process.name} — cotas y compensación`);
  setHeaders(s, 3, [
    "Recorrido",
    "Orden",
    "Punto",
    "Alt. instr. (m)",
    "Cota calculada (m)",
    "Corrección (m)",
    "Cota corregida (m)",
    "Dist. acum. (km)",
  ]);

  const formats = [
    null, null, null,
    DECIMALS.elevation, DECIMALS.elevation, DECIMALS.elevation,
    DECIMALS.elevation, DECIMALS.coordinate,
  ];

  readings.forEach((r, i) => {
    writeRow(
      s,
      4 + i,
      [
        RUN_TYPE_LABELS[r.run_type as RunType] ?? r.run_type,
        r.reading_order,
        r.point_code,
        num(r.instrument_height),
        num(r.elevation_calculated),
        num(r.correction_applied),
        num(r.elevation_corrected),
        num(r.distance_accumulated_km),
      ],
      formats,
    );
  });

  const after = 4 + readings.length + 1;
  writeSection(s, after, "Puntos de control");
  writePairs(s, after + 1, [
    ["BM inicial", process.start_bm_code],
    ["Cota BM inicial (m)", num(process.start_bm_elevation)],
    ["BM final", process.end_bm_code],
    ["Cota BM final (m)", num(process.end_bm_elevation)],
  ]);
}

function sheetSummary(
  wb: ExcelJS.Workbook,
  process: LevelingProcessRow,
  readings: LevelingReadingRow[],
  project: ProjectMetadata | null,
): void {
  const s = wb.addWorksheet("Resumen");
  s.columns = [{ width: 32 }, { width: 34 }];

  setSheetTitle(s, `${process.name} — resumen`);

  let row0 = 3;
  const pares = projectPairs(
    project,
    project
      ? PRECISION_ORDER_LABELS[project.precision_order as PrecisionOrder] ??
        project.precision_order
      : "",
  );
  if (pares.length > 0) {
    writeSection(s, row0, "Proyecto");
    row0 = writePairs(s, row0 + 1, pares) + 1;
  }

  writeSection(s, row0, "Proceso");
  let row = writePairs(s, row0 + 1, [
    ["Nombre", process.name],
    ["Tipo", LEVELING_TYPE_LABELS[process.type as LevelingType] ?? process.type],
    ["Estado", PROCESS_STATUS_LABELS[process.status]],
    ["Lecturas", readings.length],
    ["¿Tiene vuelta?", process.has_return_run ? "Sí" : "No"],
    ["Distancia total (km)", num(process.total_distance_km)],
  ]);

  row += 1;
  writeSection(s, row, "Precisión");
  row = writePairs(s, row + 1, [
    ["Error de cierre (mm)", num(process.closure_error_mm)],
    ["Tolerancia (mm)", num(process.tolerance_mm)],
    [
      "¿Cumple tolerancia?",
      process.meets_tolerance === null
        ? "Sin evaluar"
        : process.meets_tolerance
          ? "Sí"
          : "No",
    ],
    // Solo tienen sentido con doble recorrido; sin vuelta quedan vacías en vez
    // de mostrar 0, que se leería como «no hubo discrepancia».
    ["Error de ida (mm)", num(process.forward_error_mm)],
    ["Error de vuelta (mm)", num(process.return_error_mm)],
    ["Discrepancia ida/vuelta (mm)", num(process.discrepancy_mm)],
  ]);

  row += 1;
  writeSection(s, row, "Trazabilidad");
  writePairs(s, row + 1, [
    ["Creado", process.created_at],
    ["Cerrado", process.closed_at],
    ["Cerrado por", process.closed_by],
    ["Notas", process.notes],
  ]);
}

/** Libro completo de un proceso de nivelación. */
export function buildLevelingWorkbook(
  process: LevelingProcessRow,
  readings: LevelingReadingRow[],
  project: ProjectMetadata | null = null,
): ExcelJS.Workbook {
  const wb = newWorkbook();
  // Ida antes que vuelta, y dentro de cada recorrido por orden de lectura.
  const ordered = [...readings].sort((a, b) => {
    if (a.run_type !== b.run_type) return a.run_type === "forward" ? -1 : 1;
    return a.reading_order - b.reading_order;
  });
  sheetRawData(wb, process, ordered);
  sheetCalculations(wb, process, ordered);
  sheetSummary(wb, process, ordered, project);
  return wb;
}
