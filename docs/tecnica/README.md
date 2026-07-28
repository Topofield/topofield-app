# Documentación técnica — TopoField

Documento de referencia para desarrollar y mantener TopoField. Describe cómo
está construido el sistema, qué decisiones lo gobiernan y dónde tocar para
extenderlo.

**Última actualización:** 2026-07-27 · Fases 1-3 implementadas · 117 tests.

Otros documentos:
- [Manual de usuario](../manual/README.md) — cómo se usa la aplicación
- [`PRD-TopoField.md`](../../PRD-TopoField.md) — requisitos, modelo de datos y algoritmos
- [`docs/method.md`](../method.md) — método de trabajo por fases
- [`docs/prds/`](../prds/) — PRD detallado de cada fase

---

## Índice

1. [Panorama](#1-panorama)
2. [Puesta en marcha](#2-puesta-en-marcha)
3. [Arquitectura](#3-arquitectura)
4. [Modelo de datos](#4-modelo-de-datos)
5. [Seguridad](#5-seguridad)
6. [Motor de cálculo](#6-motor-de-cálculo)
7. [Validación](#7-validación)
8. [Sistema de diseño](#8-sistema-de-diseño)
9. [Pruebas](#9-pruebas)
10. [Cómo extender](#10-cómo-extender)
11. [Deuda técnica conocida](#11-deuda-técnica-conocida)

---

## 1. Panorama

Aplicación web para gestión de procesos topográficos, desarrollada como
monografía de grado (Universidad Distrital).

| Capa | Tecnología |
|---|---|
| Framework | Next.js 16.2.4 (App Router) |
| UI | React 19.2.4 · Tailwind CSS v4 |
| Datos y autenticación | Supabase (PostgreSQL + Auth) |
| Lenguaje | TypeScript 5 (`strict`, `noUncheckedIndexedAccess`) |
| Pruebas | Vitest 4 |
| Node | 20.19.4 |

Sin librerías de componentes: el sistema de diseño es propio, sobre Tailwind.

**Estado por fases:**

| Fase | Módulo | Estado |
|---|---|---|
| 1 | Setup técnico | cerrada |
| 2 | Dashboard y proyectos | cerrada |
| 3 | Poligonales | cerrada |
| 4 | Nivelación | pendiente |
| 5 | Asentamientos | pendiente |
| 6 | Cierre, informes, exportación | pendiente |

---

## 2. Puesta en marcha

```bash
npm install
npx supabase start                              # levanta PostgreSQL local
npx tsx --env-file=.env.local scripts/seed.mjs  # datos de ejemplo
npm run dev
```

Credenciales de los datos de ejemplo: `seed@topofield.local` / `seed1234`.

### Comandos

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Compilación de producción |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm run test` | Vitest (una pasada) |
| `npm run test:watch` | Vitest en modo continuo |
| `npx supabase db reset` | Recrea la base y reaplica migraciones |
| `npx supabase gen types typescript --local > src/types/database.ts` | Regenera tipos |

### Advertencia sobre el entorno local

Tras un `supabase db reset`, los roles de PostgREST pueden quedar sin
privilegios sobre `public`, y el seed falla con `permission denied`. Solución:

```sql
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
```

Es un problema del stack local, no del esquema: las migraciones no lo provocan.

---

## 3. Arquitectura

### Estructura

```
src/
├── app/
│   ├── (auth)/              login y registro
│   ├── (app)/               pantallas autenticadas
│   │   ├── dashboard/
│   │   └── projects/[id]/polygonal/[pid]/
│   ├── layout.tsx           layout raíz, carga de fuentes
│   ├── globals.css          tokens de tema y capas base
│   └── icon.svg             favicon
├── components/
│   ├── design-system/       componentes propios reutilizables
│   ├── polygonal/           editor de poligonales
│   └── projects/            dashboard y gestión de proyectos
├── lib/
│   ├── calculations/        algoritmos puros
│   ├── validators/          reglas de validación
│   ├── process-list.ts      filtrado y orden del listado de procesos
│   ├── supabase/            clientes y consultas
│   └── utils/
├── types/                   tipos, incluido database.ts generado
└── proxy.ts                 protección de rutas
```

> **Next 16 renombró `middleware` a `proxy`.** El archivo es `src/proxy.ts`.
> Antes de escribir código de Next, consulte `node_modules/next/dist/docs/`:
> esta versión tiene cambios frente a lo documentado en otras fuentes.

### Flujo de datos

Las páginas son **Server Components** que consultan Supabase directamente
mediante los helpers de `src/lib/supabase/queries.ts`. Las mutaciones pasan por
**Server Actions**, nunca por el cliente de navegador.

```
Página (Server Component)
    ↓ getProjectById / getPolygonalProcesses
Supabase (con RLS)
    ↓
Componente cliente (editor)
    ↓ Server Action
Validación + cálculo → escritura → revalidatePath
```

Ningún archivo usa `createBrowserClient`. Toda escritura atraviesa una Server
Action donde se aplican las guardas de negocio.

### Server Actions

| Archivo | Acciones |
|---|---|
| `(auth)/sign-in/actions.ts` | `signInAction` |
| `(auth)/sign-up/actions.ts` | `signUpAction` |
| `(app)/actions.ts` | `signOutAction` |
| `(app)/projects/new/actions.ts` | `createProjectAction` |
| `(app)/projects/[id]/actions.ts` | `updateProjectAction`, `archiveProjectAction`, `restoreProjectAction`, `deleteProjectAction`, `createReferencePointAction`, `updateReferencePointAction`, `deleteReferencePointAction` |
| `(app)/projects/[id]/polygonal/new/actions.ts` | `createPolygonalProcessAction` |
| `(app)/projects/[id]/polygonal/[pid]/actions.ts` | `savePolygonalProcessAction`, `closePolygonalProcessAction`, `duplicatePolygonalProcessAction`, `renamePolygonalProcessAction`, `deletePolygonalProcessAction` |

---

## 4. Modelo de datos

Cinco tablas en `public`:

```
profiles         perfil del usuario (1:1 con auth.users)
projects         proyecto topográfico
├── reference_points      puntos de coordenadas conocidas
└── polygonal_processes   levantamiento poligonal
    └── polygonal_stations    estaciones del levantamiento
```

### Convenciones que gobiernan el esquema

**Los ángulos se almacenan en tres columnas** (`*_deg`, `*_min`, `*_sec`), nunca
como decimal. La conversión a decimal ocurre solo dentro del motor de cálculo.
Es lo que registra el topógrafo en su cartera, y evita pérdida por redondeo en
la ida y vuelta.

**Precisión numérica:** coordenadas a 3 decimales, cotas a 4, distancias a 3.

**`relative_precision` se guarda como texto ya formateado** (`"1:5000"`,
`"1:∞"`). Simplifica la lectura, pero impide ordenar numéricamente. Ver
[deuda técnica](#11-deuda-técnica-conocida).

### `polygonal_processes` — columnas de resultado

Estas las escribe `savePolygonalProcessAction` tras cada cálculo:

| Columna | Contenido |
|---|---|
| `angular_error_seconds` | Error angular en segundos de arco |
| `linear_error` | Error de cierre lineal en metros |
| `perimeter` | Perímetro total |
| `relative_precision` | Precisión formateada |
| `meets_tolerance` | Si cumple el orden del proyecto |

`status` puede ser `draft`, `in_progress`, `calculated`, `closed` o `rejected`.
Los dos últimos son terminales.

---

## 5. Seguridad

### Row Level Security

Las cinco tablas tienen RLS activo, con políticas para SELECT, INSERT, UPDATE y
DELETE.

`projects` filtra por `user_id = auth.uid()`. Las tablas hijas heredan la
propiedad mediante `EXISTS` sobre el proyecto contenedor:

```sql
exists (
  select 1 from public.projects
  where projects.id = polygonal_processes.project_id
    and projects.user_id = auth.uid()
)
```

> **No añada filtros por `user_id` en las consultas de la aplicación.** RLS ya
> lo hace; duplicarlo genera código redundante y da falsa sensación de que la
> seguridad vive en la capa de aplicación.

### Inmutabilidad de procesos cerrados

El PRD (§ 4.6) exige que un proceso `closed` o `rejected` sea inmutable. La
garantía se aplica en **dos capas**:

**Aplicación** — `savePolygonalProcessAction` y `closePolygonalProcessAction`
rechazan cualquier operación sobre un proceso cerrado.

**Base de datos** — triggers `BEFORE UPDATE/DELETE`
(`supabase/migrations/20260727180000_immutable_closed_processes.sql`) que
rechazan la escritura, incluidas las estaciones del proceso.

La segunda capa es la que cuenta. La clave publicable de Supabase es pública por
diseño: cualquier sesión válida puede llamar a la API REST directamente y
saltarse las Server Actions. Antes de esos triggers, un `UPDATE` sobre un
proceso cerrado tenía éxito.

Los triggers permiten la transición *hacia* cerrado —el cierre mismo es un
`UPDATE`— y bloquean todo cambio posterior.

> **Consecuencia para el seed:** los procesos se crean abiertos, se les cargan
> las estaciones y se cierran al final. Insertarlos ya cerrados hace fallar la
> carga de estaciones.

### Secretos

`SUPABASE_SECRET_KEY` se usa **solo** en `scripts/seed.mjs`. Ningún archivo de
`src/` lo referencia. El cliente usa exclusivamente
`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.

---

## 6. Motor de cálculo

`src/lib/calculations/` contiene **funciones puras**: sin React, sin hooks, sin
Supabase. Solo matemática. Es la regla más importante del proyecto — permite
testear los algoritmos de forma aislada y es lo que sostiene la monografía.

| Archivo | Contenido |
|---|---|
| `angles.ts` | `dmsToDecimal`, `decimalToDms`, `normalizeAzimuth`, `degreesToSeconds`, `cosDeg`, `sinDeg` |
| `polygonal.ts` | `computePolygonal` — el motor completo |
| `tolerances.ts` | `ANGULAR_TOLERANCE_K`, `MIN_RELATIVE_PRECISION`, `angularTolerance`, `minRelativePrecision` |

### `computePolygonal`

Punto de entrada único. Recibe un `PolygonalInput` (tipo, punto de partida,
orden, método y estaciones) y devuelve un `PolygonalResult` con la verificación
angular, el cierre lineal y las coordenadas corregidas de cada estación.

Es **total**: nunca lanza. Ante datos incompletos devuelve el resultado con los
campos correspondientes en `null`, y la interfaz muestra «Datos incompletos».

Ramas por tipo:

| Tipo | Verificación |
|---|---|
| `closed` | Suma angular contra teórica + cierre lineal |
| `open_controlled` | Cierre contra el punto de llegada conocido |
| `open_uncontrolled` | Ninguna: `relativePrecision` y `meetsTolerance` quedan en `null` |

### Métodos de corrección

`bowditch` (proporcional a la longitud), `transit` (proporcional a las
proyecciones) y `crandall` (mínimos cuadrados sobre distancias).

### Tolerancias

Viven en `tolerances.ts`, **nunca hardcodeadas en componentes**:

| Orden | K angular (″) | Precisión mínima |
|---|---|---|
| `primer_orden` | 1 | 1:100.000 |
| `segundo_orden` | 5 | 1:20.000 |
| `tercer_orden` | 15 | 1:5.000 |
| `ordinario` | 30 | 1:3.000 |

Tolerancia angular = K·√n, donde n es el número de ángulos medidos.

### Umbral de cierre exacto

`computePolygonal` considera exacto un cierre con `linearError <= 1e-9` m y
devuelve `relativePrecision: Infinity`, que se presenta como `1:∞`.

El umbral existe porque un cierre geométricamente exacto deja un residuo de
punto flotante (~1e-14) que producía precisiones absurdas como
`1:17222920531038532`. Un nanómetro está diez órdenes de magnitud por debajo de
cualquier precisión instrumental real.

---

## 7. Validación

`src/lib/validators/polygonal.ts` implementa dos capas (PRD § 5). También son
funciones puras.

### Capa 1 — captura

`validatePolygonalStation(station, expect)` valida una estación mientras se
teclea. `expect` indica qué celdas son obligatorias según el tipo de poligonal y
la posición de la estación.

| Regla | Resultado |
|---|---|
| Distancia ≤ 0 o > 1000 m | Error, bloquea |
| Distancia obligatoria ausente | Error, bloquea |
| Minutos o segundos fuera de 0-59 | Error, bloquea |
| Ángulo obligatorio incompleto | Error, bloquea |
| Ángulo de 0° o 360° exacto | Advertencia, no bloquea |

### Capa 2 — cierre

`evaluatePolygonalClosure(type, result, captureHasErrors)` decide si un proceso
puede cerrarse y con qué desenlace. **Es la regla de negocio central del
módulo.**

Devuelve `{ canClose, mustReject, blocked, messages }`:

| Situación | `blocked` | `canClose` | `mustReject` |
|---|---|---|---|
| Errores de captura pendientes | ✔ | ✘ | ✘ |
| Cerrada: falta cálculo | ✔ | ✘ | ✘ |
| Cerrada: error angular fuera de tolerancia | ✔ | ✘ | ✘ |
| Cerrada: precisión relativa insuficiente | ✘ | ✔ | ✔ |
| Cerrada: cumple todo | ✘ | ✔ | ✘ |
| Abierta con control: fuera de tolerancia | ✘ | ✔ | ✔ |
| Abierta sin control: estaciones calculadas | ✘ | ✔ | ✘ |

La asimetría es deliberada: un **error angular** invalida el levantamiento y
bloquea el cierre; una **precisión insuficiente** significa que el trabajo se
hizo pero no alcanza la calidad exigida, y se documenta como rechazado.

---

## 8. Sistema de diseño

`src/components/design-system/` — componentes propios sobre Tailwind v4. **No
usar shadcn/ui ni librerías de componentes o iconos.** Los SVG se escriben a
mano, inline.

`Alert` · `Badge` · `Breadcrumbs` · `Button` · `Card` · `DmsInput` ·
`EmptyState` · `Input` · `KpiCard` · `Logo` · `Modal` · `Select` ·
`StatusIndicator` · `Tabs` · `Textarea`

### Tokens

Definidos en `@theme` de `src/app/globals.css`:

| Token | Uso |
|---|---|
| `--color-primary-500/600/700` | Azul de marca |
| `--color-success/warning/danger-500` | Estados |
| `--color-neutral-*` | Grises |
| `--font-display` | Space Grotesk, títulos |
| `--font-mono` | Monoespaciada del sistema, datos numéricos |

### Reglas tipográficas

- **Títulos** (`h1`–`h3`): Space Grotesk en `primary-600`, aplicado en
  `@layer base`.
- **Cuerpo**: `system-ui`.
- **Datos numéricos**: `font-mono` con `tabular-nums`, para que los dígitos
  alineen en columna.

> **Toda regla CSS global debe ir dentro de `@layer`.** Una regla fuera de capa
> gana sobre todas las utilidades de Tailwind y las anula en silencio. Ya
> ocurrió una vez en este proyecto: la regla de títulos, fuera de capa,
> sobreescribía cualquier `text-*` explícito sin error visible.

### Fuentes

Space Grotesk se carga con `next/font/google`, que la descarga durante el build
y la **autohospeda**. No hay peticiones a terceros en tiempo de ejecución.

### Responsive

Punto de corte principal: 768 px. Las tablas densas de escritorio se convierten
en tarjetas por elemento en móvil — el patrón está en `stations-table.tsx`.
Objetivo declarado: la captura se hace en campo, desde el teléfono.

### Accesibilidad

- Contraste WCAG AA: 4.5:1 en texto, 3:1 en componentes gráficos.
- Todo control con foco visible; ningún `outline: none` sin sustituto.
- `prefers-reduced-motion` respetado.
- Elementos decorativos con `aria-hidden` y `pointer-events-none`.
- El color nunca es el único canal: los indicadores llevan texto para lectores
  de pantalla.

> **Los tres colores de la paleta se ajustaron para cumplir AA.** Los valores
> originales fallaban como texto sobre blanco: `primary-500` daba 4.42:1,
> `danger-500` 3.82:1 y `success-500` 2.87:1, todos por debajo de 4.5:1.
> Afectaba a los botones primarios, al veredicto de cierre y a los mensajes de
> error de formulario.
>
> Al elegir un tono no basta con medirlo sobre blanco: estos colores también se
> usan como texto sobre su propio fondo teñido (`Badge` al 10 %, la banda del
> veredicto al 5 %). Un verde que cumplía sobre blanco con 4.78:1 se quedaba en
> 4.21:1 sobre el badge. **Verifique los tres contextos** antes de cambiar un
> token de estado.

---

## 9. Pruebas

117 tests en Vitest, entorno `node` **sin jsdom**.

| Archivo | Tests | Cubre |
|---|---|---|
| `lib/calculations/polygonal.test.ts` | 17 | Motor de cálculo, los tres tipos y métodos |
| `lib/calculations/angles.test.ts` | 8 | Conversiones DMS ↔ decimal |
| `lib/calculations/tolerances.test.ts` | 2 | Tolerancias por orden |
| `lib/validators/polygonal.test.ts` | 33 | Captura y cierre |
| `lib/process-list.test.ts` | 28 | Filtrado, orden y conteo del listado |
| `lib/utils/format.test.ts` | 13 | Fecha relativa y sus fronteras |
| `components/polygonal/closure-verdict.test.tsx` | 5 | Decisión del veredicto |
| `components/design-system/breadcrumbs.test.tsx` | 5 | Resolución de la ruta |
| `components/design-system/tabs.test.ts` | 6 | Construcción de enlaces |

### Cómo se testea la interfaz

Sin jsdom, no se testea el render. El patrón es **extraer la decisión como
función pura** y testear esa función: `verdictFor` en `closure-verdict.tsx`,
`resolveBreadcrumbs` en `breadcrumbs.tsx`, `tabHref` en `tabs.tsx`.

El comportamiento visual se verifica con Playwright contra la aplicación real,
de forma manual durante el desarrollo.

### Prueba manual de extremo a extremo

[`docs/testing/manual-e2e-poligonal.md`](../testing/manual-e2e-poligonal.md)
tiene el recorrido completo del módulo poligonal.

---

## 10. Cómo extender

### Añadir un módulo de proceso (nivelación, asentamientos)

El módulo poligonal es la plantilla. Un módulo nuevo necesita:

1. **Migración** con su tabla de proceso y su tabla de detalle, con RLS vía
   proyecto y **los triggers de inmutabilidad** equivalentes a los de
   `20260727180000_immutable_closed_processes.sql`.
2. **Tipos** en `src/types/`, y regenerar `database.ts`.
3. **Algoritmo** en `src/lib/calculations/<modulo>.ts` — función pura, con sus
   tests. Añadir sus tolerancias a `tolerances.ts`.
4. **Validadores** en `src/lib/validators/<modulo>.ts`, con las dos capas y sus
   tests.
5. **Server Actions** con las guardas de proceso cerrado.
6. **Editor** en `src/components/<modulo>/`, reutilizando el design system.
7. **Ruta** `src/app/(app)/projects/[id]/<modulo>/[pid]/`.
8. **Manual**: mover la sección de «Módulos pendientes» al cuerpo y capturar.

Antes de empezar, redactar el PRD de la fase en `docs/prds/`, según
[`docs/method.md`](../method.md).

### Reglas que no se negocian

- `src/lib/calculations/` permanece puro.
- Ángulos en tres campos, nunca decimal en la base.
- Procesos cerrados inmutables, con la garantía en la base de datos.
- Tolerancias centralizadas en `tolerances.ts`.
- Interfaz en español (Colombia), zona horaria `America/Bogota`.
- `npm run typecheck` tras cada cambio.
- Commits en español: `feat:`, `fix:`, `refactor:`, `docs:`, `test:`.

---

## 11. Deuda técnica conocida

Registrada durante el desarrollo, ninguna bloqueante:

**`relative_precision` se persiste como texto ya formateado.** El mismo proceso
se lee `1:1001` en el listado y `1:1.001` en el editor, porque hay cuatro copias
de `formatPrecision` con criterios distintos.

El problema de ordenamiento que esto causaba ya está sorteado: `parsePrecision`
(`src/lib/process-list.ts`) extrae el valor numérico antes de comparar, para que
`1:46` no quede después de `1:1001`. Pero es una solución en la capa de
presentación. Lo que corresponde es extraer un formateador único a
`src/lib/utils/format.ts` y evaluar guardar el número en vez de la cadena.

**Los KPI del dashboard no filtran por estado del proyecto.** «Procesos
calculados» y «Fuera de tolerancia» cuentan sobre todos los procesos del
usuario, sin excluir los de proyectos archivados.

**El helper `Block` está duplicado** en los dos `loading.tsx`. Con las fases 4-6
serán cinco o más: conviene extraerlo a `design-system/skeleton.tsx` antes.

**Las migas del editor viven dentro del Client Component**, lo que obliga a
pasar `projectName` a través de la frontera cliente/servidor. Los editores de
nivelación y asentamientos repetirían el patrón; lo correcto es renderizarlas
desde el `page.tsx`.

**Faltan `loading.tsx`** en el editor de poligonal y en «nuevo proyecto», que
son las rutas con más trabajo de servidor.

**Dos sistemas de foco conviven**: el `ring` propio de los componentes del
design system y el `outline` de la regla base. Ambos accesibles y del mismo
color; conviene converger.

**`ProjectCard` no tiene hover de fondo**, a diferencia de `ProcessCard`.

**El fixture «Enlace P1-P3»** del seed tiene su punto de llegada redondeado a 5
decimales, lo que deja un error residual de 3.8e-7 m y una precisión de
`1:528479954`. El motor lo clasifica correctamente; el dato del fixture es el
impreciso.
