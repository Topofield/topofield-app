"use client";

import { useState, useTransition } from "react";
import { Alert, Button, EMPTY_DMS, Input, Modal, NumberInput, type DmsValue } from "@/components/design-system";
import { averageReadings, dmsToDecimal, readingSpreadSeconds } from "@/lib/calculations/angles";
import { parseNumber, readNumberText } from "@/lib/utils/parse";
import { readingDmsError, validatePolygonalStation } from "@/lib/validators/polygonal";
import { cn } from "@/lib/utils/cn";
import {
  DEFLECTION_DIRECTIONS,
  DEFLECTION_DIRECTION_LABELS,
  type AngleInputFormat,
  type DeflectionDirection,
} from "@/types/polygonal";
import { AngleInput } from "./angle-input";
import { dmsFromFields, fieldsOf, formatAngle } from "./angle-format";
import {
  addClosingAngle,
  addMeasurement,
  canClose,
  closingAngleSpot,
  closingTarget,
  currentStation,
  editMeasurement,
  isClosed,
  measuresAngle,
  removeMeasurement,
} from "./capture-edits";
import type { Dms3, PolygonalDraft } from "./polygonal-save";

/** Qué hace el popup: medir desde el punto actual, editar una medición o el cierre angular. */
export type MeasurementMode = { kind: "add" } | { kind: "edit"; index: number } | { kind: "closing" };

interface MeasurementDialogProps {
  mode: MeasurementMode;
  draft: PolygonalDraft;
  /** El código de la referencia del 0 atrás, o `null` sin amarre. */
  referenceLabel: string | null;
  angleFormat: AngleInputFormat;
  onSave: (next: PolygonalDraft) => Promise<{ ok: boolean; error?: string }>;
  /** Tras guardar, sigue con otra medición o con el cierre angular. */
  onContinue: (mode: MeasurementMode) => void;
  onClose: () => void;
}

/** Qué se mide y desde dónde, según el modo. */
function contextOf(mode: MeasurementMode, d: PolygonalDraft, referenceLabel: string | null) {
  if (mode.kind === "closing") {
    const spot = closingAngleSpot(d, referenceLabel);
    const st = spot ? d.stations[spot.index] : undefined;
    return { index: spot?.index ?? 0, from: spot?.at ?? "", back: spot?.back ?? null, station: st, spot };
  }
  if (mode.kind === "edit") {
    const st = d.stations[mode.index];
    const n = d.stations.length;
    const back =
      mode.index > 0
        ? (d.stations[mode.index - 1]?.pointCode ?? null)
        : d.amarre.referencePointId !== null || d.amarre.referenceCode !== null
          ? referenceLabel
          : d.details.type === "closed" && isClosed(d)
            ? (d.stations[n - 1]?.pointCode ?? null)
            : null;
    return { index: mode.index, from: st?.pointCode ?? "", back, station: st, spot: null };
  }
  const cur = currentStation(d, referenceLabel);
  return { index: cur.index, from: cur.code, back: cur.back, station: d.stations[cur.index], spot: null };
}

/**
 * El popup de una medición (Fase 35, maqueta «Medición B»): desde el punto
 * actual, las lecturas del ángulo con su promedio, la distancia al siguiente y,
 * en la cerrada, la casilla de cierre. Guarda al confirmar; si el guardado
 * falla, el error queda aquí y no se pierde lo tecleado.
 */
