# Análisis de la cartera de nivelación El Verjón

Verificación de `TRABAJO NIVELACION EL VERJON.xlsx`. Nivelación geométrica
compuesta de **D1 a D4**, medida en ida (`NIVELACION`) y vuelta
(`CONTRANIVELACION`). Es el insumo de la **fase de la cadena de distancias**
(N2 + N3) y del control ida-vuelta punto a punto; se deja escrito para no
rederivarlo.

## Qué hace la hoja

| Columna | Contenido |
|---|---|
| `PUNTO` | código, repetido en **tres filas** por punto (hilo superior, medio, inferior) |
| `V+` | vista más — lo que nuestro modelo llama `backsight` |
| `HI` | altura del instrumento: `=COTA + V+` |
| `V-` | vista menos — nuestro `foresight` |
| `VI` | vista intermedia — nuestro `point_type = 'intermediate'` |
| `COTA` | `=HI_anterior − V-` |
| `DISTANCIA V+` | `=(hilo_sup − hilo_inf)*100` de la visual **atrás** |
| `DISTANCIA V-` | ídem de la visual **adelante** |

El recorrido pasa por 12 puntos: `D1 · C1 · C2 · C3 · AUX1 · C4 · C5 · C6 · C7 ·
D3 · C8 · D4`. `AUX1` es una vista intermedia: recibe solo `VI`, cuelga de la
`HI` vigente y **no lleva distancia**.

## La aritmética es correcta

Es la primera hoja del proyecto sin un error en su núcleo. Las dos hojas cierran
la comprobación al bit:

| Hoja | `ΣV+ − ΣV−` | `H_final − H_inicial` | |
|---|---|---|---|
| `NIVELACION` | `+26.583000` | `+26.583000` | exacto |
| `CONTRANIVELACION` | `−26.588000` | `−26.588000` | exacto |

Discrepancia ida-vuelta: **−5.000 mm** sobre un desnivel de ~26.58 m.

## Lo que la hoja hace mal

### 1. La compensación no es proporcional a la distancia

`O4 = O3/11` reparte los 5 mm en once partes iguales, y luego **suma la misma
constante a todas las cotas**: `L3`, `L6`, `L9` … todas son `=Hx + $O$4`.

Dos defectos, no uno:

- Repartir por **número de tramos** en vez de por distancia acumulada ignora que
  un tramo de 60 m acumula más error que uno de 15 m. En esta cartera los tramos
  van de 15.1 m a 60.5 m — factor 4 entre el mayor y el menor.
- Sumar la **misma** constante a todas las cotas no corrige error acumulado:
  **desplaza el recorrido entero en bloque**. El punto final recibe exactamente
  la misma corrección que el primero, cuando debería recibir el total del error.

El motor de TopoField aplica `Corr_i = −Error × (d_acum_i / D_total)`, que es lo
correcto. **Criterio de aceptación: la compensación reparte proporcional a la
distancia, no la paridad con la hoja.** Mismo criterio que se fijó para
`TRANSITO` y `CRANDALL` en poligonales.

### 2. La tolerancia usa una K ajena y la distancia del recorrido contrario

`K47 = 10*SQRT(K42/1000)`, con el rótulo «Error Cierre Orden 4».

- **K=10** no está en la tabla del proyecto (`3 / 6 / 12 / 24` para primer,
  segundo, tercer orden y ordinario).
- **`K42` es la distancia de la contranivelación** (372.9 m), no la de la ida
  (384.3 m). Evaluar el cierre con la distancia del recorrido contrario es
  arbitrario: son dos recorridos distintos con distancias distintas.

El veredicto no cambia —cumple con K=10 (6.107 mm) y también con nuestro tercer
orden (7.328 mm)— pero el criterio no es el nuestro. Con primer y segundo orden
**no** cumpliría.

### 3. La vista intermedia rompe la cadena de distancias, y se pierden 24.7 m

Es el defecto más grave de la hoja, y el que justifica N3 por sí solo.

`I24` y `J24` son `=(D23-D25)*100` y `=(F23-F25)*100` sobre la fila de `AUX 1`,
donde `D23`/`D25`/`F23`/`F25` están **vacías** — los valores de una vista
intermedia viven en la columna `G`. Ambas dan `undefined`.

Eso arrastra dos consecuencias en la cadena de acumulado:

- `K22 = SUM(I21+J24)` recibe el `undefined` y acaba contando **solo `I21`**
  (15.7 m), perdiendo la visual de adelante de esa armada.
