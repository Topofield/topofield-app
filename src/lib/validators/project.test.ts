// Tests del validador de proyecto (paso de creación y edición).
//
// Desde la Fase 8 el proyecto ya no captura equipo ni precisión —eso vive en
// cada proceso—, así que estos casos fijan que `validateProjectInput` no
// vuelva a exigirlos, además de la validación básica que sí conserva.

import { describe, expect, it } from "vitest";
import { validateProjectInput } from "./project";

function formulario(campos: Record<string, string>): FormData {
  const form = new FormData();
  for (const [k, v] of Object.entries(campos)) form.set(k, v);
  return form;
}

const COMPLETO = {
  name: "Proyecto Chapinero",
  client: "Alcaldía Local",
  location: "Bogotá D.C.",
  datum: "MAGNA-SIRGAS",
};

describe("validateProjectInput", () => {
  it("acepta un proyecto completo sin datos de equipo ni precisión", () => {
    const r = validateProjectInput(formulario(COMPLETO));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.name).toBe(COMPLETO.name);
      expect(r.data.datum).toBe(COMPLETO.datum);
    }
  });

  it("ya no exige equipo ni orden de precisión: el proyecto no los captura desde la Fase 8", () => {
    const r = validateProjectInput(
      formulario({
        ...COMPLETO,
        equipment_brand: "",
        angular_precision_seconds: "0",
        precision_order: "",
      }),
    );
    expect(r.ok).toBe(true);
    // La guarda iba invertida (`if (!r.ok)`) y estas afirmaciones no llegaban
    // a ejecutarse nunca. En la rama buena no hay `errors` que inspeccionar,
    // así que lo que fija la intención de la fase es el dato devuelto: los
    // tres campos entran en el formulario y NO salen en `ProjectInput`.
    if (r.ok) {
      expect(Object.keys(r.data).sort()).toEqual([
        "client",
        "datum",
        "description",
        "latitude",
        "location",
        "longitude",
        "name",
        "projection",
      ]);
    }
  });

  it("exige nombre, cliente, ubicación y datum", () => {
    const r = validateProjectInput(new FormData());
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(Object.keys(r.errors).sort()).toEqual([
        "client",
        "datum",
        "location",
        "name",
      ]);
    }
  });

  it("recorta los espacios y convierte descripción y proyección vacías a null", () => {
    const r = validateProjectInput(
      formulario({ ...COMPLETO, name: "  Proyecto Chapinero  " }),
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.name).toBe("Proyecto Chapinero");
      expect(r.data.description).toBeNull();
      expect(r.data.projection).toBeNull();
    }
  });

  it("acepta la latitud y la longitud con coma decimal (Fase 20)", () => {
    const r = validateProjectInput(
      formulario({ ...COMPLETO, latitude: "4,6097", longitude: "-74,0817" }),
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.latitude).toBe(4.6097);
      expect(r.data.longitude).toBe(-74.0817);
    }
  });

  it("rechaza una latitud con separador de miles: no se adivina", () => {
    const r = validateProjectInput(
      formulario({ ...COMPLETO, latitude: "1.234,5" }),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.latitude).toBeDefined();
  });

  it("rechaza una latitud fuera de rango", () => {
    const r = validateProjectInput(
      formulario({ ...COMPLETO, latitude: "95" }),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.latitude).toBeDefined();
  });
});
