# Fase 38 — El informe de cada proceso · Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cada proceso exporta su informe en PDF y en un Excel con la forma de su cartera y fórmulas vivas que dan lo mismo que la app, desde su página de informe; fuera los informes consolidados y sus restos.

**Architecture:**
- **El Excel se arma con primitivas de celda** (`src/lib/export/cells.ts`): cada celda calculada recibe su fórmula y, como resultado guardado, el valor del motor. Los tres libros se reescriben sobre ellas con la forma de la cartera de su módulo.
- **Un ayudante de pruebas** (`src/lib/export/formula-check.ts`) evalúa todas las fórmulas de un libro con fast-formula-parser, recursivamente desde los datos crudos. Exige que cada una dé su resultado guardado: así se prueba que el Excel calcula como el motor.
- **La página de informe** concentra Exportar PDF y Exportar Excel. Los consolidados se borran de la interfaz, el código, la demo, el seed y la base; la tabla `reports` cae en una migración después del merge.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript, exceljs 4.4, fast-formula-parser 1.0.19 (solo pruebas), Supabase (Postgres, pgTAP), Vitest, Tailwind v4 con el sistema de diseño propio.

**Spec:** `docs/prds/37-informe-por-proceso.md` (Fase 38). Carteras de referencia en `docs/carteras/`.

## Global Constraints

- **Rama:** `fase-38-informe-por-proceso`, en la carpeta principal. El PRD ya está commiteado (`ff363be`).
- **Idioma y estilo:**
  - interfaz en español de Colombia, con tuteo en la app y usted en el manual;
  - commits en español con `feat:`, `fix:`, `refactor:` o `docs:`, terminados en `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`;
  - antes de cada commit, `git diff --cached --name-status`.
- **Cálculo:**
  - `src/lib/calculations/` es puro;
  - las tolerancias viven solo en `tolerances.ts` y el Excel las copia a un bloque de celdas;
  - **las reglas del Excel son las del motor**, no las de la cartera.
- **Redondeo:** donde el motor usa `Math.round(x·10ⁿ)/10ⁿ`, la fórmula usa `INT(x*10^n+0.5)/10^n`, que redondea igual. Excel `ROUND` redondea los medios negativos lejos de cero y no coincide. Lo arma `roundHalfUp` (Tarea 2).
- **Funciones de Excel permitidas:**
  - `SUM`, `SUMPRODUCT`, `SUMIF`, `COUNTIF`, `IF`, `AND`, `OR`, `ABS`, `SQRT`, `INT`, `MOD`, `MIN`, `MAX`;
  - `ROUND`, solo donde el valor no puede caer en un medio (el `k` de la suma teórica);
  - `RADIANS`, `SIN`, `COS`, `ATAN2`, `DAYS` y `SUBSTITUTE`;
  - nada de `LET`, `LAMBDA`, matrices dinámicas ni búsquedas (`LOOKUP` con matrices).
- **Formatos:**
  - coordenadas y distancias en m `0.000`; cotas `0.0000`; mm `0.0`; velocidad `0.00`; km `0.000`;
  - ángulos en G y M `0` y S `0.0`; decimales de grado `0.000000`.
- **Componentes:** sin shadcn ni librerías de componentes; `@/components/design-system`.
- **Migraciones:**
  - escritas a mano;
  - en local con `npx supabase migration up --local`, nunca `db reset` (la base local es compartida);
  - el `db push` a producción, con el visto bueno del usuario, después del merge.
- **Verificación:** `npm run typecheck` después de cada cambio de código, y la suite (`npm test`) al terminar cada tarea.

## Review Focus

- **Una vista intermedia después del último punto de cambio, y un punto de cambio con V− y V+ en la misma fila**: la AI se consume antes de generarse, y la intermedia no la cambia. Lo prueba El Verjón, que tiene `AUX1` como VI (Tarea 3).
- **La nivelación abierta con vuelta**: la corrección del circuito sigue en la vuelta desde donde terminó la ida, y la cota ajustada de un punto leído dos veces (`AUX 1` en la ida y `AUX1` en la vuelta) es su promedio. Lo prueba El Verjón (Tarea 3).
- **La cerrada con fila de cierre contra el amarre** (TT4): la suma teórica lleva el `+360·k` y el ángulo de orientación entra en la condición. Lo prueba la TT4 por los tres métodos (Tarea 4).
- **Un punto de asentamientos que se salta una visita**: su parcial y su velocidad se miden contra la última visita en que se midió, y su celda queda vacía en la que faltó. Lo prueba un caso construido en `settlement-workbook.test.ts` (Tarea 6).
- **Un parcial con medio negativo** (−2.45 mm antes de redondear): la fórmula redondea como el motor (−2.4), no como `ROUND` (−2.5). Lo prueba `cells.test.ts` (Tarea 2).

---

### Task 1: El ayudante que evalúa las fórmulas de un libro

**Files:**
- Modify: `package.json` (devDependency `fast-formula-parser@^1.0.19`)
- Create: `src/types/fast-formula-parser.d.ts`
- Create: `src/lib/export/formula-check.ts`
- Test: `src/lib/export/formula-check.test.ts`

**Interfaces:**
- Produces:
  - `evaluateWorkbook(wb: ExcelJS.Workbook, overrides?: Record<string, CellValue>): Map<string, CellValue>`. Evalúa todas las celdas con fórmula; la clave es `'Hoja'!A1`. `overrides` reemplaza datos crudos antes de evaluar.
  - `formulaMismatches(wb, { tolerance? }): { cell: string; formula: string; expected: CellValue; actual: CellValue }[]`. Lista las fórmulas cuyo valor no es su resultado guardado.
  - `type CellValue = number | string | boolean | null`.

- [ ] **Step 1: Instalar la dependencia de pruebas**

```bash
npm install --save-dev fast-formula-parser@^1.0.19
```

El paquete no trae tipos. Crear `src/types/fast-formula-parser.d.ts`:

```ts
declare module "fast-formula-parser" {
  interface CellRef { sheet: string; row: number; col: number }
  interface RangeRef { sheet: string; from: { row: number; col: number }; to: { row: number; col: number } }
  interface Options {
    onCell?: (ref: CellRef) => unknown;
    onRange?: (ref: RangeRef) => unknown[][];
    functions?: Record<string, (...args: unknown[]) => unknown>;
  }
  export default class FormulaParser {
    constructor(options?: Options);
    parse(formula: string, position: CellRef, allowReturnArray?: boolean): unknown;
  }
  export const FormulaHelpers: { accept(value: unknown, type?: number): unknown };
  export const Types: Record<string, number>;
  export class FormulaError { error: string }
}
```

- [ ] **Step 2: Escribir la prueba que falla**

`src/lib/export/formula-check.test.ts`:

```ts
import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { evaluateWorkbook, formulaMismatches } from "./formula-check";

function libro() {
  const wb = new ExcelJS.Workbook();
  const a = wb.addWorksheet("Datos");
  const b = wb.addWorksheet("Cotas ajustadas");
  a.getCell("A1").value = 1.5;
  a.getCell("A2").value = 2.25;
  a.getCell("A3").value = { formula: "A1+A2", result: 3.75 };
  a.getCell("A4").value = { formula: "MOD(A3*100,360)", result: 15 };
  a.getCell("A5").value = { formula: "SUMPRODUCT(A1:A2,A1:A2)", result: 7.3125 };
  a.getCell("A6").value = { formula: 'IF(A3>3,"CUMPLE","NO CUMPLE")', result: "CUMPLE" };
  a.getCell("A7").value = new Date(Date.UTC(2022, 2, 31));
  a.getCell("A8").value = new Date(Date.UTC(2022, 2, 24));
  a.getCell("A9").value = { formula: "DAYS(A7,A8)", result: 7 };
  a.getCell("B1").value = "AUX 1";
  a.getCell("B2").value = { formula: 'SUBSTITUTE(B1," ","")', result: "AUX1" };
  b.getCell("A1").value = { formula: "Datos!A3*2", result: 7.5 };
  b.getCell("A2").value = { formula: "'Cotas ajustadas'!A1+COS(RADIANS(60))", result: 8 };
  return wb;
}

describe("formula-check", () => {
  it("evalúa fórmulas encadenadas, de otra hoja, con texto y con fechas", () => {
    const values = evaluateWorkbook(libro());
    expect(values.get("'Datos'!A3")).toBeCloseTo(3.75, 12);
    expect(values.get("'Datos'!A6")).toBe("CUMPLE");
    expect(values.get("'Datos'!A9")).toBe(7);
    expect(values.get("'Datos'!B2")).toBe("AUX1");
    expect(values.get("'Cotas ajustadas'!A2")).toBeCloseTo(8, 12);
  });

  it("un libro coherente no tiene diferencias", () => {
    expect(formulaMismatches(libro())).toEqual([]);
  });

  it("señala la fórmula cuyo resultado guardado no es el que calcula", () => {
    const wb = libro();
    wb.getWorksheet("Datos")!.getCell("A3").value = { formula: "A1+A2", result: 4 };
    const diffs = formulaMismatches(wb);
    expect(diffs.map((d) => d.cell)).toContain("'Datos'!A3");
  });

  it("evalúa desde los datos crudos: cambiar un dato recalcula toda la cadena", () => {
    const values = evaluateWorkbook(libro(), { "'Datos'!A1": 10 });
    expect(values.get("'Datos'!A3")).toBeCloseTo(12.25, 12);
    expect(values.get("'Cotas ajustadas'!A1")).toBeCloseTo(24.5, 12);
  });
});
```

