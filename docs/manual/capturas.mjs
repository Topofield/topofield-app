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
// La cuenta del seed local (la misma de producción, con la contraseña local).
const CREDENCIALES = { email: "topofieldsarf@gmail.com", password: "seed1234" };

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
// Filtradas por proyecto: la aplicación crea el «Proyecto de ejemplo» la
// primera vez que el usuario del seed inicia sesión, con sus propias
// poligonales, y sin filtro la consulta devolvía dos ids y la URL salía rota.
// Sin proyecto (base sin sembrar) no se consulta: `project_id=''` haría fallar
// psql antes de que la guarda de abajo explique que falta el seed.
// Fase 35: la cartera TT4 compensada por Brújula es la poligonal del manual.
const tt4 = proyecto
  ? sql(`select id from public.polygonal_processes where name like 'Poligonal V10%bowditch' and project_id='${proyecto}';`)
  : "";
const nivelacion = sql("select id from public.leveling_processes where name like 'Circuito BM-1%';");
// Fase 36 — El Verjón, del «Proyecto de ejemplo»: ida y vuelta por los mismos
// puntos, para la libreta, la armada y la compensación.
const verjon = sql("select id from public.leveling_processes where name like 'El Verjón%' limit 1;");
const proyectoVerjon = verjon
  ? sql(`select project_id from public.leveling_processes where id='${verjon}';`)
  : "";
const proyectoMonitoreo = sql("select id from public.projects where name='Edificio en monitoreo' limit 1;");
const lugarMonitoreo = sql("select id from public.sites where name='Edificio Torre Central' limit 1;");
// Fase 37 — Torre Alameda del seed (la demo tiene otra con el mismo nombre):
// su visita 12, de dos armadas por CP-1, con BM-2 leído de paso.
const lugarLibreta = proyectoMonitoreo
  ? sql(`select id from public.sites where name='Torre Alameda' and project_id='${proyectoMonitoreo}' limit 1;`)
  : "";
const visitaLibreta = lugarLibreta
  ? sql(`select id from public.settlement_visits where site_id='${lugarLibreta}' and visit_number=12;`)
  : "";
// La cartera real (Fase 37), en el «Proyecto de ejemplo»: su visita 7.
const cartera = sql(
  "select project_id || ' ' || id from public.sites where name='Control de asentamiento estructural' limit 1;",
);
const [proyectoCartera = "", lugarCartera = ""] = cartera.split(" ");
const visitaCartera = lugarCartera
  ? sql(`select id from public.settlement_visits where site_id='${lugarCartera}' and visit_number=7;`)
  : "";

if (
  !proyecto ||
  !tt4 ||
  !nivelacion ||
  !verjon ||
  !proyectoMonitoreo ||
  !lugarMonitoreo ||
  !lugarLibreta ||
  !visitaLibreta ||
  !visitaCartera
) {
  throw new Error(
    "Faltan datos de seed. Corré: npm run seed, inicia sesión una vez (crea el «Proyecto de ejemplo») y, si es una demo vieja, scripts/agregar-cartera-demo.mjs --aplicar",
  );
}

/**
 * La libreta de una visita en la plantilla CSV de TopoField (Fase 16), para
 * capturar el diálogo de importación sin depender de un archivo en disco.
 */
function libretaCsv(visitId) {
  const tipos = { bm: "bm", pc: "pc", intermediate: "radiacion" };
  // `coalesce`: `concat_ws` salta los nulos, y una lectura vacía correría las
  // columnas.
  const vacio = (col) => `coalesce(${col}::text, '')`;
  const columnas = ["backsight", "foresight", "back_distance_m", "fore_distance_m"].map(vacio);
  const filas = sql(
    `select string_agg(concat_ws(',', 'ida', point_code, point_type, ${columnas.join(", ")}), E'\\n' order by reading_order) from public.settlement_book_readings where visit_id='${visitId}';`,
  );
  const cuerpo = filas
    .split("\n")
    .map((linea) => {
      const [recorrido, punto, tipo, ...resto] = linea.split(",");
      return [recorrido, punto, tipos[tipo] ?? "", ...resto].join(",");
    })
    .join("\n");
  return `recorrido,punto,tipo,v_mas,v_menos,dist_mas,dist_menos\n${cuerpo}\n`;
}

