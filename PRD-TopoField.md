# PRD — TopoField
## Plataforma Web para Gestión Integral de Procesos Topográficos

**Versión:** 1.0  
**Fecha:** Febrero 2026  
**Autor:** María Camila Vélez  
**Proyecto:** Monografía — Ingeniería Topográfica — Universidad Distrital Francisco José de Caldas

---

## 1. Visión y Alcance

### 1.1 Qué es TopoField

TopoField es una plataforma web que permite al topógrafo gestionar desde un solo lugar los tres procesos que más realiza en su trabajo diario:

- **Levantamiento de poligonales** (cerradas, abiertas con control, abiertas sin control)
- **Nivelación de precisión** (circuitos cerrados, de enlace, abiertos)
- **Control de asentamientos** (monitoreo periódico con campañas y alertas)

Todo se organiza bajo un sistema de **proyectos** que comparten puntos de referencia, configuración de equipo y parámetros de precisión. Cada proceso se puede validar, calcular, cerrar (bloquear) y exportar como informe.

### 1.2 Problema que resuelve

Hoy el topógrafo trabaja con libretas de papel, Excel y software desconectado. Esto genera:
- Errores de transcripción que se descubren tarde
- Cálculos sin validación automática
- Archivos sin control de versiones ni bloqueo
- Informes compilados manualmente
- Trazabilidad difícil de demostrar

### 1.3 Qué NO es (límites del prototipo)

- **No** es un software de topografía completo (no incluye replanteo, secciones transversales, volúmenes, GPS diferencial)
- **No** incluye importación directa desde estación total (solo ingreso manual o CSV)
- **No** implementa ajuste por mínimos cuadrados (queda como trabajo futuro)
- **No** incluye firma digital criptográfica — solo cierre y bloqueo con registro de responsable y timestamp
- **No** tiene múltiples roles de usuario — un solo rol (topógrafo) que hace todo
- **No** incluye modo offline / PWA — queda como trabajo futuro
- **No** implementa visualización geoespacial en mapa

---

## 2. Stack Tecnológico

| Herramienta | Rol | Referencia |
|---|---|---|
| **Next.js 14+** (App Router) | Framework web, React + TypeScript | nextjs.org/docs |
| **Supabase** | Base de datos PostgreSQL, autenticación, storage | supabase.com/docs |
| **Tailwind CSS** | Estilos utilitarios | tailwindcss.com |
| **Sistema de diseño propio** | Componentes UI personalizados sobre Tailwind | Documentado en `/src/components/design-system/` |
| **Claude Code** | Desarrollo asistido por IA | docs.anthropic.com |
| **Vercel** | Despliegue | vercel.com |

> **Nota sobre autenticación:** Supabase maneja toda la autenticación (email + password, magic link, y opcionalmente OAuth con Google). No se usa un servicio externo como Clerk.

> **Nota sobre sistema de diseño:** En lugar de usar una librería de componentes como shadcn/ui, se construye un sistema de diseño propio sobre Tailwind CSS. Esto permite personalización total de la identidad visual de TopoField y evita dependencias externas en la capa de UI.

### 2.1 Estructura de carpetas (referencia)

```
topofield/
├── src/
│   ├── app/                    # App Router pages
│   │   ├── (auth)/             # Login, registro (Supabase Auth)
│   │   ├── dashboard/          # Dashboard principal
│   │   ├── projects/
│   │   │   ├── [id]/           # Vista de proyecto
│   │   │   │   ├── polygonal/[pid]/   # Editor poligonal
│   │   │   │   ├── leveling/[pid]/    # Editor nivelación
│   │   │   │   ├── settlement/[pid]/  # Editor asentamiento
│   │   │   │   └── reports/           # Generador informes
│   │   │   └── new/            # Crear proyecto
│   │   └── settings/           # Configuración
│   ├── components/
│   │   ├── design-system/      # Sistema de diseño propio (botones, inputs, cards, modals, badges, tables)
│   │   ├── editors/            # Componentes de los 3 editores
│   │   ├── tables/             # Tablas de datos editables
│   │   └── charts/             # Gráficas de asentamiento
│   ├── lib/
│   │   ├── calculations/       # Algoritmos topográficos
│   │   │   ├── polygonal.ts    # Bowditch, Tránsito, Crandall
│   │   │   ├── leveling.ts     # Nivelación y correcciones
│   │   │   ├── settlement.ts   # Asentamientos y alertas
│   │   │   └── angles.ts       # Utilidades de ángulos (DMS ↔ decimal)
│   │   ├── validators/         # Reglas de validación
│   │   ├── supabase/           # Cliente y queries
│   │   └── reports/            # Generación de PDF/Excel
│   └── types/                  # TypeScript types/interfaces
├── supabase/
│   └── migrations/             # SQL migrations
├── middleware.ts                # Supabase Auth middleware (protección de rutas)
└── public/
```

### 2.2 Sistema de Diseño Propio

Se construye un sistema de componentes reutilizables sobre Tailwind CSS, organizados en `/src/components/design-system/`. El objetivo es tener identidad visual propia sin depender de librerías externas.

**Componentes base a construir:**

