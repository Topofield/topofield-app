# Análisis de la cartera de mínimos cuadrados

Verificación de `Ajuste_Poligonal_Minimos_Cuadrados.xlsx` (U. Distrital, Sede
Vivero, 4-nov-2021). Es el insumo de la **Fase 10**; se deja escrito para no
rederivarlo.

## El método de la hoja

Ajuste por **ecuaciones de condición** sobre la poligonal cerrada de 5 vértices:

| Condición | Qué exige |
|---|---|
| Angular | los 5 ángulos interiores ajustados suman `(n-2)·180 = 540°` |
| Cierre N | `Σ ΔN = 0` |
| Cierre E | `Σ ΔE = 0` |

Pesos: angular `ρ"/σ_ang` con `σ_ang = 2"`; distancia `√(#med)/σ_dist` con
`σ_dist = 0.011 m` y `#med = 2`. Resuelve `B = A·Aᵀ`, `C = B⁻¹·K`, `R = Aᵀ·C`, y
aplica las correcciones a los **azimuts acumulados** y a las **distancias** — no
a las proyecciones, que es lo que distingue este método de Bowditch, Tránsito y
Crandall.

Los coeficientes de la matriz de condición son correctos en su forma: la
derivada del cierre respecto de un ángulo es la suma de las proyecciones de los
lados que ese ángulo arrastra (`-Σ ΔE` para la condición en N, `+Σ ΔN` para la
condición en E), y respecto de una distancia es el coseno o el seno de su
azimut.

## La hoja no satisface sus propias condiciones

Es la prueba que define el método: las observaciones ajustadas deben cumplir las
condiciones **exactamente**. No las cumple.

| Condición | Antes del ajuste | Después, según la hoja | Debería ser |
|---|---|---|---|
| Angular | `-4.000"` | `-1.092"` | `0` |
| Cierre N | `-0.007162 m` | `-0.001953 m` | `0` |
| Cierre E | `+0.007465 m` | `+0.001981 m` | `0` |

Reduce los residuos a un 27 % y ahí se detiene. La poligonal ajustada **no
regresa al punto de partida**: sale de `100139.844 / 101491.444` y vuelve a
`100139.842047 / 101491.445981`, con un desfase de `-1.95 mm` en N y `+1.98 mm`
en E.

Un sospechoso concreto: la matriz de condición declara **siete** incógnitas
angulares (`B31:H31`) para una cartera de seis ángulos, y la séptima columna
(`H32`, `H33`) es cero en las dos condiciones lineales. Es una variable libre
que absorbe parte de la corrección angular sin afectar a la geometría.

## El ajuste correcto sobre la misma cartera

Mismos datos, mismos pesos, resuelto como `v = Q·Aᵀ·(A·Q·Aᵀ)⁻¹·(-w)` con
`Q = diag(σ²)`:

**Correcciones**

| Ángulo | | Lado | |
|---|---|---|---|
| 1 | `+0.769"` | 1 | `-4.18 mm` |
| 2 | `+0.777"` | 2 | `-3.19 mm` |
| 3 | `+0.784"` | 3 | `+1.83 mm` |
| 4 | `+0.840"` | 4 | `+3.62 mm` |
| 5 | `+0.830"` | 5 | `-0.83 mm` |

Las correcciones angulares **no son iguales entre sí**, y esa es la firma del
método: si lo fueran, sería el reparto proporcional de siempre. Difieren porque
los ángulos participan además de las dos condiciones lineales.

**Verificación**: residuo angular `-4e-10"`, `Σ ΔN = +6.3e-08 m`,
`Σ ΔE = +8.1e-08 m` — cero a efectos prácticos.

**Coordenadas ajustadas**

| Punto | Norte | Este |
|---|---|---|
| D1 | `100117.4638` | `101515.6311` |
| D2 | `100113.1749` | `101528.7022` |
| D3 | `100182.2394` | `101581.7809` |
| D4 | `100193.8990` | `101558.7102` |
| Famarena_5 | `100139.8440` | `101491.4440` |

Regresa al punto de partida exacto.

## Para la Fase 10

- El ángulo de **orientación no entra en las condiciones**: un error suyo rota
  el polígono entero y no afecta al cierre, así que no es determinable desde
  estas tres condiciones. Es el datum, no una observación ajustable.
- Los valores de esta página son los esperados de los tests del método.
- Criterio de aceptación del ajuste: **las tres condiciones en cero**, no la
  paridad con la hoja.

## Estado de las cuatro hojas analizadas

De las dos carteras del proyecto, una sola hoja está bien:

| Hoja | Estado |
|---|---|
| `BRUJULA` (Bowditch) | **correcta** — el motor la reproduce con 0.000 mm |
| `TRANSITO` | reparte sobre la proyección con signo; las correcciones se cancelan y deja el error entero sin corregir |
| `CRANDALL` | suma donde va un producto, `Σ(LDᵢ²)` donde va `(Σ LD)²`, paréntesis mal puestos; no cierra por 0.22 mm |
| `POLIGONAL MINIMOS` | no satisface ninguna de sus tres condiciones; queda el 27 % sin corregir |
