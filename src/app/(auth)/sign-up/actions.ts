"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { translateAuthError } from "@/lib/auth/error-messages";

export async function signUpAction(formData: FormData) {
  const fullName = String(formData.get("full_name") ?? "").trim();
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName },
    },
  });

  if (error) {
    redirect(
      `/sign-up?error=${encodeURIComponent(translateAuthError(error.message))}`,
    );
  }

  // En dev local enable_confirmations=false, así que la sesión queda activa
  // al instante. En cloud habrá que ajustar este flujo.
  redirect("/dashboard");
}
