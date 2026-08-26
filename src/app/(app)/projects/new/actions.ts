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

  // Todo proceso (poligonal, nivelación, asentamientos) pertenece a un lugar
  // desde la Fase 5 (`site_id` es NOT NULL en los tres). Un proyecto sin
  // lugar sería un proyecto en el que no se puede trabajar: ni
  // `polygonal/new` ni `leveling/new` encontrarían dónde colgar el proceso.
  // Se crea aquí, junto con el proyecto, en vez de dejar que el usuario lo
  // cree a mano después. "Área principal" y no el nombre del proyecto: el
  // nombre del proyecto ya se ve en el hub que envuelve al lugar, así que
  // repetirlo como nombre del lugar sería redundante; "Área principal"
  // describe qué es sin inventar un dato de campo (tipo de estructura,
  // ubicación) que el wizard de proyecto no pide. `structure_type: 'otro'`
  // porque en este punto no se sabe qué se va a construir o monitorear.
  const { error: siteError } = await supabase.from("sites").insert({
    project_id: data.id,
    name: "Área principal",
    structure_type: "otro",
  });

  if (siteError) {
    // supabase-js no ofrece transacciones multi-tabla desde el cliente del
    // usuario (sujeto a RLS, sin llave secreta). Se compensa borrando el
    // proyecto recién creado para no dejarlo huérfano sin lugar; si incluso
    // esa limpieza falla, se informa igual: mejor un proyecto sin lugar que
    // el usuario pueda reportar, que un error silencioso.
    await supabase.from("projects").delete().eq("id", data.id);
    return {
      error:
        "No se pudo crear el lugar del proyecto. Intenta de nuevo.",
    };
  }

  redirect(`/projects/${data.id}`);
}
