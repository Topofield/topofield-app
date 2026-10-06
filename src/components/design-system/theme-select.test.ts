import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ThemeSelect } from "./theme-select";

type Choice = "system" | "light" | "dark";
const render = (initial: Choice, variant?: "icon" | "buttons") =>
  renderToStaticMarkup(createElement(ThemeSelect, { initial, variant }));

describe("ThemeSelect como icono (Fase 20), en la pantalla de inicio de sesión", () => {
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

describe("ThemeSelect como botones (Fase 33), en el menú de cuenta", () => {
  it("es un grupo «Tema» con las tres opciones y su nombre", () => {
    const html = render("system", "buttons");
    expect(html).toMatch(/role="group"[^>]*aria-label="Tema"/);
    for (const o of ["Sistema", "Claro", "Oscuro"]) expect(html).toContain(`>${o}</span>`);
  });

  it("arranca en la elección que llega de la cookie: solo esa está pulsada", () => {
    const html = render("dark", "buttons");
    expect(html.match(/aria-pressed="true"/g)).toHaveLength(1);
    expect(html).toMatch(/aria-pressed="true"[^>]*>(?:(?!<\/button>)[\s\S])*Oscuro/);
  });
});
