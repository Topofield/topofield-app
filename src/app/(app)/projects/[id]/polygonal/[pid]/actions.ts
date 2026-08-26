"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { decimalToDms, dmsToDecimal } from "@/lib/calculations/angles";
import { computePolygonal } from "@/lib/calculations/polygonal";
import {
  expectStationCapture,
  hasCaptureErrors,
  validatePolygonalStation,
} from "@/lib/validators/polygonal";
import { derivePolygonalCloseStatus } from "./close-status";
import type {
  CorrectionMethod,
  DeflectionDirection,
  PolygonalInput,
  PolygonalType,
} from "@/types/polygonal";
import type { PrecisionOrder } from "@/types/project";

export interface ActionResult {
  ok: boolean;
  error?: string;
}

export interface StationDraft {
  pointCode: string;
  angleDeg: number | null;
  angleMin: number | null;
  angleSec: number | null;
  deflectionDirection: DeflectionDirection | null;
  horizontalDistance: number | null;
}

export interface SavePolygonalPayload {
  processId: string;
  name: string;
  type: PolygonalType;
  startPointCode: string;
  startNorth: number;
  startEast: number;
  startAzimuthDeg: number | null;
  startAzimuthMin: number | null;
  startAzimuthSec: number | null;
  endPointCode: string | null;
  endNorth: number | null;
  endEast: number | null;
  endAzimuthDeg: number | null;
  endAzimuthMin: number | null;
  endAzimuthSec: number | null;
  correctionMethod: CorrectionMethod;
  notes: string | null;
  stations: StationDraft[];
}

export interface ClosePolygonalPayload {
  processId: string;
  asRejected: boolean;
}

function angleOrNaN(
  deg: number | null,
  min: number | null,
  sec: number | null,
): number {
  return deg != null && min != null && sec != null
    ? dmsToDecimal(deg, min, sec)
    : Number.NaN;
}

function buildInput(
  payload: SavePolygonalPayload,
  order: PrecisionOrder,
): PolygonalInput {
  return {
    type: payload.type,
    startNorth: payload.startNorth,
    startEast: payload.startEast,
    startAzimuth: angleOrNaN(
      payload.startAzimuthDeg,
      payload.startAzimuthMin,
      payload.startAzimuthSec,
    ),
    endNorth: payload.endNorth,
    endEast: payload.endEast,
    endAzimuth:
      payload.endAzimuthDeg != null
        ? dmsToDecimal(
            payload.endAzimuthDeg,
            payload.endAzimuthMin ?? 0,
            payload.endAzimuthSec ?? 0,
          )
        : null,
    order,
    method: payload.correctionMethod,
    stations: payload.stations.map((st) => ({
      pointCode: st.pointCode,
      angle: angleOrNaN(st.angleDeg, st.angleMin, st.angleSec),
      deflectionDirection: st.deflectionDirection,
      distance: st.horizontalDistance ?? Number.NaN,
    })),
  };
}

/**
 * Guarda la configuración, las estaciones y los resultados de un proceso. El
 * servidor recalcula con computePolygonal para que los resultados persistidos
 * sean autoritativos. Rechaza procesos cerrados (inmutabilidad, § 4.6).
 */
