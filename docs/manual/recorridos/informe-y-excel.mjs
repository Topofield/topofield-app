// Capítulo 6 · El informe y el Excel, con la poligonal V10 del recorrido:
// la página de informe con sus dos botones, el informe como sale impreso y la
// descarga del libro de Excel (que no se captura: se comprueba que llega).

import { abrir, capitulo, entrar, idDe, ir } from "./comun.mjs";
import { idProyecto } from "./proyectos.mjs";

export async function recorrer() {
  const { browser, page } = await abrir();
  const cap = capitulo("informe-y-excel", page);
  try {
    await entrar(page);
    const tt4 = idDe(
      "la poligonal V10",
      `select id from public.polygonal_processes where name like 'Poligonal V10%' and project_id='${idProyecto()}'`,
    );
    const informe = `/projects/${idProyecto()}/polygonal/${tt4}?tab=informe`;
    await ir(page, informe);
    await cap.paso("pagina-de-informe");

    // Así lo ve el diálogo de impresión: solo el informe.
    await page.emulateMedia({ media: "print" });
    await page.waitForTimeout(600);
    await cap.paso("como-se-imprime", { paginaEntera: true });
    await page.emulateMedia({ media: "screen" });

    // El Excel: la descarga llega con el nombre del proceso.
    const [descarga] = await Promise.all([
      page.waitForEvent("download", { timeout: 60_000 }),
      page.getByRole("link", { name: "Exportar Excel" }).click(),
    ]);
    const nombre = descarga.suggestedFilename();
    if (!nombre.endsWith(".xlsx")) throw new Error(`La descarga no es un .xlsx: ${nombre}`);
    console.log(`  ✓ descarga ${nombre}`);
  } finally {
    await browser.close();
  }
}
