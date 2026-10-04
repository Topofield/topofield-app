import { Skeleton } from "@/components/design-system";

export default function Loading() {
  return (
    <div className="flex flex-col gap-6" role="status" aria-busy="true">
      <span className="sr-only">Cargando el catálogo de equipos…</span>
      <Skeleton className="h-8 w-40" />
      <Skeleton className="h-40" />
      <Skeleton className="h-40" />
    </div>
  );
}
