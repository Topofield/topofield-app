// Cómo corrigió el método elegido (Fase 35). Funciones puras: sin React, sin
// Supabase.
//
// El informe y la pestaña Ajuste explican la corrección con cifras, y esas
// cifras tienen que ser las del motor: aquí no se recalcula la poligonal, se
// leen sus proyecciones crudas y corregidas y se expresa la diferencia en los
// términos de cada método. Lo único que se vuelve a resolver es el sistema 2×2
// de Crandall, para mostrar λ₁ y λ₂, y la prueba comprueba que reproduce las
// proyecciones del motor.

import { cosDeg, sinDeg } from "./angles";
import type {
  LeastSquaresAdjustment,
  LeastSquaresWeights,
  PolygonalInput,
  PolygonalResult,
} from "@/types/polygonal";

/** El primer paso de los métodos proporcionales: la corrección angular. */
export interface AngularStep {
  /** Error angular en segundos; `null` si no hay condición angular. */
  errorSec: number | null;
  /** Ángulos que reciben la corrección. */
  count: number | null;
  /** Corrección de cada ángulo, en segundos: −error / ángulos. */
  perAngleSec: number | null;
  /**
   * El ángulo de orientación entra en el reparto: en una cerrada que cierra
   * contra el amarre, como la hoja de la TT4. Sin fila de cierre, o en una
   * abierta, la orientación fija el datum y no se corrige.
   */
  includesOrientation: boolean;
}

export interface SideCorrection {
  from: string;
  to: string;
  distance: number;
  /** Proyecciones con los azimuts ya corregidos angularmente, sin compensar. */
  deltaN: number;
  deltaE: number;
  /** Corrección lineal del lado: compensada − cruda. */
  corrN: number;
  corrE: number;
}

export interface CrandallSide extends SideCorrection {
  azimuth: number;
  /** Cambio de la distancia, en metros. */
  deltaD: number;
  adjustedDistance: number;
}

export type CorrectionBreakdown =
  | {
      method: "bowditch" | "transit";
      angular: AngularStep;
      sides: SideCorrection[];
      /** Brújula: −e / P. Tránsito: −e / Σ|Δ| de cada eje (corrección unitaria). */
      factorN: number;
      factorE: number;
      perimeter: number;
      sumAbsN: number;
      sumAbsE: number;
      errorN: number;
      errorE: number;
    }
  | {
      method: "crandall";
      angular: AngularStep;
      lambda1: number;
      lambda2: number;
      sides: CrandallSide[];
      errorN: number;
      errorE: number;
    }
  | {
      method: "least_squares";
      adjustment: Extract<LeastSquaresAdjustment, { status: "adjusted" }> | null;
      /** La estación cuyo ángulo de orientación fija el datum; `null` sin amarre. */
      datumStation: string | null;
      weights: LeastSquaresWeights | null;
    };

/**
 * El desglose de la corrección del método de `input`. `null` si la poligonal no
 * se corrige: abierta sin control, o datos incompletos.
 */
export function correctionBreakdown(
  input: PolygonalInput,
  result: PolygonalResult,
): CorrectionBreakdown | null {
  if (input.type === "open_uncontrolled") return null;

  if (input.method === "least_squares") {
    return {
      method: "least_squares",
      adjustment: result.adjustment?.status === "adjusted" ? result.adjustment : null,
      datumStation: input.hasOrientation ? (input.stations[0]?.pointCode ?? null) : null,
      weights: input.leastSquares ?? null,
    };
  }

  if (result.errorNorth == null || result.errorEast == null) return null;
  const errorN = result.errorNorth;
  const errorE = result.errorEast;
  const { stations } = input;
  const n = stations.length;
  const sideCount = input.type === "closed" && !input.hasOrientation ? n : n - 1;

  const sides: SideCorrection[] = [];
  for (let i = 0; i < sideCount; i++) {
    const r = result.stations[i];
    const deltaN = r?.deltaNorth;
    const deltaE = r?.deltaEast;
    const cN = r?.correctedDeltaNorth;
    const cE = r?.correctedDeltaEast;
    if (deltaN == null || deltaE == null || cN == null || cE == null) return null;
    sides.push({
      from: stations[i]!.pointCode,
      to: stations[i + 1]?.pointCode ?? stations[0]!.pointCode,
      distance: stations[i]!.distance ?? 0,
      deltaN,
      deltaE,
      corrN: cN - deltaN,
      corrE: cE - deltaE,
    });
  }

  const angular = angularStepOf(input, result);

  if (input.method === "crandall") {
    const azimuths = result.stations.slice(0, sideCount).map((s) => s.azimuth ?? 0);
    let a11 = 0;
    let a12 = 0;
    let a22 = 0;
    sides.forEach((s, i) => {
      const c = cosDeg(azimuths[i]!);
      const sn = sinDeg(azimuths[i]!);
      a11 += s.distance * c * c;
      a12 += s.distance * c * sn;
      a22 += s.distance * sn * sn;
    });
    const det = a11 * a22 - a12 * a12;
    const lambda1 = Math.abs(det) > 1e-12 ? (a22 * -errorN - a12 * -errorE) / det : 0;
    const lambda2 = Math.abs(det) > 1e-12 ? (-a12 * -errorN + a11 * -errorE) / det : 0;
    return {
      method: "crandall",
      angular,
      lambda1,
      lambda2,
      errorN,
      errorE,
      sides: sides.map((s, i) => {
        const az = azimuths[i]!;
        const deltaD = s.distance * (lambda1 * cosDeg(az) + lambda2 * sinDeg(az));
        return { ...s, azimuth: az, deltaD, adjustedDistance: s.distance + deltaD };
      }),
    };
  }

  const sumAbsN = sides.reduce((a, s) => a + Math.abs(s.deltaN), 0);
  const sumAbsE = sides.reduce((a, s) => a + Math.abs(s.deltaE), 0);
  const perimeter = result.perimeter;
  const bowditch = input.method === "bowditch";
  const divN = bowditch ? perimeter : sumAbsN;
  const divE = bowditch ? perimeter : sumAbsE;
  return {
    method: bowditch ? "bowditch" : "transit",
    angular,
    sides,
    factorN: divN > 0 ? -errorN / divN : 0,
    factorE: divE > 0 ? -errorE / divE : 0,
    perimeter,
    sumAbsN,
    sumAbsE,
    errorN,
    errorE,
  };
}

function angularStepOf(input: PolygonalInput, result: PolygonalResult): AngularStep {
  const errorSec = result.angularError;
  const count = result.angularConditionCount;
  return {
    errorSec,
    count,
    perAngleSec: errorSec != null && count ? -errorSec / count : null,
    includesOrientation:
      input.type === "closed" && input.hasOrientation && input.hasClosingRow,
  };
}
