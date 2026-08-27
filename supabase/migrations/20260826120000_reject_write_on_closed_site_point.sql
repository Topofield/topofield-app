-- ============================================================================
-- El catálogo de puntos de un lugar cerrado también es inmutable — en la base
-- ============================================================================
-- `20260825230000_reject_write_on_closed_site.sql` blindó las visitas y las
-- lecturas de un lugar cerrado, pero dejó fuera `settlement_points`: era la
-- única tabla del modelo de inmutabilidad sin trigger de base. La defensa de
-- aplicación existe y es correcta (`loadOpenSite` en `point-actions.ts` rechaza
-- el lugar cerrado al crear/editar/borrar puntos), pero es exactamente la capa
-- que el modelo de seguridad del proyecto considera bypasseable: la clave
-- publicable es pública por diseño, así que cualquier sesión válida puede
-- llamar a la API REST y saltarse las Server Actions.
--
-- El hueco no era cosmético. El asentamiento acumulado NO se lee de lo
-- persistido: se recalcula siempre en vivo como `(cota − C0) × 1000`
-- (`src/lib/calculations/settlement.ts`), tanto en el panel de análisis como en
-- la exportación a Excel. Alterar `initial_elevation` (la C0) de un punto
-- reescribe retroactivamente TODO el histórico mostrado de un lugar que la
-- interfaz presenta como cerrado — el registro trazable que el módulo existe
-- para proteger. Reproducido vía REST directo contra el lugar cerrado:
-- HTTP 204 y el acumulado de la visita 5 pasó de -8.5 mm a +4991.5 mm.
--
-- Se mira el `status` del lugar por el `site_id` de la fila (NEW en INSERT y
-- UPDATE, OLD en DELETE), igual que hace `reject_write_on_closed_site_visit`.
--
-- Nota sobre el borrado en cascada: `settlement_points` cuelga de `sites` con
-- `on delete cascade`, pero borrar un lugar cerrado ya lo impide
-- `reject_delete_on_closed_process` disparando en `sites`, así que este trigger
-- no bloquea ningún borrado legítimo. Borrar un lugar ABIERTO sigue
-- funcionando: su status no es 'closed' y la cascada pasa sin más.
-- ============================================================================

create or replace function public.reject_write_on_closed_site_point()
returns trigger
language plpgsql
as $$
declare
  target_site uuid := coalesce(new.site_id, old.site_id);
  site_status text;
begin
  select status into site_status
  from public.sites
  where id = target_site;

  if site_status = 'closed' then
    raise exception
      'El lugar % está cerrado; su catálogo de puntos es inmutable.', target_site
      using errcode = 'restrict_violation';
  end if;

  return coalesce(new, old);
end;
$$;

drop trigger if exists settlement_points_reject_write_when_site_closed
  on public.settlement_points;

create trigger settlement_points_reject_write_when_site_closed
  before insert or update or delete on public.settlement_points
  for each row execute function public.reject_write_on_closed_site_point();
