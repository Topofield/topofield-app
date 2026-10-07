-- ============================================================================
-- Fase 36 — La nivelación sin cierre, con los datos del alta (pasos 1 y 2)
-- ============================================================================
-- `npx supabase test db`. Datos propios en una transacción que se deshace.
-- ============================================================================

begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(15);

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

-- Una nivelación calculada con dos lecturas.
insert into public.leveling_processes
  (id, project_id, site_id, name, type, start_bm_code, start_bm_elevation, status)
values
  ('00000000-0000-4000-8000-00000000e361', '00000000-0000-4000-8000-00000000b361',
   '00000000-0000-4000-8000-00000000c361', 'Calculada', 'open', 'BM1', 2600, 'calculated');
insert into public.leveling_readings
  (process_id, run_type, reading_order, point_code, point_type, backsight, foresight, elevation_corrected)
values
  ('00000000-0000-4000-8000-00000000e361', 'forward', 1, 'BM1', 'bm', 1.5, null, 2600),
  ('00000000-0000-4000-8000-00000000e361', 'forward', 2, 'C1', 'pc', null, 0.266, 2601.234);


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

-- --- Sin registro de cierre (paso 2, después del merge) ---------------------
select hasnt_column('public', 'leveling_processes', 'closed_at', 'la nivelación no tiene fecha de cierre');
select hasnt_column('public', 'leveling_processes', 'closed_by', 'ni quién la cerró');

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-00000000a361","role":"authenticated"}', true);

select throws_ok(
  $$ update leveling_processes set status = 'closed' where id = '00000000-0000-4000-8000-00000000e361' $$,
  '23514', null, 'una nivelación no se cierra');
select throws_ok(
  $$ update leveling_processes set status = 'rejected' where id = '00000000-0000-4000-8000-00000000e361' $$,
  '23514', null, 'ni se rechaza');

-- --- Se edita siempre ---------------------------------------------------------
select lives_ok(
  $$ update leveling_processes set name = 'Otra' where id = '00000000-0000-4000-8000-00000000e361' $$,
  'una nivelación calculada se edita');
select lives_ok(
  $$ delete from leveling_readings
      where process_id = '00000000-0000-4000-8000-00000000e361' and reading_order = 2 $$,
  'y sus lecturas se borran');

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
