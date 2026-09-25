# Documentación técnica — TopoField

Documento de referencia para desarrollar y mantener TopoField. Describe cómo
está construido el sistema, qué decisiones lo gobiernan y dónde tocar para
extenderlo.

**Última actualización:** 2026-09-25 · Fase 19 cerrada · 774 tests ·
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
| 7 | Motor y captura de poligonales | cerrada |
| 8 | Precisión y equipo por proceso | cerrada |
| 9 | Cadena de distancias de nivelación | cerrada |
| 10 | Nomenclatura de nivelación | cerrada |
| 11 | Estado de los BMs | cerrada |
| 12 | Alerta por lectura desfasada | cerrada |
| 13 | Canvas de poligonal | cerrada |
| 14 | Ajuste por mínimos cuadrados | cerrada |
| 15 | Georreferenciación de levantamientos | cerrada |
| 16 | Importar lecturas de nivel digital | cerrada |
| 17 | Control ida-vuelta por puntos homólogos | cerrada |
| 18 | Libreta de nivelación y panel de asentamientos | cerrada |
| 19 | Equilibrado por armada y compensación desde el origen | cerrada |

Las fases 7 en adelante no estaban en el § 9 del PRD: nacen del contraste del
motor contra carteras de campo reales (`docs/carteras/`).

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
Mailpit: `http://127.0.0.1:55324`.

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
| `npx tsx --env-file=.env.local scripts/resincronizar-asentamientos.mjs` | Reescribe con el motor actual las lecturas persistidas de las visitas abiertas (Fase 11). Simula por defecto; escribe con `--aplicar`. No toca lugares ni visitas cerrados |
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

**El seed solo corre sobre una base recién reseteada.** Para recrear al usuario
de ejemplo, el seed lo borra, y eso falla si ya tiene proyectos
(`projects_user_id_fkey` no es en cascada y los procesos cerrados son
inmutables). Secuencia correcta: `npx supabase db reset` y luego `npm run seed`.

### Docker: un solo motor

En WSL puede haber **dos** motores de Docker a la vez: el `dockerd` nativo de
la distribución y la integración WSL de **Docker Desktop**. Si Docker Desktop
arranca después, reemplaza `/var/run/docker.sock` con su propio proxy. El
stack de Supabase sigue vivo en el motor nativo y atendiendo los puertos
`5532x`, pero el CLI ya no lo ve: `docker ps` sale vacío, `supabase status`
dice que no hay contenedores, y `supabase start` / `db reset` fallan con
`relation "profiles" already exists`, porque intentan aplicar las migraciones
sobre la base viva del otro motor.

Diagnóstico en una línea: `docker ps` no lista `supabase_db_topofield-app`
pero `psql -h 127.0.0.1 -p 55322` responde.

Solución: dejar **un solo motor**. Con el nativo, que es donde vive el stack:

1. En Docker Desktop, *Settings → Resources → WSL integration*, desactivar la
   distribución (o cerrar Docker Desktop).
2. `sudo systemctl restart docker.socket docker` para que el nativo recupere
   el socket.
3. `docker ps` debe listar los contenedores `supabase_*_topofield-app`. Si
   el reinicio los dejó parados, `npx supabase start`.
4. `npx supabase db reset && npm run seed`, y `npm run dev`.

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
│   │       ├── settlement/[siteId]/     panel del lugar; visits/[visitId]/ vista y editar/
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
│   ├── import/leveling/     lectores de libretas de nivel digital (Fase 16)
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
| `(app)/projects/[id]/settlement/[siteId]/actions.ts` | `createVisitAction` (con el formulario completo, Fase 18), `saveVisitAction` (con libreta: ver § 4), `closeVisitAction` |
| `(app)/projects/[id]/sites/[siteId]/point-actions.ts` | `createPointAction`, `savePointAction`, `deletePointAction` |
| `(app)/projects/[id]/reports/actions.ts` | `createReportAction`, `deleteReportAction` |

### Informes y exportación (§ 4.7 y § 4.8 del PRD)

Son las dos salidas del producto y funcionan con criterios opuestos a
propósito.

**El informe no se guarda: se reconstruye.** `reports` almacena qué procesos
incluye y en qué orden, nunca una copia de sus datos ni un PDF. Reabrirlo
vuelve a leer los procesos y a componer el documento. Eso es seguro **solo
porque un informe únicamente puede incluir trabajos cerrados**, que son
inmutables por trigger de base: dentro de un año dará las mismas mediciones y
el mismo veredicto. Está verificado comparando el hash del contenido en dos
lecturas. **Excepción desde la Fase 15:** si una poligonal incluida se
georreferencia después de emitir el informe, el informe muestra las
coordenadas nuevas, con una nota de fecha y puntos (decisión del usuario).

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

**Nivelación: el código dice `backsight`/`foresight`, la pantalla dice `V+`/`V−`**
(Fase 10). La interfaz, el Excel, los mensajes y los comentarios usan la
nomenclatura de la cartera de campo —vista más y vista menos—, que describe
qué hace el número: `AI = cota + V+`, `cota = AI − V−`. Tipos, motor, columnas
de Postgres y los prefijos `back*`/`fore*` (`back_distance_m`, `foreUpperM`)
conservan el vocabulario inglés estándar, igual que `pointType` se muestra como
«Tipo de punto». El signo es U+2212, no guion. `AI`, `HS` y `HI` (altura de
instrumento, hilo superior, hilo inferior) no cambian.

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
| `meets_tolerance` | Si cumple el orden de precisión del proceso |

`status` puede ser `draft`, `in_progress`, `calculated`, `closed` o `rejected`.
Los dos últimos son terminales.

`angle_input_format` (`dms` o `decimal`, Fase 13) no es un resultado: recuerda
cómo se **teclean** los ángulos del proceso. El almacenamiento sigue siendo DMS
en tres columnas. Lo escribe `setAngleInputFormatAction` al conmutar, y la
rechaza en un proceso cerrado o rechazado (`canPersistAngleFormat`); ahí el
conmutador solo cambia la vista.

`georef_at`, `georef_by`, `georef_point_a_code`, `georef_point_b_code`,
`georef_rotation_*` (DMS) y `georef_scale_factor` (Fase 15) anotan la **última**
georreferenciación. No hay historial ni copia de las coordenadas locales: el
producto no busca aún trazabilidad estricta de la posición.

`ls_sigma_angle_seconds`, `ls_sigma_distance_m` y `ls_distance_measurements`
(Fase 14) tampoco son resultados: son los **pesos** del ajuste por mínimos
cuadrados, tecleados por proceso. El CHECK `polygonal_processes_ls_weights_complete`
los exige con `correction_method = 'least_squares'` y va envuelto en
`coalesce(…, false)`: sin él, un peso en `NULL` hacía la condición `NULL`, y un
CHECK que da `NULL` se da por cumplido. Las correcciones por observación y σ₀
**no se guardan**: el editor, el informe y el Excel las recalculan con
`polygonalInputOf`. El proceso cerrado es inmutable, así que da lo mismo.

### `settlement_readings` — columnas de resultado

Igual que `polygonal_processes`, los cálculos se persisten para que los
informes de la Fase 6 los lean sin recalcular:

| Columna | Contenido |
|---|---|
| `partial_settlement` | Asentamiento desde la visita anterior, en mm (signo: negativo = descenso) |
| `accumulated_settlement` | Asentamiento desde la línea base del punto —su C0 o, sin C0, su primera lectura (Fase 11)—, en mm |
| `velocity` | mm/mes, con los días reales entre visitas (`DAYS_PER_MONTH = 30.4375`) |
| `alert_status` | `normal` \| `caution` \| `alert` \| `alarm` — la peor clasificación entre velocidad y acumulado |

`settlement_visits.status` puede ser `draft`, `calculated` o `closed` — sin
`rejected`: una visita no se rechaza, se cierra o no. `sites.status` es
`active` o `closed`.

### `settlement_points` — vigencia (Fase 11)

El catálogo cambia durante el monitoreo sin borrar historia: un BM se da de
**baja** cuando se destruye y otro se da de **alta** a mitad de la serie.

| Columna | Contenido |
|---|---|
| `active_from` | Fecha de alta. Null = punto original del lugar |
| `retired_on` | Fecha de baja: la **primera fecha en que ya no se mide** (límite exclusivo) |
| `retirement_reason` | Motivo de la baja, obligatorio con ella |

Un punto se mide en una visita de fecha `d` si y solo si
`(active_from is null or d >= active_from) and (retired_on is null or d < retired_on)`.
La regla tiene dos expresiones, que se prueban en los mismos bordes: el
predicado SQL `public.point_active_on` y `isPointActiveOn`
(`src/lib/calculations/settlement.ts`). Ningún consumidor en TypeScript la
reimplementa.

El estado «de baja» no se guarda aparte: se deriva de `retired_on`. Los CHECK
imponen que baja y motivo vayan juntos, que el alta sea anterior a la baja y
que **un punto de alta no lleve C0** (`settlement_points_alta_without_c0`): su
línea base es su primera lectura.

**Tres triggers guardan el invariante «ninguna lectura cae fuera de la
vigencia de su punto»**, uno por cada escritura que puede romperlo: escribir
una lectura, cambiar las fechas del punto o cambiar la fecha de una visita.
Un trigger solo en las lecturas dejaría pasar las otras dos por REST.

Las reglas de aplicación están en `validators/settlement.ts`:
`validateRetirement` (la baja es posterior a la última lectura y lleva
motivo), `undoRetirementBlocker` (la baja se deshace solo mientras ninguna
visita cerrada tenga fecha igual o posterior) y `validateActiveFrom` (el alta
es posterior a la última visita cerrada). Las Server Actions de
`point-actions.ts` las aplican; un punto de baja no se edita.

### La libreta de la visita (Fase 18)

Una visita de asentamientos se captura de dos maneras, según
`settlement_visits.capture_mode`:

- **`book`** (las nuevas): la visita lleva su **libreta de nivelación** en
  `settlement_book_readings` —espejo de `leveling_readings` sin `run_type`, con
  `point_id` al punto de control— y las cotas de los puntos se **derivan** de
  ella en el servidor. `settlement_readings.elevation` sigue siendo la cota
  canónica: es una caché de la libreta.
- **`direct`** (las anteriores a la Fase 18, o una nivelación procesada fuera):
  la cota se teclea por punto, como antes. El `DEFAULT 'direct'` de la
  migración dejó así todas las visitas existentes.

