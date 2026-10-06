# Fase 35 — La poligonal como la mide el topógrafo · Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Alta en popup, pantalla por pasos (Datos · Ajuste · Informe) con captura por popups, orden de precisión y tipo de ángulo detectados, informe con «Corrección por método …» en MathML, y una poligonal que ya no se cierra.

**Architecture:**
- **Lógica:** queda en funciones puras con TDD:
  - detección de orden y de tipo de ángulo, y azimuts observados, en `src/lib/calculations/`;
  - filas «desde → hacia», en `src/components/polygonal/capture-rows.ts`;
  - desglose de la corrección, en `src/lib/calculations/correction-breakdown.ts`.
- **Pantalla:** se rehace sobre los mismos datos. Cada popup arma la carga completa del proceso y llama a la acción de guardado de siempre, que recalcula en el servidor.
- **Base:** cambia en dos migraciones. La primera, antes del merge, añade columnas, guarda `has_closing_row`, reabre lo cerrado y quita los triggers. La segunda, después del merge, borra `closed_at` y `closed_by`.

**Tech Stack:** Next.js 16 (App Router, Server Actions), React 19, TypeScript, Supabase (Postgres, pgTAP), Vitest, Tailwind v4 con el sistema de diseño propio, MathML nativo.

**Spec:** `docs/prds/34-ux-poligonal.md` (Fase 35). Maquetas: el lienzo «Poligonal — rediseño de la UX» (https://claude.ai/artifact/QZbVmn5tSLPu6jHiiV4Mcj): alta A, Datos A, medición B, Ajuste e informe.

## Global Constraints

- **Rama:** `fase-35-ux-poligonal`, en la carpeta principal. El PRD ya está commiteado.
- **Idioma y estilo:** interfaz en español de Colombia; tuteo en la app y usted en el manual. Commits en español con `feat:`, `fix:`, `refactor:` o `docs:`, terminados en `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **Cálculo:** los archivos de `src/lib/calculations/` son puros, sin React ni Supabase. Las tolerancias viven solo en `tolerances.ts`.
- **Ángulos:** se guardan en DMS (tres campos). Coordenadas con 3 decimales; ángulos en DMS o en decimal según el selector del proceso.
- **Componentes:** sin shadcn ni librerías de componentes; se usa `@/components/design-system`.
- **Fórmulas:** en MathML, sin librerías (decisión 16).
- **Rótulo del método:** «Brújula (Bowditch)». La sección del informe se titula «Corrección por método …».
- **Alcance del cierre:** solo la poligonal deja de cerrarse. Nivelación, visitas y lugares conservan cerrar y reabrir, y `reject_update_on_closed_process()` e `is_reopening()` se quedan.
- **Migraciones:**
  - escritas a mano;
  - se aplican en local con `npx supabase migration up --local`, nunca con `db reset`, porque la base local se comparte con otras sesiones;
  - el `db push` a producción necesita el visto bueno del usuario: el paso 1 va antes del merge y el paso 2 después.
- **Verificación:** `npm run typecheck` después de cada cambio de código.

## Review Focus

- **Una poligonal vieja con el esquema de cierre de la Vivero** (`has_closing_row = false` con orientación) muestra filas «desde → hacia» coherentes, y la última no inventa un lado. Lo prueba `capture-rows.test.ts` (Tarea 2) con `CARTERA_VIVERO`.
- **La abierta con control** conserva la deflexión izquierda o derecha en el popup y la llegada en el amarre. Lo prueba `capture-rows.test.ts` con una abierta con control, más la Tarea 13, paso 3.
- **Reabrir por migración una poligonal georreferenciada** conserva su posición. Lo prueba pgTAP en la Tarea 4.
- **Un popup que falla al guardar** (error de captura o de red) muestra el error dentro del popup y no pierde lo tecleado. Lo prueba la Tarea 13, paso 3.
- **El informe consolidado con poligonales que no alcanzan orden** las admite y alerta, y su pie no las trata como reabiertas. Lo prueba `state.test.ts` (Tarea 10) más la Tarea 13.

---

### Task 1: Motor — orden y tipo de ángulo detectados, azimuts observados

**Files:**
- Modify: `src/types/polygonal.ts`: `PolygonalResult.angularConditionCount`; rótulo `bowditch`.
- Modify: `src/lib/calculations/polygonal.ts`: rellena `angularConditionCount`; añade `observedAzimuths`, `detectAngleType` y `computePolygonalDetected`.
- Modify: `src/lib/calculations/tolerances.ts`: añade `detectPrecisionOrder`.
- Test: `src/lib/calculations/polygonal-detect.test.ts`.

**Interfaces:**
- Produces:
  - `angularConditionCount: number | null`, nuevo en `PolygonalResult`: los ángulos que entran en la condición angular. Es `participating.length` en la cerrada, `n − 1` en la abierta con control cuando hay cierre angular, y `null` en lo demás.
  - `detectPrecisionOrder(result: PolygonalResult, type: PolygonalType): PrecisionOrder | null`, en `tolerances.ts`.
  - `detectAngleType(input: Omit<PolygonalInput, "order" | "angleType">): "interior" | "exterior"`.
  - `observedAzimuths(input: PolygonalInput): (number | null)[]`: el azimut de cada estación con los ángulos tal como se midieron.
  - `computePolygonalDetected(input: Omit<PolygonalInput, "order" | "angleType">): { result: PolygonalResult; order: PrecisionOrder | null; angleType: AngleType }`.
  - `CORRECTION_METHOD_LABELS.bowditch === "Brújula (Bowditch)"`.

- [ ] **Step 1: Escribir la prueba**

```ts
// src/lib/calculations/polygonal-detect.test.ts
import { describe, expect, it } from "vitest";
import { CARTERA_TT4, CARTERA_VIVERO } from "@/lib/demo/carteras";
import {
  computePolygonal,
  computePolygonalDetected,
  detectAngleType,
  observedAzimuths,
} from "./polygonal";
import { detectPrecisionOrder } from "./tolerances";
import { azimuthFromCoordinates } from "./angles";
import type { PolygonalInput, PolygonalResult } from "@/types/polygonal";

function inputOf(c: typeof CARTERA_TT4): Omit<PolygonalInput, "order" | "angleType"> {
  return {
    type: "closed",
    startNorth: c.startNorth,
    startEast: c.startEast,
    startAzimuth: azimuthFromCoordinates(c.startNorth, c.startEast, c.referenceNorth, c.referenceEast),
    endNorth: null, endEast: null, endAzimuth: null,
    hasOrientation: c.hasOrientation,
    hasClosingRow: c.hasClosingRow,
    method: "bowditch",
    leastSquares: null,
    stations: c.stations.map((s) => {
      const [d, m, sec] = s.readings[0]!;
      return { pointCode: s.pointCode, angle: d + m / 60 + sec / 3600, deflectionDirection: null, distance: s.distance, readings: [] };
    }),
  };
}

const res = (o: Partial<PolygonalResult>): PolygonalResult =>
  ({ angularError: null, relativePrecision: null, angularConditionCount: null, ...o }) as PolygonalResult;

describe("detectPrecisionOrder", () => {
  it("la TT4: 12″ en 7 ángulos cabe en segundo orden, pero 1:7045 solo en tercero", () => {
    expect(detectPrecisionOrder(res({ angularError: 12, angularConditionCount: 7, relativePrecision: 7045 }), "closed")).toBe("tercer_orden");
  });
  it("en la frontera exacta de cada orden, alcanza ese orden", () => {
    expect(detectPrecisionOrder(res({ angularError: 1 * Math.sqrt(4), angularConditionCount: 4, relativePrecision: 100000 }), "closed")).toBe("primer_orden");
    expect(detectPrecisionOrder(res({ angularError: 30 * Math.sqrt(4), angularConditionCount: 4, relativePrecision: 3000 }), "closed")).toBe("ordinario");
  });
  it("sin alcanzar el ordinario, null", () => {
    expect(detectPrecisionOrder(res({ angularError: 5, angularConditionCount: 4, relativePrecision: 2999 }), "closed")).toBeNull();
    expect(detectPrecisionOrder(res({ angularError: 61, angularConditionCount: 4, relativePrecision: 50000 }), "closed")).toBeNull();
  });
  it("la abierta con control sin cierre angular se juzga solo por la lineal", () => {
    expect(detectPrecisionOrder(res({ angularError: null, angularConditionCount: null, relativePrecision: 25000 }), "open_controlled")).toBe("segundo_orden");
  });
  it("sin verificación o sin datos, null", () => {
    expect(detectPrecisionOrder(res({ relativePrecision: 9999 }), "open_uncontrolled")).toBeNull();
    expect(detectPrecisionOrder(res({}), "closed")).toBeNull();
  });
  it("el cierre exacto alcanza primer orden", () => {
    expect(detectPrecisionOrder(res({ angularError: 0, angularConditionCount: 4, relativePrecision: Infinity }), "closed")).toBe("primer_orden");
  });
});

describe("detectAngleType", () => {
  it("la TT4 y la Vivero son interiores", () => {
    expect(detectAngleType(inputOf(CARTERA_TT4))).toBe("interior");
    expect(detectAngleType(inputOf(CARTERA_VIVERO as typeof CARTERA_TT4))).toBe("interior");
  });
  it("con los ángulos exteriores (360° − interior) de un cuadrado, exterior", () => {
    const sq = { ...inputOf(CARTERA_TT4), hasOrientation: false, hasClosingRow: false,
      stations: [0, 1, 2, 3].map((i) => ({ pointCode: `P${i}`, angle: 270, deflectionDirection: null, distance: 10, readings: [] })) };
    expect(detectAngleType(sq)).toBe("exterior");
  });
  it("con ángulos incompletos, interior por omisión", () => {
    const partial = { ...inputOf(CARTERA_TT4) };
    partial.stations = partial.stations.map((s, i) => (i === 2 ? { ...s, angle: Number.NaN } : s));
    expect(detectAngleType(partial)).toBe("interior");
  });
});

describe("computePolygonalDetected", () => {
  it("la TT4 sale en tercer orden, interior, con el mismo ajuste que el motor", () => {
    const { result, order, angleType } = computePolygonalDetected(inputOf(CARTERA_TT4));
    expect(order).toBe("tercer_orden");
    expect(angleType).toBe("interior");
    expect(result.angularConditionCount).toBe(7);
    expect(result.meetsTolerance).toBe(true);
    const direct = computePolygonal({ ...inputOf(CARTERA_TT4), order: "tercer_orden", angleType: "interior" });
    expect(result.stations.map((s) => s.north)).toEqual(direct.stations.map((s) => s.north));
  });
});

describe("observedAzimuths", () => {
  it("la TT4: los azimuts sin corrección angular de la hoja", () => {
    const az = observedAzimuths({ ...inputOf(CARTERA_TT4), order: "tercer_orden", angleType: "interior" });
    const sec = (a: number | null) => Math.round((a ?? 0) * 3600);
    expect(sec(az[0])).toBe(Math.round((181 + 51 / 60 + 4.23 / 3600) * 3600));
    expect(sec(az[6])).toBe(Math.round((330 + 36 / 60 + 9.23 / 3600) * 3600));
  });
});
```

- [ ] **Step 2: Correrla y ver que falla**

Run: `npx vitest run src/lib/calculations/polygonal-detect.test.ts`
Expected: FAIL; `detectPrecisionOrder`, `detectAngleType`, `observedAzimuths` y `computePolygonalDetected` no existen. Si `azimuthFromCoordinates` no tiene esa firma, ajustar la prueba a la firma real de `angles.ts:73`, sin tocar la función.

- [ ] **Step 3: Implementar**

En `tolerances.ts`:

```ts
const ORDERS_HIGH_TO_LOW: PrecisionOrder[] = ["primer_orden", "segundo_orden", "tercer_orden", "ordinario"];

/**
 * El orden más alto que cumplen a la vez la tolerancia angular (K·√n) y la
 * precisión relativa mínima (Fase 35, decisión 3). `null` si la poligonal no
 * tiene verificación, si faltan datos o si no alcanza ni el ordinario.
 */
export function detectPrecisionOrder(
  result: Pick<PolygonalResult, "angularError" | "angularConditionCount" | "relativePrecision">,
  type: PolygonalType,
): PrecisionOrder | null {
  if (type === "open_uncontrolled") return null;
  if (result.relativePrecision == null) return null;
  for (const order of ORDERS_HIGH_TO_LOW) {
    const angularOk =
      result.angularError == null || result.angularConditionCount == null
        ? true
        : Math.abs(result.angularError) <= angularTolerance(order, result.angularConditionCount) + 1e-9;
    const linearOk = result.relativePrecision >= minRelativePrecision(order);
    if (angularOk && linearOk) return order;
  }
  return null;
}
```

En la cerrada sin ángulos completos, `relativePrecision` es `null` y devuelve `null`. El `+ 1e-9` absorbe la frontera en coma flotante, como en la Fase 32.

En `polygonal.ts`:
- `angularConditionCount` en los tres `return`. En la cerrada vale `participating.length` con datos y `null` en el `return` de datos incompletos. En la abierta con control vale `doAngularClosure ? n - 1 : null`. En la abierta sin control, `null`.
- Las tres funciones nuevas:

```ts
/**
 * Tipo de ángulo de una cerrada por su suma (Fase 35, decisión 4): interior y
 * exterior difieren en 720°, así que la suma observada dice cuál es. Con datos
 * incompletos, interior. En las abiertas no aplica y se devuelve interior.
 */
export function detectAngleType(input: Omit<PolygonalInput, "order" | "angleType">): "interior" | "exterior" {
  if (input.type !== "closed") return "interior";
  const n = input.stations.length;
  const vertices = input.hasOrientation ? n - 1 : n;
  const first = input.hasOrientation && !input.hasClosingRow ? 1 : 0;
  const angles = input.stations.slice(first).map((s) => s.angle);
  if (vertices < 3 || !angles.every(isNum)) return "interior";
  const sum = angles.reduce((a, b) => a + b, 0);
  const extra = input.hasOrientation && input.hasClosingRow ? [0, 360] : [0];
  const distance = (base: number) => Math.min(...extra.map((k) => Math.abs(sum - (base + k))));
  return distance((vertices + 2) * 180) < distance((vertices - 2) * 180) ? "exterior" : "interior";
}

/** Azimuts con los ángulos tal como se midieron, sin corrección angular (Fase 35). */
export function observedAzimuths(input: PolygonalInput): (number | null)[] {
  const out: (number | null)[] = [];
  let az: number | null = firstSideAzimuth({ ...input, stations: input.stations });
  if (!isNum(az)) return input.stations.map(() => null);
  out.push(az);
  for (let i = 1; i < input.stations.length; i++) {
    const st = input.stations[i]!;
    if (!isNum(st.angle) || az === null) { out.push(null); az = null; continue; }
    az =
      input.type === "open_controlled"
        ? normalizeAzimuth(az + (st.deflectionDirection === "left" ? -1 : 1) * st.angle)
        : normalizeAzimuth(az + 180 + st.angle);
    out.push(az);
  }
  return out;
}

/**
 * Calcula con el orden y el tipo de ángulo detectados (Fase 35). Primero con
 * el ordinario, para tener los errores; después, si alcanza un orden más alto,
 * otra vez con ese orden, para que la tolerancia y el veredicto sean los suyos.
 * Las coordenadas no dependen del orden.
 */
export function computePolygonalDetected(input: Omit<PolygonalInput, "order" | "angleType">) {
  const angleType: AngleType =
    input.type === "open_controlled" ? "deflection" : detectAngleType(input);
  const first = computePolygonal({ ...input, angleType, order: "ordinario" });
  const order = detectPrecisionOrder(first, input.type);
  const result =
    order === null || order === "ordinario" ? first : computePolygonal({ ...input, angleType, order });
  return { result, order, angleType };
}
```

`firstSideAzimuth` vale para la cerrada porque sigue la misma regla: con orientación suma el ángulo 0 al azimut de partida, y sin ella toma el de partida. En la abierta con control, `firstSideAzimuth` ya da el primer lado y las deflexiones empiezan en la estación 1.

Por último, `CORRECTION_METHOD_LABELS.bowditch = "Brújula (Bowditch)"`.

- [ ] **Step 4: Correrla y ver que pasa; la suite entera**

Run: `npx vitest run src/lib/calculations && npm test 2>&1 | tail -4`
Expected: PASS. Si alguna prueba existente comparaba el rótulo «Bowditch (brújula)», se actualiza a «Brújula (Bowditch)»: es la decisión 12.

- [ ] **Step 5: Commit**

```bash
git add src/lib/calculations src/types/polygonal.ts
git commit -m "feat: el motor detecta el orden de precisión y el tipo de ángulo"
```

---

### Task 2: Filas «desde → hacia»

**Files:**
- Create: `src/components/polygonal/capture-rows.ts`, sin «use client»; lo usan la pestaña Datos, el informe y el Excel.
- Test: `src/components/polygonal/capture-rows.test.ts`.

**Interfaces:**
- Consumes: `observedAzimuths` (Tarea 1).
- Produces:

```ts
export type CaptureRole = "backsight" | "side" | "closing" | "closing_angle";
export interface CaptureRow {
  /** Índice de la estación en `stations`; `null` en la fila virtual del 0 atrás. */
  stationIndex: number | null;
  from: string;
  to: string;
  role: CaptureRole;
  /** Grados decimales; 0 en el 0 atrás; `null` si falta. */
  angle: number | null;
  deflectionDirection: "right" | "left" | null;
  distance: number | null;
  /** Azimut sin ajustar; `null` si falta un dato anterior. */
  azimuth: number | null;
}
export function captureRows(input: PolygonalInput, amarre: { start: string; reference: string | null }): CaptureRow[];
```

Reglas:
- Con referencia, la fila 0 es el 0 atrás: de la estación de partida a la referencia, con ángulo 0 y el azimut de partida.
- La fila de la estación i va de su punto al de la estación i + 1. En la última estación de una cerrada:
  - con `hasClosingRow`, hacia la referencia, con papel `closing_angle` y sin distancia;
  - si no, hacia el segundo punto (esquema Vivero: el ángulo interior del vértice de arranque), sin distancia y con papel `closing_angle`.
- En la cerrada, el lado cuyo destino es la estación de partida lleva el papel `closing`.
- En las abiertas, la última fila es el punto final, sin destino: `to = ""`.

- [ ] **Step 1: Escribir la prueba**

```ts
import { describe, expect, it } from "vitest";
import { CARTERA_TT4, CARTERA_VIVERO } from "@/lib/demo/carteras";
import { azimuthFromCoordinates } from "@/lib/calculations/angles";
import { captureRows } from "./capture-rows";
import type { PolygonalInput } from "@/types/polygonal";

function inputOf(c: typeof CARTERA_TT4): PolygonalInput {
  return {
    type: "closed", order: "tercer_orden", angleType: "interior", method: "bowditch", leastSquares: null,
    startNorth: c.startNorth, startEast: c.startEast,
    startAzimuth: azimuthFromCoordinates(c.startNorth, c.startEast, c.referenceNorth, c.referenceEast),
    endNorth: null, endEast: null, endAzimuth: null,
    hasOrientation: c.hasOrientation, hasClosingRow: c.hasClosingRow,
    stations: c.stations.map((s) => { const [d, m, x] = s.readings[0]!;
      return { pointCode: s.pointCode, angle: d + m / 60 + x / 3600, deflectionDirection: null, distance: s.distance, readings: [] }; }),
  };
}

describe("captureRows", () => {
  it("la TT4: 0 atrás, seis lados y el cierre angular contra TT4", () => {
    const rows = captureRows(inputOf(CARTERA_TT4), { start: "V10", reference: "TT4" });
    expect(rows.map((r) => `${r.from}→${r.to}:${r.role}`)).toEqual([
      "V10→TT4:backsight", "V10→D1:side", "D1→D2:side", "D2→D3:side",
      "D3→D4:side", "D4→D5:side", "D5→V10:closing", "V10→TT4:closing_angle",
    ]);
    expect(rows[0]!.angle).toBe(0);
    expect(rows[7]!.distance).toBeNull();
    expect(rows[1]!.stationIndex).toBe(0);
  });
  it("la Vivero (sin fila de cierre): la última fila es el ángulo del vértice de arranque", () => {
    const rows = captureRows(inputOf(CARTERA_VIVERO as typeof CARTERA_TT4), { start: CARTERA_VIVERO.startPointCode, reference: CARTERA_VIVERO.referencePointCode });
    const last = rows.at(-1)!;
    expect(last.role).toBe("closing_angle");
    expect(last.from).toBe(CARTERA_VIVERO.startPointCode);
    expect(last.distance).toBeNull();
  });
  it("sin referencia no hay 0 atrás", () => {
    const rows = captureRows({ ...inputOf(CARTERA_TT4), hasOrientation: false, hasClosingRow: false }, { start: "V10", reference: null });
    expect(rows[0]!.role).toBe("side");
  });
  it("abierta con control: conserva el sentido de la deflexión y el último punto no tiene destino", () => {
    const input: PolygonalInput = { ...inputOf(CARTERA_TT4), type: "open_controlled", hasOrientation: false, hasClosingRow: false,
      endNorth: 0, endEast: 0, angleType: "deflection",
      stations: [
        { pointCode: "A", angle: Number.NaN, deflectionDirection: null, distance: 10, readings: [] },
        { pointCode: "B", angle: 12, deflectionDirection: "left", distance: 10, readings: [] },
        { pointCode: "C", angle: Number.NaN, deflectionDirection: null, distance: null, readings: [] },
      ] };
    const rows = captureRows(input, { start: "A", reference: null });
    expect(rows.map((r) => `${r.from}→${r.to}`)).toEqual(["A→B", "B→C", "C→"]);
    expect(rows[1]!.deflectionDirection).toBe("left");
  });
});
```

- [ ] **Step 2: Correrla; falla porque el módulo no existe**

Run: `npx vitest run src/components/polygonal/capture-rows.test.ts`

- [ ] **Step 3: Implementar con las reglas de arriba**

`observedAzimuths(input)[i]` es el azimut de la fila de la estación i; el del 0 atrás es `input.startAzimuth`.

- [ ] **Step 4: PASS y typecheck**

- [ ] **Step 5: Commit** — `feat: las filas desde → hacia de la captura`

---

### Task 3: Desglose de la corrección por método

**Files:**
- Create: `src/lib/calculations/correction-breakdown.ts`, puro.
- Test: `src/lib/calculations/correction-breakdown.test.ts`.

**Interfaces:**
- Consumes: `computePolygonalDetected` (Tarea 1).
- Produces:

```ts
export interface SideCorrection { from: string; to: string; distance: number; deltaN: number; deltaE: number; corrN: number; corrE: number; }
export type CorrectionBreakdown =
  | { method: "bowditch" | "transit"; angular: AngularStep; sides: SideCorrection[]; factorN: number; factorE: number;
      /** Brújula: el perímetro; Tránsito: Σ|ΔN| y Σ|ΔE|. */
      perimeter: number; sumAbsN: number; sumAbsE: number; errorN: number; errorE: number }
  | { method: "crandall"; angular: AngularStep; lambda1: number; lambda2: number;
      sides: (SideCorrection & { azimuth: number; deltaD: number; adjustedDistance: number })[]; errorN: number; errorE: number }
  | { method: "least_squares"; adjustment: Extract<LeastSquaresAdjustment, { status: "adjusted" }> | null;
      datumStation: string | null; weights: LeastSquaresWeights | null };
export interface AngularStep { errorSec: number; count: number; perAngleSec: number;
  /** El ángulo de orientación entra en el reparto. Siempre en los proporcionales con fila de cierre. */
  includesOrientation: boolean; }
export function correctionBreakdown(input: PolygonalInput, result: PolygonalResult): CorrectionBreakdown | null;
```

`null` si la poligonal no tiene corrección: abierta sin control o datos incompletos.

Cada cifra sale del motor, no de un cálculo paralelo:
- `corrN = correctedDeltaNorth − deltaNorth`, y lo mismo en E;
- `factorN = −errorN / perimeter` en la Brújula y `−errorN / Σ|ΔN|` en el Tránsito;
- Crandall: `deltaD` sale de la proyección del cambio sobre el azimut; λ₁ y λ₂ resuelven el mismo sistema 2×2 que `correctDeltas`.

- [ ] **Step 1: Escribir la prueba con la TT4 en los cuatro métodos**

Los valores esperados son los del motor, ya verificados en la apertura:
- **Brújula:** factorN −7.259e-5, factorE 1.219e-4; V10 → D1 con corrN −1.5 mm y corrE +2.5 mm.
- **Tránsito:** factorN −1.002e-4, factorE 2.707e-4; Σ|ΔN| 83.850 y Σ|ΔE| 52.085.
- **Crandall:** λ₁ −1.1226e-4 y λ₂ 3.3911e-4; deltaD de V10 → D1 +2.1 mm y de D4 → D5 −6.5 mm.
- **Mínimos cuadrados** (σ 5″, 5 mm, 1 medición): datumStation «V10»; correcciones de ángulo D1 −1.6″ y la del cierre −2.1″; σ₀ 1.209.
- **En los tres proporcionales:** perAngleSec −1.714, count 7 e includesOrientation true. Además, ΣcorrN = −errorN y ΣcorrE = −errorE, con `toBeCloseTo(…, 6)`.

```ts
import { describe, expect, it } from "vitest";
import { CARTERA_TT4 } from "@/lib/demo/carteras";
import { azimuthFromCoordinates } from "./angles";
import { computePolygonalDetected } from "./polygonal";
import { correctionBreakdown } from "./correction-breakdown";
import type { CorrectionMethod, PolygonalInput } from "@/types/polygonal";

function run(method: CorrectionMethod) {
  const c = CARTERA_TT4;
  const base: Omit<PolygonalInput, "order" | "angleType"> = {
    type: "closed", method, startNorth: c.startNorth, startEast: c.startEast,
    startAzimuth: azimuthFromCoordinates(c.startNorth, c.startEast, c.referenceNorth, c.referenceEast),
    endNorth: null, endEast: null, endAzimuth: null, hasOrientation: true, hasClosingRow: true,
    leastSquares: { sigmaAngleSeconds: 5, sigmaDistanceM: 0.005, distanceMeasurements: 1 },
    stations: c.stations.map((s) => { const [d, m, x] = s.readings[0]!;
      return { pointCode: s.pointCode, angle: d + m / 60 + x / 3600, deflectionDirection: null, distance: s.distance, readings: [] }; }),
  };
  const { result, order, angleType } = computePolygonalDetected(base);
  return correctionBreakdown({ ...base, order: order ?? "ordinario", angleType }, result)!;
}

describe("correctionBreakdown con la TT4", () => {
  it("Brújula", () => {
    const b = run("bowditch");
    if (b.method !== "bowditch") throw new Error();
    expect(b.angular.perAngleSec).toBeCloseTo(-1.714, 3);
    expect(b.angular.includesOrientation).toBe(true);
    expect(b.factorN).toBeCloseTo(-7.259e-5, 7);
    expect(b.factorE).toBeCloseTo(1.219e-4, 6);
    expect(b.sides[0]!.corrN * 1000).toBeCloseTo(-1.5, 1);
    expect(b.sides.reduce((a, s) => a + s.corrN, 0)).toBeCloseTo(-b.errorN, 6);
  });
  it("Tránsito", () => {
    const b = run("transit");
    if (b.method !== "transit") throw new Error();
    expect(b.sumAbsN).toBeCloseTo(83.850, 3);
    expect(b.factorE).toBeCloseTo(2.707e-4, 6);
    expect(b.sides.reduce((a, s) => a + s.corrE, 0)).toBeCloseTo(-b.errorE, 6);
  });
  it("Crandall", () => {
    const b = run("crandall");
    if (b.method !== "crandall") throw new Error();
    expect(b.lambda1).toBeCloseTo(-1.1226e-4, 7);
    expect(b.lambda2).toBeCloseTo(3.3911e-4, 7);
    expect(b.sides[4]!.deltaD * 1000).toBeCloseTo(-6.5, 1);
  });
  it("Mínimos cuadrados: la orientación es el datum", () => {
    const b = run("least_squares");
    if (b.method !== "least_squares") throw new Error();
    expect(b.datumStation).toBe("V10");
    expect(b.adjustment!.angleCorrectionsSec[0]).toBeNull();
    expect(b.adjustment!.sigma0).toBeCloseTo(1.209, 3);
  });
});
```

- [ ] **Step 2: FAIL; el módulo no existe**
- [ ] **Step 3: Implementar**

Las proyecciones crudas y las corregidas salen de `result.stations`, hasta `sideCount = hasOrientation && type === "closed" ? n − 1 : n − 1` lados. Para Crandall: `deltaD_i = d_i(λ₁ cos Az_i + λ₂ sen Az_i)`, con λ resuelto como en `correctDeltas`, y la prueba también comprueba que `(d_i + δd_i)·cos Az_i` reproduce `correctedDeltaNorth`. Para mínimos cuadrados, `datumStation` es la primera estación si hay orientación.

- [ ] **Step 4: PASS y la suite entera**
- [ ] **Step 5: Commit** — `feat: el desglose de la corrección de cada método`

---

### Task 4: Base — paso 1 (antes del merge)

**Files:**
- Create: `supabase/migrations/20261005010000_ux_poligonal.sql`
- Create: `supabase/tests/poligonal_sin_cierre.test.sql`
- Modify: `supabase/tests/reabrir_procesos.test.sql`, que pierde sus casos de poligonal; `supabase/tests/guardados_atomicos.test.sql`, si georreferencia una poligonal cerrada.
- Modify: `src/types/database.ts`, solo lo nuevo.

- [ ] **Step 1: Escribir la prueba pgTAP**

Con datos propios en una transacción:
- una poligonal `closed` georreferenciada y una `rejected`;
- después de la migración, las dos están `calculated` y conservan `start_north`;
- un UPDATE de `name` sobre ellas pasa;
- borrar una estación pasa;
- `save_polygonal_process` escribe `has_closing_row = true`, `angle_type = 'exterior'`, `precision_order = null` y `location`, `responsible_name` y `responsible_role`;
- `has_column` de las tres columnas nuevas;
- `col_is_null('public','polygonal_processes','precision_order')`;
- `is_empty` sobre `pg_trigger` para `polygonal_processes_reject_update_when_closed`, `polygonal_processes_reject_delete_when_closed` y `polygonal_stations_reject_write_when_closed`;
- y que una nivelación `closed` sigue rechazando un UPDATE de `name`, con `23001`.

La parte que reabre las cerradas se prueba en la propia transacción: se insertan cerradas, se ejecuta la sentencia `update … set status = 'calculated' where status in ('closed','rejected')` de la migración (copiada en la prueba) y se comprueba el resultado.

- [ ] **Step 2: `npx supabase test db` → FAIL en el archivo nuevo**
- [ ] **Step 3: Escribir la migración**

```sql
-- Fase 35 — La poligonal como la mide el topógrafo (paso 1, antes del merge).
-- Ver docs/prds/34-ux-poligonal.md, § A.
alter table public.polygonal_processes
  add column location         text,
  add column responsible_name text,
  add column responsible_role text,
  alter column precision_order drop not null;

-- La poligonal deja de cerrarse (decisiones 17 y 18). Primero los triggers, para
-- poder reabrir las cerradas.
drop trigger if exists polygonal_processes_reject_update_when_closed on public.polygonal_processes;
drop trigger if exists polygonal_processes_reject_delete_when_closed on public.polygonal_processes;
drop trigger if exists polygonal_stations_reject_write_when_closed on public.polygonal_stations;
drop function if exists public.reject_update_on_closed_polygonal_process();
-- (y el trigger de las lecturas de ángulo, si existe: comprobar con
--  `select tgname from pg_trigger where tgrelid = 'public.polygonal_angle_readings'::regclass`)

update public.polygonal_processes
   set status = 'calculated'
 where status in ('closed', 'rejected');

create or replace function public.save_polygonal_process(…)  -- la misma, más:
--   angle_type, has_closing_row, precision_order, location, responsible_name,
--   responsible_role en la lista del UPDATE.
```

El cuerpo completo de `save_polygonal_process` se copia de `20260930010000_guardados_atomicos.sql` (líneas 35 a 128) y se le añaden esas columnas en el `update … set`. `reject_write_on_closed_process_station()` solo se borra si nada más la usa; se comprueba con `grep` en las migraciones.

- [ ] **Step 4: `npx supabase migration up --local`; `npx supabase test db` → PASS**

Hay que ajustar las pruebas viejas que dependían del cierre de una poligonal: `reabrir_procesos` (la parte de poligonal) y `guardados_atomicos` (georreferenciar «un cerrado»).

- [ ] **Step 5: Tipos**

Se generan con `npx supabase gen types typescript --local 2>/dev/null > <scratchpad>/db.ts` y se copian a mano a `database.ts` solo las tres columnas nuevas y `precision_order` nulable, en Row, Insert y Update. Después, `npm run typecheck`.

`PolygonalProcess.precision_order` pasa a `PrecisionOrder | null` en `src/types/polygonal.ts`. Los errores de tipo que aparezcan se corrigen tratando `null` como «No alcanza» o «—», en el informe viejo, el Excel y el hub; las Tareas 9 a 11 los reemplazan.

- [ ] **Step 6: Commit** — `feat: la base de la poligonal sin cierre y con los datos del alta`

---

### Task 5: Acciones — guardar con lo detectado, crear, sin cerrar

**Files:**
- Modify: `src/app/(app)/projects/[id]/polygonal/[pid]/actions.ts`
- Delete: `src/app/(app)/projects/[id]/polygonal/[pid]/close-status.ts` y su prueba `actions.test.ts`.
- Modify: `src/lib/supabase/reopen-process.ts`, que deja `polygonal`.
- Create: `src/app/(app)/projects/[id]/polygonal/create-actions.ts`, que sustituye a `new/actions.ts`.
- Create: `src/lib/polygonal/amarre.ts`, puro, con su prueba.
- Modify: `src/lib/validators/polygonal.ts`, de donde salen `canPersistAngleFormat` y las lecturas mínimas.

**Interfaces:**
- Produces:
  - `SavePolygonalPayload` sin `precisionOrder`, `angleType`, `angleReadingsMin`, `equipmentCalibrationDate`, `angularPrecisionSeconds`, `distancePrecisionMm` ni `distancePrecisionPpm`; con `location`, `responsibleName` y `responsibleRole` (`string | null`).
  - `savePolygonalProcessAction(payload)`: llama a `computePolygonalDetected` y guarda `angle_type`, `precision_order`, `has_closing_row` y `meets_tolerance = order !== null`.
  - `createPolygonalProcessAction(payload: { projectId; name; location; responsibleName; responsibleRole; type; equipmentBrand; equipmentModel; equipmentSerial }): Promise<{ error?: string }>`: inserta el borrador con arranque provisional `start_point_code = ""`, N y E 0 y `precision_order` nulo, y redirige a `?tab=datos`.
  - `savePolygonalAmarreAction(processId, amarre: AmarreDraft): Promise<ActionResult>`: resuelve los dos puntos contra el catálogo con `resolveAmarre` y guarda la cabecera y los resultados con el mismo `save_polygonal_process`. El cliente manda la carga completa: el popup del amarre también pasa por `savePolygonalProcessAction`, con `referencePointId` resuelto antes con `ensureCatalogPoint`.
  - `ensureCatalogPointAction(projectId, point: { code; north; east; type: "control" }): Promise<{ ok: true; id: string } | { ok: false; error: string }>`.
  - `resolveCatalogPoint(existing: { id; code; north; east }[], point: { code; north; east })`, en `amarre.ts`: devuelve `{ kind: "reuse"; id }`, `{ kind: "create" }` o `{ kind: "conflict"; message }`. Si el código existe con coordenadas que difieren en más de 0.0005 m, es conflicto, con el mensaje «TT4 ya está en el catálogo con otras coordenadas: tómalo del catálogo o usa otro nombre.».

- [ ] **Step 1: Prueba de `resolveCatalogPoint`**: reutilizar, crear, conflicto, y el mismo código con diferencias de redondeo menores de medio milímetro.
- [ ] **Step 2: FAIL. Step 3: implementar `amarre.ts`.**
- [ ] **Step 4: Las acciones**

En el guardado:
- se quita la guarda de cerrado; renombrar, eliminar y el formato de ángulos quedan sin ella;
- `closePolygonalProcessAction` y `reopenPolygonalProcessAction` desaparecen;
- `relative_precision` se formatea igual que antes.

`duplicatePolygonalProcessAction` copia `location`, `responsible_name`, `responsible_role` y `has_closing_row`. Las precisiones viejas del equipo se siguen copiando: no se borran (decisión 2).

Después, `npm run typecheck`: los errores llevan a los llamadores, y el editor viejo se rompe aquí. Para que el commit compile, el editor viejo sigue llamando con los campos nuevos a `null` hasta la Tarea 8. Si es más simple, esta tarea y las 6 a 9 se commitean juntas cuando compilen: se deja una decisión anotada.

- [ ] **Step 5: PASS de Vitest y de typecheck; commit** — `feat: el guardado detecta orden y tipo de ángulo, y la poligonal no se cierra`

---

### Task 6: Alta en popup y «Editar datos»

**Files:**
- Create: `src/components/polygonal/polygonal-details-dialog.tsx`, el popup de la maqueta Alta A, en dos modos: `mode: "create" | "edit"`.
- Modify: `src/components/projects/new-process-selector.tsx`: «Poligonal» abre el popup en lugar de enlazar.
- Delete: `src/app/(app)/projects/[id]/polygonal/new/` (page y actions) y `src/components/polygonal/new-polygonal-form.tsx`.
- Delete: `src/components/polygonal/polygonal-config-fields.tsx`, si ya nada lo importa tras la Tarea 8.
- Modify: `src/components/design-system/equipment-fields.tsx` o `src/components/equipment/equipment-picker.tsx`: admiten `fields: "identity"` para mostrar solo marca, modelo y serie, con «Tomar del catálogo». Nivelación y visitas siguen igual.

Comportamiento:
- **Campos:** Título (obligatorio, «El título es obligatorio.»), Ubicación, Responsable y Cargo del responsable, Tipo (segmentado, con su ayuda), y `<details>` «Equipo · opcional».
- **Pie:** «El orden de precisión se detecta al ajustar.» y los botones Cancelar y «Crear y empezar» (en edición, «Guardar»).
- **En edición,** el tipo es editable. Si ya hay mediciones y cambia, se avisa: «Cambiar el tipo recalcula la poligonal con las mediciones que ya tiene.».

- [ ] **Step 1: El popup y el selector; `npm run typecheck && npm run lint`**
- [ ] **Step 2: Commit** — `feat: el alta de la poligonal en un popup`

---

### Task 7: Cabecera y pasos

**Files:**
- Create: `src/components/polygonal/polygonal-header.tsx`, la tarjeta de Datos A.
- Create: `src/components/polygonal/polygonal-steps.tsx`, con las pestañas 1 · Datos, 2 · Ajuste, 3 · Informe y el selector DMS/decimal, que se guarda con `setAngleInputFormatAction`.
- Modify: `src/app/(app)/projects/[id]/polygonal/[pid]/page.tsx`: deja `ProcessShell` y usa la cabecera y los pasos con `?tab=datos|ajuste|informe`. Por omisión, `datos`; `?tab=proceso`, de enlaces viejos, va a `datos`.

La cabecera lleva:
- los badges del tipo («Poligonal cerrada»), del estado (`PROCESS_STATUS_LABELS`) y del orden: «Tercer orden» en `success`, «No alcanza ningún orden» en `warning`, o nada si es `null` por falta de verificación o de datos;
- el título;
- la ubicación, «Responsable · Cargo» y el equipo, cada uno con su icono;
- las acciones: «Editar datos», «Exportar a Excel» y «⋯» (Duplicar y Eliminar, con los diálogos que ya usa el hub; ver `process-row-actions.tsx`).

Cada pestaña recibe `angleFormat` del proceso.

- [ ] **Step 1: Componentes y página; typecheck y lint**
- [ ] **Step 2: Commit** — `feat: la cabecera y los pasos de la poligonal`

---

### Task 8: Paso 1 · Datos

**Files:**
- Create:
  - `src/components/polygonal/datos-tab.tsx`: cliente; dueño del estado local y del guardado.
  - `src/components/polygonal/amarre-card.tsx` y `amarre-dialog.tsx`.
  - `src/components/polygonal/measurements-table.tsx` y `measurement-dialog.tsx`, el popup de la medición B.
  - `src/components/polygonal/angular-closure-summary.tsx`.
  - `src/components/polygonal/polygonal-save.ts`: arma `SavePolygonalPayload` desde el proceso, las estaciones del borrador y los cambios. Sin «use client».
- Delete:
  - `polygonal-editor.tsx`, `stations-table.tsx` (y su prueba, sustituida por `capture-rows.test.ts`), `close-process-dialog.tsx` y `reassign-coordinates-dialog.tsx`;
  - de `polygonal-draft.ts`, lo que solo usaban: `processToConfig` se reduce a lo que pide `polygonalInputOf`.

Comportamiento, según la maqueta Datos A y la medición B:
- **Amarre vacío:** «Empieza por el amarre» con «Ingresar puntos de amarre» y «Medir sin amarre, en coordenadas locales». El enlace crea el arranque «P1» en (1000, 1000), azimut 0 y sin referencia.
- **Popup del amarre:**
  - estación de partida y referencia, cada una con «Tomar del catálogo» (los puntos con coordenadas), nombre, Norte y Este;
  - «No tengo sus coordenadas: dar el azimut», que pide código y azimut y guarda `reference_point_code` con el azimut tecleado;
  - en la abierta con control, la sección «Llegada»: código, N, E y azimut opcional;
  - el azimut calculado;
  - al guardar, `ensureCatalogPointAction` para cada punto con coordenadas, y después el guardado.
- **Tabla:** #, Punto («V10 → D1», con badges «0 atrás», «cierre» y «cierre angular»), Ángulo (en el formato del selector), Distancia, Azimut y un botón de editar por fila (aria «Editar medición N»). Debajo, «+ Agregar punto», que se desactiva sin amarre con «Se activa con el amarre».
- **Popup de medición:**
  - encabezado «Estás en {from} · atrás en {anterior}»;
  - Punto siguiente;
  - Lecturas del ángulo: filas DMS o decimal según el selector, «+ Lectura», quitar, y el promedio con su dispersión, usando `averageOf` y `readingSpreadSeconds`;
  - en la abierta con control, Sentido (Derecha o Izquierda);
  - Distancia horizontal «{from} → {to} (m)»;
  - desde la segunda medición de una cerrada, la casilla «Cierre: este lado vuelve a {inicio}», que fija y desactiva el punto siguiente;
  - con el cierre marcado y referencia, la casilla «Agregar después el cierre angular: {inicio} → {ref}»;
  - botones: «Agregar y seguir en {siguiente}» (o «Agregar el cierre»), Terminar y Cancelar;
  - en edición: «Guardar» y «Eliminar medición». Eliminar una medición intermedia borra esa estación; el siguiente punto pasa a medirse desde el anterior, con el aviso «Las filas siguientes se recalculan».
- **Guardado:** cada confirmación llama a `savePolygonalProcessAction` con la carga completa que arma `polygonal-save.ts`.
  - Si falla, el error queda dentro del popup y no se pierde lo tecleado.
  - Si sale bien, `router.refresh()` no hace falta: la acción revalida la ruta.
  - El indicador «Guardado» va en la cabecera.
- **Cierre angular** (la cerrada): N.º de vértices, Tipo de ángulo con el badge «detectado», Ángulos en la condición, Suma observada, Suma teórica, Error angular y Corrección por ángulo, con `result.angleSum`, `theoreticalSum`, `angularError` y `angularConditionCount`. En las abiertas, el equivalente: «Sin cierre angular» o el error contra el azimut de llegada.
- **Dibujo:** `PolygonalPlotViewer`, fijo a la derecha desde 1024 px. En el teléfono, un segmentado «Tabla | Dibujo».

- [ ] **Step 1: `polygonal-save.ts` con una prueba**

La prueba comprueba que la carga de la TT4 reconstruida desde sus filas es la que guardaría el editor viejo: mismo `stations[].readings`, `referencePointId` y `hasClosingRow`.

- [ ] **Step 2: Los componentes; typecheck y lint**
- [ ] **Step 3: Commit** — `feat: el paso de datos de la poligonal, con amarre y mediciones en popups`

---

### Task 9: Paso 2 · Ajuste

**Files:**
- Create: `src/components/polygonal/ajuste-tab.tsx`, `adjusted-table.tsx` y `order-verdict.tsx` (el orden alcanzado y «Por qué», orden por orden, con la misma `angularTolerance` y `minRelativePrecision`).
- Modify: `results-panel.tsx`. Se queda solo la parte de mínimos cuadrados (pesos, correcciones, σ₀), renombrada a `least-squares-panel.tsx`. El resto se retira.
- Modify: `closure-verdict.tsx`. Se sustituye por `order-verdict.tsx`; su prueba de `verdictFor` se adapta o se retira con él.

Comportamiento:
- **Método:** segmentado Brújula (Bowditch), Tránsito, Crandall y Mínimos cuadrados. Cambiarlo guarda.
- **Mínimos cuadrados:** los tres σ, que se guardan al salir del campo cuando están completos y válidos (`validateLeastSquaresWeights`).
- **Cifras:** Error angular, Error de cierre lineal, Precisión relativa (`formatPrecision`) y Orden alcanzado, más el desplegable «Por qué».
- **Tabla:** Lado, Ángulo corregido, Azimut, Dist., Proy. N, Proy. E, Corregida N, Corregida E, Norte y Este, con fila Σ y desplazamiento horizontal en el teléfono.
- **Factores:** Diferencias ΔN·ΔE, Suma de proyecciones |N|·|E| y el factor del método, de `correctionBreakdown` (Tarea 3).
- **Dibujo:** el ajustado, con «Georreferenciar» (`georeference-dialog.tsx` sin cambios; ya no necesita «cambios sin guardar» porque cada popup guarda).
- **Abierta sin control:** «Sin verificación de cierre: no hay nada que ajustar», con las coordenadas encadenadas.

- [ ] **Step 1: Componentes; typecheck y lint. Step 2: Commit** — `feat: el paso de ajuste de la poligonal`

---

### Task 10: Paso 3 · Informe y consolidado

**Files:**
- Create: `src/components/reports/math.tsx`
  - `<Formula>` y piezas mínimas: `Frac`, `Sub`, `Sup`, `Sqrt`, `Sum`, `Mtable`, `Row`, `Mi`, `Mn`, `Mo`, `Mtext`;
  - en Server Components, con los elementos `math`, `mi`, etc. Si `@types/react` no los declara, se añade `src/types/mathml.d.ts` con `declare module "react" { namespace JSX { interface IntrinsicElements { math: …; mi: …; … } } }`.
- Create: `src/components/reports/sections/polygonal-correction.tsx`: «3. Corrección por método …» para los cuatro métodos, con los textos de las maquetas y las cifras de `correctionBreakdown`.
- Modify: `src/components/reports/sections/polygonal-section.tsx`, reescrita según la maqueta:
  1. Resultado, con la alerta: «No alcanza la precisión de ningún orden: el error angular o la precisión relativa supera las tolerancias del ordinario.»; en la abierta sin control, «Sin verificación de cierre.»;
  2. Datos de campo (amarre, mediciones con `captureRows` y cierre angular);
  3. Corrección por método;
  4. Poligonal ajustada;
  5. Coordenadas y dibujo.
- Modify: `src/lib/reports/sections.ts`. `PolygonalSectionData` gana `rows`, `breakdown`, `order` y `angleType`, calculados con `computePolygonalDetected` sobre `polygonalInputOf`.
- Modify: `src/components/process/process-report.tsx`. Para `process.type === "polygonal"`: sin `ReportStateMark`, sin `ClosureRecord`, con «Fecha del informe» y «Informe generado desde TopoField el …». El consolidado lo admite si está calculado.
- Modify: `src/lib/reports/eligibility.ts`: con `kind === "polygonal"`, elegible si `status === "calculated"`.
- Modify: `getClosedWorkForReports` en `queries.ts`: las poligonales calculadas, ordenadas por `updated_at`.
- Modify: `print/page.tsx` e `issuedFooterNote`. El pie solo considera reabiertos los procesos que se cierran: `s.kind !== "polygonal"`. La fila de una poligonal en «Registro de cierre» se omite. Si todas las secciones son poligonales, no hay «Registro de cierre».
- Modify: `src/lib/reports/summary.ts`: el resumen de precisiones muestra el orden alcanzado de la poligonal.
- Test: `eligibility.test.ts` (poligonal calculada sí, borrador no; nivelación sigue exigiendo cerrado) y `state.test.ts` (el pie con poligonales).

- [ ] **Step 1: Pruebas de elegibilidad y pie (RED). Step 2: Implementar (GREEN). Step 3: Componentes; typecheck y lint. Step 4: Commit** — `feat: el informe de la poligonal con la corrección por método`

---

### Task 11: Hub, Excel, demo y seed

**Files:**
- Modify:
  - `src/lib/process-list.ts`: los chips de las poligonales no incluyen «cerrados» ni «rechazados» (`PROCESS_CHIPS` por módulo).
  - `src/components/projects/hub-rows.tsx`: `polygonalRow.closed = false`, sin «Cerrado fuera de tolerancia».
  - `getClosedWorkCount`: sin poligonales.
- Modify: `src/lib/export/polygonal-workbook.ts`:
  - «Resumen» con Ubicación, Responsable, Cargo, Orden alcanzado (o «No alcanza»), Tipo de ángulo (detectado) y el rótulo del método;
  - sin calibración ni precisiones si están vacías; si las hay, se conservan;
  - sin fila de cierre.
  - Su prueba se actualiza.
- Modify: `src/lib/demo/fixtures.ts` e `insertar-poligonal.ts`: las poligonales `calculated`, con el orden y el tipo detectados y `has_closing_row`; sin `closed_at`.
- Modify: `scripts/seed.mjs`. Las poligonales `closed` o `rejected` pasan a `calculated`; `isClosedStatus` deja de aplicarse a ellas; `resultFieldsFor` usa `computePolygonalDetected` y escribe `precision_order` y `angle_type`. Nivelación y visitas no cambian.
- Test: `fixtures.test.ts` y `process-list.test.ts`, si fijaban estados cerrados de poligonal.

- [ ] **Step 1: Pruebas actualizadas (RED donde cambie la regla). Step 2: Implementar. Step 3: `npm test`, typecheck y lint. Step 4: Commit** — `feat: hub, Excel, demo y seed de la poligonal sin cierre`

---

### Task 12: Base — paso 2 (después del merge)

**Files:**
- Create: `supabase/migrations/20261006000000_poligonal_sin_cierre.sql`
- Modify: `supabase/tests/poligonal_sin_cierre.test.sql` (`hasnt_column` de `closed_at` y `closed_by`; el `CHECK` rechaza `status = 'closed'`)
- Modify: `src/types/database.ts`, que quita las dos columnas de la poligonal.

```sql
-- Fase 35 — paso 2, DESPUÉS del merge: el código viejo cierra escribiendo estas
-- columnas. Borra el registro de cierre de la poligonal (decisión 18).
update public.polygonal_processes set status = 'calculated' where status in ('closed', 'rejected');
alter table public.polygonal_processes
  drop column closed_at,
  drop column closed_by,
  drop constraint polygonal_processes_status_check,
  add constraint polygonal_processes_status_check
    check (status in ('draft', 'in_progress', 'calculated'));
```

El nombre real del `CHECK` se comprueba con `\d polygonal_processes` en `psql` antes de escribirlo.

- [ ] **Step 1: pgTAP (RED). Step 2: migración local y `test db` (GREEN). Step 3: tipos y `typecheck`** (nada de la poligonal nombra ya esas columnas; si algo las nombra, es un resto de las Tareas 5 a 11). **Step 4: Commit** — `feat: la poligonal pierde el registro de cierre`

---

### Task 13: Documentación, capturas y verificación en pantalla

**Files:**
- `docs/manual/README.md` y `src/app/(app)/manual/page.tsx` y `manual-data.ts`, en el mismo commit:
  - § 5 (poligonal): alta, pasos, amarre, medición, ajuste, informe;
  - § 8 «Cerrar un proceso»: «La poligonal no se cierra»; el cierre queda para nivelación y asentamientos;
  - § 10, las preguntas frecuentes y las capturas.
- `docs/manual/capturas.mjs`: selectores nuevos.
  - 06: el popup de alta.
  - 07: la pestaña Datos.
  - 08: el orden alcanzado.
  - 09 y 10: se reutilizan para el Ajuste y la corrección del informe; se renombran en las dos copias del manual.
  - 17: Datos en el teléfono.
  - 20: el dibujo.
  - 21: mínimos cuadrados.
  - 22: Georreferenciar en el Ajuste.
  - 30: el informe.
- `docs/math/poligonales.html`: el orden detectado, el tipo detectado, el datum en mínimos cuadrados y el factor de cada método.
- `docs/tecnica/README.md`: modelo, inmutabilidad (la poligonal fuera), informes, pruebas, § 11 entrada por entrada (precisiones del equipo y `angle_readings_min` sin uso; la nivelación y los asentamientos aún se cierran).
- `PRD-TopoField.md` § 4.6 y `CLAUDE.md`: la poligonal no se cierra.
- `docs/prds/34-ux-poligonal.md`: divergencias. `docs/method.md` y `prds/README.md`: cerrada al final. `pendientes.md`: resuelta.

- [ ] **Step 1: Verificación en pantalla.**

En un dev en el 3001 de la carpeta principal, o en el 3000 si no hay otro. Script de Playwright en el scratchpad, con los criterios a–m del PRD:
- alta en popup;
- la TT4 capturada por popups: amarre V10/TT4, seis lados con «Cierre» y el cierre angular;
- la tabla, los azimuts y el cierre angular (1080°00′12″, 12″, −1.71″);
- recargar conserva el cierre angular;
- el ajuste por los cuatro métodos, con tercer orden y las coordenadas de la hoja;
- el informe con la corrección de cada método y sus fórmulas MathML visibles;
- el selector DMS/decimal en tabla, ajuste, informe y popup;
- 390 px sin desborde;
- una abierta con control (la demo «Enlace P1-P3») editada en el popup conserva la deflexión;
- un error de guardado se queda en el popup;
- el consolidado con una poligonal que no alcanza orden la admite y alerta;
- nivelación y visitas siguen cerrando y reabriendo.

Los datos del seed que se toquen se restauran por SQL al final.

- [ ] **Step 2: Capturas**

`PORT=… node docs/manual/capturas.mjs`, comparar contra `HEAD` y quedarse solo con las que cambian por la fase.

- [ ] **Step 3: Documentación; typecheck, lint, test, test db y build. Commit** — `docs: …`

- [ ] **Step 4: Cierre**

Revisión independiente de toda la rama y una pasada de correcciones. Después, `db push` del paso 1 con el visto bueno del usuario, PR, merge (con su visto bueno) y `db push` del paso 2.
