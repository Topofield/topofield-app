// Cómo cambia el borrador de una poligonal con cada popup de la captura
// (Fase 35). Funciones puras: la pestaña Datos las aplica y guarda el resultado.
//
// Una estación es el punto donde se arma el equipo, con su ángulo y la
// distancia al siguiente. Medir desde el punto actual llena su ángulo y su
// distancia y agrega el siguiente, vacío: es el punto pendiente, desde el que
// sigue la captura. Al cerrar una poligonal amarrada se vuelve a la estación de
// partida, que espera su cierre angular; sin amarre, el último lado vuelve al
// primer punto y el cierre angular es el ángulo en él. La abierta con control
// llega al punto de llegada, y con azimut de llegada su cierre angular es la
// deflexión en él.

import type { DeflectionDirection } from "@/types/polygonal";
import type { Dms3, PolygonalDraft, StationEdit } from "./polygonal-save";

export interface MeasurementEdit {
  /** El punto al que se mide. Con `closes`, se ignora: es el de cierre o el de llegada. */
  next: string;
  readings: Dms3[];
  distance: number | null;
  deflectionDirection: DeflectionDirection | null;
  /** Este lado vuelve a la estación de partida (cerrada) o llega al punto de llegada. */
  closes: boolean;
}

export interface ClosingAngleEdit {
  readings: Dms3[];
  /** Cerrada amarrada: el ángulo va hacia la referencia (la cartera cierra contra el amarre). */
  toReference: boolean;
  /** Abierta con control: el sentido de la deflexión de llegada. */
  deflectionDirection: DeflectionDirection | null;
}

/** Dónde se mide el cierre angular: la estación, el punto atrás y el de adelante. */
export interface ClosingAngleSpot {
  index: number;
  at: string;
  back: string;
  /** `null` en la abierta con control: es la dirección de llegada. */
  ahead: string | null;
}

const oriented = (d: PolygonalDraft) =>
  d.amarre.referencePointId !== null || d.amarre.referenceCode !== null;

const blankStation = (pointCode: string): StationEdit => ({
  pointCode,
  readings: [],
  deflectionDirection: null,
  distance: null,
});

const cleared = (st: StationEdit): StationEdit => ({
  ...st,
  readings: [],
  distance: null,
  deflectionDirection: null,
});

/** El punto con que se cierra: la partida en la cerrada, la llegada en la abierta con control. */
export function closingTarget(d: PolygonalDraft): string | null {
  if (d.details.type === "closed") return d.amarre.startCode;
  if (d.details.type === "open_controlled") return d.amarre.endCode?.trim() || null;
  return null;
}

/**
 * Desde dónde sigue la captura: el último punto, con el anterior atrás. Sin
 * mediciones, la estación de partida, con la referencia atrás (`referenceLabel`).
 */
export function currentStation(
  d: PolygonalDraft,
  referenceLabel: string | null,
): { index: number; code: string; back: string | null } {
  const n = d.stations.length;
  if (n === 0) return { index: 0, code: d.amarre.startCode, back: oriented(d) ? referenceLabel : null };
  return {
    index: n - 1,
    code: d.stations[n - 1]!.pointCode,
    back: n > 1 ? d.stations[n - 2]!.pointCode : oriented(d) ? referenceLabel : null,
  };
}

/** ¿La poligonal ya volvió a la estación de partida, o llegó al punto de llegada? */
export function isClosed(d: PolygonalDraft): boolean {
  const n = d.stations.length;
  if (n < 2) return false;
  if (d.details.type === "open_controlled") {
    return d.stations[n - 1]!.pointCode === closingTarget(d);
  }
  if (d.details.type !== "closed") return false;
  if (oriented(d)) return d.stations[n - 1]!.pointCode === d.amarre.startCode;
  return d.stations[n - 1]!.distance !== null;
}

/**
 * ¿Se ofrece la casilla de cierre al medir desde el punto actual? En la cerrada,
 * desde la segunda medición; en la abierta con control, si hay punto de llegada.
 */
export function canClose(d: PolygonalDraft): boolean {
  if (isClosed(d) || closingTarget(d) === null) return false;
  return d.details.type === "open_controlled" || d.stations.length >= 2;
}

