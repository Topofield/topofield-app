# Fase 9 — Cadena de distancias de nivelación (N2 + N3)

Diseño acordado en la sesión de brainstorming del 2026-09-22. Recoge las
peticiones **N2** (taquimetría por los tres hilos) y **N3** (sumatoria
automática de distancias) de [`docs/pendientes.md`](../../pendientes.md).

Este documento es el diseño; el PRD-de-fase (`docs/prds/08-cadena-distancias-nivelacion.md`)
y el plan de implementación se derivan de él.

## Por qué las dos peticiones son una sola fase

N2 y N3 son los dos extremos de la misma cadena de datos:

```
tres hilos (N2) → distancia del tramo → acumulado (N3) → total (N3) → tolerancia K·√D
```

Separarlas obligaría a construir en una fase la columna de distancia por tramo
que la otra reescribiría entera, y a tocar dos veces la tabla de captura, el
export, el informe y las dos copias del manual. Van juntas.

## El problema real de N3

`docs/pendientes.md` describe N3 como «la suma no se genera sola». El código
dice algo más grave: hoy existen **tres campos de distancia independientes,
todos tecleados a mano, sin ninguna relación verificada entre ellos**.

| Campo | Dónde se teclea | Quién lo lee |
|---|---|---|
| `distance_m` por fila | `readings-table.tsx:199` | **nadie** |
| `distance_accumulated_km` por fila | `readings-table.tsx:213` | la compensación |
| `total_distance_km` del proceso | `leveling-editor.tsx:345` | la tolerancia K·√D |

De ahí salen tres fallos silenciosos que hoy no detecta nada:

1. **El acumulado no tiene por qué ser la suma de los parciales.** Parciales
   30/30/40 con un acumulado de 0.120 km pasan en verde y la compensación se
   reparte mal.
2. **El acumulado final no tiene por qué ser igual a `total_distance_km`.** El
   propio JSDoc de `applyProportionalCorrection` documenta este contrato como
   **no verificado**: si la fila terminal llega con un acumulado distinto del
   total, el punto final **no cierra exactamente contra su cota conocida** y el
   resultado queda mal corregido sin que nada avise. El validador solo exige
   que el acumulado no sea nulo, no que valga lo correcto.
3. **`total_distance_km` gobierna si el trabajo cumple.** Un número tecleado a
   mano decide la tolerancia `K·√D`. Es el mismo patrón de «indicador
   tranquilizador» que la Fase 7 destapó en poligonales.

`distance_m` es además un campo capturado que nadie lee — exactamente lo que el
cierre de la Fase 7 dejó anotado como pregunta sin responder.

**La fase invierte la dirección del dato**: la distancia por tramo pasa a ser la
única entrada, y acumulado y total se derivan. Los tres fallos dejan de ser
representables porque los estados incoherentes dejan de existir.

## Decisiones tomadas

| # | Decisión | Razón |
|---|---|---|
| 1 | N2 y N3 en una sola fase | Misma cadena de datos; separarlas tira trabajo |
| 2 | **Derivación estricta del acumulado y el total**: pasan a solo lectura, siempre calculados desde las distancias por visual. Sin override manual | Los tres fallos silenciosos dejan de ser representables |
| 2b | La **distancia por visual** sí es editable, y se autocompleta desde los hilos cuando los hay | Taquimetría y cinta son dos formas legítimas de medir lo mismo. No debilita la 2: el acumulado y el total siguen derivándose de lo que haya |
| 2c | Los **tres hilos son opcionales**; la lectura de mira es siempre editable | Con nivel automático se puede anotar solo la lectura y medir a cinta. Obligar a los hilos pediría tres números donde la cartera trae uno |
| 3 | **Backfill por diferencias sucesivas** del acumulado existente, repartido por mitades y marcado como reconstruido | Verificado sobre el fixture del seed: 0.0/0.3/0.6/0.9 → 300/300/300 m por armada. El reparto atrás/adelante no está en los datos, así que no puede alimentar el equilibrado |
| 4 | Se **paga la deuda del equilibrado de visuales** | La fase produce el dato que faltaba; capturarlo sin leerlo repetiría el error de `distance_m` |
| 5 | `level_type` sin definir **exige elegirlo** antes de capturar | Precedente de `angle_type` en la Fase 7: no preseleccionar, porque adivinar reintroduce el fallo silencioso |
| 6 | Se corrige `scripts/seed.mjs` dentro de la fase | Sin eso el backfill limpia el pasado y el seed lo vuelve a ensuciar al siguiente `db reset` |
| 7 | La importación por CSV va a **fase propia**, bloqueada hasta tener una cartera real | Flujo distinto que no comparte código con la cadena; y el formato hay que verlo, no suponerlo |

