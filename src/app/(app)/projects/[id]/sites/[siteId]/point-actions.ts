"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { resyncSiteReadings } from "@/lib/supabase/settlement-sync";
import { validateActiveFrom, validateRetirement } from "@/lib/validators/settlement";
import { logDbError } from "@/lib/errors/user-message";

export interface ActionResult {
  ok: boolean;
  error?: string;
  pointId?: string;
  /**
   * Solo en `deletePointAction`: el borrado no se ejecutó porque el punto
   * tiene lecturas y hace falta que el usuario confirme.
   * `lecturasAfectadas` es el número de lecturas que se perderían.
   */
  requiereConfirmacion?: boolean;
  lecturasAfectadas?: number;
}

export interface PointPayload {
  siteId: string;
  code: string;
  locationDescription: string;
  initialElevation: number | null;
  /**
   * Fecha de alta (Fase 11). Obligatoria al crear un punto en un lugar que ya
   * tiene visitas; null en un lugar sin visitas (punto original). Un punto de
   * alta no lleva C0: su línea base es su primera lectura.
   */
  activeFrom: string | null;
}

/** Valida los campos que controla el usuario. */
function validatePointPayload(payload: PointPayload): string | null {
  if (payload.code.trim() === "") {
    return "El punto necesita un código.";
  }
  if (payload.locationDescription.trim() === "") {
    return "El punto necesita una descripción de ubicación.";
  }
  return null;
}

/** Carga el lugar y verifica que exista y sea de asentamientos. */
async function loadSite(
  supabase: Awaited<ReturnType<typeof createClient>>,
  siteId: string,
) {
  const { data: site } = await supabase
    .from("sites")
    .select("id, project_id, kind")
    .eq("id", siteId)
    .maybeSingle();
  // Un lugar de agrupación (Fase 22) no tiene catálogo de puntos.
  if (!site || site.kind !== "settlement") {
    return { ok: false as const, error: "Lugar no encontrado." };
  }
  return { ok: true as const, site };
}

/** ¿El lugar ya tiene visitas? Decide si un punto nuevo es original o de alta. */
async function siteHasVisits(
  supabase: Awaited<ReturnType<typeof createClient>>,
  siteId: string,
): Promise<boolean> {
  const { count } = await supabase
    .from("settlement_visits")
    .select("id", { count: "exact", head: true })
    .eq("site_id", siteId);
  return (count ?? 0) > 0;
}

/** Cuántas visitas tienen lectura de un punto (Fase 37): para avisar antes de cambiarlo. */
async function visitsWithReadings(
  supabase: Awaited<ReturnType<typeof createClient>>,
  pointId: string,
): Promise<number> {
  const { count } = await supabase
    .from("settlement_readings")
    .select("id", { count: "exact", head: true })
    .eq("point_id", pointId);
  return count ?? 0;
}

/** Fecha de la última lectura de un punto, en cualquier visita, o null. */
async function lastReadingDate(
  supabase: Awaited<ReturnType<typeof createClient>>,
  pointId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from("settlement_readings")
    .select("settlement_visits!inner(date)")
    .eq("point_id", pointId);
  const dates = (data ?? []).map(
    (r) => (r as unknown as { settlement_visits: { date: string } }).settlement_visits.date,
  );
  return dates.length === 0 ? null : dates.sort().at(-1)!;
}

/** Carga un punto del lugar, o null si no existe o es de otro lugar. */
async function loadPoint(
  supabase: Awaited<ReturnType<typeof createClient>>,
  siteId: string,
  pointId: string,
) {
  const { data } = await supabase
    .from("settlement_points")
    .select("*")
    .eq("id", pointId)
    .eq("site_id", siteId)
    .maybeSingle();
  return data;
}

/**
 * Crea un punto del catálogo de un lugar.
 *
 * Si el lugar ya tiene visitas, el punto se da de ALTA (Fase 11): exige fecha
 * de alta y no lleva C0 —su línea base es su primera lectura—. Si no tiene
 * visitas, es un punto original, con C0 opcional como siempre. Desde la Fase
 * 37 la fecha de alta es libre: ya no hay visitas cerradas que la limiten.
 */
