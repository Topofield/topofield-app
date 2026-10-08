// Libro de Excel de un lugar de asentamientos (Fase 38): la forma de la
// cartera real —la libreta de cada visita y, por punto, la «diferencia
// observada» contra la primera visita y contra la anterior— con fórmulas
// vivas. Cada celda calculada lleva su fórmula y, como resultado guardado, el
// valor del motor.
//
// La cartera pone las visitas lado a lado porque cada una es una sola armada
// desde el BM; una visita de la app puede tener varias armadas y puntos de
// cambio, así que cada libreta va en su bloque, una debajo de otra, y la
// comparación apunta a sus celdas.

import type ExcelJS from "exceljs";
import { bookElevations, bookRowInputOf, computeBook } from "@/lib/calculations/settlement-book";
import { DAYS_PER_MONTH } from "@/lib/calculations/tolerances";
import { samePointCode } from "@/lib/calculations/leveling";
import type { computeHistory } from "@/lib/calculations/settlement";
import { PRECISION_ORDERS, PRECISION_ORDER_LABELS } from "@/types/project";
import {
  ALERT_LEVEL_LABELS,
  type BenchmarkInput,
  type BookRowPayload,
  type PointInput,
  type Thresholds,
  type VisitInput,
} from "@/types/settlement";
import {
  FMT,
  at,
  putData,
  putFormula,
  putLabel,
  ref,
  roundHalfUp,
  setLayout,
  writeLevelingTolerances,
  writeSheetHeader,
} from "./cells";
import { WORKBOOK_COLORS, newWorkbook, projectPairs, type ProjectMetadata } from "./workbook";

export interface SettlementSheetVisit {
  id: string;
  number: number;
  date: string;
  leveler: string | null;
  equipment: string | null;
  notes: string | null;
  /** Su libreta; [] en una visita de cotas tecleadas. */
  rows: BookRowPayload[];
}

type History = ReturnType<typeof computeHistory>;

const BOOKS = "Libretas";
const COMPARISON = "Comparación";
// Columnas de la libreta.
const L = { point: 1, back: 2, hi: 3, fore: 4, inter: 5, elev: 6, dBack: 7, dFore: 8 };
const MARGIN = "0.000001";

const isoDate = (date: string) => new Date(`${date}T00:00:00Z`);
const finite = (x: number | null | undefined): x is number => x != null && Number.isFinite(x);

/** Libro completo de un lugar de asentamientos. */
export function buildSettlementWorkbook(args: {
  site: { name: string; location: string | null; structure: string | null };
  project: ProjectMetadata | null;
  points: (PointInput & { location: string | null })[];
  benchmarks: BenchmarkInput[];
  visits: SettlementSheetVisit[];
  visitInputs: VisitInput[];
  thresholds: Thresholds;
  history: History;
  /** Los avisos de tendencia, con el texto del informe (`siteReportOf`). */
  warnings: string[];
}): ExcelJS.Workbook {
  const wb = newWorkbook();
  const cells = sheetBooks(wb, args);
  sheetComparison(wb, args, cells);
  sheetSummary(wb, args);
  return wb;
}

/** La fila de la libreta de cada lectura de cada visita: visita → punto → celda de COTA. */
type BookCells = Map<string, Map<string, string>>;

