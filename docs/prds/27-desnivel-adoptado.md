# PRD-de-fase 28 — Ida y vuelta en la compensación

**Estado:** cerrada
**Fecha de apertura:** 2026-10-01
**Fecha de cierre:** 2026-10-01

**Rama:** `fase-28-ida-y-vuelta`
**Petición:** del usuario, 2026-10-01. Es CR1 de `pendientes.md`, que nació
del criterio D-1 de la auditoría del cálculo. Tras ver el caso de la demo y un
método de libro para compensar una nivelación de ida y vuelta, pidió: «sí,
aclarando que el punto de partida no se cambia la cota claramente». Y
después: «ajusta también la documentación sobre estas fórmulas para tenerlas
allí para la monografía».
**Módulo:** nivelación — motor, resultados, informe, Excel y los fundamentos
matemáticos del módulo

> **Divergencias de la implementación:**
>
> - **El resultado gana `circuitClosureMm`**, el cierre del circuito de una
>   abierta, con su signo. El panel lo muestra y explica cómo se compensó.
> - **Las cotas corregidas del panel incluyen la vuelta**, con una columna de
>   recorrido: antes solo mostraba la ida, que era la única compensada.
> - **El punto de vuelta figura como «Promedio de 2 cotas compensadas»**
>   porque se lee dos veces (fin de la ida y comienzo de la vuelta), aunque
>   sus dos cotas sean iguales. El documento de fundamentos dice lo mismo.
> - **El ejemplo 1 de los fundamentos queda como test** (`leveling.test.ts`),
>   para que el documento no deje de ser cierto si cambia el motor.
> - **Recálculo:** en local se guardó El Verjón desde el editor; sus filas
>   pasaron a las cotas nuevas (D1 3288.5000 en las dos puntas, D4 3315.0855,
>   C 1 3289.4414 y 3289.4386). En producción, tras el merge, con el visto
>   bueno del usuario.
> - **Verificación en pantalla** en local, a 1280 px en claro y 390 px en
>   oscuro, sin desborde: El Verjón (cierre del circuito −5.0 mm, cotas
>   corregidas de los dos recorridos, cotas adoptadas, informe y Excel) y el
>   tramo 2 (C14 = 2542.2271 en el editor y en el informe, C10 fijo).

## Propósito

En una nivelación con ida y vuelta se mide dos veces el mismo desnivel, pero
la app da las cotas con **una sola** de las dos medidas:

- en una abierta, con la ida, sin compensar;
- en una cerrada o de enlace, con la ida compensada, y la vuelta solo
  controla.

Cuando la vuelta pasa por los mismos puntos, un punto puede quedar además con
**dos cotas** distintas.

Esta fase usa las dos medidas: **ida y vuelta se compensan como un circuito,
por distancia, y cada punto leído dos veces recibe una sola cota, el promedio
de sus dos cotas compensadas.** La cota del BM de partida —y la del de llegada
en una de enlace— **no cambia nunca**: es un dato conocido, no una medición.

El veredicto no cambia. Las tolerancias y lo que decide si un trabajo cumple
son los de hoy. Cambian las cotas que se entregan.

## Hallazgos que condicionan la fase

### 1. Cómo compensa hoy la app

| Tipo | Sin vuelta | Con vuelta |
|---|---|---|
| Cerrada | El circuito, por distancia | La ida, con su cierre; la vuelta se juzga y no se compensa |
| De enlace | La ida contra el BM de llegada | La ida contra el BM de llegada; la vuelta se juzga y no se compensa |
| Abierta | Nada: no hay cota conocida al final | **Nada**: las cotas son las de la ida; la vuelta solo da la discrepancia |

El BM de partida ya no recibe corrección en la ida desde la Fase 19 (N8).

### 2. El Verjón: la vuelta se descarta

Abierta de D1 (3288.500) a D4, con ida y vuelta por los mismos puntos.

- **Discrepancia:** 5.0 mm, con una tolerancia de 10.5 mm.
- **Cotas:** las de la ida, sin compensar.
- **Lo que dice la vuelta:** D4 = 3315.088, que la app no usa. La diferencia
  punto a punto va de −2 a +5 mm.

### 3. Tramo 2: dos cotas para un mismo punto

La demo importa el crudo como **un solo recorrido cerrado**: sale de C10,
llega al punto más lejano y vuelve a C10 por los mismos puntos. El cierre,
−0.4 mm, se reparte por distancia, pero cada punto queda con dos cotas
compensadas, una de cada pasada:

