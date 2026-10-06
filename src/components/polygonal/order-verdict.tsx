import { Badge } from "@/components/design-system";
import { angularTolerance, detectPrecisionOrder, minRelativePrecision } from "@/lib/calculations/tolerances";
import { formatPrecision } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";
import { PRECISION_ORDERS, PRECISION_ORDER_LABELS, type PrecisionOrder } from "@/types/project";
import type { PolygonalResult, PolygonalType } from "@/types/polygonal";
import { formatSeconds } from "./angle-format";

type Closure = Pick<PolygonalResult, "angularError" | "angularConditionCount" | "relativePrecision">;

export interface OrderCheck {
  order: PrecisionOrder;
  /** K·√n en segundos; `null` sin condición angular. */
  angularTolerance: number | null;
  angularOk: boolean | null;
  /** El X de 1:X. */
  minPrecision: number;
  linearOk: boolean | null;
  /** El orden alcanzado: el más alto que cumple las dos. */
  reached: boolean;
}

/**
 * El «Por qué» del orden alcanzado (Fase 35): cada orden, con su tolerancia
 * angular y su precisión mínima, y si la poligonal las cumple. Las mismas
 * reglas que `detectPrecisionOrder`, con su holgura de coma flotante.
 */
export function orderChecks(result: Closure, type: PolygonalType): OrderCheck[] {
  if (type === "open_uncontrolled") return [];
  const reached = detectPrecisionOrder(result, type);
  const angular = result.angularError != null && result.angularConditionCount != null;
  return PRECISION_ORDERS.map((order) => {
    const tolerance = angular ? angularTolerance(order, result.angularConditionCount!) : null;
    return {
      order,
      angularTolerance: tolerance,
      angularOk: tolerance === null ? null : Math.abs(result.angularError!) <= tolerance + 1e-9,
      minPrecision: minRelativePrecision(order),
      linearOk: result.relativePrecision == null ? null : result.relativePrecision >= minRelativePrecision(order),
      reached: order === reached,
    };
  });
}

function YesNo({ ok }: { ok: boolean | null }) {
  if (ok === null) return <span className="text-ink-2">no aplica</span>;
  return <Badge tone={ok ? "success" : "danger"}>{ok ? "sí" : "no"}</Badge>;
}

function Kpi({ label, value, tone }: { label: string; value: string; tone?: "success" | "warning" }) {
  return (
    <div
      className={cn(
        "rounded-md border px-3.5 py-3",
        tone === "success" && "border-success bg-success-bg text-success",
        tone === "warning" && "border-warning bg-warning-bg text-warning",
        !tone && "border-rule",
      )}
    >
      <div className={cn("text-sm", tone ? "" : "text-ink-2")}>{label}</div>
      <div className="text-xl font-semibold tabular-nums">{value}</div>
    </div>
  );
}

/**
 * Las cifras del ajuste y el orden alcanzado, con el desplegable «Por qué»
 * (Fase 35, maqueta «Ajuste»).
 */
export function OrderVerdict({ result, type, order }: { result: PolygonalResult; type: PolygonalType; order: PrecisionOrder | null }) {
  const checks = orderChecks(result, type);
  const verifiable = result.relativePrecision != null;
  const reachedLabel = order ? PRECISION_ORDER_LABELS[order] : verifiable ? "No alcanza ningún orden" : "—";
  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Error angular" value={formatSeconds(result.angularError)} />
        <Kpi
          label="Error de cierre lineal"
          value={result.linearError == null ? "—" : `${result.linearError.toFixed(3)} m`}
        />
        <Kpi label="Precisión relativa" value={formatPrecision(result.relativePrecision)} />
        <Kpi
          label="Orden alcanzado"
          value={reachedLabel}
          tone={order ? "success" : verifiable ? "warning" : undefined}
        />
      </div>
      {verifiable && checks.length > 0 && (
        <details>
          <summary className="cursor-pointer text-sm font-medium text-mira-ink">
            {order ? `Por qué ${PRECISION_ORDER_LABELS[order].toLowerCase()}` : "Por qué no alcanza ningún orden"}
          </summary>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full max-w-2xl text-sm">
              <thead>
                <tr className="border-b border-rule text-right text-xs text-ink-2">
                  <th scope="col" className="py-2 pr-3 text-left font-medium">
                    Orden
                  </th>
                  <th scope="col" className="py-2 pr-3 font-medium">
                    Tolerancia angular
                  </th>
                  <th scope="col" className="py-2 pr-3 font-medium">
                    Angular
                  </th>
                  <th scope="col" className="py-2 pr-3 font-medium">
                    Precisión mínima
                  </th>
                  <th scope="col" className="py-2 font-medium">
                    Lineal
                  </th>
                </tr>
              </thead>
              <tbody>
                {checks.map((c) => (
                  <tr key={c.order} className={cn("border-b border-rule text-right last:border-b-0", c.reached && "bg-success-bg")}>
                    <td className="py-2 pr-3 text-left font-semibold">{PRECISION_ORDER_LABELS[c.order]}</td>
                    <td className="py-2 pr-3 tabular-nums">
                      {c.angularTolerance === null ? "—" : `${c.angularTolerance.toFixed(1)}″`}
                    </td>
                    <td className="py-2 pr-3">
                      <YesNo ok={c.angularOk} />
                    </td>
                    <td className="py-2 pr-3 tabular-nums">{formatPrecision(c.minPrecision)}</td>
                    <td className="py-2">
                      <YesNo ok={c.linearOk} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-2 text-xs text-ink-2">
              La tolerancia angular es K·√n, con n = {result.angularConditionCount ?? "—"} ángulos en la condición. El
              orden alcanzado es el más alto que cumple las dos.
            </p>
          </div>
        </details>
      )}
    </div>
  );
}
