# Auditoría del motor de cálculo — TopoField

**Fecha:** 2026-10-01
**Alcance:** las fórmulas y métodos de los tres módulos —poligonal, nivelación
y asentamientos— y lo común: ángulos, georreferenciación, tolerancias y
formatos. Estado de `main` en `5544dcb` (Fase 25).
**Petición:** del usuario, 2026-10-01: «haz double check de las fórmulas y
métodos de cálculo que usamos en cada módulo».

**Método.** Cuatro revisiones independientes, una por módulo y otra
transversal. Cada una:

- derivó las fórmulas desde la teoría (Wolf y Ghilani, *Elementary Surveying*
  y *Adjustment Computations*; FGCS 1984; el marco teórico del proyecto en
  `docs/marco-teorico/`);
- reimplementó el cálculo por su cuenta, sin reutilizar el motor;
- lo comparó con el motor real sobre las carteras de `docs/carteras/` y la
  demo, y con casos sintéticos y aleatorios.

Los hallazgos marcados **verificado** se comprobaron además leyendo el código;
los marcados **reportado** se apoyan en la reproducción del revisor. Los
scripts están fuera del repositorio, en el directorio temporal de la sesión.

**No se modificó nada:** ni código ni datos.

---

## Estado de la remediación (Fase 26, 2026-10-01)

Corregido en la Fase 26 ([`prds/25-correcciones-calculo.md`](./prds/25-correcciones-calculo.md)),
cada hallazgo con el test que lo habría detectado. Con los del motor de
nivelación, mínimos cuadrados y el redondeo se comprobó además que fallan con
el código anterior. Los dos últimos hallazgos de la tabla no estaban en la
auditoría: salieron al implementar y al verificar en pantalla.

| Hallazgo | Severidad | Estado | Commit |
|---|---|---|---|
| C-1 fila de cierre con 360·k | ALTA | **Corregido** | `1156271` |
| C-2 amarre en las abiertas | ALTA | **Corregido** | `1156271` |
| C-3 el diálogo de la abierta con control | MEDIA | **Corregido** | `1156271` |
| C-4 un solo promedio de lecturas | MEDIA | **Corregido** | `33bbf3c` |
| C-5 coma decimal en las lecturas | MEDIA | **Corregido** | `33bbf3c` |
| C-6 promedio a través de 0°/360° | MEDIA | **Corregido** | `33bbf3c` |
| C-7 convergencia de mínimos cuadrados | MEDIA | **Corregido** | `d050182` |
| C-8 control de reorientación | BAJA | **Quitado** (decisión 3 del PRD) | `1156271` |
| C-9 «singular» falso | BAJA | **Corregido** | `d050182` |
| C-10 la vuelta de una cerrada o de enlace | ALTA | **Corregido**: cada recorrido con su K·√D (decisión 2) | `d2bac3e` |
| C-11 distancias en cero o negativas | MEDIA | **Corregido**, con CHECK en la base | `7085c1a` |
| C-12 comprobación aritmética de la vuelta | MEDIA | **Corregido** | `d2bac3e` |
| C-13 cierre igual a la tolerancia | BAJA | **Corregido**: margen de 1e-6 mm | `398501e` |
| C-14 acumulado en coma flotante | BAJA | **Corregido**: milímetros enteros | `398501e` |
| C-15 cerrar con la anterior abierta | ALTA | **Corregido** | `9ed00a2` |
| C-16 fecha entre las vecinas | ALTA | **Corregido**, con índice único en la base | `06f9881` |
| C-17 aviso de redondeo falso | BAJA | **Corregido** | `33bbf3c` |
| C-18 empates de redondeo | BAJA | **Corregido** | `5e5fe6b` |
| C-19 el servidor no guardaba una cerrada con fila de cierre | ALTA | **Corregido**: hallado al implementar C-2 | `1156271` |
| C-20 el editor no mostraba el amarre | MEDIA | **Corregido**: hallado al verificar C-2 | `3537730` |

