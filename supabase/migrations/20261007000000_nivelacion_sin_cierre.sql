-- ============================================================================
-- Fase 36 — La nivelación sin cierre, paso 2 (DESPUÉS del merge)
-- ============================================================================
-- Borra el registro de cierre de la nivelación (decisión 14 del PRD de la
-- fase, docs/prds/35-ux-nivelacion.md § A). Va después del merge porque el
-- código viejo cierra escribiendo estas columnas; el nuevo ya no las nombra.
--
-- Visitas y lugares conservan su cierre: esto solo toca la nivelación.
-- ============================================================================

-- Lo que se hubiera cerrado entre el paso 1 y el merge, con el código viejo.
update public.leveling_processes
   set status = 'calculated'
 where status in ('closed', 'rejected');

alter table public.leveling_processes
  drop column closed_at,
  drop column closed_by,
  drop constraint leveling_processes_status_check,
  add constraint leveling_processes_status_check
    check (status in ('draft', 'in_progress', 'calculated'));