| Componente | Archivo | Descripción |
|---|---|---|
| `Button` | `button.tsx` | Variantes: primary, secondary, danger, ghost. Tamaños: sm, md, lg |
| `Input` | `input.tsx` | Campos de texto, numérico, con label, error, helper text |
| `DmsInput` | `dms-input.tsx` | Input especializado para ángulos (3 campos: °, ', ") |
| `Select` | `select.tsx` | Dropdown con opciones |
| `Card` | `card.tsx` | Contenedor con título, cuerpo y acciones |
| `Badge` | `badge.tsx` | Estados: draft, in_progress, calculated, closed, rejected |
| `Alert` | `alert.tsx` | Variantes: info, success, warning, error |
| `Modal` | `modal.tsx` | Diálogo con overlay, título, contenido, acciones |
| `Table` | `table.tsx` | Tabla con header fijo, filas alternadas, celdas editables |
| `EditableCell` | `editable-cell.tsx` | Celda de tabla que se vuelve input al hacer clic |
| `Tabs` | `tabs.tsx` | Navegación por tabs |
| `StatusIndicator` | `status-indicator.tsx` | Semáforo: verde, amarillo, naranja, rojo |
| `KpiCard` | `kpi-card.tsx` | Tarjeta de indicador para dashboard |
| `Wizard` | `wizard.tsx` | Componente de pasos para formularios multi-step |
| `Toast` | `toast.tsx` | Notificación temporal (auto-save, éxito, error) |

**Tokens de diseño (definidos en `src/app/globals.css` con `@theme` — sintaxis Tailwind 4):**

```css
@import "tailwindcss";

@theme {
  /* Colores de marca TopoField */
  --color-primary-50:  #E8F4FA;
  --color-primary-100: #C5E4F3;
  --color-primary-200: #9DD1EB;
  --color-primary-500: #1A7FB5;
  --color-primary-600: #0B3D5C;
  --color-primary-700: #082D44;

  --color-success-500: #27AE60;
  --color-warning-500: #F39C12;
  --color-danger-500:  #E74C3C;

  --color-neutral-50:  #F8F9FA;
  --color-neutral-100: #F2F3F4;
  --color-neutral-200: #D5D8DC;
  --color-neutral-500: #5D6D7E;
  --color-neutral-800: #2C3E50;
  --color-neutral-900: #1A252F;

  /* Semáforo de asentamientos */
  --color-semaphore-green:  #27AE60;
  --color-semaphore-yellow: #F1C40F;
  --color-semaphore-orange: #E67E22;
  --color-semaphore-red:    #E74C3C;
}
```

> **Nota sobre Tailwind 4:** desde la versión 4, Tailwind elimina `tailwind.config.ts` y los tokens viven directamente en CSS dentro del bloque `@theme`. Los nombres de las variables (`--color-primary-500`) generan automáticamente las clases utilitarias (`bg-primary-500`, `text-primary-500`, etc.).

---

## 3. Modelo de Datos

### 3.1 Diagrama de Entidades

```
User (Supabase Auth)
  └── Profile (nombre, empresa, cargo)
       └── Project
       ├── Equipment (config del equipo)
       ├── ReferencePoint (BMs y puntos compartidos)
       ├── Site (lugar donde se ejecuta el trabajo)
       │    ├── PolygonalProcess
       │    │    ├── PolygonalStation (lecturas)
       │    │    └── PolygonalResult (coordenadas corregidas)
       │    ├── LevelingProcess
       │    │    ├── LevelingReading (lecturas)
       │    │    └── LevelingResult (cotas corregidas)
       │    ├── SettlementPoint (catálogo de puntos de control)
       │    └── SettlementVisit
       │         └── SettlementReading (lecturas por visita)
       ├── Report (informes generados)
       └── Recipient (destinatarios de informes)
```

**Enmendado en la Fase 5 (2026-08-25).** El `Site` (lugar) se introdujo como
entidad transversal: todo proceso pertenece a un lugar. En el control de
asentamientos el lugar es además lo que agrupa las visitas y hace posible el
histórico. `SettlementSystem` desapareció —el lugar lo absorbe— y
`SettlementCampaign` pasó a llamarse `SettlementVisit`. `SettlementAlert` no
llegó a existir: las alertas se derivan de los umbrales del lugar en cada
lectura (`alert_status`), no se almacenan como entidad aparte. Ver
`docs/prds/04-asentamientos.md`, decisiones #1, #4 y #6.

### 3.2 Tablas SQL (Supabase / PostgreSQL)

#### `profiles` (extiende Supabase Auth)
```sql
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  -- full_name es derivada: siempre sincronizada con first_name + last_name
  full_name TEXT GENERATED ALWAYS AS (first_name || ' ' || last_name) STORED,
  company TEXT,
  position TEXT,
  professional_license TEXT,                -- matrícula profesional
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Trigger: crear perfil automáticamente al registrarse
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, first_name, last_name)
  VALUES (
    new.id,
    new.raw_user_meta_data->>'first_name',
    new.raw_user_meta_data->>'last_name'
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
```

#### `projects`
```sql
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),  -- Supabase Auth user ID
  name TEXT NOT NULL,
  description TEXT,
  client TEXT NOT NULL,
  location TEXT NOT NULL,
  latitude DECIMAL(10,7),
  longitude DECIMAL(10,7),
  datum TEXT NOT NULL DEFAULT 'MAGNA-SIRGAS',
  projection TEXT,
  precision_order TEXT NOT NULL CHECK (precision_order IN ('primer_orden', 'segundo_orden', 'tercer_orden', 'ordinario')),
  equipment_brand TEXT NOT NULL,
  equipment_model TEXT NOT NULL,
  equipment_serial TEXT NOT NULL,
  angular_precision_seconds DECIMAL(5,1) NOT NULL,
  linear_precision TEXT NOT NULL,           -- ej: "2+2ppm"
  equipment_calibration_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

#### `reference_points`
```sql
CREATE TABLE reference_points (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  code TEXT NOT NULL,                       -- ej: "BM-01", "GPS-1"
  type TEXT NOT NULL CHECK (type IN ('bm', 'control', 'gps', 'detail')),
  north DECIMAL(12,4),
  east DECIMAL(12,4),
  elevation DECIMAL(10,4),
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

#### `polygonal_processes`
```sql
CREATE TABLE polygonal_processes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('closed', 'open_controlled', 'open_uncontrolled')),
  -- Punto de partida
  start_point_code TEXT NOT NULL,
  start_north DECIMAL(12,4) NOT NULL,
  start_east DECIMAL(12,4) NOT NULL,
  start_azimuth_deg INT,
  start_azimuth_min INT,
  start_azimuth_sec DECIMAL(5,1),
  -- Punto de llegada (solo open_controlled)
  end_point_code TEXT,
  end_north DECIMAL(12,4),
  end_east DECIMAL(12,4),
  end_azimuth_deg INT,
  end_azimuth_min INT,
  end_azimuth_sec DECIMAL(5,1),
  -- Config
  angle_type TEXT NOT NULL DEFAULT 'internal' CHECK (angle_type IN ('internal', 'deflection', 'azimuth')),
  correction_method TEXT CHECK (correction_method IN ('bowditch', 'transit', 'crandall')),
  -- Resultados de cierre
  angular_error_seconds DECIMAL(10,1),
  linear_error DECIMAL(10,4),
  perimeter DECIMAL(12,4),
  relative_precision TEXT,                  -- ej: "1:5,234"
  meets_tolerance BOOLEAN,
  -- Estado
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'in_progress', 'calculated', 'closed', 'rejected')),
  closed_at TIMESTAMPTZ,
  closed_by TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

#### `polygonal_stations`
```sql
CREATE TABLE polygonal_stations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  process_id UUID REFERENCES polygonal_processes(id) ON DELETE CASCADE,
  station_order INT NOT NULL,
  point_code TEXT NOT NULL,
  -- Ángulo medido (grados, minutos, segundos)
  angle_deg INT,
  angle_min INT,
  angle_sec DECIMAL(5,1),
  -- Deflexión (si aplica)
  deflection_direction TEXT CHECK (deflection_direction IN ('right', 'left')),
  -- Distancia horizontal
  horizontal_distance DECIMAL(10,4),
  -- Campos calculados
  corrected_angle_deg INT,
  corrected_angle_min INT,
  corrected_angle_sec DECIMAL(5,1),
  azimuth_deg INT,
  azimuth_min INT,
  azimuth_sec DECIMAL(5,1),
  delta_north DECIMAL(12,4),
  delta_east DECIMAL(12,4),
  corrected_delta_north DECIMAL(12,4),
  corrected_delta_east DECIMAL(12,4),
  north DECIMAL(12,4),
  east DECIMAL(12,4),
  -- Validación
  has_warnings BOOLEAN DEFAULT false,
  warning_messages JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

#### `leveling_processes`
```sql
CREATE TABLE leveling_processes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('closed', 'link', 'open')),
  -- BM de partida
  start_bm_code TEXT NOT NULL,
  start_bm_elevation DECIMAL(10,4) NOT NULL,
  -- BM de llegada (solo link)
  end_bm_code TEXT,
  end_bm_elevation DECIMAL(10,4),
  -- Config
  has_return_run BOOLEAN DEFAULT false,     -- ida y vuelta
  total_distance_km DECIMAL(8,3),
  correction_method TEXT DEFAULT 'proportional_distance',
  -- Resultados de cierre
  closure_error_mm DECIMAL(8,1),
  tolerance_mm DECIMAL(8,1),
  meets_tolerance BOOLEAN,
  -- Si ida y vuelta
  forward_error_mm DECIMAL(8,1),
  return_error_mm DECIMAL(8,1),
  discrepancy_mm DECIMAL(8,1),
  -- Estado
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'in_progress', 'calculated', 'closed', 'rejected')),
  closed_at TIMESTAMPTZ,
  closed_by TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

#### `leveling_readings`
```sql
CREATE TABLE leveling_readings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  process_id UUID REFERENCES leveling_processes(id) ON DELETE CASCADE,
  run_type TEXT NOT NULL DEFAULT 'forward' CHECK (run_type IN ('forward', 'return')),
  reading_order INT NOT NULL,
  point_code TEXT NOT NULL,
  -- Añadido en Fase 4: los puntos intermedios (radiaciones) solo reciben
  -- lectura adelante, cuelgan de la AI vigente, no propagan cota y quedan
  -- fuera de la comprobación aritmética y de la compensación.
  point_type TEXT NOT NULL DEFAULT 'pc'
    CHECK (point_type IN ('bm', 'pc', 'intermediate')),
  backsight DECIMAL(6,4),                   -- lectura atrás
  foresight DECIMAL(6,4),                   -- lectura adelante
  distance_m DECIMAL(8,1),                  -- distancia de la visual (dato de campo; el equilibrado atrás/adelante NO se valida en esta fase, ver deuda técnica)
  distance_accumulated_km DECIMAL(8,3),
  -- Calculados
  instrument_height DECIMAL(10,4),          -- AI
  elevation_calculated DECIMAL(10,4),       -- cota calculada
  elevation_corrected DECIMAL(10,4),        -- cota corregida
  correction_applied DECIMAL(8,4),
  -- Validación
  has_warnings BOOLEAN DEFAULT false,
  warning_messages JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

#### `sites`

**Añadida en la Fase 5.** El lugar donde se ejecuta el trabajo, transversal a
los tres módulos. Absorbe lo que este PRD llamaba `settlement_systems`, que ya
no existe: eran dos entidades para el mismo concepto.

```sql
CREATE TABLE sites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  structure_type TEXT NOT NULL
    CHECK (structure_type IN ('edificio', 'presa', 'terraplen', 'otro')),
  -- Umbrales de alerta (preset por structure_type, siempre editables)
  velocity_caution DECIMAL(6,2) NOT NULL DEFAULT 2.0,     -- mm/mes
  velocity_alert   DECIMAL(6,2) NOT NULL DEFAULT 5.0,
  velocity_alarm   DECIMAL(6,2) NOT NULL DEFAULT 10.0,
  accumulated_caution DECIMAL(8,2) NOT NULL DEFAULT 25.0, -- mm
  accumulated_alert   DECIMAL(8,2) NOT NULL DEFAULT 50.0,
  accumulated_alarm   DECIMAL(8,2) NOT NULL DEFAULT 75.0,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'closed')),
  closed_at TIMESTAMPTZ,
  closed_by TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

Dos correcciones respecto a lo que definía `settlement_systems`:

- **Los defaults de acumulado eran los de presa (10/25/50), no los de edificio.**
  Contradecían la tabla de umbrales del marco teórico (`§4.1`), donde el edificio
  es 25/50/75. Un sistema creado con los defaults clasificaba un edificio con
  criterio de presa. Ahora el default es el de edificio y el preset real lo fija
  el `structure_type`.
- **`angular_distortion_limit` era `INT`, no `TEXT`.** Guardarlo como `'1/500'`
  obligaba a parsear una cadena en cada comparación numérica. La Fase 29 quitó
  la columna: los puntos de control no tienen posición (ver
  `settlement_points`).

#### `settlement_points`
```sql
CREATE TABLE settlement_points (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  location_description TEXT NOT NULL,       -- ej: "Columna A1 — Esquina NW"
  initial_elevation DECIMAL(10,4),          -- C0
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (site_id, code)
);
```

**Quitado en la Fase 29.** `northing`/`easting` se añadieron en la Fase 5 para la
distorsión angular del `§6.10`, que necesita la distancia horizontal entre
puntos. El usuario decidió que los puntos de control no tienen posición: sin
coordenadas no hay distancia, ni asentamientos diferenciales, ni distorsión
angular. La migración borró las dos columnas.

#### `settlement_visits`

**Renombrada en la Fase 5** (antes `settlement_campaigns`): en la interfaz el
concepto se llama «visita».

```sql
CREATE TABLE settlement_visits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  visit_number INT NOT NULL,                -- 0 = línea base
  date DATE NOT NULL,
  operator TEXT,
  equipment TEXT,
  weather_conditions TEXT,
  closure_error_mm DECIMAL(8,1),
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'calculated', 'closed')),
  closed_at TIMESTAMPTZ,
  closed_by TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (site_id, visit_number)
);
```

#### `settlement_readings`
```sql
CREATE TABLE settlement_readings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visit_id UUID NOT NULL REFERENCES settlement_visits(id) ON DELETE CASCADE,
  point_id UUID NOT NULL REFERENCES settlement_points(id) ON DELETE CASCADE,
  elevation DECIMAL(10,4) NOT NULL,
  -- Calculados
  partial_settlement DECIMAL(8,1),          -- mm, vs visita anterior
  accumulated_settlement DECIMAL(8,1),      -- mm, vs C0
  velocity DECIMAL(8,2),                    -- mm/mes
  alert_status TEXT NOT NULL DEFAULT 'normal' CHECK (alert_status IN ('normal', 'caution', 'alert', 'alarm')),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (visit_id, point_id)
);
```

Los tres `UNIQUE` se añadieron en la Fase 5 porque expresan reglas del dominio:
un código de punto no se repite en un lugar, no hay dos visitas con el mismo
número, y un punto tiene una sola lectura por visita. Sin ellos, un doble envío
del formulario duplica lecturas y el asentamiento parcial se calcula contra la
fila equivocada — un fallo silencioso.

**`polygonal_processes` y `leveling_processes` ganaron `site_id UUID NOT NULL
REFERENCES sites(id)`** en la misma fase: todo proceso pertenece a un lugar.

**Fase 18 — libreta de la visita** (`docs/prds/17-libreta-panel-asentamientos.md`).
`settlement_visits` gana el modo de captura y el BM de amarre, y el cierre deja
de teclearse cuando hay libreta:

```sql
ALTER TABLE settlement_visits
  ADD COLUMN capture_mode TEXT NOT NULL DEFAULT 'direct'
    CHECK (capture_mode IN ('book', 'direct')),   -- libreta o cotas tecleadas
  ADD COLUMN reference_bm_code TEXT,               -- copia del BM de amarre
  ADD COLUMN reference_bm_elevation DECIMAL(10,4),
  ADD COLUMN total_distance_km DECIMAL(8,3),       -- derivados en 'book'
  ADD COLUMN tolerance_mm DECIMAL(8,1),
  ADD COLUMN meets_tolerance BOOLEAN;
