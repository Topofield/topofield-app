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
 * El patrón canónico del filtro excluyente (§ 4.1): <Link> + aria-current.
 * Es local aquí (sin navegar de verdad) solo para poder mostrarlo aislado;
 * el filtro real cambia la URL, como en dashboard-filter.tsx.
 */
export function FiltroComparacion() {
  return (
    <div>
      <p className="mb-2 text-sm font-medium text-neutral-800">
        <code>&lt;Link&gt;</code> + <code>aria-current</code>
      </p>
      <p className="mb-3 max-w-2xl text-xs text-neutral-500">
        Como en <code>dashboard-filter.tsx</code> y ya también en el listado
        de procesos. El filtro es navegación: se puede abrir en pestaña
        nueva, compartir por URL y no exige{" "}
        <code>&quot;use client&quot;</code>. La alternativa descartada era{" "}
        <code>&lt;button&gt;</code> + <code>router.push</code>, que rompe
        ambas cosas; se reserva solo para controles que necesiten estado de
        cliente que un enlace no pueda expresar.
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
