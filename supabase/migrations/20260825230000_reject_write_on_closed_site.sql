-- ============================================================================
-- Cerrar el lugar deja sus visitas y lecturas en solo lectura — en la base
-- ============================================================================
-- El criterio (l) del PRD (§ 4.6): cerrar el lugar deja sus visitas en solo
-- lectura. Hasta ahora esa garantía vivía solo en las Server Actions
-- (`saveVisitAction`/`closeVisitAction` comprueban `context.site.status`), lo
-- mismo que pasaba con los procesos antes de
-- `20260727180000_immutable_closed_processes.sql`: la clave publicable de
-- Supabase es pública por diseño, así que cualquier sesión válida puede
-- llamar a la API REST directamente y saltarse la capa de aplicación.
--
-- `settlement_visits_reject_update_on_closed` (de la migración de Fase 5) ya
-- protege una visita cuyo PROPIO status es 'closed'. Lo que falta es que
-- cerrar el LUGAR (`sites.status = 'closed'`) también bloquee sus visitas
-- ABIERTAS: hoy una visita en 'draft'/'calculated' de un lugar cerrado se
-- puede seguir escribiendo, porque su propio status nunca cambió.
--
-- Igual que en `reject_write_on_closed_visit_reading`, las lecturas se
-- protegen con su propia función (y no reutilizando la de la visita): de
-- nada sirve blindar la cabecera si las mediciones de campo pueden
-- reescribirse.
-- ============================================================================

-- --- settlement_visits -------------------------------------------------------

create or replace function public.reject_write_on_closed_site_visit()
returns trigger
language plpgsql
as $$
declare
  target_site uuid := coalesce(new.site_id, old.site_id);
  site_status text;
begin
  select status into site_status
  from public.sites
  where id = target_site;

  if site_status = 'closed' then
    raise exception
      'El lugar % está cerrado; sus visitas son inmutables.', target_site
      using errcode = 'restrict_violation';
  end if;

  return coalesce(new, old);
end;
$$;

create trigger settlement_visits_reject_write_when_site_closed
  before insert or update or delete on public.settlement_visits
  for each row execute function public.reject_write_on_closed_site_visit();

-- --- settlement_readings ------------------------------------------------------

create or replace function public.reject_write_on_closed_site_reading()
returns trigger
language plpgsql
as $$
declare
  target_visit uuid := coalesce(new.visit_id, old.visit_id);
  site_status text;
begin
  select sites.status into site_status
  from public.settlement_visits
  join public.sites on sites.id = settlement_visits.site_id
  where settlement_visits.id = target_visit;

  if site_status = 'closed' then
    raise exception
      'El lugar de la visita % está cerrado; sus lecturas son inmutables.',
      target_visit
      using errcode = 'restrict_violation';
  end if;

  return coalesce(new, old);
end;
$$;

create trigger settlement_readings_reject_write_when_site_closed
  before insert or update or delete on public.settlement_readings
  for each row execute function public.reject_write_on_closed_site_reading();
