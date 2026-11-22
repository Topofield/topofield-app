import { describe, expect, it } from "vitest";
import { MIN_PASSWORD, validateInvitationCheck, validateSignUpInput } from "./sign-up";

function form(campos: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(campos)) f.set(k, v);
  return f;
}

describe("validateInvitationCheck", () => {
  it("normaliza el correo y el código", () => {
    expect(validateInvitationCheck(form({ email: " Ana@Ejemplo.CO ", invite_code: " abcd-efgh " }))).toEqual({
      ok: true,
      data: { email: "ana@ejemplo.co", code: "ABCDEFGH" },
    });
  });

  it("exige el correo y el código", () => {
    const r = validateInvitationCheck(form({}));
    expect(!r.ok && Object.keys(r.errors).sort()).toEqual(["email", "invite_code"]);
  });

  it("rechaza un código que no tiene la forma", () => {
    const r = validateInvitationCheck(form({ email: "a@b.co", invite_code: "ABC-123" }));
    expect(!r.ok && r.errors.invite_code).toMatch(/ocho caracteres/);
  });

  it("rechaza un correo sin dominio", () => {
    const r = validateInvitationCheck(form({ email: "ana@", invite_code: "ABCDEFGH" }));
    expect(!r.ok && r.errors.email).toBeTruthy();
  });
});

describe("validateSignUpInput", () => {
  it("acepta el correo, el código y la contraseña", () => {
    expect(validateSignUpInput(form({ email: "a@b.co", invite_code: "abcdefgh", password: "secreta" }))).toEqual({
      ok: true,
      data: { email: "a@b.co", code: "ABCDEFGH", password: "secreta" },
    });
  });

  it("rechaza una contraseña más corta que el mínimo", () => {
    const r = validateSignUpInput(form({ email: "a@b.co", invite_code: "ABCDEFGH", password: "x".repeat(MIN_PASSWORD - 1) }));
    expect(!r.ok && r.errors.password).toBeTruthy();
  });

  it("no recorta la contraseña: los espacios son caracteres válidos", () => {
    const r = validateSignUpInput(form({ email: "a@b.co", invite_code: "ABCDEFGH", password: "  abcd  " }));
    expect(r.ok && r.data.password).toBe("  abcd  ");
  });

  it("junta los errores de los dos pasos", () => {
    const r = validateSignUpInput(form({ email: "", invite_code: "", password: "" }));
    expect(!r.ok && Object.keys(r.errors).sort()).toEqual(["email", "invite_code", "password"]);
  });
});
