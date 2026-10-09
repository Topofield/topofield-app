// Capítulo 7 · El catálogo de equipos: agregar una estación total y un nivel,
// y tomar el nivel del catálogo en el alta de una nivelación.

import { abrir, capitulo, conAlto, dialogo, entrar, ir, sql, usuario } from "./comun.mjs";
import { idProyecto } from "./proyectos.mjs";

const ESTACION = { marca: "Leica", modelo: "TS06 plus", serie: "1352874", calibracion: "2026-03-15", angular: "2", constante: "1.5", ppm: "2" };
const NIVEL = { marca: "Leica", modelo: "LS15", serie: "702114", calibracion: "2025-06-10", tipo: "Digital / electrónico", sigma: "0.3" };

export async function recorrer() {
  const { browser, page } = await abrir();
  const cap = capitulo("equipos", page);
  try {
    await entrar(page);
    sql(`delete from public.equipment where user_id='${usuario()}'`);
    await ir(page, "/equipos");
    await cap.paso("catalogo-vacio");

    // Una estación total.
    await page.getByRole("button", { name: "Agregar" }).nth(0).click();
    let d = dialogo(page, "Nuevo equipo");
    await d.getByLabel("Marca").fill(ESTACION.marca);
    await d.getByLabel("Modelo").fill(ESTACION.modelo);
    await d.getByLabel("Número de serie").fill(ESTACION.serie);
    await d.getByLabel("Fecha de calibración").fill(ESTACION.calibracion);
    await d.getByLabel("Precisión angular (″)").fill(ESTACION.angular);
    await d.getByLabel("Precisión de distancia — término constante (mm)").fill(ESTACION.constante);
    await d.getByLabel("Precisión de distancia — término proporcional (ppm)").fill(ESTACION.ppm);
    await conAlto(page, 1100, () => cap.paso("nueva-estacion", d));
    await d.getByRole("button", { name: "Guardar" }).click();
    await d.waitFor({ state: "detached" });

    // Un nivel, con la calibración vencida: la lista lo avisa.
    await page.getByRole("button", { name: "Agregar" }).nth(1).click();
    d = dialogo(page, "Nuevo equipo");
    await d.getByLabel("Marca").fill(NIVEL.marca);
    await d.getByLabel("Modelo").fill(NIVEL.modelo);
    await d.getByLabel("Número de serie").fill(NIVEL.serie);
    await d.getByLabel("Fecha de calibración").fill(NIVEL.calibracion);
    await d.getByLabel("Tipo de nivel").selectOption({ label: NIVEL.tipo });
    await d.getByLabel("Desviación típica (mm/km, doble nivelación)").fill(NIVEL.sigma);
    await d.getByRole("button", { name: "Guardar" }).click();
    await d.waitFor({ state: "detached" });
    await page.waitForTimeout(800);
    await cap.paso("catalogo", { completa: true });

    // «Tomar del catálogo» en el alta de una nivelación (sin crearla).
    await ir(page, `/projects/${idProyecto()}`);
    await page.getByRole("button", { name: "+ Nuevo Proceso" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Nivelación", exact: true }).click();
    const alta = dialogo(page, "Nueva nivelación");
    await alta.locator("summary", { hasText: "Ubicación, responsable y equipo" }).click();
    const opcion = await alta.getByLabel("Tomar del catálogo").locator("option", { hasText: NIVEL.modelo }).first().getAttribute("value");
    await alta.getByLabel("Tomar del catálogo").selectOption(opcion);
    await page.waitForTimeout(400);
    await conAlto(page, 1400, () => cap.paso("tomar-del-catalogo", alta));
    await page.keyboard.press("Escape");
  } finally {
    await browser.close();
  }
}
