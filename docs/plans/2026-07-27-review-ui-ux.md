# Refinamiento UI/UX de TopoField — Plan de implementación

> **Para trabajadores agénticos:** SUB-SKILL REQUERIDA: usar
> superpowers:subagent-driven-development (recomendado) o
> superpowers:executing-plans para implementar tarea por tarea. Los pasos usan
> sintaxis de checkbox (`- [ ]`) para seguimiento.

**Objetivo:** Corregir la semántica de estado, elevar la jerarquía del veredicto
de cierre, dar tratamiento tipográfico a los datos numéricos y hacer usable la
captura de estaciones en campo.

**Arquitectura:** Cambios acotados a la capa de presentación más una corrección
de datos en el seed. La lógica de cálculo (`src/lib/calculations/`) y de
validación (`src/lib/validators/`) no se toca: ya es correcta. Se añade un
componente nuevo (`ClosureVerdict`) y se reestructura la tabla de estaciones para
móvil.

**Stack:** Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS v4 ·
Supabase · Vitest

**Spec:** [`docs/specs/2026-07-27-review-ui-ux-design.md`](../specs/2026-07-27-review-ui-ux-design.md)

## Restricciones globales

- Los archivos de `src/lib/calculations/` son funciones puras: sin React, sin
  hooks, sin Supabase. Solo math.
- Los ángulos se almacenan como 3 campos (deg, min, sec), nunca como decimal.
- Coordenadas a 3 decimales, cotas a 4, ángulos en DMS.
- Los procesos `closed` y `rejected` son inmutables: nunca generar UPDATE.
- Las tolerancias viven en `src/lib/calculations/tolerances.ts`, nunca
  hardcodeadas en componentes.
- Idioma de interfaz: español (Colombia). Zona horaria: America/Bogota.
- No usar shadcn/ui ni librerías de componentes. Solo el sistema de diseño propio
  sobre Tailwind puro.
- Ejecutar `npm run typecheck` después de cada cambio de código.
- Commits en español con prefijo `feat:`, `fix:`, `refactor:` o `docs:`.

---

### Tarea 1: Corregir los datos del seed

Raíz de la contradicción "Calculado / Sin calcular" y del proceso `closed` fuera
de tolerancia. Sin esto, cualquier rediseño de tarjetas sigue mostrando datos
inconsistentes.

**Archivos:**
- Modificar: `scripts/seed.mjs`

**Interfaces:**
- Consume: `computePolygonal` de `src/lib/calculations/polygonal.ts`
- Produce: procesos de seed con `linear_error`, `perimeter`,
  `relative_precision`, `angular_error_seconds` y `meets_tolerance` poblados,
  coherentes con su `status`.

- [ ] **Paso 1: Inspeccionar cómo el seed inserta procesos**

Leer `scripts/seed.mjs` completo, en particular la función que inserta en
`polygonal_processes` (alrededor de la línea 85, donde usa `spec.status`) y las
definiciones de los 7 fixtures (líneas ~135-260).

Confirmar que ningún fixture escribe `linear_error`, `relative_precision`,
`meets_tolerance`, `perimeter` ni `angular_error_seconds`.

- [ ] **Paso 2: Verificar el estado inconsistente actual**

```bash
PGPASSWORD=postgres psql -h 127.0.0.1 -p 54322 -U postgres -d postgres -c "select name, status, linear_error, relative_precision, meets_tolerance from public.polygonal_processes order by status;"
```

Esperado: las tres columnas de resultado en `NULL` para los 7 procesos, incluido
uno con `status = closed`.

- [ ] **Paso 3: Importar el motor de cálculo en el seed**

El seed es un `.mjs` que corre en Node fuera de Next. Para importar TypeScript
desde `src/lib/calculations/polygonal.ts` hay dos rutas: usar `tsx` como runner,
o replicar el cálculo. **Usar `tsx`**, que ya está disponible vía `npx`, para no
duplicar lógica (DRY).

Verificar primero que el import funciona:

```bash
npx tsx -e "import('./src/lib/calculations/polygonal.ts').then(m => console.log(Object.keys(m)))"
```

Esperado: lista de exports incluyendo `computePolygonal`.

Si `tsx` no resuelve el alias `@/`, añadir al import la ruta relativa completa en
vez del alias.

- [ ] **Paso 4: Calcular y persistir resultados en cada fixture**

En `scripts/seed.mjs`, antes del insert de cada proceso, construir el input y
calcular. El input requiere `type`, `startNorth`, `startEast`, `startAzimuth`
(decimal), `order`, `method` y `stations` con `angle` en decimal y `distance`.

