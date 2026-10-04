-- ============================================================================
-- Fase 34 — Reabrir procesos
-- ============================================================================
-- `npx supabase test db`. Datos propios en una transacción que se deshace.
-- ============================================================================

begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(25);

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-00000000a341', 'reabrir@topofield.test');
insert into public.projects (id, user_id, name, client, location) values
  ('00000000-0000-4000-8000-00000000b341', '00000000-0000-4000-8000-00000000a341',
   'Reabrir', 'Pruebas', 'Local');
insert into public.sites (id, project_id, name, structure_type, kind) values
  ('00000000-0000-4000-8000-00000000c341', '00000000-0000-4000-8000-00000000b341',
   'Agrupación', 'otro', 'grouping'),
  ('00000000-0000-4000-8000-00000000c342', '00000000-0000-4000-8000-00000000b341',
   'Edificio', 'edificio', 'settlement');

insert into public.polygonal_processes
  (id, project_id, site_id, name, type, start_point_code, start_north, start_east, status)
values
  ('00000000-0000-4000-8000-00000000d341', '00000000-0000-4000-8000-00000000b341',
   '00000000-0000-4000-8000-00000000c341', 'Poligonal', 'closed', 'E1', 1000, 1000, 'calculated');
insert into public.polygonal_stations (id, process_id, station_order, point_code, north, east) values
  ('00000000-0000-4000-8000-00000000d342', '00000000-0000-4000-8000-00000000d341', 1, 'E1', 1000, 1000);

insert into public.leveling_processes
  (id, project_id, site_id, name, type, start_bm_code, start_bm_elevation)
values
  ('00000000-0000-4000-8000-00000000e341', '00000000-0000-4000-8000-00000000b341',
   '00000000-0000-4000-8000-00000000c341', 'Nivelación', 'open', 'BM1', 2600);
insert into public.leveling_readings (process_id, run_type, reading_order, point_code, point_type, backsight) values
  ('00000000-0000-4000-8000-00000000e341', 'forward', 1, 'BM1', 'bm', 1.5);

insert into public.settlement_points (id, site_id, code, location_description, initial_elevation) values
  ('00000000-0000-4000-8000-00000000f341', '00000000-0000-4000-8000-00000000c342', 'P1', 'Esquina', 100);
insert into public.settlement_visits (id, site_id, visit_number, date) values
  ('00000000-0000-4000-8000-0000000f3410', '00000000-0000-4000-8000-00000000c342', 0, '2026-01-10');
insert into public.settlement_readings (visit_id, point_id, elevation) values
  ('00000000-0000-4000-8000-0000000f3410', '00000000-0000-4000-8000-00000000f341', 100);

-- Todo cerrado como lo deja la app: estado, fecha y responsable. La visita
-- antes que el lugar: con el lugar cerrado ya no se escribe.
update public.polygonal_processes
   set status = 'closed', closed_at = now(), closed_by = '00000000-0000-4000-8000-00000000a341'
 where id = '00000000-0000-4000-8000-00000000d341';
update public.leveling_processes
   set status = 'rejected', closed_at = now(), closed_by = '00000000-0000-4000-8000-00000000a341'
 where id = '00000000-0000-4000-8000-00000000e341';
update public.settlement_visits
   set status = 'closed', closed_at = now(), closed_by = '00000000-0000-4000-8000-00000000a341'
 where id = '00000000-0000-4000-8000-0000000f3410';
update public.sites
   set status = 'closed', closed_at = now(), closed_by = '00000000-0000-4000-8000-00000000a341'
 where id = '00000000-0000-4000-8000-00000000c342';

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-00000000a341","role":"authenticated"}', true);

-- --- Poligonal cerrada ------------------------------------------------------
select throws_ok(
  $$ update polygonal_processes set name = 'Otra' where id = '00000000-0000-4000-8000-00000000d341' $$,
  '23001', null, 'poligonal cerrada: un cambio normal sigue rechazado');
select throws_ok(
  $$ update polygonal_processes set status = 'calculated', closed_at = null, closed_by = null, name = 'Otra'
      where id = '00000000-0000-4000-8000-00000000d341' $$,
  '23001', null, 'poligonal: reabrir y cambiar otra columna a la vez se rechaza');
select throws_ok(
  $$ update polygonal_processes set status = 'calculated' where id = '00000000-0000-4000-8000-00000000d341' $$,
  '23001', null, 'poligonal: reabrir sin borrar el registro de cierre se rechaza');
select lives_ok(
  $$ update polygonal_processes set start_north = 1001 where id = '00000000-0000-4000-8000-00000000d341' $$,
  'poligonal cerrada: la posición se sigue georreferenciando (Fase 15)');
select throws_ok(
  $$ insert into polygonal_stations (process_id, station_order, point_code, north, east)
     values ('00000000-0000-4000-8000-00000000d341', 2, 'E2', 1010, 1010) $$,
  '23001', null, 'poligonal cerrada: sus estaciones siguen inmutables');
