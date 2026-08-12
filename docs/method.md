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
| 4 | Módulo Nivelación | [`prds/03-nivelacion.md`](./prds/03-nivelacion.md) | cerrada |
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

### Cierre Fase 4 — Módulo Nivelación (2026-08-12)

**Divergencias del PRD-de-fase respecto a lo implementado:**

- El `§6.9` del PRD principal promediaba ida y vuelta **por tramo**, lo que
  presupone que ambos recorridos comparten los puntos de cambio. La
  investigación de práctica estándar (IGAC, FGCS/NGS) mostró que no es así: los
  PC son provisionales y no se reocupan, y reusarlos anularía el fundamento del
  doble recorrido — un PC mal asentado metería el mismo error con el mismo signo
  en ambos y el promedio lo conservaría en vez de revelarlo. Se enmendó el
  `§6.9` **antes** de implementar: el emparejamiento es a nivel de sección.
- El `§3.2` no modelaba los **puntos intermedios** (radiaciones), que solo
  reciben lectura adelante y quedan fuera de la comprobación aritmética y de la
  compensación. Se añadió `point_type`.
- La decisión #8 justificaba la columna `distance_m` por la validación del
  equilibrado de visuales. Resultó imposible con una sola distancia por fila: el
  equilibrado compara `d_atrás` con `d_adelante` **dentro de una armada**. Se
  retiró la validación y se registró como deuda.
- El `§6.9` afirmaba que la corrección usa el desnivel adoptado. El motor usa el
  error de cierre de la propia ida; el adoptado se informa pero no compensa. Se
  corrigió la documentación, no el motor.

**Aprendizajes a llevar a la Fase 5:**

- **El marco teórico no sirve como fixture, por segunda vez.** Las tablas del
  Caso 1 de nivelación no son aritméticamente consistentes: verificadas contra
  las tres hipótesis de alineación de filas, ninguna se cumple en todas. Ya pasó
  con poligonales. Para asentamientos: construir los fixtures a mano y
  verificarlos con código antes de escribirlos en un test.
- **Los fallos de este dominio son silenciosos y plausibles.** Los cuatro
  hallazgos más graves de la fase produjeron números creíbles, no errores:
  una distancia acumulada nula dejaba el cierre sin compensar (99.992 en vez de
  100.000) mientras el proceso reportaba conformidad; una radiación al final del
  recorrido falseaba el error de cierre (−5.0 en vez de −8.0) con la
  comprobación aritmética en verde; la lectura atrás del BM inicial quedaba
  bloqueada y vacía, desplazando todas las cotas de forma coherente; y un
  proceso recién creado mostraba «NaN mm» y un rechazo en rojo. **Ninguno lo
  atrapó el typecheck, el lint ni la suite de tests.** Todos salieron de
  ejecutar la app y comparar contra un valor calculado a mano.
- **Verificar contra la base de datos, no contra la interfaz.** Un fallo se creyó
  inexistente porque el guard del cliente parecía cubrirlo; solo al consultar
  la tabla se vio que el dato rancio sí se persistía. La interfaz puede mentir
  sobre lo que se guardó.
- **Un test que necesita un dato imposible está probando una regla equivocada.**
  El del equilibrado solo pasaba con una visual de 1.5 m, distancia que en campo
  no existe. Esa fue la señal de que la regla estaba mal formulada, no el test.
- **La revisión final ve lo que las revisiones por tarea no pueden.** El fallo
  crítico de la radiación final vivía en la costura entre el motor (que mantiene
  dos nociones de cota) y la UI (que permite elegir el tipo de punto en
  cualquier fila). Ninguna tarea por separado lo contenía.
- **Un comentario desactualizado cuesta una ronda de corrección.** Pasó dos
  veces en esta fase, en el mismo archivo. Al cambiar el contrato de una
  función, actualizar su JSDoc en el mismo commit.

### Cierre plan de estabilización — Sistema de diseño (2026-08-09)

Este ciclo no fue una fase del § 9 del PRD principal, sino un plan lateral de
saneamiento (`docs/plans/2026-07-30-sistema-diseno.md`) para fijar reglas en
`src/components/design-system/` antes de encarar las Fases 4-6. Mismo método
de tareas verificadas en secuencia, aplicado fuera del índice de fases.

**Reglas fijadas:**

- Toda regla CSS global vive en `@layer` (`body` se movió a `@layer base`: una
  regla fuera de capa gana sobre las utilidades de Tailwind y las anula en
  silencio).
- Un solo sistema de foco: el `outline` de `@layer base`, con el selector
  ampliado a `input`, `select` y `textarea`. Ningún componente declara su
  propio `ring`.
- Nuevo escalón `--color-neutral-400` (`#828c98`) como borde de control,
  reservado a los 5 controles de formulario; los bordes decorativos siguen en
  `neutral-200`.
- Los cuatro tokens del semáforo (`primary-500`, `danger-500`, `success-500`,
  `warning-500`) se oscurecieron para cumplir AA en sus tres contextos de uso,
  no solo sobre blanco.
- Los chips de filtro convergieron a `<Link>` con `aria-current`, en vez de
  `<button>` + `router.push`, para que el filtro siga siendo navegación
  (compartible, abrible en pestaña nueva).

