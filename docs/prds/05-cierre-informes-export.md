# PRD-de-fase 6 — Cierre, Informes y Exportación

**Estado:** cerrada
**Fecha de apertura:** 2026-08-25
**Fecha de cierre:** 2026-08-26

## Propósito

Cerrar el producto. Al terminar esta fase, un usuario debe poder tomar los
procesos que ya cerró —poligonales, nivelaciones y lugares de control de
asentamientos— y producir con ellos dos entregables: un **informe imprimible**
que consolida el trabajo de un proyecto con su registro de trazabilidad, y una
**exportación a Excel** por proceso con datos crudos, cálculos y resumen.

Es la última fase del `§9` del PRD principal. A diferencia de las Fases 3-5, no
construye un motor de cálculo nuevo: **consume** lo que las fases anteriores
persistieron. Eso desplaza el riesgo desde la aritmética hacia la
**consistencia de lo persistido**, y por eso la fase incluye el cierre de las
deudas que hacen que dos vistas del mismo dato puedan discrepar.

## Fuentes

- `PRD-TopoField.md` — `§3.2` (tablas `reports` y `recipients`), `§4.6` (cierre
  y bloqueo), `§4.7` (generador de informes), `§4.8` (exportación a Excel),
  `§4.9` (configuración), `§9` (orden de implementación).
- `docs/method.md` — «Aprendizajes acumulados» del cierre de la Fase 5.
- `docs/tecnica/README.md` `§11` — 33 entradas de deuda técnica, triadas abajo.
- `scripts/build-poligonal-excel.mjs` — libro de Excel ya construido con las
  convenciones del dominio; es la referencia directa para la `§4.8`.

## Hallazgos de la verificación

El método exige verificar con código antes de fiarse de una afirmación
—escrita en el marco teórico, en el PRD o en la propia deuda técnica—. Esta
fase no consume tablas del marco teórico, así que la verificación se dirigió a
lo que sí consume: **el estado real del código y de la deuda registrada.**

### 1. La deuda de `formatPrecision` está mal descrita, y el arreglo es más estrecho

`§11` afirma que «hay cuatro copias de `formatPrecision` con criterios
distintos». Verificado: hay **tres** copias
(`polygonal/closure-verdict.tsx`, `close-process-dialog.tsx`,
`results-panel.tsx`) y son **idénticas en comportamiento** — las tres hacen
`Math.round(x).toLocaleString("es-CO")`. La cuarta función que la deuda cuenta
es `parsePrecision` (`src/lib/process-list.ts`), que no formatea: **parsea**,
para poder ordenar.

La divergencia real que el usuario ve (`1:1001` en el listado, `1:1.001` en el
editor) **no la causan las copias**: la causan dos consumidores distintos del
mismo dato. El listado imprime la cadena **persistida en crudo**
(`process-table.tsx:199`, `process-card.tsx:83`); el editor la **formatea**.
Unificar las tres copias idénticas no habría corregido nada.

**Consecuencia:** el arreglo es que el listado formatee como el editor, con un
formateador único compartido. Importa aquí porque la `§4.7` pide un «resumen
consolidado de precisiones»: sin esto, el informe introduciría una **tercera**
representación del mismo número. Ver decisión #7.

### 2. El cierre del lugar no cumple la `§4.6`, y es el más irreversible del producto

La `§4.6` exige, en su paso 3, un checkbox «Confirmo que los datos son
correctos» antes de confirmar. Verificado en los cuatro flujos de cierre:

| Flujo | Diálogo | Checkbox de confirmación |
|---|---|---|
| Poligonal | `polygonal/close-process-dialog.tsx` | sí |
| Nivelación | `leveling/close-process-dialog.tsx` | sí |
| Visita de asentamientos | `settlement/close-visit-dialog.tsx` | sí |
| **Lugar de asentamientos** | inline en `settlement/site-form.tsx` | **no** |

