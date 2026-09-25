-- ============================================================================
-- Fase 19 — Compensación desde el origen (N8): recálculo de lo guardado
-- ============================================================================
-- Ver docs/prds/18-equilibrado-y-compensacion.md.
--
-- Hasta la Fase 19, el acumulado de una fila `bm`/`pc` incluía su propia V+ —la
-- visual hacia la armada SIGUIENTE—, y la compensación proporcional movía el BM
-- de partida aunque su cota es conocida. El motor ya acumula hasta la V− de cada
-- punto. Esta migración reescribe con esa regla lo que el motor dejó guardado:
--
--   acumulado  = distancia desde el origen hasta el punto, sin su propia V+
--   corrección = −(error de cierre) × acumulado / distancia total
--   cota_compensada = cota_calculada + corrección        (si el cierre cumple)
--
-- Verificado fila a fila contra el motor sobre la base local: coincide a la
-- resolución de cada columna (metro en el acumulado, 0.1 mm en las cotas). La
-- única diferencia son los empates exactos del acumulado (164.5 m): el motor
-- suma en coma flotante, llega a 164.49999999999997 y redondea abajo; aquí la
-- suma es decimal y redondea arriba. Es la columna informativa, no la que
-- compensa, y el siguiente guardado del proceso la reescribe desde el motor.
-- Las intermedias, el punto de cierre y los procesos reconstruidos por la Fase 9
-- no cambian. La vuelta de ida y vuelta no se compensa, pero el motor le aplica
-- la misma regla de acumulado: se migra su «Dist acum», no su corrección.
--
-- ATENCIÓN: toca procesos y visitas CERRADOS. Es la excepción que el usuario
-- aprobó para esta fase: se reescriben VALORES DERIVADOS (acumulado, corrección,
-- cota compensada), nunca mediciones ni veredictos. Los triggers de inmutabilidad
-- se desactivan solo alrededor de cada UPDATE, como en las fases 8 y 9.
-- ============================================================================

-- --- 1. Guarda --------------------------------------------------------------
-- Un punto de control usado como punto de cambio (o BM) en la libreta de una
-- visita compensada cambiaría de cota, y con ella su asentamiento parcial,
-- acumulado, velocidad y alerta en esa visita y en las siguientes: eso lo
-- recalcula `computeHistory`, no SQL. No se adivina: se aborta nombrando el caso.
-- Volver a guardar la visita no lo resuelve (la condición es de la libreta, no
-- de sus valores), y una visita cerrada ni siquiera se puede guardar.
--
-- Con error de cierre 0, o sin V+, la cota no se mueve: esos casos no abortan.
do $guard$
declare
  casos text;
begin
  select string_agg(
           format('%s, visita %s: %s', s.name, v.visit_number, b.point_code),
           '; ' order by s.name, v.visit_number)
    into casos
    from public.settlement_book_readings b
    join public.settlement_visits v on v.id = b.visit_id
    join public.sites s on s.id = v.site_id
   where v.capture_mode = 'book'
     and v.meets_tolerance
     and coalesce(v.closure_error_mm, 0) <> 0
     and b.point_id is not null
     and b.point_type <> 'intermediate'
     and b.foresight is not null
     and coalesce(b.back_distance_m, 0) > 0;

  if casos is not null then
    raise exception
      'Puntos de control usados como punto de cambio en libretas compensadas: %', casos
      using hint =
        'Su cota de asentamiento cambiaría, y con ella la serie que solo recalcula computeHistory. '
        'Resuélvalo antes de migrar: ver docs/prds/18-equilibrado-y-compensacion.md, decisión 7.';
  end if;
end
$guard$;

-- --- 2. Nivelación ------------------------------------------------------------
-- La cadena se recalcula desde las distancias por visual, como en el motor, y
-- no restando la V+ al acumulado guardado: ese ya viene redondeado al metro, y
-- el total al metro también, así que la resta redondearía dos veces y movería
-- en ±1 el último decimal de la corrección. Verificado fila a fila.
--
--   anterior = Σ (V+ + V−) de las filas bm/pc ANTERIORES del recorrido
--   bm/pc        → anterior + su V−    (llega hasta el punto por su V−)
--   intermediate → anterior            (no cambia: se deja como está)
--   total        = acumulado de la última fila, como `totalDistanceFromReadings`
--
-- Las distancias guardadas son las resueltas por el motor (de los hilos si los
-- hay), y las lecturas son de cuatro decimales, así que `closure_error_mm` —la
-- cota final menos la conocida— es exacto a su décima de milímetro.

