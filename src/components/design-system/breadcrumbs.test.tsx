import { describe, expect, it } from "vitest";
import { resolveBreadcrumbs } from "./breadcrumbs";

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
});