export async function savePolygonalProcessAction(
  payload: SavePolygonalPayload,
): Promise<ActionResult> {
  const supabase = await createClient();

  const { data: process } = await supabase
    .from("polygonal_processes")
    .select("id, status, project_id")
    .eq("id", payload.processId)
    .maybeSingle();
  if (!process) return { ok: false, error: "Proceso no encontrado." };
  if (process.status === "closed" || process.status === "rejected") {
    return { ok: false, error: "El proceso está cerrado; no admite cambios." };
  }

  const { data: project } = await supabase
    .from("projects")
    .select("precision_order")
    .eq("id", process.project_id)
    .maybeSingle();
  const order = (project?.precision_order ?? "ordinario") as PrecisionOrder;

  // --- Revalidación en el servidor -----------------------------------------
  // La clave publicable de Supabase es pública por diseño: una llamada
  // directa a esta acción podría guardar una libreta que la interfaz habría
  // bloqueado. Antes solo se recalculaban los resultados, de modo que los
  // números eran del servidor pero los datos de campo no se comprobaban.
  // Se usa `expectStationCapture` (la misma regla que el editor) para no
  // bloquear captura parcial legítima: una estación inicial sin ángulo, o
  // una final sin ángulo ni distancia, no es un error (§ 5.1).
  const issues = payload.stations.map((st, i) =>
    validatePolygonalStation(
      {
        pointCode: st.pointCode,
        angleDeg: st.angleDeg,
        angleMin: st.angleMin,
        angleSec: st.angleSec,
        distance: st.horizontalDistance,
      },
      expectStationCapture(payload.type, i, payload.stations.length),
    ),
  );
  if (hasCaptureErrors(issues)) {
    return {
      ok: false,
      error: "Hay celdas con errores de captura; corrígelas antes de guardar.",
    };
  }

  const result = computePolygonal(buildInput(payload, order));

  const relPrec = result.relativePrecision;
  const relativePrecision =
    relPrec == null
      ? null
      : relPrec === Infinity
        ? "1:∞"
        : `1:${Math.round(relPrec)}`;
  const computed =
    result.stations.length > 0 &&
    result.stations.every((s) => s.north != null);
  const status = computed
    ? "calculated"
    : payload.stations.length > 0
      ? "in_progress"
      : "draft";

  const { error: updateError } = await supabase
    .from("polygonal_processes")
    .update({
      name: payload.name,
      type: payload.type,
      angle_type:
        payload.type === "open_controlled" ? "deflection" : "internal",
      start_point_code: payload.startPointCode,
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
      correction_method: payload.correctionMethod,
      angular_error_seconds: result.angularError,
      linear_error: result.linearError,
      perimeter: result.perimeter,
      relative_precision: relativePrecision,
      meets_tolerance: result.meetsTolerance,
      notes: payload.notes,
      status,
    })
    .eq("id", payload.processId);
  if (updateError) {
    return { ok: false, error: "No se pudo guardar el proceso." };
  }

  // Las estaciones se reemplazan por completo: borra y reinserta el conjunto.
  await supabase
    .from("polygonal_stations")
    .delete()
    .eq("process_id", payload.processId);

  if (payload.stations.length > 0) {
    const rows = payload.stations.map((st, i) => {
      const r = result.stations[i];
      const azimuth = r?.azimuth != null ? decimalToDms(r.azimuth) : null;
      const corrected =
        r?.correctedAngle != null ? decimalToDms(r.correctedAngle) : null;
      return {
        process_id: payload.processId,
        station_order: i + 1,
        point_code: st.pointCode,
        angle_deg: st.angleDeg,
        angle_min: st.angleMin,
        angle_sec: st.angleSec,
        deflection_direction: st.deflectionDirection,
        horizontal_distance: st.horizontalDistance,
        corrected_angle_deg: corrected?.deg ?? null,
        corrected_angle_min: corrected?.min ?? null,
        corrected_angle_sec: corrected?.sec ?? null,
        azimuth_deg: azimuth?.deg ?? null,
        azimuth_min: azimuth?.min ?? null,
        azimuth_sec: azimuth?.sec ?? null,
        delta_north: r?.deltaNorth ?? null,
        delta_east: r?.deltaEast ?? null,
        corrected_delta_north: r?.correctedDeltaNorth ?? null,
        corrected_delta_east: r?.correctedDeltaEast ?? null,
        north: r?.north ?? null,
        east: r?.east ?? null,
      };
    });
    const { error: insertError } = await supabase
      .from("polygonal_stations")
      .insert(rows);
    if (insertError) {
      return { ok: false, error: "No se pudieron guardar las estaciones." };
    }
  }

  revalidatePath(
    `/projects/${process.project_id}/polygonal/${payload.processId}`,
  );
  revalidatePath(`/projects/${process.project_id}`);
  return { ok: true };
}

/**
 * Cierra un proceso (como `closed` o `rejected`) registrando la trazabilidad.
 *
 * El `status` final lo decide el servidor (`derivePolygonalCloseStatus`), no
 * el `asRejected` que manda el cliente: ver el comentario de esa función
 * para el porqué. El diálogo de cierre (`close-process-dialog.tsx`) sigue
 * evaluando `evaluatePolygonalClosure` para la experiencia normal — esto es
 * defensa en profundidad detrás de la UI, no un reemplazo.
 */
