# PRD-de-fase 18 — Libreta de nivelación y panel de asentamientos

**Estado:** en curso
**Fecha de apertura:** 2026-09-24
**Fecha de cierre:** —

**Rama:** `fase-18-libreta-panel-asentamientos`
**Origen:** prototipo del usuario
[`prototipos/Control de asentamientos, Torre Alameda.html`](../prototipos/Control%20de%20asentamientos%2C%20Torre%20Alameda.html),
planificado en
[`superpowers/plans/2026-09-24-plan-prd-asentamientos-prototipo.md`](../superpowers/plans/2026-09-24-plan-prd-asentamientos-prototipo.md)
**Módulo:** control de asentamientos
**Reutiliza:** motor y captura de nivelación (fases 4, 8, 9 y 10) e importación
de libretas (fase 16)

## Propósito

Llevar a la app el prototipo del control de asentamientos, adaptado al modelo,
al motor y al sistema de diseño que ya existen. Al cerrar la fase:

1. **La visita tiene su libreta de nivelación.** Se digita en vivo o se importa
   desde un archivo (el `.L` de Leica o la plantilla CSV de la fase 16), y **las
   cotas de los puntos de control salen de ella** en lugar de teclearse. La
   visita registra su BM de amarre, su error de cierre y su tolerancia.
2. **Crear una visita es un formulario completo**: fecha, nivelador, BM de
   amarre, equipo y modo de captura, con el equipo tomado de la visita anterior.
3. **El panel del lugar y la vista de la visita siguen el layout del
   prototipo**: KPIs, tabla de visitas navegable, tendencia con banda y
   umbrales, dispersión por punto, tabla de puntos con historial lateral,
   barras por punto y el registro de nivelación en un panel deslizante.

Una sola fase, por decisión del usuario: la libreta, el panel y la importación
van juntos.

## Fuentes

- El prototipo. Sus datos son sintéticos (se generan con semilla): **ningún
  número suyo entra como fixture**.
- `PRD-TopoField.md` § 3.2, § 4.5, § 4.6, § 5.1–5.3, § 6.8–6.11. Se enmiendan
  § 3.2, § 4.5 y § 5.2 (ver «Enmiendas»).
- `04-asentamientos.md`: siguen vigentes las decisiones #3 (mes = 30.4375 d),
  #9 (semáforo con forma), #12 (se cierra la visita), #14 (visita 0 = línea
  base) y #15 (el servidor recalcula al guardar).
- `10-estado-bms.md` y `11-lectura-desfasada.md`: la baja y el alta de puntos y
  la lectura fuera de tendencia **no se pierden** en la nueva UI.
- `07-…`, `08-…`, `09-…`: equipo por visita, cadena de distancias, vista
  más/menos.
- `15-importar-nivel-digital.md`: lectores, forma intermedia, plantilla y
  previsualización.
- `method.md`, «Cierre Fase 5»: la caché derivada que nadie invalida y el
  arranque en frío.

## Hallazgos que condicionan la fase

Verificados en el código el 2026-09-24.

### 1. La visita no tiene libreta, y su error de cierre no se usa

`settlement_readings` guarda **una cota tecleada por punto**. El campo «Error de
cierre (mm)» del editor de visita (`closure_error_mm`) se escribe a mano y
nada lo lee: ni cálculo, ni tolerancia, ni Excel, ni informe. El aviso «error de
cierre de la nivelación asociada fuera de tolerancia» previsto por la fase 5
nunca se implementó. Tampoco existe el BM de amarre por visita. En el
prototipo, que alterna BM-1 y BM-2 entre visitas, es una columna del panel.

### 2. El motor de nivelación ya resuelve la libreta del prototipo

Se recalculó con `computeLeveling` una libreta con la forma de la del
prototipo: amarre, 4 vistas intermedias, punto de cambio, 4 intermedias más y
cierre en el amarre. Script desechable; los valores están en «Pruebas».

- La comprobación aritmética pasa; el cierre sale en 1.30 mm frente a una
  tolerancia de 4.87 mm (tercer orden, 0.165 km).
- **Las intermedias salen compensadas** por la distancia acumulada de su
  armada. Las de la primera armada heredan 0.040 km y las de la segunda
  0.127 km.
- **Sin distancias, como en el prototipo,** el cierre se calcula, pero la
  tolerancia queda en `null` y no se compensa. El prototipo evalúa `12√K` sin
  tener de dónde sacar K. **Hace falta la distancia por visual.**

No hay que escribir motor de nivelación nuevo: basta con **derivar** las cotas
de los puntos de control de un resultado que ya existe.

### 3. Los triggers de las lecturas sirven para la libreta

`reject_write_on_closed_visit_reading()` y `reject_write_on_closed_site_reading()`
solo leen `visit_id` de la fila, no el nombre de la tabla. Una tabla de libreta
con `visit_id` los reutiliza tal cual. La lección de la fase 15 («un trigger
compartido no admite excepciones de una tabla») no aplica: aquí no hay
excepción.

### 4. Lo que del prototipo no se traslada tal cual

- **El semáforo tiene 3 niveles** y solo mira el acumulado. La app tiene 4
  (`normal`/`caution`/`alert`/`alarm`) sobre velocidad y acumulado.
- **La «velocidad reciente»** divide el cambio del promedio de 4 visitas entre
  «un mes», que solo vale si las visitas son semanales. Es el error que la
  fase 5 encontró en el marco teórico (hallazgo 2).
