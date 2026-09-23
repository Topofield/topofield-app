# Fase 9 — Cadena de distancias de nivelación · Plan de implementación

> **Para trabajadores agénticos:** SUB-SKILL REQUERIDA: usa
> superpowers:subagent-driven-development (recomendada) o
> superpowers:executing-plans para implementar este plan tarea por tarea. Los
> pasos usan sintaxis de casilla (`- [ ]`) para seguimiento.

**Objetivo:** Que la distancia del recorrido de nivelación se derive de las mediciones en vez de teclearse, capturando opcionalmente los tres hilos estadimétricos que la producen.

**Arquitectura:** La distancia por visual (atrás y adelante) pasa a ser la única entrada de la cadena; el acumulado por fila y el total del proceso se derivan de ella y quedan en solo lectura. Los hilos superior e inferior son opcionales y, cuando están, derivan la distancia de su visual y habilitan dos controles de calidad nuevos. El motor de cotas no se toca: sigue consumiendo `backsight`/`foresight`.

**Stack:** Next.js 16 (App Router) · React 19 · TypeScript · Supabase (PostgreSQL) · Vitest · Tailwind v4

**PRD:** [`docs/prds/08-cadena-distancias-nivelacion.md`](../../prds/08-cadena-distancias-nivelacion.md)
**Diseño:** [`docs/superpowers/specs/2026-09-22-fase-9-cadena-distancias-nivelacion-design.md`](../specs/2026-09-22-fase-9-cadena-distancias-nivelacion-design.md)
**Cartera de referencia:** [`docs/carteras/analisis-nivelacion-verjon.md`](../../carteras/analisis-nivelacion-verjon.md)
**Rama:** `fase-9-cadena-distancias-nivelacion`

## Restricciones globales

Aplican a **todas** las tareas. Salen de `CLAUDE.md` y del PRD:

- `src/lib/calculations/` son **funciones puras**: sin React, sin hooks, sin Supabase. Solo math.
- Las tolerancias viven en `src/lib/calculations/tolerances.ts` como constantes, **nunca hardcodeadas** en componentes.
- Cotas a **4 decimales**, coordenadas a 3, ángulos en DMS.
- Idioma de la interfaz: **español (Colombia)**. Zona horaria `America/Bogota`.
- No usar shadcn/ui ni ninguna librería de componentes: el sistema de diseño está en `src/components/design-system/`.
- Los procesos con `status` `closed` o `rejected` son **inmutables**. Nunca generar `UPDATE` sobre ellos.
- Migraciones de `supabase/` **se editan a mano**, nunca se autogeneran.
- Commits en **español** con prefijo `feat:`, `fix:`, `refactor:` o `docs:`. Un commit por cambio lógico.
- Ejecutar `npm run typecheck` después de cada cambio de código.
- `npm test` corre la suite completa (Vitest). Al empezar la fase: **448 tests en 26 archivos**.
- **Antes de crear una función en una migración**, hacer `grep` de su nombre en `supabase/migrations/`. La Fase 7 pisó en silencio una función homónima y dejó un trigger ejecutando el cuerpo de otro módulo.

## Foco de revisión

Cinco clases de entrada que el PRD implica y que conviene vigilar. Cada una tiene su test en la tarea que posee el código:

1. **Fila con hilos parciales** — solo superior, o solo inferior. No es un dato imposible (el orden no se puede comprobar con uno solo) pero tampoco produce distancia. Debe quedar sin derivar y sin bloquear. → Tarea 2.
2. **Hilos iguales** (`HS == HI`) — distancia cero, que envenena el acumulado igual que una negativa. La regla del PRD dice `HS > HI`, así que debe bloquear. → Tarea 4.
3. **Recorrido de vuelta** — todas las reglas valen igual para `input.return`, que es una libreta independiente con su propia cadena de distancias. Un fallo aquí no lo ve ningún test de la ida. → Tarea 3.
4. **Proceso sin filas** o con una sola — `totalDistanceFromReadings` sobre una libreta vacía no debe devolver `NaN` ni `Infinity`. El precedente existe: la Fase 4 tuvo un «NaN mm» en pantalla. → Tarea 3.
5. **Proceso reconstruido por el backfill** — el equilibrado no se evalúa y la UI lo indica. Si se evaluara, saldría perfecto siempre: un aviso falso de conformidad. → Tareas 4 y 7.

## Estructura de archivos

| Archivo | Responsabilidad | Tarea |
|---|---|---|
| `supabase/migrations/<ts>_cadena_distancias_nivelacion.sql` | Crear | Columnas nuevas, backfill, borrado de `distance_m` | 6 |
| `src/types/leveling.ts` | Modificar | `ReadingInput` con hilos y distancias por visual | 1 |
| `src/lib/calculations/tolerances.ts` | Modificar | Constantes de equilibrado y de hilo medio | 4 |
| `src/lib/calculations/leveling.ts` | Modificar | `stadiaDistance`, `accumulateDistances`, `totalDistanceFromReadings` | 2, 3 |
| `src/lib/validators/leveling.ts` | Modificar | Reglas nuevas; reescribir el comentario de la deuda | 4 |
| `src/components/leveling/readings-table.tsx` | Modificar | Columnas de hilos y distancias; acumulado en solo lectura | 7 |
| `src/components/leveling/leveling-editor.tsx` | Modificar | Total derivado; guard de `level_type` | 8 |
| `src/app/(app)/projects/[id]/leveling/[pid]/actions.ts` | Modificar | Persistir lo derivado, no lo recibido | 9 |
| `scripts/seed.mjs` | Modificar | Escribir distancias por visual | 10 |
| `src/lib/export/leveling-workbook.ts` | Modificar | Columnas nuevas en el Excel | 11 |
| `src/components/leveling/results-panel.tsx` | Revisar | Consumidor del acumulado derivado | 11.bis |
| `src/app/(app)/projects/[id]/reports/[reportId]/print/page.tsx` | Revisar | Consumidor del total persistido | 11.bis |
| `docs/manual/README.md` + `src/app/(app)/manual/` | Modificar | Manual en sus dos copias | 12 |
| `docs/tecnica/README.md` | Modificar | Estado de fases, pruebas, deuda resuelta | 12 |

**Orden de dependencias:** 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10 → 11 → 11.bis → 12.

Las tareas 2, 3 y 4 son motor puro y se pueden revisar por separado. De la 7 en
adelante todo es UI y persistencia, donde las Fases 4-8 concentraron sus fallos
—y donde los dos más graves vivieron en **costuras entre tareas**, no dentro de
ninguna—. La 11.bis existe para recorrer esas costuras a propósito.

---

### Tarea 1: Tipos del contrato de lectura

**Archivos:**
- Modificar: `src/types/leveling.ts:58-71` (`ReadingInput`)

**Interfaces:**
- Consume: nada.
- Produce: `ReadingInput` con seis campos nuevos. **Todas** las tareas siguientes dependen de esta forma exacta.

- [ ] **Paso 1: Añadir los campos a `ReadingInput`**

En `src/types/leveling.ts`, reemplazar la interfaz `ReadingInput` entera:

```ts
export interface ReadingInput {
  pointCode: string;
  pointType: PointType;
  backsight: number | null;
  foresight: number | null;
  /**
   * Hilos estadimétricos de la visual atrás. OPCIONALES: con nivel automático
   * el topógrafo puede anotar solo la lectura y medir la distancia a cinta.
   * Verificado contra la cartera de El Verjón, donde dos armadas de doce no
   * traen el hilo inferior.
   *
   * El hilo MEDIO no tiene campo propio: es `backsight`. Darle uno crearía dos
   * fuentes de verdad para el mismo número.
   */
  backUpperM: number | null;
  backLowerM: number | null;
  /** Ídem para la visual adelante; el hilo medio es `foresight`. */
  foreUpperM: number | null;
  foreLowerM: number | null;
  /**
   * Distancia a cada mira, en metros. Derivada de los hilos cuando los hay, o
   * tecleada. Es la ÚNICA entrada de la cadena de distancias: el acumulado y
   * el total se derivan de ella.
   */
  backDistanceM: number | null;
  foreDistanceM: number | null;
  /**
   * DERIVADO. Lo calcula `accumulateDistances`; la UI lo muestra en solo
   * lectura y el servidor lo persiste. Se conserva en el contrato porque el
   * informe y el export lo leen sin recalcular.
   */
  distanceAccumulatedKm: number | null;
}
```

