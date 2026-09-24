# Plan para redactar el PRD — Control de asentamientos según el prototipo

**Qué es:** el plan de la sesión de apertura (`method.md` § 1) de la fase que
lleve a la app el prototipo `docs/prototipos/Control de asentamientos, Torre
Alameda.html`. **No es el PRD.** Ordena qué leer, qué verificar y qué decidir
para poder redactarlo, y propone su esqueleto.

**Fecha:** 2026-09-24
**Fase propuesta:** 16 → archivo `docs/prds/15-<slug>.md` (los archivos van
desfasados en uno: la fase 15 es `14-georreferenciacion.md`).

---

## 0. Precondiciones

1. **La fase 15 sigue en curso** (rama `fase-15-georreferenciacion`, con
   cambios sin commitear). `method.md` § 4 prohíbe solapar fases: el PRD se
   redacta cuando la 15 cierre y su PR entre a `main`, salvo que el usuario
   decida otra cosa de forma explícita. Este plan sí puede prepararse ahora
   porque no es el PRD.
2. **Rama nueva desde `main`** al abrir: `fase-16-<slug>`, empujada pronto
   (`method.md` § 3.bis).
3. **El prototipo está sin seguimiento en git.** Hay que decidir si entra al
   repositorio. Recomendación: que entre en el commit de apertura del PRD, como
   fuente citada, añadido por su ruta exacta y nunca con `git add -A docs`.

## 1. Objetivo del PRD

Llevar el prototipo a la app, adaptado al modelo de datos, al motor y al
sistema de diseño existentes. El PRD cubre:

- El **layout y la UX** del panel del lugar y de la vista de visita: KPIs,
  tablas navegables, gráficas, historial por punto y registro de nivelación.
- El **formulario para crear una visita**.
- La **libreta de nivelación de la visita**. Se digita en vivo o se sube un
  archivo CSV, y **de ella se derivan las cotas de los puntos de control**, en
  lugar de teclearlas.

## 2. Fuentes a leer en la sesión

| Fuente | Para qué |
|---|---|
| El prototipo | Inventario de pantallas y datos (§ 3 de este plan) |
| `PRD-TopoField.md` § 3.2, § 4.5, § 4.6, § 5.1–5.3, § 6.10–6.11 | Modelo, editor, cierre, validación y algoritmos. § 4.5 y § 3.2 se enmiendan |
| `docs/prds/04-asentamientos.md` | Decisiones #3, #9, #12, #14 y #15, que siguen vigentes |
| `docs/prds/10-estado-bms.md`, `11-lectura-desfasada.md` | Baja/alta de puntos y lectura fuera de tendencia: la nueva UI no debe perderlas |
| `docs/prds/07-…`, `08-…`, `09-…` | Equipo por visita, cadena de distancias, vista más/menos |
| `docs/pendientes.md` N4 | Decisiones ya tomadas sobre la importación de archivos |
| `docs/carteras/analisis-crudo-nivel-digital.md` | Formato Leica `.L` descifrado |
| `method.md`, «Cierre Fase 5» | Lecciones sobre la caché derivada que nadie invalida y el arranque en frío |

## 3. Inventario del prototipo

Cada elemento se clasifica según lo que exige al modelo: **existe** (dato ya
calculado), **derivable** (se calcula con lo que hay) o **nuevo** (requiere
modelo o motor).

### Panel del lugar

| Elemento | Dato | Estado |
|---|---|---|
| Encabezado: nombre, n.º de puntos, fecha base | `sites`, `settlement_points`, visita 0 | existe |
| Leyenda de umbrales (Alerta −25 / Admisible −35) | umbrales de acumulado del lugar | existe (4 niveles, no 2: ver D10) |
| KPI: asentamiento máximo + punto | acumulado de la última visita | derivable |
| KPI: promedio actual | media de acumulados | derivable (sin definir con baja/alta: D12) |
| KPI: diferencial máximo | máx − mín del acumulado | derivable (el motor calcula distorsión angular, no esto: D12) |
| KPI: velocidad reciente, «últimas 4 visitas» | — | **mal definido** (D12) |
| KPI: visitas en alerta / total | peor alerta por visita | derivable |
| Tabla de visitas: promedio, máximo, mayor Δ, estado | historial del motor | derivable |
| Tabla de visitas: **Amarre (BM + cota)** | — | **nuevo** |
| Tabla de visitas: **Cierre (mm)** | hoy `closure_error_mm` tecleado y sin uso | **nuevo** (derivado de la libreta) |
| Gráfica de tendencia: promedio + banda mín–máx + umbrales, clic abre la visita | historial | derivable, gráfica nueva |
| Dispersión por punto (eje X en días desde la base) con chips | historial | derivable, gráfica nueva |

