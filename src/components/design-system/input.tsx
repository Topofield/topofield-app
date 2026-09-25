import { useId, type ComponentPropsWithRef } from "react";
import { cn } from "@/lib/utils/cn";

// `ComponentPropsWithRef` y no `InputHTMLAttributes`: en React 19 `ref` es una
// prop más y llega al `<input>` con el resto. `NumberInput` la usa para
// `setCustomValidity`.
interface InputProps extends ComponentPropsWithRef<"input"> {
  label?: string;
  error?: string;
  helperText?: string;
}

export function Input({
  label,
  error,
  helperText,
  className,
  id,
  ...rest
}: InputProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const describedBy = error
    ? `${inputId}-error`
    : helperText
      ? `${inputId}-helper`
      : undefined;

  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label
          htmlFor={inputId}
          className="text-sm font-medium text-ink"
        >
          {label}
        </label>
      )}
      <input
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={cn(
          "h-10 rounded-md border border-rule-strong bg-card px-3 text-base text-ink placeholder:text-ink-3",
          "disabled:bg-sel disabled:text-ink-2",
          error && "border-danger",
          className,
        )}
        {...rest}
      />
      {error ? (
        <p id={`${inputId}-error`} className="text-sm text-danger">
          {error}
        </p>
      ) : helperText ? (
        <p id={`${inputId}-helper`} className="text-sm text-ink-2">
          {helperText}
        </p>
      ) : null}
    </div>
  );
}
