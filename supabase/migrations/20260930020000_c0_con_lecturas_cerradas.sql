-- ============================================================================
-- Fase 23 — La C0 y las coordenadas de un punto con lecturas cerradas
-- ============================================================================
-- Ver docs/prds/22-integridad.md, sección D.
--
-- El asentamiento acumulado es (cota − C0) × 1000 y las coordenadas del punto
-- alimentan la distorsión angular. Si la C0 de un punto cambiaba después de
-- cerrar una visita que lo midió, el panel y el informe —que recalculan en
-- vivo— dejaban de dar los números con los que esa visita se cerró. La visita
-- es inmutable, pero su resultado dependía de una fila que no lo era.
--
-- El trigger rechaza cambiar `initial_elevation`, `northing` o `easting` si el
-- punto tiene alguna lectura en una visita cerrada. El código y la ubicación
-- se siguen pudiendo cambiar: renombrar no altera ningún resultado. La acción
-- `savePointAction` lo comprueba antes con un mensaje claro; esto garantiza la
-- regla aunque se la salte (PRD, decisión 7).
-- ============================================================================

create function public.reject_reference_change_with_closed_readings()
returns trigger
language plpgsql
as $$
declare
  v_visit int;
begin
  select v.visit_number into v_visit
    from public.settlement_readings r
    join public.settlement_visits v on v.id = r.visit_id
   where r.point_id = new.id
     and v.status = 'closed'
   order by v.visit_number
   limit 1;

  if v_visit is not null then
    raise exception
      'El punto % tiene lecturas en la visita cerrada %: su C0 y sus coordenadas no cambian.',
      new.code, v_visit
      using errcode = 'restrict_violation';
  end if;

  return new;
end;
$$;

create trigger settlement_points_reject_reference_change_with_closed_readings
  before update of initial_elevation, northing, easting on public.settlement_points
  for each row
  when (old.initial_elevation is distinct from new.initial_elevation
     or old.northing is distinct from new.northing
     or old.easting is distinct from new.easting)
  execute function public.reject_reference_change_with_closed_readings();
