# Pendientes

Peticiones recogidas que **no** tienen fase abierta todavía. Cada una se
convierte en fase —o entra en una ya planificada— cuando le llegue el turno,
siguiendo el ciclo de [`method.md`](./method.md).

No es un backlog de ideas: es lo que el usuario ya pidió explícitamente y está
esperando. Lo que se descarta se borra de aquí, con su razón anotada en el PRD
que lo descartó.

## Estado (2026-10-03)

El 2026-09-29 el usuario pidió cerrar los huecos de funcionalidad y mejorar la
navegación. Se partió en **dos fases seguidas** (decisión del usuario): la
**22** —el proceso en una pantalla,
[`prds/21-proceso-en-una-pantalla.md`](./prds/21-proceso-en-una-pantalla.md),
**cerrada** el 2026-09-29— y la **23**
([`prds/22-integridad.md`](./prds/22-integridad.md)), **cerrada** el
2026-09-30. Su petición original está en «Integridad (Fase 23)», al final; el
PRD la amplió con dos hallazgos de la apertura (guardados de poligonal y
nivelación, veredicto de la abierta con vuelta).

El 2026-09-30, tras la revisión de pendientes, el usuario pidió una **Fase 24
de pulido** con la deuda visible de la § 11 y lo que encontró la puesta al día
de la documentación: «Pulido (Fase 24)», al final. La fase se abrió y se
cerró ese mismo día ([`prds/23-pulido.md`](./prds/23-pulido.md)).

Ese mismo día el usuario pidió el **catálogo de equipos**, diferido desde la
Fase 8: «Catálogo de equipos (Fase 25)», al final, cerrada ese mismo día
([`prds/24-catalogo-equipos.md`](./prds/24-catalogo-equipos.md)).

El 2026-10-01 el usuario pidió un **segundo pulido** con lo que quedaba de la
§ 11 y una **revisión de las fórmulas y métodos de cálculo** de cada módulo.
La revisión está en [`auditoria-calculo.md`](./auditoria-calculo.md): 18
errores (C-1 a C-18) y 18 criterios por decidir (D-1 a D-18). El usuario
eligió corregir primero:

- **Fase 26** — correcciones del cálculo
  ([`prds/25-correcciones-calculo.md`](./prds/25-correcciones-calculo.md)),
  **cerrada** el 2026-10-01: los 18 errores y dos más que salieron al
  implementar;
- **Fase 27** — segundo pulido
  ([`prds/26-segundo-pulido.md`](./prds/26-segundo-pulido.md)), **cerrada**
  el 2026-10-01;
- **Fase 28** — ida y vuelta en la compensación (CR1)
  ([`prds/27-desnivel-adoptado.md`](./prds/27-desnivel-adoptado.md)),
  **cerrada** el 2026-10-01;
- **Fase 30** — estabilidad de los BMs (CR2)
  ([`prds/29-estabilidad-bms.md`](./prds/29-estabilidad-bms.md)),
  **cerrada** el 2026-10-02;
- **Fase 31** — avisos del cálculo (CR4)
  ([`prds/30-avisos-del-calculo.md`](./prds/30-avisos-del-calculo.md)),
  **cerrada** el 2026-10-02;
- **Fase 32** — rigor estadístico (CR3)
  ([`prds/31-rigor-estadistico.md`](./prds/31-rigor-estadistico.md)),
  **cerrada** el 2026-10-02.

Con la 32 no queda ningún criterio del cálculo pedido por resolver: el resto
de la § 2 de la auditoría queda documentado, sin cambio.

Ese mismo día, con la Fase 28 ya abierta, el usuario pidió que los puntos de
control de asentamientos **dejen de tener posición**: sin coordenadas ni
distorsión angular. Es A3, en «Control de asentamientos», y la **Fase 29**
([`prds/28-puntos-sin-posicion.md`](./prds/28-puntos-sin-posicion.md)),
**cerrada** el 2026-10-01, después de la 28 (decisión del usuario). Retiró la
distorsión de CR2 (D-9).

