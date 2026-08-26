# PRD-de-fase 5 — Control de Asentamientos

**Estado:** cerrada
**Fecha de apertura:** 2026-08-25
**Fecha de cierre:** 2026-08-25

## Propósito

Construir el tercer y último módulo de proceso topográfico: el **control de
asentamientos**. Al cerrar esta fase, un usuario debe poder definir un **lugar**
de monitoreo dentro de un proyecto, catalogar sus puntos de control, registrar
**visitas** sucesivas en el tiempo, y ver para cada punto su asentamiento
parcial y acumulado, su velocidad, su nivel de alerta, los asentamientos
diferenciales con su distorsión angular, y la evolución temporal en una gráfica.

A diferencia de las fases 3 y 4, esta fase no es solo un módulo nuevo. Introduce
una **entidad transversal** —el lugar— que reorganiza los tres módulos, y cierra
dos deudas técnicas que las fases anteriores dejaron abiertas. El alcance es
deliberadamente mayor que el de la Fase 4; ver «Riesgos conocidos».

## Fuentes

- `PRD-TopoField.md` — `§3.2` (tablas), `§4.5` (editor), `§4.6` (cierre), `§5.3`
  (validación estadística), `§6.10`-`§6.11` (algoritmos).
- `docs/marco-teorico/mt-control_asentamientos.docx` — marco teórico con tres
  casos de estudio (edificio, presa, terraplén), tabla de umbrales y métodos de
  análisis. **Verificado con código; ver «Hallazgos de la verificación».**
- `docs/method.md` — «Aprendizajes acumulados» del cierre de la Fase 4.
- `docs/tecnica/README.md` `§11` — deuda técnica heredada.

## Hallazgos de la verificación

El método exige verificar las tablas del marco teórico con código antes de
fiarse de sus números, porque ya resultaron inconsistentes en poligonales
(Fase 3) y en nivelación (Fase 4). Se hizo. **Es la tercera vez, y esta vez el
fallo está en la parte que el módulo debe calcular.**

### 1. Los asentamientos y las distorsiones sí cuadran

Verificado exhaustivamente:

- **Caso 1 (edificio), tabla `§5.2`:** los 9 asentamientos de C1 son exactamente
  `(Cota_C1 − Cota_C0) × 1000`. Exactos, sin excepción.
- **Caso 1, histórico de P-09 (`§5.3`):** los 7 asentamientos parciales y los 7
  acumulados son exactos.
- **Caso 1, diferenciales (`§5.4`):** los 7 pares dan el diferencial exacto, y
  las 7 distorsiones angulares reproducen `1/(L×1000/Δs)` con error < 0.1 %.
- **Casos 2 y 3:** los 19 acumulados de presa y terraplén son exactos.

Es decir: `§6.10` del PRD principal es correcto y el documento lo aplica bien.
**Las fórmulas de asentamiento y distorsión angular se pueden implementar tal
como están.**

### 2. Las velocidades NO cuadran

De los 7 intervalos del histórico de P-09, **3 fallan** bajo cualquier
definición razonable de «mes»:

| Campaña | Intervalo | Doc (mm/mes) | Calculado /30d | Calculado /30.4375d |
|---|---|---|---|---|
| C1 | 31 d | −5.8 | −5.61 | −5.69 |
| C2 | 28 d | −5.1 | −5.46 | −5.54 |
| C3 | 31 d | −3.9 | −3.77 | −3.83 |
| C4 | 30 d | −2.9 | −2.90 ✓ | −2.94 |
| C5 | 61 d | −1.0 | −0.93 | −0.95 ✓ |
| C6 | 92 d | −0.4 | −0.36 ✓ | −0.36 ✓ |
| C7 | 92 d | −0.1 | −0.13 | −0.13 |

El patrón es transparente: **el documento copió el asentamiento parcial en la
columna de velocidad** siempre que el intervalo fuera «un mes», ignorando que
los meses tienen 28, 30 o 31 días. Solo acierta cuando el intervalo mide
exactamente 30 días (C4). En los intervalos largos (C5–C7) sí dividió, pero
redondeando de forma inconsistente.

**Consecuencia:** la velocidad exige fijar una convención explícita de «mes».
Ver decisión #3.

### 3. Los estados de alerta NO se derivan de los umbrales

