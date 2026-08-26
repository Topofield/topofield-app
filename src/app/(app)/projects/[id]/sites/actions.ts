"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { StructureType } from "@/types/site";
import { resyncSiteReadings } from "@/lib/supabase/settlement-sync";

export interface ActionResult {
  ok: boolean;
  error?: string;
  siteId?: string;
}

export interface SitePayload {
  projectId: string;
  name: string;
  description: string | null;
  structureType: StructureType;
  velocityCaution: number;
  velocityAlert: number;
  velocityAlarm: number;
  accumulatedCaution: number;
  accumulatedAlert: number;
  accumulatedAlarm: number;
  angularDistortionLimit: number;
  notes: string | null;
}

/**
 * Valida los umbrales de un lugar. Deben ser positivos y estrictamente
 * crecientes: un umbral de alerta por debajo del de precaución haría que el
 * nivel intermedio no se alcanzara nunca, y el semáforo saltaría de normal a
 * alerta sin pasar por precaución.
 */
function validateThresholds(payload: SitePayload): string | null {
  const { velocityCaution: vc, velocityAlert: va, velocityAlarm: vm } = payload;
  const {
    accumulatedCaution: ac,
    accumulatedAlert: aa,
    accumulatedAlarm: am,
  } = payload;

  for (const [nombre, valor] of [
    ["precaución de velocidad", vc],
    ["alerta de velocidad", va],
    ["alarma de velocidad", vm],
    ["precaución de acumulado", ac],
    ["alerta de acumulado", aa],
    ["alarma de acumulado", am],
    ["límite de distorsión", payload.angularDistortionLimit],
  ] as const) {
    if (!Number.isFinite(valor) || valor <= 0) {
      return `El umbral de ${nombre} debe ser un número positivo.`;
    }
  }

  if (!(vc < va && va < vm)) {
    return "Los umbrales de velocidad deben ser crecientes: precaución < alerta < alarma.";
  }
  if (!(ac < aa && aa < am)) {
    return "Los umbrales de asentamiento acumulado deben ser crecientes: precaución < alerta < alarma.";
  }
  return null;
}

/** Crea un lugar. Los umbrales llegan del preset del tipo de estructura. */
export async function createSiteAction(
  payload: SitePayload,
): Promise<ActionResult> {
  if (payload.name.trim() === "") {
    return { ok: false, error: "El lugar necesita un nombre." };
  }
  const thresholdError = validateThresholds(payload);
  if (thresholdError) return { ok: false, error: thresholdError };

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("sites")
    .insert({
      project_id: payload.projectId,
      name: payload.name.trim(),
      description: payload.description,
      structure_type: payload.structureType,
      velocity_caution: payload.velocityCaution,
      velocity_alert: payload.velocityAlert,
      velocity_alarm: payload.velocityAlarm,
      accumulated_caution: payload.accumulatedCaution,
      accumulated_alert: payload.accumulatedAlert,
      accumulated_alarm: payload.accumulatedAlarm,
      angular_distortion_limit: payload.angularDistortionLimit,
      notes: payload.notes,
    })
    .select("id")
    .single();

  if (error) return { ok: false, error: error.message };

  revalidatePath(`/projects/${payload.projectId}`);
  return { ok: true, siteId: data.id };
}

/** Guarda la configuración de un lugar. Rechaza lugares cerrados. */
export async function saveSiteAction(
  siteId: string,
  payload: SitePayload,
): Promise<ActionResult> {
  if (payload.name.trim() === "") {
    return { ok: false, error: "El lugar necesita un nombre." };
  }
  const thresholdError = validateThresholds(payload);
  if (thresholdError) return { ok: false, error: thresholdError };

  const supabase = await createClient();

  // Se lee también `project_id` real de la fila para el revalidatePath de
  // abajo: el `projectId` del payload lo controla el cliente y un cliente
  // malicioso podría enviar el id de un proyecto ajeno. Usar el valor leído
  // de la base evita revalidar (o filtrar la existencia de) una ruta que no
  // corresponde al lugar que en verdad se está guardando.
  const { data: site } = await supabase
    .from("sites")
    .select("id, status, project_id")
    .eq("id", siteId)
    .maybeSingle();
  if (!site) return { ok: false, error: "Lugar no encontrado." };
  if (site.status === "closed") {
    return { ok: false, error: "El lugar está cerrado; no admite cambios." };
  }

  const { error } = await supabase
    .from("sites")
    .update({
      name: payload.name.trim(),
      description: payload.description,
      structure_type: payload.structureType,
      velocity_caution: payload.velocityCaution,
      velocity_alert: payload.velocityAlert,
      velocity_alarm: payload.velocityAlarm,
      accumulated_caution: payload.accumulatedCaution,
      accumulated_alert: payload.accumulatedAlert,
      accumulated_alarm: payload.accumulatedAlarm,
      angular_distortion_limit: payload.angularDistortionLimit,
      notes: payload.notes,
    })
    .eq("id", siteId);

  if (error) return { ok: false, error: error.message };

  // Los umbrales acaban de cambiar, y `settlement_readings.alert_status` es una
  // caché derivada de ellos: las lecturas ya guardadas conservan la
  // clasificación del criterio anterior. El hub las lee tal cual mientras el
  // panel del lugar recalcula en vivo, así que sin esto las dos vistas se
  // contradirían — y un informe que mezclara ambas fuentes se contradiría a sí
  // mismo dentro del mismo documento.
  //
  // Solo se reescriben las visitas ABIERTAS; las cerradas conservan el criterio
  // con el que se cerraron, por trazabilidad.
  const resync = await resyncSiteReadings(supabase, siteId);
  if (!resync.ok) return { ok: false, error: resync.error };

  revalidatePath(`/projects/${site.project_id}`);
  revalidatePath(`/projects/${site.project_id}/settlement/${siteId}`);
  return { ok: true };
}

/** Cierra un lugar: fin del monitoreo. Queda en solo lectura. */
export async function closeSiteAction(
  projectId: string,
  siteId: string,
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sesión no válida." };

  // Igual que en saveSiteAction: se lee `project_id` de la fila y se usa ese
  // valor para el revalidatePath, no el `projectId` que llega como parámetro
  // desde el cliente, que podría no corresponder al lugar real.
  const { data: site } = await supabase
    .from("sites")
    .select("id, status, project_id")
    .eq("id", siteId)
    .maybeSingle();
  if (!site) return { ok: false, error: "Lugar no encontrado." };
  if (site.status === "closed") {
    return { ok: false, error: "El lugar ya está cerrado." };
  }

  const { error } = await supabase
    .from("sites")
    .update({
      status: "closed",
      closed_at: new Date().toISOString(),
      closed_by: user.id,
    })
    .eq("id", siteId);

  if (error) return { ok: false, error: error.message };

  revalidatePath(`/projects/${site.project_id}`);
  return { ok: true };
}
