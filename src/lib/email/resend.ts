// Envío de un correo por la API HTTP de Resend (Fase 46). Solo del servidor.
//
// El remitente es el de pruebas de Resend mientras no haya un dominio
// verificado: con él, Resend solo entrega a la dirección dueña de la cuenta,
// que es justamente el administrador (`ADMIN_EMAIL`).

const REMITENTE = "TopoField <onboarding@resend.dev>";

export interface Correo {
  to: string;
  subject: string;
  text: string;
  html: string;
}

/**
 * Envía el correo. Devuelve si salió. Nunca lanza: quien llama decide qué hacer
 * con un fallo, y la solicitud de invitación se guarda igual.
 */
export async function enviarCorreo(
  correo: Correo,
  apiKey: string | undefined = process.env.RESEND_API_KEY,
): Promise<{ ok: true } | { ok: false; motivo: string }> {
  if (!apiKey) return { ok: false, motivo: "Falta RESEND_API_KEY" };
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from: REMITENTE, ...correo }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!r.ok) return { ok: false, motivo: `Resend respondió ${r.status}: ${await r.text()}` };
    return { ok: true };
  } catch (e) {
    return { ok: false, motivo: String(e) };
  }
}