El 2026-10-03 el usuario pidió una navegación más moderna, tipo app web, con
un header compacto: «Navegación», al final. HC1 es la **Fase 33**
([`prds/32-header-compacto.md`](./prds/32-header-compacto.md)), **cerrada** el
2026-10-03; HC2 queda sin fase.

Ese mismo día pidió poder **reabrir** lo cerrado: «Reabrir procesos», al
final. Es la **Fase 34**
([`prds/33-reabrir-procesos.md`](./prds/33-reabrir-procesos.md)), **cerrada**
el 2026-10-03, trabajada en un worktree aparte mientras la 33 seguía abierta.

El 2026-10-05 pidió empezar a refactorizar la UX por la poligonal, y dejar de
cerrarla: «UX de la poligonal», al final. Es la **Fase 35**
([`prds/34-ux-poligonal.md`](./prds/34-ux-poligonal.md)), **cerrada** el
2026-10-06. La cartera real de asentamientos, que iba a ser la 35, pasa a la
36.

Ese mismo día pidió aplazar esa cartera y llevar el modelo de la poligonal a
nivelación y asentamientos: «UX de nivelación y asentamientos», al final. Son
las **Fases 36 y 37**, con la hoja de ruta en
[`superpowers/specs/2026-10-06-ux-nivelacion-asentamientos-design.md`](./superpowers/specs/2026-10-06-ux-nivelacion-asentamientos-design.md).
La cartera real de asentamientos entra en la 37. La **Fase 36** se abrió el
mismo día ([`prds/35-ux-nivelacion.md`](./prds/35-ux-nivelacion.md)) y se
**cerró** el 2026-10-07. La **Fase 37**
([`prds/36-ux-asentamientos.md`](./prds/36-ux-asentamientos.md)), con la
cartera, se abrió y se **cerró** el 2026-10-07: con ella ningún proceso se
cierra.

El 2026-10-08 pidió dejar el informe de cada proceso en su propia página,
con el PDF y un Excel con fórmulas allí mismo, y quitar los informes
consolidados: «Informe de cada proceso», al final. Es la **Fase 38**
([`prds/37-informe-por-proceso.md`](./prds/37-informe-por-proceso.md)),
abierta y **cerrada** ese mismo día.

El 2026-10-07, al probar la poligonal rediseñada, el usuario reportó tres
fallos, corregidos sin fase en la rama `fase-35-correcciones`, y pidió dejar
anotado lo mismo para la nivelación: «Catálogos en la nivelación», al final,
sin fase.

Las peticiones anteriores están todas resueltas; las últimas, UI1 y UI2,
cerraron en la Fase 20. La tabla y los textos de abajo se conservan como
registro.

La Fase 18 (libreta de nivelación y panel de asentamientos, a partir del
prototipo del usuario) dejó cuatro peticiones nuevas **sin fase**: N7 y N8 en
«Nivelación» —dos sospechas sobre el motor y el validador de nivelación que la
fase encontró y no tocó, porque cambian resultados de nivelación— y UI1 y UI2,
al final de este archivo. **N7 y N8 cerraron en la Fase 19; UI1 y UI2, en la
Fase 20.**

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
| ~~UI1 + UI2~~ | **20** — Identidad visual del prototipo y coma decimal | **cerrada** (2026-09-25) |

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

> **Resuelta en la Fase 10** ([`prds/09-nomenclatura-nivelacion.md`](./prds/09-nomenclatura-nivelacion.md)).
> Se conserva el texto de la petición como registro.

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

### A3 · Puntos de control sin posición

> **Resuelta en la Fase 29** ([`prds/28-puntos-sin-posicion.md`](./prds/28-puntos-sin-posicion.md)),
> cerrada el 2026-10-01. Se conserva el texto de la petición como registro.

Pedida el 2026-10-01, al revisar el proceso de demo de asentamientos:
«Necesito quitar todo lo que hace referencia a que la espacialidad de los
puntos, no vamos a manejar ni coordenadas ni distancias conocidas entre
puntos (Distorsión angular)».

