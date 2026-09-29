# PRD-de-fase 22 — El proceso en una pantalla

**Estado:** en curso
**Fecha de apertura:** 2026-09-29

**Rama:** `fase-22-proceso-en-una-pantalla`
**Petición:** del usuario, 2026-09-29: cerrar los huecos de funcionalidad
(gestionar procesos, integridad, informe de asentamientos, detalles del hub),
«mejorar la navegación y tener unos patrones de UX mejor estandarizados, así
como una mejora general de layout si vale la pena»; «los informes se deben
visualizar en el detalle de cada proceso […] al entrar al proceso podamos ver
todo: ingreso de datos crudos, cálculo y ajuste con sus gráficos y análisis, y
botón de exportar Excel e informe»; y quitar «notas no relevantes o
relacionadas con el desarrollo que no interesan a los usuarios».
**Módulo:** transversal — hub del proyecto, las tres pantallas de proceso, los
informes, el sistema de diseño y el modelo de lugares

## Propósito

Hoy cada módulo tiene su propia anatomía de página, el hub lista cada módulo
de una forma distinta y el informe de un proceso vive lejos de él: para verlo
hay que salir al proyecto, abrir la pestaña Informes, pasar por una página
intermedia y pulsar «Ver e imprimir». Esta fase da a los tres procesos **una
misma pantalla** —cabecera, pestañas Proceso · Informe, barra de acciones
fija— en la que se ve todo lo que el proceso es, incluido su informe, y
unifica los patrones del hub. De paso cierra los huecos de gestión (borrar,
renombrar y duplicar más allá de la poligonal) y limpia de la interfaz lo que
es nota de desarrollo.

## Decisiones del usuario (apertura)

1. **Dos fases seguidas.** Esta (22) lleva navegación, página del proceso con
   su informe, hub, gestión de procesos, textos y detalles, y el informe de
   asentamientos. La integridad —guardados en una transacción, C0 bloqueada,
   informe emitido congelado— y los dos cabos de la Fase 9 van a la **Fase 23**,
   anotada en `pendientes.md` y redactada al cerrar esta.
2. **Pestañas Proceso · Informe** en la pantalla del proceso. Al entrar se ve
   todo lo de hoy (captura, cálculo, gráfico, análisis) con el resultado en
   vivo; cabecera común con Exportar Excel e Informe; Guardar y Cerrar en una
   barra fija abajo. En asentamientos: **Panel · Puntos y lugar · Informe**.
3. **El informe del proceso se ve siempre**, con la marca «Borrador» hasta el
   cierre.
4. **Los lugares de agrupación se marcan con un tipo** (migración), y
   desaparecen de la interfaz y de los conteos.

## Hallazgos que condicionan la fase

Recorrido en producción (solo lectura, 30 pantallas a 1280 y 390 px) y
exploración del código.

### 1. El informe está a tres pasos del proceso

- Ningún proceso enlaza a su informe; nada busca los informes que incluyen un
  proceso (`reports.included_processes` es JSONB, sin tabla de unión).
- `reports/[reportId]` solo muestra un índice y el botón «Ver e imprimir».
- La vista imprimible no tiene migas ni forma de volver, y su «Responsable»
  imprime el UUID de `closed_by` (lo mismo el «Cerrado por» del Excel).
- Las secciones por tipo del informe están escritas en línea en
  `reports/[reportId]/print/page.tsx` (760 líneas), no en componentes.

### 2. Tres anatomías de página, nada compartido

| | Poligonal | Nivelación | Asentamientos |
|---|---|---|---|
| Cabecera | en el Client Component | en el Client Component | en el Server Component |
| Veredicto arriba | `ClosureVerdict` | no | KPIs |
| Gráfico | dibujo | **ninguno** | tendencia, evolución, barras |
| Guardar / Cerrar | al pie, a ~3000 px | al pie, a ~3400 px | «Cerrar lugar» solo en `sites/[id]` |
| Configuración | `<details>` | `<details>` copiado | otra página (`sites/[id]`) |

`STATUS_TONE` está copiado en seis archivos. No existen en el sistema de
diseño ni cabecera de página, ni barra de acciones, ni esqueleto de carga
(el `Block` está duplicado en los dos `loading.tsx`, y los editores muestran
el esqueleto del hub mientras cargan).

### 3. El hub mezcla tres patrones

