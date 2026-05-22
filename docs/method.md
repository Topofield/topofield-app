# Método de planificación incremental — TopoField

Este documento describe **cómo se planifica e implementa TopoField**. No es un PRD: es el proceso de trabajo. El PRD del producto vive en [`PRD-TopoField.md`](../PRD-TopoField.md) y los PRDs detallados por fase en [`docs/prds/`](./prds/).

## Idea central

El PRD principal define qué se construye. Pero entrar a codificar directamente desde un PRD de 37 KB invita a saltarse decisiones, a olvidar validaciones y a mezclar fases. Por eso, **el desarrollo se hace fase por fase, y cada fase tiene su propio PRD detallado** que se redacta **justo antes** de comenzar a implementarla — no antes, no después.

El PRD principal tiene 6 fases (§ 9 del PRD). Cada una recibe su propio PRD-de-fase en `docs/prds/NN-<slug>.md`:

| # | Fase | PRD de fase | Estado |
|---|---|---|---|
| 1 | Setup técnico | [`prds/00-setup.md`](./prds/00-setup.md) | cerrada |
| 2 | Dashboard y Proyectos | [`prds/01-dashboard-proyectos.md`](./prds/01-dashboard-proyectos.md) | cerrada |
| 3 | Módulo Poligonal | [`prds/02-poligonal.md`](./prds/02-poligonal.md) | cerrada |
| 4 | Módulo Nivelación | [`prds/03-nivelacion.md`](./prds/03-nivelacion.md) | pendiente |
| 5 | Módulo Asentamientos | [`prds/04-asentamientos.md`](./prds/04-asentamientos.md) | pendiente |
| 6 | Cierre, Informes, Export | [`prds/05-cierre-informes-export.md`](./prds/05-cierre-informes-export.md) | pendiente |

El estado de cada fila se actualiza al avanzar (`pendiente` → `en curso` → `cerrada`). El mismo estado vive también en [`prds/README.md`](./prds/README.md) como índice rápido.

## El ciclo de una fase

Cada fase atraviesa estas etapas, en orden:

### 1. Apertura — redactar el PRD-de-fase

Antes de tocar código de la fase, se abre una sesión de planificación con el usuario para producir `docs/prds/NN-<slug>.md`. En esa sesión:

- Se leen las secciones relevantes del PRD principal (modelo de datos, algoritmos, validaciones, pantallas) y se aterrizan a decisiones concretas para la fase.
- Se definen pantallas, contratos, validaciones por capa, criterios de aceptación y casos de prueba mínimos.
- Se identifican dependencias con fases anteriores y se acuerda el alcance — qué entra, qué se difiere.
- El PRD-de-fase no tiene plantilla rígida: cada uno adopta la estructura que mejor le sirva. Un PRD de "Setup" no se parece a uno de "Editor de poligonal", y forzarlos al mismo molde introduce ruido.

El PRD-de-fase se commitea apenas se aprueba, antes de empezar a implementar. Marca el inicio del trabajo de esa fase.

### 2. Ejecución

Se implementa siguiendo el PRD-de-fase. Reglas:

- Cambios mínimos: solo lo que sirve a la fase actual.
- `npx tsc --noEmit` después de cada cambio relevante (ver `CLAUDE.md`).
- Commits en español con prefijos `feat:`, `fix:`, `refactor:`, `docs:`. Un commit por cambio lógico.
- Si durante la implementación se descubre que un supuesto del PRD-de-fase es incorrecto, **se actualiza el PRD-de-fase primero** y luego se sigue. El PRD-de-fase es un documento vivo hasta el cierre.

### 3. Cierre de fase

Una fase se cierra cuando:

- Todos los criterios de aceptación del PRD-de-fase están cumplidos y verificados.
- `npx tsc --noEmit` y `npm run lint` pasan limpios.
- Las pruebas mínimas del PRD-de-fase pasan.

Al cerrar:

- Commit final con mensaje `docs: cerrar fase N — <nombre>` que congela el PRD-de-fase.
- Se actualiza la tabla de este archivo (`method.md`) y de `prds/README.md` cambiando el estado a `cerrada`.
- Se anota en este mismo archivo, bajo "Aprendizajes", cualquier cosa que el ciclo enseñó y que vale la pena llevar a la siguiente fase.

### 4. Apertura de la siguiente fase

