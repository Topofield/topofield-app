-- ============================================================================
-- Fase 35 — La poligonal sin cierre, paso 2 (DESPUÉS del merge)
-- ============================================================================
-- Borra el registro de cierre de la poligonal (decisión 18 del PRD de la fase,
-- confirmada: no tiene vuelta atrás). Va después del merge porque el código
-- viejo cierra escribiendo estas columnas; el nuevo ya no las nombra.
--
-- Nivelación, visitas y lugares conservan su cierre: esto solo toca la
-- poligonal.
-- ============================================================================

-- Lo que se hubiera cerrado entre el paso 1 y el merge, con el código viejo.
update public.polygonal_processes
   set status = 'calculated'
 where status in ('closed', 'rejected');

alter table public.polygonal_processes
  drop column closed_at,
  drop column closed_by,
  drop constraint polygonal_processes_status_check,
  add constraint polygonal_processes_status_check
    check (status in ('draft', 'in_progress', 'calculated'));
