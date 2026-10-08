# PRD-de-fase 38 — El informe de cada proceso

**Estado:** cerrada
**Fecha de apertura:** 2026-10-08
**Fecha de cierre:** 2026-10-08

**Rama:** `fase-38-informe-por-proceso`
**Petición:** del usuario, 2026-10-08: «planees como dejar el acceso al
informe de cada proceso en su página de informe, y allí mismo exportar el pdf
y el excel formulado. No a nivel de proyecto ni informe que reúna procesos,
quitamos las demás páginas o restos que queden». Sobre el Excel: «la idea es
casi imitar pero mejorando diseño los excel que tenemos de casos de ejemplo».
**Módulos:** el informe y el Excel de la poligonal, la nivelación y el lugar
de asentamientos; el hub del proyecto; la tabla `reports`; la demo, el seed y
la documentación.
**Carteras de referencia** (`docs/carteras/`):

| Módulo | Cartera |
|---|---|
| Nivelación | `TRABAJO NIVELACION EL VERJON.xlsx` |
| Poligonal | `poligonales.xlsx` (Brújula, Tránsito, Crandall) |
| Mínimos cuadrados | `Ajuste_Poligonal_Minimos_Cuadrados.xlsx` (Vivero) |
| Asentamientos | `Control_asentamiento_estructural_ REAL.xlsx` |

> **Divergencias de la implementación:**
>
> - **El intérprete de fórmulas no es reentrante y no trae `MIN` ni `MAX`.**
>   El ayudante de pruebas usa un intérprete por nivel de profundidad y los
>   agrega; compara a una parte en mil millones (con una en diez millones,
>   una coordenada de 100 000 m admitía 1 cm).
> - **La georreferenciación guarda fecha, puntos, rotación y escala**, no la
>   traslación: el bloque del Excel muestra lo que hay.
> - **Poligonal:** las columnas se llaman ESTACIÓN y VISADO; la dirección
>   D/I y el azimut sin corregir de la abierta con control, y las columnas
>   auxiliares de Tránsito (|N-S|, |E-W|) y Crandall (d·cos², d·cos·sin,
>   d·sin², δd) van a la derecha, como las de la propia cartera, en vez de
>   `SUMPRODUCT` sobre expresiones de rango; los bloques de cierre, debajo de
>   la tabla.
> - **Mínimos cuadrados:** el cierre de antes del ajuste —con el que el motor
>   juzga el orden— va como valores de la app; el orden sí es fórmula sobre
>   ellos. Las matrices llevan además l₀ y v.
> - **Nivelación:** la corrección y las cotas ajustadas aparecen solo cuando
>   se compensaron la ida y la vuelta (`result.compensated`).
> - **Asentamientos:** «Libretas» no dibuja los hilos en tres filas (las
>   visitas casi nunca los llevan); la primera lectura de un punto se juzga
>   en el semáforo solo por el acumulado, y los avisos de tendencia los da
>   `siteReportOf`.
> - **Restos del consolidado**, además de lo listado: el número de sección
>   del índice, el título «Resumen consolidado de precisiones» y los
>   comentarios que lo nombraban. Se conserva la rama `missing` de
>   `sections.ts`, que el informe de un proceso nunca usa.
> - **La revisión final corrigió tres cosas**, cada una con su prueba:
>   exportar una nivelación sin lecturas daba un error 500; una libreta a
>   medias mostraba como «Error de cierre» la diferencia con el BM que aún no
>   alcanzaba; y los ángulos de minutos enteros de la poligonal salían con
>   60″ en los datos y 41′60″ al recalcular. El encabezado de cada hoja, que
>   no llevaba la fecha de exportación (§ F), la lleva, y la poligonal y la
>   nivelación recuperan la ubicación y el responsable del alta.
> - **Verificado en pantalla:** los dos botones en el informe de los tres
>   módulos y ninguno en los demás pasos; el hub sin Informes; `/reports/new`
>   da 404; los seis libros de la demo, descargados de la app, sin una sola
>   fórmula que difiera del motor.

