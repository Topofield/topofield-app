# Listado de procesos — Plan de implementación

> **Para trabajadores agénticos:** SUB-SKILL REQUERIDA: usar
> superpowers:subagent-driven-development (recomendado) o
> superpowers:executing-plans para implementar tarea por tarea. Los pasos usan
> sintaxis de checkbox (`- [ ]`) para seguimiento.

**Objetivo:** Sustituir las cuatro secciones fijas por estado del hub del
proyecto por un listado único con buscador, filtros y ordenamiento.

**Arquitectura:** La página sigue siendo un Server Component que carga todos los
procesos del proyecto; el filtrado y el ordenamiento ocurren en una función pura
testeable, y el estado vive en la URL. Un componente cliente aporta la barra de
control y la persistencia. La tabla densa se usa en escritorio y las tarjetas
existentes en móvil, con el mismo patrón ya validado en la tabla de estaciones.

**Stack:** Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS v4 ·
Supabase · Vitest

**Spec:** [`docs/specs/2026-07-27-listado-procesos-design.md`](../specs/2026-07-27-listado-procesos-design.md)

## Restricciones globales

- **Los procesos con status `closed` o `rejected` son INMUTABLES.** Ninguna
  acción nueva puede modificarlos o eliminarlos. Los triggers de
  `supabase/migrations/20260727180000_immutable_closed_processes.sql` lo hacen
  cumplir en la base; las Server Actions deben rechazarlo antes de intentarlo,
  para dar un mensaje claro en vez de un error de PostgreSQL.
- Cada tabla tiene Row Level Security: el usuario solo ve sus propios proyectos.
  **No añadir filtros por `user_id`** en las consultas; RLS ya lo hace.
- Los archivos de `src/lib/calculations/` y `src/lib/validators/` son funciones
  puras y no se tocan en este plan.
- Las tolerancias viven en `src/lib/calculations/tolerances.ts`, nunca
  hardcodeadas.
- Prohibido shadcn/ui o cualquier librería de componentes o de iconos. Tailwind
  v4 puro + el design system propio de `src/components/design-system/`. Los SVG
  se escriben a mano, inline.
- Prohibidas las peticiones a terceros en tiempo de ejecución.
- Coordenadas a 3 decimales, cotas a 4, ángulos en DMS.
- Contraste WCAG AA: 4.5:1 en texto normal, 3:1 en componentes gráficos. El
  color por sí solo no es un canal de información suficiente.
- Toda regla CSS global va dentro de `@layer`: una regla fuera de capa gana
  sobre las utilidades de Tailwind y las anula en silencio.
- Idioma de interfaz: español (Colombia). Zona horaria `America/Bogota`.
- Cambios mínimos: no refactorizar código ajeno a la tarea.
- Commits en español con prefijo `feat:`, `fix:`, `refactor:`, `docs:` o `test:`.
- Ejecutar `npm run typecheck`, `npm run lint` y `npm run test` tras cada tarea.
  La suite tiene 76 tests antes de empezar.

---

### Tarea 1: Lógica de filtrado y ordenamiento

Función pura que decide qué procesos se muestran y en qué orden. Es el núcleo
del listado y lo único con reglas no triviales, así que va primero y con tests.

**Archivos:**
- Crear: `src/lib/process-list.ts`
- Test: `src/lib/process-list.test.ts`

**Interfaces:**
- Produce: `filterProcesses(processes, filters): PolygonalProcess[]`,
  `countByStatus(processes): StatusCounts`, `parsePrecision(value): number`,
  y los tipos `ProcessFilters`, `SortKey`, `SortDir`, `StatusFilter`,
  `StatusCounts`. Las Tareas 2, 3 y 4 los consumen.

- [ ] **Paso 1: Escribir el test que falla**

Crear `src/lib/process-list.test.ts`. `PolygonalProcess` tiene muchos campos; el
helper construye uno mínimo y cada caso altera lo que prueba.

