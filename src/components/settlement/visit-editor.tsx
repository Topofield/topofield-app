"use client";

import { useMemo, useState, useTransition, type ChangeEvent } from "react";
import { Alert, Button, Card, Input, Textarea } from "@/components/design-system";
import { CloseVisitDialog } from "@/components/settlement/close-visit-dialog";
import { ReadingsTable } from "@/components/settlement/readings-table";
import { computeHistory } from "@/lib/calculations/settlement";
import {
  closeVisitAction,
  saveVisitAction,
  type VisitPayload,
} from "@/app/(app)/projects/[id]/settlement/[siteId]/actions";
import type {
  PointInput,
  SettlementPoint,
  SettlementVisit,
  Thresholds,
  VisitInput,
} from "@/types/settlement";

interface VisitEditorProps {
  projectId: string;
  siteId: string;
  visit: SettlementVisit;
  /** Cotas ya guardadas de esta visita, para precargar el formulario. */
  initialElevations: Record<string, number>;
  points: SettlementPoint[];
  /** Resto de visitas del lugar (con sus lecturas), para el histórico. */
  otherVisits: VisitInput[];
  thresholds: Thresholds;
  /** Solo lectura si el lugar o la visita están cerrados. */
  disabled: boolean;
  /** El lugar está cerrado (además, o en vez de, la visita misma). */
  siteClosed: boolean;
}

interface HeaderState {
  date: string;
  operator: string;
  equipment: string;
  weatherConditions: string;
  closureErrorMm: string;
  notes: string;
}

function headerOf(visit: SettlementVisit): HeaderState {
  return {
    date: visit.date,
    operator: visit.operator ?? "",
    equipment: visit.equipment ?? "",
    weatherConditions: visit.weather_conditions ?? "",
    closureErrorMm:
      visit.closure_error_mm === null ? "" : String(visit.closure_error_mm),
    notes: visit.notes ?? "",
  };
}

function rawElevationsOf(
  points: SettlementPoint[],
  initialElevations: Record<string, number>,
): Record<string, string> {
  const result: Record<string, string> = {};
  for (const point of points) {
    const value = initialElevations[point.id];
    result[point.id] = value === undefined ? "" : String(value);
  }
  return result;
}

/**
 * Editor de una visita: cabecera + tabla de lecturas con cálculo en vivo.
 *
 * El histórico (`computeHistory`) se deriva en render con `useMemo`, no se
 * guarda en estado: es una función pura de las cotas capturadas (en
 * `rawElevations`) y del resto del histórico, así que mantenerlo en estado
 * solo abriría la puerta a que se desincronice de lo que el usuario tecleó.
 */
