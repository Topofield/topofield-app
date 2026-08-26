"use client";

import { useMemo, useState, useTransition } from "react";
import {
  Alert,
  Badge,
  Breadcrumbs,
  Button,
  buttonClasses,
  Card,
} from "@/components/design-system";
import { PROCESS_STATUS_LABELS, type ProcessStatus } from "@/types/polygonal";
import { computeLeveling } from "@/lib/calculations/leveling";
import { parseNumber } from "@/lib/utils/parse";
import {
  hasReadingErrors,
  validateRunCapture,
  type ReadingCaptureIssues,
} from "@/lib/validators/leveling";
import { saveLevelingProcessAction } from "@/app/(app)/projects/[id]/leveling/[pid]/actions";
import type { ReadingDraft } from "@/app/(app)/projects/[id]/leveling/[pid]/actions";
import {
  RUN_TYPE_LABELS,
  type LevelingInput,
  type LevelingProcess,
  type LevelingReading,
  type ReadingInput,
  type RunType,
} from "@/types/leveling";
import type { PrecisionOrder, ReferencePoint } from "@/types/project";
import {
  LevelingConfigFields,
  type LevelingConfigState,
} from "./leveling-config-fields";
import type { BmValue } from "./bm-selector";
import { CloseProcessDialog } from "./close-process-dialog";
import { ReadingsTable, type ReadingDraftState } from "./readings-table";
import { ResultsPanel } from "./results-panel";
import { RunTabs } from "./run-tabs";

const STATUS_TONE: Record<
  ProcessStatus,
  "neutral" | "primary" | "success" | "danger"
> = {
  draft: "neutral",
  in_progress: "neutral",
  calculated: "primary",
  closed: "success",
  rejected: "danger",
};

function bmValue(code: string | null, elevation: number | null): BmValue {
  return {
    code: code ?? "",
    elevation: elevation != null ? String(elevation) : "",
  };
}

function processToConfig(p: LevelingProcess): LevelingConfigState {
  return {
    name: p.name,
    type: p.type,
    startBm: bmValue(p.start_bm_code, p.start_bm_elevation),
    endBm: bmValue(p.end_bm_code, p.end_bm_elevation),
    hasReturnRun: p.has_return_run,
  };
}

function readingToDraft(r: LevelingReading): ReadingDraftState {
  return {
    id: crypto.randomUUID(),
    pointCode: r.point_code,
    pointType: r.point_type,
    backsight: r.backsight != null ? String(r.backsight) : "",
    foresight: r.foresight != null ? String(r.foresight) : "",
    distanceM: r.distance_m != null ? String(r.distance_m) : "",
    distanceAccumulatedKm:
      r.distance_accumulated_km != null ? String(r.distance_accumulated_km) : "",
  };
}

function draftToReadingInput(d: ReadingDraftState): ReadingInput {
  return {
    pointCode: d.pointCode,
    pointType: d.pointType,
    backsight: parseNumber(d.backsight),
    foresight: parseNumber(d.foresight),
    distanceM: parseNumber(d.distanceM),
    distanceAccumulatedKm: parseNumber(d.distanceAccumulatedKm),
  };
}

function draftToReadingDraft(d: ReadingDraftState): ReadingDraft {
  return {
    pointCode: d.pointCode,
    pointType: d.pointType,
    backsight: parseNumber(d.backsight),
    foresight: parseNumber(d.foresight),
    distanceM: parseNumber(d.distanceM),
    distanceAccumulatedKm: parseNumber(d.distanceAccumulatedKm),
  };
}

function buildInput(
  config: LevelingConfigState,
  totalDistanceKm: string,
  forward: ReadingDraftState[],
  back: ReadingDraftState[],
  order: PrecisionOrder,
): LevelingInput {
  return {
    type: config.type,
    startElevation: parseNumber(config.startBm.elevation) ?? Number.NaN,
    endElevation:
      config.type === "link" ? parseNumber(config.endBm.elevation) : null,
    order,
    totalDistanceKm: parseNumber(totalDistanceKm) ?? Number.NaN,
    forward: forward.map(draftToReadingInput),
    return: config.hasReturnRun ? back.map(draftToReadingInput) : null,
  };
}

interface LevelingEditorProps {
  process: LevelingProcess;
  readings: LevelingReading[];
  projectId: string;
  projectName: string;
  points: ReferencePoint[];
  precisionOrder: PrecisionOrder;
}