| Punto | Al ir | Al regresar | Diferencia |
|---|---|---|---|
| C13 | 2542.1123 | 2542.1073 | −5.0 mm |
| C14 | 2542.2296 | 2542.2246 | −5.0 mm |

El informe lista las dos filas y nadie puede decir cuál es la cota de C14.

### 4. El método de libro, y el paso que le falta

El método clásico trata ida y vuelta como un circuito cerrado y reparte su
error de cierre por distancia. Es lo que la app ya hace en las cerradas.

**Aplicado a El Verjón:**

- el circuito mide 781.9 m;
- el cierre es −5.0 mm, con una tolerancia de 12·√0.7819 = 10.61 mm;
- D4 queda en **3315.0855**.

Es exactamente el promedio de ida y vuelta ponderado por sus distancias:
compensar el circuito y promediar son lo mismo en el punto de vuelta.

**Lo que el método de libro no cubre:** su ejemplo vuelve por puntos
distintos. Con los mismos puntos, cada uno queda con dos cotas compensadas: en
El Verjón, hasta 2.8 mm de diferencia (C1: 3289.4414 al ir, 3289.4386 al
volver). Falta un paso: la cota del punto es el **promedio** de sus dos
compensadas (C1: 3289.4400).

### 5. El BM de partida

Aparece dos veces en el circuito: al salir y al volver. Al salir tiene su cota
conocida y no se corrige (Fase 19). Al volver, la compensación lo deja
exactamente en su cota conocida, porque esa es su definición. El promedio de
las dos daría lo mismo, pero la regla no puede depender de eso: **el BM de
partida, y el de llegada en una de enlace, quedan fuera del promedio y
conservan su cota conocida en todas sus filas y en la cota adoptada.**

### 6. Qué procesos cambian

En producción, a 2026-10-01:

- **El Verjón** (abierta con vuelta, calculada) cambia sus cotas al volver a
  guardarse.
- **El tramo 2** (cerrada, sin vuelta, cerrada) no cambia sus filas, que
  además son inmutables. Solo ganaría la cota adoptada, si se elige así en la
  decisión 2.

La libreta de la visita de asentamientos usa el mismo motor, con un solo
recorrido y sin vuelta: queda fuera (ver «Fuera de alcance»).

## Alcance

### A. El motor: ida y vuelta compensadas

Con recorrido de vuelta, cada recorrido se compensa contra la cota conocida en
la que cierra, en proporción a la distancia acumulada:

| Tipo | Contra qué se compensa |
|---|---|
| Abierta | Ida y vuelta forman **un circuito** sobre el BM de partida: el error es la llegada de la vuelta menos la cota conocida, y se reparte por distancia a lo largo de todo el circuito |
| Cerrada | Cada recorrido con su propio cierre: la ida, como hoy, y además la vuelta |
| De enlace | La ida contra el BM de llegada, como hoy, y la vuelta contra el de partida |

- Se compensa solo un trabajo que cumple, como hoy: la discrepancia en la
  abierta y cada recorrido en las otras (C-10). Si no cumple, las cotas
  quedan sin compensar.
- Sin vuelta, nada cambia.

### B. La cota adoptada de cada punto

Una función pura, `adoptedElevations`, da **una cota por punto**:

- **BM de partida, y de llegada en una de enlace:** su cota conocida, siempre.
- **Punto leído una vez:** su cota compensada.
- **Punto leído dos veces** —en la ida y en la vuelta, o al ir y al volver de
  un mismo recorrido, según la decisión 2—: el promedio de sus dos cotas
  compensadas.
- **Los puntos se reconocen por su código,** sin espacios ni mayúsculas, como
  los homólogos de la Fase 17 («AUX 1» y «AUX1» son el mismo).
- **Sin compensación** —el trabajo no cumple— no hay cota adoptada: se
  repite el levantamiento.

La comparación por puntos homólogos (Fase 17) no cambia: compara las cotas
**calculadas**, sin compensar, que es lo que deja ver las diferencias.

### C. Dónde se ve

Una tabla nueva, **«Cotas adoptadas»**, con una fila por punto (decisión 1):

- **qué lleva:** el punto, su cota, cuántas veces se leyó, y si es un BM de
  cota conocida;
- **dónde:** en el panel de resultados, el informe del proceso (y el
  consolidado) y el Excel;
- **la libreta no cambia de forma:** cada fila muestra su compensación, así
  que un punto pasado dos veces conserva las dos cotas de sus pasadas.

