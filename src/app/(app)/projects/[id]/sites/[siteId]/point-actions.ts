"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { resyncSiteReadings } from "@/lib/supabase/settlement-sync";
import {
  undoRetirementBlocker,
  validateActiveFrom,
  validateRetirement,
} from "@/lib/validators/settlement";

export interface ActionResult {
  ok: boolean;
  error?: string;
  pointId?: string;
  /**
   * Solo en `deletePointAction`: el borrado no se ejecutó porque el punto
   * tiene lecturas en visitas abiertas y hace falta que el usuario confirme.
   * `lecturasAfectadas` es el número de lecturas que se perderían.
   */
  requiereConfirmacion?: boolean;
  lecturasAfectadas?: number;
}

export interface PointPayload {
  siteId: string;
  code: string;
  locationDescription: string;
  northing: number | null;
  easting: number | null;
  initialElevation: number | null;
  /**
   * Fecha de alta (Fase 11). Obligatoria al crear un punto en un lugar que ya
   * tiene visitas; null en un lugar sin visitas (punto original). Un punto de
   * alta no lleva C0: su línea base es su primera lectura.
   */
  activeFrom: string | null;
}

/**
 * Valida los campos que controla el usuario. Las coordenadas N/E son
 * opcionales, pero si viene una debe venir la otra: con solo N o solo E no se
 * puede calcular ninguna distancia, y el par quedaría silenciosamente fuera
 * de la tabla de diferenciales.
 */
function validatePointPayload(payload: PointPayload): string | null {
  if (payload.code.trim() === "") {
    return "El punto necesita un código.";
  }
  if (payload.locationDescription.trim() === "") {
    return "El punto necesita una descripción de ubicación.";
  }
  const tieneN = payload.northing !== null;
  const tieneE = payload.easting !== null;
  if (tieneN !== tieneE) {
    return "Indica las dos coordenadas (N y E) o ninguna.";
  }
  return null;
}

/** Carga el lugar y verifica que exista y no esté cerrado. */
async function loadOpenSite(
  supabase: Awaited<ReturnType<typeof createClient>>,
  siteId: string,
) {
  const { data: site } = await supabase
    .from("sites")
    .select("id, status, project_id")
    .eq("id", siteId)
    .maybeSingle();
  if (!site) return { ok: false as const, error: "Lugar no encontrado." };
  if (site.status === "closed") {
    return {
      ok: false as const,
      error: "El lugar está cerrado; no admite cambios en el catálogo.",
    };
  }
  return { ok: true as const, site };
}

/**
 * Visitas del lugar, en orden de fecha, con su estado. Deciden si un punto
 * nuevo es original o de alta, y si una baja todavía se puede deshacer.
 */