- [ ] **Step 3: Correr la prueba**

Run: `npx vitest run src/lib/export/formula-check.test.ts`
Expected: FAIL con «Failed to resolve import "./formula-check"».

- [ ] **Step 4: Implementar el ayudante**

`src/lib/export/formula-check.ts`:

```ts
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
};

function valueOf(arg: unknown): unknown {
  return typeof arg === "object" && arg !== null && "value" in arg ? (arg as { value: unknown }).value : arg;
}

export function evaluateWorkbook(
  wb: ExcelJS.Workbook,
  overrides: Record<string, CellValue> = {},
): Map<string, CellValue> {
  const cache = new Map<string, CellValue>();
  const visiting = new Set<string>();

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
    const out = parser.parse(cell.formula, { sheet, row, col });
    visiting.delete(k);
    const value = normalize(out, k);
    cache.set(k, value);
    return value;
  };

  const parser = new FormulaParser({
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
  });

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
```

- [ ] **Step 5: Correr la prueba**

Run: `npx vitest run src/lib/export/formula-check.test.ts`
Expected: PASS, 4 pruebas. Si fast-formula-parser no entiende una función de la lista de Global Constraints, se agrega a `EXTRA_FUNCTIONS` con su caso en la prueba, y se anota un `Ruling:` en el registro de avance.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json src/types/fast-formula-parser.d.ts src/lib/export/formula-check.ts src/lib/export/formula-check.test.ts
git commit -m "feat: un ayudante de pruebas que evalúa las fórmulas de un libro de Excel"
```

---

### Task 2: Primitivas de celda, colores y el bloque de tolerancias

**Files:**
- Create: `src/lib/export/cells.ts`
- Test: `src/lib/export/cells.test.ts`
- Modify: `src/lib/export/workbook.ts` (los colores nuevos de `WORKBOOK_COLORS`; `fullCalcOnLoad` en `newWorkbook`)
- Modify: `src/lib/export/workbook-colors.test.ts` (los tokens nuevos)

**Interfaces:**
- Consumes: `evaluateWorkbook`, `formulaMismatches` (Tarea 1).
- Produces:
  - `col(n: number): string`; `at(c: number, r: number): string` («C5»); `ref(sheet: string, a: string): string` («'Hoja'!C5»).
  - `putData(ws, c, r, value: number | string | Date | null, fmt?: string): string`: dato medido o tecleado, con el estilo de dato. Devuelve la dirección.
  - `putFormula(ws, c, r, formula: string, result: number | string | null, fmt?: string): string`: fórmula sin `=` y resultado guardado.
  - `putLabel(ws, c, r, text: string, style?: "title" | "section" | "header" | "label"): void`.
  - `roundHalfUp(expr: string, decimals: number): string`: `INT((expr)*10^d+0.5)/10^d`.
  - `writeSheetHeader(ws, title: string, pairs: [string, string | number | null][]): number`: título, pares y fila siguiente libre.
  - `writeLevelingTolerances(ws, c, r): Record<PrecisionOrder, string>`: K por orden en mm/√km; la dirección de cada K.
  - `writePolygonalTolerances(ws, c, r): Record<PrecisionOrder, { angularK: string; minPrecision: string }>`.
  - `verdictFormatting(ws, range: string): void`: formato condicional («CUMPLE» en verde, «NO CUMPLE» en rojo).
  - `setLayout(ws, { frozenRows: number; widths: number[] }): void`: paneles inmovilizados hasta la fila de rótulos, anchos de columna y A4 apaisado ajustado al ancho. La usan los tres libros.
  - `FMT = { coord: "0.000", elev: "0.0000", mm: "0.0", rate: "0.00", km: "0.000", deg: "0", min: "0", sec: "0.0", dec: "0.000000", ratio: "#,##0" }`.
  - `ORDER_NAME: Record<PrecisionOrder, string>`: el rótulo de `PRECISION_ORDER_LABELS`.

- [ ] **Step 1: Escribir la prueba que falla**

`src/lib/export/cells.test.ts`:

```ts
import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { ANGULAR_TOLERANCE_K, LEVELING_TOLERANCE_K, MIN_RELATIVE_PRECISION } from "@/lib/calculations/tolerances";
import { PRECISION_ORDERS } from "@/types/project";
import { at, col, putData, putFormula, ref, roundHalfUp, writeLevelingTolerances, writePolygonalTolerances } from "./cells";
import { evaluateWorkbook, formulaMismatches } from "./formula-check";

describe("primitivas de celda", () => {
  it("nombra columnas y celdas como Excel", () => {
    expect([col(1), col(26), col(27), col(52)]).toEqual(["A", "Z", "AA", "AZ"]);
    expect(at(3, 5)).toBe("C5");
    expect(ref("Cotas ajustadas", "B4")).toBe("'Cotas ajustadas'!B4");
  });

  it("una fórmula lleva su resultado guardado y un dato su estilo", () => {
    const ws = new ExcelJS.Workbook().addWorksheet("H");
    putData(ws, 1, 1, 1.2345, "0.0000");
    putFormula(ws, 1, 2, "A1*2", 2.469, "0.0000");
    expect(ws.getCell("A2").formula).toBe("A1*2");
    expect(ws.getCell("A2").result).toBe(2.469);
    expect(ws.getCell("A1").numFmt).toBe("0.0000");
  });

  it("roundHalfUp redondea los medios como Math.round, también los negativos", () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("H");
    const casos = [-2.45, -2.449999, 2.45, -0.05, 12.35];
    casos.forEach((x, i) => {
      putData(ws, 1, i + 1, x);
      putFormula(ws, 2, i + 1, roundHalfUp(`A${i + 1}`, 1), Math.round(x * 10) / 10);
    });
    expect(formulaMismatches(wb)).toEqual([]);
    const v = evaluateWorkbook(wb);
    expect(v.get("'H'!B1")).toBeCloseTo(-2.4, 12);
  });

  it("los bloques de tolerancias copian tolerances.ts", () => {
    const ws = new ExcelJS.Workbook().addWorksheet("H");
    const lev = writeLevelingTolerances(ws, 10, 2);
    const pol = writePolygonalTolerances(ws, 14, 2);
    for (const o of PRECISION_ORDERS) {
      expect(ws.getCell(lev[o]).value).toBe(LEVELING_TOLERANCE_K[o]);
      expect(ws.getCell(pol[o].angularK).value).toBe(ANGULAR_TOLERANCE_K[o]);
      expect(ws.getCell(pol[o].minPrecision).value).toBe(MIN_RELATIVE_PRECISION[o]);
    }
  });
});
```

- [ ] **Step 2: Correr la prueba**

Run: `npx vitest run src/lib/export/cells.test.ts`
Expected: FAIL con «Failed to resolve import "./cells"».

- [ ] **Step 3: Implementar**

En `workbook.ts`, agregar a `WORKBOOK_COLORS` los tokens del tema claro:

```ts
  /** `--color-mira-bg`: relleno de los datos medidos o tecleados. */
  miraBg: "FFFBF1D3",
  /** `--color-mira-ink`: tinta de los datos medidos o tecleados. */
  miraInk: "FF6B5100",
  /** `--color-success`: «CUMPLE». */
  success: "FF2C7866",
  /** `--color-danger`: «NO CUMPLE». */
  danger: "FFC0392B",