La visita guarda una **copia** del BM de amarre (`reference_bm_code`,
`reference_bm_elevation`), como `start_bm_*` en nivelación: corregir después el
catálogo `reference_points` no cambia la cota con que se calculó. En `book`,
`closure_error_mm`, `tolerance_mm`, `meets_tolerance` y `total_distance_km`
son derivados; en `direct`, `closure_error_mm` es el tecleado y los otros van
en `null`.

La tabla nueva reutiliza sin cambios los triggers
`reject_write_on_closed_visit_reading()` y
`reject_write_on_closed_site_reading()`: solo leen `visit_id`, no el nombre de
la tabla. No lleva el trigger de vigencia de la Fase 11: un punto de baja puede
aparecer en la libreta; simplemente no produce lectura. `point_id` es
`ON DELETE SET NULL`: si se borra un punto, su fila queda como radiación.

**Orden de escritura de `saveVisitAction` en `book`**, impuesto por los
triggers de vigencia: purga de las lecturas que ya no vienen → cabecera (con
los derivados del cierre) → libreta con **upsert por `(visit_id,
reading_order)` y purga de las filas sobrantes** —nunca borrado y
reinserción— → upsert de lecturas → propagación a las visitas posteriores
abiertas. En `direct` la purga se lleva la libreta entera.

**Lo que invalida la cota derivada**, y quién la recalcula:

| Entrada | Puerta |
|---|---|
| Filas de la libreta, amarre, orden de precisión | Guardar la visita (`saveVisitAction` recalcula y propaga) |
| Código de un punto de control | `savePointAction` renombra sus filas de libreta en las visitas **abiertas**; las cerradas conservan el código con que se midieron |
| Vigencia de un punto | Los triggers de la Fase 11; la derivación omite las filas fuera de vigencia |
| Umbrales del lugar | `resyncSiteReadings` (no toca cotas) |

### Precisión y equipo, por proceso (Fase 8)

`precision_order` y los datos del instrumento no viven en `projects`: cada
`polygonal_processes`, `leveling_processes` y `settlement_visits` los declara
por su cuenta, con los campos que exige su tipo de instrumento — nunca un
juego único. Antes de la Fase 8 vivían en `projects` con la forma de una
estación total (`angular_precision_seconds`, `linear_precision` como texto
`"2+2ppm"`), que es la razón por la que nivelación y asentamientos nunca
encajaron: a un nivel no se le pregunta precisión angular.

| Tabla | Campos de equipo | Norma |
|---|---|---|
| `polygonal_processes` | `equipment_brand/model/serial/calibration_date`, `angular_precision_seconds`, `distance_precision_mm`, `distance_precision_ppm` | ISO 17123-3 (angular) y -4 (distancia) |
| `leveling_processes` | los mismos cuatro de marca/modelo/serie/calibración, `level_type` (`automatico`\|`digital`), `km_precision_mm` | ISO 17123-2 |
| `settlement_visits` | igual que `leveling_processes` — el equipo es de la **visita**, no del lugar: el instrumento puede cambiar entre campañas | ISO 17123-2 |

Las tres tablas tienen además su propio `precision_order`, el mismo dominio de
cuatro valores que antes vivía solo en `projects`.

