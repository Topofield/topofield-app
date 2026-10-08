// Libro de Excel de una poligonal (Fase 38): la forma de `poligonales.xlsx`
// —una hoja por método, con el ángulo en G-M-S-DEC, la corrección, el ángulo
// corregido, el azimut, las proyecciones, sus correcciones y las coordenadas—
// con fórmulas vivas. Cada celda calculada lleva su fórmula y, como resultado
// guardado, el valor del motor.
//
// Las reglas son las del motor (`computePolygonal`): las hojas Tránsito y
// Crandall de la TT4 tienen defectos conocidos (§ 6 de la doc técnica) y aquí
// no se repiten.

import type ExcelJS from "exceljs";
import { observedAzimuths, type computePolygonalDetected } from "@/lib/calculations/polygonal";
import { angularTolerance } from "@/lib/calculations/tolerances";
import { PRECISION_ORDERS, PRECISION_ORDER_LABELS, type PrecisionOrder } from "@/types/project";
import {
  ANGLE_TYPE_LABELS,
  CORRECTION_METHOD_LABELS,
  POLYGONAL_TYPE_LABELS,
  type CorrectionMethod,
  type PolygonalInput,
  type PolygonalType,
} from "@/types/polygonal";
import {
  FMT,
  at,
  putData,
  putFormula,
  putLabel,
  setLayout,
  verdictFormatting,
  writePolygonalTolerances,
  writeSheetHeader,
} from "./cells";
import { newWorkbook, projectPairs, type ProjectMetadata } from "./workbook";

export interface PolygonalSheetProcess {
  name: string;
  type: PolygonalType;
  method: CorrectionMethod;
  startPointCode: string;
  equipment: string | null;
  /** Del alta (Fase 35): la ubicación y «Responsable · Cargo». */
  location?: string | null;
  responsible?: string | null;
  /** La última georreferenciación (Fase 15), tal como la guarda el proceso. */
  georeference: { date: string | null; points: string | null; rotationDeg: number; scale: number } | null;
  notes: string | null;
}

type Detected = ReturnType<typeof computePolygonalDetected>;

const SHEET_NAMES: Record<CorrectionMethod, string> = {
  bowditch: "BRÚJULA",
  transit: "TRÁNSITO",
  crandall: "CRANDALL",
  least_squares: "MÍNIMOS CUADRADOS",
};

// Columnas de la tabla, como la cartera.
export const P = {
  station: 1, sighted: 2,
  aG: 3, aM: 4, aS: 5, aDec: 6,
  corr: 7,
  cG: 8, cM: 9, cS: 10, cDec: 11,
  zG: 12, zM: 13, zS: 14, zDec: 15,
  dist: 16,
  pN: 17, pE: 18,
  kN: 19, kE: 20,
  uN: 21, uE: 22,
  north: 23, east: 24,
} as const;

/** Grados, minutos y segundos SIN redondear: el decimal que dan reproduce el ángulo del motor. */
function dmsExact(decimal: number): [number, number, number] {
  const deg = Math.floor(decimal);
  const min = Math.floor((decimal - deg) * 60);
  return [deg, min, ((decimal - deg) * 60 - min) * 60];
}

/**
 * G, M y S de un dato: los segundos a la millonésima, para que la celda no
 * muestre el ruido de la coma flotante (57.19999999985248). El decimal que
 * dan difiere del ángulo en menos de 1e-9″.
 */
function dmsData(decimal: number): [number, number, number] {
  const [g, m, s] = dmsExact(decimal);
  return [g, m, Math.round(s * 1e6) / 1e6];
}

/** G, M y S de un decimal como fórmulas sobre la celda del decimal. */
function writeDmsOf(ws: ExcelJS.Worksheet, r: number, cols: [number, number, number], decCell: string, value: number) {
  const [g, m, s] = dmsExact(value);
  const G = at(cols[0], r);
  const M = at(cols[1], r);
  putFormula(ws, cols[0], r, `INT(${decCell})`, g, FMT.deg);
  putFormula(ws, cols[1], r, `INT((${decCell}-${G})*60)`, m, FMT.min);
  putFormula(ws, cols[2], r, `((${decCell}-${G})*60-${M})*60`, s, FMT.sec);
}

const finite = (x: number | null | undefined): x is number => x != null && Number.isFinite(x);

