// Inserta el lugar de control de asentamientos del proyecto de ejemplo: Torre
// Alameda, la simulación del prototipo (Fase 21).
//
// Crea el lugar, su catálogo de puntos, sus BM (los del lugar, Fase 37) y sus
// visitas. Cada visita lleva su libreta de nivelación, generada hacia atrás
// desde la serie con `generateVisitBook`; cabecera, cotas y lecturas salen de
// `insertarVisitas`, la misma regla que el guardado de la app: sin compensar y
// sin cerrar nada.

import type { SupabaseClient } from "@supabase/supabase-js";
import { thresholdsFor } from "@/lib/calculations/tolerances";
import type { Database } from "@/types/database";
import type { PointInput } from "@/types/settlement";
import type { AsentamientoDemo } from "./fixtures";
import { insertarVisitas } from "./insertar-visitas";
import { alamedaBook, ALAMEDA_AMARRES } from "./torre-alameda";

type Client = SupabaseClient<Database>;

/** Crea el lugar completo. Devuelve su `id` y su nombre. */
export async function insertarAsentamiento(
  supabase: Client,
  projectId: string,
  fixture: AsentamientoDemo,
): Promise<{ siteId: string; siteName: string }> {
  // Los umbrales no se envían: los DEFAULT de la tabla `sites` son los mismos
  // que `thresholdsFor("edificio")`, así que el lugar queda coherente con el
  // preset del motor sin duplicar las constantes.
  const { data: lugar, error: errLugar } = await supabase
    .from("sites")
    .insert({
      project_id: projectId,
      name: fixture.name,
      description: fixture.description,
      structure_type: "edificio",
    })
    .select("id")
    .single();
  if (errLugar) throw errLugar;

  const { data: puntoRows, error: errPuntos } = await supabase
    .from("settlement_points")
    .insert(
      fixture.points.map((p) => ({
        site_id: lugar.id,
        code: p.code,
        location_description: p.locationDescription,
        initial_elevation: p.c0,
      })),
    )
    .select("id, code");
  if (errPuntos) throw errPuntos;
  const idPorCodigo = new Map(puntoRows.map((p) => [p.code, p.id]));

  const points: PointInput[] = fixture.points.map((p) => ({
    id: idPorCodigo.get(p.code)!,
    code: p.code,
    initialElevation: p.c0,
    // Torre Alameda no tiene altas ni bajas: todos sus puntos son originales.
    activeFrom: null,
    retiredOn: null,
  }));

  // Los dos BM, en los BM del lugar (Fase 37, decisión 12).
  const { error: errBms } = await supabase.from("site_benchmarks").insert(
    ALAMEDA_AMARRES.map((a) => ({
      site_id: lugar.id,
      code: a.code,
      elevation: a.elevation,
      description: a.description,
      source: "Proyecto de ejemplo",
    })),
  );
  if (errBms) throw errBms;

  await insertarVisitas(
    supabase,
    lugar.id,
    points,
    ALAMEDA_AMARRES.map((a) => ({ code: a.code, elevation: a.elevation })),
    thresholdsFor("edificio"),
    fixture.visits.map((v, i) => ({
      visitNumber: i,
      date: v.date,
      operator: v.operator,
      equipment: {
        brand: fixture.equipmentBrand,
        model: fixture.equipmentModel,
        serial: fixture.equipmentSerial,
        calibrationDate: fixture.equipmentCalibrationDate,
        levelType: fixture.levelType,
        kmPrecisionMm: fixture.kmPrecisionMm,
      },
      rows: alamedaBook(v, i, fixture.precisionOrder),
    })),
  );

  return { siteId: lugar.id, siteName: fixture.name };
}
