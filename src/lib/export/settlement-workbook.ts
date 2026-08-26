// Libro de Excel de un lugar de control de asentamientos (§ 4.8).
//
// A diferencia de poligonal y nivelación, la unidad no es un proceso con una
// tabla de filas, sino un LUGAR con un catálogo de puntos y una serie de
// visitas en el tiempo. Las hojas se organizan en consecuencia: las lecturas
// crudas por visita y punto, los valores derivados con su alerta, y el resumen
// con los umbrales vigentes.

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
  ALERT_LEVEL_LABELS,
  type AlertLevel,
  type SettlementHistory,
} from "@/types/settlement";
import { STRUCTURE_TYPE_LABELS, type StructureType } from "@/types/site";
import type { Thresholds } from "@/types/settlement";

/**
 * Punto del catálogo tal como llega de la base.
 *
 * No se reutiliza `PointInput` porque ese tipo es la entrada del MOTOR de
 * cálculo y omite deliberadamente lo que el cálculo no necesita, como la
 * descripción de la ubicación — que el informe sí quiere mostrar.
 */
export interface PointRow {
  id: string;
  code: string;
  location_description: string | null;
  northing: number | string | null;
  easting: number | string | null;
  initial_elevation: number | string | null;
}

export interface SiteRow {
  name: string;
  description: string | null;
  structure_type: string;
  status: string;
  closed_at: string | null;
  closed_by: string | null;
  notes: string | null;
  created_at: string | null;
}

export interface VisitRow {
  id: string;
  visit_number: number;
  date: string;
  status: string;
  operator: string | null;
  equipment: string | null;
  weather_conditions: string | null;
}

