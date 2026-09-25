import { useId, type SelectHTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";

export interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  helperText?: string;
  options: SelectOption[];
  /** Si se define, añade una opción inicial vacía con este texto. */
  placeholder?: string;
}

export function Select({
  label,
  error,
  helperText,
  options,
  placeholder,
  className,
  id,
  ...rest
}: SelectProps) {
  const generatedId = useId();
  const selectId = id ?? generatedId;
  const describedBy = error
    ? `${selectId}-error`
    : helperText
      ? `${selectId}-helper`
      : undefined;

  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label
          htmlFor={selectId}
          className="text-sm font-medium text-ink"
        >
          {label}
        </label>
      )}
      <select
        id={selectId}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={cn(
          "h-10 rounded-md border border-rule-strong bg-card px-3 text-base text-ink",
          "disabled:bg-sel disabled:text-ink-2",
          error && "border-danger",
          className,
        )}
        {...rest}
      >
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error ? (
        <p id={`${selectId}-error`} className="text-sm text-danger">
          {error}
        </p>
      ) : helperText ? (
        <p id={`${selectId}-helper`} className="text-sm text-ink-2">
          {helperText}
        </p>
      ) : null}
    </div>
  );
}
