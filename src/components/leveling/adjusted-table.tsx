import { Badge } from "@/components/design-system";
import { formatSignedMm } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";
import type { CompensationRow } from "./comparison-data";

const TH = "py-2 px-2 text-right text-xs font-medium whitespace-nowrap";
const TD = "py-2 px-2 text-right whitespace-nowrap tabular-nums";
const GROUP = "border-l border-rule";
const dash = <span className="text-ink-3">—</span>;
const elevation = (v: number | null | undefined) => (v == null ? dash : v.toFixed(4));
const signed = (v: number | null | undefined, decimals: number) => (v == null ? dash : formatSignedMm(v, decimals));

/**
 * La tabla de la compensación (Fase 36): con vuelta, la cota de la ida y la de
 * la vuelta de cada punto, su diferencia, la corrección de cada recorrido y la
 * cota ajustada; sin vuelta, la cota medida, la corrección y la ajustada. Un
 * punto que se lee dos veces —el BM de una cerrada— va en sus dos filas.
 */
export function AdjustedTable({ rows, withReturn }: { rows: CompensationRow[]; withReturn: boolean }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-rule text-ink-2">
            <th scope="col" className={cn(TH, "text-left")}>
              Punto
            </th>
            <th scope="col" className={TH}>
              Dist. acum. (m)
            </th>
            {withReturn ? (
              <>
                <th scope="col" className={cn(TH, GROUP)}>
                  Cota ida
                </th>
                <th scope="col" className={TH}>
                  Cota vuelta
                </th>
                <th scope="col" className={TH}>
                  Vuelta − ida (mm)
                </th>
                <th scope="col" className={cn(TH, GROUP)}>
                  Corr. ida (mm)
                </th>
                <th scope="col" className={TH}>
                  Corr. vuelta (mm)
                </th>
              </>
            ) : (
              <>
                <th scope="col" className={cn(TH, GROUP)}>
                  Cota medida
                </th>
                <th scope="col" className={TH}>
                  Corrección (mm)
                </th>
              </>
            )}
            <th scope="col" className={cn(TH, GROUP)}>
              Cota ajustada
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-rule last:border-b-0">
              <td className="py-2 px-2 font-semibold whitespace-nowrap">{r.code}</td>
              <td className={TD}>{r.distanceM == null ? dash : r.distanceM.toFixed(1)}</td>
              {withReturn ? (
                <>
                  <td className={cn(TD, GROUP)}>{elevation(r.forward?.elevation)}</td>
                  <td className={TD}>{elevation(r.back?.elevation)}</td>
                  <td className={TD}>{signed(r.diffMm, 1)}</td>
                  <td className={cn(TD, GROUP)}>{signed(r.forward?.correctionMm, 2)}</td>
                  <td className={TD}>{signed(r.back?.correctionMm, 2)}</td>
                </>
              ) : (
                <>
                  <td className={cn(TD, GROUP)}>{elevation(r.forward?.elevation)}</td>
                  <td className={TD}>{signed(r.forward?.correctionMm, 2)}</td>
                </>
              )}
              <td className={cn(TD, GROUP, "font-semibold")}>
                {elevation(r.adjusted)}
                {r.known && (
                  <Badge tone="primary" className="ml-1.5">
                    BM
                  </Badge>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
