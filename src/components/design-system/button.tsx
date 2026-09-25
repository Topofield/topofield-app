import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";

type Variant = "primary" | "secondary" | "danger" | "ghost";
type Size = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

// Identidad del prototipo (Fase 20): la acción principal es el amarillo
// «mira» con texto oscuro; el resto, tinta sobre tarjeta con el borde de un
// control. `brightness` en vez de un token de hover: vale en los dos temas.
const VARIANT_CLASSES: Record<Variant, string> = {
  primary:
    "bg-mira text-on-mira hover:brightness-95 active:brightness-90 disabled:bg-rule disabled:text-ink-3 disabled:brightness-100",
  secondary:
    "bg-card text-ink border border-rule-strong hover:bg-sel disabled:bg-paper disabled:text-ink-3 disabled:border-rule",
  danger:
    "bg-danger text-on-danger hover:opacity-90 disabled:bg-rule disabled:text-ink-3",
  ghost:
    "bg-transparent text-ink hover:bg-sel disabled:text-ink-3",
};

const SIZE_CLASSES: Record<Size, string> = {
  sm: "h-8 px-3 text-sm",
  md: "h-10 px-4 text-base",
  lg: "h-12 px-6 text-lg",
};

/**
 * Composición de clases de un botón. Se exporta para que un `next/link` pueda
 * verse como botón sin anidar un `<button>` dentro de un `<a>` (HTML inválido).
 */
export function buttonClasses({
  variant = "primary",
  size = "md",
  className,
}: {
  variant?: Variant;
  size?: Size;
  className?: string;
} = {}) {
  return cn(
    "inline-flex items-center justify-center rounded-md font-medium transition-colors disabled:cursor-not-allowed",
    VARIANT_CLASSES[variant],
    SIZE_CLASSES[size],
    className,
  );
}

export function Button({
  variant = "primary",
  size = "md",
  className,
  type = "button",
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={buttonClasses({ variant, size, className })}
      {...rest}
    />
  );
}
