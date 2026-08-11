import { describe, expect, it } from "vitest";
import { invitacionValida, validateSignUpInput } from "./sign-up";

function formulario(campos: Record<string, string>): FormData {
  const form = new FormData();
  for (const [k, v] of Object.entries(campos)) form.set(k, v);
  return form;
}

const COMPLETO = {
  first_name: "Ana",
  last_name: "Rojas",
  email: "ana@ejemplo.com",
  password: "secreta123",
  invite_code: "TOPO-2026",
};

describe("invitacionValida", () => {
  it("acepta el código exacto", () => {
    expect(invitacionValida("TOPO-2026", "TOPO-2026")).toBe(true);
  });

  it("tolera espacios alrededor, que arrastra el copiar y pegar", () => {
    expect(invitacionValida("  TOPO-2026  ", "TOPO-2026")).toBe(true);
  });

  it("distingue mayúsculas de minúsculas", () => {
    expect(invitacionValida("topo-2026", "TOPO-2026")).toBe(false);
  });

  it("rechaza un código vacío", () => {
    expect(invitacionValida("", "TOPO-2026")).toBe(false);
  });

  // El caso que de verdad importa: un despliegue sin la variable configurada
  // debe bloquear el registro, no abrirlo.
  it("rechaza siempre si no hay código configurado", () => {
    expect(invitacionValida("TOPO-2026", undefined)).toBe(false);
    expect(invitacionValida("", undefined)).toBe(false);
    expect(invitacionValida("lo que sea", "")).toBe(false);
  });
});

describe("validateSignUpInput", () => {
  it("acepta un formulario completo y recorta los espacios", () => {
    const r = validateSignUpInput(
      formulario({ ...COMPLETO, first_name: "  Ana  " }),
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.firstName).toBe("Ana");
      expect(r.data.email).toBe("ana@ejemplo.com");
    }
  });

  it("exige nombre, apellido, correo, contraseña y código", () => {
    const r = validateSignUpInput(new FormData());
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(Object.keys(r.errors).sort()).toEqual([
        "email",
        "first_name",
        "invite_code",
        "last_name",
        "password",
      ]);
    }
  });

  it("rechaza una contraseña más corta que el mínimo", () => {
    const r = validateSignUpInput(formulario({ ...COMPLETO, password: "abc" }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.password).toContain("6");
  });

  it("no recorta la contraseña: los espacios son caracteres válidos", () => {
    const r = validateSignUpInput(
      formulario({ ...COMPLETO, password: "  con espacios  " }),
    );
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.password).toBe("  con espacios  ");
  });

  it("rechaza un correo sin arroba", () => {
    const r = validateSignUpInput(
      formulario({ ...COMPLETO, email: "ana.ejemplo.com" }),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.email).toBeDefined();
  });
});