Poligonales en tabla con búsqueda, tipo, chips de estado y acciones por fila;
nivelaciones en tarjetas «En progreso / Cerrados» sin filtros ni acciones;
lugares en rejilla de tarjetas. La cabecera del proyecto ocupa ~270 px (~500
en móvil) en todas las pestañas. Las migas de nivelación y asentamientos
vuelven a la lista de Poligonales (no llevan `modulo`), y `toQuery` y
`SortLink` también lo pierden.

### 4. Los lugares de agrupación

Poligonales y nivelaciones cuelgan de un lugar (`site_id NOT NULL`, sin
`ON DELETE`): el «General» del backfill de la Fase 5, el «Área principal» de
cada proyecto nuevo, el «Levantamientos de campo» de la demo. Nada en el
esquema los distingue de un control de asentamientos real, así que salen en
el hub como controles vacíos —con «+ Nueva visita» y «Cerrar lugar»—, se
pueden cerrar y entonces entran a los informes como «Control de
asentamientos», e inflan el conteo del hub y el del dashboard («1 proceso» en
un proyecto recién creado).

### 5. Gestión incompleta

- Eliminar, Renombrar y Duplicar existen **solo para poligonales**.
- Un lugar con procesos no se puede borrar (llave foránea).
- `deleteProjectAction` ignora el error: borrar un proyecto con trabajo
  cerrado choca con los triggers de inmutabilidad y redirige como si nada.
- No hay guarda de cambios sin guardar (ningún `beforeunload`): los editores
  dicen «Hay cambios sin guardar» y aun así dejan salir.

### 6. Notas de desarrollo en pantalla

Unas 45 cadenas: 10 son notas internas y el resto explicaciones defensivas o
demasiado largas. Además, unas 20 acciones devuelven el `error.message` de
Postgres, en inglés, directo a la alerta. Detalle en la sección G.

### 7. Formato

El catálogo de puntos de referencia y el de puntos de control imprimen los
números crudos (`5000`, `100.845`, `101515.6333`); `format.ts` no tiene
formateador de coordenadas ni de cotas (hay 45 `toFixed` repartidos). Las
gráficas de asentamientos formatean con coma (`es-CO`) y las tablas con
punto; la Fase 20 fijó el punto para la presentación.

## Alcance

### A. Patrones compartidos

| Pieza | Dónde | Qué |
|---|---|---|
| `PageHeader` | `design-system/page-header.tsx` | Migas, título, subtítulo, zona de badge, zona de acciones y contenido extra (veredicto, leyenda). Genérico: sin tipos de dominio |
| `ActionBar` | `design-system/action-bar.tsx` | Barra fija al pie con un texto de estado y acciones. Se monta solo si hay algo que hacer |
| `Skeleton` | `design-system/skeleton.tsx` | Sustituye el `Block` duplicado; `loading.tsx` propios para las rutas de proceso |
| Estados | `lib/process-status.ts` | Etiquetas y tonos de estado: una sola copia |
| Guarda de cambios | `components/navigation/unsaved-changes.tsx` | `beforeunload` y un `Modal` «¿Salir sin guardar?» al pulsar un enlace interno con cambios pendientes |
| Formato | `lib/utils/format.ts` | `formatCoordinate` (3 decimales) y `formatElevation` (4) |
| Errores | `lib/errors/user-message.ts` | Código de Postgres → mensaje en español: 23001 (cerrado), 23503 (en uso), 23505 (duplicado), 42501 (sin permiso) y uno genérico. El original se registra en el servidor |

### B. La pantalla del proceso

**Cabecera común** (`PageHeader`): migas en el Server Component de la página,
que vuelven al módulo de origen; título; tipo y estado; veredicto resumido; y
las acciones **Exportar Excel** e **Informe** (abre la pestaña Informe). Las
acciones propias del módulo van en la misma zona —en la poligonal,
«Georreferenciar» y «Asignar coordenadas reales», que hoy están una arriba y
otra al pie—.

**Pestaña Proceso**: lo que hoy muestra cada pantalla, en el orden veredicto →
configuración → captura → gráfico → resultados y análisis, con la
**`ActionBar` fija** (estado «Cambios sin guardar», Guardar, Cerrar proceso)
mientras el proceso sea editable.

- **Poligonal:** se reordena; no gana nada nuevo.
- **Nivelación:** gana un **veredicto arriba** (cierre o discrepancia contra
  su tolerancia, como `ClosureVerdict`) y un gráfico nuevo, **«Perfil de la
  nivelación»**: cota corregida frente a distancia acumulada, con la vuelta
  superpuesta cuando la hay. Reutiliza `niceTicks` y las escalas de las
  gráficas de asentamientos.
