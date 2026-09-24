"use client";

import { useId, useState } from "react";
import { Button, DmsInput, EMPTY_DMS, type DmsValue } from "@/components/design-system";
import { cn } from "@/lib/utils/cn";
import {
  decimalToDms,
  decimalToDmsFields,
  dmsFieldsToDecimal,
  formatDecimalDegrees,
  roundsOnStorage,
} from "@/lib/calculations/angles";
import type { AngleInputFormat } from "@/types/polygonal";

/**
 * Captura de ángulos de poligonal en DMS o en grados decimales (Fase 13, P1).
 *
 * Vive con la poligonal y no en el sistema de diseño: convierte con
 * `@/lib/calculations/angles`, y un componente del sistema de diseño no
 * conoce el dominio (doc técnica, § 8, «Qué entra en el sistema de diseño»).
 * El que sí es genérico, `DmsInput`, se queda allí y este lo reutiliza.
 */
type AngleFormat = AngleInputFormat;

interface AngleInputProps {
  label?: string;
  /** El ángulo SIEMPRE en DMS: es como se guarda. */
  value: DmsValue;
  onChange: (value: DmsValue) => void;
  /** Cómo se teclea: tres casillas DMS o un campo en grados decimales. */
  format: AngleFormat;
  error?: string;
  disabled?: boolean;
}

function sameDms(a: DmsValue, b: DmsValue): boolean {
  return a.deg === b.deg && a.min === b.min && a.sec === b.sec;
}

function decimalText(value: DmsValue): string {
  const decimal = dmsFieldsToDecimal(value);
  return decimal === null ? "" : formatDecimalDegrees(decimal);
}

/**
 * Captura de un ángulo en DMS o en grados decimales (Fase 13, P1).
 *
 * El valor entra y sale SIEMPRE en DMS, que es como se guarda: el formato
 * decimal es solo una vista. Por eso conmutar de formato no altera ningún
 * valor. El campo decimal se convierte a DMS al teclear, redondeando a la
 * décima de segundo, y avisa cuando lo tecleado tenía más precisión.
 */
export function AngleInput({
  label,
  value,
  onChange,
  format,
  error,
  disabled,
}: AngleInputProps) {
  const id = useId();
  // En decimal, el texto se conserva tal cual se teclea: reconvertir en cada
  // pulsación a partir del DMS haría imposible escribir «45.» o «45.50».
  const [text, setText] = useState(() => decimalText(value));
  // El último valor que este campo conoce. Si el valor cambia desde fuera
  // (otra lectura, un reinicio), el texto se recalcula; si es el que este
  // campo acaba de emitir, se respeta lo tecleado. Es el patrón de React de
  // ajustar el estado a partir del render anterior, sin efecto.
  const [known, setKnown] = useState<DmsValue>(value);
  if (!sameDms(value, known)) {
    setKnown(value);
    setText(decimalText(value));
  }

  if (format === "dms") {
    return (
      <DmsInput
        label={label}
        value={value}
        onChange={onChange}
        error={error}
        disabled={disabled}
      />
    );
  }

  const typed = text.trim() === "" ? null : Number(text);
  const rounding = typed !== null && Number.isFinite(typed) && roundsOnStorage(typed);
  const stored = rounding && typed !== null ? decimalToDms(typed) : null;

  function handleChange(next: string) {
    setText(next);
    const n = next.trim() === "" ? null : Number(next);
    const emitted =
      n === null ? { ...EMPTY_DMS } : Number.isFinite(n) ? decimalToDmsFields(n) : null;
    if (!emitted) return;
    setKnown(emitted);
    onChange(emitted);
  }

  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label htmlFor={id} className="text-sm font-medium text-neutral-800">
          {label}
        </label>
      )}
      <div className="flex items-center gap-1">
        <input
          id={id}
          type="number"
          step="any"
          inputMode="decimal"
          aria-label={label ? undefined : "Grados decimales"}
          className={cn(
            "h-9 min-h-11 w-36 rounded-md border border-neutral-400 bg-white px-1.5 text-right text-sm text-neutral-900",
            "disabled:bg-neutral-100 disabled:text-neutral-500",
            error && "border-danger-500",
          )}
          value={text}
          disabled={disabled}
          onChange={(e) => handleChange(e.target.value)}
        />
        <span className="text-sm text-neutral-500">°</span>
      </div>
      {stored && (
        <p className="text-xs text-warning-500">
          Se guarda como {stored.deg}°{stored.min}′{stored.sec}″ (a la décima de
          segundo).
        </p>
      )}
      {error && <p className="text-sm text-danger-500">{error}</p>}
    </div>
  );
}

const FORMAT_LABELS: Record<AngleFormat, string> = {
  dms: "DMS (° ′ ″)",
  decimal: "Grados decimales",
};

/**
 * Conmutador del formato de captura de ángulos (Fase 13, P1). Dos botones con
 * `aria-pressed`: el formato activo se anuncia al lector de pantalla y no se
 * distingue solo por el color.
 */
export function AngleFormatToggle({
  value,
  onChange,
}: {
  value: AngleFormat;
  onChange: (format: AngleFormat) => void;
}) {
  return (
    <div role="group" aria-label="Formato de los ángulos" className="inline-flex items-center gap-1">
      <span className="mr-1 text-sm text-neutral-700">Ángulos en</span>
      {(["dms", "decimal"] as const).map((format) => (
        <Button
          key={format}
          type="button"
          size="sm"
          variant={value === format ? "primary" : "secondary"}
          aria-pressed={value === format}
          onClick={() => value !== format && onChange(format)}
        >
          {FORMAT_LABELS[format]}
        </Button>
      ))}
    </div>
  );
}