La § 3 (documentación) se corrigió en `58a673b`, `ec22c34` y `922d8cb`. La
§ 2 (criterios) sigue abierta: el usuario pidió cambiar D-1, D-3 a D-8, D-10
y D-13, anotados como CR1 a CR4 en [`pendientes.md`](./pendientes.md). D-9 se
retiró el 2026-10-01: los puntos de control dejan de tener posición (A3 de
`pendientes.md`). **D-1 (CR1) se resolvió en la Fase 28**: ida y vuelta
entran en la compensación y cada punto leído dos veces recibe el promedio de
sus cotas compensadas. **D-13 (CR2) se resolvió en la Fase 30**: si la
libreta de una visita pasa por otro BM del catálogo, la app compara su cota
calculada con la de catálogo y avisa si no nivela. La § 4 es material del
usuario y no se tocó.

---

## 0. Resumen

**Las fórmulas de libro están bien.** Sobre las carteras reales del usuario, el
motor reproduce los cálculos independientes:

| Caso | Qué se recalculó | Diferencia frente al motor |
|---|---|---|
| TT4 | Bowditch frente a la hoja BRUJULA | 0.000 mm |
| Vivero | Mínimos cuadrados con un ajuste paramétrico propio | 10⁻¹¹ mm |
| El Verjón | Cotas y compensación | 10⁻¹⁰ mm |
| Crudo del tramo 2 | Desniveles, distancias y cierre | Exacto |
| Torre Alameda | 14 libretas, 112 lecturas y 28 pares | 10⁻¹¹ |

Los errores que sí cambian resultados están en **esquemas que esas carteras no
cubren** y en **reglas de validación**, no en las fórmulas:

- poligonales con amarre en ciertas posiciones;
- abiertas con amarre;
- nivelaciones cerradas con vuelta;
- el orden de las visitas de asentamientos;
- lecturas de ángulo en torno a 0°/360° o con coma decimal.

Hay además criterios —tolerancias y avisos— que son decisiones y no tienen
fuente, o que la tienen distinta (§ 2). También algunos errores en el material
de referencia del propio usuario (§ 4).

| Severidad | Cuántos |
|---|---|
| ALTA — resultado equivocado o veredicto sin aviso | 6 |
| MEDIA — inconsistencia o caso poco frecuente | 7 |
| BAJA — límite numérico o presentación | 5 |

---

## 1. Errores que cambian resultados

### Poligonal

**C-1 · ALTA · verificado — el «+360» de la fila de cierre es fijo.**
`polygonal.ts:171-177` (y la condición de mínimos cuadrados, `:848`).

- Con amarre y fila de cierre, el vértice de arranque aporta dos lecturas: la
  orientación (amarre → primera estación) y el cierre (última estación →
  amarre). Su suma es el ángulo del vértice **+ 360·k**.
- k vale 1 solo si el amarre queda **fuera** del barrido horario que va de la
  vista atrás a la adelante; si queda dentro, vale 0. El código suma 360
  siempre.
- **Efecto:** con el amarre del otro lado, el error angular sale de 360°. Se
  reparte 72° por ángulo en un cuadrado, las coordenadas no tienen sentido
  (1:7) y el cierre queda bloqueado. Mínimos cuadrados termina en «no
  converge». En 60 poligonales aleatorias con fila de cierre fallaron 16.
- TT4 tiene k = 1 y por eso no se ve.
- Ningún proceso pudo cerrarse así: o se bloquea o se rechaza.
- **Arreglo:** k = redondeo de (Σ − base)/360, que solo puede dar 0 o 1;
  interior y exterior siguen a 720° de distancia, así que una declaración
  equivocada se sigue detectando.

**C-2 · ALTA · verificado — en las abiertas, el amarre se ofrece pero se usa mal.**
`polygonal.ts:411` (abierta con control) y `:539` (sin control).

- La configuración ofrece el amarre en todos los tipos. Con amarre, el azimut
  de partida es el del arranque **hacia el amarre**. Las abiertas lo toman
  como azimut del primer lado e ignoran el ángulo de orientación.
