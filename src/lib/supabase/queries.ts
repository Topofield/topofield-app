// Capa de lectura de Fase 2. Funciones async que reciben el cliente Supabase
// server (lo crea la página, una vez por request) y devuelven datos tipados.
// No mutan: las mutaciones viven en los Server Actions junto a cada ruta.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { Project, ProjectStatus, ReferencePoint } from "@/types/project";
import type { PolygonalProcess, PolygonalStation } from "@/types/polygonal";
import type { LevelingProcess, LevelingReading } from "@/types/leveling";
import type { Site } from "@/types/site";
import type {
  AlertLevel,
  SettlementPoint,
  SettlementVisit,
  SettlementReading,
} from "@/types/settlement";
import { worst } from "@/lib/calculations/settlement";

type Client = SupabaseClient<Database>;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface DashboardKpis {
  activeProjects: number;
  calculatedProcesses: number;
  outOfTolerance: number;
}

/**
 * KPIs del dashboard: proyectos activos, procesos calculados listos para
 * revisar/cerrar, y procesos fuera de tolerancia que requieren atención.
 *
 * Los dos KPI de procesos **solo cuentan los de proyectos activos**. Archivar
 * un proyecto es sacarlo de la vista de trabajo, así que sus procesos no deben
 * seguir apareciendo como pendientes de revisar. Sin el filtro, el panel podía
 * contradecirse a sí mismo: «1 proyecto activo» junto a «5 procesos
 * calculados» cuando esos cinco colgaban del proyecto archivado.
 *
 * El filtro se expresa como `projects!inner(status)`: el `!inner` convierte la
 * relación en un INNER JOIN, de modo que `eq("projects.status", "active")`
 * descarta las filas cuyo proyecto no esté activo.
 */
export async function getDashboardKpis(
  supabase: Client,
): Promise<DashboardKpis> {
  const [
    { count: activeProjectsCount },
    { count: calculatedCount },
    { count: outOfToleranceCount },
  ] = await Promise.all([
    supabase
      .from("projects")
      .select("id", { count: "exact", head: true })
      .eq("status", "active"),
    supabase
      .from("polygonal_processes")
      .select("id, projects!inner(status)", { count: "exact", head: true })
      .eq("status", "calculated")
      .eq("projects.status", "active"),
    supabase
      .from("polygonal_processes")
      .select("id, projects!inner(status)", { count: "exact", head: true })
      .eq("status", "calculated")
      .eq("meets_tolerance", false)
      .eq("projects.status", "active"),
  ]);

  return {
    activeProjects: activeProjectsCount ?? 0,
    calculatedProcesses: calculatedCount ?? 0,
    outOfTolerance: outOfToleranceCount ?? 0,
  };
}

/** Proyectos del usuario con el estado dado, del más reciente al más antiguo. */
export async function getDashboardProjects(
  supabase: Client,
  status: ProjectStatus,
): Promise<Project[]> {
  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .eq("status", status)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as Project[];
}

/**
 * Cuántos procesos tiene cada proyecto, indexado por `project_id`.
 *
 * Una sola consulta para todos los proyectos en lugar de una por tarjeta: con
 * N proyectos en pantalla, contar por separado sería N+1 viajes a la base.
 * RLS ya limita las filas a las del usuario, así que no hace falta filtrar por
 * `user_id` aquí.
 *
 * Un proyecto sin procesos no aparece en el resultado; quien consulte debe
 * tratar la ausencia como 0.
 */
export async function getProcessCountsByProject(
  supabase: Client,
): Promise<Record<string, number>> {
  const { data, error } = await supabase
    .from("polygonal_processes")
    .select("project_id");

  if (error) throw error;

  const counts: Record<string, number> = {};
  for (const { project_id } of data ?? []) {
    if (project_id == null) continue;
    counts[project_id] = (counts[project_id] ?? 0) + 1;
  }
  return counts;
}

/**
 * Un proyecto por id, o `null` si no existe o es de otro usuario (RLS).
 * Un id que ni siquiera es UUID se descarta antes de consultar.
 */
export async function getProjectById(
  supabase: Client,
  id: string,
): Promise<Project | null> {
  if (!UUID_RE.test(id)) return null;

  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  return (data as Project | null) ?? null;
}

/** Puntos de referencia de un proyecto, ordenados por código. */
export async function getReferencePoints(
  supabase: Client,
  projectId: string,
): Promise<ReferencePoint[]> {
  const { data, error } = await supabase
    .from("reference_points")
    .select("*")
    .eq("project_id", projectId)
    .order("code", { ascending: true });

  if (error) throw error;
  return (data ?? []) as ReferencePoint[];
}

