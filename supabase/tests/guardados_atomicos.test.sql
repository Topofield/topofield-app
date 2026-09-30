-- ============================================================================
-- Fase 23 — Los guardados en una transacción no dejan datos a medias
-- ============================================================================
-- Se ejecuta con `npx supabase test db` sobre la base local (pgTAP). Crea sus
-- propios datos dentro de una transacción que se deshace al final, así que no
-- depende del seed ni lo toca.
--
-- Cada función recibe una carga que falla A MITAD —una fila que viola un
-- CHECK después de escribir la cabecera—, y se comprueba que la cabecera y
-- las filas de antes no cambiaron. También que corren como el usuario (RLS):
-- otro usuario no puede escribir con ellas.
-- ============================================================================

begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(28);

-- --- Datos, como postgres (sin RLS) ------------------------------------------
insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-00000000a001', 'atomicidad@topofield.test'),
  ('00000000-0000-4000-8000-00000000a002', 'ajeno@topofield.test');

insert into public.projects (id, user_id, name, client, location) values
  ('00000000-0000-4000-8000-00000000b001', '00000000-0000-4000-8000-00000000a001',
   'Atomicidad', 'Pruebas', 'Local');

insert into public.sites (id, project_id, name, structure_type, kind) values
  ('00000000-0000-4000-8000-00000000c001', '00000000-0000-4000-8000-00000000b001',
   'Agrupación', 'otro', 'grouping'),
  ('00000000-0000-4000-8000-00000000c002', '00000000-0000-4000-8000-00000000b001',
   'Edificio', 'edificio', 'settlement'),
  ('00000000-0000-4000-8000-00000000c003', '00000000-0000-4000-8000-00000000b001',
   'Otro edificio', 'edificio', 'settlement');

insert into public.polygonal_processes
  (id, project_id, site_id, name, type, start_point_code, start_north, start_east, status)
values
  ('00000000-0000-4000-8000-00000000d001', '00000000-0000-4000-8000-00000000b001',
   '00000000-0000-4000-8000-00000000c001', 'Poligonal', 'closed', 'E1', 1000, 1000, 'calculated');
insert into public.polygonal_stations (id, process_id, station_order, point_code, north, east) values
  ('00000000-0000-4000-8000-00000000d101', '00000000-0000-4000-8000-00000000d001', 1, 'E1', 1000, 1000);
insert into public.polygonal_angle_readings (station_id, reading_order, angle_deg, angle_min, angle_sec) values
  ('00000000-0000-4000-8000-00000000d101', 1, 90, 0, 0);

insert into public.leveling_processes
  (id, project_id, site_id, name, type, start_bm_code, start_bm_elevation)
values
  ('00000000-0000-4000-8000-00000000e001', '00000000-0000-4000-8000-00000000b001',
   '00000000-0000-4000-8000-00000000c001', 'Nivelación', 'open', 'BM1', 2600);
insert into public.leveling_readings (process_id, run_type, reading_order, point_code, point_type, backsight) values
  ('00000000-0000-4000-8000-00000000e001', 'forward', 1, 'BM1', 'bm', 1.5);

insert into public.settlement_points (id, site_id, code, location_description, initial_elevation) values
  ('00000000-0000-4000-8000-00000000f001', '00000000-0000-4000-8000-00000000c002', 'P1', 'Esquina', 100),
  ('00000000-0000-4000-8000-00000000f002', '00000000-0000-4000-8000-00000000c002', 'P2', 'Centro', 100);
insert into public.settlement_visits (id, site_id, visit_number, date, operator) values
  ('00000000-0000-4000-8000-0000000f1001', '00000000-0000-4000-8000-00000000c002', 1, '2026-01-10', 'Ana'),
  ('00000000-0000-4000-8000-0000000f1002', '00000000-0000-4000-8000-00000000c002', 2, '2026-02-10', 'Ana'),
  ('00000000-0000-4000-8000-0000000f1003', '00000000-0000-4000-8000-00000000c003', 1, '2026-01-10', 'Ana');
insert into public.settlement_readings (visit_id, point_id, elevation) values
  ('00000000-0000-4000-8000-0000000f1001', '00000000-0000-4000-8000-00000000f001', 99.99),
  ('00000000-0000-4000-8000-0000000f1001', '00000000-0000-4000-8000-00000000f002', 99.98),
  ('00000000-0000-4000-8000-0000000f1002', '00000000-0000-4000-8000-00000000f001', 99.97);
