// Tema claro / oscuro (Fase 20, UI1). Sin la cookie, la app sigue al sistema
// operativo; el selector de la cabecera fuerza uno. La cookie la escribe el
// cliente y la lee el layout raíz en el servidor, que pone `data-theme` en
// `<html>`: la página llega pintada con el tema correcto, sin parpadeo.

export const THEME_COOKIE = "topofield-theme";

export const THEME_CHOICES = ["system", "light", "dark"] as const;
export type ThemeChoice = (typeof THEME_CHOICES)[number];

export const THEME_LABELS: Record<ThemeChoice, string> = {
  system: "Sistema",
  light: "Claro",
  dark: "Oscuro",
};

/** Un valor ausente o desconocido es «sistema»: nunca se adivina un tema. */
export function themeFromCookie(value: string | null | undefined): ThemeChoice {
  return value === "light" || value === "dark" ? value : "system";
}

/** El atributo `data-theme` de `<html>`. Sin atributo, decide el sistema. */
export function themeAttribute(choice: ThemeChoice): "light" | "dark" | undefined {
  return choice === "system" ? undefined : choice;
}

/**
 * La cabecera `document.cookie` que guarda la elección: un año, toda la app,
 * `SameSite=Lax`. «Sistema» borra la cookie. No es `HttpOnly` porque la
 * escribe el cliente; no guarda nada sensible.
 */
export function themeCookie(choice: ThemeChoice, secure: boolean): string {
  const flags = `; path=/; samesite=lax${secure ? "; secure" : ""}`;
  return choice === "system"
    ? `${THEME_COOKIE}=; max-age=0${flags}`
    : `${THEME_COOKIE}=${choice}; max-age=31536000${flags}`;
}
