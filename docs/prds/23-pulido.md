# PRD-de-fase 24 — Pulido

**Estado:** en curso
**Fecha de apertura:** 2026-09-30

**Rama:** `fase-24-pulido`
**Petición:** del usuario, 2026-09-30, tras revisar los pendientes: «Sí, Fase
24 de pulido» con la deuda visible de la § 11 y lo que encontró la puesta al
día de la documentación (PU1 a PU10 en `pendientes.md`).
**Módulo:** transversal — tabla de estaciones, nivelación y libreta de la
visita, dashboard, informe del proceso, Excel y pantallas de alta

## Propósito

Diez detalles que un usuario nota y que no merecían una fase cada uno. Dos no
son cosméticos: una lectura de ángulo con 65″ se **guarda con 65 segundos**
(PU9), y el dashboard pide revisar un lugar **ya cerrado** (PU7). El resto es
coherencia de la interfaz y accesibilidad.

## Decisiones del usuario (apertura)

1. **PU9, segundos y minutos de cada lectura: validador y CHECK en la base.**
   El editor y la Server Action rechazan una lectura con minutos o segundos
   fuera de 0–59, y un CHECK en `polygonal_angle_readings` lo garantiza aunque
   se salten la acción. Hoy hay 0 filas fuera de rango en producción y en
   local.
2. **PU7, el KPI «Fuera de tolerancia» cuenta lugares con alerta en una visita
   abierta.** Como poligonales y nivelaciones, que solo cuentan lo calculado
   pendiente de cerrar.
3. **PU4, la tarjeta del proyecto:** «6 procesos · 3 en curso · 2 cerrados · 1
   rechazado». «En curso» reúne borrador, en progreso y calculado, y los
   lugares activos. Se omiten los grupos en cero.
4. **PU10, V− vacía en un punto de cambio:** se puede guardar —capturar a
   medias es legítimo—, la celda avisa «Falta la V−» y el cierre nombra la
   fila en vez del mensaje aritmético genérico.

## Hallazgos que condicionan la fase

### 1. PU1 ya está resuelto en el código

`formatPrecision` (`lib/utils/format.ts`) es el único formateador de la
precisión relativa y lo usan el hub, el editor, el veredicto, el diálogo de
cierre, el informe y el Excel. El «`1:1001` en el listado y `1:1.001` en el
editor» de la § 11 es de antes de unificarlo. Lo que queda es guardar el número
en vez de la cadena, y **no conviene**: la columna está en procesos cerrados
—habría que desactivar la inmutabilidad para migrarla— y `parsePrecision` ya
ordena bien. PU1 se cierra corrigiendo la § 11.

### 2. PU9 escribe datos fuera de rango

La lectura se convierte a decimal (`readingValues`), se promedia y el promedio
se normaliza (`averageOf` → `decimalToDms`). `validatePolygonalStation` mira
ese promedio, que ya llega con 1′05″, y la regla «Los segundos deben estar
entre 0 y 59» nunca salta. El servidor revalida lo mismo y guarda las lecturas
**crudas** en `polygonal_angle_readings`, que no tiene CHECK: la fila queda
con `angle_sec = 65`. El cálculo no se equivoca —el decimal es el mismo—, pero
la base guarda un DMS que ningún topógrafo anotaría, y un error de tecleo
(65 por 56) pasa sin aviso.

### 3. PU3 abarca toda la fila de escritorio

En la tabla de estaciones de escritorio no tienen nombre accesible el código,
las lecturas de ángulo, el sentido de la deflexión ni la distancia. La vista de
tarjetas (móvil) sí los tiene («Código de la estación N», «Sentido»,
«Distancia (m)»).

### 4. PU8 necesita un tercer estado

`ProcessReport` recibe `closed: boolean`, y las páginas pasan
`status === "closed"`: un rechazado cae en «no cerrado» y lleva la marca
«Borrador — el informe se emite al cerrar el proceso». No basta con incluir
`rejected` en `closed`: el botón «Generar un informe consolidado con este
proceso» también cuelga de `closed`, y un rechazado no puede entrar en un
informe consolidado.

