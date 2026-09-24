"use client";

import { useState, useTransition, type FormEvent } from "react";
import { Alert, Button } from "@/components/design-system";
import { parseNumber } from "@/lib/utils/parse";
import type { ReferencePoint } from "@/types/project";
import { createLevelingProcessAction } from "@/app/(app)/projects/[id]/leveling/new/actions";
import { ImportDialog, type LevelingImport } from "./import-dialog";
import {
  EMPTY_LEVELING_CONFIG,
  LevelingConfigFields,
  type LevelingConfigState,
} from "./leveling-config-fields";

interface NewLevelingFormProps {
  projectId: string;
  points: ReferencePoint[];
}

export function NewLevelingForm({
  projectId,
  points,
}: NewLevelingFormProps) {
  const [config, setConfig] = useState<LevelingConfigState>(
    EMPTY_LEVELING_CONFIG,
  );
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  // Lecturas importadas desde archivo (Fase 16): se crean con el proceso.
  const [imported, setImported] = useState<LevelingImport | null>(null);

  function applyImport(result: LevelingImport) {
    setImported(result);
    setConfig({
      ...config,
      type: result.type,
      hasReturnRun: result.return != null,
      startBm: {
        code: result.startBm.code,
        elevation: result.startBm.elevation != null ? String(result.startBm.elevation) : "",
      },
      level: { ...config.level, levelType: "digital" },
    });
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const isLink = config.type === "link";
    startTransition(async () => {
      const result = await createLevelingProcessAction({
        projectId,
        name: config.name,
        type: config.type,
        startBmCode: config.startBm.code,
        startBmElevation: parseNumber(config.startBm.elevation),
        endBmCode: isLink ? config.endBm.code.trim() || null : null,
        endBmElevation: isLink ? parseNumber(config.endBm.elevation) : null,
        hasReturnRun: config.hasReturnRun,
        precisionOrder: config.precisionOrder,
        equipmentBrand: config.level.equipmentBrand.trim() || null,
        equipmentModel: config.level.equipmentModel.trim() || null,
        equipmentSerial: config.level.equipmentSerial.trim() || null,
        equipmentCalibrationDate:
          config.level.equipmentCalibrationDate.trim() || null,
        levelType: config.level.levelType === "" ? null : config.level.levelType,
        kmPrecisionMm: parseNumber(config.level.kmPrecisionMm),
        readings: imported
          ? { forward: imported.forward, return: config.hasReturnRun ? (imported.return ?? []) : [] }
          : null,
      });
      // En éxito la acción redirige al editor; solo llega aquí si hubo error.
      if (result.error) setError(result.error);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      {error && <Alert variant="error">{error}</Alert>}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-neutral-200 bg-white px-5 py-4">
        <p className="text-sm text-neutral-700">
          {imported
            ? `Libreta importada: ${imported.forward.length} filas de ida${imported.return ? ` y ${imported.return.length} de vuelta` : ""}. Se guardará al crear el proceso.`
            : "¿Trae la libreta de un nivel digital? Impórtela y se rellenan el BM, el tipo y el modo."}
        </p>
        <ImportDialog
          currentType={config.type}
          currentStartElevation={parseNumber(config.startBm.elevation)}
          hasReadings={imported != null}
          onAccept={applyImport}
        />
      </div>
      <LevelingConfigFields
        value={config}
        onChange={setConfig}
        points={points}
      />
      <div className="flex justify-end">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Creando…" : "Crear proceso"}
        </Button>
      </div>
    </form>
  );
}
