# PRD-de-fase 26 — Correcciones del cálculo

**Estado:** cerrada
**Fecha de apertura:** 2026-10-01
**Fecha de cierre:** 2026-10-01

**Rama:** `fase-26-correcciones-calculo`
**Petición:** del usuario, 2026-10-01: «haz double check de las fórmulas y
métodos de cálculo que usamos en cada módulo». Después de leer la auditoría
eligió «Correcciones primero»: esta fase va antes del segundo pulido (Fase 27).
**Módulo:** transversal — motor y validadores de poligonal, nivelación y
asentamientos, sus acciones de servidor y la documentación

> **Divergencias de la implementación:**
>
> - **Dos errores más, fuera de la auditoría.** **C-19:** al implementar C-2
>   salió que el servidor validaba las estaciones sin la fila de cierre: una
>   cerrada amarrada con fila de cierre, como TT4, no se podía guardar desde
>   el editor. **C-20:** al verificar C-2 en pantalla salió que el editor
>   nunca recibió el catálogo de puntos (desde la Fase 3): un proceso
>   amarrado se veía «Sin amarre / manual», sin azimut calculado ni casilla
>   de fila de cierre. Los dos se corrigieron en la fase.
> - **C-13 con un margen, no redondeando.** El error se compara con
>   `|E| ≤ T + 1e-6 mm` (`withinTolerance`). Redondear E y T a 0.1 mm habría
>   cambiado la tolerancia en hasta 0.05 mm; el margen solo absorbe el ruido.
> - **C-4 rechaza además lo que la base redondearía:** segundos con más de una
>   cifra decimal y distancias con más de cuatro. Era el mismo tipo de fallo
>   que señalaba la auditoría.
> - **C-10 bloquea sin tolerancia.** Una cerrada o de enlace sin la tolerancia
>   de algún recorrido —le faltan distancias— ya no ofrece cerrar en el
>   diálogo; el servidor ya lo rechazaba.
> - **C-2:** el ángulo de orientación de una abierta fija el datum y no se
>   corrige, como en la cerrada sin fila de cierre. La casilla de la fila de
>   cierre se muestra solo en las cerradas, que son las que la usan.
> - **C-15 conserva la regla de la línea base** junto a la nueva: con datos
>   anteriores a la fase, una visita cerrada con la anterior abierta podría
>   existir (en producción no hay ninguna).
> - **Verificación en pantalla.** C-19, C-2/C-20, C-10, C-11, C-15 y C-16 se
>   vieron en local a 1280 px en claro y 390 px en oscuro, sin errores de
>   consola ni desborde. C-1 se cubre con tests del motor: en local no hay
>   una cerrada amarrada del otro lado. Visto al verificar: con los tres
>   hilos capturados, la distancia tecleada se ignora aunque la celda la
>   muestre (anotado en la § 11).
> - **Lint:** `equipment-picker.test.ts` (Fase 25) pasaba los hijos como prop;
>   corregido en la fase.

## Propósito

La auditoría del motor de cálculo ([`../auditoria-calculo.md`](../auditoria-calculo.md))
confirmó las fórmulas de libro sobre todas las carteras reales. También
encontró **18 errores** (C-1 a C-18) en esquemas que esas carteras no cubren,
en reglas de validación y en límites numéricos. Seis son graves: dan un
resultado equivocado o dejan cerrar sin aviso.

Esta fase los corrige, cada uno con el test que lo habría detectado, y
corrige la documentación que contradice el código (§ 3 de la auditoría).

**No cambia ningún criterio.** Tolerancias, avisos y el desnivel adoptado
(§ 2 de la auditoría, D-1 a D-18) son decisiones del usuario y van en una fase
aparte.

## Hallazgos que condicionan la fase

### 1. Producción no tiene datos afectados

Consultas de solo lectura en la nube, el 2026-10-01:

| Comprobación | Resultado |
|---|---|
| Poligonales | 3, todas cerradas, interiores y con amarre; ninguna abierta (C-2) ni exterior con fila de cierre (C-1) |
| Distancias por visual ≤ 0 | 0 de 41 lecturas de nivelación y 0 de 154 de libretas (C-11) |
| Visitas con fecha repetida en un lugar | 0 (C-16) |
| Visitas cerradas con una anterior abierta | 0 (C-15) |

