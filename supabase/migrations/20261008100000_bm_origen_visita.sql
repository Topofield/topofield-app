-- ============================================================================
-- Fase 37, paso 1 (antes del merge) — la visita que midió un BM del lugar
-- ============================================================================
-- Un punto auxiliar que se guarda en los BM del lugar lleva la cota que midió
-- su visita. Si esa misma visita lo tomara como BM de cierre, su tramo
-- «verificaría» contra su propia medida: cierre 0 y primer orden. La columna
-- dice qué visita lo midió, y el motor no lo usa para verificarla. Las demás
-- visitas, sí. Si se borra la visita, el BM queda como cualquier otro.
--
-- Aditiva y nulable: el código anterior a la fase no la nombra. Va con el
-- paso 1 (20261008000000), antes del merge.
-- ============================================================================

alter table public.site_benchmarks
  add column origin_visit_id uuid references public.settlement_visits(id) on delete set null;

comment on column public.site_benchmarks.origin_visit_id is
  'La visita que midió el BM (un punto auxiliar guardado en los BM del lugar): no verifica esa visita.';
