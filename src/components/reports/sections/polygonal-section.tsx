import type { ReactNode } from "react";
import { adjustedRows } from "@/components/polygonal/adjusted-table";
import { formatAngle, formatSeconds } from "@/components/polygonal/angle-format";
import type { CaptureRow } from "@/components/polygonal/capture-rows";
import { georeferenceSummary } from "@/components/polygonal/georeference-plan";
import { orderChecks } from "@/components/polygonal/order-verdict";
import { PolygonalPlot } from "@/components/polygonal/polygonal-plot";
import { dmsToDecimal } from "@/lib/calculations/angles";
import { ANGULAR_TOLERANCE_K, angularTolerance } from "@/lib/calculations/tolerances";
import type { PolygonalSectionData } from "@/lib/reports/sections";
import { formatEquipmentLine, formatPrecision } from "@/lib/utils/format";
import { PRECISION_ORDER_LABELS, type PrecisionOrder } from "@/types/project";
import {
  ANGLE_TYPE_LABELS,
  CORRECTION_METHOD_LABELS,
  DEFLECTION_DIRECTION_LABELS,
  POLYGONAL_TYPE_LABELS,
  type AngleType,
} from "@/types/polygonal";
import { PolygonalCorrection } from "./polygonal-correction";

const m3 = (v: number | null | undefined) => (v == null || !Number.isFinite(v) ? "—" : v.toFixed(3));
const signed3 = (v: number) => {
  const r = Number(v.toFixed(3));
  if (r === 0) return "0.000";
  return `${r < 0 ? "−" : "+"}${Math.abs(r).toFixed(3)}`;
};

/** «Cerrada, ángulos interiores». */
function typeLabel(type: PolygonalSectionData["process"]["type"], angleType: AngleType): string {
  const kind = POLYGONAL_TYPE_LABELS[type];
  if (type === "open_controlled") return `${kind}, deflexiones`;
  if (type === "open_uncontrolled") return kind;
  return `${kind}, ángulos ${ANGLE_TYPE_LABELS[angleType].toLowerCase()}`;
}

/** Por qué alcanza el orden que alcanza, en una frase. */
function orderReason(data: PolygonalSectionData): string | null {
  const { result, input } = data.plot;
  const order = data.order;
  if (!order || result.relativePrecision == null) return null;
  const checks = orderChecks(result, input.type);
  const reached = checks.find((c) => c.order === order)!;
  const precision = formatPrecision(result.relativePrecision);
  const label = (o: PrecisionOrder) => PRECISION_ORDER_LABELS[o].toLowerCase();
  if (reached.angularTolerance === null) {
    return `Sin cierre angular, el orden se juzga por la precisión lineal: ${precision} alcanza la de ${label(order)} (${formatPrecision(reached.minPrecision)}).`;
  }
  const bestAngular = checks.find((c) => c.angularOk)!;
  const bestLinear = checks.find((c) => c.linearOk)!;
  if (bestAngular.order === bestLinear.order) {
    return `El error angular y la precisión lineal cumplen las tolerancias de ${label(order)}: ${reached.angularTolerance.toFixed(1)}″ y ${formatPrecision(reached.minPrecision)}.`;
  }
  if (bestAngular.order !== order) {
    return `El error angular cabe en la tolerancia de ${label(bestAngular.order)} (${bestAngular.angularTolerance!.toFixed(1)}″), pero la precisión lineal de ${precision} solo alcanza la de ${label(order)} (${formatPrecision(reached.minPrecision)}). El orden es el más alto que cumple las dos.`;
  }
  return `La precisión lineal de ${precision} alcanza la de ${label(bestLinear.order)} (${formatPrecision(bestLinear.minPrecision)}), pero el error angular solo cabe en la tolerancia de ${label(order)} (${reached.angularTolerance.toFixed(1)}″). El orden es el más alto que cumple las dos.`;
}

