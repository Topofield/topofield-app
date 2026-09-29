-- ============================================================================
-- Fase 22 — Tipo de lugar: agrupación o control de asentamientos
-- ============================================================================
-- Ver docs/prds/21-proceso-en-una-pantalla.md, sección D y decisión 6.
--
-- Desde la Fase 5, `polygonal_processes.site_id` y `leveling_processes.site_id`
-- son NOT NULL: toda poligonal y toda nivelación cuelgan de un lugar. Los que
-- las agrupan —el «General» del backfill de la Fase 5, el «Área principal» que
-- nace con cada proyecto, el «Levantamientos de campo» de la demo— no son
-- controles de asentamientos, pero nada en el esquema lo decía: salían en el
-- hub como controles vacíos, se podían cerrar e incluir en un informe, e
-- inflaban los conteos.
--
--   grouping    agrupa poligonales y nivelaciones; no se muestra como lugar
--   settlement  control de asentamientos: puntos, visitas, panel
--
-- ATENCIÓN: el relleno escribe también en lugares CERRADOS, desactivando el
-- trigger de inmutabilidad de `sites` solo alrededor del UPDATE (precedente:
-- fases 8, 9 y 19). La clasificación es metadato de la interfaz: no toca ni
-- mediciones, ni resultados, ni el cierre. `sites_set_updated_at` también se
-- desactiva: clasificar no es actividad del lugar.
-- ============================================================================

alter table public.sites
  add column kind text not null default 'settlement'
    check (kind in ('grouping', 'settlement'));

comment on column public.sites.kind is
  'grouping: agrupa poligonales y nivelaciones, no se muestra como lugar. '
  'settlement: control de asentamientos. Fase 22.';

-- --- Relleno ------------------------------------------------------------------
-- Es de agrupación un lugar sin puntos ni visitas que:
--   a) alguna poligonal o nivelación referencia, o
--   b) es el «Área principal» con que nació el proyecto (el más antiguo, de
--      tipo «otro»), aunque todavía no tenga procesos.
-- Un lugar con puntos o visitas es de asentamientos aunque también agrupe
-- procesos: lo que el usuario midió en él manda.

alter table public.sites disable trigger sites_reject_update_on_closed;
alter table public.sites disable trigger sites_set_updated_at;

update public.sites s
   set kind = 'grouping'
 where not exists (select 1 from public.settlement_points p where p.site_id = s.id)
   and not exists (select 1 from public.settlement_visits v where v.site_id = s.id)
   and (
         exists (select 1 from public.polygonal_processes pp where pp.site_id = s.id)
      or exists (select 1 from public.leveling_processes lp where lp.site_id = s.id)
      or (
               s.name = 'Área principal'
           and s.structure_type = 'otro'
           and s.created_at = (
                 select min(o.created_at) from public.sites o where o.project_id = s.project_id
               )
         )
   );

alter table public.sites enable trigger sites_set_updated_at;
alter table public.sites enable trigger sites_reject_update_on_closed;
