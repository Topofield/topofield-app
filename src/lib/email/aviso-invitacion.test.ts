import { describe, expect, it } from "vitest";
import { adminInvitationsUrl, avisoInvitacion, escapeHtml } from "./aviso-invitacion";

const solicitud = {
  firstName: "Ana",
  lastName: "Rojas",
  email: "ana@ejemplo.co",
  company: "Obras SAS",
  purpose: null,
};

describe("el aviso de una solicitud", () => {
  it("lleva el nombre en el asunto", () => {
    expect(avisoInvitacion(solicitud, "https://x.test/admin/invitaciones").subject).toBe(
      "Solicitud de invitación: Ana Rojas",
    );
  });

  it("el texto lleva los datos y el enlace", () => {
    const { text } = avisoInvitacion(solicitud, "https://x.test/admin/invitaciones");
    expect(text).toContain("Correo: ana@ejemplo.co");
    expect(text).toContain("Empresa o entidad: Obras SAS");
    expect(text).toContain("Para qué: —");
    expect(text).toContain("https://x.test/admin/invitaciones");
  });

  it("escapa en el HTML lo que escribió el solicitante", () => {
    const { html } = avisoInvitacion(
      { ...solicitud, firstName: '<img src=x onerror="alert(1)">', purpose: "a & b" },
      "https://x.test/admin/invitaciones",
    );
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;");
    expect(html).toContain("a &amp; b");
  });

  it("escapeHtml cubre los cinco caracteres", () => {
    expect(escapeHtml(`<>&"'`)).toBe("&lt;&gt;&amp;&quot;&#39;");
  });
});

describe("adminInvitationsUrl", () => {
  it("usa el dominio de producción cuando lo hay", () => {
    expect(adminInvitationsUrl("topofield-app.vercel.app")).toBe(
      "https://topofield-app.vercel.app/admin/invitaciones",
    );
  });

  it("en local, el servidor de desarrollo", () => {
    expect(adminInvitationsUrl(undefined)).toBe("http://localhost:3000/admin/invitaciones");
    expect(adminInvitationsUrl("")).toBe("http://localhost:3000/admin/invitaciones");
  });
});
