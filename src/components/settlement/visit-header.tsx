"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Alert, Badge, Breadcrumbs, Button, buttonClasses, Modal } from "@/components/design-system";
import { deleteVisitAction, saveVisitAction } from "@/app/(app)/projects/[id]/settlement/[siteId]/actions";
import { callAction } from "@/lib/errors/action-call";
import type { RouteMenus } from "@/lib/route-menus";
import { formatSavedAt } from "@/lib/utils/format";
import type { BookRowPayload, VisitStatus } from "@/types/settlement";
import { VisitDialog } from "./visit-dialog";
import type { VisitForm } from "./visit-dialog-form";

/**
 * La cabecera de una visita (Fase 37, lienzo «Visita»): insignias —armadas,
 * verificación, «En medición»—, «Visita N · fecha», el nivelador y el equipo,
 * y las acciones ← →, «Editar datos» y eliminar. Cualquier visita se elimina.
 */
export function VisitHeader({
  projectId,
  projectName,
  menus,
  siteId,
  siteName,
  visitId,
  visitNumber,
  dateLabel,
  operator,
  equipment,
  updatedAt,
  armadas,
  verification,
  status,
  prevHref,
  nextHref,
  initial,
  book,
}: {
  projectId: string;
  projectName: string;
  /** Los menús de la ruta (Fase 44). */
  menus?: RouteMenus;
  siteId: string;
  siteName: string;
  visitId: string;
  visitNumber: number;
  dateLabel: string;
  operator: string | null;
  equipment: string | null;
  updatedAt: string;
  armadas: number;
  /** «Segundo orden», «Sin verificación» o null sin libreta. */
  verification: string | null;
  status: VisitStatus;
  prevHref: string | null;
  nextHref: string | null;
  initial: VisitForm;
  book: BookRowPayload[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const siteHref = `/projects/${projectId}/settlement/${siteId}`;
  const title = `Visita ${visitNumber}`;

  function remove() {
    setError(null);
    startTransition(async () => {
      const r = await callAction(() => deleteVisitAction(projectId, siteId, visitId));
      if (r.ok) router.push(siteHref);
      else setError(r.error ?? "No se pudo eliminar la visita.");
    });
  }

  return (
    <header className="flex flex-col gap-3 rounded-lg border border-rule bg-card px-5 py-4 shadow-sm print:hidden">
      <Breadcrumbs
        items={[
          { label: "Dashboard", href: "/dashboard" },
          {
            label: projectName,
            href: `/projects/${projectId}?tab=processes&modulo=asentamientos`,
            menu: menus && { label: "Otros proyectos", entries: menus.projects },
          },
          { label: siteName, href: siteHref, menu: menus && { label: "Otros procesos del proyecto", entries: menus.processes } },
          { label: title },
        ]}
      />
      <div className="flex flex-wrap items-center gap-2">
        {armadas > 0 && <Badge tone="neutral">{armadas === 1 ? "1 armada" : `${armadas} armadas`}</Badge>}
        {verification && <Badge tone={verification === "Sin verificación" ? "neutral" : "success"}>{verification}</Badge>}
        <Badge tone={status === "calculated" ? "primary" : "neutral"}>
          {status === "in_progress" ? "En medición" : status === "calculated" ? "Calculada" : "Sin lecturas"}
        </Badge>
      </div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1.5">
          <h1 className="font-display text-2xl font-bold leading-tight sm:text-3xl">
            {title} · {dateLabel}
          </h1>
          <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-ink-2">
            {operator && <span>{operator}</span>}
            <span>{equipment ?? "Equipo sin registrar"}</span>
            <span>Guardado {formatSavedAt(updatedAt)}</span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {prevHref ? (
            <Link href={prevHref} aria-label="Visita anterior" className={buttonClasses({ variant: "secondary", size: "sm" })}>
              ←
            </Link>
          ) : (
            <Button variant="secondary" size="sm" disabled aria-label="Visita anterior">
              ←
            </Button>
          )}
          {nextHref ? (
            <Link href={nextHref} aria-label="Visita siguiente" className={buttonClasses({ variant: "secondary", size: "sm" })}>
              →
            </Link>
          ) : (
            <Button variant="secondary" size="sm" disabled aria-label="Visita siguiente">
              →
            </Button>
          )}
          <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>
            Editar datos
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setDeleting(true)}>
            Eliminar
          </Button>
        </div>
      </div>
      {error && <Alert variant="error">{error}</Alert>}

      {editing && (
        <VisitDialog
          mode="edit"
          initial={initial}
          open={editing}
          onClose={() => setEditing(false)}
          onSave={async (visit) => {
            const r = await callAction(() => saveVisitAction(projectId, { siteId, visitId, ...visit, book }));
            if (r.ok) router.refresh();
            return r;
          }}
        />
      )}
      <Modal
        open={deleting}
        onClose={() => setDeleting(false)}
        title="Eliminar visita"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleting(false)}>
              Cancelar
            </Button>
            <Button variant="danger" onClick={remove} disabled={isPending}>
              {isPending ? "Eliminando…" : "Eliminar"}
            </Button>
          </>
        }
      >
        <p className="text-sm text-ink-2">
          Se eliminará la {title.toLowerCase()} del {dateLabel} con su libreta y sus lecturas. El parcial y la velocidad
          de la siguiente se recalculan contra la anterior. Esta acción no se puede deshacer.
        </p>
      </Modal>
    </header>
  );
}