Nótese que `distanceM` **desaparece** del contrato.

- [ ] **Paso 2: Verificar que el typecheck falla y contar los consumidores**

Run: `npm run typecheck 2>&1 | tail -30`
Expected: FAIL. Los errores son la lista de consumidores reales de `distanceM` — anótala, las tareas siguientes los recorren uno por uno.

> El cierre de la Fase 8 dejó la regla: **un conteo de errores que sube al corregir un tipo no es un paso atrás, es el conteo real saliendo a la luz.**

- [ ] **Paso 3: Commit**

```bash
git add src/types/leveling.ts
git commit -m "refactor: ReadingInput con hilos y distancias por visual"
```

---

### Tarea 2: `stadiaDistance`

**Archivos:**
- Modificar: `src/lib/calculations/leveling.ts`
- Test: `src/lib/calculations/leveling.test.ts`

**Interfaces:**
- Consume: nada.
- Produce: `stadiaDistance(upper: number, lower: number, k?: number): number`

- [ ] **Paso 1: Escribir el test que falla**

Añadir a `src/lib/calculations/leveling.test.ts`:

```ts
describe("stadiaDistance", () => {
  it("D = (HS − HI)·100", () => {
    expect(stadiaDistance(1.5, 1.3)).toBeCloseTo(20.0, 6);
  });

  it("reproduce la primera armada de El Verjón", () => {
    // Cartera real: I3 = (1.367 − 1.052)·100 = 31.5 m
    expect(stadiaDistance(1.367, 1.052)).toBeCloseTo(31.5, 6);
    // K6 = (0.410 − 0.125)·100 = 28.5 m
    expect(stadiaDistance(0.41, 0.125)).toBeCloseTo(28.5, 6);
  });

  it("admite otra constante estadimétrica", () => {
    expect(stadiaDistance(1.5, 1.3, 50)).toBeCloseTo(10.0, 6);
  });
});
```

- [ ] **Paso 2: Ejecutar para ver el fallo**

Run: `npx vitest run src/lib/calculations/leveling.test.ts -t stadiaDistance`
Expected: FAIL — `stadiaDistance is not defined`.

- [ ] **Paso 3: Implementar**

Añadir a `src/lib/calculations/leveling.ts`:

```ts
/**
 * Distancia por taquimetría sobre la mira: D = (HS − HI)·K.
 *
 * `K = 100` en instrumentos modernos. La visual de un nivel es horizontal por
 * construcción, así que NO lleva la corrección por cos²α que sí necesitaría un
 * teodolito inclinado.
 *
 * No valida el orden de los hilos: `HS ≤ HI` da un resultado nulo o negativo.
 * Rechazarlo es responsabilidad del validador (`validators/leveling.ts`), que
 * bloquea porque una distancia negativa envenena el acumulado, el total y con
 * ellos la tolerancia K·√D.
 */
export function stadiaDistance(upper: number, lower: number, k = 100): number {
  return (upper - lower) * k;
}
```

- [ ] **Paso 4: Verificar que pasa**

Run: `npx vitest run src/lib/calculations/leveling.test.ts -t stadiaDistance`
Expected: PASS (3 tests).

- [ ] **Paso 5: Test del hilo parcial (foco de revisión 1)**

```ts
describe("distanceFromWires", () => {
  it("con un solo hilo devuelve null: no hay distancia derivable", () => {
    expect(distanceFromWires(1.5, null)).toBeNull();
    expect(distanceFromWires(null, 1.3)).toBeNull();
    expect(distanceFromWires(null, null)).toBeNull();
  });

  it("con los dos hilos deriva la distancia", () => {
    expect(distanceFromWires(1.5, 1.3)).toBeCloseTo(20.0, 6);
  });
});
```

- [ ] **Paso 6: Implementar `distanceFromWires`**

```ts
/**
 * Distancia derivada de un par de hilos, o `null` si el par está incompleto.
 *
 * Los hilos son opcionales y pueden venir a medias (la cartera de El Verjón
 * tiene dos armadas sin hilo inferior). Un par incompleto no deriva nada y
 * tampoco es un error: la distancia se teclea.
 */
export function distanceFromWires(
  upper: number | null,
  lower: number | null,
): number | null {
  if (upper == null || lower == null) return null;
  return stadiaDistance(upper, lower);
}
```

- [ ] **Paso 7: Verificar y commitear**

Run: `npx vitest run src/lib/calculations/leveling.test.ts`
Expected: PASS.

```bash
git add src/lib/calculations/leveling.ts src/lib/calculations/leveling.test.ts
git commit -m "feat: distancia por taquimetría desde los tres hilos"
```

---

### Tarea 3: Cadena de acumulado y total

**Archivos:**
- Modificar: `src/lib/calculations/leveling.ts`
- Test: `src/lib/calculations/leveling.test.ts`

**Interfaces:**
- Consume: `distanceFromWires` de la Tarea 2; `ReadingInput` de la Tarea 1.
- Produce:
  - `resolveVisualDistances(reading: ReadingInput): { back: number | null; fore: number | null }`
  - `accumulateDistances(readings: ReadingInput[]): number[]` — metros, un valor por fila
  - `totalDistanceFromReadings(readings: ReadingInput[]): number` — **kilómetros**

> **Unidades:** `accumulateDistances` devuelve **metros** y `totalDistanceFromReadings` **kilómetros**, porque así los consume el resto del sistema (`distance_accumulated_km` y `total_distance_km`). Está a propósito y los tests lo fijan.

- [ ] **Paso 1: Test de la resolución de distancia por visual**

```ts
const bare = (over: Partial<ReadingInput> = {}): ReadingInput => ({
  pointCode: "P", pointType: "pc",
  backsight: null, foresight: null,
  backUpperM: null, backLowerM: null,
  foreUpperM: null, foreLowerM: null,
  backDistanceM: null, foreDistanceM: null,
  distanceAccumulatedKm: null,
  ...over,
});

describe("resolveVisualDistances", () => {
  it("deriva de los hilos cuando están", () => {
    const r = bare({ backUpperM: 1.367, backLowerM: 1.052 });
    expect(resolveVisualDistances(r).back).toBeCloseTo(31.5, 6);
  });

  it("usa la distancia tecleada cuando no hay hilos", () => {
    expect(resolveVisualDistances(bare({ backDistanceM: 30 })).back).toBe(30);
  });

  it("los hilos ganan sobre la distancia tecleada", () => {
    // La distancia es un campo autocompletado desde los hilos: si ambos están,
    // los hilos son la medición y la distancia su resultado.
    const r = bare({ backUpperM: 1.5, backLowerM: 1.3, backDistanceM: 999 });
    expect(resolveVisualDistances(r).back).toBeCloseTo(20.0, 6);
  });
});
```

- [ ] **Paso 2: Ejecutar para ver el fallo**

Run: `npx vitest run src/lib/calculations/leveling.test.ts -t resolveVisualDistances`
Expected: FAIL — no definida.

- [ ] **Paso 3: Implementar**

```ts
/**
 * Distancia efectiva de cada visual de una fila.
 *
 * Los hilos tienen prioridad sobre la distancia tecleada: cuando el par está
 * completo, los hilos SON la medición y la distancia es su resultado
 * autocompletado. Con el par incompleto o ausente, vale lo tecleado.
 */
export function resolveVisualDistances(reading: ReadingInput): {
  back: number | null;
  fore: number | null;
} {
  return {
    back: distanceFromWires(reading.backUpperM, reading.backLowerM)
      ?? reading.backDistanceM,
    fore: distanceFromWires(reading.foreUpperM, reading.foreLowerM)
      ?? reading.foreDistanceM,
  };
}
```

