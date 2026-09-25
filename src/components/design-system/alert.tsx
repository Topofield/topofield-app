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
  info: "border-rule bg-sel text-ink",
  success: "border-success/30 bg-success-bg text-ink",
  warning: "border-warning/30 bg-warning-bg text-ink",
  error: "border-danger/30 bg-danger-bg text-danger",
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
