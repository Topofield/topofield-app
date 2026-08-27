// Regenera las capturas del manual de usuario en `public/manual/`.
//
// Una sola copia: la sirve la página /manual de la aplicación, y el manual en
// Markdown (README.md, hermano de este archivo) la referencia con una ruta
// relativa. Antes se escribían dos copias, una aquí y otra en public/, y cada
// regeneración añadía 2,8 MB al historial de git por duplicado.
//
// Uso:
//   1. Levanta el entorno:  npx supabase start && npm run dev
//   2. Siembra los datos:   npm run seed
//   3. Ejecuta:             node docs/manual/capturas.mjs
//
// Los IDs de proyecto y proceso cambian con cada `supabase db reset`, así que
// el script los consulta en la base en vez de fijarlos.

import { chromium } from "playwright";
import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const AQUI = dirname(fileURLToPath(import.meta.url));
const OUT = join(AQUI, "..", "..", "public", "manual");
// Puerto del dev server. Next usa 3001 si el 3000 está ocupado; ajústalo con
// `PORT=3001 node docs/manual/capturas.mjs` si hace falta.
const BASE = `http://localhost:${process.env.PORT ?? 3000}`;
// Puerto de la base local (config.toml → [db].port). Overridable con
// SUPABASE_DB_PORT por si se vuelve a cambiar el esquema de puertos.
const DB_PORT = process.env.SUPABASE_DB_PORT ?? "55322";
const CREDENCIALES = { email: "seed@topofield.local", password: "seed1234" };

/** Consulta un único valor en la base local. */
function sql(query) {
  return execFileSync(
    "psql",
    ["-h", "127.0.0.1", "-p", DB_PORT, "-U", "postgres", "-d", "postgres", "-tAc", query],
    { env: { ...process.env, PGPASSWORD: "postgres" }, encoding: "utf8" },
  ).trim();
}

mkdirSync(OUT, { recursive: true });

const proyecto = sql("select id from public.projects where name='Lote catastral' limit 1;");
const calculado = sql("select id from public.polygonal_processes where name like 'Cuadrado con error%';");
const cerrado = sql("select id from public.polygonal_processes where status='closed';");
const rechazado = sql("select id from public.polygonal_processes where status='rejected';");
const nivelacion = sql("select id from public.leveling_processes where name like 'Circuito BM-1%';");
const proyectoMonitoreo = sql("select id from public.projects where name='Edificio en monitoreo' limit 1;");
const lugarMonitoreo = sql("select id from public.sites where name='Edificio Torre Central' limit 1;");
const visitaCalculada = sql(
  "select id from public.settlement_visits where site_id=(select id from public.sites where name='Edificio Torre Central') and visit_number=1;",
);

if (
  !proyecto ||
  !calculado ||
  !cerrado ||
  !rechazado ||
  !nivelacion ||
  !proyectoMonitoreo ||
  !lugarMonitoreo ||
  !visitaCalculada
) {
  throw new Error("Faltan datos de seed. Corré: npm run seed");
}

const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 1280, height: 800 },
  deviceScaleFactor: 2,
});

async function capturar(nombre, opciones = {}) {
  await page.waitForTimeout(900);
  await page.screenshot({ path: join(OUT, `${nombre}.png`), ...opciones });
  console.log("✓", nombre);
}

// Sesión
await page.goto(`${BASE}/sign-in`, { waitUntil: "networkidle" });
await capturar("01-inicio-sesion");
await page.fill('input[type="email"]', CREDENCIALES.email);
await page.fill('input[type="password"]', CREDENCIALES.password);
await page.click('button[type="submit"]');
await page.waitForURL(/dashboard/, { timeout: 20000 }).catch(() => {});
await page.waitForTimeout(1200);
await page.reload({ waitUntil: "networkidle" });
await capturar("02-dashboard");

// Proyectos
await page.goto(`${BASE}/projects/new`, { waitUntil: "networkidle" });
await capturar("03-nuevo-proyecto");
await page.goto(`${BASE}/projects/${proyecto}`, { waitUntil: "networkidle" });
await capturar("04-hub-proyecto", { fullPage: true });
await page.goto(`${BASE}/projects/${proyecto}?tab=config`, { waitUntil: "networkidle" });
await capturar("05-configuracion-proyecto", { fullPage: true });

