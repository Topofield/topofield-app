/**
 * El manual de usuario leído de `docs/manual/` (Fase 42).
 *
 * `armarManual` es puro: recibe los archivos ya leídos. `leerManual` los lee
 * con `fs` en el servidor; en Vercel viajan con la función porque
 * `next.config.ts` los incluye en el tracing de `/manual`.
 */

import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { cache } from "react";
import {
  anotarTitulos,
  datosArchivo,
  lexear,
  textoPlano,
  type Titulo,
  type Token,
  type Tokens,
} from "./markdown";

export interface Capitulo {
  numero: number;
  slug: string;
  archivo: string;
  titulo: string;
  /** El primer párrafo: va bajo el título y en la tarjeta de la portada. */
  resumen: string;
  /** El cuerpo, sin el título ni el resumen. */
  tokens: Token[];
  /** Los flujos del capítulo (`##`): su índice. */
  secciones: Titulo[];
  /** Todos los títulos, para comprobar anclas. */
  titulos: Titulo[];
}

export interface Manual {
  titulo: string;
  /** La introducción del README: lo que va antes de su primer `##`. */
  intro: Token[];
  capitulos: Capitulo[];
  /** Ancho y alto en píxeles de cada captura, por `carpeta/archivo.png`. */
  capturas: Record<string, [number, number]>;
}

export interface ArchivoManual {
  nombre: string;
  contenido: string;
}

const sinEspacios = (tokens: Token[]) => tokens.filter((t) => t.type !== "space");

function capituloDe(archivo: ArchivoManual): Capitulo {
  const datos = datosArchivo(archivo.nombre);
  if (!datos) throw new Error(`${archivo.nombre} no es un capítulo`);
  const tokens = lexear(archivo.contenido);
  const titulos = anotarTitulos(tokens);
  const [h1, resumen, ...cuerpo] = sinEspacios(tokens);
  if (h1?.type !== "heading" || (h1 as Tokens.Heading).depth !== 1) {
    throw new Error(`${archivo.nombre} debe empezar con su título (#)`);
  }
  if (resumen?.type !== "paragraph") {
    throw new Error(`${archivo.nombre}: tras el título va el párrafo de resumen`);
  }
  return {
    ...datos,
    archivo: archivo.nombre,
    titulo: textoPlano((h1 as Tokens.Heading).tokens),
    resumen: textoPlano((resumen as Tokens.Paragraph).tokens),
    tokens: cuerpo,
    secciones: titulos.filter((t) => t.nivel === 2),
    titulos,
  };
}

/** Arma el manual con el README, los capítulos y el manifiesto de capturas. */
export function armarManual(archivos: ArchivoManual[], capturasJson: string): Manual {
  const readme = archivos.find((a) => a.nombre === "README.md");
  if (!readme) throw new Error("Falta docs/manual/README.md");
  const tokens = sinEspacios(lexear(readme.contenido));
  const [h1, ...resto] = tokens;
  if (h1?.type !== "heading" || (h1 as Tokens.Heading).depth !== 1) {
    throw new Error("README.md debe empezar con su título (#)");
  }
  const finIntro = resto.findIndex((t) => t.type === "heading" && (t as Tokens.Heading).depth <= 2);
  const capitulos = archivos
    .filter((a) => datosArchivo(a.nombre))
    .map(capituloDe)
    .sort((a, b) => a.numero - b.numero);
  return {
    titulo: textoPlano((h1 as Tokens.Heading).tokens),
    intro: finIntro === -1 ? resto : resto.slice(0, finIntro),
    capitulos,
    capturas: JSON.parse(capturasJson) as Manual["capturas"],
  };
}

/** El capítulo de `slug` y sus vecinos, o `null` si no existe. */
export function capituloConVecinos(manual: Manual, slug: string) {
  const i = manual.capitulos.findIndex((c) => c.slug === slug);
  const capitulo = manual.capitulos[i];
  if (!capitulo) return null;
  return {
    capitulo,
    anterior: manual.capitulos[i - 1] ?? null,
    siguiente: manual.capitulos[i + 1] ?? null,
  };
}

/** La carpeta del manual. Literal, para que el tracing no recorra el proyecto. */
export const CARPETA_MANUAL = join(process.cwd(), "docs", "manual");

async function leerDeDisco(): Promise<Manual> {
  const nombres = (await readdir(CARPETA_MANUAL)).filter((n) => n.endsWith(".md"));
  const archivos = await Promise.all(
    nombres.map(async (nombre) => ({
      nombre,
      contenido: await readFile(join(CARPETA_MANUAL, nombre), "utf8"),
    })),
  );
  const capturas = await readFile(join(CARPETA_MANUAL, "capturas.json"), "utf8");
  return armarManual(archivos, capturas);
}

// En producción el manual no cambia: se lee una vez por instancia. En
// desarrollo se relee en cada petición, para ver al recargar lo que se edita.
let enMemoria: Promise<Manual> | null = null;

/** El manual, leído una vez por petición (y por instancia, en producción). */
export const leerManual = cache((): Promise<Manual> => {
  if (process.env.NODE_ENV !== "production") return leerDeDisco();
  enMemoria ??= leerDeDisco().catch((error: unknown) => {
    enMemoria = null; // que el siguiente intento vuelva a leer
    throw error;
  });
  return enMemoria;
});
