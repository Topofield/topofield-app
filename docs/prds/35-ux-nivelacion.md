# PRD-de-fase 36 — La nivelación como la mide el topógrafo

**Estado:** cerrada
**Fecha de apertura:** 2026-10-06
**Fecha de cierre:** 2026-10-07

**Rama:** `fase-36-ux-nivelacion`
**Petición:** del usuario, 2026-10-06: «haz un plan para que repliquemos este
modelo de ux/ui para el caso de nivelaciones y control de asentamientos,
replicando lo que hicimos para refinar el diseño en el módulo de poligonales».
La hoja de ruta de las dos fases está en
[`superpowers/specs/2026-10-06-ux-nivelacion-asentamientos-design.md`](../superpowers/specs/2026-10-06-ux-nivelacion-asentamientos-design.md).
**Maquetas aprobadas:** el lienzo «Nivelación — rediseño de la UX»
(<https://claude.ai/artifact/3XzPm9EFC8dXwwWGEAEvNs>): alta B (y de enlace),
libreta B, captura A, compensación con un solo gráfico, los gráficos por tipo
y el informe sencillo por tipo.
**Módulo:** nivelación —alta, pantalla por pasos, compensación, informe,
Excel—, la base, la demo, el seed y la documentación. De asentamientos solo
cambia lo que comparte con la nivelación (los avisos de equilibrado).

> **Divergencias de la implementación:**
>
> - **La libreta a medias se guarda en curso, sin compensar** (§ C). La
>   captura por armada guarda tras cada una, y el servidor rechazaba una
>   cerrada o de enlace cuya última fila no era el BM; además, el motor habría
>   compensado contra el punto de cambio. `pendingRun` reconoce el recorrido
>   sin terminar —sin armadas, la ida de una cerrada o de enlace que no llega a
>   su BM, la de una abierta con vuelta sin «Fin de la ida» ni vuelta
>   empezada, la vuelta que no llega al BM de partida—; entonces
>   `computeLevelingDetected` calcula con `compensation: "never"`, sin orden,
>   la acción guarda `in_progress` con el cierre en blanco y valida con
>   `validateRunCapture(…, { allowUnfinished: true })`. La visita conserva su
>   regla. Salió al capturar una cerrada en pantalla, no en el plan.
> - **El renombrado del BM es una sola regla** (`draftWithBm`): cambia los
>   extremos de cada recorrido que llevaban el código anterior, desde el popup
>   del BM y desde «Editar datos».
> - **En el teléfono la libreta es la lista por armada** de la maqueta «Móvil ·
>   Libreta»; la tabla de la hoja, desde 640 px. El perfil va siempre en el
>   sentido de la ida, con las distancias del recorrido que se mira y la
>   contraparte escalada.
> - **El gráfico de la compensación mide «medida − cota ajustada»**, la misma
>   cota de la tabla: en el tramo 2, que vuelve por sus puntos, la medida se
>   aparta hasta +2.4/−2.8 mm (el promedio de dos pasadas) y llega a −0.4 mm;
>   la maqueta de la cerrada dibujaba la corrección fila a fila.
> - **Con vuelta en una cerrada o de enlace**, la tabla y el informe usan la
>   forma «con vuelta» (cota de la ida y de la vuelta); «Datos ajustados» del
>   informe elige su forma por los datos: con vuelta, con puntos leídos dos
>   veces, o con la corrección de cada punto.
> - **El aviso de «No alcanza ningún orden»** no cita «(marco teórico § 8.1)»
>   en la interfaz: una prueba de la Fase 22 prohíbe citar secciones ahí. El
>   manual sí lo dice.
> - **Las lecturas de mira se formatean por libreta**: con un nivel digital,
>   todas a cuatro decimales, también la que termina en cero.
> - **El Excel sigue leyendo lo guardado**: el orden alcanzado es el detectado
>   al guardar; una nivelación anterior a la fase muestra el declarado hasta su
>   primer guardado (deuda técnica, como en la poligonal).
> - **Se retiró además** el código sin uso del cierre: `evaluateLevelingClosure`,
>   `levelingProcessVerdict`, `configWithImport`, `LevelingConfigFields`, y el
>   destino «process» de reabrir; `turningPointBlocker` se queda para la
>   visita.
> - **La demo y el seed** pierden `status` y `precisionOrder` de sus
>   nivelaciones (el orden se detecta) y marcan con `informe` la que alimenta
>   el informe. El seed no se ejecutó: exige `db reset` y la base local es
>   compartida; su lógica es la de la demo, que tiene pruebas.
> - **El popup del alta no ofrece importar**: el diálogo de importación trae
>   su propio modal; se importa desde la barra de pasos o la libreta vacía.
> - **Capturas**: nuevas `12-libreta-nivelacion`, `32-armada-nivelacion` y
>   `33-compensacion-nivelacion`, de El Verjón; fuera `12-editor-nivelacion` y
>   `24-puntos-homologos`, cuya tabla pasó a la columna «Vuelta − ida».
> - **La revisión de toda la rama** no encontró nada crítico. Se corrigieron,
>   cada una con su prueba vista fallar: el Excel de una nivelación guardada
>   antes de la fase daba el orden declarado —rechazada, el que no cumplía— y
>   cotas sin compensar como ajustadas (ahora la ruta usa `levelingRecordOf`,
>   lo mismo que guarda la acción); desmarcar «Con vuelta» en «Editar datos»
>   borraba su libreta sin aviso; agregar una armada tras una intermedia
>   colgada escribía la V+ en la intermedia; y una libreta que no encadena se
>   calculaba con orden y podía entrar a un consolidado (ahora queda en curso,
>   sin orden ni compensación, y dice qué fila revisar). Los cabos menores
>   quedaron en la § 11 de la doc técnica.

## Propósito

Hoy la nivelación se crea en una página con el orden de precisión, el equipo
con siete datos, el tipo de nivel y un selector de BM del catálogo, y se
trabaja en un editor largo: veredicto, configuración plegable, una libreta de
celdas editables, perfil, comprobación, cierre, cotas corregidas y adoptadas, y
los botones Guardar y Cerrar proceso. El topógrafo piensa como su cartera de
Excel: armada por armada, una vista atrás y una adelante, y después compensa.

La fase deja, como en la poligonal (Fase 35):

- un **alta en popup** con lo que se sabe al empezar;
- una **pantalla por pasos** —1 · Libreta, 2 · Compensación, 3 · Informe—
  con la tabla de la hoja y el perfil lado a lado;
- una **captura por armada en popups**, cómoda en el teléfono;
- el **orden alcanzado detectado**, no declarado;
- una **compensación sin limitantes, con avisos**;
- un **informe sencillo**, distinto para cada tipo;
- una nivelación **que no se cierra**.

## Hallazgos que condicionan la fase

1. **El orden de precisión se puede detectar.** Es el más alto con
   |e| ≤ K·√D (K = 3, 6, 12 y 24 mm) en la cerrada y la de enlace, y con
   |d| ≤ K·√D·√2 sobre el recorrido más corto en la abierta con vuelta. La
   abierta sin vuelta no tiene orden. El Verjón alcanza **segundo orden**
   (5.0 mm frente a 5.3); el tramo 2, **primer orden** (−0.4 mm frente a 3.5).
2. **El orden declarado decide hoy si se compensa**
   (`leveling.ts:385-389`): «solo se compensa un trabajo que cumple la
   tolerancia; si no cumple, se repite el levantamiento (marco teórico
   § 8.1)». De eso salen las cotas ajustadas.
3. **Ese motor es compartido con las visitas** de asentamientos
   (`computeLeveling` en `settlement-book.ts`), con el orden que declara cada
   visita. Cambiar la regla para todos cambiaría cotas de visitas ya
   guardadas: en Torre Alameda, la visita 9 cierra fuera de tolerancia.
4. **El tipo de nivel no entra en ningún cálculo**: solo oculta la libreta
   hasta elegirlo y limita los tres hilos al nivel automático.
5. **Del equipo solo se muestran** marca, modelo y serie; la σ mm/km y la
   calibración solo se leen en el informe y el Excel.
6. **`correction_method` no lo lee nadie** (hay un método) y nadie escribe ni
   lee `has_warnings`/`warning_messages`.
7. **El modelo ya sirve para la captura por armada.** Una fila es un punto: su
   V− cierra la armada anterior y su V+ abre la siguiente; la distancia y los
   hilos van por visual (`back_*`, `fore_*`). Una armada edita la V+ de un
   punto y la V− del siguiente, más sus intermedias. No hace falta cambiar
   `leveling_readings`.
8. **Ningún otro módulo depende de que una nivelación esté cerrada.** Las
   cotas ajustadas (`reports/adopted.ts`) solo exigen que cumpla.
9. **El equilibrado de visuales es un aviso de campo, no parte del ajuste**
   (`validateSightBalances`, Fase 19, y `validateSectionBalances`, Fase 32,
   dentro de `validateRunCapture`, que también usa la libreta de la visita).
   En El Verjón, 12 de 20 armadas pasan de los 5 m de segundo orden.
10. **`leveling_processes` no tiene ubicación ni responsable**, y
    `precision_order` es NOT NULL con default `tercer_orden`.
11. **El selector de BM** (`BmSelector`) lo comparten el alta de la nivelación
    y la visita; toma el código y la cota de los puntos de referencia.

## Decisiones

| # | Decisión | Por qué |
|---|---|---|
| 1 | **Alta B**: popup con título, tipo (cerrada, de enlace o abierta) con su recorrido dibujado, «con vuelta», BM de partida y —si es de enlace— BM de llegada, cada uno con código y cota; ubicación, responsable, cargo y equipo plegados | Elección del usuario en el lienzo |
| 2 | **El BM se teclea**: código y cota, sin catálogo | Decisión del usuario. La nivelación deja de leer los puntos de referencia; la visita conserva `BmSelector` hasta la Fase 37 |
| 3 | Del equipo quedan **marca, modelo y n.º de serie** con «Tomar del catálogo»; **sin tipo de nivel**. Las columnas no se borran | Hallazgos 4 y 5; como la decisión 2 de la poligonal |
| 4 | El **orden se detecta** al compensar (hallazgo 1) | Como en la poligonal |
| 5 | **Se compensa siempre** que haya contra qué cerrar: cerrada, de enlace y abierta con vuelta. Si no alcanza ni el ordinario, compensa igual y **avisa** que en la práctica se repetiría el levantamiento | Decisión del usuario: «no dejemos limitantes pero sí avisos» |
| 6 | La regla de la decisión 5 vale **solo para las nivelaciones**: el motor recibe una opción y las visitas conservan la suya hasta la Fase 37 | Hallazgo 3: cambios mínimos; ninguna cota de visita cambia en esta fase. *Alternativa*: aplicarla ya también a las visitas |
| 7 | **Fuera el equilibrado de visuales**, por armada y por sección, en la nivelación y en la visita | Decisión del usuario: no es parte del ajuste. No cambia ninguna cota |
| 8 | **Libreta B**: la tabla de la hoja (Punto, V+, AI, V−, VI, Cota, distancias) con Ida \| Vuelta y, fijo al lado, el **perfil con las miras y la visual** de cada armada. Con vuelta, la contraparte se dibuja **tenue**. En el teléfono, Tabla \| Perfil | Elección del usuario |
| 9 | **Captura A, por armada**: vista atrás (lectura y distancia) → vista adelante (punto, lectura y distancia), con hilos superior e inferior **opcionales** en cada visual, vistas intermedias y la casilla de fin («Fin de la ida», «Llega al BM») | Elección del usuario. Con hilos, la distancia sale de ellos y se comprueba el hilo medio |
| 10 | **Sin botón Guardar**: cada popup guarda la libreta completa al confirmar; «Guardar y seguir» abre la armada siguiente | Como en la poligonal |
| 11 | **Compensación**: el orden alcanzado con su «Por qué», la tabla de cotas medidas, correcciones y cota ajustada, y **un solo gráfico**: la ajustada a escala y lo medido separado de ella con la diferencia ×1000. Una versión por tipo; sin selector de método | Elección del usuario |
| 12 | **«Cota ajustada»**, no «adoptada», en la nivelación | Decisión del usuario; como en la poligonal |
| 13 | **Informe sencillo**: resumen con el veredicto, datos iniciales (la libreta), datos ajustados y el gráfico comparado; el método en una frase. Una versión por tipo; la abierta sin vuelta no tiene datos ajustados | Decisión del usuario. La sección es la misma en la pestaña y en el consolidado |
| 14 | **La nivelación no se cierra**: fuera los estados `closed` y `rejected`, el registro de cierre, sus triggers y reabrir. Un consolidado la admite calculada | Hoja de ruta, decisión 2 |
| 15 | La cabecera, los pasos y el borrador de la poligonal pasan a **componentes comunes** y los usan las dos | Hoja de ruta, decisión 5 |
| 16 | **Importar `.L` o CSV** vive en la barra de pasos, con el diálogo de hoy | Lienzo |

## Alcance

### A. Base de datos

Dos migraciones, porque la segunda borra (ver Despliegue).

**Antes del merge** — `…_ux_nivelacion.sql`:

- Las nivelaciones `closed` y `rejected` pasan a `calculated`.
- Se retiran `leveling_processes_reject_update_on_closed`,
  `leveling_processes_reject_delete_when_closed`,
  `leveling_readings_reject_write_when_closed` y la función
  `reject_write_on_closed_process_reading()`, que solo usa la nivelación.
  `reject_update_on_closed_process()`, `reject_delete_on_closed_process()` e
  `is_reopening()` **se quedan**: las usan lugares y visitas.
- `leveling_processes` gana `location`, `responsible_name` y
  `responsible_role`, `text` nulables.
- `precision_order` pasa a **nulable**: la abierta sin vuelta no tiene orden.
- `save_leveling_process` escribe además las tres columnas nuevas y
  `precision_order`, con columnas explícitas.
- `src/types/database.ts`: solo se añade lo nuevo.

**Después del merge** — `…_nivelacion_sin_cierre.sql`:

- Vuelve a pasar a `calculated` cualquier nivelación cerrada en la ventana.
- Se borran `closed_at` y `closed_by`, y el `CHECK` de `status` queda en
  `draft`, `in_progress` y `calculated`.

### B. Lo común (decisión 15)

- La cabecera en tarjeta (`polygonal-header.tsx`), la barra de pasos
  (`polygonal-steps.tsx`) y el borrador con guardado completo
  (`use-polygonal-draft.ts`) pasan a `src/components/process/`, sin cambio
  visible en la poligonal.
- `ProcessShell` sigue para asentamientos hasta la Fase 37.

### C. Motor y validación

- `detectLevelingOrder(result, input)`: el orden más alto que cumple, o `null`
  (hallazgo 1), en `src/lib/calculations/leveling.ts`.
- `computeLeveling` recibe la regla de compensación: **siempre** para la
  nivelación, **dentro de tolerancia** para la visita (decisiones 5 y 6).
- `validateRunCapture` deja de incluir el equilibrado; se retiran
  `validateSightBalances`, `validateSectionBalances`,
  `SIGHT_BALANCE_LIMIT_M` y `SECTION_BALANCE_LIMIT_M` (decisión 7).
- Las cotas ajustadas salen de lo compensado, con aviso si no alcanza ningún
  orden.

### D. Alta (decisión 1)

- `NewLevelingDialog`, abierto desde el hub. Se retiran la página
  `leveling/new/` y `LevelingConfigFields`.
- La acción de crear escribe título, tipo, vuelta, BM de partida y de llegada,
  y los datos plegados; el equipo, con `TotalStationIdentity` generalizado a
  «nivel».

### E. Paso 1 · Libreta (decisiones 8 a 10, 16)

- La tabla de la hoja, Ida \| Vuelta, solo lectura con un lápiz por fila que
  abre la armada.
- El popup de armada: escribe en las dos filas de la armada y en sus
  intermedias; «Guardar y seguir» abre la siguiente desde el punto de cambio.
- El popup del BM de partida (y de llegada).
- El perfil con miras, visuales y la contraparte tenue; el selector
  Tabla \| Perfil en el teléfono.
- La comprobación aritmética debajo de la tabla.

### F. Paso 2 · Compensación (decisiones 4, 5, 11, 12)

- El orden alcanzado con su «Por qué» por tipo (error o discrepancia frente a
  K·√D de cada orden) y el aviso si no alcanza ninguno.
- La tabla: cotas medidas (ida y vuelta, o medida y corrección), diferencias
  en los homólogos y cota ajustada.
- El gráfico único en sus cuatro versiones.

### G. Paso 3 · Informe (decisión 13)

- `leveling-section.tsx` reescrita: resumen, datos iniciales, datos ajustados
  y gráfico, según el tipo. La misma sección en el consolidado.
- La elegibilidad del consolidado admite la nivelación calculada; el pie y el
  resumen de precisiones dicen el orden detectado.

### H. Lo que se quita con el cierre

`close-process-dialog.tsx`, `close-status.ts`, `evaluateLevelingClosure`, la
acción de cerrar, reabrir la nivelación (`reopen-process.ts` y el
`ReopenDialog` de su página), el modo solo lectura, el registro de cierre y la
marca de borrador del informe, los chips «Cerrado» y «Rechazado» del hub, la
nivelación en `getClosedWorkCount`, y el estado en el Excel.

### I. Excel, hub, demo y seed

- `leveling-workbook.ts`: sin estado de cierre, «cota ajustada», el orden
  detectado.
- La demo: el tramo 2 queda calculado y sigue en su informe.
- El seed: «Circuito BM-2 (cerrado oficialmente)» → «Circuito BM-2».

### J. Documentación

El manual en sus dos copias y sus capturas (11, 12, 23, 24 y las de
nivelación que cambien), la doc técnica (fases, pruebas, deuda, despliegue),
`docs/math/nivelacion.html` (la regla de compensación y el orden detectado),
`PRD-TopoField.md` § 4.6 y `CLAUDE.md`.

## Fuera de alcance

- Asentamientos: su pantalla, su cierre, su regla de compensación, el orden
  de sus visitas y su selector de BM (Fase 37). Solo pierden los avisos de
  equilibrado.
- Las lecturas múltiples del `.L` (la σ y las repeticiones).
- Borrar las columnas sin uso (`level_type`, `km_precision_mm`,
  `equipment_calibration_date`, `correction_method`, `has_warnings`,
  `warning_messages`).

## Criterios de aceptación

| # | Criterio |
|---|---|
| a | El alta en popup crea una nivelación con título, tipo, vuelta y BM de partida, y lleva a Libreta; la de enlace pide los dos BM |
| b | El Verjón capturado por armadas reproduce la hoja: alturas del instrumento, cotas medidas y Σ V+ − Σ V− = 26.583 m en la ida |
| c | Con hilos, la distancia es (superior − inferior) × 100 y se comprueba el hilo medio; sin hilos, se teclea |
| d | La compensación de El Verjón da discrepancia 5.0 mm, **segundo orden** y las cotas ajustadas del lienzo (3289.4400 … 3315.0855) |
| e | El tramo 2 da cierre −0.4 mm y **primer orden** |
| f | Una nivelación fuera del ordinario se compensa y avisa |
| g | El perfil muestra la contraparte tenue solo con vuelta; el gráfico de la compensación tiene su versión para cada tipo |
| h | El informe tiene su versión para cada tipo, y un consolidado admite una nivelación calculada |
| i | En el teléfono, a 390 px, se captura una armada sin desborde horizontal |
| j | Importar `.L` y CSV funciona como hoy |
| k | Ninguna nivelación muestra cerrar, reabrir, «Cerrado» ni «Rechazado»; tras la migración, las que estaban cerradas se editan |
| l | No hay avisos de equilibrado en la nivelación ni en la visita |
| m | Las visitas calculan las mismas cotas que antes, y siguen cerrándose y reabriéndose |
| n | La poligonal se ve y funciona igual con lo común extraído |
| o | `typecheck`, `lint`, `npm test`, `npx supabase test db` y `build` pasan |

## Pruebas mínimas

- **Vitest**:
  - `detectLevelingOrder`: las fronteras de cada orden en cerrada, de enlace
    y abierta con vuelta, y `null` en la abierta sin vuelta.
  - La regla de compensación: la nivelación compensa fuera de tolerancia y la
    visita no.
  - La armada: de un popup a las filas (V+ del punto, V− del siguiente,
    intermedias), con y sin hilos.
  - El Verjón y el tramo 2 contra sus cifras.
- **pgTAP**: las columnas nuevas, `precision_order` nulo, que
  `save_leveling_process` las escribe, que la nivelación ya no tiene triggers
  de cierre y que lugares y visitas los conservan (`reabrir_procesos.test.sql`
  pierde sus casos de nivelación).
- **En pantalla**, en local: los criterios a–n, a 1280 px y a 390 px.

## Despliegue

| Paso | Migración | Cuándo | Código viejo con ella | Código nuevo sin ella |
|---|---|---|---|---|
| 1 | Columnas nuevas, `precision_order` nulable, guardado ampliado, reabrir las cerradas, quitar los triggers | **Antes** del merge | Funciona: sin triggers, su cierre solo cambia el estado | Falla: escribe columnas que no existen |
| 2 | Borrar `closed_at` y `closed_by`, estados viejos fuera del `CHECK` | **Después** del merge | Fallaría al cerrar: por eso va después | Funciona: ya no las nombra |

Cada `db push`, con el visto bueno del usuario. Antes del paso 1, una consulta
de solo lectura cuenta cuántas nivelaciones cambian de cotas con la regla
nueva. Después, El Verjón y el tramo 2 de producción se comparan con la hoja
y el análisis del crudo.

## Riesgos

1. **La regla nueva cambia cotas guardadas**: una nivelación fuera de
   tolerancia, que hoy no se compensa, se compensará al recalcularse.
   Mitigación: la consulta previa y el aviso en la pantalla y el informe.
2. **El orden detectado cambia el veredicto** de nivelaciones que declaraban
   otro: al primer guardado pasan al detectado; la cabecera y el informe lo
   detectan siempre.
3. **La captura por armada y el modelo por punto**: un popup escribe en dos
   filas. Mitigación: las pruebas de la armada y El Verjón capturado entero.
4. **Lo común extraído rompe la poligonal**: criterio n y sus pruebas.
5. **La visita pierde los avisos de equilibrado** antes de su rediseño: es la
   decisión del usuario, y su PRD lo recoge.
6. **Las capturas del manual** de la nivelación cambian casi todas.
