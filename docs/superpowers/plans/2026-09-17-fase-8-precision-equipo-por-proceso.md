# Fase 8 — Precisión y equipo por proceso · Plan de implementación

> **Para agentes:** SUB-SKILL REQUERIDA: usar `superpowers:subagent-driven-development` (recomendado) o `superpowers:executing-plans` para ejecutar este plan tarea por tarea. Los pasos usan casillas (`- [ ]`) para seguimiento.

**Goal:** Que cada proceso declare con qué equipo y a qué orden de precisión se levantó, en vez de heredarlo del proyecto, con los campos que su tipo de instrumento exige.

**Architecture:** Siete columnas salen de `projects` y se reparten, con forma distinta, entre `polygonal_processes` (estación total), `leveling_processes` y `settlement_visits` (nivel). El congelado de los informes sale gratis del cambio: el dato pasa a vivir donde ya hay un trigger de inmutabilidad. Se añade un aviso nuevo, `σ > K`, que contrasta la precisión del instrumento contra el coeficiente de tolerancia del orden declarado.

**Tech Stack:** Next.js 16 (App Router) · React 19 · TypeScript · Supabase (PostgreSQL + RLS) · Tailwind v4 · Vitest

**Spec:** [`docs/prds/07-precision-equipo-por-proceso.md`](../../prds/07-precision-equipo-por-proceso.md)

> El PRD enumera 13 tareas y este plan tiene 12: se descartó extraer el parseo
> de `"2+2ppm"` a TypeScript. El backfill lo hace en SQL, y un test en TS de la
> misma lógica no verificaría el SQL — lo verifica el Step 5 de la Task 2,
> leyendo el resultado en la base. El parseo se escribirá el día que lo consuma
> código de la aplicación.

## Global Constraints

- `src/lib/calculations/` son funciones puras: sin React, sin hooks, sin Supabase. Solo aritmética.
- Los ángulos se almacenan como 3 campos (`deg`, `min`, `sec`). La conversión a decimal es solo para cálculo interno.
- Coordenadas a 3 decimales, cotas a 4, ángulos en DMS.
- Los procesos con `status` `closed` o `rejected` son inmutables. **Excepción única de esta fase:** el backfill de la migración, documentada en la propia migración.
- Toda tabla nueva lleva RLS. El usuario solo ve sus propios proyectos.
- Las tolerancias viven en `src/lib/calculations/tolerances.ts`, nunca hardcodeadas en componentes.
- Idioma de interfaz: español (Colombia). Zona horaria: America/Bogota.
- Sin shadcn/ui ni librerías de componentes. El sistema de diseño es `src/components/design-system/`.
- Commits en español con prefijo `feat:` / `fix:` / `refactor:` / `docs:`. Un commit por cambio lógico.
- Ejecutar `npm run typecheck` después de cada cambio de código.
- Las migraciones de `supabase/` se editan a mano, no se autogeneran.
- **Antes de crear una función en una migración, hacer `grep` del nombre en `supabase/migrations/`.** `create or replace function` pisa en silencio una homónima de otro módulo (aprendizaje de la Fase 7).
- **Esta fase toca UI en tres módulos: no se cierra sin levantar la app y capturar.** Los dos últimos bugs de la Fase 7 solo aparecieron al mirar la pantalla.

## Datos de referencia

Coeficientes de tolerancia, ya en `tolerances.ts`:

| Orden | `ANGULAR_TOLERANCE_K` (″) | `LEVELING_TOLERANCE_K` (mm) |
|---|---|---|
| `primer_orden` | 1 | 3 |
| `segundo_orden` | 5 | 6 |
| `tercer_orden` | 15 | 12 |
| `ordinario` | 30 | 24 |

Datos reales a preservar en el backfill (los dos proyectos del seed):

| Proyecto | `linear_precision` | `angular_precision_seconds` | `precision_order` |
|---|---|---|---|
| Lote catastral | `3+2ppm` | `5.0` | `tercer_orden` |
| Red geodésica | `1+1ppm` | `1.0` | `primer_orden` |

---

### Task 1: Aviso de equipo insuficiente (`tolerances.ts`)

Va primero porque es pura, no depende del schema y las tareas de UI la consumen.

**Files:**
- Modify: `src/lib/calculations/tolerances.ts`
- Test: `src/lib/calculations/tolerances.test.ts`

**Interfaces:**
- Consumes: `ANGULAR_TOLERANCE_K`, `LEVELING_TOLERANCE_K`, `PrecisionOrder` (ya existen).
- Produces: `totalStationMeetsOrder(order: PrecisionOrder, angularPrecisionSeconds: number): boolean` y `levelMeetsOrder(order: PrecisionOrder, kmPrecisionMm: number): boolean`. Las consumen las tareas 6, 7 y 8.

