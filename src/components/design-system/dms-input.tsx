"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { cn } from "@/lib/utils/cn";
import { NOT_A_NUMBER, useNumberValidity } from "./number-input";

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

/**
 * Una de las tres celdas. `type="text"` y no `type="number"`, que rechaza la
 * coma decimal (Fase 20, UI2): grados y minutos son enteros; los segundos
 * admiten decimales, con coma o con punto.
 */
function DmsCell({
  id,
  label,
  value,
  onChange,
  decimal,
  className,
  disabled,
  onInvalid,
}: {
  id?: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  decimal: boolean;
  className: string;
  disabled?: boolean;
  onInvalid: (invalid: boolean) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const invalid = useNumberValidity(value, ref);
  useEffect(() => onInvalid(invalid), [invalid, onInvalid]);
  return (
    <input
      ref={ref}
      id={id}
      type="text"
      inputMode={decimal ? "decimal" : "numeric"}
      autoComplete="off"
      spellCheck={false}
      aria-label={label}
      aria-invalid={invalid ? true : undefined}
      className={cn(className, invalid && "border-danger")}
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
    />
  );
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
  const [invalidParts, setInvalidParts] = useState({ deg: false, min: false, sec: false });
  const markDeg = useCallback((v: boolean) => setInvalidParts((p) => (p.deg === v ? p : { ...p, deg: v })), []);
  const markMin = useCallback((v: boolean) => setInvalidParts((p) => (p.min === v ? p : { ...p, min: v })), []);
  const markSec = useCallback((v: boolean) => setInvalidParts((p) => (p.sec === v ? p : { ...p, sec: v })), []);
  const anyInvalid = invalidParts.deg || invalidParts.min || invalidParts.sec;
  const message = anyInvalid ? NOT_A_NUMBER : error;

  const cell = cn(
    "h-9 min-h-11 w-16 md:w-14 rounded-md border border-rule-strong bg-card px-1.5 text-center text-sm text-ink",
    "disabled:bg-sel disabled:text-ink-2",
    error && "border-danger",
  );

  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label htmlFor={`${id}-deg`} className="text-sm font-medium text-ink">
          {label}
        </label>
      )}
      <div className="flex items-center gap-1">
        <DmsCell
          id={`${id}-deg`}
          label="Grados"
          value={value.deg}
          decimal={false}
          className={cell}
          disabled={disabled}
          onInvalid={markDeg}
          onChange={(deg) => onChange({ ...value, deg })}
        />
        <span className="text-sm text-ink-2">°</span>
        <DmsCell
          label="Minutos"
          value={value.min}
          decimal={false}
          className={cell}
          disabled={disabled}
          onInvalid={markMin}
          onChange={(min) => onChange({ ...value, min })}
        />
        <span className="text-sm text-ink-2">′</span>
        <DmsCell
          label="Segundos"
          value={value.sec}
          decimal
          className={cell}
          disabled={disabled}
          onInvalid={markSec}
          onChange={(sec) => onChange({ ...value, sec })}
        />
        <span className="text-sm text-ink-2">″</span>
      </div>
      {message && <p className="text-sm text-danger">{message}</p>}
    </div>
  );
}
