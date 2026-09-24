-- ============================================================================
-- Convención de ángulo a la derecha, amarre externo y lecturas múltiples
-- ============================================================================
-- Ver docs/prds/06-motor-captura-poligonal.md. Tres cambios:
--
--  1. `angle_type` deja de ser un campo muerto derivado del tipo de poligonal
--     y pasa a ser la elección del usuario entre ángulos interiores y
--     exteriores, que es lo que fija la suma teórica. 'internal' se renombra a
--     'interior' y entra 'exterior'.
--  2. El amarre se resuelve contra un `reference_points` del proyecto, y el
--     azimut se calcula desde sus coordenadas en vez de teclearse.
--  3. Cada ángulo pasa a guardar N lecturas; el promedio vive en la estación.
--
-- No hay backfill: la Fase 7 resetea los datos (decisión 5 del PRD de fase),
-- así que el trigger de inmutabilidad de la tabla nueva se crea de una vez.
-- ============================================================================

-- --- 1. angle_type: interior / exterior ------------------------------------

alter table public.polygonal_processes
  drop constraint if exists polygonal_processes_angle_type_check;

-- El renombrado toca también los procesos CERRADOS, y el trigger de
-- inmutabilidad lo rechazaría. Es un cambio de representación, no de datos:
-- se desactiva el trigger solo alrededor del UPDATE, como hacen los backfills
-- de las fases 8 y 9. En local nunca saltó porque `db reset` aplica las
-- migraciones sobre una base vacía; saltó al aplicarla en la nube
-- (2026-09-24), con procesos cerrados de antes de la Fase 7.
alter table public.polygonal_processes disable trigger polygonal_processes_reject_update_when_closed;

update public.polygonal_processes
  set angle_type = 'interior'
  where angle_type = 'internal';

alter table public.polygonal_processes enable trigger polygonal_processes_reject_update_when_closed;

alter table public.polygonal_processes
  alter column angle_type set default 'interior',
  add constraint polygonal_processes_angle_type_check
    check (angle_type in ('interior', 'exterior', 'deflection', 'azimuth'));

comment on column public.polygonal_processes.angle_type is
  'Dónde caen las lecturas a la derecha: interior o exterior. Fija la suma teórica.';

-- --- 2. Amarre -------------------------------------------------------------

alter table public.polygonal_processes
  add column reference_point_id   uuid references public.reference_points(id) on delete set null,
  add column reference_point_code text,
  add column angle_readings_min   int not null default 3
    check (angle_readings_min >= 1),
  add column has_closing_row      boolean not null default false;

comment on column public.polygonal_processes.reference_point_id is
  'Punto de amarre del catálogo del proyecto. Si está, el azimut se calcula desde sus coordenadas.';
comment on column public.polygonal_processes.reference_point_code is
  'Amarre fuera del catálogo: código tecleado a mano, con el azimut en start_azimuth_*.';
comment on column public.polygonal_processes.has_closing_row is
  'La cartera cierra contra el amarre: la última fila es el ángulo del último lado de vuelta a la referencia y no lleva distancia.';
comment on column public.polygonal_processes.start_azimuth_deg is
  'Azimut de partida. Con amarre, es el azimut del arranque HACIA la referencia; sin amarre, el del primer lado.';

-- --- 3. Lecturas múltiples por ángulo --------------------------------------

create table public.polygonal_angle_readings (
  id            uuid primary key default gen_random_uuid(),
  station_id    uuid not null references public.polygonal_stations(id) on delete cascade,
  reading_order int not null,
  angle_deg     int not null,
  angle_min     int not null,
  angle_sec     decimal(5,1) not null,
  created_at    timestamptz not null default now(),
  unique (station_id, reading_order)
);

create index polygonal_angle_readings_station_id_idx
  on public.polygonal_angle_readings(station_id);

alter table public.polygonal_angle_readings enable row level security;

-- El join de propiedad se repite en las 4 políticas; se extrae para no
-- duplicarlo. `security definer` con search_path fijo, como cualquier helper
-- que se invoca desde una política.
create or replace function public.owns_reading_station(target_station uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.polygonal_stations s
    join public.polygonal_processes p on p.id = s.process_id
    join public.projects pr on pr.id = p.project_id
    where s.id = target_station
      and pr.user_id = (select auth.uid())
  );
$$;

-- Propiedad vía join hasta projects. Cuatro políticas separadas, que es el
-- patrón del resto del schema (ver 20260522053657_polygonal.sql:151-195).
create policy "polygonal_angle_readings_select_via_project" on public.polygonal_angle_readings
  for select using (public.owns_reading_station(station_id));

create policy "polygonal_angle_readings_insert_via_project" on public.polygonal_angle_readings
  for insert with check (public.owns_reading_station(station_id));

create policy "polygonal_angle_readings_update_via_project" on public.polygonal_angle_readings
  for update using (public.owns_reading_station(station_id))
  with check (public.owns_reading_station(station_id));

create policy "polygonal_angle_readings_delete_via_project" on public.polygonal_angle_readings
  for delete using (public.owns_reading_station(station_id));

-- Inmutabilidad: las lecturas son el dato de campo más crudo que existe. Si el
-- proceso está cerrado, no se tocan.
--
-- OJO con el nombre: `reject_write_on_closed_process_reading` ya existe desde
-- 20260812020455_leveling.sql para las lecturas de nivelación, y un
-- `create or replace` con la misma firma la habría reemplazado en silencio,
-- dejando el trigger de nivelación ejecutando este cuerpo y buscando un
-- `station_id` que `leveling_readings` no tiene. De ahí el `_polygonal_`.
create or replace function public.reject_write_on_closed_polygonal_reading()
returns trigger
language plpgsql
as $$
declare
  target_station uuid := coalesce(new.station_id, old.station_id);
  process_status text;
begin
  select p.status into process_status
  from public.polygonal_stations s
  join public.polygonal_processes p on p.id = s.process_id
  where s.id = target_station;

  if process_status in ('closed', 'rejected') then
    raise exception
      'El proceso de la estación % está cerrado (%); sus lecturas son inmutables.',
      target_station, process_status
      using errcode = 'restrict_violation';
  end if;

  return coalesce(new, old);
end;
$$;

create trigger polygonal_angle_readings_reject_write_when_closed
  before insert or update or delete on public.polygonal_angle_readings
  for each row execute function public.reject_write_on_closed_polygonal_reading();
