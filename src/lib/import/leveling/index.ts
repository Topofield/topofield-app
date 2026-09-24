// Detector de formatos de libreta (Fase 16). Cada lector declara cómo
// reconoce su formato por el CONTENIDO —un archivo renombrado sigue
// leyéndose— y todos desembocan en la misma forma intermedia. Añadir un
// instrumento es escribir un lector y registrarlo aquí.

import { isLeicaL, readLeicaL } from "./leica-l";
import { isTopofieldCsv, readTopofieldCsv } from "./topofield-csv";
import type { ImportFormat, ReadResult } from "./types";

interface Reader {
  format: ImportFormat;
  label: string;
  detect: (text: string) => boolean;
  read: (text: string) => ReadResult;
}

export const READERS: Reader[] = [
  { format: "leica-l", label: "Archivo .L de nivel digital Leica", detect: isLeicaL, read: readLeicaL },
  {
    format: "topofield-csv",
    label: "Plantilla CSV de TopoField",
    detect: isTopofieldCsv,
    read: readTopofieldCsv,
  },
];

export const FORMAT_LABELS = Object.fromEntries(
  READERS.map((r) => [r.format, r.label]),
) as Record<ImportFormat, string>;

/**
 * Lee un archivo de libreta con el primer lector que lo reconozca. Si ninguno
 * lo hace, el error dice qué formatos se entienden: un «formato inválido» a
 * secas deja al usuario sin salida.
 */
export function readLevelingFile(text: string): ReadResult {
  const reader = READERS.find((r) => r.detect(text));
  if (!reader) {
    return {
      ok: false,
      error: `No se reconoce el formato del archivo. Se leen: ${READERS.map((r) => r.label).join(" y ")}.`,
    };
  }
  return reader.read(text);
}

/**
 * El texto de un archivo. Excel en español guarda el CSV en Windows-1252:
 * leído como UTF-8, «radiación» llegaba como «radiaci�n» y la fila no se
 * entendía. Se intenta UTF-8 estricto y, si no lo es, Windows-1252.
 */
export function decodeFileBytes(bytes: ArrayBuffer | Uint8Array): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder("windows-1252").decode(bytes);
  }
}

export type { ImportedLevelingFile, LibretaRow, ReadResult } from "./types";
export { CSV_TEMPLATE } from "./topofield-csv";
export { detectTurnSetup, proposedLevelingType, toLibreta, type ImportMode } from "./to-libreta";
