"use client";

import { linearScale, niceTicks } from "@/lib/design/chart-scale";
import {
  ChartSvg,
  DataTableDetails,
  FALLBACK_WIDTH,
  FONT_SIZE,
  Marker,
  TABLE_HEAD_ROW,
  TABLE_ROW,
  TABLE_TD,
  TABLE_TH,
  XAxis,
  useContainerWidth,
} from "@/components/settlement/charts/chart-parts";
import { POINT_TYPE_LABELS, type LevelingResult } from "@/types/leveling";
import { levelingProfile, type ProfilePoint } from "./profile-data";

const HEIGHT = 280;
const MARGIN = { top: 16, right: 20, bottom: 52, left: 76 };
const IDA = "var(--color-ink)";
const VUELTA = "var(--color-mira-strong)";

/** Decimales de un rótulo del eje, según el paso entre marcas. */
function tickText(value: number, step: number): string {
  const decimals = step >= 1 ? 0 : Math.min(4, Math.ceil(-Math.log10(step) - 1e-9));
  return value.toFixed(decimals);
}

/**
 * Perfil de la nivelación (Fase 22): cota frente a distancia acumulada. La
 * ida con su cota corregida; la vuelta, si la hay, con su cota calculada y
 * sobre el mismo eje. Los puntos de cambio y los BMs forman la línea; las
 * vistas intermedias van como anillos sueltos.
 */