- **El «diferencial máximo»** es máximo − mínimo del acumulado, sin distancia.
  El motor ya calcula la distorsión angular, que es lo que tiene umbral.
- **Las gráficas usan Chart.js desde un CDN**, y `CLAUDE.md` prohíbe
  librerías. Se dibujan en SVG propio.
- **La identidad visual** (Barlow, el amarillo «mira», el modo oscuro) no es la
  de la app.
- **«PC-01» nombra un punto de control**, pero en la libreta `PC` es el punto
  de cambio.

### 5. La gráfica actual pone la visita en el eje X

`settlement-chart.tsx` espacia las visitas uniformemente. El prototipo usa el
tiempo: con visitas irregulares (el marco teórico pasa de mensual a trimestral)
las dos cuentan historias distintas, y la del índice exagera la pendiente de
los intervalos largos.

### 6. La tabla de captura de nivelación se puede compartir

`leveling/readings-table.tsx` es un componente controlado (`readings`,
`onChange`, `computed`, `issues`) sin dependencias del proceso. Le faltan dos
cosas para capturar en campo con comodidad: sugerencias de código e insertar
una fila entre otras dos.

### 7. La acción de nivelación borra y reinserta sin transacción

`saveLevelingProcessAction` borra todas las lecturas y las vuelve a insertar,
sin comprobar el error del borrado. La fase 5 ya aprendió que así se pierden
datos. **La libreta de la visita no copia ese patrón.**

## Decisiones

| # | Decisión | Razón |
|---|---|---|
| 1 | **Una sola fase** con libreta, formulario, importación, panel y vista de visita | Decisión del usuario. Si el alcance desborda, se difiere primero la dispersión por punto y después las barras de la visita; nunca la libreta ni la caché derivada |
| 2 | La libreta vive en una **tabla propia de la visita** (`settlement_book_readings`) y usa el **motor de nivelación compartido** | Decisión del usuario. Un solo ciclo de vida, el de la visita; no aparecen nivelaciones sueltas en el hub; el motor y el importador se reutilizan como funciones puras |
| 3 | **Modo de captura por visita**: `book` (libreta) o `direct` (cotas tecleadas). Las visitas nuevas nacen en `book`; **las existentes quedan en `direct`** | Las visitas actuales no tienen libreta, y una nivelación procesada fuera de la app tiene que poder registrarse. En los dos modos, `settlement_readings.elevation` sigue siendo la cota canónica |
| 4 | En modo `book`, la cota de un punto de control **se deriva** de la fila de la libreta cuyo código coincide con él (`samePointCode`). Se usa la **cota compensada**; si no hay compensación (fuera de tolerancia o sin distancias), la calculada | Es lo que hace nivelación. El usuario no teclea la cota: la escribe el servidor |
| 5 | Una libreta **fuera de tolerancia solo avisa**: se guarda, se cierra y alimenta la serie, con sus cotas sin compensar | Decisión del usuario. El aviso se ve en el editor, en la columna Cierre del panel, en la vista y en el diálogo de cierre. **Una comprobación aritmética fallida sí bloquea el cierre**, como en nivelación: no es un resultado de campo sino un error de la libreta |
| 6 | **BM de amarre por visita**, elegido del catálogo `reference_points` del proyecto con `bm-selector` o tecleado. La visita guarda **una copia** del código y la cota | Una copia no se desactualiza si alguien corrige después el catálogo, así que no crea otra caché que invalidar. Es lo que hace nivelación con `start_bm_*` |
| 7 | La libreta es **un circuito cerrado sobre el amarre**: la primera y la última fila son el BM de amarre | Es lo que muestra el prototipo. El enlace entre dos BMs queda fuera |
| 8 | **Distancia por visual**, con el motor y el validador de la fase 9 (hilos o modo digital). Sin distancias, el cierre se calcula pero la tolerancia y la compensación no, con aviso | Hallazgo 2. Con nivel digital o importación, la distancia llega sin trabajo extra |
| 9 | **Sin ida y vuelta** en la visita | El circuito cerrado basta y el prototipo no la usa. La importación lee siempre un solo recorrido |
| 10 | Nombres en la interfaz: **«punto de control»** para el punto monitoreado y **«BM de amarre»** para el de referencia. En la libreta, «PC» sigue siendo el punto de cambio | Decisión del usuario. La interfaz actual ya dice «punto» casi siempre |
| 11 | **Tokens de la app y semáforo de 4 niveles.** Las gráficas dibujan como líneas los tres umbrales de acumulado del lugar, en negativo. Barlow, el amarillo «mira» y el modo oscuro pasan a `pendientes.md` | Decisión del usuario. El semáforo de 4 niveles está en el motor, los tests, el Excel y el informe |
| 12 | Los KPIs se definen sobre el motor (tabla «KPIs») y no copian las fórmulas del prototipo | Hallazgo 4 |
| 13 | **Eje X en el tiempo** en todas las gráficas nuevas. La gráfica por índice sale del panel. El informe imprimible no cambia | Hallazgo 5. El informe tiene su propia gráfica estática, y alinearlo es otra fase |
| 14 | **Vista y editor separados.** `/visits/[visitId]` es la vista del prototipo, para toda visita; `/visits/[visitId]/editar` es el editor, solo para visitas abiertas | La vista es de lectura y el editor es de captura, y cada uno necesita su espacio. Una visita cerrada que entra al editor se redirige a la vista |
| 15 | **Nueva visita en un modal** (patrón de `georeference-dialog.tsx`) que crea la visita y lleva al editor | Campos: fecha, nivelador, BM de amarre, orden de precisión y equipo (**tomados de la visita anterior**, que hoy no se copian) y modo: *digitar la libreta*, *importar un archivo* o *cotas directas*. «Importar» crea la visita en modo `book` y abre el editor con el diálogo de importación |
| 16 | **Plantilla precargada.** Si la visita no tiene libreta, el editor propone la secuencia de la visita anterior en modo `book` (códigos y tipos, sin lecturas), con el amarre cambiado por el de esta visita. Sin anterior, se genera: amarre → puntos de control vigentes como intermedias → amarre | Para capturar en vivo, el nivelador solo llena lecturas. La plantilla no se guarda hasta que el usuario guarda |
| 17 | La **tabla de captura de nivelación se comparte**, no se copia, y gana dos cosas **opcionales**: sugerencias de código (`<datalist>`) e «Insertar fila debajo». Además acepta una nota por fila, que la visita usa para marcar los puntos de control | Hallazgo 6. Nivelación no cambia de comportamiento si no pasa las props nuevas |
| 18 | La **importación reutiliza `src/lib/import/leveling`**: lectores, detector, plantilla y paso a libreta en modo de un recorrido. El diálogo de la visita es propio (no hay ida y vuelta ni tipo de proceso) y reutiliza la previsualización de la fase 16 | Nada se guarda hasta Guardar. Si ya había libreta, se reemplaza con aviso. El nivel pasa a `digital`. Si la visita no tiene amarre, se propone el punto de partida del archivo |
| 19 | La libreta se guarda con **upsert por `(visit_id, reading_order)` y purga de las filas sobrantes**, nunca con borrado y reinserción | Hallazgo 7 |
| 20 | **Renombrar un punto de control** renombra también sus filas de libreta en las visitas **abiertas**. Las cerradas conservan su código | Las filas guardan `point_id`. Sin esto, el siguiente guardado no encontraría el código viejo y la cota del punto desaparecería de la visita sin aviso |
| 21 | El Excel gana una hoja **«Libretas»**. El informe imprimible no cambia | La libreta es el dato crudo de la visita. El informe es otra fase (decisión 13) |
| 22 | El seed gana un lugar **«Torre Alameda»** en modo `book`, a imagen del prototipo. El lugar existente queda en modo `direct` y el proyecto demo usa el mismo generador | Los escenarios de las fases 11 y 12 del seed no se tocan. El generador construye la libreta **hacia atrás**, desde la serie, para que las cotas compensadas la reproduzcan |

