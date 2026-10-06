"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { setAngleInputFormatAction } from "@/app/(app)/projects/[id]/polygonal/[pid]/actions";
import { cn } from "@/lib/utils/cn";
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
    <nav
      aria-label="Pasos del proceso"
      className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-rule print:hidden"
    >
      <div className="flex">
        {POLYGONAL_STEPS.map((step, i) => {
          const on = step.id === active;
          return (
            <Link
              key={step.id}
              href={`${basePath}?tab=${step.id}`}
              aria-current={on ? "page" : undefined}
              className={cn(
                "-mb-px inline-flex items-center gap-2 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors sm:px-4",
                on ? "border-mira-strong text-ink" : "border-transparent text-ink-2 hover:text-ink",
              )}
            >
              <span
                aria-hidden="true"
                className={cn(
                  "inline-flex h-5 w-5 items-center justify-center rounded-full text-xs font-semibold",
                  on ? "bg-mira text-on-mira" : "bg-sel text-ink-2",
                )}
              >
                {i + 1}
              </span>
              {step.label}
            </Link>
          );
        })}
      </div>
      <div className="flex items-center gap-2 pb-1.5">
        <AngleFormatToggle value={format} onChange={change} />
        {error && <span className="text-xs text-danger">{error}</span>}
      </div>
    </nav>
  );
}
