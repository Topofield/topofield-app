# PRD-de-fase 11 — Estado de los BMs

**Estado:** en curso
**Fecha de apertura:** 2026-09-23
**Fecha de cierre:** —

**Rama:** `fase-11-estado-bms`
**Petición que recoge:** A2 de [`pendientes.md`](../pendientes.md)
**Módulo:** control de asentamientos (Fase 5, [`04-asentamientos.md`](./04-asentamientos.md))

## Propósito

Que el catálogo de puntos de un lugar pueda **cambiar durante el monitoreo**
sin borrar historia:

- **Dar de baja** un BM que se destruyó, se tapó o se perdió. Deja de medirse
  y su serie sigue siendo válida hasta esa fecha.
- **Dar de alta** un BM nuevo a mitad del monitoreo, cuya línea base es su
  **primera lectura**, no la visita 0 del lugar.

## Hallazgos que originan la fase

Verificados sobre el código, no inferidos.

### 1. Un BM destruido bloquea el monitoreo entero

`validateVisitClose` (`src/lib/validators/settlement.ts`) exige lectura de
**todos** los puntos del catálogo para cerrar una visita. Si un BM desaparece,
ninguna visita posterior puede cerrarse.

La única salida hoy es borrarlo, y `deletePointAction` lo impide —con razón—
en cuanto el punto tiene lecturas en una visita cerrada. El usuario queda sin
camino: ni cierra ni borra.

### 2. Un BM nuevo no tiene de dónde sacar su C0

La decisión #14 de la Fase 5 dice que la cota de la visita 0 **es** la C0. Se
implementó como un campo tecleado en el catálogo (`initial_elevation`),
opcional, y el motor mide el acumulado contra él:

```
acumulado = (cota − C0) × 1000        si C0 existe
acumulado = null                      si no
```

Un BM incorporado en la visita 7 no tiene visita 0. Su línea base es la
medición de la visita 7, que no existe cuando se crea el punto en el catálogo.
Hoy hay dos opciones y las dos son malas: teclear la C0 después de medir (el
mismo número guardado dos veces, a mano) o dejarla vacía, y entonces el punto
**nunca** dispara alerta por acumulado, sin que nada lo avise.

### 3. Las visitas no se cierran en orden

`createVisitAction` crea la visita N+1 aunque la N siga abierta. Puede haber una
visita antigua abierta mientras existen otras más nuevas. Por eso no basta con
decir «el punto nuevo se exige a partir de ahora»: hace falta saber **desde qué
fecha** existe, o cerrar esa visita antigua exigiría medir un BM que no estaba
instalado.

### 4. La distorsión angular mezclaría líneas base distintas

`computeDifferentials` resta los acumulados de cada par de puntos en la última
visita. Si P-07 entró en la visita 3, su acumulado cuenta desde la visita 3 y el
de P-01 desde la visita 0. Restarlos compara asentamientos de **periodos
distintos**, y la distorsión `1/X` resultante no significa nada. Puede dar una
falsa alarma o una falsa tranquilidad, y la función documenta que existe
precisamente para no «fabricar tranquilidad falsa».

## Lo que ya funciona y no se toca

El motor ya tolera huecos: el parcial y la velocidad se miden contra la
**última visita en que el punto tuvo lectura** (`computeSettlements`), no contra
la inmediatamente anterior. Tampoco hay que tocar lo siguiente:

| Consumidor | Qué hace con un punto sin lectura en la última visita |
|---|---|
| Semáforo del panel | Solo lista las lecturas de la última visita: el punto de baja no aparece |
| Diferenciales | Solo la última visita: el punto de baja queda fuera |
| Tendencias | Se pintan en el semáforo, así que tampoco aparecen |
| Gráfica | Parte la serie en los `null`: la línea de un punto de baja termina en su última lectura |

## Decisiones

Las tres primeras las tomó el usuario al abrir la fase.

