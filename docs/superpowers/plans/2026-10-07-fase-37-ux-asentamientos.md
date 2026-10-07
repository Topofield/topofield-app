# Fase 37 — Los asentamientos como los mide el topógrafo · Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Lugar y visita con el modelo de la poligonal y la nivelación —altas en popup, lugar con visitas y tendencia lado a lado, visita por pasos (Libreta · Resultados) con la libreta de la nivelación por armadas que se guarda lectura por lectura, BM propios del lugar—, visitas sin compensación ni orden declarado, la cartera real en la demo y el seed, y un módulo que ya no se cierra.

**Architecture:**
- **Lógica pura con TDD**, en `src/lib/calculations/settlement-book.ts` (los tramos de la libreta, sin compensar, con su verificación, las cotas de los puntos, la plantilla, lo pendiente y los auxiliares), `src/lib/calculations/settlement.ts` y `tolerances.ts` (el margen fijo de la tendencia), y `src/components/settlement/visit-armadas.ts` (de un popup a las filas). Las funciones nuevas conviven con las viejas hasta que sus llamadores se rehacen; la Tarea 14 borra las viejas.
- **Una función de registro** (`visitRecordOf`) arma lo que se guarda de una visita a partir de su libreta, los BM del lugar y su histórico. La usan la acción de guardado, el recálculo del lugar (al cambiar un BM o una C0), el script de resincronización y la demo.
- **Pantalla**: se rehace sobre los componentes comunes de la Fase 36 (`ProcessHeader`, `ProcessSteps`, `useProcessDraft`) y la tabla de libreta de la nivelación.
- **Base**: dos migraciones. La primera, antes del merge, reabre lo cerrado, quita los triggers del cierre, crea `site_benchmarks`, marca el inicio de cada tramo (`starts_section`) y amplía `save_visit`; la segunda, después, borra columnas y las funciones compartidas de inmutabilidad.

**Tech Stack:** Next.js 16 (App Router, Server Actions), React 19, TypeScript, Supabase (Postgres, pgTAP), Vitest, Tailwind v4 con el sistema de diseño propio.

