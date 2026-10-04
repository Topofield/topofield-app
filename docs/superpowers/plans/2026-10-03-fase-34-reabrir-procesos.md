# Fase 34 — Reabrir procesos · Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Un proceso cerrado o rechazado (poligonal, nivelación), una visita cerrada y un lugar cerrado se pueden reabrir con un botón «Reabrir», en cualquier momento, y se vuelven a cerrar con el cierre de siempre.

**Architecture:** Los triggers de cabecera aceptan una sola transición nueva: la que sale de cerrado cambiando solo `status`, `closed_at` y `closed_by`. La comprobación vive en un helper SQL `is_reopening()` que usan los dos triggers. Las reglas y los textos de la app viven en un módulo puro, `src/lib/reopen.ts`; cuatro Server Actions los aplican. Un diálogo único, `ReopenDialog`, recibe la acción ya ligada a su id.

**Tech Stack:** Next.js 16 (App Router, Server Actions), React 19, TypeScript, Supabase (PostgreSQL, pgTAP), Vitest, Tailwind v4 con el sistema de diseño propio.

**Spec:** `docs/prds/33-reabrir-procesos.md`

## Global Constraints

- Trabajar en el worktree `/home/kris/topofield-app/.claude/worktrees/fase-34-reabrir-procesos`, rama `fase-34-reabrir-procesos`. No tocar la carpeta principal: la Fase 33 está en curso allí.
- Interfaz en español (Colombia), tuteo en la app (`Guárdalos`, `reábrelo`), usted en el manual (`Cree`, `reabra`).
- Commits en español con prefijo `feat:`, `fix:`, `refactor:` o `docs:`, uno por cambio lógico, terminados en `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- `npm run typecheck` después de cada cambio de código.
- Migraciones a mano en `supabase/migrations/`; las ya aplicadas no se editan.
- Al reabrir, el estado es `calculated` (proceso y visita) o `active` (lugar), con `closed_at` y `closed_by` en null (PRD, decisión 5).
- La base admite solo la transición pura: reabrir no cambia ninguna otra columna (PRD, decisión 9).
- No usar shadcn/ui: `Button`, `Modal` y `Alert` vienen de `@/components/design-system`.
- Base local compartida con la otra sesión: **no** usar `npx supabase db reset`. La migración se aplica con `npx supabase migration up --local`.
- Lo que se reabra en la verificación en pantalla se vuelve a cerrar al terminar: las capturas del manual de la otra sesión usan esos datos.

## Review Focus

- **El editor tras reabrir:** `PolygonalEditor` y `LevelingEditor` inician su estado con `useState(props)`. Tras reabrir, `readOnly` se recalcula del prop, y la barra de Guardar/Cerrar debe aparecer y funcionar sin recargar la página. Lo prueba la Tarea 7, pasos 2 y 4.
- **Reabrir dos veces** (otra pestaña, doble clic): la segunda llamada debe devolver «El proceso no está cerrado.» y el diálogo mostrarlo, sin error de base. Lo cubre `reopenBlocker` (Tarea 2) y la Tarea 7, paso 3.
- **Una poligonal cerrada y georreferenciada** se reabre conservando la posición georreferenciada. Lo prueba el pgTAP de la Tarea 1 (georreferencia y después reabre).
- **El informe consolidado con un proceso reabierto** muestra «—» en su registro de cierre, sin romperse. Lo prueba la Tarea 7, paso 6.
- **La cabecera en el móvil**, con un botón más: a 390 px no hay desborde horizontal. Lo prueba la Tarea 7, paso 7.

---

### Task 1: La base admite reabrir

**Files:**
- Create: `supabase/tests/reabrir_procesos.test.sql`
- Create: `supabase/migrations/20261003000000_reabrir_procesos.sql`

**Interfaces:**
- Produces: `public.is_reopening(old_row jsonb, new_row jsonb) returns boolean`. Los triggers `reject_update_on_closed_process()` y `reject_update_on_closed_polygonal_process()` dejan pasar la reapertura.

- [ ] **Step 1: Comprobar que la base local está arriba**

Run: `docker ps --format '{{.Names}}' | grep supabase_db_topofield-app`
Expected: `supabase_db_topofield-app`. Si sale vacío, ver la memoria «Entorno local» (dos motores de Docker) y parar a preguntar.

- [ ] **Step 2: Escribir la prueba pgTAP**

`supabase/tests/reabrir_procesos.test.sql`:

```sql
-- ============================================================================
-- Fase 34 — Reabrir procesos
-- ============================================================================
-- `npx supabase test db`. Datos propios en una transacción que se deshace.
-- ============================================================================

begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(22);

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-00000000a341', 'reabrir@topofield.test');
insert into public.projects (id, user_id, name, client, location) values
  ('00000000-0000-4000-8000-00000000b341', '00000000-0000-4000-8000-00000000a341',
   'Reabrir', 'Pruebas', 'Local');
insert into public.sites (id, project_id, name, structure_type, kind) values
  ('00000000-0000-4000-8000-00000000c341', '00000000-0000-4000-8000-00000000b341',
   'Agrupación', 'otro', 'grouping'),
  ('00000000-0000-4000-8000-00000000c342', '00000000-0000-4000-8000-00000000b341',
   'Edificio', 'edificio', 'settlement');

insert into public.polygonal_processes
  (id, project_id, site_id, name, type, start_point_code, start_north, start_east, status)
values
  ('00000000-0000-4000-8000-00000000d341', '00000000-0000-4000-8000-00000000b341',
   '00000000-0000-4000-8000-00000000c341', 'Poligonal', 'closed', 'E1', 1000, 1000, 'calculated');
insert into public.polygonal_stations (id, process_id, station_order, point_code, north, east) values
  ('00000000-0000-4000-8000-00000000d342', '00000000-0000-4000-8000-00000000d341', 1, 'E1', 1000, 1000);

insert into public.leveling_processes
  (id, project_id, site_id, name, type, start_bm_code, start_bm_elevation)
values
  ('00000000-0000-4000-8000-00000000e341', '00000000-0000-4000-8000-00000000b341',
   '00000000-0000-4000-8000-00000000c341', 'Nivelación', 'open', 'BM1', 2600);
insert into public.leveling_readings (process_id, run_type, reading_order, point_code, point_type, backsight) values
  ('00000000-0000-4000-8000-00000000e341', 'forward', 1, 'BM1', 'bm', 1.5);

insert into public.settlement_points (id, site_id, code, location_description, initial_elevation) values
  ('00000000-0000-4000-8000-00000000f341', '00000000-0000-4000-8000-00000000c342', 'P1', 'Esquina', 100);
insert into public.settlement_visits (id, site_id, visit_number, date) values
  ('00000000-0000-4000-8000-0000000f3410', '00000000-0000-4000-8000-00000000c342', 0, '2026-01-10');
insert into public.settlement_readings (visit_id, point_id, elevation) values
  ('00000000-0000-4000-8000-0000000f3410', '00000000-0000-4000-8000-00000000f341', 100);

-- Todo cerrado como lo deja la app: estado, fecha y responsable. La visita
-- antes que el lugar: con el lugar cerrado ya no se escribe.
update public.polygonal_processes
   set status = 'closed', closed_at = now(), closed_by = '00000000-0000-4000-8000-00000000a341'
 where id = '00000000-0000-4000-8000-00000000d341';
update public.leveling_processes
   set status = 'rejected', closed_at = now(), closed_by = '00000000-0000-4000-8000-00000000a341'
 where id = '00000000-0000-4000-8000-00000000e341';