const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 1280, height: 800 },
  deviceScaleFactor: 2,
});
// Oculta el indicador de desarrollo de Next («1 Issue»), que no es de la app.
await page.addInitScript(() => {
  document.addEventListener("DOMContentLoaded", () => {
    const estilo = document.createElement("style");
    // El correo del menú de cuenta es el real: no va en las capturas,
    // que se publican en el repositorio y en /manual.
    // La barra de acciones fija (Fase 22) va estática: en una captura de
    // página completa, `sticky` la pintaba a media página.
    estilo.textContent =
      "nextjs-portal{display:none!important}[data-user-email]{visibility:hidden!important}" +
      ".sticky.bottom-0{position:static!important}";
    document.head.appendChild(estilo);
  });
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
await capturar("03-nuevo-proyecto", { fullPage: true });
await page.goto(`${BASE}/projects/${proyecto}`, { waitUntil: "networkidle" });
await capturar("04-hub-proyecto", { fullPage: true });
await page.goto(`${BASE}/projects/${proyecto}?tab=config`, { waitUntil: "networkidle" });
await capturar("05-configuracion-proyecto", { fullPage: true });

// Poligonales (Fase 35): el alta en un popup y la pantalla por pasos.
await page.goto(`${BASE}/projects/${proyecto}`, { waitUntil: "networkidle" });
await page.getByRole("button", { name: "+ Nuevo Proceso" }).click();
await page.getByRole("dialog").getByRole("button", { name: "Poligonal", exact: true }).click();
const alta = page.getByRole("dialog", { name: "Nueva poligonal" });
await alta.getByLabel("Título").fill("Poligonal V10 — cartera TT4");
await alta.getByLabel("Ubicación").fill("Sede Vivero, Bogotá");
await alta.getByLabel("Responsable", { exact: true }).fill("Andrea Rojas");
await alta.getByLabel("Cargo del responsable").fill("Topógrafa");
await page.waitForTimeout(400);
await alta.screenshot({ path: join(OUT, "06-nueva-poligonal.png") });
console.log("✓", "06-nueva-poligonal");
await page.keyboard.press("Escape");

// Paso 1 · Datos: amarre, mediciones «desde → hacia», cierre angular y dibujo.
const pasos = `${BASE}/projects/${proyecto}/polygonal/${tt4}`;
await page.goto(`${pasos}?tab=datos`, { waitUntil: "networkidle" });
await capturar("07-datos-poligonal", { fullPage: true });

// Paso 2 · Ajuste: el método, el orden alcanzado con su «Por qué», la tabla al
// estilo de la hoja y el dibujo ajustado.
await page.goto(`${pasos}?tab=ajuste`, { waitUntil: "networkidle" });
await page.getByText("Por qué tercer orden").click();
await page.waitForTimeout(400);
await page
  .getByRole("group", { name: "Método de ajuste" })
  .locator("xpath=ancestor::section[1]")
  .screenshot({ path: join(OUT, "08-orden-alcanzado.png") });
console.log("✓", "08-orden-alcanzado");
await page.getByText("Por qué tercer orden").click();
await capturar("09-ajuste-poligonal", { fullPage: true });

// El dibujo ajustado de la cartera TT4: su error de 1.6 cm, exagerado ×100.
await page.locator("figure").first().screenshot({ path: join(OUT, "20-dibujo-poligonal.png") });
console.log("✓", "20-dibujo-poligonal");

// Paso 3 · Informe: la sección «Corrección por método», recortada de su título
// al de la poligonal ajustada.
await page.goto(`${pasos}?tab=informe`, { waitUntil: "networkidle" });
await page.waitForTimeout(900);
const desde = await page.getByRole("heading", { name: /^3\. Corrección por método/ }).boundingBox();
const hasta = await page.getByRole("heading", { name: "4. Poligonal ajustada" }).boundingBox();
const hoja = await page.locator(".report").first().boundingBox();
await page.screenshot({
  path: join(OUT, "10-correccion-informe.png"),
  fullPage: true,
  clip: {
    x: hoja.x,
    y: desde.y - 12,
    width: hoja.width,
    height: Math.ceil(hasta.y - desde.y),
  },
});
console.log("✓", "10-correccion-informe");
await capturar("30-informe-del-proceso", { fullPage: true });

// Fase 14 — la cartera Vivero con mínimos cuadrados y los pesos de la hoja:
// la corrección por método, con las correcciones y σ₀.
const vivero = sql(
  `select id from public.polygonal_processes where name like '%Vivero%least_squares' and project_id='${proyecto}';`,
);
await page.goto(`${BASE}/projects/${proyecto}/polygonal/${vivero}?tab=ajuste`, { waitUntil: "networkidle" });
await page.waitForTimeout(600);
await page
  .getByRole("heading", { name: "Corrección por método Mínimos cuadrados" })
  .locator("xpath=ancestor::section[1]")
  .screenshot({ path: join(OUT, "21-minimos-cuadrados.png") });
console.log("✓", "21-minimos-cuadrados");

// Fase 39 — la precisión de cada punto de la misma Vivero, y su dibujo con las
// elipses de error al 95 %.
await page
  .getByRole("heading", { name: "Precisión de cada punto" })
  .locator("xpath=ancestor::section[1]")
  .screenshot({ path: join(OUT, "36-precision-de-cada-punto.png") });
console.log("✓", "36-precision-de-cada-punto");
await page
  .locator("figure")
  .filter({ has: page.locator("svg[role=img] ellipse") })
  .first()
  .screenshot({ path: join(OUT, "37-elipses-de-error.png") });
console.log("✓", "37-elipses-de-error");

// Fase 15 — georreferenciar la cartera Vivero sembrada en sistema local, con
// D1 y D3, desde el paso de Ajuste. Se captura el diálogo con la vista previa,
// sin confirmar: el seed queda como estaba.
const viveroLocal = sql(
  `select id from public.polygonal_processes where name like '%Vivero%sistema local' and project_id='${proyecto}';`,
);
// Más alto que el resto: el diálogo desplaza, y así cabe la vista previa.
await page.setViewportSize({ width: 1280, height: 1400 });
await page.goto(`${BASE}/projects/${proyecto}/polygonal/${viveroLocal}?tab=ajuste`, { waitUntil: "networkidle" });
await page.getByRole("button", { name: "Georreferenciar" }).click();
const dialogo = page.getByRole("dialog");
const puntos = dialogo.locator("fieldset");
await puntos.nth(0).getByLabel("Estación").selectOption({ label: "D1" });
await puntos.nth(0).getByLabel("Norte real").fill("100117.462");
await puntos.nth(0).getByLabel("Este real").fill("101515.6333");
await puntos.nth(1).getByLabel("Estación").selectOption({ label: "D3" });
await puntos.nth(1).getByLabel("Norte real").fill("100182.239");
await puntos.nth(1).getByLabel("Este real").fill("101581.7814");
await page.waitForTimeout(500);
await dialogo.screenshot({ path: join(OUT, "22-georreferenciar.png") });
console.log("✓", "22-georreferenciar");
await page.keyboard.press("Escape");
await page.setViewportSize({ width: 1280, height: 800 });

// Nivelación (Fase 36): el alta en un popup y la pantalla por pasos.
await page.goto(`${BASE}/projects/${proyecto}`, { waitUntil: "networkidle" });
await page.getByRole("button", { name: "+ Nuevo Proceso" }).click();
await page.getByRole("dialog").getByRole("button", { name: "Nivelación", exact: true }).click();
const altaNivelacion = page.getByRole("dialog", { name: "Nueva nivelación" });
await altaNivelacion.getByLabel("Título").fill("El Verjón — ida y vuelta");
await altaNivelacion.getByText("Abierta", { exact: true }).click();
await altaNivelacion.getByText("por los mismos puntos").click();
await altaNivelacion.getByLabel("BM de partida").fill("D1");
await altaNivelacion.getByLabel("Cota conocida (m)").fill("3288.5000");
await page.waitForTimeout(400);
await altaNivelacion.screenshot({ path: join(OUT, "11-nueva-nivelacion.png") });
console.log("✓", "11-nueva-nivelacion");
await page.keyboard.press("Escape");

// Paso 1 · Libreta de El Verjón: el BM, la tabla de la hoja, la comprobación
// aritmética y el perfil con las miras, con la vuelta tenue.
const pasosNivelacion = `${BASE}/projects/${proyectoVerjon}/leveling/${verjon}`;
await page.goto(`${pasosNivelacion}?tab=libreta`, { waitUntil: "networkidle" });
await capturar("12-libreta-nivelacion", { fullPage: true });

// El popup de la armada 2 de la ida, sin guardar. Alto para que quepa entero.
await page.setViewportSize({ width: 1280, height: 1400 });
await page.getByRole("button", { name: "Editar la armada 2" }).first().click();
await page.waitForTimeout(500);
await page.getByRole("dialog", { name: "Armada 2 · ida" }).screenshot({ path: join(OUT, "32-armada-nivelacion.png") });
console.log("✓", "32-armada-nivelacion");
await page.keyboard.press("Escape");
await page.setViewportSize({ width: 1280, height: 800 });

// Paso 2 · Compensación: el orden alcanzado con su «Por qué», la tabla de la
// ida y la vuelta y el gráfico ×1000.
await page.goto(`${pasosNivelacion}?tab=compensacion`, { waitUntil: "networkidle" });
await page.getByText("Por qué segundo orden").click();
await capturar("33-compensacion-nivelacion", { fullPage: true });

// Fase 16 — importar el crudo de nivel digital en la libreta del Circuito
// BM-1. Se captura el diálogo con la previsualización, sin aceptar: aceptar
// guarda la libreta (Fase 36).
await page.goto(`${BASE}/projects/${proyecto}/leveling/${nivelacion}?tab=libreta`, { waitUntil: "networkidle" });
await page.setViewportSize({ width: 1280, height: 1400 });
await page.getByRole("button", { name: "Importar .L o CSV" }).first().click();
const importar = page.getByRole("dialog");
await importar.locator('input[type="file"]').setInputFiles(join(AQUI, "..", "carteras", "CRDUDO-TRAMO2.L"));
await page.waitForTimeout(600);
await importar.screenshot({ path: join(OUT, "23-importar-nivelacion.png") });
console.log("✓", "23-importar-nivelacion");
await page.keyboard.press("Escape");
await page.setViewportSize({ width: 1280, height: 800 });

// Control de asentamientos (Fase 37): el alta del lugar en popup, desde el
// selector de procesos del proyecto.
await page.goto(`${BASE}/projects/${proyectoMonitoreo}?tab=processes&modulo=asentamientos`, { waitUntil: "networkidle" });
await page.getByRole("button", { name: "+ Nuevo Proceso" }).click();
await page.getByRole("dialog").getByRole("button", { name: "Control de Asentamientos" }).click();
await page.waitForTimeout(500);
await page.getByRole("dialog", { name: "Nuevo lugar" }).screenshot({ path: join(OUT, "13-nuevo-lugar.png") });
console.log("✓", "13-nuevo-lugar");
await page.keyboard.press("Escape");

// La pestaña Puntos de Torre Central: un punto de alta y uno de baja.
await page.goto(`${BASE}/projects/${proyectoMonitoreo}/settlement/${lugarMonitoreo}?tab=puntos`, { waitUntil: "networkidle" });
await capturar("14-editor-lugar", { fullPage: true });

// El panel de la cartera real: la tabla de visitas, la tendencia y los avisos
// de B10.
const panelCartera = `${BASE}/projects/${proyectoCartera}/settlement/${lugarCartera}`;
await page.goto(panelCartera, { waitUntil: "networkidle" });
await capturar("15-panel-asentamientos", { fullPage: true });

// Los resultados de la visita 7 de la cartera.
await page.goto(`${panelCartera}/visits/${visitaCartera}?tab=resultados`, { waitUntil: "networkidle" });
await capturar("27-vista-visita", { fullPage: true });

// Torre Alameda: sus BM del lugar, la nueva visita, la libreta de la visita
// 12 y su segunda armada, que cierra en BM-1.
const panelLibreta = `${BASE}/projects/${proyectoMonitoreo}/settlement/${lugarLibreta}`;
await page.goto(`${panelLibreta}?tab=bms`, { waitUntil: "networkidle" });
await capturar("35-bms-lugar", { fullPage: true });

// El popup de nueva visita, sin crearla. Alto para que quepa entero.
await page.goto(panelLibreta, { waitUntil: "networkidle" });
await page.setViewportSize({ width: 1280, height: 1400 });
await page.getByRole("button", { name: "+ Nueva visita" }).click();
await page.waitForTimeout(500);
await page.getByRole("dialog", { name: "Nueva visita" }).screenshot({ path: join(OUT, "25-nueva-visita.png") });
console.log("✓", "25-nueva-visita");
await page.keyboard.press("Escape");
await page.setViewportSize({ width: 1280, height: 800 });

const vistaLibreta = `${panelLibreta}/visits/${visitaLibreta}`;
await page.goto(vistaLibreta, { waitUntil: "networkidle" });
await capturar("16-editor-visita", { fullPage: true });

// La armada 2, tal como quedó: sin tocar nada, «Seguir después» no guarda.
await page.setViewportSize({ width: 1280, height: 1500 });
await page.getByRole("button", { name: "Editar la armada 2" }).first().click();
await page.waitForTimeout(600);
await page.getByRole("dialog", { name: /Armada 2/ }).screenshot({ path: join(OUT, "34-armada-visita.png") });
console.log("✓", "34-armada-visita");
await page.getByRole("dialog", { name: /Armada 2/ }).getByRole("button", { name: "Seguir después" }).click();
await page.waitForTimeout(600);

// El diálogo de importación con la misma libreta pasada a la plantilla CSV.
// Sin aceptar: el seed queda como estaba.
await page.getByRole("button", { name: "Importar .L o CSV" }).click();
const importarVisita = page.getByRole("dialog", { name: "Importar la libreta de la visita" });
await importarVisita.locator('input[type="file"]').setInputFiles({
  name: "libreta-visita.csv",
  mimeType: "text/csv",
  buffer: Buffer.from(libretaCsv(visitaLibreta), "utf8"),
});
await page.waitForTimeout(600);
await importarVisita.screenshot({ path: join(OUT, "26-importar-libreta-visita.png") });
console.log("✓", "26-importar-libreta-visita");
await page.keyboard.press("Escape");
await page.setViewportSize({ width: 1280, height: 800 });

// El catálogo de equipos (Fase 25): los del seed y la demo, dos con el aviso
// de calibración de más de un año.
await page.goto(`${BASE}/equipos`, { waitUntil: "networkidle" });
await capturar("31-equipos", { fullPage: true });

// Campo
await page.setViewportSize({ width: 390, height: 844 });
await page.goto(`${BASE}/projects/${proyecto}/polygonal/${tt4}?tab=datos`, { waitUntil: "networkidle" });
await capturar("17-datos-movil", { fullPage: true });

// Tema oscuro (Fase 20): el panel de Torre Alameda en el teléfono, con el tema
// forzado por la cookie del selector, como si el usuario lo hubiera elegido.
// Con el menú de cuenta abierto (Fase 33), que es donde se elige; el correo
// sigue oculto por el estilo de arriba.
await page.context().addCookies([{ name: "topofield-theme", value: "dark", url: BASE }]);
await page.goto(panelLibreta, { waitUntil: "networkidle" });
await page.getByRole("button", { name: "Cuenta" }).click();
await capturar("29-tema-oscuro");
await page.keyboard.press("Escape");
await page.context().clearCookies({ name: "topofield-theme" });

await browser.close();
console.log(`\nCapturas actualizadas en ${OUT}`);