- [ ] **Step 1: Escribir los tests que fallan**

Añadir al final de `src/lib/calculations/tolerances.test.ts`, y sumar los dos nombres al import existente de `./tolerances`:

```ts
describe("totalStationMeetsOrder", () => {
  it("rechaza una estación de 5″ para primer orden (K = 1″)", () => {
    expect(totalStationMeetsOrder("primer_orden", 5)).toBe(false);
  });

  it("acepta una estación de 1″ para primer orden: σ = K es el equipo que corresponde", () => {
    expect(totalStationMeetsOrder("primer_orden", 1)).toBe(true);
  });

  it("acepta una estación de 5″ para tercer orden (K = 15″)", () => {
    expect(totalStationMeetsOrder("tercer_orden", 5)).toBe(true);
  });

  it("sin dato de precisión no opina: devuelve true", () => {
    expect(totalStationMeetsOrder("primer_orden", Number.NaN)).toBe(true);
  });
});

describe("levelMeetsOrder", () => {
  it("rechaza un nivel de obra de 5.0 mm/km para primer orden (K = 3)", () => {
    expect(levelMeetsOrder("primer_orden", 5)).toBe(false);
  });

  it("acepta 2.5 mm/km para primer orden: ajustado, no imposible", () => {
    expect(levelMeetsOrder("primer_orden", 2.5)).toBe(true);
  });

  it("acepta 2.5 mm/km para tercer orden (K = 12)", () => {
    expect(levelMeetsOrder("tercer_orden", 2.5)).toBe(true);
  });

  it("sin dato de precisión no opina: devuelve true", () => {
    expect(levelMeetsOrder("primer_orden", Number.NaN)).toBe(true);
  });
});
```

- [ ] **Step 2: Correr y verificar que falla**

Run: `npx vitest run src/lib/calculations/tolerances.test.ts`
Expected: FAIL — `totalStationMeetsOrder is not a function`.

- [ ] **Step 3: Implementar**

Al final de `src/lib/calculations/tolerances.ts`:

```ts
/**
 * ¿La estación total declarada puede entregar el orden exigido?
 *
 * La comparación es directa entre coeficientes, y no con un margen, porque la
 * tolerancia angular escala como `K·√n` y la desviación del instrumento escala
 * igual, como `σ·√n`: el `√n` se cancela. Un umbral con margen —«avisa si σ
 * pasa de la mitad de K»— sería un criterio estadístico inventado, y haría
 * saltar el aviso en el emparejamiento correcto de 1″ con primer orden.
 *
 * Es estrictamente mayor: `σ = K` es justo el instrumento que corresponde al
 * orden, no un problema.
 *
 * Sin dato de precisión devuelve `true`: la función no opina sobre lo que no
 * sabe, y quien llama no debe pintar un aviso por un campo vacío.
 */
export function totalStationMeetsOrder(
  order: PrecisionOrder,
  angularPrecisionSeconds: number,
): boolean {
  if (!Number.isFinite(angularPrecisionSeconds)) return true;
  return angularPrecisionSeconds <= ANGULAR_TOLERANCE_K[order];
}

/**
 * ¿El nivel declarado puede entregar el orden exigido?
 *
 * Mismo razonamiento que `totalStationMeetsOrder`: la tolerancia de nivelación
 * es `K·√D` y la desviación típica del instrumento (ISO 17123-2, en mm por km
 * de doble nivelación) escala como `σ·√D`.
 */
export function levelMeetsOrder(
  order: PrecisionOrder,
  kmPrecisionMm: number,
): boolean {
  if (!Number.isFinite(kmPrecisionMm)) return true;
  return kmPrecisionMm <= LEVELING_TOLERANCE_K[order];
}
```

- [ ] **Step 4: Correr y verificar que pasa**

Run: `npx vitest run src/lib/calculations/tolerances.test.ts`
Expected: PASS, los 8 tests nuevos en verde.

- [ ] **Step 5: Typecheck y commit**

```bash
npm run typecheck
git add src/lib/calculations/tolerances.ts src/lib/calculations/tolerances.test.ts
git commit -m "feat: aviso de equipo insuficiente para el orden declarado"
```

---

### Task 2: Migración de schema

**Files:**
- Create: `supabase/migrations/<timestamp>_precision_equipo_por_proceso.sql`
- Modify: `src/types/database.ts` (regenerado, no editar a mano)

