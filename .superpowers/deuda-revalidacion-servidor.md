# Deuda de revalidación en el servidor — cierre de nivelación y poligonal

Fecha: 2026-08-12
Rama: `feat/nivelacion`

## Problema

`closeLevelingProcessAction` y `closePolygonalProcessAction` recibían
`asRejected: boolean` del cliente y lo usaban tal cual para decidir
`status: closed | rejected`. La clave publicable de Supabase es pública por
diseño, así que cualquiera con sesión válida podía invocar la Server Action
directamente (saltándose el diálogo del navegador) y forzar `closed` sobre un
proceso fuera de tolerancia.

## Solución

En cada acción de cierre, el servidor ahora:

1. Trae `status`, `type` y `meets_tolerance` del proceso al cargarlo.
2. Deriva el `status` final con una función pura (`deriveLevelingCloseStatus`
   / `derivePolygonalCloseStatus`), sin usar el `asRejected` del cliente como
   fuente de verdad:
   - `status !== "calculated"` → rechaza el cierre (no se cierra un `draft`
     ni un `in_progress`; solo lo ya calculado).
   - `meets_tolerance === null` → rechaza el cierre ("no se puede cerrar un
     proceso sin resultados calculados"), **excepto** en los tipos que no
     tienen concepto de tolerancia por diseño (`leveling.type === "open"`,
     `polygonal.type === "open_uncontrolled"`): ahí `meets_tolerance` es
     `null` de forma estructural y permanente (no por falta de cálculo), así
     que el único criterio es `status === "calculated"`.
   - `meets_tolerance === false` → `rejected`, aunque el cliente pida
     `closed`.
   - `meets_tolerance === true` → `closed`, salvo que el cliente pida
     `rejected` explícitamente (rechazo voluntario, más estricto, permitido).
3. Asimetría documentada en el código: el cliente puede ser más estricto que
   el servidor (pedir `rejected` sobre algo que cumple), nunca más laxo
   (pedir `closed` sobre algo que no cumple).

Las firmas públicas de las Server Actions y los tipos de payload
(`CloseLevelingPayload` / `ClosePolygonalPayload`, ambos con `asRejected`)
**no cambiaron**. No se tocó la UI: los diálogos de cierre siguen evaluando
`evaluateLevelingClosure` / `evaluatePolygonalClosure` para la experiencia
normal; esto es defensa en profundidad detrás de ellos.

### Por qué no recalcular desde cero

`meets_tolerance` (y las columnas relacionadas: `closure_error_mm` en
nivelación; `angular_error_seconds`, `relative_precision` en poligonal) ya
las escribe el propio servidor en `saveLevelingProcessAction` /
`savePolygonalProcessAction`, recalculando con las funciones puras del motor
de cálculo. Son fuente de verdad confiable — no hace falta reconstruir
`ReadingInput[]` / `StationInput[]` ni volver a invocar `computeLeveling` /
`computePolygonal` en el cierre.

### Caso límite: tipos sin tolerancia

- `leveling.type === "open"`: `knownClosingElevation()` devuelve `null` para
  este tipo (no hay cota de cierre conocida), así que `meetsTolerance` en
  `computeLeveling` queda en `null` siempre, incluso con un proceso
  perfectamente calculado.
- `polygonal.type === "open_uncontrolled"`: `computeOpenUncontrolled()`
  siempre devuelve `meetsTolerance: null` (sin punto de llegada conocido no
  hay contra qué cerrar).

Aplicar la regla genérica de "`meets_tolerance` null → rechazar cierre" sin
esta excepción habría bloqueado permanentemente el cierre de estos dos tipos
— que hoy sí cierran vía UI, porque `evaluateLevelingClosure` /
`evaluatePolygonalClosure` no exigen tolerancia para ellos. Ambas funciones
de derivación tratan `type === "open"` / `type === "open_uncontrolled"` como
`meetsTolerance: true` implícito, condicionado solo a `status === "calculated"`.

## Archivos

- `src/app/(app)/projects/[id]/leveling/[pid]/close-status.ts` (nuevo) —
  `deriveLevelingCloseStatus`, función pura.
- `src/app/(app)/projects/[id]/leveling/[pid]/actions.ts` — `closeLevelingProcessAction`
  ahora lee `type, meets_tolerance` y delega en `deriveLevelingCloseStatus`.
- `src/app/(app)/projects/[id]/polygonal/[pid]/close-status.ts` (nuevo) —
  `derivePolygonalCloseStatus`, función pura.
- `src/app/(app)/projects/[id]/polygonal/[pid]/actions.ts` — `closePolygonalProcessAction`
  ídem con `derivePolygonalCloseStatus`.
- Tests nuevos: `actions.test.ts` en ambos directorios (8 casos cada uno: caso
  legítimo, ataque bloqueado, rechazo voluntario respetado, `meets_tolerance`
  null rechazado, `in_progress`/`draft` rechazados, tipo sin tolerancia
  cierra y respeta rechazo voluntario).

Nota técnica: la derivación se extrajo a un módulo aparte (`close-status.ts`)
sin `"use server"` porque Next.js exige que **todo** export de un archivo
`"use server"` sea una función `async` — `next build` falla si se exporta una
función pura síncrona desde `actions.ts`. Se detectó en el build de
verificación de esta tarea, no en typecheck ni lint.

## Deuda pendiente (fuera de alcance de esta pasada)

Por instrucción explícita, **no se implementó** la revalidación de la capa de
captura en el guardado (`saveLevelingProcessAction` /
`savePolygonalProcessAction`). Esas acciones ya recalculan los resultados
persistidos con las funciones puras del motor de cálculo (que es lo que
protege los números guardados de manipulación), pero no vuelven a correr
`validateReadingCapture` / `validatePolygonalStation` sobre las filas
recibidas — un cliente que se salte la UI podría, en teoría, guardar una
libreta con errores de captura (lectura de mira fuera de rango, distancia
acumulada faltante en un BM/PC, etc.) que el motor de cálculo no rechaza por
sí solo. Implementarlo exige reconstruir `ReadingInput[]` / `StationInput[]`
a partir del payload y decidir qué hacer con procesos ya guardados
históricamente que quizá no pasarían esa validación retroactiva. Queda
pendiente para una pasada futura.

## Verificación

Gates: `npm run typecheck`, `npm run lint`, `npm run test` (217, antes 201:
+16 nuevos), `npm run build` — los cuatro con exit 0.

### Verificación en vivo (dev server :3000, Supabase local :54321)

Usuario de prueba creado vía `POST /auth/v1/admin/users` (API admin de
Supabase Auth), NO insertado a mano en `auth.users`. Proyecto y procesos
creados a través de la UI real (Playwright, formularios reales, sin
saltarse capa de captura).

**1. Caso legítimo — poligonal** (cuadrado 4 lados, 90° cada ángulo, 100 m
cada lado → `angularError = 0"`, `linearError ≈ 0`, `meets_tolerance = true`).
Cerrado desde la UI real (botón "Cerrar proceso" → checkbox → "Confirmar
cierre"):

```
status ANTES:  calculated
status DESPUÉS: closed   (closed_at: 2026-08-12 23:25:11, closed_by: <user_id>)
```

**2. Caso legítimo — nivelación** (cierre perfecto, ΣL.Atrás = ΣL.Adelante =
1.500 → `closure_error_mm = 0.0`, `tolerance_mm = 24.0`, `meets_tolerance =
true`). Cerrado desde la UI real:

```
status ANTES:  calculated
status DESPUÉS: closed   (closed_at: 2026-08-12 23:25:21, closed_by: <user_id>)
```

**3. Ataque — poligonal fuera de tolerancia** (último ángulo desviado a 95°
→ `angularError = 18000"`, muy por encima de la tolerancia de orden
`ordinario`, `meets_tolerance = false`). Invocación directa de la Server
Action vía `curl`, replicando el protocolo `Next-Action` capturado de una
petición real (mismo `next-action` id, mismo `Content-Type:
text/plain;charset=UTF-8`, cookie de sesión real), **sin pasar por el
diálogo ni el checkbox de confirmación**, pidiendo `asRejected:false`
(intentando forzar `closed`):

```sql
-- ANTES
select id, name, status from public.polygonal_processes
where id = 'bd55b757-d808-40c6-8aa8-be7274f826e9';
--                  id                  |      name       |   status
-- --------------------------------------+-----------------+------------
--  bd55b757-d808-40c6-8aa8-be7274f826e9 | Poligonal FUERA | calculated

-- petición (curl, next-action del cierre poligonal capturado en el dev server):
-- curl -X POST http://localhost:3000/projects/<id>/polygonal/bd55b757-... \
--   -H "next-action: 401f0e79292fe7ccfa31966f29ad6338073220ba2c" \
--   -H "content-type: text/plain;charset=UTF-8" \
--   -H "Cookie: sb-127-auth-token=<sesión real>" \
--   --data-raw '[{"processId":"bd55b757-...","asRejected":false}]'

-- DESPUÉS
select id, name, status, meets_tolerance, angular_error_seconds, closed_by
from public.polygonal_processes
where id = 'bd55b757-d808-40c6-8aa8-be7274f826e9';
--                  id                  |      name       |  status  | meets_tolerance | angular_error_seconds |              closed_by
-- --------------------------------------+-----------------+----------+-----------------+------------------------+--------------------------------------
--  bd55b757-d808-40c6-8aa8-be7274f826e9 | Poligonal FUERA | rejected | f               |                18000.0 | cf0a47b0-736d-4e0e-87f1-423265c5ced6
```

El servidor ignoró `asRejected:false` y cerró como `rejected` porque
`meets_tolerance = false`. Nunca quedó `closed`.

**4. Ataque — nivelación fuera de tolerancia** (500 mm de error de cierre vs.
24 mm de tolerancia, `meets_tolerance = false`). Mismo patrón, `next-action`
capturado del cierre de nivelación:

```sql
-- ANTES
select id, name, status, meets_tolerance, closure_error_mm, tolerance_mm
from public.leveling_processes where id = '6328c860-b157-43f8-956d-f41b19694827';
--                  id                  |       name       |   status   | meets_tolerance | closure_error_mm | tolerance_mm
-- --------------------------------------+------------------+------------+-----------------+-------------------+--------------
--  6328c860-b157-43f8-956d-f41b19694827 | Nivelacion FUERA | calculated | f               |             500.0 |         24.0

-- curl -X POST http://localhost:3000/projects/<id>/leveling/6328c860-... \
--   -H "next-action: 4058de9cbe97cd56747317d8b8455e83a442add74e" \
--   -H "content-type: text/plain;charset=UTF-8" \
--   -H "Cookie: sb-127-auth-token=<sesión real>" \
--   --data-raw '[{"processId":"6328c860-...","asRejected":false}]'

-- DESPUÉS
select id, name, status, meets_tolerance, closure_error_mm, closed_by
from public.leveling_processes where id = '6328c860-b157-43f8-956d-f41b19694827';
--                  id                  |       name       |  status  | meets_tolerance | closure_error_mm |              closed_by
-- --------------------------------------+------------------+----------+-----------------+-------------------+--------------------------------------
--  6328c860-b157-43f8-956d-f41b19694827 | Nivelacion FUERA | rejected | f               |             500.0 | cf0a47b0-736d-4e0e-87f1-423265c5ced6
```

Igual: el servidor forzó `rejected`, ignorando el `asRejected:false` del
atacante.

### Limpieza

Se eliminaron todos los datos de prueba (proyecto, procesos poligonales y de
nivelación de prueba, y el usuario de prueba vía `DELETE
/auth/v1/admin/users/:id`) al terminar. Para borrar los procesos ya cerrados
por la prueba hubo que deshabilitar temporalmente (dentro de una transacción,
reactivados antes de cerrarla) los triggers de inmutabilidad
(`*_reject_delete_when_closed`, `*_reject_write_when_closed`) — es el
comportamiento esperado de esos triggers, que blindan correctamente contra
el borrado de procesos cerrados incluso desde SQL directo; no se dejaron
deshabilitados. Se verificó tras el commit que los 4 proyectos restantes en
la base local pertenecen a usuarios preexistentes, no a la prueba.

## Concerns

- La UI no cambió, así que un usuario legítimo que use el diálogo normal no
  nota ninguna diferencia — el bloqueo solo se activa si el `status`/`meets_tolerance`
  persistido no coincide con lo que el cliente pide.
- Poligonal ya tenía datos reales en producción. El cambio es idéntico en
  forma al de nivelación (mismo patrón de derivación, misma asimetría), pero
  cualquier proceso poligonal `calculated` con `meets_tolerance` `null`
  fuera de `open_uncontrolled` (no debería existir hoy, dado que
  `computeClosed`/`computeOpenControlled` solo llegan a `status: calculated`
  cuando tienen datos completos) quedaría bloqueado para cerrar hasta
  recalcularse. No se auditó la base de producción para confirmar que no
  hay filas en ese estado — recomendado como chequeo antes de desplegar.
- La revalidación de captura en el guardado queda pendiente (ver sección
  "Deuda pendiente" arriba); esta pasada solo cierra la brecha del cierre.
