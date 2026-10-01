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
- Tests: `npm test` (Vitest, entorno node)
- Tests de la base: `npx supabase test db` (pgTAP en `supabase/tests/`, sobre la base local)
- Supabase local: `npx supabase start`
- Supabase migrar (dev local): `npx supabase db reset` (recrea el volumen y reaplica todas las migraciones)
- Datos de prueba: `npx supabase db reset && npm run seed` (el seed no es idempotente; el «Proyecto de ejemplo» lo crea la app en el primer inicio de sesión)
- Supabase migrar (cloud, producción): `npx supabase db push` (aplica solo las migraciones nuevas). Va **antes** del merge a `main` —Vercel despliega al instante— y solo con el visto bueno del usuario.
- Supabase types: `npx supabase gen types typescript --local 2>/dev/null > src/types/database.ts`. Si el formato generado difiere del commiteado, añadir a mano solo lo nuevo.

## Architecture
- `src/app/(auth)/` → páginas de login y registro (Supabase Auth); `src/app/auth/callback/` → confirmación de correo
- `src/app/(app)/dashboard/` → dashboard principal con lista de proyectos
- `src/app/(app)/manual/` → el manual de usuario en la app (ruta `/manual`)
- `src/app/(app)/equipos/` → el catálogo de equipos de la cuenta (ruta `/equipos`)
- `src/app/(app)/projects/[id]/` → hub del proyecto, tabs de procesos/informes/config
- `src/app/(app)/projects/[id]/polygonal/[pid]/` → poligonal: pestañas Proceso · Informe, y `export/` (Excel)
- `src/app/(app)/projects/[id]/leveling/[pid]/` → nivelación: pestañas Proceso · Informe, y `export/`
- `src/app/(app)/projects/[id]/settlement/[siteId]/` → lugar de asentamientos: pestañas Panel · Puntos y lugar · Informe; `visits/[visitId]/` y su `editar/`
- `src/app/(app)/projects/[id]/sites/` → alta del lugar (`[siteId]` redirige a la pestaña Puntos y lugar)
- `src/app/(app)/projects/[id]/reports/` → informes consolidados: `new/` y `[reportId]/print/`
- `src/components/design-system/` → sistema de diseño propio (NO usar shadcn/ui)
- `src/components/{polygonal,leveling,settlement}/` → editores y paneles de cada módulo
- `src/components/process/` → la pantalla común de un proceso (`ProcessShell`) y su informe
- `src/components/reports/` → alta del informe y sus secciones, compartidas con la pestaña Informe
- `src/components/projects/`, `navigation/` → dashboard, hub y guarda de cambios sin guardar
- `src/components/equipment/` → página del catálogo de equipos, selector «Tomar del catálogo» y su contexto, que carga el layout de `(app)`
- `src/lib/calculations/` → algoritmos topográficos puros (sin dependencias de React)
- `src/lib/calculations/polygonal.ts` → Bowditch, Tránsito, Crandall, Mínimos cuadrados (con `least-squares.ts`)
- `src/lib/calculations/leveling.ts` → corrección proporcional a distancia
- `src/lib/calculations/settlement.ts` → asentamientos, velocidades, alertas
- `src/lib/calculations/angles.ts` → conversiones DMS ↔ decimal, normalización
- `src/lib/calculations/georeference.ts` → transformación rígida desde dos puntos (georreferenciación)
- `src/lib/validators/` → reglas de validación por capa (captura, cierre, estadística)
- `src/lib/import/leveling/` → lectores de libretas de nivel digital (`.L` de Leica, plantilla CSV), puros
- `src/lib/reports/`, `src/lib/export/` → carga de secciones y portada del informe; libros de Excel
- `src/lib/demo/` → el «Proyecto de ejemplo» con carteras de campo reales, que se crea al primer inicio de sesión
- `src/lib/supabase/` → clientes Supabase (browser, server), consultas y helper de sesión para `proxy.ts`
- `supabase/migrations/` → esquema, triggers de inmutabilidad y funciones de guardado; `supabase/tests/` → pruebas pgTAP
- `scripts/seed.mjs` → datos de prueba locales
- `src/types/` → tipos TypeScript e interfaces, incluye database.ts autogenerado
- `src/proxy.ts` → protección de rutas con Supabase Auth (Next 16 renombró `middleware` → `proxy`)
- `PRD-TopoField.md` → PRD completo con modelo de datos, algoritmos y reglas

