import { cn } from "@/lib/utils/cn";

/**
 * La mención del trabajo de grado (Fase 45): el escudo de la Universidad
 * Distrital y, en texto, el programa, la universidad y la facultad.
 *
 * El escudo es el oficial sin su rótulo —a este tamaño no se leería, y el
 * nombre va al lado—. Se pinta con una máscara (`.escudo-ud`, en
 * `globals.css`) del color de la tinta, así que vale en los dos temas.
 */
export function MencionUd({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-4", className)}>
      <span
        role="img"
        aria-label="Escudo de la Universidad Distrital Francisco José de Caldas"
        className="escudo-ud h-24 shrink-0 sm:h-28"
      />
      <span aria-hidden="true" className="w-px self-stretch bg-rule-strong" />
      <p className="min-w-0 text-sm leading-snug text-ink-2">
        Trabajo de grado en Ingeniería Topográfica
        <span className="block font-display text-lg font-semibold leading-tight text-ink sm:text-xl">
          Universidad Distrital Francisco José de Caldas
        </span>
        Facultad del Medio Ambiente y Recursos Naturales
      </p>
    </div>
  );
}
