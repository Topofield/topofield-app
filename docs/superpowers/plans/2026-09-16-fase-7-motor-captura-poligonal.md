# Fase 7 — Motor y captura de poligonales · Plan de implementación

> **Para agentes:** SUB-SKILL REQUERIDA: usar `superpowers:subagent-driven-development` (recomendado) o `superpowers:executing-plans` para ejecutar este plan tarea por tarea. Los pasos usan casillas (`- [ ]`) para seguimiento.

**Goal:** Que el motor de poligonales calcule con la convención de ángulo a la derecha que usa el instrumento, acepte amarre sobre un punto de coordenadas conocidas y capture N lecturas por ángulo, reproduciendo carteras de campo reales al milímetro.

**Architecture:** El cambio de fondo son tres líneas de `polygonal.ts`: la cadena de azimuts pasa a sumar el ángulo en vez de restarlo, la suma teórica depende de `angle_type` y de si hay orientación, y el error se reparte entre los ángulos que participan de la condición de cierre. Alrededor de eso: una tabla nueva de lecturas, un helper de azimut desde coordenadas en `angles.ts`, y la captura que espeja la cartera con n+1 filas.

**Tech Stack:** Next.js 16 (App Router) · React 19 · TypeScript · Supabase (PostgreSQL + RLS) · Tailwind v4 · Vitest

**Spec:** [`docs/prds/06-motor-captura-poligonal.md`](../../prds/06-motor-captura-poligonal.md)

## Global Constraints

- `src/lib/calculations/` son funciones puras: sin React, sin hooks, sin Supabase. Solo aritmética.
- Los ángulos se almacenan como 3 campos (`deg`, `min`, `sec`). La conversión a decimal es solo para cálculo interno.
- Coordenadas a 3 decimales, cotas a 4, ángulos en DMS.
- Los procesos con `status` `closed` o `rejected` son inmutables. Nunca generar UPDATE sobre ellos.
- Toda tabla nueva lleva RLS. El usuario solo ve sus propios proyectos.
- Las tolerancias viven en `src/lib/calculations/tolerances.ts`, nunca hardcodeadas en componentes.
- Idioma de interfaz: español (Colombia). Zona horaria: America/Bogota.
- Sin shadcn/ui ni librerías de componentes. El sistema de diseño es `src/components/design-system/`.
- Commits en español con prefijo `feat:` / `fix:` / `refactor:` / `docs:`. Un commit por cambio lógico.
- Ejecutar `npm run typecheck` después de cada cambio de código.
- Las migraciones de `supabase/` se editan a mano, no se autogeneran.

## Datos de referencia (cartera TT4)

Estos valores se usan en varias tareas. Salen de `docs/carteras/poligonales.xlsx`.

| Dato | Valor |
|---|---|
| Amarre `TT4` | N `100142.809` · E `101436.5` |
| Arranque `V10` | N `100135.666` · E `101440.525` |
| Azimut `V10→TT4` | `330°35'57.23"` |
| Ángulos (a la derecha) | V10 `211°15'07"` · D1 `124°29'42"` · D2 `148°41'41"` · D3 `91°01'01"` · D4 `100°27'43"` · D5 `104°46'07"` · V10 cierre `299°18'51"` |
| Distancias | `20.744` · `11.606` · `12.835` · `36.985` · `18.117` · `15.425` |
| Suma observada / teórica | `1080.003333°` / `1080°` → error `+12"` |
| Corrección por ángulo | `−1.714286"` |
| Error de cierre | E_N `0.008417` · E_E `−0.014104` · lineal `0.016425` · perímetro `115.712` |

Coordenadas esperadas por método (las tres hojas del Excel):

| Pto | Bowditch N / E | Tránsito N / E |
|---|---|---|
| V10 | `100135.666` / `101440.525` | `100135.666` / `101440.525` |
| D1 | `100114.931312` / `101439.857597` | `100114.934902` / `101439.854888` |
| D2 | `100108.052182` / `101449.207190` | `100108.057307` / `101449.205597` |
| D3 | `100106.923797` / `101461.994139` | `100106.929969` / `101461.994444` |
| D4 | `100143.699707` / `101465.900541` | `100143.704877` / `101465.897394` |
| D5 | `100148.849172` / `101448.533376` | `100148.855143` / `101448.523317` |

---

### Task 1: Azimut desde coordenadas (`angles.ts`)

**Files:**
- Modify: `src/lib/calculations/angles.ts`
- Test: `src/lib/calculations/angles.test.ts`

**Interfaces:**
- Consumes: `normalizeAzimuth` (ya existe en el mismo archivo).
- Produces: `azimuthFromCoordinates(fromNorth, fromEast, toNorth, toEast): number` — azimut en grados decimales `[0, 360)`. Lo usan las tareas 7, 8 y 12.

- [ ] **Step 1: Escribir el test que falla**

En `src/lib/calculations/angles.test.ts`, añadir al final:

```ts
describe("azimuthFromCoordinates", () => {
  it("reproduce el azimut de amarre de la cartera TT4", () => {
    // V10 -> TT4, hoja BRUJULA de docs/carteras/poligonales.xlsx.
    // La hoja trae las coordenadas de TT4 en su bloque X23:Z25 y el azimut
    // tecleado en O6:Q6 (330°35'57.23"). Deben coincidir.
    const az = azimuthFromCoordinates(100135.666, 101440.525, 100142.809, 101436.5);
    expect(az).toBeCloseTo(330 + 35 / 60 + 57.23 / 3600, 8);
  });

  it("devuelve los cuatro cuadrantes cardinales", () => {
    expect(azimuthFromCoordinates(0, 0, 10, 0)).toBeCloseTo(0, 9);
    expect(azimuthFromCoordinates(0, 0, 0, 10)).toBeCloseTo(90, 9);
    expect(azimuthFromCoordinates(0, 0, -10, 0)).toBeCloseTo(180, 9);
    expect(azimuthFromCoordinates(0, 0, 0, -10)).toBeCloseTo(270, 9);
  });

  it("normaliza el tercer cuadrante en vez de devolver negativo", () => {
    expect(azimuthFromCoordinates(0, 0, -10, -10)).toBeCloseTo(225, 9);
  });

  it("devuelve 0 cuando los dos puntos coinciden", () => {
    expect(azimuthFromCoordinates(5, 5, 5, 5)).toBe(0);
  });
});
```

Añadir `azimuthFromCoordinates` al import existente de `./angles` en la cabecera del archivo.

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `npx vitest run src/lib/calculations/angles.test.ts`
Expected: FAIL — `azimuthFromCoordinates is not a function`.

- [ ] **Step 3: Implementar**

Al final de `src/lib/calculations/angles.ts`:

