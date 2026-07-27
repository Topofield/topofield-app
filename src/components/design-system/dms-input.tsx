import { useId } from "react";
import { cn } from "@/lib/utils/cn";

/** Valor de un ángulo en grados, minutos y segundos (como texto de inputs). */
export interface DmsValue {
  deg: string;
  min: string;
  sec: string;
}

export const EMPTY_DMS: DmsValue = { deg: "", min: "", sec: "" };

interface DmsInputProps {
  label?: string;
  value: DmsValue;
  onChange: (value: DmsValue) => void;
  error?: string;
  disabled?: boolean;
}

/** Captura de un ángulo en tres campos: grados, minutos y segundos. */
export function DmsInput({
  label,
  value,
  onChange,
  error,
  disabled,
}: DmsInputProps) {
  const id = useId();
  const cell = cn(
    "h-9 min-h-11 w-16 md:w-14 rounded-md border border-neutral-200 bg-white px-1.5 text-center text-sm text-neutral-900",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500",
    "disabled:bg-neutral-100 disabled:text-neutral-500",
    error && "border-danger-500 focus-visible:ring-danger-500",
  );

  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label htmlFor={`${id}-deg`} className="text-sm font-medium text-neutral-800">
          {label}
        </label>
      )}
      <div className="flex items-center gap-1">
        <input
          id={`${id}-deg`}
          type="number"
          inputMode="numeric"
          aria-label="Grados"
          className={cell}
          value={value.deg}
          disabled={disabled}
          onChange={(e) => onChange({ ...value, deg: e.target.value })}
        />
        <span className="text-sm text-neutral-500">°</span>
        <input
          type="number"
          inputMode="numeric"
          aria-label="Minutos"
          className={cell}
          value={value.min}
          disabled={disabled}
          onChange={(e) => onChange({ ...value, min: e.target.value })}
        />
        <span className="text-sm text-neutral-500">′</span>
        <input
          type="number"
          inputMode="numeric"
          aria-label="Segundos"
          className={cell}
          value={value.sec}
          disabled={disabled}
          onChange={(e) => onChange({ ...value, sec: e.target.value })}
        />
        <span className="text-sm text-neutral-500">″</span>
      </div>
      {error && <p className="text-sm text-danger-500">{error}</p>}
    </div>
  );
}
