# PRD-de-fase 19 — Equilibrado por armada y compensación desde el origen

**Estado:** cerrada
**Fecha de apertura:** 2026-09-25
**Fecha de cierre:** 2026-09-25

**Rama:** `fase-19-equilibrado-compensacion`
**Peticiones:** N7 y N8 de [`pendientes.md`](../pendientes.md), halladas en la
Fase 18
**Módulo:** nivelación (y la libreta de la visita de asentamientos, que usa el
mismo motor)

> **Divergencias de la implementación:**
>
> - **La migración no resta la V+ al acumulado guardado** (hallazgo 5). Esa
>   fórmula coincidía en las 21 filas del seed, pero sobre la base local
>   completa —53 lecturas de nivelación y 208 de libreta, cerradas incluidas,
>   866 comparaciones— movía en ±1 el último decimal en 29: el acumulado y el
>   total guardados ya vienen redondeados al metro, y la resta redondeaba dos
>   veces. La migración recalcula la cadena desde las distancias por visual con
>   funciones de ventana, como el motor, y coincide en todas salvo dos empates
>   exactos del acumulado (164.5 m), donde el motor suma en coma flotante y
>   redondea abajo. Anotado en la § 11 de la doc técnica.
> - **La vuelta sí cambia su «Dist acum».** La decisión 8 se cumple —la vuelta
>   no se compensa—, pero el motor le aplica la misma regla de acumulado, así
>   que la migración reescribe su acumulado para que lo guardado diga lo mismo
>   que el editor. «Vuelta intacta» (sección «La migración») era inexacto.
> - **La guarda es más estrecha**: además de lo que dice la decisión 7, exige
>   error de cierre distinto de 0 y V+ en la fila, porque sin ellos la cota no
>   se mueve. Probada con un caso fabricado en una transacción revertida. Su
>   pista no propone volver a guardar la visita: no saca el caso de la
>   condición, y una visita cerrada no se puede guardar.
> - **Verificación en pantalla, además de lo previsto:** el crudo Leica da dos
>   avisos por armada (C16 → C17, 8.7 m; C17 → C16, 9.4 m), comprobados contra
>   sus distancias; y el registro de la visita 7 del demo deja el amarre en
>   100.0000 compensada.
> - **Capturas del manual:** además de las cuatro que cambian por la fase, se
>   regeneraron tres desfasadas desde fases anteriores (el texto del diálogo de
>   importación y las unidades de los KPIs de la Fase 18).

## Propósito

Corregir dos defectos del motor y del validador de nivelación que vienen de la
Fase 9. Los dos hacen lo contrario de lo que el manual ya promete:

- **N7.** El aviso de visuales desequilibradas debe comparar las dos visuales
  **de una armada**: la V+ de un punto y la V− del siguiente. Hoy compara la
  V+ y la V− de **una misma fila**, que en un punto de cambio son de armadas
  distintas.
- **N8.** La compensación proporcional debe usar la distancia **desde el
  origen hasta cada punto**. Hoy el acumulado de una fila incluye su propia
  V+, la visual que sale de ese punto. Por eso el BM de partida recibe
  corrección aunque su cota es conocida.

Y **recalcular los resultados ya guardados**, cerrados incluidos (decisión del
usuario).

## Cambio de reglas del proyecto

`CLAUDE.md` dice: «Los procesos con status "closed" son inmutables. Nunca
generar UPDATE sobre un proceso cerrado». Esta fase abre una excepción
**acotada a una migración**: se reescriben los **valores derivados** —distancia
acumulada, corrección y cota compensada— de las filas de nivelación y de las
libretas de visitas, también en procesos y visitas cerrados. Las **mediciones**
(lecturas, distancias por visual) y los veredictos (error de cierre,
tolerancia, cumple) no cambian.

Es el mismo patrón de los backfills de las fases 8 y 9: desactivar el trigger
de inmutabilidad solo alrededor del `UPDATE`. Criterio del usuario: se corrige
un defecto del motor, no una medición.

