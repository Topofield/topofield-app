import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  getProjectById,
  getSettlementReadingsBySite,
  getSite,
  getSitePoints,
  getVisits,
} from "@/lib/supabase/queries";
import { computeHistory, pointInputOf } from "@/lib/calculations/settlement";
import { thresholdsOf } from "@/lib/calculations/tolerances";
import {
  buildSettlementWorkbook,
  type BookReadingRow,
} from "@/lib/export/settlement-workbook";
import { safeFilename } from "@/lib/export/workbook";
import type { PointInput, VisitInput } from "@/types/settlement";

const XLSX_MIME =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/**
 * Descarga del libro de Excel de un lugar de control de asentamientos (§ 4.8).
 *
 * El histórico se **recalcula** aquí con `computeHistory` y los umbrales
 * vigentes, igual que hace el panel de análisis, en vez de leer los valores
 * derivados de `settlement_readings`. Así el libro no puede contradecir a la
 * pantalla desde la que se descarga.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; siteId: string }> },
) {
  const { id, siteId } = await params;
  const supabase = await createClient();

  const project = await getProjectById(supabase, id);
  if (!project) {
    return new NextResponse("Proyecto no encontrado", { status: 404 });
  }

  const site = await getSite(supabase, siteId);
  if (!site || site.project_id !== project.id) {
    return new NextResponse("Lugar no encontrado", { status: 404 });
  }

  const [sitePoints, visits, readingsBySite] = await Promise.all([
    getSitePoints(supabase, site.id),
    getVisits(supabase, site.id),
    getSettlementReadingsBySite(supabase, site.id),
  ]);

  const points: PointInput[] = sitePoints.map(pointInputOf);

  const visitInputs: VisitInput[] = visits.map((v) => ({
    id: v.id,
    visitNumber: v.visit_number,
    date: v.date,
    readings: (readingsBySite[v.id] ?? []).map((r) => ({
      pointId: r.point_id,
      elevation: Number(r.elevation),
    })),
  }));

  // Libretas de las visitas en modo `book`, para la hoja «Libretas» (Fase
  // 18). Las `direct` no tienen libreta, así que no se consultan.
  const bookVisitIds = visits
    .filter((v) => v.capture_mode === "book")
    .map((v) => v.id);
  const bookByVisit: Record<string, BookReadingRow[]> = {};
  if (bookVisitIds.length > 0) {
    const { data: bookRows, error } = await supabase
      .from("settlement_book_readings")
      .select("*")
      .in("visit_id", bookVisitIds)
      .order("visit_id", { ascending: true })
      .order("reading_order", { ascending: true });
    if (error) throw error;
    for (const row of bookRows ?? []) {
      (bookByVisit[row.visit_id] ??= []).push(row);
    }
  }

  const thresholds = thresholdsOf(site);
  const history = computeHistory(points, visitInputs, thresholds);

  const workbook = buildSettlementWorkbook(
    site,
    sitePoints,
    visits,
    history,
    thresholds,
    project,
    bookByVisit,
  );
  const buffer = await workbook.xlsx.writeBuffer();

  return new NextResponse(buffer as ArrayBuffer, {
    headers: {
      "Content-Type": XLSX_MIME,
      "Content-Disposition": `attachment; filename="${safeFilename(site.name, "asentamientos")}"`,
      "Cache-Control": "no-store",
    },
  });
}