/** Libro completo de una poligonal. */
export function buildPolygonalWorkbook({
  process,
  project,
  input,
  detected,
}: {
  process: PolygonalSheetProcess;
  project: ProjectMetadata | null;
  input: PolygonalInput;
  detected: Detected;
}): ExcelJS.Workbook {
  const wb = newWorkbook();
  const { result } = detected;
  const name = input.type === "open_uncontrolled" ? "ABIERTA SIN CONTROL" : SHEET_NAMES[input.method];
  const ws = wb.addWorksheet(name);

  const labelRow = writeSheetHeader(ws, `${process.name} — ${CORRECTION_METHOD_LABELS[input.method].toLowerCase()}`, [
    ["Proyecto", project?.name ?? null],
    ["Proceso", process.name],
    ["Tipo", POLYGONAL_TYPE_LABELS[input.type]],
    ["Método", input.type === "open_uncontrolled" ? "Sin corrección: la abierta sin control no cierra" : CORRECTION_METHOD_LABELS[input.method]],
    ["Tipo de ángulo", ANGLE_TYPE_LABELS[detected.angleType]],
    ["Ubicación", process.location ?? null],
    ["Responsable", process.responsible ?? null],
    ["Equipo", process.equipment],
    ["Punto de partida", process.startPointCode],
  ]);
  writeTableHeaders(ws, labelRow, input.type);

  const n = input.stations.length;
  const isClosed = input.type === "closed";
  const isOpenControlled = input.type === "open_controlled";
  const sideCount = isClosed ? (input.hasOrientation ? n - 1 : n) : n - 1;
  const partida = labelRow + 2;
  const row = (i: number) => labelRow + 3 + i;
  const computed = result.stations.some((s) => finite(s.north)) && input.method !== "least_squares";

  // Columnas auxiliares, a la derecha de las coordenadas.
  let next = P.east + 1;
  const dirCol = isOpenControlled ? next++ : 0;
  const observed = isOpenControlled ? observedAzimuths(input) : [];
  const doAngular = isOpenControlled && finite(input.endAzimuth) && finite(input.stations[n - 1]?.angle);
  const rawCol = doAngular ? next++ : 0;

  // --- Partida: el azimut del amarre o del primer lado -------------------------
  putLabel(ws, P.station, partida, input.hasOrientation ? "Amarre" : "Partida");
  const [sg, sm, ss] = dmsData(input.startAzimuth);
  putData(ws, P.zG, partida, sg, FMT.deg);
  putData(ws, P.zM, partida, sm, FMT.min);
  putData(ws, P.zS, partida, ss, FMT.sec);
  const startAz = putFormula(ws, P.zDec, partida, `${at(P.zG, partida)}+${at(P.zM, partida)}/60+${at(P.zS, partida)}/3600`, input.startAzimuth, FMT.dec);

  // --- Las estaciones: datos ------------------------------------------------------
  input.stations.forEach((s, i) => {
    const r = row(i);
    putData(ws, P.station, r, s.pointCode);
    const sighted = i < sideCount ? (input.stations[i + 1] ?? input.stations[0])?.pointCode ?? null : null;
    if (sighted) ws.getCell(r, P.sighted).value = sighted;
    if (finite(s.angle)) {
      const [g, m, sec] = dmsData(s.angle);
      putData(ws, P.aG, r, g, FMT.deg);
      putData(ws, P.aM, r, m, FMT.min);
      putData(ws, P.aS, r, sec, FMT.sec);
      putFormula(ws, P.aDec, r, `${at(P.aG, r)}+${at(P.aM, r)}/60+${at(P.aS, r)}/3600`, s.angle, FMT.dec);
    }
    if (i < sideCount && finite(s.distance)) putData(ws, P.dist, r, s.distance, FMT.coord);
    if (dirCol && i > 0) ws.getCell(r, dirCol).value = s.deflectionDirection === "left" ? "I" : "D";
  });
  if (dirCol) putLabel(ws, dirCol, labelRow, "DIR.", "header");
  putData(ws, P.north, row(0), input.startNorth, FMT.coord);
  putData(ws, P.east, row(0), input.startEast, FMT.coord);

  const sumRow = row(n);
  const blockRow = sumRow + 2;

  let end = blockRow + 1;
  const adjustment = result.adjustment;
  if (input.method === "least_squares") {
    if (adjustment?.status === "adjusted" && result.stations.some((s) => finite(s.north))) {
      end = writeLeastSquares(ws, { input, detected, row, sideCount, startAz, sumRow, blockRow, next, dirCol, adjustment });
    } else {
      putLabel(ws, P.station, blockRow, leastSquaresReason(adjustment), "section");
    }
  } else if (computed) {
    end = writeComputation(ws, { input, detected, row, sideCount, startAz, sumRow, blockRow, next, dirCol, rawCol, observed, doAngular });
  } else {
    putLabel(ws, P.station, blockRow, "Datos incompletos: el cálculo aparece al completar la poligonal.", "section");
  }

  if (process.georeference) writeGeoreference(ws, end + 2, process.georeference);
  setLayout(ws, {
    frozenRows: labelRow + 1,
    widths: [10, 10, 6, 5, 7, 12, 11, 6, 5, 7, 12, 6, 5, 7, 12, 11, 12, 12, 10, 10, 12, 12, 14, 14, 8, 12, 12, 12, 12],
  });
  sheetSummary(wb, process, project);
  return wb;
}

function writeTableHeaders(ws: ExcelJS.Worksheet, r: number, type: PolygonalType): void {
  const groups: [number, string][] = [
    [P.station, "ESTACIÓN"], [P.sighted, "VISADO"],
    [P.aG, type === "open_controlled" ? "DEFLEXIÓN" : "ÁNG. HORIZONTAL"],
    [P.corr, "CORR."], [P.cG, "ÁNG. CORREGIDO"], [P.zG, "AZIMUT"],
    [P.dist, "DIST."], [P.pN, "PROYECCIONES"], [P.kN, "CORRECCIÓN"],
    [P.uN, "PROY. CORREGIDAS"], [P.north, "COORDENADAS"],
  ];
  for (let c = P.station; c <= P.east; c++) putLabel(ws, c, r, "", "header");
  for (const [c, label] of groups) putLabel(ws, c, r, label, "header");
  const units: [number, string][] = [
    [P.aG, "G"], [P.aM, "M"], [P.aS, "S"], [P.aDec, "DEC"], [P.corr, "DEC"],
    [P.cG, "G"], [P.cM, "M"], [P.cS, "S"], [P.cDec, "DEC"],
    [P.zG, "G"], [P.zM, "M"], [P.zS, "S"], [P.zDec, "DEC"], [P.dist, "m"],
    [P.pN, "N-S"], [P.pE, "E-W"], [P.kN, "N"], [P.kE, "E"], [P.uN, "N"], [P.uE, "E"], [P.north, "N"], [P.east, "E"],
  ];
  for (let c = P.station; c <= P.east; c++) putLabel(ws, c, r + 1, "", "header");
  for (const [c, label] of units) putLabel(ws, c, r + 1, label, "header");
}