```

En `newWorkbook`, después de `wb.created`: `wb.calcProperties.fullCalcOnLoad = true;`. En `workbook-colors.test.ts`, agregar a `it.each` las filas `["miraBg", "mira-bg"]`, `["miraInk", "mira-ink"]`, `["success", "success"]` y `["danger", "danger"]`.

`src/lib/export/cells.ts`:

```ts
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
```

- [ ] **Step 4: Correr las pruebas**

Run: `npx vitest run src/lib/export/cells.test.ts src/lib/export/workbook-colors.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/export/cells.ts src/lib/export/cells.test.ts src/lib/export/workbook.ts src/lib/export/workbook-colors.test.ts
git commit -m "feat: primitivas de celda con fórmula y resultado del motor para los Excel"
```

---

### Task 3: El Excel de la nivelación, con la forma de El Verjón

**Files:**
- Rewrite: `src/lib/export/leveling-workbook.ts`
- Rewrite: `src/lib/export/leveling-workbook.test.ts`
- Modify: `src/app/(app)/projects/[id]/leveling/[pid]/export/route.ts`
- Delete: `src/lib/reports/adopted.ts` y su uso, si después de esta tarea ya no lo importa nadie. Hoy solo lo usa este libro.

**Interfaces:**
- Consumes: Tareas 1 y 2; `computeLevelingDetected`, `levelingInputOf`, `levelingDraftOf`, `knownBmsOf`, `adoptedElevations`, `resolveVisualDistances`, `distanceFromWires` (`src/lib/calculations/leveling.ts`).
- Produces:

```ts
export interface LevelingSheetProcess {
  name: string;
  type: LevelingType;
  startBmCode: string;
  endBmCode: string | null;
  equipment: string | null;        // equipmentLine(brand, model, serial)
  levelType: string | null;        // LEVEL_TYPE_LABELS[level_type]
  notes: string | null;
}
export function buildLevelingWorkbook(args: {
  process: LevelingSheetProcess;
  project: ProjectMetadata | null;
  input: Omit<LevelingInput, "order" | "compensation">;
  detected: ReturnType<typeof computeLevelingDetected>;
}): ExcelJS.Workbook;
```

**Forma** (PRD § C):

- **Hoja «Nivelación»** (ida) y, si `input.return` tiene filas, **«Contranivelación»** (vuelta), con la misma forma.
  - **Encabezado** (`writeSheetHeader`): Proyecto, Proceso, Tipo (`levelingTypeLabel`), Equipo, Tipo de nivel, BM de partida y su cota, BM de llegada y su cota.
  - **Columnas**, desde la columna A:

    | Col | Rótulo | Contenido |
    |---|---|---|
    | A | PUNTO | código (dato) |
    | B | TIPO | «BM», «PC» o «VI» (`POINT_TYPE_LABELS` corto) |
    | C | V+ | lectura (dato) |
    | D | AI | fórmula |
    | E | V− | lectura (dato) |
    | F | VI | lectura (dato) |
    | G | COTA | fórmula; en la fila de partida, la cota del BM (dato) |
    | H | DIST. V+ (m) | dato, o fórmula de hilos |
    | I | DIST. V− (m) | dato, o fórmula de hilos |
    | J | ACUM. (km) | fórmula |
    | K | CORRECCIÓN (m) | fórmula; solo si se compensó |
    | L | COTA AJUSTADA | fórmula; solo si se compensó |
    | M | CLAVE | `SUBSTITUTE(A{r}," ","")`, para emparejar códigos («AUX 1» y «AUX1») |

  - **Hilos.** Si alguna lectura del recorrido tiene hilos, cada fila de lectura ocupa tres filas de hoja: superior, medio (la fila principal, con punto, AI, cota y acumulado) e inferior. Los hilos de V+ van en C y los de V− (o VI) en E/F, como El Verjón. En la fila media, la distancia de una visual con par completo y superior > inferior es `(Csup−Cinf)*100`. Sin par completo es el dato tecleado (`resolveVisualDistances`). Sin hilos en todo el recorrido, una fila de hoja por lectura.
- **Fórmulas** (r = fila principal de la lectura i; p = fila principal de la lectura bm/pc anterior; s = fila de partida):
  - Partida (i = 0): `G{s}` = dato `input.startElevation` (en la vuelta, el `returnStart` del motor: la cota conocida o, en la abierta, la final de la ida, como fórmula `'Nivelación'!G{última bm/pc}`). `D{s}` = `G{s}+C{s}`.
  - Fila con V− (bm/pc): `G{r}` = `D{p}-E{r}`. Si la fila tiene V+: `D{r}` = `G{r}+C{r}`.
  - Fila VI (intermedia): `G{r}` = `D{p}-F{r}`, sin AI propia.
  - Acumulado: bm/pc `J{r}` = `J{p}+(H{p}+I{r})/1000`; VI `J{r}` = `J{p}+H{p}/1000`. En la partida, `J{s}` = `I{s}/1000`, que suele ser 0.
  - Resultados guardados: `instrumentHeight`, `elevationCalculated` y `distanceAccumulatedKm` de `detected.result.{forward|return}.readings[i]`.
- **Bloque de cierre** (debajo de la tabla de la ida; en la vuelta, el suyo):
  - **Distancia (km):** `=J{última}`.
  - **Cota calculada de llegada:** `=G{última bm/pc}`.
  - **Cota conocida:**
    - en `closed`, un dato igual a la partida;
    - en `link`, un dato con `input.endElevation`;
    - en `open`, sin cota conocida.
  - **Error de cierre (mm):** `=(cota calculada − cota conocida)*1000`, con el resultado `result.closureErrorMm`. En la vuelta va `result.return.errorMm`.
  - **Abierta con vuelta:**
    - Desnivel de la ida: `=G{fin ida}-G{s ida}`; desnivel de la vuelta, igual.
    - Discrepancia (mm): `=ABS(Δida+Δvuelta)*1000`.
    - Cierre del circuito (mm): `=(Δida+Δvuelta)*1000` (`circuitClosureMm`).
    - Km del par: `=MIN(km ida, km vuelta)`.
  - **Tolerancias** (`writeLevelingTolerances` en la columna O): una fila por orden con `=K*SQRT(km)` (en la abierta con vuelta, `=K*SQRT(km par)*SQRT(2)`).
  - **Orden alcanzado:** `IF` encadenados del primero al ordinario, con la regla de `detectLevelingOrder`, comparando `ABS(e)<=tol+0.000001`. En cerrada o de enlace con vuelta, `AND` de ida y vuelta. Si ninguno: «Ninguno». Sin verificación (abierta sin vuelta, sin distancias, `pending` o `broken`): el texto «Sin verificación» como dato, no fórmula. Resultado guardado: `PRECISION_ORDER_LABELS[detected.order]` o «Ninguno».
  - **Veredicto:** `=IF(orden="Ninguno","NO CUMPLE","CUMPLE")`, con `verdictFormatting`.
- **Corrección** (solo si `detected.result.compensated`):
  - En `closed`/`link`, `K{r}` = `-(E_mm/1000)*J{r}/km`, con E y km de su propio recorrido.
  - En la abierta con vuelta, sobre el circuito: ida `-(Ecirc/1000)*J{r}/(km ida+km vuelta)`; vuelta `-(Ecirc/1000)*(km ida+J{r})/(km ida+km vuelta)`.
  - `L{r}` = `G{r}+K{r}`. Resultados guardados: `correctionApplied` y `elevationCorrected`.
- **Hoja «Cotas ajustadas»** (solo si se compensó):
  - una fila por punto en el orden de `adoptedElevations(...)`, con Punto, Lecturas y Cota ajustada;
  - un punto conocido (`knownBmsOf`) lleva su cota como dato;
  - los demás, `=(SUMIF('Nivelación'!M:M,clave,'Nivelación'!L:L)+SUMIF('Contranivelación'!M:M,clave,'Contranivelación'!L:L))/(COUNTIF('Nivelación'!M:M,clave)+COUNTIF('Contranivelación'!M:M,clave))`, sin la vuelta si no la hay;
  - la clave en la hoja es `SUBSTITUTE(punto," ","")`; no hace falta `UPPER`, porque `SUMIF` y `COUNTIF` no distinguen mayúsculas.
- **Hoja «Resumen»**: Proyecto (`projectPairs`), equipo, notas y la nota «Las celdas con fondo amarillo son datos medidos o tecleados; el resto se calcula con fórmulas».
- **Diseño**: `setLayout(ws, { frozenRows: filaDeRótulos, widths: [12, 6, 10, 10, 10, 10, 10, 10, 10, 12, 12, 12, 8] })`.

- [ ] **Step 1: Escribir la prueba que falla**

`src/lib/export/leveling-workbook.test.ts`, reescrita entera. El ayudante arma la entrada con la misma conversión que `fixtures.test.ts` (copiar su `lectura`):

```ts
import { describe, expect, it } from "vitest";
import { computeLevelingDetected } from "@/lib/calculations/leveling";
import { NIVELACION_VERJON, nivelacionTramo2, type NivelacionDemo } from "@/lib/demo/fixtures";
import type { ReadingInput } from "@/types/leveling";
import { evaluateWorkbook, formulaMismatches } from "./formula-check";
import { buildLevelingWorkbook } from "./leveling-workbook";

