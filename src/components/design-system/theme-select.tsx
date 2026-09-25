"use client";

import { useState } from "react";
import { cn } from "@/lib/utils/cn";
import {
  THEME_CHOICES,
  THEME_LABELS,
  themeAttribute,
  themeCookie,
  type ThemeChoice,
} from "@/lib/theme";

/**
 * Selector de tema: Sistema / Claro / Oscuro (Fase 20).
 *
 * En la cabecera no cabe un `<select>` visible junto al logo, «Manual» y
 * «Cerrar sesión» en 390 px. Se ve un icono, y encima va un `<select>` nativo
 * transparente: al tocarlo aparecen las tres opciones con su nombre en el
 * selector del sistema operativo, y sigue siendo un control con etiqueta. El
 * foco se dibuja en el contenedor, porque el `<select>` es invisible.
 *
 * Aplica el tema al instante sobre `<html>` y guarda la cookie que el layout
 * raíz leerá en la siguiente carga.
 */
export function ThemeSelect({
  initial,
  className,
}: {
  initial: ThemeChoice;
  className?: string;
}) {
  const [choice, setChoice] = useState<ThemeChoice>(initial);

  function apply(next: ThemeChoice) {
    setChoice(next);
    const attr = themeAttribute(next);
    if (attr) document.documentElement.dataset.theme = attr;
    else delete document.documentElement.dataset.theme;
    document.cookie = themeCookie(next, window.location.protocol === "https:");
  }

  const label = `Tema: ${THEME_LABELS[choice]}`;

  return (
    <span
      title={label}
      className={cn(
        "relative inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-ink-2 transition-colors hover:bg-sel hover:text-ink",
        "has-[select:focus-visible]:outline-2 has-[select:focus-visible]:outline-offset-2 has-[select:focus-visible]:outline-mira-strong",
        className,
      )}
    >
      <ThemeIcon choice={choice} />
      <select
        aria-label="Tema"
        value={choice}
        onChange={(e) => apply(e.target.value as ThemeChoice)}
        className="absolute inset-0 cursor-pointer appearance-none opacity-0"
      >
        {THEME_CHOICES.map((c) => (
          <option key={c} value={c}>
            {THEME_LABELS[c]}
          </option>
        ))}
      </select>
    </span>
  );
}

/** Sol, luna, o un círculo a medias para «sistema». */
function ThemeIcon({ choice }: { choice: ThemeChoice }) {
  const common = {
    width: 18,
    height: 18,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.75,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
  if (choice === "light") {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
      </svg>
    );
  }
  if (choice === "dark") {
    return (
      <svg {...common}>
        <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 4a8 8 0 0 1 0 16Z" fill="currentColor" />
    </svg>
  );
}