```ts
/**
 * Azimut de la dirección `from → to` a partir de coordenadas planas, en grados
 * decimales normalizados a [0, 360).
 *
 * El azimut se mide desde el Norte en sentido horario, así que el ángulo es
 * `atan2(ΔE, ΔN)` y no `atan2(ΔN, ΔE)`: el eje Norte hace de eje de referencia
 * y el Este de eje que crece hacia la derecha.
 *
 * Los puntos coincidentes no definen dirección; se devuelve 0 en vez de
 * propagar el 0 arbitrario de `atan2(0, 0)` como si fuera un dato.
 */
export function azimuthFromCoordinates(
  fromNorth: number,
  fromEast: number,
  toNorth: number,
  toEast: number,
): number {
  const deltaNorth = toNorth - fromNorth;
  const deltaEast = toEast - fromEast;
  if (deltaNorth === 0 && deltaEast === 0) return 0;
  return normalizeAzimuth((Math.atan2(deltaEast, deltaNorth) * 180) / Math.PI);
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `npx vitest run src/lib/calculations/angles.test.ts`
Expected: PASS, los 4 tests nuevos en verde.

- [ ] **Step 5: Typecheck y commit**

```bash
npm run typecheck
git add src/lib/calculations/angles.ts src/lib/calculations/angles.test.ts
git commit -m "feat: azimut desde coordenadas en angles.ts"
```

---

### Task 2: Migración de schema

**Files:**
- Create: `supabase/migrations/<timestamp>_polygonal_right_hand_angles.sql`
- Modify: `src/types/database.ts` (regenerado, no editar a mano)

**Interfaces:**
- Produces: columnas `polygonal_processes.reference_point_id`, `.reference_point_code`, `.angle_readings_min`; `angle_type` con los literales nuevos; tabla `polygonal_angle_readings`. Las consumen las tareas 3, 6, 7, 9 y 12.

- [ ] **Step 1: Crear el archivo de migración**

```bash
npx supabase migration new polygonal_right_hand_angles
```

- [ ] **Step 2: Escribir la migración**

Contenido del archivo creado:

```sql
-- ============================================================================
-- Convención de ángulo a la derecha, amarre externo y lecturas múltiples
-- ============================================================================
-- Ver docs/prds/06-motor-captura-poligonal.md. Tres cambios:
--
--  1. `angle_type` deja de ser un campo muerto derivado del tipo de poligonal
--     y pasa a ser la elección del usuario entre ángulos interiores y
--     exteriores, que es lo que fija la suma teórica. 'internal' se renombra a
--     'interior' y entra 'exterior'.
--  2. El amarre se resuelve contra un `reference_points` del proyecto, y el
--     azimut se calcula desde sus coordenadas en vez de teclearse.
--  3. Cada ángulo pasa a guardar N lecturas; el promedio vive en la estación.
--
-- No hay backfill: la Fase 7 resetea los datos (decisión 5 del PRD de fase),
-- así que el trigger de inmutabilidad de la tabla nueva se crea de una vez.
-- ============================================================================

-- --- 1. angle_type: interior / exterior ------------------------------------

alter table public.polygonal_processes
  drop constraint if exists polygonal_processes_angle_type_check;

update public.polygonal_processes set angle_type = 'interior' where angle_type = 'internal';

alter table public.polygonal_processes
  alter column angle_type set default 'interior',
  add constraint polygonal_processes_angle_type_check
    check (angle_type in ('interior', 'exterior', 'deflection', 'azimuth'));

comment on column public.polygonal_processes.angle_type is
  'Dónde caen las lecturas a la derecha: interior o exterior. Fija la suma teórica.';

-- --- 2. Amarre -------------------------------------------------------------

alter table public.polygonal_processes
  add column reference_point_id   uuid references public.reference_points(id) on delete set null,
  add column reference_point_code text,
  add column angle_readings_min   int not null default 3
    check (angle_readings_min >= 1);

comment on column public.polygonal_processes.reference_point_id is
  'Punto de amarre del catálogo del proyecto. Si está, el azimut se calcula desde sus coordenadas.';
comment on column public.polygonal_processes.reference_point_code is
  'Amarre fuera del catálogo: código tecleado a mano, con el azimut en start_azimuth_*.';
comment on column public.polygonal_processes.start_azimuth_deg is
  'Azimut de partida. Con amarre, es el azimut del arranque HACIA la referencia; sin amarre, el del primer lado.';

-- --- 3. Lecturas múltiples por ángulo --------------------------------------

create table public.polygonal_angle_readings (
  id            uuid primary key default gen_random_uuid(),
  station_id    uuid not null references public.polygonal_stations(id) on delete cascade,
  reading_order int not null,
  angle_deg     int not null,
  angle_min     int not null,
  angle_sec     decimal(5,1) not null,
  created_at    timestamptz not null default now(),
  unique (station_id, reading_order)
);

create index polygonal_angle_readings_station_id_idx
  on public.polygonal_angle_readings(station_id);

alter table public.polygonal_angle_readings enable row level security;

-- El join de propiedad se repite en las 4 políticas; se extrae para no
-- duplicarlo. `security definer` con search_path fijo, como cualquier helper
-- que se invoca desde una política.
create or replace function public.owns_reading_station(target_station uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.polygonal_stations s
    join public.polygonal_processes p on p.id = s.process_id
    join public.projects pr on pr.id = p.project_id
    where s.id = target_station
      and pr.user_id = (select auth.uid())
  );
$$;

-- Propiedad vía join hasta projects. Cuatro políticas separadas, que es el
-- patrón del resto del schema (ver 20260522053657_polygonal.sql:151-195).
create policy "polygonal_angle_readings_select_via_project" on public.polygonal_angle_readings
  for select using (public.owns_reading_station(station_id));

create policy "polygonal_angle_readings_insert_via_project" on public.polygonal_angle_readings
  for insert with check (public.owns_reading_station(station_id));

create policy "polygonal_angle_readings_update_via_project" on public.polygonal_angle_readings
  for update using (public.owns_reading_station(station_id))
  with check (public.owns_reading_station(station_id));

create policy "polygonal_angle_readings_delete_via_project" on public.polygonal_angle_readings
  for delete using (public.owns_reading_station(station_id));

-- Inmutabilidad: las lecturas son el dato de campo más crudo que existe. Si el
-- proceso está cerrado, no se tocan.
create or replace function public.reject_write_on_closed_process_reading()
returns trigger
language plpgsql
as $$
declare
  target_station uuid := coalesce(new.station_id, old.station_id);
  process_status text;
begin
  select p.status into process_status
  from public.polygonal_stations s
  join public.polygonal_processes p on p.id = s.process_id
  where s.id = target_station;

  if process_status in ('closed', 'rejected') then
    raise exception
      'El proceso de la estación % está cerrado (%); sus lecturas son inmutables.',
      target_station, process_status
      using errcode = 'restrict_violation';
  end if;

  return coalesce(new, old);
end;
$$;

create trigger polygonal_angle_readings_reject_write_when_closed
  before insert or update or delete on public.polygonal_angle_readings
  for each row execute function public.reject_write_on_closed_process_reading();
```

Ya verificado: `projects.user_id` es la columna de propiedad
(`20260430010354_init.sql`), y las 4 políticas por operación son el patrón de
`20260522053657_polygonal.sql:151-195`.

- [ ] **Step 3: Aplicar y regenerar tipos**

```bash
npx supabase db reset
npx supabase gen types typescript --local 2>/dev/null > src/types/database.ts
```

Expected: el reset corre sin error y `database.ts` contiene `polygonal_angle_readings`.

- [ ] **Step 4: Verificar el trigger contra un proceso cerrado**

```bash
npx supabase db reset >/dev/null 2>&1 && psql "$(npx supabase status -o json | python3 -c 'import json,sys;print(json.load(sys.stdin)["DB_URL"])')" -v ON_ERROR_STOP=0 -c "
  insert into public.polygonal_angle_readings (station_id, reading_order, angle_deg, angle_min, angle_sec)
  select s.id, 99, 1, 0, 0 from public.polygonal_stations s
  join public.polygonal_processes p on p.id = s.process_id
  where p.status = 'closed' limit 1;"
```

Expected: `ERROR: ... sus lecturas son inmutables.` Si no hay proceso cerrado en la base recién reseteada, este paso se difiere a la Task 13 (criterio k), donde el seed ya habrá creado uno.

- [ ] **Step 5: Typecheck y commit**

```bash
npm run typecheck
git add supabase/migrations src/types/database.ts
git commit -m "feat: migración de amarre externo, tipo de ángulo y lecturas múltiples"
```

---

### Task 3: Tipos de dominio

**Files:**
- Modify: `src/types/polygonal.ts`

**Interfaces:**
- Consumes: `Tables<"polygonal_angle_readings">` de la Task 2.
- Produces: `ANGLE_TYPES` con los literales nuevos; `ANGLE_TYPE_OPTIONS`; `AngleReading`; `StationInput.readings`; `StationInput.distance: number | null`; `PolygonalInput.angleType`, `.hasOrientation`, `.hasClosingRow`; `PolygonalResult.reorientationError`, `.angleDispersions`. Los consumen las tareas 4 a 12.

- [ ] **Step 1: Actualizar literales y etiquetas**

En `src/types/polygonal.ts`, reemplazar la constante de tipos de ángulo:

```ts
export const ANGLE_TYPES = [
  "interior",
  "exterior",
  "deflection",
  "azimuth",
] as const;
export type AngleType = (typeof ANGLE_TYPES)[number];

