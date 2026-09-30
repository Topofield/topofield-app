import { describe, expect, it } from "vitest";
import { guardedHref } from "./unsaved-changes";

// Fase 22. Sin jsdom los efectos no corren: se prueba la decisión, que es pura.

const AQUI = {
  origin: "https://topofield.test",
  pathname: "/projects/p1/leveling/l1",
  search: "",
};
const CLIC = { button: 0, modified: false };
const enlace = (href: string, extra: Partial<Parameters<typeof guardedHref>[0]> = {}) => ({
  href,
  target: "",
  hasDownload: false,
  skip: false,
  ...extra,
});

describe("guardedHref", () => {
  it("detiene un enlace interno a otra página y devuelve su ruta", () => {
    expect(
      guardedHref(enlace("https://topofield.test/projects/p1?tab=processes&modulo=nivelaciones"), CLIC, AQUI),
    ).toBe("/projects/p1?tab=processes&modulo=nivelaciones");
  });

  it("detiene el cambio de pestaña de la misma página", () => {
    expect(
      guardedHref(enlace("https://topofield.test/projects/p1/leveling/l1?tab=informe"), CLIC, AQUI),
    ).toBe("/projects/p1/leveling/l1?tab=informe");
  });

  it("deja pasar lo que no saca de la página", () => {
    // Solo el ancla.
    expect(guardedHref(enlace("https://topofield.test/projects/p1/leveling/l1#cotas"), CLIC, AQUI)).toBeNull();
    // Descarga del Excel.
    expect(
      guardedHref(enlace("https://topofield.test/projects/p1/leveling/l1/export", { hasDownload: true }), CLIC, AQUI),
    ).toBeNull();
    // Otra pestaña del navegador.
    expect(guardedHref(enlace("https://topofield.test/manual", { target: "_blank" }), CLIC, AQUI)).toBeNull();
    expect(guardedHref(enlace("https://topofield.test/manual"), { button: 0, modified: true }, AQUI)).toBeNull();
    expect(guardedHref(enlace("https://topofield.test/manual"), { button: 1, modified: false }, AQUI)).toBeNull();
    // Externo.
    expect(guardedHref(enlace("https://otro.test/x"), CLIC, AQUI)).toBeNull();
    // Marcado a propósito.
    expect(guardedHref(enlace("https://topofield.test/manual", { skip: true }), CLIC, AQUI)).toBeNull();
  });
});
