# PRD-de-fase 35 — La poligonal como la mide el topógrafo

**Estado:** en curso
**Fecha de apertura:** 2026-10-05

**Rama:** `fase-35-ux-poligonal`
**Petición:** del usuario, 2026-10-05: «empecemos con la refactorización de la
UX, y simplificar lo que no es muy necesario, empezando por las poligonales».
Pidió un alta en popup con pocos campos y una pantalla del proceso por pasos
—datos, ajuste, informe— con la tabla y el dibujo lado a lado, pensada para el
teléfono, y tomó como referencia su hoja de Excel (`docs/carteras/poligonales.xlsx`)
y una pantalla de otra aplicación. Sobre el informe: «según el método elegido
debe mencionar cómo se realizó la corrección […] verifiques en cada método
consistencia en el código, algoritmos y microcopy». Y después: «aprovechemos
esto para deprecar la función de cerrar procesos […] no quiero limitar las
modificaciones»; quitarlo «de todo», y «por ahora solo […] poligonales».
**Maquetas aprobadas:** el lienzo «Poligonal — rediseño de la UX»: alta A,
Datos A, medición B, Ajuste e informe con su corrección por método.
**Módulo:** poligonal —alta, pantalla del proceso, ajuste, informe, Excel—,
la base, la demo, el seed y la documentación. Nivelación y asentamientos no
cambian.

## Propósito

Hoy la poligonal se crea en una página con ~20 campos —equipo con siete datos,
orden de precisión, tipo de ángulo, lecturas mínimas, punto de partida, amarre—
y se trabaja en un editor largo: veredicto, configuración plegable, una tabla
de estaciones con celdas que se expanden, dibujo y resultados, uno debajo del
otro. El topógrafo no piensa así: piensa como su cartera de Excel —desde qué
punto mide a cuál, con qué ángulo y distancia, qué azimut sale— y después
ajusta.

La fase deja:

- un **alta en popup** con lo que el topógrafo sabe al empezar;
- una **pantalla por pasos** —1 · Datos, 2 · Ajuste, 3 · Informe— con la
  tabla y el dibujo lado a lado;
- una **captura por popups**, cómoda en el teléfono: amarre y mediciones;
- un **ajuste** con la tabla de la hoja de Excel y el **orden alcanzado**
  detectado, no declarado;
- un **informe** que dice **cómo se corrigió**, según el método;
- una poligonal **que no se cierra**: siempre se puede modificar. Sin estados
  «Cerrado» ni «Rechazado», sin registro de cierre y sin triggers de
  inmutabilidad. Nivelación y asentamientos conservan su cierre por ahora.

## Hallazgos que condicionan la fase

### 1. El equipo no entra en ningún cálculo

Los siete campos del equipo —marca, modelo, serie, fecha de calibración,
precisión angular y de distancia (mm y ppm)— solo se leen en el informe, el
resumen de precisiones del consolidado y el Excel. Ningún cálculo, tolerancia,
veredicto ni peso de mínimos cuadrados los usa: la Fase 31 quitó el último
(el aviso de equipo insuficiente). Los pesos de mínimos cuadrados son otras
columnas (`ls_*`), en el ajuste.

### 2. El orden de precisión decide la tolerancia, y se puede detectar

`precision_order` fija K de la tolerancia angular (K·√n) y la precisión
relativa mínima (1:X) (`tolerances.ts`). Con el resultado del cálculo se
puede saber cuál es el **más alto que cumplen las dos**. En la cartera TT4:
12″ cabe en segundo orden (13.2″), pero 1:7.045 solo alcanza tercer orden
(1:5.000): **tercer orden**. La columna es NOT NULL con default
`tercer_orden`.

### 3. El tipo de ángulo también se puede detectar

Interior y exterior solo cambian la suma teórica: (n − 2)·180° frente a
(n + 2)·180°, más 360°·k con fila de cierre. Difieren en 720°: la suma
observada dice sin ambigüedad cuál es. La hoja de Excel lo anota así
(«TIPO DE ÁNGULO: I»).

### 4. `has_closing_row` nunca se guarda

La casilla «la cartera cierra contra el amarre» solo afecta al cálculo en
vivo: ni `save_polygonal_process` ni la acción de crear escriben la columna.
Solo la demo la escribe. Al recargar, un proceso con cierre angular contra el
amarre se recalcula con el esquema equivocado.