select lives_ok(
  $$ update polygonal_processes set status = 'calculated', closed_at = null, closed_by = null
      where id = '00000000-0000-4000-8000-00000000d341' $$,
  'poligonal: reabrir pasa');
select is(
  (select status || ':' || coalesce(closed_by, '-') || ':' || start_north::text
     from polygonal_processes where id = '00000000-0000-4000-8000-00000000d341'),
  'calculated:-:1001.0000', 'poligonal reabierta: calculada, sin responsable y con su posición');
select lives_ok(
  $$ update polygonal_processes set name = 'Otra' where id = '00000000-0000-4000-8000-00000000d341' $$,
  'poligonal reabierta: se edita');
select lives_ok(
  $$ insert into polygonal_stations (process_id, station_order, point_code, north, east)
     values ('00000000-0000-4000-8000-00000000d341', 2, 'E2', 1010, 1010) $$,
  'poligonal reabierta: sus estaciones también');

-- --- Nivelación rechazada ---------------------------------------------------
select throws_ok(
  $$ delete from leveling_processes where id = '00000000-0000-4000-8000-00000000e341' $$,
  '23001', null, 'nivelación rechazada: no se borra');
select throws_ok(
  $$ update leveling_processes set status = 'calculated', closed_at = null, closed_by = null,
            start_bm_elevation = 2601 where id = '00000000-0000-4000-8000-00000000e341' $$,
  '23001', null, 'nivelación: reabrir y cambiar otra columna a la vez se rechaza');
select throws_ok(
  $$ update leveling_processes set status = 'closed' where id = '00000000-0000-4000-8000-00000000e341' $$,
  '23001', null, 'nivelación rechazada: no pasa a cerrada sin reabrirse');
select lives_ok(
  $$ update leveling_processes set status = 'calculated', closed_at = null, closed_by = null
      where id = '00000000-0000-4000-8000-00000000e341' $$,
  'nivelación rechazada: reabrir pasa');
select lives_ok(
  $$ insert into leveling_readings (process_id, reading_order, point_code, point_type, foresight)
     values ('00000000-0000-4000-8000-00000000e341', 2, 'R-1', 'intermediate', 1.4) $$,
  'nivelación reabierta: admite lecturas');

-- --- Lugar y visita ---------------------------------------------------------
select throws_ok(
  $$ update settlement_visits set status = 'calculated', closed_at = null, closed_by = null
      where id = '00000000-0000-4000-8000-0000000f3410' $$,
  '23001', null, 'con el lugar cerrado, la visita no se reabre');
select throws_ok(
  $$ update sites set name = 'Otro' where id = '00000000-0000-4000-8000-00000000c342' $$,
  '23001', null, 'lugar cerrado: un cambio normal sigue rechazado');
select throws_ok(
  $$ update sites set status = 'active', closed_at = null, closed_by = null, name = 'Otro'
      where id = '00000000-0000-4000-8000-00000000c342' $$,
  '23001', null, 'lugar: reabrir y cambiar otra columna a la vez se rechaza');
select lives_ok(
  $$ update sites set status = 'active', closed_at = null, closed_by = null
      where id = '00000000-0000-4000-8000-00000000c342' $$,
  'lugar: reabrir pasa');
select is(
  (select status from settlement_visits where id = '00000000-0000-4000-8000-0000000f3410'),
  'closed', 'reabrir el lugar no reabre sus visitas');
select throws_ok(
  $$ update settlement_readings set elevation = 99.99
      where visit_id = '00000000-0000-4000-8000-0000000f3410' $$,
  '23001', null, 'la visita sigue cerrada: sus lecturas no cambian');
select throws_ok(
  $$ update settlement_visits set status = 'calculated', closed_at = null, closed_by = null, operator = 'Otro'
      where id = '00000000-0000-4000-8000-0000000f3410' $$,
  '23001', null, 'visita: reabrir y cambiar otra columna a la vez se rechaza');
select throws_ok(
  $$ update settlement_visits set status = 'calculated' where id = '00000000-0000-4000-8000-0000000f3410' $$,
  '23001', null, 'visita: reabrir sin borrar el registro de cierre se rechaza');
select lives_ok(
  $$ update settlement_visits set status = 'calculated', closed_at = null, closed_by = null
      where id = '00000000-0000-4000-8000-0000000f3410' $$,
  'con el lugar abierto, la visita se reabre');
select lives_ok(
  $$ update settlement_readings set elevation = 99.99
      where visit_id = '00000000-0000-4000-8000-0000000f3410' $$,
  'visita reabierta: sus lecturas cambian');
select lives_ok(
  $$ update settlement_points set initial_elevation = 100.01
      where id = '00000000-0000-4000-8000-00000000f341' $$,
  'sin visitas cerradas que lo midan, la C0 del punto vuelve a cambiar');

select * from finish();
rollback;
