"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { PolygonalType } from "@/types/polygonal";

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

  // El lugar es obligatorio desde la Fase 5. Mientras el formulario no ofrezca
  // elegirlo (Task 10), se usa el primero del proyecto.
  const { data: site } = await supabase
    .from("sites")
    .select("id")
    .eq("project_id", payload.projectId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!site) {
    return { error: "El proyecto no tiene ningún lugar definido." };
  }

  const { data, error } = await supabase
    .from("polygonal_processes")
    .insert({
      project_id: payload.projectId,
      site_id: site.id,
      name,
      type: payload.type,
      angle_type: payload.type === "open_controlled" ? "deflection" : "internal",
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
      status: "draft",
    })
    .select("id")
    .single();

  if (error || !data) {
    return { error: "No se pudo crear el proceso. Intenta de nuevo." };
  }

  redirect(`/projects/${payload.projectId}/polygonal/${data.id}`);
}