### Vista de visita

| Elemento | Dato | Estado |
|---|---|---|
| Paginador anterior/siguiente | orden por fecha | derivable |
| Subtítulo: amarre, nivelador, equipo | `operator`, campos de equipo (fase 8) | existe salvo el amarre |
| KPIs: máximo, promedio (Δ frente a la anterior), mayor movimiento, puntos en alerta | historial | derivable |
| KPI: **cierre de nivelación ± tolerancia** | — | **nuevo** |
| Tabla de puntos: cota base, cota actual, acumulado, Δ, estado | historial | existe |
| Panel lateral del punto: acumulado, último mes, Δ, historial, «faltan X mm» | historial | derivable, gráfica nueva |
| Barras: acumulado por punto y Δ desde la anterior | historial | derivable, gráficas nuevas |

### Registro de nivelación (drawer)

| Elemento | Estado |
|---|---|
| Meta: fecha, nivelador, equipo, punto de amarre con cota | amarre **nuevo** |
| Libreta: Est., Punto, V+, AI, V int., V−, Cota, Observación | **nuevo** en asentamientos; el motor existe en nivelación |
| Filas de puntos de control resaltadas (vistas intermedias) | **nuevo**: une libreta y catálogo |
| ΣV+, ΣV−, error de cierre, tolerancia 12√K | motor de nivelación (`computeLeveling`, `levelingTolerance`) |

### Lo que el prototipo no tiene y el PRD debe añadir

- Formulario de nueva visita.
- Captura en vivo de la libreta.
- Importación por archivo.
- Estado del proceso de la visita (borrador / calculada / cerrada) y su cierre.
- Baja y alta de puntos (fase 11) y lectura fuera de tendencia (fase 12).

## 4. Hallazgos que condicionan el PRD

Verificados en el código el 2026-09-24.

- **H1 · La visita no tiene libreta ni vínculo con nivelación.**
  `settlement_readings` guarda una cota tecleada por punto. `closure_error_mm`
  se escribe a mano (`visit-editor.tsx:382`) y nada lo usa: ni cálculo, ni
  tolerancia, ni Excel, ni informe. El aviso «error de cierre de la nivelación
  asociada → advertencia» de la fase 5 nunca se implementó.
- **H2 · No existe el BM de amarre por visita.** El prototipo alterna entre
  BM-1 y BM-2. El único catálogo de BMs con cota es `reference_points` del
  proyecto, que ya usa `bm-selector.tsx` en nivelación.
- **H3 · El semáforo no coincide.** El prototipo tiene 3 niveles
  (Normal/Alerta/Crítico) calculados solo sobre el acumulado. La app tiene 4
  (`normal`/`caution`/`alert`/`alarm`) calculados sobre velocidad **y**
  acumulado; así lo fijó la decisión #9 de la fase 5 y lo cubren sus tests.
- **H4 · Colisión de nomenclatura.** El prototipo llama «PC-01» al punto de
  control, pero en nivelación `pc` es el punto de cambio, y el propio
  prototipo usa «CP-1» para este último. En la fase 11 el usuario llamó «BMs»
  a los puntos de control, mientras el prototipo reserva «BM» para el amarre.
- **H5 · Gráficas.** El prototipo usa Chart.js por CDN. `CLAUDE.md` y
  `chart-scale.ts` lo prohíben, así que hay que escribir 5 gráficas en SVG
  propio: línea con banda y umbrales, dispersión, dos de barras con umbrales,
  e historial del punto. Se pueden reutilizar `chart-scale.ts`,
  `series-markers.ts` y el patrón de `settlement-chart.tsx`. **La gráfica
  actual pone la visita en el eje X, con espaciado uniforme**, mientras el
  prototipo usa días: con visitas irregulares las dos cuentan historias
  distintas.
