// Qué puede incluirse en un informe (§ 4.7). Funciones puras.
//
// Es la regla que sostiene todo el generador: como el informe NO guarda una
// copia de los datos —se reconstruye al abrirlo—, solo puede incluir cosas que
// ya no pueden cambiar. De ahí que la elegibilidad sea exactamente
// «inmutable», y que se decida aquí, con tests, y no dentro de una consulta.

/** Tipo de trabajo incluible en un informe. */
export type CandidateKind = "polygonal" | "leveling" | "site";

export interface EligibleCandidate {
  kind: CandidateKind;
  id: string;
  name: string;
  /**
   * `status` de la fila: `closed` / `rejected` / ... en poligonal y nivelación,
   * `active` / `closed` en un lugar.
   */
  status: string;
}

/**
 * ¿Puede este trabajo entrar en un informe?
 *
 * Solo si está **cerrado**, y por dos razones distintas que coinciden:
 *
 * - Un proceso cerrado es inmutable por trigger de base, así que regenerar el
 *   informe da siempre el mismo resultado.
 * - El § 4.6 excluye explícitamente los **rechazados**: quedan como referencia
 *   pero no se informan. Un `rejected` está tan «terminado» como un `closed`,
 *   de modo que sin esta regla se colaría.
 *
 * Para un LUGAR de asentamientos la unidad es el lugar cerrado, no la visita:
 * un lugar activo admite visitas nuevas aunque ya tenga varias cerradas, y su
 * informe cambiaría al reabrirlo.
 */
export function isEligible(candidate: EligibleCandidate): boolean {
  return candidate.status === "closed";
}

/** Filtra una lista de candidatos, conservando el orden recibido. */
export function selectableProcesses(
  candidates: EligibleCandidate[],
): EligibleCandidate[] {
  return candidates.filter(isEligible);
}