```js
import { computePolygonal } from "../src/lib/calculations/polygonal.ts";
import { dmsToDecimal } from "../src/lib/calculations/angles.ts";

function resultFieldsFor(spec, order) {
  const input = {
    type: spec.type,
    startNorth: spec.startNorth,
    startEast: spec.startEast,
    startAzimuth: dmsToDecimal(...spec.startAz),
    endNorth: spec.endNorth ?? null,
    endEast: spec.endEast ?? null,
    endAzimuth: spec.endAz ? dmsToDecimal(...spec.endAz) : null,
    order,
    method: spec.correctionMethod,
    stations: spec.stations.map((st) => ({
      pointCode: st.code,
      angle: st.angle ? dmsToDecimal(...st.angle) : Number.NaN,
      deflectionDirection: st.deflectionDirection ?? null,
      distance: st.distance ?? Number.NaN,
    })),
  };
  const r = computePolygonal(input);
  const rel = r.relativePrecision;
  return {
    angular_error_seconds: r.angularError,
    linear_error: r.linearError,
    perimeter: r.perimeter,
    relative_precision:
      rel == null ? null : rel === Infinity ? "1:∞" : `1:${Math.round(rel)}`,
    meets_tolerance: r.meetsTolerance,
  };
}
```

Añadir el spread de `resultFieldsFor(spec, order)` al objeto que se inserta en
`polygonal_processes`, junto a `status: spec.status`.

- [ ] **Paso 5: Corregir el fixture «Pentágono oficial (cerrado)»**

Ese fixture tiene `status: "closed"` con precisión 1:46 contra un tercer orden que
exige 1:5000. `evaluatePolygonalClosure` nunca permitiría ese cierre: forzaría
`mustReject`.

Cambiar sus estaciones por una geometría que sí cumpla tolerancia de tercer orden,
de modo que `meets_tolerance === true`. Reutilizar la geometría del fixture
«Cuadrado perfecto 100×4», que cierra exacto, con `startNorth: 1000`,
`startEast: 1000` y nombre «Cuadrado oficial (cerrado)».

Actualizar su `notes` a: `"Cuadrado que cierra exacto, cerrado oficialmente: el editor debe abrirlo en modo solo lectura."`

El caso fuera de tolerancia sigue representado por el fixture
«Cuadrado marginal (rechazado)», cuyo `status: "rejected"` es su desenlace
correcto.

- [ ] **Paso 6: Reejecutar el seed**

```bash
npx supabase db reset && node scripts/seed.mjs
```

Si el paso 3 mostró que hace falta `tsx`, usar `npx tsx scripts/seed.mjs`.

- [ ] **Paso 7: Verificar la coherencia de los datos**

```bash
PGPASSWORD=postgres psql -h 127.0.0.1 -p 54322 -U postgres -d postgres -c "select name, status, relative_precision, meets_tolerance from public.polygonal_processes order by status;"
```

Esperado:
- Ningún proceso con `status = calculated`, `closed` o `rejected` tiene
  `relative_precision` en `NULL`.
- Ningún proceso con `status = closed` tiene `meets_tolerance = false`.

- [ ] **Paso 8: Commit**

```bash
git add scripts/seed.mjs
git commit -m "fix(seed): persistir resultados de calculo y corregir cierre fuera de tolerancia"
```

---

### Tarea 2: Componente de veredicto de cierre

El elemento que la spec identifica como el producto de la pantalla. Hoy es un
punto de 8px al fondo del editor.

**Archivos:**
- Crear: `src/components/polygonal/closure-verdict.tsx`
- Modificar: `src/components/design-system/index.ts`
- Test: `src/components/polygonal/closure-verdict.test.tsx`

**Interfaces:**
- Consume: `PolygonalResult` y `PolygonalType` de `src/types/polygonal.ts`;
  `PrecisionOrder` y `PRECISION_ORDER_LABELS` de `src/types/project.ts`;
  `minRelativePrecision` de `src/lib/calculations/tolerances.ts`.
- Produce: `<ClosureVerdict result type order />`, usado por la Tarea 3.

- [ ] **Paso 1: Escribir el test fallido**

Crear `src/components/polygonal/closure-verdict.test.tsx`. El proyecto usa Vitest
sin jsdom configurado, así que se testea la **función pura de decisión**, no el
render. Extraer esa decisión como export nombrado del propio componente.

