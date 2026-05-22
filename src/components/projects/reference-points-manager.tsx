"use client";

import { useState, useTransition, type FormEvent } from "react";
import {
  Alert,
  Badge,
  Button,
  Card,
  Input,
  Modal,
  Select,
  Textarea,
} from "@/components/design-system";
import { validateReferencePointInput } from "@/lib/validators/reference-point";
import {
  REFERENCE_POINT_TYPE_LABELS,
  REFERENCE_POINT_TYPE_OPTIONS,
  type ReferencePoint,
} from "@/types/project";
import {
  createReferencePointAction,
  deleteReferencePointAction,
  updateReferencePointAction,
} from "@/app/(app)/projects/[id]/actions";

type Dialog = { mode: "create" } | { mode: "edit"; point: ReferencePoint };

interface ReferencePointsManagerProps {
  projectId: string;
  points: ReferencePoint[];
}

export function ReferencePointsManager({
  projectId,
  points,
}: ReferencePointsManagerProps) {
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function open(next: Dialog) {
    setErrors({});
    setServerError(null);
    setDialog(next);
  }

  function close() {
    setDialog(null);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    // Validación en cliente con el validador puro: feedback inmediato por campo.
    const result = validateReferencePointInput(formData);
    if (!result.ok) {
      setErrors(result.errors);
      setServerError(null);
      return;
    }
    setErrors({});

    const isEdit = dialog?.mode === "edit";
    startTransition(async () => {
      const response = isEdit
        ? await updateReferencePointAction(formData)
        : await createReferencePointAction(formData);
      if (response.ok) {
        close();
      } else {
        setServerError(response.error ?? "Ocurrió un error.");
      }
    });
  }

  const point = dialog?.mode === "edit" ? dialog.point : null;

  return (
    <Card
      title="Puntos de referencia"
      actions={
        <Button size="sm" onClick={() => open({ mode: "create" })}>
          Agregar punto
        </Button>
      }
    >
      {points.length === 0 ? (
        <p className="text-sm text-neutral-500">
          Aún no hay puntos de referencia. Agrega los BMs y puntos de control
          del proyecto.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-100 text-left text-xs text-neutral-500">
                <th className="py-2 pr-3 font-medium">Código</th>
                <th className="py-2 pr-3 font-medium">Tipo</th>
                <th className="py-2 pr-3 font-medium">Norte</th>
                <th className="py-2 pr-3 font-medium">Este</th>
                <th className="py-2 pr-3 font-medium">Cota</th>
                <th className="py-2 pr-3" />
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
                  <td className="py-2 pr-3">
                    <Badge tone="primary">
                      {REFERENCE_POINT_TYPE_LABELS[item.type]}
                    </Badge>
                  </td>
                  <td className="py-2 pr-3 text-neutral-700">
                    {item.north ?? "—"}
                  </td>
                  <td className="py-2 pr-3 text-neutral-700">
                    {item.east ?? "—"}
                  </td>
                  <td className="py-2 pr-3 text-neutral-700">
                    {item.elevation ?? "—"}
                  </td>
                  <td className="py-2 pr-3">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => open({ mode: "edit", point: item })}
                      >
                        Editar
                      </Button>
                      <form action={deleteReferencePointAction}>
                        <input
                          type="hidden"
                          name="project_id"
                          value={projectId}
                        />
                        <input
                          type="hidden"
                          name="point_id"
                          value={item.id}
                        />
                        <Button size="sm" variant="ghost" type="submit">
                          Eliminar
                        </Button>
                      </form>
                    </div>
                  </td>
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
          title={
            dialog.mode === "edit"
              ? "Editar punto de referencia"
              : "Nuevo punto de referencia"
          }
        >
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <input type="hidden" name="project_id" value={projectId} />
            {point && (
              <input type="hidden" name="point_id" value={point.id} />
            )}
            {serverError && <Alert variant="error">{serverError}</Alert>}

            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label="Código"
                name="code"
                required
                defaultValue={point?.code}
                error={errors.code}
              />
              <Select
                label="Tipo"
                name="type"
                options={REFERENCE_POINT_TYPE_OPTIONS}
                placeholder="Selecciona…"
                required
                defaultValue={point?.type}
                error={errors.type}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <Input
                label="Norte"
                name="north"
                type="number"
                step="any"
                defaultValue={point?.north ?? undefined}
                error={errors.north}
              />
              <Input
                label="Este"
                name="east"
                type="number"
                step="any"
                defaultValue={point?.east ?? undefined}
                error={errors.east}
              />
              <Input
                label="Cota"
                name="elevation"
                type="number"
                step="any"
                defaultValue={point?.elevation ?? undefined}
                error={errors.elevation}
              />
            </div>
            <Textarea
              label="Descripción"
              name="description"
              defaultValue={point?.description ?? undefined}
            />

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