El cierre del lugar es el único sin la barrera, y es **el que más consecuencias
tiene**: su propio diálogo advierte que «esto también cierra todas sus visitas».
Cierra N entidades de golpe, de forma irreversible, con un solo clic y sin
confirmación explícita. Los otros tres, que cierran una sola entidad, sí la
piden.

**Consecuencia:** la tarea 6 no es una auditoría de trámite. Ver decisión #8.

### 3. La divergencia de `alert_status` es real y está confirmada en el código.

`§11` la registra como pendiente. Verificado el mecanismo exacto:

- El panel del lugar (`settlement/[siteId]/page.tsx:90`) llama a
  `computeHistory(points, visitInputs, thresholdsOf(site))` — **recalcula** con
  los umbrales vigentes en cada carga.
- El hub lee `alert_status` tal como quedó persistido en `settlement_readings`.

Las dos fuentes responden distinto a la misma pregunta en cuanto alguien edita
los umbrales de un lugar con visitas guardadas. Un informe que muestre el
análisis del lugar consumiría ambas y **se contradiría dentro del mismo
documento**. Ver decisión #5.

### 4. `thresholdsOf` sí está cuadruplicado, como dice la deuda.

Cuatro declaraciones en cuatro archivos (`site-form.tsx:35`,
`settlement/[siteId]/page.tsx:22`, `settlement/[siteId]/actions.ts:37`,
`visits/[visitId]/page.tsx:20`). Esta entrada de la deuda es exacta. Importa
aquí porque la decisión #5 añade un quinto consumidor.

### 5. Las formas de marcador se agotan en la serie 6, y el aviso no lo cubre.

Verificado en `settlement-chart.tsx`: `SERIES_MARKERS` tiene 5 entradas,
`SERIES_COLORS` 4. El código documenta correctamente que la combinación
forma+color no se repite hasta la serie 20 —`lcm(5,4)`— y avisa a partir de
ahí. Pero **la forma sola se repite en la serie 6**, y con acromatopsia la
forma es el único canal. El propio comentario del archivo reconoce que el
dominio usa grillas de 9 puntos y un caso de presa con 10.

El aviso existente cubre el rango ≥20 y **deja sin cubrir el rango 6-19**, que
es justamente donde cae el catálogo típico del dominio. Ver decisión #9.

## Alcance

### Dentro

- Migración aditiva: tabla `reports` con RLS.
- **Informes** (`§4.7`): selección de procesos cerrados, orden de secciones,
  observaciones, listado de informes del proyecto, y **ruta imprimible** con
  `@media print` que produce el PDF vía «Imprimir → Guardar como PDF».
  Sustituye el `EmptyState` de la tab «Informes».
- **Exportación a Excel** (`§4.8`): los tres módulos, tres hojas (Datos Crudos /
  Cálculos / Resumen), disponible en cualquier estado del proceso, vía Route
  Handler que descarga el `.xlsx`.
- **Cierre** (`§4.6`): completar el diálogo de cierre del lugar, que hoy no
  cumple el paso 3 (hallazgo 2).
