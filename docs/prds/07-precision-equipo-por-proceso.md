# PRD-de-fase 8 — Precisión y equipo por proceso

**Estado:** cerrada
**Fecha de apertura:** 2026-09-17
**Fecha de cierre:** 2026-09-18

> **Nota de renumeración (2026-09-22).** Este documento está cerrado y su texto
> no se modifica. Las fases que menciona por número se desplazaron al insertarse
> las fases 9 a 12 (nivelación y asentamientos): **canvas de poligonal** es
> ahora la 13, **ajuste por mínimos cuadrados** la 14 y **georreferenciación**
> la 15. Léanse así las referencias de más abajo. Ver la tabla de
> [`method.md`](../method.md).

## Propósito

Mover el orden de precisión y los datos del equipo de `projects` a cada
proceso, con los campos que su tipo de instrumento exige, y cerrar el agujero
de trazabilidad que el modelo actual deja abierto.

El disparador fue una observación de campo: el formulario de proyecto pide
precisión y equipo, pero eso se decide al levantar, no al abrir el expediente.
Un mismo proyecto puede tener una poligonal de tercer orden y una red de
control de primero, medidas con instrumentos distintos y en fechas distintas.

## Hallazgos que originan la fase

Verificados sobre el código, no inferidos:

1. **Un informe emitido puede cambiar de contenido sin que nadie toque el
   proceso.** `reports` guarda solo `included_processes` con ids; la página de
   impresión (`reports/[reportId]/print/page.tsx:195,205-212`) lee
   `project.precision_order` y `project.equipment_*` **en vivo**. Editar el
   equipo del proyecto reescribe todos los informes ya generados, incluidos los
   de procesos cerrados. En una aplicación cuyo valor es la trazabilidad del
   cierre, es un agujero, no una imprecisión de modelo.

2. **El modelo de equipo actual es el de una estación total.** `projects` tiene
   `angular_precision_seconds` y `linear_precision` (`"2+2ppm"`): campos de
   estación total. Por eso nivelación y asentamientos nunca encajaron — a un
   nivel automático no se le pregunta la precisión angular. La precisión es una
   propiedad **del equipo**, y el tipo de equipo cambia con el módulo.

3. **`settlement_visits` ya resolvió la ubicación, no la estructura.** Tiene
   `equipment` y `operator` **por visita** desde la Fase 5, como texto libre.
   Entre una visita y la siguiente pueden pasar meses y cambiar el instrumento,
   y el modelo ya lo contempla. Lo que le falta es estructura.

4. **La precisión del instrumento nunca se contrasta con el orden exigido.** Un
   nivel de obra de 5 mm/km no puede entregar primer orden, cuya tolerancia es
   `3·√D` mm: su desviación típica supera el coeficiente entero. Hoy nada lo
   advierte, y el topógrafo no tiene dónde ver que el equipo declarado no da
   para el orden declarado.

   **Por qué la comparación es `σ` contra `K` y no algo más fino:** la
   tolerancia escala como `K·√D` (o `K·√n` en poligonal) y la desviación del
   instrumento escala igual, como `σ·√D`. El factor se cancela, así que el
   contraste honesto es directo entre los dos coeficientes. Un umbral con margen
   —«avisa si σ pasa de la mitad de K»— sería un criterio estadístico inventado,
   y haría saltar el aviso en el emparejamiento correcto de 1″ con primer orden.

## Fuentes

- **ISO 17123-2** — desviación típica de niveles, en mm por km de doble
  nivelación. Rangos de catálogo: automático corriente 2.0–2.5 (Leica NA320 y
  NA720 2.5; Sokkia C28 2.0; Topcon AT-24A 2.0), automático de precisión
  0.7–1.6 (Leica NA532 1.6; NA2 0.7), digital 0.7–1.5 con mira de ínvar
  (GeoMax ZDL700 0.7).
- **ISO 17123-3** — precisión angular de estaciones totales, en segundos.
  Escalones típicos 2″ y 5″ (Hi-Target ZTS-320R 2″; Sokkia CX-52 2″, CX-55 5″).
- **ISO 17123-4** — precisión de distancia, `±(a mm + b ppm)`. Típico 2 mm +
  2 ppm con prisma, 3 mm + 2 ppm sin reflector.