-- closure_error_mm: derivado en 'book', tecleado en 'direct'.
```

La libreta vive en `settlement_book_readings`, espejo de `leveling_readings` sin
`run_type` y con `point_id` al punto de control. En modo `book`,
`settlement_readings.elevation` se **deriva** de la libreta (cota compensada de
la fila del punto) y la escribe el servidor.

**Añadido en la Fase 30.** `settlement_book_readings.catalog_elevation
DECIMAL(10,4)`: en la fila de otro BM del catálogo por el que pasa el circuito,
la cota que ese BM tenía en el catálogo al guardar la visita. Con ella se
comprueba que el BM de control nivela con el amarre (§ 5.3), y una visita
cerrada la conserva aunque después se corrija el catálogo, como conserva la del
amarre.

#### `reports`
```sql
CREATE TABLE reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  included_processes JSONB NOT NULL,        -- [{type, id, name, order}]
  observations TEXT,
  generated_at TIMESTAMPTZ DEFAULT now(),
  generated_by TEXT NOT NULL
);
```

**Enmendada en la Fase 6 (2026-08-25).** Tres cambios respecto a la definición
original:

- **`file_url` se elimina.** El informe no se almacena como archivo: se produce
  con una ruta imprimible y el navegador lo convierte a PDF. No hay
  almacenamiento de archivos en el producto, así que la columna nunca se
  llenaría. Ver `docs/prds/05-cierre-informes-export.md`, decisión #1 y #2.
- **`project_id` pasa a `NOT NULL`.** Un informe sin proyecto no significa nada,
  y dejarlo nullable obliga a un camino muerto en cada consulta.
- **`included_processes` guarda también el `order`.** El `§4.7` pide ordenar las
  secciones del informe; ese orden es parte del informe y se persiste con él.

Que el informe se reconstruya en vez de guardarse es seguro porque **solo puede
incluir procesos cerrados**, que son inmutables por trigger de base: regenerarlo
da siempre el mismo resultado. El `name` se guarda de todos modos porque es el
nombre **en el momento de emitir**; si un proceso se renombra después, el
informe conserva el que llevaba.

#### `recipients`

**Retirada en la Fase 6 (2026-08-25).** La tabla no se crea y el envío de
informes por email queda fuera del alcance del producto. La razón es operativa,
no de diseño: el remitente de pruebas de Resend solo entrega correo a la
dirección dueña de la cuenta, así que un envío a destinatarios reales fallaría
con 403 en producción. Construir un camino que no puede funcionar es peor que
declararlo fuera de alcance. Con ello decae también la pantalla `/settings` del
`§4.9`, cuyo contenido eran precisamente los destinatarios y el catálogo de
equipos. Ver `docs/prds/05-cierre-informes-export.md`, decisión #4.

---

## 4. Módulos Funcionales

### 4.1 Autenticación y Dashboard

**Pantalla: Login/Registro**
- Autenticación vía Supabase Auth (email + password, opcionalmente Google OAuth)
- Un solo rol: el usuario tiene acceso a todo

**Pantalla: Dashboard** (`/dashboard`)
- Tarjetas KPI: proyectos activos, procesos pendientes de cierre, alertas activas
- Lista de proyectos como tarjetas con: nombre, cliente, fecha, conteo de procesos, estado
- Filtros: activo / archivado
- Botón "+ Nuevo Proyecto"
- Actividad reciente (últimas 10 acciones)

### 4.2 Gestión de Proyectos

**Pantalla: Crear Proyecto** (`/projects/new`)
- Wizard de 2 pasos:
  - Paso 1 (Básico): nombre, descripción, cliente, ubicación, coordenadas de referencia
  - Paso 2 (Equipo y Precisión): datum, proyección, marca, modelo, serie, precisión angular, precisión lineal, fecha de calibración, orden de precisión
- Al completar → redirige a la Vista del Proyecto

**Pantalla: Vista del Proyecto** (`/projects/[id]`)
- Header con datos del proyecto y equipo
- 3 tabs: **Procesos** | **Informes** | **Configuración**
- Tab Procesos: dos secciones "En Progreso" y "Cerrados", cada proceso como tarjeta con tipo (ícono), nombre, fecha, estado (badge), precisión obtenida
- Botón flotante "+ Nuevo Proceso" → selector con 3 opciones: Poligonal / Nivelación / Asentamiento

### 4.3 Editor de Poligonal

**Pantalla:** `/projects/[id]/polygonal/[pid]`

**Configuración inicial (zona superior):**
- Nombre del proceso
- Tipo: cerrada / abierta con control / abierta sin control
- Tipo de ángulo: internos / deflexiones
- Punto de partida: código, Norte, Este (pueden ser arbitrarios: 1000, 1000)
- Azimut de partida (° ' ")
- Si abierta con control: punto de llegada con coordenadas y azimut conocidos

**Tabla de datos (zona central):**
- Tabla editable estilo spreadsheet
- Columnas de entrada: estación, ángulo (° ' "), distancia horizontal
- Si deflexiones: columna adicional de sentido (D/I)
- Columnas calculadas (auto): azimut, ΔN, ΔE (se actualizan en tiempo real)
- Botón "+ Agregar Estación" al final de la tabla
- Celdas con validación visual (borde rojo si error, amarillo si advertencia)

**Panel de resultados (zona inferior):**
- Se actualiza en vivo conforme se ingresan datos
- Muestra: suma de ángulos vs teórica, error angular, error de cierre lineal, precisión relativa
- Indicador visual (verde/amarillo/rojo) de cumplimiento de tolerancia
- Selector de método de corrección: Bowditch / Tránsito / Crandall
- Tabla de coordenadas corregidas al seleccionar método

**Funcionalidad: Reasignar Coordenadas**
- Botón "Asignar Coordenadas Reales"
- Modal: nuevo Norte/Este del punto de partida, nuevo azimut
- Al confirmar: se recalculan todas las coordenadas manteniendo ángulos y distancias

**Acciones:**
- Guardar (auto-save cada 30s)
- Calcular / Recalcular
- Cerrar proceso (ver sección 5)
- Exportar a Excel
- Volver al proyecto

### 4.4 Editor de Nivelación

**Pantalla:** `/projects/[id]/leveling/[pid]`

**Configuración inicial:**
- Nombre del proceso
- Tipo: cerrada / enlace / abierta
- BM de partida: código y cota
- Si enlace: BM de llegada con cota conocida
- Toggle: ida y vuelta (sí/no)
- Orden de precisión (hereda del proyecto, editable)

**Tabla de lecturas:**
- Columnas de entrada: punto, lectura atrás, lectura adelante, distancia acumulada (km)
- Columnas calculadas (auto): AI, cota
- Si ida y vuelta: dos tablas (tab "Ida" y tab "Vuelta") con panel de promedios
- Botón "+ Agregar Lectura"

**Panel de cierre (zona inferior):**
- Comprobación aritmética: ΣLA − ΣLD = desnivel total
- Error de cierre vs tolerancia según orden
- Indicador visual de cumplimiento
- Si ida y vuelta: discrepancia entre recorridos
- Tabla de cotas corregidas (corrección proporcional a distancia)

### 4.5 Editor de Control de Asentamientos

**Terminología precisada en la Fase 5:** el módulo se llama «Control de
Asentamientos», cada medición periódica es una **visita** (antes «campaña»), y
la configuración vive en el **lugar** (`sites`), no en un «sistema».

**Pantallas** (enmendadas en la Fase 18):
- `/projects/[id]/sites/[siteId]` — configuración del lugar
- `/projects/[id]/settlement/[siteId]` — panel del control: KPIs, tabla de
  visitas, tendencia y evolución por punto
- `/projects/[id]/settlement/[siteId]/visits/[visitId]` — vista de la visita:
  KPIs, puntos de control con historial, barras y registro de nivelación
- `/projects/[id]/settlement/[siteId]/visits/[visitId]/editar` — editor de la
  visita (solo abiertas)

**Configuración del lugar (una vez):**
- Nombre, descripción, tipo de estructura (aplica el preset de umbrales)
- Catálogo de puntos: tabla editable (código, ubicación, cota C0). Sin
  coordenadas desde la Fase 29
- Umbrales de alerta: editables (velocidad y acumulado)

**Gestión de visitas:**
- Lista cronológica de visitas
- Botón "+ Nueva Visita" → crea la visita con los puntos del catálogo pre-cargados
- Visita 0 marcada como "Línea Base" (sin asentamiento ni velocidad)
- Cada visita se abre en su editor para ver/editar lecturas
- Una visita cerrada queda inmutable; el lugar se cierra al terminar el monitoreo

**Captura de la visita** (enmendada en la Fase 18):
- Modo **libreta** (por defecto): la libreta de nivelación del circuito cerrado
  sobre el BM de amarre, digitada en vivo o importada (`.L` de Leica o
  plantilla CSV). Las cotas de los puntos de control se derivan de ella.
- Modo **cotas directas**: columnas punto, cota medida (las visitas anteriores
  a la Fase 18, o una nivelación procesada fuera).
- Calculados (auto): asentamiento parcial, acumulado, velocidad, estado (semáforo)

**Panel de análisis (lateral en desktop, debajo en mobile):**
- Gráfica: asentamiento acumulado vs tiempo (multi-punto seleccionable)
- Indicador semáforo por punto e indicador de tendencia (aceleración)

### 4.6 Cierre y Bloqueo de Procesos

El cierre es el mecanismo de trazabilidad. Aplica a los 3 tipos de proceso.

**Precondiciones para cerrar:**
- Todos los datos requeridos están completos
- Los cálculos están ejecutados
- No hay errores bloqueantes (los warnings se permiten)

**Flujo de cierre:**
1. Usuario pulsa "Cerrar Proceso"
2. Sistema muestra resumen: tipo, datos, resultado, precisión, fecha/hora actual
3. Checkbox: "Confirmo que los datos son correctos"
4. Botón "Confirmar Cierre"
5. Sistema registra: `closed_at` (timestamp), `closed_by` (user ID), cambia `status` a `closed`
6. A partir de ese momento: todos los campos son de solo lectura, no se puede editar ni eliminar

> **Enmienda (Fase 15, 2026-09-24).** Excepción única: la **posición** de una
> poligonal cerrada —coordenadas, proyecciones, azimuts y datos de arranque y
> llegada— se puede reescribir al georreferenciarla con dos de sus estaciones.
> Ángulos, distancias, lecturas, errores, precisión, veredicto y estado siguen
> inmutables, y la base lo garantiza con una lista blanca en los triggers. Ver
> `docs/prds/14-georreferenciacion.md`.

**Proceso rechazado:**
- Si el proceso no cumple tolerancia, el usuario puede cerrarlo como "Rechazado"
- Se registra igualmente con timestamp y responsable
- Queda como referencia pero no se puede incluir en informes

### 4.7 Generador de Informes

**Pantalla:** `/projects/[id]/reports`

**Flujo:**
1. Botón "Generar Nuevo Informe"
2. Seleccionar procesos cerrados a incluir (checkboxes)
3. Definir orden de secciones (drag & drop)
4. Agregar observaciones generales (texto libre)
5. Vista previa del PDF
6. Generar → registra en tabla `reports`

**Estructura del PDF:**
- Portada: nombre proyecto, cliente, ubicación, fecha, equipo
- Índice de procesos incluidos
- Sección por cada proceso (datos + resultados + gráficas si aplica)
- Resumen consolidado de precisiones
- Observaciones
- Registro de cierre (quién cerró, cuándo)

**Enmendado en la Fase 6 (2026-08-25).** Dos precisiones sobre el flujo:

- **El envío por email se retira** (paso 7 original), junto con la tabla
  `recipients` del `§3.2`, por la limitación de entrega de Resend descrita allí.
- **El PDF no se almacena.** El paso 6 registra el informe en `reports`; el
  documento se produce con una ruta imprimible (`@media print`) y el navegador
  lo guarda como PDF. La «vista previa» del paso 5 es esa misma ruta en
  pantalla, no un visor de PDF embebido.

Solo pueden incluirse **procesos cerrados**, y en el caso de asentamientos la
unidad incluible es el **lugar cerrado**, no la visita suelta: un lugar activo
admite visitas nuevas, así que su informe cambiaría al reabrirlo. Un proceso
`rejected` no es incluible, como ya establece el `§4.6`.

### 4.8 Exportación a Excel

Disponible en cada proceso (cualquier estado). Genera .xlsx con:
- Hoja 1 "Datos Crudos": lecturas originales sin modificar
- Hoja 2 "Cálculos": datos corregidos, coordenadas/cotas finales
- Hoja 3 "Resumen": metadatos, método, precisión, estado

### 4.9 Configuración

**Pantalla:** `/settings`

**Secciones:**
- Perfil: nombre, empresa, cargo (almacenado en tabla `profiles` vinculada a Supabase Auth)
- Destinatarios por proyecto: nombre, email, rol
- Equipos guardados: catálogo reutilizable al crear proyectos

**Retirada en la Fase 6 (2026-08-25).** La pantalla no se construye. Los
destinatarios decaen con la tabla `recipients` (ver `§3.2`) y el catálogo de
equipos guardados nunca se modeló; el perfil ya se captura en el registro. Sin
esas tres secciones, la pantalla se queda sin contenido propio. Ver
`docs/prds/05-cierre-informes-export.md`, decisión #4.

---

## 5. Reglas de Validación

### 5.1 Capa 1 — Validación en Captura (tiempo real)

| Módulo | Validación | Comportamiento |
|---|---|---|
| Poligonal | Distancia ≤ 0 o > 1000 m | Borde rojo, bloquea guardado |
| Poligonal | Ángulo = 0° 00' 00" o = 360° 00' 00" | Borde amarillo, tooltip "posible error" |
| Poligonal | Segundos de ángulo fuera de rango (≥ 60) | Borde rojo, bloquea |
| Nivelación | Lectura de mira < 0 o > 4.000 m | Borde rojo |
| Nivelación | Lectura atrás = lectura adelante exacta | Borde amarillo |
| Nivelación | Equilibrado de visuales: \|d_V+ − d_V−\| de una armada > 2 / 5 / 10 / 10 m (Fase 19; límites de la Fase 32) | Aviso en la V− que cierra la armada; no bloquea |
| Nivelación | Equilibrado acumulado: \|Σ(d_V+ − d_V−)\| de una sección, de BM a BM, > 4 / 10 / 10 / 10 m (Fase 32) | Aviso en la V− que cierra la sección; no bloquea |
| Asentamiento | Cota actual > cota C0 (ascenso en vez de descenso) | Borde amarillo, tooltip "posible error de lectura" |
| Todos | Campo numérico vacío cuando es requerido | Borde rojo |

### 5.2 Capa 2 — Validación de Cierre (al completar)

| Módulo | Validación | Comportamiento |
|---|---|---|
| Poligonal cerrada | Error angular > tolerancia según orden | Banner rojo, bloquea cierre |
| Poligonal cerrada | Precisión relativa peor que tolerancia | Banner rojo, permite cerrar como "Rechazado" |
| Poligonal abierta | Coord. calculadas ≠ coord. conocidas (fuera de tolerancia) | Banner rojo |
| Nivelación cerrada | Error de cierre > tolerancia | Banner rojo |
| Nivelación enlace | Cota calculada ≠ cota conocida (fuera de tolerancia) | Banner rojo |
| Nivelación ida/vuelta | Discrepancia > T×√2 | Banner amarillo |
| Nivelación | ΣLA − ΣLD ≠ desnivel total (error aritmético) | Banner rojo crítico |
| Asentamiento, libreta de la visita | Error de cierre > tolerancia | Aviso; **no bloquea** (Fase 18) |
| Asentamiento, libreta de la visita | Comprobación aritmética fallida | Bloquea el cierre de la visita |

### 5.3 Capa 3 — Validación Estadística (asentamientos)

| Validación | Comportamiento |
|---|---|
| Velocidad > umbral precaución | Semáforo amarillo en el punto |
| Velocidad > umbral alerta | Semáforo naranja |
| Velocidad > umbral alarma | Semáforo rojo |
| Asentamiento acumulado > umbral | Semáforo según nivel |
| Tendencia de velocidad creciente (aceleración) | Indicador de advertencia, solo si la velocidad crece más que el margen de ruido de las tres cotas de sus dos velocidades (Fases 31 y 32) |
| Lectura fuera de tendencia (Fase 12) | Aviso al capturar, al cerrar y en el panel; no bloquea. Margen por el circuito de cada visita (Fase 32) |
| Otro BM del catálogo que no nivela con el amarre (Fase 30) | Cota calculada de la libreta frente a la de catálogo, con K·√L hasta ese BM: aviso en el editor, la vista, el cierre y el panel; no bloquea |

### 5.4 Tolerancias por Orden

```typescript
const TOLERANCES = {
  angular: { // Tolerancia = K × √n (segundos)
    primer_orden:  1,
    segundo_orden: 5,
    tercer_orden:  15,
    ordinario:     30,
  },
  linear_precision: { // Precisión mínima (1:X)
    primer_orden:  100000,
    segundo_orden: 20000,
    tercer_orden:  5000,
    ordinario:     3000,
  },
  leveling: { // Tolerancia = K × √D_km (mm)
    primer_orden:  3,
    segundo_orden: 6,
    tercer_orden:  12,
    ordinario:     24,
  },
  sight_balance: { // |d_V+ − d_V−| por armada (m)
    primer_orden:  2,
    segundo_orden: 5,
    tercer_orden:  10,
    ordinario:     10,
  },
  section_balance: { // |Σ(d_V+ − d_V−)| por sección, de BM a BM (m)
    primer_orden:  4,
    segundo_orden: 10,
    tercer_orden:  10,
    ordinario:     10,
  },
};
```

**Añadido en la Fase 32 (2026-10-02).** Los límites del equilibrado son los de
la FGCS (1984), § 3.5, para las clases cuya tolerancia de cierre es la de cada
orden: 1.º I, 2.º I y 3.º. Ordinario no está en la norma y toma los del tercer
orden. El acumulado se controla porque el error de colimación de una sección
es C·Σ(d_V+ − d_V−) (NGS 3, § 5.5.2). Ver
`docs/prds/31-rigor-estadistico.md`.

---

## 6. Algoritmos de Cálculo

### 6.1 Utilidades de Ángulos

```typescript
// Convertir grados, minutos, segundos a grados decimales
function dmsToDecimal(deg: number, min: number, sec: number): number {
  return deg + min / 60 + sec / 3600;
}

