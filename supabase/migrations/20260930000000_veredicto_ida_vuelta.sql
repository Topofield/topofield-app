-- ============================================================================
-- Fase 23 — La discrepancia de ida y vuelta como veredicto guardado
-- ============================================================================
-- Ver docs/prds/22-integridad.md, secciones B y C.
--
-- El § 6.9 del PRD principal hace del emparejamiento por sección el veredicto
-- del doble recorrido. En una nivelación ABIERTA no hay cierre contra cota
-- conocida, así que `meets_tolerance` quedaba nulo aunque tuviera vuelta: el
-- hub decía «—», el informe no la mostraba y se cerraba como conforme aunque
-- la discrepancia no cumpliera.
--
--   discrepancy_tolerance_mm  T·√2 con la menor de las dos distancias
--   meets_discrepancy         discrepancia ≤ tolerancia
--
-- Se guardan con cualquier tipo que tenga vuelta. En una abierta con vuelta,
-- además, `meets_tolerance` = `meets_discrepancy` (`levelingProcessVerdict`).
--
-- Relleno solo de los procesos NO cerrados: los cerrados conservan el
-- criterio con el que se cerraron (decisión del usuario). Se calcula con lo
-- guardado —la discrepancia, la distancia de ida y el último acumulado de la
-- vuelta— y se verificó contra el motor en la base local. El trigger de
-- `updated_at` se desactiva alrededor del UPDATE: rellenar no es actividad del
-- proceso.
-- ============================================================================

alter table public.leveling_processes
  add column discrepancy_tolerance_mm decimal(8,1),
  add column meets_discrepancy        boolean;

comment on column public.leveling_processes.discrepancy_tolerance_mm is
  'Tolerancia de la discrepancia ida/vuelta: K·√D·√2, con D la menor de las dos distancias. Fase 23.';
comment on column public.leveling_processes.meets_discrepancy is
  'Discrepancia ida/vuelta dentro de su tolerancia. En una abierta con vuelta es el veredicto (meets_tolerance). Fase 23.';

alter table public.leveling_processes disable trigger leveling_processes_set_updated_at;

with vuelta as (
  select process_id, max(distance_accumulated_km) as d_vuelta
    from public.leveling_readings
   where run_type = 'return'
   group by process_id
),
calculo as (
  select p.id,
         (case p.precision_order
            when 'primer_orden'  then 3
            when 'segundo_orden' then 6
            when 'tercer_orden'  then 12
            else 24
          end) * sqrt(least(p.total_distance_km, v.d_vuelta)) * sqrt(2) as tolerancia
    from public.leveling_processes p
    join vuelta v on v.process_id = p.id
   where p.has_return_run
     and p.discrepancy_mm is not null
     and p.status not in ('closed', 'rejected')
     and p.total_distance_km > 0
     and v.d_vuelta > 0
)
update public.leveling_processes p
   set discrepancy_tolerance_mm = round(c.tolerancia::numeric, 1),
       meets_discrepancy        = p.discrepancy_mm <= c.tolerancia,
       meets_tolerance          = case
                                    when p.type = 'open' then p.discrepancy_mm <= c.tolerancia
                                    else p.meets_tolerance
                                  end
  from calculo c
 where c.id = p.id;

alter table public.leveling_processes enable trigger leveling_processes_set_updated_at;
