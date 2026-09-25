import { describe, expect, it } from "vitest";
import { validateReferencePointInput } from "./reference-point";

function formulario(campos: Record<string, string>): FormData {
  const form = new FormData();
  for (const [k, v] of Object.entries(campos)) form.set(k, v);
  return form;
}

const BM = { code: "BM-1", type: "bm" };

describe("validateReferencePointInput — coma decimal (Fase 20, UI2)", () => {
  it("acepta coordenadas y cota con coma, y las redondea como con punto", () => {
    const r = validateReferencePointInput(
      formulario({ ...BM, north: "1000,12345", east: "2000,5", elevation: "2541,75449" }),
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.north).toBe(1000.123);
      expect(r.data.east).toBe(2000.5);
      expect(r.data.elevation).toBe(2541.7545);
    }
  });

  it("con punto da lo mismo", () => {
    const r = validateReferencePointInput(
      formulario({ ...BM, north: "1000.12345", east: "2000.5", elevation: "2541.75449" }),
    );
    expect(r.ok && r.data).toMatchObject({ north: 1000.123, east: 2000.5, elevation: 2541.7545 });
  });

  it("vacío es null, no un error", () => {
    const r = validateReferencePointInput(formulario({ ...BM, north: "", east: "", elevation: "" }));
    expect(r.ok && r.data).toMatchObject({ north: null, east: null, elevation: null });
  });

  it("un texto que no es número se rechaza con su mensaje", () => {
    const r = validateReferencePointInput(
      formulario({ ...BM, north: "1.000,5", east: "abc", elevation: "2541,7,5" }),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors.north).toBe("El Norte debe ser un número.");
      expect(r.errors.east).toBe("El Este debe ser un número.");
      expect(r.errors.elevation).toBe("La cota debe ser un número.");
    }
  });
});
