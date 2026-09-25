// Crea el proyecto de ejemplo de un usuario nuevo.
//
// Se ejecuta con el cliente del propio usuario, sujeto a RLS: las políticas de
// inserción le permiten crear sus propios datos. Así no hace falta introducir
// un cliente con la llave secreta en `src/`, y se mantiene la garantía de que
// `SUPABASE_SECRET_KEY` solo vive en el seed.
//
// Este archivo solo ORQUESTA: reclama la marca, crea el proyecto y sus lugares,
// delega cada módulo en su `insertar-*.ts`, y arma los informes. Los resultados
// que se persisten los calcula el motor real, nunca se escriben a mano — misma
// estrategia que `scripts/seed.mjs`.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { IncludedProcess } from "@/types/report";
import {
  ASENTAMIENTO_DEMO,
  NIVELACION_VERJON,
  nivelacionTramo2,
  PROCESOS_DEMO,
  PROYECTO_DEMO,
  REFERENCIAS_DEMO,
} from "./fixtures";
import { insertarAsentamiento } from "./insertar-asentamiento";
import { insertarInforme } from "./insertar-informe";
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
 * prototipo de asentamientos. Uno de cada módulo queda cerrado para emitir sus
 * tres informes.
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
      description:
        "Poligonales y nivelaciones de carteras de campo reales (docs/carteras/).",
      structure_type: "otro",
    })
    .select("id")
    .single();

  if (errLote) throw errLote;

  // --- Poligonales. En serie: el orden del listado es el de creación. Se
  // captura la que nace cerrada, que es la que alimenta su informe. ----------
  let poligonalCerrada: { id: string; name: string } | null = null;
  for (const proceso of PROCESOS_DEMO) {
    const id = await insertarPoligonal(
      supabase,
      proyecto.id,
      lote.id,
      userId,
      proceso,
      idReferencia,
    );
    if (proceso.status === "closed") {
      poligonalCerrada = { id, name: proceso.name };
    }
  }

  // --- Nivelaciones: El Verjón (calculada) y el tramo 2 (cerrada). ----------
  let nivelacionCerrada: { id: string; name: string } | null = null;
  for (const nivelacion of [NIVELACION_VERJON, nivelacionTramo2()]) {
    const id = await insertarNivelacion(
      supabase,
      proyecto.id,
      lote.id,
      userId,
      nivelacion,
    );
    if (nivelacion.status === "closed") {
      nivelacionCerrada = { id, name: nivelacion.name };
    }
  }

  // --- Asentamientos: Torre Alameda, cerrada tras sus catorce visitas. ------
  const { siteId, siteName } = await insertarAsentamiento(
    supabase,
    proyecto.id,
    userId,
    ASENTAMIENTO_DEMO,
  );

  // --- Un informe por módulo (§ 4.7): los informes se emiten por proceso. ---
  const informes: {
    title: string;
    observations: string | null;
    included: IncludedProcess[];
  }[] = [
    ...(poligonalCerrada
      ? [
          {
            title: "Informe de cierre — Poligonal",
            observations:
              "Poligonal V10 amarrada a TT4, conforme a las tolerancias de tercer orden.",
            included: [
              {
                type: "polygonal" as const,
                id: poligonalCerrada.id,
                name: poligonalCerrada.name,
                order: 0,
              },
            ],
          },
        ]
      : []),
    ...(nivelacionCerrada
      ? [
          {
            title: "Informe de cierre — Nivelación",
            observations:
              "Tramo 2 medido con nivel digital, de C10 a C10, dentro de la tolerancia de tercer orden.",
            included: [
              {
                type: "leveling" as const,
                id: nivelacionCerrada.id,
                name: nivelacionCerrada.name,
                order: 0,
              },
            ],
          },
        ]
      : []),
    {
      title: "Informe de cierre — Control de asentamientos",
      observations:
        "Seguimiento de asentamientos de Torre Alameda tras catorce visitas.",
      included: [
        { type: "site" as const, id: siteId, name: siteName, order: 0 },
      ],
    },
  ];

  for (const informe of informes) {
    await insertarInforme(
      supabase,
      proyecto.id,
      userId,
      informe.title,
      informe.observations,
      informe.included,
    );
  }

  return true;
}
