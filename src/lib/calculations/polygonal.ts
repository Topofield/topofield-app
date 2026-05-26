// Cálculo de poligonales — funciones puras (PRD § 6.2-6.6, marco teórico
// mt-poligonales.docx). Sin React, sin Supabase. Solo aritmética topográfica.
//
// Convención de azimuts (la del marco teórico mt-poligonales.docx; las dos
// orientaciones del recorrido producen polígonos espejo que igualmente cierran,
// por eso la convención debe ser fija, no autodetectable):
//  - Cerrada: Az_i = Az_{i-1} + 180° − ángulo interno_i (caso 1 del documento).
//  - Abierta sin control: Az_i = Az_{i-1} + 180° + ángulo horizontal_i (caso 3).
//  - Abierta con control: Az_i = Az_{i-1} ± deflexión_i (+ derecha, − izquierda).

import { cosDeg, degreesToSeconds, normalizeAzimuth, sinDeg } from "./angles";
import { angularTolerance, minRelativePrecision } from "./tolerances";
import type {
  CorrectionMethod,
  PolygonalInput,
  PolygonalResult,
  StationInput,
  StationResult,
} from "@/types/polygonal";

function isNum(x: number | null | undefined): x is number {
  return typeof x === "number" && Number.isFinite(x);
}

/** Suma de las distancias finitas de las estaciones (perímetro / longitud). */
function sumDistances(stations: StationInput[]): number {
  return stations.reduce(
    (acc, s) => (isNum(s.distance) ? acc + s.distance : acc),
    0,
  );
}

/** Resultado por estación vacío (datos insuficientes para calcular). */
function blankStations(stations: StationInput[]): StationResult[] {
  return stations.map((s) => ({
    pointCode: s.pointCode,
    correctedAngle: null,
    azimuth: null,
    deltaNorth: null,
    deltaEast: null,
    correctedDeltaNorth: null,
    correctedDeltaEast: null,
    north: null,
    east: null,
  }));
}

/** Aplica un método de corrección a las proyecciones de los lados. */
function correctDeltas(
  method: CorrectionMethod,
  deltaN: number[],
  deltaE: number[],
  distances: number[],
  azimuths: number[],
  errorN: number,
  errorE: number,
  perimeter: number,
): { correctedDeltaN: number[]; correctedDeltaE: number[] } {
  const n = deltaN.length;
  const correctedDeltaN: number[] = [];
  const correctedDeltaE: number[] = [];

  if (method === "bowditch") {
    for (let i = 0; i < n; i++) {
      const ratio = perimeter > 0 ? (distances[i] ?? 0) / perimeter : 0;
      correctedDeltaN.push((deltaN[i] ?? 0) - errorN * ratio);
      correctedDeltaE.push((deltaE[i] ?? 0) - errorE * ratio);
    }
    return { correctedDeltaN, correctedDeltaE };
  }

  if (method === "transit") {
    const sumAbsN = deltaN.reduce((a, d) => a + Math.abs(d), 0);
    const sumAbsE = deltaE.reduce((a, d) => a + Math.abs(d), 0);
    for (let i = 0; i < n; i++) {
      const rN = sumAbsN > 0 ? Math.abs(deltaN[i] ?? 0) / sumAbsN : 0;
      const rE = sumAbsE > 0 ? Math.abs(deltaE[i] ?? 0) / sumAbsE : 0;
      correctedDeltaN.push((deltaN[i] ?? 0) - errorN * rN);
      correctedDeltaE.push((deltaE[i] ?? 0) - errorE * rE);
    }
    return { correctedDeltaN, correctedDeltaE };
  }

  // Crandall: ángulos fijos; corrige las distancias por mínimos cuadrados
  // ponderados (peso 1/d). Sistema 2×2 con λ1, λ2 y δd_i = d_i(λ1·cosAz+λ2·sinAz).
  let a11 = 0;
  let a12 = 0;
  let a22 = 0;
  for (let i = 0; i < n; i++) {
    const d = distances[i] ?? 0;
    const c = cosDeg(azimuths[i] ?? 0);
    const s = sinDeg(azimuths[i] ?? 0);
    a11 += d * c * c;
    a12 += d * c * s;
    a22 += d * s * s;
  }
  const det = a11 * a22 - a12 * a12;
  let lambda1 = 0;
  let lambda2 = 0;
  if (Math.abs(det) > 1e-12) {
    lambda1 = (a22 * -errorN - a12 * -errorE) / det;
    lambda2 = (-a12 * -errorN + a11 * -errorE) / det;
  }
  for (let i = 0; i < n; i++) {
    const d = distances[i] ?? 0;
    const c = cosDeg(azimuths[i] ?? 0);
    const s = sinDeg(azimuths[i] ?? 0);
    const deltaD = d * (lambda1 * c + lambda2 * s);
    correctedDeltaN.push((deltaN[i] ?? 0) + deltaD * c);
    correctedDeltaE.push((deltaE[i] ?? 0) + deltaD * s);
  }
  return { correctedDeltaN, correctedDeltaE };
}

