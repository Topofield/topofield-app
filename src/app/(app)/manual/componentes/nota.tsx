import type { ReactNode } from "react";

/**
 * Bloque destacado del manual: los `>` del Markdown original.
 *
 * No usa `Alert` del sistema de diseño a propósito: `Alert` lleva
 * `role="alert"` siempre, que anuncia el contenido con prioridad al lector de
 * pantalla. Una nota informativa de un manual no es una alerta activa; usarla
 * aquí sería incorrecto semánticamente y ruidoso para quien navega con lector.
 */
export function Nota({
  titulo,
  children,
}: {
  titulo?: string;
  children: ReactNode;
}) {
  return (
    <aside className="rounded-md border-l-4 border-primary-500 bg-primary-50 px-4 py-3">
      {titulo && (
        <p className="text-sm font-semibold text-primary-700">{titulo}</p>
      )}
      <div className="text-sm text-neutral-900">{children}</div>
    </aside>
  );
}
