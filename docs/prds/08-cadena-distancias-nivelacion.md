# PRD-de-fase 9 — Cadena de distancias de nivelación

**Estado:** en curso
**Fecha de apertura:** 2026-09-22
**Fecha de cierre:** —

**Rama:** `fase-9-cadena-distancias-nivelacion`
**Diseño previo:** [`docs/superpowers/specs/2026-09-22-fase-9-cadena-distancias-nivelacion-design.md`](../superpowers/specs/2026-09-22-fase-9-cadena-distancias-nivelacion-design.md)
**Peticiones que recoge:** N2 y N3 de [`pendientes.md`](../pendientes.md)
**Cartera de referencia:** [`carteras/analisis-nivelacion-verjon.md`](../carteras/analisis-nivelacion-verjon.md)

## Propósito

Hacer que la distancia del recorrido de nivelación **se derive de las
mediciones** en vez de teclearse, y capturar los tres hilos estadimétricos que
la producen.

De ese número depende la tolerancia de cierre `K·√D`, es decir el veredicto de
si el trabajo cumple. Hoy se teclea a mano y nada lo verifica.

## Hallazgos que originan la fase

Verificados sobre el código y sobre una cartera real, no inferidos.

### 1. Tres campos de distancia, ninguno relacionado con los otros

| Campo | Dónde se teclea | Quién lo lee |
|---|---|---|
| `distance_m` por fila | `readings-table.tsx:199` | **nadie** |
| `distance_accumulated_km` por fila | `readings-table.tsx:213` | la compensación |
| `total_distance_km` del proceso | `leveling-editor.tsx:345` | la tolerancia `K·√D` |

El motor no verifica ninguna relación entre ellos. De ahí tres fallos que hoy no
detecta nada:

- **El acumulado no tiene por qué ser la suma de los parciales.** Parciales
  30/30/40 con un acumulado de 0.120 km pasan en verde.
- **El acumulado final no tiene por qué ser igual a `total_distance_km`.** El
  JSDoc de `applyProportionalCorrection` (`leveling.ts:120-128`) documenta este
  contrato como **no verificado**: si la fila terminal trae un acumulado
  distinto del total, el punto final **no cierra contra su cota conocida** y el
  resultado queda mal corregido en silencio.
- **`total_distance_km` decide si el trabajo cumple**, y es un número tecleado.

`distance_m` es además un campo capturado que nadie lee — el patrón que el
cierre de la Fase 7 dejó anotado como «una pregunta sin responder».

### 2. La cartera real demuestra el fallo, no lo predice

`TRABAJO NIVELACION EL VERJON.xlsx` es una cartera correcta en su aritmética
—las dos hojas cierran `ΣV+ − ΣV− = Hf − H0` al bit— y aun así **pierde 24.7 m
de su distancia total**.

La causa es exactamente la clase de fallo que esta fase elimina: una vista
intermedia (`AUX 1`) rompió la cadena de sumas. Dos fórmulas quedaron rotas y el
escalón del salto no se escribió, así que la visual adelante de `C 3` no entra
en ninguna suma. La hoja reporta `372.9 m` donde hay `397.6 m`.

Y esa cifra alimenta la tolerancia. Aquí el veredicto no cambió —por suerte, no
por diseño—: con un error de cierre entre `6.107` y `6.306 mm` la hoja habría
declarado «NO CUMPLE» sobre un trabajo que sí cumplía.

**Es la justificación empírica de la fase.** Un topógrafo competente, con una
cartera por lo demás correcta, emitió un veredicto sobre un número equivocado, y
nada avisó.

### 3. La cartera fija la forma de la captura

- Los **tres hilos son la norma**: cada punto ocupa tres filas (superior, medio,
  inferior) y la distancia sale de `(HS − HI)·100`.
- Hay **dos distancias por armada**, en columnas separadas (`DISTANCIA V+` y
  `DISTANCIA V-`). No una «distancia al cambio».
- Pero en **dos armadas de doce falta el hilo inferior** (`C 6` y `C 3` de la
  contranivelación, con `"---"` en su celda). Un modelo que exigiera los tres
  hilos no podría capturar esta cartera.

### 4. La deuda del equilibrado se vuelve pagable

`validators/leveling.ts:33-38` afirma que el equilibrado de visuales no se puede
validar porque «`distanceM` guarda un solo valor por fila», y que arreglarlo
«exigiría capturar ambas distancias por armada — un cambio de modelo de datos
que no entra en esta fase».

Ese cambio de modelo es justo lo que esta fase hace. La deuda pasa a ser
pagable, y dejarla sin pagar repetiría el error de `distance_m`: capturar un
dato que nadie lee.

