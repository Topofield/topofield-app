"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getClosedWorkCount } from "@/lib/supabase/queries";
import { logDbError } from "@/lib/errors/user-message";
import { validateProjectInput } from "@/lib/validators/project";
import { validateReferencePointInput } from "@/lib/validators/reference-point";

export interface FormState {
  ok?: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
}

export interface ActionResult {
  ok: boolean;
  error?: string;
}

function field(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "");
}

// --- Proyecto ----------------------------------------------------------------

/** Edita un proyecto. Se queda en la pantalla → devuelve estado para feedback. */
export async function updateProjectAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const projectId = field(formData, "project_id");
  const result = validateProjectInput(formData);
  if (!result.ok) {
    return { error: "Revisa los campos marcados.", fieldErrors: result.errors };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("projects")
    .update(result.data)
    .eq("id", projectId);

  if (error) {
    return { error: "No se pudieron guardar los cambios. Intenta de nuevo." };
  }

  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function archiveProjectAction(formData: FormData): Promise<void> {
  const projectId = field(formData, "project_id");
  const supabase = await createClient();
  await supabase
    .from("projects")
    .update({ status: "archived" })
    .eq("id", projectId);
  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/dashboard");
}

export async function restoreProjectAction(formData: FormData): Promise<void> {
  const projectId = field(formData, "project_id");
  const supabase = await createClient();
  await supabase
    .from("projects")
    .update({ status: "active" })
    .eq("id", projectId);
  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/dashboard");
}

/**
 * Borrado definitivo, con todo lo que cuelga del proyecto (cascada). Un
 * proyecto con trabajo cerrado no se puede borrar: lo cerrado es inmutable y
 * los triggers rechazan el borrado. Antes el error se ignoraba y se volvía al
 * dashboard como si hubiera funcionado (Fase 22).
 */
export async function deleteProjectAction(projectId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const cerrado = await getClosedWorkCount(supabase, projectId);
  if (cerrado > 0) {
    return {
      ok: false,
      error: "El proyecto tiene trabajo cerrado y no se puede eliminar. Puedes archivarlo.",
    };
  }
  const { error } = await supabase.from("projects").delete().eq("id", projectId);
  if (error) return { ok: false, error: logDbError(error, "No se pudo eliminar el proyecto.") };
  revalidatePath("/dashboard");
  redirect("/dashboard");
}

// --- Puntos de referencia ----------------------------------------------------
// Estas acciones se invocan como función desde el cliente (no vía useActionState):
// el manager valida en cliente con el validador puro y cierra el modal según el
// resultado.

export async function createReferencePointAction(
  formData: FormData,
): Promise<ActionResult> {
  const projectId = field(formData, "project_id");
  const result = validateReferencePointInput(formData);
  if (!result.ok) {
    return { ok: false, error: "Datos del punto no válidos." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("reference_points")
    .insert({ ...result.data, project_id: projectId });

  if (error) {
    return { ok: false, error: "No se pudo crear el punto. Intenta de nuevo." };
  }

  revalidatePath(`/projects/${projectId}`);
  return { ok: true };
}

export async function updateReferencePointAction(
  formData: FormData,
): Promise<ActionResult> {
  const projectId = field(formData, "project_id");
  const pointId = field(formData, "point_id");
  const result = validateReferencePointInput(formData);
  if (!result.ok) {
    return { ok: false, error: "Datos del punto no válidos." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("reference_points")
    .update(result.data)
    .eq("id", pointId);

  if (error) {
    return {
      ok: false,
      error: "No se pudieron guardar los cambios. Intenta de nuevo.",
    };
  }

  revalidatePath(`/projects/${projectId}`);
  return { ok: true };
}

export async function deleteReferencePointAction(
  formData: FormData,
): Promise<void> {
  const projectId = field(formData, "project_id");
  const pointId = field(formData, "point_id");
  const supabase = await createClient();
  await supabase.from("reference_points").delete().eq("id", pointId);
  revalidatePath(`/projects/${projectId}`);
}
