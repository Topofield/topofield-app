-- ============================================================================
-- Migración Fase 3 — Módulo Poligonal
-- ============================================================================
-- Crea las tablas del proceso poligonal: polygonal_processes (el proceso y sus
-- resultados de cierre) y polygonal_stations (las estaciones, con datos de campo
-- y columnas calculadas). Ambas con RLS por join con projects y trigger de
-- updated_at sobre el proceso.
--
-- Schema literal del PRD-TopoField § 3.2. created_at/updated_at se declaran
-- not null (convención de la migración inicial). project_id/process_id son
-- not null: un proceso pertenece siempre a un proyecto, una estación a un proceso.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- polygonal_processes: un proceso de poligonal de un proyecto
-- ----------------------------------------------------------------------------
create table public.polygonal_processes (
  id                         uuid primary key default gen_random_uuid(),
  project_id                 uuid not null references public.projects(id) on delete cascade,
  name                       text not null,
  type                       text not null check (type in ('closed', 'open_controlled', 'open_uncontrolled')),
  -- Punto de partida
  start_point_code           text not null,
  start_north                decimal(12,4) not null,
  start_east                 decimal(12,4) not null,
  start_azimuth_deg          int,
  start_azimuth_min          int,
  start_azimuth_sec          decimal(5,1),
  -- Punto de llegada (solo open_controlled)
  end_point_code             text,
  end_north                  decimal(12,4),
  end_east                   decimal(12,4),
  end_azimuth_deg            int,
  end_azimuth_min            int,
  end_azimuth_sec            decimal(5,1),
  -- Configuración
  angle_type                 text not null default 'internal' check (angle_type in ('internal', 'deflection', 'azimuth')),
  correction_method          text check (correction_method in ('bowditch', 'transit', 'crandall')),
  -- Resultados de cierre
  angular_error_seconds      decimal(10,1),
  linear_error               decimal(10,4),
  perimeter                  decimal(12,4),
  relative_precision         text,                              -- ej: "1:5,234"
  meets_tolerance            boolean,
  -- Estado
  status                     text not null default 'draft' check (status in ('draft', 'in_progress', 'calculated', 'closed', 'rejected')),
  closed_at                  timestamptz,
  closed_by                  text,
  notes                      text,
  created_at                 timestamptz not null default now(),
  updated_at                 timestamptz not null default now()
);

create index polygonal_processes_project_id_idx on public.polygonal_processes(project_id);


-- ----------------------------------------------------------------------------
-- polygonal_stations: estaciones de un proceso (datos de campo + calculados)
-- ----------------------------------------------------------------------------
create table public.polygonal_stations (
  id                         uuid primary key default gen_random_uuid(),
  process_id                 uuid not null references public.polygonal_processes(id) on delete cascade,
  station_order              int not null,
  point_code                 text not null,
  -- Ángulo medido (grados, minutos, segundos)
  angle_deg                  int,
  angle_min                  int,
  angle_sec                  decimal(5,1),
  -- Deflexión (si aplica)
  deflection_direction       text check (deflection_direction in ('right', 'left')),
  -- Distancia horizontal
  horizontal_distance        decimal(10,4),
  -- Campos calculados
  corrected_angle_deg        int,
  corrected_angle_min        int,
  corrected_angle_sec        decimal(5,1),
  azimuth_deg                int,
  azimuth_min                int,
  azimuth_sec                decimal(5,1),
  delta_north                decimal(12,4),
  delta_east                 decimal(12,4),
  corrected_delta_north      decimal(12,4),
  corrected_delta_east       decimal(12,4),
  north                      decimal(12,4),
  east                       decimal(12,4),
  -- Validación
  has_warnings               boolean not null default false,
  warning_messages           jsonb,
  created_at                 timestamptz not null default now()
);

create index polygonal_stations_process_id_idx on public.polygonal_stations(process_id);


-- ----------------------------------------------------------------------------
-- updated_at: reusa la función public.set_updated_at() de la Fase 2
-- ----------------------------------------------------------------------------
create trigger polygonal_processes_set_updated_at
  before update on public.polygonal_processes
  for each row execute function public.set_updated_at();


-- ============================================================================
-- Row Level Security
-- ============================================================================

alter table public.polygonal_processes enable row level security;
alter table public.polygonal_stations enable row level security;


-- polygonal_processes: CRUD vía el projects.user_id del proyecto contenedor.
create policy "polygonal_processes_select_via_project" on public.polygonal_processes
  for select using (
    exists (
      select 1 from public.projects
      where projects.id = polygonal_processes.project_id
        and projects.user_id = auth.uid()
    )
  );

create policy "polygonal_processes_insert_via_project" on public.polygonal_processes
  for insert with check (
    exists (
      select 1 from public.projects
      where projects.id = polygonal_processes.project_id
        and projects.user_id = auth.uid()
    )
  );

create policy "polygonal_processes_update_via_project" on public.polygonal_processes
  for update using (
    exists (
      select 1 from public.projects
      where projects.id = polygonal_processes.project_id
        and projects.user_id = auth.uid()
    )
  );

create policy "polygonal_processes_delete_via_project" on public.polygonal_processes
  for delete using (
    exists (
      select 1 from public.projects
      where projects.id = polygonal_processes.project_id
        and projects.user_id = auth.uid()
    )
  );


-- polygonal_stations: CRUD vía join de dos niveles (process -> project -> user).
create policy "polygonal_stations_select_via_project" on public.polygonal_stations
  for select using (
    exists (
      select 1
      from public.polygonal_processes
      join public.projects on projects.id = polygonal_processes.project_id
      where polygonal_processes.id = polygonal_stations.process_id
        and projects.user_id = auth.uid()
    )
  );

create policy "polygonal_stations_insert_via_project" on public.polygonal_stations
  for insert with check (
    exists (
      select 1
      from public.polygonal_processes
      join public.projects on projects.id = polygonal_processes.project_id
      where polygonal_processes.id = polygonal_stations.process_id
        and projects.user_id = auth.uid()
    )
  );

create policy "polygonal_stations_update_via_project" on public.polygonal_stations
  for update using (
    exists (
      select 1
      from public.polygonal_processes
      join public.projects on projects.id = polygonal_processes.project_id
      where polygonal_processes.id = polygonal_stations.process_id
        and projects.user_id = auth.uid()
    )
  );

create policy "polygonal_stations_delete_via_project" on public.polygonal_stations
  for delete using (
    exists (
      select 1
      from public.polygonal_processes
      join public.projects on projects.id = polygonal_processes.project_id
      where polygonal_processes.id = polygonal_stations.process_id
        and projects.user_id = auth.uid()
    )
  );
