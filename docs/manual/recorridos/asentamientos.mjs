// Capítulo 5 · Control de asentamientos:
//   - la cartera real «Control de asentamiento estructural»
//     (`docs/carteras/Control_asentamiento_estructural_ REAL.xlsx`) desde cero:
//     el lugar, sus 16 puntos, su BM y sus siete visitas, cada lectura tecleada
//     en la armada; la visita 2 con el aviso de B10; el panel y el informe;
//   - de la demo, Torre Alameda: una visita de dos armadas por un punto de
//     cambio, la del BM desplazado y la importación de la plantilla CSV.

import { CARTERA_ASENTAMIENTOS as C } from "../../../src/lib/demo/cartera-asentamientos.ts";
import { abrir, capitulo, conAlto, dialogo, entrar, idDe, ir, pulsarHasta, sql, usuario } from "./comun.mjs";
import { idProyecto, idProyectoEjemplo } from "./proyectos.mjs";

const UBICACION = (codigo) => (codigo.startsWith("A4") ? `Fachada, columna ${codigo.slice(3, -1)}` : `Eje ${codigo}`);

async function crearLugar(page, cap) {
  await ir(page, `/projects/${idProyecto()}`);
  await page.getByRole("button", { name: "+ Nuevo Proceso" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Control de Asentamientos", exact: true }).click();
  const d = dialogo(page, "Nuevo lugar");
  await d.getByLabel("Nombre").fill(C.name);
  await d.getByText("Edificio", { exact: true }).click();
  await d.getByLabel("Descripción · opcional").fill(C.description);
  await conAlto(page, 1100, () => cap.paso("nuevo-lugar", d));
  await d.getByRole("button", { name: "Crear lugar" }).click();
  await page.waitForURL(/settlement\/[0-9a-f-]{36}/, { timeout: 60_000 });
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(800);
}

async function agregarPunto(page, codigo, cap) {
  await page.getByRole("button", { name: "Agregar punto" }).click();
  const d = dialogo(page, "Nuevo punto");
  await d.getByLabel("Código").fill(codigo);
  await d.getByLabel("Ubicación").fill(UBICACION(codigo));
  if (cap) await cap.paso("nuevo-punto", d);
  await d.getByRole("button", { name: "Guardar" }).click();
  await d.waitFor({ state: "detached" });
  await page.waitForTimeout(300);
}

/** Una visita de la cartera: el alta y su única armada, lectura por lectura. */
async function medirVisita(page, visita, n, cap) {
  await pulsarHasta(page.getByRole("button", { name: "+ Nueva visita" }), dialogo(page, "Nueva visita"));
  const d = dialogo(page, "Nueva visita");
  await d.getByLabel("Fecha", { exact: true }).fill(visita.date);
  await d.getByLabel("Nivelador").fill("Andrea Rojas");
  if (cap && n === 1) await cap.paso("nueva-visita", d);
  await d.getByRole("button", { name: "Crear y empezar" }).click();
  await page.waitForURL(/visits\/[0-9a-f-]{36}/, { timeout: 60_000 });
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(800);
  if (cap && n === 1) await cap.paso("libreta-plantilla", { completa: true });

  await pulsarHasta(page.getByRole("button", { name: "Retomar medición" }), page.getByRole("dialog"));
  const a = page.getByRole("dialog");
  await a.getByRole("group", { name: "Vista atrás" }).getByLabel("Lectura").fill(String(visita.backsight));
  for (const [i, codigo] of C.points.entries()) {
    const campo = a.getByLabel(`Lectura a ${codigo}`);
    await campo.fill(String(visita.readings[i]));
    await campo.press("Enter");
  }
  await a.getByText(/guardado/).last().waitFor();
  await page.waitForTimeout(500);
  if (cap && n === 1) await conAlto(page, 1500, () => cap.paso("armada", a));
  await a.getByRole("button", { name: "Terminar armada" }).click();
  await a.waitFor({ state: "detached" });
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(600);
}

export async function recorrer() {
  const { browser, page } = await abrir();
  const cap = capitulo("asentamientos", page);
  try {
    await entrar(page);
    sql(`delete from public.sites where project_id='${idProyecto()}' and kind='settlement'`);

    // El lugar, sus puntos y su BM.
    await crearLugar(page, cap);
    const lugar = idDe(
      "el lugar",
      `select id from public.sites where name='${C.name}' and project_id='${idProyecto()}'`,
    );
    const base = `/projects/${idProyecto()}/settlement/${lugar}`;
    await cap.paso("lugar-nuevo");

    await ir(page, `${base}?tab=puntos`);
    for (const [i, codigo] of C.points.entries()) await agregarPunto(page, codigo, i === 0 ? cap : null);
    await cap.paso("puntos", { completa: true });

    await ir(page, `${base}?tab=bms`);
    await page.getByRole("button", { name: "+ BM" }).click();
    const bm = dialogo(page, "Nuevo BM");
    await bm.getByLabel("Código").fill(C.benchmark.code);
    await bm.getByLabel("Cota (m)").fill(String(C.benchmark.elevation));
    await bm.getByLabel("Descripción · opcional").fill("BM de la piscina");
    await cap.paso("nuevo-bm", bm);
    await bm.getByRole("button", { name: "Guardar" }).click();
    await bm.waitFor({ state: "detached" });
    await page.waitForTimeout(600);
    await cap.paso("bms");

    // Las siete visitas.
    for (const [i, visita] of C.visits.entries()) {
      await ir(page, `${base}?tab=panel`);
      await medirVisita(page, visita, i + 1, cap);
    }

    // La visita 2 (la tercera: la línea base es la visita 0): el aviso de
    // B10, fuera de tendencia.
    const visita = (n) =>
      idDe(`la visita ${n}`, `select id from public.settlement_visits where site_id='${lugar}' and visit_number=${n}`);
    await ir(page, `${base}/visits/${visita(2)}?tab=libreta`);
    await cap.paso("libreta-con-aviso", { completa: true });
    await ir(page, `${base}/visits/${visita(6)}?tab=resultados`);
    await cap.paso("resultados", { completa: true });

    // El panel y el informe del lugar.
    await ir(page, `${base}?tab=panel`);
    await cap.paso("panel", { completa: true });
    await ir(page, `${base}?tab=informe`);
    await cap.paso("informe", { completa: true });

    // Dar de baja: la ventana, sin confirmar (la cartera no tiene bajas).
    await ir(page, `${base}?tab=puntos`);
    await page.getByRole("button", { name: "Dar de baja" }).last().click();
    const baja = page.getByRole("dialog");
    await baja.getByLabel("De baja desde").fill("2022-06-20");
    await baja.getByLabel("Motivo").fill("Destruido por la ampliación de la cubierta");
    await cap.paso("dar-de-baja", baja);
    await page.keyboard.press("Escape");

    // ── Torre Alameda, de la demo ─────────────────────────────────────────
    const demo = idProyectoEjemplo();
    const alameda = idDe(
      "Torre Alameda",
      `select id from public.sites where name='Torre Alameda' and project_id='${demo}'`,
    );
    const baseA = `/projects/${demo}/settlement/${alameda}`;
    const visitaA = (n) =>
      idDe(`la visita ${n} de Torre Alameda`, `select id from public.settlement_visits where site_id='${alameda}' and visit_number=${n}`);
    await ir(page, `${baseA}/visits/${visitaA(12)}?tab=libreta`);
    await cap.paso("dos-armadas", { completa: true });
    await page.getByRole("button", { name: "Editar la armada 2" }).first().click();
    const a2 = page.getByRole("dialog");
    await a2.waitFor();
    await page.waitForTimeout(600);
    await conAlto(page, 1500, () => cap.paso("armada-punto-de-cambio", a2));
    await page.getByRole("button", { name: "Seguir después" }).click();
    await ir(page, `${baseA}/visits/${visitaA(13)}?tab=libreta`);
    await cap.paso("bm-desplazado", { completa: true });
    console.log(`  (usuario ${usuario()})`);
  } finally {
    await browser.close();
  }
}
