# PRD-de-fase 32 — Rigor estadístico

**Estado:** cerrada
**Fecha de apertura:** 2026-10-02
**Fecha de cierre:** 2026-10-02

**Rama:** `fase-32-rigor-estadistico`
**Petición:** del usuario, 2026-10-02: «Quiero abrir la Fase 32 con CR3. […]
Para cada criterio, consulta la norma (FGCS 1984 u otra fuente) y dime si de
verdad hace falta antes de proponer cómo corregirlo.» Es CR3 de
`pendientes.md`, que reúne tres criterios de la auditoría del cálculo: D-3,
D-6 y D-7. Tras la consulta, el usuario eligió la recomendación en los tres.
**Módulo:** nivelación (y la libreta de la visita), poligonal por mínimos
cuadrados y control de asentamientos — avisos y lecturas estadísticas

> **Divergencias de la implementación:**
>
> - **«Acelerando» con su propio margen, de tres cotas** (hallazgo 4 y
>   decisión 10). Lo halló la revisión de código: el margen de una sola
>   diferencia daba hasta un 13 % de falsos con circuitos cortos. Lo eligió el
>   usuario frente a dejarlo documentado. Ningún punto de la demo ni del seed
>   cambia de etiqueta.
> - **Margen de coma flotante en el equilibrado.** `35.2 − 30.2` da
>   5.0000000000000036: con el límite nuevo de 5 m, una armada justo en el
>   límite avisaba. Las dos comparaciones llevan 10⁻⁹ m, con su test de
>   frontera.
> - **Un BM con V− cierra su sección aunque su armada no exista** (al punto
>   anterior le falta la V+, en una captura a medias). Lo halló la revisión:
>   la sección seguía abierta y sumaba la siguiente.
> - **El intervalo de σ₀ va con tres decimales**, como σ₀ («entre 0.268 y
>   1.765»), y r va en la frase de debajo, no en la fila de σ₀. Con dos
>   decimales, un σ₀ de 1.766 salía «peor» junto a «entre 0.27 y 1.77».
> - **`visitCircuitsOf`**, un ayudante que el PRD no nombraba: lee el circuito
>   de las filas de la base con el `Number()` de la DECIMAL. La redundancia
>   pasa a tipo `2 | 3`.
> - **El PRD principal no tiene σ₀ en § 6**: nunca describió mínimos
>   cuadrados. Se actualizaron § 5.1, § 5.3, § 5.4 y § 6.10.
> - **Arreglos de documentación de fases anteriores**, encontrados en el
>   barrido:
>   - la tabla de estado de fases de la doc técnica seguía en la 25;
>   - la § 9 decía 994 tests y 67 pruebas de base;
>   - `nivelacion.html` atribuía a la ISO 17123-2 un «aviso de equipo» que
>     quitó la Fase 31.
> - **La auditoría** deja confirmadas sobre el PDF de NGS las cifras de
>   nivelación de la FGCS (cierre, equilibrado y colimación).
> - **Capturas:** solo la 21 (σ₀ con r y su intervalo). Ninguna captura
>   muestra los avisos de equilibrado.
> - **Verificación en pantalla** en local, con `db reset` y seed, a 1280 px en
>   claro y a 390 px en oscuro: 25 comprobaciones, repetidas con el código
>   final. Sin desborde y sin errores de la app; solo el aviso de `eval()` del
>   modo de desarrollo.
> - **Pruebas que el PRD pedía y no tienen test propio:** «P-04 de Torre
>   Central igual que hoy». Lo cubren el test de dos visitas sin libreta (el
>   margen de antes) y la verificación en pantalla.
> - **Revisión de código:** un importante, el margen de «Acelerando», y
>   menores; todos aplicados salvo un detalle de estilo: el tipo `2 | 3` se
>   repite en `types/polygonal.ts` y en `Redundancy`.
> - **Consulta de producción** (solo lectura, `db query --linked`): todos los
>   datos que estos criterios tocan son de la demo, iguales a los verificados
>   en local.
>   - Visitas: solo las 14 de Torre Alameda, con libreta, cerradas, de 0.111 a
>     0.113 km y en tercer orden. El margen baja de 6.0 a 2.8 mm, sin avisos ni
>     «Acelerando».
>   - Nivelaciones: El Verjón y el tramo 2, con las mismas sumas de distancias
>     que las carteras (+53.3 / −52.2 m y +1.4 m). El Verjón pasa a 5 avisos
>     por armada y 2 de acumulado.
>   - Mínimos cuadrados: solo la Vivero, que sigue consistente.
> - **Producción, pendiente:** el merge. Sin `db push`.