- **H6 · Identidad visual distinta.** El prototipo usa Barlow, el amarillo
  «mira», la paleta paper/ink y modo oscuro. La app usa Space Grotesk, no
  tiene modo oscuro ni un token parecido al «mira» (`#e2ad0b` casi seguro no
  llega a 3:1 sobre blanco en `pairings.ts`), y `main` está limitado a
  `max-w-5xl`, estrecho para el split tabla + panel lateral.
- **H7 · Faltan piezas del sistema de diseño:** drawer con scrim, tabla con
  fila seleccionable, chips de filtro, paginador, KPI con estado y subtítulo
  en `Card`. `Modal` tiene `size="lg"` sin commitear, de la fase 15.
- **H8 · La tabla de captura de nivelación no sirve tal cual para capturar en
  vivo.** No maneja teclado (Enter, foco, insertar entre filas) y usa
  `type="number"`, así que no acepta la coma decimal.
- **H9 · No hay código de importación** (ni `FileReader` ni `type="file"`). N4
  ya dejó decisiones tomadas: detector por contenido, parsers intercambiables
  que convergen en una forma intermedia, Leica `.L` más una plantilla CSV
  propia, repeticiones promediadas y previsualización editable con el tipo de
  punto deducido.
- **H10 · La libreta del prototipo no tiene distancias, pero calcula la
  tolerancia con K.** El motor de la fase 9 exige distancia por visual en las
  filas que no son intermedias (validador). Hay que decidir de dónde sale K
  (D7).
- **H11 · La «velocidad reciente» del prototipo repite el error del marco
  teórico.** Divide el cambio del promedio en 4 visitas entre «un mes», que
  solo vale si las visitas son semanales. Es el mismo fallo que la fase 5
  encontró en el marco teórico (hallazgo 2). La decisión #3, mes = 30.4375
  días, sigue vigente.
- **H12 · `saveLevelingProcessAction` borra y reinserta las lecturas sin
  transacción** y sin comprobar el error del borrado. La fase 5 ya aprendió
  que así se pierden datos (upsert por fila y purga después). Si la libreta de
  la visita reutiliza el patrón, no debe copiar esto.
- **H13 · Los datos del prototipo son sintéticos** (generados con semilla).
  Ningún número suyo sirve de fixture.

## 5. Decisiones a tomar en la sesión

Van en el orden en que conviene tomarlas: las primeras condicionan a las
demás. Cada una lleva una recomendación que la sesión puede revertir.

### Alcance

**D1 · ¿Una fase o varias?** El conjunto suma modelo nuevo, motor compartido,
captura en vivo, importación, 5 gráficas, 6 piezas de sistema de diseño y
el rediseño de dos pantallas, más que la fase 5, que ya se declaró «más grande
de lo normal». Recomendación: **tres fases, cada una con su PRD justo a
tiempo**:

| Fase | Contenido | Por qué en este orden |
|---|---|---|
| 16 · Libreta de nivelación en la visita | Modelo, motor compartido, formulario de nueva visita, captura en vivo, cierre con tolerancia, cotas derivadas | Es el dato que el layout necesita (amarre, cierre) y el destino de la importación |
| 17 · Panel y visita según el prototipo | KPIs, tablas navegables, gráficas SVG, drawer, componentes del sistema de diseño | Se pinta sobre datos que ya existen |
| 18 · Importación de lecturas (N4) | Plantilla CSV y Leica `.L` hacia la libreta de la visita (y de nivelación) | Necesita un destino ya estable |

La alternativa es invertir 16 y 17 si ver el layout primero importa más. En
ese caso las columnas Amarre y Cierre salen vacías hasta que exista la
libreta. **Si el usuario prefiere una sola fase**, el PRD tiene que declarar
qué se difiere primero en caso de desborde (propuesta: la importación y
después las gráficas secundarias).

### Modelo

**D2 · Cómo se une la libreta a la visita.**

| Enfoque | A favor | En contra |
|---|---|---|
| **A · Tabla propia de la visita (`settlement_book_readings`) con el motor de nivelación compartido** (recomendado) | Un solo ciclo de vida (el de la visita). Reutiliza `computeLeveling`, `levelingTolerance` y los validadores como funciones puras. No mete 48 nivelaciones en la pestaña Nivelaciones | Tabla, RLS y trigger de inmutabilidad nuevos. La UI de captura se comparte y no se copia |
| B · FK `settlement_visits.leveling_process_id` a un proceso de nivelación real | Reutiliza tabla, acciones, editor y export tal cual | Dos ciclos de vida que cerrar y sincronizar. Las cotas de la visita se vuelven una caché de otro proceso: la lección de la fase 5 sobre cachés que nadie invalida, pero entre dos módulos. Ensucia el hub |
| C · Seguir con cotas tecleadas y la libreta como adjunto opcional | Lo más barato | No cumple el prototipo: las cotas no salen de la libreta |

