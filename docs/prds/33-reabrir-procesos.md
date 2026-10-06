# PRD-de-fase 34 — Reabrir procesos

**Estado:** cerrada
**Fecha de apertura:** 2026-10-03
**Fecha de cierre:** 2026-10-03

**Rama:** `fase-34-reabrir-procesos`
**Petición:** del usuario, 2026-10-03: «necesito poder reabrir procesos para
modificar». Al preguntarle en qué casos: «solo hazlo simple y fácil poder
editar aun cerrada, o cambiar el estado de cerrada a abierta en cualquier
momento».
**Módulo:** el ciclo de cierre de los tres módulos —poligonal, nivelación y
control de asentamientos (visita y lugar)—, la base, los informes y la
documentación.

> **Divergencias de la implementación:**
>
> - **`src/types/database.ts` sí cambia.** La comprobación vive en una función
>   SQL, `is_reopening(old_row, new_row)`, que usan los dos triggers. El
>   generador de tipos la lista en `Functions` (§ A decía que no cambiaba).
> - **El mensaje de la visita con el lugar cerrado** es «El lugar está
>   cerrado: reábrelo primero.», no «Reabre primero el lugar.» (§ B).
> - **Las Server Actions no tienen prueba propia**: la prueba Vitest es de la
>   lógica pura que aplican (`src/lib/reopen.ts`, 12 pruebas), como en
>   `close-status`. La base la cubre `reabrir_procesos.test.sql`, con 25.
> - **También se corrigió** el comentario de cabecera de
>   `validators/polygonal.test.ts` («El cierre es irreversible»).
> - **La revisión de código** no encontró nada crítico. Pidió tres casos pgTAP
>   más —reabrir una visita cambiando otra columna o sin borrar el registro de
>   cierre, y un rechazado que pasa a cerrado sin reabrirse—, que se vieron
>   fallar con un `is_reopening` laxo antes de pasar con el real. También
>   encontró una frase del manual que se contradecía con el botón nuevo y una
>   errata de la doc técnica. Lo que quedó sin hacer se corrigió después del
>   merge (abajo).
> - **Correcciones tras el merge** (2026-10-05, a petición del usuario: los
>   diez hallazgos de una segunda revisión, rama `fase-34-correcciones`):
>   - el pie del informe consolidado dice qué se reabrió después de emitirlo,
>     en vez de «con procesos cerrados»;
>   - borrar desde el hub avisa de los informes que perderán la sección;
>   - `is_reopening` deja de estar expuesta a `anon`
>     (`20261005000000_reabrir_sin_anon.sql`, con su `db push`);
>   - reabrir poligonal y nivelación comparten
>     `src/lib/supabase/reopen-process.ts`, que pasa el error por
>     `logDbError`;
>   - reabrir una visita revalida su vista, y el diálogo ya no llama a
>     `router.refresh()`;
>   - el editor de poligonal se remonta al cerrar o reabrir: lo tocado en
>     solo lectura, como el formato de ángulo, no pasa al proceso abierto;
>   - los informes se piden una vez por página —la pestaña Informe los
>     recibe—, en paralelo en la del lugar, y el «cerrado» de las páginas
>     sale de `processReportState`.
>   - El manual también dice que lo cerrado se puede reabrir en la nota del
>     hub, que la revisión no había visto.
> - **Capturas:** cambian la 09, la 10, la 22 y la 30, por el botón en la
>   cabecera. La 30 trae además las fechas del seed actual.
> - **Verificación en pantalla** en local, a 1280 px y a 390 px: 32
>   comprobaciones, sin desborde ni errores de página. Cubren los criterios
>   a–h, reabrir dos veces desde dos pestañas y el diálogo en el móvil.
>   «Guardar» en lo reabierto no cambió ningún dato (hash de las filas antes y
>   después), y el registro de cierre original se restauró por SQL: la base
>   local la comparte la sesión de la Fase 33.

## Propósito

Hoy cerrar es **irreversible**: la base rechaza todo cambio sobre lo cerrado,
y el manual responde «No» a «Cerré un proceso por error. ¿Puedo reabrirlo?».
Un error de digitación detectado después del cierre obliga a crear el proceso
de nuevo.

La fase añade un botón **«Reabrir»**. Un proceso cerrado o rechazado, una
visita cerrada o un lugar cerrado vuelve a quedar abierto y editable, en
cualquier momento, y se vuelve a cerrar con el cierre de siempre.

**Cerrado sigue significando «no se edita»**: mientras algo está cerrado, la
base lo protege igual que hoy. Lo único nuevo es poder salir de ese estado.

## Hallazgos que condicionan la fase

