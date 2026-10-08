import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  getPolygonalProcess,
  getPolygonalStations,
  getProjectById,
} from "@/lib/supabase/queries";
import { buildPolygonalWorkbook } from "@/lib/export/polygonal-workbook";
import { computePolygonalDetected } from "@/lib/calculations/polygonal";
import { draftOf, inputOf } from "@/components/polygonal/polygonal-save";
import { equipmentLine, safeFilename } from "@/lib/export/workbook";
import { dmsToDecimal } from "@/lib/calculations/angles";
import { formatDate } from "@/lib/utils/format";

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

  // Las correcciones y σ₀ del ajuste por mínimos cuadrados no se guardan: se
  // recalculan con la misma entrada que la pantalla y el informe (Fase 14). El
  // orden y el tipo de ángulo, detectados como allí (Fase 35).
  // El libro escribe las fórmulas y guarda en cada celda el valor del motor
  // (Fase 38), con el orden y el tipo de ángulo detectados (Fase 35).
  const input = inputOf(draftOf(process, stations), null);
  const detected = computePolygonalDetected(input);
  const workbook = buildPolygonalWorkbook({
    process: {
      name: process.name,
      type: process.type,
      method: input.method,
      startPointCode: process.start_point_code,
      equipment: equipmentLine(process.equipment_brand, process.equipment_model, process.equipment_serial),
      georeference:
        process.georef_at && process.georef_rotation_deg != null
          ? {
              date: formatDate(process.georef_at),
              points: `${process.georef_point_a_code} y ${process.georef_point_b_code}`,
              rotationDeg: dmsToDecimal(
                process.georef_rotation_deg,
                process.georef_rotation_min ?? 0,
                Number(process.georef_rotation_sec ?? 0),
              ),
              scale: Number(process.georef_scale_factor ?? 1),
            }
          : null,
      notes: process.notes,
    },
    project,
    input: { ...input, order: detected.order ?? "ordinario", angleType: detected.angleType },
    detected,
  });
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
