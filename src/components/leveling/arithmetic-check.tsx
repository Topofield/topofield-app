import { Badge } from "@/components/design-system";
import type { ArithmeticCheck as Check } from "./libreta-rows";

/**
 * La comprobación aritmética del recorrido (Fase 36, libreta B): Σ V+ − Σ V−
 * frente a la cota final menos la inicial, sin las intermedias, y la distancia.
 * Solo comprueba las cuentas de la libreta: cuadra igual con el nivel
 * descolimado; la calidad la juzga la compensación.
 */
export function ArithmeticCheck({ check, label }: { check: Check; label: string }) {
  return (
    <section
      aria-label={`Comprobación aritmética · ${label}`}
      className="grid grid-cols-2 gap-x-5 gap-y-3 rounded-lg border border-rule bg-card px-4 py-3.5 shadow-sm sm:grid-cols-4"
    >
      <div>
        <div className="text-xs text-ink-2">Σ V+ − Σ V−</div>
        <div className="font-semibold tabular-nums">{(check.sumBack - check.sumFore).toFixed(3)} m</div>
      </div>
      <div>
        <div className="text-xs text-ink-2">Cota final − inicial</div>
        <div className="font-semibold tabular-nums">{check.heightDifference.toFixed(3)} m</div>
      </div>
      <div>
        <div className="text-xs text-ink-2">Comprobación</div>
        <div>
          <Badge tone={check.ok ? "success" : "danger"}>{check.ok ? "cuadra" : "no cuadra"}</Badge>
        </div>
      </div>
      <div>
        <div className="text-xs text-ink-2">Distancia</div>
        <div className="font-semibold tabular-nums">{check.distanceM.toFixed(1)} m</div>
      </div>
    </section>
  );
}
