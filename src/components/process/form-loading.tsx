import { Skeleton } from "@/components/design-system";

/**
 * Esqueleto de una pantalla de alta (Fase 24): título y la tarjeta del
 * formulario con sus campos. Sin las migas, que desde la Fase 33 van en la
 * barra. Antes las altas dentro de un proyecto mostraban
 * el esqueleto del hub, el `loading.tsx` más cercano, y «Nuevo proyecto» el
 * del dashboard o ninguno.
 */
export function FormLoading({ label }: { label: string }) {
  return (
    <div className="flex flex-col gap-6" role="status" aria-busy="true">
      <span className="sr-only">{label}</span>
      <Skeleton className="h-8 w-72" />
      <div className="flex flex-col gap-4 rounded-lg border border-rule bg-card p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
        </div>
        <Skeleton className="h-24" />
        <Skeleton className="h-10 w-40 self-end" />
      </div>
    </div>
  );
}
