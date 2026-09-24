# PRD-de-fase 14 — Ajuste de poligonales por mínimos cuadrados

**Estado:** cerrada
**Fecha de apertura:** 2026-09-23
**Fecha de cierre:** 2026-09-23

**Rama:** `fase-14-minimos-cuadrados`
**Cartera de referencia:** [`carteras/analisis-minimos-cuadrados.md`](../carteras/analisis-minimos-cuadrados.md)
(`Ajuste_Poligonal_Minimos_Cuadrados.xlsx`, U. Distrital, Sede Vivero)
**Módulo:** poligonal

> **Divergencias de la implementación:**
>
> - **Tolerancia de convergencia 1e-10 σ**, no 1e-12 (decisión 7). Con 1e-12
>   un caso de prueba necesitaba 6 iteraciones que no movían nada: una
>   corrección angular en radianes ronda 1e-5 y por debajo de 1e-10 σ el
>   cambio es ruido de coma flotante. Las condiciones siguen quedando en cero
>   (< 1e-9) en todos los casos; la Vivero converge en 3 iteraciones.
> - **El CHECK de pesos lleva `coalesce(…, false)`.** Tal como estaba en
>   «Modelo de datos», un peso en `NULL` hacía `NULL` la condición y
>   PostgreSQL da por cumplido un CHECK `NULL`: el método se guardaba sin
>   pesos. Se vio al verificar contra la base. Corregido aquí y en la
>   migración.
> - **Lectura de σ₀ con una banda con nombre**, `SIGMA0_BAND = [0.5, 2]`: el
>   PRD decía «≈ 1», «≫ 1» y «≪ 1» sin fijar límites, y la pantalla necesita
>   uno. Solo cambia el texto; no decide nada (decisión 8).
> - **Límites y escala de los pesos** según sus columnas (σ angular
>   0.01″–9999.99″ con dos decimales, σ de distancia 0.0001–9999.9999 m con
>   cuatro, mediciones entero de 1 a 1000). Un σ que la base redondeara lo
>   guardaba distinto del que produjo las coordenadas. Se validan con
>   cualquier método, porque se guardan igual (hallado en la revisión).
> - **Estado `unadjustable`**, no previsto: una abierta de un solo lado no tiene
>   redundancia y el motor lanzaba «Sistema singular», que tumbaba el editor.
>   Ahora dice por qué no hay ajuste —un lado, sistema singular o sin
>   convergencia— y deja las coordenadas en `null`, como sin pesos.
> - **La abierta no publica deflexiones corregidas**, igual que con los otros
>   métodos. Publicarlas en valor absoluto perdía el signo cuando la corrección
>   cruzaba el cero (hallado en la revisión).
> - **Duplicar copia los pesos** —sin ellos el CHECK rechazaba el duplicado de
>   un proceso con el método— y también `angle_input_format`, que la Fase 13
>   olvidó copiar.
> - **Un proceso con el método cuyo tipo pasa a abierta sin control** conserva
>   el selector para poder cambiarlo, y el guardado lo rechaza con un mensaje
>   hasta entonces (criterio 1 sin reescribir el método en silencio).
> - La tabla de correcciones añade la **distancia ajustada**, que el Excel ya
>   pedía, y el número de **condiciones** junto a las iteraciones.

## Propósito

Añadir un **cuarto método de corrección**, el ajuste por mínimos cuadrados con
ecuaciones de condición, junto a Bowditch, Tránsito y Crandall.

La diferencia no es de grado. Los tres métodos actuales reparten el error de
cierre **sobre las proyecciones** con una regla proporcional. El ajuste corrige
**las observaciones mismas** —cada ángulo y cada distancia— según cuánto
se confía en cada una, y entrega una medida de si esa confianza era realista
(σ₀).

## Cambio de alcance del proyecto

`CLAUDE.md` lista «Ajuste por mínimos cuadrados (trabajo futuro)» en *Out of
scope*. El usuario decidió incluirlo al abrir esta fase. **Al aprobar este PRD,
esa línea se quita de `CLAUDE.md` en el mismo commit**, y la lista de algoritmos
de `polygonal.ts` en la sección *Architecture* se amplía al cerrar la fase.

## Hallazgos que originan la fase

### 1. La hoja de la universidad no cumple sus propias condiciones

Está en el análisis de la cartera: la hoja «POLIGONAL MINIMOS» reduce los
residuos al 27 % y se detiene. La poligonal ajustada no vuelve al punto de
partida (−1.95 mm en N, +1.98 mm en E). Tiene una séptima incógnita angular
espuria para una cartera de seis ángulos.

### 2. Los valores «correctos» del análisis heredan un defecto de la hoja

El análisis rehízo el ajuste «con los mismos datos». Al preparar este PRD se
repitió de forma independiente, con el encadenamiento exacto de azimuts que usa
el motor, y **no coincide del todo**:

