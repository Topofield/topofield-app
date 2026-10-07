// Libro de Excel de un lugar de control de asentamientos (§ 4.8).
//
// A diferencia de poligonal y nivelación, la unidad no es un proceso con una
// tabla de filas, sino un LUGAR con un catálogo de puntos y una serie de
// visitas en el tiempo. Las hojas se organizan en consecuencia: las lecturas
// crudas por visita y punto, los valores derivados con su alerta, el resumen
// con los umbrales vigentes y, desde la Fase 18, la libreta de nivelación de
// cada visita. Desde la Fase 37 nada se cierra y toda visita se mide con
// libreta, por tramos y sin compensar.

import type ExcelJS from "exceljs";
import { computeTrends } from "@/lib/calculations/settlement";
import {
  DECIMALS,
  equipmentLine,
  newWorkbook,
  projectPairs,
  type ProjectMetadata,
  setHeaders,
  setSheetTitle,
  writePairs,
  writeRow,
  writeSection,
} from "./workbook";
import {
  ALERT_LEVEL_LABELS,
  VISIT_STATUS_LABELS,
  type AlertLevel,
  type SettlementHistory,
  type VisitStatus,
} from "@/types/settlement";
import { POINT_TYPE_LABELS, type PointType } from "@/types/leveling";
import { STRUCTURE_TYPE_LABELS, type StructureType } from "@/types/site";
import {
  LEVEL_TYPE_LABELS,
  PRECISION_ORDER_LABELS,
  type LevelType,
  type PrecisionOrder,
} from "@/types/project";
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
  initial_elevation: number | string | null;
  /** Vigencia del punto (Fase 11): fecha de alta, de baja y motivo. */
  active_from: string | null;
  retired_on: string | null;
  retirement_reason: string | null;
}

export interface SiteRow {
  name: string;
  description: string | null;
  structure_type: string;
  notes: string | null;
  created_at: string | null;
}

export interface VisitRow {
  id: string;
  visit_number: number;
  date: string;
  status: string;
  operator: string | null;
  /** La nota de la visita (Fase 37, decisión 19). */
  notes: string | null;
  /**
   * El orden que alcanza su tramo peor; null si alguno no se verifica (Fase
   * 37, decisión 15). El equipo de nivel es de la visita (§ Fase 8).
   */
  precision_order: PrecisionOrder | null;
  equipment_brand: string | null;
  equipment_model: string | null;
  equipment_serial: string | null;
  equipment_calibration_date: string | null;
  level_type: LevelType | null;
  /** ISO 17123-2: desviación típica en mm por km de doble nivelación. */
  km_precision_mm: number | string | null;
  /** El BM del lugar del primer tramo y el cierre del tramo peor (Fase 37). */
  reference_bm_code: string | null;
  reference_bm_elevation: number | string | null;
  closure_error_mm: number | string | null;
  tolerance_mm: number | string | null;
  meets_tolerance: boolean | null;
  /** Longitud del circuito de la libreta, para el margen de la tendencia (Fase 32). */
  total_distance_km: number | string | null;
}

/**
 * Fila de `settlement_book_readings`, tal como llega de la base. Los
 * calculados (AI, cota, cota compensada) se leen persistidos, sin recalcular,
 * como hace la vista de la visita.
 */
export interface BookReadingRow {
  reading_order: number;
  point_code: string;
  point_type: string;
  /** La fila arranca un tramo desde un BM del lugar (Fase 37). */
  starts_section: boolean | null;
  backsight: number | string | null;
  foresight: number | string | null;
  back_distance_m: number | string | null;
  fore_distance_m: number | string | null;
  instrument_height: number | string | null;
  elevation_calculated: number | string | null;
  elevation_corrected: number | string | null;
  /** La cota de catálogo de un BM de control (Fase 30); null en las demás filas. */
  catalog_elevation: number | string | null;
}

/** «Calculada», «En medición», «Borrador». */
function statusLabel(status: string): string {
  return VISIT_STATUS_LABELS[status as VisitStatus] ?? status;
}

/** El orden que alcanza la visita, o «Sin verificación». */
function verificationLabel(order: PrecisionOrder | null): string {
  return order ? PRECISION_ORDER_LABELS[order] : "Sin verificación";
}

