# PRD-de-fase 25 — Catálogo de equipos

**Estado:** en curso
**Fecha de apertura:** 2026-09-30

**Rama:** `fase-25-catalogo-equipos`
**Petición:** del usuario, 2026-09-30, tras revisar los pendientes: «sí,
prepara el PRD del catálogo de equipos». Viene de la § 11 de la doc técnica
(«No hay catálogo de equipos reutilizable entre procesos», diferido en la
Fase 8).
**Módulo:** transversal — los formularios de equipo de poligonal, nivelación y
visitas de asentamientos, una página nueva y el modelo de datos

## Propósito

Cada poligonal, cada nivelación y cada visita piden marca, modelo, serie, fecha
de calibración y precisión del instrumento, aunque sea el mismo aparato de
siempre. Un topógrafo trabaja con dos o tres equipos: la fase le deja darlos de
alta una vez y elegirlos en cada proceso, **sin que corregir el catálogo cambie
lo que ya se informó**.

## Decisiones del usuario (apertura)

1. **El catálogo es una plantilla: el proceso copia los datos.** Elegir un
   equipo rellena los campos del proceso, que sigue guardando su propia copia
   como hoy. Editar o borrar un equipo del catálogo nunca toca un proceso. No
   hay referencia del proceso al catálogo en la base.
2. **El catálogo es de la cuenta**, no de cada proyecto: el aparato es del
   topógrafo.
3. **Se gestiona en una página «Equipos»**, enlazada en la cabecera junto a
   «Manual», y además desde cada formulario de equipo: elegir uno y guardar el
   que se está tecleando.
4. **Aviso de calibración vencida a más de 12 meses**, sin bloquear, contado a
   la fecha de la visita o a hoy. El catálogo lo muestra también.

## Hallazgos que condicionan la fase

### 1. Por qué la Fase 8 lo descartó, y por qué la plantilla lo resuelve

La Fase 8 llevó el equipo del proyecto a cada proceso para que el informe de un
proceso cerrado no cambiara al editar el proyecto. Evaluó una tabla `equipment`
referenciada por id y la descartó (PRD de la Fase 8, decisión 2): editar la
fila cambiaría en silencio el equipo de los informes ya cerrados. La § 11 lo
dejó dicho: se reabre «con el congelado resuelto, no solo con menos tecleo».

La plantilla lo resuelve sin tocar el modelo de los procesos: las columnas
`equipment_*` y de precisión siguen en cada proceso y en cada visita, con sus
triggers de inmutabilidad. El catálogo solo existe en el momento de rellenar.

### 2. Seis formularios, dos componentes

El equipo se captura en el alta y en la configuración de poligonal y de
nivelación, en el alta de una visita y en su editor. Todos usan
`TotalStationFieldset` (estación total) o `LevelFieldset` (nivel), de
`design-system/equipment-fields.tsx`. El catálogo se engancha ahí, una vez.

### 3. La visita nueva ya copia el equipo de la anterior

`NewVisitDialog` precarga el equipo de la visita anterior y lo dice. Se
mantiene: el catálogo es otra forma de rellenar, no la sustituye.

### 4. No hay validación del equipo

Los valores de equipo llegan a la base sin más control que el CHECK de
`level_type` y la escala de las columnas (`decimal(5,1)` la precisión angular,
`decimal(4,1)` las de distancia, `decimal(4,2)` la de nivel). Un valor que no
cabe tumba el guardado con un error genérico. El catálogo trae su propio
validador con esos límites.

### 5. Los equipos de la demo y del seed

La demo usa una Leica TS06 Plus (poligonales), un nivel digital Leica (tramo 2)
y un Trimble DiNi 12 (Torre Alameda). El seed, seis: Leica TS06 Plus,
Trimble S9, una estación genérica, Leica NA2, Trimble DiNi 12 y Leica NA720.

## Alcance

### A. La tabla `equipment`

Migración nueva:

| Columna | Tipo | Nota |
|---|---|---|
| `id` | `uuid` | |
| `user_id` | `uuid not null` | dueño; `default auth.uid()`, `on delete cascade` |
| `kind` | `text not null` | `total_station` o `level` |
| `brand`, `model`, `serial` | `text` | al menos marca o modelo |
| `calibration_date` | `date` | |
| `angular_precision_seconds` | `decimal(5,1)` | solo estación total |
| `distance_precision_mm`, `distance_precision_ppm` | `decimal(4,1)` | solo estación total |
| `level_type` | `text` | solo nivel: `automatico` o `digital` |
| `km_precision_mm` | `decimal(4,2)` | solo nivel |
| `created_at`, `updated_at` | `timestamptz` | trigger de `updated_at` como el resto |

- RLS: cada usuario ve y escribe solo sus filas (`user_id = auth.uid()`).
- CHECK: los campos de un tipo quedan nulos en el otro; `level_type` en su
  dominio. Las escalas son las de las columnas de los procesos, para que copiar
  nunca falle.
- Sin referencia desde los procesos (decisión 1). Borrar un equipo no deja
  nada colgando.

### B. La página «Equipos»

Ruta `/equipos`, enlazada en la cabecera.

- Dos secciones, **Estaciones totales** y **Niveles**: marca y modelo, serie,
  calibración —con el aviso si tiene más de 12 meses— y precisión.
- **Agregar**, **Editar** y **Eliminar**, en un `Modal` con el mismo fieldset de
  los procesos. Eliminar pide confirmación y dice que no cambia ningún proceso.
- Vacía, explica para qué sirve y ofrece agregar el primero.

