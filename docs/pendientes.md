# Pendientes

Peticiones recogidas que **no** tienen fase abierta todavía. Cada una se
convierte en fase —o entra en una ya planificada— cuando le llegue el turno,
siguiendo el ciclo de [`method.md`](./method.md).

No es un backlog de ideas: es lo que el usuario ya pidió explícitamente y está
esperando. Lo que se descarta se borra de aquí, con su razón anotada en el PRD
que lo descartó.

## Estado (2026-09-25)

**Todas las peticiones recogidas están resueltas.** La última, N6, cerró en la
Fase 17. La tabla y los textos de abajo se conservan como registro.

La Fase 18 (libreta de nivelación y panel de asentamientos, a partir del
prototipo del usuario) dejó cuatro peticiones nuevas **sin fase**: N7 y N8 en
«Nivelación» —dos sospechas sobre el motor y el validador de nivelación que la
fase encontró y no tocó, porque cambian resultados de nivelación— y UI1 y UI2,
al final de este archivo. **N7 y N8 cerraron en la Fase 19**; siguen
pendientes UI1 y UI2.

### Renumeración del 2026-09-22

Cuatro de estas peticiones ya tienen fase asignada en la renumeración del
2026-09-22. Siguen listadas aquí hasta que su PRD-de-fase se redacte y
commitee, que es lo que marca el inicio del trabajo de la fase.

| Petición | Fase | Estado |
|---|---|---|
| ~~N2 + N3~~ | **9** — Cadena de distancias de nivelación | **cerrada** (2026-09-22) |
| ~~N1~~ | **10** — Nomenclatura de nivelación | **cerrada** (2026-09-23) |
| ~~A2~~ | **11** — Estado de los BMs | **cerrada** (2026-09-23) |
| ~~A1~~ | **12** — Alerta por lectura desfasada | **cerrada** (2026-09-23) |
| ~~P1~~ | dentro de la **13** (canvas) | **cerrada** (2026-09-23) |
| ~~N4~~ | **16** — Importar lecturas de nivel digital | **cerrada** (2026-09-24) |
| ~~N6~~ | **17** — Control ida-vuelta por puntos homólogos | **cerrada** (2026-09-24) |
| ~~N7 + N8~~ | **19** — Equilibrado por armada y compensación desde el origen | **cerrada** (2026-09-25) |

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

> **Resuelta en la Fase 13** ([`prds/12-canvas-poligonal.md`](./prds/12-canvas-poligonal.md)).
> Se conserva el texto de la petición como registro.

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

### N4 · Importar lecturas desde archivo (nivel electrónico)

> **Resuelta en la Fase 16** ([`prds/15-importar-nivel-digital.md`](./prds/15-importar-nivel-digital.md)).
> Se conserva el texto de la petición como registro.

Con nivel electrónico las lecturas y las distancias deben poder **subirse desde
un archivo**, además de digitarse. El instrumento ya entrega ambos valores,
así que teclearlos a mano es transcribir lo que ya está en digital — con el
riesgo de error que eso trae en una aplicación cuyo tema es la trazabilidad de
la medición.

**Desbloqueada el 2026-09-23, con un crudo real.** Llegó
`CRDUDO-TRAMO2.L`, formato nativo de un nivel digital Leica, descifrado y
verificado contra su propia línea de cierre. Ver
[`carteras/analisis-crudo-nivel-digital.md`](./carteras/analisis-crudo-nivel-digital.md).

La decisión previa —definir una plantilla CSV propia porque no teníamos
archivo— **se revisa a la luz del archivo**: el crudo es parseable
directamente, así que leerlo cumple el propósito de la petición (que el
topógrafo no transcriba a mano lo que ya está en digital) mejor que pedirle
volcarlo a otra plantilla.

### Lo que ya está resuelto

