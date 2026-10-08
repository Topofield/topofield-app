import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseThemeTokens } from "@/lib/design/contrast";
import { WORKBOOK_COLORS } from "./workbook";

// Fase 24: el Excel usa la paleta de la identidad. Sus colores son copias de
// los tokens del tema claro; si un token cambia, este test lo señala.

const claro = parseThemeTokens(
  readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8"),
).claro;

const argb = (hex: string) => `FF${hex.replace("#", "").toUpperCase()}`;

describe("colores del Excel", () => {
  it.each([
    ["ink", "ink"],
    ["ink2", "ink-2"],
    ["sel", "sel"],
    ["ruleStrong", "rule-strong"],
    ["miraBg", "mira-bg"],
    ["miraInk", "mira-ink"],
    ["success", "success"],
    ["danger", "danger"],
  ] as const)("%s es --color-%s del tema claro", (clave, token) => {
    expect(claro[token]).toBeDefined();
    expect(WORKBOOK_COLORS[clave]).toBe(argb(claro[token]!));
  });
});
