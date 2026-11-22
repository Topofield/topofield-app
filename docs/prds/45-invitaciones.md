# PRD-de-fase 46 — Invitaciones por solicitud

**Estado:** cerrada
**Fecha de apertura:** 2026-11-21
**Fecha de cierre:** 2026-11-22

**Rama:** `fase-46-invitaciones`
**Petición:** del usuario, 2026-11-21: «como tenemos el límite de Resend y
quiero ingresar más usuarios pero aún solo con invitación, […] un botón de
solicitar invitación pida los datos básicos, se guarda el usuario, el sistema me
envía un email con la solicitud, yo la acepto y me envía a una página que genera
el código de invitación, solo accesible con mi usuario (super admin), y yo le
comparto el código a mi invitado; cuando él quiera crear cuenta, la hará
ingresando su mail y su código, al pasar crear su contraseña. Ya no necesita
correo de confirmación por ahora».
**Módulo:** el registro (`(auth)/sign-up`), una ruta pública nueva, una página
de administración nueva y la base.

> **Divergencias de la implementación:**
>
> - **El código no se quita de los metadatos.** Supabase Auth los vuelve a
>   escribir al terminar el registro, con el código dentro; para entonces ya
>   está usado. El disparador solo añade el nombre y el apellido.
> - **Tope global en `request_invitation`** (decisión 9), tras la revisión de
>   código: 20 solicitudes por hora o 100 pendientes.
> - **`aceptarInvitacionAction` falla a la vista** si tres códigos seguidos
>   chocan con uno existente, en vez de no hacer nada.
> - **La CLI de Supabase 3.x no lee el `config.toml`** (`[inbucket]` pasó a
>   `local_smtp`): la migración se aplicó con `npx supabase@2`, y los tipos se
>   añadieron a mano porque la CLI no veía los contenedores.
> - **En local la confirmación de correo siguió encendida**: el socket de
>   Docker no estaba y el servicio de autenticación no se pudo reiniciar con el
>   `config.toml` nuevo. El flujo se verificó entero igual —solicitud, aviso
>   (al log, sin clave de Resend), aceptación, registro en dos pasos,
>   confirmación por Mailpit, proyecto de ejemplo, 404 para un usuario normal,
>   el código usado rechazado— y el alta directa contra la API de Supabase sin
>   invitación respondió 500 sin crear la cuenta. **Lo que no se vio en local
>   es entrar sin confirmar**: queda para producción, tras apagar «Confirm
>   email».
> - **Manual:** «Primeros pasos» pasa de 8 a 10 capturas; las cuatro de la
>   aplicación ya dentro conservan sus bytes con el número nuevo.

## Por qué

Hoy nadie fuera del dueño de la cuenta de Resend puede registrarse: el
registro manda un correo de confirmación, y el remitente de pruebas
(`onboarding@resend.dev`) solo entrega a esa dirección (doc técnica § 11).
Además el código de invitación es **uno solo para todos**
(`SIGNUP_INVITE_CODE`): quien lo tiene lo puede pasar.

El usuario quiere invitar gente sin verificar un dominio en Resend: el único
correo que el sistema necesita mandar es el aviso **a él mismo**, que sí
llega. El invitado no recibe ningún correo: el administrador le pasa el
código por donde quiera.

## El flujo

```
Invitado                         Sistema                        Administrador
────────                         ───────                        ─────────────
/solicitar-invitacion ─────────▶ guarda la solicitud (pendiente)
                                 correo de aviso ─────────────▶ lo abre
                                                                /admin/invitaciones
                                 genera el código ◀──────────── Aceptar
                                                                copia el código
        ◀───────────── el administrador se lo pasa (WhatsApp, correo…) ──────
/sign-up
  1. correo + código ──────────▶ comprueba la invitación
  2. contraseña ───────────────▶ crea la cuenta, marca el código usado,
                                 crea el proyecto de ejemplo
  entra al dashboard ◀─────────
```

## Enfoques considerados

