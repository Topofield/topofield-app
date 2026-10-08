// Lo común de los libros de Excel de cada proceso (Fase 38): los colores del
// tema, el libro nuevo, el nombre del archivo y los datos del proyecto y del
// equipo. Las celdas —datos, fórmulas y rótulos— las escribe `cells.ts`.

import ExcelJS from "exceljs";

import { formatEquipmentLine } from "@/lib/utils/format";

/**
 * Colores de la identidad de la Fase 20, copiados de los tokens del tema claro
 * de `globals.css` (Fase 24): el Excel no lee CSS y no tiene tema oscuro. Hasta
 * entonces conservaba el azul y los grises anteriores. Un test compara cada
 * uno con su token.
 */
export const WORKBOOK_COLORS = {
  /** `--color-ink`: títulos y secciones. */
  ink: "FF1C2427",
  /** `--color-ink-2`: etiquetas de los pares clave-valor. */
  ink2: "FF56636A",
  /** `--color-sel`: relleno de las cabeceras. */
  sel: "FFEEF3F2",
  /** `--color-rule-strong`: borde de las cabeceras. */
  ruleStrong: "FF838B8C",
  /** `--color-mira-bg`: relleno de los datos medidos o tecleados. */
  miraBg: "FFFBF1D3",
  /** `--color-mira-ink`: tinta de los datos medidos o tecleados. */
  miraInk: "FF6B5100",
  /** `--color-success`: «CUMPLE». */
  success: "FF2C7866",
  /** `--color-danger`: «NO CUMPLE». */
  danger: "FFC0392B",
} as const;

/** Libro nuevo con los metadatos del producto. */
export function newWorkbook(): ExcelJS.Workbook {
  const wb = new ExcelJS.Workbook();
  wb.creator = "TopoField";
  wb.created = new Date();
  // Excel recalcula al abrir: las celdas guardan el valor de la app, pero un
  // dato cambiado a mano debe propagarse (Fase 38).
  wb.calcProperties.fullCalcOnLoad = true;
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
