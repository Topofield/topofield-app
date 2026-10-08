// Solo para pruebas (Fase 38, decisión 10): evalúa las fórmulas de un libro de
// exceljs con fast-formula-parser, recursivamente desde los datos crudos —una
// fórmula que apunta a otra se evalúa también, no se toma su resultado
// guardado—. Como el resultado guardado de cada celda es el valor del motor,
// «la fórmula da su resultado guardado» es «el Excel calcula como la app».

import type ExcelJS from "exceljs";
import FormulaParser from "fast-formula-parser";

export type CellValue = number | string | boolean | null;

const EXCEL_EPOCH = Date.UTC(1899, 11, 30);
const key = (sheet: string, row: number, col: number) => `'${sheet}'!${colName(col)}${row}`;

function colName(col: number): string {
  let s = "";
  for (let n = col; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
}

function rawValue(cell: ExcelJS.Cell): CellValue {
  const v = cell.value;
  if (v == null) return null;
  if (v instanceof Date) return (v.getTime() - EXCEL_EPOCH) / 86_400_000;
  if (typeof v === "number" || typeof v === "string" || typeof v === "boolean") return v;
  if (typeof v === "object" && "richText" in v) return v.richText.map((t) => t.text).join("");
  return null;
}

/** Fórmulas que fast-formula-parser no trae. */
const EXTRA_FUNCTIONS = {
  SUBSTITUTE: (text: unknown, from: unknown, to: unknown) =>
    String(valueOf(text)).split(String(valueOf(from))).join(String(valueOf(to))),
  MIN: (...args: unknown[]) => Math.min(...numbers(args)),
  MAX: (...args: unknown[]) => Math.max(...numbers(args)),
};

function valueOf(arg: unknown): unknown {
  return typeof arg === "object" && arg !== null && "value" in arg ? (arg as { value: unknown }).value : arg;
}

/** Los números de los argumentos, aplanando rangos; las celdas vacías no cuentan. */
function numbers(args: unknown[]): number[] {
  return args.flatMap((a) => {
    const v = valueOf(a);
    return (Array.isArray(v) ? v.flat(2) : [v]).filter((x): x is number => typeof x === "number");
  });
}

export function evaluateWorkbook(
  wb: ExcelJS.Workbook,
  overrides: Record<string, CellValue> = {},
): Map<string, CellValue> {
  const cache = new Map<string, CellValue>();
  const visiting = new Set<string>();
  // fast-formula-parser no es reentrante: evaluar una fórmula dentro de otra
  // con el mismo intérprete le corrompe el estado. Un intérprete por nivel de
  // profundidad: en cada nivel hay a lo sumo una evaluación en curso.
  const parsers: FormulaParser[] = [];
  let depth = 0;

  const cellAt = (sheet: string, row: number, col: number): CellValue => {
    const k = key(sheet, row, col);
    if (k in overrides) return overrides[k]!;
    if (cache.has(k)) return cache.get(k)!;
    const ws = wb.getWorksheet(sheet);
    if (!ws) throw new Error(`Hoja inexistente: ${sheet}`);
    const cell = ws.getCell(row, col);
    if (!cell.formula) return rawValue(cell);
    if (visiting.has(k)) throw new Error(`Referencia circular en ${k}`);
    visiting.add(k);
    let out: unknown;
    depth += 1;
    try {
      out = (parsers[depth] ??= new FormulaParser(options)).parse(cell.formula, { sheet, row, col });
    } catch (e) {
      throw new Error(`${k} = ${cell.formula}: ${e instanceof Error ? e.message : JSON.stringify(e)}`);
    } finally {
      depth -= 1;
    }
    visiting.delete(k);
    const value = normalize(out, k);
    cache.set(k, value);
    return value;
  };

  const options: ConstructorParameters<typeof FormulaParser>[0] = {
    onCell: ({ sheet, row, col }) => cellAt(sheet, row, col),
    onRange: ({ sheet, from, to }) => {
      const rows: unknown[][] = [];
      for (let r = from.row; r <= to.row; r++) {
        const line: unknown[] = [];
        for (let c = from.col; c <= to.col; c++) line.push(cellAt(sheet, r, c));
        rows.push(line);
      }
      return rows;
    },
    functions: EXTRA_FUNCTIONS,
  };

  for (const ws of wb.worksheets) {
    ws.eachRow({ includeEmpty: false }, (row, r) =>
      row.eachCell({ includeEmpty: false }, (cell, c) => {
        if (cell.formula) cellAt(ws.name, r, c);
      }),
    );
  }
  return cache;
}

function normalize(out: unknown, where: string): CellValue {
  if (typeof out === "number" || typeof out === "string" || typeof out === "boolean") return out;
  if (out == null) return null;
  throw new Error(`${where} evaluó a un error de Excel: ${JSON.stringify(out)}`);
}

export function formulaMismatches(
  wb: ExcelJS.Workbook,
  { tolerance = 1e-7 }: { tolerance?: number } = {},
): { cell: string; formula: string; expected: CellValue; actual: CellValue }[] {
  const values = evaluateWorkbook(wb);
  const diffs: { cell: string; formula: string; expected: CellValue; actual: CellValue }[] = [];
  for (const ws of wb.worksheets) {
    ws.eachRow({ includeEmpty: false }, (row, r) =>
      row.eachCell({ includeEmpty: false }, (cell, c) => {
        if (!cell.formula) return;
        const k = key(ws.name, r, c);
        const expected = (cell.result ?? null) as CellValue;
        const actual = values.get(k) ?? null;
        const same =
          typeof expected === "number" && typeof actual === "number"
            ? Math.abs(expected - actual) <= tolerance * Math.max(1, Math.abs(expected))
            : expected === actual || (expected === "" && actual === null);
        if (!same) diffs.push({ cell: k, formula: cell.formula, expected, actual });
      }),
    );
  }
  return diffs;
}
