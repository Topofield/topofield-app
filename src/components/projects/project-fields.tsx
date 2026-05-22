import { Input, Select, Textarea } from "@/components/design-system";
import { PRECISION_ORDER_OPTIONS } from "@/types/project";

/** Valores por defecto de los campos de proyecto (todo string para los inputs). */
export interface ProjectFormValues {
  name?: string;
  description?: string;
  client?: string;
  location?: string;
  latitude?: string;
  longitude?: string;
  datum?: string;
  projection?: string;
  equipment_brand?: string;
  equipment_model?: string;
  equipment_serial?: string;
  angular_precision_seconds?: string;
  linear_precision?: string;
  equipment_calibration_date?: string;
  precision_order?: string;
}

interface FieldsProps {
  values?: ProjectFormValues;
  errors: Record<string, string>;
}

/** Campos de datos básicos del proyecto (paso 1 del wizard). */
export function BasicFields({ values, errors }: FieldsProps) {
  return (
    <>
      <Input
        label="Nombre del proyecto"
        name="name"
        required
        defaultValue={values?.name}
        error={errors.name}
      />
      <Textarea
        label="Descripción"
        name="description"
        defaultValue={values?.description}
      />
      <Input
        label="Cliente"
        name="client"
        required
        defaultValue={values?.client}
        error={errors.client}
      />
      <Input
        label="Ubicación"
        name="location"
        required
        defaultValue={values?.location}
        error={errors.location}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label="Latitud"
          name="latitude"
          type="number"
          step="any"
          min={-90}
          max={90}
          helperText="Opcional (grados decimales)."
          defaultValue={values?.latitude}
          error={errors.latitude}
        />
        <Input
          label="Longitud"
          name="longitude"
          type="number"
          step="any"
          min={-180}
          max={180}
          helperText="Opcional (grados decimales)."
          defaultValue={values?.longitude}
          error={errors.longitude}
        />
      </div>
    </>
  );
}

/** Campos de equipo y precisión (paso 2 del wizard). */
export function EquipmentFields({ values, errors }: FieldsProps) {
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label="Datum"
          name="datum"
          required
          defaultValue={values?.datum ?? "MAGNA-SIRGAS"}
          error={errors.datum}
        />
        <Input
          label="Proyección"
          name="projection"
          defaultValue={values?.projection}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label="Marca del equipo"
          name="equipment_brand"
          required
          defaultValue={values?.equipment_brand}
          error={errors.equipment_brand}
        />
        <Input
          label="Modelo del equipo"
          name="equipment_model"
          required
          defaultValue={values?.equipment_model}
          error={errors.equipment_model}
        />
      </div>
      <Input
        label="Serie del equipo"
        name="equipment_serial"
        required
        defaultValue={values?.equipment_serial}
        error={errors.equipment_serial}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label="Precisión angular (segundos)"
          name="angular_precision_seconds"
          type="number"
          step="0.1"
          min={0}
          required
          defaultValue={values?.angular_precision_seconds}
          error={errors.angular_precision_seconds}
        />
        <Input
          label="Precisión lineal"
          name="linear_precision"
          placeholder="ej: 2+2ppm"
          required
          defaultValue={values?.linear_precision}
          error={errors.linear_precision}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label="Fecha de calibración"
          name="equipment_calibration_date"
          type="date"
          required
          defaultValue={values?.equipment_calibration_date}
          error={errors.equipment_calibration_date}
        />
        <Select
          label="Orden de precisión"
          name="precision_order"
          options={PRECISION_ORDER_OPTIONS}
          placeholder="Selecciona…"
          required
          defaultValue={values?.precision_order}
          error={errors.precision_order}
        />
      </div>
    </>
  );
}