### 5. El modelo ya sirve para la captura «desde → hacia»

Una estación es el punto donde se arma el equipo, con su ángulo y la distancia
al siguiente. La fila «V10 → D1, 211°15′07″, 20.744 m» es la estación V10 con
el código del siguiente. El «0 atrás» es el amarre: la referencia y su azimut
desde la estación de partida. La fila de cierre angular es una estación más,
sin distancia. No hace falta cambiar `polygonal_stations` ni las lecturas.

### 6. Los métodos tratan distinto el ángulo de orientación

Brújula, Tránsito y Crandall reparten el error angular por igual entre todos
los ángulos de la condición, **incluido el de orientación** —como la hoja de
la TT4: −12″/7 = −1.71″ cada uno—. Mínimos cuadrados lo fija como **datum**
(Fase 14, decisión 6), como la hoja de la Sede Vivero
(`carteras/analisis-minimos-cuadrados.md`): un error suyo rota el polígono sin
afectar al cierre, así que las condiciones no lo determinan. Por eso el
azimut V10 → D1 sale 181°51′02.5″ con Brújula y 181°51′04.2″ con mínimos
cuadrados. Las dos cosas son correctas; hoy nadie lo explica.

### 7. La «corrección unitaria» de la hoja de Brújula es la del Tránsito

La hoja de la TT4 muestra, en la pestaña Brújula, una «corrección unitaria»
de 0.00010 y −0.00027: el error entre la **suma de proyecciones absolutas**,
que es el factor del Tránsito. El de la Brújula es el error entre el
**perímetro**: −0.0000726 y +0.000122 m/m. Cada método debe mostrar el suyo.

### 8. El editor y el alta comparten un componente

`PolygonalConfigFields` sirve al alta y a la configuración del editor. La
fase reemplaza las dos superficies, así que se retira en vez de ramificarse.

### 9. Qué depende hoy del cierre de una poligonal

- **Base:** los estados `closed` y `rejected`; `closed_at` y `closed_by`; los
  triggers `reject_update_on_closed_polygonal_process` (con la lista blanca de
  la georreferenciación y la reapertura de la Fase 34),
  `polygonal_processes_reject_delete_when_closed` y el de estaciones y lecturas
  (`reject_write_on_closed_process_station`, con su lista blanca de posición).
  `reject_update_on_closed_process()` e `is_reopening()` **se quedan**: los
  usan nivelación, lugares y visitas.
- **Código:** el diálogo y la acción de cerrar, `derivePolygonalCloseStatus`,
  reabrir (Fase 34), los editores en solo lectura, la marca de borrador del
  informe, el registro de cierre, la elegibilidad del consolidado («solo lo
  cerrado»), los chips y conteos «Cerrado» y «Rechazado» del hub, la acción
  de borrar el proyecto («con trabajo cerrado no se borra»), el Excel
  (estado), la demo y el seed.
- **Lo que deja de tener sentido:** «rechazado» era el veredicto de no cumplir
  la tolerancia **al cerrar**. Sin cierre, el veredicto queda como dato del
  ajuste: `meets_tolerance` y el orden detectado.

## Decisiones