- `PRD-TopoField.md` — `§3.2` (tablas), `§5.4` (tolerancias), `§4.7` (informes).

## Alcance

### Dentro

1. `projects` pierde `precision_order`, `equipment_brand`, `equipment_model`,
   `equipment_serial`, `angular_precision_seconds`, `linear_precision` y
   `equipment_calibration_date`.
2. `polygonal_processes` y `leveling_processes` capturan orden y equipo con los
   campos de su tipo de instrumento.
3. `settlement_visits` estructura su `equipment` de texto libre con los campos
   de nivel, y declara además su orden de precisión.
4. `linear_precision` deja de ser texto y pasa a dos números.
5. Aviso de equipo insuficiente para el orden declarado, en los dos módulos que
   tienen orden.
6. Informe y exports leen del proceso, no del proyecto.

### Fuera (diferido)

- **Catálogo de equipos reutilizable entre procesos.** Se evaluó y se descartó:
  obliga a resolver el congelado de las filas referenciadas por procesos
  cerrados, y los datos esenciales en el proceso bastan. Si reteclear se vuelve
  molesto, se reabre como mejora.
- **Versionado de equipo por fecha de calibración.** Más fiel a la realidad
  metrológica y más caro de lo que esta monografía necesita demostrar.
- Canvas (Fase 9), mínimos cuadrados (Fase 10), georreferenciación (Fase 11).

## Decisiones cerradas

| # | Decisión | Alternativa descartada |
|---|---|---|
| 1 | Orden y equipo **solo** en el proceso; `projects` pierde las columnas | Valor por defecto en el proyecto con override por proceso: evitaría reteclear, pero deja dos fuentes y la duda de cuál manda |
| 2 | Campos sueltos en el proceso, sin catálogo | Tabla `equipment` referenciada por id: reintroduce el agujero, porque editar la fila cambia informes de procesos cerrados |
| 3 | El congelado sale gratis del modelo | Copiar al cerrar, o bloquear la fila del catálogo con un trigger: innecesarios si el dato ya vive en el proceso, que es inmutable al cerrarse |
| 4 | Campos de precisión **según el tipo de instrumento** | Un juego único de campos para los tres módulos: es lo que hay hoy y es la causa del desajuste |
| 5 | `linear_precision` se parte en `distance_precision_mm` + `distance_precision_ppm` | Seguir con el texto `"2+2ppm"`, que nadie puede calcular |
| 6 | Las visitas de asentamiento **sí** declaran `precision_order` | Se pensó primero que no, razonando sobre los umbrales de velocidad. Pero el umbral y el orden miden cosas distintas: el orden dice con qué exactitud se obtiene la cota, el umbral dice qué significa el movimiento medido. Una visita se levanta nivelando, y ese trabajo tiene exactitud exigible |
| 7 | El aviso de equipo insuficiente avisa, no bloquea | Bloquear el cierre: misma política que el resto del editor |
| 8 | El orden lo declara la **visita**, no el lugar | `sites` lleva los umbrales porque son del programa de monitoreo; el orden acompaña a la medición, y una campaña puede hacerse con más o menos exigencia que la anterior |
| 9 | El parseo de `"2+2ppm"` se queda en el SQL del backfill, sin función TypeScript | Extraerlo a `parse.ts` no tendría consumidor en la aplicación, y un test en TS de la misma lógica no verifica el SQL. Se verifica leyendo el resultado en la base |

## Modelo de datos

Migración única `<timestamp>_precision_equipo_por_proceso.sql`, en este orden:
añadir columnas → backfill desde el proyecto → borrar las del proyecto.

### `polygonal_processes` — estación total

```sql
precision_order            text not null default 'tercer_orden'
  check (precision_order in ('primer_orden','segundo_orden','tercer_orden','ordinario'))
equipment_brand            text
equipment_model            text
equipment_serial           text
equipment_calibration_date date
angular_precision_seconds  decimal(5,1)   -- ISO 17123-3
distance_precision_mm      decimal(4,1)   -- el «2 mm» de 2 mm + 2 ppm
distance_precision_ppm     decimal(4,1)   -- el «2 ppm»
```