```ts
import { describe, expect, it } from "vitest";
import {
  countByStatus,
  filterProcesses,
  parsePrecision,
  type ProcessFilters,
} from "./process-list";
import type { PolygonalProcess } from "@/types/polygonal";

function proc(over: Partial<PolygonalProcess> = {}): PolygonalProcess {
  return {
    id: "p1",
    project_id: "proj",
    name: "Poligonal",
    type: "closed",
    status: "calculated",
    relative_precision: null,
    meets_tolerance: null,
    updated_at: "2026-07-01T00:00:00Z",
    created_at: "2026-07-01T00:00:00Z",
    ...over,
  } as PolygonalProcess;
}

const SIN_FILTRO: ProcessFilters = {
  q: "",
  estado: "todos",
  tipo: "todos",
  orden: "actividad",
  dir: "desc",
};

describe("parsePrecision", () => {
  it("extrae el valor numérico de la cadena formateada", () => {
    expect(parsePrecision("1:5000")).toBe(5000);
  });

  it("ignora los separadores de miles", () => {
    expect(parsePrecision("1:17.222.920")).toBe(17222920);
  });

  it("trata 1:∞ como el valor máximo", () => {
    expect(parsePrecision("1:∞")).toBe(Number.POSITIVE_INFINITY);
  });

  it("devuelve -Infinity cuando no hay precisión, para que ordene al final", () => {
    expect(parsePrecision(null)).toBe(Number.NEGATIVE_INFINITY);
  });
});

describe("filterProcesses — búsqueda", () => {
  const lista = [proc({ id: "a", name: "Manzana 12" }), proc({ id: "b", name: "Vía terciaria" })];

  it("sin término devuelve todo", () => {
    expect(filterProcesses(lista, SIN_FILTRO)).toHaveLength(2);
  });

  it("filtra por nombre", () => {
    const r = filterProcesses(lista, { ...SIN_FILTRO, q: "manzana" });
    expect(r.map((p) => p.id)).toEqual(["a"]);
  });

  it("no distingue mayúsculas", () => {
    const r = filterProcesses(lista, { ...SIN_FILTRO, q: "MANZANA" });
    expect(r).toHaveLength(1);
  });

  it("no distingue acentos", () => {
    const r = filterProcesses(lista, { ...SIN_FILTRO, q: "via" });
    expect(r.map((p) => p.id)).toEqual(["b"]);
  });

  it("ignora espacios alrededor del término", () => {
    const r = filterProcesses(lista, { ...SIN_FILTRO, q: "  manzana  " });
    expect(r).toHaveLength(1);
  });
});

describe("filterProcesses — estado y tipo", () => {
  const lista = [
    proc({ id: "d", status: "draft" }),
    proc({ id: "p", status: "in_progress" }),
    proc({ id: "c", status: "calculated" }),
    proc({ id: "x", status: "closed" }),
    proc({ id: "r", status: "rejected" }),
  ];

  it("«borradores» agrupa draft e in_progress", () => {
    const r = filterProcesses(lista, { ...SIN_FILTRO, estado: "borradores" });
    expect(r.map((p) => p.id).sort()).toEqual(["d", "p"]);
  });

  it("«calculados» solo trae los calculados", () => {
    const r = filterProcesses(lista, { ...SIN_FILTRO, estado: "calculados" });
    expect(r.map((p) => p.id)).toEqual(["c"]);
  });

  it("«cerrados» no incluye los rechazados", () => {
    const r = filterProcesses(lista, { ...SIN_FILTRO, estado: "cerrados" });
    expect(r.map((p) => p.id)).toEqual(["x"]);
  });

  it("filtra por tipo de poligonal", () => {
    const porTipo = [
      proc({ id: "1", type: "closed" }),
      proc({ id: "2", type: "open_controlled" }),
    ];
    const r = filterProcesses(porTipo, { ...SIN_FILTRO, tipo: "open_controlled" });
    expect(r.map((p) => p.id)).toEqual(["2"]);
  });

  it("combina búsqueda, estado y tipo", () => {
    const mixta = [
      proc({ id: "1", name: "Manzana 12", status: "calculated", type: "closed" }),
      proc({ id: "2", name: "Manzana 13", status: "closed", type: "closed" }),
      proc({ id: "3", name: "Vía 4", status: "calculated", type: "closed" }),
    ];
    const r = filterProcesses(mixta, {
      ...SIN_FILTRO,
      q: "manzana",
      estado: "calculados",
      tipo: "closed",
    });
    expect(r.map((p) => p.id)).toEqual(["1"]);
  });
});

describe("filterProcesses — ordenamiento", () => {
  it("ordena por actividad reciente de forma descendente por defecto", () => {
    const lista = [
      proc({ id: "viejo", updated_at: "2026-07-01T00:00:00Z" }),
      proc({ id: "nuevo", updated_at: "2026-07-20T00:00:00Z" }),
    ];
    const r = filterProcesses(lista, SIN_FILTRO);
    expect(r.map((p) => p.id)).toEqual(["nuevo", "viejo"]);
  });

  it("ordena la precisión numéricamente, no como texto", () => {
    // Lexicográficamente "1:1001" iría antes que "1:46"; numéricamente no.
    const lista = [
      proc({ id: "peor", relative_precision: "1:46" }),
      proc({ id: "mejor", relative_precision: "1:1001" }),
    ];
    const r = filterProcesses(lista, { ...SIN_FILTRO, orden: "precision", dir: "desc" });
    expect(r.map((p) => p.id)).toEqual(["mejor", "peor"]);
  });

  it("coloca 1:∞ como la mejor precisión", () => {
    const lista = [
      proc({ id: "finita", relative_precision: "1:99999" }),
      proc({ id: "exacta", relative_precision: "1:∞" }),
    ];
    const r = filterProcesses(lista, { ...SIN_FILTRO, orden: "precision", dir: "desc" });
    expect(r.map((p) => p.id)).toEqual(["exacta", "finita"]);
  });

  it("coloca los procesos sin precisión al final", () => {
    const lista = [
      proc({ id: "sin", relative_precision: null }),
      proc({ id: "con", relative_precision: "1:5000" }),
    ];
    const r = filterProcesses(lista, { ...SIN_FILTRO, orden: "precision", dir: "desc" });
    expect(r.map((p) => p.id)).toEqual(["con", "sin"]);
  });

  it("ordena por nombre alfabéticamente respetando el español", () => {
    const lista = [
      proc({ id: "b", name: "Ñandú" }),
      proc({ id: "a", name: "Norte" }),
    ];
    const r = filterProcesses(lista, { ...SIN_FILTRO, orden: "nombre", dir: "asc" });
    expect(r.map((p) => p.id)).toEqual(["a", "b"]);
  });

  it("invierte el orden con dir ascendente", () => {
    const lista = [
      proc({ id: "viejo", updated_at: "2026-07-01T00:00:00Z" }),
      proc({ id: "nuevo", updated_at: "2026-07-20T00:00:00Z" }),
    ];
    const r = filterProcesses(lista, { ...SIN_FILTRO, dir: "asc" });
    expect(r.map((p) => p.id)).toEqual(["viejo", "nuevo"]);
  });

  it("no altera el arreglo recibido", () => {
    const lista = [
      proc({ id: "viejo", updated_at: "2026-07-01T00:00:00Z" }),
      proc({ id: "nuevo", updated_at: "2026-07-20T00:00:00Z" }),
    ];
    filterProcesses(lista, SIN_FILTRO);
    expect(lista.map((p) => p.id)).toEqual(["viejo", "nuevo"]);
  });
});

describe("countByStatus", () => {
  it("cuenta cada grupo y el total", () => {
    const lista = [
      proc({ status: "draft" }),
      proc({ status: "in_progress" }),
      proc({ status: "calculated" }),
      proc({ status: "closed" }),
      proc({ status: "rejected" }),
    ];
    expect(countByStatus(lista)).toEqual({
      todos: 5,
      borradores: 2,
      calculados: 1,
      cerrados: 1,
      rechazados: 1,
    });
  });

  it("devuelve ceros con una lista vacía", () => {
    expect(countByStatus([])).toEqual({
      todos: 0,
      borradores: 0,
      calculados: 0,
      cerrados: 0,
      rechazados: 0,
    });
  });
});
```