export const ANGLE_TYPE_LABELS: Record<AngleType, string> = {
  interior: "Interiores",
  exterior: "Exteriores",
  deflection: "Deflexiones",
  azimuth: "Azimuts",
};

/**
 * Opciones del selector de una poligonal cerrada. Interior y exterior son los
 * dos casos reales según el sentido en que se recorra el polígono, y el
 * formulario NO preselecciona: adivinar la convención es el fallo que la Fase 7
 * corrige (decisión 8 del PRD de fase).
 */
export const CLOSED_ANGLE_TYPE_OPTIONS = (["interior", "exterior"] as const).map(
  (value) => ({ value, label: ANGLE_TYPE_LABELS[value] }),
);
```

- [ ] **Step 2: Añadir el tipo de lectura y extender los contratos**

```ts
export type AngleReading = Tables<"polygonal_angle_readings">;

/** Una lectura individual tal como la consume el cálculo. */
export interface ReadingInput {
  order: number;
  /** Ángulo leído, en grados decimales. */
  angle: number;
}
```

En `StationInput`, cambiar `distance` a `number | null` y añadir `readings`:

```ts
export interface StationInput {
  pointCode: string;
  /** Promedio de las lecturas, en grados decimales. */
  angle: number;
  deflectionDirection: DeflectionDirection | null;
  /** Distancia horizontal del lado, en metros. `null` en la fila de cierre. */
  distance: number | null;
  /** Lecturas que produjeron el promedio. Vacío en datos sin reiteración. */
  readings: ReadingInput[];
}
```

En `PolygonalInput`, añadir:

```ts
  /** Dónde caen las lecturas a la derecha. Fija la suma teórica. */
  angleType: AngleType;
  /**
   * La primera estación lleva el ángulo de orientación contra el amarre, y
   * `startAzimuth` es el azimut del arranque hacia la referencia.
   */
  hasOrientation: boolean;
  /**
   * La última estación es la fila de cierre contra el amarre (sin distancia).
   * Si es `false` con orientación, la última fila lleva el ángulo del vértice
   * de arranque y el de orientación solo fija el datum — esquema de la cartera
   * Vivero. Ver hallazgo 4 del PRD de fase.
   */
  hasClosingRow: boolean;
```

En `PolygonalResult`, añadir:

```ts
  /**
   * Discrepancia del control de reorientación, en segundos de arco. Con fila de
   * cierre, contra el azimut de amarre; sin ella, contra el azimut del primer
   * lado. `null` cuando no hay orientación.
   */
  reorientationError: number | null;
```

En `StationResult`, añadir:

```ts
  /** Dispersión entre lecturas (máx − mín), en segundos. `null` si hay < 2. */
  readingDispersion: number | null;
```

- [ ] **Step 3: Typecheck para ver qué rompe**

Run: `npm run typecheck`
Expected: FAIL. Los errores esperados están en `polygonal.test.ts`, `demo/fixtures.ts`, `demo/crear-proyecto-demo.ts`, las Server Actions y `polygonal.ts`. Anotarlos: las tareas 4 a 12 los van cerrando. No arreglarlos aquí.

- [ ] **Step 4: Commit**

El árbol no typechequea todavía; es un commit de contrato intermedio y así se declara.

```bash
git add src/types/polygonal.ts
git commit -m "refactor: contrato de tipos para amarre, tipo de ángulo y lecturas

El árbol no typechequea hasta la tarea 12: este commit solo mueve el
contrato, y las tareas siguientes adaptan cada consumidor."
```

---

### Task 4: Motor de cálculo

Es la tarea central. Todo lo demás la sirve.

**Files:**
- Create: `src/lib/demo/carteras.ts`
- Modify: `src/lib/calculations/polygonal.ts:134-245` (la función `computeClosed`)
- Test: `src/lib/calculations/polygonal.test.ts`

**Interfaces:**
- Consumes: `azimuthFromCoordinates` (Task 1), los tipos de la Task 3.
- Produces: `CARTERA_TT4` y `CARTERA_VIVERO` desde `src/lib/demo/carteras.ts`, con la forma `{ name, angleType, hasOrientation, hasClosingRow, startNorth, startEast, referenceNorth, referenceEast, stations: { pointCode, readings: [number,number,number][], distance }[] }`. Las consumen las tareas 5 y 12.

- [ ] **Step 1: Crear las carteras reales como dato compartido**

`src/lib/demo/carteras.ts`:

```ts
// Carteras de campo reales, transcritas de docs/carteras/*.xlsx. Son a la vez
// los casos de prueba del motor y los datos del seed: si el seed replicara
// aparte estos números, dejaría de verificar lo mismo que los tests.
//
// Los ángulos son a la derecha (cero en la vista atrás, giro horario), que es
// como mide el instrumento. Ver docs/prds/06-motor-captura-poligonal.md.

export interface CarteraStation {
  pointCode: string;
  /** Lecturas del ángulo en DMS. Las reales del Excel traen una sola. */
  readings: [number, number, number][];
  /** Distancia horizontal del lado. `null` en la fila de cierre. */
  distance: number | null;
}

export interface Cartera {
  name: string;
  angleType: "interior" | "exterior";
  hasOrientation: boolean;
  hasClosingRow: boolean;
  startPointCode: string;
  startNorth: number;
  startEast: number;
  referencePointCode: string;
  referenceNorth: number;
  referenceEast: number;
  stations: CarteraStation[];
}

/**
 * docs/carteras/poligonales.xlsx — 6 vértices, amarre en TT4, cierre CONTRA EL
 * AMARRE: el último ángulo va del último lado de vuelta a TT4.
 * Suma teórica (6-2)·180 + 360 = 1080; observada 1080°00'12".
 */
export const CARTERA_TT4: Cartera = {
  name: "Poligonal V10 — cartera TT4",
  angleType: "interior",
  hasOrientation: true,
  hasClosingRow: true,
  startPointCode: "V10",
  startNorth: 100135.666,
  startEast: 101440.525,
  referencePointCode: "TT4",
  referenceNorth: 100142.809,
  referenceEast: 101436.5,
  stations: [
    { pointCode: "V10", readings: [[211, 15, 7]], distance: 20.744 },
    { pointCode: "D1", readings: [[124, 29, 42]], distance: 11.606 },
    { pointCode: "D2", readings: [[148, 41, 41]], distance: 12.835 },
    { pointCode: "D3", readings: [[91, 1, 1]], distance: 36.985 },
    { pointCode: "D4", readings: [[100, 27, 43]], distance: 18.117 },
    { pointCode: "D5", readings: [[104, 46, 7]], distance: 15.425 },
    { pointCode: "V10", readings: [[299, 18, 51]], distance: null },
  ],
};

/**
 * docs/carteras/Ajuste_Poligonal_Minimos_Cuadrados.xlsx — U. Distrital Sede
 * Vivero, 2021-11-04. 5 vértices, amarre en 14_IS1, cierre CONTRA EL PRIMER
 * LADO: el último ángulo es el interior del vértice de arranque y el de
 * orientación solo fija el datum.
 * Suma teórica (5-2)·180 = 540; observada 539°59'56".
 *
 * Su ajuste por mínimos cuadrados llega en la Fase 9; aquí se calcula con los
 * tres métodos actuales.
 */