### Sobre la decisión 6

Es consecuencia obligada de la 3, no alcance añadido. `scripts/seed.mjs:763-778`
escribe hoy `distanceAccumKm` con `distanceM` nulo — la forma inversa a la que
el modelo nuevo exige. El aprendizaje del cierre de la Fase 6 («cuando se
corrige un fallo en un generador de datos, hay que buscar de inmediato sus
gemelos») aplica literalmente.

## Fuera de alcance

- **Añadir nivelación a `src/lib/demo/crear-proyecto-demo.ts`**, que hoy no crea
  ninguna. Es alcance nuevo y una decisión de producto separada; se anota en
  `docs/pendientes.md`.
- **Importación de lecturas por CSV** en modo `digital`. Petición nueva recogida
  el 2026-09-22, va a **fase propia**: es un flujo distinto —subida, parseo,
  previsualización, errores por fila— que no comparte código con la cadena de
  distancias, y meterlo aquí arriesga que la parte de importación arrastre el
  cierre de la parte de motor. **Bloqueada a la espera de una cartera de
  nivelación real** que fije el formato; el precedente de la Fase 7 es que dos
  carteras de campo encontraron en una tarde lo que cuatro fases de fixtures
  sintéticos no vieron. Se anota en `docs/pendientes.md` como N4.

## Modelo de datos

### Qué cambia

La distancia deja de ser **una por fila** y pasa a ser **una por visual**: una
para la mira de atrás y otra para la de adelante. Es lo que exige el equilibrado
(decisión 4) y lo que el modo de tres hilos produce de forma natural.

Columnas nuevas en `leveling_readings`:

| Columna | Tipo | Para qué |
|---|---|---|
| `back_upper_m` / `back_middle_m` / `back_lower_m` | `decimal(6,3)` | Tres hilos de la visual atrás (modo `automatico`) |
| `fore_upper_m` / `fore_middle_m` / `fore_lower_m` | `decimal(6,3)` | Tres hilos de la visual adelante (modo `automatico`) |
| `back_distance_m` / `fore_distance_m` | `decimal(8,3)` | Distancia por visual: derivada de los hilos, o tecleada en modo `digital` |

Y una en `leveling_processes`:

| Columna | Tipo | Para qué |
|---|---|---|
| `distances_reconstructed` | `boolean not null default false` | Marca los procesos cuyas distancias por visual las inventó el backfill repartiendo por mitades. Sobre ellos el equilibrado no se evalúa |

`distance_accumulated_km` **se conserva como columna persistida pero pasa a ser
derivada**: la escribe el servidor al recalcular, no el usuario. Se mantiene en
la tabla porque el informe y el export la leen sin recalcular, y porque el
cierre de la Fase 6 dejó la regla de que todo lo que se persiste debe tener un
consumidor que lo lea tal cual.

`leveling_processes.total_distance_km` **se conserva igual y con el mismo
criterio**: derivada, persistida, de solo lectura en la UI.

`distance_m` **se elimina**. No la lee nadie y su sustituto son las dos
distancias por visual. La migración la borra después del backfill.

### Los hilos son opcionales; la lectura de mira nunca lo es

Corregido tras la revisión del 2026-09-22 con el usuario. Una versión anterior
de esta spec hacía obligatorios los tres hilos en modo `automatico` y ponía la
lectura de mira en solo lectura, derivada del hilo medio. **Es demasiado
rígido**: con nivel automático el topógrafo puede anotar solo la lectura y medir
la distancia a cinta, y la spec le habría exigido teclear tres números donde
su cartera trae uno.

La forma correcta:

- **`backsight` / `foresight` son siempre el campo principal y siempre
  editables**, en los dos modos. El motor de cotas no se entera de nada: sigue
  consumiendo exactamente los mismos dos campos que hoy.
- **Los tres hilos son un añadido opcional.** Cuando están, dos cosas: derivan
  la distancia de esa visual, y habilitan la comprobación `m = (HS+HI)/2`.
- **Teclear el hilo medio rellena la lectura de mira** si está vacía, porque son
  el mismo número. No la sobrescribe si ya tiene valor: la lectura es el dato,
  el hilo medio es una forma de obtenerlo.