/** Encadena coordenadas a partir del punto de partida y las proyecciones. */
function chainCoordinates(
  startNorth: number,
  startEast: number,
  deltaN: number[],
  deltaE: number[],
): { north: number[]; east: number[] } {
  const north = [startNorth];
  const east = [startEast];
  for (let i = 0; i < deltaN.length; i++) {
    north.push((north[i] ?? 0) + (deltaN[i] ?? 0));
    east.push((east[i] ?? 0) + (deltaE[i] ?? 0));
  }
  return { north, east };
}

// ----------------------------------------------------------------------------
// Poligonal cerrada
// ----------------------------------------------------------------------------

function computeClosed(input: PolygonalInput): PolygonalResult {
  const { stations } = input;
  const n = stations.length;
  const perimeter = sumDistances(stations);
  const angles = stations.map((s) => s.angle);
  const distances = stations.map((s) => s.distance);

  const hasAllData =
    n >= 3 && angles.every(isNum) && distances.every(isNum);

  if (!hasAllData) {
    return {
      angleSum: null,
      theoreticalSum: n >= 3 ? (n - 2) * 180 : null,
      angularError: null,
      angularTolerance: null,
      anglesMeetTolerance: null,
      errorNorth: null,
      errorEast: null,
      linearError: null,
      perimeter,
      relativePrecision: null,
      meetsLinearTolerance: null,
      meetsTolerance: null,
      stations: blankStations(stations),
    };
  }

  // Verificación angular
  const angleSum = angles.reduce((a, b) => a + b, 0);
  const theoreticalSum = (n - 2) * 180;
  const angularErrorDeg = angleSum - theoreticalSum;
  const angularError = degreesToSeconds(angularErrorDeg);
  const tolerance = angularTolerance(input.order, n);
  const anglesMeetTolerance = Math.abs(angularError) <= tolerance;
  const correctionPerAngle = -angularErrorDeg / n;
  const correctedAngles = angles.map((a) => a + correctionPerAngle);

  // Azimuts: Az_i = Az_{i-1} + 180° − ángulo interno_i, normalizado.
  const azimuths: number[] = [input.startAzimuth];
  for (let i = 1; i < n; i++) {
    azimuths.push(
      normalizeAzimuth((azimuths[i - 1] ?? 0) + 180 - (correctedAngles[i] ?? 0)),
    );
  }
  const deltaN = azimuths.map((az, i) => (distances[i] ?? 0) * cosDeg(az));
  const deltaE = azimuths.map((az, i) => (distances[i] ?? 0) * sinDeg(az));
  const errorN = deltaN.reduce((a, b) => a + b, 0);
  const errorE = deltaE.reduce((a, b) => a + b, 0);
  const base = {
    azimuths,
    deltaN,
    deltaE,
    errorN,
    errorE,
    linearError: Math.hypot(errorN, errorE),
  };

  const { correctedDeltaN, correctedDeltaE } = correctDeltas(
    input.method,
    base.deltaN,
    base.deltaE,
    distances,
    base.azimuths,
    base.errorN,
    base.errorE,
    perimeter,
  );

  // Coordenadas: la última estación cierra sobre el punto de partida, así que
  // solo se conservan las n primeras coordenadas encadenadas.
  const coords = chainCoordinates(
    input.startNorth,
    input.startEast,
    correctedDeltaN,
    correctedDeltaE,
  );

  const linearError = base.linearError;
  const relativePrecision =
    linearError > 0 ? perimeter / linearError : Infinity;
  const meetsLinearTolerance =
    relativePrecision >= minRelativePrecision(input.order);

  const stationResults: StationResult[] = stations.map((s, i) => ({
    pointCode: s.pointCode,
    correctedAngle: correctedAngles[i] ?? null,
    azimuth: base.azimuths[i] ?? null,
    deltaNorth: base.deltaN[i] ?? null,
    deltaEast: base.deltaE[i] ?? null,
    correctedDeltaNorth: correctedDeltaN[i] ?? null,
    correctedDeltaEast: correctedDeltaE[i] ?? null,
    north: coords.north[i] ?? null,
    east: coords.east[i] ?? null,
  }));

  return {
    angleSum,
    theoreticalSum,
    angularError,
    angularTolerance: tolerance,
    anglesMeetTolerance,
    errorNorth: base.errorN,
    errorEast: base.errorE,
    linearError,
    perimeter,
    relativePrecision,
    meetsLinearTolerance,
    meetsTolerance: anglesMeetTolerance && meetsLinearTolerance,
    stations: stationResults,
  };
}