export const CARTERA_VIVERO: Cartera = {
  name: "Poligonal Famarena — Sede Vivero",
  angleType: "interior",
  hasOrientation: true,
  hasClosingRow: false,
  startPointCode: "Famarena_5",
  startNorth: 100139.844,
  startEast: 101491.444,
  referencePointCode: "14_IS1",
  referenceNorth: 100160.322,
  referenceEast: 101505.784,
  stations: [
    { pointCode: "Famarena_5", readings: [[97, 46, 32]], distance: 32.957 },
    { pointCode: "D1", readings: [[155, 23, 13]], distance: 13.76 },
    { pointCode: "D2", readings: [[109, 22, 40]], distance: 87.103 },
    { pointCode: "D3", readings: [[79, 16, 2]], distance: 25.846 },
    { pointCode: "D4", readings: [[114, 24, 14]], distance: 86.295 },
    { pointCode: "Famarena_5", readings: [[81, 33, 47]], distance: 32.956 },
  ],
};

export const CARTERAS: Cartera[] = [CARTERA_TT4, CARTERA_VIVERO];
```

Las coordenadas de `14_IS1` no vienen en la hoja Vivero: solo trae el azimut `35°00'08.02"`. Se derivan proyectando ese azimut 25 m desde el arranque, que es lo único que el datum necesita — al amarre se le visa, no se le mide distancia, así que la distancia elegida es arbitraria y no entra en ningún cálculo. Ya verificado: `azimuthFromCoordinates(100139.844, 101491.444, 100160.322, 101505.784)` devuelve exactamente `35°00'08.02"`.

- [ ] **Step 2: Escribir los tests que fallan**

En `src/lib/calculations/polygonal.test.ts`, añadir un bloque nuevo al final:

```ts
import { CARTERA_TT4 } from "@/lib/demo/carteras";
import { azimuthFromCoordinates, dmsToDecimal } from "./angles";

function fromCartera(
  c: typeof CARTERA_TT4,
  method: "bowditch" | "transit" | "crandall",
): PolygonalInput {
  return {
    type: "closed",
    method,
    order: "tercer_orden",
    angleType: c.angleType,
    hasOrientation: c.hasOrientation,
    hasClosingRow: c.hasClosingRow,
    startNorth: c.startNorth,
    startEast: c.startEast,
    startAzimuth: azimuthFromCoordinates(
      c.startNorth, c.startEast, c.referenceNorth, c.referenceEast,
    ),
    endNorth: null, endEast: null, endAzimuth: null,
    stations: c.stations.map((s) => ({
      pointCode: s.pointCode,
      angle: dmsToDecimal(...s.readings[0]!),
      deflectionDirection: null,
      distance: s.distance,
      readings: s.readings.map((r, i) => ({ order: i + 1, angle: dmsToDecimal(...r) })),
    })),
  };
}

describe("computePolygonal — cartera real TT4 (docs/carteras/poligonales.xlsx)", () => {
  const bowditch = computePolygonal(fromCartera(CARTERA_TT4, "bowditch"));

  it("suma 1080°00'12\" contra una teórica de 1080° con orientación y cierre", () => {
    expect(bowditch.theoreticalSum).toBe(1080);
    expect(bowditch.angleSum).toBeCloseTo(1080.003333, 6);
    expect(bowditch.angularError).toBeCloseTo(12, 3);
  });

  it("reparte el error entre los 7 ángulos medidos, no entre los 6 vértices", () => {
    const corrected = bowditch.stations.map((s) => s.correctedAngle!);
    const applied = dmsToDecimal(211, 15, 7) - corrected[0]!;
    expect(applied * 3600).toBeCloseTo(1.714286, 4);
  });

  it("encadena los azimuts de la hoja sumando el ángulo a la derecha", () => {
    const expected = [181.850699, 126.345223, 95.039469, 6.055937, 286.517405, 211.28554];
    expected.forEach((az, i) => expect(bowditch.stations[i]?.azimuth).toBeCloseTo(az, 5));
  });

  it("da el mismo error de cierre y precisión que la hoja", () => {
    expect(bowditch.errorNorth).toBeCloseTo(0.008417, 6);
    expect(bowditch.errorEast).toBeCloseTo(-0.014104, 6);
    expect(bowditch.linearError).toBeCloseTo(0.016425, 6);
    expect(bowditch.perimeter).toBeCloseTo(115.712, 6);
  });

  it("el control de reorientación recupera el azimut de amarre", () => {
    expect(bowditch.reorientationError).toBeCloseTo(0, 3);
  });

  it("reproduce las coordenadas de la hoja BRUJULA dentro de 0.1 mm", () => {
    const expected: [number, number][] = [
      [100135.666, 101440.525],
      [100114.931312, 101439.857597],
      [100108.052182, 101449.20719],
      [100106.923797, 101461.994139],
      [100143.699707, 101465.900541],
      [100148.849172, 101448.533376],
    ];
    expected.forEach(([n, e], i) => {
      expect(bowditch.stations[i]!.north!).toBeCloseTo(n, 4);
      expect(bowditch.stations[i]!.east!).toBeCloseTo(e, 4);
    });
  });

  it("reproduce las coordenadas de la hoja TRANSITO dentro de 0.1 mm", () => {
    const r = computePolygonal(fromCartera(CARTERA_TT4, "transit"));
    const expected: [number, number][] = [
      [100135.666, 101440.525],
      [100114.934902, 101439.854888],
      [100108.057307, 101449.205597],
      [100106.929969, 101461.994444],
      [100143.704877, 101465.897394],
      [100148.855143, 101448.523317],
    ];
    expected.forEach(([n, e], i) => {
      expect(r.stations[i]!.north!).toBeCloseTo(n, 4);
      expect(r.stations[i]!.east!).toBeCloseTo(e, 4);
    });
  });

  it("Crandall cierra a cero, cosa que la hoja del Excel no hace", () => {
    // La hoja CRANDALL usa (ΔN+ΔE)/d donde van el producto ΔN·ΔE/d, Σ(LDᵢ²)
    // donde va (Σ LD)², y tiene los paréntesis mal puestos en los
    // multiplicadores. Por eso vuelve a V10 con 0.22 mm de residuo en N y
    // 0.09 mm en E. El nuestro cierra: no replicamos el error de la hoja.
    const r = computePolygonal(fromCartera(CARTERA_TT4, "crandall"));
    const sumN = r.stations.reduce((a, s) => a + (s.correctedDeltaNorth ?? 0), 0);
    const sumE = r.stations.reduce((a, s) => a + (s.correctedDeltaEast ?? 0), 0);
    expect(sumN).toBeCloseTo(0, 9);
    expect(sumE).toBeCloseTo(0, 9);
  });
});

describe("computePolygonal — ángulos exteriores", () => {
  // No hay cartera real de ángulos exteriores, así que el caso se cubre con un
  // cuadrado recorrido de modo que las lecturas a la derecha caigan como
  // exteriores: 270° en cada vértice, suma (4+2)·180 = 1080.
  //
  // OJO: NO sirve tomar el complemento a 360° de una cartera interior. Bajo
  // Az(i) = Az(i-1) + 180 + a, sustituir a por 360 − a devuelve exactamente la
  // fórmula vieja (+180 − a), o sea el polígono espejo — el bug que esta fase
  // corrige. Y la suma daría 1439.9967, no 1800.
  const square = computePolygonal({
    ...BASE,
    type: "closed",
    angleType: "exterior",
    method: "bowditch",
    stations: [st("A", 270, 100), st("B", 270, 100), st("C", 270, 100), st("D", 270, 100)],
  });

  it("usa (n+2)·180 como suma teórica", () => {
    expect(square.theoreticalSum).toBe(1080);
    expect(square.angleSum).toBe(1080);
    expect(square.angularError).toBeCloseTo(0, 6);
  });

  it("cierra el cuadrado con azimuts 0°, 90°, 180°, 270°", () => {
    expect(square.stations.map((s) => s.azimuth)).toEqual([0, 90, 180, 270]);
    expect(square.linearError).toBeCloseTo(0, 6);
  });
});
```