- [ ] **Paso 4: Test del acumulado, con el caso de El Verjón**

```ts
describe("accumulateDistances", () => {
  it("una armada acumula sus dos visuales", () => {
    const rows = [
      bare({ backDistanceM: 30 }),
      bare({ foreDistanceM: 30, backDistanceM: 25 }),
    ];
    expect(accumulateDistances(rows)).toEqual([30, 85]);
  });

  it("un intermedio no acumula, hereda, y LA CADENA CONTINÚA", () => {
    // Es el fallo exacto de la cartera de El Verjón: la vista intermedia
    // AUX 1 rompió la cadena de sumas de la hoja y se perdieron 24.7 m de
    // la distancia total, que es la que alimenta la tolerancia K·√D.
    const rows = [
      bare({ backDistanceM: 30 }),                                  // 30
      bare({ pointType: "intermediate" }),                          // 30 (hereda)
      bare({ foreDistanceM: 20, backDistanceM: 25 }),               // 75
      bare({ foreDistanceM: 15 }),                                  // 90
    ];
    expect(accumulateDistances(rows)).toEqual([30, 30, 75, 90]);
  });

  it("una fila sin distancias no rompe la cadena: aporta 0", () => {
    const rows = [
      bare({ backDistanceM: 30 }),
      bare({}),
      bare({ foreDistanceM: 20 }),
    ];
    expect(accumulateDistances(rows)).toEqual([30, 30, 50]);
  });

  it("libreta vacía devuelve lista vacía", () => {
    expect(accumulateDistances([])).toEqual([]);
  });
});
```

- [ ] **Paso 5: Test del total (foco de revisión 4)**

```ts
describe("totalDistanceFromReadings", () => {
  it("devuelve el acumulado de la última fila, en km", () => {
    const rows = [
      bare({ backDistanceM: 300 }),
      bare({ foreDistanceM: 300, backDistanceM: 150 }),
      bare({ foreDistanceM: 150 }),
    ];
    expect(totalDistanceFromReadings(rows)).toBeCloseTo(0.9, 9);
  });

  it("libreta vacía devuelve 0, nunca NaN ni Infinity", () => {
    // La Fase 4 tuvo un «NaN mm» en pantalla; no se repite.
    const total = totalDistanceFromReadings([]);
    expect(total).toBe(0);
    expect(Number.isFinite(total)).toBe(true);
  });

  it("una sola fila sin distancias devuelve 0", () => {
    expect(totalDistanceFromReadings([bare({})])).toBe(0);
  });

  it("un intermedio al final no altera el total", () => {
    const rows = [
      bare({ backDistanceM: 300 }),
      bare({ foreDistanceM: 300 }),
      bare({ pointType: "intermediate" }),
    ];
    expect(totalDistanceFromReadings(rows)).toBeCloseTo(0.6, 9);
  });
});
```

- [ ] **Paso 6: Implementar ambas**

```ts
/**
 * Distancia acumulada por fila, en METROS, desde las distancias por visual.
 *
 * Una armada aporta la distancia a la mira de atrás más la de adelante. Los
 * puntos `intermediate` aportan 0 y HEREDAN el acumulado de la armada de la
 * que cuelgan — que es lo que `applyProportionalCorrection` necesita para
 * interpolarles la corrección—, y la cadena continúa detrás de ellos.
 *
 * Que la cadena continúe no es un detalle: en la cartera de El Verjón una
 * vista intermedia rompió la suma de la hoja de cálculo y dejó 24.7 m fuera
 * del total, con el veredicto de cierre emitido sobre el número equivocado.
 */
export function accumulateDistances(readings: ReadingInput[]): number[] {
  let running = 0;
  return readings.map((reading) => {
    if (reading.pointType === "intermediate") return running;
    const { back, fore } = resolveVisualDistances(reading);
    running += (fore ?? 0) + (back ?? 0);
    return running;
  });
}

/**
 * Distancia total del recorrido, en KILÓMETROS.
 *
 * Es el acumulado de la última fila. Por construcción coincide con el
 * acumulado de la fila terminal, que es lo que hace que el punto de cierre
 * cierre exactamente contra su cota conocida: la invariante que esta fase
 * establece y que el JSDoc de `applyProportionalCorrection` solo podía
 * documentar como contrato no verificado.
 */
export function totalDistanceFromReadings(readings: ReadingInput[]): number {
  const acc = accumulateDistances(readings);
  return (acc[acc.length - 1] ?? 0) / 1000;
}
```

- [ ] **Paso 7: Test de la invariante y del recorrido de vuelta (foco de revisión 3)**

```ts
describe("la invariante de la cadena", () => {
  it("el acumulado terminal es igual al total, por construcción", () => {
    const rows = [
      bare({ backDistanceM: 31.5 }),
      bare({ foreDistanceM: 28.5, backDistanceM: 28.1 }),
      bare({ foreDistanceM: 15.7 }),
    ];
    const acc = accumulateDistances(rows);
    expect(acc[acc.length - 1] / 1000).toBeCloseTo(
      totalDistanceFromReadings(rows), 12,
    );
  });

  it("vale igual en el recorrido de vuelta", () => {
    // La vuelta es una libreta independiente con su propia cadena. Un fallo
    // aquí no lo vería ningún test de la ida.
    const vuelta = [
      bare({ backDistanceM: 14.3 }),
      bare({ foreDistanceM: 13.5, backDistanceM: 15.2 }),
      bare({ foreDistanceM: 22.6 }),
    ];
    const acc = accumulateDistances(vuelta);
    expect(acc[acc.length - 1] / 1000).toBeCloseTo(
      totalDistanceFromReadings(vuelta), 12,
    );
  });
});
```

- [ ] **Paso 8: Verificar y commitear**

Run: `npm test`
Expected: PASS.

```bash
git add src/lib/calculations/leveling.ts src/lib/calculations/leveling.test.ts
git commit -m "feat: acumulado y total derivados de las distancias por visual"
```

---

### Tarea 4: Validación de hilos, distancia y equilibrado

**Archivos:**
- Modificar: `src/lib/calculations/tolerances.ts`
- Modificar: `src/lib/validators/leveling.ts:19-38` y `:50-95`
- Test: `src/lib/validators/leveling.test.ts`

**Interfaces:**
- Consume: `ReadingInput` (T1), `resolveVisualDistances` (T3).
- Produce: `ReadingCaptureIssues` con claves nuevas en `errors` y `warnings`; `SIGHT_BALANCE_LIMIT_M`; `MIDDLE_WIRE_TOLERANCE_M`.

- [ ] **Paso 1: Constantes de tolerancia**

Añadir a `src/lib/calculations/tolerances.ts`, junto a `LEVELING_TOLERANCE_K`:

```ts
/**
 * Equilibrado de visuales: diferencia máxima admisible entre la distancia a
 * la mira de atrás y la de adelante dentro de una misma armada, en metros.
 *
 * Equilibrar las visuales cancela el error de colimación del nivel: si la
 * visual sale inclinada, el mismo error entra con signo opuesto en las dos
 * lecturas y se anula al restarlas. Cuanto más exigente el orden, menos
 * desequilibrio se admite.
 *
 * Esta validación quedó pendiente desde la Fase 4, que registró como deuda que
 * una sola `distance_m` por fila no permitía comprobarla: el equilibrado
 * compara d_atrás con d_adelante DENTRO de una armada. La Fase 9 captura las
 * dos distancias por separado y la deuda se paga aquí.
 */
export const SIGHT_BALANCE_LIMIT_M: Record<PrecisionOrder, number> = {
  primer_orden: 2,
  segundo_orden: 3,
  tercer_orden: 4,
  ordinario: 6,
};

/**
 * Tolerancia de la comprobación del hilo medio, en metros.
 *
 * El hilo medio debe ser el promedio de los otros dos: `m = (HS + HI)/2`. La
 * cifra es de lectura de mira, no de cálculo: 2 mm admite el error de
 * apreciación al leer tres hilos sobre una mira centimetrada sin dejar pasar
 * una transcripción equivocada.
 */
export const MIDDLE_WIRE_TOLERANCE_M = 0.002;
```

