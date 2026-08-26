import { Input, StatusIndicator } from "@/components/design-system";
import { ALERT_LEVEL_LABELS } from "@/types/settlement";
import type { ComputedReading, SettlementPoint } from "@/types/settlement";

/** Formatea un número calculado, o `—` si no existe. */
function fmt(value: number | null, decimals: number): string {
  return value === null ? "—" : value.toFixed(decimals);
}

interface ReadingsTableProps {
  points: SettlementPoint[];
  /** Cota en crudo (texto) por punto, tal como la teclea el usuario. */
  rawElevations: Record<string, string>;
  onElevationChange: (pointId: string, value: string) => void;
  /** Resultado calculado por punto para la visita actual, si ya se calculó. */
  computedByPoint: Record<string, ComputedReading | undefined>;
  /** La visita 0 (línea base) no muestra parcial ni velocidad: son `—` por definición. */
  isBaseline: boolean;
  disabled?: boolean;
}

/**
 * Tabla de lecturas de una visita: una fila por punto del catálogo, con el
 * cálculo en vivo (parcial, acumulado, velocidad, semáforo) ya resuelto por
 * el llamador y pasado como prop — esta tabla no calcula nada, solo presenta.
 */
export function ReadingsTable({
  points,
  rawElevations,
  onElevationChange,
  computedByPoint,
  isBaseline,
  disabled,
}: ReadingsTableProps) {
  if (points.length === 0) {
    return (
      <p className="text-sm text-neutral-500">
        Este lugar todavía no tiene puntos en su catálogo. Agrégalos desde la
        ficha del lugar antes de capturar una visita.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-neutral-100 text-left text-xs text-neutral-500">
            <th className="py-2 pr-3 font-medium">Punto</th>
            <th className="py-2 pr-3 font-medium">Ubicación</th>
            <th className="py-2 pr-3 font-medium">Cota medida (m)</th>
            <th className="py-2 pr-3 font-medium">Parcial (mm)</th>
            <th className="py-2 pr-3 font-medium">Acumulado (mm)</th>
            <th className="py-2 pr-3 font-medium">Velocidad (mm/mes)</th>
            <th className="py-2 pr-3 font-medium">Estado</th>
          </tr>
        </thead>
        <tbody>
          {points.map((point) => {
            const computed = computedByPoint[point.id];
            const partial = isBaseline ? null : (computed?.partialSettlement ?? null);
            const velocity = isBaseline ? null : (computed?.velocity ?? null);
            const accumulated = computed?.accumulatedSettlement ?? null;
            const alertStatus = computed?.alertStatus ?? "normal";

            return (
              <tr
                key={point.id}
                className="border-b border-neutral-100 last:border-0"
              >
                <td className="py-2 pr-3 font-medium text-neutral-900">
                  {point.code}
                </td>
                <td className="py-2 pr-3 text-neutral-700">
                  {point.location_description}
                </td>
                <td className="py-2 pr-3">
                  <Input
                    aria-label={`Cota medida de ${point.code}`}
                    type="number"
                    step="any"
                    inputMode="decimal"
                    value={rawElevations[point.id] ?? ""}
                    onChange={(event) =>
                      onElevationChange(point.id, event.target.value)
                    }
                    disabled={disabled}
                    className="w-32"
                  />
                </td>
                <td className="py-2 pr-3 text-neutral-700">
                  {fmt(partial, 1)}
                </td>
                <td className="py-2 pr-3 text-neutral-700">
                  {fmt(accumulated, 1)}
                </td>
                <td className="py-2 pr-3 text-neutral-700">
                  {fmt(velocity, 2)}
                </td>
                <td className="py-2 pr-3">
                  <StatusIndicator
                    level={alertStatus}
                    label={ALERT_LEVEL_LABELS[alertStatus]}
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