Es el hallazgo más grave, porque afecta a lo que `§6.11` promete calcular.
Contrastando cada estado documentado contra la tabla de umbrales del propio
documento (`§4.1`):

**Caso 1 (edificio), campaña C1** — umbral de precaución de velocidad = 2 mm/mes:

| Punto | Velocidad | Estado doc | Estado por umbral |
|---|---|---|---|
| P-02 | −2.5 | Normal | **precaución** |
| P-03 | −2.9 | Normal | **precaución** |
| P-04 | −2.2 | Normal | **precaución** |
| P-05 | −3.2 | Normal | **precaución** |
| P-06 | −3.7 | Precaución | precaución ✓ |
| P-08 | −4.0 | Precaución | precaución ✓ |

Cuatro puntos que superan el umbral de precaución aparecen como «Normal»,
mientras otros dos con velocidades del mismo orden sí se marcan.

**Caso 2 (presa)** — umbral de acumulado para presa = 10 mm: D-03 con −7.9 mm
figura como «Precaución» sin alcanzar el umbral.

**Caso 3 (terraplén)** — los estados no admiten *ningún* juego de umbrales:

```
17 mm → Normal      40 mm → Normal        60 mm → Precaución
21 mm → Normal      45 mm → Precaución    66 mm → Alerta
23 mm → Normal                            70 mm → Alerta
36 mm → Normal
```

40 mm es «Normal» y 45 mm «Precaución»; pero 60 mm vuelve a «Precaución» y
66 mm salta a «Alerta». No existe umbral monótono que produzca esa secuencia.

**Consecuencia:** los estados del marco teórico son **juicio editorial del
autor, no clasificación calculada**. El algoritmo del `§6.11` del PRD principal
es correcto y es el que se implementa; los estados del documento **no sirven
como caso de prueba** y no deben usarse para «verificar» la implementación. Este
es exactamente el fallo que advierte el aprendizaje de la Fase 4: números
plausibles que nadie recalcula.

### 4. El PRD principal se contradice consigo mismo en los umbrales

Los valores por defecto de `settlement_systems` en el `§3.2`
(`accumulated_caution 10`, `alert 25`, `alarm 50`) **son los umbrales de presa**
de la tabla `§4.1` del marco teórico. Los de edificio son 25/50/75.

Un sistema creado con los defaults del `§3.2` clasificaría un edificio con
criterio de presa: marcaría alarma a los 50 mm cuando su propio marco de
referencia sitúa ahí el umbral de alerta. Ver decisión #2.

### 5. La deuda del semáforo no se resuelve cambiando los colores

`docs/tecnica/README.md` `§11` registra que los cuatro tokens quedaron con poca
separación entre niveles contiguos, y propone como alternativa un juego de
rellenos vivos con anillos oscuros. **Se midieron ambos juegos:**

| Par | Tokens actuales | Alternativa propuesta |
|---|---|---|
| verde/amarillo | 1.178 | 1.381 |
| amarillo/naranja | 1.146 | 1.167 |
| naranja/rojo | 1.014 | 1.260 |
| **verde/rojo** | **1.028** | **1.065** |

La alternativa mejora los pares contiguos pero **empeora el par que más importa**:
verde contra rojo, los dos extremos del semáforo, quedarían en 1.065 — todavía
indistinguibles por luminancia. La medición además revela un dato que la deuda
no registraba: verde y rojo **ya** están en 1.028 hoy.

La causa es estructural, no una mala elección de hexadecimales: cuatro niveles
que deben cumplir ≥3:1 contra blanco quedan comprimidos en una banda estrecha de
luminancia, y por tanto próximos entre sí. **No hay cuarteto de colores que lo
resuelva.** Ver decisión #9.

## Alcance

### Dentro

- Migración aditiva: tabla `sites` (lugar), `settlement_points`,
  `settlement_visits`, `settlement_readings`; `site_id NOT NULL` en
  `polygonal_processes` y `leveling_processes`; RLS, triggers de `updated_at` e
  inmutabilidad.
- `src/lib/calculations/settlement.ts` (parcial, acumulado, velocidad,
  diferenciales, distorsión angular, aceleración, clasificación de alertas) +
  tests Vitest.
- Presets de umbrales por tipo de estructura en
  `src/lib/calculations/tolerances.ts`.