/**
 * ¿Lleva ángulo la medición desde la estación `index`? Sin 0 atrás, la de
 * partida no: en la abierta no lo hay, y en la cerrada se mide al cerrar.
 */
export function measuresAngle(d: PolygonalDraft, index: number): boolean {
  if (index > 0 || oriented(d)) return true;
  return d.details.type === "closed" && isClosed(d);
}

/**
 * Dónde va el cierre angular, una vez cerrada la poligonal; `null` si no hay
 * (abierta sin control, sin cerrar, o abierta con control sin azimut de llegada).
 */
export function closingAngleSpot(
  d: PolygonalDraft,
  referenceLabel: string | null,
): ClosingAngleSpot | null {
  if (!isClosed(d)) return null;
  const st = d.stations;
  const n = st.length;
  if (d.details.type === "open_controlled") {
    if (d.amarre.endAzimuth === null) return null;
    return { index: n - 1, at: st[n - 1]!.pointCode, back: st[n - 2]!.pointCode, ahead: null };
  }
  if (oriented(d)) {
    const ahead = d.amarre.hasClosingRow || st[n - 1]!.readings.length === 0 ? referenceLabel : st[1]!.pointCode;
    return { index: n - 1, at: st[n - 1]!.pointCode, back: st[n - 2]!.pointCode, ahead };
  }
  return { index: 0, at: st[0]!.pointCode, back: st[n - 1]!.pointCode, ahead: st[1]?.pointCode ?? null };
}

/** Cerrada, o abierta con control y azimut de llegada, a la espera de su cierre angular. */
export function needsClosingAngle(d: PolygonalDraft): boolean {
  const spot = closingAngleSpot(d, null);
  return spot !== null && d.stations[spot.index]!.readings.length === 0;
}

function hasClosingAngle(d: PolygonalDraft): boolean {
  const spot = closingAngleSpot(d, null);
  return spot !== null && d.stations[spot.index]!.readings.length > 0;
}

/**
 * Por qué no se puede pasar a `nextOriented` (con o sin 0 atrás), o `null`.
 * Con mediciones, cambiarlo cambia lo que significa el ángulo de la partida
 * —de orientación a vértice, o al revés— y el motor calcularía otra poligonal
 * sin avisar. Cambiar el punto o el azimut de la referencia sí se puede.
 */
export function amarreChangeProblem(d: PolygonalDraft, nextOriented: boolean): string | null {
  const measured = d.stations.some((s) => s.readings.length > 0 || s.distance !== null);
  if (!measured || oriented(d) === nextOriented) return null;
  return nextOriented
    ? "Estas mediciones se tomaron sin 0 atrás: con él, el primer ángulo pasaría a ser de orientación. Deshaga las mediciones antes de poner la referencia."
    : "Estas mediciones se tomaron con 0 atrás: sin él, el ángulo de orientación pasaría a ser un vértice. Deshaga las mediciones antes de quitar la referencia.";
}

/** Mide desde el punto actual y agrega el siguiente. */
export function addMeasurement(d: PolygonalDraft, m: MeasurementEdit): PolygonalDraft {
  const stations =
    d.stations.length === 0 ? [blankStation(d.amarre.startCode)] : [...d.stations];
  const k = stations.length - 1;
  stations[k] = {
    ...stations[k]!,
    readings: m.readings,
    distance: m.distance,
    deflectionDirection: m.deflectionDirection,
  };
  const target = m.closes ? closingTarget(d) : null;
  if (target !== null && d.details.type === "closed" && !oriented(d)) {
    // Sin amarre, el último lado vuelve al primer punto: no hay estación de vuelta.
    return { ...d, stations };
  }
  stations.push(blankStation(target ?? m.next.trim()));
  return { ...d, stations };
}

/**
 * El cierre angular: en la cerrada amarrada, en la estación de partida, hacia
 * la referencia (`toReference`, la cartera cierra contra el amarre) o hacia el
 * primer lado (esquema de la Vivero); sin amarre, el ángulo en el primer punto;
 * en la abierta con control, la deflexión en el punto de llegada.
 */
