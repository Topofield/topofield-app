/**
 * Las parejas color-sobre-color que el sistema de diseño usa realmente.
 *
 * Esta tabla es el contrato de tokens en forma de datos: cada fila declara un
 * primer plano, su fondo y el umbral que debe cumplir. La página
 * `/design-system` la mide y la muestra.
 *
 * Al añadir una pareja nueva —un `Badge` con un tono nuevo, un botón sobre un
 * fondo teñido— se declara aquí. Ver
 * `docs/specs/2026-07-28-sistema-diseno-design.md` § 2.2.
 */

import {
  AA_GRAFICO,
  AA_TEXTO,
  composite,
  contrastRatio,
} from "./contrast";

/** Los tres contextos de la regla, más el de elementos gráficos. */
export type Contexto =
  | "texto-sobre-blanco"
  | "texto-sobre-tinte"
  | "fondo-bajo-texto-blanco"
  | "grafico";

export const CONTEXTO_LABELS: Record<Contexto, string> = {
  "texto-sobre-blanco": "Texto sobre blanco",
  "texto-sobre-tinte": "Texto sobre su propio fondo teñido",
  "fondo-bajo-texto-blanco": "Fondo bajo texto blanco",
  grafico: "Elemento gráfico (punto, borde)",
};

export interface Pairing {
  /** Token o hexadecimal literal del primer plano. */
  fg: string;
  /** Token o hexadecimal literal del fondo. */
  bg: string;
  /** Si el fondo es un tinte, su alfa; se compone sobre `bgBase`. */
  bgAlpha?: number;
  /** Base del tinte. Por omisión, blanco. */
  bgBase?: string;
  contexto: Contexto;
  umbral: number;
  /** Dónde se usa, para poder ir a arreglarlo si falla. */
  donde: string;
  /**
   * Se mide y se muestra, pero no cuenta como incumplimiento: WCAG lo exime.
   * El motivo va en `exencion`.
   */
  informativo?: boolean;
  exencion?: string;
}

export const BLANCO = "#ffffff";