interface ComputationArgs {
  input: PolygonalInput;
  detected: Detected;
  row: (i: number) => number;
  sideCount: number;
  startAz: string;
  sumRow: number;
  blockRow: number;
  next: number;
  dirCol: number;
  rawCol: number;
  observed: (number | null)[];
  doAngular: boolean;
}

/** La celda con referencia absoluta: `D30` → `$D$30`. */
const absolute = (cell: string) => cell.replace(/^([A-Z]+)(\d+)$/, "$$$1$$$2");

/** Bowditch, Tránsito y Crandall, en las tres poligonales. Devuelve la última fila usada. */
function writeComputation(ws: ExcelJS.Worksheet, a: ComputationArgs): number {
  const { input, detected, row, sideCount, startAz, sumRow, blockRow } = a;
  const { result } = detected;
  const st = result.stations;
  const n = input.stations.length;
  const isClosed = input.type === "closed";
  const isOC = input.type === "open_controlled";
  const isOU = input.type === "open_uncontrolled";
  const first = row(0);
  const lastSide = row(sideCount - 1);
  const block = new Block(ws, blockRow);

  // --- Cierre angular --------------------------------------------------------------
  let corrCell: string | null = null;
  let angularErr: string | null = null;
  let angularN: string | null = null;
  const firstParticipating = isClosed && input.hasOrientation && !input.hasClosingRow ? 1 : 0;
  if (isClosed && finite(result.angleSum) && finite(result.theoreticalSum) && finite(result.angularError)) {
    const count = n - firstParticipating;
    const vertexCount = input.hasOrientation ? n - 1 : n;
    block.section("Cierre angular");
    angularN = block.data("Ángulos en la condición", count);
    const sum = block.formula("Σ ángulos observados (°)", `SUM(${at(P.aDec, row(firstParticipating))}:${at(P.aDec, row(n - 1))})`, result.angleSum, FMT.dec);
    const v = block.data("Vértices", vertexCount);
    const base = detected.angleType === "exterior" ? `(${v}+2)*180` : `(${v}-2)*180`;
    const two = input.hasOrientation && input.hasClosingRow;
    const theo = block.formula(
      "Suma teórica (°)",
      two ? `${base}+360*IF(ROUND((${sum}-${base})/360,0)=0,0,1)` : base,
      result.theoreticalSum,
      FMT.dec,
    );
    angularErr = block.formula("Error angular (″)", `(${sum}-${theo})*3600`, result.angularError, FMT.sec);
    corrCell = block.formula("Corrección por ángulo (°)", `-(${sum}-${theo})/${angularN}`, -result.angularError / 3600 / count, FMT.dec);
  }
  if (isOC && a.doAngular && finite(result.angularError)) {
    block.section("Cierre angular");
    angularN = block.data("Deflexiones en la condición", n - 1);
    const calc = block.formula("Azimut calculado de llegada (°)", at(a.rawCol, row(n - 1)), a.observed[n - 1] ?? null, FMT.dec);
    const known = block.data("Azimut de llegada conocido (°)", input.endAzimuth!, FMT.dec);
    const errDeg = block.formula("Error angular (°)", `MOD(${calc}-${known}+540,360)-180`, result.angularError / 3600, FMT.dec);
    angularErr = block.formula("Error angular (″)", `${errDeg}*3600`, result.angularError, FMT.sec);
    corrCell = block.formula("Corrección por deflexión (°)", `-${errDeg}/${angularN}`, -result.angularError / 3600 / (n - 1), FMT.dec);
  }

  // --- Ángulos corregidos y azimuts -------------------------------------------------
  const dirOf = (r: number) => (a.dirCol ? `IF(${at(a.dirCol, r)}="I",-1,1)` : "1");
  input.stations.forEach((s, i) => {
    const r = row(i);
    const az = st[i]?.azimuth;
    if (isClosed && finite(s.angle)) {
      const corrected = st[i]?.correctedAngle ?? s.angle;
      const participates = i >= firstParticipating && corrCell;
      if (participates) putFormula(ws, P.corr, r, absolute(corrCell!), -result.angularError! / 3600 / (n - firstParticipating), FMT.dec);
      const dec = putFormula(ws, P.cDec, r, participates ? `${at(P.aDec, r)}+${at(P.corr, r)}` : at(P.aDec, r), corrected, FMT.dec);
      writeDmsOf(ws, r, [P.cG, P.cM, P.cS], dec, corrected);
    }
    if (isOC && i > 0 && i < sideCount && finite(s.angle)) {
      const sign = s.deflectionDirection === "left" ? -1 : 1;
      const corr = corrCell ? -result.angularError! / 3600 / (n - 1) : 0;
      if (corrCell) putFormula(ws, P.corr, r, absolute(corrCell), corr, FMT.dec);
      putFormula(ws, P.cDec, r, corrCell ? `${dirOf(r)}*${at(P.aDec, r)}+${at(P.corr, r)}` : `${dirOf(r)}*${at(P.aDec, r)}`, sign * s.angle + corr, FMT.dec);
    }
    if (a.rawCol && i > 0 && finite(s.angle)) {
      const prev = i === 1 ? at(P.zDec, row(0)) : at(a.rawCol, row(i - 1));
      putFormula(ws, a.rawCol, r, `MOD(${prev}+${dirOf(r)}*${at(P.aDec, r)},360)`, a.observed[i] ?? null, FMT.dec);
    }
    if (!finite(az)) return;
    let formula: string;
    if (i === 0) {
      formula = input.hasOrientation
        ? `MOD(${startAz}+${isClosed ? at(P.cDec, r) : at(P.aDec, r)},360)`
        : startAz;
    } else if (isOC) {
      formula = `MOD(${at(P.zDec, row(i - 1))}+${at(P.cDec, r)},360)`;
    } else {
      formula = `MOD(${at(P.zDec, row(i - 1))}+180+${isClosed ? at(P.cDec, r) : at(P.aDec, r)},360)`;
    }
    const dec = putFormula(ws, P.zDec, r, formula, az, FMT.dec);
    writeDmsOf(ws, r, [P.zG, P.zM, P.zS], dec, az);
  });
  if (a.rawCol) putLabel(ws, a.rawCol, row(-2), "AZ. SIN CORREGIR", "header");

  // --- Proyecciones --------------------------------------------------------------------
  for (let i = 0; i < sideCount; i++) {
    const r = row(i);
    putFormula(ws, P.pN, r, `${at(P.dist, r)}*COS(RADIANS(${at(P.zDec, r)}))`, st[i]!.deltaNorth, FMT.coord);
    putFormula(ws, P.pE, r, `${at(P.dist, r)}*SIN(RADIANS(${at(P.zDec, r)}))`, st[i]!.deltaEast, FMT.coord);
  }
  putLabel(ws, P.station, sumRow, "SUMATORIA", "section");
  const sum = (c: number, value: number | null, fmt: string) =>
    putFormula(ws, c, sumRow, `SUM(${at(c, first)}:${at(c, lastSide)})`, value, fmt);
  const sides = st.slice(0, sideCount);
  const total = (f: (x: (typeof sides)[number]) => number | null) => sides.reduce((acc, x) => acc + (f(x) ?? 0), 0);
  const perimeter = sum(P.dist, result.perimeter, FMT.coord);
  const sumN = sum(P.pN, total((x) => x.deltaNorth), FMT.coord);
  const sumE = sum(P.pE, total((x) => x.deltaEast), FMT.coord);

  // --- Cierre lineal -------------------------------------------------------------------
  let eN: string | null = null;
  let eE: string | null = null;
  let precision: string | null = null;
  if (!isOU && finite(result.linearError)) {
    block.section("Cierre lineal");
    if (isClosed) {
      eN = block.formula("Error N (m)", sumN, result.errorNorth, FMT.coord);
      eE = block.formula("Error E (m)", sumE, result.errorEast, FMT.coord);
    } else {
      const endN = block.data("Llegada conocida N (m)", input.endNorth!, FMT.coord);
      const endE = block.data("Llegada conocida E (m)", input.endEast!, FMT.coord);
      eN = block.formula("Error N (m)", `${at(P.north, first)}+${sumN}-${endN}`, result.errorNorth, FMT.coord);
      eE = block.formula("Error E (m)", `${at(P.east, first)}+${sumE}-${endE}`, result.errorEast, FMT.coord);
    }
    const le = block.formula("Error lineal (m)", `SQRT(${eN}^2+${eE}^2)`, result.linearError, FMT.coord);
    const per = block.formula("Perímetro (m)", perimeter, result.perimeter, FMT.coord);
    const threshold = isClosed ? "1E-9" : "0";
    const rel = result.relativePrecision;
    precision = block.formula("Precisión (1:X)", `IF(${le}>${threshold},${per}/${le},"∞")`, rel === Infinity ? "∞" : rel, FMT.ratio);
  }

  // --- Correcciones y coordenadas --------------------------------------------------------
  const correction = (i: number): [number, number] => [
    (st[i]!.correctedDeltaNorth ?? 0) - (st[i]!.deltaNorth ?? 0),
    (st[i]!.correctedDeltaEast ?? 0) - (st[i]!.deltaEast ?? 0),
  ];
  if (eN && eE) {
    if (input.method === "bowditch") {
      for (let i = 0; i < sideCount; i++) {
        const r = row(i);
        const [cN, cE] = correction(i);
        putFormula(ws, P.kN, r, `-${eN}*${at(P.dist, r)}/${perimeter}`, cN, FMT.coord);
        putFormula(ws, P.kE, r, `-${eE}*${at(P.dist, r)}/${perimeter}`, cE, FMT.coord);
      }
    } else if (input.method === "transit") {
      const absN = a.next;
      const absE = a.next + 1;
      putLabel(ws, absN, row(-2), "|N-S|", "header");
      putLabel(ws, absE, row(-2), "|E-W|", "header");
      for (let i = 0; i < sideCount; i++) {
        const r = row(i);
        putFormula(ws, absN, r, `ABS(${at(P.pN, r)})`, Math.abs(st[i]!.deltaNorth ?? 0), FMT.coord);
        putFormula(ws, absE, r, `ABS(${at(P.pE, r)})`, Math.abs(st[i]!.deltaEast ?? 0), FMT.coord);
      }
      const sAbsN = putFormula(ws, absN, sumRow, `SUM(${at(absN, first)}:${at(absN, lastSide)})`, total((x) => Math.abs(x.deltaNorth ?? 0)), FMT.coord);
      const sAbsE = putFormula(ws, absE, sumRow, `SUM(${at(absE, first)}:${at(absE, lastSide)})`, total((x) => Math.abs(x.deltaEast ?? 0)), FMT.coord);
      for (let i = 0; i < sideCount; i++) {
        const r = row(i);
        const [cN, cE] = correction(i);
        putFormula(ws, P.kN, r, `-${eN}*${at(absN, r)}/${sAbsN}`, cN, FMT.coord);
        putFormula(ws, P.kE, r, `-${eE}*${at(absE, r)}/${sAbsE}`, cE, FMT.coord);
      }
    } else if (input.method === "crandall") {
      writeCrandall(ws, { ...a, eN, eE, first, lastSide, correction, block });
    }
  }
  for (let i = 0; i < sideCount; i++) {
    const r = row(i);
    const corrected = !isOU && eN;
    putFormula(ws, P.uN, r, corrected ? `${at(P.pN, r)}+${at(P.kN, r)}` : at(P.pN, r), st[i]!.correctedDeltaNorth, FMT.coord);
    putFormula(ws, P.uE, r, corrected ? `${at(P.pE, r)}+${at(P.kE, r)}` : at(P.pE, r), st[i]!.correctedDeltaEast, FMT.coord);
  }
  for (let i = 1; i <= Math.min(sideCount, n - 1); i++) {
    const r = row(i);
    putFormula(ws, P.north, r, `${at(P.north, row(i - 1))}+${at(P.uN, row(i - 1))}`, st[i]!.north, FMT.coord);
    putFormula(ws, P.east, r, `${at(P.east, row(i - 1))}+${at(P.uE, row(i - 1))}`, st[i]!.east, FMT.coord);
  }

  // --- Tolerancias y orden ---------------------------------------------------------------
  const orderEnd = writeOrder(ws, { input, detected, blockRow, angularErr, angularN, precision });
  return Math.max(block.row, orderEnd);
}

