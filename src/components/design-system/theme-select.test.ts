import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ThemeSelect } from "./theme-select";

const render = (initial: "system" | "light" | "dark") =>
  renderToStaticMarkup(createElement(ThemeSelect, { initial }));

describe("ThemeSelect", () => {
  it("es un select con etiqueta y las tres opciones con su nombre", () => {
    const html = render("system");
    expect(html).toContain('aria-label="Tema"');
    for (const o of ["Sistema", "Claro", "Oscuro"]) expect(html).toContain(`>${o}</option>`);
  });

  it("arranca en la elección que llega de la cookie, y la dice en el título", () => {
    const html = render("dark");
    expect(html).toMatch(/<option value="dark" selected="">Oscuro<\/option>/);
    expect(html).toContain('title="Tema: Oscuro"');
  });
});
