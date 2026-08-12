"use client";

import { cn } from "@/lib/utils/cn";
import { RUN_TYPE_LABELS, RUN_TYPES, type RunType } from "@/types/leveling";

interface RunTabsProps {
  active: RunType;
  onChange: (runType: RunType) => void;
}

/**
 * Tabs «Ida» / «Vuelta» para alternar la libreta activa en el editor.
 *
 * A diferencia de `Tabs` del design system (enlaces atados a `?tab=` para
 * paneles resueltos por un Server Component), esta selección es puramente de
 * cliente: la libreta de vuelta ya vive en el estado del editor, así que
 * alternar no necesita navegación. Se llama solo cuando el proceso tiene
 * recorrido de vuelta (`has_return_run`).
 */
export function RunTabs({ active, onChange }: RunTabsProps) {
  return (
    <div role="tablist" className="flex gap-1 border-b border-neutral-200">
      {RUN_TYPES.map((runType) => {
        const isActive = runType === active;
        return (
          <button
            key={runType}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(runType)}
            className={cn(
              "-mb-px border-b-2 px-4 py-2.5 text-sm font-medium transition-colors",
              isActive
                ? "border-primary-500 text-primary-600"
                : "border-transparent text-neutral-500 hover:text-neutral-800",
            )}
          >
            {RUN_TYPE_LABELS[runType]}
          </button>
        );
      })}
    </div>
  );
}
