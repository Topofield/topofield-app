# PRD-de-fase 23 — Integridad

**Estado:** en curso
**Fecha de apertura:** 2026-09-30

**Rama:** `fase-23-integridad`
**Petición:** del usuario, 2026-09-29: los huecos de integridad que la Fase 22
dejó anotados en `pendientes.md` —guardados en una sola transacción, la C0 de
un punto con lecturas cerradas, el informe emitido congelado y los dos cabos
sueltos de la Fase 9—, más la discrepancia de ida y vuelta en el informe de
nivelación, vista en producción al cerrar la 22.
**Módulo:** transversal — los guardados de los tres módulos, el catálogo de
puntos, los informes y el veredicto de la nivelación

## Propósito

TopoField existe para que lo medido quede **tal como se midió y se juzgó**.
Hay cuatro sitios donde hoy no está garantizado:

- un guardado que falla a medias deja el proceso con datos mezclados —o sin
  ellos—;
- un punto con lecturas cerradas puede cambiar su cota base o sus coordenadas
  y reescribir el histórico ya informado;
- un informe emitido cambia de portada si se edita el proyecto, y la base
  permite modificarlo;
- una nivelación abierta con vuelta no guarda su veredicto: se cierra como
  conforme aunque su discrepancia no cumpla.

Esta fase cierra los cuatro, sin cambiar lo que el usuario ve cuando todo va
bien.

## Decisiones del usuario (apertura)

1. **Los cuatro guardados en una sola transacción**: poligonal, nivelación,
   visita con libreta y georreferenciación, cada uno con su función de
   Postgres.
2. **En una nivelación abierta con vuelta, la discrepancia es su veredicto
   guardado**: sale en el hub, en el dashboard y en el informe, y si no
   cumple solo se cierra como Rechazado. Los procesos ya cerrados conservan el
   criterio con el que se cerraron.
3. **El informe consolidado emitido no se edita nunca**; se puede eliminar y
   reemitir. Su portada guarda los datos del proyecto al emitirlo.
4. **Un punto con lecturas en visitas cerradas bloquea su C0 y sus
   coordenadas.** El código y la ubicación siguen editables.

## Hallazgos que condicionan la fase

### 1. Los guardados de poligonal y nivelación borran antes de reinsertar

`savePolygonalProcessAction` y `saveLevelingProcessAction` escriben la
cabecera, **borran todas las estaciones (o lecturas)** y las reinsertan, en
peticiones separadas. Si la inserción falla, el proceso queda **sin sus datos
de campo** y con la cabecera nueva. Es más grave que el caso anotado de la
visita, que usa `upsert` y purga, y no estaba en la § 11.

| Guardado | Escrituras separadas | Si falla a medias |
|---|---|---|
| Poligonal | cabecera, borrado de estaciones, estaciones, lecturas de ángulo | sin estaciones |
| Nivelación | cabecera, borrado de lecturas, lecturas | sin libreta |
| Visita con libreta | purga de lecturas, cabecera, libreta, purga de libreta, lecturas, propagación a las siguientes | libreta y cotas de dos guardados distintos |
| Georreferenciación | cabecera, una actualización por estación | cabecera y estaciones en sistemas distintos |

PostgREST no abre una transacción que abarque varias peticiones: la única
forma de que todo o nada es una **función de Postgres** que haga las
escrituras dentro de sí.

### 2. La abierta con vuelta no guarda su veredicto

El § 6.9 del PRD principal dice que el emparejamiento por sección es **el
veredicto** del doble recorrido, y desde la Fase 22 el banner de la
nivelación así lo muestra. Pero en una nivelación **abierta**
`meets_tolerance` queda nulo —no hay cierre contra cota conocida—, así que:

- el hub muestra «—» en *Cumple* y el informe no dice nada;
- el cierre la trata como abierta sin control y la deja cerrar como
  **Cerrado** aunque la discrepancia no cumpla (`close-status.ts`);
- ni la tolerancia de la discrepancia ni su veredicto se guardan.

### 3. El informe de nivelación no muestra la discrepancia

La sección imprime el error de cierre y su tolerancia, que en una abierta con
vuelta son «— mm». En el resumen de precisiones sale «— mm (tol. —)» y
«¿Cumple? —».

### 4. La C0 solo está protegida en los puntos de baja

`savePointAction` rechaza editar un punto de baja, pero no uno vigente con
lecturas cerradas: su C0 cambia el acumulado de todas sus visitas, y sus
coordenadas la distorsión angular. Las lecturas persistidas no cambian,
pero el panel, el informe y el Excel recalculan y dejan de coincidir con lo
cerrado.

