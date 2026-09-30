// Datos del perfil de la nivelación (Fase 22). Función pura.
//
// El perfil dibuja la cota de cada punto frente a su distancia acumulada desde
// el origen: la ida con su cota corregida y, si la hay, la vuelta con su cota
// calculada (la vuelta no se compensa). La vuelta recorre el camino al revés,
// así que su distancia se cuenta desde el final y se escala al largo de la
// ida: los dos recorridos pasan por los mismos extremos.

import { accumulateDistances } from "@/lib/calculations/leveling";
import type { ComputedReading, LevelingResult, PointType } from "@/types/leveling";

export interface ProfilePoint {
  code: string;
  type: PointType;
  /** Distancia desde el origen de la ida, en metros. */
  distanceM: number;
  elevation: number;
}

export interface LevelingProfileData {
  forward: ProfilePoint[];
  /** La vuelta sobre el eje de la ida, o null si no hay vuelta que dibujar. */
  back: ProfilePoint[] | null;
  /** Largo de la ida, en metros. */
  totalM: number;
}

function points(
  readings: ComputedReading[],
  distances: number[],
  elevation: (r: ComputedReading) => number,
): ProfilePoint[] {
  return readings.flatMap((r, i) => {
    const d = distances[i];
    const z = elevation(r);
    return d === undefined || !Number.isFinite(d) || !Number.isFinite(z)
      ? []
      : [{ code: r.pointCode, type: r.pointType, distanceM: d, elevation: z }];
  });
}

export function levelingProfile(
  result: LevelingResult,
  { reconstructed = false }: { reconstructed?: boolean } = {},
): LevelingProfileData {
  const accF = accumulateDistances(result.forward.readings, { reconstructed });
  const totalM = accF[accF.length - 1] ?? 0;
  const forward = points(result.forward.readings, accF, (r) => r.elevationCorrected);

  let back: ProfilePoint[] | null = null;
  if (result.return && result.return.readings.length > 0 && totalM > 0) {
    const accR = accumulateDistances(result.return.readings, { reconstructed });
    const totalR = accR[accR.length - 1] ?? 0;
    if (totalR > 0) {
      const scale = totalM / totalR;
      back = points(
        result.return.readings,
        accR.map((d) => (totalR - d) * scale),
        (r) => r.elevationCalculated,
      );
    }
  }
  return { forward, back, totalM };
}
