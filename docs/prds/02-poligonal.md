# PRD-de-fase 3 — Módulo Poligonal

**Estado:** en curso
**Fecha de apertura:** 2026-05-22
**Fecha de cierre:** —

## Propósito

Construir el primer módulo de proceso topográfico: el editor de poligonales. Al
cerrar esta fase, un usuario debe poder, desde el hub de un proyecto, crear un
proceso poligonal, capturar sus datos de campo en una tabla con cálculo en vivo,
ver el error de cierre y la precisión relativa contra la tolerancia de su orden,
aplicar uno de los tres métodos de corrección y cerrar el proceso con
trazabilidad.

Esta fase también introduce dos cimientos que reutilizarán las Fases 4-6: los
**algoritmos de cálculo puros** en `src/lib/calculations/` (con pruebas
automatizadas) y el **mecanismo de cierre** de procesos (`§4.6` del PRD).

## Fuentes

- `PRD-TopoField.md` — `§3.2` (tablas), `§4.3` (editor), `§4.6` (cierre), `§5`
  (validación, `§5.4` tolerancias), `§6` (algoritmos).
- `docs/marco-teorico/mt-poligonales.docx` — marco teórico con 3 casos de estudio
  (cerrada, abierta con control, abierta sin control), fórmulas y tolerancias.

## Alcance

### Dentro

- Migración SQL: tablas `polygonal_processes` y `polygonal_stations` (`§3.2`),
  RLS por join con `projects`, y trigger `set_updated_at` sobre
  `polygonal_processes` (reusa la función creada en Fase 2).
- Algoritmos puros en `src/lib/calculations/`: `angles.ts` (conversiones DMS),
  `tolerances.ts` (constantes y fórmulas de tolerancia), `polygonal.ts` (los 3
  tipos y los 3 métodos de corrección).
- Framework de pruebas **Vitest** y tests unitarios de los módulos de cálculo.
- Validador `src/lib/validators/polygonal.ts` (capas de captura y cierre).
- Tipos de dominio `src/types/polygonal.ts`.
- Componentes del design system: `DmsInput` y `StatusIndicator`.
- Capa de datos: queries de lectura y Server Actions (crear, guardar, cerrar).
- Ruta `/projects/[id]/polygonal/new` — formulario de creación del proceso.
- Editor `/projects/[id]/polygonal/[pid]` — configuración, tabla de estaciones
  con cálculo en vivo, panel de resultados, selector de método, reasignación de
  coordenadas y cierre.
- Integración con el hub: la tab Procesos lista los procesos del proyecto
  (En Progreso / Cerrados) y el botón "+ Nuevo Proceso" abre el selector de tipo.

### Fuera (diferido)

- Módulos de nivelación y asentamientos, e informes → Fases 4-6.
- **Ajuste por mínimos cuadrados** → fuera de alcance del producto (CLAUDE.md).
  El marco teórico lo describe como referencia; la app no lo implementa.
