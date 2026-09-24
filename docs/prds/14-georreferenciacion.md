# PRD-de-fase 15 — Georreferenciación de poligonales

**Estado:** en curso
**Fecha de apertura:** 2026-09-23
**Fecha de cierre:** —

**Rama:** `fase-15-georreferenciacion`
**Origen:** diferida por la Fase 7
([`06-motor-captura-poligonal.md`](./06-motor-captura-poligonal.md), «Fuera»),
con el mecanismo que allí quedó acordado: **recalcular y guardar**
**Módulo:** poligonal

## Propósito

Un levantamiento suele arrancar en un **sistema local arbitrario**, por ejemplo
el arranque en (1000, 2000) con un azimut supuesto. Las coordenadas reales
llegan después, a veces meses después y con el proceso ya cerrado: se miden con
GPS dos de sus estaciones. Esta fase lleva la poligonal al sistema real a partir
de esas **dos estaciones con coordenadas conocidas**, deja **registro** de quién
lo hizo, cuándo y con qué, y conserva las coordenadas locales.

## Cambio de reglas del proyecto

`CLAUDE.md` dice: «Los procesos con status "closed" son inmutables. Nunca
generar UPDATE sobre un proceso cerrado». El PRD principal (§ 4.6) dice lo
mismo. Esta fase abre **una excepción estrecha**, decidida por el usuario:

- **Solo** las columnas de posición: coordenadas, proyecciones, azimuts y los
  datos de arranque y llegada. Nunca ángulos, distancias, lecturas, errores,
  perímetro, precisión ni veredicto.
- **Solo** a través de la función de base `georeference_polygonal_process`,
  que deja un registro de auditoría en la misma transacción.

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
tocan.

## Decisiones

Las cuatro primeras las tomó el usuario al abrir la fase.

| # | Decisión | Razón |
|---|---|---|
| 1 | **Solo poligonales** | Es lo que acordó la Fase 7, y hay carteras reales para probarlo. La nivelación con cota arbitraria queda fuera |
| 2 | **Dos estaciones con coordenadas reales** definen la transformación | Es el caso típico: GPS a posteriori sobre dos puntos del levantamiento. El diálogo «Reasignar coordenadas» (arranque + azimut) sigue existiendo para procesos no cerrados, sin cambios |
| 3 | **Recalcular y guardar**, con excepción estrecha en el trigger y las coordenadas anteriores guardadas en un registro propio | Decisión del usuario, y lo acordado en la Fase 7 |
| 4 | Los **informes** muestran siempre las coordenadas **georreferenciadas**, con una nota de fecha y autor | Decisión del usuario. Un informe emitido deja de ser idéntico al reabrirlo: se enmienda esa afirmación en la doc técnica y en el comentario de la página imprimible |
| 5 | Se **recalcula** con la entrada transformada; no se rota lo calculado | Es lo que haría el topógrafo si hubiera tenido las coordenadas reales desde el principio. Y así el editor, el informe, el Excel y el dibujo —que recalculan desde la entrada (Fase 13)— coinciden con lo guardado. Con Tránsito las coordenadas se mueven hasta unos mm más allá de un movimiento rígido (hallazgo 1), y el diálogo lo advierte |
| 6 | Transformación **rígida** (rotación + traslación, sin escala), ajustada a las dos estaciones por sus centroides. El **factor de escala** se calcula y se muestra, pero no se aplica | Una escala cambiaría las distancias medidas y, con ellas, el error lineal y el perímetro que certificó el cierre |
| 7 | Al georreferenciar, un amarre del catálogo pasa a **amarre manual**: se conserva el código y se quita `reference_point_id` | Es la única forma de que el azimut rotado sobreviva al siguiente guardado (hallazgo 2). El registro guarda el `reference_point_id` anterior. El dibujo deja de mostrar el amarre, porque su posición real no se conoce |
| 8 | La **rotación se redondea a 0.1″** y la traslación a 0.1 mm | Son las resoluciones de las columnas: el azimut de arranque rotado sigue siendo exacto en DMS, y la traslación cabe en `decimal(12,4)` sin redondear otra vez |
| 9 | Se puede georreferenciar un proceso **calculado o cerrado**; no uno rechazado, en borrador ni en curso | Hacen falta coordenadas calculadas. Un rechazado no certifica ninguna posición. Un proceso no cerrado con cambios sin guardar exige guardar antes, como el cierre |
| 10 | Se puede georreferenciar **más de una vez**, y cada vez queda registrada | Corregir una coordenada de GPS mal tecleada no puede exigir reabrir el proceso. Deshacer es georreferenciar de nuevo con las coordenadas anteriores, que el registro conserva |
| 11 | El factor de escala fuera de la precisión del orden **avisa, no bloquea** | Con una proyección de factor ≠ 1 (p. ej. CTM12, k₀ = 0.9992) la diferencia entre distancia de terreno y de cuadrícula supera 1:5000 aunque todo esté bien. Decide el topógrafo |