| | Análisis | Cálculo independiente |
|---|---|---|
| Corrección del ángulo 1 | +0.769″ | +0.757″ |
| Corrección del lado 1 | −4.18 mm | −3.93 mm |
| D1 (Este) | 101515.6311 | 101515.6314 |

La causa está en las proyecciones de la hoja. Sus azimuts arrastran el defecto
de conversión que el propio análisis documentó en las otras hojas
(`INT((G-H)*60)`): el lado D3 sale a **37.543000°** donde el encadenamiento
exacto da **37.542437°**, unos 2″. Además, el azimut de amarre está tecleado
(35.002228°) en vez de calcularse desde las coordenadas, lo que añade 0.25″.

Las dos soluciones cumplen las tres condiciones: cada una ajusta correctamente
sus propios datos. **Los valores esperados de los tests son los del cálculo
independiente** (tabla de «Pruebas»), no los del análisis ni los de la hoja. Se
deja escrito para que nadie persiga una paridad que no puede existir.

### 3. El orden de precisión no depende del método

El veredicto de cierre se juzga con el error **antes** de ajustar: error
angular, error lineal y precisión relativa. Es el mismo con cualquier método.
Mínimos cuadrados no hace que una poligonal «cumpla»: reparte mejor un error
que ya se juzgó.

## Decisiones

Las cuatro primeras las tomó el usuario al abrir la fase.

| # | Decisión | Razón |
|---|---|---|
| 1 | Mínimos cuadrados **entra** y sale de *Out of scope* | Decisión del usuario. Hay análisis y cartera real |
| 2 | **Pesos como la hoja**: tres valores tecleados por proceso —σ angular (″), σ de distancia (m) y número de mediciones de cada distancia—, iguales para todas las observaciones | Decisión del usuario, tras ver que la hoja usa 2″ y 0.011 m con 2 mediciones, tecleados. Reproduce el ejercicio tal como se enseña |
| 3 | Se aplica a **cerrada** y **abierta con control** | Las dos tienen redundancia. La abierta sin control no tiene nada que ajustar |
| 4 | Se muestran las **correcciones de cada observación** y **σ₀** | Es lo que distingue el método y lo que se defiende en la monografía |
| 5 | **Ecuaciones de condición**, no ajuste paramétrico | Es el método de la hoja y del curso, y el sistema es de 3×3 (o 2×2) sin importar cuántas estaciones haya. Las elipses de error, que exigirían el paramétrico, quedan fuera |
| 6 | El **ángulo de orientación es datum**: no se ajusta | Un error suyo rota el polígono entero sin afectar al cierre, así que las condiciones no lo determinan (análisis, «Para la Fase 14»). En el esquema con fila de cierre (TT4) entra en la condición angular como constante |
| 7 | Se **itera** hasta que la corrección cambie menos de 1e-12 (máximo 10 iteraciones) | Las condiciones de cierre no son lineales en los ángulos. Con correcciones de segundos basta una o dos iteraciones, pero el criterio de aceptación es que las condiciones queden en cero, no que se haga una sola pasada |
| 8 | El veredicto **no cambia** con el método | Hallazgo 3 |
| 9 | Correcciones y σ₀ **no se persisten**: se recalculan | Un proceso cerrado es inmutable y el informe ya reconstruye la entrada con `polygonalInputOf` (Fase 13). Las coordenadas, el ángulo corregido y el azimut sí se persisten, como con los otros métodos |

## El método

### Observaciones y condiciones

**Observaciones** `l`: los ángulos que participan en la condición angular
(salvo el de orientación, decisión 6) y las distancias de los lados.

**Condiciones** `f(l) = 0`:

| Tipo | Condición angular | Condiciones lineales |
|---|---|---|
| Cerrada | Σ ángulos − suma teórica = 0 | Σ ΔN = 0, Σ ΔE = 0 |
| Abierta con control, con azimut de llegada | último azimut − azimut de llegada = 0 | Σ ΔN = N_llegada − N_salida, ídem en E |
| Abierta con control, sin azimut de llegada | — | las dos lineales (sistema de 2×2) |

### Solución

```
A  = ∂f/∂l                  (coeficientes de condición)
Q  = diag(σ²)               σ_ángulo en radianes; σ_distancia = σ / √(mediciones)
w  = f(l₀)                  cierres antes del ajuste
v  = −Q·Aᵀ·(A·Q·Aᵀ)⁻¹·w     correcciones
σ₀ = √(vᵀ·Q⁻¹·v / r)        r = número de condiciones
```

Iterando con `w = f(lₖ) + A·(l₀ − lₖ)` hasta la convergencia (decisión 7).

