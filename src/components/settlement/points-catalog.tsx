"use client";

import { useState, useTransition, type ChangeEvent, type FormEvent } from "react";
import {
  Alert,
  Badge,
  Button,
  Card,
  Input,
  Modal,
  Textarea,
} from "@/components/design-system";
import {
  createPointAction,
  deletePointAction,
  retirePointAction,
  savePointAction,
  undoRetirementAction,
  type PointPayload,
} from "@/app/(app)/projects/[id]/sites/[siteId]/point-actions";
import { formatDateOnly } from "@/lib/utils/format";
import type { SettlementPoint } from "@/types/settlement";

/** Hoy en Bogotá, como `YYYY-MM-DD` (`en-CA` da ese formato). */
function todayInBogota(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" });
}

type Dialog = { mode: "create" } | { mode: "edit"; point: SettlementPoint };

/** Punto a la espera de que el usuario confirme el borrado con arrastre. */
interface PendingDelete {
  point: SettlementPoint;
  lecturasAfectadas: number;
}

interface PointsCatalogProps {
  siteId: string;
  points: SettlementPoint[];
  /** Sin acciones de edición cuando el lugar está cerrado. */
  disabled?: boolean;
  /**
   * El lugar ya tiene visitas: un punto nuevo es de ALTA (Fase 11), con fecha
   * de alta y sin C0 —su línea base es su primera lectura—.
   */
  hasVisits: boolean;
  /**
   * Por cada punto de baja, por qué ya no se puede deshacer la baja, o null
   * si todavía se puede. Lo calcula el servidor con `undoRetirementBlocker`.
   */
  undoBlockers: Record<string, string | null>;
}

interface FormState {
  code: string;
  locationDescription: string;
  northing: string;
  easting: string;
  initialElevation: string;
  activeFrom: string;
}

const EMPTY_FORM: FormState = {
  code: "",
  locationDescription: "",
  northing: "",
  easting: "",
  initialElevation: "",
  activeFrom: "",
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
    activeFrom: point.active_from ?? "",
  };
}

