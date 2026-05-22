// Validación de un punto de referencia (BM / control / GPS / detalle).
// Función pura: sin React, sin Supabase. Fuente de verdad del Server Action.

import {
  REFERENCE_POINT_TYPES,
  type ReferencePointType,
} from "@/types/project";
import type { ValidationResult } from "./result";

/** Campos de un punto de referencia que controla el usuario. */
export interface ReferencePointInput {
  code: string;
  type: ReferencePointType;
  north: number | null;
  east: number | null;
  elevation: number | null;
  description: string | null;
}

function emptyToNull(value: string): string | null {
  return value === "" ? null : value;
}

/** Redondea a `decimals` decimales. */
function round(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

/**
 * Parsea una coordenada opcional y la redondea. `""` → null.
 * Devuelve `ok:false` si el texto no es un número.
 */
function parseCoordinate(
  value: string,
  decimals: number,
): { ok: true; value: number | null } | { ok: false } {
  if (value === "") return { ok: true, value: null };
  const n = Number(value);
  if (!Number.isFinite(n)) return { ok: false };
  return { ok: true, value: round(n, decimals) };
}

export function validateReferencePointInput(
  form: FormData,
): ValidationResult<ReferencePointInput> {
  const errors: Record<string, string> = {};
  const str = (key: string) => String(form.get(key) ?? "").trim();

  const code = str("code");
  if (!code) errors.code = "El código del punto es obligatorio.";

  const type = str("type");
  if (!type) {
    errors.type = "Selecciona el tipo de punto.";
  } else if (!(REFERENCE_POINT_TYPES as readonly string[]).includes(type)) {
    errors.type = "Tipo de punto no válido.";
  }

  // Coordenadas topográficas a 3 decimales; cota a 4 (regla de CLAUDE.md).
  let north: number | null = null;
  const n = parseCoordinate(str("north"), 3);
  if (!n.ok) errors.north = "El Norte debe ser un número.";
  else north = n.value;

  let east: number | null = null;
  const e = parseCoordinate(str("east"), 3);
  if (!e.ok) errors.east = "El Este debe ser un número.";
  else east = e.value;

  let elevation: number | null = null;
  const el = parseCoordinate(str("elevation"), 4);
  if (!el.ok) errors.elevation = "La cota debe ser un número.";
  else elevation = el.value;

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  return {
    ok: true,
    data: {
      code,
      type: type as ReferencePointType,
      north,
      east,
      elevation,
      description: emptyToNull(str("description")),
    },
  };
}
