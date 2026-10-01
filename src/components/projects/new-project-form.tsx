"use client";

import { useActionState } from "react";
import { Alert, Button } from "@/components/design-system";
import { BasicFields, GeodeticFields } from "./project-fields";
import {
  createProjectAction,
  type CreateProjectState,
} from "@/app/(app)/projects/new/actions";

const INITIAL_STATE: CreateProjectState = {};

/**
 * Alta de un proyecto: los datos básicos y el sistema de referencia en un solo
 * formulario, como el de editar (Fase 27, PU11). Hasta entonces era un
 * asistente de dos pasos, y su botón «Siguiente» ocupaba el sitio de «Crear
 * proyecto»: React cambiaba el `type` del mismo `<button>` al avanzar, antes
 * de la acción por defecto del clic, y el formulario se enviaba sin mostrar
 * el paso 2. Con un solo formulario el navegador valida todo al enviar.
 */
export function NewProjectForm() {
  const [state, formAction, isPending] = useActionState(
    createProjectAction,
    INITIAL_STATE,
  );
  const errors = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {state.error && <Alert variant="error">{state.error}</Alert>}
      <BasicFields errors={errors} />
      <GeodeticFields errors={errors} />
      <div className="flex justify-end">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Creando…" : "Crear proyecto"}
        </Button>
      </div>
    </form>
  );
}