| # | Decisión | Por qué |
|---|---|---|
| 1 | **Alta A**: popup con título, ubicación, responsable, cargo y tipo; el equipo plegado y opcional | Elección del usuario en las maquetas |
| 2 | Del equipo quedan **marca, modelo y n.º de serie**, y «Tomar del catálogo» | Elección del usuario. Las precisiones y la calibración no entran en ningún cálculo (hallazgo 1). Sus columnas **no se borran**: lo ya guardado se sigue mostrando en el informe y el Excel |
| 3 | El **orden de precisión se detecta** al calcular: el más alto que cumplen la tolerancia angular y la lineal | Decisión del usuario: «se detecta al realizar el ajuste» |
| 4 | El **tipo de ángulo se detecta** por la suma observada | Hallazgo 3; un campo menos que el usuario no sabría por qué se pide |
| 5 | Desaparecen las **lecturas mínimas por ángulo**: cada ángulo admite una o varias lecturas, que se promedian | La medición B lleva sus propias lecturas; el mínimo era un control solo de la interfaz |
| 6 | **Datos A**: cabecera en tarjeta, pasos con número, tabla y dibujo fijo a la derecha; amarre en su tarjeta; cierre angular debajo de la tabla | Elección del usuario |
| 7 | **Medición B**: popup con varias lecturas del ángulo, la casilla «Cierre» y el cierre angular opcional | Elección del usuario |
| 8 | **Sin botón Guardar**: cada popup guarda al confirmar | La captura ya no es una tabla editable: cada cambio es un popup confirmado |
| 9 | Los puntos de amarre se guardan **en el catálogo del proyecto**: si el código ya existe con otras coordenadas, se pide tomarlo del catálogo o usar otro nombre | Es como funciona hoy el amarre (`reference_point_id`), y así no se reescriben las coordenadas de un punto que usan otros procesos |
| 10 | El **ángulo de orientación**: los métodos proporcionales lo corrigen, mínimos cuadrados lo fija como datum, y el informe y el ajuste lo dicen | Hallazgo 6. Es lo que hacen las dos hojas de referencia del usuario |
| 11 | Cada método muestra **su propio factor** de corrección | Hallazgo 7 |
| 12 | El método se rotula **«Brújula (Bowditch)»** en todas partes | La hoja dice «Brújula»; la app decía «Bowditch (brújula)» |
| 13 | La sección del informe se titula **«Corrección por método …»** | Decisión del usuario sobre el texto |
| 14 | Una sola fase, informe y cierre incluidos; la cartera real de asentamientos pasa a la **Fase 36** | Decisión del usuario |
| 15 | La cabecera nueva y los pasos son **componentes de la poligonal**; `ProcessShell` sigue igual para nivelación y asentamientos | Cambios mínimos: esos módulos se rediseñan en sus fases |
| 16 | Las fórmulas se escriben en **notación matemática con MathML**, el estándar que el navegador dibuja sin librerías: fracciones, subíndices, sumatorias, raíces y matrices | Petición del usuario: «que se lean con notación matemática, no de algoritmo». MathML no añade dependencias ni scripts —la CSP no cambia— y se imprime igual en el PDF |
| 17 | **La poligonal no se cierra**: fuera el botón, el diálogo, los estados `closed` y `rejected`, el registro de cierre (`closed_at`, `closed_by`) y sus triggers de inmutabilidad | Decisión del usuario: «no quiero limitar las modificaciones», «quitar de todo». Solo la poligonal en esta fase: «por ahora solo […] poligonales» |
| 18 | Las poligonales cerradas o rechazadas se **reabren por migración** a `calculated`, y se **borran** `closed_at` y `closed_by` | Decisión del usuario, confirmada sabiendo que no se recupera |
| 19 | Un consolidado admite **cualquier poligonal calculada**, cumpla o no; nivelación y lugares siguen exigiendo cerrado | Decisión del usuario. Sin aviso de que se reconstruye con los datos actuales |
| 20 | El informe **alerta** cuando la poligonal no alcanza la precisión esperada —ningún orden, ni el ordinario—; la abierta sin control dice que no tiene verificación | Decisión del usuario: «alertar si está fuera de la precisión esperada donde aplique» |

## Alcance

### A. Base de datos

Dos migraciones, porque la segunda borra (ver Despliegue).

**Antes del merge** — `supabase/migrations/20261005010000_ux_poligonal.sql`:

- Las poligonales `closed` y `rejected` pasan a `calculated` (decisión 18).
- Se retiran los triggers de inmutabilidad de `polygonal_processes`,
  `polygonal_stations` y `polygonal_angle_readings`, y la función
  `reject_update_on_closed_polygonal_process()`. La de estaciones,
  `reject_write_on_closed_process_station()`, se retira si ninguna otra tabla
  la usa.

- `polygonal_processes` gana `location`, `responsible_name` y
  `responsible_role`, `text` nulables.
- `precision_order` pasa a **nulable** —sin verificación de cierre, o sin
  alcanzar el ordinario— y conserva su `CHECK`.
- `save_polygonal_process` escribe además `has_closing_row`, `angle_type`,
  `precision_order` y las tres columnas nuevas, con columnas explícitas
  (hallazgo 4).
- `src/types/database.ts` regenerado; solo se añade lo nuevo.

**Después del merge** — `supabase/migrations/20261006000000_poligonal_sin_cierre.sql`:

- Vuelve a pasar a `calculated` cualquier poligonal cerrada en la ventana
  entre las dos migraciones, con el código viejo.