| # | Decisión | Razón |
|---|---|---|
| 1 | **La línea base de un punto sin C0 es su primera lectura** | Aplica la decisión #14 de la Fase 5 sin duplicar el dato: la «visita 0» de un BM de alta es la primera en que se midió. Ver «Efecto sobre los puntos existentes sin C0» |
| 2 | **La baja se deshace solo para corregir**: mientras no se haya cerrado ninguna visita fechada en o después de la baja | Después es definitiva. Un BM tapado y reencontrado puede haberse movido: vuelve como **punto nuevo**, con otro código y su propia línea base, no como continuación de una serie con un salto que nadie verá |
| 3 | La operación se llama **«Dar de baja» / «Dar de alta»**; el estado, **«De baja»** | Es la palabra de la petición y el registro administrativo habitual en español |
| 4 | **Vigencia por fechas** en el punto: `active_from` (alta) y `retired_on` (baja) | Hallazgo 3. Con fechas, «¿se exige este punto en esta visita?» se contesta mirando la fecha de la visita, sin depender del orden de cierre. `retired_on` es la **primera fecha en que ya no se mide** (límite exclusivo) |
| 5 | **Un punto de alta no admite C0 tecleada** | Su línea base es su primera lectura por definición. Admitir las dos abriría la pregunta de a qué fecha corresponde la C0 tecleada, que no tiene respuesta |
| 6 | **Un punto de baja no se edita** | Ya no tiene datos abiertos: editar su C0 o sus coordenadas solo reescribiría su historia cerrada, que el panel recalcula en vivo. Para corregir, primero se deshace la baja (si todavía se puede) |
| 7 | La baja exige **motivo** (texto libre) | Es trazabilidad: dentro de un año nadie recordará por qué P-05 dejó de medirse |
| 8 | Los diferenciales de un par con líneas base distintas se calculan **sobre el periodo común** | Hallazgo 4. Ver «Diferenciales sobre el periodo común» |
| 9 | Borrar sigue existiendo para puntos **sin lecturas cerradas** | Un punto creado por error se borra. El mensaje que hoy impide borrar uno con historia pasa a proponer la baja |
| 10 | El estado **no** se guarda en una columna `status` | Se deriva de `retired_on`. Una columna más podría contradecir a la fecha |

## Modelo de datos

Migración nueva sobre `settlement_points`:

```sql
alter table public.settlement_points
  add column active_from       date,  -- alta; null = punto original del lugar
  add column retired_on        date,  -- baja; primera fecha en que ya no se mide
  add column retirement_reason text;

alter table public.settlement_points
  add constraint settlement_points_retirement_complete
    check ((retired_on is null) = (retirement_reason is null)),
  add constraint settlement_points_retirement_reason_not_blank
    check (retirement_reason is null or btrim(retirement_reason) <> ''),
  add constraint settlement_points_active_before_retired
    check (active_from is null or retired_on is null or active_from < retired_on);
```

Todas las filas existentes quedan con las tres columnas en `null`: puntos
originales y vigentes. No hay backfill.

**Triggers de defensa en la base.** El invariante es «ninguna lectura cae
fuera de la vigencia de su punto», y hay **tres** escrituras que pueden romperlo:

| Tabla | Escritura | Qué comprueba |
|---|---|---|
| `settlement_readings` | insert, update | La fecha de la visita de la lectura está dentro de la vigencia del punto |
| `settlement_points` | update de `active_from` o `retired_on` | Ninguna lectura existente del punto queda fuera de la vigencia nueva |
| `settlement_visits` | update de `date` | Ninguna lectura de la visita queda fuera de la vigencia de su punto |

Un trigger solo en las lecturas dejaría pasar las otras dos: mover la baja de un
punto o la fecha de una visita por REST no toca `settlement_readings`. Es el
mismo criterio que llevó a las migraciones de inmutabilidad a la base: la clave
publicable es pública y la API REST se salta las Server Actions.

Las tres funciones comparten un único predicado SQL de vigencia
(`public.point_active_on(point_id, date)`), para que la regla no se escriba tres
veces dentro de la propia base.

