# Documentación técnica — TopoField

Documento de referencia para desarrollar y mantener TopoField. Describe cómo
está construido el sistema, qué decisiones lo gobiernan y dónde tocar para
extenderlo.

**Última actualización:** 2026-10-09 · Fase 43 cerrada; fases 38 a 42 en
producción, con la migración de la 38 aplicada (§ 13) · 1229 tests y 137 pruebas de base (pgTAP) ·
[topofield-app.vercel.app](https://topofield-app.vercel.app).

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
| Framework | Next.js 16.3.8 (App Router) |
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
| 20 | Identidad visual del prototipo y coma decimal | cerrada |
| 21 | La demo con las carteras reales | cerrada |
| 22 | El proceso en una pantalla | cerrada |
| 23 | Integridad | cerrada |
| 24 | Pulido | cerrada |
| 25 | Catálogo de equipos | cerrada |
| 26 | Correcciones del cálculo | cerrada |
| 27 | Segundo pulido | cerrada |
| 28 | Ida y vuelta en la compensación | cerrada |
| 29 | Puntos de control sin posición | cerrada |
| 30 | Estabilidad de los BMs | cerrada |
| 31 | Avisos del cálculo | cerrada |
| 32 | Rigor estadístico | cerrada |
| 33 | Header compacto | cerrada |
| 34 | Reabrir procesos | cerrada |
| 35 | La poligonal como la mide el topógrafo | cerrada |
| 36 | La nivelación como la mide el topógrafo | cerrada |
| 37 | Los asentamientos como los mide el topógrafo | cerrada |
| 38 | El informe de cada proceso | cerrada |
| 39 | Mínimos cuadrados: requisitos y precisión de cada punto | cerrada |
| 40 | Informes entregables | cerrada |
| 41 | El dibujo de la poligonal como un mapa | cerrada |
| 42 | El manual por capítulos | cerrada |
| 43 | Las correcciones del recorrido | cerrada |

Las fases 7 en adelante no estaban en el § 9 del PRD: nacen del contraste del
motor contra carteras de campo reales (`docs/carteras/`). Las 35 a 37 llevaron
los tres módulos a la misma pantalla por pasos, con altas y capturas en popups,
y les quitaron el cierre: desde la 37 ningún proceso se cierra, y la visita de
asentamientos se mide por armadas, sin compensar, desde los BM de su lugar. La
38 dejó un solo informe por proceso, en su página, con el PDF del navegador y
un Excel de fórmulas vivas con la forma de las carteras, y quitó los informes
consolidados. La 39 dio a mínimos cuadrados la precisión de cada punto
(elipses de error al 95 %). La 40 hizo del informe un entregable: sin la marca
de la app, con pie y paginación propios, y solo con las fórmulas del ajuste. La
41 hizo del dibujo de la poligonal un visor que se mueve como un mapa.

---

## 2. Puesta en marcha

```bash
npm install
npx supabase start   # levanta PostgreSQL local
npm run seed         # datos de ejemplo (lee .env.local)
npm run dev
```

Credenciales de los datos de ejemplo: `topofieldsarf@gmail.com` / `seed1234`.
Es la misma cuenta que se usa en producción, con una contraseña **solo local**;
la de producción no está en el repositorio. Los recorridos del manual no la
usan: tienen su propia cuenta, `manual@topofield.local` (§ 12).

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
| `npx supabase test db` | Pruebas de la base con pgTAP (`supabase/tests/`), sobre la base local (Fase 23) |
| `npm run seed` | Siembra los datos de ejemplo (`tsx --env-file=.env.local scripts/seed.mjs`) |
| `npx supabase db reset` | Recrea la base y reaplica migraciones |
| `npx supabase gen types typescript --local > src/types/database.ts` | Regenera tipos |
| `npx tsx --env-file=.env.local scripts/resincronizar-asentamientos.mjs` | Recalcula todas las visitas de cada lugar con el motor de la Fase 37 —por tramos, desde los BM del lugar y sin compensar— y las guarda con `save_visit` (`recomputeSite`). Simula por defecto, contando las visitas y las lecturas cuya cota cambia; escribe con `--aplicar`. Es el paso 2 del despliegue de la Fase 37 (§ 13); hasta entonces reescribía solo las lecturas de las visitas abiertas (Fase 11) |
| `npx tsx --env-file=.env.local scripts/agregar-cartera-demo.mjs` | Agrega el lugar de la cartera real de asentamientos a cada «Proyecto de ejemplo» que no lo tenga, con `insertarCartera` (Fase 37). Simula por defecto; escribe con `--aplicar` |
| `npx tsx --env-file=.env.local scripts/reparar-resultados-estacion.mjs` | Detecta procesos cuyas estaciones no tienen resultados persistidos y los recalcula. Simula por defecto; escribe con `--aplicar`. (La rama que saltaba los cerrados y rechazados ya no se ejecuta: desde las Fases 35 y 36 no hay esos estados) |

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
(`projects_user_id_fkey` no es en cascada; hasta la Fase 37, además, lo
cerrado era inmutable). Secuencia correcta: `npx supabase db reset` y luego
`npm run seed`.

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
│   │   ├── manual/          portada y [capitulo]/ del manual, leídos de docs/manual/ (§ 12)
│   │   ├── equipos/         catálogo de equipos del usuario (Fase 25)
│   │   ├── projects/new/    alta de proyecto
│   │   └── projects/[id]/
│   │       ├── polygonal/[pid]/         pasos Datos · Ajuste · Informe (Fase 35) y export/ (Excel, Fase 38); el alta es un popup del hub
│   │       ├── leveling/[pid]/          pasos Libreta · Compensación · Informe (Fase 36) y export/ (Excel, Fase 38); el alta es un popup del hub
│   │       ├── sites/                   acciones del lugar y de sus puntos; [siteId] redirige a la pestaña Puntos (el alta es un popup, Fase 37)
│   │       └── settlement/[siteId]/     pestañas Panel · Puntos · BMs · Informe (Fase 37); export/ (Excel, Fase 38); visits/[visitId]/ con los pasos Libreta · Resultados
│   ├── auth/callback/       confirmación de correo (Supabase Auth)
│   ├── design-system/       galería del sistema de diseño (404 en producción)
│   ├── layout.tsx           layout raíz, carga de fuentes
│   ├── globals.css          tokens de tema y capas base
│   └── icon.svg             favicon
├── components/
│   ├── auth/                formulario de registro
│   ├── design-system/       componentes propios reutilizables
│   ├── process/             cabecera, pasos y borrador comunes (Fases 35 a 37) y el informe de un proceso (Fase 22)
│   ├── equipment/           catálogo de equipos: página, selector de los formularios y su contexto (Fase 25)
│   ├── navigation/          barra superior y menú de cuenta (Fase 33); la guarda de cambios sin guardar (Fase 22) salió en la 37
│   ├── polygonal/           pantalla por pasos de la poligonal: alta, amarre y mediciones en popups, ajuste (Fase 35)
│   ├── leveling/            pantalla por pasos de la nivelación: alta, BM y armadas en popups, perfil, compensación y su gráfico (Fase 36)
│   ├── settlement/          lugar (alta en popup, panel, BM) y visita por pasos: armadas en popups, resultados, gráficas (Fase 37)
│   ├── reports/             las secciones del informe de cada proceso, «Exportar PDF» (`print-button.tsx`), la gráfica del lugar y las fórmulas en MathML (Fases 35 y 38)
│   └── projects/            dashboard, hub y gestión de proyectos
├── lib/
│   ├── calculations/        algoritmos puros
│   ├── validators/          reglas de validación
│   ├── demo/                proyecto de ejemplo y carteras reales (Fase 21)
│   ├── design/              escalas de gráfica, marcadores y contraste
│   ├── export/              libros de Excel de los tres módulos con fórmulas vivas (Fase 38): `cells.ts`, las primitivas de celda; `formula-check.ts`, solo para pruebas
│   ├── import/leveling/     lectores de libretas de nivel digital (Fase 16)
│   ├── import/benchmarks.ts BM del lugar desde una nivelación o un CSV (Fase 37)
│   ├── reports/             carga de secciones, resumen de precisión, portada viva y datos del informe de nivelación y del lugar
│   ├── errors/              errores de la base traducidos para el usuario (Fase 22)
│   ├── auth/                mensajes de error de autenticación
│   ├── theme.ts, theme-server.ts   tema claro y oscuro por cookie (Fase 20)
│   ├── equipment.ts         del catálogo de equipos a los campos de los formularios (Fase 25)
│   ├── process-list.ts      filtrado y orden del listado del hub (los tres módulos)
│   ├── process-status.ts    tonos de estado de procesos y visitas (el lugar no tiene, Fase 37)
│   ├── supabase/            clientes y consultas
│   └── utils/
├── types/                   tipos, incluido database.ts generado
└── proxy.ts                 protección de rutas
```

Fuera de `src/`: `docs/manual/` (el manual, un Markdown por capítulo, y sus
recorridos), `public/manual/` (sus capturas, una carpeta por capítulo), `supabase/migrations/` y `supabase/tests/`
(pruebas pgTAP, Fase 23), y `scripts/` (seed y mantenimiento).

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

Ningún archivo importa el cliente de navegador (`lib/supabase/client.ts`, que
envuelve `createBrowserClient`). Toda escritura atraviesa una Server Action
donde se aplican las guardas de negocio.

### Server Actions

| Archivo | Acciones |
|---|---|
| `(auth)/sign-in/actions.ts` | `signInAction` |
| `(auth)/sign-up/actions.ts` | `signUpAction` |
| `(app)/actions.ts` | `signOutAction` |
| `(app)/projects/new/actions.ts` | `createProjectAction` |
| `(app)/projects/[id]/actions.ts` | `updateProjectAction`, `archiveProjectAction`, `restoreProjectAction`, `deleteProjectAction` (hasta la Fase 37 rechazaba un proyecto con trabajo cerrado), `createReferencePointAction`, `updateReferencePointAction`, `deleteReferencePointAction` |
| `(app)/projects/[id]/polygonal/create-actions.ts` | `createPolygonalProcessAction` (el popup del alta, Fase 35) |
| `(app)/projects/[id]/polygonal/[pid]/actions.ts` | `savePolygonalProcessAction`, `duplicatePolygonalProcessAction`, `renamePolygonalProcessAction`, `deletePolygonalProcessAction`, `setAngleInputFormatAction` (Fase 13), `georeferencePolygonalProcessAction` (Fase 15) |
| `(app)/projects/[id]/leveling/create-actions.ts` | `createLevelingProcessAction` (el popup del alta, Fase 36) |
| `(app)/projects/[id]/leveling/[pid]/actions.ts` | `saveLevelingProcessAction` (detecta el orden y guarda la libreta a medias, Fase 36), `duplicateLevelingProcessAction`, `renameLevelingProcessAction`, `deleteLevelingProcessAction` (Fase 22) |
| `(app)/projects/[id]/sites/actions.ts` | `createSiteAction` y `saveSiteAction` (el popup del lugar, Fase 37), `renameSiteAction`, `duplicateSiteAction` (copia también sus BM, Fase 37), `deleteSiteAction` (Fase 22); `closeSiteAction` salió en la Fase 37 |
| `(app)/projects/[id]/settlement/[siteId]/actions.ts` | `createVisitAction` (el popup: fecha, nivelador, nota y equipo, con la libreta de la plantilla, Fase 37), `saveVisitAction` (la libreta entera, lectura por lectura: ver § 4), `deleteVisitAction` (cualquier visita, y recalcula el lugar, Fase 37); `closeVisitAction` salió en la Fase 37 |
| `(app)/projects/[id]/settlement/[siteId]/benchmark-actions.ts` | Los BM del lugar (Fase 37): `saveBenchmarkAction` (agrega o edita; si cambia la cota o el código, recalcula el lugar), `deleteBenchmarkAction` (solo uno que ninguna visita nombra), `importBenchmarksAction` y `benchmarkImpactAction` (cuántas visitas lo nombran, para el aviso) |
| `(app)/projects/[id]/sites/[siteId]/point-actions.ts` | `createPointAction`, `savePointAction` (la C0 se cambia aunque haya lecturas, Fase 37), `pointImpactAction` (cuántas visitas cambian, Fase 37), `deletePointAction`, `retirePointAction`, `undoRetirementAction` (Fase 11) |
| `(app)/equipos/actions.ts` | `createEquipmentAction`, `updateEquipmentAction`, `deleteEquipmentAction` (Fase 25) |

### Guardados en una transacción (Fase 23)

Los guardados que escriben varias tablas no hacen una petición por paso:
arman la carga y llaman a **una función de Postgres** con `supabase.rpc`, que
hace todos los pasos en una sola transacción. Si falla uno, no queda nada
escrito —ni una cabecera nueva sin estaciones, ni una visita con la fecha
movida y la libreta vieja—.

| Función | La llama | Hace, en orden |
|---|---|---|
| `save_polygonal_process` | `savePolygonalProcessAction` | los puntos del amarre en el catálogo (`p_catalog`: `insert` con el id que da la acción o `update` por id, solo en el proyecto del proceso; desde las correcciones de la Fase 35); cabecera; borra las estaciones e inserta las nuevas, cada una con sus lecturas de ángulo anidadas |
| `save_leveling_process` | `saveLevelingProcessAction` | cabecera; reemplaza las lecturas de ida y vuelta |
| `save_visit` | `saveVisitAction`; desde la Fase 37 también `createVisitAction` (la plantilla) y `recomputeSite` (una visita por llamada) | purga de las lecturas quitadas, cabecera, libreta (upsert y purga, con `starts_section` desde la Fase 37) y lecturas, y propagación a las demás visitas del lugar —el orden que imponen los triggers de vigencia—; hasta la Fase 37, solo a las abiertas |
| `georeference_polygonal` | `georeferencePolygonalProcessAction` | columnas de posición de la cabecera y de cada estación, por su id |

Reglas (`20260930010000_guardados_atomicos.sql`):

- **Solo escriben.** Validar, calcular con el motor y armar la carga sigue en
  la Server Action: el motor es TypeScript y tiene los tests.
- **`SECURITY INVOKER`**: corren como el usuario, con su RLS y los triggers
  de vigencia —y los de inmutabilidad, mientras los hubo (hasta las Fases 35
  a 37)—. Otro usuario recibe «no encontrado» (`P0002`).
  Solo `authenticated` tiene `EXECUTE`: Supabase se lo da a `anon` por defecto.
- **Columnas explícitas**, sin SQL dinámico. La cabecera se rellena sobre la
  fila actual con `jsonb_populate_record(fila, carga)`: una clave ausente
  conserva su valor, como el `update` de supabase-js, y una de más no escribe
  nada.
- Los id de las estaciones los genera la base, y las lecturas de ángulo viajan
  dentro de su estación: no pueden colgar de otra.

Las prueba `supabase/tests/guardados_atomicos.test.sql` (§ 9) con cargas que
fallan a mitad: la cabecera y las filas de antes no cambian.

### Informes y exportación (§ 4.7 y § 4.8 del PRD)

Son las dos salidas del producto, y **desde la Fase 38 salen de un solo
lugar: la página de informe de cada proceso** —el paso Informe de la
poligonal y de la nivelación, la pestaña Informe del lugar de asentamientos—.
Allí, y solo allí, la cabecera (`ProcessHeader` con `printable`) muestra
**Exportar PDF** y **Exportar Excel**; los demás pasos no exportan. La visita
no tiene informe propio: sus resultados van en el del lugar. El hub no tiene
atajo al informe: se llega entrando al proceso.

**El informe no se guarda: se reconstruye.** Es función de los datos del
proceso (`components/process/process-report.tsx`): cada vez que se abre los
vuelve a leer y compone el documento —portada, «Datos y resultados», resumen
de precisión y observaciones (las notas del proceso)—.
**Desde la Fase 37 nada se cierra**: la poligonal (Fase 35), la nivelación
(Fase 36) y el lugar de asentamientos se informan calculados en vivo, cumplan
o no un orden (el orden detectado; en la poligonal, también el tipo de
ángulo), con una alerta si no alcanzan ninguno (decisión del usuario: «no
necesita advertir que se reconstruye»); el lugar, con las visitas calculadas
que tenga entonces. Ninguno lleva marca ni registro de cierre: todos dicen
«Fecha del informe». La portada es la del proyecto, en vivo (`coverOf` en
`lib/reports/cover.ts`). Si la poligonal se georreferencia, el informe
muestra las coordenadas nuevas con una nota de fecha y puntos (Fase 15,
decisión del usuario).

**Un entregable, sin rastro de la app (Fase 40).** El informe —y su PDF y su
Excel— no nombra TopoField ni habla de sus pantallas: la portada dice
«Informe técnico»; no hay pie «generado desde»; un proceso sin terminar se
informa como tal («Nivelación incompleta», «Poligonal incompleta», «La visita
N (fecha) no se incluye»), y `libretaBlocker(result, "report")` da el error de
la libreta sin dirigirse al usuario. En el PDF:

- **El pie propio** son las cajas de margen de `@page` (Chrome 131+), en la
  hoja de impresión de `globals.css`: «Página X de Y» a la derecha y, a la
  izquierda, «proyecto · proceso», que cada informe inyecta en un `<style>`
  con `pageFooterCss` (`lib/reports/page-footer.ts`, que escapa la cadena
  CSS y no deja cerrar el `<style>`).
- **Chrome imprime su encabezado y su pie** (URL, título, fecha) aun con cajas
  de margen; no los imprime en ninguna página si la primera no tiene sitio
  para ellos. Por eso `@page :first` va sin margen arriba ni abajo, y la
  portada —sola en la primera página— lleva el suyo como relleno. La portada
  no lleva pie.
- **El título del PDF** y el nombre que el navegador propone al archivo son
  «proceso — proyecto»: `PrintButton` cambia `document.title` mientras
  imprime y lo devuelve en `afterprint`.

El Excel dice solo «Exportado · fecha» en la cabecera de cada hoja y no lleva
autor en sus metadatos.

**Sin informes consolidados (Fase 38, decisión 3).** Hasta entonces convivían
con el informe de cada proceso los **consolidados**: una pestaña Informes en
el hub, una página para elegir procesos (`reports/new`, con la elegibilidad
de `lib/reports/eligibility.ts`, aplicada al pintar y otra vez en
`createReportAction`), otra imprimible (`reports/[reportId]/print`), la tabla
`reports` con la portada congelada al emitir (Fase 23) y, al pie de cada
informe de proceso, un bloque para generar uno o ver en cuáles estaba
(`lib/reports/including.ts`). Salieron con todos sus restos: las rutas, los
componentes `report-form.tsx` y `delete-report-button.tsx`, las consultas
`getReports`, `getReport` y `getReportableWork`, los avisos de «está en
informes» al eliminar un proceso, los estilos `.report-index`,
`.report-actions`, `.report-draft` y `.report-rejected`, el tipo `Report`, los
informes de la demo y del seed, y la tabla con su trigger (§ 4, § 5 y § 13).
`?tab=reports` en el hub abre Procesos. `CandidateKind` —el tipo de proceso
de una sección— pasó a `src/types/report.ts`, y `ReportCover` ya no recibe una
portada guardada.

El informe se arma con las piezas que compartía con el consolidado: la carga
de datos por tipo (`lib/reports/sections.ts`), el resumen de precisión
(`lib/reports/summary.ts`) y los componentes de `components/reports/sections/`
(portada, sección por tipo y resumen). El registro de cierre (`ClosureRecord`,
`closureOf`) con su «Responsable» (`lib/reports/responsible.ts`, que daba
también el «Cerrado por» del Excel) y la marca de estado (`ReportStateMark`,
`processReportState`) salieron en la Fase 37.

**La sección de la poligonal (Fase 35)** sigue la maqueta aprobada: 1.
Resultado (cifras, orden alcanzado y por qué, o la alerta), 2. Datos de campo
(amarre, mediciones «desde → hacia» con `captureRows`, cierre angular), 3.
«Corrección por método …» (`polygonal-correction.tsx`, con
`correctionBreakdown` y el ajuste por mínimos cuadrados), 4. Poligonal ajustada
(`adjustedRows`) y 5. Coordenadas y dibujo. Las fórmulas son **MathML nativo**
(`components/reports/math.tsx`, decisión 16): el navegador las compone en
pantalla y en el PDF, sin librerías. Desde la Fase 40 el informe solo lleva
las del ajuste —la del método (Brújula, Tránsito, Crandall o mínimos
cuadrados) y la de la elipse de error—; el reparto angular se dice en el
texto con su valor por ángulo. Cada una lleva su leyenda «donde:» (Fase 41,
`legend` de `Formula`): sus símbolos, como texto, en la misma línea gris; `src/types/mathml.d.ts` declara los
elementos, que `@types/react` 19 aún no trae. Una letra griega sola va con
`mathvariant="normal"`: Chrome la pasaría a la cursiva matemática (U+1D6FC…),
que muchas fuentes no tienen.
**La sección de la nivelación (Fase 36)** es el informe sencillo del lienzo,
por tipo: un resumen con el orden alcanzado y por qué no el de arriba
(`levelingOrderChecks`), 1. Datos iniciales (la ida y la vuelta), 2. Datos
ajustados con el método en una frase y la cota ajustada —con vuelta, junto a
la de la ida y la de la vuelta; sin vuelta y con puntos repetidos, junto a sus
dos lecturas; si no, con la cota medida y su corrección— y 3. el gráfico de la
compensación (`comparison-chart.tsx`). Los datos salen de
`lib/reports/leveling-data.ts`, que arma la entrada con `levelingDraftOf` e
`levelingInputOf`, como la pantalla, y calcula con `computeLevelingDetected`:
el informe ya no lee las cifras de cierre guardadas.
**La sección del lugar (Fase 37, decisión 21)** es el informe sencillo del
lienzo (`settlement-section.tsx`): el veredicto sobre la última visita —la
peor alerta y lo que le falta al mayor acumulado para el umbral siguiente— y
si las visitas se verifican; «Cómo se calcula», en un párrafo y sin fórmulas
desde la Fase 40 (la cota, el acumulado y la velocidad, con el mes de 30.4375
días, y los umbrales); la evolución; la tabla de visitas con la
verificación de cada una —el orden de su tramo peor o «Sin verificación»— y la
primera como base; los puntos de la última visita, las notas de las visitas y
los avisos de tendencia. Los datos salen de un `siteReportOf` puro
(`lib/reports/site-data.ts`), que informa **solo las visitas calculadas** y
nombra aparte las que están en medición: una a medias daría una «última
visita» con la mitad de los puntos.

**El PDF lo produce el navegador.** No hay motor de PDF en el servidor:
«Exportar PDF» (`components/reports/print-button.tsx`) llama a
`window.print()` y el usuario elige «Guardar como PDF». La cabecera, con los
botones, es un `<header>`, y la impresión lo oculta. Se descartó Playwright en
el servidor porque Chromium no cabe en una función serverless de Vercel sin
`@sparticuz/chromium`, un riesgo de despliegue a cambio de ahorrar un clic. Los
estilos del informe (`.report*`) están en `@layer components` de
`globals.css`, no sueltos: una regla fuera de capa gana sobre las utilidades
de Tailwind y las anula en silencio (§ 8). El bloque `@media print` del final
—A4 con `@page`, sin `header`, `nav` ni el pie de la aplicación, y los saltos
de página— va fuera de capa.

**La exportación a Excel es del servidor**, en Route Handlers
(`.../export/route.ts` en los tres módulos, con la URL de siempre) porque
devuelve un binario con `Content-Disposition`. La interfaz solo la enlaza
desde el informe, pero la ruta responde en **cualquier estado** del proceso
—lo pide el § 4.8—, y las celdas sin calcular quedan vacías en lugar de a
cero: en topografía un `0.000` de coordenada es una posición, no una ausencia.
La ruta arma la entrada del motor como la pantalla y calcula: la poligonal con
`computePolygonalDetected`; la nivelación con `computeLevelingDetected` sobre
`levelingInputOf`, sin leer los resultados guardados (así una nivelación
guardada antes de la Fase 36 no sale con su orden declarado); el lugar con
`computeHistory` y los umbrales vigentes, `computeBook` por visita dentro del
libro y `siteReportOf` para los avisos de tendencia. Los libros se construyen
en `lib/export/`, separados del Route Handler para poder testearlos sin
levantar el servidor.

**El Excel tiene fórmulas vivas (Fase 38, decisiones 4 a 9).** Hasta la Fase
37 eran tres hojas de valores —«Datos crudos», «Cálculos» y «Resumen»— que no
se parecían a las carteras ni recalculaban nada. Ahora cada libro tiene la
forma de la cartera de su módulo y se escribe con tres primitivas
(`lib/export/cells.ts`):

- `putData`: un dato medido o tecleado, con el fondo y la tinta de la mira
  (`WORKBOOK_COLORS.miraBg` y `miraInk`, el amarillo de la app). Así se
  distingue a simple vista qué se midió y qué se calcula.
- `putFormula`: una celda calculada lleva **su fórmula y, como resultado
  guardado, el valor del motor**. El libro se ve completo en cualquier visor,
  aunque no recalcule, y `newWorkbook` marca `fullCalcOnLoad` para que Excel
  recalcule al abrir: cambiar un dato propaga a todo lo que depende de él.
- `putLabel`: títulos, secciones, cabeceras y rótulos.

**Las reglas son las del motor, no las de la cartera** (decisión 6): El
Verjón reparte la corrección por igual en cada armada y la app en proporción a
la distancia; las hojas Tránsito y Crandall de la TT4 tienen defectos
conocidos (§ 6). Las tolerancias van en un **bloque de celdas** con los
valores de `tolerances.ts` (`writeLevelingTolerances`,
`writePolygonalTolerances`) y las fórmulas lo referencian, sin números
sueltos. El orden alcanzado es una cadena de `IF` del orden más exigente al
ordinario, con el margen de `withinTolerance`, y el veredicto «CUMPLE / NO
CUMPLE» lleva su color por formato condicional (`verdictFormatting`, con
`success` y `danger`). Donde el motor redondea, la fórmula redondea en el
mismo sitio con `roundHalfUp(expr, n)`, que escribe `INT(x·10ⁿ+0.5)/10ⁿ`: el
`ROUND` de Excel aleja los medios del cero y `Math.round` los sube, así que en
un negativo darían distinto. Lo usan la cota de la comparación de
asentamientos (4 decimales) y su acumulado y su parcial (0.1 mm). Solo se usan
funciones que entienden Excel 2016, LibreOffice y Google Sheets, sin `LET`,
`LAMBDA` ni matrices dinámicas. `setLayout` inmoviliza las cabeceras, fija los
anchos y prepara la hoja en A4 apaisado, ajustada al ancho. Cada hoja abre
con su encabezado (`writeSheetHeader`): el título, los datos del proceso —en
la poligonal y la nivelación, también la ubicación y el responsable del alta—
y al final «Exportado», con la fecha de Bogotá (sin la marca de la app desde
la Fase 40).
Cada «Resumen» lleva el proyecto con su datum (`projectPairs`) y «Cómo leer el
libro».

- **Nivelación** (la forma de El Verjón): hojas «Nivelación» (la ida),
  «Contranivelación» (la vuelta, si la hay), «Cotas ajustadas» y «Resumen».
  Columnas PUNTO · TIPO · V+ · AI · V− · VI · COTA · DIST. V+ · DIST. V− ·
  ACUM. (km) · CORRECCIÓN · COTA AJUSTADA · CLAVE. Con hilos, cada punto ocupa
  **tres filas** (superior, medio e inferior) y la distancia es
  `(superior − inferior) × 100`; sin hilos, una fila con la distancia
  tecleada. `AI = COTA + V+`, `COTA = AI − V−` (o `− VI`), el acumulado como
  `accumulateDistances` —también con la regla de las distancias
  reconstruidas— y `CORRECCIÓN = −E × acumulado / L`, con el circuito en la
  abierta con vuelta. Debajo de cada recorrido, el cierre: distancia, cota
  calculada de llegada, cota conocida y error; en la abierta con vuelta, los
  desniveles, la discrepancia, el cierre del circuito y la distancia del par.
  A la derecha, las tolerancias `K·√km` (por √2 en la discrepancia), el orden
  alcanzado y el veredicto. «Cotas ajustadas» da la cota conocida de los BM y,
  en los demás puntos, el promedio de sus cotas ajustadas con `SUMIF` y
  `COUNTIF` sobre la CLAVE —el código sin espacios: «AUX 1» y «AUX1» son el
  mismo punto—. Sin compensación (la abierta sin vuelta, la libreta a medias)
  no hay columnas de corrección ni «Cotas ajustadas», y el orden dice «Sin
  verificación».
- **Poligonal** (la forma de `poligonales.xlsx`): una hoja con el nombre del
  método —BRÚJULA, TRÁNSITO, CRANDALL, MÍNIMOS CUADRADOS, o ABIERTA SIN
  CONTROL— y «Resumen». Columnas ESTACIÓN · VISADO · ÁNG. HORIZONTAL (o
  DEFLEXIÓN) en G · M · S · DEC · CORR. · ÁNG. CORREGIDO · AZIMUT ·
  DIST. · PROYECCIONES · CORRECCIÓN · PROY. CORREGIDAS · COORDENADAS, con la
  fila SUMATORIA. G, M y S son datos, con los segundos sin redondear a la
  décima (a la millonésima): `DEC = G + M/60 + S/3600` da el ángulo del motor.
  Los bloques van **debajo de la tabla**: el cierre angular (la suma, la
  teórica, el error y la corrección por ángulo), el cierre lineal (errores N y
  E, error lineal, perímetro y precisión 1:X) y, en las columnas H a K, las
  tolerancias con el orden alcanzado. Brújula corrige con `−E·d/P`; Tránsito y
  Crandall usan **columnas auxiliares** por fila, como la propia cartera
  —|N-S| y |E-W|; d·cos², d·cos·sin, d·sin² y δd, con el sistema 2×2 (a₁₁,
  a₁₂, a₂₂, el determinante, λ₁ y λ₂) en su bloque— en vez de `SUMPRODUCT`
  sobre expresiones de rango, que el intérprete de las pruebas y algunos
  visores no evalúan. La abierta con control suma las columnas DIR. (D/I) y
  AZ. SIN CORREGIR y cierra contra el azimut y las coordenadas de llegada; la
  sin control solo encadena. La georreferenciada lleva un bloque con la fecha,
  los puntos, la rotación y la escala como datos —el proceso no guarda la
  traslación—: sus coordenadas ya son las transformadas y la hoja calcula con
  fórmulas desde su partida.
- **Mínimos cuadrados** (decisión 7): las correcciones v de los ángulos y las
  distancias son de la app; los ángulos y las distancias ajustados (`l₀ + v`),
  los azimuts, las proyecciones y las coordenadas van con fórmulas. El cierre
  de **antes** del ajuste —con el que el motor juzga el orden— va como
  valores, y el orden alcanzado es fórmula sobre ellos. Debajo, las matrices
  de la última iteración como valores, con el número de iteraciones y σ₀: l₀,
  A, Q (la diagonal), w, N = A·Q·Aᵀ, k y v. La app itera hasta converger
  (§ 6) y una pasada de matrices en Excel solo reproduce la última
  linealización. Sin pesos, o si no se puede ajustar, la hoja dice por qué.
- **Asentamientos** (la cartera real, ordenada): «Libretas» pone un bloque por
  visita, uno debajo de otro —una visita puede tener varias armadas y puntos
  de cambio, que los bloques lado a lado de la cartera no admiten—, con
  «Visita N · fecha», el nivelador, el equipo y la nota, y las columnas
  PUNTO · V+ · AI · V− · VI · COTA · DIST. V+ · DIST. V−. Tramo por tramo,
  desde la cota de su BM: `AI = COTA + V+` y `COTA = AI − lectura`, sin
  compensar, como la app. **Cada tramo tiene su fila de verificación**: el
  cierre en mm, como fórmula, contra la cota del BM de partida (cerrado) o la
  del de llegada (de enlace); los km, la suma de sus distancias; y el orden,
  contra el bloque de tolerancias. O bien «Sin distancias», «Sin
  verificación» (no termina en un BM del lugar) o «A medias». Una visita de
  cotas tecleadas dice que no tiene libreta. «Comparación» (la «Diferencia
  observada» de la cartera) lleva los umbrales del lugar como datos y un punto
  por fila, con su código, su ubicación y su C0 (la del catálogo, o su primera
  cota); por cada visita, COTA (apunta a su celda de la libreta),
  ACUM. `(COTA − C0)·1000`, PARCIAL contra la última visita en que se midió el
  punto —la celda la elige el exportador, como hace la cartera a mano—,
  VEL. en mm/mes (`DAYS` entre visitas sobre 30.4375) y SEMÁFORO, con `IF`
  contra los umbrales como `classifyAlert` (la primera lectura, solo por el
  acumulado) y su color. Un punto sin lectura en una visita deja sus celdas
  vacías. «Resumen»: el lugar, su descripción como ubicación, el tipo de
  estructura y sus BM.

**Lo que no es fórmula** (criterio h del PRD de la fase): las matrices y el
cierre previo al ajuste de mínimos cuadrados, los parámetros de la
georreferenciación y los avisos de tendencia, que entran ya hechos, con el
texto del informe (`siteReportOf`), en vez de rearmarlos en el libro.

**Cómo se verifica.** `lib/export/formula-check.ts` es **solo para pruebas**:
evalúa cada fórmula de un libro con
[fast-formula-parser](https://www.npmjs.com/package/fast-formula-parser)
(MIT, 1.0.19, `devDependency`; sus tipos en
`src/types/fast-formula-parser.d.ts`), resolviendo referencias a la misma
hoja y a otras, **recursivamente desde los datos crudos**: una fórmula que
apunta a otra la evalúa también, no toma su resultado guardado. El intérprete
no es reentrante —evaluar una fórmula dentro de otra con la misma instancia le
corrompe el estado—, así que usa una instancia por nivel de profundidad, y le
agrega `SUBSTITUTE`, `MIN` y `MAX`, que no trae. `formulaMismatches` lista las
fórmulas cuyo valor difiere del resultado guardado, con tolerancia relativa
de 1e-9 (con 1e-7, una coordenada de 100 000 m admitía 1 cm). Como el
resultado guardado es el valor del motor, que no haya ninguna es que **el
Excel calcula como la app**. `evaluateWorkbook` admite datos cambiados, y así
se prueba que el libro recalcula. Los casos: en nivelación, El Verjón (abierta
con vuelta), el tramo 2 (cerrada), El Verjón sin vuelta y una cerrada con
hilos —la demo no trae hilos—; en poligonal, la TT4 por Brújula, Tránsito y
Crandall, una abierta con control (también con Tránsito y Crandall), una sin
control y la Vivero por mínimos cuadrados (de la georreferenciada se prueba
solo su bloque); en asentamientos, Torre Alameda, la cartera real y un punto
que se salta una visita; y en los tres, un dato cambiado —una V−, una
distancia, una lectura de la libreta— que mueve las cotas o las coordenadas
que dependen de él. El intérprete evalúa **las dos ramas** de un
`IF`, así que las fórmulas evitan `ABS` sobre una celda que puede estar vacía.
La prueba no sustituye abrir el libro en Excel (criterio l): es la
verificación del usuario.

Dos detalles que se rompen fácil:

- Los `DECIMAL` de Postgres llegan como **cadena** vía PostgREST. Hay que
  convertirlos a número antes de escribirlos, o Excel guarda texto y la celda
  no se puede sumar.
- El nombre del archivo se translitera a ASCII: viaja en una cabecera donde los
  acentos y las comillas rompen el parseo de algunos navegadores.

---

## 4. Modelo de datos

Quince tablas en `public` (dieciséis hasta la Fase 38, que borra `reports`):

```
profiles         perfil del usuario (1:1 con auth.users)
equipment        catálogo de equipos del usuario (Fase 25)
projects         proyecto topográfico
├── reference_points      puntos de coordenadas conocidas
├── sites                 lugar de monitoreo (entidad transversal, Fase 5)
│   ├── settlement_points     catálogo de puntos de control
│   ├── site_benchmarks       BM del lugar, copias (Fase 37)
│   └── settlement_visits     visitas sucesivas en el tiempo
│       ├── settlement_readings       lectura por punto en cada visita
│       └── settlement_book_readings  libreta de nivelación de la visita (Fase 18)
├── polygonal_processes   levantamiento poligonal — site_id NOT NULL
│   └── polygonal_stations    estaciones del levantamiento
│       └── polygonal_angle_readings  lecturas de cada ángulo (Fase 7)
└── leveling_processes    levantamiento de nivelación — site_id NOT NULL
    └── leveling_readings     lecturas de la libreta
```

**`equipment` es una plantilla, no una referencia (Fase 25).** Guarda las
estaciones totales y los niveles de cada usuario. Elegir uno («Tomar del
catálogo», en el alta de la nivelación y en la visita) **copia** su marca,
modelo y serie en las columnas `equipment_*` del proceso o de la visita, que
siguen siendo la fuente del informe. La poligonal teclea su equipo, sin
catálogo, desde las correcciones de la Fase 35. Hasta las Fases 35 a 37 se
copiaban también la precisión y la calibración. Ningún proceso referencia
`equipment`, así que corregir o borrar un equipo no cambia nada medido ni
informado —el agujero por el que la Fase 8 descartó una tabla referenciada por
id—. Las escalas de sus columnas
son las de los procesos; un CHECK deja vacíos los campos del otro tipo y un
índice único sobre marca, modelo y serie (sin mayúsculas ni espacios) evita
el mismo aparato dos veces. `lib/equipment.ts` convierte entre la fila y los
campos de los formularios.

**Ningún informe se guarda (Fase 38).** La tabla `reports` guardaba los
informes consolidados: qué procesos incluían y en qué orden
(`included_processes`, JSONB, con el `name` congelado al emitir), su título,
sus observaciones y, desde la Fase 23, la portada congelada en `cover`; un
trigger rechazaba todo `UPDATE` (§ 5). Con los consolidados la borra
`20261010000000_sin_informes_consolidados.sql` —la tabla, su trigger
`reports_reject_update` y su función `reject_update_on_report()`; las
políticas se van con la tabla—, que fue **después** del merge y ya está
aplicada (§ 13). El
informe de cada proceso nunca tuvo fila: se compone en vivo con la portada
del proyecto (`coverOf`, § 3). Del `§3.2` del PRD principal no queda
`reports`.

**`sites` (el lugar) es transversal a los tres módulos**, no propia del
control de asentamientos. `polygonal_processes` y `leveling_processes` tienen
`site_id NOT NULL`: todo proceso pertenece a un lugar, aunque sea un lugar de
agrupación. El lugar reemplaza a la tabla
`settlement_systems` del PRD principal `§3.2` — decisión registrada en
`docs/prds/04-asentamientos.md`, decisión #6: guarda nombre, `structure_type`
y los siete umbrales de alerta, así que una tabla aparte para lo mismo sobraba.
**El lugar no tiene estado desde la Fase 37** (decisión 3): su segunda
migración (`20261009000000_asentamientos_sin_cierre.sql`, el paso 3 de su
despliegue, § 13) borra `sites.status`,
`closed_at` y `closed_by`. `sites.notes` sigue en la tabla, aunque el popup
del lugar solo pide la descripción (§ 11).

**`sites.kind` distingue los dos usos del lugar (Fase 22).** `grouping` es el
lugar del que cuelgan poligonales y nivelaciones —el `General` del backfill de
la Fase 5, el «Área principal» que nace con cada proyecto, el «Levantamientos
de campo» de la demo—; `settlement` es un control de asentamientos. La
interfaz no muestra los de agrupación: `getSites`, los conteos y las rutas
del lugar solo ven `settlement` —hasta la Fase 38, también el selector de los
informes consolidados—, y las acciones de lugar,
puntos y visitas rechazan un `grouping` aunque se las llame directamente. Los
procesos nuevos cuelgan del lugar de agrupación más antiguo del proyecto
(`lib/supabase/grouping-site.ts`, que lo crea si falta). La migración
`20260929000000_tipo_de_lugar.sql` clasificó los existentes: agrupación es un
lugar sin puntos ni visitas que algún proceso referencia, o el «Área
principal» original; el relleno desactivó el trigger de inmutabilidad de
`sites` solo alrededor del UPDATE, como las migraciones de las fases 8, 9 y
19.

### Convenciones que gobiernan el esquema

**Los ángulos se almacenan en tres columnas** (`*_deg`, `*_min`, `*_sec`), nunca
como decimal. Desde la Fase 24, un CHECK en `polygonal_angle_readings` exige
grados de 0 a 359, minutos de 0 a 59 y segundos en [0, 60), o 360°00′00″
exacto —el redondeo de 359.99999° en grados decimales—: la lectura cruda se
guardaba tal cual, y 90°00′65″ entraba con 65 segundos. La conversión a decimal ocurre solo dentro del motor de cálculo.
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
| `precision_order` | El orden alcanzado, **detectado** (Fase 35); `null` sin verificación o si no alcanza ni el ordinario |
| `angle_type` | El tipo de ángulo **detectado** (Fase 35): interior o exterior en la cerrada, deflexión en la abierta con control |
| `meets_tolerance` | Si alcanza algún orden; `null` en la abierta sin control o sin datos |

`status` puede ser `draft`, `in_progress` o `calculated` (Fase 35, paso 2):
**la poligonal no se cierra**, y perdió `closed_at` y `closed_by`. Desde la
Fase 36 la nivelación tampoco (abajo), y desde la 37 ni la visita ni el lugar
de asentamientos: ya nada se cierra.

Columnas del alta (Fase 35): `location`, `responsible_name` y
`responsible_role`, que salen en la cabecera, el informe y el Excel. Del
equipo, el alta pide solo marca, modelo y serie; `equipment_calibration_date`
y las precisiones del equipo quedan para los procesos anteriores, y
`angle_readings_min` ya no se lee (§ 11). `has_closing_row` —la cartera cierra
contra el amarre— lo escribe `save_polygonal_process` desde la Fase 35: hasta
entonces solo lo escribía la demo, y al recargar la TT4 se recalculaba con el
esquema equivocado.

`angle_input_format` (`dms` o `decimal`, Fase 13) no es un resultado: recuerda
cómo se **ven y se teclean** los ángulos del proceso —tabla, ajuste, informe y
popups (Fase 35)—. El almacenamiento sigue siendo DMS en tres columnas. Lo
escribe `setAngleInputFormatAction` al conmutar.

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
**no se guardan**: Ajuste, el informe y el Excel las recalculan con la misma
entrada (`draftOf` e `inputOf`). Desde la Fase 35 los pesos viajan con
cualquier método, para no perderlos al volver a mínimos cuadrados.

### `leveling_processes` — sin cierre y con el orden detectado (Fase 36)

`saveLevelingProcessAction` recalcula con `computeLevelingDetected` y escribe,
por `save_leveling_process`, la cabecera y la libreta entera en una
transacción:

| Columna | Contenido |
|---|---|
| `precision_order` | El orden alcanzado, **detectado** al guardar; nulable desde la Fase 36: `null` sin verificación (abierta sin vuelta), con la libreta a medias o si no alcanza ni el ordinario |
| `meets_tolerance` | Si alcanza algún orden; `null` sin verificación o con la libreta a medias |
| `closure_error_mm`, `tolerance_mm`, `forward_error_mm`, `return_error_mm`, `discrepancy_mm`, `discrepancy_tolerance_mm`, `meets_discrepancy` | Los del cálculo al orden alcanzado (al ordinario si no alcanza ninguno); en blanco con la libreta a medias |
| `status` | `draft` sin armadas, `in_progress` con la libreta a medias (`pendingRun`), `calculated` cuando llega a su BM |

**La nivelación no se cierra** (Fase 36, decisión 14): el paso 1
(`20261006010000_ux_nivelacion.sql`) pasó las cerradas y rechazadas a
`calculated` y quitó sus triggers de cierre; el paso 2
(`20261007000000_nivelacion_sin_cierre.sql`, después del merge) borra
`closed_at` y `closed_by` y deja el `CHECK` de `status` en `draft`,
`in_progress` y `calculated`.

Columnas del alta (Fase 36): `location`, `responsible_name` y
`responsible_role`, como en la poligonal. Del equipo, el alta pide marca,
modelo y serie; `level_type`, `km_precision_mm`, `equipment_calibration_date`
y `correction_method` quedan sin escribir ni leer en la pantalla (§ 11).
`has_warnings` y `warning_messages`, que son de `leveling_readings`, tampoco
se escriben. `leveling_readings` no cambia: la captura por
armada escribe en el modelo por punto de siempre (hallazgo 7 del PRD).

### `settlement_readings` — columnas de resultado

Los cálculos se persisten como caché (los reescriben `resyncSiteReadings` y
`save_visit`): el dashboard y el hub leen `alert_status` sin recalcular; el
panel, el informe, los Resultados de la visita y el Excel recalculan con
`computeHistory`.

| Columna | Contenido |
|---|---|
| `partial_settlement` | Asentamiento desde la visita anterior, en mm (signo: negativo = descenso) |
| `accumulated_settlement` | Asentamiento desde la línea base del punto —su C0 o, sin C0, su primera lectura (Fase 11)—, en mm |
| `velocity` | mm/mes, con los días reales entre visitas (`DAYS_PER_MONTH = 30.4375`) |
| `alert_status` | `normal` \| `caution` \| `alert` \| `alarm` — la peor clasificación entre velocidad y acumulado |

`settlement_visits.status` puede ser `draft` (sin libreta), `in_progress`
(«En medición»: alguna lectura de su libreta está por tomar) o `calculated`
(Fase 37, `visitStatusOf`). Nunca tuvo `rejected`, y desde la Fase 37 tampoco
`closed`: el paso 1 pasó las cerradas a `calculated` y la segunda migración
(paso 3) deja el `CHECK` en esos tres. Desde ella todas las visitas se
reescriben cuando cambia lo que alimenta sus lecturas; hasta entonces, solo
las abiertas. El lugar no
tiene estado (arriba).

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
motivo) y `validateActiveFrom` (una fecha de calendario). Las Server Actions de
`point-actions.ts` las aplican; un punto de baja no se edita, y la fecha de
alta no se mueve una vez medido el punto. **Desde la Fase 37** (decisión 18)
la baja se deshace siempre y el alta admite cualquier fecha —las visitas
posteriores lo esperan como punto por leer—: salieron `undoRetirementBlocker`
(la baja se deshacía solo mientras ninguna visita cerrada tuviera fecha igual
o posterior) y la regla del alta posterior a la última visita cerrada.

### `site_benchmarks` — los BM del lugar (Fase 37)

Un catálogo propio de cada lugar (decisión 12 del PRD de la fase): `id`,
`site_id` (en cascada con el lugar), `code`, `elevation` `decimal(10,4)`,
`description`, `source` —de dónde vino, en texto: el catálogo del proyecto, el
amarre de una visita, tecleado, una nivelación, un CSV— y las marcas de tiempo,
con único `(site_id, code)` y RLS por el dueño del proyecto del lugar (las
cuatro políticas, como las de `settlement_points`). Los BM **se copian**: no se
sincronizan con `reference_points` ni con la nivelación de la que se importan,
así que corregir aquellos no cambia ninguna visita. La visita dejó de leer los
puntos de referencia del proyecto, que sigue usando la poligonal.

**`origin_visit_id`** (`20261008100000_bm_origen_visita.sql`, también del
paso 1; revisión final) guarda la visita que midió un BM: un punto auxiliar
que se guarda en los BM del lugar al terminar su armada, con `source` «Punto
auxiliar de la visita N». El motor no lo usa para verificar esa visita
(`verifyingBenchmarks`): sería un cierre de cero contra su propia medida, y en
ella sigue siendo un punto de cambio. Las demás visitas lo usan como cualquier
BM; si se borra la visita, queda como cualquier otro.

El paso 1 (`20261008000000_ux_asentamientos.sql`) los llenó con los BM que ya
usaba cada lugar: los del catálogo del proyecto que eran amarre de alguna
visita o se leían de paso, con su cota de ese momento, y los amarres tecleados
fuera del catálogo, con la cota de su visita más reciente. Se agregan, se
editan y se importan en la pestaña BMs (`benchmark-actions.ts`): de una
nivelación calculada del proyecto, con sus cotas ajustadas
(`benchmarksFromLeveling`), o de un CSV `codigo,cota,descripcion`
(`parseBenchmarkCsv`), los dos en `lib/import/benchmarks.ts`; un código que ya
está en el lugar se rechaza con su nombre. **Cambiar la cota o el código de un
BM recalcula todas las visitas del lugar** (`recomputeSite`, decisión 13), con
el aviso previo de cuántas lo nombran (`benchmarkImpactAction`); un código
nuevo renombra antes las filas de libreta que lo nombran. Un BM que alguna
visita nombra no se elimina. Duplicar el lugar copia sus BM.

### La libreta de la visita (Fases 18 y 37)

**Desde la Fase 37 toda visita se mide con libreta** (decisión 5): una visita
es una **lista de armadas** en `settlement_book_readings` —espejo de
`leveling_readings` sin `run_type`, con `point_id` al punto de control—, y las
cotas de los puntos se **derivan** de ella en el servidor (`visitRecordOf`,
§ 6). `settlement_readings.elevation` sigue siendo la cota canónica: es una
caché de la libreta. Como en la nivelación, una fila es un punto: su V+ abre
una armada y su V− cierra la anterior; las lecturas a los puntos de control
desde una posición del nivel van en VI (filas `intermediate`).

- **`starts_section`** (paso 1, `boolean not null default false`) marca la
  fila cuya V+ sale de **un BM del lugar** y abre un **tramo** (decisión 8); la
  primera fila de toda libreta lo lleva, y el paso 1 la marcó en las que ya
  había. Una armada que no arranca de un BM sale de un punto de cambio: la V−
  de la armada anterior.
- **La V− es opcional**: sin ella, la armada termina en sus puntos y su tramo
  queda abierto, «sin verificación».
- **Una fila sin lectura es un punto por leer** (decisión 9): `save_visit` la
  guarda sin cota y la visita queda `in_progress`. Así se guarda lectura por
  lectura y la medición se retoma donde quedó.
- **`precision_order` es nulable** desde el paso 1: el orden del tramo peor, o
  `null` si alguno no se verifica (decisión 15). `closure_error_mm`,
  `tolerance_mm` y `meets_tolerance` son los de ese tramo;
  `total_distance_km`, la suma de los tramos con distancias; y
  `reference_bm_code` y `reference_bm_elevation`, la copia del BM del lugar
  donde arranca el primer tramo.

**Hasta la Fase 37** la visita se capturaba de dos maneras, según
`capture_mode`: `book` (desde la Fase 18), una sola cadena que salía del BM de
amarre del catálogo `reference_points` y volvía a él, compensada si cerraba
dentro del orden que declaraba la visita; y `direct` (las anteriores a la Fase
18), con la cota tecleada por punto. La segunda migración (paso 3) borra
`capture_mode`, `weather_conditions` (el clima, que solo leía el editor:
decisión 19), `closed_at` y `closed_by`; la nota de la visita es `notes`.

`catalog_elevation` (Fase 30) guarda, en la fila de cada BM del lugar leído en
la libreta —que no sea punto de control—, su cota en `site_benchmarks` al
guardar, contra la que se comprueba que nivela (§ 6); hasta la Fase 37, la del
catálogo del proyecto. La tabla no lleva el trigger de vigencia de la Fase 11:
un punto de baja puede aparecer en la libreta; simplemente no produce lectura.
`point_id` es `ON DELETE SET NULL`: si se borra un punto, su fila queda como
radiación. Los triggers de la libreta de una visita o un lugar cerrados
(`reject_write_on_closed_visit_reading()`, `reject_write_on_closed_site_reading()`)
salieron en el paso 1.

**Orden de escritura de `save_visit`**, impuesto por los triggers de vigencia:
purga de las lecturas que ya no vienen → cabecera (con los derivados de la
verificación) → libreta con **upsert por `(visit_id, reading_order)` y purga de
las filas sobrantes** —nunca borrado y reinserción— → upsert de lecturas →
propagación a las demás visitas del lugar. Desde el paso 1 escribe
`starts_section` y deja de escribir el clima y el modo de captura.

**Lo que invalida la cota derivada**, y quién la recalcula:

| Entrada | Puerta |
|---|---|
| Filas de la libreta | Guardar la visita (`saveVisitAction` recalcula con `visitRecordOf` y propaga) |
| Cota o código de un BM del lugar | `saveBenchmarkAction` → `recomputeSite`: recalcula y guarda todas las visitas del lugar (Fase 37) |
| Código de un punto de control | `savePointAction` renombra sus filas de libreta en todas las visitas (hasta la Fase 37, solo en las abiertas) |
| Vigencia de un punto | Los triggers de la Fase 11; la derivación omite las filas fuera de vigencia |
| C0 de un punto, umbrales del lugar, borrar una visita | `resyncSiteReadings` (no toca cotas) |

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
| `leveling_processes` | los mismos cuatro de marca/modelo/serie/calibración, `level_type` (`automatico`\|`digital`), `km_precision_mm`; desde la Fase 36 el alta solo pide marca, modelo y serie | ISO 17123-2 |
| `settlement_visits` | igual que `leveling_processes` — el equipo es de la **visita**, no del lugar: el instrumento puede cambiar entre campañas; desde la Fase 37 el popup de la visita solo pide marca, modelo y serie | ISO 17123-2 |

Las tres tablas tienen además su propio `precision_order`, el mismo dominio de
cuatro valores que antes vivía solo en `projects`. En la poligonal (Fase 35) y
en la nivelación (Fase 36) ya no se declara: es el orden detectado al
calcular. En la visita (Fase 37) tampoco: es el que alcanza su tramo peor, o
`null`.

**Por qué no un catálogo de equipos reutilizable entre procesos.** Se evaluó y
se descartó (`docs/prds/07-precision-equipo-por-proceso.md`, decisión #2): una
tabla `equipment` referenciada por id reabre el agujero de trazabilidad que
motivó la fase, porque editar la fila cambiaría el equipo de los informes de
procesos ya cerrados. Con los campos sueltos en el proceso, el congelado salía
gratis de la inmutabilidad que existía entonces (§ 5), mientras el proceso
estuviera cerrado. Desde las Fases 35 a 37 nada se cierra, y el equipo del
informe es el que el proceso tenga guardado.

**Consecuencia para el informe.** Antes de esta fase, la página de impresión
de los informes consolidados leía `project.precision_order`/`project.equipment_*`
**en vivo**; editar el equipo del proyecto reescribía todos los informes ya
emitidos, incluidos los de procesos cerrados. Desde entonces lee del proceso,
que era inmutable mientras estaba cerrado (§ 5) — el congelado del informe era
una consecuencia de dónde vive el dato, no un mecanismo aparte. Desde que nada
se cierra (Fases 35 a 37), el informe muestra el equipo que el proceso tenga
al abrirlo, como el resto de sus datos (§ 3); desde la Fase 38 no hay otro
informe que el de cada proceso.

---

## 5. Seguridad

### Row Level Security

Las quince tablas tienen RLS activo, con políticas para las operaciones que
admiten. `site_benchmarks` (Fase 37) cuelga del proyecto a través del lugar,
como `settlement_points`.

`projects` y `equipment` (Fase 25) filtran por `user_id = auth.uid()`. Las tablas hijas heredan la
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

### Inmutabilidad: de los procesos cerrados al informe emitido

El PRD (§ 4.6) exigía que un proceso `closed` o `rejected` fuera inmutable.
**Desde la Fase 37 nada se cierra** (decisión 22 de su PRD), y lo único que
siguió inmutable fue **el informe consolidado emitido**: `reports` no admitía
`UPDATE` y su portada quedaba congelada en `cover` (abajo, «Lo que dependía de
lo cerrado»). **Desde la Fase 38 no queda nada inmutable**: sin consolidados,
`20261010000000_sin_informes_consolidados.sql` (después del merge, ya
aplicada, § 13) borra la tabla, su trigger `reports_reject_update` y su función
`reject_update_on_report()`. Lo prueba `sin_informes_consolidados.test.sql`
(§ 9). Lo que sigue es el registro.

- **Fase 35, la poligonal**: `20261005010000_ux_poligonal.sql` quitó sus
  triggers de cierre —cabecera, estaciones y lecturas— y pasó las cerradas a
  `calculated`, y `20261006000000_poligonal_sin_cierre.sql` (después del
  merge) borró `closed_at` y `closed_by` y dejó su CHECK de estado en `draft`,
  `in_progress` y `calculated`.
- **Fase 36, la nivelación**: `20261006010000_ux_nivelacion.sql` pasó las
  cerradas y rechazadas a `calculated` y quitó
  `leveling_processes_reject_update_on_closed`,
  `leveling_processes_reject_delete_when_closed`,
  `leveling_readings_reject_write_when_closed` y la función
  `reject_write_on_closed_process_reading()`, que solo usaba ella; y
  `20261007000000_nivelacion_sin_cierre.sql` (después del merge) borró
  `closed_at` y `closed_by`.
- **Fase 37, visitas y lugares**: `20261008000000_ux_asentamientos.sql` (paso
  1) quitó los once triggers de cierre de `settlement_visits`, `sites`,
  `settlement_readings`, `settlement_book_readings` y `settlement_points`
  —incluido el de la C0— con sus funciones propias
  (`reject_write_on_closed_visit_reading`, `reject_write_on_closed_site_visit`,
  `reject_write_on_closed_site_reading`, `reject_write_on_closed_site_point` y
  `reject_reference_change_with_closed_readings`) y, ya sin ellos, pasó las
  visitas cerradas a `calculated` y los lugares cerrados a `active`: el plan lo
  hacía al revés y el propio trigger rechazaba el `UPDATE` (`23001`).
  `20261009000000_asentamientos_sin_cierre.sql` (paso 3, después del merge)
  borra `closed_at` y `closed_by` de visitas y lugares, `sites.status`, y las
  tres funciones compartidas que ya nadie usaba:
  `reject_update_on_closed_process()`, `reject_delete_on_closed_process()` e
  `is_reopening()`. Lo prueba `asentamientos_sin_cierre.test.sql` (§ 9).

Lo que sigue es el registro de cómo funcionaba el cierre hasta entonces. La
garantía se aplicaba en **dos capas**:

**Aplicación** — las acciones de guardar y de cerrar de visitas y lugares
rechazaban cualquier operación sobre lo cerrado.

**Base de datos** — triggers `BEFORE UPDATE/DELETE`
(`supabase/migrations/20260727180000_immutable_closed_processes.sql`) que
rechazaban la escritura, incluidas las estaciones del proceso.

La segunda capa era la que contaba. La clave publicable de Supabase es pública
por diseño: cualquier sesión válida puede llamar a la API REST directamente y
saltarse las Server Actions. Antes de esos triggers, un `UPDATE` sobre un
proceso cerrado tenía éxito. La lección sigue valiendo para cualquier regla
que deba cumplirse: en la base, no solo en la acción.

Los triggers permitían la transición *hacia* cerrado —el cierre mismo es un
`UPDATE`— y bloqueaban todo cambio posterior.

**Reabrir (Fase 34, retirado en la 37).** También admitían la transición *de
salida*: un `UPDATE` que devolvía el estado a uno abierto (`calculated`, o
`active` en un lugar) y dejaba `closed_at` y `closed_by` en null, **sin cambiar
ninguna otra columna**. Lo reconocía `is_reopening(old_row jsonb, new_row
jsonb)` (`20261003000000_reabrir_procesos.sql`), que usaba la genérica
`reject_update_on_closed_process()`. Reabrir y modificar en el mismo `UPDATE`
se rechazaba con `23001`. Los triggers de los hijos, el de las visitas de un
lugar cerrado y el de la C0 miraban el estado **actual** del padre, así que se
liberaban solos al reabrirlo. Lo probaba `reabrir_procesos.test.sql`, y las
acciones (`reopen…Action`) aplicaban las reglas puras de `src/lib/reopen.ts`;
las de poligonal y nivelación salieron en las Fases 35 y 36, y las de lugar y
visita, con `reopen.ts`, su diálogo y su prueba, en la 37. `is_reopening` no
la ejecutaba `anon` (`20261005000000_reabrir_sin_anon.sql`).

**Excepción de posición (Fase 15, retirada en la 35).** Mientras la poligonal
se cerraba, sus triggers admitían sobre una cerrada un `UPDATE` que solo
tocara una **lista blanca de posición** —arranque, azimuts, amarre hacia
`null`, `georef_*` y las coordenadas y proyecciones de las estaciones—, para
poder georreferenciarla. Sin cierre, la excepción y sus funciones
(`reject_update_on_closed_polygonal_process`,
`reject_write_on_closed_process_station`,
`reject_write_on_closed_polygonal_reading`) sobran y se borraron.

**`settlement_readings` necesitó su propia función** (hasta la Fase 37), no la
genérica. El trigger de cabecera (`sites`, `settlement_visits`) reutilizaba
`reject_update_on_closed_process()` tal cual —era genérica, solo miraba
`old.status`—, pero la función de las filas hijas de poligonal
(`reject_write_on_closed_process_station()`, borrada en la Fase 35)
consultaba `public.polygonal_processes` por nombre de tabla, así que
`settlement_readings` tuvo su propia función análoga, que consultaba
`settlement_visits`. Se verificó con un ataque real vía REST directo (PATCH,
DELETE) contra una visita cerrada: las tres vías —lectura, cabecera de
visita— quedaban bloqueadas con el mismo código `23001`.

> **Consecuencia para el seed (hasta la Fase 37):** los procesos se creaban
> abiertos, se les cargaban las estaciones y se cerraban al final. Insertarlos
> ya cerrados hacía fallar la carga de estaciones. Desde la Fase 37 el seed y
> la demo no cierran nada.

**`settlement_points` cerraba el modelo** (hasta la Fase 37). Era la única
tabla del modelo de inmutabilidad sin trigger de base: la defensa vivía solo en
`loadOpenSite` (`point-actions.ts`), en la capa bypasseable. Una auditoría lo
explotó por REST directo (`PATCH` a `/rest/v1/settlement_points` de un lugar
cerrado: HTTP 204) y el efecto no era cosmético —el asentamiento acumulado
**se recalcula siempre en vivo** como `(cota − C0) × 1000`, así que alterar la
`C0` reescribía todo el histórico de un lugar sellado—. Lo cerró
`settlement_points_reject_write_when_site_closed`
(`20260826120000_reject_write_on_closed_site_point.sql`), borrado en el paso 1
de la Fase 37.

**Lo que dependía de lo cerrado sin serlo (Fase 23).** Dos filas abiertas
alimentaban resultados cerrados:

- **La C0 de un punto** (hasta la Fase 37). El acumulado es `(cota − C0) ×
  1000`; el panel y el informe recalculan en vivo, así que corregir la C0
  cambiaba los números de visitas ya cerradas.
  `settlement_points_reject_reference_change_with_closed_readings`
  (`20260930020000_c0_con_lecturas_cerradas.sql`) rechazaba con `23001`
  cambiar `initial_elevation` si el punto tenía una lectura en una visita
  cerrada, y `savePointAction` lo comprobaba antes (`pointReferenceChanged`).
  Desde la Fase 37 (decisión 18) la C0 se cambia siempre, con el aviso previo
  de cuántas visitas cambian (`pointImpactAction`), y `savePointAction`
  resincroniza las lecturas guardadas.
- **El informe emitido** (hasta la Fase 38). `reports` admitía `UPDATE` y su
  portada leía el proyecto. `reports_reject_update`
  (`20260930030000_informe_congelado.sql`) rechazaba todo `UPDATE` y se retiró
  la política de `UPDATE`: para una sesión, un `UPDATE` no tocaba ninguna fila
  (RLS); sin RLS, el trigger lo rechazaba. El borrado seguía permitido. Salió
  con la tabla en la Fase 38, con su prueba (`informe_congelado.test.sql`).

**Atribución de los informes (hasta la Fase 38).** La política de `INSERT` de
`reports` comprobaba también `generated_by = auth.uid()::text`
(`20260826120100_reports_insert_check_generated_by.sql`). Sin eso, un `POST`
directo podía crear un informe en un proyecto propio firmado por otro usuario.
Se va con la tabla.

**Precedente de la Fase 8: desactivar el trigger dentro de una migración.** El
backfill de `20260918022849_precision_equipo_por_proceso.sql` necesitó escribir
sobre procesos y visitas cerrados —rellenar el equipo y el orden que heredaban
implícitamente del proyecto— así que desactivó los triggers de inmutabilidad de
`polygonal_processes`, `leveling_processes` y `settlement_visits` solo para esa
transacción, reactivándolos en la misma migración. `settlement_visits` exigió
desactivar dos triggers propios, no uno: disparaba tanto por visita cerrada
como por *lugar* cerrado. Era legítimo porque rellenaba un dato que el proceso
siempre tuvo de forma implícita, no porque cambiara una medición o un
resultado de cierre — ver `docs/prds/07-precision-equipo-por-proceso.md`,
«Riesgos conocidos». Sin triggers de cierre desde la Fase 37, el único que
quedaba por respetar así era el de `reports`, y desde la Fase 38 no queda
ninguno.

### Cabeceras de seguridad

`next.config.ts` define `Content-Security-Policy`, `X-Frame-Options: DENY`,
`X-Content-Type-Options: nosniff` —relevante para los `.xlsx` de exportación—,
`Referrer-Policy: strict-origin-when-cross-origin` y `Permissions-Policy`, y
desactiva `poweredByHeader`.

La CSP lleva `'unsafe-inline'` en `script-src` y `style-src` **a propósito**:
Next inyecta el arranque de React y los estilos críticos en línea, y la app usa
`style={{…}}` en `/design-system` (muestras de color). La alternativa —un nonce
por petición— obliga a generarlo en `src/proxy.ts` y propagarlo; no compensa
mientras no entre HTML de terceros (hoy hay **cero** `dangerouslySetInnerHTML`
en `src/`). Hasta la Fase 20 costaba además volver dinámicas las rutas
estáticas; desde que el layout raíz lee la cookie del tema, ya no queda
ninguna.

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

`SUPABASE_SECRET_KEY` se usa **solo** en `scripts/`: el seed y los de
mantenimiento (`reparar-resultados-estacion.mjs`,
`resincronizar-asentamientos.mjs` y, desde la Fase 37,
`agregar-cartera-demo.mjs`). Ningún archivo de `src/` lo usa. El cliente usa
exclusivamente `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.

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

**Qué trae la demo (Fase 21).** Desde la Fase 21 el «Proyecto de ejemplo» son
las carteras de campo reales con que se validó el motor, no datos sintéticos:
la poligonal V10 de la cartera TT4, la Famarena de la Sede Vivero ajustada
por mínimos cuadrados y su versión en sistema local para georreferenciar, la
nivelación de El Verjón con ida y vuelta y el tramo 2 leído del crudo de un
nivel digital Leica, más Torre Alameda, la simulación del prototipo de
asentamientos. Hasta las Fases 35 a 37 se creaban cerradas y con su informe;
desde entonces nada de eso se cierra, y los informes ya no
se llaman «de cierre»; **desde la Fase 38** la demo no crea informes
consolidados (salió `insertar-informe.ts`, con las banderas `informe` de
`fixtures.ts`): el informe de cada proceso está en su página. **Desde la Fase
37** (decisión 23) Torre Alameda tiene sus BM en los del lugar (BM-1 y BM-2),
con las visitas sin compensar —solo la
9 queda sin verificación—, y la demo suma la primera serie real de
asentamientos: «Control de asentamiento estructural», 16 puntos sin C0, el BM
de la piscina (`PISCINA/BM`, 156.299) y 7 visitas de una armada, la última
del 2022-06-05, «AA3» y B10 en la visita del 2022-04-12 tal cual la hoja.
Desde la Fase 43 se numeran como la aplicación, de la 0 (base) a la 6; la
hoja lo hace de la 1 a la 7. Los datos de campo
viven **una sola vez** en `src/lib/demo/` —`carteras.ts`, `crudo-tramo2.ts`
(el `.L` como texto, porque `docs/` no se despliega), `torre-alameda.ts`,
`cartera-asentamientos.ts`— y los usan la demo, el seed y los tests. Los
resultados los calcula el motor al crearla; cada lugar escribe sus visitas
agrupadas, una escritura por tabla (`insertarVisitas`, sobre
`recalculateSite`), porque todo esto corre en el primer acceso del usuario. En
local, crearla añade unos 0.6 s a ese primer dashboard (medido antes de la
cartera). Quien ya tiene la demo conserva la suya: no se recrea; el lugar de la
cartera se le agrega con `scripts/agregar-cartera-demo.mjs` (§ 13), que usa la
misma `insertarCartera`.

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
| `least-squares.ts` | `adjustByConditions` — ajuste por ecuaciones de condición, genérico; `solveLinear`; `sigma0Reading` (Fase 14). Desde la Fase 38 devuelve también `last`, las matrices de su última iteración (A, la diagonal de Q, w, N = A·Q·Aᵀ y k, con N·k = −w), que el ajuste de la poligonal publica en `matrices` con sus observaciones l₀ para el Excel; ningún resultado cambia. Desde la Fase 39, `adjustedCofactor`, `fQuantile2`, `ellipseScale` y `errorEllipse`: la precisión de lo ajustado |
| `leveling.ts` | `computeLeveling` — libreta, corrección proporcional, cierre, ida y vuelta; `computeLevelingDetected`, `detectLevelingOrder` y `pendingRun` (Fase 36) |
| `settlement.ts` | `computeSettlements`, `classifyAlert`, `computeTrends`, `detectTrendDeviations`, `computeHistory` |
| `settlement-book.ts` | La libreta de la visita por tramos, sin compensar (Fase 37): `computeBook`, `tramoStarts`, `bookVerification`, `bookElevations`, `bookTemplate`, `bookPending`, `visitStatusOf`, `auxiliaryPoints`, `bookBenchmarkChecks` |
| `visit-record.ts` | `visitRecordOf` —lo que se guarda de una visita— y `recalculateSite` (Fase 37) |
| `settlement-summary.ts` | `summarizeSite`, `chainedMeans`, `nextAccumulatedThreshold` — el resumen del lugar para el panel y el informe |
| `settlement-persistence.ts` | `readingChanged`, `visitsToRewrite`, `bookRowsToPersist` — qué lecturas hay que reescribir al guardar |
| `correction-breakdown.ts` | `correctionBreakdown` — cómo corrigió el método elegido, con las cifras del motor, para el paso Ajuste y el informe (Fase 35); solo vuelve a resolver el 2×2 de Crandall para mostrar λ₁ y λ₂ |
| `tolerances.ts` | `ANGULAR_TOLERANCE_K`, `MIN_RELATIVE_PRECISION`, `LEVELING_TOLERANCE_K`, `DAYS_PER_MONTH`, `SETTLEMENT_THRESHOLD_PRESETS`, `CALIBRATION_MAX_MONTHS`, `MIDDLE_WIRE_TOLERANCE_M`, `TREND_DEVIATION_RATE_FACTOR`, `angularTolerance`, `minRelativePrecision`, `levelingTolerance`, `detectPrecisionOrder`, `thresholdsFor`, `thresholdsOf`; el margen fijo de la tendencia (`trendDeviationMargin`, `accelerationMargin`, Fase 37) |

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

### Orden y tipo de ángulo detectados (Fase 35)

El orden de precisión y el tipo de ángulo **no se declaran**: se detectan, y
`computePolygonalDetected(input)` —sin `order` ni `angleType`— devuelve
`{ result, order, angleType }`. Lo usan el guardado, la pantalla por pasos
(`usePolygonalComputation`), el informe, el Excel, la demo y el seed: todos
calculan igual.

- **Tipo de ángulo** (`detectAngleType`): interiores y exteriores solo cambian
  la suma teórica, (n − 2)·180° frente a (n + 2)·180° —más 360°·k con fila de
  cierre—, y difieren en 720°: el más cercano a la suma observada es el
  medido. La abierta con control es siempre deflexión.
- **Orden** (`detectPrecisionOrder` en `tolerances.ts`): el más alto que
  cumple **a la vez** K·√n y la precisión relativa mínima, recorriendo de
  primero a ordinario con una holgura de 1e-9. `null` en la abierta sin
  control, sin precisión o si no alcanza ni el ordinario. n es
  `result.angularConditionCount`; sin condición angular (abierta con control
  sin azimut de llegada) se juzga solo la lineal.
- Calcula primero con el ordinario —los errores no dependen del orden— y, si
  alcanza otro, repite con ese orden para que tolerancia y veredicto sean los
  suyos. Las coordenadas no dependen del orden.

`observedAzimuths(input)` encadena los azimuts **sin ajustar**, con los ángulos
medidos: los usa la tabla de mediciones del paso de Datos.

### El desglose de la corrección (Fase 35)

`correction-breakdown.ts` expresa la corrección del método en sus términos, sin
recalcular la poligonal: lee las proyecciones crudas y corregidas del
resultado. Para los proporcionales, el paso angular (`AngularStep`: error,
ángulos, corrección por ángulo y si entra el de orientación) y, por lado, la
corrección de ΔN y ΔE; Brújula y Tránsito, su factor −e/P o −e/Σ|Δ| por eje;
Crandall, λ₁ y λ₂ resolviendo de nuevo su sistema 2×2, con una prueba que
comprueba que reproduce las proyecciones del motor. Mínimos cuadrados devuelve
el ajuste y la estación del datum. Lo consumen el paso de Ajuste y la sección
«Corrección por método …» del informe.

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
exteriores (`(n+2)·180`). Ambos casos ocurren en campo. Hasta la Fase 34 lo
elegía el usuario, sin preselección; desde la 35 se detecta (arriba).

### Amarre y esquemas de cierre

Una cartera real se orienta sobre un punto de coordenadas conocidas, así que el
azimut de amarre **se calcula** (`azimuthFromCoordinates`) en vez de teclearse,
y se persiste resuelto: el CRUD de `reference_points` —y, desde las
correcciones de la Fase 35, el popup del amarre— permite mover un punto ya
usado, y el proceso debe conservar el azimut con el que se calculó (con un
límite: § 11, «Un punto del catálogo que se mueve»).

Hay dos esquemas de cierre, y `has_closing_row` los distingue:

| Esquema | Última fila | Suma teórica | Ejemplo |
|---|---|---|---|
| Contra el amarre | Ángulo del último lado de vuelta a la referencia, sin distancia | `(n−2)·180 + 360·k` sobre n+1 ángulos (exteriores: `(n+2)·180 + 360·k`) | cartera TT4 |
| Contra el primer lado | Ángulo interior del vértice de arranque | `(n−2)·180` sobre n ángulos; la orientación solo fija el datum | cartera Vivero |

**El 360·k de la fila de cierre (Fase 26, C-1).** Con fila de cierre, el
vértice de arranque aporta dos lecturas —orientación (amarre → primera
estación) y cierre (última estación → amarre)— que suman su ángulo más 360·k:
k = 1 si el amarre queda fuera del barrido horario que va de la vista atrás a
la adelante, y k = 0 si queda dentro. Hasta la Fase 26 el +360 era fijo: TT4
tiene k = 1, pero con el amarre del otro lado —o en una exterior recorrida en
sentido horario con el amarre fuera— la poligonal salía con 360° de error. El
motor saca k de la propia suma, redondeando a 0 o 1; fuera de ese rango deja
1, para que una poligonal declarada interior siendo exterior, a 720°, se siga
viendo como error.

**En las abiertas (Fase 26, C-2)** el amarre también orienta: el primer lado
sale del azimut hacia el amarre más el ángulo de orientación de la primera
fila, que la tabla rotula así. Ese ángulo fija el datum y no se corrige, como
en la cerrada sin fila de cierre.

Hasta la Fase 26 había un **control de reorientación** que comparaba el último
azimut de la cadena con su objetivo. Se quitó: calculado con los ángulos
corregidos daba siempre 0, y con los crudos coincidía con el error angular,
que ya se muestra.

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

Cada ángulo guarda N lecturas en `polygonal_angle_readings` y la estación
guarda el **promedio** (`angle_readings_min` sigue en la tabla, pero no se lee
desde la Fase 35; § 11),
recalculado por el servidor: es derivado, no un dato que el cliente pueda
contradecir.

La dispersión (máx − mín) se muestra como dato junto al promedio, sin juicio.
Hasta la Fase 31 avisaba si superaba el doble de la precisión angular del
equipo (`READING_DISPERSION_FACTOR`); el usuario la quitó (D-5), porque con
ese umbral saltaba en el 32–58 % de los datos correctos. Ningún validador
exige un mínimo de lecturas: `readingDmsError` solo revisa el rango de cada
una.

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
  filas y configuración. La pantalla por pasos («Importar .L o CSV») las
  aplica al borrador (`draftWithImport`) y guarda al aceptar. El alta crea la
  nivelación vacía: la rama de `createLevelingProcessAction` que guardaba
  lecturas importadas se quedó sin llamadores desde la Fase 36.

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
- La acción escribe con `georeference_polygonal`, en una transacción:
  actualiza cada estación por su id, solo en sus columnas de posición. Así se
  diseñó cuando la poligonal se cerraba (Fase 15), y sigue sirviendo.

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
- `ellipseFactor` (Fase 39): con mínimos cuadrados, el mismo criterio para las
  elipses de error al 95 %, con el mayor semieje al 15 %
  (`ELLIPSE_TARGET_FRACTION`) de la extensión: Vivero ×500. El dibujo las
  traza en verde (`--color-success`), con el eje mayor girado φ = azimut − 90°
  porque el SVG gira desde el eje x, y sus medidas a la centésima de píxel: el
  servidor y el navegador difieren en el decimal 13 de la covarianza y React
  avisaba al hidratar. El encuadre las contiene (`ellipseExtremes`) y el giro
  sale de `ellipseRotation`. El informe usa el mismo componente.
- `plotFrame`: proporción **1:1** entre Norte y Este (es un plano; escalar los
  ejes aparte deformaría los ángulos), Norte hacia arriba, zoom alrededor de un
  centro.

El editor usa `PolygonalPlotViewer`, que mide su contenedor y dibuja con el
ancho real: con un `viewBox` fijo, en un teléfono el texto se reducía a unos
4 px. El informe usa `PolygonalPlot` con el tamaño por defecto.

Desde la Fase 41 el visor se mueve como un mapa: arrastrar desplaza; Ctrl +
rueda, doble clic y el pellizco de dos dedos acercan hacia el punto con
`zoomAt` (pura, con tests: el punto bajo el cursor no se mueve; acota a
[1, `MAX_PLOT_ZOOM`]); los botones + / − y encuadrar flotan sobre el `<svg>`
por la prop `viewport` de `PolygonalPlot`, que también lleva los gestos para
que no actúen sobre la leyenda. La rueda va por un `addEventListener` no
pasivo (React registra `onWheel` como pasivo y no deja cancelarla), enganchado
con un ref de callback: el dibujo puede aparecer después del primer render.
La rueda sola no se captura —la página del editor es larga— y muestra el
aviso «Usa Ctrl + rueda para acercar». Con el foco en el dibujo, flechas,
+ / − y 0.

**Un solo camino de filas a entrada.** `polygonal-draft.ts` (sin `"use
client"`) contiene `polygonalInputOf`, que compone `draftOf` e `inputOf`
(`polygonal-save.ts`) con el orden y el tipo de ángulo detectados. La pantalla
por pasos, el informe, el Excel y la georreferenciación arman la entrada del
cálculo por ahí, así que el dibujo del informe es por construcción el de la
pantalla.

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
- El **orden alcanzado no cambia**: error angular, lineal y precisión relativa
  son los de la cartera medida, antes de ajustar. Solo cambian las
  coordenadas, los ángulos corregidos y los azimuts.
- σ₀ = √(vᵀPv / r). Desde la Fase 32 (D-6), `sigma0Reading(σ₀, r)` lo lee
  con la **prueba χ² bilateral al 95 %** de su redundancia (Ghilani, § 5.4 y
  § 16.7; USACE EM 1110-2-1009): `sigma0Interval(r)` da [√(χ²inf/r),
  √(χ²sup/r)], de 0.159 a 1.921 con r = 2 y de 0.268 a 1.765 con r = 3.
  `SIGMA0_CHI2_95` solo tiene esas dos r, las únicas que da una poligonal
  (`conditions: 2 | 3`). Solo cambia el texto que acompaña a σ₀, que dice r y
  el intervalo con tres decimales, como σ₀; no decide nada.
- **La precisión de cada punto** (Fase 39): `adjustedCofactor` da el cofactor
  de las observaciones ajustadas, `Q − Q·Aᵀ·N⁻¹·A·Q`, con las matrices de la
  última iteración, y `pointPrecision` (en `polygonal.ts`) lo propaga a cada
  vértice: el punto de la estación i es la partida más los lados 0…i−1, así
  que su jacobiano es la suma parcial de las mismas filas analíticas de A. La
  covarianza es `σ₀²·J·Q_l̂·Jᵀ`; `errorEllipse` da los semiejes y el azimut del
  mayor, y `ellipseScale(r)` el factor `c = √(2·F(0.05, 2, r))` que la lleva al
  95 % (Ghilani y Wolf, ec. 19.22; `fQuantile2` en forma cerrada, que
  reproduce su tabla 19.2): 4.37 con r = 3 y 6.16 con r = 2. Va en
  `adjustment.precision` —`confidence`, `scale` y, por estación, σ N, σ E, la
  covarianza y la elipse—, con `null` en los puntos fijos: la partida, la
  vuelta a ella y la llegada conocida. No se persiste, como las correcciones.
  Se verifica contra un **ajuste paramétrico independiente** escrito en la
  prueba (Vivero, a la millonésima de milímetro) y contra la propagación por
  diferencias finitas a través de todo el motor (abierta con control, r = 3 y
  r = 2).

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

Tolerancia angular = K·√n, donde n es el número de ángulos que entran en la
condición: los vértices de una cerrada (más el de cierre si hay fila de
cierre) o las deflexiones de una abierta con control. Nivelación usa su propio
coeficiente, `LEVELING_TOLERANCE_K` (3/6/12/24 mm, tolerancia K·√D en km) — ver
§ 4 y § 7 del PRD principal. En una cerrada o de enlace con vuelta, **cada
recorrido** se juzga con K·√D sobre su propia distancia (Fase 26, C-10). La
discrepancia entre ida y vuelta se contrasta contra K·√D·√2, con D la menor de
las dos distancias; si a un recorrido le faltan, no se evalúa (Fase 23). El
error y la tolerancia se comparan con un margen de 10⁻⁶ mm (`withinTolerance`,
Fase 26, C-13): el error sale de restar cotas en coma flotante, y sin margen
un cierre exactamente igual a la tolerancia cumplía o no según la cota del BM.
Las tolerancias son las del marco teórico; la FGCS (1984) no lleva el √2 de la
discrepancia y sus clases están corridas (auditoría del cálculo, § 6). `CALIBRATION_MAX_MONTHS`
(12) es la antigüedad de la calibración a partir de la cual el formulario de
equipo avisa (Fase 25).

El **equilibrado de visuales** (Fases 19 y 32, con los límites de la FGCS) se
retiró en la Fase 36 (decisión 7): es un aviso de campo, no parte del ajuste, y
quitarlo no cambia ninguna cota. Con él se fueron `validateSightBalances`,
`validateSectionBalances`, `SIGHT_BALANCE_LIMIT_M` y `SECTION_BALANCE_LIMIT_M`,
en la nivelación y en la visita.

### Sin aviso de equipo insuficiente (Fase 31)

La Fase 8 añadió `totalStationMeetsOrder` y `levelMeetsOrder`: avisaban si la
precisión declarada del equipo superaba el coeficiente K del orden, en el
formulario de equipo, en una nota del veredicto verde de la poligonal y con un
asterisco en el resumen de precisiones del informe. La Fase 31 los quitó (D-4)
por decisión del usuario, tras consultar la FGCS 1984:

- la norma exige el instrumento por orden con requisitos fijos (la resolución
  del teodolito, la repetibilidad de la línea de visual del nivel), no
  comparando su σ con K;
- σ ≤ K le decía «alcanza» a un equipo que falla el cierre entre el 32 y el
  48 % de las veces;
- lo que juzga el trabajo es el cierre contra la tolerancia, que la app ya
  evalúa.

El equipo se sigue capturando, guardando y mostrando en el informe y el Excel:
es trazabilidad, no un control.

### Umbral de cierre exacto

En la **cerrada**, `computePolygonal` considera exacto un cierre con
`linearError <= 1e-9` m y devuelve `relativePrecision: Infinity`, que se
presenta como `1:∞`. La abierta con control solo trata como exacto el cierre
igual a 0.

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

### Nivelación: ida y vuelta en la compensación (Fase 28)

Con recorrido de vuelta, cada recorrido se compensa contra la cota conocida en
la que cierra, y solo si el trabajo cumple:

- **Abierta.** Ida y vuelta forman un circuito sobre el BM de partida, la única
  cota conocida. `circuitClosureMm` = (Δh_ida + Δh_vuelta)·1000 se reparte por
  distancia a lo largo de todo el circuito (`applyCircuitCorrection`): en la
  ida con su acumulado, y en la vuelta con D_ida + su acumulado. En el punto de
  vuelta da el promedio de ida y vuelta ponderado por 1/D.
- **Cerrada o de enlace.** La vuelta se compensa con su propio cierre
  (`applyProportionalCorrection`), como la ida con el suyo.

**Una cota por punto.** `adoptedElevations` da el promedio de las cotas
compensadas de un punto leído dos veces —en la ida y en la vuelta, o al ir y
al volver de un mismo recorrido, como el tramo 2— y la cota conocida para el
BM de partida y, en una de enlace, el de llegada (`knownBmsOf`), que no
cambian nunca. Los puntos se reconocen por su código normalizado, como los
homólogos. `adoptedElevationsOf` la aplica a un cálculo, solo si se compensó
(desde la Fase 36 la nivelación compensa siempre), y la usan la pantalla, el
informe y, desde la Fase 38, la hoja «Cotas ajustadas» del Excel, que la
escribe con fórmulas. `storedAdoptedElevations` (`lib/reports/adopted.ts`),
que la derivaba de las filas guardadas para el Excel viejo, salió en la Fase
38. En la pantalla y en el informe se llama **cota ajustada** (Fase 36,
decisión 12).

Por qué el promedio y no la cota de la ida: tras compensar el circuito, la
incertidumbre de un punto depende de su posición como s·(L − s)/L, que es
simétrica, así que sus dos cotas compensadas valen lo mismo. El documento
`docs/math/nivelacion.html` reúne todas las fórmulas del módulo con El Verjón
resuelto paso a paso.

**Sin marca por proceso** (decisión 3 del PRD de la fase): el motor nuevo vale
para todos. Las nivelaciones abiertas guardadas se recalcularon; las cerradas
conservan sus filas. En producción, la única cerrada, el tramo 2, es un solo
recorrido y se compensa como antes.

### Nivelación: el orden detectado y la compensación sin limitantes (Fase 36)

Hasta la Fase 36 la nivelación declaraba su orden y **solo se compensaba si lo
cumplía** (marco teórico § 8.1). Desde entonces:

- **El orden se detecta** (`detectLevelingOrder`): el más alto con |e| ≤ K·√D
  en la cerrada y la de enlace —en la ida y, si la hay, en la vuelta con su
  distancia—, y con |d| ≤ K·√D·√2 sobre el recorrido más corto en la abierta
  con vuelta. La abierta sin vuelta no tiene con qué juzgar
  (`verifiable: false`). El Verjón alcanza segundo orden (5.0 mm frente a
  5.3); el tramo 2, primer orden (−0.4 mm frente a 3.5).
- **Se compensa siempre** que haya contra qué cerrar: `computeLeveling` recibe
  `compensation: "always"`, y `computeLevelingDetected` calcula con él al orden
  alcanzado —al ordinario si no alcanza ninguno, para que la pantalla diga por
  cuánto se pasa—. La pantalla y el informe avisan si no alcanza ningún orden.
- **La visita conservó su regla** (decisión 6): sin la opción, la compensación
  siguió siendo «dentro de tolerancia» del orden que declaraba la visita, y
  ninguna cota de visita cambió. La Fase 37 dejó de compensarla (abajo, «La
  libreta de la visita»), y `"within_tolerance"`, el valor por omisión, se
  quedó sin llamadores fuera de las pruebas (§ 11).
- **La libreta a medias** (`pendingRun`): la captura por armada guarda tras
  cada una. Mientras la ida de una cerrada o de enlace no llegue a su BM, la
  de una abierta con vuelta no marque su fin, o la vuelta no llegue al BM de
  partida, `computeLevelingDetected` calcula con `compensation: "never"`, sin
  orden, y lo devuelve en `pending`. La acción guarda `in_progress` con el
  cierre en blanco y valida con `validateRunCapture(…, { allowUnfinished:
  true })`. La visita conservó la exigencia de terminar en el BM hasta la Fase
  37, que la quitó: su V− es opcional.
- **La libreta que no encadena** (revisión final): si Σ V+ − Σ V− no da el
  desnivel —un punto de cambio sin una de sus lecturas, una V+ colgada—, las
  cotas salen de una altura de instrumento equivocada. `computeLevelingDetected`
  la marca `broken`: sin orden y sin compensar, y se guarda en curso. Antes el
  cierre la bloqueaba (Fases 24 y 26). `libretaBlocker` dice la fila y el
  recorrido en la libreta, la compensación y el informe.

**La captura por armada** (`components/leveling/armadas.ts`) pasa de un popup
a las filas por punto sin cambiar `leveling_readings`: una armada es la V+ de
un punto, sus intermedias y la V− del siguiente punto que no es intermedio
(`armadaSpans`); `writeArmada` escribe solo esas filas —el punto de cambio que
la cierra conserva su V+, que abre la siguiente— y reconoce las formas
irregulares de una libreta importada o vieja (una armada a medias al final,
una intermedia colgada después del último punto).

### `computeSettlements` y `classifyAlert`

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

**Sin posición (Fase 29).** Hasta la Fase 29, `computeDifferentials`
calculaba el asentamiento diferencial de cada par de puntos y su distorsión
angular, `1/((L×1000)/Δs_diferencial)`, con L desde las coordenadas Norte y
Este del catálogo y, para un punto de alta, sobre el periodo común (Fase 11).
El usuario decidió que los puntos de control no tienen posición: sin distancia
no hay distorsión, y el diferencial solo existía para ella. Se quitaron la
función, `horizontalDistance`, `DifferentialPair`, el límite 1/X del lugar, el
KPI y la tabla del panel y del Excel. Los resultados de cada punto
—asentamiento, velocidad, semáforo y tendencia— no cambiaron.

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
que frena. El margen es el ruido de las dos cotas que se comparan (Fase 32,
D-7) y, **desde la Fase 37, fijo** (decisión 17: «simplifícalo»):
`trendDeviationMargin()`, sin argumentos.

```
m = ½ · √(T² + T²),   T² = K_tercer² · 0.5 km = 72 mm²   →   m = 6 mm
```

Es el criterio de USACE EM 1110-2-1009 (§ 2-3.b), 1.96·√(σₚ² + σₙ²), si K·√L
es el límite al 95 % del cierre (NGS 3, § 3.1.3) y la cota de un punto tiene,
como mucho, σ_km·√(L/4). T es la de una visita sin libreta en tercer orden: el
margen que ya tenían las cotas tecleadas. `tolerances.ts` trabaja con T²
(`VISIT_TOLERANCE_SQ_MM2`) para que dos visitas den 6 mm exactos, sin ruido de
coma flotante. **Hasta la Fase 37** cada visita entraba con su orden y la
longitud de su libreta (`VisitCircuit`, que leía `visitCircuitsOf`:
`total_distance_km` o, sin libreta, `DIRECT_CAPTURE_CIRCUIT_KM`, 0.5 km), y
Torre Alameda, con circuitos de 0.112 km, bajaba a 2.8 mm en tercer orden. La
visita ya no declara orden y su libreta puede no tener distancias. Con el
margen fijo, B10 de la cartera real avisa «excesiva» en la visita 2, la del
2022-04-12 (−50 mm frente a unos 17.1 previstos), y «contraria» en la 3, la
del 2022-04-19 (+45 mm), y Torre Alameda
no da avisos ni «Acelerando». El factor 2 (`TREND_DEVIATION_RATE_FACTOR`) sigue
siendo una decisión con nombre. Solo evalúa desde la tercera lectura del punto.
P-09 del marco teórico y las series del seed son tests de regresión: no dan
ningún aviso.

Es una función aparte, y no un campo de `computeSettlements` —hasta la Fase 37,
porque necesitaba el circuito de cada visita, que `VisitInput` no lleva—. La
llaman el panel del lugar, el paso de Libreta de la visita (el movimiento de
cada punto, `pointMovements`) y el informe del lugar (`siteReportOf`). Avisa,
no bloquea y no se persiste. Tampoco cambia el semáforo ni `computeTrends`.

`computeHistory` compone todo lo anterior sobre la serie completa de un
lugar: ordena las visitas **por fecha, no por `visit_number`**; hay un test
que fija ese contrato.

`computeTrends(visitas)` da la tendencia de cada punto, y solo con al menos
tres visitas (dos velocidades que comparar). Desde la Fase 31 (D-10) un punto
**acelera** si |V_última| − |V_anterior| pasa de un margen de ruido; si no,
**converge**. Antes bastaba cualquier aumento, y el ruido de medición hacía
«acelerar» puntos que se frenaban (TA-01 y TA-02 de Torre Alameda, P-04 de
Torre Central). Desde la Fase 32 el margen es `accelerationMargin`: las dos
velocidades dependen de las tres últimas cotas **del punto** —una visita
saltada no entra—, y el margen suma el ruido de las tres con el mismo criterio
de USACE, con T fijo desde la Fase 37:

```
margen = ½ · √(T²/Δt₁² + T²·(1/Δt₁ + 1/Δt₂)² + T²/Δt₂²)   [mm/mes]
```

Con intervalos iguales es √3 veces m/Δt: 6·√3 = 10.39 mm/mes con intervalos de
un mes. La Fase 31 usaba m/Δt, el margen de una sola diferencia: el umbral
quedaba en 1.13 σ, y con los circuitos cortos de la Fase 32 daba hasta un 13 %
de «Acelerando» falsos. Lo halló la revisión de código de la fase. Salió de
`computeHistory` cuando necesitaba el circuito de cada visita (Fase 32), y la
llaman los Resultados de la visita (`visitResultsOf`) y, hasta la Fase 38,
el Excel; desde la Fase 37 ya no hay visitas sin circuito que dejen a un punto
sin tendencia.

`settlement-summary.ts` da el **promedio encadenado** de cada visita
(`chainedMeans`, Fase 31, D-8): el de la anterior con lecturas más la media de
los parciales de los puntos medidos en las dos. `summarizeSite` lo usa, y lo
toman de ahí el panel, el informe del lugar y los Resultados de la visita
(`visitResultsOf`, su promedio y el de la anterior).

---

### La libreta de la visita: por tramos y sin compensar (Fases 18 y 37)

`lib/calculations/settlement-book.ts` no trae motor de nivelación propio: cada
**tramo** de la libreta lo calcula `computeLeveling`. Desde la Fase 37
(decisión 14) **la visita no se compensa** ni declara orden:

- **Los tramos** (`tramoStarts`): la libreta se parte en la primera fila y en
  cada una con `startsSection`, la armada que sale de un BM del lugar.
  `computeBook(filas, bms)` calcula cada tramo con `compensation: "never"`
  desde la cota de su BM en `site_benchmarks`: **cerrado** si su última fila
  con cota es el mismo BM, **de enlace** si es otro BM del lugar —con su cota
  como llegada— y **abierto** si termina en sus puntos o en un auxiliar. Un
  tramo que arranca en otro BM toma la cota de ese BM, no la de la cadena.
- **La cadena**: una fila tiene cota mientras cada V+ y cada V− que la
  preceden en su tramo estén leídas; una intermedia sin lectura solo se pierde
  a sí misma. Una fila sin cota queda en `NaN` (y en `null` en la base). Un
  punto de cambio sin su V− deja sin cota lo que sigue y el tramo sin cierre
  (`complete: false`); un tramo que arranca en un código que no es BM del
  lugar no da ninguna.
- **El orden de cada tramo** cerrado o de enlace sale de `detectLevelingOrder`
  (Fase 36), con su cierre a 0.1 mm y su tolerancia; el abierto no tiene
  orden, y uno sin distancias tiene cierre pero no orden.
  `bookVerification` resume la visita en su **tramo peor** (decisión 15): si
  todos se verifican, el orden más bajo de ellos; si alguno no, «sin
  verificación» (`order: null`).
- **Las cotas de los puntos** (`bookElevations`): la de la fila con su
  lectura —VI o V−—, **AI − lectura, sin corregir**, a 4 decimales. Un punto
  leído en dos filas es un error `duplicate` con las dos (decisión 10), que la
  acción devuelve para que la libreta pregunte cuál se elimina; un punto por
  leer no da cota ni aviso; uno vigente que no está en la libreta avisa
  (`missing`), y uno fuera de vigencia avisa y no da cota.
- **La plantilla** (`bookTemplate`, decisión 4): las armadas de la visita
  anterior —sus BM, sus puntos de cambio y sus puntos de control—, sin
  lecturas, sin los puntos de baja y con los de alta antes del BM de cierre;
  sin anterior, una armada desde el primer BM del lugar con los puntos
  vigentes; sin BM en el lugar, ninguna. Sustituyó a `buildBookTemplate`.
- **Lo pendiente** (`bookPending`): la V+ de un arranque, la VI de una
  intermedia, la V− de cualquier otra fila y la V+ de un punto de cambio que no
  es el último. `visitStatusOf` da `draft` sin filas, `in_progress` con algo
  pendiente y `calculated` sin nada.
- **El punto auxiliar** (`auxiliaryPoints`, decisión 11): el código de una V−
  que no es punto de control ni BM del lugar.
- **Un BM del lugar leído de paso** (`bookBenchmarkChecks`, Fase 30, decisión
  16): cada fila con cota cuyo código es un BM del lugar —y que no es punto de
  control, ni el arranque de su tramo, ni su BM de cierre, que es el cierre— se
  compara con su cota del lugar con la tolerancia de **tercer orden** sobre la
  distancia recorrida hasta ella y la frontera del cierre (`withinTolerance`,
  C-13). Sin distancias no hay veredicto. Hasta la Fase 37 lo hacía
  `checkBenchmarks`, con el orden de la visita y el catálogo del proyecto.

**Una sola regla para lo que se guarda** (`visit-record.ts`, aprendizaje de la
Fase 36). `visitRecordOf` da, de la libreta, los BM del lugar y los puntos: el
libro, la verificación, las cotas, los avisos, la cabecera —el BM del primer
tramo; el cierre, la tolerancia y el «cumple» del tramo peor si cierra; la
distancia, el orden y el estado— y las filas para `save_visit`.
`recalculateSite` lo aplica a todas las visitas de un lugar y pasa sus cotas por
`computeHistory`; una visita sin libreta —de cotas tecleadas, anterior a la
fase— entra al histórico con sus cotas guardadas. Lo usan `saveVisitAction` y
`createVisitAction`, `recomputeSite` (`lib/supabase/settlement-sync.ts`: el
cambio de la cota de un BM y el script de resincronización) y la demo y el
seed (`insertarVisitas`). **Hasta la Fase 37** `computeVisitBook` calculaba la
libreta como un solo circuito cerrado sobre el amarre, compensado dentro del
orden declarado, y `deriveControlElevations` daba la cota **compensada**;
salieron con `catalogElevationsOf`, `benchmarkChecksOfBook` y
`validateVisitBook`.

**La cartera real lo comprueba.** `cartera-asentamientos.test.ts` captura las
siete visitas —una armada de radiaciones desde `PISCINA/BM`, abierta y sin
orden— y reproduce celda a celda las cotas, «Comparación n» y «Comparación al
anterior» de los 16 puntos. La visita 12 de Torre Alameda, con dos armadas por
CP-1, da 99.9984 en BM-1, cierre −1.6 mm y segundo orden, sin compensar.

**La captura por armada de la visita** (`components/settlement/visit-armadas.ts`)
sigue la de la nivelación (Fase 36) sobre las filas por punto, con lo propio de
la visita: la armada sale de un BM del lugar —y abre un tramo— o del punto de
cambio pendiente (`pendingChangePoint`); su V− es opcional; «Terminar armada»
quita sus puntos sin leer (`finishVisitArmada`); el punto repetido se resuelve
quitando una de sus filas, si es una vista a un punto (`dropBookRow`), y la
última armada se puede quitar (`removeLastVisitArmada`). Importar un `.L` o un
CSV da un solo tramo desde el BM de su primera fila (`bookFromLibreta`).

`lib/calculations/settlement-summary.ts` resume el histórico para los KPIs del
panel y de la visita (extremos con signo, promedio, mayor movimiento,
velocidad y alertas) y `nextAccumulatedThreshold` da la nota del historial del
punto. La «velocidad reciente» del prototipo dividía entre «un mes» el cambio
de cuatro visitas —el error del marco teórico que encontró la Fase 5—; se usa
la velocidad del motor. Su «diferencial máximo» no está: la Fase 18 lo cambió
por la peor distorsión angular, y la Fase 29 quitó la distorsión con las
coordenadas. El panel del lugar tiene cinco KPIs.

`lib/demo/libreta-asentamientos.ts` (`generateVisitBook`) construye una
libreta **hacia atrás** desde una serie: elige las intermedias para que la cota
compensada sea la de la serie (la compensación de una intermedia es −E·d/D con
d la distancia acumulada de su armada). El seed y el demo lo usan. **Sin
compensar (Fase 37)**, cada cota se aparta de la serie en su parte del cierre
—el test lo acota por el cierre de la visita— y una visita fuera de todos los
órdenes da la serie tal cual, sin orden. Torre Central y Edificio Norte, en el
seed, generan su libreta con cierre 0 desde un BM propio de cada lugar (BM-C,
BM-N): su serie diseñada queda exacta.

Las gráficas del panel y de la visita (`components/settlement/charts/`) ponen
el **tiempo real** en el eje X (`timeScale`, `timeTicks` en `chart-scale.ts`) y
calculan el dominio Y con `lib/design/chart-domain.ts`: 0, los datos y el
siguiente umbral por encima de ellos. El `viewBox` toma el ancho real del
contenedor —la lección del `viewBox` de la Fase 13—, así que el texto no baja
de 11 px en un teléfono.

## 7. Validación

`src/lib/validators/polygonal.ts` implementa la capa de captura (PRD § 5); la
de cierre salió en la Fase 35 (abajo). También son funciones puras.

### Números tecleados (Fase 20)

Toda celda numérica es texto hasta que la lee `lib/utils/parse.ts`:

- `readNumberText` distingue **vacío**, **número** e **inválido**. Acepta signo,
  dígitos y **un** separador decimal, coma o punto (`1,5` = `1.5`), y los
  estados intermedios de quien teclea (`1,`, `,5`). Rechaza separadores de
  miles (`1.234,5` no se adivina), exponentes e `Infinity`.
- `parseNumber` devuelve `null` para vacío **y** para inválido, nunca `NaN`:
  los validadores de captura comparan con `null`, y un `NaN` pasaría por ellos
  sin aviso (ya lo advertía `validators/settlement-book.ts`).
- Lo inválido lo marca la **celda**, no el validador: `NumberInput` muestra «No
  es un número.» en lugar del error que el validador daría a una celda vacía.
  El guardado se bloqueaba con `InvalidNumbersContext` en los editores que
  guardaban con un botón —el último, el de la visita, salió en la Fase 37—, y
  se bloquea con `setCustomValidity` en los `<form>` (altas, catálogo, lugar);
  los popups de las Fases 35 a 37 leen su formulario y devuelven el error del
  campo antes de guardar. Sin ese bloqueo, un texto inválido en una celda
  opcional —un hilo— se perdería.
- En el servidor, las coordenadas del proyecto y los puntos de referencia (que
  llegan por `FormData`) usan el mismo analizador.
- **Nada convierte texto con `Number()`**: `Number("1000,5")` es `NaN`. La
  migración encontró cinco sitios así (azimut al amarre y al reasignar,
  distancia desde los hilos, catálogo de puntos, cota del BM) y los umbrales
  del lugar, que guardaban números en el estado y borraban el separador al
  teclearlo; cada umbral guarda ahora su texto. La auditoría del cálculo
  encontró dos más, arreglados en la Fase 26 (C-5): las lecturas de ángulo del
  editor (`readingValues`) y la vista en grados decimales
  (`dmsFieldsToDecimal`). Una lectura con «12,5″» se perdía del promedio.

### Capa 1 — captura

`validatePolygonalStation(station, expect)` valida una estación. `expect`
(`expectStationCapture`) indica qué celdas son obligatorias según el tipo de
poligonal y la posición de la estación. Desde la Fase 35 cada popup guarda, así
que la captura parcial es legítima: en una cerrada la última estación no exige
nada salvo con fila de cierre —es el punto pendiente, el ángulo del vértice de
arranque o el lado que vuelve a P1— y, sin amarre, P1 no exige ángulo: se mide
al cerrar. El servidor valida con `stationCaptureIssues`, que toma como ángulo
de la estación el **promedio de sus lecturas**: la carga de la pantalla por
pasos solo manda las lecturas. El popup valida lo mismo antes de guardar, y el
error se queda en él. La cabecera la revisa `polygonalHeaderProblem`: título,
estación de partida si hay mediciones, y un Norte y un Este finitos.

| Regla | Resultado |
|---|---|
| Distancia ≤ 0 o > 1000 m | Error, bloquea |
| Distancia obligatoria ausente | Error, bloquea |
| Minutos o segundos fuera de 0-59 | Error, bloquea |
| Una lectura con grados fuera de 0-359 (salvo 360°00′00″ exacto), minutos o segundos fuera de 0-59, o grados y minutos con decimales (`readingDmsError`, Fase 24) | Error, bloquea: «Lectura N: …» |
| Ángulo obligatorio incompleto | Error, bloquea |
| Ángulo de 0° o 360° exacto | Advertencia, no bloquea |

La regla de las lecturas existe aparte porque el ángulo de la estación es el
**promedio**, que llega normalizado: una lectura de 65″ se promediaba como
1′05″ y la regla de 0-59 nunca la veía. El popup y la Server Action pasan las
lecturas crudas al mismo validador.

### El equipo del catálogo (Fase 25)

`validateEquipmentItem` (`validators/equipment.ts`) valida un equipo antes de
guardarlo en el catálogo, en la página y en las Server Actions: marca o
modelo; calibración válida y no futura; precisiones positivas —o no negativas
los dos términos de distancia— que quepan en su columna. Solo mira los campos
de su tipo. `calibrationOverdue` dice si una calibración tiene más de
`CALIBRATION_MAX_MONTHS` a una fecha de referencia. Avisa, no bloquea. Desde
que la poligonal (Fase 35), la nivelación (Fase 36) y la visita (Fase 37) solo
piden la identidad del equipo —marca, modelo y serie—, el aviso queda en la
página del catálogo, contra la fecha de hoy. El equipo que se teclea en un
proceso sigue sin validarse (fuera del alcance de la fase).

### Capa 2 — cierre

La poligonal no tiene capa de cierre desde la Fase 35: no se cierra, y lo que
decía `evaluatePolygonalClosure` —qué orden cumple— lo dice ahora el orden
detectado (§ 6). Hasta entonces, un error angular fuera de tolerancia
bloqueaba el cierre y una precisión relativa insuficiente lo dejaba solo como
rechazado.

**La nivelación tampoco tiene capa de cierre desde la Fase 36**: no se
cierra, y lo que decían `evaluateLevelingClosure` y `levelingProcessVerdict`
—si cumple el orden declarado— lo dice el orden detectado (§ 6). Se retiraron
con sus pruebas. `meets_tolerance` guarda si alcanza algún orden, y
`discrepancy_tolerance_mm` y `meets_discrepancy`, la discrepancia al orden
alcanzado con cualquier tipo que tenga vuelta.

**Una lectura de mira fuera de 0 a 4 m avisa, no bloquea (Fase 42).** Hasta
entonces era un error de captura (PRD § 5.1). El recorrido real del manual lo
destapó: la cartera de asentamientos tiene lecturas de hasta 4.120 m (mira de
5 m), y la demo solo las tenía porque las inserta sin pasar por el validador.
`readingRangeWarning` (`validators/leveling.ts`) da el aviso, que comparten la
nivelación y la visita, y `readingWarnings` (`components/leveling/armada-form.ts`)
lo muestra en vivo en los dos popups de armada. Una mira invertida da
negativo: también avisa.

**La visita tampoco tiene capa de cierre desde la Fase 37**: ya nada se
cierra. Hasta entonces quedaba de aquella capa lo que usaba la visita: un
**punto de cambio incompleto** —con V+ y sin V−, o al revés, fuera de la
primera y la última fila— bloqueaba su cierre con un mensaje que nombraba la
fila y el recorrido (`turningPointBlocker`, Fase 24, que se quedó sin
llamadores: § 11), y la **comprobación aritmética** (Fase 26, C-12) también.
Desde la Fase 37 un punto de cambio incompleto deja sin cota lo que sigue en
su tramo (§ 6), y la libreta se guarda igual, en medición. En la captura de la
nivelación el punto de cambio incompleto es solo un aviso
(`validateRunCapture`). Una distancia por visual en cero o negativa es error
de captura (Fase 26, C-11) y un CHECK la rechaza en la base. La captura por
armada de la nivelación escribe las dos lecturas de cada punto de cambio, y su
popup valida la armada escrita (`armadaProblem`) con el mismo
`validateRunCapture`, con `allowUnfinished`: la libreta puede ir a medias.

### `validators/settlement.ts` — la capa estadística no bloquea

Dos capas desde la Fase 37 —captura y estadística—, con una diferencia
deliberada frente a poligonal y nivelación: la capa estadística (semáforo,
tendencia) **nunca bloquea nada**.

- **Captura** — cota vacía o no numérica: error. Cota que se aleja más de 1 m
  de C0: advertencia, no error (podría ser un terraplén real sobre turba; el
  error de transcripción es la lectura más probable, pero no la única). La
  fecha de la visita tiene que quedar **entre** la de su visita anterior y la
  de su siguiente, por número (`neighborVisitDates`, Fase 26, C-16): antes o
  igual a la anterior invertiría o anularía el intervalo, y después de la
  siguiente reordenaría la serie y cambiaría el parcial de las demás. Un
  índice único `(site_id, date)` lo garantiza en la base. Punto duplicado o
  fantasma en la misma visita: error.
- **Cierre** (hasta la Fase 37) — `validateVisitClose` exigía lectura de todos
  los puntos **vigentes** en la fecha de la visita, y no la cerraba si seguía
  **abierta una visita anterior** contra cuyas lecturas se calcula (Fase 26,
  C-15; para un punto sin C0, la de su línea base, Fase 11). Salió con el
  cierre: un punto vigente sin leer es ahora un punto por leer, y la visita
  queda en medición.
- **Estadística** — clasifica el semáforo, pero **no participa en si se
  puede guardar**. Un punto en alarma se guarda con normalidad: es el hallazgo
  que el monitoreo existe para documentar, no un error de captura. Las Server
  Actions solo invocan `validateVisitCapture` y `validateBook`, y ninguna
  consulta `alert_status`; el test explícito («NO bloquea el cierre por un
  asentamiento en alarma») salió con `validateVisitClose`. El aviso de lectura
  fuera de tendencia (Fase 12) sigue la misma regla: se muestra en la libreta,
  los resultados, el panel y el informe, pero no bloquea nada.

---

### `validators/settlement-book.ts` — la libreta de la visita (Fases 18 y 37)

`validateBook(filas, bms)` (Fase 37) pasa cada fila por las reglas de captura
de la nivelación (`validateReadingCapture`) y añade lo propio de la visita:

- **Cada tramo arranca en un BM del lugar**: la primera fila y cada una con
  `startsSection` deben estar en `site_benchmarks`; si no, «La armada N sale
  de …, que no está en los BM del lugar».
- **La distancia es opcional** (alcance D del PRD): sin ella el tramo no
  acumula y queda sin orden, pero la cota de cada punto no cambia; la cartera
  real no la trae. Una distancia tecleada sigue sin poder ser cero ni
  negativa. La primera versión de la fase la exigía en cada V+ y V− —heredada
  de la nivelación— y rechazaba la cartera: se corrigió con su prueba.
- **Lo que falta por leer no es error**: la visita se guarda en medición.
- Un valor que no es número es error de la libreta entera.

`saveVisitAction` lo aplica antes de calcular y, con el registro
(`visitRecordOf`), rechaza el **punto de control repetido** devolviendo
`duplicate` —su código y sus dos filas— para que el popup de la armada muestre
las dos lecturas con su cota y pregunte cuál se elimina (decisión 10). El
**punto auxiliar** no es error: al terminar una armada con V− en uno, el popup
pregunta si pasa a los BM del lugar con su cota medida (decisión 11;
«Solo en esta visita» o «Guardar en los BM», con `saveBenchmarkAction`). La
**tolerancia no bloquea**: un tramo fuera de todos los órdenes se guarda «sin
verificación». **Hasta la Fase 37** `validateVisitBook` exigía que la libreta
empezara y terminara en el amarre, con su código y su cota, y
`validateVisitClose` bloqueaba el cierre si fallaba la comprobación
aritmética. Todo se revalida en el servidor.

## 8. Sistema de diseño

`src/components/design-system/` — componentes propios sobre Tailwind v4. **No
usar shadcn/ui ni librerías de componentes o iconos.** Los SVG se escriben a
mano, inline.

`ActionBar` · `Alert` · `Badge` · `Breadcrumbs` · `Button` · `Card` ·
`DmsInput` · `Drawer` · `EmptyState` · `Input` · `KpiCard` · `Logo` · `Modal` ·
`NumberInput` · `PageHeader` · `Select` · `Skeleton` · `StatusIndicator` ·
`Tabs` · `Textarea` · `ThemeSelect`, más `LevelFieldset`/`TotalStationFieldset`
y `PrecisionOrderSelect`.

### La barra superior (Fase 33)

Las pantallas autenticadas comparten una barra fija (`components/navigation/
app-bar.tsx`, que monta el layout de `(app)`): `sticky`, de `--barra-alto` (48
px, con el borde dentro) y a todo el ancho de la ventana. El fondo es la
tarjeta al 90 % con desenfoque: al 85 %, el texto secundario bajaba de 4.5:1
con contenido oscuro pasando por debajo.

- **A la izquierda**, el logo, que lleva al dashboard: el isotipo por debajo de
  640 px y el logo completo desde ahí.
- **A la derecha**, `AppBarLink` para Equipos y Manual: icono en SVG en línea
  (no hay librería de iconos) y nombre desde 640 px. El nombre sigue siendo el
  accesible en el teléfono (`sr-only sm:not-sr-only`). La sección actual lleva
  `aria-current="page"` y la raya `mira-strong` de las pestañas.
- **El menú de cuenta** (`AccountMenu`): un botón con la inicial del correo
  abre un panel con el correo, el tema (`ThemeSelect variant="buttons"`) y
  «Cerrar sesión». Usa el atributo `popover` de HTML: abre y cierra sin
  JavaScript propio, se cierra al tocar fuera o con Esc y va en la capa
  superior. Se coloca con CSS bajo la barra, porque el botón siempre está
  arriba a la derecha. `signOut` llega como prop desde el layout.
- **La ruta.** `Breadcrumbs` la pinta cada página en el servidor, porque solo
  ella conoce los nombres, y el CSS la coloca sobre la barra: `fixed`, arriba,
  en el hueco que marcan `--ruta-inicio` y `--ruta-fin` (`globals.css`,
  medidos en pantalla, uno por tamaño). Sin JavaScript, sin parpadeo y sin
  salto. Fuera del flujo, no ocupa fila: el título de una página empieza a 72
  px, frente a los 129 y 133 de antes. Se descartaron un portal de React y un
  contexto (en el servidor no se pintan: las migas saltarían al hidratar), las
  migas desde `usePathname` (ids, no nombres) y las rutas paralelas (duplican
  rutas y consultas).
- **En el teléfono**, el «‹ nivel anterior» lleva `min-w-0`: sin él, un nombre
  de más de unos 30 caracteres salía del hueco, y como la ruta va por encima
  de la barra, tapaba Equipos, Manual y la cuenta y se quedaba sus toques.
- **`Modal` y `Drawer` se pintan en un portal sobre `<body>`.** Un antecesor
  con su propio contexto de apilamiento —la barra de acciones, `sticky z-20`,
  donde vivía el diálogo «Cerrar proceso» hasta las Fases 35 a 37— dejaba su `z-50` por debajo de la
  barra (`z-40`) y de la ruta (`z-45`).
- **Todo `Modal` limita su alto** (`100dvh − 2rem`) y desplaza el cuerpo, con
  la cabecera y el pie a la vista; `size` solo cambia el ancho. Hasta las
  correcciones de la Fase 35 solo lo hacía el grande: el alta de la poligonal
  con el equipo desplegado (778 px) se salía de una pantalla de 600 px por
  arriba y por abajo, sin desplazar, y «Crear y empezar» quedaba fuera.
- **`fullOnPhone`** (Fase 37): por debajo de 640 px el `Modal` ocupa la
  pantalla (`h-dvh`, sin borde ni márgenes), con el cuerpo que se desplaza y el
  pie fijo abajo; desde `sm`, como «lg». Lo usa el popup de la armada de la
  visita, que se captura en campo con el teléfono.
- **Detalles:** `scroll-padding-top` evita que la barra tape las anclas, y al
  imprimir `globals.css` oculta todo `header` y `nav`. Con el teclado, el foco
  recorre la barra antes que la ruta, que en el documento va con la página.

### La pantalla de un proceso (Fases 22 y 35 a 37)

**Desde la Fase 37 los tres módulos usan la pantalla por pasos** (abajo). La
estructura de la Fase 22, que el control de asentamientos conservó hasta
entonces, se retiró con su editor: `components/process/process-shell.tsx`
armaba la cabecera (`PageHeader`: migas, título, badge de estado, subtítulo)
con las acciones fijas —Exportar a Excel y «Ver informe»— y las pestañas
(`Tabs`, enlaces con `?tab=`), y dentro del editor iban:

- **`ActionBar`** al pie, `sticky`, con el estado («Cambios sin guardar», el
  motivo que impide guardar) y Guardar / Cerrar; no se imprimía.
- **`UnsavedChangesGuard`** (`components/navigation/unsaved-changes.tsx`,
  borrado en la Fase 37 con su prueba) con el `dirty` del editor:
  `beforeunload` para recargar o cerrar la pestaña, y un `Modal` al pulsar un
  enlace interno. Interceptaba el clic en fase de captura en `document`, antes
  del manejador de `next/link`, y dejaba pasar las descargas, las pestañas
  nuevas, los externos y las anclas. Los botones atrás y adelante del
  navegador no pasaban por ella (el App Router no ofrece cómo detenerlos).

Cada popup guarda, así que la guarda de cambios sin guardar se borró al
quedarse sin usuarios —el formulario del lugar y el editor de la visita—, y
`ActionBar` sigue en el sistema de diseño, con su prueba, sin que ninguna
pantalla lo monte (§ 11).
`ProcessReport` no va al sistema de diseño: conoce el dominio (§ 8,
«componentes del dominio»). `PageHeader`, `ActionBar` y `Skeleton` sí, porque
son genéricos. Los tonos de estado de los badges viven en
`lib/process-status.ts`, una sola copia.

**Lo común de la pantalla por pasos (Fase 36, decisión 15).** La cabecera en
tarjeta (`ProcessHeader`), la barra de pasos (`ProcessSteps`, con lo propio de
cada módulo a la derecha) y el borrador que se guarda entero desde cada popup
(`useProcessDraft(updatedAt, base, persist)`) salieron de la poligonal a
`components/process/`, y los usan la poligonal, la nivelación y, desde la Fase
37, el lugar y la visita. `useProcessDraft<D, X, R>` es genérico en lo que un
guardado lleva además del borrador (`X`: los puntos del amarre de la
poligonal) y en la respuesta, que llega entera a quien guarda (`R`: la visita
trae `duplicate`). `ProcessHeader` admite una acción propia, la primera
(`primaryAction`: «+ Nueva visita» del lugar). **Desde la Fase 38 exporta solo
en la página de informe**: con `printable` —el paso o la pestaña Informe—
muestra primero «Exportar PDF» (`PrintButton`) y «Exportar Excel» (el enlace a
`exportHref`, la ruta `export/` del módulo); los demás pasos no muestran
ninguno de los dos. Hasta entonces «Exportar a Excel» estaba en todos los
pasos, y eliminar un proceso avisaba de los informes consolidados que lo
incluían (`reportTitles`, `deletionReportsNotice`), un aviso que salió con
ellos.

**La poligonal por pasos (Fase 35).** `polygonal/[pid]/page.tsx` monta
`PolygonalHeader` (cabecera en tarjeta: badges de tipo, estado y orden
detectado —`detectedOrderOf`—, título, ubicación, responsable, equipo,
«Guardado» con `formatSavedAt`, Editar datos, en el paso Informe Exportar PDF
y Exportar Excel (Fase 38), y Duplicar / Eliminar), `PolygonalSteps` (1 ·
Datos, 2 · Ajuste, 3 · Informe en `?tab=`, y el selector DMS / decimal) y el
paso: `DatosTab`, `AjusteTab` o
`ProcessReport`. No hay `ActionBar` ni guarda de cambios sin guardar: **cada
popup guarda** con la carga completa (`payloadOf`) y la acción revalida la
página. Las piezas:

- `use-polygonal-draft.ts`: el borrador (`draftOf`) con lo último guardado
  desde la página hasta que el servidor devuelve la nueva (`updated_at`
  cambia), para que una medición encadenada no parta de un borrador viejo; y
  el cálculo en vivo (`usePolygonalComputation`).
- `capture-edits.ts` (puro, con pruebas): cómo cambia el borrador con cada
  popup —medir y seguir, cerrar o llegar, el cierre angular de cada esquema,
  editar, eliminar una intermedia y deshacer—.
- `capture-rows.ts` (puro): las filas «desde → hacia» con su rol (0 atrás,
  lado, cierre, cierre angular, pendiente, llegada) y `fieldTraverse`, lo
  medido sin ajustar para el dibujo de Datos (`PolygonalPlot` en modo
  `field`).
- `amarre-dialog.tsx` con `resolveCatalogPoint` y `planCatalogWrites`
  (`lib/polygonal-amarre.ts`): los puntos del amarre al catálogo, que viajan
  con el guardado (`catalogPoints`) y se escriben con el proceso en
  `save_polygonal_process`, en la misma transacción. La acción comprueba que
  coinciden con el amarre de la carga (`catalogPointsProblem`), decide qué
  fila se crea o se corrige y saca el azimut de las coordenadas nuevas de la
  referencia. Una referencia nueva lleva desde el popup el id con que se crea
  —si es un UUID libre; si no, la acción da otro—: un guardado encadenado
  antes de que llegue la página no la suelta. Uno que ya
  existe con otras coordenadas toma las tecleadas (`move`): así se corrige el
  amarre sin rehacer la poligonal. Hasta las correcciones de la Fase 35 era un
  conflicto, y el primer guardado del amarre ya mete sus puntos al catálogo:
  corregir una coordenada no se podía. Solo se mueve un punto que el usuario
  **editó** en el popup: la partida y la llegada se abren con la copia del
  proceso, que puede diferir del catálogo si este se corrigió después o si la
  poligonal se georreferenció, y guardar sin tocarlas no devuelve el catálogo
  a lo viejo. Antes de guardar, `catalogMoves` dice en el popup qué puntos
  cambian y qué otras poligonales los usan —de partida, de llegada o de
  referencia; la página las carga solo en Datos (`getPolygonalAmarres`)—, y
  dos puntos del amarre con el mismo nombre y otras coordenadas se rechazan
  (`repeatedPointName`, con el mismo medio milímetro). Guarda el código de la
  referencia junto a su id: si el punto se borra del catálogo (la FK pasa a
  `null`), la poligonal sigue orientada. Con mediciones, no deja poner ni
  quitar el 0 atrás (`amarreChangeProblem`): cambiaría lo que significa el
  primer ángulo.
- Cada llamada a una acción va por `callAction` (`lib/errors/action-call.ts`):
  un rechazo de red o un 500 vuelve como error al popup, que conserva lo
  tecleado, en vez de llegar al límite de error y reemplazar la página. Deja
  pasar las señales de navegación de Next.
- `measurement-dialog.tsx`, `measurements-table.tsx`,
  `angular-closure-summary.tsx`, `adjusted-table.tsx` (con `adjustedRows`),
  `order-verdict.tsx` (con `orderChecks`), `least-squares-panel.tsx` y
  `angle-format.ts`.

**La nivelación por pasos (Fase 36).** `leveling/[pid]/page.tsx` monta
`LevelingHeader` (tipo, estado y orden detectado; Editar datos con el popup
del alta, en el paso Informe Exportar PDF y Exportar Excel, Duplicar /
Eliminar; sin cerrar ni reabrir),
`LevelingSteps` (1 · Libreta, 2 · Compensación, 3 · Informe, e «Importar .L o
CSV», que guarda al aceptar) y el paso: `LibretaTab`, `CompensacionTab` o
`ProcessReport`. Como en la poligonal, **cada popup guarda** con la carga
completa (`levelingPayloadOf`) y no hay `ActionBar`. Las piezas:

- `leveling-save.ts` (puro): el borrador (`levelingDraftOf`), la carga, la
  entrada del motor (`levelingInputOf`), `draftWithImport`, `draftWithBm`
  —cambiar el código del BM cambia los extremos de la libreta que lo llevan—,
  `returnStartCode` y `runRowsOf`.
- `armadas.ts` (puro): las armadas de un recorrido (§ 6), `nextArmadaIndex` y
  `runEnded`. `armada-form.ts` (puro): del formulario a la armada, los hilos
  con la comprobación del medio, la casilla de fin según el tipo
  (`armadaEnd`) y los errores de la libreta en la vista que los tiene
  (`armadaProblem`).
- `libreta-rows.ts` (puro): la tabla de la hoja (`sheetRows`), la lista por
  armada del teléfono (`armadaSummaries`), la comprobación aritmética y las
  lecturas a 3 o 4 decimales por libreta (`readingDecimals`).
- `profile-data.ts` (puro): el perfil con las miras, la visual a la altura del
  instrumento y la contraparte escalada, siempre en el sentido de la ida.
- `comparison-data.ts` (puro): la tabla de la compensación
  (`compensationRows`, con el emparejamiento ida-vuelta por código), el
  gráfico ×1000 (`comparisonData`, con las cifras de los extremos) y las
  lecturas de cada punto (`pointReadings`). `order-verdict.tsx`, con
  `levelingOrderChecks`.
- Los componentes: `bm-card.tsx`, `bm-dialog.tsx`, `libreta-table.tsx`,
  `armada-dialog.tsx`, `leveling-profile.tsx`, `arithmetic-check.tsx`,
  `adjusted-table.tsx`, `comparison-chart.tsx` —el mismo en la pestaña y en el
  informe— y `leveling-details-dialog.tsx`, el popup del alta y de Editar
  datos.

**El lugar y la visita por pasos (Fase 37).** Sin estado ni cierre, sin
`ActionBar` ni guarda de cambios: cada popup guarda.

- **El lugar** (`settlement/[siteId]/page.tsx`): `SiteHeader` —`ProcessHeader`
  con «+ Nueva visita» como `primaryAction`, el resumen de puntos, BM y fecha
  base, y «Editar datos» con el popup del alta (`SiteDialog`, con
  `site-dialog-form.ts`: nombre, tipo, descripción y los umbrales plegados,
  precargados por el tipo en el evento y no en un efecto)— y las pestañas
  Panel · Puntos · BMs · Informe. El panel (`SitePanel`) es la franja de cinco
  indicadores, la tabla de visitas (`VisitsTable`) y, fija al lado en la
  rejilla de la libreta de la nivelación (`lg:grid-cols-[3fr_2fr]`), la
  tendencia «Promedio | Por punto» con la visita elegida resaltada, y los
  avisos. La pestaña BMs (`BenchmarksPanel`) lleva la tabla —código, cota,
  descripción, origen y en cuántas visitas arranca un tramo—, el popup del BM y
  un solo «Importar BM» con «De una nivelación | De un CSV». La pestaña «lugar»
  de las URL viejas abre Puntos.
- **La visita** (`visits/[visitId]/page.tsx`): `VisitHeader` (armadas,
  verificación, «En medición», nivelador y equipo; ← →, «Editar datos» con el
  popup del alta, `VisitDialog`, y eliminar), `ProcessSteps` con 1 · Libreta y
  2 · Resultados e «Importar .L o CSV» a la derecha (`VisitImportButton`, un
  diálogo propio: el de la nivelación propone tipo e ida y vuelta, que la
  visita no tiene; reutiliza `RunPreview` y `TemplateLink`).
- **Paso 1 · Libreta** (`VisitLibretaTab`): la `LibretaTable` de la nivelación,
  que desde la Fase 37 acepta los rótulos de la visita (`visitSheetRows`:
  arranque, BM leído de paso, punto de cambio, cierre y «pendiente», que no
  resalta la fila); al lado, las armadas (`armadaItems`), la verificación de
  cada tramo (`tramoItems`) y el movimiento de cada punto desde la visita
  anterior con el aviso de tendencia (`pointMovements`), todo en
  `visit-libreta-rows.ts`. Con algo pendiente, «La medición quedó a medias» y
  «Retomar medición», que abre la armada en su primera lectura sin tomar
  (`resumeOf`). En el teléfono la tarjeta de armadas se oculta: la libreta ya
  es esa lista.
- **El popup de la armada** (`VisitArmadaDialog`, con `visit-armada-form.ts`):
  «Desde» —un BM del lugar o el punto de cambio—, la V+ con la distancia
  opcional (`VisualFields` de la nivelación, `optionalDistance`), las vistas a
  los puntos precargadas, cada una con su cota, y la V− opcional («Sin vista
  adelante»), con el cierre del tramo en vivo si cae en un BM. **Guarda lectura
  por lectura**: Enter, o salir de un campo, compone la libreta entera y la
  encola (`useProcessDraft`, `callAction`). Los guardados van en fila, uno
  tras otro, y se saltan si la libreta no cambió —abrir y cerrar una armada
  sin teclear nada no guarda—; un fallo deja lo escrito en el popup y se
  reintenta con la lectura siguiente. Al guardar, el punto repetido abre la
  elección de cuál eliminar y el auxiliar, la pregunta de si pasa a los BM. En
  el teléfono va a pantalla completa con el pie fijo: `Modal` ganó
  `fullOnPhone` (abajo).
- **Paso 2 · Resultados** (`VisitResultsTab`, con `visitResultsOf`): la franja
  de indicadores, la nota de la visita y, por punto, cota, parcial, acumulado,
  velocidad, estado y tendencia, con el gráfico «Acumulado | Desde la
  anterior» al lado.

El hub del proyecto usa **un solo patrón de lista para los tres módulos**
(`components/projects/process-table.tsx` + `hub-rows.tsx`): cada módulo arma
sus filas en el servidor —tipo, estado, resultado, veredicto y la métrica por
la que se ordena— y la tabla, sus tarjetas de móvil y las acciones por fila
(`process-row-actions.tsx`) son las mismas. La barra de filtros guarda el
último filtro por proyecto **y módulo**. Desde la Fase 37 el lugar no tiene
estado: su fila no lleva badge, sus chips de filtro salen y la columna Estado
se oculta si ninguna fila la tiene. Desde la Fase 38 el hub tiene dos
pestañas, Procesos y Configuración: la de Informes salió con los consolidados,
y `?tab=reports` abre Procesos.

### Contrato de tokens

Desde la Fase 20 los tokens son **por rol**, con la identidad del prototipo de
asentamientos (`docs/prototipos/`): papel/tinta y el acento amarillo «mira».
Las escalas `primary` y `neutral` se retiraron, y también la paleta por
defecto de Tailwind (`--color-*: initial`): en la app solo existen estos
tokens, el semáforo y el negro del velo de los diálogos.

| Token | Rol | Uso válido |
|---|---|---|
| `paper` | Fondo de página | Solo fondo, con la retícula del `body`. |
| `card` | Superficie | Tarjetas, tablas, modales, campos. |
| `sel` | Selección y resalte | Fila seleccionada o con hover, `Badge` neutro, `Alert` informativo. |
| `ink` · `ink-2` · `ink-3` | Tinta | Texto principal, secundario y terciario; los tres cumplen 4.5:1 sobre `card` y `paper`. |
| `rule` | Separador | Decorativo: bordes de tarjeta, divisiones de tabla. **Nunca** límite de un control. |
| `rule-strong` | Borde de control | Límite de Input/Select/Textarea/DmsInput: 3:1. |
| `mira` + `on-mira` | Acción principal | Botón primario, chip activo: relleno amarillo con texto oscuro. |
| `mira-strong` | Acento gráfico | Foco, pestaña activa, filete de selección, isotipo: 3:1. El amarillo no llega en claro (2.06:1). |
| `mira-bg` + `mira-ink` | Tinte del acento | `Badge` «primary», notas del manual, texto de acento. |
| `success` · `warning` · `danger` y su `-bg` | Estado | Texto sobre `card` y sobre su propio tinte; punto de estado. |
| `on-danger` | Texto sobre `danger` | Botón de peligro: blanco en claro, oscuro en oscuro (el blanco daba 2.85). |
| `semaphore-*` | Semáforo de 4 niveles | Un solo valor: cumple 3:1 en los dos temas. |

Cada token lleva su valor claro y oscuro en un `light-dark()` (ver «Tema claro
y oscuro»). Los valores parten del prototipo; los seis que no llegaban a su
umbral se ajustaron conservando el tono. La tabla completa, con los valores
originales, está en `docs/prds/19-identidad-visual-coma-decimal.md`.

`--font-display` (Barlow Semi Condensed) para títulos, `--font-sans` (Barlow)
para el cuerpo y `--font-mono` para datos numéricos.

### Los contextos de contraste

Un color se usa de varias maneras, y **cumplir en una no implica cumplir en
las otras** — ni en un tema implica cumplir en el otro:

1. **Texto sobre superficie** (`card`, `paper`, `sel`) — 4.5:1.
2. **Texto sobre su propio tinte** (`success` sobre `success-bg`…) — 4.5:1.
   *Es el contexto que falló antes de la Fase 5 y que ninguna revisión manual
   medía.*
3. **Texto sobre un relleno** (`on-mira` sobre `mira`, `on-danger` sobre
   `danger`) — 4.5:1.
4. **Elemento gráfico** (punto, borde de control, foco) — 3:1.

Los estados usan tintes explícitos (`-bg`) y no transparencias: una
transparencia crea un contexto nuevo que habría que declarar y medir en cada
tema. `/15` sobrevive solo en rellenos decorativos de las gráficas.

**Excepción de WCAG 1.4.3:** los componentes de interfaz inactivos no tienen
requisito de contraste. El botón deshabilitado (`ink-3` sobre `rule`) se mide
como dato informativo.

### Cómo se verifica el contraste

`src/lib/design/contrast.ts` son funciones puras: hex → RGB, luminancia, razón,
`composite()` para resolver un tinte y `parseThemeTokens()`, que lee los dos
temas de `globals.css`. `src/lib/design/pairings.ts` declara las parejas que el
sistema usa de verdad, una sola vez para los dos temas.

**Es un test** (Fase 20): `pairings.test.ts` lee el `globals.css` real y exige
que todas las parejas cumplan en claro y en oscuro, y que todos sus tokens
existan. Hasta la Fase 20 el paso era abrir `/design-system`, porque se creyó
que un test exigiría jsdom; no hace falta, `fs` basta en el entorno `node`. Y
`tokens-retirados.test.ts` recorre `src/` y falla si una clase o un `var()`
usa una escala retirada o la paleta de Tailwind: al escribirlo encontró un
`border-t-neutral-200` que la migración había dejado.

La ruta `/design-system` sigue midiendo y mostrando las parejas, ahora por
tema. Es herramienta de desarrollo: devuelve 404 en producción y hace falta
sesión para abrirla.

**Al añadir un color o una pareja nueva** se declara en `pairings.ts`; `npm
test` dice si cumple en los dos temas.

### Tema claro y oscuro

- **Mecanismo.** Cada token es `light-dark(claro, oscuro)` y el tema lo decide
  `color-scheme`: `light dark` en `:root` (sigue al sistema), `light` o `dark`
  con `data-theme` dentro de `@media screen`, y `light` en `@media print`: el
  informe impreso sale siempre en claro. Un solo bloque de tokens y ni un
  `dark:` en los componentes.
- **Lightning CSS** (el compilador de CSS de Next) transpila `light-dark()` a un
  polyfill con `--lightningcss-light/-dark` que sigue a `color-scheme`. Se
  verificó en el navegador: sistema claro y oscuro, cada tema forzado contra el
  sistema contrario, e impresión con el oscuro forzado.
- **`@theme static`.** Tailwind v4 solo emite las variables que usa alguna
  utilidad, y estas también se leen con `var(--color-…)` en línea (muestras de
  `/design-system`, colores de las series, SVG del dibujo de la poligonal).
- **Selector.** `ThemeSelect` (Sistema / Claro / Oscuro) tiene dos formas. En
  las páginas de acceso, un icono con un `<select>` nativo transparente
  encima, porque en 390 px no cabe uno visible. En el menú de cuenta de la
  barra (Fase 33), `variant="buttons"`: tres botones visibles con su nombre. Escribe la cookie
  `topofield-theme` (un año, `SameSite=Lax`; «Sistema» la borra) y aplica el
  tema al instante sobre `<html>`.
- **Sin parpadeo.** El layout raíz lee la cookie con `cookies()` (`lib/theme-
  server.ts`) y pone `data-theme` en `<html>`: la página llega pintada con el
  tema elegido, sin script en línea. Precio: ya no quedan rutas estáticas (ver
  § 5, cabeceras de seguridad).
- **Casillas y radios** toman `accent-color: mira-strong` en `@layer base`.

### Qué entra en el sistema de diseño

**Un componente pertenece al sistema de diseño si no conoce el dominio de
TopoField.** Recibe cadenas, `href`s y uniones definidas en su propio archivo.
No importa nada de `@/types/*` ni del dominio en `@/lib/*`; sí utilidades
genéricas: `cn`, el analizador de números (`lib/utils/parse`, que usan
`NumberInput` y `DmsInput`) y la cookie de tema (`lib/theme`, en
`ThemeSelect`).

Excepciones conocidas, anteriores a la Fase 20 y comprobadas al revisarla:
`PrecisionOrderSelect` importa las tolerancias y los tipos del proyecto, los
`…Fieldset` de equipo (Fase 8) los tipos —las tolerancias, solo hasta que la
Fase 31 quitó el aviso de equipo—, y `StatusIndicator` el tipo de los
niveles del semáforo. `PrecisionOrderSelect` se quedó sin usuarios desde que
el orden se detecta (Fases 35 a 37), y los fieldsets solo los usa el catálogo
de equipos.

El catálogo de equipos (Fase 25) **no** entró en los fieldsets: ganaron solo
dos huecos, `header` y `footer` (el `order` opcional que tenían servía al aviso
de equipo y salió con él en la Fase 31). El selector, el botón
«Guardar en el catálogo», la acción que llama y el aviso de calibración viven
en `components/equipment/`, y el catálogo llega por un contexto que carga el
layout de las pantallas autenticadas. Desde las Fases 35 a 37 los formularios
montan `EquipmentIdentity` (la identidad con «Tomar del catálogo», en la
nivelación y la visita) y `TotalStationIdentity` (la poligonal, sin
catálogo); `TotalStationEquipment` y `LevelEquipment` siguen exportados, sin
usuarios.

Es un criterio verificable leyendo los imports, y explica la separación que ya
existe: `Breadcrumbs` recibe `{ label, href }[]` y sirve a cualquier jerarquía;
`ProcessTable` importa los filtros del hub (`lib/process-list`) y los tonos de
estado (`lib/process-status`).

Consecuencia para los módulos nuevos: la tabla de nivelación **no** va al
sistema de diseño. Si comparte estructura con la de poligonales, lo que se
extrae es el patrón, no un componente genérico parametrizado.

### Patrones canónicos

**Filtro excluyente** — `<Link>` + `aria-current`. El filtro es navegación:
debe poder abrirse en pestaña nueva y compartirse. Referencia:
`dashboard-filter.tsx`. Usar `<button>` + `router.push` solo si el control
necesita estado de cliente que un enlace no pueda expresar.

**Foco visible** — un solo sistema: el `outline` `mira-strong` de `@layer
base`, que cubre `a`, `button`, `summary`, `input`, `select` y `textarea` con
`:where()` (especificidad cero). Los componentes **no declaran su propio
`ring`**. Excepción: el icono de `ThemeSelect`, cuyo `<select>` es
transparente, dibuja el foco en su contenedor con `has-[select:focus-visible]`.

**Celda numérica** — `NumberInput` (Fase 20, UI2), nunca `type="number"`, que
rechaza la coma decimal. Es `type="text"` con `inputMode="decimal"` (o
`numeric` con `integer`); acepta coma o punto y, si el texto no es número, se
marca a sí misma con «No es un número.» en lugar del error del validador. Los
editores que guardaban con un botón envolvían su contenido en
`InvalidNumbersContext` (sin usuarios desde la Fase 37, § 11); en un `<form>`,
`setCustomValidity` impide el envío. Ver § 7.

**Enlace dentro de una frase** — `text-ink` subrayado con
`decoration-mira-strong`: con la tinta, el color ya no lo distingue del
texto.

**Estado de carga** — se deshabilita el control y cambia su texto
(«Guardando…»), sin spinner: el cambio de texto lo anuncia el lector de
pantalla, un spinner decorativo no.

**Indicador de estado** — el color nunca es el único canal. `StatusIndicator`
es la referencia: punto `aria-hidden` más etiqueta de texto real, no solo
`aria-label`. Desde la Fase 5 admite dos modos: `status` (3 niveles —
poligonal y nivelación) o `level` (4 niveles — semáforo de asentamientos), y
el tipo obliga a pasar uno u otro, nunca ninguno ni ambos. El modo `status`
ya no lo usa ninguna pantalla —los estados del hub van en `Badge`—; solo
`/design-system`. El semáforo de 4
niveles añade además **forma** como segundo canal gráfico (círculo,
cuadrado, rombo, triángulo): los cuatro tokens de color cumplen 3:1 contra
blanco individualmente, pero medidos entre sí quedan comprimidos en una
banda estrecha de luminancia (verde/rojo 1.03) que ningún cuarteto de colores
alternativo resuelve — es una limitación estructural de intentar 4 niveles
con contraste AA en una sola escala, no una mala elección de hexadecimales.
Ver `docs/prds/04-asentamientos.md`, hallazgo 5 y decisión #9.

**Panel lateral** — `Drawer` (Fase 18): lectura larga que acompaña a una
pantalla sin sustituirla, como lo era el registro de nivelación de una visita
hasta la Fase 37, que lo pasó al paso de Libreta; desde entonces solo lo
muestra `/design-system`. Se cierra con Esc, con «Cerrar» o con el fondo;
lleva el foco al abrir y lo devuelve al cerrar, y mantiene Tab dentro.
Capturar datos no va en un `Drawer`: en tableta resulta estrecho; desde las
Fases 35 a 37 se captura en popups, a pantalla completa en el teléfono.

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

- **Títulos** (`h1`–`h3`): Barlow Semi Condensed en `ink`, aplicado en
  `@layer base`.
- **Cuerpo**: Barlow, con `tabular-nums lining-nums` en el `body`, como el
  prototipo.
- **Datos numéricos**: `font-mono` con `tabular-nums`, para que los dígitos
  alineen en columna.
- **`text-rendering: geometricPrecision`** en el `body`: sin él, Chromium en
  Linux redondea al píxel el avance de los glifos de Barlow y abre huecos
  dentro de las palabras («Client e Demo»). Se vio en las capturas del manual.

> **Toda regla CSS global debe ir dentro de `@layer`.** Una regla fuera de capa
> gana sobre todas las utilidades de Tailwind y las anula en silencio. Ya
> ocurrió una vez en este proyecto: la regla de títulos, fuera de capa,
> sobreescribía cualquier `text-*` explícito sin error visible.

### Fuentes

Barlow (400–700) y Barlow Semi Condensed (500–700) se cargan con
`next/font/google`, que las descarga durante el build y las **autohospeda**.
No hay peticiones a terceros en tiempo de ejecución, y la CSP (`font-src
'self'`) no cambió. El 700 se carga porque la app usa `font-bold`; sin él el
navegador lo sintetizaría.

### Responsive

Punto de corte principal: 768 px. Las tablas densas de escritorio se convierten
en tarjetas por elemento en móvil — el patrón está en
`components/projects/process-table.tsx` (`md:hidden`).
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
>
> **Fase 20.** La identidad del prototipo sustituyó a la paleta azul. Seis de
> sus valores no cumplían: el texto terciario (3.03:1 en claro, 4.04:1 en
> oscuro), el borde de control (1.57 / 1.59), el amarillo como foco (2.06 en
> claro), el éxito sobre su tinte (4.39) y la alerta como texto (3.99) y sobre
> su tinte (3.51). Se ajustaron conservando el tono, y desde entonces lo
> comprueba un test en los dos temas.

---

## 9. Pruebas

1229 tests en 100 archivos, Vitest, entorno `node` **sin jsdom**. Además, 137
pruebas de la base con pgTAP en diez archivos (al final de esta sección).

| Archivo | Tests | Cubre |
|---|---|---|
| `lib/calculations/settlement.test.ts` | 59 | Asentamiento parcial/acumulado, velocidad (intervalos 28/30/31/61/92 días), `classifyAlert`, tendencias, orden cronológico; línea base por primera lectura, `isPointActiveOn` y `pointInputOf` (Fase 11); lectura fuera de tendencia con P-09 y el seed como regresión (Fase 12); «Acelerando» solo por encima del margen (Fase 31) y en su frontera de 6·√3 = 10.39 mm, `accelerationMargin` con intervalos iguales y distintos, y un punto que se salta una visita toma sus tres lecturas (Fase 32); el margen fijo, 6 mm entre dos visitas sin orden ni circuito (Fase 37, que retiró los casos del margen por circuito y `visitCircuitsOf`) |
| `lib/calculations/leveling.test.ts` | 90 | Motor de nivelación: libreta, corrección proporcional, cierre, ida y vuelta; la vuelta de una abierta parte de la cota final de la ida (Fase 16); acumulado desde el origen: el BM de partida no se compensa, circuito del seed en 100.3027 / 99.8053 y un proceso reconstruido conserva su regla (Fase 19); sin distancias en un recorrido, la discrepancia no se evalúa (Fase 23); la vuelta de una cerrada con su propia tolerancia y su comprobación aritmética, un cierre igual a la tolerancia con cualquier cota y el acumulado en milímetros (Fase 26); la vuelta compensada en cerrada y de enlace, la cota adoptada y el ejemplo 1 de `docs/math/nivelacion.html` (Fase 28) |
| `lib/calculations/homologous.test.ts` | 11 | Puntos homólogos ida-vuelta: la columna `P` de El Verjón con `AUX1`/`AUX 1`; los residuos del crudo leído con el importador; sin vuelta, solo con extremos compartidos o con una vuelta que no empieza donde terminó la ida, `null`; filas a medio capturar; códigos repetidos omitidos; de enlace; `samePointCode` (Fase 17) |
| `lib/import/leveling/import.test.ts` | 23 | Importación de libretas: el crudo real de nivel digital leído del repositorio —cabecera, 16 armadas, promedios redondeados, calidad, giro en la armada 9, líneas desconocidas—; un recorrido (cierre −0.4 mm) e ida y vuelta (discrepancia 0.4 mm, C18 = 2542.9181) pasando por `computeLeveling`; plantilla CSV con `;` y coma decimal, radiaciones, vuelta declarada, comillas y un punto de cambio en dos filas; Windows-1252; una sola armada; detector (Fase 16); una distancia en cero o negativa no se importa (Fase 26) |
| `lib/validators/polygonal.test.ts` | 64 | Captura de poligonal, `expectStationCapture`, código de punto obligatorio; pesos del ajuste por mínimos cuadrados: completos, dentro de la columna y a su escala, con cualquier método (Fase 14); puntos de control de la georreferenciación (Fase 15); cada lectura en su rango aunque el promedio salga válido (Fase 24); la fila de cierre y la de orientación en `expectStationCapture`, segundos de dos decimales y distancias de cinco (Fase 26); el azimut desde el punto de amarre y su rechazo (Fase 27); la captura parcial de una cerrada y `stationCaptureIssues`, que valida el promedio de las lecturas, y la cabecera de un guardado hecho a mano (Fase 35); el aviso de pesos nombra los que faltan, y «las veces que se midió cada distancia» (Fase 39) |
| `lib/validators/settlement.test.ts` | 33 | Captura de asentamientos; vigencia, regla de la línea base abierta, baja y alta (Fase 11); qué cuenta como cambiar la C0, a la escala de la base (Fase 23); la fecha entre sus vecinas (Fase 26); el alta en cualquier fecha de calendario (Fase 37, que retiró el cierre, deshacer la baja con visitas cerradas y la alarma que no bloqueaba el cierre); un BM que repite el código de otro del lugar salvo mayúsculas o espacios, y el que se edita no choca consigo mismo (revisión final de la Fase 37) |
| `lib/validators/leveling.test.ts` | 40 | Captura de nivelación: hilos y su hilo medio, distancias por visual —obligatorias en BM y puntos de cambio, en cero o negativas un error (Fase 26)—, una lectura fuera de 0 a 4 m avisa y no bloquea (Fase 42); la V+ del BM inicial y la última fila de un recorrido que cierra, salvo con `allowUnfinished`, la libreta a medias de la nivelación (Fase 36); sin avisos de equilibrado, tampoco con la ida de El Verjón (Fase 36); el punto de cambio incompleto: aviso en la celda, y `turningPointBlocker` con su fila, también en la vuelta (Fase 24) |
| `lib/calculations/polygonal.test.ts` | 48 | Motor de cálculo, los tres tipos y métodos; `polygonalTraces` con el invariante del error de cierre (Fase 13); fila de cierre con el amarre dentro y fuera del barrido, interior y exterior; abiertas amarradas; mínimos cuadrados que antes no convergía o daba «singular» (Fase 26) |
| `lib/calculations/polygonal-detect.test.ts` | 11 | **El orden y el tipo de ángulo detectados** (Fase 35): las fronteras de cada orden, sin verificación y sin alcanzar el ordinario; interior y exterior, con y sin fila de cierre; la TT4 en tercer orden; `observedAzimuths` y `angularConditionCount` |
| `lib/calculations/correction-breakdown.test.ts` | 5 | El desglose de la corrección con la TT4 en los cuatro métodos, contra el motor: factores de Brújula y Tránsito, λ₁ y λ₂ de Crandall que reproducen sus proyecciones, el datum de mínimos cuadrados (Fase 35) |
| `lib/process-list.test.ts` | 27 | Filtrado, orden y conteo del listado (Fase 22); sin los filtros de cerrados ni de lugares activos y cerrados desde la Fase 37 |
| `lib/utils/format.test.ts` | 34 | Fecha relativa, **formateo único de precisión** y mensaje del aviso de lectura fuera de tendencia (Fase 12); fecha corta con meses fijos, mm con signo y cierre de la libreta (Fase 18); coordenadas a 3 decimales y cotas a 4, sin cero negativo (Fase 22); los empates de coordenadas y cotas se redondean como en Excel (Fase 26); la hora del «Guardado», en Bogotá y 24 h (Fase 35) |
| `lib/calculations/tolerances.test.ts` | 12 | Tolerancias por orden, presets de asentamientos y `thresholdsOf` |
| `lib/export/polygonal-workbook.test.ts` | 15 | **El Excel de la poligonal con fórmulas vivas** (Fase 38, reescrita): toda fórmula da el valor del motor (`formulaMismatches`) con la TT4 por Brújula, Tránsito y Crandall, la abierta con control y la sin control, y la abierta con control por Tránsito y Crandall; la hoja lleva el nombre del método; el orden alcanzado de la TT4 es el detectado; cambiar una distancia recalcula las coordenadas; la georreferenciada con la rotación y la escala como datos; la Vivero por mínimos cuadrados, con fórmulas sobre los ángulos y distancias ajustados, y sin pesos, la hoja dice por qué; el encabezado lleva la ubicación y el responsable del alta; los ángulos de minutos enteros no salen con 60″ (revisión final); la precisión de cada punto de la Vivero bajo las matrices, con los valores del motor (Fase 39) |
| `lib/calculations/georeference.test.ts` | 18 | Georreferenciación: la Vivero local llevada al real con D1 y D3 contra el PRD (rotación 35°00′07.8″, coordenadas a 0.1 mm); el veredicto igual con los cuatro métodos; rígido con Bowditch, Crandall y mínimos cuadrados, y Tránsito acotado a 2.66 mm; ajuste exacto y con residuo; redondeos; abierta con control; factor de escala por orden (Fase 15) |
| `components/polygonal/georeference-plan.test.ts` | 9 | **Ruta** de la georreferenciación desde las filas: columnas de cabecera y estaciones, residuos, amarre a manual, sin columnas de cierre, rechazos, factor de escala de unidades equivocadas, aviso de escala (Fase 15) |
| `components/polygonal/capture-rows.test.ts` | 12 | Las filas «desde → hacia» (Fase 35): la TT4 con su 0 atrás, el cierre y el cierre angular contra TT4; la Vivero; sin referencia; la abierta con control con su deflexión y su punto de llegada; el punto pendiente; la cerrada local; `fieldTraverse`, lo medido sin ajustar para el dibujo |
| `components/polygonal/capture-edits.test.ts` | 19 | Los popups de la captura sobre el borrador (Fase 35): la TT4 capturada medición por medición es la de la hoja; el cierre angular contra el amarre, hacia el primer lado, sin amarre (el ángulo en P1) y en la abierta con control; editar, eliminar una intermedia y deshacer; a medio capturar, el cálculo no falla; con mediciones, el 0 atrás no se pone ni se quita |
| `components/polygonal/polygonal-save.test.ts` | 9 | El borrador y la carga del guardado (Fase 35): las coordenadas de la hoja, el orden y el tipo detectados aunque lo guardado diga otra cosa, el amarre y los datos del alta en la carga, los pesos con cualquier método, la abierta sin control sin mínimos cuadrados y la referencia del catálogo con su código |
| `components/polygonal/angle-format.test.ts` | 7 | Ángulos en DMS o decimal, segundos con signo y la lectura de los campos DMS (Fase 35) |
| `components/polygonal/order-verdict.test.ts` | 4 | El «Por qué» del orden alcanzado, orden por orden, con y sin condición angular (Fase 35) |
| `components/polygonal/adjusted-table.test.ts` | 2 | La poligonal ajustada al estilo de la hoja: las coordenadas del punto de llegada y la fila Σ (Fase 35) |
| `lib/polygonal-amarre.test.ts` | 22 | Los puntos del amarre al catálogo: reutilizar, completar, crear o mover el que tiene otras coordenadas; `catalogMoves`, los que cambian con sus coordenadas de antes y las otras poligonales que los usan; `repeatedPointName` con el medio milímetro, y `catalogPointOf`; `planCatalogWrites` —insertar, actualizar por id, un punto nuevo repetido una sola vez, el id propuesto para la referencia— y `catalogPointsProblem`: puntos sin nombre o con coordenadas no finitas, que no son los del amarre o que repiten nombre (Fase 35 y sus correcciones) |
| `components/reports/sections/polygonal-correction.test.tsx` | 6 | «Corrección por método …» en el informe, con la TT4 en los cuatro métodos: qué ángulos se corrigen, sus cifras y fórmulas en MathML; nada en la abierta sin control (Fase 35); el reparto angular en el texto, con su valor por ángulo (Fase 40); la leyenda «donde:» de cada fórmula y mínimos cuadrados sin pesos sin «faltan los pesos» (Fase 41) |
| `components/reports/math.test.tsx` | 4 | Una letra griega sola va recta en MathML (Fase 35); la leyenda de `Formula`, «donde: símbolo — significado · …», y nada sin ella (Fase 41) |
| `lib/errors/action-call.test.ts` | 3 | Un rechazo de red de una acción vuelve como error, sin lanzar, y las señales de navegación de Next pasan (Fase 35) |
| `lib/calculations/least-squares.test.ts` | 28 | Ajuste por mínimos cuadrados por la ruta de `computePolygonal`: la Vivero contra el PRD, **condiciones en cero**, correcciones no uniformes, mismo veredicto que Bowditch, TT4 con la orientación como datum, abierta con y sin azimut de llegada, sin pesos, escala de σ₀, coeficientes contra diferencias finitas; una abierta de un solo lado no se ajusta y no lanza, singularidad con tolerancia relativa, aviso de no convergencia; lectura de σ₀ (Fase 14); desde la Fase 32, con la prueba χ² al 95 %: los intervalos de r = 2 y r = 3, la Vivero consistente, las fronteras, la r que cambia la lectura y los casos que la banda [0.5, 2] juzgaba mal; las matrices de la última iteración que usa el Excel, con N = A·Q·Aᵀ y N·k = −w (Fase 38) |
| `lib/calculations/settlement-persistence.test.ts` | 19 | **Qué lecturas hay que reescribir** al recalcular: cambio de solo la alerta, velocidad como cadena y a la precisión de su columna; desde la Fase 37, cualquier visita, sin excepción de las cerradas; filas de libreta a persistir y lectura de la base (Fase 18); la cota de catálogo de los BM de control, solo en sus filas (Fase 30) |
| `lib/calculations/settlement-book-tramos.test.ts` | 11 | **Los tramos de la libreta de la visita** (Fase 37): dónde arranca cada uno; la visita 12 de Torre Alameda, cerrada en segundo orden con −1.6 mm y BM-1 en 99.9984, sin compensar; la cartera, abierta y sin orden; un tramo que arranca en otro BM toma su cota, uno de enlace, uno que arranca fuera de los BM del lugar; la cadena con una fila sin lectura, sin la V+ de la armada o sin la V− de un punto de cambio; la plantilla sin lecturas; la verificación del tramo peor |
| `lib/calculations/settlement-book-plantilla.test.ts` | 13 | Las cotas de los puntos sin corregir, el punto en dos armadas como error con sus dos filas, el punto por leer y el ausente; la plantilla de la visita nueva —las armadas de la anterior sin lecturas, la baja y el alta, sin anterior y sin BM—; lo pendiente y el estado; el punto auxiliar (Fase 37); un punto de cambio seguido de un tramo desde un BM no espera V+ (revisión final) |
| `lib/calculations/settlement-book-bm.test.ts` | 3 | Un BM del lugar leído de paso, en tercer orden, y el de cierre no; el margen fijo de 6 mm; B10 de la cartera, «excesiva» en la visita 2 y «contraria» en la 3 (Fase 37; numeradas desde 0 en la Fase 43) |
| `lib/calculations/visit-record.test.ts` | 11 | **El registro de una visita** (Fase 37): un circuito cerrado en segundo orden, sin compensar y calculado; la cartera sin verificación; una fila por leer, sin cota y en medición; el recálculo del lugar al cambiar la cota de un BM, sin C0 y con ella; una visita sin libreta entra al histórico con sus cotas; `visitSaveOf`: una visita de cotas tecleadas conserva sus cotas y su cabecera; un punto auxiliar guardado en los BM no verifica la visita que lo midió, y sí las demás (revisión final) |
| `lib/calculations/angles.test.ts` | 22 | Conversiones DMS ↔ decimal; captura en grados decimales, con ida y vuelta exacta en 12 000 valores (Fase 13); promedio y dispersión de lecturas a través de 0°/360°, redondeo a 0.1″, coma decimal y sin aviso falso en la vista decimal (Fase 26) |
| `lib/demo/fixtures.test.ts` | 19 | La demo de carteras reales contra el motor (Fase 21): la TT4 cumple (12″, 1:7045) en tercer orden detectado, y la Vivero alcanza segundo orden (Fase 35); la Vivero converge por mínimos cuadrados y en sistema local da la misma precisión; El Verjón da 5.0 mm de discrepancia y sus puntos homólogos, en segundo orden detectado, y el tramo 2, leído del crudo, cierra en −0.4 mm sobre 1.397 km en primer orden (Fase 36); desde la Fase 38, sin los informes de la demo; amarres y BMs en el catálogo; El Verjón como circuito de −5.0 mm con D4 = 3315.0855 y sus cotas adoptadas, el tramo 2 con C14 = 2542.2271, el BM de partida fijo, y con la regla «dentro de tolerancia» sin compensar cuando no cumple (Fase 28); Torre Alameda sin compensar ni cerrar (Fase 37): ocho puntos, catorce visitas y sus dos BM del lugar, todas calculadas y solo la 9 sin verificación, cada cota a menos del cierre de su visita de la serie, el otro BM que nivela salvo en la visita 13 (Fase 30) y, con el margen fijo, ni avisos de tendencia ni «Acelerando» |
| `lib/demo/crudo-tramo2.test.ts` | 1 | El crudo Leica de `src/` es idéntico, byte a byte, al de `docs/carteras/` (Fase 21) |
| `lib/design/chart-scale.test.ts` | 18 | Escala lineal y marcas «nice», incluidos rangos degenerados; escala y marcas de tiempo en días (Fase 18) |
| `lib/design/polygonal-plot.test.ts` | 27 | Geometría del dibujo de la poligonal: factor de exageración con los valores del seed (TT4 ×100, Vivero ×200, Pentágono ×1), proporción 1:1, zoom (Fase 13); el factor de las elipses de error: ×500 en la Vivero, la mayor al 15 % de la extensión, nunca menor que 1 y sin elipses, sin factor; el giro del SVG que lleva el eje mayor a su azimut, y los extremos de cada elipse para el encuadre (Fase 39); `zoomAt`: el punto bajo el cursor no se mueve, sin punto acerca alrededor del centro y el acercamiento se acota a [1, 256] (Fase 41) |
| `lib/calculations/least-squares-precision.test.ts` | 23 | La precisión de cada punto (Fase 39): `fQuantile2` contra la tabla 19.2 de Ghilani al 90, 95 y 99 % y c con r = 1, 2 y 3; `errorEllipse` sin correlación, girada y en [0°, 180°); `adjustedCofactor` con A·Q_l̂·Aᵀ = 0; la Vivero contra un **ajuste paramétrico independiente** (mismo σ₀, σ N, σ E y covarianza a la millonésima de milímetro), los puntos fijos, la elipse al 95 % y la misma Vivero modelada sin amarre; una abierta con control, con r = 3 y r = 2, contra la propagación por diferencias finitas a través del motor |
| `lib/export/settlement-workbook.test.ts` | 6 | **El Excel de asentamientos con fórmulas vivas** (Fase 38, reescrita, con los casos de `settlement-workbook.fixtures.ts`): toda fórmula da el valor del motor con Torre Alameda, la cartera real y un punto que se salta una visita; ese punto compara contra la última visita en que se midió; cambiar una lectura de la libreta recalcula su cota en la comparación; las hojas Libretas, Comparación y Resumen |
| `lib/design/chart-domain.test.ts` | 16 | Dominio Y de las gráficas de asentamiento: 0, los datos y el siguiente umbral por encima; sin datos, sobre un umbral, más allá de la alarma, levantamiento, umbrales desordenados, `NaN` (Fase 18) |
| `lib/validators/settlement-book.test.ts` | 10 | Los mensajes de la derivación, con las filas desde 1 (Fase 18); el de la comprobación de un BM, que no culpa a ninguno (Fase 30); `validateBook` (Fase 37): la libreta vacía, cada tramo desde un BM del lugar, las lecturas por leer no son error, la distancia opcional y una tecleada que no puede ser cero, y un valor que no es número |
| `lib/calculations/settlement-summary.test.ts` | 15 | KPIs: extremos con signo, levantamiento, visita base, visita sin lecturas, lugar sin visitas; siguiente umbral de acumulado (Fase 18); el promedio encadenado con altas, bajas, visitas sin lecturas y sin puntos comunes (Fase 31) |
| `lib/demo/libreta-asentamientos.test.ts` | 6 | Generador de libretas del seed: válida, con punto de cambio, cierra con el error pedido y alcanza un orden; determinista (Fase 18); sin compensar, cada cota se aparta de la objetivo menos que el cierre, y un cierre fuera de todos los órdenes deja las cotas en las objetivo y la visita sin orden; una sola armada con cuatro puntos o menos (Fase 37) |
| `lib/demo/cartera-asentamientos.test.ts` | 6 | **La cartera real de asentamientos** (Fase 37, decisión 23): 16 puntos y 7 visitas, la última del 2022-06-05; cada visita una armada abierta, calculada y sin verificación; reproduce celda a celda las cotas, «Comparación n» y «Comparación al anterior» de la hoja; numeradas de la 0 a la 6, como la aplicación (Fase 43); los avisos de B10 |
| `lib/calculations/leveling-detect.test.ts` | 14 | **El orden detectado y la compensación sin limitantes** (Fase 36): El Verjón en segundo orden con las cotas ajustadas del lienzo, el tramo 2 en −0.4 mm y primer orden, fuera del ordinario sin orden pero compensada, la abierta sin vuelta sin orden; la regla de la visita no cambia; la libreta a medias (`pendingRun`): sin armadas, una cerrada que no vuelve al BM, la ida y la vuelta de una abierta sin terminar, la abierta sin vuelta y una vuelta vieja que llega al BM como punto de cambio; «never» no compensa; una libreta que no encadena —un punto de cambio sin V+— queda sin orden y sin compensar, y una a medias que cuadra no (revisión final) |
| `components/leveling/armadas.test.ts` | 10 | La captura por armada (Fase 36): las 10 armadas de la ida de El Verjón, la armada 2 con sus lecturas, capturar armada por armada reproduce la hoja, editar una del medio solo cambia sus filas, una armada a medias al final, una intermedia colgada después del último punto, quitar la última; la armada siguiente y el fin del recorrido; agregar una armada tras una intermedia colgada abre desde el último punto y la intermedia conserva su cota (revisión final) |
| `components/leveling/armada-form.test.ts` | 8 | El popup de armada (Fase 36): del formulario a la armada y de vuelta, los hilos con la distancia y la comprobación del medio, los campos obligatorios y los números, la casilla de fin según el tipo y el recorrido, y los errores de la libreta en la vista que los tiene; una armada que no queda en la libreta es un error (revisión final); `readingWarnings`, los avisos de lecturas fuera de 0 a 4 m que muestran los dos popups (Fase 42) |
| `components/leveling/leveling-save.test.ts` | 12 | El borrador y la carga del guardado (Fase 36): la libreta de El Verjón en orden, la carga sin el orden, la entrada del motor, la importación, el BM que renombra los extremos de la libreta, dónde empieza la vuelta y el recorrido vacío; lo que se guarda (`levelingRecordOf`) y se exporta: la cabecera con el orden detectado, la libreta a medias en curso, la escala de cada columna, y el Excel de una nivelación guardada antes de la fase con el orden detectado y las cotas compensadas (revisión final; desde la Fase 38, leídos en las hojas «Nivelación» y «Cotas ajustadas») |
| `components/leveling/leveling-details.test.ts` | 9 | El alta y el popup del BM (Fase 36): el título, la cota con coma, el BM de llegada en la de enlace, la abierta sin él; los avisos de Editar datos: quitar la vuelta borra su libreta, cambiar el tipo o un BM la recalcula (revisión final) |
| `components/leveling/libreta-rows.test.ts` | 10 | La tabla de la hoja (Fase 36): lecturas, AI y cota sin compensar de El Verjón con sus rótulos, el lápiz de cada fila, la vuelta, la libreta vacía; la lista por armada del teléfono; la comprobación aritmética; las lecturas a 3 o 4 decimales por libreta; `libretaBlocker` con la fila y el recorrido del punto de cambio incompleto (revisión final) |
| `components/leveling/comparison-data.test.ts` | 7 | La compensación (Fase 36): el gráfico de El Verjón —la ida a +1.0 mm en C 1, la vuelta a −6.0 y las dos a −2.5 en D4— y sus cifras de los extremos; el tramo 2 a −0.4; la abierta sin vuelta sin gráfico; la tabla con cada punto y su homólogo, las correcciones y la cota ajustada; las lecturas de cada punto |
| `components/leveling/order-verdict.test.ts` | 3 | El «Por qué» del orden de la nivelación (Fase 36): El Verjón contra K·√D·√2, el tramo 2 contra K·√D, la abierta sin vuelta sin nada que juzgar |
| `lib/errors/user-message.test.ts` | 4 | **Errores de la base para el usuario**: cada código conocido traducido sin dejar pasar el texto de Postgres; el check de un trigger propio, en español, pasa; el de una columna, no; código desconocido, el mensaje de la acción (Fase 22); desde la Fase 37 el `23001` del cierre también da el de la acción |
| `components/design-system/page-header.test.ts` | 4 | `PageHeader` y `ActionBar`: título en `<header>` (se oculta al imprimir), sin contenedores vacíos, migas; barra fija, anunciada y fuera de la impresión (Fase 22) |
| `components/leveling/profile-data.test.ts` | 5 | El perfil de la libreta con las carteras reales (Fase 36): cada armada con su mira atrás, el nivel a la altura del instrumento y la mira adelante, y la intermedia en su armada; la contraparte en el sentido de la ida, escalada a su largo; la vuelta con su propio eje; el tramo 2 sin contraparte; sin armadas, sin perfil |
| `components/settlement/visit-armadas.test.ts` | 17 | **La armada de la visita** (Fase 37): dos armadas por un punto de cambio, un tramo nuevo, la plantilla sin lecturas; leer y escribir una armada sin tocar las otras; agregar desde un BM del lugar o desde el punto de cambio; «Terminar armada» quita los puntos sin leer; el punto repetido solo se quita si es una vista; quitar la última armada; la libreta importada como un tramo; un punto de cambio seguido de un tramo desde un BM no abre otra armada, y su V− se quita (revisión final) |
| `components/settlement/visit-armada-form.test.ts` | 13 | El popup de la armada (Fase 37): lo que falta por leer en `null`, la coma decimal, los hilos, los errores con su vista, la V− a un BM del lugar o a un punto de cambio, sin vista adelante; del guardado al formulario y una armada nueva; componer la armada y contar los puntos leídos |
| `components/settlement/visit-libreta-rows.test.ts` | 25 | El paso 1 · Libreta (Fase 37): los rótulos de la tabla, la cota de la medida y la AI, la VI de los puntos, el lápiz de cada fila, el punto «pendiente» y el tramo de enlace; las armadas a medias y sin V−; los tramos con su cierre y su orden, abiertos, sin distancias o a medias; qué retomar; el movimiento desde la visita anterior y sus avisos; los puntos vigentes sin lectura, juntos, y la lectura de un punto de baja, sin contar la fila por leer (revisión final) |
| `components/settlement/visit-results.test.ts` | 4 | El paso 2 · Resultados (Fase 37): la franja, una fila por punto con su tendencia, la visita base y una visita sin lecturas |
| `components/settlement/visit-dialog-form.test.ts` | 5 | El popup de la visita (Fase 37): la fecha de calendario, los textos vacíos en `null` y el aviso de la plantilla, con anterior, sin ella y sin BM |
| `components/settlement/site-dialog-form.test.ts` | 5 | El popup del lugar (Fase 37): el nombre, los umbrales crecientes y positivos, la descripción vacía y el resumen de los umbrales plegados |
| `lib/supabase/paginate.test.ts` | 3 | **Leer todas las filas** (revisión final de la Fase 37): `allRows` trae las 2500 filas de una tabla que PostgREST corta en 1000, no salta filas con un corte menor que la página y devuelve el error de cualquier página |
| `lib/supabase/settlement-sync.test.ts` | 5 | **`recomputeSite`** con un cliente simulado que corta en 1000 filas (revisión final): un error al leer los BM no pasa por «al día»; sin visitas, al día; 70 visitas de la cartera (1190 filas de libreta, 1120 lecturas) sin cambios; la simulación cuenta las lecturas que se purgarían; una visita de cotas tecleadas guarda sus lecturas sin tocar su cabecera ni su libreta |
| `lib/import/benchmarks.test.ts` | 4 | Importar BM al lugar (Fase 37): de una nivelación con su origen, de un CSV con coma decimal y punto y coma, y los errores de cota y de código repetido con su línea |
| `lib/reports/leveling-report.test.ts` | 10 | El informe sencillo de la nivelación, por tipo (Fase 36): el resumen con el orden detectado —Δ en la abierta con vuelta, el cierre en la cerrada, «Sin verificación» e «Incompleta», con la «Nivelación incompleta» de la sección (Fase 40)—; la sección de la abierta con vuelta, la cerrada con las dos lecturas de cada punto, la de enlace con su corrección, la abierta sin vuelta sin datos ajustados y la alerta fuera de todo orden; una libreta que no encadena: «Cartera con errores» y la alerta (revisión final; Fase 40) |
| `lib/reports/site-data.test.ts` | 8 | **El informe sencillo del lugar** (`siteReportOf`, Fase 37): solo las visitas calculadas y las que están en medición aparte; la verificación de cada visita y la base; las notas; el veredicto y los puntos sobre un umbral; si las visitas se verifican; los avisos de tendencia; los puntos de la última visita |
| `lib/reports/cover.test.ts` | 2 | `coverOf` toma del proyecto solo lo que muestra la portada, y `ReportCover` la pinta en vivo, sin separador si falta la proyección (Fase 38; hasta entonces, la portada congelada en `cover` de la Fase 23) |
| `lib/reports/page-footer.test.ts` | 4 | El pie del PDF (Fase 40): `cssString` escapa comillas y barras invertidas, cambia los saltos de línea por espacios y no deja cerrar el `<style>`; `pageFooterCss` une el proyecto y el proceso en `@bottom-left` |
| `lib/process-counts.test.ts` | 2 | El conteo de la tarjeta del proyecto: el total, en singular y en plural, y sin procesos (Fase 24; desde la Fase 37, sin desglose por estado) |
| `components/projects/new-project-form.test.ts` | 2 | El alta de proyecto: un solo botón, de envío, y los datos básicos con el sistema de referencia (Fase 27) |
| `components/projects/hub-rows.test.ts` | 9 | El tipo de un proceso: «Abierta con ida y vuelta», y como frase en las filas del hub (Fase 27); la poligonal siempre «Calculado» y con sus tres acciones, y sus chips sin cerrados ni rechazados (Fase 35); la nivelación tampoco se cierra —«Calculado» aunque no alcance ningún orden, sus chips— y una abierta con la vuelta a medias no dice «Sin verificación» (Fase 36) |
| `lib/export/workbook-colors.test.ts` | 8 | Cada color del Excel es su token del tema claro de `globals.css` (Fase 24); también los cuatro de la Fase 38: el fondo y la tinta de los datos (`miraBg`, `miraInk`), «CUMPLE» y «NO CUMPLE» |
| `lib/export/formula-check.test.ts` | 5 | **El ayudante que evalúa las fórmulas de un libro** (Fase 38): fórmulas encadenadas, de otra hoja, con texto y con fechas; un libro coherente no tiene diferencias y uno con un resultado guardado falso sí; evalúa desde los datos crudos, así que cambiar un dato recalcula toda la cadena; sigue cadenas largas con funciones —el intérprete no es reentrante— y evalúa `MIN` |
| `lib/export/cells.test.ts` | 5 | Las primitivas de celda (Fase 38): columnas y celdas con el nombre de Excel; una fórmula lleva su resultado guardado y un dato su estilo; `roundHalfUp` redondea los medios como `Math.round`, también los negativos; los bloques de tolerancias copian `tolerances.ts`; el encabezado de cada hoja dice cuándo se exportó, sin la marca de la app (Fase 40) |
| `lib/validators/equipment.test.ts` | 9 | El equipo del catálogo: marca o modelo, calibración no futura, escalas de las columnas, solo los campos de su tipo; el aviso de calibración a 11, 12 y 13 meses y el 29 de febrero (Fase 25) |
| `lib/equipment.test.ts` | 8 | Del catálogo al formulario y de vuelta, con coma decimal; la fila solo con su tipo; etiqueta, precisión y el mismo aparato sin distinguir mayúsculas (Fase 25) |
| `components/equipment/equipment-picker.test.ts` | 7 | El selector ofrece solo los equipos de su tipo, no duplica lo guardado, avisa de la calibración y no aparece en un cerrado (Fase 25); el alta de la poligonal no ofrece el catálogo y la de la nivelación sí (correcciones de la Fase 35) |
| `lib/design/ui-sin-notas-de-desarrollo.test.ts` | 3 | **La interfaz no habla del desarrollo**: ningún texto de `components` ni `app` cita el PRD, fases, «la universidad», «hoy no» ni «la migración»; el quitado de comentarios no toca las URL (Fase 22) |
| `lib/manual/markdown.test.ts` | 11 | **El Markdown del manual** (Fase 42): slugs de GitHub con tildes y repetidos, texto sin escapar, archivos de capítulo, enlaces entre archivos, anclas y externos, rutas de captura y la imagen sola en su párrafo |
| `lib/manual/png.test.ts` | 3 | El tamaño de un PNG desde su cabecera; lo que no es un PNG se rechaza (Fase 42) |
| `lib/manual/manual.test.ts` | 10 | **El manual real** (Fase 42): numeración y slugs, el README enlaza cada capítulo en orden, resumen y flujos, vecinos; sin «§», «Fase N», «PRD» ni HTML; todo enlace y ancla resuelve; cada imagen es captura de su capítulo, existe, tiene alt y está en `capturas.json` con su tamaño; no sobra ningún PNG |
| `lib/manual/constantes.test.ts` | 4 | Las tablas del manual que copian el código: órdenes, tolerancia angular y precisión mínima; el K de la nivelación; el semáforo; los estados (Fase 42) |
| `components/manual/markdown.test.tsx` | 5 | El recorredor del manual (Fase 42): figura fuera de párrafo a la mitad de su tamaño, la primera `eager`; anclas y enlaces a rutas de la app; pasos, nota sin `role="alert"`, `th scope`; lo no admitido falla; cada capítulo real se pinta |
| `lib/utils/parse.test.ts` | 10 | **Coma o punto decimal**: signo, espacios, estados intermedios (`1,`, `,5`); vacío es `null` y lo inválido también, nunca `NaN`; separador de miles, exponentes y letras inválidos (Fase 20) |
| `components/design-system/number-input.test.ts` | 8 | `NumberInput`: texto con teclado decimal, lo inválido se marca en vez del error del validador; el contador de celdas inválidas; `DmsInput` con segundos decimales (Fase 20) |
| `lib/theme.test.ts` | 6 | Cookie del tema: claro, oscuro, ausente y desconocido; atributo `data-theme`; cabecera de la cookie (Fase 20) |
| `lib/design/contrast.test.ts` | 5 | `parseThemeTokens`: `light-dark()` y hexadecimal a secas; razón y tinte (Fase 20) |
| `lib/design/pairings.test.ts` | 4 | **Contraste como test**: cada pareja cumple en claro y en oscuro sobre el `globals.css` real, y sus tokens existen (Fase 20) |
| `lib/validators/reference-point.test.ts` | 4 | Coordenadas y cota con coma, redondeo igual que con punto, vacío y mensajes de inválido (Fase 20) |
| `components/design-system/theme-select.test.ts` | 4 | El selector de tema: etiqueta, tres opciones, arranque en la elección de la cookie (Fase 20); como botones, el grupo «Tema» y solo la elegida pulsada (Fase 33) |
| `components/navigation/account-menu.test.ts` | 5 | El menú de cuenta: el botón abre el panel con `popover`; el correo, el tema con botones y «Cerrar sesión» en un formulario; la inicial del correo, también sin correo (Fase 33) |
| `components/navigation/app-bar-link.test.ts` | 2 | Qué sección de la barra está activa: su ruta y las que cuelgan de ella, no otra que empiece igual (Fase 33) |
| `lib/design/tokens-retirados.test.ts` | 2 | **Ninguna clase ni `var()` usa un token retirado** ni la paleta de Tailwind en todo `src/`, ni un color literal en `fill` o `stroke` (Fase 20) |
| `lib/validators/sign-up.test.ts` | 10 | Bloqueo de registro sin código de invitación |
| `lib/export/leveling-workbook.test.ts` | 10 | **El Excel de la nivelación con fórmulas vivas** (Fase 38, reescrita): toda fórmula da el valor del motor con El Verjón (abierta con vuelta), el tramo 2 (cerrada), El Verjón sin vuelta (sin verificación) y una cerrada con hilos, tres filas por punto; las hojas de El Verjón —ida, vuelta, cotas ajustadas y resumen—; su orden alcanzado es el detectado; cambiar una V− recalcula las cotas que siguen; con hilos, la distancia sale de ellos por fórmula, (superior − inferior) × 100; una libreta vacía se exporta y lo dice, y una a medias no muestra error de cierre (revisión final) |
| `components/design-system/status-indicator.test.tsx` | 8 | Formas del semáforo de 4 niveles |
| `lib/design/series-markers.test.ts` | 8 | **Diez formas de marcador**: ninguna se repite antes de la serie 11 |
| `components/design-system/tabs.test.ts` | 6 | Construcción de enlaces |
| `lib/validators/project.test.ts` | 7 | El proyecto ya no valida equipo ni orden de precisión (Fase 8); latitud y longitud con coma decimal, y un separador de miles rechazado (Fase 20) |
| `components/design-system/breadcrumbs.test.tsx` | 7 | Resolución de la ruta; colocada en la barra, fija entre el logo y los iconos, y en el teléfono el «‹ nivel anterior» puede encogerse y truncarse (Fase 33) |

**Pruebas de la base (Fase 23).** `supabase/tests/`, con pgTAP, sobre la base
local: `npx supabase test db`. Cada archivo crea sus datos en una transacción
que se deshace, así que no depende del seed ni lo toca.

| Archivo | Pruebas | Cubre |
|---|---|---|
| `guardados_atomicos.test.sql` | 27 | Las cuatro funciones de guardado: guardan; una carga que falla a mitad no cambia la cabecera ni las filas de antes; la georreferenciación mueve las coordenadas y rechaza una estación ajena; la propagación no toca otro lugar; otro usuario no escribe con ninguna de las cuatro (RLS) |
| `catalogo_equipos.test.sql` | 11 | Alta con el dueño por defecto; campos del otro tipo, sin marca ni modelo y el mismo aparato rechazados; editar o borrar un equipo no cambia el proceso que lo copió; otro usuario no ve ni escribe (Fase 25) |
| `rango_lecturas.test.sql` | 7 | El CHECK de las lecturas de ángulo: los límites y 360°00′00″ exacto se guardan; 65″, 60′, 360°00′01″, 361° y segundos negativos no, y no se pierde lo de antes (Fase 24) |
| `correcciones_calculo.test.sql` | 8 | Las distancias por visual en cero o negativas, en la nivelación y en la libreta, y dos visitas del mismo lugar en la misma fecha, rechazadas (Fase 26) |
| `estabilidad_bms.test.sql` | 5 | `save_visit` guarda la cota de catálogo de un BM de control, y la libreta la conserva aunque se corrija el catálogo (Fase 30; desde la Fase 37, sin el caso de la visita cerrada) |
| `poligonal_sin_cierre.test.sql` | 17 | La poligonal sin cierre (Fase 35): las columnas del alta y `precision_order` nulo; sin triggers de cierre (desde la Fase 36 la nivelación tampoco los tiene); sin `closed_at` ni `closed_by` y el CHECK que rechaza `closed` y `rejected`; se edita siempre; `save_polygonal_process` escribe `has_closing_row`, el tipo de ángulo, el orden nulo y los datos del alta. Desde la Fase 37 ya no comprueba el trigger de cierre de la visita |
| `amarre_atomico.test.sql` | 12 | `save_polygonal_process` con `p_catalog` (correcciones de la Fase 35): corrige un punto y crea otro con el proceso, y la cabecera apunta al nuevo; si una estación falla, ni el catálogo ni la cabecera cambian; no corrige un punto de otro proyecto del mismo usuario; rechaza una escritura que no es `insert` ni `update`; la llamada de tres argumentos sigue guardando |
| `nivelacion_sin_cierre.test.sql` | 15 | La nivelación sin cierre (Fase 36): las columnas del alta y `precision_order` nulo; sin triggers de cierre ni la función de sus lecturas; sin `closed_at` ni `closed_by` y el CHECK que rechaza `closed` y `rejected` (paso 2); se edita siempre; `save_leveling_process` escribe los datos del alta y un orden vacío. Desde la Fase 37 ya no comprueba el trigger de cierre de la visita |
| `asentamientos_sin_cierre.test.sql` | 33 | Los asentamientos sin cierre (Fase 37): `site_benchmarks` con un código por lugar y la visita que midió cada BM (`origin_visit_id`, con su clave foránea), `starts_section` y `precision_order` nulo; ni la visita, ni el lugar, ni sus lecturas, libreta o puntos tienen triggers de cierre, ni el de la C0, ni sus funciones; sin `closed_at`, `closed_by`, el clima ni `capture_mode` en la visita, sin `status`, `closed_at` ni `closed_by` en el lugar, y sin las funciones de inmutabilidad ni `is_reopening` (la segunda migración, paso 3 del despliegue); como el dueño, la visita queda `in_progress`, la C0 se cambia con lecturas, `save_visit` guarda filas sin lectura con su inicio de tramo, un código de BM repetido se rechaza, `closed` ya no se admite y cualquier visita se borra; otro usuario no ve ni agrega BM del lugar (RLS) |
| `sin_informes_consolidados.test.sql` | 2 | Sin informes consolidados (Fase 38): la tabla `reports` no existe, ni su función de inmutabilidad `reject_update_on_report()`. Reemplaza a `informe_congelado.test.sql` (Fase 23), que probaba el trigger y la portada congelada |

La Fase 6 cerró los huecos que la § 11 registraba: `expectStationCapture`,
`niceTicks` con rangos degenerados y `computeDifferentials` con un punto sin
lectura ya tienen cobertura (la última salió en la Fase 29, con la función). Lo que **sigue sin tests** es la E/S de los Server
Actions, salvo los cuatro guardados que desde la Fase 23 escriben por funciones
de Postgres con pruebas pgTAP; ver [deuda técnica](#11-deuda-técnica-conocida).

### Cómo se testea la interfaz

Sin jsdom, no se testea el comportamiento en el navegador. El patrón es
**extraer la decisión como función pura** y testear esa función: `orderChecks`
en `polygonal/order-verdict.tsx` y `levelingOrderChecks` en
`leveling/order-verdict.tsx`, `resolveBreadcrumbs` en `breadcrumbs.tsx`,
`tabHref` en `tabs.tsx`. Cuando lo que importa es **qué se pinta**, sin
eventos, basta `renderToStaticMarkup` de `react-dom/server` en el entorno
`node`: así prueba `polygonal-correction.test.tsx` las fórmulas del informe
(Fase 35). Lo hacía `readings-table.test.ts` con la tabla de la libreta que
compartían la nivelación y la visita (Fase 18), retirada con ella en la Fase
37. La visita por pasos sigue el patrón de extraer: sus decisiones viven en
módulos puros sin «use client» (`visit-armadas.ts`, `visit-armada-form.ts`,
`visit-libreta-rows.ts`, `visit-results.ts`, `visit-dialog-form.ts`,
`site-dialog-form.ts`), cada uno con su prueba.

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
siguieron, así que el patrón está probado tres veces —y, desde las Fases 35 a
37, también la pantalla por pasos con sus popups (§ 8)—. Un módulo nuevo
necesita:

1. **Migración** con su tabla de proceso y su tabla de detalle, con RLS vía
   proyecto. Desde las Fases 35 a 37 ningún módulo se cierra y las funciones
   de inmutabilidad compartidas se borraron (§ 5): un módulo que volviera a
   cerrarse necesitaría sus propios triggers —el patrón está en
   `20260727180000_immutable_closed_processes.sql`, y una tabla de detalle que
   no cuelga directamente del proceso necesita su propia función, porque la
   de las filas hijas consultaba la cabecera por nombre—. Los guardados de
   varias tablas van por una función de Postgres (§ 3).
2. **Tipos** en `src/types/`, y regenerar `database.ts`.
3. **Algoritmo** en `src/lib/calculations/<modulo>.ts` — función pura, con sus
   tests derivados por cálculo directo, **nunca copiados de un documento de
   referencia sin verificar contra él primero** (asentamientos encontró que
   el marco teórico calculaba mal tanto la velocidad como los estados de
   alerta). Añadir sus tolerancias a `tolerances.ts`.
4. **Validadores** en `src/lib/validators/<modulo>.ts`, con su capa de
   captura y sus tests (la de cierre salió de los tres módulos en las Fases
   35 a 37). Decida explícitamente si el módulo necesita una capa estadística
   que **no bloquee** nada — es el caso de asentamientos: un hallazgo
   alarmante debe poder registrarse.
5. **Server Actions** con **revalidación de la captura en el servidor** desde
   el primer commit: la clave publicable de
   Supabase es pública por diseño, así que un cliente hostil puede llamar a
   la acción directamente con datos que la interfaz nunca habría enviado.
   Retrasarlo a un retrofit —como pasó con poligonal y nivelación— es deuda
   evitable.
6. **Editor** en `src/components/<modulo>/`, reutilizando el design system.
7. **Ruta** `src/app/(app)/projects/[id]/<modulo>/[pid]/`.
8. **Informe y Excel** (Fase 38): su sección en `lib/reports/sections.ts` y
   `components/reports/sections/`, que `ProcessReport` compone en el paso de
   Informe; la cabecera del módulo, sobre `ProcessHeader`, muestra «Exportar
   PDF» y «Exportar Excel» con `printable`; y su libro en `lib/export/`, con las primitivas de
   `cells.ts`, la ruta `export/route.ts` y una prueba con `formulaMismatches`.
9. **Manual**: su capítulo en `docs/manual/NN-<slug>.md`, enlazado desde el
   README, y su recorrido en `docs/manual/recorridos/`; regenerar con
   `npm run manual:capturas <slug>`. `npm test` comprueba enlaces, capturas y
   tablas (§ 12).

Antes de empezar, redactar el PRD de la fase en `docs/prds/`, según
[`docs/method.md`](../method.md).

### Reglas que no se negocian

- `src/lib/calculations/` permanece puro.
- Ángulos en tres campos, nunca decimal en la base.
- Ningún proceso se cierra (Fases 35 a 37) y ningún informe se guarda (Fase
  38): todo se recalcula en vivo. Una regla que deba cumplirse va en la base,
  no solo en la acción (§ 5).
- Tolerancias centralizadas en `tolerances.ts`.
- **El Excel de cada proceso sigue al motor** (Fase 38): cada celda calculada
  lleva su fórmula y, como resultado guardado, el valor del motor. Si cambia
  una regla del cálculo, cambia la fórmula del libro en `lib/export/`; si no,
  `formulaMismatches` (`formula-check.ts`) lo detecta en los casos de las
  pruebas, porque la fórmula deja de dar el valor guardado.
- Interfaz en español (Colombia), zona horaria `America/Bogota`.
- `npm run typecheck` tras cada cambio.
- Commits en español: `feat:`, `fix:`, `refactor:`, `docs:`, `test:`.

---

## 11. Deuda técnica conocida

Registrada durante el desarrollo, ninguna bloqueante:

**El encabezado del navegador en el PDF no tiene prueba automática (Fase
40).** Que Chrome no imprima la URL ni el título depende de que la primera
página no tenga margen arriba ni abajo, como documenta Chrome para su diálogo
de impresión. `page.pdf` de Playwright no lo prueba: con
`displayHeaderFooter` dibuja sus plantillas igual, y sin él no dibuja nada. Se
verificó que las cajas de margen salen en el PDF y que la portada no las
lleva; lo del diálogo lo comprobó el usuario a mano, en Chrome y en
producción (2026-10-08). Si otro navegador las imprime, el
manual dice cómo quitarlas en el diálogo.

**La nota de la demo ya creada.** La de «Sede Vivero — sistema local» dejó de
nombrar el catálogo en `fixtures.ts` (Fase 40), pero las demos que ya existen
—la de producción incluida— conservan la nota de antes: es dato del usuario.

**Los límites del Excel de la Fase 38.** Decisiones del plan, anotadas en el
registro de la fase, y lo que la prueba no cubre:

- **El cierre de antes del ajuste por mínimos cuadrados va como valores** de
  la app —error angular, error lineal y precisión, con los que el motor juzga
  el orden—: rehacerlo con fórmulas exigiría una segunda cadena entera de
  azimuts y proyecciones con la corrección proporcional. El orden alcanzado sí
  es fórmula sobre esos valores, así que cambiar una lectura en la hoja mueve
  las coordenadas ajustadas pero no ese cierre ni el orden.
- **Las libretas de asentamientos no dibujan los hilos.** «Libretas» pone una
  fila por lectura con la distancia como dato, sin las tres filas por hilos de
  la nivelación: las visitas casi nunca llevan hilos, y una que los tenga
  muestra solo la distancia, no los hilos.
- **La corrección de la nivelación solo con las dos compensadas.** Las
  columnas CORRECCIÓN y COTA AJUSTADA, y la hoja «Cotas ajustadas», salen
  cuando el resultado está compensado entero (`result.compensated`, como
  `adoptedElevationsOf`). Si la ida se compensa y la vuelta no —una vuelta sin
  distancias—, el libro no muestra la corrección de la ida.
- **El intérprete de las pruebas evalúa las dos ramas de un `IF`**:
  fast-formula-parser da error con `ABS` de una celda vacía aunque la rama no
  se use, así que las fórmulas lo evitan: el semáforo de la primera lectura de
  un punto, que no tiene velocidad, se arma sin ella, como `classifyAlert` con
  velocidad nula. Solo importa al ayudante de pruebas: Excel evalúa solo la
  rama que toca. Una fórmula válida en Excel que el intérprete no entienda hay
  que reescribirla o agregarle la función al ayudante, como `SUBSTITUTE`,
  `MIN` y `MAX`.
- **La tendencia de cada punto no está en el libro.** El Excel viejo de
  asentamientos daba los puntos que aceleran; el nuevo lleva los avisos de
  tendencia, pero no el «Converge» / «Acelera» de cada punto, que solo
  muestran los Resultados de la visita.
- **La prueba no sustituye abrir los libros en Excel** (criterio l del PRD de
  la fase): compara las fórmulas con el motor, pero no ve cómo las interpreta
  Excel —fechas, ángulos— ni el diseño. Esa verificación es del usuario, en
  Excel, LibreOffice o Google Sheets, y no hay prueba automática que la
  repita.

**Lo que la Fase 38 dejó sin uso.** La rama `missing` de
`lib/reports/sections.ts` —un proceso incluido que ya no existe—, con su texto
en `process-section.tsx` y el estilo `.report-missing`: el informe de un
proceso siempre lo tiene. Igual `IncludedProcess.order`, que siempre es 0.
Quitarlos cambia el tipo de las secciones, y no cambia nada visible. Los
ayudantes del Excel viejo de `workbook.ts` y los comentarios del consolidado
salieron al cerrar la fase.

**Cerrado en el despliegue de la Fase 37 (2026-10-07)**: la consulta previa
no dio ninguna visita de cotas tecleadas y el paso 3 borró la columna. Queda
`SiteVisitInput.elevations` (`visit-record.ts`), que deja de hacer falta
cuando no quede ninguna visita sin libreta. El texto original queda como
registro. **El borrado de `capture_mode` dependía de producción (Fase 37).** El paso 3
del despliegue (`20261009000000_asentamientos_sin_cierre.sql`) borra la
columna que distinguía las visitas de cotas tecleadas. Si la consulta previa
de producción (§ 13) da alguna, se decide con el usuario antes del `db push`:
sus cotas siguen en `settlement_readings` y entran al histórico tal cual
(`SiteVisitInput.elevations` en `recalculateSite`; `recomputeSite` guarda sus
lecturas sin tocar su cabecera, y «Editar datos» las conserva: `visitSaveOf`),
pero se pierde la etiqueta. La consulta
vale **antes** del despliegue: desde él, las visitas nuevas toman el
`DEFAULT 'direct'` de la columna hasta el paso 3, aunque tengan libreta.
`SiteVisitInput.elevations` deja de hacer falta cuando no quede ninguna visita
sin libreta.

**Lo que dejó la revisión final de la Fase 37.** Cuatro hallazgos menores se
corrigieron antes del despliegue, cada uno con su commit: la libreta avisa los
puntos vigentes sin lectura y la lectura de un punto de baja
(`pointIssueAlerts`, con los `missing` e `inactive` de `bookElevations`);
«Seguir después» con un dato mal escrito deja el popup abierto con su error
(verificado en pantalla); un BM no repite el código de otro del lugar salvo
mayúsculas o espacios (`benchmarkCodeClash`, en la acción: el único de la base
sigue exacto), y el «hoy» del lugar es el de Bogotá (`todayInBogota`). Quedan
sin corregir:

- Renombrar un BM escribe en tres pasos (el BM, las filas de libreta,
  `recomputeSite`), no en una función de Postgres; si el recálculo falla a
  medias, guardar la misma cota no lo reintenta. No se pierde nada: renombrarlo
  otra vez lo arregla.
- El informe del lugar calcula su serie solo con las visitas calculadas; el
  panel y las lecturas guardadas, también con las que están en medición. Una
  visita a medias en mitad de la serie cambia distinto el parcial de la
  siguiente en los dos sitios. Es a propósito: el informe no muestra una
  visita a medias.
- **Resuelto en la Fase 38**: el Excel daba solo la verificación del tramo
  peor y seguía imprimiendo `site.notes`, que el alta ya no pide. La hoja
  «Libretas» da ahora la verificación de cada tramo, con su cierre como
  fórmula, y el libro ya no imprime las notas del lugar.
- `meets_tolerance` queda en `false` en un tramo cerrado sin distancias (sin
  orden); debería quedar nulo. Ninguna pantalla ni el Excel lo leen en la
  visita: la libreta dice «Sin distancias: el cierre no da orden».
- Los puntos de la cartera llevan ubicación vacía —la hoja no la trae—;
  editar uno exige escribirla.

**El semáforo por velocidad alarma por ruido (visto en la Fase 37).** Con los
umbrales de edificio y visitas cada siete días, un milímetro son 4.35 mm/mes
—precaución— y tres, 13 mm/mes —alarma—, con una mira que resuelve el
milímetro: las visitas 1 a 4 de la cartera real (2 a 5 en la hoja) salen en alarma por
velocidad. El margen de ruido (§ 6) se aplica a los avisos de tendencia, no al
semáforo. Quedó fuera de la fase, como petición aparte en `pendientes.md`
(«Semáforo por velocidad con margen de ruido»).

**Las visitas en medición no cuentan igual en todas partes (Fase 37).** El
informe del lugar (`siteReportOf`) y el KPI de alertas del dashboard solo
cuentan las visitas calculadas (también la elegibilidad del consolidado, hasta
la Fase 38). El panel del lugar y el Excel calculan el histórico con todas,
también las que están en medición, con los puntos que ya tienen leídos —salvo
los avisos de tendencia del Excel, que desde la Fase 38 salen de
`siteReportOf`—; y el hub (`getSiteSummariesByProject`)
reduce el `alert_status` persistido de todas las lecturas del lugar, de
cualquier visita y estado. Una visita a medias puede mover el semáforo del hub
y del panel antes de entrar al informe.

**El punto auxiliar se pregunta en cada visita (Fase 37, decisión 11 tal
cual).** La plantilla copia las armadas de la visita anterior, con su punto de
cambio; si el auxiliar no se guardó en los BM del lugar («Solo en esta
visita»), terminar esa armada vuelve a preguntar en la visita siguiente. Nada
recuerda la respuesta; guardarlo como BM la detiene.

**Lo que la Fase 37 dejó sin uso.** Siguen en el código —varias con sus
pruebas—, pero ninguna pantalla las usa:

- `ActionBar`: lo montaban el editor de la visita y el formulario del lugar;
  cada popup guarda. `UnsavedChangesGuard`, que iba con él, ya se borró.
- `Drawer`: solo lo muestra `/design-system` (el registro de nivelación de la
  visita pasó al paso de Libreta).
- `PrecisionOrderSelect`: ningún módulo declara ya su orden.
- `InvalidNumbersContext`: su último usuario fue el editor de la visita.
- `LevelEquipment` —y `TotalStationEquipment`, desde la Fase 35—: las altas
  piden solo la identidad del equipo (`EquipmentIdentity`).
- `turningPointBlocker`: bloqueaba el cierre de la visita.
- `compensation: "within_tolerance"`, el valor por omisión de
  `computeLeveling`: la nivelación compensa siempre y la visita nunca.
- `closed` y `rejected` en `ProcessStatus` (abajo).

**Columnas que la Fase 37 dejó sin pedir.** `settlement_visits.level_type`,
`km_precision_mm` y `equipment_calibration_date`: el popup de la visita pide
solo marca, modelo y serie, y la demo y el seed los siguen escribiendo; desde
la Fase 38 el Excel tampoco los muestra (la libreta de cada visita lleva el
nivelador, la línea del equipo y la nota). `sites.notes`: el popup del lugar
solo pide la descripción y duplicar el lugar la copia; el Excel la mostraba
como «Notas» hasta la Fase 38.
`settlement_book_readings.elevation_corrected` y `correction_applied`: sin
compensar, se guardan iguales a la cota medida y a cero, y el módulo ya no los
lee. Borrarlas es una migración destructiva para cuando nada las lea (el PRD
de la fase dejó fuera las de equipo).

**Cabos menores de la Fase 37.** Anotados sin corregir:

- La página `/design-system` conserva textos de ejemplo del cierre:
  «Cerrado», «Cerrado fuera de tolerancia», el filtro «Cerrados» y «Un proceso
  cerrado es inmutable». Es la guía de estilo, fuera de la fase.
- **Resuelto en la Fase 38**: el mensaje de `createReportAction` («Alguno de
  los procesos elegidos ya no se puede incluir (no está cerrado…)») y el
  comentario de `reports/new/page.tsx` que hablaba de `status = 'closed'`,
  los dos de antes de `getReportableWork`, salieron con los consolidados.
- La descripción del «Proyecto de ejemplo» (`fixtures.ts`) nombra a Torre
  Alameda como el control de asentamientos y no menciona la cartera real.
- La cabecera de `lib/demo/libreta-asentamientos.ts` sigue diciendo que la
  libreta se genera para dar las cotas **compensadas**; sin compensar, cada
  cota se aparta de la serie en su parte del cierre (§ 6).
- La nota del popup de nueva visita se calcula con la plantilla a la fecha de
  hoy: si la fecha elegida da de baja un punto, cuenta uno de más.
- En la pestaña BMs, «Visitas» cuenta las visitas en que un tramo arranca en
  el BM, y el aviso al editarlo, las que lo nombran en cualquier fila: dos
  cifras distintas para el mismo BM, cada una con su rótulo.
- La pestaña BMs recalcula cada nivelación calculada del proyecto, con una
  consulta por nivelación, para ofrecer sus cotas ajustadas.
- La cabecera de `scripts/resincronizar-asentamientos.mjs` dice que el panel,
  el informe y el Excel recalculan en vivo y que solo el hub y la cabecera de
  la visita leen lo guardado. No es exacto: los tres recalculan los
  asentamientos, pero desde las cotas guardadas en
  `settlement_readings`, que son las que el script corrige; la cabecera de la
  visita calcula su verificación en vivo desde la libreta.
- El seed no se ejecutó al cerrar la fase: exige `db reset` y la base local
  era compartida con otra sesión. Su lógica es la de la demo
  (`insertarVisitas`, `insertarCartera`), que se verificó con un usuario nuevo.

**Cerrado en la Fase 37 — `npm run lint` ya no recoge otras sesiones.** El
worktree de otra sesión bajo `.claude/`, con su `.next/`, hacía fallar el lint
con 613 errores ajenos; `eslint.config.mjs` ignora `.claude/**`, que ya estaba
en `.gitignore`.

**Un punto del catálogo que se mueve (correcciones de la Fase 35).** El popup
del amarre corrige las coordenadas de un punto del catálogo, como ya hacía la
pestaña Configuración. Una poligonal que lo tiene **de referencia** guarda el
azimut resuelto, pero `resolveStartAzimuth` lo vuelve a leer del catálogo en
cada guardado: toma el azimut nuevo la próxima vez que se guarde, desde
cualquier popup, y hasta entonces el informe dibuja la referencia en su sitio
nuevo con el azimut viejo. Las que lo tienen de partida o de llegada no
cambian: guardan sus propias coordenadas. El popup del amarre nombra esas
poligonales antes de guardar; la pestaña Configuración no avisa.

**Cerrado en las correcciones de la Fase 35 — el amarre se guarda en una
transacción** (`20261007010000_amarre_atomico.sql`): los puntos del amarre
viajan con el guardado y los escribe `save_polygonal_process`. El texto
original queda como registro. El popup movía los puntos en el catálogo
(`ensureCatalogPointAction`, uno por llamada) **antes** de guardar el
proceso, y no en la misma transacción: si el guardado fallaba después, el
catálogo quedaba corregido y el proceso con el amarre de antes.

**Columnas de la nivelación que ya no se leen (Fase 36).** `level_type`,
`km_precision_mm`, `equipment_calibration_date`, `correction_method`,
`has_warnings` y `warning_messages` siguen en `leveling_processes`: el alta
pide solo la identidad del nivel, hay un solo método y nadie escribe ni lee
los avisos. El Excel muestra el tipo de nivel de los procesos que lo tienen
—desde la Fase 38, ni la σ ni la calibración—, y la demo y el seed aún
escriben `level_type`, `km_precision_mm` y `equipment_calibration_date`. Borrarlas es una migración
destructiva para cuando nada las lea (fuera de alcance en el PRD de la fase).

**El orden y las cotas guardados de las nivelaciones anteriores a la Fase 36.**
Hasta su primer guardado, `precision_order` y `meets_tolerance` guardan lo que
el usuario declaró y el veredicto de antes, y una nivelación fuera de
tolerancia guarda sus filas **sin compensar** (riesgos 1 y 2 del PRD). La
cabecera, Libreta, Compensación, el informe y el Excel (desde la Fase 38 con
`computeLevelingDetected`; antes, con `levelingRecordOf`) calculan en vivo;
el «Cumple» del hub y del dashboard lee lo guardado, y puede marcar ✕ una
nivelación que alcanza un orden. Se corrige sola al guardar la
nivelación (cualquier popup); si hiciera falta de una vez, un script que
re-guarde cada nivelación con `levelingRecordOf` tras el paso 1.

> Sin datos afectados desde la regeneración de la demo (Fase 37, § 13): las
> dos nivelaciones de producción eran las de la demo, y se recrearon con el
> orden detectado.

**Cabos menores de la revisión de la Fase 36.** Quedaron anotados sin
corregir, ninguno en el camino de la captura por armada:

- `levelingInputOf` no pasa `distances_reconstructed`: un proceso de la Fase 9
  nunca re-guardado se ve con la regla del acumulado desde el origen.
- Editar una armada del medio cambia a `pc` un BM interior declarado en un CSV
  o en el editor viejo.
- La llegada de una cerrada se reconoce por el tipo `bm`, no por el código del
  BM de partida: si se cambia una abierta a cerrada, su último BM cuenta como
  llegada y todo el desnivel se reparte como error, con el aviso de que no
  alcanza ningún orden.
- El informe de una cerrada o de enlace sin distancias dice «Sin vuelta ni BM
  de llegada…». (En el Excel, «Tolerancia del orden alcanzado» mostraba la del
  ordinario si no alcanzaba ninguno; desde la Fase 38 el libro da la
  tolerancia de cada orden.)
- Duplicar copia el `precision_order` en la copia sin lecturas.
- `draftWithBm` compara códigos con `===`, no con `samePointCode`.
- `lib/reports/leveling-data.ts` importa de `components/leveling/leveling-save`:
  el borrador y la entrada del motor podrían vivir en `lib/`. Desde la Fase 38
  también las rutas `export/` de la nivelación y de la poligonal
  (`components/polygonal/polygonal-save`).
- Faltan pruebas de frontera de `detectLevelingOrder` por tipo y de una
  cerrada con vuelta que exija los dos recorridos; la de pgTAP del paso 1
  (reabrir lo cerrado) era una sentencia copiada y con el paso 2 ya no se
  puede simular.
- Una fila huérfana de una libreta vieja que no encadena no tiene lápiz: se
  repara quitando armadas o reimportando.
- **Resuelto en la Fase 38**: la captura 30 del manual, que era anterior al
  botón de imprimir de la cabecera de la poligonal (Fase 35), se regeneró con
  el paso Informe y su «Exportar PDF».

**El estado de la nivelación conserva `closed` y `rejected` en el tipo.**
`LevelingProcess.status` reutiliza `ProcessStatus`, el de la poligonal y los
procesos de antes; la base ya no los admite (paso 2 de la Fase 36). Desde la
Fase 37 tampoco los usa el control de asentamientos: la visita tiene su propio
`VisitStatus` (`draft`, `in_progress`, `calculated`) y el lugar no tiene
estado, pero `PROCESS_STATUSES`, `PROCESS_STATUS_LABELS` y
`PROCESS_STATUS_TONE` aún los traen. Quitarlos es una limpieza del tipo.

**Columnas de la poligonal que ya no se leen (Fase 35).** `angle_readings_min`,
`equipment_calibration_date`, `angular_precision_seconds`,
`distance_precision_mm` y `distance_precision_ppm` siguen en
`polygonal_processes`: el alta pide solo la identidad del equipo y no hay
mínimo de lecturas. Los procesos anteriores las conservan y duplicar las
copia; el Excel las mostraba hasta la Fase 38. La demo y el seed aún escriben
`angle_readings_min`.
Borrarlas es una migración destructiva para cuando nada las lea (fuera de
alcance en el PRD de la fase).

**El orden guardado de las poligonales anteriores a la Fase 35.** Hasta su
primer guardado, `precision_order`, `angle_type` y `meets_tolerance` guardan lo
que el usuario declaró (riesgo 2 del PRD). La cabecera, Ajuste, el informe y el
Excel detectan en vivo; el «Cumple» del hub y del dashboard lee
`meets_tolerance` guardado, y puede marcar ✕ una poligonal que alcanza el
ordinario. Se corrige sola al guardarla; si hiciera falta de una vez, un
script que re-guarde cada poligonal con `computePolygonalDetected`.

**`DmsInput` nombra «Grados» a su primer campo.** Su `aria-label` manda sobre
la etiqueta visible, así que un lector de pantalla oye «Grados» y no «Lectura 1»
ni «Azimut a la referencia». Salió al verificar los popups de la Fase 35 (los
scripts de prueba tienen que buscar el campo dentro de su `fieldset`); es del
sistema de diseño y anterior a la fase.

**La ruta va colocada en la barra con `position: fixed` (Fase 33).** El hueco
lo marcan `--ruta-inicio` y `--ruta-fin` en `globals.css`, medidos en pantalla
con el logo y los enlaces de hoy. Si cambia el logo, o se añade o se renombra
un enlace de la barra, hay que volver a medirlos: si no, la ruta pisa los
iconos. Ningún test lo detecta; lo detecta la verificación en pantalla, que
mide el solape a 320, 390, 639, 640 y 1280 px, también con un nombre largo.
Tampoco funciona si un antecesor de la ruta crea un bloque contenedor para
`fixed` (`transform`, `filter`, `backdrop-filter`): hoy ninguno lo hace. Y
cualquier capa nueva que deba ir por encima de la barra tiene que salir de
los contextos de apilamiento de sus antecesores, como `Modal` y `Drawer`, que
van en un portal. Entre 640 y unos 860 px la ruta se trunca por igual y el
nombre de la página actual es lo que menos se lee; darle prioridad sin que la
ruta desborde sobre los iconos queda para HC2.

**Solo puede registrarse el dueño de la cuenta de Resend.** El remitente de
pruebas `onboarding@resend.dev` únicamente entrega a esa dirección; a cualquier
otra, Resend responde 403 y el correo no sale. Mientras siga así, nadie más
puede crear una cuenta, y los correos que sí salen caen en spam.

Para abrirlo —jurado, compañeros, cualquier prueba con terceros— hay que
verificar un dominio propio en Resend y cambiar el remitente a ese dominio. Es
configuración de paneles, no código. Ver § 13.

**`relative_precision` se persiste como texto ya formateado.** La presentación
ya es una sola: `formatPrecision` (`lib/utils/format.ts`) es el único
formateador y lo usan el hub, el veredicto del paso Ajuste, el informe y su
resumen de precisión —comprobado en la Fase 24; el Excel lo usó hasta la Fase 38, que
escribe la precisión como número, la X de 1:X, con fórmula—. El «`1:1001` en
el listado y `1:1.001` en el editor» que registraba esta entrada era de antes
de unificarlo.
Lo que queda es guardar el número en vez de la cadena, y la Fase 24 decidió
**no hacerlo**: la columna está en procesos cerrados, migrarla exigiría saltarse
la inmutabilidad, y `parsePrecision` ya ordena bien. Desde que nada se cierra
(Fases 35 a 37) ese obstáculo ya no existe; sigue sin hacerse porque el orden
ya es correcto. El texto original sigue como registro.

El problema de ordenamiento que esto causaba ya está sorteado: `parsePrecision`
(`src/lib/process-list.ts`) extrae el valor numérico antes de comparar, para que
`1:46` no quede después de `1:1001`. Lo único pendiente es guardar el número
en vez de la cadena.

**Cerrado en la Fase 27 — el rechazo del amarre tiene test** (`referenceStartAzimuth`, en `validators/polygonal.ts`), con un mensaje propio para un punto que no está en el catálogo y la consulta filtrada por el proyecto del proceso. El texto original queda como registro. **El rechazo de un amarre sin coordenadas no tiene test automatizado.** El
selector de punto de amarre excluye los `reference_points` sin `north`/`east`
—verificado en la app— y `resolveStartAzimuth` en la Server Action los rechaza,
pero esa guarda solo está cubierta por inspección de código. Importa porque la
acción es alcanzable con un payload construido a mano, sin pasar por el
selector.

**Cerrado en la Fase 24 — el código de punto ya no se corta**: el campo de
escritorio mide `w-32`. El texto original queda como registro. **El campo de
código de punto trunca los códigos largos.** El input de la tabla
de estaciones mide `w-24` y «Famarena_5» se ve como «Famaren». El valor está
intacto —la tabla de resultados lo muestra completo—, es solo el ancho. Previo a
la Fase 7; se arregla cuando se toque el sistema de diseño de la tabla.

**Cerrado en la Fase 24 — la tarjeta desglosa por estado**: «15 procesos · 11
en curso · 3 cerrados · 1 rechazado» (`processCountsLabel`,
`lib/process-counts.ts`). **Desde la Fase 37 vuelve a decir solo el total**
(«6 procesos»): sin cierre, el desglose ya no distinguía nada. El texto
original queda como registro.
**`getProcessCountsByProject` no distinguía el estado del proceso.** La tarjeta
dice «7 procesos» contando borradores, calculados, cerrados y rechazados por
igual. Desde la Fase 5 cuenta los tres módulos (poligonales, nivelaciones y
lugares de control de asentamientos, un lugar = un trabajo); desde la Fase 22,
sin los lugares de agrupación. Sigue sin haber desglose del tipo «7 procesos
(2 cerrados)».

**Cerrado — el helper `Block` ya no está duplicado (Fase 22).** Los
`loading.tsx` usan `Skeleton` del sistema de diseño.

**Cerrado — las migas viven en el Server Component (Fase 22).** Las tres
pantallas de proceso arman su cabecera, con las migas, en la página
(`ProcessShell`, hasta que las Fases 35 a 37 la cambiaron por la cabecera en
tarjeta de cada módulo); los editores ya no reciben `projectName`.

**Cerrado en la Fase 24 — las altas tienen su esqueleto** (`FormLoading`, en
`components/process/`), y la tarjeta de proyecto gana el fondo `sel` al pasar
el cursor. El texto original queda como registro. **Faltaban `loading.tsx` en
las rutas de alta.** Desde la Fase 22 las tres
pantallas de proceso —y con ellas la visita y su editor— tienen su esqueleto
(`ProcessLoading`); antes mostraban el del hub. «Nuevo proyecto» y los `new`
de cada módulo siguen heredando el del proyecto o ninguno.

Cerrado en la Fase 24 (arriba): **`ProjectCard` no tenía hover de fondo**, a
diferencia de las filas del hub; hoy lleva `hover:bg-sel`.

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

**Cerrado en la Fase 23 — dos cabos sueltos de la Fase 9.** Si a la ida o a
la vuelta les faltan distancias, la tolerancia de la discrepancia no se evalúa
(queda nula, y una abierta con vuelta no se cierra), y `validateRunCapture`
exige `order` y `distancesReconstructed`. El texto original queda como
registro. Los detectó la revisión del PR y se dejaron sin arreglar por
acotados. Iban a la **Fase 23** (I4 en `pendientes.md`):

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

**Retirado en la Fase 36 — el equilibrado de visuales** (decisión 7 del PRD de
la fase): no es parte del ajuste y quitarlo no cambia ninguna cota. Salieron
los avisos por armada y por sección, en la nivelación y en la visita. El
registro de cómo se llegó a ellos queda abajo.

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
10.8 m de diferencia; el límite del orden es 10 m».

**Con la norma y el acumulado desde la Fase 32 (D-3).** Los límites por
armada eran 2/3/4/6 m, sin fuente; ahora son los de la FGCS (1984), § 3.5:
2/5/10/10 m. Y `validateSectionBalances` controla el **acumulado de la
sección**, Σ(d_V+ − d_V−) de BM a BM, con 4/10/10/10 m: el error de
colimación de una sección es C·ΣΔs (NGS 3, § 5.5.2), y una ida y una vuelta
que se desequilibran igual se sesgan igual sin que la discrepancia lo vea (El
Verjón: +53.3 y −52.2 m). Sin BM de cierre se juzga en la última armada, así
que avisa mientras se captura. Va en `warnings.sectionBalance`, en la V− que
cierra la sección. Las dos comparaciones llevan un margen de 10⁻⁹ m: `35.2 −
30.2` da 5.0000000000000036 y una armada justo en el límite avisaba. La app no
aplica la corrección de colimación −C·ΣΔs, que necesita la C medida.

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
  con tests. Sin cierre, salió con la poligonal (Fase 35) y la nivelación
  (Fase 36).

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
 where status='calculated' and meets_tolerance is null
   and not (type = 'open' and not has_return_run);
```

Debe devolver cero filas. Si devuelve alguna, esos procesos hay que
recalcularlos y guardarlos antes de desplegar, o no podrán cerrarse. Desde la
Fase 23 la abierta **con vuelta** también exige veredicto; si una sale en la
consulta, le faltan distancias y no se cerrará hasta tenerlas.

> Sin efecto desde las Fases 35 y 36: la poligonal y la nivelación ya no se
> cierran, y la consulta no protege nada.

**Cerrado en la Fase 28 — ida y vuelta entran en la compensación**, y cada
punto leído dos veces recibe una cota adoptada (ver § 6). El texto original
queda como registro. **El desnivel adoptado (`adoptedHeightDifference`) no alimenta la
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
vuelta. La auditoría del cálculo (Fase 26, D-1) recomienda que entre —ida y
vuelta son dos observaciones del mismo desnivel— y el usuario lo pidió para
una fase posterior: CR1 en `pendientes.md`.

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
| `savePointAction` | **C0** (y las coordenadas, hasta la Fase 29) | **no estaba documentada** |

`savePointAction` importa porque el acumulado es `(cota − C0) × 1000`: corregir
la cota base de un punto deja obsoletas todas sus lecturas persistidas. Es
literalmente el aprendizaje que la Fase 5 dejó escrito —una caché derivada
diverge por todas las puertas que alimentan el mismo cálculo, no solo por la
que se documentó primero— y confirma que conviene enumerar las entradas antes
de dar por acotada una limitación de este tipo.

Las visitas **cerradas** no se reescribían nunca: conservaban la clasificación
con la que se cerraron, por trazabilidad. Verificado contra la base moviendo la
app real: con el arreglo, bajar el umbral de acumulado de 25 a 5 mm reclasifica
24 de 36 lecturas; sin él, las 36 conservan el criterio viejo. Con los umbrales
en 0.1 mm, las visitas abiertas escalaban a `alert`/`alarm` y la cerrada
mantenía su `normal`. **Desde la Fase 37 ninguna visita se cierra**, y
`resyncSiteReadings` y la propagación de `save_visit` reescriben todas; a las
puertas se suman borrar una visita (`resyncSiteReadings`) y la cota o el código
de un BM del lugar (`recomputeSite`, que recalcula también las cotas).

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
> con `--aplicar` las visitas abiertas mediante `resyncSiteReadings`. Desde la
> Fase 37 recalcula todas las visitas con `recomputeSite`, sin compensar: es
> el paso 2 de su despliegue (§ 13).

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

**Cerrado — el lugar «General» del backfill ya no infla el conteo (Fase
22).** Se resolvió con la columna `sites.kind` (§ 4): los lugares de
agrupación salen del hub, de los conteos y de los informes. El texto original
queda como registro. La migración de la Fase 5 crea un lugar `General`
por cada proyecto con procesos existentes y les asigna ese `site_id` (ver
§ 4). Ese lugar en sí mismo no representa ningún monitoreo real, pero
`getProcessCountsByProject` lo cuenta igual que un lugar de control genuino:
un proyecto que antes tenía «7 procesos» ahora puede mostrar «8» sin que se
haya creado ningún trabajo nuevo. No se corrige aquí porque distinguir «lugar
artefacto del backfill» de «lugar real sin visitas todavía» no tiene una
señal limpia en el esquema actual (los dos son un lugar `active` sin
visitas).

> **Visto de nuevo en la Fase 21.** El proyecto de ejemplo cuelga sus
> poligonales y nivelaciones de un lugar «Levantamientos de campo», y el hub lo
> cuenta como un control de asentamientos más: «Control de Asentamientos (2)»
> con uno solo real. Es la misma raíz —todo proceso tiene lugar, y el conteo
> no distingue un lugar de monitoreo de uno que solo agrupa—.

**Cerrado — `niceTicks` y `computeDifferentials` cubren sus casos extremos.**
`computeDifferentials` ya no existe: la Fase 29 la quitó con las coordenadas
de los puntos. El texto queda como registro.
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
número varía—, que una visita cerrada no se devolvía nunca (desde la Fase 37,
cualquier visita cuyos valores difieran), que la velocidad que llega como
cadena no marca una fila como cambiada, y que se devuelven solo las lecturas
alteradas y no la visita entera.

Hasta la Fase 11, `readingChanged` comparaba la velocidad sin redondear del
motor con la persistida en `DECIMAL(8,2)` (−3.4364… frente a −3.44), así que
**toda** lectura abierta parecía cambiada y cada guardado de visita reescribía
el lugar entero. No corrompía valores —reescribía los mismos—, y por eso
ningún test ni ninguna pantalla lo delató: salió al simular el script de
resincronización sobre un lugar recién sembrado, que contó 31 lecturas «a
reescribir» sin nada que cambiar. Ahora se compara con tolerancia de media
centésima.

Queda en pie parte de la limitación de fondo. Desde la Fase 23 la escritura
de la visita —purga, cabecera, libreta, lecturas y propagación— vive en la
función `save_visit`, que sí tiene pruebas contra la base local (pgTAP, § 9).
Desde la Fase 37 la carga de `saveVisitAction` sale de `visitRecordOf`, que
tiene pruebas (§ 9). Desde la revisión final de la Fase 37, `recomputeSite`
tiene pruebas con un cliente simulado (`settlement-sync.test.ts`). Sigue sin
cobertura `resyncSiteReadings`, que se verificó comparando la base antes y
después, y con la simulación del script de resincronización.

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

**La E/S de los Server Actions sigue sin tests, salvo los cuatro guardados.**
Es la deuda de fondo que la Fase 6 acotó pero no eliminó. La parte que
**decide** qué escribir ya está cubierta por funciones puras
(`settlement-persistence.ts` y, desde la Fase 37, `visit-record.ts`;
`close-status.ts` y `reopen.ts` salieron con el cierre, en las Fases 35 a 37,
y `reports/eligibility.ts` con los consolidados, en la 38). La que
**escribe** en los cuatro guardados de varias tablas pasó en la Fase 23 a
funciones de Postgres con pruebas pgTAP contra la base local (§ 3 y § 9); esa
misma vía sirve para probar triggers y RLS. Lo demás —`resyncSiteReadings`,
las acciones de una sola tabla y el armado de las cargas en TypeScript— sigue
sin cobertura: un cliente simulado (como el de `settlement-sync.test.ts` o
`paginate.test.ts`) prueba qué se pide, no lo que la base hace con ello, y
depende de verificación manual contra la base.

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

El script quedó en el repositorio como registro, pero ya no corre: pide
`projects.precision_order`, que la Fase 8 borró, y la guarda de lo cerrado no
tiene nada que saltar desde la Fase 35. Habría que adaptarlo antes de volver a
usarlo.

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
> asentamientos). Ver § 4, «Precisión y equipo, por proceso». Desde la Fase
> 37, en asentamientos, la verificación de esa visita en vez del orden.
> Nota de la Fase 38: con los libros nuevos, cada «Resumen» lleva el proyecto
> (`projectPairs`) y, en la poligonal y la nivelación, el equipo del proceso;
> el orden va en el bloque de cierre de la hoja de cálculo, y en asentamientos
> el equipo de cada visita va en su libreta.

**Cerrado — las capturas del manual ya no llevan el indicador «1 Issue» de
Next.** En desarrollo, React usa `eval()` para reconstruir pilas de llamadas y
la CSP no incluye `'unsafe-eval'`, así que Next muestra un indicador rojo
sobre la página. Desde la Fase 18 el script de capturas —desde la Fase 42,
`docs/manual/recorridos/comun.mjs`— oculta `nextjs-portal` antes de cada
captura y todas se regeneraron sin él. La CSP no se relajó: abriría
`eval` en desarrollo solo por una captura.

**Cerrado en la Fase 23 — la C0 de un punto con lecturas cerradas**, y
**retirado en la Fase 37**: sin visitas cerradas, la C0 se cambia siempre, con
el aviso previo de cuántas visitas cambian (`pointImpactAction`), y el trigger
salió en el paso 1 (§ 5). Hasta entonces un trigger y `savePointAction` la
bloqueaban, y el catálogo lo explicaba; también las coordenadas, hasta que la
Fase 29 las quitó. El texto original queda como registro: la C0 de un
punto vigente seguía siendo editable aunque tuviera lecturas cerradas (Fase 11,
fuera de alcance). El acumulado se recalcula en vivo
contra la C0, así que corregirla reescribe el histórico que el panel, el
informe y el Excel muestran para visitas ya cerradas —las persistidas no
cambian, pero dejan de coincidir con la pantalla—. La Fase 11 lo cerró solo
para los puntos **de baja**, que ya no se editan. Para los vigentes, la regla
natural es bloquear la C0 en cuanto el punto tenga una lectura cerrada. Va a
la **Fase 23** (I2 en `pendientes.md`).

**Resuelto en la Fase 32 — el margen del aviso de lectura fuera de
tendencia.** Era fijo por orden (Fase 12): un circuito de referencia de 250 m
(`TREND_DEVIATION_REFERENCE_KM`), equivalente a dos circuitos de 0.5 km. La
auditoría (D-7) recomendó derivarlo de la longitud real, y ahora sale de la
tolerancia del circuito de cada visita (§ 6, «Lectura fuera de tendencia»).
Las visitas sin libreta no tienen longitud y cuentan como 0.5 km. «Acelerando»
tiene su propio margen, el de las tres cotas de sus dos velocidades. No se hizo
umbral editable: se acabaría ajustando para silenciar el aviso. **Quedaba sin
validar contra una serie real**: Torre Alameda es sintética, y en ella el
margen bajaba a 2.8 mm sin dar avisos.

> **Simplificado en la Fase 37** (decisión 17): la visita ya no declara orden
> y su libreta puede no tener distancias, así que el margen vuelve a ser fijo,
> el de dos visitas sin libreta en tercer orden: 6 mm (§ 6). Ya hay una serie
> real, la cartera: con el margen fijo, B10 avisa «excesiva» en la visita 2 y
> «contraria» en la 3 (desde 0, Fase 43), donde la hoja tiene el salto de
> −50 mm y su vuelta. El
> margen no llega al semáforo por velocidad (arriba).

**Tres componentes del sistema de diseño conocen el dominio.** La § 8 dice que
un componente del sistema de diseño no importa nada de `@/types/*` ni de
`@/lib/*` salvo `cn`, y lo presenta como «criterio verificable leyendo los
imports». Verificado al cerrar la Fase 13: `status-indicator.tsx` importa
`AlertLevel`, y `precision-order-select.tsx` y `equipment-fields.tsx` importan
tolerancias y tipos del proyecto. `AngleInput`, que iba a ser el cuarto, se
movió a la poligonal. O se mueven los tres, o se matiza la regla para admitir
componentes de formulario del dominio; lo que no puede seguir es la regla
afirmando algo que el código contradice.

> **Cerrado en la Fase 20: se matizó la regla.** La § 8 admite ahora
> utilidades genéricas (`cn`, el analizador de números, la cookie de tema) y
> nombra estos tres como excepciones: controles de formulario del dominio que
> usan los tres módulos.

**Cerrado en la Fase 24 — la fila de escritorio de la tabla de estaciones
nombra cada campo** con el número de estación: código, sentido, distancia y
cada lectura de ángulo (un grupo con nombre alrededor de «Grados», «Minutos» y
«Segundos»). El texto original queda como registro. **El campo de distancia de
la tabla de estaciones no tiene nombre accesible en escritorio.** En la vista de tarjetas (móvil) lleva `aria-label="Distancia
(m)"`; en la tabla de escritorio, ninguno, y un lector de pantalla lo anuncia
como «campo numérico» sin más. Se vio al verificar la Fase 13 con Playwright,
que no pudo localizarlo por su etiqueta.

**CSP sin nonce (`'unsafe-inline'` en scripts y estilos).** La política que
sirve la app permite código en línea porque Next lo inyecta y la app usa
`style={{…}}`. Endurecerla con un nonce por petición exigiría generarlo en
`src/proxy.ts` y propagarlo por el árbol (las rutas ya son todas dinámicas
desde la Fase 20, por la cookie del tema).
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

`npm audit` quedó entonces en **0 vulnerabilidades**, producción y
desarrollo. Si un override deja de hacer falta porque el padre se actualiza,
se puede quitar y comprobar con `npm audit` que sigue en cero.

**Cerrado el 2026-10-09**: `next` pasó a 16.3.8 —el parche de la misma
línea, que el aviso cubre hasta 16.3.7— y `npm audit fix` puso al día `sharp`
y `source-map-js`. En producción, `npm audit --omit=dev` da **0**. Con
desarrollo quedan 5 altos en la cadena de `braces` (herramientas de
desarrollo, no se despliegan), que solo se corrigen con `--force` y cambios de
versión mayor. El texto original queda como registro.
**Abierto de nuevo (2026-10-08): avisos nuevos de `npm audit`.** En
producción (`--omit=dev`) da 4: 1 crítico y 3 altos. El crítico es `next`
16.3.3 (RCE en `next/og`, SSRF en la optimización de imágenes,
envenenamiento de caché), que se corrige en 16.4.0. Los altos son `sharp` y
`source-map-js`, y con desarrollo suben a 11. La app no usa `next/og` ni
`ImageResponse`. Toca actualizar `next` (fuera del rango declarado, así que es
una decisión del usuario) y revisar los overrides.

**Cerrado en la Fase 26 — la auditoría del motor de cálculo**
([`../auditoria-calculo.md`](../auditoria-calculo.md)). Cuatro revisiones
independientes confirmaron las fórmulas de libro sobre todas las carteras
reales y encontraron 18 errores en esquemas que esas carteras no cubren, en
reglas de validación y en límites numéricos; la Fase 26 los corrigió, cada
uno con su test, y encontró dos más al implementar y verificar: el servidor
rechazaba guardar una cerrada con fila de cierre (C-19) y el editor no
mostraba el amarre (C-20). Los **criterios** que el usuario pidió cambiar
están todos resueltos: CR1 en la Fase 28, CR2 en la 30 —después de que la 29
retirara su distorsión, D-9—, CR4 en la 31, que quitó D-4 y D-5, y CR3 en la
32 (D-3, D-6 y D-7). El resto queda documentado en la § 2 de la auditoría,
sin cambio.

**Resuelto en la Fase 36**: con hilos, el popup de la armada (y el de la
visita, que usa los mismos `VisualFields`) muestra la distancia que dan, sin
campo para teclear otra. El texto original queda como registro. **Una distancia tecleada que los hilos tapan (Fase 26, visto al verificar).**
Con los tres hilos capturados, la distancia sale de ellos (Fase 9) y la que
se teclea en la celda se ignora, aunque la celda la siga mostrando: escribir
«−50» en una fila con hilos no da error ni cambia el cálculo. Es el diseño
—los hilos son la medición—, pero la celda debería dejarlo ver.

**Cerrado en la Fase 25 — el catálogo de equipos**, como plantilla: el
proceso copia los valores y no referencia el catálogo, así que editarlo no
cambia ningún informe (§ 4). El texto original queda como registro. **No hay
catálogo de equipos reutilizable entre procesos (Fase 8, diferido a
propósito).** Cada poligonal, cada nivelación y cada visita de asentamiento
recaptura marca, modelo, serie, fecha de calibración y precisión del
instrumento, aunque sea el mismo aparato físico que el proceso anterior. Se
evaluó una tabla `equipment` referenciada por id y se descartó
(`docs/prds/07-precision-equipo-por-proceso.md`, decisión #2): reabriría el
agujero de trazabilidad que motivó la fase, porque editar la fila de catálogo
cambiaría en silencio el equipo de los informes de procesos ya cerrados. Si
reteclear el mismo equipo en cada proceso se vuelve molesto en el uso real, se
reabre como mejora — con el congelado resuelto, no solo con menos tecleo.

**Cerrado en la Fase 27 — el alta de proyecto es un solo formulario.** Al revisarlo en pantalla salió un fallo: «Siguiente» creaba el proyecto sin mostrar el paso 2, porque React cambiaba el `type` del mismo botón antes de la acción por defecto del clic. El texto original queda como registro. **El formulario de proyecto quedó más corto (Fase 8).** Al perder los siete
campos de equipo y precisión, el paso 2 del asistente pasó de «Equipo y
precisión» a «Datum y proyección» — dos campos únicamente. Se decidió no
fusionarlo con el paso 1 porque el sistema de referencia es una agrupación
coherente por sí misma y fusionar habría obligado a rehacer la validación
nativa por paso. Queda pendiente de una revisión visual (no hecha desde este
cierre documental, que no levantó la app) para confirmar que el paso corto
sigue teniendo sentido en pantalla y no se lee como un `fieldset` vacío.

**Retirado en la Fase 38 — sin informes consolidados no hay informe emitido**:
la tabla `reports`, su portada y su trigger se borran (§ 4, § 5 y § 13). El
texto que sigue queda como registro.
**Cerrado en la Fase 23 — la portada del informe emitido y la inmutabilidad de
`reports`.** `reports.cover` congela la portada al emitir y un trigger rechaza
todo `UPDATE` (§ 4 y § 5). El usuario decidió que un informe emitido no se
reedita: se elimina y se genera otro. El texto original queda como registro:
la portada del informe emitido seguía leyendo el proyecto en vivo, y `reports`
no tenía trigger de inmutabilidad. Iba a la **Fase 23** (I3 en
`pendientes.md`). El pie del informe imprimible dice que se emitió con
procesos cerrados, y desde la Fase 8 sus mediciones, equipo y veredicto no
cambian. Desde la Fase 15 la **posición** de una poligonal cerrada puede
cambiar al georreferenciarla —decisión del usuario, con nota en el informe—.
No es cierto para el resto de lo que sale impreso:

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

**Resuelto en la Fase 32 — la banda de σ₀.** `SIGMA0_BAND = [0.5, 2]`
(Fase 14) no tenía fuente y, con r = 2 o 3, juzgaba mal entre el 15 y el 24 %
de los ajustes correctos. Su pariente con fuente, la banda de USACE, es sobre
σ₀² y está pensada para redes con mucha redundancia: con r = 2 o 3 fallaría
la mitad de las veces. La sustituye la prueba χ² bilateral al 95 % de su r
(§ 6). Sigue sin decidir nada: solo cambia el texto.

**Resuelto en la Fase 35**: al pasar a sin control desde «Editar datos», el
guardado escribe Brújula y conserva los pesos, y el paso Ajuste no muestra el
selector, así que volver a mínimos cuadrados no los pide de nuevo. El texto
original queda como registro. **Mínimos cuadrados en una abierta sin control (Fase 14).** El selector no lo
ofrece ahí, pero un proceso con el método al que después se le cambia el tipo
a sin control lo conserva: el panel muestra entonces el selector para elegir
otro, y el guardado lo rechaza con un mensaje hasta que se cambie. No se
reescribe el método en silencio porque sería perder los pesos.

**Cerrado en la Fase 23 — la georreferenciación en una transacción.**
`georeference_polygonal` escribe la cabecera y las estaciones juntas (§ 3). El
texto original queda como registro. La georreferenciación no era atómica
(Fase 15; iba a la Fase 23, I1). La acción escribía la
cabecera y después cada estación con su propio `UPDATE`: PostgREST no da una
transacción que abarque varias peticiones, y una función de base se descartó
al simplificar la fase. Si falla a medias, la cabecera queda en el sistema
nuevo y alguna estación en el anterior. Se arregla georreferenciando otra
vez: el plan parte de la cabecera, ya transformada, y reescribe todas las
estaciones.

**Sin historial de georreferenciaciones (Fase 15).** Se guarda solo la última
—fecha, puntos, rotación, factor—, no las coordenadas locales ni la
traslación: por eso el Excel (Fase 38) muestra la fecha, los puntos, la
rotación y la escala, y no la traslación. Volver al
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

**Cerrado en la Fase 26 — el acumulado se suma en milímetros enteros (C-14).**
El texto original queda como registro. **El acumulado del motor se suma en
coma flotante (Fase 19).** En un empate
exacto al metro —164.5 m en la ida de El Verjón— el motor llega a
164.49999999999997 y la columna `decimal(8,3)` guarda 0.164, mientras que la
suma decimal de la migración de la Fase 19 guarda 0.165. Solo afecta a «Dist
acum», que es informativa: la corrección se calcula con el valor sin
redondear y coincide. Sumar en milímetros enteros lo resolvería; no se hizo
por acotado.

**La distancia de la columna, en km a tres decimales (Fase 26).** La
auditoría señala que `distance_accumulated_km decimal(8,3)` tiene una
resolución de 1 m, más gruesa que el dato. Pasarla a metros sería una
migración sobre procesos cerrados; no se hizo, porque la columna es
informativa y la corrección no la usa. Sin cierre desde las Fases 36 y 37, ese
obstáculo ya no existe; la razón de fondo sigue.

**Se pierden la σ del instrumento y las repeticiones (Fase 16).** La libreta
guarda una lectura por visual, así que el import promedia. Llevar a
nivelación el modelo de lecturas múltiples de la Fase 7 sería una fase
propia. Desde la Fase 37 vale también para la visita, que importa con los
mismos lectores (fuera de alcance en el PRD de la fase).

**Cerrado en la Fase 27 — la abierta con vuelta se rotula «Abierta con ida y vuelta»** (`levelingTypeLabel`) en el hub, la cabecera, el cierre, el informe, el Excel y el diálogo de importar; el selector ofrece «Abierta» y explica qué la controla. El texto original queda como registro. **«Abierta sin control» con vuelta se lee raro (Fase 16).** Es la etiqueta de
`open`, y el crudo leído como ida y vuelta queda así aunque sí tenga un
control: la discrepancia entre los dos recorridos. Cambiar la etiqueta toca
el manual y el informe; quedó fuera de la fase.

**Cerrado en la Fase 35 — un solo camino para el arranque.** «Asignar
coordenadas reales» se retiró: el popup del amarre lo sustituye, y
Georreferenciar queda en el paso de Ajuste. El texto original queda como
registro. **Dos diálogos para mover una poligonal (Fase 15).** «Asignar coordenadas
reales» (arranque + azimut, solo sin cerrar, sin anotación) y «Georreferenciar»
(dos estaciones, cualquier estado, anotado) resuelven casi lo mismo. Desde la
Fase 22 están juntos, en la tarjeta del dibujo. En la Fase 27 el usuario
decidió mantenerlos aparte; cada uno dice en una línea cuándo usar el otro.

**Los pesos no pueden guardarse fuera del rango ni de la escala de sus
columnas.** El validador rechaza σ angular fuera de 0.01″–9999.99″ o con más
de dos decimales, y σ de distancia fuera de 0.0001–9999.9999 m o con más de
cuatro: la base los guardaría redondeados y el ajuste recalculado al reabrir
no coincidiría con las coordenadas guardadas. Valida los pesos presentes con
cualquier método, porque se guardan igual; desde la Fase 35 el paso de Ajuste
solo los guarda completos y válidos, al salir del campo. Un σ de distancia de 0.05 mm,
que alguien con un distanciómetro muy bueno podría querer, no cabe: habría
que ampliar la escala de la columna.

---

**Cerrado — la gráfica del informe va en tiempo real (Fase 22).** Pasó a
`timeScale`, como el panel, y la sección del lugar suma una tabla de visitas
con el amarre y el cierre de la libreta; desde la Fase 37, con la verificación
de cada visita (§ 3). El texto original queda como registro. El panel y la
vista pasaron al tiempo real (`timeScale`), pero
`components/reports/settlement-plot.tsx` espacia las visitas de forma
uniforme: con visitas irregulares exagera la pendiente de los intervalos
largos. Tampoco lleva el amarre ni el cierre de la libreta. La decisión 13 del
PRD de la fase dejó el informe fuera; alinearlo es cambiar la escala X por
`timeScale` y añadir las dos columnas a la tabla de visitas del informe.

**Cerrado en la Fase 23 — el guardado de una visita en una transacción.**
`save_visit` hace la purga, la cabecera, la libreta, las lecturas y la
propagación juntas (§ 3); lo mismo el guardado de poligonal y de nivelación,
que la apertura de la fase encontró con el mismo patrón. El texto original
queda como registro. El guardado de una visita con libreta no era atómico
(Fase 18; iba a la Fase 23, I1).
`saveVisitAction` escribe la cabecera, la libreta, su purga y las lecturas en
peticiones separadas. Si falla una intermedia, la visita queda con la libreta
nueva y las lecturas viejas hasta el siguiente guardado, que lo repara. Es el
mismo patrón aceptado en el resto del módulo (upsert y purga, nunca borrado y
reinserción); la salida limpia es una función de Postgres que haga todo en una
transacción.

**Cerrado — un solo formato de número (Fase 22).** Gráficas, diferenciales y
panel de análisis pasaron al punto decimal y al guion, como las tablas. El
texto original queda como registro. Las gráficas
nuevas formatean con `es-CO` (coma decimal y signo menos tipográfico: «−9,3
mm»), mientras las tablas y los KPIs usan `toFixed` (punto y guion: «-9.3»).
Ya había mezcla antes —el semáforo de la última visita usaba coma—; unificar
es decidir un formateador de milímetros y aplicarlo en todo el módulo. La Fase
20 fijó la dirección (decisión del usuario): la presentación va con **punto**,
y la coma solo se acepta al teclear; al unificar, son las gráficas las que
cambian.

**Cerrado en la Fase 24 — el Excel usa la paleta de la identidad**
(`WORKBOOK_COLORS`, copias de los tokens del tema claro que un test compara con
`globals.css`). El texto original queda como registro. **El Excel conserva la
paleta anterior (Fase 20).** `lib/export/workbook.ts`
pinta los títulos y las cabeceras con el azul y los grises de antes de la
identidad del prototipo. Quedó fuera de alcance, como los correos de Supabase
Auth: son documentos fuera de la app. Llevarlo a la paleta nueva es cambiar
`ACCENT` y dos rellenos grises; el Excel no tiene tema oscuro.

**Cerrado — las filas vacías ya no muestran cota (Fase 22).** Una fila sin
V+ ni V− muestra «—». Esa tabla se retiró en la Fase 37; en la de la visita,
una fila por leer se rotula «pendiente», sin cota. El texto original queda
como registro. La tabla de
captura, compartida con nivelación, pinta la cota calculada en cada fila, y
una fila sin lecturas hereda la del punto anterior. En la libreta precargada
de una visita eso llena la columna de cotas repetidas antes de medir. Es
cosmético y existe igual en nivelación; se resolvería mostrando «—» en las
filas sin V+ ni V−.

**Cerrado en la Fase 31 — el promedio es encadenado** (`chainedMeans`, D-8):
el de la visita anterior más la media de los parciales de los puntos medidos
en las dos, así que ni las altas ni las bajas lo mueven. El texto original
queda como registro. **El promedio mezcla líneas base cuando hay altas (Fase
18, aceptado).** El
KPI «Promedio» y la línea de tendencia promedian los acumulados de la visita;
un punto dado de alta a mitad del monitoreo parte de 0 y tira del promedio
hacia arriba. El PRD de la fase lo acepta y lo dice; separar la serie por
cohortes de puntos sería el siguiente paso si molesta. La auditoría del
cálculo (Fase 26, D-8) añade que también lo mueven las bajas y recomienda el
promedio encadenado, igual al actual sin altas ni bajas: CR4 en
`pendientes.md`.

**Un `Modal` abierto sobre un `Drawer` se cierra con el mismo Esc (Fase
18).** Los dos escuchan Escape en el documento. Hoy ninguna pantalla abre uno
sobre otro; si pasa, `Modal` debe dejar de propagar el evento. Sin efecto
desde la Fase 37: ninguna pantalla monta ya un `Drawer`.

**La guarda de cambios sin guardar no cubre atrás y adelante (Fase 22).**
`UnsavedChangesGuard` detiene los enlaces internos y el navegador pregunta al
recargar o cerrar, pero el App Router no ofrece cómo detener la navegación por
el historial. Un `popstate` que devuelva al usuario sería frágil. Documentado
en el manual (§ 4.4 y preguntas frecuentes). El atributo
`data-unsaved-guard-skip`, para que un enlace no pase por la guarda, existía y
tenía test, pero ningún enlace lo usaba. **Retirado en la Fase 37**: cada popup
guarda, y `UnsavedChangesGuard` se borró con su prueba al quedarse sin
usuarios.

**Cerrado en la Fase 27 — el tipo va como frase en el hub** («Poligonal cerrada», «Nivelación de enlace»), igual que en la cabecera del proceso; el badge sigue diciendo el estado. El texto original queda como registro. **«Cerrada» y «Cerrado» en la misma fila del hub (Fase 22).** El tipo de una
poligonal o nivelación («Poligonal · Cerrada») va en el subtítulo y el estado
(«Cerrado») en su badge. Son cosas distintas —circuito que vuelve al origen y
proceso sellado— con la misma palabra, a centímetros. No se renombró ninguno:
los dos son el vocabulario del topógrafo. Si confunde en el uso, lo natural es
rotular el tipo («Circuito cerrado»).

**Cerrado en la Fase 37 — un proyecto se elimina siempre**: sin nada cerrado,
ningún trigger frena la cascada; `deleteProjectAction` borra el proyecto y
`getClosedWorkCount` salió, con el bloqueo del diálogo. El texto original queda
como registro. **Un proyecto con trabajo cerrado no se puede eliminar (Fase 22,
decisión).** Los triggers de inmutabilidad rechazan el borrado de lo
cerrado, y la cascada desde `projects` choca con ellos. Antes el error se ignoraba y la acción
redirigía como si hubiera borrado; ahora `deleteProjectAction` lo comprueba
(`getClosedWorkCount`) y la configuración propone archivar. La demo, que nace
con trabajo cerrado, tampoco se puede eliminar: su descripción dice
«archivarlo». Permitir borrar un proyecto entero con lo cerrado dentro sería
una excepción a la inmutabilidad que tendría que decidir el usuario. Desde la
Fase 34 hay un camino manual: reabrir lo cerrado, uno por uno, y entonces
borrar el proyecto. Desde las Fases 35 y 36 solo cuentan los lugares y las
visitas: la poligonal y la nivelación no se cierran.

**Ningún informe queda registrado (Fase 22, decisión; desde la Fase 38, sin
excepción).** La página de informe lo arma cada vez que se abre y no guarda
nada. Hasta la Fase 38 el registro de «qué se emitió» era el informe
consolidado, una fila de `reports`; sin consolidados, exportar el PDF o el
Excel de un proceso no deja constancia en la base de haberse emitido. Es
coherente con que el informe no guarda datos (§ 3); si hiciera falta la
constancia, bastaría con registrar la exportación.

**Retirado en la Fase 37 — reabrir**: sin cierre no hay qué reabrir, y
salieron las acciones, el diálogo, `reopen.ts`, `is_reopening` y su prueba. El
texto original queda como registro. **Reabrir no deja rastro (Fase 34,
decisión).** Reabrir borra `closed_at` y
`closed_by`, y el nuevo cierre escribe los suyos: no queda constancia de que
hubo un cierre anterior, ni de quién reabrió ni por qué. Un informe consolidado
emitido muestra lo que haya al abrirlo, y una visita cerrada se calcula en vivo
contra la anterior aunque esta se haya reabierto y corregido: el cierre en
orden de la Fase 26 (C-15) no tiene espejo al reabrir. El usuario pidió «simple
y fácil»; el diálogo avisa de los informes y de las visitas posteriores. Si
hiciera falta la trazabilidad, el camino sería una tabla de cierres (quién,
cuándo, qué estado) en vez de las dos columnas.

## 12. Manual de usuario en la app

La ruta `/manual` sirve el manual de usuario dentro de la aplicación. **A
diferencia de `/design-system`, existe en producción**: es documentación del
producto, no una herramienta de desarrollo. Vive dentro del grupo `(app)`, así
que hereda la comprobación de sesión y la barra superior (`AppBar`, Fase 33).

Desde la **Fase 42** el manual va por capítulos, uno por flujo de usuario, y
**tiene una sola fuente**: los Markdown de `docs/manual/`. La aplicación los lee
y los pinta en el servidor; no hay otra copia del texto.

### Estructura

| Archivo | Responsabilidad |
|---|---|
| `docs/manual/README.md` | La portada y el índice. Su introducción —lo que va antes de «Capítulos»— es la portada en la app; «Mantener este manual» es la guía de estilo y no se pinta |
| `docs/manual/NN-<slug>.md` | Un capítulo por flujo. La lista sale de los nombres de archivo: no hay registro aparte |
| `docs/manual/capturas.json` | El ancho y el alto de cada captura; lo escribe el recorrido |
| `docs/manual/recorridos/` | Un script de Playwright por capítulo, que hace el flujo en la app y captura cada paso (`npm run manual:capturas`) |
| `public/manual/<slug>/NN-<paso>.png` | Las capturas, una carpeta por capítulo |
| `src/lib/manual/markdown.ts` | Puro: lee los tokens (`marked`), da a cada título su ancla con el slug de GitHub y traduce enlaces y capturas a rutas de la app |
| `src/lib/manual/png.ts` | Puro: el tamaño de un PNG desde su cabecera y `ESCALA_CAPTURAS = 2` |
| `src/lib/manual/manual.ts` | Lee los archivos con `fs`, dentro de `cache()`; una vez por instancia en producción |
| `src/components/manual/markdown.tsx` | Recorre los tokens y devuelve React: pasos, figuras, notas y tablas con el sistema de diseño |
| `src/components/manual/indice-capitulo.tsx`, `navegacion-capitulos.tsx` | El índice del capítulo (fijo al lado en escritorio, en `<details>` en el teléfono) y anterior / siguiente |
| `src/app/(app)/manual/page.tsx`, `[capitulo]/page.tsx` | La portada con una tarjeta por capítulo, y la página de cada capítulo; un slug que no existe da 404 |

### Decisiones que conviene conocer antes de tocarlo

**`marked` y un recorredor propio** (`marked` 18.0.14, fijada exacta). Un solo
paquete sin dependencias; los mismos tokens sirven para pintar, para el índice
y para las pruebas. El recorredor devuelve React, así que no hay
`dangerouslySetInnerHTML` ni JS de cliente, y la CSP no cambia. Lo que el
manual no usa —HTML crudo, imágenes que no son capturas, enlaces que no
resuelven— lanza un error, y las pruebas lo atrapan antes de que llegue a la
pantalla.

**Los archivos viajan con la función.** Las rutas de `(app)` son dinámicas (las
cookies del layout), así que `/manual` lee los `.md` en cada petición.
`next.config.ts` los incluye con `outputFileTracingIncludes` para `/manual` y
`/manual/*`. **`next dev` y `next start` no usan el tracing**: un error ahí
solo aparece en Vercel, como un 500. Tras `npm run build`, compruebe que
`.next/server/app/(app)/manual/[capitulo]/page.js.nft.json` lista los `.md` y
`capturas.json`.

**Las capturas, a la mitad.** Se toman a 2 píxeles por píxel de pantalla
(1280 × 800 en escritorio, 390 × 844 en el teléfono) y se muestran a su tamaño
de pantalla: nítidas y sin el antiguo indicador `angosta`. El tamaño sale de
`capturas.json`, no de leer el PNG en la petición: así los PNG no viajan con la
función. `<img>` plano, no `next/image`, con `width`/`height` y `lazy` salvo
la primera.

**Enlaces entre archivos.** Los capítulos se enlazan como en GitHub
(`03-poligonal.md#ajustar`) y la app los traduce (`/manual/poligonal#ajustar`).
Por eso las anclas siguen el slug de GitHub y los títulos no llevan números
ni «·».

**El recorrido usa su propia cuenta**, `manual@topofield.local`. La borra
y la vuelve a registrar **por el formulario**, confirma el correo en Mailpit
—así el registro también es un flujo del manual— y deja que la primera
entrada cree el proyecto de ejemplo. Teclea desde cero las carteras reales de
`src/lib/demo/carteras*.ts` y lee de la demo Torre Alameda. El código de
invitación real no sale en la captura: se fotografía uno de ejemplo.

**Imprimir un capítulo** saca su título y su contenido: el título no va en
`PageHeader`, cuyo `<header>` se oculta al imprimir, y las figuras no se
parten entre páginas. Es lo que usa el anexo de la monografía.

### Las pruebas

`src/lib/manual/manual.test.ts`, sobre los archivos reales, comprueba:

- la numeración y los slugs;
- que el README enlaza cada capítulo, en orden;
- el resumen de cada uno;
- que cada imagen es una captura de su capítulo, existe, tiene alt y figura en
  el manifiesto con su tamaño real;
- que no sobra ningún PNG ni ninguna entrada del manifiesto;
- que todo enlace y ancla resuelve;
- que no hay «§», «Fase N», «PRD» ni HTML.

`constantes.test.ts` compara con el código las tablas del manual que lo copian:
órdenes y tolerancias, el K de la nivelación, el semáforo y los estados.
`markdown.test.tsx` pinta casos sueltos y cada capítulo real.

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

**Estado actual (2026-10-08):** la nube tiene aplicadas las **cuarenta y
dos** migraciones del repositorio, hasta
`20261010000000_sin_informes_consolidados` (Fase 38). Todas se empujaron antes
del merge a `main`, salvo las cinco que borran, que fueron después: la de la
Fase 29, el último paso de las Fases 35, 36 y 37, y la de la Fase 38 (ver
abajo). Las dos de la Fase 26 —el CHECK de
distancias por visual positivas en `leveling_readings` y `settlement_book_readings`, y el
índice único `(site_id, date)` de `settlement_visits`— se aplicaron con 0
filas que las incumplieran, contadas antes y después. La de la Fase 25 dejó
la tabla `equipment` con RLS, sus cuatro políticas, el índice único y sus
CHECK. La de la Fase 24 dejó el CHECK
`polygonal_angle_readings_dms_range` activo. Las de la Fase 23 se verificaron al aplicarse: El Verjón con su
veredicto, ningún informe sin portada, las cuatro funciones de guardado como
`SECURITY INVOKER` y sin `EXECUTE` para `anon`, sus dos triggers activos,
`reports` sin política de `UPDATE` y cero procesos calculados con el veredicto
nulo (el trigger de la C0 salió en la Fase 37 y `reports` en la 38).

La de la Fase 30 añade `settlement_book_readings.catalog_elevation` y recrea
`save_visit`; se aplicó antes del merge del PR #19. Verificado: la columna es
`numeric(10,4)`, `save_visit` la escribe, sigue siendo `SECURITY INVOKER` y
solo `authenticated` tiene `EXECUTE` (además de `postgres` y `service_role`).

El paso 1 de la Fase 35 se empujó antes del merge desde una copia del
repositorio sin el paso 2, porque `db push` aplica **todas** las migraciones
pendientes. Pasó a `calculated` la única poligonal cerrada que había, y quedaron
tres calculadas y una en curso. El paso 2 se aplicó después del merge del PR
#26, con el despliegue de Vercel ya en producción. Verificado después:
`closed_at` y `closed_by` no existen, el CHECK de `status` admite solo `draft`,
`in_progress` y `calculated`, y en la tabla queda solo el trigger de
`updated_at`.

**Correcciones de la Fase 35 — el amarre atómico** (2026-10-07,
`20261007010000_amarre_atomico`): `save_polygonal_process` gana `p_catalog`,
con valor por defecto. Se borra la firma de tres argumentos y se crea la de
cuatro, con sus permisos: el código anterior llama con tres y sigue
funcionando, así que la migración va **antes** del merge, en un solo paso.
El usuario la empujó antes del merge, con `db push` desde el worktree de la
rama: producción tenía todo hasta `20261007000000` y solo se aplicó esta.
Verificado después en solo lectura (`migration list` y un `db dump` del
esquema): queda una sola `save_polygonal_process`, la de cuatro argumentos
con `p_catalog` por defecto `'[]'`, `SECURITY INVOKER`, y `EXECUTE` solo para
`authenticated` y `service_role`.

**La Fase 36 repitió el esquema en dos pasos** (2026-10-07). El paso 1
(`20261006010000_ux_nivelacion`: las columnas del alta, `precision_order`
nulable, `save_leveling_process` ampliado, las cerradas y rechazadas a
`calculated` y fuera sus triggers de cierre) se empujó **antes** de subir
`main`, desde una copia del repositorio en `09196f0`, sin el paso 2 —`db push`
aplica todas las pendientes—: el código viejo funciona con él, porque sin
triggers su cierre solo cambia el estado. Después se subió `main` (el merge
`29891d6`; Vercel terminó de desplegar a las 15:22:57 UTC) y se aplicó el
paso 2 (`20261007000000_nivelacion_sin_cierre`: fuera `closed_at` y
`closed_by`, y el CHECK de `status` sin `closed` ni `rejected`). Los dos
`db push` y el `git push` los ejecutó el usuario: el modo automático del
agente los bloquea como despliegue a producción.

La consulta de solo lectura previa contó **dos** nivelaciones, las de la demo,
y las dos cumplían su orden declarado y estaban compensadas: **ninguna cota
guardada cambia** con la regla nueva, solo el orden, que se detecta. El
paso 1 pasó a `calculated` el tramo 2, la única cerrada. Verificado después:

- las columnas del alta existen, `closed_at` y `closed_by` no, y
  `precision_order` es nulable;
- el CHECK de `status` admite solo `draft`, `in_progress` y `calculated`, y
  las dos nivelaciones están `calculated`;
- en `leveling_processes` y `leveling_readings` queda solo el trigger de
  `updated_at`; `reject_write_on_closed_process_reading` no existe, y la
  visita conserva su trigger de cierre;
- `save_leveling_process` sigue `SECURITY INVOKER`, sin `EXECUTE` para `anon`,
  y escribe las columnas del alta y el orden.

Las dos nivelaciones de producción se leyeron en solo lectura y se calcularon
con el motor de la app (`levelingRecordOf`), contra la hoja de El Verjón y el
crudo del tramo 2:

| Nivelación | Contra | Resultado |
|---|---|---|
| El Verjón, abierta con vuelta | la hoja (24 filas iguales) | discrepancia 5.0 mm, **segundo orden** (5.3 mm); ajustadas C 1 3289.4400, C 7 3309.0535, D4 3315.0855 |
| Tramo 2, cerrada | el crudo (17 filas iguales) | cierre −0.4 mm, **primer orden** (3.5 mm); ajustadas C14 2542.2271, C18 2542.9183, C10 2541.7545 |

Lo guardado coincide con lo recalculado en cotas, alturas de instrumento y
acumulados (diferencia 0). Las dos conservan en `precision_order` el tercer
orden que declaraban hasta su próximo guardado; su «Cumple» guardado es el
mismo, así que el hub no difiere, y la cabecera, el informe y el Excel dicen
el detectado. Desde la regeneración de la demo (Fase 37), ya no: se recrearon
con el orden detectado.

Con las dos aplicadas, las poligonales de producción se leyeron en solo lectura
y se calcularon con el motor de la app (`polygonalInputOf`), contra las hojas
de `docs/carteras/`:

| Poligonal y método | Contra | Diferencia máxima |
|---|---|---|
| TT4, Brújula | hoja `BRUJULA` | 0.005 mm; ángulos, suma y error de cierre exactos |
| TT4, Tránsito y Crandall | hojas corregidas (`poligonales-corregido.xlsx`) | 0.005 mm |
| TT4, Tránsito y Crandall | hojas originales | 14.1 mm y 2.6 mm, sus defectos conocidos (§ 6) |
| Vivero, mínimos cuadrados | cálculo independiente del PRD 13 | 0.001″, 0.005 mm en las distancias y 0.045 mm en las coordenadas, que el PRD da a 0.1 mm |
| Vivero, mínimos cuadrados | hoja original | 2.2 mm: la hoja no cumple sus condiciones |

Los 0.005 mm de la TT4 son el azimut de partida, que la app guarda a la décima
de segundo (330°35′57.2″ frente a 57.23″ en la hoja). Lo guardado en
producción coincide con lo recalculado: error, precisión y coordenadas con
menos de 0.05 mm. El orden detectado es tercero en la TT4 y segundo en la
Vivero, que guardaba el tercero que se declaró antes de la fase; las pantallas
muestran el detectado. Desde la regeneración de la demo (Fase 37), se guarda
el detectado.

**La Fase 37 llevó el esquema en tres pasos** (preparados y aplicados el
2026-10-07; cómo se aplicaron, al final de este apartado). Dos migraciones y,
entre ellas, dos scripts:

| Paso | Qué | Cuándo | Código viejo con ello | Código nuevo sin ello |
|---|---|---|---|---|
| 1 | `20261008000000_ux_asentamientos.sql` y `20261008100000_bm_origen_visita.sql` (la visita que midió un BM, revisión final): fuera los triggers de cierre de visitas, lugares, lecturas, libreta y puntos —con el de la C0— y sus funciones; lo cerrado vuelve a `calculated` y `active`; `in_progress`, `precision_order` nulable y `starts_section`; `site_benchmarks` con su RLS, llena con los BM que ya usa cada lugar; `save_visit` escribe `starts_section` | **Antes** del merge | Funciona: sin triggers, su cierre solo cambia el estado; no lee `site_benchmarks` ni `starts_section`, y `save_visit` ignora el clima y el modo de captura que todavía manda | Falla: lee `site_benchmarks` |
| 2 | `scripts/resincronizar-asentamientos.mjs` (recalcular sin compensar todas las visitas guardadas) y `scripts/agregar-cartera-demo.mjs` (la cartera en las demos ya creadas), cada uno en simulación y después con `--aplicar` | **Después** del despliegue | — | Las lecturas guardadas —de las que leen el panel, el informe, el Excel y el hub— conservarían la cota compensada hasta el próximo guardado de cada visita; la demo ya creada no tendría la cartera |
| 3 | `20261009000000_asentamientos_sin_cierre.sql`: vuelve a `calculated` lo cerrado en la ventana; fuera `closed_at` y `closed_by` de visitas y lugares, `sites.status`, el clima y `capture_mode`; el `CHECK` de `status` en `draft`, `in_progress` y `calculated`; fuera `reject_update_on_closed_process()`, `reject_delete_on_closed_process()` e `is_reopening()` | **Después** del merge | Fallaría: lee, inserta y cierra con esas columnas | Funciona: ya no las nombra |

**Antes del paso 1**, en solo lectura (`db query --linked`), cuántas visitas
tienen cotas tecleadas:

```sql
select count(*) from public.settlement_visits where capture_mode = 'direct';
```

La revisión final de la fase añadió dos consultas de solo lectura antes del
paso 2. Cuántas filas de libreta tiene el lugar más grande —antes de
`allRows`, más de 1000 truncaban la lectura y un guardado borraba filas; ya no,
pero conviene saberlo—:

```sql
select v.site_id, count(*) as filas
from public.settlement_book_readings b
join public.settlement_visits v on v.id = b.visit_id
group by v.site_id order by filas desc limit 5;
```

Y qué visitas guardaron un BM de amarre con otra cota que la del catálogo del
proyecto: el paso 1 llena `site_benchmarks` con la cota de hoy del catálogo, y
el recálculo del paso 2 movería toda su serie en esa diferencia, que en la
simulación se confunde con dejar de compensar:

```sql
select v.site_id, v.visit_number, v.reference_bm_code,
       v.reference_bm_elevation, rp.elevation as catalogo
from public.settlement_visits v
join public.sites s on s.id = v.site_id
join public.reference_points rp
  on rp.project_id = s.project_id and upper(trim(rp.code)) = upper(trim(v.reference_bm_code))
where v.reference_bm_elevation is distinct from rp.elevation;
```

Si la de `capture_mode` da más de cero, se decide con el usuario si el paso 3
conserva la línea que borra `capture_mode`: las cotas de esas visitas siguen en
`settlement_readings` y entran al histórico tal cual —guardar sus datos ya no
las borra (`visitSaveOf`, revisión final)—; se pierde la etiqueta.
La cuenta vale **antes del despliegue**: desde él, las visitas nuevas —y las de
la cartera que agrega el paso 2— toman el `DEFAULT 'direct'` de la columna
aunque tengan libreta; después solo cuentan las que no tienen filas en
`settlement_book_readings`. Si la columna se conserva, habría que cambiar su
`DEFAULT` o marcar `book` las visitas con libreta.

**Las dos simulaciones** no escriben. La de `resincronizar-asentamientos.mjs`
cuenta, por lugar, las visitas y las lecturas cuya cota cambia al dejar de
compensar; necesita el paso 1, porque lee `site_benchmarks`: sin la tabla,
`recomputeSite` no ve ningún BM y daría todo «al día». La de
`agregar-cartera-demo.mjs` cuenta los «Proyecto de ejemplo» sin el lugar de la
cartera; su `--aplicar` también necesita el paso 1 (escribe en
`site_benchmarks` y `starts_section`). Contra producción se ejecutan con su URL
y su clave secreta en el entorno, como dice la cabecera de cada script:

```bash
SUPABASE_URL=https://rlipktdjlxynyxpiqgsu.supabase.co SUPABASE_SECRET_KEY=… \
  npx tsx scripts/resincronizar-asentamientos.mjs            # y luego --aplicar
SUPABASE_URL=https://rlipktdjlxynyxpiqgsu.supabase.co SUPABASE_SECRET_KEY=… \
  npx tsx scripts/agregar-cartera-demo.mjs                   # y luego --aplicar
```

Con `--env-file=.env.local` apuntan a la base local. **La cifra local**: la
simulación de la resincronización dio 2 lugares —las dos Torre Alameda, la del
seed y la de la demo—, 26 visitas y 192 lecturas que cambian: 13 de las 14
visitas de cada una, todas menos la 9, que no se compensaba. En Torre Alameda
las cotas cambian hasta 2.5 mm (hallazgo 4 del PRD).

Como en las Fases 35 y 36, `db push` aplica **todas** las pendientes: el paso
1 —sus dos migraciones— se empuja desde una copia del repositorio sin el paso
3. Localmente, la del origen del BM se aplicó con `migration up --local
--include-all`, porque la del paso 3 ya estaba aplicada. Después de cada
paso, en solo lectura: tras el 1, que no queda ningún trigger de cierre en las
cinco tablas, que `site_benchmarks` tiene RLS y sus filas, que
`precision_order` es nulable y que `save_visit` sigue `SECURITY INVOKER`, sin
`EXECUTE` para `anon` (`create or replace` conserva los permisos); tras el 3,
que las columnas y las tres funciones no existen y que el `CHECK` de `status`
admite solo los tres estados. Y, con todo aplicado, Torre Alameda de
producción comparada con el motor y la cartera de la demo con las celdas de la
hoja.

**Cómo se aplicó la Fase 37** (2026-10-07):

- **Antes**, en solo lectura: ninguna visita con `capture_mode = 'direct'`; un
  solo lugar de asentamientos, Torre Alameda de la demo, con 14 visitas y 154
  filas de libreta; ninguna visita con un BM de amarre distinto del catálogo.
- **Paso 1**: el usuario empujó las dos migraciones desde una copia de
  `supabase/` sin la del paso 3 (`db push --workdir`; la simulación con
  `--dry-run` listaba solo esas dos). Verificado: en las cinco tablas quedan
  los mismos triggers que en la base local —los de vigencia y `updated_at`—;
  `site_benchmarks` con RLS, sus cuatro políticas y BM-1 = 100.0000 y BM-2 =
  100.8450; `precision_order` nulable; `origin_visit_id` y `starts_section`;
  `save_visit` `SECURITY INVOKER` y sin `EXECUTE` para `anon`.
- **Merge**: `main` en `6cc64e9` (PR #30), con el despliegue de Vercel en
  verde.
- **Paso 2**: en vez de los scripts, el usuario eligió **regenerar la demo**:
  la única cuenta tenía la demo y dos proyectos sin asentamientos. Se borró el
  «Proyecto de ejemplo» —con una guarda que exigía exactamente uno— y se vació
  `profiles.demo_seeded_at`; la app lo recreó al abrir el dashboard. Los dos
  scripts siguen en `scripts/` para una base con datos fuera de la demo.
- **Paso 3**: `db push` desde `main`, después del despliegue. Verificado: las
  columnas y las tres funciones no existen y el `CHECK` de `status` admite solo
  `draft`, `in_progress` y `calculated`.
- **La demo nueva** coincide con la que crea el mismo código en local: Torre
  Alameda (8 puntos, BM-1 y BM-2, 14 visitas calculadas, 168 filas de libreta y
  112 lecturas) y «Control de asentamiento estructural», la cartera real (16
  puntos, PISCINA/BM = 156.2990, 7 visitas, 119 filas y 112 lecturas), además
  de 3 poligonales, 2 nivelaciones, 3 informes (salieron con la Fase 38) y 5
  puntos de referencia.

El primer `db push` lo ejecutó el usuario: el modo automático del agente lo
bloquea. El `git push` de `main`, el `db push` del paso 3 y el borrado de la
demo los ejecutó el agente con el visto bueno explícito del usuario.

**La Fase 38 es un solo paso, después del merge** (aplicado el 2026-10-08).
Antes del merge no hace falta nada. Después:

1. Merge a `main`. Vercel despliega el código, que ya no lee `reports`.
2. `npx supabase db push` aplica `20261010000000_sin_informes_consolidados`:
   borra el trigger `reports_reject_update`, la función
   `reject_update_on_report()` y la tabla `reports`, con sus políticas.

Va **después** porque borra, como toda migración destructiva: el código
anterior lee `reports` en cada página de proceso (los avisos al eliminar), y
fallaría sin la tabla; el nuevo no la nombra y funciona con ella o sin ella.
Producción solo tiene los **tres informes consolidados de la demo**, que se
pierden con la tabla (riesgo 5 del PRD, aceptado). Verificar después, en solo
lectura: que `reports` y `reject_update_on_report()` no existen
(`migration list` y una consulta con `--linked`). Localmente la migración se
aplicó con `migration up --local`, sin `db reset`, como en las Fases 35 a 37:
otra sesión que corra en local el código de `main` sin esta fase fallaría al
leer `reports`. Por lo mismo, **una vez aplicada, volver en Vercel a un
despliegue anterior a la Fase 38 rompe todas las páginas de proceso**: el
código viejo llama a `getReports`.

**La Fase 41 no tiene migración**: su despliegue es el merge, por el PR #34
el 2026-10-08, con la leyenda de las fórmulas del informe sumada.

**La Fase 40 no tiene migración**: su despliegue es el merge. Se fusionó
directo en `main` el 2026-10-08, sin PR (petición del usuario), y el usuario
verificó el PDF en producción.

**La Fase 39 no tiene migración**: su despliegue es el merge. Su rama sale de
la de la Fase 38, y entró a `main` después de ella (§ siguiente).

**Cómo se desplegaron las Fases 38 y 39** (2026-10-08): el PR #31 (la 38) se
fusionó primero, y después el #32 (la 39), con `main` integrado en su rama
—el único conflicto fue la cifra de pruebas de esta doc—. Con Vercel ya
desplegado, el usuario ejecutó el `db push` de la 38 (el modo automático del
agente lo bloquea). Verificado después en solo lectura: `migration list` al día
hasta `20261010000000`, y en un `db dump` del esquema no queda `reports` ni
`reject_update_on_report()`; quedan las 15 tablas de la app.

La de la Fase 29 se aplicó después del merge del PR #17, con el despliegue de
Vercel ya en producción. Una consulta de solo lectura previa confirmó que solo
la demo tenía coordenadas: los 8 puntos de Torre Alameda y BM-1 y BM-2.
Verificado después: las tres columnas no existen, el trigger de la C0 vigila
solo `initial_elevation`, y BM-1 y BM-2 conservan su cota sin coordenadas.

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

**La demo se regeneró el 2026-09-30** de la misma forma, con el visto bueno
del usuario: la de producción se había creado con el generador de la Fase 21 y
sus procesos cerrados conservaban las notas que la Fase 22 quitó (rutas de
`docs/carteras/`, «puede eliminarlo»), que la inmutabilidad no deja corregir.
Una guarda abortaba si había algo más que la demo de la única cuenta. La nueva
se creó al entrar, en 5 s, con los textos, el veredicto y las portadas
actuales.

**El orden importa cuando hay auto-deploy.** Vercel despliega solo al empujar a
`main`, así que la migración va **primero** y el `git push` después: al revés,
el despliegue serviría código que espera tablas que la base todavía no tiene.

**Salvo cuando la migración borra** (Fase 29). Ahí el orden se invierte: el
código nuevo ya no nombra lo que se borra y funciona con el esquema viejo,
pero el viejo falla con el nuevo, porque inserta o selecciona columnas que ya
no existen. Primero el merge y después el `db push`. La regla para decidir es
la misma en los dos casos: qué combinación de código y esquema funciona
mientras dura la ventana entre los dos pasos.

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
