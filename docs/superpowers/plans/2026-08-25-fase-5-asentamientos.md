# Fase 5 — Control de Asentamientos: plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir el módulo de control de asentamientos —lugar, catálogo de puntos, visitas periódicas, cálculos de asentamiento/velocidad/alertas y panel de análisis— e introducir el lugar (`sites`) como entidad transversal a los tres módulos.

**Architecture:** Funciones puras en `src/lib/calculations/settlement.ts` y `src/lib/validators/settlement.ts` (sin React, sin Supabase), cubiertas por Vitest con fixtures verificados a mano. La UI son Client Components con cálculo en vivo; los Server Actions **recalculan y revalidan** en el servidor antes de persistir, de modo que lo guardado nunca depende de lo que envía el cliente. El acceso se controla con RLS por join hasta `projects` y la inmutabilidad con triggers en la base.

**Tech Stack:** Next.js 16 (App Router) · React 19 · TypeScript · Supabase (PostgreSQL + Auth) · Tailwind CSS v4 · Vitest

**Spec:** [`docs/prds/04-asentamientos.md`](../../prds/04-asentamientos.md) — el PRD-de-fase, con los hallazgos de la verificación del marco teórico y las 15 decisiones cerradas. El PRD del producto es [`PRD-TopoField.md`](../../../PRD-TopoField.md).

## Global Constraints

Copiados del PRD-de-fase y de `CLAUDE.md`. **Aplican a todas las tareas.**

- **Idioma:** interfaz y mensajes en español (Colombia). Commits en español con prefijo `feat:`, `fix:`, `refactor:`, `docs:`.
- **Cálculos puros:** `src/lib/calculations/` y `src/lib/validators/` no importan React, hooks ni Supabase. Solo matemáticas y tipos.
- **Precisión:** coordenadas 3 decimales, cotas 4 decimales, asentamientos en mm con 1 decimal, velocidades con 2.
- **Un mes = 30.4375 días** (`365.25/12`), constante `DAYS_PER_MONTH`. Decisión #3.
- **Nada del marco teórico entra como fixture.** Sus velocidades y estados de alerta son incorrectos (hallazgos 2 y 3 del PRD). Todo fixture se construye a mano y se verifica.
- **Sin librerías de componentes ni de gráficas.** El design system es propio (`src/components/design-system/`), la gráfica es SVG escrito a mano.
- **Tolerancias y umbrales** viven en `src/lib/calculations/tolerances.ts`, nunca hardcodeados en componentes.
- **Procesos cerrados son inmutables.** Ningún `UPDATE` sobre una visita o un lugar cerrado.
- **Verificar contra la base de datos, no contra la interfaz** (aprendizaje Fase 4). La UI puede mentir sobre lo que se guardó.
- **Al cambiar el contrato de una función, actualizar su JSDoc en el mismo commit** (aprendizaje Fase 4).
- Tras cada tarea con código: `npm run typecheck` y `npm test` en verde antes de commitear.
- Tras modificar el schema: regenerar tipos con
  `npx supabase gen types typescript --local 2>/dev/null > src/types/database.ts`

## Estructura de archivos

**Cálculo y validación (puro, testeado):**
| Archivo | Responsabilidad |
|---|---|
| `src/lib/calculations/tolerances.ts` (modificar) | `DAYS_PER_MONTH` y presets de umbrales por tipo de estructura |
| `src/lib/calculations/settlement.ts` (crear) | Asentamientos, velocidad, diferenciales, distorsión, aceleración, `classifyAlert` |
| `src/lib/validators/settlement.ts` (crear) | Capas de captura y cierre |

**Tipos:**
| `src/types/site.ts` (crear) | Literales, etiquetas y fila tipada de `sites` |
| `src/types/settlement.ts` (crear) | Literales, filas tipadas y contratos de entrada/resultado |

**Datos:**
| `supabase/migrations/<ts>_sites_and_settlement.sql` (crear) | 4 tablas, `site_id`, backfill, RLS, triggers |
| `src/lib/supabase/queries.ts` (modificar) | Queries de lugares, visitas e histórico; KPI de los 3 módulos |

**Rutas y Server Actions:**
| `src/app/(app)/projects/[id]/sites/new/` | Alta de lugar |
| `src/app/(app)/projects/[id]/sites/[siteId]/` | Editor de lugar: puntos y umbrales |
| `src/app/(app)/projects/[id]/settlement/[siteId]/` | Panel del control y lista de visitas |
| `src/app/(app)/projects/[id]/settlement/[siteId]/visits/[visitId]/` | Editor de visita |

**Componentes** (`src/components/settlement/`): `site-form`, `points-catalog`, `thresholds-fields`, `visits-list`, `visit-editor`, `readings-table`, `settlement-chart`, `differentials-table`, `analysis-panel`, `close-visit-dialog`.

**Design system:** `status-indicator.tsx` (4 niveles + forma), `src/lib/design/pairings.ts` (parejas nuevas).

---

## Task 1: Migración — lugar, tablas del módulo, `site_id`

**Files:**
- Create: `supabase/migrations/<timestamp>_sites_and_settlement.sql`
- Modify: `src/types/database.ts` (regenerado, no se edita a mano)

**Interfaces:**
- Consumes: `public.set_updated_at()`, `public.reject_update_on_closed_process()`, `public.reject_delete_on_closed_process()` (existentes desde Fases 2–3).
- Produces: tablas `sites`, `settlement_points`, `settlement_visits`, `settlement_readings`; columna `site_id NOT NULL` en `polygonal_processes` y `leveling_processes`.

**Contexto:** el patrón exacto de RLS y triggers está en `supabase/migrations/20260812020455_leveling.sql`. **Ojo:** `reject_write_on_closed_process_reading()` de esa migración consulta `leveling_processes` por nombre — no es reutilizable. Hay que escribir una función análoga para `settlement_readings`.

- [ ] **Step 1: Crear el archivo de migración**

Generar el nombre con timestamp UTC actual (formato `YYYYMMDDHHMMSS`). El contenido completo:

```sql
-- ============================================================================
-- Lugar (sites) y módulo de control de asentamientos — Fase 5
-- ============================================================================
-- Enmienda el § 3.2 del PRD principal, según docs/prds/04-asentamientos.md:
--   · `sites` (decisión #1 y #6): el lugar es transversal a los tres módulos y
--     absorbe lo que el PRD llamaba `settlement_systems`. Esa tabla no se crea.
--   · Los defaults de acumulado son los de EDIFICIO (25/50/75), no los de presa
--     (10/25/50) que traía el § 3.2 contradiciendo su propio marco teórico.
--   · `angular_distortion_limit` es INT (el X de 1/X), no TEXT '1/500': así no
--     hay que parsear una cadena en cada comparación numérica.
--   · `settlement_visits` (decisión #4): antes `settlement_campaigns`.
--   · northing/easting en los puntos (decisión #7): la distorsión angular
--     necesita la distancia horizontal y sin coordenadas habría que capturarla
--     par por par.
--   · Los UNIQUE expresan reglas del dominio. Sin ellos un doble envío duplica
--     lecturas y el asentamiento parcial se calcula contra la fila equivocada.
-- ============================================================================

create table public.sites (
  id                        uuid primary key default gen_random_uuid(),
  project_id                uuid not null references public.projects(id) on delete cascade,
  name                      text not null,
  description               text,
  structure_type            text not null
                              check (structure_type in ('edificio', 'presa', 'terraplen', 'otro')),
  -- Umbrales de alerta. Preset por structure_type, siempre editables.
  velocity_caution          decimal(6,2) not null default 2.0,   -- mm/mes
  velocity_alert            decimal(6,2) not null default 5.0,
  velocity_alarm            decimal(6,2) not null default 10.0,
  accumulated_caution       decimal(8,2) not null default 25.0,  -- mm
  accumulated_alert         decimal(8,2) not null default 50.0,
  accumulated_alarm         decimal(8,2) not null default 75.0,
  angular_distortion_limit  int not null default 500,            -- el X de 1/X
  status                    text not null default 'active'
                              check (status in ('active', 'closed')),
  closed_at                 timestamptz,
  closed_by                 text,
  notes                     text,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);

create table public.settlement_points (
  id                    uuid primary key default gen_random_uuid(),
  site_id               uuid not null references public.sites(id) on delete cascade,
  code                  text not null,
  location_description  text not null,
  northing              decimal(12,3),
  easting               decimal(12,3),
  initial_elevation     decimal(10,4),
  created_at            timestamptz not null default now(),
  unique (site_id, code)
);

create table public.settlement_visits (
  id                  uuid primary key default gen_random_uuid(),
  site_id             uuid not null references public.sites(id) on delete cascade,
  visit_number        int not null,          -- 0 = línea base
  date                date not null,
  operator            text,
  equipment           text,
  weather_conditions  text,
  closure_error_mm    decimal(8,1),
  notes               text,
  status              text not null default 'draft'
                        check (status in ('draft', 'calculated', 'closed')),
  closed_at           timestamptz,
  closed_by           text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (site_id, visit_number)
);

create table public.settlement_readings (
  id                      uuid primary key default gen_random_uuid(),
  visit_id                uuid not null references public.settlement_visits(id) on delete cascade,
  point_id                uuid not null references public.settlement_points(id) on delete cascade,
  elevation               decimal(10,4) not null,
  -- Calculados. Se persisten para que los informes de Fase 6 lean sin recalcular.
  partial_settlement      decimal(8,1),   -- mm, vs visita anterior
  accumulated_settlement  decimal(8,1),   -- mm, vs C0
  velocity                decimal(8,2),   -- mm/mes
  alert_status            text not null default 'normal'
                            check (alert_status in ('normal', 'caution', 'alert', 'alarm')),
  created_at              timestamptz not null default now(),
  unique (visit_id, point_id)
);

create index sites_project_id_idx on public.sites(project_id);
create index settlement_points_site_id_idx on public.settlement_points(site_id);
create index settlement_visits_site_id_idx on public.settlement_visits(site_id);
create index settlement_readings_visit_id_idx on public.settlement_readings(visit_id);
create index settlement_readings_point_id_idx on public.settlement_readings(point_id);

-- --- site_id en los módulos existentes (decisión #1) -------------------------
-- Se añade nullable, se rellena con un lugar «General» por proyecto que tenga
-- procesos, y solo entonces se impone NOT NULL. Así la migración es segura en
-- local y en la nube desplegada, sin vaciar nada.

alter table public.polygonal_processes add column site_id uuid references public.sites(id);
alter table public.leveling_processes  add column site_id uuid references public.sites(id);

insert into public.sites (project_id, name, description, structure_type)
select distinct p.id, 'General',
       'Lugar creado automáticamente al introducir la entidad en la Fase 5.',
       'otro'
from public.projects p
where exists (select 1 from public.polygonal_processes pp where pp.project_id = p.id)
   or exists (select 1 from public.leveling_processes  lp where lp.project_id = p.id);

update public.polygonal_processes pp
set site_id = s.id
from public.sites s
where s.project_id = pp.project_id and s.name = 'General' and pp.site_id is null;

update public.leveling_processes lp
set site_id = s.id
from public.sites s
where s.project_id = lp.project_id and s.name = 'General' and lp.site_id is null;

alter table public.polygonal_processes alter column site_id set not null;
alter table public.leveling_processes  alter column site_id set not null;

create index polygonal_processes_site_id_idx on public.polygonal_processes(site_id);
create index leveling_processes_site_id_idx  on public.leveling_processes(site_id);

-- --- Row Level Security -----------------------------------------------------
alter table public.sites enable row level security;
alter table public.settlement_points enable row level security;
alter table public.settlement_visits enable row level security;
alter table public.settlement_readings enable row level security;

-- sites: CRUD vía proyecto.
create policy "sites_select_via_project" on public.sites
  for select using (
    exists (select 1 from public.projects
            where projects.id = sites.project_id and projects.user_id = auth.uid())
  );
create policy "sites_insert_via_project" on public.sites
  for insert with check (
    exists (select 1 from public.projects
            where projects.id = sites.project_id and projects.user_id = auth.uid())
  );
create policy "sites_update_via_project" on public.sites
  for update using (
    exists (select 1 from public.projects
            where projects.id = sites.project_id and projects.user_id = auth.uid())
  );
create policy "sites_delete_via_project" on public.sites
  for delete using (
    exists (select 1 from public.projects
            where projects.id = sites.project_id and projects.user_id = auth.uid())
  );

-- settlement_points: join de dos niveles (point -> site -> project -> user).
create policy "settlement_points_select_via_project" on public.settlement_points
  for select using (
    exists (select 1 from public.sites
            join public.projects on projects.id = sites.project_id
            where sites.id = settlement_points.site_id and projects.user_id = auth.uid())
  );
create policy "settlement_points_insert_via_project" on public.settlement_points
  for insert with check (
    exists (select 1 from public.sites
            join public.projects on projects.id = sites.project_id
            where sites.id = settlement_points.site_id and projects.user_id = auth.uid())
  );
create policy "settlement_points_update_via_project" on public.settlement_points
  for update using (
    exists (select 1 from public.sites
            join public.projects on projects.id = sites.project_id
            where sites.id = settlement_points.site_id and projects.user_id = auth.uid())
  );
create policy "settlement_points_delete_via_project" on public.settlement_points
  for delete using (
    exists (select 1 from public.sites
            join public.projects on projects.id = sites.project_id
            where sites.id = settlement_points.site_id and projects.user_id = auth.uid())
  );

-- settlement_visits: mismo join de dos niveles.
create policy "settlement_visits_select_via_project" on public.settlement_visits
  for select using (
    exists (select 1 from public.sites
            join public.projects on projects.id = sites.project_id
            where sites.id = settlement_visits.site_id and projects.user_id = auth.uid())
  );
create policy "settlement_visits_insert_via_project" on public.settlement_visits
  for insert with check (
    exists (select 1 from public.sites
            join public.projects on projects.id = sites.project_id
            where sites.id = settlement_visits.site_id and projects.user_id = auth.uid())
  );
create policy "settlement_visits_update_via_project" on public.settlement_visits
  for update using (
    exists (select 1 from public.sites
            join public.projects on projects.id = sites.project_id
            where sites.id = settlement_visits.site_id and projects.user_id = auth.uid())
  );
create policy "settlement_visits_delete_via_project" on public.settlement_visits
  for delete using (
    exists (select 1 from public.sites
            join public.projects on projects.id = sites.project_id
            where sites.id = settlement_visits.site_id and projects.user_id = auth.uid())
  );

-- settlement_readings: join de tres niveles (reading -> visit -> site -> project).
create policy "settlement_readings_select_via_project" on public.settlement_readings
  for select using (
    exists (select 1 from public.settlement_visits
            join public.sites on sites.id = settlement_visits.site_id
            join public.projects on projects.id = sites.project_id
            where settlement_visits.id = settlement_readings.visit_id
              and projects.user_id = auth.uid())
  );
create policy "settlement_readings_insert_via_project" on public.settlement_readings
  for insert with check (
    exists (select 1 from public.settlement_visits
            join public.sites on sites.id = settlement_visits.site_id
            join public.projects on projects.id = sites.project_id
            where settlement_visits.id = settlement_readings.visit_id
              and projects.user_id = auth.uid())
  );
create policy "settlement_readings_update_via_project" on public.settlement_readings
  for update using (
    exists (select 1 from public.settlement_visits
            join public.sites on sites.id = settlement_visits.site_id
            join public.projects on projects.id = sites.project_id
            where settlement_visits.id = settlement_readings.visit_id
              and projects.user_id = auth.uid())
  );
create policy "settlement_readings_delete_via_project" on public.settlement_readings
  for delete using (
    exists (select 1 from public.settlement_visits
            join public.sites on sites.id = settlement_visits.site_id
            join public.projects on projects.id = sites.project_id
            where settlement_visits.id = settlement_readings.visit_id
              and projects.user_id = auth.uid())
  );

-- --- Triggers ---------------------------------------------------------------
create trigger sites_set_updated_at
  before update on public.sites
  for each row execute function public.set_updated_at();

create trigger settlement_visits_set_updated_at
  before update on public.settlement_visits
  for each row execute function public.set_updated_at();

-- Inmutabilidad. La función genérica solo mira old.status, así que sirve tal
-- cual: 'closed' está en el conjunto que bloquea. `settlement_visits` no tiene
-- 'rejected' (una visita se cierra o no; no hay tolerancia que rechazar) y eso
-- no afecta al comportamiento.
create trigger settlement_visits_reject_update_on_closed
  before update on public.settlement_visits
  for each row execute function public.reject_update_on_closed_process();

create trigger settlement_visits_reject_delete_when_closed
  before delete on public.settlement_visits
  for each row execute function public.reject_delete_on_closed_process();

create trigger sites_reject_update_on_closed
  before update on public.sites
  for each row execute function public.reject_update_on_closed_process();

create trigger sites_reject_delete_when_closed
  before delete on public.sites
  for each row execute function public.reject_delete_on_closed_process();

-- Las lecturas son el dato de campo de la visita. De nada sirve blindar la
-- cabecera si las mediciones pueden reescribirse.
--
-- Función propia y no la de nivelación: aquella consulta `leveling_processes`
-- por nombre, así que no es reutilizable pese a hacer lo mismo.
create or replace function public.reject_write_on_closed_visit_reading()
returns trigger
language plpgsql
as $$
declare
  target_visit uuid := coalesce(new.visit_id, old.visit_id);
  visit_status text;
begin
  select status into visit_status
  from public.settlement_visits
  where id = target_visit;

  if visit_status = 'closed' then
    raise exception
      'La visita % está cerrada; sus lecturas son inmutables.', target_visit
      using errcode = 'restrict_violation';
  end if;

  return coalesce(new, old);
end;
$$;

create trigger settlement_readings_reject_write_when_closed
  before insert or update or delete on public.settlement_readings
  for each row execute function public.reject_write_on_closed_visit_reading();
```

- [ ] **Step 2: Aplicar la migración en local**

```bash
npx supabase db reset
```

Esperado: aplica todas las migraciones sin error. Si falla en el backfill, revisar que existan proyectos con procesos.

- [ ] **Step 3: Verificar el resultado contra la base, no contra la consola**

```bash
npx supabase db query "select count(*) filter (where site_id is null) as huerfanos_pol from polygonal_processes; select count(*) filter (where site_id is null) as huerfanos_lev from leveling_processes; select name, structure_type from sites;"
```

Esperado: `huerfanos_pol` = 0, `huerfanos_lev` = 0, y un lugar `General` por proyecto que tuviera procesos.

- [ ] **Step 4: Verificar que el trigger de inmutabilidad funciona**