**D3 · ¿Se conservan las cotas directas?** Las visitas existentes (seed y
cualquier dato en la nube) no tienen libreta. Recomendación: un **modo de
captura por visita**, `libreta` (por defecto en las nuevas) o `cotas` (las
existentes, o una nivelación procesada fuera). En los dos modos
`settlement_readings.elevation` sigue siendo la cota canónica, pero en modo
`libreta` es **derivada** y la escribe el servidor.

**D4 · ¿Cotas corregidas o brutas?** Recomendación: las **corregidas**, por
compensación proporcional, cuando el circuito cumple la tolerancia. Es el
comportamiento del módulo de nivelación, que ya interpola las intermedias. La
libreta muestra las dos.

**D5 · ¿Qué pasa con una visita fuera de tolerancia?** Opciones:

1. Aviso y cierre bloqueado hasta volver a medir o corregir.
2. Nuevo estado `rejected` de la visita, que el motor excluye de la serie.
3. Solo aviso.

Recomendación: **(1)**. Queda abierta la cuestión de si una visita sin cerrar
y fuera de tolerancia alimenta el cálculo en vivo y se propaga a las
posteriores. Hay que resolverlo explícitamente, porque hoy toda visita
abierta se propaga.

**D6 · BM de amarre.** Recomendación: elegirlo del catálogo
`reference_points` del proyecto (reutilizando `bm-selector`) y guardar en la
visita una copia del código y la cota (`reference_bm_code`,
`reference_bm_elevation`), como hace `start_bm_*` en nivelación. Tipo de
circuito: **cerrado sobre el amarre**. Queda por decidir si se admite el
enlace entre dos BMs.

**D7 · Distancias y K.** Recomendación: **distancia por visual** (motor y
validador de la fase 9, hilos o modo digital). Con nivel digital o CSV llegan
sin coste. La alternativa, teclear la longitud total del circuito, deja sin
base la compensación proporcional.

**D8 · ¿Ida y vuelta en la visita?** Recomendación: no en esta fase. El
circuito cerrado basta y el prototipo no lo usa.

**D9 · Nomenclatura.** Hay que fijar cómo se llaman en la UI el punto
monitoreado, el BM de amarre y el punto de cambio. Opciones: (a) los puntos
son «BMs» (como en la fase 11) y el amarre es «BM de referencia»; (b) los
puntos son «puntos de control» y «BM» queda solo para el amarre. Los códigos
son texto libre; solo cambian etiquetas, el manual y los mensajes. La elige
el usuario.

**D10 · Semáforo.** Recomendación: **se mantienen los 4 niveles** (motor,
tests, informes, Excel y `StatusIndicator` con forma). Las gráficas dibujan
como líneas los umbrales de acumulado configurados en el lugar, con signo
negativo. «Crítico» del prototipo equivale a «Alarma».

### Presentación

**D11 · Identidad visual.** Recomendación: **layout y UX del prototipo con los
tokens de la app**. Adoptar Barlow, el amarillo «mira» y el modo oscuro
afecta a toda la app: si se quiere, va a `pendientes.md` como fase de sistema
de diseño aparte. Queda por decidir si esta ruta necesita un `main` más ancho
que `max-w-5xl`.

**D12 · Definición de cada KPI.** Propuesta para la sesión:

| KPI | Propuesta |
|---|---|
| Asentamiento máximo | Acumulado de mayor magnitud entre los puntos vigentes con lectura en la última visita (conservando el signo, porque un levantamiento es un hallazgo) |
| Promedio | Media de los acumulados de los puntos vigentes con lectura. Se advierte que mezcla líneas base cuando hay altas (fase 11) |
| Diferencial | **La peor distorsión angular (1/X)** frente a su límite, que es lo que el motor calcula y tiene umbral, en lugar de máx − mín sin distancia |
| Velocidad | Peor velocidad de la última visita según el motor (mes = 30.4375 d), **no** «últimas 4 visitas» (H11) |
| Visitas en alerta | Visitas cuyo peor nivel es ≥ `caution` |
| Visitas | Total y fecha del último registro. Se quita «4 por mes», que depende de los datos |

