"use client";

import { Input } from "@/components/design-system";
import type { Thresholds } from "@/types/settlement";

interface ThresholdsFieldsProps {
  value: Thresholds;
  onChange: (value: Thresholds) => void;
  disabled?: boolean;
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
  const set = (key: keyof Thresholds) => (raw: string) =>
    onChange({ ...value, [key]: raw === "" ? Number.NaN : Number(raw) });

  return (
    <div className="flex flex-col gap-4">
      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium text-neutral-800">
          Velocidad (mm/mes)
        </legend>
        <div className="grid grid-cols-3 gap-2">
          <Input
            label="Precaución"
            type="number"
            step="0.1"
            value={
              Number.isFinite(value.velocityCaution)
                ? String(value.velocityCaution)
                : ""
            }
            onChange={(e) => set("velocityCaution")(e.target.value)}
            disabled={disabled}
          />
          <Input
            label="Alerta"
            type="number"
            step="0.1"
            value={
              Number.isFinite(value.velocityAlert)
                ? String(value.velocityAlert)
                : ""
            }
            onChange={(e) => set("velocityAlert")(e.target.value)}
            disabled={disabled}
          />
          <Input
            label="Alarma"
            type="number"
            step="0.1"
            value={
              Number.isFinite(value.velocityAlarm)
                ? String(value.velocityAlarm)
                : ""
            }
            onChange={(e) => set("velocityAlarm")(e.target.value)}
            disabled={disabled}
          />
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium text-neutral-800">
          Asentamiento acumulado (mm)
        </legend>
        <div className="grid grid-cols-3 gap-2">
          <Input
            label="Precaución"
            type="number"
            step="0.1"
            value={
              Number.isFinite(value.accumulatedCaution)
                ? String(value.accumulatedCaution)
                : ""
            }
            onChange={(e) => set("accumulatedCaution")(e.target.value)}
            disabled={disabled}
          />
          <Input
            label="Alerta"
            type="number"
            step="0.1"
            value={
              Number.isFinite(value.accumulatedAlert)
                ? String(value.accumulatedAlert)
                : ""
            }
            onChange={(e) => set("accumulatedAlert")(e.target.value)}
            disabled={disabled}
          />
          <Input
            label="Alarma"
            type="number"
            step="0.1"
            value={
              Number.isFinite(value.accumulatedAlarm)
                ? String(value.accumulatedAlarm)
                : ""
            }
            onChange={(e) => set("accumulatedAlarm")(e.target.value)}
            disabled={disabled}
          />
        </div>
      </fieldset>

      <Input
        label="Límite de distorsión angular (1/X)"
        type="number"
        step="1"
        helperText="Un X menor es más severo: 1/300 es peor que 1/500."
        value={
          Number.isFinite(value.angularDistortionLimit)
            ? String(value.angularDistortionLimit)
            : ""
        }
        onChange={(e) => set("angularDistortionLimit")(e.target.value)}
        disabled={disabled}
      />
    </div>
  );
}
