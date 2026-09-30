import { Skeleton } from "@/components/design-system";

export default function DashboardLoading() {
  return (
    <div className="flex flex-col gap-8" role="status" aria-busy="true">
      <span className="sr-only">Cargando el dashboard…</span>
      <div className="flex items-center justify-between gap-4">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-10 w-36" />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Skeleton className="h-32" />
        <Skeleton className="h-32" />
      </div>
    </div>
  );
}