La prueba va dentro de una transacción que se revierte, por dos razones: cada
sentencia se comprueba por separado (dos UPDATE en una misma llamada abortarían
juntos y no se sabría cuál falló), y el lugar de prueba no queda en la base — un
lugar cerrado no se puede borrar después, precisamente por el trigger que
estamos probando.

Primero, que la transición al cierre **sí** se permite:

```bash
npx supabase db query "begin; insert into sites (project_id, name, structure_type) select id, 'TMP-TRIGGER', 'otro' from projects limit 1; update sites set status='closed' where name='TMP-TRIGGER'; select status from sites where name='TMP-TRIGGER'; rollback;"
```

Esperado: devuelve `closed`, sin error.

Después, que un cambio posterior **no** se permite:

```bash
npx supabase db query "begin; insert into sites (project_id, name, structure_type) select id, 'TMP-TRIGGER', 'otro' from projects limit 1; update sites set status='closed' where name='TMP-TRIGGER'; update sites set name='CAMBIADO' where name='TMP-TRIGGER'; rollback;"
```

Esperado: falla con `restrict_violation` y el mensaje de proceso cerrado. El
`rollback` deja la base como estaba en ambos casos.

Repetir la segunda prueba con `settlement_visits` para comprobar su trigger:

```bash
npx supabase db query "begin; insert into sites (project_id, name, structure_type) select id, 'TMP-V', 'otro' from projects limit 1; insert into settlement_visits (site_id, visit_number, date) select id, 0, '2025-01-15' from sites where name='TMP-V'; update settlement_visits set status='closed' where site_id = (select id from sites where name='TMP-V'); update settlement_visits set date='2025-02-15' where site_id = (select id from sites where name='TMP-V'); rollback;"
```

Esperado: falla en el último UPDATE con `restrict_violation`.

- [ ] **Step 5: Regenerar tipos**

```bash
npx supabase gen types typescript --local 2>/dev/null > src/types/database.ts
```

- [ ] **Step 6: Typecheck**

```bash
npm run typecheck
```

Esperado: falla en los sitios donde el código existente inserta en `polygonal_processes`/`leveling_processes` sin `site_id`. **Esto es esperado y se arregla en la Task 2.** Anotar los archivos que fallan.

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations src/types/database.ts
git commit -m "feat: tablas de sitio y control de asentamientos con site_id transversal"
```

---

## Task 2: Tipos de dominio y reparación del typecheck

**Files:**
- Create: `src/types/site.ts`
- Create: `src/types/settlement.ts`
- Modify: los archivos que la Task 1 dejó rotos (inserciones sin `site_id`)

**Interfaces:**
- Consumes: `Tables<>` de `src/types/database.ts`.
- Produces: `Site`, `StructureType`, `SiteStatus`, `SettlementPoint`, `SettlementVisit`, `SettlementReading`, `VisitStatus`, `AlertLevel`, `PointInput`, `VisitInput`, `ReadingInput`, `ComputedReading`, `VisitResult`, `SettlementHistory`, `DifferentialPair`.

- [ ] **Step 1: Crear `src/types/site.ts`**

```typescript
// Tipos de dominio del lugar (`sites`) — la entidad transversal introducida en
// la Fase 5. Literales de los CHECK del schema, etiquetas en español y la fila
// tipada. Ver docs/prds/04-asentamientos.md, decisiones #1 y #6.

import type { Tables } from "./database";

export const STRUCTURE_TYPES = [
  "edificio",
  "presa",
  "terraplen",
  "otro",
] as const;
export type StructureType = (typeof STRUCTURE_TYPES)[number];

export const SITE_STATUSES = ["active", "closed"] as const;
export type SiteStatus = (typeof SITE_STATUSES)[number];

export type Site = Omit<Tables<"sites">, "structure_type" | "status"> & {
  structure_type: StructureType;
  status: SiteStatus;
};

export const STRUCTURE_TYPE_LABELS: Record<StructureType, string> = {
  edificio: "Edificio",
  presa: "Presa",
  terraplen: "Terraplén",
  otro: "Otro",
};

export const SITE_STATUS_LABELS: Record<SiteStatus, string> = {
  active: "Activo",
  closed: "Cerrado",
};
```

- [ ] **Step 2: Crear `src/types/settlement.ts`**

```typescript
// Tipos de dominio del control de asentamientos: literales de los CHECK del
// schema, filas tipadas y los contratos de entrada y resultado de
// src/lib/calculations/settlement.ts.

import type { Tables } from "./database";

export const VISIT_STATUSES = ["draft", "calculated", "closed"] as const;
export type VisitStatus = (typeof VISIT_STATUSES)[number];

/** Niveles del semáforo (§ 6.11). El orden es significativo: peor gana. */
export const ALERT_LEVELS = ["normal", "caution", "alert", "alarm"] as const;
export type AlertLevel = (typeof ALERT_LEVELS)[number];

// --- Filas tipadas ---

export type SettlementPoint = Tables<"settlement_points">;

export type SettlementVisit = Omit<Tables<"settlement_visits">, "status"> & {
  status: VisitStatus;
};

export type SettlementReading = Omit<
  Tables<"settlement_readings">,
  "alert_status"
> & {
  alert_status: AlertLevel;
};

// --- Contratos de cálculo ---

/** Umbrales de un lugar, ya desnormalizados para el motor de cálculo. */
export interface Thresholds {
  velocityCaution: number;
  velocityAlert: number;
  velocityAlarm: number;
  accumulatedCaution: number;
  accumulatedAlert: number;
  accumulatedAlarm: number;
  /** El X de 1/X. */
  angularDistortionLimit: number;
}

/** Un punto del catálogo, con lo que el cálculo necesita de él. */
export interface PointInput {
  id: string;
  code: string;
  northing: number | null;
  easting: number | null;
  /** Cota C0, la línea base contra la que se mide el acumulado. */
  initialElevation: number | null;
}

/**
 * Una lectura de campo: la cota medida de un punto en una visita.
 *
 * OJO: `src/types/leveling.ts` exporta otro `ReadingInput` con forma distinta
 * (lecturas de mira atrás/adelante). Los dos nombres coexisten porque cada uno
 * es el natural en su módulo, pero un archivo que necesite ambos debe
 * renombrar en el import:
 * `import type { ReadingInput as LevelingReadingInput } from "@/types/leveling"`.
 */
export interface ReadingInput {
  pointId: string;
  elevation: number;
}

/** Una visita con sus lecturas, tal como entra al motor. */
export interface VisitInput {
  id: string;
  visitNumber: number;
  /** Fecha de la visita en formato ISO `YYYY-MM-DD`. */
  date: string;
  readings: ReadingInput[];
}

/** Resultado por punto dentro de una visita. */
export interface ComputedReading {
  pointId: string;
  elevation: number;
  /** mm vs la visita anterior. Null en la línea base. */
  partialSettlement: number | null;
  /** mm vs C0. Null si el punto no tiene C0. */
  accumulatedSettlement: number | null;
  /** mm/mes. Null en la línea base o si Δt = 0. */
  velocity: number | null;
  alertStatus: AlertLevel;
}

export interface VisitResult {
  visitId: string;
  visitNumber: number;
  date: string;
  readings: ComputedReading[];
  /** El peor nivel de alerta de la visita. */
  worstAlert: AlertLevel;
}

/** Un par de puntos con su asentamiento diferencial y su distorsión. */
export interface DifferentialPair {
  pointIdA: string;
  pointIdB: string;
  /** mm, siempre positivo. */
  differentialMm: number;
  /** Distancia horizontal en m. */
  distanceM: number;
  /**
   * El X de 1/X. `Infinity` cuando el diferencial es 0: dos puntos que se
   * asientan igual no tienen distorsión entre sí.
   */
  distortionInverse: number;
  exceedsLimit: boolean;
}

/** Tendencia de la velocidad entre las dos últimas visitas de un punto. */
export type Trend = "converging" | "accelerating";

export interface SettlementHistory {
  visits: VisitResult[];
  differentials: DifferentialPair[];
  /**
   * Tendencia por punto. Un punto solo aparece si tiene al menos 2 velocidades
   * (es decir, 3 visitas): con menos no se afirma nada.
   */
  trends: Record<string, Trend>;
}

// --- Etiquetas en español ---

export const VISIT_STATUS_LABELS: Record<VisitStatus, string> = {
  draft: "Borrador",
  calculated: "Calculada",
  closed: "Cerrada",
};

export const ALERT_LEVEL_LABELS: Record<AlertLevel, string> = {
  normal: "Normal",
  caution: "Precaución",
  alert: "Alerta",
  alarm: "Alarma",
};
```

- [ ] **Step 3: Reparar las inserciones que la Task 1 rompió**

Los formularios de creación de poligonal y nivelación ahora deben enviar `site_id`. Para esta tarea basta con que compile: en cada `create*ProcessAction`, resolver el lugar del proyecto y usar el primero disponible. Las rutas de la Task 10 dan al usuario el control real sobre qué lugar elige.

En `src/app/(app)/projects/[id]/polygonal/new/actions.ts` y su equivalente de nivelación, antes del `insert`:

```typescript
// El lugar es obligatorio desde la Fase 5. Mientras el formulario no ofrezca
// elegirlo (Task 10), se usa el primero del proyecto.
const { data: site } = await supabase
  .from("sites")
  .select("id")
  .eq("project_id", projectId)
  .order("created_at", { ascending: true })
  .limit(1)
  .maybeSingle();
if (!site) {
  return { ok: false, error: "El proyecto no tiene ningún lugar definido." };
}
```

Y añadir `site_id: site.id` al objeto del `insert`.

- [ ] **Step 4: Typecheck**

```bash
npm run typecheck
```

Esperado: exit 0.

- [ ] **Step 5: Commit**

```bash
git add src/types src/app
git commit -m "feat: tipos de dominio de sitio y asentamientos"
```

---

## Task 3: Constantes — `DAYS_PER_MONTH` y presets de umbrales

**Files:**
- Modify: `src/lib/calculations/tolerances.ts`
- Modify: `src/lib/calculations/tolerances.test.ts`

**Interfaces:**
- Consumes: `StructureType` de `src/types/site.ts`, `Thresholds` de `src/types/settlement.ts`.
- Produces: `DAYS_PER_MONTH`, `SETTLEMENT_THRESHOLD_PRESETS`, `thresholdsFor(structureType)`.

- [ ] **Step 1: Escribir los tests que fallan**

Añadir al final de `src/lib/calculations/tolerances.test.ts`:

```typescript
import { DAYS_PER_MONTH, thresholdsFor } from "./tolerances";

describe("DAYS_PER_MONTH", () => {
  it("es el promedio del año gregoriano, 365.25/12", () => {
    expect(DAYS_PER_MONTH).toBeCloseTo(30.4375, 10);
  });
});

describe("thresholdsFor", () => {
  it("da al edificio los umbrales de edificio, no los de presa", () => {
    // El § 3.2 del PRD traía 10/25/50 —los de presa— como default para todos.
    const t = thresholdsFor("edificio");
    expect(t.accumulatedCaution).toBe(25);
    expect(t.accumulatedAlert).toBe(50);
    expect(t.accumulatedAlarm).toBe(75);
  });

  it("da a la presa sus propios umbrales, más estrictos", () => {
    const t = thresholdsFor("presa");
    expect(t.accumulatedCaution).toBe(10);
    expect(t.accumulatedAlert).toBe(25);
    expect(t.accumulatedAlarm).toBe(50);
  });

  it("usa los mismos umbrales de velocidad en todos los tipos", () => {
    for (const tipo of ["edificio", "presa", "terraplen", "otro"] as const) {
      const t = thresholdsFor(tipo);
      expect(t.velocityCaution).toBe(2);
      expect(t.velocityAlert).toBe(5);
      expect(t.velocityAlarm).toBe(10);
    }
  });

  it("usa 1/500 como límite de distorsión por defecto", () => {
    expect(thresholdsFor("edificio").angularDistortionLimit).toBe(500);
  });
});
```

- [ ] **Step 2: Ejecutar y verificar que falla**

```bash
npm test -- tolerances
```

Esperado: FAIL — `DAYS_PER_MONTH` y `thresholdsFor` no existen.

- [ ] **Step 3: Implementar**

Añadir al final de `src/lib/calculations/tolerances.ts`:

```typescript
import type { StructureType } from "@/types/site";
import type { Thresholds } from "@/types/settlement";

/**
 * Días de un mes, para convertir un intervalo entre visitas a meses.
 *
 * 365.25/12 — el promedio del año gregoriano. Se fija como constante porque el
 * marco teórico nunca define el mes y por eso calcula mal la velocidad: sus
 * tablas copian el asentamiento parcial en la columna de velocidad siempre que
 * el intervalo sea «un mes», ignorando que los meses tienen 28, 30 o 31 días
 * (verificado: 3 de los 7 intervalos del histórico de P-09 no coinciden con
 * ningún cálculo válido). Ver docs/prds/04-asentamientos.md, hallazgo 2 y
 * decisión #3.
 */
export const DAYS_PER_MONTH = 365.25 / 12;

/**
 * Umbrales de alerta por tipo de estructura (marco teórico § 4.1).
 *
 * El § 3.2 del PRD principal daba un único default (10/25/50) que son los
 * umbrales de PRESA, de modo que un edificio se clasificaba con criterio de
 * presa: habría marcado alarma a los 50 mm cuando su propio marco de referencia
 * sitúa ahí el umbral de alerta. El preset se aplica al elegir el tipo de
 * estructura y siempre queda editable (decisión #2).
 */
export const SETTLEMENT_THRESHOLD_PRESETS: Record<StructureType, Thresholds> = {
  edificio: {
    velocityCaution: 2,
    velocityAlert: 5,
    velocityAlarm: 10,
    accumulatedCaution: 25,
    accumulatedAlert: 50,
    accumulatedAlarm: 75,
    angularDistortionLimit: 500,
  },
  presa: {
    velocityCaution: 2,
    velocityAlert: 5,
    velocityAlarm: 10,
    accumulatedCaution: 10,
    accumulatedAlert: 25,
    accumulatedAlarm: 50,
    angularDistortionLimit: 500,
  },
  terraplen: {
    velocityCaution: 2,
    velocityAlert: 5,
    velocityAlarm: 10,
    accumulatedCaution: 25,
    accumulatedAlert: 50,
    accumulatedAlarm: 75,
    angularDistortionLimit: 500,
  },
  otro: {
    velocityCaution: 2,
    velocityAlert: 5,
    velocityAlarm: 10,
    accumulatedCaution: 25,
    accumulatedAlert: 50,
    accumulatedAlarm: 75,
    angularDistortionLimit: 500,
  },
};

/** Preset de umbrales del tipo de estructura dado. */
export function thresholdsFor(structureType: StructureType): Thresholds {
  return SETTLEMENT_THRESHOLD_PRESETS[structureType];
}
```

- [ ] **Step 4: Ejecutar los tests**

```bash
npm test -- tolerances
```

Esperado: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/calculations/tolerances.ts src/lib/calculations/tolerances.test.ts
git commit -m "feat: constante de mes y presets de umbrales por tipo de estructura"
```

---

## Task 4: Cálculo — asentamiento parcial, acumulado y velocidad

**Files:**
- Create: `src/lib/calculations/settlement.ts`
- Create: `src/lib/calculations/settlement.test.ts`

**Interfaces:**
- Consumes: `DAYS_PER_MONTH` de `tolerances.ts`; `PointInput`, `VisitInput`, `ComputedReading` de `@/types/settlement`.
- Produces: `daysBetween(isoA, isoB)`, `monthsBetween(isoA, isoB)`, `computeSettlements(points, visits)` → `VisitResult[]` (sin `alertStatus` definitivo todavía: se rellena en la Task 6; hasta entonces devuelve `"normal"`).

**Contexto crítico:** el marco teórico calcula mal la velocidad. Los tests de abajo usan **fixtures construidos a mano**, con los valores verificados por cálculo directo. No copiar números del documento.

- [ ] **Step 1: Escribir los tests que fallan**

