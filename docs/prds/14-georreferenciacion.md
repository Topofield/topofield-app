# PRD-de-fase 15 — Georreferenciación de poligonales

**Estado:** cerrada
**Fecha de apertura:** 2026-09-23
**Fecha de cierre:** 2026-09-24

**Rama:** `fase-15-georreferenciacion`
**Origen:** diferida por la Fase 7
([`06-motor-captura-poligonal.md`](./06-motor-captura-poligonal.md), «Fuera»),
con el mecanismo que allí quedó acordado: **recalcular y guardar**
**Módulo:** poligonal

> **Divergencias de la implementación:**
>
> - **Invariancia a 0.1 mm, no a 1e-6 m.** El arranque transformado se
>   redondea a su columna, así que recalcular en real y rotar lo local difieren
>   hasta 0.05 mm con Bowditch, Crandall y mínimos cuadrados.
> - **El veredicto se compara a la resolución de las columnas.** En una abierta
>   con control, arranque y llegada se redondean a 0.1 mm cada uno, y su
>   posición relativa es el cierre: el error lineal recalculado se mueve unas
>   centésimas de mm (0.02 mm en la prueba). No se reescribe, porque la base no
>   deja: el guardado es el de antes.
> - **`georeference-plan.ts`**, no previsto: la ruta completa desde las filas
>   —validar, ajustar, recalcular, comprobar el veredicto y producir las
>   columnas— en un módulo sin `"use client"`, que usan la vista previa y la
>   acción. Así se escribe exactamente lo que se vio, y la ruta tiene tests.
> - **La acción escribe fila a fila, sin transacción.** Queda en la § 11 de la
>   doc técnica: si falla a medias, se georreferencia otra vez.
> - **`Modal` gana `size="lg"` y cuerpo con desplazamiento**, para la tabla de
>   la vista previa. La cabecera del editor **envuelve en móvil**: con el botón
>   nuevo desbordaba a lo ancho a 390 px (lo delató la captura móvil).
> - **El aviso de solo lectura** de un cerrado o rechazado dice que la posición
>   se puede georreferenciar, y el **pie del informe** dice «mediciones y
>   veredicto inmutables», no «inmutables» a secas.
> - `capturas.mjs` buscaba «el» proceso cerrado del proyecto sin nombre; con la
>   Vivero local cerrada había dos. Ahora filtra por nombre.
> - Los residuos del diálogo pasan a metros cuando superan 1 m.
> - **Hallado en la revisión:** un factor de escala fuera de 0.5–2 **se
>   rechaza** con el motivo (son unidades equivocadas, y `georef_scale_factor`
>   no cabría), igual que coordenadas por encima de `decimal(12,4)`. La lista
>   blanca admite `reference_point_id` **solo hacia `null`**, como decía la
>   decisión 7, y `updated_at`, para no depender del orden de los triggers. El
>   `Modal` limita el alto y desplaza solo en su tamaño grande.

## Propósito

Un levantamiento suele arrancar en un **sistema local arbitrario**, por ejemplo
el arranque en (1000, 2000) con un azimut supuesto. Las coordenadas reales
llegan después, a veces meses después y con el proceso ya cerrado: se miden con
GPS dos de sus estaciones. Esta fase lleva la poligonal al sistema real a partir
de esas **dos estaciones con coordenadas conocidas**, recalculándola, **esté o
no cerrada**, y anota cuándo se hizo y con qué puntos.

Criterio del usuario al revisar el PRD: **que sea fácil de recalcular aunque
el proceso esté cerrado**. El producto todavía no se enfoca en una
trazabilidad estricta, así que no se pone ceremonia alrededor de la acción.

## Cambio de reglas del proyecto

`CLAUDE.md` dice: «Los procesos con status "closed" son inmutables. Nunca
generar UPDATE sobre un proceso cerrado». El PRD principal (§ 4.6) dice lo
mismo. Esta fase abre una excepción: **en un proceso cerrado se pueden
reescribir las columnas de posición** —coordenadas, proyecciones, azimuts y los
datos de arranque y llegada—. Lo que el cierre certificó sigue inmutable:
ángulos, distancias, lecturas, errores, perímetro, precisión y veredicto.

Las dos reglas se enmiendan en esta fase: `CLAUDE.md` y el § 4.6 del PRD
principal.

## Hallazgos que condicionan la fase

### 1. El veredicto no cambia; las coordenadas de Tránsito sí