Un punto de control queda con código, ubicación (texto), C0 y su serie de
cotas. Sin Norte ni Este no hay distancia entre puntos y, sin distancia, no
hay distorsión angular.

**Decisiones tomadas el 2026-10-01:**

- **Los diferenciales se van con la distorsión.** El diferencial
  |Δsᵢ − Δsⱼ| no necesita coordenadas, pero sin posición no se sabe qué pares
  son vecinos, y una tabla de todos contra todos (28 pares en Torre Alameda)
  no dice nada. Se quitan el cálculo, la tarjeta del panel y la hoja del
  Excel. El asentamiento máximo y el promedio siguen.
- **Las columnas se borran con una migración**, no se dejan muertas:
  `settlement_points.northing`, `settlement_points.easting` y
  `sites.angular_distortion_limit`. El trigger de la Fase 23 vuelve a vigilar
  solo la C0. Es irreversible: las coordenadas que haya en producción se
  pierden con el `db push`, que va con el visto bueno del usuario.
- **El catálogo de puntos de referencia del proyecto no cambia.** Lo
  comparten las poligonales, y un BM de amarre ya puede ir sin coordenadas.
- **BM-1 y BM-2 de Torre Alameda pierden sus coordenadas ficticias**
  (petición del usuario, «si las nivelaciones no llevan nada relacionado con
  coordenadas»). Verificado: nada de nivelación lee las coordenadas de un
  punto de referencia, solo su cota. Ni el motor, los validadores, el editor,
  el Excel o el informe del módulo, ni la libreta de la visita, ni la
  nivelación de la demo. Esas coordenadas solo las usan las poligonales: el
  amarre, el azimut y la georreferenciación.
- **BM-01 y BM-02 del seed también** (petición del usuario). Están en el
  catálogo de «Lote catastral» y ningún proceso del seed los usa como amarre;
  el selector del BM de partida de una nivelación toma de ellos el código y la
  cota. GPS-1 conserva las suyas: es un punto GPS.

**Lo que se quita.** Es el inventario de la petición; el PRD lo verifica.

| Capa | Qué |
|---|---|
| Base | Las tres columnas, y las coordenadas del trigger `c0_con_lecturas_cerradas` y de su prueba pgTAP |
| Motor | `horizontalDistance` y `computeDifferentials` (`settlement.ts`), `worstDistortion` (`settlement-summary.ts`), `DifferentialPair` y `angularDistortionLimit` (`types/settlement.ts`) |
| Captura | Norte y Este en el catálogo de puntos, con su regla «las dos o ninguna»; el límite 1/X en los umbrales del lugar; la copia de los tres al duplicar un lugar; la comparación de coordenadas en `validators/settlement.ts` y `point-actions.ts` |
| Panel | El KPI «Distorsión angular» y la tarjeta «Asentamientos diferenciales y distorsión angular» |
| Excel | Las columnas Norte y Este, la hoja de diferenciales, la fila del límite y «Pares que superan la distorsión» |
| Demo y seed | Las coordenadas de los puntos de Torre Alameda y de los lugares del seed, las de BM-1 y BM-2 (`north` y `east` de `AmarreAlameda` en `torre-alameda.ts` y su copia en `fixtures.ts`), y las de BM-01 y BM-02 (`REFERENCE_POINTS` en `scripts/seed.mjs`) |
| Documentación | El manual en sus dos copias y sus capturas; PRD principal § 3, § 4 y § 6.10; doc técnica |

**Lo que no cambia:** el informe consolidado, que no muestra ni coordenadas ni
distorsión de asentamientos, así que ningún informe emitido cambia con la
migración. El semáforo tampoco: la distorsión nunca entró en él.

**Por decidir al redactar el PRD:**

- El panel se queda con cinco KPIs: qué ocupa el sexto hueco, o cómo se
  reacomoda la rejilla.
