-- ============================================================================
-- Fase 46 — Invitaciones por solicitud
-- ============================================================================
-- Se ejecuta con `npx supabase test db` sobre la base local (pgTAP), dentro de
-- una transacción que se deshace al final.
--
-- Comprueba que nadie fuera del administrador lee ni decide las solicitudes,
-- que la solicitud solo entra por `request_invitation`, y que el disparador de
-- `auth.users` no deja crear una cuenta sin una invitación aceptada de ese
-- correo con ese código —también con un insert directo, que es lo que haría
-- quien se saltara el formulario—.
-- ============================================================================

begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(29);

-- --- Datos, como postgres (sin RLS) ------------------------------------------
-- Un administrador y un usuario normal, cada uno con su invitación usada.

insert into public.invitations (id, first_name, last_name, email, status, code, decided_at) values
  ('00000000-0000-4000-8000-0000000c4601', 'Admin', 'Pruebas', 'admin46@topofield.test', 'approved', 'ADMNAAAA', now()),
  ('00000000-0000-4000-8000-0000000c4602', 'Usuario', 'Normal', 'normal46@topofield.test', 'approved', 'NRMXAAAA', now());

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-4000-8000-00000000a461', 'admin46@topofield.test', '{"invite_code":"ADMN-AAAA"}'),
  ('00000000-0000-4000-8000-00000000a462', 'normal46@topofield.test', '{"invite_code":"nrmx aaaa"}');

insert into public.admins (user_id) values ('00000000-0000-4000-8000-00000000a461');

-- --- El disparador: con la invitación buena, la cuenta nace -------------------

select is(
  (select status from public.invitations where id = '00000000-0000-4000-8000-0000000c4601'),
  'used',
  'el alta marca la invitación usada'
);
select isnt(
  (select used_at from public.invitations where id = '00000000-0000-4000-8000-0000000c4601'),
  null,
  'y anota cuándo'
);
select is(
  (select first_name || ' ' || last_name from public.profiles where id = '00000000-0000-4000-8000-00000000a462'),
  'Usuario Normal',
  'el perfil toma el nombre de la solicitud'
);

-- --- El disparador: sin invitación válida, no hay cuenta ---------------------

insert into public.invitations (id, first_name, last_name, email, status, code, decided_at) values
  ('00000000-0000-4000-8000-0000000c4603', 'Ana', 'Aceptada', 'aceptada46@topofield.test', 'approved', 'ACPTAAAA', now()),
  ('00000000-0000-4000-8000-0000000c4604', 'Pia', 'Pendiente', 'pendiente46@topofield.test', 'pending', null, null),
  ('00000000-0000-4000-8000-0000000c4605', 'Rita', 'Rechazada', 'rechazada46@topofield.test', 'rejected', null, now());

select throws_ok(
  $$ insert into auth.users (id, email) values ('00000000-0000-4000-8000-00000000a463', 'nadie46@topofield.test') $$,
  '42501', null,
  'sin código, el alta falla'
);
select throws_ok(
  $$ insert into auth.users (id, email, raw_user_meta_data)
     values ('00000000-0000-4000-8000-00000000a463', 'aceptada46@topofield.test', '{"invite_code":"ACPTAAAB"}') $$,
  '42501', null,
  'con un código equivocado, el alta falla'
);
select throws_ok(
  $$ insert into auth.users (id, email, raw_user_meta_data)
     values ('00000000-0000-4000-8000-00000000a463', 'otro46@topofield.test', '{"invite_code":"ACPTAAAA"}') $$,
  '42501', null,
  'con el código de otro correo, el alta falla'
);
select throws_ok(
  $$ insert into auth.users (id, email, raw_user_meta_data)
     values ('00000000-0000-4000-8000-00000000a463', 'normal46@topofield.test', '{"invite_code":"NRMXAAAA"}') $$,
  '42501', null,
  'con un código ya usado, el alta falla'
);
select is(
  (select status from public.invitations where id = '00000000-0000-4000-8000-0000000c4603'),
  'approved',
  'un alta fallida no gasta la invitación de otro'
);
select lives_ok(
  $$ insert into auth.users (id, email, raw_user_meta_data)
     values ('00000000-0000-4000-8000-00000000a463', ' Aceptada46@Topofield.test ', '{"invite_code":"acpt-aaaa"}') $$,
  'el correo y el código se comparan normalizados'
);

