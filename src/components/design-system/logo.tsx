import { cn } from "@/lib/utils/cn";

/** Isotipo: vértice geodésico — triángulo de control con su punto de estación. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className={cn("h-6 w-6", className)}
    >
      <path
        d="M12 3.5 21 20H3L12 3.5Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="14.5" r="2.25" fill="currentColor" />
    </svg>
  );
}

/**
 * Marca completa: isotipo y palabra.
 *
 * El tamaño de ambos deriva del contexto tipográfico: el isotipo se
 * dimensiona en `em` (4/3 em = 24px cuando el contenedor está en
 * `text-lg` = 18px, el tamaño por defecto), así que pasar una clase de
 * tamaño de texto (p. ej. `text-2xl`) en `className` escala isotipo y
 * palabra a la vez.
 *
 * El `className` se aplica solo al contenedor: isotipo y palabra derivan de
 * él su tamaño mediante `em`. La palabra hereda además su color.
 *
 * El isotipo conserva su propio color de marca (`primary-500`). Para
 * recolorearlo —por ejemplo sobre un fondo oscuro— se pasa la clase de
 * color a `markClassName`, que es el único punto que lo controla.
 */
export function Logo({
  className,
  markClassName,
}: {
  className?: string;
  markClassName?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 text-lg text-primary-700",
        className,
      )}
    >
      <LogoMark
        className={cn(
          "h-[calc(4/3*1em)] w-[calc(4/3*1em)] text-primary-500",
          markClassName,
        )}
      />
      <span className="font-display font-bold text-[1em] text-inherit">
        TopoField
      </span>
    </span>
  );
}