- [ ] **Step 3: Correr y verificar que falla**

Run: `npx vitest run src/lib/calculations/polygonal.test.ts`
Expected: FAIL. Además del bloque nuevo, fallan tests viejos de azimuts — `encadena azimuts del cuadrado: 0°, 90°, 180°, 270°` pasa a esperar `[0, 270, 180, 90]` con la convención nueva. Eso es correcto y se arregla en el Step 5.

Si falla el test de azimut de `14_IS1`, ajustar `referenceNorth`/`referenceEast` de `CARTERA_VIVERO` para que `azimuthFromCoordinates` dé `35°00'08.02"`.

- [ ] **Step 4: Reescribir `computeClosed`**

En `src/lib/calculations/polygonal.ts`, dentro de `computeClosed`, sustituir el bloque que va desde `// Verificación angular` hasta el cálculo de `deltaE`:

```ts
  // Con orientación, la última fila es de control y no aporta lado: los
  // vértices son stations.length - 1. Sin orientación, cada fila es un vértice.
  const vertexCount = input.hasOrientation ? n - 1 : n;

  // Qué ángulos entran en la condición de cierre angular. Con fila de cierre
  // entran todos, incluido el de orientación, y el vértice de arranque aporta
  // sus dos lecturas, de ahí el +360. Sin fila de cierre el de orientación solo
  // fija el datum y queda fuera de la suma (esquema de la cartera Vivero).
  const first = input.hasOrientation && !input.hasClosingRow ? 1 : 0;
  const participating = angles.slice(first);

  const angleSum = participating.reduce((a, b) => a + b, 0);
  const base = input.angleType === "exterior"
    ? (vertexCount + 2) * 180
    : (vertexCount - 2) * 180;
  const theoreticalSum = base + (input.hasOrientation && input.hasClosingRow ? 360 : 0);

  const angularErrorDeg = angleSum - theoreticalSum;
  const angularError = degreesToSeconds(angularErrorDeg);
  const tolerance = angularTolerance(input.order, participating.length);
  const anglesMeetTolerance = Math.abs(angularError) <= tolerance;

  const correctionPerAngle = -angularErrorDeg / participating.length;
  const correctedAngles = angles.map((a, i) =>
    i >= first ? a + correctionPerAngle : a,
  );

  // Azimuts. El instrumento pone cero en la vista atrás y gira a la derecha,
  // así que el ángulo SE SUMA. Con orientación, el primer azimut sale del
  // azimut de amarre más el ángulo de orientación, sin el ±180: startAzimuth
  // ya apunta del arranque hacia la referencia.
  const azimuths: number[] = [];
  if (input.hasOrientation) {
    azimuths.push(normalizeAzimuth(input.startAzimuth + (correctedAngles[0] ?? 0)));
    for (let i = 1; i < n; i++) {
      azimuths.push(
        normalizeAzimuth((azimuths[i - 1] ?? 0) + 180 + (correctedAngles[i] ?? 0)),
      );
    }
  } else {
    azimuths.push(input.startAzimuth);
    for (let i = 1; i < n; i++) {
      azimuths.push(
        normalizeAzimuth((azimuths[i - 1] ?? 0) + 180 + (correctedAngles[i] ?? 0)),
      );
    }
  }

  // Control de reorientación: el último azimut de la cadena debe volver al
  // azimut de amarre (con fila de cierre) o al del primer lado (sin ella).
  let reorientationError: number | null = null;
  if (input.hasOrientation) {
    const target = input.hasClosingRow ? normalizeAzimuth(input.startAzimuth) : azimuths[0]!;
    const diff = normalizeAzimuth((azimuths[n - 1] ?? 0) - target);
    reorientationError = degreesToSeconds(diff > 180 ? diff - 360 : diff);
  }

  // Solo las filas con distancia aportan lado; la de control no.
  const sideCount = input.hasOrientation ? vertexCount : n;
  const deltaN = azimuths
    .slice(0, sideCount)
    .map((az, i) => (distances[i] ?? 0) * cosDeg(az));
  const deltaE = azimuths
    .slice(0, sideCount)
    .map((az, i) => (distances[i] ?? 0) * sinDeg(az));
```

Ajustar además:
- `hasAllData` deja de exigir `distances.every(isNum)`: la fila de cierre no lleva distancia. Pasa a `distances.slice(0, input.hasOrientation ? n - 1 : n).every(isNum)`.
- `sumDistances` ya ignora los `null`, no se toca.
- `theoreticalSum` del retorno temprano (datos insuficientes) usa la misma fórmula.
- El `correctDeltas` recibe `distances.slice(0, sideCount)` y `azimuths.slice(0, sideCount)`.
- En `stationResults`, `readingDispersion` sale de las lecturas:

```ts
function dispersionSeconds(readings: ReadingInput[]): number | null {
  if (readings.length < 2) return null;
  const values = readings.map((r) => r.angle);
  return degreesToSeconds(Math.max(...values) - Math.min(...values));
}
```

- Añadir `reorientationError` al objeto de retorno y `reorientationError: null` al retorno temprano.

- [ ] **Step 5: Actualizar los tests viejos a la convención nueva**

En `polygonal.test.ts`, los casos existentes de poligonal cerrada no tienen orientación. Añadirles al `BASE`:

```ts
const BASE: Omit<PolygonalInput, "type" | "stations" | "method"> = {
  startNorth: 0,
  startEast: 0,
  startAzimuth: 0,
  angleType: "interior",
  hasOrientation: false,
  hasClosingRow: false,
  endNorth: null,
  endEast: null,
  endAzimuth: null,
  order: "tercer_orden",
};
```

Y `st()` pasa a construir `readings`:

```ts
function st(
  pointCode: string,
  angle: number,
  distance: number | null,
  deflectionDirection: DeflectionDirection | null = null,
): StationInput {
  return {
    pointCode, angle, deflectionDirection, distance,
    readings: [{ order: 1, angle }],
  };
}
```

El test del cuadrado pasa a esperar los azimuts de la convención nueva:

```ts
  it("encadena azimuts del cuadrado a la derecha: 0°, 270°, 180°, 90°", () => {
    expect(square.stations.map((s) => s.azimuth)).toEqual([0, 270, 180, 90]);
  });
```

Y sus coordenadas esperadas se espejan: el vértice tras el primer lado sigue en `(100, 0)`, pero el siguiente pasa de `(100, 100)` a `(100, -100)`. Correr el test y leer los valores reales antes de fijarlos, verificando a mano que el cuadrado cierra.

- [ ] **Step 6: Correr y verificar que pasa**

Run: `npx vitest run src/lib/calculations/polygonal.test.ts`
Expected: PASS, todo el archivo en verde.

- [ ] **Step 7: Typecheck y commit**

```bash
npm run typecheck   # seguirá fallando fuera de calculations/: es esperado hasta la tarea 12
npx vitest run src/lib/calculations
git add src/lib/calculations src/lib/demo/carteras.ts
git commit -m "feat: convención de ángulo a la derecha y amarre externo en el motor

Reproduce las hojas BRUJULA y TRANSITO de la cartera real dentro de 0.1 mm
y verifica que Crandall cierra, cosa que la hoja del Excel no hace."
```

---

### Task 5: Validación de captura

**Files:**
- Modify: `src/lib/calculations/tolerances.ts`
- Modify: `src/lib/validators/polygonal.ts`
- Test: `src/lib/calculations/tolerances.test.ts`
- Test: `src/lib/validators/polygonal.test.ts`