### La distancia: derivada u opcionalmente tecleada

La celda de distancia **acepta escritura directa y se autocompleta desde los
hilos** cuando los hay. No es de solo lectura.

Esto **no debilita la derivación estricta** de la decisión 2. Lo estricto es que
el **acumulado y el total** se derivan de las distancias por tramo, y eso se
mantiene intacto: son los que alimentan la compensación y la tolerancia `K·√D`,
y son los tres fallos silenciosos que la fase cierra. Lo que queda a elección
del usuario es un escalón más abajo — de dónde sale la distancia de una visual —
donde taquimetría y cinta son dos formas legítimas de medir lo mismo.

### Siempre dos distancias por armada

Aunque se teclee a mano, se capturan **dos** distancias: a la mira de atrás y a
la de adelante. No una sola «distancia al cambio».

Es lo que permite validar el equilibrado **en todos los casos**, con hilos o sin
ellos. La alternativa —una distancia por tramo— dejaría el equilibrado evaluable
solo en las armadas con hilos, y un control que aparece siempre pero que en
media tabla no significa nada es el mismo defecto que obligó a marcar los
procesos del backfill como reconstruidos.

## Motor de cálculo

Funciones nuevas en `src/lib/calculations/leveling.ts` — puras, sin React ni
Supabase, según la regla de `CLAUDE.md`:

```ts
/** D = (HS − HI)·K, con K = 100. La visual de un nivel es horizontal por
 *  construcción: no lleva la corrección por cos²α de un teodolito inclinado. */
export function stadiaDistance(upper: number, lower: number, k = 100): number

/** Acumulado por fila a partir de las distancias por visual de cada armada. */
export function accumulateDistances(readings: ReadingInput[]): number[]

/** Total del recorrido: el acumulado de la última fila que propaga cota. */
export function totalDistanceFromReadings(readings: ReadingInput[]): number
```

### Cómo acumula

El acumulado de una fila es la suma de las distancias de todas las visuales
recorridas hasta llegar a ella. Una armada aporta `back_distance_m` (a la mira
de atrás) más `fore_distance_m` (a la de adelante).

Los puntos `intermediate` **no acumulan**: cuelgan de la AI vigente, no propagan
cota y ya están fuera de la comprobación aritmética y de la compensación. Su
acumulado es el de la armada de la que cuelgan — que es justo lo que
`applyProportionalCorrection` necesita para interpolarles la corrección.

**Invariante que la fase establece**: el acumulado de la fila terminal es igual
a `totalDistanceKm` por construcción, no por disciplina del usuario. Eso
convierte el contrato no verificado del JSDoc en una propiedad del modelo, y el
punto final cierra exactamente contra su cota conocida.

## Validación

Reglas nuevas en `src/lib/validators/leveling.ts`. Todas **avisan, no
bloquean**, salvo donde se indique — precedente de la app.

| Regla | Criterio | Severidad |
|---|---|---|
| Distancia por visual presente | obligatoria en `bm` y `pc`; libre en `intermediate` | error (bloquea) |
| Hilo medio coherente | `\|m − (HS+HI)/2\| ≤ tolerancia de lectura` | aviso |
| Orden de los hilos | `HS > m > HI` | error |
| Equilibrado de visuales | `\|d_atrás − d_adelante\| ≤ límite por orden` | aviso |
| `level_type` definido | obligatorio antes de capturar | error (bloquea) |

El **error de orden de los hilos bloquea** porque un HS y un HI intercambiados
dan una distancia negativa, que envenena el acumulado, el total y con él la
tolerancia. No es un aviso: es un dato imposible.

La **distancia ausente también bloquea**, en las mismas filas en las que hoy es
obligatorio el acumulado (`bm` y `pc`). Al volverse editable la distancia, puede
quedar vacía —antes no podía, porque salía de unos hilos obligatorios— y una
armada sin distancias deja el acumulado corto, el total menor del real y el
punto de cierre mal compensado. Es exactamente el fallo del JSDoc entrando por
otra puerta. Bloquear es además **continuidad**, no un endurecimiento: el
validador ya bloquea hoy el acumulado ausente en esas mismas filas
(`validators/leveling.ts:69`), y esta regla es su traducción al modelo nuevo.