- **Efecto:** con el amarre al norte y el primer lado al este, la abierta sin
  control pone B en (100, 0) en vez de (0, 100), **sin aviso**. La abierta con
  control sale con 282.8 m de cierre y rechazada.
- **Arreglo:** Az₀ = Az_amarre + ángulo de orientación, como en la cerrada; o
  no ofrecer el amarre en las abiertas.

**C-3 · MEDIA · verificado — abierta con control: el diálogo deja confirmar lo que el servidor rechaza.**
`validators/polygonal.ts:235-254`.

- `evaluatePolygonalClosure` mira solo el cierre lineal. Con un error angular
  de −60″ (tolerancia 21.2″) y el lineal dentro, el diálogo ofrece «Confirmar
  cierre», pero el servidor guarda `rejected`.
- Un test (`polygonal.test.ts:405`) fija este comportamiento.
- **Arreglo:** rechazar también con el error angular fuera de tolerancia.

**C-4 · MEDIA · verificado — el servidor y el editor promedian las lecturas distinto.**

- **Qué pasa:** al guardar (`actions.ts:122-131`, `averageAngle`), el
  servidor calcula con el promedio **sin redondear**. El editor, el informe y
  el Excel recalculan con el promedio **redondeado a 0.1″** (`averageOf` en
  `polygonal-draft.ts:61-66`).
- **Evidencia:** en Vivero, con las lecturas [x, x+1″, x+1″], el error
  guardado es −0.7″ y el editor muestra −0.5″. Cerca del límite el veredicto
  cambia: con −33.67″ frente a −33.50″ y una tolerancia de 33.54″, el editor
  pinta verde y el cierre rechaza.
- **Por qué importa:** pasa en casi todo proceso con reiteración, porque el
  mínimo son tres lecturas.
- **Arreglo:** una sola función de promedio en los dos caminos.

**C-5 · MEDIA · verificado — una lectura con coma decimal desaparece en el editor.**
`polygonal-draft.ts:38` y `angles.ts:111-113` usan `Number()`.

- «12,5″» da `NaN` y la lectura sale del promedio y de la dispersión; el
  servidor sí la cuenta (usa `parseNumber`).
- Con 12,5 / 14 / 15, el editor promedia 14.5″ y el servidor guarda 13.8″.
- **Arreglo:** `parseNumber` en los dos sitios.

**C-6 · MEDIA · verificado — el promedio no maneja el paso por 0°/360°.**
`actions.ts:122-131`, `polygonal-draft.ts:61-66`, `polygonal.ts:36-40` y
`validators/polygonal.ts:288`.

- 359°59′56″, 0°00′02″ y 0°00′06″ promedian **120°00′01″**.
- La dispersión avisa, pero el ángulo entra igual en el cálculo.
- Exige un ángulo de orientación cerca de 0°: es raro pero posible.
- **Arreglo:** desenvolver cada lectura respecto a la primera antes de
  promediar, y calcular la dispersión igual.

**C-7 · MEDIA · reportado — mínimos cuadrados no converge por un umbral demasiado fino.**
`least-squares.ts:78` y `:107`.

- **Qué pasa:** se exige un cambio menor que 10⁻¹⁰ σ entre iteraciones, y el
  ruido de coma flotante se queda en 1.3·10⁻¹⁰ σ.
- **Efecto:** en un 0–4 % de abiertas con control aleatorias, el resultado es
  «no converge», sin coordenadas, aunque las condiciones ya cumplen a 10⁻¹³ m.
- **Arreglo:** umbral de 10⁻⁸ σ, o dar por convergido cuando el cambio se
  estanca y las condiciones cumplen.

**C-8 · BAJA · verificado — el «control de reorientación» siempre da 0.**
`polygonal.ts:231-242`.

- Se calcula con los ángulos ya corregidos, así que es una tautología.
- Con los crudos sería exactamente el error angular: no aporta un control
  independiente.
- El manual lo presenta como control de calidad.

**C-9 · BAJA · reportado — «sistema singular» falso con σ extremas.**
`least-squares.ts:58`.