function Kpi({ label, value, ok }: { label: string; value: string; ok?: boolean }) {
  return (
    <div className={ok ? "report-kpi report-kpi-ok" : "report-kpi"}>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function Pairs({ items }: { items: [string, ReactNode][] }) {
  return (
    <dl className="report-pairs">
      {items.map(([k, v]) => (
        <div key={k} className="contents">
          <dt>{k}</dt>
          <dd>{v}</dd>
        </div>
      ))}
    </dl>
  );
}

/** «V10 → D1 (cierre)». */
function sideLabel(r: CaptureRow): string {
  const suffix =
    r.role === "backsight" ? " (0 atrás)" : r.role === "closing" ? " (cierre)" : r.role === "closing_angle" ? " (cierre angular)" : "";
  return `${r.from}${r.to ? ` → ${r.to}` : ""}${suffix}`;
}

/** La suma teórica, con su expresión: «(6 − 2)·180° + 360°». */
function theoreticalLabel(vertices: number, angleType: AngleType, theoretical: number | null): string {
  if (theoretical == null) return "Suma teórica";
  const base = angleType === "exterior" ? (vertices + 2) * 180 : (vertices - 2) * 180;
  const turns = Math.round((theoretical - base) / 360);
  if (Math.abs(base + turns * 360 - theoretical) > 1e-6 || turns < 0) return "Suma teórica";
  const extra = turns === 0 ? "" : turns === 1 ? " + 360°" : ` + ${turns}·360°`;
  return `Suma teórica (${vertices} ${angleType === "exterior" ? "+" : "−"} 2)·180°${extra}`;
}

/**
 * Cuerpo de la sección de una poligonal en el informe (Fase 35, maqueta
 * «Informe · Brújula»): el resultado con el orden alcanzado, los datos de
 * campo, la corrección por método, la poligonal ajustada y las coordenadas con
 * el dibujo. Todo sale del cálculo en vivo de lo guardado: lo mismo que Datos y
 * Ajuste.
 */
export function PolygonalReportSection({ data }: { data: PolygonalSectionData }) {
  const { process, plot, rows, order, angleType, angleFormat, referenceLabel } = data;
  const { input, result } = plot;
  const georef = georeferenceSummary(process);
  const responsible = [process.responsible_name, process.responsible_role].filter((v) => v && v.trim() !== "").join(", ");
  const uncontrolled = input.type === "open_uncontrolled";
  const verifiable = !uncontrolled && result.relativePrecision != null;
  const calculated = result.stations.filter((s) => s.north != null).length >= 2;
  const reason = orderReason(data);
  const adjusted = adjustedRows(input, result, {
    start: process.start_point_code,
    reference: referenceLabel,
    end: process.end_point_code,
  });
  const n = input.stations.length;
  const start = process.start_point_code;
  const points = result.stations.filter(
    (s, i) => !(input.type === "closed" && i > 0 && i === n - 1 && s.pointCode === start),
  );
  const startAz = process.start_azimuth_deg != null
    ? dmsToDecimal(process.start_azimuth_deg, process.start_azimuth_min ?? 0, Number(process.start_azimuth_sec ?? 0))
    : null;
  const endAz = process.end_azimuth_deg != null
    ? dmsToDecimal(process.end_azimuth_deg, process.end_azimuth_min ?? 0, Number(process.end_azimuth_sec ?? 0))
    : null;
  const reference = plot.reference;
  const vertices = input.hasOrientation ? n - 1 : n;
  const count = result.angularConditionCount;
  const toleranceOrder: PrecisionOrder = order ?? "ordinario";
  // El último azimut de una cerrada amarrada vuelve al de partida, o al del primer lado.
  const closingRow = adjusted.rows.find((r) => r.role === "closing_angle");
  const firstSide = adjusted.rows.find((r) => r.role === "side");
  const closingTarget = input.hasClosingRow ? startAz : (firstSide?.azimuth ?? null);
  const closes =
    input.type === "closed" &&
    closingRow?.azimuth != null &&
    closingTarget != null &&
    Math.abs(((closingRow.azimuth - closingTarget + 540) % 360) - 180) * 3600 < 0.05;

  return (
    <>
      <Pairs
        items={[
          ...(process.location ? ([["Ubicación", process.location]] as [string, ReactNode][]) : []),
          ["Tipo", typeLabel(input.type, angleType)],
          ...(responsible ? ([["Responsable", responsible]] as [string, ReactNode][]) : []),
          ...(uncontrolled ? [] : ([["Método de ajuste", CORRECTION_METHOD_LABELS[input.method]]] as [string, ReactNode][])),
          ["Equipo", formatEquipmentLine(process.equipment_brand, process.equipment_model, process.equipment_serial)],
        ]}
      />

      <h3>1. Resultado</h3>
      <dl className="report-kpis">
        <Kpi label="Error angular" value={formatSeconds(result.angularError)} />
        <Kpi label="Error de cierre" value={result.linearError == null ? "—" : `${result.linearError.toFixed(3)} m`} />
        <Kpi label="Precisión relativa" value={formatPrecision(result.relativePrecision)} />
        <Kpi
          label="Orden alcanzado"
          value={order ? PRECISION_ORDER_LABELS[order] : verifiable ? "Ninguno" : "—"}
          ok={order !== null}
        />
      </dl>
      {uncontrolled ? (
        <p className="report-text">Sin verificación de cierre.</p>
      ) : !calculated ? (
        <p className="report-text">
          {result.adjustment?.status === "missing_weights"
            ? "Sin ajuste: faltan los pesos de mínimos cuadrados."
            : result.adjustment?.status === "unadjustable"
              ? "Sin ajuste: la geometría de la poligonal no permite el ajuste por mínimos cuadrados."
              : "La poligonal no está completa: el informe muestra lo capturado."}
        </p>
      ) : verifiable && !order ? (
        <p className="report-alert">
          No alcanza la precisión de ningún orden: el error angular o la precisión relativa supera las tolerancias del
          ordinario.
        </p>
      ) : (
        reason && <p className="report-note">{reason}</p>
      )}

      <h3>2. Datos de campo</h3>
      <h4>Amarre</h4>
      <table className="report-table">
        <thead>
          <tr>
            <th>Punto</th>
            <th>Papel</th>
            <th className="num">Norte (m)</th>
            <th className="num">Este (m)</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>{start || "—"}</td>
            <td>Estación de partida</td>
            <td className="num">{m3(Number(process.start_north))}</td>
            <td className="num">{m3(Number(process.start_east))}</td>
          </tr>
          {referenceLabel && (
            <tr>
              <td>{referenceLabel}</td>
              <td>Referencia, 0° atrás</td>
              <td className="num">{m3(reference?.north)}</td>
              <td className="num">{m3(reference?.east)}</td>
            </tr>
          )}
          {input.type === "open_controlled" && process.end_point_code && (
            <tr>
              <td>{process.end_point_code}</td>
              <td>Llegada</td>
              <td className="num">{m3(input.endNorth)}</td>
              <td className="num">{m3(input.endEast)}</td>
            </tr>
          )}
        </tbody>
      </table>
      <p className="report-footnote">
        {referenceLabel
          ? `Azimut de partida ${start} → ${referenceLabel}: ${formatAngle(startAz, angleFormat)}, ${reference ? "calculado de las coordenadas" : "dado en campo"}.`
          : `Sin 0 atrás: azimut del primer lado ${formatAngle(startAz, angleFormat)}.`}
        {input.type === "open_controlled" && endAz != null && ` Azimut de llegada: ${formatAngle(endAz, angleFormat)}.`}
      </p>

      <h4>Mediciones</h4>
      <table className="report-table">
        <thead>
          <tr>
            <th>Lado</th>
            <th className="num">Ángulo medido</th>
            <th className="num">Distancia (m)</th>
          </tr>
        </thead>
        <tbody>
          {rows
            .filter((r) => r.role !== "pending" && r.role !== "arrival")
            .map((r) => (
              <tr key={`${r.stationIndex ?? "ref"}-${r.role}`}>
                <td>{sideLabel(r)}</td>
                <td className="num">
                  {formatAngle(r.angle, angleFormat)}
                  {r.deflectionDirection && r.angle !== null && ` ${DEFLECTION_DIRECTION_LABELS[r.deflectionDirection].toLowerCase()}`}
                </td>
                <td className="num">{m3(r.distance)}</td>
              </tr>
            ))}
        </tbody>
      </table>

      {count !== null && result.angularError !== null && (
        <>
          <h4>Cierre angular</h4>
          {input.type === "closed" ? (
            <Pairs
              items={[
                ["Vértices", vertices],
                ["Ángulos en la condición", count],
                ["Suma observada", formatAngle(result.angleSum, angleFormat)],
                [theoreticalLabel(vertices, angleType, result.theoreticalSum), formatAngle(result.theoreticalSum, angleFormat)],
                ["Error angular", formatSeconds(result.angularError)],
                [
                  `Tolerancia de ${PRECISION_ORDER_LABELS[toleranceOrder].toLowerCase()}, ${ANGULAR_TOLERANCE_K[toleranceOrder]}″·√${count}`,
                  `${angularTolerance(toleranceOrder, count).toFixed(1)}″`,
                ],
              ]}
            />
          ) : (
            <Pairs
              items={[
                ["Deflexiones en la condición", count],
                ["Error contra el azimut de llegada", formatSeconds(result.angularError)],
                [
                  `Tolerancia de ${PRECISION_ORDER_LABELS[toleranceOrder].toLowerCase()}, ${ANGULAR_TOLERANCE_K[toleranceOrder]}″·√${count}`,
                  `${angularTolerance(toleranceOrder, count).toFixed(1)}″`,
                ],
              ]}
            />
          )}
        </>
      )}

      {calculated && data.breakdown && (
        <PolygonalCorrection
          number={3}
          input={input}
          result={result}
          breakdown={data.breakdown}
          rows={rows}
          angleFormat={angleFormat}
          referenceLabel={referenceLabel}
        />
      )}

      {calculated && (
        <>
          <h3>{uncontrolled ? "3. Coordenadas encadenadas" : "4. Poligonal ajustada"}</h3>
          <table className="report-table">
            <thead>
              <tr>
                <th>Lado</th>
                <th className="num">{uncontrolled ? "Ángulo" : "Ángulo corregido"}</th>
                <th className="num">Azimut</th>
                <th className="num">Dist. (m)</th>
                <th className="num">ΔN</th>
                <th className="num">ΔE</th>
                {!uncontrolled && (
                  <>
                    <th className="num">ΔN corr.</th>
                    <th className="num">ΔE corr.</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {adjusted.rows.map((r) => (
                <tr key={r.key}>
                  <td>
                    {r.from} → {r.to}
                  </td>
                  <td className="num">{formatAngle(r.correctedAngle, angleFormat)}</td>
                  <td className="num">{formatAngle(r.azimuth, angleFormat)}</td>
                  <td className="num">{r.distance == null ? "—" : r.distance.toFixed(3)}</td>
                  <td className="num">{r.deltaN == null ? "" : r.deltaN.toFixed(3)}</td>
                  <td className="num">{r.deltaE == null ? "" : r.deltaE.toFixed(3)}</td>
                  {!uncontrolled && (
                    <>
                      <td className="num">{r.correctedN == null ? "" : r.correctedN.toFixed(3)}</td>
                      <td className="num">{r.correctedE == null ? "" : r.correctedE.toFixed(3)}</td>
                    </>
                  )}
                </tr>
              ))}
              <tr className="report-sum">
                <td>Σ</td>
                <td />
                <td />
                <td className="num">{adjusted.sum.distance.toFixed(3)}</td>
                <td className="num">{signed3(adjusted.sum.deltaN)}</td>
                <td className="num">{signed3(adjusted.sum.deltaE)}</td>
                {!uncontrolled && (
                  <>
                    <td className="num">{signed3(adjusted.sum.correctedN)}</td>
                    <td className="num">{signed3(adjusted.sum.correctedE)}</td>
                  </>
                )}
              </tr>
            </tbody>
          </table>
          {closes && closingRow && (
            <p className="report-footnote">
              El último azimut vuelve a {formatAngle(closingRow.azimuth, angleFormat)}, el{" "}
              {input.hasClosingRow ? "de partida" : "del primer lado"}: el cierre angular cuadra.
            </p>
          )}

          <h3>{uncontrolled ? "4. Coordenadas" : "5. Coordenadas"}</h3>
          {georef && <p className="report-note">Coordenadas georreferenciadas {georef}.</p>}
          <table className="report-table">
            <thead>
              <tr>
                <th>Punto</th>
                <th className="num">Norte (m)</th>
                <th className="num">Este (m)</th>
              </tr>
            </thead>
            <tbody>
              {points.map((s, i) => (
                <tr key={i}>
                  <td>{s.pointCode}</td>
                  <td className="num">{m3(s.north)}</td>
                  <td className="num">{m3(s.east)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="report-plot">
            <PolygonalPlot input={input} result={result} reference={reference} />
          </div>
        </>
      )}
    </>
  );
}
