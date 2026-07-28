// Filtrado y ordenamiento del listado de procesos de un proyecto.
// Función pura: sin React, sin Supabase. Se ejecuta en el servidor al renderizar
// y es testeable de forma aislada.

import type { PolygonalProcess, PolygonalType } from "@/types/polygonal";

export type StatusFilter =
  | "todos"
  | "borradores"
  | "calculados"
  | "cerrados"
  | "rechazados";

export type SortKey = "actividad" | "nombre" | "precision";
export type SortDir = "asc" | "desc";

export interface ProcessFilters {
  q: string;
  estado: StatusFilter;
  tipo: PolygonalType | "todos";
  orden: SortKey;
  dir: SortDir;
}

export interface StatusCounts {
  todos: number;
  borradores: number;
  calculados: number;
  cerrados: number;
  rechazados: number;
}

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

/** ¿El proceso pertenece al grupo de estado indicado? */
function matchesStatus(process: PolygonalProcess, estado: StatusFilter): boolean {
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
  }
}

/** Aplica búsqueda, filtros y orden. Devuelve un arreglo nuevo. */
export function filterProcesses(
  processes: PolygonalProcess[],
  filters: ProcessFilters,
): PolygonalProcess[] {
  const term = normalize(filters.q);

  const filtered = processes.filter((p) => {
    if (term !== "" && !normalize(p.name).includes(term)) return false;
    if (!matchesStatus(p, filters.estado)) return false;
    if (filters.tipo !== "todos" && p.type !== filters.tipo) return false;
    return true;
  });

  const factor = filters.dir === "asc" ? 1 : -1;

  return filtered.sort((a, b) => {
    switch (filters.orden) {
      case "nombre":
        return a.name.localeCompare(b.name, "es-CO") * factor;
      case "precision":
        return (
          (parsePrecision(a.relative_precision) -
            parsePrecision(b.relative_precision)) *
          factor
        );
      case "actividad":
        return (
          (new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime()) *
          factor
        );
    }
  });
}

/** Cuántos procesos hay en cada grupo de estado, para los chips de filtro. */
export function countByStatus(processes: PolygonalProcess[]): StatusCounts {
  return {
    todos: processes.length,
    borradores: processes.filter((p) => matchesStatus(p, "borradores")).length,
    calculados: processes.filter((p) => matchesStatus(p, "calculados")).length,
    cerrados: processes.filter((p) => matchesStatus(p, "cerrados")).length,
    rechazados: processes.filter((p) => matchesStatus(p, "rechazados")).length,
  };
}
