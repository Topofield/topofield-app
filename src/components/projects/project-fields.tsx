import { Input, Textarea } from "@/components/design-system";

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

/**
 * Datum y proyección del proyecto (paso 2 del wizard).
 *
 * Desde la Fase 8 el equipo y la precisión ya no se capturan aquí: cada
 * proceso (poligonal, nivelación, asentamiento) los define por su cuenta. Por
 * eso el nombre ya no es `EquipmentFields`: no queda ni un campo de equipo.
 */
export function GeodeticFields({ values, errors }: FieldsProps) {
  return (
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
  );
}
