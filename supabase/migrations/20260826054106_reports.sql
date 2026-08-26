-- ============================================================================
-- Informes (reports) — Fase 6
-- ============================================================================
-- Enmienda el § 3.2 del PRD principal, según
-- docs/prds/05-cierre-informes-export.md:
--   · Sin `file_url` (decisión #2). El informe no se almacena como archivo: se
--     produce con una ruta imprimible y el navegador lo convierte a PDF. No hay
--     almacenamiento de archivos en el producto, así que la columna nunca se
--     llenaría y sería una promesa falsa en el esquema.
--   · `project_id` es NOT NULL. El § 3.2 lo dejaba nullable, pero un informe
--     sin proyecto no significa nada y obligaría a un camino muerto en cada
--     consulta.
--   · `included_processes` guarda también el orden de cada sección. El § 4.7
--     pide ordenarlas y ese orden es parte del informe, no de la vista.
--
-- Que el informe se reconstruya al abrirlo en vez de guardarse es seguro
-- porque solo puede incluir procesos CERRADOS (decisión #3), que son inmutables
-- por trigger de base: regenerarlo da siempre el mismo resultado. El `name` se
-- guarda de todos modos porque es el nombre en el momento de emitir; si un
-- proceso se renombra después, el informe conserva el que llevaba.
--
-- Sin trigger de inmutabilidad: un informe no tiene `status` ni ciclo de vida,
-- se borra y se rehace. Lo inmutable son los procesos que incluye, y de eso ya
-- se encargan sus propios triggers.
-- ============================================================================

create table public.reports (
  id                  uuid primary key default gen_random_uuid(),
  project_id          uuid not null references public.projects(id) on delete cascade,
  title               text not null,
  -- [{type, id, name, order}] — type es 'polygonal' | 'leveling' | 'site'.
  included_processes  jsonb not null,
  observations        text,
  generated_at        timestamptz default now(),
  generated_by        text not null
);

create index reports_project_id_idx on public.reports(project_id);

-- --- Row Level Security -----------------------------------------------------
-- Mismo patrón que el resto del esquema: join hasta `projects` y comparación
-- con auth.uid(). El usuario solo ve los informes de sus propios proyectos.

alter table public.reports enable row level security;

create policy "reports_select_via_project" on public.reports
  for select using (
    exists (select 1 from public.projects
            where projects.id = reports.project_id and projects.user_id = auth.uid())
  );
create policy "reports_insert_via_project" on public.reports
  for insert with check (
    exists (select 1 from public.projects
            where projects.id = reports.project_id and projects.user_id = auth.uid())
  );
create policy "reports_update_via_project" on public.reports
  for update using (
    exists (select 1 from public.projects
            where projects.id = reports.project_id and projects.user_id = auth.uid())
  );
create policy "reports_delete_via_project" on public.reports
  for delete using (
    exists (select 1 from public.projects
            where projects.id = reports.project_id and projects.user_id = auth.uid())
  );
