-- ============================================================================
-- Fase 29 — Puntos de control sin posición
-- ============================================================================
-- Ver docs/prds/28-puntos-sin-posicion.md.
--
-- Los puntos de control de asentamientos dejan de tener posición: sin Norte ni
-- Este no hay distancia entre puntos, y sin distancia no hay distorsión
-- angular ni diferenciales. Se borran sus columnas y el límite 1/X del lugar.
-- Es irreversible (decisión 3 del usuario).
--
-- El trigger de la Fase 23 nombra las coordenadas en su `update of` y en su
-- `when`: se quita antes de borrarlas y se recrea solo sobre la C0, lo único
-- que alimenta el acumulado. La función conserva su nombre; cambia el mensaje.
--
-- Al final, BM-1 y BM-2 de los proyectos de ejemplo pierden sus coordenadas
-- ficticias (decisión 7): la nivelación solo lee su cota. Se reconocen por su
-- huella completa —código, descripción, Norte y Este—, la misma desde que
-- entraron en la demo; un BM real del usuario no coincide en las cuatro.
--
-- Despliegue: esta migración va DESPUÉS del merge (PRD, hallazgo 3). El código
-- nuevo funciona con el esquema viejo; el viejo no funciona con este.
-- ============================================================================

drop trigger settlement_points_reject_reference_change_with_closed_readings
  on public.settlement_points;

alter table public.settlement_points
  drop column northing,
  drop column easting;

alter table public.sites
  drop column angular_distortion_limit;

create or replace function public.reject_reference_change_with_closed_readings()
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
      'El punto % tiene lecturas en la visita cerrada %: su C0 no cambia.',
      new.code, v_visit
      using errcode = 'restrict_violation';
  end if;

  return new;
end;
$$;

create trigger settlement_points_reject_reference_change_with_closed_readings
  before update of initial_elevation on public.settlement_points
  for each row
  when (old.initial_elevation is distinct from new.initial_elevation)
  execute function public.reject_reference_change_with_closed_readings();

update public.reference_points
   set north = null,
       east = null
 where (code, description, north, east) in (
   ('BM-1', 'BM de amarre de Torre Alameda (andén norte)', 5000, 5000),
   ('BM-2', 'BM de amarre alterno de Torre Alameda (portería)', 5040, 5060)
 );
