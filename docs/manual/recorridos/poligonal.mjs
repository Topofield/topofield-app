// Capítulo 3 · La poligonal, con dos carteras reales tecleadas desde cero:
//   - la V10, amarrada a TT4 (`docs/carteras/poligonales.xlsx`): alta, amarre
//     del catálogo, mediciones, cierre, cierre angular, ajuste e informe;
//   - la Famarena de la Sede Vivero medida en sistema local: mínimos
//     cuadrados, la precisión de cada punto y la georreferenciación con D1 y D3.

import { CARTERA_TT4, CARTERA_VIVERO } from "../../../src/lib/demo/carteras.ts";
import { REFERENCIAS_DEMO } from "../../../src/lib/demo/fixtures.ts";
import { abrir, capitulo, conAlto, dialogo, entrar, idDe, ir, pulsarHasta, sql } from "./comun.mjs";
import { PROYECTO, idProyecto } from "./proyectos.mjs";

const NOMBRE_TT4 = CARTERA_TT4.name;
const NOMBRE_VIVERO = "Poligonal Famarena — Sede Vivero, en sistema local";

/** Elige en un `<select>` la opción cuyo texto contiene `texto`. */
async function elegir(select, texto) {
  const valor = await select.locator("option", { hasText: texto }).first().getAttribute("value");
  await select.selectOption(valor);
}

/** Escribe un ángulo [g, m, s] en el campo DMS cuya etiqueta es `etiqueta`. */
async function angulo(zona, etiqueta, [g, m, s]) {
  // La etiqueta y las tres celdas comparten contenedor (`DmsInput`).
  const grupo = zona.getByText(etiqueta, { exact: true }).first().locator("xpath=..");
  await grupo.getByLabel("Grados", { exact: true }).fill(String(g));
  await grupo.getByLabel("Minutos", { exact: true }).fill(String(m));
  await grupo.getByLabel("Segundos", { exact: true }).fill(String(s));
}

async function nuevaPoligonal(page, { titulo, tipo = "Cerrada", equipo, cap }) {
  const proyecto = idProyecto();
  await ir(page, `/projects/${proyecto}`);
  await page.getByRole("button", { name: "+ Nuevo Proceso" }).click();
  if (cap) await cap.paso("nuevo-proceso", page.getByRole("dialog"));
  await page.getByRole("dialog").getByRole("button", { name: "Poligonal", exact: true }).click();
  const d = dialogo(page, "Nueva poligonal");
  await d.getByLabel("Título").fill(titulo);
  await d.getByLabel("Ubicación").fill("Sede Vivero, Bogotá");
  await d.getByLabel("Responsable", { exact: true }).fill("Andrea Rojas");
  await d.getByLabel("Cargo del responsable").fill("Topógrafa");
  await d.getByText(tipo, { exact: true }).click();
  if (equipo) {
    await d.locator("summary", { hasText: "Equipo" }).click();
    await d.getByLabel("Marca").fill(equipo.marca);
    await d.getByLabel("Modelo").fill(equipo.modelo);
    await d.getByLabel("N.º de serie").fill(equipo.serie);
  }
  return d;
}

async function crear(page, d) {
  await d.getByRole("button", { name: "Crear y empezar" }).click();
  await page.waitForURL(/polygonal\/[0-9a-f-]{36}/, { timeout: 60_000 });
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(800);
}

/**
 * Teclea las mediciones de una cartera en el popup «Agregar medición»: cada
 * estación con su ángulo, el punto siguiente y la distancia. La última vuelve
 * a la partida (el cierre) y después va el cierre angular.
 *
 * `capturar(i, d)` fotografía la ventana llena de la medición `i`; con
 * `pausa: { tras, capturar }`, después de guardar la medición `tras` se cierra
 * la ventana, se fotografía la pantalla y se sigue con «+ Agregar punto».
 */