Solo entonces se abre la siguiente fase con su propio PRD-de-fase. **No se solapan fases**: no se empieza a redactar el PRD de la fase N+1 mientras la fase N sigue abierta. Esto evita arrastrar decisiones a medias.

## Aprendizajes acumulados

Sección viva. Cada cierre de fase añade una entrada con:

- Fecha de cierre
- Qué supuesto del PRD-de-fase resultó incorrecto y cómo se corrigió
- Qué patrón funcionó bien y conviene replicar

### Cierre Fase 1 — Setup técnico (2026-04-29)

**Divergencias del PRD-de-fase respecto a lo implementado:**

- Versión real instalada: **Next.js 16.2.4** (no 15 como decía el plan inicial). `create-next-app@latest` resolvió a 16. Implicaciones acomodadas dentro de la fase: `middleware.ts` deprecado → renombrado a `proxy.ts` (runtime nodejs); Turbopack es default; `cookies()`/`searchParams` obligatoriamente async.
- **Tailwind 4** sin `tailwind.config.ts`: tokens viven en `src/app/globals.css` con `@theme`. Hubo que actualizar PRD-TopoField.md § 2.2.
- Supabase CLI v2.95 emite **publishable key + secret key** (formato nuevo) en lugar del clásico `anon` + `service_role`. Variables de entorno: `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` y `SUPABASE_SECRET_KEY`.
- `npm run lint` ya no es `next lint` (removido en Next 16); el script invoca `eslint` directo. CLAUDE.md `npm run lint` sigue siendo el entry point correcto.
- En dev local, lo correcto es `npx supabase db reset` (no `db push` como dice CLAUDE.md). Anotado para revisar CLAUDE.md cuando se abra Fase 2 o se conecte cloud.

**Aprendizajes a llevar a fases siguientes:**

- `projects.user_id` referencia `auth.users(id)` **sin** `on delete cascade`. Si se borra un user, sus projects (y por cascade sus reference_points en Fase 1, y procesos en Fases 3-5) quedan huérfanos. Considerar añadir cascade en una migración correctiva. **Decisión actual:** dejarlo como está hasta que aparezca un caso real, ya que el PRD original lo definió así.
- El proxy + el `redirect("/dashboard")` del root page generan una cadena de 2 redirects para usuarios no autenticados (`/` → `/dashboard` → `/sign-in`). Funciona pero gasta una request extra. Si en alguna fase importa, mover la lógica de root al proxy.
- Server Actions con `redirect()` + `searchParams` para errores son un patrón muy limpio en Next 16 con `searchParams: Promise<...>`. Lo replicaremos en Fase 2 en el wizard de proyecto.
- El `enable_confirmations = false` en `supabase/config.toml` es solo para dev; al activar cloud habrá que decidir si verificación de email entra y eso cambia el flujo de signup.
- El comando `supabase gen types --local` imprime un log a stdout (`Connecting to db 5432`) que contamina el archivo si se usa `>`. Hay que usar `2>/dev/null > out.ts` o post-procesar.

**Ajuste post-cierre (2026-04-30):** tras el primer testeo de UI, el usuario pidió capturar nombre y apellido por separado. Se reabrió la fase (estado `en curso`), se editó la migración inicial en sitio (`full_name` → `first_name` + `last_name` + `full_name` como columna generada), se actualizó el trigger, el form de sign-up y el PRD § 3.2, y se re-cerró. Patrón válido por el método ("extender el alcance del PRD-de-fase explícitamente" antes que cerrar con deuda) y viable porque la migración nunca salió de local. A futuro, si una migración ya se desplegó a cloud, este tipo de cambio iría en una migración nueva con `ALTER TABLE`, no editando la inicial.

### Cierre Fase 2 — Dashboard y Proyectos (2026-05-21)

**Divergencias del PRD-de-fase respecto a lo implementado:**

- El PRD-de-fase asumió redondear `latitude`/`longitude` a 3 decimales. Se corrigió mid-fase: la regla "coordenadas a 3 decimales" de CLAUDE.md aplica a coordenadas topográficas N/E (metros), no a la latitud/longitud geográfica del proyecto, que conserva su precisión `decimal(10,7)`. El validador solo le verifica el rango.
- Las tabs del hub se resolvieron con enlaces a `?tab=` desde un Server Component, no con un client component como sugería el plan inicial. Mismo resultado (deep-link por tab) sin JS de cliente.

