-- ============================================================================
-- Correcciones de la Fase 35 — el amarre y el catálogo en una transacción
-- ============================================================================
-- `save_polygonal_process` escribe los puntos del amarre en `reference_points`
-- (`p_catalog`) junto con el proceso: si el guardado falla, el catálogo no
-- cambia. Solo escribe en el catálogo del proyecto del proceso, y la llamada
-- de tres argumentos —la del código anterior a la migración— sigue valiendo.
-- Datos propios dentro de una transacción que se deshace al final.
-- ============================================================================

begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(12);

-- --- Datos, como postgres (sin RLS) ------------------------------------------
insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-00000000a401', 'amarre@topofield.test');

insert into public.projects (id, user_id, name, client, location) values
  ('00000000-0000-4000-8000-00000000b401', '00000000-0000-4000-8000-00000000a401', 'Amarre', 'Pruebas', 'Local'),
  ('00000000-0000-4000-8000-00000000b402', '00000000-0000-4000-8000-00000000a401', 'Otro', 'Pruebas', 'Local');

insert into public.sites (id, project_id, name, structure_type, kind) values
  ('00000000-0000-4000-8000-00000000c401', '00000000-0000-4000-8000-00000000b401', 'Agrupación', 'otro', 'grouping');

insert into public.reference_points (id, project_id, code, type, north, east) values
  ('00000000-0000-4000-8000-00000000e401', '00000000-0000-4000-8000-00000000b401', 'TT4', 'control', 1000, 1000),
  ('00000000-0000-4000-8000-00000000e402', '00000000-0000-4000-8000-00000000b402', 'TT4', 'control', 7000, 7000);

insert into public.polygonal_processes
  (id, project_id, site_id, name, type, start_point_code, start_north, start_east, status)
values
  ('00000000-0000-4000-8000-00000000d401', '00000000-0000-4000-8000-00000000b401',
   '00000000-0000-4000-8000-00000000c401', 'Poligonal', 'closed', 'TT4', 1000, 1000, 'draft');

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-00000000a401","role":"authenticated"}', true);

-- --- Se escriben con el proceso ----------------------------------------------
select lives_ok(
  $$ select save_polygonal_process('00000000-0000-4000-8000-00000000d401',
       '{"start_north":1000.5,"reference_point_id":"00000000-0000-4000-8000-00000000e4a1","reference_point_code":"R1"}',
       '[]',
       '[{"kind":"update","id":"00000000-0000-4000-8000-00000000e401","north":1000.5,"east":1000},
         {"kind":"insert","id":"00000000-0000-4000-8000-00000000e4a1","code":"R1","north":1100,"east":1000}]') $$,
  'el amarre corrige un punto y crea otro con el proceso');
select is((select north from reference_points where id = '00000000-0000-4000-8000-00000000e401'),
  1000.5::numeric(12,4), 'el punto que estaba toma las coordenadas nuevas');
select is((select project_id || ' ' || type || ' ' || north || ' ' || east
             from reference_points where id = '00000000-0000-4000-8000-00000000e4a1'),
  '00000000-0000-4000-8000-00000000b401 control 1100.0000 1000.0000',
  'el nuevo entra en el catálogo del proyecto del proceso, como punto de control');
select is((select reference_point_id from polygonal_processes where id = '00000000-0000-4000-8000-00000000d401'),
  '00000000-0000-4000-8000-00000000e4a1'::uuid, 'la cabecera apunta al punto recién creado');

-- --- Si el guardado falla, el catálogo no cambia --------------------------------
select throws_ok(
  $$ select save_polygonal_process('00000000-0000-4000-8000-00000000d401',
       '{"start_north":2000}',
       '[{"station_order":1,"point_code":"TT4","deflection_direction":"arriba"}]',
       '[{"kind":"update","id":"00000000-0000-4000-8000-00000000e401","north":2000,"east":2000},
         {"kind":"insert","id":"00000000-0000-4000-8000-00000000e4a2","code":"X","north":1,"east":2}]') $$,
  '23514', null, 'una estación inválida hace fallar el guardado entero');
select is((select north from reference_points where id = '00000000-0000-4000-8000-00000000e401'),
  1000.5::numeric(12,4), 'el punto corregido en el guardado fallido conserva sus coordenadas');
select is((select count(*)::int from reference_points where id = '00000000-0000-4000-8000-00000000e4a2'),
  0, 'el punto creado en el guardado fallido no queda');
select is((select start_north from polygonal_processes where id = '00000000-0000-4000-8000-00000000d401'),
  1000.5::numeric(12,4), 'ni cambia la cabecera');

-- --- Solo el catálogo del proyecto del proceso ---------------------------------
select throws_ok(
  $$ select save_polygonal_process('00000000-0000-4000-8000-00000000d401', '{}', '[]',
       '[{"kind":"update","id":"00000000-0000-4000-8000-00000000e402","north":1,"east":1}]') $$,
  'P0002', null, 'no corrige un punto de otro proyecto, aunque sea del mismo usuario');
select is((select north from reference_points where id = '00000000-0000-4000-8000-00000000e402'),
  7000::numeric(12,4), 'el punto del otro proyecto no cambió');
select throws_ok(
  $$ select save_polygonal_process('00000000-0000-4000-8000-00000000d401', '{}', '[]',
       '[{"kind":"borrar","id":"00000000-0000-4000-8000-00000000e401"}]') $$,
  '22023', null, 'una escritura que no es insert ni update se rechaza');

-- --- La llamada de antes de la migración ---------------------------------------
select lives_ok(
  $$ select save_polygonal_process('00000000-0000-4000-8000-00000000d401', '{"name":"Sin catálogo"}', '[]') $$,
  'con tres argumentos —el código anterior— sigue guardando');

select * from finish();
rollback;