// ----------------------------------------------------------------------------
// Poligonal abierta con control (deflexiones, punto de llegada conocido)
// ----------------------------------------------------------------------------

function computeOpenControlled(input: PolygonalInput): PolygonalResult {
  const { stations } = input;
  const n = stations.length;
  // n estaciones, n-1 lados; el último lado llega al punto conocido.
  const sideCount = n - 1;
  const distances = stations.slice(0, sideCount).map((s) => s.distance);
  const perimeter = distances.reduce((a, d) => (isNum(d) ? a + d : a), 0);
  const hasEnd = isNum(input.endNorth) && isNum(input.endEast);

  // Cierre angular (§6.6 Paso 2): requiere azimut de llegada conocido + la
  // deflexión en la última estación, que conecta el último lado con la
  // dirección de llegada. Si falta cualquiera, el cierre angular se omite y
  // solo se hace el lineal (degrada con elegancia).
  const lastStation = stations[n - 1];
  const hasEndAzimuth = isNum(input.endAzimuth);
  const hasClosingDeflection =
    lastStation != null && isNum(lastStation.angle);
  const doAngularClosure = hasEndAzimuth && hasClosingDeflection;
  const requiredDeflectionsLast = doAngularClosure ? n - 1 : n - 2;
  const deflectionsValid = stations
    .slice(1, requiredDeflectionsLast + 1)
    .every((s) => isNum(s.angle));
  const hasData = n >= 2 && distances.every(isNum) && deflectionsValid;

  if (!hasData || !hasEnd) {
    return {
      angleSum: null,
      theoreticalSum: null,
      angularError: null,
      angularTolerance: null,
      anglesMeetTolerance: null,
      errorNorth: null,
      errorEast: null,
      linearError: null,
      perimeter,
      relativePrecision: null,
      meetsLinearTolerance: null,
      meetsTolerance: null,
      stations: blankStations(stations),
    };
  }

  // Cierre angular: propaga deflexiones crudas hasta la dirección de llegada y
  // compara contra el azimut conocido. La corrección se reparte equitativa.
  let angularError: number | null = null;
  let angularToleranceValue: number | null = null;
  let anglesMeetTolerance: boolean | null = null;
  let correctionPerDeflection = 0;
  if (doAngularClosure) {
    let azCalc = input.startAzimuth;
    for (let i = 1; i <= n - 1; i++) {
      const st = stations[i];
      const dir = st?.deflectionDirection === "left" ? -1 : 1;
      azCalc = normalizeAzimuth(azCalc + dir * (st?.angle ?? 0));
    }
    let errorDeg = azCalc - (input.endAzimuth ?? 0);
    // Normaliza a (-180, 180] para tomar el error en valor absoluto menor.
    errorDeg = ((errorDeg + 540) % 360) - 180;
    angularError = degreesToSeconds(errorDeg);
    angularToleranceValue = angularTolerance(input.order, n - 1);
    anglesMeetTolerance = Math.abs(angularError) <= angularToleranceValue;
    correctionPerDeflection = -errorDeg / (n - 1);
  }

  // Azimut de cada lado con la deflexión corregida (la corrección es 0 si no
  // hubo cierre angular).
  const azimuths: number[] = [input.startAzimuth];
  for (let i = 1; i < sideCount; i++) {
    const station = stations[i];
    const dir = station?.deflectionDirection === "left" ? -1 : 1;
    const signedDefl = dir * (station?.angle ?? 0) + correctionPerDeflection;
    azimuths.push(normalizeAzimuth((azimuths[i - 1] ?? 0) + signedDefl));
  }
  const deltaN = azimuths.map((az, i) => (distances[i] ?? 0) * cosDeg(az));
  const deltaE = azimuths.map((az, i) => (distances[i] ?? 0) * sinDeg(az));

  // Cierre lineal contra el punto de llegada conocido.
  const rawNorth = chainCoordinates(
    input.startNorth,
    input.startEast,
    deltaN,
    deltaE,
  );
  const lastIdx = sideCount;
  const errorN = (rawNorth.north[lastIdx] ?? 0) - (input.endNorth ?? 0);
  const errorE = (rawNorth.east[lastIdx] ?? 0) - (input.endEast ?? 0);
  const linearError = Math.hypot(errorN, errorE);

  const { correctedDeltaN, correctedDeltaE } = correctDeltas(
    input.method,
    deltaN,
    deltaE,
    distances,
    azimuths,
    errorN,
    errorE,
    perimeter,
  );
  const coords = chainCoordinates(
    input.startNorth,
    input.startEast,
    correctedDeltaN,
    correctedDeltaE,
  );

  const relativePrecision =
    linearError > 0 ? perimeter / linearError : Infinity;
  const meetsLinearTolerance =
    relativePrecision >= minRelativePrecision(input.order);

  const stationResults: StationResult[] = stations.map((s, i) => ({
    pointCode: s.pointCode,
    correctedAngle: null,
    azimuth: azimuths[i] ?? null,
    deltaNorth: deltaN[i] ?? null,
    deltaEast: deltaE[i] ?? null,
    correctedDeltaNorth: correctedDeltaN[i] ?? null,
    correctedDeltaEast: correctedDeltaE[i] ?? null,
    north: coords.north[i] ?? null,
    east: coords.east[i] ?? null,
  }));

  return {
    angleSum: null,
    theoreticalSum: null,
    angularError,
    angularTolerance: angularToleranceValue,
    anglesMeetTolerance,
    errorNorth: errorN,
    errorEast: errorE,
    linearError,
    perimeter,
    relativePrecision,
    meetsLinearTolerance,
    meetsTolerance:
      (anglesMeetTolerance ?? true) && meetsLinearTolerance,
    stations: stationResults,
  };
}