/** Crandall (de `correctDeltas`): ángulos fijos, distancias por mínimos cuadrados con peso 1/d. */
function writeCrandall(
  ws: ExcelJS.Worksheet,
  a: ComputationArgs & {
    eN: string;
    eE: string;
    first: number;
    lastSide: number;
    correction: (i: number) => [number, number];
    block: Block;
  },
): void {
  const { row, sideCount, detected, next, first, lastSide, eN, eE, block } = a;
  const st = detected.result.stations;
  const [cc, cs, ss, dd] = [next, next + 1, next + 2, next + 3];
  putLabel(ws, cc, row(-2), "d·cos²", "header");
  putLabel(ws, cs, row(-2), "d·cos·sin", "header");
  putLabel(ws, ss, row(-2), "d·sin²", "header");
  putLabel(ws, dd, row(-2), "δd", "header");
  let a11 = 0;
  let a12 = 0;
  let a22 = 0;
  const parts: { r: number; q: number; e: number; d: number }[] = [];
  for (let i = 0; i < sideCount; i++) {
    const r = row(i);
    const q = st[i]!.deltaNorth ?? 0;
    const e = st[i]!.deltaEast ?? 0;
    const d = a.input.stations[i]!.distance ?? 0;
    parts.push({ r, q, e, d });
    putFormula(ws, cc, r, `${at(P.pN, r)}^2/${at(P.dist, r)}`, (q * q) / d, FMT.coord);
    putFormula(ws, cs, r, `${at(P.pN, r)}*${at(P.pE, r)}/${at(P.dist, r)}`, (q * e) / d, FMT.coord);
    putFormula(ws, ss, r, `${at(P.pE, r)}^2/${at(P.dist, r)}`, (e * e) / d, FMT.coord);
    a11 += (q * q) / d;
    a12 += (q * e) / d;
    a22 += (e * e) / d;
  }
  block.section("Crandall: sistema 2×2");
  const A11 = block.formula("a11 = Σ d·cos²", `SUM(${at(cc, first)}:${at(cc, lastSide)})`, a11, FMT.coord);
  const A12 = block.formula("a12 = Σ d·cos·sin", `SUM(${at(cs, first)}:${at(cs, lastSide)})`, a12, FMT.coord);
  const A22 = block.formula("a22 = Σ d·sin²", `SUM(${at(ss, first)}:${at(ss, lastSide)})`, a22, FMT.coord);
  const det = a11 * a22 - a12 * a12;
  const D = block.formula("det", `${A11}*${A22}-${A12}^2`, det, FMT.coord);
  const errN = detected.result.errorNorth ?? 0;
  const errE = detected.result.errorEast ?? 0;
  const l1 = (a22 * -errN - a12 * -errE) / det;
  const l2 = (-a12 * -errN + a11 * -errE) / det;
  const L1 = block.formula("λ1", `(${A22}*-${eN}-${A12}*-${eE})/${D}`, l1, FMT.dec);
  const L2 = block.formula("λ2", `(-${A12}*-${eN}+${A11}*-${eE})/${D}`, l2, FMT.dec);
  for (const { r, q, e, d } of parts) {
    const deltaD = l1 * q + l2 * e;
    putFormula(ws, dd, r, `${L1}*${at(P.pN, r)}+${L2}*${at(P.pE, r)}`, deltaD, FMT.coord);
    putFormula(ws, P.kN, r, `${at(dd, r)}*${at(P.pN, r)}/${at(P.dist, r)}`, (deltaD * q) / d, FMT.coord);
    putFormula(ws, P.kE, r, `${at(dd, r)}*${at(P.pE, r)}/${at(P.dist, r)}`, (deltaD * e) / d, FMT.coord);
  }
}