- [ ] **Paso 2: Ejecutar el test y verificar que falla**

```bash
npx vitest run src/lib/process-list.test.ts
```

Esperado: FAIL — no existe el módulo `./process-list`.

- [ ] **Paso 3: Implementar el módulo**

Crear `src/lib/process-list.ts`:

```ts
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
```

Nota sobre `filtered.sort`: `filter` ya devuelve un arreglo nuevo, así que
ordenarlo no muta el recibido. El último test lo verifica.

- [ ] **Paso 4: Ejecutar el test y verificar que pasa**

```bash
npx vitest run src/lib/process-list.test.ts
```

Esperado: PASS, 22 tests.

- [ ] **Paso 5: Verificar tipos y lint**

```bash
npm run typecheck && npm run lint
```

Esperado: sin errores. Si el helper `proc` del test no encaja con
`PolygonalProcess`, ajústalo a la interfaz real leyendo `src/types/polygonal.ts`;
el `as PolygonalProcess` cubre los campos que no importan al caso.

- [ ] **Paso 6: Commit**

```bash
git add src/lib/process-list.ts src/lib/process-list.test.ts
git commit -m "feat(procesos): logica de filtrado y ordenamiento del listado"
```

---

### Tarea 2: Fecha relativa

Pieza pequeña e independiente que la tabla usa en su columna de actividad.

**Archivos:**
- Modificar: `src/lib/utils/format.ts`
- Test: `src/lib/utils/format.test.ts`

**Interfaces:**
- Produce: `formatRelativeDate(iso: string, now?: Date): string`. La Tarea 4 la
  consume.

- [ ] **Paso 1: Escribir el test que falla**

Crear `src/lib/utils/format.test.ts`. El parámetro `now` existe para que los
tests sean deterministas.

```ts
import { describe, expect, it } from "vitest";
import { formatRelativeDate } from "./format";

const AHORA = new Date("2026-07-27T12:00:00Z");

describe("formatRelativeDate", () => {
  it("dice «hoy» para el mismo día", () => {
    expect(formatRelativeDate("2026-07-27T08:00:00Z", AHORA)).toBe("hoy");
  });

  it("dice «ayer» para el día anterior", () => {
    expect(formatRelativeDate("2026-07-26T08:00:00Z", AHORA)).toBe("ayer");
  });

  it("usa días para menos de una semana", () => {
    expect(formatRelativeDate("2026-07-24T12:00:00Z", AHORA)).toBe("hace 3 días");
  });

  it("usa semanas a partir de siete días", () => {
    expect(formatRelativeDate("2026-07-13T12:00:00Z", AHORA)).toBe("hace 2 semanas");
  });

  it("usa singular para una semana", () => {
    expect(formatRelativeDate("2026-07-20T12:00:00Z", AHORA)).toBe("hace 1 semana");
  });

  it("usa meses a partir de treinta días", () => {
    expect(formatRelativeDate("2026-05-27T12:00:00Z", AHORA)).toBe("hace 2 meses");
  });

  it("usa singular para un mes", () => {
    expect(formatRelativeDate("2026-06-27T12:00:00Z", AHORA)).toBe("hace 1 mes");
  });

  it("usa años a partir de trescientos sesenta y cinco días", () => {
    expect(formatRelativeDate("2025-07-27T12:00:00Z", AHORA)).toBe("hace 1 año");
  });
});
```

- [ ] **Paso 2: Ejecutar el test y verificar que falla**

```bash
npx vitest run src/lib/utils/format.test.ts
```

Esperado: FAIL — `formatRelativeDate` no está exportada.

- [ ] **Paso 3: Implementar**

Añadir al final de `src/lib/utils/format.ts`:

```ts
/**
 * Fecha relativa en español («hoy», «hace 3 días», «hace 2 meses»).
 *
 * Comunica la recencia mejor que una fecha absoluta en un listado. La fecha
 * exacta debe quedar disponible en el atributo `title` de quien la muestre.
 *
 * `now` se inyecta para poder testear de forma determinista.
 */
export function formatRelativeDate(iso: string, now: Date = new Date()): string {
  const dias = Math.floor(
    (now.getTime() - new Date(iso).getTime()) / 86_400_000,
  );

  if (dias <= 0) return "hoy";
  if (dias === 1) return "ayer";
  if (dias < 7) return `hace ${dias} días`;

  if (dias < 30) {
    const semanas = Math.floor(dias / 7);
    return `hace ${semanas} ${semanas === 1 ? "semana" : "semanas"}`;
  }

  if (dias < 365) {
    const meses = Math.floor(dias / 30);
    return `hace ${meses} ${meses === 1 ? "mes" : "meses"}`;
  }

  const años = Math.floor(dias / 365);
  return `hace ${años} ${años === 1 ? "año" : "años"}`;
}
```

- [ ] **Paso 4: Ejecutar el test y verificar que pasa**

```bash
npx vitest run src/lib/utils/format.test.ts
```

Esperado: PASS, 8 tests.

- [ ] **Paso 5: Verificar tipos y lint**

```bash
npm run typecheck && npm run lint
```

- [ ] **Paso 6: Commit**

```bash
git add src/lib/utils/format.ts src/lib/utils/format.test.ts
git commit -m "feat(utils): fecha relativa en español"
```

