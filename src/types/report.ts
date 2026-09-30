import type { Tables } from "./database";
import type { CandidateKind } from "@/lib/reports/eligibility";

/**
 * Una entrada de `reports.included_processes`.
 *
 * Guarda `name` además de `id` a propósito: es el nombre **en el momento de
 * emitir**. Si un proceso se renombra después, el informe conserva el nombre
 * con el que salió, y el `id` sigue llevando al dato vivo. `order` fija el
 * orden de las secciones, que el § 4.7 pide poder definir.
 */
export interface IncludedProcess {
  type: CandidateKind;
  id: string;
  name: string;
  order: number;
  /**
   * `included_processes` es una columna `JSONB`, y el tipo `Json` generado
   * exige una firma de índice para aceptar un objeto. Se declara aquí en vez
   * de castear en cada `insert`.
   */
  [key: string]: string | number;
}

/**
 * La portada de un informe: los datos del proyecto que muestra. En un informe
 * emitido es `reports.cover`, congelada al emitir (Fase 23): editar el
 * proyecto después no la cambia. La pestaña Informe de un proceso la arma en
 * vivo con `coverOf`.
 */
export interface ReportCoverData {
  name: string;
  client: string | null;
  location: string | null;
  datum: string | null;
  projection: string | null;
  /** Firma de índice para el tipo `Json` de la columna, como `IncludedProcess`. */
  [key: string]: string | null;
}

/** Fila de `reports`, con `included_processes` y `cover` ya tipados. */
export type Report = Omit<Tables<"reports">, "included_processes" | "cover"> & {
  included_processes: IncludedProcess[];
  cover: ReportCoverData;
};

/** Etiqueta de cada tipo de trabajo en el índice del informe. */
export const CANDIDATE_KIND_LABELS: Record<CandidateKind, string> = {
  polygonal: "Poligonal",
  leveling: "Nivelación",
  site: "Control de asentamientos",
};
