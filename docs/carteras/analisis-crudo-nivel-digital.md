# Análisis del crudo de nivel digital — `CRDUDO-TRAMO2.L`

Formato nativo de un **nivel digital Leica**, entregado el 2026-09-23. Es el
insumo de **N4** (importar lecturas desde archivo) y la razón por la que esa
petición dejó de estar bloqueada. Se deja escrito para no rederivarlo.

## Qué es

Texto ASCII de ancho fijo con terminadores **CRLF**, 66 líneas. Cuatro tipos
de línea, identificados por el primer carácter:

| Tipo | Cuántas | Qué es |
|---|---|---|
| `B` | 1 | Cabecera: punto de partida y su cota |
| `G` | 32 | Visual **atrás** (vista más) |
| `I` | 32 | Visual **adelante** (vista menos) |
| `W` | 1 | Resumen del instrumento: desnivel, distancia y cota final |

## Anatomía de una línea de medición

```
G    1.6494m    48.847m 2541.7545m1     0.3 mmC10     C10      3B1                 2
^    ^          ^       ^          ^     ^     ^       ^        ^
0    1-12       12-23   23-34      34-40 40-44 46-54   54-63    63-66
```

| Posición | Campo | Ejemplo |
|---|---|---|
| `0` | Tipo de línea | `G` |
| `1-12` | Lectura de mira, en metros | `1.6494` |
| `12-23` | Distancia al punto, en metros | `48.847` |
| `23-34` | Cota calculada por el instrumento | `2541.7545` |
| `34-40` | Número de armada | `1` |
| `40-44` | **Desviación típica de la lectura, en mm** | `0.3` |
| `46-54` | **Punto medido** | `C10` |
| `54-63` | Referencia del tramo (constante) | `C10` |
| `63-66` | Sufijo de repetición | `3B1` |

Los offsets están **medidos sobre el archivo**, no contados a ojo: un primer
intento de leerlos por aproximación dio códigos de punto equivocados —todos
`C10`— y un desnivel que no cuadraba con la línea `W`. La discrepancia fue lo
que delató el error.

### El sufijo: dos lecturas por visual

`3B1` / `3B2` son las dos repeticiones de la visual **atrás**; `3F1` / `3F2`
las de **adelante**. El instrumento mide dos veces cada visual y da la
desviación típica de cada lectura. Son 16 armadas × 4 líneas = 64 mediciones.

## El recorrido

Circuito **cerrado de ida y vuelta sobre los mismos puntos**:

```
ida    (armadas  1-8):  C10 → C11 → C12 → C13 → C14 → C15 → C16 → C17 → C18
vuelta (armadas 9-16):  C18 → C17 → C16 → C15 → C14 → C13 → C12 → C11 → C10
```

## Verificación

Reconstruido promediando las dos repeticiones de cada visual:

| Magnitud | Calculado | Declara la línea `W` |
|---|---|---|
| `ΣV+` | `25.2399` | — |
| `ΣV−` | `25.2403` | — |
| Desnivel | `−0.0004 m` | `−0.0002 m` |
| Distancia total | `1397.281 m` | `1397.284 m` |
| Cota final | — | `2541.7543` |

Las diferencias —0.2 mm en el desnivel y 3 mm en la distancia— son de
redondeo al promediar repeticiones que el instrumento suma sin redondear. **El
formato queda confirmado**: si la interpretación de las columnas fuera
equivocada, la discrepancia no sería de décimas de milímetro.

Cota de partida `2541.7545`, cota de regreso `2541.7543`: **error de cierre de
0.2 mm** sobre 1397.284 m. Con `D` en un solo sentido (0.6985 km), la
tolerancia de tercer orden es `12·√0.6985 = 10.03 mm`. Cumple con holgura.

## Calidad de la medición

| Indicador | Valor |
|---|---|
| σ declarada por el instrumento | 0.0 a 2.3 mm · media 0.59 mm |
| Dispersión entre las dos repeticiones | máx. 1.5 mm · media 0.47 mm |
| Distancias de visual | 21.20 a 50.63 m |

## Qué enseña al modelo

### Confirma el modelo digital de la Fase 9

Con nivel digital el instrumento mide por láser y entrega **lectura y
distancia**, sin hilos estadimétricos. El modo `digital` de la libreta captura
exactamente eso. El crudo lo confirma: no hay rastro de hilos superior o
inferior en ninguna línea.

### Confirma N6 por segunda vez

Este archivo **reocupa todos los puntos de cambio en la vuelta**, igual que la
cartera de El Verjón. Con dos carteras independientes de dos instrumentos
distintos haciendo lo mismo, la práctica de reocupar deja de ser excepcional —
y el supuesto contrario que la Fase 4 escribió en el `§6.9` del PRD principal
queda desmentido por los datos, no por un argumento.

### Trae dos datos que el modelo no tiene

**Las dos repeticiones por visual y su desviación típica.** La Fase 7 ya modeló
esto para poligonales —N lecturas por ángulo con promedio y dispersión— y
nivelación no lo tiene.

**Decisión para N4 (2026-09-23):** el import **promedia las dos repeticiones y
guarda una sola lectura**, que es lo que la libreta admite hoy. Se pierde la σ
del instrumento; en este archivo iba de 0.1 a 2.3 mm, y el valor de 2.3 señala
una lectura peor que las demás. Queda anotado como candidato a fase futura:
llevar a nivelación el modelo de lecturas múltiples de la Fase 7.

## Para N4

> **Implementado en la Fase 16** ([`prds/15-importar-nivel-digital.md`](../prds/15-importar-nivel-digital.md)).
> El PRD rehízo los valores con los promedios redondeados a las columnas de la
> libreta y encontró que la vuelta de una nivelación abierta arrancaba en la
> cota equivocada.

**El archivo es parseable directamente**, así que el import no obliga al
topógrafo a transcribir a mano lo que ya está en digital — que era el propósito
de la petición.

La arquitectura acordada es un **detector con parsers intercambiables**: cada
parser declara cómo reconocer su formato y todos desembocan en una forma
intermedia única, de modo que añadir otro instrumento no toca la
previsualización ni la validación. Los detalles se fijan en el PRD de la fase.

**El tipo de punto no está en el archivo.** El instrumento no distingue un BM
de un punto de cambio o una radiación, y sin ese dato la cadena de acumulado de
la Fase 9 no funciona. Se deriva de las lecturas y se confirma en una
previsualización editable.
