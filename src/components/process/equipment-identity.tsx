"use client";

import { Input } from "@/components/design-system";

export interface EquipmentIdentityFields {
  brand: string;
  model: string;
  serial: string;
}

/**
 * El equipo de un proceso o de una visita: marca, modelo y n.º de serie, para
 * escribir. Hasta la Fase 44 la nivelación y la visita ofrecían además «Tomar
 * del catálogo»; el catálogo salió y las tres altas piden el equipo igual.
 */
export function EquipmentIdentity({
  value,
  onChange,
}: {
  value: EquipmentIdentityFields;
  onChange: (value: EquipmentIdentityFields) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <Input label="Marca" value={value.brand} onChange={(e) => onChange({ ...value, brand: e.target.value })} />
      <Input label="Modelo" value={value.model} onChange={(e) => onChange({ ...value, model: e.target.value })} />
      <Input
        label="N.º de serie"
        value={value.serial}
        onChange={(e) => onChange({ ...value, serial: e.target.value })}
      />
    </div>
  );
}