update public.settlement_visits
   set status = 'closed', closed_at = now(), closed_by = '00000000-0000-4000-8000-00000000a341'
 where id = '00000000-0000-4000-8000-0000000f3410';
update public.sites
   set status = 'closed', closed_at = now(), closed_by = '00000000-0000-4000-8000-00000000a341'
 where id = '00000000-0000-4000-8000-00000000c342';

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-00000000a341","role":"authenticated"}', true);

-- --- Poligonal cerrada ------------------------------------------------------
select throws_ok(
  $$ update polygonal_processes set name = 'Otra' where id = '00000000-0000-4000-8000-00000000d341' $$,
  '23001', null, 'poligonal cerrada: un cambio normal sigue rechazado');
select throws_ok(
  $$ update polygonal_processes set status = 'calculated', closed_at = null, closed_by = null, name = 'Otra'
      where id = '00000000-0000-4000-8000-00000000d341' $$,
  '23001', null, 'poligonal: reabrir y cambiar otra columna a la vez se rechaza');
select throws_ok(
  $$ update polygonal_processes set status = 'calculated' where id = '00000000-0000-4000-8000-00000000d341' $$,
  '23001', null, 'poligonal: reabrir sin borrar el registro de cierre se rechaza');
select lives_ok(
  $$ update polygonal_processes set start_north = 1001 where id = '00000000-0000-4000-8000-00000000d341' $$,
  'poligonal cerrada: la posición se sigue georreferenciando (Fase 15)');
select throws_ok(
  $$ insert into polygonal_stations (process_id, station_order, point_code, north, east)
     values ('00000000-0000-4000-8000-00000000d341', 2, 'E2', 1010, 1010) $$,
  '23001', null, 'poligonal cerrada: sus estaciones siguen inmutables');
select lives_ok(
  $$ update polygonal_processes set status = 'calculated', closed_at = null, closed_by = null
      where id = '00000000-0000-4000-8000-00000000d341' $$,
  'poligonal: reabrir pasa');
select is(
  (select status || ':' || coalesce(closed_by, '-') || ':' || start_north::text
     from polygonal_processes where id = '00000000-0000-4000-8000-00000000d341'),
  'calculated:-:1001.0000', 'poligonal reabierta: calculada, sin responsable y con su posición');
select lives_ok(
  $$ update polygonal_processes set name = 'Otra' where id = '00000000-0000-4000-8000-00000000d341' $$,
  'poligonal reabierta: se edita');
select lives_ok(
  $$ insert into polygonal_stations (process_id, station_order, point_code, north, east)
     values ('00000000-0000-4000-8000-00000000d341', 2, 'E2', 1010, 1010) $$,
  'poligonal reabierta: sus estaciones también');

-- --- Nivelación rechazada ---------------------------------------------------
select throws_ok(
  $$ delete from leveling_processes where id = '00000000-0000-4000-8000-00000000e341' $$,
  '23001', null, 'nivelación rechazada: no se borra');
select throws_ok(
  $$ update leveling_processes set status = 'calculated', closed_at = null, closed_by = null,
            start_bm_elevation = 2601 where id = '00000000-0000-4000-8000-00000000e341' $$,
  '23001', null, 'nivelación: reabrir y cambiar otra columna a la vez se rechaza');
select lives_ok(
  $$ update leveling_processes set status = 'calculated', closed_at = null, closed_by = null
      where id = '00000000-0000-4000-8000-00000000e341' $$,
  'nivelación rechazada: reabrir pasa');
select lives_ok(
  $$ insert into leveling_readings (process_id, reading_order, point_code, point_type, foresight)
     values ('00000000-0000-4000-8000-00000000e341', 2, 'R-1', 'intermediate', 1.4) $$,
  'nivelación reabierta: admite lecturas');

-- --- Lugar y visita ---------------------------------------------------------
select throws_ok(
  $$ update settlement_visits set status = 'calculated', closed_at = null, closed_by = null
      where id = '00000000-0000-4000-8000-0000000f3410' $$,
  '23001', null, 'con el lugar cerrado, la visita no se reabre');
select throws_ok(
  $$ update sites set name = 'Otro' where id = '00000000-0000-4000-8000-00000000c342' $$,
  '23001', null, 'lugar cerrado: un cambio normal sigue rechazado');
select throws_ok(
  $$ update sites set status = 'active', closed_at = null, closed_by = null, name = 'Otro'
      where id = '00000000-0000-4000-8000-00000000c342' $$,
  '23001', null, 'lugar: reabrir y cambiar otra columna a la vez se rechaza');
select lives_ok(
  $$ update sites set status = 'active', closed_at = null, closed_by = null
      where id = '00000000-0000-4000-8000-00000000c342' $$,
  'lugar: reabrir pasa');
select is(
  (select status from settlement_visits where id = '00000000-0000-4000-8000-0000000f3410'),
  'closed', 'reabrir el lugar no reabre sus visitas');
select throws_ok(
  $$ update settlement_readings set elevation = 99.99
      where visit_id = '00000000-0000-4000-8000-0000000f3410' $$,
  '23001', null, 'la visita sigue cerrada: sus lecturas no cambian');
select lives_ok(
  $$ update settlement_visits set status = 'calculated', closed_at = null, closed_by = null
      where id = '00000000-0000-4000-8000-0000000f3410' $$,
  'con el lugar abierto, la visita se reabre');
select lives_ok(
  $$ update settlement_readings set elevation = 99.99
      where visit_id = '00000000-0000-4000-8000-0000000f3410' $$,
  'visita reabierta: sus lecturas cambian');
select lives_ok(
  $$ update settlement_points set initial_elevation = 100.01
      where id = '00000000-0000-4000-8000-00000000f341' $$,
  'sin visitas cerradas que lo midan, la C0 del punto vuelve a cambiar');

select * from finish();
rollback;
```

- [ ] **Step 3: Correr la prueba y ver que falla**

Run: `npx supabase test db 2>&1 | tail -25`
Expected: FAIL en `reabrir_procesos.test.sql`: las pruebas «reabrir pasa» y las que dependen de ellas fallan con `restrict_violation`. Las que comprueban rechazos siguen pasando.

- [ ] **Step 4: Escribir la migración**

`supabase/migrations/20261003000000_reabrir_procesos.sql`:

```sql
-- ============================================================================
-- Fase 34 — Reabrir procesos
-- ============================================================================
-- Ver docs/prds/33-reabrir-procesos.md.
--
-- Hasta hoy un proceso cerrado no volvía atrás: los triggers rechazaban todo
-- UPDATE de una fila cerrada o rechazada. Desde esta fase, una poligonal, una
-- nivelación, una visita y un lugar se pueden reabrir en cualquier momento
-- (decisión del usuario).
--
-- Reabrir es lo contrario de cerrar, que escribe solo `status`, `closed_at` y
-- `closed_by`: el estado vuelve a uno abierto y el registro de cierre queda
-- vacío. Los triggers admiten esa transición y nada más (decisión 9): si el
-- mismo UPDATE cambia cualquier otra columna, se rechaza como siempre. Primero
-- se reabre; después se edita, como cualquier abierto.
--
-- Los triggers de los hijos (estaciones, lecturas, libreta), el de las visitas
-- de un lugar cerrado y el de la C0 no cambian: miran el estado ACTUAL del
-- padre, así que se liberan solos al reabrirlo.
-- ============================================================================