Crear `src/lib/calculations/settlement.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import {
  computeSettlements,
  daysBetween,
  monthsBetween,
} from "./settlement";
import type { PointInput, VisitInput } from "@/types/settlement";

const P1: PointInput = {
  id: "p1",
  code: "P-01",
  northing: 0,
  easting: 0,
  initialElevation: 100.0,
};

/** Construye una visita con una sola lectura de P1. */
function visita(n: number, date: string, elevation: number): VisitInput {
  return {
    id: `v${n}`,
    visitNumber: n,
    date,
    readings: [{ pointId: "p1", elevation }],
  };
}

describe("daysBetween", () => {
  it("cuenta los días entre dos fechas ISO", () => {
    expect(daysBetween("2025-01-15", "2025-02-15")).toBe(31);
    expect(daysBetween("2025-02-15", "2025-03-15")).toBe(28);
    expect(daysBetween("2025-05-15", "2025-07-15")).toBe(61);
  });

  it("no se descuadra al cruzar un cambio de horario", () => {
    // Bogotá no tiene DST, pero el cálculo debe ser en UTC de todos modos.
    expect(daysBetween("2025-03-01", "2025-04-01")).toBe(31);
  });
});

describe("monthsBetween", () => {
  it("convierte días a meses con 30.4375 días por mes", () => {
    expect(monthsBetween("2025-01-15", "2025-02-15")).toBeCloseTo(
      31 / 30.4375,
      10,
    );
  });
});

describe("computeSettlements — parcial y acumulado", () => {
  it("la línea base no tiene parcial ni velocidad, y su acumulado es 0", () => {
    const r = computeSettlements([P1], [visita(0, "2025-01-15", 100.0)]);
    expect(r[0].readings[0].partialSettlement).toBeNull();
    expect(r[0].readings[0].velocity).toBeNull();
    expect(r[0].readings[0].accumulatedSettlement).toBe(0);
  });

  it("calcula parcial contra la visita anterior y acumulado contra C0", () => {
    const r = computeSettlements(
      [P1],
      [
        visita(0, "2025-01-15", 100.0),
        visita(1, "2025-02-15", 99.9942),
        visita(2, "2025-03-15", 99.9891),
      ],
    );
    // (99.9942 − 100.0) × 1000 = −5.8
    expect(r[1].readings[0].partialSettlement).toBeCloseTo(-5.8, 6);
    expect(r[1].readings[0].accumulatedSettlement).toBeCloseTo(-5.8, 6);
    // (99.9891 − 99.9942) × 1000 = −5.1 ; acumulado −10.9
    expect(r[2].readings[0].partialSettlement).toBeCloseTo(-5.1, 6);
    expect(r[2].readings[0].accumulatedSettlement).toBeCloseTo(-10.9, 6);
  });

  it("conserva el signo: un levantamiento es positivo, no valor absoluto", () => {
    const r = computeSettlements(
      [P1],
      [visita(0, "2025-01-15", 100.0), visita(1, "2025-02-15", 100.003)],
    );
    expect(r[1].readings[0].partialSettlement).toBeCloseTo(3.0, 6);
    expect(r[1].readings[0].accumulatedSettlement).toBeCloseTo(3.0, 6);
  });

  it("deja el acumulado en null si el punto no tiene C0", () => {
    const sinC0: PointInput = { ...P1, initialElevation: null };
    const r = computeSettlements(
      [sinC0],
      [visita(0, "2025-01-15", 100.0), visita(1, "2025-02-15", 99.99)],
    );
    expect(r[1].readings[0].accumulatedSettlement).toBeNull();
  });
});

describe("computeSettlements — velocidad", () => {
  // Los intervalos que el marco teórico calcula mal. Los valores esperados se
  // obtienen por cálculo directo: Δs / (días / 30.4375).
  it.each([
    { dias: 31, desde: "2025-01-15", hasta: "2025-02-15", ds: -5.8 },
    { dias: 28, desde: "2025-02-15", hasta: "2025-03-15", ds: -5.1 },
    { dias: 31, desde: "2025-03-15", hasta: "2025-04-15", ds: -3.9 },
    { dias: 30, desde: "2025-04-15", hasta: "2025-05-15", ds: -2.9 },
    { dias: 61, desde: "2025-05-15", hasta: "2025-07-15", ds: -1.9 },
    { dias: 92, desde: "2025-07-15", hasta: "2025-10-15", ds: -1.1 },
  ])(
    "con un intervalo de $dias días divide por los meses reales",
    ({ dias, desde, hasta, ds }) => {
      const cotaInicial = 100.0;
      const cotaFinal = cotaInicial + ds / 1000;
      const r = computeSettlements(
        [P1],
        [visita(0, desde, cotaInicial), visita(1, hasta, cotaFinal)],
      );
      const esperado = ds / (dias / (365.25 / 12));
      expect(r[1].readings[0].velocity).toBeCloseTo(esperado, 6);
    },
  );

  it("devuelve null —nunca Infinity ni NaN— si dos visitas caen el mismo día", () => {
    const r = computeSettlements(
      [P1],
      [visita(0, "2025-01-15", 100.0), visita(1, "2025-01-15", 99.99)],
    );
    const v = r[1].readings[0].velocity;
    expect(v).toBeNull();
    expect(Number.isNaN(v as unknown as number)).toBe(false);
  });
});

describe("computeSettlements — orden", () => {
  it("ordena por fecha, no por visit_number", () => {
    // Una visita numerada 2 pero fechada antes que la 1: el parcial de cada una
    // debe calcularse contra la que realmente la precede en el tiempo.
    const r = computeSettlements(
      [P1],
      [
        visita(0, "2025-01-15", 100.0),
        visita(2, "2025-03-15", 99.99),
        visita(1, "2025-02-15", 99.995),
      ],
    );
    // Ordenadas: v0 (100.0) → v1 (99.995) → v2 (99.99)
    expect(r.map((v) => v.visitNumber)).toEqual([0, 1, 2]);
    expect(r[1].readings[0].partialSettlement).toBeCloseTo(-5.0, 6);
    expect(r[2].readings[0].partialSettlement).toBeCloseTo(-5.0, 6);
  });

  it("un punto sin lectura en una visita no aparece en sus resultados", () => {
    const P2: PointInput = { ...P1, id: "p2", code: "P-02" };
    const visitas: VisitInput[] = [
      {
        id: "v0",
        visitNumber: 0,
        date: "2025-01-15",
        readings: [
          { pointId: "p1", elevation: 100.0 },
          { pointId: "p2", elevation: 100.0 },
        ],
      },
      {
        id: "v1",
        visitNumber: 1,
        date: "2025-02-15",
        readings: [{ pointId: "p1", elevation: 99.99 }],
      },
    ];
    const r = computeSettlements([P1, P2], visitas);
    expect(r[1].readings).toHaveLength(1);
    expect(r[1].readings[0].pointId).toBe("p1");
  });

  it("mide el parcial contra la última visita que sí midió ese punto", () => {
    // P1 se mide en v0 y v2, pero no en v1. Su parcial en v2 debe compararse
    // contra v0, no contra una visita donde no hay dato.
    const P2: PointInput = { ...P1, id: "p2", code: "P-02" };
    const visitas: VisitInput[] = [
      {
        id: "v0",
        visitNumber: 0,
        date: "2025-01-15",
        readings: [
          { pointId: "p1", elevation: 100.0 },
          { pointId: "p2", elevation: 100.0 },
        ],
      },
      {
        id: "v1",
        visitNumber: 1,
        date: "2025-02-15",
        readings: [{ pointId: "p2", elevation: 99.998 }],
      },
      {
        id: "v2",
        visitNumber: 2,
        date: "2025-03-15",
        readings: [{ pointId: "p1", elevation: 99.994 }],
      },
    ];
    const r = computeSettlements([P1, P2], visitas);
    const p1EnV2 = r[2].readings.find((x) => x.pointId === "p1")!;
    expect(p1EnV2.partialSettlement).toBeCloseTo(-6.0, 6);
    // Y la velocidad usa el intervalo real v0→v2 (59 días), no v1→v2.
    expect(p1EnV2.velocity).toBeCloseTo(-6.0 / (59 / (365.25 / 12)), 6);
  });
});
```

- [ ] **Step 2: Ejecutar y verificar que falla**

```bash
npm test -- settlement
```

Esperado: FAIL — el módulo no existe.

- [ ] **Step 3: Implementar**

Crear `src/lib/calculations/settlement.ts`:

```typescript
// Cálculos del control de asentamientos (PRD § 6.10 y § 6.11).
// Funciones puras de TypeScript: sin React, sin hooks, sin Supabase.
//
// Las fórmulas de asentamiento parcial, acumulado y distorsión angular se
// verificaron correctas contra los tres casos de estudio del marco teórico
// (35 valores, todos exactos). La VELOCIDAD no: el documento la calcula mal
// por no definir el mes. Ver docs/prds/04-asentamientos.md, hallazgo 2.

import { DAYS_PER_MONTH } from "./tolerances";
import type {
  AlertLevel,
  ComputedReading,
  PointInput,
  VisitInput,
  VisitResult,
} from "@/types/settlement";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Días de calendario entre dos fechas ISO (`YYYY-MM-DD`).
 *
 * Se parsea como UTC a propósito: `new Date("2025-01-15")` ya es UTC, pero
 * construir la fecha con componentes locales introduciría el desfase de la
 * zona horaria y podría devolver 30.958… días donde hay 31.
 */
export function daysBetween(isoFrom: string, isoTo: string): number {
  const from = Date.parse(`${isoFrom}T00:00:00Z`);
  const to = Date.parse(`${isoTo}T00:00:00Z`);
  return Math.round((to - from) / MS_PER_DAY);
}

/** Meses entre dos fechas ISO, con un mes = 30.4375 días (decisión #3). */
export function monthsBetween(isoFrom: string, isoTo: string): number {
  return daysBetween(isoFrom, isoTo) / DAYS_PER_MONTH;
}

/** Redondeo a `decimals` cifras, evitando el −0 que confunde en la UI. */
function round(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  const r = Math.round(value * factor) / factor;
  return Object.is(r, -0) ? 0 : r;
}

/**
 * Calcula el asentamiento parcial, el acumulado y la velocidad de cada punto en
 * cada visita.
 *
 * Las visitas se procesan **ordenadas por fecha**, no por `visitNumber`: el
 * número es una etiqueta del usuario y puede no coincidir con la cronología.
 *
 * El parcial y la velocidad de un punto se miden contra la última visita en la
 * que ese punto **sí tuvo lectura**, que no siempre es la visita inmediatamente
 * anterior — un punto puede quedar sin medir en una visita concreta.
 *
 * `alertStatus` sale como `"normal"` de esta función; lo asigna
 * `classifyReadings` una vez conocidos los umbrales del lugar.
 */
export function computeSettlements(
  points: PointInput[],
  visits: VisitInput[],
): VisitResult[] {
  const byId = new Map(points.map((p) => [p.id, p]));
  const ordered = [...visits].sort((a, b) => a.date.localeCompare(b.date));

  /** Última lectura conocida de cada punto: su cota y la fecha en que se midió. */
  const previous = new Map<string, { elevation: number; date: string }>();

  return ordered.map((visit) => {
    const readings: ComputedReading[] = [];

    for (const reading of visit.readings) {
      const point = byId.get(reading.pointId);
      if (!point) continue;

      const prev = previous.get(reading.pointId);

      let partialSettlement: number | null = null;
      let velocity: number | null = null;

      if (prev) {
        partialSettlement = round((reading.elevation - prev.elevation) * 1000, 1);
        const months = monthsBetween(prev.date, visit.date);
        // Dos visitas el mismo día no definen una velocidad. Devolver null y
        // no Infinity: un «NaN mm» en pantalla ya ocurrió en la Fase 4.
        //
        // La velocidad NO se redondea aquí. Redondear antes de clasificar
        // cambiaría el nivel de alerta: 1.996 mm/mes pasaría a 2.00 y saltaría
        // de `normal` a `caution` cruzando un umbral que en realidad no cruzó.
        // El redondeo pertenece a la persistencia (`velocity DECIMAL(8,2)`) y a
        // la presentación (`.toFixed(2)`), no al motor. El parcial y el
        // acumulado sí se redondean: son diferencias de cotas medidas, donde el
        // decimal extra es ruido de medición y no señal.
        velocity = months === 0 ? null : partialSettlement / months;
      }

      const accumulatedSettlement =
        point.initialElevation === null
          ? null
          : round((reading.elevation - point.initialElevation) * 1000, 1);

      readings.push({
        pointId: reading.pointId,
        elevation: reading.elevation,
        partialSettlement,
        accumulatedSettlement,
        velocity,
        alertStatus: "normal" as AlertLevel,
      });

      previous.set(reading.pointId, {
        elevation: reading.elevation,
        date: visit.date,
      });
    }

    return {
      visitId: visit.id,
      visitNumber: visit.visitNumber,
      date: visit.date,
      readings,
      worstAlert: "normal" as AlertLevel,
    };
  });
}
```

- [ ] **Step 4: Ejecutar los tests**

```bash
npm test -- settlement
```

Esperado: PASS, todos.

- [ ] **Step 5: Typecheck y commit**

```bash
npm run typecheck
git add src/lib/calculations/settlement.ts src/lib/calculations/settlement.test.ts
git commit -m "feat: asentamiento parcial, acumulado y velocidad con mes definido"
```

---

## Task 5: Cálculo — diferenciales y distorsión angular

**Files:**
- Modify: `src/lib/calculations/settlement.ts`
- Modify: `src/lib/calculations/settlement.test.ts`

**Interfaces:**
- Consumes: `PointInput`, `ComputedReading`, `DifferentialPair` de `@/types/settlement`.
- Produces: `horizontalDistance(a, b)`, `computeDifferentials(points, readings, limit)` → `DifferentialPair[]`.

- [ ] **Step 1: Escribir los tests que fallan**

Añadir a `src/lib/calculations/settlement.test.ts`:

```typescript
import { computeDifferentials, horizontalDistance } from "./settlement";
import type { ComputedReading, DifferentialPair } from "@/types/settlement";

/** Lectura ya calculada, para probar los diferenciales aisladamente. */
function lectura(
  pointId: string,
  accumulated: number | null,
): ComputedReading {
  return {
    pointId,
    elevation: 100,
    partialSettlement: null,
    accumulatedSettlement: accumulated,
    velocity: null,
    alertStatus: "normal",
  };
}

const A: PointInput = {
  id: "a",
  code: "P-A",
  northing: 0,
  easting: 0,
  initialElevation: 100,
};
const B: PointInput = {
  id: "b",
  code: "P-B",
  northing: 0,
  easting: 6,
  initialElevation: 100,
};

describe("horizontalDistance", () => {
  it("es la distancia euclidiana en el plano N/E", () => {
    expect(horizontalDistance(A, B)).toBeCloseTo(6, 10);
    const C: PointInput = { ...A, id: "c", northing: 3, easting: 4 };
    expect(horizontalDistance(A, C)).toBeCloseTo(5, 10);
  });

  it("es null si a algún punto le faltan coordenadas", () => {
    const sinCoords: PointInput = { ...B, northing: null };
    expect(horizontalDistance(A, sinCoords)).toBeNull();
  });
});

describe("computeDifferentials", () => {
  it("calcula el diferencial y la distorsión como 1/X", () => {
    // Diferencial |−1.8 − (−2.5)| = 0.7 mm sobre 6 m ⇒ 6000/0.7 = 1/8571.4
    const pairs = computeDifferentials(
      [A, B],
      [lectura("a", -1.8), lectura("b", -2.5)],
      500,
    );
    expect(pairs).toHaveLength(1);
    expect(pairs[0].differentialMm).toBeCloseTo(0.7, 6);
    expect(pairs[0].distanceM).toBeCloseTo(6, 6);
    expect(pairs[0].distortionInverse).toBeCloseTo(8571.43, 1);
    expect(pairs[0].exceedsLimit).toBe(false);
  });

  it("marca el par que supera el límite: 1/X con X MENOR que el límite", () => {
    // 20 mm sobre 6 m ⇒ 1/300, más severo que 1/500 ⇒ excede.
    const pairs = computeDifferentials(
      [A, B],
      [lectura("a", 0), lectura("b", -20)],
      500,
    );
    expect(pairs[0].distortionInverse).toBeCloseTo(300, 6);
    expect(pairs[0].exceedsLimit).toBe(true);
  });

  it("un diferencial de 0 da 1/∞ y NO excede el límite", () => {
    // Dos puntos que se asientan igual no tienen distorsión entre sí.
    const pairs = computeDifferentials(
      [A, B],
      [lectura("a", -5), lectura("b", -5)],
      500,
    );
    expect(pairs[0].differentialMm).toBe(0);
    expect(pairs[0].distortionInverse).toBe(Number.POSITIVE_INFINITY);
    expect(pairs[0].exceedsLimit).toBe(false);
  });

  it("excluye el par si a un punto le faltan coordenadas", () => {
    // Calcularlo con L = 0 daría distorsión infinita y aparentaría normalidad.
    const sinCoords: PointInput = { ...B, easting: null };
    const pairs = computeDifferentials(
      [A, sinCoords],
      [lectura("a", 0), lectura("b", -20)],
      500,
    );
    expect(pairs).toHaveLength(0);
  });

  it("excluye el par si a un punto le falta el acumulado", () => {
    const pairs = computeDifferentials(
      [A, B],
      [lectura("a", -5), lectura("b", null)],
      500,
    );
    expect(pairs).toHaveLength(0);
  });

  it("genera cada par una sola vez, sin repetir el simétrico", () => {
    const C: PointInput = { ...A, id: "c", easting: 12 };
    const pairs = computeDifferentials(
      [A, B, C],
      [lectura("a", -1), lectura("b", -2), lectura("c", -3)],
      500,
    );
    expect(pairs).toHaveLength(3); // a-b, a-c, b-c
  });

  it("el diferencial es siempre positivo, sea cual sea el orden", () => {
    const pairs = computeDifferentials(
      [A, B],
      [lectura("a", -5), lectura("b", -1)],
      500,
    );
    expect(pairs[0].differentialMm).toBeCloseTo(4, 6);
  });
});
```

- [ ] **Step 2: Ejecutar y verificar que falla**

```bash
npm test -- settlement
```

Esperado: FAIL — `computeDifferentials` y `horizontalDistance` no existen.

- [ ] **Step 3: Implementar**

Añadir a `src/lib/calculations/settlement.ts`:

```typescript
import type { DifferentialPair } from "@/types/settlement";

/**
 * Distancia horizontal entre dos puntos, en metros, desde sus coordenadas N/E.
 * Null si a alguno le faltan coordenadas.
 */
export function horizontalDistance(
  a: PointInput,
  b: PointInput,
): number | null {
  if (
    a.northing === null ||
    a.easting === null ||
    b.northing === null ||
    b.easting === null
  ) {
    return null;
  }
  const dn = a.northing - b.northing;
  const de = a.easting - b.easting;
  return Math.sqrt(dn * dn + de * de);
}

/**
 * Asentamientos diferenciales y distorsión angular de cada par de puntos
 * (§ 6.10), para las lecturas de una visita.
 *
 * La distorsión se expresa como `1/X`, donde `X = (L × 1000) / Δs_diferencial`.
 * Un X MENOR es más severo: 1/300 es peor que 1/500. De ahí que `exceedsLimit`
 * compare `distortionInverse < limit`.
 *
 * Dos exclusiones deliberadas, ambas para no fabricar tranquilidad falsa:
 * - Un par sin coordenadas en algún punto queda fuera. Calcularlo con L = 0
 *   daría distorsión infinita, que se lee como «normal».
 * - Un par donde algún punto no tiene acumulado queda fuera: no hay nada que
 *   comparar.
 *
 * Un diferencial de 0 sí se incluye, con `distortionInverse = Infinity`: dos
 * puntos que se asientan igual no tienen distorsión entre sí, y eso es un
 * resultado legítimo, no un dato ausente.
 */
export function computeDifferentials(
  points: PointInput[],
  readings: ComputedReading[],
  angularDistortionLimit: number,
): DifferentialPair[] {
  const byId = new Map(points.map((p) => [p.id, p]));
  const accumulated = new Map(
    readings.map((r) => [r.pointId, r.accumulatedSettlement]),
  );

  const pairs: DifferentialPair[] = [];

  for (let i = 0; i < readings.length; i++) {
    for (let j = i + 1; j < readings.length; j++) {
      const idA = readings[i].pointId;
      const idB = readings[j].pointId;
      const pointA = byId.get(idA);
      const pointB = byId.get(idB);
      if (!pointA || !pointB) continue;

      const accA = accumulated.get(idA);
      const accB = accumulated.get(idB);
      if (accA == null || accB == null) continue;

      const distanceM = horizontalDistance(pointA, pointB);
      if (distanceM === null) continue;

      const differentialMm = round(Math.abs(accA - accB), 1);
      const distortionInverse =
        differentialMm === 0
          ? Number.POSITIVE_INFINITY
          : (distanceM * 1000) / differentialMm;

      pairs.push({
        pointIdA: idA,
        pointIdB: idB,
        differentialMm,
        distanceM,
        distortionInverse,
        exceedsLimit: distortionInverse < angularDistortionLimit,
      });
    }
  }

  return pairs;
}
```

