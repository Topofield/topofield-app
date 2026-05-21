-- ============================================================================
-- Migración inicial — Fase 1 (Setup técnico) de TopoField
-- ============================================================================
-- Crea las 3 tablas que la fase necesita: profiles, projects, reference_points.
-- Incluye trigger de auto-creación de perfil al registrarse en auth y políticas
-- RLS para que cada usuario solo vea lo suyo.
--
-- Las tablas de poligonal, nivelación, asentamientos, reports y recipients se
-- crean en sus fases respectivas (decisión #2 del PRD-de-fase 00-setup.md).
-- ============================================================================


-- ----------------------------------------------------------------------------
-- profiles: extiende auth.users con datos del topógrafo
-- ----------------------------------------------------------------------------
create table public.profiles (
  id                   uuid primary key references auth.users(id) on delete cascade,
  first_name           text not null,
  last_name            text not null,
  -- full_name es derivada: siempre sincronizada con first_name + last_name.
  full_name            text generated always as (first_name || ' ' || last_name) stored,
  company              text,
  position             text,
  professional_license text,                                  -- matrícula profesional
  avatar_url           text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);


-- Trigger: al registrarse un user en auth, crear automáticamente su profile.
-- COALESCE defensivo: si el cliente no manda first_name/last_name en
-- raw_user_meta_data, usamos el email / cadena vacía para no romper el signup.
-- Decisión #9 del PRD-de-fase. full_name no se inserta: es columna generada.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, first_name, last_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'first_name', new.email),
    coalesce(new.raw_user_meta_data->>'last_name', '')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- ----------------------------------------------------------------------------
-- projects: proyecto del topógrafo (contiene procesos en fases siguientes)
-- ----------------------------------------------------------------------------
create table public.projects (
  id                          uuid primary key default gen_random_uuid(),
  user_id                     uuid not null references auth.users(id),
  name                        text not null,
  description                 text,
  client                      text not null,
  location                    text not null,
  latitude                    decimal(10,7),
  longitude                   decimal(10,7),
  datum                       text not null default 'MAGNA-SIRGAS',
  projection                  text,
  precision_order             text not null check (precision_order in ('primer_orden', 'segundo_orden', 'tercer_orden', 'ordinario')),
  equipment_brand             text not null,
  equipment_model             text not null,
  equipment_serial            text not null,
  angular_precision_seconds   decimal(5,1) not null,
  linear_precision            text not null,                  -- ej: "2+2ppm"
  equipment_calibration_date  date not null,
  status                      text not null default 'active' check (status in ('active', 'archived')),
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now()
);


-- ----------------------------------------------------------------------------
-- reference_points: BMs y puntos de control compartidos del proyecto
-- ----------------------------------------------------------------------------
create table public.reference_points (
  id                    uuid primary key default gen_random_uuid(),
  project_id            uuid not null references public.projects(id) on delete cascade,
  code                  text not null,                        -- ej: "BM-01", "GPS-1"
  type                  text not null check (type in ('bm', 'control', 'gps', 'detail')),
  north                 decimal(12,4),
  east                  decimal(12,4),
  elevation             decimal(10,4),
  description           text,
  created_at            timestamptz not null default now()
);


-- ============================================================================
-- Row Level Security
-- ============================================================================

alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.reference_points enable row level security;


-- profiles: cada usuario lee y actualiza solo su propio perfil.
-- INSERT lo hace el trigger handle_new_user (security definer); no necesita policy.
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);

create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id);


-- projects: el dueño tiene CRUD completo sobre los suyos.
create policy "projects_select_own" on public.projects
  for select using (auth.uid() = user_id);

create policy "projects_insert_own" on public.projects
  for insert with check (auth.uid() = user_id);

create policy "projects_update_own" on public.projects
  for update using (auth.uid() = user_id);

create policy "projects_delete_own" on public.projects
  for delete using (auth.uid() = user_id);


-- reference_points: pasa por el project.user_id (no tiene user_id directo).
create policy "reference_points_select_via_project" on public.reference_points
  for select using (
    exists (
      select 1 from public.projects
      where projects.id = reference_points.project_id
        and projects.user_id = auth.uid()
    )
  );

create policy "reference_points_insert_via_project" on public.reference_points
  for insert with check (
    exists (
      select 1 from public.projects
      where projects.id = reference_points.project_id
        and projects.user_id = auth.uid()
    )
  );

create policy "reference_points_update_via_project" on public.reference_points
  for update using (
    exists (
      select 1 from public.projects
      where projects.id = reference_points.project_id
        and projects.user_id = auth.uid()
    )
  );

create policy "reference_points_delete_via_project" on public.reference_points
  for delete using (
    exists (
      select 1 from public.projects
      where projects.id = reference_points.project_id
        and projects.user_id = auth.uid()
    )
  );