function num(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/** Milímetros a un decimal con signo explícito: `+1.2`, `-0.8`, `0.0`. */
function signedMm(value: number): string {
  const r = Math.round(value * 10) / 10;
  if (r === 0) return "0.0";
  return `${r > 0 ? "+" : ""}${r.toFixed(1)}`;
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
    { width: 9 }, { width: 13 }, { width: 22 }, { width: 14 },
    { width: 13 }, { width: 22 }, { width: 14 }, { width: 18 },
  ];

  setSheetTitle(s, `${site.name} — catálogo y cotas medidas`);

  writeSection(s, 3, "Catálogo de puntos");
  setHeaders(s, 4, [
    "Código",
    "Ubicación",
    "Cota C0 (m)",
    "Alta",
    "Baja",
    "Motivo de baja",
  ]);
  points.forEach((p, i) => {
    writeRow(
      s,
      5 + i,
      [
        p.code,
        p.location_description,
        num(p.initial_elevation),
        p.active_from,
        p.retired_on,
        p.retirement_reason,
      ],
      [
        null, null, DECIMALS.elevation, null, null, null,
      ],
    );
  });

  let row = 5 + points.length + 1;
  // Una fila por visita con su estado, su BM de arranque, su verificación y
  // su nota (Fases 18 y 37). Va en un bloque propio y no como columnas de la
  // tabla de cotas, que es de una fila por lectura: ahí se repetiría en cada
  // punto, y una visita sin cotas todavía no tendría fila donde mostrarlos.
  writeSection(s, row, "Visitas");
  row += 1;
  setHeaders(s, row, [
    "Visita",
    "Fecha",
    "Estado",
    "BM de arranque",
    "Cota BM (m)",
    "Verificación",
    "Cierre (mm)",
    "Tolerancia (mm)",
    "Nota",
  ]);
  row += 1;
  for (const visit of visits) {
    writeRow(
      s,
      row,
      [
        visit.visit_number,
        visit.date,
        statusLabel(visit.status),
        visit.reference_bm_code,
        num(visit.reference_bm_elevation),
        verificationLabel(visit.precision_order),
        num(visit.closure_error_mm),
        num(visit.tolerance_mm),
        visit.notes?.trim() || null,
      ],
      [null, null, null, null, DECIMALS.elevation, null, 1, 1, null],
    );
    row += 1;
  }

  row += 1;
  writeSection(s, row, "Cotas medidas por visita");
  row += 1;
  // El equipo va en ESTA tabla, a su propio grano (una fila por lectura,
  // repetido como ya se repite Visita/Fecha/Estado), y no se colapsa a la
  // visita más reciente como en el Resumen: el instrumento puede cambiar
  // entre campañas, y este es el único artefacto que conserva sin pérdida
  // qué equipo midió cada visita, incluidas las que ya no son la
  // última (§ Fase 8 — es justo la pérdida de trazabilidad que la fase existe
  // para cerrar).
  setHeaders(s, row, [
    "Visita",
    "Fecha",
    "Estado",
    "Punto",
    "Cota (m)",
    "Equipo",
    "Tipo de nivel",
    "Desv. típica (mm/km)",
  ]);
  row += 1;

  const codeById = new Map(points.map((p) => [p.id, p.code]));
  for (const visit of visits) {
    const computed = history.visits.find((v) => v.visitId === visit.id);
    const equipoVisita = equipmentLine(
      visit.equipment_brand,
      visit.equipment_model,
      visit.equipment_serial,
    );
    const tipoNivelVisita = visit.level_type
      ? LEVEL_TYPE_LABELS[visit.level_type]
      : null;
    for (const reading of computed?.readings ?? []) {
      writeRow(
        s,
        row,
        [
          visit.visit_number,
          visit.date,
          statusLabel(visit.status),
          codeById.get(reading.pointId) ?? reading.pointId,
          reading.elevation,
          equipoVisita,
          tipoNivelVisita,
          num(visit.km_precision_mm),
        ],
        [null, null, null, null, DECIMALS.elevation, null, null, DECIMALS.mm],
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
}

function sheetSummary(
  wb: ExcelJS.Workbook,
  site: SiteRow,
  points: PointRow[],
  visits: VisitRow[],
  history: SettlementHistory,
  thresholds: Thresholds,
  project: ProjectMetadata | null,
): void {
  const s = wb.addWorksheet("Resumen");
  s.columns = [{ width: 34 }, { width: 34 }];

  setSheetTitle(s, `${site.name} — resumen`);

  const worst = history.visits[history.visits.length - 1]?.worstAlert ?? null;
  // La tendencia necesita el orden y el circuito de cada visita para su
  // margen de ruido (Fase 31, D-10; Fase 32, D-7).
  const trends = computeTrends(history.visits);
  const acelerando = Object.values(trends).filter((t) => t === "accelerating").length;

  let row0 = 3;
  const pares = projectPairs(project);
  if (pares.length > 0) {
    writeSection(s, row0, "Proyecto");
    row0 = writePairs(s, row0 + 1, pares) + 1;
  }

  writeSection(s, row0, "Lugar");
  let row = writePairs(s, row0 + 1, [
    ["Nombre", site.name],
    ["Descripción", site.description],
    [
      "Tipo de estructura",
      STRUCTURE_TYPE_LABELS[site.structure_type as StructureType] ??
        site.structure_type,
    ],
    ["Puntos del catálogo", points.length],
    ["Visitas registradas", visits.length],
  ]);

  // El equipo es de la VISITA, no del lugar ni del proyecto: el instrumento
  // puede cambiar entre campañas (§ Fase 8). Se muestra el de la más
  // reciente, la misma que informa «peor alerta» más abajo.
  const lastVisit = visits[visits.length - 1];
  if (lastVisit) {
    row += 1;
    writeSection(s, row, "Equipo: nivel (última visita)");
    row = writePairs(s, row + 1, [
      ["Verificación", verificationLabel(lastVisit.precision_order)],
      [
        "Equipo",
        equipmentLine(
          lastVisit.equipment_brand,
          lastVisit.equipment_model,
          lastVisit.equipment_serial,
        ),
      ],
      ["Fecha de calibración", lastVisit.equipment_calibration_date],
      [
        "Tipo de nivel",
        lastVisit.level_type ? LEVEL_TYPE_LABELS[lastVisit.level_type] : null,
      ],
      [
        "Desviación típica (mm/km, doble nivelación)",
        num(lastVisit.km_precision_mm),
      ],
    ]);
  }

  row += 1;
  writeSection(s, row, "Umbrales vigentes");
  row = writePairs(s, row + 1, [
    ["Velocidad — precaución (mm/mes)", thresholds.velocityCaution],
    ["Velocidad — alerta (mm/mes)", thresholds.velocityAlert],
    ["Velocidad — alarma (mm/mes)", thresholds.velocityAlarm],
    ["Acumulado — precaución (mm)", thresholds.accumulatedCaution],
    ["Acumulado — alerta (mm)", thresholds.accumulatedAlert],
    ["Acumulado — alarma (mm)", thresholds.accumulatedAlarm],
  ]);

  row += 1;
  writeSection(s, row, "Estado del monitoreo");
  row = writePairs(s, row + 1, [
    [
      "Peor alerta (última visita)",
      worst ? ALERT_LEVEL_LABELS[worst as AlertLevel] : null,
    ],
    ["Puntos con tendencia creciente", acelerando],
  ]);

  row += 1;
  writeSection(s, row, "Trazabilidad");
  writePairs(s, row + 1, [
    ["Creado", site.created_at],
    ["Notas", site.notes],
  ]);
}

/**
 * Cabecera de la libreta de una visita, en una línea: visita, fecha, el BM de
 * su primer tramo y el cierre de su tramo peor con el orden que alcanza, o
 * «sin verificación» (Fase 37, decisión 15).
 */
function bookTitle(visit: VisitRow): string {
  const cota = num(visit.reference_bm_elevation);
  const desde = visit.reference_bm_code
    ? `Desde ${visit.reference_bm_code}` + (cota === null ? "" : ` (${cota.toFixed(DECIMALS.elevation)})`)
    : "Sin BM de arranque";

  const cierre = num(visit.closure_error_mm);
  const tolerancia = num(visit.tolerance_mm);
  const cierreTexto = [
    cierre === null ? "Sin cierre" : `Cierre ${signedMm(cierre)} mm`,
    tolerancia === null ? null : `tolerancia ${tolerancia.toFixed(1)} mm`,
    verificationLabel(visit.precision_order).toLowerCase(),
  ]
    .filter((t): t is string => t !== null)
    .join(" · ");

  return [`Visita ${visit.visit_number}`, visit.date, desde, cierreTexto].join(" — ");
}

/**
 * La libreta de nivelación de cada visita (Fase 18, decisión 21): es el dato
 * crudo del que salen sus cotas. Cada fila lleva su tramo (Fase 37); la cota
 * es la de la medida, sin compensar. La hoja existe siempre, con un aviso si
 * ninguna visita tiene libreta, para que el libro no cambie de forma.
 */
function sheetBooks(
  wb: ExcelJS.Workbook,
  site: SiteRow,
  visits: VisitRow[],
  bookByVisit: Record<string, BookReadingRow[]>,
): void {
  const s = wb.addWorksheet("Libretas");
  s.columns = [
    { width: 8 }, { width: 14 }, { width: 16 }, { width: 11 }, { width: 12 },
    { width: 11 }, { width: 11 }, { width: 12 }, { width: 12 }, { width: 17 },
  ];

  setSheetTitle(s, `${site.name} — libretas de nivelación de las visitas`);

  const conLibreta = visits.filter((v) => (bookByVisit[v.id]?.length ?? 0) > 0);
  if (conLibreta.length === 0) {
    s.getCell(3, 1).value =
      "Ninguna visita de este lugar tiene libreta de nivelación.";
    return;
  }

  const formats = [
    null, null, null,
    DECIMALS.elevation, DECIMALS.coordinate, DECIMALS.elevation,
    DECIMALS.elevation, DECIMALS.coordinate,
    DECIMALS.elevation, DECIMALS.elevation,
  ];

  let row = 3;
  for (const visit of conLibreta) {
    writeSection(s, row, bookTitle(visit));
    row += 1;
    setHeaders(s, row, [
      "Tramo",
      "Punto",
      "Tipo",
      "V+ (m)",
      "Dist. V+ (m)",
      "AI (m)",
      "V− (m)",
      "Dist. V− (m)",
      "Cota (m)",
      "Cota de catálogo (m)",
    ]);
    row += 1;

    const filas = [...bookByVisit[visit.id]!].sort(
      (a, b) => a.reading_order - b.reading_order,
    );
    let tramo = 0;
    for (const [i, r] of filas.entries()) {
      if (i === 0 || r.starts_section) tramo += 1;
      writeRow(
        s,
        row,
        [
          tramo,
          r.point_code,
          POINT_TYPE_LABELS[r.point_type as PointType] ?? r.point_type,
          num(r.backsight),
          num(r.back_distance_m),
          num(r.instrument_height),
          num(r.foresight),
          num(r.fore_distance_m),
          num(r.elevation_calculated),
          num(r.catalog_elevation),
        ],
        formats,
      );
      row += 1;
    }
    // Fila en blanco entre una visita y la siguiente.
    row += 1;
  }
}

/**
 * Libro completo de un lugar de control de asentamientos.
 *
 * `bookByVisit` son las filas de libreta indexadas por `visit_id`. Es opcional
 * porque un lugar sin visitas no tiene ninguna; la hoja «Libretas» sale
 * igual, con su aviso.
 */
export function buildSettlementWorkbook(
  site: SiteRow,
  points: PointRow[],
  visits: VisitRow[],
  history: SettlementHistory,
  thresholds: Thresholds,
  project: ProjectMetadata | null = null,
  bookByVisit: Record<string, BookReadingRow[]> = {},
): ExcelJS.Workbook {
  const wb = newWorkbook();
  const ordered = [...visits].sort((a, b) => a.date.localeCompare(b.date));
  sheetRawData(wb, site, points, ordered, history);
  sheetCalculations(wb, site, points, ordered, history);
  sheetSummary(wb, site, points, ordered, history, thresholds, project);
  sheetBooks(wb, site, ordered, bookByVisit);
  return wb;
}