- Borra `closed_at` y `closed_by` de `polygonal_processes`.
- El `CHECK` de `status` queda en `draft`, `in_progress` y `calculated`.

`angle_readings_min` y las precisiones del equipo no se borran: quedan sin uso
en la poligonal, anotadas en la § 11.

### B. Motor y reglas puras (TDD)

- `detectPrecisionOrder(result, type)` → `PrecisionOrder | null`
  (`src/lib/calculations/tolerances.ts` o un módulo propio).
- `detectAngleType(stations, hasOrientation, hasClosingRow)` →
  `"interior" | "exterior"`, por la suma teórica más cercana.
- `captureRows(stations, amarre, type)` → las filas de la tabla: desde, hacia,
  papel (0 atrás, lado, cierre, cierre angular), ángulo, distancia y azimut
  **sin ajustar**. Sirve a los dos esquemas de cierre (TT4 y Vivero).
- `correctionBreakdown(method, input, result)` → lo que muestra «Corrección
  por método»: la corrección angular y qué ángulos la reciben; para Brújula,
  d/P y la corrección por lado; para Tránsito, Σ|ΔN|, Σ|ΔE|, la corrección
  unitaria y la corrección por lado; para Crandall, λ₁, λ₂ y δd por lado;
  para mínimos cuadrados, la que ya da `adjustment`.
- `computePolygonal` deja de recibir el orden declarado: el veredicto y
  `meets_tolerance` salen del orden detectado. `meets_tolerance` es verdadero
  si alcanza al menos el ordinario.
- `CORRECTION_METHOD_LABELS.bowditch` = «Brújula (Bowditch)».

### C. Alta

- «Nuevo proceso → Poligonal» abre el **popup** en el hub; se retira la ruta
  `polygonal/new` y su página.
- Campos: título (obligatorio), ubicación, responsable, cargo, tipo
  (segmentado) y el equipo plegado: «Tomar del catálogo», marca, modelo y
  serie.
- Al crear, la acción inserta el proceso en borrador y redirige a la pestaña
  Datos.
- «Editar datos», en la cabecera, abre el mismo popup con los valores.

### D. Pantalla del proceso

- **Cabecera en tarjeta**: badges de tipo, estado y orden alcanzado; título;
  ubicación, responsable y cargo, equipo; acciones Editar datos, Exportar a
  Excel y «⋯» con Duplicar y Eliminar. Sin cerrar ni reabrir.
- **Pasos**: 1 · Datos, 2 · Ajuste, 3 · Informe, como pestañas con número; el
  selector **DMS / decimal** a la derecha, que rige también los popups. Se
  guarda por proceso, como hoy.

### E. Paso 1 · Datos

- Dos columnas que se apilan en el teléfono; ahí un selector «Tabla | Dibujo».
- **Puntos de amarre**: vacío, «Ingresar puntos de amarre» y «Medir sin
  amarre, en coordenadas locales». El popup pide la estación de partida y la
  referencia (0° atrás), cada una con nombre, Norte y Este, y «Tomar del
  catálogo». La referencia admite, en lugar de coordenadas, solo el azimut. En
  la abierta con control añade «Llegada»: punto conocido y azimut de llegada.
  Muestra el azimut calculado.
- **Mediciones**: tabla #, Punto («V10 → D1»), Ángulo, Distancia, Azimut sin
  ajustar, editar. La primera fila es el «0 atrás». Debajo, «+ Agregar
  punto».
- **Popup de medición** (B): «Estás en D1 · atrás en V10»; punto siguiente,
  lecturas del ángulo con «+ Lectura» y su promedio, distancia; en la abierta
  con control, el sentido de la deflexión. «Agregar y seguir en …» encadena.
  Desde la segunda medición de una cerrada, la casilla **Cierre** fija como
  siguiente la estación de partida; tras ella se ofrece el **cierre angular**
  contra la referencia. Tocar una fila abre el mismo popup para editarla o
  borrarla.
- **Cierre angular**, debajo de la tabla: vértices, ángulos en la condición,
  tipo detectado, suma observada y teórica, error y corrección por ángulo.
- **Dibujo** fijo a la derecha, sin ajustar, con zoom.

### F. Paso 2 · Ajuste

- Selector de método segmentado; con mínimos cuadrados, los tres σ a priori.
- Cifras: error angular, error de cierre, precisión relativa y **orden
  alcanzado**, con un desplegable «Por qué», orden por orden.
