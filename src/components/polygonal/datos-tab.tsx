"use client";

import { useMemo, useState, useTransition } from "react";
import { Alert, Button, Card } from "@/components/design-system";
import { computePolygonal } from "@/lib/calculations/polygonal";
import type { CatalogUser } from "@/lib/polygonal-amarre";
import { cn } from "@/lib/utils/cn";
import type { ReferencePoint } from "@/types/project";
import type { AngleInputFormat, PolygonalProcess, PolygonalStationWithReadings } from "@/types/polygonal";
import { AmarreCard } from "./amarre-card";
import { AmarreDialog } from "./amarre-dialog";
import { AngularClosureSummary } from "./angular-closure-summary";
import { captureRows, fieldTraverse, type CaptureRow } from "./capture-rows";
import { isClosed, needsClosingAngle, removeLastMeasurement } from "./capture-edits";
import { MeasurementDialog, type MeasurementMode } from "./measurement-dialog";
import { MeasurementsTable } from "./measurements-table";
import { PolygonalPlotViewer } from "./polygonal-plot-viewer";
import type { PolygonalDraft } from "./polygonal-save";
import { usePolygonalComputation, usePolygonalDraft } from "./use-polygonal-draft";

type Dialog = { kind: "amarre" } | { kind: "measurement"; mode: MeasurementMode; opened: number };

interface DatosTabProps {
  process: PolygonalProcess;
  stations: PolygonalStationWithReadings[];
  referencePoints: ReferencePoint[];
  /** Las otras poligonales del proyecto, para el aviso del amarre. */
  others: CatalogUser[];
  angleFormat: AngleInputFormat;
}

/**
 * Paso 1 · Datos (Fase 35, maqueta «Datos A»): el amarre, las mediciones
 * «desde → hacia» y el cierre angular a la izquierda; el dibujo sin ajustar,
 * fijo a la derecha. Cada popup guarda al confirmar con la carga completa: no
 * hay botón Guardar.
 */
export function DatosTab({ process, stations, referencePoints, others, angleFormat }: DatosTabProps) {
  const { draft, save } = usePolygonalDraft(process, stations);
  const { input, result, angleType, referenceLabel, referenceCoords } = usePolygonalComputation(
    draft,
    referencePoints,
  );
  // Lo medido, sin ajustar, para el dibujo.
  const field = useMemo(() => {
    const fieldInput = fieldTraverse(input);
    return { input: fieldInput, result: computePolygonal(fieldInput) };
  }, [input]);

  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [view, setView] = useState<"tabla" | "dibujo">("tabla");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const rows = captureRows(input, {
    start: draft.amarre.startCode,
    reference: referenceLabel,
    end: draft.amarre.endCode,
  });
  const hasAmarre = draft.amarre.startCode.trim() !== "";
  const closed = isClosed(draft);
  const closingAngle = needsClosingAngle(draft);

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
          draft={draft}
          referencePoints={referencePoints}
          others={others}
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
