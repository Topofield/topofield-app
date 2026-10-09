import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Fase 22: la interfaz no habla del desarrollo. Había en pantalla referencias
// a secciones del PRD («§ 6.9»), a fases, a «la hoja de la universidad», a lo
// que el motor «hoy» no hace o a lo que hizo «la migración»: notas para quien
// programa, no para quien mide. Este test las busca en los textos de la
// interfaz —el código sin sus comentarios— para que no vuelvan.
//
// Queda fuera la página interna del sistema de diseño. El manual ya no: desde
// la Fase 42 su texto vive en `docs/manual/`, y `manual.test.ts` le aplica la
// misma regla.

const RAIZ = join(process.cwd(), "src");
const CARPETAS = ["components", "app"];
const EXCLUIDOS = [/^app\/design-system\//];

const PROHIBIDOS: [string, RegExp][] = [
  ["referencia a una sección del PRD", /§/g],
  ["referencia a una fase", /\bFase \d/g],
  ["la hoja de la universidad", /universidad/gi],
  ["lo que el motor «hoy» no hace", /\bHoy no\b/g],
  ["la migración", /\bla migración\b/gi],
];

/**
 * El código sin comentarios: los comentarios pueden explicar el desarrollo,
 * los textos que se pintan no. Quita `/* … *\/` (también dentro de JSX) y los
 * `//` de línea, sin tocar los `//` de una URL.
 */
export function sinComentarios(codigo: string): string {
  return codigo
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
    .replace(/(^|[^:"'`\\])\/\/[^\n]*/g, (_, antes: string) => antes);
}

function fuentes(): string[] {
  return CARPETAS.flatMap((carpeta) =>
    (readdirSync(join(RAIZ, carpeta), { recursive: true }) as string[])
      .map((f) => `${carpeta}/${f}`)
      .filter((f) => /\.tsx?$/.test(f) && !/\.test\.tsx?$/.test(f))
      .filter((f) => !EXCLUIDOS.some((e) => e.test(f))),
  );
}

describe("sin notas de desarrollo en la interfaz (Fase 22)", () => {
  it("revisa los componentes y las rutas", () => {
    expect(fuentes().length).toBeGreaterThan(100);
  });

  it("quita comentarios de bloque, de JSX y de línea, pero no las URL", () => {
    const codigo = `const a = 1; // Fase 9\n{/* § 6.9 */}\nconst url = "https://x.test/a";`;
    const limpio = sinComentarios(codigo);
    expect(limpio).not.toContain("Fase 9");
    expect(limpio).not.toContain("§");
    expect(limpio).toContain("https://x.test/a");
  });

  it("ningún texto de la interfaz cita el PRD, fases, la universidad, «hoy no» ni la migración", () => {
    const hallazgos: string[] = [];
    for (const archivo of fuentes()) {
      const texto = sinComentarios(readFileSync(join(RAIZ, archivo), "utf8"));
      for (const [motivo, patron] of PROHIBIDOS) {
        for (const m of texto.matchAll(patron)) {
          const linea = texto.slice(0, m.index).split("\n").length;
          hallazgos.push(`${archivo}:${linea} «${m[0]}» (${motivo})`);
        }
      }
    }
    expect(hallazgos).toEqual([]);
  });
});