### 1. «Un proceso cerrado no vuelve atrás» lo escribe la base

`reject_update_on_closed_process()` (nivelación, lugares y visitas) y
`reject_update_on_closed_polygonal_process()` (poligonal, con la lista blanca
de posición de la Fase 15) rechazan **todo** UPDATE de una fila con
`old.status` en `closed`/`rejected`. Hoy reabrir es imposible aunque la app lo
intente.

Cerrar escribe solo tres columnas: `status`, `closed_at` y `closed_by`. Así
que reabrir es exactamente lo contrario, y el trigger puede reconocerlo con el
mismo patrón de la Fase 15: comparar la fila sin esas columnas.

Los demás triggers no necesitan cambios:

| Trigger | Qué mira | Al reabrir |
|---|---|---|
| Estaciones, lecturas de nivelación y de visita, libreta | El estado **actual** del padre | Se pueden editar en cuanto el padre se reabre |
| Visitas y lecturas de un lugar cerrado | `sites.status` | Igual: se reabre el lugar y vuelven a ser editables |
| C0 con lecturas cerradas (Fase 23) | Si hay lecturas en alguna visita `closed` | Se libera cuando ya no queda ninguna visita cerrada que mida el punto |
| Borrar un cerrado | `old.status` | Un reabierto se puede borrar, como cualquier abierto |

### 2. Los informes se reconstruyen en vivo

`reports` guarda la portada y la lista de procesos, no sus datos: el
contenido se rehace en cada visita. Hasta hoy era seguro porque solo incluye
procesos cerrados, que no cambian. Si un proceso que está en un informe
emitido se reabre y se modifica, **el informe cambia sin avisar**.

`reportsIncluding` (Fase 22) ya sabe en qué informes está cada proceso: es lo
que lista la pestaña Informe.

Mientras el proceso siga abierto, el «Registro de cierre» del informe lo
muestra con «—» en «Cerrado» y en «Responsable». Es lo que hace hoy con un
dato que falta, así que no hay que tocarlo.

### 3. Las visitas se cierran en orden

Desde la Fase 26 (C-15), una visita no se cierra si la visita contra cuyas
lecturas se calcula sigue abierta: así lo cerrado no cambia por debajo.
Reabrir una visita anterior deshace esa garantía para las posteriores
cerradas: si se corrigen sus lecturas, cambian el parcial, la velocidad y la
alerta de la siguiente. Es la misma situación que la del informe (hallazgo 2),
y se resuelve igual (decisión 8).

### 4. El manual y el PRD dicen lo contrario

«Cierre irreversible» (manual § 6.8 y § 8), la pregunta frecuente, el § 4.6
del PRD principal («a partir de ese momento: todos los campos son de solo
lectura»), la regla de `CLAUDE.md` («Nunca generar UPDATE sobre un proceso
cerrado») y varios comentarios («seguro porque solo incluye procesos
cerrados») dejan de ser ciertos.

### 5. Otra fase está abierta

La Fase 33 (header compacto) está en curso en la carpeta principal, con
cambios de otra sesión. Esta fase se trabaja en un worktree aparte, con su
rama desde `main`. La 33 no toca datos y esta no toca el header. Los únicos
choques previsibles son las tablas de estado de `method.md`,
`prds/README.md`, el final de `pendientes.md` y, quizá, alguna página que pase
`actions` a `ProcessShell`. Todos se resuelven a mano en el merge.

## Decisiones

| # | Decisión | Por qué |
|---|---|---|
| 1 | **Reabrir**, no editar estando cerrado | El usuario aceptó las dos. Con «editar aun cerrada», un proceso diría «cerrado» con datos y veredicto que ya no son los que se cerraron |
| 2 | **Los informes se actualizan, con aviso** | Decisión del usuario. Se puede reabrir siempre; el diálogo dice en qué informes está y que mostrarán los datos nuevos |
| 3 | **Sin historial ni motivo** | El usuario pidió «simple y fácil». Reabrir borra `closed_at` y `closed_by`; volver a cerrar los escribe de nuevo |
| 4 | **Los cuatro**: poligonal, nivelación, visita y lugar | «En cualquier momento» |
| 5 | Al reabrir, el estado vuelve a **`calculated`** (proceso y visita) o **`active`** (lugar) | Los resultados guardados son los del último cálculo, y el cierre exige `calculated`: se puede volver a cerrar sin guardar |
| 6 | Una visita de un lugar cerrado **se reabre después del lugar** | El trigger del lugar ya rechaza escribir sus visitas. El diálogo lo dice y no deja confirmar |
| 7 | Reabrir el lugar **no reabre sus visitas** | Las cerradas siguen cerradas; cada una se reabre aparte. Las que estaban abiertas vuelven a ser editables |
| 8 | Reabrir una visita con visitas posteriores **se permite, con aviso** | Es la decisión 2 aplicada a las visitas (hallazgo 3). Exigir reabrir antes las posteriores no sería «en cualquier momento» |
| 9 | La base admite **solo la transición**: un UPDATE que reabre no cambia ninguna otra columna | Reabrir y modificar en una sola escritura saltaría el estado abierto. Primero se reabre y después se edita, como cualquier abierto |
| 10 | Es la **Fase 34**; la cartera real de asentamientos pasa a ser la **35** | Elección del agente: el usuario no tuvo preferencia entre empezar ya o esperar |