type Adjusted = Extract<NonNullable<Detected["result"]["adjustment"]>, { status: "adjusted" }>;

function leastSquaresReason(adjustment: Detected["result"]["adjustment"]): string {
  if (!adjustment || adjustment.status === "missing_weights") {
    return "Sin pesos del ajuste: se teclean en los datos de la poligonal (σ angular, σ de distancia y mediciones).";
  }
  if (adjustment.status === "unadjustable") {
    const why = {
      one_side: "una abierta de un solo lado no tiene redundancia",
      singular: "el sistema es singular",
      not_converged: "no convergió",
    }[adjustment.reason];
    return `El ajuste no se pudo hacer: ${why}.`;
  }
  return "Datos incompletos: el cálculo aparece al completar la poligonal.";
}

/** Un valor de la app que no es dato medido ni fórmula: sin el fondo de los datos. */
function putValue(ws: ExcelJS.Worksheet, c: number, r: number, value: number | string, fmt?: string): string {
  const cell = ws.getCell(r, c);
  cell.value = value;
  if (fmt) cell.numFmt = fmt;
  return at(c, r);
}

/**
 * Mínimos cuadrados (Fase 14): los ángulos y distancias ajustados son las
 * observaciones más sus correcciones v, que son de la app; los azimuts, las
 * proyecciones y las coordenadas salen de ellos con fórmulas. Las matrices de
 * la última iteración van como valores, como los bloques de la hoja de la
 * universidad: la app itera hasta converger y una pasada de Excel no lo hace.
 */
