import { describe, expect, it } from "vitest";
import { composite, contrastRatio, parseThemeTokens } from "./contrast";

describe("parseThemeTokens — los dos temas desde globals.css (Fase 20)", () => {
  const css = `
    @theme {
      --color-ink: light-dark(#1C2427, #e8edec); /* tinta */
      --color-card:light-dark( #ffffff ,#1d2427 );
      --color-semaphore-red: #d94436;
      --font-mono: ui-monospace, monospace;
    }
  `;

  it("un light-dark da un valor a cada tema, en minúsculas", () => {
    const { claro, oscuro } = parseThemeTokens(css);
    expect(claro.ink).toBe("#1c2427");
    expect(oscuro.ink).toBe("#e8edec");
    expect(claro.card).toBe("#ffffff");
    expect(oscuro.card).toBe("#1d2427");
  });

  it("un hexadecimal a secas vale para los dos temas", () => {
    const { claro, oscuro } = parseThemeTokens(css);
    expect(claro["semaphore-red"]).toBe("#d94436");
    expect(oscuro["semaphore-red"]).toBe("#d94436");
  });

  it("ignora lo que no es un color", () => {
    expect(Object.keys(parseThemeTokens(css).claro).sort()).toEqual([
      "card",
      "ink",
      "semaphore-red",
    ]);
  });
});

describe("contrastRatio y composite", () => {
  it("negro sobre blanco es 21:1 y es simétrico", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 5);
    expect(contrastRatio("#ffffff", "#000000")).toBeCloseTo(21, 5);
  });

  it("un tinte al 10 % sobre blanco se compone antes de medir", () => {
    const tinte = composite("#c0392b", 0.1, "#ffffff");
    expect(contrastRatio("#c0392b", tinte)).toBeLessThan(contrastRatio("#c0392b", "#ffffff"));
  });
});