## Rules
- IMPORTANT: los archivos en `src/lib/calculations/` son funciones puras de TypeScript. Sin imports de React, sin hooks, sin Supabase. Solo math.
- IMPORTANT: los ángulos se almacenan como 3 campos separados (deg, min, sec) en la DB, NO como decimal. La conversión se hace solo para cálculos internos.
- IMPORTANT: el proyecto corre sobre Next.js 16 + React 19, con breaking changes frente a versiones previas (p. ej. `middleware` → `proxy`). Ver `AGENTS.md` y consultar `node_modules/next/dist/docs/` antes de escribir código de Next.
- Toda la autenticación va por Supabase Auth. No usar Clerk ni ningún otro servicio de auth externo.
- IMPORTANT: el registro exige el código de `SIGNUP_INVITE_CODE` y confirmación de correo. La variable NO lleva prefijo `NEXT_PUBLIC_` y solo se lee en el Server Action; si falta, el registro se bloquea (nunca se abre).
- No usar shadcn/ui ni ninguna librería de componentes. El sistema de diseño está en `src/components/design-system/` y se construye sobre Tailwind puro.
- Las coordenadas van a 3 decimales (0.000), las cotas a 4 decimales (0.0000), los ángulos en DMS.
- Los procesos con status "closed" son inmutables. Nunca generar UPDATE sobre un proceso cerrado. Única excepción: la **posición** de una poligonal (coordenadas, proyecciones, azimuts, arranque y llegada) se puede reescribir al georreferenciarla (Fase 15); los triggers admiten solo esas columnas.
- Lo que alimenta un resultado cerrado también queda fijo: la C0 y las coordenadas de un punto con lecturas en una visita cerrada no cambian (trigger en `settlement_points`), y un informe emitido no admite UPDATE: guarda su portada en `reports.cover` y solo se elimina y se regenera.
- Los guardados que escriben varias tablas van por una función de Postgres (`supabase.rpc`: `save_polygonal_process`, `save_leveling_process`, `save_visit`, `georeference_polygonal`) para que sean atómicos. Son `SECURITY INVOKER`, con columnas explícitas, y solo escriben: el cálculo sigue en TypeScript, en la Server Action.
- El catálogo de equipos (`equipment`) es una **plantilla**: elegir un equipo copia sus datos en las columnas `equipment_*` y de precisión del proceso o de la visita. Ningún proceso lo referencia, así que editar o borrar un equipo nunca cambia lo ya medido ni informado.
- Cada tabla tiene Row Level Security (RLS) en Supabase. El user solo ve sus propios proyectos.
- Las tolerancias están definidas como constantes en `src/lib/calculations/tolerances.ts`, no hardcodeadas en componentes.
- Idioma de la interfaz: español (Colombia). Zona horaria: America/Bogota.
- Consultar `PRD-TopoField.md` por sección según la tarea: `§3` modelo de datos y SQL · `§4.6` cierre y bloqueo · `§5` reglas de validación (`§5.4` tolerancias por orden) · `§6` algoritmos de cálculo · `§9` orden de implementación.

## Método de planificación
- El desarrollo se hace **fase por fase**. Las 6 primeras siguen el orden de implementación del PRD principal (§ 9); desde la 7, cada fase nace de una petición del usuario o del contraste con carteras de campo reales, anotada antes en `docs/pendientes.md`. Van 25, todas cerradas.
- Antes de implementar una fase se redacta su PRD detallado en `docs/prds/NN-<slug>.md`. JIT, no por adelantado.
- El proceso completo (apertura, ejecución, cierre, anti-patrones) está en `docs/method.md`. Consultarlo antes de iniciar trabajo de cualquier fase.
- El índice de fases y su estado (pendiente / en curso / cerrada) está en `docs/prds/README.md`.
- No saltar a código de una fase sin su PRD-de-fase aprobado y commiteado.

## Documentación de handoff
- `docs/tecnica/README.md` → arquitectura, modelo de datos, seguridad, motor de cálculo, sistema de diseño, cómo añadir un módulo y deuda técnica. Es la referencia para desarrollar.
- `docs/manual/README.md` → manual de usuario, con capturas de la app real. Es la **fuente de la redacción**.
- `src/app/(app)/manual/` → la ruta `/manual` de la app: el mismo manual maquetado con el sistema de diseño, visible para el usuario final y en producción. IMPORTANT: el texto vive **por duplicado** en los dos sitios y no hay generación automática; al editar uno, editar el otro en el mismo commit.
- `docs/manual/capturas.mjs` → regenera las capturas en `public/manual/` (copia única; el Markdown las referencia con ruta relativa).
- IMPORTANT: ambos se actualizan **al cerrar cada fase**, no al final del proyecto. Al cambiar algo visible: documentarlo en el manual (dos copias), regenerar capturas con `node docs/manual/capturas.mjs` —y commitear solo las que cambian por la fase—, y actualizar en la doc técnica el estado de fases, la tabla de pruebas y la deuda técnica (§ 11, entrada por entrada).

## Workflow
- Antes de tareas complejas, leer las secciones relevantes de `PRD-TopoField.md` y el PRD de la fase actual en `docs/prds/`.
- Cambios mínimos: no refactorizar código que no esté relacionado con la tarea.
- Ejecutar `npm run typecheck` después de cada cambio de código.
- Cuando se modifique el schema de Supabase, regenerar tipos con el comando de gen types.
- Commits en español con prefijo: `feat:`, `fix:`, `refactor:`, `docs:`.
- Un commit por cambio lógico, no commits gigantes.
- Si hay dos enfoques posibles para una decisión arquitectónica, explicar ambos y dejar elegir.

## Out of scope
- Modo offline / PWA
- Importación directa desde estación total
- Firma digital criptográfica (solo cierre con timestamp)
- Múltiples roles de usuario (solo hay 1 rol)
- Visualización geoespacial en mapa
- `supabase/` migrations se editan manualmente, no autogenerar
