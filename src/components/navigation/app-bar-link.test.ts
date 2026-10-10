import { describe, expect, it } from "vitest";
import { isSectionActive } from "./app-bar-link";

describe("isSectionActive (Fase 33)", () => {
  it("la sección está activa en su ruta y en las que cuelgan de ella", () => {
    expect(isSectionActive("/manual", "/manual")).toBe(true);
    expect(isSectionActive("/manual/algo", "/manual")).toBe(true);
  });

  it("no lo está en otra ruta, aunque empiece por las mismas letras", () => {
    expect(isSectionActive("/dashboard", "/manual")).toBe(false);
    expect(isSectionActive("/manualidades", "/manual")).toBe(false);
  });
});