## Decisiones

| # | Decisión | Razón |
|---|---|---|
| 1 | N2 y N3 en una sola fase | Son los dos extremos de la misma cadena: hilos → distancia → acumulado → total → tolerancia. Separarlas tira trabajo |
| 2 | **Acumulado y total derivados estrictos**, de solo lectura, sin override | Los tres fallos del hallazgo 1 dejan de ser representables |
| 3 | La **distancia por visual sí es editable**, y se autocompleta desde los hilos | Taquimetría y cinta son dos formas legítimas de medir. No debilita la 2: el acumulado y el total se derivan de lo que haya |
| 4 | **Los tres hilos son opcionales**; la lectura de mira es siempre editable | Confirmado por la cartera: dos armadas de doce no los tienen completos |
| 5 | **Dos distancias por armada siempre**, con hilos o sin ellos | Es lo que permite validar el equilibrado en todos los casos y no en media tabla |
| 6 | Se **paga la deuda del equilibrado** | La fase produce el dato que faltaba |
| 7 | **Backfill por diferencias sucesivas**, repartido por mitades y marcado como reconstruido | El reparto atrás/adelante no está en los datos; un reparto inventado daría equilibrado perfecto siempre, un aviso falso de conformidad |
| 8 | `level_type` sin definir **exige elegirlo** antes de capturar | Precedente de `angle_type` (Fase 7): adivinar reintroduce el fallo silencioso |
| 9 | Se corrige `scripts/seed.mjs` dentro de la fase | Sin eso el backfill limpia el pasado y el seed lo ensucia al siguiente `db reset` |
| 10 | La **importación por CSV queda fuera** (N4) | Flujo distinto que no comparte código; y su formato hay que verlo, no suponerlo |

## Modelo de datos

### Columnas nuevas en `leveling_readings`

| Columna | Tipo | Para qué |
|---|---|---|
| `back_upper_m` | `decimal(6,4)` | Hilo superior de la visual atrás |
| `back_lower_m` | `decimal(6,4)` | Hilo inferior de la visual atrás |
| `fore_upper_m` | `decimal(6,4)` | Hilo superior de la visual adelante |
| `fore_lower_m` | `decimal(6,4)` | Hilo inferior de la visual adelante |
| `back_distance_m` | `decimal(8,3)` | Distancia a la mira de atrás |
| `fore_distance_m` | `decimal(8,3)` | Distancia a la mira de adelante |

**El hilo medio no lleva columna propia.** Es la lectura de mira, y esa ya
existe: `backsight` y `foresight`. Duplicarla crearía dos fuentes de verdad para
el mismo número, que es el defecto que esta fase viene a eliminar, no a
extender.

`decimal(6,4)` es el tipo que `backsight`/`foresight` ya tienen — los hilos son
lecturas de mira y comparten su precisión. `decimal(8,3)` para las distancias da
milímetro sobre distancias de hasta 99999 m; la `distance_m` que se elimina era
`decimal(8,1)`, menos precisa de lo que la taquimetría produce.

### Columna nueva en `leveling_processes`

| Columna | Tipo | Para qué |
|---|---|---|
| `distances_reconstructed` | `boolean not null default false` | Marca los procesos cuyas distancias por visual las inventó el backfill. Sobre ellos el equilibrado **no se evalúa** |

### Columnas que cambian de naturaleza

- `distance_accumulated_km` — **se conserva, pasa a derivada**. La escribe el
  servidor al recalcular; la UI la muestra en solo lectura. Se mantiene
  persistida porque el informe y el export la leen sin recalcular, y el cierre
  de la Fase 6 dejó la regla de que todo lo persistido debe tener un consumidor
  que lo lea tal cual.
- `total_distance_km` — igual: derivada, persistida, de solo lectura.
- `distance_m` — **se elimina**, tras el backfill. No la lee nadie y su
  sustituto son las dos distancias por visual.

## Motor de cálculo

Funciones nuevas en `src/lib/calculations/leveling.ts`. Puras: sin React, sin
Supabase, solo math (`CLAUDE.md`).

```ts
/**
 * Distancia por taquimetría: D = (HS − HI)·K, con K = 100.
 * La visual de un nivel es horizontal por construcción, así que NO lleva la
 * corrección por cos²α que llevaría un teodolito inclinado.
 */
export function stadiaDistance(upper: number, lower: number, k = 100): number

/** Distancia acumulada por fila, desde las distancias por visual. */
export function accumulateDistances(readings: ReadingInput[]): number[]

/** Total del recorrido: el acumulado de la última fila que propaga cota. */
export function totalDistanceFromReadings(readings: ReadingInput[]): number
```

