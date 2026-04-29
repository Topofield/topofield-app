# CLAUDE.md

## Project
TopoField — plataforma web para gestión de procesos topográficos (poligonales, nivelación, asentamientos) con validación en tiempo real, cierre con trazabilidad y generación de informes. Monografía de grado, Universidad Distrital.

## Stack
Next.js 14+ (App Router) · TypeScript · Supabase (PostgreSQL + Auth) · Tailwind CSS · Vercel

## Commands
- Dev: `npm run dev`
- Build: `npm run build`
- Lint: `npm run lint`
- Type check: `npx tsc --noEmit`
- Supabase local: `npx supabase start`
- Supabase migrate: `npx supabase db push`
- Supabase types: `npx supabase gen types typescript --local > src/types/database.ts`

## Architecture
- `src/app/(auth)/` → páginas de login y registro (Supabase Auth)
- `src/app/dashboard/` → dashboard principal con lista de proyectos
- `src/app/projects/[id]/` → hub del proyecto, tabs de procesos/informes/config
- `src/app/projects/[id]/polygonal/[pid]/` → editor de poligonales
- `src/app/projects/[id]/leveling/[pid]/` → editor de nivelación
- `src/app/projects/[id]/settlement/[pid]/` → editor de asentamientos
- `src/app/projects/[id]/reports/` → generador de informes
- `src/components/design-system/` → sistema de diseño propio (NO usar shadcn/ui)
- `src/components/editors/` → componentes de los 3 editores
- `src/lib/calculations/` → algoritmos topográficos puros (sin dependencias de React)
- `src/lib/calculations/polygonal.ts` → Bowditch, Tránsito, Crandall
- `src/lib/calculations/leveling.ts` → corrección proporcional a distancia
- `src/lib/calculations/settlement.ts` → asentamientos, velocidades, alertas
- `src/lib/calculations/angles.ts` → conversiones DMS ↔ decimal, normalización
- `src/lib/validators/` → reglas de validación por capa (captura, cierre, estadística)
- `src/lib/supabase/` → cliente, queries, middleware
- `src/types/` → tipos TypeScript e interfaces, incluye database.ts autogenerado
- `middleware.ts` → protección de rutas con Supabase Auth
- `PRD-TopoField.md` → PRD completo con modelo de datos, algoritmos y reglas

## Rules
- IMPORTANT: los archivos en `src/lib/calculations/` son funciones puras de TypeScript. Sin imports de React, sin hooks, sin Supabase. Solo math.
- IMPORTANT: los ángulos se almacenan como 3 campos separados (deg, min, sec) en la DB, NO como decimal. La conversión se hace solo para cálculos internos.
- Toda la autenticación va por Supabase Auth. No usar Clerk ni ningún otro servicio de auth externo.
- No usar shadcn/ui ni ninguna librería de componentes. El sistema de diseño está en `src/components/design-system/` y se construye sobre Tailwind puro.
- Las coordenadas van a 3 decimales (0.000), las cotas a 4 decimales (0.0000), los ángulos en DMS.
- Los procesos con status "closed" son inmutables. Nunca generar UPDATE sobre un proceso cerrado.
- Cada tabla tiene Row Level Security (RLS) en Supabase. El user solo ve sus propios proyectos.
- Las tolerancias están definidas como constantes en `src/lib/calculations/tolerances.ts`, no hardcodeadas en componentes.
- Idioma de la interfaz: español (Colombia). Zona horaria: America/Bogota.
- Consultar `PRD-TopoField.md` para el modelo de datos SQL, las fórmulas de los algoritmos y las reglas de validación completas.

## Método de planificación
- El desarrollo se hace **fase por fase** según el orden de implementación del PRD principal (§ 9). Hay 6 fases.
- Antes de implementar una fase se redacta su PRD detallado en `docs/prds/NN-<slug>.md`. JIT, no por adelantado.
- El proceso completo (apertura, ejecución, cierre, anti-patrones) está en `docs/method.md`. Consultarlo antes de iniciar trabajo de cualquier fase.
- No saltar a código de una fase sin su PRD-de-fase aprobado y commiteado.

## Workflow
- Antes de tareas complejas, leer las secciones relevantes de `PRD-TopoField.md` y el PRD de la fase actual en `docs/prds/`.
- Cambios mínimos: no refactorizar código que no esté relacionado con la tarea.
- Ejecutar `npx tsc --noEmit` después de cada cambio de código.
- Cuando se modifique el schema de Supabase, regenerar tipos con el comando de gen types.
- Commits en español con prefijo: `feat:`, `fix:`, `refactor:`, `docs:`.
- Un commit por cambio lógico, no commits gigantes.
- Si hay dos enfoques posibles para una decisión arquitectónica, explicar ambos y dejar elegir.

## Out of scope
- Ajuste por mínimos cuadrados (trabajo futuro)
- Modo offline / PWA
- Importación directa desde estación total
- Firma digital criptográfica (solo cierre con timestamp)
- Múltiples roles de usuario (solo hay 1 rol)
- Visualización geoespacial en mapa
- `supabase/` migrations se editan manualmente, no autogenerar
