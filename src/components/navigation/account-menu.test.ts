import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { accountInitial, AccountMenu } from "./account-menu";

const render = (email: string) =>
  renderToStaticMarkup(
    createElement(AccountMenu, { email, theme: "system", signOut: async () => {} }),
  );

describe("AccountMenu (Fase 33)", () => {
  it("el botón «Cuenta» abre el panel con el atributo popover, sin JavaScript propio", () => {
    const html = render("topofieldsarf@gmail.com");
    // HTML no distingue mayúsculas en los atributos: React escribe popoverTarget.
    expect(html).toMatch(/<button[^>]*aria-label="Cuenta"[^>]*popovertarget="cuenta"/i);
    expect(html).toMatch(/<div[^>]*id="cuenta"[^>]*popover="auto"/);
  });

  it("el panel lleva el correo, el tema y «Cerrar sesión» en un formulario", () => {
    const html = render("topofieldsarf@gmail.com");
    expect(html).toMatch(/data-user-email[^>]*>topofieldsarf@gmail.com</);
    expect(html).toContain('aria-label="Tema"');
    expect(html).toMatch(/<form[\s\S]*<button[^>]*type="submit"[^>]*>Cerrar sesión<\/button>[\s\S]*<\/form>/);
  });
});

describe("accountInitial", () => {
  it("es la primera letra o cifra del correo, en mayúscula", () => {
    expect(accountInitial("topofieldsarf@gmail.com")).toBe("T");
    expect(accountInitial("  _kris@ceibatic.com")).toBe("K");
    expect(accountInitial("9nivel@x.co")).toBe("9");
  });

  it("sin correo, un signo de interrogación", () => {
    expect(accountInitial("")).toBe("?");
  });
});