function writeLeastSquares(
  ws: ExcelJS.Worksheet,
  a: {
    input: PolygonalInput;
    detected: Detected;
    row: (i: number) => number;
    sideCount: number;
    startAz: string;
    sumRow: number;
    blockRow: number;
    next: number;
    dirCol: number;
    adjustment: Adjusted;
  },
): number {
  const { input, detected, row, sideCount, startAz, sumRow, blockRow, adjustment: adj } = a;
  const { result } = detected;
  const st = result.stations;
  const n = input.stations.length;
  const isClosed = input.type === "closed";
  const vCol = a.next;
  const dAdjCol = a.next + 1;
  const dirOf = (r: number) => (a.dirCol ? `IF(${at(a.dirCol, r)}="I",-1,1)` : "1");
  putLabel(ws, vCol, row(-2), "v DIST. (m)", "header");
  putLabel(ws, dAdjCol, row(-2), "DIST. AJUSTADA", "header");

  // --- Ángulos ajustados y azimuts ----------------------------------------------------
  input.stations.forEach((s, i) => {
    const r = row(i);
    const corrSec = adj.angleCorrectionsSec[i];
    if (finite(s.angle)) {
      if (isClosed) {
        const adjusted = st[i]?.correctedAngle ?? s.angle;
        if (corrSec != null) putValue(ws, P.corr, r, corrSec / 3600, FMT.dec);
        const dec = putFormula(ws, P.cDec, r, corrSec != null ? `${at(P.aDec, r)}+${at(P.corr, r)}` : at(P.aDec, r), adjusted, FMT.dec);
        writeDmsOf(ws, r, [P.cG, P.cM, P.cS], dec, adjusted);
      } else if (i > 0 && corrSec != null) {
        const sign = s.deflectionDirection === "left" ? -1 : 1;
        putValue(ws, P.corr, r, corrSec / 3600, FMT.dec);
        putFormula(ws, P.cDec, r, `${dirOf(r)}*(${at(P.aDec, r)}+${at(P.corr, r)})`, sign * (s.angle + corrSec / 3600), FMT.dec);
      }
    }
    const az = st[i]?.azimuth;
    if (!finite(az)) return;
    let formula: string;
    if (i === 0) {
      formula = input.hasOrientation ? `MOD(${startAz}+${isClosed ? at(P.cDec, r) : at(P.aDec, r)},360)` : startAz;
    } else if (isClosed) {
      formula = `MOD(${at(P.zDec, row(i - 1))}+180+${at(P.cDec, r)},360)`;
    } else {
      formula = `MOD(${at(P.zDec, row(i - 1))}+${at(P.cDec, r)},360)`;
    }
    const dec = putFormula(ws, P.zDec, r, formula, az, FMT.dec);
    writeDmsOf(ws, r, [P.zG, P.zM, P.zS], dec, az);
  });

  // --- Distancias ajustadas, proyecciones y coordenadas -----------------------------------
  for (let i = 0; i < sideCount; i++) {
    const r = row(i);
    putValue(ws, vCol, r, adj.distanceCorrectionsM[i] ?? 0, FMT.coord);
    putFormula(ws, dAdjCol, r, `${at(P.dist, r)}+${at(vCol, r)}`, adj.adjustedDistances[i] ?? null, FMT.coord);
    putFormula(ws, P.pN, r, `${at(dAdjCol, r)}*COS(RADIANS(${at(P.zDec, r)}))`, st[i]!.correctedDeltaNorth, FMT.coord);
    putFormula(ws, P.pE, r, `${at(dAdjCol, r)}*SIN(RADIANS(${at(P.zDec, r)}))`, st[i]!.correctedDeltaEast, FMT.coord);
    putFormula(ws, P.uN, r, at(P.pN, r), st[i]!.correctedDeltaNorth, FMT.coord);
    putFormula(ws, P.uE, r, at(P.pE, r), st[i]!.correctedDeltaEast, FMT.coord);
  }
  for (let i = 1; i <= Math.min(sideCount, n - 1); i++) {
    const r = row(i);
    putFormula(ws, P.north, r, `${at(P.north, row(i - 1))}+${at(P.uN, row(i - 1))}`, st[i]!.north, FMT.coord);
    putFormula(ws, P.east, r, `${at(P.east, row(i - 1))}+${at(P.uE, row(i - 1))}`, st[i]!.east, FMT.coord);
  }
  putLabel(ws, P.station, sumRow, "SUMATORIA", "section");
  const first = row(0);
  const lastSide = row(sideCount - 1);
  putFormula(ws, P.dist, sumRow, `SUM(${at(P.dist, first)}:${at(P.dist, lastSide)})`, result.perimeter, FMT.coord);

  // --- El cierre antes del ajuste, con el que se juzga (valores de la app) ----------------
  let r = blockRow;
  putLabel(ws, 1, r++, "Cierre antes del ajuste (valores de la app: con él se juzga el orden)", "section");
  let angularErr: string | null = null;
  let angularN: string | null = null;
  if (finite(result.angularError) && result.angularConditionCount != null) {
    putLabel(ws, 1, r, "Ángulos en la condición");
    angularN = putValue(ws, 4, r++, result.angularConditionCount);
    putLabel(ws, 1, r, "Error angular (″)");
    angularErr = putValue(ws, 4, r++, result.angularError, FMT.sec);
  }
  putLabel(ws, 1, r, "Error lineal (m)");
  putValue(ws, 4, r++, result.linearError ?? "", FMT.coord);
  putLabel(ws, 1, r, "Precisión (1:X)");
  const rel = result.relativePrecision;
  const precision = putValue(ws, 4, r++, rel === Infinity ? "∞" : (rel ?? ""), FMT.ratio);
  const orderEnd = writeOrder(ws, { input, detected, blockRow, angularErr, angularN, precision });

  // --- Las matrices de la última iteración --------------------------------------------------
  r = Math.max(r, orderEnd) + 2;
  const m = adj.matrices;
  putLabel(ws, 1, r++, `Matrices de la última iteración del ajuste (${adj.iterations} iteraciones; σ₀ = ${adj.sigma0.toFixed(3)})`, "section");
  putLabel(ws, 1, r++, "Observaciones en radianes (ángulos) y metros (distancias), en el orden del modelo.");
  const matrix = (title: string, rows: number[][]) => {
    putLabel(ws, 1, r++, title, "section");
    for (const line of rows) {
      line.forEach((x, c) => putValue(ws, 1 + c, r, x, "0.000000000"));
      r += 1;
    }
  };
  const v = m.q.map((qx, x) => qx * m.A.reduce((acc, line, i) => acc + line[x]! * m.k[i]!, 0));
  matrix("Observaciones l₀", [m.observations]);
  matrix("Matriz A", m.A);
  matrix("Q (diagonal)", [m.q]);
  matrix("w", m.w.map((x) => [x]));
  matrix("N = A·Q·Aᵀ", m.N);
  matrix("k", m.k.map((x) => [x]));
  matrix("v", [v]);

  // --- La precisión de cada punto (Fase 39): valores de la app, como las matrices ------
  const pr = adj.precision;
  r += 1;
  putLabel(
    ws,
    1,
    r++,
    `Precisión de cada punto: σ (1σ) con el σ₀ del ajuste, y elipse de error al ${Math.round(pr.confidence * 100)} %, ` +
      `estándar × c = ${pr.scale.toFixed(3)} con r = ${adj.conditions} (Ghilani y Wolf, ec. 19.22)`,
    "section",
  );
  ["Punto", "σ N (mm)", "σ E (mm)", "Semieje mayor (mm)", "Semieje menor (mm)", "Azimut del mayor (°)"].forEach((h, c) =>
    putLabel(ws, 1 + c, r, h, "header"),
  );
  r += 1;
  st.forEach((s, i) => {
    const p = pr.stations[i];
    putValue(ws, 1, r, s.pointCode);
    if (!p) {
      putValue(ws, 2, r, "Punto fijo");
    } else {
      putValue(ws, 2, r, p.sigmaNorth * 1000, FMT.mm);
      putValue(ws, 3, r, p.sigmaEast * 1000, FMT.mm);
      putValue(ws, 4, r, p.ellipse.semiMajor * 1000, FMT.mm);
      putValue(ws, 5, r, p.ellipse.semiMinor * 1000, FMT.mm);
      putValue(ws, 6, r, p.ellipse.majorAzimuth, FMT.dec);
    }
    r += 1;
  });
  return r;
}

