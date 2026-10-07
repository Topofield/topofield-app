-- ============================================================================
-- Fase 37 — Los asentamientos como los mide el topógrafo (paso 1)
-- ============================================================================
-- Ver docs/prds/36-ux-asentamientos.md.
--
-- Va ANTES del merge. El código viejo funciona con ella: sin triggers, su
-- cierre solo cambia el estado; no lee `site_benchmarks` ni `starts_section`, y
-- `save_visit` ignora el clima y el modo de captura que todavía manda.
--
-- 1. Fuera los triggers del cierre de visitas, lugares, lecturas, libreta y
--    puntos, y sus funciones propias. `reject_update_on_closed_process`,
--    `reject_delete_on_closed_process` e `is_reopening` se borran en el paso 2.
-- 2. Lo cerrado vuelve a abrirse: ningún módulo se cierra (decisión 22). Va
--    después de quitar los triggers, que lo rechazaban.
-- 3. La visita «En medición» (`in_progress`) y sin orden declarado: se detecta.
-- 4. `starts_section`: la fila abre un tramo desde un BM del lugar (decisión 8).
-- 5. `site_benchmarks`: los BM del lugar, copias que no se sincronizan
--    (decisión 12), llenados con los que ya usa cada lugar.
-- 6. `save_visit` escribe `starts_section` y deja de escribir el clima y el
--    modo de captura. `create or replace` conserva sus permisos.
-- ============================================================================

-- 1. Fuera los triggers del cierre y sus funciones propias.
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

-- 2. Lo cerrado vuelve a abrirse, ya sin los triggers que lo impedían.
update public.settlement_visits set status = 'calculated' where status = 'closed';
update public.sites set status = 'active' where status = 'closed';

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
-- que son amarre de alguna visita o se leen de paso, con su cota de hoy; y los
-- amarres tecleados que no están en el catálogo, con la cota de su visita más
-- reciente.
insert into public.site_benchmarks (site_id, code, elevation, description, source)
select distinct on (v.site_id, rp.code)
       v.site_id, rp.code, rp.elevation, rp.description, 'Catálogo del proyecto'
  from public.settlement_visits v
  join public.sites s on s.id = v.site_id
  join public.reference_points rp
    on rp.project_id = s.project_id and rp.type = 'bm' and rp.elevation is not null
 where upper(regexp_replace(rp.code, '\s', '', 'g'))
         = upper(regexp_replace(coalesce(v.reference_bm_code, ''), '\s', '', 'g'))
    or exists (
         select 1 from public.settlement_book_readings b
          where b.visit_id = v.id and b.catalog_elevation is not null
            and upper(regexp_replace(b.point_code, '\s', '', 'g'))
                  = upper(regexp_replace(rp.code, '\s', '', 'g')))
on conflict (site_id, code) do nothing;

insert into public.site_benchmarks (site_id, code, elevation, source)
select distinct on (v.site_id, upper(regexp_replace(v.reference_bm_code, '\s', '', 'g')))
       v.site_id, trim(v.reference_bm_code), v.reference_bm_elevation,
       'Amarre de la visita ' || v.visit_number
  from public.settlement_visits v
 where v.reference_bm_code is not null and v.reference_bm_elevation is not null
 order by v.site_id, upper(regexp_replace(v.reference_bm_code, '\s', '', 'g')), v.date desc
on conflict (site_id, code) do nothing;