**Coeficientes analíticos**, como los deriva el análisis. Un ángulo arrastra el
azimut de los lados que siguen, así que su derivada en N es `−Σ ΔE` de esos
lados y en E es `+Σ ΔN`. Una distancia aporta el coseno y el seno de su
azimut. El ángulo del último vértice de la vuelta no arrastra ningún lado:
entra solo en la condición angular. Un test compara los coeficientes con
diferencias finitas.

### σ₀

Con `σ` a priori tomadas como verdaderas, `σ₀` debería rondar 1:

- **σ₀ ≈ 1**: los pesos supuestos describen bien las observaciones.
- **σ₀ ≫ 1**: se midió peor de lo supuesto, o hay un error grueso.
- **σ₀ ≪ 1**: los σ supuestos son pesimistas.

Se muestra con esa lectura. **No** se hace la prueba χ² ni se decide nada con
σ₀: es información para el topógrafo (decisión 8).

## Modelo de datos

```sql
alter table public.polygonal_processes
  drop constraint polygonal_processes_correction_method_check,
  add constraint polygonal_processes_correction_method_check
    check (correction_method in ('bowditch', 'transit', 'crandall', 'least_squares')),
  add column ls_sigma_angle_seconds  decimal(6,2),
  add column ls_sigma_distance_m     decimal(8,4),
  add column ls_distance_measurements int,
  add constraint polygonal_processes_ls_weights_complete
    check (
      correction_method is distinct from 'least_squares'
      or coalesce(ls_sigma_angle_seconds > 0 and ls_sigma_distance_m > 0
                  and ls_distance_measurements >= 1, false)
    );
```

Los tres campos solo se exigen con el método de mínimos cuadrados. Los procesos
existentes no cambian.

## Superficie

### Editor

- El selector de método gana **«Mínimos cuadrados»**. Solo aparece en cerrada y
  abierta con control.
- Al elegirlo aparecen los **tres campos de pesos**, vacíos. El texto de ayuda
  cita la hoja de la universidad como ejemplo (2″, 0.011 m, 2 mediciones).
  **No se prellenan**: un peso supuesto sin que el usuario lo vea sería un dato
  inventado.
- Mientras falte alguno, el resultado muestra «Faltan los pesos del ajuste»,
  sin coordenadas ajustadas, y no se puede guardar el método.
- En **Resultados**, con el método activo:
  - una tabla de **correcciones**: cada ángulo en segundos y cada distancia en
    milímetros;
  - **σ₀** con su lectura (sección «σ₀»);
  - el número de iteraciones hasta converger.
- El dibujo de la Fase 13 funciona sin cambios: el trazo sin compensar muestra
  el desplazamiento del ajuste.

### Informe imprimible

La sección de la poligonal indica el método, los tres pesos y σ₀.

### Excel

- **«Cálculos»** gana, con el método activo, las columnas «Corrección angular
  (″)» y «Distancia ajustada (m)».
- **«Resumen»** muestra los pesos y σ₀.

## Archivos

| Archivo | Qué cambia |
|---|---|
| `supabase/migrations/<ts>_minimos_cuadrados.sql` | El CHECK del método y las tres columnas |
| `src/types/database.ts` | Regenerado |
| `src/types/polygonal.ts` | `least_squares` en `CORRECTION_METHODS`; pesos en `PolygonalInput`; `adjustment` (correcciones, σ₀, iteraciones) en `PolygonalResult` |
| `src/lib/calculations/least-squares.ts` | Nuevo, puro: el ajuste por ecuaciones de condición |
| `src/lib/calculations/polygonal.ts` | La rama del método en cerrada y abierta con control |
| `src/components/polygonal/polygonal-draft.ts` | Los pesos, de la fila a la entrada |
| `src/components/polygonal/results-panel.tsx` | Selector, campos de pesos, correcciones y σ₀ |
| `src/app/(app)/projects/[id]/polygonal/[pid]/actions.ts` | Guardar y validar los pesos |
| `src/lib/export/polygonal-workbook.ts` | Columnas y resumen |
| `src/app/(app)/projects/[id]/reports/[reportId]/print/page.tsx` | Pesos y σ₀ |
| `scripts/seed.mjs` | La cartera Vivero con mínimos cuadrados y los pesos de la hoja |
| `CLAUDE.md` | Sale de *Out of scope*; `polygonal.ts` lista el método |
| Manual (dos copias), guion de pruebas, doc técnica | Como en cada fase |

## Pruebas

**Suite existente:** 585 tests.

**Valores esperados** (cálculo independiente al redactar este PRD; cartera
Vivero, pesos de la hoja: σ = 2″, 0.011 m, 2 mediciones):