- **Asentamientos:** el lugar pasa a una sola ruta,
  `/settlement/[siteId]`, con pestañas **Panel** (lo de hoy), **Puntos y
  lugar** (el `SiteForm` y el `PointsCatalog` que hoy viven en `sites/[id]`)
  e **Informe**. `sites/[siteId]` redirige a la pestaña. La cabecera suma el
  badge del lugar y «Cerrar lugar». La visita y su editor adoptan `PageHeader`
  y `ActionBar`.

Las pestañas son enlaces (`Tabs`, `?tab=`): cambiar de pestaña con cambios
pendientes pasa por la guarda.

### C. El informe dentro del proceso

- Las secciones del informe se extraen de la vista imprimible a componentes
  de servidor (`components/reports/sections/`: poligonal, nivelación,
  lugar, portada, resumen de precisiones, registro de cierre), con su carga
  de datos en `lib/reports/`. **El informe consolidado los reutiliza sin
  cambiar de aspecto.**
- **Pestaña Informe:** portada, la sección del proceso, sus notas como
  observaciones y el registro de cierre, con «Imprimir o guardar como PDF».
  Mientras el proceso no esté cerrado lleva la marca **«Borrador — el informe
  se emite al cerrar el proceso»**, en pantalla y en el PDF. Debajo, los
  informes consolidados que incluyen el proceso, con enlace.
- **Responsable:** el nombre del perfil (`profiles.full_name`) o, si no hay,
  el correo; en el informe y en el «Cerrado por» del Excel.
- **Informe de asentamientos:** su gráfica pasa al **eje de tiempo real**
  (`timeScale`), como el panel, y su tabla de visitas suma el **amarre** y el
  **cierre de la libreta**.
- **Pestaña Informes del proyecto:** queda para los informes consolidados. La
  lista enlaza directo a la vista imprimible, que gana migas, «Volver» y
  «Eliminar informe»; `reports/[reportId]` redirige a ella. «Generar informe»
  desde un proceso llega con ese proceso marcado.

### D. Tipo de lugar

Migración nueva:

- `sites.kind text not null default 'settlement'` con
  `check (kind in ('grouping', 'settlement'))`.
- Relleno: `'grouping'` para los lugares que alguna poligonal o nivelación
  referencia **y** que no tienen puntos ni visitas.
- El trigger `sites_reject_update_on_closed` impediría el relleno en un lugar
  de agrupación cerrado. Ver la decisión 6.

En el código: el hub, `getProcessCountsByProject`, los KPIs del dashboard,
`getClosedWorkForReports` y el formulario de informe solo ven lugares
`settlement`; el alta de proyecto y la demo crean su lugar como `grouping`;
`polygonal/new` y `leveling/new` cuelgan del lugar de agrupación más antiguo
del proyecto y lo crean si no hay ninguno. Tipos regenerados.

### E. Hub del proyecto

- **Un solo patrón** para los tres módulos (regla de la § 8 de la doc
  técnica): tabla en escritorio y tarjetas en móvil con los mismos campos;
  búsqueda y chips de estado; selector de tipo en poligonal y nivelación;
  acciones por fila. Las tarjetas con acciones dejan de ser un `<Link>`
  completo.
- **Cabecera del proyecto compacta:** nombre, cliente, estado y una línea con
  ubicación y datum. La descripción y el resto quedan en Configuración.
- Conteos correctos (solo lugares `settlement`) y `modulo` conservado en
  filtros, orden y migas.

### F. Gestionar procesos

| Qué | Eliminar | Renombrar | Duplicar |
|---|---|---|---|
| Nivelación | sin cerrar | sin cerrar | siempre; copia la configuración, no las lecturas |
| Lugar de asentamientos | activo y sin visitas cerradas | ya existe en el formulario; se suma a la fila | siempre; copia configuración, umbrales y catálogo de puntos, sin visitas |
| Visita | **solo la última, sin cerrar** | — | — |
| Proyecto | informa el error; con trabajo cerrado explica que se archive | — | — |

La poligonal ya tiene las tres y no cambia. Borrar siempre pide confirmación
con el `Modal`, como hoy en la poligonal.

### G. Textos

**Se quitan** (notas internas):

