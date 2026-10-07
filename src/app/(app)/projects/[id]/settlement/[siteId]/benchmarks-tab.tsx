import { Card } from "@/components/design-system";
import { formatElevation } from "@/lib/utils/format";
import type { getSiteBenchmarks } from "@/lib/supabase/queries";

/**
 * Pestaña BMs del lugar (Fase 37, decisión 12): los BM desde donde se arman
 * las visitas. Son del lugar y no se sincronizan con nada.
 */
export function BenchmarksTab({ benchmarks }: { benchmarks: Awaited<ReturnType<typeof getSiteBenchmarks>> }) {
  return (
    <Card
      title="BM del lugar"
      description="Los puntos de cota conocida desde donde se arman las visitas. Son de este lugar: no se sincronizan con nada."
    >
      {benchmarks.length === 0 ? (
        <p className="text-sm text-ink-2">Este lugar todavía no tiene BM.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-rule text-left text-xs text-ink-2">
                <th className="py-2 pr-3 font-medium">Código</th>
                <th className="py-2 pr-3 text-right font-medium">Cota (m)</th>
                <th className="py-2 pr-3 font-medium">Descripción</th>
                <th className="py-2 pr-3 font-medium">Origen</th>
              </tr>
            </thead>
            <tbody>
              {benchmarks.map((b) => (
                <tr key={b.id} className="border-b border-rule last:border-0">
                  <td className="py-2 pr-3 font-medium">{b.code}</td>
                  <td className="py-2 pr-3 text-right font-mono tabular-nums">{formatElevation(b.elevation)}</td>
                  <td className="py-2 pr-3 text-ink-2">{b.description ?? "—"}</td>
                  <td className="py-2 pr-3 text-ink-2">{b.source ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