**Spec:** `docs/prds/36-ux-asentamientos.md` (Fase 37). Hoja de ruta y revisión del lienzo: `docs/superpowers/specs/2026-10-06-ux-nivelacion-asentamientos-design.md`. Maquetas: el lienzo «Asentamientos — rediseño de la UX» (https://claude.ai/artifact/A7D1YuGXNC2ZMv1hnRMq3j): alta del lugar, nueva visita, lugar B, libreta B, visita a medias, visita con dos armadas, la armada sin V−, con V− a un auxiliar y con V− a un BM, el móvil, resultados, informe, la pestaña BMs, importar BM y los dos avisos al guardar.

## Global Constraints

- **Rama:** `fase-37-ux-asentamientos`, en la carpeta principal. El PRD ya está commiteado (`084a646`).
- **Idioma y estilo:** interfaz en español de Colombia; tuteo en la app y usted en el manual. Commits en español con `feat:`, `fix:`, `refactor:` o `docs:`, terminados en `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Antes de cada commit, `git diff --cached --name-status`.
- **Cálculo:** `src/lib/calculations/` es puro, sin React ni Supabase. Las tolerancias viven solo en `tolerances.ts`.
- **Formatos:** cotas con 4 decimales; asentamientos en mm con 1; velocidad con 2; lecturas de mira con 3 (4 si vienen del nivel digital); distancias de visual con 1.
- **Palabras:** en la interfaz se dice «armada», nunca «libreta» para una parte de la visita (la tabla sí es «Libreta»); «BM del lugar»; «En medición»; «sin verificación». Sin «cerrar», «reabrir» ni «Cerrada» en asentamientos.
- **Componentes:** sin shadcn ni librerías de componentes; `@/components/design-system`.
- **Sin compensación:** la visita nunca compensa (`compensation: "never"`). La nivelación no cambia.
- **Puntos de referencia del proyecto:** la poligonal los sigue usando; la visita deja de leerlos.
- **Migraciones:**
  - escritas a mano;
  - en local con `npx supabase migration up --local`, nunca `db reset` (la base local es compartida);
  - el `db push` a producción y los scripts contra producción, con el visto bueno del usuario, que los ejecuta.
- **Verificación:** `npm run typecheck` después de cada cambio de código; la suite (`npm test`) al terminar cada tarea.

## Review Focus

- **Una libreta con un tramo que vuelve a arrancar en otro BM** a mitad de la visita, y una armada sin V− antes de él: las cotas del segundo tramo salen de su BM, no de la cadena del primero. Lo prueban `settlement-book-tramos.test.ts` (Tarea 2) y `visit-armadas.test.ts` (Tarea 6).
- **Una visita guardada a medias** —filas de la plantilla sin lectura— no da cotas falsas ni avisos de punto ausente, queda «En medición» y no entra al histórico con puntos sin leer. Lo prueba `settlement-book-plantilla.test.ts` (Tarea 3).
- **Cambiar la cota de un BM o una C0** recalcula todas las visitas que la usan, incluidas las que antes estaban cerradas. Lo prueba `visit-record.test.ts` (Tarea 5) y, en pantalla, la Tarea 17.
- **Una visita vieja de producción** —cerrada, compensada, con su amarre en el catálogo del proyecto— queda editable, con su BM en el lugar y sus cotas sin compensar tras el recálculo. Lo prueban pgTAP (Tarea 1) y el script en simulación (Tarea 15).
- **Un fallo de red a mitad de la medición** deja lo tecleado en el popup y, al volver, «Retomar medición» sigue donde quedó. Lo prueba la Tarea 17, paso 3.

---

### Task 1: Base — paso 1 (antes del merge)

**Files:**
- Create: `supabase/migrations/20261008000000_ux_asentamientos.sql`
- Create: `supabase/tests/asentamientos_sin_cierre.test.sql`
- Modify: `supabase/tests/poligonal_sin_cierre.test.sql`, `supabase/tests/nivelacion_sin_cierre.test.sql`, `supabase/tests/estabilidad_bms.test.sql`: fuera los casos de una visita cerrada; `plan(n)` al número nuevo.
- Delete: `supabase/tests/reabrir_procesos.test.sql`, `supabase/tests/c0_con_lecturas_cerradas.test.sql` (sus reglas desaparecen; sus casos vivos pasan al test nuevo).
- Modify: `src/types/database.ts`: solo lo nuevo (`site_benchmarks`, `settlement_book_readings.starts_section`, `settlement_visits.precision_order` nulable).

**Interfaces:**
- Produces:
  - `public.site_benchmarks (id uuid pk, site_id uuid → sites on delete cascade, code text not null, elevation decimal(10,4) not null, description text, source text, created_at, updated_at)`, `unique (site_id, code)`, RLS por el dueño del proyecto del lugar, trigger de `updated_at`.
  - `settlement_book_readings.starts_section boolean not null default false`: la fila abre un tramo desde un BM del lugar. La primera fila de toda libreta lo tiene en `true`.
  - `settlement_visits.status` admite `in_progress`; `precision_order` nulable.
  - `save_visit` escribe `starts_section` (con `coalesce(…, false)`) y ya no escribe `weather_conditions` ni `capture_mode`.

- [ ] **Step 1: Escribir la prueba pgTAP**

`supabase/tests/asentamientos_sin_cierre.test.sql`, en una transacción que se deshace, con un usuario, un proyecto, un lugar, un punto, una visita con libreta y un BM del lugar sembrados al principio (como `nivelacion_sin_cierre.test.sql`). Casos:

```sql
select has_table('public', 'site_benchmarks', 'existe site_benchmarks');
select col_is_unique('public', 'site_benchmarks', array['site_id', 'code'], 'un código por lugar');
select has_column('public', 'settlement_book_readings', 'starts_section', 'la fila marca el inicio de un tramo');
select col_is_null('public', 'settlement_visits', 'precision_order', 'la visita sin verificar no tiene orden');
select hasnt_trigger('public', 'settlement_visits', 'settlement_visits_reject_update_on_closed', 'la visita no se cierra');
select hasnt_trigger('public', 'settlement_visits', 'settlement_visits_reject_delete_when_closed', 'la visita se borra siempre');
select hasnt_trigger('public', 'settlement_visits', 'settlement_visits_reject_write_when_site_closed', 'el lugar no bloquea visitas');
select hasnt_trigger('public', 'sites', 'sites_reject_update_on_closed', 'el lugar no se cierra');
select hasnt_trigger('public', 'settlement_readings', 'settlement_readings_reject_write_when_closed', 'las lecturas se reescriben');
select hasnt_trigger('public', 'settlement_book_readings', 'settlement_book_readings_reject_write_when_closed', 'la libreta se reescribe');
select hasnt_trigger('public', 'settlement_points', 'settlement_points_reject_reference_change_with_closed_readings', 'la C0 se cambia con lecturas');
select lives_ok($$ update public.settlement_visits set status = 'in_progress' where id = '<visita>' $$, 'una visita queda en medición');
select lives_ok($$ update public.settlement_points set initial_elevation = 100.5 where id = '<punto>' $$, 'la C0 se cambia aunque el punto tenga lecturas');
select lives_ok($$ select public.save_visit('<visita>', '{"date":"2026-01-10","status":"in_progress"}'::jsonb,
  '[{"reading_order":1,"point_code":"BM-1","point_type":"bm","starts_section":true,"backsight":1.2},
    {"reading_order":2,"point_code":"P-01","point_type":"intermediate","foresight":null}]'::jsonb, '[]'::jsonb, '[]'::jsonb) $$,
  'save_visit guarda filas sin lectura');
select is((select starts_section from public.settlement_book_readings where visit_id = '<visita>' and reading_order = 1), true, 'guarda el inicio del tramo');
select is((select starts_section from public.settlement_book_readings where visit_id = '<visita>' and reading_order = 2), false, 'sin el campo, false');
select throws_ok($$ insert into public.site_benchmarks (site_id, code, elevation) values ('<lugar>', 'BM-1', 1) $$, '23505', null, 'un código repetido en el lugar se rechaza');
-- RLS: otro usuario no ve los BM del lugar.
```

Los `<…>` son los `uuid` fijos que siembra el propio archivo al principio.

- [ ] **Step 2: Ver la prueba fallar**

Run: `npx supabase test db`
Expected: FAIL en `asentamientos_sin_cierre.test.sql` (no existe `site_benchmarks`).

- [ ] **Step 3: Contar lo que la migración va a cambiar en la base local**

Run, con `PGPASSWORD=postgres psql -h 127.0.0.1 -p 55322 -U postgres -d postgres` y un `-c` por consulta:

```sql
select status, count(*) from public.settlement_visits group by status;
select status, count(*) from public.sites group by status;
select count(distinct (v.site_id, upper(regexp_replace(v.reference_bm_code, '\s', '', 'g')))) from public.settlement_visits v where v.reference_bm_code is not null;
```

Expected: anota las cifras; los pasos 6 y 7 las comparan. Es la prueba de la migración sobre datos anteriores a ella (aprendizaje de la Fase 36).

- [ ] **Step 4: Escribir la migración**

```sql
-- Fase 37, paso 1 (antes del merge): los asentamientos sin cierre, los BM del
-- lugar y los tramos de la libreta. El código viejo funciona con ella: sin
-- triggers, su cierre solo cambia el estado, y no lee nada de lo nuevo.

-- 1. Lo cerrado vuelve a abrirse.
update public.settlement_visits set status = 'calculated' where status = 'closed';
update public.sites set status = 'active' where status = 'closed';

-- 2. Fuera los triggers del cierre y sus funciones propias.
drop trigger if exists settlement_visits_reject_update_on_closed on public.settlement_visits;
drop trigger if exists settlement_visits_reject_delete_when_closed on public.settlement_visits;
drop trigger if exists settlement_visits_reject_write_when_site_closed on public.settlement_visits;
drop trigger if exists sites_reject_update_on_closed on public.sites;
drop trigger if exists sites_reject_delete_when_closed on public.sites;
drop trigger if exists settlement_readings_reject_write_when_closed on public.settlement_readings;
drop trigger if exists settlement_readings_reject_write_when_site_closed on public.settlement_readings;
drop trigger if exists settlement_book_readings_reject_write_when_closed on public.settlement_book_readings;
drop trigger if exists settlement_book_readings_reject_write_when_site_closed on public.settlement_book_readings;
drop trigger if exists settlement_points_reject_write_when_site_closed on public.settlement_points;
drop trigger if exists settlement_points_reject_reference_change_with_closed_readings on public.settlement_points;
drop function if exists public.reject_write_on_closed_visit_reading();
drop function if exists public.reject_write_on_closed_site_visit();
drop function if exists public.reject_write_on_closed_site_reading();
drop function if exists public.reject_write_on_closed_site_point();
drop function if exists public.reject_reference_change_with_closed_readings();
-- reject_update_on_closed_process, reject_delete_on_closed_process e
-- is_reopening se borran en el paso 2: el código viejo no las llama, pero así
-- el paso 1 solo quita triggers.

-- 3. La visita en medición y sin orden declarado.
alter table public.settlement_visits
  drop constraint settlement_visits_status_check,
  add constraint settlement_visits_status_check
    check (status in ('draft', 'in_progress', 'calculated', 'closed')),
  alter column precision_order drop not null;

-- 4. El inicio de cada tramo.
alter table public.settlement_book_readings
  add column starts_section boolean not null default false;
update public.settlement_book_readings set starts_section = true where reading_order = 1;
comment on column public.settlement_book_readings.starts_section is
  'La fila abre un tramo: su V+ sale de un BM del lugar con cota conocida (Fase 37). La primera fila de toda libreta.';

-- 5. Los BM del lugar.
create table public.site_benchmarks (
  id          uuid primary key default gen_random_uuid(),
  site_id     uuid not null references public.sites(id) on delete cascade,
  code        text not null,
  elevation   decimal(10,4) not null,
  description text,
  source      text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (site_id, code)
);
comment on table public.site_benchmarks is
  'Los BM de un lugar de asentamientos (Fase 37): copias, no se sincronizan con el catálogo del proyecto ni con una nivelación.';
create trigger site_benchmarks_set_updated_at
  before update on public.site_benchmarks
  for each row execute function public.set_updated_at();
alter table public.site_benchmarks enable row level security;
-- Las cuatro políticas, como las de settlement_points: el dueño del proyecto del lugar.
create policy site_benchmarks_select_via_project on public.site_benchmarks for select using (
  exists (select 1 from public.sites join public.projects on projects.id = sites.project_id
           where sites.id = site_benchmarks.site_id and projects.user_id = auth.uid()));
create policy site_benchmarks_insert_via_project on public.site_benchmarks for insert with check (
  exists (select 1 from public.sites join public.projects on projects.id = sites.project_id
           where sites.id = site_benchmarks.site_id and projects.user_id = auth.uid()));
create policy site_benchmarks_update_via_project on public.site_benchmarks for update using (
  exists (select 1 from public.sites join public.projects on projects.id = sites.project_id
           where sites.id = site_benchmarks.site_id and projects.user_id = auth.uid()));
create policy site_benchmarks_delete_via_project on public.site_benchmarks for delete using (
  exists (select 1 from public.sites join public.projects on projects.id = sites.project_id
           where sites.id = site_benchmarks.site_id and projects.user_id = auth.uid()));

-- Se llenan con los BM que ya usa cada lugar: los del catálogo del proyecto
-- que son amarre de alguna visita o se leen de paso, con su cota de hoy; y
-- los amarres tecleados que no están en el catálogo, con la cota de su visita
-- más reciente.
insert into public.site_benchmarks (site_id, code, elevation, description, source)
select distinct on (v.site_id, rp.code)
       v.site_id, rp.code, rp.elevation, rp.description, 'Catálogo del proyecto'
  from public.settlement_visits v
  join public.sites s on s.id = v.site_id
  join public.reference_points rp
    on rp.project_id = s.project_id and rp.type = 'bm' and rp.elevation is not null
 where upper(regexp_replace(rp.code, '\s', '', 'g')) = upper(regexp_replace(coalesce(v.reference_bm_code, ''), '\s', '', 'g'))
    or exists (select 1 from public.settlement_book_readings b
                where b.visit_id = v.id and b.catalog_elevation is not null
                  and upper(regexp_replace(b.point_code, '\s', '', 'g')) = upper(regexp_replace(rp.code, '\s', '', 'g')))
on conflict (site_id, code) do nothing;

insert into public.site_benchmarks (site_id, code, elevation, source)
select distinct on (v.site_id, upper(regexp_replace(v.reference_bm_code, '\s', '', 'g')))
       v.site_id, trim(v.reference_bm_code), v.reference_bm_elevation, 'Amarre de la visita ' || v.visit_number
  from public.settlement_visits v
 where v.reference_bm_code is not null and v.reference_bm_elevation is not null
 order by v.site_id, upper(regexp_replace(v.reference_bm_code, '\s', '', 'g')), v.date desc
on conflict (site_id, code) do nothing;

-- 6. save_visit: el inicio de cada tramo, sin el clima ni el modo de captura.
create or replace function public.save_visit(…)
```

El cuerpo de `save_visit` es el de `20261001040000_estabilidad_bms.sql:28-178` con tres cambios: el `update` de la cabecera ya no nombra `weather_conditions` ni `capture_mode`; el `insert` de la libreta añade `starts_section` en la lista de columnas, en el `select` como `coalesce(b.starts_section, false)` y en el `on conflict` como `starts_section = excluded.starts_section`. Copiarlo entero, con su `security invoker` y `set search_path = ''`.

- [ ] **Step 5: Aplicar en local**

Run: `npx supabase migration up --local`
Expected: aplica `20261008000000_ux_asentamientos`.

- [ ] **Step 6: Ver la prueba pasar**

Ajustar los tests que cambian: en `poligonal_sin_cierre.test.sql` y `nivelacion_sin_cierre.test.sql`, quitar la visita cerrada de la siembra y los casos que buscan su trigger o su inmutabilidad; en `estabilidad_bms.test.sql`, el caso de `catalog_elevation` de una visita cerrada; borrar los dos archivos del cierre. Cada `plan(n)` con su número nuevo.

Run: `npx supabase test db`
Expected: PASS en todos los archivos.

- [ ] **Step 7: Comparar con las cifras del paso 3**

Las mismas consultas. Expected: ninguna visita ni lugar `closed`; las visitas que eran `closed` suman a `calculated`; `select count(*) from public.site_benchmarks` es al menos la tercera cifra del paso 3; toda fila 1 de libreta tiene `starts_section`.

- [ ] **Step 8: Tipos y commit**

En `src/types/database.ts`, añadir a mano `site_benchmarks` (Row, Insert, Update, Relationships), `starts_section` en las tres formas de `settlement_book_readings`, y `precision_order: string | null` en el Row de `settlement_visits`.

Run: `npm run typecheck` → limpio (si un llamador usa `precision_order` como `string`, `?? "tercer_orden"` en ese punto, con un comentario «hasta la Tarea 9»).

```bash
git add supabase/migrations/20261008000000_ux_asentamientos.sql supabase/tests src/types/database.ts
git diff --cached --name-status
git commit -m "feat: asentamientos sin cierre en la base, BM del lugar y tramos de la libreta"
```

---

### Task 2: Motor — los tramos de la libreta, sin compensar

**Files:**
- Modify: `src/types/settlement.ts`: `BookRowPayload.startsSection?: boolean`; tipos nuevos `BenchmarkInput`, `TramoKind`, `TramoResult`, `VisitBook`, `VisitVerification`.
- Modify: `src/lib/calculations/settlement-book.ts`: `bookRowOf` lee `starts_section`; funciones nuevas `tramoStarts`, `computeBook`, `bookVerification`. Las viejas siguen hasta la Tarea 14.
- Test: `src/lib/calculations/settlement-book-tramos.test.ts`.

**Interfaces:**
- Consumes: `computeLeveling`, `detectLevelingOrder`, `samePointCode`, `totalDistanceFromReadings` de `leveling.ts`; `levelingTolerance` de `tolerances.ts`.
- Produces:
  ```ts
  // src/types/settlement.ts
  export interface BookRowPayload { /* …lo de hoy… */ startsSection?: boolean }
  export interface BenchmarkInput { code: string; elevation: number }
  export type TramoKind = "closed" | "link" | "open";
  export interface TramoResult {
    /** Índices de su primera y su última fila en la libreta. */
    start: number;
    end: number;
    startCode: string;
    /** El BM del lugar donde termina; null si es abierto. */
    endCode: string | null;
    kind: TramoKind;
    /** null si arranca en un código que no es BM del lugar. */
    startElevation: number | null;
    /** Cierre (o llegada) en mm, a 0.1; null si es abierto. */
    closureMm: number | null;
    /** El orden que alcanza; null si es abierto, sin distancias o fuera de todos. */
    order: PrecisionOrder | null;
    /** K·√L del orden alcanzado; null sin orden. */
    toleranceMm: number | null;
    /** Longitud del tramo; null sin distancias. */
    distanceKm: number | null;
    /** Toda su cadena tiene lecturas: sin esto no hay cierre ni orden. */
    complete: boolean;
  }
  export interface VisitBook {
    tramos: TramoResult[];
    /**
     * Una por fila de la libreta, en su orden, calculadas sin compensar. Una
     * fila sin su lectura, o detrás de una V+ o una V− que falta en la cadena
     * de su tramo, tiene la cota en NaN: el motor de nivelación tomaría la
     * lectura vacía por cero.
     */
    readings: LevelingComputedReading[];
  }
  export interface VisitVerification {
    /** Todos los tramos terminan en un BM del lugar y alcanzan un orden. */
    verified: boolean;
    /** El orden más bajo de los tramos; null si alguno no se verifica. */
    order: PrecisionOrder | null;
    /** El tramo peor: el primero sin verificar o el de orden más bajo. */
    worst: TramoResult | null;
    /** Suma de las longitudes; null si ningún tramo tiene distancias. */
    distanceKm: number | null;
  }
  ```
  (`LevelingComputedReading` es `ComputedReading` de `@/types/leveling`, importado con ese alias para no chocar con el `ComputedReading` de asentamientos.)
  ```ts
  // src/lib/calculations/settlement-book.ts
  export function tramoStarts(rows: readonly Pick<BookRowPayload, "startsSection">[]): number[];
  export function computeBook(rows: readonly BookRowInput[], benchmarks: readonly BenchmarkInput[]): VisitBook;
  export function bookVerification(book: VisitBook): VisitVerification;
  ```
  `BookRowInput` es el `ReadingInput` de la nivelación más `startsSection?: boolean`.

- [ ] **Step 1: Escribir la prueba**

```ts
// src/lib/calculations/settlement-book-tramos.test.ts
import { describe, expect, it } from "vitest";
import { bookVerification, computeBook, tramoStarts } from "./settlement-book";
import type { BookRowInput } from "./settlement-book";
import type { PointType } from "@/types/leveling";

function r(
  pointCode: string,
  pointType: PointType,
  backsight: number | null,
  foresight: number | null,
  backDistanceM: number | null = null,
  foreDistanceM: number | null = null,
  startsSection = false,
): BookRowInput {
  return {
    pointCode, pointType, backsight, foresight,
    backUpperM: null, backLowerM: null, foreUpperM: null, foreLowerM: null,
    backDistanceM, foreDistanceM, distanceAccumulatedKm: null, startsSection,
  };
}
const el = (book: ReturnType<typeof computeBook>, i: number) =>
  Number(book.readings[i]!.elevationCalculated.toFixed(4));

// Torre Alameda, visita 12 (lienzo «Visita con dos armadas»): BM-1 → CP-1 → BM-1.
const alameda12 = [
  r("BM-1", "bm", 1.8637, null, 28.363, null, true),
  r("BM-2", "intermediate", null, 1.0191),
  r("TA-01", "intermediate", null, 1.2682),
  r("TA-02", "intermediate", null, 1.297),
  r("TA-03", "intermediate", null, 1.3549),
  r("TA-04", "intermediate", null, 1.3838),
  r("CP-1", "pc", 0.6263, 1.2152, 28.207, 27.818),
  r("TA-05", "intermediate", null, 0.8349),
  r("TA-06", "intermediate", null, 0.7772),
  r("TA-07", "intermediate", null, 0.7387),
  r("TA-08", "intermediate", null, 0.6912),
  r("BM-1", "bm", null, 1.2764, null, 28.27),
];
const BMS = [{ code: "BM-1", elevation: 100 }, { code: "BM-2", elevation: 100.845 }];

describe("los tramos de la libreta de una visita", () => {
  it("la primera fila siempre abre un tramo; las marcadas, otro", () => {
    expect(tramoStarts([{}, { startsSection: false }, { startsSection: true }, {}])).toEqual([0, 2]);
  });

  it("Torre Alameda, visita 12: un tramo cerrado, sin compensar, segundo orden", () => {
    const book = computeBook(alameda12, BMS);
    expect(book.tramos).toHaveLength(1);
    const [t] = book.tramos;
    expect(t).toMatchObject({ start: 0, end: 11, startCode: "BM-1", endCode: "BM-1", kind: "closed", order: "segundo_orden" });
    expect(t!.closureMm).toBe(-1.6);
    expect(el(book, 1)).toBe(100.8446); // BM-2, leído de paso
    expect(el(book, 6)).toBe(100.6485); // CP-1
    expect(el(book, 10)).toBe(100.5836); // TA-08
    expect(el(book, 11)).toBe(99.9984); // BM-1 medido: sin compensar
  });

  it("la cartera real, visita 3: una armada de radiaciones, abierta y sin orden", () => {
    const rows = [
      r("PISCINA/BM", "bm", 1.45, null, null, null, true),
      r("A4(8-7A)", "intermediate", null, 1.053),
      r("B10", "intermediate", null, 4.12),
    ];
    const book = computeBook(rows, [{ code: "PISCINA/BM", elevation: 156.299 }]);
    expect(book.tramos[0]).toMatchObject({ kind: "open", endCode: null, closureMm: null, order: null });
    expect(book.readings[0]!.instrumentHeight).toBeCloseTo(157.749, 6);
    expect(el(book, 1)).toBe(156.696);
    expect(el(book, 2)).toBe(153.629);
  });

  it("un tramo que vuelve a arrancar en otro BM toma su cota, no la de la cadena", () => {
    const rows = [
      r("BM-1", "bm", 1.5, null, null, null, true),
      r("TA-01", "intermediate", null, 1.0),
      r("BM-2", "bm", 1.2, null, null, null, true),
      r("TA-05", "intermediate", null, 1.0),
    ];
    const book = computeBook(rows, BMS);
    expect(book.tramos.map((t) => [t.start, t.end, t.startCode, t.kind])).toEqual([
      [0, 1, "BM-1", "open"],
      [2, 3, "BM-2", "open"],
    ]);
    expect(el(book, 1)).toBe(100.5);
    expect(el(book, 3)).toBe(101.045);
  });

  it("un tramo que termina en otro BM del lugar es de enlace", () => {
    const rows = [
      r("BM-1", "bm", 1.8637, null, 28.4, null, true),
      r("TA-01", "intermediate", null, 1.2682),
      r("BM-2", "bm", null, 1.0191, null, 28.4),
    ];
    const [t] = computeBook(rows, BMS).tramos;
    expect(t).toMatchObject({ kind: "link", endCode: "BM-2" });
    expect(t!.closureMm).toBe(-0.4);
  });

  it("un tramo que arranca en un código que no es BM del lugar no tiene cotas", () => {
    const book = computeBook([r("X-9", "bm", 1.2, null, null, null, true), r("TA-01", "intermediate", null, 1)], BMS);
    expect(book.tramos[0]!.startElevation).toBeNull();
    expect(Number.isNaN(book.readings[1]!.elevationCalculated)).toBe(true);
  });

  it("una fila sin lectura no tiene cota y no rompe la cadena", () => {
    const rows = [
      r("BM-1", "bm", 1.5, null, null, null, true),
      r("TA-01", "intermediate", null, null),
      r("TA-02", "intermediate", null, 1.0),
    ];
    const book = computeBook(rows, BMS);
    expect(Number.isNaN(book.readings[1]!.elevationCalculated)).toBe(true);
    expect(el(book, 2)).toBe(100.5);
  });

  it("sin la V+ de la armada, ninguna de sus lecturas tiene cota", () => {
    const book = computeBook([r("BM-1", "bm", null, null, null, null, true), r("TA-01", "intermediate", null, 1.0)], BMS);
    expect(el(book, 0)).toBe(100);
    expect(Number.isNaN(book.readings[1]!.elevationCalculated)).toBe(true);
  });

  it("un punto de cambio sin su V− deja sin cota lo que sigue, y el tramo sin cierre", () => {
    const rows = alameda12.map((row, i) => (i === 6 ? { ...row, foresight: null } : row));
    const book = computeBook(rows, BMS);
    expect(el(book, 5)).toBe(100.4799);
    expect([6, 7, 11].every((i) => Number.isNaN(book.readings[i]!.elevationCalculated))).toBe(true);
    expect(book.tramos[0]).toMatchObject({ complete: false, closureMm: null, order: null });
  });

  it("la plantilla de una visita nueva, sin ninguna lectura, no da cotas ni cierre", () => {
    const blank = alameda12.map((row) => ({ ...row, backsight: null, foresight: null }));
    const book = computeBook(blank, BMS);
    expect(book.readings.slice(1).every((x) => Number.isNaN(x.elevationCalculated))).toBe(true);
    expect(book.tramos[0]).toMatchObject({ kind: "open", complete: false, closureMm: null });
  });

  it("la verificación de la visita es la de su tramo peor", () => {
    const closed = computeBook(alameda12, BMS);
    expect(bookVerification(closed)).toMatchObject({ verified: true, order: "segundo_orden" });
    const mixed = computeBook([...alameda12, r("BM-2", "bm", 1.2, null, null, null, true), r("TA-05", "intermediate", null, 1)], BMS);
    const v = bookVerification(mixed);
    expect(v.verified).toBe(false);
    expect(v.order).toBeNull();
    expect(v.worst!.kind).toBe("open");
  });
});
```

- [ ] **Step 2: Ver la prueba fallar**

Run: `npx vitest run src/lib/calculations/settlement-book-tramos.test.ts`
Expected: FAIL: `computeBook` no existe.

- [ ] **Step 3: Implementar**

En `src/types/settlement.ts`, los tipos de la sección Interfaces. En `settlement-book.ts`:

```ts
import { computeLeveling, detectLevelingOrder, samePointCode, totalDistanceFromReadings } from "./leveling";
import { levelingTolerance } from "./tolerances";
import { PRECISION_ORDERS, type PrecisionOrder } from "@/types/project";
import type { ComputedReading as LevelingComputedReading, ReadingInput } from "@/types/leveling";
import type { BenchmarkInput, TramoResult, VisitBook, VisitVerification } from "@/types/settlement";

/** La fila de la libreta como entra al motor: la de la nivelación, más el inicio de tramo. */
export type BookRowInput = ReadingInput & { startsSection?: boolean };

/** Dónde arranca cada tramo: la primera fila y las marcadas (Fase 37, decisión 8). */
export function tramoStarts(rows: readonly { startsSection?: boolean }[]): number[] {
  return rows.flatMap((row, i) => (i === 0 || row.startsSection ? [i] : []));
}

const round1 = (v: number) => {
  const r = Math.round(v * 10) / 10;
  return Object.is(r, -0) ? 0 : r;
};

function benchmarkOf(code: string, benchmarks: readonly BenchmarkInput[]): BenchmarkInput | undefined {
  return benchmarks.find((b) => samePointCode(b.code, code));
}

/**
 * La libreta de una visita, tramo a tramo y sin compensar (Fase 37, decisión 14).
 * Un tramo arranca en un BM del lugar; termina en otro BM del lugar (de enlace),
 * en el mismo (cerrado) o en sus puntos (abierto). Su cierre solo verifica: la
 * cota de cada punto es la de su lectura.
 */
export function computeBook(rows: readonly BookRowInput[], benchmarks: readonly BenchmarkInput[]): VisitBook {
  const starts = tramoStarts(rows);
  const tramos: TramoResult[] = [];
  const readings: LevelingComputedReading[] = [];
  starts.forEach((start, k) => {
    const end = (starts[k + 1] ?? rows.length) - 1;
    const slice = rows.slice(start, end + 1);
    const first = slice[0]!;
    const last = slice.at(-1)!;
    const startBm = benchmarkOf(first.pointCode, benchmarks);
    // Qué filas tienen cota: la cadena sigue mientras cada V+ y cada V− estén
    // leídas; una intermedia sin lectura solo se pierde a sí misma.
    const valid: boolean[] = [];
    let chain = startBm != null;
    slice.forEach((row, j) => {
      if (j === 0) {
        valid.push(chain);
        chain = chain && row.backsight != null;
      } else if (row.pointType === "intermediate") {
        valid.push(chain && row.foresight != null);
      } else {
        chain = chain && row.foresight != null;
        valid.push(chain);
        chain = chain && row.backsight != null;
      }
    });
    // La cadena está entera si la V+ del arranque y cada V− y V+ que siguen
    // están leídas; las intermedias no cuentan.
    const complete =
      valid[0]! &&
      (slice.length === 1 || first.backsight != null) &&
      slice.every((row, j) => j === 0 || row.pointType === "intermediate" || valid[j]);
    const endBm =
      slice.length > 1 && last.pointType !== "intermediate" && valid.at(-1)
        ? benchmarkOf(last.pointCode, benchmarks)
        : undefined;
    const kind = !endBm ? "open" : samePointCode(endBm.code, first.pointCode) ? "closed" : "link";
    const result = computeLeveling({
      type: kind,
      startElevation: startBm?.elevation ?? Number.NaN,
      endElevation: kind === "link" ? endBm!.elevation : null,
      order: "tercer_orden",
      compensation: "never",
      forward: slice.map(({ startsSection: _s, ...row }) => row),
      return: null,
    });
    const km = totalDistanceFromReadings(slice);
    const distanceKm = km > 0 ? km : null;
    const order = kind === "open" || !startBm ? null : detectLevelingOrder(result, kind).order;
    tramos.push({
      start,
      end,
      startCode: first.pointCode.trim(),
      endCode: endBm ? last.pointCode.trim() : null,
      kind,
      startElevation: startBm?.elevation ?? null,
      closureMm: kind === "open" || result.closureErrorMm == null ? null : round1(result.closureErrorMm),
      order,
      toleranceMm: order && distanceKm != null ? round1(levelingTolerance(order, distanceKm)) : null,
      distanceKm,
      complete,
    });
    readings.push(
      ...result.forward.readings.map((x, j) =>
        valid[j] ? x : { ...x, elevationCalculated: Number.NaN, elevationCorrected: Number.NaN },
      ),
    );
  });
  return { tramos, readings };
}

/** El tramo peor resume la visita (Fase 37, decisión 15). */
export function bookVerification(book: VisitBook): VisitVerification {
  const rank = (o: PrecisionOrder) => PRECISION_ORDERS.indexOf(o);
  const unverified = book.tramos.find((t) => t.order == null);
  const worst =
    unverified ??
    [...book.tramos].sort((a, b) => rank(b.order!) - rank(a.order!))[0] ??
    null;
  const lengths = book.tramos.flatMap((t) => (t.distanceKm != null ? [t.distanceKm] : []));
  return {
    verified: book.tramos.length > 0 && !unverified,
    order: unverified || !worst ? null : worst.order,
    worst,
    distanceKm: lengths.length > 0 ? lengths.reduce((a, b) => a + b, 0) : null,
  };
}
```

`bookRowOf` añade `startsSection: Boolean(row.starts_section)` y pide `"starts_section"` en su `Pick`. El `import` de la cabecera `ReadingInput as BookRowInput` se reemplaza por el tipo exportado nuevo, y `bookRowInputOf` lo devuelve (su `...row` ya lleva `startsSection`).

Si el motor exige `startElevation` finita, dejar `NaN` es lo buscado: las cotas del tramo salen `NaN` y la validación (Tarea 4) lo bloquea al guardar.

- [ ] **Step 4: Ver la prueba pasar**

Run: `npx vitest run src/lib/calculations/settlement-book-tramos.test.ts`
Expected: PASS (11).

Si `closureMm` de la de enlace no da −0.4: el cierre de enlace es medida − conocida = (100 + 1.8637 − 1.0191) − 100.845 = −0.0004 m. Revisar el signo con `result.closureErrorMm` antes de tocar la prueba.

- [ ] **Step 5: Suite, tipos y commit**

Run: `npm run typecheck && npm test`
Expected: limpio y todo PASS.

```bash
git add src/types/settlement.ts src/lib/calculations/settlement-book.ts src/lib/calculations/settlement-book-tramos.test.ts
git diff --cached --name-status
git commit -m "feat: la libreta de la visita por tramos, sin compensar y con su verificación"
```

---
### Task 3: Motor — las cotas de los puntos, la plantilla, lo pendiente y los auxiliares

**Files:**
- Modify: `src/lib/calculations/settlement-book.ts`: `bookElevations`, `bookTemplate`, `bookPending`, `visitStatusOf`, `auxiliaryPoints`.
- Modify: `src/types/settlement.ts`: `VisitStatus` admite `"in_progress"`; su etiqueta, «En medición».
- Test: `src/lib/calculations/settlement-book-plantilla.test.ts`.

**Interfaces:**
- Consumes: `computeBook`, `VisitBook`, `BookRowInput`, `BenchmarkInput` (Tarea 2); `isPointActiveOn` de `settlement.ts`.
- Produces:
  ```ts
  /** Las cotas de los puntos de control: la de su lectura, sin corregir. */
  export function bookElevations(
    book: VisitBook, rows: readonly BookRowInput[], points: PointInput[], visitDate: string,
  ): { readings: DerivedElevation[]; issues: BookIssue[] };
  /** La libreta de una visita nueva: las armadas de la anterior, sin lecturas. */
  export function bookTemplate(
    previous: readonly BookRowPayload[] | null, points: PointInput[], visitDate: string,
    benchmarks: readonly BenchmarkInput[],
  ): BookRowPayload[];
  /** Las filas que esperan una lectura. */
  export function bookPending(rows: readonly BookRowPayload[]): number[];
  export function visitStatusOf(rows: readonly BookRowPayload[]): "draft" | "in_progress" | "calculated";
  /** Las V− a un punto que no es de control ni BM del lugar, una por código. */
  export function auxiliaryPoints(
    rows: readonly BookRowPayload[], points: Pick<PointInput, "code">[], benchmarks: readonly BenchmarkInput[],
  ): { rowIndex: number; code: string }[];
  ```

- [ ] **Step 1: Escribir la prueba**

```ts
// src/lib/calculations/settlement-book-plantilla.test.ts
import { describe, expect, it } from "vitest";
import {
  auxiliaryPoints, bookElevations, bookPending, bookTemplate, computeBook, visitStatusOf,
  type BookRowInput,
} from "./settlement-book";
import type { PointType } from "@/types/leveling";
import type { PointInput } from "@/types/settlement";

function r(pointCode: string, pointType: PointType, backsight: number | null, foresight: number | null,
  startsSection = false): BookRowInput {
  return { pointCode, pointType, backsight, foresight, backUpperM: null, backLowerM: null,
    foreUpperM: null, foreLowerM: null, backDistanceM: null, foreDistanceM: null,
    distanceAccumulatedKm: null, startsSection };
}
const point = (code: string, retiredOn: string | null = null, activeFrom: string | null = null): PointInput =>
  ({ id: code, code, initialElevation: null, activeFrom, retiredOn });

const alameda12 = [
  r("BM-1", "bm", 1.8637, null, true),
  r("BM-2", "intermediate", null, 1.0191),
  r("TA-01", "intermediate", null, 1.2682),
  r("TA-04", "intermediate", null, 1.3838),
  r("CP-1", "pc", 0.6263, 1.2152),
  r("TA-05", "intermediate", null, 0.8349),
  r("TA-08", "intermediate", null, 0.6912),
  r("BM-1", "bm", null, 1.2764),
];
const BMS = [{ code: "BM-1", elevation: 100 }, { code: "BM-2", elevation: 100.845 }];
const POINTS = ["TA-01", "TA-04", "TA-05", "TA-08"].map((c) => point(c));
const DATE = "2025-10-14";

describe("las cotas de los puntos de la visita", () => {
  it("cada punto toma la cota de su lectura, sin corregir", () => {
    const book = computeBook(alameda12, BMS);
    const { readings, issues } = bookElevations(book, alameda12, POINTS, DATE);
    expect(readings.map((x) => [x.pointId, x.elevation])).toEqual([
      ["TA-01", 100.5955], ["TA-04", 100.4799], ["TA-05", 100.4399], ["TA-08", 100.5836],
    ]);
    expect(issues).toEqual([]);
  });

  it("un punto leído en dos armadas es un error con sus dos filas, y no da cota", () => {
    const rows = [...alameda12.slice(0, 6), r("TA-04", "intermediate", null, 0.7958), ...alameda12.slice(6)];
    const { readings, issues } = bookElevations(computeBook(rows, BMS), rows, POINTS, DATE);
    expect(readings.find((x) => x.pointId === "TA-04")).toBeUndefined();
    expect(issues).toContainEqual({ kind: "duplicate", level: "error", pointId: "TA-04", code: "TA-04", rows: [3, 6] });
  });

  it("un punto por leer no da cota ni aviso de ausente", () => {
    const rows = alameda12.map((row) => (row.pointCode === "TA-05" ? { ...row, foresight: null } : row));
    const { readings, issues } = bookElevations(computeBook(rows, BMS), rows, POINTS, DATE);
    expect(readings.map((x) => x.pointId)).toEqual(["TA-01", "TA-04", "TA-08"]);
    expect(issues).toEqual([]);
  });

  it("un punto vigente que no está en la libreta avisa", () => {
    const points = [...POINTS, point("TA-09")];
    const { issues } = bookElevations(computeBook(alameda12, BMS), alameda12, points, DATE);
    expect(issues).toEqual([{ kind: "missing", level: "warning", pointId: "TA-09", code: "TA-09" }]);
  });
});

describe("la plantilla de una visita nueva", () => {
  it("copia las armadas de la anterior, sin lecturas", () => {
    const t = bookTemplate(alameda12, POINTS, DATE, BMS);
    expect(t.map((x) => [x.pointCode, x.pointType, x.startsSection ?? false])).toEqual(
      alameda12.map((x) => [x.pointCode, x.pointType, x.startsSection ?? false]),
    );
    expect(t.every((x) => x.backsight == null && x.foresight == null && x.backDistanceM == null)).toBe(true);
  });

  it("quita el punto dado de baja y añade el nuevo antes del BM de cierre", () => {
    const points = [point("TA-01"), point("TA-04", "2025-10-01"), point("TA-05"), point("TA-08"), point("TA-09")];
    const codes = bookTemplate(alameda12, points, DATE, BMS).map((x) => x.pointCode);
    expect(codes).toEqual(["BM-1", "BM-2", "TA-01", "CP-1", "TA-05", "TA-08", "TA-09", "BM-1"]);
  });

  it("sin visita anterior: una armada desde el primer BM del lugar con los puntos vigentes", () => {
    const t = bookTemplate(null, POINTS, DATE, BMS);
    expect(t.map((x) => [x.pointCode, x.pointType])).toEqual([
      ["BM-1", "bm"], ["TA-01", "intermediate"], ["TA-04", "intermediate"], ["TA-05", "intermediate"], ["TA-08", "intermediate"],
    ]);
    expect(t[0]!.startsSection).toBe(true);
  });

  it("sin BM en el lugar no hay plantilla", () => {
    expect(bookTemplate(null, POINTS, DATE, [])).toEqual([]);
  });
});

describe("lo pendiente y el estado de la visita", () => {
  it("la plantilla espera todas sus lecturas", () => {
    const t = bookTemplate(alameda12, POINTS, DATE, BMS);
    expect(bookPending(t)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    expect(visitStatusOf(t)).toBe("in_progress");
  });

  it("la libreta completa no espera nada", () => {
    expect(bookPending(alameda12)).toEqual([]);
    expect(visitStatusOf(alameda12)).toBe("calculated");
    expect(visitStatusOf([])).toBe("draft");
  });

  it("una armada que termina en sus puntos no espera V−", () => {
    const cartera = [r("PISCINA/BM", "bm", 1.45, null, true), r("A1", "intermediate", null, 4.062), r("B10", "intermediate", null, null)];
    expect(bookPending(cartera)).toEqual([2]);
  });
});

describe("los puntos auxiliares", () => {
  it("una V− a un punto que no es de control ni BM del lugar", () => {
    expect(auxiliaryPoints(alameda12, POINTS, BMS)).toEqual([{ rowIndex: 4, code: "CP-1" }]);
    expect(auxiliaryPoints(alameda12, POINTS, [...BMS, { code: "CP-1", elevation: 100.6485 }])).toEqual([]);
  });
});
```

- [ ] **Step 2: Ver la prueba fallar**

Run: `npx vitest run src/lib/calculations/settlement-book-plantilla.test.ts`
Expected: FAIL: `bookElevations` no existe.

- [ ] **Step 3: Implementar**

```ts
/**
 * Las cotas de los puntos de control de una visita (Fase 37): la de la fila
 * con su lectura —VI o V−—, sin corregir. Las filas sin cota (por leer, o
 * tras una cadena incompleta) no cuentan, ni como lectura ni como ausencia.
 */
export function bookElevations(
  book: VisitBook,
  rows: readonly BookRowInput[],
  points: PointInput[],
  visitDate: string,
): { readings: DerivedElevation[]; issues: BookIssue[] } {
  const measured = new Map<string, number[]>();
  const pending = new Set<string>();
  rows.forEach((row, index) => {
    const match = points.find((p) => samePointCode(p.code, row.pointCode));
    if (!match) return;
    if (row.foresight != null && Number.isFinite(book.readings[index]?.elevationCalculated)) {
      measured.set(match.id, [...(measured.get(match.id) ?? []), index]);
    } else if (row.foresight == null) {
      pending.add(match.id);
    }
  });

  const readings: DerivedElevation[] = [];
  const issues: BookIssue[] = [];
  for (const p of [...points].sort(byCode)) {
    const found = measured.get(p.id);
    const active = isPointActiveOn(p, visitDate);
    if (!found) {
      if (active && !pending.has(p.id)) issues.push({ kind: "missing", level: "warning", pointId: p.id, code: p.code });
      continue;
    }
    if (found.length > 1) {
      issues.push({ kind: "duplicate", level: "error", pointId: p.id, code: p.code, rows: found });
      continue;
    }
    const rowIndex = found[0]!;
    if (!active) {
      issues.push({ kind: "inactive", level: "warning", pointId: p.id, code: p.code, row: rowIndex });
      continue;
    }
    readings.push({ pointId: p.id, elevation: round4(book.readings[rowIndex]!.elevationCalculated), rowIndex });
  }
  const position = (i: BookIssue) => (i.kind === "missing" ? Infinity : i.kind === "duplicate" ? i.rows[0]! : i.row);
  issues.sort((a, b) => position(a) - position(b));
  readings.sort((a, b) => a.rowIndex - b.rowIndex);
  return { readings, issues };
}

const blankReadings = {
  backsight: null, foresight: null, backUpperM: null, backLowerM: null,
  foreUpperM: null, foreLowerM: null, backDistanceM: null, foreDistanceM: null,
} as const;

/**
 * La libreta de una visita nueva (Fase 37, decisión 4): las armadas de la
 * anterior —sus BM, sus puntos de cambio y sus puntos de control—, sin
 * lecturas, sin los puntos dados de baja y con los dados de alta antes del BM
 * de cierre. Sin anterior, una armada desde el primer BM del lugar.
 */
export function bookTemplate(
  previous: readonly BookRowPayload[] | null,
  points: PointInput[],
  visitDate: string,
  benchmarks: readonly BenchmarkInput[],
): BookRowPayload[] {
  const active = points.filter((p) => isPointActiveOn(p, visitDate)).sort(byCode);
  const asIntermediate = (code: string): BookRowPayload => ({ pointCode: code, pointType: "intermediate", ...blankReadings });

  if (!previous || previous.length === 0) {
    const first = benchmarks[0];
    if (!first) return [];
    return [
      { pointCode: first.code, pointType: "bm", startsSection: true, ...blankReadings },
      ...active.map((p) => asIntermediate(p.code)),
    ];
  }

  const controlOf = (code: string) => points.find((p) => samePointCode(p.code, code));
  const kept: BookRowPayload[] = previous
    .filter((row) => {
      const p = row.pointType === "intermediate" ? controlOf(row.pointCode) : undefined;
      return !p || isPointActiveOn(p, visitDate);
    })
    .map((row, i) => ({
      pointCode: row.pointCode,
      pointType: row.pointType,
      startsSection: i === 0 || Boolean(row.startsSection),
      ...blankReadings,
    }));
  const added = active
    .filter((p) => !kept.some((row) => samePointCode(row.pointCode, p.code)))
    .map((p) => asIntermediate(p.code));
  const last = kept.at(-1)!;
  return last.pointType !== "intermediate" && kept.length > 1
    ? [...kept.slice(0, -1), ...added, last]
    : [...kept, ...added];
}

/**
 * Las filas que esperan una lectura (Fase 37, decisión 9): la V+ de un
 * arranque, la VI de una intermedia y la V− de cualquier otra fila; un punto
 * de cambio que no es el último, también su V+.
 */
export function bookPending(rows: readonly BookRowPayload[]): number[] {
  const last = rows.length - 1;
  return rows.flatMap((row, i) => {
    if (i === 0 || row.startsSection) return row.backsight == null ? [i] : [];
    if (row.pointType === "intermediate") return row.foresight == null ? [i] : [];
    const missingFore = row.foresight == null;
    const missingBack = row.pointType === "pc" && i !== last && row.backsight == null;
    return missingFore || missingBack ? [i] : [];
  });
}

export function visitStatusOf(rows: readonly BookRowPayload[]): "draft" | "in_progress" | "calculated" {
  if (rows.length === 0) return "draft";
  return bookPending(rows).length > 0 ? "in_progress" : "calculated";
}

/** Los puntos auxiliares de la libreta (Fase 37, decisión 11). */
export function auxiliaryPoints(
  rows: readonly BookRowPayload[],
  points: Pick<PointInput, "code">[],
  benchmarks: readonly BenchmarkInput[],
): { rowIndex: number; code: string }[] {
  const seen = new Set<string>();
  return rows.flatMap((row, i) => {
    if (i === 0 || row.startsSection || row.pointType === "intermediate" || row.foresight == null) return [];
    if (points.some((p) => samePointCode(p.code, row.pointCode))) return [];
    if (benchmarks.some((b) => samePointCode(b.code, row.pointCode))) return [];
    const key = row.pointCode.trim().toUpperCase();
    if (seen.has(key)) return [];
    seen.add(key);
    return [{ rowIndex: i, code: row.pointCode.trim() }];
  });
}
```

En `src/types/settlement.ts`: `VISIT_STATUSES` con `"in_progress"` y `VISIT_STATUS_LABELS.in_progress = "En medición"`.

- [ ] **Step 4: Ver la prueba pasar**

Run: `npx vitest run src/lib/calculations/settlement-book-plantilla.test.ts`
Expected: PASS (12).

- [ ] **Step 5: Suite, tipos y commit**

Run: `npm run typecheck && npm test`
Expected: limpio y todo PASS.

```bash
git add src/types/settlement.ts src/lib/calculations/settlement-book.ts src/lib/calculations/settlement-book-plantilla.test.ts
git diff --cached --name-status
git commit -m "feat: las cotas de la visita sin corregir, su plantilla, lo pendiente y los auxiliares"
```

---

### Task 4: Motor y validación — BM leídos de paso, margen fijo de la tendencia, libreta por tramos

**Files:**
- Modify: `src/lib/calculations/settlement-book.ts`: `bookBenchmarkChecks`.
- Modify: `src/lib/calculations/tolerances.ts`: `SETTLEMENT_VISIT_TOLERANCE_MM`; `trendDeviationMargin()` y `accelerationMargin(firstMonths, lastMonths)` sin circuitos; fuera `DIRECT_CAPTURE_CIRCUIT_KM` y `squaredTolerance`.
- Modify: `src/lib/calculations/settlement.ts`: `computeTrends(visits)` y `detectTrendDeviations(visits)` sin `circuitByVisit`; fuera `visitCircuitsOf`. `src/types/settlement.ts`: fuera `VisitCircuit`.
- Modify (llamadores, solo quitar el argumento): `src/app/(app)/projects/[id]/settlement/[siteId]/panel-tab.tsx`, `.../visits/[visitId]/visit-data.ts`, `.../visits/[visitId]/page.tsx`, `src/components/settlement/visit-editor.tsx`, `src/lib/export/settlement-workbook.ts`.
- Modify: `src/lib/validators/settlement-book.ts`: `validateBook(rows, benchmarks)`; `benchmarkCheckMessage(check, startCode)` sin cambios de forma.
- Test: `src/lib/calculations/settlement-book-bm.test.ts`, `src/lib/validators/settlement-book.test.ts` (casos nuevos), `src/lib/calculations/settlement.test.ts` (los de margen).

**Interfaces:**
- Consumes: `computeBook`, `VisitBook` (Tarea 2).
- Produces:
  ```ts
  export function bookBenchmarkChecks(
    book: VisitBook, rows: readonly BookRowInput[], benchmarks: readonly BenchmarkInput[], points: Pick<PointInput, "code">[],
  ): BenchmarkCheck[];
  export const SETTLEMENT_VISIT_TOLERANCE_MM: number; // 12·√0.5 ≈ 8.49
  export function trendDeviationMargin(): number;     // 6 mm exactos
  export function accelerationMargin(firstMonths: number, lastMonths: number): number;
  export function computeTrends(visits: VisitResult[]): Record<string, Trend>;
  export function detectTrendDeviations(visits: VisitResult[]): Map<string, Map<string, TrendDeviation>>;
  export function validateBook(rows: readonly BookRowInput[], benchmarks: readonly BenchmarkInput[]): VisitBookIssues;
  ```

- [ ] **Step 1: Escribir las pruebas**

```ts
// src/lib/calculations/settlement-book-bm.test.ts
import { describe, expect, it } from "vitest";
import { bookBenchmarkChecks, computeBook, type BookRowInput } from "./settlement-book";
import { computeSettlements, detectTrendDeviations } from "./settlement";
import { trendDeviationMargin } from "./tolerances";
import type { PointType } from "@/types/leveling";

function r(pointCode: string, pointType: PointType, backsight: number | null, foresight: number | null,
  bd: number | null = null, fd: number | null = null, startsSection = false): BookRowInput {
  return { pointCode, pointType, backsight, foresight, backUpperM: null, backLowerM: null,
    foreUpperM: null, foreLowerM: null, backDistanceM: bd, foreDistanceM: fd, distanceAccumulatedKm: null, startsSection };
}
const BMS = [{ code: "BM-1", elevation: 100 }, { code: "BM-2", elevation: 100.845 }];
const rows = [
  r("BM-1", "bm", 1.8637, null, 28.363, null, true),
  r("BM-2", "intermediate", null, 1.0191),
  r("TA-01", "intermediate", null, 1.2682),
  r("CP-1", "pc", 0.6263, 1.2152, 28.207, 27.818),
  r("BM-1", "bm", null, 1.2764, null, 28.27),
];

describe("un BM del lugar leído de paso", () => {
  it("se compara con su cota del lugar en tercer orden; el BM de cierre no", () => {
    const checks = bookBenchmarkChecks(computeBook(rows, BMS), rows, BMS, [{ code: "TA-01" }]);
    expect(checks).toHaveLength(1);
    expect(checks[0]).toMatchObject({ rowIndex: 1, code: "BM-2", catalogElevation: 100.845, measuredElevation: 100.8446, differenceMm: -0.4, meetsTolerance: true });
  });
});

describe("el margen fijo de la tendencia", () => {
  it("son 6 mm entre dos visitas, sin orden ni circuito", () => {
    expect(trendDeviationMargin()).toBe(6);
  });

  it("B10 de la cartera: «excesiva» en la visita 3 y «contraria» en la 4", () => {
    const dates = ["2022-03-24", "2022-03-31", "2022-04-12", "2022-04-19"];
    const cotas = [153.689, 153.679, 153.629, 153.674];
    const visits = dates.map((date, i) => ({ id: `v${i + 1}`, visitNumber: i + 1, date, readings: [{ pointId: "B10", elevation: cotas[i]! }] }));
    const dev = detectTrendDeviations(
      computeSettlements([{ id: "B10", code: "B10", initialElevation: null, activeFrom: null, retiredOn: null }], visits),
    );
    expect(dev.get("v3")?.get("B10")).toMatchObject({ kind: "excessive", partialMm: -50, expectedMm: 17.1, marginMm: 6 });
    expect(dev.get("v4")?.get("B10")).toMatchObject({ kind: "contrary", partialMm: 45 });
  });
});
```

En `src/lib/validators/settlement-book.test.ts`, reemplazar los casos del amarre por:

```ts
describe("validateBook (Fase 37)", () => {
  const BMS = [{ code: "BM-1", elevation: 100 }];
  it("una libreta vacía no exige nada", () => {
    expect(validateBook([], BMS)).toEqual({ rowIssues: [], errors: [] });
  });
  it("cada tramo arranca en un BM del lugar", () => {
    const rows = [row("BM-1", "bm", 1.2, null, true), row("P-1", "intermediate", null, 1), row("X-9", "bm", 1.1, null, true)];
    expect(validateBook(rows, BMS).errors).toEqual(["La armada 2 sale de X-9, que no está en los BM del lugar."]);
  });
  it("las lecturas por leer no son error", () => {
    const rows = [row("BM-1", "bm", null, null, true), row("P-1", "intermediate", null, null), row("BM-1", "bm", null, null)];
    const v = validateBook(rows, BMS);
    expect(v.errors).toEqual([]);
    expect(v.rowIssues.every((i) => Object.keys(i.errors).length === 0)).toBe(true);
  });
  it("un valor que no es número es error", () => {
    expect(validateBook([row("BM-1", "bm", Number.NaN, null, true)], BMS).errors).toContain("La libreta tiene un valor que no es un número.");
  });
});
```

con `row(pointCode, pointType, backsight, foresight, startsSection = false)` el ayudante del archivo, ampliado con `startsSection`. «La armada 2» cuenta las armadas como `visitArmadaSpans` de la Tarea 6: aquí basta numerar los arranques de tramo que no son la primera fila y las aperturas previas; se calcula como el número de filas que abren una armada hasta esa fila inclusive (una fila abre armada si es arranque o si es un punto de cambio).

En `src/lib/calculations/settlement.test.ts`, los casos que pasaban circuitos llaman ahora sin ese argumento; los que comprobaban el margen por orden o por longitud de libreta se borran (la regla desaparece, decisión 17).

- [ ] **Step 2: Ver las pruebas fallar**

Run: `npx vitest run src/lib/calculations/settlement-book-bm.test.ts src/lib/validators/settlement-book.test.ts`
Expected: FAIL: `bookBenchmarkChecks` y `validateBook` no existen.

- [ ] **Step 3: Implementar**

```ts
// tolerances.ts
/**
 * Lo que puede errar la cota de un punto en una visita, para el margen de
 * ruido de la tendencia (Fase 37, decisión 17): la de una visita sin libreta
 * en tercer orden, K·√0.5 km. Fijo: sin orden ni longitud de circuito, dos
 * visitas dan 6 mm, el margen que ya tenían las cotas tecleadas.
 */
// T² = K²·L con K de tercer orden y L = 0.5 km: 72 mm² exactos. Se trabaja
// con T² y no con T para que dos visitas den 6 mm sin ruido de coma flotante
// (12·√½ al cuadrado da 72.00000000000001).
const VISIT_TOLERANCE_SQ_MM2 = LEVELING_TOLERANCE_K.tercer_orden ** 2 * 0.5;
export const SETTLEMENT_VISIT_TOLERANCE_MM = Math.sqrt(VISIT_TOLERANCE_SQ_MM2);

/** Margen de ruido, en mm, del parcial entre dos visitas: ½·√(T² + T²). */
export function trendDeviationMargin(): number {
  return Math.sqrt(2 * VISIT_TOLERANCE_SQ_MM2) / 2;
}

/** Margen de ruido, en mm/mes, del aumento de velocidad de «Acelerando» (Fase 32), con T fijo. */
export function accelerationMargin(firstMonths: number, lastMonths: number): number {
  const t2 = VISIT_TOLERANCE_SQ_MM2;
  return Math.sqrt(t2 / firstMonths ** 2 + t2 * (1 / firstMonths + 1 / lastMonths) ** 2 + t2 / lastMonths ** 2) / 2;
}
```

Conservar el comentario de USACE y NGS de la versión anterior encima de `trendDeviationMargin`, cambiando «cada visita entra con su orden y la longitud de su libreta» por «T es fijo (decisión 17 de la Fase 37)».

En `settlement.ts`, `computeTrends` y `detectTrendDeviations` pierden su segundo parámetro y llaman `accelerationMargin(firstMonths, lastMonths)` y `trendDeviationMargin()`; se borra `visitCircuitsOf`. Cada llamador quita el argumento (y su `import` de `visitCircuitsOf`).

```ts
// settlement-book.ts
/**
 * Los BM del lugar leídos de paso (Fase 30, ahora contra `site_benchmarks`):
 * cada fila con cota cuyo código es un BM del lugar, que no es punto de
 * control, ni el arranque de su tramo, ni su BM de cierre —ese es el cierre—.
 * Tolerancia de tercer orden sobre la distancia hasta la fila (decisión 16).
 */
export function bookBenchmarkChecks(
  book: VisitBook,
  rows: readonly BookRowInput[],
  benchmarks: readonly BenchmarkInput[],
  points: Pick<PointInput, "code">[],
): BenchmarkCheck[] {
  const checks: BenchmarkCheck[] = [];
  for (const tramo of book.tramos) {
    for (let i = tramo.start + 1; i <= tramo.end; i++) {
      if (i === tramo.end && tramo.kind !== "open") continue;
      const row = rows[i]!;
      const computed = book.readings[i]!;
      if (row.foresight == null || !Number.isFinite(computed.elevationCalculated)) continue;
      if (points.some((p) => samePointCode(p.code, row.pointCode))) continue;
      const bm = benchmarks.find((b) => samePointCode(b.code, row.pointCode));
      if (!bm) continue;
      const measuredElevation = round4(computed.elevationCalculated);
      const raw = Math.round((measuredElevation - bm.elevation) * 1e4) / 10;
      const differenceMm = Object.is(raw, -0) ? 0 : raw;
      const km = computed.distanceAccumulatedKm;
      const toleranceMm = km != null && Number.isFinite(km) && km > 0 ? levelingTolerance("tercer_orden", km) : null;
      checks.push({
        rowIndex: i, code: row.pointCode.trim(), catalogElevation: bm.elevation, measuredElevation,
        differenceMm, toleranceMm,
        meetsTolerance: toleranceMm != null ? withinTolerance(differenceMm, toleranceMm) : null,
      });
    }
  }
  return checks;
}
```

```ts
// validators/settlement-book.ts
/**
 * Valida la libreta de una visita (Fase 37): cada tramo arranca en un BM del
 * lugar y cada fila pasa las reglas de captura de la nivelación. Lo que falta
 * por leer no es error: la visita se guarda en medición.
 */
export function validateBook(
  rows: readonly BookRowInput[],
  benchmarks: readonly BenchmarkInput[],
): VisitBookIssues {
  if (rows.length === 0) return { rowIssues: [], errors: [] };
  const errors: string[] = [];
  const numeric = ["backsight", "foresight", "backUpperM", "backLowerM", "foreUpperM", "foreLowerM", "backDistanceM", "foreDistanceM"] as const;
  if (rows.some((r) => numeric.some((k) => r[k] != null && !Number.isFinite(r[k])))) {
    errors.push("La libreta tiene un valor que no es un número.");
  }
  let armada = 0;
  rows.forEach((row, i) => {
    const starts = i === 0 || row.startsSection;
    if (starts || (row.pointType === "pc" && i !== rows.length - 1)) armada++;
    if (starts && !benchmarks.some((b) => samePointCode(b.code, row.pointCode))) {
      errors.push(`La armada ${armada} sale de ${row.pointCode.trim()}, que no está en los BM del lugar.`);
    }
  });
  const rowIssues = rows.map((row) => validateReadingCapture(row));
  return { rowIssues, errors };
}
```

`validateVisitBook` se queda hasta la Tarea 14.

- [ ] **Step 4: Ver las pruebas pasar**

Run: `npx vitest run src/lib/calculations/settlement-book-bm.test.ts src/lib/validators/settlement-book.test.ts src/lib/calculations/settlement.test.ts`
Expected: PASS.

- [ ] **Step 5: Suite, tipos y commit**

Run: `npm run typecheck && npm test`
Expected: limpio y todo PASS. Si el Excel o el panel tienen pruebas con circuitos, quitar el argumento igual.

```bash
git add src/lib src/types src/app src/components
git diff --cached --name-status
git commit -m "feat: BM del lugar leídos de paso, margen fijo de la tendencia y libreta por tramos"
```

---
### Task 5: El registro de una visita y el recálculo del lugar

**Files:**
- Create: `src/lib/calculations/visit-record.ts`: `visitRecordOf`, `recalculateSite`.
- Modify: `src/lib/calculations/settlement-persistence.ts`: `bookRowsToPersist` escribe `starts_section` y pasa `NaN` a `null`; `visitsToRewrite` ya no salta las visitas `closed` (decisión 18) y pierde `statusByVisit`.
- Modify: `src/lib/supabase/settlement-sync.ts`: `resyncSiteReadings` sin `statusByVisit`; nuevo `recomputeSite(supabase, siteId, { dryRun })`.
- Modify: los llamadores de `visitsToRewrite` (la acción de guardar la visita), solo para quitar `statusByVisit`.
- Test: `src/lib/calculations/visit-record.test.ts`; `settlement-persistence.test.ts` (el caso «no reescribe cerradas» pasa a «reescribe todas»).

**Interfaces:**
- Consumes: `computeBook`, `bookVerification`, `bookElevations`, `visitStatusOf` (Tareas 2-3); `computeHistory`; `bookRowsToPersist`.
- Produces:
  ```ts
  export interface VisitRecordInput {
    visitId: string;
    date: string;
    rows: BookRowPayload[];
    points: PointInput[];
    benchmarks: BenchmarkInput[];
  }
  export interface VisitRecordHeader {
    reference_bm_code: string | null;
    reference_bm_elevation: number | null;
    closure_error_mm: number | null;
    tolerance_mm: number | null;
    meets_tolerance: boolean | null;
    total_distance_km: number | null;
    precision_order: PrecisionOrder | null;
    status: "draft" | "in_progress" | "calculated";
  }
  export interface VisitRecord {
    book: VisitBook;
    verification: VisitVerification;
    elevations: DerivedElevation[];
    issues: BookIssue[];
    header: VisitRecordHeader;
    /** Las filas de `settlement_book_readings`, listas para `save_visit`. */
    rows: ReturnType<typeof bookRowsToPersist>;
  }
  export function visitRecordOf(input: VisitRecordInput): VisitRecord;

  export interface SiteVisitInput { id: string; visitNumber: number; date: string; rows: BookRowPayload[] }
  /** Todas las visitas recalculadas desde su libreta: el registro y las lecturas de cada una. */
  export function recalculateSite(input: {
    points: PointInput[]; benchmarks: BenchmarkInput[]; thresholds: Thresholds; visits: SiteVisitInput[];
  }): { visitId: string; record: VisitRecord; readings: ComputedReading[] }[];

  // settlement-sync.ts
  export async function recomputeSite(
    supabase: SupabaseClient, siteId: string, opts?: { dryRun?: boolean },
  ): Promise<{ ok: true; visits: number; changedReadings: number } | { ok: false; error: string }>;
  ```

- [ ] **Step 1: Escribir la prueba**

```ts
// src/lib/calculations/visit-record.test.ts
import { describe, expect, it } from "vitest";
import { recalculateSite, visitRecordOf } from "./visit-record";
import { thresholdsFor } from "./tolerances";
import type { BookRowPayload, PointInput } from "@/types/settlement";
import type { PointType } from "@/types/leveling";

function r(pointCode: string, pointType: PointType, backsight: number | null, foresight: number | null,
  bd: number | null = null, fd: number | null = null, startsSection = false): BookRowPayload {
  return { pointCode, pointType, backsight, foresight, backUpperM: null, backLowerM: null,
    foreUpperM: null, foreLowerM: null, backDistanceM: bd, foreDistanceM: fd, startsSection };
}
const point = (code: string, initialElevation: number | null = null): PointInput =>
  ({ id: code, code, initialElevation, activeFrom: null, retiredOn: null });
const BMS = [{ code: "BM-1", elevation: 100 }, { code: "BM-2", elevation: 100.845 }];
const alameda12 = [
  r("BM-1", "bm", 1.8637, null, 28.363, null, true),
  r("TA-01", "intermediate", null, 1.2682),
  r("CP-1", "pc", 0.6263, 1.2152, 28.207, 27.818),
  r("TA-08", "intermediate", null, 0.6912),
  r("BM-1", "bm", null, 1.2764, null, 28.27),
];

describe("el registro de una visita", () => {
  it("un circuito cerrado: segundo orden, sin compensar, calculada", () => {
    const rec = visitRecordOf({ visitId: "v12", date: "2025-10-14", rows: alameda12, points: [point("TA-01"), point("TA-08")], benchmarks: BMS });
    expect(rec.header).toEqual({
      reference_bm_code: "BM-1", reference_bm_elevation: 100,
      closure_error_mm: -1.6, tolerance_mm: 2, meets_tolerance: true, total_distance_km: 0.113,
      precision_order: "segundo_orden", status: "calculated",
    });
    expect(rec.elevations.map((e) => [e.pointId, e.elevation])).toEqual([["TA-01", 100.5955], ["TA-08", 100.5836]]);
    expect(rec.rows.map((x) => x.starts_section)).toEqual([true, false, false, false, false]);
    expect(rec.rows.every((x) => x.elevation_corrected === x.elevation_calculated)).toBe(true);
  });

  it("la cartera: una armada sin cierre, sin verificación", () => {
    const rows = [r("PISCINA/BM", "bm", 1.45, null, null, null, true), r("B10", "intermediate", null, 4.12)];
    const rec = visitRecordOf({ visitId: "v3", date: "2022-04-12", rows, points: [point("B10")], benchmarks: [{ code: "PISCINA/BM", elevation: 156.299 }] });
    expect(rec.header).toMatchObject({
      reference_bm_code: "PISCINA/BM", closure_error_mm: null, tolerance_mm: null,
      meets_tolerance: null, precision_order: null, status: "calculated",
    });
    expect(rec.elevations).toEqual([{ pointId: "B10", elevation: 153.629, rowIndex: 1 }]);
  });

  it("una fila por leer se guarda sin cota y deja la visita en medición", () => {
    const rows = [r("PISCINA/BM", "bm", 1.45, null, null, null, true), r("B10", "intermediate", null, null)];
    const rec = visitRecordOf({ visitId: "v3", date: "2022-04-12", rows, points: [point("B10")], benchmarks: [{ code: "PISCINA/BM", elevation: 156.299 }] });
    expect(rec.header.status).toBe("in_progress");
    expect(rec.rows[1]!.elevation_calculated).toBeNull();
    expect(rec.elevations).toEqual([]);
  });
});

describe("el recálculo del lugar", () => {
  const visits = [
    { id: "v1", visitNumber: 1, date: "2025-01-07", rows: [r("BM-1", "bm", 1.5, null, null, null, true), r("TA-01", "intermediate", null, 1.0)] },
    { id: "v2", visitNumber: 2, date: "2025-02-07", rows: [r("BM-1", "bm", 1.5, null, null, null, true), r("TA-01", "intermediate", null, 1.002)] },
  ];
  const thresholds = thresholdsFor("edificio");

  it("cambiar la cota de un BM mueve las cotas; sin C0 tecleada, los asentamientos no", () => {
    const before = recalculateSite({ points: [point("TA-01")], benchmarks: BMS, thresholds, visits });
    const after = recalculateSite({ points: [point("TA-01")], benchmarks: [{ code: "BM-1", elevation: 100.01 }], thresholds, visits });
    expect(before[1]!.readings[0]).toMatchObject({ elevation: 100.498, accumulatedSettlement: -2 });
    expect(after[1]!.readings[0]).toMatchObject({ elevation: 100.508, accumulatedSettlement: -2 });
  });

  it("con C0 tecleada, el cambio del BM sí se ve en el acumulado", () => {
    const after = recalculateSite({ points: [point("TA-01", 100.5)], benchmarks: [{ code: "BM-1", elevation: 100.01 }], thresholds, visits });
    expect(after[1]!.readings[0]!.accumulatedSettlement).toBe(8);
  });
});
```

- [ ] **Step 2: Ver la prueba fallar**

Run: `npx vitest run src/lib/calculations/visit-record.test.ts`
Expected: FAIL: no existe `./visit-record`.

- [ ] **Step 3: Implementar**

```ts
// src/lib/calculations/visit-record.ts
// Lo que se guarda de una visita (Fase 37): de su libreta, los BM del lugar y
// los puntos, sale todo —cotas, verificación, estado y filas—. Lo usan la
// acción de guardar, el recálculo del lugar, el script de resincronización y
// la demo: una sola regla para todos (aprendizaje de la Fase 36).
import { computeHistory } from "./settlement";
import {
  bookElevations, bookRowInputOf, bookVerification, computeBook, visitStatusOf,
} from "./settlement-book";
import { bookRowsToPersist } from "./settlement-persistence";
import { samePointCode } from "./leveling";
import type { PrecisionOrder } from "@/types/project";
import type {
  BenchmarkInput, BookIssue, BookRowPayload, ComputedReading, DerivedElevation,
  PointInput, Thresholds, VisitBook, VisitVerification,
} from "@/types/settlement";

const round = (v: number | null, d: number) => (v == null || !Number.isFinite(v) ? null : Number(v.toFixed(d)));

/* …las interfaces de la sección Interfaces… */

export function visitRecordOf({ visitId, date, rows, points, benchmarks }: VisitRecordInput): VisitRecord {
  const book = computeBook(rows.map(bookRowInputOf), benchmarks);
  const verification = bookVerification(book);
  const { readings: elevations, issues } = bookElevations(book, rows.map(bookRowInputOf), points, date);
  const first = book.tramos[0];
  const worst = verification.worst;
  const closes = worst != null && worst.kind !== "open" && worst.complete;
  // La cota de cada BM del lugar en su fila, como la copiaba la Fase 30.
  const catalog = rows.map((row) =>
    points.some((p) => samePointCode(p.code, row.pointCode))
      ? null
      : benchmarks.find((b) => samePointCode(b.code, row.pointCode))?.elevation ?? null,
  );
  return {
    book,
    verification,
    elevations,
    issues,
    header: {
      reference_bm_code: first?.startCode ?? null,
      reference_bm_elevation: first?.startElevation ?? null,
      closure_error_mm: closes ? worst!.closureMm : null,
      tolerance_mm: closes ? worst!.toleranceMm : null,
      meets_tolerance: verification.verified ? true : closes ? false : null,
      total_distance_km: round(verification.distanceKm, 3),
      precision_order: verification.order,
      status: visitStatusOf(rows),
    },
    rows: bookRowsToPersist(visitId, rows, book.readings, points, catalog),
  };
}

export function recalculateSite({ points, benchmarks, thresholds, visits }: {
  points: PointInput[]; benchmarks: BenchmarkInput[]; thresholds: Thresholds; visits: SiteVisitInput[];
}) {
  const records = visits.map((v) => ({
    visit: v,
    record: visitRecordOf({ visitId: v.id, date: v.date, rows: v.rows, points, benchmarks }),
  }));
  const history = computeHistory(
    points,
    records.map(({ visit, record }) => ({
      id: visit.id, visitNumber: visit.visitNumber, date: visit.date,
      readings: record.elevations.map(({ pointId, elevation }) => ({ pointId, elevation })),
    })),
    thresholds,
  );
  return records.map(({ visit, record }) => ({
    visitId: visit.id,
    record,
    readings: history.visits.find((h) => h.visitId === visit.id)?.readings ?? [],
  }));
}
```

En `bookRowsToPersist`: `starts_section: i === 0 || Boolean(row.startsSection)`, y cada número calculado pasa por `finite(v) ? v : null` (`elevation_calculated`, `elevation_corrected`, `instrument_height`, `distance_accumulated_km`, `correction_applied`).

`recomputeSite` carga el lugar, sus puntos, `site_benchmarks`, sus visitas y la libreta de cada una (`bookRowOf`); llama a `recalculateSite`; cuenta las lecturas cuya cota cambia más de 0.00005 m frente a `settlement_readings`; con `dryRun` devuelve la cuenta, y si no, por cada visita llama a `save_visit` con `record.header`, `record.rows`, sus lecturas y `p_rewrites: []`. Comentario: «una visita por llamada: cada una es atómica; si una falla, el error dice cuál y las anteriores quedan recalculadas, que es correcto».

- [ ] **Step 4: Ver la prueba pasar**

Run: `npx vitest run src/lib/calculations/visit-record.test.ts src/lib/calculations/settlement-persistence.test.ts`
Expected: PASS.

- [ ] **Step 5: Suite, tipos y commit**

Run: `npm run typecheck && npm test`
Expected: limpio y todo PASS.

```bash
git add src/lib/calculations src/lib/supabase/settlement-sync.ts "src/app/(app)/projects/[id]/settlement/[siteId]/actions.ts"
git diff --cached --name-status
git commit -m "feat: el registro de una visita y el recálculo del lugar desde sus libretas"
```

---

### Task 6: La armada de la visita — de un popup a las filas

**Files:**
- Create: `src/components/settlement/visit-armadas.ts` (sin «use client»: lo usan el popup y las pruebas).
- Test: `src/components/settlement/visit-armadas.test.ts`.

**Interfaces:**
- Consumes: `BookRowPayload` con `startsSection` (Tarea 2); `samePointCode`.
- Produces:
  ```ts
  export interface VisitVisual { reading: number | null; distanceM: number | null; upperM: number | null; lowerM: number | null }
  export interface VisitArmada {
    /** De dónde sale la V+: un BM del lugar (abre un tramo) o el punto de cambio de la armada anterior. */
    from: "bm" | "pc";
    backCode: string;
    back: VisitVisual;
    /** Las vistas a los puntos (VI), en orden. */
    points: { pointCode: string; reading: number | null }[];
    /** La V−: a un BM del lugar o a un punto de cambio; null sin vista adelante. */
    fore: { pointCode: string; pointType: "bm" | "pc"; visual: VisitVisual } | null;
  }
  export interface VisitArmadaSpan { opener: number; intermediates: number[]; closer: number | null }
  export function visitArmadaSpans(rows: readonly BookRowPayload[]): VisitArmadaSpan[];
  export function visitArmadaAt(rows: readonly BookRowPayload[], k: number): VisitArmada;
  export function writeVisitArmada(rows: readonly BookRowPayload[], k: number, a: VisitArmada): { rows: BookRowPayload[] } | { error: string };
  export function appendVisitArmada(rows: readonly BookRowPayload[], a: VisitArmada): { rows: BookRowPayload[] } | { error: string };
  /** El punto de cambio desde el que puede salir la próxima armada; null si no hay. */
  export function pendingChangePoint(rows: readonly BookRowPayload[], benchmarks: readonly { code: string }[]): string | null;
  /** «Terminar armada»: quita sus puntos sin leer. */
  export function finishVisitArmada(rows: readonly BookRowPayload[], k: number): BookRowPayload[];
  /** El punto repetido: quita una de sus filas, solo si es una vista a un punto. */
  export function dropBookRow(rows: readonly BookRowPayload[], index: number): { rows: BookRowPayload[] } | { error: string };
  ```

- [ ] **Step 1: Escribir la prueba**

```ts
// src/components/settlement/visit-armadas.test.ts
import { describe, expect, it } from "vitest";
import {
  appendVisitArmada, dropBookRow, finishVisitArmada, pendingChangePoint, visitArmadaAt,
  visitArmadaSpans, writeVisitArmada, type VisitArmada,
} from "./visit-armadas";
import type { BookRowPayload } from "@/types/settlement";
import type { PointType } from "@/types/leveling";

function r(pointCode: string, pointType: PointType, backsight: number | null, foresight: number | null, startsSection = false): BookRowPayload {
  return { pointCode, pointType, backsight, foresight, backUpperM: null, backLowerM: null,
    foreUpperM: null, foreLowerM: null, backDistanceM: null, foreDistanceM: null, startsSection };
}
const v = (reading: number | null) => ({ reading, distanceM: null, upperM: null, lowerM: null });
const alameda12 = [
  r("BM-1", "bm", 1.8637, null, true),
  r("TA-01", "intermediate", null, 1.2682),
  r("CP-1", "pc", 0.6263, 1.2152),
  r("TA-05", "intermediate", null, 0.8349),
  r("BM-1", "bm", null, 1.2764),
];
const BMS = [{ code: "BM-1" }, { code: "BM-2" }];

describe("las armadas de una visita", () => {
  it("dos armadas por un punto de cambio", () => {
    expect(visitArmadaSpans(alameda12)).toEqual([
      { opener: 0, intermediates: [1], closer: 2 },
      { opener: 2, intermediates: [3], closer: 4 },
    ]);
  });

  it("un tramo nuevo no cierra la armada anterior, que termina en sus puntos", () => {
    const rows = [r("BM-1", "bm", 1.5, null, true), r("TA-01", "intermediate", null, 1), r("BM-2", "bm", 1.2, null, true), r("TA-05", "intermediate", null, 1)];
    expect(visitArmadaSpans(rows)).toEqual([
      { opener: 0, intermediates: [1], closer: null },
      { opener: 2, intermediates: [3], closer: null },
    ]);
  });

  it("la plantilla sin lecturas ya muestra sus armadas", () => {
    const blank = alameda12.map((x) => ({ ...x, backsight: null, foresight: null }));
    expect(visitArmadaSpans(blank)).toHaveLength(2);
  });

  it("lee una armada", () => {
    expect(visitArmadaAt(alameda12, 1)).toEqual({
      from: "pc", backCode: "CP-1", back: v(0.6263),
      points: [{ pointCode: "TA-05", reading: 0.8349 }],
      fore: { pointCode: "BM-1", pointType: "bm", visual: v(1.2764) },
    });
  });

  it("escribe una armada sin tocar las otras", () => {
    const a = { ...visitArmadaAt(alameda12, 0), points: [{ pointCode: "TA-01", reading: 1.27 }, { pointCode: "TA-02", reading: 1.3 }] };
    const out = writeVisitArmada(alameda12, 0, a);
    expect("rows" in out && out.rows.map((x) => [x.pointCode, x.backsight, x.foresight])).toEqual([
      ["BM-1", 1.8637, null], ["TA-01", null, 1.27], ["TA-02", null, 1.3], ["CP-1", 0.6263, 1.2152], ["TA-05", null, 0.8349], ["BM-1", null, 1.2764],
    ]);
  });

  it("quitar la V− de una armada de la que sale otra es un error", () => {
    const out = writeVisitArmada(alameda12, 0, { ...visitArmadaAt(alameda12, 0), fore: null });
    expect(out).toEqual({ error: "La armada 2 sale de CP-1: quítala antes de quitar esta vista adelante." });
  });

  it("agrega una armada desde un BM del lugar: abre un tramo", () => {
    const a: VisitArmada = { from: "bm", backCode: "BM-2", back: v(1.2), points: [{ pointCode: "TA-09", reading: 1.1 }], fore: null };
    const out = appendVisitArmada(alameda12, a);
    expect("rows" in out && out.rows.slice(5).map((x) => [x.pointCode, x.pointType, x.backsight, x.foresight, x.startsSection])).toEqual([
      ["BM-2", "bm", 1.2, null, true], ["TA-09", "intermediate", null, 1.1, false],
    ]);
  });

  it("agrega una armada desde el punto de cambio: la V+ va en su fila", () => {
    const rows = alameda12.slice(0, 3).map((x, i) => (i === 2 ? { ...x, backsight: null } : x));
    expect(pendingChangePoint(rows, BMS)).toBe("CP-1");
    const out = appendVisitArmada(rows, { from: "pc", backCode: "CP-1", back: v(0.6263), points: [{ pointCode: "TA-05", reading: 0.8349 }], fore: { pointCode: "BM-1", pointType: "bm", visual: v(1.2764) } });
    expect("rows" in out && out.rows.map((x) => [x.pointCode, x.backsight, x.foresight])).toEqual([
      ["BM-1", 1.8637, null], ["TA-01", null, 1.2682], ["CP-1", 0.6263, 1.2152], ["TA-05", null, 0.8349], ["BM-1", null, 1.2764],
    ]);
  });

  it("tras cerrar en un BM no hay punto de cambio", () => {
    expect(pendingChangePoint(alameda12, BMS)).toBeNull();
  });

  it("«Terminar armada» quita sus puntos sin leer", () => {
    const rows = [r("BM-1", "bm", 1.5, null, true), r("TA-01", "intermediate", null, 1), r("TA-02", "intermediate", null, null)];
    expect(finishVisitArmada(rows, 0).map((x) => x.pointCode)).toEqual(["BM-1", "TA-01"]);
  });

  it("el punto repetido solo se quita si es una vista a un punto", () => {
    expect(dropBookRow(alameda12, 1)).toEqual({ rows: alameda12.filter((_, i) => i !== 1) });
    expect(dropBookRow(alameda12, 2)).toEqual({ error: "Esa lectura es parte de la cadena de armadas: no se puede quitar aquí." });
  });
});
```

- [ ] **Step 2: Ver la prueba fallar**

Run: `npx vitest run src/components/settlement/visit-armadas.test.ts`
Expected: FAIL: no existe `./visit-armadas`.

- [ ] **Step 3: Implementar**

```ts
// src/components/settlement/visit-armadas.ts
// La captura por armada de la visita (Fase 37, decisión 8), sobre el modelo
// por punto de la libreta: una fila es un punto; su V+ abre una armada y su
// V− cierra la anterior. Lo que añade la visita: una armada puede salir de un
// BM del lugar (abre un tramo, `startsSection`) y su V− es opcional.
import { samePointCode } from "@/lib/calculations/leveling";
import type { BookRowPayload } from "@/types/settlement";

/* …interfaces de la sección Interfaces… */

const blank = {
  backsight: null, foresight: null, backUpperM: null, backLowerM: null,
  foreUpperM: null, foreLowerM: null, backDistanceM: null, foreDistanceM: null,
} as const;
const starts = (rows: readonly BookRowPayload[], i: number) => i === 0 || Boolean(rows[i]!.startsSection);

export function visitArmadaSpans(rows: readonly BookRowPayload[]): VisitArmadaSpan[] {
  const spans: VisitArmadaSpan[] = [];
  let open: VisitArmadaSpan | null = null;
  const last = rows.length - 1;
  rows.forEach((row, i) => {
    const start = starts(rows, i);
    if (!start && row.pointType === "intermediate") {
      open?.intermediates.push(i);
      return;
    }
    if (open) {
      if (!start) open.closer = i;
      spans.push(open);
      open = null;
    }
    if (start || (i < last && (row.pointType === "pc" || row.backsight != null))) {
      open = { opener: i, intermediates: [], closer: null };
    }
  });
  if (open) spans.push(open);
  return spans;
}

const backOf = (row: BookRowPayload): VisitVisual => ({
  reading: row.backsight, distanceM: row.backDistanceM, upperM: row.backUpperM, lowerM: row.backLowerM,
});
const foreOf = (row: BookRowPayload): VisitVisual => ({
  reading: row.foresight, distanceM: row.foreDistanceM, upperM: row.foreUpperM, lowerM: row.foreLowerM,
});
const withBack = (row: BookRowPayload, b: VisitVisual): BookRowPayload => ({
  ...row, backsight: b.reading, backDistanceM: b.distanceM, backUpperM: b.upperM, backLowerM: b.lowerM,
});
const withFore = (row: BookRowPayload, f: VisitVisual): BookRowPayload => ({
  ...row, foresight: f.reading, foreDistanceM: f.distanceM, foreUpperM: f.upperM, foreLowerM: f.lowerM,
});
const pointRow = (p: { pointCode: string; reading: number | null }): BookRowPayload => ({
  pointCode: p.pointCode.trim(), pointType: "intermediate", startsSection: false, ...blank, foresight: p.reading,
});

export function visitArmadaAt(rows: readonly BookRowPayload[], k: number): VisitArmada {
  const span = visitArmadaSpans(rows)[k];
  if (!span) throw new Error(`No hay armada ${k + 1}.`);
  const o = rows[span.opener]!;
  const c = span.closer != null ? rows[span.closer]! : null;
  return {
    from: starts(rows, span.opener) ? "bm" : "pc",
    backCode: o.pointCode,
    back: backOf(o),
    points: span.intermediates.map((i) => ({ pointCode: rows[i]!.pointCode, reading: rows[i]!.foresight })),
    fore: c ? { pointCode: c.pointCode, pointType: c.pointType === "bm" ? "bm" : "pc", visual: foreOf(c) } : null,
  };
}

/** Las filas de una armada a partir de su apertura: la V+, las vistas y la V−. */
function armadaRows(opener: BookRowPayload, a: VisitArmada, closer: BookRowPayload | null): BookRowPayload[] {
  const head = withBack({ ...opener, pointCode: a.backCode.trim() }, a.back);
  const fore = a.fore
    ? [withFore({ ...(closer ?? { ...blank, startsSection: false }), pointCode: a.fore.pointCode.trim(), pointType: a.fore.pointType } as BookRowPayload, a.fore.visual)]
    : [];
  return [head, ...a.points.map(pointRow), ...fore];
}

export function writeVisitArmada(rows: readonly BookRowPayload[], k: number, a: VisitArmada): { rows: BookRowPayload[] } | { error: string } {
  const spans = visitArmadaSpans(rows);
  const span = spans[k];
  if (!span) return { error: `No hay armada ${k + 1}.` };
  const next = spans[k + 1];
  const closerOpensNext = span.closer != null && next?.opener === span.closer;
  if (!a.fore && closerOpensNext) {
    return { error: `La armada ${k + 2} sale de ${rows[span.closer!]!.pointCode.trim()}: quítala antes de quitar esta vista adelante.` };
  }
  const end = span.closer ?? span.intermediates.at(-1) ?? span.opener;
  const closer = span.closer != null ? rows[span.closer]! : null;
  const replaced = armadaRows(rows[span.opener]!, a, closer);
  return { rows: [...rows.slice(0, span.opener), ...replaced, ...rows.slice(end + 1)] };
}

export function pendingChangePoint(rows: readonly BookRowPayload[], benchmarks: readonly { code: string }[]): string | null {
  const last = rows.at(-1);
  if (!last || rows.length < 2 || last.pointType === "intermediate" || starts(rows, rows.length - 1)) return null;
  if (last.foresight == null) return null;
  return benchmarks.some((b) => samePointCode(b.code, last.pointCode)) ? null : last.pointCode.trim();
}

export function appendVisitArmada(rows: readonly BookRowPayload[], a: VisitArmada): { rows: BookRowPayload[] } | { error: string } {
  if (a.from === "pc") {
    const last = rows.at(-1);
    if (!last || last.pointType === "intermediate" || !samePointCode(last.pointCode, a.backCode)) {
      return { error: "No hay un punto de cambio desde el que salir: la armada anterior no terminó en uno." };
    }
    return { rows: [...rows.slice(0, -1), ...armadaRows(last, a, null)] };
  }
  const opener: BookRowPayload = { pointCode: a.backCode, pointType: "bm", startsSection: true, ...blank };
  return { rows: [...rows, ...armadaRows(opener, a, null)] };
}

export function finishVisitArmada(rows: readonly BookRowPayload[], k: number): BookRowPayload[] {
  const span = visitArmadaSpans(rows)[k];
  if (!span) return [...rows];
  const drop = new Set(span.intermediates.filter((i) => rows[i]!.foresight == null));
  return rows.filter((_, i) => !drop.has(i));
}

export function dropBookRow(rows: readonly BookRowPayload[], index: number): { rows: BookRowPayload[] } | { error: string } {
  if (rows[index]?.pointType !== "intermediate") {
    return { error: "Esa lectura es parte de la cadena de armadas: no se puede quitar aquí." };
  }
  return { rows: rows.filter((_, i) => i !== index) };
}
```

En `appendVisitArmada` desde un punto de cambio, `armadaRows(last, a, null)` conserva la V− de la fila del punto de cambio (viene de `last`) y le pone la V+: el `withBack` solo toca la V+.

- [ ] **Step 4: Ver la prueba pasar**

Run: `npx vitest run src/components/settlement/visit-armadas.test.ts`
Expected: PASS (11).

- [ ] **Step 5: Suite, tipos y commit**

Run: `npm run typecheck && npm test`

```bash
git add src/components/settlement/visit-armadas.ts src/components/settlement/visit-armadas.test.ts
git diff --cached --name-status
git commit -m "feat: la armada de la visita, desde un BM del lugar o un punto de cambio"
```

---
### Task 7: Acciones — visita, lugar, puntos y BM del lugar, sin cierre

**Files:**
- Modify: `src/app/(app)/projects/[id]/settlement/[siteId]/actions.ts`:
  - `createVisitAction(projectId, siteId, payload: NewVisitPayload)` → `{ ok, visitId }`. `NewVisitPayload = { date, operator, notes, equipmentBrand, equipmentModel, equipmentSerial }`. Crea la visita con `visit_number` = máximo + 1 y la guarda con `save_visit`: la libreta es `bookTemplate(libreta de la visita anterior por fecha, puntos, fecha, BM del lugar)` y la cabecera, `visitRecordOf(...).header`.
  - `saveVisitAction(projectId, payload: VisitPayload)`. `VisitPayload = { siteId, visitId, date, operator, notes, equipmentBrand, equipmentModel, equipmentSerial, book: BookRowPayload[] }`. Valida con `validateBook`; arma `visitRecordOf`; un `duplicate` en `record.issues` devuelve `{ ok: false, error, duplicate: { code, rows } }` para el aviso de la Tarea 12; arma el histórico con las cotas guardadas de las demás visitas y las de esta; `visitsToRewrite` sin estados; `save_visit` con `record.header`, las columnas de la visita y `record.rows`.
  - `deleteVisitAction(projectId, siteId, visitId)`: cualquier visita; después, `resyncSiteReadings`.
  - Fuera `closeVisitAction`, `reopenVisitAction`, `NewVisitPayload.captureMode/referenceBm/precisionOrder/levelType/kmPrecisionMm/equipmentCalibrationDate`, `VisitPayload.weatherConditions/closureErrorMm/readings/captureMode/referenceBm/precisionOrder`, `loadContext.statusByVisit`.
- Modify: `src/app/(app)/projects/[id]/sites/actions.ts`: `createSiteAction` devuelve `{ ok, siteId }` (lo usa el popup del hub); `saveSiteAction` sin guarda de cerrado y sin `notes`; `renameSiteAction` y `deleteSiteAction` sin guardas de cerrado; fuera `closeSiteAction` y `reopenSiteAction`.
- Modify: `src/app/(app)/projects/[id]/sites/[siteId]/point-actions.ts`: fuera `loadOpenSite` y toda regla de visitas cerradas (alta, C0, renombrar en la libreta, borrar, deshacer baja); `pointImpactAction(siteId, pointId)` → `{ visits: number }` (cuántas visitas tienen lectura del punto), para el aviso de la C0 y del borrado; al cambiar la C0, `resyncSiteReadings`.
- Create: `src/app/(app)/projects/[id]/settlement/[siteId]/benchmark-actions.ts`:
  - `saveBenchmarkAction(siteId, { id?, code, elevation, description })`: alta o edición; si cambia la cota, `recomputeSite`.
  - `benchmarkImpactAction(siteId, benchmarkId)` → `{ visits: number }`: visitas cuya libreta lo usa (arranque, cierre o de paso), para el aviso.
  - `deleteBenchmarkAction(siteId, benchmarkId)`: rechaza si alguna libreta lo usa («BM-1 se usa en 12 visitas: no se puede eliminar»).
  - `importBenchmarksAction(siteId, items: { code, elevation, description, source }[])`: inserta los nuevos; un código que ya existe se rechaza con su nombre (no se sobrescribe sin querer).
- Test: las reglas puras que estas acciones usan ya están probadas (Tareas 2-6). Aquí, `npm run typecheck` y la verificación en pantalla de la Tarea 17.

- [ ] **Step 1: Reescribir las acciones** según la lista. Cada acción que escribe varias tablas va por `save_visit` (la regla de las RPC); los BM del lugar son una tabla sola y van por `supabase.from("site_benchmarks")` con RLS.
- [ ] **Step 2: Mensajes en español de Colombia** y sin «cerrad»: `grep -rn "cerrad" "src/app/(app)/projects/[id]/settlement" "src/app/(app)/projects/[id]/sites"` → vacío.
- [ ] **Step 3:** `npm run typecheck`. Los componentes que llamaban a lo que se quitó (`visit-editor.tsx`, `close-visit-dialog.tsx`, `close-site-dialog.tsx`, `visit-view.tsx`, `site-form.tsx`, `points-catalog.tsx`) se rehacen en las Tareas 8-12: si el typecheck falla solo por ellos, se borran ya los que no sobreviven (`close-visit-dialog.tsx`, `close-site-dialog.tsx`) y en los demás se quita la llamada con un `// Tarea N` en su lugar, sin lógica nueva.
- [ ] **Step 4:** `npm test` → PASS.
- [ ] **Step 5: Commit**

```bash
git add "src/app/(app)/projects/[id]" src/components/settlement
git diff --cached --name-status
git commit -m "feat: acciones de asentamientos sin cierre, con la plantilla, los BM del lugar y el recálculo"
```

---

### Task 8: Alta del lugar en popup y «Editar datos» (decisión 1)

**Files:**
- Create: `src/components/settlement/site-dialog.tsx`: el popup del lienzo «Alta del lugar»: nombre; tipo de estructura en un selector segmentado (Edificio, Presa, Terraplén, Otro); descripción opcional; «Umbrales del semáforo» plegados con su resumen («25 · 50 · 75 mm y 2 · 5 · 10 mm/mes, de edificio») y los seis campos (`thresholds-fields.tsx`). Cambiar el tipo vuelve a precargar los umbrales (`thresholdsFor`). Crear lleva al panel del lugar; en «Editar datos», guardar se queda.
- Modify: el selector de procesos del hub (`src/components/projects/new-process-selector.tsx`): «Lugar de asentamientos» abre el popup.
- Delete: `src/app/(app)/projects/[id]/sites/new/` y `src/components/settlement/site-form.tsx` (su lógica de umbrales pasa al popup).
- Test: `src/components/settlement/site-dialog.test.ts` solo si la lectura del formulario se extrae a una función pura (`readSiteForm`): nombre obligatorio, umbrales positivos y crecientes —la regla que hoy valida `createSiteAction`—.

- [ ] **Step 1:** Escribir `readSiteForm` con su prueba (vacío, decreciente, válido) y verla fallar y pasar.
- [ ] **Step 2:** El popup con `Modal` del sistema de diseño, `callAction`, el error dentro del popup.
- [ ] **Step 3:** `npm run typecheck && npm test`.
- [ ] **Step 4: Commit** — `feat: alta del lugar en popup, con los umbrales plegados`.

---

### Task 9: El lugar — cabecera, pestañas y panel B (decisiones 2 y 3)

**Files:**
- Modify: `src/app/(app)/projects/[id]/settlement/[siteId]/page.tsx`: deja `ProcessShell`; usa una cabecera en tarjeta como `ProcessHeader` —si sus props de proceso no encajan (responsable, equipo), se crea `src/components/settlement/site-header.tsx` con el mismo aspecto—: insignia «Control de asentamientos · <tipo>», nombre, la línea «N puntos de control · N BM · base el <fecha> · Guardado …», y «Editar datos» (popup de la Tarea 8), «Exportar a Excel» y «+ Nueva visita» (popup de la Tarea 11). Las pestañas **Panel · Puntos · BMs · Informe** con `?tab=`.
- Modify: `panel-tab.tsx`: la franja de indicadores (asentamiento máximo, promedio, velocidad máxima, visitas en alerta, umbrales); a la izquierda la tabla de visitas (`visits-table.tsx`: visita, fecha, promedio, máximo, mayor Δ, alerta; sin estado ni cierre) y los avisos de tendencia; a la derecha, fija (`sticky`), la tendencia (`site-trend.tsx`) con «Promedio | Por punto» (el «Por punto» es el gráfico de dispersión de hoy, `charts/points-scatter`) y la visita elegida resaltada. En el teléfono, una columna.
- Modify: `place-tab.tsx` → la pestaña **Puntos**: solo el catálogo de puntos (sin el formulario del lugar, que es el popup); fuera `visitsOpen`, `closedVisits` y `closedLabel`.
- Modify: `src/components/settlement/points-catalog.tsx`: sin `disabled` ni `referenceLocked`; cambiar la C0 de un punto con lecturas y borrar un punto con lecturas piden confirmación con `pointImpactAction` («Cambia el acumulado de 7 visitas»).
- Modify: `analysis-panel.tsx` (semáforo por punto): sale del panel; su tabla vive en Resultados (Tarea 13). `site-kpis.tsx` pasa a la franja.

- [ ] **Step 1:** Si se extrae alguna función pura nueva (p. ej. los indicadores de la franja desde `computeHistory`), su prueba primero.
- [ ] **Step 2:** La página y las pestañas. Sin `ReopenDialog`, sin `processReportState(site.status)`, sin `getPointIdsWithClosedReadings`.
- [ ] **Step 3:** `npm run typecheck && npm test`.
- [ ] **Step 4: Commit** — `feat: el lugar con la tabla de visitas y la tendencia lado a lado`.

---

### Task 10: La pestaña BMs (decisiones 12 y 13)

**Files:**
- Create: `src/lib/import/benchmarks.ts` (puro): `benchmarksFromLeveling(adjusted: { pointCode: string; elevation: number }[], source: string)` y `parseBenchmarkCsv(text: string): { items: { code; elevation; description }[] } | { error: string }` (cabecera `codigo,cota,descripcion`, coma o punto y coma, coma o punto decimal; cota con 4 decimales; filas vacías se saltan; código repetido o cota no numérica es error con su línea).
- Test: `src/lib/import/benchmarks.test.ts`.
- Create: `src/components/settlement/benchmarks-tab.tsx`, `benchmark-dialog.tsx` (alta y edición: código, cota, descripción; al cambiar la cota de un BM en uso, el aviso con `benchmarkImpactAction` antes de guardar), `import-benchmarks-dialog.tsx` (el lienzo «Importar BM»: «De una nivelación del proyecto | De un CSV»; las nivelaciones **calculadas** del proyecto y, de la elegida, sus puntos con la cota ajustada —`adoptedElevationsOf` sobre `levelingRecordOf`— para marcar; el origen anota «Nivelación «<nombre>», <fecha>» o «CSV <archivo>»).
- Modify: `page.tsx` del lugar: la pestaña **BMs** con su tabla (código, cota, descripción, origen, «Amarre en N» / «—»), «+ BM», «Importar de una nivelación», «Importar CSV», editar y eliminar.

- [ ] **Step 1: Escribir la prueba**

```ts
// src/lib/import/benchmarks.test.ts
import { describe, expect, it } from "vitest";
import { benchmarksFromLeveling, parseBenchmarkCsv } from "./benchmarks";

describe("importar BM", () => {
  it("de una nivelación: código y cota ajustada, con su origen", () => {
    expect(benchmarksFromLeveling([{ pointCode: "C14", elevation: 2542.2271 }], "Nivelación «Tramo 2», 7 oct 2026")).toEqual([
      { code: "C14", elevation: 2542.2271, description: null, source: "Nivelación «Tramo 2», 7 oct 2026" },
    ]);
  });
  it("de un CSV con coma decimal y punto y coma", () => {
    expect(parseBenchmarkCsv("codigo;cota;descripcion\nBM-1;100,0000;Andén norte\n\nBM-2;100,845;\n")).toEqual({
      items: [
        { code: "BM-1", elevation: 100, description: "Andén norte" },
        { code: "BM-2", elevation: 100.845, description: null },
      ],
    });
  });
  it("una cota que no es número dice su línea", () => {
    expect(parseBenchmarkCsv("codigo,cota\nBM-1,abc")).toEqual({ error: "Línea 2: la cota de BM-1 no es un número." });
  });
  it("un código repetido dice su línea", () => {
    expect(parseBenchmarkCsv("codigo,cota\nBM-1,100\nbm-1,101")).toEqual({ error: "Línea 3: BM-1 está repetido." });
  });
});
```

- [ ] **Step 2:** Verla fallar (`npx vitest run src/lib/import/benchmarks.test.ts`), implementar, verla pasar.
- [ ] **Step 3:** Los componentes y la pestaña. `npm run typecheck && npm test`.
- [ ] **Step 4: Commit** — `feat: los BM del lugar, editables e importables de una nivelación o un CSV`.

---

### Task 11: La visita — alta en popup, cabecera y pasos (decisiones 4 a 6)

**Files:**
- Create: `src/components/settlement/visit-dialog.tsx`: el lienzo «Nueva visita»: fecha, nivelador, nota (opcional), el aviso «La libreta llega armada como la visita N» (o «Sin visita anterior: una armada desde <BM>», o «Agrega un BM en la pestaña BMs» si no hay ninguno) y el equipo plegado (marca, modelo, n.º de serie, «Tomar del catálogo»). Crear llama a `createVisitAction` y lleva al paso Libreta; «Editar datos» guarda con `saveVisitAction` y la libreta actual.
- Create: `src/components/settlement/visit-header.tsx`: insignias («N armadas», el orden o «Sin verificación», «En medición» o «Calculada»), «Visita N · <fecha larga>», la línea «<nivelador> · <equipo o Equipo sin registrar> · Guardado …», y ← → (visita anterior y siguiente), «Editar datos» y eliminar (con confirmación que nombra la visita; cualquier visita).
- Create: `visit-steps` con `ProcessSteps`: **1 · Libreta**, **2 · Resultados** (`?paso=libreta|resultados`), y «Importar .L o CSV» a la derecha.
- Modify: `src/app/(app)/projects/[id]/settlement/[siteId]/visits/[visitId]/page.tsx`: la cabecera, los pasos y el paso activo (Tareas 12 y 13). `visit-data.ts` carga además `site_benchmarks` y la libreta de la visita anterior.
- Delete: `src/app/(app)/projects/[id]/settlement/[siteId]/visits/[visitId]/editar/`, `src/components/settlement/new-visit-dialog.tsx`, `visit-view.tsx` (sus gráficos de puntos pasan a Resultados), `delete-visit-button.tsx` (lo absorbe la cabecera), `book-drawer.tsx`.

- [ ] **Step 1:** Si la lectura del popup se extrae (`readVisitForm`: fecha obligatoria y sin repetir otra visita del lugar, la regla de `neighborVisitDates`), su prueba primero.
- [ ] **Step 2:** Los componentes y la página. `npm run typecheck && npm test`.
- [ ] **Step 3: Commit** — `feat: la visita por pasos, con su alta en popup`.

---

### Task 12: Paso 1 · Libreta — armadas, guardado por lectura y avisos (decisiones 7 a 11)

**Files:**
- Create: `src/components/settlement/visit-libreta-tab.tsx`: a la izquierda, la tabla de la nivelación (`LibretaTable` con `sheetRows` sobre las filas de la visita y `computeBook(...).readings`; las insignias: «BM del lugar» en un arranque, «punto de cambio», «BM · ±x mm» en un BM leído de paso, «cierra» en el BM de cierre); a la derecha, fijos, la lista de armadas («Armada N · desde X» y su resumen; un botón «Editar» por armada; «+ Armada»), la verificación de cada tramo (cierre, orden, o «sin verificación») y el gráfico **Movimiento desde la visita anterior** por punto (barras en mm, la del punto con aviso de tendencia resaltada, con su texto «B10 bajó 50.0 mm en 12 días; a su ritmo anterior serían unos 17 mm»). Una visita en medición muestra arriba el aviso «La medición quedó a medias» con **Retomar medición**, que abre la armada con el primer punto pendiente (`bookPending`) y el cursor en él. Sin BM en el lugar: «Agrega un BM en la pestaña BMs para empezar».
- Create: `src/components/settlement/visit-armada-dialog.tsx`: el popup del lienzo. «Desde»: «Un BM del lugar» (con su selector) o «Un punto de cambio» (solo en una armada nueva y si `pendingChangePoint` da uno); al editar una armada, «Desde» es fijo. La V+ con distancia opcional e hilos plegados (como la nivelación: con hilos, la distancia sale de ellos). «Vistas a los puntos»: una fila por punto con su lectura, su cota en vivo y un ✓ cuando quedó guardada; «+ Otro punto» (código libre). «Vista adelante · V−»: la casilla «Sin vista adelante» y, sin ella, punto, lectura y distancia; si el punto es un BM del lugar, la insignia «cierra en un BM» y el cierre; si no, «punto de cambio». Abajo, AI, cotas y lo leído («10 de 16 · guardado»). Botones: «Seguir después» (cierra el popup sin tocar nada), «Terminar armada» (`finishVisitArmada` y guardar) y «Terminar y agregar armada» o «Terminar y seguir desde <punto de cambio>».
- **Guardado por lectura** (decisión 9): cada lectura confirmada (al salir del campo o con Enter) arma la libreta con `writeVisitArmada`/`appendVisitArmada` y la guarda con `useProcessDraft(...).save`. Los guardados van **en fila**: el siguiente espera al anterior (una promesa encadenada en el popup), para que una respuesta lenta nunca pise una lectura posterior. Un fallo deja el error en el popup con lo tecleado y reintenta en la siguiente lectura.
- **Avisos al guardar** (decisiones 10 y 11): si `saveVisitAction` devuelve `duplicate`, el popup del lienzo «TA-04 está en dos armadas» (las dos lecturas con su armada y su cota; «Eliminar la de la armada N» con `dropBookRow`, o «Volver a la libreta»). Al terminar una armada cuya V− cae en un auxiliar (`auxiliaryPoints`), el popup «¿Guardar CP-1 en los BM del lugar?» (código, cota medida hoy, descripción opcional; «Solo en esta visita» o «Guardar en los BM» con `saveBenchmarkAction`).
- **Importar .L o CSV**: el diálogo de la nivelación (`ImportDialog`) con `draftWithImport`, adaptado: el recorrido importado es una libreta de un tramo desde el BM de su primera fila (que debe estar en los BM del lugar; si no, el error lo dice). Se borra `visit-import-dialog.tsx` y la plantilla CSV de la visita pasa a la de la nivelación, si son la misma; si la de la visita lleva columnas propias, se conserva su `TemplateLink`.
- **Teléfono** (390 px): la lista de armadas en vez de la tabla (como `Movil-Libreta` de la nivelación); el popup a pantalla completa con la barra de guardado fija abajo (el lienzo «Móvil · la armada en campo, a medias»).
- Delete: `src/components/settlement/visit-editor.tsx`, `visit-book-editor.tsx`, `readings-table.tsx` (la de cotas tecleadas) y `src/components/leveling/readings-table.tsx` (ya sin usuarios).

- [ ] **Step 1:** Las reglas puras que falten para la pantalla (p. ej. las insignias de cada fila, el texto del aviso de tendencia, «10 de 16») se extraen a `visit-libreta-rows.ts` con su prueba primero.
- [ ] **Step 2:** Los componentes. `npm run typecheck && npm test`.
- [ ] **Step 3:** En pantalla, en local (dev en el puerto que use la sesión): crear una visita, capturar dos armadas con un punto de cambio, cortar la red a mitad (DevTools · Offline) y ver el error en el popup sin perder lo escrito; volver a la red, cerrar el navegador, volver y «Retomar medición».
- [ ] **Step 4: Commit** — `feat: la libreta de la visita por armadas, guardada lectura por lectura`.

---

### Task 13: Paso 2 · Resultados e informe del lugar (decisiones 19 a 21)

**Files:**
- Create: `src/components/settlement/visit-results-tab.tsx`: la franja (asentamiento máximo, promedio y su cambio frente a la anterior, mayor movimiento, alerta), la **nota de la visita** («Sin nota. Se escribe en «Editar datos».» si no hay), la tabla por punto (cota, parcial, acumulado, velocidad, estado y tendencia) y, fijo al lado, el gráfico con «Acumulado | Desde la anterior» (`PointBarsChart`) y los umbrales.
- Modify: `src/components/reports/sections/settlement-section.tsx` y `src/lib/reports/sections.ts` (`SiteSectionData`): el informe sencillo del lienzo: veredicto; **Cómo se calcula** con las cuatro fórmulas en MathML (`src/components/reports/math.tsx`): `AI = C_BM + V⁺`, `C_i = AI − L_i`, `S_i = (C_i − C_0)·1000`, `v = (S_i − S_{i−1}) / (días/30.4375)`, y la frase de los umbrales; la evolución (`SettlementPlot`); la tabla de visitas (fecha, promedio, máximo, mayor Δ, verificación, peor alerta); los puntos de la última visita; la nota de cada visita que la tenga; los avisos de tendencia. Sin el orden declarado, el tipo de nivel ni la σ.
- Modify: `src/lib/reports/eligibility.ts`: un lugar entra a un consolidado si tiene alguna visita `calculated`. `src/lib/reports/state.ts`, `process-report.tsx`, `closure-record.tsx`: el lugar no tiene marca de borrador ni registro de cierre. `queries.ts` (`getClosedWorkForReports`): los lugares sin filtro de estado ni orden por `closed_at`. `report-form.tsx`: sin la frase de lugares cerrados.
- Test: `src/lib/reports/eligibility.test.ts`, `state.test.ts` (los casos del lugar), y una prueba de `SiteSectionData` con la nota y la verificación.

- [ ] **Step 1:** Las pruebas de elegibilidad y de los datos de la sección, primero; verlas fallar.
- [ ] **Step 2:** Implementar; verlas pasar. Los componentes.
- [ ] **Step 3:** `npm run typecheck && npm test`.
- [ ] **Step 4: Commit** — `feat: resultados de la visita y el informe sencillo del lugar`.

---

### Task 14: Fuera el cierre del resto y el motor viejo

**Files:**
- Delete: `src/lib/reopen.ts` y su prueba; `src/components/process/reopen-dialog.tsx` (sin usuarios tras esta fase); `process-shell.tsx` si ya nadie lo usa.
- Modify: `src/components/projects/hub-rows.tsx` (`SITE_CHIPS` sin «cerrados», sin `closed`), `process-row-actions.tsx` (toda fila con sus acciones), `src/lib/process-list.ts`, `src/lib/process-counts.ts`, `src/lib/process-status.ts`, `src/types/site.ts` y `src/types/settlement.ts` (sin `closed`), con sus pruebas.
- Modify: `src/lib/supabase/queries.ts`: fuera `getClosedWorkCount` y su uso en `projects/[id]/actions.ts`, `projects/[id]/page.tsx` y `delete-project-dialog.tsx`; el KPI del dashboard (`queries.ts:119-138`) sin filtrar por el estado del lugar; corregir el JSDoc de `queries.ts:586-591`.
- Modify: `src/lib/export/settlement-workbook.ts` (sin «Cerrada/Abierta», «Cerrado por»; la libreta con su columna de tramo; la verificación por visita) y `export/route.ts` (sin el nombre de `closed_by`), con su prueba.
- Modify: `src/lib/errors/user-message.ts`: fuera el 23001 «Está cerrado…» (ya no lo lanza ningún trigger).
- Modify: `src/lib/calculations/settlement-book.ts`: borrar `computeVisitBook`, `deriveControlElevations`, `catalogElevationsOf`, `checkBenchmarks`, `benchmarkChecksOfBook` y `buildBookTemplate`; `src/lib/validators/settlement-book.ts`: borrar `validateVisitBook`; `src/lib/validators/settlement.ts`: borrar `validateVisitClose`, `undoRetirementBlocker`, `REFERENCE_LOCKED_MESSAGE` y la regla de alta contra visitas cerradas; con sus pruebas.

- [ ] **Step 1:** `grep -rn "closed\|cerrad\|reopen\|Reabrir" src --include=*.ts --include=*.tsx | grep -i "site\|visit\|settlement\|lugar\|visita"` → solo lo que sigue siendo legítimo (el `type: "closed"` de una nivelación o un tramo).
- [ ] **Step 2:** `npm run typecheck && npm run lint && npm test` → limpio y PASS.
- [ ] **Step 3: Commit** — `refactor: fuera el cierre de asentamientos y el motor viejo de la libreta`.

---

### Task 15: Demo, seed y scripts (decisión 23)

**Files:**
- Create: `src/lib/demo/cartera-asentamientos.ts`: la cartera como dato —los 16 puntos en el orden de la hoja (`A4(8-7A)` … `B10`, con «AA3»), las 7 fechas (la 7, **2022-06-05**), la V+ de cada visita y la lectura de cada punto—, con el comentario de su origen (la hoja, sus celdas y las decisiones del 2026-10-03).
- Create: `src/lib/demo/insertar-cartera.ts`: `insertarCartera(db, projectId)` crea el lugar «Control de asentamiento estructural» (edificio), sus puntos sin C0, el BM `PISCINA/BM` (156.2990) en `site_benchmarks` y las 7 visitas, cada una con su libreta de **una armada** (V+ al BM y una VI por punto, sin V−), guardadas con `visitRecordOf` y `recalculateSite`. Devuelve el id. Si el proyecto ya tiene un lugar con ese nombre, no hace nada.
- Test: `src/lib/demo/cartera-asentamientos.test.ts`: con `recalculateSite`, las cotas, «Comparación n» (acumulado) y «Comparación al anterior» (parcial) de los 16 puntos en las 7 visitas, contra las celdas de la hoja (`C27:BQ43`, en mm enteros), y los avisos de B10 en las visitas 3 y 4.
- Modify: `src/lib/demo/insertar-asentamiento.ts` y `fixtures.ts`: Torre Alameda con sus BM en `site_benchmarks` (BM-1, BM-2) en vez de los puntos de referencia del proyecto, la libreta con `starts_section` y guardada con `recalculateSite` (sin compensar); sin cerrar visitas ni lugar. `crear-proyecto-demo.ts`: llama además a `insertarCartera`, y el informe de la demo deja de llamarse «de cierre».
- Modify: `src/lib/demo/fixtures.test.ts`: lo de Torre Alameda que suponía compensación o cierre.
- Modify: `scripts/seed.mjs`: Torre Central y Edificio Norte con libreta generada hacia atrás desde sus cotas (`generateVisitBook`, como Torre Alameda) y sus BM en `site_benchmarks`; nada se cierra; la cartera como 4.º lugar de «Edificio en monitoreo» con `insertarCartera`. El seed no se ejecuta (exige `db reset` y la base local es compartida): su lógica es la de la demo, que tiene pruebas.
- Modify: `scripts/resincronizar-asentamientos.mjs`: por cada lugar `recomputeSite` (en simulación cuenta visitas y lecturas que cambian; con `--aplicar` escribe); sin la excepción de los cerrados; el comentario de cabecera dice para qué sirve ahora (el paso 2 del despliegue).
- Create: `scripts/agregar-cartera-demo.mjs`: por cada proyecto «Proyecto de ejemplo» sin el lugar de la cartera, `insertarCartera` (simulación por defecto; `--aplicar` escribe). Mismo uso que el script anterior (`npx tsx --env-file=.env.local …`).

- [ ] **Step 1:** La prueba de la cartera, primero; verla fallar.
- [ ] **Step 2:** `cartera-asentamientos.ts`, `insertar-cartera.ts`; verla pasar.
- [ ] **Step 3:** Torre Alameda, la demo, el seed y los dos scripts. `npm run typecheck && npm test`.
- [ ] **Step 4:** En local, contra la base local: `npx tsx --env-file=.env.local scripts/resincronizar-asentamientos.mjs` (simulación) cuenta las visitas que cambian al dejar de compensar; anotar la cifra para el PRD. Iniciar sesión con un usuario nuevo crea la demo con los dos lugares.
- [ ] **Step 5: Commit** — `feat: la cartera real de asentamientos en la demo y el seed, sin cierre ni compensación`.

---

### Task 16: Base — paso 2 (después del merge)

**Files:**
- Create: `supabase/migrations/20261009000000_asentamientos_sin_cierre.sql`
- Modify: `supabase/tests/asentamientos_sin_cierre.test.sql`: los casos del paso 2.
- Modify: `src/types/database.ts`: fuera las columnas borradas.

- [ ] **Step 1: La prueba** — `hasnt_column` de `settlement_visits.closed_at`, `closed_by`, `weather_conditions`, `capture_mode`, y de `sites.status`, `closed_at`, `closed_by`; `hasnt_function` de `reject_update_on_closed_process`, `reject_delete_on_closed_process` e `is_reopening`; el `CHECK` de `status` sin `closed` (`throws_ok` al ponerlo). Verla fallar.
- [ ] **Step 2: La migración**

```sql
-- Fase 37, paso 2 (después del merge): lo que el código viejo todavía nombraba.
update public.settlement_visits set status = 'calculated' where status = 'closed';
alter table public.settlement_visits
  drop column closed_at,
  drop column closed_by,
  drop column weather_conditions,
  drop column capture_mode,
  drop constraint settlement_visits_status_check,
  add constraint settlement_visits_status_check check (status in ('draft', 'in_progress', 'calculated'));
alter table public.sites
  drop column status,
  drop column closed_at,
  drop column closed_by;
drop function if exists public.reject_update_on_closed_process();
drop function if exists public.reject_delete_on_closed_process();
drop function if exists public.is_reopening(jsonb, jsonb);
```

`capture_mode` se borra solo si la consulta previa de producción (PRD, Despliegue) dio cero visitas con cotas tecleadas; si no, esa línea sale de la migración y se decide con el usuario. Si `sites.status` tiene un índice o una vista que lo nombra, se ajusta antes (`grep -rn "sites.status\|s.status" supabase/migrations`).

- [ ] **Step 3:** `npx supabase migration up --local`, `npx supabase test db` → PASS; tipos; `npm run typecheck && npm test`.
- [ ] **Step 4: Commit** — `feat: asentamientos sin columnas de cierre ni funciones de inmutabilidad`.

Este paso se **commitea en la rama** pero se empuja a producción **después** del merge y del despliegue (PRD, Despliegue).

---

### Task 17: Documentación, capturas y verificación en pantalla

**Files:**
- Modify: `docs/manual/README.md` y `src/app/(app)/manual/{page.tsx,manual-data.ts}` (las dos copias, en el mismo commit): el capítulo de asentamientos completo —el lugar y sus pestañas, los BM del lugar e importarlos, la nueva visita, la libreta por armadas desde un BM o un punto de cambio, la armada con y sin vista adelante, el guardado por lectura y «Retomar medición», los dos avisos al guardar, resultados, el informe— y cada mención de cerrar o reabrir un lugar o una visita.
- Modify: `docs/manual/capturas.mjs` y `public/manual/`: rehacer 13, 14, 15, 16, 25, 26, 27 y 28 con la cartera y Torre Alameda; nuevas para la pestaña BMs y el popup de la armada; borrar las que ya no correspondan. Sincronizar `width`/`height` en `manual-data.ts`. Commitear solo las que cambian por la fase.
- Modify: `docs/tecnica/README.md`: estado de fases, el modelo de datos (`site_benchmarks`, `starts_section`, `in_progress`, columnas borradas), el motor de la visita (tramos, sin compensar, margen fijo), la tabla de pruebas, la § 11 entrada por entrada contra el código, y la § 13 con el despliegue en tres pasos.
- Modify: `docs/prds/36-ux-asentamientos.md` (divergencias), `docs/prds/README.md` y `docs/method.md` (estado, «Cierre Fase 37» con aprendizajes), `CLAUDE.md` (las reglas del cierre: ya ningún proceso se cierra; «Van 37»; las rutas de asentamientos), `docs/pendientes.md`.

- [ ] **Step 1:** La documentación.
- [ ] **Step 2:** `node docs/manual/capturas.mjs` y comparar contra HEAD.
- [ ] **Step 3: Verificación en pantalla**, en local, a 1280 px y a 390 px: los criterios a–p del PRD, recorriendo **cada caso de la armada** (sin V−, a un auxiliar, a un BM), el corte de red a mitad, «Retomar medición», el punto repetido, el auxiliar, cambiar la cota de un BM con visitas, cambiar una C0 con historia, borrar una visita del medio, importar BM de una nivelación y de un CSV, y la cartera visita por visita contra la hoja.
- [ ] **Step 4:** `npm run typecheck && npm run lint && npm test && npx supabase test db && npm run build`.
- [ ] **Step 5: Las consultas de producción** del Despliegue del PRD, escritas y listas para ejecutar en solo lectura antes del paso 1: visitas con `capture_mode = 'direct'`; visitas y puntos cuya cota cambia al dejar de compensar (la simulación de `scripts/resincronizar-asentamientos.mjs` contra producción, que no escribe); proyectos «Proyecto de ejemplo» sin el lugar de la cartera (la simulación de `scripts/agregar-cartera-demo.mjs`). Se ejecutan con el visto bueno del usuario.
- [ ] **Step 6: Commit** — `docs: cerrar fase 37 — Los asentamientos como los mide el topógrafo`.
