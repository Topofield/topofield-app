"use client";

import { useState, useTransition, type ChangeEvent, type FormEvent } from "react";
import { Alert, Button, Card, Input, Modal } from "@/components/design-system";
import {
  createPointAction,
  deletePointAction,
  savePointAction,
  type PointPayload,
} from "@/app/(app)/projects/[id]/sites/[siteId]/point-actions";
import type { SettlementPoint } from "@/types/settlement";

type Dialog = { mode: "create" } | { mode: "edit"; point: SettlementPoint };

interface PointsCatalogProps {
  siteId: string;
  points: SettlementPoint[];
  /** Sin acciones de edición cuando el lugar está cerrado. */
  disabled?: boolean;
}

interface FormState {
  code: string;
  locationDescription: string;
  northing: string;
  easting: string;
  initialElevation: string;
}

const EMPTY_FORM: FormState = {
  code: "",
  locationDescription: "",
  northing: "",
  easting: "",
  initialElevation: "",
};

function formOf(point: SettlementPoint | null): FormState {
  if (!point) return EMPTY_FORM;
  return {
    code: point.code,
    locationDescription: point.location_description,
    northing: point.northing === null ? "" : String(point.northing),
    easting: point.easting === null ? "" : String(point.easting),
    initialElevation:
      point.initial_elevation === null ? "" : String(point.initial_elevation),
  };
}

/**
 * Parsea una coordenada opcional a número redondeado, o null si viene vacía.
 * Devuelve `ok:false` si el texto no es un número.
 */
function parseOptionalNumber(
  raw: string,
  decimals: number,
): { ok: true; value: number | null } | { ok: false } {
  if (raw.trim() === "") return { ok: true, value: null };
  const n = Number(raw);
  if (!Number.isFinite(n)) return { ok: false };
  const factor = 10 ** decimals;
  return { ok: true, value: Math.round(n * factor) / factor };
}

/**
 * Catálogo de puntos de un lugar: tabla + modal de alta/edición, siguiendo el
 * patrón de `reference-points-manager.tsx` (validación en cliente, acción
 * como función dentro de `startTransition`, cierre del modal en el callback).
 */
export function PointsCatalog({ siteId, points, disabled }: PointsCatalogProps) {
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function open(next: Dialog) {
    setErrors({});
    setServerError(null);
    setForm(formOf(next.mode === "edit" ? next.point : null));
    setDialog(next);
  }

  function close() {
    setDialog(null);
  }

  function set(key: keyof FormState) {
    return (event: ChangeEvent<HTMLInputElement>) =>
      setForm((prev) => ({ ...prev, [key]: event.target.value }));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const fieldErrors: Record<string, string> = {};
    const code = form.code.trim();
    if (code === "") fieldErrors.code = "El código es obligatorio.";

    const locationDescription = form.locationDescription.trim();
    if (locationDescription === "") {
      fieldErrors.locationDescription = "La ubicación es obligatoria.";
    }

    const north = parseOptionalNumber(form.northing, 3);
    if (!north.ok) fieldErrors.northing = "El Norte debe ser un número.";

    const east = parseOptionalNumber(form.easting, 3);
    if (!east.ok) fieldErrors.easting = "El Este debe ser un número.";

    if (
      north.ok &&
      east.ok &&
      (north.value !== null) !== (east.value !== null)
    ) {
      const message = "Indica las dos coordenadas (N y E) o ninguna.";
      fieldErrors.northing = message;
      fieldErrors.easting = message;
    }

    const initialElevation = parseOptionalNumber(form.initialElevation, 4);
    if (!initialElevation.ok) {
      fieldErrors.initialElevation = "La cota C0 debe ser un número.";
    }

    if (Object.keys(fieldErrors).length > 0) {
      setErrors(fieldErrors);
      setServerError(null);
      return;
    }
    setErrors({});

    if (!north.ok || !east.ok || !initialElevation.ok) return;

    const payload: PointPayload = {
      siteId,
      code,
      locationDescription,
      northing: north.value,
      easting: east.value,
      initialElevation: initialElevation.value,
    };

    const isEdit = dialog?.mode === "edit";
    startTransition(async () => {
      const response = isEdit
        ? await savePointAction(dialog.point.id, payload)
        : await createPointAction(payload);
      if (response.ok) {
        close();
      } else {
        setServerError(response.error ?? "Ocurrió un error.");
      }
    });
  }

  function handleDelete(point: SettlementPoint) {
    setDeleteError(null);
    startTransition(async () => {
      const response = await deletePointAction(siteId, point.id);
      if (!response.ok) {
        setDeleteError(response.error ?? "No se pudo eliminar el punto.");
      }
    });
  }

  const point = dialog?.mode === "edit" ? dialog.point : null;

  return (
    <Card
      title="Catálogo de puntos"
      actions={
        !disabled && (
          <Button size="sm" onClick={() => open({ mode: "create" })}>
            Agregar punto
          </Button>
        )
      }
    >
      {deleteError && (
        <Alert variant="error" className="mb-4">
          {deleteError}
        </Alert>
      )}

      {points.length === 0 ? (
        <p className="text-sm text-neutral-500">
          Aún no hay puntos en el catálogo. Agrega los puntos de control que
          se leerán en cada visita.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-100 text-left text-xs text-neutral-500">
                <th className="py-2 pr-3 font-medium">Código</th>
                <th className="py-2 pr-3 font-medium">Ubicación</th>
                <th className="py-2 pr-3 font-medium">Norte</th>
                <th className="py-2 pr-3 font-medium">Este</th>
                <th className="py-2 pr-3 font-medium">Cota C0</th>
                {!disabled && <th className="py-2 pr-3" />}
              </tr>
            </thead>
            <tbody>
              {points.map((item) => (
                <tr
                  key={item.id}
                  className="border-b border-neutral-100 last:border-0"
                >
                  <td className="py-2 pr-3 font-medium text-neutral-900">
                    {item.code}
                  </td>
                  <td className="py-2 pr-3 text-neutral-700">
                    {item.location_description}
                  </td>
                  <td className="py-2 pr-3 text-neutral-700">
                    {item.northing ?? "—"}
                  </td>
                  <td className="py-2 pr-3 text-neutral-700">
                    {item.easting ?? "—"}
                  </td>
                  <td className="py-2 pr-3 text-neutral-700">
                    {item.initial_elevation ?? "—"}
                  </td>
                  {!disabled && (
                    <td className="py-2 pr-3">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => open({ mode: "edit", point: item })}
                        >
                          Editar
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={isPending}
                          onClick={() => handleDelete(item)}
                        >
                          Eliminar
                        </Button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {dialog && (
        <Modal
          open
          onClose={close}
          title={point ? "Editar punto" : "Nuevo punto"}
        >
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {serverError && <Alert variant="error">{serverError}</Alert>}

            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label="Código"
                value={form.code}
                onChange={set("code")}
                error={errors.code}
              />
              <Input
                label="Ubicación"
                value={form.locationDescription}
                onChange={set("locationDescription")}
                error={errors.locationDescription}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <Input
                label="Norte"
                type="number"
                step="any"
                value={form.northing}
                onChange={set("northing")}
                error={errors.northing}
              />
              <Input
                label="Este"
                type="number"
                step="any"
                value={form.easting}
                onChange={set("easting")}
                error={errors.easting}
              />
              <Input
                label="Cota C0"
                type="number"
                step="any"
                value={form.initialElevation}
                onChange={set("initialElevation")}
                error={errors.initialElevation}
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={close}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Guardando…" : "Guardar"}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </Card>
  );
}
