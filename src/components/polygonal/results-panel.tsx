import { Select } from "@/components/design-system";
import { decimalToDms } from "@/lib/calculations/angles";
import {
  CORRECTION_METHOD_OPTIONS,
  type CorrectionMethod,
  type PolygonalResult,
  type PolygonalType,
} from "@/types/polygonal";

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

function formatPrecision(x: number | null): string {
  if (x == null) return "—";
  if (!Number.isFinite(x)) return "1:∞";
  return `1:${Math.round(x).toLocaleString("es-CO")}`;
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 py-1">
      <span className="text-sm text-neutral-500">{label}</span>
      <span className="font-mono text-sm tabular-nums text-neutral-900">{value}</span>
    </div>
  );
}

interface ResultsPanelProps {
  result: PolygonalResult;
  type: PolygonalType;
  method: CorrectionMethod;
  onMethodChange: (method: CorrectionMethod) => void;
  disabled?: boolean;
}

export function ResultsPanel({
  result,
  type,
  method,
  onMethodChange,
  disabled,
}: ResultsPanelProps) {
  return (
    <div className="flex flex-col gap-5">
      {type !== "open_uncontrolled" && (
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
    </div>
  );
}