const lectura = (r: NivelacionDemo["forward"][number]): ReadingInput => ({
  pointCode: r.code, pointType: r.type, backsight: r.back ?? null, foresight: r.fore ?? null,
  backUpperM: r.backUpperM ?? null, backLowerM: r.backLowerM ?? null,
  foreUpperM: r.foreUpperM ?? null, foreLowerM: r.foreLowerM ?? null,
  backDistanceM: r.backDistanceM ?? null, foreDistanceM: r.foreDistanceM ?? null,
  distanceAccumulatedKm: null,
});

function libro(n: NivelacionDemo, sinVuelta = false) {
  const input = {
    type: n.type, startElevation: n.startElevation, endElevation: n.endElevation ?? null,
    forward: n.forward.map(lectura), return: sinVuelta || !n.return ? null : n.return.map(lectura),
  };
  const detected = computeLevelingDetected(input);
  const wb = buildLevelingWorkbook({
    process: { name: n.name, type: n.type, startBmCode: n.startBmCode, endBmCode: n.endBmCode ?? null,
      equipment: null, levelType: null, notes: null },
    project: null, input, detected,
  });
  return { wb, detected };
}

describe("Excel de la nivelación — fórmulas contra el motor", () => {
  it.each([
    ["El Verjón, abierta con vuelta y con hilos", () => libro(NIVELACION_VERJON)],
    ["el tramo 2, cerrada", () => libro(nivelacionTramo2())],
    ["El Verjón sin vuelta: abierta sin verificación", () => libro(NIVELACION_VERJON, true)],
  ])("%s: toda fórmula da el valor del motor", (_, make) => {
    expect(formulaMismatches(make().wb)).toEqual([]);
  });

  it("las hojas de El Verjón: ida, vuelta, cotas ajustadas y resumen", () => {
    expect(libro(NIVELACION_VERJON).wb.worksheets.map((w) => w.name)).toEqual([
      "Nivelación", "Contranivelación", "Cotas ajustadas", "Resumen",
    ]);
  });

  it("el orden alcanzado de El Verjón es el que detecta la app", () => {
    const { wb, detected } = libro(NIVELACION_VERJON);
    const values = evaluateWorkbook(wb);
    const orden = [...values.entries()].find(([k, v]) => k.startsWith("'Nivelación'") && v === "Segundo orden");
    expect(detected.order).toBe("segundo_orden");
    expect(orden).toBeDefined();
  });

  it("cambiar una V− en el Excel recalcula las cotas que siguen", () => {
    const { wb } = libro(nivelacionTramo2());
    const ws = wb.getWorksheet("Nivelación")!;
    let fila = 0;
    ws.eachRow((row, r) => { if (!fila && typeof row.getCell(5).value === "number") fila = r; });
    const antes = evaluateWorkbook(wb);
    const despues = evaluateWorkbook(wb, { [`'Nivelación'!E${fila}`]: (ws.getCell(`E${fila}`).value as number) + 0.01 });
    expect(despues.get(`'Nivelación'!G${fila}`)).toBeCloseTo((antes.get(`'Nivelación'!G${fila}`) as number) - 0.01, 9);
  });
});
```

- [ ] **Step 2: Correr la prueba**

Run: `npx vitest run src/lib/export/leveling-workbook.test.ts`
Expected: FAIL, porque `buildLevelingWorkbook` aún tiene la firma vieja (error de tipos o de forma).

- [ ] **Step 3: Implementar `leveling-workbook.ts`** con la forma y las fórmulas de arriba, sobre `cells.ts`.
  - Una función `writeRun(ws, rows, computed, start: { elevation: number | string })` escribe una hoja de recorrido y devuelve las direcciones que usa el cierre: primera y última fila, última bm/pc y columna de cada magnitud.
  - Otra, `writeClosure(...)`, escribe el bloque de cierre.
  - `sheetAdjusted` y `sheetSummary`, como arriba.
  - Los resultados guardados salen de `detected.result`; ninguna cifra se recalcula en TypeScript fuera del motor.
- [ ] **Step 4: Correr la prueba**

Run: `npx vitest run src/lib/export/leveling-workbook.test.ts`
Expected: PASS, 6 pruebas. Si `formulaMismatches` lista celdas, la fórmula no sigue al motor en esa fila: se corrige la fórmula, nunca el resultado guardado.

- [ ] **Step 5: La ruta**. En `leveling/[pid]/export/route.ts`:
  - `const draft = levelingDraftOf(process, readings); const input = levelingInputOf(draft); const detected = computeLevelingDetected(input);`
  - `buildLevelingWorkbook({ process: { name, type, startBmCode: process.start_bm_code, endBmCode: process.end_bm_code, equipment: equipmentLine(...), levelType: process.level_type ? LEVEL_TYPE_LABELS[process.level_type] : null, notes: process.notes }, project, input, detected })`.

  Luego `npm run typecheck`. Si `src/lib/reports/adopted.ts` queda sin usuarios (`grep -rn "reports/adopted" src`), se borra con su prueba.

- [ ] **Step 6: Commit**

```bash
git add -A src/lib/export/leveling-workbook.ts src/lib/export/leveling-workbook.test.ts "src/app/(app)/projects/[id]/leveling/[pid]/export/route.ts" src/lib/reports
git commit -m "feat: el Excel de la nivelación con la forma de El Verjón y fórmulas vivas"
```

---

### Task 4: El Excel de la poligonal, con la forma de `poligonales.xlsx`

**Files:**
- Rewrite: `src/lib/export/polygonal-workbook.ts` (sin mínimos cuadrados, que es la Tarea 5)
- Rewrite: `src/lib/export/polygonal-workbook.test.ts`
- Modify: `src/app/(app)/projects/[id]/polygonal/[pid]/export/route.ts`

**Interfaces:**
- Consumes: Tareas 1 y 2; `computePolygonalDetected`, `draftOf`, `inputOf` (`src/components/polygonal/polygonal-save.ts`); `resultadosDe` (`src/lib/demo/insertar-poligonal.ts`) para las pruebas.
- Produces:

```ts
export interface PolygonalSheetProcess {
  name: string;
  type: PolygonalType;
  method: CorrectionMethod;
  startPointCode: string;
  equipment: string | null;
  georeference: { rotationDeg: number; translationN: number; translationE: number; scale: number } | null;
  notes: string | null;
}
export function buildPolygonalWorkbook(args: {
  process: PolygonalSheetProcess;
  project: ProjectMetadata | null;
  input: PolygonalInput;                          // con order y angleType detectados
  detected: ReturnType<typeof computePolygonalDetected>;
}): ExcelJS.Workbook;
```

**Forma** (PRD § D). Hoja con el nombre del método: «BRÚJULA», «TRÁNSITO», «CRANDALL» o «MÍNIMOS CUADRADOS». Las abiertas sin control se llaman «ABIERTA SIN CONTROL», porque no reparten. Columnas (fila de rótulos doble, como la cartera: grupo arriba, unidad abajo):

| Col | Grupo / unidad | Contenido |
|---|---|---|
| A | DELTA | estación anterior (texto) |
| B | PUNTO | código |
| C, D, E | ÁNG. HOR. G · M · S | dato: los tres campos guardados (`decimalToDms(station.angle)`); en la abierta con control, la deflexión y en F la dirección D/I |
| F | ÁNG. HOR. DEC | `=C+D/60+E/3600` |
| G | CORR. DEC | fórmula: la corrección por ángulo (cerrada) o por deflexión (abierta con control); vacía donde el motor no corrige |
| H, I, J | ÁNG. CORREGIDO G · M · S | `=INT(K)`, `=INT((K-H)*60)`, `=((K-H)*60-I)*60` |
| K | ÁNG. CORREGIDO DEC | `=F+G` (cerrada; en la abierta con control la deflexión con signo: `=IF(dir="I",-1,1)*F+G`) |
| L, M, N | AZIMUT G · M · S | como H–J sobre O |
| O | AZIMUT DEC | la cadena del motor (abajo) |
| P | DIST. (m) | dato |
| Q, R | PROYECCIONES N-S · E-W | `=P*COS(RADIANS(O))`, `=P*SIN(RADIANS(O))` |
| S, T | CORRECCIÓN N · E | según el método (abajo) |
| U, V | PROY. CORREGIDAS N · E | `=Q+S`, `=R+T` |
| W, X | COORDENADAS N · E | la primera, dato `startNorth/startEast`; las demás `=W{r-1}+U{r-1}` |

**Cadena de azimuts** (de `computeClosed`, `computeOpenControlled` y `computeOpenUncontrolled`):
- **Primer lado:**
  - con `hasOrientation`, `=MOD(az amarre + K{1},360)`, con el azimut del amarre como dato en DMS (`startAzimuth`) en la fila de partida;
  - sin orientación, el dato `startAzimuth`.
- **Siguientes:**
  - cerrada y abierta sin control, `=MOD(O{r-1}+180+K{r},360)` (la sin control usa F, sin corrección);
  - abierta con control, `=MOD(O{r-1}+K{r},360)`.
- **Solo las filas de lado** llevan distancia y proyecciones: en la cerrada, `sideCount = hasOrientation ? n-1 : n`; en las abiertas, `n-1`.

**Cierre angular** (cerrada), en un bloque a la derecha (columna Z):
- n ángulos de condición = `angularConditionCount`; Σ observada `=SUM(F{first}:F{last})`, sin la fila 0 si hay orientación sin fila de cierre.
- Suma teórica: `(v−2)·180` interior o `(v+2)·180` exterior (`detected.angleType` como dato). Con orientación y fila de cierre, más `360*IF(ROUND((Σ−base)/360,0)=0,0,1)`.
- Error (″): `=(Σ−teórica)*3600`. Corrección por ángulo: `=-(Σ−teórica)/n`, a la que apunta cada G.

**Abierta con control:**
- azimut calculado de llegada: la cadena con las deflexiones crudas, desde el primer lado;
- error (°): `=MOD(azcalc−azllegada+540,360)−180`; error (″) `=…*3600`;
- corrección por deflexión `=-error°/(n−1)`. Sin azimut de llegada o sin la deflexión de cierre, sin cierre angular (G vacía).

**Cierre lineal:**
- eN, eE:
  - cerrada: `=SUM(Q)`, `=SUM(R)`;
  - abierta con control: `=W{fin sin corregir}−endNorth`, con una columna auxiliar Y/Z de coordenadas sin corregir;
- `=SQRT(eN^2+eE^2)`; perímetro `=SUM(P)`;
- precisión: `=IF(error>1E-9, perímetro/error, "∞")`. El resultado guardado es `relativePrecision`, o «∞» si es `Infinity`.

**Correcciones por método** (de `correctDeltas`), con E = el error del cierre lineal:
- **Brújula:** `S=-eN*P/perímetro`, `T=-eE*P/perímetro`.
- **Tránsito:** `S=-eN*ABS(Q)/SUMPRODUCT(ABS(Q))`, igual en E. La cartera escribe una columna auxiliar con los valores absolutos; aquí, con `SUMPRODUCT(ABS(rango))`.
- **Crandall**, en el bloque Z:
  - `a11=SUMPRODUCT(P,COS(RADIANS(O))^2)`, `a12=SUMPRODUCT(P,COS(RADIANS(O)),SIN(RADIANS(O)))`, `a22=SUMPRODUCT(P,SIN(RADIANS(O))^2)`;
  - `det=a11*a22-a12^2`, `λ1=(a22*-eN-a12*-eE)/det`, `λ2=(-a12*-eN+a11*-eE)/det`;
  - por fila, la columna auxiliar `δd=P*(λ1*COS(RADIANS(O))+λ2*SIN(RADIANS(O)))`, con `S=δd*COS(RADIANS(O))` y `T=δd*SIN(RADIANS(O))`.

**Orden** (`detectPrecisionOrder`), en el bloque de tolerancias (`writePolygonalTolerances`):
- por orden, `angOk=ABS(e″)<=K*SQRT(n)+1E-9` (TRUE sin condición angular) y `linOk=precisión>=mínimo`;
- orden alcanzado: `IF` encadenados del primero al ordinario; «Ninguno» si no alcanza. La abierta sin control dice «Sin verificación» como dato;
- veredicto con `verdictFormatting`.

**Georreferenciada:** un bloque «Georreferenciación» con rotación, traslación y escala como **datos** (`process.georeference`). La poligonal se calcula con fórmulas sobre la partida ya transformada (`input`, que es la georreferenciada que usa el motor).

**Diseño:** `setLayout` con los rótulos dobles inmovilizados; anchos A–B 10, G–M S 8, decimales 12, coordenadas 14.

**Resultados guardados:** los de `detected.result` (`stations[i].azimuth`, `deltaNorth`, `correctedDeltaNorth`, `north`…, `angularError`, `linearError`, `relativePrecision`) y la corrección por ángulo, `−angularError/3600/n`.

- [ ] **Step 1: Escribir la prueba que falla** (`polygonal-workbook.test.ts`, reescrita):

```ts
import { describe, expect, it } from "vitest";
import { PROCESOS_DEMO, type ProcesoDemo } from "@/lib/demo/fixtures";
import { resultadosDe } from "@/lib/demo/insertar-poligonal";
import { evaluateWorkbook, formulaMismatches } from "./formula-check";
import { buildPolygonalWorkbook } from "./polygonal-workbook";

