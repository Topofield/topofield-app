import type { ReactNode } from "react";

interface ActionBarProps {
  /** Estado a la izquierda: «Cambios sin guardar», un aviso breve. */
  status?: ReactNode;
  /** Las acciones, a la derecha. */
  children: ReactNode;
}

/**
 * Barra de acciones fija al pie de la pantalla (Fase 22). Guardar y Cerrar
 * quedaban al final de páginas de más de 3000 px: la barra los deja siempre a
 * la vista mientras se captura. Va como último hijo del contenedor de la
 * página: `sticky` la mantiene pegada al borde inferior mientras ese
 * contenedor esté en pantalla. No se imprime.
 */
export function ActionBar({ status, children }: ActionBarProps) {
  return (
    <div className="sticky bottom-0 z-20 -mx-4 border-t border-rule bg-card px-4 py-3 shadow-sm print:hidden sm:mx-0 sm:rounded-t-lg sm:border-x">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-h-5 text-sm text-ink-2" role="status" aria-live="polite">
          {status}
        </div>
        <div className="flex flex-wrap items-center gap-2">{children}</div>
      </div>
    </div>
  );
}