**Por qué no un catálogo de equipos reutilizable entre procesos.** Se evaluó y
se descartó (`docs/prds/07-precision-equipo-por-proceso.md`, decisión #2): una
tabla `equipment` referenciada por id reabre el agujero de trazabilidad que
motivó la fase, porque editar la fila cambiaría el equipo de los informes de
procesos ya cerrados. Con los campos sueltos en el proceso, el congelado sale
gratis de la inmutabilidad que ya existe (§ 5).

**Consecuencia para `reports`.** Antes de esta fase, la página de impresión
leía `project.precision_order`/`project.equipment_*` **en vivo**; editar el
equipo del proyecto reescribía todos los informes ya emitidos, incluidos los
de procesos cerrados. Ahora lee del proceso incluido en el informe, que es
inmutable una vez cerrado (§ 5) — el congelado del informe es una consecuencia
de dónde vive el dato, no un mecanismo aparte. Ver también «Aviso de equipo
insuficiente» en § 6.

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

**Excepción de posición (Fase 15).** La cabecera de poligonal tiene su propia
función, `reject_update_on_closed_polygonal_process()` —la genérica la
comparten nivelación, lugares y visitas—, y la de sus estaciones
(`reject_write_on_closed_process_station()`, que solo usa `polygonal_stations`)
gana la misma regla. Sobre un cerrado o rechazado admiten un `UPDATE` si lo
único que cambió está en una **lista blanca de posición**: se comparan
`to_jsonb(new) - lista` y `to_jsonb(old) - lista`.

- Cabecera: `start_north`, `start_east`, `start_azimuth_*`, `end_north`,
  `end_east`, `end_azimuth_*`, `reference_point_id` —solo hacia `null`: el
  amarre puede pasar a manual, no cambiar por otro—, `georef_*` y
  `updated_at`, que pone otro trigger y no debe depender del orden en que
  disparan.
- Estaciones: `azimuth_*`, `delta_north`, `delta_east`, `corrected_delta_*`,
  `north` y `east`.

Ángulos, ángulos corregidos, distancias, lecturas, errores, precisión,
`meets_tolerance` y `status` siguen bloqueados, igual que insertar o borrar
estaciones y borrar el proceso. Verificado con `psql`: mover `north` de un
cerrado funciona; tocar `angular_error_seconds`, `linear_error`, un ángulo,
`status` o borrar una estación falla con `23001`; una nivelación cerrada sigue
rechazando cualquier cambio. **Lo que se acepta:** una sesión del dueño puede
mover por REST las coordenadas de su poligonal cerrada sin pasar por la
acción; la garantía que se mantiene es la del veredicto.

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

**`settlement_points` cierra el modelo.** Era la única tabla del modelo de
inmutabilidad sin trigger de base: la defensa vivía solo en `loadOpenSite`
(`point-actions.ts`), es decir, en la capa que este mismo apartado declara
bypasseable. Una auditoría lo explotó por REST directo (`PATCH` a
`/rest/v1/settlement_points` de un lugar cerrado: HTTP 204) y el efecto no era
cosmético — el asentamiento acumulado **se recalcula siempre en vivo** como
`(cota − C0) × 1000`, así que alterar la `C0` reescribe retroactivamente todo
el histórico de un lugar sellado. Lo cierra
`settlement_points_reject_write_when_site_closed`
(`20260826120000_reject_write_on_closed_site_point.sql`), con la misma forma
que el trigger de las visitas. Borrar un lugar **abierto** sigue cascadeando
sin problema; borrar uno cerrado ya lo impedía el trigger de `sites`.

**Atribución de los informes.** La política de `INSERT` de `reports` comprueba
también `generated_by = auth.uid()::text`
(`20260826120100_reports_insert_check_generated_by.sql`). Sin eso, un `POST`
directo podía crear un informe en un proyecto propio firmado por otro usuario.

**Precedente de la Fase 8: desactivar el trigger dentro de una migración.** El
backfill de `20260918022849_precision_equipo_por_proceso.sql` necesitó escribir
sobre procesos y visitas cerrados —rellenar el equipo y el orden que heredaban
implícitamente del proyecto— así que desactivó los triggers de inmutabilidad de
`polygonal_processes`, `leveling_processes` y `settlement_visits` solo para esa
transacción, reactivándolos en la misma migración. `settlement_visits` exigió
desactivar dos triggers propios, no uno: dispara tanto por visita cerrada como
por *lugar* cerrado. Es legítimo porque rellena un dato que el proceso siempre
tuvo de forma implícita, no porque cambie una medición o un resultado de
cierre; no es un permiso general, y cualquier migración futura que quiera
escribir sobre filas cerradas tiene que justificarse por su cuenta — ver
`docs/prds/07-precision-equipo-por-proceso.md`, «Riesgos conocidos».

### Cabeceras de seguridad

`next.config.ts` define `Content-Security-Policy`, `X-Frame-Options: DENY`,
`X-Content-Type-Options: nosniff` —relevante para los `.xlsx` de exportación—,
`Referrer-Policy: strict-origin-when-cross-origin` y `Permissions-Policy`, y
desactiva `poweredByHeader`.

La CSP lleva `'unsafe-inline'` en `script-src` y `style-src` **a propósito**:
Next inyecta el arranque de React y los estilos críticos en línea, y la app usa
`style={{…}}` en tres componentes. La alternativa —un nonce por petición—
obliga a generarlo en `src/proxy.ts`, propagarlo y volver dinámicas rutas hoy
estáticas; no compensa mientras no entre HTML de terceros (hoy hay **cero**
`dangerouslySetInnerHTML` en `src/`).

Lo que sí cierra, y antes estaba abierto: `frame-ancestors` (clickjacking),
`base-uri` (inyección de `<base>`), `object-src` y `form-action` (envío de
formularios a un tercero); `default-src 'self'` corta cualquier origen no
listado. `connect-src` abre `*.supabase.co` y `wss://*.supabase.co` —hoy no se
usa realtime, pero el cliente abre el socket en cuanto alguien llame a
`.channel()`, y sin eso fallaría en silencio—. Las fuentes son de
`next/font/google`, que las auto-aloja en el build, así que `font-src 'self'`
basta.

Verificada en navegador (Playwright, con sesión real) sobre dashboard, hub de
proyecto, editor de asentamientos, catálogo de puntos, informes y manual:
**cero violaciones de CSP**, estilos aplicados y **descarga real del `.xlsx`
funcionando**. La descarga no se ve afectada porque es un `<a download>`, una
navegación normal, no una petición que la CSP filtre.

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
| `georeference.ts` | `fitTwoPoints`, `georeferenceInput`, `applyTransform`, `scaleWithinOrder` — georreferenciación rígida desde dos puntos (Fase 15) |
| `least-squares.ts` | `adjustByConditions` — ajuste por ecuaciones de condición, genérico; `solveLinear`; `sigma0Reading` (Fase 14) |
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

### Convención de azimut (Fase 7)

El instrumento pone cero en la vista atrás y gira a la derecha, así que la
lectura es siempre un **ángulo a la derecha** y el azimut avanza sumándolo:

```
Az(0) = normalizar(azimut_de_amarre + ángulo_de_orientación)
Az(i) = normalizar(Az(i-1) + 180 + a(i))
```

Hasta la Fase 6 el motor restaba el ángulo (`+180 − a`), que produce el polígono
**espejo**. El fallo era invisible: el error de cierre y la precisión relativa
salen prácticamente iguales en las dos convenciones, así que la aplicación
informaba «cumple 1:7036» sobre coordenadas espejadas. Con la cartera real, el
primer lado coincidía a 0.2 mm y el segundo vértice se iba 19 m en el Este.

`angle_type` decide la suma teórica, no el signo: si el polígono se recorre en
antihorario las lecturas caen como interiores (`(n−2)·180`) y en horario como
exteriores (`(n+2)·180`). Ambos casos ocurren en campo, así que el formulario
**no preselecciona**.

### Amarre y esquemas de cierre

Una cartera real se orienta sobre un punto de coordenadas conocidas, así que el
azimut de amarre **se calcula** (`azimuthFromCoordinates`) en vez de teclearse,
y se persiste resuelto: el CRUD de `reference_points` permite mover un punto ya
usado, y el proceso debe conservar el azimut con el que se calculó.

Hay dos esquemas de cierre, y `has_closing_row` los distingue:

| Esquema | Última fila | Suma teórica | Ejemplo |
|---|---|---|---|
| Contra el amarre | Ángulo del último lado de vuelta a la referencia, sin distancia | `(n−2)·180 + 360` sobre n+1 ángulos | cartera TT4 |
| Contra el primer lado | Ángulo interior del vértice de arranque | `(n−2)·180` sobre n ángulos; la orientación solo fija el datum | cartera Vivero |

En ambos, el **control de reorientación** compara el último azimut de la cadena
contra su objetivo y expone la discrepancia en segundos. Avisa, no bloquea: es
control de calidad del levantamiento, no criterio de tolerancia.

### Las hojas de Excel de referencia

`docs/carteras/poligonales.xlsx` trae la misma cartera resuelta por tres
métodos. Solo una está bien, y los tests lo dejan escrito:

| Hoja | Estado | Qué le pasa |
|---|---|---|
| `BRUJULA` | correcta | Es Bowditch. Nuestro motor la reproduce con 0.000 mm de diferencia |
| `TRANSITO` | **no cierra** | Reparte proporcional a la proyección **con signo**; como `ΣΔN` es el propio error de cierre, las correcciones se cancelan (suman `0.000002` en vez de `−0.008417`) y deja el error entero sin corregir |
| `CRANDALL` | **no cierra** | Usa `(ΔN+ΔE)/d` donde va el producto `ΔN·ΔE/d`, `Σ(LDᵢ²)` donde va `(Σ LD)²`, y tiene los paréntesis mal puestos en los multiplicadores. Vuelve al arranque con 0.22 mm de residuo |

Por eso Tránsito y Crandall se verifican por **cierre a cero** y no por paridad
con la hoja: replicar el error del Excel sería replicar un error.

### Lecturas múltiples

Cada ángulo guarda N lecturas en `polygonal_angle_readings` (mínimo
configurable por proceso, 3 por defecto) y la estación guarda el **promedio**,
recalculado por el servidor: es derivado, no un dato que el cliente pueda
contradecir.

La dispersión (máx − mín) se contrasta con
`polygonal_processes.angular_precision_seconds` —la precisión del equipo del
**proceso** desde la Fase 8, antes era la del proyecto— y no con la tolerancia
del orden. El orden gobierna el cierre de la poligonal; repetir una lectura
mide repetibilidad. El factor admitido vive en `READING_DISPERSION_FACTOR`.

### Captura en grados decimales (Fase 13)

`AngleInput` (`src/components/polygonal/angle-input.tsx`) recibe y emite el
ángulo **siempre en DMS**. El formato decimal es una vista: se muestra con
`DECIMAL_DEGREE_DIGITS = 6` decimales (0.0036″), muy por debajo de la décima de
segundo que guardan las columnas `decimal(5,1)`, así que ir de DMS a decimal y
volver es exacto. Un test barre 12 000 valores en pasos de 0.1″. Un decimal
tecleado con más precisión se redondea a 0.1″ al emitirse, y el campo avisa de
cómo se guardará (`roundsOnStorage`).

No está en el sistema de diseño porque convierte con `@/lib/calculations/angles`
(ver § 8, «Qué entra en el sistema de diseño»). El genérico, `DmsInput`, sí.

### Importación de libretas de nivelación (Fase 16)

`src/lib/import/leveling/` es puro, como `calculations/`: texto de entrada,
filas de libreta de salida.

- **Detector con lectores intercambiables** (`index.ts`, `READERS`). Cada
  lector declara `detect(text)` —por el contenido, no por la extensión— y
  `read(text)`, y todos devuelven la misma forma intermedia
  (`types.ts`): **armadas**, cada una con su visual atrás y sus visuales
  adelante; la última adelante es la del punto de cambio y las anteriores,
  radiaciones. Añadir un instrumento es escribir un lector y registrarlo.
- `leica-l.ts` lee el `.L` de Leica con los offsets medidos en
  `docs/carteras/analisis-crudo-nivel-digital.md`. Agrupa las repeticiones
  por armada, sentido y punto y las promedia **en enteros** (décimas de mm y
  mm) redondeando a la resolución de las columnas, para que el redondeo no
  dependa de la coma flotante. Una línea desconocida o mal formada avisa; no
  rompe.
- `topofield-csv.ts` lee la plantilla (`CSV_TEMPLATE`, que el diálogo ofrece
  como descarga): una fila por fila de libreta, `,` o `;` —con `;`, coma
  decimal—. Declara la división ida/vuelta y los tipos, que mandan sobre lo
  deducido.
- `to-libreta.ts`: `toLibreta(file, mode)` con `mode` un recorrido, o ida y
  vuelta con la armada de giro; `detectTurnSetup` propone el giro (la armada
  cuya visual adelante es el punto desde el que se miró atrás en la
  anterior); `proposedLevelingType` propone `closed` para un recorrido que
  vuelve a su BM y `open` (o `link`, si ya lo era) para ida y vuelta.
- El diálogo (`components/leveling/import-dialog.tsx`) no guarda: entrega
  filas y configuración. En el editor llenan el borrador; al crear,
  `createLevelingProcessAction` inserta el proceso y guarda las lecturas con
  `saveLevelingProcessAction`, y si eso falla borra el proceso recién creado.

**La vuelta de una abierta.** Hasta la Fase 16, `computeLeveling` arrancaba
la vuelta en `startElevation` si no había cota de llegada conocida, y en una
abierta con vuelta todas las cotas de la vuelta salían desplazadas por el
desnivel de la ida. Ahora parte de la cota final calculada de la ida. La
discrepancia no cambia: compara desniveles.

### Puntos homólogos ida-vuelta (Fase 17)

`compareHomologousPoints(result)` compara punto a punto la ida y la vuelta
cuando pasan por los mismos puntos: residuo = cota de la vuelta − cota de la
ida, con las cotas **calculadas** (la compensación reparte el error de la ida
y escondería lo que se quiere ver), en el orden de la vuelta.

- Los códigos se emparejan con `samePointCode`, que ignora espacios y
  mayúsculas: El Verjón escribe `AUX1` en la ida y `AUX 1` en la vuelta.
- Devuelve `null` sin vuelta, si solo se comparten los extremos de la vuelta
  —la tabla repetiría la discrepancia— o si la vuelta no empieza en el punto
  donde terminó la ida: el motor la arranca en esa cota y todos los residuos
  saldrían desplazados. Las filas a medio capturar, con cota no finita, no se
  comparan.
- Un código que se repite dentro de un recorrido (el BM de partida de una
  cerrada) no se empareja y se devuelve en `skippedCodes`.
- Es **informativa**: no entra en el veredicto, ni en la compensación, ni en
  el informe o el Excel. Solo la muestra el panel de resultados del editor.
- El último residuo es la discrepancia cuando la vuelta arranca en la cota a
  la que llegó la ida (cerrada, abierta). En una de enlace arranca en la cota
  conocida de llegada y no lo es. El motor lo dice en `lastIsDiscrepancy`, y
  el panel solo lo rotula entonces.

Reproduce la columna `P` de la hoja de El Verjón (de −1 a −7 mm, y −5 mm en
D1) y los residuos del crudo de nivel digital (hasta −5.2 mm a mitad del
recorrido, con una discrepancia de 0.4 mm).

### Georreferenciación (Fase 15)

Una poligonal medida en local se lleva al sistema real con dos de sus
estaciones de coordenadas conocidas.

- `fitTwoPoints` da una transformación **rígida**: θ es la diferencia de
  azimuts de la línea A→B, y la traslación hace coincidir los centroides. θ se
  redondea a 0.1″ y la traslación a 0.1 mm, las resoluciones de las columnas.
  El factor de escala |AB| real / |AB| local se calcula solo como control
  (`scaleWithinOrder` lo compara con `1 / minRelativePrecision(orden)`); no se
  aplica, porque cambiaría las distancias medidas.
- `georeferenceInput` transforma la **entrada** —arranque, azimut de arranque
  y, en la abierta con control, llegada y su azimut— y se **recalcula**. No se
  rota lo calculado. Bowditch, Crandall y mínimos cuadrados dan lo mismo por
  los dos caminos; **Tránsito no**, porque reparte según |ΔN| y |ΔE|: 2.66 mm
  de diferencia en la Vivero. El veredicto es el mismo con los cuatro.
- `components/polygonal/georeference-plan.ts` (sin `"use client"`) compone la
  ruta completa desde las filas con `polygonalInputOf`: valida los puntos,
  ajusta, recalcula, comprueba que el veredicto no cambió a la resolución de
  las columnas y devuelve las columnas que hay que escribir. Rechaza con el
  motivo un factor de escala fuera de 0.5–2 —son unidades equivocadas, no una
  proyección— y coordenadas por encima de `decimal(12,4)`, que la base
  rechazaría con un error opaco. Lo usan la vista
  previa del diálogo y `georeferencePolygonalProcessAction`, así que se
  escribe exactamente lo que el usuario vio.
- Un amarre del catálogo pasa a **manual** (`reference_point_id = null`, el
  código se queda): si no, `resolveStartAzimuth` recalcularía el azimut desde
  sus coordenadas locales en el siguiente guardado y desharía la rotación.
- La acción escribe fila a fila con `UPDATE`: en un cerrado el trigger no deja
  borrar y reinsertar, que es lo que hace el guardado.

### Trazas y dibujo (Fase 13)

`polygonalTraces(input, result)` devuelve, vértice a vértice, la poligonal
ajustada y la sin compensar. Las encadena desde el arranque con las
proyecciones que el motor ya calculó —corregidas y originales—, sin matemática
nueva. El invariante que la prueba, sobre las carteras reales: en una cerrada, el
último punto sin compensar queda a `(errorNorth, errorEast)` del arranque; en
una abierta con control, a esa misma distancia del punto de llegada.

El dibujo (`polygonal-plot.tsx`, SVG propio) exagera la sin compensar ×k,
porque a escala real 1.6 cm sobre 42 m (cartera TT4) ocupan 0.2 px.
`src/lib/design/polygonal-plot.ts`, puro y con tests, decide la geometría:

- `exaggerationFactor`: el mayor 1, 2 o 5 × 10ⁿ que lleva el mayor
  desplazamiento al 5 % (`EXAGGERATION_TARGET_FRACTION`) de la extensión,
  nunca menor que 1. Da TT4 ×100, Vivero ×200 y Pentágono ×1.
- `plotFrame`: proporción **1:1** entre Norte y Este (es un plano; escalar los
  ejes aparte deformaría los ángulos), Norte hacia arriba, zoom alrededor de un
  centro.

El editor usa `PolygonalPlotViewer`, que mide su contenedor y dibuja con el
ancho real: con un `viewBox` fijo, en un teléfono el texto se reducía a unos
4 px. El informe usa `PolygonalPlot` con el tamaño por defecto.

**Un solo camino de filas a entrada.** `polygonal-draft.ts` (sin `"use
client"`) contiene `processToConfig`, `stationToDraft` y `buildInput`, y
`polygonalInputOf` los compone. El editor y el informe imprimible, que se
renderiza en el servidor, construyen la entrada del cálculo por ahí, así que el
dibujo del informe es por construcción el del editor.

### Métodos de corrección

`bowditch` (proporcional a la longitud), `transit` (proporcional al **valor
absoluto** de las proyecciones) y `crandall` (mínimos cuadrados sobre
distancias). El valor absoluto en Tránsito no es un detalle: repartir sobre la
proyección con signo hace que las correcciones se cancelen y la poligonal no
cierre. Ver «Las hojas de Excel de referencia».

**`least_squares` (Fase 14)** ajusta ángulos y distancias a la vez por
**ecuaciones de condición**: `v = −Q·Aᵀ·(A·Q·Aᵀ)⁻¹·w`, con `Q = diag(σ²)`. En
una cerrada hay tres condiciones (angular, ΣΔN, ΣΔE); en una abierta con
control, dos lineales más la angular si hay azimut de llegada. El sistema es de
3×3 o 2×2 sea cual sea el número de estaciones.

- `least-squares.ts` no sabe de topografía: recibe observaciones, σ y una
  función que da `f(l)` y `A = ∂f/∂l`. `polygonal.ts` pone el modelo
  (`leastSquaresClosed`, `leastSquaresOpenControlled`) con coeficientes
  **analíticos**: un ángulo *i* rota todos los lados desde *i*, así que
  `∂ΣΔN/∂αᵢ = −Σ ΔE` y `∂ΣΔE/∂αᵢ = +Σ ΔN` sobre esos lados. Un test los compara
  con diferencias finitas.
- **Itera** con `w = f(lₖ) + A·(l₀ − lₖ)` porque las condiciones no son lineales
  en los ángulos. Converge cuando el cambio de toda corrección es menor que
  1e-10 σ (3 iteraciones en la Vivero).
- El **ángulo de orientación es datum**: no entra como observación. En el
  esquema con fila de cierre (TT4) aparece en la condición angular como
  constante.
- Los pesos llegan en `PolygonalInput.leastSquares`. Sin ellos, el resultado
  trae `adjustment: { status: "missing_weights" }` y coordenadas en `null`: el
  motor no cae a Bowditch en silencio.
- Con pesos pero **sin ajuste posible**, `adjustment: { status:
  "unadjustable", reason }`, también con coordenadas en `null`: una abierta de
  **un solo lado** (`one_side`: las condiciones de llegada en N y en E dependen
  de una sola distancia), un sistema **singular** (`solveLinear` lanza
  `SingularSystemError` con un pivote menor que 1e-12 veces la mayor entrada,
  y `polygonal.ts` lo captura) o **sin convergencia** en 10 iteraciones. El
  motor sigue siendo total: no lanza.
- La abierta con control **no publica deflexiones corregidas**, como con los
  otros métodos: el ajuste va en los azimuts, y cada corrección, con su signo,
  en `adjustment.angleCorrectionsSec`.
- El **veredicto no cambia**: error angular, lineal y precisión relativa son
  los de la cartera medida, antes de ajustar. Solo cambian las coordenadas,
  los ángulos corregidos y los azimuts.
- σ₀ = √(vᵀPv / r). `sigma0Reading` lo lee contra `SIGMA0_BAND = [0.5, 2]`:
  una banda con nombre, no una prueba χ² (fuera de alcance).

Sobre la cartera Vivero con los pesos de la hoja (2″, 0.011 m, 2 mediciones)
reproduce el cálculo independiente del PRD, y no los valores del análisis de
la hoja, que heredan su defecto en la conversión del azimut
(`docs/prds/13-minimos-cuadrados.md`, hallazgo 2).

### Tolerancias

Viven en `tolerances.ts`, **nunca hardcodeadas en componentes**:

| Orden | K angular (″) | Precisión mínima |
|---|---|---|
| `primer_orden` | 1 | 1:100.000 |
| `segundo_orden` | 5 | 1:20.000 |
| `tercer_orden` | 15 | 1:5.000 |
| `ordinario` | 30 | 1:3.000 |

Tolerancia angular = K·√n, donde n es el número de ángulos medidos. Nivelación
usa su propio coeficiente, `LEVELING_TOLERANCE_K` (3/6/12/24 mm, tolerancia
K·√D en km) — ver § 4 y § 7 del PRD principal.

### Aviso de equipo insuficiente (Fase 8)

`totalStationMeetsOrder(order, angularPrecisionSeconds)` y
`levelMeetsOrder(order, kmPrecisionMm)`, en `tolerances.ts`, responden si el
instrumento declarado puede entregar el orden elegido. La comparación es
directa entre coeficientes —`σ > K`— y no con un margen: la tolerancia escala
como `K·√n` (o `K·√D` en nivelación) y la desviación del instrumento escala
igual, como `σ·√n`, así que el factor se cancela y un umbral con margen sería
un criterio estadístico inventado. Es estrictamente mayor: `σ = K` es
justo el instrumento que corresponde al orden, no un problema. Sin dato de
precisión, ninguna de las dos función opina —devuelve `true`—, porque un campo
vacío no es un instrumento insuficiente.

| Módulo | Regla | Avisa | No avisa |
|---|---|---|---|
| Poligonal | `angularPrecisionSeconds > ANGULAR_TOLERANCE_K[orden]` | 5″ con primer orden (K=1″) | 1″ con primer orden; 5″ con tercer orden (K=15″) |
| Nivelación | `kmPrecisionMm > LEVELING_TOLERANCE_K[orden]` | 5.0 mm/km con primer orden (K=3) | 2.5 mm/km con primer orden (ajustado, no imposible) |
| Asentamientos | igual que nivelación, sobre el `km_precision_mm` de la **visita** | igual que nivelación | igual que nivelación |

El aviso vive en `TotalStationFieldset`/`LevelFieldset`
(`design-system/equipment-fields.tsx`), compartidos por los tres formularios de
configuración de proceso (poligonal, nivelación, visita de asentamiento) junto
al `PrecisionOrderSelect`. Avisa, no bloquea — misma política que el resto de
la validación de captura (§ 7).

### Umbral de cierre exacto

`computePolygonal` considera exacto un cierre con `linearError <= 1e-9` m y
devuelve `relativePrecision: Infinity`, que se presenta como `1:∞`.

El umbral existe porque un cierre geométricamente exacto deja un residuo de
punto flotante (~1e-14) que producía precisiones absurdas como
`1:17222920531038532`. Un nanómetro está diez órdenes de magnitud por debajo de
cualquier precisión instrumental real.

### Nivelación: acumulado desde el origen (Fase 19)

La corrección proporcional (§ 6.8 del PRD) reparte el error de cierre según
`Dist_acumulada_i / Dist_total`. `accumulateDistances` define ese acumulado
como el recorrido **desde el origen hasta el punto**:

- una fila `bm`/`pc` acumula **hasta su V−**; su V+ —la visual hacia la armada
  siguiente— se suma después, para las filas que vienen;
- una `intermediate` no aporta y hereda el acumulado de su armada hasta el
  instrumento;
- el total, que es el acumulado de la última fila, no cambia.

Así el BM de partida queda en 0 y **no recibe corrección**. Hasta la Fase 19
la fila incluía su propia V+, y el BM de partida se movía aunque su cota es
conocida: en el circuito del seed, BM-1 quedaba en 100.0013 y PC-1 en
100.3040, en vez de 100.0000 y 100.3027 (N8, `docs/pendientes.md`). Las
intermedias no cambian, y con ellas tampoco las cotas de los puntos de control
de asentamientos.

**Los procesos reconstruidos conservan la regla anterior.** El backfill de la
Fase 9 repartió cada tramo a medias entre la V− y la V+ **de la misma fila**,
así que en esos procesos la V+ de una fila es media visual de llegada, no la
que sale del punto. `LevelingInput.distancesReconstructed` lleva la marca al
motor: el editor la pasa desde `process.distances_reconstructed`, y la acción
de guardado calcula siempre con la regla nueva porque guardar deja la marca en
`false` (Fase 9).

**Lo ya guardado se migró** con
`20260927000000_compensacion_desde_el_origen.sql`, cerrados incluidos: solo
derivados (acumulado, corrección y cota compensada), con los triggers de
inmutabilidad desactivados alrededor de cada `UPDATE`. Recalcula la cadena
desde las distancias por visual con funciones de ventana, igual que el motor,
y se verificó fila a fila contra él. Una guarda aborta si un punto de control
de asentamientos es punto de cambio en una libreta compensada: su cota
cambiaría y la serie solo la recalcula `computeHistory`.

### `computeSettlements`, `computeDifferentials`, `classifyAlert`

El motor de asentamientos, en `settlement.ts`, se apoya en tres piezas
verificadas independientemente contra el marco teórico del dominio (ver
`docs/prds/04-asentamientos.md`, «Hallazgos de la verificación»):

- **Asentamiento** — `Δs_parcial = (cota_n − cota_{n-1}) × 1000`,
  `Δs_acumulado = (cota_n − línea_base) × 1000`, ambos en mm. Un signo
  positivo es levantamiento y se muestra como tal, no como valor absoluto.
  La **línea base** es la C0 si el catálogo la trae, fechada en la primera
  visita del lugar, o la primera lectura del punto si no (Fase 11). Hasta la
  Fase 10 un punto sin C0 tenía acumulado `null` y nunca alertaba por
  acumulado.
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

**Periodo común (Fase 11).** Si los dos puntos de un par tienen líneas base
de fechas distintas —uno se dio de alta a mitad del monitoreo—, restar
acumulados compararía periodos distintos. Se mide entonces desde `t0`, la
más tardía de las dos, con una sola fórmula para ambos puntos
(`cota − cota_en_t0`). Si alguno no se midió en `t0`, el par queda fuera.
Cada `DifferentialPair` lleva los dos asentamientos que resta
(`settlementAMm`, `settlementBMm`) y su `sinceDate`, para que la tabla
muestre números que restados den el diferencial.

**Lectura fuera de tendencia (Fase 12).** `detectTrendDeviations` marca una
lectura que va **contra** la dirección de su punto más que un margen, o que lo
mueve **más del doble** de lo que la velocidad de su lectura anterior preveía,
más el margen:

```
d = signo de V_prev (−1 si es 0)
contraria  si  d · parcial < −m
excesiva   si  d · parcial >  2 · |V_prev| · Δt + m
```

Moverse menos de lo previsto nunca avisa. Es a propósito: el criterio obvio,
extrapolar la velocidad anterior, marcaba lecturas correctas en consolidación,
que frena. El margen es `m = K_orden · √0.25`, la tolerancia de cierre de un
circuito de referencia de 250 m con la `K` de nivelación del orden de la visita
(`trendDeviationMargin`, 1.5 / 3 / 6 / 12 mm). La longitud de referencia
(`TREND_DEVIATION_REFERENCE_KM`) y el factor 2 (`TREND_DEVIATION_RATE_FACTOR`)
son decisiones con nombre en `tolerances.ts`. Solo evalúa desde la tercera
lectura del punto. P-09 del marco teórico y las series del seed son tests de
regresión: no dan ningún aviso con ninguno de los cuatro márgenes.

Es una función aparte, y no un campo de `computeSettlements`, porque necesita
el orden de cada visita, que `VisitInput` no lleva. La llaman el editor de
visita (en vivo, con el orden de la cabecera) y la página del panel. Avisa,
no bloquea y no se persiste. Tampoco cambia el semáforo ni `computeTrends`.

`computeHistory` compone todo lo anterior sobre la serie completa de un
lugar: ordena las visitas **por fecha, no por `visit_number`** —hay un test
que fija ese contrato— y añade `computeTrends`, que solo emite tendencia
(`accelerating` / `converging`) con al menos tres visitas (dos velocidades
que comparar). Con menos, el punto queda sin indicador: devolver
`"converging"` afirmaría una convergencia que nadie ha comprobado.

---

### Libreta de la visita de asentamientos (Fase 18)

`lib/calculations/settlement-book.ts` no trae motor de nivelación propio:

- `computeVisitBook(rows, cotaAmarre, orden)` llama a `computeLeveling` como
  **circuito cerrado** sobre el amarre, sin vuelta. Una libreta **a medias**
  —capturando en vivo, sin la V− de cierre— se calcula como **abierta**: como
  cerrada, el motor compararía el último punto de la cadena con el amarre y
  daría un cierre de metros.
- `deriveControlElevations(result, puntos, fecha)`: la fila con V− cuyo código
  coincide (`samePointCode`) con un punto de control da su cota, la
  **compensada** —el motor la deja igual a la calculada si no compensó—,
  redondeada a 4 decimales, la resolución de la base. Dos filas con V− para el
  mismo punto son un error; un punto fuera de vigencia avisa y no da cota; uno
  vigente sin V− avisa. Un código que no es punto de control es una radiación
  normal.
- `buildBookTemplate(anterior, puntos, fecha, amarre)`: la plantilla del editor
  —la secuencia de la visita anterior con el amarre nuevo, sin los puntos de
  baja y con los de alta antes del cierre; o, sin anterior, amarre → puntos
  vigentes como intermedias → amarre—.

`lib/calculations/settlement-summary.ts` resume el histórico para los KPIs del
panel y de la visita (extremos con signo, promedio, mayor movimiento,
velocidad, alertas, peor distorsión angular) y `nextAccumulatedThreshold` da
la nota del historial del punto. Dos KPIs del prototipo se sustituyeron: su
«velocidad reciente» dividía entre «un mes» el cambio de cuatro visitas —el
error del marco teórico que encontró la Fase 5— y su «diferencial máximo»
ignoraba la distancia; se usan la velocidad del motor y la peor distorsión.

`lib/demo/libreta-asentamientos.ts` (`generateVisitBook`) construye una
libreta **hacia atrás** desde una serie: elige las intermedias para que la cota
compensada sea la de la serie (la compensación de una intermedia es −E·d/D con
d la distancia acumulada de su armada). El seed y el demo lo usan, y el test
comprueba la reproducción a 0.1 mm con varias semillas y cierres.

Las gráficas del panel y de la visita (`components/settlement/charts/`) ponen
el **tiempo real** en el eje X (`timeScale`, `timeTicks` en `chart-scale.ts`) y
calculan el dominio Y con `lib/design/chart-domain.ts`: 0, los datos y el
siguiente umbral por encima de ellos. El `viewBox` toma el ancho real del
contenedor —la lección del `viewBox` de la Fase 13—, así que el texto no baja
de 11 px en un teléfono.

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
- **Cierre** — exige lectura de todos los puntos **vigentes** en la fecha de
  la visita; una visita cerrada es el registro inmutable de una fecha, y
  cerrarla incompleta deja un hueco que ya no se puede rellenar. Además, no
  cierra una visita si alguno de sus puntos sin C0 tiene la línea base en una
  visita **anterior abierta**: si esa lectura siguiera editable, cambiarla
  movería el acumulado que se recalcula en vivo para la visita ya cerrada
  (Fase 11).
- **Estadística** — clasifica el semáforo, pero **no participa en si se
  puede guardar o cerrar**. Un punto en alarma se guarda y se cierra con
  normalidad: es el hallazgo que el monitoreo existe para documentar, no un
  error de captura. Verificado con un test explícito
  (`validators/settlement.test.ts`, «NO bloquea el cierre por un
  asentamiento en alarma») y con las Server Actions, que solo invocan
  `validateVisitCapture`/`validateVisitClose` — ninguna de las dos consulta
  `alert_status`. El aviso de lectura fuera de tendencia (Fase 12) sigue la
  misma regla: se muestra al capturar, al cerrar y en el panel, pero no
  bloquea nada.

---

### `validators/settlement-book.ts` — la libreta de la visita (Fase 18)

`validateVisitBook` hereda las reglas de captura de nivelación
(`validateRunCapture` con tipo cerrado) y añade las del amarre: con lecturas,
código y cota obligatorios, y la primera y la última fila son el amarre. Al
cerrar, `validateVisitClose` recibe la comprobación aritmética de la libreta y
**bloquea** si falla; la **tolerancia no bloquea**: una visita fuera de
tolerancia se guarda y se cierra, con las cotas sin compensar y el aviso en el
editor, la vista, el panel y el diálogo de cierre (decisión 5 del PRD de la
fase). Todo se revalida en el servidor.

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

**Panel lateral** — `Drawer` (Fase 18): lectura larga que acompaña a una
pantalla sin sustituirla, como el registro de nivelación de una visita. Se
cierra con Esc, con «Cerrar» o con el fondo; lleva el foco al abrir y lo
devuelve al cerrar, y mantiene Tab dentro. Capturar datos no va en un
`Drawer`: en tableta resulta estrecho, y para eso está la página completa.

**Texto `sr-only` en una tabla con desplazamiento** — el contenedor con
`overflow` lleva `relative`. El `sr-only` es absoluto: sin un contenedor
posicionado escapa del recorte y ensancha la página entera. Se vio en la Fase
18: el panel de asentamientos medía 709 px en un teléfono por un «(fuera de
tolerancia)» invisible.

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

774 tests en 38 archivos, Vitest, entorno `node` **sin jsdom**.

| Archivo | Tests | Cubre |
|---|---|---|
| `lib/calculations/settlement.test.ts` | 83 | Asentamiento parcial/acumulado, velocidad (intervalos 28/30/31/61/92 días), diferenciales, distorsión angular, `classifyAlert`, tendencias, orden cronológico; línea base por primera lectura, diferenciales sobre el periodo común, `isPointActiveOn` y `pointInputOf` (Fase 11); lectura fuera de tendencia con P-09 y el seed como regresión (Fase 12) |
| `lib/calculations/leveling.test.ts` | 75 | Motor de nivelación: libreta, corrección proporcional, cierre, ida y vuelta; la vuelta de una abierta parte de la cota final de la ida (Fase 16); acumulado desde el origen: el BM de partida no se compensa, circuito del seed en 100.3027 / 99.8053 y un proceso reconstruido conserva su regla (Fase 19) |
| `lib/calculations/homologous.test.ts` | 11 | Puntos homólogos ida-vuelta: la columna `P` de El Verjón con `AUX1`/`AUX 1`; los residuos del crudo leído con el importador; sin vuelta, solo con extremos compartidos o con una vuelta que no empieza donde terminó la ida, `null`; filas a medio capturar; códigos repetidos omitidos; de enlace; `samePointCode` (Fase 17) |
| `lib/import/leveling/import.test.ts` | 22 | Importación de libretas: el crudo real de nivel digital leído del repositorio —cabecera, 16 armadas, promedios redondeados, calidad, giro en la armada 9, líneas desconocidas—; un recorrido (cierre −0.4 mm) e ida y vuelta (discrepancia 0.4 mm, C18 = 2542.9181) pasando por `computeLeveling`; plantilla CSV con `;` y coma decimal, radiaciones, vuelta declarada, comillas y un punto de cambio en dos filas; Windows-1252; una sola armada; detector (Fase 16) |
| `lib/validators/polygonal.test.ts` | 66 | Captura y cierre de poligonal, `expectStationCapture`, código de punto obligatorio; `canPersistAngleFormat` (Fase 13); pesos del ajuste por mínimos cuadrados: completos, dentro de la columna y a su escala, con cualquier método (Fase 14); puntos de control de la georreferenciación (Fase 15) |
| `lib/validators/settlement.test.ts` | 41 | Captura y cierre de asentamientos — incluye que la alarma no bloquea; vigencia, regla de la línea base abierta, baja, deshacer la baja y alta (Fase 11) |
| `lib/validators/leveling.test.ts` | 42 | Captura y cierre de nivelación; equilibrado **por armada** con la ida de El Verjón: avisos exactamente en C 2, C 3, C 4, C 7, D3 y C 8, con la armada en el texto (Fase 19) |
| `lib/calculations/polygonal.test.ts` | 40 | Motor de cálculo, los tres tipos y métodos; `polygonalTraces` con el invariante del error de cierre (Fase 13) |
| `lib/process-list.test.ts` | 28 | Filtrado, orden y conteo del listado |
| `lib/utils/format.test.ts` | 27 | Fecha relativa, **formateo único de precisión** y mensaje del aviso de lectura fuera de tendencia (Fase 12); fecha corta con meses fijos, mm con signo y cierre de la libreta (Fase 18) |
| `lib/calculations/tolerances.test.ts` | 22 | Tolerancias por orden, presets de asentamientos, `thresholdsOf` y el aviso de equipo insuficiente (`totalStationMeetsOrder`/`levelMeetsOrder`, Fase 8) |
| `lib/export/polygonal-workbook.test.ts` | 23 | Libro de poligonal: tres hojas, decimales, DMS, borrador con celdas vacías, metadatos del proyecto, equipo y orden del **proceso** (Fase 8); columnas y resumen del ajuste por mínimos cuadrados (Fase 14); sección de georreferenciación (Fase 15) |
| `lib/calculations/georeference.test.ts` | 18 | Georreferenciación: la Vivero local llevada al real con D1 y D3 contra el PRD (rotación 35°00′07.8″, coordenadas a 0.1 mm); el veredicto igual con los cuatro métodos; rígido con Bowditch, Crandall y mínimos cuadrados, y Tránsito acotado a 2.66 mm; ajuste exacto y con residuo; redondeos; abierta con control; factor de escala por orden (Fase 15) |
| `components/polygonal/georeference-plan.test.ts` | 9 | **Ruta** de la georreferenciación desde las filas: columnas de cabecera y estaciones, residuos, amarre a manual, sin columnas de cierre, rechazos, factor de escala de unidades equivocadas, aviso de escala (Fase 15) |
| `lib/calculations/least-squares.test.ts` | 23 | Ajuste por mínimos cuadrados por la ruta de `computePolygonal`: la Vivero contra el PRD, **condiciones en cero**, correcciones no uniformes, mismo veredicto que Bowditch, TT4 con la orientación como datum, abierta con y sin azimut de llegada, sin pesos, escala de σ₀, coeficientes contra diferencias finitas; una abierta de un solo lado no se ajusta y no lanza, singularidad con tolerancia relativa, aviso de no convergencia; lectura de σ₀ (Fase 14) |
| `lib/calculations/settlement-persistence.test.ts` | 18 | **Qué lecturas hay que reescribir** al recalcular: cambio de solo la alerta, visitas cerradas intactas, velocidad como cadena y a la precisión de su columna; filas de libreta a persistir y lectura de la base (Fase 18) |
| `lib/calculations/angles.test.ts` | 16 | Conversiones DMS ↔ decimal; captura en grados decimales, con ida y vuelta exacta en 12 000 valores (Fase 13) |
| `lib/demo/fixtures.test.ts` | 14 | Fixtures del proyecto de ejemplo: poligonal, nivelación y asentamientos cumplen contra el motor real |
| `lib/design/chart-scale.test.ts` | 18 | Escala lineal y marcas «nice», incluidos rangos degenerados; escala y marcas de tiempo en días (Fase 18) |
| `lib/design/polygonal-plot.test.ts` | 12 | Geometría del dibujo de la poligonal: factor de exageración con los valores del seed (TT4 ×100, Vivero ×200, Pentágono ×1), proporción 1:1, zoom (Fase 13) |
| `lib/export/settlement-workbook.test.ts` | 15 | Libro de asentamientos: catálogo con alta, baja y motivo, códigos en vez de UUID, `1/∞`, equipo por visita en Datos Crudos (Fase 8); hoja «Libretas» y bloque de visitas (Fase 18) |
| `lib/calculations/settlement-book.test.ts` | 18 | Libreta de la visita: la del prototipo por `computeVisitBook` (cierre 1.30 mm, tolerancia 4.87), sin distancias, a medias como recorrido abierto; derivación compensada y redondeada, fuera de tolerancia, punto de control como punto de cambio, duplicado, fuera de vigencia, ausente, código ajeno; plantilla (Fase 18); el amarre no se compensa y las intermedias conservan su acumulado (Fase 19) |
| `lib/design/chart-domain.test.ts` | 16 | Dominio Y de las gráficas de asentamiento: 0, los datos y el siguiente umbral por encima; sin datos, sobre un umbral, más allá de la alarma, levantamiento, umbrales desordenados, `NaN` (Fase 18) |
| `lib/validators/settlement-book.test.ts` | 13 | Validación de la libreta: amarre obligatorio con lecturas, arranque y cierre en él, tipo BM, errores de nivelación que se propagan, números no finitos; mensajes; la comprobación aritmética bloquea el cierre y la tolerancia no (Fase 18) |
| `lib/calculations/settlement-summary.test.ts` | 10 | KPIs: extremos con signo, levantamiento, visita base, visita sin lecturas, lugar sin visitas, peor distorsión `1/∞`, promedio con un alta; siguiente umbral de acumulado (Fase 18) |
| `lib/demo/libreta-asentamientos.test.ts` | 6 | Generador de libretas del seed: válida, con punto de cambio, cierra con el error pedido y **reproduce la serie a 0.1 mm** con varias semillas; fuera de tolerancia sin compensar; determinista (Fase 18) |
| `components/leveling/readings-table.test.ts` | 2 | La tabla de captura compartida: sin las props de la libreta de la visita, nivelación se renderiza igual (Fase 18) |
| `lib/validators/sign-up.test.ts` | 10 | Bloqueo de registro sin código de invitación |
| `components/polygonal/closure-verdict.test.tsx` | 10 | Decisión del veredicto |
| `lib/reports/eligibility.test.ts` | 9 | **Qué puede entrar en un informe**: solo cerrados, nunca un `rejected`, nunca un lugar activo |
| `lib/export/leveling-workbook.test.ts` | 9 | Libro de nivelación: etiquetas del dominio, orden ida/vuelta, equipo y orden del proceso (Fase 8) |
| `components/design-system/status-indicator.test.tsx` | 8 | Formas del semáforo de 4 niveles |
| `lib/design/series-markers.test.ts` | 8 | **Diez formas de marcador**: ninguna se repite antes de la serie 11 |
| `(app)/.../leveling/[pid]/actions.test.ts` | 8 | Derivación del estado de cierre en servidor |
| `(app)/.../polygonal/[pid]/actions.test.ts` | 8 | Derivación del estado de cierre en servidor |
| `components/design-system/tabs.test.ts` | 6 | Construcción de enlaces |
| `lib/validators/project.test.ts` | 5 | El proyecto ya no valida equipo ni orden de precisión (Fase 8) |
| `components/design-system/breadcrumbs.test.tsx` | 5 | Resolución de la ruta |

La Fase 6 cerró los huecos que la § 11 registraba: `expectStationCapture`,
`niceTicks` con rangos degenerados y `computeDifferentials` con un punto sin
lectura ya tienen cobertura. Lo que **sigue sin tests** es la E/S de los Server
Actions; ver [deuda técnica](#11-deuda-técnica-conocida).

### Cómo se testea la interfaz

Sin jsdom, no se testea el comportamiento en el navegador. El patrón es
**extraer la decisión como función pura** y testear esa función: `verdictFor`
en `closure-verdict.tsx`, `resolveBreadcrumbs` en `breadcrumbs.tsx`,
`tabHref` en `tabs.tsx`. Cuando lo que importa es **qué se pinta**, sin
eventos, basta `renderToStaticMarkup` de `react-dom/server` en el entorno
`node`: así prueba `readings-table.test.ts` que la tabla compartida no cambia
para nivelación (Fase 18).

El comportamiento visual se verifica con Playwright contra la aplicación real,
de forma manual durante el desarrollo.

### Prueba manual de extremo a extremo

`docs/testing/` tiene un recorrido manual por módulo:
[poligonal](../testing/manual-e2e-poligonal.md),
[nivelación](../testing/manual-e2e-nivelacion.md),
[asentamientos](../testing/manual-e2e-asentamientos.md) e
[informes y exportación](../testing/manual-e2e-informes.md).

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

**El rechazo de un amarre sin coordenadas no tiene test automatizado.** El
selector de punto de amarre excluye los `reference_points` sin `north`/`east`
—verificado en la app— y `resolveStartAzimuth` en la Server Action los rechaza,
pero esa guarda solo está cubierta por inspección de código. Importa porque la
acción es alcanzable con un payload construido a mano, sin pasar por el
selector.

**El campo de código de punto trunca los códigos largos.** El input de la tabla
de estaciones mide `w-24` y «Famarena_5» se ve como «Famaren». El valor está
intacto —la tabla de resultados lo muestra completo—, es solo el ancho. Previo a
la Fase 7; se arregla cuando se toque el sistema de diseño de la tabla.

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
`settlement/[siteId]/visits/[visitId]` y su `editar/`) tienen `loading.tsx` propio — tampoco
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

**Dos cabos sueltos de la Fase 9, menores.** Los detectó la revisión del PR y
se dejaron sin arreglar por acotados:

- `computeLeveling` evalúa la tolerancia de discrepancia con `Math.min` de las
  dos distancias, pero `|| Number.POSITIVE_INFINITY` hace que una ida **sin**
  distancias ceda el cálculo a la vuelta. El veredicto de discrepancia sale
  entonces de un solo recorrido, cuando el comentario promete «la menor de las
  dos». Acotado porque una ida sin distancias ya bloquea el guardado.
- `validateRunCapture` tiene `order` y `distancesReconstructed` con valores por
  defecto, así que un llamador que los olvide evalúa el equilibrado contra
  tercer orden sin que el typecheck lo señale. Hacerlos obligatorios dejaría
  que el compilador señale a cada llamador — que es justo lo que habría
  atrapado el `hasClosingRow` no propagado de la Fase 7.

**Equilibrado de visuales: resuelto en la Fase 9.** Era la deuda más antigua
de nivelación — la regla de campo que cancela curvatura, refracción y
colimación— y no se validaba porque `leveling_readings.distance_m` guardaba
una sola distancia por fila, mientras el equilibrado compara la distancia de
la V+ con la de la V− dentro de una armada.

La Fase 9 sustituyó esa columna por `back_distance_m` y `fore_distance_m`, una
por visual, que es justo lo que la comparación necesitaba.
`validateSightBalances` (`src/lib/validators/leveling.ts`) avisa —no bloquea—
cuando la diferencia pasa del límite del orden, definido en
`SIGHT_BALANCE_LIMIT_M` (`tolerances.ts`).

**Por armada desde la Fase 19 (N7).** La Fase 9 comparaba la V+ y la V− de
una **misma fila**, que en un punto de cambio son de armadas distintas: sobre
la ida de El Verjón avisaba en filas equivocadas con magnitudes de ninguna
armada. Ahora se compara la V+ de una fila `bm`/`pc` con la V− de la
**siguiente fila no intermedia**, que es lo que calcula la hoja de campo; las
intermedias no abren ni cierran armada. El aviso va en la celda de la V− que
cierra la armada y la nombra: «Armada C 1 → C 2: visuales desequilibradas,
10.8 m de diferencia; el límite del orden es 4 m».

**Salvedad:** en procesos con `distances_reconstructed = true` el equilibrado
**no se evalúa**. Son los que existían antes de la Fase 9, cuyas distancias por
visual las reconstruyó el backfill repartiendo por mitades la diferencia del
acumulado: el reparto real nunca se capturó, así que el equilibrado saldría
perfecto por construcción — una conformidad que el dato no respalda.

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

> Nota de la Fase 11: las tres acciones nuevas del catálogo
> (`retirePointAction`, `undoRetirementAction` y el alta en
> `createPointAction`) no cambian ningún valor derivado —dar de baja no altera
> el cálculo de los demás puntos, y un punto recién dado de alta no tiene
> lecturas—, así que no necesitan resincronizar. Lo que sí cambió una entrada
> fue el **motor**: los puntos sin C0 pasaron de acumulado `null` a acumulado
> contra su primera lectura. Para los datos ya persistidos existe
> `scripts/resincronizar-asentamientos.mjs`, que simula por defecto y reescribe
> con `--aplicar` las visitas abiertas mediante `resyncSiteReadings`.

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
`visitsToRewrite`) y tiene 16 tests: que un cambio de **solo** el nivel de
alerta cuenta como cambio —el caso exacto de editar umbrales, donde ningún
número varía—, que una visita cerrada no se devuelve nunca, que la velocidad
que llega como cadena no marca una fila como cambiada, y que se devuelven solo
las lecturas alteradas y no la visita entera.

