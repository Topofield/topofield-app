# Fase 36 — La nivelación como la mide el topógrafo · Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Alta en popup, pantalla por pasos (Libreta · Compensación · Informe) con captura por armada en popups, orden de precisión detectado, compensación sin limitantes y con avisos, informe sencillo por tipo, sin avisos de equilibrado, y una nivelación que ya no se cierra.

**Architecture:**
- **Lógica pura con TDD:**
  - la regla de compensación y el orden detectado, en `src/lib/calculations/leveling.ts`;
  - la captura por armada, en `src/components/leveling/armadas.ts`, que pasa de un popup a las filas de la libreta sin cambiar el modelo por punto (hallazgo 7);
  - la carga del guardado, en `src/components/leveling/leveling-save.ts`.
- **Lo común** de la poligonal (cabecera, pasos y borrador) pasa a `src/components/process/`, y lo usan las dos.
- **Pantalla:** se rehace sobre los mismos datos. Cada popup arma la carga completa y llama a la acción de guardado, que recalcula en el servidor.
- **Base:** dos migraciones. La primera, antes del merge, añade columnas, reabre lo cerrado y quita los triggers de la nivelación; la segunda, después, borra `closed_at` y `closed_by`.

**Tech Stack:** Next.js 16 (App Router, Server Actions), React 19, TypeScript, Supabase (Postgres, pgTAP), Vitest, Tailwind v4 con el sistema de diseño propio.

