/**
 * El Markdown del manual (Fase 42): lectura, títulos con su ancla y
 * resolución de enlaces e imágenes. Funciones puras, sin `fs` ni React.
 *
 * El manual vive en `docs/manual/` —un archivo por capítulo— y se lee igual en
 * GitHub que en la ruta `/manual`. Por eso las anclas siguen el slug de GitHub
 * y los enlaces se escriben entre archivos (`03-poligonal.md#ajustar`): aquí
 * se traducen a rutas de la aplicación.
 */

import { Lexer, type Token, type Tokens } from "marked";

export type { Token, Tokens };

/** Un título con el ancla que le corresponde. */
export interface Titulo {
  nivel: number;
  texto: string;
  id: string;
}

/** Un `heading` de `marked` con su ancla ya calculada. */
export type TituloConId = Tokens.Heading & { id: string };

/** Lee un Markdown con GFM (tablas incluidas). */
export function lexear(md: string): Token[] {
  return Lexer.lex(md, { gfm: true });
}

/**
 * El slug de GitHub para un título: minúsculas, fuera la puntuación (se
 * conservan letras con tilde, números, `-`, `_` y espacios) y cada espacio
 * pasa a guion. Los duplicados los resuelve `anotarTitulos`.
 */
export function slugGithub(texto: string): string {
  return texto
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}\p{Pc}\- ]/gu, "")
    .replace(/ /g, "-");
}

/** El texto plano de una lista de tokens en línea (sin formato). */
export function textoPlano(tokens: Token[] | undefined): string {
  if (!tokens) return "";
  return tokens
    .map((t) => {
      if ("tokens" in t && Array.isArray(t.tokens)) return textoPlano(t.tokens);
      if (t.type === "br") return " ";
      return "text" in t && typeof t.text === "string" ? t.text : "";
    })
    .join("");
}

/**
 * Da a cada título de `tokens` (también los anidados) su ancla única, como
 * GitHub: el segundo «Paso» es `paso-1`. Escribe `id` en el token y devuelve
 * la lista en orden.
 */
export function anotarTitulos(tokens: Token[]): Titulo[] {
  const usados = new Map<string, number>();
  const titulos: Titulo[] = [];
  recorrer(tokens, (t) => {
    if (t.type !== "heading") return;
    const texto = textoPlano(t.tokens);
    const base = slugGithub(texto);
    const veces = usados.get(base) ?? 0;
    usados.set(base, veces + 1);
    const id = veces === 0 ? base : `${base}-${veces}`;
    (t as TituloConId).id = id;
    titulos.push({ nivel: t.depth, texto, id });
  });
  return titulos;
}

/** Visita cada token, en profundidad y en orden de lectura. */
export function recorrer(tokens: Token[], visitar: (t: Token) => void): void {
  for (const t of tokens) {
    visitar(t);
    if (t.type === "list") recorrer((t as Tokens.List).items, visitar);
    if (t.type === "table") {
      const tabla = t as Tokens.Table;
      for (const celda of tabla.header) recorrer(celda.tokens, visitar);
      for (const fila of tabla.rows) for (const celda of fila) recorrer(celda.tokens, visitar);
    }
    if ("tokens" in t && Array.isArray(t.tokens)) recorrer(t.tokens, visitar);
  }
}

/** Capítulo: `NN-slug.md`. */
const ARCHIVO_CAPITULO = /^(\d{2})-([a-z0-9-]+)\.md$/;

/** El número y el slug de un archivo de capítulo, o `null` si no lo es. */
export function datosArchivo(archivo: string): { numero: number; slug: string } | null {
  const m = ARCHIVO_CAPITULO.exec(archivo);
  return m?.[1] && m[2] ? { numero: Number(m[1]), slug: m[2] } : null;
}

export type Enlace =
  | { tipo: "interno"; href: string; archivo: string; ancla: string | null }
  | { tipo: "ancla"; href: string; ancla: string }
  | { tipo: "externo"; href: string }
  | { tipo: "invalido"; href: string };

/**
 * Traduce un enlace del Markdown a la aplicación:
 * `03-poligonal.md#ajustar` → `/manual/poligonal#ajustar`, `README.md` →
 * `/manual`, `#x` se queda y `https://…` es externo. Cualquier otra cosa es
 * inválida y la rechazan las pruebas.
 */
export function resolverEnlace(href: string): Enlace {
  if (/^https:\/\//.test(href)) return { tipo: "externo", href };
  if (href.startsWith("#")) return { tipo: "ancla", href, ancla: href.slice(1) };
  const [archivo, ancla = null] = href.split("#") as [string, string?];
  if (archivo === "README.md") {
    return { tipo: "interno", href: ancla ? `/manual#${ancla}` : "/manual", archivo, ancla };
  }
  const datos = datosArchivo(archivo);
  if (!datos) return { tipo: "invalido", href };
  const destino = `/manual/${datos.slug}`;
  return { tipo: "interno", href: ancla ? `${destino}#${ancla}` : destino, archivo, ancla };
}

/** Una captura: `../../public/manual/<capitulo>/<archivo>.png`. */
const RUTA_CAPTURA = /^\.\.\/\.\.\/public\/manual\/([a-z0-9-]+)\/([a-z0-9-]+\.png)$/;

/**
 * La ruta pública y la clave del manifiesto de una captura, o `null` si la
 * ruta no sigue la forma de las capturas del manual.
 */
export function resolverCaptura(
  src: string,
): { publica: string; clave: string; carpeta: string } | null {
  const m = RUTA_CAPTURA.exec(src);
  if (!m?.[1] || !m[2]) return null;
  return { publica: `/manual/${m[1]}/${m[2]}`, clave: `${m[1]}/${m[2]}`, carpeta: m[1] };
}

/** ¿El párrafo es solo una imagen (con espacios alrededor)? */
export function imagenSola(t: Token): Tokens.Image | null {
  if (t.type !== "paragraph" && t.type !== "text") return null;
  const hijos = ((t as Tokens.Paragraph).tokens ?? []).filter(
    (h) => !(h.type === "text" && h.text.trim() === ""),
  );
  const [unico] = hijos;
  return hijos.length === 1 && unico?.type === "image" ? (unico as Tokens.Image) : null;
}
