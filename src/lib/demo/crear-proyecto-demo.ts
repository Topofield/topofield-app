// Crea el proyecto de ejemplo de un usuario nuevo.
//
// Se ejecuta con el cliente del propio usuario, sujeto a RLS: las políticas de
// inserción (`projects_insert_own`, `polygonal_processes_insert_via_project`,
// `polygonal_stations_insert_via_project`) le permiten crear sus propios datos.
// Así no hace falta introducir un cliente con la llave secreta en `src/`, y se
// mantiene la garantía de que `SUPABASE_SECRET_KEY` solo vive en el seed.
//
// Los resultados que se persisten los calcula el motor real, nunca se escriben
// a mano — misma estrategia que `scripts/seed.mjs`.

import type { SupabaseClient } from "@supabase/supabase-js";
import { dmsToDecimal } from "@/lib/calculations/angles";
import { computePolygonal } from "@/lib/calculations/polygonal";
import type { Database } from "@/types/database";
import type { PrecisionOrder } from "@/types/project";
import { PROCESOS_DEMO, PROYECTO_DEMO, type ProcesoDemo } from "./fixtures";

type Client = SupabaseClient<Database>;

/** Campos de resultado, derivados del motor de cálculo. */
function resultadosDe(proceso: ProcesoDemo, order: PrecisionOrder) {
  const r = computePolygonal({
    type: proceso.type,
    startNorth: proceso.startNorth,
    startEast: proceso.startEast,
    startAzimuth: dmsToDecimal(...proceso.startAz),
    endNorth: proceso.endNorth ?? null,
    endEast: proceso.endEast ?? null,
    endAzimuth: null,
    order,
    // Las poligonales sin cierre no reparten error, pero el motor exige un
    // método: Bowditch es el que usa la aplicación por defecto.
    method: proceso.correctionMethod ?? "bowditch",
    stations: proceso.stations.map((st) => ({
      pointCode: st.code,
      angle: st.angle ? dmsToDecimal(...st.angle) : Number.NaN,
      deflectionDirection: st.dir ?? null,
      distance: st.distance ?? Number.NaN,
    })),
  });

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

/**
 * Reclama la marca de creación de la demo.
 *
 * El `is null` en el WHERE hace la operación atómica: si dos peticiones compiten
 * (dos pestañas, o el callback y una recarga), solo una afecta una fila. Quien
 * la afecta es quien crea la demo.
 *
 * Devuelve `true` si a este usuario le toca crearla.
 */
async function reclamarMarca(supabase: Client, userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("profiles")
    .update({ demo_seeded_at: new Date().toISOString() })
    .eq("id", userId)
    .is("demo_seeded_at", null)
    .select("id");

  if (error) throw error;
  return (data?.length ?? 0) > 0;
}

async function insertarProceso(
  supabase: Client,
  projectId: string,
  userId: string,
  proceso: ProcesoDemo,
  order: PrecisionOrder,
): Promise<void> {
  const cerrado = proceso.status === "closed";

  const { data: creado, error } = await supabase
    .from("polygonal_processes")
    .insert({
      project_id: projectId,
      name: proceso.name,
      type: proceso.type,
      angle_type: proceso.angleType,
      start_point_code: proceso.startPointCode,
      start_north: proceso.startNorth,
      start_east: proceso.startEast,
      start_azimuth_deg: proceso.startAz[0],
      start_azimuth_min: proceso.startAz[1],
      start_azimuth_sec: proceso.startAz[2],
      end_point_code: proceso.endPointCode ?? null,
      end_north: proceso.endNorth ?? null,
      end_east: proceso.endEast ?? null,
      correction_method: proceso.correctionMethod ?? null,
      // Nace abierto aunque el fixture lo quiera cerrado: los triggers de
      // inmutabilidad rechazan escribir estaciones bajo un proceso ya cerrado.
      // El cierre se aplica al final, igual que hace la aplicación.
      status: cerrado ? "calculated" : proceso.status,
      ...resultadosDe(proceso, order),
      notes: proceso.notes,
    })
    .select("id")
    .single();

  if (error) throw error;

  const estaciones = proceso.stations.map((st, i) => ({
    process_id: creado.id,
    station_order: i + 1,
    point_code: st.code,
    angle_deg: st.angle?.[0] ?? null,
    angle_min: st.angle?.[1] ?? null,
    angle_sec: st.angle?.[2] ?? null,
    deflection_direction: st.dir ?? null,
    horizontal_distance: st.distance ?? null,
  }));

  const { error: errEst } = await supabase
    .from("polygonal_stations")
    .insert(estaciones);
  if (errEst) throw errEst;

  if (cerrado) {
    const { error: errCierre } = await supabase
      .from("polygonal_processes")
      .update({
        status: "closed",
        closed_at: new Date().toISOString(),
        closed_by: userId,
      })
      .eq("id", creado.id);
    if (errCierre) throw errCierre;
  }
}

/**
 * Crea el proyecto de ejemplo si a este usuario todavía no se le ha creado.
 *
 * Devuelve `true` si lo creó, `false` si ya lo tenía. Quien la llama debe
 * envolverla en try/catch: un fallo aquí no puede dejar al usuario fuera de su
 * cuenta.
 */
export async function crearProyectoDemo(
  supabase: Client,
  userId: string,
): Promise<boolean> {
  if (!(await reclamarMarca(supabase, userId))) return false;

  const order = PROYECTO_DEMO.precisionOrder as PrecisionOrder;

  const { data: proyecto, error } = await supabase
    .from("projects")
    .insert({
      user_id: userId,
      name: PROYECTO_DEMO.name,
      client: PROYECTO_DEMO.client,
      location: PROYECTO_DEMO.location,
      description: PROYECTO_DEMO.description,
      precision_order: order,
      datum: PROYECTO_DEMO.datum,
      projection: PROYECTO_DEMO.projection,
      equipment_brand: PROYECTO_DEMO.equipmentBrand,
      equipment_model: PROYECTO_DEMO.equipmentModel,
      equipment_serial: PROYECTO_DEMO.equipmentSerial,
      angular_precision_seconds: PROYECTO_DEMO.angularPrecisionSeconds,
      linear_precision: PROYECTO_DEMO.linearPrecision,
      equipment_calibration_date: PROYECTO_DEMO.equipmentCalibrationDate,
      status: "active",
    })
    .select("id")
    .single();

  if (error) throw error;

  // En serie y no en paralelo: son cuatro inserciones y el orden en que
  // aparecen en el listado es el de creación.
  for (const proceso of PROCESOS_DEMO) {
    await insertarProceso(supabase, proyecto.id, userId, proceso, order);
  }

  return true;
}
