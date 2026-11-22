"use server";

import { redirect } from "next/navigation";
import { formatInviteCode } from "@/lib/auth/invite-code";
import { translateAuthError } from "@/lib/auth/error-messages";
import { crearProyectoDemo } from "@/lib/demo/crear-proyecto-demo";
import { createClient } from "@/lib/supabase/server";
import { validateInvitationCheck, validateSignUpInput } from "@/lib/validators/sign-up";

export interface SignUpState {
  /** `invitacion`: correo y código; `contrasena`: la invitación ya se comprobó. */
  step: "invitacion" | "contrasena";
  error?: string;
  fieldErrors?: Record<string, string>;
  /** El correo y el código, para repoblar o para el paso 2. Nunca la contraseña. */
  values?: { email: string; invite_code: string };
}

const INVITACION_NO_VALIDA =
  "No encontramos una invitación aceptada para ese correo con ese código. Revise los dos, o solicite una invitación.";

/**
 * El registro con invitación (Fase 46), en dos pasos con la misma acción:
 *
 * 1. `step=invitacion`: comprueba en la base que hay una invitación aceptada
 *    de ese correo con ese código (`invitation_is_valid`) y pasa al paso 2.
 * 2. `step=contrasena`: crea la cuenta con el código en los metadatos. El
 *    disparador `require_invitation` de `auth.users` vuelve a comprobarlo,
 *    marca la invitación usada y le pone a la cuenta el nombre de la
 *    solicitud. Sin confirmación de correo, `signUp` deja la sesión
 *    iniciada: se crea el proyecto de ejemplo y se entra al dashboard.
 *
 * Si en Supabase volviera a estar encendida la confirmación, `signUp` no deja
 * sesión y se manda a «Revise su correo», como antes de esta fase.
 */
export async function signUpAction(_prev: SignUpState, formData: FormData): Promise<SignUpState> {
  const paso = formData.get("step") === "contrasena" ? "contrasena" : "invitacion";
  const values = {
    email: String(formData.get("email") ?? ""),
    invite_code: String(formData.get("invite_code") ?? ""),
  };

  const comprobacion = validateInvitationCheck(formData);
  if (!comprobacion.ok) {
    return { step: "invitacion", error: "Revise los campos marcados.", fieldErrors: comprobacion.errors, values };
  }
  const { email, code } = comprobacion.data;
  const normalizados = { email, invite_code: formatInviteCode(code) };

  const supabase = await createClient();

  if (paso === "invitacion") {
    const { data: valida, error } = await supabase.rpc("invitation_is_valid", { p_email: email, p_code: code });
    if (error) {
      console.error("No se pudo comprobar la invitación:", error.message);
      return { step: "invitacion", error: "No se pudo comprobar la invitación. Inténtelo de nuevo.", values };
    }
    if (!valida) return { step: "invitacion", error: INVITACION_NO_VALIDA, values };
    return { step: "contrasena", values: normalizados };
  }

  const registro = validateSignUpInput(formData);
  if (!registro.ok) {
    return { step: "contrasena", error: "Revise los campos marcados.", fieldErrors: registro.errors, values: normalizados };
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password: registro.data.password,
    options: { data: { invite_code: code } },
  });

  if (error) {
    // El disparador rechazó el alta: la invitación se usó o cambió entre los
    // dos pasos. Supabase lo devuelve como un error genérico de la base.
    if (error.message === "Database error saving new user") {
      return { step: "invitacion", error: INVITACION_NO_VALIDA, values: normalizados };
    }
    return { step: "contrasena", error: translateAuthError(error.message), values: normalizados };
  }

  if (!data.session) redirect("/sign-up/revisa-tu-correo");

  // El proyecto de ejemplo es un extra: si falla, la persona entra igual a
  // una cuenta vacía. Nunca debe dejarla fuera.
  if (data.user) {
    try {
      await crearProyectoDemo(supabase, data.user.id);
    } catch (e) {
      console.error("No se pudo crear el proyecto de ejemplo:", e);
    }
  }

  redirect("/dashboard");
}