const TT4 = PROCESOS_DEMO.find((p) => p.name.startsWith("Poligonal V10"))!;

function libro(p: ProcesoDemo, method = p.correctionMethod ?? "bowditch") {
  const proceso = { ...p, correctionMethod: method };
  const { resultado, input, order, angleType } = resultadosDe(proceso);
  return buildPolygonalWorkbook({
    process: { name: p.name, type: p.type, method, startPointCode: p.startPointCode, equipment: null,
      georeference: null, notes: null },
    project: null,
    input: { ...input, order: order ?? "ordinario", angleType },
    detected: { result: resultado, order, angleType },
  });
}

describe("Excel de la poligonal — fórmulas contra el motor", () => {
  it.each(["bowditch", "transit", "crandall"] as const)("la TT4 por %s", (m) => {
    expect(formulaMismatches(libro(TT4, m))).toEqual([]);
  });

  it("la hoja lleva el nombre del método", () => {
    expect(libro(TT4, "crandall").worksheets[0]!.name).toBe("CRANDALL");
  });

  it("cambiar una distancia recalcula las coordenadas", () => {
    const wb = libro(TT4, "bowditch");
    const ws = wb.worksheets[0]!;
    let fila = 0;
    ws.eachRow((row, r) => { if (!fila && typeof row.getCell(16).value === "number") fila = r; });
    const antes = evaluateWorkbook(wb);
    const despues = evaluateWorkbook(wb, { [`'BRÚJULA'!P${fila}`]: (ws.getCell(`P${fila}`).value as number) + 0.5 });
    expect(despues.get(`'BRÚJULA'!W${fila + 1}`)).not.toBeCloseTo(antes.get(`'BRÚJULA'!W${fila + 1}`) as number, 6);
  });
});
```

`resultadosDe` hoy no devuelve el `input` ni el orden. Se amplía para devolver `{ resultado, input, order, angleType, campos }`, sin cambiar lo que ya devuelve (lo usan la demo y `fixtures.test.ts`).

Las dos abiertas van con una entrada sintética. Basta con que las fórmulas den lo del motor; no hace falta que cierre bien:

```ts
import { computePolygonalDetected } from "@/lib/calculations/polygonal";
import type { PolygonalInput } from "@/types/polygonal";

const abierta = (type: "open_controlled" | "open_uncontrolled"): Omit<PolygonalInput, "order" | "angleType"> => ({
  type, method: "bowditch", startNorth: 1000, startEast: 2000, startAzimuth: 45,
  endNorth: 1061.204, endEast: 2133.578, endAzimuth: 120.0042,
  hasOrientation: false, hasClosingRow: false, leastSquares: null,
  stations: [
    { pointCode: "A", angle: 0, deflectionDirection: null, distance: 50.123, readings: [] },
    { pointCode: "B", angle: type === "open_controlled" ? 30.5 : 210.5, deflectionDirection: "right", distance: 60.456, readings: [] },
    { pointCode: "C", angle: type === "open_controlled" ? 15.25 : 164.75, deflectionDirection: "left", distance: 40.789, readings: [] },
    { pointCode: "D", angle: 59.7539, deflectionDirection: "right", distance: null, readings: [] },
  ],
});

function libroDe(input: Omit<PolygonalInput, "order" | "angleType">) {
  const detected = computePolygonalDetected(input);
  return buildPolygonalWorkbook({
    process: { name: "Sintética", type: input.type, method: input.method, startPointCode: "A", equipment: null,
      georeference: { rotationDeg: 1.25, translationN: 10, translationE: -5, scale: 1.0001 }, notes: null },
    project: null,
    input: { ...input, order: detected.order ?? "ordinario", angleType: detected.angleType },
    detected,
  });
}

