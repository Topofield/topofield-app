-- ============================================================================
-- Correcciones de la Fase 35 — el amarre se guarda en una sola transacción
-- ============================================================================
-- El popup del amarre corrige las coordenadas de un punto del catálogo
-- (`reference_points`), pero lo hacía con una llamada por punto ANTES de
-- guardar el proceso: si el guardado fallaba, el catálogo quedaba corregido y
-- el proceso con el amarre de antes. Ahora los puntos viajan con el guardado.
--
-- `save_polygonal_process` gana `p_catalog`: las filas del catálogo que la
-- Server Action decidió escribir —`insert` con el id que ella genera, o
-- `update` por id—. La función solo escribe, con columnas explícitas: qué punto
-- se crea, se corrige o se reutiliza lo decide `planCatalogWrites`, en
-- TypeScript.
--
-- `p_catalog` tiene valor por defecto: el código que sigue en producción entre
-- el `db push` y el merge llama con tres argumentos y no cambia. Por eso se
-- borra la firma vieja en vez de dejar dos que casarían con la misma llamada.
-- Se puede volver a aplicar: `if exists` y `create or replace`.
-- ============================================================================

drop function if exists public.save_polygonal_process(uuid, jsonb, jsonb);

create or replace function public.save_polygonal_process(
  p_process_id uuid,
  p_header     jsonb,
  p_stations   jsonb,
  p_catalog    jsonb default '[]'::jsonb
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  h          public.polygonal_processes;
  project    uuid;
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
  -- Antes de mezclar la cabecera: el catálogo es el del proyecto del proceso.
  project := h.project_id;
  h := jsonb_populate_record(h, p_header);

  -- Los puntos del amarre, antes de la cabecera que apunta a ellos.
  for e in select * from jsonb_array_elements(coalesce(p_catalog, '[]'::jsonb)) loop
    if e ->> 'kind' = 'insert' then
      insert into public.reference_points (id, project_id, code, type, north, east)
      values (
        (e ->> 'id')::uuid, project, e ->> 'code', 'control',
        (e ->> 'north')::numeric, (e ->> 'east')::numeric
      );
    elsif e ->> 'kind' = 'update' then
      update public.reference_points set
        north = (e ->> 'north')::numeric,
        east  = (e ->> 'east')::numeric
      where id = (e ->> 'id')::uuid
        and project_id = project;
      if not found then
        raise exception 'Punto % no encontrado en el catálogo del proyecto.', e ->> 'id'
          using errcode = 'P0002';
      end if;
    else
      raise exception 'Escritura del catálogo no válida: %.', coalesce(e ->> 'kind', 'sin tipo')
        using errcode = '22023';
    end if;
  end loop;

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

-- Al borrarse, la función perdió sus permisos: los mismos de la Fase 23.
revoke execute on function public.save_polygonal_process(uuid, jsonb, jsonb, jsonb) from public, anon;
grant execute on function public.save_polygonal_process(uuid, jsonb, jsonb, jsonb) to authenticated;

-- Que PostgREST vea ya la firma nueva, sin esperar a su recarga automática.
notify pgrst, 'reload schema';
