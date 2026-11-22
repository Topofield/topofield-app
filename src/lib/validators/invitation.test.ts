import { describe, expect, it } from "vitest";
import { HONEYPOT_FIELD, isBot, validateInvitationRequest } from "./invitation";

function form(campos: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(campos)) f.set(k, v);
  return f;
}

describe("validateInvitationRequest", () => {
  it("acepta lo obligatorio, recorta y pasa el correo a minúsculas", () => {
    const r = validateInvitationRequest(
      form({ first_name: " Ana ", last_name: "Rojas", email: " Ana@Ejemplo.CO " }),
    );
    expect(r).toEqual({
      ok: true,
      data: { firstName: "Ana", lastName: "Rojas", email: "ana@ejemplo.co", company: null, purpose: null },
    });
  });

  it("guarda la empresa y el motivo cuando vienen", () => {
    const r = validateInvitationRequest(
      form({ first_name: "Ana", last_name: "Rojas", email: "a@b.co", company: " Obras SAS ", purpose: "Control de asentamientos" }),
    );
    expect(r.ok && r.data.company).toBe("Obras SAS");
    expect(r.ok && r.data.purpose).toBe("Control de asentamientos");
  });

  it("exige nombre, apellido y correo", () => {
    const r = validateInvitationRequest(form({}));
    expect(r.ok).toBe(false);
    expect(!r.ok && Object.keys(r.errors).sort()).toEqual(["email", "first_name", "last_name"]);
  });

  it("rechaza un correo mal formado", () => {
    const r = validateInvitationRequest(form({ first_name: "A", last_name: "B", email: "ana@ejemplo" }));
    expect(!r.ok && r.errors.email).toBeTruthy();
  });

  it("pone los límites de la base", () => {
    const r = validateInvitationRequest(
      form({
        first_name: "a".repeat(81),
        last_name: "B",
        email: "a@b.co",
        company: "c".repeat(121),
        purpose: "p".repeat(501),
      }),
    );
    expect(!r.ok && Object.keys(r.errors).sort()).toEqual(["company", "first_name", "purpose"]);
  });
});

describe("isBot", () => {
  it("es un robot si llenó el campo trampa", () => {
    expect(isBot(form({ [HONEYPOT_FIELD]: "https://spam.test" }))).toBe(true);
    expect(isBot(form({ [HONEYPOT_FIELD]: "  " }))).toBe(false);
    expect(isBot(form({}))).toBe(false);
  });
});
