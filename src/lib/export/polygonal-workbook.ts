// Libro de Excel de un proceso poligonal (§ 4.8).

import type ExcelJS from "exceljs";
import {
  DECIMALS,
  newWorkbook,
  setHeaders,
  setSheetTitle,
  writePairs,
  writeRow,
  writeSection,
} from "./workbook";
import {
  CORRECTION_METHOD_LABELS,
  POLYGONAL_TYPE_LABELS,
  PROCESS_STATUS_LABELS,
  type CorrectionMethod,
  type PolygonalType,
  type ProcessStatus,
} from "@/types/polygonal";
import { formatPrecision } from "@/lib/utils/format";

/** Fila de `polygonal_stations`, tal como llega de la base. */
export interface StationRow {
  station_order: number;
  point_code: string;
  angle_deg: number | null;
  angle_min: number | null;
  angle_sec: number | null;
  deflection_direction: string | null;
  horizontal_distance: number | string | null;
  corrected_angle_deg: number | null;
  corrected_angle_min: number | null;
  corrected_angle_sec: number | null;
  azimuth_deg: number | null;
  azimuth_min: number | null;
  azimuth_sec: number | null;
  delta_north: number | string | null;
  delta_east: number | string | null;
  corrected_delta_north: number | string | null;
  corrected_delta_east: number | string | null;
  north: number | string | null;
  east: number | string | null;
}

/** Cabecera de `polygonal_processes`, tal como llega de la base. */
export interface PolygonalProcessRow {
  name: string;
  type: PolygonalType;
  status: ProcessStatus;
  correction_method: CorrectionMethod | null;
  start_point_code: string;
  start_north: number | string | null;
  start_east: number | string | null;
  end_point_code: string | null;
  angular_error_seconds: number | string | null;
  linear_error: number | string | null;
  perimeter: number | string | null;
  relative_precision: string | null;
  meets_tolerance: boolean | null;
  closed_at: string | null;
  closed_by: string | null;
  notes: string | null;
  created_at: string | null;
}

/**
 * `DECIMAL` de Postgres llega como cadena vía PostgREST. Excel debe recibir un
 * número: una cadena se guarda como texto y deja la celda sin poder sumarse,
 * que es justo lo que un usuario espera hacer en una hoja de cálculo.
 */
