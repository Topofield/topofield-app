import { describe, expect, it } from "vitest";
import { tabHref } from "./tabs";

describe("tabHref", () => {
  it("conserva los demás parámetros al cambiar de pestaña", () => {
    const href = tabHref("/projects/1", "config", {
      tab: "processes",
      q: "cuadrado",
      estado: "calculated",
    });
    expect(href).toContain("tab=config");
    expect(href).toContain("q=cuadrado");
    expect(href).toContain("estado=calculated");
  });

  it("funciona sin parámetros previos", () => {
    expect(tabHref("/projects/1", "reports", undefined)).toBe(
      "/projects/1?tab=reports",
    );
  });

  it("reemplaza el tab anterior en vez de duplicarlo", () => {
    const href = tabHref("/projects/1", "config", { tab: "processes" });
    expect(href.match(/tab=/g)).toHaveLength(1);
    expect(href).toContain("tab=config");
  });

  it("descarta parámetros vacíos", () => {
    const href = tabHref("/projects/1", "config", { q: undefined, estado: "" });
    expect(href).toBe("/projects/1?tab=config");
  });
});
