// Construcción de los libros de Excel de la § 4.8: tres hojas por proceso
// —«Datos Crudos», «Cálculos» y «Resumen»—, disponibles en cualquier estado.
//
// El estilo sigue el de `scripts/build-poligonal-excel.mjs`, que ya fijó las
// convenciones del dominio para la plantilla de poligonales. Ese script NO se
// reutiliza como código: genera una plantilla con fórmulas de ejemplo, mientras
// que esto emite los datos de un proceso concreto.
//
// Los decimales son los de CLAUDE.md: coordenadas a 3, cotas a 4, ángulos en
// DMS (tres columnas separadas, nunca decimal).

import ExcelJS from "exceljs";

import { formatEquipmentLine } from "@/lib/utils/format";

const ACCENT = "FF0B3D5C";
const HEADER_FILL: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FFF2F3F4" },
};

/** Decimales por tipo de magnitud, según CLAUDE.md. */
export const DECIMALS = {
  /** Coordenadas N/E y distancias, en metros. */
  coordinate: 3,
  /** Cotas, en metros. */
  elevation: 4,
  /** Milímetros y valores de dos decimales. */
  mm: 2,
} as const;

function styleTitle(cell: ExcelJS.Cell): void {
  cell.font = { bold: true, size: 14, color: { argb: ACCENT } };
}

function styleSection(cell: ExcelJS.Cell): void {
  cell.font = { bold: true, size: 11, color: { argb: ACCENT } };
}

function styleHeader(cell: ExcelJS.Cell): void {
  cell.font = { bold: true };
  cell.fill = HEADER_FILL;
  cell.border = { bottom: { style: "thin", color: { argb: "FFB0B0B0" } } };
  cell.alignment = { vertical: "middle", wrapText: true };
}

/** Escribe una fila de encabezados con el estilo del libro. */
export function setHeaders(
  sheet: ExcelJS.Worksheet,
  row: number,
  labels: string[],
): void {
  labels.forEach((label, i) => {
    const cell = sheet.getCell(row, i + 1);
    cell.value = label;
    styleHeader(cell);
  });
}

/** Título de hoja en A1. */
export function setSheetTitle(sheet: ExcelJS.Worksheet, title: string): void {
  const cell = sheet.getCell("A1");
  cell.value = title;
  styleTitle(cell);
}

/**
 * Escribe una fila de datos aplicando formato numérico por columna.
 *
 * `formats` empareja por índice con `values`: `null` deja la celda sin formato
 * (texto), un número fija esa cantidad de decimales. Un valor `null` o
 * `undefined` se escribe como celda vacía y **no** como 0 ni como "—": en una
 * hoja de cálculo un cero es un dato, no una ausencia.
 */
export function writeRow(
  sheet: ExcelJS.Worksheet,
  row: number,
  values: (string | number | null | undefined)[],
  formats: (number | null)[] = [],
): void {
  values.forEach((value, i) => {
    const cell = sheet.getCell(row, i + 1);
    if (value === null || value === undefined) return;
    cell.value = value;
    const decimals = formats[i];
    if (typeof decimals === "number" && typeof value === "number") {
      cell.numFmt = `0.${"0".repeat(decimals)}`;
    }
  });
}

/** Bloque de pares etiqueta/valor, como el de la hoja «Resumen». */
export function writePairs(
  sheet: ExcelJS.Worksheet,
  startRow: number,
  pairs: [string, string | number | null | undefined][],
): number {
  let row = startRow;
  for (const [label, value] of pairs) {
    sheet.getCell(row, 1).value = label;
    sheet.getCell(row, 1).font = { color: { argb: "FF6B7280" } };
    if (value !== null && value !== undefined) {
      sheet.getCell(row, 2).value = value;
    }
    row += 1;
  }
  return row;
}

/** Encabezado de sección dentro de una hoja. */
export function writeSection(
  sheet: ExcelJS.Worksheet,
  row: number,
  label: string,
): void {
  const cell = sheet.getCell(row, 1);
  cell.value = label;
  styleSection(cell);
}

/** Libro nuevo con los metadatos del producto. */
export function newWorkbook(): ExcelJS.Workbook {
  const wb = new ExcelJS.Workbook();
  wb.creator = "TopoField";
  wb.created = new Date();
  return wb;
}

