// Libro de Excel de un proceso de nivelación (Fase 38): la forma de la cartera
// de El Verjón —hoja NIVELACIÓN y CONTRANIVELACIÓN, tres filas por punto si
// hay hilos, el cierre al pie— con fórmulas vivas. Cada celda calculada lleva
// su fórmula y, como resultado guardado, el valor del motor: el libro se ve
// completo en cualquier visor y Excel recalcula si se cambia una lectura.
//
// Las reglas son las del motor (`computeLeveling`), no las de la hoja: El
// Verjón reparte la corrección por igual en cada armada y la app la reparte
// en proporción a la distancia.

import type ExcelJS from "exceljs";
import {
  adoptedElevationsOf,
  distanceFromWires,
  type computeLevelingDetected,
} from "@/lib/calculations/leveling";
import { levelingTolerance } from "@/lib/calculations/tolerances";
import { PRECISION_ORDERS, PRECISION_ORDER_LABELS } from "@/types/project";
import {
  levelingTypeLabel,
  type ComputedReading,
  type LevelingInput,
  type LevelingType,
  type ReadingInput,
} from "@/types/leveling";
import {
  FMT,
  at,
  putData,
  putFormula,
  putLabel,
  ref,
  setLayout,
  verdictFormatting,
  writeLevelingTolerances,
  writeSheetHeader,
} from "./cells";
import { newWorkbook, projectPairs, type ProjectMetadata } from "./workbook";

export interface LevelingSheetProcess {
  name: string;
  type: LevelingType;
  startBmCode: string;
  endBmCode: string | null;
  equipment: string | null;
  /** Del alta (Fase 36): la ubicación y «Responsable · Cargo». */
  location?: string | null;
  responsible?: string | null;
  levelType: string | null;
  notes: string | null;
}

type Detected = ReturnType<typeof computeLevelingDetected>;
type Input = Omit<LevelingInput, "order" | "compensation">;

const FORWARD = "Nivelación";
const RETURN = "Contranivelación";

// Columnas de una hoja de recorrido.
const C = { point: 1, type: 2, back: 3, hi: 4, fore: 5, inter: 6, elev: 7, dBack: 8, dFore: 9, acc: 10, corr: 11, adj: 12, key: 13 };
const TYPE_SHORT = { bm: "BM", pc: "PC", intermediate: "VI" } as const;
const TOLERANCE_COL = 15;
/** El margen de `withinTolerance`, en mm. */
const MARGIN = "0.000001";

/** Lo que el cierre y las correcciones necesitan de una hoja de recorrido. */
interface RunLayout {
  sheet: string;
  /** Fila principal (la del hilo medio) de cada lectura. */
  mid: number[];
  start: number;
  /** Fila de la cota que propaga la cadena al final del recorrido. */
  chainEnd: number;
  last: number;
  /** Fila del bloque de cierre: distancia, cota calculada, error. */
  closure: { distance: string; finalElevation: string; error: string | null } | null;
}

function hasWires(rows: readonly ReadingInput[]): boolean {
  return rows.some((r) => r.backUpperM != null || r.backLowerM != null || r.foreUpperM != null || r.foreLowerM != null);
}

/**
 * Escribe la tabla de un recorrido: PUNTO · TIPO · V+ · AI · V− · VI · COTA ·
 * DIST. V+ · DIST. V− · ACUM. La cota de partida es un dato o una fórmula
 * (la vuelta de una abierta parte de la cota calculada de la ida).
 */
