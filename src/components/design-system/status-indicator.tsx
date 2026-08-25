import { cn } from "@/lib/utils/cn";
import type { AlertLevel } from "@/types/settlement";

/** Semáforo de 3 niveles de las Fases 3-4 (tolerancia cumplida o no). */
type Status = "ok" | "warning" | "danger";

const DOT_CLASSES: Record<Status, string> = {
  ok: "bg-success-500",
  warning: "bg-warning-500",
  danger: "bg-danger-500",
};

const LEVEL_CLASSES: Record<AlertLevel, string> = {
  normal: "bg-semaphore-green",
  caution: "bg-semaphore-yellow",
  alert: "bg-semaphore-orange",
  alarm: "bg-semaphore-red",
};

/**
 * Forma del indicador por nivel — el segundo canal, además del color y del
 * texto.
 *
 * Los cuatro tokens del semáforo cumplen AA contra blanco, pero NO se separan
 * entre sí: medido, verde/rojo dan 1.028 y naranja/rojo 1.014. La alternativa
 * que se barajó (rellenos vivos con anillo oscuro) tampoco lo arregla —dejaba
 * verde/rojo en 1.065—, porque la causa es estructural: cuatro niveles que
 * deben cumplir 3:1 contra blanco quedan comprimidos en una banda estrecha de
 * luminancia. No hay cuarteto de colores que lo resuelva, así que la distinción
 * fiable tiene que venir de la forma. Ver docs/prds/04-asentamientos.md,
 * hallazgo 5 y decisión #9.
 */
export const SEMAPHORE_SHAPES: Record<AlertLevel, string> = {
  normal: "rounded-full",              // ●  círculo
  caution: "rounded-[2px]",            // ■  cuadrado
  alert: "rounded-[2px] rotate-45",    // ◆  rombo
  alarm: "clip-triangle",              // ▲  triángulo
};

interface StatusIndicatorProps {
  /** Semáforo de 3 niveles (tolerancia). Mutuamente excluyente con `level`. */
  status?: Status;
  /** Semáforo de 4 niveles del control de asentamientos. */
  level?: AlertLevel;
  label: string;
  className?: string;
}

/**
 * Semáforo de cumplimiento con etiqueta.
 *
 * Dos modos: `status` para los 3 niveles de tolerancia de poligonal y
 * nivelación, y `level` para los 4 niveles de alerta de asentamientos. El
 * color NUNCA es el único canal: siempre hay texto, y en el modo de 4 niveles
 * también forma.
 */
export function StatusIndicator({
  status,
  level,
  label,
  className,
}: StatusIndicatorProps) {
  const isLevel = level !== undefined;

  return (
    <div className={cn("inline-flex items-center gap-2", className)}>
      <span
        aria-hidden
        className={cn(
          "h-2.5 w-2.5 shrink-0",
          isLevel
            ? cn(LEVEL_CLASSES[level], SEMAPHORE_SHAPES[level])
            : cn(DOT_CLASSES[status ?? "ok"], "rounded-full"),
        )}
      />
      <span className="text-sm font-medium text-neutral-800">{label}</span>
    </div>
  );
}
