"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { setAngleInputFormatAction } from "@/app/(app)/projects/[id]/polygonal/[pid]/actions";
import { ProcessSteps } from "@/components/process/process-steps";
import type { AngleInputFormat } from "@/types/polygonal";
import { AngleFormatToggle } from "./angle-input";
import { callAction } from "@/lib/errors/action-call";

export const POLYGONAL_STEPS = [
  { id: "datos", label: "Datos" },
  { id: "ajuste", label: "Ajuste" },
  { id: "informe", label: "Informe" },
] as const;
export type PolygonalStep = (typeof POLYGONAL_STEPS)[number]["id"];

interface PolygonalStepsProps {
  basePath: string;
  active: PolygonalStep;
  processId: string;
  angleFormat: AngleInputFormat;
}

/**
 * Los pasos de la poligonal (Fase 35): 1 · Datos, 2 · Ajuste, 3 · Informe, como
 * pestañas con número, y a la derecha el formato de los ángulos. El formato se
 * guarda al conmutar y rige la tabla, el ajuste, el informe y los popups: la
 * página se vuelve a pintar con él. Es un `<nav>`: no se imprime.
 */
export function PolygonalSteps({ basePath, active, processId, angleFormat }: PolygonalStepsProps) {
  const router = useRouter();
  const [format, setFormat] = useState(angleFormat);
  const [error, setError] = useState<string | null>(null);
  // En serie, como desde la Fase 13: dos clics rápidos no llegan en desorden.
  const queue = useRef<Promise<unknown>>(Promise.resolve());

  function change(next: AngleInputFormat) {
    setFormat(next);
    setError(null);
    queue.current = queue.current.then(() =>
      callAction(() => setAngleInputFormatAction(processId, next)).then((r) => {
        if (r.ok) router.refresh();
        else setError(r.error ?? "No se pudo guardar el formato.");
      }),
    );
  }

  return (
    <ProcessSteps
      steps={POLYGONAL_STEPS}
      active={active}
      basePath={basePath}
      trailing={
        <>
          <AngleFormatToggle value={format} onChange={change} />
          {error && <span className="text-xs text-danger">{error}</span>}
        </>
      }
    />
  );
}
