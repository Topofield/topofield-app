// El dibujo del hero de la página de presentación (Fase 45): la poligonal V10
// del proyecto de ejemplo, con sus lados, su dibujo y su cierre. Todo sale de
// `poligonalEjemplo()`, que pasa la cartera por el motor: aquí solo se pinta.

import { formatRotation } from "@/components/polygonal/georeference-plan";
import { decimalToDms } from "@/lib/calculations/angles";
import { plotFrame, scaleBarMeters } from "@/lib/design/polygonal-plot";
import type { PoligonalEjemplo } from "@/lib/landing/poligonal-ejemplo";
import { formatPrecision } from "@/lib/utils/format";
import { PRECISION_ORDER_LABELS } from "@/types/project";

// Unidades del viewBox. El dibujo es vertical porque la poligonal lo es.
const ANCHO = 260;
const ALTO = 330;
const MARGEN = 40;

/** Segundos entre el trazo de un lado y el del siguiente. */
const PASO = 0.32;
const ESPERA = 0.35;

const px = (v: number) => Math.round(v * 100) / 100;

function azimut(grados: number): string {
  const { deg, min, sec } = decimalToDms(grados);
  return formatRotation(deg, min, sec);
}

export function PoligonalHero({ poligonal }: { poligonal: PoligonalEjemplo }) {
  const { lados, vertices } = poligonal;
  const marco = plotFrame(vertices, ANCHO, ALTO, MARGEN);
  const puntos = vertices.map((v) => ({
    code: v.code,
    x: marco.toX(v.east),
    y: marco.toY(v.north),
  }));
  // El último repite el arranque: se dibuja su lado, no otro vértice.
  const unicos = puntos.slice(0, -1);
  const centro = {
    x: unicos.reduce((s, p) => s + p.x, 0) / unicos.length,
    y: unicos.reduce((s, p) => s + p.y, 0) / unicos.length,
  };

  const barraMetros = scaleBarMeters(marco.metersPerPixel, 70);
  const barraPx = barraMetros / marco.metersPerPixel;

  const cierre = [
    {
      nombre: "Error angular",
      valor: `${poligonal.errorAngular > 0 ? "+" : ""}${poligonal.errorAngular.toFixed(1)}″`,
    },
    { nombre: "Cierre lineal", valor: `${poligonal.errorLineal.toFixed(3)} m` },
    { nombre: "Precisión", valor: formatPrecision(poligonal.precision) },
  ];

  return (
    <figure className="m-0">
      <div className="overflow-hidden rounded-lg border border-rule bg-card shadow-sm">
        <div className="grid sm:grid-cols-[minmax(0,1fr)_minmax(0,15rem)]">
          <div className="min-w-0 p-5 sm:p-6">
            <p className="font-display text-lg font-semibold text-ink">
              Poligonal V10
            </p>
            <p className="text-sm text-ink-2">
              Cartera de campo, {lados.length} vértices
            </p>
            <table className="mt-4 w-full text-sm">
              <thead>
                <tr className="border-b border-rule text-left text-ink-2">
                  <th scope="col" className="py-2 pr-3 font-normal">
                    Lado
                  </th>
                  <th scope="col" className="py-2 pr-3 text-right font-normal">
                    Azimut
                  </th>
                  <th scope="col" className="py-2 text-right font-normal">
                    Dist. (m)
                  </th>
                </tr>
              </thead>
              <tbody>
                {lados.map((l) => (
                  <tr key={l.desde} className="border-b border-rule last:border-b-0">
                    <th scope="row" className="whitespace-nowrap py-2 pr-3 text-left font-medium">
                      {l.desde} → {l.hasta}
                    </th>
                    <td className="whitespace-nowrap py-2 pr-3 text-right">
                      {azimut(l.azimut)}
                    </td>
                    <td className="py-2 text-right">{l.distancia.toFixed(3)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center border-t border-rule p-3 sm:border-t-0 sm:border-l">
            <svg
              viewBox={`0 0 ${ANCHO} ${ALTO}`}
              role="img"
              aria-label={`Dibujo de la poligonal ajustada: ${unicos
                .map((p) => p.code)
                .join(", ")}, cerrada en ${unicos[0]?.code}`}
              className="mx-auto block h-auto w-full max-w-[16rem]"
            >
              {puntos.slice(0, -1).map((p, i) => {
                const q = puntos[i + 1]!;
                return (
                  <line
                    key={`lado-${i}`}
                    x1={px(p.x)}
                    y1={px(p.y)}
                    x2={px(q.x)}
                    y2={px(q.y)}
                    pathLength={1}
                    className="lado-trazado stroke-ink"
                    strokeWidth={2.25}
                    strokeLinecap="round"
                    style={{ animationDelay: `${ESPERA + i * PASO}s` }}
                  />
                );
              })}

              {unicos.map((p, i) => {
                // La etiqueta, hacia fuera del polígono.
                const dx = p.x - centro.x;
                const dy = p.y - centro.y;
                const d = Math.hypot(dx, dy) || 1;
                const tx = p.x + (dx / d) * 15;
                const ty = p.y + (dy / d) * 15;
                const ancla = dx / d > 0.35 ? "start" : dx / d < -0.35 ? "end" : "middle";
                return (
                  <g key={p.code}>
                    <circle
                      cx={px(p.x)}
                      cy={px(p.y)}
                      r={i === 0 ? 5 : 3.5}
                      className={i === 0 ? "fill-mira-strong stroke-card" : "fill-ink stroke-card"}
                      strokeWidth={1.5}
                    />
                    <text
                      x={px(tx)}
                      y={px(ty)}
                      textAnchor={ancla}
                      dominantBaseline="middle"
                      className="fill-ink text-[13px] font-medium"
                    >
                      {p.code}
                    </text>
                  </g>
                );
              })}

              {/* Norte y escala: sin ellos no es un plano. */}
              <g className="fill-ink-2 stroke-ink-2" aria-hidden="true">
                <path
                  d={`M ${ANCHO - 20} 30 L ${ANCHO - 20} 12 M ${ANCHO - 24} 18 L ${ANCHO - 20} 12 L ${ANCHO - 16} 18`}
                  fill="none"
                  strokeWidth={1.25}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <text
                  x={ANCHO - 20}
                  y={41}
                  textAnchor="middle"
                  stroke="none"
                  className="text-[11px]"
                >
                  N
                </text>
                <line
                  x1={12}
                  y1={ALTO - 12}
                  x2={px(12 + barraPx)}
                  y2={ALTO - 12}
                  strokeWidth={2}
                />
                <text x={12} y={ALTO - 18} stroke="none" className="text-[11px]">
                  {barraMetros} m
                </text>
              </g>
            </svg>
          </div>
        </div>

        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 border-t border-rule bg-sel px-5 py-4 sm:grid-cols-4 sm:px-6">
          {cierre.map((c) => (
            <div key={c.nombre}>
              <dt className="text-xs text-ink-2">{c.nombre}</dt>
              <dd className="font-semibold text-ink">{c.valor}</dd>
            </div>
          ))}
          <div>
            <dt className="text-xs text-ink-2">Orden alcanzado</dt>
            <dd className="font-semibold text-success">
              {poligonal.orden ? PRECISION_ORDER_LABELS[poligonal.orden] : "Ninguno"}
            </dd>
          </div>
        </dl>
      </div>
      <figcaption className="mt-3 text-sm text-ink-2">
        La calcula el motor de TopoField al abrir esta página, con una cartera
        de campo real del proyecto de ejemplo.
      </figcaption>
    </figure>
  );
}