Hasta la Fase 11, `readingChanged` comparaba la velocidad sin redondear del
motor con la persistida en `DECIMAL(8,2)` (−3.4364… frente a −3.44), así que
**toda** lectura abierta parecía cambiada y cada guardado de visita reescribía
el lugar entero. No corrompía valores —reescribía los mismos—, y por eso
ningún test ni ninguna pantalla lo delató: salió al simular el script de
resincronización sobre un lugar recién sembrado, que contó 31 lecturas «a
reescribir» sin nada que cambiar. Ahora se compara con tolerancia de media
centésima.

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

> Nota de la Fase 7: esos azimuts 0/90/180/270 corresponden a la convención
> anterior (`+180 − a`). Con la convención del instrumento, el mismo rectángulo
> da 0/270/180/90 — es el polígono espejo, y cierra igual. El registro se deja
> como quedó porque documenta una reparación histórica en producción.

El script queda en el repositorio porque sigue siendo la herramienta correcta
si vuelve a aparecer un proceso con resultados sin persistir. Corre en modo
simulación por defecto; escribe solo con `--aplicar`.

**Cerrado — el informe incluye la gráfica de asentamientos.**
`components/reports/settlement-plot.tsx` dibuja la serie temporal en SVG
estático, renderizado en el servidor. No reutiliza la gráfica del panel (desde
la Fase 18, `charts/points-scatter.tsx`) porque aquella es un Client Component
con selección de puntos por chips, un estado que un documento impreso no puede
tener; lo que **sí** comparte es todo
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
nombre, cliente, ubicación, datum y proyección. Un `.xlsx` viaja suelto —se
adjunta a un correo y se abre meses después—, y sin datum una coordenada como
«N=1000.000» no identifica su sistema de referencia. El helper es
`projectPairs` en `lib/export/workbook.ts`, y el parámetro es opcional: sin
proyecto, la sección simplemente no se escribe.
> Nota de la Fase 8: `projectPairs` perdió las filas «Orden de precisión» y
> «Equipo» — esos dos datos ya no viven en el proyecto. Cada hoja «Resumen»
> gana en cambio su propia sección «Equipo: estación total» / «Equipo: nivel»
> con el orden y el equipo **del proceso** (de la visita más reciente en
> asentamientos). Ver § 4, «Precisión y equipo, por proceso».

