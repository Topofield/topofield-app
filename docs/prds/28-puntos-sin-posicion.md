# PRD-de-fase 29 — Puntos de control sin posición

**Estado:** cerrada
**Fecha de apertura:** 2026-10-01
**Fecha de cierre:** 2026-10-01

**Rama:** `fase-29-puntos-sin-posicion`
**Petición:** del usuario, 2026-10-01. Es A3 de `pendientes.md`. Al revisar el
proceso de demo de asentamientos pidió: «Necesito quitar todo lo que hace
referencia a que la espacialidad de los puntos, no vamos a manejar ni
coordenadas ni distancias conocidas entre puntos (Distorsión angular)».
Después añadió: «quita también las coordenadas de BM-1 y BM-2, si las
nivelaciones no llevan nada relacionado con coordenadas», y «sí, quita
también BM-01 y BM-02 del seed».
**Módulo:** control de asentamientos — base, motor, captura, panel, Excel,
demo, seed y documentación

> **Divergencias de la implementación:**
>
> - **También cambian las capturas 05 y 29.** La 05 es el catálogo de
>   referencia de «Lote catastral», con BM-01 y BM-02 sin coordenadas; la 29,
>   el panel en oscuro sin el KPI. El PRD nombraba solo la 13, la 14 y la 15.
> - **`ThresholdCell` pierde `integer` y `helperText`**: solo los usaba el
>   límite 1/X.
> - **`ComputedReading.baselineDate` se queda**: fecha la línea base del punto.
>   Solo cambió su comentario, que decía que la necesitaban los diferenciales.
> - **El manual explica por qué no hay coordenadas** (§ 7.2) y que un lugar
>   cerrado antes del cambio tampoco muestra la distorsión (riesgo 3).
> - **`CLAUDE.md` recoge además** la posición de los puntos en «Out of scope»
>   y el orden de despliegue de una migración que borra. La doc técnica
>   (§ 13) explica el razonamiento.
> - **La prueba pgTAP comprueba también el mensaje** del trigger: 8 pruebas
>   en vez de 7.
> - **Verificación en pantalla** en local, a 1280 px en claro y a 390 px en
>   oscuro: 53 comprobaciones, sin desborde ni errores de página. Cubren el
>   panel, Puntos y lugar, Editar TA-08, el lugar nuevo, el catálogo de
>   referencia, el Excel, duplicar Edificio Norte y la demo del primer inicio
>   de sesión.
> - **El seed se corrió también contra el esquema viejo**, antes de la
>   migración, para comprobar que el código nuevo funciona con él (hallazgo 3).
> - **La revisión de código no encontró defectos.** Solo un comentario del
>   seed que seguía citando el default de distorsión (`53e26ac`).
> - **Consulta previa en producción** (solo lectura, 2026-10-01): 8 puntos con
>   coordenadas, todos de Torre Alameda en el «Proyecto de ejemplo»; BM-1 y
>   BM-2 de la demo, uno de cada uno; ninguna poligonal amarrada a ellos y
>   ningún lugar con un límite distinto de 1/500. El `db push` no se lleva
>   ningún dato real.
> - **Producción** (2026-10-01): merge del #17 (`4cece3e`), despliegue de
>   Vercel y, después, el `db push`. Verificado: las tres columnas no
>   existen, el trigger vigila solo la C0, y BM-1 y BM-2 de la demo conservan
>   su cota sin coordenadas.

## Propósito

Un punto de control de asentamientos queda con lo que de verdad se mide:
**código, ubicación (texto), C0 y su serie de cotas**. Deja de tener Norte y
Este. Sin posición no hay distancia entre puntos, y sin distancia no hay
distorsión angular. Con ella se van los asentamientos diferenciales, que solo
existían para calcularla.

Lo que el módulo calcula de cada punto no cambia: asentamiento parcial y
acumulado, velocidad, semáforo y tendencia.

## Hallazgos que condicionan la fase

### 1. Lo único que usa la posición es la distorsión