export async function createPointAction(
  payload: PointPayload,
): Promise<ActionResult> {
  const validationError = validatePointPayload(payload);
  if (validationError) return { ok: false, error: validationError };

  const supabase = await createClient();

  const siteCheck = await loadSite(supabase, payload.siteId);
  if (!siteCheck.ok) return { ok: false, error: siteCheck.error };

  const isAlta = await siteHasVisits(supabase, payload.siteId);
  if (isAlta) {
    if (payload.activeFrom === null) {
      return {
        ok: false,
        error: "El lugar ya tiene visitas: indica la fecha de alta del punto.",
      };
    }
    const altaError = validateActiveFrom(payload.activeFrom, null);
    if (altaError) return { ok: false, error: altaError };
  }

  const { data, error } = await supabase
    .from("settlement_points")
    .insert({
      site_id: payload.siteId,
      code: payload.code.trim(),
      location_description: payload.locationDescription.trim(),
      initial_elevation: isAlta ? null : payload.initialElevation,
      active_from: isAlta ? payload.activeFrom : null,
    })
    .select("id")
    .single();

  if (error) {
    // 23505 = unique_violation del UNIQUE (site_id, code): dos puntos del
    // mismo lugar no pueden compartir código, porque el código es la clave
    // que el usuario usa para identificar el punto en campo.
    if (error.code === "23505") {
      return {
        ok: false,
        error: "Ya existe un punto con ese código en este lugar.",
      };
    }
    return { ok: false, error: logDbError(error, "No se pudo crear el punto.") };
  }

  revalidatePath(`/projects/${siteCheck.site.project_id}/sites/${payload.siteId}`);
  return { ok: true, pointId: data.id };
}

/** Guarda los datos de un punto existente del catálogo. */
export async function savePointAction(
  pointId: string,
  payload: PointPayload,
): Promise<ActionResult> {
  const validationError = validatePointPayload(payload);
  if (validationError) return { ok: false, error: validationError };

  const supabase = await createClient();

  const siteCheck = await loadSite(supabase, payload.siteId);
  if (!siteCheck.ok) return { ok: false, error: siteCheck.error };

  const current = await loadPoint(supabase, payload.siteId, pointId);
  if (!current) return { ok: false, error: "Punto no encontrado." };

  // Un punto de baja ya no tiene datos abiertos: editar su C0 solo
  // reescribiría la historia de un punto que ya no se mide. Para corregirlo, primero se deshace la baja.
  if (current.retired_on !== null) {
    return {
      ok: false,
      error: "Un punto de baja no se edita. Si la baja fue un error, deshazla primero.",
    };
  }

  // Un punto de alta conserva su condición: sin C0, y su fecha de alta solo
  // se mueve mientras no se haya medido.
  const isAlta = current.active_from !== null;
  let activeFrom = current.active_from;
  if (isAlta && payload.activeFrom !== null && payload.activeFrom !== current.active_from) {
    if ((await lastReadingDate(supabase, pointId)) !== null) {
      return {
        ok: false,
        error: "La fecha de alta no se cambia una vez medido el punto.",
      };
    }
    const altaError = validateActiveFrom(payload.activeFrom, null);
    if (altaError) return { ok: false, error: altaError };
    activeFrom = payload.activeFrom;
  }

  // La C0 se cambia aunque el punto tenga historia (Fase 37, decisión 18): la
  // pantalla avisa antes cuántas visitas cambian (`pointImpactAction`).
  const initialElevation = isAlta ? null : payload.initialElevation;

  const { error } = await supabase
    .from("settlement_points")
    .update({
      code: payload.code.trim(),
      location_description: payload.locationDescription.trim(),
      initial_elevation: initialElevation,
      active_from: activeFrom,
    })
    .eq("id", pointId)
    .eq("site_id", payload.siteId);

  if (error) {
    if (error.code === "23505") {
      return {
        ok: false,
        error: "Ya existe un punto con ese código en este lugar.",
      };
    }
    return { ok: false, error: logDbError(error, "No se pudo guardar el punto.") };
  }

  // El código es la clave con que la libreta de una visita encuentra al punto
  // (Fase 18): la cota se deriva de la fila cuyo código coincide. Si el código
  // cambia y las filas no, el siguiente guardado de esa visita ya no
  // encontraría el punto. Se renombran las filas de todas sus visitas: desde la
  // Fase 37 ninguna está cerrada.
  const newCode = payload.code.trim();
  if (newCode !== current.code) {
    const { error: renameError } = await supabase
      .from("settlement_book_readings")
      .update({ point_code: newCode })
      .eq("point_id", pointId);
    if (renameError) return { ok: false, error: logDbError(renameError, "No se pudo guardar el punto.") };
  }

  // La C0 del punto puede haber cambiado, y de ella dependen valores YA
  // PERSISTIDOS en `settlement_readings`: el acumulado es `(cota − C0) × 1000`.
  // Sin recalcular, las lecturas guardadas conservan los números de la C0
  // vieja mientras el panel del lugar los recalcula en vivo — la misma
  // divergencia que la edición de umbrales, por una puerta distinta.
  const resync = await resyncSiteReadings(supabase, payload.siteId);
  if (!resync.ok) return { ok: false, error: resync.error };

  revalidatePath(`/projects/${siteCheck.site.project_id}/sites/${payload.siteId}`);
  revalidatePath(
    `/projects/${siteCheck.site.project_id}/settlement/${payload.siteId}`,
  );
  return { ok: true };
}

