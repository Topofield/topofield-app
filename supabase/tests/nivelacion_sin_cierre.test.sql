-- ============================================================================
-- Fase 36 — La nivelación sin cierre, con los datos del alta
-- ============================================================================
-- `npx supabase test db`. Datos propios en una transacción que se deshace.
-- ============================================================================

begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(17);

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-00000000a361', 'nivsincierre@topofield.test');
insert into public.projects (id, user_id, name, client, location) values
  ('00000000-0000-4000-8000-00000000b361', '00000000-0000-4000-8000-00000000a361',
   'Nivelación sin cierre', 'Pruebas', 'Local');
insert into public.sites (id, project_id, name, structure_type, kind) values
  ('00000000-0000-4000-8000-00000000c361', '00000000-0000-4000-8000-00000000b361',
   'Agrupación', 'otro', 'grouping'),
  ('00000000-0000-4000-8000-00000000c362', '00000000-0000-4000-8000-00000000b361',
   'Edificio', 'edificio', 'settlement');

-- Una nivelación cerrada con dos lecturas y otra rechazada, como las deja la
-- app de antes de la fase: primero calculadas, después cerradas.
insert into public.leveling_processes
  (id, project_id, site_id, name, type, start_bm_code, start_bm_elevation, status)
values
  ('00000000-0000-4000-8000-00000000e361', '00000000-0000-4000-8000-00000000b361',
   '00000000-0000-4000-8000-00000000c361', 'Cerrada', 'open', 'BM1', 2600, 'calculated'),
  ('00000000-0000-4000-8000-00000000e362', '00000000-0000-4000-8000-00000000b361',
   '00000000-0000-4000-8000-00000000c361', 'Rechazada', 'open', 'BM1', 2600, 'calculated');
insert into public.leveling_readings
  (process_id, run_type, reading_order, point_code, point_type, backsight, foresight, elevation_corrected)
values
  ('00000000-0000-4000-8000-00000000e361', 'forward', 1, 'BM1', 'bm', 1.5, null, 2600),
  ('00000000-0000-4000-8000-00000000e361', 'forward', 2, 'C1', 'pc', null, 0.266, 2601.234);
update public.leveling_processes
   set status = 'closed', closed_at = now(), closed_by = '00000000-0000-4000-8000-00000000a361'
 where id = '00000000-0000-4000-8000-00000000e361';
update public.leveling_processes
   set status = 'rejected', closed_at = now(), closed_by = '00000000-0000-4000-8000-00000000a361'
 where id = '00000000-0000-4000-8000-00000000e362';

-- Una visita cerrada: asentamientos conserva su cierre.
insert into public.settlement_visits (id, site_id, visit_number, date) values
  ('00000000-0000-4000-8000-0000000f3610', '00000000-0000-4000-8000-00000000c362', 0, '2026-01-10');
update public.settlement_visits
   set status = 'closed', closed_at = now(), closed_by = '00000000-0000-4000-8000-00000000a361'
 where id = '00000000-0000-4000-8000-0000000f3610';

-- La sentencia de la migración que reabre lo cerrado (paso 1).
update public.leveling_processes
   set status = 'calculated'
 where status in ('closed', 'rejected');

-- --- El esquema --------------------------------------------------------------
select has_column('public', 'leveling_processes', 'location', 'la nivelación tiene ubicación');
select has_column('public', 'leveling_processes', 'responsible_name', 'y responsable');
select has_column('public', 'leveling_processes', 'responsible_role', 'y cargo del responsable');
select col_is_null('public', 'leveling_processes', 'precision_order', 'el orden puede quedar vacío: se detecta');
select is_empty(
  $$ select 1 from pg_trigger
      where tgname in ('leveling_processes_reject_update_on_closed',
                       'leveling_processes_reject_delete_when_closed',
                       'leveling_readings_reject_write_when_closed') $$,
  'la nivelación ya no tiene triggers de cierre');
select hasnt_function('public', 'reject_write_on_closed_process_reading',
  'ni la función de sus lecturas, que solo usaba ella');
select isnt_empty(
  $$ select 1 from pg_trigger where tgname = 'settlement_visits_reject_update_on_closed' $$,
  'la visita conserva el suyo');

-- --- Lo cerrado se reabre sin perder nada -----------------------------------
select is((select status from leveling_processes where id = '00000000-0000-4000-8000-00000000e361'),
  'calculated', 'la cerrada pasa a calculada');
select is((select status from leveling_processes where id = '00000000-0000-4000-8000-00000000e362'),
  'calculated', 'y la rechazada también');
select is((select count(*)::int from leveling_readings where process_id = '00000000-0000-4000-8000-00000000e361'),
  2, 'conserva sus lecturas');
select is((select elevation_corrected from leveling_readings
            where process_id = '00000000-0000-4000-8000-00000000e361' and reading_order = 2),
  2601.234::numeric, 'y sus cotas');

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-00000000a361","role":"authenticated"}', true);

-- --- Se edita siempre ---------------------------------------------------------
select lives_ok(
  $$ update leveling_processes set name = 'Otra' where id = '00000000-0000-4000-8000-00000000e361' $$,
  'una nivelación reabierta se edita');
select lives_ok(
  $$ delete from leveling_readings
      where process_id = '00000000-0000-4000-8000-00000000e361' and reading_order = 2 $$,
  'y sus lecturas se borran');
select throws_ok(
  $$ update settlement_visits set operator = 'Otro' where id = '00000000-0000-4000-8000-0000000f3610' $$,
  '23001', null, 'la visita cerrada sigue siendo inmutable');

-- --- El guardado escribe los datos del alta -----------------------------------
select lives_ok(
  $$ select save_leveling_process('00000000-0000-4000-8000-00000000e361',
       '{"name":"Guardada","location":"El Verjón","responsible_name":"Andrea Rojas",
         "responsible_role":"Topógrafa","precision_order":null,"status":"calculated"}',
       '[]') $$,
  'el guardado acepta las columnas nuevas');
select is((select location || '|' || responsible_name || '|' || responsible_role
             from leveling_processes where id = '00000000-0000-4000-8000-00000000e361'),
  'El Verjón|Andrea Rojas|Topógrafa', 'guarda ubicación, responsable y cargo');
select is((select precision_order from leveling_processes where id = '00000000-0000-4000-8000-00000000e361'),
  null, 'guarda un orden vacío');

select * from finish();
rollback;