TT4, la única con fila de cierre, tiene el amarre fuera del barrido (k = 1):
la corrección de C-1 le da el mismo resultado.

### 2. Lo cerrado no cambia

Los arreglos del motor cambian lo que se calcula al guardar un proceso
abierto. Los cerrados conservan lo guardado (triggers de inmutabilidad), y
las reglas nuevas de cierre solo se aplican a cierres futuros.

La excepción es la **presentación**: el editor y el panel recalculan en vivo.
En una poligonal cerrada con la geometría de C-1, el editor pasaría a mostrar
el resultado correcto, y no hay ninguna en producción.

### 3. C-14 sale del segundo pulido

La distancia acumulada en coma flotante es aritmética del motor, como C-13,
y se arregla con la misma idea: enteros. Pasa a esta fase y el PRD de la
Fase 27 la quita.

## Alcance

### A. Poligonal

| # | Arreglo |
|---|---|
| C-1 | Con amarre y fila de cierre, la suma teórica es base + 360·k, con k = redondeo de (Σ − base)/360 limitado a 0 o 1. Fuera de ese rango se conserva el error para que una declaración interior/exterior equivocada se siga detectando. Mínimos cuadrados (`leastSquaresClosed`) recibe la misma suma teórica |
| C-2 | Con amarre, el primer lado de las abiertas sale del azimut hacia el amarre más el ángulo de orientación de la primera fila, medido a la derecha desde el amarre, como en la cerrada (decisión 1). En las abiertas amarradas la tabla rotula ese ángulo como orientación, aunque las demás filas sean deflexiones |
| C-3 | `evaluatePolygonalClosure` en la abierta con control: el error angular fuera de tolerancia también obliga a rechazar. Se corrige el test que fijaba lo contrario |
| C-4 | Una sola función de promedio de lecturas para el editor, el servidor, el informe, el Excel y la georreferenciación. El servidor calcula con el promedio redondeado a 0.1″, que es lo que guarda la estación |
| C-5 | `parseNumber` en `readingValues` y `dmsFieldsToDecimal`: una lectura con coma decimal cuenta igual en el editor y en el servidor |
| C-6 | Promedio y dispersión circulares: cada lectura se desenvuelve respecto a la primera, en (−180°, 180°], antes de promediar |
| C-7 | Convergencia de mínimos cuadrados con umbral 10⁻⁸ σ, o convergida cuando el cambio se estanca y las condiciones cumplen a 10⁻⁹ |
| C-8 | Se quita el control de reorientación (decisión 3): del motor, del panel de resultados, de los tests y del manual. No se guarda en la base |
| C-9 | La matriz normal se escala por su diagonal antes de resolver; el pivote deja de mezclar radianes y metros |

### B. Nivelación

| # | Arreglo |
|---|---|
| C-10 | En una cerrada o de enlace con vuelta, cada recorrido se juzga con su propia tolerancia K·√D (decisión 2): la ida con su distancia y la vuelta con la suya. Si alguno no cumple, solo puede cerrarse como rechazado, y el mensaje dice cuál |
| C-11 | Una distancia por visual ≤ 0 es error de captura (validador, Server Action, lector CSV). Migración: CHECK `> 0` en `back_distance_m` y `fore_distance_m` de `leveling_readings` y `settlement_book_readings` |
| C-12 | `computeLeveling` devuelve la comprobación aritmética de los dos recorridos, y el cierre exige ambas |
| C-13 | El error de cierre y la discrepancia se redondean a 0.1 mm —la resolución de las lecturas— antes de compararlos con la tolerancia |
| C-14 | `accumulateDistances` redondea cada distancia a milímetros y suma en enteros: 164.5 m dan 0.165 km |

### C. Asentamientos

