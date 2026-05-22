import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";

type Variant = "primary" | "secondary" | "danger" | "ghost";
type Size = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

const VARIANT_CLASSES: Record<Variant, string> = {
  primary:
    "bg-primary-500 text-white hover:bg-primary-600 active:bg-primary-700 disabled:bg-neutral-200 disabled:text-neutral-500",
  secondary:
    "bg-white text-primary-600 border border-primary-500 hover:bg-primary-50 disabled:bg-neutral-100 disabled:text-neutral-500 disabled:border-neutral-200",
  danger:
    "bg-danger-500 text-white hover:opacity-90 disabled:bg-neutral-200 disabled:text-neutral-500",
  ghost:
    "bg-transparent text-primary-600 hover:bg-primary-50 disabled:text-neutral-500",
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
    "inline-flex items-center justify-center rounded-md font-medium transition-colors disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2",
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