---

### Tarea 3: Barra de control

Buscador, chips de estado con conteo, filtro de tipo y persistencia.

**Archivos:**
- Crear: `src/components/projects/process-list-toolbar.tsx`

**Interfaces:**
- Consume: `ProcessFilters`, `StatusCounts`, `StatusFilter` de la Tarea 1.
- Produce: `<ProcessListToolbar projectId filters counts />`. La Tarea 5 lo usa.

- [ ] **Paso 1: Crear el componente**

Es un Client Component porque necesita `localStorage` y navegación imperativa.

Crear `src/components/projects/process-list-toolbar.tsx`:

```tsx
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
```

Nota: el `onChange` del buscador navega en cada tecleo. A la escala de un
proyecto (decenas de procesos) el filtrado ocurre en el servidor sin consulta
adicional, porque la página ya tiene todos los procesos cargados. Si en la
verificación visual se percibe lento, envuélvelo en `useDeferredValue` o un
retardo de 250 ms, y anótalo en el informe.

Verifica que `Input` y `Select` aceptan `aria-label` y `className` leyendo
`src/components/design-system/input.tsx` y `select.tsx`. Si `Select` no acepta
`aria-label`, usa su prop `label` con una clase `sr-only`.

- [ ] **Paso 2: Verificar tipos y lint**

```bash
npm run typecheck && npm run lint
```

Esperado: sin errores. `POLYGONAL_TYPES` y `POLYGONAL_TYPE_LABELS` están
exportados desde `src/types/polygonal.ts`; confírmalo antes de importarlos.

- [ ] **Paso 3: Commit**

```bash
git add src/components/projects/process-list-toolbar.tsx
git commit -m "feat(procesos): barra de busqueda y filtros del listado"
```

---

### Tarea 4: Tabla de procesos

Tabla densa en escritorio, tarjetas en móvil.

**Archivos:**
- Crear: `src/components/projects/process-table.tsx`

**Interfaces:**
- Consume: `ProcessFilters`, `SortKey` de la Tarea 1; `formatRelativeDate` de la
  Tarea 2; `ProcessCard` de `src/components/projects/process-card.tsx`.
- Produce: `<ProcessTable projectId processes filters />`. La Tarea 5 lo usa.

- [ ] **Paso 1: Crear el componente**

Crear `src/components/projects/process-table.tsx`. Es un Server Component: solo
presenta datos y enlaces.

