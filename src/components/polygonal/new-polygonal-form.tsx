"use client";

import { useState, useTransition, type FormEvent } from "react";
import { Alert, Button } from "@/components/design-system";
import { parseNumber } from "@/lib/utils/parse";
import { createPolygonalProcessAction } from "@/app/(app)/projects/[id]/polygonal/new/actions";
import {
  EMPTY_POLYGONAL_CONFIG,
  PolygonalConfigFields,
  type PolygonalConfigState,
} from "./polygonal-config-fields";

export function NewPolygonalForm({ projectId }: { projectId: string }) {
  const [config, setConfig] = useState<PolygonalConfigState>(
    EMPTY_POLYGONAL_CONFIG,
  );
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const controlled = config.type === "open_controlled";
    startTransition(async () => {
      const result = await createPolygonalProcessAction({
        projectId,
        name: config.name,
        type: config.type,
        startPointCode: config.startPointCode,
        startNorth: parseNumber(config.startNorth),
        startEast: parseNumber(config.startEast),
        startAzimuthDeg: parseNumber(config.startAzimuth.deg),
        startAzimuthMin: parseNumber(config.startAzimuth.min),
        startAzimuthSec: parseNumber(config.startAzimuth.sec),
        endPointCode: controlled
          ? config.endPointCode.trim() || null
          : null,
        endNorth: controlled ? parseNumber(config.endNorth) : null,
        endEast: controlled ? parseNumber(config.endEast) : null,
        endAzimuthDeg: controlled
          ? parseNumber(config.endAzimuth.deg)
          : null,
        endAzimuthMin: controlled
          ? parseNumber(config.endAzimuth.min)
          : null,
        endAzimuthSec: controlled
          ? parseNumber(config.endAzimuth.sec)
          : null,
      });
      // En éxito la acción redirige al editor; solo llega aquí si hubo error.
      if (result.error) setError(result.error);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      {error && <Alert variant="error">{error}</Alert>}
      <PolygonalConfigFields value={config} onChange={setConfig} />
      <div className="flex justify-end">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Creando…" : "Crear proceso"}
        </Button>
      </div>
    </form>
  );
}
