"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  Button,
  DmsInput,
  EMPTY_DMS,
  Modal,
  type DmsValue,
} from "@/components/design-system";
import { cn } from "@/lib/utils/cn";

/** Demostración de `Modal`, que necesita estado de apertura. */
export function ModalDemo() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        Abrir modal
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Cerrar proceso"
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={() => setOpen(false)}>Confirmar cierre</Button>
          </>
        }
      >
        <p className="text-sm text-neutral-800">
          Un proceso cerrado es inmutable. Esta acción no se puede deshacer.
        </p>
      </Modal>
    </>
  );
}

/** Demostración de `DmsInput`, que es controlado. */
export function DmsInputDemo() {
  const [value, setValue] = useState<DmsValue>({
    deg: "45",
    min: "30",
    sec: "12.5",
  });
  return (
    <div className="flex flex-wrap items-start gap-6">
      <DmsInput label="Ángulo interno" value={value} onChange={setValue} />
      <DmsInput
        label="Con error"
        value={EMPTY_DMS}
        onChange={() => {}}
        error="Los minutos deben estar entre 0 y 59."
      />
      <DmsInput
        label="Deshabilitado"
        value={{ deg: "90", min: "0", sec: "0" }}
        onChange={() => {}}
        disabled
      />
    </div>
  );
}

const ESTADOS = [
  { value: "todos", label: "Todos" },
  { value: "borradores", label: "Borradores" },
  { value: "cerrados", label: "Cerrados" },
] as const;

/**
 * Las dos convenciones que hoy conviven para el filtro excluyente, una al lado
 * de la otra. Ambas son locales aquí (sin navegar) para poder compararlas;
 * las reales cambian la URL.
 */
export function FiltroComparacion() {
  const [conBoton, setConBoton] = useState<string>("todos");

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <div>
        <p className="mb-2 text-sm font-medium text-neutral-800">
          A · <code>&lt;Link&gt;</code> + <code>aria-current</code>
        </p>
        <p className="mb-3 text-xs text-neutral-500">
          Como <code>dashboard-filter.tsx</code>. El filtro es navegación: se
          puede abrir en pestaña nueva y compartir. Sin JS de cliente.
        </p>
        <div className="inline-flex rounded-md border border-neutral-200 bg-white p-0.5">
          {ESTADOS.map((opcion) => {
            const activo = opcion.value === "todos";
            return (
              <Link
                key={opcion.value}
                href="/design-system#patrones"
                aria-current={activo ? "true" : undefined}
                className={cn(
                  "rounded px-3 py-1.5 text-sm font-medium transition-colors",
                  activo
                    ? "bg-primary-500 text-white"
                    : "text-neutral-500 hover:text-neutral-800",
                )}
              >
                {opcion.label}
              </Link>
            );
          })}
        </div>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium text-neutral-800">
          B · <code>&lt;button&gt;</code> + <code>router.push</code>
        </p>
        <p className="mb-3 text-xs text-neutral-500">
          Como <code>process-list-toolbar.tsx</code>. Exige{" "}
          <code>&quot;use client&quot;</code> y no se puede abrir en pestaña
          nueva ni compartir con el filtro puesto.
        </p>
        <div
          className="flex flex-wrap gap-1.5"
          role="group"
          aria-label="Filtrar por estado"
        >
          {ESTADOS.map((opcion) => {
            const activo = opcion.value === conBoton;
            return (
              <button
                key={opcion.value}
                type="button"
                aria-current={activo ? "true" : undefined}
                onClick={() => setConBoton(opcion.value)}
                className={cn(
                  "rounded-full border px-3 py-1 text-sm transition-colors",
                  activo
                    ? "border-primary-500 bg-primary-500 text-white"
                    : "border-neutral-200 bg-white text-neutral-500 hover:text-neutral-800",
                )}
              >
                {opcion.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/**
 * Estado de carga propuesto (§ 4.3): el control se deshabilita y cambia su
 * texto. El cambio de texto lo anuncia el lector de pantalla; un spinner
 * decorativo no.
 */
export function EstadoCargaDemo() {
  const [pending, startTransition] = useTransition();

  function simular() {
    startTransition(
      () =>
        new Promise<void>((resolve) => {
          setTimeout(resolve, 1600);
        }),
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-4">
      <Button onClick={simular} disabled={pending}>
        {pending ? "Guardando…" : "Guardar proceso"}
      </Button>
      <p className="text-xs text-neutral-500">
        Pulse para ver la transición. El ancho no salta porque ambos textos
        ocupan un espacio parecido; cuando no sea así, se fija con{" "}
        <code>min-w-*</code>.
      </p>
    </div>
  );
}