export const PAIRINGS: Pairing[] = [
  // ── Texto sobre blanco ──────────────────────────────────────────────────
  {
    fg: "primary-500",
    bg: BLANCO,
    contexto: "texto-sobre-blanco",
    umbral: AA_TEXTO,
    donde: "Enlaces, Breadcrumbs (hover)",
  },
  {
    fg: "primary-600",
    bg: BLANCO,
    contexto: "texto-sobre-blanco",
    umbral: AA_TEXTO,
    donde: "Títulos h1–h3, Tabs activa, Button secundario",
  },
  {
    fg: "primary-700",
    bg: BLANCO,
    contexto: "texto-sobre-blanco",
    umbral: AA_TEXTO,
    donde: "Logo (palabra)",
  },
  {
    fg: "danger-500",
    bg: BLANCO,
    contexto: "texto-sobre-blanco",
    umbral: AA_TEXTO,
    donde: "Input/Select/Textarea (mensaje de error)",
  },
  {
    fg: "success-500",
    bg: BLANCO,
    contexto: "texto-sobre-blanco",
    umbral: AA_TEXTO,
    donde: "Veredicto de cierre conforme",
  },
  {
    fg: "warning-500",
    bg: BLANCO,
    contexto: "texto-sobre-blanco",
    umbral: AA_TEXTO,
    donde: "Avisos de tolerancia",
  },
  {
    fg: "neutral-500",
    bg: BLANCO,
    contexto: "texto-sobre-blanco",
    umbral: AA_TEXTO,
    donde: "KpiCard (etiqueta), Tabs inactiva, texto secundario",
  },
  {
    fg: "neutral-800",
    bg: BLANCO,
    contexto: "texto-sobre-blanco",
    umbral: AA_TEXTO,
    donde: "Etiquetas de formulario, StatusIndicator",
  },
  {
    fg: "neutral-900",
    bg: BLANCO,
    contexto: "texto-sobre-blanco",
    umbral: AA_TEXTO,
    donde: "Valor de KpiCard, texto de campos",
  },

  // ── Texto sobre su propio fondo teñido ──────────────────────────────────
  // El caso que falló: el fondo efectivo es el token al 10 % sobre blanco.
  {
    fg: "success-500",
    bg: "success-500",
    bgAlpha: 0.1,
    contexto: "texto-sobre-tinte",
    umbral: AA_TEXTO,
    donde: "Badge tono success",
  },
  {
    fg: "warning-500",
    bg: "warning-500",
    bgAlpha: 0.1,
    contexto: "texto-sobre-tinte",
    umbral: AA_TEXTO,
    donde: "Badge tono warning",
  },
  {
    fg: "danger-500",
    bg: "danger-500",
    bgAlpha: 0.1,
    contexto: "texto-sobre-tinte",
    umbral: AA_TEXTO,
    donde: "Badge tono danger, Alert variante error",
  },
  {
    fg: "primary-700",
    bg: "primary-50",
    contexto: "texto-sobre-tinte",
    umbral: AA_TEXTO,
    donde: "Badge tono primary, Alert variante info",
  },
  {
    fg: "neutral-800",
    bg: "neutral-100",
    contexto: "texto-sobre-tinte",
    umbral: AA_TEXTO,
    donde: "Badge tono neutral",
  },
  {
    fg: "neutral-900",
    bg: "success-500",
    bgAlpha: 0.1,
    contexto: "texto-sobre-tinte",
    umbral: AA_TEXTO,
    donde: "Alert variante success (texto neutro sobre tinte verde)",
  },
  {
    fg: "neutral-900",
    bg: "warning-500",
    bgAlpha: 0.1,
    contexto: "texto-sobre-tinte",
    umbral: AA_TEXTO,
    donde: "Alert variante warning",
  },
  {
    fg: "neutral-900",
    bg: "neutral-50",
    contexto: "texto-sobre-tinte",
    umbral: AA_TEXTO,
    donde: "Cuerpo de la aplicación (body)",
  },

  // ── Fondo bajo texto blanco ─────────────────────────────────────────────
  {
    fg: BLANCO,
    bg: "primary-500",
    contexto: "fondo-bajo-texto-blanco",
    umbral: AA_TEXTO,
    donde: "Button primario, chip de filtro activo",
  },
  {
    fg: BLANCO,
    bg: "primary-600",
    contexto: "fondo-bajo-texto-blanco",
    umbral: AA_TEXTO,
    donde: "Button primario (hover)",
  },
  {
    fg: BLANCO,
    bg: "primary-700",
    contexto: "fondo-bajo-texto-blanco",
    umbral: AA_TEXTO,
    donde: "Button primario (active)",
  },
  {
    fg: BLANCO,
    bg: "danger-500",
    contexto: "fondo-bajo-texto-blanco",
    umbral: AA_TEXTO,
    donde: "Button variante danger",
  },
  {
    fg: "neutral-500",
    bg: "neutral-200",
    contexto: "fondo-bajo-texto-blanco",
    umbral: AA_TEXTO,
    donde: "Button deshabilitado (texto neutral-500 sobre neutral-200)",
    informativo: true,
    exencion:
      "WCAG 1.4.3 exime los componentes de interfaz inactivos: un control deshabilitado no tiene requisito de contraste. Se mide para saber el dato, no para corregirlo.",
  },

  // ── Elementos gráficos: umbral 3:1 ──────────────────────────────────────
  {
    fg: "success-500",
    bg: BLANCO,
    contexto: "grafico",
    umbral: AA_GRAFICO,
    donde: "StatusIndicator punto «ok»",
  },
  {
    fg: "warning-500",
    bg: BLANCO,
    contexto: "grafico",
    umbral: AA_GRAFICO,
    donde: "StatusIndicator punto «warning»",
  },
  {
    fg: "danger-500",
    bg: BLANCO,
    contexto: "grafico",
    umbral: AA_GRAFICO,
    donde: "StatusIndicator punto «danger»",
  },
  {
    fg: "primary-500",
    bg: BLANCO,
    contexto: "grafico",
    umbral: AA_GRAFICO,
    donde: "Foco visible (outline), borde de Tabs activa",
  },
  {
    fg: "neutral-200",
    bg: BLANCO,
    contexto: "grafico",
    umbral: AA_GRAFICO,
    donde: "Borde de Input/Select/Textarea — límite del control",
  },

  // ── Semáforo de asentamientos (fase 5, sin verificar hasta ahora) ───────
  {
    fg: "semaphore-green",
    bg: BLANCO,
    contexto: "grafico",
    umbral: AA_GRAFICO,
    donde: "Semáforo de asentamientos — fase 5",
  },
  {
    fg: "semaphore-yellow",
    bg: BLANCO,
    contexto: "grafico",
    umbral: AA_GRAFICO,
    donde: "Semáforo de asentamientos — fase 5",
  },
  {
    fg: "semaphore-orange",
    bg: BLANCO,
    contexto: "grafico",
    umbral: AA_GRAFICO,
    donde: "Semáforo de asentamientos — fase 5",
  },
  {
    fg: "semaphore-red",
    bg: BLANCO,
    contexto: "grafico",
    umbral: AA_GRAFICO,
    donde: "Semáforo de asentamientos — fase 5",
  },
];

export interface Medicion extends Pairing {
  /** Hexadecimal resuelto del primer plano. */
  fgHex: string;
  /** Hexadecimal resuelto del fondo, ya compuesto si era un tinte. */
  bgHex: string;
  ratio: number;
  cumple: boolean;
}

/**
 * Resuelve y mide cada pareja contra los tokens leídos de `globals.css`.
 * Un token ausente en la hoja de estilos se omite en lugar de romper la
 * página: el objetivo es diagnosticar, no fallar.
 */
export function medirPairings(
  tokens: Record<string, string>,
  pairings: Pairing[] = PAIRINGS,
): Medicion[] {
  const resolver = (nombre: string): string | null =>
    nombre.startsWith("#") ? nombre : (tokens[nombre] ?? null);

  const medidas: Medicion[] = [];

  for (const p of pairings) {
    const fgHex = resolver(p.fg);
    const bgBruto = resolver(p.bg);
    if (!fgHex || !bgBruto) continue;

    const base = resolver(p.bgBase ?? BLANCO) ?? BLANCO;
    const bgHex =
      p.bgAlpha === undefined
        ? bgBruto
        : compositeSeguro(bgBruto, p.bgAlpha, base);

    const ratio = ratioSeguro(fgHex, bgHex);
    medidas.push({ ...p, fgHex, bgHex, ratio, cumple: ratio >= p.umbral });
  }

  return medidas;
}

// Envoltorios que aíslan la página de un token con formato inesperado.

function compositeSeguro(color: string, alpha: number, base: string): string {
  try {
    return composite(color, alpha, base);
  } catch {
    return base;
  }
}

function ratioSeguro(a: string, b: string): number {
  try {
    return contrastRatio(a, b);
  } catch {
    return 0;
  }
}
