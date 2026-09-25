import { describe, expect, it } from "vitest";
import { themeAttribute, themeCookie, themeFromCookie } from "./theme";

describe("themeFromCookie", () => {
  it("claro y oscuro se respetan", () => {
    expect(themeFromCookie("light")).toBe("light");
    expect(themeFromCookie("dark")).toBe("dark");
  });

  it("sin cookie, o con un valor desconocido, sigue al sistema", () => {
    expect(themeFromCookie(undefined)).toBe("system");
    expect(themeFromCookie(null)).toBe("system");
    expect(themeFromCookie("")).toBe("system");
    expect(themeFromCookie("DARK")).toBe("system");
    expect(themeFromCookie("sepia")).toBe("system");
  });
});

describe("themeAttribute", () => {
  it("«sistema» no pone atributo: decide la media query", () => {
    expect(themeAttribute("system")).toBeUndefined();
    expect(themeAttribute("dark")).toBe("dark");
    expect(themeAttribute("light")).toBe("light");
  });
});

describe("themeCookie", () => {
  it("guarda la elección un año, en toda la app", () => {
    expect(themeCookie("dark", false)).toBe(
      "topofield-theme=dark; max-age=31536000; path=/; samesite=lax",
    );
  });

  it("«sistema» borra la cookie", () => {
    expect(themeCookie("system", false)).toBe("topofield-theme=; max-age=0; path=/; samesite=lax");
  });

  it("en HTTPS la marca como segura", () => {
    expect(themeCookie("light", true)).toMatch(/; secure$/);
  });
});