-- --- Las restricciones de la tabla --------------------------------------------

select throws_ok(
  $$ insert into public.invitations (first_name, last_name, email, status, code)
     values ('Dos', 'Vivas', 'pendiente46@topofield.test', 'pending', null) $$,
  '23505', null,
  'no hay dos solicitudes vivas del mismo correo'
);
select lives_ok(
  $$ insert into public.invitations (first_name, last_name, email, status)
     values ('Otra', 'Vez', 'rechazada46@topofield.test', 'pending') $$,
  'tras una rechazada se puede volver a pedir'
);
select throws_ok(
  $$ update public.invitations set status = 'approved' where id = '00000000-0000-4000-8000-0000000c4604' $$,
  '23514', null,
  'una aceptada sin código no se guarda'
);
select throws_ok(
  $$ update public.invitations set status = 'approved', code = 'IIII0000' where id = '00000000-0000-4000-8000-0000000c4604' $$,
  '23514', null,
  'un código con caracteres que se confunden no se guarda'
);

-- --- La solicitud, como anon ---------------------------------------------------

set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);

select is(
  public.request_invitation('  Nueva ', 'Persona', '  Nueva46@Topofield.test', 'Constructora', ''),
  true,
  'anon solicita por la función'
);
select is(
  public.request_invitation('Nueva', 'Persona', 'nueva46@topofield.test'),
  false,
  'la repetida no crea otra fila'
);
select throws_ok(
  $$ select public.request_invitation('Sin', 'Correo', 'no-es-un-correo') $$,
  '23514', null,
  'un correo mal formado se rechaza'
);
select throws_ok(
  $$ select public.request_invitation(repeat('a', 81), 'Largo', 'largo46@topofield.test') $$,
  '23514', null,
  'un nombre desmedido se rechaza'
);
select throws_ok(
  $$ insert into public.invitations (first_name, last_name, email) values ('Directo', 'Anon', 'directo46@topofield.test') $$,
  '42501', null,
  'anon no inserta por la tabla'
);
select is_empty(
  $$ select 1 from public.invitations $$,
  'anon no lee las solicitudes'
);
select is(
  public.invitation_is_valid('normal46@topofield.test', 'NRMXAAAA'),
  false,
  'una invitación usada ya no es válida'
);
select is(
  public.invitation_is_valid('pendiente46@topofield.test', ''),
  false,
  'una pendiente no es válida'
);

reset role;

-- --- Un usuario normal ----------------------------------------------------------

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-00000000a462","role":"authenticated"}', true);

select is(public.is_admin(), false, 'un usuario normal no es administrador');
select is_empty(
  $$ select 1 from public.invitations $$,
  'un usuario normal no lee las solicitudes'
);
update public.invitations set status = 'rejected', decided_at = now()
 where id = '00000000-0000-4000-8000-0000000c4604';
select throws_ok(
  $$ insert into public.admins (user_id) values ('00000000-0000-4000-8000-00000000a462') $$,
  '42501', null,
  'ni se hace administrador'
);

reset role;

select is(
  (select status from public.invitations where id = '00000000-0000-4000-8000-0000000c4604'),
  'pending',
  'ni decide sobre ellas'
);

-- --- El administrador ----------------------------------------------------------

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-00000000a461","role":"authenticated"}', true);

select is(public.is_admin(), true, 'el administrador lo es');
select cmp_ok(
  (select count(*) from public.invitations), '>=', 6::bigint,
  'el administrador lee las solicitudes'
);
update public.invitations
   set status = 'approved', code = 'PNDTAAAA', decided_at = now()
 where id = '00000000-0000-4000-8000-0000000c4604';

reset role;

select is(
  (select status from public.invitations where id = '00000000-0000-4000-8000-0000000c4604'),
  'approved',
  'y las acepta'
);

select is(
  public.invitation_is_valid('pendiente46@topofield.test', 'pndt-aaaa'),
  true,
  'la aceptada es válida con su código, en cualquier forma'
);

select * from finish();
rollback;
