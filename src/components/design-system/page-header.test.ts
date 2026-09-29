import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ActionBar } from "./action-bar";
import { PageHeader } from "./page-header";

// Fase 22: las primitivas de la pantalla del proceso.

describe("PageHeader", () => {
  it("pinta título, badge, subtítulo, acciones y lo de abajo", () => {
    const html = renderToStaticMarkup(
      createElement(
        PageHeader,
        {
          title: "Poligonal V10",
          badge: createElement("span", null, "Cerrado"),
          subtitle: "Poligonal · cerrada",
          actions: createElement("a", { href: "/x/export" }, "Exportar a Excel"),
        },
        createElement("p", null, "Cumple tercer orden"),
      ),
    );
    expect(html).toContain("<h1");
    expect(html).toContain("Poligonal V10");
    expect(html).toContain("Cerrado");
    expect(html).toContain("Poligonal · cerrada");
    expect(html).toContain("Exportar a Excel");
    expect(html).toContain("Cumple tercer orden");
    // El título va en <header>, que la impresión oculta.
    expect(html).toMatch(/<header[^>]*>[\s\S]*Poligonal V10[\s\S]*<\/header>/);
  });

  it("sin migas ni acciones no deja contenedores vacíos", () => {
    const html = renderToStaticMarkup(createElement(PageHeader, { title: "Nuevo informe" }));
    expect(html).not.toContain("<nav");
    expect(html).not.toContain("flex-wrap items-center gap-2");
  });

  it("con migas, pinta la ruta", () => {
    const html = renderToStaticMarkup(
      createElement(PageHeader, {
        title: "Tramo 2",
        breadcrumbs: [{ label: "Dashboard", href: "/dashboard" }, { label: "Tramo 2" }],
      }),
    );
    expect(html).toContain('aria-label="Ruta de navegación"');
  });
});

describe("ActionBar", () => {
  it("es fija al pie, anuncia su estado y no se imprime", () => {
    const html = renderToStaticMarkup(
      // `children` es obligatorio en los props: se pasa como tercer argumento.
      createElement(
        ActionBar,
        { status: "Cambios sin guardar" } as never,
        createElement("button", null, "Guardar"),
      ),
    );
    expect(html).toContain("sticky bottom-0");
    expect(html).toContain("print:hidden");
    expect(html).toContain('role="status"');
    expect(html).toContain("Cambios sin guardar");
    expect(html).toContain("Guardar");
  });
});
