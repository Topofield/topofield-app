// Capítulo 8 · En campo, con el teléfono (390 px): la poligonal con su
// selector Tabla | Dibujo, la libreta de una visita como lista de armadas, la
// armada a pantalla completa y el panel en tema oscuro.

import { abrir, capitulo, entrar, idDe, ir } from "./comun.mjs";
import { idProyecto, idProyectoEjemplo } from "./proyectos.mjs";

export async function recorrer() {
  const { browser, context, page } = await abrir({ movil: true });
  const cap = capitulo("en-campo", page);
  try {
    await entrar(page);
    const tt4 = idDe(
      "la poligonal V10",
      `select id from public.polygonal_processes where name like 'Poligonal V10%' and project_id='${idProyecto()}'`,
    );
    await ir(page, `/projects/${idProyecto()}/polygonal/${tt4}?tab=datos`);
    // El selector arriba de la pantalla, con las mediciones debajo.
    await page.getByRole("group", { name: "Vista" }).evaluate((el) => window.scrollBy(0, el.getBoundingClientRect().top - 70));
    await page.waitForTimeout(400);
    await cap.paso("poligonal-tabla");
    await page.getByRole("button", { name: "Dibujo", exact: true }).click();
    await page.waitForTimeout(600);
    await cap.paso("poligonal-dibujo");

    const demo = idProyectoEjemplo();
    const alameda = idDe("Torre Alameda", `select id from public.sites where name='Torre Alameda' and project_id='${demo}'`);
    const v12 = idDe("la visita 12", `select id from public.settlement_visits where site_id='${alameda}' and visit_number=12`);
    const base = `/projects/${demo}/settlement/${alameda}`;
    await ir(page, `${base}/visits/${v12}?tab=libreta`);
    await cap.paso("visita-armadas");
    await page.getByRole("button", { name: "Editar la armada 1" }).first().click();
    await page.getByRole("dialog").waitFor();
    await page.waitForTimeout(600);
    await cap.paso("visita-armada");
    await page.getByRole("button", { name: "Seguir después" }).click();

    // El panel en tema oscuro.
    await context.addCookies([{ name: "topofield-theme", value: "dark", url: "http://localhost" }]);
    await ir(page, `${base}?tab=panel`);
    await cap.paso("panel-oscuro");
    await context.clearCookies({ name: "topofield-theme" });
  } finally {
    await browser.close();
  }
}
