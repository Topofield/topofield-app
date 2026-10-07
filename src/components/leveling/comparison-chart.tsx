"use client";

import { linearScale, niceTicks } from "@/lib/design/chart-scale";
import {
  ChartSvg,
  DataTableDetails,
  FALLBACK_WIDTH,
  FONT_SIZE,
  TABLE_HEAD_ROW,
  TABLE_ROW,
  TABLE_TD,
  TABLE_TH,
  XAxis,
  useContainerWidth,
} from "@/components/settlement/charts/chart-parts";
import { formatSignedMm } from "@/lib/utils/format";
import type { ComparisonData, SeriesPoint } from "./comparison-data";

const HEIGHT = 340;
const MARGIN = { top: 24, right: 24, bottom: 52, left: 56 };
const ADJUSTED = "var(--color-ink)";
const FORWARD = "var(--color-mira-strong)";
const BACK = "var(--color-success)";

/** Decimales de un rótulo del eje, según el paso entre marcas. */
function tickText(value: number, step: number): string {
  const decimals = step >= 1 ? 0 : Math.min(4, Math.ceil(-Math.log10(step) - 1e-9));
  return value.toFixed(decimals);
}

/** Dónde se dibuja un punto medido: la ajustada más la diferencia, con 1 mm como 1 m. */
const drawnY = (p: SeriesPoint) => p.adjusted + p.diffMm;

/**
 * El gráfico de la compensación (Fase 36, decisión 11): la cota ajustada a
 * escala y lo medido —la ida y, si la hay, la vuelta— separado de ella con la
 * diferencia exagerada ×1000. Las cifras son esa diferencia en mm, en los
 * extremos de cada serie.
 */