| Dato | Dónde se usa |
|---|---|
| `settlement_points.northing`, `easting` | `horizontalDistance` → `computeDifferentials` → distorsión. Además: el catálogo de puntos (columnas y campos), el Excel (columnas Norte y Este), duplicar un lugar y el trigger de la Fase 23 |
| `sites.angular_distortion_limit` | `exceedsLimit` de cada par. Además: los umbrales del lugar (`tolerances.ts`, formulario, Excel) y duplicar un lugar |
| Diferenciales | Solo la distorsión, el KPI «Distorsión angular», la tarjeta del panel y la tabla de la hoja «Cálculos» del Excel |

El semáforo nunca usó la distorsión. El informe consolidado no muestra
coordenadas de puntos de control ni distorsión: calcula `computeHistory`, pero
no lee sus diferenciales.

### 2. La nivelación no usa coordenadas

De un punto de referencia, la nivelación solo lee la cota y el código. No
usan coordenadas el motor, los validadores, el editor, el Excel ni el informe
del módulo, y tampoco la libreta de la visita ni la nivelación de la demo.
Las coordenadas del catálogo de referencia solo las usan las poligonales: el
amarre, el azimut y la georreferenciación. Por eso BM-1 y BM-2 (demo) y BM-01
y BM-02 (seed) pueden perder las suyas.

### 3. El orden del despliegue va al revés

`CLAUDE.md` pone el `db push` **antes** del merge, porque Vercel despliega al
instante. Vale para migraciones que añaden. Esta **borra**:

| Combinación | Resultado |
|---|---|
| Código nuevo + esquema viejo | **Funciona.** Las coordenadas son nullables y `angular_distortion_limit` tiene default 500; el código nuevo no las nombra |
| Código viejo + esquema nuevo | **Se rompe.** Fallan crear y editar un punto, guardar los umbrales de un lugar, duplicarlo y crear el proyecto de ejemplo en el primer inicio de sesión: todos nombran columnas que ya no existen |

Así que esta fase hace **primero el merge y después el `db push`**. Por la
misma razón, en local el código deja de usar las columnas antes de que la
migración las borre: cada commit compila contra el esquema que tiene.

### 4. El trigger de la Fase 23 nombra las coordenadas

`settlement_points_reject_reference_change_with_closed_readings` vigila
`initial_elevation, northing, easting` en su lista `update of` y en su
`when`, y su mensaje dice «su C0 y sus coordenadas no cambian». La migración
lo quita antes de borrar las columnas y lo recrea solo sobre la C0, sin
depender de `cascade`. La función conserva su nombre: solo cambia el mensaje.

### 5. Los BM de la demo en producción se reconocen sin error

Desde que entraron (`a71bf4a`, 2026-09-24), BM-1 y BM-2 de Torre Alameda
tienen siempre el mismo código, la misma descripción y las mismas
coordenadas:

| Código | Descripción | Norte | Este |
|---|---|---|---|
| BM-1 | BM de amarre de Torre Alameda (andén norte) | 5000 | 5000 |
| BM-2 | BM de amarre alterno de Torre Alameda (portería) | 5040 | 5060 |

Esa huella identifica todos los proyectos de ejemplo, y un BM real del
usuario no coincide en las cuatro cosas. `reference_points` no tiene trigger,
así que el `update` no puede hacer fallar la migración. Las visitas copian la
cota del BM en su libreta, así que tampoco cambian.

### 6. Lo cerrado deja de mostrar su distorsión

Un lugar o una visita cerrados siguen con los mismos asentamientos, pero su
panel y su Excel dejan de mostrar diferenciales y distorsión. Ningún informe
emitido cambia, porque no los incluye. La fase no hace ningún `UPDATE` sobre
una visita ni sobre un lugar cerrado: quita columnas por decisión del
usuario.

## Alcance

### A. Motor

- `settlement.ts`: se quitan `horizontalDistance`, `computeDifferentials`, el
  mapa de cotas por fecha de `computeHistory` (solo servía a los
  diferenciales) y el campo `differentials` del resultado. `pointInputOf` y
  `PointInput` pierden `northing` y `easting`.
- `settlement-summary.ts`: se quita `worstDistortion` y se corrige el
  comentario de cabecera.
- `tolerances.ts`: `angularDistortionLimit` sale de `Thresholds`, de
  `thresholdsFor` (los cuatro tipos de estructura) y de `thresholdsOf`.
