-- ============================================================================
-- Fase 35 — La poligonal sin cierre, con los datos del alta
-- ============================================================================
-- `npx supabase test db`. Datos propios en una transacción que se deshace.
-- ============================================================================

begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(17);

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-00000000a351', 'sincierre@topofield.test');
insert into public.projects (id, user_id, name, client, location) values
  ('00000000-0000-4000-8000-00000000b351', '00000000-0000-4000-8000-00000000a351',
   'Sin cierre', 'Pruebas', 'Local');
insert into public.sites (id, project_id, name, structure_type, kind) values
  ('00000000-0000-4000-8000-00000000c351', '00000000-0000-4000-8000-00000000b351',
   'Agrupación', 'otro', 'grouping');
insert into public.polygonal_processes
  (id, project_id, site_id, name, type, start_point_code, start_north, start_east, status)
values
  ('00000000-0000-4000-8000-00000000d351', '00000000-0000-4000-8000-00000000b351',
   '00000000-0000-4000-8000-00000000c351', 'Poligonal', 'closed', 'E1', 1000, 1000, 'calculated');
insert into public.polygonal_stations (id, process_id, station_order, point_code, north, east) values
  ('00000000-0000-4000-8000-00000000d352', '00000000-0000-4000-8000-00000000d351', 1, 'E1', 1000, 1000);
insert into public.leveling_processes
  (id, project_id, site_id, name, type, start_bm_code, start_bm_elevation, status)
values
  ('00000000-0000-4000-8000-00000000e351', '00000000-0000-4000-8000-00000000b351',
   '00000000-0000-4000-8000-00000000c351', 'Nivelación', 'open', 'BM1', 2600, 'closed');

-- --- El esquema --------------------------------------------------------------
select has_column('public', 'polygonal_processes', 'location', 'la poligonal tiene ubicación');
select has_column('public', 'polygonal_processes', 'responsible_name', 'y responsable');
select has_column('public', 'polygonal_processes', 'responsible_role', 'y cargo del responsable');
select col_is_null('public', 'polygonal_processes', 'precision_order', 'el orden puede quedar vacío: se detecta');
select is_empty(
  $$ select 1 from pg_trigger
      where not tgisinternal
        and tgrelid::regclass::text in ('polygonal_processes', 'polygonal_stations', 'polygonal_angle_readings')
        and tgname like '%closed%' $$,
  'la poligonal ya no tiene triggers de cierre');
select isnt_empty(
  $$ select 1 from pg_trigger where tgname = 'leveling_processes_reject_update_on_closed' $$,
  'la nivelación conserva el suyo');

-- --- Una poligonal que llega cerrada se edita --------------------------------
-- Antes de la migración era inmutable; ahora el estado se cambia sin trigger.
update public.polygonal_processes set status = 'closed', start_north = 1001
 where id = '00000000-0000-4000-8000-00000000d351';
select lives_ok(
  $$ update polygonal_processes set name = 'Otra' where id = '00000000-0000-4000-8000-00000000d351' $$,
  'una poligonal marcada cerrada se renombra');
select lives_ok(
  $$ delete from polygonal_stations where process_id = '00000000-0000-4000-8000-00000000d351' $$,
  'y sus estaciones se borran');
-- La sentencia de la migración que reabre las cerradas.
update public.polygonal_processes set status = 'calculated' where status in ('closed', 'rejected');
select is(
  (select status || ':' || start_north::text from polygonal_processes
    where id = '00000000-0000-4000-8000-00000000d351'),
  'calculated:1001.0000', 'reabierta por la migración, conserva su posición');
select is(
  (select status from leveling_processes where id = '00000000-0000-4000-8000-00000000e351'),
  'closed', 'la nivelación cerrada sigue cerrada');

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-00000000a351","role":"authenticated"}', true);

select throws_ok(
  $$ update leveling_processes set name = 'Otra' where id = '00000000-0000-4000-8000-00000000e351' $$,
  '23001', null, 'la nivelación cerrada sigue siendo inmutable');

-- --- El guardado escribe lo que antes se perdía ------------------------------
select lives_ok(
  $$ select save_polygonal_process('00000000-0000-4000-8000-00000000d351',
       '{"name":"Guardada","type":"closed","start_point_code":"E1","start_north":1000,"start_east":1000,
         "has_closing_row":true,"angle_type":"exterior","precision_order":null,
         "location":"Sede Vivero","responsible_name":"Andrea Rojas","responsible_role":"Topógrafa",
         "status":"calculated","angle_readings_min":1,"angle_input_format":"dms"}',
       '[]') $$,
  'el guardado acepta las columnas nuevas');
select is((select has_closing_row from polygonal_processes where id = '00000000-0000-4000-8000-00000000d351'),
  true, 'guarda el cierre angular contra el amarre');
select is((select angle_type from polygonal_processes where id = '00000000-0000-4000-8000-00000000d351'),
  'exterior', 'guarda el tipo de ángulo detectado');
select is((select precision_order from polygonal_processes where id = '00000000-0000-4000-8000-00000000d351'),
  null, 'guarda un orden vacío');
select is((select location || '|' || responsible_name || '|' || responsible_role
             from polygonal_processes where id = '00000000-0000-4000-8000-00000000d351'),
  'Sede Vivero|Andrea Rojas|Topógrafa', 'guarda ubicación, responsable y cargo');
select is((select name from polygonal_processes where id = '00000000-0000-4000-8000-00000000d351'),
  'Guardada', 'y el resto de la cabecera, como antes');

select * from finish();
rollback;