// Convertir grados decimales a grados, minutos, segundos
function decimalToDms(decimal: number): { deg: number; min: number; sec: number } {
  const d = Math.floor(decimal);
  const mFull = (decimal - d) * 60;
  const m = Math.floor(mFull);
  const s = (mFull - m) * 60;
  return { deg: d, min: m, sec: Math.round(s * 10) / 10 };
}

// Normalizar azimut a rango [0, 360)
function normalizeAzimuth(az: number): number {
  return ((az % 360) + 360) % 360;
}
```

### 6.2 Poligonal Cerrada — Ángulos Internos

**Paso 1: Verificación angular**
```
Suma teórica = (n - 2) × 180°
Error angular = Suma medida - Suma teórica
Tolerancia = K × √n  (K según orden, en segundos de arco)

Si |Error| ≤ Tolerancia → aceptar
Corrección por ángulo = -Error / n
```

**Paso 2: Cálculo de azimuts**
```
Para cada estación i (empezando desde la segunda):
  Azimut_i = Azimut_(i-1) + 180° + Ángulo_corregido_i
  Normalizar a [0°, 360°)
```

**Paso 3: Cálculo de proyecciones**
```
Para cada lado i:
  ΔN_i = distancia_i × cos(Azimut_i)
  ΔE_i = distancia_i × sin(Azimut_i)