/** Procesos poligonales de un proyecto, del más reciente al más antiguo. */
export async function getPolygonalProcesses(
  supabase: Client,
  projectId: string,
): Promise<PolygonalProcess[]> {
  const { data, error } = await supabase
    .from("polygonal_processes")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as PolygonalProcess[];
}

/** Un proceso poligonal por id, o `null` si no existe o es de otro usuario. */
export async function getPolygonalProcess(
  supabase: Client,
  id: string,
): Promise<PolygonalProcess | null> {
  if (!UUID_RE.test(id)) return null;

  const { data, error } = await supabase
    .from("polygonal_processes")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  return (data as PolygonalProcess | null) ?? null;
}

/** Estaciones de un proceso poligonal, ordenadas por station_order. */
export async function getPolygonalStations(
  supabase: Client,
  processId: string,
): Promise<PolygonalStation[]> {
  const { data, error } = await supabase
    .from("polygonal_stations")
    .select("*")
    .eq("process_id", processId)
    .order("station_order", { ascending: true });

  if (error) throw error;
  return (data ?? []) as PolygonalStation[];
}

/** Procesos de nivelación de un proyecto, del más reciente al más antiguo. */
export async function getLevelingProcesses(
  supabase: Client,
  projectId: string,
): Promise<LevelingProcess[]> {
  const { data, error } = await supabase
    .from("leveling_processes")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as LevelingProcess[];
}

/** Un proceso de nivelación por id, o `null` si no existe o es de otro usuario. */
export async function getLevelingProcess(
  supabase: Client,
  id: string,
): Promise<LevelingProcess | null> {
  if (!UUID_RE.test(id)) return null;

  const { data, error } = await supabase
    .from("leveling_processes")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  return (data as LevelingProcess | null) ?? null;
}

/** Lecturas de un proceso de nivelación, ordenadas por recorrido y orden. */
export async function getLevelingReadings(
  supabase: Client,
  processId: string,
): Promise<LevelingReading[]> {
  const { data, error } = await supabase
    .from("leveling_readings")
    .select("*")
    .eq("process_id", processId)
    .order("run_type", { ascending: true })
    .order("reading_order", { ascending: true });

  if (error) throw error;
  return (data ?? []) as LevelingReading[];
}

/** Lugares de un proyecto, del más antiguo al más reciente. */
export async function getSites(
  supabase: Client,
  projectId: string,
): Promise<Site[]> {
  if (!UUID_RE.test(projectId)) return [];
  const { data, error } = await supabase
    .from("sites")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Site[];
}

/** Un lugar por id, o null si no existe o es de otro usuario (RLS). */
export async function getSite(
  supabase: Client,
  siteId: string,
): Promise<Site | null> {
  if (!UUID_RE.test(siteId)) return null;
  const { data, error } = await supabase
    .from("sites")
    .select("*")
    .eq("id", siteId)
    .maybeSingle();
  if (error) throw error;
  return (data ?? null) as Site | null;
}