El trigger de inmutabilidad del catálogo de un lugar cerrado
(`reject_write_on_closed_site_point`) ya cubre las columnas nuevas sin cambios.

Tras la migración se regeneran los tipos (`src/types/database.ts`).

## Reglas

### Vigencia

Un punto **se mide** en una visita de fecha `d` si y solo si:

```
(active_from is null  or  d >= active_from)
and
(retired_on  is null  or  d <  retired_on)
```

Una función pura, `isPointActiveOn(point, date)`, en
`src/lib/calculations/settlement.ts`. La usan los validadores, el editor de
visita y el panel; ningún consumidor en TypeScript la reimplementa. La única
copia es el trigger de la base, y por eso tiene su propio test (ver «Riesgos»).

### Dar de baja

- Solo en un lugar abierto.
- `retired_on` debe ser **posterior a la fecha de la última lectura del punto**,
  en cualquier visita, abierta o cerrada. Si no, esa lectura quedaría fuera de
  vigencia.
- Si el punto tiene `active_from`, `retired_on` debe ser posterior.
- El motivo es obligatorio.
- No recalcula nada: ningún valor derivado de otro punto depende de que este
  siga vigente.

### Deshacer una baja

Permitido solo si **ninguna visita cerrada** tiene fecha `>= retired_on`. El
mensaje de rechazo nombra la visita que la hace definitiva: «La baja ya es
definitiva: la visita 5 (15/05/2025), posterior a la baja, está cerrada».

### Dar de alta

- Si el lugar **ya tiene visitas**, el formulario de punto nuevo pide la
  **fecha de alta** (obligatoria; por defecto, hoy) y oculta la C0.
- Si el lugar **no tiene visitas**, el punto es original: sin fecha de alta y
  con C0 opcional, como hoy.
- La fecha de alta debe ser **posterior a la de la última visita cerrada**: una
  visita cerrada se cerró sin ese punto, y darlo de alta antes de ella la haría
  incompleta a posteriori.
- Mientras el punto no tenga lecturas, la fecha de alta se puede editar.

### Captura y cierre de visitas

- `validateVisitCapture`: **error** si una lectura corresponde a un punto no
  vigente en la fecha de la visita. Cubre también el caso de cambiar la fecha
  de una visita abierta hasta sacarla de la vigencia de un punto ya medido.
- `validateVisitClose`: exige lectura solo de los puntos **vigentes** en la
  fecha de la visita.
- `validateVisitClose`: **no cierra una visita si alguno de sus puntos sin C0
  tiene la línea base en una visita anterior todavía abierta.** El mensaje
  nombra las dos cosas: «Cierra antes la visita 2: contiene la primera lectura
  de P-07, que es su línea base». Ver «Por qué la línea base no puede quedar
  abierta».

### Línea base en el motor

En `computeSettlements`:

```
línea base del punto = C0              si el catálogo la trae
                     = su primera lectura (en orden de fecha)   si no
```

La primera lectura de un punto sin C0 queda con acumulado 0, sin parcial y sin
velocidad: es su visita 0.

#### Por qué la línea base no puede quedar abierta

Las visitas no se cierran en orden (hallazgo 3). Si la primera lectura de P-07
está en la visita 2, abierta, y la visita 3 ya se cerró, editar la lectura de la
visita 2 cambia la línea base de P-07. Con ella cambia el acumulado que el
panel, el informe y el Excel **recalculan en vivo** para la visita 3, que es
inmutable. La historia cerrada se movería sin tocar ninguna fila cerrada.

Se descartaron dos alternativas:

- **Tomar la línea base de la primera visita cerrada con lectura** no lo
  resuelve: si después se cierra la visita 2, la línea base salta a ella y la
  visita 3 vuelve a cambiar, esta vez al cerrar.
- **Obligar a cerrar todas las visitas en orden** lo resuelve, pero cambia el
  comportamiento de todos los lugares por un caso que solo afecta a los puntos
  sin C0.