/** Estado del punto, tal como se lee en la tabla. */
function PointState({ point }: { point: SettlementPoint }) {
  if (point.retired_on !== null) {
    return (
      <div className="flex flex-col gap-1">
        <Badge tone="warning" className="w-fit whitespace-nowrap">
          De baja desde el {formatDateOnly(point.retired_on)}
        </Badge>
        <span className="text-xs text-neutral-500">{point.retirement_reason}</span>
      </div>
    );
  }
  if (point.active_from !== null) {
    return (
      <Badge tone="primary" className="whitespace-nowrap">
        Alta el {formatDateOnly(point.active_from)}
      </Badge>
    );
  }
  return <Badge>Vigente</Badge>;
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
export function PointsCatalog({
  siteId,
  points,
  disabled,
  hasVisits,
  undoBlockers,
}: PointsCatalogProps) {
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(
    null,
  );
  const [retiring, setRetiring] = useState<SettlementPoint | null>(null);
  const [retiredOn, setRetiredOn] = useState("");
  const [reason, setReason] = useState("");
  const [retireError, setRetireError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function open(next: Dialog) {
    setErrors({});
    setServerError(null);
    const initial = formOf(next.mode === "edit" ? next.point : null);
    if (next.mode === "create" && hasVisits) initial.activeFrom = todayInBogota();
    setForm(initial);
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

    if (isAltaForm && form.activeFrom.trim() === "") {
      fieldErrors.activeFrom = "La fecha de alta es obligatoria.";
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
      // Un punto de alta no lleva C0: su línea base es su primera lectura.
      initialElevation: isAltaForm ? null : initialElevation.value,
      activeFrom: isAltaForm ? form.activeFrom : null,
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
      if (response.ok) return;

      // El punto tiene lecturas en visitas abiertas: no se borró nada, hace
      // falta que el usuario confirme explícitamente que quiere perderlas.
      if (response.requiereConfirmacion) {
        setPendingDelete({
          point,
          lecturasAfectadas: response.lecturasAfectadas ?? 0,
        });
        return;
      }

      setDeleteError(response.error ?? "No se pudo eliminar el punto.");
    });
  }

  function confirmPendingDelete() {
    if (!pendingDelete) return;
    const { point } = pendingDelete;
    setDeleteError(null);
    startTransition(async () => {
      const response = await deletePointAction(siteId, point.id, true);
      if (!response.ok) {
        setDeleteError(response.error ?? "No se pudo eliminar el punto.");
      }
      setPendingDelete(null);
    });
  }

  function cancelPendingDelete() {
    setPendingDelete(null);
  }

  function openRetire(item: SettlementPoint) {
    setRetireError(null);
    setRetiredOn(todayInBogota());
    setReason("");
    setRetiring(item);
  }

  function confirmRetire(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!retiring) return;
    if (reason.trim() === "") {
      setRetireError("Indica el motivo de la baja.");
      return;
    }
    startTransition(async () => {
      const response = await retirePointAction(
        siteId,
        retiring.id,
        retiredOn,
        reason,
      );
      if (response.ok) setRetiring(null);
      else setRetireError(response.error ?? "No se pudo dar de baja el punto.");
    });
  }

  function handleUndoRetirement(item: SettlementPoint) {
    setDeleteError(null);
    startTransition(async () => {
      const response = await undoRetirementAction(siteId, item.id);
      if (!response.ok) {
        setDeleteError(response.error ?? "No se pudo deshacer la baja.");
      }
    });
  }

  const point = dialog?.mode === "edit" ? dialog.point : null;
  // Un punto de alta: uno nuevo en un lugar con visitas, o uno que ya lo era.
  const isAltaForm = point ? point.active_from !== null : hasVisits;

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
                <th className="py-2 pr-3 font-medium">Estado</th>
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
                    {item.initial_elevation ??
                      (item.active_from !== null ? "Primera lectura" : "—")}
                  </td>
                  <td className="py-2 pr-3">
                    <PointState point={item} />
                  </td>
                  {!disabled && (
                    <td className="py-2 pr-3">
                      {item.retired_on !== null ? (
                        // Un punto de baja no se edita (su historia está
                        // cerrada). Solo se deshace la baja, mientras se pueda.
                        undoBlockers[item.id] ? (
                          <p className="max-w-56 text-right text-xs text-neutral-500">
                            {undoBlockers[item.id]}
                          </p>
                        ) : (
                          <div className="flex justify-end">
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={isPending}
                              onClick={() => handleUndoRetirement(item)}
                            >
                              Deshacer baja
                            </Button>
                          </div>
                        )
                      ) : (
                        <div className="flex items-center justify-end gap-1 whitespace-nowrap">
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
                            onClick={() => openRetire(item)}
                          >
                            Dar de baja
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
                      )}
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
            <div className={isAltaForm ? "grid gap-4 sm:grid-cols-2" : "grid gap-4 sm:grid-cols-3"}>
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
              {!isAltaForm && (
                <Input
                  label="Cota C0"
                  type="number"
                  step="any"
                  value={form.initialElevation}
                  onChange={set("initialElevation")}
                  error={errors.initialElevation}
                />
              )}
            </div>
            {isAltaForm && (
              <Input
                label="Fecha de alta"
                type="date"
                value={form.activeFrom}
                onChange={set("activeFrom")}
                error={errors.activeFrom}
              />
            )}
            {isAltaForm && (
              <p className="text-sm text-neutral-500">
                El monitoreo ya está en curso: el punto se da de alta y su
                línea base será su <strong>primera lectura</strong>, no la
                visita 0 del lugar. Por eso no lleva cota C0.
              </p>
            )}

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

      {retiring && (
        <Modal
          open
          onClose={() => setRetiring(null)}
          title={`Dar de baja ${retiring.code}`}
        >
          <form onSubmit={confirmRetire} className="flex flex-col gap-4">
            {retireError && <Alert variant="error">{retireError}</Alert>}
            <p className="text-sm text-neutral-700">
              El punto deja de medirse desde esta fecha. Sus lecturas
              anteriores se conservan y siguen contando en el análisis.
            </p>
            <Input
              label="De baja desde"
              type="date"
              value={retiredOn}
              onChange={(event) => setRetiredOn(event.target.value)}
              helperText="Primera fecha en que ya no se mide."
            />
            <Textarea
              label="Motivo"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Destruido, tapado, perdido…"
            />
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setRetiring(null)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Guardando…" : "Dar de baja"}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {pendingDelete && (
        <Modal
          open
          onClose={cancelPendingDelete}
          title="Eliminar punto con lecturas registradas"
        >
          <div className="flex flex-col gap-4">
            <Alert variant="warning">
              El punto <strong>{pendingDelete.point.code}</strong> tiene{" "}
              {pendingDelete.lecturasAfectadas}{" "}
              {pendingDelete.lecturasAfectadas === 1
                ? "lectura registrada"
                : "lecturas registradas"}{" "}
              en visitas abiertas. Si continúas, el punto y esas lecturas se
              eliminarán de forma permanente.
            </Alert>

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={cancelPendingDelete}
                disabled={isPending}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                variant="danger"
                onClick={confirmPendingDelete}
                disabled={isPending}
              >
                {isPending ? "Eliminando…" : "Eliminar de todos modos"}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </Card>
  );
}
