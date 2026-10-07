-- ============================================================================
-- Fase 34 — Reabrir procesos
-- ============================================================================
-- `npx supabase test db`. Datos propios en una transacción que se deshace.
-- ============================================================================

begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(13);

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

insert into public.settlement_points (id, site_id, code, location_description, initial_elevation) values
  ('00000000-0000-4000-8000-00000000f341', '00000000-0000-4000-8000-00000000c342', 'P1', 'Esquina', 100);
insert into public.settlement_visits (id, site_id, visit_number, date) values
  ('00000000-0000-4000-8000-0000000f3410', '00000000-0000-4000-8000-00000000c342', 0, '2026-01-10');
insert into public.settlement_readings (visit_id, point_id, elevation) values
  ('00000000-0000-4000-8000-0000000f3410', '00000000-0000-4000-8000-00000000f341', 100);

-- Todo cerrado como lo deja la app: estado, fecha y responsable. La visita
-- antes que el lugar: con el lugar cerrado ya no se escribe. La poligonal no
-- se cierra desde la Fase 35 (poligonal_sin_cierre.test.sql), ni la nivelación
-- desde la 36 (nivelacion_sin_cierre.test.sql).
update public.settlement_visits
   set status = 'closed', closed_at = now(), closed_by = '00000000-0000-4000-8000-00000000a341'
 where id = '00000000-0000-4000-8000-0000000f3410';
update public.sites
   set status = 'closed', closed_at = now(), closed_by = '00000000-0000-4000-8000-00000000a341'
 where id = '00000000-0000-4000-8000-00000000c342';

-- Quién ejecuta el helper: los triggers corren con el rol de la sesión, así
-- que `authenticated` lo necesita; `anon` no (convención de los guardados).
select ok(
  not has_function_privilege('anon', 'public.is_reopening(jsonb, jsonb)', 'execute'),
  'anon no ejecuta is_reopening');
select ok(
  has_function_privilege('authenticated', 'public.is_reopening(jsonb, jsonb)', 'execute'),
  'authenticated sí ejecuta is_reopening: los triggers la usan');

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-00000000a341","role":"authenticated"}', true);

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