## Propósito

Tres criterios que hoy son decisiones sin fuente, o con una fuente mal
aplicada:

| # | Qué | Hoy | Decisión |
|---|---|---|---|
| D-3 | Equilibrado de visuales | 2/3/4/6 m por armada, sin fuente; sin control del acumulado | **La norma**: 2/5/10/10 m por armada y 4/10/10/10 m acumulados por sección |
| D-6 | Lectura de σ₀ | Banda [0.5, 2] sobre σ₀: con pesos correctos juzga mal el 15–24 % de los ajustes | **Prueba χ² bilateral al 95 %** con la redundancia r |
| D-7 | Margen de la lectura fuera de tendencia y de «Acelerando» | Fijo por orden: un circuito de referencia de 0.5 km | **La longitud real del circuito de cada visita** |

Todo se calcula en vivo. **Nada guardado cambia**: no hay migración, y lo
cerrado conserva sus resultados.

## Hallazgos que condicionan la fase

Las fuentes se leyeron en el original; las tablas, en la imagen de la página.

### 1. La norma del equilibrado (D-3)

FGCC (1984), *Standards and Specifications for Geodetic Control Networks*,
§ 3.5, «Field procedures», p. 3-7. NOAA Manual NOS NGS 3, *Geodetic Leveling*
(Schomaker y Berry, 1981), tabla 3-1, p. 3-7, da las mismas cifras:

| | 1.º I | 1.º II | 2.º I | 2.º II | 3.º |
|---|---|---|---|---|---|
| Diferencia de visuales por armada («per setup») | 2 m | 5 | 5 | 10 | 10 |
| Diferencia acumulada por sección («per section») | 4 m | 10 | 10 | 10 | 10 |
| Cierre de sección | 3 mm·√D | 4 | 6 | 8 | 12 |
| Colimación máxima | 0.05 mm/m | 0.05 | 0.05 | 0.05 | 0.10 |

- **Correspondencia con la app, por su K:** primer orden (3 mm) es el 1.º I;
  segundo (6 mm), el 2.º I; tercero (12 mm), el 3.º. **Ordinario (24 mm) no
  está en la norma.**
- **El marco teórico** (`mt-nivelaciones_precision`, § 7) da 2, 5 y 10 m por
  armada en primer, segundo y tercer orden: coincide. No trata el acumulado.
- **Una sección** es «an unbroken series of setups, made between two
  permanent control points» (NGS 3, § 3.1.1): de BM a BM.
- **Por qué el acumulado.** NGS 3 lo explica (§ 3.1.2 y § 5.5.2): el error de
  colimación de una sección es −C·ΣΔs, proporcional al desequilibrio
  **acumulado**, no al de cada armada. Pide además que el anotador avise «as
  soon as the total imbalance for the section exceeds the tolerance» para
  corregirlo sobre la marcha (§ 3.5.2).

**En El Verjón** (tercer orden), el acumulado es +53.3 m en la ida y −52.2 m
en la vuelta. La ida y la vuelta se sesgan igual: la discrepancia (5.0 mm) no
lo ve, y el desnivel adoptado lo arrastra. Con la colimación máxima del tercer
orden (0.10 mm/m), el sesgo llega a 5.3 mm, frente a una tolerancia K·√D de
7.4 mm.