- En los proyectos de ejemplo ya creados, BM-1 y BM-2 conservan sus
  coordenadas: la demo nueva sale sin ellas, pero la migración no toca
  `reference_points`. Decidir si se limpian, y cómo reconocerlos sin tocar un
  BM real del usuario con el mismo código.
- El marco teórico (`docs/marco-teorico/mt-control_asentamientos.docx`)
  explica la distorsión. Es material de la monografía y la app no lo toca; si
  se anota allí que queda fuera del alcance, lo decide el usuario.

---

## Interfaz

### UI1 · Identidad visual del prototipo de asentamientos

> **Resuelta en la Fase 20** ([`prds/19-identidad-visual-coma-decimal.md`](./prds/19-identidad-visual-coma-decimal.md)).
> Toda la app, con modo oscuro que sigue al sistema y se fuerza con un
> selector. Se conserva el texto de la petición como registro.

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

> **Resuelta en la Fase 20** ([`prds/19-identidad-visual-coma-decimal.md`](./prds/19-identidad-visual-coma-decimal.md)).
> Coma o punto al teclear; la presentación sigue con punto. Se conserva el
> texto de la petición como registro.

Las celdas numéricas de captura son `type="number"`, que no acepta la coma
decimal que teclea un usuario en español. La importación de la Fase 16 sí la
acepta en la plantilla CSV con `;`. Afecta a la libreta de nivelación, a la de
la visita y a la captura de poligonales. Anotada en la Fase 18, que capturó en
vivo sin resolverla.


---

## Integridad (Fase 23)

> **Resuelta en la Fase 23** ([`prds/22-integridad.md`](./prds/22-integridad.md)).
> Se conserva el texto de la petición como registro.

Pedida el 2026-09-29, junto con la Fase 22, y separada de ella por decisión
del usuario. Las cuatro vienen de la § 11
de la doc técnica, donde está el detalle.

### I1 · Guardados en una sola transacción

`saveVisitAction` escribe la cabecera de la visita, la libreta, su purga y las
lecturas en peticiones separadas; la georreferenciación escribe la cabecera y
luego estación por estación. Si una falla a mitad, los datos quedan
desalineados hasta el siguiente guardado (visita) o en dos sistemas de
coordenadas (georreferenciación). La salida limpia es una función de Postgres
por operación, que haga todo en una transacción.

### I2 · La C0 de un punto con lecturas cerradas

La cota inicial de un punto vigente se puede editar aunque tenga lecturas en
visitas cerradas, y eso reescribe el histórico que muestran el panel, el
informe y el Excel. La Fase 11 lo cerró solo para los puntos de baja. La regla
natural: bloquear la C0 en cuanto el punto tenga una lectura cerrada.

### I3 · El informe emitido se congela

La portada de un informe ya emitido lee el proyecto en vivo (nombre, cliente,
ubicación, datum), y `reports` no tiene trigger de inmutabilidad: editar el
proyecto cambia informes que ya existen.

### I4 · Los dos cabos sueltos de la Fase 9

El respaldo `Math.min(...) || Infinity` de la tolerancia de discrepancia en
`computeLeveling`, y los parámetros por defecto de `order` y
`distancesReconstructed` en `validateRunCapture`.

## Pulido (Fase 24)

> **Resuelta en la Fase 24** ([`prds/23-pulido.md`](./prds/23-pulido.md)).
> PU1 ya estaba resuelto en el código y se cerró en la documentación; PU9 se
> confirmó (la lectura cruda se guardaba con 65″).
> Se conserva el texto de la petición como registro.

Pedida el 2026-09-30. Las cinco primeras vienen de la § 11 de la doc técnica;
las demás, de la revisión de pendientes y de reescribir los recorridos de
`docs/testing/` contra la aplicación.

### PU1 · Un solo formato de la precisión relativa

El mismo proceso se lee `1:1001` en el listado y `1:1.001` en el editor: hay
cuatro copias de `formatPrecision` con criterios distintos.