- **La fila `K25` no existe.** La serie va `K4 K7 K10 K13 K16 K19 K22 · K28 K31
  K34`: falta el escalón que debería sumar `I24+J27`, saltado al pasar por la
  vista intermedia.

**Resultado: `J27` — los 24.7 m de la visual adelante de `C 3` — no entra en
ninguna suma.** Sumando las propias distancias de la hoja, la contranivelación
mide `397.6 m`; la hoja reporta `K42 = 372.9 m`.

Y esa cifra es precisamente la que alimenta la tolerancia:

| | Distancia | Tolerancia K=10 | Veredicto sobre 5.000 mm |
|---|---|---|---|
| Hoja | `372.9 m` | `6.107 mm` | cumple |
| Real | `397.6 m` | `6.306 mm` | cumple |

**Aquí el veredicto no cambia, pero por suerte, no por diseño.** Con un error de
cierre entre `6.107` y `6.306 mm` la hoja habría declarado «NO CUMPLE» sobre un
trabajo que sí cumplía. El defecto inclina hacia el lado seguro —una tolerancia
más estricta rechaza trabajo bueno en vez de aprobar trabajo malo—, pero sigue
siendo un veredicto emitido sobre un número equivocado.

**Esta es la justificación empírica de N3.** El dato del que depende `K·√D` se
mantiene a mano en una hoja de cálculo, una vista intermedia rompe la cadena de
sumas, y nada avisa: la hoja imprime un total con aspecto correcto y un
veredicto en verde. Derivar el total de las distancias por visual, y hacer que
las vistas intermedias no rompan la cadena, elimina esta clase de fallo por
construcción.

### 4. En dos armadas falta el hilo inferior, y se parcheó en la columna `B`

Filas 14-16 y 26-28 de `CONTRANIVELACION` (`C 6` y `C 3`): la columna `D` del
hilo inferior dice `"---"`, es decir **el dato no se tomó en campo o se perdió**.
El parche duplica los otros dos hilos en la columna `B` y calcula la distancia
como `I15: =(B14-B16)*100` con `B16: =B15-B14`, una resta que produce un valor
negativo (`−0.087`) usado en la posición del hilo inferior.

El resultado son distancias de `25.7 m` y `14.8 m` que no salen de una lectura
de hilos, sino de esa construcción. **Son el único dato disponible para esas dos
armadas**, así que la versión corregida las conserva como valor tecleado y deja
el hilo inferior vacío, anotándolo en la celda.

Esto es una confirmación directa de la decisión de que **los tres hilos sean
opcionales**: en una cartera real y por lo demás correcta, dos armadas de doce
no los tienen completos. Un modelo que exigiera los tres no podría capturar esta
cartera.

## Lo que la cartera enseña al modelo

### Confirma tres decisiones ya tomadas

- **Tres hilos por visual**, con `D = (HS − HI)·100`. La cartera lo hace en
  todas las visuales; aquí los hilos son la norma, no la excepción.
- **Dos distancias por armada**, en columnas separadas (`DISTANCIA V+` y
  `DISTANCIA V-`). Confirma la decisión de no modelar «una distancia al cambio».
- **N1**: los encabezados reales del topógrafo son `V+`, `V-` y `VI`, no «vista
  atrás» / «vista adelante».

### Contradice un supuesto de la Fase 4

El cierre de la Fase 4 enmendó el `§6.9` del PRD principal afirmando que **los
puntos de cambio son provisionales y no se reocupan**, y que por eso el
emparejamiento ida-vuelta es a nivel de sección.

**Esta cartera reocupa todos los puntos de cambio.** Ida y vuelta recorren los
mismos 12 puntos en orden inverso, y la hoja los compara uno a uno en la columna
`P`:

| Punto | Residuo ida − vuelta |
|---|---|
| `C 8` | `−0.001 m` |
| `D3` | `−0.002 m` |
| `C 7` | `−0.002 m` |
| `C 6` | `−0.003 m` |
| `C 5` | `−0.005 m` |
| `C 4` | `−0.005 m` |
| `AUX 1` | `−0.005 m` |
| `C 3` | `−0.005 m` |
| `C 2` | `−0.006 m` |
| `C 1` | `−0.007 m` |
| `D1` | `−0.005 m` |

