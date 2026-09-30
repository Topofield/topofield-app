import { PolygonalPlot } from "@/components/polygonal/polygonal-plot";
import { georeferenceSummary } from "@/components/polygonal/georeference-plan";
import {
  formatAngularPrecision,
  formatDistancePrecision,
  formatEquipmentLine,
  formatPrecision,
} from "@/lib/utils/format";
import { dms, fixed, n } from "@/lib/reports/values";
import type { PolygonalSectionData } from "@/lib/reports/sections";
import { PRECISION_ORDER_LABELS } from "@/types/project";
import { CORRECTION_METHOD_LABELS, POLYGONAL_TYPE_LABELS } from "@/types/polygonal";

/** Cuerpo de la sección de una poligonal: datos, estaciones y dibujo. */
export function PolygonalReportSection({ data }: { data: PolygonalSectionData }) {
  const { process, stations, plot } = data;
  const georef = georeferenceSummary(process);
  return (
    <>
      <dl className="report-pairs">
        <dt>Tipo</dt>
        <dd>{POLYGONAL_TYPE_LABELS[process.type]}</dd>
        <dt>Método de corrección</dt>
        <dd>
          {process.correction_method ? CORRECTION_METHOD_LABELS[process.correction_method] : "—"}
        </dd>
        {process.correction_method === "least_squares" && (
          <>
            {/* Los pesos se guardan; σ₀ se recalcula con el dibujo, sobre la
                misma entrada. */}
            <dt>Pesos del ajuste</dt>
            <dd>
              σ angular {n(process.ls_sigma_angle_seconds) ?? "—"}&Prime; · σ de distancia{" "}
              {n(process.ls_sigma_distance_m) ?? "—"} m ·{" "}
              {process.ls_distance_measurements ?? "—"} mediciones por distancia
            </dd>
            <dt>σ₀</dt>
            <dd>
              {plot.result.adjustment?.status === "adjusted"
                ? plot.result.adjustment.sigma0.toFixed(3)
                : "—"}
            </dd>
          </>
        )}
        <dt>Error angular</dt>
        <dd>{fixed(process.angular_error_seconds, 1)}&Prime;</dd>
        <dt>Error lineal</dt>
        <dd>{fixed(process.linear_error, 3)} m</dd>
        <dt>Perímetro</dt>
        <dd>{fixed(process.perimeter, 3)} m</dd>
        <dt>Precisión relativa</dt>
        <dd>{formatPrecision(process.relative_precision)}</dd>
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
        <dt>Precisión angular</dt>
        <dd>{formatAngularPrecision(process.angular_precision_seconds)}</dd>
        <dt>Precisión de distancia</dt>
        <dd>
          {formatDistancePrecision(process.distance_precision_mm, process.distance_precision_ppm)}
        </dd>
      </dl>
      {georef && <p className="report-note">Coordenadas georreferenciadas {georef}.</p>}
      <table className="report-table">
        <thead>
          <tr>
            <th>Punto</th>
            <th>Ángulo corregido</th>
            <th>Azimut</th>
            <th>Norte (m)</th>
            <th>Este (m)</th>
          </tr>
        </thead>
        <tbody>
          {stations.map((st) => (
            <tr key={st.id}>
              <td>{st.point_code}</td>
              <td>{dms(st.corrected_angle_deg, st.corrected_angle_min, st.corrected_angle_sec)}</td>
              <td>{dms(st.azimuth_deg, st.azimuth_min, st.azimuth_sec)}</td>
              <td className="num">{fixed(st.north, 3)}</td>
              <td className="num">{fixed(st.east, 3)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="report-plot">
        <PolygonalPlot input={plot.input} result={plot.result} reference={plot.reference} />
      </div>
    </>
  );
}