- Tabla al estilo de la hoja: lado, ángulo corregido, azimut, distancia,
  proyecciones, proyecciones corregidas y coordenadas, con fila Σ.
- Diferencias ΔN/ΔE, suma de proyecciones absolutas y el **factor del
  método**.
- Dibujo ajustado con la poligonal sin ajustar exagerada, y
  **Georreferenciar** en su tarjeta. «Asignar coordenadas reales» se retira:
  el popup del amarre lo sustituye.
- Con mínimos cuadrados: correcciones por ángulo y por distancia, σ₀ y su
  lectura χ².

### G. Paso 3 · Informe

La misma sección en la pestaña Informe y en el consolidado:

1. **Resultado**: errores, precisión, orden alcanzado y por qué.
2. **Datos de campo**: amarre, mediciones «desde → hacia» y cierre angular.
3. **Corrección por método …**: dos pasos para Brújula, Tránsito y Crandall
   —ángulos y proyecciones o distancias—, con su fórmula, su factor y la
   corrección por lado; para mínimos cuadrados, pesos, condiciones, el datum,
   las correcciones y σ₀. Cada uno dice qué ángulos se corrigieron
   (decisión 10).
4. **Poligonal ajustada**.
5. **Coordenadas** y dibujo.

Sin registro de cierre ni marca de borrador: la poligonal no se cierra. Si no
alcanza ningún orden, el informe lo **alerta** al principio (decisión 20). La
portada lleva ubicación, responsable y cargo, el equipo y la fecha del
informe.

Las fórmulas de la sección 3 —y las del Ajuste que las repiten— van en MathML
(decisión 16), con un componente pequeño que las arma; el texto alrededor
dice qué significa cada símbolo.

### H. Excel, demo y seed

- **Excel**: «Resumen» con ubicación, responsable y cargo; el orden alcanzado
  y el tipo de ángulo detectado; el rótulo del método.
- **Demo** (`src/lib/demo/`) y **seed**: las poligonales guardan el orden y el
  tipo detectados, y `has_closing_row`.
- **Duplicar** copia las columnas nuevas.

### I. Consistencia por método (pedido del usuario)

Al construir cada método se comprueba, con la cartera TT4:

- **algoritmo**: que `correctionBreakdown` reproduzca las proyecciones
  corregidas y las coordenadas de `computePolygonal` —por eso cada cifra de la
  sección sale del motor, nunca recalculada aparte—;
- **código**: que la pestaña Ajuste, el informe y el Excel usen las mismas
  funciones y rótulos;
- **texto**: que la explicación de cada método diga lo mismo en el Ajuste, el
  informe, el manual y `docs/math/poligonales.html`.

### K. Sin cierre en la poligonal

- Se retiran el diálogo y la acción de cerrar, `derivePolygonalCloseStatus` y
  sus pruebas, y la reapertura de la poligonal (Fase 34): su acción, su botón
  y su helper. La de nivelación, visitas y lugares se queda.
- El editor nunca está en solo lectura; la georreferenciación ya no necesita
  su excepción.
- **Hub:** la poligonal pierde los chips y conteos «Cerrado» y «Rechazado»; la
  tarjeta del proyecto cuenta sus estados nuevos.
- **Consolidado:** una poligonal es elegible si está calculada (decisión 19).
- **Borrar un proyecto:** las poligonales dejan de contar como trabajo cerrado.
- **Excel:** sin fila de cierre; el estado y el veredicto del ajuste.
- **Demo y seed:** las poligonales nacen calculadas, sin cerrar.

### J. Documentación

- Manual, en sus dos copias: el alta, la pantalla por pasos, el amarre, la
  medición, el ajuste con el orden detectado, el informe con su corrección
  por método. Capturas: se regeneran las de la poligonal (06, 07, 08, 09, 10,
  17, 20, 21, 22, 30) y `capturas.mjs` cambia sus selectores.
- `docs/math/poligonales.html`: el orden detectado, el tipo detectado, el
  datum en mínimos cuadrados y el factor de cada método.
- Doc técnica: el modelo, la detección, la poligonal sin cierre en
  «Inmutabilidad», la § 11 entrada por entrada.
- **PRD principal § 4.6** y **`CLAUDE.md`**: la poligonal no se cierra; la
  regla de inmutabilidad queda para nivelación, visitas y lugares.

