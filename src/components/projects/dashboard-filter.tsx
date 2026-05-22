import Link from "next/link";
import { cn } from "@/lib/utils/cn";
import { type ProjectStatus } from "@/types/project";

const OPTIONS: { value: ProjectStatus; label: string }[] = [
  { value: "active", label: "Activos" },
  { value: "archived", label: "Archivados" },
];

/** Filtro activo/archivado del dashboard. Basado en enlaces a `?status=`. */
export function DashboardFilter({
  activeStatus,
}: {
  activeStatus: ProjectStatus;
}) {
  return (
    <div className="inline-flex rounded-md border border-neutral-200 bg-white p-0.5">
      {OPTIONS.map((option) => {
        const active = option.value === activeStatus;
        return (
          <Link
            key={option.value}
            href={`/dashboard?status=${option.value}`}
            aria-current={active ? "true" : undefined}
            className={cn(
              "rounded px-3 py-1.5 text-sm font-medium transition-colors",
              active
                ? "bg-primary-500 text-white"
                : "text-neutral-500 hover:text-neutral-800",
            )}
          >
            {option.label}
          </Link>
        );
      })}
    </div>
  );
}
