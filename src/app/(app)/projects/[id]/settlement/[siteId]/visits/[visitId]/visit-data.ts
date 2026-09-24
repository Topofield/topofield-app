// Carga compartida de la vista y del editor de una visita (Fase 18). No es un
// Server Action: lo importan las dos páginas del servidor.

import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  getProjectById,
  getReferencePoints,
  getSettlementReadingsBySite,
  getSite,
  getSiteBooks,
  getSitePoints,
  getVisit,
  getVisits,
} from "@/lib/supabase/queries";
import { bookRowOf } from "@/lib/calculations/settlement-book";
import type { VisitInput } from "@/types/settlement";

/**
 * El lugar, la visita y todo el histórico que su cálculo necesita. `notFound`
 * si algo no existe o no pertenece al proyecto (RLS lo oculta igual, pero un
 * id de otro lugar del mismo usuario no debe colarse por la URL).
 */
export async function loadVisitData(id: string, siteId: string, visitId: string) {
  const supabase = await createClient();

  const project = await getProjectById(supabase, id);
  if (!project) notFound();

  const site = await getSite(supabase, siteId);
  if (!site || site.project_id !== project.id) notFound();

  const visitWithReadings = await getVisit(supabase, visitId);
  if (!visitWithReadings || visitWithReadings.visit.site_id !== site.id) notFound();
  const { visit, readings } = visitWithReadings;

  const [points, allVisits, readingsBySite, booksByVisit, referencePoints] =
    await Promise.all([
      getSitePoints(supabase, site.id),
      getVisits(supabase, site.id),
      getSettlementReadingsBySite(supabase, site.id),
      getSiteBooks(supabase, site.id),
      getReferencePoints(supabase, project.id),
    ]);

  const initialElevations: Record<string, number> = {};
  for (const reading of readings) {
    initialElevations[reading.point_id] = Number(reading.elevation);
  }

  // Todas las visitas con sus lecturas, en orden cronológico (`getVisits`
  // ordena por fecha). Una sola consulta con join, no una por visita.
  const visitInputs: VisitInput[] = allVisits.map((v) => ({
    id: v.id,
    visitNumber: v.visit_number,
    date: v.date,
    readings: (readingsBySite[v.id] ?? []).map((r) => ({
      pointId: r.point_id,
      elevation: Number(r.elevation),
    })),
  }));
  const otherVisits = visitInputs.filter((v) => v.id !== visit.id);
  const otherVisitOrders = Object.fromEntries(
    allVisits.filter((v) => v.id !== visit.id).map((v) => [v.id, v.precision_order]),
  );

  // La libreta de la visita anterior en modo libreta, para la plantilla.
  const previousWithBook = allVisits
    .filter((v) => v.date < visit.date && (booksByVisit[v.id]?.length ?? 0) > 0)
    .at(-1);
  const previousBook = previousWithBook
    ? booksByVisit[previousWithBook.id]!.map((r) => ({
        pointCode: r.point_code,
        pointType: r.point_type,
      }))
    : null;

  return {
    project,
    site,
    visit,
    points,
    allVisits,
    visitInputs,
    otherVisits,
    otherVisitOrders,
    initialElevations,
    book: booksByVisit[visit.id] ?? [],
    initialBook: (booksByVisit[visit.id] ?? []).map(bookRowOf),
    previousBook,
    referencePoints,
  };
}
