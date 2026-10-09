import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { armarManual } from "@/lib/manual/manual";
import { anotarTitulos, lexear } from "@/lib/manual/markdown";
import { Markdown } from "./markdown";

const CAPTURAS: Record<string, [number, number]> = {
  "poligonal/01-a.png": [2560, 1600],
  "poligonal/02-b.png": [780, 1688],
};

function pintar(md: string, capturas = CAPTURAS): string {
  const tokens = lexear(md);
  anotarTitulos(tokens);
  return renderToStaticMarkup(createElement(Markdown, { tokens, capturas }));
}

describe("Markdown del manual", () => {
  it("una captura es una figura fuera de párrafo, a la mitad de su tamaño, con enlace y pie", () => {
    const html = pintar(
      '![Uno](../../public/manual/poligonal/01-a.png "El pie")\n\n![Dos](../../public/manual/poligonal/02-b.png)\n',
    );
    expect(html).not.toMatch(/<p>\s*<figure/);
    expect(html).toContain('width="1280" height="800"');
    expect(html).toContain('width="390" height="844"');
    expect(html).toContain('href="/manual/poligonal/01-a.png"');
    expect(html).toContain("<figcaption");
    expect(html.indexOf('loading="eager"')).toBeLessThan(html.indexOf('loading="lazy"'));
    expect(html.match(/loading="eager"/g)).toHaveLength(1);
  });

  it("los títulos llevan su ancla y los enlaces van a rutas de la app", () => {
    const html = pintar("## El amarre\n\nVea [ajustar](03-poligonal.md#ajustar) y [arriba](#el-amarre).\n");
    expect(html).toContain('<h2 id="el-amarre"');
    expect(html).toContain('href="/manual/poligonal#ajustar"');
    expect(html).toContain('href="#el-amarre"');
  });

  it("una lista numerada es de pasos, la nota es un aside y la tabla tiene th scope", () => {
    const html = pintar("1. Uno\n2. Dos\n\n> Ojo\n\n| A | B |\n|---|---|\n| 1 | 2 |\n");
    expect(html).toContain("<ol");
    expect(html).toMatch(/<span[^>]*>1<\/span>/);
    expect(html).toContain("<aside");
    expect(html).not.toContain('role="alert"');
    expect(html).toContain('<th scope="col"');
  });

  it("lo que el manual no admite falla, en vez de pintarse", () => {
    expect(() => pintar("<div>x</div>\n")).toThrow("no admite");
    expect(() => pintar("Ver [x](../tecnica/README.md)\n")).toThrow("no resuelve");
    expect(() => pintar("![x](https://example.org/x.png)\n")).toThrow("no es una captura");
    expect(() => pintar("![x](../../public/manual/poligonal/09-z.png)\n")).toThrow("capturas.json");
  });

  it("cada capítulo real se pinta sin error", () => {
    const dir = join(process.cwd(), "docs", "manual");
    const manual = armarManual(
      readdirSync(dir)
        .filter((n) => n.endsWith(".md"))
        .map((nombre) => ({ nombre, contenido: readFileSync(join(dir, nombre), "utf8") })),
      readFileSync(join(dir, "capturas.json"), "utf8"),
    );
    for (const c of manual.capitulos) {
      expect(() => renderToStaticMarkup(createElement(Markdown, { tokens: c.tokens, capturas: manual.capturas })), c.archivo).not.toThrow();
    }
    expect(() => renderToStaticMarkup(createElement(Markdown, { tokens: manual.intro, capturas: manual.capturas }))).not.toThrow();
  });
});
