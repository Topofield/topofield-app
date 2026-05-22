-- ============================================================================
-- Migración Fase 2 — trigger de updated_at para projects
-- ============================================================================
-- La columna projects.updated_at existe desde la migración inicial pero nada la
-- mantiene: un UPDATE deja el valor de creación. Este trigger la pone en now()
-- en cada UPDATE.
--
-- La función set_updated_at() es genérica a propósito: las tablas *_processes de
-- las Fases 3-5 también tienen updated_at y reutilizarán este mismo trigger.
-- ============================================================================

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger projects_set_updated_at
  before update on public.projects
  for each row execute function public.set_updated_at();