function writeRunTable(
  ws: ExcelJS.Worksheet,
  firstRow: number,
  rows: readonly ReadingInput[],
  computed: readonly ComputedReading[],
  start: { value: number } | { formula: string; result: number },
  reconstructed: boolean,
): Omit<RunLayout, "closure"> {
  const wires = hasWires(rows);
  const span = wires ? 3 : 1;
  const mid: number[] = [];
  let hiRow: number | null = null;
  let chainRow = 0;
  let prevMain: number | null = null;

  rows.forEach((row, i) => {
    const top = firstRow + i * span;
    const m = wires ? top + 1 : top;
    const bottom = wires ? top + 2 : top;
    mid.push(m);
    const out = computed[i]!;
    const intermediate = row.pointType === "intermediate";

    putData(ws, C.point, m, row.pointCode);
    ws.getCell(m, C.type).value = TYPE_SHORT[row.pointType];
    if (row.backsight != null) putData(ws, C.back, m, row.backsight, FMT.elev);
    const foreCol = intermediate ? C.inter : C.fore;
    if (row.foresight != null) putData(ws, foreCol, m, row.foresight, FMT.elev);
    if (wires) {
      if (row.backUpperM != null) putData(ws, C.back, top, row.backUpperM, FMT.elev);
      if (row.backLowerM != null) putData(ws, C.back, bottom, row.backLowerM, FMT.elev);
      if (row.foreUpperM != null) putData(ws, foreCol, top, row.foreUpperM, FMT.elev);
      if (row.foreLowerM != null) putData(ws, foreCol, bottom, row.foreLowerM, FMT.elev);
    }

    // Distancias: los hilos, si el par es completo; si no, lo tecleado. La
    // vista intermedia no aporta al acumulado y no lleva distancia.
    if (!intermediate) {
      const visual = (dCol: number, valueCol: number, upper: number | null, lower: number | null, typed: number | null, resolved: number | null) => {
        if (wires && distanceFromWires(upper, lower) != null) {
          putFormula(ws, dCol, m, `(${at(valueCol, top)}-${at(valueCol, bottom)})*100`, resolved, FMT.coord);
        } else if (typed != null) {
          putData(ws, dCol, m, typed, FMT.coord);
        }
      };
      visual(C.dBack, C.back, row.backUpperM, row.backLowerM, row.backDistanceM, out.backDistanceResolvedM);
      visual(C.dFore, C.fore, row.foreUpperM, row.foreLowerM, row.foreDistanceM, out.foreDistanceResolvedM);
    }

    // Cota: consume la AI vigente si hay lectura; si no, conserva la de la cadena.
    if (i === 0) {
      if ("value" in start) putData(ws, C.elev, m, start.value, FMT.elev);
      else putFormula(ws, C.elev, m, start.formula, start.result, FMT.elev);
      chainRow = m;
    } else if (row.foresight != null && hiRow != null) {
      putFormula(ws, C.elev, m, `${at(C.hi, hiRow)}-${at(foreCol, m)}`, out.elevationCalculated, FMT.elev);
      if (!intermediate) chainRow = m;
    } else {
      putFormula(ws, C.elev, m, at(C.elev, chainRow), out.elevationCalculated, FMT.elev);
    }
    if (!intermediate && row.backsight != null) {
      putFormula(ws, C.hi, m, `${at(C.elev, m)}+${at(C.back, m)}`, out.instrumentHeight, FMT.elev);
      hiRow = m;
    }

    // Acumulado en km, como `accumulateDistances`.
    const acc = out.distanceAccumulatedKm;
    if (prevMain === null) {
      const f = reconstructed && !intermediate ? `(${at(C.dFore, m)}+${at(C.dBack, m)})/1000` : `${at(C.dFore, m)}/1000`;
      putFormula(ws, C.acc, m, f, acc, FMT.km);
    } else if (intermediate) {
      const f = reconstructed ? at(C.acc, prevMain) : `${at(C.acc, prevMain)}+${at(C.dBack, prevMain)}/1000`;
      putFormula(ws, C.acc, m, f, acc, FMT.km);
    } else {
      const f = reconstructed
        ? `${at(C.acc, prevMain)}+(${at(C.dFore, m)}+${at(C.dBack, m)})/1000`
        : `${at(C.acc, prevMain)}+(${at(C.dBack, prevMain)}+${at(C.dFore, m)})/1000`;
      putFormula(ws, C.acc, m, f, acc, FMT.km);
    }
    if (!intermediate) prevMain = m;

    putFormula(ws, C.key, m, `SUBSTITUTE(${at(C.point, m)}," ","")`, row.pointCode.replace(/ /g, ""));
  });

  return {
    sheet: ws.name,
    mid,
    start: mid[0]!,
    chainEnd: chainRow,
    last: mid.at(-1)!,
  };
}

function writeHeaders(ws: ExcelJS.Worksheet, row: number, compensated: boolean): void {
  const labels = ["PUNTO", "TIPO", "V+", "AI", "V−", "VI", "COTA", "DIST. V+ (m)", "DIST. V− (m)", "ACUM. (km)"];
  if (compensated) labels.push("CORRECCIÓN (m)", "COTA AJUSTADA");
  labels.forEach((l, i) => putLabel(ws, i + 1, row, l, "header"));
  putLabel(ws, C.key, row, "CLAVE", "header");
}

