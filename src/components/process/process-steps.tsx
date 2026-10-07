"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

interface ProcessStepsProps<T extends string> {
  steps: readonly { id: T; label: string }[];
  active: T;
  basePath: string;
  /** Lo que va a la derecha de los pasos: el formato de los ángulos, importar… */
  trailing?: ReactNode;
}

/**
 * Los pasos de un proceso (Fases 35 y 36): pestañas con número que llevan a
 * `?tab=<id>`, y a la derecha lo propio de cada módulo. Es un `<nav>`: no se
 * imprime.
 */
export function ProcessSteps<T extends string>({ steps, active, basePath, trailing }: ProcessStepsProps<T>) {
  return (
    <nav
      aria-label="Pasos del proceso"
      className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-rule print:hidden"
    >
      <div className="flex">
        {steps.map((step, i) => {
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
      {trailing && <div className="flex items-center gap-2 pb-1.5">{trailing}</div>}
    </nav>
  );
}
