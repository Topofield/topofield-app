import { cn } from "@/lib/utils/cn";

/**
 * Bloque de carga para los `loading.tsx`. Sustituye al `Block` que cada
 * archivo de carga declaraba por su cuenta. Es decorativo: el `role="status"`
 * y el texto para lectores de pantalla los pone la página de carga.
 */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn("animate-pulse rounded-lg bg-sel", className)} />;
}
