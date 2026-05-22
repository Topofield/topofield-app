// Capa de lectura de Fase 2. Funciones async que reciben el cliente Supabase
// server (lo crea la página, una vez por request) y devuelven datos tipados.
// No mutan: las mutaciones viven en los Server Actions junto a cada ruta.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { Project, ProjectStatus, ReferencePoint } from "@/types/project";

type Client = SupabaseClient<Database>;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface DashboardKpis {
  activeProjects: number;
  pendingClosures: number;
  activeAlerts: number;
}

/**
 * KPIs del dashboard. "Proyectos activos" se calcula real; "procesos pendientes"
 * y "alertas activas" devuelven 0 porque sus tablas llegan en Fases 3-6 — el 0
 * se encapsula aquí para que en esas fases solo cambie esta función.
 */
export async function getDashboardKpis(
  supabase: Client,
): Promise<DashboardKpis> {
  const { count } = await supabase
    .from("projects")
    .select("id", { count: "exact", head: true })
    .eq("status", "active");

  return {
    activeProjects: count ?? 0,
    pendingClosures: 0,
    activeAlerts: 0,
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