/** Las tolerancias por orden y el orden alcanzado, con la regla de `detectPrecisionOrder`. */
export function writeOrder(
  ws: ExcelJS.Worksheet,
  {
    input,
    detected,
    blockRow,
    angularErr,
    angularN,
    precision,
  }: {
    input: PolygonalInput;
    detected: Detected;
    blockRow: number;
    angularErr: string | null;
    angularN: string | null;
    precision: string | null;
  },
): number {
  const col = 8;
  const tol = writePolygonalTolerances(ws, col, blockRow);
  const r0 = blockRow + 2 + PRECISION_ORDERS.length + 1;
  if (input.type === "open_uncontrolled" || !precision) {
    putLabel(ws, col, r0, "Orden alcanzado");
    putData(ws, col + 3, r0, "Sin verificación");
    return r0;
  }
  const count = detected.result.angularConditionCount;
  const angularOk = (o: PrecisionOrder, i: number) => {
    if (!angularErr || !angularN || count == null) return "TRUE";
    putLabel(ws, col, r0 + 1 + i, `Tolerancia angular · ${PRECISION_ORDER_LABELS[o]} (″)`);
    const cell = putFormula(ws, col + 3, r0 + 1 + i, `${tol[o].angularK}*SQRT(${angularN})`, angularTolerance(o, count), FMT.sec);
    return `ABS(${angularErr})<=${cell}+1E-9`;
  };
  const conds = PRECISION_ORDERS.map((o, i) => `AND(${angularOk(o, i)},IF(ISNUMBER(${precision}),${precision}>=${tol[o].minPrecision},TRUE))`);
  const reached = detected.order ? PRECISION_ORDER_LABELS[detected.order] : "Ninguno";
  const formula = PRECISION_ORDERS.reduceRight(
    (rest, o, i) => `IF(${conds[i]},"${PRECISION_ORDER_LABELS[o]}",${rest})`,
    `"Ninguno"`,
  );
  const orderRow = r0 + PRECISION_ORDERS.length + 2;
  putLabel(ws, col, orderRow, "Orden alcanzado", "section");
  const order = putFormula(ws, col + 3, orderRow, formula, reached);
  putLabel(ws, col, orderRow + 1, "Veredicto", "section");
  const verdict = putFormula(ws, col + 3, orderRow + 1, `IF(${order}="Ninguno","NO CUMPLE","CUMPLE")`, detected.order ? "CUMPLE" : "NO CUMPLE");
  verdictFormatting(ws, verdict);
  return orderRow + 1;
}

