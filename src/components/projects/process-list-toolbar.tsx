"use client";

import { useEffect, useState } from "react";
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
  // El buscador es no controlado (defaultValue) para que teclear rápido nunca
  // se vea sobrescrito por el valor de filters.q, que llega con el retraso de
  // la navegación. Cuando filters.q vuelve a "" (p. ej. tras "Limpiar
  // filtros") cambiamos la key para forzar un remonte con el campo vacío.
  // Ajuste de estado durante el render (patrón documentado de React para
  // derivar estado de props sin pasar por un efecto y sus renders en cascada).
  const [resetKey, setResetKey] = useState(0);
  const [prevQ, setPrevQ] = useState(filters.q);
  if (filters.q === "" && prevQ !== "") {
    setPrevQ(filters.q);
    setResetKey((k) => k + 1);
  } else if (filters.q !== prevQ) {
    setPrevQ(filters.q);
  }

  // Restauración: si la URL no trae filtros, recupera el último usado.
  // La URL manda siempre — un enlace compartido debe mostrar lo que envió su
  // autor, no los filtros de quien lo abre.
  //
  // IMPORTANTE: este efecto debe quedar declarado ANTES que el de
  // persistencia. React los ejecuta en orden de declaración, y en un montaje
  // con filtros por defecto el de persistencia elimina la clave (ver abajo):
  // si corriera primero, borraría el filtro guardado antes de que este
  // pudiera leerlo. No reordenar.
  useEffect(() => {
    const url = new URL(window.location.href);
    const traeFiltros = ["q", "estado", "tipo", "orden", "dir"].some((k) =>
      url.searchParams.has(k),
    );
    if (traeFiltros) return;

    try {
      const guardado = window.localStorage.getItem(storageKey(projectId));
      if (guardado && guardado !== "tab=processes") {
        router.replace(`/projects/${projectId}?${guardado}`);
      }
    } catch {
      // localStorage no disponible; se usa el filtro por defecto.
    }
    // Solo al montar: restaurar en cada cambio provocaría un bucle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persistencia: guarda el filtro aplicado para la próxima visita.
  //
  // Con los filtros por defecto no se guarda "tab=processes" sino que se
  // elimina la clave, para que «Limpiar filtros» signifique «olvida mi
  // filtro» y no «recuerda que no filtré».
  //
  // Va declarado DESPUÉS del efecto de restauración: ver la nota de arriba.
  useEffect(() => {
    const query = toQuery(filters);
    try {
      if (query === "tab=processes") {
        window.localStorage.removeItem(storageKey(projectId));
      } else {
        window.localStorage.setItem(storageKey(projectId), query);
      }
    } catch {
      // localStorage puede no estar disponible (modo privado); no es crítico.
    }
  }, [projectId, filters]);

  function navegar(cambios: Partial<ProcessFilters>, modo: "push" | "replace" = "push") {
    const query = toQuery({ ...filters, ...cambios });
    const url = `/projects/${projectId}?${query}`;
    if (modo === "replace") {
      router.replace(url);
    } else {
      router.push(url);
    }
  }

  const hayFiltro =
    filters.q !== "" ||
    filters.estado !== "todos" ||
    filters.tipo !== "todos";

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <Input
          key={resetKey}
          type="search"
          defaultValue={filters.q}
          placeholder="Buscar proceso…"
          aria-label="Buscar proceso por nombre"
          className="w-full sm:max-w-xs"
          onChange={(e) => navegar({ q: e.target.value }, "replace")}
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
              aria-current={activo ? "true" : undefined}
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