```

**Paso 4: Error de cierre lineal**
```
Error_N = Σ ΔN   (debería ser 0 en poligonal cerrada)
Error_E = Σ ΔE   (debería ser 0 en poligonal cerrada)
Error_lineal = √(Error_N² + Error_E²)
Perímetro = Σ distancias
Precisión_relativa = Perímetro / Error_lineal
```

### 6.3 Corrección por Bowditch (Brújula)

Distribuye el error proporcionalmente a la longitud de cada lado respecto al perímetro total.

```
Para cada lado i:
  Corr_ΔN_i = -(Error_N) × (distancia_i / Perímetro)
  Corr_ΔE_i = -(Error_E) × (distancia_i / Perímetro)

  ΔN_corregido_i = ΔN_i + Corr_ΔN_i
  ΔE_corregido_i = ΔE_i + Corr_ΔE_i
```

Coordenadas finales:
```
Norte_i = Norte_(i-1) + ΔN_corregido_i
Este_i  = Este_(i-1)  + ΔE_corregido_i
```

### 6.4 Corrección por Tránsito

Distribuye el error proporcionalmente a las proyecciones absolutas de cada lado.

```
Suma_abs_ΔN = Σ |ΔN_i|
Suma_abs_ΔE = Σ |ΔE_i|

Para cada lado i:
  Corr_ΔN_i = -(Error_N) × |ΔN_i| / Suma_abs_ΔN
  Corr_ΔE_i = -(Error_E) × |ΔE_i| / Suma_abs_ΔE

  ΔN_corregido_i = ΔN_i + Corr_ΔN_i
  ΔE_corregido_i = ΔE_i + Corr_ΔE_i