```tsx
import { describe, expect, it } from "vitest";
import { verdictFor } from "./closure-verdict";
import type { PolygonalResult } from "@/types/polygonal";

function resultWith(over: Partial<PolygonalResult>): PolygonalResult {
  return {
    angleSum: null,
    theoreticalSum: null,
    angularError: null,
    angularTolerance: null,
    anglesMeetTolerance: null,
    errorNorth: null,
    errorEast: null,
    linearError: null,
    perimeter: 0,
    relativePrecision: null,
    meetsLinearTolerance: null,
    meetsTolerance: null,
    stations: [],
    ...over,
  };
}

describe("verdictFor", () => {
  it("marca cumplimiento cuando la tolerancia se satisface", () => {
    const v = verdictFor(
      resultWith({ meetsTolerance: true, relativePrecision: 8000 }),
      "closed",
      "tercer_orden",
    );
    expect(v.tone).toBe("ok");
    expect(v.title).toBe("Cumple tercer orden");
  });

  it("marca incumplimiento cuando no alcanza la tolerancia", () => {
    const v = verdictFor(
      resultWith({ meetsTolerance: false, relativePrecision: 1001 }),
      "closed",
      "tercer_orden",
    );
    expect(v.tone).toBe("danger");
    expect(v.title).toBe("No cumple tercer orden");
    expect(v.required).toBe("1:5.000");
  });

  it("no exige cierre en poligonal abierta sin control", () => {
    const v = verdictFor(resultWith({}), "open_uncontrolled", "tercer_orden");
    expect(v.tone).toBe("neutral");
    expect(v.title).toBe("Sin verificación de cierre");
  });

  it("señala datos incompletos cuando falta el cálculo", () => {
    const v = verdictFor(resultWith({}), "closed", "tercer_orden");
    expect(v.tone).toBe("neutral");
    expect(v.title).toBe("Datos incompletos");
  });
});
```

- [ ] **Paso 2: Ejecutar el test y verificar que falla**

```bash
npx vitest run src/components/polygonal/closure-verdict.test.tsx
```

Esperado: FAIL — no existe el módulo `./closure-verdict`.

- [ ] **Paso 3: Implementar el componente**

Crear `src/components/polygonal/closure-verdict.tsx`:

```tsx
import { cn } from "@/lib/utils/cn";
import { minRelativePrecision } from "@/lib/calculations/tolerances";
import type { PolygonalResult, PolygonalType } from "@/types/polygonal";
import { PRECISION_ORDER_LABELS, type PrecisionOrder } from "@/types/project";

type Tone = "ok" | "danger" | "neutral";

export interface Verdict {
  tone: Tone;
  title: string;
  /** Precisión alcanzada, ya formateada (o null si no aplica). */
  achieved: string | null;
  /** Precisión exigida por el orden, ya formateada (o null si no aplica). */
  required: string | null;
}

function formatPrecision(x: number | null): string | null {
  if (x == null) return null;
  if (!Number.isFinite(x)) return "1:∞";
  return `1:${Math.round(x).toLocaleString("es-CO")}`;
}

/** Decide el veredicto de cierre. Función pura: testeable sin render. */
export function verdictFor(
  result: PolygonalResult,
  type: PolygonalType,
  order: PrecisionOrder,
): Verdict {
  const orderLabel = PRECISION_ORDER_LABELS[order].toLowerCase();
  const achieved = formatPrecision(result.relativePrecision);
  const required = formatPrecision(minRelativePrecision(order));

  if (type === "open_uncontrolled") {
    return {
      tone: "neutral",
      title: "Sin verificación de cierre",
      achieved: null,
      required: null,
    };
  }
  if (result.meetsTolerance === true) {
    return { tone: "ok", title: `Cumple ${orderLabel}`, achieved, required };
  }
  if (result.meetsTolerance === false) {
    return {
      tone: "danger",
      title: `No cumple ${orderLabel}`,
      achieved,
      required,
    };
  }
  return {
    tone: "neutral",
    title: "Datos incompletos",
    achieved: null,
    required: null,
  };
}

const TONE_CLASSES: Record<Tone, string> = {
  ok: "border-success-500/30 bg-success-500/5",
  danger: "border-danger-500/30 bg-danger-500/5",
  neutral: "border-neutral-200 bg-neutral-50",
};

const TITLE_CLASSES: Record<Tone, string> = {
  ok: "text-success-500",
  danger: "text-danger-500",
  neutral: "text-neutral-500",
};

function formatMeters(value: number | null, decimals = 3): string {
  return value == null ? "—" : value.toFixed(decimals);
}

interface ClosureVerdictProps {
  result: PolygonalResult;
  type: PolygonalType;
  order: PrecisionOrder;
  className?: string;
}

/** Veredicto de cierre: el resultado que el topógrafo busca al abrir el proceso. */
export function ClosureVerdict({
  result,
  type,
  order,
  className,
}: ClosureVerdictProps) {
  const v = verdictFor(result, type, order);

  return (
    <section
      aria-label="Veredicto de cierre"
      className={cn("rounded-lg border p-5", TONE_CLASSES[v.tone], className)}
    >
      <p
        className={cn(
          "text-xs font-semibold uppercase tracking-wide",
          TITLE_CLASSES[v.tone],
        )}
      >
        {v.title}
      </p>

      {v.achieved && (
        <div className="mt-2 flex flex-wrap items-baseline gap-x-6 gap-y-1">
          <span className="font-mono text-3xl font-semibold tabular-nums text-neutral-900">
            {v.achieved}
          </span>
          {v.required && (
            <span className="font-mono text-sm tabular-nums text-neutral-500">
              requerido {v.required}
            </span>
          )}
        </div>
      )}

      {result.linearError != null && (
        <p className="mt-2 font-mono text-sm tabular-nums text-neutral-500">
          Error de cierre {formatMeters(result.linearError, 4)} m · Perímetro{" "}
          {formatMeters(result.perimeter)} m
        </p>
      )}
    </section>
  );
}
```