- **A. El código se valida en la base (elegido por el usuario).** Un
  disparador `BEFORE INSERT` en `auth.users` rechaza toda alta sin una
  invitación aceptada para ese correo con ese código, y la marca usada. Se
  apaga «Confirm email» en Supabase. Vercel solo necesita la clave de Resend.
  La regla vive donde no se puede saltar: quien llame a la API de registro de
  Supabase por fuera del formulario choca con el mismo disparador.
- **B. La cuenta la crea el servidor con la clave secreta.** Menos piezas en la
  base, pero pone `SUPABASE_SECRET_KEY` —que salta toda la RLS— en Vercel,
  contra lo que dice la doc técnica § 13. Descartado.
- **C. El *hook* `before_user_created` de Supabase Auth.** Igual que A con
  mensajes de error propios, pero se enciende en el panel de la nube y en
  `config.toml` por separado: una pieza más que puede quedar distinta entre
  local y producción. Descartado; el mensaje claro lo da el formulario, que
  comprueba antes.

## Decisiones

Las tres primeras son del usuario; el resto, de este PRD.

1. **Solo con invitación, y cada invitación es de una persona.** El código va
   ligado al correo de la solicitud y sirve una vez.
2. **El administrador aprueba a mano** y comparte el código él mismo. El
   sistema no le escribe al invitado.
3. **Sin correo de confirmación.** Al crear la cuenta, entra.
4. **Datos de la solicitud:** nombre, apellido y correo, obligatorios; empresa
   o entidad y «¿para qué quiere usar TopoField?», opcionales. El nombre y el
   apellido de la cuenta salen de la solicitud: el registro no los vuelve a
   pedir.
5. **El registro tiene dos pasos en la misma página:** correo y código; si la
   invitación existe, la contraseña. Un código que no corresponde no deja
   pasar al segundo paso.
6. **El código:** ocho caracteres en dos grupos, `XXXX-XXXX`, de un alfabeto
   sin caracteres que se confundan (sin 0, O, 1, I, L). Se genera en el
   servidor con el generador criptográfico. No caduca. Se compara sin
   distinguir mayúsculas y sin el guion ni espacios, porque se va a dictar y a
   pegar.
7. **Estados de una solicitud:** `pending` → `approved` (tiene código) →
   `used`; o `pending` → `rejected`. Una rechazada no avisa a nadie.
8. **Una solicitud viva por correo.** Con una pendiente o aceptada sin usar,
   otra solicitud del mismo correo no crea fila ni manda aviso; quien la envía
   ve el mismo mensaje de recibido, para que la pantalla no revele qué correos
   ya pidieron. Con una usada o rechazada sí puede volver a pedir.
   *Límite aceptado:* quien llame a la función de la base directamente recibe
   un `false` cuando ya había una viva. Es saber que un correo pidió una
   invitación, nada más.
9. **Contra el abuso del formulario público:** un campo trampa oculto (si
   viene lleno, se responde «recibido» y no se guarda), la regla anterior, y
   que `anon` **no escribe en la tabla**: la solicitud entra por una función
   de la base que valida longitudes y descarta la repetida. Cada solicitud
   nueva gasta un envío de Resend (100 al día en el plan gratuito), así que la
   función tiene un tope global: con 20 solicitudes en la última hora o 100
   pendientes, deja de guardar hasta que pase la hora o el administrador
   decida (añadido tras la revisión de código).
10. **El administrador es una fila en una tabla, no una columna del perfil.**
    `public.admins(user_id)`: cada usuario puede editar su perfil, así que una
    columna ahí se la podría poner cualquiera. Nadie escribe en `admins` desde
    la aplicación: se llena por migración (y el seed, en local). El
    administrador inicial es `topofieldsarf@gmail.com`, la cuenta de
    producción y la dueña de la cuenta de Resend.
11. **El aviso sale por la API HTTP de Resend** desde la Server Action, con
    `RESEND_API_KEY`. Va a `ADMIN_EMAIL`. Si falta la clave o Resend falla, la
    solicitud **se guarda igual** y el fallo queda en el log: la página del
    administrador la muestra de todos modos.
