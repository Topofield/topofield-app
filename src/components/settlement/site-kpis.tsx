import { KpiCard } from "@/components/design-system";
import type { SiteSummary } from "@/lib/calculations/settlement-summary";
import { formatDateShort, formatSignedMm } from "@/lib/utils/format";

interface SiteKpisProps {
  summary: SiteSummary;
  /** Código de cada punto, por id. */
  codes: Record<string, string>;
}

/** Un valor con su unidad en letra menor, como en el prototipo: «−18.1 mm». */
export function withUnit(value: string, unit: string) {
  return (
    <>
      {value}
      <span className="ml-1 whitespace-nowrap text-base font-normal text-ink-2">{unit}</span>
    </>
  );
}

/**
 * Los cinco KPIs del lugar, sobre la última visita y el histórico. Definidos
 * en el PRD de la Fase 18, «KPIs»: la velocidad del motor sustituye a la
 * «velocidad reciente» del prototipo, que no se derivaba bien. La distorsión
 * angular salió en la Fase 29, con las coordenadas de los puntos.
 */
export function SiteKpis({ summary, codes }: SiteKpisProps) {
  const last = summary.latest;
  const code = (id: string | undefined) => (id ? (codes[id] ?? "—") : "—");

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
      <KpiCard
        label="Asentamiento máximo"
        value={last?.maxSettlement ? withUnit(formatSignedMm(last.maxSettlement.value), "mm") : "—"}
        hint={last?.maxSettlement ? `${code(last.maxSettlement.pointId)} en la última visita` : "Sin lecturas"}
      />
      <KpiCard
        label="Promedio actual"
        value={last?.mean != null ? withUnit(formatSignedMm(last.mean), "mm") : "—"}
        hint={last ? `${last.readingCount} puntos de control medidos` : undefined}
      />
      <KpiCard
        label="Velocidad máxima"
        value={last?.maxVelocity ? withUnit(last.maxVelocity.value.toFixed(2), "mm/mes") : "—"}
        hint={last?.maxVelocity ? `${code(last.maxVelocity.pointId)}, última visita` : "Desde la segunda visita"}
      />
      <KpiCard
        label="Visitas en alerta"
        value={summary.visitsInAlert}
        hint={`De ${summary.visits.length} visitas, con algún punto en precaución o más`}
      />
      <KpiCard
        label="Visitas"
        value={summary.visits.length}
        hint={
          summary.lastDate
            ? `Base ${formatDateShort(summary.baseDate!)} · última ${formatDateShort(summary.lastDate)}`
            : "Aún no hay visitas"
        }
      />
    </div>
  );
}