insert into public.settlement_book_readings (visit_id, reading_order, point_code, point_type, backsight) values
  ('00000000-0000-4000-8000-0000000f1001', 1, 'BM', 'bm', 1.2);

-- --- Como el usuario dueño --------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-00000000a001","role":"authenticated"}', true);

-- Poligonal ------------------------------------------------------------------
select lives_ok(
  $$ select save_polygonal_process('00000000-0000-4000-8000-00000000d001',
       '{"name":"Poligonal guardada"}',
       '[{"station_order":1,"point_code":"A","readings":[
           {"reading_order":1,"angle_deg":10,"angle_min":20,"angle_sec":30},
           {"reading_order":2,"angle_deg":10,"angle_min":20,"angle_sec":31}]},
         {"station_order":2,"point_code":"B"}]') $$,
  'poligonal: guarda cabecera, estaciones y lecturas');
select is((select name from polygonal_processes where id = '00000000-0000-4000-8000-00000000d001'),
  'Poligonal guardada', 'poligonal: la cabecera cambió');
select is((select count(*)::int from polygonal_angle_readings r
             join polygonal_stations s on s.id = r.station_id
            where s.process_id = '00000000-0000-4000-8000-00000000d001' and s.point_code = 'A'),
  2, 'poligonal: las lecturas cuelgan de su estación');

select throws_ok(
  $$ select save_polygonal_process('00000000-0000-4000-8000-00000000d001',
       '{"name":"A medias"}',
       '[{"station_order":1,"point_code":"A"},
         {"station_order":2,"point_code":"B","deflection_direction":"arriba"}]') $$,
  '23514', null, 'poligonal: una estación inválida hace fallar el guardado');
select is((select name from polygonal_processes where id = '00000000-0000-4000-8000-00000000d001'),
  'Poligonal guardada', 'poligonal: la cabecera no cambió');
select is((select count(*)::int from polygonal_stations
            where process_id = '00000000-0000-4000-8000-00000000d001'),
  2, 'poligonal: las estaciones de antes siguen');

-- Georreferenciación -----------------------------------------------------------
select throws_ok(
  $$ select georeference_polygonal('00000000-0000-4000-8000-00000000d001',
       '{"start_north":5000,"start_east":5000}',
       '[{"id":"00000000-0000-4000-8000-0000000fffff","north":1,"east":1}]') $$,
  '22023', null, 'georreferenciación: una estación ajena hace fallar todo');
select is((select start_north from polygonal_processes where id = '00000000-0000-4000-8000-00000000d001'),
  1000::numeric, 'georreferenciación: la cabecera no cambió');

reset role;
update public.polygonal_processes set status = 'closed' where id = '00000000-0000-4000-8000-00000000d001';
set local role authenticated;

select lives_ok(
  $$ select georeference_polygonal('00000000-0000-4000-8000-00000000d001',
       '{"start_north":5000,"start_east":5000,"georef_point_a_code":"A","georef_point_b_code":"B"}',
       (select jsonb_agg(jsonb_build_object('id', id, 'north', 5000 + station_order, 'east', 5000))
          from polygonal_stations where process_id = '00000000-0000-4000-8000-00000000d001')) $$,
  'georreferenciación: mueve un proceso cerrado');
select is((select min(north) from polygonal_stations where process_id = '00000000-0000-4000-8000-00000000d001'),
  5001::numeric, 'georreferenciación: las estaciones se movieron');
select throws_ok(
  $$ select save_polygonal_process('00000000-0000-4000-8000-00000000d001', '{"name":"Otra"}', '[]') $$,
  '23001', null, 'poligonal: cerrada, el guardado lo rechazan los triggers');

-- Nivelación -----------------------------------------------------------------
select lives_ok(
  $$ select save_leveling_process('00000000-0000-4000-8000-00000000e001',
       '{"name":"Nivelación guardada","has_return_run":true}',
       '[{"run_type":"forward","reading_order":1,"point_code":"BM1","point_type":"bm","backsight":1.4},
         {"run_type":"return","reading_order":1,"point_code":"BM1","point_type":"bm","foresight":1.4}]') $$,
  'nivelación: guarda cabecera y lecturas');
select is((select count(*)::int from leveling_readings where process_id = '00000000-0000-4000-8000-00000000e001'),
  2, 'nivelación: las lecturas se reemplazaron');