- Exportación a Excel → el `§9` del PRD la sitúa en la Fase 6.
- Auto-save cada 30s → se usa guardado explícito (decisión #2).
- Selección del punto de partida desde `reference_points` → entrada libre en
  esta fase (decisión #6).
- El nivel de tolerancia "Ingeniería civil" (10″, 1:10.000) del marco teórico →
  el modelo de datos tiene 4 órdenes (`precision_order`), no 5 (decisión #5).

## Decisiones cerradas

| # | Decisión | Razón |
|---|---|---|
| 1 | Se implementan los **3 tipos** de poligonal: cerrada, abierta con control, abierta sin control. | Decisión del usuario. El módulo completo del `§4.3`; las abiertas reutilizan los métodos de corrección de la cerrada. |
| 2 | **Guardado explícito** con botón "Guardar"; sin auto-save. | Decisión del usuario. Evita la complejidad de estado sucio/debounce; consistente con los formularios de Fase 2. |
| 3 | Se añade **Vitest** y se cubren los módulos de `src/lib/calculations/` con tests unitarios. | Decisión del usuario. La correctitud topográfica es crítica y el PRD de Fase 1 ya anticipó este momento. |
| 4 | **Cálculo en vivo** en el cliente con las funciones puras; no hay botón "Calcular" separado. | El `§4.3` describe columnas y panel que "se actualizan en tiempo real". "Guardar" persiste datos + resultados; "Calcular" sería redundante. |
| 5 | Tolerancias: la constante `TOLERANCES` del PRD `§5.4` (4 órdenes). | Coincide con `projects.precision_order` (4 valores). El 5º nivel del marco teórico ("Ingeniería civil") no está modelado. |
| 6 | Punto de partida de **entrada libre** (código, N, E, azimut), no elegido de `reference_points`. | El `§4.3` dice que pueden ser arbitrarios (1000, 1000). Integrar el catálogo de puntos es mejora futura. |
| 7 | `closed_by` almacena el **user id**. | El `§4.6` lo define como "user ID". La columna es `TEXT`. |
| 8 | El editor es un **client component** con cálculo en vivo; la persistencia va por Server Action. | Los módulos de cálculo son puros y corren en cliente sin dependencias; el `§4.3` exige reactividad inmediata. |
| 9 | `angle_type`: `internal` para cerrada y abierta sin control; `deflection` para abierta con control. El valor `azimuth` del CHECK no se usa en esta fase. | Es lo que muestran los casos de estudio del marco teórico (ángulos internos / horizontales vs. deflexiones). |
| 10 | La tabla de estaciones se construye como **componente de feature**, no un `Table` genérico del design system. | Es una tabla muy específica (celdas DMS, columnas calculadas); un genérico sería especulativo (YAGNI). |
| 11 | Los resultados calculados se **persisten** en las columnas de `polygonal_stations` y `polygonal_processes` al guardar. | El `§3.2` define esas columnas calculadas; los informes (Fase 6) las leerán sin recalcular. |

## Modelo de datos

Migración nueva `<timestamp>_polygonal.sql` con las tablas `polygonal_processes`
y `polygonal_stations` **literales del PRD `§3.2`**, más:

- RLS en ambas tablas vía join con `projects` (mismo patrón que `reference_points`
  en la migración inicial): el usuario solo accede a procesos de sus proyectos.
- Trigger `projects_set_updated_at` equivalente sobre `polygonal_processes`
  (`before update`, reusa la función `public.set_updated_at()` de Fase 2).

`polygonal_stations` guarda tanto los datos de entrada (ángulo DMS, distancia)
como las columnas calculadas (azimut, ΔN, ΔE, ΔN/ΔE corregidos, N, E). Tras
aplicar la migración se regeneran los tipos (`database.ts`).

Estados de `polygonal_processes.status` (`§3.2`): `draft` → `in_progress` →
`calculated` → `closed` | `rejected`. Un proceso `closed` o `rejected` es
**inmutable**: ningún Server Action genera `UPDATE`/`DELETE` sobre él (regla de
CLAUDE.md y `§4.6`).

## Algoritmos (`src/lib/calculations/`)

Funciones puras de TypeScript — sin React, sin Supabase. Fórmulas del PRD `§6` y
del marco teórico, validadas con los tests.

### `angles.ts`
`dmsToDecimal(d,m,s)`, `decimalToDms(dec)`, `normalizeAzimuth(az)` (`§6.1`), y
helpers para error angular en segundos.

### `tolerances.ts`
La constante `TOLERANCES` del `§5.4` y las funciones:
- `angularTolerance(order, n) = K × √n` segundos (K: 1/5/15/30 según orden).
- `minRelativePrecision(order)` → el X de `1:X` (100000/20000/5000/3000).

### `polygonal.ts`
- **Poligonal cerrada** (`§6.2`): suma de ángulos vs `(n-2)×180°`, error angular,
  corrección angular equitativa `−Error/n`, progresión de azimuts
  (`Az_i = Az_{i-1} + 180° + ángulo_i`, normalizado — el signo según convención
  de ángulo se fija con un fixture de traverse conocido), proyecciones
  `ΔN = d·cos(Az)`, `ΔE = d·sin(Az)`, error de cierre lineal
  `√(ΣΔN² + ΣΔE²)`, perímetro y precisión relativa `Perímetro/Error`.
- **Abierta con control** (`§6.6`): azimuts desde deflexiones (±según D/I),
  cierre angular contra el azimut final conocido, cierre lineal contra las
  coordenadas finales conocidas.
- **Abierta sin control**: encadena azimuts y coordenadas; sin cierre ni
  corrección (precisión desconocida — marco teórico §4).
- **Métodos de corrección** sobre el error de cierre lineal:
  - **Bowditch** (`§6.3`): corrección proporcional a `dist_i / Perímetro`.
  - **Tránsito** (`§6.4`): proporcional a `|ΔN_i|/Σ|ΔN|` y `|ΔE_i|/Σ|ΔE|`.
  - **Crandall** (`§6.5`): ángulos fijos; corrige distancias por mínimos
    cuadrados ponderados resolviendo el sistema 2×2 del `§6.5`.

Los métodos aplican a cerrada y abierta con control; la abierta sin control no
admite corrección.

## Validación (`src/lib/validators/polygonal.ts`)

- **Capa captura** (`§5.1`): distancia ≤ 0 o > 1000 m → error (bloquea guardar);
  ángulo 0°00'00" o 360°00'00" → advertencia; segundos ≥ 60 → error; campo
  requerido vacío → error.
- **Capa cierre** (`§5.2`): error angular > tolerancia → bloquea el cierre;
  precisión relativa peor que la tolerancia → permite cerrar como `rejected`;
  abierta con control fuera de tolerancia → banner rojo.

## Rutas y capa de datos

| Ruta | Comportamiento |
|---|---|
| `/projects/[id]/polygonal/new` | Formulario de creación: nombre, tipo, tipo de ángulo, punto de partida (código/N/E), azimut de partida (DMS) y, si es abierta con control, punto de llegada. Inserta el proceso (`draft`) y redirige al editor. |
| `/projects/[id]/polygonal/[pid]` | Editor. Si el proceso es `closed`/`rejected`, se muestra en solo lectura. |

- **Queries** (`src/lib/supabase/queries.ts`): `getPolygonalProcesses(projectId)`
  para la tab Procesos; `getPolygonalProcess(pid)` + sus `polygonal_stations`.
- **Server Actions** (`polygonal/[pid]/actions.ts` y `polygonal/new/actions.ts`):
  `createPolygonalProcessAction` (→ redirige al editor),
  `savePolygonalProcessAction` (persiste config + estaciones + resultados;
  `revalidatePath`), `closePolygonalProcessAction` (registra `closed_at`,
  `closed_by`, `status` → `closed` o `rejected`). Toda mutación verifica que el
  proceso no esté cerrado antes de escribir.

## Componentes

- **Design system**: `DmsInput` (tres subcampos grados/minutos/segundos, para
  ángulos y azimuts) y `StatusIndicator` (semáforo verde/amarillo/rojo de
  cumplimiento de tolerancia).
- **Feature** (`src/components/polygonal/`): `polygonal-config-fields`
  (compartido entre `/new` y la zona de config del editor), `polygonal-editor`
  (client component orquestador), `stations-table`, `results-panel`,
  `reassign-coordinates-dialog`, `close-process-dialog`.
- **Hub** (`src/components/projects/`): `process-card` (tarjeta de proceso) y
  `new-process-selector` (selector con Poligonal activo; Nivelación y
  Asentamiento deshabilitados hasta sus fases).

## Criterios de aceptación

| # | Check |
|---|---|
| a | `npm run typecheck`, `lint`, `build` — exit 0 |
| b | `npm run test` — los tests de `src/lib/calculations/` pasan |
| c | Tests cubren: conversiones DMS, tolerancias, y los 3 tipos × 3 métodos contra fixtures de resultado conocido |
| d | "+ Nuevo Proceso" en el hub abre el selector; "Poligonal" lleva a `/polygonal/new` |
| e | Crear un proceso poligonal inserta la fila (`draft`) y redirige al editor |
| f | El editor calcula azimut, ΔN, ΔE y el panel de resultados **en vivo** al escribir |
| g | El selector de método recalcula las coordenadas corregidas (Bowditch/Tránsito/Crandall) |
| h | El `StatusIndicator` refleja verde/amarillo/rojo según la tolerancia del orden del proyecto |
| i | "Reasignar coordenadas" recalcula manteniendo ángulos y distancias |
| j | Validación de captura: distancia fuera de rango / segundos ≥ 60 marcan la celda y bloquean guardar |
| k | "Guardar" persiste config, estaciones y resultados; al recargar, el editor los muestra |
| l | Cerrar un proceso registra `closed_at`/`closed_by`, pone `status=closed` y lo deja en solo lectura |
| m | Un proceso fuera de tolerancia puede cerrarse como `rejected` |
| n | La tab Procesos del hub lista los procesos en "En Progreso" y "Cerrados" |
| o | RLS: un usuario no accede a procesos de proyectos ajenos (404) |
| p | Un proceso `closed` no admite edición (Server Actions rechazan la mutación) |

## Riesgos conocidos

- **El editor es el componente más complejo del producto.** Se aísla la lógica
  en funciones puras (`calculations/`) probadas con Vitest; el componente solo
  orquesta estado y presentación.
- **Los números de los casos de estudio del marco teórico son ilustrativos** y
  no perfectamente consistentes entre tablas. Los fixtures de test se construyen
  con entradas limpias y resultados calculados/verificados, no copiando las
  tablas del documento.
- **Convención de signo en la progresión de azimuts** (ángulos internos): se fija
  con un fixture de poligonal de geometría conocida antes de dar por buena la
  fórmula.
- **Crandall** requiere resolver un sistema 2×2; se implementa con forma cerrada
  (inversión de matriz 2×2) y se prueba contra un caso conocido.

## Tareas (en orden)

0. Apertura: este PRD, estado `en curso` en `method.md` y `prds/README.md`, commit `docs:`.
1. Configurar Vitest (`vitest.config.ts` con alias `@`, script `npm run test`).
2. Migración `polygonal_processes` + `polygonal_stations` + RLS + trigger; `db reset`; regenerar tipos.
3. `src/types/polygonal.ts` (literales, etiquetas, tipos de entrada/resultado).
4. `calculations/angles.ts` + tests.
5. `calculations/tolerances.ts` + tests.
6. `calculations/polygonal.ts` (3 tipos + 3 métodos) + tests.
7. `validators/polygonal.ts`.
8. Design system: `DmsInput`, `StatusIndicator`.
9. Queries y Server Actions (crear, guardar, cerrar).
10. Ruta `/polygonal/new` (formulario de creación) + `polygonal-config-fields`.
11. Editor `/polygonal/[pid]`: zona de config, `stations-table`, cálculo en vivo.
12. `results-panel` + selector de método + `reassign-coordinates-dialog`.
13. `close-process-dialog` y flujo de cierre; modo solo lectura para cerrados.
14. Integración con el hub: `process-card`, `new-process-selector`, tab Procesos.
15. Verificación end-to-end (criterios a-p). Cierre de fase.

## Anti-alcance explícito

No se implementa: ajuste por mínimos cuadrados; exportación a Excel; auto-save;
módulos de nivelación/asentamientos/informes; selección del punto de partida
desde `reference_points`; un componente `Table` genérico. No se crean tablas SQL
fuera de las 2 de poligonal. No se refactoriza código de fases anteriores salvo
lo necesario para integrar la tab Procesos y el selector de "Nuevo Proceso".