function runSheet(
  wb: ExcelJS.Workbook,
  name: string,
  title: string,
  pairs: [string, string | number | null][],
  rows: readonly ReadingInput[],
  computed: readonly ComputedReading[],
  start: { value: number } | { formula: string; result: number },
  compensated: boolean,
  reconstructed: boolean,
): { ws: ExcelJS.Worksheet; layout: Omit<RunLayout, "closure">; labelRow: number } {
  const ws = wb.addWorksheet(name);
  const labelRow = writeSheetHeader(ws, title, pairs);
  writeHeaders(ws, labelRow, compensated);
  const layout = writeRunTable(ws, labelRow + 1, rows, computed, start, reconstructed);
  setLayout(ws, { frozenRows: labelRow, widths: [12, 6, 10, 10, 10, 10, 11, 11, 11, 11, 13, 13, 8, 2, 16, 12] });
  return { ws, layout, labelRow };
}

/** Rótulo y valor de una fila del bloque de cierre; devuelve la dirección del valor. */
function closureRow(
  ws: ExcelJS.Worksheet,
  r: number,
  label: string,
  value: { formula: string; result: number | string | null } | { data: number | string },
  fmt?: string,
): string {
  putLabel(ws, 1, r, label);
  return "data" in value ? putData(ws, 4, r, value.data, fmt) : putFormula(ws, 4, r, value.formula, value.result, fmt);
}

/** El orden alcanzado como `IF` encadenados del más exigente al ordinario. */
function orderFormula(conditions: (o: (typeof PRECISION_ORDERS)[number]) => string): string {
  return PRECISION_ORDERS.reduceRight(
    (rest, o) => `IF(${conditions(o)},"${PRECISION_ORDER_LABELS[o]}",${rest})`,
    `"Ninguno"`,
  );
}