| Datos | Avisos por armada hoy (2/3/4/6) | Con la norma (2/5/10/10) | Acumulado |
|---|---|---|---|
| El Verjón, ida | 6 | 4 (C 1 → C 2, C 2 → C 3, C 3 → C 4, C 7 → D3) | +53.3 m: **avisa** |
| El Verjón, vuelta | 6 | 1 (C 1 → D1, 19.7 m) | −52.2 m: **avisa** |
| Tramo 2 | 2 | 0 | +1.4 m: no avisa |
| Libretas de Torre Alameda | 0 | 0 | 1.3 m como máximo: no avisa |

En todos estos datos la sección es el recorrido entero: El Verjón y el tramo 2
solo tienen BM en los extremos (D3 es punto de cambio), y la libreta de una
visita sale del amarre y vuelve a él (el otro BM entra como intermedia).

### 2. La norma de σ₀ (D-6)

- **La FGCS** solo pide revisar los pesos «by inspecting the postadjustment
  estimate of the variance of unit weight» (p. 3-8). Ni cifra ni prueba.
- **Ghilani y Wolf**, *Adjustment Computations* (4.ª ed., § 5.4 y § 16.7): la
  prueba χ² bilateral sobre S₀², con χ² = r·S₀²/σ². Advierte que es «a warning
  flag for an adjustment that requires further analysis, not as an indicator
  of bad data» (§ 25.3).
- **USACE EM 1110-2-1009** (2018), § 9-5.h(5): «The computed a posteriori
  variance factor should pass the Chi-square test»; si no pasa con un valor
  menor de 0.5 o mayor de 2.0, se revisan los pesos. El nivel es el 95 %
  (§ 9-2.g(6)). **Esa banda es sobre el factor de varianza σ₀², no sobre σ₀**:
  la app la aplica a σ₀, que equivale a [0.25, 4] en σ₀².

**Ninguna banda fija sirve con r = 2 o 3**, que es lo que da siempre una
poligonal (3 condiciones, o 2 sin azimut de llegada). Con pesos correctos:

| r | Juzga mal la banda de hoy | Juzgaría mal la de USACE, bien aplicada | χ² al 95 %: σ₀ aceptado |
|---|---|---|---|
| 2 | 24 % | 53 % | 0.16 a 1.92 |
| 3 | 15 % | 43 % | 0.27 a 1.77 |

La χ² depende de r y se equivoca el 5 % de las veces por construcción.
Valores críticos (bilaterales, 95 %): χ²(r = 2) = 0.0506 y 7.3778; χ²(r = 3) =
0.2158 y 9.3484. Comprobados contra los de Ghilani (r = 12: 4.404 y 23.337).

**Vivero** (σ₀ = 0.698, r = 3) sigue saliendo consistente; el caso de la guía
e2e con σ₀ = 0.004, pesimista.

### 3. La norma del margen (D-7)

- **USACE EM 1110-2-1009** (2018), § 2-3.b(4): un desplazamiento es
  significativo si |d| > 1.96·√(σ_f² + σ_i²), con el error típico de cada
  época. El 95 % es el nivel «usually accepted for the assessment of
  deformation measurements» (§ 9-2.g).
- **NGS 3**, § 3.1.3: las tolerancias de cierre son límites al 95 %.

Con eso, el margen sale de la tolerancia de cada circuito. Si K·√L es el
límite al 95 % del cierre de un circuito de L km, σ_km = K/1.96. La cota de un
punto compensado a x km del arranque tiene σ² = σ_km²·x(L − x)/L, como mucho
σ_km²·L/4, a mitad de circuito. Entre dos visitas:

```
m = 1.96 · √(σₙ² + σₚ²) = ½ · √(Tₙ² + Tₚ²),   T = K · √L de cada visita
```

Con el mismo orden en las dos, m = K·√((Lₙ + Lₚ)/4): la fórmula de la
auditoría, ahora con fuente. **El margen de hoy, K·√0.25, es este mismo con
dos circuitos de 0.5 km.**

