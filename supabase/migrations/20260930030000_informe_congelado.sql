-- ============================================================================
-- Fase 23 — El informe emitido no cambia
-- ============================================================================
-- Ver docs/prds/22-integridad.md, sección E.
--
-- Un informe consolidado guarda su título, sus observaciones y la lista de
-- procesos incluidos; el contenido se reconstruye de procesos cerrados, que
-- son inmutables. Pero su portada leía el proyecto EN VIVO: renombrar el
-- proyecto o cambiarle el cliente reescribía la portada de un informe ya
-- entregado. Y la tabla admitía UPDATE, aunque ninguna pantalla lo usara.
--
--   cover  jsonb  nombre, cliente, ubicación, datum y proyección del proyecto
--                 al emitir. La escribe `createReportAction`. Los informes
--                 que ya existen se rellenan con los datos actuales del
--                 proyecto, que es lo mejor disponible.
--
-- Después, un trigger rechaza todo UPDATE y se retira la política de UPDATE.
-- El borrado sigue permitido: un informe no se corrige, se elimina y se
-- genera otro (decisión del usuario 3).
-- ============================================================================

alter table public.reports add column cover jsonb;

comment on column public.reports.cover is
  'Portada congelada al emitir: name, client, location, datum y projection del proyecto. Fase 23.';

update public.reports r
   set cover = jsonb_build_object(
         'name',       p.name,
         'client',     p.client,
         'location',   p.location,
         'datum',      p.datum,
         'projection', p.projection
       )
  from public.projects p
 where p.id = r.project_id;

alter table public.reports alter column cover set not null;


create function public.reject_update_on_report()
returns trigger
language plpgsql
as $$
begin
  raise exception
    'El informe % ya se emitió y no se modifica: se elimina y se genera otro.', old.id
    using errcode = 'restrict_violation';
end;
$$;

create trigger reports_reject_update
  before update on public.reports
  for each row execute function public.reject_update_on_report();

drop policy reports_update_via_project on public.reports;