### Cómo acumula

El acumulado de una fila es la suma de las distancias de todas las visuales
recorridas hasta ella. Una armada aporta `back_distance_m` + `fore_distance_m`.

**Los puntos `intermediate` aportan 0 y la cadena continúa.** Heredan el
acumulado de la armada de la que cuelgan, que es lo que
`applyProportionalCorrection` necesita para interpolarles la corrección.

Esto es exactamente lo que la cartera hace mal: allí la vista intermedia rompió
la cadena y se perdieron 24.7 m. **El caso tiene test propio** (ver Pruebas).

### La invariante que la fase establece

> El acumulado de la fila terminal es igual a `totalDistanceKm` **por
> construcción**, no por disciplina del usuario.

Eso convierte el contrato no verificado del JSDoc en una propiedad del modelo, y
hace que el punto final cierre exactamente contra su cota conocida.

`applyProportionalCorrection` **mantiene su firma pero cambia su garantía**: su
JSDoc hay que reescribirlo en el mismo commit, según la regla del cierre de la
Fase 4 sobre comentarios caducados.

## Validación

En `src/lib/validators/leveling.ts`.

| Regla | Criterio | Severidad |
|---|---|---|
| `level_type` definido | obligatorio antes de capturar | **error** |
| Orden de los hilos | `HS > HI` en la visual que los traiga | **error** |
| Distancia por visual presente | obligatoria en `bm` y `pc`; libre en `intermediate` | **error** |
| Hilo medio coherente | `abs(lectura − (HS+HI)/2) ≤ tolerancia` | aviso |
| Equilibrado de visuales | `abs(d_atrás − d_adelante) ≤ límite por orden` | aviso |

### Por qué tres bloquean y dos avisan

Los tres errores **no son juicios de calidad, son datos imposibles o ausentes**:

- **Hilos desordenados** (`HS ≤ HI`) dan una distancia negativa o nula, que
  envenena el acumulado, el total y con él la tolerancia.
- **Distancia ausente** en una fila que acumula deja el acumulado corto, el
  total menor del real y el punto de cierre mal compensado. Bloquear aquí es
  **continuidad**: el validador ya bloquea hoy el acumulado ausente en esas
  mismas filas (`validators/leveling.ts:69`), y esta regla es su traducción al
  modelo nuevo.
- **`level_type` sin definir** deja la tabla sin forma.

Los dos avisos sí son juicios sobre la calidad de una medición correcta en su
forma, y el precedente de la app es que esos avisan y no bloquean.

### Constantes

El límite del equilibrado por orden va a `src/lib/calculations/tolerances.ts`,
junto a `LEVELING_TOLERANCE_K`, nunca hardcodeado en componentes (`CLAUDE.md`).
La tolerancia del hilo medio, igual.

## Interfaz

La tabla de captura cambia de forma según `level_type`:

- **`automatico`** — lectura de mira y distancia por visual, editables, más las
  cuatro casillas de hilos **opcionales** (superior e inferior de cada visual).
  Con hilos, la distancia se autocompleta; teclear el hilo medio rellena la
  lectura **si está vacía**, sin sobrescribirla.
- **`digital`** — lectura de mira y distancia por visual, tecleadas. Sin hilos.
- **sin definir** — la tabla no se habilita; se pide el tipo de nivel primero,
  **sin preselección**.

Acumulado por fila y total del recorrido: **solo lectura** en los dos modos,
calculados en vivo.

En un proceso con `distances_reconstructed = true`, la tabla indica que las
distancias por visual son reconstruidas y no evalúa el equilibrado.

### Ancho de la tabla

En modo automático con hilos la libreta pasa de 7 a 13 columnas. Los hilos son
opcionales, así que deberían poder mostrarse y ocultarse en vez de ocupar sitio
siempre. **La forma exacta se decide mirando la pantalla, no razonándola** — el
precedente de la escala de grises del cierre de la Fase 6.

## Migración y backfill

Un solo archivo en `supabase/migrations/`, editado a mano (`CLAUDE.md`: no
autogenerar).

1. Añadir las seis columnas de `leveling_readings` y la de
   `leveling_processes`.
2. **Backfill.** Las diferencias sucesivas de `distance_accumulated_km` dan la
   distancia de cada armada, pero **el dato guardado no dice cómo se repartía
   entre las dos visuales** — eso nunca se capturó. Se reparte **por mitades** y
   se marca `distances_reconstructed = true`.