- `types/settlement.ts`: se quitan `DifferentialPair`,
  `angularDistortionLimit`, `northing` y `easting`.
- `validators/settlement.ts`: lo que cuenta como cambio bloqueado con
  lecturas cerradas es solo la C0.
- Los comentarios que nombran lo que se va, como el de
  `getSettlementReadingsBySite` en `queries.ts` («la gráfica, los diferenciales y las
  tendencias»).

### B. Captura

- **Catálogo de puntos** (`points-catalog.tsx`): se quitan las columnas y los
  campos Norte y Este y la regla «las dos o ninguna». El diálogo de un punto
  con lecturas cerradas bloquea solo la C0 y su aviso lo dice así.
- **Acciones de puntos** (`point-actions.ts`): crear y guardar sin
  coordenadas; el mensaje de la C0 bloqueada deja de nombrarlas.
- **Umbrales del lugar** (`thresholds-fields.tsx`, `site-form.tsx`,
  `sites/actions.ts`): se quitan el campo «Límite de distorsión angular
  (1/X)» y su validación.
- **Duplicar un lugar** (`sites/actions.ts`): deja de copiar las coordenadas
  y el límite.

### C. Panel

- Se quita el KPI «Distorsión angular». **El panel queda con cinco KPIs, sin
  sustituto, y la rejilla no se toca** (decisión 6). `SiteKpis` pierde la
  prop `distortionLimit` y `formatDistortion`.
- Se quita la tarjeta «Asentamientos diferenciales y distorsión angular» y
  el componente `differentials-table.tsx`.

### D. Excel

- **«Datos Crudos»:** el catálogo de puntos, sin las columnas Norte y Este.
- **«Cálculos»:** sin la tabla «Asentamientos diferenciales (última visita)».
- **«Resumen»:** sin la fila «Límite de distorsión angular» ni «Pares que
  superan la distorsión».

### E. Demo y seed

- `torre-alameda.ts`: los ocho puntos sin `northing` ni `easting`, y
  `AmarreAlameda` sin `north` ni `east`. `fixtures.ts` deja de copiarlos.
- `insertar-asentamiento.ts`: no los inserta.
- `scripts/seed.mjs`:
  - los puntos de Edificio Torre Central (P-01 a P-07) y de Edificio Norte
    (N-01 a N-04), sin coordenadas;
  - BM-01 y BM-02 de `REFERENCE_POINTS`, sin coordenadas;
  - GPS-1 y los amarres de las carteras (TT4, 14_IS1) **conservan las
    suyas**: los usan las poligonales.
- Los tests que construyen puntos con `northing: null` y `easting: null`
  (`libreta-asentamientos.test.ts`, `settlement-book.test.ts`,
  `validators/settlement-book.test.ts`, `fixtures.test.ts`) los dejan de
  pasar.

### F. Base de datos (al final, cuando ningún código usa las columnas)

Migración `supabase/migrations/20261001030000_puntos_sin_posicion.sql`:

1. `drop trigger settlement_points_reject_reference_change_with_closed_readings`.
2. `alter table settlement_points drop column northing, drop column easting`.
3. `alter table sites drop column angular_distortion_limit`.
4. `create or replace function reject_reference_change_with_closed_readings()`
   con el mensaje «El punto % tiene lecturas en la visita cerrada %: su C0 no
   cambia.», con el mismo `errcode`.
5. El trigger, recreado: `before update of initial_elevation`, `when (old.initial_elevation is distinct from new.initial_elevation)`.
6. La limpieza de los BM de la demo: `update reference_points set north =
   null, east = null` donde coinciden código, descripción, Norte y Este con
   la tabla del hallazgo 5.

Después: `c0_con_lecturas_cerradas.test.sql` sin los casos de coordenadas,
con `hasnt_column` para las tres columnas; y los tipos de `database.ts`
regenerados.

### G. Documentación

- **Manual, en sus dos copias:**
  - § 7.1, sin el límite de distorsión;
  - § 7.2, el catálogo sin Norte y Este y la C0 fija sin «sus coordenadas»;
  - § 7.4, «Indicadores» pasa de seis a cinco y se quita el párrafo
    «Diferenciales y distorsión angular».
  - Capturas 13 (nuevo lugar), 14 (Puntos y lugar) y 15 (panel). En
    `capturas.mjs`, el comentario que explica el recorte de la 15 por la
    tabla de diferenciales.