| Caso (tercer orden) | Margen hoy | Margen nuevo |
|---|---|---|
| Torre Alameda: circuitos de 0.112 km | 6.0 mm | 2.8 mm |
| Mismo circuito en primer orden | 1.5 mm | 0.7 mm |
| Circuitos de 1.5 km (una presa) | 6.0 mm | 10.4 mm |
| Visitas sin libreta (Torre Central del seed) | 6.0 mm | 6.0 mm |

- **La longitud ya se guarda:** `settlement_visits.total_distance_km`, desde
  la Fase 18, es el perímetro del circuito de la libreta. En captura directa
  queda en null.
- **En la demo no cambia nada.** Torre Alameda no da ningún aviso de tendencia
  ni con 6.0 ni con 2.8 mm, y ningún punto acelera (TA-02, el que más crece:
  0.54 mm/mes frente a un umbral de 3.09). **No hay serie real** de
  asentamientos para medir avisos falsos: la de Torre Alameda es sintética,
  con un ruido de ±0.4 mm.
- **Sin suelo.** La auditoría proponía no bajar de 1 mm. No tiene fuente, y
  el margen sale de la misma tolerancia con que la app juzga el cierre de ese
  circuito, que no tiene suelo.

### 4. El margen de «Acelerando» (hallado en la revisión de código)

«Acelerando» (Fase 31) compara dos velocidades: |v₂| − |v₁| > m/Δt₂. Pero
v₂ − v₁ = (h₃ − h₂)/Δt₂ − (h₂ − h₁)/Δt₁ depende de **tres** cotas, y con
intervalos iguales su ruido es √6·σ. El margen de una sola diferencia, m, solo
cubre √2·σ: el umbral queda en 1.13 σ, y con velocidad constante sale un
«Acelerando» falso en hasta el 13 % de los puntos, si el trabajo tiene justo
la precisión de su orden. Con el margen fijo de 6 mm, en los circuitos de
0.112 km de Torre Alameda, era el 0.8 %: el fallo venía de la Fase 31, y esta
fase lo agrava al bajar el margen.

El margen de «Acelerando» sale del mismo criterio de USACE, con las tres
cotas:

```
margen = ½ · √(T₁²/Δt₁² + T₂²·(1/Δt₁ + 1/Δt₂)² + T₃²/Δt₂²)   [mm/mes]
```

con T la tolerancia del circuito de cada visita. Con todo igual es √3 veces
m/Δt. Los falsos bajan al 2.5 % como mucho.

| Caso | Umbral de la Fase 31 (m/Δt) | Con tres cotas |
|---|---|---|
| Torre Alameda, últimas tres visitas | 3.09 mm/mes (6.52 antes de esta fase) | 5.35 mm/mes |
| Torre Central, P-04 (sin libreta) | 5.89 mm/mes | 10.37 mm/mes |

Ningún punto de la demo ni del seed cambia de etiqueta: TA-02 crece 0.54
mm/mes, y P-04 5.75.

## Alcance

### A. D-3: el equilibrado con la norma

- `tolerances.ts`:
  - `SIGHT_BALANCE_LIMIT_M` pasa a 2 / 5 / 10 / 10 m, con la fuente en el
    comentario.
  - `SECTION_BALANCE_LIMIT_M`, nueva: 4 / 10 / 10 / 10 m.
  - Ordinario toma los límites del tercer orden, los más laxos de la norma, y
    el comentario lo dice.
- `validators/leveling.ts`, junto a `validateSightBalances`, el acumulado de
  la sección:
  - Σ(d_V+ de la armada − d_V− de la armada), solo con armadas completas;
  - empieza en una fila BM con V+ y se juzga en la siguiente fila BM con V−,
    o en la última armada del recorrido;
  - en un recorrido a medias, esa última armada es la que se está
    capturando, así que avisa en cuanto el acumulado pasa el límite, como pide
    NGS 3;
  - avisa si |Σ| > límite (estricto), en la fila que cierra la sección;
  - no se evalúa con distancias reconstruidas, igual que por armada;
  - ida y vuelta, cada una con sus secciones.
