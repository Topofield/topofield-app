import { useId, type TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export function Textarea({
  label,
  error,
  helperText,
  className,
  id,
  rows = 3,
  ...rest
}: TextareaProps) {
  const generatedId = useId();
  const textareaId = id ?? generatedId;
  const describedBy = error
    ? `${textareaId}-error`
    : helperText
      ? `${textareaId}-helper`
      : undefined;

  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label
          htmlFor={textareaId}
          className="text-sm font-medium text-neutral-800"
        >
          {label}
        </label>
      )}
      <textarea
        id={textareaId}
        rows={rows}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={cn(
          "rounded-md border border-neutral-200 bg-white px-3 py-2 text-base text-neutral-900 placeholder:text-neutral-500",
          "disabled:bg-neutral-100 disabled:text-neutral-500",
          error && "border-danger-500",
          className,
        )}
        {...rest}
      />
      {error ? (
        <p id={`${textareaId}-error`} className="text-sm text-danger-500">
          {error}
        </p>
      ) : helperText ? (
        <p id={`${textareaId}-helper`} className="text-sm text-neutral-500">
          {helperText}
        </p>
      ) : null}
    </div>
  );
}
