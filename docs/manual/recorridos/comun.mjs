// Lo común de los recorridos del manual (Fase 42).
//
// Cada capítulo del manual tiene su recorrido: un script que hace el flujo en
// la aplicación real, como lo haría un usuario, y captura cada paso en
// `public/manual/<capitulo>/NN-<paso>.png`. `todos.mjs` los lanza en orden.
//
// Requisitos:
//   1. npx supabase start   (la base local; el correo lo recoge Mailpit)
//   2. npm run dev          (o PORT=3001 si el 3000 está ocupado)
//   3. npm run manual:capturas [capitulo…]
//
// La cuenta del recorrido es propia (`manual@topofield.local`): se borra y se
// vuelve a registrar por el formulario, así que su dashboard es el de un
// usuario nuevo —el proyecto de ejemplo y lo que el recorrido crea—. No toca
// la cuenta del seed.

import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync, existsSync, readdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { ESCALA_CAPTURAS, medidasPng } from "../../../src/lib/manual/png.ts";

const AQUI = dirname(fileURLToPath(import.meta.url));
export const RAIZ = join(AQUI, "..", "..", "..");
const PUBLICO = join(RAIZ, "public", "manual");
const MANIFIESTO = join(RAIZ, "docs", "manual", "capturas.json");

export const BASE = `http://localhost:${process.env.PORT ?? 3000}`;
const DB_PORT = process.env.SUPABASE_DB_PORT ?? "55322";
const MAILPIT = process.env.MAILPIT_URL ?? "http://127.0.0.1:55324";

export const CUENTA = {
  email: "manual@topofield.local",
  password: "manual1234",
  nombre: "Andrea",
  apellido: "Rojas",
};

/** Consulta un valor en la base local (psql). */
export function sql(query) {
  return execFileSync(
    "psql",
    ["-h", "127.0.0.1", "-p", DB_PORT, "-U", "postgres", "-d", "postgres", "-tAc", query],
    { env: { ...process.env, PGPASSWORD: "postgres" }, encoding: "utf8" },
  ).trim();
}

/** Como `sql`, pero falla con un mensaje claro si no hay resultado. */
export function idDe(descripcion, query) {
  const id = sql(query);
  if (!id) throw new Error(`No se encontró ${descripcion}. Consulta: ${query}`);
  return id.split("\n")[0];
}

/** El id del usuario del recorrido. */
export function usuario() {
  return idDe("la cuenta del recorrido", `select id from auth.users where email='${CUENTA.email}'`);
}

const espera = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Borra la cuenta del recorrido y lo suyo. `projects.user_id` no tiene
 * cascada, así que primero van sus proyectos.
 */
export async function borrarCuenta() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secreto = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secreto) throw new Error("Falta NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SECRET_KEY (.env.local)");
  const admin = createClient(url, secreto, { auth: { persistSession: false } });
  const { data } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const existente = data?.users.find((u) => u.email === CUENTA.email);
  if (!existente) return;
  sql(`delete from public.projects where user_id='${existente.id}'`);
  const { error } = await admin.auth.admin.deleteUser(existente.id);
  if (error) throw error;
}

/** El enlace de confirmación del último correo que recibió la cuenta. */
export async function enlaceDeConfirmacion() {
  for (let intento = 0; intento < 30; intento++) {
    const lista = await (await fetch(`${MAILPIT}/api/v1/search?query=to:${CUENTA.email}`)).json();
    const ultimo = lista.messages?.[0];
    if (ultimo) {
      const msg = await (await fetch(`${MAILPIT}/api/v1/message/${ultimo.ID}`)).json();
      const enlace = /https?:\/\/[^\s"<>]+verify[^\s"<>]*/.exec(msg.Text ?? msg.HTML ?? "")?.[0];
      if (enlace) return enlace.replace(/&amp;/g, "&");
    }
    await espera(500);
  }
  throw new Error("No llegó el correo de confirmación a Mailpit");
}

/** Vacía el buzón de la cuenta, para no confundir un correo viejo con el nuevo. */
export async function vaciarBuzon() {
  await fetch(`${MAILPIT}/api/v1/search?query=to:${CUENTA.email}`, { method: "DELETE" });
}

const CSS_CAPTURA =
  // El indicador de desarrollo de Next y el correo real no van en el manual.
  "nextjs-portal{display:none!important}[data-user-email]{visibility:hidden!important}" +
  // En una captura de página completa, `sticky` se pinta a media página.
  ".sticky.bottom-0{position:static!important}";

/**
 * Abre el navegador. `movil` da un teléfono de 390 px; si no, una pantalla de
 * 1280 × 800. Las dos a `ESCALA_CAPTURAS` píxeles por píxel.
 */
