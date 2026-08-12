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
       ├── PolygonalProcess
       │    ├── PolygonalStation (lecturas)
       │    └── PolygonalResult (coordenadas corregidas)
       ├── LevelingProcess
       │    ├── LevelingReading (lecturas)
       │    └── LevelingResult (cotas corregidas)
       ├── SettlementSystem
       │    ├── SettlementPoint (catálogo de puntos)
       │    ├── SettlementCampaign
       │    │    └── SettlementReading (lecturas por campaña)
       │    └── SettlementAlert (alertas generadas)
       ├── Report (informes generados)
       └── Recipient (destinatarios de informes)
```

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

#### `settlement_systems`
```sql
CREATE TABLE settlement_systems (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  structure_type TEXT NOT NULL,              -- ej: "edificio", "presa", "terraplen"
  -- Umbrales de alerta
  velocity_caution DECIMAL(6,2) DEFAULT 2.0,    -- mm/mes
  velocity_alert DECIMAL(6,2) DEFAULT 5.0,
  velocity_alarm DECIMAL(6,2) DEFAULT 10.0,
  accumulated_caution DECIMAL(8,2) DEFAULT 10.0, -- mm
  accumulated_alert DECIMAL(8,2) DEFAULT 25.0,
  accumulated_alarm DECIMAL(8,2) DEFAULT 50.0,
  angular_distortion_limit TEXT DEFAULT '1/500',
  -- Estado
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'closed')),
  closed_at TIMESTAMPTZ,
  closed_by TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

#### `settlement_points`
```sql
CREATE TABLE settlement_points (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  system_id UUID REFERENCES settlement_systems(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  location_description TEXT NOT NULL,       -- ej: "Columna A1 — Esquina NW"
  initial_elevation DECIMAL(10,4),          -- C0
  created_at TIMESTAMPTZ DEFAULT now()
);
```

#### `settlement_campaigns`
```sql
CREATE TABLE settlement_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  system_id UUID REFERENCES settlement_systems(id) ON DELETE CASCADE,
  campaign_number INT NOT NULL,             -- 0 = línea base
  date DATE NOT NULL,
  operator TEXT,
  equipment TEXT,
  weather_conditions TEXT,
  closure_error_mm DECIMAL(8,1),
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'calculated', 'closed')),
  closed_at TIMESTAMPTZ,
  closed_by TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

#### `settlement_readings`
```sql
CREATE TABLE settlement_readings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES settlement_campaigns(id) ON DELETE CASCADE,
  point_id UUID REFERENCES settlement_points(id) ON DELETE CASCADE,
  elevation DECIMAL(10,4) NOT NULL,
  -- Calculados
  partial_settlement DECIMAL(8,1),          -- mm, vs campaña anterior
  accumulated_settlement DECIMAL(8,1),      -- mm, vs C0
  velocity DECIMAL(8,2),                    -- mm/mes
  alert_status TEXT DEFAULT 'normal' CHECK (alert_status IN ('normal', 'caution', 'alert', 'alarm')),
  created_at TIMESTAMPTZ DEFAULT now()
);
```

#### `reports`
```sql
CREATE TABLE reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  included_processes JSONB NOT NULL,        -- [{type, id, name}]
  observations TEXT,
  generated_at TIMESTAMPTZ DEFAULT now(),
  generated_by TEXT NOT NULL,
  file_url TEXT                             -- URL del PDF generado
);
```

#### `recipients`
```sql
CREATE TABLE recipients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  role TEXT NOT NULL,                       -- ej: "cliente", "supervisor", "interventor"
  auto_send BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

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

### 4.5 Editor de Asentamientos

**Pantalla:** `/projects/[id]/settlement/[pid]`

**Configuración del sistema (una vez):**
- Nombre, tipo de estructura
- Catálogo de puntos: tabla editable (código, ubicación, cota C0)
- Umbrales de alerta: editables (velocidad, acumulado, distorsión angular)

**Gestión de campañas:**
- Lista cronológica de campañas
- Botón "+ Nueva Campaña" → crea campaña con los puntos del catálogo pre-cargados
- Campaña C0 marcada como "Línea Base"
- Cada campaña expandible para ver/editar lecturas

**Tabla de lecturas por campaña:**
- Columnas: punto, cota medida
- Calculados (auto): asentamiento parcial, acumulado, velocidad, estado (semáforo)

**Panel de análisis (lateral en desktop, debajo en mobile):**
- Gráfica: asentamiento acumulado vs tiempo (multi-punto seleccionable)
- Tabla de asentamientos diferenciales con distorsión angular
- Indicador semáforo por punto

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
6. Generar → almacena PDF + registra en tabla `reports`
7. Si hay destinatarios configurados → envía por email

**Estructura del PDF:**
- Portada: nombre proyecto, cliente, ubicación, fecha, equipo
- Índice de procesos incluidos
- Sección por cada proceso (datos + resultados + gráficas si aplica)
- Resumen consolidado de precisiones
- Observaciones
- Registro de cierre (quién cerró, cuándo)

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

### 5.3 Capa 3 — Validación Estadística (asentamientos)

