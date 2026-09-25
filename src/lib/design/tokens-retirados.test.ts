import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Fase 20, decisión 8: los tokens viejos se retiran, y nada puede volver a
// usarlos. Un `bg-neutral-100` o un `text-gray-500` no tomaría el tema oscuro
// y quedaría a medias en silencio; `globals.css` ya no los define, así que la
// clase no generaría nada, pero el fallo solo se vería mirando la pantalla.

const RAIZ = join(process.cwd(), "src");

const UTILIDAD =
  "(?:bg|text|border(?:-[trblxy])?|ring|fill|stroke|divide|outline|decoration|from|to|via|shadow|accent|caret|placeholder)";
const PALETA_POR_DEFECTO =
  "slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|white";

const PROHIBIDOS: [string, RegExp][] = [
  ["escala primary, neutral o paleta de Tailwind", new RegExp(`(?<![\\w-])${UTILIDAD}-(?:primary|${PALETA_POR_DEFECTO})(?:-\\d+)?(?:/\\d+)?(?![\\w-])`, "g")],
  ["escala numerada de estado", new RegExp(`(?<![\\w-])${UTILIDAD}-(?:success|warning|danger)-\\d+(?:/\\d+)?(?![\\w-])`, "g")],
  ["var() de un token retirado", /var\(--color-(?:primary|neutral|(?:success|warning|danger)-\d+)[\w-]*\)/g],
];

function fuentes(): string[] {
  return (readdirSync(RAIZ, { recursive: true }) as string[])
    .filter((f) => /\.(tsx?|css)$/.test(f) && !/\.test\.tsx?$/.test(f))
    .map((f) => join(RAIZ, f));
}

describe("tokens retirados (Fase 20)", () => {
  it("revisa todo el código de src/", () => {
    expect(fuentes().length).toBeGreaterThan(100);
  });

  it("ninguna clase ni var() usa un token retirado", () => {
    const hallazgos: string[] = [];
    for (const archivo of fuentes()) {
      const texto = readFileSync(archivo, "utf8");
      for (const [motivo, patron] of PROHIBIDOS) {
        for (const m of texto.matchAll(patron)) {
          const linea = texto.slice(0, m.index).split("\n").length;
          hallazgos.push(`${archivo.slice(RAIZ.length + 1)}:${linea} ${m[0]} (${motivo})`);
        }
      }
    }
    expect(hallazgos).toEqual([]);
  });
});
