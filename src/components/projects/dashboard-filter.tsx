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
    <div className="inline-flex rounded-md border border-rule bg-card p-0.5">
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
                ? "bg-mira text-on-mira"
                : "text-ink-2 hover:text-ink",
            )}
          >
            {option.label}
          </Link>
        );
      })}
    </div>
  );
}
