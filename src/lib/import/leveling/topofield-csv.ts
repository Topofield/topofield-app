// Lector de la plantilla CSV de TopoField (Fase 16), para quien traiga un
// instrumento que todavía no sabemos leer. Una fila por fila de libreta, como
// la tabla de captura. Puro.
//
//   recorrido,punto,tipo,v_mas,v_menos,dist_mas,dist_menos
//   ida,C10,bm,1.6490,,48.843,
//   ida,C11,,1.7122,1.5261,42.218,46.853

import type { PointType } from "@/types/leveling";
import type { ReadResult, Setup } from "./types";

export const CSV_COLUMNS = [
  "recorrido",
  "punto",
  "tipo",
  "v_mas",
  "v_menos",
  "dist_mas",
  "dist_menos",
] as const;

const TYPES: Record<string, PointType> = {
  bm: "bm",
  pc: "pc",
  radiacion: "intermediate",
  "radiación": "intermediate",
  intermedio: "intermediate",
};

function rows(text: string): string[] {
  return text
    .replace(/^﻿/, "")
    .split(/\r?\n/)
    .filter((l) => l.trim() !== "");
}

/** `;` si la cabecera lo usa: es lo que exporta Excel en español, con coma decimal. */
function separatorOf(header: string): "," | ";" {
  return header.includes(";") ? ";" : ",";
}

/**
 * Celdas de una línea, respetando comillas: Excel entrecomilla una celda que
 * contiene el separador («"PC,1"»), y partirla corría todas las columnas.
 */
function cells(line: string, sep: string): string[] {
  const out: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (ch === '"') {
      if (quoted && line[i + 1] === '"') {
        cur += '"';
        i += 1;
      } else {
        quoted = !quoted;
      }
    } else if (ch === sep && !quoted) {
      out.push(cur.trim());
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur.trim());
  return out;
}

/** ¿Es la plantilla de TopoField? Por su cabecera, que es obligatoria. */
export function isTopofieldCsv(text: string): boolean {
  const first = rows(text)[0];
  if (!first) return false;
  const head = cells(first, separatorOf(first)).map((c) => c.toLowerCase());
  return CSV_COLUMNS.every((col, i) => head[i] === col);
}

export function readTopofieldCsv(text: string): ReadResult {
  const all = rows(text);
  const sep = separatorOf(all[0] ?? "");
  const decimalComma = sep === ";";
  const num = (cell: string, decimals: number): number | null | "error" => {
    if (cell === "") return null;
    const n = Number(decimalComma ? cell.replace(",", ".") : cell);
    if (!Number.isFinite(n)) return "error";
    return Math.round(n * 10 ** decimals) / 10 ** decimals;
  };

  type Run = "ida" | "vuelta";
  const runs: Record<Run, { setups: Setup[]; types: (PointType | null)[] }> = {
    ida: { setups: [], types: [] },
    vuelta: { setups: [], types: [] },
  };
  const open: Record<Run, Setup | null> = { ida: null, vuelta: null };
  const lastWasForeOnly: Record<Run, boolean> = { ida: false, vuelta: false };

  for (const [i, line] of all.slice(1).entries()) {
    const fila = i + 2;
    const [recorrido = "", punto = "", tipo = "", vMas = "", vMenos = "", dMas = "", dMenos = ""] =
      cells(line, sep);
    const run = recorrido.toLowerCase();
    if (run !== "ida" && run !== "vuelta") {
      return { ok: false, error: `Fila ${fila}: el recorrido debe ser «ida» o «vuelta».` };
    }
    if (punto === "") return { ok: false, error: `Fila ${fila}: falta el punto.` };
    const type = tipo === "" ? null : (TYPES[tipo.toLowerCase()] ?? undefined);
    if (type === undefined) {
      return { ok: false, error: `Fila ${fila}: el tipo debe ser bm, pc o radiacion, o ir vacío.` };
    }
    const back = num(vMas, 4);
    const fore = num(vMenos, 4);
    const backD = num(dMas, 3);
    const foreD = num(dMenos, 3);
    if ([back, fore, backD, foreD].includes("error")) {
      return { ok: false, error: `Fila ${fila}: hay un número que no se entiende.` };
    }
    if (back == null && fore == null) {
      return { ok: false, error: `Fila ${fila}: sin V+ ni V−.` };
    }

    const r = runs[run];
    // Un punto de cambio escrito en dos filas —V− en una, V+ en la siguiente,
    // mismo punto— es una sola fila de libreta: `toLibreta` las junta, así
    // que aquí se junta también su tipo, o los declarados se correrían.
    const cur0 = open[run];
    const splitChange =
      back != null && fore == null && cur0 != null && cur0.fores.at(-1)?.point === punto &&
      lastWasForeOnly[run];
    if (splitChange) {
      if (type != null) r.types[r.types.length - 1] = type;
    } else {
      r.types.push(type);
    }
    lastWasForeOnly[run] = fore != null && back == null;
    // La V− cierra una visual adelante de la armada abierta; la V+ abre la
    // siguiente. Una fila de punto de cambio trae las dos, en ese orden.
    if (fore != null) {
      const cur = open[run];
      if (!cur) return { ok: false, error: `Fila ${fila}: una V− sin una V+ antes en su recorrido.` };
      cur.fores.push({ point: punto, reading: fore as number, distance: foreD as number | null });
    }
    if (back != null) {
      const cur = open[run];
      if (cur) {
        if (cur.fores.length === 0) {
          return { ok: false, error: `Fila ${fila}: dos V+ seguidas, sin V− entre ellas.` };
        }
        r.setups.push(cur);
      }
      open[run] = { back: { point: punto, reading: back as number, distance: backD as number | null }, fores: [] };
    }
  }

  for (const run of ["ida", "vuelta"] as const) {
    const cur = open[run];
    if (cur && cur.fores.length === 0) {
      return { ok: false, error: `El recorrido de ${run} termina con una V+ sin V−.` };
    }
    if (cur) runs[run].setups.push(cur);
  }
  if (runs.ida.setups.length === 0) {
    return { ok: false, error: "La plantilla no trae ninguna armada de ida." };
  }

  const hasReturn = runs.vuelta.setups.length > 0;
  return {
    ok: true,
    file: {
      format: "topofield-csv",
      startPoint: { code: runs.ida.setups[0]!.back.point, elevation: null },
      setups: [...runs.ida.setups, ...runs.vuelta.setups],
      rawSights: runs.ida.setups.concat(runs.vuelta.setups).reduce((a, s) => a + 1 + s.fores.length, 0),
      quality: { maxRepeatSpreadMm: null, maxSigmaMm: null },
      instrumentSummary: null,
      declared: {
        turnSetup: hasReturn ? runs.ida.setups.length + 1 : null,
        forwardTypes: runs.ida.types,
        returnTypes: runs.vuelta.types,
      },
      warnings: [],
    },
  };
}

/** La plantilla descargable: cabecera, dos filas de ejemplo y el cierre. */
export const CSV_TEMPLATE = [
  CSV_COLUMNS.join(","),
  "ida,BM-1,bm,1.6490,,48.843,",
  "ida,PC-1,,1.7122,1.5261,42.218,46.853",
  "ida,BM-1,bm,,1.8339,,40.396",
].join("\n");