it.each(["open_controlled", "open_uncontrolled"] as const)("la abierta %s", (t) => {
  expect(formulaMismatches(libroDe(abierta(t)))).toEqual([]);
});

it("la georreferenciada lleva su bloque con rotación, traslación y escala como datos", () => {
  const ws = libroDe(abierta("open_controlled")).worksheets[0]!;
  const textos: string[] = [];
  ws.eachRow((row) => row.eachCell((c) => { if (typeof c.value === "string") textos.push(c.value); }));
  expect(textos).toEqual(expect.arrayContaining(["Georreferenciación", "Rotación (°)", "Escala"]));
});
```

- [ ] **Step 2: Correr la prueba** — `npx vitest run src/lib/export/polygonal-workbook.test.ts`. Expected: FAIL (la firma vieja).
- [ ] **Step 3: Implementar** el libro con la forma y las fórmulas de arriba. Una función por bloque: tabla, cierre angular, cierre lineal, correcciones, tolerancias y orden, y georreferenciación.
- [ ] **Step 4: Correr la prueba** — Expected: PASS. Una diferencia en `formulaMismatches` se corrige en la fórmula.
- [ ] **Step 5: La ruta**. En `polygonal/[pid]/export/route.ts`, con `input = inputOf(draftOf(process, stations), null)` y `detected = computePolygonalDetected(input)`, `buildPolygonalWorkbook({ process: {...}, project, input: { ...input, order: detected.order ?? "ordinario", angleType: detected.angleType }, detected })`. La georreferenciación sale de las columnas del proceso que hoy usa el libro viejo (`georef_*`). `npm run typecheck`.
- [ ] **Step 6: Commit** — `feat: el Excel de la poligonal con la forma de la cartera y fórmulas vivas`.

---

### Task 5: Mínimos cuadrados en el Excel de la poligonal

**Files:**
- Modify: `src/lib/calculations/least-squares.ts` (expone la última iteración)
- Modify: `src/types/polygonal.ts` (`LeastSquaresAdjustment` «adjusted» gana `matrices`)
- Modify: `src/lib/calculations/polygonal.ts` (pasa `matrices` al ajuste)
- Modify: `src/lib/export/polygonal-workbook.ts` (la hoja «MÍNIMOS CUADRADOS»)
- Test: `src/lib/calculations/least-squares.test.ts`, `src/lib/export/polygonal-workbook.test.ts`

**Interfaces:**
- Produces: `ConditionAdjustment.last: { A: number[][]; q: number[]; w: number[]; N: number[][]; k: number[] }`, y en `LeastSquaresAdjustment` «adjusted», `matrices: { A; q; w; N; k; observations: number[] }`. Las observaciones l₀ van en radianes y metros, en el orden del modelo.

- [ ] **Step 1: La prueba del motor** (en `least-squares.test.ts`, dentro del `describe` de la cartera Vivero, que ya tiene `fromCartera` y los pesos `HOJA`):

```ts
it("expone la última iteración: N = A·Q·Aᵀ y N·k = −w", () => {
  const result = computePolygonal({ ...fromCartera(CARTERA_VIVERO, "least_squares"), leastSquares: HOJA });
  const adj = result.adjustment;
  if (adj?.status !== "adjusted") throw new Error("la Vivero debe ajustar");
  const { A, q, w, N, k } = adj.matrices;
  for (let i = 0; i < N.length; i++) {
    for (let j = 0; j < N.length; j++) {
      expect(N[i]![j]!).toBeCloseTo(A[i]!.reduce((s, a, x) => s + a * q[x]! * A[j]![x]!, 0), 12);
    }
    expect(N[i]!.reduce((s, n, j) => s + n * k[j]!, 0)).toBeCloseTo(-w[i]!, 9);
  }
});
```

  Run `npx vitest run src/lib/calculations/least-squares.test.ts` → FAIL (`adj.matrices` indefinido). Implementar: guardar `{ A, q, w, N, k }` de la última vuelta del bucle en `adjustByConditions` y devolverlo como `last`. En `polygonal.ts`, donde se arma el `adjustment` «adjusted», agregar `matrices: { ...outcome.last, observations: model.observations }`. → PASS. La suite de cálculo entera, `npx vitest run src/lib/calculations`, sigue verde: ningún resultado cambia.

- [ ] **Step 2: La hoja.** Con `method: "least_squares"` y `adjustment.status === "adjusted"`:
  - la tabla de la Tarea 4, con G = la corrección angular del ajuste en grados, `angleCorrectionsSec/3600`, como dato;
  - la columna de distancia ajustada: `=P+v_d`, con `v_d` = `distanceCorrectionsM` como dato;
  - azimuts, proyecciones y coordenadas con fórmulas sobre los ángulos y distancias ajustados;
  - a la derecha, los bloques de la hoja de Vivero como **datos**: «Matriz A», «Q (diagonal)», «w», «N = A·Q·Aᵀ», «k», «v» y «σ₀», con un rótulo «Valores de la última iteración del ajuste (la app itera hasta converger)».

  Sin pesos o sin ajuste: la tabla con los ángulos crudos y una nota con el motivo (`missing_weights` o `unadjustable`).
- [ ] **Step 3: La prueba del libro**: la Vivero de la demo (`PROCESOS_DEMO` «Sede Vivero», `correctionMethod: "least_squares"`) con `formulaMismatches(...)` vacío, y que la hoja se llame «MÍNIMOS CUADRADOS».

  Run `npx vitest run src/lib/export/polygonal-workbook.test.ts` → PASS.
- [ ] **Step 4: Commit** — `feat: mínimos cuadrados en el Excel, con las matrices de la última iteración`.

---

### Task 6: El Excel de asentamientos, con la forma de la cartera real

**Files:**
- Rewrite: `src/lib/export/settlement-workbook.ts`
- Rewrite: `src/lib/export/settlement-workbook.test.ts`
- Modify: `src/app/(app)/projects/[id]/settlement/[siteId]/export/route.ts`

**Interfaces:**
- Consumes: Tareas 1 y 2; `computeBook`, `bookElevations`, `bookRowInputOf`, `bookRowOf`, `verifyingBenchmarks` (`settlement-book.ts`); `computeHistory`, `thresholdsOf`; `CARTERA_ASENTAMIENTOS`, `carteraBook`, `alamedaVisits`, `alamedaBook`, `ALAMEDA_POINTS` para las pruebas.
- Produces:

```ts
export interface SettlementSheetVisit {
  id: string; number: number; date: string; leveler: string | null; equipment: string | null; notes: string | null;
  rows: BookRowPayload[];                 // su libreta; [] en una visita de cotas tecleadas
}
export function buildSettlementWorkbook(args: {
  site: { name: string; location: string | null; structure: string | null };
  project: ProjectMetadata | null;
  points: (PointInput & { location: string | null })[];
  benchmarks: BenchmarkInput[];
  visits: SettlementSheetVisit[];       // en orden de fecha
  visitInputs: VisitInput[];            // las cotas de cada visita, como las lee computeHistory
  thresholds: Thresholds;
  history: ReturnType<typeof computeHistory>;
}): ExcelJS.Workbook;
```

**Hoja «Libretas»**, un bloque por visita, uno debajo de otro, con una fila en blanco entre bloques:
- **Título:** «Visita N · 24/03/2022», y debajo Nivelador, Equipo y Nota.
- **Columnas:**

  | Col | Rótulo | Contenido |
  |---|---|---|
  | A | PUNTO | código (dato) |
  | B | V+ | dato |
  | C | AI | fórmula |
  | D | V− | dato |
  | E | VI | dato |
  | F | COTA | fórmula; en el arranque de un tramo, la cota del BM del lugar como dato |
  | G | DIST. V+ (m) | dato |
  | H | DIST. V− (m) | dato |

- **Fórmulas:**
  - con p = última fila bm/pc del tramo: `C{arranque}=F+B`;
  - fila con V− (bm/pc): `F=C{p}-D`, y si lleva V+, `C=F+B`;
  - fila VI: `F=C{p}-E`;
  - cada tramo empieza de nuevo en su BM (`startsSection`), sin compensar, como `computeBook`;
  - resultados guardados: `computeBook(rows, benchmarks, visitId).readings[i]`. Una fila sin lectura (por leer) o con cadena rota (cota `NaN`) va sin fórmula y vacía.
- **Por tramo, una fila de verificación:**
  - en un tramo `closed` o `link` completo, «Cierre (mm)» `=INT((F{fin}-cota BM)*1000*10+0.5)/10`, como el `round1` del motor;
  - si tiene distancias, «Orden» con `IF` encadenados contra `writeLevelingTolerances` y `SUM` de sus distancias, en km;
  - si no tiene distancias, «Sin distancias»; un tramo `open` dice «Sin verificación». Los dos como dato.

**Hoja «Comparación»** (la «Diferencia observada» de la cartera):
- **Filas:** un punto de control por fila, con Punto, Ubicación y C0. La C0 es la tecleada (`initialElevation`) como dato o, sin ella, una fórmula que apunta a la COTA de su primera lectura.
- **Columnas:** por cada visita, un grupo de cinco: COTA · ACUM. (mm) · PARCIAL (mm) · VEL. (mm/mes) · SEMÁFORO. Arriba de cada grupo, «Visita N» y su fecha como dato de fecha (`new Date(\`${date}T00:00:00Z\`)`).
- **COTA:**
  - con libreta, `=INT('Libretas'!F{fila}*10000+0.5)/10000`, el `round4` de `bookElevations`, en la fila del `rowIndex` de su lectura;
  - sin libreta (cotas tecleadas), la cota como dato;
  - sin lectura en esa visita, vacía, y vacías las cuatro que siguen.
