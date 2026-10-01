-- ============================================================================
-- Fase 25 — Catálogo de equipos
-- ============================================================================
-- `npx supabase test db`. Datos propios en una transacción que se deshace.
-- ============================================================================

begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(11);

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-00000000a401', 'equipos@topofield.test'),
  ('00000000-0000-4000-8000-00000000a402', 'otro@topofield.test');
insert into public.projects (id, user_id, name, client, location) values
  ('00000000-0000-4000-8000-00000000b401', '00000000-0000-4000-8000-00000000a401',
   'Equipos', 'Pruebas', 'Local');
insert into public.sites (id, project_id, name, structure_type, kind) values
  ('00000000-0000-4000-8000-00000000c401', '00000000-0000-4000-8000-00000000b401',
   'Agrupación', 'otro', 'grouping');

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-00000000a401","role":"authenticated"}', true);

select lives_ok(
  $$ insert into equipment (id, kind, brand, model, serial, angular_precision_seconds,
                            distance_precision_mm, distance_precision_ppm)
     values ('00000000-0000-4000-8000-00000000e401', 'total_station', 'Leica', 'TS06 Plus',
             'LCS-1', 5, 1.5, 2) $$,
  'una estación total se da de alta, con el dueño por defecto');
select is((select user_id from equipment where id = '00000000-0000-4000-8000-00000000e401'),
  '00000000-0000-4000-8000-00000000a401'::uuid, 'el dueño es quien la crea');

select lives_ok(
  $$ insert into equipment (kind, brand, model, level_type, km_precision_mm)
     values ('level', 'Trimble', 'DiNi 12', 'digital', 0.3) $$,
  'un nivel se da de alta');

select throws_ok(
  $$ insert into equipment (kind, brand, level_type) values ('total_station', 'Leica', 'digital') $$,
  '23514', null, 'una estación total no lleva campos de nivel');
select throws_ok(
  $$ insert into equipment (kind, brand, angular_precision_seconds) values ('level', 'Leica', 5) $$,
  '23514', null, 'un nivel no lleva campos de estación total');
select throws_ok(
  $$ insert into equipment (kind, serial) values ('level', 'S/N 1') $$,
  '23514', null, 'sin marca ni modelo no se da de alta');
select throws_ok(
  $$ insert into equipment (kind, brand, model, serial) values ('total_station', ' leica ', 'ts06 plus', 'lcs-1') $$,
  '23505', null, 'el mismo aparato no se duplica, sin distinguir mayúsculas ni espacios');

-- El congelado: un proceso copia los datos y no referencia el catálogo.
insert into polygonal_processes
  (id, project_id, site_id, name, type, start_point_code, start_north, start_east,
   equipment_brand, equipment_model, angular_precision_seconds)
values
  ('00000000-0000-4000-8000-00000000d401', '00000000-0000-4000-8000-00000000b401',
   '00000000-0000-4000-8000-00000000c401', 'Poligonal', 'closed', 'E1', 1000, 1000,
   'Leica', 'TS06 Plus', 5);
update equipment set model = 'TS06 Plus R500', angular_precision_seconds = 2
 where id = '00000000-0000-4000-8000-00000000e401';
select is(
  (select equipment_model || ' ' || angular_precision_seconds::text from polygonal_processes
    where id = '00000000-0000-4000-8000-00000000d401'),
  'TS06 Plus 5.0', 'editar el equipo no cambia el proceso que lo copió');
delete from equipment where id = '00000000-0000-4000-8000-00000000e401';
select is(
  (select equipment_model from polygonal_processes where id = '00000000-0000-4000-8000-00000000d401'),
  'TS06 Plus', 'borrarlo tampoco');

-- Otro usuario.
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-00000000a402","role":"authenticated"}', true);
select is_empty($$ select 1 from equipment $$, 'otro usuario no ve el catálogo ajeno');
select throws_ok(
  $$ insert into equipment (user_id, kind, brand) values
       ('00000000-0000-4000-8000-00000000a401', 'level', 'Ajeno') $$,
  '42501', null, 'ni escribe en él');

select * from finish();
rollback;
