import {
  DmsInput,
  EMPTY_DMS,
  Input,
  Select,
  type DmsValue,
} from "@/components/design-system";
import { POLYGONAL_TYPE_OPTIONS, type PolygonalType } from "@/types/polygonal";

/** Estado de UI de la configuración de un proceso poligonal (todo texto). */
export interface PolygonalConfigState {
  name: string;
  type: PolygonalType;
  startPointCode: string;
  startNorth: string;
  startEast: string;
  startAzimuth: DmsValue;
  endPointCode: string;
  endNorth: string;
  endEast: string;
  endAzimuth: DmsValue;
}

export const EMPTY_POLYGONAL_CONFIG: PolygonalConfigState = {
  name: "",
  type: "closed",
  startPointCode: "",
  startNorth: "1000",
  startEast: "1000",
  startAzimuth: EMPTY_DMS,
  endPointCode: "",
  endNorth: "",
  endEast: "",
  endAzimuth: EMPTY_DMS,
};

interface PolygonalConfigFieldsProps {
  value: PolygonalConfigState;
  onChange: (value: PolygonalConfigState) => void;
  disabled?: boolean;
}

/** Campos de configuración del proceso, compartidos por /new y el editor. */
export function PolygonalConfigFields({
  value,
  onChange,
  disabled,
}: PolygonalConfigFieldsProps) {
  function set<K extends keyof PolygonalConfigState>(
    key: K,
    fieldValue: PolygonalConfigState[K],
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
          label="Tipo de poligonal"
          options={POLYGONAL_TYPE_OPTIONS}
          value={value.type}
          disabled={disabled}
          onChange={(e) => set("type", e.target.value as PolygonalType)}
        />
      </div>

      <fieldset className="flex flex-col gap-4 rounded-md border border-neutral-200 p-4">
        <legend className="px-1 text-sm font-medium text-neutral-800">
          Punto de partida
        </legend>
        <div className="grid gap-4 sm:grid-cols-3">
          <Input
            label="Código"
            value={value.startPointCode}
            disabled={disabled}
            onChange={(e) => set("startPointCode", e.target.value)}
          />
          <Input
            label="Norte"
            type="number"
            step="any"
            value={value.startNorth}
            disabled={disabled}
            onChange={(e) => set("startNorth", e.target.value)}
          />
          <Input
            label="Este"
            type="number"
            step="any"
            value={value.startEast}
            disabled={disabled}
            onChange={(e) => set("startEast", e.target.value)}
          />
        </div>
        <DmsInput
          label="Azimut de partida"
          value={value.startAzimuth}
          disabled={disabled}
          onChange={(v) => set("startAzimuth", v)}
        />
      </fieldset>

      {value.type === "open_controlled" && (
        <fieldset className="flex flex-col gap-4 rounded-md border border-neutral-200 p-4">
          <legend className="px-1 text-sm font-medium text-neutral-800">
            Punto de llegada conocido
          </legend>
          <div className="grid gap-4 sm:grid-cols-3">
            <Input
              label="Código"
              value={value.endPointCode}
              disabled={disabled}
              onChange={(e) => set("endPointCode", e.target.value)}
            />
            <Input
              label="Norte"
              type="number"
              step="any"
              value={value.endNorth}
              disabled={disabled}
              onChange={(e) => set("endNorth", e.target.value)}
            />
            <Input
              label="Este"
              type="number"
              step="any"
              value={value.endEast}
              disabled={disabled}
              onChange={(e) => set("endEast", e.target.value)}
            />
          </div>
          <DmsInput
            label="Azimut de llegada"
            value={value.endAzimuth}
            disabled={disabled}
            onChange={(v) => set("endAzimuth", v)}
          />
        </fieldset>
      )}
    </div>
  );
}