La Fase 7 justificó la excepción así: «una rotación más traslación deja
invariantes el error angular, el error lineal, la precisión relativa y el
perímetro». **Es cierto para el veredicto** y se comprobó con la cartera Vivero:
el error lineal es 0.009951 m en local y en real, y el angular −4.0″ en ambos.

**No es cierto para las coordenadas con Tránsito.** Tránsito reparte el error
en proporción a |ΔN| y |ΔE|, que dependen de la orientación. Si se rota la
entrada y se recalcula, el resultado no es la salida rotada:

| Método | Diferencia máxima entre recalcular en real y rotar lo calculado en local (Vivero) |
|---|---|
| Bowditch | 0.0000 mm |
| Tránsito | **2.66 mm** |
| Crandall | 0.0000 mm |
| Mínimos cuadrados | 0.0000 mm |

Con Tránsito hay que **elegir** entre recalcular y rotar, y las dos opciones no
dan lo mismo. Ver la decisión 5.

### 2. Un amarre del catálogo desharía la georreferenciación

Con un amarre del catálogo (`reference_point_id`), `resolveStartAzimuth`
**recalcula el azimut de arranque** desde las coordenadas del catálogo en cada
guardado. Si esas coordenadas siguen en el sistema local, el siguiente guardado
de un proceso no cerrado deshace la rotación. El dibujo de la Fase 13, por su
parte, pondría el amarre en el sistema equivocado. Ver la decisión 7.

### 3. El trigger de inmutabilidad es compartido

`reject_update_on_closed_process()` protege a la vez las cabeceras de
poligonal, nivelación, lugar y visita. La excepción no puede ir en esa
función: poligonal pasa a tener **su propia función**, y las demás tablas no se
tocan. Nivelación y asentamientos siguen igual de inmutables.

## Decisiones

Las cuatro primeras las tomó el usuario al abrir la fase, y la 3 la simplificó
al revisar el PRD.

| # | Decisión | Razón |
|---|---|---|
| 1 | **Solo poligonales** | Es lo que acordó la Fase 7, y hay carteras reales para probarlo. La nivelación con cota arbitraria queda fuera |
| 2 | **Dos estaciones con coordenadas reales** definen la transformación | Es el caso típico: GPS a posteriori sobre dos puntos del levantamiento. El diálogo «Reasignar coordenadas» (arranque + azimut) sigue existiendo para procesos no cerrados, sin cambios |
| 3 | **Recalcular y guardar**, esté o no cerrado, como un guardado más | Decisión del usuario: fácil de recalcular, sin limitar el uso. No hay función de base, ni bandera, ni registro de solo inserción |
| 4 | Los **informes** muestran siempre las coordenadas **georreferenciadas**, con una nota de fecha | Decisión del usuario. Un informe emitido deja de ser idéntico al reabrirlo: se enmienda esa afirmación en la doc técnica y en el comentario de la página imprimible |
| 5 | Se **recalcula** con la entrada transformada; no se rota lo calculado | Es lo que haría el topógrafo si hubiera tenido las coordenadas reales desde el principio. Y así el editor, el informe, el Excel y el dibujo —que recalculan desde la entrada (Fase 13)— coinciden con lo guardado. Con Tránsito las coordenadas se mueven hasta unos mm más allá de un movimiento rígido (hallazgo 1), y el diálogo lo advierte |
| 6 | Transformación **rígida** (rotación + traslación, sin escala), ajustada a las dos estaciones por sus centroides. El **factor de escala** se calcula y se muestra, pero no se aplica | Una escala cambiaría las distancias medidas y, con ellas, el error lineal y el perímetro que certificó el cierre |
| 7 | Al georreferenciar, un amarre del catálogo pasa a **amarre manual**: se conserva el código y se quita `reference_point_id` | Es la única forma de que el azimut rotado sobreviva al siguiente guardado (hallazgo 2). El dibujo deja de mostrar el amarre, porque su posición real no se conoce |
| 8 | La **rotación se redondea a 0.1″** y la traslación a 0.1 mm | Son las resoluciones de las columnas: el azimut de arranque rotado sigue siendo exacto en DMS, y la traslación cabe en `decimal(12,4)` sin redondear otra vez |
| 9 | Se puede georreferenciar **cualquier proceso con coordenadas calculadas**, en cualquier estado, también rechazado | Sin limitar el uso. Hacen falta coordenadas en las dos estaciones elegidas. Un proceso no cerrado con cambios sin guardar exige guardar antes, para no mezclar la edición en curso con la georreferenciación |
| 10 | Se puede georreferenciar **más de una vez**. Se guarda **solo la última**, en columnas del proceso | Corregir un GPS mal tecleado es georreferenciar de nuevo, y deshacer es georreferenciar con las coordenadas anteriores. No hay historial: no se busca trazabilidad estricta |
| 11 | El factor de escala fuera de la precisión del orden **avisa, no bloquea** | Con una proyección de factor ≠ 1 (p. ej. CTM12, k₀ = 0.9992) la diferencia entre distancia de terreno y de cuadrícula supera 1:5000 aunque todo esté bien. Decide el topógrafo |

