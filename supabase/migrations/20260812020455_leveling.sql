-- ============================================================================
-- Módulo de nivelación — Fase 4
-- ============================================================================
-- Tablas del PRD § 3.2 más tres ajustes documentados en docs/prds/03-nivelacion.md:
--   · point_type (decisión #7): los puntos intermedios no propagan cota ni
--     entran en la comprobación aritmética. Sin distinguirlos el cálculo es
--     incorrecto.
--   · distance_m (decisión #8): distancia por visual, necesaria para validar el
--     equilibrado atrás/adelante. Guardar solo la acumulada lo impediría.
--   · correction_method con CHECK explícito (decisión #3): hoy un solo método.
-- ============================================================================

create table public.leveling_processes (
  id                      uuid primary key default gen_random_uuid(),
  project_id              uuid not null references public.projects(id) on delete cascade,
  name                    text not null,
  type                    text not null check (type in ('closed', 'link', 'open')),
  -- BM de partida
  start_bm_code           text not null,
  start_bm_elevation      decimal(10,4) not null,
  -- BM de llegada (solo type = 'link')
  end_bm_code             text,
  end_bm_elevation        decimal(10,4),
  -- Configuración
  has_return_run          boolean not null default false,
  total_distance_km       decimal(8,3),
  correction_method       text not null default 'proportional_distance'
                            check (correction_method in ('proportional_distance')),
  -- Resultados de cierre
  closure_error_mm        decimal(8,1),
  tolerance_mm            decimal(8,1),
  meets_tolerance         boolean,
  -- Ida y vuelta: error de SECCIÓN por recorrido (decisión #2)
  forward_error_mm        decimal(8,1),
  return_error_mm         decimal(8,1),
  discrepancy_mm          decimal(8,1),
  -- Estado
  status                  text not null default 'draft'
                            check (status in ('draft', 'in_progress', 'calculated', 'closed', 'rejected')),
  closed_at               timestamptz,
  closed_by               text,
  notes                   text,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

create table public.leveling_readings (
  id                      uuid primary key default gen_random_uuid(),
  process_id              uuid not null references public.leveling_processes(id) on delete cascade,
  run_type                text not null default 'forward' check (run_type in ('forward', 'return')),
  reading_order           int not null,
  point_code              text not null,
  -- 'pc' es el caso mayoritario, pero el editor asigna el tipo SIEMPRE de forma
  -- explícita: la primera fila de un recorrido es 'bm', y la última también en
  -- los tipos 'closed' y 'link'. Confiar en el default para esas filas daría
  -- una comprobación aritmética silenciosamente incorrecta.
  point_type              text not null default 'pc'
                            check (point_type in ('bm', 'pc', 'intermediate')),
  backsight               decimal(6,4),
  foresight               decimal(6,4),
  distance_m              decimal(8,1),
  distance_accumulated_km decimal(8,3),
  -- Calculados
  instrument_height       decimal(10,4),
  elevation_calculated    decimal(10,4),
  elevation_corrected     decimal(10,4),
  correction_applied      decimal(8,4),
  -- Validación
  has_warnings            boolean not null default false,
  warning_messages        jsonb,
  created_at              timestamptz not null default now()
);

create index leveling_processes_project_id_idx on public.leveling_processes(project_id);
create index leveling_readings_process_id_idx on public.leveling_readings(process_id);

-- --- Row Level Security -----------------------------------------------------
alter table public.leveling_processes enable row level security;
alter table public.leveling_readings enable row level security;

-- leveling_processes: CRUD vía proyecto con verificación de propiedad.
create policy "leveling_processes_select_via_project" on public.leveling_processes
  for select using (
    exists (
      select 1 from public.projects
      where projects.id = leveling_processes.project_id
        and projects.user_id = auth.uid()
    )
  );

create policy "leveling_processes_insert_via_project" on public.leveling_processes
  for insert with check (
    exists (
      select 1 from public.projects
      where projects.id = leveling_processes.project_id
        and projects.user_id = auth.uid()
    )
  );

create policy "leveling_processes_update_via_project" on public.leveling_processes
  for update using (
    exists (
      select 1 from public.projects
      where projects.id = leveling_processes.project_id
        and projects.user_id = auth.uid()
    )
  );

create policy "leveling_processes_delete_via_project" on public.leveling_processes
  for delete using (
    exists (
      select 1 from public.projects
      where projects.id = leveling_processes.project_id
        and projects.user_id = auth.uid()
    )
  );

-- leveling_readings: CRUD vía join de dos niveles (reading -> process -> project -> user).
create policy "leveling_readings_select_via_project" on public.leveling_readings
  for select using (
    exists (
      select 1
      from public.leveling_processes
      join public.projects on projects.id = leveling_processes.project_id
      where leveling_processes.id = leveling_readings.process_id
        and projects.user_id = auth.uid()
    )
  );

create policy "leveling_readings_insert_via_project" on public.leveling_readings
  for insert with check (
    exists (
      select 1
      from public.leveling_processes
      join public.projects on projects.id = leveling_processes.project_id
      where leveling_processes.id = leveling_readings.process_id
        and projects.user_id = auth.uid()
    )
  );

create policy "leveling_readings_update_via_project" on public.leveling_readings
  for update using (
    exists (
      select 1
      from public.leveling_processes
      join public.projects on projects.id = leveling_processes.project_id
      where leveling_processes.id = leveling_readings.process_id
        and projects.user_id = auth.uid()
    )
  );

create policy "leveling_readings_delete_via_project" on public.leveling_readings
  for delete using (
    exists (
      select 1
      from public.leveling_processes
      join public.projects on projects.id = leveling_processes.project_id
      where leveling_processes.id = leveling_readings.process_id
        and projects.user_id = auth.uid()
    )
  );

-- --- Triggers ---------------------------------------------------------------
create trigger leveling_processes_set_updated_at
  before update on public.leveling_processes
  for each row execute function public.set_updated_at();

-- Inmutabilidad de procesos cerrados (reusa la función genérica de la Fase 3).
create trigger leveling_processes_reject_update_on_closed
  before update on public.leveling_processes
  for each row execute function public.reject_update_on_closed_process();

create trigger leveling_processes_reject_delete_when_closed
  before delete on public.leveling_processes
  for each row execute function public.reject_delete_on_closed_process();

-- Las lecturas son los datos de campo del proceso. De nada sirve blindar la
-- cabecera si sus mediciones pueden reescribirse: la trazabilidad del cierre
-- depende de que ambas queden congeladas.
create or replace function public.reject_write_on_closed_process_reading()
returns trigger
language plpgsql
as $$
declare
  target_process uuid := coalesce(new.process_id, old.process_id);
  process_status text;
begin
  select status into process_status
  from public.leveling_processes
  where id = target_process;

  if process_status in ('closed', 'rejected') then
    raise exception
      'El proceso % está cerrado (%); sus lecturas son inmutables.',
      target_process, process_status
      using errcode = 'restrict_violation';
  end if;

  return coalesce(new, old);
end;
$$;

create trigger leveling_readings_reject_write_when_closed
  before insert or update or delete on public.leveling_readings
  for each row execute function public.reject_write_on_closed_process_reading();
