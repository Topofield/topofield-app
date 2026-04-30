# PRD-de-fase 1 — Setup técnico

**Estado:** en curso
**Fecha de apertura:** 2026-04-29

## Propósito

Dejar la base mínima y verificable sobre la que se construirán las 5 fases siguientes del desarrollo. Al cerrar esta fase, el repositorio debe estar en un estado donde:

- `npm run dev` levanta una app Next.js que sirve `/sign-in`, `/sign-up` y `/dashboard`.
- Supabase corre localmente, las 3 tablas iniciales existen con RLS, y registrarse crea automáticamente la fila correspondiente en `profiles`.
- El sistema de diseño con tokens TopoField y los 4 componentes que la fase necesita (`Button`, `Input`, `Card`, `Alert`) está disponible para que las fases siguientes lo extiendan, no lo redefinan.
- `npm run typecheck`, `npm run lint` y `npm run build` pasan limpios.

No se construye nada que sirva exclusivamente a fases posteriores.

## Alcance

### Dentro

- Inicialización de Next.js 15 (App Router) + React 19 + TypeScript 5.6+ + Tailwind CSS 4.
- Inicialización de Supabase local con Docker (`npx supabase start`), config de auth, variables de entorno.
- Migración SQL inicial con las tablas `profiles`, `projects`, `reference_points`, su trigger `handle_new_user` y sus 9 políticas RLS.
- Generación de tipos TypeScript desde Supabase (`src/types/database.ts`).
- Tres clientes Supabase para Next.js App Router: browser, server, middleware (vía `@supabase/ssr` 0.5+).
- Middleware raíz de protección de rutas con redirecciones según sesión.
- Páginas `/sign-in`, `/sign-up`, `/dashboard` (placeholder) usando Server Actions para los forms.
- Mensajes de error de auth traducidos a español.
- Tokens de diseño TopoField en `src/app/globals.css` con `@theme` (sintaxis Tailwind 4).
- Componentes `Button`, `Input`, `Card`, `Alert` en `src/components/design-system/`.
- Helper `cn()` con `clsx + tailwind-merge` en `src/lib/utils/cn.ts`.

### Fuera (diferido a sus fases)

- CRUD de proyectos, wizard, vista hub → fase 2.
- Tablas SQL de poligonal, nivelación, asentamientos, reports, recipients → fases 3-6.
- Componentes `DmsInput`, `Select`, `Badge`, `Modal`, `Table`, `EditableCell`, `Tabs`, `StatusIndicator`, `KpiCard`, `Wizard`, `Toast` → sus fases respectivas.
- OAuth Google, magic link → no entran en esta fase.
- Verificación de email en signup (`enable_confirmations`) → en dev local queda desactivada; decidir al activar cloud.
- Conexión a Supabase Cloud y deploy a Vercel → fase 6 o cuando se requiera.
- Testing framework (Vitest, Jest, Playwright) → cuando aparezca lógica que justifique tests automatizados (probablemente fase 3 con los algoritmos de cálculo).
- CI / GitHub Actions → cuando exista código que merezca verificación automatizada.

## Decisiones cerradas

| # | Decisión | Razón |
|---|---|---|
| 1 | Supabase local únicamente (Docker). | Iteración rápida, sin dependencias externas en Fase 1. |
| 2 | Schema mínimo: `profiles` + `projects` + `reference_points`. | Anti-patrón "cambios mínimos" del método. Las demás tablas se crean en su fase. |
| 3 | Auth solo email + password. | Mínimo viable. Magic link/OAuth pueden entrar después. |
| 4 | Tailwind 4 con tokens en `@theme`, no `tailwind.config.ts`. | Versión actual; riesgo de plugins ~0 al usar solo los oficiales. Implica actualizar PRD § 2.2. |
| 5 | Next.js 15 + React 19 + TypeScript 5.6+ + Node 20+. | Lo que `create-next-app@latest` instala; dentro de "14+" del PRD. |
| 6 | Server Actions para los forms de auth (no client components). | Patrón canónico de `@supabase/ssr`; menos JS al cliente; cookies sin malabarismos. |
| 7 | `@supabase/ssr` 0.5+, no `@supabase/auth-helpers-nextjs` (deprecated). | Único package soportado para App Router. |
| 8 | Una sola migración inicial `<timestamp>_init.sql`. | Las 3 tablas son interdependientes; no hay nada que reordenar. |
| 9 | Trigger defensivo: `COALESCE(raw_user_meta_data->>'full_name', new.email)`. | Si el cliente no manda `full_name`, el signup no se rompe. Divergencia mínima del SQL del PRD § 3.2. |
| 10 | `tsconfig.json` con `strict + noUncheckedIndexedAccess + noImplicitOverride`. | Rigor que paga dividendos en los cálculos topográficos futuros. |
| 11 | `clsx + tailwind-merge` (helper `cn()`), no `cva`. | Para 4 componentes no se justifica una dependencia adicional. Reevaluar al crecer el design system. |
| 12 | `npx supabase db reset` en dev local, no `db push`. | `db reset` recrea volumen y reaplica todas las migraciones; correcto en dev sin datos productivos. CLAUDE.md menciona `db push`; se actualiza al cerrar la fase. |
| 13 | `--no-turbopack` en scaffolding. | Evita diferencias dev/build durante toda la fase. |

