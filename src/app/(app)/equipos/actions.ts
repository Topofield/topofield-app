"use server";

// Acciones del catálogo de equipos (Fase 25). El catálogo es una plantilla:
// nada de lo que hacen toca un proceso ni una visita, que guardan su propia
// copia del equipo. Se revalida todo el árbol porque los formularios de
// equipo de cualquier proceso muestran el catálogo.

import { revalidatePath } from "next/cache";
import { equipmentRowOf } from "@/lib/equipment";
import { logDbError } from "@/lib/errors/user-message";
import { createClient } from "@/lib/supabase/server";
import { todayInBogota } from "@/lib/utils/format";
import {
  validateEquipmentItem,
  type EquipmentErrors,
  type EquipmentInput,
} from "@/lib/validators/equipment";

export interface EquipmentActionResult {
  ok: boolean;
  error?: string;
  /** Errores por campo, para el formulario. */
  errors?: EquipmentErrors;
  id?: string;
}

const DUPLICATE = "Ese equipo ya está en el catálogo: misma marca, modelo y serie.";

/** Errores del validador puro, o null si se puede guardar. */
function validate(input: EquipmentInput): EquipmentActionResult | null {
  const errors = validateEquipmentItem(input, todayInBogota());
  if (Object.keys(errors).length === 0) return null;
  return { ok: false, errors, error: Object.values(errors)[0] };
}

/** Da de alta un equipo en el catálogo del usuario. */
export async function createEquipmentAction(
  input: EquipmentInput,
): Promise<EquipmentActionResult> {
  const invalid = validate(input);
  if (invalid) return invalid;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("equipment")
    .insert(equipmentRowOf(input))
    .select("id")
    .single();
  if (error) {
    if (error.code === "23505") return { ok: false, error: DUPLICATE };
    return { ok: false, error: logDbError(error, "No se pudo guardar el equipo.") };
  }

  revalidatePath("/", "layout");
  return { ok: true, id: data.id };
}

/** Corrige un equipo del catálogo. No cambia ningún proceso que lo haya usado. */
export async function updateEquipmentAction(
  id: string,
  input: EquipmentInput,
): Promise<EquipmentActionResult> {
  const invalid = validate(input);
  if (invalid) return invalid;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("equipment")
    .update(equipmentRowOf(input))
    .eq("id", id)
    .select("id");
  if (error) {
    if (error.code === "23505") return { ok: false, error: DUPLICATE };
    return { ok: false, error: logDbError(error, "No se pudo guardar el equipo.") };
  }
  if (!data || data.length === 0) return { ok: false, error: "Equipo no encontrado." };

  revalidatePath("/", "layout");
  return { ok: true, id };
}

/** Borra un equipo del catálogo. Los procesos conservan su copia. */
export async function deleteEquipmentAction(id: string): Promise<EquipmentActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("equipment").delete().eq("id", id);
  if (error) return { ok: false, error: logDbError(error, "No se pudo eliminar el equipo.") };

  revalidatePath("/", "layout");
  return { ok: true };
}
