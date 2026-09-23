# Pendientes

Peticiones recogidas que **no** tienen fase abierta todavía. Cada una se
convierte en fase —o entra en una ya planificada— cuando le llegue el turno,
siguiendo el ciclo de [`method.md`](./method.md).

No es un backlog de ideas: es lo que el usuario ya pidió explícitamente y está
esperando. Lo que se descarta se borra de aquí, con su razón anotada en el PRD
que lo descartó.

## Estado (2026-09-22)

Cuatro de estas peticiones ya tienen fase asignada en la renumeración del
2026-09-22. Siguen listadas aquí hasta que su PRD-de-fase se redacte y
commitee, que es lo que marca el inicio del trabajo de la fase.

| Petición | Fase | Estado |
|---|---|---|
| ~~N2 + N3~~ | **9** — Cadena de distancias de nivelación | **cerrada** (2026-09-22) |
| N1 | **10** — Nomenclatura de nivelación | sin redactar |
| A2 | **11** — Estado de los BMs | sin redactar |
| A1 | **12** — Alerta por lectura desfasada | sin redactar |
| P1 | dentro de la **13** (canvas) | sin redactar |
| N4 | — | sin fase asignada · **desbloqueada** (plantilla propia) |
| N6 | — | sin fase asignada |

**N5 retirada.** Decía que el generador de proyecto demo no crea nivelación.
Es falso: sí la crea, vía `src/lib/demo/insertar-nivelacion.ts`. El grep que
originó la petición buscaba «leveling» en `crear-proyecto-demo.ts`, que no la
ve porque está delegada en ese módulo. Verificado al implementar la Fase 9.

N1 va **después** de la 9 a propósito: la Fase 9 reescribe la tabla de captura
entera, así que renombrar antes obligaría a renombrar sobre texto que esa fase
sustituye. Y A2 va antes que A1 porque la alerta por tendencia necesita saber
qué series existen: un BM retirado a media serie y uno incorporado tarde son
justo los casos donde «la tendencia» está mal definida.

---

## Poligonales

### P1 · Captura de ángulos en grados decimales

Hoy los ángulos se capturan solo en DMS (`DmsInput`, tres casillas). Se necesita
poder digitarlos también en **grados decimales**, con las dos opciones
disponibles.

- El almacenamiento no cambia: `CLAUDE.md` fija que los ángulos van a la base
  como tres campos (`deg`, `min`, `sec`). Esto es una alternativa de **entrada**,
  no de modelo.
- `angles.ts` ya tiene `dmsToDecimal` y `decimalToDms`, así que la conversión
  existe. Lo que falta es el componente y dónde se recuerda la preferencia: por
  proceso, por usuario, o un conmutador de la celda.
- Afecta a la captura de lecturas múltiples de la Fase 7: si un ángulo se teclea
  en decimal, sus N lecturas también.

---

## Nivelación

### N1 · Renombrar vista atrás y vista adelante

La nomenclatura actual no es la que usa el topógrafo:

| Hoy | Debe ser |
|---|---|
| Vista atrás | **Vista más** (`b+` / `B+`) |
| Vista adelante | **Vista menos** (`b−`) |

Es coherente con el cálculo: la vista más se suma a la cota para obtener la
altura del instrumento, y la vista menos se resta. Toca la tabla de captura, el
panel de resultados, el export, el informe y el manual en sus dos copias.

### N4 · Importar lecturas desde CSV (nivel electrónico)

Con nivel electrónico las lecturas y las distancias deben poder **subirse desde
un archivo CSV**, además de digitarse. El instrumento ya entrega ambos valores,
así que teclearlos a mano es transcribir lo que ya está en digital — con el
riesgo de error que eso trae en una aplicación cuyo tema es la trazabilidad de
la medición.

**Desbloqueada el 2026-09-23.** Estuvo esperando un CSV real de un nivel
digital para no especificar el parser sobre supuestos —el precedente de la
Fase 7: dos carteras de campo encontraron en una tarde lo que cuatro fases de
fixtures sintéticos no vieron—. Se resuelve por otra vía: en vez de adivinar el
formato de un instrumento, **TopoField define su propia plantilla CSV**.

### Lo que ya está resuelto

El **modelo** lo cerró la Fase 9: con nivel digital el instrumento mide por
láser y entrega lectura y distancia directamente, sin hilos estadimétricos. El
modo `digital` de la libreta ya captura exactamente eso. N4 no añade modelo —
añade una puerta de entrada.

