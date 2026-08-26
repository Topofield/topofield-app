"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import {
  Alert,
  Button,
  Card,
  Input,
  Modal,
  Select,
  Textarea,
} from "@/components/design-system";
import { thresholdsFor } from "@/lib/calculations/tolerances";
import {
  closeSiteAction,
  createSiteAction,
  saveSiteAction,
  type SitePayload,
} from "@/app/(app)/projects/[id]/sites/actions";
import {
  STRUCTURE_TYPE_LABELS,
  STRUCTURE_TYPES,
  type Site,
  type StructureType,
} from "@/types/site";
import type { Thresholds } from "@/types/settlement";
import { ThresholdsFields } from "./thresholds-fields";

const STRUCTURE_TYPE_OPTIONS = STRUCTURE_TYPES.map((value) => ({
  value,
  label: STRUCTURE_TYPE_LABELS[value],
}));

function thresholdsOf(site: Site): Thresholds {
  return {
    velocityCaution: Number(site.velocity_caution),
    velocityAlert: Number(site.velocity_alert),
    velocityAlarm: Number(site.velocity_alarm),
    accumulatedCaution: Number(site.accumulated_caution),
    accumulatedAlert: Number(site.accumulated_alert),
    accumulatedAlarm: Number(site.accumulated_alarm),
    angularDistortionLimit: site.angular_distortion_limit,
  };
}

interface SiteFormProps {
  projectId: string;
  /** Si viene, el formulario edita este lugar; si no, crea uno nuevo. */
  site?: Site;
}

/**
 * Alta o edición de un lugar: nombre, descripción, tipo de estructura y los
 * siete umbrales de alerta.
 *
 * Al cambiar el tipo de estructura se aplica el preset de umbrales en el
 * callback del evento, nunca en un efecto: `react-hooks/set-state-in-effect`
 * es error de lint en este proyecto, y además así el usuario puede editar los
 * umbrales después sin que un efecto se los revierta.
 */
export function SiteForm({ projectId, site }: SiteFormProps) {
  const router = useRouter();
  const isEdit = site !== undefined;

  const [name, setName] = useState(site?.name ?? "");
  const [description, setDescription] = useState(site?.description ?? "");
  const [structureType, setStructureType] = useState<StructureType>(
    site?.structure_type ?? "edificio",
  );
  const [thresholds, setThresholds] = useState<Thresholds>(
    site ? thresholdsOf(site) : thresholdsFor("edificio"),
  );
  const [notes, setNotes] = useState(site?.notes ?? "");

  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const [closeDialogOpen, setCloseDialogOpen] = useState(false);
  const [closeError, setCloseError] = useState<string | null>(null);
  const [isClosing, startCloseTransition] = useTransition();

  const disabled = site?.status === "closed";
  const closedLabel =
    site?.status === "closed" && site.closed_at
      ? new Intl.DateTimeFormat("es-CO", {
          dateStyle: "long",
          timeStyle: "short",
          timeZone: "America/Bogota",
        }).format(new Date(site.closed_at))
      : null;

  function handleStructureTypeChange(tipo: StructureType) {
    setStructureType(tipo);
    // El preset se aplica aquí y no en un efecto: `react-hooks/set-state-in-effect`
    // es error de lint, y además así el usuario puede editar los umbrales después
    // sin que un efecto se los revierta.
    setThresholds(thresholdsFor(tipo));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (name.trim() === "") {
      setError("El lugar necesita un nombre.");
      return;
    }
    setError(null);

    const payload: SitePayload = {
      projectId,
      name,
      description: description.trim() === "" ? null : description.trim(),
      structureType,
      velocityCaution: thresholds.velocityCaution,
      velocityAlert: thresholds.velocityAlert,
      velocityAlarm: thresholds.velocityAlarm,
      accumulatedCaution: thresholds.accumulatedCaution,
      accumulatedAlert: thresholds.accumulatedAlert,
      accumulatedAlarm: thresholds.accumulatedAlarm,
      angularDistortionLimit: thresholds.angularDistortionLimit,
      notes: notes.trim() === "" ? null : notes.trim(),
    };

    startTransition(async () => {
      const response = isEdit
        ? await saveSiteAction(site.id, payload)
        : await createSiteAction(payload);

      if (!response.ok) {
        setError(response.error ?? "Ocurrió un error.");
        return;
      }

      if (!isEdit && response.siteId) {
        router.push(`/projects/${projectId}/sites/${response.siteId}`);
      } else {
        router.refresh();
      }
    });
  }

  function openCloseDialog() {
    setCloseError(null);
    setCloseDialogOpen(true);
  }

  function closeCloseDialog() {
    setCloseDialogOpen(false);
  }

  function handleConfirmClose() {
    if (!site) return;
    setCloseError(null);
    startCloseTransition(async () => {
      const response = await closeSiteAction(projectId, site.id);
      if (response.ok) {
        setCloseDialogOpen(false);
        router.refresh();
      } else {
        setCloseError(response.error ?? "No se pudo cerrar el lugar.");
      }
    });
  }

  return (
    <Card title={isEdit ? "Datos del lugar" : "Nuevo lugar"}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {error && <Alert variant="error">{error}</Alert>}
        {disabled && (
          <Alert variant="info">
            {closedLabel
              ? `Lugar cerrado el ${closedLabel}. Sus datos y los de sus visitas no admiten cambios.`
              : "El lugar está cerrado; sus datos no admiten cambios."}
          </Alert>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Nombre"
            name="name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={disabled || isPending}
          />
          <Select
            label="Tipo de estructura"
            name="structure_type"
            options={STRUCTURE_TYPE_OPTIONS}
            required
            value={structureType}
            onChange={(e) =>
              handleStructureTypeChange(e.target.value as StructureType)
            }
            disabled={disabled || isPending}
          />
        </div>

        <Textarea
          label="Descripción"
          name="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          disabled={disabled || isPending}
        />

        <ThresholdsFields
          value={thresholds}
          onChange={setThresholds}
          disabled={disabled || isPending}
        />

        <Textarea
          label="Notas"
          name="notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          disabled={disabled || isPending}
        />

        {!disabled && isEdit && (
          <div className="flex justify-between gap-2">
            <Button
              type="button"
              variant="danger"
              onClick={openCloseDialog}
              disabled={isPending}
            >
              Cerrar Lugar
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Guardando…" : "Guardar"}
            </Button>
          </div>
        )}
        {!disabled && !isEdit && (
          <div className="flex justify-end gap-2">
            <Button type="submit" disabled={isPending}>
              {isPending ? "Guardando…" : "Guardar"}
            </Button>
          </div>
        )}
      </form>

      {closeDialogOpen && (
        <Modal
          open
          onClose={closeCloseDialog}
          title="Cerrar lugar"
          footer={
            <>
              <Button type="button" variant="secondary" onClick={closeCloseDialog}>
                Cancelar
              </Button>
              <Button
                type="button"
                variant="danger"
                onClick={handleConfirmClose}
                disabled={isClosing}
              >
                {isClosing ? "Cerrando…" : "Confirmar Cierre"}
              </Button>
            </>
          }
        >
          <div className="flex flex-col gap-4">
            {closeError && <Alert variant="error">{closeError}</Alert>}
            <p className="text-sm text-neutral-700">
              Cerrar el lugar finaliza el monitoreo: el lugar queda en solo
              lectura, con responsable y fecha de registro.
            </p>
            <Alert variant="warning">
              Esto también cierra todas sus visitas: quedarán en solo lectura
              y ninguna admitirá más ediciones.
            </Alert>
          </div>
        </Modal>
      )}
    </Card>
  );
}
