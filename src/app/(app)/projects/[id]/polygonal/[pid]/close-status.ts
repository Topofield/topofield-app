// Derivación pura del status de cierre de poligonal. Vive en un módulo
// aparte (sin "use server") porque un archivo "use server" solo puede
// exportar funciones async — ver la nota de `actions.ts`.

/**
 * Datos de resultado que el cierre necesita leer de la fila persistida. Los
 * escribió `savePolygonalProcessAction` recalculando con `computePolygonal`,
 * así que son fuente de verdad confiable: no hace falta recalcular en el
 * cierre.
 */
export interface PolygonalClosureRow {
  status: string;
  type: string;
  meets_tolerance: boolean | null;
}

/**
 * Deriva el `status` final de un cierre de poligonal en el SERVIDOR, sin
 * confiar en `asRejected` del cliente. La clave pública de Supabase es
 * pública por diseño: cualquiera con sesión válida puede invocar la Server
 * Action saltándose el diálogo del navegador (que hoy es quien evalúa
 * `evaluatePolygonalClosure`) y mandar `asRejected: false` sobre un proceso
 * fuera de tolerancia. Sin esta comprobación quedaría `closed` —
 * indistinguible de un cierre legítimo, lo que rompe la garantía de
 * trazabilidad del § 4.6. Poligonal ya está en producción con datos reales:
 * este cambio es quirúrgico y no toca el resto del ciclo de cierre.
 *
 * Asimetría deliberada: el cliente puede ser MÁS estricto que el servidor
 * (pedir `rejected` sobre un proceso que sí cumple — el topógrafo puede
 * rechazar un trabajo por razones que el sistema no ve), pero nunca MÁS
 * laxo (pedir `closed` sobre uno que no cumple).
 *
 * `type === "open_uncontrolled"` es la única excepción a la exigencia de
 * `meets_tolerance` no nulo: sin punto de llegada conocido no hay contra qué
 * cerrar ni corrección que aplicar por diseño (`computeOpenUncontrolled` en
 * `polygonal.ts` siempre devuelve `meetsTolerance: null`), así que ese campo
 * queda en `null` de forma estructural y permanente, no por falta de
 * cálculo. Ahí el único criterio disponible es que el proceso haya llegado a
 * `calculated`.
 */
export function derivePolygonalCloseStatus(
  row: PolygonalClosureRow,
  asRejected: boolean,
): { ok: true; status: "closed" | "rejected" } | { ok: false; error: string } {
  if (row.status !== "calculated") {
    return {
      ok: false,
      error: "Solo se puede cerrar un proceso calculado.",
    };
  }

  if (row.type !== "open_uncontrolled" && row.meets_tolerance == null) {
    return {
      ok: false,
      error: "No se puede cerrar un proceso sin resultados calculados.",
    };
  }

  const meetsTolerance =
    row.type === "open_uncontrolled" ? true : row.meets_tolerance;
  const mustReject = meetsTolerance === false;

  // El cliente puede pedir `rejected` aunque el proceso cumpla (más
  // estricto); nunca puede forzar `closed` sobre uno que no cumple (más
  // laxo) — esa rama queda descartada por `mustReject` arriba.
  const status = mustReject || asRejected ? "rejected" : "closed";
  return { ok: true, status };
}