**Interfaces:**
- Produces: las columnas de orden y equipo en `polygonal_processes`, `leveling_processes` y `settlement_visits`; las siete columnas fuera de `projects`. Las consumen las tareas 3 a 11.

- [ ] **Step 1: Crear el archivo**

```bash
npx supabase migration new precision_equipo_por_proceso
```

- [ ] **Step 2: Comprobar que no se pisa ninguna función**

```bash
grep -rn "reject_update_on_closed_process\|reject_update_on_closed_leveling" supabase/migrations/*.sql | head
```

Esta migración **no crea funciones nuevas**; solo desactiva y reactiva triggers existentes. El `grep` queda como recordatorio del aprendizaje de la Fase 7.

- [ ] **Step 3: Escribir la migración**

```sql
-- ============================================================================
-- Precisión y equipo por proceso
-- ============================================================================
-- Ver docs/prds/07-precision-equipo-por-proceso.md.
--
-- El orden de precisión y el equipo vivían en `projects` y se pedían al crear
-- el proyecto, pero se deciden al levantar: un mismo proyecto puede tener una
-- poligonal de tercer orden con estación total y una nivelación de primer
-- orden con nivel digital. Peor: `reports` solo guarda ids y la página de
-- impresión leía `project.*` en vivo, así que editar el equipo reescribía
-- informes ya emitidos, incluidos los de procesos cerrados.
--
-- Al mover el dato al proceso, el congelado sale gratis: el proceso cerrado ya
-- es inmutable por trigger.
--
-- Los campos de precisión dependen del INSTRUMENTO. `angular_precision_seconds`
-- y `linear_precision` son campos de estación total (ISO 17123-3 y -4); a un
-- nivel se le pide su desviación típica en mm por km de doble nivelación
-- (ISO 17123-2). Por eso nivelación y asentamientos nunca encajaron en el
-- modelo anterior.
-- ============================================================================

-- --- 1. Poligonal: estación total ------------------------------------------

alter table public.polygonal_processes
  add column precision_order            text not null default 'tercer_orden'
    check (precision_order in ('primer_orden','segundo_orden','tercer_orden','ordinario')),
  add column equipment_brand            text,
  add column equipment_model            text,
  add column equipment_serial           text,
  add column equipment_calibration_date date,
  add column angular_precision_seconds  decimal(4,1),
  add column distance_precision_mm      decimal(4,1),
  add column distance_precision_ppm     decimal(4,1);

comment on column public.polygonal_processes.angular_precision_seconds is
  'Precisión angular de la estación total en segundos (ISO 17123-3).';
comment on column public.polygonal_processes.distance_precision_mm is
  'Término constante de la precisión de distancia, en mm (ISO 17123-4).';
comment on column public.polygonal_processes.distance_precision_ppm is
  'Término proporcional de la precisión de distancia, en ppm (ISO 17123-4).';

-- --- 2. Nivelación: nivel --------------------------------------------------

alter table public.leveling_processes
  add column precision_order            text not null default 'tercer_orden'
    check (precision_order in ('primer_orden','segundo_orden','tercer_orden','ordinario')),
  add column equipment_brand            text,
  add column equipment_model            text,
  add column equipment_serial           text,
  add column equipment_calibration_date date,
  add column level_type                 text
    check (level_type in ('automatico','digital')),
  add column km_precision_mm            decimal(4,2);

comment on column public.leveling_processes.km_precision_mm is
  'Desviación típica del nivel, en mm por km de doble nivelación (ISO 17123-2).';

-- --- 3. Asentamientos: nivel, por visita -----------------------------------
-- La visita ya traía `equipment` como texto libre desde la Fase 5: el módulo
-- acertó con la ubicación (el instrumento puede cambiar entre campañas) y le
-- faltaba la estructura. `operator` se conserva: es otra cosa.

alter table public.settlement_visits
  add column precision_order            text not null default 'tercer_orden'
    check (precision_order in ('primer_orden','segundo_orden','tercer_orden','ordinario')),
  add column equipment_brand            text,
  add column equipment_model            text,
  add column equipment_serial           text,
  add column equipment_calibration_date date,
  add column level_type                 text
    check (level_type in ('automatico','digital')),
  add column km_precision_mm            decimal(4,2);

-- --- 4. Backfill desde el proyecto -----------------------------------------
-- ATENCIÓN: esto toca procesos y visitas CERRADAS, que son inmutables por
-- trigger. Se desactivan y se reactivan aquí mismo.
--
-- Por qué es legítimo: se está rellenando un dato que el proceso SIEMPRE tuvo
-- de forma implícita, heredado del proyecto, y que ahora pasa a ser explícito.
-- No se altera ninguna medición ni ningún resultado de cierre.
--
-- Por qué esto NO es un permiso general: cualquier otra migración que quiera
-- escribir sobre procesos cerrados tiene que justificarse por su cuenta. La
-- excepción es este backfill, no el patrón.

alter table public.polygonal_processes disable trigger polygonal_processes_reject_update_when_closed;
alter table public.leveling_processes  disable trigger leveling_processes_reject_update_on_closed;

update public.polygonal_processes p
   set precision_order            = pr.precision_order,
       equipment_brand            = pr.equipment_brand,
       equipment_model            = pr.equipment_model,
       equipment_serial           = pr.equipment_serial,
       equipment_calibration_date = pr.equipment_calibration_date,
       angular_precision_seconds  = pr.angular_precision_seconds,
       -- "2+2ppm" -> 2 y 2. Si no casa, quedan nulos y el proceso los pide.
       distance_precision_mm      = nullif(substring(pr.linear_precision from '(\d+(?:\.\d+)?)\s*(?:mm)?\s*\+'), '')::decimal,
       distance_precision_ppm     = nullif(substring(pr.linear_precision from '\+\s*(\d+(?:\.\d+)?)\s*[Pp][Pp][Mm]'), '')::decimal
  from public.projects pr
 where pr.id = p.project_id;

update public.leveling_processes l
   set precision_order            = pr.precision_order,
       equipment_brand            = pr.equipment_brand,
       equipment_model            = pr.equipment_model,
       equipment_serial           = pr.equipment_serial,
       equipment_calibration_date = pr.equipment_calibration_date
  from public.projects pr
 where pr.id = l.project_id;
-- `level_type` y `km_precision_mm` quedan nulos: el proyecto nunca tuvo ese
-- dato y no hay de dónde derivarlo. Se capturan.

alter table public.polygonal_processes enable trigger polygonal_processes_reject_update_when_closed;
alter table public.leveling_processes  enable trigger leveling_processes_reject_update_on_closed;

-- Las visitas heredan el orden y el equipo a través del lugar. El texto libre
-- de `equipment` pasa a `equipment_model`, que es lo que suele contener.
update public.settlement_visits v
   set precision_order = pr.precision_order,
       equipment_brand = pr.equipment_brand,
       equipment_model = coalesce(nullif(v.equipment, ''), pr.equipment_model),
       equipment_serial = pr.equipment_serial,
       equipment_calibration_date = pr.equipment_calibration_date
  from public.sites s
  join public.projects pr on pr.id = s.project_id
 where s.id = v.site_id;

alter table public.settlement_visits drop column equipment;

-- --- 5. `projects` pierde las siete columnas -------------------------------

alter table public.projects
  drop column precision_order,
  drop column equipment_brand,
  drop column equipment_model,
  drop column equipment_serial,
  drop column angular_precision_seconds,
  drop column linear_precision,
  drop column equipment_calibration_date;
```

