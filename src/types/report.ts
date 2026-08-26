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

/** Fila de `reports`, con `included_processes` ya tipado. */
export type Report = Omit<Tables<"reports">, "included_processes"> & {
  included_processes: IncludedProcess[];
};

/** Etiqueta de cada tipo de trabajo en el índice del informe. */
export const CANDIDATE_KIND_LABELS: Record<CandidateKind, string> = {
  polygonal: "Poligonal",
  leveling: "Nivelación",
  site: "Control de asentamientos",
};