- «(§ 6.9). Hoy no alimenta la compensación…» — `leveling/results-panel.tsx`
- «La hoja de la universidad usa, por ejemplo, 2″, 0.011 m y 2 mediciones.» — `polygonal/results-panel.tsx`
- La fila «Condiciones · iteraciones» del ajuste — `polygonal/results-panel.tsx`
- «El proceso está cerrado: el formato solo cambia la vista y no se guarda.» — `polygonal-editor.tsx` y su acción
- «Es una lectura informativa: el veredicto sigue siendo… Los códigos se emparejan sin distinguir espacios ni mayúsculas.» — `leveling/results-panel.tsx`
- «…las reconstruyó la migración repartiendo por mitades…» — `leveling/readings-table.tsx` (se reescribe sin la migración)
- «La georreferenciación cambiaría el veredicto; no se aplica.» — `georeference-plan.ts`
- El UUID del «Responsable» y los `error.message` de Postgres (A y C)

**Se acortan** (útiles pero defensivas o largas): las explicaciones del
ajuste y de σ₀, del control de reorientación, de la comprobación aritmética,
de los puntos homólogos, del diálogo de georreferenciar, de los diálogos de
importar (nivelación y visita), de los diálogos de cierre («inmutable»), del
cajón de la libreta, de la gráfica de evolución, de las altas de puntos, de
los campos de equipo («es un aviso, no un bloqueo») y de los pies del
informe. Se corrige la instrucción caducada «Indica la distancia total del
recorrido…», que ya no se captura.

**Guarda:** un test al estilo de `tokens-retirados.test.ts` recorre los
textos de `src/components` y `src/app` (sin el manual ni la página del sistema
de diseño) y falla si aparece «§», «Fase », «universidad», «Hoy no» o «la
migración».

### H. Detalles de captura

- Las filas sin V+ ni V− muestran «—» en la cota, en la tabla compartida de
  nivelación y en la libreta de la visita.
- Los catálogos de puntos usan `formatCoordinate` y `formatElevation`; las
  gráficas de asentamientos pasan al punto decimal.

## Decisiones

| # | Decisión | Razón |
|---|---|---|
| 1 | Pestañas **Proceso · Informe**, no tres | Decisión del usuario. Separar captura de cálculo quitaría el resultado en vivo mientras se teclea, que es la validación en tiempo real del PRD principal |
| 2 | El informe del proceso es **derivado**: no crea fila en `reports` | El informe de un proceso es función de sus datos. `reports` sigue registrando los consolidados, que llevan título, selección, orden y observaciones propias |
| 3 | Borrador visible antes del cierre, marcado en pantalla y en el PDF | Decisión del usuario. Sirve para revisar antes de cerrar; la marca impide confundirlo con uno emitido |
| 4 | Las secciones del informe se extraen **sin cambiar** la vista imprimible | Un solo código para el informe del proceso y el consolidado; el aspecto ya fue validado en fases anteriores |
| 5 | Tipo de lugar por **columna**, no quitando `site_id` a los procesos | Decisión del usuario. Quitarlo exigiría reescribir procesos cerrados, que los triggers bloquean |
| 6 | El relleno del tipo escribe también en lugares cerrados, **desactivando el trigger de update de `sites` solo mientras corre** | La clasificación es metadato de la interfaz, no una medición ni un resultado: no toca nada de lo que el cierre certifica. Precedente: la migración de la Fase 19. Antes de aplicarla en la nube se comprueba cuántos lugares de agrupación cerrados hay (se esperan 0) |
| 7 | Solo se elimina **la última visita**, y sin cerrar | Borrar una intermedia deja un hueco en la numeración y cambia el parcial y la velocidad de la siguiente |
| 8 | Duplicar copia configuración, **no mediciones** | Mismo criterio que la poligonal desde la Fase 7: una copia con lecturas parecería medida |
| 9 | La guarda usa el `Modal` del sistema para la navegación interna y el diálogo nativo del navegador para recargar o cerrar | El navegador no permite personalizar el de `beforeunload` |
| 10 | Primitivas genéricas al sistema de diseño; el patrón del hub y la pantalla del proceso, fuera | Regla de la § 8: el sistema de diseño no conoce el dominio |

## Pruebas