### `leveling_processes` — nivel

```sql
precision_order            text not null default 'tercer_orden' check (…)
equipment_brand            text
equipment_model            text
equipment_serial           text
equipment_calibration_date date
level_type                 text check (level_type in ('automatico','digital'))
km_precision_mm            decimal(4,2)   -- ISO 17123-2, mm/km doble nivelación
```

### `settlement_visits` — nivel, por visita

`precision_order` más los mismos campos de nivel que `leveling_processes`.
`equipment` (texto libre) se migra a `equipment_model` y se elimina.
`operator` se conserva: es otra cosa.

El orden aquí no compite con los umbrales de `sites`: el orden gobierna con qué
exactitud se obtiene la cota, y el umbral qué significa el movimiento que esa
cota revela. Sin orden declarado no hay contra qué contrastar el equipo, y es
justo donde más importa — buscar asentamientos de 2 mm/mes con un nivel de
2.5 mm/km es medir el ruido del instrumento.

### `projects`

Se eliminan las siete columnas. La ficha del proyecto y su formulario dejan de
pedirlas.

## Cálculo (`src/lib/calculations/tolerances.ts`)

### Fuente de la dispersión

`validateReadings` recibe hoy `projects.angular_precision_seconds`. Pasa a
recibir el del proceso. Es el mismo número por ahora —el backfill lo copia—,
pero la fuente correcta es el levantamiento, no el expediente.

### Aviso de equipo insuficiente

```ts
/** ¿El instrumento puede entregar el orden declarado? */
// Dos funciones y no una con un parámetro `kind`: las unidades son distintas
// —segundos de arco contra mm/km— y un solo `precision: number` invita a
// pasarle la unidad equivocada sin que el tipo lo impida.
export function totalStationMeetsOrder(
  order: PrecisionOrder,
  angularPrecisionSeconds: number,
): boolean;

export function levelMeetsOrder(
  order: PrecisionOrder,
  kmPrecisionMm: number,
): boolean;
```

| Módulo | Regla | Avisa | No avisa |
|---|---|---|---|
| Poligonal | `σ_angular > ANGULAR_TOLERANCE_K[orden]` | 5″ con primer orden (K = 1″) | 1″ con primer orden |
| Nivelación | `σ_km > LEVELING_TOLERANCE_K[orden]` | 5.0 mm/km con primer orden (K = 3) | 2.5 mm/km con primer orden |
| Asentamientos | `σ_km > LEVELING_TOLERANCE_K[orden]` de la visita | igual que nivelación | igual que nivelación |

La regla es **estrictamente mayor**, o sea «el instrumento no llega ni en el
mejor caso». Un emparejamiento ajustado —2.5 mm/km contra K = 3— no avisa: es
marginal, no imposible, y avisar ahí exigiría un umbral estadístico que ninguna
norma da. `σ = K` tampoco avisa, porque es justo el instrumento que corresponde
al orden.

## Captura

- `project-fields.tsx`: pierde los siete campos.
- `polygonal-config-fields.tsx`: gana orden + bloque de estación total.
- `leveling-config-fields.tsx`: gana orden + bloque de nivel.
- El editor de visitas de asentamientos: bloque de nivel.
- Los tres muestran el aviso de equipo insuficiente junto al selector de orden.
- El editor de visitas de asentamientos incluye el selector de orden, que hoy no existe en ese módulo.

## Informes y exportación

`reports/[reportId]/print/page.tsx` deja de imprimir una línea de equipo por
proyecto y pasa a imprimirla **por proceso**. El «Resumen consolidado de
precisiones» gana columna de equipo. Los tres workbooks de `src/lib/export/`
—`polygonal-workbook.ts`, `leveling-workbook.ts` y `settlement-workbook.ts`;
`workbook.ts` es el andamiaje común, no un libro— leen del proceso.

## Migración de datos

El backfill copia del proyecto a cada uno de sus procesos. `linear_precision`
se parsea con `/(\d+(?:\.\d+)?)\s*\+\s*(\d+(?:\.\d+)?)\s*ppm/i`; si no casa,
las dos columnas quedan nulas y el proceso las pide. Los datos reales a
preservar hoy son `1+1ppm / 1.0″ / primer_orden` y `3+2ppm / 5.0″ /
tercer_orden`.

