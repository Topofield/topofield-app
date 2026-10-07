// Qué puede incluirse en un informe (§ 4.7). Funciones puras.
//
// Desde la Fase 37 nada se cierra: un informe consolidado no guarda copia de
// los datos —se reconstruye al abrirlo— y muestra lo que cada proceso tenga.
// La regla que queda es no informar lo que está a medias.

/** Tipo de trabajo incluible en un informe. */
export type CandidateKind = "polygonal" | "leveling" | "site";

export interface EligibleCandidate {
  kind: CandidateKind;
  id: string;
  name: string;
  /**
   * `status` de la fila en una poligonal o una nivelación. En un lugar, que no
   * tiene estado, lo deriva la consulta: `calculated` si alguna de sus
   * visitas lo está.
   */
  status: string;
}

/**
 * ¿Puede este trabajo entrar en un informe? Si está **calculado**: una
 * poligonal (Fase 35) o una nivelación (Fase 36) calculada, cumpla o no un
 * orden —su informe lo alerta—, y un lugar con alguna visita calculada (Fase
 * 37). A medias, no. El § 4.6 excluye además los **rechazados**, que ya no
 * existen pero la regla los deja fuera.
 */
export function isEligible(candidate: EligibleCandidate): boolean {
  return candidate.status === "calculated";
}

/** Filtra una lista de candidatos, conservando el orden recibido. */
export function selectableProcesses(
  candidates: EligibleCandidate[],
): EligibleCandidate[] {
  return candidates.filter(isEligible);
}
