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
  /** Parámetros actuales, para no perderlos al cambiar de pestaña. */
  searchParams?: SearchParams;
}

/**
 * Forma de los `searchParams` de Next: un parámetro repetido en la URL
 * (`?estado=a&estado=b`) llega como arreglo, no como cadena.
 */
export type SearchParams = Record<string, string | string[] | undefined>;

/**
 * Destino de una pestaña, conservando los demás parámetros de la consulta.
 * Los parámetros repetidos se conservan como tales: colapsarlos en una sola
 * cadena cambiaría su significado.
 */
export function tabHref(
  basePath: string,
  tabId: string,
  searchParams?: SearchParams,
): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams ?? {})) {
    if (key === "tab" || value == null) continue;
    for (const v of Array.isArray(value) ? value : [value]) {
      if (v !== "") params.append(key, v);
    }
  }
  params.set("tab", tabId);
  return `${basePath}?${params.toString()}`;
}

/**
 * Barra de tabs basada en enlaces: cada tab navega a `?tab=<id>`, así el panel
 * activo lo decide el Server Component que lee el searchParam. Sin JS de cliente.
 */
export function Tabs({ items, activeId, basePath, searchParams }: TabsProps) {
  return (
    <nav className="flex gap-1 border-b border-neutral-200">
      {items.map((item) => {
        const active = item.id === activeId;
        return (
          <Link
            key={item.id}
            href={tabHref(basePath, item.id, searchParams)}
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
