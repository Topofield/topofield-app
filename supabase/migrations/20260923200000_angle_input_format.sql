-- ============================================================================
-- Formato de captura de ángulos por proceso poligonal — Fase 13 (P1)
-- ============================================================================
-- Ver docs/prds/12-canvas-poligonal.md, «Ángulos en grados decimales».
--
-- Solo recuerda cómo se TECLEAN los ángulos del proceso: en DMS o en grados
-- decimales. El almacenamiento no cambia: los ángulos siguen en tres columnas
-- (deg, min, sec), como fija CLAUDE.md. El editor convierte en pantalla.
--
-- Los procesos existentes quedan en 'dms'. La inmutabilidad de los procesos
-- cerrados (trigger de 20260727180000) cubre también esta columna: en uno
-- cerrado el conmutador cambia la vista y no se guarda.
-- ============================================================================

alter table public.polygonal_processes
  add column angle_input_format text not null default 'dms'
    check (angle_input_format in ('dms', 'decimal'));
