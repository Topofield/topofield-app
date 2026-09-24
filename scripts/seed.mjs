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
//  - 2 procesos de nivelación: uno calculado (editable, para la captura del
//    editor del manual) y uno cerrado (alimenta el informe de nivelación).
//  - 2 lugares de monitoreo (`edificio`) en "Edificio en monitoreo": "Torre
//    Central" (6 puntos × 6 visitas, ABIERTO/editable para las capturas) y
//    "Edificio Norte" (4 × 3, CERRADO, para el informe de asentamientos).
//  - 3 informes por proceso: poligonal y nivelación en "Lote catastral",
//    asentamientos en "Edificio en monitoreo".
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
import { azimuthFromCoordinates } from "../src/lib/calculations/angles.ts";
import {
  CARTERAS,
  CARTERA_TT4,
  CARTERA_VIVERO,
} from "../src/lib/demo/carteras.ts";
import {
  computeLeveling,
  totalDistanceFromReadings,
} from "../src/lib/calculations/leveling.ts";
import { computeHistory } from "../src/lib/calculations/settlement.ts";
import { thresholdsFor } from "../src/lib/calculations/tolerances.ts";
import { decimalToDms, dmsToDecimal } from "../src/lib/calculations/angles.ts";

// El puerto se lee de .env.local (que `npm run seed` carga con --env-file), no
// se hardcodea, para que un cambio de puertos en config.toml no exija tocar
// este script. El fallback es el puerto local actual del proyecto.
const URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ??
  process.env.SUPABASE_URL ??
  "http://127.0.0.1:55321";
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
  if (existing) {
    // Borrar el usuario no arrastra sus proyectos (`projects_user_id_fkey` no
    // es en cascada) y los procesos cerrados son inmutables, así que sobre una
    // base con datos el borrado falla. Sin comprobarlo, el error se perdía y
    // el seed moría después con un `email_exists` que no explica nada.
    const { error: deleteError } = await admin.auth.admin.deleteUser(existing.id);
    if (deleteError) {
      throw new Error(
        `No se pudo borrar ${EMAIL} (${deleteError.message}). El seed necesita una base recién reseteada: ejecuta \`npx supabase db reset\` y repite.`,
      );
    }
  }
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
  const { data, error } = await admin
    .from("reference_points")
    .insert(rows)
    .select("id, code");
  if (error) throw error;
  return data;
}

/**
 * Convierte una cartera de campo real (docs/carteras/) en un spec del seed.
 *
 * Los datos son los mismos que verifican los tests del motor: si el seed los
 * replicara aparte, dejaría de comprobar lo mismo.
 */
function carteraToSpec(cartera, referencePointId, method, status) {
  return {
    name: `${cartera.name} — ${method}`,
    type: "closed",
    angle_type: cartera.angleType,
    hasOrientation: cartera.hasOrientation,
    hasClosingRow: cartera.hasClosingRow,
    referencePointId,
    referencePointCode: cartera.referencePointCode,
    angleReadingsMin: 1,
    startPointCode: cartera.startPointCode,
    startNorth: cartera.startNorth,
    startEast: cartera.startEast,
    startAz: decimalToDmsTuple(
      azimuthFromCoordinates(
        cartera.startNorth,
        cartera.startEast,
        cartera.referenceNorth,
        cartera.referenceEast,
      ),
    ),
    correctionMethod: method,
    status,
    stations: cartera.stations.map((st) => ({
      code: st.pointCode,
      angle: st.readings[0],
      distance: st.distance,
    })),
    notes: `Cartera de campo real transcrita de docs/carteras/. Amarre en ${cartera.referencePointCode}, azimut calculado desde sus coordenadas.`,
  };
}

/**
 * Columnas de equipo y precisión que un spec de proceso o de visita lleva
 * incorporadas (Fase 8). Se listan por nombre para que `...spec` en el INSERT
 * no arrastre las claves del fixture (`stations`, `notes`, `startNorth`…).
 */
const EQUIPMENT_COLUMNS = [
  "precision_order",
  "equipment_brand",
  "equipment_model",
  "equipment_serial",
  "equipment_calibration_date",
  "angular_precision_seconds",
  "distance_precision_mm",
  "distance_precision_ppm",
  "level_type",
  "km_precision_mm",
];

/**
 * Extrae del spec el equipo que lleva encima.
 *
 * El equipo viaja SOBRE el spec —el mismo patrón de `src/lib/demo/fixtures.ts`,
 * que lo esparce con `...EQUIPO_DEMO`— y nunca emparejado por posición con un
 * array paralelo de equipos: con `equipos[i]` basta reordenar o insertar un
 * proceso para que un instrumento acabe en el proceso equivocado, sin que nada
 * falle ni avise.
 */
function equipmentOf(spec) {
  const campos = {};
  for (const k of EQUIPMENT_COLUMNS) {
    if (spec[k] !== undefined) campos[k] = spec[k];
  }
  return campos;
}