- [ ] **Paso 2: Tests de las reglas que bloquean**

Añadir a `src/lib/validators/leveling.test.ts`:

```ts
describe("validación de hilos", () => {
  it("hilos desordenados bloquean: HS debe ser mayor que HI", () => {
    const issues = validateReadingCapture(
      bare({ backUpperM: 1.2, backLowerM: 1.5, backDistanceM: 30 }),
    );
    expect(issues.errors.backWires).toBeDefined();
  });

  it("hilos iguales bloquean: la distancia sería cero", () => {
    // Foco de revisión 2: una distancia nula envenena el acumulado igual que
    // una negativa.
    const issues = validateReadingCapture(
      bare({ backUpperM: 1.4, backLowerM: 1.4, backDistanceM: 30 }),
    );
    expect(issues.errors.backWires).toBeDefined();
  });

  it("un par de hilos incompleto no bloquea", () => {
    // Foco de revisión 1: sin los dos no hay orden que comprobar. La cartera
    // de El Verjón trae dos armadas así.
    const issues = validateReadingCapture(
      bare({ backUpperM: 1.5, backLowerM: null, backDistanceM: 30 }),
    );
    expect(issues.errors.backWires).toBeUndefined();
  });

  it("el hilo medio incoherente AVISA, no bloquea", () => {
    const issues = validateReadingCapture(
      bare({ backsight: 1.500, backUpperM: 1.700, backLowerM: 1.200 }),
    );
    // (1.700 + 1.200)/2 = 1.450, difiere de 1.500 en 50 mm
    expect(issues.warnings.backsight).toBeDefined();
    expect(issues.errors.backsight).toBeUndefined();
  });

  it("el hilo medio dentro de tolerancia no avisa", () => {
    const issues = validateReadingCapture(
      bare({ backsight: 1.4505, backUpperM: 1.700, backLowerM: 1.200 }),
    );
    expect(issues.warnings.backsight).toBeUndefined();
  });
});

describe("validación de distancia por visual", () => {
  it("bloquea si falta en un pc", () => {
    const issues = validateReadingCapture(
      bare({ pointType: "pc", backsight: 1.5, foresight: 1.2 }),
    );
    expect(issues.errors.backDistanceM).toBeDefined();
  });

  it("no bloquea en un intermedio", () => {
    const issues = validateReadingCapture(
      bare({ pointType: "intermediate", foresight: 1.2 }),
    );
    expect(issues.errors.foreDistanceM).toBeUndefined();
  });

  it("no exige distancia a una visual que no existe", () => {
    // La primera fila (bm) no lleva lectura adelante: no hay visual adelante
    // que medir.
    const issues = validateReadingCapture(
      bare({ pointType: "bm", backsight: 1.5, backDistanceM: 30 }),
    );
    expect(issues.errors.foreDistanceM).toBeUndefined();
  });
});
```

- [ ] **Paso 3: Ejecutar para ver los fallos**

Run: `npx vitest run src/lib/validators/leveling.test.ts`
Expected: FAIL — las claves nuevas no existen.

- [ ] **Paso 4: Ampliar el tipo de issues**

En `src/lib/validators/leveling.ts`, reemplazar `ReadingCaptureIssues`:

```ts
export interface ReadingCaptureIssues {
  errors: Partial<
    Record<
      | "pointCode" | "pointType" | "backsight" | "foresight"
      | "backWires" | "foreWires"
      | "backDistanceM" | "foreDistanceM",
      string
    >
  >;
  warnings: Partial<
    Record<"backsight" | "foresight" | "sightBalance", string>
  >;
}
```

`distanceAccumulatedKm` sale de `errors`: el acumulado ya no se teclea, se deriva.

- [ ] **Paso 5: Reescribir el comentario de la deuda**

Reemplazar el bloque de `src/lib/validators/leveling.ts:33-38` — el que dice que el equilibrado «exigiría capturar ambas distancias por armada — un cambio de modelo de datos que no entra en esta fase», afirmación que la Fase 9 vuelve falsa:

```ts
// El equilibrado de visuales (|d_atrás − d_adelante| ≤ límite por orden) SÍ se
// valida desde la Fase 9: `backDistanceM` y `foreDistanceM` guardan una
// distancia por visual, que es lo que la comparación necesita. La deuda que la
// Fase 4 registró —una sola `distance_m` por fila no bastaba— queda pagada.
// Avisa, no bloquea: es un juicio sobre la calidad de una medición correcta en
// su forma.
```

> Regla del cierre de la Fase 4: **al cambiar el contrato de una función, actualizar su JSDoc en el mismo commit.** Un comentario desactualizado costó allí una ronda de corrección, dos veces en el mismo archivo.

- [ ] **Paso 6: Implementar las reglas**

Dentro de `validateReadingCapture`, tras la comprobación de `pointCode`, y **eliminando** el bloque de `distanceAccumulatedKm` de las líneas 65-74:

```ts
  // --- Hilos: orden y coherencia del medio ---------------------------------
  for (const side of ["back", "fore"] as const) {
    const upper = side === "back" ? reading.backUpperM : reading.foreUpperM;
    const lower = side === "back" ? reading.backLowerM : reading.foreLowerM;
    const middle = side === "back" ? reading.backsight : reading.foresight;
    const wireKey = side === "back" ? "backWires" : "foreWires";

    // Con el par incompleto no hay orden que comprobar. No es un error: los
    // hilos son opcionales y la cartera de El Verjón trae dos armadas así.
    if (upper == null || lower == null) continue;

    if (upper <= lower) {
      errors[wireKey] =
        "El hilo superior debe ser mayor que el inferior: la distancia saldría nula o negativa.";
      continue;
    }

    if (middle != null) {
      const expected = (upper + lower) / 2;
      if (Math.abs(middle - expected) > MIDDLE_WIRE_TOLERANCE_M) {
        warnings[side === "back" ? "backsight" : "foresight"] =
          `El hilo medio debería ser ${expected.toFixed(4)} m, el promedio de los otros dos.`;
      }
    }
  }

  // --- Distancia por visual ------------------------------------------------
  // Obligatoria donde la fila acumula. Sin ella el acumulado queda corto, el
  // total sale menor del real y el punto de cierre queda mal compensado, con
  // el proceso reportando que cumple. Es la traducción al modelo nuevo de la
  // regla que hasta la Fase 9 exigía `distanceAccumulatedKm`.
  if (reading.pointType !== "intermediate") {
    const { back, fore } = resolveVisualDistances(reading);
    if (reading.backsight != null && back == null) {
      errors.backDistanceM =
        "Falta la distancia a la mira de atrás: sin ella el recorrido no acumula.";
    }
    if (reading.foresight != null && fore == null) {
      errors.foreDistanceM =
        "Falta la distancia a la mira de adelante: sin ella el recorrido no acumula.";
    }
  }
```

- [ ] **Paso 7: Verificar**

Run: `npx vitest run src/lib/validators/leveling.test.ts`
Expected: PASS.

- [ ] **Paso 8: Test del equilibrado, incluido el caso reconstruido**

```ts
describe("equilibrado de visuales", () => {
  it("avisa cuando la diferencia pasa del límite del orden", () => {
    // tercer_orden admite 4 m; aquí hay 20.
    const issues = validateSightBalance(
      bare({ backsight: 1.5, foresight: 1.2, backDistanceM: 40, foreDistanceM: 20 }),
      "tercer_orden",
      false,
    );
    expect(issues.warnings.sightBalance).toBeDefined();
  });

  it("no avisa dentro del límite", () => {
    const issues = validateSightBalance(
      bare({ backsight: 1.5, foresight: 1.2, backDistanceM: 31.5, foreDistanceM: 28.5 }),
      "tercer_orden",
      false,
    );
    expect(issues.warnings.sightBalance).toBeUndefined();
  });

  it("NO evalúa en un proceso reconstruido por el backfill", () => {
    // Foco de revisión 5: allí las distancias se repartieron por mitades, así
    // que el equilibrado saldría perfecto siempre — un aviso falso de
    // conformidad.
    const issues = validateSightBalance(
      bare({ backsight: 1.5, foresight: 1.2, backDistanceM: 40, foreDistanceM: 20 }),
      "tercer_orden",
      true,
    );
    expect(issues.warnings.sightBalance).toBeUndefined();
  });
});
```