**La primera medición sistemática encontró lo que las revisiones manuales no veían.**
La página `/design-system` mide en vivo, contra `globals.css`, la tabla de
parejas de `src/lib/design/pairings.ts`. Antes de esta medición nadie había
detectado que el borde de los campos de formulario (`neutral-200` sobre
blanco) daba **1.43:1**, muy por debajo del 3:1 exigido a un elemento gráfico,
ni que **tres de los cuatro tokens del semáforo** fallaban en el contexto de
"texto sobre su propio fondo teñido al 10 %" (`success-500` daba 2.87:1,
`warning-500` 2.19:1) aunque sí cumplían sobre blanco. Confirma la regla de
los tres contextos: cumplir en uno no implica cumplir en los otros, y solo una
medición programática contra los tokens reales lo atrapa de forma confiable.

**Deuda registrada, a la espera de la fase 5:** tras oscurecer el semáforo, la
medición cierra en 0 fallos, pero los niveles contiguos quedan con poca
separación de luminancia entre sí — verde/amarillo 1.18, amarillo/naranja
1.15, naranja/rojo 1.01. No se pierde información porque el semáforo siempre
va acompañado de texto, pero conviene revisarlo cuando la Fase 5
(Asentamientos) use estos mismos niveles para alertas de velocidad, antes de
que la similitud visual sea una sorpresa.

**Documentar un sistema mientras el mismo plan lo sigue cambiando deja texto
obsoleto atrás, y hace falta más de una ronda para cazarlo todo.** La tarea de
documentación (Tarea 6) escribió la § 8 de `docs/tecnica/README.md` con las
reglas ya fijadas, pero el resto del repositorio no se actualizó solo: la
§ 11 de "Deuda técnica conocida" siguió afirmando que "dos sistemas de foco
conviven y conviene converger" — cierto antes de la Tarea 2, falso después—,
contradiciendo la propia § 8 escrita en el mismo commit. Por separado, la
página `/design-system` llegó a afirmar que "la restauración de filtro por
URL sustituyó a la que antes vivía en `localStorage`", lo cual era falso: la
Tarea 5 convirtió los chips en `<Link>`, pero no tocó la persistencia en
`localStorage`, que sigue funcionando exactamente igual que antes. Hicieron
falta **dos rondas de revisión** para eliminar estas afirmaciones que habían
dejado de ser ciertas. Lección para el método: cuando una tarea documenta un
sistema que otras tareas del mismo plan siguen modificando, conviene tratar
esa documentación como el último paso, no como uno paralelo, y revisarla
explícitamente contra el estado final antes de cerrar — no basta con que
quien la escribió tuviera razón en el momento de escribirla.

## Anti-patrones a evitar

- **Saltar a código sin PRD-de-fase aprobado.** Aunque "esté claro", el ejercicio de redactar el PRD-de-fase fuerza decisiones que de otro modo emergen tarde.
- **Redactar todos los PRDs por adelantado.** Lo que se aprende implementando la fase 1 cambia las decisiones óptimas de la fase 2. Redactar todos al inicio congela decisiones con información incompleta.
- **Refactorizar fuera de alcance** durante la ejecución de una fase. Si algo de una fase anterior molesta, se anota en aprendizajes y se trata en la fase a la que pertenece — o en una fase de saneamiento explícita.
- **Cerrar una fase con criterios de aceptación a medias.** Mejor extender el alcance del PRD-de-fase explícitamente que declarar cierre con deuda.

### Despliegue a producción (2026-08-11)

Fuera del ciclo de fases: el PRD de la fase 1 dejaba «Supabase Cloud y deploy a
Vercel» para «fase 6 o cuando se requiera», y se adelantó para poder mostrar el
progreso. Entró con registro por invitación, confirmación de correo y un
proyecto de ejemplo automático (ver `docs/prds/00-setup.md` y
`docs/tecnica/README.md` § 13).

**Lo que enseñó, por si se repite en otro entorno:**

- **Los fallos de configuración de Auth no dan error, redirigen.** Si el destino
  de `emailRedirectTo` no está en las «Redirect URLs», Supabase manda al
  `Site URL` sin avisar. Y si el `Site URL` sigue apuntando a `localhost`, el
  correo de confirmación lleva al usuario a su propia máquina: la cuenta queda
  confirmada, pero el callback nunca corre. Pasaron las dos cosas, una en local
  y otra en producción.
- **Un 504 deja la interfaz sin nada que decir.** El SMTP mal configurado
  (puerto 587 en vez de 465) colgaba el registro 36 segundos y devolvía un 504,
  que no trae cuerpo JSON; la alerta salía vacía. Conviene que el manejo de
  errores distinga «el servicio respondió con un error» de «el servicio no
  respondió».
- **`supabase db query` consulta la base local salvo que se le pase
  `--linked`.** Sin esa bandera los resultados parecen válidos y describen otra
  base. Estuve a punto de sacar conclusiones equivocadas por esto.
- **El problema de permisos tras `db reset` es solo local.** En la nube los
  `GRANT` vienen bien de fábrica; el `permission denied for table profiles` que
  apareció en local no se reprodujo en producción.
