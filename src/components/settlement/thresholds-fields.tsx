"use client";

import { useState } from "react";
import { NumberInput } from "@/components/design-system";
import { parseNumber } from "@/lib/utils/parse";
import type { Thresholds } from "@/types/settlement";

interface ThresholdsFieldsProps {
  value: Thresholds;
  onChange: (value: Thresholds) => void;
  disabled?: boolean;
}

const cellText = (n: number) => (Number.isFinite(n) ? String(n) : "");

/**
 * Un umbral. El formulario guarda números, pero la celda guarda el **texto**:
 * reconvertir en cada pulsación borraría el separador de «2,» o «2.» y no se
 * podría teclear un decimal (Fase 20, UI2). Si el número cambia desde fuera
 * —el preset de otro tipo de estructura—, el texto se recalcula; si es el que
 * esta celda acaba de emitir, se respeta lo tecleado. Es el patrón de
 * `AngleInput`: ajustar el estado a partir del render anterior, sin efecto.
 * Vacío o inválido se emite como `NaN`, que el validador del lugar rechaza.
 */
function ThresholdCell({
  label,
  helperText,
  value,
  onChange,
  disabled,
  integer,
}: {
  label: string;
  helperText?: string;
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  integer?: boolean;
}) {
  const [text, setText] = useState(() => cellText(value));
  const [known, setKnown] = useState(value);
  if (!Object.is(value, known)) {
    setKnown(value);
    setText(cellText(value));
  }
  return (
    <NumberInput
      label={label}
      helperText={helperText}
      integer={integer}
      value={text}
      disabled={disabled}
      onChange={(e) => {
        const next = parseNumber(e.target.value) ?? Number.NaN;
        setText(e.target.value);
        setKnown(next);
        onChange(next);
      }}
    />
  );
}

/**
 * Los siete umbrales de alerta de un lugar.
 *
 * El preset lo aplica el contenedor al cambiar el tipo de estructura; aquí solo
 * se editan. Así el usuario puede apartarse del preset sin que un efecto se lo
 * revierta.
 */
export function ThresholdsFields({
  value,
  onChange,
  disabled,
}: ThresholdsFieldsProps) {
  const set = (key: keyof Thresholds) => (n: number) =>
    onChange({ ...value, [key]: n });

  return (
    <div className="flex flex-col gap-4">
      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium text-ink">
          Velocidad (mm/mes)
        </legend>
        <div className="grid grid-cols-3 gap-2">
          <ThresholdCell
            label="Precaución"
            value={value.velocityCaution}
            onChange={set("velocityCaution")}
            disabled={disabled}
          />
          <ThresholdCell
            label="Alerta"
            value={value.velocityAlert}
            onChange={set("velocityAlert")}
            disabled={disabled}
          />
          <ThresholdCell
            label="Alarma"
            value={value.velocityAlarm}
            onChange={set("velocityAlarm")}
            disabled={disabled}
          />
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium text-ink">
          Asentamiento acumulado (mm)
        </legend>
        <div className="grid grid-cols-3 gap-2">
          <ThresholdCell
            label="Precaución"
            value={value.accumulatedCaution}
            onChange={set("accumulatedCaution")}
            disabled={disabled}
          />
          <ThresholdCell
            label="Alerta"
            value={value.accumulatedAlert}
            onChange={set("accumulatedAlert")}
            disabled={disabled}
          />
          <ThresholdCell
            label="Alarma"
            value={value.accumulatedAlarm}
            onChange={set("accumulatedAlarm")}
            disabled={disabled}
          />
        </div>
      </fieldset>

      <ThresholdCell
        integer
        label="Límite de distorsión angular (1/X)"
        helperText="Un X menor es más severo: 1/300 es peor que 1/500."
        value={value.angularDistortionLimit}
        onChange={set("angularDistortionLimit")}
        disabled={disabled}
      />
    </div>
  );
}
