-- Fase 46 — Invitaciones por solicitud (docs/prds/45-invitaciones.md).
--
-- Quien quiere una cuenta la solicita; el administrador la acepta y genera un
-- código ligado a ese correo, de un solo uso. Sin correo de confirmación, la
-- regla que impide registrarse sin invitación vive aquí, en un disparador de
-- `auth.users`: el formulario de registro la comprueba antes solo para dar un
-- mensaje claro, pero quien llame a la API de Supabase por fuera choca con el
-- mismo disparador.

-- ----------------------------------------------------------------------------
-- El administrador
-- ----------------------------------------------------------------------------
-- Una tabla y no una columna del perfil: cada usuario puede editar su perfil
-- (`profiles_update_own`), así que una columna ahí se la pondría cualquiera.
-- Nadie escribe aquí desde la aplicación: se llena por migración y, en local,
-- por el seed.

create table public.admins (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.admins enable row level security;

create policy "admins_select_own" on public.admins
  for select to authenticated
  using (user_id = (select auth.uid()));

/** ¿El usuario de la sesión es administrador? */
create function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.admins where user_id = (select auth.uid())
  );
$$;

revoke execute on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

-- El administrador inicial: la cuenta de producción, dueña también de la
-- cuenta de Resend (el remitente de pruebas solo le entrega a ella). En una
-- base recién reseteada todavía no existe: la inserta el seed.
insert into public.admins (user_id)
select id from auth.users where email = 'topofieldsarf@gmail.com'
on conflict do nothing;

-- ----------------------------------------------------------------------------
-- Las solicitudes
-- ----------------------------------------------------------------------------

create table public.invitations (
  id          uuid primary key default gen_random_uuid(),
  first_name  text not null check (char_length(first_name) between 1 and 80),
  last_name   text not null check (char_length(last_name) between 1 and 80),
  email       text not null check (
                email = lower(btrim(email))
                and char_length(email) <= 254
                and email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
              ),
  company     text check (company is null or char_length(company) between 1 and 120),
  purpose     text check (purpose is null or char_length(purpose) between 1 and 500),
  status      text not null default 'pending'
                check (status in ('pending', 'approved', 'rejected', 'used')),
  -- Normalizado: ocho caracteres de un alfabeto sin 0, O, 1, I ni L, sin el
  -- guion con que se muestra (`XXXX-XXXX`).
  code        text unique check (code is null or code ~ '^[A-HJKMNP-Z2-9]{8}$'),
  created_at  timestamptz not null default now(),
  decided_at  timestamptz,
  used_at     timestamptz,
  -- Aceptada y usada tienen código; pendiente y rechazada, no.
  constraint invitations_code_by_status
    check ((status in ('approved', 'used')) = (code is not null)),
  constraint invitations_used_at_by_status
    check ((status = 'used') = (used_at is not null))
);

-- Una solicitud viva por correo (decisión 8): pendiente, o aceptada sin usar.
create unique index invitations_email_live
  on public.invitations (email)
  where status in ('pending', 'approved');

alter table public.invitations enable row level security;

-- Solo el administrador lee y decide. Nadie inserta por la tabla —las
-- solicitudes entran por `request_invitation`— y nadie borra.
create policy "invitations_select_admin" on public.invitations
  for select to authenticated
  using ((select public.is_admin()));

create policy "invitations_update_admin" on public.invitations
  for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

/** El código como lo guarda la base: mayúsculas, sin guion ni espacios. */
create function public.normalize_invite_code(p_code text)
returns text
language sql
immutable
set search_path = ''
as $$
  select upper(regexp_replace(coalesce(p_code, ''), '[[:space:]-]', '', 'g'));
$$;

/**
 * Guarda una solicitud. Devuelve si creó una fila: `false` cuando ya había una
 * viva para ese correo, que no se duplica ni se avisa. Los valores fuera de
 * rango los rechazan los `check` de la tabla.
 */
create function public.request_invitation(
  p_first_name text,
  p_last_name  text,
  p_email      text,
  p_company    text default null,
  p_purpose    text default null
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  insert into public.invitations (first_name, last_name, email, company, purpose)
  values (
    btrim(coalesce(p_first_name, '')),
    btrim(coalesce(p_last_name, '')),
    lower(btrim(coalesce(p_email, ''))),
    nullif(btrim(coalesce(p_company, '')), ''),
    nullif(btrim(coalesce(p_purpose, '')), '')
  )
  on conflict (email) where status in ('pending', 'approved') do nothing
  returning id into v_id;

  return v_id is not null;
end;
$$;

revoke execute on function public.request_invitation(text, text, text, text, text) from public;
grant execute on function public.request_invitation(text, text, text, text, text) to anon, authenticated;

/**
 * ¿Hay una invitación aceptada, sin usar, de ese correo con ese código? Es el
 * paso 1 del registro. No dice nada más: ni el nombre ni el estado.
 */
create function public.invitation_is_valid(p_email text, p_code text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.invitations
    where email = lower(btrim(coalesce(p_email, '')))
      and code = public.normalize_invite_code(p_code)
      and status = 'approved'
  );
$$;

revoke execute on function public.invitation_is_valid(text, text) from public;
grant execute on function public.invitation_is_valid(text, text) to anon, authenticated;

-- ----------------------------------------------------------------------------
-- La regla: sin invitación no hay cuenta
-- ----------------------------------------------------------------------------
-- Antes de toda alta en `auth.users` —el registro, la API de administración,
-- un enlace mágico que crea usuario o un insert directo—, la invitación
-- aceptada de ese correo con ese código pasa a `used`. Si no hay ninguna, el
-- alta no ocurre. El código llega en los metadatos (`invite_code`); no se
-- quita de ellos porque Supabase Auth los vuelve a escribir al terminar el
-- registro, y para entonces el código ya está usado. El nombre y el apellido
-- de la cuenta salen de la solicitud (`handle_new_user` los lee de los
-- metadatos para el perfil).
--
-- Dos altas a la vez con el mismo código: el `update` bloquea la fila, y la
-- segunda la encuentra ya usada.

create function public.require_invitation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_first text;
  v_last  text;
begin
  update public.invitations
     set status = 'used', used_at = now()
   where email = lower(btrim(coalesce(new.email, '')))
     and code = public.normalize_invite_code(new.raw_user_meta_data ->> 'invite_code')
     and status = 'approved'
  returning first_name, last_name into v_first, v_last;

  if not found then
    raise exception 'Se necesita una invitación aceptada para crear una cuenta.'
      using errcode = 'insufficient_privilege';
  end if;

  new.raw_user_meta_data :=
    coalesce(new.raw_user_meta_data, '{}'::jsonb)
    || jsonb_build_object('first_name', v_first, 'last_name', v_last);
  return new;
end;
$$;

revoke execute on function public.require_invitation() from public, anon, authenticated;

create trigger require_invitation
  before insert on auth.users
  for each row execute function public.require_invitation();

-- ----------------------------------------------------------------------------
-- Las cuentas que nunca confirmaron su correo (decisión 17)
-- ----------------------------------------------------------------------------
-- Con «Confirm email» apagado, Supabase confirma una cuenta existente sin
-- confirmar cuando alguien vuelve a registrarse con ese correo, y eso es un
-- `update`, no un `insert`: no pasa por el disparador. Son cuentas que nunca
-- pudieron entrar. Se borran solo las que tampoco tienen proyectos.

delete from auth.users u
where u.email_confirmed_at is null
  and not exists (select 1 from public.projects p where p.user_id = u.id);