- **ACUM.:** `=INT((COTA-C0)*1000*10+0.5)/10`.
- **PARCIAL:** contra la COTA de la **última visita anterior con lectura de ese punto**, cuya celda elige el exportador recorriendo `history`: `=INT((COTA-COTA_ant)*1000*10+0.5)/10`. Sin anterior, vacía.
- **VEL.:**
  - `=IF(DAYS(fecha,fecha_ant)=0,"",PARCIAL/(DAYS(fecha,fecha_ant)/30.4375))`, sin redondear, como el motor; el 30.4375 sale de `DAYS_PER_MONTH` de `tolerances.ts`;
  - con un bloque «Umbrales del lugar» (precaución, alerta y alarma de velocidad y de acumulado, de `thresholds`) en la parte de arriba.
- **SEMÁFORO:** `IF` anidados con la regla de `classifyAlert`: el peor entre velocidad (si es número) y acumulado, contra los umbrales, en valor absoluto y con `>=`. Da «Normal», «Precaución», «Alerta» o «Alarma» (`ALERT_LEVEL_LABELS`), con formato condicional del color del semáforo.
- **Resultados guardados:** los de `history.visits[v].readings` del punto (`accumulatedSettlement`, `partialSettlement`, `velocity`, `alertStatus`).
- **A la derecha**, «Avisos de tendencia», como texto (`detectTrendDeviations`).

**Hoja «Resumen»:** el lugar, sus BM (código, cota y origen), los umbrales y la nota de los colores.

**Diseño:** `setLayout` en «Libretas» (sin filas inmovilizadas: cada bloque tiene sus rótulos) y en «Comparación» (inmovilizada hasta la fila de fechas, con la columna del punto).

- [ ] **Step 1: Escribir la prueba que falla** (`settlement-workbook.test.ts`, reescrita):

```ts
import type ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { evaluateWorkbook, formulaMismatches } from "./formula-check";
import { buildSettlementWorkbook } from "./settlement-workbook";
import { siteFixture } from "./settlement-workbook.fixtures";

/** La celda de un grupo de «Comparación»: la fila del punto y la columna del rótulo «Visita N» más `offset`. */
function celda(ws: ExcelJS.Worksheet, punto: string, visita: number, offset: number): ExcelJS.Cell {
  let fila = 0;
  let columna = 0;
  ws.eachRow((row, r) => {
    row.eachCell((c, k) => {
      if (c.value === `Visita ${visita}`) columna = k;
      if (k === 1 && c.value === punto) fila = r;
    });
  });
  return ws.getCell(fila, columna + offset);
}

describe("Excel de asentamientos — fórmulas contra el motor", () => {
  it.each(["alameda", "cartera", "salto"] as const)("%s: toda fórmula da el valor del motor", (caso) => {
    expect(formulaMismatches(buildSettlementWorkbook(siteFixture(caso)))).toEqual([]);
  });

  it("un punto que se salta una visita compara contra la última en que se midió", () => {
    const ws = buildSettlementWorkbook(siteFixture("salto")).getWorksheet("Comparación")!;
    const cota1 = celda(ws, "P-2", 1, 0).address;
    expect(celda(ws, "P-2", 2, 0).value).toBeNull();             // sin lectura en la visita 2
    expect(celda(ws, "P-2", 3, 2).formula).toContain(cota1);     // PARCIAL de la 3 contra la COTA de la 1
  });

  it("cambiar una lectura en la libreta recalcula su cota en la comparación", () => {
    const wb = buildSettlementWorkbook(siteFixture("salto"));
    const comp = wb.getWorksheet("Comparación")!;
    const cota = celda(comp, "P-1", 3, 0);
    const origen = /'Libretas'!F(\d+)/.exec(cota.formula)![1]!;
    const lib = wb.getWorksheet("Libretas")!;
    const lectura = lib.getCell(Number(origen), 5).value as number;   // VI
    const antes = evaluateWorkbook(wb).get(`'Comparación'!${cota.address}`) as number;
    const despues = evaluateWorkbook(wb, { [`'Libretas'!E${origen}`]: lectura + 0.002 }).get(`'Comparación'!${cota.address}`) as number;
    expect(despues).toBeCloseTo(antes - 0.002, 9);
  });

  it("las hojas: libretas, comparación y resumen", () => {
    expect(buildSettlementWorkbook(siteFixture("cartera")).worksheets.map((w) => w.name)).toEqual([
      "Libretas", "Comparación", "Resumen",
    ]);
  });
});
```

`settlement-workbook.fixtures.ts` (solo pruebas) arma los argumentos:
- **«alameda»:** con `alamedaVisits`, `alamedaBook` y `ALAMEDA_POINTS`, los BM `ALAMEDA_AMARRES` y los umbrales «edificio»;
- **«cartera»:** con `CARTERA_ASENTAMIENTOS` y `carteraBook`;
- **«salto»:** tres visitas de una armada desde un BM `BM-1` = 100.0000, a 7 y 14 días, con P-1 y P-2 leídos en la 1 y la 3 y solo P-1 en la 2.

En los tres, `visitInputs` sale de `bookElevations(computeBook(...))` y `history` de `computeHistory`. El rótulo de cada grupo de «Comparación» es exactamente «Visita N», y la fecha va en la fila de abajo.

