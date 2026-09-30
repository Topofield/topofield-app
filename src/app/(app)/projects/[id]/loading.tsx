import { Skeleton } from "@/components/design-system";

export default function ProjectLoading() {
  return (
    <div className="flex flex-col gap-6" role="status" aria-busy="true">
      <span className="sr-only">Cargando el proyecto…</span>
      <Skeleton className="h-4 w-56" />
      <Skeleton className="h-64" />
      <Skeleton className="h-10 w-72" />
      <div className="grid gap-4 sm:grid-cols-2">
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
      </div>
    </div>
  );
}
