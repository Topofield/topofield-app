import { Skeleton } from "@/components/design-system";

/**
 * Esqueleto de la pantalla de un proceso (Fase 22): migas, cabecera,
 * pestañas y el veredicto con las primeras tarjetas. Antes los editores
 * mostraban mientras cargaban el esqueleto del hub del proyecto, que era el
 * `loading.tsx` más cercano.
 */
export function ProcessLoading({ label }: { label: string }) {
  return (
    <div className="flex flex-col gap-6" role="status" aria-busy="true">
      <span className="sr-only">{label}</span>
      <Skeleton className="h-4 w-72" />
      <div className="flex items-end justify-between gap-4 border-b-2 border-rule pb-4">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-8 w-80" />
          <Skeleton className="h-4 w-56" />
        </div>
        <Skeleton className="h-9 w-64" />
      </div>
      <Skeleton className="h-10 w-56" />
      <Skeleton className="h-28" />
      <Skeleton className="h-64" />
    </div>
  );
}