export function addClosingAngle(d: PolygonalDraft, c: ClosingAngleEdit): PolygonalDraft {
  const spot = closingAngleSpot(d, null);
  if (spot === null) return d;
  const stations = [...d.stations];
  const st = stations[spot.index]!;
  if (d.details.type === "open_controlled") {
    stations[spot.index] = { ...st, readings: c.readings, deflectionDirection: c.deflectionDirection };
    return { ...d, stations };
  }
  if (!oriented(d)) {
    stations[spot.index] = { ...st, readings: c.readings };
    return { ...d, stations };
  }
  stations[spot.index] = { ...st, readings: c.readings, distance: null };
  return { ...d, stations, amarre: { ...d.amarre, hasClosingRow: c.toReference } };
}

/** Cambia la medición de la estación `index` y, si se puede, el nombre del siguiente. */
export function editMeasurement(
  d: PolygonalDraft,
  index: number,
  m: Omit<MeasurementEdit, "closes">,
): PolygonalDraft {
  const stations = [...d.stations];
  stations[index] = {
    ...stations[index]!,
    readings: m.readings,
    distance: m.distance,
    deflectionDirection: m.deflectionDirection,
  };
  const next = stations[index + 1];
  const closing =
    isClosed(d) && index + 1 === stations.length - 1 && next?.pointCode === closingTarget(d);
  if (next && !closing && m.next.trim() !== "") {
    stations[index + 1] = { ...next, pointCode: m.next.trim() };
  }
  return { ...d, stations };
}

/** El último lado medido: el que llega al punto pendiente, o el que cierra. */
function lastSideIndex(d: PolygonalDraft): number {
  const n = d.stations.length;
  const closedLocal = d.details.type === "closed" && !oriented(d) && isClosed(d);
  return closedLocal ? n - 1 : n - 2;
}

/** Sin nada medido, ni siquiera la estación de partida queda como estación. */
function compact(d: PolygonalDraft, stations: StationEdit[]): PolygonalDraft {
  const anything = stations.some((s) => s.readings.length > 0 || s.distance !== null);
  return { ...d, stations: anything ? stations : [], amarre: { ...d.amarre, hasClosingRow: false } };
}

/**
 * Elimina la medición de la estación `index`:
 * - el cierre angular, en su fila: solo se vacía su ángulo;
 * - el último lado: se quita el punto al que llegaba y, si cerraba, el cierre
 *   entero —la estación de vuelta y su cierre angular—;
 * - una intermedia: se quita esa estación, y el punto siguiente pasa a medirse
 *   desde el anterior.
 * La medición desde la estación de partida solo se elimina si es la última.
 */
export function removeMeasurement(d: PolygonalDraft, index: number): PolygonalDraft {
  const n = d.stations.length;
  const spot = closingAngleSpot(d, null);
  if (spot && spot.index === n - 1 && index === n - 1 && hasClosingAngle(d)) {
    const stations = [...d.stations];
    stations[index] = { ...stations[index]!, readings: [], deflectionDirection: null };
    return { ...d, stations, amarre: { ...d.amarre, hasClosingRow: false } };
  }
  const last = lastSideIndex(d);
  if (index === last) {
    if (last === n - 1) {
      // Cerrada sin amarre: el último lado volvía al primer punto, cuyo ángulo
      // se midió contra él.
      const stations = [...d.stations];
      stations[n - 1] = cleared(stations[n - 1]!);
      stations[0] = { ...stations[0]!, readings: [] };
      return compact(d, stations);
    }
    const stations = d.stations.slice(0, index + 1);
    stations[index] = cleared(stations[index]!);
    return compact(d, stations);
  }
  if (index <= 0 || index > last) return d;
  const stations = [...d.stations];
  stations.splice(index, 1);
  return { ...d, stations };
}

/** Deshace la última medición: el cierre angular, si lo hay, o el último lado. */
export function removeLastMeasurement(d: PolygonalDraft): PolygonalDraft {
  if (d.stations.length === 0) return d;
  if (hasClosingAngle(d)) {
    const spot = closingAngleSpot(d, null)!;
    const stations = [...d.stations];
    stations[spot.index] = { ...stations[spot.index]!, readings: [], ...(spot.index > 0 && { deflectionDirection: null }) };
    return { ...d, stations, amarre: { ...d.amarre, hasClosingRow: false } };
  }
  return removeMeasurement(d, lastSideIndex(d));
}