**Spec:** `docs/prds/35-ux-nivelacion.md` (Fase 36). Hoja de ruta: `docs/superpowers/specs/2026-10-06-ux-nivelacion-asentamientos-design.md`. Maquetas: el lienzo «Nivelación — rediseño de la UX» (https://claude.ai/artifact/3XzPm9EFC8dXwwWGEAEvNs): alta B y de enlace, libreta B, captura A, BM, compensación, gráficos por tipo, móvil e informes por tipo.

## Global Constraints

- **Rama:** `fase-36-ux-nivelacion`, en la carpeta principal. El PRD ya está commiteado (`bab1349`).
- **Idioma y estilo:** interfaz en español de Colombia; tuteo en la app y usted en el manual. Commits en español con `feat:`, `fix:`, `refactor:` o `docs:`, terminados en `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **Cálculo:** `src/lib/calculations/` es puro, sin React ni Supabase. Las tolerancias viven solo en `tolerances.ts`.
- **Formatos:** cotas con 4 decimales; distancias de visual con 1; lecturas de mira con 3 (4 si vienen del nivel digital).
- **Nombre:** «cota ajustada», nunca «adoptada», en la nivelación (decisión 12).
- **Componentes:** sin shadcn ni librerías de componentes; `@/components/design-system`.
- **Alcance del cierre:** solo la nivelación deja de cerrarse. Lugares y visitas conservan cerrar y reabrir; `reject_update_on_closed_process()`, `reject_delete_on_closed_process()` e `is_reopening()` se quedan.
- **Regla de compensación:** «siempre» solo para la nivelación; la visita conserva «dentro de tolerancia» (decisión 6). Ninguna cota de visita cambia.
- **Equilibrado de visuales:** fuera en la nivelación y en la visita (decisión 7).
- **Migraciones:**
  - escritas a mano;
  - en local con `npx supabase migration up --local`, nunca `db reset` (la base local es compartida);
  - el `db push` a producción, con el visto bueno del usuario: el paso 1 antes del merge, el paso 2 después.
- **Verificación:** `npm run typecheck` después de cada cambio de código.

## Review Focus

- **Una libreta importada o vieja con forma irregular** —una armada a medias al final, una intermedia colgada después del último punto— se ve y se edita por armadas sin perder ni mover filas. Lo prueba `armadas.test.ts` (Tarea 5).
- **Editar una armada del medio** reescribe solo sus filas: el punto de cambio que la cierra conserva su V+, que abre la siguiente. Lo prueba `armadas.test.ts`.
- **Las visitas con libreta conservan sus cotas**: una fuera de tolerancia no se compensa. Lo prueban `leveling-detect.test.ts` (Tarea 1) y la suite de `settlement-book` sin cambios de cifras.
- **Una nivelación cerrada en producción**, reabierta por la migración, conserva sus lecturas y sus cotas, y se edita. Lo prueba pgTAP en la Tarea 3.
- **Un popup que falla al guardar** (captura inválida o red) deja el error dentro del popup y no pierde lo tecleado. Lo prueba la Tarea 14, paso 3.

---

### Task 1: Motor — compensación sin limitantes y orden detectado

**Files:**
- Modify: `src/types/leveling.ts`: `LevelingInput.compensation`, `LevelingResult.compensated`.
- Modify: `src/lib/calculations/leveling.ts`: las tres guardas de compensación, `detectLevelingOrder`, `computeLevelingDetected`, y `adoptedElevationsOf` con `compensated`.
- Test: `src/lib/calculations/leveling-detect.test.ts`.

**Interfaces:**
- Produces:
  - `LevelingInput.compensation?: "always" | "within_tolerance"`. Sin valor, `"within_tolerance"`: la regla de hoy, la de la visita.
  - `LevelingResult.compensated: boolean`: las cotas corregidas están compensadas (ida y, si la hay, vuelta; o el circuito de la abierta).
  - `detectLevelingOrder(result: LevelingResult, type: LevelingType): { order: PrecisionOrder | null; verifiable: boolean }`.
  - `computeLevelingDetected(input: Omit<LevelingInput, "order" | "compensation">): { result: LevelingResult; order: PrecisionOrder | null; verifiable: boolean }`. Calcula con `compensation: "always"`; las cifras de tolerancia del resultado son las del orden detectado, o las del ordinario si no alcanza ninguno.
  - `adoptedElevationsOf(result, input)` devuelve `null` si `!result.compensated`.

- [ ] **Step 1: Escribir la prueba**

```ts
// src/lib/calculations/leveling-detect.test.ts
import { describe, expect, it } from "vitest";
import { CARTERA_VERJON } from "@/lib/demo/carteras";
import { nivelacionTramo2 } from "@/lib/demo/fixtures";
import {
  adoptedElevationsOf,
  computeLeveling,
  computeLevelingDetected,
} from "./leveling";
import type { LevelingInput, PointType, ReadingInput } from "@/types/leveling";

function r(
  pointCode: string,
  pointType: PointType,
  backsight: number | null,
  foresight: number | null,
  backDistanceM: number | null,
  foreDistanceM: number | null,
): ReadingInput {
  return {
    pointCode, pointType, backsight, foresight,
    backUpperM: null, backLowerM: null, foreUpperM: null, foreLowerM: null,
    backDistanceM, foreDistanceM, distanceAccumulatedKm: null,
  };
}

const fromCartera = (rows: typeof CARTERA_VERJON.ida) =>
  rows.map((x) => r(x.code, x.type, x.backsight, x.foresight, x.backDistanceM, x.foreDistanceM));

const verjon: Omit<LevelingInput, "order" | "compensation"> = {
  type: "open",
  startElevation: CARTERA_VERJON.startElevation,
  endElevation: null,
  forward: fromCartera(CARTERA_VERJON.ida),
  return: fromCartera(CARTERA_VERJON.vuelta),
};

// Cerrada de 0.2 km que llega 100 mm arriba: no alcanza ni el ordinario (10.7 mm).
const fueraDeOrden: Omit<LevelingInput, "order" | "compensation"> = {
  type: "closed",
  startElevation: 100,
  endElevation: null,
  forward: [
    r("BM", "bm", 1.0, null, 50, null),
    r("P1", "pc", 1.0, 1.2, 50, 50),
    r("BM", "bm", null, 0.7, null, 50),
  ],
  return: null,
};

describe("computeLevelingDetected", () => {
  it("El Verjón alcanza segundo orden y da las cotas ajustadas del lienzo", () => {
    const { result, order, verifiable } = computeLevelingDetected(verjon);
    expect(verifiable).toBe(true);
    expect(order).toBe("segundo_orden");
    expect(result.discrepancyMm).toBeCloseTo(5.0, 6);
    expect(result.discrepancyToleranceMm).toBeCloseTo(5.26, 2);
    expect(result.compensated).toBe(true);
    const adopted = adoptedElevationsOf(result, { ...verjon, order: order! });
    const cota = (code: string) => adopted!.find((a) => a.pointCode.replace(/\s/g, "") === code)!.elevation;
    expect(cota("D1")).toBeCloseTo(3288.5, 4);
    expect(cota("C1")).toBeCloseTo(3289.44, 4);
    expect(cota("C7")).toBeCloseTo(3309.0535, 4);
    expect(cota("D4")).toBeCloseTo(3315.0855, 4);
  });

  it("el tramo 2 cierra en −0.4 mm y alcanza primer orden", () => {
    const t = nivelacionTramo2();
    const input: Omit<LevelingInput, "order" | "compensation"> = {
      type: "closed",
      startElevation: t.startElevation,
      endElevation: null,
      forward: t.forward.map((x) => r(x.code, x.type, x.back, x.fore, x.backDistanceM, x.foreDistanceM)),
      return: null,
    };
    const { result, order } = computeLevelingDetected(input);
    expect(result.closureErrorMm).toBeCloseTo(-0.4, 6);
    expect(order).toBe("primer_orden");
  });

  it("fuera del ordinario no hay orden, pero se compensa igual", () => {
    const { result, order, verifiable } = computeLevelingDetected(fueraDeOrden);
    expect(verifiable).toBe(true);
    expect(order).toBeNull();
    expect(result.closureErrorMm).toBeCloseTo(100, 6);
    expect(result.compensated).toBe(true);
    expect(result.forward.readings[1]!.elevationCorrected).toBeCloseTo(99.75, 9);
    expect(result.forward.readings[2]!.elevationCorrected).toBeCloseTo(100, 9);
  });

  it("la abierta sin vuelta no tiene orden ni se compensa", () => {
    const { result, order, verifiable } = computeLevelingDetected({ ...verjon, return: null });
    expect(verifiable).toBe(false);
    expect(order).toBeNull();
    expect(result.compensated).toBe(false);
  });
});

describe("computeLeveling — la regla de la visita no cambia", () => {
  it("dentro de tolerancia (por omisión), fuera de ella no compensa", () => {
    const result = computeLeveling({ ...fueraDeOrden, order: "tercer_orden" });
    expect(result.compensated).toBe(false);
    expect(result.forward.readings[1]!.elevationCorrected).toBeCloseTo(99.8, 9);
  });
});
```

- [ ] **Step 2: `npx vitest run src/lib/calculations/leveling-detect.test.ts`** → FAIL: `computeLevelingDetected` no existe.

- [ ] **Step 3: Los tipos**

En `src/types/leveling.ts`, dentro de `LevelingInput`:

```ts
  /**
   * Cuándo se compensa (Fase 36). «always»: siempre que haya contra qué
   * cerrar, cumpla o no; es la regla de la nivelación, que avisa si no
   * alcanza ningún orden. «within_tolerance» (por omisión): solo si cumple el
   * orden declarado, como pide el marco teórico § 8.1; es la de la visita.
   */
  compensation?: "always" | "within_tolerance";
```

Y en `LevelingResult`:

```ts
  /** Las cotas corregidas están compensadas: ida y vuelta, o el circuito de la abierta. */
  compensated: boolean;
```

- [ ] **Step 4: El motor**

En `computeLeveling` (`leveling.ts`), al principio:

```ts
  const always = input.compensation === "always";
  let forwardCompensated = false;
  let returnCompensated = false;
```

La guarda de la ida (hoy `if (meetsTolerance) {`):

```ts
      // Solo se compensa un trabajo que cumple la tolerancia (marco teórico
      // § 8.1), salvo con «always»: la nivelación compensa siempre y avisa
      // (Fase 36, decisión 5).
      if (meetsTolerance || always) {
        readings = applyProportionalCorrection(forward.readings, closureErrorMm, totalDistanceKm);
        forwardCompensated = true;
      }
```

La del circuito de la abierta (hoy `if (meetsDiscrepancy === true && valid(circuitKm)) {`):

```ts
      if ((meetsDiscrepancy === true || always) && valid(circuitKm)) {
        readings = applyCircuitCorrection(forward.readings, circuitClosureMm, 0, circuitKm);
        backReadings = applyCircuitCorrection(back.readings, circuitClosureMm, totalDistanceKm, circuitKm);
        forwardCompensated = true;
        returnCompensated = true;
      }
```

La de la vuelta de la cerrada o de enlace (hoy `} else if (returnMeets === true && returnErrorMm != null) {`):

```ts
    } else if (
      returnErrorMm != null &&
      (returnMeets === true || (always && returnToleranceMm != null))
    ) {
      backReadings = applyProportionalCorrection(back.readings, returnErrorMm, returnDistanceKm);
      returnCompensated = true;
    }
```

`returnToleranceMm != null` garantiza una distancia válida, que es lo que necesita el reparto. En el `return` final:

```ts
    compensated: forwardCompensated && (returnResult == null || returnCompensated),
```

`adoptedElevationsOf`: la primera línea pasa a `if (!result.compensated) return null;`. Con «within_tolerance» equivale a lo de hoy: los dos recorridos compensados son los dos recorridos que cumplen.

- [ ] **Step 5: El orden detectado**, en `leveling.ts`, después de `levelingProcessVerdict`:

```ts
/**
 * El orden más alto que cumple el trabajo (Fase 36): en la cerrada y la de
 * enlace, |e| ≤ K·√D en la ida y, si la hay, en la vuelta con su distancia; en
 * la abierta con vuelta, la discrepancia contra K·√D·√2 sobre el recorrido más
 * corto. `verifiable` es falso si no hay con qué juzgar: una abierta sin vuelta
 * o una libreta sin distancias.
 */
export function detectLevelingOrder(
  result: LevelingResult,
  type: LevelingType,
): { order: PrecisionOrder | null; verifiable: boolean } {
  const valid = (km: number | null | undefined): km is number =>
    km != null && Number.isFinite(km) && km > 0;
  const tests: ((order: PrecisionOrder) => boolean)[] = [];
  if (type === "open") {
    const back = result.return;
    if (!back || result.discrepancyMm == null) return { order: null, verifiable: false };
    if (!valid(result.forward.distanceKm) || !valid(back.distanceKm)) return { order: null, verifiable: false };
    const km = Math.min(result.forward.distanceKm, back.distanceKm);
    const d = result.discrepancyMm;
    tests.push((o) => withinTolerance(d, levelingTolerance(o, km) * Math.SQRT2));
  } else {
    const e = result.closureErrorMm;
    const km = result.forward.distanceKm;
    if (e == null || !valid(km)) return { order: null, verifiable: false };
    tests.push((o) => withinTolerance(e, levelingTolerance(o, km)));
    if (result.return) {
      const eBack = result.return.errorMm;
      const kmBack = result.return.distanceKm;
      if (eBack == null || !valid(kmBack)) return { order: null, verifiable: false };
      tests.push((o) => withinTolerance(eBack, levelingTolerance(o, kmBack)));
    }
  }
  const order = PRECISION_ORDERS.find((o) => tests.every((t) => t(o))) ?? null;
  return { order, verifiable: true };
}

/**
 * Calcula con el orden detectado (Fase 36). Compensa siempre; las cifras de
 * tolerancia del resultado son las del orden alcanzado, o las del ordinario si
 * no alcanza ninguno, para que la pantalla diga por cuánto se pasa.
 */
export function computeLevelingDetected(
  input: Omit<LevelingInput, "order" | "compensation">,
): { result: LevelingResult; order: PrecisionOrder | null; verifiable: boolean } {
  const probe = computeLeveling({ ...input, order: "ordinario", compensation: "always" });
  const { order, verifiable } = detectLevelingOrder(probe, input.type);
  const result =
    order && order !== "ordinario"
      ? computeLeveling({ ...input, order, compensation: "always" })
      : probe;
  return { result, order, verifiable };
}
```

Importa `PRECISION_ORDERS` de `@/types/project` y `PrecisionOrder` si no están.

- [ ] **Step 6: `npx vitest run src/lib/calculations/`** → PASS, incluida la suite de nivelación y de `settlement-book` sin cambios de cifras.
- [ ] **Step 7: `npm run typecheck`; commit** — `feat: la nivelación compensa siempre y detecta el orden alcanzado`

---

### Task 2: Validación — fuera el equilibrado de visuales

**Files:**
- Modify: `src/lib/validators/leveling.ts`: se retiran `validateSightBalances`, `validateSectionBalances`, `exceeds` y el comentario de equilibrado; `validateRunCapture` pierde `order` y `distancesReconstructed`; `ReadingCaptureIssues.warnings` pierde `sightBalance` y `sectionBalance`.
- Modify: `src/lib/calculations/tolerances.ts`: se retiran `SIGHT_BALANCE_LIMIT_M` y `SECTION_BALANCE_LIMIT_M`.
- Modify: los llamadores de `validateRunCapture`: `src/components/leveling/leveling-editor.tsx`, `src/app/(app)/projects/[id]/leveling/[pid]/actions.ts`, `src/lib/validators/settlement-book.ts`.
- Modify: `src/components/leveling/readings-table.tsx`, que deja de pintar los dos avisos.
- Test: `src/lib/validators/leveling.test.ts` (fuera las pruebas de equilibrado: `describe` de las líneas 150-180 y 400-420), `src/lib/validators/settlement-book.test.ts` (líneas 110-116), `src/lib/demo/libreta-asentamientos.test.ts` (línea 45).

**Interfaces:**
- Produces: `validateRunCapture(readings: ReadingInput[], levelingType: LevelingType): ReadingCaptureIssues[]`.

- [ ] **Step 1: La prueba de que ya no hay aviso**

En `src/lib/validators/leveling.test.ts`, en lugar de las pruebas de equilibrado:

```ts
describe("validateRunCapture — sin equilibrado de visuales (Fase 36)", () => {
  it("una armada de 31.5 m atrás y 8.4 m adelante no avisa", () => {
    const rows = [
      reading({ pointCode: "D1", pointType: "bm", backsight: 1.209, backDistanceM: 31.5 }),
      reading({ pointCode: "C 1", pointType: "pc", foresight: 0.268, foreDistanceM: 8.4 }),
    ];
    const issues = validateRunCapture(rows, "open");
    expect(issues.every((i) => Object.keys(i.warnings).length === 0)).toBe(true);
  });
});
```

`reading` es el ayudante que ya usa ese archivo para armar filas; si no existe con ese nombre, se usa el que haya.

- [ ] **Step 2: `npx vitest run src/lib/validators/`** → FAIL de tipos o de aridad: `validateRunCapture` aún pide el orden.
- [ ] **Step 3: Retirar el equilibrado** en los archivos de arriba. En `settlement-book.ts`, la llamada queda `validateRunCapture(rows, "closed")`. Se borran las pruebas de equilibrado y las aserciones de `sightBalance` y `sectionBalance` de las otras dos suites.
- [ ] **Step 4: `npx vitest run && npm run typecheck`** → PASS.
- [ ] **Step 5: Commit** — `refactor: fuera el equilibrado de visuales, que no es parte del ajuste`

---

### Task 3: Base — paso 1 (antes del merge)

**Files:**
- Create: `supabase/migrations/20261006010000_ux_nivelacion.sql`
- Create: `supabase/tests/nivelacion_sin_cierre.test.sql`
- Modify: `supabase/tests/reabrir_procesos.test.sql`, que pierde sus casos de nivelación (líneas 24-83 y su `plan`).
- Modify: `supabase/tests/poligonal_sin_cierre.test.sql`: el control «otro módulo conserva su cierre» pasa de una nivelación a una visita (`settlement_visits_reject_update_on_closed`).
- Modify: `src/types/database.ts` (solo lo nuevo) y `src/types/leveling.ts` (`precision_order: PrecisionOrder | null`; `location`, `responsible_name`, `responsible_role`).

- [ ] **Step 1: La prueba pgTAP**

Con datos propios en una transacción, como `poligonal_sin_cierre.test.sql`:
- una nivelación `closed` con dos lecturas y una `rejected`;
- se ejecuta la sentencia de la migración `update … set status = 'calculated' where status in ('closed','rejected')` (copiada en la prueba) y las dos quedan `calculated`, con sus lecturas y su `elevation_corrected`;
- un UPDATE de `name` y un DELETE de una lectura pasan;
- `save_leveling_process` escribe `location`, `responsible_name`, `responsible_role` y `precision_order = null`;
- `has_column` de las tres columnas nuevas y `col_is_null('public','leveling_processes','precision_order')`;
- `is_empty` en `pg_trigger` de `leveling_processes_reject_update_on_closed`, `leveling_processes_reject_delete_when_closed` y `leveling_readings_reject_write_when_closed`;
- `hasnt_function('public','reject_write_on_closed_process_reading')`;
- y una visita `closed` sigue rechazando un UPDATE de `operator`, con `23001`.

- [ ] **Step 2: `npx supabase test db`** → FAIL en el archivo nuevo.
- [ ] **Step 3: La migración**

```sql
-- Fase 36 — La nivelación como la mide el topógrafo (paso 1, antes del merge).
-- Ver docs/prds/35-ux-nivelacion.md, § A.
alter table public.leveling_processes
  add column location         text,
  add column responsible_name text,
  add column responsible_role text,
  alter column precision_order drop not null;

-- La nivelación deja de cerrarse (decisión 14). Primero los triggers, para
-- poder reabrir las cerradas. Las funciones compartidas con lugares y visitas
-- (reject_update_on_closed_process, reject_delete_on_closed_process,
-- is_reopening) se quedan.
drop trigger if exists leveling_processes_reject_update_on_closed on public.leveling_processes;
drop trigger if exists leveling_processes_reject_delete_when_closed on public.leveling_processes;
drop trigger if exists leveling_readings_reject_write_when_closed on public.leveling_readings;
drop function if exists public.reject_write_on_closed_process_reading();

update public.leveling_processes
   set status = 'calculated'
 where status in ('closed', 'rejected');
```

Antes de borrar la función, `grep -n "reject_write_on_closed_process_reading" supabase/migrations/*.sql` confirma que solo la usa `leveling_readings`.

A continuación, `create or replace function public.save_leveling_process(p_process_id uuid, p_header jsonb, p_readings jsonb)`. El cuerpo se copia entero de `20260930010000_guardados_atomicos.sql` (líneas 140-205), y en el `update … set` se añaden estas líneas antes de `notes`:

```sql
    location                   = h.location,
    responsible_name           = h.responsible_name,
    responsible_role           = h.responsible_role,
```

Después se repiten el `revoke` y el `grant` de esa misma migración (líneas 454 y 459).

- [ ] **Step 4: `npx supabase migration up --local`; `npx supabase test db`** → PASS, con `reabrir_procesos` y `poligonal_sin_cierre` ajustadas.
- [ ] **Step 5: Tipos.** Se genera con `npx supabase gen types typescript --local 2>/dev/null > <scratchpad>/db.ts` y se copian a mano a `database.ts` solo las tres columnas y `precision_order` nulable, en Row, Insert y Update. Los errores de `npm run typecheck` por `precision_order` nulo se tratan como «—» en el editor viejo, el Excel y el informe; las Tareas 10 a 12 los reemplazan.
- [ ] **Step 6: Commit** — `feat: la base de la nivelación sin cierre y con los datos del alta`

---

### Task 4: Lo común — cabecera, pasos y borrador

**Files:**
- Create: `src/components/process/process-header.tsx`, `process-steps.tsx` y `use-process-draft.ts`, sacados de `src/components/polygonal/polygonal-header.tsx`, `polygonal-steps.tsx` y `use-polygonal-draft.ts`.
- Modify: los tres archivos de la poligonal, que pasan a ser envolturas finas sobre los comunes, sin cambio visible.

**Interfaces:**
- Produces:
  - `ProcessSteps<T extends string>({ steps, active, basePath, trailing }: { steps: readonly { id: T; label: string }[]; active: T; basePath: string; trailing?: React.ReactNode })`. La poligonal pasa su selector DMS / decimal como `trailing`; la nivelación, el botón de importar.
  - `ProcessHeader(props: { badges: React.ReactNode; title: string; location: string | null; responsible: string | null; role: string | null; equipment: string | null; savedAt: string | null; actions: React.ReactNode; printable?: boolean })`. `formatSavedAt` se mueve con ella.
  - `useProcessDraft<D>(updatedAt: string, initial: () => D, persist: (next: D) => Promise<ActionResult>): { draft: D; save: (next: D) => Promise<ActionResult> }`: guarda en `saved` el último borrador hasta que cambia `updatedAt`, y llama a `persist` con `callAction`.

- [ ] **Step 1: Mover y envolver.** La lógica se mueve tal cual; los nombres de la poligonal siguen exportados para no tocar sus llamadores.
- [ ] **Step 2: `npx vitest run src/components/polygonal && npm run typecheck && npm run lint`** → PASS sin cambios en las pruebas de la poligonal.
- [ ] **Step 3: Commit** — `refactor: la cabecera, los pasos y el borrador de la poligonal pasan a ser comunes`

---

### Task 5: Armadas — de un popup a las filas

**Files:**
- Create: `src/components/leveling/armadas.ts`, sin «use client».
- Test: `src/components/leveling/armadas.test.ts`.

**Interfaces:**
- Consumes: `ReadingDraft` de `src/app/(app)/projects/[id]/leveling/[pid]/actions.ts` (solo el tipo).
- Produces: `Visual`, `Armada`, `ArmadaSpan`, `emptyRow`, `startRun`, `armadaSpans`, `armadaAt`, `writeArmada` y `removeLastArmada`, con las firmas de abajo.

- [ ] **Step 1: Escribir la prueba**

```ts
// src/components/leveling/armadas.test.ts
import { describe, expect, it } from "vitest";
import { CARTERA_VERJON } from "@/lib/demo/carteras";
import type { ReadingDraft } from "@/app/(app)/projects/[id]/leveling/[pid]/actions";
import { armadaAt, armadaSpans, emptyRow, removeLastArmada, startRun, writeArmada } from "./armadas";

const toDraft = (x: (typeof CARTERA_VERJON.ida)[number]): ReadingDraft => ({
  ...emptyRow(x.code, x.type),
  backsight: x.backsight,
  foresight: x.foresight,
  backDistanceM: x.backDistanceM,
  foreDistanceM: x.foreDistanceM,
});
const ida = CARTERA_VERJON.ida.map(toDraft);

describe("armadas", () => {
  it("la ida de El Verjón tiene 10 armadas; la 4 con la intermedia AUX1", () => {
    const spans = armadaSpans(ida);
    expect(spans).toHaveLength(10);
    expect(armadaAt(ida, 3).intermediates).toEqual([{ pointCode: "AUX1", reading: 0.194 }]);
  });

  it("la armada 2 es C 1 → C 2 con sus lecturas y distancias", () => {
    const a = armadaAt(ida, 1);
    expect(a.back).toEqual({ reading: 3.275, distanceM: 28.1, upperM: null, lowerM: null });
    expect(a.forePoint).toBe("C 2");
    expect(a.fore).toEqual({ reading: 0.224, distanceM: 17.3, upperM: null, lowerM: null });
  });

  it("capturar armada por armada reproduce la libreta de la hoja", () => {
    const rebuilt = armadaSpans(ida).reduce(
      (rows, _span, k) => writeArmada(rows, k, armadaAt(ida, k)),
      startRun("D1", "bm"),
    );
    expect(rebuilt).toEqual(ida);
  });

  it("editar una armada del medio solo cambia sus filas, y el punto de cambio conserva su V+", () => {
    const a = { ...armadaAt(ida, 1), fore: { reading: 0.25, distanceM: 18, upperM: null, lowerM: null } };
    const edited = writeArmada(ida, 1, a);
    expect(edited).toHaveLength(ida.length);
    expect(edited[2]!.foresight).toBe(0.25);
    expect(edited[2]!.backsight).toBe(3.469);
    expect(edited.filter((_r, i) => i !== 2)).toEqual(ida.filter((_r, i) => i !== 2));
  });

  it("una armada a medias al final se reconoce y se completa", () => {
    const half = removeLastArmada(ida).map((row, i, all) => (i === all.length - 1 ? { ...row, backsight: 2.349, backDistanceM: 12.1 } : row));
    const spans = armadaSpans(half);
    expect(spans.at(-1)!.closer).toBeNull();
    const done = writeArmada(half, spans.length - 1, armadaAt(ida, 9));
    expect(done).toEqual(ida);
  });

  it("una intermedia colgada después del último punto no se pierde al editar otra armada", () => {
    const withTail = [...ida, { ...emptyRow("R1", "intermediate"), foresight: 1.5 }];
    expect(writeArmada(withTail, 0, armadaAt(withTail, 0))).toEqual(withTail);
  });

  it("quitar la última armada deja el punto anterior sin V+", () => {
    const less = removeLastArmada(ida);
    expect(less).toHaveLength(ida.length - 1);
    expect(less.at(-1)!.pointCode).toBe("C 8");
    expect(less.at(-1)!.backsight).toBeNull();
  });
});
```

- [ ] **Step 2: `npx vitest run src/components/leveling/armadas.test.ts`** → FAIL: el módulo no existe.

- [ ] **Step 3: Implementar**

```ts
// src/components/leveling/armadas.ts
// La captura por armada (Fase 36, hallazgo 7). Una fila de la libreta es un
// punto: su V− cierra la armada anterior y su V+ abre la siguiente. Una armada
// es la V+ de un punto, las vistas intermedias que la siguen y la V− del
// siguiente punto que no es intermedio. Sin «use client»: lo usan el popup y
// las pruebas.
import type { ReadingDraft } from "@/app/(app)/projects/[id]/leveling/[pid]/actions";
import type { PointType } from "@/types/leveling";

export interface Visual {
  reading: number | null;
  distanceM: number | null;
  /** Hilos opcionales: con los dos, la distancia sale de ellos. */
  upperM: number | null;
  lowerM: number | null;
}

export interface Armada {
  back: Visual;
  forePoint: string;
  foreType: PointType;
  fore: Visual;
  intermediates: { pointCode: string; reading: number | null }[];
}

export interface ArmadaSpan {
  opener: number;
  intermediates: number[];
  /** La fila de la V−; `null` en una armada a medias. */
  closer: number | null;
}

const blankVisual: Visual = { reading: null, distanceM: null, upperM: null, lowerM: null };

export function emptyRow(pointCode: string, pointType: PointType): ReadingDraft {
  return {
    pointCode,
    pointType,
    backsight: null,
    foresight: null,
    backUpperM: null,
    backLowerM: null,
    foreUpperM: null,
    foreLowerM: null,
    backDistanceM: null,
    foreDistanceM: null,
  };
}

/** Un recorrido recién empezado: solo su punto de partida. */
export function startRun(pointCode: string, pointType: PointType): ReadingDraft[] {
  return [emptyRow(pointCode, pointType)];
}

export function armadaSpans(rows: readonly ReadingDraft[]): ArmadaSpan[] {
  const spans: ArmadaSpan[] = [];
  let open: ArmadaSpan | null = null;
  rows.forEach((row, i) => {
    if (row.pointType === "intermediate") {
      open?.intermediates.push(i);
      return;
    }
    if (open) {
      open.closer = i;
      spans.push(open);
      open = null;
    }
    if (row.backsight != null) open = { opener: i, intermediates: [], closer: null };
  });
  if (open) spans.push(open);
  return spans;
}

export function armadaAt(rows: readonly ReadingDraft[], k: number): Armada {
  const span = armadaSpans(rows)[k];
  if (!span) throw new Error(`No hay armada ${k + 1}.`);
  const o = rows[span.opener]!;
  const c = span.closer != null ? rows[span.closer]! : null;
  return {
    back: { reading: o.backsight, distanceM: o.backDistanceM, upperM: o.backUpperM, lowerM: o.backLowerM },
    forePoint: c?.pointCode ?? "",
    foreType: c?.pointType ?? "pc",
    fore: c
      ? { reading: c.foresight, distanceM: c.foreDistanceM, upperM: c.foreUpperM, lowerM: c.foreLowerM }
      : blankVisual,
    intermediates: span.intermediates.map((i) => ({ pointCode: rows[i]!.pointCode, reading: rows[i]!.foresight })),
  };
}

/**
 * Escribe la armada `k`: la V+ en la fila que la abre, sus intermedias y la V−
 * en la fila del punto adelante. Con `k` igual al número de armadas, añade una
 * nueva que abre la última fila del recorrido. La fila que cierra conserva su
 * V+, que abre la armada siguiente.
 */
export function writeArmada(rows: readonly ReadingDraft[], k: number, a: Armada): ReadingDraft[] {
  const spans = armadaSpans(rows);
  const withBack = (row: ReadingDraft): ReadingDraft => ({
    ...row,
    backsight: a.back.reading,
    backDistanceM: a.back.distanceM,
    backUpperM: a.back.upperM,
    backLowerM: a.back.lowerM,
  });
  const closer = (base: ReadingDraft | null): ReadingDraft => ({
    ...(base ?? emptyRow(a.forePoint, a.foreType)),
    pointCode: a.forePoint,
    pointType: a.foreType,
    foresight: a.fore.reading,
    foreDistanceM: a.fore.distanceM,
    foreUpperM: a.fore.upperM,
    foreLowerM: a.fore.lowerM,
  });
  const mids = a.intermediates.map((m) => ({ ...emptyRow(m.pointCode, "intermediate"), foresight: m.reading }));

  if (k < spans.length) {
    const span = spans[k]!;
    const end = span.closer ?? span.opener + span.intermediates.length;
    return [
      ...rows.slice(0, span.opener),
      withBack(rows[span.opener]!),
      ...mids,
      closer(span.closer != null ? rows[span.closer]! : null),
      ...rows.slice(end + 1),
    ];
  }
  if (k !== spans.length) throw new Error(`La armada ${k + 1} no sigue a la última.`);
  const last = rows.length - 1;
  if (last < 0) throw new Error("El recorrido no tiene punto de partida.");
  return [...rows.slice(0, last), withBack(rows[last]!), ...mids, closer(null)];
}

/** Quita la última armada: su punto adelante y la V+ del punto que la abría. */
export function removeLastArmada(rows: readonly ReadingDraft[]): ReadingDraft[] {
  const last = armadaSpans(rows).at(-1);
  if (!last) return [...rows];
  const opener = { ...rows[last.opener]!, backsight: null, backDistanceM: null, backUpperM: null, backLowerM: null };
  return [...rows.slice(0, last.opener), opener];
}
```

- [ ] **Step 4: `npx vitest run src/components/leveling/armadas.test.ts`** → PASS (7).
- [ ] **Step 5: Commit** — `feat: la captura por armada de la nivelación`

---

### Task 6: Acciones — guardar con lo detectado, crear, sin cerrar

**Files:**
- Modify: `src/app/(app)/projects/[id]/leveling/[pid]/actions.ts`.
- Delete: `src/app/(app)/projects/[id]/leveling/[pid]/close-status.ts` y su prueba.
- Modify: `src/lib/supabase/reopen-process.ts`, que deja `leveling` (las visitas y los lugares usan `src/lib/reopen.ts`).
- Create: `src/app/(app)/projects/[id]/leveling/create-actions.ts`, que sustituye a `new/actions.ts`.
- Create: `src/components/leveling/leveling-save.ts` (sin «use client»), con su prueba `leveling-save.test.ts`.

**Interfaces:**
- Consumes: `computeLevelingDetected` (Tarea 1), `validateRunCapture(readings, type)` (Tarea 2).
- Produces:
  - `SaveLevelingPayload` sin `precisionOrder`, `equipmentCalibrationDate`, `levelType` ni `kmPrecisionMm`; con `location`, `responsibleName` y `responsibleRole` (`string | null`).
  - `saveLevelingProcessAction(payload)`: sin guarda de cerrado. Llama a `computeLevelingDetected` y guarda `precision_order = order`, `meets_tolerance = verifiable ? order !== null : null`, las tolerancias del resultado, `status` como hoy y las cotas corregidas. Las columnas de equipo que la carga ya no trae (calibración, tipo de nivel, σ) no se tocan: el `select` previo las lee y la carga del RPC las repite.
  - `createLevelingProcessAction(payload: { projectId; name; type; hasReturnRun; startBmCode; startBmElevation; endBmCode; endBmElevation; location; responsibleName; responsibleRole; equipmentBrand; equipmentModel; equipmentSerial }): Promise<{ error?: string }>`: valida título, BM de partida y cota (y los de llegada en enlace), inserta con `precision_order = null` y la primera fila de la ida (el BM de partida), y redirige a `?tab=libreta`.
  - `LevelingDraft` (en `leveling-save.ts`): `{ details: { name; type; hasReturnRun; location; responsibleName; responsibleRole; equipmentBrand; equipmentModel; equipmentSerial; notes }; bm: { startCode; startElevation; endCode; endElevation }; forward: ReadingDraft[]; return: ReadingDraft[] }`.
  - `levelingDraftOf(process: LevelingProcess, readings: LevelingReading[]): LevelingDraft` y `levelingPayloadOf(processId: string, draft: LevelingDraft): SaveLevelingPayload`.
- Se retiran `closeLevelingProcessAction` y `reopenLevelingProcessAction`. `duplicateLevelingProcessAction` copia las tres columnas nuevas.

- [ ] **Step 1: La prueba de `leveling-save.ts`**: el borrador de El Verjón armado desde sus filas guardadas (con `reading_order` desordenado a propósito) da una carga con las mismas filas, en orden, que `CARTERA_VERJON`, y `levelingPayloadOf` no manda `precisionOrder`.
- [ ] **Step 2: FAIL. Step 3: implementar `leveling-save.ts` y las acciones.**
- [ ] **Step 4: `npx vitest run && npm run typecheck`** → PASS. Si el editor viejo deja de compilar por la carga nueva, se ajusta lo mínimo para que compile hasta la Tarea 9 (se anota la decisión).
- [ ] **Step 5: Commit** — `feat: el guardado de la nivelación detecta el orden, y la nivelación no se cierra`

---

### Task 7: Alta en popup y «Editar datos»

**Files:**
- Create: `src/components/leveling/leveling-details-dialog.tsx`, el popup de las maquetas Alta B y de enlace, con `mode: "create" | "edit"`.
- Modify: `src/components/projects/new-process-selector.tsx`: «Nivelación» abre el popup.
- Delete: `src/app/(app)/projects/[id]/leveling/new/` y `src/components/leveling/new-leveling-form.tsx`; `leveling-config-fields.tsx` cuando ya nada lo importe (Tarea 9).
- Modify: `src/components/equipment/equipment-picker.tsx`: `TotalStationIdentity` se generaliza a `EquipmentIdentity` con `kind: "total_station" | "level"` (marca, modelo, serie y «Tomar del catálogo» del tipo).

Comportamiento:
- **Campos:** Título (obligatorio: «El título es obligatorio.»); «¿Cómo es el recorrido?» con tres tarjetas dibujadas (Cerrada, De enlace, Abierta); la casilla «Con vuelta»; BM de partida y su cota conocida, tecleados; en enlace, BM de llegada y su cota; y `<details>` «Ubicación, responsable y equipo · opcional».
- **Pie:** «El orden de precisión se detecta al compensar.», Cancelar y «Crear y empezar» (en edición, «Guardar»).
- **En edición** con lecturas, cambiar el tipo o un BM avisa: «Cambiar el tipo o un BM recalcula la libreta.».
- **Importar:** el popup ofrece «¿Tienes la libreta del nivel digital? Importar `.L` o CSV», que abre el diálogo de importación de hoy y crea con lo importado.

- [ ] **Step 1: El popup y el selector; `npm run typecheck && npm run lint`**
- [ ] **Step 2: Commit** — `feat: el alta de la nivelación en un popup`

---

### Task 8: Cabecera, pasos y página

**Files:**
- Create: `src/components/leveling/leveling-header.tsx` (sobre `ProcessHeader`) y `leveling-steps.tsx` (sobre `ProcessSteps`, con 1 · Libreta, 2 · Compensación, 3 · Informe y, como `trailing`, «Importar .L o CSV»).
- Modify: `src/app/(app)/projects/[id]/leveling/[pid]/page.tsx`: deja `ProcessShell` y el `ReopenDialog`; `?tab=libreta|compensacion|informe`, por omisión `libreta`, y `?tab=proceso` va a `libreta`.

La cabecera lleva los badges del tipo («Nivelación abierta · con vuelta»), del estado y del orden («Segundo orden» en `success`, «No alcanza ningún orden» en `warning`, nada si no es verificable); el título; ubicación, «Responsable · Cargo» y equipo; y «Editar datos», «Exportar a Excel» y «⋯» (Duplicar y Eliminar).

- [ ] **Step 1: Componentes y página; typecheck y lint. Step 2: Commit** — `feat: la cabecera y los pasos de la nivelación`

---

### Task 9: Paso 1 · Libreta

**Files:**
- Create:
  - `src/components/leveling/libreta-tab.tsx`: cliente; dueño del borrador con `useProcessDraft`.
  - `src/components/leveling/bm-card.tsx` y `bm-dialog.tsx`.
  - `src/components/leveling/libreta-table.tsx`: la tabla de la hoja, solo lectura, con un lápiz por fila.
  - `src/components/leveling/armada-dialog.tsx`: la captura A.
  - `src/components/leveling/leveling-profile.tsx` (reescrito): el perfil con miras y visuales y la contraparte tenue.
  - `src/components/leveling/arithmetic-check.tsx`.
- Delete: `leveling-editor.tsx`, `leveling-verdict.tsx` (y su prueba), `close-process-dialog.tsx`, `results-panel.tsx` (lo que sirva pasa a la Tarea 10) y `run-tabs.tsx`. `readings-table.tsx` **se queda**: lo usa la visita.

Comportamiento, según la libreta B y la captura A:
- **BM:** tarjeta con el código y la cota de partida (y la llegada o «sin cota conocida»), con «Editar», que abre el popup del BM: código y cota, y en enlace los dos.
- **Tabla:** Punto (con badges «BM», «intermedia», «fin de la ida»), V+, Dist. V+, AI, V−, Dist. V−, VI y Cota (sin compensar), con Ida | Vuelta. El lápiz de una fila abre la armada que esa fila cierra (la primera, la que abre). Debajo, «+ Agregar armada», o «Seguir con la vuelta» cuando la ida llegó al final y hay vuelta.
- **Popup de armada:**
  - encabezado «Armada N · ida» y «El nivel entre {atrás}, ya con cota, y el punto siguiente»;
  - vista atrás: Lectura y Distancia; hilos superior e inferior opcionales: con los dos, la distancia sale de ellos (desactivada, «de los hilos») y se comprueba el medio con `MIDDLE_WIRE_TOLERANCE_M`;
  - vista adelante: Punto, Lectura, Distancia e hilos opcionales;
  - «+ Vista intermedia» (punto y lectura);
  - la casilla de fin: «Llega al BM» en la cerrada (fija el punto en el BM de partida), «Llega a {BM de llegada}» en enlace, «Fin de la ida» en la abierta;
  - abajo, Altura del instrumento, Cota del punto adelante y Atrás · adelante;
  - botones: Cancelar, Guardar y «Guardar y seguir desde {punto}»; en edición, también «Quitar la armada» (solo la última).
- **Guardado:** cada confirmación llama a `saveLevelingProcessAction` con `levelingPayloadOf`. Si falla, el error queda en el popup con lo tecleado.
- **Perfil:** fijo a la derecha desde 1024 px. Las cotas de la ida (o de la vuelta) con sus armadas: mira atrás, línea de visual a la altura del instrumento y mira adelante; con vuelta, las armadas del otro recorrido con opacidad 0.38. Exageración vertical en el encabezado. En el teléfono, Tabla | Perfil.
- **Comprobación aritmética:** Σ V+ − Σ V−, Cota final − inicial («cuadra»), Distancia del recorrido.
- **Libreta vacía:** la fila del BM y «+ Agregar la primera armada» junto a «Importar .L o CSV».

- [ ] **Step 1: Componentes; typecheck y lint**
- [ ] **Step 2: Commit** — `feat: el paso de libreta de la nivelación, con la captura por armada`

---

### Task 10: Paso 2 · Compensación

**Files:**
- Create: `src/components/leveling/compensacion-tab.tsx`, `order-verdict.tsx` (de la nivelación), `adjusted-table.tsx` y `comparison-chart.tsx`.
- Create: `src/components/leveling/comparison-data.ts`, puro, con su prueba: las series del gráfico (ajustada, y medidas separadas ×1000) para cada tipo.

Comportamiento:
- **Encabezado:** «Corrección proporcional a la distancia» y una frase por tipo.
- **Cifras:** error de cierre (o discrepancia), distancias, tolerancia del orden alcanzado y Orden alcanzado; «Por qué»: tabla de los cuatro órdenes con K, la tolerancia y si cumple.
- **Aviso** si no alcanza ningún orden: «No alcanza ningún orden: la compensación se aplicó igual. En la práctica, un trabajo fuera de tolerancia se repite (marco teórico § 8.1).»
- **Tabla:** abierta con vuelta: Punto, Dist. acum., Cota ida, Cota vuelta, Vuelta − ida (mm), Corr. ida, Corr. vuelta, Cota ajustada; cerrada y enlace: Punto, Dist. acum., Cota medida, Corrección (mm), Cota ajustada (con las dos lecturas si el punto se repite); abierta sin vuelta: «Sin compensación» con la comprobación aritmética.
- **Gráfico único:** la cota ajustada a escala y lo medido separado de ella con la diferencia ×1000, con las cifras en mm en los extremos.

- [ ] **Step 1: Prueba de `comparison-data.ts`** con El Verjón (ida en C 1 a +1.0 mm, vuelta a −6.0, las dos a −2.5 en D4) y el tramo 2 (−0.4 mm al final). **Step 2: FAIL. Step 3: implementar; componentes.**
- [ ] **Step 4: typecheck y lint; commit** — `feat: el paso de compensación de la nivelación`

---

### Task 11: Paso 3 · Informe y consolidado

**Files:**
- Modify: `src/components/reports/sections/leveling-section.tsx`: resumen con el veredicto, 1. Datos iniciales, 2. Datos ajustados (con el método en una frase), 3. el gráfico de `comparison-chart.tsx`; según el tipo.
- Modify: `src/lib/reports/eligibility.ts`, `state.ts`, `sections.ts` y `summary.ts`: la nivelación calculada entra al consolidado; el resumen usa el orden detectado; sin registro de cierre ni marca de borrador para la nivelación.
- Modify: `src/components/process/process-report.tsx`: la página pasa `includable` para la nivelación calculada.

- [ ] **Step 1: Pruebas** en `src/lib/reports/` para la elegibilidad de una nivelación calculada y el orden detectado en el resumen. **Step 2: FAIL. Step 3: implementar.**
- [ ] **Step 4: typecheck y lint; commit** — `feat: el informe sencillo de la nivelación, por tipo`

---

### Task 12: Hub, Excel, demo y seed

**Files:**
- Modify: `src/components/projects/hub-rows.tsx` (sin chips de cierre en la nivelación), `src/lib/supabase/queries.ts` (`getClosedWorkCount` sin nivelación), `src/lib/export/leveling-workbook.ts` (sin estado de cierre, «cota ajustada», orden detectado), `src/lib/demo/insertar-nivelacion.ts` y `crear-proyecto-demo.ts` (el tramo 2 calculado), `scripts/seed.mjs` («Circuito BM-2»).
- Remove: lo que quedó sin uso del cierre (`evaluateLevelingClosure`, `levelingProcessVerdict` si nadie lo usa, el texto «cerrado oficialmente»).

- [ ] **Step 1: Cambios; `npx vitest run && npm run typecheck && npm run lint`. Step 2: Commit** — `feat: hub, Excel, demo y seed de la nivelación sin cierre`

---

### Task 13: Base — paso 2 (después del merge)

**Files:**
- Create: `supabase/migrations/20261007000000_nivelacion_sin_cierre.sql`.
- Modify: `supabase/tests/nivelacion_sin_cierre.test.sql` y `src/types/database.ts`.

```sql
-- Fase 36, paso 2 (después del merge): la nivelación pierde su registro de cierre.
update public.leveling_processes set status = 'calculated' where status in ('closed', 'rejected');
alter table public.leveling_processes
  drop column closed_at,
  drop column closed_by,
  drop constraint leveling_processes_status_check,
  add constraint leveling_processes_status_check check (status in ('draft', 'in_progress', 'calculated'));
```

El nombre del `CHECK` se confirma antes con `select conname from pg_constraint where conrelid = 'public.leveling_processes'::regclass`.

- [ ] **Step 1: pgTAP**: `hasnt_column` de `closed_at` y `closed_by`, y `throws_ok` 23514 para `closed` y `rejected`. **Step 2: FAIL. Step 3: la migración, `migration up --local`, PASS.**
- [ ] **Step 4: Tipos** (sin `closed_at` ni `closed_by` en la nivelación); typecheck. **Step 5: Commit** — `feat: la nivelación pierde el registro de cierre`

Se aplica a producción después del merge y del despliegue de Vercel, con el visto bueno del usuario.

---

### Task 14: Documentación, capturas y verificación en pantalla

**Files:**
- Modify: `docs/manual/README.md` y `src/app/(app)/manual/{page.tsx,manual-data.ts}` (dos copias, mismo commit), `docs/manual/capturas.mjs` y `public/manual/*` (las de nivelación que cambian), `docs/tecnica/README.md` (fases, pruebas, deuda y despliegue), `docs/math/nivelacion.html` (la regla de compensación y el orden detectado), `PRD-TopoField.md` § 4.6, `CLAUDE.md` y las divergencias en el PRD de la fase.

- [ ] **Step 1: Documentación y capturas** (`node docs/manual/capturas.mjs`; solo se commitean las que cambian).
- [ ] **Step 2: Comprobaciones:** `npm run typecheck`, `npm run lint`, `npm test`, `npx supabase test db` y `npm run build`.
- [ ] **Step 3: En pantalla, en local, a 1280 y 390 px:** los criterios a–n del PRD. En particular:
  - capturar El Verjón entero por armadas y comparar con la hoja;
  - una armada que falla al guardar (cortar la red) conserva lo tecleado;
  - la visita con libreta de Torre Alameda se edita sin avisos de equilibrado y con las mismas cotas;
  - la poligonal se ve igual.
- [ ] **Step 4: Commits** — `docs: …` por cambio lógico.
