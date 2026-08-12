// Seed para verificación manual de los módulos poligonal y nivelación.
//
// Crea (idempotente — borra y recrea):
//  - Un usuario seed@topofield.local con password fijo.
//  - 2 proyectos (uno de tercer_orden, otro de primer_orden).
//  - 7 procesos poligonales precargados que cubren los 3 tipos, los 3 métodos
//    y los estados closed / rejected.
//  - 1 proceso de nivelación cerrada calculado, para las capturas del manual.
//  - Algunos reference_points para probar el CRUD de la tab Configuración.
//
// Uso: con `npx supabase start` activo, ejecutar
//   `node --env-file=.env.local scripts/seed.mjs`
// (lee SUPABASE_SECRET_KEY desde .env.local).

import { createClient } from "@supabase/supabase-js";
import { computePolygonal } from "../src/lib/calculations/polygonal.ts";
import { computeLeveling } from "../src/lib/calculations/leveling.ts";
import { dmsToDecimal } from "../src/lib/calculations/angles.ts";

const URL = "http://127.0.0.1:54321";
const SECRET = process.env.SUPABASE_SECRET_KEY;
if (!SECRET) {
  console.error(
    "Falta SUPABASE_SECRET_KEY. Corré con: node --env-file=.env.local scripts/seed.mjs",
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
    angular_error_seconds: r.angularError,
    linear_error: r.linearError,
    perimeter: r.perimeter,
    relative_precision:
      rel == null ? null : rel === Infinity ? "1:∞" : `1:${Math.round(rel)}`,
    meets_tolerance: r.meetsTolerance,
  };
}

/** ¿El status representa un proceso ya cerrado (y por tanto inmutable)? */
function isClosedStatus(status) {
  return status === "closed" || status === "rejected";
}

async function insertPolygonal(projectId, spec, userId, order) {
  const startAz = spec.startAz ?? [0, 0, 0];
  const endAz = spec.endAz ?? [null, null, null];
  const { data: proc, error } = await admin
    .from("polygonal_processes")
    .insert({
      project_id: projectId,
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
      ...resultFieldsFor(spec, order),
      notes: spec.notes ?? null,
    })
    .select("id")
    .single();
  if (error) throw error;

  const rows = spec.stations.map((st, i) => ({
    process_id: proc.id,
    station_order: i + 1,
    point_code: st.code,
    angle_deg: st.angle?.[0] ?? null,
    angle_min: st.angle?.[1] ?? null,
    angle_sec: st.angle?.[2] ?? null,
    deflection_direction: st.dir ?? null,
    horizontal_distance: st.distance ?? null,
  }));
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
async function insertLeveling(projectId, spec, userId, order) {
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

  await insertReferencePoints(catastral, REFERENCE_POINTS);
  console.log(
    `  ✓ ${REFERENCE_POINTS.length} puntos de referencia en "Lote catastral"`,
  );

  // Los 7 procesos van al proyecto "Lote catastral" (tercer_orden): el mismo
  // orden de precisión con el que `computePolygonal` evalúa sus tolerancias.
  for (const spec of PROCESSES) {
    await insertPolygonal(catastral, spec, userId, "tercer_orden");
    console.log(`  ✓ Proceso: ${spec.name} (${spec.status})`);
  }

  for (const spec of LEVELING_PROCESSES) {
    await insertLeveling(catastral, spec, userId, "tercer_orden");
    console.log(`  ✓ Proceso de nivelación: ${spec.name}`);
  }

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
