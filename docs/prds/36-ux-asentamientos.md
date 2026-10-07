# PRD-de-fase 37 — Los asentamientos como los mide el topógrafo

**Estado:** cerrada
**Fecha de apertura:** 2026-10-07
**Fecha de cierre:** 2026-10-07

**Rama:** `fase-37-ux-asentamientos`
**Petición:** del usuario, 2026-10-06: «haz un plan para que repliquemos este
modelo de ux/ui para el caso de nivelaciones y control de asentamientos». La
hoja de ruta de las Fases 36 y 37 está en
[`superpowers/specs/2026-10-06-ux-nivelacion-asentamientos-design.md`](../superpowers/specs/2026-10-06-ux-nivelacion-asentamientos-design.md),
con la revisión del lienzo de esta fase.
**Maquetas aprobadas:** el lienzo «Asentamientos — rediseño de la UX»
(<https://claude.ai/artifact/A7D1YuGXNC2ZMv1hnRMq3j>): alta del lugar, nueva
visita, lugar B, libreta B con varias armadas, la armada sin y con vista
adelante, la visita a medias, resultados, informe, la pestaña BMs y los avisos
al guardar.
**Módulo:** control de asentamientos —lugar, visita, puntos, BM, informe,
Excel—, la base, el hub, el dashboard, la demo, el seed y la documentación.
**Cartera de referencia:** `docs/carteras/Control_asentamiento_estructural_ REAL.xlsx`,
que entra al repositorio con esta fase.

> **Divergencias de la implementación:**
>
> - **La distancia es opcional en la libreta de la visita** (§ D). `validateBook`
>   heredaba de la nivelación la distancia obligatoria en cada V+ y V−, y
>   rechazaba la cartera, que no la trae. Sin distancia el tramo queda sin
>   orden; una distancia tecleada sigue sin poder ser cero.
> - **«Terminar y seguir con la armada N»**: cuando la libreta ya trae la
>   armada siguiente —la plantilla de la visita anterior—, el popup la abre;
>   solo sin ella se agrega una nueva («… desde CP-1» o «… y agregar armada»).
>   Salió en pantalla: la plantilla creaba una tercera armada.
> - **«Quitar la armada»** para la última, que el lienzo no tenía: sin ella,
>   una armada agregada por error no se podía quitar. Abrir y cerrar una
>   armada sin teclear nada no guarda.
> - **La importación de la visita tiene su propio diálogo** («Importar .L o
>   CSV» en la barra de pasos), no el de la nivelación, que propone el tipo y
>   la ida y vuelta: un tramo desde el BM de su primera fila, que debe estar en
>   los BM del lugar.
> - **La cabecera de la visita se refresca con cada lectura**: `saveVisitAction`
>   revalida también la ruta de la visita.
> - **El informe del lugar informa las visitas calculadas** y nombra las que
>   están en medición: una visita a medias daría una «última visita» con la
>   mitad de los puntos.
> - **Ya nada se cierra**, así que el informe pierde también la marca de
>   borrador, el registro de cierre y la nota de lo reabierto (`state.ts`,
>   `ReportStateMark`, `ClosureRecord`, `closureOf`, `responsible.ts`), y la
>   tarjeta del proyecto cuenta solo el total de procesos. En el hub el lugar
>   no tiene columna de estado ni chips; los filtros «cerrados», «rechazados»
>   y «activos» salen. `getClosedWorkForReports` pasa a `getReportableWork`.
> - **La demo y el seed guardan con `insertarVisitas`** (sobre
>   `recalculateSite`): Torre Central y Edificio Norte tienen libreta desde un
>   BM nuevo de cada lugar (BM-C, BM-N), generada con cierre 0 para que su
>   serie quede exacta; Torre Alameda deja sus BM en los del lugar y no en los
>   puntos de referencia del proyecto. Los puntos de la cartera no tienen
>   ubicación (la hoja no la da).
> - **La rama trae `main`**: la corrección del amarre atómico (Fase 35, con su
>   migración `20261007010000`, ya en producción) se fusionó antes del paso 2;
>   `Modal` combina el alto limitado de todos los diálogos con el popup a
>   pantalla completa en el teléfono, y `useProcessDraft` lleva el extra del
>   amarre y la respuesta entera de la visita.
> - **`capture_mode` se borra en el paso 3** solo si la consulta previa de
>   producción da cero visitas con cotas tecleadas (§ Despliegue); sus cotas
>   siguen en `settlement_readings` de todos modos.
> - **En la base local**, la simulación de `resincronizar-asentamientos.mjs`
>   dio 26 visitas y 192 lecturas que cambian al dejar de compensar (las dos
>   Torre Alameda, la del seed y la de la demo: 13 de 14 visitas cada una).
> - **ESLint ignora `.claude/`**: el worktree de otra sesión, con su `.next/`,
>   hacía fallar `npm run lint`.

## Propósito

Hoy el lugar se crea en una página con nueve campos y se trabaja en tres
pestañas con el cierre como eje: visitas que se cierran en orden, un lugar que
se cierra, puntos y C0 que se bloquean. La visita se edita en otra página, un
formulario largo con el orden de precisión declarado, el clima, el equipo con
siete datos, dos modos de captura —libreta o cotas tecleadas— y un botón
Guardar. La libreta es una sola cadena desde el BM de amarre que tiene que
volver a él, y se compensa si cierra dentro del orden declarado.

El topógrafo mide de otra forma. Arma el nivel, lee el BM y radia a los puntos
de control: la cartera real son siete visitas de una sola armada, sin cierre.
Si no alcanza a ver todos los puntos, lleva la cota a un punto auxiliar o
vuelve a armar en otro BM. Mide en campo, con el teléfono, y puede
interrumpirse.

La fase deja, como en la poligonal (35) y la nivelación (36):

- un **alta en popup** del lugar y de la visita;
- un **lugar** con la tabla de visitas y la tendencia lado a lado;
- una **visita por pasos** —1 · Libreta, 2 · Resultados— con la libreta de la
  nivelación, por armadas, que se guarda **lectura por lectura**;
- un **catálogo de BM del lugar**, editable e importable;
- visitas **sin compensación** ni orden declarado;
- un módulo **sin cierre**.

## Hallazgos que condicionan la fase

1. **La cartera real es una sola armada por visita, con radiaciones** desde el
   BM de la piscina (156.299): V+ al BM, AI = cota + V+ y una lectura por
   punto, cota = AI − lectura. No tiene cierre, ni puntos de cambio, ni
   distancias. El motor reproduce sus acumulados («Comparación n») y sus
   parciales («Comparación al anterior») sin diferencia. Hoy solo entra como
   cotas tecleadas: la libreta exige empezar y terminar en el BM
   (`validators/settlement-book.ts:29-81`).
2. **La visita sigue con el patrón anterior a la Fase 36**: una página
   `editar/` con el formulario largo, «Guardar visita» y el orden declarado
   (`visit-editor.tsx`). No usa la cabecera, los pasos ni el borrador comunes,
   y la tabla de libreta vieja (`components/leveling/readings-table.tsx`) ya
   solo la usa la visita.
3. **El orden declarado cambia las cotas de la visita**: `computeVisitBook`
   compensa solo dentro de su tolerancia (`settlement-book.ts:79-93`), y el
   orden entra además en la estabilidad de los BM (`checkBenchmarks`) y en los
   márgenes de la tendencia (`visitCircuitsOf`, `tolerances.ts:150-213`).
4. **Dejar de compensar cambia cotas guardadas.** En Torre Alameda, las trece
   visitas que hoy se compensan cambian hasta **2.5 mm** (la de cierre
   −3.0 mm); la de 9.8 mm, que hoy no se compensa, no cambia.
5. **Todo el cierre está en lugares y visitas.** En la base: los triggers de
   rechazo de visitas y lugares (`reject_update_on_closed_process`,
   `reject_delete_on_closed_process`, que ya solo usan ellos, con
   `is_reopening`), los de lecturas y libreta de una visita cerrada, los de
   visitas, lecturas, libreta y puntos de un lugar cerrado, y el que fija la
   C0 de un punto con lecturas cerradas. En el código: «Cierra antes la visita
   N», borrar solo la última visita, el alta de un punto después de la última
   visita cerrada, la C0 bloqueada, borrar un punto con lecturas cerradas, la
   propagación de cambios y la caché de `alert_status` solo a visitas
   abiertas, la elegibilidad del informe, `getClosedWorkCount` (que impide
   borrar el proyecto), el KPI del dashboard, el Excel, la demo y el seed. Las
   pruebas pgTAP de las Fases 35 y 36 comprueban que el trigger de cierre de
   la visita existe.
6. **El diálogo de cerrar el lugar promete algo que no hace**: dice que las
   visitas abiertas «quedarán cerradas» y `closeSiteAction` no las toca.
7. **El clima y las notas de la visita solo los lee el editor**: ni la vista,
   ni el informe, ni el Excel.
8. **Los BM de las visitas vienen del catálogo del proyecto**
   (`reference_points`, `BmSelector`), que también usa la poligonal para su
   amarre. La visita copia el código y la cota del amarre
   (`reference_bm_code`, `reference_bm_elevation`) y la cota de cada BM leído
   de paso (`catalog_elevation`, Fase 30).
9. **Las visitas con cotas tecleadas** (`capture_mode = 'direct'`) existen en
   el seed (Torre Central, Edificio Norte). En producción hay que contarlas.
10. **El semáforo marca alarma por ruido** en la cartera: un milímetro en una
    semana son 4.35 mm/mes. Queda fuera de la fase, como petición aparte en
    `pendientes.md`.

## Decisiones

| # | Decisión | Por qué |
|---|---|---|
| 1 | **Alta del lugar en popup**: nombre, tipo de estructura y descripción, con los umbrales plegados y precargados por el tipo. Es también el popup de «Editar datos». Fuera la página `sites/new` y las notas del lugar | Lienzo. La descripción basta; nadie lee las notas fuera del formulario |
| 2 | **Lugar B**: cabecera en tarjeta, pestañas **Panel · Puntos · BMs · Informe**. El panel: los indicadores en una franja, la tabla de visitas y, fija al lado, la tendencia (Promedio \| Por punto) con la visita elegida resaltada, y los avisos | Elección del usuario |
| 3 | **El lugar no tiene estado** | Decisión del usuario |
| 4 | **Alta de la visita en popup**: fecha, nivelador, nota y equipo plegado (marca, modelo y n.º de serie, con «Tomar del catálogo»). **No pide BM ni cómo se mide.** La libreta llega armada como la visita anterior: las mismas armadas, con sus BM y sus puntos, sin lecturas | Decisión del usuario |
| 5 | **Toda visita se mide con libreta**: fuera las cotas tecleadas. Al importar un CSV o un `.L`, se guardan las lecturas y la cota sale de la medida | Decisión del usuario: «aquí guardamos mediciones» |
| 6 | **Visita por pasos**: 1 · Libreta, 2 · Resultados. Cabecera con ← →, «Editar datos» y eliminar. «Importar .L o CSV» en la barra de pasos | Como la nivelación |
| 7 | **Libreta B**: la tabla de la nivelación (Punto, V+, AI, V−, VI, Cota, distancias). Las lecturas a los puntos desde una posición del nivel van en **VI** | Elección del usuario |
| 8 | **Una visita es una lista de armadas**; la interfaz dice «+ Armada», nunca «libreta». La V+ de cada armada sale **de un BM del lugar** —y empieza un tramo— o **de un punto de cambio**, la V− de otra armada. La V− es opcional: sin ella, la armada termina en sus puntos | Decisión del usuario |
| 9 | **Cada lectura se guarda al escribirla.** Una visita con una armada sin terminar queda **«En medición»** y ofrece **«Retomar medición»**, que abre la armada en el siguiente punto. «Terminar armada» quita los puntos que quedaron sin leer | Decisión del usuario |
| 10 | **Un punto de control en dos armadas**: al guardar, se muestran las dos lecturas con su cota y se elige cuál se elimina | Decisión del usuario |
| 11 | **Una V− a un punto que no es punto de control ni BM del lugar** es un punto auxiliar: al terminar la armada se pregunta si pasa a los BM del lugar, con su cota medida | Decisión del usuario |
| 12 | **BM del lugar**: un catálogo propio de cada lugar, en su pestaña. Se agregan, se editan y se importan de una nivelación calculada del proyecto (sus cotas ajustadas) o de un CSV. **Se copian** y anotan su origen: no se sincronizan con nada. La visita deja de leer los puntos de referencia del proyecto | Decisión del usuario |
| 13 | **Cambiar la cota de un BM recalcula** las visitas que se arman desde él o lo leen, con aviso previo de cuántas son. Un BM que usa alguna visita no se elimina | Decisión del usuario |
| 14 | **Las visitas no se compensan**: la cota es AI − lectura. Cada tramo que termina en un BM del lugar se **verifica**: cierre (el mismo BM) o llegada (otro), su tolerancia y el orden que alcanza. El que no termina en un BM queda «sin verificación». Fuera el orden declarado | Decisión del usuario: «no manejemos compensar nivelaciones aquí» |
| 15 | **La visita resume sus tramos**: si todos se verifican, el orden más bajo de ellos; si alguno no, «sin verificación». Se guarda en `precision_order` y en las columnas del cierre, con el tramo peor | Para la cabecera, la tabla de visitas, el informe y el Excel |
| 16 | **Un BM leído de paso** se compara con su cota del lugar con la tolerancia de **tercer orden** sobre la distancia recorrida (Fase 30) | Ya no hay orden declarado. *Alternativa*: el orden que alcanza el tramo |
| 17 | **El margen de ruido de la tendencia es fijo**: el que hoy tienen dos visitas sin libreta en tercer orden, sin orden ni longitud de circuito | Decisión del usuario: «simplifícalo» |
| 18 | **Libertad total**: todo se recalcula en vivo y se propaga a todas las visitas; cualquier visita se borra; los puntos se dan de alta y de baja en cualquier fecha; cambiar una C0 con historia avisa cuántas visitas cambian | Decisión del usuario |
| 19 | **Una nota por visita**, que se ve en Resultados y en el informe. Fuera el clima | Decisión del usuario |
| 20 | **Resultados**: la franja de indicadores, la nota y, por punto, cota, parcial, acumulado, velocidad y estado, con el gráfico al lado (Acumulado \| Desde la anterior). En la libreta, al lado, el movimiento desde la visita anterior | Lienzo |
| 21 | **Informe sencillo**: el veredicto, cómo se calcula en cuatro fórmulas en MathML (AI, cota, acumulado, velocidad), la evolución, las visitas, los puntos de la última y los avisos. Un consolidado admite el lugar con alguna visita calculada | Lienzo; como la nivelación |
| 22 | **Sin cierre**: fuera los estados `closed`, `closed_at`, `closed_by`, sus triggers, el registro de cierre, reabrir y los modos de solo lectura. Con la fase desaparecen las funciones compartidas de inmutabilidad | Hoja de ruta, decisión 2 |
| 23 | **La cartera real entra a la demo y al seed** como el lugar «Control de asentamiento estructural»: 16 puntos, PISCINA/BM (156.299) y 7 visitas de una armada, con sus lecturas. También a la demo de producción ya creada | Decisión del usuario y de la hoja de ruta |

## Alcance

### A. Base de datos

Dos migraciones, porque la segunda borra (ver Despliegue).

**Antes del merge** — `…_ux_asentamientos.sql`:

- Las visitas `closed` pasan a `calculated` y los lugares `closed` a `active`.
- Se retiran los triggers de cierre de `settlement_visits`, `sites`,
  `settlement_readings`, `settlement_book_readings` y `settlement_points`
  —incluido el de la C0— y sus funciones propias
  (`reject_write_on_closed_visit_reading`, `reject_write_on_closed_site_visit`,
  `reject_write_on_closed_site_reading`, `reject_write_on_closed_site_point` y
  la de la C0).
- `settlement_visits.status` admite `in_progress` («En medición»).
- `settlement_visits.precision_order` pasa a **nulable**: la visita sin
  verificar no tiene orden.
- **`site_benchmarks`**: `id`, `site_id` (cascada), `code`, `elevation`
  `decimal(10,4)`, `description`, `source` (de dónde vino, en texto),
  `created_at`, `updated_at`; único `(site_id, code)`; RLS por el dueño del
  proyecto del lugar. Se llena con los BM que ya usa cada lugar: el amarre de
  sus visitas y los BM leídos de paso, con la cota del catálogo del proyecto.
- `save_visit` acepta filas sin lecturas (los puntos por leer) y escribe
  `in_progress`. Sigue sin escribir lo que no nombra; deja de escribir el
  clima.
- `src/types/database.ts`: solo se añade lo nuevo.

**Después del merge** — `…_asentamientos_sin_cierre.sql`:

- Vuelve a pasar a `calculated` cualquier visita cerrada en la ventana.
- Se borran `closed_at` y `closed_by` de visitas y lugares, `sites.status`,
  `settlement_visits.weather_conditions` y `settlement_visits.capture_mode`
  (con la condición del Despliegue). El `CHECK` de `status` de la visita queda
  en `draft`, `in_progress` y `calculated`.
- Se borran `reject_update_on_closed_process()`,
  `reject_delete_on_closed_process()` e `is_reopening()`.

### B. Motor y validación

- **Los tramos de una libreta** (`settlement-book.ts`): la libreta se parte
  donde una armada arranca de un BM del lugar. Cada tramo se calcula con
  `computeLeveling` sin compensar (`compensation: "never"`): cerrado si
  termina en su BM, de enlace si termina en otro BM del lugar, abierto si no.
  El orden de cada tramo verificado sale de `detectLevelingOrder`; sin
  distancias, el tramo tiene cierre pero no orden.
- **La cota de cada punto de control** es la de su lectura (VI o V−), sin
  corrección. Un punto en dos armadas es un error con las dos lecturas, para
  que la interfaz pregunte (decisión 10).
- **Los puntos por leer**: una fila de la plantilla sin lectura no da cota ni
  error; la visita con alguna queda `in_progress`.
- **La plantilla de la visita nueva**: las armadas de la anterior, con sus BM,
  sus puntos de cambio y sus puntos de control vigentes en la fecha, sin
  lecturas (sustituye a `buildBookTemplate`).
- **El punto auxiliar**: el código de una V− que no es punto de control ni BM
  del lugar.
- **La estabilidad de los BM** (decisión 16) contra `site_benchmarks`.
- **El margen de ruido** (decisión 17): una constante en `tolerances.ts`;
  `visitCircuitsOf`, `trendDeviationMargin` y `accelerationMargin` dejan de
  recibir el circuito de cada visita.
- `validateVisitBook` deja de exigir que la libreta empiece y termine en el
  amarre: la primera armada arranca de un BM del lugar y las filas se validan
  como en la nivelación, con `allowUnfinished`.
- Se retiran `validateVisitClose`, `undoRetirementBlocker`, la regla de la
  fecha de alta contra la última visita cerrada y `REFERENCE_LOCKED_MESSAGE`.

### C. El lugar (decisiones 1 a 3)

- El alta y «Editar datos» en un popup, abierto desde el hub y la cabecera.
- La cabecera común (`ProcessHeader` o su variante para el lugar): nombre,
  tipo, puntos, BM, fecha base y «Guardado …»; «Editar datos», «Exportar a
  Excel» y «+ Nueva visita».
- **Panel**: la franja de indicadores, la tabla de visitas (fecha, promedio,
  máximo, mayor Δ, alerta), la tendencia fija al lado y los avisos.
- **Puntos**: el catálogo de hoy, sin las guardas del cierre; cambiar una C0
  con historia y borrar un punto con lecturas avisan cuántas visitas cambian.
- **BMs** (decisiones 12 y 13): la tabla —código, cota, descripción, origen y
  en cuántas visitas sirve—, «+ BM», editar y eliminar, «Importar de una
  nivelación» (las nivelaciones calculadas del proyecto, con sus cotas
  ajustadas, para marcar cuáles) e «Importar CSV» (código, cota y
  descripción).
- **Informe**: la sección sencilla (decisión 21).

### D. La visita (decisiones 4 a 11, 14, 15, 19 y 20)

- **Nueva visita** y «Editar datos» en un popup: fecha, nivelador, nota y
  equipo. Crea la visita con la plantilla de la anterior y lleva a la
  libreta.
- **Paso 1 · Libreta**: la tabla con sus armadas; al lado, la lista de
  armadas, la verificación de cada tramo y el movimiento de cada punto desde
  la visita anterior, con el aviso de tendencia. «+ Armada».
- **El popup de la armada**: «Desde» (un BM del lugar o un punto de cambio),
  la V+ con su distancia opcional, las vistas a los puntos (precargadas, cada
  una con su cota y un ✓ al guardarse) y «+ Otro punto», y la V− opcional con
  «Sin vista adelante». Si la V− cae en un BM del lugar, dice que el tramo
  cierra y su cierre; si cae en un auxiliar, que la siguiente armada puede
  seguir desde él. Botones «Seguir después», «Terminar armada» y «Terminar y
  agregar armada» (o «… y seguir desde» el auxiliar).
- **El guardado por lectura**: cada lectura confirmada guarda la libreta
  completa (`useProcessDraft`, `callAction`); un fallo de red se queda en el
  popup con lo escrito.
- **La visita a medias**: el aviso «La medición quedó a medias» con
  «Retomar medición».
- **Los avisos al guardar**: el punto repetido (decisión 10) y el auxiliar
  (decisión 11).
- **Paso 2 · Resultados** (decisión 20).
- **En el teléfono**, a 390 px: el popup de la armada a pantalla completa,
  con la barra de guardado fija abajo.
- Fuera la página `editar/`, el editor largo, la tabla de cotas tecleadas, el
  selector de orden y la tabla de libreta vieja.

### E. Informe, Excel, hub, dashboard

- **La sección del informe** es la misma en la pestaña y en el consolidado
  (decisión 21), sin registro de cierre ni marca de borrador.
- **El Excel**: sin estados ni «Cerrado por»; la libreta por armadas y la
  verificación de cada tramo; la tendencia con el margen fijo.
- **El hub**: sin los chips de lugares cerrados; toda fila admite sus
  acciones.
- **El dashboard**: el KPI deja de filtrar por el estado del lugar.
- **El proyecto**: sin `getClosedWorkCount` ni su bloqueo al borrar.

### F. Lo que se quita con el cierre

Los diálogos de cerrar visita y lugar, `reopen.ts`, el diálogo de reabrir,
`closeVisitAction`, `reopenVisitAction`, `closeSiteAction`,
`reopenSiteAction`, los modos de solo lectura y sus redirecciones, las guardas
de borrado, `processReportState` y `ClosureRecord` de los lugares, y el
mensaje del error 23001.

### G. Demo y seed

- **Demo**: Torre Alameda con sus BM en el lugar (BM-1 y BM-2), sin cierre y
  sin compensar; y el lugar «Control de asentamiento estructural» con la
  cartera (decisión 23), con la visita 7 del 2022-06-05, «AA3» y B10 en la
  visita 3 tal cual la hoja. Un script agrega ese lugar a una demo ya creada
  (Despliegue, paso 2).
- **Seed**: el mismo lugar como 4.º de «Edificio en monitoreo»; Torre Central
  y Edificio Norte pasan de cotas tecleadas a libreta (generada hacia atrás
  desde sus cotas, como la de Torre Alameda) y nada se cierra.

### H. Documentación

El manual en sus dos copias (el capítulo de asentamientos completo), sus
capturas, la doc técnica (fases, modelo de datos, la § 11 entrada por
entrada, la § 13 con el despliegue) y las divergencias en este PRD.

## Fuera de alcance

- El margen de ruido en el semáforo por velocidad (hallazgo 10).
- Las lecturas múltiples del `.L` (la σ y las repeticiones).
- Cambiar los puntos de referencia del proyecto, que sigue usando la
  poligonal.
- Borrar las columnas de equipo sin uso (`level_type`, `km_precision_mm`,
  `equipment_calibration_date`).

## Criterios de aceptación

| # | Criterio |
|---|---|
| a | El alta del lugar en popup crea el lugar con los umbrales de su tipo y lleva a su panel |
| b | El panel muestra la tabla de visitas y la tendencia lado a lado; elegir una visita la resalta |
| c | La pestaña BMs agrega, edita, elimina (si no se usa) e importa BM de una nivelación del proyecto y de un CSV; los importados no cambian si la nivelación cambia |
| d | Cambiar la cota de un BM avisa cuántas visitas cambian y las recalcula |
| e | La nueva visita llega con las armadas y los puntos de la anterior, sin lecturas |
| f | La cartera capturada visita por visita reproduce la hoja: AI, cotas, «Comparación n» y «Comparación al anterior» de los 16 puntos en las 7 visitas |
| g | La visita 12 de Torre Alameda, con dos armadas por CP-1, da 99.9984 en BM-1, cierre −1.6 mm y segundo orden, sin compensar |
| h | Cada lectura se guarda al escribirla; cerrar el navegador a mitad deja la visita «En medición» y «Retomar medición» sigue en el punto siguiente |
| i | Un punto en dos armadas pregunta cuál eliminar; una V− a un auxiliar pregunta si pasa a los BM del lugar |
| j | Una armada sin V− termina en sus puntos y el tramo queda «sin verificación» |
| k | B10 avisa «excesiva» en la visita 3 y «contraria» en la 4 con el margen fijo |
| l | El informe y el Excel muestran la nota, sin estados de cierre; un consolidado admite el lugar con visitas calculadas |
| m | Ninguna pantalla muestra cerrar, reabrir ni «Cerrada»; tras la migración, lo que estaba cerrado se edita, cualquier visita se borra y la C0 se cambia con aviso |
| n | En el teléfono, a 390 px, se captura una armada sin desborde horizontal |
| o | Importar `.L` y CSV crea la libreta de la visita |
| p | La poligonal y la nivelación se ven y funcionan igual |
| q | `typecheck`, `lint`, `npm test`, `npx supabase test db` y `build` pasan |

## Pruebas mínimas

- **Vitest**:
  - Los tramos: cerrado, de enlace a otro BM del lugar, abierto, y la cadena
    por un punto de cambio; sin compensar.
  - La cartera: las 7 visitas contra las celdas de la hoja.
  - La visita 12 de Torre Alameda contra sus cifras.
  - La plantilla desde la visita anterior, los puntos por leer y el estado
    `in_progress`.
  - El punto repetido y el punto auxiliar.
  - La estabilidad de un BM leído de paso contra `site_benchmarks`.
  - El margen fijo de la tendencia y los avisos de B10.
  - La importación de BM: de las cotas ajustadas de una nivelación y de un
    CSV.
- **pgTAP**: `site_benchmarks` (RLS, único por lugar), la visita y el lugar
  sin triggers de cierre, la C0 editable con lecturas, `in_progress`,
  `precision_order` nulo y que `save_visit` guarda filas sin lecturas.
  `reabrir_procesos.test.sql` se retira; las pruebas de las Fases 35 y 36
  dejan de buscar el trigger de la visita. **La migración se prueba
  aplicándola sobre datos sembrados antes de ella** (aprendizaje de la
  Fase 36).
- **En pantalla**, en local: los criterios a–p, a 1280 px y a 390 px,
  recorriendo cada caso de la armada —sin V−, a un auxiliar, a un BM— y no
  solo el de la maqueta (aprendizaje de la Fase 36).

## Despliegue

| Paso | Qué | Cuándo | Código viejo con ello | Código nuevo sin ello |
|---|---|---|---|---|
| 1 | Migración: reabrir lo cerrado, quitar los triggers, `in_progress`, `precision_order` nulable, `site_benchmarks` con sus BM y `save_visit` ampliado | **Antes** del merge | Funciona: sin triggers, su cierre solo cambia el estado; no lee `site_benchmarks` | Falla: lee `site_benchmarks` |
| 2 | Recalcular las visitas guardadas sin compensar y agregar la cartera a la demo ya creada (scripts) | **Después** del despliegue | — | Las visitas viejas mostrarían la cota compensada hasta su próximo guardado |
| 3 | Migración: borrar columnas de cierre, `sites.status`, el clima, `capture_mode` y las funciones compartidas | **Después** del merge | Fallaría al cerrar: por eso va después | Funciona: ya no las nombra |

- **Antes del paso 1**, consultas de solo lectura en producción: cuántas
  visitas tienen cotas tecleadas (si hay alguna, se decide con el usuario qué
  hacer antes de borrar `capture_mode`), cuántas visitas y puntos cambian de
  cota al dejar de compensar, y en cuánto.
- Cada `db push` y el script del paso 2, con el visto bueno del usuario, que
  los ejecuta.
- **Después**, Torre Alameda de producción se compara con el motor, y la
  cartera de la demo con las celdas de la hoja.

## Riesgos

1. **Dejar de compensar cambia cotas guardadas** (hallazgo 4): hasta 2.5 mm en
   Torre Alameda, y lo que tenga producción. Mitigación: la consulta previa,
   el paso 2 y la comparación posterior.
2. **Es la fase más grande**: cierre, captura, BM y demo a la vez.
   Mitigación: el plan por tareas pequeñas y la revisión de toda la rama.
3. **Guardar por lectura**: muchos guardados seguidos de una libreta completa.
   Mitigación: el borrador común encola los guardados y conserva lo escrito
   si la red falla; una prueba en pantalla corta la conexión a mitad.
4. **Las visitas con cotas tecleadas en producción** no tienen lecturas que
   convertir. Mitigación: contarlas antes; si hay, el usuario decide.
5. **La demo de producción ya creada** no recibe el lugar nuevo de la
   cartera: la demo se crea en el primer inicio de sesión. Decisión del
   usuario: agregarla con un script que él ejecuta en el paso 2, con la misma
   función que la crea en una demo nueva.
6. **Las capturas del manual** de asentamientos cambian casi todas.
