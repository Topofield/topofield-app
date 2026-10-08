# PRD-de-fase 39 — Mínimos cuadrados: requisitos y precisión de cada punto

**Estado:** en curso
**Fecha de apertura:** 2026-10-08

**Rama:** `fase-39-minimos-cuadrados`, desde `fase-38-informe-por-proceso`
(la 38 está cerrada pero aún no ha entrado a `main`, y esta fase toca su
informe y su Excel).
**Petición:** del usuario, 2026-10-08, a partir de la duda de un usuario de la
app: «para la de mínimos no salen resultados porque necesitaría más lecturas
por puntos». Tras la explicación: «sí, esas consideraciones debemos tenerlas
en cuenta, parecen esenciales», con un texto sobre el ajuste de Gauss-Markov
(principio Σ w·v² = mín, pesos por la precisión del instrumento, elipses de
error). Pidió revisar las carteras de Excel antes de seguir, y eligió
**aclarar los requisitos del método y añadir la precisión de cada punto**.
**Módulos:** la pestaña Ajuste, el motor de mínimos cuadrados, el informe y el
Excel de la poligonal, la demo y la documentación. **Sin cambios en la base.**
**Carteras de referencia** (`docs/carteras/`):

| Cartera | Qué aporta |
|---|---|
| `Ajuste_Poligonal_Minimos_Cuadrados.xlsx` (Vivero) | El modelo de pesos que se enseña y que la app reproduce desde la Fase 14 |
| `poligonales.xlsx` (TT4) | Cómo se anota la cartera: un ángulo por estación y una distancia por lado |

**Fuente normativa:** Ghilani y Wolf, *Adjustment Computations*, 4.ª ed.
(2006), cap. 19 (elipses de error, ec. 19.22 y tabla 19.2).

## Propósito

Que quien elige mínimos cuadrados sepa **qué necesita** para obtener el
ajuste, y que el ajuste entregue, además de las coordenadas y las correcciones,
**la precisión de cada punto** con su elipse de error: el paso que distingue
el método y que la Fase 14 dejó fuera.

## Hallazgos que condicionan la fase

### 1. Mínimos cuadrados no necesita más lecturas por punto

El motor ajusta con una sola lectura por estación: la prueba «mínimos
cuadrados usa la misma suma teórica y converge» (`polygonal.test.ts`) lo hace
con una lectura en cada estación. Si «no salen resultados», el motor devuelve
`missing_weights`: faltan los tres pesos, que empiezan vacíos. La pestaña lo
dice en una sola línea («El ajuste por mínimos cuadrados aparece con sus tres
pesos»), y uno de ellos, «Mediciones por distancia», se lee fácilmente como
«lecturas por punto». También se queda sin ajuste la abierta sin control, que
no tiene redundancia, y la poligonal sin terminar.

### 2. Lo que pide la hoja de Vivero

Revisada celda a celda (`POLIGONAL MINIMOS`, valores y fórmulas):

- **Por estación**, un ángulo (exterior) y **una** distancia horizontal; las
  coordenadas de partida (Famarena_5) y el azimut a la referencia (14_IS1).
- **Tres pesos** tecleados, iguales para todas las observaciones:
  - ángulos: «presci» = 2″; la matriz se escala por ρ/2″, así que σ = 2″ en
    cada ángulo;
  - distancias: «# Med» = 2 y «Error» = 0.011 m, con `Pon_dis = √2/0.011`,
    así que σ = 0.011/√2 = 7.8 mm en cada lado, sin depender de su longitud.
- **Tres condiciones**: Σ ángulos, Σ ΔN y Σ ΔE (r = 3).
- El «2» de mediciones **se declara**: la cartera solo trae una distancia por
  lado.

TopoField reproduce este modelo desde la Fase 14. `poligonales.xlsx` (TT4)
tampoco trae repeticiones: un ángulo por estación, una distancia por lado y
ningún peso (usa los métodos proporcionales).

### 3. Paramétrico y de condición dan lo mismo; lo que falta es la precisión

