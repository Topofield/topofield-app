import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ThemeSelect } from "./theme-select";

const render = (initial: "system" | "light" | "dark") =>
  renderToStaticMarkup(createElement(ThemeSelect, { initial }));

describe("ThemeSelect", () => {
  // Desde la Fase 33 va dentro del menú de cuenta: tres botones visibles con
  // su nombre, en un grupo con etiqueta, en lugar del icono con un <select>
  // invisible encima.
  it("es un grupo «Tema» con las tres opciones y su nombre", () => {
    const html = render("system");
    expect(html).toMatch(/role="group"[^>]*aria-label="Tema"/);
    for (const o of ["Sistema", "Claro", "Oscuro"]) expect(html).toContain(`>${o}</span>`);
  });

  it("arranca en la elección que llega de la cookie: solo esa está pulsada", () => {
    const html = render("dark");
    expect(html.match(/aria-pressed="true"/g)).toHaveLength(1);
    expect(html).toMatch(/aria-pressed="true"[^>]*>(?:(?!<\/button>)[\s\S])*Oscuro/);
  });
});