- [ ] **Paso 4: Ejecutar el test y verificar que pasa**

```bash
npx vitest run src/components/polygonal/closure-verdict.test.tsx
```

Esperado: PASS, 4 tests.

- [ ] **Paso 5: Verificar tipos**

```bash
npm run typecheck
```

Esperado: sin errores.

El helper `resultWith` del test declara los 13 campos de `PolygonalResult`
verificados contra `src/types/polygonal.ts:136-153`. Si el typecheck señala un
campo faltante, añadirlo al helper con valor `null` (o `0` para `perimeter`, que
no es nullable), sin usar `as` para silenciar el error.

- [ ] **Paso 6: Commit**

```bash
git add src/components/polygonal/closure-verdict.tsx src/components/polygonal/closure-verdict.test.tsx
git commit -m "feat(poligonal): componente de veredicto de cierre"
```

---

### Tarea 3: Jerarquía del editor

Sube el veredicto al tope, colapsa Configuración en procesos calculados y
diferencia las acciones destructivas.

**Archivos:**
- Modificar: `src/components/polygonal/polygonal-editor.tsx`

**Interfaces:**
- Consume: `<ClosureVerdict result type order />` de la Tarea 2.
- Produce: editor con veredicto arriba; sin cambios de API pública.

- [ ] **Paso 1: Importar el veredicto**

En `src/components/polygonal/polygonal-editor.tsx`, añadir junto a los imports de
`./results-panel`:

```tsx
import { ClosureVerdict } from "./closure-verdict";
```

- [ ] **Paso 2: Insertar el veredicto antes de Configuración**

Localizar el bloque `<Card title="Configuración">` (línea ~255). Insertar
inmediatamente antes:

```tsx
<ClosureVerdict
  result={result}
  type={config.type}
  order={precisionOrder}
/>
```

- [ ] **Paso 3: Colapsar Configuración en procesos ya calculados**

`Card` no soporta colapso. Envolver el contenido en un `<details>` nativo, que da
comportamiento accesible sin JavaScript ni dependencias.

Reemplazar el bloque `<Card title="Configuración">…</Card>` completo por:

```tsx
<details
  open={process.status === "draft" || process.status === "in_progress"}
  className="rounded-lg border border-neutral-200 bg-white shadow-sm"
>
  <summary className="cursor-pointer list-none px-5 py-4 text-base font-semibold text-neutral-900 marker:content-none">
    Configuración
  </summary>
  <div className="border-t border-neutral-100 px-5 py-4">
    <PolygonalConfigFields
      value={config}
      disabled={readOnly}
      onChange={(v) => {
        setConfig(v);
        setDirty(true);
        setSaveMessage(null);
      }}
    />
  </div>
</details>
```

- [ ] **Paso 4: Diferenciar «Cerrar proceso» de «Guardar»**

`CloseProcessDialog` renderiza su botón disparador como `<Button>` primario, igual
que Guardar. Cambiarlo a secundario y separarlo visualmente.

En `src/components/polygonal/close-process-dialog.tsx`, en el botón disparador
(línea ~70), añadir `variant="secondary"`:

```tsx
<Button
  type="button"
  variant="secondary"
  onClick={() => {
    setConfirmed(false);
    setError(null);
    setOpen(true);
  }}
>
  Cerrar proceso
</Button>
```

El botón de confirmación **dentro** del modal se mantiene como está: ahí sí es la
acción primaria, y ya usa `variant="danger"` cuando `mustReject`.

Luego, en `polygonal-editor.tsx`, separar el grupo de acciones. Reemplazar el
`<div className="flex items-center gap-3">` que envuelve Guardar y
CloseProcessDialog por:

```tsx
<div className="flex items-center gap-3">
  {captureBlocked && (
    <span className="text-sm text-danger-500">
      Corrige las celdas con error para poder guardar.
    </span>
  )}
  <Button onClick={handleSave} disabled={isPending || captureBlocked}>
    {isPending ? "Guardando…" : "Guardar"}
  </Button>
  <span aria-hidden className="h-6 w-px bg-neutral-200" />
  <CloseProcessDialog
    processId={process.id}
    type={config.type}
    result={result}
    captureBlocked={captureBlocked}
    dirty={dirty}
  />
</div>
```

- [ ] **Paso 5: Señalar el cierre fuera de tolerancia en el editor**

Criterio 2 de la spec: el caso debe distinguirse también en el editor, no solo en
el hub. Salvaguarda para procesos históricos o migrados.

En `polygonal-editor.tsx`, junto al bloque `{readOnly && (` (línea ~247),
reemplazar ese `Alert` único por:

```tsx
{readOnly && process.status === "closed" && process.meets_tolerance === false && (
  <Alert variant="warning">
    Este proceso se cerró sin alcanzar la tolerancia del orden de precisión. Los
    datos son de solo lectura.
  </Alert>
)}
{readOnly &&
  !(process.status === "closed" && process.meets_tolerance === false) && (
    <Alert variant="info">
      Este proceso está cerrado; los datos son de solo lectura.
    </Alert>
  )}
```

Verificar que `Alert` acepta `variant="warning"` leyendo
`src/components/design-system/alert.tsx`. Si no, añadir la variante siguiendo el
patrón de las existentes.

- [ ] **Paso 6: Verificar tipos**

```bash
npm run typecheck
```

Esperado: sin errores.

- [ ] **Paso 7: Verificar visualmente**

Con el dev server corriendo (`npm run dev`) y sesión iniciada como
`seed@topofield.local` / `seed1234`, abrir un proceso calculado del proyecto
«Lote catastral».

Confirmar: el veredicto aparece arriba con la precisión en grande; Configuración
está colapsada; «Cerrar proceso» ya no es azul sólido; en un proceso `closed` el
editor sigue en solo lectura.

- [ ] **Paso 8: Commit**

```bash
git add src/components/polygonal/polygonal-editor.tsx src/components/polygonal/close-process-dialog.tsx
git commit -m "feat(poligonal): elevar veredicto de cierre y jerarquizar acciones"
```

---

### Tarea 4: Tipografía de datos numéricos

Cifras tabulares monoespaciadas en coordenadas, azimuts y precisiones.

**Archivos:**
- Modificar: `src/app/globals.css`
- Modificar: `src/components/polygonal/stations-table.tsx`
- Modificar: `src/components/polygonal/results-panel.tsx`

**Interfaces:**
- Produce: clase utilitaria `font-mono` con stack definido en `@theme`, usada por
  la Tarea 5.

- [ ] **Paso 1: Definir el stack monoespaciado**

En `src/app/globals.css`, dentro del bloque `@theme`, añadir tras las variables de
color:

```css
  --font-mono: ui-monospace, "SF Mono", "Cascadia Mono", "Roboto Mono",
    "DejaVu Sans Mono", Consolas, monospace;
```

Se usa el stack del sistema: sin descarga de fuentes, sin dependencia nueva, y
cifras tabulares garantizadas en todas las plataformas.

- [ ] **Paso 2: Aplicar a las columnas calculadas de la tabla**

En `src/components/polygonal/stations-table.tsx`, las celdas de Azimut, ΔN y ΔE
(líneas ~155-163). Añadir `font-mono tabular-nums` a cada una:

```tsx
<td className="whitespace-nowrap py-2 pr-3 font-mono tabular-nums text-neutral-700">
  {formatAngle(computed?.azimuth ?? null)}
</td>
<td className="py-2 pr-3 font-mono tabular-nums text-neutral-700">
  {formatCoord(computed?.deltaNorth ?? null)}
</td>
<td className="py-2 pr-3 font-mono tabular-nums text-neutral-700">
  {formatCoord(computed?.deltaEast ?? null)}
</td>
```

- [ ] **Paso 3: Aplicar al panel de resultados**

En `src/components/polygonal/results-panel.tsx`, el componente `Row` (línea ~30)
ya usa `tabular-nums`. Añadirle `font-mono`:

```tsx
<span className="font-mono text-sm tabular-nums text-neutral-900">{value}</span>
```

En la tabla de coordenadas corregidas del mismo archivo, añadir
`font-mono tabular-nums` a las celdas de ΔN corr., ΔE corr., Norte y Este.
Localizarlas leyendo el archivo a partir de la línea 100; son las que renderizan
valores vía `formatMeters`.

- [ ] **Paso 4: Verificar tipos y build**

```bash
npm run typecheck && npm run lint
```

