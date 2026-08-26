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
import type { EligibleCandidate } from "@/lib/reports/eligibility";
import type { Report } from "@/types/report";

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
 *
 * Los KPI cuentan los tres módulos desde la Fase 5. Antes solo miraban
 * `polygonal_processes`, de modo que un proyecto de nivelación o de
 * asentamientos aparecía vacío en el dashboard.
 *
 * En asentamientos no hay «proceso calculado» ni «tolerancia» tal como los
 * entienden poligonal y nivelación: lo transversal es el LUGAR, no la visita
 * (una visita es solo una medición puntual de ese trabajo en curso). Por eso
 * ambas ramas del KPI de asentamientos —`settlementCalculated` y su aporte a
 * `outOfTolerance`— cuentan LUGARES, nunca visitas ni lecturas: un lugar con
 * diez visitas calculadas es un trabajo, no diez, igual que un proceso de
 * poligonal o nivelación fuera de tolerancia suma 1 sin importar cuántas
 * estaciones o lecturas lo hicieron fallar. Es la misma unidad que usa
 * `getProcessCountsByProject` («un lugar = un proceso»), así que el KPI y el
 * conteo por proyecto quedan coherentes entre sí.
 *
 * `settlementCalculated` cuenta lugares DISTINTOS con al menos una visita en
 * estado `calculated`; un lugar cuyas visitas están todas en `draft` o
 * `closed` no suma (igual que `polygonalCalculated`/`levelingCalculated`
 * tampoco cuentan procesos en otro estado). PostgREST no ofrece
 * `count(distinct ...)`:
 * se trae el `site_id` de cada visita calculada con `head: false` (no puede
 * ser un conteo de cabecera si necesitamos las filas) y se cuentan los
 * lugares únicos en memoria con un `Set`, igual que hace la rama de
 * `outOfTolerance` de abajo y que `getSiteSummariesByProject`. El volumen es
 * acotado por el número de visitas calculadas del usuario, no por el total de
 * la tabla.
 */