## Hallazgos que condicionan la fase

Verificados con código y con las carteras reales el 2026-09-24.

### 1. La hoja de campo de El Verjón agrupa por armada

La hoja original (`TRABAJO NIVELACION EL VERJON-corregido.xlsx`, hojas
`NIVELACION` y `CONTRANIVELACION`, no las «corregidas» que reconstruyó la
Fase 9) calcula la distancia de cada armada como **V+ del punto i + V− del
punto i+1**: `M4 = I3 + K6`, `M7 = I6 + K9`… y `K4 = I3 + J6`, `K7 = I6 + J9`…
El equilibrado es la comparación de esos dos sumandos.

Con la ida de El Verjón importada en pantalla (límite de tercer orden: 4 m):

| Armada (V+ → V−) | Distancias | Diferencia real | Aviso de hoy |
|---|---|---|---|
| D1 → C 1 | 31.5 / 28.5 m | 3.0 m | — |
| C 1 → C 2 | 28.1 / 17.3 m | **10.8 m** | **ninguno** (la fila C 1 compara 28.1 con 28.5) |
| C 2 → C 3 | 21.9 / 11.7 m | 10.2 m | 4.6 m en C 2 |
| C 3 → C 4 (salta AUX1) | 25.5 / 15.1 m | 10.4 m | 13.8 m en C 3 |
| C 4 → C 5 | 19.6 / 16.6 m | 3.0 m | 4.5 m en C 4 |
| C 5 → C 6 | 18.1 / 15.5 m | 2.6 m | — |
| C 6 → C 7 | 23.1 / 14.9 m | 8.2 m | 7.6 m en C 6 |
| C 7 → D3 | 24.2 / 8.4 m | **15.8 m** | 9.3 m en C 7 |
| D3 → C 8 | 14.7 / 21.8 m | 7.1 m | 6.3 m en D3 |
| C 8 → D4 | 12.1 / 15.7 m | 3.6 m | 9.7 m en C 8 |

Hoy calla un desequilibrio real, marca armadas que cumplen y da magnitudes
que no son las de ninguna armada.

### 2. El acumulado incluye la V+ que sale del punto

`accumulateDistances` suma a cada fila `bm`/`pc` su V− **y su V+**. La V+ es
la visual hacia la armada siguiente, que todavía no se ha recorrido al llegar
al punto. Efecto medido con el motor:

| Libreta | Cierre | Cambio mayor | BM de partida |
|---|---|---|---|
| Circuitos cerrados del seed (900 m) | −8.0 mm | **1.33 mm**, en el BM de partida | 100.0013 → **100.0000** |
| Crudo Leica, un recorrido (1397 m) | −0.4 mm | 0.01 mm | sin cambio a 4 decimales |
| Visita 5 del demo (112 m) | +1.1 mm | 0.28 mm, en el amarre | 99.6497 → **99.6500** |
| Visita 3 de Torre Alameda | +0.5 mm | 0.13 mm, en CP-1 | 99.9999 → 100.0000 |
| Visita fuera de tolerancia | +9.8 mm | ninguno (no se compensa) | — |

- **Las vistas intermedias no cambian.** Heredan el acumulado de su armada
  (la distancia hasta el instrumento), y eso es correcto. Por eso las cotas
  de los puntos de control de asentamientos no se mueven, salvo las de un
  punto usado como punto de cambio.
- **El punto de cierre tampoco cambia:** su acumulado es el total.

### 3. El manual ya dice lo correcto

El § 6.5 del manual promete «con las dos distancias **de una armada**» y
«según su distancia acumulada **del origen**». El § 6.8 del PRD principal
define `Corrección_i = −Error × Dist_acumulada_i / Dist_total`, que es correcto
si `Dist_acumulada_i` es el recorrido hasta el punto i. La fase hace que el
código cumpla lo prometido; la documentación solo se precisa.

### 4. Los procesos «reconstruidos» usan otra convención

