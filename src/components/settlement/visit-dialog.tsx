"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Alert, Button, Input, Modal, Textarea } from "@/components/design-system";
import { EquipmentIdentity } from "@/components/equipment/equipment-picker";
import { createVisitAction } from "@/app/(app)/projects/[id]/settlement/[siteId]/actions";
import { callAction } from "@/lib/errors/action-call";
import { readVisitForm, type VisitData, type VisitForm } from "./visit-dialog-form";

type DialogProps =
  | {
      mode: "create";
      projectId: string;
      siteId: string;
      /** Qué libreta trae la visita nueva (`templateNote`). */
      note: string;
      open: boolean;
      onClose: () => void;
    }
  | {
      mode: "edit";
      initial: VisitForm;
      onSave: (visit: VisitData) => Promise<{ ok: boolean; error?: string }>;
      open: boolean;
      onClose: () => void;
    };

/** Hoy en Bogotá, como `YYYY-MM-DD` (`en-CA` da ese formato). */
const today = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" });

/**
 * El alta de una visita, y «Editar datos» con el mismo popup (Fase 37,
 * decisión 4, maqueta «Nueva visita»): fecha, nivelador, nota y el equipo
 * plegado. No pide BM ni cómo se mide: la libreta llega armada como la de la
 * visita anterior.
 */
export function VisitDialog(props: DialogProps) {
  const router = useRouter();
  const [form, setForm] = useState<VisitForm>(
    props.mode === "edit"
      ? props.initial
      : { date: today(), operator: "", notes: "", brand: "", model: "", serial: "" },
  );
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const set = (patch: Partial<VisitForm>) => setForm((f) => ({ ...f, ...patch }));

  function submit() {
    setError(null);
    const read = readVisitForm(form);
    if ("error" in read) {
      setError(read.error);
      return;
    }
    startTransition(async () => {
      if (props.mode === "create") {
        const r = await callAction(() => createVisitAction(props.projectId, props.siteId, read.visit));
        if (r.ok && "visitId" in r && r.visitId) {
          router.push(`/projects/${props.projectId}/settlement/${props.siteId}/visits/${r.visitId}`);
        } else setError(r.error ?? "No se pudo crear la visita.");
        return;
      }
      const r = await props.onSave(read.visit);
      if (r.ok) props.onClose();
      else setError(r.error ?? "No se pudieron guardar los datos.");
    });
  }

  return (
    <Modal
      open={props.open}
      onClose={props.onClose}
      title={props.mode === "create" ? "Nueva visita" : "Datos de la visita"}
      footer={
        <>
          <Button type="button" variant="secondary" onClick={props.onClose}>
            Cancelar
          </Button>
          <Button type="button" onClick={submit} disabled={isPending}>
            {isPending ? "Guardando…" : props.mode === "create" ? "Crear y empezar" : "Guardar"}
          </Button>
        </>
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
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input label="Fecha" type="date" value={form.date} onChange={(e) => set({ date: e.target.value })} />
          <Input label="Nivelador" value={form.operator} onChange={(e) => set({ operator: e.target.value })} />
        </div>
        <Textarea label="Nota · opcional" rows={2} value={form.notes} onChange={(e) => set({ notes: e.target.value })} />
        {props.mode === "create" && (
          <p className="rounded-md bg-paper px-3 py-2.5 text-sm text-ink-2">{props.note}</p>
        )}
        <details className="rounded-md border border-rule">
          <summary className="cursor-pointer px-3 py-2.5 text-sm font-semibold">
            Equipo <span className="font-normal text-ink-2">· opcional</span>
          </summary>
          <div className="px-3 pb-3">
            <EquipmentIdentity
              kind="level"
              value={{ brand: form.brand, model: form.model, serial: form.serial }}
              onChange={(v) => set({ brand: v.brand, model: v.model, serial: v.serial })}
            />
          </div>
        </details>
      </form>
    </Modal>
  );
}

/** «+ Nueva visita»: el botón y su popup. */
export function NewVisitButton({ projectId, siteId, note }: { projectId: string; siteId: string; note: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        + Nueva visita
      </Button>
      {open && (
        <VisitDialog mode="create" projectId={projectId} siteId={siteId} note={note} open={open} onClose={() => setOpen(false)} />
      )}
    </>
  );
}
