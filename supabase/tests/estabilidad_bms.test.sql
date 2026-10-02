-- ============================================================================
-- Fase 30 — Estabilidad de los BMs
-- ============================================================================
-- `npx supabase test db`. Datos propios en una transacción que se deshace.
--
-- La fila de la libreta de un BM de control guarda la cota que ese BM tenía en
-- el catálogo (`catalog_elevation`): `save_visit` la escribe y una visita
-- cerrada ya no la deja cambiar, aunque se corrija el catálogo.
-- ============================================================================

begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(6);

select has_column('public', 'settlement_book_readings', 'catalog_elevation',
  'la libreta tiene la cota de catálogo de los BM de control');

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-00000000a301', 'bms@topofield.test');
insert into public.projects (id, user_id, name, client, location) values
  ('00000000-0000-4000-8000-00000000b301', '00000000-0000-4000-8000-00000000a301',
   'BMs', 'Pruebas', 'Local');
insert into public.reference_points (id, project_id, code, type, elevation) values
  ('00000000-0000-4000-8000-00000000e301', '00000000-0000-4000-8000-00000000b301', 'BM-2', 'bm', 100.845);
insert into public.sites (id, project_id, name, structure_type) values
  ('00000000-0000-4000-8000-00000000c301', '00000000-0000-4000-8000-00000000b301',
   'Edificio', 'edificio');
insert into public.settlement_visits (id, site_id, visit_number, date, capture_mode) values
  ('00000000-0000-4000-8000-0000000f3101', '00000000-0000-4000-8000-00000000c301', 0, '2026-01-10', 'book');

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-00000000a301","role":"authenticated"}', true);

select lives_ok(
  $$ select save_visit('00000000-0000-4000-8000-0000000f3101',
       '{"reference_bm_code":"BM-1","reference_bm_elevation":100}',
       '[{"reading_order":1,"point_code":"BM-1","point_type":"bm","backsight":1.5},
         {"reading_order":2,"point_code":"BM-2","point_type":"pc","backsight":1.4,"foresight":0.655,
          "elevation_calculated":100.845,"catalog_elevation":100.845},
         {"reading_order":3,"point_code":"BM-1","point_type":"bm","foresight":2.245}]',
       '[]', '[]') $$,
  'save_visit guarda la libreta con la cota de catálogo');
select is(
  (select catalog_elevation from settlement_book_readings
    where visit_id = '00000000-0000-4000-8000-0000000f3101' and reading_order = 2),
  100.845::numeric, 'la fila del BM de control guarda su cota de catálogo');
select is(
  (select count(*)::int from settlement_book_readings
    where visit_id = '00000000-0000-4000-8000-0000000f3101' and catalog_elevation is null),
  2, 'las demás filas quedan sin cota de catálogo');

-- Se cierra la visita y se corrige el catálogo: la copia no cambia.
update settlement_visits set status = 'closed' where id = '00000000-0000-4000-8000-0000000f3101';
update reference_points set elevation = 100.851 where code = 'BM-2';

select throws_ok(
  $$ update settlement_book_readings set catalog_elevation = 100.851
      where visit_id = '00000000-0000-4000-8000-0000000f3101' and reading_order = 2 $$,
  null, null, 'una visita cerrada no deja cambiar la cota de catálogo');
select is(
  (select catalog_elevation from settlement_book_readings
    where visit_id = '00000000-0000-4000-8000-0000000f3101' and reading_order = 2),
  100.845::numeric, 'la visita cerrada conserva la cota con que se guardó');

select * from finish();
rollback;