**Cerrado — las capturas del manual ya no llevan el indicador «1 Issue» de
Next.** En desarrollo, React usa `eval()` para reconstruir pilas de llamadas y
la CSP no incluye `'unsafe-eval'`, así que Next muestra un indicador rojo
sobre la página. Desde la Fase 18, `capturas.mjs` oculta `nextjs-portal` antes
de cada captura y todas se regeneraron sin él. La CSP no se relajó: abriría
`eval` en desarrollo solo por una captura.

**La C0 de un punto vigente sigue siendo editable aunque tenga lecturas
cerradas (Fase 11, fuera de alcance).** El acumulado se recalcula en vivo
contra la C0, así que corregirla reescribe el histórico que el panel, el
informe y el Excel muestran para visitas ya cerradas —las persistidas no
cambian, pero dejan de coincidir con la pantalla—. La Fase 11 lo cerró solo
para los puntos **de baja**, que ya no se editan. Para los vigentes, la regla
natural es bloquear la C0 en cuanto el punto tenga una lectura cerrada; queda
registrada aquí.

**El margen del aviso de lectura fuera de tendencia es fijo por orden (Fase
12, decisión deliberada).** Sale de un circuito de referencia de 250 m
(`TREND_DEVIATION_REFERENCE_KM`), razonable para un edificio y posiblemente
corto para una presa. Si un usuario lo pide, el paso natural es hacerlo un
umbral editable del lugar, junto a los de velocidad y acumulado, lo que exige
migración y resincronización.

