import Link from "next/link";
import { cn } from "@/lib/utils/cn";

export interface BreadcrumbMenuEntry {
  label: string;
  href: string;
  hint?: string;
  current?: boolean;
}

export interface BreadcrumbItem {
  label: string;
  href?: string;
  /**
   * Los hermanos de este nivel, para saltar a otro (Fase 44): otros proyectos,
   * otros procesos. Con menos de dos entradas no se ofrece.
   */
  menu?: { label: string; entries: BreadcrumbMenuEntry[] };
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
      ...(item.menu && item.menu.entries.length > 1 && { menu: item.menu }),
    };
  });
  const parent = clean.length > 1 ? clean[clean.length - 2] : null;
  return { trail, parent: parent ?? null };
}

/**
 * Ruta de navegación entre los tres niveles de la aplicación
 * (dashboard → proyecto → proceso). En móvil se reduce al retorno al nivel
 * anterior, que es el control que hace falta en pantalla pequeña.
 *
 * Va dentro de la barra fija (Fase 33). La pinta cada página en el servidor,
 * porque solo ella conoce los nombres del proyecto y del proceso, y el CSS la
 * coloca sobre la barra: `fixed`, arriba, en el hueco que marcan
 * `--ruta-inicio` y `--ruta-fin` (`globals.css`). Así no hay JavaScript, ni
 * parpadeo al cargar, ni salto del contenido. Una raya corta la separa del
 * logo.
 *
 * Una miga con `menu` lleva al lado un botón que abre a sus hermanos (Fase
 * 44): un panel con el atributo `popover`, como el menú de cuenta, que se
 * cierra al tocar fuera o con Esc. No se puede anclar a la miga sin CSS que
 * no todos los navegadores tienen, así que cuelga de la barra, alineado con
 * el inicio de la ruta. La `key` del `<nav>` cambia con la página: al navegar
 * desde el menú, el panel abierto se desmonta y se cierra. En el teléfono la
 * ruta se reduce al retorno, sin menús. La miga actual no se encoge antes que
 * las anteriores: es lo que más hay que leer.
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
    <nav
      key={trail.map((t) => t.href ?? t.label).join("|")}
      aria-label="Ruta de navegación"
      className={cn(
        "fixed top-0 right-(--ruta-fin) left-(--ruta-inicio) z-45 flex h-(--barra-alto) min-w-0 items-center",
        "before:mr-3 before:h-5 before:w-px before:shrink-0 before:bg-rule",
        className,
      )}
    >
      {/* Móvil: solo el retorno al nivel anterior. */}
      {parent?.href && (
        <Link
          href={parent.href}
          className="inline-flex min-w-0 max-w-full items-center gap-1 text-sm font-medium text-ink underline-offset-2 hover:underline sm:hidden"
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
          <li
            key={`${item.label}-${i}`}
            className={cn("flex min-w-0 items-center gap-1.5", item.current && "max-w-[60%] shrink-0")}
          >
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
            {item.menu && <RouteMenu id={`ruta-menu-${i}`} {...item.menu} />}
          </li>
        ))}
      </ol>
    </nav>
  );
}

/** El botón ▾ de una miga y su panel con los hermanos de ese nivel. */
function RouteMenu({ id, label, entries }: { id: string; label: string; entries: BreadcrumbMenuEntry[] }) {
  return (
    <>
      <button
        type="button"
        popoverTarget={id}
        aria-label={label}
        title={label}
        className="-ml-0.5 flex h-6 w-5 shrink-0 items-center justify-center rounded text-ink-3 transition-colors hover:bg-sel hover:text-ink"
      >
        <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="m3 4.5 3 3 3-3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      <div
        id={id}
        popover="auto"
        aria-label={label}
        className="fixed inset-auto top-[calc(var(--barra-alto)+0.375rem)] left-(--ruta-inicio) m-0 max-h-[min(60vh,28rem)] w-80 max-w-[calc(100vw-2rem)] overflow-y-auto rounded-lg border border-rule bg-card p-1 text-ink shadow-lg"
      >
        <p className="px-3 pt-2 pb-1 text-xs text-ink-2">{label}</p>
        <ul>
          {entries.map((entry) => (
            <li key={entry.href}>
              <Link
                href={entry.href}
                title={entry.label}
                aria-current={entry.current ? "page" : undefined}
                className={cn(
                  "flex items-baseline justify-between gap-3 rounded-md px-3 py-2 text-sm transition-colors hover:bg-sel",
                  entry.current && "bg-mira-bg font-medium",
                )}
              >
                <span className="truncate">{entry.label}</span>
                {entry.hint && <span className="shrink-0 text-xs text-ink-2">{entry.hint}</span>}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