## Fuera de alcance

- Nivelación y asentamientos: conservan su pantalla **y su cierre**.
- Borrar las columnas sin uso (precisiones del equipo, `angle_readings_min`):
  migración destructiva, para cuando nada las lea.
- Cambiar cómo mínimos cuadrados trata el datum.
- Importar carteras de estación total.

## Criterios de aceptación

| # | Criterio |
|---|---|
| a | El alta en popup crea una poligonal con título, ubicación, responsable, cargo y tipo, y lleva a Datos |
| b | Con la cartera TT4 capturada por popups, la tabla muestra «desde → hacia», los ángulos, las distancias y los azimuts sin ajustar de la hoja, y el cierre angular da 1080°00′12″, 12″ y −1.71″ |
| c | Recargar conserva el cierre angular contra el amarre (`has_closing_row`) |
| d | El ajuste por Brújula reproduce las coordenadas de la hoja al milímetro y detecta **tercer orden** |
| e | Tránsito, Crandall y mínimos cuadrados dan en la sección del informe las cifras del motor |
| f | El informe dice en cada método qué ángulos se corrigieron, con su factor propio |
| g | El selector DMS / decimal cambia la tabla, el ajuste, el informe y los popups |
| h | En el teléfono, a 390 px, se captura una medición sin desborde horizontal |
| i | Abierta con control y abierta sin control se capturan y ajustan como hoy, sin perder la deflexión ni la llegada |
| j | Las poligonales existentes, demo incluida, se ven y se ajustan con los mismos resultados |
| k | Ninguna poligonal muestra cerrar, reabrir, «Cerrado» ni «Rechazado»; tras la migración, las que estaban cerradas se editan |
| l | Un consolidado admite una poligonal calculada que no cumple, y su informe lo alerta |
| m | Nivelación, visitas y lugares siguen cerrándose y reabriéndose como hoy |
| n | `typecheck`, `lint`, `npm test`, `npx supabase test db` y `build` pasan |

## Pruebas mínimas

- **Vitest**: `detectPrecisionOrder` (las fronteras de cada orden, sin
  verificación, sin alcanzar el ordinario), `detectAngleType` (interior,
  exterior, con y sin fila de cierre), `captureRows` (TT4 y Vivero, abierta
  con control) y `correctionBreakdown` con la TT4 en los cuatro métodos,
  contra el motor y contra la hoja.
- **pgTAP**: las columnas nuevas, `precision_order` nulo, que
  `save_polygonal_process` escribe `has_closing_row`, que una poligonal ya no
  tiene trigger de cierre, y que nivelación, visitas y lugares lo conservan
  (`reabrir_procesos.test.sql` pierde sus casos de poligonal).
- **En pantalla**, en local: los criterios a–j, a 1280 px y a 390 px.

## Despliegue

| Paso | Migración | Cuándo | Código viejo con ella | Código nuevo sin ella |
|---|---|---|---|---|
| 1 | Columnas nuevas, `precision_order` nulable, guardado con `has_closing_row`, reabrir las cerradas, quitar los triggers | **Antes** del merge | Funciona: sin triggers, su cierre solo cambia el estado | Falla: escribe columnas que no existen |
| 2 | Borrar `closed_at` y `closed_by`, estados viejos fuera del `CHECK` | **Después** del merge | Fallaría al cerrar: por eso va después | Funciona: ya no las nombra |

Cada `db push`, con el visto bueno del usuario. El paso 2 no tiene vuelta
atrás (confirmado: decisión 18).

## Riesgos

1. **Perder capacidades del editor viejo**: la deflexión de la abierta con
   control, la llegada, la georreferenciación, el esquema de cierre de la
   Vivero. El criterio i y la demo los cubren.
2. **El orden detectado cambia el veredicto de lo que estaba cerrado**: al
   reabrirlas por migración, sus columnas guardadas se quedan como estaban; al
   primer guardado, pasan al orden y el tipo detectados.
5. **Un informe consolidado ya emitido** con una poligonal pierde su registro
   de cierre y muestra lo que haya: es la decisión del usuario.
3. **Un guardado por popup** multiplica las llamadas a la acción; cada una
   reescribe el proceso entero en una transacción, como hoy.
4. **Las capturas del manual** cambian casi todas las de la poligonal, y sus
   selectores también.