-- 6. save_visit: el inicio de cada tramo, sin el clima ni el modo de captura.
create or replace function public.save_visit(
  p_visit_id uuid,
  p_header   jsonb,
  p_book     jsonb,
  p_readings jsonb,
  p_rewrites jsonb
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  h          public.settlement_visits;
  book_count int := jsonb_array_length(coalesce(p_book, '[]'::jsonb));
begin
  select * into h
    from public.settlement_visits
   where id = p_visit_id
     for update;
  if not found then
    raise exception 'Visita % no encontrada.', p_visit_id using errcode = 'P0002';
  end if;

  -- La propagación solo toca visitas del mismo lugar, y nunca la que se guarda.
  -- Antes de rellenar la cabecera: `site_id` es el de la fila, no el de la carga.
  if exists (
    select 1
      from jsonb_populate_recordset(null::public.settlement_readings, coalesce(p_rewrites, '[]'::jsonb)) w
     where w.visit_id = p_visit_id
        or not exists (
             select 1 from public.settlement_visits v
              where v.id = w.visit_id and v.site_id = h.site_id
           )
  ) then
    raise exception 'La propagación incluye visitas ajenas a este lugar.' using errcode = '22023';
  end if;

  h := jsonb_populate_record(h, p_header);

  -- 1. Purga.
  delete from public.settlement_readings sr
   where sr.visit_id = p_visit_id
     and not exists (
           select 1
             from jsonb_populate_recordset(null::public.settlement_readings, coalesce(p_readings, '[]'::jsonb)) r
            where r.point_id = sr.point_id
         );

  -- 2. Cabecera.
  update public.settlement_visits set
    date                       = h.date,
    operator                   = h.operator,
    reference_bm_code          = h.reference_bm_code,
    reference_bm_elevation     = h.reference_bm_elevation,
    closure_error_mm           = h.closure_error_mm,
    tolerance_mm               = h.tolerance_mm,
    meets_tolerance            = h.meets_tolerance,
    total_distance_km          = h.total_distance_km,
    notes                      = h.notes,
    precision_order            = h.precision_order,
    equipment_brand            = h.equipment_brand,
    equipment_model            = h.equipment_model,
    equipment_serial           = h.equipment_serial,
    equipment_calibration_date = h.equipment_calibration_date,
    level_type                 = h.level_type,
    km_precision_mm            = h.km_precision_mm,
    status                     = h.status
  where id = p_visit_id;

  -- 3. Libreta.
  insert into public.settlement_book_readings (
    visit_id, reading_order, point_code, point_type, point_id,
    backsight, foresight,
    back_upper_m, back_lower_m, fore_upper_m, fore_lower_m,
    back_distance_m, fore_distance_m, distance_accumulated_km,
    instrument_height, elevation_calculated, elevation_corrected, correction_applied,
    catalog_elevation, starts_section
  )
  select p_visit_id, b.reading_order, b.point_code, b.point_type, b.point_id,
         b.backsight, b.foresight,
         b.back_upper_m, b.back_lower_m, b.fore_upper_m, b.fore_lower_m,
         b.back_distance_m, b.fore_distance_m, b.distance_accumulated_km,
         b.instrument_height, b.elevation_calculated, b.elevation_corrected, b.correction_applied,
         b.catalog_elevation, coalesce(b.starts_section, false)
    from jsonb_populate_recordset(
           null::public.settlement_book_readings,
           coalesce(p_book, '[]'::jsonb)
         ) b
  on conflict (visit_id, reading_order) do update set
    point_code              = excluded.point_code,
    point_type              = excluded.point_type,
    point_id                = excluded.point_id,
    backsight               = excluded.backsight,
    foresight               = excluded.foresight,
    back_upper_m            = excluded.back_upper_m,
    back_lower_m            = excluded.back_lower_m,
    fore_upper_m            = excluded.fore_upper_m,
    fore_lower_m            = excluded.fore_lower_m,
    back_distance_m         = excluded.back_distance_m,
    fore_distance_m         = excluded.fore_distance_m,
    distance_accumulated_km = excluded.distance_accumulated_km,
    instrument_height       = excluded.instrument_height,
    elevation_calculated    = excluded.elevation_calculated,
    elevation_corrected     = excluded.elevation_corrected,
    correction_applied      = excluded.correction_applied,
    catalog_elevation       = excluded.catalog_elevation,
    starts_section          = excluded.starts_section;

  delete from public.settlement_book_readings
   where visit_id = p_visit_id
     and reading_order > book_count;

  -- 4. Lecturas de la visita.
  insert into public.settlement_readings (
    visit_id, point_id, elevation,
    partial_settlement, accumulated_settlement, velocity, alert_status
  )
  select p_visit_id, r.point_id, r.elevation,
         r.partial_settlement, r.accumulated_settlement, r.velocity, r.alert_status
    from jsonb_populate_recordset(
           null::public.settlement_readings,
           coalesce(p_readings, '[]'::jsonb)
         ) r
  on conflict (visit_id, point_id) do update set
    elevation              = excluded.elevation,
    partial_settlement     = excluded.partial_settlement,
    accumulated_settlement = excluded.accumulated_settlement,
    velocity               = excluded.velocity,
    alert_status           = excluded.alert_status;

  -- 5. Propagación.
  insert into public.settlement_readings (
    visit_id, point_id, elevation,
    partial_settlement, accumulated_settlement, velocity, alert_status
  )
  select w.visit_id, w.point_id, w.elevation,
         w.partial_settlement, w.accumulated_settlement, w.velocity, w.alert_status
    from jsonb_populate_recordset(
           null::public.settlement_readings,
           coalesce(p_rewrites, '[]'::jsonb)
         ) w
  on conflict (visit_id, point_id) do update set
    elevation              = excluded.elevation,
    partial_settlement     = excluded.partial_settlement,
    accumulated_settlement = excluded.accumulated_settlement,
    velocity               = excluded.velocity,
    alert_status           = excluded.alert_status;
end;
$$;
