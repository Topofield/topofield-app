import Link from "next/link";
import { cn } from "@/lib/utils/cn";

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface ResolvedItem extends BreadcrumbItem {
  current: boolean;
}

export interface ResolvedBreadcrumbs {
  trail: ResolvedItem[];
  /** Nivel anterior al actual, para el retorno en móvil. */
  parent: BreadcrumbItem | null;
}

/** Decide qué elemento es el actual y cuál el anterior. Función pura. */
export function resolveBreadcrumbs(
  items: BreadcrumbItem[],
): ResolvedBreadcrumbs {
  const clean = items.filter((i) => i.label.trim() !== "");
  const trail = clean.map((item, i) => {
    const isLast = i === clean.length - 1;
    return {
      label: item.label,
      href: isLast ? undefined : item.href,
      current: isLast,
    };
  });
  const parent = clean.length > 1 ? clean[clean.length - 2] : null;
  return { trail, parent: parent ?? null };
}

/**
 * Ruta de navegación entre los tres niveles de la aplicación
 * (dashboard → proyecto → proceso). En móvil se reduce al retorno al nivel
 * anterior, que es el control que hace falta en pantalla pequeña.
 */
export function Breadcrumbs({
  items,
  className,
}: {
  items: BreadcrumbItem[];
  className?: string;
}) {
  const { trail, parent } = resolveBreadcrumbs(items);
  if (trail.length === 0) return null;

  return (
    <nav aria-label="Ruta de navegación" className={cn("min-w-0", className)}>
      {/* Móvil: solo el retorno al nivel anterior. */}
      {parent?.href && (
        <Link
          href={parent.href}
          className="inline-flex items-center gap-1 text-sm font-medium text-ink underline-offset-2 hover:underline sm:hidden"
        >
          <span aria-hidden>‹</span>
          <span className="truncate">{parent.label}</span>
        </Link>
      )}

      {/* Escritorio: ruta completa. En móvil, se muestra también aquí si no
          hay retorno (parent?.href) que la reemplace. */}
      <ol
        className={cn(
          "min-w-0 items-center gap-1.5 text-sm sm:flex",
          parent?.href ? "hidden" : "flex",
        )}
      >
        {trail.map((item, i) => (
          <li key={`${item.label}-${i}`} className="flex min-w-0 items-center gap-1.5">
            {i > 0 && (
              <span aria-hidden className="text-ink-3">
                ›
              </span>
            )}
            {item.href ? (
              <Link
                href={item.href}
                title={item.label}
                className="max-w-[16rem] truncate text-ink-2 transition-colors hover:text-ink"
              >
                {item.label}
              </Link>
            ) : (
              <span
                aria-current="page"
                title={item.label}
                className="max-w-[20rem] truncate font-medium text-ink"
              >
                {item.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