Conviene notar que este fallo se inclina hacia el lado seguro —un total menor da
una tolerancia `K·√D` más estricta, que rechaza trabajo bueno en vez de aprobar
trabajo malo—, pero la compensación del punto de cierre sí queda mal repartida,
y eso no lo salva ningún margen.

El límite del equilibrado por orden de precisión va a
`src/lib/calculations/tolerances.ts` como constante, junto a
`LEVELING_TOLERANCE_K`, nunca hardcodeado en componentes.

### Comentario a corregir

`src/lib/validators/leveling.ts:33-38` afirma hoy que el equilibrado «exigiría
capturar ambas distancias por armada — un cambio de modelo de datos que no entra
en esta fase». Esa afirmación deja de ser cierta con esta fase. Se reescribe en
el mismo commit que introduce la validación, según la regla del cierre de la
Fase 4 sobre comentarios caducados.

## Interfaz

La tabla de captura cambia de forma según `level_type`:

- **`automatico`** — lectura de mira y distancia por cada visual, editables, más
  las seis casillas de hilos **opcionales** (tres atrás, tres adelante). Con
  hilos, la distancia se autocompleta y la lectura se rellena desde el hilo
  medio si está vacía.
- **`digital`** — lectura de mira y distancia por visual, tecleadas. Sin hilos:
  el instrumento ya entrega ambas. (La importación por CSV **no entra en esta
  fase**, ver «Fuera de alcance».)
- **sin definir** — la tabla no se habilita: se pide elegir el tipo de nivel
  primero, sin preselección.

Acumulado por fila y total del recorrido pasan a **solo lectura** en los dos
modos, mostrados como valores calculados en vivo.

**Ancho de la tabla**: en modo automático con hilos desplegados la libreta pasa
de 7 a 13 columnas. Los hilos son opcionales, así que conviene que se
muestren/oculten en vez de ocupar sitio siempre — decidir la forma exacta al
implementar, mirándola en pantalla.
Hay que mirarla en pantalla antes de cerrar la fase — es exactamente el tipo de
problema que solo aparece al levantar la app, y las Fases 7 y 8 dejaron dos
bugs cada una que ninguna otra cosa encontró.

## Migración y backfill

Un solo archivo en `supabase/migrations/`, editado a mano (nunca autogenerado).

1. Añadir las ocho columnas nuevas.
2. **Backfill**: las diferencias sucesivas de `distance_accumulated_km` dan la
   distancia de cada armada, pero **el dato guardado no dice cómo se repartía
   entre la visual de atrás y la de adelante** — esa información nunca se
   capturó. El backfill reparte la diferencia **por mitades** y marca el
   proceso como migrado, porque un reparto inventado no puede alimentar la
   validación del equilibrado: sobre un proceso migrado el equilibrado saldría
   siempre perfecto, que es un aviso falso de conformidad.

   **Consecuencia explícita**: en procesos migrados el equilibrado **no se
   evalúa** y se indica en pantalla que la distancia por visual es reconstruida.
   Lo que sí se conserva exactamente es el acumulado, el total y por tanto el
   veredicto de cierre, que es lo que no puede cambiar.
3. Recalcular `distance_accumulated_km` y `total_distance_km` desde lo
   derivado, y verificar que coinciden con los valores previos.
4. Eliminar `distance_m`.

**Triggers de inmutabilidad**: el backfill hace `UPDATE` sobre filas que pueden
pertenecer a procesos cerrados. Hay que desactivarlos durante la migración y
restaurarlos después, como hizo la Fase 8 — y comprobar cuáles son con un
`grep` sobre `supabase/migrations/`, porque la Fase 8 encontró **dos** triggers
donde el encargo nombraba uno.

**Antes de crear cualquier función en la migración**: `grep` de su nombre en
`supabase/migrations/`. La Fase 7 pisó en silencio una función homónima de otro
módulo con `create or replace` y dejó el trigger de nivelación ejecutando el
cuerpo de poligonal.

Tras la migración, regenerar tipos con el comando de `CLAUDE.md`.

## Pruebas mínimas

**Motor (Vitest, fixtures construidos a mano y verificados con código** — el
marco teórico falló como fixture tres veces, Fases 3, 4 y 5):

- `stadiaDistance`: HS 1.500 / HI 1.300 → 20.000 m.
- Acumulado: una armada de 30 m atrás y 30 m adelante acumula 0.060 km.
- Acumulado con `intermediate` intercalado: la radiación no acumula y hereda el
  acumulado de su armada.