Esperado: sin errores.

- [ ] **Paso 5: Verificar visualmente**

Abrir un proceso calculado. Confirmar que las columnas numéricas alinean sus
dígitos en vertical y que las etiquetas de interfaz siguen en sans.

- [ ] **Paso 6: Commit**

```bash
git add src/app/globals.css src/components/polygonal/stations-table.tsx src/components/polygonal/results-panel.tsx
git commit -m "feat(ds): tipografia monoespaciada tabular para datos numericos"
```

---

### Tarea 5: Estaciones usables en campo

Por debajo de 768px, tarjetas por estación en vez de tabla con scroll horizontal.

**Archivos:**
- Modificar: `src/components/polygonal/stations-table.tsx`

**Interfaces:**
- Consume: `StationDraftState`, `emptyStation` (ya exportados del mismo archivo).
- Produce: sin cambios de API. `StationsTable` conserva su firma exacta; cambia
  solo su render responsive.

- [ ] **Paso 1: Ocultar la tabla en móvil**

En `src/components/polygonal/stations-table.tsx`, el `<div className="overflow-x-auto">`
(línea 75) pasa a mostrarse solo desde `md`:

```tsx
<div className="hidden overflow-x-auto md:block">
```

- [ ] **Paso 2: Añadir la lista de tarjetas para móvil**

Inmediatamente después del `</div>` que cierra ese contenedor de tabla, y antes
del bloque `{!disabled && (` del botón «Agregar estación», insertar:

```tsx
<ul className="flex flex-col gap-3 md:hidden">
  {stations.map((station, i) => {
    const issue = issues[i];
    const computed = result.stations[i];
    return (
      <li
        key={station.id}
        className="rounded-lg border border-neutral-200 p-4"
      >
        <div className="flex items-start justify-between gap-3">
          <Input
            value={station.pointCode}
            disabled={disabled}
            onChange={(e) => update(i, { pointCode: e.target.value })}
            className="w-28"
            aria-label={`Código de la estación ${i + 1}`}
          />
          {!disabled && (
            <Button
              size="sm"
              variant="ghost"
              type="button"
              onClick={() => onChange(stations.filter((_, j) => j !== i))}
            >
              Eliminar
            </Button>
          )}
        </div>

        <div className="mt-3 flex flex-col gap-3">
          <div>
            <p className="mb-1 text-xs font-medium text-neutral-500">Ángulo</p>
            <DmsInput
              value={station.angle}
              disabled={disabled}
              error={issue?.errors.angle}
              onChange={(v) => update(i, { angle: v })}
            />
            {issue?.warnings.angle && (
              <p className="mt-1 text-xs text-warning-500">
                {issue.warnings.angle}
              </p>
            )}
          </div>

          {showDeflection && (
            <div>
              <p className="mb-1 text-xs font-medium text-neutral-500">
                Sentido
              </p>
              <Select
                options={DEFLECTION_OPTIONS}
                placeholder="—"
                value={station.deflectionDirection ?? ""}
                disabled={disabled}
                onChange={(e) =>
                  update(i, {
                    deflectionDirection:
                      e.target.value === ""
                        ? null
                        : (e.target.value as DeflectionDirection),
                  })
                }
              />
            </div>
          )}

          <div>
            <p className="mb-1 text-xs font-medium text-neutral-500">
              Distancia (m)
            </p>
            <Input
              type="number"
              step="any"
              inputMode="decimal"
              value={station.distance}
              disabled={disabled}
              error={issue?.errors.distance}
              onChange={(e) => update(i, { distance: e.target.value })}
            />
          </div>
        </div>

        <dl className="mt-3 grid grid-cols-3 gap-2 border-t border-neutral-100 pt-3">
          <div>
            <dt className="text-xs text-neutral-500">Azimut</dt>
            <dd className="font-mono text-sm tabular-nums text-neutral-700">
              {formatAngle(computed?.azimuth ?? null)}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-neutral-500">ΔN</dt>
            <dd className="font-mono text-sm tabular-nums text-neutral-700">
              {formatCoord(computed?.deltaNorth ?? null)}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-neutral-500">ΔE</dt>
            <dd className="font-mono text-sm tabular-nums text-neutral-700">
              {formatCoord(computed?.deltaEast ?? null)}
            </dd>
          </div>
        </dl>
      </li>
    );
  })}
  {stations.length === 0 && (
    <li className="py-6 text-center text-sm text-neutral-500">
      Aún no hay estaciones. Agrega la primera para empezar.
    </li>
  )}
</ul>
```

- [ ] **Paso 3: Ampliar los targets táctiles de DMS**

