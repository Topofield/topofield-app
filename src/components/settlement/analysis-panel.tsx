import { Card, EmptyState, StatusIndicator } from "@/components/design-system";
import { DifferentialsTable } from "@/components/settlement/differentials-table";
import { SettlementChart } from "@/components/settlement/settlement-chart";
import {
  ALERT_LEVEL_LABELS,
  type DifferentialPair,
  type PointInput,
  type Trend,
  type VisitResult,
} from "@/types/settlement";

const TREND_LABELS: Record<Trend, string> = {
  converging: "Convergente",
  accelerating: "Acelerando",
};

interface AnalysisPanelProps {
  points: PointInput[];
  /** Visitas ya calculadas y clasificadas, en orden cronológico. */
  visits: VisitResult[];
  differentials: DifferentialPair[];
  /** Tendencia por punto; un punto sin entrada aún no tiene 3 visitas. */
  trends: Record<string, Trend>;
}

function formatMm(value: number | null): string {
  if (value === null) return "—";
  return value.toLocaleString("es-CO", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
}

/**
 * Panel de análisis de un lugar: semáforo por punto de la última visita,
 * tendencia por punto, tabla de asentamientos diferenciales y gráfica de
 * evolución del acumulado por punto a lo largo de las visitas.
 */
export function AnalysisPanel({
  points,
  visits,
  differentials,
  trends,
}: AnalysisPanelProps) {
  const lastVisit = visits.at(-1) ?? null;
  const hasReadings = visits.some((v) => v.readings.length > 0);

  const accumulatedByPoint: Record<string, number | null> = {};
  if (lastVisit) {
    for (const reading of lastVisit.readings) {
      accumulatedByPoint[reading.pointId] = reading.accumulatedSettlement;
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <Card title="Semáforo por punto (última visita)">
        {!lastVisit || lastVisit.readings.length === 0 ? (
          <EmptyState
            title="Todavía no hay lecturas"
            description="El semáforo se calcula con las lecturas de la visita más reciente. Registra una visita con lecturas para verlo."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-100 text-left text-xs text-neutral-500">
                  <th className="py-2 pr-3 font-medium">Punto</th>
                  <th className="py-2 pr-3 font-medium">Acumulado (mm)</th>
                  <th className="py-2 pr-3 font-medium">Velocidad (mm/mes)</th>
                  <th className="py-2 pr-3 font-medium">Estado</th>
                  <th className="py-2 pr-3 font-medium">Tendencia</th>
                </tr>
              </thead>
              <tbody>
                {lastVisit.readings.map((reading) => {
                  const point = points.find((p) => p.id === reading.pointId);
                  const trend = trends[reading.pointId];
                  return (
                    <tr
                      key={reading.pointId}
                      className="border-b border-neutral-100 last:border-0"
                    >
                      <td className="py-2 pr-3 font-medium text-neutral-900">
                        {point?.code ?? "—"}
                      </td>
                      <td className="py-2 pr-3 text-neutral-700">
                        {formatMm(reading.accumulatedSettlement)}
                      </td>
                      <td className="py-2 pr-3 text-neutral-700">
                        {formatMm(reading.velocity)}
                      </td>
                      <td className="py-2 pr-3">
                        <StatusIndicator
                          level={reading.alertStatus}
                          label={ALERT_LEVEL_LABELS[reading.alertStatus]}
                        />
                      </td>
                      <td className="py-2 pr-3 text-neutral-700">
                        {trend ? TREND_LABELS[trend] : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card title="Asentamientos diferenciales y distorsión angular">
        <DifferentialsTable
          points={points}
          differentials={differentials}
          accumulatedByPoint={accumulatedByPoint}
          hasReadings={hasReadings}
        />
      </Card>

      <Card title="Evolución del asentamiento acumulado">
        {!hasReadings ? (
          <EmptyState
            title="Todavía no hay lecturas"
            description="La gráfica se dibuja con el acumulado de cada visita. Registra al menos una visita con lecturas para verla."
          />
        ) : (
          <SettlementChart points={points} visits={visits} />
        )}
      </Card>
    </div>
  );
}