## Alcance

### A. Base de datos

Migración `supabase/migrations/20261003000000_reabrir_procesos.sql`:

- **`reject_update_on_closed_process()`** —nivelación, lugares y visitas—:
  si `old.status` es `closed`/`rejected`, deja pasar el UPDATE cuando
  - `new.status` ya no es `closed`/`rejected`,
  - `new.closed_at` y `new.closed_by` son null, y
  - la fila sin `status`, `closed_at`, `closed_by` ni `updated_at` es igual a
    la de antes.

  Cualquier otro UPDATE sigue rechazado con el mismo mensaje.
- **`reject_update_on_closed_polygonal_process()`**: la misma rama, antes de
  la comprobación de posición de la Fase 15, que no cambia.
- Los `CHECK` de `status` ya limitan a qué estado se vuelve. No hace falta una
  función RPC: es un UPDATE de una sola fila.

Ninguna columna nueva, así que `src/types/database.ts` no cambia.

### B. Server Actions

| Acción | Archivo | Comprueba | Escribe |
|---|---|---|---|
| `reopenPolygonalProcessAction(processId)` | `polygonal/[pid]/actions.ts` | Sesión; existe; está `closed`/`rejected` | `status: "calculated"`, `closed_at: null`, `closed_by: null` |
| `reopenLevelingProcessAction(processId)` | `leveling/[pid]/actions.ts` | Igual | Igual |
| `reopenVisitAction(siteId, visitId)` | `settlement/[siteId]/actions.ts` | Sesión; existe; está `closed`; **el lugar está abierto** («Reabre primero el lugar.») | Igual |
| `reopenSiteAction(siteId)` | `sites/actions.ts` | Sesión; es un lugar de asentamientos; está `closed` | `status: "active"`, `closed_at: null`, `closed_by: null` |

Cada una revalida la pantalla del proceso y el hub del proyecto, como el
cierre. El `project_id` sale de la fila, no del cliente, como en el resto.

### C. Pantallas

- **`ReopenDialog`** (`src/components/process/reopen-dialog.tsx`), un
  componente para los cuatro casos:
  - un botón secundario **«Reabrir»** abre un `Modal` con título «Reabrir
    proceso», «Reabrir visita» o «Reabrir lugar»;
  - un texto dice qué pasa: vuelve a ser editable, se borra su registro de
    cierre y deja de contar como cerrado hasta que se cierre otra vez;
  - si está en informes consolidados, un aviso los nombra: «Está en 2
    informes consolidados: «…», «…». Mostrarán los datos nuevos, sin fecha
    de cierre mientras siga abierto.»;
  - si hay un bloqueo (decisión 6), el aviso lo dice y «Reabrir» queda
    desactivado;
  - recibe la acción como prop, para que el diálogo no sepa de módulos.
- **Dónde va el botón:**
  - **poligonal y nivelación**: en `actions` de `ProcessShell`, cuando el
    proceso está `closed` o `rejected`. La página calcula los informes con
    `getReports` y `reportsIncluding`;
  - **lugar**: en `actions` de `ProcessShell`, donde hoy está «Nueva visita»,
    que solo sale con el lugar abierto. Si está cerrado sale «Reabrir», con
    sus informes;
  - **visita**: en la cabecera de `VisitView`, cuando está cerrada. Si el
    lugar está cerrado, el diálogo lo dice y no deja reabrir. Si no es la
    última visita, avisa: «Las visitas posteriores se calculan contra sus
    lecturas: si las cambias, cambian también sus resultados.» (decisión 8).

Tras reabrir, `revalidatePath` vuelve a renderizar el editor, ya editable,
como pasa hoy al cerrar.

### D. Documentación y comentarios

- **PRD principal § 4.6**: enmienda (Fase 34). **`CLAUDE.md`**: la regla de
  inmutabilidad pasa a tener dos excepciones —la posición de la Fase 15 y
  reabrir—.
