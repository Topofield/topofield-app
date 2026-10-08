// Crea el proyecto de ejemplo de un usuario nuevo.
//
// Se ejecuta con el cliente del propio usuario, sujeto a RLS: las políticas de
// inserción le permiten crear sus propios datos. Así no hace falta introducir
// un cliente con la llave secreta en `src/`, y se mantiene la garantía de que
// `SUPABASE_SECRET_KEY` solo vive en el seed.
//
// Este archivo solo ORQUESTA: reclama la marca, crea el proyecto y sus lugares,
// y delega cada módulo en su `insertar-*.ts`. Los resultados
// que se persisten los calcula el motor real, nunca se escriben a mano — misma
// estrategia que `scripts/seed.mjs`.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import {
  ASENTAMIENTO_DEMO,
  EQUIPOS_DEMO,
  NIVELACION_VERJON,
  nivelacionTramo2,
  PROCESOS_DEMO,
  PROYECTO_DEMO,
  REFERENCIAS_DEMO,
} from "./fixtures";
import { insertarAsentamiento } from "./insertar-asentamiento";
import { insertarCartera } from "./insertar-cartera";
import { insertarEquipos } from "./insertar-equipos";
import { insertarNivelacion } from "./insertar-nivelacion";
import { insertarPoligonal } from "./insertar-poligonal";

type Client = SupabaseClient<Database>;

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

/**
 * ¿A este usuario le falta todavía el proyecto de ejemplo?
 *
 * Consulta barata (una fila por su clave primaria) para poder llamarla en el
 * dashboard sin coste apreciable. Solo decide si vale la pena intentarlo; quien
 * reclama de verdad la marca —de forma atómica— es `crearProyectoDemo`.
 */
export async function faltaProyectoDemo(
  supabase: Client,
  userId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("profiles")
    .select("demo_seeded_at")
    .eq("id", userId)
    .maybeSingle();

  if (error) throw error;
  return data?.demo_seeded_at == null;
}

/**
 * Crea el proyecto de ejemplo si a este usuario todavía no se le ha creado.
 *
 * Un proyecto con dos lugares que recorre los tres módulos con carteras de
 * campo reales (Fase 21): los levantamientos (poligonales TT4 y Sede Vivero,
 * nivelaciones de El Verjón y del tramo 2) y Torre Alameda, la simulación del
 * prototipo de asentamientos, y la cartera real de asentamientos (Fase 37).
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

  const { data: proyecto, error } = await supabase
    .from("projects")
    .insert({
      user_id: userId,
      name: PROYECTO_DEMO.name,
      client: PROYECTO_DEMO.client,
      location: PROYECTO_DEMO.location,
      description: PROYECTO_DEMO.description,
      datum: PROYECTO_DEMO.datum,
      projection: PROYECTO_DEMO.projection,
      // Desde la Fase 8, precisión y equipo los declara cada proceso: son del
      // levantamiento, no del expediente.
      status: "active",
    })
    .select("id")
    .single();

  if (error) throw error;

  // Catálogo de puntos de referencia: los amarres de las poligonales, los
  // vértices para georreferenciar, el BM del tramo 2 y los de Torre Alameda.
  const { data: referencias, error: errRef } = await supabase
    .from("reference_points")
    .insert(
      REFERENCIAS_DEMO.map((r) => ({
        project_id: proyecto.id,
        code: r.code,
        type: r.type,
        north: r.north ?? null,
        east: r.east ?? null,
        elevation: r.elevation ?? null,
        description: r.description,
      })),
    )
    .select("id, code");
  if (errRef) throw errRef;
  const idReferencia = new Map(referencias.map((r) => [r.code, r.id]));

  // Lugar de los levantamientos: las poligonales y las nivelaciones cuelgan de
  // aquí. No es una construcción, así que "otro" es el tipo que le corresponde.
  const { data: lote, error: errLote } = await supabase
    .from("sites")
    .insert({
      project_id: proyecto.id,
      name: "Levantamientos de campo",
      description: "Poligonales y nivelaciones de carteras de campo reales.",
      structure_type: "otro",
      kind: "grouping",
    })
    .select("id")
    .single();

  if (errLote) throw errLote;

  // --- Poligonales. En serie: el orden del listado es el de creación. -------
  for (const proceso of PROCESOS_DEMO) {
    await insertarPoligonal(supabase, proyecto.id, lote.id, proceso, idReferencia);
  }

  // --- Nivelaciones: El Verjón y el tramo 2, calculadas (Fase 36). ---------
  for (const nivelacion of [NIVELACION_VERJON, nivelacionTramo2()]) {
    await insertarNivelacion(supabase, proyecto.id, lote.id, nivelacion);
  }

  // --- Asentamientos: Torre Alameda, simulada, y la cartera real (Fase 37). --
  await insertarAsentamiento(supabase, proyecto.id, ASENTAMIENTO_DEMO);
  await insertarCartera(supabase, proyecto.id);

  // El catálogo de equipos, al final y sin que nada de la demo dependa de él
  // (Fase 25): si fallara, el proyecto ya está creado.
  await insertarEquipos(supabase, userId, EQUIPOS_DEMO);

  return true;
}
