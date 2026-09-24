-- ============================================================================
-- Fase 18 — Libreta de nivelación de la visita
-- ============================================================================
-- Ver docs/prds/17-libreta-panel-asentamientos.md.
--
-- Hasta ahora una visita guardaba una cota TECLEADA por punto de control y un
-- `closure_error_mm` escrito a mano que nada leía. Desde esta fase la visita
-- puede llevar su libreta de nivelación —el circuito cerrado sobre un BM de
-- amarre— y las cotas de los puntos de control se DERIVAN de ella en el
-- servidor. `settlement_readings.elevation` sigue siendo la cota canónica en
-- los dos modos.
--
-- Migración aditiva: las visitas existentes quedan en modo 'direct' por el
-- DEFAULT y funcionan como antes. La app crea las nuevas con 'book' explícito.
-- ============================================================================

-- --- settlement_visits --------------------------------------------------------

alter table public.settlement_visits
  add column capture_mode text not null default 'direct'
    check (capture_mode in ('book', 'direct')),
  -- Copia del BM de amarre, como `start_bm_*` en nivelación: si alguien
  -- corrige después el catálogo `reference_points`, la visita conserva la cota
  -- con la que se calculó. Sin CHECK de obligatoriedad: la visita puede nacer
  -- sin amarre para que lo traiga el archivo importado; lo exige la app al
  -- guardar una libreta con lecturas.
  add column reference_bm_code      text,
  add column reference_bm_elevation decimal(10,4),
  -- Derivados de la libreta en 'book'; null en 'direct'. `closure_error_mm`
  -- (existente) es derivado en 'book' y sigue tecleado en 'direct'.
  add column total_distance_km      decimal(8,3),
  add column tolerance_mm           decimal(8,1),
  add column meets_tolerance        boolean;

-- --- settlement_book_readings -------------------------------------------------
-- Espejo de `leveling_readings` sin `run_type` (la visita no lleva ida y
-- vuelta) y con `point_id`, el punto de control al que corresponde la fila,
-- resuelto por código al guardar. Lo usa el renombrado de puntos para no
-- perder la fila de vista cuando cambia el código.

create table public.settlement_book_readings (
  id                      uuid primary key default gen_random_uuid(),
  visit_id                uuid not null references public.settlement_visits(id) on delete cascade,
  reading_order           int  not null,
  point_code              text not null,
  point_type              text not null check (point_type in ('bm', 'pc', 'intermediate')),
  point_id                uuid references public.settlement_points(id) on delete set null,
  backsight               decimal(6,4),
  foresight               decimal(6,4),
  back_upper_m            decimal(6,4),
  back_lower_m            decimal(6,4),
  fore_upper_m            decimal(6,4),
  fore_lower_m            decimal(6,4),
  back_distance_m         decimal(8,3),
  fore_distance_m         decimal(8,3),
  -- Calculados: la vista, el Excel y el registro de nivelación leen sin
  -- recalcular.
  distance_accumulated_km decimal(8,3),
  instrument_height       decimal(10,4),
  elevation_calculated    decimal(10,4),
  elevation_corrected     decimal(10,4),
  correction_applied      decimal(8,4),
  created_at              timestamptz not null default now(),
  -- El guardado hace upsert por esta clave y purga las filas sobrantes: nunca
  -- borra y reinserta (PRD de la fase 18, decisión 19).
  unique (visit_id, reading_order)
);

create index settlement_book_readings_point_id_idx
  on public.settlement_book_readings(point_id);

-- --- RLS: join de tres niveles (fila -> visita -> lugar -> proyecto) ----------

alter table public.settlement_book_readings enable row level security;

create policy "settlement_book_readings_select_via_project" on public.settlement_book_readings
  for select using (
    exists (select 1 from public.settlement_visits
            join public.sites on sites.id = settlement_visits.site_id
            join public.projects on projects.id = sites.project_id
            where settlement_visits.id = settlement_book_readings.visit_id
              and projects.user_id = auth.uid())
  );
create policy "settlement_book_readings_insert_via_project" on public.settlement_book_readings
  for insert with check (
    exists (select 1 from public.settlement_visits
            join public.sites on sites.id = settlement_visits.site_id
            join public.projects on projects.id = sites.project_id
            where settlement_visits.id = settlement_book_readings.visit_id
              and projects.user_id = auth.uid())
  );
create policy "settlement_book_readings_update_via_project" on public.settlement_book_readings
  for update using (
    exists (select 1 from public.settlement_visits
            join public.sites on sites.id = settlement_visits.site_id
            join public.projects on projects.id = sites.project_id
            where settlement_visits.id = settlement_book_readings.visit_id
              and projects.user_id = auth.uid())
  );
create policy "settlement_book_readings_delete_via_project" on public.settlement_book_readings
  for delete using (
    exists (select 1 from public.settlement_visits
            join public.sites on sites.id = settlement_visits.site_id
            join public.projects on projects.id = sites.project_id
            where settlement_visits.id = settlement_book_readings.visit_id
              and projects.user_id = auth.uid())
  );

-- --- Inmutabilidad ------------------------------------------------------------
-- Las dos funciones de las lecturas solo leen `visit_id` de la fila, no el
-- nombre de la tabla, así que sirven tal cual para la libreta (PRD, hallazgo
-- 3). La libreta es el dato de campo de la visita: una visita cerrada, o de un
-- lugar cerrado, no la deja reescribir tampoco por la API REST.

create trigger settlement_book_readings_reject_write_when_closed
  before insert or update or delete on public.settlement_book_readings
  for each row execute function public.reject_write_on_closed_visit_reading();

create trigger settlement_book_readings_reject_write_when_site_closed
  before insert or update or delete on public.settlement_book_readings
  for each row execute function public.reject_write_on_closed_site_reading();