- Un aviso nuevo en `ReadingCaptureIssues`: `sectionBalance`. Texto: «Sección
  D1 → D4: las visuales de atrás suman 53.3 m más que las de adelante; el
  límite acumulado del orden es 10 m.» Con el signo contrario, «las de
  adelante suman … más que las de atrás».
- `readings-table.tsx` lo pinta en la celda de la distancia V−, debajo del de
  la armada. Llega igual a la libreta de nivelación y a la de la visita, que
  comparten `validateRunCapture`.
- Avisa, no bloquea: como el aviso por armada.

### B. D-6: la prueba χ² de σ₀

- `least-squares.ts`:
  - fuera `SIGMA0_BAND`;
  - `SIGMA0_CHI2_95`, nueva: los valores críticos bilaterales al 95 % para
    r = 2 y r = 3, con su fuente;
  - `sigma0Interval(r)`: [√(χ²_inf/r), √(χ²_sup/r)];
  - `sigma0Reading(sigma0, r)`, con las mismas tres lecturas de hoy:
    consistente, peor de lo supuesto y pesimista.
- `results-panel.tsx`: «σ₀ 0.698 · r = 3» y la explicación con el intervalo
  de su r: «Con 3 condiciones, la prueba χ² al 95 % espera σ₀ entre 0.27 y
  1.77». Los tres textos de la lectura no cambian.
- El informe y el Excel siguen mostrando solo σ₀.

### C. D-7: el margen con la longitud de cada circuito

- `tolerances.ts`:
  - `TREND_DEVIATION_REFERENCE_KM` (0.25) se sustituye por
    `DIRECT_CAPTURE_CIRCUIT_KM` (0.5): el circuito que se supone a una visita
    sin libreta;
  - `trendDeviationMargin(anterior, actual)` recibe el orden y la longitud de
    cada visita y devuelve ½·√(Tₐ² + Tₙ²).
- `settlement.ts`:
  - `detectTrendDeviations` y `computeTrends` reciben, por visita, su orden y
    su longitud (`{ order, km }`) en lugar de solo el orden;
  - el margen de una lectura es el del par de visitas que forman su parcial;
  - el de «Acelerando», `accelerationMargin`, el de las tres visitas de sus
    dos últimas velocidades (hallazgo 4).
- **Los llamadores** pasan la longitud guardada (`total_distance_km`):
  - el panel;
  - la vista de la visita;
  - el Excel;
  - el editor de la visita, que para la visita en edición la calcula en vivo
    de su libreta (`totalDistanceFromReadings`) y la deja en null en captura
    directa.
- Una visita sin longitud o con longitud 0 usa los 0.5 km.

### D. Documentación

- **Manual, en sus dos copias:**
  - el equilibrado: límites nuevos, el acumulado de la sección y por qué;
  - σ₀: la prueba con su r, en lugar de «entre 0.5 y 2»;
  - el margen de la lectura fuera de tendencia y de «Acelerando»: depende del
    orden y de la longitud del circuito de las dos visitas;
  - las capturas que cambien.
- **`docs/math/nivelacion.html`**, § 8: los límites con su fuente y el
  acumulado, sin la nota de «pendiente (CR3)». Si el ejemplo 1 da algún aviso,
  se dice.
- **PRD principal:** § 5.4 (tolerancias), σ₀ en § 6 y la tendencia (§ 6.11).
- **Doc técnica:**
  - tolerancias, validación, el motor de asentamientos y σ₀;
  - la tabla de pruebas;
  - la § 11, entrada por entrada: el margen de referencia, la banda de σ₀ y
    el equilibrado.
- **Auditoría:** D-3, D-6 y D-7 resueltos, y la tabla de la § 6 (tolerancias
  y su fuente).
