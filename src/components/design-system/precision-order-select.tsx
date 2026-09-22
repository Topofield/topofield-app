"use client";

import { Select, type SelectOption } from "./select";
import {
  ANGULAR_TOLERANCE_K,
  LEVELING_TOLERANCE_K,
  MIN_RELATIVE_PRECISION,
} from "@/lib/calculations/tolerances";
import {
  PRECISION_ORDERS,
  PRECISION_ORDER_LABELS,
  type PrecisionOrder,
} from "@/types/project";

/**
 * Qué instrumento levanta el proceso, y por tanto qué tolerancia se enuncia.
 *
 * Es OBLIGATORIO y no tiene valor por defecto a propósito: cuando el
 * componente vivía en `projects/` y no tenía este parámetro, los tres módulos
 * compartían la copia de poligonal y las pantallas de nivelación y de
 * asentamientos anunciaban «15″·√n · 1:5.000» — una tolerancia angular y una
 * precisión relativa que en nivelación no existen. Sin valor por defecto, un
 * cuarto consumidor no puede heredar en silencio el texto equivocado.
 */
export type PrecisionOrderKind = "angular" | "leveling";

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

/**
 * La tolerancia del orden, en la unidad del instrumento.
 *
 * Poligonal: cierre angular `K·√n` en segundos, más la precisión relativa
 * mínima 1:X (PRD § 5.4). Nivelación: cierre `K·√D` en milímetros, con D en
 * km. En nivelación no hay tolerancia angular ni precisión relativa, así que
 * no se nombran.
 */
function toleranceText(
  kind: PrecisionOrderKind,
  order: PrecisionOrder,
): string {
  return kind === "angular"
    ? `${ANGULAR_TOLERANCE_K[order]}″·√n · 1:${formatMinPrecision(order)}`
    : `${LEVELING_TOLERANCE_K[order]} mm·√D`;
}

/** Etiqueta para la opción del dropdown: orden más su tolerancia. */
function dropdownLabel(
  kind: PrecisionOrderKind,
  order: PrecisionOrder,
): string {
  return `${PRECISION_ORDER_LABELS[order]} (${toleranceText(kind, order)})`;
}

/** Texto descriptivo bajo el Select para el orden seleccionado. */
function helperFor(kind: PrecisionOrderKind, order: PrecisionOrder): string {
  const detalle =
    kind === "angular"
      ? `Tolerancia angular ${ANGULAR_TOLERANCE_K[order]}″·√n; precisión relativa mínima 1:${formatMinPrecision(order)}.`
      : `Tolerancia de cierre ${LEVELING_TOLERANCE_K[order]} mm·√D, con D en km.`;
  return `${PRECISION_ORDER_DESCRIPTIONS[order]} ${detalle}`;
}

const OPTIONS: Record<PrecisionOrderKind, SelectOption[]> = {
  angular: PRECISION_ORDERS.map((value) => ({
    value,
    label: dropdownLabel("angular", value),
  })),
  leveling: PRECISION_ORDERS.map((value) => ({
    value,
    label: dropdownLabel("leveling", value),
  })),
};

interface PrecisionOrderSelectProps {
  /** Instrumento del proceso: fija la unidad de la tolerancia enunciada. */
  kind: PrecisionOrderKind;
  value: PrecisionOrder;
  onChange: (value: PrecisionOrder) => void;
  required?: boolean;
  disabled?: boolean;
  error?: string;
}

/**
 * Select controlado de `precision_order`: las opciones y el helperText
 * enuncian la tolerancia del PRD § 5.4 en la unidad que corresponde al
 * instrumento (`kind`), de modo que el usuario entienda el impacto antes de
 * guardar el proceso.
 *
 * Vive en el sistema de diseño, junto a `equipment-fields.tsx`: lo consumen
 * poligonal, nivelación y asentamientos, así que no es de ningún módulo.
 *
 * Controlado (`value`/`onChange`) y no con estado propio: cada proceso trae un
 * orden por defecto (`tercer_orden`, el de la columna en la base) y quien lo
 * usa necesita leerlo en vivo, por ejemplo para el aviso de equipo
 * insuficiente.
 */
export function PrecisionOrderSelect({
  kind,
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
      options={OPTIONS[kind]}
      required={required}
      disabled={disabled}
      error={error}
      value={value}
      onChange={(e) => onChange(e.target.value as PrecisionOrder)}
      helperText={helperFor(kind, value)}
    />
  );
}
