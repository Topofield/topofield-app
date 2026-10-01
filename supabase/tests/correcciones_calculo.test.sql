-- ============================================================================
-- Fase 26 — Correcciones del cálculo: lo que la base garantiza
-- ============================================================================
-- `npx supabase test db`. Datos propios en una transacción que se deshace.
-- ============================================================================

begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(6);

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-00000000a501', 'correcciones@topofield.test');
insert into public.projects (id, user_id, name, client, location) values
  ('00000000-0000-4000-8000-00000000b501', '00000000-0000-4000-8000-00000000a501',
   'Correcciones', 'Pruebas', 'Local');
insert into public.sites (id, project_id, name, structure_type, kind) values
  ('00000000-0000-4000-8000-00000000c501', '00000000-0000-4000-8000-00000000b501',
   'Agrupación', 'otro', 'grouping'),
  ('00000000-0000-4000-8000-00000000c502', '00000000-0000-4000-8000-00000000b501',
   'Torre', 'edificio', 'settlement');
insert into public.leveling_processes
  (id, project_id, site_id, name, type, start_bm_code, start_bm_elevation)
values
  ('00000000-0000-4000-8000-00000000d501', '00000000-0000-4000-8000-00000000b501',
   '00000000-0000-4000-8000-00000000c501', 'Nivelación', 'closed', 'BM-1', 100);
insert into public.settlement_visits (id, site_id, visit_number, date) values
  ('00000000-0000-4000-8000-00000000e501', '00000000-0000-4000-8000-00000000c502', 0, '2026-01-10');

-- C-11: distancias por visual mayores que cero.
select lives_ok(
  $$ insert into leveling_readings (process_id, reading_order, point_code, point_type,
                                    backsight, back_distance_m, foresight, fore_distance_m)
     values ('00000000-0000-4000-8000-00000000d501', 1, 'PC-1', 'pc', 1.2, 30.5, 1.1, 0.001) $$,
  'una distancia positiva, por pequeña que sea, se guarda');
select throws_ok(
  $$ insert into leveling_readings (process_id, reading_order, point_code, point_type,
                                    backsight, back_distance_m)
     values ('00000000-0000-4000-8000-00000000d501', 2, 'PC-2', 'pc', 1.2, 0) $$,
  '23514', null, 'una distancia en cero no se guarda');
select throws_ok(
  $$ insert into leveling_readings (process_id, reading_order, point_code, point_type,
                                    foresight, fore_distance_m)
     values ('00000000-0000-4000-8000-00000000d501', 3, 'PC-3', 'pc', 1.2, -50) $$,
  '23514', null, 'ni una negativa');
select lives_ok(
  $$ insert into leveling_readings (process_id, reading_order, point_code, point_type, foresight)
     values ('00000000-0000-4000-8000-00000000d501', 4, 'R-1', 'intermediate', 1.4) $$,
  'sin distancia, como una radiación, sí');
select throws_ok(
  $$ insert into settlement_book_readings (visit_id, reading_order, point_code, point_type,
                                           backsight, back_distance_m)
     values ('00000000-0000-4000-8000-00000000e501', 1, 'BM-1', 'bm', 1.2, -1) $$,
  '23514', null, 'la libreta de la visita, igual');
select lives_ok(
  $$ insert into settlement_book_readings (visit_id, reading_order, point_code, point_type,
                                           backsight, back_distance_m)
     values ('00000000-0000-4000-8000-00000000e501', 1, 'BM-1', 'bm', 1.2, 25) $$,
  'y con una distancia positiva se guarda');

select * from finish();
rollback;