La regla de cierre elegida es la mínima que garantiza el invariante: **una
visita cerrada que mide un punto sin C0 tiene cerrada también la línea base de
ese punto.** La línea base es la lectura más antigua del punto, así que ninguna
lectura anterior puede aparecer después. Una visita nueva solo se crea con
fecha posterior a la última, y una visita abierta no puede moverse antes de su
predecesora. Desde ese cierre, la línea base es inmutable.

### Diferenciales sobre el periodo común

Cada punto tiene una **línea base: una cota y una fecha**.

| Punto | Cota de línea base | Fecha de línea base |
|---|---|---|
| Con C0 tecleada | La C0 | La de la **primera visita del lugar**: la C0 es la cota de la visita 0 (decisión #14 de la Fase 5), aunque el punto no se midiera ese día |
| Sin C0 | Su primera lectura | La de su primera lectura |

Para cada par A, B de la última visita, `t0` es la **más tardía** de las dos
fechas de línea base. El asentamiento de **cada** punto se mide desde `t0`, con
una sola fórmula para los dos:

```
asentamiento desde t0 = cota_última − cota_en_t0

cota_en_t0 = cota de línea base     si la línea base del punto es t0
           = su lectura en la visita de fecha t0     si no
```

Si un punto no tiene lectura en la visita de fecha `t0`, **el par queda fuera**,
igual que hoy queda fuera un par sin coordenadas. Las fechas de visita son
únicas por lugar (la captura exige que cada una sea posterior a la anterior),
así que «la visita de fecha `t0`» está bien definida.

Cuando las dos fechas coinciden, `cota_en_t0` es la línea base de ambos y la
fórmula da `|acumA − acumB|`: exactamente lo de hoy. Es el caso de todos los
puntos originales y de los 35 valores verificados de la Fase 5.

Una versión anterior de esta sección usaba «su acumulado» para el punto con
línea base en `t0`. Eso es falso para un punto con C0 que no se midió en la
visita 0: su acumulado cuenta desde la C0, no desde `t0`, y volvía a mezclar
periodos. La fórmula única evita tener dos casos que puedan divergir.

### Efecto sobre los puntos existentes sin C0

La decisión 1 tiene un efecto retroactivo, aceptado al abrir la fase. Un punto
**original** sin C0, que hoy muestra «—» en el acumulado, pasa a mostrar su
acumulado contra su primera lectura. Pasa en:

- **Panel, informe y Excel**, que recalculan en vivo, también para las visitas
  cerradas.
- **`alert_status` persistido de las visitas abiertas**, que lee el hub del
  proyecto. Se reescribe al guardar la visita o con el script de abajo.
- **`alert_status` persistido de las visitas cerradas**, que **no cambia**: el
  trigger lo impide y `resyncSiteReadings` ya declara que una visita cerrada
  conserva la clasificación con la que se cerró.

No se pierde información: donde había «—» aparece un valor.

**Script de resincronización.** `scripts/resincronizar-asentamientos.mjs`
recorre los lugares abiertos, cuenta los puntos sin C0 y, por cada lugar,
reescribe sus visitas abiertas con `computeHistory`, **la misma función del
motor**, nunca SQL que la imite (aprendizaje de la Fase 9). Por defecto solo
simula e informa; con `--aplicar`, escribe. Sigue el patrón de
`scripts/reparar-resultados-estacion.mjs`.

## Superficie

### Catálogo de puntos (`points-catalog.tsx`)

- Columna **Estado**: «Vigente», «Alta 15/04/2025» o «De baja desde
  15/05/2025», con el motivo debajo.
- Acción **«Dar de baja»**: abre un diálogo con fecha (por defecto, hoy) y
  motivo.
- Acción **«Deshacer baja»**, solo cuando se puede. Cuando ya no se puede, no
  se muestra el botón: se explica por qué.
- Un punto de baja **no tiene acción de editar**.
- Formulario de punto nuevo: la fecha de alta y la C0 se muestran según la regla
  «Dar de alta».
- El error de borrar un punto con lecturas cerradas propone la baja: «El punto
  tiene lecturas en visitas cerradas y no puede eliminarse. Si el BM se perdió
  o se destruyó, dalo de baja».

### Editor de visita (`visit-editor.tsx`, `readings-table.tsx`)

- Filas solo para los puntos **vigentes** en la fecha de la visita.
- Debajo de la tabla, una nota con los que no se miden: «No se miden en esta
  visita: P-05 (de baja desde 15/05/2025)». Así la ausencia no parece un
  olvido.
- Al cambiar la fecha de una visita abierta, las filas se recalculan en vivo.

### Panel del lugar

- En el selector de la gráfica, los puntos de baja salen con la marca «(de
  baja)» y los de alta con su fecha. Siguen seleccionables: su serie es
  historia válida.
- El semáforo y los diferenciales no cambian de forma: el cambio es de
  contenido, por la regla del periodo común.

### Informe imprimible

- El recuento de puntos distingue los de baja: «7 puntos (1 de baja: P-05,
  desde 15/05/2025)».
- Si hay puntos de alta, una nota bajo la tabla: «El acumulado de P-07 se mide
  desde su alta (15/04/2025)».

### Excel (`settlement-workbook.ts`)

La tabla del catálogo gana tres columnas: **Alta**, **Baja** y **Motivo de
baja**.

## Refactor necesario: un solo constructor de `PointInput`

La fila de `settlement_points` se traduce a `PointInput` en **seis sitios**
(panel, export, editor de visita, `loadContext`, informe y `settlement-sync`),
cada uno con su propio `Number(...)` y su propio `null`. Esta fase añade dos
campos a `PointInput`. Añadirlos en seis copias es la receta del cierre de
la Fase 9: una función implementada y no cableada en uno de los sitios, que
ningún test ve.

Se extrae `pointInputOf(row)` junto a `thresholdsOf`, que ya hace lo mismo con
los umbrales en `tolerances.ts`. Los seis sitios pasan a llamarla. La demo
(`insertar-asentamiento.ts`) construye desde su fixture, no desde una fila:
solo gana los dos campos nuevos en `null`.

## Seed

«Edificio Torre Central» (`scripts/seed.mjs`, el lugar abierto que usan las
capturas) gana los dos casos:

- **P-05 de baja** después de la visita 3, con el motivo «Destruido por la
  obra del andén sur». Tiene lecturas en visitas cerradas: es el caso del
  hallazgo 1.
- **P-07 de alta** en la visita 3, sin C0, con una serie propia. Ejercita la
  línea base por primera lectura y los diferenciales sobre el periodo común.

Las cotas, parciales y alertas del seed los sigue calculando `computeHistory`,
no el fixture.

**Fuera:** el fixture del proyecto demo (`src/lib/demo/fixtures.ts`), que es un
lugar cerrado y no necesita estos casos para verse completo.

## Archivos

| Archivo | Qué cambia |
|---|---|
| `supabase/migrations/<ts>_estado_bms.sql` | Columnas, CHECKs y trigger de lecturas fuera de vigencia |
| `src/types/database.ts` | Regenerado |
| `src/types/settlement.ts` | `PointInput` gana `activeFrom` y `retiredOn` |
| `src/lib/calculations/settlement.ts` | `isPointActiveOn`, línea base por primera lectura, diferenciales sobre el periodo común |
| `src/lib/calculations/tolerances.ts` | `pointInputOf` junto a `thresholdsOf` |
| `src/lib/validators/settlement.ts` | Vigencia en captura y cierre; `validateRetirement`, `canUndoRetirement`, `validateActiveFrom` como funciones puras |
| `src/app/(app)/projects/[id]/sites/[siteId]/point-actions.ts` | `retirePointAction`, `undoRetirementAction`, alta en `createPointAction`, bloqueo de edición, mensaje de borrado |
| `src/components/settlement/points-catalog.tsx` | Estado, acciones y formulario |
| `src/components/settlement/visit-editor.tsx` + `readings-table.tsx` | Filas por vigencia y nota de ausentes |
| `src/components/settlement/settlement-chart.tsx` | Marcas en el selector |
| `src/app/(app)/projects/[id]/reports/[reportId]/print/page.tsx` | Recuento y nota de alta |
| `src/lib/export/settlement-workbook.ts` | Tres columnas del catálogo |
| Los seis constructores de `PointInput` desde una fila | Pasan a `pointInputOf` |
| `scripts/seed.mjs` | P-05 de baja y P-07 de alta |
| `scripts/resincronizar-asentamientos.mjs` | Nuevo |
| `src/app/(app)/manual/` + `docs/manual/README.md` | Sección nueva, en el mismo commit |
| `docs/testing/manual-e2e-asentamientos.md` | Pasos de baja, deshacer, alta y cierre |
| `docs/tecnica/README.md` | Modelo de datos, reglas y estado de fases |

## Pruebas

**Suite existente:** 492 tests.

**Nuevas, como mínimo:**

| Qué | Casos |
|---|---|
| `isPointActiveOn` | Original; antes, en y después del alta; antes, en y después de la baja (la fecha de baja ya no está vigente) |
| Línea base | Punto sin C0: primera lectura con acumulado 0 y sin parcial; lecturas siguientes contra ella. Punto con C0: sin cambios. Primera lectura en una visita abierta **anterior** a otra ya calculada: el orden es de fecha, no de captura |
| Diferenciales | Misma línea base: igual que hoy (los 35 valores de la Fase 5). Líneas base distintas: periodo común, con el valor a mano. **Punto con C0 que no se midió en la visita 0**, emparejado con uno de alta: se mide desde `t0`, no desde la C0. Sin lectura en `t0`: el par queda fuera |
| `validateVisitClose` | No exige el punto de baja. No exige el de alta en una visita anterior a su alta. Sí exige el de alta en una posterior. **Rechaza** cerrar la visita 3 si la visita 2, abierta, tiene la primera lectura de un punto sin C0 que la 3 mide. **Acepta** el mismo caso si el punto tiene C0 |
| `validateVisitCapture` | Lectura de un punto de baja en una visita posterior: error. Cambiar la fecha de la visita hasta sacarla de la vigencia: error |
| `validateRetirement` | Fecha no posterior a la última lectura: rechazo. Sin motivo o motivo en blanco: rechazo. Antes del alta: rechazo |
| `canUndoRetirement` | Sin visitas cerradas posteriores: sí. Con una visita cerrada en la misma fecha de la baja: no (el límite es inclusivo) |
| `validateActiveFrom` | Fecha no posterior a la última visita cerrada: rechazo |
| `pointInputOf` | Convierte `numeric` de texto y respeta los `null` |

**Probar la ruta, no solo la función** (aprendizaje de la Fase 9): las reglas de
cierre se prueban por `validateVisitClose`, que es la puerta que usa
`closeVisitAction`, no por `isPointActiveOn` suelta.

**Contra la base, después del seed:** consultar que ninguna lectura de P-05 cae
después de su `retired_on`, y comprobar por SQL directo que **fallan las tres
escrituras** que romperían la vigencia:

1. `insert` de una lectura de P-05 en una visita posterior a su baja;
2. `update` de `retired_on` de un punto a una fecha anterior a una de sus
   lecturas;
3. `update` de `date` de una visita abierta a una fecha anterior al alta de
   P-07, que tiene lectura en ella.

Y que **sí pasan** los bordes: una lectura en la fecha exacta del alta y una
baja con fecha el día siguiente a la última lectura.

**En pantalla, antes de cerrar:**

1. Catálogo con un punto vigente, uno de alta y uno de baja. Diálogo de baja.
   «Deshacer baja» visible cuando se puede y explicado cuando no.
2. Editor de una visita posterior a la baja: sin la fila de P-05 y con la nota.
3. Editor de una visita anterior al alta: sin la fila de P-07.
4. Cerrar una visita con P-05 de baja: cierra.
5. Panel: gráfica con la serie de P-05 cortada y la de P-07 empezando en 0.
   Diferenciales con pares de P-07.
6. Informe imprimible y Excel.
7. La ruta `/manual`.

## Criterios de aceptación

1. Un punto se da de baja con fecha y motivo, sin borrar ninguna lectura.
2. Una visita posterior a la baja se cierra sin lectura del punto dado de baja.
3. La baja se deshace si ninguna visita cerrada tiene fecha igual o posterior;
   si no, se rechaza nombrando la visita.
4. Un punto de baja no se puede editar.
5. Un punto de alta se crea sin C0 y con fecha de alta posterior a la última
   visita cerrada; su primera lectura es su línea base (acumulado 0).
6. Una visita anterior al alta se cierra sin lectura del punto nuevo.
7. Los diferenciales entre puntos con líneas base distintas se calculan sobre el
   periodo común, o el par queda fuera si falta la lectura en `t0`.
8. Una lectura fuera de vigencia la rechaza el validador **y** la base, por
   cualquiera de las tres escrituras que podrían crearla: la lectura, las
   fechas del punto o la fecha de la visita.
9. Un punto original sin C0 tiene acumulado contra su primera lectura.
   Una visita que lo mide no se cierra mientras su línea base esté en una
   visita anterior abierta.
10. `PointInput` se construye en un solo sitio (`pointInputOf`).
11. El catálogo, el editor de visita, la gráfica, el informe y el Excel muestran
    el estado.
12. El script de resincronización simula por defecto y usa `computeHistory`.
13. `npm run typecheck`, `npm run lint` y `npm test` pasan limpios, con los
    tests nuevos sumados a los 492.
14. Manual actualizado en sus dos copias, en el mismo commit, con capturas
    regeneradas.
15. Doc técnica actualizada: modelo de datos, reglas de vigencia, estado de
    fases y § 11.
16. `docs/testing/manual-e2e-asentamientos.md` cubre baja, deshacer, alta y
    cierre.

## Fuera de alcance

- **Reactivar una baja definitiva.** Decisión 2: un BM reencontrado entra como
  punto nuevo.
- **Historial de cambios de estado** en una tabla aparte. Con la baja
  reversible solo para corregir, las tres columnas bastan.
- **A1 (alerta por lectura desfasada)**, que es la Fase 12. Esta fase le deja
  definida la serie: dónde empieza y dónde acaba cada punto.
- **El aviso de verosimilitud de 1 m sin C0.** `validateReadingCapture` solo lo
  evalúa contra la C0 tecleada. Evaluarlo contra la primera lectura necesita el
  histórico en el validador de captura, que hoy no lo recibe.
- **Bloquear la edición de la C0 de un punto vigente con lecturas cerradas.**
  Reescribe la historia cerrada igual que en un punto de baja, pero es la
  deuda general del catálogo, no de esta fase. Se registra en la § 11.
- El fixture del proyecto demo.

## Riesgos

- **El cambio de línea base es retroactivo** para los puntos originales sin C0.
  Aceptado al abrir la fase. Mitigación: el script simula antes de escribir e
  informa cuántos puntos afecta, y las visitas cerradas conservan su
  clasificación persistida.
- **Dos implementaciones de la vigencia divergirían.** La del predicado SQL
  (`point_active_on`, compartido por los tres triggers) y la de
  `isPointActiveOn` (TS) expresan la misma regla. Es la situación que la
  Fase 9 aprendió a temer, así que el criterio no es que el SQL «haga lo
  mismo»: un test contra la base prueba los bordes que importan, que la fecha
  de baja **ya no** es vigente y la fecha de alta **sí**, en los dos lados.
- **La regla del periodo común es nueva matemática** en una función que la
  Fase 5 verificó contra 35 valores del marco teórico. Esos casos tienen todos
  la misma línea base y deben seguir saliendo exactos: son la regresión.
- **Un punto de alta en la gráfica empieza en 0** a mitad del eje, al lado de
  series que llevan meses bajando. Es correcto, pero puede leerse mal.
  Mitigación: la fecha de alta en el selector y la nota del informe. Mirarlo en
  pantalla, no razonarlo.
