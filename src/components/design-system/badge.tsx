import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

type Tone = "neutral" | "primary" | "success" | "warning" | "danger";

interface BadgeProps {
  tone?: Tone;
  children: ReactNode;
  className?: string;
}

// «primary» conserva el nombre para no tocar a los llamadores; desde la Fase
// 20 es el tinte del acento mira. Los estados usan su tinte explícito, no /10.
const TONE_CLASSES: Record<Tone, string> = {
  neutral: "bg-sel text-ink-2",
  primary: "bg-mira-bg text-mira-ink",
  success: "bg-success-bg text-success",
  warning: "bg-warning-bg text-warning",
  danger: "bg-danger-bg text-danger",
};

export function Badge({ tone = "neutral", children, className }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        TONE_CLASSES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