Antes de aplicar, verificar el nombre exacto del trigger de nivelación: el listado dice `leveling_processes_reject_update_on_closed`, distinto del patrón de poligonal (`..._when_closed`).

```bash
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -tAc \
  "select tgname from pg_trigger where tgrelid = 'public.leveling_processes'::regclass and not tgisinternal;"
```

- [ ] **Step 4: Aplicar y regenerar tipos**

```bash
npx supabase db reset
npx supabase gen types typescript --local 2>/dev/null > src/types/database.ts
```

Expected: el reset corre sin error y `database.ts` ya no tiene `precision_order` bajo `projects`.

- [ ] **Step 5: Verificar el backfill y que los triggers volvieron**

```bash
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -P pager=off -c "
  select name, precision_order, angular_precision_seconds, distance_precision_mm, distance_precision_ppm, status
  from polygonal_processes order by name limit 12;" -c "
  select tgname, tgenabled from pg_trigger
  where tgrelid in ('public.polygonal_processes'::regclass, 'public.leveling_processes'::regclass)
    and not tgisinternal;"
```

Expected: los procesos del proyecto «Lote catastral» con `tercer_orden`, `5.0`, `3`, `2`; los cerrados también rellenos; y `tgenabled = 'O'` en todos los triggers.

- [ ] **Step 6: Typecheck y commit**

El árbol no typechequeará hasta la Task 11: la columna borrada rompe a todos sus consumidores, que es exactamente lo que queremos para encontrarlos.

```bash
npm run typecheck 2>&1 | grep -c "error TS"   # anotar el número
git add supabase/migrations src/types/database.ts
git commit -m "feat: migración de precisión y equipo por proceso

El árbol no typechequea hasta la tarea 12: borrar projects.precision_order
obliga al compilador a encontrar los 54 consumidores."
```