## Propósito

Hoy cada proceso ya tiene su informe —el paso Informe de la poligonal y de la
nivelación, la pestaña Informe del lugar—, pero conviven con él otras dos
cosas:

- los **informes consolidados**: una pestaña Informes en el hub, una página
  para generarlos y otra para imprimirlos, una tabla con su portada congelada
  y un bloque al pie de cada informe de proceso para generar uno o ver en
  cuáles está;
- un **Excel** que se descarga desde cualquier paso, con tres hojas de
  valores —«Datos crudos», «Cálculos», «Resumen»— que no se parecen a las
  carteras con que trabaja el topógrafo y no recalculan nada.

Al terminar la fase, **cada proceso tiene un solo lugar para su informe**: su
página de informe, con **Exportar PDF** y **Exportar Excel**. El Excel tiene
la forma de la cartera de su módulo, con mejor diseño, y **fórmulas vivas**
que dan lo mismo que la app. Los consolidados desaparecen con todos sus
restos.

## Hallazgos que condicionan la fase

1. **El Excel de hoy no tiene ninguna fórmula.** Los tres libros
   (`src/lib/export/{polygonal,leveling,settlement}-workbook.ts`) escriben
   valores con `cell.value`. La única fórmula del repositorio está en
   `scripts/build-poligonal-excel.mjs`, que genera la plantilla de
   referencia `docs/templates/poligonales.xlsx`; la app no la usa.
2. **Las carteras tienen una forma reconocible:**
   - **El Verjón** tiene una hoja NIVELACIÓN y otra CONTRANIVELACIÓN.
     - Cada punto ocupa **tres filas**: hilo superior, medio e inferior.
     - Fórmulas: `AI = COTA + V+`, `COTA = AI − V−` y
       `DISTANCIA = (superior − inferior) × 100`.
     - Al pie, el error, la compensación y «CUMPLE / NO CUMPLE».
   - **`poligonales.xlsx`** tiene una hoja por método. Columnas: DELTA, PUNTO,
     ángulo en G-M-S-DEC, corrección, ángulo corregido, azimut, distancia,
     proyecciones, correcciones, proyecciones corregidas y coordenadas. Una
     fila SUMATORIA cierra la tabla.
   - **Vivero** ajusta por ecuaciones de condición con bloques de matrices.
   - **La cartera de asentamientos** pone cada visita en un bloque de cinco
     columnas, lado a lado (FECHA, ALT. INS., V+, LECTURA, COTA), y abajo
     una «Diferencia observada» por punto. Ahí van la comparación con la
     primera visita, la comparación con la anterior y una observación.
3. **Las carteras no siempre calculan como la app**
   ([`../auditoria-calculo.md`](../auditoria-calculo.md)):
   - El Verjón reparte la corrección por igual en cada armada (`=O3/11`); la
     app la reparte en proporción a la distancia.
   - Las hojas Tránsito y Crandall de la TT4 tienen defectos conocidos: 14.1 mm
     y 2.6 mm contra la app.
   - Vivero hace una sola pasada con su tabla de correcciones rotada una
     estación.
   - **El Excel sigue a la app**, que es la que se auditó.
4. **Los mínimos cuadrados de la app iteran** (`adjustByConditions`, hasta 10
   vueltas): las condiciones de la poligonal no son lineales. Una pasada de
   matrices en Excel solo reproduce la última linealización.
5. **Una visita de asentamientos puede tener varias armadas y puntos de
   cambio** (Fase 37). La cartera supone una sola armada desde el BM: sus
   bloques lado a lado no admiten filas que cambian de visita a visita.
6. **El motor redondea en algunos sitios:**
   - el azimut de partida a la décima de segundo;
   - la georreferenciación a la décima de milímetro;
   - las cotas de asentamientos a 4 decimales.

   La fórmula tiene que redondear en el mismo sitio (`ROUND`), o la prueba no
   coincidirá.
