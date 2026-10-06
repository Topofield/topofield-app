-- ============================================================================
-- Fase 35 — La poligonal como la mide el topógrafo (paso 1, ANTES del merge)
-- ============================================================================
-- Ver docs/prds/34-ux-poligonal.md, § A.
--
--   · El alta pide ubicación, responsable y su cargo: tres columnas nuevas.
--   · El orden de precisión se detecta al calcular y puede no alcanzarse
--     ninguno, o no haber verificación (abierta sin control): deja de ser
--     NOT NULL. Conserva su CHECK.
--   · `save_polygonal_process` escribe además `has_closing_row`, que el
--     guardado perdía desde la Fase 7 (hallazgo 4), y las columnas nuevas.
--     `angle_type` y `precision_order` ya estaban en la lista: ahora llevan lo
--     detectado.
--   · La poligonal deja de cerrarse (decisiones 17 y 18): se retiran sus
--     triggers de inmutabilidad y las cerradas o rechazadas vuelven a
--     `calculated`. Nivelación, lugares y visitas conservan los suyos, y con
--     ellos `reject_update_on_closed_process()`, `reject_delete_on_closed_process()`
--     e `is_reopening()`.
--
-- El paso 2 —borrar `closed_at` y `closed_by` y sacar los estados viejos del
-- CHECK— va DESPUÉS del merge: el código viejo cierra escribiéndolos.
-- ============================================================================

alter table public.polygonal_processes
  add column location         text,
  add column responsible_name text,
  add column responsible_role text,
  alter column precision_order drop not null;

comment on column public.polygonal_processes.precision_order is
  'Orden alcanzado, detectado al calcular (Fase 35). Null sin verificación de cierre o sin alcanzar el ordinario.';

-- --- Sin cierre -----------------------------------------------------------------
drop trigger polygonal_processes_reject_update_when_closed on public.polygonal_processes;
drop trigger polygonal_processes_reject_delete_when_closed on public.polygonal_processes;
drop trigger polygonal_stations_reject_write_when_closed on public.polygonal_stations;
drop trigger polygonal_angle_readings_reject_write_when_closed on public.polygonal_angle_readings;
drop function public.reject_update_on_closed_polygonal_process();
drop function public.reject_write_on_closed_process_station();
drop function public.reject_write_on_closed_polygonal_reading();

update public.polygonal_processes
   set status = 'calculated'
 where status in ('closed', 'rejected');

-- --- El guardado ------------------------------------------------------------------
-- La misma función de 20260930010000_guardados_atomicos.sql, con las columnas
-- nuevas en la lista del UPDATE. Sigue siendo SECURITY INVOKER y sin EXECUTE
-- para anon: `create or replace` conserva los permisos.
create or replace function public.save_polygonal_process(
  p_process_id uuid,
  p_header     jsonb,
  p_stations   jsonb
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  h          public.polygonal_processes;
  e          jsonb;
  s          public.polygonal_stations;
  new_id     uuid;
begin
  select * into h
    from public.polygonal_processes
   where id = p_process_id
     for update;
  if not found then
    raise exception 'Proceso % no encontrado.', p_process_id using errcode = 'P0002';
  end if;
  h := jsonb_populate_record(h, p_header);

  update public.polygonal_processes set
    name                       = h.name,
    type                       = h.type,
    angle_type                 = h.angle_type,
    reference_point_id         = h.reference_point_id,
    reference_point_code       = h.reference_point_code,
    angle_readings_min         = h.angle_readings_min,
    start_point_code           = h.start_point_code,
    start_north                = h.start_north,
    start_east                 = h.start_east,
    start_azimuth_deg          = h.start_azimuth_deg,
    start_azimuth_min          = h.start_azimuth_min,
    start_azimuth_sec          = h.start_azimuth_sec,
    end_point_code             = h.end_point_code,
    end_north                  = h.end_north,
    end_east                   = h.end_east,
    end_azimuth_deg            = h.end_azimuth_deg,
    end_azimuth_min            = h.end_azimuth_min,
    end_azimuth_sec            = h.end_azimuth_sec,
    correction_method          = h.correction_method,
    ls_sigma_angle_seconds     = h.ls_sigma_angle_seconds,
    ls_sigma_distance_m        = h.ls_sigma_distance_m,
    ls_distance_measurements   = h.ls_distance_measurements,
    precision_order            = h.precision_order,
    equipment_brand            = h.equipment_brand,
    equipment_model            = h.equipment_model,
    equipment_serial           = h.equipment_serial,
    equipment_calibration_date = h.equipment_calibration_date,
    angular_precision_seconds  = h.angular_precision_seconds,
    distance_precision_mm      = h.distance_precision_mm,
    distance_precision_ppm     = h.distance_precision_ppm,
    angular_error_seconds      = h.angular_error_seconds,
    linear_error               = h.linear_error,
    perimeter                  = h.perimeter,
    relative_precision         = h.relative_precision,
    meets_tolerance            = h.meets_tolerance,
    notes                      = h.notes,
    status                     = h.status,
    -- Fase 35: lo que el guardado antes perdía o no existía.
    has_closing_row            = h.has_closing_row,
    location                   = h.location,
    responsible_name           = h.responsible_name,
    responsible_role           = h.responsible_role
  where id = p_process_id;

  -- Las lecturas de ángulo caen con sus estaciones (ON DELETE CASCADE).
  delete from public.polygonal_stations where process_id = p_process_id;

  for e in select * from jsonb_array_elements(coalesce(p_stations, '[]'::jsonb)) loop
    s := jsonb_populate_record(null::public.polygonal_stations, e);

    insert into public.polygonal_stations (
      process_id, station_order, point_code,
      angle_deg, angle_min, angle_sec, deflection_direction, horizontal_distance,
      corrected_angle_deg, corrected_angle_min, corrected_angle_sec,
      azimuth_deg, azimuth_min, azimuth_sec,
      delta_north, delta_east, corrected_delta_north, corrected_delta_east,
      north, east
    ) values (
      p_process_id, s.station_order, s.point_code,
      s.angle_deg, s.angle_min, s.angle_sec, s.deflection_direction, s.horizontal_distance,
      s.corrected_angle_deg, s.corrected_angle_min, s.corrected_angle_sec,
      s.azimuth_deg, s.azimuth_min, s.azimuth_sec,
      s.delta_north, s.delta_east, s.corrected_delta_north, s.corrected_delta_east,
      s.north, s.east
    )
    returning id into new_id;

    insert into public.polygonal_angle_readings (
      station_id, reading_order, angle_deg, angle_min, angle_sec
    )
    select new_id, r.reading_order, r.angle_deg, r.angle_min, r.angle_sec
      from jsonb_populate_recordset(
             null::public.polygonal_angle_readings,
             coalesce(e -> 'readings', '[]'::jsonb)
           ) r;
  end loop;
end;
$$;