```tsx
import Link from "next/link";
import { Badge } from "@/components/design-system";
import { ProcessCard } from "@/components/projects/process-card";
import { formatDate, formatRelativeDate } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";
import type { ProcessFilters, SortKey } from "@/lib/process-list";
import {
  POLYGONAL_TYPE_LABELS,
  PROCESS_STATUS_LABELS,
  type PolygonalProcess,
  type ProcessStatus,
} from "@/types/polygonal";

const STATUS_TONE: Record<
  ProcessStatus,
  "neutral" | "primary" | "success" | "danger" | "warning"
> = {
  draft: "neutral",
  in_progress: "neutral",
  calculated: "primary",
  closed: "success",
  rejected: "danger",
};

/** Enlace de encabezado que alterna el orden de su columna. */
function SortLink({
  columna,
  etiqueta,
  projectId,
  filters,
}: {
  columna: SortKey;
  etiqueta: string;
  projectId: string;
  filters: ProcessFilters;
}) {
  const activa = filters.orden === columna;
  const dir = activa && filters.dir === "desc" ? "asc" : "desc";

  const params = new URLSearchParams();
  params.set("tab", "processes");
  if (filters.q !== "") params.set("q", filters.q);
  if (filters.estado !== "todos") params.set("estado", filters.estado);
  if (filters.tipo !== "todos") params.set("tipo", filters.tipo);
  params.set("orden", columna);
  params.set("dir", dir);

  return (
    <Link
      href={`/projects/${projectId}?${params.toString()}`}
      aria-sort={activa ? (filters.dir === "asc" ? "ascending" : "descending") : undefined}
      className={cn(
        "inline-flex items-center gap-1 transition-colors hover:text-primary-600",
        activa && "text-neutral-900",
      )}
    >
      {etiqueta}
      {activa && (
        <span aria-hidden>{filters.dir === "asc" ? "↑" : "↓"}</span>
      )}
    </Link>
  );
}

/** Semáforo de tolerancia. El color no es el único canal: lleva texto. */
function ToleranceMark({ meets }: { meets: boolean | null }) {
  if (meets === true) {
    return (
      <span className="text-success-500">
        <span aria-hidden>✓</span>
        <span className="sr-only">Cumple la tolerancia</span>
      </span>
    );
  }
  if (meets === false) {
    return (
      <span className="text-danger-500">
        <span aria-hidden>✕</span>
        <span className="sr-only">No cumple la tolerancia</span>
      </span>
    );
  }
  return (
    <span className="text-neutral-500">
      <span aria-hidden>—</span>
      <span className="sr-only">Sin verificación</span>
    </span>
  );
}

export function ProcessTable({
  projectId,
  processes,
  filters,
}: {
  projectId: string;
  processes: PolygonalProcess[];
  filters: ProcessFilters;
}) {
  return (
    <>
      {/* Escritorio */}
      <div className="hidden overflow-x-auto rounded-lg border border-neutral-200 bg-white md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-100 text-left text-xs text-neutral-500">
              <th scope="col" className="px-4 py-3 font-medium">
                <SortLink
                  columna="nombre"
                  etiqueta="Proceso"
                  projectId={projectId}
                  filters={filters}
                />
              </th>
              <th scope="col" className="px-4 py-3 font-medium">Estado</th>
              <th scope="col" className="px-4 py-3 font-medium">
                <SortLink
                  columna="precision"
                  etiqueta="Precisión"
                  projectId={projectId}
                  filters={filters}
                />
              </th>
              <th scope="col" className="px-4 py-3 text-center font-medium">Cumple</th>
              <th scope="col" className="px-4 py-3 font-medium">
                <SortLink
                  columna="actividad"
                  etiqueta="Última actividad"
                  projectId={projectId}
                  filters={filters}
                />
              </th>
            </tr>
          </thead>
          <tbody>
            {processes.map((p) => {
              const fueraDeTolerancia =
                p.status === "closed" && p.meets_tolerance === false;
              return (
                <tr
                  key={p.id}
                  className="border-b border-neutral-100 last:border-0 transition-colors hover:bg-primary-50"
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/projects/${projectId}/polygonal/${p.id}`}
                      className="font-medium text-neutral-900 hover:text-primary-600"
                    >
                      {p.name}
                    </Link>
                    <p className="text-xs text-neutral-500">
                      Poligonal · {POLYGONAL_TYPE_LABELS[p.type]}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <Badge
                      tone={
                        fueraDeTolerancia ? "warning" : STATUS_TONE[p.status]
                      }
                    >
                      {fueraDeTolerancia
                        ? "Cerrado fuera de tolerancia"
                        : PROCESS_STATUS_LABELS[p.status]}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 font-mono tabular-nums text-neutral-700">
                    {p.relative_precision ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <ToleranceMark meets={p.meets_tolerance} />
                  </td>
                  <td
                    className="whitespace-nowrap px-4 py-3 text-neutral-500"
                    title={formatDate(p.updated_at)}
                  >
                    {formatRelativeDate(p.updated_at)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Móvil: se conservan las tarjetas ya existentes. */}
      <div className="grid gap-4 md:hidden">
        {processes.map((p) => (
          <ProcessCard key={p.id} projectId={projectId} process={p} />
        ))}
      </div>
    </>
  );
}
```

- [ ] **Paso 2: Verificar tipos y lint**

```bash
npm run typecheck && npm run lint
```

Esperado: sin errores.

- [ ] **Paso 3: Commit**

```bash
git add src/components/projects/process-table.tsx
git commit -m "feat(procesos): tabla densa en escritorio y tarjetas en movil"
```

---

### Tarea 5: Integrar en el hub

Reemplaza las cuatro secciones por el listado único.

**Archivos:**
- Modificar: `src/app/(app)/projects/[id]/page.tsx`

**Interfaces:**
- Consume: `filterProcesses`, `countByStatus`, `DEFAULT_FILTERS` de la Tarea 1;
  `ProcessListToolbar` de la Tarea 3; `ProcessTable` de la Tarea 4.

- [ ] **Paso 1: Leer el archivo completo**

Lee `src/app/(app)/projects/[id]/page.tsx` antes de editar. Ya usa
`Breadcrumbs`, `Tabs` con `searchParams`, y tiene el componente local
`ProcessSection` que vas a eliminar.

- [ ] **Paso 2: Sustituir el cálculo de grupos por el filtrado**

Localiza el bloque que declara `drafts`, `calculated`, `closed` y `rejected`
(alrededor de la línea 87) y reemplázalo por la lectura de filtros desde la URL:

```tsx
const filters: ProcessFilters = {
  q: typeof sp.q === "string" ? sp.q : "",
  estado: STATUS_FILTERS.includes(sp.estado as StatusFilter)
    ? (sp.estado as StatusFilter)
    : "todos",
  tipo: POLYGONAL_TYPES.includes(sp.tipo as PolygonalType)
    ? (sp.tipo as PolygonalType)
    : "todos",
  orden: SORT_KEYS.includes(sp.orden as SortKey)
    ? (sp.orden as SortKey)
    : "actividad",
  dir: sp.dir === "asc" ? "asc" : "desc",
};

