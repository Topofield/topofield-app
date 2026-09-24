// Inserta el lugar de control de asentamientos del proyecto de ejemplo.
//
// Crea el lugar, su catálogo de puntos y sus visitas, con los parciales,
// acumulados, velocidad y nivel de alerta calculados por `computeHistory` —
// nunca escritos a mano. Misma estrategia que `insertBookSite` en
// `scripts/seed.mjs`: desde la Fase 18 cada visita lleva su libreta de
// nivelación, generada hacia atrás desde la serie del fixture, y las cotas se
// derivan de ella con el motor real. El lugar se cierra en diferido para que
// alimente el informe de asentamientos.

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

/** Cota de un punto en una visita: inicial menos el acumulado de parciales. */
function cotaEn(
  fixture: AsentamientoDemo,
  code: string,
  initialElevation: number,
  visitIndex: number,
): number {
  const acumuladoMm = fixture.partialsMm[code]!
    .slice(0, visitIndex + 1)
    .reduce((a, b) => a + b, 0);
  return initialElevation + acumuladoMm / 1000;
}

/**
 * Crea el lugar completo y lo cierra. Devuelve el `id` y el nombre del lugar,
 * que el orquestador usa para armar el informe de asentamientos.
 *
 * El orden importa: puntos → visitas → lecturas → cierre. Cerrar el lugar
 * bloquea por trigger toda escritura sobre sus visitas y lecturas, así que el
 * cierre va al final, una vez cargado todo.
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
        initial_elevation: p.initialElevation,
      })),
    )
    .select("id, code");
  if (errPuntos) throw errPuntos;

  const idPorCodigo = new Map(puntoRows.map((p) => [p.code, p.id]));

  // --- Motor real: computeHistory calcula parciales, acumulados, velocidad
  // y nivel de alerta a partir únicamente de las cotas medidas. --------------
  const points: PointInput[] = fixture.points.map((p) => ({
    id: idPorCodigo.get(p.code)!,
    code: p.code,
    northing: p.northing,
    easting: p.easting,
    initialElevation: p.initialElevation,
    // El lugar demo no tiene altas ni bajas: todos sus puntos son originales.
    activeFrom: null,
    retiredOn: null,
  }));

  // El BM de amarre de las libretas, en el catálogo del proyecto.
  const { error: errAmarre } = await supabase.from("reference_points").insert({
    project_id: projectId,
    code: fixture.amarre.code,
    type: "bm",
    elevation: fixture.amarre.elevation,
    description: fixture.amarre.description,
  });
  if (errAmarre) throw errAmarre;

  // La libreta de cada visita, hacia atrás desde la serie; las cotas salen de
  // ella por el motor, como al guardar desde el editor.
  const books = fixture.visitDates.map((date, i) => {
    const rows = generateVisitBook({
      amarre: fixture.amarre,
      targets: fixture.points.map((p) => ({
        code: p.code,
        elevation: Number(cotaEn(fixture, p.code, p.initialElevation, i).toFixed(4)),
      })),
      closureMm: fixture.closuresMm[i] ?? 0,
      order: fixture.precisionOrder,
      seed: 200 + i,
    });
    const result = computeVisitBook(
      rows.map(bookRowInputOf),
      fixture.amarre.elevation,
      fixture.precisionOrder,
    );
    return { rows, result, readings: deriveControlElevations(result, points, date).readings };
  });

  const visits: VisitInput[] = fixture.visitDates.map((date, i) => ({
    id: `visita-${i}`, // provisional, solo para casar con el resultado
    visitNumber: i,
    date,
    readings: books[i]!.readings.map(({ pointId, elevation }) => ({ pointId, elevation })),
  }));

  const history = computeHistory(points, visits, thresholdsFor("edificio"));

  const round = (v: number | null, d: number) => (v == null ? null : Number(v.toFixed(d)));
  for (const visitResult of history.visits) {
    const book = books[visitResult.visitNumber]!;
    const { data: visitRow, error: errVisita } = await supabase
      .from("settlement_visits")
      .insert({
        site_id: lugar.id,
        visit_number: visitResult.visitNumber,
        date: visitResult.date,
        operator: fixture.operator,
        // La visita declara su orden y su nivel (Fase 8): el equipo puede
        // cambiar entre campañas, y `equipment` de texto libre desapareció.
        precision_order: fixture.precisionOrder,
        equipment_brand: fixture.equipmentBrand ?? null,
        equipment_model: fixture.equipmentModel ?? null,
        equipment_serial: fixture.equipmentSerial ?? null,
        equipment_calibration_date: fixture.equipmentCalibrationDate ?? null,
        level_type: fixture.levelType ?? null,
        km_precision_mm: fixture.kmPrecisionMm ?? null,
        capture_mode: "book",
        reference_bm_code: fixture.amarre.code,
        reference_bm_elevation: fixture.amarre.elevation,
        closure_error_mm: round(book.result.closureErrorMm, 1),
        tolerance_mm: round(book.result.toleranceMm, 1),
        meets_tolerance: book.result.meetsTolerance,
        total_distance_km: round(totalDistanceFromReadings(book.rows.map(bookRowInputOf)), 3),
        status: "calculated",
      })
      .select("id")
      .single();
    if (errVisita) throw errVisita;

    const { error: errLibreta } = await supabase
      .from("settlement_book_readings")
      .insert(bookRowsToPersist(visitRow.id, book.rows, book.result.forward.readings, points));
    if (errLibreta) throw errLibreta;

    const lecturas = visitResult.readings.map((r) => ({
      visit_id: visitRow.id,
      point_id: r.pointId,
      elevation: r.elevation,
      partial_settlement: r.partialSettlement,
      accumulated_settlement: r.accumulatedSettlement,
      velocity: r.velocity,
      alert_status: r.alertStatus,
    }));
    const { error: errLecturas } = await supabase
      .from("settlement_readings")
      .insert(lecturas);
    if (errLecturas) throw errLecturas;
  }

  const { error: errCierre } = await supabase
    .from("sites")
    .update({
      status: "closed",
      closed_at: new Date().toISOString(),
      closed_by: userId,
    })
    .eq("id", lugar.id);
  if (errCierre) throw errCierre;

  return { siteId: lugar.id, siteName: fixture.name };
}