| # | Arreglo |
|---|---|
| C-15 | Una visita no se cierra si está abierta la visita que contiene la lectura anterior de cualquiera de sus puntos. La regla actual de la línea base es un caso particular y se integra |
| C-16 | La fecha de una visita exige anterior < fecha < siguiente, excluida ella misma, al guardar y al cerrar. Migración: `UNIQUE (site_id, date)` en `settlement_visits`. `loadContext` ordena las visitas por fecha |

### D. Común

| # | Arreglo |
|---|---|
| C-17 | `roundsOnStorage` avisa solo si la diferencia supera la resolución de la vista (5·10⁻⁷°) |
| C-18 | `formatCoordinate` (y los demás formateadores de decimales fijos) redondea los empates hacia arriba en valor absoluto, como el formato de Excel |

### E. Documentación (§ 3 de la auditoría)

- **Manual, dos copias:**
  - las intermedias **sí** se compensan;
  - se quita el control de reorientación;
  - § 7.3 y § 7.6 (la visita 0 y por qué no se edita una intermedia);
  - las reglas nuevas de cierre y de fechas.
- **Comentarios del código:**
  - cabecera de `polygonal.ts`;
  - `types/leveling.ts` y `validators/leveling.ts`;
  - `tolerances.ts` (la n de la tolerancia angular, la clase de la FGCS);
  - `leveling.ts`;
  - el motivo de L = 0 en `settlement.ts`;
  - `panel-tab.tsx`.
- **`PRD-TopoField.md`:** Crandall (§ 6.5), el desnivel adoptado (§ 6.9), la
  distorsión y la línea base (§ 6.10) y el aviso de tendencia (§ 5.3).
- **Doc técnica § 6 y § 7:**
  - la regla del +360;
  - el umbral de cierre exacto;
  - «nada convierte con `Number()`»;
  - el motivo de L = 0.
- **`docs/math/poligonales.html`:** la convención de azimut de la Fase 7.
- **Análisis de `docs/carteras/`:** una nota al principio de cada uno, con lo
  que la auditoría corrige. No se reescriben: son el registro de su momento.

## Decisiones del usuario (apertura)

1. **C-2: en las abiertas con amarre se calcula la orientación**, como en la
   cerrada. Es lo que la pantalla ya promete y lo habitual en campo; quitar el
   amarre de las abiertas impediría amarrarlas a un punto conocido.
2. **C-10: cada recorrido con su K·√D.** La ida y la vuelta deben cumplir
   cada una su tolerancia. Es simple, estricto y no depende del desnivel
   adoptado (D-1), que el usuario pidió para una fase posterior: si esa fase
   compensa ida y vuelta juntas, revisará este criterio.
3. **C-8: se quita el control de reorientación.** Con los ángulos sin corregir
   coincidiría siempre con el error angular, que ya se muestra.
4. **Los criterios de la auditoría (§ 2) se cambian después**, en fases
   propias: D-1; D-13 y D-9; D-3, D-6 y D-7; D-4, D-5, D-8 y D-10. Quedan
   anotados en `pendientes.md`.

## Decisiones

| # | Decisión | Razón |
|---|---|---|
| 1 | Ningún criterio cambia en esta fase | Las tolerancias y avisos son del usuario (auditoría § 2) |
| 2 | Cada arreglo lleva el test que lo habría detectado, con valores calculados a mano o con el cálculo independiente de la auditoría | Los tests actuales no cubrían esos esquemas |
| 3 | CHECK y `UNIQUE` en la base además de los validadores | Misma regla que las Fases 23 y 24: la acción da el mensaje, la base garantiza el dato |
| 4 | El servidor calcula con lo que guarda (C-4) | Es lo que muestran el editor, el informe y el Excel |
| 5 | El material de referencia del usuario no se toca | El marco teórico y las hojas son suyos; la auditoría § 4 le dice qué revisar |

## Pruebas

