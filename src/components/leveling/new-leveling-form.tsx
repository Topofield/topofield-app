"use client";

import { useState, useTransition, type FormEvent } from "react";
import { Alert, Button } from "@/components/design-system";
import { parseNumber } from "@/lib/utils/parse";
import type { PrecisionOrder, ReferencePoint } from "@/types/project";
import { createLevelingProcessAction } from "@/app/(app)/projects/[id]/leveling/new/actions";
import {
  EMPTY_LEVELING_CONFIG,
  LevelingConfigFields,
  type LevelingConfigState,
} from "./leveling-config-fields";

interface NewLevelingFormProps {
  projectId: string;
  points: ReferencePoint[];
  precisionOrder: PrecisionOrder;
}

export function NewLevelingForm({
  projectId,
  points,
  precisionOrder,
}: NewLevelingFormProps) {
  const [config, setConfig] = useState<LevelingConfigState>(
    EMPTY_LEVELING_CONFIG,
  );
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

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
      });
      // En éxito la acción redirige al editor; solo llega aquí si hubo error.
      if (result.error) setError(result.error);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      {error && <Alert variant="error">{error}</Alert>}
      <LevelingConfigFields
        value={config}
        onChange={setConfig}
        points={points}
        precisionOrder={precisionOrder}
      />
      <div className="flex justify-end">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Creando…" : "Crear proceso"}
        </Button>
      </div>
    </form>
  );
}
