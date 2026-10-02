# PRD-de-fase 30 — Estabilidad de los BMs

**Estado:** cerrada
**Fecha de apertura:** 2026-10-02
**Fecha de cierre:** 2026-10-02

**Rama:** `fase-30-estabilidad-bms`
**Petición:** del usuario, 2026-10-01. Es CR2 de `pendientes.md`, que nació
del criterio D-13 de la auditoría del cálculo: «Avisar si la libreta de una
visita no nivela entre BM-1 y BM-2». Al cerrar la Fase 29 pidió: «sí, abre la
fase 30 con CR2».
**Módulo:** control de asentamientos — la libreta de la visita, el panel, el
Excel, la demo y el seed

> **Divergencias de la implementación:**
>
> - **La tolerancia del ejemplo es de 2.0 mm, no de 3.8 a 5.4.** La demo lee
>   el otro BM como intermedia de la primera armada, a unos 28 m del amarre,
>   no a 0.1–0.2 km. En la visita 13, BM-2 queda **7.4 mm** por encima, no 8:
>   el generador fija la cota compensada, y la calculada difiere en la parte
>   del cierre que le toca. En las otras trece visitas, entre −0.7 y +0.6 mm.
> - **`perSetup: 5`** en la demo y el seed: el otro BM entra en la primera
>   armada sin añadir una tercera.
> - **`bookRowOf` no lee la columna.** La vista y el panel leen la libreta
>   guardada con `benchmarkChecksOfBook`, una función que el PRD no nombraba.
> - **El diálogo de cierre del editor usa la comprobación en vivo**, la misma
>   que muestra el editor; el de la vista, la copia guardada. Para confirmar,
>   el editor exige no tener cambios sin guardar, así que coinciden salvo que
>   el catálogo cambie entre el guardado y el cierre.
> - **Sin distancias, el motor deja el acumulado en 0**, no en null:
>   `checkBenchmarks` trata una distancia nula o 0 como «sin distancias», con
>   el mismo criterio que el cierre.
> - **Capturas:** cambian la 15, la 16, la 26 (la libreta importada trae la
>   fila de BM-2: 13 visuales) y la 28; la 27 no, porque muestra la visita 12,
>   que nivela y no lleva aviso. El texto alternativo de la 28 decía ±4.5 mm
>   donde la imagen muestra ±4.0: se corrigió.
> - **El ⚠ del amarre usa la fuente monoespaciada**, como el de la columna
>   Cierre: en la fuente de texto salía más grande.
> - **Un residuo de la Fase 29:** el docstring de `PanelTab` todavía nombraba
>   los diferenciales.
> - **La guía e2e de asentamientos** cambia más de lo previsto: la libreta de
>   la visita 12 pasa ahora por BM-2, y el paso 13 la teclea entera. Se añadió
>   el paso 12 bis.
> - **Verificación en pantalla** en local, a 1280 px en claro y a 390 px en
>   oscuro: 25 comprobaciones, sin desborde ni errores de página. Cubren el ⚠
>   del panel solo en la visita 13, la vista, el registro, el diálogo de
>   cierre, el editor de la 13 (no nivela) y el de la 12 (nivela), el Excel y
>   la demo del primer inicio de sesión.
> - **Producción, pendiente:** una consulta de solo lectura, el `db push` y,
>   después, el merge.

## Propósito

Una visita se amarra a **un** BM, y todas sus cotas salen de él. Si ese BM se
movió, todos los puntos de control parecen asentarse a la vez, y hoy nada lo
detecta.

El marco teórico lo resuelve en el campo. El § 2.3 pide «nivelar entre BMs
primero para verificar estabilidad de la red de referencia», y el § 2.1
recomienda «un mínimo de 3 BMs por proyecto para detectar movimientos de los
propios benchmarks mediante cierres de circuito cruzados».

En esta fase, cuando la libreta de una visita **pasa por otro BM del
catálogo**, la app compara la cota que la libreta le da con la que tiene en el
catálogo. Si no nivelan, avisa. El aviso no bloquea y no cambia ninguna cota
ni ningún asentamiento.

## Hallazgos que condicionan la fase

### 1. Hoy la libreta no mira los otros BMs

`validateVisitBook` solo exige que el circuito arranque y cierre en el amarre.
`deriveControlElevations` saca la cota de las filas cuyo código es un punto de
control. Cualquier otro código —otro BM, un punto de cambio— es «una radiación
normal y no dice nada». En Torre Alameda las visitas alternan BM-1 y BM-2 como
amarre, pero ninguna libreta pasa por el otro.

### 2. Solo el amarre tiene su cota copiada

La visita copia la cota del amarre (`settlement_visits.reference_bm_elevation`)
para que corregir después el catálogo no cambie una visita cerrada. Ningún otro
BM se copia en ningún lado.

### 3. Los datos ya están, salvo la cota del otro BM

- Cada fila de la libreta persiste `elevation_calculated` y
  `distance_accumulated_km`.