/** Catálogo de puntos de un lugar, por código. */
export async function getSitePoints(
  supabase: Client,
  siteId: string,
): Promise<SettlementPoint[]> {
  if (!UUID_RE.test(siteId)) return [];
  const { data, error } = await supabase
    .from("settlement_points")
    .select("*")
    .eq("site_id", siteId)
    .order("code", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

/**
 * Visitas de un lugar, en orden cronológico.
 *
 * Se ordena por `date` y no por `visit_number`: el número es una etiqueta del
 * usuario y el motor de cálculo trabaja en orden de fecha.
 */
export async function getVisits(
  supabase: Client,
  siteId: string,
): Promise<SettlementVisit[]> {
  if (!UUID_RE.test(siteId)) return [];
  const { data, error } = await supabase
    .from("settlement_visits")
    .select("*")
    .eq("site_id", siteId)
    .order("date", { ascending: true });
  if (error) throw error;
  return (data ?? []) as SettlementVisit[];
}

/** Una visita con sus lecturas, o null si no existe o es ajena. */
export async function getVisit(
  supabase: Client,
  visitId: string,
): Promise<{ visit: SettlementVisit; readings: SettlementReading[] } | null> {
  if (!UUID_RE.test(visitId)) return null;
  const { data: visit, error } = await supabase
    .from("settlement_visits")
    .select("*")
    .eq("id", visitId)
    .maybeSingle();
  if (error) throw error;
  if (!visit) return null;

  const { data: readings, error: readingsError } = await supabase
    .from("settlement_readings")
    .select("*")
    .eq("visit_id", visitId);
  if (readingsError) throw readingsError;

  return {
    visit: visit as SettlementVisit,
    readings: (readings ?? []) as SettlementReading[],
  };
}

/**
 * Todas las lecturas de un lugar, agrupadas por visita — la serie temporal que
 * alimenta la gráfica, los diferenciales y las tendencias.
 *
 * Una sola consulta con join en vez de una por visita: un lugar con 12 visitas
 * haría 12 viajes a la base al pintar el panel.
 */
export async function getSettlementReadingsBySite(
  supabase: Client,
  siteId: string,
): Promise<Record<string, SettlementReading[]>> {
  if (!UUID_RE.test(siteId)) return {};
  const { data, error } = await supabase
    .from("settlement_readings")
    .select("*, settlement_visits!inner(site_id)")
    .eq("settlement_visits.site_id", siteId);
  if (error) throw error;

  const grouped: Record<string, SettlementReading[]> = {};
  for (const row of data ?? []) {
    const reading = row as unknown as SettlementReading;
    (grouped[reading.visit_id] ??= []).push(reading);
  }
  return grouped;
}

/**
 * Conteo de visitas y peor nivel de alerta de cada lugar de un proyecto que
 * tiene al menos una visita, indexado por `site_id`.
 *
 * Dos consultas fijas en lugar de tres por lugar: con N lugares en el hub,
 * resolverlo lugar a lugar serían 3N viajes a la base (`getSitePoints` +
 * `getVisits` + `getSettlementReadingsBySite`, uno de cada por lugar). Es la
 * misma razón por la que `getProcessCountsByProject` agrupa en vez de contar
 * por tarjeta.
 *
 * El peor nivel de alerta NO se recalcula con `computeHistory`: se reduce
 * directamente `settlement_readings.alert_status`, que ya quedó persistido
 * por el servidor al guardar cada visita (`saveVisitAction`, autoritativo).
 * Evita traer también los puntos del catálogo, que el cálculo completo sí
 * necesitaría.
 *
 * OJO al consumir el resultado: un lugar sin ninguna visita simplemente NO
 * aparece como clave de este `Record` — no hay fila en `settlement_visits`
 * de la que partir. El llamador debe tratar toda clave ausente como
 * `{ visitCount: 0, worstAlert: "normal" }`, y ese `"normal"` significa
 * «nada que reportar todavía», no «verificado y sano»: un lugar recién
 * creado y uno con diez visitas en verde no se distinguen aquí a propósito;
 * quien necesite esa distinción debe mirar `visitCount`.
 */
export async function getSiteSummariesByProject(
  supabase: Client,
  projectId: string,
): Promise<Record<string, { visitCount: number; worstAlert: AlertLevel }>> {
  if (!UUID_RE.test(projectId)) return {};

  const summaries: Record<string, { visitCount: number; worstAlert: AlertLevel }> =
    {};

  const { data: visits, error: visitsError } = await supabase
    .from("settlement_visits")
    .select("site_id, sites!inner(project_id)")
    .eq("sites.project_id", projectId);
  if (visitsError) throw visitsError;

  for (const row of visits ?? []) {
    const siteId = (row as unknown as { site_id: string }).site_id;
    const entry = (summaries[siteId] ??= { visitCount: 0, worstAlert: "normal" });
    entry.visitCount += 1;
  }

  const { data: readings, error: readingsError } = await supabase
    .from("settlement_readings")
    .select("alert_status, settlement_visits!inner(site_id, sites!inner(project_id))")
    .eq("settlement_visits.sites.project_id", projectId);
  if (readingsError) throw readingsError;

  for (const row of readings ?? []) {
    const r = row as unknown as {
      alert_status: string;
      settlement_visits: { site_id: string };
    };
    const siteId = r.settlement_visits.site_id;
    // La entrada ya existe si el lugar tiene visitas (siempre el caso: una
    // lectura no puede existir sin la visita que la contiene), pero se crea
    // por si acaso para no asumir el orden de llegada de las filas.
    const entry = (summaries[siteId] ??= { visitCount: 0, worstAlert: "normal" });
    entry.worstAlert = worst(entry.worstAlert, r.alert_status as AlertLevel);
  }

  return summaries;
}
