import { Alert, NumberInput } from "@/components/design-system";
import { sigma0Interval, sigma0Reading } from "@/lib/calculations/least-squares";
import type { PolygonalResult } from "@/types/polygonal";
import type { LeastSquaresWeightsDraft } from "./polygonal-draft";

const SIGMA0_TEXT = {
  consistent: "Los pesos supuestos describen bien las observaciones.",
  worse: "Se midió peor de lo supuesto, o hay un error grueso en la cartera.",
  pessimistic: "Los σ supuestos son pesimistas: se midió mejor de lo declarado.",
} as const;

const UNADJUSTABLE_TEXT = {
  one_side:
    "Con un solo lado no hay nada que ajustar: las condiciones de llegada dependen de una sola distancia. Elija otro método o añada estaciones.",
  singular: "La geometría de la poligonal no permite el ajuste. Revise los datos o elija otro método.",
  not_converged: "El ajuste no convergió. Revise la cartera en busca de un error grueso, o elija otro método.",
} as const;

/**
 * Los pesos del ajuste por mínimos cuadrados (Fase 14): se guardan al salir del
 * campo. Desde la Fase 39 dicen qué pide el método: un usuario creía que le
 * faltaban lecturas por punto, cuando le faltaban los pesos.
 */
export function LeastSquaresWeightsFields({
  weights,
  error,
  onChange,
  onCommit,
}: {
  weights: LeastSquaresWeightsDraft;
  /** Por qué no se pueden guardar, con la regla del servidor. */
  error: string | null;
  onChange: (weights: LeastSquaresWeightsDraft) => void;
  onCommit: () => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="text-sm text-ink-2">
        <p>Mínimos cuadrados reparte el error según la precisión de cada observación, así que pide tres valores:</p>
        <ul className="mt-1 list-disc pl-5">
          <li>
            <span className="font-medium text-ink">σ angular</span>: la precisión de un ángulo, de la ficha de la
            estación total (por ejemplo, 2″).
          </li>
          <li>
            <span className="font-medium text-ink">σ de distancia</span>: la de una medición de distancia, también de
            la ficha (por ejemplo, 0.002 m).
          </li>
          <li>
            <span className="font-medium text-ink">Veces que se midió cada distancia</span>: 1 si la cartera anota una
            sola. Cada lado pesa como σ/√veces.
          </li>
        </ul>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <NumberInput
          label="σ angular (″)"
          value={weights.sigmaAngleSeconds}
          onChange={(e) => onChange({ ...weights, sigmaAngleSeconds: e.target.value })}
          onBlur={onCommit}
        />
        <NumberInput
          label="σ de distancia (m)"
          value={weights.sigmaDistanceM}
          onChange={(e) => onChange({ ...weights, sigmaDistanceM: e.target.value })}
          onBlur={onCommit}
        />
        <NumberInput
          integer
          label="Veces que se midió cada distancia"
          value={weights.distanceMeasurements}
          onChange={(e) => onChange({ ...weights, distanceMeasurements: e.target.value })}
          onBlur={onCommit}
        />
      </div>
      <p className="text-sm text-ink-2">
        No hacen falta más lecturas por punto: la comprobación la da el cierre, con 3 condiciones (2 si la abierta no
        tiene azimut de llegada). Los valores se guardan al salir del campo, cuando están los tres.
      </p>
      {error && <Alert variant="warning">{error}</Alert>}
    </div>
  );
}

function mm(meters: number | null | undefined): number | null {
  return meters == null ? null : meters * 1000;
}

function signed(value: number | null | undefined, decimals: number): string {
  if (value == null) return "—";
  // Lo que redondea a cero se muestra sin signo: «-0.00» no es una corrección.
  const rounded = Number(value.toFixed(decimals));
  if (rounded === 0) return (0).toFixed(decimals);
  const text = Math.abs(rounded).toFixed(decimals);
  return rounded > 0 ? `+${text}` : `−${text}`;
}

/**
 * El resultado del ajuste por mínimos cuadrados (Fase 14): la corrección de cada
 * ángulo y de cada distancia, las distancias ajustadas y σ₀ con su prueba χ².
 * Sin ajuste, el porqué.
 */
export function LeastSquaresPanel({ result }: { result: PolygonalResult }) {
  const adjustment = result.adjustment;
  if (!adjustment) return null;
  if (adjustment.status === "unadjustable") {
    return <Alert variant="warning">{UNADJUSTABLE_TEXT[adjustment.reason]}</Alert>;
  }
  if (adjustment.status !== "adjusted") return null;
  // Con 3 decimales, como σ₀: con 2, un σ₀ de 1.766 saldría «peor» junto a un
  // intervalo que dice 1.77.
  const bounds = sigma0Interval(adjustment.conditions).map((x) => x.toFixed(3));
  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-rule text-right text-xs text-ink-2">
              <th scope="col" className="py-2 pr-3 text-left font-medium">
                Estación
              </th>
              <th scope="col" className="py-2 pr-3 font-medium">
                Ángulo (″)
              </th>
              <th scope="col" className="py-2 pr-3 font-medium">
                Distancia (mm)
              </th>
              <th scope="col" className="py-2 font-medium">
                Distancia ajustada (m)
              </th>
            </tr>
          </thead>
          <tbody>
            {result.stations.map((s, i) => (
              <tr key={i} className="border-b border-rule text-right tabular-nums">
                <td className="py-2 pr-3 text-left font-semibold">{s.pointCode || `E${i + 1}`}</td>
                <td className="py-2 pr-3">{signed(adjustment.angleCorrectionsSec[i], 3)}</td>
                <td className="py-2 pr-3">{signed(mm(adjustment.distanceCorrectionsM[i]), 2)}</td>
                <td className="py-2">{adjustment.adjustedDistances[i]?.toFixed(3) ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-2 text-xs text-ink-2">Una celda con «—» es una observación que no entra en el ajuste.</p>
      </div>
      <div className="max-w-xl text-sm">
        <p>
          σ₀ = <span className="font-semibold tabular-nums">{adjustment.sigma0.toFixed(3)}</span>.{" "}
          {SIGMA0_TEXT[sigma0Reading(adjustment.sigma0, adjustment.conditions)]}
        </p>
        <p className="mt-1 text-xs text-ink-2">
          σ₀ compara lo medido con los pesos supuestos. Con r = {adjustment.conditions} condiciones, la prueba χ² al 95 %
          espera σ₀ entre {bounds[0]} y {bounds[1]}.
        </p>
      </div>
    </div>
  );
}
