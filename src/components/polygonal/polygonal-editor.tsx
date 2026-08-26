"use client";

import { useMemo, useState, useTransition } from "react";
import {
  Alert,
  Badge,
  Breadcrumbs,
  Button,
  Card,
} from "@/components/design-system";
import type { DmsValue } from "@/components/design-system";
import { dmsToDecimal } from "@/lib/calculations/angles";
import { computePolygonal } from "@/lib/calculations/polygonal";
import { parseNumber } from "@/lib/utils/parse";
import {
  expectStationCapture,
  validatePolygonalStation,
  type CaptureIssues,
} from "@/lib/validators/polygonal";
import { savePolygonalProcessAction } from "@/app/(app)/projects/[id]/polygonal/[pid]/actions";
import {
  PROCESS_STATUS_LABELS,
  type CorrectionMethod,
  type PolygonalInput,
  type PolygonalProcess,
  type PolygonalStation,
  type ProcessStatus,
} from "@/types/polygonal";
import type { PrecisionOrder } from "@/types/project";
import {
  PolygonalConfigFields,
  type PolygonalConfigState,
} from "./polygonal-config-fields";
import { CloseProcessDialog } from "./close-process-dialog";
import { ClosureVerdict } from "./closure-verdict";
import { ReassignCoordinatesDialog } from "./reassign-coordinates-dialog";
import { ResultsPanel } from "./results-panel";
import { StationsTable, type StationDraftState } from "./stations-table";

function dmsRow(
  deg: number | null,
  min: number | null,
  sec: number | null,
): DmsValue {
  return {
    deg: deg != null ? String(deg) : "",
    min: min != null ? String(min) : "",
    sec: sec != null ? String(sec) : "",
  };
}

function processToConfig(p: PolygonalProcess): PolygonalConfigState {
  return {
    name: p.name,
    type: p.type,
    startPointCode: p.start_point_code,
    startNorth: String(p.start_north),
    startEast: String(p.start_east),
    startAzimuth: dmsRow(
      p.start_azimuth_deg,
      p.start_azimuth_min,
      p.start_azimuth_sec,
    ),
    endPointCode: p.end_point_code ?? "",
    endNorth: p.end_north != null ? String(p.end_north) : "",
    endEast: p.end_east != null ? String(p.end_east) : "",
    endAzimuth: dmsRow(p.end_azimuth_deg, p.end_azimuth_min, p.end_azimuth_sec),
  };
}

function stationToDraft(st: PolygonalStation): StationDraftState {
  return {
    id: crypto.randomUUID(),
    pointCode: st.point_code,
    angle: dmsRow(st.angle_deg, st.angle_min, st.angle_sec),
    deflectionDirection: st.deflection_direction,
    distance:
      st.horizontal_distance != null ? String(st.horizontal_distance) : "",
  };
}

function dmsToDecimalOrNaN(value: DmsValue): number {
  const deg = parseNumber(value.deg);
  const min = parseNumber(value.min);
  const sec = parseNumber(value.sec);
  return deg != null && min != null && sec != null
    ? dmsToDecimal(deg, min, sec)
    : Number.NaN;
}

function buildInput(
  config: PolygonalConfigState,
  stations: StationDraftState[],
  method: CorrectionMethod,
  order: PrecisionOrder,
): PolygonalInput {
  const controlled = config.type === "open_controlled";
  return {
    type: config.type,
    startNorth: parseNumber(config.startNorth) ?? Number.NaN,
    startEast: parseNumber(config.startEast) ?? Number.NaN,
    startAzimuth: dmsToDecimalOrNaN(config.startAzimuth),
    endNorth: controlled ? parseNumber(config.endNorth) : null,
    endEast: controlled ? parseNumber(config.endEast) : null,
    endAzimuth:
      controlled && config.endAzimuth.deg.trim() !== ""
        ? dmsToDecimalOrNaN(config.endAzimuth)
        : null,
    order,
    method,
    stations: stations.map((st) => ({
      pointCode: st.pointCode,
      angle: dmsToDecimalOrNaN(st.angle),
      deflectionDirection: st.deflectionDirection,
      distance: parseNumber(st.distance) ?? Number.NaN,
    })),
  };
}

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
  stations: PolygonalStation[];
  projectId: string;
  projectName: string;
  precisionOrder: PrecisionOrder;
}

export function PolygonalEditor({
  process,
  stations: initialStations,
  projectId,
  projectName,
  precisionOrder,
}: PolygonalEditorProps) {
  const readOnly = process.status === "closed" || process.status === "rejected";

  const [config, setConfig] = useState(() => processToConfig(process));
  const [stations, setStations] = useState(() =>
    initialStations.map(stationToDraft),
  );
  const [method, setMethod] = useState<CorrectionMethod>(
    process.correction_method ?? "bowditch",
  );
  const [error, setError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const result = useMemo(
    () =>
      computePolygonal(buildInput(config, stations, method, precisionOrder)),
    [config, stations, method, precisionOrder],
  );

  const issues = useMemo<CaptureIssues[]>(
    () =>
      stations.map((st, i) =>
        validatePolygonalStation(
          {
            angleDeg: parseNumber(st.angle.deg),
            angleMin: parseNumber(st.angle.min),
            angleSec: parseNumber(st.angle.sec),
            distance: parseNumber(st.distance),
          },
          expectStationCapture(config.type, i, stations.length),
        ),
      ),
    [stations, config.type],
  );

  const captureBlocked = issues.some((i) => Object.keys(i.errors).length > 0);

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
        notes: process.notes,
        stations: stations.map((st) => ({
          pointCode: st.pointCode,
          angleDeg: parseNumber(st.angle.deg),
          angleMin: parseNumber(st.angle.min),
          angleSec: parseNumber(st.angle.sec),
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
          <h1 className="text-2xl font-bold">
            {process.name}
          </h1>
          <Badge tone={STATUS_TONE[process.status]}>
            {PROCESS_STATUS_LABELS[process.status]}
          </Badge>
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

      <ClosureVerdict
        result={result}
        type={config.type}
        order={precisionOrder}
      />

      <details
        open={process.status === "draft" || process.status === "in_progress"}
        className="group rounded-lg border border-neutral-200 bg-white shadow-sm"
      >
        <summary className="flex cursor-pointer list-none items-center justify-between px-5 py-4 text-base font-semibold text-neutral-900 marker:content-none">
          <h2 className="text-base font-semibold">
            Configuración
          </h2>
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
        <div className="border-t border-neutral-100 px-5 py-4">
          <PolygonalConfigFields
            value={config}
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
          showDeflection={config.type === "open_controlled"}
          disabled={readOnly}
          onChange={(v) => {
            setStations(v);
            setDirty(true);
            setSaveMessage(null);
          }}
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
        />
      </Card>

      {!readOnly && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <ReassignCoordinatesDialog
            startNorth={config.startNorth}
            startEast={config.startEast}
            startAzimuth={config.startAzimuth}
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
            {captureBlocked && (
              <span className="text-sm text-danger-500">
                Corrige las celdas con error para poder guardar.
              </span>
            )}
            <Button onClick={handleSave} disabled={isPending || captureBlocked}>
              {isPending ? "Guardando…" : "Guardar"}
            </Button>
            <span aria-hidden className="h-6 w-px bg-neutral-200" />
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
  );
}
