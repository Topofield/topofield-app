"use client";

import { useState, useTransition } from "react";
import { Alert, Button, Input, Modal } from "@/components/design-system";
import { EquipmentIdentity } from "@/components/equipment/equipment-picker";
import { createLevelingProcessAction } from "@/app/(app)/projects/[id]/leveling/create-actions";
import { callAction } from "@/lib/errors/action-call";
import { cn } from "@/lib/utils/cn";
import type { LevelingType } from "@/types/leveling";
import {
  detailsNotices,
  EMPTY_LEVELING_DETAILS,
  type LevelingDetails,
  type LevelingDetailsForm,
  validateLevelingDetails,
} from "./leveling-details";

const TYPES: { type: LevelingType; label: string; help: string; drawing: React.ReactNode }[] = [
  {
    type: "closed",
    label: "Cerrada",
    help: "Sale de un BM y vuelve a él.",
    drawing: (
      <>
        <path d="M20 50 C 30 10, 110 10, 120 40 S 40 70, 20 50" fill="none" stroke="currentColor" strokeWidth="2" />
        <rect x="13" y="43" width="14" height="14" className="fill-mira-strong" />
        <circle cx="70" cy="18" r="3.5" fill="currentColor" />
        <circle cx="120" cy="40" r="3.5" fill="currentColor" />
        <circle cx="70" cy="58" r="3.5" fill="currentColor" />
      </>
    ),
  },
  {
    type: "link",
    label: "De enlace",
    help: "Va de un BM a otro BM con cota conocida.",
    drawing: (
      <>
        <path d="M20 50 L 55 30 L 90 42 L 122 20" fill="none" stroke="currentColor" strokeWidth="2" />
        <rect x="13" y="43" width="14" height="14" className="fill-mira-strong" />
        <rect x="115" y="13" width="14" height="14" className="fill-mira-strong" />
        <circle cx="55" cy="30" r="3.5" fill="currentColor" />
        <circle cx="90" cy="42" r="3.5" fill="currentColor" />
      </>
    ),
  },
  {
    type: "open",
    label: "Abierta",
    help: "Termina en un punto sin cota conocida.",
    drawing: (
      <>
        <path d="M20 44 L 55 26 L 90 36 L 122 16" fill="none" stroke="currentColor" strokeWidth="2" />
        <rect x="13" y="41" width="14" height="14" className="fill-mira-strong" />
        <circle cx="55" cy="26" r="3.5" fill="currentColor" />
        <circle cx="90" cy="36" r="3.5" fill="currentColor" />
        <circle cx="122" cy="16" r="4" className="fill-card" stroke="currentColor" strokeWidth="2" />
      </>
    ),
  },
];

const blank = (v: string) => (v.trim() === "" ? null : v.trim());

type DialogProps =
  | { mode: "create"; projectId: string; open: boolean; onClose: () => void }
  | {
      mode: "edit";
      initial: LevelingDetailsForm;
      /** Ya hay lecturas: cambiar el tipo o un BM recalcula la libreta. */
      hasReadings: boolean;
      /** Las armadas de la vuelta: quitar la vuelta las borra. */
      returnArmadas: number;
      onSave: (details: LevelingDetails) => Promise<{ ok: boolean; error?: string }>;
      open: boolean;
      onClose: () => void;
    };

/**
 * El alta de una nivelación, y «Editar datos» con el mismo popup (Fase 36,
 * maqueta «Alta B»): título, el recorrido dibujado, la vuelta, el BM de
 * partida —y el de llegada en una de enlace— tecleados, y lo opcional
 * plegado. El orden de precisión no se pide: se detecta al compensar.
 */