| Qué | Casos |
|---|---|
| `formatCoordinate`, `formatElevation` | redondeo, nulos, negativos |
| `user-message` | cada código conocido, código desconocido, error sin código |
| Informes de un proceso | filtra los consolidados que lo incluyen, por tipo e id |
| `PageHeader`, `ActionBar` | render (`renderToStaticMarkup`): acciones, badge, barra oculta sin acciones |
| Secciones del informe | la sección de cada tipo renderiza lo mismo que la vista imprimible de hoy; marca de borrador solo sin cerrar |
| Textos | la guarda de notas de desarrollo |
| Gestión | acciones de nivelación, lugar y visita rechazan lo cerrado y lo que no es la última visita |
| Tipo de lugar | tras `db reset` y seed: los lugares de agrupación clasificados, los de asentamientos intactos |
| Demo | los tests de fixtures siguen pasando; el lugar de la demo nace `grouping` |

**En pantalla (local, los dos temas, 1280 y 390 px):** cada proceso con su
cabecera, pestañas, barra fija, Excel e Informe; la pestaña Informe con y sin
borrador y su vista de impresión; la guarda al salir con cambios; borrar,
renombrar y duplicar en cada módulo; el hub de la demo con un solo control de
asentamientos; sin desborde horizontal a 390 px.

## Criterios de aceptación

1. Desde la pantalla de cualquier proceso se llega a su informe en un clic, y
   la pantalla muestra captura, cálculo, gráfico y análisis sin salir de ella.
2. Los tres módulos comparten cabecera, pestañas y barra de acciones; el hub
   lista los tres con el mismo patrón y con acciones por fila.
3. Nivelaciones, lugares y visitas se pueden eliminar (con las reglas de la
   tabla F), y nivelaciones y lugares renombrar y duplicar.
4. Salir de un editor con cambios pendientes pide confirmación.
5. Los lugares de agrupación no aparecen en la interfaz ni en los conteos.
6. Ninguna nota de desarrollo ni error crudo de Postgres llega a pantalla; el
   informe nombra al responsable.
7. `npm run typecheck`, `npm run lint`, `npm test` y `npm run build` limpios.
8. Manual en sus dos copias con capturas nuevas, y doc técnica al día.

## Fuera de alcance

- **Fase 23:** guardados en una transacción (visita con libreta,
  georreferenciación), C0 bloqueada con lecturas cerradas, portada del
  informe congelada y `reports` inmutable, y los dos cabos de la Fase 9.
- σ y repeticiones del nivel digital, historial de georreferenciaciones,
  catálogo de equipos, paleta del Excel.
- Unificar los diálogos «Asignar coordenadas reales» y «Georreferenciar»
  (solo se agrupan en la cabecera).

## Riesgos

- **Refactor ancho.** Toca las tres pantallas de proceso, el hub y la vista
  imprimible. Mitigación: extraer primero sin cambiar el aspecto (el informe
  se compara con capturas de antes), y un commit por pieza.
- **La guarda y la navegación del App Router.** Next no ofrece un bloqueo de
  navegación general. Mitigación: interceptar los enlaces internos en captura
  y `Link.onNavigate` donde el enlace es propio; los botones atrás/adelante
  del navegador quedan fuera y se documenta.
- **La migración toca la nube.** Mitigación: solo añade una columna y
  clasifica; se prueba con `db reset` y seed, y en la nube se aplica tras el
  merge con `db push`, con visto bueno del usuario y consulta previa de
  lugares de agrupación cerrados.
- **Capturas del manual.** Cambian casi todas. Mitigación: regenerarlas al
  cerrar y revisar una por una.

## Tareas (en orden)

0. **Apertura:** este PRD, estados en `method.md` y `prds/README.md`, la Fase
   23 en `pendientes.md`. Commit `docs:`. Rama y push.
1. **A** — primitivas y utilidades, con sus tests.
2. **D** — migración del tipo de lugar, `db reset`, seed, tipos y consultas.
3. **C** — secciones del informe extraídas, sin cambiar la vista imprimible.
4. **B** — pantalla del proceso: poligonal, nivelación, asentamientos.
5. **E y F** — hub unificado y gestión de procesos.
6. **G y H** — textos, guarda de textos, filas vacías y formato.
7. **Verificación en pantalla** en local.
8. **Cierre:** manual (dos copias) y capturas, doc técnica § 11 entrada por
   entrada, `method.md`, `prds/README.md`, `pendientes.md`. Revisión de
   código y PR.
9. **Tras el merge:** `db push` a la nube y recorrido de solo lectura en
   producción.
