/**
 * Medición de contraste WCAG. Funciones puras: sin React, sin Supabase, sin
 * dependencias. Mismo patrón que `src/lib/calculations/`.
 *
 * Existe porque los cuatro tokens de color de la paleta incumplieron AA y se
 * corrigieron de uno en uno. El caso que ninguna revisión manual detectaba: un
 * color que cumple sobre blanco puede fallar sobre su propio fondo teñido al
 * 10 %, porque el fondo efectivo ya no es blanco. Ver
 * `docs/specs/2026-07-28-sistema-diseno-design.md` § 2.2.
 */

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

/** Umbrales de WCAG 2.1 nivel AA. */
export const AA_TEXTO = 4.5;
export const AA_TEXTO_GRANDE = 3;
export const AA_GRAFICO = 3;

/** `#rgb` o `#rrggbb` → canales 0–255. */
export function hexToRgb(hex: string): Rgb {
  const limpio = hex.trim().replace(/^#/, "");
  const completo =
    limpio.length === 3
      ? limpio
          .split("")
          .map((c) => c + c)
          .join("")
      : limpio;

  if (!/^[0-9a-fA-F]{6}$/.test(completo)) {
    throw new Error(`Color hexadecimal inválido: ${hex}`);
  }

  return {
    r: parseInt(completo.slice(0, 2), 16),
    g: parseInt(completo.slice(2, 4), 16),
    b: parseInt(completo.slice(4, 6), 16),
  };
}

export function rgbToHex({ r, g, b }: Rgb): string {
  const canal = (v: number) =>
    Math.round(Math.min(255, Math.max(0, v)))
      .toString(16)
      .padStart(2, "0");
  return `#${canal(r)}${canal(g)}${canal(b)}`;
}

/**
 * Luminancia relativa según WCAG 2.1. Los canales se linealizan antes de
 * ponderarse: el ojo no percibe el brillo de forma lineal respecto al valor
 * sRGB.
 */
export function relativeLuminance({ r, g, b }: Rgb): number {
  const lineal = (canal: number) => {
    const c = canal / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return (
    0.2126 * lineal(r) + 0.7152 * lineal(g) + 0.0722 * lineal(b)
  );
}

/**
 * Razón de contraste entre dos colores opacos, de 1:1 a 21:1.
 * El orden de los argumentos no altera el resultado.
 */
export function contrastRatio(colorA: string, colorB: string): number {
  const a = relativeLuminance(hexToRgb(colorA));
  const b = relativeLuminance(hexToRgb(colorB));
  const claro = Math.max(a, b);
  const oscuro = Math.min(a, b);
  return (claro + 0.05) / (oscuro + 0.05);
}

/**
 * Color efectivo de `color` aplicado con transparencia `alpha` sobre `base`.
 *
 * Es la pieza que faltaba en las revisiones manuales: `bg-success-500/10` no
 * es un fondo blanco, y medir el texto contra blanco da un resultado
 * optimista. `composite("#1a7a42", 0.1, "#ffffff")` devuelve el fondo real
 * que ve el usuario.
 */
export function composite(color: string, alpha: number, base: string): string {
  if (alpha < 0 || alpha > 1) {
    throw new Error(`Alfa fuera de rango [0,1]: ${alpha}`);
  }
  const c = hexToRgb(color);
  const b = hexToRgb(base);
  return rgbToHex({
    r: c.r * alpha + b.r * (1 - alpha),
    g: c.g * alpha + b.g * (1 - alpha),
    b: c.b * alpha + b.b * (1 - alpha),
  });
}

/** Redondeo a dos decimales, para mostrar «4.42:1» sin ruido. */
export function formatRatio(ratio: number): string {
  return `${ratio.toFixed(2)}:1`;
}

/**
 * Extrae los tokens de color del bloque `@theme` de una hoja de estilos.
 *
 * Los tokens viven en `src/app/globals.css`, que es su única fuente de verdad.
 * Duplicar los valores hexadecimales en TypeScript los dejaría desincronizados
 * en el primer ajuste de paleta, que es justo el momento en que hay que medir.
 *
 * Devuelve el nombre sin el prefijo `--color-`: `{ "primary-500": "#187aae" }`.
 */
export function parseThemeColors(css: string): Record<string, string> {
  const colores: Record<string, string> = {};
  const patron = /--color-([a-z0-9-]+)\s*:\s*(#[0-9a-fA-F]{3,8})\s*;/g;
  for (const coincidencia of css.matchAll(patron)) {
    const nombre = coincidencia[1];
    const valor = coincidencia[2];
    if (nombre === undefined || valor === undefined) continue;
    colores[nombre] = valor.toLowerCase();
  }
  return colores;
}
