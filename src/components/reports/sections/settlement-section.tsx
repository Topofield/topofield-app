import { SettlementPlot } from "@/components/reports/settlement-plot";
import {
  formatBookClosure,
  formatDateOnly,
  formatDateShort,
  formatElevation,
  formatEquipmentLine,
  formatKmPrecision,
} from "@/lib/utils/format";
import { n } from "@/lib/reports/values";
import type { SiteSectionData } from "@/lib/reports/sections";
import { LEVEL_TYPE_LABELS, PRECISION_ORDER_LABELS } from "@/types/project";
import { ALERT_LEVEL_LABELS } from "@/types/settlement";
import { STRUCTURE_TYPE_LABELS, type StructureType } from "@/types/site";

/** Cuerpo de la sección de un lugar: datos, gráfica y estado de la última visita. */
export function SettlementReportSection({ data }: { data: SiteSectionData }) {
  const { site, points, pointInputs, visits, history } = data;
  const last = history.visits[history.visits.length - 1];
  const lastVisit = visits[visits.length - 1];

  // Un punto de baja sigue contando —su serie es historia válida—, pero el
  // informe dice cuál y desde cuándo, para que su ausencia en la última visita
  // no parezca un olvido.
  const bajas = points.filter((p) => p.retired_on !== null);
  const conteoPuntos =
    bajas.length === 0
      ? points.length
      : `${points.length} (${bajas.length} de baja: ${bajas
          .map((p) => `${p.code}, desde el ${formatDateOnly(p.retired_on!)}`)
          .join("; ")})`;

  return (
    <>
      <dl className="report-pairs">
        <dt>Tipo de estructura</dt>
        <dd>
          {STRUCTURE_TYPE_LABELS[site.structure_type as StructureType] ?? site.structure_type}
        </dd>
        <dt>Puntos de control</dt>
        <dd>{conteoPuntos}</dd>
        <dt>Visitas</dt>
        <dd>{visits.length}</dd>
        <dt>Peor alerta (última visita)</dt>
        <dd>{last ? ALERT_LEVEL_LABELS[last.worstAlert] : "—"}</dd>
        {/* El equipo es de la visita, no del lugar: el instrumento puede
            cambiar entre visitas. Se muestra el de la más reciente, la misma
            que informa la peor alerta de arriba. */}
        {lastVisit && (
          <>
            <dt>Orden de precisión (última visita)</dt>
            <dd>{PRECISION_ORDER_LABELS[lastVisit.precision_order]}</dd>
            <dt>Equipo (última visita)</dt>
            <dd>
              {formatEquipmentLine(
                lastVisit.equipment_brand,
                lastVisit.equipment_model,
                lastVisit.equipment_serial,
              )}
            </dd>
            <dt>Tipo de nivel</dt>
            <dd>{lastVisit.level_type ? LEVEL_TYPE_LABELS[lastVisit.level_type] : "—"}</dd>
            <dt>Desviación típica</dt>
            <dd>{formatKmPrecision(lastVisit.km_precision_mm)}</dd>
          </>
        )}
      </dl>
      <SettlementPlot points={pointInputs} visits={history.visits} />
      {/* Cada visita con su amarre y el cierre de su libreta (Fase 22): el
          informe documenta cómo se midió, no solo lo que salió. */}
      <h3>Visitas</h3>
      <table className="report-table">
        <thead>
          <tr>
            <th>Visita</th>
            <th>Fecha</th>
            <th>Amarre</th>
            <th>Cierre de la libreta</th>
            <th>Peor alerta</th>
          </tr>
        </thead>
        <tbody>
          {visits.map((v) => {
            const cierre = formatBookClosure(
              n(v.closure_error_mm),
              n(v.tolerance_mm),
              v.meets_tolerance,
            );
            const resultado = history.visits.find((h) => h.visitId === v.id);
            return (
              <tr key={v.id}>
                <td>Visita {v.visit_number}</td>
                <td>{formatDateShort(v.date)}</td>
                <td>
                  {v.reference_bm_code
                    ? `${v.reference_bm_code} · ${formatElevation(v.reference_bm_elevation)}`
                    : "—"}
                </td>
                <td>
                  {v.capture_mode === "book"
                    ? `${cierre.value}${cierre.status === "out" ? " (fuera de tolerancia)" : ""}`
                    : "—"}
                </td>
                <td>{resultado ? ALERT_LEVEL_LABELS[resultado.worstAlert] : "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <h3>Última visita</h3>
      <table className="report-table">
        <thead>
          <tr>
            <th>Punto</th>
            <th>Acumulado (mm)</th>
            <th>Velocidad (mm/mes)</th>
            <th>Alerta</th>
          </tr>
        </thead>
        <tbody>
          {(last?.readings ?? []).map((r) => {
            const code = points.find((p) => p.id === r.pointId)?.code ?? r.pointId;
            return (
              <tr key={r.pointId}>
                <td>{code}</td>
                <td className="num">
                  {r.accumulatedSettlement === null ? "—" : r.accumulatedSettlement.toFixed(1)}
                </td>
                <td className="num">{r.velocity === null ? "—" : r.velocity.toFixed(2)}</td>
                <td>{ALERT_LEVEL_LABELS[r.alertStatus]}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {points.some((p) => p.active_from !== null) && (
        <p className="report-footnote">
          {points
            .filter((p) => p.active_from !== null)
            .map(
              (p) =>
                `El acumulado de ${p.code} se mide desde su alta (${formatDateOnly(p.active_from!)}), no desde la línea base del lugar.`,
            )
            .join(" ")}
        </p>
      )}
    </>
  );
}
