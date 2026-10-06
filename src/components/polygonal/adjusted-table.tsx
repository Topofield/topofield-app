import { cn } from "@/lib/utils/cn";
import type { AngleInputFormat, PolygonalInput, PolygonalResult } from "@/types/polygonal";
import { formatAngle } from "./angle-format";
import { captureRows, type CaptureRole } from "./capture-rows";

export interface AdjustedRow {
  key: string;
  from: string;
  to: string;
  role: CaptureRole;
  correctedAngle: number | null;
  azimuth: number | null;
  distance: number | null;
  deltaN: number | null;
  deltaE: number | null;
  correctedN: number | null;
  correctedE: number | null;
  /** Coordenadas del punto al que llega el lado. */
  north: number | null;
  east: number | null;
}

export interface AdjustedSum {
  distance: number;
  deltaN: number;
  deltaE: number;
  correctedN: number;
  correctedE: number;
}

const num = (v: number | null | undefined): number | null => (v != null && Number.isFinite(v) ? v : null);

/**
 * Las filas de la poligonal ajustada, al estilo de la hoja (Fase 35): cada lado
 * «desde → hacia» con el ángulo corregido en el punto de partida, su azimut, la
 * distancia, las proyecciones crudas y corregidas, y las coordenadas del punto
 * al que llega. El cierre angular es una fila más, sin lado. La fila Σ suma los
 * lados: en las proyecciones, el error de cierre; en las corregidas, cero.
 */
export function adjustedRows(
  input: PolygonalInput,
  result: PolygonalResult,
  amarre: { start: string; reference: string | null },
): { rows: AdjustedRow[]; sum: AdjustedSum } {
  const rows: AdjustedRow[] = [];
  const sum: AdjustedSum = { distance: 0, deltaN: 0, deltaE: 0, correctedN: 0, correctedE: 0 };
  for (const row of captureRows(input, amarre)) {
    if (row.stationIndex === null || row.role === "pending") continue;
    const r = result.stations[row.stationIndex];
    const side = row.role !== "closing_angle";
    const correctedN = side ? num(r?.correctedDeltaNorth) : null;
    const correctedE = side ? num(r?.correctedDeltaEast) : null;
    const fromN = num(r?.north);
    const fromE = num(r?.east);
    const out: AdjustedRow = {
      key: `${row.stationIndex}-${row.role}`,
      from: row.from,
      to: row.to,
      role: row.role,
      correctedAngle: num(r?.correctedAngle),
      azimuth: num(r?.azimuth),
      distance: side ? row.distance : null,
      deltaN: side ? num(r?.deltaNorth) : null,
      deltaE: side ? num(r?.deltaEast) : null,
      correctedN,
      correctedE,
      north: fromN !== null && correctedN !== null ? fromN + correctedN : null,
      east: fromE !== null && correctedE !== null ? fromE + correctedE : null,
    };
    rows.push(out);
    if (side) {
      sum.distance += out.distance ?? 0;
      sum.deltaN += out.deltaN ?? 0;
      sum.deltaE += out.deltaE ?? 0;
      sum.correctedN += out.correctedN ?? 0;
      sum.correctedE += out.correctedE ?? 0;
    }
  }
  return { rows, sum };
}

const m3 = (v: number | null) => (v === null ? "" : v.toFixed(3));

/** La tabla de la poligonal ajustada, con desplazamiento horizontal en el teléfono. */
export function AdjustedTable({
  input,
  result,
  amarre,
  angleFormat,
  corrected,
}: {
  input: PolygonalInput;
  result: PolygonalResult;
  amarre: { start: string; reference: string | null };
  angleFormat: AngleInputFormat;
  /** Sin compensación (abierta sin control) no hay columnas corregidas. */
  corrected: boolean;
}) {
  const { rows, sum } = adjustedRows(input, result, amarre);
  const th = "whitespace-nowrap px-2.5 py-2 text-right text-xs font-medium text-ink-2";
  const td = "whitespace-nowrap px-2.5 py-2 text-right tabular-nums";
  const grp = "border-l border-rule";
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-rule">
            <th scope="col" className={cn(th, "text-left")}>
              Lado
            </th>
            <th scope="col" className={th}>
              {corrected ? "Ángulo corregido" : "Ángulo"}
            </th>
            <th scope="col" className={th}>
              Azimut
            </th>
            <th scope="col" className={th}>
              Dist. (m)
            </th>
            <th scope="col" className={cn(th, grp)}>
              Proy. N
            </th>
            <th scope="col" className={th}>
              Proy. E
            </th>
            {corrected && (
              <>
                <th scope="col" className={cn(th, grp)}>
                  Corregida N
                </th>
                <th scope="col" className={th}>
                  Corregida E
                </th>
              </>
            )}
            <th scope="col" className={cn(th, grp)}>
              Norte
            </th>
            <th scope="col" className={th}>
              Este
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key} className="border-b border-rule">
              <td className={cn(td, "text-left font-semibold")}>
                {r.from} → {r.to}
                {r.role === "closing_angle" && <span className="ml-1 font-normal text-ink-2">(cierre angular)</span>}
              </td>
              <td className={td}>{formatAngle(r.correctedAngle, angleFormat)}</td>
              <td className={td}>{formatAngle(r.azimuth, angleFormat)}</td>
              <td className={td}>{m3(r.distance)}</td>
              <td className={cn(td, grp)}>{m3(r.deltaN)}</td>
              <td className={td}>{m3(r.deltaE)}</td>
              {corrected && (
                <>
                  <td className={cn(td, grp)}>{m3(r.correctedN)}</td>
                  <td className={td}>{m3(r.correctedE)}</td>
                </>
              )}
              <td className={cn(td, grp)}>{m3(r.north)}</td>
              <td className={td}>{m3(r.east)}</td>
            </tr>
          ))}
          <tr className="bg-sel font-semibold">
            <td className={cn(td, "text-left")}>Σ</td>
            <td className={td} />
            <td className={td} />
            <td className={td}>{sum.distance.toFixed(3)}</td>
            <td className={cn(td, grp)}>{sum.deltaN.toFixed(3)}</td>
            <td className={td}>{sum.deltaE.toFixed(3)}</td>
            {corrected && (
              <>
                <td className={cn(td, grp)}>{Math.abs(sum.correctedN) < 5e-4 ? "0.000" : sum.correctedN.toFixed(3)}</td>
                <td className={td}>{Math.abs(sum.correctedE) < 5e-4 ? "0.000" : sum.correctedE.toFixed(3)}</td>
              </>
            )}
            <td className={cn(td, grp)} />
            <td className={td} />
          </tr>
        </tbody>
      </table>
    </div>
  );
}
