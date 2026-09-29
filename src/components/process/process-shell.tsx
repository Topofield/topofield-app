import Link from "next/link";
import type { ReactNode } from "react";
import {
  buttonClasses,
  PageHeader,
  Tabs,
  type BreadcrumbItem,
  type TabItem,
} from "@/components/design-system";
import { tabHref } from "@/components/design-system/tabs";
import { PrintButton } from "@/components/reports/print-button";

interface ProcessShellProps {
  breadcrumbs: BreadcrumbItem[];
  title: string;
  /** Badge de estado, junto al título. */
  badge: ReactNode;
  subtitle?: ReactNode;
  /** Ruta de la pantalla; las pestañas enlazan a `?tab=<id>`. */
  basePath: string;
  tabs: TabItem[];
  activeTab: string;
  /** Id de la pestaña del informe: en ella la acción de la cabecera es imprimir. */
  reportTab: string;
  /** Descarga del libro de Excel (Route Handler). */
  exportHref: string;
  /** Acciones propias del módulo, antes de Excel e Informe. */
  actions?: ReactNode;
  children: ReactNode;
}

/**
 * La pantalla de un proceso (Fase 22): la misma cabecera y las mismas
 * pestañas en poligonal, nivelación y control de asentamientos.
 *
 * La cabecera siempre ofrece Exportar a Excel y el informe: fuera de la
 * pestaña Informe, «Ver informe» lleva a ella; dentro, la acción es imprimir.
 * No es del sistema de diseño: conoce el dominio (proceso, informe, Excel).
 */
export function ProcessShell({
  breadcrumbs,
  title,
  badge,
  subtitle,
  basePath,
  tabs,
  activeTab,
  reportTab,
  exportHref,
  actions,
  children,
}: ProcessShellProps) {
  const onReport = activeTab === reportTab;
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        breadcrumbs={breadcrumbs}
        title={title}
        badge={badge}
        subtitle={subtitle}
        actions={
          <>
            {actions}
            {/* Descarga directa: una Route Handler que devuelve el .xlsx, no
                una navegación. Disponible en cualquier estado (§ 4.8). */}
            <a
              href={exportHref}
              className={buttonClasses({ variant: "secondary", size: "sm" })}
              download
            >
              Exportar a Excel
            </a>
            {onReport ? (
              <PrintButton size="sm" />
            ) : (
              <Link
                href={tabHref(basePath, reportTab)}
                className={buttonClasses({ variant: "secondary", size: "sm" })}
              >
                Ver informe
              </Link>
            )}
          </>
        }
      />
      <div className="print:hidden">
        <Tabs items={tabs} activeId={activeTab} basePath={basePath} />
      </div>
      {children}
    </div>
  );
}