### PU2 · El código de punto se corta en la tabla de estaciones

El campo mide `w-24`: «Famarena_5» se ve «Famaren». El valor está intacto.

### PU3 · El campo de distancia sin nombre accesible en escritorio

En móvil lleva `aria-label`; en la tabla de escritorio, ninguno.

### PU4 · Cuántos procesos, por estado

La tarjeta del proyecto dice «7 procesos» sin distinguir borradores,
calculados, cerrados y rechazados.

### PU5 · La paleta del Excel

`lib/export/workbook.ts` sigue con el azul y los grises anteriores a la Fase 20.

### PU6 · Esqueletos de carga en las altas

«Nuevo proyecto» y los `new` de cada módulo no tienen `loading.tsx`; la
tarjeta de proyecto tampoco tiene hover de fondo.

### PU7 · «Fuera de tolerancia» cuenta lugares cerrados

El KPI del dashboard suma cualquier lugar con una lectura en alerta o alarma,
aunque esté cerrado: la demo regenerada muestra «1» por Torre Alameda, bajo el
rótulo «Requieren revisión antes del cierre». Poligonales y nivelaciones solo
cuentan las calculadas.

### PU8 · «Borrador» en el informe de un proceso rechazado

La pestaña Informe de un proceso rechazado dice «Borrador — el informe se
emite al cerrar el proceso», aunque ya está cerrado para siempre.

### PU9 · Segundos de 60 o más en una lectura de ángulo (por confirmar)

Al revisar los recorridos, 65″ en una lectura se mostró como 1′05″ sin error:
la regla «Los segundos deben estar entre 0 y 59» mira el ángulo promedio, que
llega ya normalizado. Hay que confirmarlo en el código.

### PU10 · V− vacía en un punto de cambio

Una nivelación se guarda con un punto de cambio sin V−; solo la comprobación
aritmética impide cerrarla. Decidir si es captura parcial legítima o un hueco.

## Catálogo de equipos (Fase 25)

> **Resuelta en la Fase 25** ([`prds/24-catalogo-equipos.md`](./prds/24-catalogo-equipos.md)).
> Se conserva el texto de la petición como registro.

Pedida el 2026-09-30 al revisar los pendientes: «sí, prepara el PRD del
catálogo de equipos». Viene de la § 11 de la doc técnica: cada poligonal,
nivelación y visita recaptura marca, modelo, serie, calibración y precisión
del mismo aparato. La Fase 8 lo difirió porque una tabla referenciada por id
cambiaría en silencio el equipo de los informes cerrados; se reabre con el
congelado resuelto: el catálogo es una plantilla y el proceso copia.

## Criterios del cálculo (sin fase)

Pedidos el 2026-10-01, después de leer la auditoría del motor
([`auditoria-calculo.md`](./auditoria-calculo.md), § 2): el usuario eligió
cambiar estos cuatro grupos. Cada uno pide su propia decisión al abrir su
fase, después de la 27. El resto de la § 2 queda documentado, sin cambio.

### CR1 · Desnivel adoptado en la compensación (D-1)

> **Resuelta en la Fase 28** ([`prds/27-desnivel-adoptado.md`](./prds/27-desnivel-adoptado.md)),
> cerrada el 2026-10-01: ida y vuelta compensadas como circuito y una cota por
> punto, con el BM de partida fijo. Las fórmulas, en `docs/math/nivelacion.html`.

Hoy las cotas de una nivelación con vuelta salen solo de la ida, compensada
con su propio cierre. Ida y vuelta son dos observaciones del mismo desnivel:
compensar el lazo ida + vuelta las combina, como dice el marco teórico
(§ 2.5). En El Verjón, D4 sube 2.5 mm; en el tramo 2 de la demo, un mismo
punto deja de tener dos cotas. Hace falta un método de corrección nuevo para
que lo cerrado conserve el suyo, y revisar el criterio de la vuelta de la
Fase 26 (C-10).

### CR2 · Estabilidad de los BMs (D-13)

