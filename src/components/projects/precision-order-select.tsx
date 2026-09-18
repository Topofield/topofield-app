"use client";

import { Select, type SelectOption } from "@/components/design-system";
import {
  ANGULAR_TOLERANCE_K,
  MIN_RELATIVE_PRECISION,
} from "@/lib/calculations/tolerances";
import {
  PRECISION_ORDERS,
  PRECISION_ORDER_LABELS,
  type PrecisionOrder,
} from "@/types/project";

/** Pequeño descriptor del uso típico de cada orden, para el helperText. */
const PRECISION_ORDER_DESCRIPTIONS: Record<PrecisionOrder, string> = {
  primer_orden: "Geodésico de alta precisión (control fundamental).",
  segundo_orden: "Control urbano y catastral.",
  tercer_orden: "Levantamiento topográfico común.",
  ordinario: "Levantamiento rural o reconocimiento.",
};

function formatMinPrecision(order: PrecisionOrder): string {
  return MIN_RELATIVE_PRECISION[order].toLocaleString("es-CO");
}

/** Etiqueta para la opción del dropdown: incluye tolerancia y precisión mínima. */
function dropdownLabel(order: PrecisionOrder): string {
  return `${PRECISION_ORDER_LABELS[order]} (${ANGULAR_TOLERANCE_K[order]}″·√n · 1:${formatMinPrecision(order)})`;
}

/** Texto descriptivo bajo el Select para el orden seleccionado. */
function helperFor(order: PrecisionOrder): string {
  return `${PRECISION_ORDER_DESCRIPTIONS[order]} Tolerancia angular ${ANGULAR_TOLERANCE_K[order]}″·√n; precisión relativa mínima 1:${formatMinPrecision(order)}.`;
}

const OPTIONS: SelectOption[] = PRECISION_ORDERS.map((value) => ({
  value,
  label: dropdownLabel(value),
}));

interface PrecisionOrderSelectProps {
  value: PrecisionOrder;
  onChange: (value: PrecisionOrder) => void;
  required?: boolean;
  disabled?: boolean;
  error?: string;
}

/**
 * Select controlado de `precision_order`: el helperText muestra la tolerancia
 * angular (K·√n) y la precisión relativa mínima del PRD § 5.4 del orden
 * elegido, de modo que el usuario entienda el impacto antes de guardar el
 * proceso.
 *
 * Controlado (`value`/`onChange`) y no con estado propio: cada proceso trae un
 * orden por defecto (`tercer_orden`, el de la columna en la base) y quien lo
 * usa necesita leerlo en vivo, por ejemplo para el aviso de equipo
 * insuficiente.
 */
export function PrecisionOrderSelect({
  value,
  onChange,
  required,
  disabled,
  error,
}: PrecisionOrderSelectProps) {
  return (
    <Select
      label="Orden de precisión"
      name="precision_order"
      options={OPTIONS}
      required={required}
      disabled={disabled}
      error={error}
      value={value}
      onChange={(e) => onChange(e.target.value as PrecisionOrder)}
      helperText={helperFor(value)}
    />
  );
}