- **`pendientes.md`:** CR3 se cierra. No queda ningún criterio de la § 2 por
  decidir.
- **Guías e2e:**
  - nivelación: el aviso de C 1 → D1 dice 10 m, y aparecen los dos avisos de
    acumulado;
  - poligonal: σ₀ con su r y su intervalo;
  - asentamientos: comprobar que nada cambia (Torre Central es de captura
    directa).

## Decisiones del usuario (apertura)

1. **D-3, la norma completa:** por armada y acumulado por sección, con
   ordinario igual que el tercer orden.
2. **D-6, la prueba χ² al 95 %**, con r a la vista.
3. **D-7, la longitud real, sin suelo**, con 0.5 km para las visitas sin
   libreta.
4. **«Acelerando», con el margen de tres cotas** (hallazgo 4), tras la
   revisión de código. La otra opción era dejarlo y documentar que es más
   sensible que el aviso de lectura fuera de tendencia.

## Decisiones

| # | Decisión | Razón |
|---|---|---|
| 1 | Ordinario toma los límites del tercer orden | No está en la norma. El más laxo de la norma es lo conservador, y no deja un orden sin control |
| 2 | La sección va de BM a BM, o hasta la última armada | Es la definición de NGS 3. En un recorrido abierto o a medias no hay BM al final, pero el sesgo se acumula igual |
| 3 | El acumulado se juzga en vivo | NGS 3 pide avisar en cuanto se pasa el límite, para corregirlo en las armadas siguientes |
| 4 | Sin la corrección de colimación −C·ΣΔs | Necesita la C medida (la prueba de las dos estacas), que la app no captura. Se avisa; no se corrige |
| 5 | Solo r = 2 y r = 3 en la tabla de χ² | Son las únicas redundancias que da una poligonal. Una función general de cuantiles sería código sin uso |
| 6 | El nivel, 95 % | El de USACE para ajustes y deformaciones, y el de las tolerancias de NGS 3: un solo nivel en toda la app |
| 7 | Cada visita con su orden y su circuito | USACE usa el σ de cada época. Hoy se usaba solo el orden de la última |
| 8 | 0.5 km para una visita sin libreta | Deja igual que hoy a las visitas en captura directa, que no tienen longitud |
| 9 | La longitud guardada, no recalculada de la libreta | `total_distance_km` ya está en la fila de la visita y es la misma cifra: el guardado la saca de la libreta. El panel y el Excel no necesitan cargar las libretas |
| 10 | «Acelerando» con su propio margen, de tres cotas | Compara dos velocidades, que dependen de tres cotas. El margen de una diferencia lo dejaba con un 13 % de falsos en circuitos cortos (hallazgo 4) |

## Pruebas

| Qué | Cómo |
|---|---|
| D-3 por armada | Los límites nuevos: la ida y la vuelta de El Verjón avisan exactamente en las armadas de la tabla del hallazgo 1; frontera estricta |
| D-3 acumulado | El Verjón: +53.3 m en la ida y −52.2 m en la vuelta, con el texto y el signo; el tramo 2 no avisa; se reinicia en un BM intermedio; un recorrido a medias avisa en su última fila; con distancias reconstruidas no se evalúa; frontera estricta |
| D-3 libreta de visita | `validateVisitBook` lleva el aviso de acumulado (una libreta sintética desequilibrada) |
| D-6 | `sigma0Interval(2)` y `sigma0Interval(3)` con los valores del hallazgo 2; Vivero consistente; 1.8 con r = 3, «peor»; 0.2 con r = 3, «pesimista»; las fronteras |
| D-7 margen | Igual que hoy con dos visitas sin libreta; 2.8 mm con los circuitos de Torre Alameda; dos órdenes distintos; longitud 0 o null usa 0.5 km |
| D-7 avisos | Una lectura que hoy pasa con 6 mm y avisa con 2.8; Torre Alameda sin avisos ni «Acelerando»; P-04 de Torre Central igual que hoy |
| «Acelerando» | `accelerationMargin`: √3 veces el de una diferencia con todo igual, 4.92 mm con circuitos de 0.112 km, intervalos distintos; la frontera; un aumento que converge sin libreta y acelera con circuitos cortos; un punto que se salta una visita toma los circuitos de sus lecturas, no los de la visita saltada |