- [ ] **Paso 9: Implementar `validateSightBalance`**

```ts
/**
 * Equilibrado de visuales de una armada (§ 5.1, deuda de la Fase 4 pagada en
 * la Fase 9).
 *
 * `distancesReconstructed` viene de `leveling_processes`: en los procesos que
 * el backfill reconstruyó, las dos distancias salen de repartir por mitades la
 * diferencia del acumulado, así que el equilibrado saldría perfecto por
 * construcción. Evaluarlo allí sería emitir una conformidad que el dato no
 * respalda.
 */
export function validateSightBalance(
  reading: ReadingInput,
  order: PrecisionOrder,
  distancesReconstructed: boolean,
): ReadingCaptureIssues {
  const errors: ReadingCaptureIssues["errors"] = {};
  const warnings: ReadingCaptureIssues["warnings"] = {};

  if (distancesReconstructed) return { errors, warnings };

  const { back, fore } = resolveVisualDistances(reading);
  if (back == null || fore == null) return { errors, warnings };

  const limit = SIGHT_BALANCE_LIMIT_M[order];
  const diff = Math.abs(back - fore);
  if (diff > limit) {
    warnings.sightBalance =
      `Visuales desequilibradas: ${diff.toFixed(1)} m de diferencia, el límite del orden es ${limit} m.`;
  }

  return { errors, warnings };
}
```

- [ ] **Paso 10: Verificar y commitear**

Run: `npm test && npm run typecheck`
Expected: PASS y typecheck limpio de estos archivos.

```bash
git add src/lib/calculations/tolerances.ts src/lib/validators/leveling.ts src/lib/validators/leveling.test.ts
git commit -m "feat: valida hilos, distancia por visual y equilibrado de visuales"
```

---

### Tarea 5: `computeLeveling` consume la cadena derivada

**Archivos:**
- Modificar: `src/lib/calculations/leveling.ts:120-128` (JSDoc) y `:175-220`
- Test: `src/lib/calculations/leveling.test.ts`

**Interfaces:**
- Consume: `totalDistanceFromReadings`, `accumulateDistances` (T3).
- Produce: `computeLeveling` con `totalDistanceKm` derivado. **`LevelingInput.totalDistanceKm` desaparece.**

- [ ] **Paso 1: Test de la invariante de cierre**

```ts
it("el BM final cierra EXACTAMENTE contra su cota conocida", () => {
  // La prueba que el contrato del JSDoc nunca pudo hacer. Antes de la Fase 9
  // una fila con el acumulado mal puesto dejaba el cierre en 99.992 mientras
  // el proceso informaba que cumplía.
  const result = computeLeveling({
    type: "closed",
    startElevation: 100.0,
    endElevation: null,
    order: "tercer_orden",
    forward: [
      bare({ pointCode: "BM-1", pointType: "bm", backsight: 1.5, backDistanceM: 150 }),
      bare({ pointCode: "PC-1", pointType: "pc", foresight: 1.2, backsight: 2.0,
             foreDistanceM: 150, backDistanceM: 150 }),
      bare({ pointCode: "PC-2", pointType: "pc", foresight: 2.5, backsight: 1.0,
             foreDistanceM: 150, backDistanceM: 150 }),
      bare({ pointCode: "BM-1", pointType: "bm", foresight: 0.808, foreDistanceM: 150 }),
    ],
    return: null,
  });

  const last = result.forward.readings[result.forward.readings.length - 1];
  expect(last.elevationCorrected).toBeCloseTo(100.0, 10);
});

it("deriva totalDistanceKm de las lecturas", () => {
  const result = computeLeveling({
    type: "closed", startElevation: 100, endElevation: null, order: "tercer_orden",
    forward: [
      bare({ pointType: "bm", backsight: 1.5, backDistanceM: 450 }),
      bare({ pointType: "bm", foresight: 1.5, foreDistanceM: 450 }),
    ],
    return: null,
  });
  // 900 m → K·√0.9 con K=12 → 11.38 mm
  expect(result.toleranceMm).toBeCloseTo(12 * Math.sqrt(0.9), 6);
});

it("sin distancias no calcula tolerancia, y no produce NaN", () => {
  const result = computeLeveling({
    type: "closed", startElevation: 100, endElevation: null, order: "tercer_orden",
    forward: [
      bare({ pointType: "bm", backsight: 1.5 }),
      bare({ pointType: "bm", foresight: 1.5 }),
    ],
    return: null,
  });
  expect(result.toleranceMm).toBeNull();
  expect(result.meetsTolerance).toBeNull();
  expect(result.closureErrorMm).not.toBeNaN();
});
```

- [ ] **Paso 2: Ejecutar para ver el fallo**

Run: `npx vitest run src/lib/calculations/leveling.test.ts`
Expected: FAIL — `totalDistanceKm` sigue siendo obligatorio en `LevelingInput`.

- [ ] **Paso 3: Quitar `totalDistanceKm` de `LevelingInput`**

En `src/types/leveling.ts`, borrar de `LevelingInput`:

```ts
  /** Distancia del recorrido en UN solo sentido, en km (decisión #9). */
  totalDistanceKm: number;
```

- [ ] **Paso 4: Derivar dentro de `computeLeveling`**

En `src/lib/calculations/leveling.ts`, sustituir el bloque de `hasValidDistance` (líneas ~186-198) por:

```ts
  // La distancia ya no se teclea: se deriva de las distancias por visual de la
  // propia libreta. Eso hace que el acumulado terminal y el total sean el mismo
  // número por construcción, y con ello que el punto de cierre cierre exacto.
  const totalDistanceKm = totalDistanceFromReadings(input.forward);

  // Una libreta sin distancias capturadas da 0. Sin distancia no hay con qué
  // evaluar K·√D, así que la tolerancia queda en null en vez de propagar NaN
  // (que además volvería `meetsTolerance` false sin significar nada, porque
  // toda comparación con NaN es false). El error de cierre NO depende de la
  // distancia y se sigue calculando igual.
  const hasValidDistance = Number.isFinite(totalDistanceKm) && totalDistanceKm > 0;
```

Y sustituir cada uso posterior de `input.totalDistanceKm` por `totalDistanceKm`.

La distancia de la **vuelta** se deriva por separado, porque es un recorrido independiente con su propia cadena:

```ts
    // La vuelta tiene su propia distancia: es otra medición, con otras armadas
    // y a menudo otra longitud. En la cartera de El Verjón la ida mide 384.3 m
    // y la vuelta 397.6 m.
    const returnDistanceKm = totalDistanceFromReadings(input.return);
    if (returnDistanceKm > 0) {
      discrepancyToleranceMm =
        levelingTolerance(input.order, Math.min(totalDistanceKm, returnDistanceKm))
        * Math.SQRT2;
      meetsDiscrepancy = discrepancyMm <= discrepancyToleranceMm;
    }
```

> **Por qué `Math.min`:** evaluar con la distancia del recorrido contrario es lo que hace la hoja de El Verjón (usa `K42`, la de la vuelta, para juzgar el cierre), y es arbitrario. Tomar la menor de las dos es el criterio conservador: la tolerancia más estricta de las que cualquiera de los dos recorridos justificaría.

- [ ] **Paso 5: Escribir el acumulado derivado en las filas**

Dentro de `computeRun`, antes del `map`, calcular la cadena y asignarla:

```ts
  const accumulated = accumulateDistances(readings);
```

y en el objeto devuelto por el `map`, con el índice de la fila:

```ts
      distanceAccumulatedKm: accumulated[index] / 1000,
```

(cambiar la firma del `map` a `(reading, index) => {`).

- [ ] **Paso 6: Reescribir el JSDoc de `applyProportionalCorrection`**