async function medir(page, mediciones, { capturar, pausa } = {}) {
  await page.getByRole("button", { name: "+ Agregar punto" }).click();
  const d = page.getByRole("dialog");
  for (const [i, m] of mediciones.entries()) {
    await d.getByText(`Estás en ${m.desde}`, { exact: false }).waitFor();
    if (m.angulo) await angulo(d, "Lectura 1", m.angulo);
    if (m.cierre) {
      await d.getByLabel(/Cierre: este lado vuelve a/).check();
    } else {
      await d.getByLabel("Punto siguiente").fill(m.hacia);
    }
    await d.getByLabel(/Distancia horizontal/).fill(String(m.distancia));
    if (capturar) await capturar(i, d);
    await d.getByRole("button", { name: m.cierre ? "Agregar el cierre" : /^Agregar y seguir/ }).click();
    if (pausa && i === pausa.tras) {
      await d.getByText(`Estás en ${mediciones[i + 1].desde}`, { exact: false }).waitFor();
      await d.getByRole("button", { name: "Cancelar" }).click();
      await d.waitFor({ state: "detached" });
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(800);
      await pausa.capturar();
      await pulsarHasta(page.getByRole("button", { name: "+ Agregar punto" }), d);
    }
  }
  return d;
}

export async function recorrer() {
  const { browser, page } = await abrir();
  const cap = capitulo("poligonal", page);
  try {
    await entrar(page);
    // Repetible: fuera las poligonales de una pasada anterior.
    sql(`delete from public.polygonal_processes where project_id='${idProyecto()}'`);

    // ── La V10, amarrada a TT4 ────────────────────────────────────────────
    const alta = await nuevaPoligonal(page, {
      titulo: NOMBRE_TT4,
      equipo: { marca: "Leica", modelo: "TS06 plus", serie: "1352874" },
      cap,
    });
    await cap.paso("nueva-poligonal", alta);
    await crear(page, alta);
    await cap.paso("sin-datos");

    // El amarre: V10 y TT4 del catálogo del proyecto.
    await page.getByRole("button", { name: "Ingresar puntos de amarre" }).click();
    const amarre = dialogo(page, "Puntos de amarre");
    await elegir(amarre.getByRole("group", { name: "Estación de partida" }).getByLabel("Tomar del catálogo"), CARTERA_TT4.startPointCode);
    await elegir(amarre.getByRole("group", { name: "Punto de referencia" }).getByLabel("Tomar del catálogo"), CARTERA_TT4.referencePointCode);
    await page.waitForTimeout(400);
    await conAlto(page, 1100, () => cap.paso("puntos-de-amarre", amarre));
    await amarre.getByRole("button", { name: "Guardar el amarre" }).click();
    await amarre.waitFor({ state: "detached" });
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(800);
    await cap.paso("amarre");

    // Las mediciones, desde → hacia, como la cartera.
    const est = CARTERA_TT4.stations;
    const mediciones = est.slice(0, -1).map((s, i) => ({
      desde: s.pointCode,
      hacia: est[i + 1].pointCode,
      angulo: s.readings[0],
      distancia: s.distance,
      cierre: i === est.length - 2,
    }));
    const medicion = await medir(page, mediciones, {
      capturar: async (i, d) => {
        if (i === 0) await conAlto(page, 1100, () => cap.paso("agregar-medicion", d));
        if (i === mediciones.length - 1) await conAlto(page, 1100, () => cap.paso("ultimo-lado", d));
      },
      pausa: { tras: 2, capturar: () => cap.paso("tres-mediciones") },
    });
    // El cierre angular, en V10 hacia TT4.
    await medicion.getByText("Cierre angular").first().waitFor();
    await angulo(medicion, "Lectura 1", est.at(-1).readings[0]);
    await conAlto(page, 1100, () => cap.paso("cierre-angular", medicion));
    await medicion.getByRole("button", { name: "Guardar el cierre angular" }).click();
    await medicion.waitFor({ state: "detached" });
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1200);
    await cap.paso("datos", { completa: true });

    // Paso 2 · Ajuste.
    const tt4 = idDe(
      "la poligonal V10",
      `select id from public.polygonal_processes where name='${NOMBRE_TT4}' and project_id='${idProyecto()}'`,
    );
    const pasos = `/projects/${idProyecto()}/polygonal/${tt4}`;
    await ir(page, `${pasos}?tab=ajuste`);
    await page.getByText(/^Por qué/).click();
    await page.waitForTimeout(500);
    await cap.paso(
      "orden-alcanzado",
      page.getByRole("group", { name: "Método de ajuste" }).locator("xpath=ancestor::section[1]"),
    );
    await page.getByText(/^Por qué/).click();
    await cap.paso("ajuste", { completa: true });
    await cap.paso("dibujo", page.locator("figure").first());

    // Paso 3 · Informe.
    await ir(page, `${pasos}?tab=informe`);
    await cap.paso("informe", { completa: true });

    // ── La Sede Vivero, en sistema local ──────────────────────────────────
    const alta2 = await nuevaPoligonal(page, { titulo: NOMBRE_VIVERO });
    await crear(page, alta2);
    await page.getByRole("button", { name: "Medir sin amarre, en coordenadas locales" }).click();
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(800);
    const v = CARTERA_VIVERO.stations;
    const codigo = (c) => (c === CARTERA_VIVERO.startPointCode ? "P1" : c);
    const medV = v.slice(0, -1).map((s, i) => ({
      desde: codigo(s.pointCode),
      hacia: codigo(v[i + 1].pointCode),
      // Sin amarre no hay 0 atrás: la primera medición no lleva ángulo.
      angulo: i === 0 ? null : s.readings[0],
      distancia: s.distance,
      cierre: i === v.length - 2,
    }));
    const dv = await medir(page, medV);
    await dv.getByText("Cierre angular").first().waitFor();
    await angulo(dv, "Lectura 1", v.at(-1).readings[0]);
    await dv.getByRole("button", { name: "Guardar el cierre angular" }).click();
    await dv.waitFor({ state: "detached" });

    // Mínimos cuadrados, con los pesos de la hoja de la universidad.
    const vivero = idDe(
      "la Vivero en sistema local",
      `select id from public.polygonal_processes where name='${NOMBRE_VIVERO}' and project_id='${idProyecto()}'`,
    );
    const pasosV = `/projects/${idProyecto()}/polygonal/${vivero}`;
    await ir(page, `${pasosV}?tab=ajuste`);
    await pulsarHasta(
      page.getByRole("group", { name: "Método de ajuste" }).getByRole("button", { name: "Mínimos cuadrados" }),
      page.getByLabel("σ angular (″)"),
    );
    await page.waitForTimeout(500);
    await cap.paso(
      "minimos-cuadrados-pesos",
      page.getByRole("group", { name: "Método de ajuste" }).locator("xpath=ancestor::section[1]"),
    );
    await page.getByLabel("σ angular (″)").fill("2");
    await page.getByLabel("σ de distancia (m)").fill("0.011");
    await page.getByLabel("Veces que se midió cada distancia").fill("2");
    await page.getByLabel("Veces que se midió cada distancia").blur();
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1500);
    await cap.paso("minimos-cuadrados", { completa: true });
    await cap.paso("precision-de-cada-punto", page.getByText("Precisión de cada punto").locator("xpath=ancestor::section[1]"));

    // Georreferenciar con D1 y D3.
    const d1 = REFERENCIAS_DEMO.find((r) => r.code === "D1");
    const d3 = REFERENCIAS_DEMO.find((r) => r.code === "D3");
    await page.getByRole("button", { name: "Georreferenciar" }).click();
    const geo = dialogo(page, "Georreferenciar la poligonal");
    for (const [grupo, punto] of [
      ["Punto A", d1],
      ["Punto B", d3],
    ]) {
      const g = geo.getByRole("group", { name: grupo });
      await elegir(g.getByLabel("Estación"), punto.code);
      await g.getByLabel("Norte real").fill(String(punto.north));
      await g.getByLabel("Este real").fill(String(punto.east));
    }
    await page.waitForTimeout(800);
    await conAlto(page, 1400, () => cap.paso("georreferenciar", geo));
    await geo.getByRole("button", { name: "Georreferenciar" }).click();
    await geo.waitFor({ state: "detached" });
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1200);
    await cap.paso("georreferenciada", page.locator("figure").first());
    console.log(`  (proyecto: ${PROYECTO})`);
  } finally {
    await browser.close();
  }
}