## Modelo de datos

Migración nueva y aditiva: `<timestamp>_libreta_visita.sql`.

### `settlement_visits`

```sql
alter table public.settlement_visits
  add column capture_mode text not null default 'direct'
    check (capture_mode in ('book', 'direct')),
  add column reference_bm_code      text,
  add column reference_bm_elevation decimal(10,4),
  add column total_distance_km      decimal(8,3),   -- derivado en 'book'
  add column tolerance_mm           decimal(8,1),   -- derivado en 'book'
  add column meets_tolerance        boolean;        -- derivado en 'book'
```

- El `default 'direct'` pasa a `direct` las visitas existentes. La app crea
  las nuevas con `book` explícito.
- `closure_error_mm` (existente) pasa a ser **derivado en `book`** y sigue
  tecleado en `direct`. `tolerance_mm` y `meets_tolerance` quedan `null` en
  `direct`.
- El amarre es obligatorio para **guardar una libreta con lecturas**, no para
  crear la visita: la importación puede traerlo. Por eso no lleva `CHECK`.

### `settlement_book_readings` (nueva)

Espejo de `leveling_readings` sin `run_type` y con enlace al punto de control:

```sql
create table public.settlement_book_readings (
  id                      uuid primary key default gen_random_uuid(),
  visit_id                uuid not null references public.settlement_visits(id) on delete cascade,
  reading_order           int  not null,
  point_code              text not null,
  point_type              text not null check (point_type in ('bm', 'pc', 'intermediate')),
  -- Punto de control al que corresponde la fila, resuelto por código al guardar.
  point_id                uuid references public.settlement_points(id) on delete set null,
  backsight               decimal(6,4),
  foresight               decimal(6,4),
  back_upper_m            decimal(6,4),
  back_lower_m            decimal(6,4),
  fore_upper_m            decimal(6,4),
  fore_lower_m            decimal(6,4),
  back_distance_m         decimal(8,3),
  fore_distance_m         decimal(8,3),
  -- Calculados (el Excel y la vista leen sin recalcular)
  distance_accumulated_km decimal(8,3),
  instrument_height       decimal(10,4),
  elevation_calculated    decimal(10,4),
  elevation_corrected     decimal(10,4),
  correction_applied      decimal(8,4),
  created_at              timestamptz not null default now(),
  unique (visit_id, reading_order)
);
create index settlement_book_readings_point_id_idx on public.settlement_book_readings(point_id);
```

- **RLS:** 4 políticas con join de tres niveles (fila → visita → lugar →
  proyecto), igual que `settlement_readings`.
- **Inmutabilidad:** triggers `before insert or update or delete` con
  `reject_write_on_closed_visit_reading()` y
  `reject_write_on_closed_site_reading()`, reutilizadas (hallazgo 3).
