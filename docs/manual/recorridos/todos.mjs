// Lanza los recorridos del manual en orden y reescribe el manifiesto de
// capturas (Fase 42). Ver `comun.mjs`.
//
//   npm run manual:capturas                  todos
//   npm run manual:capturas poligonal        solo uno (la cuenta ya debe existir:
//                                            la crea «primeros-pasos»)

import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { escribirManifiesto } from "./comun.mjs";

const AQUI = dirname(fileURLToPath(import.meta.url));

const ORDEN = [
  "primeros-pasos",
  "proyectos",
  "poligonal",
  "nivelacion",
  "asentamientos",
  "informe-y-excel",
  "equipos",
  "en-campo",
];

const pedidos = process.argv.slice(2);
const desconocidos = pedidos.filter((p) => !ORDEN.includes(p));
if (desconocidos.length) {
  throw new Error(`Capítulos desconocidos: ${desconocidos.join(", ")}. Son: ${ORDEN.join(", ")}`);
}

for (const slug of pedidos.length ? ORDEN.filter((s) => pedidos.includes(s)) : ORDEN) {
  const archivo = join(AQUI, `${slug}.mjs`);
  if (!existsSync(archivo)) continue;
  console.log(`\n▸ ${slug}`);
  const { recorrer } = await import(archivo);
  await recorrer();
}

escribirManifiesto();