| Qué | Cómo |
|---|---|
| C-1 | Cuadrado y pentágono con datos perfectos: interiores y exteriores, amarre dentro y fuera del barrido. Error angular 0. TT4 sin cambios. Mínimos cuadrados converge |
| C-2 | Abierta sin control y con control con amarre al norte y primer lado al este: B en (0, 100) |
| C-3 | Abierta con control con −60″ y el lineal dentro: «solo como rechazado» |
| C-4 y C-5 | Lecturas [x, x+1″, x+1″] y 12,5 / 14 / 15: mismo error angular en el editor y en el servidor |
| C-6 | 359°59′56″, 0°00′02″, 0°00′06″ → 0°00′01.3″; dispersión 10″ |
| C-7 y C-9 | Casos que hoy no convergen o dan «singular» (de la auditoría): convergen |
| C-10 | Ida −5 mm y vuelta +12 mm en segundo orden: solo como rechazado, nombrando la vuelta; cerrada y de enlace |
| C-11 | Distancia −50 y 0: error de captura; pgTAP del CHECK |
| C-12 | `bm` interior con solo V+ en la vuelta: no cierra y dice por qué |
| C-13 | E = T exactos con cotas 100 y 1000: el mismo veredicto |
| C-14 | 164.5 m → 0.165 km; El Verjón sin cambio en la corrección |
| C-15 | v0 cerrada, v1 abierta, cerrar v2: bloqueado con el motivo |
| C-16 | Fecha igual a otra y por encima de una cerrada: rechazadas; pgTAP del `UNIQUE` |
| C-17 | La malla de 0.1″ en la vista decimal sin aviso; un decimal tecleado con más resolución, con aviso |
| C-18 | Empates .xxx5 positivos y negativos |

**En pantalla (local), claro y oscuro, 1280 y 390 px:** una poligonal
exterior con amarre y fila de cierre, una abierta con amarre, una cerrada con
vuelta fuera de tolerancia, una distancia negativa, el cierre de una visita con
la anterior abierta y una fecha repetida.

## Criterios de aceptación

1. Los 18 hallazgos tienen su arreglo y su test; los casos de la auditoría dan
   el resultado del cálculo independiente.
2. Las carteras reales (TT4, Vivero, El Verjón, el crudo, Torre Alameda) dan
   lo mismo que antes, salvo C-14 en la última cifra del acumulado.
3. Ningún documento del § 3 de la auditoría contradice el código.
4. `npm run typecheck`, `npm run lint`, `npm test`, `npx supabase test db` y
   `npm run build` limpios. Manual en sus dos copias y § 11 revisada.

## Fuera de alcance

- Los criterios D-1 a D-18 (auditoría § 2). Los que el usuario eligió
  cambiar van en fases posteriores, anotadas en `pendientes.md`.
- Corregir el marco teórico y las hojas de Excel del usuario (auditoría § 4).
- Volver a calcular procesos cerrados.

## Riesgos

- **C-4 cambia el error angular guardado en décimas de segundo** en los
  procesos abiertos con reiteración, al volver a guardarlos. Mitigación: es el
  valor que ya muestran el editor y el informe; se anota en el manual.
- **C-15 y C-16 bloquean flujos que hoy pasan.** Quien cierra visitas en
  desorden tendrá que cerrar antes la anterior. Mitigación: el mensaje nombra
  la visita que hay que cerrar; en producción no hay ningún caso.
- **Las migraciones en la nube.** Mitigación: hoy hay 0 filas que las
  incumplan; se vuelve a contar antes del `db push`, y la migración aborta con
  un mensaje claro si apareciera alguna.

## Tareas (en orden)

0. **Apertura:**
   - este PRD y el de la Fase 27;
   - la auditoría (`docs/auditoria-calculo.md`);
   - `CLAUDE.md` al día;
   - estados en `method.md` y `prds/README.md`, y `pendientes.md`.

   Commits `docs:`. Rama.
1. **A** — poligonal (C-1 a C-9).
2. **B** — nivelación (C-10 a C-14) y su migración.
3. **C** — asentamientos (C-15, C-16) y su migración.
4. **D** — C-17 y C-18.
5. **E** — documentación.
6. **Verificación en pantalla** en local.
7. **Cierre:** manual (dos copias) y capturas que cambien, doc técnica § 11,
   `method.md`, `prds/README.md`, `pendientes.md`, auditoría con el estado de
   cada hallazgo. Revisión de código y PR.
8. **Antes del merge:** `db push` de las dos migraciones a la nube, con visto
   bueno.