/** DMS como tupla [g, m, s], que es lo que consume el spec del seed. */
function decimalToDmsTuple(decimal) {
  const { deg, min, sec } = decimalToDms(decimal);
  return [deg, min, sec];
}

/**
 * Inserta un informe (§ 4.7) con la misma forma que arma `createReportAction`.
 * `included` es la lista `[{ type, id, name, order }]`, con type 'polygonal' |
 * 'leveling' | 'site'. Solo debe apuntar a trabajos ya cerrados.
 */
async function insertReport(projectId, userId, { title, observations, included }) {
  const { error } = await admin.from("reports").insert({
    project_id: projectId,
    title,
    included_processes: included,
    observations: observations ?? null,
    generated_by: userId,
  });
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
    angleType: spec.angle_type,
    hasOrientation: spec.hasOrientation ?? false,
    hasClosingRow: spec.hasClosingRow ?? false,
    stations: spec.stations.map((st) => ({
      pointCode: st.code,
      angle: st.angle ? dmsToDecimal(...st.angle) : Number.NaN,
      deflectionDirection: st.dir ?? null,
      distance: st.distance ?? null,
      readings: st.angle ? [{ order: 1, angle: dmsToDecimal(...st.angle) }] : [],
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

async function insertPolygonal(projectId, siteId, spec, userId) {
  const equipo = equipmentOf(spec);
  const startAz = spec.startAz ?? [0, 0, 0];
  const endAz = spec.endAz ?? [null, null, null];
  // El orden que evalúa el motor es el mismo que declara el equipo del
  // proceso: una sola fuente, sin riesgo de que calen valores distintos.
  const resultado = resultFieldsFor(spec, equipo.precision_order);
  const { data: proc, error } = await admin
    .from("polygonal_processes")
    .insert({
      project_id: projectId,
      site_id: siteId,
      name: spec.name,
      type: spec.type,
      angle_type: spec.angle_type,
      // Fase 13 (P1): formato de captura de ángulos. Solo la vista; los
      // ángulos se siguen guardando en DMS.
      angle_input_format: spec.angleInputFormat ?? "dms",
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
      reference_point_id: spec.referencePointId ?? null,
      reference_point_code: spec.referencePointCode ?? null,
      // Los fixtures y las carteras se transcriben con UNA lectura por ángulo:
      // es lo que hay en el papel. El mínimo de 3 es para captura nueva.
      angle_readings_min: spec.angleReadingsMin ?? 1,
      has_closing_row: spec.hasClosingRow ?? false,
      // El proceso nace abierto aunque el fixture lo quiera cerrado: los
      // triggers de inmutabilidad rechazan escribir estaciones bajo un proceso
      // ya cerrado. El cierre se aplica al final, como hace la aplicación.
      status: isClosedStatus(spec.status) ? "calculated" : spec.status,
      ...equipo,
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
    const { data: inserted, error: stErr } = await admin
      .from("polygonal_stations")
      .insert(rows)
      .select("id, station_order");
    if (stErr) throw stErr;

    // Las carteras reales traen una sola lectura por ángulo: es lo que hay en
    // el Excel. La reiteración es capacidad de la app, no dato de esas hojas.
    const readingRows = spec.stations.flatMap((st, i) => {
      const stationId = inserted.find((r) => r.station_order === i + 1)?.id;
      if (!stationId || !st.angle) return [];
      return [
        {
          station_id: stationId,
          reading_order: 1,
          angle_deg: st.angle[0],
          angle_min: st.angle[1],
          angle_sec: st.angle[2],
        },
      ];
    });
    if (readingRows.length > 0) {
      const { error: rdErr } = await admin
        .from("polygonal_angle_readings")
        .insert(readingRows);
      if (rdErr) throw rdErr;
    }
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
// `userId` no hace falta: `leveling_processes` no lo lleva y el cierre de
// estos fixtures no pasa por `closed_by`.
async function insertLeveling(projectId, siteId, spec, userId) {
  const equipo = equipmentOf(spec);
  const input = {
    type: spec.type,
    startElevation: spec.startElevation,
    endElevation: spec.endElevation ?? null,
    // Mismo criterio que insertPolygonal: el orden que evalúa el motor es el
    // que declara el equipo del proceso.
    order: equipo.precision_order,
    forward: spec.forward.map((r) => ({
      pointCode: r.code,
      pointType: r.type,
      backsight: r.back ?? null,
      foresight: r.fore ?? null,
      backUpperM: r.backUpperM ?? null,
      backLowerM: r.backLowerM ?? null,
      foreUpperM: r.foreUpperM ?? null,
      foreLowerM: r.foreLowerM ?? null,
      backDistanceM: r.backDistanceM ?? null,
      foreDistanceM: r.foreDistanceM ?? null,
      distanceAccumulatedKm: null,
    })),
    return: spec.return
      ? spec.return.map((r) => ({
          pointCode: r.code,
          pointType: r.type,
          backsight: r.back ?? null,
          foresight: r.fore ?? null,
          backUpperM: r.backUpperM ?? null,
          backLowerM: r.backLowerM ?? null,
          foreUpperM: r.foreUpperM ?? null,
          foreLowerM: r.foreLowerM ?? null,
          backDistanceM: r.backDistanceM ?? null,
          foreDistanceM: r.foreDistanceM ?? null,
          distanceAccumulatedKm: null,
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
      // Derivada de las distancias por visual, como en el editor real.
      total_distance_km: totalDistanceFromReadings(input.forward),
      // Nace calculado aunque el fixture lo quiera cerrado: los triggers de
      // inmutabilidad rechazan escribir lecturas bajo un proceso ya cerrado
      // (mismo motivo que en insertPolygonal). El cierre se aplica al final.
      status: "calculated",
      ...equipo,
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
        back_upper_m: draft.backUpperM ?? null,
        back_lower_m: draft.backLowerM ?? null,
        fore_upper_m: draft.foreUpperM ?? null,
        fore_lower_m: draft.foreLowerM ?? null,
        back_distance_m: r?.backDistanceResolvedM ?? null,
        fore_distance_m: r?.foreDistanceResolvedM ?? null,
        distance_accumulated_km: r?.distanceAccumulatedKm ?? null,
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

  // Cierre diferido, una vez cargadas las lecturas (igual que insertPolygonal).
  if (spec.status === "closed") {
    const { error: closeErr } = await admin
      .from("leveling_processes")
      .update({
        status: "closed",
        closed_at: new Date().toISOString(),
        closed_by: userId,
      })
      .eq("id", proc.id);
    if (closeErr) throw closeErr;
  }

  return proc.id;
}

// ----------------------------------------------------------------------------
// Equipos coherentes con el orden de cada proceso (Fase 8).
//
// El orden y el equipo dejaron de vivir en `projects` y ahora los declara
// cada proceso. Este seed conserva el emparejamiento que el proyecto ya
// tenía: "Lote catastral" con estación de 5″ y tercer orden, "Red geodésica"
// con estación de 1″ y primer orden. Cifras verificadas contra la ficha
// técnica publicada de cada modelo (no contra el rango genérico de la ISO):
//  - Estación total 5″: Leica FlexLine TS06plus — 5″ es una de sus clases de
//    precisión angular de catálogo (2″/3″/5″); EDM con prisma 1.5 mm + 2 ppm.
//  - Estación total 1″: Trimble S9 — 1″ es una de sus dos clases angulares
//    (0.5″/1″); EDM con prisma 1.0 mm + 2 ppm.
//  - Nivel digital: Trimble/Zeiss DiNi 12 — σ = 0.3 mm/km en doble
//    nivelación con mira de ínvar de código de barras, y 1.0 mm/km con mira
//    ordinaria (no ínvar). Se usa la cifra de mira ordinaria (1.0 mm/km): es
//    el emparejamiento de campo realista para trabajo de tercer orden, y deja
//    el equipo cómodamente dentro del coeficiente de tercer orden (K = 12
//    mm/km) sin que el margen sea tan ancho que la coherencia deje de verse.
// ----------------------------------------------------------------------------

const TOTAL_STATION_TERCER_ORDEN = {
  precision_order: "tercer_orden",
  equipment_brand: "Leica",
  equipment_model: "TS06 Plus",
  equipment_serial: "LCS-2026-001",
  equipment_calibration_date: "2026-02-10",
  angular_precision_seconds: 5,
  distance_precision_mm: 1.5,
  distance_precision_ppm: 2,
};

const TOTAL_STATION_PRIMER_ORDEN = {
  precision_order: "primer_orden",
  equipment_brand: "Trimble",
  equipment_model: "S9",
  equipment_serial: "TRB-2026-009",
  equipment_calibration_date: "2026-03-15",
  angular_precision_seconds: 1,
  distance_precision_mm: 1,
  distance_precision_ppm: 2,
};

// Fixture deliberada del aviso de equipo insuficiente: primer orden
// (K = 1″) capturado con una estación de 5″, muy por debajo de lo exigido.
// El nombre y las notas del proceso lo dejan explícito — es un fixture del
// aviso, no un dato mal capturado que alguien deba corregir después.
const TOTAL_STATION_INSUFICIENTE = {
  precision_order: "primer_orden",
  equipment_brand: "Genérica",
  equipment_model: "TS-5",
  equipment_serial: "S/N 000",
  equipment_calibration_date: null,
  angular_precision_seconds: 5,
  distance_precision_mm: 5,
  distance_precision_ppm: 5,
};

// 1.0 mm/km es la cifra ISO 17123-2 del DiNi 12 con mira ordinaria (no
// ínvar) — ver el comentario de cabecera de este bloque.
const LEVEL_DIGITAL_TERCER_ORDEN = {
  precision_order: "tercer_orden",
  equipment_brand: "Trimble",
  equipment_model: "DiNi 12",
  equipment_serial: "TDN-2026-011",
  equipment_calibration_date: "2026-01-05",
  level_type: "digital",
  km_precision_mm: 1.0,
};

// Mismo modelo que el de nivelación pero otra unidad física: es el nivel del
// programa de monitoreo del edificio, un proyecto distinto.
const LEVEL_DIGITAL_MONITOREO = {
  precision_order: "tercer_orden",
  equipment_brand: "Trimble",
  equipment_model: "DiNi 12",
  equipment_serial: "TDN-2025-014",
  equipment_calibration_date: "2024-12-20",
  level_type: "digital",
  km_precision_mm: 1.0,
};

// El nivel de respaldo del programa de monitoreo, para la campaña de abril.
// Un automático Leica NA720: 2.5 mm/km de catálogo (ISO 17123-2), holgado
// dentro del K = 12 mm de tercer orden, así que la visita sigue siendo
// coherente y no dispara el aviso de equipo insuficiente. Existe porque
// entre una campaña y la siguiente pueden pasar meses y cambiar el
// instrumento — que es la razón de ser de esta fase— y el seed no lo
// demostraba en ninguna parte.
const LEVEL_AUTOMATICO_RESPALDO = {
  precision_order: "tercer_orden",
  equipment_brand: "Leica",
  equipment_model: "NA720",
  equipment_serial: "LNA-2023-047",
  equipment_calibration_date: "2024-11-08",
  level_type: "automatico",
  km_precision_mm: 2.5,
};

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
    angle_type: "interior",
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
    angle_type: "interior",
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
    angle_type: "interior",
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
    angle_type: "interior",
    // Transcrito de una libreta en grados decimales (Fase 13, P1): el editor
    // abre en ese formato.
    angleInputFormat: "decimal",
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
    angle_type: "interior",
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
    angle_type: "interior",
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

// Procesos de "Red geodésica" (primer orden). Cuadrados que cierran exacto a
// propósito: el error de cierre no es el punto aquí, lo es el contraste entre
// equipo y orden, así que la geometría se deja limpia para que el único aviso
// visible sea el de equipo insuficiente.
const GEODESICA_PROCESSES = [
  {
    name: "Cuadrado de control 200×4 (red geodésica)",
    type: "closed",
    angle_type: "interior",
    startPointCode: "G1",
    startNorth: 5000,
    startEast: 5000,
    startAz: [0, 0, 0],
    correctionMethod: "bowditch",
    status: "calculated",
    ...TOTAL_STATION_PRIMER_ORDEN,
    stations: [
      { code: "G1", angle: [90, 0, 0], distance: 200 },
      { code: "G2", angle: [90, 0, 0], distance: 200 },
      { code: "G3", angle: [90, 0, 0], distance: 200 },
      { code: "G4", angle: [90, 0, 0], distance: 200 },
    ],
    notes:
      "Cuadrado de control que cierra exacto. Primer orden (K=1″) con estación de 1″: el equipo alcanza justo la tolerancia angular exigida, sin aviso.",
  },
  {
    name: "Poligonal con equipo insuficiente (fixture del aviso)",
    type: "closed",
    angle_type: "interior",
    startPointCode: "H1",
    startNorth: 5200,
    startEast: 5200,
    startAz: [0, 0, 0],
    correctionMethod: "bowditch",
    status: "calculated",
    ...TOTAL_STATION_INSUFICIENTE,
    stations: [
      { code: "H1", angle: [90, 0, 0], distance: 150 },
      { code: "H2", angle: [90, 0, 0], distance: 150 },
      { code: "H3", angle: [90, 0, 0], distance: 150 },
      { code: "H4", angle: [90, 0, 0], distance: 150 },
    ],
    notes:
      "Fixture deliberada del aviso de equipo insuficiente: declara primer orden (K=1″) pero se captura con una estación de 5″ genérica, muy por debajo de lo exigido. No es un dato mal capturado — es a propósito, para ver el aviso sin tener que teclearlo.",
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
    // Nivel AUTOMÁTICO: es el que lee los tres hilos sobre la mira y obtiene
    // la distancia por taquimetría. Un digital entregaría la distancia y no
    // se leerían hilos, así que declararlo digital contradiría sus datos.
    equipment_brand: "Leica",
    equipment_model: "NA2",
    equipment_serial: "LNA2-2025-003",
    equipment_calibration_date: "2025-11-10",
    level_type: "automatico",
    km_precision_mm: 0.7,
    // Los tres hilos de cada visual, como los captura un nivel automático. El
    // hilo medio ES la lectura, y la distancia sale por taquimetría:
    // (HS − HI)·100 = 150 m en cada visual → 0.900 km de recorrido.
    forward: [
      {
        code: "BM-1",
        type: "bm",
        back: 1.5,
        backUpperM: 2.25,
        backLowerM: 0.75,
      },
      {
        code: "PC-1",
        type: "pc",
        fore: 1.2,
        foreUpperM: 1.95,
        foreLowerM: 0.45,
        back: 2.0,
        backUpperM: 2.75,
        backLowerM: 1.25,
      },
      {
        code: "PC-2",
        type: "pc",
        fore: 2.5,
        foreUpperM: 3.25,
        foreLowerM: 1.75,
        back: 1.0,
        backUpperM: 1.75,
        backLowerM: 0.25,
      },
      {
        code: "BM-1",
        type: "bm",
        fore: 0.808,
        foreUpperM: 1.558,
        foreLowerM: 0.058,
      },
    ],
    notes:
      "Circuito cerrado de verificación: sale y vuelve a BM-1. Error de cierre −8.0 mm contra tolerancia 11.4 mm (K=12 · √0.9 km). Cumple tercer orden.",
  },
  // Segunda nivelación, cerrada oficialmente: es la que alimenta el informe de
  // nivelación. La de arriba se deja calculada (editable) para la captura del
  // editor de nivelación del manual. Mismos números verificados que BM-1.
  {
    name: "Circuito BM-2 (cerrado oficialmente)",
    type: "closed",
    startBmCode: "BM-2",
    startElevation: 100.0,
    status: "closed",
    equipment_brand: "Leica",
    equipment_model: "NA2",
    equipment_serial: "LNA2-2025-003",
    equipment_calibration_date: "2025-11-10",
    level_type: "automatico",
    km_precision_mm: 0.7,
    forward: [
      { code: "BM-2", type: "bm", back: 1.5, backUpperM: 2.25, backLowerM: 0.75 },
      {
        code: "PC-1",
        type: "pc",
        fore: 1.2,
        foreUpperM: 1.95,
        foreLowerM: 0.45,
        back: 2.0,
        backUpperM: 2.75,
        backLowerM: 1.25,
      },
      {
        code: "PC-2",
        type: "pc",
        fore: 2.5,
        foreUpperM: 3.25,
        foreLowerM: 1.75,
        back: 1.0,
        backUpperM: 1.75,
        backLowerM: 0.25,
      },
      { code: "BM-2", type: "bm", fore: 0.808, foreUpperM: 1.558, foreLowerM: 0.058 },
    ],
    notes:
      "Mismo circuito de verificación, cerrado oficialmente para el informe de nivelación. El editor lo abre en solo lectura.",
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
  // Fase 11 — los dos casos del estado de los BMs, para las capturas y para
  // verificar contra la base que ninguna lectura cae fuera de vigencia.
  //
  // P-07: dado de ALTA en la visita 2 (15/03), en la ampliación de la fachada
  // este. Sin C0: su línea base es su primera lectura. `seed_base_elevation`
  // no es una columna; es la cota con la que el seed genera esa primera
  // lectura, y se descarta antes del insert.
  {
    code: "P-07",
    location_description: "Ampliación, fachada este",
    northing: 1985.0,
    easting: 1045.0,
    initial_elevation: null,
    active_from: "2025-03-15",
    seed_base_elevation: 100.25,
  },
];

/**
 * Baja de P-05 (Fase 11): la obra del andén sur lo destruyó después de la
 * visita 3 (15/04). `retired_on` es la primera fecha en que ya no se mide.
 * Se aplica DESPUÉS de insertar las lecturas: la baja no borra nada, y sus
 * cuatro lecturas siguen siendo historia válida.
 */
const SETTLEMENT_RETIREMENTS = [
  { code: "P-05", retired_on: "2025-05-01", retirement_reason: "Destruido por la obra del andén sur." },
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
  // Fase 12 — lectura fuera de tendencia: en la visita 5, P-04 SUBE 7.0 mm
  // en vez de bajar 0.7. Es tercer orden (margen 6 mm), así que sale como
  // «contraria». De paso muestra la confusión que la fase deshace: la
  // velocidad de esa visita (≈ 6.9 mm/mes) pone el semáforo en Alerta y el
  // indicador marca «acelerando», cuando lo probable es una lectura mal tomada.
  "P-04": [0, -4.5, -2.8, -1.7, -1.1, 7.0],
  // `null` = el punto no se midió en esa visita: P-05 está de baja desde la
  // visita 4 y P-07 se dio de alta en la 2 (Fase 11).
  "P-05": [0, -9.0, -5.0, -3.0, null, null],
  "P-06": [0, -24.0, -13.0, -7.0, -4.0, -2.5],
  "P-07": [null, null, 0, -2.6, -1.5, -0.9],
};

// Las seis campañas. El equipo va SOBRE cada visita, no compartido por el
// lugar: el instrumento puede cambiar entre campañas —de eso trata la Fase
// 8— y la de abril se levantó con el nivel de respaldo porque el digital
// estaba en calibración. Las otras cinco usan el nivel habitual.
const VISIT_SPECS = [
  { date: "2025-01-15", ...LEVEL_DIGITAL_MONITOREO },
  { date: "2025-02-15", ...LEVEL_DIGITAL_MONITOREO },
  { date: "2025-03-15", ...LEVEL_DIGITAL_MONITOREO },
  { date: "2025-04-15", ...LEVEL_AUTOMATICO_RESPALDO },
  { date: "2025-05-15", ...LEVEL_DIGITAL_MONITOREO },
  { date: "2025-06-15", ...LEVEL_DIGITAL_MONITOREO },
];

// Segundo lugar de monitoreo, compacto (4 puntos × 3 visitas) y cerrado, cuyo
// único fin es alimentar el informe de asentamientos. Se deja aparte de "Torre
// Central" —que queda ABIERTO y editable para las capturas del editor de lugar
// y de visita del manual— para no volver esas capturas de solo lectura.
const NORTE_POINTS = [
  { code: "N-01", location_description: "Esquina NW", northing: 3000.0, easting: 2000.0, initial_elevation: 100.0 },
  { code: "N-02", location_description: "Esquina NE", northing: 3000.0, easting: 2020.0, initial_elevation: 100.0 },
  { code: "N-03", location_description: "Esquina SW", northing: 2985.0, easting: 2000.0, initial_elevation: 100.0 },
  { code: "N-04", location_description: "Esquina SE (mayor carga)", northing: 2985.0, easting: 2020.0, initial_elevation: 100.0 },
];

const NORTE_PARTIALS_MM = {
  "N-01": [0, -2.0, -1.2],
  "N-02": [0, -2.4, -1.4],
  "N-03": [0, -2.8, -1.6],
  "N-04": [0, -6.0, -3.2],
};

const NORTE_VISIT_DATES = ["2025-01-20", "2025-02-20", "2025-03-20"];

/**
 * Cota de un punto en una visita: su cota base más el acumulado, o null si el
 * punto no se midió en esa visita. La base es la C0 o, en un punto de alta sin
 * C0, `seed_base_elevation` (Fase 11).
 */
function cotaEn(partialsMm, point, visitIndex) {
  const serie = partialsMm[point.code];
  if (serie[visitIndex] === null) return null;
  const acumuladoMm = serie
    .slice(0, visitIndex + 1)
    .reduce((a, b) => a + (b ?? 0), 0);
  const base = point.initial_elevation ?? point.seed_base_elevation;
  return Number((base + acumuladoMm / 1000).toFixed(4));
}

/**
 * Crea un lugar de monitoreo, su catálogo de puntos y sus visitas, con los
 * resultados calculados por `computeHistory` — nunca escritos a mano. Cierra el
 * lugar al final si `cfg.close` es true.
 *
 * `cfg`: { name, description, points, partialsMm, visitDates, operator?,
 * equipment?, close? }. `points` usa nombres de columna (`initial_elevation`).
 */
async function insertSettlementSite(projectId, userId, cfg) {
  // Los umbrales no se envían: los DEFAULT de la tabla `sites` son los mismos
  // que `thresholdsFor("edificio")` (velocity 2/5/10, accumulated 25/50/75,
  // distorsión 1/500), así que el lugar queda coherente con el preset del
  // motor sin duplicar las constantes aquí.
  const siteId = await createSite(projectId, {
    name: cfg.name,
    description: cfg.description,
    structure_type: "edificio",
  });

  const { data: pointRows, error: pointsErr } = await admin
    .from("settlement_points")
    .insert(
      cfg.points.map((p) => {
        // `seed_base_elevation` no es una columna: solo genera las cotas.
        const row = { site_id: siteId, ...p };
        delete row.seed_base_elevation;
        return row;
      }),
    )
    .select("id, code");
  if (pointsErr) throw pointsErr;

  const pointIdByCode = new Map(pointRows.map((p) => [p.code, p.id]));

  // --- Motor real: computeHistory calcula parciales, acumulados, velocidad
  // y nivel de alerta a partir únicamente de las cotas medidas. ------------
  const points = cfg.points.map((p) => ({
    id: pointIdByCode.get(p.code),
    code: p.code,
    northing: p.northing,
    easting: p.easting,
    initialElevation: p.initial_elevation,
    activeFrom: p.active_from ?? null,
    // La baja se aplica al final (ver `cfg.retirements`); para el motor no
    // cambia nada: calcula sobre las lecturas que existen.
    retiredOn: null,
  }));

  const visits = cfg.visitSpecs.map((spec, i) => ({
    id: `visita-${i}`, // id provisional, solo para casar con el resultado de computeHistory
    visitNumber: i,
    date: spec.date,
    readings: cfg.points
      .map((p) => ({
        pointId: pointIdByCode.get(p.code),
        elevation: cotaEn(cfg.partialsMm, p, i),
      }))
      .filter((r) => r.elevation !== null),
  }));

  const history = computeHistory(points, visits, thresholdsFor("edificio"));

  // El equipo se recupera por FECHA, no por posición en el array: la fecha es
  // la identidad de la campaña, y así reordenar las visitas no puede mover un
  // instrumento a otra. Sale de `cfg`, no del array global: la función sirve a
  // los dos lugares que siembra el seed.
  const specPorFecha = new Map(cfg.visitSpecs.map((v) => [v.date, v]));

  for (const visitResult of history.visits) {
    const visitSpec = specPorFecha.get(visitResult.date);
    if (!visitSpec) throw new Error(`Visita sin spec: ${visitResult.date}`);
    const { data: visitRow, error: visitErr } = await admin
      .from("settlement_visits")
      .insert({
        site_id: siteId,
        visit_number: visitResult.visitNumber,
        date: visitResult.date,
        operator: cfg.operator ?? "Seed TopoField",
        ...equipmentOf(visitSpec),
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

  // Bajas (Fase 11), una vez insertadas las lecturas: el trigger de vigencia
  // rechazaría la baja si alguna lectura quedara en o después de su fecha.
  for (const baja of cfg.retirements ?? []) {
    const { error: bajaErr } = await admin
      .from("settlement_points")
      .update({
        retired_on: baja.retired_on,
        retirement_reason: baja.retirement_reason,
      })
      .eq("id", pointIdByCode.get(baja.code));
    if (bajaErr) throw bajaErr;
  }

  // Cierre diferido: cerrar el lugar bloquea por trigger toda escritura sobre
  // sus visitas y lecturas, así que va al final, una vez cargado todo.
  if (cfg.close) {
    const { error: closeErr } = await admin
      .from("sites")
      .update({
        status: "closed",
        closed_at: new Date().toISOString(),
        closed_by: userId,
      })
      .eq("id", siteId);
    if (closeErr) throw closeErr;
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
  });
  console.log(`  ✓ Proyecto "Lote catastral" — ${catastral}`);

  const geodesica = await createProject(userId, {
    name: "Red geodésica",
    client: "Cliente Demo",
    location: "Bogotá",
    datum: "MAGNA-SIRGAS",
  });
  console.log(`  ✓ Proyecto "Red geodésica" — ${geodesica}`);

  // `site_id` es NOT NULL en polygonal_processes/leveling_processes desde la
  // Fase 5: cada proyecto necesita su lugar antes de insertar procesos. Este
  // es un lugar genérico ("otro"), sin relación con el control de
  // asentamientos — el levantamiento del lote no monitorea una estructura.
  const catastralSite = await createSite(catastral, {
    name: "General",
    description: "Lugar genérico para los procesos de poligonal y nivelación del lote.",
    structure_type: "otro",
  });
  const geodesicaSite = await createSite(geodesica, {
    name: "General",
    description: "Lugar genérico para los procesos de la red geodésica.",
    structure_type: "otro",
  });

  // Los amarres de las carteras reales entran al catálogo como puntos de
  // control: es lo que son, puntos de coordenadas conocidas.
  const amarres = CARTERAS.map((c) => ({
    code: c.referencePointCode,
    type: "control",
    north: c.referenceNorth,
    east: c.referenceEast,
    description: `Amarre de la ${c.name}`,
  }));
  const puntos = await insertReferencePoints(catastral, [
    ...REFERENCE_POINTS,
    ...amarres,
  ]);
  const idPorCodigo = new Map(puntos.map((p) => [p.code, p.id]));
  console.log(
    `  ✓ ${puntos.length} puntos de referencia en "Lote catastral"`,
  );

  // Los procesos van al proyecto "Lote catastral" (tercer orden), con la
  // estación de 5″ que le corresponde. El equipo se esparce sobre el spec, no
  // se pasa aparte: los siete comparten instrumento, así que se aplica de una
  // vez, y un spec podría sobrescribirlo declarando el suyo (`...spec` va
  // después). Se captura cuál quedó cerrada: alimenta su informe.
  let poligonalCerrada = null;
  for (const spec of PROCESSES) {
    const id = await insertPolygonal(
      catastral,
      catastralSite,
      { ...TOTAL_STATION_TERCER_ORDEN, ...spec },
      userId,
    );
    if (spec.status === "closed") poligonalCerrada = { id, name: spec.name };
    console.log(`  ✓ Proceso: ${spec.name} (${spec.status})`);
  }

  // Las dos carteras de campo reales. La TT4 se siembra con los tres métodos
  // para poder compararlos lado a lado contra el Excel; la Vivero con Bowditch,
  // porque su ajuste por mínimos cuadrados llega en la Fase 14.
  const carteraSpecs = [
    ...["bowditch", "transit", "crandall"].map((m) =>
      carteraToSpec(CARTERA_TT4, idPorCodigo.get(CARTERA_TT4.referencePointCode), m, "calculated"),
    ),
    carteraToSpec(
      CARTERA_VIVERO,
      idPorCodigo.get(CARTERA_VIVERO.referencePointCode),
      "bowditch",
      "calculated",
    ),
  ];
  for (const spec of carteraSpecs) {
    await insertPolygonal(
      catastral,
      catastralSite,
      { ...TOTAL_STATION_TERCER_ORDEN, ...spec },
      userId,
    );
    console.log(`  ✓ Cartera real: ${spec.name}`);
  }

  let nivelacionCerrada = null;
  for (const spec of LEVELING_PROCESSES) {
    const id = await insertLeveling(
      catastral,
      catastralSite,
      { ...LEVEL_DIGITAL_TERCER_ORDEN, ...spec },
      userId,
    );
    if (spec.status === "closed") nivelacionCerrada = { id, name: spec.name };
    console.log(
      `  ✓ Proceso de nivelación: ${spec.name}${spec.status === "closed" ? " (cerrado)" : ""}`,
    );
  }

  // "Red geodésica": el emparejamiento primer orden + estación de 1″ que el
  // proyecto ya tenía, más la fixture deliberada del aviso de equipo
  // insuficiente (mismo primer orden, estación de 5″). Aquí cada proceso
  // lleva SU equipo declarado en su propio literal: son distintos, y un array
  // paralelo emparejado por índice era exactamente lo frágil que había que
  // quitar.
  for (const spec of GEODESICA_PROCESSES) {
    await insertPolygonal(geodesica, geodesicaSite, spec, userId);
    console.log(`  ✓ Proceso: ${spec.name} (${spec.status})`);
  }

  const monitoreo = await createProject(userId, {
    name: "Edificio en monitoreo",
    client: "Cliente Demo",
    location: "Bogotá",
    datum: "MAGNA-SIRGAS",
    projection: "Origen Bogotá",
  });
  console.log(`  ✓ Proyecto "Edificio en monitoreo" — ${monitoreo}`);

  const settlementSiteId = await insertSettlementSite(monitoreo, userId, {
    name: "Edificio Torre Central",
    description:
      "Edificio de 6 niveles sobre arcilla blanda, con 6 puntos de control en grilla y uno en la ampliación.",
    points: SETTLEMENT_POINTS,
    partialsMm: PARTIALS_MM,
    visitSpecs: VISIT_SPECS,
    retirements: SETTLEMENT_RETIREMENTS,
    close: false,
  });
  console.log(
    `  ✓ Lugar "Edificio Torre Central" (abierto) con ${SETTLEMENT_POINTS.length} puntos (P-07 de alta, P-05 de baja) y ${VISIT_SPECS.length} visitas — ${settlementSiteId}`,
  );

  // Segundo lugar, cerrado, cuyo único fin es el informe de asentamientos.
  const norteId = await insertSettlementSite(monitoreo, userId, {
    name: "Edificio Norte",
    description:
      "Edificio de monitoreo cerrado tras 3 visitas: alimenta el informe de asentamientos.",
    points: NORTE_POINTS,
    partialsMm: NORTE_PARTIALS_MM,
    visitSpecs: NORTE_VISIT_DATES.map((date) => ({ date, ...LEVEL_DIGITAL_MONITOREO })),
    close: true,
  });
  console.log(`  ✓ Lugar "Edificio Norte" (cerrado) — ${norteId}`);

  // --- Informes por proceso (§ 4.7): uno de poligonal y uno de nivelación en
  // el lote, y uno de asentamientos en el proyecto de monitoreo. Cada informe
  // solo puede incluir trabajos cerrados. ------------------------------------
  if (poligonalCerrada) {
    await insertReport(catastral, userId, {
      title: "Informe de cierre — Poligonal",
      observations:
        "Levantamiento poligonal conforme a las tolerancias de tercer orden.",
      included: [
        { type: "polygonal", id: poligonalCerrada.id, name: poligonalCerrada.name, order: 0 },
      ],
    });
    console.log('  ✓ Informe de poligonal en "Lote catastral"');
  }
  if (nivelacionCerrada) {
    await insertReport(catastral, userId, {
      title: "Informe de cierre — Nivelación",
      observations:
        "Nivelación en circuito cerrado dentro de la tolerancia de tercer orden.",
      included: [
        { type: "leveling", id: nivelacionCerrada.id, name: nivelacionCerrada.name, order: 0 },
      ],
    });
    console.log('  ✓ Informe de nivelación en "Lote catastral"');
  }
  await insertReport(monitoreo, userId, {
    title: "Informe de cierre — Control de asentamientos",
    observations:
      "Seguimiento de asentamientos del edificio tras las visitas mensuales.",
    included: [{ type: "site", id: norteId, name: "Edificio Norte", order: 0 }],
  });
  console.log('  ✓ Informe de asentamientos en "Edificio en monitoreo"');

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
