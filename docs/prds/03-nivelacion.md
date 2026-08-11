# PRD-de-fase 4 — Módulo Nivelación

**Estado:** en curso
**Fecha de apertura:** 2026-08-11

## Propósito

Construir el segundo módulo de proceso topográfico: el editor de nivelación
geométrica. Al cerrar esta fase, un usuario debe poder, desde el hub de un
proyecto, crear un proceso de nivelación de cualquiera de los tres tipos
(cerrada, de enlace, abierta sin control), capturar su libreta de campo con
cálculo en vivo de altura de instrumento y cotas, ver la comprobación
aritmética y el error de cierre contra la tolerancia de su orden, aplicar la
corrección proporcional a la distancia y cerrar el proceso con trazabilidad.

La fase reutiliza los cimientos de la Fase 3 — funciones puras en
`src/lib/calculations/` con pruebas Vitest, y el mecanismo de cierre de procesos
(`§4.6`) — sin rediseñarlos.

## Fuentes

- `PRD-TopoField.md` — `§3.2` (tablas), `§4.4` (editor), `§4.6` (cierre), `§5`
  (validación, `§5.4` tolerancias), `§6.7`-`§6.9` (algoritmos).
- `docs/marco-teorico/mt-nivelaciones_precision.docx` — marco teórico con 4 casos
  de estudio, métodos de corrección y tabla de tolerancias por orden.
