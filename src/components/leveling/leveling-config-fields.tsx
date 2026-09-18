import { Input, LevelFieldset, Select } from "@/components/design-system";
import { PrecisionOrderSelect } from "@/components/projects/precision-order-select";
import {
  EMPTY_LEVEL,
  type LevelFields,
  type PrecisionOrder,
} from "@/types/project";
import {
  LEVELING_TYPE_LABELS,
  LEVELING_TYPES,
  type LevelingType,
} from "@/types/leveling";
import { BmSelector, EMPTY_BM_VALUE, type BmValue } from "./bm-selector";
import type { ReferencePoint } from "@/types/project";

const LEVELING_TYPE_OPTIONS = LEVELING_TYPES.map((value) => ({
  value,
  label: LEVELING_TYPE_LABELS[value],
}));

/** Estado de UI de la configuración de un proceso de nivelación (todo texto). */
export interface LevelingConfigState {
  name: string;
  type: LevelingType;
  startBm: BmValue;
  endBm: BmValue;
  hasReturnRun: boolean;
  /** Orden de precisión del proceso (ISO 17123-2 para el equipo). */
  precisionOrder: PrecisionOrder;
  level: LevelFields;
}

export const EMPTY_LEVELING_CONFIG: LevelingConfigState = {
  name: "",
  type: "closed",
  startBm: EMPTY_BM_VALUE,
  endBm: EMPTY_BM_VALUE,
  hasReturnRun: false,
  // Mismo valor por defecto que la columna en la base (§ Task 2).
  precisionOrder: "tercer_orden",
  level: EMPTY_LEVEL,
};

interface LevelingConfigFieldsProps {
  value: LevelingConfigState;
  onChange: (value: LevelingConfigState) => void;
  points: ReferencePoint[];
  disabled?: boolean;
}

/** Campos de configuración del proceso de nivelación, compartidos por /new. */
export function LevelingConfigFields({
  value,
  onChange,
  points,
  disabled,
}: LevelingConfigFieldsProps) {
  function set<K extends keyof LevelingConfigState>(
    key: K,
    fieldValue: LevelingConfigState[K],
  ) {
    onChange({ ...value, [key]: fieldValue });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label="Nombre del proceso"
          value={value.name}
          disabled={disabled}
          onChange={(e) => set("name", e.target.value)}
        />
        <Select
          label="Tipo de nivelación"
          options={LEVELING_TYPE_OPTIONS}
          value={value.type}
          disabled={disabled}
          onChange={(e) => {
            const nextType = e.target.value as LevelingType;
            // Al salir de "link" el BmSelector de llegada se desmonta, pero
            // su valor vive en este padre y no se limpia solo. Si se vuelve
            // a "link" después, el selector remonta con selectedId vacío
            // (muestra "Selecciona…") mientras los inputs seguirían
            // arrastrando el BM viejo del padre — un dato invisible en el
            // <select> que igual se guardaría al enviar. Se resetea aquí,
            // en el mismo evento que cambia el tipo, para que nunca exista
            // un estado intermedio con endBm rancio.
            onChange({
              ...value,
              type: nextType,
              endBm: nextType === "link" ? value.endBm : EMPTY_BM_VALUE,
            });
          }}
        />
      </div>

      <PrecisionOrderSelect
        value={value.precisionOrder}
        disabled={disabled}
        onChange={(v) => set("precisionOrder", v)}
      />
      <LevelFieldset
        value={value.level}
        onChange={(v) => set("level", v)}
        order={value.precisionOrder}
        disabled={disabled}
      />

      <BmSelector
        label="BM de partida"
        points={points}
        value={value.startBm}
        disabled={disabled}
        onChange={(v) => set("startBm", v)}
      />

      {value.type === "link" && (
        <BmSelector
          label="BM de llegada"
          points={points}
          value={value.endBm}
          disabled={disabled}
          onChange={(v) => set("endBm", v)}
        />
      )}

      <label className="flex items-center gap-2 text-sm text-neutral-800">
        <input
          type="checkbox"
          checked={value.hasReturnRun}
          disabled={disabled}
          onChange={(e) => set("hasReturnRun", e.target.checked)}
          className="h-4 w-4 rounded border-neutral-400"
        />
        Incluye recorrido de vuelta (ida y vuelta)
      </label>
    </div>
  );
}
