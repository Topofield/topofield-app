function Block({ className }: { className: string }) {
  return <div className={`animate-pulse rounded-lg bg-neutral-100 ${className}`} />;
}

export default function ProjectLoading() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-live="polite">
      <span className="sr-only">Cargando el proyecto…</span>
      <Block className="h-4 w-56" />
      <Block className="h-64" />
      <Block className="h-10 w-72" />
      <div className="grid gap-4 sm:grid-cols-2">
        <Block className="h-28" />
        <Block className="h-28" />
      </div>
    </div>
  );
}