> **Resuelta en la Fase 30** ([`prds/29-estabilidad-bms.md`](./prds/29-estabilidad-bms.md)),
> cerrada el 2026-10-02: cuando la libreta de una visita pasa por otro BM del
> catálogo, la app compara su cota y avisa si no nivela. Se conserva el texto
> de la petición como registro.

- Avisar si la libreta de una visita no nivela entre BM-1 y BM-2: un BM movido
  hace que todos los puntos «se asienten» a la vez (marco teórico § 2.3).

La segunda mitad, la distorsión angular en el semáforo (D-9), se retiró el
2026-10-01: los puntos de control dejan de tener posición (A3).

### CR3 · Rigor estadístico (D-3, D-6, D-7)

> **Resuelta en la Fase 32** ([`prds/31-rigor-estadistico.md`](./prds/31-rigor-estadistico.md)),
> cerrada el 2026-10-02. Tras consultar la norma, el usuario eligió los
> límites de equilibrado de la FGCS con el acumulado por sección (D-3), la
> prueba χ² al 95 % para σ₀ (D-6) y el margen con la longitud real del
> circuito de cada visita (D-7). Se conserva el texto de la petición como
> registro.

- Control acumulado del equilibrado de visuales en la sección, y límites por
  armada con fuente.
- σ₀ de mínimos cuadrados con la prueba χ² y su redundancia, en vez de la
  banda [0.5, 2].
- Margen del aviso de tendencia derivado de la longitud real de los circuitos.

### CR4 · Avisos (D-4, D-5, D-8, D-10)

> **Resuelta en la Fase 31** ([`prds/30-avisos-del-calculo.md`](./prds/30-avisos-del-calculo.md)),
> cerrada el 2026-10-02. Tras consultar la norma, el usuario quitó los avisos
> de equipo insuficiente (D-4) y de dispersión (D-5); D-8 pasó al promedio
> encadenado y D-10 exige superar el margen de ruido. Se conserva el texto de
> la petición como registro.

- Equipo insuficiente comparado con la tolerancia como error máximo.
- Dispersión de lecturas con el cuantil del rango de m lecturas.
- Promedio encadenado de asentamientos.
- «Acelerando» solo por encima del ruido de la velocidad.

## Navegación

Pedida el 2026-10-03: «ayúdame a iterar sobre la navegación y el header. Una
UX más moderna tipo app web, con fácil navegación y header compacto». El
usuario delegó el diseño: «rediseña el header como recomiendes».

### HC1 · Header compacto con la ruta

> **Resuelta en la Fase 33** ([`prds/32-header-compacto.md`](./prds/32-header-compacto.md)),
> cerrada el 2026-10-03: una barra fija de 48 px con la ruta dentro, Equipos y
> Manual con icono y un menú de cuenta. Se conserva el texto de la petición
> como registro.

El header ocupa 61 px y se va con el scroll. Debajo, cada página apila migas,
título y pestañas: el título empieza a 129 px en escritorio y a 133 en el
móvil, y para navegar hay que subir hasta las migas. La propuesta es una barra
fija de 48 px con la ruta dentro, Equipos y Manual con icono, y un menú de
cuenta con el correo, el tema y «Cerrar sesión».

### HC2 · Saltar entre proyectos y procesos desde la ruta

Sin fase. Es la continuación natural de HC1: un selector en cada miga de la
barra —el proyecto, el proceso o el lugar— para ir a otro sin pasar por el hub
ni por el dashboard. Se deja fuera de la Fase 33 para ver primero cómo
funciona la barra. La revisión de la Fase 33 dejó un detalle para esta misma
iteración: entre 640 y unos 860 px la ruta se trunca por igual, y el nombre de
la página actual es lo que menos se lee.

## Reabrir procesos (Fase 34)