### Cómo se abre la excepción en la base

Los triggers de la cabecera de poligonal y de sus estaciones admiten un UPDATE
sobre un proceso cerrado o rechazado **si lo que cambió está en la lista
blanca de posición**. Se comparan las filas `to_jsonb(new) - lista` y
`to_jsonb(old) - lista`: si difieren, se rechaza como hoy.

- **Cabecera:** `start_north`, `start_east`, `start_azimuth_*`, `end_north`,
  `end_east`, `end_azimuth_*`, `reference_point_id` y las columnas
  `georef_*` nuevas.
- **Estaciones:** `azimuth_*`, `delta_north`, `delta_east`,
  `corrected_delta_north`, `corrected_delta_east`, `north`, `east`.

Los ángulos corregidos no entran en la lista: una rotación no los cambia, y así
la base garantiza que el cierre sigue siendo el mismo. Borrar un cerrado, o
tocar sus lecturas, sigue prohibido.

**Lo que se acepta:** cualquier sesión del dueño puede mover las coordenadas de
un cerrado por la API REST sin pasar por la acción. Es coherente con la
decisión 3: la garantía que se mantiene es la del **veredicto**, no la de la
posición.

## La transformación

Estaciones A y B, con coordenadas locales (las calculadas y guardadas) `a`, `b`
y reales `A`, `B`:

```
θ   = azimut(A→B) − azimut(a→b)                 redondeado a 0.1″
R   = rotación de θ en el sentido de los azimuts (horario desde el norte)
t   = centroide(A, B) − R · centroide(a, b)     redondeado a 0.0001 m
k   = |B − A| / |b − a|                          (informativo)
```

`N' = t_N + N·cos θ − E·sin θ` · `E' = t_E + N·sin θ + E·cos θ` · `Az' = Az + θ`

Se transforma **la entrada** del proceso —el punto de arranque, el azimut de
arranque y, en la abierta con control, el punto y el azimut de llegada— y se
recalcula con `computePolygonal`. Antes de escribir, la acción comprueba que el
veredicto recalculado (error angular, error lineal, perímetro, precisión
relativa y `meets_tolerance`) coincide con el guardado a la resolución de sus
columnas. Si no coincide, no escribe nada.

Los **residuos** que se muestran son los de las coordenadas finales
recalculadas frente a las reales tecleadas, en A y en B. Con dos puntos y
ajuste por centroides son iguales y opuestos a lo largo de la línea A–B, más
el efecto de Tránsito si es el método.

## Modelo de datos

```sql
alter table public.polygonal_processes
  -- La última georreferenciación (decisión 10). Todas null si nunca se hizo.
  add column georef_at            timestamptz,
  add column georef_by            uuid references auth.users(id),
  add column georef_point_a_code  text,
  add column georef_point_b_code  text,
  -- La rotación es un ángulo: DMS en tres campos.
  add column georef_rotation_deg  int,
  add column georef_rotation_min  int,
  add column georef_rotation_sec  decimal(5,1),
  add column georef_scale_factor  decimal(12,9);
```

- Los triggers de la cabecera y de las estaciones admiten la lista blanca de
  posición en un cerrado (arriba). La cabecera pasa a su propia función,
  `reject_update_on_closed_polygonal_process`; la de estaciones se edita.
- Sin tabla nueva y sin función de base: la acción del servidor escribe con el
  mismo camino que el guardado.

## Superficie

### Editor

- Botón **«Georreferenciar»**, en cualquier estado, también cerrado.
  Deshabilitado, con el motivo al lado, solo sin coordenadas calculadas o con
  cambios sin guardar.