### C. En los formularios de equipo

`TotalStationFieldset` y `LevelFieldset` reciben, por props, los equipos de su
tipo (datos planos; el componente no consulta la base):

- **«Tomar del catálogo»**, un selector que copia marca, modelo, serie,
  calibración y precisión en los campos. Los campos siguen editables: el
  proceso guarda lo que quede en ellos.
- **«Guardar en el catálogo»**, que crea un equipo con lo tecleado. Si ya hay
  uno con la misma marca, modelo y serie, el botón dice «Ya está en el
  catálogo» y no duplica.
- Sin equipos en el catálogo, el selector no aparece y el botón sí.

Las páginas de servidor pasan la lista. En procesos cerrados o visitas
cerradas el fieldset está deshabilitado y no muestra ninguno de los dos.

### D. Aviso de calibración

Función pura `calibrationOverdue(calibrationDate, referenceDate)`: más de 12
meses entre las dos fechas. El fieldset avisa —«Calibración de hace más de un
año»—, contado a la fecha de la visita en asentamientos y a hoy en poligonal y
nivelación, que no tienen fecha de medición. No bloquea.

### E. Validación del equipo del catálogo

`validateEquipmentItem` (pura, en `lib/validators/`), en la página y en las
Server Actions: marca o modelo; precisiones positivas que quepan en su columna;
`level_type` válido; fecha de calibración no futura.

### F. Demo y seed

- El proyecto de ejemplo crea en el catálogo los equipos que usa: la Leica
  TS06 Plus y el Trimble DiNi 12.
- El seed, sus seis equipos.

## Decisiones

| # | Decisión | Razón |
|---|---|---|
| 1 | Plantilla sin referencia | Es lo que la Fase 8 pedía para reabrirlo: editar el catálogo no puede cambiar un informe cerrado |
| 2 | Catálogo por cuenta | El aparato es del topógrafo y se usa en todos sus proyectos |
| 3 | El fieldset recibe la lista por props | El sistema de diseño no consulta la base; ya conoce el dominio del equipo (§ 11), no se le añade Supabase |
| 4 | Sin duplicar por marca, modelo y serie | El mismo aparato una sola vez; dos de la misma marca y modelo se distinguen por la serie |
| 5 | Aviso de calibración, no bloqueo | La fecha la juzga el topógrafo; la aplicación solo la hace visible |

## Pruebas

| Qué | Cómo |
|---|---|
| Validador | Tests de `validateEquipmentItem`: tipo, marca o modelo, escalas, `level_type`, fecha futura |
| Calibración | Tests de `calibrationOverdue`: 11 y 13 meses, el mismo día, sin fecha |
| Fieldset | Render: el selector solo con equipos del tipo, «Ya está en el catálogo» con uno igual, nada en un cerrado |
| RLS y CHECK | pgTAP: otro usuario no ve ni escribe; campos del otro tipo rechazados |
| Congelado | pgTAP o recorrido: editar y borrar un equipo no cambia el equipo de un proceso ni de un informe |
| Demo y seed | Los equipos aparecen tras crear la demo y tras el seed |

**En pantalla (local), claro y oscuro, 1280 y 390 px:** la página Equipos con
alta, edición y baja; tomar del catálogo en una poligonal, una nivelación y una
visita; guardar en el catálogo desde un formulario; el aviso de calibración; y
editar un equipo sin que cambie el informe de un proceso cerrado.

## Criterios de aceptación

1. Un equipo dado de alta se elige en cualquier formulario de su tipo y rellena
   todos sus campos.
2. Editar o borrar un equipo del catálogo no cambia ningún proceso, visita ni
   informe.
3. Cada usuario ve solo su catálogo.
4. El aviso de calibración aparece a más de 12 meses y no bloquea.
5. `npm run typecheck`, `npm run lint`, `npm test`, `npx supabase test db` y
   `npm run build` limpios. Manual en sus dos copias y § 11 revisada (la
   entrada del catálogo se cierra).

## Fuera de alcance

- Referenciar el equipo desde el proceso, o listar los procesos que usaron un
  equipo.
- Historial de calibraciones de un equipo.
- Validar el equipo que se teclea en los procesos (sigue como hoy).
- Compartir el catálogo entre cuentas, importarlo o exportarlo.

## Riesgos

- **El fieldset del sistema de diseño crece en dominio.** Mitigación: recibe
  datos planos por props; no importa Supabase ni acciones. La acción de
  guardar llega como callback desde el formulario que lo usa.
- **La demo crea filas nuevas al primer inicio de sesión.** Si fallara la
  inserción del catálogo, la demo ya envuelve su creación en try/catch: el
  usuario entra igual. Mitigación: insertar el catálogo después del proyecto y
  sin hacer depender de él nada de la demo.

## Tareas (en orden)

0. **Apertura:** este PRD, estados en `method.md` y `prds/README.md`,
   `pendientes.md`. Commit `docs:`. Rama.
1. **A** — migración con RLS y CHECK, tipos, pgTAP.
2. **E y D** — validador y aviso de calibración, con sus tests.
3. **B** — página Equipos, acciones y enlace en la cabecera.
4. **C** — selector y «Guardar en el catálogo» en los dos fieldsets, y las
   seis páginas que pasan la lista.
5. **F** — demo y seed.
6. **Verificación en pantalla** en local.
7. **Cierre:** manual (dos copias) y capturas, doc técnica § 11, `method.md`,
   `prds/README.md`, `pendientes.md`. Revisión de código y PR.
8. **Antes del merge:** `db push` de la migración a la nube, con visto bueno.