El texto que trajo el usuario describe el ajuste **paramétrico** (incógnitas:
las coordenadas; X̂ = (AᵀPA)⁻¹AᵀPL). TopoField usa **ecuaciones de condición**
(Fase 14, decisión 5). Con las mismas observaciones y pesos, los dos dan las
mismas coordenadas y correcciones. Lo que el paramétrico da casi gratis, y la
Fase 14 dejó fuera, es la **covarianza de las coordenadas**: σ de cada punto y
su elipse. El método de condición también la da, propagando:

- cofactor de las observaciones ajustadas: Q_l̂ = Q − Q·Aᵀ·(A·Q·Aᵀ)⁻¹·A·Q;
- covarianza de las coordenadas: Σ = σ̂₀²·J·Q_l̂·Jᵀ, con J = ∂(N, E)/∂l.

El ángulo de orientación es datum y no se ajusta (Fase 14, decisión 6), y el
punto de partida es fijo: su σ es cero.

### 4. La elipse al 95 % depende de la redundancia (Ghilani 19.22)

La elipse estándar sale de σ̂₀²·Q; para llevarla a un nivel de confianza se
multiplica por c = √(2·F(α, 2, r)), con el σ₀ **del propio ajuste**. Con dos
grados de libertad en el numerador, F tiene forma cerrada,
F = (r/2)·(α^(−2/r) − 1), que reproduce la tabla 19.2:

| Redundancia | Caso | F al 95 % | c |
|---|---|---|---|
| r = 3 | cerrada, o abierta con control y azimut de llegada | 9.55 | 4.37 |
| r = 2 | abierta con control sin azimut de llegada | 19.00 | 6.16 |

Con tan poca redundancia las elipses al 95 % salen grandes, y es lo correcto:
una poligonal simple se comprueba con solo 3 condiciones. Ghilani lo calcula
para una cerrada simple: su elipse estándar (c = 1) contiene el punto con
apenas un 35 % de probabilidad.

## Decisiones

| # | Decisión |
|---|---|
| 1 | **Los requisitos del método, a la vista** en Ajuste: qué pesos pide y de dónde salen, y por qué la abierta sin control no se ajusta. |
| 2 | **La precisión de cada punto**: σ Norte, σ Este y la elipse de error, en tabla y **dibujadas** sobre la poligonal ajustada. Solo con mínimos cuadrados: los métodos proporcionales no tienen covarianza. |
| 3 | Se conserva el **método de condición** (hallazgo 3): la precisión se obtiene propagando la covarianza. |
| 4 | **Sin cambios en la base**: la precisión se recalcula, como las correcciones y σ₀ (Fase 14, decisión 9). Ningún resultado existente cambia. |
| 5 | **Elipse al 95 % con c = √(2·F(0.05, 2, r))** y el σ₀ del propio ajuste (Ghilani 19.22, hallazgo 4). |
| 6 | **En el dibujo, las elipses exageradas** con un factor redondo que se rotula («elipses × 500»), elegido para que la mayor se vea: a escala real son milímetros sobre lados de decenas de metros. |
| 7 | **«Veces que se midió cada distancia» empieza en 1**, el valor de una cartera que anota una distancia por lado. Los σ siguen vacíos: dependen del equipo. |

Las cuatro primeras las eligió el usuario; las tres últimas las propuso la
redacción y el usuario las aprobó con el PRD.

## Alcance

### A. Los requisitos, en la pestaña Ajuste

- Al elegir mínimos cuadrados, el panel explica en pocas líneas qué necesita:
  - el **σ angular** y el **σ de distancia**, de la ficha del equipo, con un
    ejemplo;
  - **cuántas veces se midió cada distancia**, con 1 si la cartera anota una
    sola (decisión 7);
  - que la redundancia la da el cierre (r = 3, o 2 sin azimut de llegada), no
    las lecturas.
- «Mediciones por distancia» pasa a **«Veces que se midió cada distancia»**.
- Sin pesos, el aviso dice **cuáles faltan**, no solo que faltan.
- En la abierta sin control, el aviso de que no hay nada que ajustar se queda
  como está.

