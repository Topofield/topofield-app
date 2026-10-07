"use client";

import { useState, useTransition } from "react";
import { Button, Input, LevelFieldset, Select, TotalStationFieldset } from "@/components/design-system";
import { createEquipmentAction } from "@/app/(app)/equipos/actions";
import {
  equipmentInputFromLevel,
  equipmentInputFromTotalStation,
  equipmentLabel,
  levelFieldsOf,
  sameInstrument,
  totalStationFieldsOf,
} from "@/lib/equipment";
import { calibrationOverdue, type EquipmentInput } from "@/lib/validators/equipment";
import type { Equipment, EquipmentKind } from "@/types/equipment";
import type { LevelFields, TotalStationFields } from "@/types/project";
import { useEquipmentCatalog } from "./catalog-context";

interface PickerProps<F> {
  value: F;
  onChange: (value: F) => void;
  disabled?: boolean;
  /**
   * Fecha contra la que se juzga la calibración: la de la visita en
   * asentamientos. Sin ella, hoy (poligonal y nivelación no guardan fecha de
   * medición).
   */
  referenceDate?: string;
}

/** «Tomar del catálogo»: copia los datos de un equipo en los campos. */
function CatalogSelect({
  items,
  onPick,
}: {
  items: Equipment[];
  onPick: (item: Equipment) => void;
}) {
  if (items.length === 0) return null;
  return (
    <Select
      label="Tomar del catálogo"
      placeholder="Elegir un equipo…"
      options={items.map((item) => ({ value: item.id, label: equipmentLabel(item) }))}
      value=""
      onChange={(e) => {
        const item = items.find((i) => i.id === e.target.value);
        if (item) onPick(item);
      }}
    />
  );
}

/** Aviso de calibración y «Guardar en el catálogo». */
function CatalogFooter({
  input,
  items,
  calibrationDate,
  referenceDate,
  disabled,
}: {
  input: EquipmentInput;
  items: Equipment[];
  calibrationDate: string;
  referenceDate: string;
  disabled?: boolean;
}) {
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [isPending, startTransition] = useTransition();
  const overdue = calibrationOverdue(calibrationDate, referenceDate);
  const nameless = !input.brand && !input.model;
  const already = items.some((item) => sameInstrument(item, input));

  function save() {
    setMessage(null);
    startTransition(async () => {
      const response = await createEquipmentAction(input);
      setMessage(
        response.ok
          ? { ok: true, text: "Guardado en el catálogo." }
          : { ok: false, text: response.error ?? "No se pudo guardar el equipo." },
      );
    });
  }

  return (
    <>
      {overdue && (
        <p className="text-sm text-warning">
          Calibración de hace más de un año: conviene revisarla antes de medir.
        </p>
      )}
      {!disabled && (
        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={save}
            disabled={isPending || nameless || already}
            title={nameless ? "Indique la marca o el modelo." : undefined}
          >
            {already ? "Ya está en el catálogo" : isPending ? "Guardando…" : "Guardar en el catálogo"}
          </Button>
          {message && (
            <span className={message.ok ? "text-sm text-ink-2" : "text-sm text-danger"}>
              {message.text}
            </span>
          )}
        </div>
      )}
    </>
  );
}

function useItems(kind: EquipmentKind) {
  const { equipment, today } = useEquipmentCatalog();
  return { items: equipment.filter((e) => e.kind === kind), today };
}

/**
 * Equipo de estación total con el catálogo (Fase 25): el fieldset del sistema
 * de diseño, con el selector arriba y «Guardar en el catálogo» abajo. Elegir
 * un equipo copia sus valores, que siguen editables: el proceso guarda lo que
 * quede en los campos, nunca una referencia.
 */
export function TotalStationEquipment({
  value,
  onChange,
  disabled,
  referenceDate,
}: PickerProps<TotalStationFields>) {
  const { items, today } = useItems("total_station");
  return (
    <TotalStationFieldset
      value={value}
      onChange={onChange}
      disabled={disabled}
      header={
        disabled ? null : (
          <CatalogSelect items={items} onPick={(item) => onChange(totalStationFieldsOf(item))} />
        )
      }
      footer={
        <CatalogFooter
          input={equipmentInputFromTotalStation(value)}
          items={items}
          calibrationDate={value.equipmentCalibrationDate}
          referenceDate={referenceDate ?? today}
          disabled={disabled}
        />
      }
    />
  );
}

/** Marca, modelo y n.º de serie de una estación total. */
export interface TotalStationIdentityFields {
  brand: string;
  model: string;
  serial: string;
}

/**
 * Solo la identidad del equipo, con «Tomar del catálogo» del tipo (Fases 35 y
 * 36, decisión 2 y 3): es lo que piden el alta de la poligonal y la de la
 * nivelación. Las precisiones y la calibración no entran en ningún cálculo.
 */
export function EquipmentIdentity({
  kind,
  value,
  onChange,
}: {
  kind: "total_station" | "level";
  value: TotalStationIdentityFields;
  onChange: (value: TotalStationIdentityFields) => void;
}) {
  const { items } = useItems(kind);
  return (
    <div className="flex flex-col gap-3">
      <CatalogSelect
        items={items}
        onPick={(item) =>
          onChange({ brand: item.brand ?? "", model: item.model ?? "", serial: item.serial ?? "" })
        }
      />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Input
          label="Marca"
          value={value.brand}
          onChange={(e) => onChange({ ...value, brand: e.target.value })}
        />
        <Input
          label="Modelo"
          value={value.model}
          onChange={(e) => onChange({ ...value, model: e.target.value })}
        />
        <Input
          label="N.º de serie"
          value={value.serial}
          onChange={(e) => onChange({ ...value, serial: e.target.value })}
        />
      </div>
    </div>
  );
}

/** La identidad de la estación total: el alta de la poligonal (Fase 35). */
export function TotalStationIdentity(props: {
  value: TotalStationIdentityFields;
  onChange: (value: TotalStationIdentityFields) => void;
}) {
  return <EquipmentIdentity kind="total_station" {...props} />;
}

/** Equipo de nivel con el catálogo (Fase 25). Ver `TotalStationEquipment`. */
export function LevelEquipment({
  value,
  onChange,
  disabled,
  referenceDate,
}: PickerProps<LevelFields>) {
  const { items, today } = useItems("level");
  return (
    <LevelFieldset
      value={value}
      onChange={onChange}
      disabled={disabled}
      header={
        disabled ? null : <CatalogSelect items={items} onPick={(item) => onChange(levelFieldsOf(item))} />
      }
      footer={
        <CatalogFooter
          input={equipmentInputFromLevel(value)}
          items={items}
          calibrationDate={value.equipmentCalibrationDate}
          referenceDate={referenceDate ?? today}
          disabled={disabled}
        />
      }
    />
  );
}
