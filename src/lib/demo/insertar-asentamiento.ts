// Inserta el lugar de control de asentamientos del proyecto de ejemplo.
//
// Crea el lugar, su catálogo de puntos y sus visitas, con los parciales,
// acumulados, velocidad y nivel de alerta calculados por `computeHistory` —
// nunca escritos a mano. Misma estrategia que `insertSettlementSite` en
// `scripts/seed.mjs`. El lugar se cierra en diferido para que alimente el
// informe de asentamientos.

import type { SupabaseClient } from "@supabase/supabase-js";
import { computeHistory } from "@/lib/calculations/settlement";
import { thresholdsFor } from "@/lib/calculations/tolerances";
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
  }));

  const visits: VisitInput[] = fixture.visitDates.map((date, i) => ({
    id: `visita-${i}`, // provisional, solo para casar con el resultado
    visitNumber: i,
    date,
    readings: fixture.points.map((p) => ({
      pointId: idPorCodigo.get(p.code)!,
      elevation: cotaEn(fixture, p.code, p.initialElevation, i),
    })),
  }));

  const history = computeHistory(points, visits, thresholdsFor("edificio"));

  for (const visitResult of history.visits) {
    const { data: visitRow, error: errVisita } = await supabase
      .from("settlement_visits")
      .insert({
        site_id: lugar.id,
        visit_number: visitResult.visitNumber,
        date: visitResult.date,
        operator: fixture.operator,
        equipment: fixture.equipment,
        status: "calculated",
      })
      .select("id")
      .single();
    if (errVisita) throw errVisita;

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