function sheetBooks(wb: ExcelJS.Workbook, a: Parameters<typeof buildSettlementWorkbook>[0]): BookCells {
  const ws = wb.addWorksheet(BOOKS);
  let r = writeSheetHeader(ws, `${a.site.name} — libretas de las visitas`, [
    ["Proyecto", a.project?.name ?? null],
    ["Lugar", a.site.name],
    ["Regla", "La cota es AI − lectura, sin compensar; el cierre de cada tramo solo comprueba."],
  ]);
  const k = writeLevelingTolerances(ws, 11, 2);
  const out: BookCells = new Map();

  for (const v of a.visits) {
    const byPoint = new Map<string, string>();
    out.set(v.id, byPoint);
    putLabel(ws, 1, r, `Visita ${v.number} · ${v.date.split("-").reverse().join("/")}`, "section");
    const meta = [v.leveler && `Nivelador: ${v.leveler}`, v.equipment && `Equipo: ${v.equipment}`, v.notes && `Nota: ${v.notes}`]
      .filter(Boolean)
      .join(" · ");
    if (meta) putLabel(ws, 3, r, meta);
    r += 1;
    if (v.rows.length === 0) {
      putLabel(ws, 1, r, "Visita de cotas tecleadas: sin libreta.");
      r += 2;
      continue;
    }
    ["PUNTO", "V+", "AI", "V−", "VI", "COTA", "DIST. V+ (m)", "DIST. V− (m)"].forEach((label, i) =>
      putLabel(ws, i + 1, r, label, "header"),
    );
    r += 1;

    const inputs = v.rows.map(bookRowInputOf);
    const book = computeBook(inputs, a.benchmarks, v.id);
    const first = r;
    const sheetRow = (i: number) => first + i;

    // Las filas: datos, y las fórmulas tramo por tramo.
    v.rows.forEach((row, i) => {
      const s = sheetRow(i);
      const intermediate = row.pointType === "intermediate";
      putData(ws, L.point, s, row.pointCode);
      if (row.backsight != null) putData(ws, L.back, s, row.backsight, FMT.elev);
      if (row.foresight != null) putData(ws, intermediate ? L.inter : L.fore, s, row.foresight, FMT.elev);
      if (!intermediate) {
        if (row.backDistanceM != null) putData(ws, L.dBack, s, row.backDistanceM, FMT.coord);
        if (row.foreDistanceM != null) putData(ws, L.dFore, s, row.foreDistanceM, FMT.coord);
      }
    });

    for (const t of book.tramos) {
      let hiRow: number | null = null;
      for (let i = t.start; i <= t.end; i++) {
        const s = sheetRow(i);
        const row = v.rows[i]!;
        const out = book.readings[i]!;
        const intermediate = row.pointType === "intermediate";
        if (i === t.start) {
          if (finite(t.startElevation)) putData(ws, L.elev, s, t.startElevation, FMT.elev);
        } else if (finite(out.elevationCalculated) && hiRow != null) {
          putFormula(ws, L.elev, s, `${at(L.hi, hiRow)}-${at(intermediate ? L.inter : L.fore, s)}`, out.elevationCalculated, FMT.elev);
        }
        if (!intermediate && row.backsight != null && finite(out.instrumentHeight) && (i === t.start ? finite(t.startElevation) : finite(out.elevationCalculated))) {
          putFormula(ws, L.hi, s, `${at(L.elev, s)}+${at(L.back, s)}`, out.instrumentHeight, FMT.elev);
          hiRow = s;
        }
      }
    }
    r = first + v.rows.length;

    // Por tramo, su verificación.
    for (const t of book.tramos) {
      putLabel(ws, 1, r, `Tramo desde ${t.startCode}`);
      if (!t.complete) {
        putData(ws, 3, r, "A medias: falta leer parte de la cadena.");
      } else if (t.kind === "open") {
        putData(ws, 3, r, "Sin verificación: no termina en un BM del lugar.");
      } else {
        const knownValue =
          t.kind === "closed"
            ? t.startElevation!
            : (a.benchmarks.find((b) => samePointCode(b.code, t.endCode ?? ""))?.elevation ?? Number.NaN);
        const known = t.kind === "closed" ? at(L.elev, sheetRow(t.start)) : putData(ws, 9, r, knownValue, FMT.elev);
        const end = at(L.elev, sheetRow(t.end));
        const closure = (book.readings[t.end]!.elevationCalculated - knownValue) * 1000;
        putLabel(ws, 2, r, "Cierre (mm)");
        const c = putFormula(ws, 3, r, `(${end}-${known})*1000`, closure, FMT.mm);
        if (t.distanceKm == null) {
          putData(ws, 5, r, "Sin distancias: el cierre no da orden.");
        } else {
          const rows = `${at(L.dBack, sheetRow(t.start))}:${at(L.dFore, sheetRow(t.end))}`;
          putLabel(ws, 4, r, "km");
          const km = putFormula(ws, 5, r, `SUM(${rows})/1000`, t.distanceKm, FMT.km);
          const formula = PRECISION_ORDERS.reduceRight(
            (rest, o) => `IF(ABS(${c})<=${k[o]}*SQRT(${km})+${MARGIN},"${PRECISION_ORDER_LABELS[o]}",${rest})`,
            `"Ninguno"`,
          );
          putLabel(ws, 6, r, "Orden");
          putFormula(ws, 7, r, formula, t.order ? PRECISION_ORDER_LABELS[t.order] : "Ninguno");
        }
      }
      r += 1;
    }

    // La celda de cada punto de control, para la comparación.
    const { readings } = bookElevations(book, inputs, a.points, v.date);
    for (const reading of readings) byPoint.set(reading.pointId, ref(BOOKS, at(L.elev, sheetRow(reading.rowIndex))));
    r += 2;
  }
  setLayout(ws, { frozenRows: 0, widths: [14, 10, 11, 10, 10, 11, 11, 11, 11, 2, 16, 12] });
  return out;
}