- El editor de la visita ya recibe el catálogo de puntos de referencia.
- La vista de la visita carga las libretas del lugar con `getSiteBooks`. El
  panel no las carga hoy.

### 4. La tolerancia es la de una línea entre dos puntos conocidos

El tramo del amarre al otro BM es una nivelación entre dos cotas conocidas. Su
diferencia se juzga con la tolerancia del orden de la visita, K·√L (3, 6, 12
o 24 mm), donde L es la distancia acumulada desde el amarre hasta ese BM.
Torre Alameda es de tercer orden: con L entre 0.1 y 0.2 km, la tolerancia
queda entre 3.8 y 5.4 mm.

## Alcance

### A. Motor: `checkBenchmarks`

Una función pura en `lib/calculations/settlement-book.ts`. Toma la libreta
calculada y, por fila, la cota de catálogo (o null), y devuelve una
comprobación por cada fila que:

- tiene vista menos;
- lleva el código de un BM del catálogo **de tipo BM, con cota y distinto del
  amarre**;
- **no** es un punto de control del lugar. Si un código coincide con los dos,
  gana el punto de control, como hoy.

De cada una da:

- el código;
- la cota de catálogo y la **calculada** de la libreta;
- la diferencia en mm (calculada − catálogo, con signo);
- la tolerancia K·√L y si cumple. Para la frontera usa `withinTolerance`, el
  mismo criterio que el cierre (C-13).

Sin distancias (L nulo), da la diferencia sin tolerancia ni veredicto, como el
cierre.

Una ayuda pura, `catalogElevationsOf`, decide qué filas llevan cota de
catálogo a partir de las filas, el catálogo de referencia, el amarre y los
puntos de control.

### B. Persistencia

- **Migración** `supabase/migrations/20261001040000_estabilidad_bms.sql`:
  - una columna nueva y opcional, `settlement_book_readings.catalog_elevation
    decimal(10,4)`: la cota que ese BM tenía en el catálogo al guardar la
    visita;
  - `save_visit` recreada para escribirla en el `insert` y en el `on conflict
    … do update`. Sigue siendo `SECURITY INVOKER` y con columnas explícitas.
- `bookRowsToPersist` la sella; `saveVisitAction` carga el catálogo para
  hacerlo.
- Una visita abierta la renueva en cada guardado. Una cerrada la conserva,
  porque sus filas ya son inmutables (trigger de la Fase 18).
- `bookRowOf` la lee.
- **La migración añade, no borra:** el orden es el normal, `db push` antes del
  merge. El código viejo no nombra la columna, y `jsonb_populate_recordset` la
  deja en null.

### C. Dónde se ve

| Lugar | Qué muestra | De dónde sale la cota de catálogo |
|---|---|---|
| Editor de la visita | Una línea por BM de control («BM-2 nivela con BM-1: +0.8 mm, tolerancia 4.6 mm») y un aviso si alguno no nivela | El catálogo en vivo: es lo que se va a sellar al guardar |
| Diálogo de cierre | El aviso, si alguno no nivela | La copia guardada |
| Vista de la visita | Igual que el editor, junto al cierre de la libreta | La copia guardada |
| Panel del lugar | Un ⚠ junto al amarre en la tabla de visitas, con su texto accesible | La copia guardada (el panel carga `getSiteBooks`) |
| Excel, hoja «Libretas» | Una columna «Cota de catálogo (m)» en las filas de los BM de control | La copia guardada |

El aviso dice que uno de los dos BM pudo moverse. Con dos BM no se sabe cuál,
así que el texto no culpa a ninguno.

El informe consolidado no cambia.

### D. Demo y seed

- Las libretas de Torre Alameda pasan también por el otro BM: BM-2 en las
  visitas amarradas a BM-1, y BM-1 en las visitas 5 y 11, amarradas a BM-2.
  Va como una intermedia más; `generateVisitBook` ya acepta cualquier código
  como objetivo.
- Todas nivelan salvo la **visita 13** (abierta), donde BM-2 queda unos 8 mm
  fuera de su cota de catálogo, fuera de tolerancia, para mostrar el aviso.
- Las cotas de los puntos de control no cambian: la serie se sigue
  reproduciendo a 0.1 mm.
- Los proyectos de ejemplo que ya existen en producción no cambian.

### E. Documentación

- **Manual, en sus dos copias:** la libreta (§ 7.3), el panel (§ 7.4) y la
  vista de la visita (§ 7.5). Las capturas que cambien: la 15 (panel), la 16
  (editor de la visita) y la 27 (vista).
- **PRD principal:** § 3 (la columna nueva) y § 5.3 (la fila del aviso).
- **Doc técnica:** la libreta de la visita, la tabla de pruebas y la § 11.
- **Auditoría:** el estado de D-13.
- **`pendientes.md`:** CR2 se cierra.

## Decisiones del usuario (apertura)

1. **Se detecta dentro de la libreta**, cuando el circuito pasa por otro BM.
   Se descartaron una nivelación aparte entre BMs (una tabla, un editor y un
   Excel nuevos) y una heurística sobre la serie de visitas (una estructura
   que se asienta pareja la dispararía).
