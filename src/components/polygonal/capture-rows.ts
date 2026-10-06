// Las filas de la captura de una poligonal, «desde → hacia» (Fase 35).
//
// Sin «use client»: las usan la pestaña Datos, el informe y el Excel. El modelo
// no cambia: una estación es el punto donde se arma el equipo, con su ángulo y
// la distancia al siguiente, así que la fila «V10 → D1» es la estación V10 con
// el código de la siguiente. El «0 atrás» es el amarre, no una estación.

import { normalizeAzimuth } from "@/lib/calculations/angles";
import { observedAzimuths } from "@/lib/calculations/polygonal";
import type { DeflectionDirection, PolygonalInput } from "@/types/polygonal";

/**
 * Qué es la fila en la cartera. `pending` es el último punto, al que todavía no
 * se le ha medido nada: desde él sigue la captura. `arrival`, el punto de
 * llegada de una abierta con control, sin su deflexión de llegada.
 */
export type CaptureRole = "backsight" | "side" | "closing" | "closing_angle" | "pending" | "arrival";

export interface CaptureRow {
  /** Índice de la estación en `stations`; `null` en la fila del 0 atrás. */
  stationIndex: number | null;
  from: string;
  /** El punto al que se mide; vacío en el último punto de una abierta. */
  to: string;
  role: CaptureRole;
  /** Grados decimales; 0 en el 0 atrás; `null` si falta. */
  angle: number | null;
  deflectionDirection: DeflectionDirection | null;
  distance: number | null;
  /** Azimut sin ajustar, con los ángulos medidos; `null` si falta un dato. */
  azimuth: number | null;
}

const finite = (v: number | null | undefined): number | null =>
  v != null && Number.isFinite(v) ? v : null;

/**
 * Las filas de la cartera. Con referencia, la primera es el 0 atrás. En una
 * cerrada, el lado que vuelve a la estación de partida es el cierre; si está
 * amarrada, la cartera termina con el cierre angular en la estación de partida:
 * contra la referencia si la cartera cierra contra el amarre, o el ángulo del
 * vértice de arranque hacia el primer lado (esquema de la Vivero). El último
 * punto, mientras no se haya medido nada desde él, es el pendiente. En una
 * abierta con control, una deflexión en el último punto es su cierre angular;
 * sin ella, el punto de llegada (`amarre.end`) es la llegada.
 */
export function captureRows(
  input: PolygonalInput,
  amarre: { start: string; reference: string | null; end?: string | null },
): CaptureRow[] {
  const { stations } = input;
  const n = stations.length;
  const azimuths = observedAzimuths(input);
  const oriented = input.hasOrientation && amarre.reference !== null;
  const rows: CaptureRow[] = [];

  if (oriented) {
    rows.push({
      stationIndex: null,
      from: amarre.start,
      to: amarre.reference ?? "",
      role: "backsight",
      angle: 0,
      deflectionDirection: null,
      distance: null,
      azimuth: finite(input.startAzimuth),
    });
  }

  stations.forEach((st, i) => {
    const last = i === n - 1;
    let to = stations[i + 1]?.pointCode ?? "";
    let role: CaptureRole = "side";
    if (last) {
      const returned = n > 1 && st.pointCode === amarre.start;
      if (input.type === "closed" && oriented && returned) {
        role = "closing_angle";
        to = input.hasClosingRow ? (amarre.reference ?? "") : (stations[1]?.pointCode ?? "");
      } else if (input.type === "closed" && !oriented && finite(st.distance) !== null) {
        to = stations[0]?.pointCode ?? "";
      } else if (input.type === "open_controlled" && finite(st.angle) !== null && i > 0) {
        role = "closing_angle";
      } else if (input.type === "open_controlled" && i > 0 && amarre.end && st.pointCode === amarre.end) {
        role = "arrival";
      } else {
        role = "pending";
      }
    }
    if (input.type === "closed" && role === "side" && to === amarre.start && to !== "") {
      role = "closing";
    }
    rows.push({
      stationIndex: i,
      from: st.pointCode,
      to,
      role,
      angle: finite(st.angle),
      deflectionDirection: st.deflectionDirection,
      distance: role === "closing_angle" ? null : finite(st.distance),
      azimuth: azimuths[i] ?? null,
    });
  });

  return rows;
}

/**
 * Lo medido, sin ajustar, para dibujarlo mientras se captura: el recorrido como
 * una abierta sin control, con los azimuts de los ángulos medidos. Una abierta
 * con control pasa sus deflexiones a ángulos a la derecha (Az + 180 + ángulo
 * gira lo mismo que Az ± deflexión). Una cerrada sin amarre que ya cerró suma
 * la vuelta al primer punto; la fila del cierre angular no abre lado.
 */
export function fieldTraverse(input: PolygonalInput): PolygonalInput {
  const deflections = input.type === "open_controlled";
  const stations = input.stations.map((st, i) =>
    deflections && i > 0 && finite(st.angle) !== null
      ? {
          ...st,
          angle: normalizeAzimuth((st.deflectionDirection === "left" ? -1 : 1) * st.angle + 180),
          deflectionDirection: null,
        }
      : st,
  );
  const last = stations.at(-1);
  if (input.type === "closed" && !input.hasOrientation && stations.length > 1 && finite(last?.distance) !== null) {
    stations.push({
      pointCode: stations[0]!.pointCode,
      angle: Number.NaN,
      deflectionDirection: null,
      distance: null,
      readings: [],
    });
  }
  return {
    ...input,
    type: "open_uncontrolled",
    hasClosingRow: false,
    method: "bowditch",
    leastSquares: null,
    endNorth: null,
    endEast: null,
    endAzimuth: null,
    stations,
  };
}
