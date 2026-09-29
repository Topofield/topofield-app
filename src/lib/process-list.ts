// Filtrado y ordenamiento del listado de procesos de un proyecto.
// Función pura: sin React, sin Supabase. Se ejecuta en el servidor al renderizar
// y es testeable de forma aislada.
//
// Desde la Fase 22 sirve a los tres módulos del hub: poligonales, nivelaciones
// y lugares de asentamientos. Cada uno pasa su propia métrica de «resultado»
// para ordenar; los estados de un lugar son «activo» y «cerrado».

export type StatusFilter =
  | "todos"
  | "borradores"
  | "calculados"
  | "cerrados"
  | "rechazados"
  | "activos";

/** Lo que el filtro necesita de un proceso o de un lugar. */
export interface Filterable {
  id: string;
  name: string;
  status: string;
  type: string;
  updated_at: string;
}

export type SortKey = "actividad" | "nombre" | "precision";
export type SortDir = "asc" | "desc";

export interface ProcessFilters {
  q: string;
  estado: StatusFilter;
  /** Un tipo del módulo (`closed`, `link`, `edificio`…) o «todos». */
  tipo: string;
  orden: SortKey;
  dir: SortDir;
}

export type StatusCounts = Record<StatusFilter, number>;

/** Filtro por defecto: todo visible, lo más reciente primero. */
export const DEFAULT_FILTERS: ProcessFilters = {
  q: "",
  estado: "todos",
  tipo: "todos",
  orden: "actividad",
  dir: "desc",
};

/** Normaliza para comparar: sin mayúsculas, sin acentos, sin espacios extremos. */
function normalize(text: string): string {
  return text
    .trim()
    .toLocaleLowerCase("es-CO")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

/**
 * Extrae el valor numérico de una precisión formateada (`"1:5000"`, `"1:∞"`).
 *
 * `relative_precision` se persiste como texto ya formateado, así que ordenar
 * por esa columna de forma lexicográfica pondría `1:46` después de `1:1001`.
 * Los procesos sin precisión devuelven -Infinity para quedar al final.
 */
export function parsePrecision(value: string | null): number {
  if (!value) return Number.NEGATIVE_INFINITY;
  if (value.includes("∞")) return Number.POSITIVE_INFINITY;
  const digits = value.replace(/^1:/, "").replace(/\./g, "");
  const parsed = Number(digits);
  return Number.isFinite(parsed) ? parsed : Number.NEGATIVE_INFINITY;
}

/** ¿El proceso (o el lugar) pertenece al grupo de estado indicado? */
function matchesStatus(process: Filterable, estado: StatusFilter): boolean {
  switch (estado) {
    case "todos":
      return true;
    case "borradores":
      return process.status === "draft" || process.status === "in_progress";
    case "calculados":
      return process.status === "calculated";
    case "cerrados":
      return process.status === "closed";
    case "rechazados":
      return process.status === "rejected";
    case "activos":
      return process.status === "active";
  }
}

/** Métrica por omisión para ordenar por resultado: la precisión relativa. */
function precisionOf(item: Filterable): number {
  const value = (item as { relative_precision?: string | null }).relative_precision;
  return parsePrecision(value ?? null);
}

/**
 * Aplica búsqueda, filtros y orden. Devuelve un arreglo nuevo. `metric` da el
 * valor por el que ordena la columna de resultado (mayor es mejor); por
 * omisión, la precisión relativa de una poligonal.
 */
export function filterProcesses<T extends Filterable>(
  processes: T[],
  filters: ProcessFilters,
  metric: (item: T) => number = precisionOf,
): T[] {
  const term = normalize(filters.q);

  const filtered = processes.filter((p) => {
    if (term !== "" && !normalize(p.name).includes(term)) return false;
    if (!matchesStatus(p, filters.estado)) return false;
    if (filters.tipo !== "todos" && p.type !== filters.tipo) return false;
    return true;
  });

  const factor = filters.dir === "asc" ? 1 : -1;

  /** Comparación por signo: a diferencia de la resta, no produce NaN con infinitos empatados. */
  function compareValues(a: number | string, b: number | string): number {
    return a < b ? -1 : a > b ? 1 : 0;
  }

  return filtered.sort((a, b) => {
    let cmp: number;
    switch (filters.orden) {
      case "nombre":
        cmp = a.name.localeCompare(b.name, "es-CO") * factor;
        break;
      case "precision":
        cmp = compareValues(metric(a), metric(b)) * factor;
        break;
      case "actividad":
        cmp =
          compareValues(
            new Date(a.updated_at).getTime(),
            new Date(b.updated_at).getTime(),
          ) * factor;
        break;
    }
    // Desempate estable: si el criterio principal iguala, ordenar por id
    // da un resultado determinista sin depender de la estabilidad del motor.
    return cmp !== 0 ? cmp : compareValues(a.id, b.id);
  });
}

/** Cuántos procesos hay en cada grupo de estado, para los chips de filtro. */
export function countByStatus(processes: Filterable[]): StatusCounts {
  const count = (estado: StatusFilter) =>
    processes.filter((p) => matchesStatus(p, estado)).length;
  return {
    todos: processes.length,
    borradores: count("borradores"),
    calculados: count("calculados"),
    cerrados: count("cerrados"),
    rechazados: count("rechazados"),
    activos: count("activos"),
  };
}