El backfill de la Fase 9 (`distances_reconstructed`) repartió la distancia de
cada tramo **a medias entre la V− y la V+ de la misma fila**. En esos procesos,
la V+ de una fila es la mitad del tramo que **llega** al punto, no la visual que
sale de él. La regla actual les da el acumulado histórico exacto y la nueva lo
rompería. El fixture `fromAccum` de `leveling.test.ts` modela lo mismo, y por
eso sus tests no detectaron N8.

Hoy no existe ningún proceso reconstruido: ni en local ni en la nube, que se
vació en la Fase 18.

### 5. La regla nueva cabe en SQL, verificada contra el motor

Para una fila `bm`/`pc` de un proceso no reconstruido:

```
acumulado_nuevo = acumulado_guardado − distancia_V+_propia
corrección      = −(error_cierre / 1000) × acumulado_nuevo / distancia_total   (si cumple)
cota_compensada = cota_calculada + corrección
```

Comparada con el motor aplicando la regla nueva, **las 21 filas** de dos
nivelaciones del seed coinciden a la resolución de la base (4 decimales).
Error de cierre (`decimal(8,1)`) y total (`decimal(8,3)`) bastan.

### 6. Los avisos no se guardan

`saveLevelingProcessAction` no persiste `has_warnings` ni `warning_messages`,
así que N7 no deja datos que migrar.

## Decisiones

| # | Decisión | Razón |
|---|---|---|
| 1 | **N7 y N8 en una sola fase** | Petición del usuario. Los dos son del motor y el validador de nivelación, y comparten tests y carteras |
| 2 | El equilibrado se evalúa **por armada**: la V+ de una fila `bm`/`pc` contra la V− de la **siguiente fila no intermedia**. Las intermedias no abren ni cierran armada | Hallazgo 1: es lo que calcula la hoja de campo |
| 3 | El aviso va en la **celda de la V− que cierra la armada** y nombra la armada: «Armada C 1 → C 2: visuales desequilibradas, 10.8 m de diferencia; el límite del orden es 4 m» | Es donde está hoy y es la segunda visual que se teclea. Nombrar la armada evita la ambigüedad que N7 demostró |
| 4 | El acumulado de una fila `bm`/`pc` **termina en su V−**; su V+ se suma después, para las filas siguientes. Las intermedias heredan el acumulado de su armada, **sin cambio**. El total no cambia | Hallazgo 2 |
| 5 | Los procesos con `distances_reconstructed` **conservan la regla actual** | Hallazgo 4: su V+ no es la visual que sale del punto. El motor recibe la marca como entrada |
| 6 | **Se recalculan los resultados guardados, cerrados incluidos**, con una migración SQL que desactiva la inmutabilidad solo alrededor de cada `UPDATE` | Decisión del usuario. Hallazgo 5: la fórmula es exacta a la resolución de la base. Una migración corre igual en local y en la nube por el camino normal (`db push`) |
| 7 | La migración **aborta** si alguna libreta de visita tiene un punto de control usado como `bm`/`pc` en una visita compensada, y nombra el caso | Ese caso cambiaría una cota de asentamiento, y con ella parciales, acumulados, velocidades y alertas que solo recalcula `computeHistory`, no SQL. No se adivina: es la guarda de la Fase 8. Hoy no existe |
| 8 | La vuelta de ida y vuelta **no se toca**: no se compensa | Sin cambio de comportamiento |

## El motor

`src/lib/calculations/leveling.ts`:

```ts
accumulateDistances(readings, { reconstructed = false } = {}): number[]
//   reconstructed → regla actual (V− + V+ de la fila)
//   si no:
//     intermedia → hereda `running` (sin cambio)
//     bm / pc    → aquí = running + V−;  running = aquí + V+
```

`LevelingInput` gana `distancesReconstructed?: boolean`, que pasan el editor y
la acción de nivelación. La libreta de la visita nunca es reconstruida.
`totalDistanceFromReadings` no cambia: el último acumulado es el total con las
dos reglas.

## La validación

