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
 * El color por defecto se mantiene (isotipo en `primary-500`, palabra en
 * `primary-700`). El mismo `className` recibido se reenvía tanto al
 * contenedor como al isotipo: si el consumidor pasa una clase de color
 * de Tailwind (p. ej. `text-white` para un fondo oscuro), `twMerge`
 * sustituye el color por defecto en ambos a la vez. La palabra hereda
 * el color del contenedor con `text-inherit`, así que sigue el mismo
 * override sin necesidad de reenviar la clase también a ella.
 */
export function Logo({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 text-lg text-primary-700",
        className
      )}
    >
      <LogoMark
        className={cn(
          "h-[calc(4/3*1em)] w-[calc(4/3*1em)] text-primary-500",
          className
        )}
      />
      <span className="font-display font-bold text-[1em] text-inherit">
        TopoField
      </span>
    </span>
  );
}