- [ ] **Step 4: Ejecutar los tests**

```bash
npm test -- settlement
```

Esperado: PASS.

- [ ] **Step 5: Typecheck y commit**

```bash
npm run typecheck
git add src/lib/calculations/settlement.ts src/lib/calculations/settlement.test.ts
git commit -m "feat: asentamientos diferenciales y distorsion angular"
```

---

## Task 6: Cálculo — clasificación de alertas y tendencia

**Files:**
- Modify: `src/lib/calculations/settlement.ts`
- Modify: `src/lib/calculations/settlement.test.ts`

**Interfaces:**
- Consumes: `Thresholds`, `AlertLevel`, `Trend`, `VisitResult`, `SettlementHistory` de `@/types/settlement`.
- Produces: `classifyAlert(velocity, accumulated, thresholds)`, `classifyReadings(visits, thresholds)`, `computeTrends(visits)`, `computeHistory(points, visits, thresholds)`.

- [ ] **Step 1: Escribir los tests que fallan**

Añadir a `src/lib/calculations/settlement.test.ts`:

```typescript
import {
  classifyAlert,
  classifyReadings,
  computeHistory,
  computeTrends,
} from "./settlement";
import { thresholdsFor } from "./tolerances";
import type { Thresholds } from "@/types/settlement";

const T: Thresholds = thresholdsFor("edificio");
// velocidad 2/5/10 mm/mes · acumulado 25/50/75 mm

describe("classifyAlert", () => {
  it("es normal por debajo de todos los umbrales", () => {
    expect(classifyAlert(-1.9, -24, T)).toBe("normal");
  });

  it("clasifica en la frontera exacta del umbral (>=, no >)", () => {
    expect(classifyAlert(-2, 0, T)).toBe("caution");
    expect(classifyAlert(-5, 0, T)).toBe("alert");
    expect(classifyAlert(-10, 0, T)).toBe("alarm");
    expect(classifyAlert(0, -25, T)).toBe("caution");
    expect(classifyAlert(0, -50, T)).toBe("alert");
    expect(classifyAlert(0, -75, T)).toBe("alarm");
  });

  it("usa el valor absoluto: un levantamiento rápido también alerta", () => {
    expect(classifyAlert(6, 0, T)).toBe("alert");
    expect(classifyAlert(0, 80, T)).toBe("alarm");
  });

  it("gana la peor de las dos clasificaciones", () => {
    // Velocidad normal pero acumulado en alarma.
    expect(classifyAlert(-1, -80, T)).toBe("alarm");
    // Velocidad en alarma pero acumulado normal.
    expect(classifyAlert(-12, -5, T)).toBe("alarm");
  });

  it("trata la velocidad ausente como no clasificable por velocidad", () => {
    // La línea base no tiene velocidad; solo debe pesar el acumulado.
    expect(classifyAlert(null, -30, T)).toBe("caution");
    expect(classifyAlert(null, 0, T)).toBe("normal");
  });

  it("trata el acumulado ausente como no clasificable por acumulado", () => {
    expect(classifyAlert(-6, null, T)).toBe("alert");
  });

  it("es normal si no hay ni velocidad ni acumulado", () => {
    expect(classifyAlert(null, null, T)).toBe("normal");
  });
});

describe("classifyReadings", () => {
  it("asigna el nivel a cada lectura y el peor a la visita", () => {
    const visitas = computeSettlements(
      [P1],
      [
        visita(0, "2025-01-15", 100.0),
        // −60 mm en un mes: acumulado en alerta, velocidad en alarma.
        visita(1, "2025-02-15", 99.94),
      ],
    );
    const clasificadas = classifyReadings(visitas, T);
    expect(clasificadas[0].readings[0].alertStatus).toBe("normal");
    expect(clasificadas[1].readings[0].alertStatus).toBe("alarm");
    expect(clasificadas[1].worstAlert).toBe("alarm");
  });

  it("el peor de la visita es el máximo entre sus puntos", () => {
    const P2: PointInput = { ...P1, id: "p2", code: "P-02" };
    const visitas = computeSettlements(
      [P1, P2],
      [
        {
          id: "v0",
          visitNumber: 0,
          date: "2025-01-15",
          readings: [
            { pointId: "p1", elevation: 100.0 },
            { pointId: "p2", elevation: 100.0 },
          ],
        },
        {
          id: "v1",
          visitNumber: 1,
          date: "2025-02-15",
          readings: [
            { pointId: "p1", elevation: 99.999 }, // −1 mm: normal
            { pointId: "p2", elevation: 99.994 }, // −6 mm: alerta por velocidad
          ],
        },
      ],
    );
    const clasificadas = classifyReadings(visitas, T);
    expect(clasificadas[1].worstAlert).toBe("alert");
  });
});

describe("computeTrends", () => {
  it("no afirma nada con menos de 3 visitas", () => {
    const visitas = computeSettlements(
      [P1],
      [visita(0, "2025-01-15", 100.0), visita(1, "2025-02-15", 99.994)],
    );
    expect(computeTrends(visitas)).toEqual({});
  });

  it("marca convergente cuando la velocidad decrece en magnitud", () => {
    const visitas = computeSettlements(
      [P1],
      [
        visita(0, "2025-01-15", 100.0),
        visita(1, "2025-02-15", 99.994), // −6.0 mm
        visita(2, "2025-03-15", 99.992), // −2.0 mm
      ],
    );
    expect(computeTrends(visitas).p1).toBe("converging");
  });

  it("marca acelerando cuando la velocidad crece en magnitud", () => {
    const visitas = computeSettlements(
      [P1],
      [
        visita(0, "2025-01-15", 100.0),
        visita(1, "2025-02-15", 99.998), // −2.0 mm
        visita(2, "2025-03-15", 99.99), // −8.0 mm
      ],
    );
    expect(computeTrends(visitas).p1).toBe("accelerating");
  });
});

describe("computeHistory", () => {
  it("compone visitas clasificadas, diferenciales de la última y tendencias", () => {
    const A2: PointInput = { ...A, initialElevation: 100 };
    const B2: PointInput = { ...B, initialElevation: 100 };
    const visitas: VisitInput[] = [
      {
        id: "v0",
        visitNumber: 0,
        date: "2025-01-15",
        readings: [
          { pointId: "a", elevation: 100.0 },
          { pointId: "b", elevation: 100.0 },
        ],
      },
      {
        id: "v1",
        visitNumber: 1,
        date: "2025-02-15",
        readings: [
          { pointId: "a", elevation: 99.999 },
          { pointId: "b", elevation: 99.998 },
        ],
      },
    ];
    const h = computeHistory([A2, B2], visitas, T);
    expect(h.visits).toHaveLength(2);
    // Los diferenciales se calculan sobre la ÚLTIMA visita.
    expect(h.differentials).toHaveLength(1);
    expect(h.differentials[0].differentialMm).toBeCloseTo(1.0, 6);
    expect(h.trends).toEqual({});
  });

  it("devuelve estructuras vacías si no hay visitas", () => {
    const h = computeHistory([A], [], T);
    expect(h.visits).toEqual([]);
    expect(h.differentials).toEqual([]);
    expect(h.trends).toEqual({});
  });
});
```

- [ ] **Step 2: Ejecutar y verificar que falla**

```bash
npm test -- settlement
```

Esperado: FAIL — las cuatro funciones no existen.

- [ ] **Step 3: Implementar**

Añadir a `src/lib/calculations/settlement.ts`:

```typescript
import type {
  SettlementHistory,
  Thresholds,
  Trend,
} from "@/types/settlement";
import { ALERT_LEVELS } from "@/types/settlement";

/**
 * Clasifica una lectura en el semáforo de 4 niveles (§ 6.11): gana la peor
 * clasificación entre velocidad y acumulado, ambas en valor absoluto.
 *
 * Un valor `null` no clasifica por ese criterio —no lo fuerza a `normal`—: la
 * línea base no tiene velocidad y debe poder clasificarse solo por acumulado.
 *
 * ATENCIÓN: los estados de alerta de los casos de estudio del marco teórico NO
 * se derivan de sus propios umbrales (verificado; ver hallazgo 3 del PRD de
 * fase). No sirven para comprobar esta función.
 */
export function classifyAlert(
  velocity: number | null,
  accumulated: number | null,
  thresholds: Thresholds,
): AlertLevel {
  const byVelocity: AlertLevel =
    velocity === null
      ? "normal"
      : level(Math.abs(velocity), [
          thresholds.velocityCaution,
          thresholds.velocityAlert,
          thresholds.velocityAlarm,
        ]);

  const byAccumulated: AlertLevel =
    accumulated === null
      ? "normal"
      : level(Math.abs(accumulated), [
          thresholds.accumulatedCaution,
          thresholds.accumulatedAlert,
          thresholds.accumulatedAlarm,
        ]);

  return worst(byVelocity, byAccumulated);
}

/** Nivel de un valor absoluto contra [precaución, alerta, alarma]. */
function level(
  absolute: number,
  [caution, alert, alarm]: [number, number, number],
): AlertLevel {
  if (absolute >= alarm) return "alarm";
  if (absolute >= alert) return "alert";
  if (absolute >= caution) return "caution";
  return "normal";
}

/** El peor de dos niveles, según el orden de ALERT_LEVELS. */
export function worst(a: AlertLevel, b: AlertLevel): AlertLevel {
  return ALERT_LEVELS.indexOf(a) >= ALERT_LEVELS.indexOf(b) ? a : b;
}

/**
 * Asigna el nivel de alerta a cada lectura y el peor de ellos a cada visita.
 * Se aplica sobre el resultado de `computeSettlements`.
 */
export function classifyReadings(
  visits: VisitResult[],
  thresholds: Thresholds,
): VisitResult[] {
  return visits.map((visit) => {
    const readings = visit.readings.map((reading) => ({
      ...reading,
      alertStatus: classifyAlert(
        reading.velocity,
        reading.accumulatedSettlement,
        thresholds,
      ),
    }));

    return {
      ...visit,
      readings,
      worstAlert: readings.reduce<AlertLevel>(
        (acc, r) => worst(acc, r.alertStatus),
        "normal",
      ),
    };
  });
}

/**
 * Tendencia de cada punto comparando sus dos últimas velocidades (§ 5.3).
 *
 * Un punto solo aparece en el resultado si tiene **al menos dos velocidades**,
 * lo que exige tres visitas. Con menos no se incluye: devolver `"converging"`
 * afirmaría una convergencia que nadie ha comprobado.
 */
export function computeTrends(visits: VisitResult[]): Record<string, Trend> {
  const velocities = new Map<string, number[]>();

  for (const visit of visits) {
    for (const reading of visit.readings) {
      if (reading.velocity === null) continue;
      const list = velocities.get(reading.pointId) ?? [];
      list.push(reading.velocity);
      velocities.set(reading.pointId, list);
    }
  }

  const trends: Record<string, Trend> = {};
  for (const [pointId, list] of velocities) {
    if (list.length < 2) continue;
    const last = Math.abs(list[list.length - 1]);
    const previous = Math.abs(list[list.length - 2]);
    trends[pointId] = last > previous ? "accelerating" : "converging";
  }
  return trends;
}

/**
 * Histórico completo de un lugar: visitas calculadas y clasificadas,
 * diferenciales de la **última** visita y tendencia por punto.
 */
export function computeHistory(
  points: PointInput[],
  visits: VisitInput[],
  thresholds: Thresholds,
): SettlementHistory {
  const computed = classifyReadings(
    computeSettlements(points, visits),
    thresholds,
  );

  const last = computed[computed.length - 1];
  const differentials = last
    ? computeDifferentials(
        points,
        last.readings,
        thresholds.angularDistortionLimit,
      )
    : [];

  return {
    visits: computed,
    differentials,
    trends: computeTrends(computed),
  };
}
```

- [ ] **Step 4: Ejecutar toda la suite**

```bash
npm test
```

Esperado: PASS, incluidos los 217 tests previos.

- [ ] **Step 5: Typecheck y commit**

```bash
npm run typecheck
git add src/lib/calculations/settlement.ts src/lib/calculations/settlement.test.ts
git commit -m "feat: clasificacion de alertas, tendencia e historico de asentamientos"
```

---

## Task 7: Validadores

**Files:**
- Create: `src/lib/validators/settlement.ts`
- Create: `src/lib/validators/settlement.test.ts`

**Interfaces:**
- Consumes: `PointInput`, `VisitInput`, `ReadingInput` de `@/types/settlement`.
- Produces: `validateReadingCapture(reading, point)`, `validateVisitCapture(visit, points, previousVisitDate)`, `validateVisitClose(visit, points, previousVisitDate)`. Todas devuelven `{ errors, warnings }` indexado por campo, siguiendo el patrón de `validators/leveling.ts`.

**Contexto:** la capa estadística **no bloquea nada**. Un asentamiento en alarma es un hallazgo del monitoreo, no un error de captura.

- [ ] **Step 1: Escribir los tests que fallan**

Crear `src/lib/validators/settlement.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import {
  validateReadingCapture,
  validateVisitCapture,
  validateVisitClose,
} from "./settlement";
import type { PointInput, VisitInput } from "@/types/settlement";

const P1: PointInput = {
  id: "p1",
  code: "P-01",
  northing: 0,
  easting: 0,
  initialElevation: 100.0,
};

describe("validateReadingCapture", () => {
  it("acepta una cota plausible", () => {
    const r = validateReadingCapture({ pointId: "p1", elevation: 99.99 }, P1);
    expect(r.errors).toEqual({});
  });

  it("rechaza una cota no finita", () => {
    const r = validateReadingCapture(
      { pointId: "p1", elevation: Number.NaN },
      P1,
    );
    expect(r.errors.elevation).toBeDefined();
  });

  it("advierte si la cota se aleja de C0 más de 1 m", () => {
    // Un asentamiento de 1 m es implausible en monitoreo topográfico: casi
    // siempre es un error de transcripción.
    const r = validateReadingCapture({ pointId: "p1", elevation: 98.5 }, P1);
    expect(r.warnings.elevation).toBeDefined();
    expect(r.errors).toEqual({});
  });

  it("no advierte si el punto no tiene C0 contra la que comparar", () => {
    const sinC0: PointInput = { ...P1, initialElevation: null };
    const r = validateReadingCapture(
      { pointId: "p1", elevation: 50 },
      sinC0,
    );
    expect(r.warnings).toEqual({});
  });
});

describe("validateVisitCapture", () => {
  const visita: VisitInput = {
    id: "v1",
    visitNumber: 1,
    date: "2025-02-15",
    readings: [{ pointId: "p1", elevation: 99.99 }],
  };

  it("acepta una visita bien formada", () => {
    const r = validateVisitCapture(visita, [P1], "2025-01-15");
    expect(r.errors).toEqual({});
  });

  it("rechaza una fecha anterior o igual a la de la visita previa", () => {
    const r = validateVisitCapture(
      { ...visita, date: "2025-01-10" },
      [P1],
      "2025-01-15",
    );
    expect(r.errors.date).toBeDefined();
  });

  it("acepta la primera visita, que no tiene previa", () => {
    const r = validateVisitCapture({ ...visita, visitNumber: 0 }, [P1], null);
    expect(r.errors).toEqual({});
  });

  it("rechaza una fecha vacía o mal formada", () => {
    const r = validateVisitCapture({ ...visita, date: "" }, [P1], null);
    expect(r.errors.date).toBeDefined();
  });

  it("rechaza dos lecturas del mismo punto", () => {
    const r = validateVisitCapture(
      {
        ...visita,
        readings: [
          { pointId: "p1", elevation: 99.99 },
          { pointId: "p1", elevation: 99.98 },
        ],
      },
      [P1],
      null,
    );
    expect(r.errors.readings).toBeDefined();
  });

  it("rechaza una lectura de un punto que no está en el catálogo", () => {
    const r = validateVisitCapture(
      { ...visita, readings: [{ pointId: "fantasma", elevation: 99.99 }] },
      [P1],
      null,
    );
    expect(r.errors.readings).toBeDefined();
  });

  it("propaga los errores de celda de cada lectura", () => {
    const r = validateVisitCapture(
      { ...visita, readings: [{ pointId: "p1", elevation: Number.NaN }] },
      [P1],
      null,
    );
    expect(r.readingIssues.p1.errors.elevation).toBeDefined();
  });
});

describe("validateVisitClose", () => {
  it("bloquea el cierre si falta la lectura de algún punto del catálogo", () => {
    const P2: PointInput = { ...P1, id: "p2", code: "P-02" };
    const r = validateVisitClose(
      {
        id: "v1",
        visitNumber: 1,
        date: "2025-02-15",
        readings: [{ pointId: "p1", elevation: 99.99 }],
      },
      [P1, P2],
    );
    expect(r.errors.readings).toBeDefined();
  });

  it("permite cerrar una visita completa", () => {
    const r = validateVisitClose(
      {
        id: "v1",
        visitNumber: 1,
        date: "2025-02-15",
        readings: [{ pointId: "p1", elevation: 99.99 }],
      },
      [P1],
    );
    expect(r.errors).toEqual({});
  });

  it("NO bloquea el cierre por un asentamiento en alarma", () => {
    // Un dato alarmante es un hallazgo del monitoreo, no un error de captura:
    // es justo el caso que el módulo existe para documentar.
    const r = validateVisitClose(
      {
        id: "v1",
        visitNumber: 1,
        date: "2025-02-15",
        readings: [{ pointId: "p1", elevation: 99.9 }], // −100 mm
      },
      [P1],
    );
    expect(r.errors).toEqual({});
  });
});
```

- [ ] **Step 2: Ejecutar y verificar que falla**

```bash
npm test -- validators/settlement
```

Esperado: FAIL — el módulo no existe.

- [ ] **Step 3: Implementar**

Crear `src/lib/validators/settlement.ts`:

```typescript
// Validación del control de asentamientos — funciones puras (PRD § 5.1 capa de
// captura, § 5.2 capa de cierre). Sin React, sin Supabase.
//
// La capa estadística (§ 5.3) NO vive aquí y NO bloquea: un asentamiento en
// alarma es un hallazgo del monitoreo, no un error de captura. Su cálculo está
// en src/lib/calculations/settlement.ts y su presentación en el semáforo.

import type { PointInput, ReadingInput, VisitInput } from "@/types/settlement";

/** Issues de una lectura, indexados por celda de la tabla. */
export interface ReadingCaptureIssues {
  errors: Partial<Record<"elevation", string>>;
  warnings: Partial<Record<"elevation", string>>;
}

/** Issues de la visita completa, más los de cada lectura por punto. */
export interface VisitCaptureIssues {
  errors: Partial<Record<"date" | "readings", string>>;
  warnings: Partial<Record<"date" | "readings", string>>;
  readingIssues: Record<string, ReadingCaptureIssues>;
}

/**
 * Desviación máxima plausible de una cota respecto a su C0, en metros.
 *
 * Un metro de asentamiento no ocurre en monitoreo topográfico; a esa escala lo
 * habitual es un error de transcripción (una cifra de más, un dígito cambiado).
 * Es advertencia y no error: el dato podría ser real en un terraplén sobre
 * turba, y bloquearlo impediría registrar justo el caso extremo.
 */
const MAX_PLAUSIBLE_DEVIATION_M = 1;

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Valida la cota medida de un punto en una visita (§ 5.1). */
export function validateReadingCapture(
  reading: ReadingInput,
  point: PointInput,
): ReadingCaptureIssues {
  const errors: ReadingCaptureIssues["errors"] = {};
  const warnings: ReadingCaptureIssues["warnings"] = {};

  if (!Number.isFinite(reading.elevation)) {
    errors.elevation = "La cota es obligatoria y debe ser un número.";
  } else if (
    point.initialElevation !== null &&
    Math.abs(reading.elevation - point.initialElevation) >
      MAX_PLAUSIBLE_DEVIATION_M
  ) {
    warnings.elevation =
      "La cota se aleja más de 1 m de la línea base. Verifica la transcripción.";
  }

  return { errors, warnings };
}

/**
 * Valida la captura de una visita completa (§ 5.1).
 *
 * `previousVisitDate` es la fecha de la visita cronológicamente anterior, o
 * `null` si es la primera. Sirve para impedir que una visita se feche antes que
 * su predecesora, lo que daría intervalos negativos y velocidades con el signo
 * invertido.
 */
export function validateVisitCapture(
  visit: VisitInput,
  points: PointInput[],
  previousVisitDate: string | null,
): VisitCaptureIssues {
  const errors: VisitCaptureIssues["errors"] = {};
  const warnings: VisitCaptureIssues["warnings"] = {};
  const readingIssues: Record<string, ReadingCaptureIssues> = {};

  if (!ISO_DATE_RE.test(visit.date)) {
    errors.date = "La visita necesita una fecha válida.";
  } else if (previousVisitDate !== null && visit.date <= previousVisitDate) {
    errors.date = `La fecha debe ser posterior a la de la visita anterior (${previousVisitDate}).`;
  }

  const byId = new Map(points.map((p) => [p.id, p]));
  const seen = new Set<string>();

  for (const reading of visit.readings) {
    const point = byId.get(reading.pointId);
    if (!point) {
      errors.readings = "Hay una lectura de un punto que no está en el catálogo.";
      continue;
    }
    if (seen.has(reading.pointId)) {
      errors.readings = `El punto ${point.code} tiene más de una lectura en esta visita.`;
      continue;
    }
    seen.add(reading.pointId);
    readingIssues[reading.pointId] = validateReadingCapture(reading, point);
  }

  return { errors, warnings, readingIssues };
}

/**
 * Valida que una visita pueda cerrarse (§ 5.2).
 *
 * Exige que todos los puntos del catálogo tengan lectura: una visita cerrada es
 * el registro inmutable de una fecha, y cerrarla incompleta deja un hueco que
 * ya no se puede rellenar.
 *
 * NO evalúa los umbrales de alerta. Un punto en alarma se cierra con
 * normalidad; es el hallazgo que el monitoreo busca documentar.
 */
export function validateVisitClose(
  visit: VisitInput,
  points: PointInput[],
): VisitCaptureIssues {
  const issues = validateVisitCapture(visit, points, null);

  const measured = new Set(visit.readings.map((r) => r.pointId));
  const missing = points.filter((p) => !measured.has(p.id));

  if (missing.length > 0) {
    issues.errors.readings = `Faltan lecturas de: ${missing
      .map((p) => p.code)
      .join(", ")}.`;
  }

  return issues;
}
```

- [ ] **Step 4: Ejecutar los tests**

```bash
npm test -- validators/settlement
```

Esperado: PASS.

- [ ] **Step 5: Typecheck y commit**

```bash
npm run typecheck
git add src/lib/validators/settlement.ts src/lib/validators/settlement.test.ts
git commit -m "feat: validadores de captura y cierre de asentamientos"
```

---

## Task 8: `StatusIndicator` de 4 niveles con segundo canal

**Files:**
- Modify: `src/components/design-system/status-indicator.tsx`
- Modify: `src/lib/design/pairings.ts`
- Create: `src/components/design-system/status-indicator.test.tsx`
- Modify: `src/components/leveling/results-panel.tsx` (adaptar al contrato nuevo)

**Interfaces:**
- Consumes: tokens `semaphore-green/-yellow/-orange/-red` de `globals.css` (ya existen).
- Produces: `StatusIndicator` con prop `status: "ok" | "warning" | "danger"` (compatibilidad) **y** `level?: AlertLevel`; forma distinta por nivel.

**Contexto:** medido, ningún cuarteto de colores separa los 4 niveles (verde/rojo 1.028 hoy, 1.065 con la alternativa registrada). La solución es un segundo canal. El sistema de diseño ya exige que el color nunca sea canal único (§ 4.4 de la doc técnica).

- [ ] **Step 1: Escribir el test que falla**

Crear `src/components/design-system/status-indicator.test.tsx`:

```typescript
import { describe, expect, it } from "vitest";
import { SEMAPHORE_SHAPES } from "./status-indicator";

describe("SEMAPHORE_SHAPES", () => {
  it("da una forma distinta a cada uno de los 4 niveles", () => {
    const formas = Object.values(SEMAPHORE_SHAPES);
    expect(formas).toHaveLength(4);
    expect(new Set(formas).size).toBe(4);
  });

  it("cubre exactamente los 4 niveles de alerta", () => {
    expect(Object.keys(SEMAPHORE_SHAPES).sort()).toEqual([
      "alarm",
      "alert",
      "caution",
      "normal",
    ]);
  });
});
```

- [ ] **Step 2: Ejecutar y verificar que falla**

```bash
npm test -- status-indicator
```

Esperado: FAIL — `SEMAPHORE_SHAPES` no se exporta.

- [ ] **Step 3: Reescribir el componente**

Sustituir el contenido de `src/components/design-system/status-indicator.tsx`:

```typescript
import { cn } from "@/lib/utils/cn";
import type { AlertLevel } from "@/types/settlement";

/** Semáforo de 3 niveles de las Fases 3-4 (tolerancia cumplida o no). */
type Status = "ok" | "warning" | "danger";

const DOT_CLASSES: Record<Status, string> = {
  ok: "bg-success-500",
  warning: "bg-warning-500",
  danger: "bg-danger-500",
};

const LEVEL_CLASSES: Record<AlertLevel, string> = {
  normal: "bg-semaphore-green",
  caution: "bg-semaphore-yellow",
  alert: "bg-semaphore-orange",
  alarm: "bg-semaphore-red",
};

/**
 * Forma del indicador por nivel — el segundo canal, además del color y del
 * texto.
 *
 * Los cuatro tokens del semáforo cumplen AA contra blanco, pero NO se separan
 * entre sí: medido, verde/rojo dan 1.028 y naranja/rojo 1.014. La alternativa
 * que se barajó (rellenos vivos con anillo oscuro) tampoco lo arregla —dejaba
 * verde/rojo en 1.065—, porque la causa es estructural: cuatro niveles que
 * deben cumplir 3:1 contra blanco quedan comprimidos en una banda estrecha de
 * luminancia. No hay cuarteto de colores que lo resuelva, así que la distinción
 * fiable tiene que venir de la forma. Ver docs/prds/04-asentamientos.md,
 * hallazgo 5 y decisión #9.
 */
export const SEMAPHORE_SHAPES: Record<AlertLevel, string> = {
  normal: "rounded-full",              // ●  círculo
  caution: "rounded-[2px]",            // ■  cuadrado
  alert: "rounded-[2px] rotate-45",    // ◆  rombo
  alarm: "clip-triangle",              // ▲  triángulo
};

interface StatusIndicatorProps {
  /** Semáforo de 3 niveles (tolerancia). Mutuamente excluyente con `level`. */
  status?: Status;
  /** Semáforo de 4 niveles del control de asentamientos. */
  level?: AlertLevel;
  label: string;
  className?: string;
}

/**
 * Semáforo de cumplimiento con etiqueta.
 *
 * Dos modos: `status` para los 3 niveles de tolerancia de poligonal y
 * nivelación, y `level` para los 4 niveles de alerta de asentamientos. El
 * color NUNCA es el único canal: siempre hay texto, y en el modo de 4 niveles
 * también forma.
 */
export function StatusIndicator({
  status,
  level,
  label,
  className,
}: StatusIndicatorProps) {
  const isLevel = level !== undefined;

  return (
    <div className={cn("inline-flex items-center gap-2", className)}>
      <span
        aria-hidden
        className={cn(
          "h-2.5 w-2.5 shrink-0",
          isLevel
            ? cn(LEVEL_CLASSES[level], SEMAPHORE_SHAPES[level])
            : cn(DOT_CLASSES[status ?? "ok"], "rounded-full"),
        )}
      />
      <span className="text-sm font-medium text-neutral-800">{label}</span>
    </div>
  );
}
```

- [ ] **Step 4: Añadir la utilidad del triángulo**

En `src/app/globals.css`, dentro de `@layer utilities`:

```css
@layer utilities {
  /* Triángulo del nivel «alarma» del semáforo. Es el cuarto canal de forma:
     ver el comentario de SEMAPHORE_SHAPES en status-indicator.tsx. */
  .clip-triangle {
    clip-path: polygon(50% 0%, 100% 100%, 0% 100%);
  }
}
```

Si el archivo no tiene aún un bloque `@layer utilities`, añadirlo tras `@layer base`. **No declarar la regla fuera de una capa**: una regla sin capa gana sobre las utilidades de Tailwind y las anula en silencio (regla fijada en el plan de estabilización del sistema de diseño).

- [ ] **Step 5: Declarar las parejas nuevas en `pairings.ts`**

Las cuatro entradas de `semaphore-*` como elemento gráfico ya existen. Verificar que estén y, si falta alguna, añadirla con `contexto: "grafico"` y `umbral: AA_GRAFICO`, con `donde: "StatusIndicator, nivel de alerta de asentamientos"`.

```bash
grep -n "semaphore" src/lib/design/pairings.ts
```

- [ ] **Step 6: Adaptar el consumidor existente**

`src/components/leveling/results-panel.tsx` usa `status`, que sigue siendo válido. Verificar que compila sin cambios:

```bash
npm run typecheck
```

Si falla porque `status` pasó a opcional en un uso que no lo pasa, corregir ese punto concreto.

- [ ] **Step 7: Ejecutar tests y verificar la medición de contraste**

```bash
npm test -- status-indicator
npm run build
```

Esperado: tests PASS, build OK. Arrancar `npm run dev` y abrir `/design-system` para confirmar que la tabla de parejas cierra sin fallos.

- [ ] **Step 8: Commit**

```bash
git add src/components/design-system src/lib/design/pairings.ts src/app/globals.css
git commit -m "feat: semaforo de 4 niveles con forma como segundo canal"
```

---

## Task 9: Queries y Server Actions con revalidación en servidor

**Files:**
- Modify: `src/lib/supabase/queries.ts`
- Create: `src/app/(app)/projects/[id]/sites/actions.ts`
- Create: `src/app/(app)/projects/[id]/settlement/[siteId]/actions.ts`

**Interfaces:**
- Consumes: `computeHistory`, `thresholdsFor` de calculations; `validateVisitCapture`, `validateVisitClose` de validators.
- Produces: `getSites`, `getSite`, `getSitePoints`, `getVisits`, `getVisit`, `getSettlementHistory`; acciones `createSiteAction`, `saveSiteAction`, `closeSiteAction`, `createVisitAction`, `saveVisitAction`, `closeVisitAction`.