`src/lib/validators/leveling.ts`: `validateSightBalance(reading)` (por fila) se
sustituye por `validateSightBalances(readings, order, reconstructed)`, que
recorre las armadas y devuelve el aviso por fila. `validateRunCapture` la usa.
La libreta de la visita la hereda sin cambios. En los reconstruidos no se evalúa
(igual que hoy).

## La migración

`<timestamp>_compensacion_desde_el_origen.sql`:

1. **Guarda (decisión 7):** si hay una fila de `settlement_book_readings` con
   `point_id` no nulo, tipo `bm`/`pc` y V− en una visita `book` con
   `meets_tolerance`, la migración aborta con la lista.
2. `leveling_readings`, recorrido `forward`, procesos **no reconstruidos**:
   - todas las filas `bm`/`pc` → `distance_accumulated_km` nuevo;
   - si el proceso cumple (`meets_tolerance`) → `correction_applied` y
     `elevation_corrected` nuevos.
   - Triggers de lectura cerrada desactivados alrededor del `UPDATE`.
3. `settlement_book_readings` de visitas `book`: lo mismo, con el cierre y la
   distancia de la visita. Se desactivan los dos triggers de la libreta
   (visita cerrada y lugar cerrado).

Cabeceras (error, tolerancia, total, cumple) intactas; vuelta intacta.

## Superficie

- **Editor de nivelación y libreta de la visita:** cambian el texto y la
  posición de los avisos de equilibrado, la columna «Dist acum» de las filas
  `bm`/`pc` y la cota compensada. El BM de partida queda con corrección 0.
- **Registro de nivelación de la visita, Excel e informe:** leen lo guardado, y
  lo guardado queda migrado.
- **Seed y demo:** se generan con el motor nuevo. El generador de libretas
  vuelve a un comentario sin la referencia a N7.
- **Manual (dos copias):** una frase en el equilibrado («la V+ de un punto y la
  V− del siguiente») y otra en la compensación («el BM de partida no se
  corrige: su cota es conocida»).
- **PRD principal § 6.8:** se precisa `Dist_acumulada_i`.

## Archivos

| Archivo | Qué cambia |
|---|---|
| `src/lib/calculations/leveling.ts` (+ test) | `accumulateDistances` con la regla por punto y la marca de reconstruido |
| `src/types/leveling.ts` | `LevelingInput.distancesReconstructed` |
| `src/lib/validators/leveling.ts` (+ test) | `validateSightBalances` por armada |
| `src/components/leveling/leveling-editor.tsx`, `…/leveling/[pid]/actions.ts` | Pasan la marca al motor |
| `supabase/migrations/<ts>_compensacion_desde_el_origen.sql` | Guarda y recálculo |
| `src/lib/demo/libreta-asentamientos.ts` | Comentario |
| Manual (dos copias), `PRD-TopoField.md`, doc técnica, `pendientes.md`, `method.md`, `prds/README.md` | Como en cada fase |

## Pruebas

**Suite existente:** 765 tests.

**Nuevas o reescritas, como mínimo:**

| Qué | Casos |
|---|---|
| `accumulateDistances` | V+ 30 en la primera fila y V− 30 + V+ 25 en la segunda → `[0, 60]` (hoy `[30, 85]`): el segundo punto está a 30 + 30 m del origen; intermedia hereda; reconstruido conserva la regla actual (`[30, 85]`); vacío |
| Compensación | El fixture `fromAccum` se reescribe con distancias por visual reales (la V+ de BM-1 lleva 150 m). Con él, las correcciones siguen siendo `[0.0, 2.67, 5.33, 8.0]` y **el BM de partida queda en 0** |
| Valores de carteras | Circuito del seed: BM-1 100.0000, PC-1 100.3027, PC-2 99.8053 (hoy 100.0013 / 100.3040 / 99.8067). Crudo Leica: cierre −0.4 mm y total 1397.288 m sin cambio |
| `validateSightBalances` | La ida de El Verjón: avisos exactamente en C 2, C 3, C 4, C 7, D3 y C 8 (hallazgo 1), con la armada en el texto; ninguno en C 1, C 5, C 6 ni D4; la intermedia AUX1 no abre ni cierra armada; reconstruido sin avisos |
| Asentamientos | Libreta de forma prototipo: las cotas de los puntos de control (intermedias) **no cambian**; el amarre queda con corrección 0 |
| Generador del seed | Sigue reproduciendo la serie a 0.1 mm |

