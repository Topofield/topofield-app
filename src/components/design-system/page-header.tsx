import type { ReactNode } from "react";
import { Breadcrumbs, type BreadcrumbItem } from "./breadcrumbs";

interface PageHeaderProps {
  /** Ruta de navegación sobre el título. */
  breadcrumbs?: BreadcrumbItem[];
  title: ReactNode;
  /** Línea bajo el título: tipo, fecha, amarre, cliente… */
  subtitle?: ReactNode;
  /** Junto al título, normalmente el badge de estado. */
  badge?: ReactNode;
  /** Acciones de la página, a la derecha (debajo en móvil). */
  actions?: ReactNode;
  /** Contenido bajo la línea del título: veredicto, leyenda, avisos. */
  children?: ReactNode;
}

/**
 * Cabecera de página (Fase 22): migas, título con su badge, subtítulo y
 * acciones, cerrada por la raya de tinta del prototipo. Cada pantalla la
 * armaba a mano, con tamaños y pesos distintos.
 *
 * La línea del título es un `<header>`: al imprimir se oculta con el resto de
 * la navegación (`globals.css` oculta todo `header` y `nav`).
 */
export function PageHeader({
  breadcrumbs,
  title,
  subtitle,
  badge,
  actions,
  children,
}: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-4">
      {breadcrumbs && breadcrumbs.length > 0 && <Breadcrumbs items={breadcrumbs} />}
      <header className="flex flex-col gap-3 border-b-2 border-ink pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h1 className="text-2xl font-semibold">{title}</h1>
            {badge}
          </div>
          {subtitle && <div className="mt-1 text-sm text-ink-2">{subtitle}</div>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </header>
      {children}
    </div>
  );
}
