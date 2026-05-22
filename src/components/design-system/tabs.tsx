import Link from "next/link";
import { cn } from "@/lib/utils/cn";

export interface TabItem {
  id: string;
  label: string;
}

interface TabsProps {
  items: TabItem[];
  activeId: string;
  /** Ruta base; cada tab enlaza a `${basePath}?tab=${id}`. */
  basePath: string;
}

/**
 * Barra de tabs basada en enlaces: cada tab navega a `?tab=<id>`, así el panel
 * activo lo decide el Server Component que lee el searchParam. Sin JS de cliente.
 */
export function Tabs({ items, activeId, basePath }: TabsProps) {
  return (
    <nav className="flex gap-1 border-b border-neutral-200">
      {items.map((item) => {
        const active = item.id === activeId;
        return (
          <Link
            key={item.id}
            href={`${basePath}?tab=${item.id}`}
            aria-current={active ? "page" : undefined}
            className={cn(
              "-mb-px border-b-2 px-4 py-2.5 text-sm font-medium transition-colors",
              active
                ? "border-primary-500 text-primary-600"
                : "border-transparent text-neutral-500 hover:text-neutral-800",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
