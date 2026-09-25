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
          className="text-sm font-medium text-neutral-800"
        >
          {label}
        </label>
      )}
      <input
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={cn(
          "h-10 rounded-md border border-neutral-400 bg-white px-3 text-base text-neutral-900 placeholder:text-neutral-500",
          "disabled:bg-neutral-100 disabled:text-neutral-500",
          error && "border-danger-500",
          className,
        )}
        {...rest}
      />
      {error ? (
        <p id={`${inputId}-error`} className="text-sm text-danger-500">
          {error}
        </p>
      ) : helperText ? (
        <p id={`${inputId}-helper`} className="text-sm text-neutral-500">
          {helperText}
        </p>
      ) : null}
    </div>
  );
}
