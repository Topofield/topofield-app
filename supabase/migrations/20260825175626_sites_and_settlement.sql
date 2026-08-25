-- ============================================================================
-- Lugar (sites) y módulo de control de asentamientos — Fase 5
-- ============================================================================
-- Enmienda el § 3.2 del PRD principal, según docs/prds/04-asentamientos.md:
--   · `sites` (decisión #1 y #6): el lugar es transversal a los tres módulos y
--     absorbe lo que el PRD llamaba `settlement_systems`. Esa tabla no se crea.
--   · Los defaults de acumulado son los de EDIFICIO (25/50/75), no los de presa
--     (10/25/50) que traía el § 3.2 contradiciendo su propio marco teórico.
--   · `angular_distortion_limit` es INT (el X de 1/X), no TEXT '1/500': así no
--     hay que parsear una cadena en cada comparación numérica.
--   · `settlement_visits` (decisión #4): antes `settlement_campaigns`.
--   · northing/easting en los puntos (decisión #7): la distorsión angular
--     necesita la distancia horizontal y sin coordenadas habría que capturarla
--     par por par.
--   · Los UNIQUE expresan reglas del dominio. Sin ellos un doble envío duplica
--     lecturas y el asentamiento parcial se calcula contra la fila equivocada.
-- ============================================================================

create table public.sites (
  id                        uuid primary key default gen_random_uuid(),
  project_id                uuid not null references public.projects(id) on delete cascade,
  name                      text not null,
  description               text,
  structure_type            text not null
                              check (structure_type in ('edificio', 'presa', 'terraplen', 'otro')),
  -- Umbrales de alerta. Preset por structure_type, siempre editables.
  velocity_caution          decimal(6,2) not null default 2.0,   -- mm/mes
  velocity_alert            decimal(6,2) not null default 5.0,
  velocity_alarm            decimal(6,2) not null default 10.0,
  accumulated_caution       decimal(8,2) not null default 25.0,  -- mm
  accumulated_alert         decimal(8,2) not null default 50.0,
  accumulated_alarm         decimal(8,2) not null default 75.0,
  angular_distortion_limit  int not null default 500,            -- el X de 1/X
  status                    text not null default 'active'
                              check (status in ('active', 'closed')),
  closed_at                 timestamptz,
  closed_by                 text,
  notes                     text,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);

create table public.settlement_points (
  id                    uuid primary key default gen_random_uuid(),
  site_id               uuid not null references public.sites(id) on delete cascade,
  code                  text not null,
  location_description  text not null,
  northing              decimal(12,3),
  easting               decimal(12,3),
  initial_elevation     decimal(10,4),
  created_at            timestamptz not null default now(),
  unique (site_id, code)
);

create table public.settlement_visits (
  id                  uuid primary key default gen_random_uuid(),
  site_id             uuid not null references public.sites(id) on delete cascade,
  visit_number        int not null,          -- 0 = línea base
  date                date not null,
  operator            text,
  equipment           text,
  weather_conditions  text,
  closure_error_mm    decimal(8,1),
  notes               text,
  status              text not null default 'draft'
                        check (status in ('draft', 'calculated', 'closed')),
  closed_at           timestamptz,
  closed_by           text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (site_id, visit_number)
);

create table public.settlement_readings (
  id                      uuid primary key default gen_random_uuid(),
  visit_id                uuid not null references public.settlement_visits(id) on delete cascade,
  point_id                uuid not null references public.settlement_points(id) on delete cascade,
  elevation               decimal(10,4) not null,
  -- Calculados. Se persisten para que los informes de Fase 6 lean sin recalcular.
  partial_settlement      decimal(8,1),   -- mm, vs visita anterior
  accumulated_settlement  decimal(8,1),   -- mm, vs C0
  velocity                decimal(8,2),   -- mm/mes
  alert_status            text not null default 'normal'
                            check (alert_status in ('normal', 'caution', 'alert', 'alarm')),
  created_at              timestamptz not null default now(),
  unique (visit_id, point_id)
);

create index sites_project_id_idx on public.sites(project_id);
create index settlement_points_site_id_idx on public.settlement_points(site_id);
create index settlement_visits_site_id_idx on public.settlement_visits(site_id);
create index settlement_readings_visit_id_idx on public.settlement_readings(visit_id);
create index settlement_readings_point_id_idx on public.settlement_readings(point_id);

-- --- site_id en los módulos existentes (decisión #1) -------------------------
-- Se añade nullable, se rellena con un lugar «General» por proyecto que tenga
-- procesos, y solo entonces se impone NOT NULL. Así la migración es segura en
-- local y en la nube desplegada, sin vaciar nada.

alter table public.polygonal_processes add column site_id uuid references public.sites(id);
alter table public.leveling_processes  add column site_id uuid references public.sites(id);

insert into public.sites (project_id, name, description, structure_type)
select distinct p.id, 'General',
       'Lugar creado automáticamente al introducir la entidad en la Fase 5.',
       'otro'
from public.projects p
where exists (select 1 from public.polygonal_processes pp where pp.project_id = p.id)
   or exists (select 1 from public.leveling_processes  lp where lp.project_id = p.id);

update public.polygonal_processes pp
set site_id = s.id
from public.sites s
where s.project_id = pp.project_id and s.name = 'General' and pp.site_id is null;

update public.leveling_processes lp
set site_id = s.id
from public.sites s
where s.project_id = lp.project_id and s.name = 'General' and lp.site_id is null;

alter table public.polygonal_processes alter column site_id set not null;
alter table public.leveling_processes  alter column site_id set not null;

create index polygonal_processes_site_id_idx on public.polygonal_processes(site_id);
create index leveling_processes_site_id_idx  on public.leveling_processes(site_id);

-- --- Row Level Security -----------------------------------------------------
alter table public.sites enable row level security;
alter table public.settlement_points enable row level security;
alter table public.settlement_visits enable row level security;
alter table public.settlement_readings enable row level security;

-- sites: CRUD vía proyecto.
create policy "sites_select_via_project" on public.sites
  for select using (
    exists (select 1 from public.projects
            where projects.id = sites.project_id and projects.user_id = auth.uid())
  );
create policy "sites_insert_via_project" on public.sites
  for insert with check (
    exists (select 1 from public.projects
            where projects.id = sites.project_id and projects.user_id = auth.uid())
  );
create policy "sites_update_via_project" on public.sites
  for update using (
    exists (select 1 from public.projects
            where projects.id = sites.project_id and projects.user_id = auth.uid())
  );
create policy "sites_delete_via_project" on public.sites
  for delete using (
    exists (select 1 from public.projects
            where projects.id = sites.project_id and projects.user_id = auth.uid())
  );

-- settlement_points: join de dos niveles (point -> site -> project -> user).
create policy "settlement_points_select_via_project" on public.settlement_points
  for select using (
    exists (select 1 from public.sites
            join public.projects on projects.id = sites.project_id
            where sites.id = settlement_points.site_id and projects.user_id = auth.uid())
  );
create policy "settlement_points_insert_via_project" on public.settlement_points
  for insert with check (
    exists (select 1 from public.sites
            join public.projects on projects.id = sites.project_id
            where sites.id = settlement_points.site_id and projects.user_id = auth.uid())
  );
create policy "settlement_points_update_via_project" on public.settlement_points
  for update using (
    exists (select 1 from public.sites
            join public.projects on projects.id = sites.project_id
            where sites.id = settlement_points.site_id and projects.user_id = auth.uid())
  );
create policy "settlement_points_delete_via_project" on public.settlement_points
  for delete using (
    exists (select 1 from public.sites
            join public.projects on projects.id = sites.project_id
            where sites.id = settlement_points.site_id and projects.user_id = auth.uid())
  );

-- settlement_visits: mismo join de dos niveles.
create policy "settlement_visits_select_via_project" on public.settlement_visits
  for select using (
    exists (select 1 from public.sites
            join public.projects on projects.id = sites.project_id
            where sites.id = settlement_visits.site_id and projects.user_id = auth.uid())
  );
create policy "settlement_visits_insert_via_project" on public.settlement_visits
  for insert with check (
    exists (select 1 from public.sites
            join public.projects on projects.id = sites.project_id
            where sites.id = settlement_visits.site_id and projects.user_id = auth.uid())
  );
create policy "settlement_visits_update_via_project" on public.settlement_visits
  for update using (
    exists (select 1 from public.sites
            join public.projects on projects.id = sites.project_id
            where sites.id = settlement_visits.site_id and projects.user_id = auth.uid())
  );
create policy "settlement_visits_delete_via_project" on public.settlement_visits
  for delete using (
    exists (select 1 from public.sites
            join public.projects on projects.id = sites.project_id
            where sites.id = settlement_visits.site_id and projects.user_id = auth.uid())
  );

-- settlement_readings: join de tres niveles (reading -> visit -> site -> project).
create policy "settlement_readings_select_via_project" on public.settlement_readings
  for select using (
    exists (select 1 from public.settlement_visits
            join public.sites on sites.id = settlement_visits.site_id
            join public.projects on projects.id = sites.project_id
            where settlement_visits.id = settlement_readings.visit_id
              and projects.user_id = auth.uid())
  );
create policy "settlement_readings_insert_via_project" on public.settlement_readings
  for insert with check (
    exists (select 1 from public.settlement_visits
            join public.sites on sites.id = settlement_visits.site_id
            join public.projects on projects.id = sites.project_id
            where settlement_visits.id = settlement_readings.visit_id
              and projects.user_id = auth.uid())
  );
create policy "settlement_readings_update_via_project" on public.settlement_readings
  for update using (
    exists (select 1 from public.settlement_visits
            join public.sites on sites.id = settlement_visits.site_id
            join public.projects on projects.id = sites.project_id
            where settlement_visits.id = settlement_readings.visit_id
              and projects.user_id = auth.uid())
  );
create policy "settlement_readings_delete_via_project" on public.settlement_readings
  for delete using (
    exists (select 1 from public.settlement_visits
            join public.sites on sites.id = settlement_visits.site_id
            join public.projects on projects.id = sites.project_id
            where settlement_visits.id = settlement_readings.visit_id
              and projects.user_id = auth.uid())
  );

-- --- Triggers ---------------------------------------------------------------
create trigger sites_set_updated_at
  before update on public.sites
  for each row execute function public.set_updated_at();

create trigger settlement_visits_set_updated_at
  before update on public.settlement_visits
  for each row execute function public.set_updated_at();

-- Inmutabilidad. La función genérica solo mira old.status, así que sirve tal
-- cual: 'closed' está en el conjunto que bloquea. `settlement_visits` no tiene
-- 'rejected' (una visita se cierra o no; no hay tolerancia que rechazar) y eso
-- no afecta al comportamiento.
create trigger settlement_visits_reject_update_on_closed
  before update on public.settlement_visits
  for each row execute function public.reject_update_on_closed_process();

create trigger settlement_visits_reject_delete_when_closed
  before delete on public.settlement_visits
  for each row execute function public.reject_delete_on_closed_process();

create trigger sites_reject_update_on_closed
  before update on public.sites
  for each row execute function public.reject_update_on_closed_process();

create trigger sites_reject_delete_when_closed
  before delete on public.sites
  for each row execute function public.reject_delete_on_closed_process();

-- Las lecturas son el dato de campo de la visita. De nada sirve blindar la
-- cabecera si las mediciones pueden reescribirse.
--
-- Función propia y no la de nivelación: aquella consulta `leveling_processes`
-- por nombre, así que no es reutilizable pese a hacer lo mismo.
create or replace function public.reject_write_on_closed_visit_reading()
returns trigger
language plpgsql
as $$
declare
  target_visit uuid := coalesce(new.visit_id, old.visit_id);
  visit_status text;
begin
  select status into visit_status
  from public.settlement_visits
  where id = target_visit;

  if visit_status = 'closed' then
    raise exception
      'La visita % está cerrada; sus lecturas son inmutables.', target_visit
      using errcode = 'restrict_violation';
  end if;

  return coalesce(new, old);
end;
$$;

create trigger settlement_readings_reject_write_when_closed
  before insert or update or delete on public.settlement_readings
  for each row execute function public.reject_write_on_closed_visit_reading();
