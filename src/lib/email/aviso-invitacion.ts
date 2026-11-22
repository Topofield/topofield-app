// El correo que avisa al administrador de una solicitud nueva (Fase 46).
// Puro: arma el asunto y el cuerpo; enviarlo es cosa de `resend.ts`.
//
// Lo que escribe el solicitante va escapado en el HTML: es un formulario
// público, y el correo lo abre el administrador.

import type { InvitationRequestInput } from "@/lib/validators/invitation";

export interface AvisoInvitacion {
  subject: string;
  text: string;
  html: string;
}

export function escapeHtml(texto: string): string {
  return texto
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function avisoInvitacion(
  solicitud: InvitationRequestInput,
  adminUrl: string,
): AvisoInvitacion {
  const nombre = `${solicitud.firstName} ${solicitud.lastName}`;
  const filas: [string, string][] = [
    ["Nombre", nombre],
    ["Correo", solicitud.email],
    ["Empresa o entidad", solicitud.company ?? "—"],
    ["Para qué", solicitud.purpose ?? "—"],
  ];

  const text = [
    `${nombre} solicita una invitación a TopoField.`,
    "",
    ...filas.map(([k, v]) => `${k}: ${v}`),
    "",
    `Acéptela o recházela en ${adminUrl}`,
  ].join("\n");

  const html = `<!doctype html>
<html lang="es"><body style="margin:0;padding:24px;background:#f4f6f5;font-family:Helvetica,Arial,sans-serif;color:#1c2427">
<table role="presentation" width="100%" style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #dde3e2;border-radius:8px">
<tr><td style="padding:24px 24px 8px;font-size:18px;font-weight:bold">Solicitud de invitación</td></tr>
<tr><td style="padding:0 24px 16px;color:#56636a">${escapeHtml(nombre)} quiere usar TopoField.</td></tr>
<tr><td style="padding:0 24px"><table role="presentation" width="100%" style="border-collapse:collapse;font-size:14px">
${filas
  .map(
    ([k, v]) =>
      `<tr><td style="padding:8px 0;border-top:1px solid #dde3e2;color:#56636a;width:140px;vertical-align:top">${escapeHtml(k)}</td><td style="padding:8px 0;border-top:1px solid #dde3e2;white-space:pre-wrap">${escapeHtml(v)}</td></tr>`,
  )
  .join("\n")}
</table></td></tr>
<tr><td style="padding:24px"><a href="${escapeHtml(adminUrl)}" style="display:inline-block;background:#e2ad0b;color:#231b00;text-decoration:none;font-weight:bold;padding:10px 18px;border-radius:6px">Revisar la solicitud</a></td></tr>
</table></body></html>`;

  return { subject: `Solicitud de invitación: ${nombre}`, text, html };
}

/**
 * La dirección de la página del administrador para el enlace del correo. No
 * sale de las cabeceras de la petición —el formulario es público y el enlace
 * llega a un correo—: es la de producción, que Vercel define sola, o la local.
 */
export function adminInvitationsUrl(produccion: string | undefined): string {
  const base = produccion ? `https://${produccion}` : "http://localhost:3000";
  return `${base}/admin/invitaciones`;
}