- **Diálogo**:
  - Dos selectores de estación (vértices distintos con coordenadas) y, para
    cada uno, Norte y Este reales, tecleados o tomados de un punto del
    catálogo con coordenadas.
  - Ayuda: «Use las dos estaciones más alejadas entre sí: con puntos cercanos,
    un error pequeño en sus coordenadas gira mucho la poligonal».
  - **Vista previa** en vivo: rotación en DMS, traslación, factor de escala y
    residuos en A y B, y la tabla de coordenadas actuales frente a
    georreferenciadas.
  - **Avisos** que no bloquean: el factor de escala fuera de la precisión del
    orden (decisión 11); el método es Tránsito (hallazgo 1); el proceso tiene
    un amarre del catálogo, que pasa a manual (decisión 7).
  - En un proceso **cerrado**, el texto del botón de confirmar lo dice: se
    reescriben coordenadas y azimuts, y el veredicto no cambia. Sin un paso
    de confirmación extra.
- Tras georreferenciar, una línea bajo el título: «Georreferenciado el
  <fecha> con <A> y <B> (rotación <θ>, factor de escala <k>)».

### Informe imprimible

Las coordenadas actuales (decisión 4) y una nota en la sección de cada
poligonal georreferenciada: «Coordenadas georreferenciadas el <fecha> con <A> y
<B> (rotación <θ>, factor de escala <k>)».

### Excel

- «Cálculos» lleva las coordenadas actuales, como hoy.
- «Resumen» gana la sección «Georreferenciación»: fecha, puntos, rotación y
  factor de escala.

## Archivos

| Archivo | Qué cambia |
|---|---|
| `supabase/migrations/<ts>_georreferenciacion.sql` | Columnas `georef_*` y la lista blanca en los triggers de la cabecera y de las estaciones |
| `src/types/database.ts` | Regenerado |
| `src/lib/calculations/georeference.ts` | Nuevo, puro: transformación desde dos puntos, aplicar a la entrada, factor de escala |
| `src/lib/validators/polygonal.ts` | Puntos de control válidos |
| `src/app/(app)/projects/[id]/polygonal/[pid]/actions.ts` | `georeferencePolygonalProcessAction`: transforma, recalcula, comprueba el veredicto y escribe por el camino del guardado |
| `src/components/polygonal/georeference-dialog.tsx` | Nuevo |
| `src/components/polygonal/polygonal-editor.tsx` | Botón y línea de la última georreferenciación |
| `src/lib/export/polygonal-workbook.ts` · página imprimible | Sección y nota |
| `scripts/seed.mjs` | La cartera Vivero en sistema local, cerrada |
| `CLAUDE.md` · `PRD-TopoField.md` § 4.6 | La excepción a la inmutabilidad |
| Manual (dos copias), guion de pruebas, doc técnica | Como en cada fase |

## Pruebas

**Suite existente:** 618 tests.

**Valores esperados.** La cartera Vivero con Bowditch, calculada en local desde
(1000, 2000) con azimut de arranque 0°00′00″, y georreferenciada con **D1** y
**D3** en sus coordenadas reales:

| Punto | Local N | Local E | Real N | Real E |
|---|---|---|---|---|
| Famarena_5 | 1000.0000 | 2000.0000 | 100139.8440 | 101491.4440 |
| D1 | 995.5414 | 2032.6527 | 100117.4620 | 101515.6333 |
| D2 | 999.5272 | 2045.8223 | 100113.1727 | 101528.7072 |
| D3 | 1086.5452 | 2049.6800 | 100182.2390 | 101581.7814 |
| D4 | 1082.8627 | 2024.0967 | 100193.8973 | 101558.7130 |

- Rotación **35°00′07.8″**, que es el azimut real de Famarena_5 al amarre
  14_IS1.
- Traslación t_N ≈ 100467.9285, t_E ≈ 99279.5759.
- Factor de escala 1.000000000: D1–D3 mide 92.5831 m en los dos sistemas.
- Error lineal 0.009951 m y angular −4.0″, antes y después.

**Nuevas, como mínimo:**

| Qué | Casos |
|---|---|
| Vivero | Las coordenadas reales de la tabla a 0.1 mm; rotación exacta; el veredicto no cambia |
| Invariancia | Con los cuatro métodos, el veredicto es el mismo en local y en real. Bowditch, Crandall y mínimos cuadrados dan la rotación rígida de lo calculado en local (a 1e-6 m). Tránsito no, con una diferencia acotada: 2.66 mm en la Vivero |
| Transformación | Recupera θ y t exactos de dos puntos sin ruido. Con ruido, residuos iguales y opuestos. Factor de escala. Redondeo a 0.1″ y 0.1 mm |
| Abierta con control | Transforma también el punto y el azimut de llegada, y sigue llegando |
| Validación | Mismo punto dos veces, puntos coincidentes, coordenadas no finitas, estación sin coordenadas |
| Ruta | Probar la acción, no solo el módulo: georreferencia un cerrado y un rechazado, y rechaza un proceso sin coordenadas calculadas |