| Ángulo | Corrección | Lado | Corrección |
|---|---|---|---|
| D1 (155°23′13″) | +0.757″ | Famarena_5 → D1 | −3.93 mm |
| D2 (109°22′40″) | +0.771″ | D1 → D2 | −2.94 mm |
| D3 (79°16′02″) | +0.876″ | D2 → D3 | +1.86 mm |
| D4 (114°24′14″) | +0.855″ | D3 → D4 | +3.36 mm |
| Famarena_5 (81°33′47″) | +0.741″ | D4 → Famarena_5 | −0.92 mm |

| Punto | Norte | Este |
|---|---|---|
| D1 | 100117.4637 | 101515.6314 |
| D2 | 100113.1749 | 101528.7028 |
| D3 | 100182.2402 | 101581.7806 |
| D4 | 100193.8992 | 101558.7099 |
| Famarena_5 | 100139.8440 | 101491.4440 |

**σ₀ = 0.698.**

**Nuevas, como mínimo:**

| Qué | Casos |
|---|---|
| Vivero | Las correcciones y coordenadas de la tabla, a 0.001″ y 0.1 mm; σ₀ a 0.001; **las tres condiciones en cero** (angular < 1e-9″, lineales < 1e-9 m) |
| TT4 (fila de cierre) | Las tres condiciones en cero; la orientación no cambia |
| Abierta con control | Con azimut de llegada: tres condiciones en cero y llega al punto conocido. Sin él: dos condiciones |
| Coeficientes | Los analíticos coinciden con diferencias finitas |
| Correcciones no uniformes | En Vivero las correcciones angulares **difieren** entre sí: si fueran iguales, el método sería el reparto proporcional |
| Veredicto | Mismo error angular, error lineal y precisión relativa que Bowditch sobre la misma cartera (hallazgo 3) |
| Pesos | Sin pesos, el resultado no tiene coordenadas ajustadas y lo dice. Duplicar σ angular desplaza la corrección hacia los ángulos |
| σ₀ | Escalar todos los σ ×2 divide σ₀ entre 2 y deja las correcciones iguales |

**Probar la ruta** (aprendizaje de la Fase 9): los tests entran por
`computePolygonal` con `method: "least_squares"`, no solo por el módulo del
ajuste.

**Contra la base:** el CHECK rechaza `least_squares` sin pesos.

**En pantalla, antes de cerrar:**

1. La Vivero con mínimos cuadrados: correcciones, σ₀ y coordenadas de la tabla.
2. Cambiar un peso y ver cambiar las correcciones en vivo.
3. Elegir el método sin pesos: el aviso, sin coordenadas.
4. Una abierta con control con el método.
5. El dibujo con el ajuste.
6. Informe imprimible y Excel.
7. La ruta `/manual`.

## Criterios de aceptación

1. «Mínimos cuadrados» está disponible en cerrada y abierta con control, y no
   en abierta sin control.
2. El ajuste deja **las condiciones en cero** en todos los casos de prueba.
3. Sobre la cartera Vivero reproduce la tabla de valores esperados.
4. Los pesos se teclean por proceso, no se prellenan, y sin ellos no hay
   ajuste ni se puede guardar el método.
5. La orientación no se ajusta.
6. El veredicto es el mismo que con cualquier otro método.
7. Se muestran las correcciones por observación, σ₀ con su lectura y las
   iteraciones.
8. El informe y el Excel muestran el método, los pesos y σ₀.
9. `CLAUDE.md` ya no lista el método en *Out of scope*.
10. `npm run typecheck`, `npm run lint` y `npm test` pasan limpios, con los
    tests nuevos sumados a los 585.
11. Manual en sus dos copias, en el mismo commit, con capturas regeneradas.
12. Doc técnica actualizada y tabla de pruebas regenerada desde la ejecución.
13. `docs/testing/manual-e2e-poligonal.md` cubre el método.

## Fuera de alcance

- **Ajuste paramétrico**, elipses de error y matriz de covarianza de las
  coordenadas (decisión 5).
- **Prueba χ² de σ₀**, detección automática de errores gruesos (*data
  snooping*) y reponderación.
- **Pesos por observación** o derivados del equipo (decisión 2).
- **Redes** con varios puntos fijos o varias poligonales enlazadas.
- **Nivelación por mínimos cuadrados.**

## Riesgos

- **Se confunda «mínimos cuadrados» con «cumple».** Mitigación: el veredicto no
  cambia (hallazgo 3), y el manual lo dice.
- **Unos pesos mal tecleados producen un ajuste válido y engañoso.** Unos σ
  absurdos (0.1″ con 5 cm) cumplen las condiciones igual. Mitigación: σ₀ con su
  lectura, que es justo el indicador de pesos irreales.
- **Paridad con el análisis.** Hallazgo 2: los valores del análisis no son el
  objetivo, y el PRD lo deja escrito.
- **Crandall ya se llama «mínimos cuadrados sobre las distancias»** en el
  manual. Mitigación: el manual distingue los dos métodos en la misma tabla.
