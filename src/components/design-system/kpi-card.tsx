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
      <p className="mt-1 text-3xl font-semibold text-neutral-900">{value}</p>
      {hint && <p className="mt-1 text-xs text-neutral-500">{hint}</p>}
    </div>
  );
}
