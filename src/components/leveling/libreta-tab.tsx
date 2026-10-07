"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import { Alert, Button } from "@/components/design-system";
import { saveLevelingProcessAction } from "@/app/(app)/projects/[id]/leveling/[pid]/actions";
import { useProcessDraft } from "@/components/process/use-process-draft";
import { computeLevelingDetected } from "@/lib/calculations/leveling";
import { cn } from "@/lib/utils/cn";
import type { LevelingProcess, LevelingReading, RunType } from "@/types/leveling";
import { ArmadaDialog } from "./armada-dialog";
import { armadaSpans, nextArmadaIndex, runEnded } from "./armadas";
import { ArithmeticCheck } from "./arithmetic-check";
import { BmCard } from "./bm-card";
import { BmDialog } from "./bm-dialog";
import { ImportDialog, type LevelingImport } from "./import-dialog";
import { LevelingProfile } from "./leveling-profile";
import { arithmeticOf, armadaSummaries, sheetRows } from "./libreta-rows";
import { ArmadaList, LibretaTable } from "./libreta-table";
import {
  draftWithImport,
  levelingDraftOf,
  levelingInputOf,
  levelingPayloadOf,
  runRowsOf,
  type LevelingDraft,
} from "./leveling-save";

type Dialog = { kind: "bm" } | { kind: "armada"; run: RunType; k: number; opened: number };

const RUN_LABEL: Record<RunType, string> = { forward: "Ida", return: "Vuelta" };

/**
 * Paso 1 · Libreta (Fase 36, libreta B): el BM, la tabla de la hoja con
 * Ida | Vuelta y su comprobación aritmética a la izquierda; el perfil con las
 * miras y las visuales, fijo a la derecha. Cada popup guarda la libreta
 * completa al confirmar: no hay botón Guardar.
 */
