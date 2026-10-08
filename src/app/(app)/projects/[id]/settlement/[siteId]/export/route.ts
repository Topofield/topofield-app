import { allRows } from "@/lib/supabase/paginate";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  getProjectById,
  getSettlementReadingsBySite,
  getSite,
  getSiteBenchmarks,
  getSitePoints,
  getVisits,
} from "@/lib/supabase/queries";
import { computeHistory, pointInputOf } from "@/lib/calculations/settlement";
import { bookRowOf } from "@/lib/calculations/settlement-book";
import { thresholdsOf } from "@/lib/calculations/tolerances";
import { siteReportOf } from "@/lib/reports/site-data";
import { buildSettlementWorkbook, type SettlementSheetVisit } from "@/lib/export/settlement-workbook";
import { equipmentLine, safeFilename } from "@/lib/export/workbook";
import { STRUCTURE_TYPE_LABELS } from "@/types/site";
import type { BenchmarkInput, PointInput, SettlementBookReading, VisitInput } from "@/types/settlement";
import type { Tables } from "@/types/database";

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
  if (!site || site.project_id !== project.id || site.kind !== "settlement") {
    return new NextResponse("Lugar no encontrado", { status: 404 });
  }

  const [sitePoints, visits, readingsBySite, siteBenchmarks] = await Promise.all([
    getSitePoints(supabase, site.id),
    getVisits(supabase, site.id),
    getSettlementReadingsBySite(supabase, site.id),
    getSiteBenchmarks(supabase, site.id),
  ]);

  const points: PointInput[] = sitePoints.map(pointInputOf);
  const benchmarks: BenchmarkInput[] = siteBenchmarks.map((b) => ({
    code: b.code,
    elevation: Number(b.elevation),
    originVisitId: b.origin_visit_id,
  }));

  const visitInputs: VisitInput[] = visits.map((v) => ({
    id: v.id,
    visitNumber: v.visit_number,
    date: v.date,
    readings: (readingsBySite[v.id] ?? []).map((r) => ({
      pointId: r.point_id,
      elevation: Number(r.elevation),
    })),
  }));

  const bookByVisit: Record<string, Tables<"settlement_book_readings">[]> = {};
  if (visits.length > 0) {
    const { data: bookRows, error } = await allRows((from, to) =>
      supabase
        .from("settlement_book_readings")
        .select("*")
        .in("visit_id", visits.map((v) => v.id))
        .order("visit_id", { ascending: true })
        .order("reading_order", { ascending: true })
        .range(from, to),
    );
    if (error) throw error;
    for (const row of bookRows ?? []) (bookByVisit[row.visit_id] ??= []).push(row);
  }

  const thresholds = thresholdsOf(site);
  const history = computeHistory(points, visitInputs, thresholds);
  // Los avisos de tendencia, con el texto del informe del lugar.
  const { warnings } = siteReportOf({
    thresholds,
    points,
    visits: visits.map((v, i) => ({
      id: v.id,
      visitNumber: v.visit_number,
      date: v.date,
      status: v.status,
      precisionOrder: v.precision_order,
      notes: v.notes,
      readings: visitInputs[i]!.readings,
    })),
  });

  const sheetVisits: SettlementSheetVisit[] = visits.map((v) => ({
    id: v.id,
    number: v.visit_number,
    date: v.date,
    leveler: v.operator,
    equipment: equipmentLine(v.equipment_brand, v.equipment_model, v.equipment_serial),
    notes: v.notes,
    rows: (bookByVisit[v.id] ?? []).map((row) => bookRowOf(row as SettlementBookReading)),
  }));

  const workbook = buildSettlementWorkbook({
    site: { name: site.name, location: site.description, structure: STRUCTURE_TYPE_LABELS[site.structure_type] ?? null },
    project,
    points: points.map((p, i) => ({ ...p, location: sitePoints[i]!.location_description || null })),
    benchmarks,
    visits: sheetVisits,
    visitInputs,
    thresholds,
    history,
    warnings,
  });
  const buffer = await workbook.xlsx.writeBuffer();

  return new NextResponse(buffer as ArrayBuffer, {
    headers: {
      "Content-Type": XLSX_MIME,
      "Content-Disposition": `attachment; filename="${safeFilename(site.name, "asentamientos")}"`,
      "Cache-Control": "no-store",
    },
  });
}
