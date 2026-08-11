// Validación del registro de usuario, incluido el código de invitación.
// Función pura: sin React, sin Supabase. Fuente de verdad del Server Action.

import type { ValidationResult } from "./result";

/** Longitud mínima de contraseña. Coincide con `minimum_password_length` de Supabase. */
export const MIN_PASSWORD = 6;

/** Campos del formulario de registro. */
export interface SignUpInput {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  inviteCode: string;
}

/**
 * Comprueba el código de invitación.
 *
 * Recibe el código esperado como parámetro en lugar de leer `process.env` por
 * dentro, para poder probarla sin manipular variables de entorno globales.
 *
 * **Sin variable configurada, nadie entra.** Un despliegue al que se le olvidó
 * definir `SIGNUP_INVITE_CODE` debe fallar de forma visible —nadie puede
 * registrarse y se nota enseguida— y no convertirse en un registro abierto que
 * nadie advierta.
 *
 * Solo se recortan espacios: un copiar y pegar los arrastra, pero no cambia las
 * mayúsculas. La comparación distingue mayúsculas de minúsculas.
 *
 * No se usa comparación en tiempo constante. Protege el registro de una
 * monografía frente a un atacante que tendría que medir microsegundos de
 * latencia de red muchas veces; la complejidad no se justifica. Queda escrito
 * para que la omisión sea una decisión y no un descuido.
 */
export function invitacionValida(
  ingresado: string,
  esperado: string | undefined,
): boolean {
  if (!esperado) return false;
  return ingresado.trim() === esperado;
}

/**
 * Valida los campos del registro. El código de invitación se comprueba aparte,
 * con `invitacionValida`, porque depende del entorno y no del formulario.
 */
export function validateSignUpInput(
  form: FormData,
): ValidationResult<SignUpInput> {
  const errors: Record<string, string> = {};
  const str = (key: string) => String(form.get(key) ?? "").trim();

  const firstName = str("first_name");
  if (!firstName) errors.first_name = "El nombre es obligatorio.";

  const lastName = str("last_name");
  if (!lastName) errors.last_name = "El apellido es obligatorio.";

  const email = str("email");
  if (!email) {
    errors.email = "El correo es obligatorio.";
  } else if (!email.includes("@") || !email.includes(".")) {
    errors.email = "Escriba un correo válido.";
  }

  // La contraseña no se recorta: los espacios son caracteres válidos en ella.
  const password = String(form.get("password") ?? "");
  if (!password) {
    errors.password = "La contraseña es obligatoria.";
  } else if (password.length < MIN_PASSWORD) {
    errors.password = `La contraseña debe tener al menos ${MIN_PASSWORD} caracteres.`;
  }

  const inviteCode = str("invite_code");
  if (!inviteCode) errors.invite_code = "El código de invitación es obligatorio.";

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  return {
    ok: true,
    data: { firstName, lastName, email, password, inviteCode },
  };
}