export async function getDashboardKpis(
  supabase: Client,
): Promise<DashboardKpis> {
  const [
    { count: activeProjectsCount },
    { count: polygonalCalculated },
    { count: polygonalOutOfTolerance },
    { count: levelingCalculated },
    { count: levelingOutOfTolerance },
    { data: calculatedVisits, error: calculatedVisitsError },
    { data: alarmingReadings, error: alarmingError },
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
    supabase
      .from("leveling_processes")
      .select("id, projects!inner(status)", { count: "exact", head: true })
      .eq("status", "calculated")
      .eq("projects.status", "active"),
    supabase
      .from("leveling_processes")
      .select("id, projects!inner(status)", { count: "exact", head: true })
      .eq("status", "calculated")
      .eq("meets_tolerance", false)
      .eq("projects.status", "active"),
    // No es `head: true`: hace falta la fila con el `site_id` de cada visita
    // calculada, para reducirla a lugares únicos abajo (ver JSDoc).
    supabase
      .from("settlement_visits")
      .select("site_id, sites!inner(project_id, projects!inner(status))")
      .eq("status", "calculated")
      .eq("sites.projects.status", "active"),
    // «Fuera de tolerancia» no aplica a una visita: lo equivalente es que
    // algún lugar tenga al menos un punto en alerta o alarma (ver JSDoc). Se
    // trae el `site_id` de cada lectura afectada (no `head: true`, hace falta
    // la fila) y se reduce a lugares únicos abajo.
    supabase
      .from("settlement_readings")
      .select(
        "settlement_visits!inner(site_id, sites!inner(projects!inner(status)))",
      )
      .in("alert_status", ["alert", "alarm"])
      .eq("settlement_visits.sites.projects.status", "active"),
  ]);
  if (calculatedVisitsError) throw calculatedVisitsError;
  if (alarmingError) throw alarmingError;

  const settlementCalculatedSites = new Set<string>();
  for (const row of calculatedVisits ?? []) {
    const siteId = (row as unknown as { site_id: string }).site_id;
    settlementCalculatedSites.add(siteId);
  }

  const alarmingSites = new Set<string>();
  for (const row of alarmingReadings ?? []) {
    const siteId = (
      row as unknown as { settlement_visits: { site_id: string } }
    ).settlement_visits.site_id;
    alarmingSites.add(siteId);
  }

  return {
    activeProjects: activeProjectsCount ?? 0,
    calculatedProcesses:
      (polygonalCalculated ?? 0) +
      (levelingCalculated ?? 0) +
      settlementCalculatedSites.size,
    outOfTolerance:
      (polygonalOutOfTolerance ?? 0) +
      (levelingOutOfTolerance ?? 0) +
      alarmingSites.size,
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
 * Tres consultas en paralelo en lugar de una por proyecto: con N proyectos en
 * pantalla, contar por separado sería N+1 viajes a la base. RLS ya limita las
 * filas a las del usuario, así que no hace falta filtrar por `user_id` aquí.
 *
 * Cuenta los tres módulos desde la Fase 5: poligonales, nivelaciones y
 * lugares de control de asentamientos. Un lugar cuenta como uno, no una vez
 * por visita: lo que el usuario reconoce como «un trabajo» es el monitoreo
 * del lugar completo, no cada visita individual.
 *
 * Un proyecto sin procesos no aparece en el resultado; quien consulte debe
 * tratar la ausencia como 0.
 */
export async function getProcessCountsByProject(
  supabase: Client,
): Promise<Record<string, number>> {
  const [polygonal, leveling, sites] = await Promise.all([
    supabase.from("polygonal_processes").select("project_id"),
    supabase.from("leveling_processes").select("project_id"),
    supabase.from("sites").select("project_id"),
  ]);

  for (const { error } of [polygonal, leveling, sites]) {
    if (error) throw error;
  }

  const counts: Record<string, number> = {};
  for (const rows of [polygonal.data, leveling.data, sites.data]) {
    for (const { project_id } of rows ?? []) {
      if (project_id == null) continue;
      counts[project_id] = (counts[project_id] ?? 0) + 1;
    }
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
 *
 * LIMITACIÓN CONOCIDA — puede discrepar con el panel de detalle del lugar:
 * `worstAlert` sale del `alert_status` que el servidor escribió al guardar
 * cada visita (`saveVisitAction`), calculado con los umbrales del lugar
 * VIGENTES EN ESE MOMENTO. El panel de detalle (`settlement/[siteId]/page.tsx`)
 * en cambio recalcula con `computeHistory` y los umbrales ACTUALES del lugar.
 * `saveSiteAction` no reescribe las lecturas existentes al editar umbrales, así
 * que si alguien corrige los umbrales de un lugar que ya tiene visitas
 * guardadas, esta función y el panel pueden mostrar semáforos distintos para
 * el mismo lugar hasta que esas visitas se vuelvan a guardar.
 *
 * El valor autoritativo es el RECALCULADO, no el persistido: los umbrales son
 * un criterio de interpretación del proyecto, no un dato de campo, y al
 * corregirlos el semáforo debería reinterpretarse entero. Aun así, aquí se
 * lee a propósito el `alert_status` ya guardado en vez de recalcular por
 * lugar: recalcular reintroduciría el N+1 (3 consultas por lugar) que esta
 * función existe para evitar. El arreglo de fondo, pendiente, es que
 * `saveSiteAction` reescriba el `alert_status` de las visitas ABIERTAS al
 * cambiar los umbrales — las CERRADAS deben conservar el criterio con el que
 * se cerraron, por trazabilidad. Ver deuda técnica de la Fase 5.
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

// --- Informes (§ 4.7) --------------------------------------------------------

/**
 * Los trabajos **cerrados** de un proyecto, en el formato que consume el
 * selector de informes.
 *
 * Trae los tres tipos con el mismo `select` mínimo para poder ordenarlos y
 * mostrarlos juntos. El filtro por estado se aplica aquí (`eq("status",
 * "closed")`) además de en `isEligible`: la consulta evita traer filas que se
 * van a descartar, y la función pura sigue siendo la que decide la regla —y la
 * que tiene los tests.
 */
export async function getClosedWorkForReports(
  supabase: Client,
  projectId: string,
): Promise<EligibleCandidate[]> {
  if (!UUID_RE.test(projectId)) return [];

  const [polygonals, levelings, sites] = await Promise.all([
    supabase
      .from("polygonal_processes")
      .select("id, name, status, closed_at")
      .eq("project_id", projectId)
      .eq("status", "closed")
      .order("closed_at", { ascending: true }),
    supabase
      .from("leveling_processes")
      .select("id, name, status, closed_at")
      .eq("project_id", projectId)
      .eq("status", "closed")
      .order("closed_at", { ascending: true }),
    supabase
      .from("sites")
      .select("id, name, status, closed_at")
      .eq("project_id", projectId)
      .eq("status", "closed")
      .order("closed_at", { ascending: true }),
  ]);

  if (polygonals.error) throw polygonals.error;
  if (levelings.error) throw levelings.error;
  if (sites.error) throw sites.error;

  return [
    ...(polygonals.data ?? []).map((r) => ({
      kind: "polygonal" as const,
      id: r.id,
      name: r.name,
      status: r.status,
    })),
    ...(levelings.data ?? []).map((r) => ({
      kind: "leveling" as const,
      id: r.id,
      name: r.name,
      status: r.status,
    })),
    ...(sites.data ?? []).map((r) => ({
      kind: "site" as const,
      id: r.id,
      name: r.name,
      status: r.status,
    })),
  ];
}

/** Informes de un proyecto, del más reciente al más antiguo. */
export async function getReports(
  supabase: Client,
  projectId: string,
): Promise<Report[]> {
  if (!UUID_RE.test(projectId)) return [];
  const { data, error } = await supabase
    .from("reports")
    .select("*")
    .eq("project_id", projectId)
    .order("generated_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as Report[];
}

/** Un informe por id. */
export async function getReport(
  supabase: Client,
  reportId: string,
): Promise<Report | null> {
  if (!UUID_RE.test(reportId)) return null;
  const { data, error } = await supabase
    .from("reports")
    .select("*")
    .eq("id", reportId)
    .maybeSingle();
  if (error) throw error;
  return (data as unknown as Report | null) ?? null;
}
