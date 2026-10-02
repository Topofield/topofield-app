-- ============================================================================
-- Fase 30 — Estabilidad de los BMs
-- ============================================================================
-- Ver docs/prds/29-estabilidad-bms.md.
--
-- Cuando la libreta de una visita pasa por otro BM del catálogo, la app compara
-- la cota que la libreta le da con la del catálogo y avisa si no nivelan: un BM
-- movido hace que todos los puntos «se asienten» a la vez (marco teórico
-- § 2.3). Esa cota de catálogo se COPIA en la fila de la libreta al guardar,
-- como la visita copia la del amarre (`reference_bm_elevation`): corregir
-- después el catálogo no cambia la comprobación de una visita cerrada, cuyas
-- filas ya son inmutables (trigger de la Fase 18).
--
-- `save_visit` se recrea para escribir la columna; el resto del cuerpo es el de
-- `20260930010000_guardados_atomicos.sql`. `create or replace` conserva sus
-- permisos (`EXECUTE` solo para `authenticated`).
--
-- La migración solo añade: va antes del merge, en el orden normal. El código
-- viejo no nombra la columna y `jsonb_populate_recordset` la deja en null.
-- ============================================================================

alter table public.settlement_book_readings
  add column catalog_elevation decimal(10,4);

comment on column public.settlement_book_readings.catalog_elevation is
  'Cota de catálogo del BM de control de esta fila al guardar la visita (Fase 30). Null si la fila no es otro BM del catálogo.';

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
    weather_conditions         = h.weather_conditions,
    capture_mode               = h.capture_mode,
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
    catalog_elevation
  )
  select p_visit_id, b.reading_order, b.point_code, b.point_type, b.point_id,
         b.backsight, b.foresight,
         b.back_upper_m, b.back_lower_m, b.fore_upper_m, b.fore_lower_m,
         b.back_distance_m, b.fore_distance_m, b.distance_accumulated_km,
         b.instrument_height, b.elevation_calculated, b.elevation_corrected, b.correction_applied,
         b.catalog_elevation
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
    catalog_elevation       = excluded.catalog_elevation;

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

