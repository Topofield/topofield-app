import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  getLevelingProcess,
  getLevelingReadings,
  getProjectById,
} from "@/lib/supabase/queries";
import { buildLevelingWorkbook } from "@/lib/export/leveling-workbook";
import { safeFilename } from "@/lib/export/workbook";
import { responsibleNames } from "@/lib/reports/responsible";

const XLSX_MIME =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/**
 * Descarga del libro de Excel de un proceso de nivelación (§ 4.8).
 *
 * Mismo criterio que la ruta de poligonal: Route Handler porque devuelve un
 * binario, disponible en cualquier estado, y la autorización la dan `proxy.ts`
 * (deniega por defecto) y la RLS (filtra por proyecto).
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; pid: string }> },
) {
  const { id, pid } = await params;
  const supabase = await createClient();

  const project = await getProjectById(supabase, id);
  if (!project) {
    return new NextResponse("Proyecto no encontrado", { status: 404 });
  }

  const process = await getLevelingProcess(supabase, pid);
  if (!process || process.project_id !== project.id) {
    return new NextResponse("Proceso no encontrado", { status: 404 });
  }

  const readings = await getLevelingReadings(supabase, process.id);

  // «Cerrado por» con el nombre del responsable, no su id (Fase 22).
  const names = await responsibleNames(supabase, [process.closed_by]);
  const closedBy = process.closed_by ? (names.get(process.closed_by) ?? null) : null;
  const workbook = buildLevelingWorkbook({ ...process, closed_by: closedBy }, readings, project);
  const buffer = await workbook.xlsx.writeBuffer();

  return new NextResponse(buffer as ArrayBuffer, {
    headers: {
      "Content-Type": XLSX_MIME,
      "Content-Disposition": `attachment; filename="${safeFilename(process.name, "nivelacion")}"`,
      "Cache-Control": "no-store",
    },
  });
}