### B. El motor: la precisión de cada punto

- Funciones puras en `src/lib/calculations/`: el cofactor de las
  observaciones ajustadas, el jacobiano de las coordenadas, la covarianza de
  cada vértice y su elipse (semieje mayor, semieje menor y azimut del mayor).
- `F(α, 2, r)` en forma cerrada y `c` (decisión 5).
- El resultado del ajuste gana, por estación, σ N, σ E y la elipse al 95 %, y
  el `c` y la `r` usados. Nada de esto se persiste.
- El punto de partida es fijo y no tiene elipse; en la cerrada tampoco el
  último, que vuelve a él.

### C. La pestaña Ajuste: tabla y dibujo

- **Tabla «Precisión de cada punto»**: σ N, σ E, semieje mayor, semieje menor y
  azimut del mayor, en mm y DMS, con una línea que dice el nivel (95 %), la r
  y el c.
- **Las elipses dibujadas** sobre el dibujo ajustado, exageradas con su factor
  rotulado (decisión 6).

### D. El informe y el Excel (los de la Fase 38)

- **Informe**: la tabla de precisión y el dibujo con las elipses, junto a las
  correcciones y σ₀ que ya tiene.
- **Excel** (hoja «MÍNIMOS CUADRADOS»): la tabla de precisión como valores de
  la app, igual que las matrices (Fase 38, decisión 7).

### E. Documentación

- `docs/math/poligonales.html`: la propagación de la covarianza y la elipse,
  con el ejemplo de Vivero.
- Manual en sus dos copias, con capturas: el panel con los requisitos, la
  tabla de precisión y las elipses.
- Doc técnica: motor y pruebas.

## Fuera de alcance

- **El ajuste paramétrico**: da lo mismo (hallazgo 3).
- **Precisión con los métodos proporcionales**, que no tienen covarianza.
- **Detección de errores gruesos** (*data snooping*) y redes con varias
  poligonales.

## Criterios de aceptación

1. Con mínimos cuadrados elegido, Ajuste dice qué pide el método, con
   «Veces que se midió cada distancia» empezando en 1, y sin pesos dice cuáles
   faltan.
2. Ningún resultado existente cambia: las coordenadas, las correcciones y σ₀
   de Vivero siguen siendo los de la Fase 14.
3. La covarianza de las coordenadas coincide con la de un ajuste paramétrico
   independiente, escrito en la prueba, sobre la misma poligonal.
4. `F(0.05, 2, r)` reproduce la tabla 19.2 de Ghilani (r = 2, 3, 4, 5, 10), y
   las elipses usan c = √(2F).
5. Ajuste muestra la tabla de precisión y las elipses con su factor; el
   informe y el Excel, la misma tabla.
6. `npm run typecheck`, `npm run lint`, `npm test` y `npx supabase test db`
   pasan.
7. Manual (dos copias), capturas, fundamentos y doc técnica al día.

## Pruebas mínimas

- **Motor:** la covarianza contra un paramétrico independiente en un cuadrado
  y en Vivero; la elipse de un caso con solución a mano; F y c contra la tabla
  de Ghilani; una abierta con control con r = 2; Vivero sin cambios en lo que
  ya calculaba.
- **Excel:** la hoja de mínimos cuadrados con la tabla de precisión.
- **En pantalla:** el panel con los requisitos y sin pesos; la tabla de
  precisión y las elipses en Ajuste y en el informe; el Excel descargado.

## Despliegue

Un solo paso: el merge. No hay migración.

## Riesgos

1. **Elipses grandes** con r = 3 (c = 4.37) pueden parecer un error. La tabla
   dice el nivel de confianza, la r y el c, y el manual lo explica.
2. **La propagación es álgebra nueva**: por eso se verifica contra un
   paramétrico independiente, no contra sí misma.
3. **Un «1» por defecto que nadie mira** (decisión 7): es el valor de una cartera con
   una distancia por lado, y el panel dice qué significa.