- **PRD principal:**
  - § 3: el DDL de `sites` y `settlement_points` y la nota de la Fase 5 sobre
    `northing` y `easting`;
  - § 4: el catálogo, los umbrales y la tabla de diferenciales;
  - § 6.10: el diferencial, la distorsión y sus casos frontera.
- **Doc técnica:** modelo de datos, motor de asentamientos, integridad (la C0
  fija), tabla de pruebas y § 11, entrada por entrada.
- **`CLAUDE.md`:** «la C0 y las coordenadas de un punto con lecturas en una
  visita cerrada no cambian» pasa a decir solo la C0.
- **`docs/testing/manual-e2e-asentamientos.md`:** los pasos que piden Norte,
  Este, el límite 1/500 o los diferenciales (3 bis, 4, el de P-07 y la
  tarjeta).
- **`pendientes.md`:** A3 se cierra.
- **`method.md`, «Aprendizajes»:** una migración que borra va después del
  merge.

## Decisiones del usuario (apertura)

1. **Los puntos de control no tienen posición:** ni coordenadas ni distancias
   entre ellos, y por tanto ni distorsión angular.
2. **Los diferenciales se van del todo.** Sin posición no se sabe qué pares
   son vecinos, y una tabla de todos contra todos (28 pares en Torre Alameda)
   no dice nada. Siguen el asentamiento máximo y el promedio.
3. **Las columnas se borran con una migración**, no se dejan muertas. Es
   irreversible.
4. **Va como Fase 29, después de la 28.**
5. **BM-1 y BM-2 de la demo y BM-01 y BM-02 del seed pierden sus
   coordenadas**, verificado que la nivelación no las usa. GPS-1 las
   conserva.
6. **El sexto KPI:** «lo más simple, sin sobreingeniería». Se quita la
   tarjeta y no se pone otra en su lugar.
7. **Los proyectos de ejemplo ya creados en producción:** «sí, reemplaza
   todo». La migración limpia BM-1 y BM-2 en todos.

## Decisiones

| # | Decisión | Razón |
|---|---|---|
| 1 | Merge antes del `db push` | El código nuevo funciona con el esquema viejo; el viejo no funciona con el nuevo (hallazgo 3) |
| 2 | En local, el código primero y la migración al final | Cada commit compila y pasa las pruebas contra el esquema que tiene |
| 3 | El trigger se recrea sobre la C0, con el mismo nombre de función | Cambios mínimos. La regla de la Fase 23 sigue para lo único que alimenta el acumulado |
| 4 | Los BM de la demo se reconocen por su huella completa | Código, descripción, Norte y Este juntos: todos los proyectos de ejemplo y ningún BM real |
| 5 | La rejilla de KPIs no se toca | Decisión 6 del usuario |

## Pruebas

| Qué | Cómo |
|---|---|
| Lo que no cambia | Los tests de asentamiento parcial y acumulado, velocidad, semáforo, tendencia y línea base pasan **sin tocar sus valores esperados**, y también los de Torre Alameda en `fixtures.test.ts` |
| Lo que se va | Se borran los tests de `horizontalDistance`, `computeDifferentials`, distorsión, `worstDistortion` y la regla «las dos o ninguna» |
| Tolerancias | `thresholdsFor` y `thresholdsOf` sin el límite |
| Validador | Con lecturas cerradas, cambiar la C0 se rechaza, y el código y la ubicación se pueden cambiar |
| Excel | Sin Norte ni Este en el catálogo, sin la tabla de diferenciales y sin las dos filas del resumen |
| pgTAP | La C0 bloqueada con lecturas cerradas y libre sin ellas; `hasnt_column` para las tres columnas |
| Limpieza de BM | En local, dentro de una transacción que se revierte: filas con la huella quedan sin coordenadas; un BM-1 con otras coordenadas o con otra descripción no cambia |
| Seed y demo | `npx supabase db reset && npm run seed` sin errores. Un usuario nuevo recibe el proyecto de ejemplo, con BM-1 y BM-2 sin coordenadas |

