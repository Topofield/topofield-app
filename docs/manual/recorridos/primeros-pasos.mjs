// Capítulo 1 · Primeros pasos: la presentación, solicitar la invitación, crear la cuenta con el código, entrar, el
// proyecto de ejemplo, el dashboard, la barra y el tema.

import {
  BASE,
  CUENTA,
  abrir,
  aceptarInvitacion,
  borrarCuenta,
  capitulo,
  enlaceDeConfirmacion,
  idDe,
  ir,
  usuario,
  vaciarBuzon,
} from "./comun.mjs";

export async function recorrer() {
  await borrarCuenta();
  await vaciarBuzon();
  const { browser, page } = await abrir();
  const cap = capitulo("primeros-pasos", page);
  try {
    // Sin sesión, TopoField abre en la página de presentación (Fase 45).
    await ir(page, "/");
    await cap.paso("presentacion");

    // Solicitar la invitación (Fase 46).
    await page.getByRole("link", { name: "Solicitar invitación" }).first().click();
    await page.waitForURL(/solicitar-invitacion/);
    await page.waitForTimeout(800);
    await page.getByLabel("Nombre", { exact: true }).fill(CUENTA.nombre);
    await page.getByLabel("Apellido").fill(CUENTA.apellido);
    await page.getByLabel("Correo").fill(CUENTA.email);
    await page.getByLabel("Empresa o entidad (opcional)").fill("Topografía Rojas");
    await page
      .getByLabel("¿Para qué quiere usar TopoField? (opcional)")
      .fill("Poligonales y nivelaciones de obra.");
    await cap.paso("solicitar-invitacion");
    await page.getByRole("button", { name: "Solicitar invitación" }).click();
    await page.getByRole("status").waitFor({ timeout: 60_000 });
    await cap.paso("solicitud-recibida");

    // El administrador la acepta; la pantalla para entrar, antes de tener cuenta.
    const codigo = aceptarInvitacion();
    await ir(page, "/sign-in");
    await cap.paso("inicio-de-sesion");

    // Crear la cuenta con el código: primero correo y código, luego la contraseña.
    await page.getByRole("link", { name: "Crear cuenta" }).click();
    await page.waitForURL(/sign-up/);
    await page.waitForTimeout(800);
    await page.getByLabel("Correo").fill(CUENTA.email);
    await page.getByLabel("Código de invitación").fill(codigo);
    await cap.paso("crear-cuenta-codigo");
    await page.getByRole("button", { name: "Continuar" }).click();
    await page.getByLabel("Contraseña").waitFor({ timeout: 60_000 });
    await page.getByLabel("Contraseña").fill(CUENTA.password);
    await cap.paso("crear-cuenta-contrasena");
    await page.getByRole("button", { name: "Crear cuenta" }).click();
    await page.waitForURL(/dashboard|revisa-tu-correo/, { timeout: 120_000 });

    // Si la base local aún pide confirmar el correo, se confirma por Mailpit.
    // En producción no hay confirmación: se entra directo, y así lo cuenta el
    // manual. El enlace se sigue sin redirigir y el código se canjea en el
    // /auth/callback de este servidor: fuera del puerto 3000, Supabase
    // redirige a `site_url` (config.toml), donde puede no haber nadie.
    if (page.url().includes("revisa-tu-correo")) {
      const enlace = await enlaceDeConfirmacion();
      const respuesta = await fetch(enlace, { redirect: "manual" });
      const codigoSesion = new URL(respuesta.headers.get("location") ?? "", BASE).searchParams.get("code");
      if (!codigoSesion) throw new Error(`El enlace de confirmación no trajo un código: ${respuesta.headers.get("location")}`);
      await page.goto(`${BASE}/auth/callback?code=${codigoSesion}`, { waitUntil: "networkidle", timeout: 120_000 });
      await page.waitForURL(/dashboard/, { timeout: 120_000 });
    }
    // La primera visita crea el proyecto de ejemplo; se recarga para verlo.
    await page.waitForTimeout(1500);
    await ir(page, "/dashboard");
    await cap.paso("dashboard");

    // La ruta: en una poligonal de la demo, la lista de los otros procesos.
    const demo = idDe(
      "la poligonal TT4 de la demo",
      `select p.id || '/polygonal/' || pp.id from public.polygonal_processes pp join public.projects p on p.id = pp.project_id
       where p.user_id = '${usuario()}' and p.name = 'Proyecto de ejemplo' and pp.name like 'Poligonal V10%'`,
    );
    await ir(page, `/projects/${demo}`);
    await page.getByRole("button", { name: "Otros procesos del proyecto" }).click();
    await page.waitForTimeout(400);
    await cap.paso("menu-de-la-ruta");
    await page.keyboard.press("Escape");
    await ir(page, "/dashboard");

    // La barra: el menú de cuenta con el tema.
    await page.getByRole("button", { name: "Cuenta" }).click();
    await page.waitForTimeout(400);
    await cap.paso("menu-de-cuenta", page.locator("#cuenta"));

    // El tema oscuro, y de vuelta a «Sistema».
    await page.getByRole("group", { name: "Tema" }).getByRole("button", { name: "Oscuro" }).click();
    await page.keyboard.press("Escape");
    await page.waitForTimeout(800);
    await cap.paso("tema-oscuro");
    await page.getByRole("button", { name: "Cuenta" }).click();
    await page.getByRole("group", { name: "Tema" }).getByRole("button", { name: "Sistema" }).click();
    await page.keyboard.press("Escape");
  } finally {
    await browser.close();
  }
}
