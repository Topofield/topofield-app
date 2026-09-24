import { Alert, Input, Select } from "@/components/design-system";
import { decimalToDms } from "@/lib/calculations/angles";
import { SIGMA0_BAND, sigma0Reading } from "@/lib/calculations/least-squares";
import { formatPrecision } from "@/lib/utils/format";
import {
  CORRECTION_METHOD_OPTIONS,
  type CorrectionMethod,
  type PolygonalResult,
  type PolygonalType,
} from "@/types/polygonal";
import type { LeastSquaresWeightsDraft } from "./polygonal-draft";

function formatAngleSum(deg: number | null): string {
  if (deg == null) return "—";
  const { deg: d, min, sec } = decimalToDms(deg);
  return `${d}° ${min}′ ${sec}″`;
}

function formatSeconds(value: number | null): string {
  return value == null ? "—" : `${value.toFixed(1)}″`;
}

function formatMeters(value: number | null, decimals = 3): string {
  return value == null ? "—" : value.toFixed(decimals);
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 py-1">
      <span className="text-sm text-neutral-500">{label}</span>
      <span className="font-mono text-sm tabular-nums text-neutral-900">{value}</span>
    </div>
  );
}

const SIGMA0_TEXT = {
  consistent: "Los pesos supuestos describen bien las observaciones.",
  worse: "Se midió peor de lo supuesto, o hay un error grueso en la cartera.",
  pessimistic: "Los σ supuestos son pesimistas: se midió mejor de lo declarado.",
} as const;

const UNADJUSTABLE_TEXT = {
  one_side:
    "Con un solo lado no hay nada que ajustar: las condiciones de llegada dependen de una sola distancia. Elija otro método o añada estaciones.",
  singular:
    "La geometría de la poligonal no permite el ajuste (el sistema de condiciones es singular). Revise los datos o elija otro método.",
  not_converged:
    "El ajuste no convergió: las condiciones no quedan en cero. Revise la cartera en busca de un error grueso, o elija otro método.",
} as const;

interface ResultsPanelProps {
  result: PolygonalResult;
  type: PolygonalType;
  method: CorrectionMethod;
  onMethodChange: (method: CorrectionMethod) => void;
  /** Pesos del ajuste por mínimos cuadrados (Fase 14). */
  weights: LeastSquaresWeightsDraft;
  /** Por qué no se pueden guardar los pesos, con la regla del servidor. */
  weightsError?: string | null;
  onWeightsChange: (weights: LeastSquaresWeightsDraft) => void;
  disabled?: boolean;
}

