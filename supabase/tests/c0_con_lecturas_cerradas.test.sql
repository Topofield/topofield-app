-- ============================================================================
-- Fase 23 — La C0 de un punto con lecturas cerradas
-- ============================================================================
-- `npx supabase test db`. Datos propios en una transacción que se deshace.
-- Desde la Fase 29 los puntos no tienen coordenadas: el trigger vigila solo la
-- C0, y las columnas de la posición ya no existen.
-- ============================================================================

begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(8);

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-00000000a101', 'c0@topofield.test');
insert into public.projects (id, user_id, name, client, location) values
  ('00000000-0000-4000-8000-00000000b101', '00000000-0000-4000-8000-00000000a101',
   'C0', 'Pruebas', 'Local');
insert into public.sites (id, project_id, name, structure_type) values
  ('00000000-0000-4000-8000-00000000c101', '00000000-0000-4000-8000-00000000b101',
   'Edificio', 'edificio');
insert into public.settlement_points (id, site_id, code, location_description, initial_elevation) values
  ('00000000-0000-4000-8000-00000000f101', '00000000-0000-4000-8000-00000000c101', 'P1', 'Esquina', 100),
  ('00000000-0000-4000-8000-00000000f102', '00000000-0000-4000-8000-00000000c101', 'P2', 'Centro', 100);
insert into public.settlement_visits (id, site_id, visit_number, date) values
  ('00000000-0000-4000-8000-0000000f1101', '00000000-0000-4000-8000-00000000c101', 0, '2026-01-10'),
  ('00000000-0000-4000-8000-0000000f1102', '00000000-0000-4000-8000-00000000c101', 1, '2026-02-10');
-- P1 se midió en la visita 0, que se cierra; P2 solo en la 1, abierta.
insert into public.settlement_readings (visit_id, point_id, elevation) values
  ('00000000-0000-4000-8000-0000000f1101', '00000000-0000-4000-8000-00000000f101', 100),
  ('00000000-0000-4000-8000-0000000f1102', '00000000-0000-4000-8000-00000000f102', 99.99);
update public.settlement_visits set status = 'closed'
 where id = '00000000-0000-4000-8000-0000000f1101';

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-00000000a101","role":"authenticated"}', true);

select throws_ok(
  $$ update settlement_points set initial_elevation = 100.01 where code = 'P1' $$,
  '23001', 'El punto P1 tiene lecturas en la visita cerrada 0: su C0 no cambia.',
  'con lectura cerrada: la C0 no cambia');
select lives_ok(
  $$ update settlement_points set code = 'P1-A', location_description = 'Esquina NW' where code = 'P1' $$,
  'con lectura cerrada: el código y la ubicación sí cambian');
select lives_ok(
  $$ update settlement_points set initial_elevation = 100 where code = 'P1-A' $$,
  'con lectura cerrada: reescribir el mismo valor no es un cambio');
select lives_ok(
  $$ update settlement_points set initial_elevation = 100.02 where code = 'P2' $$,
  'solo con lecturas abiertas: la C0 cambia');
select is(
  (select initial_elevation from settlement_points where code = 'P2'),
  100.02::numeric, 'solo con lecturas abiertas: el cambio quedó');

select hasnt_column('public', 'settlement_points', 'northing', 'el punto no tiene Norte');
select hasnt_column('public', 'settlement_points', 'easting', 'el punto no tiene Este');
select hasnt_column('public', 'sites', 'angular_distortion_limit', 'el lugar no tiene límite de distorsión');

select * from finish();
rollback;