---

### Task 3: Tipos de dominio

**Files:**
- Modify: `src/types/project.ts`
- Modify: `src/types/polygonal.ts`
- Modify: `src/types/leveling.ts`
- Modify: `src/types/settlement.ts`

**Interfaces:**
- Produces: `LEVEL_TYPES` / `LevelType` / `LEVEL_TYPE_LABELS` / `LEVEL_TYPE_OPTIONS` en `src/types/project.ts` (comunes a nivelación y asentamientos); `TotalStationFields` y `LevelFields` como interfaces de UI compartidas. Los consumen las tareas 6 a 11.

- [ ] **Step 1: Literales del tipo de nivel**

En `src/types/project.ts`, junto a `PrecisionOrder`:

```ts
export const LEVEL_TYPES = ["automatico", "digital"] as const;
export type LevelType = (typeof LEVEL_TYPES)[number];

export const LEVEL_TYPE_LABELS: Record<LevelType, string> = {
  automatico: "Automático",
  digital: "Digital / electrónico",
};

export const LEVEL_TYPE_OPTIONS = LEVEL_TYPES.map((value) => ({
  value,
  label: LEVEL_TYPE_LABELS[value],
}));
```

- [ ] **Step 2: Estado de UI compartido del equipo**

En `src/types/project.ts`, porque lo comparten tres módulos:

```ts
/**
 * Equipo de estación total tal como lo captura el formulario (todo texto).
 * Vive aquí y no en `polygonal.ts` porque el informe y el export lo leen sin
 * depender del módulo.
 */
export interface TotalStationFields {
  equipmentBrand: string;
  equipmentModel: string;
  equipmentSerial: string;
  equipmentCalibrationDate: string;
  angularPrecisionSeconds: string;
  distancePrecisionMm: string;
  distancePrecisionPpm: string;
}

export const EMPTY_TOTAL_STATION: TotalStationFields = {
  equipmentBrand: "",
  equipmentModel: "",
  equipmentSerial: "",
  equipmentCalibrationDate: "",
  angularPrecisionSeconds: "",
  distancePrecisionMm: "",
  distancePrecisionPpm: "",
};

/** Equipo de nivel, para nivelación y para visitas de asentamiento. */
export interface LevelFields {
  equipmentBrand: string;
  equipmentModel: string;
  equipmentSerial: string;
  equipmentCalibrationDate: string;
  levelType: LevelType | "";
  kmPrecisionMm: string;
}

export const EMPTY_LEVEL: LevelFields = {
  equipmentBrand: "",
  equipmentModel: "",
  equipmentSerial: "",
  equipmentCalibrationDate: "",
  levelType: "",
  kmPrecisionMm: "",
};
```

- [ ] **Step 3: Estrechar las filas tipadas**

En `src/types/leveling.ts` y `src/types/settlement.ts`, añadir `level_type: LevelType | null` y `precision_order: PrecisionOrder` al `Omit<...>` de las filas, siguiendo el patrón que ya usa `PolygonalProcess` en `src/types/polygonal.ts:38-44`.

- [ ] **Step 4: Typecheck y commit**

```bash
npm run typecheck 2>&1 | grep -c "error TS"   # debe bajar respecto a la Task 2
git add src/types
git commit -m "refactor: tipos de equipo por instrumento"
```

---

### Task 4: Validación del proyecto pierde los campos de equipo

**Files:**
- Modify: `src/lib/validators/project.ts`
- Test: `src/lib/validators/project.test.ts`

- [ ] **Step 1: Ajustar los tests existentes**

Los casos que hoy comprueban que falta la marca o la precisión angular dejan de aplicar: el proyecto ya no los pide. Borrarlos y dejar un test que fije la regla nueva:

```ts
it("ya no exige equipo: el proyecto no lo captura desde la Fase 8", () => {
  const issues = validateProject({
    name: "P",
    client: "C",
    location: "L",
    equipment_brand: "",
    angular_precision_seconds: 0,
  } as never);
  expect(issues.equipment_brand).toBeUndefined();
  expect(issues.angular_precision_seconds).toBeUndefined();
  expect(issues.precision_order).toBeUndefined();
});
```

- [ ] **Step 2: Correr y verificar que falla**

Run: `npx vitest run src/lib/validators/project.test.ts`
Expected: FAIL — el validador sigue exigiéndolos.

- [ ] **Step 3: Quitar las reglas**