async function loadSiteVisits(
  supabase: Awaited<ReturnType<typeof createClient>>,
  siteId: string,
) {
  const { data } = await supabase
    .from("settlement_visits")
    .select("visit_number, date, status")
    .eq("site_id", siteId)
    .order("date", { ascending: true });
  const visits = (data ?? []).map((v) => ({
    visitNumber: v.visit_number,
    date: v.date,
    closed: v.status === "closed",
  }));
  return {
    all: visits,
    closed: visits.filter((v) => v.closed),
    lastClosedDate: visits.filter((v) => v.closed).at(-1)?.date ?? null,
  };
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
 * de alta posterior a la última visita cerrada y no lleva C0 —su línea base es
 * su primera lectura—. Si no tiene visitas, es un punto original, con C0
 * opcional como siempre.
 */
export async function createPointAction(
  payload: PointPayload,
): Promise<ActionResult> {
  const validationError = validatePointPayload(payload);
  if (validationError) return { ok: false, error: validationError };

  const supabase = await createClient();

  const siteCheck = await loadOpenSite(supabase, payload.siteId);
  if (!siteCheck.ok) return { ok: false, error: siteCheck.error };

  const visits = await loadSiteVisits(supabase, payload.siteId);
  const isAlta = visits.all.length > 0;
  if (isAlta) {
    if (payload.activeFrom === null) {
      return {
        ok: false,
        error: "El lugar ya tiene visitas: indica la fecha de alta del punto.",
      };
    }
    const altaError = validateActiveFrom(payload.activeFrom, visits.lastClosedDate);
    if (altaError) return { ok: false, error: altaError };
  }

  const { data, error } = await supabase
    .from("settlement_points")
    .insert({
      site_id: payload.siteId,
      code: payload.code.trim(),
      location_description: payload.locationDescription.trim(),
      northing: payload.northing,
      easting: payload.easting,
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
    return { ok: false, error: error.message };
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

  const siteCheck = await loadOpenSite(supabase, payload.siteId);
  if (!siteCheck.ok) return { ok: false, error: siteCheck.error };

  const current = await loadPoint(supabase, payload.siteId, pointId);
  if (!current) return { ok: false, error: "Punto no encontrado." };

  // Un punto de baja ya no tiene datos abiertos: editar su C0 o sus
  // coordenadas solo reescribiría su historia cerrada, que el panel recalcula
  // en vivo. Para corregirlo, primero se deshace la baja, si todavía se puede.
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
    const visits = await loadSiteVisits(supabase, payload.siteId);
    const altaError = validateActiveFrom(payload.activeFrom, visits.lastClosedDate);
    if (altaError) return { ok: false, error: altaError };
    activeFrom = payload.activeFrom;
  }

  const { error } = await supabase
    .from("settlement_points")
    .update({
      code: payload.code.trim(),
      location_description: payload.locationDescription.trim(),
      northing: payload.northing,
      easting: payload.easting,
      initial_elevation: isAlta ? null : payload.initialElevation,
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
    return { ok: false, error: error.message };
  }

  // La C0 y las coordenadas del punto acaban de cambiar, y de ellas dependen
  // valores YA PERSISTIDOS en `settlement_readings`: el acumulado es
  // `(cota − C0) × 1000` y las coordenadas alimentan la distorsión angular.
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
 * Elimina un punto del catálogo.
 *
 * Rechaza el borrado sin excepción si el punto tiene lecturas en visitas
 * cerradas: esas lecturas son parte del registro inmutable del monitoreo y
 * borrar el punto las dejaría huérfanas de catálogo.
 *
 * Si el punto tiene lecturas en visitas abiertas (`draft` / `calculated`),
 * el `DELETE` de `settlement_points` cascadea por la FK
 * `settlement_readings_point_id_fkey` y se llevaría esas lecturas con él: son
 * cotas medidas en terreno, no un registro administrativo, así que no se
 * borran a la primera. Sin `confirmado`, se informa cuántas lecturas se
 * perderían y no se borra nada; con `confirmado: true`, se procede.
 */
export async function deletePointAction(
  siteId: string,
  pointId: string,
  confirmado = false,
): Promise<ActionResult> {
  const supabase = await createClient();

  const siteCheck = await loadOpenSite(supabase, siteId);
  if (!siteCheck.ok) return { ok: false, error: siteCheck.error };

  const { count: lecturasCerradas } = await supabase
    .from("settlement_readings")
    .select("id, settlement_visits!inner(status)", {
      count: "exact",
      head: true,
    })
    .eq("point_id", pointId)
    .eq("settlement_visits.status", "closed");
  if ((lecturasCerradas ?? 0) > 0) {
    return {
      ok: false,
      error:
        "El punto tiene lecturas en visitas cerradas y no puede eliminarse. Si el BM se perdió o se destruyó, dalo de baja.",
    };
  }

  if (!confirmado) {
    const { count: lecturasAbiertas } = await supabase
      .from("settlement_readings")
      .select("id, settlement_visits!inner(status)", {
        count: "exact",
        head: true,
      })
      .eq("point_id", pointId)
      .neq("settlement_visits.status", "closed");
    // Un punto sin lecturas se borra sin más. Uno CON lecturas en visitas
    // abiertas arrastra esas mediciones por la FK en cascada, así que no se
    // borra a la primera: se informa cuántas se perderían y se exige
    // confirmación explícita. Son cotas medidas en terreno, no un registro
    // administrativo.
    if ((lecturasAbiertas ?? 0) > 0) {
      const n = lecturasAbiertas ?? 0;
      return {
        ok: false,
        requiereConfirmacion: true,
        lecturasAfectadas: n,
        error: `El punto tiene ${n} ${n === 1 ? "lectura registrada" : "lecturas registradas"} en visitas abiertas. Si continúas, se eliminarán junto con el punto.`,
      };
    }
  }

  const { error } = await supabase
    .from("settlement_points")
    .delete()
    .eq("id", pointId)
    .eq("site_id", siteId);

  if (error) return { ok: false, error: error.message };

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

  const siteCheck = await loadOpenSite(supabase, siteId);
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
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/projects/${siteCheck.site.project_id}/sites/${siteId}`);
  revalidatePath(`/projects/${siteCheck.site.project_id}/settlement/${siteId}`);
  return { ok: true };
}

/**
 * Deshace una baja. Solo para corregir un error: mientras ninguna visita
 * cerrada tenga fecha igual o posterior a la baja (`undoRetirementBlocker`).
 */
export async function undoRetirementAction(
  siteId: string,
  pointId: string,
): Promise<ActionResult> {
  const supabase = await createClient();

  const siteCheck = await loadOpenSite(supabase, siteId);
  if (!siteCheck.ok) return { ok: false, error: siteCheck.error };

  const point = await loadPoint(supabase, siteId, pointId);
  if (!point) return { ok: false, error: "Punto no encontrado." };
  if (point.retired_on === null) {
    return { ok: false, error: "El punto no está de baja." };
  }

  const visits = await loadSiteVisits(supabase, siteId);
  const blocker = undoRetirementBlocker(point.retired_on, visits.closed);
  if (blocker) return { ok: false, error: blocker };

  const { error } = await supabase
    .from("settlement_points")
    .update({ retired_on: null, retirement_reason: null })
    .eq("id", pointId)
    .eq("site_id", siteId);
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/projects/${siteCheck.site.project_id}/sites/${siteId}`);
  revalidatePath(`/projects/${siteCheck.site.project_id}/settlement/${siteId}`);
  return { ok: true };
}
