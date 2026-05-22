// Resultado común de los validadores de Fase 2.
// `errors` se indexa por nombre de campo (el mismo `name` del input del form),
// para que la UI pueda mostrar el error junto a cada campo.

export type ValidationResult<T> =
  | { ok: true; data: T }
  | { ok: false; errors: Record<string, string> };