### Decisiones tomadas

**Plantilla propia, descargable desde el editor.** Columnas fijas y
documentadas; el topógrafo vuelca ahí lo que traiga su nivel. Desbloquea la
petición sin inventar supuestos sobre separadores, decimales, cabeceras o
codificación regional — un Leica configurado en `es-CO` escribe `1,234` con
coma decimal, y un parser construido a ciegas falla ante el primer archivo
real, en silencio.

**El tipo de punto se deriva y el usuario lo confirma.** El instrumento no
sabe qué es un BM, un punto de cambio o una radiación, y sin ese dato la
cadena de acumulado de la Fase 9 no funciona: una radiación mal clasificada la
rompe sin avisar. Se deduce de las lecturas —con lectura atrás y adelante es
punto de cambio; solo adelante es radiación; la primera y la última son BM— y
la importación muestra una **previsualización editable** donde el topógrafo
corrige antes de confirmar. Deducir sin confirmar sería adivinar; pedirlo todo
a mano sería renunciar a la comodidad que justifica importar.

**Queda pendiente para cuando haya un archivo real:** leer el formato nativo
del instrumento, que iría en una fase posterior sobre esta base.

### Sigue sin fase asignada

Va a **fase propia**: es un flujo distinto —subida, parseo, previsualización,
errores por fila— que no comparte código con el motor. Se numerará cuando le
llegue el turno, después de las fases 11 y 12 con el orden actual.

### N6 · Control ida-vuelta por puntos homólogos

Cuando la ida y la vuelta recorren **los mismos puntos** —práctica confirmada en
la cartera de El Verjón, donde los 12 puntos se reocupan en orden inverso— se
puede comparar cada punto homólogo entre los dos recorridos, no solo el desnivel
total de la sección.

La hoja lo hace en su columna `P`, y la lectura es informativa: los residuos
crecen de `−1 mm` a `−7 mm` a lo largo del recorrido, que es la firma de un
error sistemático repartido y no de un punto mal medido. Un único número de
discrepancia esconde esa distinción.

**No sustituye al emparejamiento por sección**, que sigue siendo el default: el
cierre de la Fase 4 argumentó bien que reocupar los puntos de cambio debilita el
doble recorrido —un PC mal asentado mete el mismo error con el mismo signo en
ambos—. Lo que la cartera demuestra es que **las dos prácticas existen**, y el
modelo debe admitir ambas: sección por defecto, homólogos cuando ida y vuelta
comparten códigos.

Análisis completo en
[`carteras/analisis-nivelacion-verjon.md`](./carteras/analisis-nivelacion-verjon.md).

---

## Control de asentamientos

### A1 · Alerta por lectura desfasada de la tendencia

Se necesita avisar cuando una lectura **se aleja mucho de la tendencia** del
punto: un valor atípico que probablemente sea error de lectura y no
asentamiento real.

Es distinto de los umbrales que ya existen. Los umbrales de velocidad y
acumulado (`sites.velocity_*`, `sites.accumulated_*`) miden **cuánto** se movió
el punto; esto mide si la **serie** es coherente consigo misma. Un punto puede
estar dentro de todos los umbrales y traer una campaña obviamente mal leída.

Queda por decidir el criterio —residuo contra la tendencia de las campañas
anteriores, y con qué margen— y si avisa o bloquea. Precedente aplicable: en
esta aplicación los controles de calidad de captura avisan, no bloquean.

### A2 · Estado de los BMs (dar de baja y dar de alta)

Los puntos que se miden se llaman **BMs**, y su conjunto no es fijo:

- Un BM **desaparece** —se destruye, se tapa, se pierde— y hay que dejar de
  medirlo sin borrar su historia, que sigue siendo válida hasta esa fecha.
- Hacen falta **BMs nuevos** incorporados a mitad del monitoreo, cuya línea base
  es su primera medición, no la campaña 0 del lugar.

Dos operaciones, entonces: dar de baja y dar de alta. La palabra está por
decidir —«desactivar», «dar de baja», «retirado»— pero **no** puede ser un
borrado: eliminar la fila se llevaría las lecturas históricas por cascada, y con
ellas la serie que justifica el monitoreo.

Consecuencias a resolver cuando se abra: qué hace `computeHistory` con un BM
retirado a media serie, qué muestra la gráfica, y si el informe lo lista.
