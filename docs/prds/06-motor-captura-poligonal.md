# PRD-de-fase 7 — Motor y captura de poligonales

**Estado:** en curso
**Fecha de apertura:** 2026-09-16
**Fecha de cierre:** —

## Propósito

Corregir el motor de cálculo de poligonales para que corresponda a **cómo se
mide en campo** y a **cómo se ve una cartera real**, y llevar esa fidelidad
hasta la captura.

La Fase 3 entregó un motor correcto en su aritmética de compensación pero
apoyado en una convención de azimut que no es la del instrumento. El contraste
con tres carteras reales lo dejó en evidencia: la app puede producir coordenadas
espejadas mientras informa que la poligonal cierra a 1:7036. Un error que no se
ve en ningún indicador es exactamente el que un sistema de trazabilidad no puede
permitirse.

Esta fase además introduce la captura con lecturas múltiples por ángulo, que es
práctica estándar en trabajo de precisión y que la Fase 9 necesitará para
derivar los pesos del ajuste por mínimos cuadrados.

## Fuentes

- `docs/carteras/poligonales.xlsx` — cartera real, 6 vértices, orientada sobre
  el punto TT4. Tres hojas (`BRUJULA`, `TRANSITO`, `CRANDALL`) sobre los mismos
  datos de campo.
- `docs/carteras/Ajuste_Poligonal_Minimos_Cuadrados.xlsx` — cartera U. Distrital
  Sede Vivero, 4-nov-2021, 5 vértices, orientada sobre `14_IS1`. En esta fase se
  usa solo como segundo juego de datos; su ajuste llega en la Fase 9.
- `PRD-TopoField.md` — `§3.2` (tablas), `§4.3` (editor), `§4.6` (cierre),
  `§5.4` (tolerancias), `§6` (algoritmos).
- `docs/marco-teorico/mt-poligonales.docx` — marco teórico de la Fase 3.

## Hallazgos que originan la fase

Verificados numéricamente contra las carteras, no inferidos:

1. **La convención de azimut no es la del instrumento.** En campo se pone cero
   en la vista atrás y se gira a la derecha, así que la lectura es siempre un
   ángulo a la derecha y el azimut avanza `Az(i) = Az(i-1) + 180 + a(i)`. El
   motor actual usa `Az(i) = Az(i-1) + 180 - a(i)`. Producen polígonos espejo.
   Alimentando la cartera real al motor actual, el primer lado coincide a
   0.2 mm y el segundo vértice ya se aparta 19 m en el Este — con un cierre
   reportado de 1:7036 contra el 1:7000 de la hoja. El error es invisible en
   todos los indicadores que hoy mostramos.

2. **Interior/exterior solo decide la suma teórica.** Con ángulos a la derecha
   no hay ambigüedad de signo: si el polígono se recorre en antihorario las
   lecturas caen como interiores y suman `(n-2)·180`; en horario caen como
   exteriores y suman `(n+2)·180`. La cartera confirma el caso interior:
   720.0033 sobre 720.

3. **Una cartera real tiene n+1 ángulos para n vértices.** Ver el croquis de
   campo en [`docs/carteras/croquis-amarre-y-cierre.jpg`](../carteras/croquis-amarre-y-cierre.jpg):
   en el vértice de arranque se miden dos ángulos contra la misma visual de
   amarre — en rojo el de apertura (del punto conocido al primer lado) y en azul
   el de cierre (del último lado de vuelta al punto conocido). Las dos figuras
   son los dos casos: arriba el polígono se recorre en un sentido y las lecturas
   caen como exteriores, abajo en el contrario y caen como interiores.