**En pantalla (local), claro y oscuro, 1280 y 390 px:**
- la libreta de El Verjón, ida y vuelta, con los avisos por armada y de
  acumulado;
- los resultados de la Vivero con σ₀, r y el intervalo;
- la visita y el panel de Torre Alameda, sin avisos.

## Criterios de aceptación

1. El equilibrado por armada avisa con 2 / 5 / 10 / 10 m, y el acumulado de
   cada sección con 4 / 10 / 10 / 10 m, en la libreta de nivelación y en la
   de la visita. Ninguno bloquea.
2. σ₀ se lee con la prueba χ² al 95 % de su r, que se muestra con el
   intervalo. Ninguna pantalla habla de la banda de 0.5 a 2.
3. El margen de la lectura fuera de tendencia sale del orden y del circuito de
   las dos visitas; el de «Acelerando», de los de sus tres visitas. Dos
   visitas sin libreta dan el margen de lectura de hoy.
4. En la demo y en el seed, ningún punto pasa a acelerar ni a salirse de
   tendencia.
5. Nada guardado cambia y no hay migración.
6. `npm run typecheck`, `npm run lint`, `npm test`, `npx supabase test db` y
   `npm run build` pasan limpios. El manual está en sus dos copias, con sus
   capturas, y la § 11 revisada.

## Fuera de alcance

- **La longitud máxima de visual** de la FGCS (50 / 60 / 90 m): no se pidió.
- **La corrección de colimación** (decisión 4).
- **Llevar r o la prueba al informe y al Excel:** siguen mostrando solo σ₀.
- **Los criterios de la § 2 que el usuario no eligió** (D-2, D-11, D-12,
  D-14 a D-18): quedan documentados, sin cambio.

## Riesgos

- **Más avisos de tendencia en edificios pequeños.** El margen baja a la
  mitad con circuitos de unos 100 m, y no hay serie real para medir los
  avisos falsos. Mitigación: el margen sale de la misma tolerancia con que la
  app acepta el cierre de ese circuito. Si el trabajo tiene la precisión de su
  orden, un aviso falso sale como mucho el 5 % de las veces (en la mitad del
  circuito; menos cerca del BM). Y el aviso no bloquea.
- **El Verjón gana dos avisos de acumulado** donde hoy da 12 por armada que
  no decían nada del sesgo. Es la corrección buscada: lo que avisa ahora es
  lo que sesga el resultado.
- **Un recorrido que pasa por un BM intermedio** parte el acumulado en dos
  secciones, cada una con su límite. Es la norma; ningún dato de la demo ni
  del seed lo tiene, y lo cubre un test.

## Tareas (en orden)

0. **Apertura:** este PRD, los estados en `method.md` y `prds/README.md`, y
   CR3 en curso en `pendientes.md`. Commit `docs:`. Rama.
1. **A** — el equilibrado con la norma y el acumulado, con sus tests.
2. **B** — la prueba χ² de σ₀, con sus tests.
3. **C** — el margen con la longitud de cada circuito, con sus tests.
4. **Verificación en pantalla** en local, con `db reset` y seed.
5. **Cierre:**
   - documentación: manual (dos copias) y capturas, `docs/math/nivelacion.html`,
     PRD principal, doc técnica, auditoría, guías e2e, `method.md`,
     `prds/README.md` y `pendientes.md`;
   - revisión de código y PR.
6. **Producción:**
   - una consulta de solo lectura: cuántas visitas tienen libreta y qué
     longitud, para saber cuánto cambia el margen en los datos reales;
   - el merge, que decide el usuario. Sin `db push`.
