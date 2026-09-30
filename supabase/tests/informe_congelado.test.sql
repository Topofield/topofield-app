-- ============================================================================
-- Fase 23 — El informe emitido no cambia
-- ============================================================================
-- `npx supabase test db`. Datos propios en una transacción que se deshace.
-- ============================================================================

begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(6);

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-00000000a201', 'informe@topofield.test');
insert into public.projects (id, user_id, name, client, location) values
  ('00000000-0000-4000-8000-00000000b201', '00000000-0000-4000-8000-00000000a201',
   'Nombre al emitir', 'Cliente', 'Bogotá');
insert into public.reports (id, project_id, title, included_processes, generated_by, cover) values
  ('00000000-0000-4000-8000-00000000e201', '00000000-0000-4000-8000-00000000b201',
   'Informe', '[]', '00000000-0000-4000-8000-00000000a201',
   '{"name":"Nombre al emitir","client":"Cliente","location":"Bogotá","datum":"MAGNA-SIRGAS","projection":null}');

select throws_ok(
  $$ update reports set title = 'Otro' where id = '00000000-0000-4000-8000-00000000e201' $$,
  '23001', null, 'un UPDATE lo rechaza el trigger, aun sin RLS');

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-00000000a201","role":"authenticated"}', true);

select is_empty(
  $$ update reports set title = 'Otro' where id = '00000000-0000-4000-8000-00000000e201' returning id $$,
  'el usuario no tiene política de UPDATE: no toca ninguna fila');

update projects set name = 'Nombre de hoy' where id = '00000000-0000-4000-8000-00000000b201';
select is(
  (select cover ->> 'name' from reports where id = '00000000-0000-4000-8000-00000000e201'),
  'Nombre al emitir', 'renombrar el proyecto no cambia la portada');

select throws_ok(
  $$ insert into reports (project_id, title, included_processes, generated_by)
     values ('00000000-0000-4000-8000-00000000b201', 'Sin portada', '[]',
             '00000000-0000-4000-8000-00000000a201') $$,
  '23502', null, 'un informe sin portada no se emite');

select lives_ok(
  $$ delete from reports where id = '00000000-0000-4000-8000-00000000e201' $$,
  'el informe se puede eliminar');
select is_empty(
  $$ select 1 from reports where id = '00000000-0000-4000-8000-00000000e201' $$,
  'y queda eliminado');

select * from finish();
rollback;
