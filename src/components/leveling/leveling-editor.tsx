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
import {
  computeLeveling,
  totalDistanceFromReadings,
} from "@/lib/calculations/leveling";
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
import { configWithImport, ImportDialog, type LevelingImport } from "./import-dialog";
import type { LibretaRow } from "@/lib/import/leveling";

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
    precisionOrder: p.precision_order,
    level: {
      equipmentBrand: p.equipment_brand ?? "",
      equipmentModel: p.equipment_model ?? "",
      equipmentSerial: p.equipment_serial ?? "",
      equipmentCalibrationDate: p.equipment_calibration_date ?? "",
      levelType: p.level_type ?? "",
      kmPrecisionMm: p.km_precision_mm != null ? String(p.km_precision_mm) : "",
    },
  };
}

function str(value: number | null): string {
  return value != null ? String(value) : "";
}

function readingToDraft(r: LevelingReading): ReadingDraftState {
  return {
    id: crypto.randomUUID(),
    pointCode: r.point_code,
    pointType: r.point_type,
    backsight: str(r.backsight),
    foresight: str(r.foresight),
    backUpperM: str(r.back_upper_m),
    backLowerM: str(r.back_lower_m),
    foreUpperM: str(r.fore_upper_m),
    foreLowerM: str(r.fore_lower_m),
    backDistanceM: str(r.back_distance_m),
    foreDistanceM: str(r.fore_distance_m),
  };
}

/** Una fila importada (Fase 16) como fila del borrador: sin hilos. */
function importedToDraft(r: LibretaRow): ReadingDraftState {
  return {
    id: crypto.randomUUID(),
    pointCode: r.pointCode,
    pointType: r.pointType,
    backsight: r.backsight != null ? r.backsight.toFixed(4) : "",
    foresight: r.foresight != null ? r.foresight.toFixed(4) : "",
    backUpperM: "",
    backLowerM: "",
    foreUpperM: "",
    foreLowerM: "",
    backDistanceM: r.backDistanceM != null ? r.backDistanceM.toFixed(3) : "",
    foreDistanceM: r.foreDistanceM != null ? r.foreDistanceM.toFixed(3) : "",
  };
}

function draftToReadingInput(d: ReadingDraftState): ReadingInput {
  return {
    pointCode: d.pointCode,
    pointType: d.pointType,
    backsight: parseNumber(d.backsight),
    foresight: parseNumber(d.foresight),
    backUpperM: parseNumber(d.backUpperM),
    backLowerM: parseNumber(d.backLowerM),
    foreUpperM: parseNumber(d.foreUpperM),
    foreLowerM: parseNumber(d.foreLowerM),
    backDistanceM: parseNumber(d.backDistanceM),
    foreDistanceM: parseNumber(d.foreDistanceM),
    // Derivado por el motor; el cliente no lo envía.
    distanceAccumulatedKm: null,
  };
}

function draftToReadingDraft(d: ReadingDraftState): ReadingDraft {
  return {
    pointCode: d.pointCode,
    pointType: d.pointType,
    backsight: parseNumber(d.backsight),
    foresight: parseNumber(d.foresight),
    backUpperM: parseNumber(d.backUpperM),
    backLowerM: parseNumber(d.backLowerM),
    foreUpperM: parseNumber(d.foreUpperM),
    foreLowerM: parseNumber(d.foreLowerM),
    backDistanceM: parseNumber(d.backDistanceM),
    foreDistanceM: parseNumber(d.foreDistanceM),
  };
}

function buildInput(
  config: LevelingConfigState,
  forward: ReadingDraftState[],
  back: ReadingDraftState[],
  order: PrecisionOrder,
  distancesReconstructed: boolean,
): LevelingInput {
  return {
    type: config.type,
    startElevation: parseNumber(config.startBm.elevation) ?? Number.NaN,
    endElevation:
      config.type === "link" ? parseNumber(config.endBm.elevation) : null,
    order,
    forward: forward.map(draftToReadingInput),
    return: config.hasReturnRun ? back.map(draftToReadingInput) : null,
    // Un proceso reconstruido por la Fase 9 conserva su regla de acumulado
    // (Fase 19): se muestra con los valores con que se guardó.
    distancesReconstructed,
  };
}

interface LevelingEditorProps {
  process: LevelingProcess;
  readings: LevelingReading[];
  projectId: string;
  projectName: string;
  points: ReferencePoint[];
}

