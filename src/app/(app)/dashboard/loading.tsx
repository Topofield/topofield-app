function Block({ className }: { className: string }) {
  return <div className={`animate-pulse rounded-lg bg-neutral-100 ${className}`} />;
}

export default function DashboardLoading() {
  return (
    <div className="flex flex-col gap-8" role="status" aria-busy="true">
      <span className="sr-only">Cargando el dashboard…</span>
      <div className="flex items-center justify-between gap-4">
        <Block className="h-8 w-40" />
        <Block className="h-10 w-36" />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Block className="h-28" />
        <Block className="h-28" />
        <Block className="h-28" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Block className="h-32" />
        <Block className="h-32" />
      </div>
    </div>
  );
}