/** Libro completo de un proceso de nivelación. */
export function buildLevelingWorkbook({
  process,
  project,
  input,
  detected,
}: {
  process: LevelingSheetProcess;
  project: ProjectMetadata | null;
  input: Input;
  detected: Detected;
}): ExcelJS.Workbook {
  const wb = newWorkbook();
  const { result } = detected;
  const back = input.return != null && input.return.length > 0 ? input.return : null;
  const compensated = result.compensated;
  const reconstructed = input.distancesReconstructed ?? false;
  const known = input.type === "closed" ? input.startElevation : input.type === "link" ? input.endElevation : null;

  const pairs = (run: string): [string, string | number | null][] => [
    ["Proyecto", project?.name ?? null],
    ["Proceso", process.name],
    ["Tipo", levelingTypeLabel(input.type, back != null)],
    ["Recorrido", run],
    ["Ubicación", process.location ?? null],
    ["Responsable", process.responsible ?? null],
    ["Equipo", process.equipment],
    ["Tipo de nivel", process.levelType],
    ["BM de partida", `${process.startBmCode} · ${input.startElevation.toFixed(4)}`],
    [
      "BM de llegada",
      input.type === "link" && process.endBmCode && input.endElevation != null
        ? `${process.endBmCode} · ${input.endElevation.toFixed(4)}`
        : null,
    ],
  ];

  // --- La ida ---------------------------------------------------------------
  const fwd = runSheet(
    wb,
    FORWARD,
    `${process.name} — nivelación`,
    pairs("Ida"),
    input.forward,
    result.forward.readings,
    { value: input.startElevation },
    compensated,
    reconstructed,
  );

  // --- La vuelta --------------------------------------------------------------
  let rev: ReturnType<typeof runSheet> | null = null;
  if (back && result.return) {
    const fwdFinal = result.forward.readings.length > 0 ? fwdChainElevation(result.forward.readings, input.forward) : 0;
    const start =
      known != null
        ? { value: known }
        : { formula: ref(FORWARD, at(C.elev, fwd.layout.chainEnd)), result: fwdFinal };
    rev = runSheet(
      wb,
      RETURN,
      `${process.name} — contranivelación`,
      pairs("Vuelta"),
      back,
      result.return.readings,
      start,
      compensated,
      reconstructed,
    );
  }

  // --- El cierre de cada recorrido ---------------------------------------------
  const blockRow = (layout: Omit<RunLayout, "closure">, wires: boolean) => layout.last + (wires ? 2 : 0) + 3;
  const fwdBlock = blockRow(fwd.layout, hasWires(input.forward));
  putLabel(fwd.ws, 1, fwdBlock, "Cierre", "section");
  const fDist = closureRow(fwd.ws, fwdBlock + 1, "Distancia (km)", { formula: at(C.acc, fwd.layout.last), result: result.forward.distanceKm }, FMT.km);
  const fFinal = closureRow(fwd.ws, fwdBlock + 2, "Cota calculada de llegada", { formula: at(C.elev, fwd.layout.chainEnd), result: fwdChainElevation(result.forward.readings, input.forward) }, FMT.elev);
  let fError: string | null = null;
  let r = fwdBlock + 3;
  if (known != null) {
    const k = closureRow(fwd.ws, r++, "Cota conocida", { data: known }, FMT.elev);
    fError = closureRow(fwd.ws, r++, "Error de cierre (mm)", { formula: `(${fFinal}-${k})*1000`, result: result.closureErrorMm }, FMT.mm);
  }

  let rDist: string | null = null;
  let rError: string | null = null;
  if (rev && result.return) {
    const rb = blockRow(rev.layout, hasWires(back!));
    putLabel(rev.ws, 1, rb, "Cierre", "section");
    rDist = closureRow(rev.ws, rb + 1, "Distancia (km)", { formula: at(C.acc, rev.layout.last), result: result.return.distanceKm }, FMT.km);
    const rFinal = closureRow(rev.ws, rb + 2, "Cota calculada de llegada", { formula: at(C.elev, rev.layout.chainEnd), result: fwdChainElevation(result.return.readings, back!) }, FMT.elev);
    if (known != null) {
      const k = closureRow(rev.ws, rb + 3, "Cota conocida (partida)", { data: input.startElevation }, FMT.elev);
      rError = closureRow(rev.ws, rb + 4, "Error de cierre (mm)", { formula: `(${rFinal}-${k})*1000`, result: result.return.errorMm }, FMT.mm);
    }
  }

  // --- Abierta con vuelta: el circuito -----------------------------------------
  let circuit: string | null = null;
  let pairKm: string | null = null;
  let discrepancy: string | null = null;
  if (known == null && rev && result.return) {
    const fStart = at(C.elev, fwd.layout.start);
    const dF = closureRow(fwd.ws, r++, "Desnivel de la ida (m)", { formula: `${fFinal}-${fStart}`, result: result.forward.heightDifference }, FMT.elev);
    const rStart = ref(RETURN, at(C.elev, rev.layout.start));
    const rEnd = ref(RETURN, at(C.elev, rev.layout.chainEnd));
    const dR = closureRow(fwd.ws, r++, "Desnivel de la vuelta (m)", { formula: `${rEnd}-${rStart}`, result: result.return.heightDifference }, FMT.elev);
    discrepancy = closureRow(fwd.ws, r++, "Discrepancia ida-vuelta (mm)", { formula: `ABS(${dF}+${dR})*1000`, result: result.discrepancyMm }, FMT.mm);
    circuit = closureRow(fwd.ws, r++, "Cierre del circuito (mm)", { formula: `(${dF}+${dR})*1000`, result: result.circuitClosureMm }, FMT.mm);
    pairKm = closureRow(fwd.ws, r++, "Distancia del par (km)", { formula: `MIN(${fDist},${ref(RETURN, rDist!)})`, result: Math.min(result.forward.distanceKm, result.return.distanceKm) }, FMT.km);
  }

  // --- Tolerancias, orden y veredicto ---------------------------------------------
  const kCells = writeLevelingTolerances(fwd.ws, TOLERANCE_COL, fwdBlock);
  const verifiable = detected.verifiable && detected.pending == null && !detected.broken;
  const tolRow = fwdBlock + 2 + PRECISION_ORDERS.length;
  putLabel(fwd.ws, TOLERANCE_COL, tolRow, "Tolerancia (mm)", "section");
  const tolerance = (o: (typeof PRECISION_ORDERS)[number], i: number, km: string, kmValue: number, factor = "") => {
    const cell = at(TOLERANCE_COL + 1, tolRow + 1 + i);
    putLabel(fwd.ws, TOLERANCE_COL, tolRow + 1 + i, PRECISION_ORDER_LABELS[o]);
    const value = levelingTolerance(o, kmValue) * (factor ? Math.SQRT2 : 1);
    putFormula(fwd.ws, TOLERANCE_COL + 1, tolRow + 1 + i, `${kCells[o]}*SQRT(${km})${factor}`, value, FMT.mm);
    return cell;
  };

  let orderCell: string | null = null;
  const orderRow = tolRow + PRECISION_ORDERS.length + 2;
  const reached = detected.order ? PRECISION_ORDER_LABELS[detected.order] : "Ninguno";
  if (verifiable && known == null && discrepancy && pairKm && result.return) {
    const pairValue = Math.min(result.forward.distanceKm, result.return.distanceKm);
    const tols = PRECISION_ORDERS.map((o, i) => tolerance(o, i, pairKm!, pairValue, "*SQRT(2)"));
    const cond = (o: (typeof PRECISION_ORDERS)[number]) =>
      `ABS(${discrepancy})<=${tols[PRECISION_ORDERS.indexOf(o)]}+${MARGIN}`;
    orderCell = closureRow(fwd.ws, orderRow, "Orden alcanzado", { formula: orderFormula(cond), result: reached });
  } else if (verifiable && fError) {
    const tols = PRECISION_ORDERS.map((o, i) => tolerance(o, i, fDist, result.forward.distanceKm));
    let backTols: string[] = [];
    if (rError && rDist && result.return) {
      putLabel(rev!.ws, TOLERANCE_COL, 2, "Tolerancia de la vuelta (mm)", "section");
      backTols = PRECISION_ORDERS.map((o, i) => {
        const value = levelingTolerance(o, result.return!.distanceKm);
        putLabel(rev!.ws, TOLERANCE_COL, 3 + i, PRECISION_ORDER_LABELS[o]);
        putFormula(rev!.ws, TOLERANCE_COL + 1, 3 + i, `${ref(FORWARD, kCells[o])}*SQRT(${rDist})`, value, FMT.mm);
        return ref(RETURN, at(TOLERANCE_COL + 1, 3 + i));
      });
    }
    const cond = (o: (typeof PRECISION_ORDERS)[number]) => {
      const i = PRECISION_ORDERS.indexOf(o);
      const ida = `ABS(${fError})<=${tols[i]}+${MARGIN}`;
      return backTols.length > 0 ? `AND(${ida},ABS(${ref(RETURN, rError!)})<=${backTols[i]}+${MARGIN})` : ida;
    };
    orderCell = closureRow(fwd.ws, orderRow, "Orden alcanzado", { formula: orderFormula(cond), result: reached });
  } else {
    closureRow(fwd.ws, orderRow, "Orden alcanzado", { data: "Sin verificación" });
  }
  if (orderCell) {
    const verdict = closureRow(fwd.ws, orderRow + 1, "Veredicto", {
      formula: `IF(${orderCell}="Ninguno","NO CUMPLE","CUMPLE")`,
      result: detected.order ? "CUMPLE" : "NO CUMPLE",
    });
    verdictFormatting(fwd.ws, verdict);
  }

  // --- La corrección ---------------------------------------------------------------
  if (compensated) {
    if (known == null && circuit && rDist && rev && result.return) {
      const total = `(${fDist}+${ref(RETURN, rDist)})`;
      writeCorrection(fwd.ws, fwd.layout.mid, result.forward.readings, (row) => `-(${circuit}/1000)*${at(C.acc, row)}/${total}`);
      const circ = ref(FORWARD, circuit);
      const totalBack = `(${ref(FORWARD, fDist)}+${rDist})`;
      writeCorrection(rev.ws, rev.layout.mid, result.return.readings, (row) => `-(${circ}/1000)*(${ref(FORWARD, fDist)}+${at(C.acc, row)})/${totalBack}`);
    } else if (fError) {
      writeCorrection(fwd.ws, fwd.layout.mid, result.forward.readings, (row) => `-(${fError}/1000)*${at(C.acc, row)}/${fDist}`);
      if (rev && rError && rDist && result.return) {
        writeCorrection(rev.ws, rev.layout.mid, result.return.readings, (row) => `-(${rError}/1000)*${at(C.acc, row)}/${rDist}`);
      }
    }
    sheetAdjusted(wb, input, detected, fwd.layout, rev?.layout ?? null);
  }

  sheetSummary(wb, process, project);
  return wb;
}