Eliminar de `validateProject` las ramas de `equipment_brand`, `equipment_model`, `equipment_serial`, `angular_precision_seconds`, `linear_precision`, `equipment_calibration_date` y `precision_order`, y sus campos del tipo de entrada.

- [ ] **Step 4: Correr y verificar que pasa**

Run: `npx vitest run src/lib/validators/project.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/validators/project.ts src/lib/validators/project.test.ts
git commit -m "refactor: el proyecto deja de validar precisión y equipo"
```

---

### Task 5: Queries y Server Actions

**Files:**
- Modify: `src/app/(app)/projects/[id]/polygonal/new/actions.ts`
- Modify: `src/app/(app)/projects/[id]/polygonal/[pid]/actions.ts`
- Modify: `src/app/(app)/projects/[id]/leveling/new/actions.ts`
- Modify: `src/app/(app)/projects/[id]/leveling/[pid]/actions.ts`
- Modify: `src/app/(app)/projects/[id]/actions.ts` (crear/editar proyecto)
- Modify: los archivos de acción del editor de visitas de asentamientos

**Interfaces:**
- Consumes: los tipos de la Task 3.
- Produces: los payloads de creación y guardado de los tres módulos aceptan orden y equipo; el de proyecto deja de aceptarlos.

- [ ] **Step 1: Poligonal**

`CreatePolygonalPayload` y `SavePolygonalPayload` ganan `precisionOrder: PrecisionOrder` y los siete campos de estación total (números ya parseados, no texto). El `insert`/`update` los escribe. `buildInput` pasa a leer `payload.precisionOrder` en vez del `order` que hoy recibe del proyecto.

- [ ] **Step 2: Nivelación**

Igual, con `LevelFields`: `levelType` y `kmPrecisionMm`.

- [ ] **Step 3: Asentamientos**

El guardado de la cabecera de visita (`visit-editor.tsx:188` manda hoy `equipment`) pasa a mandar `precisionOrder` y los campos de nivel.

- [ ] **Step 4: Proyecto**

Las acciones de crear y editar proyecto dejan de leer y escribir las siete columnas.

- [ ] **Step 5: Typecheck y commit**

```bash
npm run typecheck 2>&1 | grep "error TS" | sed 's/(.*//' | sort | uniq -c
git add "src/app/(app)/projects"
git commit -m "feat: los tres módulos persisten su orden y su equipo"
```

---

### Task 6: Bloque de equipo en el formulario de poligonal

**Files:**
- Create: `src/components/design-system/equipment-fields.tsx`
- Modify: `src/components/design-system/index.ts`
- Modify: `src/components/polygonal/polygonal-config-fields.tsx`

**Interfaces:**
- Consumes: `TotalStationFields`, `LevelFields`, `LEVEL_TYPE_OPTIONS` (Task 3); `totalStationMeetsOrder`, `levelMeetsOrder` (Task 1).
- Produces: `<TotalStationFieldset value onChange order disabled />` y `<LevelFieldset value onChange order disabled />`. Las consumen las tareas 7 y 8.

- [ ] **Step 1: Crear los dos fieldsets compartidos**

Un archivo, dos componentes, porque los comparten tres módulos y duplicarlos garantizaría que se desincronicen. Ambos muestran el aviso de equipo insuficiente junto al campo de precisión:

```tsx
{!meetsOrder && (
  <p className="text-sm text-warning-500">
    Una precisión de {value.angularPrecisionSeconds}″ no alcanza para{" "}
    {PRECISION_ORDER_LABELS[order].toLowerCase()}, cuya tolerancia parte de{" "}
    {ANGULAR_TOLERANCE_K[order]}″. Puede capturar igual: es un aviso, no un
    bloqueo.
  </p>
)}
```

- [ ] **Step 2: Enchufarlo en poligonal**

`PolygonalConfigState` gana `precisionOrder` y `totalStation: TotalStationFields`. El formulario suma el selector de orden —reusando `precision-order-select.tsx`, que ya existe— y `<TotalStationFieldset>`.

- [ ] **Step 3: Recablear la dispersión entre lecturas (criterio i)**

El editor recibe hoy `angularPrecisionSeconds` del proyecto: en la Fase 7 se
conectó así porque era el único sitio donde vivía el dato. Pasa a salir del
proceso.

En `src/app/(app)/projects/[id]/polygonal/[pid]/page.tsx`, cambiar:

```tsx
angularPrecisionSeconds={Number(project.angular_precision_seconds)}
```

por:

```tsx
angularPrecisionSeconds={Number(process.angular_precision_seconds)}
```

