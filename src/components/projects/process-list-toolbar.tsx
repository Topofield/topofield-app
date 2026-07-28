"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button, Input, Select } from "@/components/design-system";
import { cn } from "@/lib/utils/cn";
import {
  DEFAULT_FILTERS,
  type ProcessFilters,
  type StatusCounts,
  type StatusFilter,
} from "@/lib/process-list";
import { POLYGONAL_TYPE_LABELS, POLYGONAL_TYPES } from "@/types/polygonal";

const CHIPS: { value: StatusFilter; label: string }[] = [
  { value: "todos", label: "Todos" },
  { value: "borradores", label: "Borradores" },
  { value: "calculados", label: "Calculados" },
  { value: "cerrados", label: "Cerrados" },
  { value: "rechazados", label: "Rechazados" },
];

const TIPO_OPTIONS = [
  { value: "todos", label: "Todos los tipos" },
  ...POLYGONAL_TYPES.map((t) => ({ value: t, label: POLYGONAL_TYPE_LABELS[t] })),
];

/** Clave de persistencia, por proyecto: cada uno recuerda su propio filtro. */
function storageKey(projectId: string): string {
  return `topofield:procesos:${projectId}`;
}

/** Los parámetros de la URL que gobiernan el listado. */
function toQuery(filters: ProcessFilters): string {
  const params = new URLSearchParams();
  params.set("tab", "processes");
  if (filters.q !== "") params.set("q", filters.q);
  if (filters.estado !== "todos") params.set("estado", filters.estado);
  if (filters.tipo !== "todos") params.set("tipo", filters.tipo);
  if (filters.orden !== "actividad") params.set("orden", filters.orden);
  if (filters.dir !== "desc") params.set("dir", filters.dir);
  return params.toString();
}

export function ProcessListToolbar({
  projectId,
  filters,
  counts,
}: {
  projectId: string;
  filters: ProcessFilters;
  counts: StatusCounts;
}) {
  const router = useRouter();

  // Persistencia: guarda el filtro aplicado para la próxima visita.
  useEffect(() => {
    try {
      window.localStorage.setItem(storageKey(projectId), toQuery(filters));
    } catch {
      // localStorage puede no estar disponible (modo privado); no es crítico.
    }
  }, [projectId, filters]);

  function navegar(cambios: Partial<ProcessFilters>) {
    const query = toQuery({ ...filters, ...cambios });
    router.push(`/projects/${projectId}?${query}`);
  }

  const hayFiltro =
    filters.q !== "" ||
    filters.estado !== "todos" ||
    filters.tipo !== "todos";

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <Input
          type="search"
          defaultValue={filters.q}
          placeholder="Buscar proceso…"
          aria-label="Buscar proceso por nombre"
          className="w-full sm:max-w-xs"
          onChange={(e) => navegar({ q: e.target.value })}
        />
        <Select
          options={TIPO_OPTIONS}
          value={filters.tipo}
          aria-label="Filtrar por tipo de poligonal"
          className="w-auto"
          onChange={(e) =>
            navegar({ tipo: e.target.value as ProcessFilters["tipo"] })
          }
        />
        {hayFiltro && (
          <Button
            size="sm"
            variant="ghost"
            type="button"
            onClick={() => navegar(DEFAULT_FILTERS)}
          >
            Limpiar filtros
          </Button>
        )}
      </div>

      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filtrar por estado">
        {CHIPS.map((chip) => {
          const activo = chip.value === filters.estado;
          return (
            <button
              key={chip.value}
              type="button"
              aria-pressed={activo}
              onClick={() => navegar({ estado: chip.value })}
              className={cn(
                "rounded-full border px-3 py-1 text-sm transition-colors",
                activo
                  ? "border-primary-500 bg-primary-500 text-white"
                  : "border-neutral-200 bg-white text-neutral-500 hover:text-neutral-800",
              )}
            >
              {chip.label}{" "}
              <span className="tabular-nums">({counts[chip.value]})</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
