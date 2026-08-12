# Fase 4 — Módulo Nivelación: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir el editor de nivelación geométrica (cerrada, enlace, abierta sin control) con cálculo en vivo de AI y cotas, comprobación aritmética, error de cierre contra tolerancia, corrección proporcional a la distancia, ida y vuelta a nivel de sección, y cierre con trazabilidad.

**Architecture:** Funciones puras en `src/lib/calculations/leveling.ts` (sin React ni Supabase) probadas con Vitest contra fixtures verificados a mano; validadores puros en `src/lib/validators/leveling.ts` reutilizados en cliente y servidor; editor client component con cálculo en vivo; persistencia por Server Actions que **recalculan en el servidor** con las mismas funciones puras. Replica la arquitectura de la Fase 3 (poligonal) sin rediseñarla.

**Tech Stack:** Next.js 16 (App Router) · React 19 · TypeScript · Supabase (PostgreSQL + Auth + RLS) · Tailwind CSS v4 · Vitest

## Global Constraints

- **PRD de fase:** `docs/prds/03-nivelacion.md`. Toda decisión con número (#1-#12) referencia esa tabla.
- **Funciones puras:** los archivos de `src/lib/calculations/` no importan React, hooks ni Supabase. Solo math.
- **Cotas a 4 decimales** (`0.0000`), distancias en km a 3 decimales, errores en mm a 1 decimal.
- **Idioma de interfaz:** español (Colombia). Comentarios de código en español.
- **Tolerancia:** `K·√D_km` con `K = {primer_orden: 3, segundo_orden: 6, tercer_orden: 12, ordinario: 24}` mm. La **D es la distancia en un solo sentido** (decisión #9), nunca ida+vuelta.
- **Procesos cerrados son inmutables:** ningún Server Action genera UPDATE sobre `status` en `('closed','rejected')`. Garantizado además por trigger de base.
- **Fixtures de test:** construidos con entradas limpias y verificados a mano. **Nunca copiar tablas del marco teórico** — se demostró que no son aritméticamente consistentes (hallazgo 1 del PRD de fase).
- **La app está en producción.** Las migraciones **no se editan en sitio**: toda corrección posterior va en una migración nueva con `ALTER TABLE`.
- **Commits en español** con prefijos `feat:`, `fix:`, `refactor:`, `docs:`. Un commit por cambio lógico.
- **Verificación:** `npm run typecheck` tras cada cambio de código; `npm run test` tras cada tarea con tests.

## File Structure

| Archivo | Responsabilidad |
|---|---|
| `supabase/migrations/<ts>_leveling.sql` | Crear `leveling_processes`, `leveling_readings`, RLS, triggers |
| `src/types/leveling.ts` | Literales de CHECK, etiquetas ES, filas tipadas, contratos de entrada/resultado |
| `src/lib/calculations/tolerances.ts` (modificar) | Añadir `LEVELING_TOLERANCE_K` y `levelingTolerance()` |
| `src/lib/calculations/leveling.ts` | Cálculo base, comprobación aritmética, cierre, corrección, ida/vuelta |
| `src/lib/calculations/leveling.test.ts` | Tests de todo lo anterior |
| `src/lib/validators/leveling.ts` | Validación de captura y de cierre |
| `src/lib/supabase/queries.ts` (modificar) | `getLevelingProcesses`, `getLevelingProcess` |
| `src/app/(app)/projects/[id]/leveling/new/{page,actions}.tsx/ts` | Formulario de creación |
| `src/app/(app)/projects/[id]/leveling/[pid]/{page,actions}.tsx/ts` | Editor y sus Server Actions |
| `src/components/leveling/leveling-config-fields.tsx` | Campos de config compartidos entre `/new` y editor |
| `src/components/leveling/bm-selector.tsx` | Selector de BM desde `reference_points` + fallback libre |
| `src/components/leveling/readings-table.tsx` | Libreta: Punto/Tipo/L.At/AI/L.Ad/Dist/Cota |
| `src/components/leveling/run-tabs.tsx` | Tabs Ida \| Vuelta |
| `src/components/leveling/results-panel.tsx` | Comprobación aritmética, cierre, tolerancia, discrepancia |
| `src/components/leveling/leveling-editor.tsx` | Client component orquestador |
| `src/components/leveling/close-process-dialog.tsx` | Diálogo de cierre |
| `src/components/projects/new-process-selector.tsx` (modificar) | Activar «Nivelación» |

---

### Task 1: Migración SQL y tipos de base

**Files:**
- Create: `supabase/migrations/<timestamp>_leveling.sql`
- Modify: `src/types/database.ts` (regenerado, no editar a mano)

**Interfaces:**
- Consumes: `public.set_updated_at()` y `public.reject_update_on_closed_process()` (ya existen, son genéricas)
- Produces: tablas `leveling_processes` y `leveling_readings`; tipos `Tables<"leveling_processes">` y `Tables<"leveling_readings">` en `database.ts`

- [ ] **Step 1: Crear el archivo de migración**

Generar el timestamp con `date -u +%Y%m%d%H%M%S` y crear `supabase/migrations/<timestamp>_leveling.sql`:

```sql
-- ============================================================================
-- Módulo de nivelación — Fase 4
-- ============================================================================
-- Tablas del PRD § 3.2 más tres ajustes documentados en docs/prds/03-nivelacion.md:
--   · point_type (decisión #7): los puntos intermedios no propagan cota ni
--     entran en la comprobación aritmética. Sin distinguirlos el cálculo es
--     incorrecto.
--   · distance_m (decisión #8): distancia por visual, necesaria para validar el
--     equilibrado atrás/adelante. Guardar solo la acumulada lo impediría.
--   · correction_method con CHECK explícito (decisión #3): hoy un solo método.
-- ============================================================================

create table public.leveling_processes (
  id                      uuid primary key default gen_random_uuid(),
  project_id              uuid not null references public.projects(id) on delete cascade,
  name                    text not null,
  type                    text not null check (type in ('closed', 'link', 'open')),
  -- BM de partida
  start_bm_code           text not null,
  start_bm_elevation      decimal(10,4) not null,
  -- BM de llegada (solo type = 'link')
  end_bm_code             text,
  end_bm_elevation        decimal(10,4),
  -- Configuración
  has_return_run          boolean not null default false,
  total_distance_km       decimal(8,3),
  correction_method       text not null default 'proportional_distance'
                            check (correction_method in ('proportional_distance')),
  -- Resultados de cierre
  closure_error_mm        decimal(8,1),
  tolerance_mm            decimal(8,1),
  meets_tolerance         boolean,
  -- Ida y vuelta: error de SECCIÓN por recorrido (decisión #2)
  forward_error_mm        decimal(8,1),
  return_error_mm         decimal(8,1),
  discrepancy_mm          decimal(8,1),
  -- Estado
  status                  text not null default 'draft'
                            check (status in ('draft', 'in_progress', 'calculated', 'closed', 'rejected')),
  closed_at               timestamptz,
  closed_by               text,
  notes                   text,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

create table public.leveling_readings (
  id                      uuid primary key default gen_random_uuid(),
  process_id              uuid not null references public.leveling_processes(id) on delete cascade,
  run_type                text not null default 'forward' check (run_type in ('forward', 'return')),
  reading_order           int not null,
  point_code              text not null,
  -- 'pc' es el caso mayoritario, pero el editor asigna el tipo SIEMPRE de forma
  -- explícita: la primera fila de un recorrido es 'bm', y la última también en
  -- los tipos 'closed' y 'link'. Confiar en el default para esas filas daría
  -- una comprobación aritmética silenciosamente incorrecta.
  point_type              text not null default 'pc'
                            check (point_type in ('bm', 'pc', 'intermediate')),
  backsight               decimal(6,4),
  foresight               decimal(6,4),
  distance_m              decimal(8,1),
  distance_accumulated_km decimal(8,3),
  -- Calculados
  instrument_height       decimal(10,4),
  elevation_calculated    decimal(10,4),
  elevation_corrected     decimal(10,4),
  correction_applied      decimal(8,4),
  -- Validación
  has_warnings            boolean not null default false,
  warning_messages        jsonb,
  created_at              timestamptz not null default now()
);

create index leveling_processes_project_id_idx on public.leveling_processes(project_id);
create index leveling_readings_process_id_idx on public.leveling_readings(process_id);

-- --- Row Level Security -----------------------------------------------------
alter table public.leveling_processes enable row level security;
alter table public.leveling_readings enable row level security;

create policy "leveling_processes_all_own" on public.leveling_processes
  for all using (
    exists (
      select 1 from public.projects p
      where p.id = leveling_processes.project_id and p.user_id = auth.uid()
    )
  );

create policy "leveling_readings_all_own" on public.leveling_readings
  for all using (
    exists (
      select 1 from public.leveling_processes lp
      join public.projects p on p.id = lp.project_id
      where lp.id = leveling_readings.process_id and p.user_id = auth.uid()
    )
  );

-- --- Triggers ---------------------------------------------------------------
create trigger leveling_processes_set_updated_at
  before update on public.leveling_processes
  for each row execute function public.set_updated_at();

-- Inmutabilidad de procesos cerrados (reusa la función genérica de la Fase 3).
create trigger leveling_processes_reject_update_on_closed
  before update on public.leveling_processes
  for each row execute function public.reject_update_on_closed_process();
```

- [ ] **Step 2: Verificar el patrón RLS y de triggers contra la migración de poligonal**

Run: `grep -n "policy\|trigger\|set_updated_at\|reject_update" supabase/migrations/20260522053657_polygonal.sql`
Expected: las políticas y triggers de arriba siguen la misma forma. Si `polygonal_processes` usa policies separadas por operación en vez de `for all`, replicar esa forma en su lugar.

- [ ] **Step 3: Aplicar la migración en local**

Run: `npx supabase db reset`
Expected: exit 0, todas las migraciones aplican sin error.

- [ ] **Step 4: Regenerar los tipos**

Run: `npx supabase gen types typescript --local 2>/dev/null > src/types/database.ts`

- [ ] **Step 5: Verificar que los tipos aparecieron**

Run: `grep -c "leveling_processes\|leveling_readings" src/types/database.ts`
Expected: un número > 0. Si es 0, la migración no aplicó o el comando contaminó el archivo.

- [ ] **Step 6: Typecheck**

Run: `npm run typecheck`
Expected: exit 0.

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations src/types/database.ts
git commit -m "feat: tablas de nivelacion con RLS e inmutabilidad"
```

---

### Task 2: Tipos de dominio

**Files:**
- Create: `src/types/leveling.ts`

**Interfaces:**
- Consumes: `Tables<>` de `./database`; `PrecisionOrder` de `./project`; `ProcessStatus` y `PROCESS_STATUS_LABELS` de `./polygonal` (ya existen — **importar, no redefinir**)
- Produces:
  - `LevelingType = "closed" | "link" | "open"`, `RunType = "forward" | "return"`, `PointType = "bm" | "pc" | "intermediate"`
  - `LevelingProcess`, `LevelingReading` (filas tipadas)
  - `ReadingInput { pointCode: string; pointType: PointType; backsight: number | null; foresight: number | null; distanceM: number | null; distanceAccumulatedKm: number | null }`
  - `LevelingInput { type: LevelingType; startElevation: number; endElevation: number | null; order: PrecisionOrder; totalDistanceKm: number; forward: ReadingInput[]; return: ReadingInput[] | null }`
  - `ComputedReading = ReadingInput & { instrumentHeight: number | null; elevationCalculated: number; elevationCorrected: number; correctionApplied: number }`
  - `LevelingResult { forward: RunResult; return: RunResult | null; arithmeticCheckOk: boolean; sumBacksights: number; sumForesights: number; closureErrorMm: number | null; toleranceMm: number | null; meetsTolerance: boolean | null; discrepancyMm: number | null; discrepancyToleranceMm: number | null; meetsDiscrepancy: boolean | null; adoptedHeightDifference: number | null }`
  - `RunResult { readings: ComputedReading[]; heightDifference: number; errorMm: number | null }`
  - Etiquetas: `LEVELING_TYPE_LABELS`, `POINT_TYPE_LABELS`, `RUN_TYPE_LABELS`

- [ ] **Step 1: Verificar qué exporta ya `types/polygonal.ts` para no duplicar**

Run: `grep -n "export const PROCESS_STATUSES\|export type ProcessStatus\|PROCESS_STATUS_LABELS" src/types/polygonal.ts`
Expected: los tres existen. `types/leveling.ts` los importa desde ahí en vez de redefinirlos.

- [ ] **Step 2: Escribir el archivo**

```typescript
// Tipos de dominio del proceso de nivelación: literales de los CHECK del
// schema, etiquetas en español, filas tipadas y los contratos de entrada y
// resultado de src/lib/calculations/leveling.ts.

import type { Tables } from "./database";
import type { PrecisionOrder } from "./project";

// El ciclo de estados es común a todos los procesos; vive en polygonal.ts
// desde la Fase 3 y se reutiliza tal cual.
export type { ProcessStatus } from "./polygonal";
export { PROCESS_STATUSES, PROCESS_STATUS_LABELS } from "./polygonal";

// --- Literales de los CHECK del schema (PRD § 3.2 + decisión #7) ---

export const LEVELING_TYPES = ["closed", "link", "open"] as const;
export type LevelingType = (typeof LEVELING_TYPES)[number];

export const RUN_TYPES = ["forward", "return"] as const;
export type RunType = (typeof RUN_TYPES)[number];

/**
 * Tipo de punto en la libreta:
 * - `bm`: banco de nivel, cota conocida. Ancla el recorrido.
 * - `pc`: punto de cambio. Recibe L.Ad de una armada y L.At de la siguiente;
 *   propaga la cota entre armadas.
 * - `intermediate`: radiación. Solo recibe L.Ad, cuelga de la AI vigente, no
 *   propaga cota y queda FUERA de la comprobación aritmética y de la
 *   compensación.
 */
export const POINT_TYPES = ["bm", "pc", "intermediate"] as const;
export type PointType = (typeof POINT_TYPES)[number];

export const CORRECTION_METHODS = ["proportional_distance"] as const;
export type LevelingCorrectionMethod = (typeof CORRECTION_METHODS)[number];

// --- Filas tipadas ---

export type LevelingProcess = Omit<
  Tables<"leveling_processes">,
  "type" | "correction_method" | "status"
> & {
  type: LevelingType;
  correction_method: LevelingCorrectionMethod;
  status: import("./polygonal").ProcessStatus;
};

export type LevelingReading = Omit<
  Tables<"leveling_readings">,
  "run_type" | "point_type"
> & {
  run_type: RunType;
  point_type: PointType;
};

// --- Contratos de cálculo ---

export interface ReadingInput {
  pointCode: string;
  pointType: PointType;
  backsight: number | null;
  foresight: number | null;
  distanceM: number | null;
  distanceAccumulatedKm: number | null;
}

export interface LevelingInput {
  type: LevelingType;
  /** Cota conocida del BM de partida. */
  startElevation: number;
  /** Cota conocida del BM de llegada. Solo `link`; null en el resto. */
  endElevation: number | null;
  order: PrecisionOrder;
  /** Distancia del recorrido en UN solo sentido, en km (decisión #9). */
  totalDistanceKm: number;
  forward: ReadingInput[];
  /** Recorrido de vuelta, independiente de la ida (decisión #2). */
  return: ReadingInput[] | null;
}

export interface ComputedReading extends ReadingInput {
  /** AI de la armada que abre esta fila. Null si la fila no lleva L.At. */
  instrumentHeight: number | null;
  elevationCalculated: number;
  elevationCorrected: number;
  /** Corrección aplicada, en metros. */
  correctionApplied: number;
}

export interface RunResult {
  readings: ComputedReading[];
  /** Desnivel de la sección: cota final − cota inicial. */
  heightDifference: number;
  /** Error de cierre del recorrido en mm. Null si el tipo no cierra. */
  errorMm: number | null;
}

export interface LevelingResult {
  forward: RunResult;
  return: RunResult | null;
  // Comprobación aritmética (solo bm y pc; los intermedios se excluyen).
  arithmeticCheckOk: boolean;
  sumBacksights: number;
  sumForesights: number;
  // Cierre. Null en `open`, que no cierra contra nada.
  closureErrorMm: number | null;
  toleranceMm: number | null;
  meetsTolerance: boolean | null;
  // Ida y vuelta. Null si has_return_run es false.
  discrepancyMm: number | null;
  discrepancyToleranceMm: number | null;
  meetsDiscrepancy: boolean | null;
  adoptedHeightDifference: number | null;
}

// --- Etiquetas en español ---

export const LEVELING_TYPE_LABELS: Record<LevelingType, string> = {
  closed: "Cerrada",
  link: "De enlace",
  open: "Abierta sin control",
};

export const POINT_TYPE_LABELS: Record<PointType, string> = {
  bm: "BM",
  pc: "Punto de cambio",
  intermediate: "Intermedio",
};

export const RUN_TYPE_LABELS: Record<RunType, string> = {
  forward: "Ida",
  return: "Vuelta",
};
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
git add src/types/leveling.ts
git commit -m "feat: tipos de dominio de nivelacion"
```

---

### Task 3: Tolerancias de nivelación

**Files:**
- Modify: `src/lib/calculations/tolerances.ts`
- Modify: `src/lib/calculations/tolerances.test.ts`

**Interfaces:**
- Consumes: `PrecisionOrder` de `@/types/project`
- Produces: `LEVELING_TOLERANCE_K: Record<PrecisionOrder, number>`, `levelingTolerance(order: PrecisionOrder, distanceKm: number): number` (retorna mm)

- [ ] **Step 1: Escribir los tests que fallan**

Añadir a `src/lib/calculations/tolerances.test.ts`:

```typescript
import { levelingTolerance, LEVELING_TOLERANCE_K } from "./tolerances";

describe("levelingTolerance", () => {
  it("usa los K del PRD § 5.4: 3/6/12/24 mm", () => {
    expect(LEVELING_TOLERANCE_K.primer_orden).toBe(3);
    expect(LEVELING_TOLERANCE_K.segundo_orden).toBe(6);
    expect(LEVELING_TOLERANCE_K.tercer_orden).toBe(12);
    expect(LEVELING_TOLERANCE_K.ordinario).toBe(24);
  });

  it("calcula K·√D en mm", () => {
    // 12 · √0.9 = 11.3842...
    expect(levelingTolerance("tercer_orden", 0.9)).toBeCloseTo(11.3842, 3);
    // 12 · √2.2 = 17.7986...
    expect(levelingTolerance("tercer_orden", 2.2)).toBeCloseTo(17.7986, 3);
    // 3 · √1 = 3
    expect(levelingTolerance("primer_orden", 1)).toBeCloseTo(3, 6);
  });

  it("da 0 para distancia 0", () => {
    expect(levelingTolerance("ordinario", 0)).toBe(0);
  });
});
```

- [ ] **Step 2: Ejecutar los tests para verificar que fallan**

Run: `npm run test -- tolerances`
Expected: FAIL — `levelingTolerance is not a function` o error de import.

- [ ] **Step 3: Implementar**

Añadir a `src/lib/calculations/tolerances.ts`:

```typescript
/**
 * Coeficiente K de la tolerancia de nivelación K·√D, en milímetros
 * (PRD § 5.4). Coinciden con la tabla del marco teórico § 8; su «Segundo
 * Orden Clase II» es nuestro `segundo_orden`. Los niveles «Clase I» (K=4) y
 * «Expedita» (K=50) del marco teórico no están modelados en
 * `projects.precision_order` (decisión #4 del PRD de fase).
 */
export const LEVELING_TOLERANCE_K: Record<PrecisionOrder, number> = {
  primer_orden: 3,
  segundo_orden: 6,
  tercer_orden: 12,
  ordinario: 24,
};

/**
 * Tolerancia de cierre de nivelación en milímetros: K·√D_km.
 *
 * IMPORTANTE: `distanceKm` es la longitud del recorrido en UN SOLO SENTIDO,
 * nunca ida+vuelta (decisión #9 del PRD de fase). Las fuentes discrepan en
 * este punto — FGCS distingue D (sección, un sentido) de F (perímetro de
 * circuito) — y usar el recorrido total inflaría la tolerancia en √2 (≈41 %).
 */
export function levelingTolerance(
  order: PrecisionOrder,
  distanceKm: number,
): number {
  return LEVELING_TOLERANCE_K[order] * Math.sqrt(distanceKm);
}
```

- [ ] **Step 4: Ejecutar los tests**

Run: `npm run test -- tolerances`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/calculations/tolerances.ts src/lib/calculations/tolerances.test.ts
git commit -m "feat: tolerancias de nivelacion K*sqrt(D)"
```

---

### Task 4: Cálculo base y comprobación aritmética

**Files:**
- Create: `src/lib/calculations/leveling.ts`
- Create: `src/lib/calculations/leveling.test.ts`

**Interfaces:**
- Consumes: tipos de `@/types/leveling`
- Produces: `computeRun(readings: ReadingInput[], startElevation: number): { readings: ComputedReading[]; heightDifference: number; sumBacksights: number; sumForesights: number; arithmeticCheckOk: boolean }`

**Contexto que el implementador necesita:** dentro de una misma armada (puesta de instrumento) hay **una sola AI**. Lo que confunde del layout de libreta es que las dos lecturas de una fila pertenecen a armadas distintas: la L.Ad se disparó desde la armada anterior y determina la cota de ese punto; la L.At se dispara desde la armada siguiente. Por eso el orden dentro de la fila es **consumir → generar** y no al revés.

- [ ] **Step 1: Escribir los tests que fallan**

Crear `src/lib/calculations/leveling.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { computeRun } from "./leveling";
import type { PointType, ReadingInput } from "@/types/leveling";

function r(
  pointCode: string,
  pointType: PointType,
  backsight: number | null,
  foresight: number | null,
  distanceAccumulatedKm: number | null,
): ReadingInput {
  return {
    pointCode,
    pointType,
    backsight,
    foresight,
    distanceM: null,
    distanceAccumulatedKm,
  };
}

// Fixture verificado a mano. Circuito cerrado de 0.900 km que sale del BM-1
// (cota 100.000) y regresa a él con un error deliberado de −8.0 mm.
//   ΣL.At = 4.500 · ΣL.Ad = 4.508 · diferencia = −0.008 = Δcota. Cuadra.
const CLOSED_RUN: ReadingInput[] = [
  r("BM-1", "bm", 1.5, null, 0.0),
  r("PC-1", "pc", 2.0, 1.2, 0.3),
  r("PC-2", "pc", 1.0, 2.5, 0.6),
  r("BM-1", "bm", null, 0.808, 0.9),
];

describe("computeRun — cálculo base", () => {
  const run = computeRun(CLOSED_RUN, 100.0);

  it("calcula la AI solo en las filas con lectura atrás", () => {
    expect(run.readings.map((x) => x.instrumentHeight)).toEqual([
      101.5, 102.3, 100.8, null,
    ]);
  });

  it("consume la AI anterior antes de generar la nueva", () => {
    // PC-1: cota = AI(BM-1) 101.5 − L.Ad 1.2 = 100.3
    //       y SOLO DESPUÉS AI = 100.3 + 2.0 = 102.3
    expect(run.readings[1]?.elevationCalculated).toBeCloseTo(100.3, 6);
    expect(run.readings[1]?.instrumentHeight).toBeCloseTo(102.3, 6);
  });

  it("encadena las cotas del recorrido", () => {
    expect(run.readings.map((x) => x.elevationCalculated)).toEqual([
      100.0, 100.3, 99.8, 99.992,
    ]);
  });

  it("calcula el desnivel de la sección", () => {
    expect(run.heightDifference).toBeCloseTo(-0.008, 6);
  });

  it("cuadra la comprobación aritmética ΣLA − ΣLD = Δcota", () => {
    expect(run.sumBacksights).toBeCloseTo(4.5, 6);
    expect(run.sumForesights).toBeCloseTo(4.508, 6);
    expect(run.arithmeticCheckOk).toBe(true);
  });
});

describe("computeRun — puntos intermedios", () => {
  // Un intermedio cuelga de la AI vigente y NO la actualiza.
  const withIntermediate: ReadingInput[] = [
    r("BM-1", "bm", 1.5, null, 0.0),
    r("A", "intermediate", null, 1.1, 0.1),
    r("PC-1", "pc", 2.0, 1.2, 0.3),
    r("BM-2", "bm", null, 2.5, 0.6),
  ];
  const run = computeRun(withIntermediate, 100.0);

  it("calcula la cota del intermedio contra la AI vigente", () => {
    // AI vigente = 101.5 → cota A = 101.5 − 1.1 = 100.4
    expect(run.readings[1]?.elevationCalculated).toBeCloseTo(100.4, 6);
  });

  it("no deja que el intermedio genere AI ni propague cota", () => {
    expect(run.readings[1]?.instrumentHeight).toBeNull();
    // PC-1 sigue colgando de la AI del BM-1, no de la del intermedio.
    expect(run.readings[2]?.elevationCalculated).toBeCloseTo(100.3, 6);
  });

  it("excluye los intermedios de la comprobación aritmética", () => {
    // ΣLA = 1.5 + 2.0 = 3.5 (el intermedio no aporta L.At, y su L.Ad se ignora)
    // ΣLD = 1.2 + 2.5 = 3.7 → diferencia −0.2 = 99.8 − 100.0. Cuadra.
    expect(run.sumBacksights).toBeCloseTo(3.5, 6);
    expect(run.sumForesights).toBeCloseTo(3.7, 6);
    expect(run.arithmeticCheckOk).toBe(true);
  });
});

describe("computeRun — el orden consumir → generar", () => {
  // Este es el test que protege contra el error más difícil de ver a ojo:
  // invertir el orden dentro de la fila desplaza TODAS las cotas del recorrido
  // de forma coherente, así que el resultado sigue pareciendo plausible.
  it("no usa la L.At de la propia fila para calcular su cota", () => {
    const run = computeRun(
      [
        r("BM-1", "bm", 1.5, null, 0.0),
        // Si la implementación generase la AI antes de consumirla, la cota de
        // PC-1 saldría de 100.0 + 1.5 + 2.0 − 1.2, no de 101.5 − 1.2.
        r("PC-1", "pc", 2.0, 1.2, 0.3),
      ],
      100.0,
    );
    expect(run.readings[1]?.elevationCalculated).toBeCloseTo(100.3, 6);
    expect(run.readings[1]?.elevationCalculated).not.toBeCloseTo(102.3, 6);
  });

  it("deja la primera fila en la cota de partida, sin L.Ad que consumir", () => {
    const run = computeRun([r("BM-1", "bm", 1.5, null, 0.0)], 100.0);
    expect(run.readings[0]?.elevationCalculated).toBeCloseTo(100.0, 6);
    expect(run.readings[0]?.instrumentHeight).toBeCloseTo(101.5, 6);
    expect(run.heightDifference).toBeCloseTo(0, 6);
  });
});
```

- [ ] **Step 2: Ejecutar los tests para verificar que fallan**

Run: `npm run test -- leveling`
Expected: FAIL — no existe el módulo `./leveling`.

- [ ] **Step 3: Implementar `computeRun`**

Crear `src/lib/calculations/leveling.ts`:

```typescript
// Algoritmos de nivelación geométrica (PRD § 6.7-6.9).
// Funciones puras de TypeScript: sin React, sin hooks, sin Supabase. Solo math.

import type { ComputedReading, ReadingInput } from "@/types/leveling";

/** Tolerancia de la comprobación aritmética, en metros (0.1 mm). */
const ARITHMETIC_EPSILON = 0.0001;

export interface RunComputation {
  readings: ComputedReading[];
  /** Desnivel de la sección: cota final − cota inicial. */
  heightDifference: number;
  sumBacksights: number;
  sumForesights: number;
  arithmeticCheckOk: boolean;
}

/**
 * Recorre la libreta calculando altura de instrumento y cotas (§ 6.7).
 *
 * La regla, por fila y en este orden:
 *   1. si tiene L.Ad → cota = AI_vigente − L.Ad   (consume la AI anterior)
 *   2. si tiene L.At → AI_vigente = cota + L.At   (genera la armada siguiente)
 *
 * El orden importa: en la fila de un punto de cambio, la L.Ad viene de la
 * armada anterior y la L.At abre la siguiente. Invertirlo desplaza todas las
 * cotas del recorrido.
 *
 * Los puntos `intermediate` consumen la AI vigente pero no la actualizan ni
 * propagan cota, y quedan fuera de la comprobación aritmética.
 */
export function computeRun(
  readings: ReadingInput[],
  startElevation: number,
): RunComputation {
  let instrumentHeight: number | null = null;
  let currentElevation = startElevation;

  let sumBacksights = 0;
  let sumForesights = 0;

  const computed: ComputedReading[] = readings.map((reading) => {
    const isIntermediate = reading.pointType === "intermediate";
    let rowElevation = currentElevation;
    let rowInstrumentHeight: number | null = null;

    // 1. Consumir la AI vigente.
    if (reading.foresight != null && instrumentHeight != null) {
      rowElevation = instrumentHeight - reading.foresight;
      if (!isIntermediate) {
        sumForesights += reading.foresight;
        currentElevation = rowElevation;
      }
    }

    // 2. Generar la AI de la armada siguiente. Un intermedio nunca lo hace.
    if (!isIntermediate && reading.backsight != null) {
      rowInstrumentHeight = rowElevation + reading.backsight;
      instrumentHeight = rowInstrumentHeight;
      sumBacksights += reading.backsight;
    }

    return {
      ...reading,
      instrumentHeight: rowInstrumentHeight,
      elevationCalculated: rowElevation,
      elevationCorrected: rowElevation,
      correctionApplied: 0,
    };
  });

  const heightDifference = currentElevation - startElevation;

  // ΣL.At − ΣL.Ad = cota_final − cota_inicial. Solo valida la aritmética de
  // gabinete: cuadra igual con el nivel descolimado. La calidad la juzga el
  // error de cierre contra la tolerancia.
  const arithmeticCheckOk =
    Math.abs(sumBacksights - sumForesights - heightDifference) <
    ARITHMETIC_EPSILON;

  return {
    readings: computed,
    heightDifference,
    sumBacksights,
    sumForesights,
    arithmeticCheckOk,
  };
}
```

- [ ] **Step 4: Ejecutar los tests**

Run: `npm run test -- leveling`
Expected: PASS, todos.

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add src/lib/calculations/leveling.ts src/lib/calculations/leveling.test.ts
git commit -m "feat: calculo base de nivelacion y comprobacion aritmetica"
```

---

### Task 5: Cierre, tolerancia y corrección proporcional

**Files:**
- Modify: `src/lib/calculations/leveling.ts`
- Modify: `src/lib/calculations/leveling.test.ts`

**Interfaces:**
- Consumes: `computeRun` (Task 4), `levelingTolerance` (Task 3)
- Produces: `applyProportionalCorrection(readings: ComputedReading[], errorMm: number, totalDistanceKm: number): ComputedReading[]`, y `computeLeveling(input: LevelingInput): LevelingResult` (sin la rama de ida/vuelta todavía — se completa en Task 6)

- [ ] **Step 1: Escribir los tests que fallan**

Añadir a `src/lib/calculations/leveling.test.ts`:

```typescript
import { computeLeveling, applyProportionalCorrection } from "./leveling";
import type { LevelingInput } from "@/types/leveling";

const CLOSED_INPUT: LevelingInput = {
  type: "closed",
  startElevation: 100.0,
  endElevation: null,
  order: "tercer_orden",
  totalDistanceKm: 0.9,
  forward: CLOSED_RUN,
  return: null,
};

describe("computeLeveling — cerrada", () => {
  const result = computeLeveling(CLOSED_INPUT);

  it("cierra contra el BM de partida: error −8.0 mm", () => {
    expect(result.closureErrorMm).toBeCloseTo(-8.0, 4);
  });

  it("compara contra K·√D = 12·√0.9 = 11.38 mm y cumple", () => {
    expect(result.toleranceMm).toBeCloseTo(11.3842, 3);
    expect(result.meetsTolerance).toBe(true);
  });

  it("distribuye la corrección proporcional a la distancia acumulada", () => {
    // Corr_i = −error × (d_i / D) → +8.0 mm × (d_i / 0.9)
    const corrections = result.forward.readings.map((x) =>
      Number((x.correctionApplied * 1000).toFixed(2)),
    );
    expect(corrections).toEqual([0.0, 2.67, 5.33, 8.0]);
  });

  it("hace que el BM final cierre exacto tras la corrección", () => {
    const last = result.forward.readings.at(-1);
    expect(last?.elevationCorrected).toBeCloseTo(100.0, 6);
  });
});

describe("computeLeveling — enlace", () => {
  // BM-A 250.000 → BM-B conocida 248.700. Cadena que llega a 248.685: −15 mm.
  const linkRun: ReadingInput[] = [
    r("BM-A", "bm", 1.0, null, 0.0),
    r("PC-1", "pc", 2.0, 1.5, 1.1),
    r("BM-B", "bm", null, 2.815, 2.2),
  ];
  const result = computeLeveling({
    type: "link",
    startElevation: 250.0,
    endElevation: 248.7,
    order: "tercer_orden",
    totalDistanceKm: 2.2,
    forward: linkRun,
    return: null,
  });

  it("cierra contra la cota conocida del BM de llegada", () => {
    // 250 + 1.0 = 251.0 AI; PC-1 = 249.5; AI = 251.5; BM-B = 248.685
    expect(result.forward.readings.at(-1)?.elevationCalculated).toBeCloseTo(
      248.685,
      6,
    );
    expect(result.closureErrorMm).toBeCloseTo(-15.0, 4);
  });

  it("cumple tercer orden: 15 mm < 12·√2.2 = 17.8 mm", () => {
    expect(result.toleranceMm).toBeCloseTo(17.7986, 3);
    expect(result.meetsTolerance).toBe(true);
  });

  it("corrige hasta hacer coincidir el BM-B con su cota conocida", () => {
    expect(result.forward.readings.at(-1)?.elevationCorrected).toBeCloseTo(
      248.7,
      6,
    );
  });
});

describe("computeLeveling — abierta sin control", () => {
  const result = computeLeveling({
    type: "open",
    startElevation: 500.0,
    endElevation: null,
    order: "tercer_orden",
    totalDistanceKm: 0.4,
    forward: [
      r("BM-X", "bm", 1.325, null, 0.0),
      r("PC-1", "pc", 0.654, 0.876, 0.08),
      r("PC-2", "pc", null, 1.987, 0.16),
    ],
    return: null,
  });

  it("no calcula error de cierre ni tolerancia", () => {
    expect(result.closureErrorMm).toBeNull();
    expect(result.toleranceMm).toBeNull();
    expect(result.meetsTolerance).toBeNull();
  });

  it("no aplica corrección: cota corregida = cota calculada", () => {
    for (const reading of result.forward.readings) {
      expect(reading.elevationCorrected).toBeCloseTo(
        reading.elevationCalculated,
        6,
      );
      expect(reading.correctionApplied).toBe(0);
    }
  });
});

describe("computeLeveling — fuera de tolerancia", () => {
  it("marca meetsTolerance false y NO corrige", () => {
    const result = computeLeveling({
      ...CLOSED_INPUT,
      order: "primer_orden", // tolerancia 3·√0.9 = 2.85 mm < 8.0 mm de error
    });
    expect(result.meetsTolerance).toBe(false);
    // Sin cumplir tolerancia el trabajo se repite; no se compensa.
    expect(result.forward.readings.at(-1)?.correctionApplied).toBe(0);
  });
});
```

- [ ] **Step 2: Ejecutar los tests para verificar que fallan**

Run: `npm run test -- leveling`
Expected: FAIL — `computeLeveling is not a function`.

- [ ] **Step 3: Implementar**

Añadir a `src/lib/calculations/leveling.ts`:

```typescript
import { levelingTolerance } from "./tolerances";
import type { LevelingInput, LevelingResult, RunResult } from "@/types/leveling";

/**
 * Corrección proporcional a la distancia acumulada (§ 6.8):
 *
 *   Corr_i = −Error × (d_acum_i / D_total)
 *
 * La suma de correcciones iguala −Error, de modo que el punto final cierra
 * exactamente contra su cota conocida. Los puntos `intermediate` heredan la
 * corrección de la armada de la que cuelgan: se interpola por su propia
 * distancia acumulada, que es la de esa armada.
 */
export function applyProportionalCorrection(
  readings: ComputedReading[],
  errorMm: number,
  totalDistanceKm: number,
): ComputedReading[] {
  if (totalDistanceKm <= 0) {
    return readings.map((reading) => ({
      ...reading,
      elevationCorrected: reading.elevationCalculated,
      correctionApplied: 0,
    }));
  }

  const errorM = errorMm / 1000;

  return readings.map((reading) => {
    const accumulated = reading.distanceAccumulatedKm ?? 0;
    const correction = -errorM * (accumulated / totalDistanceKm);
    return {
      ...reading,
      correctionApplied: correction,
      elevationCorrected: reading.elevationCalculated + correction,
    };
  });
}

/** Cota conocida contra la que cierra el recorrido, o null si no cierra. */
function knownClosingElevation(input: LevelingInput): number | null {
  if (input.type === "closed") return input.startElevation;
  if (input.type === "link") return input.endElevation;
  return null; // `open` no cierra contra nada.
}

/**
 * Calcula un proceso de nivelación completo (§ 6.7-6.9).
 *
 * `open` se calcula pero no se cierra ni se corrige: sin un segundo punto de
 * cota conocida no hay forma de detectar el error acumulado.
 */
export function computeLeveling(input: LevelingInput): LevelingResult {
  const forward = computeRun(input.forward, input.startElevation);
  const known = knownClosingElevation(input);

  let closureErrorMm: number | null = null;
  let toleranceMm: number | null = null;
  let meetsTolerance: boolean | null = null;
  let readings = forward.readings;

  if (known != null) {
    const lastElevation =
      forward.readings.at(-1)?.elevationCalculated ?? input.startElevation;
    closureErrorMm = (lastElevation - known) * 1000;
    toleranceMm = levelingTolerance(input.order, input.totalDistanceKm);
    meetsTolerance = Math.abs(closureErrorMm) <= toleranceMm;

    // Solo se compensa un trabajo que cumple la tolerancia. Si no cumple, se
    // repite el levantamiento (marco teórico § 8.1).
    if (meetsTolerance) {
      readings = applyProportionalCorrection(
        forward.readings,
        closureErrorMm,
        input.totalDistanceKm,
      );
    }
  }

  const forwardResult: RunResult = {
    readings,
    heightDifference: forward.heightDifference,
    errorMm: closureErrorMm,
  };

  return {
    forward: forwardResult,
    return: null,
    arithmeticCheckOk: forward.arithmeticCheckOk,
    sumBacksights: forward.sumBacksights,
    sumForesights: forward.sumForesights,
    closureErrorMm,
    toleranceMm,
    meetsTolerance,
    discrepancyMm: null,
    discrepancyToleranceMm: null,
    meetsDiscrepancy: null,
    adoptedHeightDifference: null,
  };
}
```

- [ ] **Step 4: Ejecutar los tests**

Run: `npm run test -- leveling`
Expected: PASS, todos.

- [ ] **Step 5: Commit**

```bash
git add src/lib/calculations/leveling.ts src/lib/calculations/leveling.test.ts
git commit -m "feat: cierre, tolerancia y correccion proporcional de nivelacion"
```

---

### Task 6: Ida y vuelta a nivel de sección

**Files:**
- Modify: `src/lib/calculations/leveling.ts`
- Modify: `src/lib/calculations/leveling.test.ts`

**Interfaces:**
- Consumes: `computeRun`, `computeLeveling` (Tasks 4-5)
- Produces: `computeLeveling` completo — rellena `return`, `discrepancyMm`, `discrepancyToleranceMm`, `meetsDiscrepancy`, `adoptedHeightDifference`

**Contexto que el implementador necesita:** los puntos de cambio de la vuelta **no son los mismos** de la ida y los recorridos suelen tener distinto número de armadas. No existe correspondencia tramo a tramo. El emparejamiento es a nivel de sección: se comparan los desniveles totales entre los BM extremos. Cualquier intento de aparear filas entre recorridos es un error de diseño.

- [ ] **Step 1: Escribir los tests que fallan**

Añadir a `src/lib/calculations/leveling.test.ts`:

```typescript
describe("computeLeveling — ida y vuelta", () => {
  // La vuelta es una medición INDEPENDIENTE: distintos puntos de cambio y
  // distinto número de armadas que la ida. Solo comparten los BM extremos.
  //   ida:    3 armadas, Δh = −0.008
  //   vuelta: 2 armadas, Δh = +0.010 (sentido opuesto)
  const returnRun: ReadingInput[] = [
    r("BM-1", "bm", 1.2, null, 0.0),
    r("PV-1", "pc", 1.6, 0.9, 0.45),
    r("BM-1", "bm", null, 1.89, 0.9),
  ];

  const result = computeLeveling({
    ...CLOSED_INPUT,
    return: returnRun,
  });

  it("calcula cada recorrido de forma independiente", () => {
    expect(result.forward.readings).toHaveLength(4);
    expect(result.return?.readings).toHaveLength(3);
  });

  it("obtiene el desnivel de sección de cada recorrido", () => {
    expect(result.forward.heightDifference).toBeCloseTo(-0.008, 6);
    expect(result.return?.heightDifference).toBeCloseTo(0.01, 6);
  });

  it("calcula la discrepancia entre recorridos", () => {
    // |Δh_ida − (−Δh_vuelta)| = |−0.008 + 0.010| = 0.002 m = 2.0 mm
    expect(result.discrepancyMm).toBeCloseTo(2.0, 4);
  });

  it("compara la discrepancia contra T·√2", () => {
    // 12·√0.9·√2 = 16.10 mm
    expect(result.discrepancyToleranceMm).toBeCloseTo(16.0997, 3);
    expect(result.meetsDiscrepancy).toBe(true);
  });

  it("adopta el desnivel promediado", () => {
    // (Δh_ida − Δh_vuelta) / 2 = (−0.008 − 0.010) / 2 = −0.009
    expect(result.adoptedHeightDifference).toBeCloseTo(-0.009, 6);
  });

  it("marca la discrepancia fuera de tolerancia con órdenes exigentes", () => {
    const strict = computeLeveling({
      ...CLOSED_INPUT,
      order: "primer_orden", // T·√2 = 3·√0.9·√2 = 4.02 mm
      return: [
        r("BM-1", "bm", 1.2, null, 0.0),
        r("BM-1", "bm", null, 1.17, 0.9),
      ], // Δh = +0.030 → discrepancia |−0.008 + 0.030| = 22 mm
      forward: CLOSED_RUN,
    });
    expect(strict.discrepancyMm).toBeCloseTo(22.0, 4);
    expect(strict.meetsDiscrepancy).toBe(false);
  });
});
```

- [ ] **Step 2: Ejecutar los tests para verificar que fallan**

Run: `npm run test -- leveling`
Expected: FAIL — `result.return` es null y `discrepancyMm` es null.

- [ ] **Step 3: Implementar la rama de ida y vuelta**

En `computeLeveling`, sustituir el bloque `return { ... }` final por:

```typescript
  // --- Ida y vuelta (§ 6.9, enmendado — decisión #2) -----------------------
  // Los recorridos son mediciones independientes: distintos puntos de cambio
  // y, con frecuencia, distinto número de armadas. El emparejamiento es a
  // nivel de SECCIÓN (entre los BM extremos), nunca tramo a tramo.
  let returnResult: RunResult | null = null;
  let discrepancyMm: number | null = null;
  let discrepancyToleranceMm: number | null = null;
  let meetsDiscrepancy: boolean | null = null;
  let adoptedHeightDifference: number | null = null;

  if (input.return != null && input.return.length > 0) {
    // La vuelta parte de la cota conocida del extremo al que llegó la ida.
    const returnStart = known ?? input.startElevation;
    const back = computeRun(input.return, returnStart);

    discrepancyMm =
      Math.abs(forward.heightDifference + back.heightDifference) * 1000;
    discrepancyToleranceMm =
      levelingTolerance(input.order, input.totalDistanceKm) * Math.SQRT2;
    meetsDiscrepancy = discrepancyMm <= discrepancyToleranceMm;
    adoptedHeightDifference =
      (forward.heightDifference - back.heightDifference) / 2;

    returnResult = {
      readings: back.readings,
      heightDifference: back.heightDifference,
      errorMm: null,
    };
  }

  return {
    forward: forwardResult,
    return: returnResult,
    arithmeticCheckOk: forward.arithmeticCheckOk,
    sumBacksights: forward.sumBacksights,
    sumForesights: forward.sumForesights,
    closureErrorMm,
    toleranceMm,
    meetsTolerance,
    discrepancyMm,
    discrepancyToleranceMm,
    meetsDiscrepancy,
    adoptedHeightDifference,
  };
```

- [ ] **Step 4: Ejecutar los tests**

Run: `npm run test -- leveling`
Expected: PASS, todos.

- [ ] **Step 5: Ejecutar la suite completa y typecheck**

Run: `npm run test && npm run typecheck`
Expected: exit 0 en ambos.

- [ ] **Step 6: Commit**

```bash
git add src/lib/calculations/leveling.ts src/lib/calculations/leveling.test.ts
git commit -m "feat: ida y vuelta de nivelacion a nivel de seccion"
```

---

### Task 7: Validadores

**Files:**
- Create: `src/lib/validators/leveling.ts`
- Create: `src/lib/validators/leveling.test.ts`

**Interfaces:**
- Consumes: `ReadingInput`, `LevelingResult` de `@/types/leveling`; `PrecisionOrder` de `@/types/project`; el tipo de resultado de validación existente en `src/lib/validators/result.ts`
- Produces: `validateReading(reading: ReadingInput, order: PrecisionOrder): ValidationIssue[]`, `validateLevelingClosure(result: LevelingResult): ValidationIssue[]`

- [ ] **Step 1: Leer el contrato de validación existente**

Run: `cat src/lib/validators/result.ts && sed -n '1,50p' src/lib/validators/polygonal.ts`
Expected: entender la forma de `ValidationIssue` / `ValidationResult` que ya usa el proyecto. **Usar esa forma**, no inventar una nueva.

- [ ] **Step 2: Escribir los tests que fallan**

Crear `src/lib/validators/leveling.test.ts`. Adaptar la forma del resultado a lo visto en el Step 1:

```typescript
import { describe, it, expect } from "vitest";
import { validateReading, validateLevelingClosure } from "./leveling";
import type { ReadingInput } from "@/types/leveling";

function reading(over: Partial<ReadingInput> = {}): ReadingInput {
  return {
    pointCode: "PC-1",
    pointType: "pc",
    backsight: 1.5,
    foresight: 1.2,
    distanceM: 40,
    distanceAccumulatedKm: 0.1,
    ...over,
  };
}

describe("validateReading — capa de captura (§ 5.1)", () => {
  it("acepta una lectura normal", () => {
    expect(validateReading(reading(), "tercer_orden")).toHaveLength(0);
  });

  it("rechaza lectura de mira negativa", () => {
    const issues = validateReading(reading({ backsight: -0.1 }), "tercer_orden");
    expect(issues.some((i) => i.severity === "error")).toBe(true);
  });

  it("rechaza lectura de mira mayor que 4.000 m", () => {
    const issues = validateReading(reading({ foresight: 4.5 }), "tercer_orden");
    expect(issues.some((i) => i.severity === "error")).toBe(true);
  });

  it("advierte cuando L.At y L.Ad son exactamente iguales", () => {
    const issues = validateReading(
      reading({ backsight: 1.5, foresight: 1.5 }),
      "tercer_orden",
    );
    expect(issues.some((i) => i.severity === "warning")).toBe(true);
  });

  it("rechaza un punto sin código", () => {
    const issues = validateReading(reading({ pointCode: "" }), "tercer_orden");
    expect(issues.some((i) => i.severity === "error")).toBe(true);
  });
});

describe("validateLevelingClosure — capa de cierre (§ 5.2)", () => {
  const base = {
    forward: { readings: [], heightDifference: 0, errorMm: null },
    return: null,
    arithmeticCheckOk: true,
    sumBacksights: 0,
    sumForesights: 0,
    closureErrorMm: 5,
    toleranceMm: 11.4,
    meetsTolerance: true,
    discrepancyMm: null,
    discrepancyToleranceMm: null,
    meetsDiscrepancy: null,
    adoptedHeightDifference: null,
  };

  it("no reporta nada cuando todo cumple", () => {
    expect(validateLevelingClosure(base)).toHaveLength(0);
  });

  it("marca error crítico si la comprobación aritmética no cuadra", () => {
    const issues = validateLevelingClosure({ ...base, arithmeticCheckOk: false });
    expect(issues.some((i) => i.severity === "error")).toBe(true);
  });

  it("marca error si el cierre excede la tolerancia", () => {
    const issues = validateLevelingClosure({
      ...base,
      closureErrorMm: 20,
      meetsTolerance: false,
    });
    expect(issues.some((i) => i.severity === "error")).toBe(true);
  });

  it("advierte (no bloquea) si la discrepancia ida/vuelta excede T·√2", () => {
    const issues = validateLevelingClosure({
      ...base,
      discrepancyMm: 22,
      discrepancyToleranceMm: 16.1,
      meetsDiscrepancy: false,
    });
    expect(issues.some((i) => i.severity === "warning")).toBe(true);
    expect(issues.some((i) => i.severity === "error")).toBe(false);
  });
});
```

- [ ] **Step 3: Ejecutar los tests para verificar que fallan**

Run: `npm run test -- validators/leveling`
Expected: FAIL — no existe el módulo.

- [ ] **Step 4: Implementar**

Crear `src/lib/validators/leveling.ts`. Ajustar la forma de `ValidationIssue` a la del proyecto (Step 1):

```typescript
// Validación del proceso de nivelación por capas (PRD § 5.1 y § 5.2).
// Funciones puras: se reutilizan tal cual en el cliente y en el servidor.

import type { LevelingResult, ReadingInput } from "@/types/leveling";
import type { PrecisionOrder } from "@/types/project";

export type Severity = "error" | "warning";

export interface ValidationIssue {
  field: string;
  severity: Severity;
  message: string;
}

/** Rango físico de una lectura de mira, en metros (§ 5.1). */
const MIN_READING = 0;
const MAX_READING = 4;

/**
 * Diferencia máxima admisible entre la distancia de la visual atrás y la de
 * adelante, en metros. El equilibrado de visuales cancela de una vez la
 * curvatura terrestre, la refracción atmosférica y el error de colimación.
 * Es calidad de campo, no error de captura: se reporta como advertencia.
 */
const SIGHT_BALANCE_LIMIT_M: Record<PrecisionOrder, number> = {
  primer_orden: 2,
  segundo_orden: 3,
  tercer_orden: 4,
  ordinario: 6,
};

/** Capa 1 — validación en captura, por fila de la libreta (§ 5.1). */
export function validateReading(
  reading: ReadingInput,
  order: PrecisionOrder,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (reading.pointCode.trim() === "") {
    issues.push({
      field: "pointCode",
      severity: "error",
      message: "El punto necesita un código.",
    });
  }

  for (const field of ["backsight", "foresight"] as const) {
    const value = reading[field];
    if (value == null) continue;
    if (value < MIN_READING || value > MAX_READING) {
      issues.push({
        field,
        severity: "error",
        message: `La lectura de mira debe estar entre ${MIN_READING.toFixed(3)} y ${MAX_READING.toFixed(3)} m.`,
      });
    }
  }

  if (
    reading.backsight != null &&
    reading.foresight != null &&
    reading.backsight === reading.foresight
  ) {
    issues.push({
      field: "foresight",
      severity: "warning",
      message: "Lectura atrás y adelante idénticas: posible error de anotación.",
    });
  }

  return issues;
}

/** Capa 2 — validación de cierre, sobre el resultado completo (§ 5.2). */
export function validateLevelingClosure(
  result: LevelingResult,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (!result.arithmeticCheckOk) {
    issues.push({
      field: "arithmetic",
      severity: "error",
      message:
        "La comprobación aritmética no cuadra: ΣL.Atrás − ΣL.Adelante no coincide con el desnivel total.",
    });
  }

  if (result.meetsTolerance === false) {
    issues.push({
      field: "closure",
      severity: "error",
      message: `El error de cierre (${result.closureErrorMm?.toFixed(1)} mm) supera la tolerancia (${result.toleranceMm?.toFixed(1)} mm).`,
    });
  }

  if (result.meetsDiscrepancy === false) {
    issues.push({
      field: "discrepancy",
      severity: "warning",
      message: `La discrepancia entre ida y vuelta (${result.discrepancyMm?.toFixed(1)} mm) supera T·√2 (${result.discrepancyToleranceMm?.toFixed(1)} mm).`,
    });
  }

  return issues;
}

export { SIGHT_BALANCE_LIMIT_M };
```

- [ ] **Step 5: Ejecutar los tests**

Run: `npm run test -- validators/leveling`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/validators/leveling.ts src/lib/validators/leveling.test.ts
git commit -m "feat: validadores de captura y cierre de nivelacion"
```

---

### Task 8: Queries y Server Actions

**Files:**
- Modify: `src/lib/supabase/queries.ts`
- Create: `src/app/(app)/projects/[id]/leveling/new/actions.ts`
- Create: `src/app/(app)/projects/[id]/leveling/[pid]/actions.ts`

**Interfaces:**
- Consumes: `computeLeveling` (Tasks 4-6), tipos de `@/types/leveling`, `createClient` de `@/lib/supabase/server`
- Produces:
  - `getLevelingProcesses(projectId: string): Promise<LevelingProcess[]>`
  - `getLevelingProcess(pid: string): Promise<{ process: LevelingProcess; readings: LevelingReading[] } | null>`
  - `createLevelingProcessAction(formData: FormData)` — inserta `draft` y redirige
  - `saveLevelingProcessAction(payload: SaveLevelingPayload): Promise<ActionResult>`
  - `closeLevelingProcessAction(payload: CloseLevelingPayload): Promise<ActionResult>`

- [ ] **Step 1: Leer los patrones existentes**

Run: `cat "src/app/(app)/projects/[id]/polygonal/[pid]/actions.ts" && cat "src/app/(app)/projects/[id]/polygonal/new/actions.ts" && grep -n "getPolygonalProcess" src/lib/supabase/queries.ts`
Expected: entender cómo se estructuran `ActionResult`, la verificación de proceso cerrado, el borrado-e-inserción de filas hijas y el `revalidatePath`. **Replicar esa estructura.**

- [ ] **Step 2: Añadir las queries**

En `src/lib/supabase/queries.ts`, siguiendo la forma de `getPolygonalProcesses`:

```typescript
export async function getLevelingProcesses(
  projectId: string,
): Promise<LevelingProcess[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("leveling_processes")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });
  return (data ?? []) as LevelingProcess[];
}

export async function getLevelingProcess(
  pid: string,
): Promise<{ process: LevelingProcess; readings: LevelingReading[] } | null> {
  const supabase = await createClient();
  const { data: process } = await supabase
    .from("leveling_processes")
    .select("*")
    .eq("id", pid)
    .maybeSingle();
  if (!process) return null;

  const { data: readings } = await supabase
    .from("leveling_readings")
    .select("*")
    .eq("process_id", pid)
    .order("run_type", { ascending: true })
    .order("reading_order", { ascending: true });

  return {
    process: process as LevelingProcess,
    readings: (readings ?? []) as LevelingReading[],
  };
}
```

- [ ] **Step 3: Escribir la acción de creación**

Crear `src/app/(app)/projects/[id]/leveling/new/actions.ts` replicando la forma de `polygonal/new/actions.ts`: leer el `FormData`, validar los requeridos, insertar en `leveling_processes` con `status: "draft"`, y `redirect` al editor. En error, `redirect` con `?error=` como hace la acción de poligonal.

- [ ] **Step 4: Escribir las acciones del editor**

Crear `src/app/(app)/projects/[id]/leveling/[pid]/actions.ts`:

```typescript
"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { computeLeveling } from "@/lib/calculations/leveling";
import type {
  LevelingInput,
  LevelingType,
  PointType,
  ReadingInput,
} from "@/types/leveling";
import type { PrecisionOrder } from "@/types/project";

export interface ActionResult {
  ok: boolean;
  error?: string;
}

export interface ReadingDraft {
  pointCode: string;
  pointType: PointType;
  backsight: number | null;
  foresight: number | null;
  distanceM: number | null;
  distanceAccumulatedKm: number | null;
}

export interface SaveLevelingPayload {
  processId: string;
  name: string;
  type: LevelingType;
  startBmCode: string;
  startBmElevation: number;
  endBmCode: string | null;
  endBmElevation: number | null;
  hasReturnRun: boolean;
  totalDistanceKm: number;
  notes: string | null;
  forward: ReadingDraft[];
  return: ReadingDraft[];
}

export interface CloseLevelingPayload {
  processId: string;
  asRejected: boolean;
}
```

La acción `saveLevelingProcessAction` debe, en este orden:

1. Cargar el proceso y su proyecto; si no existe → `{ ok: false, error: "..." }`.
2. **Rechazar si `status` es `closed` o `rejected`** — antes de cualquier escritura.
3. Reconstruir el `LevelingInput` desde el payload y **recalcular en el servidor** con `computeLeveling`. No confiar en resultados enviados por el cliente: una sola fuente de verdad para lo persistido.
4. `UPDATE` sobre `leveling_processes` con config + `closure_error_mm`, `tolerance_mm`, `meets_tolerance`, `forward_error_mm`, `return_error_mm`, `discrepancy_mm`, `total_distance_km`, y `status: "calculated"`.
5. Borrar las `leveling_readings` del proceso e insertar las nuevas con sus columnas calculadas (`instrument_height`, `elevation_calculated`, `elevation_corrected`, `correction_applied`) y su `run_type` y `reading_order`.
6. `revalidatePath` de la ruta del editor y del hub del proyecto.

La acción `closeLevelingProcessAction` debe cargar el proceso, rechazar si ya está cerrado, y hacer `UPDATE` con `status: asRejected ? "rejected" : "closed"`, `closed_at: new Date().toISOString()` y `closed_by` con el id del usuario de la sesión.

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add src/lib/supabase/queries.ts "src/app/(app)/projects/[id]/leveling"
git commit -m "feat: queries y server actions de nivelacion"
```

---

### Task 9: Selector de BM y campos de configuración

**Files:**
- Create: `src/components/leveling/bm-selector.tsx`
- Create: `src/components/leveling/leveling-config-fields.tsx`
- Create: `src/app/(app)/projects/[id]/leveling/new/page.tsx`

**Interfaces:**
- Consumes: `ReferencePoint` de `@/types/project`; `createLevelingProcessAction` (Task 8); componentes de `@/components/design-system`
- Produces: `<BmSelector points={ReferencePoint[]} codeName={string} elevationName={string} label={string} />`, `<LevelingConfigFields points={ReferencePoint[]} defaultValues={...} />`

- [ ] **Step 1: Leer los patrones de formulario existentes**

Run: `cat src/components/polygonal/polygonal-config-fields.tsx && ls src/components/design-system/`
Expected: identificar los componentes disponibles (Input, Select, Button, etc.) y cómo se componen los campos. **Usar el design system existente; no crear componentes nuevos** (decisión #12).

- [ ] **Step 2: Implementar `bm-selector.tsx`**

Client component. Un `<select>` con los `reference_points` de tipo `bm` más una opción «Otro (entrada libre)». Al elegir un BM del catálogo, rellena los inputs de código y cota y los deja de solo lectura; al elegir «Otro», los habilita vacíos. Los inputs conservan sus `name` para que el `FormData` funcione igual en ambos modos.

La razón de existir de este componente: una cota de partida errónea desplaza **todas** las cotas por igual y el cierre sigue dando exacto, así que el error es invisible al control de cierre. Documentarlo en un comentario del archivo.

- [ ] **Step 3: Implementar `leveling-config-fields.tsx`**

Campos: nombre, tipo (`LEVELING_TYPE_LABELS`), BM de partida (`BmSelector`), BM de llegada (`BmSelector`, visible solo si el tipo es `link`), toggle de ida y vuelta, y distancia total en km. El orden de precisión se hereda del proyecto y se muestra como dato, editable según el `§4.4`.

- [ ] **Step 4: Implementar `new/page.tsx`**

Server component: carga el proyecto y sus `reference_points` de tipo `bm`, renderiza un `<form action={createLevelingProcessAction}>` con `<LevelingConfigFields>` y el botón de crear. Muestra el `?error=` si viene en `searchParams` (recordar: en Next 16 `searchParams` es una Promise).

- [ ] **Step 5: Verificar en el navegador**

Run: `rm -rf .next && npm run dev`

Navegar a `/projects/<id>/leveling/new`. Verificar: el selector lista los BMs del proyecto; elegir uno rellena código y cota; «Otro» los deja editables; el campo de BM de llegada aparece solo con tipo «De enlace»; crear el proceso redirige al editor.

**Nota:** el `rm -rf .next` no es opcional si antes se corrió `npm run build` — mezclar ambos hace que rutas estáticas se resuelvan como dinámicas y devuelvan 404 (aprendizaje de la Fase 3).

- [ ] **Step 6: Typecheck y commit**

Run: `npm run typecheck && npm run lint`

```bash
git add src/components/leveling "src/app/(app)/projects/[id]/leveling/new"
git commit -m "feat: formulario de creacion de proceso de nivelacion"
```

---

### Task 10: Libreta con cálculo en vivo

**Files:**
- Create: `src/components/leveling/readings-table.tsx`
- Create: `src/components/leveling/leveling-editor.tsx`
- Create: `src/app/(app)/projects/[id]/leveling/[pid]/page.tsx`

**Interfaces:**
- Consumes: `computeLeveling` (Tasks 4-6), `validateReading` (Task 7), `saveLevelingProcessAction` (Task 8), tipos de `@/types/leveling`
- Produces: `<ReadingsTable readings={ReadingDraft[]} computed={ComputedReading[]} onChange={...} readOnly={boolean} />`, `<LevelingEditor process={LevelingProcess} readings={LevelingReading[]} points={ReferencePoint[]} order={PrecisionOrder} />`

- [ ] **Step 1: Leer el editor de poligonal como referencia estructural**

Run: `cat src/components/polygonal/polygonal-editor.tsx && cat src/components/polygonal/stations-table.tsx`
Expected: ver cómo se maneja el estado local, cómo se llama al cálculo en vivo en render (no en `useEffect` — `react-hooks/set-state-in-effect` es **error de lint** en este proyecto), y cómo se invoca el Server Action dentro de `startTransition`.

- [ ] **Step 2: Implementar `readings-table.tsx`**

Columnas: **Punto · Tipo · L.Atrás · AI · L.Adelante · Dist (m) · Dist acum (km) · Cota · Cota corregida**.

Reglas de presentación:
- La **AI se muestra solo en las filas que llevan L.At** — es un valor por armada, no por fila.
- Las filas `intermediate` muestran la celda de L.At deshabilitada: por definición no la tienen.
- La primera fila (`bm`) no admite L.Ad; la última fila de `closed`/`link` (`bm`) no admite L.At.
- Las celdas con `ValidationIssue` de severidad `error` llevan borde rojo; las de `warning`, borde amarillo.
- Botón «+ Agregar lectura» al pie, que añade una fila `pc`.

- [ ] **Step 3: Implementar `leveling-editor.tsx`**

Client component. Estado: config + `forward: ReadingDraft[]` + `return: ReadingDraft[]`. En cada render deriva el resultado con `computeLeveling` — **cálculo en vivo, sin botón «Calcular»** y sin `useEffect`. «Guardar» llama a `saveLevelingProcessAction` dentro de `startTransition`. Si el proceso está `closed`/`rejected`, todo se renderiza en modo solo lectura.

El tipo `open` no muestra panel de cierre; el toggle de ida y vuelta controla si se renderiza el segundo recorrido.

- [ ] **Step 4: Implementar `[pid]/page.tsx`**

Server component: `getLevelingProcess(pid)`; si es null → `notFound()`. Carga el proyecto (para el `precision_order`) y los `reference_points`. Renderiza `<LevelingEditor>`.

- [ ] **Step 5: Verificar en el navegador**

Run: `rm -rf .next && npm run dev`

Verificar: al escribir lecturas, AI y cotas se actualizan **en vivo**; la AI aparece solo en filas con L.At; un punto marcado como intermedio no altera las cotas de los puntos siguientes; una lectura de 5.0 marca la celda en rojo; «Guardar» persiste y al recargar los datos siguen ahí.

- [ ] **Step 6: Typecheck, lint y commit**

Run: `npm run typecheck && npm run lint`

```bash
git add src/components/leveling "src/app/(app)/projects/[id]/leveling/[pid]"
git commit -m "feat: editor de nivelacion con libreta y calculo en vivo"
```

---

### Task 11: Panel de resultados y tabs de recorrido

**Files:**
- Create: `src/components/leveling/results-panel.tsx`
- Create: `src/components/leveling/run-tabs.tsx`
- Modify: `src/components/leveling/leveling-editor.tsx`

**Interfaces:**
- Consumes: `LevelingResult` (Tasks 4-6), `validateLevelingClosure` (Task 7), `StatusIndicator` del design system
- Produces: `<ResultsPanel result={LevelingResult} type={LevelingType} />`, `<RunTabs active={RunType} onChange={...} />`

- [ ] **Step 1: Implementar `results-panel.tsx`**

Cuatro bloques, en este orden:

1. **Comprobación aritmética:** `ΣL.At = x · ΣL.Ad = y · diferencia = z` contra el desnivel total. Si `arithmeticCheckOk` es false → banner rojo crítico con el mensaje del validador.
2. **Cierre:** error en mm, tolerancia `K·√D` en mm, y `StatusIndicator` verde/rojo. Oculto por completo si el tipo es `open`.
3. **Ida y vuelta:** desnivel de cada recorrido, discrepancia, `T·√2` y su indicador. Solo si `has_return_run`.
4. **Cotas corregidas:** la tabla del `§4.4`, con distancia acumulada, corrección en mm y cota corregida por punto.

- [ ] **Step 2: Implementar `run-tabs.tsx`**

Dos tabs, «Ida» y «Vuelta», con `RUN_TYPE_LABELS`. Solo se renderiza si `has_return_run` es true. Sigue el patrón de tabs del hub del proyecto (enlaces o botones según cómo esté resuelto allí — verificar antes).

- [ ] **Step 3: Integrar ambos en el editor**

- [ ] **Step 4: Verificar en el navegador**

Verificar con el fixture del Task 5 (BM-1 100.000, tres armadas, 0.9 km, tercer orden): el panel debe mostrar error −8.0 mm, tolerancia 11.4 mm, indicador verde, y el BM final con cota corregida 100.0000.

- [ ] **Step 5: Typecheck, lint y commit**

```bash
git add src/components/leveling
git commit -m "feat: panel de resultados y tabs de recorrido de nivelacion"
```

---

### Task 12: Cierre del proceso e integración con el hub

**Files:**
- Create: `src/components/leveling/close-process-dialog.tsx`
- Modify: `src/components/projects/new-process-selector.tsx`
- Modify: la tab Procesos del hub (localizar con el Step 1)
- Modify: `src/components/leveling/leveling-editor.tsx`

**Interfaces:**
- Consumes: `closeLevelingProcessAction` (Task 8), `getLevelingProcesses` (Task 8), `ProcessCard` existente
- Produces: `<CloseProcessDialog processId={string} canClose={boolean} meetsTolerance={boolean | null} />`

- [ ] **Step 1: Localizar la tab Procesos y el `process-card`**

Run: `grep -rn "getPolygonalProcesses\|ProcessCard" src/app src/components | head -20`
Expected: los archivos que listan procesos en el hub. Ahí hay que sumar los de nivelación.

- [ ] **Step 2: Implementar `close-process-dialog.tsx`**

Réplica del diálogo de poligonal: confirma el cierre, advierte de que es **irreversible**, y si `meetsTolerance` es false ofrece cerrar como **Rechazado**. Llama a `closeLevelingProcessAction` dentro de `startTransition`.

- [ ] **Step 3: Activar «Nivelación» en el selector**

En `src/components/projects/new-process-selector.tsx`, reemplazar el `<Button disabled>` de «Nivelación» por un `<Link href={`/projects/${projectId}/leveling/new`}>` con `buttonClasses({ variant: "secondary" })`, igual que el de Poligonal. Actualizar el comentario del encabezado del archivo: ya no es cierto que «en la Fase 3 solo el proceso poligonal está disponible».

- [ ] **Step 4: Listar los procesos de nivelación en el hub**

En la tab Procesos, cargar también `getLevelingProcesses(projectId)` y renderizar sus tarjetas junto a las de poligonal, agrupadas igual en «En Progreso» y «Cerrados». El enlace de cada tarjeta apunta a `/projects/[id]/leveling/[pid]`.

- [ ] **Step 5: Verificar el flujo completo en el navegador**

Verificar: «+ Nuevo Proceso» → «Nivelación» ya no está deshabilitado; crear, capturar, guardar y cerrar un proceso; el proceso cerrado se muestra en solo lectura y aparece bajo «Cerrados» en el hub.

- [ ] **Step 6: Typecheck, lint y commit**

```bash
git add src/components
git commit -m "feat: cierre de proceso de nivelacion e integracion con el hub"
```

---

### Task 13: Verificación end-to-end y cierre de fase

**Files:**
- Modify: `docs/tecnica/README.md`
- Modify: `docs/manual/README.md`
- Modify: `src/app/(app)/manual/` (el mismo texto, maquetado)
- Modify: `docs/method.md`, `docs/prds/README.md`, `docs/prds/03-nivelacion.md`

- [ ] **Step 1: Verificación completa**

Run: `npm run typecheck && npm run lint && npm run test && npm run build`
Expected: exit 0 en los cuatro.

- [ ] **Step 2: Recorrer los criterios de aceptación a-p**

Abrir `docs/prds/03-nivelacion.md` y verificar uno por uno los 16 criterios de la tabla, anotando el resultado. Los que no se puedan verificar en el navegador (o, p — RLS e inmutabilidad) se prueban así:

- **(o) RLS:** con la sesión de un usuario, pedir `/projects/<id de otro usuario>/leveling/<pid>` → debe dar 404.
- **(p) Inmutabilidad vía REST:** con el JWT del dueño, `UPDATE` directo sobre un proceso `closed` por la API REST de Supabase → debe fallar con `restrict_violation`. El trigger es la única defensa real: la clave publicable es pública por diseño.

- [ ] **Step 3: Regenerar las capturas del manual**

Run: `node docs/manual/capturas.mjs`

- [ ] **Step 4: Actualizar la documentación de handoff**

Mover la sección de nivelación de «Módulos pendientes» al cuerpo del manual, **en los dos sitios** (`docs/manual/README.md` y `src/app/(app)/manual/`) — el texto vive duplicado y no hay generación automática. En `docs/tecnica/README.md`: actualizar el estado de fases, la tabla de pruebas y la deuda técnica.

**Escribir la documentación al final, no en paralelo:** el cierre del plan de estabilización dejó registrado que documentar un sistema mientras otras tareas lo siguen cambiando deja texto obsoleto atrás, y que hicieron falta dos rondas de revisión para cazarlo todo.

- [ ] **Step 5: Anotar los aprendizajes de la fase**

En `docs/method.md`, añadir una entrada «Cierre Fase 4 — Módulo Nivelación (fecha)» con: divergencias del PRD-de-fase respecto a lo implementado, y aprendizajes a llevar a la Fase 5. Candidatos ya conocidos: la enmienda del `§6.9`, el hallazgo de que el marco teórico no es consistente (segunda vez que ocurre), y el `point_type` que el `§3.2` no modelaba.

- [ ] **Step 6: Marcar la fase como cerrada**

Cambiar el estado a `cerrada` en `docs/method.md`, `docs/prds/README.md` y el encabezado de `docs/prds/03-nivelacion.md` (añadiendo la fecha de cierre).

- [ ] **Step 7: Commit de cierre**

```bash
git add docs src/app public/manual
git commit -m "docs: cerrar fase 4 — modulo nivelacion"
```

---

## Notas para quien ejecute

- **El orden consumir → generar** dentro de cada fila de la libreta es el error más fácil de cometer y el más difícil de detectar a ojo: desplaza todas las cotas del recorrido de forma coherente. El test del Task 4 («consume la AI anterior antes de generar la nueva») es el que lo protege.
- **No aparear filas entre ida y vuelta.** Los recorridos tienen distintos puntos de cambio y distinto número de armadas. Cualquier código que haga `forward[i]` contra `return[i]` está mal por diseño.
- **Los fixtures del plan están verificados aritméticamente.** Si un test falla, sospechar de la implementación antes que del fixture — pero verificar a mano antes de cambiar cualquiera de los dos.
- **`react-hooks/set-state-in-effect` es error de lint** en este proyecto. El estado derivado se calcula en render, nunca en un `useEffect`.
- **`rm -rf .next` antes de `npm run dev`** si antes se corrió `npm run build`.
