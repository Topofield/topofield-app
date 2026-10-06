// Reabrir lo cerrado (Fase 34). Reglas y textos puros: las Server Actions y
// `ReopenDialog` los aplican, y la base admite la transición
// (`20261003000000_reabrir_procesos.sql`).

/** Lo que se reabre: un proceso (poligonal o nivelación), una visita o un lugar. */
export type ReopenTarget = "process" | "visit" | "site";

/** El estado al que vuelve cada uno (decisión 5 del PRD). */
const REOPENED_STATUS = {
  process: "calculated",
  visit: "calculated",
  site: "active",
} as const satisfies Record<ReopenTarget, string>;

/**
 * Lo que escribe reabrir: el estado abierto y sin registro de cierre. Ninguna
 * otra columna: la base rechaza reabrir y modificar en una sola escritura.
 */
export function reopenPatch<T extends ReopenTarget>(target: T) {
  return { status: REOPENED_STATUS[target], closed_at: null, closed_by: null };
}

const NOT_CLOSED: Record<ReopenTarget, string> = {
  process: "El proceso no está cerrado.",
  visit: "La visita no está cerrada.",
  site: "El lugar no está cerrado.",
};

/**
 * Por qué no se puede reabrir, o null si se puede. Un proceso rechazado
 * también se reabre. Una visita de un lugar cerrado espera al lugar: el
 * trigger del lugar rechaza escribir sus visitas (decisión 6).
 */
export function reopenBlocker(
  target: ReopenTarget,
  status: string,
  siteStatus?: string,
): string | null {
  const closed = status === "closed" || (target === "process" && status === "rejected");
  if (!closed) return NOT_CLOSED[target];
  if (target === "visit" && siteStatus === "closed") {
    return "El lugar está cerrado: reábrelo primero.";
  }
  return null;
}

/**
 * El aviso de los informes consolidados que lo incluyen, o null si no está en
 * ninguno. El informe se reconstruye en vivo: mostrará lo que haya (decisión 2).
 */
export function reportsNotice(titles: string[]): string | null {
  if (titles.length === 0) return null;
  const list = titles.map((t) => `«${t}»`).join(", ");
  return titles.length === 1
    ? `Está en el informe consolidado ${list}. Lo mostrará con los datos nuevos, sin fecha de cierre mientras siga abierto.`
    : `Está en ${titles.length} informes consolidados: ${list}. Lo mostrarán con los datos nuevos, sin fecha de cierre mientras siga abierto.`;
}

/** Título y explicación del diálogo de cada caso. */
export const REOPEN_COPY: Record<ReopenTarget, { title: string; body: string }> = {
  process: {
    title: "Reabrir proceso",
    body: "El proceso vuelve a ser editable y deja de contar como cerrado hasta que lo cierres otra vez. Se borra su registro de cierre: la fecha y el responsable.",
  },
  visit: {
    title: "Reabrir visita",
    body: "La visita vuelve a ser editable y deja de contar como cerrada hasta que la cierres otra vez. Se borra su registro de cierre: la fecha y el responsable.",
  },
  site: {
    title: "Reabrir lugar",
    body: "El lugar vuelve a estar activo: admite visitas nuevas y sus visitas abiertas se pueden editar. Las visitas cerradas siguen cerradas; cada una se reabre aparte. Se borra su registro de cierre: la fecha y el responsable.",
  },
};

/**
 * Una visita con visitas posteriores: el parcial, la velocidad y la alerta de
 * la siguiente se miden contra sus lecturas (decisión 8).
 */
export const LATER_VISITS_NOTICE =
  "Las visitas posteriores se calculan contra sus lecturas: si las cambias, cambian también sus resultados.";
