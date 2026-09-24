import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

interface KpiCardProps {
  label: string;
  value: ReactNode;
  hint?: string;
  className?: string;
}

export function KpiCard({ label, value, hint, className }: KpiCardProps) {
  return (
    <div
      className={cn(
        "rounded-lg border border-neutral-200 bg-white px-5 py-4 shadow-sm",
        className,
      )}
    >
      <p className="text-sm font-medium text-neutral-500">{label}</p>
      {/* <div> y no <p>: `value` puede traer bloques (un semáforo, una
          etiqueta), y un <div> dentro de un <p> rompe la hidratación. */}
      <div className="mt-1 break-words text-2xl font-semibold text-neutral-900 sm:text-3xl">
        {value}
      </div>
      {hint && <p className="mt-1 text-xs text-neutral-500">{hint}</p>}
    </div>
  );
}
