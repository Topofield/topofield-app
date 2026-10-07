"use client";

import { useCallback, useMemo } from "react";
import { savePolygonalProcessAction } from "@/app/(app)/projects/[id]/polygonal/[pid]/actions";
import { computePolygonalDetected } from "@/lib/calculations/polygonal";
import type { AmarrePoints } from "@/lib/polygonal-amarre";
import type { ReferencePoint } from "@/types/project";
import type { PolygonalInput, PolygonalProcess, PolygonalStationWithReadings } from "@/types/polygonal";
import { draftOf, inputOf, payloadOf, type PolygonalDraft } from "./polygonal-save";
import { useProcessDraft } from "@/components/process/use-process-draft";

/**
 * El borrador de una poligonal en los pasos Datos y Ajuste (Fase 35), y su
 * guardado. Lo último que se guardó desde aquí manda hasta que el servidor
 * devuelve la página revalidada: así una medición encadenada parte de la
 * anterior aunque la página tarde en refrescarse. Cuando llega, manda el
 * servidor (`updated_at` cambia con cada guardado).
 */
export function usePolygonalDraft(process: PolygonalProcess, stations: PolygonalStationWithReadings[]) {
  const base = useMemo(() => draftOf(process, stations), [process, stations]);
  // Los puntos del amarre que van al catálogo viajan con ese guardado, no en el borrador.
  const persist = useCallback(
    (next: PolygonalDraft, catalogPoints?: AmarrePoints) =>
      savePolygonalProcessAction({ ...payloadOf(process.id, next), catalogPoints }),
    [process.id],
  );
  return useProcessDraft(process.updated_at, base, persist);
}

/**
 * El cálculo en vivo del borrador, con el orden y el tipo de ángulo detectados,
 * y la referencia del amarre: su código y, si está en el catálogo con
 * coordenadas, dónde dibujarla.
 */
export function usePolygonalComputation(draft: PolygonalDraft, referencePoints: ReferencePoint[]) {
  const reference = referencePoints.find((p) => p.id === draft.amarre.referencePointId) ?? null;
  const referenceLabel = reference?.code ?? draft.amarre.referenceCode ?? null;
  const referenceCoords = useMemo(
    () =>
      reference && reference.north !== null && reference.east !== null
        ? { code: reference.code, north: Number(reference.north), east: Number(reference.east) }
        : null,
    [reference],
  );
  const computed = useMemo(() => {
    const base = inputOf(draft, referenceCoords);
    const detected = computePolygonalDetected(base);
    const input: PolygonalInput = { ...base, order: detected.order ?? "ordinario", angleType: detected.angleType };
    return { input, result: detected.result, order: detected.order, angleType: detected.angleType };
  }, [draft, referenceCoords]);
  return { ...computed, referenceLabel, referenceCoords };
}
