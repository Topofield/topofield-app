// Mensaje para el usuario a partir de un error de la base (Fase 22).
//
// Muchas acciones devolvían el `error.message` de Postgres tal cual: texto en
// inglés («violates foreign key constraint…») o mensajes de trigger con el id
// del registro. El usuario no puede hacer nada con eso. Aquí se traduce por
// código SQLSTATE y, si el código no dice nada útil, se usa el mensaje propio
// de la acción («No se pudo guardar la visita.»). El original se deja en el
// registro del servidor con `logDbError`.

/** Lo que interesa de un `PostgrestError`: su código y su texto. */
export interface DbErrorLike {
  code?: string | null;
  message?: string | null;
}

const BY_CODE: Record<string, string> = {
  // foreign_key_violation: algo lo referencia (p. ej. un lugar con procesos).
  "23503": "No se puede: hay otros datos que dependen de este registro.",
  // unique_violation.
  "23505": "Ya existe un registro con ese mismo nombre, código o número.",
  // insufficient_privilege: RLS.
  "42501": "No tiene permiso para hacer este cambio.",
};

// Los `check_violation` de los triggers de vigencia (Fase 11) ya vienen en
// español y nombran el punto y la fecha: se muestran tal cual. Los de un
// CHECK de columna vienen en inglés y no.
const CHECK_CONSTRAINT = /violates check constraint/i;

/**
 * Traduce el error a un mensaje en español. `fallback` es el mensaje de la
 * acción, para cuando el código no aporta nada más concreto.
 */
export function userMessage(error: DbErrorLike, fallback: string): string {
  const code = error.code ?? "";
  if (code in BY_CODE) return BY_CODE[code]!;
  if (code === "23514") {
    const message = error.message ?? "";
    return message !== "" && !CHECK_CONSTRAINT.test(message)
      ? message
      : "Algún valor está fuera del rango permitido.";
  }
  return fallback;
}

/** Deja el error original en el registro del servidor y devuelve el mensaje traducido. */
export function logDbError(error: DbErrorLike, fallback: string): string {
  console.error(`[db] ${error.code ?? "sin código"}: ${error.message ?? ""}`);
  return userMessage(error, fallback);
}