### 5. `reports` es modificable y su portada vive en el proyecto

La portada del informe lee `projects` en vivo, y `reports` tiene política de
UPDATE y ningún trigger.

## Alcance

### A. Guardados en una transacción

Cuatro funciones en una migración nueva, `SECURITY INVOKER` —corren como el
usuario, con su RLS y los triggers de siempre—:

| Función | Recibe | Hace, en orden |
|---|---|---|
| `save_polygonal_process` | id, cabecera, estaciones con sus lecturas | actualiza la cabecera, reemplaza estaciones y lecturas |
| `save_leveling_process` | id, cabecera, lecturas | actualiza la cabecera, reemplaza las lecturas |
| `save_visit` | id, cabecera, libreta, lecturas, reescrituras | el mismo orden de hoy: purga, cabecera, libreta, purga de la libreta, lecturas, propagación |
| `georeference_polygonal` | id, cabecera, posiciones de estación | actualiza la cabecera y cada estación |

**El cálculo no se mueve**: sigue en TypeScript, en el motor y en las Server
Actions, que validan, calculan y arman la carga. La función solo escribe, con
columnas explícitas —nada dinámico—. Los id de estaciones y lecturas se
generan en el servidor para que las lecturas de ángulo referencien su
estación en la misma carga.

### B. El veredicto de la abierta con vuelta

- Columnas nuevas en `leveling_processes`: `discrepancy_tolerance_mm` y
  `meets_discrepancy`, que se guardan con cualquier tipo que tenga vuelta.
- En una **abierta con vuelta**, `meets_tolerance` = `meets_discrepancy`. En
  cerrada y de enlace sigue siendo el cierre: ahí la discrepancia es control
  de calidad (Fase 4).
- `close-status.ts`: una abierta con vuelta exige veredicto y se cierra como
  Rechazado si no cumple. La abierta sin vuelta sigue como hoy.
- **Relleno** de los procesos **no cerrados** existentes con los valores
  guardados: discrepancia, distancia de ida y distancia de vuelta —el último
  acumulado de sus lecturas de vuelta—. Verificado fila a fila contra el
  motor en local, como la migración de la Fase 19. Los cerrados no se tocan.
- La demo y el seed guardan las columnas nuevas.

### C. El informe muestra la discrepancia

Con vuelta, la sección de nivelación suma la discrepancia y su tolerancia; en
una abierta con vuelta, el resumen de precisiones usa la discrepancia como
«Precisión / cierre» y su veredicto en «¿Cumple?». El Excel suma la tolerancia
y el veredicto de la discrepancia en «Resumen».

### D. El punto con lecturas cerradas

- Trigger en `settlement_points`: rechaza cambiar `initial_elevation`,
  `northing` o `easting` si el punto tiene alguna lectura en una visita
  cerrada.
- `savePointAction` lo comprueba antes, con un mensaje claro.
- El catálogo deshabilita esos campos en el diálogo de edición y dice por
  qué.

### E. El informe emitido congelado

- Columna `reports.cover` (`jsonb`): nombre, cliente, ubicación, datum y
  proyección del proyecto **al emitir**. La escribe `createReportAction`; la
  migración la rellena en los informes existentes con los datos actuales del
  proyecto, que es lo mejor disponible.
- Trigger que rechaza **todo UPDATE** de `reports`, y se retira la política
  de UPDATE. El borrado sigue permitido.
- La portada del informe consolidado lee `cover`. El informe de un proceso
  (pestaña Informe) sigue siendo derivado y en vivo (Fase 22, decisión 2).

### F. Los cabos de la Fase 9

- `computeLeveling`: si ida o vuelta no tienen distancia, la tolerancia de la
  discrepancia **no se evalúa** (nula), en vez de usar la del otro recorrido.
- `validateRunCapture`: `order` y `distancesReconstructed` pasan a
  obligatorios.

### G. Documentación

La línea de la doc técnica que da por pendiente en la nube la migración de la
Fase 22 se corrige en la apertura.

## Decisiones

