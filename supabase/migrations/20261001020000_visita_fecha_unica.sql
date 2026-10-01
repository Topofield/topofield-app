-- ============================================================================
-- Fase 26 — Una visita por fecha en cada lugar
-- ============================================================================
-- Ver docs/prds/25-correcciones-calculo.md, C-16, y docs/auditoria-calculo.md.
--
-- El motor ordena las visitas por fecha y mide el parcial y la velocidad de
-- cada punto contra su lectura anterior. Con dos visitas en la misma fecha el
-- intervalo es cero —la velocidad queda vacía—, el orden entre ellas dependía
-- del de las filas, y el cálculo indexa las lecturas por punto y fecha. Las
-- acciones ya exigen que la fecha de una visita quede entre la de su anterior
-- y la de su siguiente; el índice único lo garantiza aunque se salten.
--
-- Antes de crearlo se cuentan las fechas repetidas: si hubiera alguna, la
-- migración se detiene con un mensaje en vez de fallar con el del índice.
-- ============================================================================

do $$
declare
  repetidas int;
begin
  select count(*) into repetidas
    from (select 1 from public.settlement_visits
           group by site_id, date having count(*) > 1) d;
  if repetidas > 0 then
    raise exception
      'Hay % fechas con más de una visita en el mismo lugar: corríjalas antes de aplicar esta migración.', repetidas;
  end if;
end;
$$;

alter table public.settlement_visits
  add constraint settlement_visits_one_per_date unique (site_id, date);