**Contexto:** esta es la tarea que hace que el módulo **nazca sin la deuda** de revalidación (decisión #10). El patrón a seguir está en `src/app/(app)/projects/[id]/leveling/[pid]/actions.ts`, que recalcula pero **no revalida** — eso se arregla en la Task 16.

- [ ] **Step 1: Añadir las queries**

En `src/lib/supabase/queries.ts`, siguiendo el estilo de las existentes (JSDoc explicando el porqué, `UUID_RE` para descartar ids inválidos):

```typescript
import type { Site } from "@/types/site";
import type {
  SettlementPoint,
  SettlementVisit,
  SettlementReading,
} from "@/types/settlement";

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
```

- [ ] **Step 2: Crear las acciones del lugar**

Crear `src/app/(app)/projects/[id]/sites/actions.ts`:

```typescript
"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { thresholdsFor } from "@/lib/calculations/tolerances";
import type { StructureType } from "@/types/site";

export interface ActionResult {
  ok: boolean;
  error?: string;
  siteId?: string;
}

export interface SitePayload {
  projectId: string;
  name: string;
  description: string | null;
  structureType: StructureType;
  velocityCaution: number;
  velocityAlert: number;
  velocityAlarm: number;
  accumulatedCaution: number;
  accumulatedAlert: number;
  accumulatedAlarm: number;
  angularDistortionLimit: number;
  notes: string | null;
}

/**
 * Valida los umbrales de un lugar. Deben ser positivos y estrictamente
 * crecientes: un umbral de alerta por debajo del de precaución haría que el
 * nivel intermedio no se alcanzara nunca, y el semáforo saltaría de normal a
 * alerta sin pasar por precaución.
 */
function validateThresholds(payload: SitePayload): string | null {
  const { velocityCaution: vc, velocityAlert: va, velocityAlarm: vm } = payload;
  const {
    accumulatedCaution: ac,
    accumulatedAlert: aa,
    accumulatedAlarm: am,
  } = payload;

  for (const [nombre, valor] of [
    ["precaución de velocidad", vc],
    ["alerta de velocidad", va],
    ["alarma de velocidad", vm],
    ["precaución de acumulado", ac],
    ["alerta de acumulado", aa],
    ["alarma de acumulado", am],
    ["límite de distorsión", payload.angularDistortionLimit],
  ] as const) {
    if (!Number.isFinite(valor) || valor <= 0) {
      return `El umbral de ${nombre} debe ser un número positivo.`;
    }
  }

  if (!(vc < va && va < vm)) {
    return "Los umbrales de velocidad deben ser crecientes: precaución < alerta < alarma.";
  }
  if (!(ac < aa && aa < am)) {
    return "Los umbrales de asentamiento acumulado deben ser crecientes: precaución < alerta < alarma.";
  }
  return null;
}

/** Crea un lugar. Los umbrales llegan del preset del tipo de estructura. */
export async function createSiteAction(
  payload: SitePayload,
): Promise<ActionResult> {
  if (payload.name.trim() === "") {
    return { ok: false, error: "El lugar necesita un nombre." };
  }
  const thresholdError = validateThresholds(payload);
  if (thresholdError) return { ok: false, error: thresholdError };

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("sites")
    .insert({
      project_id: payload.projectId,
      name: payload.name.trim(),
      description: payload.description,
      structure_type: payload.structureType,
      velocity_caution: payload.velocityCaution,
      velocity_alert: payload.velocityAlert,
      velocity_alarm: payload.velocityAlarm,
      accumulated_caution: payload.accumulatedCaution,
      accumulated_alert: payload.accumulatedAlert,
      accumulated_alarm: payload.accumulatedAlarm,
      angular_distortion_limit: payload.angularDistortionLimit,
      notes: payload.notes,
    })
    .select("id")
    .single();

  if (error) return { ok: false, error: error.message };

  revalidatePath(`/projects/${payload.projectId}`);
  return { ok: true, siteId: data.id };
}

/** Guarda la configuración de un lugar. Rechaza lugares cerrados. */
export async function saveSiteAction(
  siteId: string,
  payload: SitePayload,
): Promise<ActionResult> {
  if (payload.name.trim() === "") {
    return { ok: false, error: "El lugar necesita un nombre." };
  }
  const thresholdError = validateThresholds(payload);
  if (thresholdError) return { ok: false, error: thresholdError };

  const supabase = await createClient();

  const { data: site } = await supabase
    .from("sites")
    .select("id, status")
    .eq("id", siteId)
    .maybeSingle();
  if (!site) return { ok: false, error: "Lugar no encontrado." };
  if (site.status === "closed") {
    return { ok: false, error: "El lugar está cerrado; no admite cambios." };
  }

  const { error } = await supabase
    .from("sites")
    .update({
      name: payload.name.trim(),
      description: payload.description,
      structure_type: payload.structureType,
      velocity_caution: payload.velocityCaution,
      velocity_alert: payload.velocityAlert,
      velocity_alarm: payload.velocityAlarm,
      accumulated_caution: payload.accumulatedCaution,
      accumulated_alert: payload.accumulatedAlert,
      accumulated_alarm: payload.accumulatedAlarm,
      angular_distortion_limit: payload.angularDistortionLimit,
      notes: payload.notes,
    })
    .eq("id", siteId);

  if (error) return { ok: false, error: error.message };

  revalidatePath(`/projects/${payload.projectId}`);
  return { ok: true };
}

/** Cierra un lugar: fin del monitoreo. Queda en solo lectura. */
export async function closeSiteAction(
  projectId: string,
  siteId: string,
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sesión no válida." };

  const { data: site } = await supabase
    .from("sites")
    .select("id, status")
    .eq("id", siteId)
    .maybeSingle();
  if (!site) return { ok: false, error: "Lugar no encontrado." };
  if (site.status === "closed") {
    return { ok: false, error: "El lugar ya está cerrado." };
  }

  const { error } = await supabase
    .from("sites")
    .update({
      status: "closed",
      closed_at: new Date().toISOString(),
      closed_by: user.id,
    })
    .eq("id", siteId);

  if (error) return { ok: false, error: error.message };

  revalidatePath(`/projects/${projectId}`);
  return { ok: true };
}
```

- [ ] **Step 3: Crear las acciones de la visita — con revalidación**

Crear `src/app/(app)/projects/[id]/settlement/[siteId]/actions.ts`:

```typescript
"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { computeHistory } from "@/lib/calculations/settlement";
import {
  validateVisitCapture,
  validateVisitClose,
} from "@/lib/validators/settlement";
import type {
  PointInput,
  Thresholds,
  VisitInput,
} from "@/types/settlement";
import type { Site } from "@/types/site";

export interface ActionResult {
  ok: boolean;
  error?: string;
  visitId?: string;
}

export interface VisitPayload {
  siteId: string;
  visitId: string;
  date: string;
  operator: string | null;
  equipment: string | null;
  weatherConditions: string | null;
  closureErrorMm: number | null;
  notes: string | null;
  readings: { pointId: string; elevation: number }[];
}

/** Umbrales del lugar, desnormalizados para el motor de cálculo. */
function thresholdsOf(site: Site): Thresholds {
  return {
    velocityCaution: Number(site.velocity_caution),
    velocityAlert: Number(site.velocity_alert),
    velocityAlarm: Number(site.velocity_alarm),
    accumulatedCaution: Number(site.accumulated_caution),
    accumulatedAlert: Number(site.accumulated_alert),
    accumulatedAlarm: Number(site.accumulated_alarm),
    angularDistortionLimit: site.angular_distortion_limit,
  };
}

/**
 * Carga el lugar, su catálogo y todas sus visitas con lecturas.
 *
 * El histórico completo es necesario aunque solo se guarde una visita: el
 * asentamiento parcial y la velocidad de un punto dependen de la visita
 * anterior, y la clasificación de alerta depende del acumulado desde C0.
 */
async function loadContext(
  supabase: Awaited<ReturnType<typeof createClient>>,
  siteId: string,
) {
  const { data: site } = await supabase
    .from("sites")
    .select("*")
    .eq("id", siteId)
    .maybeSingle();
  if (!site) return null;

  const { data: points } = await supabase
    .from("settlement_points")
    .select("*")
    .eq("site_id", siteId);

  const { data: visits } = await supabase
    .from("settlement_visits")
    .select("*")
    .eq("site_id", siteId);

  const { data: readings } = await supabase
    .from("settlement_readings")
    .select("*, settlement_visits!inner(site_id)")
    .eq("settlement_visits.site_id", siteId);

  const pointInputs: PointInput[] = (points ?? []).map((p) => ({
    id: p.id,
    code: p.code,
    northing: p.northing === null ? null : Number(p.northing),
    easting: p.easting === null ? null : Number(p.easting),
    initialElevation:
      p.initial_elevation === null ? null : Number(p.initial_elevation),
  }));

  const readingsByVisit = new Map<string, { pointId: string; elevation: number }[]>();
  for (const row of readings ?? []) {
    const r = row as unknown as {
      visit_id: string;
      point_id: string;
      elevation: string | number;
    };
    const list = readingsByVisit.get(r.visit_id) ?? [];
    list.push({ pointId: r.point_id, elevation: Number(r.elevation) });
    readingsByVisit.set(r.visit_id, list);
  }

  const visitInputs: VisitInput[] = (visits ?? []).map((v) => ({
    id: v.id,
    visitNumber: v.visit_number,
    date: v.date,
    readings: readingsByVisit.get(v.id) ?? [],
  }));

  return { site: site as Site, points: pointInputs, visits: visitInputs };
}

/** Crea una visita con el número siguiente y la fecha dada. */
export async function createVisitAction(
  projectId: string,
  siteId: string,
  date: string,
): Promise<ActionResult> {
  const supabase = await createClient();

  const context = await loadContext(supabase, siteId);
  if (!context) return { ok: false, error: "Lugar no encontrado." };
  if (context.site.status === "closed") {
    return { ok: false, error: "El lugar está cerrado; no admite visitas nuevas." };
  }

  const nextNumber =
    context.visits.length === 0
      ? 0
      : Math.max(...context.visits.map((v) => v.visitNumber)) + 1;

  const previous = [...context.visits].sort((a, b) =>
    a.date.localeCompare(b.date),
  );
  const previousDate =
    previous.length > 0 ? previous[previous.length - 1].date : null;

  const issues = validateVisitCapture(
    { id: "nueva", visitNumber: nextNumber, date, readings: [] },
    context.points,
    previousDate,
  );
  if (Object.keys(issues.errors).length > 0) {
    return { ok: false, error: Object.values(issues.errors)[0] };
  }

  const { data, error } = await supabase
    .from("settlement_visits")
    .insert({ site_id: siteId, visit_number: nextNumber, date })
    .select("id")
    .single();

  if (error) return { ok: false, error: error.message };

  revalidatePath(`/projects/${projectId}/settlement/${siteId}`);
  return { ok: true, visitId: data.id };
}

/**
 * Guarda una visita: su cabecera y sus lecturas, con los resultados
 * recalculados en el servidor.
 *
 * REVALIDA la captura antes de persistir (decisión #10). La clave publicable de
 * Supabase es pública por diseño, así que una llamada directa a esta acción
 * podría intentar guardar una visita que la interfaz habría bloqueado. Los
 * módulos de poligonal y nivelación nacieron sin esta comprobación y la
 * arrastraron como deuda; este nace con ella.
 */
export async function saveVisitAction(
  projectId: string,
  payload: VisitPayload,
): Promise<ActionResult> {
  const supabase = await createClient();

  const context = await loadContext(supabase, payload.siteId);
  if (!context) return { ok: false, error: "Lugar no encontrado." };
  if (context.site.status === "closed") {
    return { ok: false, error: "El lugar está cerrado; no admite cambios." };
  }

  const { data: visit } = await supabase
    .from("settlement_visits")
    .select("id, status, visit_number")
    .eq("id", payload.visitId)
    .maybeSingle();
  if (!visit) return { ok: false, error: "Visita no encontrada." };
  if (visit.status === "closed") {
    return { ok: false, error: "La visita está cerrada; no admite cambios." };
  }

  // --- Revalidación en el servidor -----------------------------------------
  const others = context.visits
    .filter((v) => v.id !== payload.visitId)
    .sort((a, b) => a.date.localeCompare(b.date));
  const previousDate =
    others.filter((v) => v.date < payload.date).at(-1)?.date ?? null;

  const candidate: VisitInput = {
    id: payload.visitId,
    visitNumber: visit.visit_number,
    date: payload.date,
    readings: payload.readings,
  };

  const issues = validateVisitCapture(candidate, context.points, previousDate);
  if (Object.keys(issues.errors).length > 0) {
    return { ok: false, error: Object.values(issues.errors)[0] };
  }
  for (const [pointId, cellIssues] of Object.entries(issues.readingIssues)) {
    const first = Object.values(cellIssues.errors)[0];
    if (first) {
      const code = context.points.find((p) => p.id === pointId)?.code ?? pointId;
      return { ok: false, error: `${code}: ${first}` };
    }
  }

  // --- Recálculo autoritativo ----------------------------------------------
  const merged = [...others, candidate];
  const history = computeHistory(
    context.points,
    merged,
    thresholdsOf(context.site),
  );
  const computed = history.visits.find((v) => v.visitId === payload.visitId);
  if (!computed) return { ok: false, error: "No se pudo calcular la visita." };

  const { error: headerError } = await supabase
    .from("settlement_visits")
    .update({
      date: payload.date,
      operator: payload.operator,
      equipment: payload.equipment,
      weather_conditions: payload.weatherConditions,
      closure_error_mm: payload.closureErrorMm,
      notes: payload.notes,
      status: payload.readings.length > 0 ? "calculated" : "draft",
    })
    .eq("id", payload.visitId);
  if (headerError) return { ok: false, error: headerError.message };

  // Las lecturas se actualizan con upsert, NO con delete + insert.
  //
  // Corregido en la revisión de la Tarea 9: un `delete` seguido de un `insert`
  // que fallara dejaría la visita sin ninguna lectura y perdería el dato de
  // campo que el usuario ya había capturado — exactamente el daño que este
  // módulo existe para evitar. El `UNIQUE (visit_id, point_id)` hace que el
  // upsert actualice la fila en vez de duplicarla.
  if (computed.readings.length > 0) {
    const { error: upsertError } = await supabase
      .from("settlement_readings")
      .upsert(
        computed.readings.map((r) => ({
          visit_id: payload.visitId,
          point_id: r.pointId,
          elevation: r.elevation,
          partial_settlement: r.partialSettlement,
          accumulated_settlement: r.accumulatedSettlement,
          velocity: r.velocity,
          alert_status: r.alertStatus,
        })),
        { onConflict: "visit_id,point_id" },
      );
    if (upsertError) return { ok: false, error: upsertError.message };
  }

  // Las lecturas de puntos que ya no vienen en el payload se retiran DESPUÉS
  // de que el upsert haya confirmado las vigentes, nunca antes: así ningún
  // fallo intermedio deja la visita sin datos.
  const idsVigentes = computed.readings.map((r) => r.pointId);
  const purga = supabase
    .from("settlement_readings")
    .delete()
    .eq("visit_id", payload.visitId);
  const { error: purgaError } =
    idsVigentes.length > 0
      ? await purga.not("point_id", "in", `(${idsVigentes.join(",")})`)
      : await purga;
  if (purgaError) return { ok: false, error: purgaError.message };

  revalidatePath(`/projects/${projectId}/settlement/${payload.siteId}`);
  return { ok: true };
}

/**
 * Cierra una visita: queda inmutable, con responsable y timestamp (§ 4.6).
 *
 * Exige que todos los puntos del catálogo tengan lectura. NO evalúa los
 * umbrales: una visita con puntos en alarma se cierra con normalidad, porque
 * ese es justo el hallazgo que el monitoreo documenta.
 */
export async function closeVisitAction(
  projectId: string,
  siteId: string,
  visitId: string,
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sesión no válida." };

  const context = await loadContext(supabase, siteId);
  if (!context) return { ok: false, error: "Lugar no encontrado." };

  const visit = context.visits.find((v) => v.id === visitId);
  if (!visit) return { ok: false, error: "Visita no encontrada." };

  // La fecha de la visita cronológicamente anterior a esta. El cierre también
  // comprueba el orden: sellar como inmutable una visita fechada fuera de orden
  // dejaría un intervalo negativo imposible de corregir después.
  const previousDate =
    context.visits
      .filter((v) => v.id !== visitId && v.date < visit.date)
      .sort((a, b) => a.date.localeCompare(b.date))
      .at(-1)?.date ?? null;

  const issues = validateVisitClose(visit, context.points, previousDate);
  if (Object.keys(issues.errors).length > 0) {
    return { ok: false, error: Object.values(issues.errors)[0] };
  }

  const { error } = await supabase
    .from("settlement_visits")
    .update({
      status: "closed",
      closed_at: new Date().toISOString(),
      closed_by: user.id,
    })
    .eq("id", visitId);

  if (error) return { ok: false, error: error.message };

  revalidatePath(`/projects/${projectId}/settlement/${siteId}`);
  return { ok: true };
}
```

- [ ] **Step 4: Typecheck**

```bash
npm run typecheck
```

Esperado: exit 0.

- [ ] **Step 5: Commit**

```bash
git add src/lib/supabase/queries.ts "src/app/(app)/projects/[id]/sites" "src/app/(app)/projects/[id]/settlement"
git commit -m "feat: queries y acciones de sitio y visitas con revalidacion en servidor"
```

---

## Task 10: Rutas del lugar — alta, edición, catálogo y umbrales

**Files:**
- Create: `src/app/(app)/projects/[id]/sites/new/page.tsx`
- Create: `src/app/(app)/projects/[id]/sites/[siteId]/page.tsx`
- Create: `src/components/settlement/site-form.tsx`
- Create: `src/components/settlement/thresholds-fields.tsx`
- Create: `src/components/settlement/points-catalog.tsx`
- Create: `src/app/(app)/projects/[id]/sites/[siteId]/point-actions.ts`

**Interfaces:**
- Consumes: `createSiteAction`, `saveSiteAction`; `thresholdsFor`; `STRUCTURE_TYPES`, `STRUCTURE_TYPE_LABELS`. (`closeSiteAction` NO se consume aquí: el botón «Cerrar Lugar» llega en la Task 14, Step 4.)
- Produces: `SiteForm`, `ThresholdsFields`, `PointsCatalog`; acciones `createPointAction`, `savePointAction`, `deletePointAction`.

**Contexto de patrones:** el formulario en modal con validación en cliente y acción-como-función dentro de `startTransition` está en `src/components/projects/reference-points-manager.tsx` (aprendizaje de la Fase 2). Replicarlo para el catálogo de puntos. **No** usar `setState` dentro de `useEffect`: `react-hooks/set-state-in-effect` es error de lint en este proyecto.

- [ ] **Step 1: Crear `thresholds-fields.tsx`**

Componente controlado con los siete umbrales. Al cambiar el tipo de estructura, el contenedor aplica `thresholdsFor(tipo)` — el propio componente no deriva nada por su cuenta.

```typescript
"use client";

import { Input } from "@/components/design-system";
import type { Thresholds } from "@/types/settlement";

interface ThresholdsFieldsProps {
  value: Thresholds;
  onChange: (value: Thresholds) => void;
  disabled?: boolean;
}

/**
 * Los siete umbrales de alerta de un lugar.
 *
 * El preset lo aplica el contenedor al cambiar el tipo de estructura; aquí solo
 * se editan. Así el usuario puede apartarse del preset sin que un efecto se lo
 * revierta.
 */
export function ThresholdsFields({
  value,
  onChange,
  disabled,
}: ThresholdsFieldsProps) {
  const set = (key: keyof Thresholds) => (raw: string) =>
    onChange({ ...value, [key]: raw === "" ? Number.NaN : Number(raw) });

  return (
    <div className="flex flex-col gap-4">
      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium text-neutral-800">
          Velocidad (mm/mes)
        </legend>
        <div className="grid grid-cols-3 gap-2">
          <Input
            label="Precaución"
            type="number"
            step="0.1"
            value={Number.isFinite(value.velocityCaution) ? String(value.velocityCaution) : ""}
            onChange={(e) => set("velocityCaution")(e.target.value)}
            disabled={disabled}
          />
          <Input
            label="Alerta"
            type="number"
            step="0.1"
            value={Number.isFinite(value.velocityAlert) ? String(value.velocityAlert) : ""}
            onChange={(e) => set("velocityAlert")(e.target.value)}
            disabled={disabled}
          />
          <Input
            label="Alarma"
            type="number"
            step="0.1"
            value={Number.isFinite(value.velocityAlarm) ? String(value.velocityAlarm) : ""}
            onChange={(e) => set("velocityAlarm")(e.target.value)}
            disabled={disabled}
          />
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium text-neutral-800">
          Asentamiento acumulado (mm)
        </legend>
        <div className="grid grid-cols-3 gap-2">
          <Input
            label="Precaución"
            type="number"
            step="0.1"
            value={Number.isFinite(value.accumulatedCaution) ? String(value.accumulatedCaution) : ""}
            onChange={(e) => set("accumulatedCaution")(e.target.value)}
            disabled={disabled}
          />
          <Input
            label="Alerta"
            type="number"
            step="0.1"
            value={Number.isFinite(value.accumulatedAlert) ? String(value.accumulatedAlert) : ""}
            onChange={(e) => set("accumulatedAlert")(e.target.value)}
            disabled={disabled}
          />
          <Input
            label="Alarma"
            type="number"
            step="0.1"
            value={Number.isFinite(value.accumulatedAlarm) ? String(value.accumulatedAlarm) : ""}
            onChange={(e) => set("accumulatedAlarm")(e.target.value)}
            disabled={disabled}
          />
        </div>
      </fieldset>

      <Input
        label="Límite de distorsión angular (1/X)"
        type="number"
        step="1"
        helperText="Un X menor es más severo: 1/300 es peor que 1/500."
        value={
          Number.isFinite(value.angularDistortionLimit)
            ? String(value.angularDistortionLimit)
            : ""
        }
        onChange={(e) => set("angularDistortionLimit")(e.target.value)}
        disabled={disabled}
      />
    </div>
  );
}
```

- [ ] **Step 2: Crear `site-form.tsx`**

Client Component con nombre, descripción, tipo de estructura y `ThresholdsFields`. Al cambiar el tipo, aplica el preset **en el callback del evento**, nunca en un efecto:

```typescript
const handleStructureTypeChange = (tipo: StructureType) => {
  setStructureType(tipo);
  // El preset se aplica aquí y no en un efecto: `react-hooks/set-state-in-effect`
  // es error de lint, y además así el usuario puede editar los umbrales después
  // sin que un efecto se los revierta.
  setThresholds(thresholdsFor(tipo));
};
```

Envía con `startTransition` llamando a la acción como función, y navega con `router.push` al lugar creado.

- [ ] **Step 3: Crear la ruta de alta**

`src/app/(app)/projects/[id]/sites/new/page.tsx` — Server Component que resuelve `params` (async en Next 16), verifica el proyecto con `getProjectById` y renderiza `SiteForm`. Si el proyecto no existe, `notFound()`.

- [ ] **Step 4: Crear las acciones de puntos**

`src/app/(app)/projects/[id]/sites/[siteId]/point-actions.ts` con `createPointAction`, `savePointAction`, `deletePointAction`. Cada una verifica que el lugar no esté cerrado y valida:

```typescript
if (payload.code.trim() === "") {
  return { ok: false, error: "El punto necesita un código." };
}
if (payload.locationDescription.trim() === "") {
  return { ok: false, error: "El punto necesita una descripción de ubicación." };
}
// Las coordenadas son opcionales, pero si viene una debe venir la otra: con
// solo N o solo E no se puede calcular ninguna distancia, y el par quedaría
// silenciosamente fuera de la tabla de diferenciales.
const tieneN = payload.northing !== null;
const tieneE = payload.easting !== null;
if (tieneN !== tieneE) {
  return {
    ok: false,
    error: "Indica las dos coordenadas (N y E) o ninguna.",
  };
}
```

`deletePointAction` debe rechazar el borrado si el punto tiene lecturas en visitas cerradas:

```typescript
const { count } = await supabase
  .from("settlement_readings")
  .select("id, settlement_visits!inner(status)", { count: "exact", head: true })
  .eq("point_id", pointId)
  .eq("settlement_visits.status", "closed");
if ((count ?? 0) > 0) {
  return {
    ok: false,
    error: "El punto tiene lecturas en visitas cerradas y no puede eliminarse.",
  };
}
```

- [ ] **Step 5: Crear `points-catalog.tsx`**

Tabla del catálogo con modal de alta/edición, siguiendo el patrón de `reference-points-manager.tsx`. Columnas: Código, Ubicación, Norte, Este, Cota C0. Si el lugar está cerrado, sin acciones de edición.

- [ ] **Step 6: Crear la ruta del editor del lugar**

`src/app/(app)/projects/[id]/sites/[siteId]/page.tsx` — Server Component que carga `getSite` y `getSitePoints`, y renderiza `SiteForm` (en modo edición) y `PointsCatalog`. `notFound()` si el lugar no existe o es ajeno.

- [ ] **Step 7: Verificar**

```bash
npm run typecheck && npm run lint && npm run build
```

Esperado: exit 0 en los tres. Luego arrancar la app y crear un lugar de prueba.

```bash
rm -rf .next && npm run dev
```

(El `rm -rf .next` evita el problema de rutas estáticas resueltas como dinámicas tras un `build`, aprendizaje de la Fase 3.)

Verificar **contra la base**, no contra la pantalla:

```bash
npx supabase db query "select name, structure_type, accumulated_caution, accumulated_alert, accumulated_alarm from sites order by created_at desc limit 3;"
```

Esperado: al elegir «Presa» los umbrales guardados son 10/25/50; al elegir «Edificio», 25/50/75.

- [ ] **Step 8: Commit**

```bash
git add "src/app/(app)/projects/[id]/sites" src/components/settlement
git commit -m "feat: alta y edicion de lugar con catalogo de puntos y umbrales"
```

---

## Task 11: Editor de visita con cálculo en vivo

**Files:**
- Create: `src/app/(app)/projects/[id]/settlement/[siteId]/visits/[visitId]/page.tsx`
- Create: `src/components/settlement/visit-editor.tsx`
- Create: `src/components/settlement/readings-table.tsx`

**Interfaces:**
- Consumes: `computeHistory`, `classifyAlert`, `validateVisitCapture`; `saveVisitAction`; `getVisit`, `getSitePoints`, `getVisits`.
- Produces: `VisitEditor`, `ReadingsTable`.

- [ ] **Step 1: Crear `readings-table.tsx`**

Tabla con una fila por punto del catálogo. Columnas: Punto, Ubicación, Cota medida (editable), Parcial (mm), Acumulado (mm), Velocidad (mm/mes), Estado.

Reglas de presentación:
- Los valores calculados son **derivados del render**, no estado. Nunca `setState` en efecto.
- Un valor `null` se muestra como `—`, nunca como `NaN` ni `0`. (En la Fase 4 un proceso recién creado llegó a mostrar «NaN mm».)
- El estado usa `<StatusIndicator level={...} label={ALERT_LEVEL_LABELS[...]} />`.
- La línea base (visita 0) no muestra parcial ni velocidad: son `—` por definición.
- Si el lugar o la visita están cerrados, los inputs son de solo lectura.

```typescript
/** Formatea un número calculado, o `—` si no existe. */
function fmt(value: number | null, decimals: number): string {
  return value === null ? "—" : value.toFixed(decimals);
}
```

- [ ] **Step 2: Crear `visit-editor.tsx`**

Client Component orquestador. Estado: la cabecera de la visita y un `Record<pointId, string>` con las cotas en crudo (texto, para no perder lo que el usuario teclea).

El cálculo en vivo se deriva en render:

```typescript
// Derivado en render, no en estado: el cálculo es una función pura de las
// cotas capturadas y del histórico, así que mantenerlo en estado solo abriría
// la puerta a que se desincronice.
const history = useMemo(() => {
  const candidate: VisitInput = {
    id: visit.id,
    visitNumber: visit.visit_number,
    date,
    readings: points
      .filter((p) => rawElevations[p.id]?.trim() !== "" && rawElevations[p.id] !== undefined)
      .map((p) => ({ pointId: p.id, elevation: Number(rawElevations[p.id]) }))
      .filter((r) => Number.isFinite(r.elevation)),
  };
  const merged = [...otherVisits, candidate];
  return computeHistory(pointInputs, merged, thresholds);
}, [rawElevations, date, points, otherVisits, pointInputs, thresholds]);

const computedVisit = history.visits.find((v) => v.visitId === visit.id);
```

Guardar llama a `saveVisitAction` dentro de `startTransition` y muestra el error que devuelva.

- [ ] **Step 3: Crear la ruta**

`src/app/(app)/projects/[id]/settlement/[siteId]/visits/[visitId]/page.tsx` — Server Component. Carga lugar, catálogo, la visita con sus lecturas y las demás visitas con las suyas. `notFound()` si algo no existe.

**Renderizar las migas desde aquí**, no desde el Client Component: la doc técnica registra como deuda que los editores de poligonal y nivelación las metieron dentro del cliente, obligando a pasar `projectName` por la frontera. Este editor no repite el patrón.

- [ ] **Step 4: Verificar**

```bash
npm run typecheck && npm run lint
```

Luego, con la app corriendo: crear un lugar con 2 puntos, una visita 0 y una visita 1, y comprobar que el parcial y la velocidad aparecen al teclear.

**Verificar contra la base:**

```bash
npx supabase db query "select p.code, r.elevation, r.partial_settlement, r.accumulated_settlement, r.velocity, r.alert_status from settlement_readings r join settlement_points p on p.id = r.point_id order by p.code;"
```

Esperado: los valores persistidos coinciden con los de pantalla. Comprobar a mano una velocidad: `parcial / (días/30.4375)`.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(app)/projects/[id]/settlement" src/components/settlement
git commit -m "feat: editor de visita con calculo en vivo de asentamientos"
```

---

## Task 12: Panel de análisis — lista de visitas y diferenciales

**Files:**
- Create: `src/app/(app)/projects/[id]/settlement/[siteId]/page.tsx`
- Create: `src/components/settlement/visits-list.tsx`
- Create: `src/components/settlement/differentials-table.tsx`
- Create: `src/components/settlement/analysis-panel.tsx`

**Interfaces:**
- Consumes: `computeHistory`, `getSite`, `getSitePoints`, `getVisits`, `getSettlementReadingsBySite`; `createVisitAction`.
- Produces: `VisitsList`, `DifferentialsTable`, `AnalysisPanel`.

- [ ] **Step 1: Crear `visits-list.tsx`**

Lista cronológica. Por visita: número (con «Línea base» si es 0), fecha, estado (`Badge`), peor nivel de alerta (`StatusIndicator`), enlace al editor. Botón «+ Nueva Visita» que pide la fecha y llama a `createVisitAction`.

- [ ] **Step 2: Crear `differentials-table.tsx`**

Columnas: Par, Asent. P1 (mm), Asent. P2 (mm), Diferencial (mm), Distancia (m), Distorsión angular, Estado.

```typescript
/**
 * Formatea la distorsión como `1/X`. Un diferencial nulo da `1/∞`, que es
 * normal: dos puntos que se asientan igual no tienen distorsión entre sí.
 */
function formatDistortion(inverse: number): string {
  if (!Number.isFinite(inverse)) return "1/∞";
  return `1/${Math.round(inverse).toLocaleString("es-CO")}`;
}
```

Si la lista está vacía, `EmptyState` explicando el porqué: o no hay dos puntos con coordenadas, o no hay lecturas todavía. **No mostrar una tabla vacía sin explicación** — parecería que no hay distorsión cuando lo que falta es el dato.

- [ ] **Step 3: Crear `analysis-panel.tsx`**

Compone la tabla de diferenciales y el semáforo por punto de la última visita, más el indicador de tendencia por punto (`trends`). La gráfica se añade en la Task 13; dejar el hueco donde irá.

Para la tendencia:

```typescript
const TREND_LABELS: Record<Trend, string> = {
  converging: "Convergente",
  accelerating: "Acelerando",
};
```

Un punto sin entrada en `trends` no muestra nada — con menos de tres visitas no hay tendencia que afirmar.

- [ ] **Step 4: Crear la ruta del panel**

`src/app/(app)/projects/[id]/settlement/[siteId]/page.tsx` — Server Component que carga todo y calcula el histórico en el servidor con `computeHistory`. Renderiza `VisitsList` y `AnalysisPanel`.

- [ ] **Step 5: Verificar**

```bash
npm run typecheck && npm run lint && npm run build
```

Con la app corriendo, comprobar a mano una distorsión: con dos puntos separados 6 m y diferencial 0.7 mm, debe salir `1/8,571`.

- [ ] **Step 6: Commit**

```bash
git add "src/app/(app)/projects/[id]/settlement" src/components/settlement
git commit -m "feat: panel de analisis con lista de visitas y diferenciales"
```

---

## Task 13: Gráfica de asentamiento vs tiempo

**Files:**
- Create: `src/components/settlement/settlement-chart.tsx`
- Create: `src/lib/design/chart-scale.ts`
- Create: `src/lib/design/chart-scale.test.ts`
- Modify: `src/components/settlement/analysis-panel.tsx`

**Interfaces:**
- Consumes: `SettlementHistory`, `SettlementPoint`.
- Produces: `SettlementChart`; `linearScale(domain, range)`, `niceTicks(min, max, count)`.

**Contexto:** SVG a mano, sin librería. Debe ser legible sin color y llevar tabla accesible como alternativa textual.

- [ ] **Step 1: Escribir los tests de la escala**

Crear `src/lib/design/chart-scale.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { linearScale, niceTicks } from "./chart-scale";

describe("linearScale", () => {
  it("mapea el dominio al rango linealmente", () => {
    const s = linearScale([0, 10], [0, 100]);
    expect(s(0)).toBe(0);
    expect(s(5)).toBe(50);
    expect(s(10)).toBe(100);
  });

  it("admite un rango invertido, como el eje Y del SVG", () => {
    const s = linearScale([0, 10], [100, 0]);
    expect(s(0)).toBe(100);
    expect(s(10)).toBe(0);
  });

  it("no divide por cero si el dominio es degenerado", () => {
    // Un solo punto de datos, o todos con el mismo valor.
    const s = linearScale([5, 5], [0, 100]);
    expect(Number.isFinite(s(5))).toBe(true);
  });
});

describe("niceTicks", () => {
  it("devuelve marcas dentro del rango pedido", () => {
    const ticks = niceTicks(0, 100, 5);
    expect(ticks[0]).toBeLessThanOrEqual(0);
    expect(ticks[ticks.length - 1]).toBeGreaterThanOrEqual(100);
  });

  it("no entra en bucle si min y max son iguales", () => {
    const ticks = niceTicks(7, 7, 5);
    expect(ticks.length).toBeGreaterThan(0);
    expect(ticks.length).toBeLessThan(20);
  });
});
```

- [ ] **Step 2: Ejecutar y verificar que falla**

```bash
npm test -- chart-scale
```

Esperado: FAIL.

- [ ] **Step 3: Implementar la escala**

Crear `src/lib/design/chart-scale.ts`:

```typescript
// Escalas para las gráficas SVG. Funciones puras, sin dependencias: el
// proyecto no usa librerías de gráficas (misma regla que el sistema de diseño).

/**
 * Escala lineal de un dominio a un rango.
 *
 * El rango puede ir invertido (`[alto, 0]`), que es lo normal en el eje Y de un
 * SVG, donde y crece hacia abajo.
 *
 * Un dominio degenerado (min = max) devuelve el centro del rango en vez de
 * dividir por cero: ocurre con un solo punto de datos.
 */
export function linearScale(
  [domainMin, domainMax]: [number, number],
  [rangeMin, rangeMax]: [number, number],
): (value: number) => number {
  const domainSpan = domainMax - domainMin;
  if (domainSpan === 0) {
    const center = (rangeMin + rangeMax) / 2;
    return () => center;
  }
  const rangeSpan = rangeMax - rangeMin;
  return (value) => rangeMin + ((value - domainMin) / domainSpan) * rangeSpan;
}

/** Marcas «redondas» que cubren [min, max], aproximadamente `count`. */
export function niceTicks(min: number, max: number, count: number): number[] {
  if (min === max) {
    // Un valor único: una marca a cada lado para que el eje tenga sentido.
    const step = Math.abs(min) > 0 ? Math.abs(min) / 2 : 1;
    return [min - step, min, min + step];
  }

  const span = max - min;
  const rawStep = span / Math.max(1, count);
  const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  const normalized = rawStep / magnitude;
  const niceNormalized =
    normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  const step = niceNormalized * magnitude;

  const start = Math.floor(min / step) * step;
  const end = Math.ceil(max / step) * step;

  const ticks: number[] = [];
  for (let t = start; t <= end + step / 2; t += step) {
    ticks.push(Number(t.toFixed(10)));
  }
  return ticks;
}
```

- [ ] **Step 4: Ejecutar los tests**

```bash
npm test -- chart-scale
```

Esperado: PASS.

- [ ] **Step 5: Crear la gráfica**

Crear `src/components/settlement/settlement-chart.tsx`. Requisitos:

- Una serie por punto seleccionable (checkboxes).
- Eje X: fechas de las visitas. Eje Y: asentamiento acumulado en mm.
- **Cada serie lleva un marcador de forma distinta** (círculo, cuadrado, triángulo, rombo, cruz…), no solo un color: debe leerse en escala de grises.
- `role="img"` con `aria-label` describiendo la gráfica.
- **Tabla accesible** con los mismos datos, visible u oculta con `sr-only`, para que la información no dependa del canal visual.
- `viewBox` con `preserveAspectRatio` y contenedor con `overflow-x: auto`.

```typescript
/** Marcadores por índice de serie. El color solo refuerza; la forma distingue. */
const SERIES_MARKERS = ["circle", "square", "triangle", "diamond", "cross"] as const;
```

- [ ] **Step 6: Insertar la gráfica en el panel**

Sustituir el hueco de la Task 12 en `analysis-panel.tsx`.

- [ ] **Step 7: Verificar**

```bash
npm run typecheck && npm run lint && npm run build
```

Con la app: crear un lugar con 3 visitas y comprobar que la gráfica dibuja la serie. Verificar en escala de grises (DevTools → Rendering → Emulate vision deficiencies → Achromatopsia) que las series se distinguen.

- [ ] **Step 8: Commit**

```bash
git add src/components/settlement src/lib/design/chart-scale.ts src/lib/design/chart-scale.test.ts
git commit -m "feat: grafica de asentamiento vs tiempo en svg propio"
```

---

## Task 14: Cierre de visita y de lugar

**Files:**
- Create: `src/components/settlement/close-visit-dialog.tsx`
- Modify: `src/components/settlement/visit-editor.tsx`
- Modify: `src/app/(app)/projects/[id]/sites/[siteId]/page.tsx`

**Interfaces:**
- Consumes: `closeVisitAction`, `closeSiteAction`.
- Produces: `CloseVisitDialog`.

- [ ] **Step 1: Crear el diálogo de cierre de visita**

Modal con el resumen que pide el § 4.6: fecha, número de puntos medidos, peor nivel de alerta, fecha/hora actual. Checkbox «Confirmo que los datos son correctos» y botón «Confirmar Cierre», deshabilitado mientras el checkbox esté sin marcar.

Incluir una advertencia explícita cuando el peor nivel sea `alert` o `alarm`:

```typescript
{worstAlert === "alarm" || worstAlert === "alert" ? (
  <Alert variant="warning">
    Esta visita registra puntos en {ALERT_LEVEL_LABELS[worstAlert].toLowerCase()}.
    El cierre queda igualmente registrado: el nivel de alerta es un hallazgo del
    monitoreo, no un impedimento.
  </Alert>
) : null}
```

- [ ] **Step 2: Conectar el cierre en el editor**

Botón «Cerrar Visita» que abre el diálogo. Al confirmar, `closeVisitAction` dentro de `startTransition`. Si devuelve error (faltan lecturas), mostrarlo sin cerrar el modal.

- [ ] **Step 3: Modo solo lectura**

Cuando `visit.status === "closed"` o el lugar está cerrado: inputs deshabilitados, sin botón de guardar, y un `Alert` informativo con `closed_at` formateado en `America/Bogota`.

```typescript
const closedLabel = new Intl.DateTimeFormat("es-CO", {
  dateStyle: "long",
  timeStyle: "short",
  timeZone: "America/Bogota",
}).format(new Date(visit.closed_at!));
```

- [ ] **Step 4: Cierre del lugar**

En el editor del lugar, botón «Cerrar Lugar» con confirmación. Advertir que cerrará también toda edición de sus visitas.

- [ ] **Step 5: Verificar el cierre contra la base y contra la API**

```bash
npm run typecheck && npm run lint
```

Con la app: cerrar una visita. Luego comprobar que el trigger la protege incluso saltándose la aplicación:

```bash
npx supabase db query "update settlement_readings set elevation = 1 where visit_id = (select id from settlement_visits where status='closed' limit 1);"
```

Esperado: falla con `restrict_violation` y el mensaje «La visita … está cerrada; sus lecturas son inmutables.»

- [ ] **Step 6: Commit**

```bash
git add src/components/settlement "src/app/(app)/projects/[id]/sites"
git commit -m "feat: cierre de visita y de lugar con trazabilidad"
```

---

## Task 15: Hub — sub-tabs por tipo y terminología

**Files:**
- Modify: `src/app/(app)/projects/[id]/page.tsx`
- Modify: `src/components/projects/new-process-selector.tsx`
- Modify: `src/lib/process-list.ts`

**Interfaces:**
- Consumes: `getSites`, `getVisits`, `getPolygonalProcesses`, `getLevelingProcesses`.
- Produces: sub-tabs `poligonales | nivelaciones | asentamientos` en la tab Procesos.

- [ ] **Step 1: Activar «Control de Asentamientos» en el selector**

En `new-process-selector.tsx`, sustituir el `<Button disabled>` por un enlace, y actualizar el JSDoc:

```typescript
/**
 * Botón "+ Nuevo Proceso" con el selector de tipo. Los tres módulos están
 * disponibles desde la Fase 5.
 */
```

```typescript
<Link
  href={`/projects/${projectId}/sites/new`}
  className={buttonClasses({ variant: "secondary" })}
>
  Control de Asentamientos
</Link>
```

El control de asentamientos empieza creando el lugar, no un proceso: el lugar es lo que agrupa las visitas.

- [ ] **Step 2: Añadir las sub-tabs**

En la tab Procesos del hub, tres sub-tabs navegables por query param (`?tab=procesos&tipo=poligonales`), siguiendo el patrón de las tabs actuales: enlaces desde Server Component con `aria-current`, **no** `<button>` + `router.push` (regla fijada en el plan de estabilización: el filtro debe seguir siendo navegación compartible).

```typescript
const SUBTABS = [
  { key: "poligonales", label: "Poligonales" },
  { key: "nivelaciones", label: "Nivelaciones" },
  { key: "asentamientos", label: "Control de Asentamientos" },
] as const;
```

Cada sub-tab muestra el conteo de su tipo. La de asentamientos lista **lugares** (con su número de visitas y peor alerta), no visitas sueltas.

- [ ] **Step 3: Retirar el filtro por tipo redundante**

El filtro de `tipo` de `process-list.ts` seguía aplicando a poligonales. Al separar por sub-tabs, el filtro de tipo **dentro** de la sub-tab de poligonales sigue siendo útil (cerrada/abierta con control/abierta sin control) — **no retirarlo**. Solo verificar que no colisiona con el nuevo query param; renombrar el de sub-tab a `tipo` sería ambiguo, así que usar `modulo`:

```
?tab=procesos&modulo=asentamientos
```

- [ ] **Step 4: Verificar**

```bash
npm run typecheck && npm run lint && npm run build
```

Con la app: comprobar que las tres sub-tabs listan lo suyo, que el deep-link funciona y que se puede abrir en pestaña nueva.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(app)/projects/[id]" src/components/projects src/lib/process-list.ts
git commit -m "feat: sub-tabs por modulo en el hub y activacion de asentamientos"
```

---

## Task 16: Deuda — revalidación en servidor para poligonal y nivelación

**Files:**
- Modify: `src/app/(app)/projects/[id]/polygonal/[pid]/actions.ts`
- Modify: `src/app/(app)/projects/[id]/leveling/[pid]/actions.ts`
- Modify: `docs/tecnica/README.md`

**Interfaces:**
- Consumes: `validateStationCapture` / equivalente de `validators/polygonal.ts`; `validateRunCapture` de `validators/leveling.ts`.
- Produces: ninguna API nueva; las acciones existentes rechazan capturas inválidas.

**Contexto:** la doc técnica registra esta deuda y dice que lo que la bloqueaba era «qué hacer con procesos históricos que quizá no pasarían la validación actual». **Sin datos de trabajo que preservar, esa pregunta desaparece**: se revalida sin excepciones (decisión #10).

- [ ] **Step 1: Revalidar en `saveLevelingProcessAction`**

En `src/app/(app)/projects/[id]/leveling/[pid]/actions.ts`, después de construir el input y **antes** de `computeLeveling`:

```typescript
import { validateRunCapture } from "@/lib/validators/leveling";

// ...dentro de saveLevelingProcessAction, tras buildInput:
const input = buildInput(payload, order);

// Revalidación en el servidor. La clave publicable de Supabase es pública por
// diseño: una llamada directa a esta acción podría guardar una libreta que la
// interfaz habría bloqueado. Antes solo se recalculaban los resultados, de modo
// que los números eran del servidor pero los datos de campo no se comprobaban.
const forwardIssues = validateRunCapture(input.forward, input.type);
if (forwardIssues.some((i) => Object.keys(i.errors).length > 0)) {
  return {
    ok: false,
    error: "La libreta de ida tiene errores de captura; corrígelos antes de guardar.",
  };
}
if (input.return) {
  const returnIssues = validateRunCapture(input.return, input.type);
  if (returnIssues.some((i) => Object.keys(i.errors).length > 0)) {
    return {
      ok: false,
      error: "La libreta de vuelta tiene errores de captura; corrígelos antes de guardar.",
    };
  }
}

const result = computeLeveling(input);
```

**Antes de escribirlo, verificar la firma real de `validateRunCapture`:**

```bash
grep -n "export function validateRunCapture" -A 10 src/lib/validators/leveling.ts
```

Ajustar la llamada y la forma del resultado a lo que devuelva de verdad.

- [ ] **Step 2: Revalidar en `savePolygonalProcessAction`**

Mismo patrón. Verificar primero qué exporta el validador:

```bash
grep -n "^export function" src/lib/validators/polygonal.ts
```

- [ ] **Step 3: Comprobar que un guardado legítimo sigue funcionando**

Con la app corriendo, abrir un proceso de nivelación del seed, cambiar una lectura por un valor válido y guardar. Debe guardar sin error.

- [ ] **Step 4: Comprobar que rechaza lo inválido**

Desde la consola del navegador, en la página del editor, llamar a la acción con una lectura fuera de rango (por ejemplo `backsight: 99`). Debe devolver `ok: false`.

Alternativa sin consola: modificar temporalmente el editor para saltarse su guard de cliente, guardar, y verificar el rechazo. Revertir después.

**Verificar contra la base** que nada se persistió:

```bash
npx supabase db query "select backsight from leveling_readings where backsight > 4 or backsight < 0;"
```

Esperado: 0 filas.

- [ ] **Step 5: Actualizar la doc técnica**

En `docs/tecnica/README.md` § 11, sustituir el párrafo «**La captura no se revalida en el servidor**…» por:

```markdown
**Cerrado — la captura se revalida en el servidor.** Desde la Fase 5, las tres
acciones de guardado (`savePolygonalProcessAction`, `saveLevelingProcessAction`
y `saveVisitAction`) revalidan los datos de campo con los validadores puros
antes de persistir, además de recalcular los resultados. La clave publicable de
Supabase es pública por diseño, así que una llamada directa a una acción podía
guardar datos que la interfaz habría bloqueado. Lo que retrasaba el retrofit era
qué hacer con procesos históricos que no pasaran la validación actual; al no
haber datos de trabajo que preservar, se aplicó sin excepciones.
```

- [ ] **Step 6: Verificar y commitear**

```bash
npm run typecheck && npm run lint && npm test
```

```bash
git add "src/app/(app)/projects/[id]/polygonal" "src/app/(app)/projects/[id]/leveling" docs/tecnica/README.md
git commit -m "fix: revalidar la captura en el servidor tambien en poligonal y nivelacion"
```

---

## Task 17: Deuda — KPI y conteos con los tres módulos

**Files:**
- Modify: `src/lib/supabase/queries.ts`
- Modify: `docs/tecnica/README.md`

**Interfaces:**
- Consumes: tablas de los tres módulos.
- Produces: `getDashboardKpis` y `getProcessCountsByProject` contando los tres.

**Contexto:** hoy ambas funciones solo consultan `polygonal_processes` (`queries.ts:49` y `:98`), así que nivelación ya es invisible en el dashboard. Sin este cambio, un proyecto solo de asentamientos mostraría «0 procesos».

- [ ] **Step 1: Extender `getDashboardKpis`**

Añadir las consultas de nivelación y de visitas de asentamientos a las tres que ya hay, y sumar:

```typescript
// Los KPI cuentan los tres módulos desde la Fase 5. Antes solo miraban
// polygonal_processes, de modo que un proyecto de nivelación o de asentamientos
// aparecía vacío en el dashboard.
const [
  { count: activeProjectsCount },
  { count: polygonalCalculated },
  { count: polygonalOutOfTolerance },
  { count: levelingCalculated },
  { count: levelingOutOfTolerance },
  { count: settlementCalculated },
  { count: settlementAlarming },
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
  supabase
    .from("settlement_visits")
    .select("id, sites!inner(project_id, projects!inner(status))", {
      count: "exact",
      head: true,
    })
    .eq("status", "calculated")
    .eq("sites.projects.status", "active"),
  // «Fuera de tolerancia» no aplica a una visita: lo equivalente es que algún
  // punto esté en alerta o alarma.
  supabase
    .from("settlement_readings")
    .select(
      "id, settlement_visits!inner(status, sites!inner(projects!inner(status)))",
      { count: "exact", head: true },
    )
    .in("alert_status", ["alert", "alarm"])
    .eq("settlement_visits.sites.projects.status", "active"),
]);

return {
  activeProjects: activeProjectsCount ?? 0,
  calculatedProcesses:
    (polygonalCalculated ?? 0) +
    (levelingCalculated ?? 0) +
    (settlementCalculated ?? 0),
  outOfTolerance:
    (polygonalOutOfTolerance ?? 0) +
    (levelingOutOfTolerance ?? 0) +
    (settlementAlarming ?? 0),
};
```

- [ ] **Step 2: Extender `getProcessCountsByProject`**

```typescript
/**
 * Cuántos procesos tiene cada proyecto, indexado por `project_id`.
 *
 * Cuenta los tres módulos desde la Fase 5: poligonales, nivelaciones y lugares
 * de control de asentamientos. Un lugar cuenta como uno, no una vez por visita:
 * lo que el usuario reconoce como «un trabajo» es el monitoreo del lugar.
 *
 * Tres consultas en paralelo en lugar de una por proyecto: con N proyectos en
 * pantalla, contar por separado sería N+1 viajes a la base. RLS ya limita las
 * filas a las del usuario.
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
```

**Ojo con el lugar «General»** que creó la migración: cuenta como un proceso más en los proyectos que ya tenían procesos. Es correcto conceptualmente (es un lugar real), pero conviene comprobar que el número mostrado tiene sentido tras el seed nuevo de la Task 18.

- [ ] **Step 3: Actualizar la doc técnica**

Sustituir en § 11 el párrafo de `getProcessCountsByProject` por uno que refleje el estado nuevo, conservando la observación sobre el desglose por estado, que sigue vigente:

```markdown
**`getProcessCountsByProject` no distingue el estado del proceso.** La tarjeta
dice «7 procesos» contando borradores, calculados, cerrados y rechazados por
igual. Desde la Fase 5 cuenta los tres módulos (poligonales, nivelaciones y
lugares de control de asentamientos, un lugar = un trabajo). Sigue sin haber
desglose del tipo «7 procesos (2 cerrados)».
```

- [ ] **Step 4: Verificar**

```bash
npm run typecheck && npm run lint && npm run build
```

Con la app, comparar el KPI del dashboard contra la base:

```bash
npx supabase db query "select (select count(*) from polygonal_processes where status='calculated') as pol, (select count(*) from leveling_processes where status='calculated') as lev, (select count(*) from settlement_visits where status='calculated') as vis;"
```

Esperado: la suma coincide con «procesos calculados» del dashboard.

- [ ] **Step 5: Commit**

```bash
git add src/lib/supabase/queries.ts docs/tecnica/README.md
git commit -m "fix: los KPI y los conteos por proyecto cuentan los tres modulos"
```

---

## Task 18: Seed con serie temporal

**Files:**
- Modify: `scripts/seed.mjs`
- Modify: `src/lib/demo/fixtures.ts`
- Modify: `src/lib/demo/crear-proyecto-demo.ts`

**Interfaces:**
- Consumes: `computeHistory`, `thresholdsFor`.
- Produces: seed con lugares y un lugar de monitoreo con 6 visitas.

**Contexto:** los resultados que se persisten **los calcula el motor real**, nunca se escriben a mano — es la estrategia que ya siguen `seed.mjs` y `crear-proyecto-demo.ts`.

- [ ] **Step 1: Añadir lugares al seed**

Cada proyecto del seed necesita al menos un lugar, porque `site_id` es NOT NULL. Crear un lugar por proyecto antes de insertar sus procesos, y pasar su id.

- [ ] **Step 2: Añadir el lugar de monitoreo con su serie**

Un lugar `structure_type: 'edificio'` con 6 puntos en grilla (coordenadas N/E reales, para que haya diferenciales) y 6 visitas mensuales. Las cotas se diseñan para que la serie **converja** —asentamiento rápido al principio, desacelerando— y para que **al menos un punto entre en alerta**, de modo que el semáforo y las tendencias tengan algo que mostrar en las capturas del manual.

```javascript
// Serie de un edificio sobre arcilla blanda: asentamiento rápido inicial que
// desacelera hasta converger. Las cotas se eligen a mano; los asentamientos,
// velocidades y niveles de alerta los calcula computeHistory, nunca se escriben
// a mano. Un punto (P-06, esquina) se lleva a alerta a propósito para que el
// semáforo y el indicador de tendencia tengan algo que mostrar.
const VISITAS_MONITOREO = [
  { number: 0, date: "2025-01-15", cotas: { /* todos a 100.0000 */ } },
  { number: 1, date: "2025-02-15", cotas: { /* ... */ } },
  // ...
];
```

Insertar las lecturas con los resultados que devuelva `computeHistory`.

- [ ] **Step 3: Verificar el seed contra la base**

```bash
npx supabase db reset
node --env-file=.env.local scripts/seed.mjs
```

```bash
npx supabase db query "select s.name, count(distinct v.id) as visitas, count(r.id) as lecturas from sites s left join settlement_visits v on v.site_id = s.id left join settlement_readings r on r.visit_id = v.id group by s.name;"
```

Esperado: el lugar de monitoreo con 6 visitas y 36 lecturas.

Comprobar que el nivel de alerta se calculó y no quedó en el default:

```bash
npx supabase db query "select alert_status, count(*) from settlement_readings group by alert_status;"
```

Esperado: más de un valor distinto — si todo es `normal`, el motor no se aplicó o la serie es demasiado suave.

- [ ] **Step 4: Verificar una velocidad a mano**

```bash
npx supabase db query "select p.code, v.date, r.partial_settlement, r.velocity from settlement_readings r join settlement_visits v on v.id = r.visit_id join settlement_points p on p.id = r.point_id where p.code = 'P-06' order by v.date;"
```

Comprobar con calculadora que `velocity = partial_settlement / (días/30.4375)` en al menos dos filas.

- [ ] **Step 5: Actualizar el proyecto demo**

`crear-proyecto-demo.ts` también inserta procesos y necesita un lugar. Añadir la creación del lugar antes, y verificar que las políticas RLS de inserción lo permiten con el cliente del usuario (no con la clave secreta).

Comprobar registrando un usuario nuevo en la app y viendo que su proyecto de ejemplo se crea sin error.

- [ ] **Step 6: Commit**

```bash
git add scripts/seed.mjs src/lib/demo
git commit -m "feat: seed con lugares y serie temporal de monitoreo"
```

---

## Task 19: Verificación end-to-end, documentación y cierre

**Files:**
- Modify: `docs/tecnica/README.md`
- Modify: `docs/manual/README.md`
- Modify: `src/app/(app)/manual/` (el mismo texto, maquetado)
- Modify: `docs/method.md`, `docs/prds/README.md`, `docs/prds/04-asentamientos.md`

**Contexto:** el texto del manual vive **por duplicado** en `docs/manual/README.md` y en la ruta `/manual`, sin generación automática. Al editar uno hay que editar el otro **en el mismo commit** (regla de `CLAUDE.md`).

- [ ] **Step 1: Recorrer los criterios de aceptación a–u**

Ejecutar uno por uno los 21 criterios de `docs/prds/04-asentamientos.md`. Anotar el resultado de cada uno. **No dar por bueno ninguno sin ejecutarlo**: el aprendizaje de la Fase 4 es que los fallos de este dominio salen como números plausibles, no como errores.

Los que exigen atención especial:
- **(b)** los tests de velocidad con los cinco intervalos.
- **(i)** la gráfica legible sin color — comprobar con emulación de acromatopsia.
- **(m)** un dato en alarma **no** impide guardar ni cerrar.
- **(p)/(q)** la revalidación rechaza llamadas directas.
- **(r)** los 4 niveles se distinguen sin color.
- **(t)** el trigger protege una visita cerrada vía API REST.

**Cómo verificar (s) — RLS entre usuarios.** Es el criterio que más fácilmente
se marca a ojo sin comprobarlo. Hace falta un segundo usuario:

```bash
npx supabase db query "select id, email from auth.users;"
```

Con dos usuarios en local, registrar el segundo desde la app, crear un lugar con
él y anotar su id. Luego, con la sesión del primero, intentar abrir
`/projects/<idAjeno>/settlement/<siteIdAjeno>`: debe dar 404, no el contenido.

Y comprobarlo también en la capa de datos, que es donde vive la garantía:

```bash
npx supabase db query "set local role authenticated; set local request.jwt.claims = '{\"sub\":\"<UUID_USUARIO_1>\"}'; select count(*) from sites;"
```

Esperado: solo cuenta los lugares del usuario 1, no los del 2. Repetir con
`settlement_visits` y `settlement_readings`, que dependen de joins de dos y tres
niveles y son donde una política mal escrita se escapa.

- [ ] **Step 2: Suite completa**

```bash
npm run typecheck && npm run lint && npm test && npm run build
```

Esperado: exit 0 en los cuatro.

- [ ] **Step 3: Regenerar las capturas del manual**

```bash
node docs/manual/capturas.mjs
```

- [ ] **Step 4: Mover asentamientos al cuerpo del manual**

En `docs/manual/README.md`, sacar «Control de Asentamientos» de «Módulos pendientes» y redactar su sección: crear un lugar, catalogar puntos, registrar visitas, leer el semáforo y la gráfica, cerrar.

Explicar en términos del usuario **qué significa cada nivel** y que un dato en alarma se registra igual. Y decir explícitamente que la velocidad se calcula con los días reales entre visitas.

- [ ] **Step 5: Replicar el texto en `/manual`**

El mismo contenido maquetado con el sistema de diseño en `src/app/(app)/manual/`. **Mismo commit** que el paso anterior.

- [ ] **Step 6: Actualizar la doc técnica**

En `docs/tecnica/README.md`:
- Estado de fases: Fase 5 cerrada.
- Tabla de pruebas: los tests nuevos.
- § 11 Deuda técnica: retirar las dos deudas cerradas (semáforo, revalidación) — ya reescritas en las Tasks 16 y 17; **verificar que no quede texto contradictorio**. El cierre del plan de estabilización enseñó que hacen falta dos rondas para cazar afirmaciones que dejaron de ser ciertas: releer la § 11 entera al final, no solo los párrafos tocados.
- Documentar el módulo nuevo en la sección de arquitectura.

- [ ] **Step 7: Anotar deuda nueva, si la hay**

Candidatas conocidas:
- El lugar «General» creado por la migración es un artefacto: los proyectos que ya tenían procesos arrastran un lugar sin significado real.
- Los diferenciales solo se calculan sobre la última visita; ver su evolución en el tiempo exigiría otra vista.

- [ ] **Step 8: Cerrar la fase**

En `docs/prds/04-asentamientos.md`: estado `cerrada` y fecha de cierre.
En `docs/method.md` y `docs/prds/README.md`: estado `cerrada`.
En `docs/method.md`, añadir la entrada de aprendizajes del cierre de la Fase 5 con: qué supuesto del PRD resultó incorrecto, qué patrón funcionó, y lo que enseñó la verificación del marco teórico por tercera vez.

- [ ] **Step 9: Commit de cierre**

```bash
git add -A
git commit -m "docs: cerrar fase 5 — control de asentamientos"
```

---

## Notas de ejecución

**Orden de dependencias:** las Tasks 1–2 son el cimiento (nada compila sin ellas). Las 3–7 son puras y testeables sin UI. La 8 es independiente de las 3–7 y puede adelantarse. Las 9–15 dependen de las anteriores en cadena. Las 16–17 son deuda y podrían ejecutarse en paralelo a las 10–15 por tocar archivos distintos, pero conviene dejarlas después para no mezclar cambios de módulos distintos en la misma sesión de revisión.

**Si el alcance aprieta:** el PRD fija el orden de sacrificio — lo primero que se difiere es la gráfica (Task 13, criterio `i`), nunca la revalidación en servidor (Tasks 9 y 16).

**Regla de verificación:** toda comprobación de datos se hace contra la base con `npx supabase db query`, no leyendo la pantalla. En la Fase 4 un fallo se creyó inexistente porque el guard del cliente parecía cubrirlo, y solo al consultar la tabla se vio que el dato rancio sí se persistía.