| Validación | Comportamiento |
|---|---|
| Velocidad > umbral precaución | Semáforo amarillo en el punto |
| Velocidad > umbral alerta | Semáforo naranja |
| Velocidad > umbral alarma | Semáforo rojo |
| Asentamiento acumulado > umbral | Semáforo según nivel |
| Distorsión angular > límite configurado | Alerta en tabla de diferenciales |
| Tendencia de velocidad creciente (aceleración) | Indicador de advertencia |

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
};
```

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
  | Σ(cos²Az_i/d_i)        Σ(cosAz_i×sinAz_i/d_i) | | k1 |   | -Error_N |
  | Σ(cosAz_i×sinAz_i/d_i) Σ(sin²Az_i/d_i)         | | k2 | = | -Error_E |
  
  Donde: δd_i = k1×cosAz_i + k2×sinAz_i

Paso 6: Recalcular proyecciones con distancias corregidas (d_i + δd_i)
```

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

```
Cada recorrido se calcula de forma independiente y produce el desnivel
de la sección completa (entre los BM extremos):

  Δh_ida    = Cota_final_ida    - Cota_inicial_ida
  Δh_vuelta = Cota_final_vuelta - Cota_inicial_vuelta   (signo opuesto a la ida)

  Discrepancia  = |Δh_ida - (-Δh_vuelta)|
  Tolerancia_iv = Tolerancia × √2

Si Discrepancia ≤ Tolerancia_iv → se adopta el desnivel promediado:

  Δh_adoptado = (Δh_ida - Δh_vuelta) / 2

Δh_adoptado se calcula y se informa como dato del doble recorrido, pero HOY
NO alimenta la compensación: la corrección proporcional (§ 6.8) se aplica al
recorrido de ida usando el error de cierre de la propia ida (Cota_calculada -
Cota_conocida), no el desnivel adoptado. NO se promedia tramo a tramo.
```

### 6.10 Asentamientos — Cálculos

```
Asentamiento parcial:
  Δs_parcial = Cota_campaña_n - Cota_campaña_(n-1)   (en mm)

Asentamiento acumulado:
  Δs_acumulado = Cota_campaña_n - Cota_C0   (en mm)

Velocidad:
  V = Δs_parcial / Δt   (mm/mes, donde Δt es el intervalo en meses)

Asentamiento diferencial entre puntos i y j:
  Δs_diferencial = |Δs_acumulado_i - Δs_acumulado_j|

Distorsión angular:
  β = Δs_diferencial / L   (donde L = distancia horizontal entre puntos, en mm)
  Se expresa como 1/β_inverso (ej: 1/2,500)
```

### 6.11 Clasificación de Alertas en Asentamientos

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

| Ruta | Pantalla | Módulo |
|---|---|---|
| `/` | Redirect a `/dashboard` | Auth |
| `/sign-in` | Login (Supabase Auth) | Auth |
| `/sign-up` | Registro (Supabase Auth) | Auth |
| `/dashboard` | Dashboard principal | Core |
| `/projects/new` | Crear proyecto (wizard) | Proyectos |
| `/projects/[id]` | Vista del proyecto (hub) | Proyectos |
| `/projects/[id]/polygonal/new` | Crear proceso poligonal | Poligonal |
| `/projects/[id]/polygonal/[pid]` | Editor de poligonal | Poligonal |
| `/projects/[id]/leveling/new` | Crear proceso nivelación | Nivelación |
| `/projects/[id]/leveling/[pid]` | Editor de nivelación | Nivelación |
| `/projects/[id]/settlement/new` | Crear sistema asentamiento | Asentamiento |
| `/projects/[id]/settlement/[pid]` | Editor de asentamiento | Asentamiento |
| `/projects/[id]/reports` | Generador de informes | Informes |
| `/settings` | Configuración | Core |

---

## 9. Orden de Implementación Sugerido

Alineado con el Gantt de 13 semanas:

1. **Setup** (S4): Next.js + Supabase (DB + Auth) + Tailwind + sistema de diseño base. Crear tablas SQL. Auth funcional.
2. **Dashboard y Proyectos** (S5): CRUD de proyectos, wizard, vista hub. Sin procesos aún.
3. **Módulo Poligonal** (S5-S7): Editor completo con los 3 métodos de corrección. Validaciones. Cierre.
4. **Módulo Nivelación** (S7-S8): Editor con ida/vuelta, corrección proporcional. Validaciones. Cierre.
5. **Módulo Asentamientos** (S8-S9): Campañas, cálculos, alertas semáforo, gráficas.
6. **Cierre, Informes, Export** (S9-S10): Flujo de cierre, generador PDF, export Excel, destinatarios.

---

## 10. Decisiones de Diseño

- **Auto-save:** guardar cada 30 segundos o al perder foco de una celda
- **Cálculo en vivo:** recalcular al cambiar cualquier dato de entrada
- **Ángulos en DMS:** el usuario ingresa grados, minutos y segundos en campos separados (no decimales)
- **Responsive:** desktop-first, pero usable en tablet (mínimo 768px)
- **Formatos numéricos:** coordenadas a 3 decimales, cotas a 4 decimales, ángulos en DMS
- **Idioma:** español (Colombia)
- **Moneda/zona horaria:** América/Bogotá (UTC-5)
