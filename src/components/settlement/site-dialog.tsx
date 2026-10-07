"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Alert, Button, Input, Modal, Textarea } from "@/components/design-system";
import { createSiteAction, saveSiteAction } from "@/app/(app)/projects/[id]/sites/actions";
import { thresholdsFor, thresholdsOf } from "@/lib/calculations/tolerances";
import { callAction } from "@/lib/errors/action-call";
import { cn } from "@/lib/utils/cn";
import { STRUCTURE_TYPE_LABELS, STRUCTURE_TYPES, type Site } from "@/types/site";
import { readSiteForm, thresholdsSummary, type SiteForm } from "./site-dialog-form";
import { ThresholdsFields } from "./thresholds-fields";

type DialogProps =
  | { mode: "create"; projectId: string; open: boolean; onClose: () => void }
  | { mode: "edit"; projectId: string; site: Site; open: boolean; onClose: () => void };

/**
 * El alta de un lugar, y «Editar datos» con el mismo popup (Fase 37, decisión
 * 1, maqueta «Alta del lugar»): nombre, tipo de estructura, descripción y los
 * umbrales del semáforo plegados y precargados por el tipo. Cambiar el tipo
 * vuelve a precargarlos, en el evento y no en un efecto: así el usuario puede
 * apartarse del preset sin que nada se lo revierta.
 */
export function SiteDialog(props: DialogProps) {
  const router = useRouter();
  const initial: SiteForm =
    props.mode === "edit"
      ? {
          name: props.site.name,
          description: props.site.description ?? "",
          structureType: props.site.structure_type,
          thresholds: thresholdsOf(props.site),
        }
      : { name: "", description: "", structureType: "edificio", thresholds: thresholdsFor("edificio") };
  const [form, setForm] = useState<SiteForm>(initial);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const set = (patch: Partial<SiteForm>) => setForm((f) => ({ ...f, ...patch }));

  function submit() {
    setError(null);
    const read = readSiteForm(form);
    if ("error" in read) {
      setError(read.error);
      return;
    }
    const { site } = read;
    const payload = {
      projectId: props.projectId,
      name: site.name,
      description: site.description,
      structureType: site.structureType,
      ...site.thresholds,
    };
    startTransition(async () => {
      const response = await callAction(() =>
        props.mode === "create" ? createSiteAction(payload) : saveSiteAction(props.site.id, payload),
      );
      if (!response.ok) {
        setError(response.error ?? "No se pudo guardar el lugar.");
        return;
      }
      if (props.mode === "create" && "siteId" in response && response.siteId) {
        router.push(`/projects/${props.projectId}/settlement/${response.siteId}`);
        return;
      }
      props.onClose();
      router.refresh();
    });
  }

  return (
    <Modal
      open={props.open}
      onClose={props.onClose}
      title={props.mode === "create" ? "Nuevo lugar" : "Datos del lugar"}
      footer={
        <div className="flex w-full flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-ink-2">
            {props.mode === "create" ? "Los puntos de control se agregan después, en la pestaña Puntos." : ""}
          </p>
          <div className="flex gap-2">
            <Button type="button" variant="secondary" onClick={props.onClose}>
              Cancelar
            </Button>
            <Button type="button" onClick={submit} disabled={isPending}>
              {isPending ? "Guardando…" : props.mode === "create" ? "Crear lugar" : "Guardar"}
            </Button>
          </div>
        </div>
      }
    >
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        {error && <Alert variant="error">{error}</Alert>}
        <Input label="Nombre" value={form.name} onChange={(e) => set({ name: e.target.value })} required />
        <fieldset className="flex flex-col gap-1.5">
          <legend className="mb-1.5 text-sm font-medium text-ink">Tipo de estructura</legend>
          <div className="grid grid-cols-2 overflow-hidden rounded-md border border-rule-strong sm:grid-cols-4">
            {STRUCTURE_TYPES.map((type) => {
              const on = form.structureType === type;
              return (
                <label
                  key={type}
                  className={cn(
                    "flex min-h-11 cursor-pointer items-center justify-center border-rule px-2 text-sm font-medium",
                    "border-b sm:border-b-0 sm:border-r sm:last:border-r-0",
                    on ? "bg-mira-bg text-mira-strong" : "text-ink-2 hover:bg-sel",
                  )}
                >
                  <input
                    type="radio"
                    name="tipo-estructura"
                    value={type}
                    checked={on}
                    onChange={() => set({ structureType: type, thresholds: thresholdsFor(type) })}
                    className="sr-only"
                  />
                  {STRUCTURE_TYPE_LABELS[type]}
                </label>
              );
            })}
          </div>
          <p className="text-xs text-ink-2">Precarga los umbrales del semáforo. Cambiarlo los vuelve a precargar.</p>
        </fieldset>
        <Textarea
          label="Descripción · opcional"
          value={form.description}
          onChange={(e) => set({ description: e.target.value })}
          rows={3}
        />
        <details className="rounded-md border border-rule">
          <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2 px-3 py-2.5 text-sm font-semibold">
            <span>Umbrales del semáforo</span>
            <span className="text-xs font-normal text-ink-2">
              {thresholdsSummary(form.thresholds, form.structureType)}
            </span>
          </summary>
          <div className="px-3 pb-3">
            <ThresholdsFields value={form.thresholds} onChange={(thresholds) => set({ thresholds })} />
          </div>
        </details>
      </form>
    </Modal>
  );
}

/** «Editar datos» del lugar: el botón y su popup (Fase 37). */
export function SiteDataButton({ projectId, site }: { projectId: string; site: Site }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button type="button" variant="secondary" size="sm" onClick={() => setOpen(true)}>
        Editar datos
      </Button>
      {open && <SiteDialog mode="edit" projectId={projectId} site={site} open={open} onClose={() => setOpen(false)} />}
    </>
  );
}