export function VisitEditor({
  projectId,
  siteId,
  visit,
  initialElevations,
  points,
  otherVisits,
  thresholds,
  disabled,
  siteClosed,
}: VisitEditorProps) {
  const [header, setHeader] = useState<HeaderState>(() => headerOf(visit));
  const [rawElevations, setRawElevations] = useState<Record<string, string>>(
    () => rawElevationsOf(points, initialElevations),
  );
  const [serverError, setServerError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  // Cambios sin guardar. Mismo patrón que `polygonal-editor.tsx`: se vuelve
  // `true` con cualquier edición y `false` solo tras un guardado exitoso. El
  // diálogo de cierre lo usa para no permitir confirmar mientras haya cambios
  // sin guardar — cerrar sellaría los valores VIEJOS de la base, de forma
  // irreversible (IMPORTANTE 1 de la ronda de correcciones).
  const [dirty, setDirty] = useState(false);
  const [isPending, startTransition] = useTransition();

  const [closeDialogOpen, setCloseDialogOpen] = useState(false);
  const [closeError, setCloseError] = useState<string | null>(null);
  const [isClosing, startCloseTransition] = useTransition();

  const isBaseline = visit.visit_number === 0;

  const pointInputs: PointInput[] = useMemo(
    () =>
      points.map((p) => ({
        id: p.id,
        code: p.code,
        northing: p.northing === null ? null : Number(p.northing),
        easting: p.easting === null ? null : Number(p.easting),
        initialElevation:
          p.initial_elevation === null ? null : Number(p.initial_elevation),
      })),
    [points],
  );

  const history = useMemo(() => {
    const candidate: VisitInput = {
      id: visit.id,
      visitNumber: visit.visit_number,
      date: header.date,
      readings: points
        .filter(
          (p) =>
            rawElevations[p.id]?.trim() !== "" &&
            rawElevations[p.id] !== undefined,
        )
        .map((p) => ({
          pointId: p.id,
          elevation: Number(rawElevations[p.id]),
        }))
        .filter((r) => Number.isFinite(r.elevation)),
    };
    const merged = [...otherVisits, candidate];
    return computeHistory(pointInputs, merged, thresholds);
  }, [rawElevations, header.date, points, otherVisits, pointInputs, thresholds, visit.id, visit.visit_number]);

  const computedVisit = history.visits.find((v) => v.visitId === visit.id);
  const computedByPoint: Record<string, (typeof history.visits)[number]["readings"][number] | undefined> = {};
  if (computedVisit) {
    for (const reading of computedVisit.readings) {
      computedByPoint[reading.pointId] = reading;
    }
  }

  const pointsMeasured = computedVisit?.readings.length ?? 0;
  const worstAlert = computedVisit?.worstAlert ?? "normal";

  function setField(key: keyof HeaderState) {
    return (
      event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
    ) => {
      setSaved(false);
      setDirty(true);
      setHeader((prev) => ({ ...prev, [key]: event.target.value }));
    };
  }

  function handleElevationChange(pointId: string, value: string) {
    setSaved(false);
    setDirty(true);
    setRawElevations((prev) => ({ ...prev, [pointId]: value }));
  }

  function handleSave() {
    setServerError(null);
    setSaved(false);

    const closureErrorMm =
      header.closureErrorMm.trim() === ""
        ? null
        : Number(header.closureErrorMm);
    if (closureErrorMm !== null && !Number.isFinite(closureErrorMm)) {
      setServerError("El error de cierre debe ser un número.");
      return;
    }

    const payload: VisitPayload = {
      siteId,
      visitId: visit.id,
      date: header.date,
      operator: header.operator.trim() === "" ? null : header.operator.trim(),
      equipment: header.equipment.trim() === "" ? null : header.equipment.trim(),
      weatherConditions:
        header.weatherConditions.trim() === ""
          ? null
          : header.weatherConditions.trim(),
      closureErrorMm,
      notes: header.notes.trim() === "" ? null : header.notes.trim(),
      readings: points
        .filter(
          (p) =>
            rawElevations[p.id]?.trim() !== "" &&
            rawElevations[p.id] !== undefined,
        )
        .map((p) => ({
          pointId: p.id,
          elevation: Number(rawElevations[p.id]),
        }))
        .filter((r) => Number.isFinite(r.elevation)),
    };

    startTransition(async () => {
      const response = await saveVisitAction(projectId, payload);
      if (response.ok) {
        setSaved(true);
        setDirty(false);
      } else {
        setServerError(response.error ?? "Ocurrió un error al guardar.");
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
    setCloseError(null);
    startCloseTransition(async () => {
      const response = await closeVisitAction(projectId, siteId, visit.id);
      if (response.ok) {
        setCloseDialogOpen(false);
      } else {
        // No se cierra el modal: el error (p. ej. lecturas incompletas) hay
        // que verlo junto al resumen que se estaba confirmando.
        setCloseError(response.error ?? "No se pudo cerrar la visita.");
      }
    });
  }

  const closedLabel =
    visit.status === "closed" && visit.closed_at
      ? new Intl.DateTimeFormat("es-CO", {
          dateStyle: "long",
          timeStyle: "short",
          timeZone: "America/Bogota",
        }).format(new Date(visit.closed_at))
      : null;

  return (
    <div className="flex flex-col gap-6">
      <Card
        title={
          isBaseline
            ? "Visita 0 — Línea base"
            : `Visita ${visit.visit_number}`
        }
      >
        {serverError && (
          <Alert variant="error" className="mb-4">
            {serverError}
          </Alert>
        )}
        {saved && !serverError && (
          <Alert variant="success" className="mb-4">
            Visita guardada.
          </Alert>
        )}
        {isBaseline && (
          <Alert variant="info" className="mb-4">
            Esta es la línea base del lugar: no tiene visita anterior, así que
            no muestra asentamiento parcial ni velocidad.
          </Alert>
        )}
        {closedLabel && (
          <Alert variant="info" className="mb-4">
            Visita cerrada el {closedLabel}. Queda en solo lectura.
          </Alert>
        )}
        {!closedLabel && siteClosed && (
          <Alert variant="info" className="mb-4">
            El lugar está cerrado; esta visita quedó en solo lectura.
          </Alert>
        )}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Input
            label="Fecha"
            type="date"
            value={header.date}
            onChange={setField("date")}
            disabled={disabled}
          />
          <Input
            label="Operador"
            value={header.operator}
            onChange={setField("operator")}
            disabled={disabled}
          />
          <Input
            label="Equipo"
            value={header.equipment}
            onChange={setField("equipment")}
            disabled={disabled}
          />
          <Input
            label="Condiciones climáticas"
            value={header.weatherConditions}
            onChange={setField("weatherConditions")}
            disabled={disabled}
          />
          <Input
            label="Error de cierre (mm)"
            type="number"
            step="any"
            value={header.closureErrorMm}
            onChange={setField("closureErrorMm")}
            disabled={disabled}
          />
        </div>
        <div className="mt-4">
          <Textarea
            label="Notas"
            value={header.notes}
            onChange={setField("notes")}
            disabled={disabled}
          />
        </div>
      </Card>

      <Card title="Lecturas">
        <ReadingsTable
          points={points}
          rawElevations={rawElevations}
          onElevationChange={handleElevationChange}
          computedByPoint={computedByPoint}
          isBaseline={isBaseline}
          disabled={disabled}
        />
      </Card>

      {!disabled && (
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={openCloseDialog} disabled={isPending}>
            Cerrar Visita
          </Button>
          <Button onClick={handleSave} disabled={isPending}>
            {isPending ? "Guardando…" : "Guardar visita"}
          </Button>
        </div>
      )}

      <CloseVisitDialog
        open={closeDialogOpen}
        onClose={closeCloseDialog}
        onConfirm={handleConfirmClose}
        isPending={isClosing}
        error={closeError}
        visitDate={header.date}
        pointsMeasured={pointsMeasured}
        worstAlert={worstAlert}
        dirty={dirty}
      />
    </div>
  );
}