-- ¿Este UPDATE es exactamente reabrir? Las filas llegan como jsonb para servir
-- a cualquier tabla con `status`, `closed_at` y `closed_by`.
create function public.is_reopening(old_row jsonb, new_row jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select new_row ->> 'status' not in ('closed', 'rejected')
     and new_row -> 'closed_at' = 'null'::jsonb
     and new_row -> 'closed_by' = 'null'::jsonb
     -- `updated_at` lo pone `set_updated_at`; va en la lista para no depender
     -- del orden alfabético de los triggers, como en la Fase 15.
     and (new_row - array['status', 'closed_at', 'closed_by', 'updated_at'])
         is not distinct from
         (old_row - array['status', 'closed_at', 'closed_by', 'updated_at']);
$$;

-- --- Nivelación, lugares y visitas ------------------------------------------

create or replace function public.reject_update_on_closed_process()
returns trigger
language plpgsql
as $$
begin
  -- Solo se protegen las filas que YA estaban cerradas antes de este UPDATE.
  -- La transición hacia cerrado (el cierre propiamente dicho) sigue permitida,
  -- y desde la Fase 34 también la de salida: reabrir.
  if old.status in ('closed', 'rejected') then
    if public.is_reopening(to_jsonb(old), to_jsonb(new)) then
      return new;
    end if;
    raise exception
      'El proceso % está cerrado (%) y es inmutable.', old.id, old.status
      using errcode = 'restrict_violation';
  end if;
  return new;
end;
$$;

-- --- Poligonal ----------------------------------------------------------------
-- La misma función de la Fase 15, con la reapertura antes de la excepción de
-- posición: reabrir cambia `status`, que no está en la lista blanca.

create or replace function public.reject_update_on_closed_polygonal_process()
returns trigger
language plpgsql
as $$
declare
  -- Lo único que puede cambiar en un proceso cerrado: su posición.
  position_columns text[] := array[
    'start_north', 'start_east',
    'start_azimuth_deg', 'start_azimuth_min', 'start_azimuth_sec',
    'end_north', 'end_east',
    'end_azimuth_deg', 'end_azimuth_min', 'end_azimuth_sec',
    'reference_point_id',
    'georef_at', 'georef_by', 'georef_point_a_code', 'georef_point_b_code',
    'georef_rotation_deg', 'georef_rotation_min', 'georef_rotation_sec',
    'georef_scale_factor',
    -- Lo pone `polygonal_processes_set_updated_at`. Sin él en la lista, la
    -- excepción dependería de que ese trigger dispare después de este, que
    -- hoy solo lo decide el orden alfabético de sus nombres.
    'updated_at'
  ];
begin
  if old.status in ('closed', 'rejected') then
    if public.is_reopening(to_jsonb(old), to_jsonb(new)) then
      return new;
    end if;
    if (to_jsonb(new) - position_columns) is distinct from (to_jsonb(old) - position_columns) then
      raise exception
        'El proceso % está cerrado (%): solo puede cambiar su posición.', old.id, old.status
        using errcode = 'restrict_violation';
    end if;
    -- El amarre del catálogo solo puede soltarse (pasar a manual), no cambiar
    -- por otro: la poligonal cerrada no se midió contra él.
    if new.reference_point_id is not null
       and new.reference_point_id is distinct from old.reference_point_id then
      raise exception
        'El proceso % está cerrado (%): su amarre solo puede pasar a manual.', old.id, old.status
        using errcode = 'restrict_violation';
    end if;
  end if;
  return new;
end;
$$;
```

- [ ] **Step 5: Aplicar la migración a la base local, sin reset**

Run: `npx supabase migration up --local 2>&1 | tail -5`
Expected: `Applying migration 20261003000000_reabrir_procesos.sql...` y sin error.

- [ ] **Step 6: Correr las pruebas de la base**

Run: `npx supabase test db 2>&1 | tail -25`
Expected: todas pasan, `reabrir_procesos.test.sql` incluida (22 pruebas). `start_north` es `decimal(12,4)`, de ahí `1001.0000` en el literal esperado.

- [ ] **Step 7: Comprobar que los tipos no cambian**

Run: `npx supabase gen types typescript --local 2>/dev/null > /tmp/claude-1000/-home-kris-topofield-app/9c3cf1bd-b896-4932-b40c-bef236e6868e/scratchpad/db.ts && grep -n -A6 "is_reopening" /tmp/claude-1000/-home-kris-topofield-app/9c3cf1bd-b896-4932-b40c-bef236e6868e/scratchpad/db.ts`
Expected: el generador lista `is_reopening` en `Functions`. Añadir a mano en `src/types/database.ts`, dentro de `public.Functions` y en orden alfabético, solo esa entrada, copiada del archivo generado. Después, `npm run typecheck` pasa.

- [ ] **Step 8: Commit**

```bash
git add supabase/migrations/20261003000000_reabrir_procesos.sql supabase/tests/reabrir_procesos.test.sql src/types/database.ts
git commit -m "feat: la base admite reabrir un proceso, una visita o un lugar

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Reglas y textos de reabrir

**Files:**
- Create: `src/lib/reopen.ts`
- Test: `src/lib/reopen.test.ts`
- Modify: `docs/prds/33-reabrir-procesos.md` (sección «Pruebas mínimas», línea de Vitest)

**Interfaces:**
- Produces:
  - `type ReopenTarget = "process" | "visit" | "site"`
  - `reopenPatch(target): { status: "calculated" | "active"; closed_at: null; closed_by: null }`
  - `reopenBlocker(target: ReopenTarget, status: string, siteStatus?: string): string | null`
  - `reportsNotice(titles: string[]): string | null`
  - `REOPEN_COPY: Record<ReopenTarget, { title: string; body: string }>`
  - `LATER_VISITS_NOTICE: string`

- [ ] **Step 1: Escribir la prueba**

`src/lib/reopen.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { reopenBlocker, reopenPatch, reportsNotice } from "./reopen";

describe("reopenPatch", () => {
  it("un proceso vuelve a calculado, sin registro de cierre", () => {
    expect(reopenPatch("process")).toEqual({ status: "calculated", closed_at: null, closed_by: null });
  });

  it("una visita también", () => {
    expect(reopenPatch("visit")).toEqual({ status: "calculated", closed_at: null, closed_by: null });
  });

  it("un lugar vuelve a activo", () => {
    expect(reopenPatch("site")).toEqual({ status: "active", closed_at: null, closed_by: null });
  });
});

describe("reopenBlocker", () => {
  it("un proceso cerrado o rechazado se reabre", () => {
    expect(reopenBlocker("process", "closed")).toBeNull();
    expect(reopenBlocker("process", "rejected")).toBeNull();
  });

  it("un proceso abierto no: ya se reabrió o nunca se cerró", () => {
    expect(reopenBlocker("process", "calculated")).toBe("El proceso no está cerrado.");
    expect(reopenBlocker("process", "draft")).toBe("El proceso no está cerrado.");
  });

  it("una visita cerrada de un lugar activo se reabre", () => {
    expect(reopenBlocker("visit", "closed", "active")).toBeNull();
  });

  it("una visita de un lugar cerrado espera a que se reabra el lugar", () => {
    expect(reopenBlocker("visit", "closed", "closed")).toBe("El lugar está cerrado: reábrelo primero.");
  });

  it("una visita abierta no se reabre", () => {
    expect(reopenBlocker("visit", "calculated", "active")).toBe("La visita no está cerrada.");
  });

  it("un lugar cerrado se reabre; uno activo no", () => {
    expect(reopenBlocker("site", "closed")).toBeNull();
    expect(reopenBlocker("site", "active")).toBe("El lugar no está cerrado.");
  });
});

describe("reportsNotice", () => {
  it("sin informes no hay aviso", () => {
    expect(reportsNotice([])).toBeNull();
  });

  it("nombra el informe", () => {
    expect(reportsNotice(["Entrega 1"])).toBe(
      "Está en el informe consolidado «Entrega 1». Lo mostrará con los datos nuevos, sin fecha de cierre mientras siga abierto.",
    );
  });

  it("cuenta y nombra varios", () => {
    expect(reportsNotice(["A", "B"])).toBe(
      "Está en 2 informes consolidados: «A», «B». Lo mostrarán con los datos nuevos, sin fecha de cierre mientras siga abierto.",
    );
  });
});
```

- [ ] **Step 2: Correr la prueba y ver que falla**

Run: `npx vitest run src/lib/reopen.test.ts`
Expected: FAIL, `Failed to resolve import "./reopen"`.

- [ ] **Step 3: Escribir el módulo**

`src/lib/reopen.ts`:

```ts
// Reabrir lo cerrado (Fase 34). Reglas y textos puros: las Server Actions y
// `ReopenDialog` los aplican, y la base admite la transición
// (`20261003000000_reabrir_procesos.sql`).

/** Lo que se reabre: un proceso (poligonal o nivelación), una visita o un lugar. */
export type ReopenTarget = "process" | "visit" | "site";

/** El estado al que vuelve cada uno (decisión 5 del PRD). */
const REOPENED_STATUS = {
  process: "calculated",
  visit: "calculated",
  site: "active",
} as const satisfies Record<ReopenTarget, string>;

/**
 * Lo que escribe reabrir: el estado abierto y sin registro de cierre. Ninguna
 * otra columna: la base rechaza reabrir y modificar en una sola escritura.
 */
export function reopenPatch<T extends ReopenTarget>(target: T) {
  return { status: REOPENED_STATUS[target], closed_at: null, closed_by: null };
}

const NOT_CLOSED: Record<ReopenTarget, string> = {
  process: "El proceso no está cerrado.",
  visit: "La visita no está cerrada.",
  site: "El lugar no está cerrado.",
};

/**
 * Por qué no se puede reabrir, o null si se puede. Un proceso rechazado
 * también se reabre. Una visita de un lugar cerrado espera al lugar: el
 * trigger del lugar rechaza escribir sus visitas (decisión 6).
 */
export function reopenBlocker(
  target: ReopenTarget,
  status: string,
  siteStatus?: string,
): string | null {
  const closed = status === "closed" || (target === "process" && status === "rejected");
  if (!closed) return NOT_CLOSED[target];
  if (target === "visit" && siteStatus === "closed") {
    return "El lugar está cerrado: reábrelo primero.";
  }
  return null;
}

/**
 * El aviso de los informes consolidados que lo incluyen, o null si no está en
 * ninguno. El informe se reconstruye en vivo: mostrará lo que haya (decisión 2).
 */
export function reportsNotice(titles: string[]): string | null {
  if (titles.length === 0) return null;
  const list = titles.map((t) => `«${t}»`).join(", ");
  return titles.length === 1
    ? `Está en el informe consolidado ${list}. Lo mostrará con los datos nuevos, sin fecha de cierre mientras siga abierto.`
    : `Está en ${titles.length} informes consolidados: ${list}. Lo mostrarán con los datos nuevos, sin fecha de cierre mientras siga abierto.`;
}

/** Título y explicación del diálogo de cada caso. */
export const REOPEN_COPY: Record<ReopenTarget, { title: string; body: string }> = {
  process: {
    title: "Reabrir proceso",
    body: "El proceso vuelve a ser editable y deja de contar como cerrado hasta que lo cierres otra vez. Se borra su registro de cierre: la fecha y el responsable.",
  },
  visit: {
    title: "Reabrir visita",
    body: "La visita vuelve a ser editable y deja de contar como cerrada hasta que la cierres otra vez. Se borra su registro de cierre: la fecha y el responsable.",
  },
  site: {
    title: "Reabrir lugar",
    body: "El lugar vuelve a estar activo: admite visitas nuevas y sus visitas abiertas se pueden editar. Las visitas cerradas siguen cerradas; cada una se reabre aparte. Se borra su registro de cierre: la fecha y el responsable.",
  },
};

/**
 * Una visita con visitas posteriores: el parcial, la velocidad y la alerta de
 * la siguiente se miden contra sus lecturas (decisión 8).
 */
export const LATER_VISITS_NOTICE =
  "Las visitas posteriores se calculan contra sus lecturas: si las cambias, cambian también sus resultados.";
```

- [ ] **Step 4: Correr la prueba y ver que pasa**

Run: `npx vitest run src/lib/reopen.test.ts`
Expected: PASS, 11 pruebas.

- [ ] **Step 5: Ajustar el PRD (documento vivo)**

En `docs/prds/33-reabrir-procesos.md`, sección «Pruebas mínimas», reemplazar el bloque que empieza con `- **Vitest**: las acciones de poligonal y nivelación` por:

```markdown
- **Vitest** (`src/lib/reopen.test.ts`): las reglas y los textos de
  reabrir —el estado al que vuelve cada uno, cuándo se puede y el aviso de
  los informes—. Las Server Actions del proyecto no se prueban con la base
  simulada: la prueba es de la lógica pura que aplican, como `close-status`.
```

- [ ] **Step 6: Typecheck y commit**

Run: `npm run typecheck`
Expected: sin errores.

```bash
git add src/lib/reopen.ts src/lib/reopen.test.ts docs/prds/33-reabrir-procesos.md
git commit -m "feat: reglas y textos de reabrir

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Las cuatro Server Actions

**Files:**
- Modify: `src/app/(app)/projects/[id]/polygonal/[pid]/actions.ts` (añadir después de `closePolygonalProcessAction`, ~línea 464)
- Modify: `src/app/(app)/projects/[id]/leveling/[pid]/actions.ts` (después de `closeLevelingProcessAction`, ~línea 310)
- Modify: `src/app/(app)/projects/[id]/settlement/[siteId]/actions.ts` (después de `closeVisitAction`, ~línea 601)
- Modify: `src/app/(app)/projects/[id]/sites/actions.ts` (después de `closeSiteAction`, ~línea 205)

**Interfaces:**
- Consumes: `reopenPatch`, `reopenBlocker` de `@/lib/reopen` (Tarea 2).
- Produces (cada una devuelve el `ActionResult` de su archivo, `{ ok: boolean; error?: string }`):
  - `reopenPolygonalProcessAction(processId: string)`
  - `reopenLevelingProcessAction(processId: string)`
  - `reopenVisitAction(siteId: string, visitId: string)`
  - `reopenSiteAction(siteId: string)`

- [ ] **Step 1: Poligonal**

Añadir el import `import { reopenBlocker, reopenPatch } from "@/lib/reopen";` junto a los demás, y después de `closePolygonalProcessAction`:

```ts
/**
 * Reabre una poligonal cerrada o rechazada (Fase 34): vuelve a `calculated`,
 * sin registro de cierre, y se edita como cualquier abierta. La base admite
 * solo esa transición.
 */
export async function reopenPolygonalProcessAction(processId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sesión no válida." };

  const { data: process } = await supabase
    .from("polygonal_processes")
    .select("id, status, project_id")
    .eq("id", processId)
    .maybeSingle();
  if (!process) return { ok: false, error: "Proceso no encontrado." };
  const blocker = reopenBlocker("process", process.status);
  if (blocker) return { ok: false, error: blocker };

  const { error } = await supabase
    .from("polygonal_processes")
    .update(reopenPatch("process"))
    .eq("id", processId);
  if (error) return { ok: false, error: "No se pudo reabrir el proceso." };

  revalidatePath(`/projects/${process.project_id}/polygonal/${processId}`);
  revalidatePath(`/projects/${process.project_id}`);
  return { ok: true };
}
```

- [ ] **Step 2: Nivelación**

Mismo import; después de `closeLevelingProcessAction`:

```ts
/**
 * Reabre una nivelación cerrada o rechazada (Fase 34): vuelve a `calculated`,
 * sin registro de cierre, y se edita como cualquier abierta. La base admite
 * solo esa transición.
 */
export async function reopenLevelingProcessAction(processId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sesión no válida." };

  const { data: process } = await supabase
    .from("leveling_processes")
    .select("id, status, project_id")
    .eq("id", processId)
    .maybeSingle();
  if (!process) return { ok: false, error: "Proceso no encontrado." };
  const blocker = reopenBlocker("process", process.status);
  if (blocker) return { ok: false, error: blocker };

  const { error } = await supabase
    .from("leveling_processes")
    .update(reopenPatch("process"))
    .eq("id", processId);
  if (error) return { ok: false, error: "No se pudo reabrir el proceso." };

  revalidatePath(`/projects/${process.project_id}/leveling/${processId}`);
  revalidatePath(`/projects/${process.project_id}`);
  return { ok: true };
}
```

- [ ] **Step 3: Visita**

Mismo import; después de `closeVisitAction`:

```ts
/**
 * Reabre una visita cerrada (Fase 34): vuelve a `calculated`, sin registro de
 * cierre. Con el lugar cerrado no se puede: primero se reabre el lugar, cuyo
 * trigger rechaza escribir sus visitas.
 */
export async function reopenVisitAction(siteId: string, visitId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sesión no válida." };

  const { data: site } = await supabase
    .from("sites")
    .select("id, status, project_id")
    .eq("id", siteId)
    .maybeSingle();
  if (!site) return { ok: false, error: "Lugar no encontrado." };
  const { data: visit } = await supabase
    .from("settlement_visits")
    .select("id, status")
    .eq("id", visitId)
    .eq("site_id", siteId)
    .maybeSingle();
  if (!visit) return { ok: false, error: "Visita no encontrada." };
  const blocker = reopenBlocker("visit", visit.status, site.status);
  if (blocker) return { ok: false, error: blocker };

  const { error } = await supabase
    .from("settlement_visits")
    .update(reopenPatch("visit"))
    .eq("id", visitId);
  if (error) return { ok: false, error: logDbError(error, "No se pudo reabrir la visita.") };

  revalidatePath(`/projects/${site.project_id}/settlement/${siteId}`);
  revalidatePath(`/projects/${site.project_id}`);
  return { ok: true };
}
```

- [ ] **Step 4: Lugar**

Mismo import; después de `closeSiteAction`:

```ts
/**
 * Reabre un lugar cerrado (Fase 34): vuelve a `active`, sin registro de
 * cierre. Admite visitas nuevas y sus visitas abiertas vuelven a editarse; las
 * cerradas siguen cerradas y se reabren una a una.
 */
export async function reopenSiteAction(siteId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sesión no válida." };

  const { data: site } = await supabase
    .from("sites")
    .select("id, status, project_id, kind")
    .eq("id", siteId)
    .maybeSingle();
  // Un lugar de agrupación (Fase 22) no se cierra, así que tampoco se reabre.
  if (!site || site.kind !== "settlement") return { ok: false, error: "Lugar no encontrado." };
  const blocker = reopenBlocker("site", site.status);
  if (blocker) return { ok: false, error: blocker };

  const { error } = await supabase.from("sites").update(reopenPatch("site")).eq("id", siteId);
  if (error) return { ok: false, error: logDbError(error, "No se pudo reabrir el lugar.") };

  revalidatePath(`/projects/${site.project_id}`);
  revalidatePath(`/projects/${site.project_id}/settlement/${siteId}`);
  return { ok: true };
}
```

- [ ] **Step 5: Typecheck, lint y commit**

Run: `npm run typecheck && npx eslint "src/app/(app)/projects/[id]"`
Expected: sin errores. Si el tipo de `.update()` rechaza `status` como literal, no hay que tocar `reopenPatch`: la columna es `string` y el literal es asignable. Si falla, leer el error antes de forzar un `as`.

```bash
git add "src/app/(app)/projects/[id]"
git commit -m "feat: acciones para reabrir poligonal, nivelación, visita y lugar

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: El diálogo y el botón en poligonal, nivelación y lugar

**Files:**
- Create: `src/components/process/reopen-dialog.tsx`
- Modify: `src/app/(app)/projects/[id]/polygonal/[pid]/page.tsx`
- Modify: `src/app/(app)/projects/[id]/leveling/[pid]/page.tsx`
- Modify: `src/app/(app)/projects/[id]/settlement/[siteId]/page.tsx`

**Interfaces:**
- Consumes: `REOPEN_COPY`, `reportsNotice`, `ReopenTarget` (Tarea 2); las acciones de la Tarea 3; `getReports` (`@/lib/supabase/queries`) y `reportsIncluding` (`@/lib/reports/including`).
- Produces: `ReopenDialog({ target, action, reportTitles?, notice?, blocked? })`, donde `action: () => Promise<{ ok: boolean; error?: string }>`.

- [ ] **Step 1: El componente**

`src/components/process/reopen-dialog.tsx`:

```tsx
"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Alert, Button, Modal } from "@/components/design-system";
import { REOPEN_COPY, reportsNotice, type ReopenTarget } from "@/lib/reopen";

interface ReopenDialogProps {
  target: ReopenTarget;
  /** La Server Action, ya ligada a su id (`reopen…Action.bind(null, id)`). */
  action: () => Promise<{ ok: boolean; error?: string }>;
  /** Títulos de los informes consolidados que lo incluyen. */
  reportTitles?: string[];
  /** Un aviso más, como el de las visitas posteriores. */
  notice?: string | null;
  /** Si no se puede reabrir, por qué: el diálogo lo dice y no deja confirmar. */
  blocked?: string | null;
}

/**
 * Reabrir lo cerrado (Fase 34): un proceso, una visita o un lugar vuelve a
 * quedar abierto y editable. Sirve a los cuatro casos: la acción llega ligada
 * y el diálogo no sabe de módulos.
 */
export function ReopenDialog({
  target,
  action,
  reportTitles = [],
  notice = null,
  blocked = null,
}: ReopenDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const copy = REOPEN_COPY[target];
  const reports = reportsNotice(reportTitles);

  function handleConfirm() {
    setError(null);
    startTransition(async () => {
      const response = await action();
      if (response.ok) {
        setOpen(false);
        // revalidatePath ya rehace la pantalla del proceso; la vista de una
        // visita es una ruta anidada que no revalida.
        router.refresh();
      } else {
        setError(response.error ?? "No se pudo reabrir.");
      }
    });
  }

  return (
    <>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
      >
        Reabrir
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={copy.title}
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button disabled={blocked != null || isPending} onClick={handleConfirm}>
              {isPending ? "Reabriendo…" : copy.title}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          {error && <Alert variant="error">{error}</Alert>}
          {blocked ? (
            <Alert variant="warning">{blocked}</Alert>
          ) : (
            <>
              <p className="text-sm text-ink">{copy.body}</p>
              {reports && <Alert variant="warning">{reports}</Alert>}
              {notice && <Alert variant="warning">{notice}</Alert>}
            </>
          )}
        </div>
      </Modal>
    </>
  );
}
```

- [ ] **Step 2: Poligonal**

En `polygonal/[pid]/page.tsx`, añadir los imports:

```ts
import { ReopenDialog } from "@/components/process/reopen-dialog";
import { reportsIncluding } from "@/lib/reports/including";
import { reopenPolygonalProcessAction } from "./actions";
```

y `getReports` a la lista que ya importa de `@/lib/supabase/queries`. Después de `const basePath = …`:

```ts
  // Reabrir (Fase 34): solo lo cerrado, con los informes que lo incluyen.
  const closed = process.status === "closed" || process.status === "rejected";
  const reportTitles = closed
    ? reportsIncluding(await getReports(supabase, id), "polygonal", process.id).map((r) => r.title)
    : [];
```

y en `<ProcessShell …>`, después de `exportHref={`${basePath}/export`}`:

```tsx
      actions={
        closed && (
          <ReopenDialog
            target="process"
            action={reopenPolygonalProcessAction.bind(null, process.id)}
            reportTitles={reportTitles}
          />
        )
      }
```

- [ ] **Step 3: Nivelación**

En `leveling/[pid]/page.tsx`, lo mismo con `reopenLevelingProcessAction` y el tipo `"leveling"`:

```ts
import { ReopenDialog } from "@/components/process/reopen-dialog";
import { reportsIncluding } from "@/lib/reports/including";
import { reopenLevelingProcessAction } from "./actions";
```

(`getReports` a la lista de `@/lib/supabase/queries`.) Después de `const basePath = …`:

```ts
  // Reabrir (Fase 34): solo lo cerrado, con los informes que lo incluyen.
  const closed = process.status === "closed" || process.status === "rejected";
  const reportTitles = closed
    ? reportsIncluding(await getReports(supabase, id), "leveling", process.id).map((r) => r.title)
    : [];
```

y en `<ProcessShell …>`, después de `exportHref`:

```tsx
      actions={
        closed && (
          <ReopenDialog
            target="process"
            action={reopenLevelingProcessAction.bind(null, process.id)}
            reportTitles={reportTitles}
          />
        )
      }
```

- [ ] **Step 4: Lugar**

En `settlement/[siteId]/page.tsx`, los imports:

```ts
import { ReopenDialog } from "@/components/process/reopen-dialog";
import { reportsIncluding } from "@/lib/reports/including";
import { reopenSiteAction } from "../../sites/actions";
```

(`getReports` a la lista de `@/lib/supabase/queries`.) Comprobar que la ruta relativa resuelve. Si no, usar `@/app/(app)/projects/[id]/sites/actions`, que es como `visit-view.tsx` importa `closeVisitAction`. Después de `const basePath = …`:

```ts
  // Reabrir el lugar (Fase 34), con los informes que lo incluyen.
  const reportTitles =
    site.status === "closed"
      ? reportsIncluding(await getReports(supabase, project.id), "site", site.id).map((r) => r.title)
      : [];
```

y reemplazar la prop `actions` actual por:

```tsx
      actions={
        site.status !== "closed" ? (
          <NewVisitDialog
            projectId={project.id}
            siteId={site.id}
            referencePoints={referencePoints}
            previous={visits.at(-1) ?? null}
          />
        ) : (
          <ReopenDialog
            target="site"
            action={reopenSiteAction.bind(null, site.id)}
            reportTitles={reportTitles}
          />
        )
      }
```

- [ ] **Step 5: Typecheck, lint y commit**

Run: `npm run typecheck && npm run lint`
Expected: sin errores.

```bash
git add src/components/process/reopen-dialog.tsx "src/app/(app)/projects/[id]/polygonal/[pid]/page.tsx" "src/app/(app)/projects/[id]/leveling/[pid]/page.tsx" "src/app/(app)/projects/[id]/settlement/[siteId]/page.tsx"
git commit -m "feat: botón Reabrir en poligonal, nivelación y lugar

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: El botón en la vista de una visita

**Files:**
- Modify: `src/components/settlement/visit-view.tsx` (props ~línea 70; acciones de la cabecera ~líneas 180-225)
- Modify: `src/app/(app)/projects/[id]/settlement/[siteId]/visits/[visitId]/page.tsx`

**Interfaces:**
- Consumes: `ReopenDialog` (Tarea 4), `reopenVisitAction` (Tarea 3), `reopenBlocker` y `LATER_VISITS_NOTICE` (Tarea 2).
- Produces: la prop `reopen: { blocked: string | null; laterVisits: boolean } | null` de `VisitView` (null si la visita no está cerrada).

- [ ] **Step 1: La prop de `VisitView`**

En `VisitViewProps`, después de `editHref: string | null;`:

```ts
  /**
   * Reabrir (Fase 34), si la visita está cerrada; null si no. `blocked` dice
   * por qué no se puede —el lugar cerrado—, y `laterVisits` si hay visitas
   * posteriores que se calculan contra esta.
   */
  reopen: { blocked: string | null; laterVisits: boolean } | null;
```

Imports:

```ts
import { reopenVisitAction } from "@/app/(app)/projects/[id]/settlement/[siteId]/actions";
import { ReopenDialog } from "@/components/process/reopen-dialog";
import { LATER_VISITS_NOTICE } from "@/lib/reopen";
```

(`reopenVisitAction` se añade al import que ya trae `closeVisitAction`.) En las acciones de `PageHeader`, justo antes de `{props.editHref && (`:

```tsx
            {props.reopen && (
              <ReopenDialog
                target="visit"
                action={() => reopenVisitAction(props.siteId, props.visitId)}
                blocked={props.reopen.blocked}
                notice={props.reopen.laterVisits ? LATER_VISITS_NOTICE : null}
              />
            )}
```

- [ ] **Step 2: La página**

En `visits/[visitId]/page.tsx`, import `import { reopenBlocker } from "@/lib/reopen";` y, en `<VisitView …>`, después de `editHref={open ? `${viewHref}/editar` : null}`:

```tsx
        reopen={
          visit.status === "closed"
            ? { blocked: reopenBlocker("visit", visit.status, site.status), laterVisits: next !== null }
            : null
        }
```

- [ ] **Step 3: Typecheck, lint, pruebas y commit**

Run: `npm run typecheck && npm run lint && npm test 2>&1 | tail -4`
Expected: sin errores; 1032 pruebas (1021 + 11), todas pasan.

```bash
git add src/components/settlement/visit-view.tsx "src/app/(app)/projects/[id]/settlement/[siteId]/visits/[visitId]/page.tsx"
git commit -m "feat: botón Reabrir en la vista de una visita

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Textos y comentarios que dejan de ser ciertos

**Files:**
- Modify: `src/components/polygonal/close-process-dialog.tsx:155`
- Modify: `src/components/leveling/close-process-dialog.tsx:174`
- Modify: `src/components/settlement/close-visit-dialog.tsx:28,125-126`
- Modify: `src/components/settlement/close-site-dialog.tsx:99-100`
- Modify: `src/components/settlement/visit-editor.tsx:218-222`
- Modify: `src/app/(app)/projects/[id]/reports/[reportId]/print/page.tsx:27-32`
- Modify: `src/lib/reports/eligibility.ts:3-6,27-28`
- Modify: `src/components/process/process-report.tsx:42`

- [ ] **Step 1: El texto de los diálogos de cierre**

- `polygonal/close-process-dialog.tsx` y `leveling/close-process-dialog.tsx`: `Al cerrar, el proceso queda de solo lectura.` → `Al cerrar, el proceso queda de solo lectura hasta que lo reabras.`
- `close-visit-dialog.tsx`: `El cierre deja la visita en solo lectura, con responsable y fecha` / `de registro. Esta acción no se puede deshacer.` → `El cierre deja la visita en solo lectura, con responsable y fecha` / `de registro, hasta que la reabras.`
- `close-site-dialog.tsx`: `Cerrar el lugar finaliza el monitoreo: queda en solo lectura, con` / `responsable y fecha de registro. Esta acción no se puede deshacer.` → `Cerrar el lugar finaliza el monitoreo: queda en solo lectura, con` / `responsable y fecha de registro, hasta que lo reabras.`

- [ ] **Step 2: Los comentarios**

- `close-visit-dialog.tsx:28`: `pantalla — irreversible, porque una visita cerrada es inmutable.` → `pantalla, y una visita cerrada es inmutable mientras no se reabra.`
- `visit-editor.tsx:221-222`: `sin guardar — cerrar sellaría los valores VIEJOS de la base, de forma` / `irreversible.` → `sin guardar — cerrar sellaría los valores VIEJOS de la base.`
- Página imprimible (`print/page.tsx`), el párrafo de las líneas 27-32 pasa a decir:

```tsx
 * El contenido se **reconstruye** en cada visita a partir de los procesos que
 * el informe referencia: solo puede incluir procesos cerrados, cuyas
 * mediciones y veredicto la base protege mientras sigan cerrados. Desde la
 * Fase 34 un proceso se puede reabrir: el informe muestra entonces sus datos
 * actuales y «—» en su registro de cierre. La posición de una poligonal
 * georreferenciada después (Fase 15) también se muestra actualizada, con una
 * nota.
```

- `eligibility.ts`, cabecera (líneas 3-6):

```ts
// Es la regla que sostiene todo el generador: como el informe NO guarda una
// copia de los datos —se reconstruye al abrirlo—, solo puede incluir cosas que
// la base protege. De ahí que la elegibilidad sea exactamente «cerrado», y que
// se decida aquí, con tests, y no dentro de una consulta. Desde la Fase 34 lo
// cerrado se puede reabrir, y el informe que lo incluye muestra lo que haya.
```

y la viñeta de las líneas 27-28:

```ts
 * - Un proceso cerrado es inmutable por trigger de base mientras siga
 *   cerrado, así que regenerar el informe da el mismo resultado hasta que
 *   alguien lo reabra (Fase 34).
```

- `process-report.tsx:42`: `// Cerrado conforme o rechazado: ya no cambia, y tiene fecha y registro de cierre.` → `// Cerrado conforme o rechazado: no cambia mientras siga cerrado, y tiene fecha y registro de cierre.`

- [ ] **Step 3: Comprobar que no queda otro «no se puede deshacer» del cierre**

Run: `grep -rn "no se puede deshacer\|irreversible" src --include=*.tsx --include=*.ts | grep -v "design-system\|sign-up"`
Expected: nada sobre el cierre. `src/app/design-system/` es la página de demostración del sistema de diseño y no se toca.

- [ ] **Step 4: Typecheck y commit**

Run: `npm run typecheck`

```bash
git add src
git commit -m "docs: el cierre deja de ser irreversible en textos y comentarios

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Verificación en pantalla

**Files:**
- Create (temporal, no se commitea): `scratchpad/verificar-reabrir.mjs`, copiado a `./.x-tmp.mjs` para ejecutarlo

- [ ] **Step 1: Levantar un dev server del worktree en el puerto 3001**

Run (en segundo plano): `npx next dev -p 3001`. Comprobar con `curl -s -o /dev/null -w '%{http_code}' --max-time 60 http://localhost:3001/sign-in` → `200`. El dev del puerto 3000 es de la otra sesión: no se toca.

- [ ] **Step 2: Elegir los datos**

Con el usuario del seed (`topofieldsarf@gmail.com` / `seed1234`), buscar en la base local:

```bash
PGPASSWORD=postgres psql -h 127.0.0.1 -p 55322 -U postgres -At -c "select 'pol', id, project_id, name, status from polygonal_processes where status in ('closed','rejected') union all select 'lev', id, project_id, name, status from leveling_processes where status in ('closed','rejected') union all select 'site', id, project_id, name, status from sites where status = 'closed' and kind = 'settlement' union all select 'visit', v.id, s.project_id, s.name || ' v' || v.visit_number, v.status from settlement_visits v join sites s on s.id = v.site_id where v.status = 'closed'" | head -30
```

Anotar una poligonal cerrada, una rechazada, una nivelación cerrada, un lugar cerrado y una visita cerrada de un lugar abierto. Si falta alguno, cerrarlo desde la app antes de empezar y apuntarlo.

- [ ] **Step 3: Script Playwright con los criterios a–h**

`scratchpad/verificar-reabrir.mjs`. Iniciar sesión en `http://localhost:3001/sign-in`, esperar 1 s tras cada `goto` e inyectar `nextjs-portal{display:none!important}`. Comprobar, con `expect` de `@playwright/test` o aserciones a mano que acumulan fallos:

1. Poligonal cerrada: hay un botón «Reabrir». Al pulsarlo, el `role="dialog"` con nombre «Reabrir proceso» muestra el texto de `REOPEN_COPY.process.body` y, si está en informes, el aviso. Confirmar → el badge dice «Calculado» y aparecen «Guardar» y «Cerrar proceso» (Review Focus 1).
2. Cambiar una distancia, guardar y cerrar con el diálogo de cierre → el badge vuelve a «Cerrado» (criterio a).
3. Dos pestañas sobre una poligonal cerrada: reabrir en la primera y luego en la segunda → la segunda muestra «El proceso no está cerrado.» (Review Focus 2). Volver a cerrarla.
4. Poligonal rechazada: reabrir y volver a cerrar (criterio b). Nivelación cerrada: reabrir, editar una lectura, guardar y cerrar (criterio c).
5. Lugar cerrado: el diálogo de una visita cerrada dice «El lugar está cerrado: reábrelo primero.» y el botón de confirmar está desactivado (criterio e). Reabrir el lugar → aparece «Nueva visita» y la visita sigue «Cerrada» (criterio f). Reabrir la visita → aparece «Editar». Si no es la última, el diálogo trae el aviso de las visitas posteriores (criterio d, decisión 8). Volver a cerrar la visita y el lugar.
6. Un proceso que esté en un informe consolidado: el diálogo nombra el informe (criterio g). Con el proceso reabierto, `/projects/<id>/reports/<reportId>/print` muestra «—» en su fila del registro de cierre (criterio h). Volver a cerrarlo.
7. A 390 px, en la poligonal cerrada y en la visita cerrada: `document.documentElement.scrollWidth <= 390`, y el diálogo cabe en pantalla.

Sin errores de consola de página (`page.on('pageerror')`).

- [ ] **Step 4: Ejecutar y dejar los datos como estaban**

Run: `cp scratchpad/verificar-reabrir.mjs ./.x-tmp.mjs && node ./.x-tmp.mjs; rm -f ./.x-tmp.mjs`
Expected: todas las comprobaciones pasan. Con la consulta del paso 2, comprobar que cada fila anotada vuelve a su estado (`closed`/`rejected`).

- [ ] **Step 5: Anotar el resultado en el PRD**

En `docs/prds/33-reabrir-procesos.md`, crear el bloque `> **Divergencias de la implementación:**` debajo de la cabecera, como en los PRD cerrados. Anotar cuántas comprobaciones pasaron, a qué anchos, y lo que haya cambiado respecto al PRD.

```bash
git add docs/prds/33-reabrir-procesos.md
git commit -m "docs: verificación en pantalla de reabrir

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Documentación y cierre de la fase

**Files:**
- Modify: `PRD-TopoField.md` (§ 4.6, después de la enmienda de la Fase 15, ~línea 745)
- Modify: `CLAUDE.md` (regla de inmutabilidad, línea 64)
- Modify: `docs/manual/README.md` (§ 6.8, § 7.6, § 8, § 10 y § 13) y su copia en `src/app/(app)/manual/` (`manual-data.ts` y lo que corresponda)
- Modify: `public/manual/09-proceso-cerrado.png`, `public/manual/10-proceso-rechazado.png` y las demás que cambien
- Modify: `docs/tecnica/README.md` («Inmutabilidad de procesos cerrados», informes ~línea 310-320 y 620-640, estado de fases, tabla de pruebas, § 11)
- Modify: `docs/pendientes.md`, `docs/method.md`, `docs/prds/README.md`, `docs/prds/33-reabrir-procesos.md`

- [ ] **Step 1: PRD principal y CLAUDE.md**

En `PRD-TopoField.md`, después del bloque «Enmienda (Fase 15…)» del § 4.6:

```markdown
> **Enmienda (Fase 34, 2026-10-03).** Lo cerrado se puede **reabrir** en
> cualquier momento: una poligonal o una nivelación cerrada o rechazada, una
> visita cerrada y un lugar cerrado. Reabrir devuelve el estado a uno abierto
> (`calculated`, o `active` en el lugar) y borra `closed_at` y `closed_by`; se
> vuelve a cerrar con el flujo de siempre. Mientras está cerrado, todo sigue
> inmutable: la base admite solo esa transición, sin cambiar ninguna otra
> columna. Un informe consolidado que incluye lo reabierto lo muestra con sus
> datos actuales. Ver `docs/prds/33-reabrir-procesos.md`.
```

En `CLAUDE.md`, la regla de la línea 64 pasa a:

```markdown
- Los procesos con status "closed" son inmutables. Nunca generar UPDATE sobre un proceso cerrado. Dos excepciones, y los triggers admiten solo esas: la **posición** de una poligonal (coordenadas, proyecciones, azimuts, arranque y llegada) se puede reescribir al georreferenciarla (Fase 15), y **reabrir** —poligonal, nivelación, visita o lugar— devuelve el estado a abierto y borra `closed_at`/`closed_by` sin tocar nada más (Fase 34).
```

- [ ] **Step 2: Manual (dos copias, mismo commit)**

En `docs/manual/README.md`:

- § 6.8 «Cierre irreversible» → título «Cierre» y primera frase: «Igual que en poligonales, cerrar una nivelación la deja en solo lectura hasta que se reabra (§ 8).» El resto no cambia.
- § 7.6: añadir, al final, el párrafo:

```markdown
**Reabrir.** Una visita cerrada se reabre con **Reabrir**, en su vista, y
vuelve a editarse. Si el lugar está cerrado, primero se reabre el lugar: su
botón **Reabrir** está en la cabecera, donde estaba **Nueva visita**. Reabrir
el lugar no reabre sus visitas: las cerradas siguen cerradas. Si la visita
tiene visitas posteriores, el diálogo lo recuerda: el parcial, la velocidad y
la alerta de la siguiente se calculan contra sus lecturas, y cambian si
cambian ellas.
```

- § 8: «Cerrar es **irreversible**. Antes de permitirlo…» → «Cerrar deja el proceso en solo lectura. Antes de permitirlo…». Después de «En ambos casos el editor se abre en solo lectura…», añadir:

```markdown
**Reabrir.** Un proceso cerrado o rechazado se reabre con **Reabrir**, en la
cabecera. Vuelve a *Calculado*: se edita, se guarda y se cierra otra vez con
el diálogo de siempre. Se borra su registro de cierre —fecha y responsable—,
y el nuevo cierre escribe el suyo. Si el proceso está en un informe
consolidado, el diálogo lo avisa: el informe mostrará los datos nuevos (§ 10).
```

- § 10, en la parte de informes consolidados: «Un informe consolidado se reconstruye al abrirlo. Si se reabre un proceso que incluye, el informe muestra sus datos actuales y, mientras siga abierto, «—» en su registro de cierre. Un PDF ya descargado no cambia.»
- § 13, la pregunta frecuente: «**Cerré un proceso por error. ¿Puedo reabrirlo?** Sí: con **Reabrir**, en la cabecera del proceso (§ 8). Vuelve a ser editable y se cierra otra vez cuando esté listo.»

Copiar los mismos cambios a la copia de `src/app/(app)/manual/`: buscar cada texto con `grep -rn "irreversible\|¿Puedo reabrirlo?" "src/app/(app)/manual/"`.

- [ ] **Step 3: Capturas**

Revisar en `docs/manual/capturas.mjs` la URL base. Si es fija `localhost:3000`, ejecutar con la variable que acepte o con una copia temporal apuntando a `3001`; **no** usar el dev de la otra sesión, que no tiene el botón. Run: `node docs/manual/capturas.mjs`. Comparar cada PNG contra `HEAD` con `ImageChops.difference`, restaurar con `git checkout` las que no cambian por esta fase y sincronizar `width`/`height` en `CAPTURAS` de `manual-data.ts` con las que sí. Esperado: cambian la 09 y la 10 (el botón «Reabrir» en la cabecera), y quizá las de una visita o un lugar cerrados.

- [ ] **Step 4: Doc técnica**

En `docs/tecnica/README.md`:

- «Inmutabilidad de procesos cerrados»: un párrafo sobre `is_reopening()` y la transición pura, y que los triggers de los hijos se liberan solos.
- Las dos afirmaciones de los informes (~líneas 314-317 y 626-632): son iguales mientras lo incluido siga cerrado; al reabrir, muestran lo actual.
- Estado de fases (la 34) y tabla de pruebas (`reabrir_procesos.test.sql`, 22; `reopen.test.ts`, 11; el total de Vitest).
- § 11, entrada por entrada contra el código.

Barrido: `grep -rn "irreversible\|no vuelve atrás\|1021" docs/tecnica/README.md docs/manual/README.md`.

- [ ] **Step 5: Commit de documentación**

```bash
git add PRD-TopoField.md CLAUDE.md docs src/app/\(app\)/manual public/manual
git commit -m "docs: reabrir procesos en el PRD, el manual y la doc técnica

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 6: Verificación final**

Run: `npm run typecheck && npm run lint && npm test 2>&1 | tail -4 && npx supabase test db 2>&1 | tail -4 && npm run build 2>&1 | tail -5`
Expected: todo limpio.

- [ ] **Step 7: Cerrar la fase**

- `docs/prds/33-reabrir-procesos.md`: «**Estado:** cerrada», «**Fecha de cierre:**», y completar las divergencias.
- `docs/method.md` y `docs/prds/README.md`: la 34, `cerrada`. Añadir en `method.md`, bajo «Aprendizajes», el cierre de la Fase 34.
- `docs/pendientes.md`: la sección «Reabrir procesos (Fase 34)» pasa a «Resuelta en la Fase 34».

```bash
git add docs
git commit -m "docs: cerrar fase 34 — reabrir procesos

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 8: Publicar y abrir el PR**

Run: `git push` (si el SSH no responde, la alternativa por HTTPS de la memoria «Entorno local»). Abrir el PR con `gh pr create --base main` y una descripción que resuma qué cambió y qué se verificó, terminada en `🤖 Generated with [Claude Code](https://claude.com/claude-code)`. Avisar al usuario de que:

- el `db push` a producción va **antes** del merge y necesita su visto bueno;
- el merge lo decide él;
- si la 33 entra antes, hay que resolver los conflictos de las tablas de estado y del final de `pendientes.md`.
