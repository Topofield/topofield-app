import { Badge, EmptyState } from "@/components/design-system";
import type { DifferentialPair, PointInput } from "@/types/settlement";

interface DifferentialsTableProps {
  points: PointInput[];
  differentials: DifferentialPair[];
  /** Acumulado (mm) de cada punto en la última visita, para las columnas P1/P2. */
  accumulatedByPoint: Record<string, number | null>;
  /** Si el lugar ya tiene al menos una lectura registrada en alguna visita. */
  hasReadings: boolean;
}

/**
 * Formatea la distorsión como `1/X`. Un diferencial nulo da `1/∞`, que es
 * normal: dos puntos que se asientan igual no tienen distorsión entre sí.
 */
function formatDistortion(inverse: number): string {
  if (!Number.isFinite(inverse)) return "1/∞";
  return `1/${Math.round(inverse).toLocaleString("es-CO")}`;
}

function formatMm(value: number): string {
  return value.toLocaleString("es-CO", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
}

function formatM(value: number): string {
  return value.toLocaleString("es-CO", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Tabla de asentamientos diferenciales y distorsión angular entre cada par de
 * puntos, para las lecturas de la última visita (§ 6.10).
 *
 * Si sale vacía SIEMPRE se explica el porqué: o el catálogo no tiene (al
 * menos) dos puntos con coordenadas N/E, o el lugar todavía no tiene
 * lecturas. Una tabla vacía sin explicación se leería como «no hay
 * distorsión», que aquí sería una afirmación falsa y peligrosa.
 */
export function DifferentialsTable({
  points,
  differentials,
  accumulatedByPoint,
  hasReadings,
}: DifferentialsTableProps) {
  const byId = new Map(points.map((p) => [p.id, p]));
  const pointsWithCoordinates = points.filter(
    (p) => p.northing !== null && p.easting !== null,
  ).length;

  if (differentials.length === 0) {
    if (!hasReadings) {
      return (
        <EmptyState
          title="Todavía no hay lecturas"
          description="La distorsión angular se calcula a partir del acumulado de la última visita. Registra al menos una visita con lecturas para verla."
        />
      );
    }
    if (pointsWithCoordinates < 2) {
      return (
        <EmptyState
          title="Faltan coordenadas en el catálogo"
          description="La distorsión angular necesita la distancia horizontal entre puntos. Agrega Norte y Este a al menos dos puntos del catálogo para poder calcularla."
        />
      );
    }
    return (
      <EmptyState
        title="Sin pares para calcular"
        description="Ningún par de puntos tiene, a la vez, coordenadas y acumulado en la última visita."
      />
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-neutral-100 text-left text-xs text-neutral-500">
            <th className="py-2 pr-3 font-medium">Par</th>
            <th className="py-2 pr-3 font-medium">Asent. P1 (mm)</th>
            <th className="py-2 pr-3 font-medium">Asent. P2 (mm)</th>
            <th className="py-2 pr-3 font-medium">Diferencial (mm)</th>
            <th className="py-2 pr-3 font-medium">Distancia (m)</th>
            <th className="py-2 pr-3 font-medium">Distorsión angular</th>
            <th className="py-2 pr-3 font-medium">Estado</th>
          </tr>
        </thead>
        <tbody>
          {differentials.map((pair) => {
            const pointA = byId.get(pair.pointIdA);
            const pointB = byId.get(pair.pointIdB);
            const accA = accumulatedByPoint[pair.pointIdA] ?? null;
            const accB = accumulatedByPoint[pair.pointIdB] ?? null;
            return (
              <tr
                key={`${pair.pointIdA}-${pair.pointIdB}`}
                className="border-b border-neutral-100 last:border-0"
              >
                <td className="py-2 pr-3 font-medium text-neutral-900">
                  {(pointA?.code ?? "—")} – {(pointB?.code ?? "—")}
                </td>
                <td className="py-2 pr-3 text-neutral-700">
                  {accA === null ? "—" : formatMm(accA)}
                </td>
                <td className="py-2 pr-3 text-neutral-700">
                  {accB === null ? "—" : formatMm(accB)}
                </td>
                <td className="py-2 pr-3 text-neutral-700">
                  {formatMm(pair.differentialMm)}
                </td>
                <td className="py-2 pr-3 text-neutral-700">
                  {formatM(pair.distanceM)}
                </td>
                <td className="py-2 pr-3 text-neutral-700">
                  {formatDistortion(pair.distortionInverse)}
                </td>
                <td className="py-2 pr-3">
                  <Badge tone={pair.exceedsLimit ? "danger" : "success"}>
                    {pair.exceedsLimit ? "Excede" : "Cumple"}
                  </Badge>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
