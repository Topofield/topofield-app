/**
 * Las parejas color-sobre-color que el sistema de diseño usa realmente.
 *
 * Esta tabla es el contrato de tokens en forma de datos: cada fila declara un
 * primer plano, su fondo y el umbral que debe cumplir, y vale para los dos
 * temas. `pairings.test.ts` la mide en claro y en oscuro contra el
 * `globals.css` real y falla si una pareja no cumple (Fase 20); la página
 * `/design-system` la muestra.
 *
 * Al añadir una pareja nueva —un `Badge` con un tono nuevo, un botón sobre un
 * fondo teñido— se declara aquí.
 */

import {
  AA_GRAFICO,
  AA_TEXTO,
  composite,
  contrastRatio,
} from "./contrast";

/**
 * Los contextos de la regla (Fase 20: tokens por rol). Antes el fondo de
 * referencia era el blanco; ahora cada pareja nombra su superficie —papel,
 * tarjeta, selección— porque cambia con el tema.
 */
export type Contexto =
  | "texto-sobre-superficie"
  | "texto-sobre-tinte"
  | "texto-sobre-relleno"
  | "grafico";

export const CONTEXTO_LABELS: Record<Contexto, string> = {
  "texto-sobre-superficie": "Texto sobre papel, tarjeta o selección",
  "texto-sobre-tinte": "Texto sobre un fondo teñido de estado",
  "texto-sobre-relleno": "Texto sobre un relleno (botones)",
  grafico: "Elemento gráfico (punto, borde, foco)",
};

export interface Pairing {
  /** Token (sin `--color-`) o hexadecimal literal del primer plano. */
  fg: string;
  /** Token o hexadecimal literal del fondo. */
  bg: string;
  /** Si el fondo es un tinte, su alfa; se compone sobre `bgBase`. */
  bgAlpha?: number;
  /** Base del tinte. Por omisión, la tarjeta del tema. */
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

const texto = (fg: string, bg: string, donde: string): Pairing => ({
  fg,
  bg,
  contexto: "texto-sobre-superficie",
  umbral: AA_TEXTO,
  donde,
});
const tinte = (fg: string, bg: string, donde: string): Pairing => ({
  fg,
  bg,
  contexto: "texto-sobre-tinte",
  umbral: AA_TEXTO,
  donde,
});
const grafico = (fg: string, bg: string, donde: string): Pairing => ({
  fg,
  bg,
  contexto: "grafico",
  umbral: AA_GRAFICO,
  donde,
});

const SEMAFORO = ["semaphore-green", "semaphore-yellow", "semaphore-orange", "semaphore-red"];

/**
 * Se miden en los DOS temas con la misma tabla: `pairings.test.ts` lee
 * `globals.css` y exige que todas cumplan en claro y en oscuro.
 */
export const PAIRINGS: Pairing[] = [
  // ── Texto sobre superficie ──────────────────────────────────────────────
  texto("ink", "card", "Cuerpo, títulos, valores de tabla y de KPI"),
  texto("ink", "paper", "Cuerpo y títulos sobre el fondo de página"),
  texto("ink-2", "card", "Texto secundario, etiquetas, cabeceras de tabla"),
  texto("ink-2", "paper", "Texto secundario sobre el fondo de página"),
  texto("ink-3", "card", "Texto terciario: notas, marcas de tiempo"),
  texto("ink-3", "paper", "Texto terciario sobre el fondo de página"),
  texto("ink", "sel", "Fila seleccionada o resaltada"),
  texto("ink-2", "sel", "Texto secundario en una fila seleccionada"),
  texto("danger", "card", "Mensaje de error de un campo"),
  texto("success", "card", "Veredicto de cierre conforme"),
  texto("warning", "card", "Avisos de tolerancia y de captura"),

  // ── Texto sobre un tinte de estado ──────────────────────────────────────
  tinte("success", "success-bg", "Badge y Alert de éxito"),
  tinte("warning", "warning-bg", "Badge y Alert de aviso"),
  tinte("danger", "danger-bg", "Badge y Alert de error"),
  tinte("ink", "success-bg", "Cuerpo de un Alert de éxito"),
  tinte("ink", "warning-bg", "Cuerpo de un Alert de aviso"),
  tinte("ink", "danger-bg", "Cuerpo de un Alert de error"),
  tinte("mira-ink", "mira-bg", "Badge destacado, título de nota del manual"),
  tinte("ink", "mira-bg", "Cuerpo de las notas destacadas del manual"),

  // ── Texto sobre un relleno ──────────────────────────────────────────────
  {
    fg: "on-mira",
    bg: "mira",
    contexto: "texto-sobre-relleno",
    umbral: AA_TEXTO,
    donde: "Button primario, chip de filtro activo",
  },
  {
    fg: "on-danger",
    bg: "danger",
    contexto: "texto-sobre-relleno",
    umbral: AA_TEXTO,
    donde: "Button variante danger",
  },

  // ── Elementos gráficos: umbral 3:1 ──────────────────────────────────────
  grafico("rule-strong", "card", "Borde de Input/Select/Textarea/DmsInput — límite del control"),
  grafico("rule-strong", "paper", "Borde de control sobre el fondo de página"),
  grafico("mira-strong", "card", "Foco visible (outline), pestaña activa, filete de selección"),
  grafico("mira-strong", "paper", "Foco visible sobre el fondo de página"),
  grafico("success", "card", "StatusIndicator punto «ok»"),
  grafico("warning", "card", "StatusIndicator punto «warning»"),
  grafico("danger", "card", "StatusIndicator punto «danger»"),
  ...SEMAFORO.map((t) => grafico(t, "card", "Semáforo de asentamientos (Fase 5)")),
  ...SEMAFORO.map((t) => grafico(t, "paper", "Semáforo sobre el fondo de página")),
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

    const base = resolver(p.bgBase ?? "card") ?? "#ffffff";
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