- Investigación de práctica estándar (2026-08-11), contrastada contra:
  [IGAC P30100-06/17.V2](https://www.igac.gov.co/sites/default/files/listadomaestro/p30100-06-17.v2_nivelacion_geodesica_con_instrumentos_digitales_0.pdf)
  (nivelación geodésica con instrumentos digitales),
  [FGCS/NGS 1984](https://www.ngs.noaa.gov/FGCS/tech_pub/1984-stds-specs-geodetic-control-networks.pdf)
  (standards and specifications) y
  [NOAA Manual NOS NGS 3](https://www.ngs.noaa.gov/PUBS_LIB/GeodeticLeveling_Manual_NOS_NGS_3.pdf)
  (geodetic leveling). Ver «Hallazgos de la investigación».

## Hallazgos de la investigación

Tres hallazgos obligaron a corregir supuestos del PRD principal **antes** de
implementar. Se documentan aquí porque explican decisiones que de otro modo
parecerían arbitrarias.

### 1. El marco teórico de nivelación no es aritméticamente consistente

Se verificaron con código las tablas del Caso 1 (nivelación cerrada) contra las
tres hipótesis posibles de alineación de filas. **Ninguna se cumple en todas las
filas**: las filas PC-3, PC-4, PC-6 y BM-1' siguen la convención correcta
(`AI_anterior − L.Ad_i = cota_i`), pero PC-1, PC-2 y PC-5 no siguen ninguna —
la cota de PC-5 difiere en exactamente 2.000 m de cualquier combinación válida.

Es el mismo problema ya registrado en el cierre de la Fase 3 para el marco
teórico de poligonales. **Consecuencia:** los números del documento sirven de
guía del método, nunca de fixture de test. Los fixtures se construyen con
entradas limpias y resultados verificados a mano.

### 2. La regla de la libreta, con precisión

Dentro de una misma armada (puesta de instrumento) hay **una sola AI**: el nivel
lee atrás y adelante sin moverse. Lo que induce a error del layout de libreta es
que las dos lecturas impresas en la fila de un punto pertenecen a **armadas
distintas**: la L.Ad se disparó desde la armada anterior (y determina la cota de
ese punto), mientras que la L.At se dispara desde la armada siguiente, ya con el
instrumento trasladado. El punto de cambio es la bisagra entre ambas.

La regla operativa, verificada contra un ejemplo consistente:

```
para cada fila i, en orden:
  si tiene L.Ad:  cota_i = AI_vigente − L.Ad_i     (consume la AI anterior)
  si tiene L.At:  AI_vigente = cota_i + L.At_i     (genera la AI nueva)
```

El orden **consumir → generar** dentro de la fila es obligatorio. La AI se
imprime en la fila que porta la L.At y gobierna las filas siguientes hasta la
próxima L.At.

### 3. La vuelta es una medición independiente, no un espejo de la ida

El `§6.9` del PRD principal define el promediado de ida y vuelta **por tramo
entre puntos consecutivos**. Eso presupone que ambos recorridos comparten los
puntos de cambio, lo cual **no corresponde a la práctica de campo**:

- Los puntos de cambio son provisionales e instrumentales; su cota no interesa
  en sí misma y no hay razón para reocuparlos al regresar.
- El fundamento estadístico del doble recorrido exige independencia. Si la
  vuelta reusara los mismos PC, un PC mal asentado introduciría el mismo error
  con el mismo signo en ambos recorridos y **el promedio lo conservaría intacto
  en vez de revelarlo**. La independencia es justamente lo que hace que el error
  aflore como discrepancia (NOAA Manual NOS NGS 3).
- En la práctica ni siquiera coincide el número de armadas por recorrido.

**Consecuencia:** el emparejamiento ida/vuelta ocurre a nivel de **sección**
(entre los BM extremos), no de tramo. Esto **enmienda el `§6.9`** del PRD
principal, que se corrige en el mismo commit de apertura de esta fase.

## Alcance

### Dentro

- Migración SQL: `leveling_processes` y `leveling_readings` (`§3.2`), RLS por
  join con `projects`, trigger `set_updated_at` y trigger de inmutabilidad
  (reutiliza `public.reject_update_on_closed_process()`, ya genérica).
- Tabla de tolerancias de nivelación en `src/lib/calculations/tolerances.ts`.
- `src/lib/calculations/leveling.ts` (cálculo base, comprobación aritmética,
  cierre, corrección proporcional, ida y vuelta) + tests Vitest.
- `src/lib/validators/leveling.ts` (capas de captura y cierre).
- Tipos de dominio `src/types/leveling.ts`.
- Capa de datos: queries de lectura y Server Actions (crear, guardar, cerrar).
- Ruta `/projects/[id]/leveling/new` — formulario de creación.
- Editor `/projects/[id]/leveling/[pid]` — configuración, libreta con cálculo en
  vivo, tabs Ida/Vuelta, panel de resultados y cierre.
- Integración con el hub: activar «Nivelación» en `new-process-selector` y
  listar procesos de nivelación en la tab Procesos.

### Fuera (diferido)

- **Redes de nivelación** (Caso 4 del marco teórico) → requiere ajuste por
  mínimos cuadrados, fuera de alcance del producto (CLAUDE.md). Necesitaría
  además un modelo de datos de grafo con múltiples circuitos y nudos.
- **Métodos de corrección alternativos** (proporcional al número de estaciones,
  proporcional a los desniveles) → decisión #3.
- **Órdenes «Segundo Orden Clase I» (K=4) y «Nivelación Expedita» (K=50)** del
  marco teórico → decisión #4.
- Nivelación trigonométrica y barométrica → el producto cubre solo geométrica.
- Módulo de asentamientos e informes → Fases 5-6.
- Exportación a Excel → Fase 6 (`§9`).
- Auto-save cada 30s → guardado explícito, igual que Fase 3 (decisión #2 de
  aquella fase).

## Decisiones cerradas

| # | Decisión | Razón |
|---|---|---|
| 1 | Se implementan los **3 tipos** modelados: `closed`, `link`, `open`. | Coinciden con el CHECK del `§3.2`. El 4º caso del marco teórico (redes) exige mínimos cuadrados, fuera de alcance. |
| 2 | **Ida y vuelta sí**, emparejado a nivel de **sección** (BM a BM), no por tramo. | El caso principal del marco teórico se ejecuta ida y vuelta. Los PC de ambos recorridos son independientes (ver hallazgo 3). **Enmienda el `§6.9`.** |
| 3 | Solo **corrección proporcional a la distancia**. | El marco teórico `§9` la declara «el método estándar y suficiente» para tercer orden y ordinario, y `§6.1` la limita a circuitos simples — que es todo el alcance de esta fase. Los otros dos métodos los acota el propio documento a casos marginales. |
| 4 | **Cuatro órdenes** de precisión (K = 3/6/12/24 mm). | Los cuatro K coinciden exactamente con el marco teórico `§8`; `segundo_orden` es su «Clase II». Los otros dos niveles del documento no tienen lugar en `projects.precision_order`. Mismo criterio que la decisión #5 de la Fase 3. |
| 5 | BM de partida/llegada por **selector desde `reference_points`** (`type='bm'`) **con fallback a entrada libre**. | La tabla ya tiene `elevation` y el tipo `bm`: el encaje es exacto, y da por fin un consumidor al catálogo de la Fase 2. Una cota de partida errónea desplaza todas las cotas por igual y **cierra perfecto**, así que el error es invisible al control de cierre. Diverge de la decisión #6 de Fase 3 porque allí el encaje era parcial. |
| 6 | Libreta con **una fila por punto** (no por armada). | Es lo que fijan el `§3.2` (`leveling_readings` tiene ambas lecturas por fila), el marco teórico y la práctica de campo. El objetivo del producto es digitalizar una libreta que el topógrafo ya conoce. |
| 7 | Columna nueva **`point_type`** (`bm` / `pc` / `intermediate`). | Los puntos intermedios (radiaciones) solo reciben L.Ad, cuelgan de la AI vigente, no propagan cota y **quedan fuera de la comprobación aritmética y de la compensación**. Sin distinguirlos el motor de cálculo es incorrecto. El `§3.2` no los modela. |
| 8 | Columna nueva **`distance_m`** por visual (atrás/adelante), además de la acumulada. | Guardar solo la distancia acumulada impide validar el equilibrado de visuales, que es lo que cancela curvatura, refracción y colimación. Añadirla después obligaría a migrar datos de producción. |
| 9 | La **D de la tolerancia** `K·√D` es la distancia **en un solo sentido**, no ida+vuelta. | Contradicción real entre fuentes: FGCS distingue `D` (longitud de sección en un sentido) de `F` (perímetro de circuito); IGAC usa la distancia nivelada de la sección. Usar el recorrido total inflaría la tolerancia en √2 (≈41 %). Se fija como constante documentada. |
| 10 | La **AI se persiste** como columna calculada. | Coherente con la decisión #11 de la Fase 3: los informes de la Fase 6 leen sin recalcular. |
| 11 | El editor es **client component** con cálculo en vivo; el servidor **recalcula** al guardar. | Patrón heredado de la Fase 3: una sola fuente de verdad para lo persistido. |
| 12 | Sin componentes nuevos del design system. | `StatusIndicator` se reutiliza; no hay ángulos, así que `DmsInput` no aplica. |

## Modelo de datos

Migración nueva `<timestamp>_leveling.sql` con `leveling_processes` y
`leveling_readings` del `§3.2`, más los ajustes de las decisiones #7, #8 y #3:

```sql
-- en leveling_readings
point_type TEXT NOT NULL DEFAULT 'pc'
  CHECK (point_type IN ('bm', 'pc', 'intermediate')),
distance_m DECIMAL(8,1),          -- distancia de la visual (equilibrado)

-- en leveling_processes
correction_method TEXT NOT NULL DEFAULT 'proportional_distance'
  CHECK (correction_method IN ('proportional_distance')),
```

Las columnas `forward_error_mm`, `return_error_mm` y `discrepancy_mm` se
conservan del `§3.2`, pero por la decisión #2 significan error **de sección por
recorrido**, no error apareado por tramo.

El `DEFAULT 'pc'` de `point_type` es deliberado (el punto de cambio es el caso
mayoritario), pero **el editor asigna siempre el tipo explícitamente**: la
primera fila de un recorrido es `bm`, y la última de un recorrido `closed` o
`link` también. Confiar en el default para esas filas produciría una
comprobación aritmética silenciosamente incorrecta, porque el `bm` inicial
aporta su L.At a la suma sin ser un punto de cambio.

Estados de `status` (`§3.2`): `draft` → `in_progress` → `calculated` → `closed`
| `rejected`. Un proceso `closed`/`rejected` es **inmutable**, garantizado tanto
en los Server Actions como por trigger en la base (migración
`20260727180000_immutable_closed_processes.sql`).

**Nota de producción:** la app está desplegada con datos reales desde el
2026-08-11. El recurso de la Fase 1 — editar la migración en sitio y hacer
`db reset` — ya no está disponible: cualquier corrección posterior exige una
migración nueva con `ALTER TABLE`. Es la razón de incorporar `point_type` y
`distance_m` ahora y no cuando hagan falta.

Tras aplicar la migración se regeneran los tipos (`database.ts`).

## Algoritmos (`src/lib/calculations/leveling.ts`)

Funciones puras de TypeScript — sin React, sin Supabase.

### Tolerancias (en `tolerances.ts`)

```
LEVELING_TOLERANCE_K = { primer_orden: 3, segundo_orden: 6,
                         tercer_orden: 12, ordinario: 24 }   // mm
levelingTolerance(order, D_km) = K · √D_km                   // decisión #9: D en un sentido
```

### Cálculo base (`§6.7`)

Recorre las filas en orden aplicando la regla del hallazgo 2 (consumir → generar).
Los `intermediate` consumen la AI vigente y **no la actualizan**.

### Comprobación aritmética (`§6.7`)

`ΣL.At − ΣL.Ad = cota_final − cota_inicial`, sumando **solo `bm` y `pc`**. Los
intermedios se excluyen. Si no cuadra es error de gabinete → banner rojo crítico
(`§5.2`). Valida la aritmética, no la calidad de la medición: cuadra igual con
el nivel descolimado.

### Cierre y tolerancia (`§6.8`)

`Error = cota_calculada − cota_conocida` (mm), comparado con `K·√D`.
`closed` cierra contra el BM de partida; `link` contra el BM de llegada; `open`
**no tiene cierre** — se calcula y no se corrige.

### Corrección proporcional a la distancia (`§6.8`)

```
Corr_i = −Error × (d_acum_i / D_total)
```

Aplicada sobre la cadena de `bm`/`pc`. Cada `intermediate` hereda la corrección
de la armada de la que cuelga. Σcorrecciones = −Error, de modo que el BM final
cierra exacto.

### Ida y vuelta (`§6.9`, enmendado — decisión #2)

Cada recorrido se calcula de forma independiente y produce su desnivel de
sección:

```
Discrepancia   = |Δh_ida − (−Δh_vuelta)|
Tolerancia_iv  = T × √2
Δh_adoptado    = (Δh_ida − Δh_vuelta) / 2
```

La corrección se aplica al recorrido de ida usando el desnivel adoptado. **No
hay promediado por tramo.**

### Tests (Vitest)

Fixtures construidos y verificados a mano, **nunca copiados del marco teórico**
(ver hallazgo 1). Cubren: cálculo base con y sin intermedios; comprobación
aritmética; los 3 tipos; corrección proporcional (Σcorrecciones = −Error, cierre
exacto en el BM final); e ida/vuelta **con distinto número de armadas por
recorrido**, que es el caso que rompe la implementación ingenua.

## Validación (`src/lib/validators/leveling.ts`)

- **Capa captura** (`§5.1`): lectura de mira < 0 o > 4.000 m → error, bloquea
  guardar; L.At = L.Ad exacta → advertencia; campo requerido vacío → error.
  Se añade el **equilibrado de visuales** (`|d_atrás − d_adelante|` > 2/3/4 m
  según orden) como **advertencia**, no bloqueo: es calidad de campo, no error
  de captura.
- **Capa cierre** (`§5.2`): error > tolerancia → bloquea el cierre, permite
  cerrar como `rejected`; enlace fuera de tolerancia → banner rojo; discrepancia
  ida/vuelta > `T√2` → banner amarillo; fallo de la comprobación aritmética →
  banner rojo crítico.

## Rutas y capa de datos

| Ruta | Comportamiento |
|---|---|
| `/projects/[id]/leveling/new` | Nombre, tipo, BM de partida (selector `reference_points` + fallback libre), BM de llegada si `link`, toggle ida/vuelta, orden heredado del proyecto y editable. Inserta el proceso (`draft`) y redirige al editor. |
| `/projects/[id]/leveling/[pid]` | Editor. Si el proceso es `closed`/`rejected`, se muestra en solo lectura. |

- **Queries** (`src/lib/supabase/queries.ts`): `getLevelingProcesses(projectId)`
  para la tab Procesos; `getLevelingProcess(pid)` + sus `leveling_readings`.
- **Server Actions**: `createLevelingProcessAction`,
  `saveLevelingProcessAction` (recalcula en servidor con las funciones puras y
  persiste config + lecturas + resultados; `revalidatePath`),
  `closeLevelingProcessAction` (`closed_at`, `closed_by`, `status` → `closed` o
  `rejected`). Toda mutación verifica que el proceso no esté cerrado.

## Componentes

- **Feature** (`src/components/leveling/`): `leveling-config-fields`
  (compartido entre `/new` y la config del editor), `leveling-editor` (client
  component orquestador), `readings-table` (libreta: Punto / Tipo / L.At / AI /
  L.Ad / Dist / Cota), `run-tabs` (Ida | Vuelta, solo si `has_return_run`),
  `results-panel`, `close-process-dialog`.
- **Design system**: ninguno nuevo (decisión #12). Se reutiliza
  `StatusIndicator`.
- **Hub**: activar «Nivelación» en `new-process-selector`; la tab Procesos lista
  los procesos de ambos tipos.

## Criterios de aceptación

| # | Check |
|---|---|
| a | `npm run typecheck`, `lint`, `build`, `test` — exit 0 |
| b | Tests: cálculo base, comprobación aritmética, 3 tipos, corrección, ida/vuelta con distinto nº de armadas |
| c | «+ Nuevo Proceso» → «Nivelación» lleva a `/leveling/new` |
| d | El selector de BM autocompleta código y cota desde `reference_points`; la entrada libre sigue disponible |
| e | El editor calcula AI y cotas **en vivo**, respetando el orden consumir → generar |
| f | Los `intermediate` no propagan cota ni entran en la comprobación aritmética |
| g | La comprobación aritmética se muestra y marca en rojo crítico si no cuadra |
| h | Error de cierre vs `K·√D` reflejado por `StatusIndicator` según el orden del proyecto |
| i | Corrección proporcional: Σcorrecciones = −Error; el BM final cierra exacto |
| j | Ida/vuelta: dos recorridos independientes, discrepancia vs `T√2`, desnivel promediado |
| k | Tipo `open`: calcula sin cierre ni corrección |
| l | Validación de captura: lectura fuera de [0, 4] m bloquea guardar |
| m | «Guardar» persiste config, lecturas y resultados; al recargar, el editor los muestra |
| n | Cerrar registra `closed_at`/`closed_by`, pone `status=closed` y deja solo lectura; fuera de tolerancia puede cerrarse como `rejected` |
| o | RLS: un usuario no accede a procesos de proyectos ajenos (404) |
| p | Un proceso `closed` rechaza la mutación **también vía API REST directa** (trigger de base) |

## Riesgos conocidos

- **El marco teórico no sirve como fixture** (hallazgo 1). Todo fixture se
  construye con entradas limpias y se verifica a mano.
- **El orden consumir → generar dentro de la fila** es el detalle que más
  fácilmente se implementa al revés. Se fija con un test de libreta de
  resultado conocido antes de dar por buena la función.
- **Ida y vuelta con distinto número de armadas** rompe cualquier
  implementación que asuma correspondencia entre recorridos. Hay un test
  específico para ese caso.
- **El significado de D en la tolerancia** está en disputa entre fuentes
  (decisión #9). Se fija en un solo sentido y se documenta en `tolerances.ts`.
- **La app está en producción**: las migraciones ya no se editan en sitio.

## Tareas (en orden)

0. Apertura: este PRD, enmienda del `§6.9` y `§3.2` del PRD principal, estado
   `en curso` en `method.md` y `prds/README.md`, commit `docs:`.
1. Migración `leveling_processes` + `leveling_readings` + RLS + triggers;
   aplicar y regenerar tipos.
2. `src/types/leveling.ts` (literales, etiquetas, tipos de entrada/resultado).
3. Tolerancias de nivelación en `calculations/tolerances.ts` + tests.
4. `calculations/leveling.ts`: cálculo base y comprobación aritmética + tests.
5. `calculations/leveling.ts`: cierre, tolerancia y corrección proporcional + tests.
6. `calculations/leveling.ts`: ida y vuelta a nivel de sección + tests.
7. `validators/leveling.ts`.
8. Queries y Server Actions (crear, guardar, cerrar).
9. Ruta `/leveling/new` + `leveling-config-fields` + selector de BM.
10. Editor `/leveling/[pid]`: config, `readings-table`, cálculo en vivo.
11. `run-tabs` (ida/vuelta) y `results-panel`.
12. `close-process-dialog` y flujo de cierre; modo solo lectura.
13. Integración con el hub: activar «Nivelación», listar en la tab Procesos.
14. Verificación end-to-end (criterios a-p). Documentación de handoff. Cierre.

## Anti-alcance explícito

No se implementa: redes de nivelación; ajuste por mínimos cuadrados; métodos de
corrección alternativos; los órdenes Clase I y Expedita; nivelación
trigonométrica o barométrica; exportación a Excel; auto-save; módulos de
asentamientos e informes. No se crean tablas SQL fuera de las 2 de nivelación.
No se refactoriza código de fases anteriores salvo lo necesario para activar
«Nivelación» en el selector y listar los procesos en el hub.