```

### 6.5 Corrección por Crandall

Ajusta solo las distancias manteniendo los ángulos fijos. Es un ajuste por mínimos cuadrados condicionado.

```
Paso 1: Corregir ángulos (misma corrección equitativa que Bowditch)
Paso 2: Calcular azimuts con ángulos corregidos
Paso 3: Plantear sistema de ecuaciones:
  Σ(δd_i × cos(Az_i)) = -Error_N
  Σ(δd_i × sin(Az_i)) = -Error_E
  
  Donde δd_i es la corrección a la distancia del lado i.
  
Paso 4: Resolver por mínimos cuadrados ponderados:
  Minimizar Σ(δd_i² / d_i)
  
  Con pesos W_i = 1/d_i (lados más largos reciben mayor corrección)
  
Paso 5: Sistema matricial 2×2:
  | Σ(d_i×cos²Az_i)        Σ(d_i×cosAz_i×sinAz_i) | | k1 |   | -Error_N |
  | Σ(d_i×cosAz_i×sinAz_i) Σ(d_i×sin²Az_i)         | | k2 | = | -Error_E |
  
  Donde: δd_i = d_i×(k1×cosAz_i + k2×sinAz_i)

Paso 6: Recalcular proyecciones con distancias corregidas (d_i + δd_i)
```

> **Corregido en la Fase 26** (2026-10-01, auditoría del cálculo). El sistema
> decía Σ(cos²Az_i/d_i) con δd_i = k1×cosAz_i + k2×sinAz_i, que no cierra la
> poligonal: en TT4 deja −140 mm. Minimizar Σ(δd_i²/d_i) da δd_i proporcional
> a d_i, y con él la matriz con d_i multiplicando —el Crandall clásico, con
> lat²/L y lat·dep/L—. El motor siempre lo calculó así.

### 6.6 Poligonal Abierta con Control — Deflexiones

**Paso 1: Cálculo de azimuts desde deflexiones**
```
Para cada estación i:
  Si deflexión derecha:
    Azimut_i = Azimut_(i-1) + Deflexión_i
  Si deflexión izquierda:
    Azimut_i = Azimut_(i-1) - Deflexión_i
  Normalizar a [0°, 360°)
```

**Paso 2: Verificación angular**
```
Azimut_calculado_final vs Azimut_conocido_final
Error_angular = Azimut_calculado - Azimut_conocido
Corrección por estación = -Error / n_ángulos
```

**Paso 3: Cierre lineal**
```
Norte_calculado_final vs Norte_conocido_final
Este_calculado_final vs Este_conocido_final
Error_N = Norte_calculado - Norte_conocido
Error_E = Este_calculado - Este_conocido
(Mismas fórmulas de Bowditch/Tránsito para corrección)
```

### 6.7 Nivelación — Cálculos Base

```
Para cada estación i:
  Si tiene lectura atrás:
    AI_i = Cota_punto_atrás + Lectura_atrás_i
  
  Cota_punto_adelante = AI_i - Lectura_adelante_i

Comprobación aritmética:
  Σ Lecturas_atrás - Σ Lecturas_adelante = Cota_final - Cota_inicial
```

### 6.8 Nivelación — Corrección Proporcional a la Distancia

```
Error_cierre = Cota_calculada_BM - Cota_conocida_BM  (en mm)
Tolerancia = K × √(D_km)  (K según orden)

Si |Error| ≤ Tolerancia → aceptar y corregir:

Para cada punto i:
  Corrección_i = -(Error_cierre) × (Dist_acumulada_i / Dist_total)
  Cota_corregida_i = Cota_calculada_i + Corrección_i