select throws_ok(
  $$ select save_leveling_process('00000000-0000-4000-8000-00000000e001',
       '{"name":"A medias"}',
       '[{"run_type":"forward","reading_order":1,"point_code":"BM1","point_type":"bm"},
         {"run_type":"lateral","reading_order":2,"point_code":"PC1","point_type":"pc"}]') $$,
  '23514', null, 'nivelación: una lectura inválida hace fallar el guardado');
select is((select name from leveling_processes where id = '00000000-0000-4000-8000-00000000e001'),
  'Nivelación guardada', 'nivelación: la cabecera no cambió');
select is((select count(*)::int from leveling_readings where process_id = '00000000-0000-4000-8000-00000000e001'),
  2, 'nivelación: las lecturas de antes siguen');

-- Visita -----------------------------------------------------------------------
-- La carga quita la lectura de P2 (purga), cambia el operador (cabecera) y la
-- libreta, y falla en la lectura de P1: nada de eso debe quedar.
select throws_ok(
  $$ select save_visit('00000000-0000-4000-8000-0000000f1001',
       '{"operator":"Beto"}',
       '[{"reading_order":1,"point_code":"BM","point_type":"bm","backsight":1.3},
         {"reading_order":2,"point_code":"P1","point_type":"intermediate","foresight":1.1}]',
       '[{"point_id":"00000000-0000-4000-8000-00000000f001","elevation":99.95,"alert_status":"pánico"}]',
       '[]') $$,
  '23514', null, 'visita: una lectura inválida hace fallar el guardado');
select is((select operator from settlement_visits where id = '00000000-0000-4000-8000-0000000f1001'),
  'Ana', 'visita: la cabecera no cambió');
select is((select count(*)::int from settlement_readings where visit_id = '00000000-0000-4000-8000-0000000f1001'),
  2, 'visita: la lectura quitada sigue ahí');
select is((select count(*)::int from settlement_book_readings where visit_id = '00000000-0000-4000-8000-0000000f1001'),
  1, 'visita: la libreta no cambió');

select throws_ok(
  $$ select save_visit('00000000-0000-4000-8000-0000000f1001', '{}', '[]', '[]',
       '[{"visit_id":"00000000-0000-4000-8000-0000000f1003",
          "point_id":"00000000-0000-4000-8000-00000000f001","elevation":1,"alert_status":"normal"}]') $$,
  '22023', null, 'visita: la propagación no toca visitas de otro lugar');

select lives_ok(
  $$ select save_visit('00000000-0000-4000-8000-0000000f1001',
       '{"operator":"Beto","status":"calculated"}',
       '[]',
       '[{"point_id":"00000000-0000-4000-8000-00000000f001","elevation":99.95,"alert_status":"normal"}]',
       '[{"visit_id":"00000000-0000-4000-8000-0000000f1002",
          "point_id":"00000000-0000-4000-8000-00000000f001","elevation":99.97,
          "partial_settlement":-20,"alert_status":"caution"}]') $$,
  'visita: guarda purga, cabecera, libreta, lecturas y propagación');
select is((select count(*)::int from settlement_readings where visit_id = '00000000-0000-4000-8000-0000000f1001'),
  1, 'visita: la lectura quitada se purgó');
select is((select alert_status from settlement_readings
            where visit_id = '00000000-0000-4000-8000-0000000f1002'
              and point_id = '00000000-0000-4000-8000-00000000f001'),
  'caution', 'visita: la propagación reescribió la visita posterior');

-- Otro usuario -----------------------------------------------------------------
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-00000000a002","role":"authenticated"}', true);
select throws_ok(
  $$ select save_leveling_process('00000000-0000-4000-8000-00000000e001', '{"name":"Ajeno"}', '[]') $$,
  'P0002', null, 'RLS: otro usuario no encuentra el proceso');
select throws_ok(
  $$ select save_polygonal_process('00000000-0000-4000-8000-00000000d001', '{"name":"Ajeno"}', '[]') $$,
  'P0002', null, 'RLS: otro usuario no encuentra la poligonal');
select throws_ok(
  $$ select georeference_polygonal('00000000-0000-4000-8000-00000000d001', '{"start_north":1}', '[]') $$,
  'P0002', null, 'RLS: otro usuario no georreferencia');
select throws_ok(
  $$ select save_visit('00000000-0000-4000-8000-0000000f1001', '{"operator":"Ajeno"}', '[]', '[]', '[]') $$,
  'P0002', null, 'RLS: otro usuario no encuentra la visita');

select * from finish();
rollback;
