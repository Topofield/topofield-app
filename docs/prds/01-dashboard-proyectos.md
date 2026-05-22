# PRD-de-fase 2 — Dashboard y Proyectos

**Estado:** en curso
**Fecha de apertura:** 2026-05-21
**Fecha de cierre:** —

## Propósito

Construir la capa de gestión de proyectos sobre la base técnica de la Fase 1. Al
cerrar esta fase, un usuario autenticado debe poder:

- Ver un dashboard con tarjetas KPI y la lista de sus proyectos, filtrable por
  estado (activo / archivado).
- Crear un proyecto mediante un wizard de 2 pasos (datos básicos + equipo y
  precisión).
- Entrar a la vista hub de un proyecto, con header de datos y 3 tabs.
- Editar el proyecto, archivarlo, restaurarlo o eliminarlo definitivamente.
- Gestionar (CRUD) los puntos de referencia del proyecto desde la tab
  Configuración.

No se construyen los procesos topográficos (poligonal, nivelación, asentamientos):
son las Fases 3-5. Esta fase deja el "contenedor" listo para alojarlos.

## Alcance

### Dentro

- Dashboard real (`/dashboard`) reemplazando el placeholder de Fase 1: 3 tarjetas
  KPI, lista de proyectos como tarjetas, filtro activo/archivado, botón "+ Nuevo
  Proyecto", estado vacío.
- Wizard de creación de proyecto (`/projects/new`) de 2 pasos.
- Vista hub del proyecto (`/projects/[id]`): header con datos de proyecto y equipo,
  3 tabs (Procesos | Informes | Configuración).
- Tab Configuración funcional: editar proyecto, archivar / restaurar / eliminar,
  CRUD de `reference_points`.
- Capa de lectura `src/lib/supabase/queries.ts` y Server Actions de mutación.
- 7 componentes nuevos del design system: `Select`, `Textarea`, `Badge`,
  `KpiCard`, `Tabs`, `Modal`, `EmptyState`.
- Validadores puros `src/lib/validators/project.ts` y `reference-point.ts`.
- Tipos de dominio `src/types/project.ts`.
- Migración con un trigger reutilizable `set_updated_at` para `projects.updated_at`.
- Route group `(app)` con layout de chrome compartido.

### Fuera (diferido a sus fases)

- Editores de procesos poligonal / nivelación / asentamientos → Fases 3-5.
- Generador de informes y destinatarios → Fase 6.
- Tablas SQL `polygonal_*`, `leveling_*`, `settlement_*`, `reports`, `recipients`
  → sus fases. La única migración de esta fase es el trigger `set_updated_at`.