/**
 * El peor nivel de velocidad y acumulado, con la regla de `classifyAlert`. La
 * primera lectura de un punto no tiene velocidad (`vel` null) y se juzga solo
 * por el acumulado.
 */
function alertFormula(vel: string | null, acc: string, t: Record<keyof Thresholds, string>): string {
  const level = (x: string, c: string, al: string, am: string) =>
    `IF(ABS(${x})>=${am},3,IF(ABS(${x})>=${al},2,IF(ABS(${x})>=${c},1,0)))`;
  const byAcc = level(acc, t.accumulatedCaution, t.accumulatedAlert, t.accumulatedAlarm);
  const m = vel ? `MAX(${level(vel, t.velocityCaution, t.velocityAlert, t.velocityAlarm)},${byAcc})` : byAcc;
  return `IF(${m}=3,"${ALERT_LEVEL_LABELS.alarm}",IF(${m}=2,"${ALERT_LEVEL_LABELS.alert}",IF(${m}=1,"${ALERT_LEVEL_LABELS.caution}","${ALERT_LEVEL_LABELS.normal}")))`;
}

function sheetComparison(wb: ExcelJS.Workbook, a: Parameters<typeof buildSettlementWorkbook>[0], books: BookCells): void {
  const ws = wb.addWorksheet(COMPARISON);
  let r = writeSheetHeader(ws, `${a.site.name} — diferencia observada`, [
    ["Proyecto", a.project?.name ?? null],
    ["Lugar", a.site.name],
    ["Regla", "Acumulado contra la C0; parcial y velocidad contra la última visita en que se midió el punto (mes = 30.4375 días)."],
  ]);

  // Los umbrales del lugar.
  putLabel(ws, 1, r, "Umbrales del lugar", "section");
  const keys: [keyof Thresholds, string][] = [
    ["velocityCaution", "Velocidad · precaución (mm/mes)"],
    ["velocityAlert", "Velocidad · alerta (mm/mes)"],
    ["velocityAlarm", "Velocidad · alarma (mm/mes)"],
    ["accumulatedCaution", "Acumulado · precaución (mm)"],
    ["accumulatedAlert", "Acumulado · alerta (mm)"],
    ["accumulatedAlarm", "Acumulado · alarma (mm)"],
  ];
  const t = {} as Record<keyof Thresholds, string>;
  keys.forEach(([key, label], i) => {
    putLabel(ws, 1, r + 1 + i, label);
    t[key] = putData(ws, 3, r + 1 + i, a.thresholds[key], FMT.rate);
  });
  r += keys.length + 2;

  // Rótulos: «Visita N», su fecha y las cinco columnas.
  const visitRow = r;
  const dateRow = r + 1;
  const unitRow = r + 2;
  ["PUNTO", "UBICACIÓN", "C0"].forEach((l, i) => putLabel(ws, i + 1, unitRow, l, "header"));
  const ordered = a.history.visits;
  const meta = new Map(a.visits.map((v) => [v.id, v]));
  const groupCol = (j: number) => 4 + j * 5;
  const dateCells = new Map<string, string>();
  ordered.forEach((hv, j) => {
    const c = groupCol(j);
    putLabel(ws, c, visitRow, `Visita ${hv.visitNumber}`, "section");
    dateCells.set(hv.visitId, putData(ws, c, dateRow, isoDate(hv.date), "dd/mm/yyyy"));
    ["COTA", "ACUM. (mm)", "PARCIAL (mm)", "VEL. (mm/mes)", "SEMÁFORO"].forEach((l, i) => putLabel(ws, c + i, unitRow, l, "header"));
  });

  // Un punto por fila.
  const points = [...a.points].sort((x, y) => x.code.localeCompare(y.code, "es", { numeric: true }));
  points.forEach((p, i) => {
    const row = unitRow + 1 + i;
    putData(ws, 1, row, p.code);
    if (p.location) ws.getCell(row, 2).value = p.location;
    const c0 = at(3, row);
    let previous: { cota: string; date: string } | null = null;
    let baselineWritten = false;
    ordered.forEach((hv, j) => {
      const reading = hv.readings.find((x) => x.pointId === p.id);
      if (!reading) return;
      const c = groupCol(j);
      const visit = meta.get(hv.visitId);
      const bookCell = books.get(hv.visitId)?.get(p.id);
      const cota =
        visit && visit.rows.length > 0 && bookCell
          ? putFormula(ws, c, row, roundHalfUp(bookCell, 4), reading.elevation, FMT.elev)
          : putData(ws, c, row, reading.elevation, FMT.elev);
      if (!baselineWritten) {
        if (p.initialElevation != null) putData(ws, 3, row, p.initialElevation, FMT.elev);
        else putFormula(ws, 3, row, cota, reading.baselineElevation, FMT.elev);
        baselineWritten = true;
      }
      putFormula(ws, c + 1, row, roundHalfUp(`(${cota}-${c0})*1000`, 1), reading.accumulatedSettlement, FMT.mm);
      if (previous) {
        const partial = putFormula(ws, c + 2, row, roundHalfUp(`(${cota}-${previous.cota})*1000`, 1), reading.partialSettlement, FMT.mm);
        const date = dateCells.get(hv.visitId)!;
        putFormula(
          ws,
          c + 3,
          row,
          `IF(DAYS(${date},${previous.date})=0,"",${partial}/(DAYS(${date},${previous.date})/${DAYS_PER_MONTH}))`,
          reading.velocity ?? "",
          FMT.rate,
        );
      }
      putFormula(ws, c + 4, row, alertFormula(previous ? at(c + 3, row) : null, at(c + 1, row), t), ALERT_LEVEL_LABELS[reading.alertStatus]);
      previous = { cota, date: dateCells.get(hv.visitId)! };
    });
  });

  // El semáforo con sus colores.
  const lastRow = unitRow + points.length;
  const lastCol = groupCol(ordered.length - 1) + 4;
  if (points.length > 0 && ordered.length > 0) {
    const colors: [string, string][] = [
      [ALERT_LEVEL_LABELS.alarm, WORKBOOK_COLORS.danger],
      [ALERT_LEVEL_LABELS.alert, WORKBOOK_COLORS.danger],
      [ALERT_LEVEL_LABELS.caution, WORKBOOK_COLORS.miraInk],
      [ALERT_LEVEL_LABELS.normal, WORKBOOK_COLORS.success],
    ];
    ws.addConditionalFormatting({
      ref: `${at(4, unitRow + 1)}:${at(lastCol, lastRow)}`,
      rules: colors.map(([text, color], i) => ({
        type: "containsText",
        operator: "containsText",
        text,
        priority: i + 1,
        style: { font: { bold: true, color: { argb: color } } },
      })),
    });
  }

  // Los avisos de tendencia, como texto de la app.
  let w = lastRow + 3;
  putLabel(ws, 1, w++, "Avisos de tendencia", "section");
  if (a.warnings.length === 0) putLabel(ws, 1, w, "Ninguna lectura se aparta de la tendencia de su punto.");
  for (const text of a.warnings) putLabel(ws, 1, w++, text);

  ws.views = [{ state: "frozen", xSplit: 1, ySplit: unitRow }];
  ws.columns = [{ width: 14 }, { width: 18 }, { width: 11 }, ...ordered.flatMap(() => [{ width: 11 }, { width: 9 }, { width: 9 }, { width: 10 }, { width: 11 }])];
  ws.pageSetup = { paperSize: 9, orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 };
}

function sheetSummary(wb: ExcelJS.Workbook, a: Parameters<typeof buildSettlementWorkbook>[0]): void {
  const ws = wb.addWorksheet("Resumen");
  let r = writeSheetHeader(ws, `${a.site.name} — resumen`, [
    ...projectPairs(a.project),
    ["Lugar", a.site.name],
    ["Ubicación", a.site.location],
    ["Tipo de estructura", a.site.structure],
    ["Cómo leer el libro", "Las celdas con fondo amarillo son datos medidos o tecleados; el resto se calcula con fórmulas y se recalcula si cambia un dato."],
  ]);
  putLabel(ws, 1, r++, "BM del lugar", "section");
  for (const b of a.benchmarks) {
    putLabel(ws, 1, r, b.code);
    putData(ws, 3, r++, b.elevation, FMT.elev);
  }
  ws.columns = [{ width: 22 }, { width: 2 }, { width: 70 }];
}
