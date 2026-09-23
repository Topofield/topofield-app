-- ============================================================================
-- Cadena de distancias de nivelación — Fase 9 (N2 + N3)
-- ============================================================================
-- La distancia del recorrido deja de teclearse y pasa a derivarse de las
-- mediciones. Hasta ahora había tres campos de distancia sin relación
-- verificada entre sí, y de uno de ellos depende la tolerancia K·√D.
--
-- El caso que lo justifica es real: en la cartera de El Verjón una vista
-- intermedia rompió la cadena de sumas de la hoja de cálculo y dejó 24.7 m
-- fuera del total, con el veredicto de cierre emitido sobre ese número.
-- Ver docs/carteras/analisis-nivelacion-verjon.md.
-- ============================================================================

-- --- Columnas nuevas --------------------------------------------------------
-- Los hilos comparten tipo con las lecturas de mira, porque lecturas son. El
-- hilo MEDIO no lleva columna: es `backsight` / `foresight`. Darle una crearía
-- dos fuentes de verdad para el mismo número.
alter table public.leveling_readings
  add column back_upper_m    decimal(6,4),
  add column back_lower_m    decimal(6,4),
  add column fore_upper_m    decimal(6,4),
  add column fore_lower_m    decimal(6,4),
  -- decimal(8,3) da milímetro hasta 99999 m. La `distance_m` que se elimina
  -- era decimal(8,1), menos precisa de lo que la taquimetría produce.
  add column back_distance_m decimal(8,3),
  add column fore_distance_m decimal(8,3);

alter table public.leveling_processes
  add column distances_reconstructed boolean not null default false;

comment on column public.leveling_processes.distances_reconstructed is
  'Las distancias por visual las reconstruyó el backfill de la Fase 9 repartiendo por mitades la diferencia del acumulado. Sobre estos procesos el equilibrado de visuales NO se evalúa: saldría perfecto por construcción.';

-- --- Backfill ---------------------------------------------------------------
-- Toca filas de procesos que pueden estar cerrados, así que hay que desactivar
-- los dos triggers de inmutabilidad. Verificados contra
-- 20260812020455_leveling.sql:173 y :207.
alter table public.leveling_processes disable trigger leveling_processes_reject_update_on_closed;
alter table public.leveling_readings  disable trigger leveling_readings_reject_write_when_closed;

-- La diferencia sucesiva del acumulado da la distancia de cada armada. Cómo se
-- repartía entre la visual de atrás y la de adelante NO está en los datos: esa
-- información nunca se capturó. Se reparte por mitades y el proceso se marca.
with diffs as (
  select
    id,
    process_id,
    greatest(
      coalesce(distance_accumulated_km, 0) - coalesce(
        lag(distance_accumulated_km) over (
          partition by process_id, run_type order by reading_order
        ), 0
      ),
      0
    ) * 1000 as tramo_m
  from public.leveling_readings
  where point_type <> 'intermediate'
)
update public.leveling_readings r
set back_distance_m = round((d.tramo_m / 2)::numeric, 3),
    fore_distance_m = round((d.tramo_m / 2)::numeric, 3)
from diffs d
where r.id = d.id
  and d.tramo_m > 0;

-- Una fila terminal solo tiene visual de adelante, y una inicial solo de
-- atrás: repartir por mitades ahí inventaría una visual que no existe. Se
-- corrige tras el reparto, volcando el tramo entero a la visual que sí hay.
update public.leveling_readings
set back_distance_m = coalesce(back_distance_m, 0) + coalesce(fore_distance_m, 0),
    fore_distance_m = null
where foresight is null and backsight is not null and back_distance_m is not null;

update public.leveling_readings
set fore_distance_m = coalesce(fore_distance_m, 0) + coalesce(back_distance_m, 0),
    back_distance_m = null
where backsight is null and foresight is not null and fore_distance_m is not null;

update public.leveling_processes p
set distances_reconstructed = true
where exists (
  select 1 from public.leveling_readings r
  where r.process_id = p.id
    and (r.back_distance_m is not null or r.fore_distance_m is not null)
);

alter table public.leveling_readings  enable trigger leveling_readings_reject_write_when_closed;
alter table public.leveling_processes enable trigger leveling_processes_reject_update_on_closed;

-- --- La columna que nadie leía ---------------------------------------------
-- `distance_m` se capturaba desde la Fase 4 y ningún consumidor la leía. Su
-- sustituto son las dos distancias por visual.
alter table public.leveling_readings drop column distance_m;