- **Manual, en sus dos copias**:
  - § 6.8 y § 8 dejan de decir «irreversible»;
  - § 7.6 explica reabrir una visita y el lugar;
  - § 10 avisa de que reabrir cambia los informes que lo incluyen;
  - la pregunta frecuente responde «Sí: botón **Reabrir**»;
  - se regeneran las capturas que cambian: al menos la 09 (proceso cerrado)
    y la 10 (rechazado), que muestran ahora el botón.
- **Doc técnica**:
  - «Inmutabilidad de procesos cerrados» explica la transición;
  - la sección de informes deja de decir que son siempre iguales;
  - el estado de fases y la tabla de pruebas;
  - la § 11, entrada por entrada.
- **Comentarios que dejan de ser ciertos**:
  - la página imprimible del informe;
  - `eligibility.ts`;
  - `process-report.tsx` («ya no cambia»);
  - los diálogos de cierre («irreversible»);
  - el texto de los diálogos de cierre, que hoy dice «queda de solo lectura».

  No se tocan las migraciones ya aplicadas: son históricas.
- **`pendientes.md`**: la petición, como resuelta en esta fase.

## Fuera de alcance

- Historial de reaperturas, motivo obligatorio y quién reabrió.
- Versiones o copias congeladas de los informes.
- Reabrir desde la lista del hub del proyecto: el botón está en la pantalla
  del proceso.
- Reabrir un informe consolidado: no tiene estado, se borra y se genera otro.

## Criterios de aceptación

| # | Criterio |
|---|---|
| a | Una poligonal cerrada se reabre, se edita, se guarda y se vuelve a cerrar |
| b | Lo mismo con una poligonal rechazada, que puede volver a cerrarse como cerrada si los nuevos datos cumplen |
| c | Una nivelación cerrada se reabre, se edita y se vuelve a cerrar |
| d | Una visita cerrada de un lugar abierto se reabre, se edita y se vuelve a cerrar |
| e | Con el lugar cerrado, el diálogo de una visita cerrada dice que se reabra primero el lugar y no deja confirmar; la acción también lo rechaza |
| f | Un lugar cerrado se reabre: admite visitas nuevas y sus visitas cerradas siguen cerradas |
| g | El diálogo nombra los informes consolidados que incluyen el proceso o el lugar, y no muestra el aviso si no hay ninguno |
| h | Un informe que incluye un proceso reabierto muestra sus datos actuales y «—» en su registro de cierre |
| i | Lo cerrado sigue sin poder modificarse ni borrarse: la base rechaza cualquier UPDATE que no sea exactamente reabrir |
| j | `typecheck`, `lint`, `npm test` y `npx supabase test db` pasan |

## Pruebas mínimas

- **pgTAP** (`supabase/tests/reabrir_procesos.test.sql`), en las cuatro
  tablas:
  - reabrir funciona;
  - reabrir cambiando además otra columna falla;
  - un UPDATE normal sobre lo cerrado sigue fallando;
  - borrar lo cerrado sigue fallando;
  - tras reabrir, los hijos (estaciones, lecturas) se pueden escribir;
  - reabrir una visita de un lugar cerrado falla;
  - en poligonal, la georreferenciación de un cerrado sigue funcionando.
- **Vitest** (`src/lib/reopen.test.ts`): las reglas y los textos de
  reabrir —el estado al que vuelve cada uno, cuándo se puede y el aviso de
  los informes—. Las Server Actions del proyecto no se prueban con la base
  simulada: la prueba es de la lógica pura que aplican, como `close-status`.
- **En pantalla**, en local: los criterios a–h, a 1280 px y a 390 px.

## Despliegue

La migración solo reemplaza dos funciones: no añade ni borra columnas.

| Combinación | Resultado |
|---|---|
| Código viejo + esquema nuevo | Funciona: el código viejo nunca reabre |
| Código nuevo + esquema viejo | «Reabrir» falla con el error del trigger |

Por eso va el orden de siempre: **`db push` antes del merge**, con el visto
bueno del usuario.

## Riesgos

1. **Un informe entregado cambia si se reabre lo que incluye.** Es la
   decisión 2; el diálogo lo avisa. El PDF que ya se descargó no cambia.
2. **Un trigger demasiado laxo.** Si la comparación de la fila olvidara una
   columna, se podría modificar lo cerrado al reabrir. La prueba pgTAP
   «reabrir cambiando otra columna falla» lo cubre en las cuatro tablas.
3. **El orden de los triggers.** `set_updated_at` dispara después del de
   inmutabilidad (orden alfabético). `updated_at` va en la lista de columnas
   ignoradas, como en la Fase 15, para no depender de ese orden.