12. **El correo enlaza a `/admin/invitaciones`.** Sin sesión, el inicio de
    sesión devuelve a esa página (`?next=`, solo rutas internas); con sesión,
    `/sign-in?next=…` lleva directo a `next`. La dirección del enlace **no**
    sale de las cabeceras de la petición —es un formulario público y acabaría
    en un correo con un enlace de entrada—: es la de producción
    (`VERCEL_PROJECT_PRODUCTION_URL`, que Vercel define sola) o
    `http://localhost:3000` en local.
13. **`SIGNUP_INVITE_CODE` desaparece** del código, de `.env.example` y de la
    documentación.
14. **Si «Confirm email» vuelve a encenderse** en Supabase, el registro no
    deja sesión: se manda a «Revise su correo», como hoy. Esa pantalla y
    `/auth/callback` se conservan por eso, y porque el «por ahora» de la
    petición dice que la confirmación puede volver. *No es un estado que esta
    fase soporte:* mientras el remitente sea el de pruebas, ese correo no le
    llega al invitado y su código ya quedó usado.
15. **En la página de presentación,** el botón «Crear cuenta» pasa a
    «Solicitar invitación», y la nota de debajo enlaza a «Crear cuenta» para
    quien ya tiene código. El rediseño de la página es la fase siguiente.
16. **El correo de la solicitud no se verifica.** Cualquiera puede pedir con
    una dirección ajena; la comprobación es el administrador, que decide a
    quién le pasa el código. La página se lo recuerda: «Comparta el código
    solo con la persona que reconoce».
17. **Las cuentas que nunca confirmaron su correo se borran en la
    migración.** Con «Confirm email» apagado, Supabase confirma una cuenta
    existente sin confirmar cuando alguien vuelve a registrarse con ese
    correo, y eso no pasa por el disparador (no hay `INSERT`). Son cuentas que
    nunca pudieron entrar: no tienen proyectos. Se borran solo las que no
    tienen `email_confirmed_at` ni proyectos. Aprobado por el usuario el
    2026-11-21.

## La base

Una migración, `20261121000000_invitaciones.sql`.

### `public.admins`

| Columna | Tipo | |
|---|---|---|
| `user_id` | `uuid` PK → `auth.users(id)` `on delete cascade` | |
| `created_at` | `timestamptz` | |

RLS: `select` de la fila propia (`user_id = auth.uid()`); ninguna política de
escritura. `public.is_admin()` —`stable`, `security definer`, `search_path`
fijo— dice si `auth.uid()` está en la tabla; la usan las políticas de
`invitations` y la aplicación.

La migración inserta al usuario de `topofieldsarf@gmail.com` si existe. En
local no existe todavía al migrar: lo inserta el seed.

### `public.invitations`

| Columna | Tipo | |
|---|---|---|
| `id` | `uuid` PK | `gen_random_uuid()` |
| `first_name`, `last_name` | `text not null` | |
| `email` | `text not null` | en minúsculas (`check (email = lower(email))`) |
| `company`, `purpose` | `text` | opcionales |
| `status` | `text not null default 'pending'` | `pending`, `approved`, `rejected`, `used` |
| `code` | `text unique` | normalizado: mayúsculas, sin guion |
| `created_at` | `timestamptz not null default now()` | |
| `decided_at`, `used_at` | `timestamptz` | |

- `check`: `approved` y `used` tienen código; `pending` y `rejected`, no.
- Índice único parcial sobre `email` donde `status in ('pending','approved')`:
  la decisión 8.
- RLS: `select` y `update` solo si `is_admin()`. Ninguna política de `insert`
  ni de `delete`: las solicitudes entran por `request_invitation`.

### Funciones

