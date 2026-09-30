import { describe, expect, it } from "vitest";
import { userMessage } from "./user-message";

const FALLBACK = "No se pudo guardar la visita.";

describe("userMessage (Fase 22)", () => {
  it("traduce los códigos conocidos, sin dejar pasar el texto de Postgres", () => {
    const casos: [string, RegExp][] = [
      ["23001", /cerrado/],
      ["23503", /dependen/],
      ["23505", /Ya existe/],
      ["42501", /permiso/],
    ];
    for (const [code, esperado] of casos) {
      const m = userMessage({ code, message: "El proceso 3f2a… está cerrado (closed)" }, FALLBACK);
      expect(m).toMatch(esperado);
      expect(m).not.toContain("3f2a");
    }
  });

  it("el check de un trigger propio, en español, pasa tal cual", () => {
    const message = "El punto TA-03 no está vigente el 2025-02-04; no admite lecturas en esa visita.";
    expect(userMessage({ code: "23514", message }, FALLBACK)).toBe(message);
  });

  it("el check de una columna, en inglés, se traduce", () => {
    const m = userMessage(
      { code: "23514", message: 'new row for relation "sites" violates check constraint "x"' },
      FALLBACK,
    );
    expect(m).toBe("Algún valor está fuera del rango permitido.");
  });

  it("código desconocido o ausente: el mensaje de la acción", () => {
    expect(userMessage({ code: "XX000", message: "internal error" }, FALLBACK)).toBe(FALLBACK);
    expect(userMessage({ message: "fetch failed" }, FALLBACK)).toBe(FALLBACK);
    expect(userMessage({}, FALLBACK)).toBe(FALLBACK);
  });
});