- **Deuda que la fase cierra porque la necesita:** divergencia de
  `alert_status` (#5), formateador único de precisión (#7), `thresholdsOf` en
  un solo sitio (#6), formas de marcador hasta cubrir el catálogo del dominio
  (#9).
- **Deuda barata en el camino:** test de `expectStationCapture`, `pointCode`
  vacío en `validatePolygonalStation`, tests de `niceTicks` con rangos
  degenerados y de `computeDifferentials` con un punto sin lectura.
- Enmienda del `§3.2` y del `§4.7` del PRD principal (retirar `recipients` y el
  envío por email; retirar `file_url`).
- Documentación de handoff: `docs/tecnica/`, `docs/manual/` y `/manual`.

### Fuera (diferido)

- **Envío de informes por email y tabla `recipients`** (`§4.7`, `§3.2`) →
  decisión #4. Resend hoy solo entrega al dueño de la cuenta (`§11`), así que
  el envío fallaría con 403 contra cualquier destinatario real.
- **Pantalla `/settings`** (`§4.9`) → su contenido son destinatarios y equipos
  guardados; sin destinatarios, no queda materia para la pantalla.
- **Almacenamiento del PDF** (`reports.file_url`) → decisión #2.
- **Firma digital criptográfica** → fuera de alcance del producto.
- **Vista previa como render del PDF real** → la vista previa es la propia ruta
  imprimible en pantalla, no un visor de PDF embebido.

## Decisiones cerradas

| # | Decisión | Razón |
|---|---|---|
| 1 | El PDF se produce con una **ruta imprimible + `@media print`**, no con un motor de PDF en el servidor. | Cero dependencias nuevas y reutiliza el sistema de diseño que ya existe. Playwright está en el repo pero solo como devDependency para capturas: llevarlo a producción exigiría `@sparticuz/chromium` para caber en una función serverless de Vercel, un riesgo de despliegue real a cambio de ahorrarle al usuario un «Guardar como PDF». Una librería de PDF por código duplicaría toda la maquetación. |
| 2 | **`reports.file_url` no se crea.** El informe no se almacena como archivo: se reconstruye al abrirlo. | No hay almacenamiento de archivos en el producto. Una columna que nunca se llena es una promesa falsa en el esquema. **Enmienda el `§3.2`.** |
| 3 | Un informe **solo puede incluir procesos cerrados**, y por eso regenerarlo da siempre el mismo resultado. | Es lo que la `§4.7` ya pide, y encaja con el mecanismo que ya existe: un proceso cerrado es inmutable por trigger de base. Hace innecesario congelar un snapshot de los datos en `reports` — que habría creado una segunda fuente de verdad, justo el patrón de caché derivada que mordió en la Fase 5. La inmutabilidad la garantiza la base, no una copia. |
| 4 | **Destinatarios y envío por email quedan fuera**, y se enmienda el PRD principal en vez de dejar la promesa incumplida. | Resend solo entrega al dueño de la cuenta mientras no se verifique un dominio propio (`§11`): un envío a destinatarios reales fallaría con 403 en producción. Construir un camino que no puede funcionar es peor que declararlo fuera de alcance con su razón. |
| 5 | **`saveSiteAction` reescribe el `alert_status` de las visitas ABIERTAS** al cambiar los umbrales; las cerradas conservan su clasificación. | Cierra el hallazgo 3. Las cerradas no se tocan por trazabilidad: una visita cerrada documenta el criterio con el que se evaluó en su momento. Es el arreglo que la propia deuda apuntaba. |
| 6 | `thresholdsOf` se extrae a **un solo sitio** antes de que la decisión #5 añada un quinto consumidor. | Hallazgo 4. Añadir un consumidor más a una lógica ya cuadruplicada es empeorar la deuda mientras se arregla otra. |
| 7 | Un **formateador único de precisión**, y el listado pasa a usarlo. | Hallazgo 1: la divergencia la causan dos consumidores del mismo dato, no las tres copias idénticas. El informe consolida precisiones y no debe introducir una tercera representación. |
| 8 | El **cierre del lugar gana resumen y checkbox de confirmación**, como los otros tres. | Hallazgo 2. Es el cierre más irreversible del producto —cierra N visitas de golpe— y el único sin la barrera que la `§4.6` exige. |
| 9 | **Formas de marcador hasta cubrir 10 series**, el catálogo típico del dominio. | Hallazgo 5. Con 10 formas el rango 6-19, hoy descubierto, queda cubierto, y la combinación forma+color no se repite hasta la serie 20 (`lcm(10,4)=20`). |
| 10 | La lógica de **qué filas hay que reescribir** y de **qué procesos son elegibles** sale a funciones puras con tests; no se mockea Supabase. | Aplica el aprendizaje del cierre de la Fase 5: los fallos que llegaron más lejos vivían en los Server Actions, no en el motor. Extraer la decisión a una función pura la hace testeable sin infraestructura nueva, y es el patrón que `close-status.ts` ya usa con éxito. Mockear el cliente verificaría que se llamó al mock, no que la base quede bien. |
| 11 | La **unidad incluible en un informe** es el proceso cerrado para poligonal y nivelación, y el **lugar cerrado** para asentamientos. | Un lugar con 5 visitas cerradas y 1 abierta no es un proceso cerrado: admite visitas nuevas, así que su informe cambiaría al reabrirlo y rompería la decisión #3. Cerrar el lugar ya significa que el monitoreo terminó, y el trigger lo vuelve inmutable junto con sus visitas. |
| 12 | Un proceso **`rejected` no puede incluirse** en un informe. | Lo dice la `§4.6` explícitamente. Se implementa en la función pura de elegibilidad (#10), con test. |

## Modelo de datos

Migración nueva `<timestamp>_reports.sql`.

```sql
CREATE TABLE reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  included_processes JSONB NOT NULL,   -- [{type, id, name, order}]
  observations TEXT,
  generated_at TIMESTAMPTZ DEFAULT now(),
  generated_by TEXT NOT NULL
);
```

Tres divergencias respecto al `§3.2`, todas deliberadas:

- **Sin `file_url`** (decisión #2).
- **`project_id NOT NULL`**: el `§3.2` lo deja nullable, pero un informe sin
  proyecto no significa nada y dejarlo nullable obliga a un camino muerto en
  cada consulta.
- **`included_processes` guarda también el orden.** La `§4.7` pide ordenar las
  secciones; ese orden es parte del informe y debe persistirse con él.

`included_processes` guarda `name` además de `id` de forma deliberada: no es
duplicación de la fuente de verdad, es el nombre **en el momento de generar**.
Si un proceso se renombra después, el informe conserva el nombre con el que se
emitió — y el `id` sigue permitiendo llegar al dato vivo.

**RLS:** por join hasta `projects`, siguiendo el patrón del resto de tablas.

**Sin trigger de inmutabilidad:** un informe no tiene `status` ni ciclo de
vida. Se borra y se rehace. Lo inmutable son los procesos que incluye, y de eso
ya se encargan sus propios triggers (decisión #3).

Tras aplicar la migración se regeneran los tipos (`database.ts`).

## Informes (`§4.7`)

### Rutas

| Ruta | Comportamiento |
|---|---|
| `/projects/[id]?tab=reports` | Listado de informes del proyecto y botón «Generar Nuevo Informe». Sustituye el `EmptyState`. |
| `/projects/[id]/reports/new` | Selección de procesos cerrados, orden de secciones, título y observaciones. |
| `/projects/[id]/reports/[reportId]` | Vista del informe en pantalla, con acción «Imprimir». |
| `/projects/[id]/reports/[reportId]/print` | Ruta imprimible: sin navegación ni cromo, maquetada con `@media print`. |

### Elegibilidad (función pura, decisión #10)

`reportSelectable(...)` decide qué entra en el selector, y es la que se testea:

- Poligonal y nivelación: `status === 'closed'`. Un `rejected` **no** es
  elegible (decisión #12).
- Asentamientos: el **lugar** con `status === 'closed'` (decisión #11).
- Un proyecto sin ningún proceso cerrado no puede generar informe, y la
  pantalla lo dice explícitamente en vez de ofrecer un formulario vacío.

### Estructura del documento

La que fija la `§4.7`: portada (proyecto, cliente, ubicación, fecha, equipo),
índice de procesos incluidos, una sección por proceso (datos, resultados y
gráfica donde aplique), resumen consolidado de precisiones, observaciones, y
registro de cierre (quién cerró cada proceso y cuándo).

El resumen consolidado usa el formateador único de la decisión #7.

## Exportación a Excel (`§4.8`)

Route Handler por módulo que devuelve el `.xlsx` con `Content-Disposition:
attachment`. Disponible en cualquier estado del proceso, como pide la `§4.8`.

Tres hojas, con el contenido que cada módulo tiene:

| Hoja | Poligonal | Nivelación | Asentamientos |
|---|---|---|---|
| Datos Crudos | Estaciones: ángulos DMS y distancias | Lecturas atrás/adelante, distancias, tipo de punto | Catálogo de puntos y lecturas por visita |
| Cálculos | Azimuts, proyecciones, correcciones, coordenadas | Cotas, correcciones, cotas compensadas | Parcial, acumulado, velocidad, alerta, diferenciales |
| Resumen | Método, error de cierre, precisión, tolerancia, estado | Error de cierre, tolerancia, estado | Umbrales, peor alerta, tendencia |

`scripts/build-poligonal-excel.mjs` ya construye un libro con las convenciones
del dominio y sirve de referencia directa para el formato y el estilo. **No se
reutiliza como código**: ese script genera una plantilla con fórmulas de
ejemplo; la exportación emite los datos de un proceso concreto.

Los formatos numéricos son los de `CLAUDE.md`: coordenadas a 3 decimales, cotas
a 4, ángulos en DMS.

## Validación y consistencia

Esta fase no añade capas de validación nuevas: consume datos ya validados y ya
cerrados. Lo que sí añade es **garantía de consistencia de lo persistido**,
que es donde el `§11` concentra el riesgo:

- Decisión #5 cierra la última puerta conocida a la divergencia de
  `alert_status`. Siguiendo el aprendizaje de la Fase 5 sobre cachés
  derivadas —«preguntarse qué otras entradas alimentan el mismo cálculo antes
  de dar la limitación por acotada»—, se enumeran en la tarea 4 **todas** las
  entradas al cálculo de asentamientos y se verifica que cada una queda
  cubierta: intercalar una visita y corregir una cota base ya las cubre
  `saveVisitAction`; editar umbrales es la que faltaba. Si aparece una cuarta,
  entra en esta fase.
- Decisión #7 elimina la tercera representación posible de una precisión.
- Decisión #3 hace que un informe no pueda cambiar entre dos aperturas.

## Criterios de aceptación

| # | Check |
|---|---|
| a | `npm run typecheck`, `lint`, `build`, `test` — exit 0 |
| b | La migración de la **Fase 5** está aplicada en producción y verificada contra la base (no contra la UI), y `main` está en `origin` |
| c | La migración de `reports` aplica limpia en local y en la nube |
| d | El selector ofrece **solo** procesos cerrados; un `rejected` no aparece (test de la función pura) |
| e | Un lugar de asentamientos aparece solo si su `status` es `closed` |
| f | Un proyecto sin procesos cerrados lo dice explícitamente, sin ofrecer un formulario vacío |
| g | El orden de secciones se persiste y el informe lo respeta al reabrirlo |
| h | La ruta imprimible produce un PDF legible vía «Guardar como PDF», con portada, índice, secciones, consolidado, observaciones y registro de cierre |
| i | Reabrir un informe generado da **exactamente** el mismo contenido |
| j | Export Excel de poligonal: 3 hojas, con los decimales de `CLAUDE.md` |
| k | Export Excel de nivelación y de asentamientos: 3 hojas |
| l | El export funciona con un proceso en borrador, no solo cerrado (`§4.8`) |
| m | Editar los umbrales de un lugar deja hub y panel mostrando **lo mismo**; las visitas cerradas conservan su clasificación (verificado contra la base) |
| n | `thresholdsOf` existe una sola vez en el repo |
| o | El listado y el editor muestran la **misma** precisión para el mismo proceso |
| p | El cierre del lugar pide resumen y checkbox de confirmación, como los otros tres |
| q | La gráfica distingue 10 series por forma, sin repetir |
| r | Tests nuevos: `expectStationCapture`, `pointCode` vacío, `niceTicks` degenerado, `computeDifferentials` sin lectura |
| s | RLS: un usuario no accede a informes de proyectos ajenos (404) |
| t | **Arranque en frío**: proyecto nuevo, sin procesos ni informes — la tab Informes y el alta se comportan bien, sin `NaN`, sin listas rotas |
| u | La tab «Informes» ya no muestra el `EmptyState` de «se construye en la última fase» |

## Riesgos conocidos

- **Esta fase consume datos persistidos, y el proyecto no tiene tests de esa
  capa.** Es el riesgo principal y el aprendizaje más transferible de la Fase
  5. Se mitiga con la decisión #10 (extraer la decisión a funciones puras),
  no se elimina: lo que quede en el Server Action sigue sin cobertura
  automática y exige verificación manual contra la base.
- **Verificar sobre datos sembrados oculta los fallos del arranque en frío.**
  Es el aprendizaje operativo de la Fase 5 y aquí aplica con fuerza: el seed
  tiene procesos cerrados, así que el camino «proyecto nuevo, ningún proceso
  cerrado, tab Informes» no se ejercita solo. Criterio `t`.
- **La migración de la Fase 5 toca producción y va primero.** Con auto-deploy
  desde `main`, el orden es forzoso: migrar y verificar **antes** de empujar,
  o Vercel desplegaría código que espera `sites` contra una base sin ellas.
- **El backfill no crea lugar para proyectos sin procesos.** Correcto para la
  migración, pero esos proyectos quedan sin ningún lugar en producción y no
  pasan por el código nuevo que crea el lugar al crear el proyecto. Hay que
  probar a mano ese camino en producción tras migrar (tarea 1).
- **La `§4.6` afirma que los `rejected` no van en informes, y nadie lo había
  implementado** porque hasta ahora no había informes. Es una regla escrita
  hace fases que se ejerce por primera vez aquí.
- **El PDF depende del navegador.** Los márgenes, encabezados y saltos de
  página varían entre navegadores; hay que fijar lo fijable con `@page` y
  aceptar el resto. Es el coste asumido de la decisión #1.
- **Los fallos de este dominio son silenciosos y plausibles.** Aquí el riesgo
  se concentra en el resumen consolidado: una precisión mal formateada o una
  alerta leída de la fuente equivocada produce un documento creíble y
  equivocado, firmado y entregado a un tercero.

## Tareas (en orden)

0. Apertura: este PRD, enmienda del `§3.2` (retirar `recipients`, retirar
   `file_url`, `project_id NOT NULL`) y del `§4.7` (retirar el envío por
   email) del PRD principal, estado `en curso` en `method.md` y
   `prds/README.md`. Commit `docs:`.
1. **Pendientes de la Fase 5**, en este orden estricto: auditoría de la nube
   (solo lectura) → `db push` → verificación contra la base → prueba de
   arranque en frío en producción → `git push origin main`.
2. Migración `reports` + RLS. Aplicar y regenerar tipos.
3. Extraer `thresholdsOf` a un solo sitio (decisión #6).
4. Divergencia de `alert_status`: enumerar las entradas al cálculo, función
   pura + tests, y `saveSiteAction` (decisión #5).
5. Formateador único de precisión; el listado pasa a usarlo (decisión #7).
6. Cierre del lugar: resumen + checkbox de confirmación (decisión #8).
7. Deuda barata: `expectStationCapture`, `pointCode`, `niceTicks`,
   `computeDifferentials`.
8. Export Excel de poligonal: Route Handler + 3 hojas.
9. Export Excel de nivelación y asentamientos.
10. Elegibilidad de procesos: función pura + tests (decisiones #10, #11, #12);
    queries de informes.
11. Alta de informe: selección, orden de secciones, título, observaciones.
12. Ruta imprimible: portada, índice, secciones, consolidado, observaciones,
    registro de cierre, `@media print`.
13. Formas de marcador hasta 10 series (decisión #9).
14. Listado de informes en la tab; retirar el `EmptyState`.
15. Verificación end-to-end (criterios a-u), **incluido el arranque en frío**.
    Documentación de handoff. Cierre de la fase y del PRD principal.

## Anti-alcance explícito

No se implementa: envío de informes por email; tabla `recipients`; pantalla
`/settings`; catálogo de equipos guardados; almacenamiento del PDF como
archivo; firma digital criptográfica; visor de PDF embebido; ajuste por mínimos
cuadrados. No se crean tablas SQL fuera de `reports`. No se refactoriza código
de fases anteriores salvo las deudas listadas en «Dentro», que son alcance
explícito de esta fase.