- **`public.request_invitation(p_first_name, p_last_name, p_email, p_company,
  p_purpose) returns boolean`** — `security definer`, ejecutable por `anon`.
  Recorta, pasa el correo a minúsculas y rechaza lo vacío o lo desmedido
  (nombre y apellido hasta 80 caracteres, correo hasta 254 y con forma de
  correo, empresa hasta 120, motivo hasta 500). Inserta una `pending` con
  `on conflict do nothing` sobre el índice parcial y devuelve si creó fila:
  con `true`, la Server Action manda el aviso.
- **`public.invitation_is_valid(p_email text, p_code text) returns boolean`**
  — `security definer`, ejecutable por `anon`. `true` si hay una invitación
  `approved` de ese correo con ese código. Es el paso 1 del registro. No
  devuelve nada más: ni el nombre ni el estado.
- **`public.require_invitation()`** — disparador `BEFORE INSERT` en
  `auth.users`, `security definer`. Lee el código de
  `new.raw_user_meta_data->>'invite_code'`, pasa la invitación de `approved` a
  `used` (con `used_at`) y, si no había ninguna que casara, lanza una
  excepción: el alta no ocurre. Además pone en los metadatos el nombre y el
  apellido de la invitación —de ahí los toma `handle_new_user` para el
  perfil—.

  Vale para **toda** alta, también las de la API de administración y los
  `insert` directos en `auth.users`: el seed y las pruebas pgTAP que crean
  usuarios crean antes su invitación.

Las dos normalizan igual que TypeScript: correo en minúsculas y sin espacios;
código en mayúsculas, sin guion ni espacios.

## La aplicación

| Ruta | Qué |
|---|---|
| `/solicitar-invitacion` | Pública, con el marco de las pantallas de entrada. El formulario de la decisión 4; al enviar, «Recibimos su solicitud. Si se aprueba, le haremos llegar un código de invitación.» |
| `/sign-up` | Los dos pasos de la decisión 5. Enlace a «Solicitar invitación» para quien no tiene código. |
| `/sign-in` | Acepta `?next=` (ruta interna). Debajo de **Entrar**, dos enlaces: «Crear cuenta» (ya tiene código) y «Solicitar invitación». |
| `/admin/invitaciones` | Solo el administrador; a cualquier otro, 404. Tres listas: pendientes (con Aceptar y Rechazar), aceptadas (con su código, un botón para copiarlo y si ya se usó) y rechazadas. |

- **Server Actions:** `solicitarInvitacionAction` (valida, llama a
  `request_invitation`, avisa),
  `verificarInvitacionAction` (paso 1), `signUpAction` (paso 2: `signUp` con
  el código en los metadatos, proyecto de ejemplo, al dashboard),
  `aceptarInvitacionAction` y `rechazarInvitacionAction` (comprueban
  `is_admin()` y actualizan por RLS).
- **Puro y probado:** `src/lib/validators/invitation.ts` (el formulario),
  `src/lib/auth/invite-code.ts` (generar, normalizar y dar formato al
  código), `src/lib/email/aviso-invitacion.ts` (asunto y cuerpo del aviso).
- **Con red:** `src/lib/email/resend.ts`, un `fetch` a
  `https://api.resend.com/emails`. Sin dependencia nueva.
- **El menú de cuenta** muestra «Invitaciones» al administrador.
- **`proxy.ts`:** `/solicitar-invitacion` es pública (con sesión lleva al
  dashboard, como las demás); sin sesión, una ruta protegida manda a
  `/sign-in?next=<ruta>`.
- **El proyecto de ejemplo** se crea en `signUpAction`, que es ahora donde la
  cuenta entra por primera vez; `/auth/callback` lo sigue creando para el
  caso de la decisión 14.

## Qué no entra

- Correo al invitado (aceptación, rechazo o recordatorio).
- Caducidad del código, reenvío o regenerarlo.
- Más de un administrador desde la aplicación, o cualquier otro rol.
- Captcha o límite por IP.
- Recuperar la contraseña.
- Verificar un dominio en Resend.

## Variables de entorno