En el informe y el Excel de un proceso guardado, la tabla se deriva de las
filas guardadas, sin recalcular.

### D. Los procesos que ya existen

**El motor nuevo vale para todos, sin marca por proceso** (decisión 3: «recalcular todo»):

- **Abiertos:** las nivelaciones guardadas sin cerrar se recalculan con el
  motor nuevo al terminar la fase. En producción, El Verjón, con el visto
  bueno del usuario.
- **Cerrados:** conservan sus filas, por la inmutabilidad. En producción el
  único es el tramo 2, cuyas filas no cambian, porque es un solo recorrido y
  se compensa como hoy; solo gana la tabla de cotas adoptadas.

### E. Los fundamentos del módulo, para la monografía

Un documento nuevo, `docs/math/nivelacion.html`, hermano del de poligonales
(`docs/math/poligonales.html`), con todas las fórmulas del módulo tal como las
calcula la app. Está pensado para citarlo en la monografía:

1. **El cálculo base:** altura de instrumento, cotas, puntos intermedios y
   comprobación aritmética (ΣV+ − ΣV− = cota final − cota inicial).
2. **Las distancias:** estadimetría (D = 100·(HS − HI)), distancia por visual
   y acumulado desde el origen, que en la Fase 26 pasó a milímetros enteros.
3. **Error de cierre y tolerancia:** T = K·√D por orden, con D en km, y el
   margen de comparación de la Fase 26.
4. **La compensación proporcional a la distancia:** Cᵢ = −E·dᵢ/D, con el BM de
   partida fijo y las intermedias con la corrección de su armada.
5. **Ida y vuelta:**
   - la discrepancia y su tolerancia (T·√2 con la menor distancia);
   - cada recorrido con su tolerancia en una cerrada o de enlace;
   - el circuito ida + vuelta y su compensación;
   - la cota adoptada de los puntos leídos dos veces;
   - por qué el BM de partida no cambia.
6. **El equilibrado de visuales** por armada, y los puntos homólogos.
7. **Dos ejemplos resueltos a mano, paso a paso:**
   - un circuito corto de libro;
   - **El Verjón** con ida y vuelta: circuito de 781.9 m, cierre −5.0 mm,
     tolerancia 10.61 mm, D4 = 3315.0855 y las cotas adoptadas.
8. **Las fuentes:** el marco teórico del proyecto, Wolf y Ghilani, y la FGCS
   para comparar. También qué se decidió y en qué fase.

Los números de los ejemplos coinciden con los tests.

### F. Documentación

- **PRD principal § 6.9:** el desnivel adoptado entra en la compensación.
- **Doc técnica:** el motor y la § 11 (se cierra la entrada del desnivel
  adoptado).
- **Manual, en sus dos copias:** la compensación con vuelta y la cota
  adoptada, con El Verjón como ejemplo.
- **Auditoría:** el estado de D-1.
- **`pendientes.md`:** CR1 se cierra.

## Decisiones del usuario (apertura)

1. **La cota definitiva de un punto pasado dos veces es el promedio de sus
   dos cotas compensadas**, en una tabla «Cotas adoptadas». La libreta
   conserva la compensación de cada pasada.
   - El usuario trajo un texto que proponía quedarse con la cota de la ida
     porque «acumula menos estaciones». Ese argumento vale para las cotas sin
     compensar, no después de compensar el circuito: ahí la incertidumbre de
     un punto depende de su posición en el circuito y es simétrica. Las dos
     compensadas valen lo mismo, y el promedio es la mejor estimación.
   - Visto eso, el usuario eligió el promedio.
   - El resto del texto —compensación acumulativa y secuencial de todo el
     circuito, con el punto de vuelta fijo con su cota compensada— es lo que
     hace esta fase.
2. **Un recorrido que vuelve por sus propios puntos** (el tramo 2) sigue la
   misma regla. El usuario no tuvo preferencia, y es el mismo punto físico
   leído dos veces.
3. **«Recalcular todo»:** el motor nuevo para todos, sin marca por proceso;
   las nivelaciones abiertas guardadas se recalculan; las cerradas conservan
   sus filas.
4. **El BM de partida, y el de llegada en una de enlace, no cambian de cota**,
   como pidió el usuario al encargar el PRD.

## Decisiones

