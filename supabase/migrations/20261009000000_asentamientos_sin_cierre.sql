-- ============================================================================
-- Fase 37, paso 2 (después del merge): lo que el código viejo todavía nombraba
-- ============================================================================
-- El paso 1 (20261008000000_ux_asentamientos.sql) quitó los triggers de cierre
-- y reabrió lo cerrado, pero dejó las columnas: el código desplegado antes del
-- merge todavía las leía y escribía. Con el código de la fase en producción,
-- ya nadie las nombra:
--
-- - settlement_visits: closed_at, closed_by, el clima y el modo de captura
--   (toda visita se mide con libreta, decisión 5); su estado deja de admitir
--   `closed`.
-- - sites: status, closed_at y closed_by (el lugar no tiene estado, decisión 3).
-- - Las funciones de inmutabilidad compartidas y la de reabrir: desde las Fases
--   35, 36 y 37 ningún trigger las usa (decisión 22).
--
-- `capture_mode` solo se borra si la consulta previa de producción (PRD,
-- Despliegue) da cero visitas con cotas tecleadas, o si el usuario lo decide:
-- sus cotas siguen en `settlement_readings`; lo que se pierde es la etiqueta.
-- ============================================================================

update public.settlement_visits set status = 'calculated' where status = 'closed';

alter table public.settlement_visits
  drop column closed_at,
  drop column closed_by,
  drop column weather_conditions,
  drop column capture_mode,
  drop constraint settlement_visits_status_check,
  add constraint settlement_visits_status_check
    check (status in ('draft', 'in_progress', 'calculated'));

alter table public.sites
  drop column status,
  drop column closed_at,
  drop column closed_by;

drop function if exists public.reject_update_on_closed_process();
drop function if exists public.reject_delete_on_closed_process();
drop function if exists public.is_reopening(jsonb, jsonb);