// Poligonales
await page.goto(`${BASE}/projects/${proyecto}/polygonal/new`, { waitUntil: "networkidle" });
await capturar("06-nueva-poligonal");
await page.goto(`${BASE}/projects/${proyecto}/polygonal/${calculado}`, { waitUntil: "networkidle" });
await capturar("07-editor-no-cumple", { fullPage: true });

const veredicto = page.locator('[aria-label="Veredicto de cierre"]');
if (await veredicto.count()) {
  await veredicto.screenshot({ path: join(OUT, "08-veredicto.png") });
  console.log("✓ 08-veredicto");
}

await page.goto(`${BASE}/projects/${proyecto}/polygonal/${cerrado}`, { waitUntil: "networkidle" });
await capturar("09-proceso-cerrado", { fullPage: true });
await page.goto(`${BASE}/projects/${proyecto}/polygonal/${rechazado}`, { waitUntil: "networkidle" });
await capturar("10-proceso-rechazado", { fullPage: true });

// Nivelación
await page.goto(`${BASE}/projects/${proyecto}/leveling/new`, { waitUntil: "networkidle" });
await capturar("11-nueva-nivelacion");
await page.goto(`${BASE}/projects/${proyecto}/leveling/${nivelacion}`, { waitUntil: "networkidle" });
await capturar("12-editor-nivelacion", { fullPage: true });

// Control de asentamientos
await page.goto(`${BASE}/projects/${proyectoMonitoreo}/sites/new`, { waitUntil: "networkidle" });
await capturar("13-nuevo-lugar");
await page.goto(`${BASE}/projects/${proyectoMonitoreo}/sites/${lugarMonitoreo}`, { waitUntil: "networkidle" });
await capturar("14-editor-lugar", { fullPage: true });
await page.goto(`${BASE}/projects/${proyectoMonitoreo}/settlement/${lugarMonitoreo}`, { waitUntil: "networkidle" });
await capturar("15-panel-asentamientos", { fullPage: true });
await page.goto(
  `${BASE}/projects/${proyectoMonitoreo}/settlement/${lugarMonitoreo}/visits/${visitaCalculada}`,
  { waitUntil: "networkidle" },
);
await capturar("16-editor-visita", { fullPage: true });

// Informes (fase 6). El alta y la ruta imprimible; el informe se crea aquí
// mismo si el seed no dejó ninguno, para que la captura no dependa del estado.
await page.goto(`${BASE}/projects/${proyecto}/reports/new`, { waitUntil: "networkidle" });
await capturar("18-nuevo-informe", { fullPage: true });

let informe = sql(
  `select id from public.reports where project_id='${proyecto}' order by generated_at desc limit 1;`,
);
if (!informe) {
  await page.getByLabel("Título").fill("Informe de cierre — etapa 1");
  const casillas = page.locator("fieldset input[type=checkbox]");
  const total = await casillas.count();
  for (let i = 0; i < total; i++) await casillas.nth(i).check();
  await page
    .locator("textarea")
    .first()
    .fill("Levantamiento conforme a las tolerancias de tercer orden.");
  await page.getByRole("button", { name: /generar informe/i }).click();
  await page.waitForURL(/\/reports\/[0-9a-f-]{36}$/, { timeout: 30000 });
  informe = page.url().split("/").pop();
}

await page.goto(`${BASE}/projects/${proyecto}/reports/${informe}/print`, {
  waitUntil: "networkidle",
});
await capturar("19-informe-imprimible", { fullPage: true });

// Campo
await page.setViewportSize({ width: 390, height: 844 });
await page.goto(`${BASE}/projects/${proyecto}/polygonal/${calculado}`, { waitUntil: "networkidle" });
await capturar("17-editor-movil", { fullPage: true });

await browser.close();
console.log(`\nCapturas actualizadas en ${OUT}`);
