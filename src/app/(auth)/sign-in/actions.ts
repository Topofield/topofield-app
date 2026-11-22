"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { translateAuthError } from "@/lib/auth/error-messages";
import { safeNextPath } from "@/lib/auth/next-path";

export async function signInAction(formData: FormData) {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  // A dónde volver: el enlace del correo al administrador pasa por aquí
  // (Fase 46). Solo rutas de la aplicación.
  const next = safeNextPath(String(formData.get("next") ?? ""));

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    const vuelta = next ? `&next=${encodeURIComponent(next)}` : "";
    redirect(
      `/sign-in?error=${encodeURIComponent(translateAuthError(error.message))}${vuelta}`,
    );
  }

  redirect(next ?? "/dashboard");
}