3. Recalcular `distance_accumulated_km` y `total_distance_km` desde lo derivado
   y **verificar que coinciden con los valores previos**.
4. Eliminar `distance_m`.

### Triggers a desactivar

El backfill hace `UPDATE` sobre filas que pueden pertenecer a procesos cerrados.
Los triggers son **dos**, verificados sobre
`20260812020455_leveling.sql:167-209`:

- `leveling_processes_reject_update_on_closed`
- `leveling_readings_reject_write_when_closed`

Se desactivan durante el backfill y se restauran después. **La Fase 8 encontró
dos triggers donde su encargo nombraba uno**, así que conviene `grep` antes de
dar la lista por cerrada.

### Antes de crear cualquier función

`grep` de su nombre en `supabase/migrations/`. La Fase 7 pisó en silencio una
función homónima con `create or replace` y dejó el trigger de nivelación
ejecutando el cuerpo de poligonal. Ningún test lo vio.

Tras la migración, regenerar tipos con el comando de `CLAUDE.md`.

## Pruebas mínimas

**Fixtures construidos a mano y verificados con código.** El marco teórico falló
como fixture en las Fases 3, 4 y 5; los datos reales de la cartera valen más
(Fase 7).

### Motor

- `stadiaDistance(1.500, 1.300)` → `20.000 m`.
- Armada de 30 m atrás y 30 m adelante → acumula `0.060 km`.
- **Vista intermedia intercalada**: no acumula, hereda el acumulado de su
  armada, **y la cadena continúa detrás de ella**. Es el fallo exacto de la
  cartera (24.7 m perdidos); el test lo reproduce sobre los datos de El Verjón.
- **El acumulado terminal es igual al total**, sobre el circuito del seed.
- **El BM final cierra exactamente contra su cota conocida** tras compensar. La
  prueba que el contrato del JSDoc nunca pudo hacer: cierre en `100.0000`, no en
  `99.992`.
- Armada **sin hilos, con las dos distancias tecleadas**: acumula y evalúa el
  equilibrado igual que una con hilos.
- Hilos tecleados **sobre una lectura ya escrita**: la lectura no se sobrescribe.
- Hilos tecleados **sobre una lectura vacía**: se rellena con el hilo medio.

### Cartera de El Verjón como fixture

Datos reales, verificados contra la hoja:

| Magnitud | Valor |
|---|---|
| Desnivel ida | `+26.583 m` |
| Desnivel vuelta | `−26.588 m` |
| Discrepancia | `−5.000 mm` |
| Distancia ida | `384.3 m` |
| Distancia vuelta | `397.6 m` (la hoja dice 372.9 — **incorrecto**) |
| Cota inicial `D1` | `3288.500` |
| Cota final `D4` | `3315.083` |

**El test de la vuelta debe dar 397.6 m, no 372.9.** Reproducir la hoja sería
reproducir su defecto — mismo criterio que la Fase 7 fijó para `TRANSITO` y
`CRANDALL`.

### Validadores

Hilos desordenados bloquean · distancia ausente bloquea en `bm`/`pc` y no en
`intermediate` · `level_type` nulo bloquea · hilo medio incoherente avisa ·
equilibrado fuera de límite avisa · proceso reconstruido no evalúa equilibrado.

### Backfill

- Sobre el circuito del seed: diferencias `300/300/300 m`, total `0.9 km`, y
  **el mismo veredicto de cierre que antes**.
- Con **un proceso cerrado**, construido a mano: el backfill pasa con los
  triggers desactivados. No hay datos así en el seed, así que el caso hay que
  fabricarlo — la Fase 8 tuvo que hacer exactamente esto.

### En pantalla, antes de cerrar

Levantar la app y capturar:

1. Tabla en modo `automatico`, con y sin hilos desplegados.
2. Tabla en modo `digital`.
3. Proceso con `level_type` sin definir.
4. Proceso con `distances_reconstructed = true`.
5. **Arranque en frío**: proyecto nuevo, proceso de nivelación recién creado.

La Fase 5 dejó anotado que verificar solo sobre datos sembrados oculta los
fallos del arranque en frío. Las Fases 7 y 8 dejaron dos bugs cada una que solo
aparecieron al mirar la pantalla.

## Criterios de aceptación

1. Las distancias por visual son la única entrada de la cadena; acumulado y
   total son de solo lectura y se recalculan en vivo.
2. Los tres hilos son opcionales; cuando se capturan, derivan la distancia y
   rellenan la lectura de mira si está vacía, sin sobrescribirla.
