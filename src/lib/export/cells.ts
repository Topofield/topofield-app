// Primitivas de celda de los libros de la Fase 38: un dato medido o tecleado
// lleva el estilo de dato; una celda calculada lleva su fórmula y, como
// resultado guardado, el valor del motor, para que el libro se vea completo en
// cualquier visor y Excel recalcule al cambiar un dato.

import type ExcelJS from "exceljs";
import {
  ANGULAR_TOLERANCE_K,
  LEVELING_TOLERANCE_K,
  MIN_RELATIVE_PRECISION,
} from "@/lib/calculations/tolerances";
import { PRECISION_ORDERS, PRECISION_ORDER_LABELS, type PrecisionOrder } from "@/types/project";
import { WORKBOOK_COLORS } from "./workbook";

export const FMT = {
  coord: "0.000",
  elev: "0.0000",
  mm: "0.0",
  rate: "0.00",
  km: "0.000",
  deg: "0",
  min: "0",
  sec: "0.0",
  dec: "0.000000",
  ratio: "#,##0",
} as const;

export const ORDER_NAME: Record<PrecisionOrder, string> = PRECISION_ORDER_LABELS;

export function col(n: number): string {
  let s = "";
  for (let x = n; x > 0; x = Math.floor((x - 1) / 26)) s = String.fromCharCode(65 + ((x - 1) % 26)) + s;
  return s;
}

export const at = (c: number, r: number) => `${col(c)}${r}`;
export const ref = (sheet: string, a: string) => `'${sheet.replace(/'/g, "''")}'!${a}`;

const DATA_FILL: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: WORKBOOK_COLORS.miraBg } };
const HEADER_FILL: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: WORKBOOK_COLORS.sel } };

export function putData(
  ws: ExcelJS.Worksheet,
  c: number,
  r: number,
  value: number | string | Date | null,
  fmt?: string,
): string {
  const cell = ws.getCell(r, c);
  if (value !== null) cell.value = value;
  cell.fill = DATA_FILL;
  cell.font = { color: { argb: WORKBOOK_COLORS.miraInk } };
  if (fmt) cell.numFmt = fmt;
  return at(c, r);
}

export function putFormula(
  ws: ExcelJS.Worksheet,
  c: number,
  r: number,
  formula: string,
  result: number | string | null,
  fmt?: string,
): string {
  const cell = ws.getCell(r, c);
  cell.value = { formula, result: result ?? "" } as ExcelJS.CellFormulaValue;
  cell.font = { color: { argb: WORKBOOK_COLORS.ink } };
  if (fmt) cell.numFmt = fmt;
  return at(c, r);
}

export function putLabel(
  ws: ExcelJS.Worksheet,
  c: number,
  r: number,
  text: string,
  style: "title" | "section" | "header" | "label" = "label",
): void {
  const cell = ws.getCell(r, c);
  cell.value = text;
  if (style === "title") cell.font = { bold: true, size: 14, color: { argb: WORKBOOK_COLORS.ink } };
  if (style === "section") cell.font = { bold: true, size: 11, color: { argb: WORKBOOK_COLORS.ink } };
  if (style === "label") cell.font = { color: { argb: WORKBOOK_COLORS.ink2 } };
  if (style === "header") {
    cell.font = { bold: true };
    cell.fill = HEADER_FILL;
    cell.border = { bottom: { style: "thin", color: { argb: WORKBOOK_COLORS.ruleStrong } } };
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  }
}

export function roundHalfUp(expr: string, decimals: number): string {
  const f = 10 ** decimals;
  return `INT((${expr})*${f}+0.5)/${f}`;
}

/** Título en A1 y los pares etiqueta/valor debajo; devuelve la primera fila libre. */
export function writeSheetHeader(
  ws: ExcelJS.Worksheet,
  title: string,
  pairs: [string, string | number | null][],
): number {
  putLabel(ws, 1, 1, title, "title");
  let r = 2;
  for (const [label, value] of pairs) {
    if (value === null || value === "") continue;
    putLabel(ws, 1, r, label);
    ws.getCell(r, 3).value = value;
    r += 1;
  }
  return r + 1;
}

export function writeLevelingTolerances(ws: ExcelJS.Worksheet, c: number, r: number): Record<PrecisionOrder, string> {
  putLabel(ws, c, r, "Tolerancia de nivelación: K·√km (mm)", "section");
  putLabel(ws, c, r + 1, "Orden", "header");
  putLabel(ws, c + 1, r + 1, "K (mm/√km)", "header");
  const out = {} as Record<PrecisionOrder, string>;
  PRECISION_ORDERS.forEach((o, i) => {
    ws.getCell(r + 2 + i, c).value = ORDER_NAME[o];
    ws.getCell(r + 2 + i, c + 1).value = LEVELING_TOLERANCE_K[o];
    out[o] = at(c + 1, r + 2 + i);
  });
  return out;
}

export function writePolygonalTolerances(
  ws: ExcelJS.Worksheet,
  c: number,
  r: number,
): Record<PrecisionOrder, { angularK: string; minPrecision: string }> {
  putLabel(ws, c, r, "Tolerancias de la poligonal", "section");
  putLabel(ws, c, r + 1, "Orden", "header");
  putLabel(ws, c + 1, r + 1, "K angular (″/√n)", "header");
  putLabel(ws, c + 2, r + 1, "Precisión mínima (1:X)", "header");
  const out = {} as Record<PrecisionOrder, { angularK: string; minPrecision: string }>;
  PRECISION_ORDERS.forEach((o, i) => {
    const row = r + 2 + i;
    ws.getCell(row, c).value = ORDER_NAME[o];
    ws.getCell(row, c + 1).value = ANGULAR_TOLERANCE_K[o];
    ws.getCell(row, c + 2).value = MIN_RELATIVE_PRECISION[o];
    ws.getCell(row, c + 2).numFmt = FMT.ratio;
    out[o] = { angularK: at(c + 1, row), minPrecision: at(c + 2, row) };
  });
  return out;
}

export function setLayout(ws: ExcelJS.Worksheet, { frozenRows, widths }: { frozenRows: number; widths: number[] }): void {
  ws.views = [{ state: "frozen", ySplit: frozenRows }];
  ws.columns = widths.map((width) => ({ width }));
  ws.pageSetup = { paperSize: 9, orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 };
}

export function verdictFormatting(ws: ExcelJS.Worksheet, range: string): void {
  ws.addConditionalFormatting({
    ref: range,
    rules: [
      { type: "containsText", operator: "containsText", text: "NO CUMPLE", priority: 1,
        style: { font: { bold: true, color: { argb: WORKBOOK_COLORS.danger } } } },
      { type: "containsText", operator: "containsText", text: "CUMPLE", priority: 2,
        style: { font: { bold: true, color: { argb: WORKBOOK_COLORS.success } } } },
    ],
  });
}