/** Editor de un proceso de nivelación: libreta de campo y cálculo en vivo. */
export function LevelingEditor({
  process,
  readings: initialReadings,
  projectId,
  projectName,
  points,
  precisionOrder,
}: LevelingEditorProps) {
  const readOnly = process.status === "closed" || process.status === "rejected";

  const [config, setConfig] = useState(() => processToConfig(process));
  const [totalDistanceKm, setTotalDistanceKm] = useState(
    process.total_distance_km != null ? String(process.total_distance_km) : "",
  );
  const [forward, setForward] = useState(() =>
    initialReadings.filter((r) => r.run_type === "forward").map(readingToDraft),
  );
  const [back, setBack] = useState(() =>
    initialReadings.filter((r) => r.run_type === "return").map(readingToDraft),
  );
  const [activeRun, setActiveRun] = useState<RunType>("forward");
  const [error, setError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Cálculo en vivo: se deriva en cada render, sin useEffect.
  const result = useMemo(
    () =>
      computeLeveling(
        buildInput(config, totalDistanceKm, forward, back, precisionOrder),
      ),
    [config, totalDistanceKm, forward, back, precisionOrder],
  );

  // validateRunCapture (no validateReadingCapture fila a fila) porque el
  // error de la fila `bm` inicial sin L.At depende de su POSICIÓN en el
  // recorrido, no solo de sus propios campos.
  const forwardIssues = useMemo<ReadingCaptureIssues[]>(
    () => validateRunCapture(forward.map(draftToReadingInput), config.type),
    [forward, config.type],
  );
  const backIssues = useMemo<ReadingCaptureIssues[]>(
    () => validateRunCapture(back.map(draftToReadingInput), config.type),
    [back, config.type],
  );

  const captureBlocked =
    hasReadingErrors(forwardIssues) ||
    (config.hasReturnRun && hasReadingErrors(backIssues));

  // La cota del BM de partida (y, en `link`, la de llegada) es el único dato
  // de entrada que ninguna validación posterior puede atrapar: desplaza todas
  // las cotas por igual y el error de cierre sigue dando exacto (ver
  // `bm-selector.tsx`). La ruta `/new` ya lo exige al crear el proceso; el
  // editor debe exigirlo también al guardar, o un campo vaciado por el
  // usuario ("Otro (entrada libre)" sin cota) persistiría como `0` en
  // silencio. `parseNumber` devuelve `null` tanto si el campo está vacío como
  // si el texto no es un número válido, así que ambos casos bloquean aquí.
  const startElevationInvalid = parseNumber(config.startBm.elevation) == null;
  const endElevationInvalid =
    config.type === "link" && parseNumber(config.endBm.elevation) == null;
  const configBlocked = startElevationInvalid || endElevationInvalid;

  function handleSave() {
    setError(null);
    // Defensa en profundidad: el botón ya queda disabled con configBlocked,
    // pero handleSave no debe persistir una cota inventada (`?? 0`) bajo
    // ninguna vía de invocación. Ver bm-selector.tsx: un 0 aquí desplaza
    // todas las cotas del proceso en silencio y ninguna validación posterior
    // lo detecta.
    if (configBlocked) {
      setError(
        startElevationInvalid
          ? "La cota del BM de partida es obligatoria y debe ser un número."
          : "La cota del BM de llegada es obligatoria y debe ser un número.",
      );
      return;
    }
    startTransition(async () => {
      const response = await saveLevelingProcessAction({
        processId: process.id,
        name: config.name,
        type: config.type,
        startBmCode: config.startBm.code,
        startBmElevation: parseNumber(config.startBm.elevation) ?? 0,
        endBmCode:
          config.type === "link" ? config.endBm.code.trim() || null : null,
        endBmElevation:
          config.type === "link" ? parseNumber(config.endBm.elevation) : null,
        hasReturnRun: config.hasReturnRun,
        totalDistanceKm: parseNumber(totalDistanceKm) ?? 0,
        notes: process.notes,
        forward: forward.map(draftToReadingDraft),
        return: config.hasReturnRun ? back.map(draftToReadingDraft) : [],
      });
      if (response.ok) {
        setDirty(false);
        setSaveMessage("Proceso guardado.");
      } else {
        setError(response.error ?? "No se pudo guardar el proceso.");
      }
    });
  }

  function handleConfigChange(next: LevelingConfigState) {
    setConfig(next);
    setDirty(true);
    setSaveMessage(null);
    // Al desactivar la vuelta se limpia su libreta en el mismo evento: el
    // BmSelector de la Tarea 9 documenta el mismo riesgo de estado rancio si
    // no se limpia junto al cambio que oculta al componente.
    if (!next.hasReturnRun && back.length > 0) {
      setBack([]);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Breadcrumbs
          items={[
            { label: "Dashboard", href: "/dashboard" },
            { label: projectName, href: `/projects/${projectId}?tab=processes` },
            { label: process.name },
          ]}
        />
        <div className="mt-2 flex items-center justify-between gap-4">
          <h1 className="text-2xl font-bold">{process.name}</h1>
          <div className="flex items-center gap-3">
            <Badge tone={STATUS_TONE[process.status]}>
              {PROCESS_STATUS_LABELS[process.status]}
            </Badge>
            <a
              href={`/projects/${projectId}/leveling/${process.id}/export`}
              className={buttonClasses({ variant: "secondary", size: "sm" })}
              download
            >
              Exportar a Excel
            </a>
          </div>
        </div>
      </div>

      {readOnly &&
        process.status === "closed" &&
        process.meets_tolerance === false && (
          <Alert variant="warning">
            Este proceso se cerró sin alcanzar la tolerancia del orden de
            precisión. Los datos son de solo lectura.
          </Alert>
        )}
      {readOnly &&
        !(process.status === "closed" && process.meets_tolerance === false) && (
          <Alert variant="info">
            {process.status === "rejected"
              ? "Este proceso fue rechazado; los datos son de solo lectura."
              : "Este proceso está cerrado; los datos son de solo lectura."}
          </Alert>
        )}
      {error && <Alert variant="error">{error}</Alert>}
      {saveMessage && <Alert variant="success">{saveMessage}</Alert>}

      <details
        open={process.status === "draft" || process.status === "in_progress"}
        className="group rounded-lg border border-neutral-200 bg-white shadow-sm"
      >
        <summary className="flex cursor-pointer list-none items-center justify-between px-5 py-4 text-base font-semibold text-neutral-900 marker:content-none">
          <h2 className="text-base font-semibold">Configuración</h2>
          <svg
            aria-hidden="true"
            viewBox="0 0 20 20"
            fill="none"
            className="h-4 w-4 shrink-0 rotate-0 text-neutral-500 transition-transform group-open:rotate-90 motion-reduce:transition-none"
          >
            <path
              d="M7.5 4.5L13 10l-5.5 5.5"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </summary>
        <div className="flex flex-col gap-4 border-t border-neutral-100 px-5 py-4">
          <LevelingConfigFields
            value={config}
            disabled={readOnly}
            points={points}
            precisionOrder={precisionOrder}
            onChange={handleConfigChange}
          />
          <div className="max-w-xs">
            <label className="flex flex-col gap-1 text-sm font-medium text-neutral-800">
              Distancia total del recorrido (km)
              <input
                type="number"
                step="any"
                inputMode="decimal"
                value={totalDistanceKm}
                disabled={readOnly}
                className="h-10 rounded-md border border-neutral-400 bg-white px-3 text-base text-neutral-900 disabled:bg-neutral-100 disabled:text-neutral-500"
                onChange={(e) => {
                  setTotalDistanceKm(e.target.value);
                  setDirty(true);
                  setSaveMessage(null);
                }}
              />
            </label>
          </div>
        </div>
      </details>

      <Card
        title={
          config.hasReturnRun
            ? "Libreta"
            : `Libreta — ${RUN_TYPE_LABELS.forward}`
        }
      >
        <div className="flex flex-col gap-4">
          {config.hasReturnRun && (
            <RunTabs active={activeRun} onChange={setActiveRun} />
          )}
          {(!config.hasReturnRun || activeRun === "forward") && (
            <ReadingsTable
              readings={forward}
              computed={result.forward.readings}
              issues={forwardIssues}
              disabled={readOnly}
              onChange={(v) => {
                setForward(v);
                setDirty(true);
                setSaveMessage(null);
              }}
            />
          )}
          {config.hasReturnRun && activeRun === "return" && (
            <ReadingsTable
              readings={back}
              computed={result.return?.readings ?? []}
              issues={backIssues}
              disabled={readOnly}
              onChange={(v) => {
                setBack(v);
                setDirty(true);
                setSaveMessage(null);
              }}
            />
          )}
        </div>
      </Card>

      <ResultsPanel result={result} type={config.type} />

      {!readOnly && (
        <div className="flex flex-wrap items-center justify-end gap-3">
          {configBlocked && (
            <span className="text-sm text-danger-500">
              {startElevationInvalid
                ? "La cota del BM de partida es obligatoria y debe ser un número."
                : "La cota del BM de llegada es obligatoria y debe ser un número."}
            </span>
          )}
          {!configBlocked && captureBlocked && (
            <span className="text-sm text-danger-500">
              Corrige las celdas con error para poder guardar.
            </span>
          )}
          {!configBlocked && !captureBlocked && dirty && (
            <span className="text-sm text-neutral-500">
              Hay cambios sin guardar.
            </span>
          )}
          <Button
            onClick={handleSave}
            disabled={isPending || captureBlocked || configBlocked}
          >
            {isPending ? "Guardando…" : "Guardar"}
          </Button>
          <span aria-hidden className="h-6 w-px bg-neutral-200" />
          <CloseProcessDialog
            processId={process.id}
            type={config.type}
            result={result}
            captureBlocked={captureBlocked || configBlocked}
            dirty={dirty}
          />
        </div>
      )}
    </div>
  );
}
