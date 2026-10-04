"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils/cn";

/** ¿Es `href` la sección de `pathname`: la misma ruta o una que cuelga de ella? */
export function isSectionActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Enlace de la barra (Fase 33): icono, y su nombre a partir de 640 px. En el
 * teléfono el nombre sigue siendo el nombre accesible del enlace. La sección
 * en la que se está lleva la raya de mira de las pestañas, sobre el borde de
 * la barra.
 */
export function AppBarLink({
  href,
  icon,
  label,
}: {
  href: string;
  icon: ReactNode;
  label: string;
}) {
  const active = isSectionActive(usePathname() ?? "", href);
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "relative flex h-9 items-center gap-1.5 rounded-md px-2 text-sm font-medium transition-colors hover:bg-sel",
        active ? "text-ink" : "text-ink-2 hover:text-ink",
        active && "after:absolute after:inset-x-2 after:-bottom-1.5 after:h-0.5 after:bg-mira-strong",
      )}
    >
      {icon}
      <span className="sr-only sm:not-sr-only">{label}</span>
    </Link>
  );
}
