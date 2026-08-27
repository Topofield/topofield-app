// Seed para verificación manual de los módulos poligonal, nivelación y
// asentamientos.
//
// Crea (idempotente — borra y recrea):
//  - Un usuario seed@topofield.local con password fijo.
//  - 3 proyectos: "Lote catastral" (tercer_orden), "Red geodésica"
//    (primer_orden) y "Edificio en monitoreo" (tercer_orden).
//  - Cada proyecto con al menos un lugar (`sites`), obligatorio desde la
//    Fase 5 para los procesos de poligonal y nivelación.
//  - 7 procesos poligonales precargados que cubren los 3 tipos, los 3 métodos
//    y los estados closed / rejected.
//  - 1 proceso de nivelación cerrada calculado, para las capturas del manual.
//  - 1 lugar de monitoreo (`edificio`, 6 puntos) con 6 visitas mensuales y su
//    serie de asentamientos calculada por `computeHistory`.
//  - Algunos reference_points para probar el CRUD de la tab Configuración.
//
// Uso: con `npx supabase start` activo, ejecutar
//   `npm run seed`
// (equivale a `npx tsx --env-file=.env.local scripts/seed.mjs`; lee
// SUPABASE_SECRET_KEY desde .env.local).
//
// Se ejecuta con `tsx` y no con `node` a secas porque este script importa los
// módulos de cálculo directamente desde `src/` en TypeScript, y el Node
// mínimo que declara el proyecto (20.19.4) no sabe cargar `.ts`. Los
// resultados que se persisten los calcula el motor real, así que importar
// `src/` es deliberado: un seed que replicara los cálculos por su cuenta
// dejaría de verificarlos.

import { createClient } from "@supabase/supabase-js";
import { computePolygonal } from "../src/lib/calculations/polygonal.ts";
import { computeLeveling } from "../src/lib/calculations/leveling.ts";
import { computeHistory } from "../src/lib/calculations/settlement.ts";
import { thresholdsFor } from "../src/lib/calculations/tolerances.ts";
import { decimalToDms, dmsToDecimal } from "../src/lib/calculations/angles.ts";

const URL = "http://127.0.0.1:54321";
const SECRET = process.env.SUPABASE_SECRET_KEY;
if (!SECRET) {
  console.error(
    "Falta SUPABASE_SECRET_KEY. Corré con: npm run seed",
  );
  process.exit(1);
}
const EMAIL = "seed@topofield.local";
const PASSWORD = "seed1234";
const APP_URL = "http://localhost:3000";

