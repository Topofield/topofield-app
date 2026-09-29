"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { AngleInputFormat, AngleType, PolygonalType } from "@/types/polygonal";
import type { PrecisionOrder } from "@/types/project";
import { groupingSiteId } from "@/lib/supabase/grouping-site";

export interface CreatePolygonalState {
  error?: string;
}

export interface CreatePolygonalPayload {
  projectId: string;
  name: string;
  type: PolygonalType;
  startPointCode: string;
  startNorth: number | null;
  startEast: number | null;
  startAzimuthDeg: number | null;
  startAzimuthMin: number | null;
  startAzimuthSec: number | null;
  endPointCode: string | null;
  endNorth: number | null;
  endEast: number | null;
  endAzimuthDeg: number | null;
  endAzimuthMin: number | null;
  endAzimuthSec: number | null;
  /** Solo para cerradas: dónde caen las lecturas a la derecha. */
  angleType: AngleType | null;
  referencePointId: string | null;
  referencePointCode: string | null;
  angleReadingsMin: number;
  hasClosingRow: boolean;
  /** Orden de precisión y equipo (estación total, ISO 17123-3 y -4). */
  precisionOrder: PrecisionOrder;
  equipmentBrand: string | null;
  equipmentModel: string | null;
  equipmentSerial: string | null;
  equipmentCalibrationDate: string | null;
  angularPrecisionSeconds: number | null;
  distancePrecisionMm: number | null;
  distancePrecisionPpm: number | null;
  /** Formato en que se teclean los ángulos (Fase 13, P1). */
  angleInputFormat: AngleInputFormat;
}

/**
 * Crea un proceso poligonal (status `draft`) y redirige a su editor. El resto de
 * la configuración y los datos de campo se completan en el editor.
 */
export async function createPolygonalProcessAction(
  payload: CreatePolygonalPayload,
): Promise<CreatePolygonalState> {
  const name = payload.name.trim();
  const startPointCode = payload.startPointCode.trim();
  if (!name) return { error: "El nombre del proceso es obligatorio." };
  if (!startPointCode) {
    return { error: "El código del punto de partida es obligatorio." };
  }
  if (payload.startNorth == null || payload.startEast == null) {
    return { error: "Las coordenadas del punto de partida son obligatorias." };
  }

  const supabase = await createClient();

  // El lugar es obligatorio desde la Fase 5: el proceso cuelga del lugar de
  // agrupación del proyecto, nunca de un control de asentamientos (Fase 22).
  const site = await groupingSiteId(supabase, payload.projectId);
  if ("error" in site) return { error: site.error };

  const { data, error } = await supabase
    .from("polygonal_processes")
    .insert({
      project_id: payload.projectId,
      site_id: site.id,
      name,
      type: payload.type,
      // En cerradas lo elige el usuario (interior/exterior); en abiertas queda
      // determinado por el tipo.
      angle_type:
        payload.type === "open_controlled"
          ? "deflection"
          : (payload.angleType ?? "interior"),
      reference_point_id: payload.referencePointId,
      reference_point_code: payload.referencePointCode,
      angle_readings_min: payload.angleReadingsMin,
      start_point_code: startPointCode,
      start_north: payload.startNorth,
      start_east: payload.startEast,
      start_azimuth_deg: payload.startAzimuthDeg,
      start_azimuth_min: payload.startAzimuthMin,
      start_azimuth_sec: payload.startAzimuthSec,
      end_point_code: payload.endPointCode,
      end_north: payload.endNorth,
      end_east: payload.endEast,
      end_azimuth_deg: payload.endAzimuthDeg,
      end_azimuth_min: payload.endAzimuthMin,
      end_azimuth_sec: payload.endAzimuthSec,
      precision_order: payload.precisionOrder,
      angle_input_format: payload.angleInputFormat,
      equipment_brand: payload.equipmentBrand,
      equipment_model: payload.equipmentModel,
      equipment_serial: payload.equipmentSerial,
      equipment_calibration_date: payload.equipmentCalibrationDate,
      angular_precision_seconds: payload.angularPrecisionSeconds,
      distance_precision_mm: payload.distancePrecisionMm,
      distance_precision_ppm: payload.distancePrecisionPpm,
      status: "draft",
    })
    .select("id")
    .single();

  if (error || !data) {
    return { error: "No se pudo crear el proceso. Intenta de nuevo." };
  }

  redirect(`/projects/${payload.projectId}/polygonal/${data.id}`);
}