- **Vigencia (fase 11):** la libreta **no** lleva el trigger de vigencia. Un
  punto dado de baja puede aparecer en la libreta; simplemente no produce
  lectura (ver «Derivación»).
- `on delete set null` en `point_id`: si se borra un punto, su fila queda como
  radiación. `deletePointAction` ya impide borrar puntos con lecturas en
  visitas cerradas.

Tras aplicar: regenerar `database.ts`.

## Motor

Funciones puras en `src/lib/calculations/settlement-book.ts`, sin React ni
Supabase.

### Libreta de la visita

```ts
computeVisitBook(rows: ReadingInput[], referenceElevation: number, order: PrecisionOrder): LevelingResult
```

Llama a `computeLeveling` con `type: "closed"`, `startElevation` igual a la
cota del amarre y sin vuelta. No añade cálculo propio.

### Derivación de las cotas

```ts
deriveControlElevations(result, points, visitDate): {
  readings: { pointId: string; elevation: number; rowIndex: number }[];
  issues: BookIssue[];
}
```

Reglas:

- Una fila con **V−** cuyo código coincide (`samePointCode`) con un punto de
  control da la cota de ese punto. Vale para cualquier tipo de fila: un punto
  de control puede usarse como punto de cambio.
- La cota es `elevationCorrected`, **redondeada a 4 decimales**, que es la
  resolución de `settlement_readings.elevation` (aprendizaje de la fase 16:
  los valores esperados se calculan con la redondez del almacenamiento).
- **El mismo punto de control con V− en dos filas es un error** que bloquea
  el guardado: no hay criterio obvio para elegir una de las dos.
- **Un punto no vigente en la fecha de la visita** (dado de baja, o de alta
  posterior) no produce lectura, con aviso. El trigger de vigencia la
  rechazaría de todas formas.
- **Un código que no es punto de control** es una radiación normal (el amarre,
  un punto de cambio, un punto auxiliar). Sin aviso.
- **Un punto de control vigente que falta en la libreta** se lista como aviso.
  Se puede guardar; cerrar la visita sigue exigiendo todas las lecturas
  (`validateVisitClose`, sin cambios).

### Plantilla

```ts
buildBookTemplate(previousRows | null, pointsVigentes, amarreCode): { pointCode; pointType }[]
```

Con libreta anterior, sus códigos y tipos, con la primera y la última fila
cambiadas al amarre nuevo y sin los puntos que ya no están vigentes. Sin libreta
anterior: amarre (`bm`), los puntos de control vigentes como `intermediate` en
el orden del catálogo, y amarre (`bm`).

### KPIs

Funciones puras en `src/lib/calculations/settlement-summary.ts`, sobre el
resultado de `computeHistory`:

| KPI | Definición |
|---|---|
| Asentamiento máximo | El acumulado de **mayor valor absoluto**, con su signo, entre las lecturas de la visita (un levantamiento también es un hallazgo), con su punto |
| Promedio | Media del acumulado de las lecturas de la visita. En la visita: su diferencia con el promedio de la anterior |
| Mayor movimiento | El parcial de mayor valor absoluto de la visita, con su punto |
| Puntos en alerta | Lecturas con nivel ≥ `caution`, sobre las lecturas de la visita |
| Distorsión angular | El par con la **peor distorsión** (1/X) de la última visita y si supera el límite del lugar. Sustituye al «diferencial máximo» del prototipo |
| Velocidad | La velocidad de mayor valor absoluto de la última visita (mm/mes, mes = 30.4375 d), con su punto. Sustituye a la «velocidad reciente» del prototipo |
| Visitas en alerta | Visitas cuyo peor nivel es ≥ `caution` |
| Visitas | Total, fecha de la lectura base y fecha del último registro |

Con puntos dados de alta a mitad del monitoreo, el promedio mezcla líneas
base. Se acepta y se dice en la ayuda del KPI; no se corrige.

### Escala de tiempo

`src/lib/design/chart-scale.ts` gana `timeScale(fechas, rango)`: una escala
lineal sobre días. Es pura y lleva tests.

## Validación

| Capa | Regla | Efecto |
|---|---|---|
| Captura | Las de la libreta de nivelación (`validateReadingCapture`, `validateRunCapture` con tipo cerrado): lecturas, hilos, distancias, posiciones de BM | Error en la celda; bloquea el guardado |
| Captura | Libreta con lecturas sin **código o cota del amarre** | Error; bloquea |
| Captura | **Primera o última fila distinta del amarre**, o no es `bm` | Error; bloquea |
| Captura | Un punto de control con V− en dos filas | Error; bloquea |
| Captura | Punto no vigente en la libreta; punto vigente ausente | Aviso |
| Cierre | Comprobación aritmética fallida | Bloquea el cierre de la visita |
| Cierre | **Fuera de tolerancia** | **Aviso** en el editor, la vista, el panel y el diálogo de cierre; no bloquea (decisión 5) |
| Cierre | Sin distancias: no hay tolerancia ni compensación | Aviso |
| Estadística | Sin cambios (fases 5 y 12) | No bloquea |