const visibles = filterProcesses(processes, filters);
const counts = countByStatus(processes);
```

Añade cerca de `TABS`, al principio del archivo, las listas de valores válidos:

```tsx
const STATUS_FILTERS: StatusFilter[] = [
  "todos",
  "borradores",
  "calculados",
  "cerrados",
  "rechazados",
];
const SORT_KEYS: SortKey[] = ["actividad", "nombre", "precision"];
```

Validar contra estas listas evita que un parámetro manipulado en la URL llegue a
la función de filtrado.

- [ ] **Paso 3: Sustituir el render de las secciones**

Reemplaza el bloque que va desde `{processes.length === 0 ? (` hasta el cierre
de las cuatro `<ProcessSection>` por:

```tsx
{processes.length === 0 ? (
  <EmptyState
    title="Aún no hay procesos"
    description="Crea el primer proceso topográfico del proyecto con «+ Nuevo Proceso»."
  />
) : (
  <div className="flex flex-col gap-4">
    <ProcessListToolbar
      projectId={project.id}
      filters={filters}
      counts={counts}
    />
    {visibles.length === 0 ? (
      <EmptyState
        title="Ningún proceso coincide"
        description="Ajusta la búsqueda o los filtros para ver otros procesos."
      />
    ) : (
      <ProcessTable
        projectId={project.id}
        processes={visibles}
        filters={filters}
      />
    )}
  </div>
)}
```

Nota la distinción: si el proyecto no tiene procesos, el mensaje invita a crear
uno; si los tiene pero ningún filtro coincide, el mensaje habla de ajustar los
filtros. Confundirlos haría creer que se perdieron los datos.

- [ ] **Paso 4: Eliminar el componente `ProcessSection`**

Ya no se usa. Elimínalo del archivo junto con el import de `ProcessCard` si
queda sin uso (la tabla lo importa por su cuenta).

- [ ] **Paso 5: Ajustar los imports**

Añade lo que ahora se necesita:

```tsx
import { ProcessListToolbar } from "@/components/projects/process-list-toolbar";
import { ProcessTable } from "@/components/projects/process-table";
import {
  countByStatus,
  filterProcesses,
  type ProcessFilters,
  type SortKey,
  type StatusFilter,
} from "@/lib/process-list";
import { POLYGONAL_TYPES, type PolygonalType } from "@/types/polygonal";
```

Elimina los imports que queden sin uso; `npm run lint` los señalará.

- [ ] **Paso 6: Verificar tipos, lint y tests**

```bash
npm run typecheck && npm run lint && npm run test
```

Esperado: sin errores; 106 tests (76 previos + 22 de la Tarea 1 + 8 de la
Tarea 2).

- [ ] **Paso 7: Verificar en la aplicación**

Dev server en http://localhost:3000, credenciales `seed@topofield.local` /
`seed1234`. Los IDs cambian con cada `db reset`:

```bash
PGPASSWORD=postgres psql -h 127.0.0.1 -p 54322 -U postgres -d postgres -tAc "select id from public.projects where name='Lote catastral' limit 1;"
```

Comprueba: la barra aparece con los cinco chips y sus conteos; escribir en el
buscador filtra; los chips filtran; el filtro de tipo funciona; pulsar un
encabezado ordena y lo indica; «Limpiar filtros» aparece solo con filtros
activos; a 390 px se ven tarjetas y no la tabla.

- [ ] **Paso 8: Commit**

```bash
git add "src/app/(app)/projects/[id]/page.tsx"
git commit -m "feat(procesos): listado unico con buscador y filtros en el hub"
```

---

### Tarea 6: Acciones rápidas por fila

Duplicar, renombrar y eliminar sin abrir el editor.

**Archivos:**
- Modificar: `src/app/(app)/projects/[id]/polygonal/[pid]/actions.ts`
- Crear: `src/components/projects/process-row-actions.tsx`
- Modificar: `src/components/projects/process-table.tsx`

**Interfaces:**
- Consume: la tabla de la Tarea 4.
- Produce: `duplicatePolygonalProcessAction`, `renamePolygonalProcessAction`,
  `deletePolygonalProcessAction`, y `<ProcessRowActions projectId process />`.

- [ ] **Paso 1: Añadir las Server Actions**

En `src/app/(app)/projects/[id]/polygonal/[pid]/actions.ts`, al final del
archivo. Lee primero el archivo: ya contiene `savePolygonalProcessAction` y
`closePolygonalProcessAction`, con el patrón de guarda de inmutabilidad en las
líneas 115 y 243 que debes replicar.

```ts
/** Duplica un proceso: misma configuración, sin estaciones, en borrador. */
export async function duplicatePolygonalProcessAction(
  processId: string,
): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: original } = await supabase
    .from("polygonal_processes")
    .select("*")
    .eq("id", processId)
    .maybeSingle();
  if (!original) return { ok: false, error: "Proceso no encontrado." };

  const { error } = await supabase.from("polygonal_processes").insert({
    project_id: original.project_id,
    name: `${original.name} (copia)`,
    type: original.type,
    angle_type: original.angle_type,
    start_point_code: original.start_point_code,
    start_north: original.start_north,
    start_east: original.start_east,
    start_azimuth_deg: original.start_azimuth_deg,
    start_azimuth_min: original.start_azimuth_min,
    start_azimuth_sec: original.start_azimuth_sec,
    end_point_code: original.end_point_code,
    end_north: original.end_north,
    end_east: original.end_east,
    end_azimuth_deg: original.end_azimuth_deg,
    end_azimuth_min: original.end_azimuth_min,
    end_azimuth_sec: original.end_azimuth_sec,
    correction_method: original.correction_method,
    status: "draft",
  });
  if (error) return { ok: false, error: "No se pudo duplicar el proceso." };

  revalidatePath(`/projects/${original.project_id}`);
  return { ok: true };
}

/** Renombra un proceso. Rechaza los cerrados: son inmutables. */
export async function renamePolygonalProcessAction(
  processId: string,
  name: string,
): Promise<ActionResult> {
  const limpio = name.trim();
  if (!limpio) return { ok: false, error: "El nombre no puede estar vacío." };

  const supabase = await createClient();
  const { data: process } = await supabase
    .from("polygonal_processes")
    .select("id, status, project_id")
    .eq("id", processId)
    .maybeSingle();
  if (!process) return { ok: false, error: "Proceso no encontrado." };
  if (process.status === "closed" || process.status === "rejected") {
    return { ok: false, error: "El proceso está cerrado y no puede modificarse." };
  }

  const { error } = await supabase
    .from("polygonal_processes")
    .update({ name: limpio })
    .eq("id", processId);
  if (error) return { ok: false, error: "No se pudo renombrar el proceso." };

  revalidatePath(`/projects/${process.project_id}`);
  return { ok: true };
}

/** Elimina un proceso. Rechaza los cerrados: son inmutables. */
export async function deletePolygonalProcessAction(
  processId: string,
): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: process } = await supabase
    .from("polygonal_processes")
    .select("id, status, project_id")
    .eq("id", processId)
    .maybeSingle();
  if (!process) return { ok: false, error: "Proceso no encontrado." };
  if (process.status === "closed" || process.status === "rejected") {
    return { ok: false, error: "El proceso está cerrado y no puede eliminarse." };
  }

  const { error } = await supabase
    .from("polygonal_processes")
    .delete()
    .eq("id", processId);
  if (error) return { ok: false, error: "No se pudo eliminar el proceso." };

  revalidatePath(`/projects/${process.project_id}`);
  return { ok: true };
}
```

Las guardas de servidor son las que cuentan: ocultar los botones en la interfaz
no impide invocar la acción directamente. Los triggers de la base son la última
línea, pero devuelven un error de PostgreSQL en vez de un mensaje legible.

- [ ] **Paso 2: Crear el menú de acciones**

Crear `src/components/projects/process-row-actions.tsx`:

```tsx
"use client";

