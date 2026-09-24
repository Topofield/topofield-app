import {
  Badge,
  Card,
  EmptyState,
  StatusIndicator,
} from "@/components/design-system";
import { DifferentialsTable } from "@/components/settlement/differentials-table";
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
  /**
   * Aviso de lectura fuera de tendencia de la ÚLTIMA visita, por punto, ya
   * redactado (Fase 12). No cambia el nivel del semáforo: es calidad del
   * dato, no gravedad del movimiento.
   */
  lastVisitTrendWarnings: Record<string, string>;
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
 * tendencia por punto y tabla de asentamientos diferenciales. La gráfica de
 * evolución por punto salió de aquí en la Fase 18: la sustituye la dispersión
 * en el tiempo de `charts/points-scatter.tsx`.
 */
export function AnalysisPanel({
  points,
  visits,
  differentials,
  trends,
  lastVisitTrendWarnings,
}: AnalysisPanelProps) {
  const lastVisit = visits.at(-1) ?? null;
  const hasReadings = visits.some((v) => v.readings.length > 0);

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
                        {/* Texto, no solo color: la regla del sistema de
                            diseño. El mensaje completo va visible debajo,
                            no en un title: un title no llega al teclado, al
                            lector de pantalla ni a una tableta en campo. */}
                        {lastVisitTrendWarnings[reading.pointId] && (
                          <div className="mt-1 flex max-w-xs flex-col gap-1">
                            <Badge tone="warning" className="w-fit whitespace-nowrap">
                              ⚠ Lectura fuera de tendencia
                            </Badge>
                            <span className="text-xs text-neutral-600">
                              {lastVisitTrendWarnings[reading.pointId]}
                            </span>
                          </div>
                        )}
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
          hasReadings={hasReadings}
          siteBaselineDate={visits[0]?.date ?? null}
        />
      </Card>

    </div>
  );
}
