import { cn } from "@/lib/utils/cn";

type Status = "ok" | "warning" | "danger";

const DOT_CLASSES: Record<Status, string> = {
  ok: "bg-success-500",
  warning: "bg-warning-500",
  danger: "bg-danger-500",
};

interface StatusIndicatorProps {
  status: Status;
  label: string;
  className?: string;
}

/** Semáforo de cumplimiento de tolerancia: verde / amarillo / rojo + etiqueta. */
export function StatusIndicator({
  status,
  label,
  className,
}: StatusIndicatorProps) {
  return (
    <div className={cn("inline-flex items-center gap-2", className)}>
      <span
        aria-hidden
        className={cn("h-2.5 w-2.5 shrink-0 rounded-full", DOT_CLASSES[status])}
      />
      <span className="text-sm font-medium text-neutral-800">{label}</span>
    </div>
  );
}