**Contra la base**, con `psql` y registrado en el guion de pruebas:

- Un UPDATE de `north` o de `start_north` sobre un cerrado **funciona**.
- Un UPDATE de `angular_error_seconds`, de un ángulo, de una distancia o de
  `status` sobre un cerrado **falla**.
- Borrar un cerrado o sus lecturas sigue **fallando**.
- Nivelación y asentamientos siguen igual de inmutables.

**En pantalla, antes de cerrar:**

1. La Vivero local cerrada: georreferenciar con D1 y D3 y ver las coordenadas
   de la tabla.
2. El aviso de escala con una coordenada mal tecleada (1 m de más en D3).
3. Tránsito: el aviso y el veredicto sin cambios.
4. Georreferenciar dos veces: la línea muestra la última.
5. Un proceso con amarre del catálogo: el aviso y el amarre pasa a manual.
6. El informe imprimible con la nota y el Excel con la sección.
7. La ruta `/manual`.

## Criterios de aceptación

1. Una poligonal con coordenadas calculadas se georreferencia con dos de sus
   estaciones, en cualquier estado, también cerrada.
2. Sobre la Vivero local reproduce las coordenadas reales de la tabla.
3. El **veredicto no cambia** en ningún caso, y la base lo garantiza: ángulos,
   distancias, errores y precisión no se pueden escribir en un cerrado.
4. La última georreferenciación queda anotada en el proceso: fecha, puntos,
   rotación y factor de escala.
5. Fuera de las columnas de posición, un proceso cerrado sigue siendo
   inmutable, y nivelación y asentamientos no cambian.
6. El factor de escala, Tránsito y el amarre del catálogo se avisan antes de
   confirmar.
7. El informe y el Excel muestran las coordenadas georreferenciadas con su
   nota o sección.
8. `CLAUDE.md` y el § 4.6 del PRD principal recogen la excepción.
9. `npm run typecheck`, `npm run lint` y `npm test` pasan limpios, con los
   tests nuevos sumados a los 618.
10. Manual en sus dos copias, en el mismo commit, con capturas regeneradas.
11. Doc técnica actualizada, con la tabla de pruebas regenerada desde la
    ejecución.
12. `docs/testing/manual-e2e-poligonal.md` cubre la georreferenciación y las
    pruebas contra la base.

## Fuera de alcance

- **Nivelación** con cota arbitraria (decisión 1).
- **Transformación de Helmert con escala**, o con más de dos puntos por
  mínimos cuadrados.
- **Factor de escala de la proyección** y reducción de distancias de terreno a
  cuadrícula: con coordenadas en una proyección de k ≠ 1 la poligonal queda
  georreferenciada a escala de terreno, y el aviso lo dice.
- **Conversión entre sistemas** (MAGNA-SIRGAS geográficas ↔ planas,
  CTM12 ↔ origen local). Se teclean coordenadas ya en el sistema del proyecto.
- **Georreferenciar el catálogo** de puntos de referencia, o añadir al catálogo
  las estaciones georreferenciadas.
- **Snapshot de informes** emitidos (decisión 4).
- **Historial** de georreferenciaciones y copia de las coordenadas locales
  (decisión 10).
- **Unificar** «Reasignar coordenadas» y «Georreferenciar».

## Riesgos

- **Se cree que el informe emitido no cambia.** Lo decía la doc y lo decía el
  comentario de la página imprimible. Mitigación: la nota con la fecha en
  el informe, y se enmiendan las dos afirmaciones.
- **Dos puntos cercanos amplifican el error.** Un centímetro de error en
  puntos separados 10 m gira la poligonal 3.4′. Mitigación: la ayuda del
  diálogo y los residuos. Sin redundancia no se puede detectar: es el límite
  de usar dos puntos.
- **Coordenadas en una proyección con k ≠ 1** disparan el aviso de escala sin
  que haya error. Mitigación: el texto del aviso nombra esa causa.
- **Se pierden las coordenadas locales.** Sin historial, lo único que queda es
  la última transformación. Mitigación: la rotación y los puntos quedan
  anotados, y la transformación inversa las reconstruye si hiciera falta.
- **La excepción se ensancha con el tiempo.** Mitigación: la lista blanca vive
  en el trigger, con la prueba contra la base de que un ángulo o un error no se
  pueden escribir.