**Interfaces:**
- Consumes: `readingDispersionTolerance` de `tolerances.ts` (nuevo en esta tarea).
- Produces: `readingDispersionTolerance(instrumentSeconds: number): number` en `tolerances.ts`; `validateReadings(readings: ReadingInput[], min: number, instrumentSeconds: number): { error?: string; warning?: string }`; `expectStationCapture(type, index, total, hasClosingRow?)`. Los consumen las tareas 6 y 9.

- [ ] **Step 1: Escribir los tests que fallan**

```ts
describe("validateReadings", () => {
  it("exige el mínimo de lecturas configurado", () => {
    const r = validateReadings([{ order: 1, angle: 90 }], 3, 5);
    expect(r.error).toBe("Faltan lecturas: se exigen 3 y hay 1.");
  });

  it("acepta cuando se alcanza el mínimo", () => {
    const readings = [90, 90.0001, 90.0002].map((angle, i) => ({ order: i + 1, angle }));
    expect(validateReadings(readings, 3, 5).error).toBeUndefined();
  });

  it("avisa cuando la dispersión supera lo que el equipo resuelve", () => {
    // Equipo de 5": tres lecturas con 36" de separación no son repetibilidad,
    // son un error de puntería o de transcripción.
    const readings = [90, 90.005, 90.01].map((angle, i) => ({ order: i + 1, angle }));
    const r = validateReadings(readings, 3, 5);
    expect(r.warning).toMatch(/dispersión/i);
  });

  it("no avisa con lecturas dentro de la precisión del equipo", () => {
    // 5" de separación con un equipo de 5": dentro del margen (2x).
    const readings = [90, 90.0007, 90.0014].map((angle, i) => ({ order: i + 1, angle }));
    expect(validateReadings(readings, 3, 5).warning).toBeUndefined();
  });
});

describe("expectStationCapture — fila de cierre", () => {
  it("la fila de cierre pide ángulo y no distancia", () => {
    expect(expectStationCapture("closed", 6, 7, true)).toEqual({ angle: true, distance: false });
  });

  it("sin fila de cierre, la última sigue pidiendo distancia", () => {
    expect(expectStationCapture("closed", 5, 6, false)).toEqual({ angle: true, distance: true });
  });
});
```

- [ ] **Step 2: Correr y verificar que falla**

Run: `npx vitest run src/lib/validators/polygonal.test.ts`
Expected: FAIL — `validateReadings is not a function`.

- [ ] **Step 3: Implementar**

Primero, la tolerancia. En `src/lib/calculations/tolerances.ts`:

```ts
/**
 * Factor sobre la precisión angular del equipo que se admite como dispersión
 * entre lecturas de un mismo ángulo.
 *
 * La vara correcta aquí es el instrumento, no el orden de precisión: el orden
 * gobierna el cierre de la poligonal, mientras que repetir una lectura mide
 * repetibilidad. Un equipo de 5" no distingue dos punterías que difieren 4",
 * pero 36" de separación no es repetibilidad, es un error de puntería o de
 * transcripción. El 2 es criterio, no norma citada: es el umbral a partir del
 * cual vale la pena que el capturador mire otra vez.
 */
export const READING_DISPERSION_FACTOR = 2;

/** Dispersión máxima admitida entre lecturas, en segundos de arco. */
export function readingDispersionTolerance(instrumentSeconds: number): number {
  return READING_DISPERSION_FACTOR * instrumentSeconds;
}
```

Y en `src/lib/validators/polygonal.ts`:

```ts
import { readingDispersionTolerance } from "@/lib/calculations/tolerances";
import { degreesToSeconds } from "@/lib/calculations/angles";
import type { ReadingInput } from "@/types/polygonal";

/**
 * Valida las lecturas de un ángulo. La dispersión (máx − mín) es control de
 * calidad de la captura: tres lecturas que difieren 40" dicen algo que el
 * promedio esconde. Se contrasta con la precisión angular del equipo del
 * proyecto (`projects.angular_precision_seconds`), no con la tolerancia del
 * orden. Avisa, no bloquea — misma política que el resto del editor.
 */
export function validateReadings(
  readings: ReadingInput[],
  min: number,
  instrumentSeconds: number,
): { error?: string; warning?: string } {
  if (readings.length < min) {
    return {
      error: `Faltan lecturas: se exigen ${min} y hay ${readings.length}.`,
    };
  }
  if (readings.length < 2) return {};

  const values = readings.map((r) => r.angle);
  const dispersion = degreesToSeconds(Math.max(...values) - Math.min(...values));
  const limit = readingDispersionTolerance(instrumentSeconds);
  if (dispersion > limit) {
    return {
      warning: `Dispersión de ${dispersion.toFixed(1)}" entre lecturas, sobre los ${limit.toFixed(1)}" que admite un equipo de ${instrumentSeconds}".`,
    };
  }
  return {};
}
```

Y añadir el cuarto parámetro a `expectStationCapture`:

```ts
export function expectStationCapture(
  type: PolygonalType,
  index: number,
  total: number,
  hasClosingRow = false,
): { angle: boolean; distance: boolean } {
  if (type === "closed") {
    // La fila de cierre es de control: lleva ángulo contra el amarre y no
    // cierra ningún lado, así que no pide distancia.
    if (hasClosingRow && index === total - 1) return { angle: true, distance: false };
    return { angle: true, distance: true };
  }
  if (index === 0) return { angle: false, distance: true };
  if (index === total - 1) return { angle: false, distance: false };
  return { angle: true, distance: true };
}
```

- [ ] **Step 4: Correr y verificar que pasa**

Run: `npx vitest run src/lib/validators/polygonal.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/calculations/tolerances.ts src/lib/validators/polygonal.ts src/lib/validators/polygonal.test.ts
git commit -m "feat: validación de lecturas contra la precisión del equipo"
```

---

### Task 6: Queries y Server Actions

**Files:**
- Modify: `src/lib/supabase/queries.ts`
- Modify: `src/app/(app)/projects/[id]/polygonal/new/actions.ts:60-80`
- Modify: `src/app/(app)/projects/[id]/polygonal/[pid]/actions.ts:170-200,315-335`

**Interfaces:**
- Consumes: la tabla de la Task 2, los tipos de la Task 3.
- Produces: la query de proceso devuelve `stations[].readings` y `referencePoint`; `savePolygonalProcessAction` persiste lecturas y promedio. Las consumen las tareas 7 a 11.

- [ ] **Step 1: Extender la query del proceso**

En `src/lib/supabase/queries.ts`, en la consulta que trae `polygonal_stations`, añadir las lecturas anidadas:

```ts
    .select(
      `*, polygonal_stations(*, polygonal_angle_readings(*))`,
    )
```

Ordenar las lecturas por `reading_order` al mapear, porque PostgREST no garantiza orden en el anidado.

- [ ] **Step 2: Resolver el azimut de amarre al guardar**

En las dos Server Actions, donde hoy se escribe `angle_type` derivado del tipo:

```ts
      angle_type: payload.angleType,
      reference_point_id: payload.referencePointId,
      reference_point_code: payload.referencePointCode,
      angle_readings_min: payload.angleReadingsMin,
```

Y antes de escribir, resolver el azimut cuando hay punto de catálogo. Se persiste el azimut resuelto en `start_azimuth_*` en vez de releerse del catálogo al calcular: si alguien edita el punto después, el proceso conserva el azimut con el que se calculó (riesgo documentado en el PRD de fase).

```ts
  if (payload.referencePointId) {
    const { data: refPoint } = await supabase
      .from("reference_points")
      .select("north, east")
      .eq("id", payload.referencePointId)
      .single();

    if (refPoint?.north == null || refPoint?.east == null) {
      return { error: "El punto de amarre no tiene coordenadas." };
    }
    const az = azimuthFromCoordinates(
      Number(payload.startNorth), Number(payload.startEast),
      Number(refPoint.north), Number(refPoint.east),
    );
    const dms = decimalToDms(az);
    startAzimuthDeg = dms.deg;
    startAzimuthMin = dms.min;
    startAzimuthSec = dms.sec;
  }