- Una σ angular de 0.01″ con una σ de distancia de 0.5 m —valores que el
  validador admite— da «singular».
- **Causa:** el pivote relativo mezcla radianes con metros.
- **Arreglo:** escalar la matriz normal antes de resolver.

### Nivelación

**C-10 · ALTA · verificado — en una cerrada o de enlace con vuelta, el cierre de la vuelta no se juzga.**
`leveling.ts:381-410` y `validators/leveling.ts:431-444`.

- **Qué pasa:** el motor calcula el error de la vuelta (`returnErrorMm`), pero
  el cierre solo juzga el de la ida y la discrepancia. En dos lazos, la
  discrepancia es |e_ida + e_vuelta|, así que dos errores de signo contrario
  se cancelan.
- **Ejemplo (segundo orden, T = 5.69 mm):**
  - la ida cierra en −5.0 mm y cumple;
  - la vuelta cierra en +12.0 mm, el doble de la tolerancia;
  - la discrepancia es 7.0 mm, menor que 8.05 mm, así que se cierra como
    «cerrado» sin un solo aviso.
- **El marco teórico (§ 2.5-2.6)** juzga el circuito promediado, (e_ida −
  e_vuelta)/2 = −8.5 mm, que no cumple.
- **Arreglo:** juzgar contra K·√D el cierre de cada recorrido, o el del
  circuito promediado.

**C-11 · MEDIA · verificado — una distancia por visual negativa o en cero pasa la validación.**
`validators/leveling.ts:111-121` solo rechaza la distancia vacía, y la base no
tiene CHECK. El comentario de `leveling.ts:23-26` dice lo contrario.

- Una V− de −50 m deja D = 0.1 km en vez de 0.2, y la tolerancia baja de 5.37
  a 3.79 mm sin ningún aviso.
- Con 0 m la tolerancia queda nula: el editor dice que se puede cerrar y el
  servidor lo rechaza.
- **Arreglo:** error de captura si d ≤ 0, CHECK en la base, y lo mismo en el
  lector CSV.

**C-12 · MEDIA · verificado — la vuelta no pasa la comprobación aritmética.**
`leveling.ts:422` devuelve solo la de la ida.

- La Fase 24 cubrió el punto de cambio incompleto en los dos recorridos, pero
  no un `bm` interior con solo V+ en la vuelta.
- **Efecto:** sale una discrepancia de 300 mm y «rechazado», en vez del motivo
  real.
- **Arreglo:** exigir también la comprobación de la vuelta.

**C-13 · BAJA · reportado — un cierre exactamente igual a la tolerancia lo decide la coma flotante.**
`leveling.ts:337/341` y `:397`.

- En una cerrada de 1 km, con E = 12.0 mm y T = 12.0 mm, el veredicto
  depende de la cota del BM: con 100 da «no cumple» (E = 12.000000000000455)
  y con 1000 da «cumple».
- Exige que K·√D sea exacto, así que es raro.
- **Arreglo:** el error en enteros de 0.1 mm (las lecturas tienen 4
  decimales).

**C-14 · BAJA · verificado — «Dist acum» en coma flotante** (ya en la § 11).

- 164.5 m se guardan como 0.164 km.
- **Arreglo:** redondear cada distancia a milímetros y sumar en enteros.
- El revisor añade que la columna, en km con 3 decimales, tiene una
  resolución de 1 m, más gruesa que el dato.

### Asentamientos

**C-15 · ALTA · verificado — se puede cerrar una visita con la anterior abierta.**
`validators/settlement.ts:181-230`.

- **Qué pasa:** el parcial, la velocidad y la alerta de una visita se miden
  contra la lectura anterior de cada punto. Esa lectura sigue editable si su
  visita está abierta. El cierre solo protege la línea base de los puntos sin
  C0.
- **Efecto:** con v0 cerrada y v1 abierta, se cierra v2. Al corregir después
  v1 de 99.9950 a 99.9995 m, el parcial de v2, ya cerrada, pasa de −5.0 a
  −9.5 mm y la alerta de «alerta» a «alarma». Lo muestran el panel, el
  informe y el Excel.
