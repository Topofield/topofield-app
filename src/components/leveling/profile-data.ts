// Datos del perfil de la libreta (Fases 22 y 36). Función pura.
//
// El perfil dibuja, sin compensar, la cota de cada punto frente a la distancia
// y, por cada armada, la mira atrás, la visual a la altura del instrumento y la
// mira adelante. El eje va siempre en el sentido de la ida —el BM de partida a
// la izquierda— y mide el recorrido que se mira: la vuelta, que recorre el
// camino al revés, se cuenta desde su final. El otro recorrido, la
// contraparte, se escala a ese largo para pasar por los mismos extremos.

import { accumulateDistances } from "@/lib/calculations/leveling";
import type { ComputedReading, LevelingResult, PointType, RunType } from "@/types/leveling";
import { armadaSpans } from "./armadas";

export interface ProfilePoint {
  code: string;
  type: PointType;
  /** Posición sobre el eje, en metros. */
  x: number;
  elevation: number;
}

export interface ProfileArmada {
  /** El punto atrás, donde va la mira de la V+. */
  backX: number;
  backElevation: number;
  /** El nivel, a la distancia de la V+ del punto atrás. */
  instrumentX: number;
  instrumentHeight: number;
  /** El punto adelante; `null` en una armada a medias. */
  foreX: number | null;
  foreElevation: number | null;
}

export interface ProfileRun {
  points: ProfilePoint[];
  armadas: ProfileArmada[];
}

export interface LevelingProfileData {
  active: ProfileRun;
  /** El otro recorrido, tenue; `null` sin vuelta. */
  other: ProfileRun | null;
  /** Largo del recorrido que se mira, en metros. */
  lengthM: number;
}

const finite = (v: number | null | undefined): v is number => v != null && Number.isFinite(v);

function lengthOf(readings: ComputedReading[]): number {
  return accumulateDistances(readings).at(-1) ?? 0;
}

/** Un recorrido sobre el eje: `toX` lleva su distancia acumulada a la posición. */
function profileRun(readings: ComputedReading[], toX: (d: number) => number): ProfileRun {
  const acc = accumulateDistances(readings);
  const points = readings.flatMap((r, i) =>
    finite(r.elevationCalculated) ? [{ code: r.pointCode, type: r.pointType, x: toX(acc[i]!), elevation: r.elevationCalculated }] : [],
  );
  const armadas = armadaSpans(readings).flatMap((s) => {
    const o = readings[s.opener]!;
    const c = s.closer != null ? readings[s.closer]! : null;
    if (!finite(o.instrumentHeight) || !finite(o.elevationCalculated) || !finite(o.backDistanceResolvedM)) return [];
    return [
      {
        backX: toX(acc[s.opener]!),
        backElevation: o.elevationCalculated,
        instrumentX: toX(acc[s.opener]! + o.backDistanceResolvedM),
        instrumentHeight: o.instrumentHeight,
        foreX: c && finite(c.elevationCalculated) ? toX(acc[s.closer!]!) : null,
        foreElevation: c && finite(c.elevationCalculated) ? c.elevationCalculated : null,
      },
    ];
  });
  return { points, armadas };
}

/** El perfil del recorrido `active`, con la contraparte si hay vuelta; `null` sin armadas que dibujar. */
export function levelingProfile(result: LevelingResult, active: RunType): LevelingProfileData | null {
  const forward = result.forward.readings;
  const back = result.return && result.return.readings.length > 1 ? result.return.readings : null;
  const lengthF = lengthOf(forward);
  const lengthR = back ? lengthOf(back) : 0;
  const lengthM = active === "forward" ? lengthF : lengthR;
  if (!(lengthM > 0)) return null;

  const forwardRun = (scale: number) => profileRun(forward, (d) => d * scale);
  const returnRun = (scale: number) => profileRun(back!, (d) => (lengthR - d) * scale);

  if (active === "forward") {
    return { active: forwardRun(1), other: back && lengthR > 0 ? returnRun(lengthF / lengthR) : null, lengthM };
  }
  return { active: returnRun(1), other: lengthF > 0 ? forwardRun(lengthR / lengthF) : null, lengthM };
}