Los tres campos de grados/minutos/segundos son demasiado angostos para uso con
guantes. En `src/components/design-system/dms-input.tsx`, leer el archivo y
localizar las clases de ancho de los tres inputs.

Añadir `min-h-11` (44px) a cada input y ampliar su ancho en móvil, manteniendo el
tamaño actual desde `md`. Si el ancho actual es `w-14`, pasa a `w-16 md:w-14`.

- [ ] **Paso 4: Verificar tipos y lint**

```bash
npm run typecheck && npm run lint
```

Esperado: sin errores.

- [ ] **Paso 5: Verificar en viewport móvil**

Abrir el editor de un proceso calculado en 390px de ancho (DevTools responsive, o
el script de capturas de la sesión de review).

Confirmar: se ven tarjetas, no tabla; Azimut, ΔN y ΔE son visibles sin scroll
horizontal; los campos DMS son cómodos al tacto; en ≥768px sigue la tabla.

- [ ] **Paso 6: Commit**

```bash
git add src/components/polygonal/stations-table.tsx src/components/design-system/dms-input.tsx
git commit -m "feat(poligonal): tarjetas por estacion en movil para captura en campo"
```

---

### Tarea 6: Semántica del hub y del dashboard

Cuatro estados reales en el hub; KPI que informan en vez de anunciar su ausencia.

**Archivos:**
- Modificar: `src/app/(app)/projects/[id]/page.tsx`
- Modificar: `src/app/(app)/dashboard/page.tsx`
- Modificar: `src/lib/supabase/queries.ts`
- Modificar: `src/components/projects/process-card.tsx`

**Interfaces:**
- Consume: `getDashboardKpis(supabase)` de `src/lib/supabase/queries.ts`.
- Produce: `DashboardKpis` con los campos `activeProjects`, `calculatedProcesses`
  y `outOfTolerance`.

- [ ] **Paso 1: Separar las cuatro secciones del hub**

En `src/app/(app)/projects/[id]/page.tsx`, reemplazar el cálculo de `inProgress` y
`closed` (líneas 83-88) por:

```tsx
const drafts = processes.filter(
  (p) => p.status === "draft" || p.status === "in_progress",
);
const calculated = processes.filter((p) => p.status === "calculated");
const closed = processes.filter((p) => p.status === "closed");
const rejected = processes.filter((p) => p.status === "rejected");
```

Si `IN_PROGRESS_STATUSES` queda sin uso tras el cambio, eliminar su import.

- [ ] **Paso 2: Renderizar las cuatro secciones**

Reemplazar las dos `<ProcessSection>` (líneas 114-125) por:

```tsx
<ProcessSection
  title="Borradores"
  projectId={project.id}
  processes={drafts}
  emptyText="No hay borradores."
/>
<ProcessSection
  title="Calculados"
  projectId={project.id}
  processes={calculated}
  emptyText="No hay procesos calculados."
/>
<ProcessSection
  title="Cerrados"
  projectId={project.id}
  processes={closed}
  emptyText="No hay procesos cerrados."
/>
<ProcessSection
  title="Rechazados"
  projectId={project.id}
  processes={rejected}
  emptyText="No hay procesos rechazados."
/>
```

- [ ] **Paso 3: Distinguir el cierre fuera de tolerancia en la tarjeta**

Salvaguarda para procesos históricos o migrados con `status = closed` y
`meets_tolerance = false`.

En `src/components/projects/process-card.tsx`, reemplazar el uso directo de
`STATUS_TONE` y `PROCESS_STATUS_LABELS` en el `<Badge>` (líneas 43-45) por:

```tsx
const outOfTolerance =
  process.status === "closed" && process.meets_tolerance === false;

const tone = outOfTolerance ? "warning" : STATUS_TONE[process.status];
const label = outOfTolerance
  ? "Cerrado fuera de tolerancia"
  : PROCESS_STATUS_LABELS[process.status];
```

Declarar esas constantes dentro del componente, antes del `return`, y usarlas:

```tsx
<Badge tone={tone}>{label}</Badge>
```

Ampliar el tipo de `STATUS_TONE` para admitir `"warning"`:

```tsx
const STATUS_TONE: Record<
  ProcessStatus,
  "neutral" | "primary" | "success" | "danger" | "warning"
> = {
```

Verificar que `Badge` acepta `tone="warning"` leyendo
`src/components/design-system/badge.tsx`. Si no lo acepta, añadir esa variante
siguiendo el patrón de las existentes, con `bg-warning-500/10 text-warning-500`.

- [ ] **Paso 4: Mostrar la precisión real en la tarjeta**

En el mismo archivo, el texto «Sin calcular» (líneas 49-51) ya usa
`process.relative_precision`. Con la Tarea 1 aplicada, mostrará la precisión real.
Precisar el texto del caso vacío para que solo aparezca en borradores:

