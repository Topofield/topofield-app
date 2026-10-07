"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import {
  ActionBar,
  Alert,
  Button,
  Card,
  Input,
  Select,
  Textarea,
} from "@/components/design-system";
import { thresholdsFor, thresholdsOf } from "@/lib/calculations/tolerances";
import {
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
import { CloseSiteDialog } from "./close-site-dialog";
import { UnsavedChangesGuard } from "@/components/navigation/unsaved-changes";

const STRUCTURE_TYPE_OPTIONS = STRUCTURE_TYPES.map((value) => ({
  value,
  label: STRUCTURE_TYPE_LABELS[value],
}));

interface SiteFormProps {
  projectId: string;
  /** Si viene, el formulario edita este lugar; si no, crea uno nuevo. */
  site?: Site;
  /** Para el resumen del § 4.6 en el diálogo de cierre. */
  pointsCount?: number;
  visitsTotal?: number;
  visitsOpen?: number;
  /**
   * Fecha y hora de cierre, ya formateadas en el servidor. Formatearlas aquí
   * con `Intl` rompía la hidratación: el ICU de Node y el del navegador no
   * escriben la hora igual (Fase 22).
   */
  closedLabel?: string | null;
}

/**
 * Alta o edición de un lugar: nombre, descripción, tipo de estructura y los
 * seis umbrales de alerta.
 *
 * Al cambiar el tipo de estructura se aplica el preset de umbrales en el
 * callback del evento, nunca en un efecto: `react-hooks/set-state-in-effect`
 * es error de lint en este proyecto, y además así el usuario puede editar los
 * umbrales después sin que un efecto se los revierta.
 */
export function SiteForm({
  projectId,
  site,
  pointsCount = 0,
  visitsTotal = 0,
  visitsOpen = 0,
  closedLabel = null,
}: SiteFormProps) {
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

  // Cambios sin guardar, derivados en render y no en un efecto
  // (`react-hooks/set-state-in-effect` es error de lint en este proyecto).
  // Cerrar con cambios pendientes sellaría los valores VIEJOS de la base como
  // si fueran los de la pantalla, y un lugar cerrado es inmutable.
  const saved = site ? thresholdsOf(site) : null;
  const dirty =
    site !== undefined &&
    (name !== (site.name ?? "") ||
      description !== (site.description ?? "") ||
      structureType !== site.structure_type ||
      notes !== (site.notes ?? "") ||
      saved === null ||
      (Object.keys(saved) as (keyof Thresholds)[]).some(
        (k) => thresholds[k] !== saved[k],
      ));

  const disabled = site?.status === "closed";

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
        router.push(`/projects/${projectId}/settlement/${response.siteId}?tab=lugar`);
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
      // Tarea 8: este formulario se reemplaza por el popup (Fase 37); el lugar ya no se cierra.
      const response: { ok: boolean; error?: string } = { ok: false, error: "El lugar ya no se cierra." };
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
              ? `Lugar cerrado el ${closedLabel}: sus datos y los de sus visitas no admiten cambios.`
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
          <ActionBar status={dirty ? "Cambios sin guardar" : null}>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Guardando…" : "Guardar"}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={openCloseDialog}
              disabled={isPending}
            >
              Cerrar lugar
            </Button>
          </ActionBar>
        )}
        {!disabled && !isEdit && (
          <div className="flex justify-end gap-2">
            <Button type="submit" disabled={isPending}>
              {isPending ? "Guardando…" : "Guardar"}
            </Button>
          </div>
        )}
      </form>

      <CloseSiteDialog
        open={closeDialogOpen}
        onClose={closeCloseDialog}
        onConfirm={handleConfirmClose}
        isPending={isClosing}
        error={closeError}
        siteName={site?.name ?? name}
        pointsCount={pointsCount}
        visitsTotal={visitsTotal}
        visitsOpen={visitsOpen}
        dirty={dirty}
      />
      <UnsavedChangesGuard dirty={dirty} />
    </Card>
  );
}
