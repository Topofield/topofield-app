// El manual real (Fase 42): los archivos de docs/manual/ y las capturas de
// public/manual/. Sustituye a la revisión a mano de `CAPTURAS` (método, § 3).

import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { armarManual, capituloConVecinos, type Manual } from "./manual";
import { lexear, recorrer, resolverCaptura, resolverEnlace, type Token, type Tokens } from "./markdown";
import { medidasPng } from "./png";

const RAIZ = process.cwd();
const DOCS = join(RAIZ, "docs", "manual");
const PUBLICO = join(RAIZ, "public", "manual");

function leer(): Manual {
  const archivos = readdirSync(DOCS)
    .filter((n) => n.endsWith(".md"))
    .map((nombre) => ({ nombre, contenido: readFileSync(join(DOCS, nombre), "utf8") }));
  return armarManual(archivos, readFileSync(join(DOCS, "capturas.json"), "utf8"));
}

const manual = leer();
const readme = lexear(readFileSync(join(DOCS, "README.md"), "utf8"));

/** Los enlaces y las imágenes de unos tokens. */
function piezas(tokens: Token[]) {
  const enlaces: string[] = [];
  const imagenes: Tokens.Image[] = [];
  recorrer(tokens, (t) => {
    if (t.type === "link") enlaces.push((t as Tokens.Link).href);
    if (t.type === "image") imagenes.push(t as Tokens.Image);
  });
  return { enlaces, imagenes };
}

describe("los capítulos", () => {
  it("van numerados desde 01, sin huecos, con slugs únicos", () => {
    expect(manual.capitulos.map((c) => c.numero)).toEqual(manual.capitulos.map((_, i) => i + 1));
    const slugs = manual.capitulos.map((c) => c.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    expect(manual.capitulos.length).toBeGreaterThanOrEqual(8);
  });

  it("el README los enlaza todos, en orden", () => {
    const enlazados = piezas(readme)
      .enlaces.map(resolverEnlace)
      .flatMap((e) => (e.tipo === "interno" && e.archivo !== "README.md" ? [e.archivo] : []));
    expect(enlazados).toEqual(manual.capitulos.map((c) => c.archivo));
  });

  it("cada uno tiene título, resumen y flujos", () => {
    for (const c of manual.capitulos) {
      expect(c.titulo, c.archivo).not.toBe("");
      expect(c.resumen.length, c.archivo).toBeGreaterThan(40);
      expect(c.secciones.length, c.archivo).toBeGreaterThan(1);
    }
  });

  it("la portada tiene introducción", () => {
    expect(manual.intro.length).toBeGreaterThan(0);
  });

  it("los vecinos: el primero no tiene anterior y el último no tiene siguiente", () => {
    const primero = capituloConVecinos(manual, manual.capitulos[0]!.slug);
    const ultimo = capituloConVecinos(manual, manual.capitulos.at(-1)!.slug);
    expect(primero?.anterior).toBeNull();
    expect(ultimo?.siguiente).toBeNull();
    expect(capituloConVecinos(manual, "no-existe")).toBeNull();
  });

  it("no hablan del desarrollo: sin «§», «Fase N» ni «PRD»", () => {
    for (const c of manual.capitulos) {
      const texto = readFileSync(join(DOCS, c.archivo), "utf8");
      expect(texto, c.archivo).not.toMatch(/§|\bFase \d|\bPRD\b/);
    }
  });

  it("no llevan HTML crudo", () => {
    for (const c of manual.capitulos) {
      recorrer(c.tokens, (t) => expect(t.type, `${c.archivo}: ${t.raw.slice(0, 40)}`).not.toBe("html"));
    }
  });
});

describe("los enlaces", () => {
  const anclas = new Map(manual.capitulos.map((c) => [c.archivo, new Set(c.titulos.map((t) => t.id))]));

  it("todo enlace interno y toda ancla resuelven; los externos son https", () => {
    const fuentes: [string, Token[]][] = [
      ["README.md", readme],
      ...manual.capitulos.map((c): [string, Token[]] => [c.archivo, c.tokens]),
    ];
    for (const [archivo, tokens] of fuentes) {
      for (const href of piezas(tokens).enlaces) {
        const e = resolverEnlace(href);
        expect(e.tipo, `${archivo}: ${href}`).not.toBe("invalido");
        if (e.tipo === "interno" && e.archivo !== "README.md") {
          expect(anclas.has(e.archivo), `${archivo}: ${href}`).toBe(true);
          if (e.ancla) expect(anclas.get(e.archivo)!.has(e.ancla), `${archivo}: ${href}`).toBe(true);
        }
        if (e.tipo === "ancla") {
          expect(anclas.get(archivo)?.has(e.ancla), `${archivo}: ${href}`).toBe(true);
        }
      }
    }
  });
});

describe("las capturas", () => {
  const usadas = new Set<string>();

  it("cada imagen es una captura de su capítulo, existe, tiene alt y está en el manifiesto con su tamaño real", () => {
    for (const c of manual.capitulos) {
      for (const img of piezas(c.tokens).imagenes) {
        const captura = resolverCaptura(img.href);
        expect(captura, `${c.archivo}: ${img.href}`).not.toBeNull();
        expect(captura!.carpeta, `${c.archivo}: ${img.href}`).toBe(c.slug);
        expect(img.text.trim().length, `${c.archivo}: alt de ${img.href}`).toBeGreaterThan(10);
        const ruta = join(PUBLICO, captura!.clave);
        expect(existsSync(ruta), ruta).toBe(true);
        const { ancho, alto } = medidasPng(readFileSync(ruta));
        expect(manual.capturas[captura!.clave], captura!.clave).toEqual([ancho, alto]);
        usadas.add(captura!.clave);
      }
    }
  });

  it("no sobra ningún PNG ni ninguna entrada del manifiesto", () => {
    const enDisco = readdirSync(PUBLICO).flatMap((nombre) => {
      const ruta = join(PUBLICO, nombre);
      if (!statSync(ruta).isDirectory()) return [nombre];
      return readdirSync(ruta).map((archivo) => `${nombre}/${archivo}`);
    });
    expect(enDisco.filter((p) => !usadas.has(p))).toEqual([]);
    expect(Object.keys(manual.capturas).filter((p) => !usadas.has(p))).toEqual([]);
  });
});
