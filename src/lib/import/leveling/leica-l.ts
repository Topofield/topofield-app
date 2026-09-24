// Lector del `.L` de un nivel digital Leica (Fase 16). Puro: texto de entrada,
// forma intermedia de salida.
//
// Ancho fijo con terminadores CRLF. Los offsets están MEDIDOS sobre el crudo
// real (docs/carteras/analisis-crudo-nivel-digital.md), no contados a ojo: un
// primer intento aproximado dio todos los puntos como `C10`.
//
//   G    1.6494m    48.847m 2541.7545m1     0.3 mmC10     C10      3B1
//   0    1-12       12-23   23-34      34-40 40-44 46-54   54-63    63-66

import type { ImportedLevelingFile, ReadResult, Setup, Sight } from "./types";

const HEADER = /^B(\S+)\s+(-?\d+\.\d+)m/;
const SUMMARY = /^W\s+(-?\d+\.\d+)m\s+(\d+\.\d+)m/;
const METERS = /^\s*(-?\d+\.\d+)m\s*$/;

function meters(field: string): number | null {
  const m = METERS.exec(field);
  return m ? Number(m[1]) : null;
}

function lines(text: string): string[] {
  return text.split(/\r?\n/).filter((l) => l.trim() !== "");
}

/** ¿Es un `.L` de Leica? Por el contenido, no por la extensión. */
export function isLeicaL(text: string): boolean {
  const all = lines(text);
  return (
    all.length > 1 &&
    HEADER.test(all[0]!) &&
    all.some((l) => (l[0] === "G" || l[0] === "I") && meters(l.slice(1, 12)) != null)
  );
}

interface Measure {
  kind: "G" | "I";
  setup: number;
  point: string;
  /** Lectura en décimas de mm y distancia en mm: enteros, para promediar sin
   *  arrastrar el error de coma flotante al redondeo. */
  reading: number;
  distance: number | null;
  sigmaMm: number | null;
}

function parseMeasure(line: string): Measure | null {
  const reading = meters(line.slice(1, 12));
  const distance = meters(line.slice(12, 23));
  const setup = Number(line.slice(34, 40).trim());
  const point = line.slice(46, 54).trim();
  if (reading == null || !Number.isInteger(setup) || setup < 1 || point === "") return null;
  const sigma = Number(line.slice(40, 44).trim());
  return {
    kind: line[0] as "G" | "I",
    setup,
    point,
    reading: Math.round(reading * 10000),
    distance: distance != null ? Math.round(distance * 1000) : null,
    sigmaMm: Number.isFinite(sigma) ? sigma : null,
  };
}

/** Promedio de enteros redondeado a entero: la resolución de la columna. */
function mean(values: number[]): number {
  return Math.round(values.reduce((a, b) => a + b, 0) / values.length);
}

export function readLeicaL(text: string): ReadResult {
  const all = lines(text);
  const header = HEADER.exec(all[0] ?? "");
  if (!header) return { ok: false, error: "El archivo no empieza con la línea de partida (B)." };

  const warnings: string[] = [];
  const measures: Measure[] = [];
  let summary: ImportedLevelingFile["instrumentSummary"] = null;
  let ignored = 0;
  let malformed = 0;

  for (const line of all.slice(1)) {
    const kind = line[0];
    if (kind === "G" || kind === "I") {
      const m = parseMeasure(line);
      if (m) measures.push(m);
      else malformed += 1;
    } else if (kind === "W") {
      const w = SUMMARY.exec(line);
      if (w) summary = { heightDifference: Number(w[1]), distance: Number(w[2]) };
    } else {
      ignored += 1;
    }
  }
  if (ignored > 0) warnings.push(`Se ignoraron ${ignored} líneas de un tipo que no se lee.`);
  if (malformed > 0) warnings.push(`${malformed} líneas de medición no tenían la forma esperada y se omitieron.`);

  // Repeticiones de la misma visual: misma armada, mismo sentido, mismo punto.
  const groups = new Map<string, Measure[]>();
  for (const m of measures) {
    const key = `${m.setup}|${m.kind}|${m.point}`;
    const g = groups.get(key);
    if (g) g.push(m);
    else groups.set(key, [m]);
  }

  // Sin repeticiones no hay dispersión que medir: null, no 0.
  let maxSpread: number | null = null;
  for (const g of groups.values()) {
    if (g.length < 2) continue;
    const r = g.map((m) => m.reading);
    maxSpread = Math.max(maxSpread ?? 0, Math.max(...r) - Math.min(...r));
  }
  const sigmas = measures.map((m) => m.sigmaMm).filter((s): s is number => s != null);

  const toSight = (g: Measure[]): Sight => {
    const distances = g.map((m) => m.distance).filter((d): d is number => d != null);
    return {
      point: g[0]!.point,
      reading: mean(g.map((m) => m.reading)) / 10000,
      distance: distances.length > 0 ? mean(distances) / 1000 : null,
    };
  };

  const setupNumbers = [...new Set(measures.map((m) => m.setup))].sort((a, b) => a - b);
  const setups: Setup[] = [];
  for (const n of setupNumbers) {
    const own = [...groups.values()].filter((g) => g[0]!.setup === n);
    const back = own.filter((g) => g[0]!.kind === "G");
    const fores = own.filter((g) => g[0]!.kind === "I");
    if (back.length !== 1 || fores.length === 0) {
      warnings.push(`La armada ${n} no tiene una visual atrás y al menos una adelante; se omitió.`);
      continue;
    }
    setups.push({ back: toSight(back[0]!), fores: fores.map(toSight) });
  }

  if (setups.length === 0) return { ok: false, error: "El archivo no trae ninguna armada completa." };

  return {
    ok: true,
    file: {
      format: "leica-l",
      startPoint: { code: header[1]!, elevation: Number(header[2]) },
      setups,
      rawSights: measures.length,
      quality: {
        maxRepeatSpreadMm: maxSpread != null ? maxSpread / 10 : null,
        maxSigmaMm: sigmas.length > 0 ? Math.max(...sigmas) : null,
      },
      instrumentSummary: summary,
      declared: null,
      warnings,
    },
  };
}
