// Derivación pura del status de cierre de nivelación. Vive en un módulo
// aparte (sin "use server") porque un archivo "use server" solo puede
// exportar funciones async — ver la nota de `actions.ts`.

/**
 * Datos de resultado que el cierre necesita leer de la fila persistida. Los
 * escribió `saveLevelingProcessAction` recalculando con `computeLeveling`, así
 * que son fuente de verdad confiable: no hace falta recalcular en el cierre.
 */
export interface LevelingClosureRow {
  status: string;
  type: string;
  meets_tolerance: boolean | null;
}

/**
 * Deriva el `status` final de un cierre de nivelación en el SERVIDOR, sin
 * confiar en `asRejected` del cliente. La clave pública de Supabase es
 * pública por diseño: cualquiera con sesión válida puede invocar la Server
 * Action saltándose el diálogo del navegador (que hoy es quien evalúa
 * `evaluateLevelingClosure`) y mandar `asRejected: false` sobre un proceso
 * fuera de tolerancia. Sin esta comprobación quedaría `closed` —
 * indistinguible de un cierre legítimo, lo que rompe la garantía de
 * trazabilidad del § 4.6.
 *
 * Asimetría deliberada: el cliente puede ser MÁS estricto que el servidor
 * (pedir `rejected` sobre un proceso que sí cumple — el topógrafo puede
 * rechazar un trabajo por razones que el sistema no ve), pero nunca MÁS
 * laxo (pedir `closed` sobre uno que no cumple).
 *
 * `type === "open"` es la única excepción a la exigencia de
 * `meets_tolerance` no nulo: un recorrido sin cota de cierre conocida no
 * compensa ni evalúa tolerancia por diseño (`knownClosingElevation` en
 * `leveling.ts` devuelve `null` para ese tipo), así que `meets_tolerance`
 * queda en `null` de forma estructural y permanente, no por falta de
 * cálculo. Ahí el único criterio disponible es que el proceso haya llegado a
 * `calculated`.
 */
export function deriveLevelingCloseStatus(
  row: LevelingClosureRow,
  asRejected: boolean,
): { ok: true; status: "closed" | "rejected" } | { ok: false; error: string } {
  if (row.status !== "calculated") {
    return {
      ok: false,
      error: "Solo se puede cerrar un proceso calculado.",
    };
  }

  if (row.type !== "open" && row.meets_tolerance == null) {
    return {
      ok: false,
      error: "No se puede cerrar un proceso sin resultados calculados.",
    };
  }

  const meetsTolerance = row.type === "open" ? true : row.meets_tolerance;
  const mustReject = meetsTolerance === false;

  // El cliente puede pedir `rejected` aunque el proceso cumpla (más
  // estricto); nunca puede forzar `closed` sobre uno que no cumple (más
  // laxo) — esa rama queda descartada por `mustReject` arriba.
  const status = mustReject || asRejected ? "rejected" : "closed";
  return { ok: true, status };
}
