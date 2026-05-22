"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { validateProjectInput } from "@/lib/validators/project";

export interface CreateProjectState {
  error?: string;
  fieldErrors?: Record<string, string>;
}

/**
 * Crea un proyecto. En éxito redirige al hub del proyecto; en error de
 * validación devuelve el estado para que el wizard muestre los errores sin
 * perder lo digitado.
 */
export async function createProjectAction(
  _prevState: CreateProjectState,
  formData: FormData,
): Promise<CreateProjectState> {
  const result = validateProjectInput(formData);
  if (!result.ok) {
    return {
      error: "Revisa los campos marcados.",
      fieldErrors: result.errors,
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/sign-in");
  }

  const { data, error } = await supabase
    .from("projects")
    .insert({ ...result.data, user_id: user.id })
    .select("id")
    .single();

  if (error || !data) {
    return { error: "No se pudo crear el proyecto. Intenta de nuevo." };
  }

  redirect(`/projects/${data.id}`);
}