**Aprendizajes a llevar a fases siguientes:**

- **`react-hooks/set-state-in-effect` es error de lint.** Con React 19 + el plugin `react-hooks`, llamar `setState` dentro de un `useEffect` rompe el lint. Hay que derivar el estado en render o ajustarlo en callbacks de evento/transición. El wizard tuvo que quitar un efecto de auto-navegación por esto.
- **Formularios en modal sin el problema de "cerrar al éxito":** `reference-points-manager` valida en cliente con el validador puro y llama al Server Action **como función** dentro de `startTransition`, cerrando el modal en el callback. Evita `useActionState` + efecto. Patrón a replicar en los editores de proceso (Fases 3-5), que tendrán modales similares.
- **Tres patrones de Server Action según el caso:** `useActionState` para formularios con validación por campo que se quedan en pantalla (wizard, edición); acción-como-función + validación en cliente para formularios en modal; `<form action>` plano para operaciones de solo-id (archivar, restaurar, eliminar).
- **Mover una carpeta de ruta deja `.next/types` obsoleto:** tras mover `dashboard/` al route group `(app)`, `tsc` falló por un `validator.ts` generado que aún referenciaba la ruta vieja. `npm run build` regenera esos tipos. Conviene hacer build (no solo typecheck) tras mover rutas.
- Los validadores puros de `src/lib/validators/` se reutilizan en cliente y servidor sin fricción; confirma el enfoque de funciones puras para la lógica de validación.

### Cierre Fase 3 — Módulo Poligonal (2026-05-22)

**Divergencias del PRD-de-fase respecto a lo implementado:**

- El PRD-de-fase contemplaba "autodetectar" el sentido del recorrido de la poligonal cerrada por el error de cierre. Resultó **imposible**: las dos orientaciones (horario/antihorario) producen polígonos espejo que *ambos* cierran (Σ(180±ángulo) son ambos múltiplos de 360°). Se fijó la convención `Az_i = Az_{i-1} + 180° − ángulo interno_i`, la del caso 1 del marco teórico, validada con un fixture de cuadrado de cierre conocido.
- El editor no tiene botón "Calcular" separado: el cálculo es siempre en vivo y "Guardar" persiste datos + resultados (decisión #4, confirmada en la práctica).

**Aprendizajes a llevar a fases siguientes:**

- **Limpiar `.next` al alternar `build` y `dev`.** Tras `npm run build`, arrancar `npm run dev` sobre el mismo `.next` hizo que una ruta estática (`polygonal/new`) se resolviera como dinámica (`[pid]`) y devolviera 404. `rm -rf .next` antes de `dev` lo soluciona.
- **El servidor recalcula con las funciones puras**, no confía en los resultados del cliente: `savePolygonalProcessAction` reconstruye el input y corre `computePolygonal`. Una sola fuente de verdad para lo persistido. Replicar en nivelación y asentamientos.
- **Funciones de cálculo puras + Vitest con fixtures verificados a mano** (un cuadrado con cierre conocido) atrapan errores de convención que la documentación ilustrativa no resuelve. Patrón clave para Fases 4-5.
- **Los números de los casos de estudio del marco teórico son ilustrativos**: las tablas no son internamente consistentes (sumas y azimuts que no cuadran). Sirven de guía del método, no de fixture exacto — los fixtures se construyen con entradas limpias.
- El mecanismo de cierre (estado `closed`/`rejected`, `closed_at`/`closed_by`, inmutabilidad en los Server Actions, modo solo lectura del editor) queda listo para reutilizarse en los módulos de nivelación y asentamientos.

## Anti-patrones a evitar

- **Saltar a código sin PRD-de-fase aprobado.** Aunque "esté claro", el ejercicio de redactar el PRD-de-fase fuerza decisiones que de otro modo emergen tarde.
- **Redactar todos los PRDs por adelantado.** Lo que se aprende implementando la fase 1 cambia las decisiones óptimas de la fase 2. Redactar todos al inicio congela decisiones con información incompleta.
- **Refactorizar fuera de alcance** durante la ejecución de una fase. Si algo de una fase anterior molesta, se anota en aprendizajes y se trata en la fase a la que pertenece — o en una fase de saneamiento explícita.
- **Cerrar una fase con criterios de aceptación a medias.** Mejor extender el alcance del PRD-de-fase explícitamente que declarar cierre con deuda.
