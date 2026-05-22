"use client";

import { useActionState, useRef, useState } from "react";
import { Alert, Button } from "@/components/design-system";
import { cn } from "@/lib/utils/cn";
import { BasicFields, EquipmentFields } from "./project-fields";
import {
  createProjectAction,
  type CreateProjectState,
} from "@/app/(app)/projects/new/actions";

const INITIAL_STATE: CreateProjectState = {};

export function ProjectWizard() {
  const [state, formAction, isPending] = useActionState(
    createProjectAction,
    INITIAL_STATE,
  );
  const [step, setStep] = useState<1 | 2>(1);
  const step1Ref = useRef<HTMLDivElement>(null);
  const fieldErrors = state.fieldErrors ?? {};

  // "Siguiente": valida nativamente solo los campos del paso 1 antes de avanzar.
  // Esa validación (required + rango min/max) cubre lo que el validador del
  // servidor revisa del paso 1, así que un error de servidor del paso 1 solo
  // ocurriría manipulando el DOM.
  function goToStep2() {
    const controls = step1Ref.current?.querySelectorAll<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >("input, select, textarea");
    if (controls) {
      for (const control of controls) {
        if (!control.checkValidity()) {
          control.reportValidity();
          return;
        }
      }
    }
    setStep(2);
  }

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <ol className="flex items-center gap-2 text-sm">
        <li
          className={
            step === 1 ? "font-semibold text-primary-600" : "text-neutral-500"
          }
        >
          1. Datos básicos
        </li>
        <li className="text-neutral-300">›</li>
        <li
          className={
            step === 2 ? "font-semibold text-primary-600" : "text-neutral-500"
          }
        >
          2. Equipo y precisión
        </li>
      </ol>

      {state.error && <Alert variant="error">{state.error}</Alert>}

      {/* Ambos pasos siempre montados; el inactivo se oculta con CSS para que el
          FormData final recoja todos los campos. */}
      <div
        ref={step1Ref}
        className={cn("flex-col gap-4", step === 1 ? "flex" : "hidden")}
      >
        <BasicFields errors={fieldErrors} />
      </div>
      <div className={cn("flex-col gap-4", step === 2 ? "flex" : "hidden")}>
        <EquipmentFields errors={fieldErrors} />
      </div>

      <div className="flex items-center justify-between gap-3">
        {step === 2 ? (
          <Button type="button" variant="secondary" onClick={() => setStep(1)}>
            Atrás
          </Button>
        ) : (
          <span />
        )}
        {step === 1 ? (
          <Button type="button" onClick={goToStep2}>
            Siguiente
          </Button>
        ) : (
          <Button type="submit" disabled={isPending}>
            {isPending ? "Creando…" : "Crear proyecto"}
          </Button>
        )}
      </div>
    </form>
  );
}
