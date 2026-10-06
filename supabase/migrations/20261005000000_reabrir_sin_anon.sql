-- ============================================================================
-- Fase 34 — `is_reopening` sin `anon`
-- ============================================================================
-- Corrección de la revisión de la fase (docs/prds/33-reabrir-procesos.md).
--
-- `20261003000000_reabrir_procesos.sql` creó `public.is_reopening` con los
-- permisos por defecto, así que PostgREST la exponía como `/rpc/is_reopening`
-- también a `anon`. No lee datos, pero la convención de las funciones de la base
-- (`20260930010000_guardados_atomicos.sql`) es no dejarlas a `anon`.
--
-- `authenticated` la conserva: los triggers de inmutabilidad corren con el rol
-- de la sesión, y sin ella ningún usuario podría escribir un proceso cerrado ni
-- reabrirlo.
-- ============================================================================

revoke execute on function public.is_reopening(jsonb, jsonb) from public, anon;
grant execute on function public.is_reopening(jsonb, jsonb) to authenticated;