function num(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/** Formatea la distorsión como `1/X`, con `1/∞` cuando no hay diferencial. */
function distortion(inverse: number): string {
  return Number.isFinite(inverse) ? `1/${Math.round(inverse)}` : "1/∞";
}

function sheetRawData(
  wb: ExcelJS.Workbook,
  site: SiteRow,
  points: PointRow[],
  visits: VisitRow[],
  history: SettlementHistory,
): void {
  const s = wb.addWorksheet("Datos Crudos");
  s.columns = [
    { width: 9 }, { width: 13 }, { width: 12 }, { width: 14 },
    { width: 13 }, { width: 13 }, { width: 13 },
  ];

  setSheetTitle(s, `${site.name} — catálogo y cotas medidas`);

  writeSection(s, 3, "Catálogo de puntos");
  setHeaders(s, 4, [
    "Código",
    "Ubicación",
    "Norte (m)",
    "Este (m)",
    "Cota C0 (m)",
  ]);
  points.forEach((p, i) => {
    writeRow(
      s,
      5 + i,
      [
        p.code,
        p.location_description,
        num(p.northing),
        num(p.easting),
        num(p.initial_elevation),
      ],
      [null, null, DECIMALS.coordinate, DECIMALS.coordinate, DECIMALS.elevation],
    );
  });

  let row = 5 + points.length + 1;
  writeSection(s, row, "Cotas medidas por visita");
  row += 1;
  setHeaders(s, row, [
    "Visita",
    "Fecha",
    "Estado",
    "Punto",
    "Cota (m)",
  ]);
  row += 1;

  const codeById = new Map(points.map((p) => [p.id, p.code]));
  for (const visit of visits) {
    const computed = history.visits.find((v) => v.visitId === visit.id);
    for (const reading of computed?.readings ?? []) {
      writeRow(
        s,
        row,
        [
          visit.visit_number,
          visit.date,
          visit.status === "closed" ? "Cerrada" : "Abierta",
          codeById.get(reading.pointId) ?? reading.pointId,
          reading.elevation,
        ],
        [null, null, null, null, DECIMALS.elevation],
      );
      row += 1;
    }
  }
}

function sheetCalculations(
  wb: ExcelJS.Workbook,
  site: SiteRow,
  points: PointRow[],
  visits: VisitRow[],
  history: SettlementHistory,
): void {
  const s = wb.addWorksheet("Cálculos");
  s.columns = [
    { width: 9 }, { width: 12 }, { width: 12 }, { width: 15 },
    { width: 17 }, { width: 15 }, { width: 13 },
  ];

  setSheetTitle(s, `${site.name} — asentamientos, velocidades y alertas`);
  setHeaders(s, 3, [
    "Visita",
    "Fecha",
    "Punto",
    "Parcial (mm)",
    "Acumulado (mm)",
    "Velocidad (mm/mes)",
    "Alerta",
  ]);

  const codeById = new Map(points.map((p) => [p.id, p.code]));
  const dateById = new Map(visits.map((v) => [v.id, v.date]));
  const numberById = new Map(visits.map((v) => [v.id, v.visit_number]));

  let row = 4;
  for (const visit of history.visits) {
    for (const reading of visit.readings) {
      writeRow(
        s,
        row,
        [
          numberById.get(visit.visitId) ?? visit.visitNumber,
          dateById.get(visit.visitId) ?? visit.date,
          codeById.get(reading.pointId) ?? reading.pointId,
          reading.partialSettlement,
          reading.accumulatedSettlement,
          reading.velocity,
          ALERT_LEVEL_LABELS[reading.alertStatus],
        ],
        [null, null, null, 1, 1, DECIMALS.mm, null],
      );
      row += 1;
    }
  }

  // Diferenciales de la última visita: es donde el § 6.10 los evalúa.
  row += 1;
  writeSection(s, row, "Asentamientos diferenciales (última visita)");
  row += 1;
  setHeaders(s, row, [
    "Punto A",
    "Punto B",
    "Diferencial (mm)",
    "Distancia (m)",
    "Distorsión",
    "¿Supera el límite?",
  ]);
  row += 1;

  for (const pair of history.differentials) {
    writeRow(
      s,
      row,
      [
        codeById.get(pair.pointIdA) ?? pair.pointIdA,
        codeById.get(pair.pointIdB) ?? pair.pointIdB,
        pair.differentialMm,
        pair.distanceM,
        distortion(pair.distortionInverse),
        pair.exceedsLimit ? "Sí" : "No",
      ],
      [null, null, 1, DECIMALS.coordinate, null, null],
    );
    row += 1;
  }
}

function sheetSummary(
  wb: ExcelJS.Workbook,
  site: SiteRow,
  points: PointRow[],
  visits: VisitRow[],
  history: SettlementHistory,
  thresholds: Thresholds,
): void {
  const s = wb.addWorksheet("Resumen");
  s.columns = [{ width: 34 }, { width: 34 }];

  setSheetTitle(s, `${site.name} — resumen`);

  const worst = history.visits[history.visits.length - 1]?.worstAlert ?? null;
  const acelerando = Object.values(history.trends).filter(
    (t) => t === "accelerating",
  ).length;

  writeSection(s, 3, "Lugar");
  let row = writePairs(s, 4, [
    ["Nombre", site.name],
    ["Descripción", site.description],
    [
      "Tipo de estructura",
      STRUCTURE_TYPE_LABELS[site.structure_type as StructureType] ??
        site.structure_type,
    ],
    ["Estado", site.status === "closed" ? "Cerrado" : "Activo"],
    ["Puntos del catálogo", points.length],
    ["Visitas registradas", visits.length],
  ]);

  row += 1;
  writeSection(s, row, "Umbrales vigentes");
  row = writePairs(s, row + 1, [
    ["Velocidad — precaución (mm/mes)", thresholds.velocityCaution],
    ["Velocidad — alerta (mm/mes)", thresholds.velocityAlert],
    ["Velocidad — alarma (mm/mes)", thresholds.velocityAlarm],
    ["Acumulado — precaución (mm)", thresholds.accumulatedCaution],
    ["Acumulado — alerta (mm)", thresholds.accumulatedAlert],
    ["Acumulado — alarma (mm)", thresholds.accumulatedAlarm],
    ["Límite de distorsión angular", `1/${thresholds.angularDistortionLimit}`],
  ]);

  row += 1;
  writeSection(s, row, "Estado del monitoreo");
  row = writePairs(s, row + 1, [
    [
      "Peor alerta (última visita)",
      worst ? ALERT_LEVEL_LABELS[worst as AlertLevel] : null,
    ],
    ["Puntos con tendencia creciente", acelerando],
    [
      "Pares que superan la distorsión",
      history.differentials.filter((d) => d.exceedsLimit).length,
    ],
  ]);

  row += 1;
  writeSection(s, row, "Trazabilidad");
  writePairs(s, row + 1, [
    ["Creado", site.created_at],
    ["Cerrado", site.closed_at],
    ["Cerrado por", site.closed_by],
    ["Notas", site.notes],
  ]);
}

/** Libro completo de un lugar de control de asentamientos. */
export function buildSettlementWorkbook(
  site: SiteRow,
  points: PointRow[],
  visits: VisitRow[],
  history: SettlementHistory,
  thresholds: Thresholds,
): ExcelJS.Workbook {
  const wb = newWorkbook();
  const ordered = [...visits].sort((a, b) => a.date.localeCompare(b.date));
  sheetRawData(wb, site, points, ordered, history);
  sheetCalculations(wb, site, points, ordered, history);
  sheetSummary(wb, site, points, ordered, history, thresholds);
  return wb;
}
