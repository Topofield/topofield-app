"use client";

import { useState, useTransition, type FormEvent } from "react";
import {
  Alert,
  Button,
} from "@/components/design-system";
import { parseNumber } from "@/lib/utils/parse";
import { createPolygonalProcessAction } from "@/app/(app)/projects/[id]/polygonal/new/actions";
import {
  EMPTY_POLYGONAL_CONFIG,
  PolygonalConfigFields,
  type PolygonalConfigState,
} from "./polygonal-config-fields";
import type { ReferencePoint } from "@/types/project";
import { AngleFormatToggle } from "./angle-input";
import type { AngleInputFormat } from "@/types/polygonal";

export function NewPolygonalForm({
  projectId,
  referencePoints = [],
}: {
  projectId: string;
  referencePoints?: ReferencePoint[];
}) {
  const [config, setConfig] = useState<PolygonalConfigState>(
    EMPTY_POLYGONAL_CONFIG,
  );
  const [error, setError] = useState<string | null>(null);
  const [angleFormat, setAngleFormat] = useState<AngleInputFormat>("dms");
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const controlled = config.type === "open_controlled";
    startTransition(async () => {
      const result = await createPolygonalProcessAction({
        projectId,
        name: config.name,
        type: config.type,
        angleType: config.angleType === "" ? null : config.angleType,
        referencePointId: config.referencePointId || null,
        referencePointCode: config.referencePointCode.trim() || null,
        angleReadingsMin: parseNumber(config.angleReadingsMin) ?? 3,
        hasClosingRow: config.hasClosingRow,
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
        angleInputFormat: angleFormat,
      });
      // En éxito la acción redirige al editor; solo llega aquí si hubo error.
      if (result.error) setError(result.error);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      {error && <Alert variant="error">{error}</Alert>}
      <AngleFormatToggle value={angleFormat} onChange={setAngleFormat} />
      <PolygonalConfigFields
        referencePoints={referencePoints}
        value={config}
        angleFormat={angleFormat}
        onChange={setConfig}
      />
      <div className="flex justify-end">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Creando…" : "Crear proceso"}
        </Button>
      </div>
    </form>
  );
}