Sustituir el bloque `CONTRATO:` de las líneas 118-128 por:

```ts
 * INVARIANTE (desde la Fase 9): `distanceAccumulatedKm` ya no se teclea — lo
 * deriva `accumulateDistances` de las distancias por visual—, así que el
 * acumulado de la fila terminal es igual a `totalDistanceKm` por construcción.
 * El punto final cierra por tanto exactamente contra su cota conocida.
 *
 * Antes de la Fase 9 esto era un contrato NO verificado: una fila terminal con
 * el acumulado mal puesto dejaba el cierre descompensado en silencio, con el
 * proceso reportando conformidad. Medido en la Fase 4: 99.992 en vez de
 * 100.000, con los −8 mm intactos.
```

- [ ] **Paso 7: Verificar y commitear**

Run: `npm test`
Expected: PASS. Algunos tests viejos que pasaban `totalDistanceKm` a mano fallarán — hay que adaptarlos a la forma nueva, **no** reintroducir el campo.

```bash
git add src/lib/calculations/leveling.ts src/types/leveling.ts src/lib/calculations/leveling.test.ts
git commit -m "feat: computeLeveling deriva la distancia total de la libreta"
```

---

### Tarea 6: Migración y backfill

**Archivos:**
- Crear: `supabase/migrations/<timestamp>_cadena_distancias_nivelacion.sql`
- Modificar: `src/types/database.ts` (regenerado)

**Interfaces:**
- Consume: nada del código TS.
- Produce: las columnas que las Tareas 7-11 leen y escriben.

- [ ] **Paso 1: Comprobar los triggers antes de escribir nada**

Run:
```bash
grep -rn "leveling_readings\|leveling_processes" supabase/migrations/*.sql | grep "create trigger"
```
Expected: exactamente estos dos que el backfill debe desactivar, más el de `updated_at`:
- `leveling_processes_reject_update_on_closed`
- `leveling_readings_reject_write_when_closed`

> La Fase 8 encontró **dos** triggers donde su encargo nombraba uno, y el backfill habría abortado sobre cualquier dato cerrado. Este paso existe por eso.

- [ ] **Paso 2: Escribir la migración**

```sql
-- ============================================================================
-- Cadena de distancias de nivelación — Fase 9 (N2 + N3)
-- ============================================================================
-- La distancia del recorrido deja de teclearse y pasa a derivarse de las
-- mediciones. Hasta ahora había tres campos de distancia sin relación
-- verificada entre sí, y de uno de ellos depende la tolerancia K·√D.
--
-- El caso que lo justifica es real: en la cartera de El Verjón una vista
-- intermedia rompió la cadena de sumas de la hoja de cálculo y dejó 24.7 m
-- fuera del total, con el veredicto de cierre emitido sobre ese número.
-- Ver docs/carteras/analisis-nivelacion-verjon.md.
-- ============================================================================

-- --- Columnas nuevas --------------------------------------------------------
-- Los hilos comparten tipo con las lecturas de mira, porque lecturas son. El
-- hilo MEDIO no lleva columna: es `backsight` / `foresight`. Darle una crearía
-- dos fuentes de verdad para el mismo número.
alter table public.leveling_readings
  add column back_upper_m    decimal(6,4),
  add column back_lower_m    decimal(6,4),
  add column fore_upper_m    decimal(6,4),
  add column fore_lower_m    decimal(6,4),
  -- decimal(8,3) da milímetro hasta 99999 m. La `distance_m` que se elimina
  -- era decimal(8,1), menos precisa de lo que la taquimetría produce.
  add column back_distance_m decimal(8,3),
  add column fore_distance_m decimal(8,3);

alter table public.leveling_processes
  add column distances_reconstructed boolean not null default false;

comment on column public.leveling_processes.distances_reconstructed is
  'Las distancias por visual las reconstruyó el backfill de la Fase 9 repartiendo por mitades la diferencia del acumulado. Sobre estos procesos el equilibrado de visuales NO se evalúa: saldría perfecto por construcción.';

-- --- Backfill ---------------------------------------------------------------
-- Toca filas de procesos que pueden estar cerrados, así que hay que desactivar
-- los dos triggers de inmutabilidad. Verificados contra
-- 20260812020455_leveling.sql:167-209.
alter table public.leveling_processes disable trigger leveling_processes_reject_update_on_closed;
alter table public.leveling_readings  disable trigger leveling_readings_reject_write_when_closed;

-- La diferencia sucesiva del acumulado da la distancia de cada armada. Cómo se
-- repartía entre la visual de atrás y la de adelante NO está en los datos: esa
-- información nunca se capturó. Se reparte por mitades y el proceso se marca.
with diffs as (
  select
    id,
    process_id,
    greatest(
      coalesce(distance_accumulated_km, 0) - coalesce(
        lag(distance_accumulated_km) over (
          partition by process_id, run_type order by reading_order
        ), 0
      ),
      0
    ) * 1000 as tramo_m
  from public.leveling_readings
  where point_type <> 'intermediate'
)
update public.leveling_readings r
set back_distance_m = round((d.tramo_m / 2)::numeric, 3),
    fore_distance_m = round((d.tramo_m / 2)::numeric, 3)
from diffs d
where r.id = d.id
  and d.tramo_m > 0;

update public.leveling_processes p
set distances_reconstructed = true
where exists (
  select 1 from public.leveling_readings r
  where r.process_id = p.id
    and (r.back_distance_m is not null or r.fore_distance_m is not null)
);

alter table public.leveling_readings  enable trigger leveling_readings_reject_write_when_closed;
alter table public.leveling_processes enable trigger leveling_processes_reject_update_on_closed;

-- --- La columna que nadie leía ---------------------------------------------
-- `distance_m` se capturaba desde la Fase 4 y ningún consumidor la leía. Su
-- sustituto son las dos distancias por visual.
alter table public.leveling_readings drop column distance_m;
```

- [ ] **Paso 3: Aplicar y verificar que el backfill conserva el veredicto**

Run:
```bash
npx supabase db reset
```

Luego, en `psql` o desde el editor de Supabase, comprobar sobre el circuito del seed que el acumulado recalculado coincide con el previo:

```sql
select
  p.name,
  p.total_distance_km,
  p.meets_tolerance,
  p.distances_reconstructed,
  sum(coalesce(r.back_distance_m,0) + coalesce(r.fore_distance_m,0)) / 1000 as total_derivado
from public.leveling_processes p
join public.leveling_readings r on r.process_id = p.id and r.run_type = 'forward'
group by p.id, p.name, p.total_distance_km, p.meets_tolerance, p.distances_reconstructed;
```

Expected: `total_derivado` igual a `total_distance_km` (0.9 para el circuito del seed), y `distances_reconstructed = true`.

- [ ] **Paso 4: Probar el backfill sobre un proceso cerrado**

No hay procesos cerrados de nivelación en el seed, así que hay que fabricar el caso — **la Fase 8 tuvo que hacer exactamente esto** y sin ello el defecto no se habría visto:

```sql
-- Antes de aplicar la migración, sobre la base ya sembrada:
update public.leveling_processes
set status = 'closed', closed_at = now(), closed_by = 'prueba'
where name like 'Circuito BM-1%';
```

Volver a aplicar la migración y comprobar que **no** aborta.

- [ ] **Paso 5: Regenerar tipos**

Run:
```bash
npx supabase gen types typescript --local 2>/dev/null > src/types/database.ts
```

> El `2>/dev/null` no es opcional: el comando imprime un log a stdout que contamina el archivo. Lo dejó anotado el cierre de la Fase 1.

- [ ] **Paso 6: Verificar tipos y commitear**

Run: `npm run typecheck`
Expected: errores solo en los consumidores que las Tareas 7-11 arreglan.

```bash
git add supabase/migrations/ src/types/database.ts
git commit -m "feat: columnas de hilos y distancias por visual, con backfill"
```

---

### Tarea 7: Tabla de captura

**Archivos:**
- Modificar: `src/components/leveling/readings-table.tsx`