```

> **Aclarado en la Fase 19** (2026-09-25, N8). `Dist_acumulada_i` es el
> recorrido **desde el origen hasta el punto i**: para un BM o punto de cambio
> llega hasta su V−, y su V+ —la visual hacia la armada siguiente— se suma
> después, para los puntos que vienen. Una vista intermedia toma el acumulado
> de su armada hasta el instrumento. Así el BM de partida tiene
> `Dist_acumulada = 0` y **no recibe corrección**, que es lo correcto: su cota
> es conocida. Hasta la Fase 19 la fila incluía su propia V+ y el BM de partida
> se corregía. `Dist_total` no cambia. Los procesos cuyas distancias
> reconstruyó la Fase 9 conservan la regla anterior. Ver
> `docs/prds/18-equilibrado-y-compensacion.md`.

### 6.9 Nivelación Ida y Vuelta

> **Enmendado en la Fase 4** (2026-08-11). La versión original promediaba
> **por tramo entre puntos consecutivos**, lo que presupone que ida y vuelta
> comparten los puntos de cambio. No es así en la práctica: los PC son
> provisionales, no se reocupan al regresar, y ambos recorridos suelen tener
> distinto número de armadas. Además, reusarlos anularía el fundamento del
> doble recorrido — un PC mal asentado introduciría el mismo error con el mismo
> signo en ambos, y el promedio lo conservaría en vez de revelarlo. El
> emparejamiento correcto es **a nivel de sección** (entre los BM extremos).
> Ver `docs/prds/03-nivelacion.md`, decisión #2 y hallazgo 3.
>
> **Corregido en la revisión final de la Fase 4** (2026-08-12, hallazgo 2). El
> texto original de esta sección afirmaba que la corrección proporcional se
> aplica «usando el desnivel adoptado». Eso nunca se implementó así: la
> compensación del recorrido de ida usa **el error de cierre de la propia
> ida**, no el desnivel adoptado. La vuelta, en esta fase, es control de
> calidad (discrepancia vs T·√2) — no insumo de la compensación. El desnivel
> adoptado se calcula y se muestra como dato informativo del doble recorrido,
> pero **no entra en el cálculo de las cotas corregidas**. Ver deuda técnica
> en `docs/tecnica/README.md`.
>
> **Enmendado en la Fase 17** (2026-09-24). La afirmación de que los PC «no se
> reocupan» la desmienten dos carteras reales —El Verjón y el crudo de nivel
> digital del Tramo 2—, que recorren en la vuelta los mismos puntos de la ida.
> Las dos prácticas existen. El emparejamiento **por sección** sigue siendo el
> veredicto; cuando ida y vuelta comparten puntos intermedios, el editor añade
> una comparación **por puntos homólogos** (cota de la vuelta − cota de la
> ida, punto a punto), informativa. Ver `docs/prds/16-homologos-ida-vuelta.md`.

```
Cada recorrido se calcula de forma independiente y produce el desnivel
de la sección completa (entre los BM extremos):

  Δh_ida    = Cota_final_ida    - Cota_inicial_ida
  Δh_vuelta = Cota_final_vuelta - Cota_inicial_vuelta   (signo opuesto a la ida)

  Discrepancia  = |Δh_ida - (-Δh_vuelta)|
  Tolerancia_iv = Tolerancia × √2

Desnivel promediado, que se calcula siempre y se informa:

  Δh_adoptado = (Δh_ida - Δh_vuelta) / 2

Veredicto:
  - abierta con vuelta: Discrepancia ≤ Tolerancia_iv (Fase 23);
  - cerrada o de enlace con vuelta: cada recorrido cumple su propia
    tolerancia, K × √D con su distancia (Fase 26). La discrepancia es control.

Compensación con vuelta (Fase 28), solo si el trabajo cumple:
  - abierta: ida y vuelta forman un circuito sobre el BM de partida.
      E_circuito = (Δh_ida + Δh_vuelta) × 1000          (mm)
      L          = D_ida + D_vuelta
      ida:    C_i = -E_circuito × s_i / L
      vuelta: C_j = -E_circuito × (D_ida + t_j) / L
    En el punto de vuelta da el promedio de ida y vuelta con pesos 1/D.
  - cerrada o de enlace: cada recorrido se compensa con su propio cierre
    (§ 6.8): la ida contra su cota conocida y la vuelta contra la del BM de
    partida.

Cota adoptada de cada punto:
  - BM de partida (y de llegada en una de enlace): su cota conocida, siempre;
  - leído dos veces: el promedio de sus dos cotas compensadas;
  - leído una vez: su cota compensada.
```

> **Enmendado en la Fase 28** (2026-10-01, CR1). Hasta entonces el desnivel
> adoptado se informaba pero no alimentaba la compensación: la ida se
> compensaba con su propio cierre, la vuelta solo controlaba, y una abierta con
> vuelta quedaba sin compensar. Ahora las dos medidas entran, y cada punto
> leído dos veces recibe una sola cota. El detalle, con El Verjón resuelto
> paso a paso, está en `docs/math/nivelacion.html`.

> **Precisado en la Fase 26** (2026-10-01, auditoría del cálculo). El texto
> decía que el desnivel se adopta «si la discrepancia cumple»; el motor lo
> calcula siempre, porque es informativo. Y en una cerrada o de enlace con
> vuelta solo se juzgaba la discrepancia, |e_ida + e_vuelta|, donde dos errores
> de signo contrario se cancelan: ahora se juzga cada recorrido. El desnivel
> adoptado entró en la compensación en la Fase 28 (ver arriba).

### 6.10 Asentamientos — Cálculos

```
Asentamiento parcial:
  Δs_parcial = Cota_visita_n - Cota_visita_(n-1)   (en mm)

Asentamiento acumulado:
  Δs_acumulado = Cota_visita_n - Cota_base   (en mm)
  Cota_base = C0 si el catálogo la trae; si no, la primera lectura del punto
  (Fase 11)

Velocidad:
  Δt_meses = (fecha_n - fecha_(n-1)) en días / 30.4375
  V = Δs_parcial / Δt_meses   (mm/mes)