/** Un bloque de pares rótulo/valor debajo de la tabla: rótulo en A, valor en D. */
export class Block {
  private started = false;
  constructor(
    private readonly ws: ExcelJS.Worksheet,
    private r: number,
  ) {}
  /** La última fila usada. */
  get row(): number {
    return this.r - 1;
  }
  section(label: string): void {
    if (this.started) this.r += 1;
    this.started = true;
    putLabel(this.ws, 1, this.r, label, "section");
    this.r += 1;
  }
  data(label: string, value: number | string, fmt?: string): string {
    putLabel(this.ws, 1, this.r, label);
    const cell = putData(this.ws, 4, this.r, value, fmt);
    this.r += 1;
    return cell;
  }
  formula(label: string, formula: string, result: number | string | null, fmt?: string): string {
    putLabel(this.ws, 1, this.r, label);
    const cell = putFormula(this.ws, 4, this.r, formula, result, fmt);
    this.r += 1;
    return cell;
  }
}

function writeGeoreference(
  ws: ExcelJS.Worksheet,
  r: number,
  g: NonNullable<PolygonalSheetProcess["georeference"]>,
): void {
  putLabel(ws, 1, r, "Georreferenciación", "section");
  const pairs: [string, string | number | null, string?][] = [
    ["Fecha", g.date],
    ["Puntos de control", g.points],
    ["Rotación (°)", g.rotationDeg, FMT.dec],
    ["Escala", g.scale, "0.0000000"],
  ];
  pairs.forEach(([label, value, fmt], i) => {
    putLabel(ws, 1, r + 1 + i, label);
    if (value !== null) putData(ws, 4, r + 1 + i, value, fmt);
  });
  putLabel(ws, 1, r + 6, "La poligonal ya está en el sistema georreferenciado: sus datos son los transformados.");
}

function sheetSummary(wb: ExcelJS.Workbook, process: PolygonalSheetProcess, project: ProjectMetadata | null): void {
  const ws = wb.addWorksheet("Resumen");
  writeSheetHeader(ws, `${process.name} — resumen`, [
    ...projectPairs(project),
    ["Proceso", process.name],
    ["Equipo", process.equipment],
    ["Notas", process.notes],
    ["Cómo leer el libro", "Las celdas con fondo amarillo son datos medidos o tecleados; el resto se calcula con fórmulas y se recalcula si cambia un dato."],
  ]);
  ws.columns = [{ width: 22 }, { width: 2 }, { width: 70 }];
}