import { useState, useTransition } from "react";
import { Button, Input, Modal } from "@/components/design-system";
import {
  deletePolygonalProcessAction,
  duplicatePolygonalProcessAction,
  renamePolygonalProcessAction,
} from "@/app/(app)/projects/[id]/polygonal/[pid]/actions";
import type { PolygonalProcess } from "@/types/polygonal";

/**
 * Acciones por fila del listado. Los procesos cerrados solo admiten duplicar:
 * renombrar y eliminar quedan ocultos, no deshabilitados — una acción visible
 * pero inerte invita a intentarla.
 */
export function ProcessRowActions({
  process,
}: {
  process: PolygonalProcess;
}) {
  const inmutable =
    process.status === "closed" || process.status === "rejected";
  const [renombrando, setRenombrando] = useState(false);
  const [eliminando, setEliminando] = useState(false);
  const [nombre, setNombre] = useState(process.name);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function ejecutar(accion: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    startTransition(async () => {
      const r = await accion();
      if (r.ok) {
        setRenombrando(false);
        setEliminando(false);
      } else {
        setError(r.error ?? "No se pudo completar la acción.");
      }
    });
  }

  return (
    <div className="flex items-center justify-end gap-1">
      <Button
        size="sm"
        variant="ghost"
        type="button"
        disabled={isPending}
        onClick={() => ejecutar(() => duplicatePolygonalProcessAction(process.id))}
      >
        Duplicar
      </Button>

      {!inmutable && (
        <>
          <Button
            size="sm"
            variant="ghost"
            type="button"
            onClick={() => {
              setNombre(process.name);
              setError(null);
              setRenombrando(true);
            }}
          >
            Renombrar
          </Button>
          <Button
            size="sm"
            variant="ghost"
            type="button"
            onClick={() => {
              setError(null);
              setEliminando(true);
            }}
          >
            Eliminar
          </Button>
        </>
      )}

      <Modal
        open={renombrando}
        onClose={() => setRenombrando(false)}
        title="Renombrar proceso"
        footer={
          <>
            <Button variant="secondary" onClick={() => setRenombrando(false)}>
              Cancelar
            </Button>
            <Button
              disabled={isPending || nombre.trim() === ""}
              onClick={() =>
                ejecutar(() => renamePolygonalProcessAction(process.id, nombre))
              }
            >
              {isPending ? "Guardando…" : "Guardar"}
            </Button>
          </>
        }
      >
        <Input
          label="Nombre del proceso"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          error={error ?? undefined}
        />
      </Modal>

      <Modal
        open={eliminando}
        onClose={() => setEliminando(false)}
        title="Eliminar proceso"
        footer={
          <>
            <Button variant="secondary" onClick={() => setEliminando(false)}>
              Cancelar
            </Button>
            <Button
              variant="danger"
              disabled={isPending}
              onClick={() =>
                ejecutar(() => deletePolygonalProcessAction(process.id))
              }
            >
              {isPending ? "Eliminando…" : "Eliminar"}
            </Button>
          </>
        }
      >
        <p className="text-sm text-neutral-700">
          Se eliminará «{process.name}» y todas sus estaciones. Esta acción no se
          puede deshacer.
        </p>
        {error && <p className="mt-2 text-sm text-danger-500">{error}</p>}
      </Modal>
    </div>
  );
}
```

Verifica que `Modal` acepta `open`, `onClose`, `title` y `footer` leyendo
`src/components/design-system/modal.tsx`, y que `Button` tiene la variante
`danger` y el tamaño `sm`. Ajusta las props a las reales si difieren.

- [ ] **Paso 3: Añadir la columna a la tabla**

En `src/components/projects/process-table.tsx`, añade el import:

```tsx
import { ProcessRowActions } from "@/components/projects/process-row-actions";
```

Una columna más en el encabezado, tras «Última actividad»:

```tsx
<th scope="col" className="px-4 py-3">
  <span className="sr-only">Acciones</span>
</th>
```

Y la celda al final de cada fila:

```tsx
<td className="px-4 py-3">
  <ProcessRowActions process={p} />
