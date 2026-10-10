"use client";

import { useState, useTransition } from "react";
import { Alert, Button, Input, Modal } from "@/components/design-system";
import { EquipmentIdentity } from "@/components/process/equipment-identity";
import { createPolygonalProcessAction } from "@/app/(app)/projects/[id]/polygonal/create-actions";
import { cn } from "@/lib/utils/cn";
import { POLYGONAL_TYPES, POLYGONAL_TYPE_LABELS, type PolygonalType } from "@/types/polygonal";
import { callAction } from "@/lib/errors/action-call";

/** Lo que el alta pide (Fase 35, decisión 1). */
export interface PolygonalDetails {
  name: string;
  location: string;
  responsibleName: string;
  responsibleRole: string;
  type: PolygonalType;
  equipmentBrand: string;
  equipmentModel: string;
  equipmentSerial: string;
}

export const EMPTY_DETAILS: PolygonalDetails = {
  name: "",
  location: "",
  responsibleName: "",
  responsibleRole: "",
  type: "closed",
  equipmentBrand: "",
  equipmentModel: "",
  equipmentSerial: "",
};

const TYPE_HELP: Record<PolygonalType, string> = {
  closed: "Vuelve al punto de partida: la app comprueba el cierre angular y el lineal.",
  open_controlled:
    "Llega a un punto de coordenadas conocidas: se comprueba el cierre lineal, y el angular si se conoce el azimut de llegada.",
  open_uncontrolled:
    "No llega a un punto conocido: las coordenadas se calculan sin comprobar el cierre.",
};

type DialogProps =
  | { mode: "create"; projectId: string; open: boolean; onClose: () => void }
  | {
      mode: "edit";
      initial: PolygonalDetails;
      /** Ya hay mediciones: cambiar el tipo las recalcula. */
      hasMeasurements: boolean;
      onSave: (details: PolygonalDetails) => Promise<{ ok: boolean; error?: string }>;
      open: boolean;
      onClose: () => void;
    };

/**
 * El alta de una poligonal, y «Editar datos» con el mismo popup (Fase 35,
 * maqueta «Alta A»): título, ubicación, responsable y cargo, tipo y el equipo
 * plegado. El orden de precisión no se pide: se detecta al ajustar.
 */
export function PolygonalDetailsDialog(props: DialogProps) {
  const initial = props.mode === "edit" ? props.initial : EMPTY_DETAILS;
  const [details, setDetails] = useState<PolygonalDetails>(initial);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const set = (patch: Partial<PolygonalDetails>) => setDetails((d) => ({ ...d, ...patch }));
  const typeChanged = props.mode === "edit" && details.type !== props.initial.type;

  function submit() {
    setError(null);
    if (details.name.trim() === "") {
      setError("El título es obligatorio.");
      return;
    }
    startTransition(async () => {
      if (props.mode === "create") {
        const response = await callAction(() => createPolygonalProcessAction({
          projectId: props.projectId,
          name: details.name,
          location: details.location,
          responsibleName: details.responsibleName,
          responsibleRole: details.responsibleRole,
          type: details.type,
          equipmentBrand: details.equipmentBrand,
          equipmentModel: details.equipmentModel,
          equipmentSerial: details.equipmentSerial,
        }));
        // En éxito la acción redirige; solo vuelve con un error.
        if (response?.error) setError(response.error);
        return;
      }
      const response = await props.onSave(details);
      if (response.ok) props.onClose();
      else setError(response.error ?? "No se pudieron guardar los datos.");
    });
  }

  return (
    <Modal
      open={props.open}
      onClose={props.onClose}
      title={props.mode === "create" ? "Nueva poligonal" : "Datos de la poligonal"}
      footer={
        <div className="flex w-full flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-ink-2">El orden de precisión se detecta al ajustar.</p>
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
          value={details.name}
          onChange={(e) => set({ name: e.target.value })}
          placeholder="Poligonal V10 — cartera TT4"
          required
        />
        <Input
          label="Ubicación"
          value={details.location}
          onChange={(e) => set({ location: e.target.value })}
          placeholder="Sede Vivero, Bogotá"
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            label="Responsable"
            value={details.responsibleName}
            onChange={(e) => set({ responsibleName: e.target.value })}
          />
          <Input
            label="Cargo del responsable"
            value={details.responsibleRole}
            onChange={(e) => set({ responsibleRole: e.target.value })}
          />
        </div>
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1.5 text-sm font-medium text-ink">Tipo de poligonal</legend>
          <div className="grid grid-cols-3 overflow-hidden rounded-md border border-rule-strong">
            {POLYGONAL_TYPES.map((type) => (
              <label
                key={type}
                className={cn(
                  "flex min-h-11 cursor-pointer items-center justify-center border-r border-rule px-2 py-1.5 text-center text-sm font-medium last:border-r-0",
                  details.type === type ? "bg-mira-bg text-mira-ink" : "text-ink-2 hover:bg-sel",
                )}
              >
                <input
                  type="radio"
                  name="tipo-poligonal"
                  value={type}
                  checked={details.type === type}
                  onChange={() => set({ type })}
                  className="sr-only"
                />
                {POLYGONAL_TYPE_LABELS[type]}
              </label>
            ))}
          </div>
          <p className="text-sm text-ink-2">{TYPE_HELP[details.type]}</p>
          {typeChanged && props.mode === "edit" && props.hasMeasurements && (
            <Alert variant="warning">
              Cambiar el tipo recalcula la poligonal con las mediciones que ya tiene.
            </Alert>
          )}
        </fieldset>
        <details className="rounded-md border border-rule" open={props.mode === "edit"}>
          <summary className="flex cursor-pointer items-center justify-between px-3 py-2.5 text-sm font-semibold">
            <span>
              Equipo <span className="font-normal text-ink-2">· opcional</span>
            </span>
            <span className="text-sm font-normal text-ink-2">Estación total</span>
          </summary>
          <div className="px-3 pb-3">
            <EquipmentIdentity
              value={{
                brand: details.equipmentBrand,
                model: details.equipmentModel,
                serial: details.equipmentSerial,
              }}
              onChange={(v) =>
                set({ equipmentBrand: v.brand, equipmentModel: v.model, equipmentSerial: v.serial })
              }
            />
          </div>
        </details>
      </form>
    </Modal>
  );
}
