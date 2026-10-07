"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { saveLevelingProcessAction } from "@/app/(app)/projects/[id]/leveling/[pid]/actions";
import { ProcessSteps } from "@/components/process/process-steps";
import { callAction } from "@/lib/errors/action-call";
import type { LevelingProcess, LevelingReading } from "@/types/leveling";
import { ImportDialog, type LevelingImport } from "./import-dialog";
import { draftWithImport, levelingDraftOf, levelingPayloadOf } from "./leveling-save";

export const LEVELING_STEPS = [
  { id: "libreta", label: "Libreta" },
  { id: "compensacion", label: "Compensación" },
  { id: "informe", label: "Informe" },
] as const;
export type LevelingStep = (typeof LEVELING_STEPS)[number]["id"];

interface LevelingStepsProps {
  basePath: string;
  active: LevelingStep;
  process: LevelingProcess;
  readings: LevelingReading[];
}

/**
 * Los pasos de la nivelación (Fase 36): 1 · Libreta, 2 · Compensación,
 * 3 · Informe, y a la derecha importar el `.L` del nivel digital o un CSV,
 * que reemplaza la libreta y se guarda al aceptar.
 */
export function LevelingSteps({ basePath, active, process, readings }: LevelingStepsProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  async function applyImport(imported: LevelingImport) {
    setError(null);
    const draft = draftWithImport(levelingDraftOf(process, readings), imported);
    const response = await callAction(() => saveLevelingProcessAction(levelingPayloadOf(process.id, draft)));
    if (response.ok) router.refresh();
    else setError(response.error ?? "No se pudo guardar la libreta importada.");
  }

  return (
    <ProcessSteps
      steps={LEVELING_STEPS}
      active={active}
      basePath={basePath}
      trailing={
        <>
          <ImportDialog
            label="Importar .L o CSV"
            currentType={process.type}
            currentStartCode={process.start_bm_code}
            currentStartElevation={Number(process.start_bm_elevation)}
            hasReadings={readings.length > 1}
            onAccept={applyImport}
          />
          {error && <span className="text-xs text-danger">{error}</span>}
        </>
      }
    />
  );
}