- `src/lib/validators/settlement.ts` (capas de captura, cierre y estadística).
- Tipos de dominio `src/types/settlement.ts` y `src/types/site.ts`.
- Capa de datos: queries y Server Actions **con revalidación de captura en el
  servidor desde el día uno** (decisión #10).
- Rutas: gestión de lugares, editor del lugar de monitoreo, editor de visita.
- Gráfica de asentamiento vs tiempo en SVG propio (sin librería).
- Design system: `StatusIndicator` a 4 niveles con segundo canal (forma).
- Hub: sub-tabs Poligonales / Nivelaciones / Control de Asentamientos.
- **Cierre de deuda:** revalidación de captura en servidor para poligonal y
  nivelación (retrofit).
- **Cierre de deuda:** KPI del dashboard y conteos por proyecto incluyen los tres
  módulos.
- Seed: lugares para los procesos existentes y un lugar de monitoreo con serie
  temporal completa.

### Fuera (diferido)

- **Modelos de predicción** (Asaoka, hiperbólico, Terzaghi) del `§4.3` del marco
  teórico → es análisis geotécnico, no topografía. Decisión #8.
- **Correlación con nivel de embalse / piezometría** (`§6.3` del marco teórico) →
  requiere series de datos externas al producto.
- **Gráfica de perfil en planta** → las coordenadas N/E quedan capturadas, así
  que es viable a futuro, pero no entra aquí.
- **Fotografía del punto** (`§3.2` del marco teórico) → exige almacenamiento de
  archivos, ausente en todo el producto.
- **Registro de equipos con certificados de calibración** (`§3.2` del marco
  teórico) → catálogo administrativo, fuera del alcance de una monografía.
- Informes y exportación a Excel → Fase 6.
- Auto-save → guardado explícito, coherente con Fases 3 y 4.

## Decisiones cerradas

| # | Decisión | Razón |
|---|---|---|
| 1 | Se introduce **`sites`** (lugar) como entidad transversal, con `site_id` **NOT NULL** en los tres módulos. | El control de asentamientos necesita un ancla para agrupar visitas en el tiempo; poligonal y nivelación ganan organización. Se eligió NOT NULL —y no nullable— porque **no hay datos de trabajo que preservar**: lo que existe son generadores (`scripts/seed.mjs`, `crear-proyecto-demo.ts`) que se regeneran. Un `site_id` nullable habría dejado dos caminos vivos en cada consulta para siempre. |
| 2 | Los umbrales son **presets por tipo de estructura**, siempre editables. | Resuelve el hallazgo 4: el default deja de ser un número único y pasa a depender del `structure_type`, que el usuario ya elige. Presets: edificio 25/50/75 mm, presa 10/25/50 mm, terraplén 25/50/75 mm; velocidad 2/5/10 mm/mes en todos (tabla `§4.1`). |
| 3 | **Un mes = 30.4375 días** (`365.25/12`). `V = Δs / (días_entre_visitas / 30.4375)`. | El marco teórico calcula mal la velocidad (hallazgo 2) porque nunca define el mes. Se fija como constante documentada en `tolerances.ts`. Funciona con visitas irregulares —el caso real: el propio documento salta de mensual a trimestral— y no depende del calendario. |
| 4 | **«Visita»** en la UI, no «campaña». `settlement_visits`. | Terminología acordada con el usuario en la sesión de apertura. La tabla se nombra igual que el concepto que expone. |
| 5 | Los tres tipos se presentan como **Poligonales**, **Nivelaciones** y **Control de Asentamientos**, en **sub-tabs** dentro de la tab Procesos del hub. | Terminología acordada. Las sub-tabs evitan que un lugar con 12 visitas inunde el listado y mantienen la vista por tipo. |
| 6 | El **lugar absorbe a `settlement_systems`**: esa tabla no se crea. | `sites` guarda nombre, `structure_type` y los siete umbrales — exactamente lo que tenía `settlement_systems`. Dos entidades para el mismo concepto sobran. **Enmienda el `§3.2`** del PRD principal. |
| 7 | **`settlement_points` gana `northing`/`easting`**; las distancias se derivan por geometría. | La distorsión angular necesita la distancia horizontal entre puntos y el `§3.2` no la modela. El `§3.2` del marco teórico pide justamente «coordenadas (N, E)» en el catálogo. Evita capturar N² distancias a mano y habilita el perfil en planta a futuro. |
| 8 | Análisis: **gráfica temporal + diferenciales con distorsión + indicador de aceleración**. Sin modelos predictivos. | Cubre la `§5.3` completa del PRD principal (que pide explícitamente «tendencia de velocidad creciente»). Los modelos del `§4.3` del marco teórico son geotecnia, no topografía. |
| 9 | El semáforo de 4 niveles se resuelve con un **segundo canal (forma + texto)**, conservando los tokens actuales. | Los tokens cumplen AA; el problema es la separación entre ellos, y está medido que **ningún cuarteto lo resuelve** (hallazgo 5). Añadir forma ataca la causa real y es además la regla que el sistema de diseño ya tiene (`§4.4`: el color nunca es canal único). Cierra la deuda en vez de trasladarla. |
| 10 | El módulo nace con **revalidación de captura en el servidor**, y se hace **retrofit** en poligonal y nivelación. | Cierra la deuda de `docs/tecnica/README.md` `§11`. Lo que bloqueaba el retrofit era qué hacer con procesos históricos que no pasaran la validación actual; **sin historia que preservar, esa pregunta desaparece** y se revalida sin excepciones ni modo compatibilidad. |
| 11 | **KPI del dashboard y conteos por proyecto** pasan a incluir los tres módulos. | Hoy `getDashboardKpis` y `getProcessCountsByProject` solo consultan `polygonal_processes`: nivelación ya es invisible. Sin esto, un proyecto solo de asentamientos mostraría «0 procesos». |
| 12 | Se cierra la **visita**; el **lugar** se cierra al terminar el monitoreo. | El `§3.2` modela `closed_at`/`closed_by` en ambas entidades. La visita es el dato de campo de una fecha y debe congelarse («datos crudos inmutables», `§3.3` del marco teórico); el lugar tiene un estado terminal cuando el monitoreo acaba. |
| 13 | **Migración nueva aditiva**, sin editar las existentes. | La app está desplegada. Una migración aditiva deja local y cloud alineados con `db push`, sin vaciar la base de producción ni perder las cuentas ya registradas. Que no haya datos *de trabajo* valiosos no significa que convenga recrear la nube. |
| 14 | La **visita 0 es la línea base**, sin asentamiento ni velocidad. | El `§3.2` ya lo modela (`campaign_number 0 = línea base`). Su cota es la `initial_elevation` (C0) contra la que se mide todo lo demás. |
| 15 | El editor es **client component** con cálculo en vivo; el servidor **recalcula** al guardar. | Patrón heredado de las Fases 3 y 4: una sola fuente de verdad para lo persistido. |

## Modelo de datos

Migración nueva `<timestamp>_sites_and_settlement.sql`.

### `sites` — el lugar (entidad transversal)

```sql
CREATE TABLE sites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  structure_type TEXT NOT NULL
    CHECK (structure_type IN ('edificio', 'presa', 'terraplen', 'otro')),
  -- Umbrales de alerta (decisión #2: preset por structure_type, editables)
  velocity_caution DECIMAL(6,2) NOT NULL DEFAULT 2.0,     -- mm/mes
  velocity_alert   DECIMAL(6,2) NOT NULL DEFAULT 5.0,
  velocity_alarm   DECIMAL(6,2) NOT NULL DEFAULT 10.0,
  accumulated_caution DECIMAL(8,2) NOT NULL DEFAULT 25.0, -- mm
  accumulated_alert   DECIMAL(8,2) NOT NULL DEFAULT 50.0,
  accumulated_alarm   DECIMAL(8,2) NOT NULL DEFAULT 75.0,
  angular_distortion_limit INT NOT NULL DEFAULT 500,      -- el X de 1/X
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'closed')),
  closed_at TIMESTAMPTZ,
  closed_by TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

Dos divergencias respecto a `settlement_systems` del `§3.2`, además del cambio
de nombre:

- Los **defaults de acumulado son 25/50/75** (edificio), no 10/25/50 (presa).
  Corrige el hallazgo 4. El preset real se aplica al elegir `structure_type`.
- **`angular_distortion_limit` es `INT`, no `TEXT`.** El `§3.2` lo define como
  `TEXT DEFAULT '1/500'`, lo que obligaría a parsear una cadena para cada
  comparación numérica. Se guarda el denominador y se formatea al mostrar.

### Tablas del módulo

```sql
CREATE TABLE settlement_points (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  location_description TEXT NOT NULL,
  northing DECIMAL(12,3),           -- decisión #7
  easting  DECIMAL(12,3),
  initial_elevation DECIMAL(10,4),  -- C0
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (site_id, code)
);

CREATE TABLE settlement_visits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  visit_number INT NOT NULL,        -- 0 = línea base (decisión #14)
  date DATE NOT NULL,
  operator TEXT,
  equipment TEXT,
  weather_conditions TEXT,
  closure_error_mm DECIMAL(8,1),
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'calculated', 'closed')),
  closed_at TIMESTAMPTZ,
  closed_by TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (site_id, visit_number)
);

