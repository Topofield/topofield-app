-- ============================================================================
-- Fase 37 — Los asentamientos sin cierre, los BM del lugar y los tramos
-- ============================================================================
-- `npx supabase test db`. Datos propios en una transacción que se deshace.
-- ============================================================================

begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(33);

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-00000000a371', 'asentsincierre@topofield.test'),
  ('00000000-0000-4000-8000-00000000a372', 'otro37@topofield.test');
insert into public.projects (id, user_id, name, client, location) values
  ('00000000-0000-4000-8000-00000000b371', '00000000-0000-4000-8000-00000000a371',
   'Asentamientos sin cierre', 'Pruebas', 'Local');
insert into public.sites (id, project_id, name, structure_type, kind) values
  ('00000000-0000-4000-8000-00000000c371', '00000000-0000-4000-8000-00000000b371',
   'Edificio', 'edificio', 'settlement');
insert into public.settlement_points (id, site_id, code, location_description, initial_elevation) values
  ('00000000-0000-4000-8000-00000000d371', '00000000-0000-4000-8000-00000000c371',
   'P-01', 'Columna', 100.0);
insert into public.settlement_visits (id, site_id, visit_number, date) values
  ('00000000-0000-4000-8000-00000000e371', '00000000-0000-4000-8000-00000000c371', 1, '2026-01-10');
insert into public.settlement_readings (visit_id, point_id, elevation) values
  ('00000000-0000-4000-8000-00000000e371', '00000000-0000-4000-8000-00000000d371', 99.998);
insert into public.site_benchmarks (site_id, code, elevation) values
  ('00000000-0000-4000-8000-00000000c371', 'BM-1', 101.5);

-- --- El esquema --------------------------------------------------------------
select has_table('public', 'site_benchmarks', 'existe site_benchmarks');
select col_is_unique('public', 'site_benchmarks', array['site_id', 'code'], 'un código por lugar');
select has_column('public', 'site_benchmarks', 'origin_visit_id', 'el BM dice qué visita lo midió');
select fk_ok('public', 'site_benchmarks', 'origin_visit_id', 'public', 'settlement_visits', 'id', 'y apunta a la visita');
select has_column('public', 'settlement_book_readings', 'starts_section', 'la fila marca el inicio de un tramo');
select col_is_null('public', 'settlement_visits', 'precision_order', 'la visita sin verificar no tiene orden');
select is_empty(
  $$ select 1 from pg_trigger
      where tgname in ('settlement_visits_reject_update_on_closed',
                       'settlement_visits_reject_delete_when_closed',
                       'settlement_visits_reject_write_when_site_closed',
                       'sites_reject_update_on_closed',
                       'sites_reject_delete_when_closed') $$,
  'ni la visita ni el lugar tienen triggers de cierre');
select is_empty(
  $$ select 1 from pg_trigger
      where tgname in ('settlement_readings_reject_write_when_closed',
                       'settlement_readings_reject_write_when_site_closed',
                       'settlement_book_readings_reject_write_when_closed',
                       'settlement_book_readings_reject_write_when_site_closed',
                       'settlement_points_reject_write_when_site_closed') $$,
  'ni sus lecturas, su libreta o sus puntos');
select hasnt_trigger('public', 'settlement_points',
  'settlement_points_reject_reference_change_with_closed_readings', 'la C0 no se fija');
select hasnt_function('public', 'reject_write_on_closed_visit_reading', 'fuera la función de las lecturas cerradas');
select hasnt_function('public', 'reject_reference_change_with_closed_readings', 'y la de la C0');

-- --- Paso 2: fuera las columnas de cierre y las funciones de inmutabilidad --------
select hasnt_column('public', 'settlement_visits', 'closed_at', 'la visita no tiene closed_at');
select hasnt_column('public', 'settlement_visits', 'closed_by', 'ni closed_by');
select hasnt_column('public', 'settlement_visits', 'weather_conditions', 'ni el clima');
select hasnt_column('public', 'settlement_visits', 'capture_mode', 'ni el modo de captura');
select hasnt_column('public', 'sites', 'status', 'el lugar no tiene estado');
select hasnt_column('public', 'sites', 'closed_at', 'ni closed_at');
select hasnt_column('public', 'sites', 'closed_by', 'ni closed_by');
select hasnt_function('public', 'reject_update_on_closed_process', 'fuera la función de inmutabilidad');
select hasnt_function('public', 'reject_delete_on_closed_process', 'y la del borrado');
select hasnt_function('public', 'is_reopening', array['jsonb', 'jsonb'], 'y la de reabrir');

-- --- Como el dueño -------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-00000000a371","role":"authenticated"}', true);

select lives_ok(
  $$ update settlement_visits set status = 'in_progress' where id = '00000000-0000-4000-8000-00000000e371' $$,
  'una visita queda en medición');
select lives_ok(
  $$ update settlement_points set initial_elevation = 100.5 where id = '00000000-0000-4000-8000-00000000d371' $$,
  'la C0 se cambia aunque el punto tenga lecturas');
select lives_ok(
  $$ select save_visit('00000000-0000-4000-8000-00000000e371',
       '{"date":"2026-01-10","status":"in_progress"}'::jsonb,
       '[{"reading_order":1,"point_code":"BM-1","point_type":"bm","starts_section":true,"backsight":1.2},
         {"reading_order":2,"point_code":"P-01","point_type":"intermediate","foresight":null}]'::jsonb,
       '[]'::jsonb, '[]'::jsonb) $$,
  'save_visit guarda filas sin lectura');
select is(
  (select starts_section from settlement_book_readings
    where visit_id = '00000000-0000-4000-8000-00000000e371' and reading_order = 1),
  true, 'guarda el inicio del tramo');
select is(
  (select starts_section from settlement_book_readings
    where visit_id = '00000000-0000-4000-8000-00000000e371' and reading_order = 2),
  false, 'sin el campo, false');
select is(
  (select status from settlement_visits where id = '00000000-0000-4000-8000-00000000e371'),
  'in_progress', 'save_visit guarda la visita en medición');
select throws_ok(
  $$ insert into site_benchmarks (site_id, code, elevation)
     values ('00000000-0000-4000-8000-00000000c371', 'BM-1', 1) $$,
  '23505', null, 'un código repetido en el lugar se rechaza');
select lives_ok(
  $$ insert into site_benchmarks (site_id, code, elevation)
     values ('00000000-0000-4000-8000-00000000c371', 'BM-2', 100.845) $$,
  'el dueño agrega un BM a su lugar');
select throws_ok(
  $$ update settlement_visits set status = 'closed' where id = '00000000-0000-4000-8000-00000000e371' $$,
  '23514', null, 'una visita ya no se cierra: el estado no admite closed');
select lives_ok(
  $$ delete from settlement_visits where id = '00000000-0000-4000-8000-00000000e371' $$,
  'cualquier visita se borra');

-- --- Como otro usuario ---------------------------------------------------------
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-00000000a372","role":"authenticated"}', true);
select is_empty($$ select 1 from site_benchmarks $$, 'otro usuario no ve los BM del lugar');
select throws_ok(
  $$ insert into site_benchmarks (site_id, code, elevation)
     values ('00000000-0000-4000-8000-00000000c371', 'BM-9', 1) $$,
  '42501', null, 'ni los agrega');

select * from finish();
rollback;
