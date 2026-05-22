"use client";

import { useActionState } from "react";
import { Alert, Button } from "@/components/design-system";
import {
  BasicFields,
  EquipmentFields,
  type ProjectFormValues,
} from "./project-fields";
import {
  updateProjectAction,
  type FormState,
} from "@/app/(app)/projects/[id]/actions";
import type { Project } from "@/types/project";

const INITIAL_STATE: FormState = {};

function toFormValues(project: Project): ProjectFormValues {
  return {
    name: project.name,
    description: project.description ?? "",
    client: project.client,
    location: project.location,
    latitude: project.latitude?.toString() ?? "",
    longitude: project.longitude?.toString() ?? "",
    datum: project.datum,
    projection: project.projection ?? "",
    equipment_brand: project.equipment_brand,
    equipment_model: project.equipment_model,
    equipment_serial: project.equipment_serial,
    angular_precision_seconds: project.angular_precision_seconds.toString(),
    linear_precision: project.linear_precision,
    equipment_calibration_date: project.equipment_calibration_date,
    precision_order: project.precision_order,
  };
}

export function ProjectEditForm({ project }: { project: Project }) {
  const [state, formAction, isPending] = useActionState(
    updateProjectAction,
    INITIAL_STATE,
  );
  const errors = state.fieldErrors ?? {};
  const values = toFormValues(project);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="project_id" value={project.id} />
      {state.error && <Alert variant="error">{state.error}</Alert>}
      {state.ok && <Alert variant="success">Cambios guardados.</Alert>}
      <BasicFields values={values} errors={errors} />
      <EquipmentFields values={values} errors={errors} />
      <div className="flex justify-end">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Guardando…" : "Guardar cambios"}
        </Button>
      </div>
    </form>
  );
}