```

- [ ] **Step 3: Persistir lecturas y promedio**

En `savePolygonalProcessAction`, después de insertar las estaciones (que ya devuelven su `id`), insertar las lecturas y escribir el promedio en la estación:

```ts
  const readingRows = stations.flatMap((station, i) =>
    station.readings.map((r, order) => ({
      station_id: insertedStations[i]!.id,
      reading_order: order + 1,
      angle_deg: r.deg,
      angle_min: r.min,
      angle_sec: r.sec,
    })),
  );
  if (readingRows.length > 0) {
    const { error } = await supabase.from("polygonal_angle_readings").insert(readingRows);
    if (error) return { error: "No se pudieron guardar las lecturas." };
  }
```

El promedio se calcula en decimal, se convierte con `decimalToDms` y se escribe en `angle_deg/min/sec` de la estación. Las estaciones se borran y reinsertan en cada guardado, igual que hoy, así que las lecturas caen por `ON DELETE CASCADE` y no hay que borrarlas aparte.

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck`
Expected: los errores restantes están solo en componentes y seed (tareas 7 a 12).

- [ ] **Step 5: Commit**

```bash
git add src/lib/supabase/queries.ts "src/app/(app)/projects/[id]/polygonal"
git commit -m "feat: persistencia de lecturas y azimut de amarre resuelto"
```

---

### Task 7: Configuración del proceso

**Files:**
- Modify: `src/components/polygonal/polygonal-config-fields.tsx`
- Modify: `src/components/polygonal/new-polygonal-form.tsx`

**Interfaces:**
- Consumes: `CLOSED_ANGLE_TYPE_OPTIONS` (Task 3), `azimuthFromCoordinates` (Task 1), `ReferencePoint` de `types/project`.
- Produces: `PolygonalConfigState` con `angleType`, `referencePointId`, `referencePointCode`, `angleReadingsMin`, `hasClosingRow`. La consumen las tareas 8, 9 y 10.

- [ ] **Step 1: Extender el estado de configuración**

```ts
export interface PolygonalConfigState {
  name: string;
  type: PolygonalType;
  /** "" mientras el usuario no elige: el selector no preselecciona. */
  angleType: AngleType | "";
  startPointCode: string;
  startNorth: string;
  startEast: string;
  startAzimuth: DmsValue;
  /** Punto de amarre del catálogo. "" = amarre manual o sin amarre. */
  referencePointId: string;
  referencePointCode: string;
  hasClosingRow: boolean;
  angleReadingsMin: string;
  endPointCode: string;
  endNorth: string;
  endEast: string;
  endAzimuth: DmsValue;
}
```

En `EMPTY_POLYGONAL_CONFIG`: `angleType: ""`, `referencePointId: ""`, `referencePointCode: ""`, `hasClosingRow: false`, `angleReadingsMin: "3"`. Los `startNorth`/`startEast` siguen en `"1000"`: arrancar en sistema local arbitrario es el caso normal.

- [ ] **Step 2: Añadir los controles**

El componente recibe una prop nueva `referencePoints: ReferencePoint[]`. El selector de amarre solo lista los que tienen `north` y `east` no nulos:

```tsx
const amarreOptions = [
  { value: "", label: "Sin amarre / manual" },
  ...referencePoints
    .filter((p) => p.north != null && p.east != null)
    .map((p) => ({ value: p.id, label: `${p.code} (${p.north}, ${p.east})` })),
];
```

Cuando hay `referencePointId`, el `DmsInput` del azimut queda `disabled` y muestra el valor calculado:

```tsx
const selected = referencePoints.find((p) => p.id === value.referencePointId);
const derivedAzimuth =
  selected && selected.north != null && selected.east != null
    ? decimalToDms(
        azimuthFromCoordinates(
          Number(value.startNorth), Number(value.startEast),
          Number(selected.north), Number(selected.east),
        ),
      )
    : null;
```

El selector de tipo de ángulo solo aparece con `type === "closed"`, usa `CLOSED_ANGLE_TYPE_OPTIONS` y lleva una opción vacía inicial `{ value: "", label: "Elegir…" }` para no preseleccionar.

Añadir un checkbox «La cartera cierra contra el punto de amarre» ligado a `hasClosingRow`, visible solo cuando hay amarre, con el texto de ayuda: «Si está marcado, la última fila es el ángulo del último lado de vuelta al amarre y no lleva distancia.»

Y un `Input` numérico para `angleReadingsMin`, etiquetado «Lecturas mínimas por ángulo».

- [ ] **Step 3: Typecheck y prueba manual**

```bash
npm run typecheck
npm run dev
```

Abrir `/projects/<id>/polygonal/new`, verificar que el tipo de ángulo arranca sin elegir, que el selector de amarre lista solo puntos con coordenadas y que al elegir uno el azimut se llena solo y queda de solo lectura.

- [ ] **Step 4: Commit**

```bash
git add src/components/polygonal/polygonal-config-fields.tsx src/components/polygonal/new-polygonal-form.tsx
git commit -m "feat: tipo de ángulo explícito y amarre desde el catálogo"
```

---

### Task 8: Azimut derivado al reasignar coordenadas

**Files:**
- Modify: `src/components/polygonal/reassign-coordinates-dialog.tsx`
- Modify: `src/components/polygonal/polygonal-editor.tsx:340-360`

**Interfaces:**
- Consumes: `azimuthFromCoordinates` (Task 1), `decimalToDms`.
- Produces: `onApply(north, east, azimuth, referenceNorth, referenceEast)`.

- [ ] **Step 1: Añadir las coordenadas del amarre al diálogo**

El diálogo gana dos campos más — N y E del punto de amarre — y el `DmsInput` del azimut pasa a solo lectura, alimentado por:

```ts
const azimuth = useMemo(() => {
  const n = Number(north), e = Number(east);
  const rn = Number(refNorth), re = Number(refEast);
  if (![n, e, rn, re].every(Number.isFinite)) return EMPTY_DMS;
  const d = decimalToDms(azimuthFromCoordinates(n, e, rn, re));
  return { deg: String(d.deg), min: String(d.min), sec: String(d.sec) };
}, [north, east, refNorth, refEast]);
```

Cuando el proceso no tiene amarre, los campos de referencia no se muestran y el azimut vuelve a ser editable, como hoy.

- [ ] **Step 2: Prueba manual del invariante**

`npm run dev`, abrir una poligonal calculada, anotar error angular, error lineal y precisión relativa. Reasignar coordenadas (por ejemplo de `1000, 1000` a las reales de la cartera) y verificar que **los tres valores no cambian** — una rotación más traslación los deja invariantes — y que las coordenadas de todas las estaciones sí cambian.

- [ ] **Step 3: Commit**

```bash
git add src/components/polygonal/reassign-coordinates-dialog.tsx src/components/polygonal/polygonal-editor.tsx
git commit -m "feat: azimut derivado de coordenadas al reasignar"
```

---

### Task 9: Captura de N lecturas en la tabla

**Files:**
- Modify: `src/components/polygonal/stations-table.tsx`

**Interfaces:**
- Consumes: `validateReadings`, `expectStationCapture` (Task 5); `PolygonalConfigState` (Task 7). La tabla recibe además `angularPrecisionSeconds: number`, que el editor toma de `project.angular_precision_seconds` y pasa a `validateReadings`.
- Produces: la tabla emite estaciones con `readings: DmsValue[]`.