export async function closePolygonalProcessAction(
  payload: ClosePolygonalPayload,
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sesión no válida." };

  const { data: process } = await supabase
    .from("polygonal_processes")
    .select("id, status, project_id, type, meets_tolerance")
    .eq("id", payload.processId)
    .maybeSingle();
  if (!process) return { ok: false, error: "Proceso no encontrado." };
  if (process.status === "closed" || process.status === "rejected") {
    return { ok: false, error: "El proceso ya está cerrado." };
  }

  const derived = derivePolygonalCloseStatus(process, payload.asRejected);
  if (!derived.ok) return { ok: false, error: derived.error };

  const { error } = await supabase
    .from("polygonal_processes")
    .update({
      status: derived.status,
      closed_at: new Date().toISOString(),
      closed_by: user.id,
    })
    .eq("id", payload.processId);
  if (error) return { ok: false, error: "No se pudo cerrar el proceso." };

  revalidatePath(
    `/projects/${process.project_id}/polygonal/${payload.processId}`,
  );
  revalidatePath(`/projects/${process.project_id}`);
  return { ok: true };
}

/** Duplica un proceso: misma configuración, sin estaciones, en borrador. */
export async function duplicatePolygonalProcessAction(
  processId: string,
): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: original } = await supabase
    .from("polygonal_processes")
    .select("*")
    .eq("id", processId)
    .maybeSingle();
  if (!original) return { ok: false, error: "Proceso no encontrado." };

  const { error } = await supabase.from("polygonal_processes").insert({
    project_id: original.project_id,
    site_id: original.site_id,
    name: `${original.name} (copia)`,
    type: original.type,
    angle_type: original.angle_type,
    start_point_code: original.start_point_code,
    start_north: original.start_north,
    start_east: original.start_east,
    start_azimuth_deg: original.start_azimuth_deg,
    start_azimuth_min: original.start_azimuth_min,
    start_azimuth_sec: original.start_azimuth_sec,
    end_point_code: original.end_point_code,
    end_north: original.end_north,
    end_east: original.end_east,
    end_azimuth_deg: original.end_azimuth_deg,
    end_azimuth_min: original.end_azimuth_min,
    end_azimuth_sec: original.end_azimuth_sec,
    correction_method: original.correction_method,
    notes: original.notes,
    status: "draft",
  });
  if (error) return { ok: false, error: "No se pudo duplicar el proceso." };

  revalidatePath(`/projects/${original.project_id}`);
  return { ok: true };
}

/** Renombra un proceso. Rechaza los cerrados: son inmutables. */
export async function renamePolygonalProcessAction(
  processId: string,
  name: string,
): Promise<ActionResult> {
  const limpio = name.trim();
  if (!limpio) return { ok: false, error: "El nombre no puede estar vacío." };

  const supabase = await createClient();
  const { data: process } = await supabase
    .from("polygonal_processes")
    .select("id, status, project_id")
    .eq("id", processId)
    .maybeSingle();
  if (!process) return { ok: false, error: "Proceso no encontrado." };
  if (process.status === "closed" || process.status === "rejected") {
    return { ok: false, error: "El proceso está cerrado y no puede modificarse." };
  }

  const { error } = await supabase
    .from("polygonal_processes")
    .update({ name: limpio })
    .eq("id", processId);
  if (error) return { ok: false, error: "No se pudo renombrar el proceso." };

  revalidatePath(`/projects/${process.project_id}`);
  return { ok: true };
}

/** Elimina un proceso. Rechaza los cerrados: son inmutables. */
export async function deletePolygonalProcessAction(
  processId: string,
): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: process } = await supabase
    .from("polygonal_processes")
    .select("id, status, project_id")
    .eq("id", processId)
    .maybeSingle();
  if (!process) return { ok: false, error: "Proceso no encontrado." };
  if (process.status === "closed" || process.status === "rejected") {
    return { ok: false, error: "El proceso está cerrado y no puede eliminarse." };
  }

  const { error } = await supabase
    .from("polygonal_processes")
    .delete()
    .eq("id", processId);
  if (error) return { ok: false, error: "No se pudo eliminar el proceso." };

  revalidatePath(`/projects/${process.project_id}`);
  return { ok: true };
}
