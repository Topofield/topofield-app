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
import type { LevelingResult, RunType } from "@/types/leveling";
import { levelingProfile, type ProfileRun } from "./profile-data";

const HEIGHT = 420;
const MARGIN = { top: 24, right: 30, bottom: 52, left: 56 };
const BACK = "var(--color-mira-strong)";
const FORE = "var(--color-ink)";
const LEVEL = "var(--color-ink-2)";
const SIGHT = "var(--color-rule-strong)";
const OTHER = "var(--color-success)";
/** La contraparte —la vuelta al mirar la ida y al revés— se dibuja tenue. */
const OTHER_OPACITY = 0.38;

const RUN_NAME: Record<RunType, string> = { forward: "ida", return: "vuelta" };

/** Decimales de un rótulo del eje, según el paso entre marcas. */
function tickText(value: number, step: number): string {
  const decimals = step >= 1 ? 0 : Math.min(4, Math.ceil(-Math.log10(step) - 1e-9));
  return value.toFixed(decimals);
}

/**
 * El perfil de la libreta (Fase 36, libreta B): sin compensar, la cota de cada
 * punto frente a la distancia y, por cada armada, la mira atrás (V+), la visual
 * a la altura del instrumento con el nivel y la mira adelante (V−). Con vuelta,
 * las armadas del otro recorrido van tenues. La exageración vertical, arriba.
 */
