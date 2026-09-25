"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import {
  Alert,
  Badge,
  Breadcrumbs,
  buttonClasses,
  Button,
  Card,
  InvalidNumbersContext,
  useInvalidNumbers,
} from "@/components/design-system";
import { computePolygonal } from "@/lib/calculations/polygonal";
import { totalStationMeetsOrder } from "@/lib/calculations/tolerances";
import { parseNumber } from "@/lib/utils/parse";
import {
  expectStationCapture,
  validatePolygonalStation,
  type CaptureIssues,
  validateLeastSquaresWeights,
} from "@/lib/validators/polygonal";
import {
  savePolygonalProcessAction,
  setAngleInputFormatAction,
} from "@/app/(app)/projects/[id]/polygonal/[pid]/actions";
import {
  PROCESS_STATUS_LABELS,
  type CorrectionMethod,
  type PolygonalProcess,
  type PolygonalStationWithReadings,
  type ProcessStatus,
} from "@/types/polygonal";
import type { ReferencePoint } from "@/types/project";
import { PolygonalConfigFields } from "./polygonal-config-fields";
import { CloseProcessDialog } from "./close-process-dialog";
import { ClosureVerdict } from "./closure-verdict";
import { PolygonalPlotViewer } from "./polygonal-plot-viewer";
import { ReassignCoordinatesDialog } from "./reassign-coordinates-dialog";
import { ResultsPanel } from "./results-panel";
import { StationsTable } from "./stations-table";
import {
  buildInput,
  processToConfig,
  stationToDraft,
  weightsFromDraft,
  weightsToDraft,
} from "./polygonal-draft";
import { AngleFormatToggle } from "./angle-input";
import { GeoreferenceDialog } from "./georeference-dialog";
import { georeferenceSummary } from "./georeference-plan";
import type { AngleInputFormat } from "@/types/polygonal";

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

interface PolygonalEditorProps {
  process: PolygonalProcess;
  stations: PolygonalStationWithReadings[];
  projectId: string;
  projectName: string;
  /** Catálogo del proyecto, para elegir y georreferenciar el amarre. */
  referencePoints?: ReferencePoint[];
  /**
   * Precisión angular del equipo del proceso, para la dispersión entre
   * lecturas. `NaN` cuando el proceso no la declaró: `validateReadings` salta
   * el control en ese caso en vez de comparar contra una tolerancia de 0".
   */
  angularPrecisionSeconds: number;
}