**Interfaces:**
- Consume: `ReadingCaptureIssues` (T4), `ComputedReading` (T1).
- Produce: `ReadingDraftState` con los campos nuevos; `emptyReading()` con la forma nueva.

- [ ] **Paso 1: Ampliar `ReadingDraftState`**

```ts
export interface ReadingDraftState {
  id: string;
  pointCode: string;
  pointType: PointType;
  backsight: string;
  foresight: string;
  /** Hilos opcionales; el medio es la lectura de mira. */
  backUpperM: string;
  backLowerM: string;
  foreUpperM: string;
  foreLowerM: string;
  /** Distancia por visual: autocompletada desde los hilos, o tecleada. */
  backDistanceM: string;
  foreDistanceM: string;
}

export function emptyReading(): ReadingDraftState {
  return {
    id: crypto.randomUUID(),
    pointCode: "", pointType: "pc",
    backsight: "", foresight: "",
    backUpperM: "", backLowerM: "",
    foreUpperM: "", foreLowerM: "",
    backDistanceM: "", foreDistanceM: "",
  };
}
```

`distanceM` y `distanceAccumulatedKm` **salen** del borrador: el primero desaparece, el segundo se deriva y se muestra desde `computed`.

- [ ] **Paso 2: Autocompletado de hilos → distancia y lectura**

```ts
/**
 * Al teclear un hilo: si el par queda completo, autocompleta la distancia de
 * esa visual; si además la lectura de mira está VACÍA, la rellena con el hilo
 * medio.
 *
 * No sobrescribe una lectura ya escrita: la lectura es el dato, el hilo medio
 * es una forma de obtenerlo. El topógrafo que anotó la lectura y luego añade
 * los hilos no debe ver cambiar lo que escribió.
 */
function applyWireDerivation(
  row: ReadingDraftState,
  side: "back" | "fore",
): ReadingDraftState {
  const upper = parseNumber(side === "back" ? row.backUpperM : row.foreUpperM);
  const lower = parseNumber(side === "back" ? row.backLowerM : row.foreLowerM);
  if (upper == null || lower == null || upper <= lower) return row;

  const distance = ((upper - lower) * 100).toFixed(3);
  const middle = ((upper + lower) / 2).toFixed(4);
  const readingKey = side === "back" ? "backsight" : "foresight";
  const distanceKey = side === "back" ? "backDistanceM" : "foreDistanceM";

  return {
    ...row,
    [distanceKey]: distance,
    [readingKey]: row[readingKey].trim() === "" ? middle : row[readingKey],
  };
}
```

- [ ] **Paso 3: Columnas nuevas, con los hilos plegables**

Añadir un `showWires` al componente (prop o estado local) y renderizar las casillas de hilos solo cuando esté activo y `levelType === "automatico"`. El acumulado pasa a celda calculada:

```tsx
<td className="whitespace-nowrap py-2 pr-3 font-mono tabular-nums text-neutral-700">
  {row?.distanceAccumulatedKm == null
    ? "—"
    : row.distanceAccumulatedKm.toFixed(3)}
</td>
```

- [ ] **Paso 4: Aviso de proceso reconstruido**

Cuando `distancesReconstructed` sea true, mostrar sobre la tabla:

```tsx
<p className="text-sm text-warning-500">
  Las distancias por visual de este proceso las reconstruyó la migración
  repartiendo por mitades; el equilibrado de visuales no se evalúa.
</p>
```

- [ ] **Paso 5: Verificar y commitear**

Run: `npm run typecheck && npm run lint`
Expected: limpio.

```bash
git add src/components/leveling/readings-table.tsx
git commit -m "feat: captura de hilos y distancias por visual en la libreta"
```

---

### Tarea 8: Editor — total derivado y guard de `level_type`

**Archivos:**
- Modificar: `src/components/leveling/leveling-editor.tsx:115-180` y `:340-360`

**Interfaces:**
- Consume: `ReadingDraftState` (T7), `totalDistanceFromReadings` (T3).
- Produce: payload sin `totalDistanceKm`.

- [ ] **Paso 1: Quitar el campo tecleado**

Borrar el estado `totalDistanceKm` (líneas 151-152) y el `<input>` de «Distancia total del recorrido (km)» (líneas 344-357).

- [ ] **Paso 2: Mostrarlo derivado**

```tsx
<div className="max-w-xs">
  <span className="flex flex-col gap-1 text-sm font-medium text-neutral-800">
    Distancia total del recorrido (km)
    <output className="flex h-10 items-center rounded-md bg-neutral-100 px-3 font-mono tabular-nums text-base text-neutral-900">
      {derivedTotalKm.toFixed(3)}
    </output>
  </span>
  <p className="mt-1 text-xs text-neutral-600">
    Se calcula sumando las distancias por visual de la libreta.
  </p>
</div>
```

con

```ts
const derivedTotalKm = useMemo(
  () => totalDistanceFromReadings(forward.map(toReadingInput)),
  [forward],
);
```

- [ ] **Paso 3: Guard de `level_type`**

```tsx
{config.levelType === "" || config.levelType == null ? (
  <Card title="Tipo de nivel">
    <p className="text-sm text-neutral-700">
      Elige el tipo de nivel antes de capturar la libreta: decide si la
      distancia se obtiene leyendo los tres hilos sobre la mira o la entrega
      el instrumento.
    </p>
  </Card>
) : (
  <ReadingsTable … />
)}
```

**Sin preselección.** Precedente de `angle_type` en la Fase 7: adivinar el tipo reintroduce el fallo silencioso que la fase existe para cerrar.

- [ ] **Paso 4: Verificar y commitear**

Run: `npm run typecheck && npm run lint`

```bash
git add src/components/leveling/leveling-editor.tsx
git commit -m "feat: total del recorrido derivado y guard de tipo de nivel"
```

---

### Tarea 9: Server Action

**Archivos:**
- Modificar: `src/app/(app)/projects/[id]/leveling/[pid]/actions.ts:30-160`

**Interfaces:**
- Consume: `computeLeveling` (T5), `ReadingInput` (T1).
- Produce: filas persistidas con la cadena derivada.

- [ ] **Paso 1: Payload sin `totalDistanceKm`**

Quitar `totalDistanceKm: number;` de `SaveLevelingPayload` y `ReadingDraft.distanceM`; añadir los seis campos nuevos a `ReadingDraft`.

- [ ] **Paso 2: Persistir lo derivado, no lo recibido**

```ts
  const result = computeLeveling(input);

  // El total se deriva en el servidor, igual que el resto de resultados. Que
  // el cliente lo mande no lo haría autoritativo: la clave publicable de
  // Supabase es pública por diseño y una llamada directa podría enviar
  // cualquier número. De ese número depende la tolerancia K·√D.
  const totalDistanceKm = totalDistanceFromReadings(input.forward);
```

y en el `update`: `total_distance_km: totalDistanceKm`.

- [ ] **Paso 3: Escribir el acumulado derivado en cada fila**

Al insertar las lecturas, tomar `distance_accumulated_km` de `result.forward.readings[i].distanceAccumulatedKm`, **no** del borrador del cliente.

- [ ] **Paso 4: Verificar y commitear**

Run: `npm run typecheck`

```bash
git add "src/app/(app)/projects/[id]/leveling/[pid]/actions.ts"
git commit -m "feat: el servidor deriva y persiste la cadena de distancias"
```

---

### Tarea 10: Seed

**Archivos:**
- Modificar: `scripts/seed.mjs:400-470` y `:795-820`

- [ ] **Paso 1: Cambiar el fixture a distancias por visual**

El circuito de `scripts/seed.mjs:802-817` escribe hoy `distanceAccumKm` con `distanceM` nulo — la forma inversa a la que el modelo nuevo exige. Sustituir por:

```js
    forward: [
      { code: "BM-1", type: "bm", back: 1.5, backDistanceM: 150 },
      { code: "PC-1", type: "pc", fore: 1.2, back: 2.0,
        foreDistanceM: 150, backDistanceM: 150 },
      { code: "PC-2", type: "pc", fore: 2.5, back: 1.0,
        foreDistanceM: 150, backDistanceM: 150 },
      { code: "BM-1", type: "bm", fore: 0.808, foreDistanceM: 150 },
    ],
```

