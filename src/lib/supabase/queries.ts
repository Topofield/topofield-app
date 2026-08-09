// Capa de lectura de Fase 2. Funciones async que reciben el cliente Supabase
// server (lo crea la página, una vez por request) y devuelven datos tipados.
// No mutan: las mutaciones viven en los Server Actions junto a cada ruta.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { Project, ProjectStatus, ReferencePoint } from "@/types/project";
import type { PolygonalProcess, PolygonalStation } from "@/types/polygonal";

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
      .select("id", { count: "exact", head: true })
      .eq("status", "calculated"),
    supabase
      .from("polygonal_processes")
      .select("id", { count: "exact", head: true })
      .eq("status", "calculated")
      .eq("meets_tolerance", false),
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