**D13 · Gráficas.** Qué entra y qué se aplaza, eje X en tiempo real (días) en
todas, si la gráfica actual se sustituye o convive con las nuevas, y si el
informe imprimible (`settlement-plot.tsx`) se alinea ahora o después
(recomendación: después). Todas deben leerse sin color: marcadores y tabla
alternativa, como exige la fase 5.

**D14 · Vista frente a editor de la visita.** Recomendación: **una ruta y dos
modos**. `/visits/[visitId]` muestra el layout del prototipo en lectura, y
«Editar libreta» abre la captura a página completa. El drawer «Registro de
nivelación» queda para lectura, porque capturar en un drawer es incómodo en
tableta.

### Captura

**D15 · Formulario de nueva visita.** Recomendación: modal con el patrón de
`georeference-dialog.tsx`, que lleva al editor. Campos: fecha, nivelador,
equipo y orden de precisión (**prellenados de la visita anterior**, que hoy
no se copian), BM de amarre y modo de captura (digitar / importar / cotas
directas).

**D16 · Captura en vivo.** Recomendaciones:

- **Plantilla precargada** con la secuencia de la visita anterior: amarre,
  puntos de control como vistas intermedias, puntos de cambio y cierre en el
  amarre. El nivelador solo llena lecturas.
- **Teclado**: Enter avanza de celda, se crea fila al final, se puede
  insertar entre filas y se acepta la coma decimal.
- Autocompletado del código contra el catálogo del lugar.
- Cálculo en vivo con la validación por capa existente.
- **Guardado explícito** con aviso de cambios sin guardar, coherente con las
  fases 3 a 5. Un borrador local en el navegador es opcional y no cuenta como
  persistencia; el modo offline sigue fuera de alcance.

**D17 · Importación.** Recomendaciones: la **plantilla CSV de TopoField** de
la libreta como mínimo, y Leica `.L` si cabe, porque ya está descifrado.
Arquitectura de N4: detector, forma intermedia y previsualización editable.
Queda por decidir si en la misma fase se conecta también al módulo de
nivelación: si es un solo adaptador, conviene hacerlo para cerrar N4. También
hay que decidir si se ofrece un CSV simple de `punto,cota` para el modo de
cotas directas.

### Salida

**D18 · Excel e informe.** Recomendación: Excel gana una hoja «Libreta». El
informe imprimible queda como está.

**D19 · Seed y proyecto demo.** Deben generar libretas coherentes: dos BMs de
amarre, dos armadas, punto de cambio y error de cierre. El generador del
prototipo sirve de modelo. Hay que verificar también el **arranque en frío**:
un proyecto sin `reference_points` (aprendizaje de la fase 5).

## 6. Borrador de modelo si D2 = A

Es un borrador para la sesión; la sesión decide.

```sql
-- settlement_visits (aditivo)
capture_mode TEXT NOT NULL DEFAULT 'direct' CHECK (capture_mode IN ('book','direct')),
reference_bm_code TEXT,
reference_bm_elevation DECIMAL(10,4),
total_distance_km DECIMAL(8,4),     -- derivado
tolerance_mm DECIMAL(8,1),          -- derivado
meets_tolerance BOOLEAN,            -- derivado
-- closure_error_mm existente: derivado en modo 'book', tecleado en 'direct'

-- settlement_book_readings (nueva), espejo de leveling_readings sin run_type
visit_id → settlement_visits ON DELETE CASCADE,
reading_order, point_code, point_type ('bm'|'pc'|'intermediate'),
point_id → settlement_points NULL,  -- se resuelve por código al guardar
backsight, foresight, hilos, back/fore_distance_m, observación,
calculados (AI, cota bruta, cota corregida, corrección, avisos)
UNIQUE (visit_id, reading_order)
```

Con RLS por join hasta `projects`, un trigger de inmutabilidad propio (las
funciones de filas hijas están atadas a su tabla por nombre) y los tipos
regenerados.

Motor: una función pura nueva,
`deriveControlElevations(levelingResult, points)`, que toma las filas
intermedias ya compensadas y devuelve la cota de cada punto de control. El
resto es `computeLeveling` sin cambios. `types/leveling.ts` y
`types/settlement.ts` exportan ambos un `ReadingInput`: hay que renombrar uno
al importarlos juntos.

