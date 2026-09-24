-- ============================================================================
-- Georreferenciación de poligonales — Fase 15
-- ============================================================================
-- Ver docs/prds/14-georreferenciacion.md.
--
-- Una poligonal medida en un sistema local se lleva al real con dos de sus
-- estaciones, recalculándola esté o no cerrada. La georreferenciación es un
-- recálculo más: no hay función de base ni historial. Se anota solo la última.
--
-- Excepción a la inmutabilidad de los procesos cerrados: en uno cerrado o
-- rechazado se pueden reescribir las columnas de POSICIÓN (coordenadas,
-- proyecciones, azimuts, datos de arranque y llegada). Lo que el cierre
-- certificó —ángulos, distancias, lecturas, errores, precisión, veredicto,
-- estado— sigue inmutable, y un cerrado sigue sin poder borrarse.
-- ============================================================================

alter table public.polygonal_processes
  -- La última georreferenciación. Todas null si nunca se hizo.
  add column georef_at           timestamptz,
  add column georef_by           uuid references auth.users(id) on delete set null,
  add column georef_point_a_code text,
  add column georef_point_b_code text,
  -- La rotación es un ángulo: DMS en tres campos, normalizada a [0°, 360°).
  add column georef_rotation_deg int,
  add column georef_rotation_min int,
  add column georef_rotation_sec decimal(5,1),
  add column georef_scale_factor decimal(12,9);

-- --- Cabecera ---------------------------------------------------------------
-- `reject_update_on_closed_process()` la comparten nivelación, lugares y
-- visitas, así que la excepción no puede ir ahí: la poligonal pasa a su propia
-- función y las demás tablas no cambian.

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

drop trigger polygonal_processes_reject_update_when_closed on public.polygonal_processes;
create trigger polygonal_processes_reject_update_when_closed
  before update on public.polygonal_processes
  for each row execute function public.reject_update_on_closed_polygonal_process();

-- --- Estaciones -------------------------------------------------------------
-- Insertar o borrar estaciones de un cerrado sigue prohibido, igual que tocar
-- sus ángulos, distancias o ángulos corregidos (una rotación no los cambia).

create or replace function public.reject_write_on_closed_process_station()
returns trigger
language plpgsql
as $$
declare
  target_process uuid := coalesce(new.process_id, old.process_id);
  process_status text;
  position_columns text[] := array[
    'azimuth_deg', 'azimuth_min', 'azimuth_sec',
    'delta_north', 'delta_east',
    'corrected_delta_north', 'corrected_delta_east',
    'north', 'east'
  ];
begin
  select status into process_status
  from public.polygonal_processes
  where id = target_process;

  if process_status in ('closed', 'rejected') then
    if tg_op = 'UPDATE'
       and (to_jsonb(new) - position_columns) is not distinct from (to_jsonb(old) - position_columns) then
      return new;
    end if;
    raise exception
      'El proceso % está cerrado (%); de sus estaciones solo puede cambiar la posición.',
      target_process, process_status
      using errcode = 'restrict_violation';
  end if;

  return coalesce(new, old);
end;
$$;