**Contra la base, antes de cerrar:**

1. Sobre la base local **con datos de la regla vieja**, antes de `db reset`, se
   aplica la migración (`migration up`). Cada fila migrada se compara con la
   que el motor nuevo calcula de sus lecturas: iguales a 4 decimales, cerradas
   incluidas.
2. La guarda aborta con un caso fabricado y nombra la visita.
3. `db reset` + seed: aplica limpia sobre la base vacía.
4. En pantalla, El Verjón y el crudo Leica: avisos, «Dist acum» y cotas.

## Criterios de aceptación

1. El equilibrado se evalúa por armada. Con El Verjón, los avisos son los del
   hallazgo 1 y nombran la armada.
2. El BM de partida no recibe corrección; los puntos de cambio se compensan con
   la distancia desde el origen; intermedias y punto de cierre no cambian.
3. Los procesos reconstruidos conservan su regla.
4. La migración recalcula lo guardado, cerrados incluidos, y coincide con el
   motor a 4 decimales; la guarda aborta con un punto de control usado como
   punto de cambio.
5. Las cotas de asentamiento no cambian (sin puntos de control como punto de
   cambio).
6. `npm run typecheck`, `npm run lint`, `npm test` y `npm run build` limpios,
   con los tests nuevos.
7. Migración aplicada en la nube.
8. Manual en sus dos copias y doc técnica al día; N7 y N8 cerradas en
   `pendientes.md`.

## Fuera de alcance

- **La distancia propia de una vista intermedia** en su compensación (la del
  instrumento a la mira). El motor usa la de su armada, que es la práctica
  habitual; afinarla exigiría capturarla y usarla.
- **Compensar la vuelta** en ida y vuelta.
- **Recalcular cotas de asentamiento** por SQL (decisión 7).
- **Migrar los procesos reconstruidos** a la regla nueva: no hay distancias por
  visual reales de las que partir.

## Riesgos

- **La excepción de inmutabilidad.** Mitigación: acotada a derivados, en una
  migración revisable, con el patrón ya usado en las fases 8 y 9.
- **Redondeo.** La migración parte del error de cierre a 0.1 mm. El motor
  coincide a 4 decimales en las 21 filas medidas. Una diferencia en el último
  dígito solo aparecería al volver a guardar un proceso abierto, y la
  corregiría el propio guardado.
- **Tests que fijan la regla vieja** sin decirlo, como `fromAccum`.
  Mitigación: se reescriben con distancias por visual reales, no se ajustan
  sus números esperados.
- **La migración se prueba sobre datos de la regla vieja.** `db reset` aplica
  las migraciones con la base vacía, así que no la probaría (lección de la
  Fase 18). Mitigación: `migration up` sobre la base local actual, antes de
  resetear.

## Tareas (en orden)

0. **Apertura:** este PRD, estados en `method.md` y `prds/README.md`. Commit
   `docs:`.
1. `accumulateDistances` y `LevelingInput.distancesReconstructed`, con tests
   (fixture `fromAccum` reescrito).
2. `validateSightBalances` por armada, con los tests de El Verjón.
3. Editor y acción de nivelación pasan la marca.
4. Migración de recálculo con su guarda; verificación contra la base local con
   datos viejos.
5. Tests de asentamientos y del generador.
6. Verificación en pantalla (El Verjón, crudo Leica, visita del demo).
7. Manual (dos copias), PRD principal § 6.8, doc técnica, `pendientes.md`.
8. Migración en la nube, cierre, PR.