| Variable | Dónde | |
|---|---|---|
| `RESEND_API_KEY` | Vercel y `.env.local` | Secreta. La misma `re_…` que usa el SMTP de Supabase. Sin ella no sale el aviso; la solicitud se guarda igual. |
| `ADMIN_EMAIL` | Vercel y `.env.local` | A quién va el aviso. Con el remitente de pruebas tiene que ser la dirección dueña de la cuenta de Resend. |
| `SIGNUP_INVITE_CODE` | — | Se borra. |

El remitente es `TopoField <onboarding@resend.dev>`, fijo en el código
mientras no haya dominio verificado.

## Despliegue

El orden importa: con «Confirm email» apagado y sin el disparador, el
registro quedaría abierto; y con el código nuevo y la confirmación encendida,
el invitado gastaría su código esperando un correo que no llega.

1. `npx supabase db push` (con el visto bueno del usuario): crea las tablas y
   el disparador, y borra las cuentas sin confirmar (decisión 17). Desde ese
   momento el registro viejo ya no crea cuentas, lo que no cambia nada: hoy
   solo podía el dueño de Resend.
2. Apagar *Authentication → Providers → Email → Confirm email* en Supabase.
   Ya es seguro: el disparador está puesto.
3. `RESEND_API_KEY` y `ADMIN_EMAIL` en Vercel.
4. Merge a `main`.
5. Borrar `SIGNUP_INVITE_CODE` de Vercel.

Los pasos 2, 3 y 5 son de paneles: los hace el usuario.

## Criterios de aceptación

- Una solicitud desde `/solicitar-invitacion` queda `pending` y dispara un
  aviso con sus datos y el enlace a `/admin/invitaciones`.
- Una segunda solicitud del mismo correo, con la primera viva, no crea fila ni
  aviso, y responde lo mismo.
- `/admin/invitaciones` responde 404 a un usuario que no es administrador y a
  quien no tiene sesión lo manda a entrar y lo devuelve.
- Aceptar genera un código único y lo muestra; rechazar no.
- Con correo y código correctos, el registro pide la contraseña, crea la
  cuenta con el nombre de la solicitud, deja la sesión iniciada, crea el
  proyecto de ejemplo y marca la invitación `used`.
- Un código ya usado, de otro correo, o inventado no pasa del paso 1.
- **Un alta directa contra la API de Supabase, sin invitación, falla.**
- `anon` no puede leer ni escribir `invitations`; un usuario normal tampoco.
- `npm run typecheck`, `npm run lint`, `npm test`, `npx supabase test db` y
  `npm run build` pasan.

## Pruebas mínimas

- Vitest: el validador de la solicitud; el código (formato, alfabeto,
  normalización, que dos seguidos difieren); el asunto y el cuerpo del aviso;
  `next` solo acepta rutas internas.
- pgTAP, `supabase/tests/invitaciones.test.sql`: las políticas (`anon` y un
  usuario normal no leen, no insertan ni actualizan; el administrador lee y
  actualiza), `request_invitation` (crea la pendiente; la repetida devuelve
  `false`; lo desmedido se rechaza), `invitation_is_valid`, y el disparador
  (sin invitación, con código equivocado, con el de otro correo y con uno
  usado, el alta falla; con el bueno, pasa, queda `used` y el perfil toma el
  nombre de la solicitud).
- En pantalla, en local: el flujo entero con dos cuentas, y el aviso leído en
  el log (en local no hay clave de Resend).

## Documentación

- Manual, «Primeros pasos»: «Crear su cuenta» pasa a solicitar la invitación y
  registrarse con el código, sin confirmación; su recorrido y sus capturas.
- Doc técnica: § 4 (las dos tablas), § 5 (el registro y el administrador),
  § 9 (pruebas), § 11 (la entrada de Resend cambia: ya no impide registrarse)
  y § 13 (variables y el orden del despliegue).
- `CLAUDE.md`: la regla del registro, la arquitectura y «un solo rol».
- `supabase/config.toml`: `enable_confirmations = false`, como quedará la nube.
- `scripts/seed.mjs`: la invitación de su usuario y su fila en `admins`.