export function ResultsPanel({
  result,
  type,
  method,
  onMethodChange,
  weights,
  weightsError,
  onWeightsChange,
  disabled,
}: ResultsPanelProps) {
  const leastSquares = method === "least_squares";
  const adjustment = result.adjustment;
  // La abierta sin control no tiene nada que corregir, así que no hay selector.
  // Salvo si el proceso ya tiene mínimos cuadrados (se cambió el tipo después):
  // entonces se muestra, para poder elegir otro método y guardar.
  const showSelector = type !== "open_uncontrolled" || leastSquares;

  return (
    <div className="flex flex-col gap-5">
      {showSelector && (
        <div className="flex flex-wrap items-center justify-end gap-3">
          <Select
            label="Método de corrección"
            options={CORRECTION_METHOD_OPTIONS}
            value={method}
            disabled={disabled}
            onChange={(e) => onMethodChange(e.target.value as CorrectionMethod)}
          />
        </div>
      )}

      {leastSquares && type !== "open_uncontrolled" && (
        <div className="flex flex-col gap-3">
          <div className="grid gap-4 sm:grid-cols-3">
            <Input
              label="σ angular (″)"
              inputMode="decimal"
              value={weights.sigmaAngleSeconds}
              disabled={disabled}
              onChange={(e) =>
                onWeightsChange({ ...weights, sigmaAngleSeconds: e.target.value })
              }
            />
            <Input
              label="σ de distancia (m)"
              inputMode="decimal"
              value={weights.sigmaDistanceM}
              disabled={disabled}
              onChange={(e) =>
                onWeightsChange({ ...weights, sigmaDistanceM: e.target.value })
              }
            />
            <Input
              label="Mediciones por distancia"
              inputMode="numeric"
              value={weights.distanceMeasurements}
              disabled={disabled}
              onChange={(e) =>
                onWeightsChange({ ...weights, distanceMeasurements: e.target.value })
              }
            />
          </div>
          <p className="text-sm text-neutral-500">
            La desviación típica que se supone para cada ángulo y cada
            distancia; todas las observaciones pesan igual. La hoja de la
            universidad usa, por ejemplo, 2″, 0.011 m y 2 mediciones. Una
            distancia medida n veces pesa como σ/√n.
          </p>
          {adjustment?.status === "missing_weights" && (
            <Alert variant="warning">
              {/* El motor solo sabe que no puede usar los pesos; el porqué
                  —faltan o no son válidos— lo da el validador. */}
              {weightsError ??
                "Faltan los pesos del ajuste: σ angular, σ de distancia y número de mediciones."}{" "}
              Sin pesos válidos no hay coordenadas ajustadas, y el método no
              se puede guardar.
            </Alert>
          )}
          {adjustment?.status === "unadjustable" && (
            <Alert variant="warning">{UNADJUSTABLE_TEXT[adjustment.reason]}</Alert>
          )}
        </div>
      )}

      <div className="grid gap-6 sm:grid-cols-2">
        {type === "closed" && (
          <div>
            <h3 className="mb-1 text-sm font-semibold">
              Verificación angular
            </h3>
            <Row label="Suma medida" value={formatAngleSum(result.angleSum)} />
            <Row
              label="Suma teórica"
              value={formatAngleSum(result.theoreticalSum)}
            />
            <Row
              label="Error angular"
              value={formatSeconds(result.angularError)}
            />
            <Row
              label="Tolerancia angular"
              value={formatSeconds(result.angularTolerance)}
            />
            {result.reorientationError != null && (
              <>
                <Row
                  label="Control de reorientación"
                  value={formatSeconds(result.reorientationError)}
                />
                <p className="mt-1 text-xs text-neutral-500">
                  El último azimut debe volver al azimut de amarre. Es control
                  de calidad del levantamiento, no criterio de tolerancia.
                </p>
              </>
            )}
          </div>
        )}
        <div>
          <h3 className="mb-1 text-sm font-semibold">
            Cierre lineal
          </h3>
          <Row
            label="Error de cierre"
            value={formatMeters(result.linearError, 4)}
          />
          <Row label="Perímetro" value={formatMeters(result.perimeter)} />
          {type !== "open_uncontrolled" && (
            <Row
              label="Precisión relativa"
              value={formatPrecision(result.relativePrecision)}
            />
          )}
        </div>
      </div>

      {result.stations.some((s) => s.north != null) && (
        <div className="overflow-x-auto">
          <h3 className="mb-2 text-sm font-semibold">
            Coordenadas {type !== "open_uncontrolled" ? "corregidas" : ""}
          </h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-100 text-left text-xs text-neutral-500">
                <th className="py-2 pr-3 font-medium">Estación</th>
                <th className="py-2 pr-3 font-medium">ΔN corr.</th>
                <th className="py-2 pr-3 font-medium">ΔE corr.</th>
                <th className="py-2 pr-3 font-medium">Norte</th>
                <th className="py-2 pr-3 font-medium">Este</th>
              </tr>
            </thead>
            <tbody>
              {result.stations.map((s, i) => (
                <tr key={i} className="border-b border-neutral-100">
                  <td className="py-2 pr-3 font-medium text-neutral-900">
                    {s.pointCode || `E${i + 1}`}
                  </td>
                  <td className="py-2 pr-3 font-mono tabular-nums text-neutral-700">
                    {formatMeters(s.correctedDeltaNorth)}
                  </td>
                  <td className="py-2 pr-3 font-mono tabular-nums text-neutral-700">
                    {formatMeters(s.correctedDeltaEast)}
                  </td>
                  <td className="py-2 pr-3 font-mono tabular-nums text-neutral-700">
                    {formatMeters(s.north)}
                  </td>
                  <td className="py-2 pr-3 font-mono tabular-nums text-neutral-700">
                    {formatMeters(s.east)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {adjustment?.status === "adjusted" && (
        <div className="flex flex-col gap-3">
          <div className="overflow-x-auto">
            <h3 className="mb-2 text-sm font-semibold">
              Correcciones del ajuste
            </h3>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-100 text-left text-xs text-neutral-500">
                  <th className="py-2 pr-3 font-medium">Estación</th>
                  <th className="py-2 pr-3 font-medium">Ángulo (″)</th>
                  <th className="py-2 pr-3 font-medium">Distancia (mm)</th>
                  <th className="py-2 pr-3 font-medium">Distancia ajustada (m)</th>
                </tr>
              </thead>
              <tbody>
                {result.stations.map((s, i) => (
                  <tr key={i} className="border-b border-neutral-100">
                    <td className="py-2 pr-3 font-medium text-neutral-900">
                      {s.pointCode || `E${i + 1}`}
                    </td>
                    <td className="py-2 pr-3 font-mono tabular-nums text-neutral-700">
                      {signed(adjustment.angleCorrectionsSec[i], 3)}
                    </td>
                    <td className="py-2 pr-3 font-mono tabular-nums text-neutral-700">
                      {signed(mm(adjustment.distanceCorrectionsM[i]), 2)}
                    </td>
                    <td className="py-2 pr-3 font-mono tabular-nums text-neutral-700">
                      {formatMeters(adjustment.adjustedDistances[i] ?? null)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-2 text-xs text-neutral-500">
              La orientación es el dato de partida y no se ajusta. Una celda con
              «—» es una observación que no entra en el ajuste.
            </p>
          </div>
          <div className="max-w-md">
            <Row label="σ₀" value={adjustment.sigma0.toFixed(3)} />
            <Row
              label="Condiciones · iteraciones"
              value={`${adjustment.conditions} · ${adjustment.iterations}`}
            />
            <p className="mt-1 text-sm text-neutral-700">
              {SIGMA0_TEXT[sigma0Reading(adjustment.sigma0)]}
            </p>
            <p className="mt-1 text-xs text-neutral-500">
              σ₀ compara lo medido con los pesos supuestos: cerca de 1 (entre{" "}
              {SIGMA0_BAND[0]} y {SIGMA0_BAND[1]}) es lo esperado. Es
              información, no criterio: el veredicto de cierre es el mismo con
              cualquier método.
            </p>
          </div>
        </div>
      )}
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
  const text = rounded.toFixed(decimals);
  return rounded > 0 ? `+${text}` : text;
}
