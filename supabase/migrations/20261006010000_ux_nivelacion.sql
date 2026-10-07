-- ============================================================================
-- Fase 36 — La nivelación como la mide el topógrafo (paso 1, antes del merge)
-- ============================================================================
-- Ver docs/prds/35-ux-nivelacion.md, § A. El paso 2, que borra closed_at y
-- closed_by, va después del merge: el código viejo los selecciona.
-- ============================================================================

-- Los datos del alta en popup (decisión 1). El orden de precisión ya no se
-- declara: se detecta al compensar, y una abierta sin vuelta no tiene orden.
alter table public.leveling_processes
  add column location         text,
  add column responsible_name text,
  add column responsible_role text,
  alter column precision_order drop not null;

-- La nivelación deja de cerrarse (decisión 14). Primero los triggers, para
-- poder reabrir las cerradas. Las funciones compartidas con lugares y visitas
-- (reject_update_on_closed_process, reject_delete_on_closed_process,
-- is_reopening) se quedan; la de las lecturas solo la usaba la nivelación.
drop trigger if exists leveling_processes_reject_update_on_closed on public.leveling_processes;
drop trigger if exists leveling_processes_reject_delete_when_closed on public.leveling_processes;
drop trigger if exists leveling_readings_reject_write_when_closed on public.leveling_readings;
drop function if exists public.reject_write_on_closed_process_reading();

update public.leveling_processes
   set status = 'calculated'
 where status in ('closed', 'rejected');

-- El guardado atómico escribe también los datos del alta. El resto, igual que
-- en 20260930010000_guardados_atomicos.sql.
create or replace function public.save_leveling_process(
  p_process_id uuid,
  p_header     jsonb,
  p_readings   jsonb
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  h public.leveling_processes;
begin
  select * into h
    from public.leveling_processes
   where id = p_process_id
     for update;
  if not found then
    raise exception 'Proceso % no encontrado.', p_process_id using errcode = 'P0002';
  end if;
  h := jsonb_populate_record(h, p_header);

  update public.leveling_processes set
    name                       = h.name,
    type                       = h.type,
    start_bm_code              = h.start_bm_code,
    start_bm_elevation         = h.start_bm_elevation,
    end_bm_code                = h.end_bm_code,
    end_bm_elevation           = h.end_bm_elevation,
    has_return_run             = h.has_return_run,
    total_distance_km          = h.total_distance_km,
    distances_reconstructed    = h.distances_reconstructed,
    precision_order            = h.precision_order,
    equipment_brand            = h.equipment_brand,
    equipment_model            = h.equipment_model,
    equipment_serial           = h.equipment_serial,
    equipment_calibration_date = h.equipment_calibration_date,
    level_type                 = h.level_type,
    km_precision_mm            = h.km_precision_mm,
    closure_error_mm           = h.closure_error_mm,
    tolerance_mm               = h.tolerance_mm,
    meets_tolerance            = h.meets_tolerance,
    forward_error_mm           = h.forward_error_mm,
    return_error_mm            = h.return_error_mm,
    discrepancy_mm             = h.discrepancy_mm,
    discrepancy_tolerance_mm   = h.discrepancy_tolerance_mm,
    meets_discrepancy          = h.meets_discrepancy,
    location                   = h.location,
    responsible_name           = h.responsible_name,
    responsible_role           = h.responsible_role,
    notes                      = h.notes,
    status                     = h.status
  where id = p_process_id;

  delete from public.leveling_readings where process_id = p_process_id;

  insert into public.leveling_readings (
    process_id, run_type, reading_order, point_code, point_type,
    backsight, foresight,
    back_upper_m, back_lower_m, fore_upper_m, fore_lower_m,
    back_distance_m, fore_distance_m, distance_accumulated_km,
    instrument_height, elevation_calculated, elevation_corrected, correction_applied
  )
  select p_process_id, r.run_type, r.reading_order, r.point_code, r.point_type,
         r.backsight, r.foresight,
         r.back_upper_m, r.back_lower_m, r.fore_upper_m, r.fore_lower_m,
         r.back_distance_m, r.fore_distance_m, r.distance_accumulated_km,
         r.instrument_height, r.elevation_calculated, r.elevation_corrected, r.correction_applied
    from jsonb_populate_recordset(
           null::public.leveling_readings,
           coalesce(p_readings, '[]'::jsonb)
         ) r;
end;
$$;

revoke execute on function public.save_leveling_process(uuid, jsonb, jsonb) from public, anon;
grant execute on function public.save_leveling_process(uuid, jsonb, jsonb) to authenticated;
