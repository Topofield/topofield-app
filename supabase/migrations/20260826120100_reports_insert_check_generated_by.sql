-- ============================================================================
-- Un informe solo puede atribuirse a quien lo crea
-- ============================================================================
-- Hallazgo H-4 de `docs/auditoria-seguridad.md` (severidad BAJA, endurecimiento).
--
-- La política de INSERT de `reports` ligaba `project_id` al dueño, pero no
-- decía nada de `generated_by`: un POST directo a `/rest/v1/reports` podía
-- crear un informe en el proyecto PROPIO con la autoría de OTRO usuario.
-- Reproducido vía REST: HTTP 201 con `generated_by` de la víctima.
--
-- El impacto es bajo y queda contenido por RLS en la lectura —el informe vive
-- en el proyecto del atacante y la vista imprimible re-obtiene cada proceso con
-- el cliente RLS, así que no filtra datos ajenos—, pero para un producto cuyo
-- valor es la trazabilidad del cierre, la firma de autor de un informe no
-- debería ser un campo libre.
--
-- No cambia el flujo de la aplicación: `createReportAction` ya fija
-- `generated_by = user.id`. `generated_by` es `text` (no uuid), de ahí el cast
-- de `auth.uid()`.
-- ============================================================================

drop policy if exists "reports_insert_via_project" on public.reports;

create policy "reports_insert_via_project" on public.reports
  for insert with check (
    exists (select 1 from public.projects
            where projects.id = reports.project_id and projects.user_id = auth.uid())
    and generated_by = auth.uid()::text
  );