> **Resuelta en la Fase 34** ([`prds/33-reabrir-procesos.md`](./prds/33-reabrir-procesos.md)),
> abierta y cerrada el 2026-10-03 en un worktree aparte mientras la 33 seguía
> en curso. La cartera real de asentamientos, que iba a ser la 34, pasa a la
> 35. Se conserva el texto de la petición como registro.

El 2026-10-03 el usuario pidió: «necesito poder reabrir procesos para
modificar». Y después: «solo hazlo simple y fácil poder editar aun cerrada, o
cambiar el estado de cerrada a abierta en cualquier momento».

Hoy cerrar es irreversible y la base lo garantiza por trigger. La petición
abarca los cuatro cierres: poligonal, nivelación, visita y lugar.

## UX de la poligonal (Fase 35)

> **Resuelta en la Fase 35** ([`prds/34-ux-poligonal.md`](./prds/34-ux-poligonal.md)),
> abierta el 2026-10-05 con maquetas aprobadas y cerrada el 2026-10-06. Se
> conserva el texto de la petición como registro.

El 2026-10-05 el usuario pidió: «empecemos con la refactorización de la UX, y
simplificar lo que no es muy necesario, empezando por las poligonales». Un
alta en popup con pocos campos, una pantalla por pasos —datos, ajuste,
informe— con la tabla y el dibujo lado a lado, pensada para el teléfono, y un
informe que diga cómo se corrigió según el método, con las fórmulas en
notación matemática.

Después: «aprovechemos esto para deprecar la función de cerrar procesos […]
no quiero limitar las modificaciones», quitándolo «de todo», por ahora solo en
la poligonal.

## UX de nivelación y asentamientos (Fases 36 y 37)

El 2026-10-06, con la Fase 35 en producción, el usuario pidió: «podemos
aplazar la siguiente fase, y mejor haz un plan para que repliquemos este
modelo de ux/ui para el caso de nivelaciones y control de asentamientos,
replicando lo que hicimos para refinar el diseño en el módulo de poligonales».

Decidió:

- **Quitar el cierre en los dos módulos**, como en la poligonal.
- **Que los lienzos se propongan sin una descripción previa**, guiados por las
  carteras: «en la parte de gráfico para la nivelación, por ejemplo, puede ir
  dibujado el recorrido».
- **Meter la cartera real de asentamientos en la fase de UX de asentamientos.**
- **Extraer lo común en la fase de nivelación.**

La nivelación va primero (Fase 36) y asentamientos después (Fase 37). La hoja
de ruta, la receta de cada fase y el contenido de los dos lienzos están en
[`superpowers/specs/2026-10-06-ux-nivelacion-asentamientos-design.md`](./superpowers/specs/2026-10-06-ux-nivelacion-asentamientos-design.md).
Los lienzos se ajustan al verlos: «por ahora sí, al verlos visualmente
ajustamos».

En la revisión del lienzo de la Fase 37 (2026-10-07) el usuario precisó cómo
mide una visita, y entra en esa fase:

- «cuando se esté registrando la visita, se guarda cada lectura, por si se
  interrumpe en el proceso, solo va a la visita y le da en retomar medición»;
- «una visita tendrá múltiples libretas, cada vez que se arma […] solo en
  algunos casos se forma un circuito de nivelación donde, al armarse, necesita
  sacar un BM adicional, hacer V−, armarse allí y seguir la medición»; en la
  interfaz, «+ Armada»;
- un catálogo de BM por lugar, en su propia pestaña: «cuando se importe un
  catálogo de BM, tanto del proyecto o en CSV, quedan allí solo para este
  proceso, no es que queden sincronizados con la nivelación que se importó.
  Además se pueden modificar los datos de estos BM fácilmente o agregar más»;
- «no manejemos compensar nivelaciones aquí»: la visita no se compensa.

## Semáforo por velocidad con margen de ruido (sin fase)

