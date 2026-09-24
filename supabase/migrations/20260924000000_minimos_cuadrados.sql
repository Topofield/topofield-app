-- ============================================================================
-- Ajuste de poligonales por mínimos cuadrados — Fase 14
-- ============================================================================
-- Ver docs/prds/13-minimos-cuadrados.md.
--
-- Cuarto método de corrección, por ecuaciones de condición. Sus pesos se
-- teclean por proceso, como en la hoja de la universidad: σ angular en
-- segundos, σ de distancia en metros y número de mediciones de cada
-- distancia (el σ efectivo de una distancia es σ / √mediciones). Iguales para
-- todas las observaciones.
--
-- Los tres campos solo se exigen con este método. Correcciones y σ₀ no se
-- guardan: se recalculan (el proceso cerrado es inmutable y el informe ya
-- reconstruye la entrada del cálculo).
-- ============================================================================

alter table public.polygonal_processes
  drop constraint polygonal_processes_correction_method_check,
  add constraint polygonal_processes_correction_method_check
    check (correction_method in ('bowditch', 'transit', 'crandall', 'least_squares')),
  add column ls_sigma_angle_seconds   decimal(6,2),
  add column ls_sigma_distance_m      decimal(8,4),
  add column ls_distance_measurements int,
  add constraint polygonal_processes_ls_weights_complete
    check (
      correction_method is distinct from 'least_squares'
      or (ls_sigma_angle_seconds > 0 and ls_sigma_distance_m > 0
          and ls_distance_measurements >= 1)
    );
