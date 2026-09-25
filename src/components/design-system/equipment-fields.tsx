import { Input } from "./input";
import { NumberInput } from "./number-input";
import { Select } from "./select";
import {
  ANGULAR_TOLERANCE_K,
  LEVELING_TOLERANCE_K,
  levelMeetsOrder,
  totalStationMeetsOrder,
} from "@/lib/calculations/tolerances";
import { parseNumber } from "@/lib/utils/parse";
import {
  LEVEL_TYPE_OPTIONS,
  PRECISION_ORDER_LABELS,
  type LevelFields,
  type LevelType,
  type PrecisionOrder,
  type TotalStationFields,
} from "@/types/project";

/**
 * Datos de equipo y precisión compartidos por poligonal, nivelación y
 * asentamientos: un archivo con los dos fieldsets, porque los tres módulos
 * los consumen y duplicarlos garantizaría que se desincronicen.
 *
 * Ambos son controlados (`value`/`onChange`), como el resto de los campos de
 * proceso: el estado vive en el formulario que los usa, no aquí.
 */

interface TotalStationFieldsetProps {
  value: TotalStationFields;
  onChange: (value: TotalStationFields) => void;
  /** Orden de precisión declarado del proceso, para el aviso de suficiencia. */
  order: PrecisionOrder;
  disabled?: boolean;
}

/** Equipo de estación total (ISO 17123-3 y -4), con aviso si no alcanza el orden. */
export function TotalStationFieldset({
  value,
  onChange,
  order,
  disabled,
}: TotalStationFieldsetProps) {
  function set<K extends keyof TotalStationFields>(
    key: K,
    fieldValue: TotalStationFields[K],
  ) {
    onChange({ ...value, [key]: fieldValue });
  }

  const angularPrecisionSeconds =
    parseNumber(value.angularPrecisionSeconds) ?? Number.NaN;
  const meetsOrder = totalStationMeetsOrder(order, angularPrecisionSeconds);

  return (
    <fieldset className="flex flex-col gap-4 rounded-md border border-rule p-4">
      <legend className="px-1 text-sm font-medium text-ink">
        Equipo: estación total
      </legend>
      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label="Marca"
          value={value.equipmentBrand}
          disabled={disabled}
          onChange={(e) => set("equipmentBrand", e.target.value)}
        />
        <Input
          label="Modelo"
          value={value.equipmentModel}
          disabled={disabled}
          onChange={(e) => set("equipmentModel", e.target.value)}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label="Número de serie"
          value={value.equipmentSerial}
          disabled={disabled}
          onChange={(e) => set("equipmentSerial", e.target.value)}
        />
        <Input
          label="Fecha de calibración"
          type="date"
          value={value.equipmentCalibrationDate}
          disabled={disabled}
          onChange={(e) => set("equipmentCalibrationDate", e.target.value)}
        />
      </div>

      <NumberInput
        label="Precisión angular (″)"
        value={value.angularPrecisionSeconds}
        disabled={disabled}
        onChange={(e) => set("angularPrecisionSeconds", e.target.value)}
        helperText="ISO 17123-3."
      />
      {!meetsOrder && (
        <p className="text-sm text-warning">
          Una precisión de {value.angularPrecisionSeconds}″ no alcanza para{" "}
          {PRECISION_ORDER_LABELS[order].toLowerCase()}, cuya tolerancia parte
          de {ANGULAR_TOLERANCE_K[order]}″. Puede capturar igual: es un aviso,
          no un bloqueo.
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <NumberInput
          label="Precisión de distancia — término constante (mm)"
          value={value.distancePrecisionMm}
          disabled={disabled}
          onChange={(e) => set("distancePrecisionMm", e.target.value)}
        />
        <NumberInput
          label="Precisión de distancia — término proporcional (ppm)"
          value={value.distancePrecisionPpm}
          disabled={disabled}
          onChange={(e) => set("distancePrecisionPpm", e.target.value)}
          helperText="ISO 17123-4: ±(constante + proporcional)."
        />
      </div>
    </fieldset>
  );
}

interface LevelFieldsetProps {
  value: LevelFields;
  onChange: (value: LevelFields) => void;
  /** Orden de precisión declarado del proceso, para el aviso de suficiencia. */
  order: PrecisionOrder;
  disabled?: boolean;
}

/** Equipo de nivel (ISO 17123-2), con aviso si no alcanza el orden. */
export function LevelFieldset({
  value,
  onChange,
  order,
  disabled,
}: LevelFieldsetProps) {
  function set<K extends keyof LevelFields>(
    key: K,
    fieldValue: LevelFields[K],
  ) {
    onChange({ ...value, [key]: fieldValue });
  }

  const kmPrecisionMm = parseNumber(value.kmPrecisionMm) ?? Number.NaN;
  const meetsOrder = levelMeetsOrder(order, kmPrecisionMm);

  return (
    <fieldset className="flex flex-col gap-4 rounded-md border border-rule p-4">
      <legend className="px-1 text-sm font-medium text-ink">
        Equipo: nivel
      </legend>
      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label="Marca"
          value={value.equipmentBrand}
          disabled={disabled}
          onChange={(e) => set("equipmentBrand", e.target.value)}
        />
        <Input
          label="Modelo"
          value={value.equipmentModel}
          disabled={disabled}
          onChange={(e) => set("equipmentModel", e.target.value)}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label="Número de serie"
          value={value.equipmentSerial}
          disabled={disabled}
          onChange={(e) => set("equipmentSerial", e.target.value)}
        />
        <Input
          label="Fecha de calibración"
          type="date"
          value={value.equipmentCalibrationDate}
          disabled={disabled}
          onChange={(e) => set("equipmentCalibrationDate", e.target.value)}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Select
          label="Tipo de nivel"
          options={[{ value: "", label: "Elegir…" }, ...LEVEL_TYPE_OPTIONS]}
          value={value.levelType}
          disabled={disabled}
          onChange={(e) => set("levelType", e.target.value as LevelType | "")}
        />
        <NumberInput
          label="Desviación típica (mm/km, doble nivelación)"
          value={value.kmPrecisionMm}
          disabled={disabled}
          onChange={(e) => set("kmPrecisionMm", e.target.value)}
          helperText="ISO 17123-2."
        />
      </div>
      {!meetsOrder && (
        <p className="text-sm text-warning">
          Una precisión de {value.kmPrecisionMm} mm/km no alcanza para{" "}
          {PRECISION_ORDER_LABELS[order].toLowerCase()}, cuya tolerancia parte
          de {LEVELING_TOLERANCE_K[order]} mm/km. Puede capturar igual: es un
          aviso, no un bloqueo.
        </p>
      )}
    </fieldset>
  );
}