7. **Los consolidados son esto:**
   - **Páginas y acciones:** `projects/[id]/reports/` (nuevo, ver e
     imprimir), y `createReportAction` y `deleteReportAction`.
   - **Componentes:** `report-form.tsx` y `delete-report-button.tsx`.
   - **Lógica:** `lib/reports/eligibility.ts` (excepto el tipo
     `CandidateKind`, que usan las secciones) y `lib/reports/including.ts`.
   - **Consultas:** `getReports`, `getReport` y `getReportableWork`.
   - **Hub:** la pestaña Informes.
   - **Avisos al eliminar:** `reportTitles` y `deletionReportsNotice` en la
     cabecera, la tabla y las acciones de fila.
   - **Informe de proceso:** el bloque «Informes consolidados» de
     `process-report.tsx`.
   - **Estilos:** `.report-index`, `.report-actions`, `.report-draft` y
     `.report-rejected`.
   - **Base:** la tabla `reports`, con su trigger `reports_reject_update`,
     su función `reject_update_on_report()` y sus políticas.
   - **Pruebas:** la pgTAP `informe_congelado.test.sql`, y
     `eligibility.test.ts` e `including.test.ts`.
   - **Demo y seed:** la demo crea 3 informes (`insertar-informe.ts`, las
     banderas `informe` de `fixtures.ts`) y el seed otros 3.
   - **Manual:** las capturas 18 y 19.
8. **Lo que el informe de proceso comparte con los consolidados se queda.**
   - Las secciones (`components/reports/sections/*`), `math.tsx`,
     `settlement-plot.tsx` y `print-button.tsx`.
   - En `lib/reports/`: `sections.ts`, `summary.ts`, `values.ts`,
     `leveling-data.ts`, `site-data.ts` y `cover.ts`, con la portada viva.
   - `lib/reports/adopted.ts`, que usa el Excel de la nivelación.
9. **Cada página de proceso lee `reports`** (`getReports`, para los avisos).
   El código viejo falla sin la tabla: se borra **después** del merge.
10. **El PDF lo hace el navegador.** `PrintButton` llama a `window.print()`, y
    `globals.css` ya maqueta A4 y oculta la cabecera al imprimir. No hay
    librería de PDF.

## Decisiones