### Cómo se abre la excepción en la base

Se consideraron dos formas de hacerlo; se propone la primera.

- **Función de base con bandera de transacción (propuesta).**
  `georeference_polygonal_process(...)` (`security invoker`, así que aplica la
  RLS del usuario) marca la transacción con
  `set_config('topofield.georeferencing', 'on', true)`, lee las coordenadas
  actuales para el registro, inserta el registro y escribe las columnas
  permitidas. Los triggers de la cabecera y de las estaciones admiten un UPDATE
  sobre un proceso cerrado **solo** con la bandera activa y **solo** si lo que
  cambió está en la lista blanca: se comparan las filas `to_jsonb(new) -
  lista` y `to_jsonb(old) - lista`. PostgREST no deja al cliente fijar esa
  bandera: solo se puede activar llamando a la función, y la función siempre
  deja registro.
- **Alternativa: lista blanca sin bandera.** El trigger admitiría cualquier
  UPDATE de columnas de posición sobre un cerrado. Es más simple, pero
  cualquier llamada directa a la API REST podría mover coordenadas sin dejar
  registro. **Se descarta**: la trazabilidad es el tema de la aplicación.

**Límite de la propuesta:** la función escribe los valores que le da la acción
del servidor; no recalcula el motor en SQL. Un dueño que llame a la función
directamente podría escribir coordenadas que no salen de una rotación, pero
**no** podría tocar ángulos, distancias ni el veredicto, y el registro
guardaría sus coordenadas anteriores leídas por la propia función. Recalcular
el motor en SQL eliminaría ese límite a costa de duplicar el motor.

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
create table public.polygonal_georeferences (
  id                        uuid primary key default gen_random_uuid(),
  process_id                uuid not null references public.polygonal_processes(id) on delete cascade,
  created_at                timestamptz not null default now(),
  created_by                uuid not null default auth.uid() references auth.users(id),
  -- Los dos puntos de control: estación, coordenadas locales y reales.
  point_a_code              text not null,
  point_a_local_north       decimal(12,4) not null,
  point_a_local_east        decimal(12,4) not null,
  point_a_north             decimal(12,4) not null,
  point_a_east              decimal(12,4) not null,
  point_b_code              text not null,
  -- (mismas cuatro columnas para B)
  -- La transformación aplicada. La rotación es un ángulo: DMS en tres campos.
  rotation_deg              int not null,
  rotation_min              int not null,
  rotation_sec              decimal(5,1) not null,
  shift_north               decimal(12,4) not null,
  shift_east                decimal(12,4) not null,
  scale_factor              decimal(12,9) not null,
  -- Lo que había antes, leído por la función, no enviado por el cliente.
  previous_start_north      decimal(12,4) not null,
  previous_start_east       decimal(12,4) not null,
  previous_start_azimuth_deg int, previous_start_azimuth_min int,
  previous_start_azimuth_sec decimal(5,1),
  previous_end_north        decimal(12,4), previous_end_east decimal(12,4),
  previous_end_azimuth_deg  int, previous_end_azimuth_min int,
  previous_end_azimuth_sec  decimal(5,1),
  previous_reference_point_id uuid,
  previous_coordinates      jsonb not null   -- [{station_order, point_code, north, east}]
);
```

- **RLS**: `select` e `insert` para el dueño del proyecto, como el resto. Sin
  políticas de `update` ni `delete`, y un trigger que los rechaza como defensa:
  el registro es de solo inserción.
- **Triggers**: la cabecera de poligonal pasa a su propia función
  (`reject_update_on_closed_polygonal_process`), con la excepción de la lista
  blanca; la de estaciones gana la misma excepción. Las listas blancas son:
  - cabecera: `start_north`, `start_east`, `start_azimuth_*`, `end_north`,
    `end_east`, `end_azimuth_*`, y `reference_point_id` solo hacia `null`;
  - estaciones: `azimuth_*`, `delta_north`, `delta_east`,
    `corrected_delta_north`, `corrected_delta_east`, `north`, `east`.

  Los ángulos corregidos no entran en la lista: una rotación no los cambia, y
  así la base garantiza que el cierre sigue siendo el mismo.
- **Función** `georeference_polygonal_process(p_process_id uuid, p_record
  jsonb, p_header jsonb, p_stations jsonb)`: rechaza procesos rechazados, en
  borrador o en curso (decisión 9), y hace todo en una transacción.

## Superficie

### Editor

- Botón **«Georreferenciar»**, también en un proceso cerrado. Deshabilitado,
  con el motivo al lado, en un rechazado, en un proceso sin coordenadas y en
  uno con cambios sin guardar.
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
  - En un proceso **cerrado**, la confirmación explica que solo se reescriben
    coordenadas y azimuts, con registro, y que el veredicto no cambia.
- Tras georreferenciar: una etiqueta «Georreferenciado el <fecha>» y una
  sección **«Georreferenciación»** con el historial. Cada entrada muestra
  fecha, autor, puntos, rotación, factor de escala y residuos.

### Informe imprimible

Las coordenadas actuales (decisión 4) y una nota en la sección de cada
poligonal georreferenciada: «Coordenadas georreferenciadas el <fecha> por
<autor>, con <A> y <B> (rotación <θ>, factor de escala <k>)».

### Excel

- «Cálculos» lleva las coordenadas actuales, como hoy.
- «Resumen» gana la sección «Georreferenciación» con la última: fecha, autor,
  puntos, coordenadas locales y reales de cada uno, rotación, traslación,
  factor de escala y número de georreferenciaciones.

## Archivos

| Archivo | Qué cambia |
|---|---|
| `supabase/migrations/<ts>_georreferenciacion.sql` | Tabla, RLS, función, triggers propios de la cabecera y de las estaciones |
| `src/types/database.ts` | Regenerado |
| `src/lib/calculations/georeference.ts` | Nuevo, puro: transformación desde dos puntos, aplicar a la entrada, factor de escala |
| `src/lib/validators/polygonal.ts` | Puntos de control válidos; estado admitido |
| `src/app/(app)/projects/[id]/polygonal/[pid]/actions.ts` | `georeferencePolygonalProcessAction`: transforma, recalcula, comprueba el veredicto y llama a la función |
| `src/components/polygonal/georeference-dialog.tsx` | Nuevo |
| `src/components/polygonal/polygonal-editor.tsx` | Botón, etiqueta e historial |
| `src/lib/supabase/queries.ts` | Registro de georreferenciaciones |
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
| Validación | Mismo punto dos veces, puntos coincidentes, coordenadas no finitas, estado no admitido |
| Seguridad | Probar la ruta: la acción rechaza un rechazado y un proceso con coordenadas sin calcular |

**Contra la base**, con `psql` y registrado en el guion de pruebas:

- Un UPDATE directo de `north` sobre un cerrado **falla**.
- La función sobre un cerrado funciona y deja un registro.
- Con la bandera activa, cambiar `angular_error_seconds` o un ángulo **falla**.
- El registro rechaza UPDATE y DELETE.
- Nivelación y asentamientos siguen igual de inmutables.

**En pantalla, antes de cerrar:**

1. La Vivero local cerrada: georreferenciar con D1 y D3 y ver las coordenadas
   de la tabla.
2. El aviso de escala con una coordenada mal tecleada (1 m de más en D3).
3. Tránsito: el aviso y el veredicto sin cambios.
4. El historial tras dos georreferenciaciones.
5. Un proceso con amarre del catálogo: el aviso y el amarre pasa a manual.
6. El informe imprimible con la nota y el Excel con la sección.
7. La ruta `/manual`.

## Criterios de aceptación

1. Una poligonal calculada o cerrada se georreferencia con dos de sus
   estaciones; una rechazada, en borrador o en curso no.
2. Sobre la Vivero local reproduce las coordenadas reales de la tabla.
3. El **veredicto no cambia** en ningún caso, y la base lo garantiza: ángulos,
   distancias, errores y precisión no se pueden escribir en un cerrado.
4. Cada georreferenciación deja un registro de solo inserción con fecha, autor,
   puntos, transformación y las coordenadas anteriores.
5. Fuera de la función, un proceso cerrado sigue siendo inmutable.
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
- **Unificar** «Reasignar coordenadas» y «Georreferenciar».

## Riesgos

- **Se cree que el informe emitido no cambia.** Lo decía la doc y lo decía el
  comentario de la página imprimible. Mitigación: la nota con fecha y autor en
  el informe, y se enmiendan las dos afirmaciones.
- **Dos puntos cercanos amplifican el error.** Un centímetro de error en
  puntos separados 10 m gira la poligonal 3.4′. Mitigación: la ayuda del
  diálogo y los residuos. Sin redundancia no se puede detectar: es el límite
  de usar dos puntos.
- **Coordenadas en una proyección con k ≠ 1** disparan el aviso de escala sin
  que haya error. Mitigación: el texto del aviso nombra esa causa.
- **La excepción se ensancha con el tiempo.** Mitigación: la lista blanca vive
  en el trigger, con la prueba contra la base de que un ángulo o un error no se
  pueden escribir.
