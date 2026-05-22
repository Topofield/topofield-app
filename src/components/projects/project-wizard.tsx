"use client";

import { useActionState, useRef, useState } from "react";
import {
  Alert,
  Button,
  Input,
  Select,
  Textarea,
} from "@/components/design-system";
import { cn } from "@/lib/utils/cn";
import { PRECISION_ORDER_OPTIONS } from "@/types/project";
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
  // Esa validación (required + rango min/max) cubre todo lo que el validador del
  // servidor revisa del paso 1, así que un error de servidor del paso 1 solo
  // ocurriría manipulando el DOM; no se navega de vuelta automáticamente.
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
            step === 1
              ? "font-semibold text-primary-600"
              : "text-neutral-500"
          }
        >
          1. Datos básicos
        </li>
        <li className="text-neutral-300">›</li>
        <li
          className={
            step === 2
              ? "font-semibold text-primary-600"
              : "text-neutral-500"
          }
        >
          2. Equipo y precisión
        </li>
      </ol>

      {state.error && <Alert variant="error">{state.error}</Alert>}

      {/* Paso 1 — siempre montado; oculto cuando no está activo, para que el
          FormData final recoja todos los campos. */}
      <div
        ref={step1Ref}
        className={cn("flex-col gap-4", step === 1 ? "flex" : "hidden")}
      >
        <Input
          label="Nombre del proyecto"
          name="name"
          required
          error={fieldErrors.name}
        />
        <Textarea label="Descripción" name="description" />
        <Input
          label="Cliente"
          name="client"
          required
          error={fieldErrors.client}
        />
        <Input
          label="Ubicación"
          name="location"
          required
          error={fieldErrors.location}
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
            error={fieldErrors.latitude}
          />
          <Input
            label="Longitud"
            name="longitude"
            type="number"
            step="any"
            min={-180}
            max={180}
            helperText="Opcional (grados decimales)."
            error={fieldErrors.longitude}
          />
        </div>
      </div>

      {/* Paso 2 */}
      <div className={cn("flex-col gap-4", step === 2 ? "flex" : "hidden")}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Datum"
            name="datum"
            defaultValue="MAGNA-SIRGAS"
            required
            error={fieldErrors.datum}
          />
          <Input label="Proyección" name="projection" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Marca del equipo"
            name="equipment_brand"
            required
            error={fieldErrors.equipment_brand}
          />
          <Input
            label="Modelo del equipo"
            name="equipment_model"
            required
            error={fieldErrors.equipment_model}
          />
        </div>
        <Input
          label="Serie del equipo"
          name="equipment_serial"
          required
          error={fieldErrors.equipment_serial}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Precisión angular (segundos)"
            name="angular_precision_seconds"
            type="number"
            step="0.1"
            min={0}
            required
            error={fieldErrors.angular_precision_seconds}
          />
          <Input
            label="Precisión lineal"
            name="linear_precision"
            placeholder="ej: 2+2ppm"
            required
            error={fieldErrors.linear_precision}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Fecha de calibración"
            name="equipment_calibration_date"
            type="date"
            required
            error={fieldErrors.equipment_calibration_date}
          />
          <Select
            label="Orden de precisión"
            name="precision_order"
            options={PRECISION_ORDER_OPTIONS}
            placeholder="Selecciona…"
            required
            error={fieldErrors.precision_order}
          />
        </div>
      </div>

      <div className="flex items-center justify-between gap-3">
        {step === 2 ? (
          <Button
            type="button"
            variant="secondary"
            onClick={() => setStep(1)}
          >
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