## Modelo de datos creado en esta fase

Las 3 tablas se copian literales del PRD § 3.2 (líneas 175-184, 203-224, 229-239). La función `handle_new_user` aplica el ajuste defensivo de la decisión #9. Las políticas RLS:

- `profiles`: `SELECT` y `UPDATE` solo del propio (`auth.uid() = id`). El INSERT lo hace el trigger `SECURITY DEFINER` y no necesita policy.
- `projects`: CRUD completo solo del dueño (`auth.uid() = user_id`).
- `reference_points`: CRUD vía join con `projects` — `EXISTS (SELECT 1 FROM projects WHERE id = reference_points.project_id AND user_id = auth.uid())`.

## Rutas implementadas

| Ruta | Componente | Comportamiento |
|---|---|---|
| `/` | `src/app/page.tsx` | `redirect('/dashboard')`. El middleware decide según sesión. |
| `/sign-in` | `src/app/(auth)/sign-in/page.tsx` | Form con email + password. Server Action `signInAction` llama `signInWithPassword`. |
| `/sign-up` | `src/app/(auth)/sign-up/page.tsx` | Form con full_name + email + password. Server Action `signUpAction` llama `signUp` pasando `full_name` en `options.data`. |
| `/dashboard` | `src/app/dashboard/page.tsx` | Placeholder: "Bienvenido, {email}" + botón cerrar sesión. |

El middleware raíz redirige:
- Sin sesión + ruta no pública (ni `/`) → `/sign-in`
- Con sesión + ruta pública o `/` → `/dashboard`
- En cualquier otro caso, deja pasar

Rutas públicas: `/sign-in`, `/sign-up`.

## Criterios de aceptación

Al cerrar la fase, los siguientes deben pasar (todos):

| # | Check | Cómo verificar |
|---|---|---|
| a | Type check limpio | `npm run typecheck` exit 0 |
| b | Lint limpio | `npm run lint` exit 0 sin warnings |
| c | Build prod compila | `npm run build` exit 0 |
| d | Dev server levanta | `npm run dev` responde en `localhost:3000` |
| e | Supabase corre | `npx supabase status` muestra todos los servicios "running" |
| f | Sign-up crea profile | Registrarse en `/sign-up`. Verificar fila en `auth.users` Y en `public.profiles` con `full_name` correcto |
| g | Sign-in funciona | Logout y login con esas credenciales redirige a `/dashboard` |
| h | Ruta protegida | Sin sesión, abrir `/dashboard` redirige a `/sign-in` |
| i | Auth con sesión | Con sesión, abrir `/sign-in` redirige a `/dashboard` |
| j | Raíz redirige | `/` con sesión → `/dashboard`; sin sesión → `/sign-in` |
| k | RLS aislamiento | Crear user A y user B. Insertar `project` como A. Como B, `SELECT * FROM projects` devuelve 0 filas |

## Riesgos conocidos

- **Docker no instalado / no corriendo** bloquea Supabase local.
- **`create-next-app` en directorio no vacío** puede pedir confirmación interactiva por archivos preexistentes (`CLAUDE.md`, `docs/`, etc.).
- **`@supabase/ssr` en Server Components puros** emite warnings inocuos al setear cookies; el patrón try/catch silencioso en `setAll` está documentado en la API oficial.
- **Tipos generados desactualizados:** si en una fase posterior se añade tabla y no se regeneran los tipos, TypeScript queda mintiendo. CLAUDE.md ya cubre esta regla.

## Tareas (en orden)

0. Apertura: crear este PRD-de-fase, actualizar PRD § 2.2 por Tailwind 4, marcar fase "en curso", commit.
1. Scaffolding Next.js 15 + TypeScript + Tailwind 4. Ajustes a `tsconfig.json`, `package.json`, `.gitignore`.
2. Tokens TopoField en `src/app/globals.css` con `@theme`. Limpieza de `layout.tsx` y `page.tsx`.
3. `npx supabase init` + `start`. Editar `config.toml`. Crear `.env.local` y `.env.example`.
4. Migración inicial: schema + trigger + RLS. `npx supabase db reset`. Generar tipos.
5. Clientes Supabase: `client.ts`, `server.ts`, `middleware.ts` (helper).
6. `src/middleware.ts` raíz con redirecciones según sesión.
7. Design system: helper `cn()`, `Button`, `Input`, `Card`, `Alert`, `index.ts`.
8. Rutas `(auth)/sign-in`, `(auth)/sign-up`, `dashboard/` con Server Actions y mensajes de error en español.
9. Verificación end-to-end manual (criterios a-k). Cierre de fase.

## Anti-alcance explícito

Durante esta fase NO se hace:
- Refactor de código existente que no pertenezca al setup.
- Adición de testing framework o CI.
- Implementación de componentes del design system fuera de los 4 acordados.
- Creación de tablas SQL fuera de las 3 acordadas.
- Conexión a Supabase Cloud, deploy, configuración de dominios.
- OAuth Google, magic link, recuperación de contraseña.

Cualquier desvío encontrado durante la implementación se anota en la sección "Aprendizajes" de `docs/method.md` al cerrar, no se trata mid-fase.
