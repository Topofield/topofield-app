"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, Input, Select } from "@/components/design-system";
import { cn } from "@/lib/utils/cn";
import {
  DEFAULT_FILTERS,
  type ProcessFilters,
  type StatusCounts,
  type StatusFilter,
} from "@/lib/process-list";
const CHIP_LABELS: Record<StatusFilter, string> = {
  todos: "Todos",
  borradores: "Borradores",
  calculados: "Calculados",
};

/**
 * Clave de persistencia, por proyecto y módulo: cada lista recuerda su propio
 * filtro (Fase 22: antes solo había la de poligonales).
 */
function storageKey(projectId: string, modulo: string): string {
  return `topofield:procesos:${projectId}:${modulo}`;
}

/**
 * Los parámetros de la URL que gobiernan el listado. Lleva siempre el módulo:
 * sin él, un filtro de nivelaciones volvía a la lista de poligonales.
 */
function toQuery(modulo: string, filters: ProcessFilters): string {
  const params = new URLSearchParams();
  params.set("tab", "processes");
  params.set("modulo", modulo);
  if (filters.q !== "") params.set("q", filters.q);
  if (filters.estado !== "todos") params.set("estado", filters.estado);
  if (filters.tipo !== "todos") params.set("tipo", filters.tipo);
  if (filters.orden !== "actividad") params.set("orden", filters.orden);
  if (filters.dir !== "desc") params.set("dir", filters.dir);
  return params.toString();
}

/** Destino de un chip de estado, conservando el resto de filtros. */
function chipHref(
  projectId: string,
  modulo: string,
  filters: ProcessFilters,
  estado: StatusFilter,
): string {
  return `/projects/${projectId}?${toQuery(modulo, { ...filters, estado })}`;
}

/**
 * Búsqueda, tipo y estado del listado del hub (Fase 22: los tres módulos).
 * Cada módulo pasa sus chips de estado y sus tipos; sin tipos, no hay
 * selector.
 */
export function ProcessListToolbar({
  projectId,
  modulo,
  filters,
  counts,
  chips,
  typeOptions,
  typeLabel,
}: {
  projectId: string;
  modulo: string;
  filters: ProcessFilters;
  counts: StatusCounts;
  chips: StatusFilter[];
  typeOptions: { value: string; label: string }[] | null;
  /** Nombre accesible del selector de tipo. */
  typeLabel?: string;
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
      const guardado = window.localStorage.getItem(storageKey(projectId, modulo));
      if (guardado && guardado !== toQuery(modulo, DEFAULT_FILTERS)) {
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
    const query = toQuery(modulo, filters);
    try {
      if (query === toQuery(modulo, DEFAULT_FILTERS)) {
        window.localStorage.removeItem(storageKey(projectId, modulo));
      } else {
        window.localStorage.setItem(storageKey(projectId, modulo), query);
      }
    } catch {
      // localStorage puede no estar disponible (modo privado); no es crítico.
    }
  }, [projectId, modulo, filters]);

  function navegar(cambios: Partial<ProcessFilters>, modo: "push" | "replace" = "push") {
    const query = toQuery(modulo, { ...filters, ...cambios });
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
        {typeOptions && (
          <Select
            options={[{ value: "todos", label: "Todos los tipos" }, ...typeOptions]}
            value={filters.tipo}
            aria-label={typeLabel ?? "Filtrar por tipo"}
            className="w-auto"
            onChange={(e) => navegar({ tipo: e.target.value })}
          />
        )}
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

      {/* Un lugar no tiene estado (Fase 37): sin chips. */}
      {chips.length > 0 && (
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filtrar por estado">
          {chips.map((value) => {
            const chip = { value, label: CHIP_LABELS[value] };
            const activo = chip.value === filters.estado;
            return (
              <Link
                key={chip.value}
                href={chipHref(projectId, modulo, filters, chip.value)}
                aria-current={activo ? "true" : undefined}
                className={cn(
                  "rounded-full border px-3 py-1 text-sm transition-colors",
                  activo
                    ? "border-mira bg-mira text-on-mira"
                    : "border-rule bg-card text-ink-2 hover:text-ink",
                )}
              >
                {chip.label}{" "}
                <span className="tabular-nums">({counts[chip.value]})</span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
