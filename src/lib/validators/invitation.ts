// Validación de la solicitud de invitación (Fase 46). Función pura: sin
// React, sin Supabase. Los límites son los de los `check` de
// `public.invitations`: si cambian allí, cambian aquí.

import type { ValidationResult } from "./result";

export const INVITATION_LIMITS = {
  name: 80,
  email: 254,
  company: 120,
  purpose: 500,
} as const;

/** El campo trampa: oculto a las personas, lo llenan los robots. */
export const HONEYPOT_FIELD = "website";

export interface InvitationRequestInput {
  firstName: string;
  lastName: string;
  email: string;
  company: string | null;
  purpose: string | null;
}

/** La forma mínima de un correo, la misma que exige la base. */
export function looksLikeEmail(email: string): boolean {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email);
}

/** ¿Llenó el campo trampa? Entonces es un robot. */
export function isBot(form: FormData): boolean {
  return String(form.get(HONEYPOT_FIELD) ?? "").trim() !== "";
}

export function validateInvitationRequest(
  form: FormData,
): ValidationResult<InvitationRequestInput> {
  const errors: Record<string, string> = {};
  const str = (key: string) => String(form.get(key) ?? "").trim();

  const firstName = str("first_name");
  if (!firstName) errors.first_name = "El nombre es obligatorio.";
  else if (firstName.length > INVITATION_LIMITS.name)
    errors.first_name = `Hasta ${INVITATION_LIMITS.name} caracteres.`;

  const lastName = str("last_name");
  if (!lastName) errors.last_name = "El apellido es obligatorio.";
  else if (lastName.length > INVITATION_LIMITS.name)
    errors.last_name = `Hasta ${INVITATION_LIMITS.name} caracteres.`;

  const email = str("email").toLowerCase();
  if (!email) errors.email = "El correo es obligatorio.";
  else if (email.length > INVITATION_LIMITS.email || !looksLikeEmail(email))
    errors.email = "Escriba un correo válido.";

  const company = str("company");
  if (company.length > INVITATION_LIMITS.company)
    errors.company = `Hasta ${INVITATION_LIMITS.company} caracteres.`;

  const purpose = str("purpose");
  if (purpose.length > INVITATION_LIMITS.purpose)
    errors.purpose = `Hasta ${INVITATION_LIMITS.purpose} caracteres.`;

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    data: {
      firstName,
      lastName,
      email,
      company: company || null,
      purpose: purpose || null,
    },
  };
}
