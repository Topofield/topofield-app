import { Alert, Badge } from "@/components/design-system";
import { detectLevelingOrder, withinTolerance } from "@/lib/calculations/leveling";
import { LEVELING_TOLERANCE_K, levelingTolerance } from "@/lib/calculations/tolerances";
import { formatSignedMm } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";
import type { LevelingResult, LevelingType } from "@/types/leveling";
import { PRECISION_ORDERS, PRECISION_ORDER_LABELS, type PrecisionOrder } from "@/types/project";

/** Un recorrido que se juzga: su error en mm, su distancia y el factor de la tolerancia. */
export interface JudgedRun {
  label: string;
  errorMm: number;
  km: number;
  /** √2 en la discrepancia de una abierta con vuelta; 1 en un cierre. */
  factor: number;
}

/**
 * Con qué se juzga el orden (Fase 36): en la cerrada y la de enlace, el error
 * de cierre de la ida y, si la hay, el de la vuelta, cada uno con su
 * distancia; en la abierta con vuelta, la discrepancia sobre el recorrido más
 * corto. Las mismas reglas que `detectLevelingOrder`.
 */
export function judgedRuns(result: LevelingResult, type: LevelingType): JudgedRun[] {
  if (type === "open") {
    const back = result.return;
    if (!back || result.discrepancyMm == null) return [];
    return [
      {
        label: "Discrepancia",
        errorMm: result.discrepancyMm,
        km: Math.min(result.forward.distanceKm, back.distanceKm),
        factor: Math.SQRT2,
      },
    ];
  }
  if (result.closureErrorMm == null) return [];
  const runs: JudgedRun[] = [
    { label: result.return ? "Cierre de la ida" : "Error de cierre", errorMm: result.closureErrorMm, km: result.forward.distanceKm, factor: 1 },
  ];
  if (result.return?.errorMm != null) {
    runs.push({ label: "Cierre de la vuelta", errorMm: result.return.errorMm, km: result.return.distanceKm, factor: 1 });
  }
  return runs;
}

export interface LevelingOrderCheck {
  order: PrecisionOrder;
  /** K en mm/√km. */
  k: number;
  /** La tolerancia de cada recorrido juzgado, en mm. */
  tolerancesMm: number[];
  meets: boolean;
  /** El orden alcanzado: el más alto que cumple. */
  reached: boolean;
}

/** El «Por qué» del orden alcanzado: los cuatro órdenes con su tolerancia y si se cumple. */
export function levelingOrderChecks(result: LevelingResult, type: LevelingType): LevelingOrderCheck[] {
  const { order: reached, verifiable } = detectLevelingOrder(result, type);
  if (!verifiable) return [];
  const runs = judgedRuns(result, type);
  return PRECISION_ORDERS.map((order) => {
    const tolerancesMm = runs.map((r) => levelingTolerance(order, r.km) * r.factor);
    return {
      order,
      k: LEVELING_TOLERANCE_K[order],
      tolerancesMm,
      meets: runs.every((r, i) => withinTolerance(r.errorMm, tolerancesMm[i]!)),
      reached: order === reached,
    };
  });
}

const mm = (values: number[]) => `${values.map((v) => v.toFixed(1)).join(" · ")} mm`;

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
 * Las cifras de la compensación y el orden alcanzado, con su «Por qué» y el
 * aviso si no alcanza ninguno (Fase 36, maqueta «Compensación»). La
 * nivelación compensa igual: el aviso dice que en la práctica se repetiría.
 */
export function OrderVerdict({
  result,
  type,
  order,
}: {
  result: LevelingResult;
  type: LevelingType;
  order: PrecisionOrder | null;
}) {
  const runs = judgedRuns(result, type);
  const checks = levelingOrderChecks(result, type);
  if (runs.length === 0 || checks.length === 0) return null;
  const shown = checks.find((c) => c.reached) ?? checks.at(-1)!;
  const withReturn = result.return != null;
  const distance = withReturn
    ? `${(result.forward.distanceKm * 1000).toFixed(1)} · ${(result.return!.distanceKm * 1000).toFixed(1)} m`
    : `${(result.forward.distanceKm * 1000).toFixed(1)} m`;
  const errorLabel = type === "open" ? "Discrepancia ida − vuelta" : withReturn ? "Cierre ida · vuelta" : "Error de cierre";
  const errorValue =
    type === "open" ? `${runs[0]!.errorMm.toFixed(1)} mm` : `${runs.map((r) => formatSignedMm(r.errorMm)).join(" · ")} mm`;
  const formula = type === "open" ? "K·√D·√2" : "K·√D";
  const judged = type === "open" ? "la discrepancia" : withReturn ? "el cierre de los dos recorridos" : "el error de cierre";

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label={errorLabel} value={errorValue} />
        <Kpi label={withReturn ? "Distancia ida · vuelta" : "Distancia"} value={distance} />
        <Kpi
          label={`Tolerancia ${order ? `de ${PRECISION_ORDER_LABELS[order].toLowerCase()}` : "del ordinario"}`}
          value={mm(shown.tolerancesMm)}
        />
        <Kpi
          label="Orden alcanzado"
          value={order ? PRECISION_ORDER_LABELS[order] : "Ninguno"}
          tone={order ? "success" : "warning"}
        />
      </div>
      {!order && (
        <Alert variant="warning">
          No alcanza ningún orden: la compensación se aplicó igual. En la práctica, un trabajo fuera de tolerancia se
          repite.
        </Alert>
      )}
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
                  K
                </th>
                <th scope="col" className="py-2 pr-3 font-medium">
                  Tolerancia {formula}
                </th>
                <th scope="col" className="py-2 font-medium">
                  {runs
                    .map((r) => `${r.label} ${type === "open" ? r.errorMm.toFixed(1) : formatSignedMm(r.errorMm)} mm`)
                    .join(" · ")}
                </th>
              </tr>
            </thead>
            <tbody>
              {checks.map((c) => (
                <tr key={c.order} className={cn("border-b border-rule text-right last:border-b-0", c.reached && "bg-success-bg")}>
                  <td className="py-2 pr-3 text-left font-semibold">{PRECISION_ORDER_LABELS[c.order]}</td>
                  <td className="py-2 pr-3 whitespace-nowrap tabular-nums">{c.k} mm</td>
                  <td className="py-2 pr-3 whitespace-nowrap tabular-nums">{mm(c.tolerancesMm)}</td>
                  <td className="py-2">
                    <Badge tone={c.meets ? "success" : "danger"}>{c.meets ? "cumple" : "no cumple"}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-xs text-ink-2">
            D = {runs.map((r) => r.km.toFixed(4)).join(" · ")} km
            {type === "open" ? ", el más corto de los dos recorridos" : withReturn ? ", la de cada recorrido" : ", la del recorrido"}. El
            orden alcanzado es el más alto cuya tolerancia cumple {judged}.
          </p>
        </div>
      </details>
    </div>
  );
}