- [ ] **Step 1: Celda de ángulo expandible**

La celda de ángulo pasa de un `DmsInput` a un grupo: el promedio calculado en texto, la dispersión, y un botón que despliega los N `DmsInput` de lecturas. Fuera del despliegue se muestra siempre `promedio ± dispersión`, que es lo que el topógrafo quiere ver de un vistazo.

Filas de lectura por estación = `max(angleReadingsMin, lecturas capturadas)`, con un botón «+ lectura» para añadir más allá del mínimo.

- [ ] **Step 2: Promedio y dispersión en vivo**

```ts
const decimals = readings
  .map((r) => dmsToDecimal(Number(r.deg), Number(r.min), Number(r.sec)))
  .filter(Number.isFinite);
const average = decimals.length ? decimals.reduce((a, b) => a + b, 0) / decimals.length : null;
const dispersion = decimals.length > 1
  ? degreesToSeconds(Math.max(...decimals) - Math.min(...decimals))
  : null;
```

El aviso de dispersión usa `validateReadings` y se pinta con el mismo estilo de warning que ya usa la tabla, sin bloquear el cálculo.

- [ ] **Step 3: Fila de cierre**

Cuando `hasClosingRow`, la última fila se renderiza con el código del punto de arranque fijo y sin celda de distancia, y se rotula «Cierre contra \<código del amarre\>».

- [ ] **Step 4: Typecheck y prueba manual**

```bash
npm run typecheck
npm run dev
```

Capturar la cartera TT4 a mano y verificar que el error de cierre que muestra el editor es `0.016` y la precisión `1:7044`.

- [ ] **Step 5: Commit**

```bash
git add src/components/polygonal/stations-table.tsx
git commit -m "feat: captura de N lecturas con promedio y dispersión"
```

---

### Task 10: Panel de resultados

**Files:**
- Modify: `src/components/polygonal/results-panel.tsx`
- Modify: `src/components/polygonal/closure-verdict.tsx`
- Test: `src/components/polygonal/closure-verdict.test.tsx`

- [ ] **Step 1: Mostrar la suma teórica y el reparto reales**

El panel deja de asumir `(n−2)·180`: muestra `theoreticalSum` del resultado y, bajo él, «Error repartido entre N ángulos» con `N` = ángulos que participaron.

- [ ] **Step 2: Añadir el control de reorientación**

Una fila nueva con `reorientationError` en segundos y su indicador de estado, rotulada «Control de reorientación» y con el texto de ayuda: «El último azimut debe volver al azimut de amarre.» Se oculta cuando es `null`.

- [ ] **Step 3: Test del veredicto**

Añadir a `closure-verdict.test.tsx` un caso con `reorientationError` alto que verifique que se muestra el aviso sin cambiar el veredicto de cierre — es control de calidad, no criterio de tolerancia.

- [ ] **Step 4: Correr, typecheck y commit**

```bash
npx vitest run src/components/polygonal
npm run typecheck
git add src/components/polygonal/results-panel.tsx src/components/polygonal/closure-verdict.tsx src/components/polygonal/closure-verdict.test.tsx
git commit -m "feat: suma teórica real y control de reorientación en resultados"
```

---

### Task 11: Export

**Files:**
- Modify: `src/lib/export/polygonal-workbook.ts`
- Test: `src/lib/export/polygonal-workbook.test.ts`

- [ ] **Step 1: Test de la fila de cierre**

```ts
it("exporta la fila de cierre sin distancia y no la cuenta como lado", async () => {
  const wb = await buildPolygonalWorkbook(procesoConCierre);
  const sheet = wb.getWorksheet("Poligonal")!;
  // 7 filas de estación para 6 vértices, la última sin distancia.
  expect(sheet.getCell(`E${7 + 6}`).value).toBeNull();
});
```

- [ ] **Step 2: Correr y verificar que falla**

Run: `npx vitest run src/lib/export/polygonal-workbook.test.ts`

- [ ] **Step 3: Adaptar el builder**

Las columnas de lectura se añaden como columnas extra a la derecha del promedio, una por `reading_order`, para que el Excel exportado conserve el dato de campo crudo. El perímetro y el conteo de lados salen de las filas con distancia, nunca de `stations.length`.

- [ ] **Step 4: Correr, typecheck y commit**

```bash
npx vitest run src/lib/export
npm run typecheck
git add src/lib/export
git commit -m "feat: export con lecturas y fila de cierre"
```

---

### Task 12: Seed y fixtures

**Files:**
- Modify: `scripts/seed.mjs`
- Modify: `src/lib/demo/fixtures.ts`
- Modify: `src/lib/demo/crear-proyecto-demo.ts`
- Test: `src/lib/demo/fixtures.test.ts`

- [ ] **Step 1: Sembrar las dos carteras reales**

`scripts/seed.mjs` importa `CARTERAS` de `src/lib/demo/carteras.ts` y crea un proceso por cartera y método relevante. Cada cartera siembra además su punto de amarre como `reference_points` de tipo `control`, para que el proceso lo referencie por `reference_point_id`.

Los 7 procesos actuales se actualizan a la convención nueva: `angle_type: "interior"`, `hasOrientation: false`, `hasClosingRow: false`. Sus coordenadas cambian respecto a lo que sembraban antes; es el reset acordado (decisión 5).

- [ ] **Step 2: Actualizar los fixtures del demo**

`fixtures.ts` cambia `angleType: "internal"` por `"interior"` en los cuatro procesos y añade `readings` con una lectura por ángulo.

- [ ] **Step 3: Correr el seed y verificar en la app**

```bash
npx supabase start
npm run seed
npm run dev
```

Abrir la poligonal «cartera TT4» y verificar contra el Excel: error angular `12"`, error lineal `0.016`, precisión `1:7044`, y las coordenadas de D1 a D5 de la tabla de referencia de este plan.

- [ ] **Step 4: Typecheck, tests y commit**

```bash
npm run typecheck
npm test
git add scripts/seed.mjs src/lib/demo
git commit -m "feat: seed con las dos carteras de campo reales"
```

---

### Task 13: Verificación y cierre de fase

**Files:**
- Modify: `docs/tecnica/README.md`
- Modify: `docs/manual/README.md`
- Modify: `src/app/(app)/manual/manual-data.ts`
- Modify: `docs/prds/06-motor-captura-poligonal.md`
- Modify: `docs/method.md`, `docs/prds/README.md`

- [ ] **Step 1: Recorrer los criterios a-q del PRD de fase**

Uno por uno, anotando evidencia. El criterio `k` (inmutabilidad de lecturas por REST) se prueba con el JWT del usuario seed contra un proceso cerrado, igual que hizo la migración `20260727180000`.

- [ ] **Step 2: Correr la verificación completa**

```bash
npm run typecheck && npm run lint && npm test
```

Expected: los tres en verde.

- [ ] **Step 3: Regenerar capturas**

```bash
node docs/manual/capturas.mjs
```

- [ ] **Step 4: Actualizar la documentación de handoff**

En `docs/tecnica/README.md`: la convención de azimut (hoy documenta la vieja), el estado de fases, la tabla de pruebas y la deuda técnica. En `docs/manual/README.md` y `src/app/(app)/manual/manual-data.ts`, **los dos en el mismo commit**: el texto vive duplicado y no hay generación automática. Buscar y corregir toda mención de «Bowditch (brújula)» que describa la convención vieja:

```bash
grep -rn "internal\|(n-2)\|azimut" docs/tecnica docs/manual src/app/\(app\)/manual
```

- [ ] **Step 5: Cerrar la fase**

Marcar `cerrada` en la cabecera del PRD de fase, en `docs/method.md` y en `docs/prds/README.md`, y anotar los aprendizajes en `method.md`.

```bash
git add -A
git commit -m "docs: cerrar fase 7 — motor y captura de poligonales"
```
