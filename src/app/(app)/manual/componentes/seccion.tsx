import type { ReactNode } from "react";

/**
 * Sección del manual con su ancla.
 *
 * `scroll-mt-6` deja aire sobre el título al llegar desde el índice, para que
 * no quede pegado al borde superior de la ventana.
 */
export function Seccion({
  id,
  titulo,
  children,
}: {
  id: string;
  titulo: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="mb-14 scroll-mt-6">
      <h2 className="border-b border-neutral-200 pb-2 text-2xl font-bold">
        {titulo}
      </h2>
      <div className="mt-6 flex flex-col gap-4">{children}</div>
    </section>
  );
}

/** Vuelve al índice. Útil tras una captura larga, sobre todo en el teléfono. */
export function VolverArriba() {
  return (
    <p className="mt-2">
      <a
        href="#indice"
        className="text-sm font-medium text-primary-600 hover:text-primary-700"
      >
        ↑ Volver al índice
      </a>
    </p>
  );
}
