-- Fase 38 — el informe de cada proceso.
--
-- El informe vive en la página de cada proceso y se exporta desde allí (PDF del
-- navegador y Excel con fórmulas); los informes consolidados se quitan. Se
-- borran la tabla `reports`, su trigger de inmutabilidad (Fase 23) y su
-- función; las políticas de RLS se van con la tabla.
--
-- Va DESPUÉS del merge a `main` (doc técnica § 13): el código anterior lee
-- `reports` en cada página de proceso.

drop trigger if exists reports_reject_update on public.reports;
drop function if exists public.reject_update_on_report();
drop table if exists public.reports;