- La base conserva «alerta», así que el hub y el panel divergen.
- **Arreglo:** no cerrar una visita si está abierta la visita que contiene la
  lectura anterior de cualquiera de sus puntos.

**C-16 · ALTA · verificado — la fecha de una visita abierta puede igualar la de otra o saltar por encima de una cerrada.**
`settlement/[siteId]/actions.ts:349-350` (guardar) y `:507-511` (cerrar).

- Solo se compara con la visita de fecha **estrictamente** anterior; no se
  mira la siguiente.
- **Efectos:**
  - v1 movida a la fecha de v2, ya cerrada: la velocidad de v2 pasa a vacía;
  - movida por encima de v2: el parcial de v2 pasa de −5.0 a −10.0 mm;
  - con fechas repetidas chocan claves internas y el orden de las visitas
    depende del orden de las filas.
- **Arreglo:** exigir anterior < fecha < siguiente, y `UNIQUE (site_id, date)`
  en la base.

### Común

**C-17 · BAJA · verificado — aviso de redondeo falso en la vista en grados decimales.**
`roundsOnStorage` (`angles.ts:133-136`) usa un umbral de 10⁻⁹°, pero la vista
muestra seis decimales. Basta con cambiar de vista para que avise «Se guarda
como…» en 32 000 de los 36 000 valores de una malla a 0.1″.

**C-18 · BAJA · reportado — el informe y el Excel pueden diferir 1 mm en una coordenada.**
`formatCoordinate` usa `toFixed(3)`, que en los empates .xxx5 redondea hacia
abajo casi la mitad de las veces; el formato de Excel redondea hacia arriba.
Afecta a cerca del 5 % de las coordenadas guardadas con cuatro decimales.

---

## 2. Criterios por decidir

Correctos como cálculo, pero son decisiones: sin fuente, o con una fuente
distinta de la que usa el código. Se ordenan por lo que cambian.

