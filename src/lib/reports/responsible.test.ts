import { describe, expect, it } from "vitest";
import { responsibleLabel } from "./responsible";

describe("responsibleLabel (Fase 22)", () => {
  it("prefiere el nombre completo del perfil", () => {
    expect(
      responsibleLabel({ full_name: "Ana Pérez", first_name: "Ana", last_name: "Pérez" }, "a@x.co"),
    ).toBe("Ana Pérez");
  });

  it("sin nombre completo, nombre y apellido", () => {
    expect(responsibleLabel({ full_name: null, first_name: "Ana", last_name: " " }, null)).toBe("Ana");
  });

  it("sin perfil con nombre, el correo; sin nada, null (nunca el id)", () => {
    expect(responsibleLabel({ full_name: " ", first_name: "", last_name: null }, "a@x.co")).toBe("a@x.co");
    expect(responsibleLabel(null, null)).toBeNull();
  });
});
