import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  getPolygonalProcess,
  getPolygonalStations,
  getProjectById,
} from "@/lib/supabase/queries";
import {
  buildPolygonalWorkbook,
  type PolygonalProcessRow,
  type StationRow,
} from "@/lib/export/polygonal-workbook";
import {
  safeFilename,
  type ProjectMetadata,
} from "@/lib/export/workbook";

const XLSX_MIME =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/**
 * Descarga del libro de Excel de un proceso poligonal (§ 4.8).
 *
 * Es una Route Handler y no un Server Action porque la respuesta es un
 * archivo binario con `Content-Disposition`, no una mutación.
 *
 * Disponible en **cualquier estado** del proceso, como pide la § 4.8: un
 * borrador también se exporta, con las celdas que aún no tienen valor vacías.
 *
 * La autorización no se comprueba a mano: las consultas van con el cliente del
 * usuario y la RLS filtra por proyecto, así que un proceso ajeno devuelve
 * `null` y aquí se convierte en 404 — el mismo desenlace que la ruta de la
 * página, y sin revelar si el id existe.
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

  const process = await getPolygonalProcess(supabase, pid);
  if (!process || process.project_id !== project.id) {
    return new NextResponse("Proceso no encontrado", { status: 404 });
  }

  const stations = await getPolygonalStations(supabase, process.id);

  const workbook = buildPolygonalWorkbook(
    process as unknown as PolygonalProcessRow,
    stations as unknown as StationRow[],
    project as unknown as ProjectMetadata,
  );
  const buffer = await workbook.xlsx.writeBuffer();

  return new NextResponse(buffer as ArrayBuffer, {
    headers: {
      "Content-Type": XLSX_MIME,
      "Content-Disposition": `attachment; filename="${safeFilename(process.name, "poligonal")}"`,
      // El libro se arma con lo que hay en la base en este instante; cachearlo
      // serviría datos viejos tras guardar el proceso.
      "Cache-Control": "no-store",
    },
  });
}