/** La cota de la cadena al final del recorrido: la de la última fila bm/pc con lectura. */
function fwdChainElevation(computed: readonly ComputedReading[], rows: readonly ReadingInput[]): number {
  let elevation = computed[0]?.elevationCalculated ?? 0;
  computed.forEach((c, i) => {
    if (i > 0 && rows[i]!.pointType !== "intermediate" && rows[i]!.foresight != null) elevation = c.elevationCalculated;
  });
  return elevation;
}

function writeCorrection(
  ws: ExcelJS.Worksheet,
  mid: readonly number[],
  computed: readonly ComputedReading[],
  formula: (row: number) => string,
): void {
  mid.forEach((m, i) => {
    const out = computed[i]!;
    putFormula(ws, C.corr, m, formula(m), out.correctionApplied, FMT.elev);
    putFormula(ws, C.adj, m, `${at(C.elev, m)}+${at(C.corr, m)}`, out.elevationCorrected, FMT.elev);
  });
}

/**
 * Una cota por punto (Fases 28 y 36): la conocida para los BM de partida y de
 * llegada, y el promedio de las cotas ajustadas de un punto leído en la ida y
 * en la vuelta. Los códigos se emparejan sin espacios (CLAVE): la cartera de
 * El Verjón escribe «AUX 1» en la ida y «AUX1» en la vuelta.
 */
