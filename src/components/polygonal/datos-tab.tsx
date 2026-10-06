"use client";

import { useMemo, useState, useTransition } from "react";
import { Alert, Button, Card } from "@/components/design-system";
import { savePolygonalProcessAction } from "@/app/(app)/projects/[id]/polygonal/[pid]/actions";
import { computePolygonal, computePolygonalDetected } from "@/lib/calculations/polygonal";
import { cn } from "@/lib/utils/cn";
import type { ReferencePoint } from "@/types/project";
import type {
  AngleInputFormat,
  PolygonalInput,
  PolygonalProcess,
  PolygonalStationWithReadings,
} from "@/types/polygonal";
import { AmarreCard } from "./amarre-card";
import { AmarreDialog } from "./amarre-dialog";
import { AngularClosureSummary } from "./angular-closure-summary";
import { captureRows, fieldTraverse, type CaptureRow } from "./capture-rows";
import { isClosed, needsClosingAngle, removeLastMeasurement } from "./capture-edits";
import { MeasurementDialog, type MeasurementMode } from "./measurement-dialog";
import { MeasurementsTable } from "./measurements-table";
import { PolygonalPlotViewer } from "./polygonal-plot-viewer";
import { draftOf, inputOf, payloadOf, type PolygonalDraft } from "./polygonal-save";

type Dialog = { kind: "amarre" } | { kind: "measurement"; mode: MeasurementMode; opened: number };

interface DatosTabProps {
  projectId: string;
  process: PolygonalProcess;
  stations: PolygonalStationWithReadings[];
  referencePoints: ReferencePoint[];
  angleFormat: AngleInputFormat;
}

/**
 * Paso 1 · Datos (Fase 35, maqueta «Datos A»): el amarre, las mediciones
 * «desde → hacia» y el cierre angular a la izquierda; el dibujo sin ajustar,
 * fijo a la derecha. Cada popup guarda al confirmar con la carga completa: no
 * hay botón Guardar.
 */