export function MeasurementDialog({
  mode,
  draft,
  referenceLabel,
  angleFormat,
  onSave,
  onContinue,
  onClose,
}: MeasurementDialogProps) {
  const ctx = contextOf(mode, draft, referenceLabel);
  const controlled = draft.details.type === "open_controlled";
  const oriented = draft.amarre.referencePointId !== null || draft.amarre.referenceCode !== null;
  const n = draft.stations.length;
  // El lado que cierra: su punto siguiente es el de cierre o el de llegada, y no se renombra.
  const closingSide = isClosed(draft) ? (draft.details.type === "closed" && !oriented ? n - 1 : n - 2) : -1;
  const editingClosingSide = mode.kind === "edit" && mode.index === closingSide;
  const nextCode =
    mode.kind === "edit"
      ? (draft.stations[mode.index + 1]?.pointCode ??
        (draft.details.type === "closed" && !oriented ? (draft.stations[0]?.pointCode ?? "") : ""))
      : "";

  const initialReadings = (): DmsValue[] => {
    const stored = mode.kind === "add" ? [] : (ctx.station?.readings ?? []);
    return stored.length > 0 ? stored.map(fieldsOf) : [{ ...EMPTY_DMS }];
  };
  const [readings, setReadings] = useState<DmsValue[]>(initialReadings);
  const [next, setNext] = useState(nextCode);
  const [distance, setDistance] = useState(
    mode.kind === "edit" && ctx.station?.distance != null ? String(ctx.station.distance) : "",
  );
  const [direction, setDirection] = useState<DeflectionDirection>(ctx.station?.deflectionDirection ?? "right");
  const [closes, setCloses] = useState(false);
  const [toReference, setToReference] = useState(
    mode.kind !== "closing" || draft.amarre.hasClosingRow || (ctx.station?.readings.length ?? 0) === 0,
  );
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const withAngle = mode.kind === "closing" || measuresAngle(draft, ctx.index);
  const withDirection = controlled && (mode.kind === "closing" || ctx.index > 0);
  const withDistance = mode.kind !== "closing";
  const offerClose = mode.kind === "add" && canClose(draft);
  const target = closingTarget(draft);
  const to = closes ? (target ?? "") : next.trim();
  const nextEditable = mode.kind === "add" ? !closes : !editingClosingSide && nextCode !== "";

  // El promedio de las lecturas válidas, con su dispersión.
  const decimals = readings
    .map(dmsFromFields)
    .filter((r): r is Dms3 => r !== null && readingDmsError(r) === null)
    .map((r) => dmsToDecimal(r.deg, r.min, r.sec));
  const average = averageReadings(decimals);
  const spread = readingSpreadSeconds(decimals);

  function readAngles(): Dms3[] | string {
    if (!withAngle) return [];
    const typed = readings.filter((r) => [r.deg, r.min, r.sec].some((v) => v.trim() !== ""));
    if (typed.length === 0) return "El ángulo es obligatorio: teclea al menos una lectura.";
    const out: Dms3[] = [];
    for (const [i, fields] of typed.entries()) {
      const dms = dmsFromFields(fields);
      if (dms === null) return `Lectura ${i + 1}: no es un número.`;
      const problem = readingDmsError(dms);
      if (problem) return `Lectura ${i + 1}: ${problem}`;
      out.push(dms);
    }
    return out;
  }

  function readDistance(): number | null | string {
    if (!withDistance) return null;
    if (readNumberText(distance).kind !== "number") return "La distancia es obligatoria.";
    const value = parseNumber(distance);
    const problem = validatePolygonalStation(
      { pointCode: "x", angleDeg: null, angleMin: null, angleSec: null, distance: value },
      { angle: false, distance: true },
    ).errors.distance;
    return problem ?? value;
  }

  function nextProblem(): string | null {
    if (!nextEditable) return null;
    const code = next.trim();
    if (code === "") return "El punto siguiente necesita un nombre.";
    if (target !== null && code === target && mode.kind === "add") {
      return draft.details.type === "closed"
        ? `Para volver a ${target}, marca la casilla Cierre.`
        : `Para llegar a ${target}, marca la casilla Llegada.`;
    }
    const others = draft.stations.filter((_, i) => i !== ctx.index + 1).map((s) => s.pointCode);
    if ([draft.amarre.startCode, ...others].includes(code)) return `Ya hay un punto ${code} en la poligonal.`;
    return null;
  }

  function resetForNext() {
    setReadings([{ ...EMPTY_DMS }]);
    setNext("");
    setDistance("");
    setCloses(false);
    setDirection("right");
  }

  function commit(nextDraft: PolygonalDraft, after: MeasurementMode | "close") {
    setError(null);
    startTransition(async () => {
      const response = await onSave(nextDraft);
      if (!response.ok) {
        setError(response.error ?? "No se pudo guardar la medición.");
        return;
      }
      if (after === "close") {
        onClose();
        return;
      }
      resetForNext();
      onContinue(after);
    });
  }

  function submit(intent: "continue" | "finish") {
    const angles = readAngles();
    if (typeof angles === "string") return setError(angles);
    const dirValue = withDirection ? direction : null;

    if (mode.kind === "closing") {
      return commit(addClosingAngle(draft, { readings: angles, toReference, deflectionDirection: dirValue }), "close");
    }
    const dist = readDistance();
    if (typeof dist === "string") return setError(dist);
    const problem = nextProblem();
    if (problem) return setError(problem);

    if (mode.kind === "edit") {
      return commit(
        editMeasurement(draft, mode.index, { next, readings: angles, distance: dist, deflectionDirection: dirValue }),
        "close",
      );
    }
    const added = addMeasurement(draft, { next, readings: angles, distance: dist, deflectionDirection: dirValue, closes });
    if (closes) {
      // Cerrada o llegada: si queda un cierre angular por medir, se sigue con él.
      const spot = closingAngleSpot(added, referenceLabel);
      return commit(added, spot && intent === "continue" ? { kind: "closing" } : "close");
    }
    commit(added, intent === "continue" ? { kind: "add" } : "close");
  }

  const removal =
    mode.kind === "edit"
      ? removeMeasurement(draft, mode.index)
      : mode.kind === "closing" && (ctx.station?.readings.length ?? 0) > 0
        ? removeMeasurement(draft, ctx.index)
        : draft;
  const canRemove = removal !== draft;
  const intermediate = mode.kind === "edit" && removal.stations.length === n - 1 && mode.index < n - 2;

  const title =
    mode.kind === "closing" ? "Cierre angular" : mode.kind === "edit" ? "Editar medición" : "Agregar medición";
  const where =
    mode.kind === "closing"
      ? controlled
        ? `Deflexión en ${ctx.from} · atrás en ${ctx.back}, hacia la dirección de llegada`
        : `En ${ctx.from} · atrás en ${ctx.back}`
      : ctx.back
        ? `${mode.kind === "edit" ? "Medición desde" : "Estás en"} ${ctx.from} · atrás en ${ctx.back}`
        : `${mode.kind === "edit" ? "Medición desde" : "Estás en"} ${ctx.from} · sin 0 atrás`;

  const primaryLabel =
    mode.kind === "closing"
      ? "Guardar el cierre angular"
      : mode.kind === "edit"
        ? "Guardar"
        : closes
          ? draft.details.type === "closed"
            ? "Agregar el cierre"
            : "Agregar la llegada"
          : `Agregar y seguir en ${next.trim() || "…"}`;

  return (
    <Modal
      open
      onClose={onClose}
      title={title}
      footer={
        <div className="flex w-full flex-wrap items-center justify-between gap-2">
          {canRemove ? (
            <Button type="button" variant="danger" size="sm" disabled={isPending} onClick={() => commit(removal, "close")}>
              {mode.kind === "closing" ? "Quitar el cierre angular" : "Eliminar medición"}
            </Button>
          ) : (
            <span />
          )}
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancelar
            </Button>
            {mode.kind === "add" && !closes && (
              <Button type="button" variant="secondary" disabled={isPending} onClick={() => submit("finish")}>
                Terminar
              </Button>
            )}
            <Button type="button" disabled={isPending} onClick={() => submit("continue")}>
              {isPending ? "Guardando…" : primaryLabel}
            </Button>
          </div>
        </div>
      }
    >
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          submit("continue");
        }}
      >
        <p className="rounded-md bg-sel px-3 py-2 text-sm font-medium">{where}</p>
        {error && <Alert variant="error">{error}</Alert>}

        {mode.kind === "closing" && !controlled && oriented && (
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              className="mt-0.5 size-4"
              checked={toReference}
              onChange={(e) => setToReference(e.target.checked)}
            />
            <span>
              El ángulo va hacia {referenceLabel ?? "la referencia"}, la referencia del amarre
              <span className="block text-ink-2">
                {toReference
                  ? "La cartera cierra contra el amarre."
                  : `Si no, va hacia ${draft.stations[1]?.pointCode ?? "el primer lado"}: el ángulo del vértice de arranque.`}
              </span>
            </span>
          </label>
        )}
        {mode.kind === "closing" && !controlled && !oriented && ctx.spot && (
          <p className="text-sm text-ink-2">
            El ángulo en {ctx.from}, entre {ctx.spot.back} (atrás) y {ctx.spot.ahead} (adelante).
          </p>
        )}

        {mode.kind !== "closing" &&
          (nextEditable ? (
            <Input
              label="Punto siguiente"
              value={next}
              onChange={(e) => setNext(e.target.value)}
              placeholder="D1"
              autoFocus={mode.kind === "add"}
            />
          ) : (
            <p className="text-sm">
              Punto siguiente: <span className="font-semibold">{mode.kind === "add" ? to : nextCode}</span>
            </p>
          ))}

        {offerClose && target && (
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" className="mt-0.5 size-4" checked={closes} onChange={(e) => setCloses(e.target.checked)} />
            <span>
              {draft.details.type === "closed"
                ? `Cierre: este lado vuelve a ${target}`
                : `Llegada: este lado llega a ${target}`}
            </span>
          </label>
        )}

        {withAngle && (
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-sm font-medium">
              {controlled && ctx.index > 0 ? "Lecturas de la deflexión" : "Lecturas del ángulo"}
            </legend>
            {readings.map((reading, i) => (
              <div key={i} className="flex flex-wrap items-end gap-2">
                <AngleInput
                  label={`Lectura ${i + 1}`}
                  value={reading}
                  format={angleFormat}
                  onChange={(v) => setReadings((rs) => rs.map((r, j) => (j === i ? v : r)))}
                />
                {readings.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    aria-label={`Quitar la lectura ${i + 1}`}
                    onClick={() => setReadings((rs) => rs.filter((_, j) => j !== i))}
                  >
                    Quitar
                  </Button>
                )}
              </div>
            ))}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setReadings((rs) => [...rs, { ...EMPTY_DMS }])}
              >
                + Lectura
              </Button>
              {decimals.length > 1 && average !== null && (
                <p className="text-sm text-ink-2">
                  Promedio <span className="font-semibold text-ink">{formatAngle(average, angleFormat)}</span>
                  {spread !== null && <> · dispersión {spread.toFixed(1)}″</>}
                </p>
              )}
            </div>
          </fieldset>
        )}

        {withDirection && (
          <fieldset className="flex flex-col gap-1.5">
            <legend className="mb-1 text-sm font-medium">Sentido</legend>
            <div className="grid grid-cols-2 overflow-hidden rounded-md border border-rule-strong">
              {DEFLECTION_DIRECTIONS.map((d) => (
                <label
                  key={d}
                  className={cn(
                    "flex min-h-11 cursor-pointer items-center justify-center border-r border-rule px-2 text-sm font-medium last:border-r-0",
                    direction === d ? "bg-mira-bg text-mira-ink" : "text-ink-2 hover:bg-sel",
                  )}
                >
                  <input
                    type="radio"
                    name="sentido-deflexion"
                    className="sr-only"
                    checked={direction === d}
                    onChange={() => setDirection(d)}
                  />
                  {DEFLECTION_DIRECTION_LABELS[d]}
                </label>
              ))}
            </div>
          </fieldset>
        )}

        {withDistance && (
          <NumberInput
            label={`Distancia horizontal ${ctx.from} → ${to || nextCode || "…"} (m)`}
            value={distance}
            onChange={(e) => setDistance(e.target.value)}
          />
        )}

        {intermediate && (
          <p className="text-sm text-ink-2">
            Al eliminarla, {draft.stations[mode.index + 1]?.pointCode} pasa a medirse desde{" "}
            {draft.stations[mode.index - 1]?.pointCode}. Las filas siguientes se recalculan.
          </p>
        )}
      </form>
    </Modal>
  );
}