/** Editor de un proceso de nivelación: libreta de campo y cálculo en vivo. */
export function LevelingEditor({
  process,
  readings: initialReadings,
  projectId,
  projectName,
  points,
}: LevelingEditorProps) {
  const readOnly = process.status === "closed" || process.status === "rejected";

  const [config, setConfig] = useState(() => processToConfig(process));
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

  // El orden sale de `config.precisionOrder`, no de un prop aparte: el
  // selector de orden vive dentro de `LevelingConfigFields` y edita `config`
  // en vivo, así que el cierre y la tolerancia deben recalcular con el mismo
  // valor que ve el usuario, no con el que tenía el proceso al cargar la
  // página (mismo problema que se corrigió en polygonal-editor.tsx).
  const result = useMemo(
    () =>
      computeLeveling(
        buildInput(config, forward, back, config.precisionOrder, process.distances_reconstructed),
      ),
    [config, forward, back, process.distances_reconstructed],
  );

  // La distancia total se DERIVA de las distancias por visual de la libreta.
  // Antes se tecleaba, y de ella depende la tolerancia K·√D: un número que
  // nadie verificaba decidía si el trabajo cumple.
  // Sin tipo de nivel la libreta no se habilita: decide si la distancia sale
  // de los tres hilos o la entrega el instrumento. Sin preselección —
  // precedente de `angle_type` en la Fase 7: adivinar reintroduce el fallo
  // silencioso que esta fase existe para cerrar.
  const levelType = config.level.levelType === "" ? null : config.level.levelType;

  const derivedTotalKm = useMemo(
    () => totalDistanceFromReadings(forward.map(draftToReadingInput)),
    [forward],
  );

  // validateRunCapture (no validateReadingCapture fila a fila) porque el
  // error de la fila `bm` inicial sin V+ depende de su POSICIÓN en el
  // recorrido, no solo de sus propios campos.
  const forwardIssues = useMemo<ReadingCaptureIssues[]>(
    () =>
      validateRunCapture(
        forward.map(draftToReadingInput),
        config.type,
        config.precisionOrder,
        process.distances_reconstructed,
      ),
    [forward, config.type, config.precisionOrder, process.distances_reconstructed],
  );
  const backIssues = useMemo<ReadingCaptureIssues[]>(
    () =>
      validateRunCapture(
        back.map(draftToReadingInput),
        config.type,
        config.precisionOrder,
        process.distances_reconstructed,
      ),
    [back, config.type, config.precisionOrder, process.distances_reconstructed],
  );

  // Importar (Fase 16) llena el borrador y la configuración; se guarda como
  // siempre. El archivo es de un nivel digital: la libreta pasa a ese modo.
  function applyImport(imported: LevelingImport) {
    setConfig(configWithImport(config, imported));
    setForward(imported.forward.map(importedToDraft));
    setBack((imported.return ?? []).map(importedToDraft));
    setActiveRun("forward");
    setDirty(true);
    setSaveMessage(null);
  }

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
        notes: process.notes,
        precisionOrder: config.precisionOrder,
        equipmentBrand: config.level.equipmentBrand.trim() || null,
        equipmentModel: config.level.equipmentModel.trim() || null,
        equipmentSerial: config.level.equipmentSerial.trim() || null,
        equipmentCalibrationDate:
          config.level.equipmentCalibrationDate.trim() || null,
        levelType: config.level.levelType === "" ? null : config.level.levelType,
        kmPrecisionMm: parseNumber(config.level.kmPrecisionMm),
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
            onChange={handleConfigChange}
          />
          <div className="max-w-xs">
            <span className="flex flex-col gap-1 text-sm font-medium text-neutral-800">
              Distancia total del recorrido (km)
              <output className="flex h-10 items-center rounded-md bg-neutral-100 px-3 font-mono text-base tabular-nums text-neutral-900">
                {derivedTotalKm.toFixed(3)}
              </output>
            </span>
            <p className="mt-1 text-xs text-neutral-600">
              Se calcula sumando las distancias por visual de la libreta.
            </p>
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
          {!readOnly && (
            <div className="flex justify-end">
              <ImportDialog
                currentType={config.type}
                currentStartCode={config.startBm.code}
                currentStartElevation={parseNumber(config.startBm.elevation)}
                hasReadings={forward.length > 0 || back.length > 0}
                onAccept={applyImport}
              />
            </div>
          )}
          {config.hasReturnRun && (
            <RunTabs active={activeRun} onChange={setActiveRun} />
          )}
          {levelType == null ? (
            <p className="rounded-md bg-neutral-100 px-4 py-3 text-sm text-neutral-700">
              Elige el <strong>tipo de nivel</strong> en la configuración antes
              de capturar la libreta: decide si la distancia se obtiene leyendo
              los tres hilos sobre la mira (nivel automático) o la entrega el
              instrumento (nivel digital).
            </p>
          ) : null}
          {levelType != null &&
            (!config.hasReturnRun || activeRun === "forward") && (
            <ReadingsTable
              readings={forward}
              computed={result.forward.readings}
              issues={forwardIssues}
              disabled={readOnly}
              levelType={levelType}
              distancesReconstructed={process.distances_reconstructed}
              onChange={(v) => {
                setForward(v);
                setDirty(true);
                setSaveMessage(null);
              }}
            />
          )}
          {levelType != null &&
            config.hasReturnRun &&
            activeRun === "return" && (
            <ReadingsTable
              readings={back}
              computed={result.return?.readings ?? []}
              issues={backIssues}
              disabled={readOnly}
              levelType={levelType}
              distancesReconstructed={process.distances_reconstructed}
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