```tsx
<span className="font-mono tabular-nums">
  {process.relative_precision
    ? `Precisión ${process.relative_precision}`
    : "Sin calcular"}
</span>
```

- [ ] **Paso 5: Extender la consulta de KPI**

En `src/lib/supabase/queries.ts`, localizar `getDashboardKpis` (línea ~26) y su
interfaz `DashboardKpis` (línea ~16).

Reemplazar el campo `pendingClosures` por dos métricas derivables de datos que ya
existen:

```ts
export interface DashboardKpis {
  activeProjects: number;
  calculatedProcesses: number;
  outOfTolerance: number;
}
```

En la función, tras el conteo de proyectos activos, añadir:

```ts
const { count: calculatedCount } = await supabase
  .from("polygonal_processes")
  .select("id", { count: "exact", head: true })
  .eq("status", "calculated");

const { count: outOfToleranceCount } = await supabase
  .from("polygonal_processes")
  .select("id", { count: "exact", head: true })
  .eq("meets_tolerance", false);

return {
  activeProjects: count ?? 0,
  calculatedProcesses: calculatedCount ?? 0,
  outOfTolerance: outOfToleranceCount ?? 0,
};
```

RLS ya restringe estas filas a los proyectos del usuario, así que no hace falta
filtrar por `user_id`.

- [ ] **Paso 6: Reemplazar los KPI vacíos**

En `src/app/(app)/dashboard/page.tsx`, reemplazar los dos `<KpiCard>` con
`value="—"` (líneas 40-49) por:

```tsx
<KpiCard
  label="Procesos calculados"
  value={kpis.calculatedProcesses}
  hint="Listos para revisar y cerrar."
/>
<KpiCard
  label="Fuera de tolerancia"
  value={kpis.outOfTolerance}
  hint="Requieren revisión antes del cierre."
/>
```

- [ ] **Paso 7: Verificar tipos y lint**

```bash
npm run typecheck && npm run lint
```

Esperado: sin errores. Si algún otro consumidor usaba `kpis.pendingClosures`,
el typecheck lo señalará; actualizarlo.

- [ ] **Paso 8: Verificar visualmente**

Abrir el dashboard: los tres KPI muestran números reales.

Abrir el hub de «Lote catastral»: cuatro secciones; las tarjetas muestran
«Precisión 1:X» en vez de «Sin calcular»; ninguna tarjeta contradice su badge.

- [ ] **Paso 9: Commit**

```bash
git add "src/app/(app)/projects/[id]/page.tsx" "src/app/(app)/dashboard/page.tsx" src/lib/supabase/queries.ts src/components/projects/process-card.tsx
git commit -m "feat(dashboard): estados reales de proceso en hub y KPI del dashboard"
```

---

### Tarea 7: Verificación final

**Archivos:** ninguno (solo verificación).

- [ ] **Paso 1: Suite completa**

```bash
npm run typecheck && npm run lint && npm run test
```

Esperado: sin errores de tipos, sin errores de lint, todos los tests en verde.

- [ ] **Paso 2: Build de producción**

```bash
npm run build
```

Esperado: build exitoso.

- [ ] **Paso 3: Recorrer los criterios de aceptación de la spec**

Con el dev server corriendo y sesión iniciada, verificar uno por uno los 10
criterios de la § 6 de
[`docs/specs/2026-07-27-review-ui-ux-design.md`](../specs/2026-07-27-review-ui-ux-design.md).

Prestar atención especial al criterio 10: abrir un proceso `closed` y confirmar
que sigue en solo lectura, sin posibilidad de guardar.

- [ ] **Paso 4: Capturar el resultado**

Reejecutar el recorrido de capturas de la sesión de review en 1440px y 390px, y
comparar contra el estado inicial.

- [ ] **Paso 5: Commit final si hubo ajustes**

```bash
git add -A
git commit -m "fix: ajustes finales del refinamiento UI/UX"
```

---

## Notas de implementación

- **No tocar** `src/lib/calculations/` ni `src/lib/validators/`. El diagnóstico
  confirmó que ambos son correctos; los problemas estaban en presentación y en
  los datos del seed.
- El orden de tareas importa: la Tarea 1 debe ir primero, porque las Tareas 3 y 6
  se verifican visualmente contra datos que solo son coherentes tras el fix del
  seed.
- Las Tareas 4 y 5 comparten archivo (`stations-table.tsx`). Ejecutarlas en orden
  evita conflictos.
- `playwright` quedó instalado como devDependency durante el review, para las
  capturas. Si no se va a usar en CI, considerar retirarlo al cerrar el trabajo.