`leveling_processes.km_precision_mm` queda nulo: el proyecto nunca tuvo ese
dato y no hay de dónde derivarlo.

**El backfill toca procesos cerrados**, que son inmutables por trigger. Un
`UPDATE` sobre ellos falla. Hay que desactivar el trigger para el backfill y
reactivarlo dentro de la misma migración, documentando por qué: se está
rellenando un dato que el proceso siempre tuvo de forma implícita, heredado del
proyecto, no cambiando una medición.

## Criterios de aceptación

| | Criterio |
|---|---|
| a | `projects` no tiene ninguna de las siete columnas |
| b | Poligonal captura orden, equipo de estación total y las dos precisiones de distancia |
| c | Nivelación captura orden, tipo de nivel y mm/km |
| d | Las visitas de asentamiento capturan orden y equipo de nivel; `equipment` migró a `equipment_model` |
| e | El backfill preserva `1+1ppm/1.0″/primer_orden` y `3+2ppm/5.0″/tercer_orden` en sus procesos |
| f | El backfill llega también a los procesos cerrados, y el trigger queda reactivado |
| g | Avisa con estación de 5″ y primer orden; no avisa con 1″ y primer orden ni con 5″ y tercer orden (K = 15″) |
| h | Avisa con nivel de 5.0 mm/km y primer orden (K = 3); no avisa con 2.5 mm/km, que es ajustado pero posible |
| h2 | El aviso aparece también en una visita de asentamiento con equipo insuficiente para su orden |
| i | La dispersión entre lecturas usa la precisión angular **del proceso** |
| j | El informe imprime equipo por proceso, no por proyecto |
| k | Editar un proyecto no altera el informe de un proceso cerrado |
| l | Los tres workbooks (poligonal, nivelación, asentamientos) exportan el equipo del proceso |
| m | `npm run typecheck`, `npm run lint` y `npm test` pasan |
| n | El seed siembra equipos coherentes con el orden de cada proceso y visita |

## Riesgos conocidos

- **Desactivar el trigger de inmutabilidad en una migración sienta un
  precedente.** Es legítimo aquí —se rellena un dato heredado, no se altera una
  medición— pero hay que dejarlo escrito en la migración para que no se cite
  como permiso general. La Fase 11 tendrá una discusión parecida y más delicada.
- **`precision_order` aparece 54 veces en 25 archivos.** El cambio de fuente es
  mecánico pero ancho; el riesgo es dejar un consumidor leyendo del proyecto.
  Mitigación: eliminar la columna obliga al typecheck a encontrarlos todos.
- **El formulario de proyecto queda muy corto.** Pierde siete campos de una
  sección entera. Hay que revisar que la pantalla siga teniendo sentido visual
  y no quede un `fieldset` vacío.

## Tareas (en orden)

1. Migración: columnas nuevas, backfill con trigger desactivado, borrado de las
   del proyecto. Regenerar `src/types/database.ts`.
2. Tipos de dominio: literales de `level_type`, tipos de equipo por módulo.
3. `tolerances.ts`: `instrumentMeetsOrder` + tests.
4. `validateReadings` pasa a recibir la precisión del proceso.
5. Queries y Server Actions de los tres módulos.
6. `project-fields`: quitar los siete campos y revisar la pantalla.
7. `polygonal-config-fields`: orden + bloque de estación total + aviso.
8. `leveling-config-fields`: orden + bloque de nivel + aviso.
9. Editor de visitas: orden + bloque de nivel + aviso.
10. Informe: equipo por proceso y columna en el resumen consolidado.
11. Los tres workbooks de export.
12. Seed y fixtures con equipos coherentes.
13. Verificación end-to-end (criterios a-n), levantar la app y capturar. Cierre.

## Anti-alcance explícito

No se implementa: catálogo de equipos; versionado por calibración; snapshot del
equipo en `reports`; cambios en los algoritmos de cálculo —las tolerancias por
orden siguen siendo las mismas—; el canvas, los mínimos cuadrados ni la
georreferenciación.