export function LibretaTab({ process, readings }: { process: LevelingProcess; readings: LevelingReading[] }) {
  const base = useMemo(() => levelingDraftOf(process, readings), [process, readings]);
  const persist = useCallback(
    (next: LevelingDraft) => saveLevelingProcessAction(levelingPayloadOf(process.id, next)),
    [process.id],
  );
  const { draft, save } = useProcessDraft(process.updated_at, base, persist);
  const { result } = useMemo(() => computeLevelingDetected(levelingInputOf(draft)), [draft]);

  const hasReturn = draft.details.hasReturnRun;
  const [chosenRun, setRun] = useState<RunType>("forward");
  const run: RunType = hasReturn ? chosenRun : "forward";
  const [view, setView] = useState<"tabla" | "perfil">("tabla");
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const rows = runRowsOf(draft, run);
  const computed = run === "forward" ? result.forward.readings : (result.return?.readings ?? []);
  const runResult = run === "forward" ? result.forward : result.return;
  const sheet = sheetRows(rows, computed, { run, type: draft.details.type });
  const armadas = armadaSummaries(rows, computed);
  const empty = armadaSpans(rows).length === 0;
  const ended = runEnded(rows);
  const forwardEnded = runEnded(runRowsOf(draft, "forward"));
  const returnEnded = runEnded(runRowsOf(draft, "return"));
  const endBadge = run === "forward" && draft.details.type === "open" ? "fin de la ida" : "BM";

  function openArmada(r: RunType, k: number) {
    setDialog({ kind: "armada", run: r, k, opened: Date.now() });
  }

  function followWithReturn() {
    setRun("return");
    openArmada("return", nextArmadaIndex(runRowsOf(draft, "return")));
  }

  function applyImport(imported: LevelingImport) {
    setError(null);
    startTransition(async () => {
      const response = await save(draftWithImport(draft, imported));
      if (!response.ok) setError(response.error ?? "No se pudo guardar la libreta importada.");
    });
  }

  const importButton = (
    <ImportDialog
      label="Importar .L o CSV"
      currentType={draft.details.type}
      currentStartCode={draft.bm.startCode}
      currentStartElevation={draft.bm.startElevation}
      hasReadings={!empty}
      onAccept={applyImport}
    />
  );

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[3fr_2fr]">
      <div className="flex min-w-0 flex-col gap-4">
        <BmCard draft={draft} onEdit={() => setDialog({ kind: "bm" })} />
        {error && <Alert variant="error">{error}</Alert>}

        <div role="group" aria-label="Vista" className="grid grid-cols-2 overflow-hidden rounded-md border border-rule-strong lg:hidden">
          {(["tabla", "perfil"] as const).map((v) => (
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
              {v === "tabla" ? "Tabla" : "Perfil"}
            </button>
          ))}
        </div>

        <div className={cn("flex flex-col gap-4", view === "perfil" && "hidden lg:flex")}>
          <section className="rounded-lg border border-rule bg-card shadow-sm">
            <header className="flex flex-wrap items-center justify-between gap-3 border-b border-rule px-4 py-3">
              <div className="flex items-center gap-3">
                <h2 className="text-lg font-semibold">Libreta</h2>
                {hasReturn && (
                  <div role="group" aria-label="Recorrido" className="inline-flex overflow-hidden rounded-md border border-rule-strong">
                    {(["forward", "return"] as const).map((r) => (
                      <button
                        key={r}
                        type="button"
                        aria-pressed={run === r}
                        onClick={() => setRun(r)}
                        className={cn(
                          "min-h-9 border-r border-rule px-3.5 text-sm font-medium last:border-r-0",
                          run === r ? "bg-mira-bg text-mira-ink" : "text-ink-2 hover:bg-sel",
                        )}
                      >
                        {RUN_LABEL[r]}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {!empty && !ended && (
                <Button type="button" variant="secondary" size="sm" onClick={() => openArmada(run, nextArmadaIndex(rows))}>
                  + Agregar armada
                </Button>
              )}
            </header>

            <div className="hidden sm:block">
              <LibretaTable rows={sheet} onEdit={(k) => openArmada(run, k)} />
            </div>
            <div className="p-3 sm:hidden">
              {empty ? (
                <p className="text-sm">
                  <span className="font-semibold">{rows[0]!.pointCode}</span>
                  <span className="text-ink-2"> · el punto de partida</span>
                </p>
              ) : (
                <ArmadaList armadas={armadas} endBadge={endBadge} onEdit={(k) => openArmada(run, k)} />
              )}
            </div>

            {empty && (
              <div className="flex flex-col items-center gap-3 border-t border-rule px-4 py-6 text-center">
                <p className="max-w-md text-sm text-ink-2">
                  {run === "forward"
                    ? "Cada armada es una posición del nivel: una vista atrás al punto conocido y una adelante al siguiente."
                    : `La vuelta empieza en ${rows[0]!.pointCode} y regresa a ${draft.bm.startCode}.`}
                </p>
                <div className="flex flex-wrap justify-center gap-2.5">
                  <Button type="button" onClick={() => openArmada(run, 0)}>
                    + Agregar la primera armada
                  </Button>
                  {run === "forward" && importButton}
                </div>
              </div>
            )}

            {run === "forward" && forwardEnded && hasReturn && !returnEnded && (
              <div className="flex justify-end border-t border-rule px-4 py-3">
                <Button type="button" onClick={followWithReturn}>
                  Seguir con la vuelta
                </Button>
              </div>
            )}
          </section>

          {!empty && runResult && <ArithmeticCheck check={arithmeticOf(runResult)} label={RUN_LABEL[run].toLowerCase()} />}
        </div>
      </div>

      <div className={cn("min-w-0", view === "tabla" && "hidden lg:block")}>
        <div className="lg:sticky lg:top-[calc(var(--barra-alto)+1rem)]">
          <LevelingProfile result={result} run={run} hasReturn={hasReturn} />
        </div>
      </div>

      {dialog?.kind === "bm" && <BmDialog draft={draft} onSave={save} onClose={() => setDialog(null)} />}
      {dialog?.kind === "armada" && (
        <ArmadaDialog
          key={`${dialog.opened}:${dialog.run}:${dialog.k}`}
          draft={draft}
          run={dialog.run}
          k={dialog.k}
          result={result}
          onSave={save}
          onContinue={(r, k) => {
            setRun(r);
            openArmada(r, k);
          }}
          onClose={() => setDialog(null)}
        />
      )}
    </div>
  );
}