CREATE TABLE settlement_readings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visit_id UUID NOT NULL REFERENCES settlement_visits(id) ON DELETE CASCADE,
  point_id UUID NOT NULL REFERENCES settlement_points(id) ON DELETE CASCADE,
  elevation DECIMAL(10,4) NOT NULL,
  -- Calculados, persistidos (los informes de Fase 6 leen sin recalcular)
  partial_settlement DECIMAL(8,1),
  accumulated_settlement DECIMAL(8,1),
  velocity DECIMAL(8,2),
  alert_status TEXT NOT NULL DEFAULT 'normal'
    CHECK (alert_status IN ('normal', 'caution', 'alert', 'alarm')),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (visit_id, point_id)
);
```

Los `UNIQUE` no están en el `§3.2` y se añaden porque las tres restricciones
representan reglas del dominio: un código de punto no se repite en un lugar, no
hay dos visitas con el mismo número, y un punto tiene una sola lectura por
visita. Sin ellas, un doble envío del formulario duplica lecturas y **el
asentamiento parcial se calcula contra la fila equivocada** — un fallo
silencioso y plausible, del tipo que la Fase 4 enseñó a anticipar.

### `site_id` en los módulos existentes

```sql
ALTER TABLE polygonal_processes ADD COLUMN site_id UUID REFERENCES sites(id);
ALTER TABLE leveling_processes  ADD COLUMN site_id UUID REFERENCES sites(id);
-- backfill: un lugar «General» por proyecto que tenga procesos
-- luego: SET NOT NULL
```

La migración crea un lugar `General` en cada proyecto con procesos, asigna sus
filas y solo entonces impone `NOT NULL`. Así la migración es segura tanto en
local como en la nube desplegada, sin vaciar nada (decisión #13).

**RLS:** todas las tablas nuevas por join hasta `projects`, siguiendo el patrón
de `polygonal_processes` y `leveling_processes`.

**Inmutabilidad:** el trigger de cabecera reutiliza
`public.reject_update_on_closed_process()`, que es genérica (solo mira
`old.status`), sobre `settlement_visits` y `sites`. **Pero la función de las
filas hijas no es reutilizable:**
`public.reject_write_on_closed_process_station()` consulta
`public.polygonal_processes` por nombre, así que `settlement_readings` necesita
su propia función análoga que consulte `settlement_visits`. Nivelación ya tuvo
que hacer lo mismo.

Además, `settlement_visits.status` no incluye `rejected` (una visita se cierra o
no; no hay tolerancia que rechazar), de modo que la condición del trigger es
`old.status = 'closed'` y no `in ('closed','rejected')`. Reutilizar la función
genérica tal cual **funciona igualmente** —`'closed'` está en el conjunto— pero
la de las filas hijas hay que escribirla.

Tras aplicar la migración se regeneran los tipos (`database.ts`).

## Algoritmos (`src/lib/calculations/settlement.ts`)

Funciones puras de TypeScript — sin React, sin Supabase.

### Constantes (en `tolerances.ts`)

```
DAYS_PER_MONTH = 30.4375                  // 365.25/12 — decisión #3
SETTLEMENT_THRESHOLD_PRESETS = {
  edificio:  { vel: [2, 5, 10], acum: [25, 50, 75], distorsion: 500 },
  presa:     { vel: [2, 5, 10], acum: [10, 25, 50], distorsion: 500 },
  terraplen: { vel: [2, 5, 10], acum: [25, 50, 75], distorsion: 500 },
  otro:      { vel: [2, 5, 10], acum: [25, 50, 75], distorsion: 500 },
}
```

### Asentamientos (`§6.10` — verificado, hallazgo 1)

```
Δs_parcial   = (cota_visita_n − cota_visita_{n−1}) × 1000   [mm]
Δs_acumulado = (cota_visita_n − C0) × 1000                  [mm]
```

Signo negativo = descenso (asentamiento), que es el caso normal. Un valor
positivo es levantamiento y **debe mostrarse como tal**, no como valor absoluto:
un levantamiento inesperado es un hallazgo geotécnico, no ruido.

### Velocidad (decisión #3 — corrige el hallazgo 2)

```
Δt_meses = (fecha_n − fecha_{n−1}) en días / 30.4375
V        = Δs_parcial / Δt_meses                            [mm/mes]
```

Si `Δt_meses` es 0 (dos visitas el mismo día), la velocidad es `null`, **nunca
`Infinity` ni `NaN`**. El aprendizaje de la Fase 4 incluye un caso de «NaN mm»
mostrado al usuario en un proceso recién creado; aquí se previene por contrato.

### Diferenciales y distorsión angular (`§6.10` — verificado, hallazgo 1)

```
Δs_diferencial = |Δs_acum_i − Δs_acum_j|                    [mm]
L              = √((N_i−N_j)² + (E_i−E_j)²)                 [m]
β_inverso      = (L × 1000) / Δs_diferencial
                 → se muestra como 1/β_inverso
