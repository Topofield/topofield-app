import type { ReactNode } from "react";
import { Input } from "./input";
import { NumberInput } from "./number-input";
import { Select } from "./select";
import {
  LEVEL_TYPE_OPTIONS,
  type LevelFields,
  type LevelType,
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
  disabled?: boolean;
  /** Va tras la leyenda: el selector del catálogo (Fase 25). */
  header?: ReactNode;
  /** Va al final: guardar en el catálogo y el aviso de calibración (Fase 25). */
  footer?: ReactNode;
}

/**
 * Equipo de estación total (ISO 17123-3 y -4). Es trazabilidad: la Fase 31
 * quitó el aviso de si alcanza el orden, porque lo juzga el cierre.
 */
export function TotalStationFieldset({
  value,
  onChange,
  disabled,
  header,
  footer,
}: TotalStationFieldsetProps) {
  function set<K extends keyof TotalStationFields>(
    key: K,
    fieldValue: TotalStationFields[K],
  ) {
    onChange({ ...value, [key]: fieldValue });
  }

  return (
    <fieldset className="flex flex-col gap-4 rounded-md border border-rule p-4">
      <legend className="px-1 text-sm font-medium text-ink">
        Equipo: estación total
      </legend>
      {header}
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
      {footer}
    </fieldset>
  );
}

interface LevelFieldsetProps {
  value: LevelFields;
  onChange: (value: LevelFields) => void;
  disabled?: boolean;
  /** Va tras la leyenda: el selector del catálogo (Fase 25). */
  header?: ReactNode;
  /** Va al final: guardar en el catálogo y el aviso de calibración (Fase 25). */
  footer?: ReactNode;
}

/** Equipo de nivel (ISO 17123-2). Ver `TotalStationFieldset`. */
export function LevelFieldset({
  value,
  onChange,
  disabled,
  header,
  footer,
}: LevelFieldsetProps) {
  function set<K extends keyof LevelFields>(
    key: K,
    fieldValue: LevelFields[K],
  ) {
    onChange({ ...value, [key]: fieldValue });
  }

  return (
    <fieldset className="flex flex-col gap-4 rounded-md border border-rule p-4">
      <legend className="px-1 text-sm font-medium text-ink">
        Equipo: nivel
      </legend>
      {header}
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
      {footer}
    </fieldset>
  );
}