Lo anticipó el análisis de la cartera real de asentamientos (2026-10-03) y lo
confirmó el lienzo de la Fase 37: con los umbrales de edificio, las visitas 2
a 5 de la cartera salen en **alarma por velocidad por puro ruido**. Un
milímetro en siete días son 4.35 mm/mes —precaución— y tres, 13 mm/mes
—alarma—, con una mira que resuelve el milímetro. El margen de ruido
de la Fase 32 se aplica a los avisos de tendencia, no al semáforo. La hoja de
ruta de las Fases 36 y 37 lo deja fuera de su alcance, como petición aparte.

## Catálogos en la nivelación (sin fase)

El 2026-10-07, al probar la poligonal rediseñada, el usuario reportó que el
equipo no se podía escribir («sale por defecto Leica. Quitar eso y llenar
formulario escribiendo»): «Tomar del catálogo» era lo primero del bloque y
solo ofrecía el equipo de la demo. También, que las coordenadas del amarre no
se podían corregir para que recalculara todo, sin volver a meter ángulos y
distancias. Los dos se corrigieron en la poligonal, en la rama
`fase-35-correcciones`: el alta pide el equipo escribiendo, y el amarre
corrige el punto del catálogo, con aviso de qué cambia.

### NC1 · Los catálogos en el alta de la nivelación

Al preguntarle si «Tomar del catálogo» del equipo se quitaba también en el
alta de la nivelación, que usa el mismo bloque (`EquipmentIdentity`), pidió:
«por ahora poligonal, pon en pendientes quitar los catálogos de puntos también
para el módulo de nivelación». Justo después cambió de plan para los puntos:
«podemos tener catálogo de puntos para no cambiar mucho nuestra
implementación actual, pero necesito versatilidad para cambiarlos o crearlos
en los formularios».

Al abrir la fase, confirmar el alcance: quitar el selector del equipo del alta
de la nivelación, como en la poligonal; y para los BMs del catálogo de puntos,
probablemente lo mismo que en el amarre —crearlos y corregirlos desde el
formulario— en vez de quitarlos.

## Informe de cada proceso (Fase 38)

El 2026-10-08, con la Fase 37 ya en producción, el usuario pidió: «planees
como dejar el acceso al informe de cada proceso en su página de informe, y
allí mismo exportar el pdf y el excel formulado. No a nivel de proyecto ni
informe que reúna procesos, quitamos las demás páginas o restos que queden».
Sobre el Excel: «la idea es casi imitar pero mejorando diseño los excel que
tenemos de casos de ejemplo» —las carteras de `docs/carteras/`—, con fórmulas
vivas. Eligió el PDF del navegador y una sola fase.

## Mínimos cuadrados: requisitos y precisión de cada punto (Fase 39)

El 2026-10-08 un usuario de la app preguntó por qué «para la de mínimos no
salen resultados», creyendo que «necesitaría más lecturas por puntos». No es
así: faltaban los tres pesos, y «Mediciones por distancia» se confunde con las
lecturas. El usuario respondió: «sí, esas consideraciones debemos tenerlas en
cuenta, parecen esenciales», y trajo un texto sobre el ajuste de Gauss-Markov
con pesos por la precisión del instrumento y elipses de error. Eligió
**aclarar los requisitos del método y añadir la precisión de cada punto**
(σ N, σ E y elipses, en tabla y dibujadas). Es la **Fase 39**
([`prds/38-precision-minimos-cuadrados.md`](./prds/38-precision-minimos-cuadrados.md)).

## Informes entregables (Fase 40)

El 2026-10-08 el usuario pidió que los informes «sean entregables que
funcionen agnósticamente a lo que tenemos en la plataforma» —sin «catálogo»
ni el enlace en el pie— y que solo lleven las fórmulas que sí es necesario
presentar, «como la de mínimos cuadrados en poligonales, no las de cómo
calcular cotas en control de asentamientos». Eligió un pie propio en el PDF,
quitar el reparto angular y las fórmulas de asentamientos, y reescribir las
frases con el estado del proceso en la app. Es la **Fase 40**
([`prds/39-informes-entregables.md`](./prds/39-informes-entregables.md)),
**cerrada** y en producción el 2026-10-08.