const admin = createClient(URL, SECRET, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function recreateUser() {
  const { data } = await admin.auth.admin.listUsers();
  const existing = data.users.find((u) => u.email === EMAIL);
  if (existing) await admin.auth.admin.deleteUser(existing.id);
  const { data: created, error } = await admin.auth.admin.createUser({
    email: EMAIL,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { first_name: "Seed", last_name: "TopoField" },
  });
  if (error) throw error;
  return created.user.id;
}

async function createProject(userId, fields) {
  const { data, error } = await admin
    .from("projects")
    .insert({ user_id: userId, ...fields })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

async function insertReferencePoints(projectId, points) {
  const rows = points.map((p) => ({ project_id: projectId, ...p }));
  const { error } = await admin.from("reference_points").insert(rows);
  if (error) throw error;
}

/**
 * Crea un lugar (`sites`). `site_id` es NOT NULL en `polygonal_processes` y
 * `leveling_processes` desde la Fase 5, así que todo proyecto del seed
 * necesita al menos un lugar antes de insertar sus procesos.
 */
async function createSite(projectId, fields) {
  const { data, error } = await admin
    .from("sites")
    .insert({ project_id: projectId, ...fields })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

/**
 * Calcula los resultados de un fixture con el mismo motor que usa la app
 * (`computePolygonal`), para que el seed nunca quede desincronizado con lo
 * que produciría `saveProcess` en un guardado real.
 */
function resultFieldsFor(spec, order) {
  const input = {
    type: spec.type,
    startNorth: spec.startNorth,
    startEast: spec.startEast,
    startAzimuth: dmsToDecimal(...(spec.startAz ?? [0, 0, 0])),
    endNorth: spec.endNorth ?? null,
    endEast: spec.endEast ?? null,
    endAzimuth: spec.endAz ? dmsToDecimal(...spec.endAz) : null,
    order,
    method: spec.correctionMethod,
    stations: spec.stations.map((st) => ({
      pointCode: st.code,
      angle: st.angle ? dmsToDecimal(...st.angle) : Number.NaN,
      deflectionDirection: st.dir ?? null,
      distance: st.distance ?? Number.NaN,
    })),
  };
  const r = computePolygonal(input);
  const rel = r.relativePrecision;
  return {
    resultado: r,
    campos: {
      angular_error_seconds: r.angularError,
      linear_error: r.linearError,
      perimeter: r.perimeter,
      relative_precision:
        rel == null ? null : rel === Infinity ? "1:∞" : `1:${Math.round(rel)}`,
      meets_tolerance: r.meetsTolerance,
    },
  };
}

/** ¿El status representa un proceso ya cerrado (y por tanto inmutable)? */
function isClosedStatus(status) {
  return status === "closed" || status === "rejected";
}

async function insertPolygonal(projectId, siteId, spec, userId, order) {
  const startAz = spec.startAz ?? [0, 0, 0];
  const endAz = spec.endAz ?? [null, null, null];
  const resultado = resultFieldsFor(spec, order);
  const { data: proc, error } = await admin
    .from("polygonal_processes")
    .insert({
      project_id: projectId,
      site_id: siteId,
      name: spec.name,
      type: spec.type,
      angle_type: spec.angle_type,
      start_point_code: spec.startPointCode,
      start_north: spec.startNorth,
      start_east: spec.startEast,
      start_azimuth_deg: startAz[0],
      start_azimuth_min: startAz[1],
      start_azimuth_sec: startAz[2],
      end_point_code: spec.endPointCode ?? null,
      end_north: spec.endNorth ?? null,
      end_east: spec.endEast ?? null,
      end_azimuth_deg: endAz[0],
      end_azimuth_min: endAz[1],
      end_azimuth_sec: endAz[2],
      correction_method: spec.correctionMethod ?? null,
      // El proceso nace abierto aunque el fixture lo quiera cerrado: los
      // triggers de inmutabilidad rechazan escribir estaciones bajo un proceso
      // ya cerrado. El cierre se aplica al final, como hace la aplicación.
      status: isClosedStatus(spec.status) ? "calculated" : spec.status,
      ...resultado.campos,
      notes: spec.notes ?? null,
    })
    .select("id")
    .single();
  if (error) throw error;

  // Se persisten también los RESULTADOS por estación, igual que hace
  // `savePolygonalProcessAction`. Sin esto, el seed dejaba procesos en estado
  // `calculated` con las columnas de cálculo vacías: la aplicación los mostraba
  // bien porque el editor recalcula en vivo, pero cualquier consumidor de lo
  // persistido —el informe, la exportación a Excel— los veía sin datos.
  const rows = spec.stations.map((st, i) => {
    const r = resultado.resultado.stations[i];
    const azimuth = r?.azimuth != null ? decimalToDms(r.azimuth) : null;
    const corregido =
      r?.correctedAngle != null ? decimalToDms(r.correctedAngle) : null;
    return {
      process_id: proc.id,
      station_order: i + 1,
      point_code: st.code,
      angle_deg: st.angle?.[0] ?? null,
      angle_min: st.angle?.[1] ?? null,
      angle_sec: st.angle?.[2] ?? null,
      deflection_direction: st.dir ?? null,
      horizontal_distance: st.distance ?? null,
      corrected_angle_deg: corregido?.deg ?? null,
      corrected_angle_min: corregido?.min ?? null,
      corrected_angle_sec: corregido?.sec ?? null,
      azimuth_deg: azimuth?.deg ?? null,
      azimuth_min: azimuth?.min ?? null,
      azimuth_sec: azimuth?.sec ?? null,
      delta_north: r?.deltaNorth ?? null,
      delta_east: r?.deltaEast ?? null,
      corrected_delta_north: r?.correctedDeltaNorth ?? null,
      corrected_delta_east: r?.correctedDeltaEast ?? null,
      north: r?.north ?? null,
      east: r?.east ?? null,
    };
  });
  if (rows.length > 0) {
    const { error: stErr } = await admin
      .from("polygonal_stations")
      .insert(rows);
    if (stErr) throw stErr;
  }

  // Cierre al final, una vez cargadas las estaciones.
  if (isClosedStatus(spec.status)) {
    const { error: closeErr } = await admin
      .from("polygonal_processes")
      .update({
        status: spec.status,
        closed_at: new Date().toISOString(),
        closed_by: userId,
      })
      .eq("id", proc.id);
    if (closeErr) throw closeErr;
  }

  return proc.id;
}

/**
 * Inserta un proceso de nivelación con `computeLeveling` como fuente de la
 * verdad de los resultados persistidos, igual que `insertPolygonal` con
 * `computePolygonal`: el seed nunca queda desincronizado con lo que
 * produciría `saveLevelingProcessAction` en un guardado real.
 */
async function insertLeveling(projectId, siteId, spec, userId, order) {
  const input = {
    type: spec.type,
    startElevation: spec.startElevation,
    endElevation: spec.endElevation ?? null,
    order,
    totalDistanceKm: spec.totalDistanceKm,
    forward: spec.forward.map((r) => ({
      pointCode: r.code,
      pointType: r.type,
      backsight: r.back ?? null,
      foresight: r.fore ?? null,
      distanceM: r.distanceM ?? null,
      distanceAccumulatedKm: r.distanceAccumKm ?? null,
    })),
    return: spec.return
      ? spec.return.map((r) => ({
          pointCode: r.code,
          pointType: r.type,
          backsight: r.back ?? null,
          foresight: r.fore ?? null,
          distanceM: r.distanceM ?? null,
          distanceAccumulatedKm: r.distanceAccumKm ?? null,
        }))
      : null,
  };
  const result = computeLeveling(input);

  const { data: proc, error } = await admin
    .from("leveling_processes")
    .insert({
      project_id: projectId,
      site_id: siteId,
      name: spec.name,
      type: spec.type,
      start_bm_code: spec.startBmCode,
      start_bm_elevation: spec.startElevation,
      end_bm_code: spec.endBmCode ?? null,
      end_bm_elevation: spec.endElevation ?? null,
      has_return_run: spec.return != null,
      total_distance_km: spec.totalDistanceKm,
      // Nace calculado, no cerrado: los triggers de inmutabilidad rechazan
      // escribir lecturas bajo un proceso ya cerrado (mismo motivo que en
      // insertPolygonal). Este fixture se deja "calculated" a propósito.
      status: "calculated",
      closure_error_mm: result.closureErrorMm,
      tolerance_mm: result.toleranceMm,
      meets_tolerance: result.meetsTolerance,
      forward_error_mm: result.forward.errorMm,
      return_error_mm: result.return?.errorMm ?? null,
      discrepancy_mm: result.discrepancyMm,
      notes: spec.notes ?? null,
    })
    .select("id")
    .single();
  if (error) throw error;

  function runRows(runType, drafts, computedReadings) {
    return drafts.map((draft, i) => {
      const r = computedReadings[i];
      return {
        process_id: proc.id,
        run_type: runType,
        reading_order: i + 1,
        point_code: draft.code,
        point_type: draft.type,
        backsight: draft.back ?? null,
        foresight: draft.fore ?? null,
        distance_m: draft.distanceM ?? null,
        distance_accumulated_km: draft.distanceAccumKm ?? null,
        instrument_height: r?.instrumentHeight ?? null,
        elevation_calculated: r?.elevationCalculated ?? null,
        elevation_corrected: r?.elevationCorrected ?? null,
        correction_applied: r?.correctionApplied ?? null,
      };
    });
  }

  const rows = [
    ...runRows("forward", spec.forward, result.forward.readings),
    ...(spec.return && result.return
      ? runRows("return", spec.return, result.return.readings)
      : []),
  ];
  if (rows.length > 0) {
    const { error: readingsErr } = await admin
      .from("leveling_readings")
      .insert(rows);
    if (readingsErr) throw readingsErr;
  }

  return proc.id;
}

// ----------------------------------------------------------------------------
// Definiciones de los procesos
// ----------------------------------------------------------------------------

const pentagonStations = [
  { code: "A", angle: [95, 30, 0], distance: 120.5 },
  { code: "B", angle: [108, 15, 0], distance: 98.75 },
  { code: "C", angle: [112, 0, 0], distance: 135.2 },
  { code: "D", angle: [87, 45, 0], distance: 110.3 },
  { code: "E", angle: [136, 30, 0], distance: 89.6 },
];

const PROCESSES = [
  {
    name: "Pentágono — Caso 1 del marco teórico",
    type: "closed",
    angle_type: "internal",
    startPointCode: "A",
    startNorth: 1000,
    startEast: 1000,
    startAz: [45, 0, 0],
    correctionMethod: "bowditch",
    status: "calculated",
    stations: pentagonStations,
    notes:
      "Pentágono de 5 vértices del documento mt-poligonales.docx (caso 1). Σ ángulos = 540° exactos.",
  },
  {
    name: "Cuadrado perfecto 100×4",
    type: "closed",
    angle_type: "internal",
    startPointCode: "A",
    startNorth: 0,
    startEast: 0,
    startAz: [0, 0, 0],
    correctionMethod: "bowditch",
    status: "calculated",
    stations: [
      { code: "A", angle: [90, 0, 0], distance: 100 },
      { code: "B", angle: [90, 0, 0], distance: 100 },
      { code: "C", angle: [90, 0, 0], distance: 100 },
      { code: "D", angle: [90, 0, 0], distance: 100 },
    ],
    notes: "Cierre exacto (error = 0). Los tres métodos coinciden.",
  },
  {
    name: "Cuadrado con error 0.4 m (fixture clave)",
    type: "closed",
    angle_type: "internal",
    startPointCode: "A",
    startNorth: 0,
    startEast: 0,
    startAz: [0, 0, 0],
    correctionMethod: "bowditch",
    status: "calculated",
    stations: [
      { code: "A", angle: [90, 0, 0], distance: 100.4 },
      { code: "B", angle: [90, 0, 0], distance: 100 },
      { code: "C", angle: [90, 0, 0], distance: 100 },
      { code: "D", angle: [90, 0, 0], distance: 100 },
    ],
    notes:
      "El primer lado mide 100.4 m en lugar de 100. Error de cierre = 0.4 m. Distingue Bowditch (N de B = 100.300) de Tránsito/Crandall (100.200). Precisión 1:1001, NO cumple tercer orden.",
  },
  {
    name: "Enlace P1-P3 con deflexión",
    type: "open_controlled",
    angle_type: "deflection",
    startPointCode: "P1",
    startNorth: 0,
    startEast: 0,
    startAz: [90, 0, 0],
    endPointCode: "P3",
    endNorth: -50,
    endEast: 186.60254,
    correctionMethod: "bowditch",
    status: "calculated",
    stations: [
      { code: "P1", distance: 100 },
      { code: "P2", angle: [30, 0, 0], dir: "right", distance: 100 },
      { code: "P3" },
    ],
    notes:
      "Tramo de enlace simple: arranca apuntando al este, deflexión 30° a la derecha en P2 y llega exactamente a (-50, 186.6025). Cierre lineal = 0.",
  },
  {
    name: "Reconocimiento E1-E4 (sin cierre)",
    type: "open_uncontrolled",
    angle_type: "internal",
    startPointCode: "E1",
    startNorth: 1000,
    startEast: 1000,
    startAz: [150, 0, 0],
    status: "calculated",
    stations: [
      { code: "E1", distance: 45.8 },
      { code: "E2", angle: [175, 30, 0], distance: 62.3 },
      { code: "E3", angle: [192, 15, 0], distance: 38.5 },
      { code: "E4" },
    ],
    notes:
      "Caso 3 del marco teórico (ajustado a la convención de TopoField: distancia en la fila de la estación de SALIDA). Sin verificación de cierre.",
  },
  {
    name: "Cuadrado oficial (cerrado)",
    type: "closed",
    angle_type: "internal",
    startPointCode: "A",
    startNorth: 1000,
    startEast: 1000,
    startAz: [0, 0, 0],
    correctionMethod: "bowditch",
    status: "closed",
    stations: [
      { code: "A", angle: [90, 0, 0], distance: 100 },
      { code: "B", angle: [90, 0, 0], distance: 100 },
      { code: "C", angle: [90, 0, 0], distance: 100 },
      { code: "D", angle: [90, 0, 0], distance: 100 },
    ],
    notes:
      "Cuadrado que cierra exacto, cerrado oficialmente: el editor debe abrirlo en modo solo lectura.",
  },
  {
    name: "Cuadrado marginal (rechazado)",
    type: "closed",
    angle_type: "internal",
    startPointCode: "A",
    startNorth: 0,
    startEast: 0,
    startAz: [0, 0, 0],
    correctionMethod: "transit",
    status: "rejected",
    stations: [
      { code: "A", angle: [90, 0, 0], distance: 100.4 },
      { code: "B", angle: [90, 0, 0], distance: 100 },
      { code: "C", angle: [90, 0, 0], distance: 100 },
      { code: "D", angle: [90, 0, 0], distance: 100 },
    ],
    notes:
      "Cuadrado con error 0.4 m cerrado como RECHAZADO porque la precisión 1:1001 no alcanza el tercer orden (1:5000).",
  },
];

// Circuito cerrado, 0.9 km, tercer orden, BM 100.000. Error de cierre −8.0 mm
// contra tolerancia 11.4 mm (cumple); el BM final corregido cierra exacto en
// 100.0000. Verificado a mano en el brief de la Tarea 13 de la Fase 4.
const LEVELING_PROCESSES = [
  {
    name: "Circuito BM-1 (cerrado, tercer orden)",
    type: "closed",
    startBmCode: "BM-1",
    startElevation: 100.0,
    totalDistanceKm: 0.9,
    forward: [
      { code: "BM-1", type: "bm", back: 1.5, distanceAccumKm: 0.0 },
      {
        code: "PC-1",
        type: "pc",
        fore: 1.2,
        back: 2.0,
        distanceAccumKm: 0.3,
      },
      {
        code: "PC-2",
        type: "pc",
        fore: 2.5,
        back: 1.0,
        distanceAccumKm: 0.6,
      },
      { code: "BM-1", type: "bm", fore: 0.808, distanceAccumKm: 0.9 },
    ],
    notes:
      "Circuito cerrado de verificación: sale y vuelve a BM-1. Error de cierre −8.0 mm contra tolerancia 11.4 mm (K=12 · √0.9 km). Cumple tercer orden.",
  },
];

const REFERENCE_POINTS = [
  {
    code: "BM-01",
    type: "bm",
    north: 1000,
    east: 1000,
    elevation: 2630.0,
    description: "BM principal del lote (esquina NW)",
  },
  {
    code: "BM-02",
    type: "bm",
    north: 1050,
    east: 1020,
    elevation: 2630.5,
    description: "BM secundario",
  },
  {
    code: "GPS-1",
    type: "gps",
    north: 1100,
    east: 1100,
    elevation: 2631.0,
    description: "Punto GPS de amarre",
  },
];

// ----------------------------------------------------------------------------
// Lugar de monitoreo de asentamientos: 6 puntos en grilla sobre un edificio,
// 6 visitas mensuales. Serie de consolidación sobre arcilla blanda:
// asentamiento rápido al principio que desacelera hasta converger — el patrón
// real que hace que el indicador de tendencia tenga algo que mostrar.
//
// Las cotas se diseñan a mano; los asentamientos, velocidades y niveles de
// alerta los calcula `computeHistory`, nunca se escriben a mano (misma
// estrategia que `insertPolygonal`/`insertLeveling` con el motor real).
//
// P-06 es la esquina más cargada de la estructura y se lleva a alarma a
// propósito, para que el semáforo no salga todo verde en las capturas del
// manual. P-05 (borde intermedio) pasa por alerta. El resto se queda en
// precaución/normal: así hay contraste entre el punto crítico y el resto.
// ----------------------------------------------------------------------------

const SETTLEMENT_POINTS = [
  { code: "P-01", location_description: "Esquina NW", northing: 2000.0, easting: 1000.0, initial_elevation: 100.0 },
  { code: "P-02", location_description: "Esquina NE", northing: 2000.0, easting: 1030.0, initial_elevation: 100.0 },
  { code: "P-03", location_description: "Centro", northing: 1985.0, easting: 1015.0, initial_elevation: 100.0 },
  { code: "P-04", location_description: "Esquina SW", northing: 1970.0, easting: 1000.0, initial_elevation: 100.0 },
  { code: "P-05", location_description: "Borde sur, intermedio", northing: 1970.0, easting: 1015.0, initial_elevation: 100.0 },
  { code: "P-06", location_description: "Esquina SE (mayor carga)", northing: 1970.0, easting: 1030.0, initial_elevation: 100.0 },
];

/**
 * Asentamientos parciales mensuales, en mm, por punto (visita 0 = línea base,
 * sin parcial). Verificado a mano en el brief de la Tarea 18: con fechas
 * mensuales reales (28-31 días → 0.92-1.02 meses de 30.4375 días) la
 * velocidad de P-06 pasa por alarma (visita 1, ≈−23.6 mm/mes), luego alerta,
 * caution, y su acumulado cruza a alerta en la visita 5 (−50.5 mm ≥ 50 mm).
 * P-05 pasa por alerta en las visitas 1-2 por velocidad. El resto queda en
 * caution/normal. Todos convergen: la magnitud de la velocidad decrece en
 * cada visita sucesiva de cada punto.
 */
const PARTIALS_MM = {
  "P-01": [0, -3.5, -2.2, -1.4, -0.9, -0.5],
  "P-02": [0, -4.2, -2.6, -1.6, -1.0, -0.6],
  "P-03": [0, -3.8, -2.3, -1.3, -0.8, -0.5],
  "P-04": [0, -4.5, -2.8, -1.7, -1.1, -0.7],
  "P-05": [0, -9.0, -5.0, -3.0, -1.8, -1.0],
  "P-06": [0, -24.0, -13.0, -7.0, -4.0, -2.5],
};

const VISIT_DATES = [
  "2025-01-15",
  "2025-02-15",
  "2025-03-15",
  "2025-04-15",
  "2025-05-15",
  "2025-06-15",
];

/** Cota de un punto en una visita: cota base 100.0000 menos el acumulado. */
function cotaEn(code, visitIndex) {
  const acumuladoMm = PARTIALS_MM[code]
    .slice(0, visitIndex + 1)
    .reduce((a, b) => a + b, 0);
  return 100.0 + acumuladoMm / 1000;
}

/**
 * Crea el lugar de monitoreo, su catálogo de puntos y sus 6 visitas, con los
 * resultados calculados por `computeHistory` — nunca escritos a mano.
 */
async function insertSettlementSite(projectId) {
  // Los umbrales no se envían: los DEFAULT de la tabla `sites` son los mismos
  // que `thresholdsFor("edificio")` (velocity 2/5/10, accumulated 25/50/75,
  // distorsión 1/500), así que el lugar queda coherente con el preset del
  // motor sin duplicar las constantes aquí.
  const siteId = await createSite(projectId, {
    name: "Edificio Torre Central",
    description:
      "Edificio de 6 niveles sobre arcilla blanda, con 6 puntos de control en grilla.",
    structure_type: "edificio",
  });

  const { data: pointRows, error: pointsErr } = await admin
    .from("settlement_points")
    .insert(SETTLEMENT_POINTS.map((p) => ({ site_id: siteId, ...p })))
    .select("id, code");
  if (pointsErr) throw pointsErr;

  const pointIdByCode = new Map(pointRows.map((p) => [p.code, p.id]));

  // --- Motor real: computeHistory calcula parciales, acumulados, velocidad
  // y nivel de alerta a partir únicamente de las cotas medidas. ------------
  const points = SETTLEMENT_POINTS.map((p) => ({
    id: pointIdByCode.get(p.code),
    code: p.code,
    northing: p.northing,
    easting: p.easting,
    initialElevation: p.initial_elevation,
  }));

  const visits = VISIT_DATES.map((date, i) => ({
    id: `visita-${i}`, // id provisional, solo para casar con el resultado de computeHistory
    visitNumber: i,
    date,
    readings: SETTLEMENT_POINTS.map((p) => ({
      pointId: pointIdByCode.get(p.code),
      elevation: cotaEn(p.code, i),
    })),
  }));

  const history = computeHistory(points, visits, thresholdsFor("edificio"));

  for (const visitResult of history.visits) {
    const { data: visitRow, error: visitErr } = await admin
      .from("settlement_visits")
      .insert({
        site_id: siteId,
        visit_number: visitResult.visitNumber,
        date: visitResult.date,
        operator: "Seed TopoField",
        equipment: "Nivel automático Leica NA2",
        status: "calculated",
      })
      .select("id")
      .single();
    if (visitErr) throw visitErr;

    const readingRows = visitResult.readings.map((r) => ({
      visit_id: visitRow.id,
      point_id: r.pointId,
      elevation: r.elevation,
      partial_settlement: r.partialSettlement,
      accumulated_settlement: r.accumulatedSettlement,
      velocity: r.velocity,
      alert_status: r.alertStatus,
    }));
    const { error: readingsErr } = await admin
      .from("settlement_readings")
      .insert(readingRows);
    if (readingsErr) throw readingsErr;
  }

  return siteId;
}

// ----------------------------------------------------------------------------

async function main() {
  console.log("Preparando seed de TopoField...");
  const userId = await recreateUser();
  console.log(`  ✓ Usuario recreado: ${EMAIL} (id ${userId})`);

  const catastral = await createProject(userId, {
    name: "Lote catastral",
    client: "Cliente Demo",
    location: "Bogotá",
    datum: "MAGNA-SIRGAS",
    projection: "Origen Bogotá",
    precision_order: "tercer_orden",
    equipment_brand: "Leica",
    equipment_model: "TS06 Plus",
    equipment_serial: "LCS-2026-001",
    angular_precision_seconds: 5,
    linear_precision: "3+2ppm",
    equipment_calibration_date: "2026-02-10",
  });
  console.log(`  ✓ Proyecto "Lote catastral" (tercer_orden) — ${catastral}`);

  const geodesica = await createProject(userId, {
    name: "Red geodésica",
    client: "Cliente Demo",
    location: "Bogotá",
    datum: "MAGNA-SIRGAS",
    precision_order: "primer_orden",
    equipment_brand: "Trimble",
    equipment_model: "S9",
    equipment_serial: "TRB-2026-009",
    angular_precision_seconds: 1,
    linear_precision: "1+1ppm",
    equipment_calibration_date: "2026-03-15",
  });
  console.log(`  ✓ Proyecto "Red geodésica" (primer_orden) — ${geodesica}`);

  // `site_id` es NOT NULL en polygonal_processes/leveling_processes desde la
  // Fase 5: cada proyecto necesita su lugar antes de insertar procesos. Este
  // es un lugar genérico ("otro"), sin relación con el control de
  // asentamientos — el levantamiento del lote no monitorea una estructura.
  const catastralSite = await createSite(catastral, {
    name: "General",
    description: "Lugar genérico para los procesos de poligonal y nivelación del lote.",
    structure_type: "otro",
  });
  // La red geodésica no trae procesos propios en este seed, pero necesita su
  // lugar creado por si una fase futura le añade alguno.
  await createSite(geodesica, {
    name: "General",
    description: "Lugar genérico para los procesos de la red geodésica.",
    structure_type: "otro",
  });

  await insertReferencePoints(catastral, REFERENCE_POINTS);
  console.log(
    `  ✓ ${REFERENCE_POINTS.length} puntos de referencia en "Lote catastral"`,
  );

  // Los 7 procesos van al proyecto "Lote catastral" (tercer_orden): el mismo
  // orden de precisión con el que `computePolygonal` evalúa sus tolerancias.
  for (const spec of PROCESSES) {
    await insertPolygonal(catastral, catastralSite, spec, userId, "tercer_orden");
    console.log(`  ✓ Proceso: ${spec.name} (${spec.status})`);
  }

  for (const spec of LEVELING_PROCESSES) {
    await insertLeveling(catastral, catastralSite, spec, userId, "tercer_orden");
    console.log(`  ✓ Proceso de nivelación: ${spec.name}`);
  }

  const monitoreo = await createProject(userId, {
    name: "Edificio en monitoreo",
    client: "Cliente Demo",
    location: "Bogotá",
    datum: "MAGNA-SIRGAS",
    projection: "Origen Bogotá",
    precision_order: "tercer_orden",
    equipment_brand: "Leica",
    equipment_model: "DNA03",
    equipment_serial: "LDN-2026-003",
    angular_precision_seconds: 5,
    linear_precision: "3+2ppm",
    equipment_calibration_date: "2026-01-20",
  });
  console.log(`  ✓ Proyecto "Edificio en monitoreo" — ${monitoreo}`);

  const settlementSiteId = await insertSettlementSite(monitoreo);
  console.log(
    `  ✓ Lugar "Edificio Torre Central" con ${SETTLEMENT_POINTS.length} puntos y ${VISIT_DATES.length} visitas — ${settlementSiteId}`,
  );

  console.log("");
  console.log("Seed listo. Para verificar:");
  console.log(`  1. Abre ${APP_URL}/sign-in`);
  console.log(`  2. Email: ${EMAIL}`);
  console.log(`  3. Password: ${PASSWORD}`);
  console.log(
    "  4. Sigue docs/testing/manual-e2e-poligonal.md para el recorrido.",
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