</td>
```

- [ ] **Paso 4: Verificar tipos, lint y tests**

```bash
npm run typecheck && npm run lint && npm run test
```

Esperado: sin errores; 106 tests.

- [ ] **Paso 5: Verificar en la aplicación**

Comprueba con el dev server:
- En un proceso **calculado**: aparecen Duplicar, Renombrar y Eliminar.
- En un proceso **cerrado** o **rechazado**: aparece solo Duplicar.
- Duplicar crea un proceso «… (copia)» en borrador, sin estaciones, y el
  original no cambia.
- Renombrar cambia el nombre y el listado se actualiza.
- Eliminar pide confirmación y elimina.

Consulta los IDs con:

```bash
PGPASSWORD=postgres psql -h 127.0.0.1 -p 54322 -U postgres -d postgres -c "select id, name, status from public.polygonal_processes;"
```

- [ ] **Paso 6: Verificar la guarda de servidor**

Comprueba que las acciones rechazan un proceso cerrado aunque se invoquen sin
pasar por la interfaz. Intenta el borrado directo en la base con el rol de
usuario autenticado:

```bash
CLOSED=$(PGPASSWORD=postgres psql -h 127.0.0.1 -p 54322 -U postgres -d postgres -tAc "select id from public.polygonal_processes where status='closed' limit 1;")
USER=$(PGPASSWORD=postgres psql -h 127.0.0.1 -p 54322 -U postgres -d postgres -tAc "select user_id from public.projects limit 1;")
PGPASSWORD=postgres psql -h 127.0.0.1 -p 54322 -U postgres -d postgres << SQL
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims TO '{"sub":"'$USER'","role":"authenticated"}';
DELETE FROM public.polygonal_processes WHERE id='$CLOSED';
ROLLBACK;
SQL
```

Esperado: `ERROR: El proceso … está cerrado (closed) y no puede eliminarse.`

- [ ] **Paso 7: Commit**

```bash
git add "src/app/(app)/projects/[id]/polygonal/[pid]/actions.ts" src/components/projects/process-row-actions.tsx src/components/projects/process-table.tsx
git commit -m "feat(procesos): acciones de duplicar, renombrar y eliminar por fila"
```

---

### Tarea 7: Persistencia de filtros

La restauración del último filtro usado, con la regla de precedencia de la URL.

**Archivos:**
- Modificar: `src/components/projects/process-list-toolbar.tsx`

**Interfaces:**
- Consume: la barra de la Tarea 3, que ya guarda en `localStorage`.

- [ ] **Paso 1: Añadir la restauración**

La Tarea 3 dejó la escritura en `localStorage`; falta la lectura. En
`process-list-toolbar.tsx`, añade un efecto que restaure el filtro guardado
**solo cuando la URL no trae parámetros propios**:

```tsx
// Restauración: si la URL no trae filtros, recupera el último usado.
// La URL manda siempre — un enlace compartido debe mostrar lo que envió su
// autor, no los filtros de quien lo abre.
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
```

La condición `guardado !== "tab=processes"` evita navegar cuando lo guardado es
el filtro por defecto, que no cambia nada.

- [ ] **Paso 2: Verificar tipos, lint y tests**

```bash
npm run typecheck && npm run lint && npm run test
```

Esperado: sin errores. Si ESLint objeta el arreglo de dependencias vacío, el
comentario `eslint-disable-next-line` ya lo cubre; si aun así falla, revisa la
regla exacta que reporta y aplícale el disable correspondiente.

- [ ] **Paso 3: Verificar el comportamiento**

Con el dev server:

1. Abre el hub, aplica el filtro «Cerrados» y navega a otra página.
2. Vuelve al hub **sin parámetros** (`/projects/<id>`): debe restaurar
   «Cerrados», con el chip activo y «Limpiar filtros» visible.
3. Abre `/projects/<id>?tab=processes&estado=calculados` directamente: debe
   mostrar «Calculados», **no** el filtro guardado.
4. Pulsa «Limpiar filtros» y vuelve: debe mostrar todos.

El punto 3 es el que verifica la regla de precedencia.

- [ ] **Paso 4: Commit**

```bash
git add src/components/projects/process-list-toolbar.tsx
git commit -m "feat(procesos): recordar el ultimo filtro usado por proyecto"
```

---

### Tarea 8: Verificación final y documentación

**Archivos:**
- Modificar: `docs/manual/README.md`
- Modificar: `docs/tecnica/README.md`

- [ ] **Paso 1: Suite completa**

```bash
npm run typecheck && npm run lint && npm run test && npm run build
```

Esperado: los cuatro limpios; 106 tests.

- [ ] **Paso 2: Recorrer los 13 criterios de aceptación**

Verifica uno por uno los criterios de la § 6 de
[`docs/specs/2026-07-27-listado-procesos-design.md`](../specs/2026-07-27-listado-procesos-design.md).

Presta atención especial a:
- **Criterio 9**: el ordenamiento por precisión es numérico — `1:46` ordena antes
  que `1:1001`. Compruébalo en la aplicación, no solo en los tests.
- **Criterio 11**: las Server Actions rechazan renombrar y eliminar procesos
  cerrados aunque se invoquen directamente.
- **Criterio 12**: duplicar crea un `draft` sin estaciones y no modifica el
  original.

- [ ] **Paso 3: Verificar el responsive**

A 390 px: se ven tarjetas y no la tabla, y la página no desborda
horizontalmente:

```js
document.documentElement.scrollWidth <= document.documentElement.clientWidth
```

- [ ] **Paso 4: Actualizar el manual de usuario**

En `docs/manual/README.md`, la sección **4.2 El proyecto por dentro** describe
los procesos «agrupados por estado: Borradores, Calculados, Cerrados y
Rechazados». Reescríbela para explicar la barra de búsqueda, los chips de filtro
con conteo, el ordenamiento por columna y las acciones por fila.

Menciona que los procesos cerrados solo admiten duplicarse, y por qué.

- [ ] **Paso 5: Regenerar las capturas**

```bash
node docs/manual/capturas.mjs
```

La captura `04-hub-proyecto.png` cambiará al listado nuevo.

- [ ] **Paso 6: Actualizar la documentación técnica**

En `docs/tecnica/README.md`:
- Añade `src/lib/process-list.ts` a la estructura de archivos.
- Actualiza la tabla de pruebas de § 9 con los archivos y conteos nuevos.
- Añade `duplicatePolygonalProcessAction`, `renamePolygonalProcessAction` y
  `deletePolygonalProcessAction` a la tabla de Server Actions de § 3.
- En § 11, la deuda sobre `relative_precision` como texto: menciona que el
  listado la sortea con `parsePrecision`, y que persiste como deuda de esquema.

- [ ] **Paso 7: Commit**

```bash
git add docs/
git commit -m "docs: actualizar manual y documentacion tecnica con el listado de procesos"
```

---

## Notas de implementación

- El orden importa: la Tarea 1 produce la lógica que consumen la 3, la 4 y la 5;
  la Tarea 2 produce el formateador que usa la 4.
- Las Tareas 4 y 6 comparten `process-table.tsx`. Ejecutarlas en orden evita
  conflictos.
- La Tarea 3 deja la escritura en `localStorage` y la Tarea 7 añade la lectura.
  Están separadas porque la precedencia de la URL es una regla propia, que
  merece su propia verificación.
- No tocar `src/lib/calculations/` ni `src/lib/validators/`.
- `ProcessCard` se conserva: la vista móvil sigue usándolo.