export function ComparisonChart({ data }: { data: ComparisonData }) {
  const { ref, width } = useContainerWidth();
  const W = width ?? FALLBACK_WIDTH;
  const plotW = W - MARGIN.left - MARGIN.right;
  const plotH = HEIGHT - MARGIN.top - MARGIN.bottom;
  const back = data.back;

  const ys = [
    ...data.adjusted.map((p) => p.elevation),
    ...data.forward.map(drawnY),
    ...(back ?? []).map(drawnY),
  ];
  const yTicks = niceTicks(Math.min(...ys), Math.max(...ys), Math.max(3, Math.round(plotH / 55)));
  const yStep = yTicks.length > 1 ? Math.abs(yTicks[1]! - yTicks[0]!) : 1;
  const yScale = linearScale([yTicks[0]!, yTicks[yTicks.length - 1]!], [plotH, 0]);
  const xTicks = niceTicks(0, data.lengthM, Math.max(2, Math.floor(plotW / 90))).filter((d) => d >= 0 && d <= data.lengthM);
  const xStep = xTicks.length > 1 ? Math.abs(xTicks[1]! - xTicks[0]!) : 1;
  const xScale = linearScale([0, data.lengthM], [0, plotW]);

  const line = (pts: { x: number; y: number }[]) => pts.map((p) => `${xScale(p.x)},${yScale(p.y)}`).join(" ");
  const first = data.adjusted[0];
  const last = data.adjusted.at(-1);
  const ariaLabel =
    `Cota ajustada${first && last ? ` de ${first.code} a ${last.code}` : ""}, con ${back ? "la ida y la vuelta medidas" : "la medida"} separadas de ella con la diferencia exagerada mil veces: ` +
    data.labels
      .map((l) => {
        const p = (l.series === "forward" ? data.forward : back!)[l.index]!;
        return `${l.series === "forward" ? (back ? "la ida" : "la medida") : "la vuelta"} ${formatSignedMm(p.diffMm)} mm en ${p.code}`;
      })
      .join(", ") +
    ".";

  return (
    <div ref={ref} className="flex min-w-0 flex-col gap-3">
      <ChartSvg width={W} height={HEIGHT} ariaLabel={ariaLabel}>
        <g transform={`translate(${MARGIN.left},${MARGIN.top})`}>
          <text x={0} y={-10} fontSize={FONT_SIZE} fontWeight={600} className="fill-ink">
            Cota (m)
          </text>
          {yTicks.map((tick) => (
            <g key={tick}>
              <line x1={0} x2={plotW} y1={yScale(tick)} y2={yScale(tick)} className="stroke-sel" strokeWidth={1} />
              <text x={-8} y={yScale(tick)} textAnchor="end" dominantBaseline="middle" fontSize={FONT_SIZE} className="fill-ink-3">
                {tickText(tick, yStep)}
              </text>
            </g>
          ))}
          <XAxis
            ticks={xTicks.map((d) => ({ x: xScale(d), label: tickText(d, xStep) }))}
            plotWidth={plotW}
            plotHeight={plotH}
            title="Distancia (m)"
          />
          {back && (
            <polyline
              points={line(back.map((p) => ({ x: p.x, y: drawnY(p) })))}
              fill="none"
              stroke={BACK}
              strokeWidth={2.2}
              strokeDasharray="6 4"
              strokeLinejoin="round"
            />
          )}
          <polyline
            points={line(data.forward.map((p) => ({ x: p.x, y: drawnY(p) })))}
            fill="none"
            stroke={FORWARD}
            strokeWidth={2.2}
            strokeLinejoin="round"
          />
          <polyline
            points={line(data.adjusted.map((p) => ({ x: p.x, y: p.elevation })))}
            fill="none"
            stroke={ADJUSTED}
            strokeWidth={2.4}
            strokeLinejoin="round"
          />
          {back?.map((p, i) => <circle key={`b${i}`} cx={xScale(p.x)} cy={yScale(drawnY(p))} r={3} fill={BACK} />)}
          {data.forward.map((p, i) => (
            <circle key={`f${i}`} cx={xScale(p.x)} cy={yScale(drawnY(p))} r={3} fill={FORWARD} />
          ))}
          {data.adjusted.map((p, i) =>
            p.known ? (
              <rect key={`a${i}`} x={xScale(p.x) - 6} y={yScale(p.elevation) - 6} width={12} height={12} fill={FORWARD} />
            ) : p.intermediate ? (
              <circle key={`a${i}`} cx={xScale(p.x)} cy={yScale(p.elevation)} r={3} className="fill-card" stroke="var(--color-ink-2)" strokeWidth={1.5} />
            ) : (
              <circle key={`a${i}`} cx={xScale(p.x)} cy={yScale(p.elevation)} r={3.2} fill={ADJUSTED} />
            ),
          )}
          {data.labels.map((l, i) => {
            const p = (l.series === "forward" ? data.forward : back!)[l.index]!;
            const y = yScale(drawnY(p));
            return (
              <text
                key={`l${i}`}
                x={Math.min(Math.max(xScale(p.x), 14), plotW - 14)}
                y={p.diffMm > 0 ? y - 9 : y + 18}
                textAnchor="middle"
                fontSize={FONT_SIZE}
                fontWeight={600}
                className={l.series === "forward" ? "fill-warning" : "fill-success"}
              >
                {formatSignedMm(p.diffMm)}
              </text>
            );
          })}
        </g>
      </ChartSvg>
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-2">
        <li>
          <span className="font-bold text-ink">—</span> Cota ajustada, la final
        </li>
        <li>
          <span className="font-bold text-mira-strong">—</span> {back ? "Ida medida" : "Medida"}
        </li>
        {back && (
          <li>
            <span className="font-bold text-success">- -</span> Vuelta medida
          </li>
        )}
      </ul>
      <p className="text-xs text-ink-2">
        La ajustada va a escala. {back ? "La ida y la vuelta se separan" : "La medida se separa"} de ella con la diferencia
        exagerada ×1000: 1 mm se dibuja como 1 m. Los números son esa diferencia en mm.
      </p>
      <DataTableDetails caption="Medido y ajustado: la diferencia de cada punto, en mm.">
        <thead>
          <tr className={TABLE_HEAD_ROW}>
            <th className={TABLE_TH}>Recorrido</th>
            <th className={TABLE_TH}>Punto</th>
            <th className={TABLE_TH}>Distancia (m)</th>
            <th className={TABLE_TH}>Cota ajustada</th>
            <th className={TABLE_TH}>Medida − ajustada (mm)</th>
          </tr>
        </thead>
        <tbody>
          {[
            ...data.forward.map((p) => ({ run: back ? "Ida" : "—", p })),
            ...(back ?? []).map((p) => ({ run: "Vuelta", p })),
          ].map(({ run, p }, i) => (
            <tr key={i} className={TABLE_ROW}>
              <td className={TABLE_TD}>{run}</td>
              <td className={TABLE_TD}>{p.code}</td>
              <td className={TABLE_TD}>{p.x.toFixed(1)}</td>
              <td className={TABLE_TD}>{p.adjusted.toFixed(4)}</td>
              <td className={TABLE_TD}>{formatSignedMm(p.diffMm)}</td>
            </tr>
          ))}
        </tbody>
      </DataTableDetails>
    </div>
  );
}