**Caché derivada (riesgo principal).** `settlement_readings.elevation` pasa a
depender de la libreta, del amarre, de la cota del amarre y del orden de
precisión. El PRD debe listar **todas** las puertas que la invalidan y exigir
que cada una recalcule y propague, tal como exige la lección de la fase 5.

## 7. Esqueleto del PRD

Sigue la forma de los PRDs 10 a 14:

1. Estado, fechas, rama, origen (el prototipo y N4 si entra), módulo.
2. Propósito.
3. Fuentes.
4. Hallazgos (§ 4 de este plan, revisados).
5. Decisiones (tabla numerada con la razón de cada una).
6. Modelo de datos y migración aditiva.
7. Motor (reutilización y funciones nuevas).
8. Validación por capa: captura, cierre (tolerancia de la libreta) y
   estadística (que no bloquea).
9. Superficie: rutas, formulario, captura, vista, drawer, componentes del
   sistema de diseño y parejas nuevas en `pairings.ts`.
10. Seed y demo.
11. Archivos.
12. Pruebas.
13. Criterios de aceptación.
14. Fuera de alcance.
15. Riesgos.
16. Tareas en orden.
17. Enmiendas al PRD principal: § 4.5 (hoy dice «Columnas: punto, cota
    medida») y § 3.2.

## 8. Pruebas mínimas que el PRD debe exigir

- La libreta del prototipo, recalculada con `computeLeveling`, da sus cotas,
  ΣV+/ΣV− y error de cierre. Sirve para validar el enfoque, no como fixture
  numérico (H13).
- `deriveControlElevations`: intermedias compensadas, punto sin lectura, código
  que no está en el catálogo y punto dado de baja en esa fecha.
- Una visita fuera de tolerancia se comporta según D5.
- **Propagación**: editar la libreta, cambiar el amarre o su cota recalcula la
  visita y las posteriores abiertas, nunca las cerradas.
- Las visitas en modo `cotas` siguen funcionando igual que hoy (sin
  regresión).
- Revalidación en servidor: una llamada directa a la acción con una libreta
  inválida se rechaza.
- Trigger: una fila de libreta de una visita cerrada rechaza la escritura
  también por REST.
- KPIs según las definiciones de D12, incluido el caso de baja/alta.
- Si entra la importación: plantilla válida, formato desconocido con mensaje
  útil, repeticiones promediadas y tipo de punto deducido y editable.

## 9. Riesgos a registrar

- **La caché derivada entre libreta y lecturas** (§ 6), la lección más cara
  de la fase 5.
- **Tamaño** (D1).
- **Regresiones de las fases 11 y 12** al rehacer tablas y gráficas: badges
  «fuera de tendencia», «(de baja)»/«(alta …)» y huecos en las series.
- **Arranque en frío**: proyecto sin BMs de referencia y lugar sin visitas.
- **Contraste**: todo token o pareja nueva pasa por `pairings.ts`.
- **El borrado y reinserción sin transacción** si se copia la acción de
  nivelación (H12).

## 10. Pasos para redactar el PRD

1. **Cerrar la fase 15** (o que el usuario autorice explícitamente solapar la
   redacción).
2. Crear la rama `fase-16-<slug>` desde `main`.
3. **Sesión de decisiones**, una pregunta a la vez, en este orden: D1 → D2/D3
   → D9 → D10/D11 → D5/D6/D7 → D12–D17 → D18/D19.
4. **Verificación con código antes de escribir**: recalcular la libreta del
   prototipo con el motor de nivelación, en un script desechable. Confirma D2
   y D7 y mide H10.
5. **Bocetos de lo que el prototipo no cubre**: formulario de nueva visita,
   captura en vivo y previsualización de la importación.
6. Redactar `docs/prds/15-<slug>.md` con el esqueleto del § 7.
7. Autorrevisión: placeholders, contradicciones, alcance y ambigüedades.
8. Revisión y aprobación del usuario.
9. **Commit de apertura** (`docs:`): el PRD, el prototipo, los estados en
   `method.md` y `prds/README.md`, la enmienda del PRD principal y
   `pendientes.md` (N4 si entra, y la fase de identidad visual si D11 la
   difiere).
10. Plan de implementación (skill `writing-plans`) sobre el PRD aprobado.