Y en `polygonal-editor.tsx`, que lo tome del estado de configuración cuando el
usuario lo edita en vivo, para que el aviso de dispersión reaccione al cambiar
el equipo sin tener que guardar:

```tsx
angularPrecisionSeconds={
  parseNumber(config.totalStation.angularPrecisionSeconds) ??
  angularPrecisionSeconds
}
```

- [ ] **Step 4: Typecheck y prueba manual**

```bash
npm run typecheck
npm run dev
```

Abrir `/projects/<id>/polygonal/new`, declarar primer orden con precisión
angular 5 y comprobar que aparece el aviso; cambiar a 1 y comprobar que
desaparece. En el editor, cambiar la precisión angular del equipo y comprobar
que el aviso de dispersión de las lecturas cambia con ella.

- [ ] **Step 5: Commit**

```bash
git add src/components/design-system src/components/polygonal "src/app/(app)/projects/[id]/polygonal/[pid]/page.tsx"
git commit -m "feat: equipo de estación total en el formulario de poligonal

La dispersión entre lecturas pasa a leer la precisión angular del proceso
en vez de la del proyecto (criterio i)."
```

---

### Task 7: Bloque de equipo en nivelación

**Files:**
- Modify: `src/components/leveling/leveling-config-fields.tsx`
- Modify: `src/components/leveling/new-leveling-form.tsx`
- Modify: `src/components/leveling/leveling-editor.tsx`

- [ ] **Step 1: Extender el estado**

`LevelingConfigState` gana `precisionOrder: PrecisionOrder` y `level: LevelFields`.

- [ ] **Step 2: Enchufar el fieldset**

Selector de orden + `<LevelFieldset>`. El editor deja de recibir `precisionOrder` del proyecto y lo toma del proceso.

- [ ] **Step 3: Typecheck y prueba manual**

Declarar primer orden con un nivel de 5 mm/km y comprobar el aviso; bajar a 2.5 y comprobar que desaparece.

- [ ] **Step 4: Commit**

```bash
npm run typecheck
git add src/components/leveling
git commit -m "feat: equipo de nivel en el formulario de nivelación"
```

---

### Task 8: Bloque de equipo en las visitas de asentamiento

**Files:**
- Modify: `src/components/settlement/visit-editor.tsx:40,50,188,303`

- [ ] **Step 1: Sustituir el campo de texto libre**

El estado de cabecera cambia `equipment: string` por `precisionOrder: PrecisionOrder` y `level: LevelFields`. El `<Input label="Equipo">` de la línea 303 se sustituye por el selector de orden y `<LevelFieldset>`. `operator` no se toca.

- [ ] **Step 2: Typecheck y prueba manual**

Abrir una visita del lugar «Edificio Torre Central» y comprobar que el equipo migrado del texto libre aparece en «Modelo».

- [ ] **Step 3: Commit**

```bash
npm run typecheck
git add src/components/settlement
git commit -m "feat: orden y equipo de nivel en las visitas de asentamiento"
```

---

### Task 9: El formulario de proyecto pierde los campos

**Files:**
- Modify: `src/components/projects/project-fields.tsx:104-145`
- Modify: `src/components/projects/project-edit-form.tsx`
- Modify: `src/components/projects/project-header.tsx:77`

- [ ] **Step 1: Quitar los campos**

Borrar de `project-fields.tsx` los bloques de marca, modelo, serie, precisión angular, precisión lineal, fecha de calibración y orden, y sus entradas en `ProjectFieldValues`.

- [ ] **Step 2: Revisar la pantalla**

El formulario pierde una sección entera. Comprobar que no queda un `fieldset` vacío ni un `grid` de una sola columna donde había dos, y que la ficha (`project-header.tsx`) no muestra un hueco donde iba la precisión.

- [ ] **Step 3: Typecheck, prueba manual y commit**

```bash
npm run typecheck
npm run dev   # abrir /projects/new y /projects/<id> y mirarlos
git add src/components/projects
git commit -m "refactor: el formulario de proyecto deja de pedir precisión y equipo"
```

---

### Task 10: Informe y exportación

**Files:**
- Modify: `src/app/(app)/projects/[id]/reports/[reportId]/print/page.tsx:195,205-212,426-455`
- Modify: `src/lib/export/workbook.ts`
- Modify: `src/lib/export/polygonal-workbook.ts`
- Modify: `src/lib/export/leveling-workbook.ts`
- Modify: `src/lib/export/settlement-workbook.ts`
- Test: `src/lib/export/polygonal-workbook.test.ts`

- [ ] **Step 1: Test del congelado**

