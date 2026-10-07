import type { ReactNode } from "react";
import { ComparisonChart } from "@/components/leveling/comparison-chart";
import { comparisonData, compensationRows, pointReadings } from "@/components/leveling/comparison-data";
import { formatReading, libretaBlocker, readingDecimals } from "@/components/leveling/libreta-rows";
import { levelingOrderChecks } from "@/components/leveling/order-verdict";
import { formatEquipmentLine, formatSignedMm } from "@/lib/utils/format";
import type { LevelingSectionData } from "@/lib/reports/sections";
import { levelingTypeLabel, type ComputedReading, type LevelingType } from "@/types/leveling";
import { PRECISION_ORDER_LABELS } from "@/types/project";

const z4 = (v: number | null | undefined) => (v == null || !Number.isFinite(v) ? "—" : v.toFixed(4));
const meters = (km: number) => `${(km * 1000).toFixed(1)} m`;

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

function Kpi({ label, value, ok }: { label: string; value: string; ok?: boolean }) {
  return (
    <div className={ok ? "report-kpi report-kpi-ok" : "report-kpi"}>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

/** Lo que se juzga, con artículo: «La discrepancia», «El error de cierre»… */
function judgedNoun(type: LevelingType, withReturn: boolean): string {
  if (type === "open") return "La discrepancia";
  return withReturn ? "El cierre de los dos recorridos" : "El error de cierre";
}

/**
 * El veredicto del informe (Fase 36): el orden alcanzado y por qué no el de
 * arriba; la alerta si no alcanza ninguno; o por qué no hay verificación.
 */
function Verdict({ data }: { data: LevelingSectionData }) {
  const { input, result, order, verifiable, pending, broken } = data;
  if (broken) {
    return (
      <p className="report-alert">
        La libreta no encadena. {libretaBlocker(result)}
      </p>
    );
  }
  if (pending) {
    return (
      <p className="report-text">
        <strong>Libreta a medias.</strong> La compensación se calcula cuando la libreta llega a su BM: el informe
        muestra lo medido.
      </p>
    );
  }
  if (!verifiable) {
    return (
      <p className="report-text">
        <strong>Sin verificación.</strong> Sin vuelta ni BM de llegada no hay contra qué comprobar la nivelación: las
        cotas son las medidas.
      </p>
    );
  }
  if (!order) {
    return (
      <p className="report-alert">
        No alcanza ningún orden. La compensación se aplicó igual; en la práctica, un trabajo fuera de tolerancia se
        repite.
      </p>
    );
  }
  const checks = levelingOrderChecks(result, input.type);
  const reached = checks.findIndex((c) => c.reached);
  const above = reached > 0 ? checks[reached - 1] : undefined;
  const noun = judgedNoun(input.type, result.return != null);
  const label = PRECISION_ORDER_LABELS[order].toLowerCase();
  return (
    <p className="report-verdict">
      <strong>Alcanza {label}.</strong>{" "}
      {above
        ? `${noun} cabe en la tolerancia de ${label}, no en la de ${PRECISION_ORDER_LABELS[above.order].toLowerCase()} (${above.tolerancesMm
            .map((t) => t.toFixed(1))
            .join(" · ")} mm).`
        : `${noun} cabe en la tolerancia más exigente.`}
    </p>
  );
}

/** Las cifras del resultado: el error o la discrepancia, la tolerancia del orden y el orden. */
function Figures({ data }: { data: LevelingSectionData }) {
  const { input, result, order } = data;
  const checks = levelingOrderChecks(result, input.type);
  if (checks.length === 0) return null;
  const shown = checks.find((c) => c.reached) ?? checks.at(-1)!;
  const error =
    input.type === "open"
      ? ["Discrepancia ida − vuelta", `${(result.discrepancyMm ?? 0).toFixed(1)} mm`]
      : [
          input.type === "link" ? "Error de llegada" : "Error de cierre",
          `${[result.closureErrorMm, ...(result.return ? [result.return.errorMm] : [])].map((e) => formatSignedMm(e)).join(" · ")} mm`,
        ];
  return (
    <dl className="report-kpis">
      <Kpi label={error[0]!} value={error[1]!} />
      <Kpi
        label={`Tolerancia ${order ? `de ${PRECISION_ORDER_LABELS[order].toLowerCase()}` : "del ordinario"}`}
        value={`${shown.tolerancesMm.map((t) => t.toFixed(1)).join(" · ")} mm`}
      />
      <Kpi label="Orden alcanzado" value={order ? PRECISION_ORDER_LABELS[order] : "Ninguno"} ok={order !== null} />
    </dl>
  );
}

/** Una libreta como datos iniciales: V+, V− (o la vista intermedia), distancia acumulada y cota medida. */
function RunTable({ readings, caption }: { readings: ComputedReading[]; caption?: string }) {
  const decimals = readingDecimals(readings.flatMap((r) => [r.backsight, r.foresight]));
  return (
    <table className="report-table">
      {caption && <caption>{caption}</caption>}
      <thead>
        <tr>
          <th>Punto</th>
          <th className="num">V+</th>
          <th className="num">V−</th>
          <th className="num">Dist. acum. (m)</th>
          <th className="num">Cota medida</th>
        </tr>
      </thead>
      <tbody>
        {readings.map((r, i) => {
          const mid = r.pointType === "intermediate";
          return (
            <tr key={i}>
              <td>{r.pointCode}</td>
              <td className="num">{mid || r.backsight == null ? "" : formatReading(r.backsight, decimals)}</td>
              <td className="num">{r.foresight == null ? "" : `${mid ? "VI " : ""}${formatReading(r.foresight, decimals)}`}</td>
              <td className="num">{r.distanceAccumulatedKm == null ? "—" : (r.distanceAccumulatedKm * 1000).toFixed(1)}</td>
              <td className="num">{z4(r.elevationCalculated)}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

/** El método en una frase, con el error que se repartió. */
function methodSentence(data: LevelingSectionData, repeats: boolean): string {
  const { input, result, process } = data;
  const start = process.start_bm_code;
  const head = "Corrección proporcional a la distancia:";
  if (input.type === "open") {
    return `${head} el cierre del circuito ida + vuelta, ${formatSignedMm(result.circuitClosureMm)} mm, se repartió según la distancia recorrida hasta cada punto. La cota ajustada es el promedio de la ida y la vuelta corregidas; ${start} conserva su cota conocida.`;
  }
  const back = result.return
    ? " La vuelta se compensó con su propio cierre, y la cota ajustada es el promedio de las dos."
    : repeats
      ? " Los puntos leídos de ida y de regreso toman el promedio de sus dos cotas corregidas."
      : "";
  if (input.type === "link") {
    return `${head} el error de llegada a ${process.end_bm_code ?? "el BM de llegada"}, ${formatSignedMm(result.closureErrorMm)} mm, se repartió según la distancia recorrida hasta cada punto; los dos BM conservan su cota conocida.${back}`;
  }
  return `${head} el error de cierre, ${formatSignedMm(result.closureErrorMm)} mm, se repartió según la distancia recorrida hasta cada punto; ${start} conserva su cota conocida.${back}`;
}

function AdjustedTable({ data }: { data: LevelingSectionData }) {
  const { input, result } = data;
  if (result.return) {
    return (
      <table className="report-table">
        <thead>
          <tr>
            <th>Punto</th>
            <th className="num">Cota ida</th>
            <th className="num">Cota vuelta</th>
            <th className="num">Cota ajustada</th>
          </tr>
        </thead>
        <tbody>
          {compensationRows(result, input).map((r, i) => (
            <tr key={i}>
              <td>{r.code}</td>
              <td className="num">{z4(r.forward?.elevation)}</td>
              <td className="num">{z4(r.back?.elevation)}</td>
              <td className="num">{z4(r.adjusted)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }
  const points = pointReadings(result, input);
  if (points.some((p) => p.readings.length > 1)) {
    return (
      <table className="report-table">
        <thead>
          <tr>
            <th>Punto</th>
            <th className="num">1.ª lectura</th>
            <th className="num">2.ª lectura</th>
            <th className="num">Cota ajustada</th>
          </tr>
        </thead>
        <tbody>
          {points.map((p, i) => (
            <tr key={i}>
              <td>{p.code}</td>
              <td className="num">{z4(p.readings[0])}</td>
              <td className="num">{p.readings[1] == null ? "" : z4(p.readings[1])}</td>
              <td className="num">{z4(p.adjusted)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }
  return (
    <table className="report-table">
      <thead>
        <tr>
          <th>Punto</th>
          <th className="num">Cota medida</th>
          <th className="num">Corrección (mm)</th>
          <th className="num">Cota ajustada</th>
        </tr>
      </thead>
      <tbody>
        {compensationRows(result, input).map((r, i) => (
          <tr key={i}>
            <td>{r.code}</td>
            <td className="num">{z4(r.forward?.elevation)}</td>
            <td className="num">{r.forward ? formatSignedMm(r.forward.correctionMm, 2) : "—"}</td>
            <td className="num">{z4(r.adjusted)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function headerPairs(data: LevelingSectionData): [string, ReactNode][] {
  const { process, input, result } = data;
  const type = input.type;
  const responsible = [process.responsible_name, process.responsible_role].filter((v) => v && v.trim() !== "").join(" · ");
  const start = `${process.start_bm_code} · ${z4(input.startElevation)} m`;
  const last = result.forward.readings.at(-1)?.pointCode;
  const items: [string, ReactNode][] = [
    ...(process.location ? ([["Ubicación", process.location]] as [string, ReactNode][]) : []),
    ["Tipo", levelingTypeLabel(type, result.return != null)],
    ...(responsible ? ([["Responsable", responsible]] as [string, ReactNode][]) : []),
    [type === "closed" ? "BM de partida y llegada" : "BM de partida", start],
  ];
  if (type === "link") items.push(["BM de llegada", `${process.end_bm_code ?? "—"} · ${z4(input.endElevation)} m`]);
  if (type === "open" && last) items.push(["Termina en", `${last}, sin cota conocida`]);
  items.push([
    result.return ? "Distancia ida · vuelta" : "Distancia",
    result.return ? `${meters(result.forward.distanceKm)} · ${meters(result.return.distanceKm)}` : meters(result.forward.distanceKm),
  ]);
  items.push(["Equipo", formatEquipmentLine(process.equipment_brand, process.equipment_model, process.equipment_serial)]);
  return items;
}

/**
 * La sección de una nivelación en el informe (Fase 36, decisión 13): el
 * resumen con el veredicto, 1. Datos iniciales (la libreta), 2. Datos ajustados
 * —el método en una frase— y 3. el gráfico comparado. Una versión por tipo; la
 * abierta sin vuelta y la libreta a medias no tienen datos ajustados. Es la
 * misma en la pestaña Informe y en el consolidado.
 */
export function LevelingReportSection({ data }: { data: LevelingSectionData }) {
  const { input, result, pending, broken } = data;
  const compensated = !pending && !broken && result.compensated;
  const chart = compensated ? comparisonData(result, input) : null;
  const repeats = pointReadings(result, input).some((p) => p.readings.length > 1);
  return (
    <>
      <Pairs items={headerPairs(data)} />
      {compensated && <Figures data={data} />}
      <Verdict data={data} />

      <h3>1. Datos iniciales</h3>
      {result.return ? (
        <div className="report-columns">
          <RunTable readings={result.forward.readings} caption="Ida" />
          <RunTable readings={result.return.readings} caption="Vuelta" />
        </div>
      ) : (
        <RunTable readings={result.forward.readings} />
      )}

      {compensated && (
        <>
          <h3>2. Datos ajustados</h3>
          <p className="report-text">{methodSentence(data, repeats)}</p>
          <AdjustedTable data={data} />
        </>
      )}

      {chart && (
        <>
          <h3>3. {result.return ? "Ida, vuelta y ajustada" : "Medido y ajustada"}</h3>
          <div className="report-plot">
            <ComparisonChart data={chart} />
          </div>
        </>
      )}
    </>
  );
}