El **modelo** lo cerró la Fase 9: con nivel digital el instrumento mide por
láser y entrega lectura y distancia directamente, sin hilos estadimétricos. El
modo `digital` de la libreta ya captura exactamente eso. N4 no añade modelo —
añade una puerta de entrada.

### Decisiones tomadas

**Detector de formato con parsers intercambiables.** No un parser, sino
varios: cada uno declara cómo reconocer su formato —por el contenido, no por
la extensión— y todos desembocan en **una forma intermedia única**. Añadir
Trimble o Topcon mañana es escribir un parser y registrarlo, sin tocar la
previsualización, la validación ni la escritura en la libreta.

De salida, dos: el **`.L` de Leica** (descifrado, con archivo real) y una
**plantilla CSV propia** de TopoField, documentada y descargable, para quien
traiga un instrumento que todavía no sepamos leer. Cuando nada reconoce el
archivo, el mensaje dice qué formatos sí se entienden y ofrece la plantilla —
un «formato inválido» a secas deja al usuario sin salida.

**Las repeticiones se promedian al importar.** El Leica mide dos veces cada
visual (`B1`/`B2`, `F1`/`F2`) y da la desviación típica de cada lectura. El
import promedia y guarda una sola lectura, que es lo que la libreta admite
hoy. Se pierde la σ del instrumento; queda anotado como candidato a fase
futura llevar a nivelación el modelo de lecturas múltiples de la Fase 7.

**El tipo de punto se deriva y el usuario lo confirma.** El instrumento no
sabe qué es un BM, un punto de cambio o una radiación, y sin ese dato la
cadena de acumulado de la Fase 9 no funciona: una radiación mal clasificada la
rompe sin avisar. Se deduce de las lecturas —con lectura atrás y adelante es
punto de cambio; solo adelante es radiación; la primera y la última son BM— y
la importación muestra una **previsualización editable** donde el topógrafo
corrige antes de confirmar. Deducir sin confirmar sería adivinar; pedirlo todo
a mano sería renunciar a la comodidad que justifica importar.

**Queda fuera:** modelar las repeticiones y su desviación típica, que es un
cambio del modelo de nivelación y no de la importación.

### Sigue sin fase asignada

Va a **fase propia**: es un flujo distinto —subida, parseo, previsualización,
errores por fila— que no comparte código con el motor. Se numerará cuando le
llegue el turno, después de las fases 11 y 12 con el orden actual.

### N6 · Control ida-vuelta por puntos homólogos

> **Resuelta en la Fase 17** ([`prds/16-homologos-ida-vuelta.md`](./prds/16-homologos-ida-vuelta.md)).
> Se conserva el texto de la petición como registro.

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

### N7 · El equilibrado de visuales compara visuales de armadas distintas

> **Resuelta en la Fase 19** ([`prds/18-equilibrado-y-compensacion.md`](./prds/18-equilibrado-y-compensacion.md)).
> El equilibrado se evalúa por armada y el aviso la nombra. Se conserva el
> texto de la petición como registro.

Hallado en la Fase 18, al generar las libretas del seed. La Fase 9 define el
equilibrado **por armada** —`abs(d_atrás − d_adelante)`, y «una armada aporta
`back_distance_m` + `fore_distance_m`»—, pero `validateSightBalance`
(`src/lib/validators/leveling.ts`) compara la V+ y la V− de **una misma fila**.
En la libreta, la fila de un punto de cambio lleva la V− que **cierra** la
armada anterior y la V+ que **abre** la siguiente: son de armadas distintas.
Una armada real es la V+ de una fila y la V− de la siguiente fila que propaga
cota.

Consecuencia: puede avisar de un desequilibrio que no existe y callar uno
real. Arreglarlo cambia avisos en procesos ya guardados y los tests de la
Fase 9, así que no entró en la 18. El generador de libretas del seed lo
esquiva con todas las distancias parecidas entre sí.

**Confirmado con la cartera real de El Verjón** (importada en pantalla el
2026-09-24, ida):