export function PolygonalEditor({
  process,
  stations: initialStations,
  projectId,
  projectName,
  referencePoints = [],
  angularPrecisionSeconds,
}: PolygonalEditorProps) {
  const readOnly = process.status === "closed" || process.status === "rejected";
  const amarre = referencePoints.find(
    (p) => p.id === process.reference_point_id,
  );

  const [config, setConfig] = useState(() => processToConfig(process));
  const [stations, setStations] = useState(() =>
    initialStations.map((st) =>
      stationToDraft(st, process.angle_readings_min),
    ),
  );
  const [method, setMethod] = useState<CorrectionMethod>(
    process.correction_method ?? "bowditch",
  );
  const [weights, setWeights] = useState(() => weightsToDraft(process));
  const [error, setError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  // Formato de captura de ángulos (Fase 13, P1). Se guarda al conmutar, no con
  // el botón Guardar; en un proceso cerrado solo cambia la vista.
  const [angleFormat, setAngleFormat] = useState<AngleInputFormat>(
    process.angle_input_format,
  );
  const [formatError, setFormatError] = useState<string | null>(null);

  // Se guardan en serie: con dos clics rápidos, dos peticiones en paralelo
  // podían llegar en desorden y dejar en la base el formato que no se ve.
  // Cada una espera a la anterior, y la última escrita es la última pedida.
  const formatQueue = useRef<Promise<unknown>>(Promise.resolve());

  function changeAngleFormat(next: AngleInputFormat) {
    setAngleFormat(next);
    setFormatError(null);
    if (readOnly) return;
    formatQueue.current = formatQueue.current.then(() =>
      setAngleInputFormatAction(process.id, next).then((r) => {
        if (!r.ok) setFormatError(r.error ?? "No se pudo guardar el formato.");
      }),
    );
  }

  // El orden sale de `config.precisionOrder`, no de un prop aparte: el
  // selector de orden vive dentro de `PolygonalConfigFields` y edita
  // `config` en vivo, así que el veredicto de cierre debe recalcular con el
  // mismo valor que ve el usuario, no con el que tenía el proceso al cargar
  // la página.
  const input = useMemo(
    () =>
      buildInput(
        config,
        stations,
        method,
        config.precisionOrder,
        weightsFromDraft(weights),
      ),
    [config, stations, method, weights],
  );
  const result = useMemo(() => computePolygonal(input), [input]);

  // El amarre se dibuja solo si tiene coordenadas en el catálogo.
  const plotReference =
    amarre && amarre.north !== null && amarre.east !== null
      ? { code: amarre.code, north: Number(amarre.north), east: Number(amarre.east) }
      : null;

  const issues = useMemo<CaptureIssues[]>(
    () =>
      stations.map((st, i) =>
        validatePolygonalStation(
          {
            pointCode: st.pointCode,
            angleDeg: parseNumber(st.angle.deg),
            angleMin: parseNumber(st.angle.min),
            angleSec: parseNumber(st.angle.sec),
            distance: parseNumber(st.distance),
          },
          expectStationCapture(
            config.type,
            i,
            stations.length,
            config.hasClosingRow,
          ),
        ),
      ),
    [stations, config.type, config.hasClosingRow],
  );

  // Una celda con texto que no es número también bloquea (Fase 20, UI2):
  // `parseNumber` la lee como vacía y se perdería sin aviso.
  const invalidNumbers = useInvalidNumbers();
  const captureBlocked =
    issues.some((i) => Object.keys(i.errors).length > 0) || invalidNumbers.count > 0;

  // Georreferenciar (Fase 15) trabaja con lo guardado: con cambios sin
  // guardar se mezclaría la edición en curso con la georreferenciación.
  // Sin cambios pendientes, el cálculo en vivo es el de lo guardado.
  const georefBlocked = dirty
    ? "Guarde los cambios antes de georreferenciar."
    : result.stations.filter((s) => s.north != null).length < 2
      ? "Para georreferenciar hacen falta coordenadas calculadas."
      : null;

  // Pesos que se guardan (Fase 14). Con mínimos cuadrados, tal cual. Con
  // otro método los campos no se ven, así que un peso inválido que quedó
  // tecleado no puede bloquear el guardado: se descarta y se conservan los
  // válidos, para no perderlos si se vuelve al método.
  const savedWeights = useMemo(() => {
    const parsed = {
      sigmaAngleSeconds: parseNumber(weights.sigmaAngleSeconds),
      sigmaDistanceM: parseNumber(weights.sigmaDistanceM),
      distanceMeasurements: parseNumber(weights.distanceMeasurements),
    };
    if (method === "least_squares") return parsed;
    const none = {
      sigmaAngleSeconds: null,
      sigmaDistanceM: null,
      distanceMeasurements: null,
    };
    const keep = <K extends keyof typeof parsed>(key: K) =>
      validateLeastSquaresWeights(method, config.type, { ...none, [key]: parsed[key] }) === null
        ? parsed[key]
        : null;
    return {
      sigmaAngleSeconds: keep("sigmaAngleSeconds"),
      sigmaDistanceM: keep("sigmaDistanceM"),
      distanceMeasurements: keep("distanceMeasurements"),
    };
  }, [weights, method, config.type]);
  // La misma regla que aplica el servidor, para decirlo antes de pulsar
  // Guardar: sin pesos completos y válidos no se guarda el método.
  const weightsError = validateLeastSquaresWeights(method, config.type, savedWeights);

  function handleSave() {
    setError(null);
    const controlled = config.type === "open_controlled";
    startTransition(async () => {
      const response = await savePolygonalProcessAction({
        processId: process.id,
        name: config.name,
        type: config.type,
        startPointCode: config.startPointCode,
        startNorth: parseNumber(config.startNorth) ?? 0,
        startEast: parseNumber(config.startEast) ?? 0,
        startAzimuthDeg: parseNumber(config.startAzimuth.deg),
        startAzimuthMin: parseNumber(config.startAzimuth.min),
        startAzimuthSec: parseNumber(config.startAzimuth.sec),
        endPointCode: controlled ? config.endPointCode.trim() || null : null,
        endNorth: controlled ? parseNumber(config.endNorth) : null,
        endEast: controlled ? parseNumber(config.endEast) : null,
        endAzimuthDeg: controlled ? parseNumber(config.endAzimuth.deg) : null,
        endAzimuthMin: controlled ? parseNumber(config.endAzimuth.min) : null,
        endAzimuthSec: controlled ? parseNumber(config.endAzimuth.sec) : null,
        correctionMethod: method,
        lsSigmaAngleSeconds: savedWeights.sigmaAngleSeconds,
        lsSigmaDistanceM: savedWeights.sigmaDistanceM,
        lsDistanceMeasurements: savedWeights.distanceMeasurements,
        angleType:
          config.angleType === "" ? "interior" : config.angleType,
        referencePointId: config.referencePointId || null,
        referencePointCode: config.referencePointCode.trim() || null,
        angleReadingsMin: parseNumber(config.angleReadingsMin) ?? 3,
        hasClosingRow: config.hasClosingRow,
        notes: process.notes,
        precisionOrder: config.precisionOrder,
        equipmentBrand: config.totalStation.equipmentBrand.trim() || null,
        equipmentModel: config.totalStation.equipmentModel.trim() || null,
        equipmentSerial: config.totalStation.equipmentSerial.trim() || null,
        equipmentCalibrationDate:
          config.totalStation.equipmentCalibrationDate.trim() || null,
        angularPrecisionSeconds: parseNumber(
          config.totalStation.angularPrecisionSeconds,
        ),
        distancePrecisionMm: parseNumber(
          config.totalStation.distancePrecisionMm,
        ),
        distancePrecisionPpm: parseNumber(
          config.totalStation.distancePrecisionPpm,
        ),
        stations: stations.map((st) => ({
          pointCode: st.pointCode,
          angleDeg: parseNumber(st.angle.deg),
          angleMin: parseNumber(st.angle.min),
          angleSec: parseNumber(st.angle.sec),
          readings: st.readings
            .filter((r) => r.deg.trim() !== "")
            .map((r) => ({
              deg: parseNumber(r.deg) ?? 0,
              min: parseNumber(r.min) ?? 0,
              sec: parseNumber(r.sec) ?? 0,
            })),
          deflectionDirection: st.deflectionDirection,
          horizontalDistance: parseNumber(st.distance),
        })),
      });
      if (response.ok) {
        setDirty(false);
        setSaveMessage("Proceso guardado.");
      } else {
        setError(response.error ?? "No se pudo guardar el proceso.");
      }
    });
  }

  return (
    <InvalidNumbersContext.Provider value={invalidNumbers.report}>
      <div className="flex flex-col gap-6">
        <div>
          <Breadcrumbs
            items={[
              { label: "Dashboard", href: "/dashboard" },
              { label: projectName, href: `/projects/${projectId}?tab=processes` },
              { label: process.name },
            ]}
          />
          {/* Envuelve en móvil: con tres acciones, en una sola fila la página
              desbordaba a lo ancho a 390 px. */}
          <div className="mt-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
            <h1 className="text-2xl font-bold">
              {process.name}
            </h1>
            <div className="flex flex-wrap items-center gap-3">
              <Badge tone={STATUS_TONE[process.status]}>
                {PROCESS_STATUS_LABELS[process.status]}
              </Badge>
              {/* Descarga directa: es una Route Handler que devuelve el .xlsx,
                  no una navegación. Disponible en cualquier estado (§ 4.8). */}
              <a
                href={`/projects/${projectId}/polygonal/${process.id}/export`}
                className={buttonClasses({ variant: "secondary", size: "sm" })}
                download
              >
                Exportar a Excel
              </a>
              <GeoreferenceDialog
                process={process}
                stations={initialStations}
                referencePoints={referencePoints}
                disabledReason={georefBlocked}
              />
            </div>
          </div>
          {georefBlocked && (
            <p className="mt-1 text-right text-xs text-ink-2">{georefBlocked}</p>
          )}
          {georeferenceSummary(process) && (
            <p className="mt-1 text-sm text-ink-2">
              Georreferenciado {georeferenceSummary(process)}.
            </p>
          )}
        </div>

        {readOnly &&
          process.status === "closed" &&
          process.meets_tolerance === false && (
            <Alert variant="warning">
              Este proceso se cerró sin alcanzar la tolerancia del orden de
              precisión. Los datos son de solo lectura; su posición se puede
              georreferenciar.
            </Alert>
          )}
        {readOnly &&
          !(process.status === "closed" && process.meets_tolerance === false) && (
            <Alert variant="info">
              {process.status === "rejected"
                ? "Este proceso fue rechazado; los datos son de solo lectura, salvo su posición, que se puede georreferenciar."
                : "Este proceso está cerrado; los datos son de solo lectura, salvo su posición, que se puede georreferenciar."}
            </Alert>
          )}
        {error && <Alert variant="error">{error}</Alert>}
        {saveMessage && <Alert variant="success">{saveMessage}</Alert>}

        <ClosureVerdict
          result={result}
          type={config.type}
          order={config.precisionOrder}
          // Solo matiza el texto del veredicto verde: no entra en `meets_tolerance`
          // ni en el cálculo. Sin precisión declarada devuelve `true` y no hay
          // matiz, que es lo correcto — no se opina sobre lo que no se sabe.
          instrumentMeetsOrder={totalStationMeetsOrder(
            config.precisionOrder,
            parseNumber(config.totalStation.angularPrecisionSeconds) ??
              Number.NaN,
          )}
        />

        <div className="flex flex-wrap items-center gap-3">
          <AngleFormatToggle value={angleFormat} onChange={changeAngleFormat} />
          {readOnly && (
            <span className="text-xs text-ink-2">
              El proceso está cerrado: el formato solo cambia la vista y no se
              guarda.
            </span>
          )}
          {formatError && (
            <span className="text-xs text-danger">{formatError}</span>
          )}
        </div>

        <details
          open={process.status === "draft" || process.status === "in_progress"}
          className="group rounded-lg border border-rule bg-card shadow-sm"
        >
          <summary className="flex cursor-pointer list-none items-center justify-between px-5 py-4 text-base font-semibold text-ink marker:content-none">
            <h2 className="text-base font-semibold">
              Configuración
            </h2>
            <svg
              aria-hidden="true"
              viewBox="0 0 20 20"
              fill="none"
              className="h-4 w-4 shrink-0 rotate-0 text-ink-2 transition-transform group-open:rotate-90 motion-reduce:transition-none"
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
          <div className="border-t border-rule px-5 py-4">
            <PolygonalConfigFields
              value={config}
              angleFormat={angleFormat}
              disabled={readOnly}
              onChange={(v) => {
                setConfig(v);
                setDirty(true);
                setSaveMessage(null);
              }}
            />
          </div>
        </details>

        <Card title="Estaciones">
          <StationsTable
            stations={stations}
            result={result}
            issues={issues}
            readingsMin={parseNumber(config.angleReadingsMin) ?? 3}
            angularPrecisionSeconds={
              parseNumber(config.totalStation.angularPrecisionSeconds) ??
              angularPrecisionSeconds
            }
            showDeflection={config.type === "open_controlled"}
            disabled={readOnly}
            angleFormat={angleFormat}
            onChange={(v) => {
              setStations(v);
              setDirty(true);
              setSaveMessage(null);
            }}
          />
        </Card>

        <Card title="Dibujo de la poligonal">
          <PolygonalPlotViewer
            input={input}
            result={result}
            reference={plotReference}
          />
        </Card>

        <Card title="Resultados">
          <ResultsPanel
            result={result}
            type={config.type}
            method={method}
            disabled={readOnly}
            onMethodChange={(m) => {
              setMethod(m);
              setDirty(true);
              setSaveMessage(null);
            }}
            weights={weights}
            weightsError={weightsError}
            onWeightsChange={(w) => {
              setWeights(w);
              setDirty(true);
              setSaveMessage(null);
            }}
          />
        </Card>

        {!readOnly && (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <ReassignCoordinatesDialog
              angleFormat={angleFormat}
              startNorth={config.startNorth}
              startEast={config.startEast}
              startAzimuth={config.startAzimuth}
              referenceNorth={amarre?.north != null ? String(amarre.north) : undefined}
              referenceEast={amarre?.east != null ? String(amarre.east) : undefined}
              referencePointCode={amarre?.code ?? config.referencePointCode}
              onApply={(north, east, azimuth) => {
                setConfig({
                  ...config,
                  startNorth: north,
                  startEast: east,
                  startAzimuth: azimuth,
                });
                setDirty(true);
                setSaveMessage(null);
              }}
            />
            <div className="flex items-center gap-3">
              {captureBlocked ? (
                <span className="text-sm text-danger">
                  Corrige las celdas con error para poder guardar.
                </span>
              ) : weightsError ? (
                <span className="text-sm text-danger">{weightsError}</span>
              ) : null}
              <Button
                onClick={handleSave}
                disabled={isPending || captureBlocked || weightsError != null}
              >
                {isPending ? "Guardando…" : "Guardar"}
              </Button>
              <span aria-hidden className="h-6 w-px bg-rule" />
              <CloseProcessDialog
                processId={process.id}
                type={config.type}
                result={result}
                captureBlocked={captureBlocked}
                dirty={dirty}
              />
            </div>
          </div>
        )}
      </div>
    </InvalidNumbersContext.Provider>
  );
}