**Tres componentes del sistema de diseño conocen el dominio.** La § 8 dice que
un componente del sistema de diseño no importa nada de `@/types/*` ni de
`@/lib/*` salvo `cn`, y lo presenta como «criterio verificable leyendo los
imports». Verificado al cerrar la Fase 13: `status-indicator.tsx` importa
`AlertLevel`, y `precision-order-select.tsx` y `equipment-fields.tsx` importan
tolerancias y tipos del proyecto. `AngleInput`, que iba a ser el cuarto, se
movió a la poligonal. O se mueven los tres, o se matiza la regla para admitir
componentes de formulario del dominio; lo que no puede seguir es la regla
afirmando algo que el código contradice.

**El campo de distancia de la tabla de estaciones no tiene nombre accesible en
escritorio.** En la vista de tarjetas (móvil) lleva `aria-label="Distancia
(m)"`; en la tabla de escritorio, ninguno, y un lector de pantalla lo anuncia
como «campo numérico» sin más. Se vio al verificar la Fase 13 con Playwright,
que no pudo localizarlo por su etiqueta.

**CSP sin nonce (`'unsafe-inline'` en scripts y estilos).** La política que
sirve la app permite código en línea porque Next lo inyecta y la app usa
`style={{…}}`. Endurecerla con un nonce por petición exigiría generarlo en
`src/proxy.ts`, propagarlo por el árbol y volver dinámicas rutas hoy estáticas.
No se hizo porque hoy no hay superficie que lo justifique: **cero**
`dangerouslySetInnerHTML` en `src/`. Si algún día se renderiza HTML de
terceros, esto pasa a ser prioritario. Ver § 5 de `docs/auditoria-seguridad.md`.