```

Si `Δs_diferencial` es 0, la distorsión es infinita (β_inverso = ∞): dos puntos
que se asientan igual no tienen distorsión entre sí. Se representa como `1/∞` y
**cuenta como normal**, no como el peor caso.

Un par sin coordenadas en alguno de sus puntos **queda fuera de la tabla de
diferenciales** y se informa como tal, en vez de calcularse con L = 0 (que daría
distorsión infinita y aparentaría normalidad).

### Aceleración (`§5.3`)

Compara la velocidad de la visita actual con la anterior, en valor absoluto:

- `|V_n| > |V_{n−1}|` → tendencia creciente → indicador de advertencia.
- `|V_n| ≤ |V_{n−1}|` → convergente, comportamiento esperado.

Requiere al menos tres visitas (dos velocidades). Con menos, el indicador no se
muestra — no se muestra «normal», que afirmaría algo no verificado.

### Clasificación de alertas (`§6.11`)

Se implementa **tal como está en el `§6.11`**: la peor clasificación entre
velocidad y acumulado gana. Los estados del marco teórico **no se usan como
fixture** (hallazgo 3).

### Tests (Vitest)

Fixtures construidos y verificados a mano, nunca copiados del marco teórico. Se
cubre:

- Parcial y acumulado, incluida la visita 0 (sin parcial ni velocidad).
- **Velocidad con intervalos de 28, 30, 31, 61 y 92 días** — el caso exacto que
  el marco teórico calcula mal.
- Velocidad con `Δt = 0` → `null`, no `Infinity`.
- Levantamiento (signo positivo) tratado como tal.
- Distorsión angular con diferencial 0 → `1/∞` clasificado normal.
- Par con coordenadas ausentes → excluido, no calculado como 0.
- Aceleración creciente y decreciente; menos de 3 visitas → sin indicador.
- `classifyAlert` en las 4 fronteras exactas de cada umbral (`>=`, no `>`), y el
  caso de que velocidad y acumulado discrepen (gana el peor).
- **Visitas fuera de orden cronológico**: el cálculo ordena por fecha, no por
  `visit_number`, y hay un test que lo fija.

## Validación (`src/lib/validators/settlement.ts`)

- **Capa captura** (`§5.1`): cota fuera de un rango plausible respecto a C0 →
  error; cota vacía → error; fecha de visita anterior a la visita previa →
  error; punto sin C0 → error al calcular.
- **Capa cierre** (`§5.2`): visita con lecturas incompletas → bloquea el cierre;
  error de cierre de la nivelación asociada fuera de tolerancia → advertencia.
- **Capa estadística** (`§5.3`): velocidad y acumulado sobre umbral → semáforo
  en el nivel correspondiente; distorsión angular sobre el límite → alerta en la
  tabla de diferenciales; tendencia creciente → indicador de advertencia.

**La capa estadística no bloquea nada.** Un asentamiento en alarma es un
hallazgo del monitoreo, no un error de captura: el dato es válido y debe
registrarse y cerrarse con normalidad. Confundir «dato alarmante» con «dato
inválido» impediría documentar justamente el caso que el módulo existe para
detectar.

## Rutas y capa de datos

| Ruta | Comportamiento |
|---|---|
| `/projects/[id]/sites/new` | Alta de lugar: nombre, descripción, tipo de estructura (aplica el preset de umbrales), umbrales editables. |
| `/projects/[id]/sites/[siteId]` | Editor del lugar: catálogo de puntos (código, ubicación, N/E, C0), umbrales, cierre del lugar. |
| `/projects/[id]/settlement/[siteId]` | Panel del control de asentamientos: lista cronológica de visitas, análisis (gráfica, diferenciales, semáforo por punto). |
| `/projects/[id]/settlement/[siteId]/visits/[visitId]` | Editor de visita: tabla de lecturas con cálculo en vivo, cierre de visita. |

- **Queries**: `getSites(projectId)`, `getSite(siteId)` con sus puntos,
  `getVisits(siteId)`, `getVisit(visitId)` con sus lecturas, y
  `getSettlementHistory(siteId)` — la serie completa que alimenta gráfica y
  tendencias.
- **Server Actions**: `createSiteAction`, `saveSiteAction`, `closeSiteAction`,
  `createVisitAction`, `saveVisitAction`, `closeVisitAction`. Todas
  **revalidan la captura en el servidor** (decisión #10) y **recalculan** con
  las funciones puras antes de persistir. Toda mutación verifica que la entidad
  no esté cerrada.

## Componentes

- **Feature** (`src/components/settlement/`): `site-form`, `points-catalog`,
  `thresholds-fields`, `visits-list`, `visit-editor` (client, orquestador),
  `readings-table`, `settlement-chart` (SVG propio), `differentials-table`,
  `analysis-panel`, `close-visit-dialog`.
- **Design system**: `StatusIndicator` pasa de 3 a 4 niveles y gana **forma
  además de color** (decisión #9); se declaran sus parejas nuevas en
  `pairings.ts` para que `/design-system` las mida.
- **Hub**: sub-tabs por tipo (decisión #5) y activación de «Control de
  Asentamientos» en `new-process-selector`.

### Sobre la gráfica

SVG propio, sin librería, coherente con la regla de no usar librerías de
componentes. Debe ser legible sin color (los puntos se distinguen por marcador,
no solo por tono) y llevar tabla de datos accesible como alternativa textual.

## Criterios de aceptación

| # | Check |
|---|---|
| a | `npm run typecheck`, `lint`, `build`, `test` — exit 0 |
| b | Tests de cálculo: velocidad con intervalos de 28/30/31/61/92 días; `Δt=0` → `null`; levantamiento; distorsión con diferencial 0; par sin coordenadas; aceleración; fronteras de `classifyAlert`; visitas fuera de orden |
| c | La migración aplica limpia sobre la base desplegada y sobre `db reset`, y deja `site_id` NOT NULL en los tres módulos |
| d | «+ Nuevo Proceso» ofrece «Control de Asentamientos» y lleva al alta de lugar |
| e | Elegir el tipo de estructura aplica su preset de umbrales, y siguen siendo editables |
| f | La visita 0 se marca como línea base y no muestra asentamiento ni velocidad |
| g | El editor de visita calcula parcial, acumulado, velocidad y semáforo **en vivo** |
| h | La tabla de diferenciales muestra la distorsión como `1/X` y marca las que superan el límite |
| i | La gráfica dibuja la serie de varios puntos y es legible sin color |
| j | El indicador de aceleración aparece solo con 3+ visitas |
| k | Cerrar una visita registra `closed_at`/`closed_by` y la deja en solo lectura |
| l | Cerrar el lugar lo deja en solo lectura, incluidas sus visitas |
| m | Un dato en alarma **no impide** guardar ni cerrar (la capa estadística no bloquea) |
| n | La tab Procesos muestra los tres tipos en sub-tabs con la terminología acordada |
| o | Los KPI del dashboard y el conteo por proyecto incluyen los tres módulos |
| p | **Revalidación en servidor**: una llamada directa a `saveVisitAction` con lecturas inválidas es rechazada |
| q | **Retrofit**: lo mismo para `savePolygonalProcessAction` y `saveLevelingProcessAction` |
| r | `StatusIndicator` distingue los 4 niveles **sin depender del color** (forma + texto), y `/design-system` mide las parejas nuevas sin fallos |
| s | RLS: un usuario no accede a lugares ni visitas de proyectos ajenos (404) |
| t | Una visita `closed` rechaza la mutación **también vía API REST directa** (trigger de base) |
| u | El seed genera el lugar de monitoreo con su serie temporal y la app lo muestra completo |

## Riesgos conocidos

- **El marco teórico falla por tercera vez, y ahora en el cálculo.** Velocidades
  y estados de alerta son incorrectos (hallazgos 2 y 3). Ningún número del
  documento entra en un test.
- **Esta fase es más grande que la Fase 4.** Entidad transversal nueva, cuatro
  tablas, cambio de terminología en el hub, gráfica, y dos deudas transversales
  cerradas. Es el riesgo principal de planificación y se asume conscientemente;
  si durante la ejecución el alcance se revela inviable, lo que se difiere
  primero es la gráfica (criterio `i`), no la revalidación en servidor.
- **`site_id` NOT NULL toca dos tablas desplegadas.** El backfill con el lugar
  `General` debe ejecutarse y verificarse antes del `SET NOT NULL`, en local y
  en la nube.
- **Los fallos de este dominio son silenciosos y plausibles** (aprendizaje de la
  Fase 4). Aquí el riesgo se concentra en la velocidad —que depende de fechas—
  y en el emparejamiento visita-anterior. Toda verificación se hace **contra la
  base de datos**, no contra la interfaz.
- **El semáforo no se arregla con colores** (hallazgo 5). Si la implementación
  del segundo canal se complica, la salida **no** es volver a probar cuartetos.
- **Cuatro niveles de alerta contra tres estados existentes.** `StatusIndicator`
  se usa hoy en `leveling/results-panel.tsx` y en la página `/design-system`;
  ampliarlo a 4 no debe cambiar cómo se ve nivelación.

## Tareas (en orden)

0. Apertura: este PRD, enmienda del `§3.2` del PRD principal (elimina
   `settlement_systems`, renombra campañas → visitas, corrige defaults de
   umbrales y el tipo de `angular_distortion_limit`), estado `en curso` en
   `method.md` y `prds/README.md`, commit `docs:`.
1. Migración: `sites`, `settlement_points`, `settlement_visits`,
   `settlement_readings`, `site_id` + backfill + `NOT NULL`, RLS, triggers.
   Aplicar y regenerar tipos.
2. `src/types/site.ts` y `src/types/settlement.ts`.
3. Presets de umbrales y `DAYS_PER_MONTH` en `tolerances.ts` + tests.
4. `calculations/settlement.ts`: parcial, acumulado, velocidad + tests.
5. `calculations/settlement.ts`: diferenciales, distorsión angular + tests.
6. `calculations/settlement.ts`: aceleración y `classifyAlert` + tests.
7. `validators/settlement.ts` + tests.
8. `StatusIndicator` a 4 niveles con segundo canal; parejas en `pairings.ts`.
9. Queries y Server Actions con revalidación en servidor.
10. Rutas de lugar: alta, editor, catálogo de puntos, umbrales.
11. Editor de visita: tabla de lecturas con cálculo en vivo.
12. Panel de análisis: diferenciales y semáforo por punto.
13. `settlement-chart` (SVG) y indicador de tendencia.
14. Cierre de visita y de lugar; modo solo lectura.
15. Hub: sub-tabs por tipo y terminología; activar «Control de Asentamientos».
16. **Deuda:** retrofit de revalidación en poligonal y nivelación.
17. **Deuda:** KPI y conteos por proyecto con los tres módulos.
18. Seed: lugares y lugar de monitoreo con serie temporal.
19. Verificación end-to-end (criterios a–u). Documentación de handoff. Cierre.

## Anti-alcance explícito

No se implementa: modelos de predicción (Asaoka, hiperbólico, Terzaghi);
correlación con nivel de embalse o piezometría; gráfica de perfil en planta;
fotografías de puntos; registro de equipos con certificados; informes;
exportación a Excel; auto-save. No se crean tablas SQL fuera de las cuatro
descritas. No se refactoriza código de fases anteriores salvo lo necesario para
las tareas 15, 16 y 17, que son alcance explícito de esta fase.