2. **La cota del otro BM se copia en la fila de la libreta**, igual que la del
   amarre en la visita: una visita cerrada conserva su aviso aunque después se
   corrija el catálogo.
3. **El diseño completo**, tal cual: el aviso en el editor, el cierre, la
   vista, el panel y el Excel, y la demo con un caso que no nivela en la
   visita 13.

## Decisiones

| # | Decisión | Razón |
|---|---|---|
| 1 | Se compara la cota **calculada**, no la compensada | Es el desnivel medido entre los dos BM; la compensada ya repartió el error del circuito |
| 2 | Tolerancia K·√L, con L acumulada hasta la fila del BM | Es una línea entre dos puntos conocidos, juzgada con el orden de la visita |
| 3 | Solo BM del catálogo, de tipo BM, con cota y distintos del amarre | Un punto GPS o de control con cota no es parte de la red de referencia de la visita |
| 4 | Avisa, no bloquea | Precedente de la app: los controles de calidad avisan. El topógrafo decide si repite la nivelación |
| 5 | En el editor, el catálogo en vivo; en lo guardado, la copia | El editor muestra lo que se sellará al guardar; lo guardado no cambia con el catálogo |
| 6 | Migración que añade: `db push` antes del merge | Orden normal (doc técnica § 13) |

## Pruebas

| Qué | Cómo |
|---|---|
| `checkBenchmarks` | Nivela; no nivela con diferencia positiva y negativa; justo en la frontera; sin distancias (sin veredicto); el amarre a mitad de la libreta no cuenta; un BM sin cota, una fila sin vista menos o un código de punto de control no cuentan; el mismo BM dos veces da dos comprobaciones |
| `catalogElevationsOf` | Solo BM de tipo BM con cota y distintos del amarre; el punto de control gana |
| Persistencia | `bookRowsToPersist` sella la cota de catálogo solo en las filas de los BM de control |
| pgTAP | `save_visit` guarda `catalog_elevation`; una visita cerrada no la deja cambiar |
| Excel | La columna «Cota de catálogo (m)», con valor solo en las filas de los BM de control |
| Demo | Torre Alameda: la visita 13 no nivela con BM-2 y las otras 13 sí; la serie sigue reproduciéndose a 0.1 mm |

**En pantalla (local), claro y oscuro, 1280 y 390 px:**
- el editor de la visita 13, con el aviso, y el de una que nivela;
- el diálogo de cierre;
- la vista de la visita;
- el ⚠ del panel;
- el Excel.

## Criterios de aceptación

1. Una libreta que pasa por otro BM del catálogo dice si nivela con el amarre,
   con su diferencia y su tolerancia, en el editor, el cierre y la vista.
2. Si no nivela, la app avisa sin bloquear guardar ni cerrar, y el panel lo
   marca en la tabla de visitas.
3. Una visita cerrada conserva su comprobación aunque se corrija el catálogo.
4. Las cotas y los asentamientos de todas las visitas son los mismos de antes.
5. `npm run typecheck`, `npm run lint`, `npm test`, `npx supabase test db` y
   `npm run build` pasan limpios. El manual está en sus dos copias, con sus
   capturas, y la § 11 revisada.
6. Producción: `db push` antes del merge, con el visto bueno del usuario.

## Fuera de alcance

- **Decir cuál BM se movió:** con dos BM no se puede saber; el marco
  recomienda tres. La app avisa, no diagnostica.
- **Corregir la cota de un BM** o ajustar la red de BMs.
- **Una nivelación aparte entre BMs** y **la detección por la serie de
  visitas** (decisión 1).
- **Las visitas en modo cotas directas**, que no tienen libreta.
- **El informe consolidado.**

## Riesgos

- **Una cota de catálogo mal tecleada da un aviso falso.** Mitigación: el
  aviso muestra las dos cotas, y el texto sugiere revisar el catálogo además
  de la nivelación.
- **Un BM y un punto de control con el mismo código.** Mitigación: gana el
  punto de control, como hoy, y el BM no se comprueba. Se anota en el manual.

## Tareas (en orden)

0. **Apertura:** este PRD, los estados en `method.md` y `prds/README.md`, y
   CR2 en curso en `pendientes.md`. Commit `docs:`. La rama ya existe.
1. **A** — `checkBenchmarks` y `catalogElevationsOf`, con sus tests.
2. **B** — la migración, la prueba pgTAP y los tipos; la persistencia, con
   sus tests.
3. **C** — el editor, el diálogo de cierre, la vista y el panel.
4. **C** — el Excel.
5. **D** — la demo y el seed; `npx supabase db reset && npm run seed`.
6. **Verificación en pantalla** en local.
7. **Cierre:**
   - documentación: manual (dos copias) y capturas, PRD principal, doc
     técnica, auditoría, `method.md`, `prds/README.md` y `pendientes.md`;
   - revisión de código y PR.
8. **Producción**, con el visto bueno del usuario:
   - una consulta de solo lectura;
   - `npx supabase db push`;
   - después, el merge.