```

**Añadido en la Fase 31 (2026-10-02).**

- **Promedio de la visita, encadenado:** el de la visita anterior con
  lecturas más la media de (cota − cota anterior) × 1000 de los puntos medidos
  en las dos. La media de los acumulados mezcla líneas base cuando hay altas o
  bajas; sin ellas, los dos coinciden.
- **Tendencia:** un punto acelera si |V_última| − |V_anterior| > m/Δt, con m el
  margen de la lectura fuera de tendencia del orden de la última visita (Fase
  12) y Δt su intervalo en meses. Si no, converge.

**Cambiado en la Fase 32 (2026-10-02).** El margen de ruido del parcial entre
dos visitas —el de la lectura fuera de tendencia y el de la tendencia— sale de
la tolerancia del circuito de cada una:

```
m = ½ · √(Tₚ² + Tₙ²),   T = K · √L   (L: longitud de la libreta; 0.5 km sin libreta)
```

Es el criterio de USACE EM 1110-2-1009 (2018), § 2-3.b, 1.96·√(σₚ² + σₙ²), si
K·√L es el límite al 95 % del cierre del circuito. Hasta la Fase 32 era K·√0.25
para todas, con el orden de la última visita.

La **tendencia** usa su propio margen: sus dos velocidades dependen de las
tres últimas cotas del punto, así que acelera si |V_última| − |V_anterior| >
½·√(T₁²/Δt₁² + T₂²·(1/Δt₁ + 1/Δt₂)² + T₃²/Δt₂²), √3 veces m/Δt con todo igual.

**Quitado en la Fase 29 (2026-10-01).** El asentamiento diferencial entre dos
puntos y la distorsión angular, `1/((L × 1000) / Δs_diferencial)`: los puntos
de control no tienen posición (decisión del usuario), así que no hay distancia
L entre ellos.

**Precisado en la Fase 5 (2026-08-25).** Un mes son **30.4375 días**
(`365.25/12`), fijado como constante en `tolerances.ts`. Antes esta sección decía
«Δt es el intervalo en meses» sin definir el mes, que es justo el punto donde se
equivoca el marco teórico: sus tablas copian el asentamiento parcial en la
columna de velocidad siempre que el intervalo sea «un mes», ignorando que los
meses tienen 28, 30 o 31 días. Verificado con código: 3 de los 7 intervalos del
histórico de P-09 no coinciden con ningún cálculo correcto.

Casos frontera que la fórmula no dice y el motor debe respetar:

- `Δt = 0` (dos visitas el mismo día) → velocidad `null`, nunca `Infinity` ni
  `NaN`.
- Desde la Fase 26 una visita no comparte fecha con otra del mismo lugar, así
  que Δt = 0 ya no se da con datos guardados; el motor lo sigue tolerando.
- El signo se conserva: un valor positivo es un levantamiento y se muestra como
  tal, no en valor absoluto.

Las fórmulas de asentamiento parcial y acumulado **sí se verificaron
correctas** contra los tres casos de estudio del marco teórico. La
verificación, de 35 valores todos exactos, incluyó también la distorsión
angular que la Fase 29 quitó.

### 6.11 Clasificación de Alertas en Asentamientos

**Nota de la Fase 5 (2026-08-25).** El algoritmo de abajo es correcto y es el
que se implementa. Lo que **no** sirve como referencia son los estados de alerta
de los casos de estudio del marco teórico: se verificaron con código y no se
derivan de ningún umbral. En el caso del edificio, cuatro puntos que superan el
umbral de precaución de velocidad figuran como «Normal»; en el del terraplén,
40 mm es «Normal» y 45 mm «Precaución», pero 60 mm vuelve a «Precaución» y 66 mm
salta a «Alerta» — no existe umbral monótono que produzca esa secuencia. Son
juicio editorial del autor, no clasificación calculada. **No usarlos como caso
de prueba.**

```typescript
function classifyAlert(
  velocity: number,
  accumulated: number,
  thresholds: {
    velocity_caution: number;
    velocity_alert: number;
    velocity_alarm: number;
    accumulated_caution: number;
    accumulated_alert: number;
    accumulated_alarm: number;
  }
): 'normal' | 'caution' | 'alert' | 'alarm' {
  // La peor clasificación entre velocidad y acumulado gana
  let velStatus: string = 'normal';
  const absVel = Math.abs(velocity);
  if (absVel >= thresholds.velocity_alarm) velStatus = 'alarm';
  else if (absVel >= thresholds.velocity_alert) velStatus = 'alert';
  else if (absVel >= thresholds.velocity_caution) velStatus = 'caution';

  let accStatus: string = 'normal';
  const absAcc = Math.abs(accumulated);
  if (absAcc >= thresholds.accumulated_alarm) accStatus = 'alarm';
  else if (absAcc >= thresholds.accumulated_alert) accStatus = 'alert';
  else if (absAcc >= thresholds.accumulated_caution) accStatus = 'caution';

  const order = ['normal', 'caution', 'alert', 'alarm'];
  return order[Math.max(order.indexOf(velStatus), order.indexOf(accStatus))];
}
```

---

## 7. Casos de Prueba

Los 5 casos de prueba están documentados en el archivo `TopoField_Casos_Prueba.xlsx` con datos de campo reales y resultados esperados:

| Caso | Hoja | Descripción | Resultado esperado |
|---|---|---|---|
| 1 | Poligonal Cerrada | 5 vértices, Chía, 3er orden | NO cumple tolerancia (1:4,076 < 1:5,000) |
| 2 | Poligonal Abierta | Enlace vial, deflexiones, 3er orden | SÍ cumple (1:28,384) |
| 3 | Nivelación Cerrada | Ida y vuelta, BM-01 cota 2650.000 | SÍ cumple (10mm < 11.0mm) |
| 4 | Nivelación Enlace | BM-A a BM-B, 1.600 km | NO cumple 3er orden, SÍ ordinario |
| 5 | Asentamientos | Edificio 8 pisos, 5 campañas | P-06 en Precaución |

Los casos 1 y 4 están diseñados para NO cumplir tolerancia, verificando que la plataforma detecte y alerte correctamente.

---

## 8. Pantallas y Rutas

> **Enmendada el 2026-09-30** a las rutas que existen. El control de
> asentamientos se organiza por lugar (Fase 5), los informes consolidados se
> listan en el hub y se abren en su vista imprimible (Fase 22), y `/settings`
> decayó con el catálogo de destinatarios (§ 4.9).

| Ruta | Pantalla | Módulo |
|---|---|---|
| `/` | Redirect a `/dashboard` | Auth |
| `/sign-in` | Login (Supabase Auth) | Auth |
| `/sign-up` | Registro con código de invitación (Supabase Auth) | Auth |
| `/auth/callback` | Confirmación de correo | Auth |
| `/dashboard` | Dashboard principal | Core |
| `/manual` | Manual de usuario | Core |
| `/projects/new` | Crear proyecto | Proyectos |
| `/projects/[id]` | Vista del proyecto (hub): procesos, informes y configuración | Proyectos |
| `/projects/[id]/polygonal/new` | Crear proceso poligonal | Poligonal |
| `/projects/[id]/polygonal/[pid]` | Poligonal: pestañas Proceso · Informe | Poligonal |
| `/projects/[id]/leveling/new` | Crear proceso nivelación | Nivelación |
| `/projects/[id]/leveling/[pid]` | Nivelación: pestañas Proceso · Informe | Nivelación |
| `/projects/[id]/sites/new` | Crear lugar de control de asentamientos | Asentamiento |
| `/projects/[id]/settlement/[siteId]` | Lugar: pestañas Panel · Puntos y lugar · Informe | Asentamiento |
| `/projects/[id]/settlement/[siteId]/visits/[visitId]` | Vista de una visita; `/editar`, su editor | Asentamiento |
| `/projects/[id]/reports/new` | Generar informe consolidado | Informes |
| `/projects/[id]/reports/[reportId]/print` | Informe consolidado imprimible | Informes |
| `…/[pid]/export`, `…/[siteId]/export` | Descarga del Excel de cada proceso | Exportación |

---

## 9. Orden de Implementación Sugerido

Alineado con el Gantt de 13 semanas:

1. **Setup** (S4): Next.js + Supabase (DB + Auth) + Tailwind + sistema de diseño base. Crear tablas SQL. Auth funcional.
2. **Dashboard y Proyectos** (S5): CRUD de proyectos, wizard, vista hub. Sin procesos aún.
3. **Módulo Poligonal** (S5-S7): Editor completo con los 3 métodos de corrección. Validaciones. Cierre.
4. **Módulo Nivelación** (S7-S8): Editor con ida/vuelta, corrección proporcional. Validaciones. Cierre.
5. **Módulo Asentamientos** (S8-S9): Campañas, cálculos, alertas semáforo, gráficas.
6. **Cierre, Informes, Export** (S9-S10): Flujo de cierre, generador PDF, export Excel, destinatarios.

Las seis fases se cerraron entre abril y agosto de 2026. Las fases 7 a 23 no
estaban en este plan: nacieron del contraste del motor contra carteras de
campo reales y de peticiones del usuario. Su índice y su estado están en
[`docs/prds/README.md`](docs/prds/README.md).

---

## 10. Decisiones de Diseño

- **Auto-save:** guardar cada 30 segundos o al perder foco de una celda
- **Cálculo en vivo:** recalcular al cambiar cualquier dato de entrada
- **Ángulos en DMS:** el usuario ingresa grados, minutos y segundos en campos separados (no decimales)
- **Responsive:** desktop-first, pero usable en tablet (mínimo 768px)
- **Formatos numéricos:** coordenadas a 3 decimales, cotas a 4 decimales, ángulos en DMS
- **Idioma:** español (Colombia)
- **Moneda/zona horaria:** América/Bogotá (UTC-5)
