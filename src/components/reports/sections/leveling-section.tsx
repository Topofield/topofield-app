import { formatEquipmentLine, formatKmPrecision } from "@/lib/utils/format";
import { fixed } from "@/lib/reports/values";
import type { LevelingSectionData } from "@/lib/reports/sections";
import { LEVEL_TYPE_LABELS, PRECISION_ORDER_LABELS } from "@/types/project";
import {
  LEVELING_TYPE_LABELS,
  POINT_TYPE_LABELS,
  RUN_TYPE_LABELS,
  type LevelingType,
  type PointType,
  type RunType,
} from "@/types/leveling";

/** Cuerpo de la sección de una nivelación: datos y cotas corregidas. */
export function LevelingReportSection({ data }: { data: LevelingSectionData }) {
  const { process, readings } = data;
  return (
    <>
      <dl className="report-pairs">
        <dt>Tipo</dt>
        <dd>{LEVELING_TYPE_LABELS[process.type as LevelingType] ?? process.type}</dd>
        <dt>Error de cierre</dt>
        <dd>{fixed(process.closure_error_mm, 1)} mm</dd>
        <dt>Tolerancia</dt>
        <dd>{fixed(process.tolerance_mm, 1)} mm</dd>
        <dt>Distancia total</dt>
        <dd>{fixed(process.total_distance_km, 3)} km</dd>
        <dt>Orden de precisión</dt>
        <dd>{PRECISION_ORDER_LABELS[process.precision_order]}</dd>
        <dt>Equipo</dt>
        <dd>
          {formatEquipmentLine(
            process.equipment_brand,
            process.equipment_model,
            process.equipment_serial,
          )}
        </dd>
        <dt>Tipo de nivel</dt>
        <dd>{process.level_type ? LEVEL_TYPE_LABELS[process.level_type] : "—"}</dd>
        <dt>Desviación típica</dt>
        <dd>{formatKmPrecision(process.km_precision_mm)}</dd>
      </dl>
      <table className="report-table">
        <thead>
          <tr>
            <th>Recorrido</th>
            <th>Punto</th>
            <th>Tipo</th>
            <th>Cota corregida (m)</th>
          </tr>
        </thead>
        <tbody>
          {readings.map((r) => (
            <tr key={r.id}>
              <td>{RUN_TYPE_LABELS[r.run_type as RunType] ?? r.run_type}</td>
              <td>{r.point_code}</td>
              <td>{POINT_TYPE_LABELS[r.point_type as PointType] ?? r.point_type}</td>
              <td className="num">{fixed(r.elevation_corrected, 4)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