- [ ] **Step 2: Correr la prueba** — `npx vitest run src/lib/export/settlement-workbook.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implementar** el libro.
- [ ] **Step 4: Correr la prueba** — Expected: PASS.
- [ ] **Step 5: La ruta**. En `settlement/[siteId]/export/route.ts`:
  - leer `getSiteBenchmarks(supabase, site.id)` (como `BenchmarkInput` con `originVisitId`);
  - armar `visits: SettlementSheetVisit[]` con `bookByVisit[v.id].map(bookRowOf)`;
  - pasar `visitInputs`, `thresholds` e `history` como hoy.

  `npm run typecheck`.
- [ ] **Step 6: Commit** — `feat: el Excel de asentamientos con libretas, comparación por punto y fórmulas vivas`.

---

### Task 7: La página de informe exporta; los demás pasos no

**Files:**
- Modify: `src/components/reports/print-button.tsx` (rótulo «Exportar PDF»)
- Modify: `src/components/process/process-header.tsx`
  - `exportHref` y `printable` se muestran juntos y solo con `printable`; el enlace dice «Exportar Excel»;
  - sale `reportTitles` y el aviso de `deletionReportsNotice` del modal de eliminar.
- Modify: `src/components/polygonal/polygonal-header.tsx`, `src/components/leveling/leveling-header.tsx`, `src/components/settlement/site-header.tsx`: dejan de pasar `reportTitles`.
- Modify: `src/components/process/process-report.tsx`: sale el bloque «Informes consolidados» (líneas 64–102) y las props `reports` e `includable`.
- Modify: `src/app/(app)/projects/[id]/polygonal/[pid]/page.tsx`, `leveling/[pid]/page.tsx`, `settlement/[siteId]/page.tsx`: sin `getReports`, `reportsIncluding` ni `includable`.
- Test: no hay pruebas de componentes (Vitest corre sin DOM); la regla se verifica en pantalla en la Tarea 11.

- [ ] **Step 1:** Los cambios de arriba. La cabecera solo lee `printable`: no hay lógica nueva que extraer. `npm run typecheck && npm run lint`.
- [ ] **Step 2: Commit** — `feat: el informe de cada proceso exporta su PDF y su Excel; los demás pasos no`.

---

### Task 8: Fuera los informes consolidados

**Files:**
- Delete: `src/app/(app)/projects/[id]/reports/` entera (`actions.ts`, `new/page.tsx`, `new/loading.tsx`, `[reportId]/page.tsx`, `[reportId]/print/page.tsx`)
- Delete: `src/components/reports/report-form.tsx`, `src/components/reports/delete-report-button.tsx`
- Delete: `src/lib/reports/eligibility.ts`, `eligibility.test.ts`, `including.ts`, `including.test.ts`
- Modify: `src/types/report.ts`
  - `CandidateKind` (`"polygonal" | "leveling" | "site"`) vive aquí;
  - salen `Report` y el tipo de la fila de `reports`;
  - se quedan `IncludedProcess`, `ReportCoverData` y `CANDIDATE_KIND_LABELS`, que usan las secciones.
- Modify: `src/lib/supabase/queries.ts`: fuera `getReports`, `getReport` y `getReportableWork`.
- Modify: `src/app/(app)/projects/[id]/page.tsx`
  - sale la pestaña Informes (TABS sin `reports`);
  - `?tab=reports` cae en `processes`;
  - fuera `getReports` y `reportTitles` por fila.
- Modify: `src/components/projects/process-table.tsx`, `process-row-actions.tsx`: sin `reportTitles` ni `deletionReportsNotice`.
- Modify: `src/components/reports/sections/report-cover.tsx`: solo la portada viva; sale la rama de la portada congelada.
- Modify: `src/lib/reports/cover.test.ts`: fuera los casos de la portada congelada.
- Modify: `src/app/globals.css`: fuera `.report-index`, `.report-actions`, `.report-draft` y `.report-rejected`; se conserva el resto de `.report*`, que usa el informe de proceso.
- Modify: `src/app/design-system/page.tsx` y `src/components/design-system/tabs.test.ts`: el ejemplo de pestañas deja de usar `tab=reports` (`tab=config`).

- [ ] **Step 1:** Borrar y ajustar. Después, `grep -rn "getReports\|getReportableWork\|reportsIncluding\|deletionReportsNotice\|createReportAction\|/reports" src --include=*.ts --include=*.tsx` no da nada; el único `reports` que puede quedar es el directorio `src/components/reports/`.
- [ ] **Step 2:** `npm run typecheck && npm run lint && npm test`.
- [ ] **Step 3: Commit** — `refactor: fuera los informes consolidados y sus restos`.

---

### Task 9: La demo y el seed sin informes

**Files:**
- Modify: `src/lib/demo/crear-proyecto-demo.ts`: fuera las líneas que crean los 3 informes y las variables `poligonalInforme` y `nivelacionInforme`.
- Delete: `src/lib/demo/insertar-informe.ts`
- Modify: `src/lib/demo/fixtures.ts`: fuera las banderas `informe` de `ProcesoDemo`, `NivelacionDemo` y `AsentamientoDemo` y sus valores.
- Modify: `src/lib/demo/fixtures.test.ts`: fuera el bloque de las banderas `informe` (líneas 208–215).
- Modify: `scripts/seed.mjs`: fuera `insertReport()` y sus 3 llamadas, y su mención en la cabecera.

- [ ] **Step 1:** Los cambios. `npm run typecheck && npx vitest run src/lib/demo`.
- [ ] **Step 2:** Probar el seed contra la base local sin resetearla: `node -e "import('./scripts/seed.mjs')"` **no** se corre, porque el seed no es idempotente. Se valida con `node --check scripts/seed.mjs` y con la búsqueda `grep -n "reports" scripts/seed.mjs`, que no da nada.
- [ ] **Step 3: Commit** — `refactor: la demo y el seed dejan de crear informes consolidados`.

---

### Task 10: La base — fuera la tabla `reports` (después del merge)

**Files:**
- Create: `supabase/migrations/20261010000000_sin_informes_consolidados.sql`
- Delete: `supabase/tests/informe_congelado.test.sql`
- Create: `supabase/tests/sin_informes_consolidados.test.sql`
- Modify: `src/types/database.ts`: fuera `reports`, a mano.

- [ ] **Step 1: La prueba pgTAP**:

```sql
begin;
select plan(2);
select hasnt_table('public', 'reports', 'la tabla de informes consolidados no existe');
select hasnt_function('public', 'reject_update_on_report', 'ni su función de inmutabilidad');
select * from finish();
rollback;
```

  Run: `npx supabase test db` → FAIL (la tabla existe).
- [ ] **Step 2: La migración**:

```sql
-- Fase 38: el informe de cada proceso vive en su página; los consolidados se
-- quitan. Va DESPUÉS del merge: el código anterior lee `reports` en cada
-- página de proceso.
drop trigger if exists reports_reject_update on public.reports;
drop function if exists public.reject_update_on_report();
drop table if exists public.reports;
```

  Run: `npx supabase migration up --local`, luego `npx supabase test db` → PASS. Borrar `informe_congelado.test.sql` en el mismo paso, porque su tabla ya no existe.
- [ ] **Step 3:** `src/types/database.ts` sin el bloque `reports` (`Row`, `Insert`, `Update`, `Relationships`). `npm run typecheck`.
- [ ] **Step 4: Commit** — `feat: fuera la tabla de informes consolidados (después del merge)`.

---

### Task 11: Documentación, capturas y verificación en pantalla

**Files:**
- Modify: `docs/manual/README.md` y `src/app/(app)/manual/{page.tsx,manual-data.ts}` (las dos copias, en el mismo commit):
  - **§ 1, § 2, § 4.2 a § 4.4, § 8 y preguntas frecuentes:** fuera los consolidados.
  - **§ 5.7, § 6.10 y § 7.12:** sale «la misma sección que en un consolidado».
  - **§ 10 «El informe de cada proceso»:** dónde está, qué contiene, Exportar PDF y Exportar Excel.
  - **§ 11:** las hojas nuevas de cada libro, qué es dato (fondo amarillo) y qué es fórmula, y que Excel recalcula al cambiar un dato.
  - **`manual-data.ts`:** fuera `CAMPOS_INFORME`, `nuevoInforme` e `informeImprimible`; `HOJAS_EXCEL` con las hojas nuevas.
- Delete: `public/manual/18-nuevo-informe.png`, `public/manual/19-informe-imprimible.png`, y su bloque en `docs/manual/capturas.mjs` (líneas 375–401).
- Regenerar con `node docs/manual/capturas.mjs` y commitear solo las que cambian: la 30 (informe del proceso, con los dos botones), la 10 (corrección en el informe) y las del hub sin la pestaña Informes. Se comparan contra HEAD y se sincronizan los `width`/`height` de `CAPTURAS`.
- Modify: `docs/tecnica/README.md`:
  - § 2 (estructura), § 3 (informes y exportación: el Excel con fórmulas y su verificación), § 4 (modelo sin `reports`), § 5 (inmutabilidad sin el informe emitido);
  - § 9 (pruebas: los archivos nuevos y el conteo), § 10 (reglas), § 11 (deuda, entrada por entrada) y § 13 (el despliegue de esta fase).
- Modify: `CLAUDE.md`:
  - Arquitectura: fuera `reports/` y la descripción de `components/reports/` queda como «secciones del informe de proceso»;
  - Reglas: fuera «Un informe emitido no admite UPDATE…».
- Modify: `docs/testing/manual-e2e-informes.md`: reescrito para el informe de proceso y los tres Excel.
- Modify: `docs/prds/37-informe-por-proceso.md` (estado «cerrada» y divergencias), `docs/prds/README.md`, `docs/method.md` («Cierre Fase 38», con aprendizajes) y `docs/pendientes.md`.

- [ ] **Step 1: En pantalla** (dev en el puerto 3000, con el usuario del seed):
  - en la poligonal TT4, la nivelación El Verjón y el lugar Torre Alameda, el informe muestra **Exportar PDF** y **Exportar Excel**, y ningún otro paso los muestra;
  - **Exportar PDF** abre el diálogo de impresión (en Playwright, `page.on("dialog")` no aplica: se comprueba que `window.print` se llama con un `addInitScript` que lo reemplaza);
  - la descarga del Excel responde 200, con un `.xlsx` que exceljs abre y `formulaMismatches` limpio;
  - el hub no tiene la pestaña Informes; `/projects/<id>/reports/new` da 404.
- [ ] **Step 2:** La documentación de arriba.
- [ ] **Step 3: Gate final:** `npm run typecheck`, `npm run lint`, `npm test`, `npx supabase test db` y `npm run build`, todos en 0.
- [ ] **Step 4:** Descargar los Excel de la demo local (TT4, Vivero, El Verjón, Torre Alameda y la cartera real) al scratchpad de la sesión y enviárselos al usuario con `SendUserFile`, para que los abra en Excel: **criterio l**. No se commitean.
- [ ] **Step 5: Commit** — `docs: cerrar fase 38 — el informe de cada proceso`.
