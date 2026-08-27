# Documentación técnica — TopoField

Documento de referencia para desarrollar y mantener TopoField. Describe cómo
está construido el sistema, qué decisiones lo gobiernan y dónde tocar para
extenderlo.

**Última actualización:** 2026-08-26 · Las 6 fases del PRD implementadas · 390 tests ·
**desplegado en producción** ([topofield-app.vercel.app](https://topofield-app.vercel.app)).

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
12. [Manual de usuario en la app](#12-manual-de-usuario-en-la-app)
13. [Despliegue](#13-despliegue)

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
| 4 | Nivelación | cerrada |
| 5 | Asentamientos | cerrada |
| 6 | Cierre, informes, exportación | cerrada |

---

## 2. Puesta en marcha

```bash
npm install
npx supabase start   # levanta PostgreSQL local
npm run seed         # datos de ejemplo (lee .env.local)
npm run dev
```

Credenciales de los datos de ejemplo: `seed@topofield.local` / `seed1234`.

**El registro exige un código de invitación.** Defina `SIGNUP_INVITE_CODE` en
`.env.local` (ver `.env.example`); sin esa variable nadie puede registrarse, ni
en local. Y como la confirmación de correo está activa, el mensaje se lee en
Mailpit: `http://127.0.0.1:54324`.

### Comandos

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Compilación de producción |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm run test` | Vitest (una pasada) |
| `npm run test:watch` | Vitest en modo continuo |
| `npm run seed` | Siembra los datos de ejemplo (`tsx --env-file=.env.local scripts/seed.mjs`) |
| `npx supabase db reset` | Recrea la base y reaplica migraciones |
| `npx supabase gen types typescript --local > src/types/database.ts` | Regenera tipos |
| `npx tsx --env-file=.env.local scripts/reparar-resultados-estacion.mjs` | Detecta procesos cuyas estaciones no tienen resultados persistidos y los recalcula. Simula por defecto; escribe con `--aplicar`. Salta los cerrados y rechazados |

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
│   │   ├── manual/          manual de usuario (§ 12)
│   │   └── projects/[id]/
│   │       ├── polygonal/[pid]/
│   │       ├── leveling/[pid]/
│   │       ├── sites/[siteId]/          alta y editor del lugar
│   │       ├── settlement/[siteId]/     panel de análisis y visitas
│   │       └── reports/                 informes: alta, vista y ruta imprimible
│   ├── design-system/       galería del sistema de diseño (404 en producción)
│   ├── layout.tsx           layout raíz, carga de fuentes
│   ├── globals.css          tokens de tema y capas base
│   └── icon.svg             favicon
├── public/manual/           capturas que sirve la página /manual
├── components/
│   ├── design-system/       componentes propios reutilizables
│   ├── polygonal/           editor de poligonales
│   ├── leveling/            editor de nivelación
│   ├── settlement/          lugar, visitas, semáforo, gráfica
│   ├── reports/             alta de informe y botón de impresión
│   └── projects/            dashboard y gestión de proyectos
├── lib/
│   ├── calculations/        algoritmos puros
│   ├── validators/          reglas de validación
│   ├── design/              escalas de gráfica, marcadores y contraste
│   ├── export/              libros de Excel de los tres módulos (§ 4.8)
│   ├── reports/             elegibilidad de procesos para informes (§ 4.7)
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
| `(app)/projects/[id]/leveling/new/actions.ts` | `createLevelingProcessAction` |
| `(app)/projects/[id]/leveling/[pid]/actions.ts` | `saveLevelingProcessAction`, `closeLevelingProcessAction` |
| `(app)/projects/[id]/sites/actions.ts` | `createSiteAction`, `saveSiteAction`, `closeSiteAction` |
| `(app)/projects/[id]/settlement/[siteId]/actions.ts` | `createVisitAction`, `saveVisitAction`, `closeVisitAction` |
| `(app)/projects/[id]/sites/[siteId]/point-actions.ts` | `createPointAction`, `savePointAction`, `deletePointAction` |
| `(app)/projects/[id]/reports/actions.ts` | `createReportAction`, `deleteReportAction` |

### Informes y exportación (§ 4.7 y § 4.8 del PRD)

Son las dos salidas del producto y funcionan con criterios opuestos a
propósito.

**El informe no se guarda: se reconstruye.** `reports` almacena qué procesos
incluye y en qué orden, nunca una copia de sus datos ni un PDF. Reabrirlo
vuelve a leer los procesos y a componer el documento. Eso es seguro **solo
porque un informe únicamente puede incluir trabajos cerrados**, que son
inmutables por trigger de base: dentro de un año dará exactamente lo mismo.
Está verificado comparando el hash del contenido en dos lecturas.

La regla vive en `lib/reports/eligibility.ts` como función pura con tests, y se
aplica **dos veces**: al pintar el selector y otra vez dentro de
`createReportAction`, porque el cliente solo manda ids y uno manipulado podría
enviar el de un proceso abierto. Un proceso `rejected` nunca es elegible — lo
exige el § 4.6 desde la Fase 3, y esta es la primera fase que puede ejercerlo.
Para asentamientos la unidad es el **lugar cerrado**, no la visita: un lugar
activo admite visitas nuevas y su informe cambiaría.

**El PDF lo produce el navegador.** No hay motor de PDF en el servidor: la ruta
`/projects/[id]/reports/[reportId]/print` se maqueta con `@media print` y el
usuario hace «Imprimir → Guardar como PDF». Se descartó Playwright en el
servidor porque Chromium no cabe en una función serverless de Vercel sin
`@sparticuz/chromium`, un riesgo de despliegue a cambio de ahorrar un clic. Las
reglas de impresión están en `@layer components` de `globals.css`, no sueltas:
una regla fuera de capa gana sobre las utilidades de Tailwind y las anula en
silencio (§ 8).

**La exportación a Excel sí es del servidor**, en Route Handlers
(`.../export/route.ts` en los tres módulos) porque devuelve un binario con
`Content-Disposition`. A diferencia del informe, está disponible en
**cualquier estado** del proceso —lo pide el § 4.8—, y las celdas sin calcular
quedan vacías en lugar de a cero: en topografía un `0.000` de coordenada es una
posición, no una ausencia.

Los libros se construyen en `lib/export/`, separados del Route Handler para
poder testearlos sin levantar el servidor. Dos detalles que se rompen fácil:

- Los `DECIMAL` de Postgres llegan como **cadena** vía PostgREST. Hay que
  convertirlos a número antes de escribirlos, o Excel guarda texto y la celda
  no se puede sumar.
- El nombre del archivo se translitera a ASCII: viaja en una cabecera donde los
  acentos y las comillas rompen el parseo de algunos navegadores.

---

## 4. Modelo de datos

Once tablas en `public`:

```
profiles         perfil del usuario (1:1 con auth.users)
projects         proyecto topográfico
├── reference_points      puntos de coordenadas conocidas
├── sites                 lugar de monitoreo (entidad transversal, Fase 5)
│   ├── settlement_points     catálogo de puntos de control
│   └── settlement_visits     visitas sucesivas en el tiempo
│       └── settlement_readings   lectura por punto en cada visita
├── polygonal_processes   levantamiento poligonal — site_id NOT NULL
│   └── polygonal_stations    estaciones del levantamiento
├── leveling_processes    levantamiento de nivelación — site_id NOT NULL
│   └── leveling_readings     lecturas de la libreta
└── reports               informes emitidos (Fase 6)
```

**`reports` no guarda los datos del informe**, solo qué trabajos incluye y en
qué orden (`included_processes`, JSONB). Se aparta del `§3.2` del PRD principal
en tres puntos, enmendados allí: no existe `file_url` —el PDF no se almacena,
lo produce el navegador—, `project_id` es `NOT NULL` y cada entrada guarda su
`order`. El `name` se congela al emitir, para que un proceso renombrado después
conserve en el informe el nombre con el que salió.

**`sites` (el lugar) es transversal a los tres módulos**, no propia del
control de asentamientos. `polygonal_processes` y `leveling_processes` tienen
`site_id NOT NULL`: todo proceso pertenece a un lugar, aunque sea el lugar
genérico `General` que la migración crea por backfill (ver
[deuda técnica](#11-deuda-técnica-conocida)). El lugar reemplaza a la tabla
`settlement_systems` del PRD principal `§3.2` — decisión registrada en
`docs/prds/04-asentamientos.md`, decisión #6: guarda nombre, `structure_type`
y los siete umbrales de alerta, así que una tabla aparte para lo mismo sobraba.

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

### `settlement_readings` — columnas de resultado

Igual que `polygonal_processes`, los cálculos se persisten para que los
informes de la Fase 6 los lean sin recalcular:

| Columna | Contenido |
|---|---|
| `partial_settlement` | Asentamiento desde la visita anterior, en mm (signo: negativo = descenso) |
| `accumulated_settlement` | Asentamiento desde la línea base (C0), en mm |
| `velocity` | mm/mes, con los días reales entre visitas (`DAYS_PER_MONTH = 30.4375`) |
| `alert_status` | `normal` \| `caution` \| `alert` \| `alarm` — la peor clasificación entre velocidad y acumulado |

`settlement_visits.status` puede ser `draft`, `calculated` o `closed` — sin
`rejected`: una visita no se rechaza, se cierra o no. `sites.status` es
`active` o `closed`.

---

## 5. Seguridad

### Row Level Security

Las diez tablas tienen RLS activo, con políticas para SELECT, INSERT, UPDATE y
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

**`settlement_readings` necesitó su propia función**, no la genérica. El
trigger de cabecera (`sites`, `settlement_visits`) reutiliza
`reject_update_on_closed_process()` tal cual — es genérica, solo mira
`old.status`, y `'closed'` está en el conjunto de estados que rechaza incluso
sin `'rejected'` (`settlement_visits.status` no lo tiene: una visita se
cierra o no, nunca se rechaza). Pero la función de las filas hijas de
poligonal y nivelación (`reject_write_on_closed_process_station()`) consulta
`public.polygonal_processes` por nombre de tabla, así que no sirve para
`settlement_readings`: tiene su propia función análoga que consulta
`settlement_visits`. Verificado con un ataque real vía REST directo (PATCH,
DELETE) contra una visita cerrada: las tres vías —lectura, cabecera de
visita— quedan bloqueadas con el mismo código `23001`.

> **Consecuencia para el seed:** los procesos se crean abiertos, se les cargan
> las estaciones y se cierran al final. Insertarlos ya cerrados hace fallar la
> carga de estaciones.

### Secretos

`SUPABASE_SECRET_KEY` se usa **solo** en `scripts/seed.mjs`. Ningún archivo de
`src/` lo referencia. El cliente usa exclusivamente
`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.

Sigue siendo cierto tras añadir el proyecto de ejemplo: lo crea el cliente del
propio usuario, porque las políticas RLS de inserción ya le permiten crear sus
propios datos. No hizo falta introducir un cliente con la llave secreta en la
aplicación, y conviene que siga sin haberlo.

### Registro por invitación

`SIGNUP_INVITE_CODE` guarda el código que hay que introducir para crear una
cuenta. **Sin el prefijo `NEXT_PUBLIC_`**: con él acabaría en el JavaScript que
se envía al navegador y cualquiera podría leerlo. Se comprueba solo en el Server
Action (`src/app/(auth)/sign-up/actions.ts`), nunca en el cliente.

**Si la variable no está definida, el registro queda bloqueado**, no abierto. Un
despliegue al que se le olvidó configurarla debe fallar de forma visible —nadie
puede registrarse— en lugar de quedar con la puerta abierta sin que nadie lo
note. Lo cubre `src/lib/validators/sign-up.test.ts`.

No se usa comparación en tiempo constante: protegería frente a un atacante capaz
de medir microsegundos de latencia de red repetidamente, y la complejidad no se
justifica aquí. Queda escrito para que la omisión sea una decisión.

### Confirmación de correo y `/auth/callback`

`@supabase/ssr` usa PKCE, así que el enlace del correo trae un `code` que hay
que canjear por una sesión. De eso se encarga la Route Handler
`src/app/auth/callback/route.ts`, que además crea el proyecto de ejemplo.

Dos detalles que rompen el flujo en silencio si se olvidan:

- El destino de `emailRedirectTo` **debe estar en las «Redirect URLs»** de
  Supabase (`additional_redirect_urls` en local). Si no está, Supabase no da
  error: redirige a `site_url` y el canje nunca ocurre.
- `/auth/callback` no puede sufrir el desvío del proxy que manda al dashboard a
  quien ya tiene sesión. Por eso está en `RUTAS_SIN_DESVIO` en `src/proxy.ts`.

**El dashboard reintenta la demo si falta.** El callback es el camino normal,
pero si falla —o nunca se ejecuta, que fue lo que pasó al desplegar con el
`Site URL` mal puesto—, `src/app/(app)/dashboard/page.tsx` la crea en la
primera visita. No puede duplicar: `crearProyectoDemo` reclama
`demo_seeded_at` con un UPDATE condicionado a NULL, así que de varias llamadas
simultáneas solo una gana. Comprobado con tres peticiones a la vez.

---

## 6. Motor de cálculo

`src/lib/calculations/` contiene **funciones puras**: sin React, sin hooks, sin
Supabase. Solo matemática. Es la regla más importante del proyecto — permite
testear los algoritmos de forma aislada y es lo que sostiene la monografía.

| Archivo | Contenido |
|---|---|
| `angles.ts` | `dmsToDecimal`, `decimalToDms`, `normalizeAzimuth`, `degreesToSeconds`, `cosDeg`, `sinDeg` |
| `polygonal.ts` | `computePolygonal` — el motor completo |
| `leveling.ts` | `computeLeveling` — libreta, corrección proporcional, cierre, ida y vuelta |
| `settlement.ts` | `computeSettlements`, `computeDifferentials`, `classifyAlert`, `computeTrends`, `computeHistory` |
| `tolerances.ts` | `ANGULAR_TOLERANCE_K`, `MIN_RELATIVE_PRECISION`, `LEVELING_TOLERANCE_K`, `DAYS_PER_MONTH`, `SETTLEMENT_THRESHOLD_PRESETS`, `angularTolerance`, `minRelativePrecision`, `levelingTolerance`, `thresholdsFor` |

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

### `computeSettlements`, `computeDifferentials`, `classifyAlert`

El motor de asentamientos, en `settlement.ts`, se apoya en tres piezas
verificadas independientemente contra el marco teórico del dominio (ver
`docs/prds/04-asentamientos.md`, «Hallazgos de la verificación»):

- **Asentamiento** — `Δs_parcial = (cota_n − cota_{n-1}) × 1000`,
  `Δs_acumulado = (cota_n − C0) × 1000`, ambos en mm. Un signo positivo es
  levantamiento y se muestra como tal, no como valor absoluto.
- **Velocidad** — `V = Δs_parcial / (días_entre_visitas / DAYS_PER_MONTH)`,
  con `DAYS_PER_MONTH = 30.4375` (`365.25/12`). Si el intervalo es 0 días,
  devuelve `null`, nunca `Infinity` ni `NaN`. El marco teórico calcula esta
  columna mal —copia el parcial cuando el intervalo «parece» un mes— y
  ninguno de sus números entra como fixture de test; los tests derivan el
  valor esperado por cálculo directo con cinco intervalos reales (28, 30,
  31, 61, 92 días).
- **`classifyAlert`** — la peor clasificación entre velocidad y acumulado
  gana, evaluada en las fronteras exactas de cada umbral (`>=`, no `>`). Los
  estados del marco teórico tampoco sirven como fixture: no se derivan de
  ningún juego de umbrales consistente (mismo documento, hallazgo 3).

`computeDifferentials` calcula la distorsión angular entre cada par de
puntos como `1/((L×1000)/Δs_diferencial)`; un diferencial de 0 da `1/∞`,
clasificado normal, y un par sin coordenadas en alguno de sus puntos queda
fuera de la tabla en vez de calcularse con `L=0` (que daría una distorsión
infinita y aparentaría normalidad falsa).

`computeHistory` compone todo lo anterior sobre la serie completa de un
lugar: ordena las visitas **por fecha, no por `visit_number`** —hay un test
que fija ese contrato— y añade `computeTrends`, que solo emite tendencia
(`accelerating` / `converging`) con al menos tres visitas (dos velocidades
que comparar). Con menos, el punto queda sin indicador: devolver
`"converging"` afirmaría una convergencia que nadie ha comprobado.

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

### `validators/settlement.ts` — la capa estadística no bloquea

Tres capas, igual que el patrón, pero con una diferencia deliberada frente a
poligonal y nivelación: la capa estadística (semáforo, tendencia) **nunca
bloquea nada**.

- **Captura** — cota vacía o no numérica: error. Cota que se aleja más de 1 m
  de C0: advertencia, no error (podría ser un terraplén real sobre turba; el
  error de transcripción es la lectura más probable, pero no la única). Fecha
  de visita anterior o igual a la visita previa: error — evita un intervalo
  negativo que invertiría el signo de la velocidad. Punto duplicado o
  fantasma en la misma visita: error.
- **Cierre** — exige lectura de todos los puntos del catálogo; una visita
  cerrada es el registro inmutable de una fecha, y cerrarla incompleta deja
  un hueco que ya no se puede rellenar.
- **Estadística** — clasifica el semáforo, pero **no participa en si se
  puede guardar o cerrar**. Un punto en alarma se guarda y se cierra con
  normalidad: es el hallazgo que el monitoreo existe para documentar, no un
  error de captura. Verificado con un test explícito
  (`validators/settlement.test.ts`, «NO bloquea el cierre por un
  asentamiento en alarma») y con las Server Actions, que solo invocan
  `validateVisitCapture`/`validateVisitClose` — ninguna de las dos consulta
  `alert_status`.

---

## 8. Sistema de diseño

`src/components/design-system/` — componentes propios sobre Tailwind v4. **No
usar shadcn/ui ni librerías de componentes o iconos.** Los SVG se escriben a
mano, inline.

`Alert` · `Badge` · `Breadcrumbs` · `Button` · `Card` · `DmsInput` ·
`EmptyState` · `Input` · `KpiCard` · `Logo` · `Modal` · `Select` ·
`StatusIndicator` · `Tabs` · `Textarea`

### Contrato de tokens

| Escalón | Rol | Uso válido |
|---|---|---|
| `-50` | Fondo teñido claro | Solo fondo. Nunca texto. |
| `-100`, `-200` | Fondo y bordes decorativos | Nunca texto sobre blanco. No sirve como límite de un control. |
| `-400` | Borde de control | Límite de campos de formulario: cumple 3:1. |
| `-500` | Base accesible | Texto sobre blanco · fondo bajo texto blanco · borde · punto de estado. |
| `-600` | Texto y profundidad | Texto sobre blanco y sobre `-50` · `hover:` de un fondo `-500`. |
| `-700` | Texto de máximo contraste | Texto sobre `-50` · `active:` de un fondo `-500`. |

`neutral-500` es la excepción deliberada: se usa como texto secundario sobre
blanco y cumple AA en ese uso.

`--font-display` (Space Grotesk) para títulos, `--font-mono` para datos
numéricos.

### La regla de los tres contextos

Un token de estado se usa de tres maneras, y **cumplir en una no implica cumplir
en las otras**:

1. **Texto sobre blanco** — 4.5:1.
2. **Texto sobre su propio fondo teñido** — 4.5:1. `Badge` usa
   `bg-success-500/10 text-success-500`: el fondo efectivo es el token al 10 %
   sobre blanco, no blanco. *Este es el contexto que falló y que ninguna
   revisión manual medía.*
3. **Fondo bajo texto blanco** — 4.5:1.

Puntos y bordes de control son elementos gráficos: 3:1.

`/10` es la única transparencia sancionada. Otra crea un contexto nuevo que hay
que declarar y medir.

**Excepción de WCAG 1.4.3:** los componentes de interfaz inactivos no tienen
requisito de contraste. El botón deshabilitado da 3.71:1 y es correcto así.

### Cómo se verifica el contraste

`src/lib/design/contrast.ts` son funciones puras (hex → RGB, luminancia, razón,
y `composite()` para resolver un fondo teñido antes de medirlo).
`src/lib/design/pairings.ts` declara las parejas que el sistema usa de verdad.

La ruta `/design-system` las mide y las muestra. Es herramienta de desarrollo:
devuelve 404 en producción y hace falta sesión para abrirla.

Los tokens se **leen de `globals.css` en tiempo de render**, no se duplican en
TypeScript: la hoja de estilos sigue siendo la única fuente de verdad, así que
las mediciones no pueden desincronizarse de la paleta real.

**Al tocar la paleta o añadir una pareja nueva** —un `Badge` con un tono nuevo,
un fondo teñido distinto— hay que declararla en `pairings.ts` y abrir la página.
No hay prueba automática que lo obligue.

### Qué entra en el sistema de diseño

**Un componente pertenece al sistema de diseño si no conoce el dominio de
TopoField.** Recibe cadenas, `href`s y uniones definidas en su propio archivo.
No importa nada de `@/types/*` ni de `@/lib/*` salvo `cn`.

Es un criterio verificable leyendo los imports, y explica la separación que ya
existe: `Breadcrumbs` recibe `{ label, href }[]` y sirve a cualquier jerarquía;
`ProcessTable` importa `PolygonalProcess` y conoce estados y tolerancias.

Consecuencia para los módulos nuevos: la tabla de nivelación **no** va al
sistema de diseño. Si comparte estructura con la de poligonales, lo que se
extrae es el patrón, no un componente genérico parametrizado.

### Patrones canónicos

**Filtro excluyente** — `<Link>` + `aria-current`. El filtro es navegación:
debe poder abrirse en pestaña nueva y compartirse. Referencia:
`dashboard-filter.tsx`. Usar `<button>` + `router.push` solo si el control
necesita estado de cliente que un enlace no pueda expresar.

**Foco visible** — un solo sistema: el `outline` de `@layer base`, que cubre
`a`, `button`, `summary`, `input`, `select` y `textarea` con `:where()`
(especificidad cero). Los componentes **no declaran su propio `ring`**.

**Estado de carga** — se deshabilita el control y cambia su texto
(«Guardando…»), sin spinner: el cambio de texto lo anuncia el lector de
pantalla, un spinner decorativo no.

**Indicador de estado** — el color nunca es el único canal. `StatusIndicator`
es la referencia: punto `aria-hidden` más etiqueta de texto real, no solo
`aria-label`. Desde la Fase 5 admite dos modos: `status` (3 niveles —
poligonal y nivelación) o `level` (4 niveles — semáforo de asentamientos), y
el tipo obliga a pasar uno u otro, nunca ninguno ni ambos. El semáforo de 4
niveles añade además **forma** como segundo canal gráfico (círculo,
cuadrado, rombo, triángulo): los cuatro tokens de color cumplen 3:1 contra
blanco individualmente, pero medidos entre sí quedan comprimidos en una
banda estrecha de luminancia (verde/rojo 1.03) que ningún cuarteto de colores
alternativo resuelve — es una limitación estructural de intentar 4 niveles
con contraste AA en una sola escala, no una mala elección de hexadecimales.
Ver `docs/prds/04-asentamientos.md`, hallazgo 5 y decisión #9.

**Tabla en escritorio, tarjetas en móvil** — corte en 768 px. La tarjeta y la
fila muestran **los mismos campos y los mismos valores**; ya falló una vez
(una mostraba `created_at` y la otra `updated_at`). Si la tarjeta necesita
acciones por fila, no se envuelve entera en un `<Link>`: un `<button>` dentro
de un `<a>` es HTML inválido.

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

> **Historial de la paleta.** Los cuatro tokens de estado se ajustaron para
> cumplir AA: `primary-500` daba 4.42:1, `danger-500` 3.82:1, `success-500`
> 2.87:1 y `warning-500` 2.19:1. Después, la primera medición sistemática
> encontró dos casos más que nadie había medido: el borde de los campos de
> formulario (`neutral-200`, 1.43:1) y tres de los cuatro tokens del semáforo.
> Todos corregidos.
>
> Al elegir un tono no basta con medirlo sobre blanco. Verifique los tres
> contextos.

---

## 9. Pruebas

390 tests en 25 archivos, Vitest, entorno `node` **sin jsdom**.

| Archivo | Tests | Cubre |
|---|---|---|
| `lib/calculations/settlement.test.ts` | 44 | Asentamiento parcial/acumulado, velocidad (intervalos 28/30/31/61/92 días), diferenciales, distorsión angular, `classifyAlert`, tendencias, orden cronológico |
| `lib/validators/polygonal.test.ts` | 43 | Captura y cierre de poligonal, `expectStationCapture`, código de punto obligatorio |
| `lib/calculations/leveling.test.ts` | 40 | Motor de nivelación: libreta, corrección proporcional, cierre, ida y vuelta |
| `lib/process-list.test.ts` | 28 | Filtrado, orden y conteo del listado |
| `lib/validators/leveling.test.ts` | 24 | Captura y cierre de nivelación |
| `lib/utils/format.test.ts` | 21 | Fecha relativa y **formateo único de precisión** |
| `lib/validators/settlement.test.ts` | 21 | Captura y cierre de asentamientos — incluye que la alarma no bloquea |
| `lib/calculations/polygonal.test.ts` | 17 | Motor de cálculo, los tres tipos y métodos |
| `lib/calculations/settlement-persistence.test.ts` | 14 | **Qué lecturas hay que reescribir** al recalcular: cambio de solo la alerta, visitas cerradas intactas, velocidad como cadena |
| `lib/calculations/tolerances.test.ts` | 13 | Tolerancias por orden, presets de asentamientos y `thresholdsOf` |
| `lib/export/polygonal-workbook.test.ts` | 13 | Libro de poligonal: tres hojas, decimales, DMS, borrador con celdas vacías |
| `lib/design/chart-scale.test.ts` | 12 | Escala lineal y marcas «nice», incluidos rangos degenerados |
| `lib/validators/sign-up.test.ts` | 10 | Bloqueo de registro sin código de invitación |
| `lib/reports/eligibility.test.ts` | 9 | **Qué puede entrar en un informe**: solo cerrados, nunca un `rejected`, nunca un lugar activo |
| `components/design-system/status-indicator.test.tsx` | 8 | Formas del semáforo de 4 niveles |
| `lib/calculations/angles.test.ts` | 8 | Conversiones DMS ↔ decimal |
| `lib/design/series-markers.test.ts` | 8 | **Diez formas de marcador**: ninguna se repite antes de la serie 11 |
| `lib/export/leveling-workbook.test.ts` | 8 | Libro de nivelación: etiquetas del dominio, orden ida/vuelta |
| `lib/export/settlement-workbook.test.ts` | 8 | Libro de asentamientos: catálogo, códigos en vez de UUID, `1/∞` |
| `(app)/.../leveling/[pid]/actions.test.ts` | 8 | Derivación del estado de cierre en servidor |
| `(app)/.../polygonal/[pid]/actions.test.ts` | 8 | Derivación del estado de cierre en servidor |
| `lib/demo/fixtures.test.ts` | 7 | Fixtures del proyecto de ejemplo |
| `components/design-system/tabs.test.ts` | 6 | Construcción de enlaces |
| `components/design-system/breadcrumbs.test.tsx` | 5 | Resolución de la ruta |
| `components/polygonal/closure-verdict.test.tsx` | 5 | Decisión del veredicto |

La Fase 6 cerró los huecos que la § 11 registraba: `expectStationCapture`,
`niceTicks` con rangos degenerados y `computeDifferentials` con un punto sin
lectura ya tienen cobertura. Lo que **sigue sin tests** es la E/S de los Server
Actions; ver [deuda técnica](#11-deuda-técnica-conocida).

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

### Añadir un módulo de proceso

El módulo poligonal es la plantilla; nivelación y asentamientos ya la
siguieron, así que el patrón está probado tres veces. Un módulo nuevo
necesita:

1. **Migración** con su tabla de proceso y su tabla de detalle, con RLS vía
   proyecto y **los triggers de inmutabilidad** equivalentes a los de
   `20260727180000_immutable_closed_processes.sql`. Si la tabla de detalle no
   cuelga directamente del proceso (como `settlement_readings`, que cuelga de
   `settlement_visits`), la función del trigger de filas hijas
   (`reject_write_on_closed_process_station()`) **no es reutilizable**:
   consulta la tabla de cabecera por nombre. Escriba una función análoga.
2. **Tipos** en `src/types/`, y regenerar `database.ts`.
3. **Algoritmo** en `src/lib/calculations/<modulo>.ts` — función pura, con sus
   tests derivados por cálculo directo, **nunca copiados de un documento de
   referencia sin verificar contra él primero** (asentamientos encontró que
   el marco teórico calculaba mal tanto la velocidad como los estados de
   alerta). Añadir sus tolerancias a `tolerances.ts`.
4. **Validadores** en `src/lib/validators/<modulo>.ts`, con las dos capas de
   captura y cierre, y sus tests. Decida explícitamente si el módulo necesita
   una tercera capa estadística que **no bloquee** captura ni cierre — es el
   caso de asentamientos: un hallazgo alarmante debe poder registrarse.
5. **Server Actions** con las guardas de proceso cerrado y **revalidación de
   la captura en el servidor** desde el primer commit: la clave publicable de
   Supabase es pública por diseño, así que un cliente hostil puede llamar a
   la acción directamente con datos que la interfaz nunca habría enviado.
   Retrasarlo a un retrofit —como pasó con poligonal y nivelación— es deuda
   evitable.
6. **Editor** en `src/components/<modulo>/`, reutilizando el design system.
7. **Ruta** `src/app/(app)/projects/[id]/<modulo>/[pid]/`.
8. **Manual**: escribir su sección **en los dos sitios**
   (`docs/manual/README.md` y `src/app/(app)/manual/`, mismo commit) y
   regenerar capturas con `node docs/manual/capturas.mjs`.

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

**Solo puede registrarse el dueño de la cuenta de Resend.** El remitente de
pruebas `onboarding@resend.dev` únicamente entrega a esa dirección; a cualquier
otra, Resend responde 403 y el correo no sale. Mientras siga así, nadie más
puede crear una cuenta, y los correos que sí salen caen en spam.

Para abrirlo —jurado, compañeros, cualquier prueba con terceros— hay que
verificar un dominio propio en Resend y cambiar el remitente a ese dominio. Es
configuración de paneles, no código. Ver § 13.

**`relative_precision` se persiste como texto ya formateado.** El mismo proceso
se lee `1:1001` en el listado y `1:1.001` en el editor, porque hay cuatro copias
de `formatPrecision` con criterios distintos.

El problema de ordenamiento que esto causaba ya está sorteado: `parsePrecision`
(`src/lib/process-list.ts`) extrae el valor numérico antes de comparar, para que
`1:46` no quede después de `1:1001`. Pero es una solución en la capa de
presentación. Lo que corresponde es extraer un formateador único a
`src/lib/utils/format.ts` y evaluar guardar el número en vez de la cadena.

**`getProcessCountsByProject` no distingue el estado del proceso.** La tarjeta
dice «7 procesos» contando borradores, calculados, cerrados y rechazados por
igual. Desde la Fase 5 cuenta los tres módulos (poligonales, nivelaciones y
lugares de control de asentamientos, un lugar = un trabajo). Sigue sin haber
desglose del tipo «7 procesos (2 cerrados)». Ver también, más abajo, la
entrada sobre el lugar «General» del backfill: el mismo conteo tiene un
segundo problema propio de la Fase 5.

**El helper `Block` está duplicado** en los dos `loading.tsx` que existen
(`dashboard/`, `projects/[id]/`). Nivelación y asentamientos no añadieron
`loading.tsx` propios —ver la entrada siguiente—, así que la duplicación no
creció con la Fase 5, pero sigue sin extraerse a
`design-system/skeleton.tsx`.

**Las migas del editor de poligonal y de nivelación viven dentro del Client
Component**, lo que obliga a pasar `projectName` a través de la frontera
cliente/servidor (`leveling-editor.tsx` repitió el patrón de
`polygonal-editor.tsx`). **Asentamientos no repitió el patrón**: sus rutas
(`sites/[siteId]/page.tsx`, `settlement/[siteId]/page.tsx`) renderizan
`Breadcrumbs` directamente desde el Server Component, que es lo correcto.
Queda pendiente llevar poligonal y nivelación al mismo patrón.

**Faltan `loading.tsx` en los editores.** Ni el de poligonal, ni el de
nivelación, ni los de asentamientos (lugar en `sites/[siteId]`, visita en
`settlement/[siteId]/visits/[visitId]`) tienen `loading.tsx` propio — tampoco
«nuevo proyecto». Son las rutas con más trabajo de servidor y las que más se
beneficiarían de un esqueleto durante la carga.

**`ProjectCard` no tiene hover de fondo**, a diferencia de `ProcessCard`.

**El fixture «Enlace P1-P3»** del seed tiene su punto de llegada redondeado a 5
decimales, lo que deja un error residual de 3.8e-7 m y una precisión de
`1:528479954`. El motor lo clasifica correctamente; el dato del fixture es el
impreciso.

**Cerrado — el semáforo de 4 niveles.** Los cuatro tokens (`semaphore-green`,
`-yellow`, `-orange`, `-red`) cumplen 3:1 individualmente, pero medidos entre
sí los niveles contiguos se separan poco en luminancia (verde/amarillo 1.18,
amarillo/naranja 1.15, naranja/rojo 1.01) y verde/rojo —los dos extremos—
está en 1.03. Se midió también la alternativa de rellenos vivos con anillos
oscuros que esta sección proponía: mejora los pares contiguos pero empeora
verde/rojo (1.065), así que **no hay cuarteto de colores que lo resuelva** —
la causa es estructural, cuatro niveles con AA comprimidos en una banda
estrecha de luminancia. La Fase 5 cierra la deuda con un canal distinto en
vez de perseguir otro cuarteto: `StatusIndicator` en modo `level` añade
**forma** (círculo, cuadrado, rombo, triángulo) como segundo canal gráfico,
además del texto que el sistema de diseño ya exigía. Ver
`docs/prds/04-asentamientos.md`, hallazgo 5 y decisión #9.

**Equilibrado de visuales sin validar.** Es la regla de campo más importante
de la nivelación de precisión (cancela curvatura, refracción y colimación).
No se valida porque compara `d_atrás` con `d_adelante` dentro de una armada y
`leveling_readings.distance_m` guarda una sola distancia por fila.
Implementarlo exige dos columnas por armada o un modelo por armada en vez de
por punto: toca el modelo de datos en producción.

Dos deudas de revalidación en servidor, ambas cerradas durante la Fase 5 y ya
sin rastro que corregir en el código actual:

- **La captura se revalida en el servidor en los tres módulos.**
  `savePolygonalProcessAction`, `saveLevelingProcessAction` y
  `saveVisitAction` revalidan los datos de campo con los validadores puros
  antes de persistir, además de recalcular los resultados — no solo confían
  en lo que el cliente ya validó. Verificado con ataques reales vía HTTP
  directo a las tres acciones (payload con datos inválidos, sesión legítima,
  sin pasar por la UI): las tres rechazan y no mutan la base. Asentamientos
  nació ya con esta garantía (decisión #10 del PRD de fase); poligonal y
  nivelación la recibieron por retrofit.
- **La derivación del estado de cierre vive en el servidor**, no en el
  `asRejected` que enviaba el cliente: el servidor deriva `closed` o
  `rejected` de `meets_tolerance`, que él mismo escribió al guardar. La
  asimetría es deliberada — el cliente puede ser más estricto que el
  servidor, nunca más laxo. Lógica pura en `close-status.ts` de cada módulo,
  con tests.

**Cerrado — comprobado en producción el 2026-08-25.** Quedaba verificar que no
existieran procesos en estado `calculated` con `meets_tolerance` nulo fuera de
los tipos que no evalúan tolerancia, porque la regla de cierre les impediría
cerrarse. Se ejecutó la consulta de abajo contra la nube (`--linked`) antes de
aplicar las migraciones de la Fase 5: **devolvió cero filas**, así que no hay
ningún proceso afectado. Se conserva la consulta porque sigue siendo la
comprobación correcta si en el futuro se cambia la regla de cierre. La consulta
(con `--linked` para que apunte a la nube, no a la base local):

```sql
select 'polygonal' as modulo, id, type, status from public.polygonal_processes
 where status='calculated' and meets_tolerance is null and type <> 'open_uncontrolled'
union all
select 'leveling', id, type, status from public.leveling_processes
 where status='calculated' and meets_tolerance is null and type <> 'open';
```

Debe devolver cero filas. Si devuelve alguna, esos procesos hay que
recalcularlos y guardarlos antes de desplegar, o no podrán cerrarse.

**El desnivel adoptado (`adoptedHeightDifference`) no alimenta la
compensación.** `computeLeveling` lo calcula como el promedio de ida y vuelta
(§ 6.9) y el panel de resultados lo muestra («Desnivel adoptado (promedio)»),
pero la corrección proporcional del recorrido de ida se aplica hoy con el
error de cierre de la propia ida, no con el desnivel adoptado — la vuelta es
control de calidad (discrepancia vs T·√2), no insumo de la compensación.
Documentado y verificado en la revisión final de la Fase 4 (hallazgo 2); el
PRD principal y `docs/prds/03-nivelacion.md` afirmaban lo contrario y se
corrigieron. Si en una fase futura se decide que el desnivel adoptado sí debe
entrar en la compensación, es un cambio de motor de cálculo con tests nuevos,
no un ajuste menor: altera todas las cotas corregidas de un recorrido con
vuelta.

**Cerrado — el `worstAlert` del hub ya no diverge del panel.** El hub lee el
`alert_status` persistido en `settlement_readings` y el panel del lugar lo
recalcula en vivo con los umbrales vigentes, así que cualquier entrada que
alimente el cálculo y no reescriba lo persistido los separaba. La Fase 6 cerró
esa brecha: además de `saveVisitAction` (que ya lo hacía desde la Fase 5),
ahora `saveSiteAction` y `savePointAction` recalculan y reescriben las lecturas
de las visitas **abiertas** mediante `resyncSiteReadings`
(`src/lib/supabase/settlement-sync.ts`).

La enumeración de entradas que exigió el PRD de la Fase 6 encontró **una puerta
más de la que esta deuda registraba**. El `alert_status` depende de tres
entradas —las cotas de las visitas, el catálogo de puntos y los umbrales del
lugar— y de las nueve acciones que mutan el módulo, tres las tocan:

| Acción | Qué cambia | Estado |
|---|---|---|
| `saveVisitAction` | cotas y fechas | cubierto desde la Fase 5 |
| `saveSiteAction` | umbrales | la puerta que esta deuda documentaba |
| `savePointAction` | **C0 y coordenadas** | **no estaba documentada** |

`savePointAction` importa porque el acumulado es `(cota − C0) × 1000`: corregir
la cota base de un punto deja obsoletas todas sus lecturas persistidas. Es
literalmente el aprendizaje que la Fase 5 dejó escrito —una caché derivada
diverge por todas las puertas que alimentan el mismo cálculo, no solo por la
que se documentó primero— y confirma que conviene enumerar las entradas antes
de dar por acotada una limitación de este tipo.

Las visitas **cerradas** no se reescriben nunca: conservan la clasificación con
la que se cerraron, por trazabilidad. Verificado contra la base moviendo la app
real: con el arreglo, bajar el umbral de acumulado de 25 a 5 mm reclasifica 24
de 36 lecturas; sin él, las 36 conservan el criterio viejo. Con los umbrales en
0.1 mm, las visitas abiertas escalan a `alert`/`alarm` y la cerrada mantiene su
`normal`.

La decisión de qué reescribir vive en funciones puras con tests
(`src/lib/calculations/settlement-persistence.ts`), no en el Server Action.

**Cerrado — `validatePolygonalStation` exige el código del punto.** El
validador de nivelación lo hacía desde la Fase 4 y el de poligonal no, así que
una estación sin código se persistía igual en cliente y servidor, contra una
columna `point_code text not null`. La regla se añadió en la Fase 6 y es
obligatoria **siempre**, también en la última estación de una abierta, que no
lleva ángulo ni distancia pero sigue siendo un punto que hay que identificar.

Al añadirla apareció un efecto que el cambio de validador no cubría solo: la
tabla de estaciones no pintaba `errors.pointCode`, así que un código vacío
habría bloqueado el guardado **sin decir por qué**. El error se pasa ahora a
los dos `Input` de código. Verificado que no invalida datos existentes: cero
estaciones con código vacío en local y en producción.

**Cerrado — `expectStationCapture` tiene tests.** Es la fuente de verdad
compartida entre el editor y `savePolygonalProcessAction` sobre qué celdas son
obligatorias: si se desviara, el servidor y la pantalla dejarían de estar de
acuerdo sobre qué es captura parcial legítima sin que nada lo delatara. Se
fijan sus cuatro reglas y el caso límite de una abierta con una sola estación,
donde el índice 0 es a la vez primero y último y gana la regla del primero.

**El lugar «General» del backfill infla el conteo de procesos de proyectos
que ya tenían trabajo.** La migración de la Fase 5 crea un lugar `General`
por cada proyecto con procesos existentes y les asigna ese `site_id` (ver
§ 4). Ese lugar en sí mismo no representa ningún monitoreo real, pero
`getProcessCountsByProject` lo cuenta igual que un lugar de control genuino:
un proyecto que antes tenía «7 procesos» ahora puede mostrar «8» sin que se
haya creado ningún trabajo nuevo. No se corrige aquí porque distinguir «lugar
artefacto del backfill» de «lugar real sin visitas todavía» no tiene una
señal limpia en el esquema actual (los dos son un lugar `active` sin
visitas).

**Cerrado — `niceTicks` y `computeDifferentials` cubren sus casos extremos.**
`niceTicks` tiene tests de rango degenerado (min = max dentro y fuera de cero,
rango minúsculo, dominio negativo, cruce por cero, `count` de 1 y 0), y
documenta un límite conocido: con el rango invertido devuelve `[]`, que no se
defiende en el código porque el único llamante construye el dominio con
`Math.min`/`Math.max` y no puede invertirlo. `computeDifferentials` cubre el
punto con coordenadas pero **sin lectura en la visita** —distinto del caso de
coordenadas ausentes— y lo importante es que no se cuente como diferencial 0,
que se leería como distorsión infinita, es decir, como normalidad perfecta.

**La propagación de lecturas ya tiene tests, aunque no de integración.** La
decisión de qué filas hay que reescribir salió de `saveVisitAction` a
`src/lib/calculations/settlement-persistence.ts` (`readingChanged` y
`visitsToRewrite`) y tiene 14 tests: que un cambio de **solo** el nivel de
alerta cuenta como cambio —el caso exacto de editar umbrales, donde ningún
número varía—, que una visita cerrada no se devuelve nunca, que la velocidad
que llega como cadena no marca una fila como cambiada, y que se devuelven solo
las lecturas alteradas y no la visita entera.

Queda en pie la limitación de fondo: **el proyecto sigue sin poder probar la
E/S**. `resyncSiteReadings` y el bucle de `upsert` de `saveVisitAction` no
tienen cobertura automática, porque no hay forma de mockear el cliente de
Supabase ni pruebas de integración contra la base local. Lo que se ganó es que
la parte que **decide** —donde vivían los fallos— ya no depende de
verificación manual; lo que se escribe sigue dependiendo de ella.

**Cerrado — la gráfica distingue diez series por forma.** `SERIES_MARKERS`
pasó de 5 a 10 formas en la Fase 6, porque con cinco la **forma sola** se
repetía en la serie 6 y con acromatopsia la forma es el único canal. El aviso
existente no cubría el caso: saltaba a partir de 20 —el mcm de formas y
colores— dejando descubierto el rango 6-19, justo donde cae el catálogo típico
del dominio (9 puntos en el edificio, 10 en la presa).

Las cinco nuevas se eligieron por **silueta** y no por relleno: triángulo
invertido, cruz recta, estrella de cuatro puntas, anillo y cuadrado hueco. El
catálogo vive en `lib/design/series-markers.ts` con 8 tests, incluido el que
habría atrapado el fallo original. Verificado en la aplicación con 10 series y,
sobre todo, **en escala de grises**: sin color, las diez siluetas se siguen
distinguiendo.

**La E/S de los Server Actions sigue sin tests.** Es la deuda de fondo que la
Fase 6 acotó pero no eliminó. La parte que **decide** qué escribir ya está
cubierta por funciones puras (`settlement-persistence.ts`,
`reports/eligibility.ts`, `close-status.ts`), pero lo que **escribe** —los
`upsert` de `saveVisitAction`, `resyncSiteReadings`, el `insert` de
`createReportAction`— no tiene cobertura automática, porque el proyecto no
puede mockear el cliente de Supabase ni montar pruebas de integración contra la
base local. Toda esa capa depende de verificación manual contra la base.

**Cerrado — los datos de producción ya tienen sus resultados de estación.**
El generador del proyecto de ejemplo (`crear-proyecto-demo.ts`) y el seed
persistían los datos de campo pero descartaban lo que el motor calculaba por
estación. Ambos están corregidos, y las 15 estaciones que ya existían en
producción se repararon con
`scripts/reparar-resultados-estacion.mjs`, que **recalcula con
`computePolygonal`** —nunca escribe valores a mano— y **salta los procesos
cerrados o rechazados**, que son inmutables por trigger y deben seguir
siéndolo.

Verificado en producción tras la reparación: 15/15 estaciones con coordenadas
(antes 0), y el rectángulo de cierre conforme cierra exacto —A(1000,1000) →
B(1100,1000) → C(1100,1100) → D(1000,1100), azimuts 0/90/180/270—, los mismos
valores que produce el generador corregido en local.

El script queda en el repositorio porque sigue siendo la herramienta correcta
si vuelve a aparecer un proceso con resultados sin persistir. Corre en modo
simulación por defecto; escribe solo con `--aplicar`.

**Cerrado — el informe incluye la gráfica de asentamientos.**
`components/reports/settlement-plot.tsx` dibuja la serie temporal en SVG
estático, renderizado en el servidor. No reutiliza `settlement-chart.tsx`
porque aquel es un Client Component con selección de puntos por checkbox, un
estado que un documento impreso no puede tener; lo que **sí** comparte es todo
lo que decide la geometría —`chart-scale` y `series-markers`, funciones puras
con tests—, de modo que el informe no puede dibujar una forma distinta de la
que se ve en pantalla.

Dos diferencias deliberadas con el panel: dibuja **todos** los puntos del
catálogo (un informe documenta el monitoreo completo, no una selección), y
corta la línea donde falta lectura en vez de unir por encima del hueco, que
dibujaría una pendiente que nadie midió. Verificado en modo `print`: gráfica,
leyenda y tabla de valores siguen presentes, así que la información no depende
del canal visual.

**Cerrado — el export de Excel lleva los metadatos geodésicos.** La hoja
«Resumen» de los tres módulos abre con una sección «Proyecto» que repite
nombre, cliente, ubicación, datum, proyección, orden de precisión y equipo.
Un `.xlsx` viaja suelto —se adjunta a un correo y se abre meses después—, y
sin datum una coordenada como «N=1000.000» no identifica su sistema de
referencia. El helper es `projectPairs` en `lib/export/workbook.ts`, y el
parámetro es opcional: sin proyecto, la sección simplemente no se escribe.

---

## 12. Manual de usuario en la app

La ruta `/manual` (`src/app/(app)/manual/`) sirve el manual de usuario dentro de
la aplicación. **A diferencia de `/design-system`, existe en producción**: es
documentación del producto, no una herramienta de desarrollo. Vive dentro del
grupo `(app)`, así que hereda la comprobación de sesión y el encabezado.

### Estructura

| Archivo | Responsabilidad |
|---|---|
| `manual-data.ts` | Todo el contenido: textos, filas de tabla, metadatos de las capturas |
| `page.tsx` | Las once secciones y sus piezas de presentación (`Seccion`, `Captura`, `Tabla`, `Nota`) |

**Dos archivos, a propósito.** Es un documento, no funcionalidad: cada sección
se renderiza una vez, en un orden fijo, así que repartirlas en un archivo por
sección solo añadía imports. Las piezas de presentación viven al final de
`page.tsx`, como en `/design-system`; no van a `src/components/design-system/`
porque conocen el dominio (rutas de captura, terminología topográfica) y el
criterio de composición (§ 8) lo prohíbe.

### Decisiones que conviene conocer antes de tocarlo

**`<img>` plano, no `next/image`.** Las capturas son PNG estáticos ya generados
al tamaño correcto por `docs/manual/capturas.mjs` y versionados en
`public/manual/`. La optimización en tiempo de ejecución no aporta nada que
compense su coste, y se factura por uso. El riesgo real de `<img>` —el salto de
layout— se evita con `width`/`height` reales en cada imagen. Hay un
`eslint-disable` puntual con esa explicación.

**`loading="lazy"` en todas menos la primera.** Las diecisiete capturas suman
4,6 MB; sin esto la página las descargaría de golpe.

**`Nota` propia en lugar de `Alert`.** `Alert` lleva `role="alert"` siempre, lo
que anuncia el contenido con prioridad al lector de pantalla. Una nota
informativa de un manual no es una alerta activa.

**Los módulos pendientes dicen la palabra «Pendiente».** El color nunca es el
único canal, y las tarjetas no contienen nada accionable para que nadie crea
que puede entrar a un módulo que aún no existe.

**El índice son anclas de HTML**, sin JavaScript de cliente, igual que las
pestañas y los filtros del resto de la aplicación. Los `id` de `SECCIONES` deben
ser únicos: dos anclas iguales navegan siempre a la primera, sin dar error. Son
once en una sola lista, así que se comprueba a ojo.

### El texto vive por duplicado

`docs/manual/README.md` es la fuente de la redacción; `manual-data.ts` es su
maquetación. No hay generación automática entre los dos: eliminar la
duplicación exigiría un parseador de Markdown, que el proyecto no admite.

**Al cambiar la redacción, cambie los dos en el mismo commit.** Es una regla
manual, como la verificación de contraste — no hay nada que falle en `npm test`
si divergen.

Al añadir funcionalidad hay que tocar los dos sitios: la sección nueva en el
Markdown, y en la app su texto en `manual-data.ts` más su sección en
`page.tsx`. La lista `MODULOS_PENDIENTES` desapareció al cerrar la Fase 6: ya
no quedan módulos por implementar.

---

## 13. Despliegue

En producción desde el 2026-08-11:

| Pieza | Dónde |
|---|---|
| Aplicación | Vercel — [topofield-app.vercel.app](https://topofield-app.vercel.app) |
| Base y autenticación | Supabase Cloud, proyecto `Topofield` (`rlipktdjlxynyxpiqgsu`), región `us-east-2` |
| Correo saliente | Resend, vía SMTP de Supabase |

Cada `git push` a `main` redespliega en Vercel. Las migraciones **no** viajan
con el código: se aplican aparte con la CLI.

### Variables de entorno en Vercel

| Variable | Nota |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Pública. *Project URL* del panel de Supabase. |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Pública por diseño: viaja al navegador. |
| `SIGNUP_INVITE_CODE` | Secreta. Sin ella el registro queda bloqueado (§ 5). |

**`SUPABASE_SECRET_KEY` no está declarada en Vercel**, y no debe estarlo: ningún
archivo de `src/` la usa.

### Aplicar migraciones a la nube

```bash
npx supabase link --project-ref rlipktdjlxynyxpiqgsu
npx supabase db push
```

`npx supabase migration list` compara local contra remoto antes de empujar.
**Nunca `db reset` contra la nube**: borra y recrea la base.

**Estado actual (2026-08-25):** la nube tiene aplicadas las ocho migraciones,
incluidas las dos de la Fase 5 (`20260825175626_sites_and_settlement` y
`20260825230000_reject_write_on_closed_site`). Verificado contra la base tras
aplicarlas —no contra la interfaz—: `site_id` es `NOT NULL` en
`polygonal_processes` y `leveling_processes`, ningún proceso quedó huérfano,
ninguno apunta al lugar de otro proyecto, RLS está activo en las cuatro tablas
nuevas y sus triggers de inmutabilidad existen. El backfill creó **un** lugar
`General`, el número exacto que la auditoría previa había predicho.

**El orden importa cuando hay auto-deploy.** Vercel despliega solo al empujar a
`main`, así que la migración va **primero** y el `git push` después: al revés,
el despliegue serviría código que espera tablas que la base todavía no tiene.

Para consultar la base de producción, `db query` necesita `--linked`; sin esa
bandera consulta la local y los resultados engañan:

```bash
npx supabase db query --linked --file consulta.sql
```

### Configuración de Auth en el panel

*Authentication → URL Configuration*:

| Campo | Valor |
|---|---|
| Site URL | `https://topofield-app.vercel.app` |
| Redirect URLs | `https://topofield-app.vercel.app/auth/callback` |

Los dos importan, y por motivos distintos:

- El **Site URL** es el que usa la plantilla del correo para construir el
  enlace. Si se queda en `localhost`, el correo de confirmación lleva al
  usuario a su propia máquina y la cuenta queda confirmada pero sin pasar por
  `/auth/callback`, así que **no se le crea el proyecto de ejemplo**. Ocurrió.
- La **Redirect URL** autoriza el destino. Si falta, Supabase no da error:
  redirige al Site URL en silencio.

*Authentication → Providers → Email*: «Confirm email» viene activo por defecto
en la nube, al contrario que en local.

### SMTP (Resend)

*Authentication → Emails → SMTP Settings*:

| Campo | Valor |
|---|---|
| Host | `smtp.resend.com` |
| Port | **`465`** |
| Username | `resend` (literal, no un correo) |
| Password | la API key `re_…` |
| Sender | `onboarding@resend.dev` |

El puerto es 465, no 587. Con 587 el registro se queda colgado y termina en un
**504 a los 36 segundos**: Supabase reintenta el envío hasta rendirse. El
síntoma en la aplicación es una alerta vacía, porque un 504 no trae cuerpo JSON
del que sacar un mensaje.

Sin SMTP propio, Supabase limita a ~4 correos por hora.

### Un proyecto pausado se manifiesta como `fetch failed`, no como un error claro

Los proyectos gratuitos de Supabase **se pausan por inactividad**. Cuando eso
pasa, el síntoma en la aplicación es un `fetch failed` en el Server Action —
sin código de estado, sin mensaje del servicio, indistinguible a primera vista
de una variable de entorno mal puesta o de un despliegue roto.

Lo que despista es que **el CLI sigue funcionando**: `supabase db query
--linked` responde con normalidad, porque la conexión del CLI despierta el
proyecto. Así que se puede estar mirando una base que contesta perfectamente
mientras la API pública que usa la aplicación no responde a nadie.

Cómo distinguirlo en un minuto, antes de sospechar del código:

```bash
curl -s -o /dev/null -w "%{http_code}
" https://<ref>.supabase.co/auth/v1/health
```

Un `200` descarta la pausa. Si no responde, entrar al panel de Supabase y mirar
si el proyecto aparece pausado; «Restore project» lo revive en un par de
minutos. Ocurrió al desplegar la Fase 4 (2026-08-14): el `fetch failed` no lo
causaba el despliegue —que no toca cliente, claves ni proxy— sino el proyecto
pausado. **Señal de que ya está resuelto:** el error cambia de `fetch failed` a
uno de negocio («Credenciales inválidas»), que significa que la aplicación ya
habla con la base y esta le contesta.

### Limitación vigente: solo puede registrarse el dueño de la cuenta de Resend

`onboarding@resend.dev` es el remitente de pruebas de Resend y **solo entrega al
correo del titular de la cuenta**. Cualquier otro destinatario recibe un 403
(«Testing domain restriction») y no llega nada.

Consecuencia práctica: hoy nadie más puede crear una cuenta. Para probar el
registro con otras direcciones sirve el truco de Gmail
(`titular+loquesea@gmail.com`), que Supabase trata como usuarios distintos.

**Para abrirlo a otras personas —jurado, compañeros— hay que verificar un
dominio propio en Resend** (*Domains → Add Domain*, más los registros DNS de
SPF y DKIM) y cambiar el remitente a ese dominio. Eso resuelve además que los
correos lleguen a spam, cosa que pasa justamente por enviar desde un dominio
que no es el nuestro. Queda pendiente.