| # | Decisión | Razón |
|---|---|---|
| 1 | Las funciones escriben; el cálculo sigue en TypeScript | El motor es TypeScript puro y tiene los tests; duplicarlo en SQL crearía dos verdades |
| 2 | `SECURITY INVOKER`, no `DEFINER` | Que valgan RLS y los triggers de inmutabilidad sin reescribir sus comprobaciones dentro de la función |
| 3 | Columnas explícitas, nada de SQL dinámico | Una clave inesperada en la carga no puede escribir una columna que la acción no pretendía |
| 4 | Veredicto de la abierta con vuelta en `meets_tolerance`, más dos columnas propias | `meets_tolerance` es lo que leen el hub, el dashboard, el informe y el cierre; las columnas propias guardan el dato también en cerradas y de enlace |
| 5 | Los cerrados conservan su criterio | Decisión del usuario 2; mismo principio que las visitas cerradas en la Fase 18 |
| 6 | La portada congelada en `jsonb` | Es un bloque que solo se lee entero, y sus campos pueden crecer sin migrar |
| 7 | Bloqueo de C0 y coordenadas por trigger, además de la acción | La acción da el mensaje; la base garantiza la regla aunque se la salte |
| 8 | Sin tolerancia de discrepancia si falta una distancia | Evaluar con un solo recorrido promete «la menor de las dos» y no la cumple |

## Pruebas

| Qué | Cómo |
|---|---|
| Atomicidad | En la base local, cada función con una carga que falla a mitad —una fila que viola un CHECK después de la cabecera—: la cabecera no cambia. Script SQL versionado en `supabase/tests/` |
| Guardados | Cada editor guarda como hoy: recorrido en pantalla por los tres módulos y la georreferenciación |
| Veredicto de la abierta con vuelta | Tests del cálculo de las columnas nuevas y de `close-status` (abierta con vuelta que cumple, que no cumple, sin distancias; abierta sin vuelta sin cambios) |
| Relleno | Contra el motor en local: cada nivelación no cerrada con vuelta da la misma tolerancia y el mismo veredicto |
| Informe | La sección y el resumen de una abierta con vuelta (render); la portada sale de `cover` |
| C0 y coordenadas | El trigger rechaza el cambio con una lectura cerrada y lo admite sin ella; la acción da su mensaje |
| `reports` | El trigger rechaza un UPDATE; el borrado funciona |
| Cabos de la Fase 9 | Ida sin distancias: sin tolerancia de discrepancia; los llamadores de `validateRunCapture` pasan sus parámetros |

**En pantalla (local):** guardar los tres editores, georreferenciar la Vivero
local, cerrar una abierta con vuelta fuera de tolerancia (solo Rechazado),
editar la C0 de un punto con lecturas cerradas, y los informes.

## Criterios de aceptación

1. Ningún guardado de los tres módulos ni la georreferenciación deja datos a
   medias si falla: probado en la base local.
2. Una nivelación abierta con vuelta guarda su veredicto, lo muestra en el
   hub, el dashboard y el informe, y no se cierra como conforme si no cumple.
3. La C0 y las coordenadas de un punto con lecturas cerradas no cambian, ni
   desde la interfaz ni en la base.
4. Un informe emitido no se modifica y su portada no cambia al editar el
   proyecto.
5. `npm run typecheck`, `npm run lint`, `npm test` y `npm run build` limpios.
6. Manual en sus dos copias y doc técnica al día; la § 11 revisada.

## Fuera de alcance

- Mover el cálculo a la base.
- Historial de georreferenciaciones, σ del nivel digital, catálogo de equipos.
- Que la discrepancia cuente en el veredicto de una cerrada o de enlace.
- Congelar el informe derivado de un proceso.
- Recalcular procesos o visitas cerrados.

## Riesgos

- **La carga de las funciones y las columnas de la base pueden divergir.**
  Mitigación: columnas explícitas, tipos a mano en `database.ts` y el
  recorrido en pantalla guardando cada editor.
- **El relleno toca la nube.** Solo procesos no cerrados, verificado contra
  el motor en local; en la nube se aplica antes del merge, con visto bueno.
- **Los triggers nuevos pueden bloquear flujos legítimos**: renombrar un punto
  con lecturas cerradas debe seguir funcionando. Mitigación: el trigger mira
  solo C0 y coordenadas, y se prueba el renombrado.

## Tareas (en orden)

0. **Apertura:** este PRD, estados en `method.md` y `prds/README.md`,
   `pendientes.md` y la línea de la doc técnica. Commit `docs:`. Rama.
1. **F** — los cabos de la Fase 9, con sus tests.
2. **B y C** — veredicto de la abierta con vuelta: migración con columnas y
   relleno, motor y acciones, `close-status`, informe y Excel; demo y seed.
3. **A** — las cuatro funciones y las acciones que las llaman; script de
   atomicidad.
4. **D** — C0 y coordenadas: trigger, acción e interfaz.
5. **E** — portada congelada y `reports` inmutable.
6. **Verificación en pantalla** en local.
7. **Cierre:** manual (dos copias), doc técnica § 11, `method.md`,
   `prds/README.md`, `pendientes.md`. Revisión de código y PR.
8. **Antes del merge:** `db push` a la nube, con visto bueno.
