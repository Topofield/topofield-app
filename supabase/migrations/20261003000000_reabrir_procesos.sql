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
