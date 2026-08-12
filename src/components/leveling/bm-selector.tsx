"use client";

// Selector de BM de partida/llegada para nivelación.
//
// Por qué existe: en nivelación, una cota de partida errónea desplaza TODAS
// las cotas calculadas del proceso por igual (es una traslación constante).
// El error de cierre compara el desnivel acumulado contra la cota de llegada
// conocida, y ese desnivel no cambia si la cota de partida se desplaza — así
// que el control de cierre sigue dando exacto aunque la cota de arranque esté
// mal transcrita. Es el único dato de entrada que ninguna validación
// posterior puede atrapar. Forzar la elección desde el catálogo de puntos de
// referencia del proyecto (en vez de digitarla a mano) elimina el error de
// transcripción en ese punto ciego.

import { useState } from "react";
import { Input, Select } from "@/components/design-system";
import type { ReferencePoint } from "@/types/project";

const OTHER_VALUE = "__other__";

export interface BmValue {
  code: string;
  elevation: string;
}

export const EMPTY_BM_VALUE: BmValue = { code: "", elevation: "" };

interface BmSelectorProps {
  label: string;
  points: ReferencePoint[];
  value: BmValue;
  onChange: (value: BmValue) => void;
  disabled?: boolean;
}

/**
 * Select de BM del catálogo del proyecto + opción "Otro (entrada libre)".
 * Al elegir un BM, código y cota se rellenan y quedan de solo lectura. Al
 * elegir "Otro", quedan editables y vacíos.
 */
export function BmSelector({
  label,
  points,
  value,
  onChange,
  disabled,
}: BmSelectorProps) {
  // Selección actual del <select>: id del punto elegido, o "otro"/vacío.
  const [selectedId, setSelectedId] = useState<string>("");

  const isOther = selectedId === OTHER_VALUE;
  const isFromCatalog = selectedId !== "" && !isOther;

  function handleSelect(id: string) {
    setSelectedId(id);
    if (id === OTHER_VALUE || id === "") {
      onChange(EMPTY_BM_VALUE);
      return;
    }
    const point = points.find((p) => p.id === id);
    if (!point) return;
    onChange({
      code: point.code,
      elevation: point.elevation != null ? String(point.elevation) : "",
    });
  }

  return (
    <fieldset className="flex flex-col gap-4 rounded-md border border-neutral-200 p-4">
      <legend className="px-1 text-sm font-medium text-neutral-800">
        {label}
      </legend>
      <Select
        label="BM"
        options={[
          ...points.map((p) => ({ value: p.id, label: p.code })),
          { value: OTHER_VALUE, label: "Otro (entrada libre)" },
        ]}
        placeholder="Selecciona un BM del catálogo…"
        value={selectedId}
        disabled={disabled}
        onChange={(e) => handleSelect(e.target.value)}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label="Código"
          value={value.code}
          readOnly={isFromCatalog}
          disabled={disabled || (!isOther && !isFromCatalog)}
          onChange={(e) => onChange({ ...value, code: e.target.value })}
        />
        <Input
          label="Cota"
          type="number"
          step="any"
          value={value.elevation}
          readOnly={isFromCatalog}
          disabled={disabled || (!isOther && !isFromCatalog)}
          onChange={(e) => onChange({ ...value, elevation: e.target.value })}
        />
      </div>
    </fieldset>
  );
}