function num(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/** «12° 34' 56"», o null si el ángulo está incompleto. */
function dms(
  deg: number | null,
  min: number | null,
  sec: number | null,
): string | null {
  if (deg === null || min === null || sec === null) return null;
  return `${deg}° ${min}' ${sec}"`;
}

function sheetRawData(
  wb: ExcelJS.Workbook,
  process: PolygonalProcessRow,
  stations: StationRow[],
): void {
  const s = wb.addWorksheet("Datos Crudos");
  s.columns = [
    { width: 8 }, { width: 14 }, { width: 8 }, { width: 8 }, { width: 8 },
    { width: 12 }, { width: 16 },
  ];

  setSheetTitle(s, `${process.name} — datos de campo sin modificar`);

  const showDeflection = process.type === "open_controlled";
  const headers = [
    "Orden",
    "Punto",
    "Áng. °",
    "Áng. '",
    'Áng. "',
    ...(showDeflection ? ["Deflexión"] : []),
    "Distancia (m)",
  ];
  setHeaders(s, 3, headers);

  stations.forEach((st, i) => {
    const values: (string | number | null)[] = [
      st.station_order,
      st.point_code,
      st.angle_deg,
      st.angle_min,
      st.angle_sec,
    ];
    if (showDeflection) {
      values.push(
        st.deflection_direction === "right"
          ? "Derecha"
          : st.deflection_direction === "left"
            ? "Izquierda"
            : null,
      );
    }
    values.push(num(st.horizontal_distance));

    const formats: (number | null)[] = [null, null, null, null, null];
    if (showDeflection) formats.push(null);
    formats.push(DECIMALS.coordinate);

    writeRow(s, 4 + i, values, formats);
  });
}

function sheetCalculations(
  wb: ExcelJS.Workbook,
  process: PolygonalProcessRow,
  stations: StationRow[],
): void {
  const s = wb.addWorksheet("Cálculos");
  s.columns = [
    { width: 8 }, { width: 14 }, { width: 16 }, { width: 16 },
    { width: 13 }, { width: 13 }, { width: 13 }, { width: 13 },
    { width: 14 }, { width: 14 },
  ];

  setSheetTitle(s, `${process.name} — cálculos y coordenadas`);

  setHeaders(s, 3, [
    "Orden",
    "Punto",
    "Ángulo corregido",
    "Azimut",
    "ΔN (m)",
    "ΔE (m)",
    "ΔN corr. (m)",
    "ΔE corr. (m)",
    "Norte (m)",
    "Este (m)",
  ]);

  const formats = [
    null, null, null, null,
    DECIMALS.coordinate, DECIMALS.coordinate,
    DECIMALS.coordinate, DECIMALS.coordinate,
    DECIMALS.coordinate, DECIMALS.coordinate,
  ];

  stations.forEach((st, i) => {
    writeRow(
      s,
      4 + i,
      [
        st.station_order,
        st.point_code,
        dms(st.corrected_angle_deg, st.corrected_angle_min, st.corrected_angle_sec),
        dms(st.azimuth_deg, st.azimuth_min, st.azimuth_sec),
        num(st.delta_north),
        num(st.delta_east),
        num(st.corrected_delta_north),
        num(st.corrected_delta_east),
        num(st.north),
        num(st.east),
      ],
      formats,
    );
  });

  const after = 4 + stations.length + 1;
  writeSection(s, after, "Punto de partida");
  writePairs(s, after + 1, [
    ["Código", process.start_point_code],
    ["Norte (m)", num(process.start_north)],
    ["Este (m)", num(process.start_east)],
  ]);
}

function sheetSummary(
  wb: ExcelJS.Workbook,
  process: PolygonalProcessRow,
  stations: StationRow[],
): void {
  const s = wb.addWorksheet("Resumen");
  s.columns = [{ width: 30 }, { width: 34 }];

  setSheetTitle(s, `${process.name} — resumen`);

  writeSection(s, 3, "Proceso");
  let row = writePairs(s, 4, [
    ["Nombre", process.name],
    ["Tipo", POLYGONAL_TYPE_LABELS[process.type]],
    ["Estado", PROCESS_STATUS_LABELS[process.status]],
    [
      "Método de corrección",
      process.correction_method
        ? CORRECTION_METHOD_LABELS[process.correction_method]
        : null,
    ],
    ["Estaciones", stations.length],
    ["Punto inicial", process.start_point_code],
    ["Punto final", process.end_point_code],
  ]);

  row += 1;
  writeSection(s, row, "Precisión");
  row = writePairs(s, row + 1, [
    ["Error angular (\")", num(process.angular_error_seconds)],
    ["Error lineal (m)", num(process.linear_error)],
    ["Perímetro (m)", num(process.perimeter)],
    // Se usa el formateador único del proyecto para que el libro no introduzca
    // una representación distinta de la que muestran el listado y el editor.
    ["Precisión relativa", formatPrecision(process.relative_precision)],
    [
      "¿Cumple tolerancia?",
      process.meets_tolerance === null
        ? "Sin evaluar"
        : process.meets_tolerance
          ? "Sí"
          : "No",
    ],
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

/** Libro completo de un proceso poligonal: tres hojas de la § 4.8. */
export function buildPolygonalWorkbook(
  process: PolygonalProcessRow,
  stations: StationRow[],
): ExcelJS.Workbook {
  const wb = newWorkbook();
  const ordered = [...stations].sort(
    (a, b) => a.station_order - b.station_order,
  );
  sheetRawData(wb, process, ordered);
  sheetCalculations(wb, process, ordered);
  sheetSummary(wb, process, ordered);
  return wb;
}
