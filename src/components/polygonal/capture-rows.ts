// Las filas de la captura de una poligonal, «desde → hacia» (Fase 35).
//
// Sin «use client»: las usan la pestaña Datos, el informe y el Excel. El modelo
// no cambia: una estación es el punto donde se arma el equipo, con su ángulo y
// la distancia al siguiente, así que la fila «V10 → D1» es la estación V10 con
// el código de la siguiente. El «0 atrás» es el amarre, no una estación.

import { observedAzimuths } from "@/lib/calculations/polygonal";
import type { DeflectionDirection, PolygonalInput } from "@/types/polygonal";

/** Qué es la fila en la cartera. */
export type CaptureRole = "backsight" | "side" | "closing" | "closing_angle";

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
 * cerrada, el lado que vuelve a la estación de partida es el cierre, y la
 * última fila de una amarrada es el cierre angular: contra la referencia si la
 * cartera cierra contra el amarre, o el ángulo del vértice de arranque hacia el
 * primer lado (esquema de la Vivero). En una abierta, el último punto no tiene
 * destino.
 */
export function captureRows(
  input: PolygonalInput,
  amarre: { start: string; reference: string | null },
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
    if (last && input.type === "closed") {
      if (oriented) {
        role = "closing_angle";
        to = input.hasClosingRow ? (amarre.reference ?? "") : (stations[1]?.pointCode ?? "");
      } else {
        to = stations[0]?.pointCode ?? "";
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