export function DatosTab({ projectId, process, stations, referencePoints, angleFormat }: DatosTabProps) {
  // Lo último que se guardó desde aquí, hasta que el servidor devuelva la
  // página revalidada: así una medición encadenada parte de la anterior aunque
  // la página tarde en refrescarse. Cuando llega, manda el servidor.
  const [saved, setSaved] = useState<PolygonalDraft | null>(null);
  const [seen, setSeen] = useState(process.updated_at);
  if (seen !== process.updated_at) {
    setSeen(process.updated_at);
    setSaved(null);
  }
  const draft = useMemo(() => saved ?? draftOf(process, stations), [saved, process, stations]);

  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [view, setView] = useState<"tabla" | "dibujo">("tabla");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const reference = referencePoints.find((p) => p.id === draft.amarre.referencePointId) ?? null;
  const referenceLabel = reference?.code ?? draft.amarre.referenceCode ?? null;
  const referenceCoords = useMemo(
    () =>
      reference && reference.north !== null && reference.east !== null
        ? { code: reference.code, north: Number(reference.north), east: Number(reference.east) }
        : null,
    [reference],
  );

  const { input, result, angleType, field } = useMemo(() => {
    const base = inputOf(draft, referenceCoords);
    const detected = computePolygonalDetected(base);
    const full: PolygonalInput = { ...base, order: detected.order ?? "ordinario", angleType: detected.angleType };
    const fieldInput = fieldTraverse(full);
    return {
      input: full,
      result: detected.result,
      angleType: detected.angleType,
      field: { input: fieldInput, result: computePolygonal(fieldInput) },
    };
  }, [draft, referenceCoords]);

  const rows = captureRows(input, { start: draft.amarre.startCode, reference: referenceLabel });
  const hasAmarre = draft.amarre.startCode.trim() !== "";
  const closed = isClosed(draft);
  const closingAngle = needsClosingAngle(draft);

  async function save(next: PolygonalDraft) {
    const response = await savePolygonalProcessAction(payloadOf(process.id, next));
    if (response.ok) setSaved(next);
    return response;
  }

  function quickSave(next: PolygonalDraft) {
    setError(null);
    startTransition(async () => {
      const response = await save(next);
      if (!response.ok) setError(response.error ?? "No se pudo guardar.");
    });
  }

  function measureLocal() {
    quickSave({
      ...draft,
      amarre: {
        ...draft.amarre,
        startCode: "P1",
        startNorth: 1000,
        startEast: 1000,
        referencePointId: null,
        referenceCode: null,
        startAzimuth: { deg: 0, min: 0, sec: 0 },
        hasClosingRow: false,
      },
    });
  }

  function openMeasurement(mode: MeasurementMode) {
    setDialog({ kind: "measurement", mode, opened: Date.now() });
  }

  function editRow(row: CaptureRow) {
    if (row.stationIndex === null) return setDialog({ kind: "amarre" });
    if (row.role === "closing_angle") return openMeasurement({ kind: "closing" });
    openMeasurement({ kind: "edit", index: row.stationIndex });
  }

  const measurementKey =
    dialog?.kind === "measurement"
      ? `${dialog.opened}:${dialog.mode.kind}:${dialog.mode.kind === "edit" ? dialog.mode.index : ""}`
      : "";

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[3fr_2fr]">
      <div className="flex min-w-0 flex-col gap-5">
        <AmarreCard
          draft={draft}
          referenceLabel={referenceLabel}
          angleFormat={angleFormat}
          pending={isPending}
          onEdit={() => setDialog({ kind: "amarre" })}
          onLocal={measureLocal}
        />
        {error && <Alert variant="error">{error}</Alert>}

        <div role="group" aria-label="Vista" className="grid grid-cols-2 overflow-hidden rounded-md border border-rule-strong lg:hidden">
          {(["tabla", "dibujo"] as const).map((v) => (
            <button
              key={v}
              type="button"
              aria-pressed={view === v}
              onClick={() => setView(v)}
              className={cn(
                "min-h-11 border-r border-rule text-sm font-medium last:border-r-0",
                view === v ? "bg-mira-bg text-mira-ink" : "text-ink-2 hover:bg-sel",
              )}
            >
              {v === "tabla" ? "Tabla" : "Dibujo"}
            </button>
          ))}
        </div>

        <div className={cn("flex flex-col gap-5", view === "dibujo" && "hidden lg:flex")}>
          <Card title="Mediciones">
            {rows.length > 0 ? (
              <MeasurementsTable rows={rows} angleFormat={angleFormat} onEdit={editRow} />
            ) : (
              <p className="text-sm text-ink-2">Todavía no hay mediciones.</p>
            )}
            <div className="mt-4 flex flex-wrap items-center gap-3">
              {closingAngle ? (
                <Button type="button" onClick={() => openMeasurement({ kind: "closing" })}>
                  Medir el cierre angular
                </Button>
              ) : (
                !closed && (
                  <Button type="button" disabled={!hasAmarre} onClick={() => openMeasurement({ kind: "add" })}>
                    + Agregar punto
                  </Button>
                )
              )}
              {!hasAmarre && <span className="text-sm text-ink-2">Se activa con el amarre.</span>}
              {draft.stations.length > 0 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={isPending}
                  onClick={() => quickSave(removeLastMeasurement(draft))}
                >
                  Deshacer la última medición
                </Button>
              )}
            </div>
          </Card>

          <Card title="Cierre angular">
            <AngularClosureSummary
              input={input}
              result={result}
              angleType={angleType}
              angleFormat={angleFormat}
              startCode={draft.amarre.startCode}
            />
          </Card>
        </div>
      </div>

      <div className={cn("min-w-0", view === "tabla" && "hidden lg:block")}>
        <div className="lg:sticky lg:top-[calc(var(--barra-alto)+1rem)]">
          <Card title="Dibujo" description="Sin ajustar: los ángulos y las distancias como se midieron.">
            <PolygonalPlotViewer input={field.input} result={field.result} reference={referenceCoords} field />
          </Card>
        </div>
      </div>

      {dialog?.kind === "amarre" && (
        <AmarreDialog
          projectId={projectId}
          draft={draft}
          referencePoints={referencePoints}
          angleFormat={angleFormat}
          onSave={save}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog?.kind === "measurement" && (
        <MeasurementDialog
          key={measurementKey}
          mode={dialog.mode}
          draft={draft}
          referenceLabel={referenceLabel}
          angleFormat={angleFormat}
          onSave={save}
          onContinue={(mode) =>
            setDialog((d) =>
              d?.kind === "measurement" && d.mode.kind === mode.kind ? { ...d, mode } : { kind: "measurement", mode, opened: Date.now() },
            )
          }
          onClose={() => setDialog(null)}
        />
      )}
    </div>
  );
}