3. La lectura de mira es editable siempre, en los dos modos.
4. Se capturan dos distancias por armada en todos los casos.
5. Con `level_type` sin definir, la captura no se habilita.
6. **El acumulado de la fila terminal es igual al total por construcción**, y el
   punto de cierre cierra exactamente contra su cota conocida.
7. **Una vista intermedia no rompe la cadena de acumulado**, verificado contra
   el caso de El Verjón.
8. El equilibrado se valida y avisa en todas las armadas con las dos distancias,
   salvo en procesos reconstruidos.
9. Hilos desordenados y distancia ausente bloquean; hilo medio incoherente avisa.
10. El backfill deja los procesos existentes con las mismas cotas y el mismo
    veredicto, marcados como reconstruidos.
11. `scripts/seed.mjs` escribe las distancias por visual.
12. `distance_m` ya no existe en el schema ni en el código.
13. `npm run typecheck`, `npm run lint` y `npm test` pasan limpios.
14. Manual actualizado **en sus dos copias** (`docs/manual/README.md` y
    `src/app/(app)/manual/`) en el mismo commit, con capturas regeneradas por
    `node docs/manual/capturas.mjs`.
15. Doc técnica actualizada: estado de fases, tabla de pruebas, y **la deuda del
    equilibrado marcada como resuelta**.

## Verificación realizada (2026-09-22)

**Los cinco casos de pantalla**, con capturas revisadas una por una:

| Caso | Resultado |
|---|---|
| `automatico` sin hilos desplegados | Conmutador visible; lectura y distancia editables |
| `automatico` con hilos | Cuatro casillas de hilos; distancia autocompletada a 150 m; scroll horizontal |
| `digital` | Sin conmutador ni hilos; lectura y distancia tecleadas |
| `level_type` sin definir | La libreta no se habilita; «Elegir…» sin preselección; distancia total en `0.000`, no `NaN` |
| `distances_reconstructed = true` | Aviso ámbar; el equilibrado no se evalúa |

El cuarto caso es además el **arranque en frío** (proceso en borrador, sin
lecturas), que el cierre de la Fase 5 señaló como el que más se escapa.

**El backfill, sobre datos pre-Fase 9 auténticos.** No simulados: se revirtió
la base al esquema anterior, se sembró con el `seed.mjs` y el motor de
`8528bac` —que escriben `distance_m` y el acumulado tecleado— y se aplicó la
migración real.

| | Antes | Después |
|---|---|---|
| `total_distance_km` | `0.900` | `0.900` |
| `meets_tolerance` | `true` | `true` |
| `tolerance_mm` | `11.4` | `11.4` |
| Cotas corregidas | `100.0000 / 100.3027 / 99.8053 / 100.0000` | idénticas |
| Acumulado | `0.000 / 0.300 / 0.600 / 0.900` | idéntico |

El criterio de aceptación 10 se cumple. Uno de los dos procesos estaba
**cerrado** y la migración pasó sobre él sin abortar: los triggers de
inmutabilidad se desactivan y se restauran correctamente.

La primera fila queda con la distancia en `null` —el dato nunca se registró— y
el editor la marca en rojo pidiéndola, que es lo previsto. Las cotas y el
veredicto no cambian porque esos metros nunca estuvieron en el acumulado.

## Fuera de alcance

- **Importación por CSV** (N4). Fase propia, bloqueada hasta tener una cartera
  real que fije el formato.
- **Control ida-vuelta por puntos homólogos** (N6). La cartera demuestra que los
  puntos de cambio sí se reocupan, contra el supuesto de la Fase 4, pero eso es
  otro tema y toca otra parte del motor.
- **Nivelación en el generador de proyecto demo** (N5).
- **Renombrar `V+` / `V-`** (N1). Es la Fase 10, después de esta a propósito:
  esta fase reescribe la tabla entera, y renombrar antes sería renombrar sobre
  texto que se sustituye.

## Riesgos

- **La tabla de 13 columnas puede no caber.** Mitigación: mirarla, no razonarla.
- **El backfill toca datos cerrados.** Mitigación: fixture de proceso cerrado
  construido a mano, como en la Fase 8.
- **Auditar todos los consumidores del acumulado y del total**, no solo el
  editor: export, informe, panel de resultados y seed. El cierre de la Fase 8
  dejó la regla de que cambiar la naturaleza de un valor obliga a revisar a cada
  consumidor **uno por uno**, y dos de sus tres editores tenían el bug.
- **El seed escribe hoy la forma inversa** (`distanceAccumKm` con `distanceM`
  nulo, `seed.mjs:802-817`). Si no se corrige, el siguiente `db reset` deshace
  lo que el backfill arregló.
