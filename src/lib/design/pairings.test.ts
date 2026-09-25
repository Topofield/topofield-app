import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { formatRatio, parseThemeTokens } from "./contrast";
import { medirPairings, PAIRINGS } from "./pairings";

// Fase 20: el contraste es un test, no un paso manual. Con dos temas las
// parejas se duplican, y abrir `/design-system` para mirarlas dejaría de ser
// fiable. Lee la hoja de estilos real: su única fuente de verdad.
const css = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");
const temas = parseThemeTokens(css);

describe.each([
  ["claro", temas.claro],
  ["oscuro", temas.oscuro],
] as const)("contraste — tema %s", (_, tokens) => {
  const medidas = medirPairings(tokens);

  it("todos los tokens de la tabla existen en globals.css", () => {
    const faltan = PAIRINGS.flatMap((p) => [p.fg, p.bg]).filter(
      (t) => !t.startsWith("#") && tokens[t] === undefined,
    );
    expect(faltan).toEqual([]);
    expect(medidas).toHaveLength(PAIRINGS.length);
  });

  it("cada pareja cumple su umbral", () => {
    const fallos = medidas
      .filter((m) => !m.cumple && !m.informativo)
      .map((m) => `${m.fg} sobre ${m.bg}: ${formatRatio(m.ratio)} (mín. ${m.umbral}:1) — ${m.donde}`);
    expect(fallos).toEqual([]);
  });
});
