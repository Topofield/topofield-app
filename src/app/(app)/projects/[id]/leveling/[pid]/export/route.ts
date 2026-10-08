import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  getLevelingProcess,
  getLevelingReadings,
  getProjectById,
} from "@/lib/supabase/queries";
import { levelingDraftOf, levelingInputOf } from "@/components/leveling/leveling-save";
import { computeLevelingDetected } from "@/lib/calculations/leveling";
import { buildLevelingWorkbook } from "@/lib/export/leveling-workbook";
import { equipmentLine, safeFilename } from "@/lib/export/workbook";
import { LEVEL_TYPE_LABELS } from "@/types/project";

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

  // Lo que daría guardar ahora (Fase 36): el orden detectado y las cotas
  // compensadas, también en una nivelación guardada antes de la fase, cuyas
  // columnas dicen el orden que declaraba. El libro escribe las fórmulas y
  // guarda en cada celda el valor del motor (Fase 38).
  const input = levelingInputOf(levelingDraftOf(process, readings));
  const workbook = buildLevelingWorkbook({
    process: {
      name: process.name,
      type: process.type,
      startBmCode: process.start_bm_code,
      endBmCode: process.end_bm_code,
      equipment: equipmentLine(process.equipment_brand, process.equipment_model, process.equipment_serial),
      levelType: process.level_type ? LEVEL_TYPE_LABELS[process.level_type] : null,
      notes: process.notes,
    },
    project,
    input,
    detected: computeLevelingDetected(input),
  });
  const buffer = await workbook.xlsx.writeBuffer();

  return new NextResponse(buffer as ArrayBuffer, {
    headers: {
      "Content-Type": XLSX_MIME,
      "Content-Disposition": `attachment; filename="${safeFilename(process.name, "nivelacion")}"`,
      "Cache-Control": "no-store",
    },
  });
}
