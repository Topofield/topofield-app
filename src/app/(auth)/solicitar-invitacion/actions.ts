"use server";

import { avisoInvitacion, adminInvitationsUrl } from "@/lib/email/aviso-invitacion";
import { enviarCorreo } from "@/lib/email/resend";
import { createClient } from "@/lib/supabase/server";
import { isBot, validateInvitationRequest } from "@/lib/validators/invitation";

export interface SolicitudState {
  sent?: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
  values?: Record<string, string>;
}

const CAMPOS = ["first_name", "last_name", "email", "company", "purpose"];

/**
 * Guarda una solicitud de invitación y avisa al administrador (Fase 46).
 *
 * La respuesta es la misma tanto si la solicitud es nueva como si ya había
 * una viva para ese correo, o si la envió un robot (el campo trampa): la
 * pantalla no revela qué correos ya pidieron. Solo una solicitud nueva manda
 * el aviso. Si el aviso falla, la solicitud queda guardada igual y el
 * administrador la ve en su página.
 */
export async function solicitarInvitacionAction(
  _prev: SolicitudState,
  formData: FormData,
): Promise<SolicitudState> {
  if (isBot(formData)) return { sent: true };

  const values = Object.fromEntries(CAMPOS.map((c) => [c, String(formData.get(c) ?? "")]));
  const v = validateInvitationRequest(formData);
  if (!v.ok) {
    return { error: "Revise los campos marcados.", fieldErrors: v.errors, values };
  }

  const supabase = await createClient();
  const { data: nueva, error } = await supabase.rpc("request_invitation", {
    p_first_name: v.data.firstName,
    p_last_name: v.data.lastName,
    p_email: v.data.email,
    p_company: v.data.company ?? undefined,
    p_purpose: v.data.purpose ?? undefined,
  });
  if (error) {
    console.error("No se pudo guardar la solicitud de invitación:", error.message);
    return { error: "No se pudo enviar la solicitud. Inténtelo de nuevo.", values };
  }

  if (nueva) {
    const destino = process.env.ADMIN_EMAIL;
    if (!destino) {
      console.error("Solicitud guardada sin aviso: falta ADMIN_EMAIL.");
    } else {
      const aviso = avisoInvitacion(v.data, adminInvitationsUrl(process.env.VERCEL_PROJECT_PRODUCTION_URL));
      const envio = await enviarCorreo({ to: destino, ...aviso });
      if (!envio.ok) console.error("Solicitud guardada sin aviso:", envio.motivo);
    }
  }

  return { sent: true };
}
