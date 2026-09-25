import { cookies } from "next/headers";
import { THEME_COOKIE, themeFromCookie, type ThemeChoice } from "./theme";

/**
 * La elección de tema del usuario, desde su cookie. Leer `cookies()` vuelve
 * dinámica la ruta; las de la app ya lo eran porque leen la sesión.
 */
export async function readThemeChoice(): Promise<ThemeChoice> {
  return themeFromCookie((await cookies()).get(THEME_COOKIE)?.value);
}