/**
 * Cuántas visitas cambian si se cambia la C0 del punto o se elimina (Fase 37):
 * la pantalla lo dice antes de confirmar.
 */
export async function pointImpactAction(siteId: string, pointId: string): Promise<{ visits: number }> {
  const supabase = await createClient();
  const point = await loadPoint(supabase, siteId, pointId);
  if (!point) return { visits: 0 };
  return { visits: await visitsWithReadings(supabase, pointId) };
}

/**
 * Elimina un punto del catálogo.
 *
 * Si el punto tiene lecturas, el `DELETE` cascadea por la FK y se las lleva:
 * son cotas medidas en terreno, así que no se borran a la primera. Sin
 * `confirmado`, se informa cuántas se perderían y no se borra nada; con
 * `confirmado: true`, se procede. Si se perdió en campo, mejor darlo de baja.
 */
export async function deletePointAction(
  siteId: string,
  pointId: string,
  confirmado = false,
): Promise<ActionResult> {
  const supabase = await createClient();

  const siteCheck = await loadSite(supabase, siteId);
  if (!siteCheck.ok) return { ok: false, error: siteCheck.error };

  if (!confirmado) {
    const n = await visitsWithReadings(supabase, pointId);
    if (n > 0) {
      return {
        ok: false,
        requiereConfirmacion: true,
        lecturasAfectadas: n,
        error: `El punto tiene ${n} ${n === 1 ? "lectura registrada" : "lecturas registradas"}. Si continúas, se eliminarán junto con el punto.`,
      };
    }
  }

  const { error } = await supabase
    .from("settlement_points")
    .delete()
    .eq("id", pointId)
    .eq("site_id", siteId);

  if (error) return { ok: false, error: logDbError(error, "No se pudo eliminar el punto.") };

  revalidatePath(`/projects/${siteCheck.site.project_id}/sites/${siteId}`);
  return { ok: true };
}

/**
 * Da de baja un punto (Fase 11): deja de medirse desde `retiredOn` —la primera
 * fecha en que ya no se mide— sin borrar ninguna lectura.
 *
 * No recalcula nada: ningún valor derivado de otro punto depende de que este
 * siga vigente.
 */
export async function retirePointAction(
  siteId: string,
  pointId: string,
  retiredOn: string,
  reason: string,
): Promise<ActionResult> {
  const supabase = await createClient();

  const siteCheck = await loadSite(supabase, siteId);
  if (!siteCheck.ok) return { ok: false, error: siteCheck.error };

  const point = await loadPoint(supabase, siteId, pointId);
  if (!point) return { ok: false, error: "Punto no encontrado." };
  if (point.retired_on !== null) {
    return { ok: false, error: "El punto ya está de baja." };
  }

  const retirementError = validateRetirement({
    retiredOn,
    reason,
    activeFrom: point.active_from,
    lastReadingDate: await lastReadingDate(supabase, pointId),
  });
  if (retirementError) return { ok: false, error: retirementError };

  const { error } = await supabase
    .from("settlement_points")
    .update({ retired_on: retiredOn, retirement_reason: reason.trim() })
    .eq("id", pointId)
    .eq("site_id", siteId);
  if (error) return { ok: false, error: logDbError(error, "No se pudo dar de baja el punto.") };

  revalidatePath(`/projects/${siteCheck.site.project_id}/sites/${siteId}`);
  revalidatePath(`/projects/${siteCheck.site.project_id}/settlement/${siteId}`);
  return { ok: true };
}

/** Deshace una baja: para corregir un error (Fase 11; libre desde la Fase 37). */
export async function undoRetirementAction(
  siteId: string,
  pointId: string,
): Promise<ActionResult> {
  const supabase = await createClient();

  const siteCheck = await loadSite(supabase, siteId);
  if (!siteCheck.ok) return { ok: false, error: siteCheck.error };

  const point = await loadPoint(supabase, siteId, pointId);
  if (!point) return { ok: false, error: "Punto no encontrado." };
  if (point.retired_on === null) {
    return { ok: false, error: "El punto no está de baja." };
  }

  const { error } = await supabase
    .from("settlement_points")
    .update({ retired_on: null, retirement_reason: null })
    .eq("id", pointId)
    .eq("site_id", siteId);
  if (error) return { ok: false, error: logDbError(error, "No se pudo deshacer la baja del punto.") };

  revalidatePath(`/projects/${siteCheck.site.project_id}/sites/${siteId}`);
  revalidatePath(`/projects/${siteCheck.site.project_id}/settlement/${siteId}`);
  return { ok: true };
}
