// Validación de los datos de un proyecto (wizard de creación y edición).
// Función pura: sin React, sin Supabase. Es la fuente de verdad — el Server
// Action la invoca antes de cualquier INSERT/UPDATE.
//
// Desde la Fase 8, el proyecto ya no captura equipo ni precisión: cada
// proceso (poligonal, nivelación, asentamiento) los define por su cuenta.

import { readNumberText } from "@/lib/utils/parse";
import type { ValidationResult } from "./result";

/** Campos de un proyecto que controla el usuario (sin id, user_id, timestamps). */
export interface ProjectInput {
  name: string;
  description: string | null;
  client: string;
  location: string;
  latitude: number | null;
  longitude: number | null;
  datum: string;
  projection: string | null;
}

function emptyToNull(value: string): string | null {
  return value === "" ? null : value;
}

/**
 * Parsea un número opcional, con coma o punto decimal. `""` → null. Devuelve
 * `ok:false` si no es número.
 */
function parseOptionalNumber(
  value: string,
): { ok: true; value: number | null } | { ok: false } {
  const read = readNumberText(value);
  if (read.kind === "empty") return { ok: true, value: null };
  if (read.kind === "invalid") return { ok: false };
  return { ok: true, value: read.value };
}

export function validateProjectInput(
  form: FormData,
): ValidationResult<ProjectInput> {
  const errors: Record<string, string> = {};
  const str = (key: string) => String(form.get(key) ?? "").trim();

  // --- Texto obligatorio ---
  const name = str("name");
  if (!name) errors.name = "El nombre del proyecto es obligatorio.";

  const client = str("client");
  if (!client) errors.client = "El cliente es obligatorio.";

  const location = str("location");
  if (!location) errors.location = "La ubicación es obligatoria.";

  const datum = str("datum");
  if (!datum) errors.datum = "El datum es obligatorio.";

  // --- Latitud / longitud opcionales (rango geográfico; sin redondeo) ---
  let latitude: number | null = null;
  const lat = parseOptionalNumber(str("latitude"));
  if (!lat.ok) {
    errors.latitude = "La latitud debe ser un número.";
  } else if (lat.value !== null && (lat.value < -90 || lat.value > 90)) {
    errors.latitude = "La latitud debe estar entre -90 y 90 grados.";
  } else {
    latitude = lat.value;
  }

  let longitude: number | null = null;
  const lng = parseOptionalNumber(str("longitude"));
  if (!lng.ok) {
    errors.longitude = "La longitud debe ser un número.";
  } else if (lng.value !== null && (lng.value < -180 || lng.value > 180)) {
    errors.longitude = "La longitud debe estar entre -180 y 180 grados.";
  } else {
    longitude = lng.value;
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  return {
    ok: true,
    data: {
      name,
      description: emptyToNull(str("description")),
      client,
      location,
      latitude,
      longitude,
      datum,
      projection: emptyToNull(str("projection")),
    },
  };
}