/**
 * Nombre de archivo seguro para la descarga.
 *
 * Se transliteran los acentos y se deja solo `[A-Za-z0-9-_]`: el nombre viaja
 * en la cabecera `Content-Disposition`, donde los caracteres no ASCII y las
 * comillas rompen el parseo en algunos navegadores.
 */
export function safeFilename(name: string, suffix: string): string {
  const base = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return `${base || "proceso"}-${suffix}.xlsx`;
}

/**
 * Metadatos geodésicos del proyecto, para la hoja «Resumen».
 *
 * Un `.xlsx` viaja suelto —se adjunta a un correo, se abre meses después— y
 * fuera de la aplicación nada dice en qué datum están esas coordenadas. Sin
 * estos campos, un archivo con «N=1000.000 E=1100.000» es ambiguo: la cifra
 * sola no identifica el sistema de referencia. El informe ya los lleva en su
 * portada; el libro debe llevarlos también.
 *
 * Desde la Fase 8 el orden de precisión y el equipo NO están aquí: viven en
 * cada proceso, no en el proyecto (§ precisión y equipo por proceso), así que
 * cada libro los lee de su propia fila de proceso — ver `equipmentLine` más
 * abajo — y no del proyecto.
 */
export interface ProjectMetadata {
  name: string;
  client: string | null;
  location: string | null;
  datum: string | null;
  projection: string | null;
}

/** Pares etiqueta/valor del proyecto, listos para `writePairs`. */
export function projectPairs(
  project: ProjectMetadata | null | undefined,
): [string, string | number | null][] {
  if (!project) return [];
  return [
    ["Proyecto", project.name],
    ["Cliente", project.client],
    ["Ubicación", project.location],
    ["Datum", project.datum],
    ["Proyección", project.projection],
  ];
}

/**
 * «Marca Modelo», con «· s/n Serie» si hay número de serie; `null` si no hay
 * marca ni modelo — para que `writePairs` deje la celda vacía en vez de
 * escribir un guion, que en una hoja de cálculo se leería como un dato.
 *
 * Compartida entre los tres libros que llevan equipo (poligonal: estación
 * total; nivelación y asentamientos: nivel), para no componer el mismo texto
 * tres veces.
 *
 * Delega en `formatEquipmentLine` en vez de repetir la composición: el caso
 * vacío SÍ difiere a propósito —"—" en el informe impreso, `null` en la hoja
 * de cálculo, donde un guion se leería como dato—, pero el separador y el
 * orden de los tres campos no deben poder divergir.
 */
export function equipmentLine(
  brand: string | null | undefined,
  model: string | null | undefined,
  serial: string | null | undefined,
): string | null {
  const linea = formatEquipmentLine(brand, model, serial);
  return linea === "—" ? null : linea;
}

/**
 * Los dos términos de la precisión de distancia (ISO 17123-4) para una hoja
 * de cálculo: `[mm, ppm]`, o `[null, null]` si falta cualquiera de los dos.
 *
 * Todo o nada, igual que `formatDistancePrecision`, que devuelve "—" ante un
 * par a medias. Antes cada libro escribía los dos términos como filas
 * independientes, así que un proceso con solo uno de los dos capturado se
 * leía "—" en el informe impreso y como un número suelto en el Excel: dos
 * respuestas distintas del mismo dato. Una precisión de distancia a medias no
 * es un dato usable en ninguno de los dos sitios.
 *
 * Se devuelven como números y no como la cadena «3 mm + 2 ppm» porque en una
 * hoja de cálculo el valor tiene que seguir siendo calculable.
 */
export function distancePrecisionPair(
  mm: number | string | null | undefined,
  ppm: number | string | null | undefined,
): [number | null, number | null] {
  const m = toFiniteNumber(mm);
  const p = toFiniteNumber(ppm);
  if (m === null || p === null) return [null, null];
  return [m, p];
}

function toFiniteNumber(
  value: number | string | null | undefined,
): number | null {
  if (value === null || value === undefined || value === "") return null;
  const v = Number(value);
  return Number.isFinite(v) ? v : null;
}
