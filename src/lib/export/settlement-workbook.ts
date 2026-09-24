// Libro de Excel de un lugar de control de asentamientos (§ 4.8).
//
// A diferencia de poligonal y nivelación, la unidad no es un proceso con una
// tabla de filas, sino un LUGAR con un catálogo de puntos y una serie de
// visitas en el tiempo. Las hojas se organizan en consecuencia: las lecturas
// crudas por visita y punto, los valores derivados con su alerta, el resumen
// con los umbrales vigentes y, desde la Fase 18, la libreta de nivelación de
// cada visita que se capturó con ella.

import type ExcelJS from "exceljs";
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
  CAPTURE_MODE_LABELS,
  type AlertLevel,
  type CaptureMode,
  type SettlementHistory,
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
  northing: number | string | null;
  easting: number | string | null;
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
  weather_conditions: string | null;
  /** Orden de precisión y equipo de nivel, propios de la visita (§ Fase 8). */
  precision_order: PrecisionOrder;
  equipment_brand: string | null;
  equipment_model: string | null;
  equipment_serial: string | null;
  equipment_calibration_date: string | null;
  level_type: LevelType | null;
  /** ISO 17123-2: desviación típica en mm por km de doble nivelación. */
  km_precision_mm: number | string | null;
  /**
   * Captura y cierre de la visita (Fase 18). En `book`, el cierre, la
   * tolerancia y el «cumple» se derivan de la libreta; en `direct`, el cierre
   * es el tecleado y la tolerancia queda en null.
   */
  capture_mode: CaptureMode;
  reference_bm_code: string | null;
  reference_bm_elevation: number | string | null;
  closure_error_mm: number | string | null;
  tolerance_mm: number | string | null;
  meets_tolerance: boolean | null;
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
  backsight: number | string | null;
  foresight: number | string | null;
  back_distance_m: number | string | null;
  fore_distance_m: number | string | null;
  instrument_height: number | string | null;
  elevation_calculated: number | string | null;
  elevation_corrected: number | string | null;
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
    "Norte (m)",
    "Este (m)",
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
        num(p.northing),
        num(p.easting),
        num(p.initial_elevation),
        p.active_from,
        p.retired_on,
        p.retirement_reason,
      ],
      [
        null, null, DECIMALS.coordinate, DECIMALS.coordinate, DECIMALS.elevation,
        null, null, null,
      ],
    );
  });

  let row = 5 + points.length + 1;
  // Una fila por visita con su modo de captura, su amarre y su cierre (Fase
  // 18). Va en un bloque propio y no como columnas de la tabla de cotas, que
  // es de una fila por lectura: ahí se repetiría en cada punto, y una visita
  // sin cotas todavía no tendría fila donde mostrarlos.
  writeSection(s, row, "Visitas");
  row += 1;
  setHeaders(s, row, [
    "Visita",
    "Fecha",
    "Captura",
    "BM de amarre",
    "Cota amarre (m)",
    "Cierre (mm)",
    "Tolerancia (mm)",
  ]);
  row += 1;
  for (const visit of visits) {
    writeRow(
      s,
      row,
      [
        visit.visit_number,
        visit.date,
        CAPTURE_MODE_LABELS[visit.capture_mode],
        visit.reference_bm_code,
        num(visit.reference_bm_elevation),
        num(visit.closure_error_mm),
        num(visit.tolerance_mm),
      ],
      [null, null, null, null, DECIMALS.elevation, 1, 1],
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
  // qué equipo midió cada visita cerrada, incluidas las que ya no son la
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
          visit.status === "closed" ? "Cerrada" : "Abierta",
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
  project: ProjectMetadata | null,
): void {
  const s = wb.addWorksheet("Resumen");
  s.columns = [{ width: 34 }, { width: 34 }];

  setSheetTitle(s, `${site.name} — resumen`);

  const worst = history.visits[history.visits.length - 1]?.worstAlert ?? null;
  const acelerando = Object.values(history.trends).filter(
    (t) => t === "accelerating",
  ).length;

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
    ["Estado", site.status === "closed" ? "Cerrado" : "Activo"],
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
      [
        "Orden de precisión",
        PRECISION_ORDER_LABELS[lastVisit.precision_order],
      ],
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

/**
 * Cabecera de la libreta de una visita, en una línea: visita, fecha, amarre y
 * cierre con su veredicto. Sin tolerancia (libreta sin distancias) no hay
 * veredicto posible y se dice así, en vez de callarlo.
 */
function bookTitle(visit: VisitRow): string {
  const cota = num(visit.reference_bm_elevation);
  const amarre = visit.reference_bm_code
    ? `Amarre ${visit.reference_bm_code}` +
      (cota === null ? "" : ` (${cota.toFixed(DECIMALS.elevation)})`)
    : "Sin amarre";

  const cierre = num(visit.closure_error_mm);
  const tolerancia = num(visit.tolerance_mm);
  const veredicto =
    tolerancia === null
      ? "sin tolerancia"
      : visit.meets_tolerance === null
        ? null
        : visit.meets_tolerance
          ? "cumple"
          : "no cumple";
  const cierreTexto = [
    cierre === null ? "Sin cierre" : `Cierre ${signedMm(cierre)} mm`,
    tolerancia === null ? null : `tolerancia ${tolerancia.toFixed(1)} mm`,
    veredicto,
  ]
    .filter((t): t is string => t !== null)
    .join(" · ");

  return [`Visita ${visit.visit_number}`, visit.date, amarre, cierreTexto].join(
    " — ",
  );
}

/**
 * La libreta de nivelación de cada visita en modo `book` (Fase 18, decisión
 * 21): es el dato crudo del que salen sus cotas. Las visitas en `direct` no
 * tienen libreta y no aparecen; la hoja existe siempre, con un aviso si
 * ninguna la tiene, para que el libro no cambie de forma según el lugar.
 */
function sheetBooks(
  wb: ExcelJS.Workbook,
  site: SiteRow,
  visits: VisitRow[],
  bookByVisit: Record<string, BookReadingRow[]>,
): void {
  const s = wb.addWorksheet("Libretas");
  s.columns = [
    { width: 14 }, { width: 16 }, { width: 11 }, { width: 12 }, { width: 11 },
    { width: 11 }, { width: 12 }, { width: 12 }, { width: 17 },
  ];

  setSheetTitle(s, `${site.name} — libretas de nivelación de las visitas`);

  const conLibreta = visits.filter(
    (v) => v.capture_mode === "book" && (bookByVisit[v.id]?.length ?? 0) > 0,
  );
  if (conLibreta.length === 0) {
    s.getCell(3, 1).value =
      "Ninguna visita de este lugar tiene libreta de nivelación.";
    return;
  }

  const formats = [
    null, null,
    DECIMALS.elevation, DECIMALS.coordinate, DECIMALS.elevation,
    DECIMALS.elevation, DECIMALS.coordinate,
    DECIMALS.elevation, DECIMALS.elevation,
  ];

  let row = 3;
  for (const visit of conLibreta) {
    writeSection(s, row, bookTitle(visit));
    row += 1;
    setHeaders(s, row, [
      "Punto",
      "Tipo",
      "V+ (m)",
      "Dist. V+ (m)",
      "AI (m)",
      "V− (m)",
      "Dist. V− (m)",
      "Cota (m)",
      "Cota compensada (m)",
    ]);
    row += 1;

    const filas = [...bookByVisit[visit.id]!].sort(
      (a, b) => a.reading_order - b.reading_order,
    );
    for (const r of filas) {
      writeRow(
        s,
        row,
        [
          r.point_code,
          POINT_TYPE_LABELS[r.point_type as PointType] ?? r.point_type,
          num(r.backsight),
          num(r.back_distance_m),
          num(r.instrument_height),
          num(r.foresight),
          num(r.fore_distance_m),
          num(r.elevation_calculated),
          num(r.elevation_corrected),
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
 * porque un lugar solo con visitas en `direct` no tiene ninguna; la hoja
 * «Libretas» sale igual, con su aviso.
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
