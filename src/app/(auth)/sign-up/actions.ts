"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { translateAuthError } from "@/lib/auth/error-messages";

export async function signUpAction(formData: FormData) {
  const firstName = String(formData.get("first_name") ?? "").trim();
  const lastName = String(formData.get("last_name") ?? "").trim();
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { first_name: firstName, last_name: lastName },
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