export function LevelingProfile({
  result,
  run,
  hasReturn,
}: {
  result: LevelingResult;
  run: RunType;
  hasReturn: boolean;
}) {
  const { ref, width } = useContainerWidth();
  const data = levelingProfile(result, run);
  const other: RunType = run === "forward" ? "return" : "forward";
  const title = (
    <h2 className="text-lg font-semibold">
      Perfil de la {RUN_NAME[run]}
      {hasReturn && data?.other && <span className="font-normal text-ink-2"> · la {RUN_NAME[other]}, tenue</span>}
    </h2>
  );

  if (!data || data.active.armadas.length === 0) {
    return (
      <section className="rounded-lg border border-rule bg-card shadow-sm">
        <header className="border-b border-rule px-6 py-4">{title}</header>
        <p className="px-6 py-10 text-center text-sm text-ink-2">El perfil se dibuja con cada armada.</p>
      </section>
    );
  }

  const W = width ?? FALLBACK_WIDTH;
  const plotW = W - MARGIN.left - MARGIN.right;
  const plotH = HEIGHT - MARGIN.top - MARGIN.bottom;
  const runs = [data.active, ...(data.other ? [data.other] : [])];
  const zs = runs.flatMap((r) => [...r.points.map((p) => p.elevation), ...r.armadas.map((a) => a.instrumentHeight)]);
  const yTicks = niceTicks(Math.min(...zs), Math.max(...zs), Math.max(3, Math.round(plotH / 60)));
  const yMin = yTicks[0]!;
  const yMax = yTicks[yTicks.length - 1]!;
  const yStep = yTicks.length > 1 ? Math.abs(yTicks[1]! - yTicks[0]!) : 1;
  const yScale = linearScale([yMin, yMax], [plotH, 0]);
  const xTicks = niceTicks(0, data.lengthM, Math.max(2, Math.floor(plotW / 90))).filter((d) => d >= 0 && d <= data.lengthM);
  const xStep = xTicks.length > 1 ? Math.abs(xTicks[1]! - xTicks[0]!) : 1;
  const xScale = linearScale([0, data.lengthM], [0, plotW]);
  // Píxeles por metro en vertical frente a horizontal.
  const exaggeration = yMax > yMin ? plotH / (yMax - yMin) / (plotW / data.lengthM) : 1;

  const main = data.active.points.filter((p) => p.type !== "intermediate");
  const labelled = plotW / Math.max(1, main.length) >= 24;
  const first = main[0];
  const last = main.at(-1);
  const ariaLabel =
    `Perfil de la ${RUN_NAME[run]} sin compensar: ${data.active.armadas.length} armadas dibujadas como miras y visuales` +
    (first && last
      ? `, de ${first.code} (${first.elevation.toFixed(4)} m) a ${last.code} (${last.elevation.toFixed(4)} m) en ${data.lengthM.toFixed(1)} m`
      : "") +
    (data.other ? `, con las armadas de la ${RUN_NAME[other]} en tenue.` : ".");

  const drawRun = (r: ProfileRun, faint: boolean) => {
    const back = faint ? OTHER : BACK;
    const fore = faint ? OTHER : FORE;
    const level = faint ? OTHER : LEVEL;
    const line = r.points
      .filter((p) => p.type !== "intermediate")
      .map((p) => `${xScale(p.x)},${yScale(p.elevation)}`)
      .join(" ");
    return (
      <g opacity={faint ? OTHER_OPACITY : 1}>
        {r.armadas.map((a, i) => {
          const ai = yScale(a.instrumentHeight);
          const xi = xScale(a.instrumentX);
          return (
            <g key={i}>
              <line
                x1={xScale(a.backX)}
                x2={a.foreX != null ? xScale(a.foreX) : xi}
                y1={ai}
                y2={ai}
                stroke={faint ? OTHER : SIGHT}
                strokeWidth={1}
                strokeDasharray="3 3"
              />
              <line x1={xScale(a.backX)} x2={xScale(a.backX)} y1={yScale(a.backElevation)} y2={ai} stroke={back} strokeWidth={2.2} />
              {a.foreX != null && a.foreElevation != null && (
                <line x1={xScale(a.foreX)} x2={xScale(a.foreX)} y1={yScale(a.foreElevation)} y2={ai} stroke={fore} strokeWidth={2.2} />
              )}
              <path d={`M${xi - 4} ${ai + 6}L${xi} ${ai - 1}L${xi + 4} ${ai + 6}z`} fill={level} />
            </g>
          );
        })}
        <polyline points={line} fill="none" stroke={fore} strokeWidth={2} strokeLinejoin="round" />
        {r.points.map((p, i) =>
          p.type === "intermediate" ? (
            <circle key={i} cx={xScale(p.x)} cy={yScale(p.elevation)} r={3} className="fill-card" stroke={level} strokeWidth={1.5} />
          ) : (
            <circle key={i} cx={xScale(p.x)} cy={yScale(p.elevation)} r={3.5} fill={fore} />
          ),
        )}
      </g>
    );
  };

  return (
    <section className="rounded-lg border border-rule bg-card shadow-sm">
      <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-rule px-6 py-4">
        {title}
        <span className="text-sm text-ink-2 tabular-nums">Exageración vertical ×{Math.max(1, Math.round(exaggeration))}</span>
      </header>
      <div ref={ref} className="flex min-w-0 flex-col gap-3 px-4 py-4">
        <ChartSvg width={W} height={HEIGHT} ariaLabel={ariaLabel}>
          <g transform={`translate(${MARGIN.left},${MARGIN.top})`}>
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
            {data.other && drawRun(data.other, true)}
            {drawRun(data.active, false)}
            {labelled &&
              main.map((p, i) => (
                <text
                  key={i}
                  x={xScale(p.x) + 6}
                  y={yScale(p.elevation) + 14}
                  fontSize={FONT_SIZE}
                  fontWeight={600}
                  className="fill-ink"
                >
                  {p.code}
                </text>
              ))}
          </g>
        </ChartSvg>
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-2">
          <li>
            <span className="font-bold text-mira-strong">|</span> V+ (atrás)
          </li>
          <li>
            <span className="font-bold text-ink">|</span> V− (adelante)
          </li>
          <li>
            <span className="text-ink-2">▲</span> nivel, a la altura del instrumento
          </li>
          {data.other && (
            <li>
              <span className="font-bold text-success opacity-60">| ▲</span> armadas de la {RUN_NAME[other]}
            </li>
          )}
          <li>Sin compensar.</li>
        </ul>
        <DataTableDetails caption={`Perfil de la ${RUN_NAME[run]}: distancia y cota sin compensar de cada punto.`}>
          <thead>
            <tr className={TABLE_HEAD_ROW}>
              <th className={TABLE_TH}>Punto</th>
              <th className={TABLE_TH}>Distancia (m)</th>
              <th className={TABLE_TH}>Cota (m)</th>
            </tr>
          </thead>
          <tbody>
            {data.active.points.map((p, i) => (
              <tr key={i} className={TABLE_ROW}>
                <td className={TABLE_TD}>{p.code}</td>
                <td className={TABLE_TD}>{p.x.toFixed(1)}</td>
                <td className={TABLE_TD}>{p.elevation.toFixed(4)}</td>
              </tr>
            ))}
          </tbody>
        </DataTableDetails>
      </div>
    </section>
  );
}