function sheetAdjusted(
  wb: ExcelJS.Workbook,
  input: Input,
  detected: Detected,
  fwd: Omit<RunLayout, "closure">,
  rev: Omit<RunLayout, "closure"> | null,
): void {
  const adopted = adoptedElevationsOf(detected.result, { type: input.type, startElevation: input.startElevation, endElevation: input.endElevation });
  if (!adopted) return;
  const ws = wb.addWorksheet("Cotas ajustadas");
  const labelRow = writeSheetHeader(ws, "Cotas ajustadas", [
    ["Regla", "La cota conocida de los BM; en los demás, el promedio de sus cotas ajustadas en la ida y la vuelta"],
  ]);
  ["PUNTO", "CLAVE", "LECTURAS", "COTA AJUSTADA"].forEach((l, i) => putLabel(ws, i + 1, labelRow, l, "header"));
  const range = (sheet: string, layout: Omit<RunLayout, "closure">, column: number) =>
    ref(sheet, `${at(column, layout.start)}:${at(column, layout.last)}`);
  const runs = [{ sheet: FORWARD, layout: fwd }, ...(rev ? [{ sheet: RETURN, layout: rev }] : [])];
  adopted.forEach((a, i) => {
    const r = labelRow + 1 + i;
    ws.getCell(r, 1).value = a.pointCode;
    const key = putFormula(ws, 2, r, `SUBSTITUTE(${at(1, r)}," ","")`, a.pointCode.replace(/ /g, ""));
    const count = runs.map((x) => `COUNTIF(${range(x.sheet, x.layout, C.key)},${key})`).join("+");
    putFormula(ws, 3, r, count, a.readings);
    if (a.known) {
      putData(ws, 4, r, a.elevation, FMT.elev);
    } else {
      const sum = runs.map((x) => `SUMIF(${range(x.sheet, x.layout, C.key)},${key},${range(x.sheet, x.layout, C.adj)})`).join("+");
      putFormula(ws, 4, r, `(${sum})/(${count})`, a.elevation, FMT.elev);
    }
  });
  setLayout(ws, { frozenRows: labelRow, widths: [14, 10, 10, 16] });
}

function sheetSummary(wb: ExcelJS.Workbook, process: LevelingSheetProcess, project: ProjectMetadata | null): void {
  const ws = wb.addWorksheet("Resumen");
  writeSheetHeader(ws, `${process.name} — resumen`, [
    ...projectPairs(project),
    ["Proceso", process.name],
    ["Equipo", process.equipment],
    ["Tipo de nivel", process.levelType],
    ["Notas", process.notes],
    ["Cómo leer el libro", "Las celdas con fondo amarillo son datos medidos o tecleados; el resto se calcula con fórmulas y se recalcula si cambia un dato."],
  ]);
  ws.columns = [{ width: 22 }, { width: 2 }, { width: 70 }];
}