**Cerrado — el árbol de dependencias no arrastra vulnerabilidades.** La
auditoría dejó cinco avisos de `npm audit`; los cinco están cerrados sin perder
nada. Cuatro (`uuid`, `tmp`, `ws`, `brace-expansion`) se resolvieron con
`overrides` en `package.json`, que fuerza la versión parcheada de una
dependencia transitiva sin tocar a su padre. Es el mecanismo correcto cuando el
paquete intermedio va por detrás: `exceljs@4.4.0` es la última publicada
(diciembre de 2024) y pide `uuid@8`, pero solo llama a `v4()` sin búfer, así
que `uuid@11` le sirve igual.

El «arreglo» que proponía `npm audit` para `exceljs` era bajar a la rama 3.x
—publicada en **2014**, sin `writeBuffer()`—, que habría obligado a reescribir
las tres rutas de exportación a cambio de nada. No se hizo: el override da el
mismo resultado sin tocar código. Verificado descargando un `.xlsx` real por
HTTP con sesión de navegador (12 KB, tres hojas, catálogo y cotas correctos).

`npm audit` queda en **0 vulnerabilidades**, producción y desarrollo. Si un
override deja de hacer falta porque el padre se actualiza, se puede quitar y
comprobar con `npm audit` que sigue en cero.

