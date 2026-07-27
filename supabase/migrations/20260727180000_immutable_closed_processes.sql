-- ============================================================================
-- Inmutabilidad de procesos cerrados — defensa en la base de datos
-- ============================================================================
-- El PRD (§ 4.6) exige que un proceso con status 'closed' o 'rejected' sea
-- inmutable. Hasta ahora esa garantía vivía solo en las Server Actions
-- (`savePolygonalProcessAction` y `closePolygonalProcessAction`), que rechazan
-- los cambios sobre procesos cerrados.
--
-- Eso no basta. Las políticas RLS de UPDATE solo comprueban la propiedad del
-- proyecto, no el estado del proceso, y la clave publicable de Supabase es
-- pública por diseño: cualquier sesión válida puede llamar a la API REST
-- directamente y saltarse la capa de aplicación. Verificado: un UPDATE sobre un
-- proceso 'closed' con el JWT del dueño tenía éxito.
--
-- Estos triggers cierran esa brecha. La regla de negocio queda donde no se
-- puede eludir.
--
-- Transición permitida: el cierre en sí es un UPDATE que lleva el proceso de
-- 'calculated' a 'closed'/'rejected', así que se admite esa transición y se
-- bloquea cualquier cambio posterior. Un proceso cerrado no vuelve atrás.
-- ============================================================================

-- --- polygonal_processes ---------------------------------------------------

create or replace function public.reject_update_on_closed_process()
returns trigger
language plpgsql
as $$
begin
  -- Solo se protegen las filas que YA estaban cerradas antes de este UPDATE.
  -- La transición hacia cerrado (el cierre propiamente dicho) sigue permitida.
  if old.status in ('closed', 'rejected') then
    raise exception
      'El proceso % está cerrado (%) y es inmutable.', old.id, old.status
      using errcode = 'restrict_violation';
  end if;
  return new;
end;
$$;

create trigger polygonal_processes_reject_update_when_closed
  before update on public.polygonal_processes
  for each row execute function public.reject_update_on_closed_process();

create or replace function public.reject_delete_on_closed_process()
returns trigger
language plpgsql
as $$
begin
  if old.status in ('closed', 'rejected') then
    raise exception
      'El proceso % está cerrado (%) y no puede eliminarse.', old.id, old.status
      using errcode = 'restrict_violation';
  end if;
  return old;
end;
$$;

create trigger polygonal_processes_reject_delete_when_closed
  before delete on public.polygonal_processes
  for each row execute function public.reject_delete_on_closed_process();

-- --- polygonal_stations ----------------------------------------------------
-- Las estaciones son los datos de campo del proceso. De nada sirve blindar la
-- cabecera si sus mediciones pueden reescribirse: la trazabilidad del cierre
-- depende de que ambas queden congeladas.

create or replace function public.reject_write_on_closed_process_station()
returns trigger
language plpgsql
as $$
declare
  target_process uuid := coalesce(new.process_id, old.process_id);
  process_status text;
begin
  select status into process_status
  from public.polygonal_processes
  where id = target_process;

  if process_status in ('closed', 'rejected') then
    raise exception
      'El proceso % está cerrado (%); sus estaciones son inmutables.',
      target_process, process_status
      using errcode = 'restrict_violation';
  end if;

  return coalesce(new, old);
end;
$$;

create trigger polygonal_stations_reject_write_when_closed
  before insert or update or delete on public.polygonal_stations
  for each row execute function public.reject_write_on_closed_process_station();
