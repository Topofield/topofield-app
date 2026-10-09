// Capítulo 2 · Proyectos: crear uno, su pestaña de configuración, los puntos
// de referencia y el listado de procesos (con el proyecto de ejemplo).
//
// El proyecto que crea, «Sede Vivero — Universidad Distrital», es el que usan
// los recorridos de la poligonal y la nivelación.

import { CARTERA_TT4 } from "../../../src/lib/demo/carteras.ts";
import { abrir, capitulo, dialogo, entrar, idDe, ir, sql, usuario } from "./comun.mjs";

export const PROYECTO = "Sede Vivero — Universidad Distrital";

/** El id del proyecto del recorrido (lo crea este capítulo). */
export function idProyecto() {
  return idDe(
    `el proyecto «${PROYECTO}»`,
    `select id from public.projects where name='${PROYECTO}' and user_id='${usuario()}'`,
  );
}

/** El id del proyecto de ejemplo de la cuenta del recorrido. */
export function idProyectoEjemplo() {
  return idDe(
    "el Proyecto de ejemplo",
    `select id from public.projects where name='Proyecto de ejemplo' and user_id='${usuario()}'`,
  );
}

async function agregarPunto(page, { codigo, tipo, norte, este, descripcion }, cap) {
  await page.getByRole("button", { name: "Agregar punto" }).click();
  const d = dialogo(page, "Nuevo punto de referencia");
  await d.getByLabel("Código").fill(codigo);
  await d.getByLabel("Tipo").selectOption({ label: tipo });
  await d.getByLabel("Norte").fill(String(norte));
  await d.getByLabel("Este").fill(String(este));
  await d.getByLabel("Descripción").fill(descripcion);
  if (cap) await cap.paso("nuevo-punto-de-referencia", d);
  await d.getByRole("button", { name: "Guardar" }).click();
  await d.waitFor({ state: "detached" });
  await page.waitForTimeout(600);
}

export async function recorrer() {
  const { browser, page } = await abrir();
  const cap = capitulo("proyectos", page);
  try {
    await entrar(page);
    // Repetible: el proyecto de una pasada anterior se borra (con lo que
    // crearon los capítulos siguientes, que se repiten después).
    sql(`delete from public.projects where name='${PROYECTO}' and user_id='${usuario()}'`);

    // Crear el proyecto.
    await page.getByRole("link", { name: "+ Nuevo Proyecto" }).click();
    await page.waitForURL(/projects\/new/);
    await page.waitForTimeout(800);
    await page.getByLabel("Nombre del proyecto").fill(PROYECTO);
    await page.getByLabel("Descripción").fill("Levantamientos topográficos del campus");
    await page.getByLabel("Cliente").fill("Universidad Distrital Francisco José de Caldas");
    await page.getByLabel("Ubicación").fill("Bogotá D.C.");
    await page.getByLabel("Proyección").fill("Origen Nacional");
    await cap.paso("nuevo-proyecto", { completa: true });
    await page.getByRole("button", { name: "Crear proyecto" }).click();
    await page.waitForURL(/projects\/[0-9a-f-]{36}/, { timeout: 60_000 });
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(800);
    await cap.paso("proyecto-nuevo");

    // Configuración y puntos de referencia: el amarre de la poligonal V10.
    const id = idProyecto();
    await ir(page, `/projects/${id}?tab=config`);
    await agregarPunto(
      page,
      {
        codigo: CARTERA_TT4.referencePointCode,
        tipo: "Control",
        norte: CARTERA_TT4.referenceNorth,
        este: CARTERA_TT4.referenceEast,
        descripcion: "Mojón de control del campus",
      },
      cap,
    );
    await agregarPunto(page, {
      codigo: CARTERA_TT4.startPointCode,
      tipo: "Control",
      norte: CARTERA_TT4.startNorth,
      este: CARTERA_TT4.startEast,
      descripcion: "Vértice de partida de la poligonal",
    });
    await cap.paso("configuracion", { completa: true });

    // El listado de procesos, con el proyecto de ejemplo.
    const ejemplo = idProyectoEjemplo();
    await ir(page, `/projects/${ejemplo}`);
    await cap.paso("listado-de-procesos", { completa: true });
    await page.getByRole("group", { name: "Filtrar por estado" }).getByRole("link", { name: /Calculados/ }).click();
    await page.waitForTimeout(800);
    await cap.paso("filtro-calculados");

    // El selector del tipo de proceso.
    await ir(page, `/projects/${id}`);
    await page.getByRole("button", { name: "+ Nuevo Proceso" }).click();
    await page.waitForTimeout(500);
    await cap.paso("nuevo-proceso", page.getByRole("dialog"));
    await page.keyboard.press("Escape");
  } finally {
    await browser.close();
  }
}