4. **Hay dos esquemas de cierre y el modelo debe cubrir ambos.** La cartera TT4
   cierra **contra el amarre**: el último ángulo en el vértice de arranque va del
   último lado de vuelta al punto conocido (299°18'51"), el ángulo del vértice
   sale de `orientación + cierre - 360` y la suma teórica es `(n-2)·180 + 360`
   sobre n+1 ángulos. La cartera Vivero cierra **contra el primer lado**: su
   último ángulo (81°33'47") es directamente el ángulo interior del vértice de
   arranque, la suma teórica es `(n-2)·180` sobre n ángulos y el de orientación
   solo fija el datum; el chequeo es la discrepancia del azimut del primer lado,
   que la hoja calcula en `G22` y da 4". Se cubren ambos **haciendo opcional la
   fila de cierre**, sin enum adicional. El vértice de
   arranque se mide en dos tiempos contra un punto de referencia externo
   (211°15'07" de TT4 a D1 al abrir, 299°18'51" de D5 a TT4 al cerrar). La suma
   teórica pasa a `(n-2)·180 + 360` = 1080, el error angular de 12" se reparte
   entre 7 ángulos (1.714286" cada uno) y el ángulo de cierre ofrece un control
   de reorientación que hoy no existe.

5. **Bowditch y Tránsito de la app ya son correctos.** Reimplementando la hoja
   `BRUJULA` desde cero con la convención del instrumento, la diferencia contra
   el Excel es de 0.000 mm en los 6 vértices. `brújula` y Bowditch son el mismo
   método (compass rule); la hoja `TRANSITO` es la corrección proporcional a
   `|proyección|`, idéntica a la nuestra.

6. **El Crandall de la app es correcto y el del Excel no.** La hoja tiene tres
   errores: usa `(ΔN+ΔE)/d` donde las ecuaciones normales piden el producto
   `ΔN·ΔE/d`; usa `Σ(LDᵢ²)` donde el determinante pide `(Σ LD)²`; y tiene los
   paréntesis mal puestos en los multiplicadores, de modo que la división aplica
   solo al segundo término del numerador. Consecuencia medible: la hoja **no
   cierra** (vuelve al punto de arranque con 0.22 mm de residuo en N y 0.09 mm
   en E) y se aparta hasta 2.6 mm del Crandall correcto, que cierra a 1e-15.
   **No se ajusta nuestro Crandall al Excel.**

## Alcance

### Dentro

1. Convención de ángulo a la derecha como única convención de cálculo.
2. `angle_type` extendido a `interior | exterior` para elegir la suma teórica.
3. Orientación sobre punto de referencia externo: punto, azimut de vista atrás,
   ángulo de orientación y ángulo de cierre, con estaciones que espejan la
   cartera (n+1 filas).
4. N lecturas por ángulo, con mínimo configurable por proceso (3 por defecto),
   promedio automático y dispersión como control de calidad.
5. Azimut derivado en `reassign-coordinates-dialog`: al reasignar las
   coordenadas reales del arranque y del amarre, el azimut se recalcula desde
   las coordenadas en vez de reteclearse. Solo para procesos no cerrados.
6. Reseed con las dos carteras reales y pruebas contra los valores del Excel.

### Fuera (diferido)

- **Canvas de visualización** (original vs ajustada, grilla, zoom): Fase 8.
- **Ajuste por mínimos cuadrados** como cuarto método: Fase 9. La cartera Vivero
  se siembra en esta fase como poligonal normal, calculada con los tres métodos
  actuales.
- **Georreferenciación en cualquier momento**, incluidos procesos cerrados:
  Fase 10. Un levantamiento puede arrancar en sistema local arbitrario (1000,
  2000) y recibir coordenadas reales meses después, ya cerrado. Mecanismo
  acordado para esa fase: **recalcular y guardar**, con una excepción estrecha
  en el trigger de inmutabilidad — solo las columnas de coordenadas, solo por la
  acción de georreferenciar, con fecha y autor, y conservando las coordenadas
  locales en columnas propias para no perder el rastro del sistema original.
  Lo que habilita la excepción: una rotación más traslación deja invariantes el
  error angular, el error lineal, la precisión relativa y el perímetro, así que
  el datum no altera nada de lo que el cierre certifica.
- Nivelación y asentamientos: sus convenciones no se tocan.

## Decisiones cerradas

| # | Decisión | Alternativa descartada |
|---|---|---|
| 1 | Ángulo a la derecha siempre; `interior/exterior` solo fija la suma teórica | Campo `sentido_recorrido` aparte — innecesario si el instrumento siempre gira a la derecha |
| 2 | Extender `angle_type` a `interior/exterior/deflection/azimuth` | Columna nueva junto a `angle_type`; dos campos que se leen casi igual y se confunden |
| 3 | Las estaciones espejan la cartera: n+1 filas, la primera y la última son el punto de arranque | n estaciones + ángulos de orientación y cierre en el proceso; la pantalla dejaría de parecerse al papel |
| 4 | Tabla propia `polygonal_angle_readings` | Columna JSONB en `polygonal_stations`; rompe la regla de ángulos como 3 campos y deja la validación solo en la app |
| 5 | Reset de datos y reseed | Columna `calc_version` con las cerradas congeladas; hoy solo hay datos de seed y demo, así que no hay historia que preservar |
| 6 | Los `.xlsx` se commitean en `docs/carteras/` como fuente de los tests | Datos académicos de la Universidad Distrital, sin información de cliente |
| 7 | El azimut de amarre se **calcula** desde las coordenadas de un `reference_points` elegido del catálogo, con los campos DMS como respaldo manual | Teclear siempre el azimut en DMS; es un derivado de datos que el proyecto ya tiene. Recoge la decisión 6 de la Fase 3, que lo dejó como «mejora futura» |
| 8 | `angle_type` se elige explícitamente en el formulario, sin preselección | Un default; interior y exterior ocurren ambos en campo según hacia dónde se recorra el polígono, y adivinarlo reintroduce el fallo silencioso que esta fase corrige |
| 9 | La georreferenciación completa se difiere a la Fase 10; en esta fase solo se deriva el azimut al reasignar coordenadas de un proceso no cerrado | Meterla entera llevaría la fase de 12 a ~17 tareas y mezclaría el arreglo de un bug real con funcionalidad nueva de peso |

## Modelo de datos

Migración única `<timestamp>_polygonal_right_hand_angles.sql`, con el sello de
tiempo que genere `npx supabase migration new`.

**`angle_type` es hoy un campo muerto.** Se escribe derivado del tipo de
poligonal (`payload.type === "open_controlled" ? "deflection" : "internal"`) en
`polygonal/new/actions.ts:68` y `polygonal/[pid]/actions.ts:183`, el usuario
nunca lo elige y `computePolygonal` nunca lo lee — el motor ramifica sobre
`input.type`. El valor `'azimuth'` no se escribe en ningún sitio. Esta fase le
da un trabajo real, así que los dos sitios que lo derivan pasan a tomar la
elección del usuario, y los literales `"internal"` de `src/lib/demo/fixtures.ts`
y `scripts/seed.mjs` se actualizan con el reseed.

### `polygonal_processes`

```sql
-- 'internal' pasa a llamarse 'interior' y entra 'exterior'
angle_type text not null default 'interior'
  check (angle_type in ('interior','exterior','deflection','azimuth'))

reference_point_id   uuid references public.reference_points(id)
reference_point_code text            -- respaldo: amarre fuera del catálogo (TT4, 14_IS1)
angle_readings_min   int not null default 3
```

El amarre se resuelve en dos modos. Con `reference_point_id`, el azimut se
calcula desde las coordenadas del punto y los campos DMS quedan de solo lectura.
Sin él, se teclea `reference_point_code` y el azimut en DMS, para amarres que no
estén en el catálogo del proyecto.

`angle_type` conserva un default en la base por la restricción `not null`, pero
el formulario **no preselecciona**: interior y exterior ocurren ambos según el
sentido en que se recorra el polígono, y elegir por el usuario reintroduce
exactamente el fallo silencioso que esta fase corrige.

Los `start_azimuth_deg/min/sec` **cambian de significado**: pasan de «azimut del
primer lado» a «azimut del punto de arranque hacia la referencia» (la vista
atrás), que es el dato que se lleva de campo. No se agrega columna; se
redocumenta el contrato. Cuando `reference_point_code` es nulo conservan el
significado anterior.

### `polygonal_stations`

No cambia de forma. `horizontal_distance` ya es nullable, que es lo que necesita
la última fila. Lo que cambia es el contrato: `angle_deg/min/sec` pasan a ser el
**promedio de las lecturas**, calculado por la app, no capturado a mano.

### `polygonal_angle_readings` (nueva)

```sql
create table public.polygonal_angle_readings (
  id            uuid primary key default gen_random_uuid(),
  station_id    uuid not null references public.polygonal_stations(id) on delete cascade,
  reading_order int not null,
  angle_deg     int not null,
  angle_min     int not null,
  angle_sec     decimal(5,1) not null,
  created_at    timestamptz not null default now(),
  unique (station_id, reading_order)
);
```

Con RLS por dueño del proyecto (join a `polygonal_stations` →
`polygonal_processes` → `projects`) y trigger de inmutabilidad equivalente al de
`polygonal_stations`. Al no haber backfill, el trigger se crea junto con la
tabla.

## Algoritmos (`src/lib/calculations/polygonal.ts`)

### Cadena de azimuts

```
Az(0) = normalizar(azimut_referencia + a(0))     ← ángulo de orientación
Az(i) = normalizar(Az(i-1) + 180 + a(i))         ← todos los demás
```

Sin punto de referencia, `Az(0) = startAzimuth` y la cadena arranca en `i = 1`,
como hoy.

### Azimut de amarre desde coordenadas (`angles.ts`)

```
azimutAmarre = normalizar( atan2(E_ref - E_arranque, N_ref - N_arranque) )
```

Verificado contra la cartera real: con el arranque V10 en
`100135.666 / 101440.525` y TT4 en `100142.809 / 101436.5` (coordenadas que la
propia hoja `BRUJULA` trae en su bloque X23:Z25), da 330°35'57.23", idéntico al
azimut tecleado en la hoja, con 0.0 segundos de diferencia.

Va en `angles.ts` y no en `polygonal.ts`: es geometría de coordenadas, sin
relación con el tipo de poligonal, y la van a querer nivelación y asentamientos.

### Suma teórica y reparto

Con `n = estaciones - 1` (vértices) cuando hay orientación:

| `angle_type` | con orientación | sin orientación |
|---|---|---|
| `interior` | `(n-2)·180 + 360` | `(n-2)·180` |
| `exterior` | `(n+2)·180 + 360` | `(n+2)·180` |

La columna «con orientación» aplica cuando existe **fila de cierre** (la cartera
cierra contra el amarre). Sin fila de cierre, el último ángulo capturado es el
del vértice de arranque, la suma va sobre los n ángulos y el de orientación solo
fija el datum — es el esquema de la cartera Vivero.

El caso `exterior` no está cubierto por ninguna cartera real de las dos
analizadas (ambas son interiores). Se deriva del mismo razonamiento que el caso
interior, verificado, y se cubre con un test sintético: tomar la cartera real y
reemplazar cada ángulo por su complemento a 360° debe dar las mismas
coordenadas declarando `exterior`.

El error angular se reparte **por igual** entre todos los ángulos medidos, y
`angularTolerance(order, m)` recibe `m` = número de ángulos medidos (`n+1` con
orientación), no el número de vértices: la tolerancia es `K·√m` y `m` es lo que
se midió.

### Control de reorientación

Aplicado el ángulo de cierre al último azimut se debe recuperar el azimut de
referencia. La diferencia se expone como verificación nueva en el resultado.
No bloquea el cálculo; alimenta el panel de resultados.

### Compensación

`correctDeltas` no se toca. Bowditch, Tránsito y Crandall quedan como están.

## Validación (`src/lib/validators/polygonal.ts`)

- **Mínimo de lecturas:** una estación con menos de `angle_readings_min`
  lecturas queda incompleta y no entra al cálculo.
- **Punto de amarre sin coordenadas:** `reference_points.north` y `east` son
  nullable. Un punto sin ambas coordenadas no puede usarse como amarre; el
  selector lo excluye y la Server Action lo rechaza.
- **Dispersión entre lecturas:** se calcula `máx - mín` por ángulo y se avisa
  cuando supera la tolerancia angular del orden del proyecto. Aviso, no bloqueo
  — misma política que el resto del editor.

## Componentes

- `polygonal-config-fields.tsx`: selector interior/exterior sin preselección;
  selector de punto de amarre desde el catálogo del proyecto (solo los que
  tienen N y E), con el azimut calculado mostrado en DMS de solo lectura y un
  modo manual para amarres fuera del catálogo; mínimo de lecturas.
- `stations-table.tsx`: cada celda de ángulo se expande a N lecturas en DMS y
  muestra promedio y dispersión. Primera y última fila son el mismo punto de
  arranque; la última sin celda de distancia.
- `results-panel.tsx`: suma teórica según tipo de ángulo, reparto sobre `n+1`,
  y el control de reorientación.

## Seed y pruebas

- `polygonal.test.ts`: las hojas `BRUJULA` y `TRANSITO` reproducidas con
  tolerancia de 0.1 mm en los 6 vértices; Crandall verificado por **cierre a
  cero**, con un test que documenta que la hoja del Excel no cierra.
- Cartera Vivero como segundo juego de datos, con su control de reorientación.
- `scripts/seed.mjs`: ambas carteras sembradas, sustituyendo los datos actuales.
- `src/lib/demo/fixtures.ts`: el proyecto demo pasa a la convención nueva.

## Criterios de aceptación

| | Criterio |
|---|---|
| a | El motor reproduce `BRUJULA` con error < 0.1 mm en los 6 vértices |
| b | El motor reproduce `TRANSITO` con error < 0.1 mm en los 6 vértices |
| c | Crandall cierra a cero; un test documenta el residuo de 0.22 mm de la hoja |
| d | La suma teórica responde a `angle_type` y a la presencia de orientación |
| e | El error angular se reparte entre `n+1` ángulos cuando hay orientación |
| f | El control de reorientación recupera el azimut de referencia |
| f2 | Test sintético: la cartera con ángulos complementarios y `exterior` da las mismas coordenadas |
| g | Una poligonal cerrada sin punto de referencia sigue calculando como antes |
| h | La captura exige el mínimo de lecturas y promedia automáticamente |
| i | La dispersión se muestra y avisa al superar la tolerancia del orden |
| j | La tabla de estaciones espeja la cartera: n+1 filas, la última sin distancia |
| k | Las lecturas de un proceso cerrado son inmutables (verificado vía REST) |
| l | `npm run typecheck`, `npm run lint` y `npm test` pasan |
| m | El seed siembra las dos carteras y la app las calcula correctamente |
| n | Elegido TT4 del catálogo, el azimut calculado da 330°35'57.23" |
| o | El selector de amarre excluye los puntos sin coordenadas y la acción los rechaza |
| p | El formulario exige elegir `angle_type` explícitamente, sin preselección |
| q | Reasignar coordenadas del arranque y del amarre recalcula el azimut y recoordena las estaciones manteniendo ángulos, distancias y error de cierre |

## Riesgos conocidos

- **El cambio de significado de `start_azimuth_*` es silencioso.** Nada en el
  tipo lo delata. Mitigación: el reset de datos elimina las filas con el
  significado viejo, y el campo se documenta en `types/polygonal.ts` y en la
  doc técnica.
- **`n+1` filas rompe el supuesto de que `station_order` es 1:1 con vértices.**
  Afecta cálculo, tabla y export. Mitigación: derivar siempre el número de
  vértices del contrato del cálculo, nunca de `stations.length` directamente,
  y cubrirlo con tests del export.
- **Un punto de amarre puede editarse después de calcular.** El CRUD de
  `reference_points` ya existe y nada impide mover un punto ya usado como
  amarre, lo que dejaría el azimut calculado desfasado del que se usó. En esta
  fase se persiste el azimut resuelto junto al proceso, de modo que el cálculo
  no dependa de leer el catálogo otra vez.
- **El reseed borra las capturas del manual.** Hay que regenerar
  `public/manual/` con `node docs/manual/capturas.mjs` al cerrar la fase.

## Tareas (en orden)

1. Migración: `angle_type` extendido, campos de referencia, tabla de lecturas
   con RLS y trigger. Regenerar `src/types/database.ts`.
2. Tipos de dominio en `src/types/polygonal.ts` (literales, etiquetas, contrato
   de entrada con orientación y lecturas).
3. `polygonal.ts`: cadena de azimuts, suma teórica, reparto, control de
   reorientación. Tests contra las dos carteras primero (TDD).
4. `validators/polygonal.ts`: mínimo de lecturas y dispersión.
5. Queries y Server Actions: persistencia de lecturas y promedio.
6. `angles.ts`: azimut desde coordenadas + tests contra la cartera real.
7. `polygonal-config-fields`: tipo de ángulo sin preselección, selector de
   amarre desde el catálogo con azimut calculado, mínimo de lecturas.
8. `reassign-coordinates-dialog`: azimut derivado de las coordenadas del
   arranque y del amarre, en lugar de entrada manual en DMS.
9. `stations-table`: celda de ángulo con N lecturas, promedio y dispersión.
10. `results-panel`: suma teórica, reparto y control de reorientación.
11. Export: revisar que `n+1` filas no rompan el workbook.
12. Seed y fixtures con las dos carteras.
13. Verificación end-to-end (criterios a-q). Regenerar capturas. Cierre de fase.

## Anti-alcance explícito

No se implementa: el canvas de visualización (Fase 8); el ajuste por mínimos
cuadrados ni su cuarto valor en `correction_method` (Fase 9); la
georreferenciación de procesos cerrados, la excepción en el trigger de
inmutabilidad ni las columnas de coordenadas locales (Fase 10); cambios en
nivelación o asentamientos; `calc_version` ni ninguna preservación de datos
calculados con la convención anterior. No se refactoriza `correctDeltas`: los
tres métodos de compensación quedan como están.