| # | Decisión | Razón |
|---|---|---|
| 1 | El BM de partida, y el de llegada en una de enlace, no cambian nunca de cota | Son datos conocidos; lo pidió el usuario explícitamente |
| 2 | Promedio simple de las dos cotas compensadas | La compensación del circuito ya pondera por distancia; en el punto de vuelta da el promedio ponderado de ida y vuelta |
| 3 | El veredicto y las tolerancias no cambian | La fase cambia las cotas, no el criterio (D-2 se decidió no tocar) |
| 4 | Por distancia, no por número de estaciones | Las armadas no miden igual (El Verjón: desequilibrios de 7 a 20 m); es la regla del marco teórico y la de la app |
| 5 | Solo se compensa lo que cumple | Marco teórico § 8.1: si no cumple, se repite |

## Pruebas

| Qué | Cómo |
|---|---|
| El Verjón | Circuito de 781.9 m, cierre −5.0 mm; D4 = 3315.0855; C1 = 3289.4400; cada punto con una cota |
| BM de partida | 3288.5000 en El Verjón y 2541.7545 en el tramo 2, en todas sus filas y en la cota adoptada; el BM de llegada de una de enlace, igual |
| Tramo 2 | C14 = 2542.2271 (promedio de 2542.2296 y 2542.2246) y C10 = 2541.7545 |
| Cerrada y de enlace con vuelta | Cada recorrido compensado contra su cota; los comunes promediados |
| Sin vuelta | Nada cambia: los fixtures de siempre dan lo mismo |
| No cumple | Sin compensación ni cota adoptada |
| Homólogos | Siguen sobre las cotas calculadas |
| Fundamentos | Los ejemplos del documento, recalculados con el motor, dan las cifras que el documento dice |
| Procesos existentes | Los fixtures sin vuelta ni puntos repetidos dan las mismas filas; El Verjón local, recalculado, guarda las cotas nuevas |

Los valores esperados salen del cálculo de este PRD, hecho con el método de
libro, no de la salida del motor nuevo.

**En pantalla (local), claro y oscuro, 1280 y 390 px:** El Verjón (resultados,
informe y Excel) y el tramo 2.

## Criterios de aceptación

1. En una nivelación con vuelta que cumple, las cotas usan ida y vuelta, y
   cada punto tiene una sola cota adoptada.
2. La cota del BM de partida —y la del de llegada en una de enlace— es la
   conocida en todas partes.
3. El veredicto de cada proceso es el mismo que antes.
4. Lo cerrado conserva sus cotas.
5. `docs/math/nivelacion.html` reúne las fórmulas del módulo con dos
   ejemplos resueltos, cuyas cifras coinciden con el motor.
6. `npm run typecheck`, `npm run lint`, `npm test`, `npx supabase test db` y
   `npm run build` limpios. Manual en sus dos copias y § 11 revisada.

## Fuera de alcance

- **La libreta de la visita de asentamientos:** un solo recorrido sobre el BM
  de amarre, cuyas cotas de control salen de las intermedias.
- **Las tolerancias** (D-2, el √2 de la discrepancia), que no cambian.
- **La σ y las repeticiones del nivel digital** (D-14).
- **El ajuste por mínimos cuadrados de una red de nivelación.**

## Riesgos

- **El Verjón en producción cambia sus cotas** (hasta 2.5 mm) cuando se
  vuelva a guardar. Mitigación: es la demo, sigue sin cerrar, y es justo el
  cambio que la fase busca; se anota en el manual.
- **La cota adoptada puede confundirse con la de la libreta.** Mitigación: se
  rotula y se explica en el manual, y la libreta sigue mostrando la
  compensación de cada fila (según la decisión 1).

## Tareas (en orden)

0. **Apertura:** este PRD con las decisiones, estados en `method.md` y
   `prds/README.md`, `pendientes.md`. Commit `docs:`. Rama.
1. **A** — el motor con ida y vuelta, con sus tests.
2. **B** — `adoptedElevations`, con sus tests.
3. **C** — panel de resultados, informe y Excel.
4. **D** — recalcular las nivelaciones abiertas guardadas en local.
5. **E** — `docs/math/nivelacion.html`, con los ejemplos comprobados contra
   el motor.
6. **Verificación en pantalla** en local.
7. **Cierre:** manual (dos copias) y capturas, doc técnica, auditoría,
   `method.md`, `prds/README.md`, `pendientes.md`. Revisión de código y PR.
8. **Tras el merge:** recalcular El Verjón en producción, con el visto bueno
   del usuario, guardándolo desde el editor con su sesión. Sin migraciones.