- **El acumulado terminal es igual al total**, sobre el circuito del seed.
- **El BM final cierra exactamente contra su cota conocida** tras compensar —
  la prueba que el contrato del JSDoc nunca pudo hacer. Sobre el fixture del
  seed: cierre en 100.0000, no en 99.992.
- `stadiaDistance` con HS < HI: la validación lo rechaza antes de llegar al
  motor.
- **Armada sin hilos, con las dos distancias tecleadas**: acumula y evalúa el
  equilibrado igual que una con hilos.
- **Hilos tecleados sobre una lectura ya escrita**: la lectura NO se sobrescribe.
- **Hilos tecleados sobre una lectura vacía**: la lectura se rellena con el hilo
  medio.

**Validadores**: hilo medio fuera de tolerancia avisa; hilos desordenados
bloquean; equilibrado fuera de límite avisa; `level_type` nulo bloquea;
distancia ausente en `bm`/`pc` bloquea, y en `intermediate` no.

**Backfill**: sobre el circuito del seed, las diferencias sucesivas dan
300/300/300 m por armada y el total recalculado sigue siendo 0.9 km, con el
mismo veredicto de cierre que antes. Un proceso migrado no evalúa el
equilibrado. Y, construido a mano
porque el seed no lo trae, el caso de **un proceso cerrado** y el de un **lugar
cerrado**, para comprobar que los triggers desactivados dejan pasar el backfill
— la Fase 8 tuvo que construir justo esos dos fixtures.

**En pantalla, antes de cerrar**: levantar la app y capturar los tres modos de
la tabla (`automatico`, `digital`, sin definir), más el arranque en frío de un
proceso recién creado. La Fase 5 dejó anotado que verificar solo sobre datos
sembrados oculta los fallos del arranque en frío.

## Criterios de aceptación

1. Las distancias por visual son la única entrada de la cadena; acumulado y
   total son de solo lectura y se recalculan en vivo.
2. Los tres hilos son opcionales. Cuando se capturan, derivan la distancia de su
   visual y rellenan la lectura de mira si está vacía, sin sobrescribirla.
3. La lectura de mira es editable siempre, en los dos modos.
3b. Se capturan dos distancias por armada (atrás y adelante) en todos los casos,
   vengan de hilos o tecleadas.
4. Con `level_type` sin definir, la captura no se habilita.
5. El acumulado de la fila terminal es igual al total **por construcción**, y el
   punto de cierre cierra exactamente contra su cota conocida.
6. El equilibrado de visuales se valida y avisa en **todas** las armadas con las
   dos distancias presentes, con hilos o sin ellos; su límite vive en
   `tolerances.ts`.
7. El hilo medio incoherente avisa; los hilos desordenados bloquean; la
   distancia ausente bloquea en `bm` y `pc`, y no en `intermediate`.
8. El backfill deja los procesos existentes con las mismas cotas y el mismo
   veredicto de cierre que antes de la migración, y los marca como
   reconstruidos para que no se evalúe su equilibrado.
9. `scripts/seed.mjs` escribe la distancia por visual.
10. `distance_m` ya no existe en el schema ni en el código.
11. `npm run typecheck`, `npm run lint` y `npm test` pasan limpios.
12. Manual actualizado **en sus dos copias** (`docs/manual/README.md` y
    `src/app/(app)/manual/`) en el mismo commit, con capturas regeneradas por
    `node docs/manual/capturas.mjs`.
13. Doc técnica actualizada: estado de fases, tabla de pruebas, y la deuda del
    equilibrado marcada como resuelta.

## Riesgos

- **La tabla de 11 columnas puede no caber.** Mitigación: mirarla en pantalla,
  no razonarla. El precedente de la escala de grises del cierre de la Fase 6 —
  quitar el canal en vez de discutirlo — aplica igual aquí.
- **El backfill toca datos cerrados.** Mitigación: fixtures de proceso cerrado y
  de lugar cerrado construidos a mano, como en la Fase 8.
- **`applyProportionalCorrection` mantiene su firma pero cambia su garantía.**
  Su JSDoc documenta un contrato no verificado que esta fase convierte en
  invariante. Hay que reescribirlo en el mismo commit.
- **Auditar todos los consumidores del acumulado y del total**, no solo el
  editor: export, informe, panel de resultados y seed. El cierre de la Fase 8
  dejó la regla de que hacer editable —o aquí, derivado— un valor que antes se
  tecleaba obliga a revisar a cada consumidor uno por uno.
