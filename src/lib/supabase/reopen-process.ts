import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { logDbError } from "@/lib/errors/user-message";
import { reopenBlocker, reopenPatch } from "@/lib/reopen";

const TABLE = {
  polygonal: "polygonal_processes",
  leveling: "leveling_processes",
} as const;

/**
 * Reabre una poligonal o una nivelación cerrada o rechazada (Fase 34): vuelve
 * a `calculated`, sin registro de cierre, y se edita como cualquier abierta.
 * La base admite solo esa transición (`is_reopening`).
 *
 * Lo comparten `reopenPolygonalProcessAction` y `reopenLevelingProcessAction`,
 * que solo difieren en la tabla y en la ruta que revalidan. El `project_id` sale
 * de la fila, no del cliente.
 */
export async function reopenProcess(
  kind: keyof typeof TABLE,
  processId: string,
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sesión no válida." };

  const { data: process } = await supabase
    .from(TABLE[kind])
    .select("id, status, project_id")
    .eq("id", processId)
    .maybeSingle();
  if (!process) return { ok: false, error: "Proceso no encontrado." };
  const blocker = reopenBlocker("process", process.status);
  if (blocker) return { ok: false, error: blocker };

  const { error } = await supabase
    .from(TABLE[kind])
    .update(reopenPatch("process"))
    .eq("id", processId);
  if (error) return { ok: false, error: logDbError(error, "No se pudo reabrir el proceso.") };

  revalidatePath(`/projects/${process.project_id}/${kind}/${processId}`);
  revalidatePath(`/projects/${process.project_id}`);
  return { ok: true };
}
