-- ============================================================================
-- Fase 26 — Las distancias por visual, mayores que cero
-- ============================================================================
-- Ver docs/prds/25-correcciones-calculo.md, C-11, y docs/auditoria-calculo.md.
--
-- Una distancia por visual en cero o negativa no es una medición: resta del
-- acumulado, rebaja la tolerancia K·√D y deja el veredicto en el aire. El
-- validador (`validateReadingCapture`) ya la rechaza como error de captura, y
-- el lector de la plantilla CSV no la importa; el CHECK lo garantiza aunque se
-- salte la acción. Vale para la nivelación y para la libreta de la visita de
-- asentamientos, que guardan las mismas columnas.
--
-- Antes de añadirlo se cuentan las filas que lo incumplen: si hubiera alguna,
-- la migración se detiene con un mensaje en vez de fallar con el del CHECK.
-- ============================================================================

do $$
declare
  fuera int;
begin
  select (select count(*) from public.leveling_readings
           where back_distance_m <= 0 or fore_distance_m <= 0)
       + (select count(*) from public.settlement_book_readings
           where back_distance_m <= 0 or fore_distance_m <= 0)
    into fuera;
  if fuera > 0 then
    raise exception
      'Hay % lecturas con una distancia por visual en cero o negativa: corríjalas antes de aplicar esta migración.', fuera;
  end if;
end;
$$;

alter table public.leveling_readings
  add constraint leveling_readings_distances_positive check (
    (back_distance_m is null or back_distance_m > 0)
    and (fore_distance_m is null or fore_distance_m > 0)
  );

alter table public.settlement_book_readings
  add constraint settlement_book_readings_distances_positive check (
    (back_distance_m is null or back_distance_m > 0)
    and (fore_distance_m is null or fore_distance_m > 0)
  );