Todo se revalida **en el servidor** al guardar (decisión #10 de la fase 5).

Va en `src/lib/validators/settlement-book.ts` (`validateVisitBook`), con
tests.

## Servidor

### `createVisitAction`

Pasa a recibir `{ date, operator, captureMode, referenceBm, equipo y orden }`.
Valida la fecha como hoy e inserta todo en una sola fila. Devuelve el id; la UI
navega a `/editar`, con `?importar=1` si el modo elegido es importar.

### `saveVisitAction`

El payload gana `captureMode`, `referenceBm` y `book` (filas numéricas).

- **En modo `book`**, el servidor ignora `readings` del payload. Valida la
  libreta, la calcula (`computeVisitBook`), deriva las lecturas
  (`deriveControlElevations`) y sigue el camino de hoy:
  `validateVisitCapture` → `computeHistory`.
- **En modo `direct`**, todo sigue como hoy.

Orden de escritura. Es el actual, con la libreta intercalada; lo imponen los
triggers de vigencia:

1. Purga de las lecturas de puntos que ya no vienen (existente).
2. Cabecera: la de hoy más `capture_mode`, el amarre, `closure_error_mm`,
   `tolerance_mm`, `meets_tolerance` y `total_distance_km`. En `book` estos
   cuatro son derivados; en `direct`, `closure_error_mm` es el tecleado y los
   otros tres van en `null`.
3. **Libreta:** upsert por `(visit_id, reading_order)` con los calculados y
   `point_id`, seguido de la purga de `reading_order >= n`. En `direct` se
   purga la libreta entera: pasar de `book` a `direct` la descarta, con aviso
   previo en el editor.
4. Upsert de lecturas (existente).
5. Propagación a las visitas posteriores abiertas (existente, `visitsToRewrite`).

### Puertas que invalidan la cota derivada

La cota derivada es una caché de la libreta. Esta es la lista completa de lo
que la alimenta, con la puerta que la recalcula en cada caso:

| Entrada | Puerta | Cubierta por |
|---|---|---|
| Filas de la libreta | Guardar la visita | `saveVisitAction` recalcula y propaga |
| Amarre (código o cota) | Guardar la visita | Ídem; es copia, así que el catálogo no la invalida (decisión 6) |
| Orden de precisión | Guardar la visita | Ídem: cambia la tolerancia y, con ella, si se compensa |
| Código de un punto de control | Guardar el punto | `savePointAction` renombra las filas de las visitas abiertas (decisión 20); la cota no cambia |
| Vigencia de un punto | Baja/alta | Los triggers de la fase 11 ya impiden dejar lecturas fuera de vigencia; la derivación las omite |
| Umbrales del lugar | Guardar el lugar | `resyncSiteReadings` (existente); no toca cotas |

### `closeVisitAction`

En modo `book` añade el bloqueo por comprobación aritmética. La tolerancia
solo avisa.

## Superficie

### Panel del lugar — `/projects/[id]/settlement/[siteId]`

- **Encabezado:** nombre del lugar; «Control de asentamientos en N puntos de
  control. Lectura base el …»; leyenda de los tres umbrales de acumulado;
  acciones **+ Nueva visita**, Exportar a Excel y Editar lugar.
- **KPIs (6):** asentamiento máximo, promedio, distorsión angular, velocidad,
  visitas en alerta y visitas.
- **Visitas**, de la más reciente a la más antigua, con filas navegables (clic
  o Enter). Columnas: visita («base» en la 0), fecha, promedio, máximo (con
  punto), amarre (código y cota), mayor Δ (con punto), cierre (mm; marcado si
  está fuera de tolerancia; «—» en `direct` sin valor), alerta
  (`StatusIndicator`) y estado (borrador / calculada / cerrada).
- **Tendencia:** línea del promedio por visita con una banda de mínimo a
  máximo, las líneas de los umbrales y el eje X en fechas. Un clic en una
  visita la abre.
- **Evolución por punto:** marcadores por punto con días desde la base en el
  eje X; los chips resaltan un punto y atenúan los demás. Sustituye a
  `settlement-chart.tsx`. Mantiene las formas de `series-markers`, las marcas
  «(de baja)» / «(alta …)» y la tabla de datos alternativa.
- **Diferenciales y distorsión angular** (existente, sin cambios).

### Vista de la visita — `/projects/[id]/settlement/[siteId]/visits/[visitId]`

- **Encabezado:** «← Volver a <lugar>»; «Visita N» («lectura base» en la 0);
  fecha, amarre, nivelador y equipo; anterior/siguiente por fecha; acciones
  **Ver registro de nivelación** (en `book`), **Editar** (si está abierta) y
  **Cerrar visita**.
- **KPIs (6):** asentamiento máximo, promedio (Δ frente a la anterior), mayor
  movimiento, puntos en alerta (n de m), cierre de nivelación (± tolerancia,
  cumple / no cumple / sin tolerancia) y alerta de la visita junto a su estado.
- **Puntos de control:** punto, cota base (C0 o primera lectura), cota actual,
  acumulado, Δ desde la anterior, velocidad y alerta. Conserva el aviso
  «fuera de tendencia» de la fase 12 y las marcas de baja y alta. Las filas son
  seleccionables.
- **Historial del punto** (panel lateral; debajo en móvil): acumulado,
  velocidad y Δ; una gráfica del historial hasta esta visita con los umbrales;
  y una nota: «le faltan X mm para el umbral de <nivel>» o «superó el umbral
  de alarma».
- **Barras:** acumulado por punto con las líneas de umbral, y Δ desde la
  visita anterior. Un clic en una barra selecciona el punto.
- **Registro de nivelación** (drawer): fecha, nivelador, equipo y amarre; la
  libreta en lectura (est., punto, V+, AI, V−, cota, cota compensada) con las
  filas de puntos de control resaltadas; ΣV+, ΣV−, error de cierre y
  tolerancia. En `direct` no se ofrece.

### Editor de la visita — `…/visits/[visitId]/editar`

- **Cabecera:** los campos de hoy más el **BM de amarre** (`bm-selector` con
  los `reference_points` del proyecto) y el **modo de captura**. Cambiar de
  modo avisa de lo que se descartará al guardar.
- **Modo `book`:**
  - La libreta, con la tabla de nivelación compartida (decisión 17): la
    plantilla precargada si está vacía, sugerencias con los códigos del
    catálogo y el amarre, «Insertar fila debajo» y la nota «punto de control»
    en las filas que lo son.
  - «Importar desde archivo».
  - El resumen de cierre: ΣV+, ΣV−, cierre, tolerancia y los avisos de la
    derivación.
  - Debajo, la **tabla de cotas de los puntos de control** en solo lectura,
    con parcial, acumulado, velocidad, semáforo y tendencia en vivo
    (`readings-table.tsx` actual en modo lectura).
- **Modo `direct`:** como hoy, con la tabla de cotas editable y el error de
  cierre tecleado.
- Guardar y cerrar siguen igual: guardado explícito, aviso de cambios sin
  guardar y el diálogo de cierre, que ahora incluye el cierre de la libreta.

### Nueva visita (modal)

Campos de la decisión 15, con los valores iniciales tomados de la visita
anterior por fecha. El amarre es obligatorio en «digitar»; en «importar» se
puede dejar para que lo traiga el archivo.

### Sistema de diseño

- **`Drawer`** (nuevo): panel lateral derecho con fondo oscurecido, se cierra
  con Esc y devuelve el foco a quien lo abrió. Sale en `/design-system`.
- **`Card`** gana `description`, el subtítulo de la cabecera.
- Si alguna pieza nueva introduce un color, su pareja va a `pairings.ts`. Se
  prefieren los tokens existentes.
- Los chips, el paginador y la fila seleccionable son de la funcionalidad, no
  del sistema de diseño. Si la fase siguiente los reutiliza, se promueven
  entonces.
- `main` sigue en `max-w-5xl`. El panel lateral pasa debajo de la tabla por
  debajo de `lg`.

### Gráficas

SVG propio en `src/components/settlement/charts/`, con `chart-scale.ts` y
`series-markers.ts`:

| Componente | Dónde |
|---|---|
| `trend-chart.tsx` | Panel: promedio, banda, umbrales, clic a visita |
| `points-scatter.tsx` | Panel: marcadores por punto, chips |
| `point-history-chart.tsx` | Vista: historial del punto con umbrales |
| `point-bars-chart.tsx` | Vista: acumulado y Δ por punto, con umbrales opcionales |

Todas se leen sin color (formas, etiquetas y la tabla alternativa) y siguen la
lección de la fase 13: el `viewBox` se prueba a 390 px.

### Excel

`settlement-workbook.ts` gana la hoja **«Libretas»**: por cada visita en
`book`, su cabecera (visita, fecha, amarre, cierre, tolerancia) y sus filas
(punto, tipo, V+, dist., AI, V−, dist., cota y cota compensada). Las visitas en
`direct` no aparecen. «Datos Crudos» añade el modo, el amarre y el cierre de
cada visita.

## Seed y demo

`src/lib/demo/libreta-asentamientos.ts`, puro y determinista, genera la
libreta de cada visita **hacia atrás**. A partir de las cotas de la serie, el
amarre y unas distancias, construye las lecturas, añade un error de cierre
pequeño dentro de tolerancia y ajusta las intermedias para que la **cota
compensada** reproduzca la serie con la redondez del almacenamiento.

- **Seed:** un lugar nuevo, **«Torre Alameda»**, con 8 puntos de control, dos
  BMs de amarre en `reference_points` alternados entre visitas, dos armadas con
  punto de cambio y unas 12 visitas. Incluye una visita fuera de tolerancia
  para mostrar el aviso. «Edificio Torre Central» queda en `direct`, sin
  cambios.
- **Demo** (`crear-proyecto-demo.ts`): su lugar pasa a `book` con el mismo
  generador, y el proyecto demo gana sus dos BMs de amarre.
- **Arranque en frío:** un proyecto sin `reference_points` permite teclear el
  amarre (la opción «Otro» de `bm-selector`). Se verifica en pantalla.

## Archivos

| Archivo | Qué cambia |
|---|---|
| `supabase/migrations/<ts>_libreta_visita.sql` | Nuevo (modelo) |
| `src/types/database.ts` | Regenerado |
| `src/types/settlement.ts` | `CaptureMode`, filas de libreta, payloads |
| `src/lib/calculations/settlement-book.ts` (+ test) | Nuevo: libreta, derivación, plantilla |
| `src/lib/calculations/settlement-summary.ts` (+ test) | Nuevo: KPIs |
| `src/lib/validators/settlement-book.ts` (+ test) | Nuevo |
| `src/lib/validators/settlement.ts` | `validateVisitClose` con la comprobación aritmética |
| `src/lib/design/chart-scale.ts` (+ test) | `timeScale` |
| `src/app/(app)/projects/[id]/settlement/[siteId]/actions.ts` | Crear y guardar con libreta |
| `src/app/(app)/projects/[id]/sites/[siteId]/point-actions.ts` | Renombrado en libretas abiertas |
| `…/settlement/[siteId]/page.tsx` | Panel nuevo |
| `…/visits/[visitId]/page.tsx` | Vista nueva |
| `…/visits/[visitId]/editar/page.tsx` | Nuevo: el editor |
| `src/components/settlement/` | Nuevos: `new-visit-dialog`, `site-kpis`, `visits-table`, `visit-view`, `control-points-table`, `point-history-panel`, `book-drawer`, `visit-book-editor`, `visit-import-dialog`, `charts/*`. Cambian `visit-editor`, `readings-table` y `close-visit-dialog`. Salen `visits-list`, `analysis-panel` y `settlement-chart` |
| `src/components/leveling/readings-table.tsx` | Props opcionales (decisión 17) |
| `src/components/leveling/import-dialog.tsx` | Exporta la previsualización para reutilizarla |
| `src/components/design-system/drawer.tsx`, `card.tsx`, `index.ts` | `Drawer`, `description` |
| `src/app/design-system/page.tsx` | Muestra el `Drawer` |
| `src/lib/export/settlement-workbook.ts` (+ test) | Hoja «Libretas» |
| `src/lib/demo/libreta-asentamientos.ts` (+ test), `crear-proyecto-demo.ts`, `insertar-asentamiento.ts`, `scripts/seed.mjs` | Seed y demo |
| `PRD-TopoField.md` | Enmiendas |
| `docs/manual/README.md`, `src/app/(app)/manual/*`, `docs/manual/capturas.mjs` | § 7 en las dos copias y capturas |
| `docs/testing/manual-e2e-asentamientos.md` | Guion |
| `docs/tecnica/README.md`, `docs/pendientes.md`, `method.md`, `prds/README.md` | Como en cada fase |

## Pruebas

**Suite existente:** 687 tests.

**Valores esperados** para la libreta de forma prototipo (hallazgo 2), con
amarre a 100.0000, las intermedias en la armada 1 (40 m atrás) y en la 2
(45 m atrás), el punto de cambio a 42 m, el cierre a 38 m y tercer orden:

| Qué | Valor |
|---|---|
| ΣV+ · ΣV− | 2.9350 · 2.9337 |
| Cierre · tolerancia | +1.30 mm · 4.87 mm, cumple |
| PC-01 (armada 1) | calculada 100.6102 · compensada 100.6099 |
| PC-05 (armada 2) | calculada 100.4540 · compensada 100.4530 |
| Sin distancias | cierre +1.30 mm, tolerancia `null`, cotas sin compensar |

**Nuevas, como mínimo:**

| Qué | Casos |
|---|---|
| `computeVisitBook` + `deriveControlElevations` | La tabla de arriba; fuera de tolerancia: cotas calculadas y sin error; sin distancias; punto de control como punto de cambio; duplicado → error; punto no vigente → aviso y sin lectura; punto vigente ausente → aviso; código ajeno → sin aviso; redondeo a 4 decimales |
| `buildBookTemplate` | Desde la libreta anterior con amarre nuevo; desde el catálogo; puntos de baja fuera; alta incluida desde su fecha |
| `validateVisitBook` | Amarre ausente; primera o última fila distinta del amarre; errores de captura de nivelación que se propagan |
| `validateVisitClose` | Comprobación aritmética fallida en `book` → bloquea; fuera de tolerancia → no bloquea |
| KPIs | Cada definición, con levantamiento, visita base, lugar sin visitas y un alta |
| `timeScale` | Fechas irregulares, un solo día, orden |
| Generador del seed | Su libreta pasa la validación, cumple la tolerancia (salvo la visita prevista) y la derivación reproduce la serie a 0.1 mm |
| Excel | Hoja «Libretas» con las visitas `book` y sin las `direct` |
| Tabla compartida | Nivelación sin las props nuevas se renderiza igual (sin columna de nota ni botón de insertar) |

**En pantalla, antes de cerrar:**

1. Seed: el panel de Torre Alameda con los KPIs, la tabla y las dos gráficas;
   abrir una visita desde la tabla y desde la tendencia.
2. La vista: seleccionar un punto, el historial y la nota; anterior/siguiente;
   el registro de nivelación.
3. Crear una visita **digitando**: plantilla, sugerencias, insertar fila,
   guardar y ver las cotas derivadas en la vista.
4. Crear una visita **importando** la plantilla CSV y el crudo `.L`.
5. Una libreta fuera de tolerancia: el aviso en los cuatro sitios; cerrar.
6. Una visita en `direct` (Torre Central): editar y cerrar como hoy.
7. Renombrar un punto con libretas abiertas y guardar una de ellas: la cota
   se conserva.
8. Proyecto nuevo sin BMs de referencia: amarre tecleado (arranque en frío).
9. A 390 px: el panel, la vista, el drawer y el editor.
10. Excel con la hoja «Libretas»; la ruta `/manual`.

**Contra la base:** tras guardar una libreta, `settlement_readings.elevation`
es igual a la cota compensada de su fila redondeada. Tras editar una visita
intermedia, las posteriores abiertas se reescriben. Una fila de libreta de una
visita cerrada rechaza la escritura por REST.

## Criterios de aceptación

1. Una visita nueva nace en modo libreta; las existentes siguen en cotas
   directas y funcionan como hoy.
2. La libreta se digita en vivo con plantilla, sugerencias e inserción de
   filas, y se importa desde el `.L` y la plantilla CSV.
3. Las cotas de los puntos de control salen de la libreta, compensadas cuando
   cumple la tolerancia, y el servidor las recalcula y propaga al guardar.
4. La visita guarda su BM de amarre (copia de código y cota), su cierre, su
   tolerancia y su distancia.
5. Fuera de tolerancia solo avisa, en el editor, la vista, el panel y el cierre;
   la comprobación aritmética fallida bloquea el cierre.
6. El formulario de nueva visita toma el equipo y el orden de la visita
   anterior.
7. El panel y la vista siguen el layout del prototipo con los tokens de la app,
   el semáforo de 4 niveles y los KPIs definidos en este PRD.
8. Las gráficas usan el tiempo en el eje X, se leen sin color y funcionan a
   390 px.
9. La baja y el alta de puntos y la lectura fuera de tendencia se ven en la
   nueva UI.
10. Renombrar un punto no borra su cota en las visitas abiertas.
11. RLS y triggers: la libreta de una visita cerrada, o de un lugar cerrado, no
    se escribe ni por REST.
12. La tabla de captura de nivelación se comporta igual que antes en el módulo
    de nivelación.
13. Excel con la hoja «Libretas».
14. Seed y demo con un lugar en modo libreta.
15. `npm run typecheck`, `npm run lint`, `npm test` y `npm run build` pasan
    limpios, con los tests nuevos sumados a los 687.
16. Manual en sus dos copias, en el mismo commit, con capturas regeneradas;
    guion de pruebas; doc técnica con la tabla de pruebas regenerada desde la
    ejecución y la § 11 revisada entrada por entrada.

## Enmiendas al PRD principal

- **§ 3.2:** columnas nuevas de `settlement_visits` y la tabla
  `settlement_book_readings`.
- **§ 4.5:** «Tabla de lecturas por visita: columnas punto, cota medida» pasa
  a ser la libreta con cotas derivadas, más el modo directo. Se añaden las
  pantallas de vista y editor y el nuevo panel.
- **§ 5.2:** fila nueva: «Asentamiento, libreta de la visita: error de cierre
  mayor que la tolerancia → aviso, no bloquea; comprobación aritmética
  fallida → bloquea el cierre».

## Fuera de alcance

- **Identidad visual del prototipo** (Barlow, el amarillo «mira», el modo
  oscuro). Va a `pendientes.md`.
- **Enlace entre dos BMs** e **ida y vuelta** en la visita (decisiones 7 y 9).
- **Coma decimal** en las celdas de captura (`type="number"`). Va a
  `pendientes.md`.
- **Informe imprimible**: no cambia (decisión 13).
- **Estado «rechazada»** de la visita (decisión 5).
- **CSV simple `punto,cota`** para el modo directo: la importación es de
  libretas, como en la fase 16.
- **Borrador local** en el navegador y modo offline.
- **Estabilidad del BM de amarre** (comparar su cota entre visitas): es
  análisis, no captura.

## Riesgos

- **La cota derivada es una caché de la libreta.** Es la lección más cara de
  la fase 5. Mitigación: la tabla de puertas de «Servidor», escrita antes de
  implementar, y la comprobación contra la base.
- **Tamaño.** Es la fase más grande del proyecto. Mitigación: el orden de
  diferimiento de la decisión 1 y las tareas en orden de dependencia.
- **Regresiones de las fases 11 y 12** al rehacer tablas y gráficas.
  Mitigación: el criterio 9 y los pasos 1, 2 y 6 en pantalla.
- **La tabla de nivelación compartida.** Un cambio para la visita puede
  alterar nivelación. Mitigación: props opcionales y el criterio 12.
- **`ReadingInput` existe en `types/leveling.ts` y en `types/settlement.ts`.**
  Los archivos que usan los dos renombran uno al importar.
- **El seed hacia atrás** puede no reproducir la serie por redondeo.
  Mitigación: su test exige 0.1 mm. Si no se alcanza, se ajusta el generador,
  no la tolerancia del test.
- **Arranque en frío**: proyecto sin BMs de referencia, lugar sin visitas y
  visita sin libreta. Se prueban en pantalla (paso 8).

## Tareas (en orden)

0. **Apertura:** este PRD, el prototipo en `docs/prototipos/`, las enmiendas
   al PRD principal, los estados en `method.md` y `prds/README.md`, y
   `pendientes.md`. Commit `docs:`.
1. Migración, tipos regenerados y `types/settlement.ts`.
2. `settlement-book.ts`: libreta, derivación y plantilla, con tests.
3. `validators/settlement-book.ts` y el cierre en `validators/settlement.ts`,
   con tests.
4. `settlement-summary.ts` (KPIs) y `timeScale`, con tests.
5. Server Actions: crear, guardar con libreta y renombrado de puntos.
6. Tabla de nivelación compartida: props opcionales.
7. Editor de la visita (`/editar`): cabecera, modo, amarre, libreta, resumen y
   cotas derivadas.
8. Importación en la visita.
9. Modal de nueva visita.
10. `Drawer` y `Card.description`, con `/design-system`.
11. Gráficas SVG.
12. Panel del lugar.
13. Vista de la visita con el drawer del registro.
14. Excel: hoja «Libretas».
15. Generador de libretas, seed y demo.
16. Manual (dos copias), capturas, guion, doc técnica.
17. Verificación en pantalla y contra la base; revisión de conjunto; cierre.
