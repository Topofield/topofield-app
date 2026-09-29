// Inserta el lugar de control de asentamientos del proyecto de ejemplo: Torre
// Alameda, la simulación del prototipo (Fase 21).
//
// Crea el lugar, su catálogo de puntos y sus visitas, con los parciales,
// acumulados, velocidad y nivel de alerta calculados por `computeHistory` —
// nunca escritos a mano. Cada visita lleva su libreta de nivelación, generada
// hacia atrás desde la serie con `generateVisitBook`, y las cotas se derivan de
// ella con el motor real: misma estrategia que `insertBookSite` en
// `scripts/seed.mjs`. Los BMs de amarre ya están en el catálogo del proyecto
// (`REFERENCIAS_DEMO`).
//
// Las escrituras van agrupadas —una por tabla— porque esto corre en el primer
// acceso del usuario, con su cliente y bajo RLS: catorce visitas de una en una
// serían decenas de viajes a la base.

import type { SupabaseClient } from "@supabase/supabase-js";
import { totalDistanceFromReadings } from "@/lib/calculations/leveling";
import { computeHistory } from "@/lib/calculations/settlement";
import {
  bookRowInputOf,
  computeVisitBook,
  deriveControlElevations,
} from "@/lib/calculations/settlement-book";
import { bookRowsToPersist } from "@/lib/calculations/settlement-persistence";
import { thresholdsFor } from "@/lib/calculations/tolerances";
import { generateVisitBook } from "./libreta-asentamientos";
import type { Database } from "@/types/database";
import type { PointInput, VisitInput } from "@/types/settlement";
import type { AsentamientoDemo } from "./fixtures";

type Client = SupabaseClient<Database>;

const round = (v: number | null, d: number) => (v == null ? null : Number(v.toFixed(d)));

/**
 * Crea el lugar completo y lo cierra. Devuelve el `id` y el nombre del lugar,
 * que el orquestador usa para armar el informe de asentamientos.
 *
 * El orden importa: puntos → visitas → libretas y lecturas → cierre de las
 * visitas → cierre del lugar. Una visita o un lugar cerrados bloquean por
 * trigger toda escritura debajo, así que los cierres van al final.
 */
export async function insertarAsentamiento(
  supabase: Client,
  projectId: string,
  userId: string,
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
        northing: p.northing,
        easting: p.easting,
        initial_elevation: p.c0,
      })),
    )
    .select("id, code");
  if (errPuntos) throw errPuntos;
  const idPorCodigo = new Map(puntoRows.map((p) => [p.code, p.id]));

  const points: PointInput[] = fixture.points.map((p) => ({
    id: idPorCodigo.get(p.code)!,
    code: p.code,
    northing: p.northing,
    easting: p.easting,
    initialElevation: p.c0,
    // Torre Alameda no tiene altas ni bajas: todos sus puntos son originales.
    activeFrom: null,
    retiredOn: null,
  }));

  // La libreta de cada visita, hacia atrás desde la serie, con el BM de amarre
  // de esa visita; las cotas salen de ella por el motor, como al guardar desde
  // el editor. Las semillas son las del seed: la misma libreta en los dos.
  const books = fixture.visits.map((v, i) => {
    const rows = generateVisitBook({
      amarre: { code: v.amarre.code, elevation: v.amarre.elevation },
      targets: v.targets,
      closureMm: v.closureMm,
      order: fixture.precisionOrder,
      seed: 100 + i,
    });
    const result = computeVisitBook(
      rows.map(bookRowInputOf),
      v.amarre.elevation,
      fixture.precisionOrder,
    );
    return { rows, result, readings: deriveControlElevations(result, points, v.date).readings };
  });

  const visitInputs: VisitInput[] = fixture.visits.map((v, i) => ({
    id: `visita-${i}`, // provisional, solo para casar con el resultado
    visitNumber: i,
    date: v.date,
    readings: books[i]!.readings.map(({ pointId, elevation }) => ({ pointId, elevation })),
  }));
  const history = computeHistory(points, visitInputs, thresholdsFor("edificio"));

  // --- Las catorce visitas en una sola escritura. -----------------------------
  const { data: visitRows, error: errVisitas } = await supabase
    .from("settlement_visits")
    .insert(
      fixture.visits.map((v, i) => {
        const book = books[i]!;
        return {
          site_id: lugar.id,
          visit_number: i,
          date: v.date,
          operator: v.operator,
          // La visita declara su orden y su nivel (Fase 8).
          precision_order: fixture.precisionOrder,
          equipment_brand: fixture.equipmentBrand,
          equipment_model: fixture.equipmentModel,
          equipment_serial: fixture.equipmentSerial,
          equipment_calibration_date: fixture.equipmentCalibrationDate,
          level_type: fixture.levelType,
          km_precision_mm: fixture.kmPrecisionMm,
          capture_mode: "book" as const,
          reference_bm_code: v.amarre.code,
          reference_bm_elevation: v.amarre.elevation,
          closure_error_mm: round(book.result.closureErrorMm, 1),
          tolerance_mm: round(book.result.toleranceMm, 1),
          meets_tolerance: book.result.meetsTolerance,
          total_distance_km: round(totalDistanceFromReadings(book.rows.map(bookRowInputOf)), 3),
          status: "calculated" as const,
        };
      }),
    )
    .select("id, visit_number");
  if (errVisitas) throw errVisitas;
  const visitaId = new Map(visitRows.map((v) => [v.visit_number, v.id]));

  // --- Libretas y lecturas de todas las visitas, una escritura cada una. -------
  const libretas = fixture.visits.flatMap((_, i) => {
    const book = books[i]!;
    return bookRowsToPersist(visitaId.get(i)!, book.rows, book.result.forward.readings, points);
  });
  const { error: errLibretas } = await supabase.from("settlement_book_readings").insert(libretas);
  if (errLibretas) throw errLibretas;

  const lecturas = history.visits.flatMap((visitResult) =>
    visitResult.readings.map((r) => ({
      visit_id: visitaId.get(visitResult.visitNumber)!,
      point_id: r.pointId,
      elevation: r.elevation,
      partial_settlement: r.partialSettlement,
      accumulated_settlement: r.accumulatedSettlement,
      velocity: r.velocity,
      alert_status: r.alertStatus,
    })),
  );
  const { error: errLecturas } = await supabase.from("settlement_readings").insert(lecturas);
  if (errLecturas) throw errLecturas;

  // --- Cierres: las visitas y después el lugar. --------------------------------
  const ahora = new Date().toISOString();
  const { error: errCierreVisitas } = await supabase
    .from("settlement_visits")
    .update({ status: "closed", closed_at: ahora, closed_by: userId })
    .eq("site_id", lugar.id);
  if (errCierreVisitas) throw errCierreVisitas;

  const { error: errCierre } = await supabase
    .from("sites")
    .update({ status: "closed", closed_at: ahora, closed_by: userId })
    .eq("id", lugar.id);
  if (errCierre) throw errCierre;

  return { siteId: lugar.id, siteName: fixture.name };
}
