"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { translateAuthError } from "@/lib/auth/error-messages";
import { invitacionValida, validateSignUpInput } from "@/lib/validators/sign-up";

export interface SignUpState {
  error?: string;
  fieldErrors?: Record<string, string>;
  /**
   * Lo que el usuario ya había escrito, para devolvérselo al fallar. La
   * contraseña nunca viaja de vuelta.
   */
  values?: Record<string, string>;
}

/** Los campos que se repueblan tras un error. Sin la contraseña. */
function valoresDe(formData: FormData): Record<string, string> {
  const campos = ["invite_code", "first_name", "last_name", "email"];
  return Object.fromEntries(
    campos.map((c) => [c, String(formData.get(c) ?? "")]),
  );
}

/**
 * A dónde vuelve el usuario tras pulsar el enlace del correo de confirmación.
 *
 * Se deriva de la petición en curso en lugar de fijarse en una variable, para
 * que funcione igual en local, en las vistas previas de Vercel y en
 * producción. El dominio debe estar en las «Redirect URLs» de Supabase.
 */
async function urlDeCallback(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const protocolo = h.get("x-forwarded-proto") ?? "http";
  return `${protocolo}://${host}/auth/callback`;
}

/**
 * Registra un usuario nuevo.
 *
 * El registro exige un código de invitación (`SIGNUP_INVITE_CODE`), que se
 * comprueba solo aquí, en el servidor. Con la confirmación de correo activa
 * `signUp` NO deja sesión iniciada, así que no se puede mandar al usuario al
 * dashboard: va a la pantalla de «revise su correo».
 */
export async function signUpAction(
  _prevState: SignUpState,
  formData: FormData,
): Promise<SignUpState> {
  const values = valoresDe(formData);

  const validacion = validateSignUpInput(formData);
  if (!validacion.ok) {
    return {
      error: "Revise los campos marcados.",
      fieldErrors: validacion.errors,
      values,
    };
  }

  const { firstName, lastName, email, password, inviteCode } = validacion.data;

  if (!invitacionValida(inviteCode, process.env.SIGNUP_INVITE_CODE)) {
    return {
      fieldErrors: { invite_code: "El código de invitación no es válido." },
      values,
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { first_name: firstName, last_name: lastName },
      emailRedirectTo: await urlDeCallback(),
    },
  });

  if (error) {
    return { error: translateAuthError(error.message), values };
  }

  redirect("/sign-up/revisa-tu-correo");
}