export function LevelingDetailsDialog(props: DialogProps) {
  const initial = props.mode === "edit" ? props.initial : EMPTY_LEVELING_DETAILS;
  const [form, setForm] = useState<LevelingDetailsForm>(initial);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const set = (patch: Partial<LevelingDetailsForm>) => setForm((f) => ({ ...f, ...patch }));
  const notices =
    props.mode === "edit"
      ? detailsNotices(props.initial, form, { hasReadings: props.hasReadings, returnArmadas: props.returnArmadas })
      : [];

  function submit() {
    setError(null);
    const checked = validateLevelingDetails(form);
    if ("error" in checked) {
      setError(checked.error);
      return;
    }
    const d = checked.details;
    startTransition(async () => {
      if (props.mode === "create") {
        const response = await callAction(() =>
          createLevelingProcessAction({
            projectId: props.projectId,
            name: d.name.trim(),
            type: d.type,
            hasReturnRun: d.hasReturnRun,
            startBmCode: d.startBmCode.trim(),
            startBmElevation: d.startBmElevation,
            endBmCode: d.type === "link" ? d.endBmCode.trim() : null,
            endBmElevation: d.type === "link" ? d.endBmElevation : null,
            location: blank(d.location),
            responsibleName: blank(d.responsibleName),
            responsibleRole: blank(d.responsibleRole),
            equipmentBrand: blank(d.equipmentBrand),
            equipmentModel: blank(d.equipmentModel),
            equipmentSerial: blank(d.equipmentSerial),
            readings: null,
          }),
        );
        // En éxito la acción redirige; solo vuelve con un error.
        if (response?.error) setError(response.error);
        return;
      }
      const response = await props.onSave(d);
      if (response.ok) props.onClose();
      else setError(response.error ?? "No se pudieron guardar los datos.");
    });
  }

  return (
    <Modal
      open={props.open}
      onClose={props.onClose}
      title={props.mode === "create" ? "Nueva nivelación" : "Datos de la nivelación"}
      footer={
        <div className="flex w-full flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-ink-2">El orden de precisión se detecta al compensar.</p>
          <div className="flex gap-2">
            <Button type="button" variant="secondary" onClick={props.onClose}>
              Cancelar
            </Button>
            <Button type="button" onClick={submit} disabled={isPending}>
              {isPending ? "Guardando…" : props.mode === "create" ? "Crear y empezar" : "Guardar"}
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
        <Input
          label="Título"
          value={form.name}
          onChange={(e) => set({ name: e.target.value })}
          placeholder="El Verjón — ida y vuelta"
          required
        />
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1.5 text-sm font-medium text-ink">¿Cómo es el recorrido?</legend>
          <div className="grid grid-cols-3 gap-2">
            {TYPES.map((t) => {
              const on = form.type === t.type;
              return (
                <label
                  key={t.type}
                  className={cn(
                    "flex cursor-pointer flex-col gap-1 rounded-md border p-2 text-ink",
                    on ? "border-2 border-mira-strong bg-mira-bg" : "border-rule-strong hover:bg-sel",
                  )}
                >
                  <input
                    type="radio"
                    name="tipo-nivelacion"
                    value={t.type}
                    checked={on}
                    onChange={() => set({ type: t.type })}
                    className="sr-only"
                  />
                  <svg viewBox="0 0 140 70" className="w-full" aria-hidden="true">
                    {t.drawing}
                  </svg>
                  <span className="text-sm font-semibold">{t.label}</span>
                  <span className="text-xs text-ink-2">{t.help}</span>
                </label>
              );
            })}
          </div>
        </fieldset>
        <label className="flex items-start gap-2.5 rounded-md border border-rule px-3 py-2.5 text-sm">
          <input
            type="checkbox"
            checked={form.hasReturnRun}
            onChange={(e) => set({ hasReturnRun: e.target.checked })}
            className="mt-0.5 h-5 w-5"
          />
          <span>
            <strong>Con vuelta</strong> por los mismos puntos.
          </span>
        </label>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            label="BM de partida"
            value={form.startBmCode}
            onChange={(e) => set({ startBmCode: e.target.value })}
            placeholder="D1"
          />
          <Input
            label="Cota conocida (m)"
            inputMode="decimal"
            value={form.startBmElevation}
            onChange={(e) => set({ startBmElevation: e.target.value })}
            placeholder="3288.5000"
          />
        </div>
        {form.type === "link" && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="BM de llegada"
              value={form.endBmCode}
              onChange={(e) => set({ endBmCode: e.target.value })}
            />
            <Input
              label="Cota conocida del BM de llegada (m)"
              inputMode="decimal"
              value={form.endBmElevation}
              onChange={(e) => set({ endBmElevation: e.target.value })}
            />
          </div>
        )}
        {notices.map((n) => (
          <Alert key={n} variant="warning">
            {n}
          </Alert>
        ))}
        <details className="rounded-md border border-rule" open={props.mode === "edit"}>
          <summary className="cursor-pointer px-3 py-2.5 text-sm font-semibold">
            Ubicación, responsable y equipo <span className="font-normal text-ink-2">· opcional</span>
          </summary>
          <div className="flex flex-col gap-4 px-3 pb-3">
            <Input label="Ubicación" value={form.location} onChange={(e) => set({ location: e.target.value })} />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Input
                label="Responsable"
                value={form.responsibleName}
                onChange={(e) => set({ responsibleName: e.target.value })}
              />
              <Input
                label="Cargo del responsable"
                value={form.responsibleRole}
                onChange={(e) => set({ responsibleRole: e.target.value })}
              />
            </div>
            <EquipmentIdentity
              kind="level"
              value={{ brand: form.equipmentBrand, model: form.equipmentModel, serial: form.equipmentSerial }}
              onChange={(v) => set({ equipmentBrand: v.brand, equipmentModel: v.model, equipmentSerial: v.serial })}
            />
          </div>
        </details>
      </form>
    </Modal>
  );
}
