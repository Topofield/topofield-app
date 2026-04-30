import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

type Variant = "info" | "success" | "warning" | "error";

interface AlertProps {
  variant?: Variant;
  title?: string;
  children?: ReactNode;
  className?: string;
}

const VARIANT_CLASSES: Record<Variant, string> = {
  info: "border-primary-200 bg-primary-50 text-primary-700",
  success: "border-success-500/30 bg-success-500/10 text-neutral-900",
  warning: "border-warning-500/30 bg-warning-500/10 text-neutral-900",
  error: "border-danger-500/30 bg-danger-500/10 text-danger-500",
};

export function Alert({
  variant = "info",
  title,
  children,
  className,
}: AlertProps) {
  return (
    <div
      role="alert"
      className={cn(
        "rounded-md border px-4 py-3",
        VARIANT_CLASSES[variant],
        className,
      )}
    >
      {title && <p className="text-sm font-semibold">{title}</p>}
      {children && <div className="text-sm">{children}</div>}
    </div>
  );
}
