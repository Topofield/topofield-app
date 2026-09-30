-- ============================================================================
-- Fase 23 — Guardados en una transacción
-- ============================================================================
-- Ver docs/prds/22-integridad.md, sección A.
--
-- Los cuatro guardados de varias tablas hacían una llamada a la base por
-- paso: cabecera, borrado, inserción, lecturas… Si fallaba uno a mitad, lo
-- anterior ya estaba escrito y el proceso quedaba a medias —una cabecera
-- nueva sin estaciones, una visita con la fecha movida y la libreta vieja—.
-- Cada función hace todos los pasos en una sola transacción: o entran todos o
-- no entra ninguno.
--
-- Decisiones (PRD, 1 a 3):
--   - La función solo ESCRIBE. El cálculo sigue en TypeScript: la Server
--     Action valida, calcula con el motor y arma la carga.
--   - SECURITY INVOKER: corre como el usuario, con su RLS y los triggers de
--     inmutabilidad y de vigencia de siempre, sin repetirlos aquí.
--   - Columnas explícitas, nada de SQL dinámico: una clave de más en la carga
--     no escribe nada. La cabecera se rellena sobre la fila actual
--     (`jsonb_populate_record(fila, carga)`), así que una clave ausente
--     conserva su valor, igual que el `update` de supabase-js.
--
-- Los id de las estaciones nuevas los genera la base dentro del bucle, y sus
-- lecturas de ángulo viajan anidadas en la estación: no pueden colgar de otra.
--
-- Solo `authenticated` puede ejecutarlas: Supabase da EXECUTE a `anon` por
-- defecto en las funciones nuevas de `public`.
-- ============================================================================