| Armada (V+ → V−) | Distancias | Diferencia real | Aviso de hoy |
|---|---|---|---|
| C 1 → C 2 | 28.1 / 17.3 m | **10.8 m** | ninguno: la fila C 1 compara 28.1 con 28.5 |
| C 2 → C 3 | 21.9 / 11.7 m | 10.2 m | 4.6 m en C 2 |
| C 3 → C 4 | 25.5 / 15.1 m | 10.4 m | 13.8 m en C 3 |
| C 7 → D3 | 24.2 / 8.4 m | **15.8 m** | 9.3 m en C 7 y 6.3 m en D3 |

Calla un desequilibrio real y da magnitudes que no corresponden a ninguna
armada.

### N8 · El BM de partida recibe compensación

> **Resuelta en la Fase 19** ([`prds/18-equilibrado-y-compensacion.md`](./prds/18-equilibrado-y-compensacion.md)).
> El acumulado llega hasta la V− de cada punto y lo guardado se recalculó con
> una migración, cerrados incluidos. Se conserva el texto de la petición como
> registro.

Hallado en la Fase 18: en el registro de nivelación de una visita, el BM de
amarre sale compensado (100.0003 en lugar de 100.0000). Pasa igual en
nivelación desde la Fase 9: los tres circuitos cerrados del seed dejan su
BM-1 en 100.0013.

`accumulateDistances` (`src/lib/calculations/leveling.ts`) suma a cada fila
**su propia** distancia V+, que es la visual que sale de ese punto hacia la
armada siguiente. El BM de partida queda así con un acumulado mayor que cero y
la compensación proporcional lo mueve, aunque su cota es conocida. Lo mismo
desplaza un poco la de cada punto de cambio: su distancia desde el origen
debería acabar en su V−. El punto de cierre no se ve afectado (su acumulado
es el total) ni las intermedias (heredan el de su armada, que es lo
correcto). Las cotas de los puntos de control de las visitas tampoco, salvo
uno usado como punto de cambio.

Es del motor compartido y cambia cotas de nivelación ya guardadas: fase
propia, con su migración de recálculo si se decide corregirlo.

---

## Control de asentamientos

### A1 · Alerta por lectura desfasada de la tendencia

> **Resuelta en la Fase 12** ([`prds/11-lectura-desfasada.md`](./prds/11-lectura-desfasada.md)).
> Se conserva el texto de la petición como registro.

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

> **Resuelta en la Fase 11** ([`prds/10-estado-bms.md`](./prds/10-estado-bms.md)).
> Se conserva el texto de la petición como registro.

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

---

## Interfaz

### UI1 · Identidad visual del prototipo de asentamientos

El prototipo `docs/prototipos/Control de asentamientos, Torre Alameda.html`
trae una identidad propia: las fuentes **Barlow** y **Barlow Semi Condensed**,
un acento amarillo «mira» (`#e2ad0b`), la paleta paper/ink y **modo oscuro**
completo. La Fase 18 llevó su layout y su UX a la app **con los tokens
existentes** (decisión del usuario, `prds/17-libreta-panel-asentamientos.md`,
decisión 11), porque adoptarla afecta a toda la app.

Si se retoma, es una fase de sistema de diseño: tokens en `globals.css`, el
modo oscuro (hoy no existe ni un `dark:`), y cada pareja nueva medida en
`pairings.ts`. El amarillo del prototipo casi seguro no llega a 3:1 sobre
blanco: hará falta una variante oscura para texto y bordes.

### UI2 · Coma decimal en las celdas de captura

Las celdas numéricas de captura son `type="number"`, que no acepta la coma
decimal que teclea un usuario en español. La importación de la Fase 16 sí la
acepta en la plantilla CSV con `;`. Afecta a la libreta de nivelación, a la de
la visita y a la captura de poligonales. Anotada en la Fase 18, que capturó en
vivo sin resolverla.