**En pantalla (local), claro y oscuro, 1280 y 390 px:**
- en Torre Alameda: el panel con cinco KPIs y sin la tarjeta de
  diferenciales, la pestaña Puntos y lugar, y Editar TA-08 con la C0
  bloqueada;
- el formulario de un lugar nuevo, sin el límite;
- duplicar un lugar;
- el Excel;
- el catálogo de referencia de «Lote catastral» (BM-01 y BM-02 con «—»).

## Criterios de aceptación

1. En la app no queda ningún campo, columna, KPI, tabla ni texto de
   coordenadas de puntos de control, distancia entre ellos, diferenciales ni
   distorsión angular. `grep -rniE "northing|easting|distorsi|distortion|differential|diferencial" src`
   no encuentra nada del módulo de asentamientos.
2. La C0 de un punto con lecturas en una visita cerrada sigue bloqueada en el
   diálogo, en la acción y en la base.
3. Los asentamientos, velocidades, semáforos y tendencias son los mismos de
   antes.
4. La demo y el seed crean BM-1, BM-2, BM-01 y BM-02 sin coordenadas. GPS-1 y
   los amarres de las carteras conservan las suyas.
5. La migración limpia los BM de la demo y no toca un BM con otra huella.
6. `npm run typecheck`, `npm run lint`, `npm test`, `npx supabase test db` y
   `npm run build` pasan limpios. El manual está actualizado en sus dos
   copias, con las capturas 13, 14 y 15, y la § 11 está revisada.
7. Producción: merge y después `db push`, con el visto bueno del usuario.

## Fuera de alcance

- **El catálogo de puntos de referencia del proyecto:** conserva sus
  coordenadas, porque lo usan las poligonales.
- **El marco teórico** (`docs/marco-teorico/mt-control_asentamientos.docx`).
  Es material de la monografía; si se anota allí que la distorsión queda
  fuera del alcance, lo decide el usuario.
- **El prototipo** (`docs/prototipos/`) y los PRD cerrados: son registro
  histórico.
- **CR2 (D-13)**, la estabilidad de los BM en la libreta de la visita: es
  otra petición.

## Riesgos

- **Las coordenadas de producción se pierden con el `db push`.** Mitigación:
  es la decisión 3 del usuario, y tras la fase nada las lee. Antes del push,
  una consulta de solo lectura cuenta cuántos puntos tienen coordenadas fuera
  de los proyectos de ejemplo, y el usuario la ve.
- **Una poligonal amarrada a un BM de la demo.** Si alguien usó BM-1 o BM-2
  como amarre, después de la limpieza un borrador ya no puede calcular el
  azimut desde él, y el dibujo de un informe pierde la marca del amarre. Las
  coordenadas guardadas de una poligonal cerrada no cambian. Mitigación: la
  misma consulta previa cuenta esos casos; si hay alguno, se consulta al
  usuario antes del push.
- **El panel de un lugar cerrado deja de mostrar su distorsión** (hallazgo
  6). Mitigación: se anota en el manual. Ningún informe emitido cambia.

## Tareas (en orden)

0. **Apertura:** este PRD, los estados en `method.md` y `prds/README.md`, y
   A3 en curso en `pendientes.md`. Commit `docs:`. La rama ya existe.
1. **A** — el motor, las tolerancias, los tipos y el validador, con sus
   tests.
2. **B y C** — la captura y el panel.
3. **D** — el Excel.
4. **E** — la demo y el seed.
5. **F** — la migración, la prueba pgTAP y los tipos;
   `npx supabase db reset && npm run seed`; la limpieza de BM probada en
   una transacción.
6. **Verificación en pantalla** en local.
7. **Cierre:**
   - documentación: manual (dos copias) y capturas, PRD principal, doc
     técnica, `CLAUDE.md`, guía e2e, `method.md`, `prds/README.md` y
     `pendientes.md`;
   - revisión de código y PR.
8. **Producción:**
   - la consulta de solo lectura del riesgo;
   - el merge, que decide el usuario;
   - después, `npx supabase db push`, con su visto bueno.