-- ---------------------------------------------------------------------------
-- Poligonal: cabecera, y reemplazo de estaciones con sus lecturas de ángulo
-- ---------------------------------------------------------------------------
-- p_stations: [{ station_order, point_code, angle_deg, …, readings: [{
--   reading_order, angle_deg, angle_min, angle_sec }] }]
create function public.save_polygonal_process(
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
    status                     = h.status
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


-- ---------------------------------------------------------------------------
-- Nivelación: cabecera, y reemplazo de las lecturas de ida y vuelta
-- ---------------------------------------------------------------------------
create function public.save_leveling_process(
  p_process_id uuid,
  p_header     jsonb,
  p_readings   jsonb
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  h public.leveling_processes;
begin
  select * into h
    from public.leveling_processes
   where id = p_process_id
     for update;
  if not found then
    raise exception 'Proceso % no encontrado.', p_process_id using errcode = 'P0002';
  end if;
  h := jsonb_populate_record(h, p_header);

  update public.leveling_processes set
    name                       = h.name,
    type                       = h.type,
    start_bm_code              = h.start_bm_code,
    start_bm_elevation         = h.start_bm_elevation,
    end_bm_code                = h.end_bm_code,
    end_bm_elevation           = h.end_bm_elevation,
    has_return_run             = h.has_return_run,
    total_distance_km          = h.total_distance_km,
    distances_reconstructed    = h.distances_reconstructed,
    precision_order            = h.precision_order,
    equipment_brand            = h.equipment_brand,
    equipment_model            = h.equipment_model,
    equipment_serial           = h.equipment_serial,
    equipment_calibration_date = h.equipment_calibration_date,
    level_type                 = h.level_type,
    km_precision_mm            = h.km_precision_mm,
    closure_error_mm           = h.closure_error_mm,
    tolerance_mm               = h.tolerance_mm,
    meets_tolerance            = h.meets_tolerance,
    forward_error_mm           = h.forward_error_mm,
    return_error_mm            = h.return_error_mm,
    discrepancy_mm             = h.discrepancy_mm,
    discrepancy_tolerance_mm   = h.discrepancy_tolerance_mm,
    meets_discrepancy          = h.meets_discrepancy,
    notes                      = h.notes,
    status                     = h.status
  where id = p_process_id;

  delete from public.leveling_readings where process_id = p_process_id;

  insert into public.leveling_readings (
    process_id, run_type, reading_order, point_code, point_type,
    backsight, foresight,
    back_upper_m, back_lower_m, fore_upper_m, fore_lower_m,
    back_distance_m, fore_distance_m, distance_accumulated_km,
    instrument_height, elevation_calculated, elevation_corrected, correction_applied
  )
  select p_process_id, r.run_type, r.reading_order, r.point_code, r.point_type,
         r.backsight, r.foresight,
         r.back_upper_m, r.back_lower_m, r.fore_upper_m, r.fore_lower_m,
         r.back_distance_m, r.fore_distance_m, r.distance_accumulated_km,
         r.instrument_height, r.elevation_calculated, r.elevation_corrected, r.correction_applied
    from jsonb_populate_recordset(
           null::public.leveling_readings,
           coalesce(p_readings, '[]'::jsonb)
         ) r;
end;
$$;


-- ---------------------------------------------------------------------------
-- Visita de asentamientos
-- ---------------------------------------------------------------------------
-- El orden es el de la acción hasta la Fase 22, y no es arbitrario:
--   1. Purga de las lecturas que el usuario quitó. Primero, porque el trigger
--      de vigencia rechaza mover la fecha mientras quede una lectura de un
--      punto no vigente en la fecha nueva.
--   2. Cabecera. Antes de las lecturas: una lectura de un punto que solo es
--      vigente en la fecha NUEVA la rechazaría con la fecha vieja.
--   3. Libreta: upsert por (visit_id, reading_order) y purga de las filas
--      sobrantes.
--   4. Lecturas de la visita: upsert por (visit_id, point_id).
--   5. Propagación a las visitas posteriores abiertas del mismo lugar
--      (p_rewrites: filas de `settlement_readings` con su `visit_id`).
create function public.save_visit(
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
    instrument_height, elevation_calculated, elevation_corrected, correction_applied
  )
  select p_visit_id, b.reading_order, b.point_code, b.point_type, b.point_id,
         b.backsight, b.foresight,
         b.back_upper_m, b.back_lower_m, b.fore_upper_m, b.fore_lower_m,
         b.back_distance_m, b.fore_distance_m, b.distance_accumulated_km,
         b.instrument_height, b.elevation_calculated, b.elevation_corrected, b.correction_applied
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
    correction_applied      = excluded.correction_applied;

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


-- ---------------------------------------------------------------------------
-- Georreferenciación de una poligonal (Fase 15)
-- ---------------------------------------------------------------------------
-- Solo columnas de posición, que son las únicas que admiten los triggers en
-- un proceso cerrado. Las estaciones se actualizan fila a fila por su id —en
-- un cerrado no se pueden borrar y reinsertar— y todas deben ser del proceso.
create function public.georeference_polygonal(
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
  h       public.polygonal_processes;
  updated int;
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
    start_north         = h.start_north,
    start_east          = h.start_east,
    start_azimuth_deg   = h.start_azimuth_deg,
    start_azimuth_min   = h.start_azimuth_min,
    start_azimuth_sec   = h.start_azimuth_sec,
    end_north           = h.end_north,
    end_east            = h.end_east,
    end_azimuth_deg     = h.end_azimuth_deg,
    end_azimuth_min     = h.end_azimuth_min,
    end_azimuth_sec     = h.end_azimuth_sec,
    reference_point_id  = h.reference_point_id,
    georef_at           = h.georef_at,
    georef_by           = h.georef_by,
    georef_point_a_code = h.georef_point_a_code,
    georef_point_b_code = h.georef_point_b_code,
    georef_rotation_deg = h.georef_rotation_deg,
    georef_rotation_min = h.georef_rotation_min,
    georef_rotation_sec = h.georef_rotation_sec,
    georef_scale_factor = h.georef_scale_factor
  where id = p_process_id;

  update public.polygonal_stations st set
    azimuth_deg           = x.azimuth_deg,
    azimuth_min           = x.azimuth_min,
    azimuth_sec           = x.azimuth_sec,
    delta_north           = x.delta_north,
    delta_east            = x.delta_east,
    corrected_delta_north = x.corrected_delta_north,
    corrected_delta_east  = x.corrected_delta_east,
    north                 = x.north,
    east                  = x.east
    from jsonb_populate_recordset(
           null::public.polygonal_stations,
           coalesce(p_stations, '[]'::jsonb)
         ) x
   where st.id = x.id
     and st.process_id = p_process_id;

  get diagnostics updated = row_count;
  if updated <> jsonb_array_length(coalesce(p_stations, '[]'::jsonb)) then
    raise exception 'Las estaciones no corresponden al proceso %.', p_process_id using errcode = '22023';
  end if;
end;
$$;


revoke execute on function public.save_polygonal_process(uuid, jsonb, jsonb) from public, anon;
revoke execute on function public.save_leveling_process(uuid, jsonb, jsonb) from public, anon;
revoke execute on function public.save_visit(uuid, jsonb, jsonb, jsonb, jsonb) from public, anon;
revoke execute on function public.georeference_polygonal(uuid, jsonb, jsonb) from public, anon;

grant execute on function public.save_polygonal_process(uuid, jsonb, jsonb) to authenticated;
grant execute on function public.save_leveling_process(uuid, jsonb, jsonb) to authenticated;
grant execute on function public.save_visit(uuid, jsonb, jsonb, jsonb, jsonb) to authenticated;
grant execute on function public.georeference_polygonal(uuid, jsonb, jsonb) to authenticated;
