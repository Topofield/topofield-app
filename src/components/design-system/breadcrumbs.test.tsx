import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Breadcrumbs, resolveBreadcrumbs } from "./breadcrumbs";

describe("resolveBreadcrumbs", () => {
  it("marca el último elemento como actual y sin enlace", () => {
    const r = resolveBreadcrumbs([
      { label: "Dashboard", href: "/dashboard" },
      { label: "Lote catastral", href: "/projects/1" },
      { label: "Cuadrado con error", href: "/projects/1/polygonal/2" },
    ]);
    expect(r.trail).toHaveLength(3);
    expect(r.trail[2]?.current).toBe(true);
    expect(r.trail[2]?.href).toBeUndefined();
    expect(r.trail[0]?.current).toBe(false);
    expect(r.trail[0]?.href).toBe("/dashboard");
  });

  it("expone el nivel anterior para el retorno móvil", () => {
    const r = resolveBreadcrumbs([
      { label: "Dashboard", href: "/dashboard" },
      { label: "Lote catastral", href: "/projects/1" },
      { label: "Nueva poligonal" },
    ]);
    expect(r.parent).toEqual({ label: "Lote catastral", href: "/projects/1" });
  });

  it("no devuelve nivel anterior cuando solo hay un elemento", () => {
    const r = resolveBreadcrumbs([{ label: "Dashboard", href: "/dashboard" }]);
    expect(r.parent).toBeNull();
    expect(r.trail[0]?.current).toBe(true);
  });

  it("ignora elementos vacíos sin romper la ruta", () => {
    const r = resolveBreadcrumbs([
      { label: "Dashboard", href: "/dashboard" },
      { label: "", href: "/projects/1" },
      { label: "Proceso" },
    ]);
    expect(r.trail).toHaveLength(2);
    expect(r.trail[1]?.label).toBe("Proceso");
  });

  it("deja trail vacío y parent nulo cuando todos los labels están vacíos", () => {
    const r = resolveBreadcrumbs([
      { label: "", href: "/dashboard" },
      { label: "", href: "/projects/1" },
      { label: "" },
    ]);
    expect(r.trail).toHaveLength(0);
    expect(r.trail[0]?.label).toBeUndefined();
    expect(r.parent).toBeNull();
  });
});

describe("Breadcrumbs en la barra (Fase 33)", () => {
  // La página pinta su ruta en el servidor, con sus nombres, y el CSS la
  // coloca dentro de la barra fija: sin JavaScript, sin parpadeo y sin salto.
  // Sin esta colocación, las migas vuelven a ocupar una fila de la página.
  it("se coloca fija, arriba, en el hueco entre el logo y los iconos", () => {
    const html = renderToStaticMarkup(
      createElement(Breadcrumbs, {
        items: [
          { label: "Dashboard", href: "/dashboard" },
          { label: "Lote catastral", href: "/projects/1" },
          { label: "Cuadrado" },
        ],
      }),
    );
    const nav = html.match(/<nav[^>]*class="([^"]*)"/)?.[1] ?? "";
    for (const c of ["fixed", "top-0", "h-(--barra-alto)", "left-(--ruta-inicio)", "right-(--ruta-fin)"]) {
      expect(nav.split(" ")).toContain(c);
    }
  });
});