**No hay catálogo de equipos reutilizable entre procesos (Fase 8, diferido a
propósito).** Cada poligonal, cada nivelación y cada visita de asentamiento
recaptura marca, modelo, serie, fecha de calibración y precisión del
instrumento, aunque sea el mismo aparato físico que el proceso anterior. Se
evaluó una tabla `equipment` referenciada por id y se descartó
(`docs/prds/07-precision-equipo-por-proceso.md`, decisión #2): reabriría el
agujero de trazabilidad que motivó la fase, porque editar la fila de catálogo
cambiaría en silencio el equipo de los informes de procesos ya cerrados. Si
reteclear el mismo equipo en cada proceso se vuelve molesto en el uso real, se
reabre como mejora — con el congelado resuelto, no solo con menos tecleo.

**El formulario de proyecto quedó más corto (Fase 8).** Al perder los siete
campos de equipo y precisión, el paso 2 del asistente pasó de «Equipo y
precisión» a «Datum y proyección» — dos campos únicamente. Se decidió no
fusionarlo con el paso 1 porque el sistema de referencia es una agrupación
coherente por sí misma y fusionar habría obligado a rehacer la validación
nativa por paso. Queda pendiente de una revisión visual (no hecha desde este
cierre documental, que no levantó la app) para confirmar que el paso corto
sigue teniendo sentido en pantalla y no se lee como un `fieldset` vacío.

**La portada del informe emitido sigue leyendo el proyecto en vivo, y
`reports` no tiene trigger de inmutabilidad.** El pie del informe imprimible
afirma que el contenido procede de procesos cerrados, cuyas mediciones y
veredicto son inmutables, y desde la Fase 8 eso es cierto para el equipo, la
precisión y las medidas de cada proceso. Desde la Fase 15 la **posición** de
una poligonal cerrada puede cambiar al georreferenciarla —decisión del
usuario, con nota en el informe—, y por eso el pie ya no dice «inmutables» a
secas. No es cierto para el resto de lo que sale impreso:

- El bloque de portada lee `project.name`, `client`, `location`, `datum` y
  `projection` de una fila de `projects`, que no tiene ningún trigger que la
  congele. Editar el proyecto reescribe la portada de todos los informes ya
  emitidos.
- `reports` tampoco lo tiene: `title`, `observations` e `included_processes`
  siguen siendo modificables después de emitir el informe, así que un informe
  puede cambiar de título, de observaciones y hasta de procesos incluidos sin
  dejar rastro.

Es el mismo agujero de trazabilidad que motivó la Fase 8, en la parte del
informe que la fase no tocó: preexistente y fuera de su alcance
(`docs/prds/07-precision-equipo-por-proceso.md`, anti-alcance: «snapshot del
equipo en `reports`»). Las dos salidas razonables —congelar `reports` con un
trigger al emitir, o guardar en la fila un snapshot de la portada— son
candidatas a una fase posterior, no un parche suelto: hay que decidir antes si
un informe emitido se puede reeditar o solo reemitir.

**La banda de σ₀ es una decisión, no una prueba (Fase 14).** `SIGMA0_BAND =
[0.5, 2]` solo cambia el texto que acompaña a σ₀. Con 2 o 3 condiciones σ₀
fluctúa mucho aunque los pesos sean los correctos, así que la banda es ancha;
la prueba χ² con sus grados de libertad sería lo riguroso y quedó fuera de
alcance. Si algún día σ₀ decide algo, hay que cambiarla por la prueba.

**Mínimos cuadrados en una abierta sin control (Fase 14).** El selector no lo
ofrece ahí, pero un proceso con el método al que después se le cambia el tipo
a sin control lo conserva: el panel muestra entonces el selector para elegir
otro, y el guardado lo rechaza con un mensaje hasta que se cambie. No se
reescribe el método en silencio porque sería perder los pesos.

**La georreferenciación no es atómica (Fase 15).** La acción escribe la
cabecera y después cada estación con su propio `UPDATE`: PostgREST no da una
transacción que abarque varias peticiones, y una función de base se descartó
al simplificar la fase. Si falla a medias, la cabecera queda en el sistema
nuevo y alguna estación en el anterior. Se arregla georreferenciando otra
vez: el plan parte de la cabecera, ya transformada, y reescribe todas las
estaciones.

**Sin historial de georreferenciaciones (Fase 15).** Se guarda solo la última
—fecha, puntos, rotación, factor—, no las coordenadas locales. Volver al
sistema local es georreferenciar con las coordenadas anteriores, que hay que
conocer. Decisión del usuario: el producto no busca aún trazabilidad estricta
de la posición.

**El lector `.L` se probó con un solo archivo (Fase 16).** Los offsets son
los de un único crudo de un nivel Leica. Otro modelo, u otro modo de
grabación, puede usar otras columnas; el lector comprueba la forma de cada
línea y avisa, y la previsualización deja ver lo leído antes de aceptarlo,
pero no hay un segundo archivo contra el que probarlo.

**Cotas de vuelta guardadas antes de la Fase 16 (abiertas con vuelta).** El
arreglo del motor cambia las cotas de la vuelta de una nivelación abierta,
pero las filas ya guardadas conservan las viejas hasta el siguiente guardado:
el editor muestra las nuevas y el Excel, que lee lo guardado, las viejas. Una
abierta con vuelta cerrada antes de la fase las conserva para siempre. En la
base local no había ninguna; la nube no se revisó.

> **Cerrado sin datos afectados (revisado en la Fase 19).** La nube se vació en
> la Fase 18 y todo lo que hay se calculó con el motor posterior a la Fase 16.

**El acumulado del motor se suma en coma flotante (Fase 19).** En un empate
exacto al metro —164.5 m en la ida de El Verjón— el motor llega a
164.49999999999997 y la columna `decimal(8,3)` guarda 0.164, mientras que la
suma decimal de la migración de la Fase 19 guarda 0.165. Solo afecta a «Dist
acum», que es informativa: la corrección se calcula con el valor sin
redondear y coincide. Sumar en milímetros enteros lo resolvería; no se hizo
por acotado.

**Se pierden la σ del instrumento y las repeticiones (Fase 16).** La libreta
guarda una lectura por visual, así que el import promedia. Llevar a
nivelación el modelo de lecturas múltiples de la Fase 7 sería una fase
propia.

**«Abierta sin control» con vuelta se lee raro (Fase 16).** Es la etiqueta de
`open`, y el crudo leído como ida y vuelta queda así aunque sí tenga un
control: la discrepancia entre los dos recorridos. Cambiar la etiqueta toca
el manual y el informe; quedó fuera de la fase.

**Dos diálogos para mover una poligonal (Fase 15).** «Asignar coordenadas
reales» (arranque + azimut, solo sin cerrar, sin anotación) y «Georreferenciar»
(dos estaciones, cualquier estado, anotado) resuelven casi lo mismo. Unificarlos
quedó fuera de alcance.

**Los pesos no pueden guardarse fuera del rango ni de la escala de sus
columnas.** El validador rechaza σ angular fuera de 0.01″–9999.99″ o con más
de dos decimales, y σ de distancia fuera de 0.0001–9999.9999 m o con más de
cuatro: la base los guardaría redondeados y el ajuste recalculado al reabrir
no coincidiría con las coordenadas guardadas. Valida los pesos presentes con
cualquier método, porque se guardan igual; el editor descarta los inválidos
cuando el método es otro y sus campos no se ven. Un σ de distancia de 0.05 mm,
que alguien con un distanciómetro muy bueno podría querer, no cabe: habría
que ampliar la escala de la columna.

---

**La gráfica del informe impreso sigue con la visita en el eje X (Fase 18,
diferido).** El panel y la vista pasaron al tiempo real (`timeScale`), pero
`components/reports/settlement-plot.tsx` espacia las visitas de forma
uniforme: con visitas irregulares exagera la pendiente de los intervalos
largos. Tampoco lleva el amarre ni el cierre de la libreta. La decisión 13 del
PRD de la fase dejó el informe fuera; alinearlo es cambiar la escala X por
`timeScale` y añadir las dos columnas a la tabla de visitas del informe.

**El guardado de una visita con libreta no es atómico (Fase 18).**
`saveVisitAction` escribe la cabecera, la libreta, su purga y las lecturas en
peticiones separadas. Si falla una intermedia, la visita queda con la libreta
nueva y las lecturas viejas hasta el siguiente guardado, que lo repara. Es el
mismo patrón aceptado en el resto del módulo (upsert y purga, nunca borrado y
reinserción); la salida limpia es una función de Postgres que haga todo en una
transacción.

**Dos formatos de número en la misma pantalla (Fase 18).** Las gráficas
nuevas formatean con `es-CO` (coma decimal y signo menos tipográfico: «−9,3
mm»), mientras las tablas y los KPIs usan `toFixed` (punto y guion: «-9.3»).
Ya había mezcla antes —el semáforo de la última visita usaba coma—; unificar
es decidir un formateador de milímetros y aplicarlo en todo el módulo.

**Las filas vacías de la plantilla muestran cota (Fase 18).** La tabla de
captura, compartida con nivelación, pinta la cota calculada en cada fila, y
una fila sin lecturas hereda la del punto anterior. En la libreta precargada
de una visita eso llena la columna de cotas repetidas antes de medir. Es
cosmético y existe igual en nivelación; se resolvería mostrando «—» en las
filas sin V+ ni V−.

**El promedio mezcla líneas base cuando hay altas (Fase 18, aceptado).** El
KPI «Promedio» y la línea de tendencia promedian los acumulados de la visita;
un punto dado de alta a mitad del monitoreo parte de 0 y tira del promedio
hacia arriba. El PRD de la fase lo acepta y lo dice; separar la serie por
cohortes de puntos sería el siguiente paso si molesta.

**Un `Modal` abierto sobre un `Drawer` se cierra con el mismo Esc (Fase
18).** Los dos escuchan Escape en el documento. Hoy ninguna pantalla abre uno
sobre otro; si pasa, `Modal` debe dejar de propagar el evento.

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

**`loading="lazy"` en todas menos la primera.** Las diecinueve capturas suman
5,7 MB; sin esto la página las descargaría de golpe.

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

**Estado actual (2026-09-24):** la nube tiene aplicadas las **diecinueve**
migraciones, hasta `20260926000000_libreta_visita` (Fase 18). Verificado contra
la base con `migration list --linked` y consultas al esquema: columnas de las
fases 8 a 18 presentes, RLS y los dos triggers de inmutabilidad en
`settlement_book_readings`.

**Cómo llegó ahí.** La nube se había quedado en la migración del 2026-08-26
mientras `main` desplegaba el código de las fases 7 a 17: **el despliegue de
Vercel no aplica migraciones**, y nadie las empujó. Al aplicarlas afloraron dos
cosas que `db reset` nunca muestra, porque aplica las migraciones sobre una
base vacía:

- la de la Fase 7 hacía un `UPDATE` sobre procesos **cerrados** y el trigger
  de inmutabilidad lo rechazó; se corrigió desactivándolo solo alrededor del
  `UPDATE`, como ya hacían los backfills de las fases 8 y 9;
- la de la Fase 8 se detuvo, como está diseñada, ante tres proyectos con
  `linear_precision = '10+100'` (sin `ppm`).

Como los datos de producción no importaban, se vaciaron los de trabajo
(`TRUNCATE public.projects CASCADE`, que no dispara triggers de fila) y se
dejó `profiles.demo_seeded_at` en nulo para que el dashboard recree el
proyecto demo. La cuenta del usuario se conservó.

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
