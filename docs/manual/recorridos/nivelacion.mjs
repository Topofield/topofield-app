// Capítulo 4 · La nivelación, con carteras reales:
//   - El Verjón (`docs/carteras/TRABAJO NIVELACION EL VERJON-corregido.xlsx`),
//     abierta con vuelta por los mismos puntos, tecleada armada por armada;
//   - el tramo 2, importado del crudo del nivel digital Leica
//     (`docs/carteras/CRDUDO-TRAMO2.L`).

import { join } from "node:path";
import { CARTERA_VERJON } from "../../../src/lib/demo/carteras.ts";
import { RAIZ, abrir, capitulo, conAlto, dialogo, entrar, idDe, ir, sql } from "./comun.mjs";
import { idProyecto } from "./proyectos.mjs";

const NOMBRE_VERJON = CARTERA_VERJON.name;
const NOMBRE_TRAMO = "Tramo 2 — nivel digital";

/**
 * Las armadas de una libreta por punto: cada una va de un BM o punto de cambio
 * al siguiente, con las vistas intermedias que se leyeron en medio.
 */
function armadasDe(filas) {
  const armadas = [];
  let actual = null;
  for (const f of filas) {
    if (f.type === "intermediate") {
      actual.intermedias.push(f);
      continue;
    }
    if (actual) {
      actual.adelante = f;
      armadas.push(actual);
    }
    if (f.backsight != null) actual = { atras: f, intermedias: [], adelante: null };
  }
  return armadas;
}

async function nuevaNivelacion(page, { titulo, tipo, vuelta, bm, cota }) {
  await ir(page, `/projects/${idProyecto()}`);
  await page.getByRole("button", { name: "+ Nuevo Proceso" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Nivelación", exact: true }).click();
  const d = dialogo(page, "Nueva nivelación");
  await d.getByLabel("Título").fill(titulo);
  await d.getByText(tipo, { exact: true }).click();
  if (vuelta) await d.getByRole("checkbox").first().check();
  await d.getByLabel("BM de partida").fill(bm);
  await d.getByLabel("Cota conocida (m)").fill(String(cota));
  return d;
}

async function crear(page, d) {
  await d.getByRole("button", { name: "Crear y empezar" }).click();
  await page.waitForURL(/leveling\/[0-9a-f-]{36}/, { timeout: 60_000 });
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(800);
}

/** Llena el popup de una armada y la guarda. */
async function armada(page, a, { titulo, fin = false, capturar } = {}) {
  // El mismo popup pasa a la armada siguiente: hay que esperar a que cambie
  // de verdad, o lo tecleado cae en la anterior y se pierde al cambiar.
  const d = page.getByRole("dialog", { name: titulo });
  await d.waitFor();
  await d.getByText(`El nivel entre ${a.atras.code.trim()}`, { exact: false }).waitFor();
  await page.waitForTimeout(300);
  const atras = d.getByRole("group", { name: "Vista atrás" });
  await atras.getByLabel("Lectura").fill(String(a.atras.backsight));
  await atras.getByLabel(/^Distancia \(m\)/).fill(String(a.atras.backDistanceM));
  const adelante = d.getByRole("group", { name: "Vista adelante" });
  const punto = adelante.getByLabel("Punto");
  if (await punto.isEditable()) await punto.fill(a.adelante.code);
  await adelante.getByLabel("Lectura").fill(String(a.adelante.foresight));
  await adelante.getByLabel(/^Distancia \(m\)/).fill(String(a.adelante.foreDistanceM));
  for (const [i, v] of a.intermedias.entries()) {
    await d.getByRole("button", { name: "+ Vista intermedia" }).click();
    const grupo = d.getByRole("group", { name: "Vistas intermedias" });
    await grupo.getByLabel(`Punto ${i + 1}`).fill(v.code);
    await grupo.getByLabel("Lectura").nth(i).fill(String(v.foresight));
  }
  if (fin) await d.getByRole("checkbox").last().check();
  if (capturar) await capturar(d);
  const boton = fin
    ? d.getByRole("button", { name: /^(Guardar y seguir con la vuelta|Guardar)$/ }).last()
    : d.getByRole("button", { name: /^Guardar y seguir desde/ });
  await boton.click();
}

export async function recorrer() {
  const { browser, page } = await abrir();
  const cap = capitulo("nivelacion", page);
  try {
    await entrar(page);
    sql(`delete from public.leveling_processes where project_id='${idProyecto()}'`);

    // ── El Verjón, abierta con vuelta ─────────────────────────────────────
    const alta = await nuevaNivelacion(page, {
      titulo: NOMBRE_VERJON,
      tipo: "Abierta",
      vuelta: true,
      bm: CARTERA_VERJON.startCode,
      cota: CARTERA_VERJON.startElevation,
    });
    await conAlto(page, 1100, () => cap.paso("nueva-nivelacion", alta));
    await crear(page, alta);
    await cap.paso("libreta-vacia");

    // La ida, armada por armada.
    await page.getByRole("button", { name: "+ Agregar la primera armada" }).click();
    const ida = armadasDe(CARTERA_VERJON.ida);
    for (const [k, a] of ida.entries()) {
      await armada(page, a, {
        titulo: `Armada ${k + 1} · ida`,
        fin: k === ida.length - 1,
        capturar: k === 3 ? (d) => conAlto(page, 1200, () => cap.paso("armada", d)) : undefined,
      });
    }
    // La vuelta sigue sola desde el fin de la ida, en D4.
    const vuelta = armadasDe(CARTERA_VERJON.vuelta);
    for (const [k, a] of vuelta.entries()) {
      await armada(page, a, { titulo: `Armada ${k + 1} · vuelta`, fin: k === vuelta.length - 1 });
    }
    await page.getByRole("dialog").waitFor({ state: "detached" });
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1200);

    const verjon = idDe(
      "El Verjón",
      `select id from public.leveling_processes where name='${NOMBRE_VERJON}' and project_id='${idProyecto()}'`,
    );
    const pasos = `/projects/${idProyecto()}/leveling/${verjon}`;
    await ir(page, `${pasos}?tab=libreta`);
    await cap.paso("libreta", { completa: true });

    await ir(page, `${pasos}?tab=compensacion`);
    await page.getByText(/^Por qué/).first().click();
    await page.waitForTimeout(500);
    await cap.paso("compensacion", { completa: true });

    await ir(page, `${pasos}?tab=informe`);
    await cap.paso("informe", { completa: true });

    // ── El tramo 2, importado del nivel digital ───────────────────────────
    const alta2 = await nuevaNivelacion(page, { titulo: NOMBRE_TRAMO, tipo: "Cerrada", bm: "BM1", cota: 100 });
    await crear(page, alta2);
    await page.getByRole("button", { name: "Importar .L o CSV" }).first().click();
    const imp = dialogo(page, "Importar libreta desde archivo");
    await imp.locator('input[type="file"]').setInputFiles(join(RAIZ, "docs", "carteras", "CRDUDO-TRAMO2.L"));
    await imp.getByRole("button", { name: "Usar estas lecturas" }).waitFor();
    await page.waitForTimeout(800);
    await conAlto(page, 1500, () => cap.paso("importar", imp));
    await imp.getByRole("button", { name: "Usar estas lecturas" }).click();
    await imp.waitFor({ state: "detached" });
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1200);
    await cap.paso("importada", { completa: true });
  } finally {
    await browser.close();
  }
}