export function LevelingProfile({
  result,
  reconstructed,
}: {
  result: LevelingResult;
  reconstructed: boolean;
}) {
  const { ref, width } = useContainerWidth();
  const W = width ?? FALLBACK_WIDTH;
  const plotW = W - MARGIN.left - MARGIN.right;
  const plotH = HEIGHT - MARGIN.top - MARGIN.bottom;

  const data = levelingProfile(result, { reconstructed });
  const todos = [...data.forward, ...(data.back ?? [])];
  if (data.forward.length < 2 || data.totalM <= 0) {
    return (
      <p className="text-sm text-ink-2">
        El perfil se dibuja cuando la libreta tiene al menos dos puntos con distancia.
      </p>
    );
  }

  const zs = todos.map((p) => p.elevation);
  const yTicks = niceTicks(Math.min(...zs), Math.max(...zs), Math.max(3, Math.round(plotH / 50)));
  const yStep = yTicks.length > 1 ? Math.abs(yTicks[1]! - yTicks[0]!) : 1;
  const yScale = linearScale([yTicks[0]!, yTicks[yTicks.length - 1]!], [plotH, 0]);
  const xTicks = niceTicks(0, data.totalM, Math.max(2, Math.floor(plotW / 90))).filter(
    (d) => d >= 0 && d <= data.totalM,
  );
  const xStep = xTicks.length > 1 ? Math.abs(xTicks[1]! - xTicks[0]!) : 1;
  const xScale = linearScale([0, data.totalM], [0, plotW]);

  const linea = (serie: ProfilePoint[]) =>
    serie
      .filter((p) => p.type !== "intermediate")
      .map((p) => `${xScale(p.distanceM)},${yScale(p.elevation)}`)
      .join(" ");

  const series = [
    { key: "ida", nombre: "Ida (cota corregida)", color: IDA, puntos: data.forward },
    ...(data.back ? [{ key: "vuelta", nombre: "Vuelta (cota calculada)", color: VUELTA, puntos: data.back }] : []),
  ];

  const primero = data.forward[0]!;
  const ultimo = data.forward[data.forward.length - 1]!;
  const ariaLabel =
    `Perfil de la nivelación: cota frente a distancia acumulada, ${data.forward.length} puntos de ida` +
    (data.back ? ` y ${data.back.length} de vuelta` : "") +
    `, de ${primero.code} (${primero.elevation.toFixed(4)} m) a ${ultimo.code} (${ultimo.elevation.toFixed(4)} m) en ${data.totalM.toFixed(1)} m.`;

  return (
    <div ref={ref} className="flex min-w-0 flex-col gap-3">
      <ChartSvg width={W} height={HEIGHT} ariaLabel={ariaLabel}>
        <g transform={`translate(${MARGIN.left},${MARGIN.top})`}>
          {yTicks.map((tick) => (
            <g key={tick}>
              <line x1={0} x2={plotW} y1={yScale(tick)} y2={yScale(tick)} className="stroke-rule" strokeWidth={1} />
              <text
                x={-8}
                y={yScale(tick)}
                textAnchor="end"
                dominantBaseline="middle"
                fontSize={FONT_SIZE}
                className="fill-ink-3"
              >
                {tickText(tick, yStep)}
              </text>
            </g>
          ))}
          <text
            transform={`translate(${-MARGIN.left + 14},${plotH / 2}) rotate(-90)`}
            textAnchor="middle"
            fontSize={FONT_SIZE}
            className="fill-ink-3"
          >
            Cota (m)
          </text>
          <XAxis
            ticks={xTicks.map((d) => ({ x: xScale(d), label: tickText(d, xStep) }))}
            plotWidth={plotW}
            plotHeight={plotH}
            title="Distancia acumulada (m)"
          />
          {series.map((s) => (
            <g key={s.key}>
              <polyline
                fill="none"
                stroke={s.color}
                strokeWidth={s.key === "ida" ? 2 : 1.5}
                strokeDasharray={s.key === "vuelta" ? "6 4" : undefined}
                points={linea(s.puntos)}
              />
              {s.puntos.map((p, i) => (
                <Marker
                  key={`${s.key}-${i}`}
                  shape={p.type === "intermediate" ? "ring" : s.key === "ida" ? "circle" : "square"}
                  cx={xScale(p.distanceM)}
                  cy={yScale(p.elevation)}
                  r={p.type === "intermediate" ? 4 : 3.5}
                  color={s.color}
                />
              ))}
            </g>
          ))}
        </g>
      </ChartSvg>

      <ul className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-ink-2">
        {series.map((s) => (
          <li key={s.key} className="flex items-center gap-1.5">
            <svg width={22} height={10} aria-hidden>
              <line
                x1={0}
                x2={22}
                y1={5}
                y2={5}
                stroke={s.color}
                strokeWidth={2}
                strokeDasharray={s.key === "vuelta" ? "6 4" : undefined}
              />
            </svg>
            {s.nombre}
          </li>
        ))}
        {todos.some((p) => p.type === "intermediate") && (
          <li className="flex items-center gap-1.5">
            <svg width={10} height={10} aria-hidden>
              <Marker shape="ring" cx={5} cy={5} r={4} color={IDA} />
            </svg>
            Vista intermedia
          </li>
        )}
      </ul>

      <DataTableDetails caption="Perfil de la nivelación: distancia acumulada y cota de cada punto.">
        <thead>
          <tr className={TABLE_HEAD_ROW}>
            <th className={TABLE_TH}>Recorrido</th>
            <th className={TABLE_TH}>Punto</th>
            <th className={TABLE_TH}>Tipo</th>
            <th className={TABLE_TH}>Distancia (m)</th>
            <th className={TABLE_TH}>Cota (m)</th>
          </tr>
        </thead>
        <tbody>
          {series.flatMap((s) =>
            s.puntos.map((p, i) => (
              <tr key={`${s.key}-${i}`} className={TABLE_ROW}>
                <td className={TABLE_TD}>{s.key === "ida" ? "Ida" : "Vuelta"}</td>
                <td className={TABLE_TD}>{p.code}</td>
                <td className={TABLE_TD}>{POINT_TYPE_LABELS[p.type]}</td>
                <td className={TABLE_TD}>{p.distanceM.toFixed(1)}</td>
                <td className={TABLE_TD}>{p.elevation.toFixed(4)}</td>
              </tr>
            )),
          )}
        </tbody>
      </DataTableDetails>
    </div>
  );
}
