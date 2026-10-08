"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type ReactNode } from "react";
import { Alert, Breadcrumbs, Button, buttonClasses, Modal } from "@/components/design-system";
import { PrintButton } from "@/components/reports/print-button";
import { callAction } from "@/lib/errors/action-call";
import { formatSavedAt } from "@/lib/utils/format";
import type { DraftSaveResult } from "./use-process-draft";

interface ProcessHeaderProps {
  projectName: string;
  /** El hub del proyecto, en el módulo del proceso: a donde vuelven las migas y el borrado. */
  hubHref: string;
  title: string;
  badges: ReactNode;
  location: string | null;
  /** «Responsable · Cargo», ya armado; vacío si no hay ninguno. */
  responsible: string;
  /** La línea del equipo, o `null` sin equipo. */
  equipment: string | null;
  updatedAt: string;
  exportHref: string;
  /** En el paso de Informe, las primeras acciones: Exportar PDF y Exportar Excel (Fase 38). */
  printable?: boolean;
  /** Una acción propia del módulo, la primera: «+ Nueva visita» del lugar (Fase 37). */
  primaryAction?: ReactNode;
  onEdit: () => void;
  duplicate: () => Promise<DraftSaveResult>;
  remove: () => Promise<DraftSaveResult>;
  /** «la poligonal», «la nivelación»: para los errores de duplicar y eliminar. */
  subject: string;
  /** «Eliminar poligonal», «Eliminar nivelación». */
  deleteTitle: string;
  /** Qué se pierde: «con sus mediciones», «con su libreta». */
  deleteWhat: string;
  /** Los diálogos propios del módulo, como «Editar datos». */
  children?: ReactNode;
}

/**
 * La cabecera de un proceso por pasos (Fases 35 y 36): badges, título,
 * ubicación, responsable, equipo y «Guardado …», y las acciones Editar datos,
 * Duplicar y Eliminar. En la página de informe, primero Exportar PDF y
 * Exportar Excel: se exporta solo desde ahí (Fase 38). Sin cerrar ni reabrir.
 * Es un `<header>`: no se imprime.
 */
export function ProcessHeader({
  projectName,
  hubHref,
  title,
  badges,
  location,
  responsible,
  equipment,
  updatedAt,
  exportHref,
  printable = false,
  primaryAction,
  onEdit,
  duplicate,
  remove,
  subject,
  deleteTitle,
  deleteWhat,
  children,
}: ProcessHeaderProps) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function run(action: () => Promise<DraftSaveResult>, fallback: string) {
    setError(null);
    startTransition(async () => {
      const r = await callAction(action);
      if (r.ok) router.push(hubHref);
      else setError(r.error ?? fallback);
    });
  }

  return (
    <header className="flex flex-col gap-3 rounded-lg border border-rule bg-card px-5 py-4 shadow-sm print:hidden">
      <Breadcrumbs
        items={[
          { label: "Dashboard", href: "/dashboard" },
          { label: projectName, href: hubHref },
          { label: title },
        ]}
      />
      <div className="flex flex-wrap items-center gap-2">{badges}</div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1.5">
          <h1 className="font-display text-2xl font-bold leading-tight sm:text-3xl">{title}</h1>
          <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-ink-2">
            {location && <span>{location}</span>}
            {responsible && <span>{responsible}</span>}
            {equipment && <span>{equipment}</span>}
            {/* Cada popup guarda al confirmar: no hay botón Guardar. */}
            <span>Guardado {formatSavedAt(updatedAt)}</span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {printable && (
            <>
              <PrintButton size="sm" documentTitle={`${title} — ${projectName}`} />
              <a href={exportHref} className={buttonClasses({ variant: "secondary", size: "sm" })} download>
                Exportar Excel
              </a>
            </>
          )}
          {primaryAction}
          <Button variant="secondary" size="sm" onClick={onEdit}>
            Editar datos
          </Button>
          <details className="relative">
            <summary
              aria-label="Más acciones"
              className={`${buttonClasses({ variant: "ghost", size: "sm" })} cursor-pointer list-none`}
            >
              ⋯
            </summary>
            <div className="absolute right-0 z-20 mt-1 flex w-44 flex-col rounded-md border border-rule bg-card p-1 shadow-lg">
              <button
                type="button"
                className="rounded px-3 py-2 text-left text-sm hover:bg-sel"
                onClick={() => run(duplicate, `No se pudo duplicar ${subject}.`)}
                disabled={isPending}
              >
                Duplicar
              </button>
              <button
                type="button"
                className="rounded px-3 py-2 text-left text-sm text-danger hover:bg-sel"
                onClick={() => setDeleting(true)}
              >
                Eliminar
              </button>
            </div>
          </details>
        </div>
      </div>
      {error && <Alert variant="error">{error}</Alert>}

      {children}
      <Modal
        open={deleting}
        onClose={() => setDeleting(false)}
        title={deleteTitle}
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleting(false)}>
              Cancelar
            </Button>
            <Button variant="danger" onClick={() => run(remove, `No se pudo eliminar ${subject}.`)} disabled={isPending}>
              {isPending ? "Eliminando…" : "Eliminar"}
            </Button>
          </>
        }
      >
        <p className="text-sm text-ink-2">
          Se eliminará «{title}» {deleteWhat}. Esta acción no se puede deshacer.
        </p>
      </Modal>
    </header>
  );
}