| # | Criterio | Hoy | Recomendación | Qué cambia |
|---|---|---|---|---|
| D-1 | **Desnivel adoptado en la compensación** (§ 11) | La ida se compensa con su propio cierre; la vuelta solo controla | **Sí debe entrar.** Ida y vuelta son dos observaciones del mismo desnivel; lo óptimo es compensar el lazo ida + vuelta, como dice el marco teórico (§ 2.5, § 4.5) | El Verjón: D4 sube +2.5 mm. En el tramo 2 de la demo, leído como lazo, cada punto sale con **dos cotas compensadas** que difieren hasta 5 mm. Necesita un método de corrección nuevo para que lo cerrado conserve el suyo |
| D-2 | Tolerancia ida-vuelta | K·√D_mín·√2 (marco teórico § 8.1) | Decidir la fuente. La FGCS juzga la ida contra la vuelta con K·√D, **sin √2** | La actual es un 41 % más laxa: El Verjón cumple en segundo orden con la actual (5.0 frente a 5.26 mm) y no con la FGCS (3.72) |
| D-3 | Equilibrado de visuales | 2/3/4/6 m por armada, sin fuente | Alinear con el marco (2/5/10 m) o con la FGCS (2/5/5/10/10 m), y añadir el **control acumulado** de la sección | El acumulado de El Verjón es +53.3 m en la ida y −52.2 en la vuelta: un error de colimación sesga los dos recorridos igual y la discrepancia no lo ve |
| D-4 | Aviso de equipo insuficiente | σ del equipo ≤ K | Compararlo con la tolerancia como error máximo, con el factor √2 de un ángulo y de un solo sentido. Para poligonal, por ejemplo, 2·√2·σ/√m > K | Con σ = K, la poligonal falla la tolerancia entre el 32 % y el 48 % de las veces; el aviso dice que el equipo alcanza |
| D-5 | Dispersión de lecturas | Rango > 2σ | Cuantil del rango de m lecturas: 3.64 / 4.12 / 4.40 σ para m = 2 / 3 / 4, al 99 % | Hoy avisa en el 35 %–58 % de datos correctos |
| D-6 | σ₀ de mínimos cuadrados | Banda [0.5, 2], sin fuente | **Prueba χ²** con su redundancia r (Ghilani): «σ₀ = 0.698 · r = 3 · χ² = 1.46 ≤ 7.81 (95 %) → consistente» | Con r = 3, un σ₀ de 1.61 ya es significativo y hoy se lee como consistente; abajo, «pesimista» sale el 14 %–22 % de las veces con pesos correctos |
| D-7 | Margen del aviso de tendencia | Fijo por orden (circuito de 250 m) | **Derivarlo de la longitud real** de los dos circuitos: m = K·√((Lₙ + Lₚ)/4), con un suelo de 1 mm. No hacerlo umbral editable: se acabaría ajustando para silenciar el aviso | Torre Alameda: de 6 a 2.8 mm. Una presa con 1.5 km: 10.4 mm, sin falsos avisos |
| D-8 | Promedio de asentamientos | Media de los acumulados de la visita | **Promedio encadenado**: el de la visita anterior más la media de los parciales de los puntos medidos en las dos | Igual sin altas ni bajas (Torre Alameda: 10⁻¹⁵). Torre Central, visita 5: −16.69 mm en vez de −14.30 |
| D-9 | Distorsión angular | δ/L en todos los pares, un solo límite (1/500), fuera del semáforo | δ/L **sin el giro rígido** (la β de Skempton-MacDonald), solo entre puntos vecinos, cuatro niveles (marco § 4.1) y dentro del semáforo | Un edificio que se inclina en bloque deja de salir «excede»; un 1/140 pasa a pintar el semáforo |
| D-10 | «Acelerando» | Cualquier aumento de velocidad | Exigir un aumento mayor que el ruido, o una pendiente sobre tres o más velocidades | En Torre Alameda, TA-01 y TA-02 salen «acelerando» por ruido |
| D-11 | «Última visita» del panel | La última por fecha, aunque esté vacía | La última con lecturas | Al crear una visita, los KPI quedan en blanco |
| D-12 | C0 frente a la visita 0 | Se asume que la C0 es de la visita 0 | Exigir que los puntos originales tengan todos C0 o ninguno | Un par mixto mezcla periodos: δ = 10 mm donde es 0 |
| D-13 | BM de la visita | Se amarra a un BM, sin comprobar los otros | Avisar si la libreta no nivela entre BM-1 y BM-2 (marco § 2.3) | Un error en BM-2 movería todos los puntos de esas visitas |
| D-14 | Repeticiones del nivel digital (§ 11) | Se promedian y se redondean a 0.1 mm hacia arriba | Sirven para **control de calidad**, no para pesos: avisar de la dispersión, guardar la media con más resolución y redondear al par | El cierre del crudo es −0.35 mm exacto, −0.40 con el redondeo actual |
| D-15 | Georreferenciación | Rígida; el factor de escala solo se informa | Mantenerla rígida, pero el aviso de escala salta siempre en CTM12 (k₀ = 0.9992): explicarlo o restar el factor de la proyección | Residuo de (k−1)·L/2 en cada punto de control |
| D-16 | Precisión relativa mostrada | Redondea: 1:4999.6 → «1:5.000 — no cumple» | Truncar, que es lo conservador | Solo el texto |
| D-17 | Pesos de distancia en mínimos cuadrados | Un σ igual para todas | Usar el a + b·ppm del equipo y el centrado | Lados cortos: 1 mm de centrado sobre 11.6 m son unos 18″ |
| D-18 | Umbrales de terraplén y «otro» | Copian los de edificio | Buscar fuente o decirlo | — |

---

## 3. Documentación que contradice el código