alter table public.leveling_readings disable trigger leveling_readings_reject_write_when_closed;

with cadena as (
  select id, process_id, run_type, reading_order,
         coalesce(sum(case when point_type <> 'intermediate'
                           then coalesce(back_distance_m, 0) + coalesce(fore_distance_m, 0)
                           else 0 end)
                    over (partition by process_id, run_type order by reading_order
                          rows between unbounded preceding and 1 preceding), 0)
         + case when point_type <> 'intermediate' then coalesce(fore_distance_m, 0) else 0 end
           as acumulado_m
    from public.leveling_readings
),
recorrido as (
  select id, run_type, acumulado_m,
         last_value(acumulado_m) over (partition by process_id, run_type order by reading_order
                                       rows between unbounded preceding and unbounded following)
           as total_m
    from cadena
)
update public.leveling_readings r
   set distance_accumulated_km = c.acumulado_m / 1000,
       -- Solo la ida se compensa; la vuelta conserva su corrección (nula).
       correction_applied = case
         when c.run_type = 'forward' and p.meets_tolerance
              and p.closure_error_mm is not null and c.total_m > 0
           then -(p.closure_error_mm / 1000) * c.acumulado_m / c.total_m
         else r.correction_applied
       end,
       elevation_corrected = case
         when c.run_type = 'forward' and p.meets_tolerance
              and p.closure_error_mm is not null and c.total_m > 0
           then r.elevation_calculated - (p.closure_error_mm / 1000) * c.acumulado_m / c.total_m
         else r.elevation_corrected
       end
  from recorrido c, public.leveling_processes p
 where r.id = c.id
   and p.id = r.process_id
   and not p.distances_reconstructed
   and r.point_type <> 'intermediate'
   and r.distance_accumulated_km is not null
   and coalesce(r.back_distance_m, 0) > 0;

alter table public.leveling_readings enable trigger leveling_readings_reject_write_when_closed;

-- --- 3. Libretas de las visitas de asentamientos -------------------------------
-- La misma cadena, por visita: la libreta es un solo recorrido, sin vuelta. Tiene
-- DOS triggers de inmutabilidad (visita cerrada y lugar cerrado, migración
-- 20260926000000); se desactivan los dos. Las cotas de los puntos de control
-- (settlement_readings) no cambian: salen de intermedias, y la guarda ya
-- descartó el único caso que las movería.

alter table public.settlement_book_readings disable trigger settlement_book_readings_reject_write_when_closed;
alter table public.settlement_book_readings disable trigger settlement_book_readings_reject_write_when_site_closed;

with cadena as (
  select id, visit_id, reading_order,
         coalesce(sum(case when point_type <> 'intermediate'
                           then coalesce(back_distance_m, 0) + coalesce(fore_distance_m, 0)
                           else 0 end)
                    over (partition by visit_id order by reading_order
                          rows between unbounded preceding and 1 preceding), 0)
         + case when point_type <> 'intermediate' then coalesce(fore_distance_m, 0) else 0 end
           as acumulado_m
    from public.settlement_book_readings
),
recorrido as (
  select id, acumulado_m,
         last_value(acumulado_m) over (partition by visit_id order by reading_order
                                       rows between unbounded preceding and unbounded following)
           as total_m
    from cadena
)
update public.settlement_book_readings b
   set distance_accumulated_km = c.acumulado_m / 1000,
       correction_applied = case
         when v.meets_tolerance and v.closure_error_mm is not null and c.total_m > 0
           then -(v.closure_error_mm / 1000) * c.acumulado_m / c.total_m
         else b.correction_applied
       end,
       elevation_corrected = case
         when v.meets_tolerance and v.closure_error_mm is not null and c.total_m > 0
           then b.elevation_calculated - (v.closure_error_mm / 1000) * c.acumulado_m / c.total_m
         else b.elevation_corrected
       end
  from recorrido c, public.settlement_visits v
 where b.id = c.id
   and v.id = b.visit_id
   and v.capture_mode = 'book'
   and b.point_type <> 'intermediate'
   and b.distance_accumulated_km is not null
   and coalesce(b.back_distance_m, 0) > 0;

alter table public.settlement_book_readings enable trigger settlement_book_readings_reject_write_when_closed;
alter table public.settlement_book_readings enable trigger settlement_book_readings_reject_write_when_site_closed;