### 5. PU10 afecta también a la libreta de la visita

La libreta de asentamientos valida con el mismo `validateRunCapture`, así que
el aviso y el motivo de cierre valen en los dos sitios.

## Alcance

### PU2 y PU3 · La tabla de estaciones de escritorio

- El campo de código se ensancha para códigos como «Famarena_5» sin cortar.
- Nombre accesible en cada campo de la fila, con el número de estación, igual
  que en la vista de tarjetas: código, cada lectura de ángulo, sentido y
  distancia.

### PU4 · Conteo por estado en la tarjeta del proyecto

`getProcessCountsByProject` devuelve el conteo por grupo —en curso, cerrados,
rechazados— y una función pura arma el texto «6 procesos · 3 en curso · 2
cerrados · 1 rechazado», con singulares y sin grupos en cero. Un lugar activo
cuenta como en curso y uno cerrado como cerrado.

### PU5 · El Excel con la paleta de la identidad

`lib/export/workbook.ts`: títulos en `ink` (#1C2427), cabeceras con relleno
`sel` (#EEF3F2) y borde `rule-strong` (#838B8C), texto secundario en `ink-2`
(#56636A). El Excel no tiene tema oscuro.

### PU6 · Esqueletos de carga en las altas y hover de la tarjeta

`loading.tsx` en `projects/new` y en los `new` de poligonal, nivelación, lugar
e informe, con el `Skeleton` del sistema de diseño. La tarjeta de proyecto gana
el fondo `sel` al pasar el cursor, como las filas del hub.

### PU7 · «Fuera de tolerancia» solo con visitas abiertas

La rama de asentamientos del KPI cuenta lugares con alguna lectura en alerta o
alarma **en una visita calculada** (abierta). Un lugar cerrado, o una alerta
de una visita ya cerrada, no pide revisión.

### PU8 · El informe de un proceso rechazado

La pestaña Informe distingue tres estados: sin cerrar («Borrador — el informe
se emite al cerrar el proceso»), cerrado (sin marca, con el botón de informe
consolidado) y **rechazado**: marca «Rechazado — el proceso no alcanzó la
tolerancia; queda como constancia y no entra en informes consolidados», fecha
de cierre y sin botón de informe consolidado.

### PU9 · Minutos y segundos de cada lectura

- `validateReadings` (o una regla hermana) marca cada lectura con minutos o
  segundos fuera de 0–59 y grados fuera de 0–359, con el mismo mensaje que la
  estación. En grados decimales, fuera de [0, 360).
- `savePolygonalProcessAction` lo revalida y rechaza el guardado.
- Migración: `CHECK` en `polygonal_angle_readings` (`angle_deg` 0–359,
  `angle_min` 0–59, `angle_sec` ≥ 0 y < 60). Antes de aplicarla en la nube se
  vuelve a contar que no haya filas fuera de rango.

### PU10 · Punto de cambio sin V− (o sin V+)

- `validateReadingCapture`: una fila `pc` con V+ y sin V−, o con V− y sin V+,
  lleva el **aviso** «Falta la V−» / «Falta la V+». Es aviso, no error: no
  bloquea el guardado.
- `evaluateLevelingClosure` y el cierre de la visita con libreta: si hay un
  punto de cambio incompleto, el mensaje que bloquea nombra la fila («El punto
  de cambio de la fila 4 no tiene V−») en lugar de «La comprobación aritmética
  no cuadra».

### PU1 · Documentación

La entrada de `relative_precision` en la § 11 se reescribe: la presentación ya
es una, y no se migra la columna (hallazgo 1).

## Decisiones

| # | Decisión | Razón |
|---|---|---|
| 1 | No migrar `relative_precision` a número | Está en procesos cerrados y `parsePrecision` ya ordena; el beneficio no paga romper la inmutabilidad |
| 2 | PU9 con CHECK además del validador | Misma regla que la Fase 23: la acción da el mensaje, la base garantiza el dato |
| 3 | PU10 como aviso en la celda | Capturar a medias es legítimo; lo que falla es el mensaje de cierre, no el guardado |
| 4 | PU8 con un tercer estado, no ampliando `closed` | El botón de informe consolidado depende de «cerrado conforme», que un rechazado no es |
| 5 | Colores del Excel copiados de los tokens del tema claro | El Excel no lee CSS; una constante por token, con el nombre del token al lado |

## Pruebas

| Qué | Cómo |
|---|---|
| PU9 | Tests del validador: 65″, 60′, 360° y los límites 59.9″ y 0; el servidor rechaza; pgTAP: el CHECK rechaza y admite los límites |
| PU10 | Tests de `validateReadingCapture` (aviso en `pc` incompleto, nada en BM inicial ni intermedias) y del motivo de cierre, en nivelación y en la libreta |
| PU4 | Test de la función que arma el texto: singulares, grupos en cero, solo lugares |
| PU8 | Render de la marca en los tres estados |
| PU2 y PU3 | Render de la fila de escritorio: cada campo con su nombre accesible |
| PU5 | Test del libro: colores de título y cabecera |
| PU7 y PU6 | En pantalla: el dashboard de la demo marca 0 fuera de tolerancia; las altas muestran su esqueleto |

**En pantalla (local), claro y oscuro, 1280 y 390 px:** la tabla de estaciones
con «Famarena_5» entero, el aviso de 65″, la tarjeta del proyecto, el
dashboard, el informe de un rechazado, una nivelación con un PC sin V−, y un
Excel abierto.

## Criterios de aceptación

1. Ninguna lectura de ángulo con minutos o segundos fuera de rango se guarda,
   ni desde la interfaz ni en la base.
2. El dashboard no pide revisar lugares cerrados ni alertas de visitas
   cerradas.
3. La tarjeta del proyecto desglosa por estado; el informe de un rechazado no
   dice «Borrador».
4. Un punto de cambio incompleto avisa en la celda y el cierre dice qué fila.
5. La tabla de estaciones de escritorio no corta códigos y cada campo tiene
   nombre accesible; el Excel usa la paleta actual; las altas tienen
   esqueleto.
6. `npm run typecheck`, `npm run lint`, `npm test`, `npx supabase test db` y
   `npm run build` limpios. Manual en sus dos copias y § 11 revisada.

## Fuera de alcance

- Migrar `relative_precision` a número.
- La guarda de cambios sin guardar en atrás y adelante del navegador.
- Unificar los dos diálogos que mueven una poligonal.
- Catálogo de equipos, historial de georreferenciaciones, σ del nivel digital.

## Riesgos

- **El CHECK en la nube.** Si apareciera una fila fuera de rango entre la
  consulta de hoy y la migración, fallaría. Mitigación: la migración primero
  cuenta y aborta con un mensaje claro; se consulta otra vez antes del
  `db push`.
- **El aviso de PU10 en capturas a medias.** Un aviso en cada PC mientras se
  teclea puede molestar. Mitigación: solo cuando la fila ya tiene una de las
  dos lecturas, no en filas vacías.

## Tareas (en orden)

0. **Apertura:** este PRD, estados en `method.md` y `prds/README.md`,
   `pendientes.md`. Commit `docs:`. Rama.
1. **PU9** — validador, acción, migración con CHECK y pgTAP.
2. **PU10** — aviso y motivo de cierre, en nivelación y en la libreta.
3. **PU8** — tres estados en el informe del proceso.
4. **PU4 y PU7** — conteo por estado y KPI.
5. **PU2, PU3, PU5 y PU6** — tabla de estaciones, Excel, esqueletos y hover.
6. **Verificación en pantalla** en local.
7. **Cierre:** manual (dos copias) y capturas que cambien, doc técnica § 11
   (PU1 a PU6 se cierran), `method.md`, `prds/README.md`, `pendientes.md`.
   Revisión de código y PR.
8. **Antes del merge:** `db push` del CHECK a la nube, con visto bueno.