| Dónde | Dice | El código |
|---|---|---|
| Manual (dos copias), `types/leveling.ts:26-28`, `validators/leveling.ts:58-60`, PRD de la Fase 4 (decisión 7) | Las intermedias quedan fuera de la compensación | Se compensan con la corrección de su armada (la doc técnica § 6 sí lo dice bien) |
| Cabecera de `polygonal.ts:4-9` y `docs/math/poligonales.html` | Azimut = anterior + 180° − ángulo | + 180° + ángulo desde la Fase 7 |
| `PRD-TopoField.md` § 6.5 | Crandall con Σcos²/d y δd = k₁cos + k₂sin | Esa formulación no cierra (−140 mm en TT4); el código usa la clásica, que es la correcta |
| Doc técnica § 6 y PRD de la Fase 7 | La regla del +360 | Es la de C-1 |
| Doc técnica § 6 (umbral de cierre exacto) | 10⁻⁹ m en todos los tipos | Solo en la cerrada |
| Doc técnica § 7 | «Nada convierte texto con `Number()`» | Ver C-5 |
| PRD de la Fase 15 | El veredicto se compara «con el guardado» | Compara dos recálculos |
| `tolerances.ts:43-44` | n = número de estaciones | n = ángulos que entran en la condición |
| `tolerances.ts:57` | 6 mm·√D es segundo orden clase II (FGCS) | En la FGCS es clase I |
| `leveling.ts:298-303` | `distanceAccumulatedKm` sin validar | Se deriva desde la Fase 9 |
| PRD § 6.9 | El desnivel adoptado solo si la discrepancia cumple | Se calcula siempre |
| `settlement.ts:258`, PRD § 6.10, PRD de la Fase 5, doc técnica § 6 | Con L = 0 la distorsión se leería como «normalidad perfecta» | Se leería como 1/0: **falsa alarma**. La exclusión es correcta; el motivo, no |
| Doc técnica § 11 y manual | El promedio lo mueven las altas | También las bajas |
| `panel-tab.tsx`, doc técnica § 11 | Las visitas cerradas conservan su clasificación | El panel, el informe y el Excel las recalculan (C-15) |
| Manual § 7.3 y § 7.6 | «La visita 0 no tiene asentamiento»; borrar una intermedia cambiaría la siguiente | Falso si C0 ≠ visita 0 (D-12); editarla o moverla de fecha también la cambia (C-15, C-16) |
| `docs/carteras/analisis-*.md` | El Verjón «no cumple» en segundo orden; T = 10.03 mm en el crudo; mínimos cuadrados con «los mismos pesos» | El motor dice que cumple; T = 14.18 mm; el análisis usó un σ de distancia sin √2 y su tabla está rotada una estación |

---

## 4. Errores en el material de referencia

Para la monografía, no para el código.

| Documento | Error |
|---|---|
| `docs/marco-teorico/mt-poligonales.docx`, caso 1 | El azimut de C debería ser 116°45′ + 180° − 112°00′ = **184°45′**; la tabla dice 188°45′, y los que siguen arrastran el error. La tabla da ΣΔN = −74.06 m y el texto 0.074 m. Define «precisión = error / perímetro» (es perímetro / error, 1:P) |
| `TRABAJO NIVELACION EL VERJON-corregido.xlsx`, hoja «CIERRE CORREGIDO» | Juzga con min(K·√D) sin √2 y compensa la ida con la discrepancia entera: D4 queda en 3315.088, cuando lo teórico es 3315.0855 |
| `Ajuste_Poligonal_Minimos_Cuadrados-corregido.xlsx`, hoja «AJUSTE CORREGIDO» | La matriz A está desplazada un lado. Recalculada, deja ΣΔN = +0.25 mm y ΣΔE = −0.21 mm y no cumple su propio bloque de verificación |
| Marco teórico de nivelación | Las clases por orden están corridas una respecto a la FGCS |

El test «caso de estudio del marco teórico» pasa a pesar del error del caso 1:
solo comprueba que las proyecciones corregidas sumen cero.

---

## 5. Confirmado correcto

**Ángulos**

- `decimalToDms`: 2 millones de valores frente a una implementación
  independiente, sin diferencias. Ida y vuelta exacta en la malla completa a
  0.1″. Nunca devuelve 60′ ni 60″.
- Azimut desde coordenadas: 200 000 casos frente a una fórmula por
  cuadrantes, sin diferencias.

**Poligonal**