// ----------------------------------------------------------------------------
// Poligonal abierta sin control (sin cierre ni corrección)
// ----------------------------------------------------------------------------

function computeOpenUncontrolled(input: PolygonalInput): PolygonalResult {
  const { stations } = input;
  const n = stations.length;
  const sideCount = n - 1;
  const distances = stations.slice(0, sideCount).map((s) => s.distance);
  const perimeter = distances.reduce((a, d) => (isNum(d) ? a + d : a), 0);
  const hasData =
    n >= 2 &&
    distances.every(isNum) &&
    stations.slice(1, sideCount).every((s) => isNum(s.angle));

  if (!hasData) {
    return {
      angleSum: null,
      theoreticalSum: null,
      angularError: null,
      angularTolerance: null,
      anglesMeetTolerance: null,
      errorNorth: null,
      errorEast: null,
      linearError: null,
      perimeter,
      relativePrecision: null,
      meetsLinearTolerance: null,
      meetsTolerance: null,
      stations: blankStations(stations),
    };
  }

  const azimuths: number[] = [input.startAzimuth];
  for (let i = 1; i < sideCount; i++) {
    azimuths.push(
      normalizeAzimuth((azimuths[i - 1] ?? 0) + 180 + (stations[i]?.angle ?? 0)),
    );
  }
  const deltaN = azimuths.map((az, i) => (distances[i] ?? 0) * cosDeg(az));
  const deltaE = azimuths.map((az, i) => (distances[i] ?? 0) * sinDeg(az));
  const coords = chainCoordinates(
    input.startNorth,
    input.startEast,
    deltaN,
    deltaE,
  );

  const stationResults: StationResult[] = stations.map((s, i) => ({
    pointCode: s.pointCode,
    correctedAngle: null,
    azimuth: azimuths[i] ?? null,
    deltaNorth: deltaN[i] ?? null,
    deltaEast: deltaE[i] ?? null,
    // Sin cierre no hay corrección: las proyecciones corregidas son las crudas.
    correctedDeltaNorth: deltaN[i] ?? null,
    correctedDeltaEast: deltaE[i] ?? null,
    north: coords.north[i] ?? null,
    east: coords.east[i] ?? null,
  }));

  return {
    angleSum: null,
    theoreticalSum: null,
    angularError: null,
    angularTolerance: null,
    anglesMeetTolerance: null,
    errorNorth: null,
    errorEast: null,
    linearError: null,
    perimeter,
    relativePrecision: null,
    meetsLinearTolerance: null,
    meetsTolerance: null,
    stations: stationResults,
  };
}

/**
 * Calcula una poligonal completa. Es total: nunca lanza; con datos insuficientes
 * devuelve un resultado con los campos no calculables en `null`.
 */
export function computePolygonal(input: PolygonalInput): PolygonalResult {
  switch (input.type) {
    case "closed":
      return computeClosed(input);
    case "open_controlled":
      return computeOpenControlled(input);
    case "open_uncontrolled":
      return computeOpenUncontrolled(input);
  }
}