```ts
it("el informe de un proceso cerrado lleva el equipo del proceso, no el del proyecto", async () => {
  const wb = await buildPolygonalWorkbook({
    ...procesoCerrado,
    equipment_brand: "Sokkia",
    equipment_model: "CX-52",
    angular_precision_seconds: 2,
  });
  const s = wb.getWorksheet("Resumen")!;
  const celdas = [];
  s.eachRow((row) => row.eachCell((c) => celdas.push(String(c.value ?? ""))));
  expect(celdas.join(" ")).toContain("Sokkia");
  expect(celdas.join(" ")).toContain("CX-52");
});
```

- [ ] **Step 2: Correr y verificar que falla**

Run: `npx vitest run src/lib/export/polygonal-workbook.test.ts`

- [ ] **Step 3: Adaptar informe y workbooks**

La cabecera del informe deja de imprimir una línea de equipo por proyecto. Cada sección de proceso imprime el suyo, y el «Resumen consolidado de precisiones» gana la columna «Equipo». Los cuatro workbooks leen del proceso.

- [ ] **Step 4: Correr, typecheck y commit**

```bash
npx vitest run src/lib/export
npm run typecheck
git add src/lib/export "src/app/(app)/projects/[id]/reports"
git commit -m "feat: informe y export leen el equipo del proceso"
```

---

### Task 11: Seed y fixtures

**Files:**
- Modify: `scripts/seed.mjs`
- Modify: `src/lib/demo/fixtures.ts`
- Modify: `src/lib/demo/crear-proyecto-demo.ts`
- Test: `src/lib/demo/fixtures.test.ts`

- [ ] **Step 1: Equipos coherentes con el orden**

Los procesos del proyecto «Lote catastral» (tercer orden) llevan una estación de 5″ y `3 mm + 2 ppm`; los de «Red geodésica» (primer orden), una de 1″ y `1 mm + 1 ppm` — el emparejamiento que el proyecto ya tenía. La nivelación y las visitas llevan nivel digital de 1.5 mm/km, coherente con tercer orden.

Sembrar además **un** proceso con equipo insuficiente a propósito, para que el aviso se pueda ver sin tener que teclearlo:

```js
{
  name: "Poligonal con equipo insuficiente (fixture del aviso)",
  precisionOrder: "primer_orden",
  equipment: { brand: "Genérica", model: "TS-5", serial: "S/N 000",
               angularPrecisionSeconds: 5, distanceMm: 5, distancePpm: 5 },
  // …
}
```

- [ ] **Step 2: Correr el seed y verificar**

```bash
npx supabase db reset && npm run seed
```

- [ ] **Step 3: Typecheck, tests y commit**

```bash
npm run typecheck && npm test
git add scripts/seed.mjs src/lib/demo
git commit -m "feat: seed con equipos coherentes con el orden de cada proceso"
```

---

### Task 12: Verificación y cierre de fase

**Files:**
- Modify: `docs/tecnica/README.md`
- Modify: `docs/manual/README.md`
- Modify: `src/app/(app)/manual/page.tsx`
- Modify: `docs/prds/07-precision-equipo-por-proceso.md`
- Modify: `docs/method.md`, `docs/prds/README.md`

- [ ] **Step 1: Recorrer los criterios a-n**

Uno por uno, anotando evidencia. El criterio `k` —editar un proyecto no altera el informe de un proceso cerrado— se prueba abriendo el informe, editando el proyecto y volviendo a abrirlo.

- [ ] **Step 2: Verificación completa**

```bash
npm run typecheck && npm run lint && npm test
```

- [ ] **Step 3: Levantar la app y capturar**

No es opcional: los dos últimos bugs de la Fase 7 solo aparecieron al mirar la pantalla. Capturar el formulario de poligonal con el aviso de equipo insuficiente, el de nivelación, una visita de asentamiento, y el formulario de proyecto ya sin los campos.

```bash
npm run dev
node docs/manual/capturas.mjs
```

- [ ] **Step 4: Documentación de handoff**

`docs/tecnica/README.md`: modelo de datos, el aviso nuevo y el estado de fases. `docs/manual/README.md` y `src/app/(app)/manual/page.tsx` **en el mismo commit**: el texto vive duplicado.

```bash
grep -rn "precisión angular\|equipo\|orden de precisión" docs/manual/README.md "src/app/(app)/manual/page.tsx" | head -20
```

- [ ] **Step 5: Cerrar la fase**

Marcar `cerrada` en la cabecera del PRD, en `docs/method.md` y en `docs/prds/README.md`, y anotar los aprendizajes.

```bash
git add -A
git commit -m "docs: cerrar fase 8 — precisión y equipo por proceso"
```
