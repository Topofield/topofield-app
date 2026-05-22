// Validación de los datos de un proyecto (wizard de creación y edición).
// Función pura: sin React, sin Supabase. Es la fuente de verdad — el Server
// Action la invoca antes de cualquier INSERT/UPDATE.

import { PRECISION_ORDERS, type PrecisionOrder } from "@/types/project";
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
  precision_order: PrecisionOrder;
  equipment_brand: string;
  equipment_model: string;
  equipment_serial: string;
  angular_precision_seconds: number;
  linear_precision: string;
  equipment_calibration_date: string; // YYYY-MM-DD
}

function emptyToNull(value: string): string | null {
  return value === "" ? null : value;
}

/** Parsea un número opcional. `""` → null. Devuelve `ok:false` si no es número. */
function parseOptionalNumber(
  value: string,
): { ok: true; value: number | null } | { ok: false } {
  if (value === "") return { ok: true, value: null };
  const n = Number(value);
  if (!Number.isFinite(n)) return { ok: false };
  return { ok: true, value: n };
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

  const equipmentBrand = str("equipment_brand");
  if (!equipmentBrand)
    errors.equipment_brand = "La marca del equipo es obligatoria.";

  const equipmentModel = str("equipment_model");
  if (!equipmentModel)
    errors.equipment_model = "El modelo del equipo es obligatorio.";

  const equipmentSerial = str("equipment_serial");
  if (!equipmentSerial)
    errors.equipment_serial = "La serie del equipo es obligatoria.";

  const linearPrecision = str("linear_precision");
  if (!linearPrecision)
    errors.linear_precision = "La precisión lineal es obligatoria.";

  // --- Orden de precisión (CHECK) ---
  const precisionOrder = str("precision_order");
  if (!precisionOrder) {
    errors.precision_order = "Selecciona el orden de precisión.";
  } else if (!(PRECISION_ORDERS as readonly string[]).includes(precisionOrder)) {
    errors.precision_order = "Orden de precisión no válido.";
  }

  // --- Precisión angular (decimal(5,1), > 0) ---
  let angularPrecisionSeconds = 0;
  const angularRaw = str("angular_precision_seconds");
  if (!angularRaw) {
    errors.angular_precision_seconds = "La precisión angular es obligatoria.";
  } else {
    const parsed = Number(angularRaw);
    if (!Number.isFinite(parsed)) {
      errors.angular_precision_seconds =
        "La precisión angular debe ser un número.";
    } else if (parsed <= 0) {
      errors.angular_precision_seconds =
        "La precisión angular debe ser mayor que cero.";
    } else if (parsed > 9999.9) {
      errors.angular_precision_seconds =
        "La precisión angular es demasiado grande.";
    } else {
      angularPrecisionSeconds = Math.round(parsed * 10) / 10;
    }
  }

  // --- Fecha de calibración (DATE, no futura) ---
  const calibrationDate = str("equipment_calibration_date");
  if (!calibrationDate) {
    errors.equipment_calibration_date =
      "La fecha de calibración es obligatoria.";
  } else {
    const date = new Date(`${calibrationDate}T00:00:00`);
    if (Number.isNaN(date.getTime())) {
      errors.equipment_calibration_date =
        "La fecha de calibración no es válida.";
    } else if (date.getTime() > Date.now()) {
      errors.equipment_calibration_date =
        "La fecha de calibración no puede estar en el futuro.";
    }
  }

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
      precision_order: precisionOrder as PrecisionOrder,
      equipment_brand: equipmentBrand,
      equipment_model: equipmentModel,
      equipment_serial: equipmentSerial,
      angular_precision_seconds: angularPrecisionSeconds,
      linear_precision: linearPrecision,
      equipment_calibration_date: calibrationDate,
    },
  };
}