export async function abrir({ movil = false } = {}) {
  const browser = await chromium.launch({ channel: "chromium", args: ["--lang=es-CO"], env: { ...process.env, LANG: "es_CO.UTF-8", LANGUAGE: "es_CO:es" } });
  // El idioma y la zona del usuario: el botón del archivo dice «Seleccionar
  // archivo» y las fechas salen en Bogotá.
  const lugar = { locale: "es-CO", timezoneId: "America/Bogota" };
  const context = await browser.newContext(
    movil
      ? { ...lugar, viewport: { width: 390, height: 844 }, deviceScaleFactor: ESCALA_CAPTURAS, isMobile: true, hasTouch: true }
      : { ...lugar, viewport: { width: 1280, height: 800 }, deviceScaleFactor: ESCALA_CAPTURAS },
  );
  context.setDefaultTimeout(30_000);
  await context.addInitScript((css) => {
    document.addEventListener("DOMContentLoaded", () => {
      const estilo = document.createElement("style");
      estilo.textContent = css;
      document.head.appendChild(estilo);
    });
  }, CSS_CAPTURA);
  const page = await context.newPage();
  return { browser, context, page };
}

/** Navega y espera a que la página esté quieta e hidratada. */
export async function ir(page, ruta) {
  await page.goto(`${BASE}${ruta}`, { waitUntil: "networkidle", timeout: 120_000 });
  await page.waitForTimeout(1000);
}

/** Entra con la cuenta del recorrido y espera al dashboard. */
export async function entrar(page) {
  await ir(page, "/sign-in");
  await page.getByLabel("Correo").fill(CUENTA.email);
  await page.getByLabel("Contraseña").fill(CUENTA.password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL(/dashboard/, { timeout: 120_000 });
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(800);
}

/**
 * Las capturas de un capítulo. `paso(nombre, objetivo?)` escribe
 * `NN-nombre.png` con el número siguiente y anota su tamaño en el manifiesto.
 * El objetivo puede ser la página (por defecto, solo lo visible), un locator
 * (recorta a ese elemento) o `{ completa: true }` (la página entera).
 */
export function capitulo(slug, page) {
  const carpeta = join(PUBLICO, slug);
  if (existsSync(carpeta)) rmSync(carpeta, { recursive: true });
  mkdirSync(carpeta, { recursive: true });
  let n = 0;
  const tomadas = [];
  return {
    tomadas,
    async paso(nombre, objetivo) {
      n += 1;
      const archivo = `${String(n).padStart(2, "0")}-${nombre}.png`;
      const ruta = join(carpeta, archivo);
      await page.waitForTimeout(500);
      if (objetivo && typeof objetivo.screenshot === "function") {
        await objetivo.screenshot({ path: ruta, animations: "disabled" });
      } else {
        // La barra es fija: en una captura de página completa se pinta donde
        // estaba la ventana. Arriba del todo, queda en su sitio.
        if (objetivo?.completa) {
          await page.evaluate(() => window.scrollTo(0, 0));
          await page.waitForTimeout(300);
        }
        await page.screenshot({ path: ruta, animations: "disabled", fullPage: Boolean(objetivo?.completa) });
      }
      tomadas.push(`${slug}/${archivo}`);
      console.log(`  ✓ ${slug}/${archivo}`);
      return archivo;
    },
  };
}

/** Reescribe el manifiesto con el tamaño real de cada PNG de `public/manual/`. */
export function escribirManifiesto() {
  const manifiesto = {};
  for (const carpeta of readdirSync(PUBLICO, { withFileTypes: true })) {
    if (!carpeta.isDirectory()) continue;
    for (const archivo of readdirSync(join(PUBLICO, carpeta.name)).sort()) {
      if (!archivo.endsWith(".png")) continue;
      const { ancho, alto } = medidasPng(readFileSync(join(PUBLICO, carpeta.name, archivo)));
      manifiesto[`${carpeta.name}/${archivo}`] = [ancho, alto];
    }
  }
  const ordenado = Object.fromEntries(Object.entries(manifiesto).sort(([a], [b]) => a.localeCompare(b)));
  writeFileSync(MANIFIESTO, JSON.stringify(ordenado, null, 2) + "\n");
  console.log(`✓ docs/manual/capturas.json (${Object.keys(ordenado).length} capturas)`);
}

/** Un diálogo por su título. */
export function dialogo(page, nombre) {
  return page.getByRole("dialog", { name: nombre });
}

/** Un Modal alto entero: agranda la ventana mientras dura `fn`. */
export async function conAlto(page, alto, fn) {
  const antes = page.viewportSize();
  await page.setViewportSize({ width: antes.width, height: alto });
  try {
    return await fn();
  } finally {
    await page.setViewportSize(antes);
  }
}

/**
 * Pulsa hasta que aparezca `efecto`. En desarrollo, un clic que llega antes
 * de que React hidrate la página no hace nada.
 */
export async function pulsarHasta(boton, efecto, intentos = 6) {
  for (let i = 0; i < intentos; i++) {
    await boton.click();
    try {
      await efecto.waitFor({ state: "visible", timeout: 5000 });
      return;
    } catch {
      // otra vez
    }
  }
  throw new Error(`El clic no surtió efecto tras ${intentos} intentos`);
}
