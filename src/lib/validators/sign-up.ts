// Validación del registro con invitación (Fase 46). Función pura: sin React,
// sin Supabase. Fuente de verdad de la Server Action.
//
// El registro tiene dos pasos en la misma página: correo y código; si la
// invitación existe, la contraseña. El nombre y el apellido ya no se piden:
// salen de la solicitud.

import { isWellFormedInviteCode, normalizeInviteCode } from "@/lib/auth/invite-code";
import { looksLikeEmail } from "./invitation";
import type { ValidationResult } from "./result";

/** Longitud mínima de contraseña. Coincide con `minimum_password_length` de Supabase. */
export const MIN_PASSWORD = 6;

/** Paso 1: el correo y el código. */
export interface InvitationCheckInput {
  email: string;
  /** Normalizado, sin guion. */
  code: string;
}

/** Paso 2: además, la contraseña. */
export interface SignUpInput extends InvitationCheckInput {
  password: string;
}

export function validateInvitationCheck(
  form: FormData,
): ValidationResult<InvitationCheckInput> {
  const errors: Record<string, string> = {};

  const email = String(form.get("email") ?? "").trim().toLowerCase();
  if (!email) errors.email = "El correo es obligatorio.";
  else if (!looksLikeEmail(email)) errors.email = "Escriba un correo válido.";

  const crudo = String(form.get("invite_code") ?? "");
  if (!crudo.trim()) errors.invite_code = "El código de invitación es obligatorio.";
  else if (!isWellFormedInviteCode(crudo))
    errors.invite_code = "El código tiene ocho caracteres, como ABCD-EFGH.";

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, data: { email, code: normalizeInviteCode(crudo) } };
}

export function validateSignUpInput(form: FormData): ValidationResult<SignUpInput> {
  const paso1 = validateInvitationCheck(form);
  const errors: Record<string, string> = paso1.ok ? {} : { ...paso1.errors };

  // La contraseña no se recorta: los espacios son caracteres válidos en ella.
  const password = String(form.get("password") ?? "");
  if (!password) errors.password = "La contraseña es obligatoria.";
  else if (password.length < MIN_PASSWORD)
    errors.password = `La contraseña debe tener al menos ${MIN_PASSWORD} caracteres.`;

  if (!paso1.ok || Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, data: { ...paso1.data, password } };
}