- Feed de "actividad reciente" del PRD § 4.1 y la tabla `activity_log` que
  requeriría → no se construye (decisión #5).
- KPIs "procesos pendientes de cierre" y "alertas activas": se renderizan las
  tarjetas pero con valor `0` / `—`; el cálculo real entra con sus tablas.
- Componentes `DmsInput`, `Table`, `EditableCell`, `StatusIndicator`, `Toast` y un
  `Wizard` genérico → sus fases.
- Lógica de inmutabilidad `closed` → no aplica a proyectos (decisión #7).
- Testing framework, CI, conexión a Supabase Cloud, deploy.

## Decisiones cerradas

| # | Decisión | Razón |
|---|---|---|
| 1 | Sin migración de tablas: `projects` y `reference_points` ya existen completas desde Fase 1. | El schema del PRD § 3.2 se creó íntegro en `20260430010354_init.sql`. La fase es trabajo de capa de aplicación. |
| 2 | Única migración: trigger `set_updated_at` sobre `projects`. | La columna `updated_at` existe pero nada la actualiza. Se crea una función `public.set_updated_at()` reutilizable por las tablas `*_processes` de fases siguientes. |
| 3 | KPIs: las 3 tarjetas se renderizan; procesos/alertas muestran `0` / `—`. | Sus tablas llegan en Fases 3-6. El `0` se encapsula en `getDashboardKpis` para que en fases siguientes solo cambie esa función, no el componente. |
| 4 | Hub con las 3 tabs; Procesos e Informes muestran estado vacío. | `vista hub` del § 4.2 incluye las 3 tabs. Construir el shell con `EmptyState` deja el hub completo estructuralmente. |
| 5 | No se construye `activity_log` ni el feed de actividad reciente. | No está en el modelo de datos del PRD § 3; sería una tabla especulativa. Se difiere hasta que se justifique. |
| 6 | Eliminar = archivar (`status='archived'`) como acción principal; borrado definitivo disponible con confirmación en modal. | Archivar es reversible y seguro de cara a los procesos futuros; el borrado duro queda como acción explícita y confirmada. Cubre el "CRUD" completo del § 9. |
| 7 | No se implementa inmutabilidad `closed`. | La regla "procesos `closed` son inmutables" (CLAUDE.md) aplica a `*_processes`, no a proyectos. Un proyecto archivado sí se edita y restaura. |
| 8 | CRUD de `reference_points` en la tab Configuración. | La tabla ya existe y es configuración a nivel proyecto que consumirán los 3 módulos de proceso. |
| 9 | Route group `(app)` con layout de chrome compartido; `dashboard/` se mueve dentro. | Evita duplicar el header entre dashboard y proyectos. Cambio aditivo; el único "refactor" de Fase 1 permitido. |
| 10 | Tabs del hub sincronizadas con `?tab=`, no sub-rutas. | Permite enlazar directo a Configuración (p. ej. desde "Editar proyecto") sin crear 3 sub-rutas para tabs que en Fase 2 son mayormente vacías. |
| 11 | Wizard como client component único con ambos pasos montados en el DOM (el inactivo oculto con CSS) dentro de un solo `<form>`. | Un único `FormData` recoge los 14 campos en el submit. 2 pasos cortos no justifican multi-ruta ni estado en `searchParams`. |
| 12 | `redirect` cuando la acción cambia de pantalla; `useActionState` + retorno `{ok,error?}` cuando se queda en la misma. | Crear/eliminar cambian de pantalla. Editar / archivar / CRUD de puntos se quedan: feedback inline sin perder estado de la página. |
| 13 | Validadores como funciones puras de TS en `src/lib/validators/`, sin librería (Zod, etc.). | Anti-patrón "cambios mínimos". Se invocan desde el Server Action (fuente de verdad) y se reutilizan en cliente. |
| 14 | 7 componentes nuevos del design system, sin `cva`, sobre Tailwind puro. | Consistente con la decisión #11 de Fase 1. Solo lo que las pantallas de esta fase usan. |

## Modelo de datos

No se crean tablas. Se usan `projects` y `reference_points` tal como existen en
`supabase/migrations/20260430010354_init.sql`.

Única migración nueva — `<timestamp>_projects_updated_at_trigger.sql`:

```sql
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger projects_set_updated_at
  before update on public.projects
  for each row execute function public.set_updated_at();
```

Tras aplicar (`npx supabase db reset`) se regeneran los tipos por higiene, aunque
el schema de columnas no cambie.

## Rutas

| Ruta | Componente | Comportamiento |
|---|---|---|
| `/dashboard` | `src/app/(app)/dashboard/page.tsx` | KPIs (3 tarjetas) + lista de proyectos + filtro activo/archivado + "+ Nuevo Proyecto". Estado vacío si no hay proyectos. |
| `/projects/new` | `src/app/(app)/projects/new/page.tsx` | Wizard de 2 pasos. `createProjectAction` inserta y redirige al hub. |
| `/projects/[id]` | `src/app/(app)/projects/[id]/page.tsx` | Hub: header de proyecto + equipo, 3 tabs. Tab vía `?tab=processes\|reports\|config` (default `processes`). |
| `/projects/[id]` (404) | `src/app/(app)/projects/[id]/not-found.tsx` | Proyecto inexistente o de otro usuario (RLS → query devuelve `null`). |

El route group `(app)` aporta `layout.tsx` con el header autenticado. `proxy.ts` no
cambia: ya protege toda ruta no pública. Rutas públicas siguen siendo `/sign-in` y
`/sign-up`.

## Capa de datos

**Lecturas** — `src/lib/supabase/queries.ts` (funciones `async`, reciben el cliente
server, devuelven datos tipados):

- `getDashboardProjects(supabase, { status })` — proyectos del usuario por estado,
  orden `created_at desc`.
- `getDashboardKpis(supabase)` — `{ activeProjects, pendingClosures: 0, activeAlerts: 0 }`.
- `getProjectById(supabase, id)` — un proyecto o `null`.
- `getReferencePoints(supabase, projectId)` — puntos del proyecto, orden `code`.

**Mutaciones** — Server Actions junto a su ruta (`"use server"`):

- `new/actions.ts`: `createProjectAction` → valida → `INSERT` → `redirect('/projects/{id}')`.
- `[id]/actions.ts`: `updateProjectAction`, `archiveProjectAction`,
  `restoreProjectAction` (→ `useActionState` + `revalidatePath`);
  `deleteProjectAction` (→ `DELETE`, cascade sobre `reference_points`, `redirect('/dashboard')`);
  `createReferencePointAction`, `updateReferencePointAction`,
  `deleteReferencePointAction`.

## Validación

`src/lib/validators/project.ts` y `reference-point.ts` — funciones puras de TS, sin
React ni Supabase, mensajes en español. Cubren todos los `NOT NULL` y `CHECK` del
schema.

- **Proyecto** — obligatorios: `name`, `client`, `location`, `datum` (default
  `MAGNA-SIRGAS`), `precision_order` ∈ {primer/segundo/tercer_orden, ordinario},
  `equipment_brand`, `equipment_model`, `equipment_serial`,
  `angular_precision_seconds` (≥ 0), `linear_precision`,
  `equipment_calibration_date` (fecha válida, no futura). Opcionales:
  `description`, `projection`, `latitude` (−90..90), `longitude` (−180..180).
- **Reference point** — obligatorios: `code`, `type` ∈ {bm, control, gps, detail}.
  Opcionales: `north`, `east`, `elevation`, `description`.
- Formato (regla de CLAUDE.md): las coordenadas topográficas `north`/`east` de los
  puntos de referencia se redondean a 3 decimales y la cota `elevation` a 4. La
  latitud/longitud geográfica del proyecto (`decimal(10,7)`) no entra en esa regla
  — solo se valida el rango (−90..90 / −180..180); la columna conserva su precisión.

## Componentes nuevos

Design system (`src/components/design-system/`): `Select`, `Textarea`, `Badge`,
`KpiCard`, `Tabs`, `Modal`, `EmptyState`. Exportados desde `index.ts`, sobre
Tailwind puro, imitando `input.tsx`.

Feature (`src/components/projects/`): `project-wizard.tsx`, `project-card.tsx`,
`dashboard-filter.tsx`, `reference-points-manager.tsx`, `delete-project-dialog.tsx`.

Tipos de dominio (`src/types/project.ts`): literales `PrecisionOrder`,
`ProjectStatus`, `ReferencePointType` y mapas de etiquetas en español. El resto
reusa `Tables`/`TablesInsert`/`TablesUpdate` de `src/types/database.ts`.

## Criterios de aceptación

| # | Check | Cómo verificar |
|---|---|---|
| a | Type check limpio | `npm run typecheck` exit 0 |
| b | Lint limpio | `npm run lint` exit 0 sin warnings |
| c | Build prod compila | `npm run build` exit 0 |
| d | Dashboard con KPIs | `/dashboard` muestra 3 `KpiCard`; "proyectos activos" con conteo real; los otros en `0`/`—` |
| e | Lista de proyectos | Con ≥1 proyecto, tarjeta por proyecto con nombre, cliente, fecha, conteo de procesos (0) y badge de estado |
| f | Estado vacío | Usuario sin proyectos ve `EmptyState` con CTA "+ Nuevo Proyecto" |
| g | Filtro activo/archivado | El toggle cambia la lista; archivados solo aparecen con el filtro en "archivado" |
| h | Crear proyecto | Wizard paso 1 → 2 → "Crear proyecto" inserta fila y redirige a `/projects/{id}` |
| i | Validación del wizard | Enviar con un `NOT NULL` vacío muestra error en español, no inserta y conserva lo digitado |
| j | Hub del proyecto | `/projects/[id]` muestra header con datos proyecto+equipo y 3 tabs; Procesos e Informes muestran `EmptyState`; "+ Nuevo Proceso" deshabilitado |
| k | Editar proyecto | Tab Configuración: editar `name`/`client` persiste, `updated_at` se actualiza, el dashboard refleja el cambio |
| l | CRUD reference_points | Tab Configuración: crear, editar y borrar un punto funciona; cotas a 4 decimales, coords a 3 |
| m | Archivar | "Archivar" cambia `status` a `archived`; el proyecto sale de la lista activa y aparece en archivados; se puede restaurar |
| n | Borrado definitivo | El modal de confirmación → `DELETE` → redirige a `/dashboard`; los `reference_points` del proyecto desaparecen (cascade) |
| o | Aislamiento RLS | Usuario B no puede abrir `/projects/{id de A}`: la query devuelve `null` → `not-found` (404) |
| p | Ruta protegida | Sin sesión, `/projects/new` y `/projects/[id]` redirigen a `/sign-in` |

## Riesgos conocidos

- **Tipos generados:** la migración del trigger no cambia columnas; regenerar
  tipos es solo higiene. Si una fase futura olvida regenerar tras un cambio real
  de schema, TypeScript queda mintiendo (riesgo ya cubierto por CLAUDE.md).
- **`createProjectAction` con 14 campos:** un error de validación no debe vaciar
  el formulario — de ahí `useActionState` en el wizard en vez de `redirect` con
  `?error=`.
- **Route group `(app)`:** mover `dashboard/` debe preservar la URL `/dashboard`
  (los route groups no afectan la ruta). Verificar tras el movimiento.

## Tareas (en orden)

0. Apertura: este PRD, estado `en curso` en `method.md` y `prds/README.md`, commit `docs:`.
1. Migración del trigger `set_updated_at`; `npx supabase db reset`; regenerar tipos.
2. `src/types/project.ts` — literales y etiquetas en español.
3. Validadores `project.ts` y `reference-point.ts`.
4. `src/lib/supabase/queries.ts`.
5. Design system: `Select`, `Textarea`, `Badge`, `KpiCard`, `Tabs`, `Modal`, `EmptyState` + `index.ts`.
6. Route group `(app)` + `layout.tsx`; mover `dashboard/`; reubicar `signOutAction`.
7. Dashboard real: KPIs, `project-card`, `dashboard-filter`, estado vacío.
8. Wizard de creación: `new/page.tsx`, `project-wizard`, `createProjectAction`.
9. Hub del proyecto: `[id]/page.tsx` (header + Tabs), `not-found.tsx`, tabs vacías.
10. Tab Configuración: editar proyecto, `reference-points-manager`, `delete-project-dialog`, `[id]/actions.ts`.
11. Verificación end-to-end (criterios a-p). Cierre de fase.

## Anti-alcance explícito

Durante esta fase NO se hace:
- Editores de procesos ni tablas SQL fuera del trigger `set_updated_at`.
- Cálculo real de los KPIs de procesos/alertas; tabla `activity_log`.
- Componentes del design system fuera de los 7 acordados.
- Refactor de código de Fase 1 fuera de mover `dashboard/` al grupo `(app)`.
- Librería de validación, testing framework, CI, OAuth, Supabase Cloud, deploy.

Cualquier desvío encontrado durante la implementación se anota en la sección
"Aprendizajes" de `docs/method.md` al cerrar.
