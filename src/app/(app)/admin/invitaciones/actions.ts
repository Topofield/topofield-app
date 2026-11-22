"use server";

import { revalidatePath } from "next/cache";
import { generateInviteCode } from "@/lib/auth/invite-code";
import { createClient } from "@/lib/supabase/server";

const RUTA = "/admin/invitaciones";

/**
 * El cliente de Supabase de la sesión, si es la del administrador. Las
 * políticas de `invitations` ya impiden que otro lea o decida: esto es para
 * no intentarlo siquiera.
 */
async function clienteDeAdmin() {
  const supabase = await createClient();
  const { data: esAdmin } = await supabase.rpc("is_admin");
  if (!esAdmin) throw new Error("Solo el administrador decide las invitaciones.");
  return supabase;
}

/**
 * Acepta una solicitud pendiente y le genera su código (Fase 46). Si el código
 * choca con uno existente —improbable: 31⁸ combinaciones—, se intenta con otro.
 */
export async function aceptarInvitacionAction(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  const supabase = await clienteDeAdmin();
  for (let intento = 0; intento < 3; intento++) {
    const { error } = await supabase
      .from("invitations")
      .update({ status: "approved", code: generateInviteCode(), decided_at: new Date().toISOString() })
      .eq("id", id)
      .eq("status", "pending");
    if (!error) {
      revalidatePath(RUTA);
      return;
    }
    if (error.code !== "23505") throw new Error(`No se pudo aceptar la solicitud: ${error.message}`);
  }
  throw new Error("No se pudo generar un código libre. Inténtelo de nuevo.");
}

/** Rechaza una solicitud pendiente. No avisa a nadie. */
export async function rechazarInvitacionAction(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  const supabase = await clienteDeAdmin();
  const { error } = await supabase
    .from("invitations")
    .update({ status: "rejected", decided_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "pending");
  if (error) throw new Error(`No se pudo rechazar la solicitud: ${error.message}`);
  revalidatePath(RUTA);
}