- Bowditch, Tránsito y Crandall (este, frente a una minimización
  independiente).
- Abierta con control por deflexiones.
- Mínimos cuadrados: el modelo de condiciones, v = −QAᵀ(AQAᵀ)⁻¹w y σ₀ con r =
  n − u. Coinciden con un ajuste paramétrico propio en Vivero, con 180
  cerradas y con 120 abiertas aleatorias, a 10⁻¹² m.

**Nivelación**

- Altura instrumental, intermedias, comprobación aritmética, estadimetría sin
  cos² y compensación −E·d/D desde el origen, con su signo.
- El Verjón y el crudo del tramo 2, exactos.
- El equilibrado por armada coincide con el cálculo independiente.

**Asentamientos**

- Parcial y acumulado en mm, con negativo = descenso; velocidad en días
  reales entre 30.4375.
- `classifyAlert`: 0 discrepancias en 112 lecturas.
- δ/L, el periodo común de las altas y la libreta de la visita, con la
  intermedia compensada a la distancia de su armada.

**Georreferenciación**

- Rígida y correcta.
- Los residuos en los dos puntos son iguales, opuestos y de (k−1)·d/2.
- Los puntos coincidentes se rechazan.

**Común**

- Unidades coherentes en cada uso de cada constante.
- `parseNumber`: «1.234» y «1,234» valen 1.234, y «1.234,5» es inválido.

**Tests**

- Los valores esperados vienen de las hojas o de cálculos a mano, no copiados
  del motor.
- Son débiles en Tránsito y Crandall sobre TT4, en la reorientación y en el
  pentágono.
- Faltan exteriores con fila de cierre, abiertas con amarre y lecturas en
  torno a 0°/360°.

---

## 6. Tolerancias y su fuente

| Constante | Valor | Fuente | Nota |
|---|---|---|---|
| `ANGULAR_TOLERANCE_K` | 1/5/15/30 ″·√n | Marco teórico de poligonales § 8 | FGCS: 1.7/4.5/12 ″·√N |
| `MIN_RELATIVE_PRECISION` | 1:100 000 / 20 000 / 5 000 / 3 000 | Marco § 8 | Coincide con la FGCS en tres órdenes |
| `LEVELING_TOLERANCE_K` | 3/6/12/24 mm·√D | Marco de nivelación § 8 | Clases corridas frente a la FGCS (3/4/6/8/12) |
| Ida-vuelta | K·√D_mín·√2 | Marco § 8.1 | La FGCS no lleva √2 (D-2) |
| `SIGHT_BALANCE_LIMIT_M` | 2/3/4/6 m | Sin fuente | Marco 2/5/10; FGCS 2/5/5/10/10 (D-3) |
| `READING_DISPERSION_FACTOR` | 2·σ | Criterio propio | Estricto (D-5) |
| `SIGMA0_BAND` | [0.5, 2] | Sin fuente | No equivale a χ² (D-6) |
| Equipo suficiente | σ ≤ K | Sin fuente | Indulgente (D-4) |
| `TREND_DEVIATION_REFERENCE_KM` | 0.25 | Decisión de la Fase 12 | Equivale a un circuito de 0.5 km (D-7) |
| Velocidad | 2/5/10 mm/mes | Marco de asentamientos § 4.1 | Coincide |
| Acumulado, edificio y presa | 25/50/75 y 10/25/50 mm | Marco § 4.1 | Coincide; terraplén y «otro» sin fuente |
| Distorsión angular | 1/500 | Marco § 4.1 (Eurocódigo 7) | Coincide |
| `CALIBRATION_MAX_MONTHS` | 12 | Práctica | La ISO 17123 no fija plazo |
| `DAYS_PER_MONTH` | 30.4375 | Decisión documentada | Correcta |

Fuente externa: FGCC (1984), *Standards and Specifications for Geodetic
Control Networks*. La página de NGS no respondió; los valores de nivelación
se tomaron de sus resúmenes y los de poligonal de segundo y tercer orden, de
memoria del revisor. **Conviene confirmarlos antes de citarlos.**
