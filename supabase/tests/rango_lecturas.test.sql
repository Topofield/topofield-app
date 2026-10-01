-- ============================================================================
-- Fase 24 — Una lectura de ángulo fuera de rango no se guarda
-- ============================================================================
-- `npx supabase test db`. Datos propios en una transacción que se deshace.
-- ============================================================================

begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(7);

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-00000000a301', 'rango@topofield.test');
insert into public.projects (id, user_id, name, client, location) values
  ('00000000-0000-4000-8000-00000000b301', '00000000-0000-4000-8000-00000000a301',
   'Rango', 'Pruebas', 'Local');
insert into public.sites (id, project_id, name, structure_type, kind) values
  ('00000000-0000-4000-8000-00000000c301', '00000000-0000-4000-8000-00000000b301',
   'Agrupación', 'otro', 'grouping');
insert into public.polygonal_processes
  (id, project_id, site_id, name, type, start_point_code, start_north, start_east)
values
  ('00000000-0000-4000-8000-00000000d301', '00000000-0000-4000-8000-00000000b301',
   '00000000-0000-4000-8000-00000000c301', 'Poligonal', 'closed', 'E1', 1000, 1000);

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-00000000a301","role":"authenticated"}', true);

select lives_ok(
  $$ select save_polygonal_process('00000000-0000-4000-8000-00000000d301', '{}',
       '[{"station_order":1,"point_code":"A","readings":[
           {"reading_order":1,"angle_deg":0,"angle_min":0,"angle_sec":0},
           {"reading_order":2,"angle_deg":359,"angle_min":59,"angle_sec":59.9},
           {"reading_order":3,"angle_deg":360,"angle_min":0,"angle_sec":0}]}]') $$,
  'los límites del rango se guardan, y 360°00′00″ exacto');

select throws_ok(
  $$ select save_polygonal_process('00000000-0000-4000-8000-00000000d301', '{}',
       '[{"station_order":1,"point_code":"A","readings":[
           {"reading_order":1,"angle_deg":90,"angle_min":0,"angle_sec":65}]}]') $$,
  '23514', null, '65 segundos no se guardan');
select throws_ok(
  $$ select save_polygonal_process('00000000-0000-4000-8000-00000000d301', '{}',
       '[{"station_order":1,"point_code":"A","readings":[
           {"reading_order":1,"angle_deg":90,"angle_min":60,"angle_sec":0}]}]') $$,
  '23514', null, '60 minutos no se guardan');
select throws_ok(
  $$ select save_polygonal_process('00000000-0000-4000-8000-00000000d301', '{}',
       '[{"station_order":1,"point_code":"A","readings":[
           {"reading_order":1,"angle_deg":360,"angle_min":0,"angle_sec":1}]}]') $$,
  '23514', null, 'más de 360° no se guarda');
select throws_ok(
  $$ select save_polygonal_process('00000000-0000-4000-8000-00000000d301', '{}',
       '[{"station_order":1,"point_code":"A","readings":[
           {"reading_order":1,"angle_deg":361,"angle_min":0,"angle_sec":0}]}]') $$,
  '23514', null, '361 grados no se guardan');
select throws_ok(
  $$ select save_polygonal_process('00000000-0000-4000-8000-00000000d301', '{}',
       '[{"station_order":1,"point_code":"A","readings":[
           {"reading_order":1,"angle_deg":90,"angle_min":0,"angle_sec":-1}]}]') $$,
  '23514', null, 'segundos negativos no se guardan');

select is(
  (select count(*)::int from polygonal_angle_readings r
     join polygonal_stations s on s.id = r.station_id
    where s.process_id = '00000000-0000-4000-8000-00000000d301'),
  3, 'tras los rechazos siguen las tres lecturas válidas');

select * from finish();
rollback;
