# CLAUDE.md

## Project
TopoField — plataforma web para gestión de procesos topográficos (poligonales, nivelación, asentamientos) con validación en tiempo real, cierre con trazabilidad y generación de informes. Monografía de grado, Universidad Distrital.

## Stack
Next.js 16 (App Router) · React 19 · TypeScript · Supabase (PostgreSQL + Auth) · Tailwind CSS v4 · Vercel

## Commands
- Dev: `npm run dev`
- Build: `npm run build`
- Lint: `npm run lint`
- Type check: `npm run typecheck` (alias de `tsc --noEmit`)
- Supabase local: `npx supabase start`
- Supabase migrar (dev local): `npx supabase db reset` (recrea el volumen y reaplica todas las migraciones)
- Supabase migrar (cloud, cuando exista): `npx supabase db push` (aplica solo las migraciones nuevas)
- Supabase types: `npx supabase gen types typescript --local 2>/dev/null > src/types/database.ts`

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
- `src/lib/supabase/` → clientes Supabase (browser, server) y helper de sesión para `proxy.ts`
- `src/types/` → tipos TypeScript e interfaces, incluye database.ts autogenerado
- `src/proxy.ts` → protección de rutas con Supabase Auth (Next 16 renombró `middleware` → `proxy`)
- `PRD-TopoField.md` → PRD completo con modelo de datos, algoritmos y reglas

## Rules
- IMPORTANT: los archivos en `src/lib/calculations/` son funciones puras de TypeScript. Sin imports de React, sin hooks, sin Supabase. Solo math.
- IMPORTANT: los ángulos se almacenan como 3 campos separados (deg, min, sec) en la DB, NO como decimal. La conversión se hace solo para cálculos internos.
- IMPORTANT: el proyecto corre sobre Next.js 16 + React 19, con breaking changes frente a versiones previas (p. ej. `middleware` → `proxy`). Ver `AGENTS.md` y consultar `node_modules/next/dist/docs/` antes de escribir código de Next.
- Toda la autenticación va por Supabase Auth. No usar Clerk ni ningún otro servicio de auth externo.
- No usar shadcn/ui ni ninguna librería de componentes. El sistema de diseño está en `src/components/design-system/` y se construye sobre Tailwind puro.
- Las coordenadas van a 3 decimales (0.000), las cotas a 4 decimales (0.0000), los ángulos en DMS.
- Los procesos con status "closed" son inmutables. Nunca generar UPDATE sobre un proceso cerrado.
- Cada tabla tiene Row Level Security (RLS) en Supabase. El user solo ve sus propios proyectos.
- Las tolerancias están definidas como constantes en `src/lib/calculations/tolerances.ts`, no hardcodeadas en componentes.
- Idioma de la interfaz: español (Colombia). Zona horaria: America/Bogota.
- Consultar `PRD-TopoField.md` por sección según la tarea: `§3` modelo de datos y SQL · `§4.6` cierre y bloqueo · `§5` reglas de validación (`§5.4` tolerancias por orden) · `§6` algoritmos de cálculo · `§9` orden de implementación.

## Método de planificación
- El desarrollo se hace **fase por fase** según el orden de implementación del PRD principal (§ 9). Hay 6 fases.
- Antes de implementar una fase se redacta su PRD detallado en `docs/prds/NN-<slug>.md`. JIT, no por adelantado.
- El proceso completo (apertura, ejecución, cierre, anti-patrones) está en `docs/method.md`. Consultarlo antes de iniciar trabajo de cualquier fase.
- El índice de fases y su estado (pendiente / en curso / cerrada) está en `docs/prds/README.md`.
- No saltar a código de una fase sin su PRD-de-fase aprobado y commiteado.

## Documentación de handoff
- `docs/tecnica/README.md` → arquitectura, modelo de datos, seguridad, motor de cálculo, sistema de diseño, cómo añadir un módulo y deuda técnica. Es la referencia para desarrollar.
- `docs/manual/README.md` → manual de usuario, con capturas de la app real. Es la **fuente de la redacción**.
- `src/app/(app)/manual/` → la ruta `/manual` de la app: el mismo manual maquetado con el sistema de diseño, visible para el usuario final y en producción. IMPORTANT: el texto vive **por duplicado** en los dos sitios y no hay generación automática; al editar uno, editar el otro en el mismo commit.
- `docs/manual/capturas.mjs` → regenera las capturas en `docs/manual/img/` y en `public/manual/` a la vez.
- IMPORTANT: ambos se actualizan **al cerrar cada fase**, no al final del proyecto. Al implementar un módulo: mover su sección de «Módulos pendientes» al cuerpo del manual, regenerar capturas con `node docs/manual/capturas.mjs`, y actualizar en la doc técnica el estado de fases, la tabla de pruebas y la deuda técnica.

## Workflow
- Antes de tareas complejas, leer las secciones relevantes de `PRD-TopoField.md` y el PRD de la fase actual en `docs/prds/`.
- Cambios mínimos: no refactorizar código que no esté relacionado con la tarea.
- Ejecutar `npm run typecheck` después de cada cambio de código.
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