El razonamiento de la Fase 4 **sigue siendo válido**: un PC mal asentado que se
reocupa mete el mismo error con el mismo signo en ambos recorridos, y el
promedio lo conserva en vez de revelarlo. Lo que la cartera demuestra es que
**la práctica contraria también existe en campo**. El modelo debe admitir las
dos: emparejamiento por sección como default, y comparación por puntos homólogos
cuando ida y vuelta comparten códigos.

La progresión de los residuos es además informativa: crece de forma casi
monótona de `−1 mm` en `C8` hasta `−7 mm` en `C1`, es decir **acumula a lo largo
del recorrido**. Eso es la firma de un error sistemático repartido, no de un
punto mal medido — exactamente lo que la comparación punto a punto sirve para
distinguir y lo que un único número de discrepancia esconde.

El último valor, `D1` con `−5 mm`, rompe la monotonía y baja respecto a los
`−7 mm` de `C1`. Es el cierre contra la cota de partida, así que no es un
homólogo más: es el error de cierre total del doble recorrido, el mismo `−5 mm`
de la discrepancia. Que la serie suba hasta `−7` y vuelva a `−5` sugiere que
el tramo final compensó parte del error acumulado — otra lectura que el número
único no permite.

### Un detalle de captura

El mismo punto aparece como `AUX1` en la ida y `AUX 1` en la vuelta, y varios
códigos llevan espacios finales (`"C 3 "`, `"C 5 "`). Un selector de punto en
vez de texto libre lo elimina de raíz.

## Valores esperados como fixture

Datos reales para los tests, verificados contra la hoja:

| Magnitud | Valor |
|---|---|
| `ΣV+` ida | `29.685` |
| `ΣV−` ida | `3.102` |
| Desnivel ida | `+26.583 m` |
| `ΣV+` vuelta | `3.404` |
| `ΣV−` vuelta | `29.992` |
| Desnivel vuelta | `−26.588 m` |
| Discrepancia | `−5.000 mm` |
| Distancia ida | `384.3 m` |
| Distancia vuelta (hoja) | `372.9 m` — incorrecta |
| Distancia vuelta (real) | `397.6 m` |
| Cota inicial `D1` | `3288.500` |
| Cota final `D4` (ida) | `3315.083` |
| Tolerancia 3.er orden (ida) | `12·√0.3843 = 7.439 mm` → **cumple** |
| Tolerancia 2.º orden (ida) | `6·√0.3843 = 3.719 mm` → **no cumple** |

Distancia de la primera armada de la ida: `I3 = (1.367−1.052)·100 = 31.5 m`,
`K6 = (0.410−0.125)·100 = 28.5 m`, acumulado del tramo `M4 = 60.0 m`.

## Versión corregida

`TRABAJO NIVELACION EL VERJON-corregido.xlsx` — hojas nuevas
`NIVELACION CORREGIDA` y `CONTRANIVELACION CORREGIDA`, con las originales
intactas al lado para comparar. Cambia:

- **Compensación proporcional a la distancia acumulada** en vez de `O3/11`
  aplicado como constante.
- **Tolerancia con la K del proyecto** y con la distancia del **propio**
  recorrido.
- **La vista intermedia ya no rompe la cadena de acumulado**: aporta 0 a la
  distancia del tramo y la suma continúa. Los 24.7 m perdidos vuelven al total.
- Las dos fórmulas rotas de `AUX 1` eliminadas, no copiadas.
- El parche de la columna `B` deshecho: en `C 6` y `C 3` el hilo inferior queda
  vacío —no se inventa— y la distancia se conserva como valor tecleado, con una
  nota en la celda que dice de dónde viene.
- Los tres hilos van en columnas propias (`HS`/`HM`/`HI` por visual) en vez de
  en tres filas por punto, que es la forma que tendrá la captura en la app.

Verificado: las dos hojas corregidas reproducen las cotas de la original
(`3315.083` la ida, `3288.495` la vuelta) y su comprobación aritmética cierra a
cero. La distancia de la vuelta pasa de `372.9` a `397.6 m`.

**Nota sobre la verificación**: este entorno no tiene LibreOffice ni Excel, así
que las fórmulas del libro no se recalcularon dentro de una hoja de cálculo. Lo
que sí se verificó es la **aritmética que esas fórmulas expresan**, replicada en
JavaScript sobre los mismos datos. Conviene abrir el archivo una vez para
confirmar que recalcula sin errores de referencia.

Los archivos guardan fórmulas, no valores: al abrirlos, Excel o LibreOffice
recalculan todo.
