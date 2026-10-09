// Capítulo 1 · Primeros pasos: crear la cuenta, confirmarla, entrar, el
// proyecto de ejemplo, el dashboard, la barra y el tema.

import {
  BASE,
  CUENTA,
  abrir,
  borrarCuenta,
  capitulo,
  enlaceDeConfirmacion,
  ir,
  vaciarBuzon,
} from "./comun.mjs";

export async function recorrer() {
  await borrarCuenta();
  await vaciarBuzon();
  const { browser, page } = await abrir();
  const cap = capitulo("primeros-pasos", page);
  try {
    // Entrar: la pantalla de inicio de sesión.
    await ir(page, "/sign-in");
    await cap.paso("inicio-de-sesion");

    // Crear la cuenta con el código de invitación.
    await page.getByRole("link", { name: "Regístrate" }).click();
    await page.waitForURL(/sign-up/);
    await page.waitForTimeout(800);
    // El código real no va en la captura (el manual es público): se fotografía
    // uno de ejemplo y se escribe el real justo antes de enviar.
    await page.getByLabel("Código de invitación").fill("CODIGO-DE-EJEMPLO");
    await page.getByLabel("Nombre").fill(CUENTA.nombre);
    await page.getByLabel("Apellido").fill(CUENTA.apellido);
    await page.getByLabel("Correo").fill(CUENTA.email);
    await page.getByLabel("Contraseña").fill(CUENTA.password);
    await cap.paso("crear-cuenta");
    await page.getByLabel("Código de invitación").fill(process.env.SIGNUP_INVITE_CODE ?? "");
    await page.getByRole("button", { name: "Crear cuenta" }).click();
    await page.waitForURL(/revisa-tu-correo/, { timeout: 60_000 });
    await page.waitForTimeout(600);
    await cap.paso("revise-su-correo");

    // El enlace del correo confirma la cuenta y deja la sesión iniciada.
    // Se sigue el enlace sin redirigir y el código se canjea en el
    // /auth/callback de este servidor: fuera del puerto 3000, Supabase
    // redirige a `site_url` (config.toml), donde puede no haber nadie.
    const enlace = await enlaceDeConfirmacion();
    const respuesta = await fetch(enlace, { redirect: "manual" });
    const codigo = new URL(respuesta.headers.get("location") ?? "", BASE).searchParams.get("code");
    if (!codigo) throw new Error(`El enlace de confirmación no trajo un código: ${respuesta.headers.get("location")}`);
    await page.goto(`${BASE}/auth/callback?code=${codigo}`, { waitUntil: "networkidle", timeout: 120_000 });
    await page.waitForURL(/dashboard/, { timeout: 120_000 });
    // La primera visita crea el proyecto de ejemplo; se recarga para verlo.
    await page.waitForTimeout(1500);
    await ir(page, "/dashboard");
    await cap.paso("dashboard");

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
