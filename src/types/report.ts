/** El tipo de proceso del que se arma un informe (Fase 38: solo el de cada proceso). */
export type CandidateKind = "polygonal" | "leveling" | "site";

/** El proceso cuyo informe se arma: su tipo, su id y su nombre. */
export interface IncludedProcess {
  type: CandidateKind;
  id: string;
  name: string;
  order: number;
  /** Firma de índice para el JSON de los informes de la demo; sale con ellos (Tarea 9). */
  [key: string]: string | number;
}

/**
 * La portada de un informe: los datos del proyecto que muestra, armados en
 * vivo con `coverOf`.
 */
export interface ReportCoverData {
  name: string;
  client: string | null;
  location: string | null;
  datum: string | null;
  projection: string | null;
  /** Firma de índice para el JSON de los informes de la demo; sale con ellos (Tarea 9). */
  [key: string]: string | null;
}

/** Etiqueta de cada tipo de proceso en el informe. */
export const CANDIDATE_KIND_LABELS: Record<CandidateKind, string> = {
  polygonal: "Poligonal",
  leveling: "Nivelación",
  site: "Control de asentamientos",
};