| # | Decisión |
|---|---|
| 1 | **Un solo lugar**: la página de informe de cada proceso tiene **Exportar PDF** y **Exportar Excel**. Es el paso Informe en la poligonal y la nivelación, y la pestaña Informe en el lugar. Ningún otro paso exporta. |
| 2 | **El PDF es del navegador**, como hoy: el botón cambia su rótulo a «Exportar PDF» y abre el diálogo de impresión. |
| 3 | **Fuera los informes consolidados y los de proyecto**, con sus páginas, su tabla, sus avisos, sus pruebas, su demo y su documentación. |
| 4 | **El Excel tiene fórmulas vivas.** Cada celda calculada lleva su fórmula y, como resultado guardado, el valor que dio el motor: se ve completo en cualquier visor y Excel recalcula al cambiar un dato. |
| 5 | **La forma es la de la cartera del módulo, con mejor diseño.** Reemplaza las hojas «Datos crudos / Cálculos / Resumen». |
| 6 | **Las reglas son las de la app.** Donde la cartera calcula distinto (hallazgo 3), manda el motor. |
| 7 | **Mínimos cuadrados**: las matrices de la última iteración van como valores. Lo que sale de ellas —observaciones ajustadas y coordenadas— va con fórmulas. |
| 8 | **Asentamientos**: las libretas, una debajo de otra, una por visita, con sus armadas. La comparación por punto va en otra hoja, con fórmulas que apuntan a las libretas (hallazgo 5). Los avisos de tendencia van como texto de la app. |
| 9 | **Las tolerancias van en un bloque de celdas del libro**, con los valores de `tolerances.ts`. Las fórmulas las referencian; no hay números sueltos. |
| 10 | **Se verifica con un intérprete de fórmulas**: [fast-formula-parser](https://www.npmjs.com/package/fast-formula-parser) (MIT), **solo como dependencia de pruebas**. La prueba evalúa cada fórmula del libro y la compara con el valor del motor. |
| 11 | **La visita no tiene informe propio**: sus resultados van en el del lugar, como hoy. |
| 12 | **El hub no gana atajo al informe**: se llega entrando al proceso. |
| 13 | **Una sola fase.** |
| 14 | **El despliegue es un solo paso**: la migración que borra `reports`, después del merge. |

## Alcance

### A. La página de informe

- **`ProcessHeader`**: en el paso o pestaña Informe muestra **Exportar PDF**
  (el `PrintButton`, con el rótulo nuevo) y **Exportar Excel** (el enlace a
  `…/export`). En los demás pasos no muestra ninguno de los dos. La ruta
  `export/route.ts` de cada módulo conserva su URL.
- **`ProcessReport`**: sale el bloque «Informes consolidados», con sus props
  `reports` e `includable`. El resto del informe no cambia: portada viva,
  datos y resultados, resumen de precisión, observaciones y pie.
- **Eliminar un proceso**, desde la cabecera o desde el hub: sin el aviso de
  informes consolidados.

### B. Lo que se quita

- **Rutas:** `src/app/(app)/projects/[id]/reports/`, entera.
- **Componentes:** `components/reports/report-form.tsx` y
  `delete-report-button.tsx`.
- **Lógica:** `lib/reports/eligibility.ts` e `including.ts`, con sus pruebas.
  `CandidateKind` pasa a `src/types/report.ts`.
- **Consultas:** `getReports`, `getReport` y `getReportableWork`.
- **Hub:** la pestaña **Informes**. Quedan Procesos y Configuración, y
  `?tab=reports` cae en Procesos.
- **Avisos al eliminar:** `reportTitles` y `deletionReportsNotice` en las
  páginas de proceso, `process-header.tsx`, `process-table.tsx` y
  `process-row-actions.tsx`.
- **Estilos:** `.report-index`, `.report-actions`, `.report-draft` y
  `.report-rejected` de `globals.css`.
- **La portada congelada:** `ReportCover` deja de recibir una portada
  guardada; `coverOf(project)` se queda para la viva.

### C. El Excel de la nivelación (forma de El Verjón)

- **Hoja «Nivelación»** (la ida):
  - Arriba, el encabezado: proyecto, proceso, tipo, equipo, nivelador, fecha
    y BM de partida, con su cota (y el de llegada, si lo hay).
  - Columnas: PUNTO · V+ · AI · V− · VI · COTA · DIST. V+ · DIST. V− ·
    DIST. ACUMULADA · CORRECCIÓN · COTA AJUSTADA.
  - Con hilos, cada lectura ocupa tres filas (superior, medio e inferior),
    como la cartera, y la distancia es `(superior − inferior) × 100`. Sin
    hilos, una fila con la distancia tecleada.
  - Fórmulas: `AI = COTA anterior + V+`; `COTA = AI − V−` (o `− VI`); el
    acumulado; `CORRECCIÓN = −E × acumulado / L`, con el desplazamiento del
    circuito cuando lo hay; y `COTA AJUSTADA = COTA + CORRECCIÓN`.
- **Hoja «Contranivelación»**: la vuelta, si la hay, con la misma forma.
- **Bloque de cierre**, al pie de la hoja de la ida:
  - la cota conocida, el error de cierre en mm y la longitud en km;
  - la tolerancia de cada orden (`K·√km`) y el orden alcanzado (`IF`
    encadenados contra el bloque de tolerancias), con «CUMPLE / NO CUMPLE»;
  - en la abierta con vuelta, la discrepancia ida-vuelta.
- **Hoja «Cotas ajustadas»**: una fila por punto, con la cota conocida o el
  promedio de sus cotas ajustadas en la ida y la vuelta (`adoptedElevations`).
- **Sin compensación** (abierta sin vuelta, libreta a medias): sin las
  columnas de corrección, y el cierre dice «Sin verificación».

### D. El Excel de la poligonal (forma de `poligonales.xlsx`)

- **Una hoja** con el nombre del método del proceso: BRÚJULA, TRÁNSITO,
  CRANDALL o MÍNIMOS CUADRADOS. Arriba, el encabezado.
- **Columnas**: DELTA · PUNTO · ÁNGULO HORIZONTAL (G · M · S · DEC) ·
  CORRECCIÓN · ÁNGULO CORREGIDO (G · M · S · DEC) · AZIMUT (G · M · S · DEC)
  · DISTANCIA · PROYECCIONES (N-S · E-W) · CORRECCIÓN (N · E) · PROYECCIONES
  CORREGIDAS · COORDENADAS (N · E).
  - G, M y S son los datos guardados; `DEC = G + M/60 + S/3600`.
  - Las lecturas repetidas de una estación van como datos de referencia: el
    motor usa el ángulo de la estación y de las lecturas solo saca la
    dispersión.
- **Fórmulas por método:**
  - **Brújula:** `−E·d/P`.
  - **Tránsito:** `−E·|Δ|/Σ|Δ|`.
  - **Crandall:** el sistema 2×2 del motor, con `SUMPRODUCT` para a₁₁, a₁₂
    y a₂₂, el determinante, λ₁ y λ₂, y `δd = d(λ₁cos Az + λ₂sin Az)`.
  - **Cerrada:** el error angular contra `(n−2)·180` y su reparto.
  - **Abierta con control:** el azimut y las coordenadas de cierre.
  - **Abierta sin control:** sin corrección; solo encadena.
- **Fila SUMATORIA y bloque de cierre**: error angular en segundos, error
  lineal, precisión 1:N, la tolerancia de cada orden y el orden alcanzado.
- **Georreferenciada:** los parámetros de la transformación van como valores
  del motor. La poligonal se calcula con fórmulas a partir de su partida
  transformada.
- **Mínimos cuadrados** (decisión 7):
  - los bloques de la hoja de Vivero con los valores de la última
    iteración: A, Q, w, A·Q·Aᵀ, k, v y σ₀;
  - los ángulos y distancias ajustados (`l₀ + v`), los azimuts y las
    coordenadas, con fórmulas.

### E. El Excel de asentamientos (forma de la cartera real, ordenada)

- **Hoja «Libretas»**: un bloque por visita, una debajo de otra.
  - Título: «Visita N · fecha», con el nivelador, el equipo y la nota.
  - Columnas: PUNTO · V+ · AI · V− · VI · COTA, con sus armadas y puntos de
    cambio. `AI = COTA + V+` y `COTA = AI − lectura`, sin compensar, como la
    app.
  - Por tramo, una fila de verificación: el cierre en mm, como fórmula, y el
    orden contra el bloque de tolerancias, o «Sin distancias» / «Sin
    verificación».
- **Hoja «Comparación»** (la «Diferencia observada» de la cartera): un punto
  por fila, con su código, su ubicación y su C0. Por cada visita:
  - **COTA**, que apunta a su celda de la libreta;
  - **ACUMULADO** en mm, `(COTA − C0)·1000`;
  - **PARCIAL** en mm, contra la última visita en que se midió el punto. La
    celda de referencia la elige el exportador, como hace la cartera a mano;
  - **VELOCIDAD** en mm/mes, el parcial entre los días entre visitas sobre
    30.4375;
  - **SEMÁFORO**, con `IF` contra los umbrales del lugar.

  Un punto sin lectura en una visita deja sus celdas vacías. Los avisos de
  tendencia van como texto (decisión 8).
- **Hoja «Resumen»**: el lugar, sus BM, sus umbrales y la trazabilidad.

### F. Diseño común de los tres libros

- **Encabezado** con el proyecto, el proceso, el equipo, la fecha de
  exportación y «Generado por TopoField».
- **Formatos:** coordenadas a 3 decimales, cotas a 4, mm a 1, y ángulos en
  G-M-S con los segundos a una décima.
- **Color:** los datos medidos en un color y las fórmulas en otro, para que
  se distinga qué se midió y qué se calcula. La paleta sale de
  `WORKBOOK_COLORS`, que una prueba ya ata a los tokens del tema.
- **Hoja:** paneles inmovilizados en los encabezados, anchos de columna
  pensados y bloques de cierre resaltados.
- **Impresión:** A4 apaisado, ajustado al ancho.
- **El bloque de tolerancias** (decisión 9) va en cada hoja que lo use.
- **Recalcular al abrir:** `fullCalcOnLoad`, para que Excel recalcule.
- **Compatibilidad:** solo funciones que entienden Excel 2016, LibreOffice y
  Google Sheets; nada de `LET`, `LAMBDA` ni matrices dinámicas.

### G. Verificación del Excel

- Un ayudante de pruebas (`src/lib/export/formula-check.ts`, solo para
  pruebas):
  - recorre las celdas con fórmula de un libro;
  - las evalúa con fast-formula-parser, resolviendo referencias a la misma
    hoja y a otras hojas;
  - devuelve las que no coinciden con su resultado guardado.
- Como el resultado guardado es el valor del motor, **que la fórmula dé su
  resultado guardado es que el Excel da lo mismo que la app**. La tolerancia
  es la mitad de la última cifra que se muestra.
- **La primera tarea del plan** comprueba que el intérprete entiende todas
  las funciones que se usan: `MOD`, `RADIANS`, `SIN`, `COS`, `ATAN2`, `INT`,
  `ABS`, `SQRT`, `IF`, `SUM`, `SUMPRODUCT`, `ROUND`, `AVERAGEIF` y fechas. Si
  falta alguna, se le agrega en el ayudante.

### H. Base de datos

- **La migración** `20261010000000_sin_informes_consolidados.sql` borra el
  trigger `reports_reject_update`, la función `reject_update_on_report()` y
  la tabla `reports`. Sus políticas se van con la tabla.
- **pgTAP:** sale `informe_congelado.test.sql`, y un test nuevo comprueba que
  `reports` no existe.
- **Tipos:** `src/types/database.ts`, a mano.

### I. Demo y seed

- `crear-proyecto-demo.ts` deja de crear informes. Se borran
  `insertar-informe.ts` y las banderas `informe` de `fixtures.ts`, con su
  prueba.
- `scripts/seed.mjs` pierde `insertReport` y sus 3 informes.

### J. Documentación

- **Manual, en las dos copias:**
  - **Secciones que cambian:** § 1, § 2, § 4.2 a § 4.4, § 8 y las preguntas
    frecuentes pierden los consolidados. En § 5.7, § 6.10 y § 7.12 sale «la
    misma sección que en un consolidado».
  - **§ 10** pasa a ser «El informe de cada proceso»: dónde está, qué
    contiene, Exportar PDF y Exportar Excel.
  - **§ 11** describe las hojas nuevas de cada libro y cómo se recalculan.
  - **Capturas:** salen la 18 y la 19, con su bloque en `capturas.mjs`. Se
    regeneran solo las que cambian: el informe del proceso y el hub.
- **Doc técnica:**
  - § 2 (estructura), § 3 (informes y exportación), § 4 (modelo) y § 5
    (inmutabilidad: queda sin el informe emitido);
  - § 9 (pruebas), § 10 (reglas), § 11 (deuda) y § 13 (despliegue).
- **El resto:**
  - `CLAUDE.md`: las líneas de `reports/` y `components/reports/` en
    Arquitectura, y la regla «Un informe emitido no admite UPDATE»;
  - `docs/testing/manual-e2e-informes.md`;
  - `pendientes.md`, `prds/README.md` y el cierre en `method.md`.

## Fuera de alcance

- Un PDF generado en el servidor.
- Un informe propio de la visita.
- Importar de vuelta el Excel: es solo de salida.
- Cambiar reglas de cálculo: el Excel sigue a la app.
- `docs/templates/poligonales.xlsx` y su script, que se quedan como están.
- Cambiar el contenido o las secciones del informe en pantalla.

## Criterios de aceptación

| | Criterio |
|---|---|
| a | En el paso Informe de la poligonal y de la nivelación, y en la pestaña Informe del lugar, la cabecera muestra **Exportar PDF** y **Exportar Excel**; ningún otro paso exporta |
| b | **Exportar PDF** abre el diálogo de impresión; lo impreso no lleva botones ni el bloque de consolidados |
| c | El hub tiene solo Procesos y Configuración; `?tab=reports` abre Procesos |
| d | Cualquier ruta bajo `/projects/[id]/reports/` da «no encontrado» |
| e | Eliminar un proceso no habla de informes consolidados |
| f | Ningún archivo de `src/` nombra `reports` como tabla ni los consolidados (`grep`) |
| g | El Excel de cada módulo tiene las hojas de C, D y E, con sus encabezados, formatos y bloques de cierre |
| h | Toda celda calculada tiene fórmula, salvo las matrices de mínimos cuadrados, los parámetros de la georreferenciación y los avisos de tendencia; el ayudante de la prueba no encuentra ninguna que difiera del motor en los casos de prueba |
| i | Cambiar una lectura en el Excel recalcula lo que depende de ella (lo prueba el ayudante con un dato cambiado, y lo comprueba el usuario en Excel) |
| j | La demo y el seed no crean informes |
| k | Manual (dos copias), capturas, doc técnica y `CLAUDE.md` al día |
| l | El usuario abre en Excel los libros de la demo y aprueba su diseño |

## Pruebas mínimas

- **Las fórmulas de cada libro contra el motor** (ayudante de G):
  - **Nivelación:** El Verjón (abierta con vuelta, con hilos), el tramo 2
    (cerrada) y una abierta sin vuelta.
  - **Poligonal:** la TT4 por Brújula, Tránsito y Crandall; una abierta con
    control y una sin control; una georreferenciada; la Vivero por mínimos
    cuadrados.
  - **Asentamientos:** Torre Alameda, con dos armadas por visita y un punto
    de baja, y la cartera real, con un tramo abierto por visita.
- **Recalcular:** se cambia una lectura en el libro, se reevalúa y cambian
  las cotas o las coordenadas que dependen de ella.
- **Forma:** las hojas, los encabezados, los formatos de número y que el
  bloque de tolerancias tenga los valores de `tolerances.ts`.
- **pgTAP:** `reports` no existe.
- **En pantalla:**
  - los dos botones en el informe de los tres módulos, y ninguno en los
    demás pasos;
  - el hub sin la pestaña Informes;
  - una ruta vieja de informe que da «no encontrado»;
  - el diálogo de impresión.

## Despliegue

Un solo paso, **después** del merge, como toda migración que borra (doc
técnica § 13):

1. Merge a `main`. Vercel despliega el código, que ya no lee `reports`.
2. `npx supabase db push` aplica `20261010000000_sin_informes_consolidados`.

Antes del merge no hace falta nada. Producción solo tiene los 3 informes de
la demo, que se pierden con la tabla.

## Riesgos

1. **Al intérprete le falta una función, o redondea distinto.** Por eso la
   primera tarea es esa comprobación; lo que falte se agrega en el ayudante.
2. **El motor redondea donde la fórmula no** (hallazgo 6): la fórmula lleva
   `ROUND` en el mismo sitio, y la prueba lo detecta si falta.
3. **Fórmulas que Excel no entiende igual que el intérprete** (fechas,
   ángulos). La prueba no sustituye abrirlo en Excel: es el criterio l.
4. **Libros grandes**: Torre Alameda tiene 14 visitas y 168 filas de libreta.
   Las fórmulas con referencias explícitas, sin búsquedas, lo mantienen
   ligero.
5. **Se pierde lo que se quita**: los 3 informes de la demo en producción.
   Aceptado.
