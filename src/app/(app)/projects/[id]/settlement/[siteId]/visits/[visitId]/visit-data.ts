// La carga de una visita (Fase 18; desde la Fase 37, para sus dos pasos). No
// es un Server Action: lo importa la página del servidor.

import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  getProjectById,
  getSettlementReadingsBySite,
  getSite,
  getSiteBenchmarks,
  getSiteBooks,
  getSitePoints,
  getVisit,
  getVisits,
} from "@/lib/supabase/queries";
import { bookRowOf } from "@/lib/calculations/settlement-book";
import type { VisitInput } from "@/types/settlement";

/**
 * El lugar, la visita, sus BM y todo el histórico que su cálculo necesita.
 * `notFound` si algo no existe o no pertenece al proyecto (RLS lo oculta
 * igual, pero un id de otro lugar del mismo usuario no debe colarse por la
 * URL).
 */
export async function loadVisitData(id: string, siteId: string, visitId: string) {
  const supabase = await createClient();

  const project = await getProjectById(supabase, id);
  if (!project) notFound();

  const site = await getSite(supabase, siteId);
  if (!site || site.project_id !== project.id || site.kind !== "settlement") notFound();

  const visitWithReadings = await getVisit(supabase, visitId);
  if (!visitWithReadings || visitWithReadings.visit.site_id !== site.id) notFound();
  const { visit } = visitWithReadings;

  const [points, allVisits, readingsBySite, booksByVisit, benchmarks] = await Promise.all([
    getSitePoints(supabase, site.id),
    getVisits(supabase, site.id),
    getSettlementReadingsBySite(supabase, site.id),
    getSiteBooks(supabase, site.id),
    getSiteBenchmarks(supabase, site.id),
  ]);

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

  return {
    project,
    site,
    visit,
    points,
    allVisits,
    visitInputs,
    benchmarks,
    /** La libreta guardada, como la usan el motor y los popups. */
    book: (booksByVisit[visit.id] ?? []).map(bookRowOf),
  };
}