Total: 900 m = 0.9 km, el mismo que el `totalDistanceKm` que se borra.

- [ ] **Paso 2: Quitar `totalDistanceKm` del spec del proceso**

Ya no se envía: lo deriva el motor.

- [ ] **Paso 3: Verificar de punta a punta**

Run:
```bash
npx supabase db reset && npm run seed
```
Expected: sin errores, y el circuito con `total_distance_km = 0.900` y `meets_tolerance = true`.

> El cierre de la Fase 6 encontró que el seed llevaba **tres fases** sin escribir resultados de estación y nadie lo notó, porque el editor recalcula en vivo. Todo lo que se persiste necesita un consumidor que lo lea sin recalcular.

- [ ] **Paso 4: Commit**

```bash
git add scripts/seed.mjs
git commit -m "fix: el seed escribe distancias por visual"
```

---

### Tarea 11: Export a Excel

**Archivos:**
- Modificar: `src/lib/export/leveling-workbook.ts:58` y `:213`
- Test: `src/lib/export/leveling-workbook.test.ts:36`

- [ ] **Paso 1: Columnas nuevas en la libreta exportada**

Añadir a la tabla de lecturas: hilos (cuando los haya), distancia atrás, distancia adelante, y el acumulado derivado. Quitar la columna de `distance_m`.

- [ ] **Paso 2: Importar los literales, no copiarlos**

Los rótulos de tipo de punto y de tipo de nivel salen de `POINT_TYPE_LABELS` y `LEVEL_TYPE_LABELS`, **nunca** escritos a mano.

> El cierre de la Fase 6: al redactar a mano las etiquetas del Excel de nivelación se equivocó en dos de tres — el tipo de punto es `pc` y no `change_point`, y hay tres tipos de proceso, no dos. El `CHECK` de la base y los mapas de `types/` ya tenían la respuesta.

- [ ] **Paso 3: Verificar y commitear**

Run: `npm test`

```bash
git add src/lib/export/leveling-workbook.ts src/lib/export/leveling-workbook.test.ts
git commit -m "feat: el Excel de nivelación exporta hilos y distancias por visual"
```

---

### Tarea 11.bis: Auditoría de consumidores del acumulado y del total

**Archivos:**
- Modificar: `src/components/leveling/results-panel.tsx:242`
- Revisar: `src/app/(app)/projects/[id]/reports/[reportId]/print/page.tsx:423`

**Interfaces:**
- Consume: `ComputedReading.distanceAccumulatedKm` (T1), `total_distance_km` persistido (T9).
- Produce: nada nuevo; cierra la lista de consumidores.

> Esta tarea existe porque el cierre de la Fase 8 dejó la regla explícita:
> **cambiar la naturaleza de un valor obliga a auditar a todos sus
> consumidores, no solo al que motivó el cambio.** Allí el veredicto de cierre
> de dos editores leía un `precisionOrder` congelado mientras el selector nuevo
> editaba otro en vivo, y la pantalla mostraba dos órdenes a la vez. Dos de los
> tres consumidores tenían el bug, y solo se vio revisándolos uno por uno.

- [ ] **Paso 1: Enumerar los consumidores**

Run:
```bash
grep -rn "distanceAccumulatedKm\|distance_accumulated_km\|total_distance_km\|totalDistanceKm" \
  --include=*.ts --include=*.tsx --include=*.mjs src/ scripts/ | grep -v node_modules
```

Expected: la lista completa. Al escribir este plan eran **el editor** (T8), **el
Server Action** (T9), **el panel de resultados**, **la página de impresión del
informe**, **el export** (T11) y **el seed** (T10). Si aparece alguno más, es
que el grep del plan se quedó corto — revísalo también.

- [ ] **Paso 2: Panel de resultados**

`results-panel.tsx:242` imprime `formatKm(reading.distanceAccumulatedKm)`. El
valor ahora viene derivado dentro de `ComputedReading`, así que **el código no
cambia** — pero hay que verificarlo en pantalla, no razonarlo: comprobar que la
columna muestra el acumulado derivado y no guiones.

- [ ] **Paso 3: Página de impresión del informe**

`print/page.tsx:423` imprime `section.data.process.total_distance_km`, que lee
de la fila persistida. Tras la Tarea 9 ese valor lo escribe el servidor
derivado, así que **tampoco cambia el código** — pero es el consumidor que lee
sin recalcular, y por eso es el que destapa si la persistencia quedó mal.

> El cierre de la Fase 6: el seed llevaba tres fases sin escribir los resultados
> de estación y nadie lo notó, porque el editor recalcula en vivo y la interfaz
> se veía bien. **Solo se vio cuando el informe imprimió una tabla de guiones.**

- [ ] **Paso 4: Verificar los dos contra la base, no contra la interfaz**

Generar un informe de un proceso de nivelación y comprobar que la distancia
total impresa coincide con lo que tiene la fila:

```sql
select name, total_distance_km, distances_reconstructed
from public.leveling_processes;
```

> Regla del cierre de la Fase 4: **verificar contra la base de datos, no contra
> la interfaz.** Allí un fallo se creyó inexistente porque el guard del cliente
> parecía cubrirlo; solo al consultar la tabla se vio que el dato rancio sí se
> persistía.

- [ ] **Paso 5: Commit (si hubo cambios)**

```bash
git add src/components/leveling/results-panel.tsx
git commit -m "fix: el panel de resultados lee el acumulado derivado"
```

Si ninguno de los dos necesitó cambios, no hay commit: la tarea es la
verificación, y su resultado se anota en el cierre.

---

### Tarea 12: Documentación y cierre

**Archivos:**
- Modificar: `docs/manual/README.md`
- Modificar: `src/app/(app)/manual/` (la misma sección)
- Modificar: `docs/tecnica/README.md`
- Modificar: `docs/method.md`, `docs/prds/README.md`, `docs/pendientes.md`

- [ ] **Paso 1: Manual, en sus DOS copias**

El texto vive por duplicado y no hay generación automática (`CLAUDE.md`). Editar ambos **en el mismo commit**.

- [ ] **Paso 2: Regenerar capturas**

Run: `node docs/manual/capturas.mjs`

- [ ] **Paso 3: Doc técnica**

- Estado de fases: la 9 pasa a `cerrada`.
- Tabla de pruebas: conteo nuevo (arranca en 448).
- **§ 11, entrada por entrada, contra el código.** La del equilibrado de visuales queda **resuelta**.

> El cierre de la Fase 6 dejó cuatro entradas de la § 11 describiendo como pendiente algo que esa misma fase había resuelto, con la lección ya escrita dos veces. Por eso es un paso del checklist y no un acto de memoria.

- [ ] **Paso 4: Barrido de afirmaciones caducas**

Run:
```bash
grep -rn "distance_m\|distanceM\|448 tests\|Distancia total del recorrido" --include=*.md --include=*.ts --include=*.tsx docs/ src/ | grep -v node_modules
```
Expected: ninguna referencia a `distance_m` fuera de la migración histórica.

- [ ] **Paso 5: Verificación de pantalla**

Levantar la app y capturar los cinco casos del PRD: modo automático con y sin hilos, modo digital, `level_type` sin definir, proceso reconstruido, y **arranque en frío** (proyecto nuevo, proceso recién creado).

> Las Fases 7 y 8 dejaron dos bugs cada una que solo aparecieron al mirar la pantalla. La Fase 5 dejó que verificar solo sobre datos sembrados oculta los fallos del arranque en frío.

- [ ] **Paso 6: Verificación final y commit de cierre**

Run: `npm run typecheck && npm run lint && npm test && npm run build`
Expected: todo limpio.

```bash
git add -A
git commit -m "docs: cerrar fase 9 — cadena de distancias de nivelación"
```

- [ ] **Paso 7: Abrir el Pull Request**

El merge a `main` **lo decide el usuario**, nunca el agente (`method.md` § 3.bis).
