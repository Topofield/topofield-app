# Método de planificación incremental — TopoField

Este documento describe **cómo se planifica e implementa TopoField**. No es un PRD: es el proceso de trabajo. El PRD del producto vive en [`PRD-TopoField.md`](../PRD-TopoField.md) y los PRDs detallados por fase en [`docs/prds/`](./prds/).

## Idea central

El PRD principal define qué se construye. Pero entrar a codificar directamente desde un PRD de 37 KB invita a saltarse decisiones, a olvidar validaciones y a mezclar fases. Por eso, **el desarrollo se hace fase por fase, y cada fase tiene su propio PRD detallado** que se redacta **justo antes** de comenzar a implementarla — no antes, no después.

El PRD principal define 6 fases (§ 9 del PRD). Las fases 7 en adelante no estaban en ese plan: nacen del contraste del motor de cálculo contra carteras de campo reales (`docs/carteras/`), que dejó al descubierto una convención de azimut equivocada y funcionalidad que el PRD original no contemplaba. El método no cambia — cada fase, venga del § 9 o de un hallazgo posterior, recibe su propio PRD-de-fase en `docs/prds/NN-<slug>.md`:

| # | Fase | PRD de fase | Estado |
|---|---|---|---|
| 1 | Setup técnico | [`prds/00-setup.md`](./prds/00-setup.md) | cerrada |
| 2 | Dashboard y Proyectos | [`prds/01-dashboard-proyectos.md`](./prds/01-dashboard-proyectos.md) | cerrada |
| 3 | Módulo Poligonal | [`prds/02-poligonal.md`](./prds/02-poligonal.md) | cerrada |
| 4 | Módulo Nivelación | [`prds/03-nivelacion.md`](./prds/03-nivelacion.md) | cerrada |
| 5 | Control de Asentamientos | [`prds/04-asentamientos.md`](./prds/04-asentamientos.md) | cerrada |
| 6 | Cierre, Informes, Export | [`prds/05-cierre-informes-export.md`](./prds/05-cierre-informes-export.md) | cerrada |
| 7 | Motor y captura de poligonales | [`prds/06-motor-captura-poligonal.md`](./prds/06-motor-captura-poligonal.md) | cerrada |
| 8 | Precisión y equipo por proceso | [`prds/07-precision-equipo-por-proceso.md`](./prds/07-precision-equipo-por-proceso.md) | cerrada |
| 9 | Cadena de distancias de nivelación | [`prds/08-cadena-distancias-nivelacion.md`](./prds/08-cadena-distancias-nivelacion.md) | cerrada |
| 10 | Nomenclatura de nivelación | [`prds/09-nomenclatura-nivelacion.md`](./prds/09-nomenclatura-nivelacion.md) | cerrada |
| 11 | Estado de los BMs | [`prds/10-estado-bms.md`](./prds/10-estado-bms.md) | cerrada |
| 12 | Alerta por lectura desfasada | [`prds/11-lectura-desfasada.md`](./prds/11-lectura-desfasada.md) | cerrada |
| 13 | Canvas de poligonal | [`prds/12-canvas-poligonal.md`](./prds/12-canvas-poligonal.md) | cerrada |
| 14 | Ajuste por mínimos cuadrados | [`prds/13-minimos-cuadrados.md`](./prds/13-minimos-cuadrados.md) | cerrada |
| 15 | Georreferenciación de levantamientos | [`prds/14-georreferenciacion.md`](./prds/14-georreferenciacion.md) | cerrada |
| 16 | Importar lecturas de nivel digital | [`prds/15-importar-nivel-digital.md`](./prds/15-importar-nivel-digital.md) | cerrada |
| 17 | Control ida-vuelta por puntos homólogos | [`prds/16-homologos-ida-vuelta.md`](./prds/16-homologos-ida-vuelta.md) | cerrada |
| 18 | Libreta de nivelación y panel de asentamientos | [`prds/17-libreta-panel-asentamientos.md`](./prds/17-libreta-panel-asentamientos.md) | cerrada |
| 19 | Equilibrado por armada y compensación desde el origen | [`prds/18-equilibrado-y-compensacion.md`](./prds/18-equilibrado-y-compensacion.md) | cerrada |
| 20 | Identidad visual del prototipo y coma decimal | [`prds/19-identidad-visual-coma-decimal.md`](./prds/19-identidad-visual-coma-decimal.md) | cerrada |
| 21 | La demo con las carteras reales | [`prds/20-demo-carteras-reales.md`](./prds/20-demo-carteras-reales.md) | en curso |

El estado de cada fila se actualiza al avanzar (`pendiente` → `en curso` → `cerrada`). El mismo estado vive también en [`prds/README.md`](./prds/README.md) como índice rápido.

> **Renumeración del 2026-09-22.** Las fases 9 a 12 son nuevas: salen de las
> peticiones de nivelación y asentamientos de [`pendientes.md`](./pendientes.md),
> que el orden anterior no contemplaba y que el usuario quiere antes del canvas.
> Al insertarlas, las tres fases que ya estaban planificadas se desplazaron:
>
> | Antes | Ahora | Fase |
> |---|---|---|
> | 9 | **13** | Canvas de poligonal |
> | 10 | **14** | Ajuste por mínimos cuadrados |
> | 11 | **15** | Georreferenciación de levantamientos |
>
> Los PRDs ya cerrados conservan su texto original —el método los declara
> históricos— con una nota de equivalencia al principio. Antes de esta
> renumeración las referencias ya se contradecían entre sí: el PRD de la Fase 7
> situaba los mínimos cuadrados en la «Fase 9» y el de la Fase 8 en la «Fase 10».

Las fases 9 a 12 cubren cuatro de las peticiones de `pendientes.md`; las
restantes (P1, N4, N5, N6) siguen **sin número**, que es lo que el método
prescribe: se numera al redactar el PRD, no por adelantado.

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
- **Se revisa la § 11 de `docs/tecnica/README.md` entrada por entrada, contra
  el código**, y se reescribe la que la fase haya resuelto. No basta con
  recordar cuáles se tocaron: hay que comprobarlas. Ver «Por qué este paso
  existe», abajo.
- **Se barren las afirmaciones que dejaron de ser ciertas**: conteo de tests,
  estado de fases, listas de módulos pendientes, y cualquier instrucción que
  mencione algo que la fase eliminó. Un `grep` de las cifras y los nombres que
  la fase cambió basta para encontrarlas.
- Se anota en este mismo archivo, bajo "Aprendizajes", cualquier cosa que el ciclo enseñó y que vale la pena llevar a la siguiente fase.

#### Por qué este paso existe

Porque la lección se aprendió tres veces antes de convertirse en procedimiento.
La Fase 4 anotó que «un comentario desactualizado cuesta una ronda de
corrección»; el plan de saneamiento del sistema de diseño necesitó **dos rondas
de revisión** para eliminar afirmaciones que habían dejado de ser ciertas, y
dejó escrita la lección casi con estas palabras; y aun así, al cerrar la Fase 6
quedaron **cuatro entradas de la § 11** describiendo como pendiente algo que esa
misma fase había resuelto.

Las tres veces el texto era correcto cuando se escribió. Ese es justamente el
problema: **nada falla cuando una afirmación caduca**. No hay test que lo
detecte, el `lint` no lo ve y el `build` pasa. Solo lo encuentra alguien que
compare el documento con el código a propósito — y por eso tiene que ser un
paso del cierre, no un acto de memoria.

### 3.bis Integración: rama y Pull Request

**Cada fase se trabaja en su propia rama y entra a `main` por Pull Request**, no
por merge local.

El motivo es concreto, no ceremonia: el repositorio se trabaja desde varias
sesiones a la vez. Las fases 7 y 8 se hicieron en local mientras otra sesión
empujaba cinco commits a `main`, y reconciliarlas costó 24 conflictos —entre
ellos dos que solo aparecieron al correr el seed, porque no daban error de
compilación—. Una rama publicada temprano hace visible la divergencia antes de
que crezca.

- La rama se crea al abrir la fase, con el nombre de la fase
  (`fase-8-precision-equipo-por-proceso`).
- Se empuja pronto, aunque esté a medias: su valor es avisar a las otras
  sesiones de que ese territorio está ocupado.
- El PR se abre al cerrar la fase, con la descripción resumiendo qué cambió y
  qué se verificó.
- El merge a `main` lo decide el usuario, nunca el agente.

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

### Cierre Fase 5 — Control de Asentamientos (2026-08-25)

**Divergencias del PRD-de-fase respecto a lo implementado:**

- El PRD hacía que el motor redondeara la velocidad a 2 decimales, mientras
  sus propios tests exigían precisión a 6: eran incompatibles entre sí. Se
  quitó el redondeo del motor, y no por comodidad — redondear antes de
  clasificar cambia el nivel de alerta (una velocidad real de 1.996 mm/mes se
  convierte en 2.00 al redondear y salta de `normal` a `caution`). El
  redondeo pertenece a la persistencia (`velocity DECIMAL(8,2)`) y a la
  presentación (`.toFixed(2)`), no al motor.
- El PRD asignaba `closeSiteAction` a la tarea de rutas del lugar; en
  realidad correspondía a la tarea de cierre.
- El plan proponía reemplazar las lecturas de una visita con `delete`+`insert`
  al guardar, describiéndolo como «más seguro». Resultó lo contrario: un
  fallo entre ambas sentencias deja la visita sin datos, justo lo que el
  módulo existe para evitar. Se cambió a upsert por punto con purga posterior
  de los puntos retirados.

**Aprendizajes a llevar a la Fase 6:**

- **El marco teórico falló por tercera vez, y esta vez en el cálculo.** En
  las Fases 3 y 4 las tablas del marco teórico eran aritméticamente
  inconsistentes en su forma; esta vez sus asentamientos y distorsiones
  angulares son exactos (35 valores verificados), pero las velocidades no
  cuadran en 3 de 7 intervalos —copia el asentamiento parcial en la columna
  de velocidad cuando el intervalo es «un mes»— y los estados de alerta no se
  derivan de sus propios umbrales (en el terraplén, 40 mm es «Normal» y 45
  «Precaución», pero 60 vuelve a «Precaución» y 66 salta a «Alerta»). Son
  juicio editorial, no cálculo, y ninguna fórmula los reproduce.
- **La revisión de conjunto encontró dos fallos críticos que ninguna revisión
  por tarea podía ver**, y ambos son del tipo que el dominio predice. Uno: un
  proyecto nuevo no podía crear ninguna poligonal ni nivelación, porque
  `site_id` pasó a ser obligatorio y ninguna tarea creaba el lugar al crear
  el proyecto — una regresión sobre funcionalidad de las Fases 3 y 4 que no
  salió antes porque toda la verificación corrió sobre datos sembrados, que
  sí tenían lugar. Dos: guardar una visita dejaba obsoletas las lecturas de
  las visitas posteriores en la base, mientras el panel seguía mostrando los
  valores recalculados en vivo. Los dos vivían en costuras entre tareas, no
  dentro de ninguna tarea.
- **Verificar sobre datos sembrados oculta los fallos del arranque en frío.**
  Es el aprendizaje operativo más transferible de esta fase: además de
  verificar con el seed cargado, hay que probar también el camino del
  usuario que empieza de cero (proyecto nuevo, sin lugares, sin procesos).
- **Una caché derivada que nadie invalida diverge por todas las puertas que
  alimentan el mismo cálculo, no solo por la que se documentó primero.** El
  Ruling 6 de esta fase registró la divergencia entre hub y panel al editar
  los umbrales de un lugar, y la dio por acotada («mientras nadie edite
  umbrales, no hay divergencia»). Era falso: el mismo mecanismo —lecturas
  persistidas que no se recalculan— afectaba también a intercalar una visita
  y a corregir la cota base de un punto, dos operaciones normales del flujo,
  no ediciones excepcionales. Al documentar una limitación de este tipo
  conviene preguntarse qué otras entradas alimentan el mismo cálculo antes de
  darla por acotada.
- **Los tests de la capa de persistencia no existen y se echaron de menos.**
  Los fallos de esta fase que llegaron más lejos —la propagación de lecturas
  entre visitas— vivían en los Server Actions, no en el motor de cálculo, que
  está bien cubierto por tests puros. El proyecto no tiene hoy manera de
  mockear el cliente de Supabase ni pruebas de integración contra la base
  local; sin eso, esta clase de fallo seguirá dependiendo de verificación
  manual.

### Cierre Fase 6 — Cierre, Informes y Exportación (2026-08-26)

Última fase del § 9. A diferencia de las Fases 3-5, no construyó motor de
cálculo: **consume** lo que las anteriores persistieron, y eso desplazó el
riesgo de la aritmética a la consistencia de lo guardado.

**Divergencias del PRD-de-fase respecto a lo implementado:**

- El `§4.7` pedía ordenar las secciones con **arrastrar y soltar**. Se
  resolvió con botones ↑ ↓: el drag & drop exigiría una librería —el proyecto
  no usa ninguna— y es difícil de operar con teclado. Mismo control, accesible
  sin trabajo extra.
- El PRD-de-fase daba por buena la deuda de `formatPrecision` («cuatro copias
  con criterios distintos»). Al implementarla resultó que las tres copias
  reales eran **idénticas**, y que la divergencia la causaban dos consumidores
  del mismo dato: el listado imprimía la cadena persistida en crudo y el editor
  la formateaba. Unificar las copias no habría arreglado nada.
- La enumeración de entradas al cálculo de asentamientos que el PRD exigía
  encontró **una puerta más** de la que la deuda documentaba: `savePointAction`,
  porque el acumulado es `(cota − C0) × 1000` y corregir la cota base deja
  obsoletas las lecturas persistidas.

**Aprendizajes:**

- **Una deuda técnica bien escrita puede estar mal diagnosticada.** La entrada
  de `formatPrecision` llevaba fases describiendo el síntoma correcto
  (`1:1001` vs `1:1.001`) con la causa equivocada. Verificar el código antes de
  actuar sobre lo que la deuda propone es tan necesario como verificar el marco
  teórico: ambos son afirmaciones de otro momento.
- **Un aprendizaje que no se convierte en procedimiento se vuelve a olvidar.**
  Al cerrar la fase, cuatro entradas de la § 11 seguían describiendo como
  pendiente algo que la propia fase había resuelto. Lo revelador no es el
  descuido, sino que la lección **ya estaba escrita dos veces** —en el cierre
  de la Fase 4 y en el del plan de saneamiento, esta última casi con las
  mismas palabras («revisarla explícitamente contra el estado final antes de
  cerrar»)— y aun así volvió a pasar. Estaba en «Aprendizajes», que se lee al
  abrir una fase; no estaba en el checklist de cierre, que es cuando hace
  falta. Se añadió allí. **Regla general: si un aprendizaje describe algo que
  hay que hacer en un momento concreto del ciclo, su sitio es el checklist de
  ese momento, no la sección de aprendizajes.**
- **Una fase que consume datos persistidos destapa lo que las que los producen
  nunca miran.** El seed llevaba tres fases sin escribir los resultados de
  estación —solo los datos de campo— y nadie lo había notado, porque el editor
  recalcula en vivo y la interfaz se veía correcta. Solo se vio cuando el
  informe imprimió una tabla de coordenadas llena de guiones. Todo lo que se
  persiste debería tener al menos un consumidor que lo lea sin recalcular.

  **Y el mismo fallo estaba en producción.** Al revisar el cierre encontré que
  `crear-proyecto-demo.ts` —que corre para cada usuario nuevo— tenía el defecto
  idéntico, con un comentario que además afirmaba lo contrario («los resultados
  que se persisten los calcula el motor real»). Cinco fases sin detectarlo. La
  lección operativa: cuando se corrige un fallo en un generador de datos, hay
  que buscar de inmediato sus gemelos — el seed y el generador de la demo
  comparten forma, y compartían el error. Un comentario que describe una
  garantía no es prueba de que la garantía exista.
- **Una regla escrita en un PRD y nunca ejercida no está verificada.** El
  `§4.6` prohibía desde la Fase 3 incluir procesos rechazados en informes. No
  se pudo comprobar hasta que hubo informes, tres fases después. Conviene
  anotar qué reglas quedan sin ejercer al cerrar una fase.
- **Cuatro flujos que hacen lo mismo divergen en silencio.** De los cuatro
  diálogos de cierre, tres pedían el checkbox del `§4.6` y el del lugar no — y
  era precisamente el de mayor alcance, porque congela todas las visitas de
  golpe. Nadie lo notó porque cada uno se revisó en su propia fase. Cuando una
  regla aplica a N sitios, conviene revisarla en los N a la vez, no en cada
  fase por separado.
- **La prueba de accesibilidad tiene que quitar el canal, no razonarlo.** La
  deuda del semáforo y la de los marcadores se discutieron con argumentos
  durante dos fases. Renderizar la gráfica **en escala de grises** resolvió la
  pregunta en una captura: sin color, las diez siluetas se distinguen o no se
  distinguen.
- **Escribir a mano lo que el dominio ya modela introduce errores.** Al
  redactar las etiquetas del libro de Excel de nivelación me equivoqué en dos
  de tres: el tipo de punto es `pc` y no `change_point`, y el proceso tiene
  tres tipos y no dos. El `CHECK` de la base y los mapas de `types/` ya tenían
  la respuesta. Importarlos, no copiarlos.
- **El trigger de inmutabilidad rechazó tres intentos de manipular datos
  cerrados durante la verificación** —reabrir una visita, reabrir un lugar,
  rellenar estaciones de un proceso cerrado—. No estaba previsto como prueba,
  pero es la confirmación más fuerte de que la inmutabilidad no depende del
  código de aplicación. Es lo que permite que un informe se reconstruya en vez
  de guardarse.

### Cierre Fase 9 — Cadena de distancias de nivelación (2026-09-22)

Primera fase que nace de una cartera de campo en vez de un hallazgo de código:
`TRABAJO NIVELACION EL VERJON.xlsx` es aritméticamente correcta en sus dos
hojas y aun así **pierde 24.7 m de su distancia total**, porque una vista
intermedia rompió la cadena de sumas. De ese número depende `K·√D`.

**Divergencias del PRD-de-fase respecto a lo implementado:**

- El PRD y el diseño daban **seis** columnas de hilos. Son **cuatro**: el hilo
  medio no lleva columna porque **es** la lectura de mira (`backsight` /
  `foresight`). Darle una habría creado dos fuentes de verdad para el mismo
  número — justo el defecto que la fase venía a eliminar.
- El backfill del PRD repartía **todo** tramo por mitades, lo que en una fila
  terminal (solo visual adelante) o inicial (solo atrás) inventaría una visual
  inexistente. Se añadieron dos `UPDATE` que vuelcan el tramo entero a la
  visual que la fila sí tiene.
- La petición **N5 resultó falsa** y se retiró: el generador de proyecto demo
  sí crea nivelación, delegada en `src/lib/demo/insertar-nivelacion.ts`. El
  grep que la originó buscaba «leveling» en `crear-proyecto-demo.ts`, que no la
  ve. Una petición basada en un grep negativo merece verificarse antes de
  convertirse en fase.

**Aprendizajes a llevar a fases siguientes:**

- **Persistir el dato que el usuario teclea, cuando existe uno derivado, deja
  la celda vacía justo en el caso que la fase vino a habilitar.** Los tres
  sitios de persistencia guardaban `draft.backDistanceM` — la distancia
  tecleada—, que en una captura por taquimetría es `null` porque la distancia
  sale de los hilos. El informe y el export leen la fila **sin recalcular**, así
  que habrían impreso una columna de distancias vacía en todo proceso capturado
  con hilos. **No lo vio ningún test**: lo destapó consultar la base después del
  seed. Se corrigió exponiendo la distancia resuelta en `ComputedReading`. Es la
  misma lección del cierre de la Fase 6 —todo lo que se persiste necesita un
  consumidor que lo lea sin recalcular— vista desde el otro lado: **cuando un
  valor pasa a derivarse, hay que revisar qué se persiste, no solo qué se
  calcula**.
- **Un seed puede contradecir sus propios datos, y la contradicción solo se ve
  en pantalla.** El seed declaraba los circuitos como nivel `digital` mientras
  escribía los tres hilos de cada visual. Un nivel digital entrega la distancia
  y no lee hilos: el conmutador de captura no aparecía sobre datos que sí los
  tenían. Ni el typecheck ni los 481 tests lo vieron; apareció al mirar la
  captura y preguntarse por qué faltaba el conmutador.
- **`w-full` en una tabla que crece comprime sus columnas en vez de hacer
  scroll.** Con las 13 columnas del modo automático, el encabezado «Cota
  corregida» salía cortado. `min-w-full` deja que la tabla crezca y que el
  contenedor haga el scroll. Medido: 1557 px de tabla en 942 de contenedor.
- **Una entrada inválida que deja de ser representable no elimina la
  protección, la muda de puerta.** Cinco tests inyectaban `totalDistanceKm:
  NaN`, campo que la fase elimina. Borrarlos habría perdido la cobertura; se
  reescribieron contra la única puerta que queda — una libreta sin distancias —
  y siguen protegiendo del «NaN mm» que la Fase 4 tuvo en pantalla.
- **Los fixtures antiguos se traducen, no se reescriben.** Once fixtures
  declaraban el acumulado a mano. Un helper que reparte el tramo entre las dos
  visuales conservó la geometría de cotas que las Fases 3-4 verificaron a mano,
  sin reintroducir un campo que el modelo ya no tiene.
- **Implementar una función y no cablearla pasa todos los controles.**
  `validateSightBalance` quedó definida, documentada y cubierta por tres
  tests… y no la llamaba nadie. El typecheck no lo ve (está exportada), el
  lint tampoco (se usa en los tests), y los 481 tests pasaban porque probaban
  la función **directamente**, nunca la ruta real. Lo destapó la revisión de
  rama con contexto fresco. La fase entera se justificaba en parte por pagar
  esa deuda, y habría cerrado sin pagarla: capturando dos distancias por visual
  que nadie compararía — exactamente el error de `distance_m` que la fase venía
  a eliminar, repetido. **Un test que ejercita la función y no la ruta no prueba
  que la funcionalidad exista.** Los tests del arreglo van por
  `validateRunCapture`, que es la puerta por la que pasan las filas de verdad.
- **Un pase de arreglos sin revisión propia introduce defectos nuevos.** La
  revisión del PR encontró tres defectos confirmados, y **los tres estaban en
  el código escrito para arreglar los hallazgos de la revisión anterior**: el
  paso 3 de la migración y el `nullif` salieron de aquel pase. La skill de
  ejecución dice que no se despacha re-revisión porque los tests que cubren
  cada arreglo ya responden «está atendido» — y es cierto que lo responden,
  pero no responden «¿el arreglo rompió otra cosa?». En una migración con SQL
  que duplica lógica del motor, esa pregunta hay que hacerla aparte.
- **Duplicar lógica del motor en SQL la condena a divergir.** El paso 3 sumaba
  las distancias de las filas `intermediate` mientras `accumulateDistances` las
  salta. Ninguna de las dos implementaciones es obviamente incorrecta leída
  sola; solo lo son juntas. Cuando una migración tiene que reproducir un
  cálculo del motor, el criterio de aceptación es que **el resultado coincida
  con el motor sobre un caso que ejercite la diferencia** — aquí, una libreta
  con radiación —, no que el SQL «haga lo mismo».
- **Revertir código para probar una migración se lleva por delante arreglos
  sin commitear.** Al volver a `8528bac` para sembrar datos pre-fase perdí un
  arreglo del motor hecho minutos antes. No lo noté al revertir; lo atrapó la
  suite al volver. **Commitear antes de revertir**, o el test que cubre el
  arreglo es lo único que lo salva.
- **Un `0` donde debería haber `null` pasa el validador.** Dos veces en la misma
  fase: `distanceFromWires` devolvía `0` con hilos iguales (y `0 ?? tecleada` es
  `0`, así que la distancia tecleada desaparecía), y el backfill escribía `0` en
  la visual atrás de la primera fila. Los validadores rechazan `null`, no `0`,
  así que ambos casos dejaban una visual de 0 m en silencio. **La ausencia de un
  dato se representa con `null`; un `0` es una medición, y afirma algo falso.**
- **Un `??` sobre una función que puede devolver `0` no es un fallback.** Es el
  mecanismo concreto del punto anterior y merece recordarse solo: `??` distingue
  `null`/`undefined`, no valores falsy. Si la función puede devolver `0`
  legítimamente inválido, tiene que devolver `null`.
- **Un `describe` que se evalúa antes que la función que usa da
  "Cannot access before initialization".** El helper nuevo se llamó `run`,
  nombre que el archivo ya usaba como variable local para el resultado de
  `computeRun`. Renombrarlo a `fromAccum` lo resolvió y además describe mejor
  lo que hace.

### Cierre Fase 10 — Nomenclatura de nivelación (2026-09-23)

Renombrado de superficie: `L.Atrás`/`L.Adelante` pasan a `V+`/`V−` en la tabla
de captura, el panel de resultados, los mensajes de validación, el Excel, el
manual y los comentarios. `backsight`/`foresight` no cambian en código ni en
base. Ninguna línea ejecutable; los 492 tests siguen siendo los mismos.

**Divergencias del PRD-de-fase respecto a lo implementado:**

- **El barrido de cierre del criterio 6 estaba mal en los dos sentidos.** Se
  quedaba corto porque buscaba las grafías viejas que el redactor tenía en
  mente (`L.At`, `ectura atrás`) y dejaba pasar `HS atrás`, `Dist atrás (m)`,
  `Atrás (m)`, seis `aria-label`, «mira de atrás» y la tabla de tipos del
  manual. Y se pasaba porque `ista atrás` coincide con la vista atrás de la
  **poligonal**, así que ni un renombrado completo lo habría dejado vacío.
  Se reescribió antes de tocar código: busca `atrás|adelante` sin más y
  excluye por texto los cuatro usos legítimos.
- A la lista de archivos le faltaban cuatro: `types/leveling.ts`,
  `validators/leveling.test.ts`, `tolerances.ts` y `types/settlement.ts`.
- El informe imprimible, uno de los seis consumidores, no pinta lecturas: no
  tenía nada que renombrar. Se miró igual.

**Aprendizajes a llevar a fases siguientes:**

- **Un barrido que enumera las grafías viejas solo encuentra las que el
  redactor recordaba.** Para un renombrado, el barrido tiene que buscar la
  raíz (`atrás`) y listar las excepciones, no listar las variantes. Y hay que
  correrlo **antes** de implementar: el primer resultado es el inventario real.
  Si da falsos positivos, el criterio «debe salir vacío» es incumplible y
  alguien acabará ignorándolo.
- **Una renumeración de fases caduca en todos los sitios que no se tocaron el
  mismo día.** La tabla de fases de `docs/tecnica/README.md` seguía en la
  numeración anterior a la del 2026-09-22 («9 · Canvas de poligonal»), y el
  cierre de la Fase 9 no lo vio porque buscó cifras y no nombres. Cuando cambia
  un número, el `grep` tiene que buscar **el nombre** de lo que ocupaba ese
  número. La misma búsqueda encontró «diecisiete capturas» donde hay diecinueve.
- **Mirar la captura contra la versión anterior separa lo que la fase cambió
  de lo que ya estaba.** El indicador «1 Issue» de Next aparece en todas las
  capturas del manual; comparar con el PNG commiteado mostró que venía de
  antes. Es la CSP sin `'unsafe-eval'` en desarrollo, inofensiva en
  producción, y quedó en la § 11 en vez de colarse como arreglo en una fase de
  rótulos.
- **`capturas.mjs` reescribe las diecinueve capturas, cambien o no.** Cuatro
  salieron distintas solo por la fecha del día. Se restauraron: solo se
  commitea la captura cuya pantalla tocó la fase.

### Cierre Fase 20 — Identidad visual del prototipo y coma decimal (2026-09-25)

La app adopta la identidad del prototipo de asentamientos —Barlow, papel y
tinta, acento mira— con modo oscuro, que sigue al sistema y se fuerza con un
selector; las celdas numéricas aceptan coma decimal. 774 → 817 tests.
Divergencias en el propio PRD.

**Aprendizajes a llevar a fases siguientes:**

- **La red de una migración masiva va con la migración, no después.** 800
  clases en 88 archivos se pasaron con un script de correspondencias, módulo a
  módulo. El test que prohíbe los tokens retirados encontró al escribirlo un
  `border-t-neutral-200` que el script no cubría (un borde con dirección). Sin
  el test, habría quedado un borde claro en el tema oscuro que nadie mira.
- **Una imposibilidad escrita en la doc hay que probarla.** La doc y
  `/design-system` decían que el contraste no podía ser un test «sin jsdom».
  Bastaba `fs` en el entorno `node`. La afirmación sobrevivió desde la primera
  versión del sistema de diseño porque nadie la intentó.
- **Mirar sigue encontrando lo que los tests no.** Con todo en verde —contraste
  en los dos temas, tokens, tipos—, las capturas mostraron dos fallos: la
  poligonal ajustada en el mismo tono que la sin compensar, y huecos dentro de
  las palabras con Barlow en Chromium. Es el aprendizaje de la Fase 7, otra vez.
- **Cambiar el tipo de una primitiva obliga a auditar a sus consumidores.**
  Pasar las celdas de `type="number"` a texto destapó cinco `Number()` sobre
  texto tecleado y unos umbrales que guardaban números en el estado: el
  navegador los había estado protegiendo. Es la lección de la Fase 8 sobre
  hacer editable lo que no lo era, desde el otro lado.
- **Cuando la salida no refleja un cambio, una sonda antes que una teoría.** El
  servidor de desarrollo se saltó una escritura de `globals.css`, y parecía que
  el compilador descartaba la regla. Una variable testigo junto a ella lo
  aclaró en un paso; probar el compilador por separado costó tres.

### Cierre Fase 19 — Equilibrado por armada y compensación desde el origen (2026-09-25)

El aviso de visuales desequilibradas compara las dos visuales de una armada
(N7) y la compensación usa la distancia desde el origen, así que el BM de
partida ya no se corrige (N8). Lo guardado se recalculó con una migración,
cerrados incluidos, por decisión del usuario. 765 → 774 tests. Divergencias
en el propio PRD.

**Aprendizajes a llevar a fases siguientes:**

- **Una fórmula verificada en una muestra no está verificada.** La resta del
  PRD coincidía con el motor en las 21 filas del seed y fallaba en 29 de 866
  comparaciones sobre la base completa: el acumulado y el total guardados
  vienen redondeados, y restar sobre ellos redondea dos veces. Un recálculo en
  SQL parte de los **datos medidos** (las distancias por visual), nunca de
  columnas derivadas, y se compara fila a fila contra el motor sobre todo lo
  que hay.
- **Antes de probar una migración de datos, foto de las filas.** `db reset`
  borra justo los datos de la regla vieja que la migración necesita. Con una
  copia en JSON de las columnas que toca, arreglar la migración y volver a
  probarla fue restaurar, desmarcarla en `schema_migrations` y aplicarla otra
  vez, sin perder la base.
- **Un fixture que codifica una convención esconde el fallo de esa
  convención.** `fromAccum` repartía cada tramo dentro de la misma fila, como
  el backfill de la Fase 9; con esa forma la regla vieja del acumulado cuadra
  por construcción, y N8 pasó de la Fase 9 a la 18 sin que un test lo viera. Los fixtures se escriben con
  la forma del dato real —aquí, la V+ de un punto y la V− del siguiente—, no
  con la del cálculo que prueban.
- **La hoja de campo es la especificación.** La regla de la armada no salió
  de discutirla: la hoja de El Verjón suma la V+ de una fila con la V− de la
  siguiente (`M4 = I3 + K6`). Leer las fórmulas de la cartera del usuario
  zanjó N7 antes de escribir código.

### Cierre Fase 18 — Libreta de nivelación y panel de asentamientos (2026-09-24)

La visita de asentamientos tiene su libreta de nivelación —digitada en vivo o
importada— y las cotas de los puntos de control salen de ella. El panel del
lugar y la vista de la visita siguen el prototipo del usuario. Una sola fase
por decisión del usuario, la más grande del proyecto. 687 → 765 tests.
Divergencias en el propio PRD.

**Aprendizajes a llevar a fases siguientes:**

- **Un estado que el seed no tiene esconde sus fallos.** El panel desbordaba a
  709 px en un teléfono por un texto `sr-only` absoluto que solo existe en una
  visita fuera de tolerancia. Torre Central no tiene ninguna, así que en ella
  todo medía 390 px. Es el aprendizaje de la Fase 5 —verificar sobre datos
  sembrados oculta el arranque en frío— visto desde el otro lado: el seed
  tiene que ejercitar **cada estado** de la pantalla, no solo el feliz. Por
  eso Torre Alameda trae una visita fuera de tolerancia a propósito.
- **Una copia en otro formato rompe la igualdad.** El BM del catálogo no se
  reconocía en la visita porque la copia guardaba `100.0000` y el catálogo
  entrega `100`. Los números se comparan como números, nunca como el texto con
  que alguien los formateó.
- **Un código es una etiqueta, no una clave.** Renombrar un punto deja su
  código viejo en las visitas cerradas, que son inmutables. La derivación y el
  renombrado funcionan por código porque así lo escribe el topógrafo, pero lo
  que **identifica** la fila —para resaltarla o para enlazarla— es `point_id`.
- **La captura en vivo tiene estados intermedios del dominio.** Una libreta a
  medias no es una libreta mal hecha: es la de alguien que todavía está
  midiendo. Tratarla como circuito cerrado daba un cierre de metros; como
  recorrido abierto, no hay cierre que decir. Diseñar para el dato terminado y
  olvidar el dato en curso es otra forma de verificar solo el camino feliz.
- **Generar hacia atrás preserva los escenarios.** El seed ya verificaba
  series concretas (bajas, altas, lecturas fuera de tendencia). Construir cada
  libreta desde la serie, en vez de inventar lecturas y aceptar la serie que
  saliera, dejó intactos esos escenarios y dio un test útil: la libreta
  reproduce la serie a 0.1 mm.
- **El despliegue no migra, y `db reset` no prueba una migración de datos.**
  Al integrar la fase, la nube llevaba ocho migraciones de atraso mientras
  `main` desplegaba el código que las necesitaba. Al empujarlas, la de la Fase
  7 chocó con el trigger de inmutabilidad (procesos cerrados reales) y la de
  la Fase 8 con una precisión mal escrita: dos fallos que `db reset` nunca
  enseña, porque aplica las migraciones antes de que existan datos. Una
  migración que toca filas se prueba sobre una base **con** datos —incluidos
  cerrados—, y cada merge a `main` que trae migración la empuja antes (§ 13 de
  la doc técnica).
- **Delegar piezas con archivos disjuntos funciona si nadie más commitea.**
  Las gráficas, el `Drawer` y la hoja del Excel se hicieron en paralelo. Los
  agentes no commitean; el que orquesta revisa y commitea. El precio: los
  errores de tipos de un trabajo a medias aparecen en el typecheck de todos, y
  hay que filtrar por archivo.

### Cierre Fase 17 — Control ida-vuelta por puntos homólogos (2026-09-24)

Cuando la ida y la vuelta pasan por los mismos puntos, el editor compara la
cota de cada uno en los dos recorridos. Informativo: el veredicto sigue siendo
la discrepancia de la sección. Con esta fase no quedan peticiones pendientes.
676 → 687 tests.

**Aprendizajes a llevar a fases siguientes:**

- **Un supuesto del PRD principal se desmiente con datos, no con
  argumentos.** La Fase 4 escribió que los puntos de cambio no se reocupan.
  Dos carteras de dos instrumentos lo contradicen; el § 6.9 se enmendó citando
  las carteras, y el razonamiento original —que reocupar debilita el doble
  recorrido— se conservó, porque sigue siendo cierto.
- **Una fase apoyada en la anterior hereda sus arreglos.** Los residuos del
  crudo solo salen bien porque la Fase 16 corrigió el arranque de la vuelta de
  una abierta; con el motor anterior, todos habrían salido desplazados
  1.16 m.
- **Rotular una equivalencia exige comprobar que se cumple en todos los
  tipos.** «El último residuo es la discrepancia» era cierto en las dos
  carteras, que son abiertas, y falso en una de enlace. Salió al escribir el
  test del caso que el PRD no había mirado.

### Cierre Fase 16 — Importar lecturas de nivel digital (2026-09-24)

La libreta de nivelación se puede importar del `.L` de un nivel digital Leica
o de una plantilla CSV propia, en el editor y al crear, con una
previsualización donde se elige cómo leer el recorrido y se corrigen los
tipos de punto. De paso se corrigió la vuelta de una nivelación abierta.
652 → 676 tests.

**Aprendizajes a llevar a fases siguientes:**

- **Un archivo real encuentra lo que los fixtures no.** Leer el crudo como
  ida y vuelta destapó que la vuelta de una abierta arrancaba en la cota de
  partida: un fallo del motor anterior a la fase, que ningún fixture cubría
  porque todos cerraban.
- **Los números esperados se calculan con la redondez del almacenamiento.**
  El análisis del crudo daba el desnivel con promedios sin redondear; el PRD
  los rehízo redondeando cada promedio a su columna, y los tests los
  reproducen exactos. Es la lección de la Fase 15 con la georreferenciación,
  en otro módulo.
- **Promediar en enteros evita el redondeo de coma flotante.** 1.64895 no es
  representable; 16489.5 décimas de mm sí, y redondea como se espera.
- **Una heurística se prueba con el caso más pequeño que la engaña.** La
  detección del giro acertaba con el crudo y fallaba con la propia plantilla
  de ejemplo, un circuito de dos armadas. Lo mostró la pantalla, no los
  tests: el test de la plantilla no preguntaba por el giro.
- **`open(...).read()` en Python normaliza los finales de línea.** Separar un
  CRLF tras leerlo en modo texto no encuentra nada; hay que abrir con
  `newline=""`. Costó un cálculo de verificación en blanco.

### Cierre Fase 15 — Georreferenciación de poligonales (2026-09-24)

Una poligonal medida en local se lleva al sistema real con dos de sus
estaciones, esté o no cerrada: se recalcula con la entrada girada y
trasladada, y la base admite en un cerrado solo las columnas de posición.
618 → 652 tests.

**Aprendizajes a llevar a fases siguientes:**

- **Una premisa heredada se comprueba con números antes de construir sobre
  ella.** La Fase 7 dejó escrito que girar y trasladar «deja invariante» lo
  que el cierre certifica. Es cierto para el veredicto, pero no para las
  coordenadas de Tránsito (2.66 mm en la Vivero). Lo reveló un cálculo de diez
  líneas al redactar el PRD, y cambió una decisión: recalcular, no rotar.
- **Simplificar a petición del usuario es un cambio de diseño, no un recorte.**
  Quitar la función de base y el historial dejó la excepción en una lista
  blanca de columnas. El PRD lo registró como riesgo aceptado —mover
  coordenadas de un cerrado por REST— en vez de dejarlo implícito.
- **Un trigger compartido no admite excepciones de una tabla.** La función de
  inmutabilidad de la cabecera la usaban cuatro tablas; la excepción obligó a
  darle a poligonal la suya. Antes de tocar una función de trigger, buscar
  todos sus `execute function`.
- **Un botón más en una cabecera se prueba a 390 px.** Nada falló en
  escritorio; la captura móvil del manual salió 160 px más ancha. Es la misma
  lección de la Fase 13 con el `viewBox`, en otro componente.
- **Los redondeos de almacenamiento marcan la tolerancia de las pruebas.**
  «Invariante a 1e-6 m» era falso con un arranque guardado a 0.1 mm. La
  tolerancia correcta sale de la resolución de la columna, no de la
  aritmética del motor.

### Cierre Fase 14 — Ajuste de poligonales por mínimos cuadrados (2026-09-23)

Cuarto método de corrección: ajuste por ecuaciones de condición con pesos
tecleados por proceso, como en la hoja de la universidad. El editor muestra
las correcciones por observación y σ₀; el informe y el Excel, los pesos y σ₀.
El veredicto no cambia con el método. 585 → 618 tests.

**Aprendizajes a llevar a fases siguientes:**

- **Un CHECK con una columna opcional hay que probarlo con `NULL`, contra la
  base.** `a > 0 and b > 0` parecía exigir los pesos, pero con uno en `NULL` la
  condición da `NULL` y PostgreSQL la da por cumplida. El SQL estaba en el PRD
  aprobado y los tests del motor no podían verlo: lo delató un `UPDATE` a mano
  al verificar en pantalla. **Toda restricción que dependa de columnas
  opcionales va con `coalesce(…, false)` o `is not null` explícito.**
- **Los valores esperados de una hoja de referencia se recalculan aparte.**
  El análisis de la hoja daba correcciones que heredaban su defecto en la
  conversión del azimut (hasta 2″). El PRD fijó un cálculo independiente y los
  tests lo reproducen al 0.001″; tomar la hoja como verdad habría sido
  codificar su error.
- **Una tolerancia numérica se elige con la escala de lo que mide.** 1e-12 σ
  pedía iteraciones que solo movían ruido de coma flotante. Se relajó a 1e-10
  mirando el tamaño real de las correcciones en radianes, y el criterio que
  importa —condiciones en cero— siguió en los tests.
- **Un `switch` de métodos con rama por defecto oculta el método nuevo.**
  `correctDeltas` habría tratado `least_squares` como Crandall sin error. Al
  añadir un valor a un enum, buscar cada sitio que lo discrimina, no solo los
  que fallan al compilar.
- **Un motor «total» deja de serlo con la primera rutina que lanza.** El
  ajuste llama a una resolución lineal que lanza con un sistema singular, y
  una abierta de un solo lado —un dato válido a medio capturar— tumbaba el
  editor. Lo encontró la revisión, no los tests: todos los casos de prueba
  tenían redundancia. **Al añadir una rama al motor, probarla con la entrada
  mínima que pasa los guardas de datos completos.**
- **Lo que no se persiste se recalcula por el mismo camino.** Correcciones y
  σ₀ salen de `polygonalInputOf` en el editor, el informe y el Excel. El
  módulo común que la Fase 13 creó para el dibujo pagó aquí su coste: dos
  consumidores nuevos sin una línea de reglas duplicada.

### Cierre Fase 13 — Dibujo de la poligonal y ángulos en decimal (2026-09-23)

El editor y el informe dibujan la poligonal a escala, con la sin compensar
exagerada ×k para que se vea un error de centímetros. Los ángulos se pueden
teclear en grados decimales con un conmutador que se recuerda por proceso,
mientras el almacenamiento sigue en DMS. 557 → 584 tests.

**Aprendizajes a llevar a fases siguientes:**

- **Medir con los datos reales antes de diseñar una visualización.** «Original
  frente a ajustada» parecía una especificación completa y era invisible:
  1,6 cm sobre 42 m son 0,2 px. Lo reveló consultar el error y la extensión en
  la base antes de escribir el PRD, y el factor de exageración salió de ahí.
  Los factores de la tabla del PRD pasaron a tests tal cual.
- **Un SVG con `viewBox` fijo se ve bien en escritorio y roto en un teléfono.**
  Nada falla: el texto se encoge proporcionalmente hasta 4 px. Solo lo delató
  mirar la captura móvil del manual. **Todo lo que dibuje texto dentro de un
  `viewBox` hay que mirarlo a 390 px.**
- **Una regla escrita no protege si nadie la comprueba al añadir código.** La
  § 8 prohíbe que el sistema de diseño conozca el dominio, y `AngleInput` la
  incumplió sin que nada lo notara. El `grep` que lo confirmó encontró tres
  componentes que ya la incumplían desde antes. La regla dice ser
  «verificable leyendo los imports», pero nadie la verificaba. Quedó en la
  § 11.
- **Si la lógica vive en un componente de cliente, el servidor no puede
  usarla.** El informe necesitaba la misma construcción de la entrada que el
  editor, y estaba dentro de un archivo `"use client"`. La alternativa era una
  segunda copia de las reglas (orientación, fila de cierre, promedio de
  lecturas) que podía divergir. **Moverla a un módulo común antes de usarla**
  cuesta un refactor sin cambios y evita esa divergencia.
- **Los metadatos de las capturas caducan igual que los recuentos.** Nueve
  entradas de `CAPTURAS` tenían un ancho o alto distinto de su PNG, seis de
  ellas desde fases anteriores. Se sincronizaron leyendo los PNG. Es la misma
  lección de la Fase 11 con la tabla de pruebas: lo que describe un artefacto
  generado se regenera desde el artefacto.

### Cierre Fase 12 — Alerta por lectura desfasada (2026-09-23)

Aviso, sin bloqueo, cuando una lectura va contra la tendencia de su punto o la
supera más del doble. El margen sale del orden de la visita. 529 → 556 tests.
Sin migración.

**Aprendizajes a llevar a fases siguientes:**

- **Una regla estadística se prueba contra series reales antes de
  escribirla en el PRD.** El criterio obvio —extrapolar la velocidad
  anterior— parecía correcto y marcaba como error una lectura correcta del
  punto más crítico del seed. Lo delató correr la regla, en el propio PRD,
  sobre P-09 y las series del seed. Esas series pasaron a ser tests de
  regresión con los cuatro márgenes: una regla que avisa de más deja de
  leerse, y ese fallo no lo detecta ningún test que no use datos reales.
- **Un dato de verificación que depende del orden de las pruebas oculta
  defectos.** `capturas.mjs` elegía «el» proceso cerrado sin filtrar por
  proyecto. Funcionó mientras nadie iniciaba sesión antes de capturar. Al
  verificar en pantalla, el login creó el «Proyecto de ejemplo» con su propio
  proceso cerrado, y la captura 09 salió como «Proyecto no encontrado». **Una
  consulta que espera una fila tiene que filtrar hasta que solo pueda haber
  una.**
- **El entorno también se verifica.** Media sesión se fue en que Docker
  Desktop se quedó con el socket del motor nativo: `docker ps` vacío con la
  base viva. El diagnóstico está ahora en la § 2 de la doc técnica. **Antes de
  verificar una fase, comprobar que `docker ps` lista el stack** en vez de
  asumir que el CLI ve lo que responde en los puertos.

### Cierre Fase 11 — Estado de los BMs (2026-09-23)

Los puntos de asentamiento tienen vigencia: se dan de baja sin borrar su
historia y de alta a mitad del monitoreo, con la primera lectura como línea
base. Tres triggers impiden que una lectura quede fuera de la vigencia de su
punto. 492 → 529 tests.

**Divergencias del PRD-de-fase:** están en su cabecera. Las dos que importan
son la corrección de la tabla de diferenciales y el defecto anterior de
`readingChanged`, ambas abajo.

**Aprendizajes a llevar a fases siguientes:**

- **Un número correcto al lado de dos números que no lo explican es un
  defecto.** El motor calculaba bien el diferencial sobre el periodo común,
  y los 37 tests nuevos lo confirmaban. Pero la tabla seguía poniendo al lado
  los acumulados de cada punto, y P-01 − P-07 se leía «−8,5 y −5,0 →
  diferencial 2,2». Ningún test miraba qué columnas acompañan al resultado;
  lo vio la captura. **Cuando un cálculo cambia de definición, hay que revisar
  qué se muestra junto a él, no solo el valor.** Es la misma mezcla de
  periodos que la fase venía a quitar, trasladada a la presentación.
- **Un script que informa «cuántos» es el primer test real de su
  comparación.** `readingChanged` llevaba desde la Fase 6 dando por cambiada
  toda lectura abierta, porque comparaba la velocidad sin redondear del motor
  con un `DECIMAL(8,2)`. No corrompía nada —reescribía los mismos valores—, y
  por eso ni los tests ni la pantalla lo delataban. Lo destapó simular el
  script sobre un lugar recién sembrado: 31 lecturas «a reescribir» donde
  debía haber 0. **Una comparación contra un valor persistido tiene que
  hacerse a la precisión de la columna**, y un «0 esperado» es una prueba
  barata de que lo está.
- **La revisión del PRD volvió a encontrar más que la del código.** Tres
  defectos antes de escribir una línea: una fórmula que mezclaba periodos
  para un caso límite, un trigger que cubría una de tres escrituras y una
  línea base que podía moverse bajo una visita cerrada. El tercero lo arregló
  una regla que no estaba en el borrador. Al aplicarlo apareció que la
  alternativa propuesta en la revisión tampoco bastaba: cerrar después la
  visita anterior habría movido la línea base otra vez. **Una solución a un
  hallazgo de revisión también hay que recorrerla contra el invariante**, no
  solo contra el caso que la motivó.
- **Un CHECK en la base convierte una decisión del PRD en un hecho.** «Un
  punto de alta no lleva C0» vivía en la acción y en el formulario. El motor
  dependía de ella sin saberlo: fecha la C0 en la visita 0. Añadir el CHECK
  costó una línea y lo probó el mismo SQL de verificación que los triggers.
- **Un trigger nuevo cambia el orden en que se pueden hacer las escrituras
  que ya existían.** La revisión del PR encontró que `saveVisitAction`
  escribía la fecha de la visita antes de borrar las lecturas quitadas, y el
  trigger de vigencia rechazaba justo el flujo que el editor proponía: mover
  la fecha y quitar en el mismo guardado la lectura del punto que salía de
  vigencia. Los tests de validadores pasaban, porque el validador ve el estado
  final. El trigger ve cada escritura por separado. **Al añadir una
  restricción de base, hay que recorrer en orden cada escritura de las
  acciones que tocan esas tablas**, no solo comprobar que el estado final es
  válido.
- **Tablas de recuentos por archivo: se reescriben desde la ejecución, no se
  editan.** La tabla de pruebas de la doc técnica sumaba 453 mientras
  afirmaba 492: las Fases 7 a 9 subieron el total y no las filas. Se
  regeneró desde `vitest --reporter=json`. El `grep` de cifras del cierre
  encuentra el total; las filas solo cuadran si se recalculan.

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

### Cierre Fase 7 — Motor y captura de poligonales (2026-09-17)

**Divergencias del PRD-de-fase respecto a lo implementado:**

- El PRD daba por bueno el Tránsito de la hoja `TRANSITO` comparando la forma de la fórmula sin verificar el cierre. La hoja reparte proporcional a la proyección **con signo**, y como `ΣΔN` es el propio error de cierre las correcciones se cancelan: deja el error entero sin corregir. De las tres hojas del Excel solo `BRUJULA` está bien. El criterio de aceptación pasó de «reproduce la hoja» a «cierra a cero».
- El PRD modelaba un solo esquema de cierre. Al transcribir la segunda cartera apareció otro: la Vivero cierra contra el **primer lado**, no contra el amarre. Se cubrieron ambos haciendo opcional la fila de cierre, sin enum adicional.
- Faltaba la columna `has_closing_row`. Se añadió editando la migración en sitio, viable porque nunca salió de local.

**Aprendizajes a llevar a fases siguientes:**

- **`create or replace function` pisa en silencio una función homónima de otro módulo.** La migración definió `reject_write_on_closed_process_reading()`, nombre que ya existía desde `20260812020455_leveling.sql` con la misma firma. El trigger de nivelación quedó ejecutando el cuerpo de poligonal y buscando un `station_id` que `leveling_readings` no tiene. Ningún test lo vio; lo destapó el seed al llegar al circuito de nivelación. **Antes de crear una función en una migración, hacer `grep` del nombre en `supabase/migrations/`.**
- **Correr la app encuentra lo que los tests no.** `expectStationCapture` recibió el parámetro `hasClosingRow` en la tarea 5 y el editor nunca se lo pasó: la fila de cierre marcaba error y dejaba Guardar deshabilitado, o sea que una cartera amarrada no se podía guardar. Los 417 tests pasaban porque el validador se prueba directamente, con el parámetro puesto a mano. Solo apareció al abrir la pantalla y mirarla. **Una fase que toca UI no se cierra sin levantarla y capturar.**
- **Un fallo silencioso es peor que uno ruidoso.** El bug de convención que originó la fase no rompía nada: el error de cierre y la precisión relativa salían casi iguales en las dos convenciones, así que la app informaba «cumple 1:7036» sobre coordenadas espejadas. Cuando un indicador no distingue dos situaciones que sí difieren, el indicador está incompleto. De ahí que `angle_type` se elija sin preselección: adivinar reintroduce el mismo fallo.
- **Los datos reales valen más que los sintéticos.** Los fixtures de las fases 3 a 6 —cuadrados perfectos, pentágonos del marco teórico— cierran bajo cualquiera de las dos convenciones, por eso el bug sobrevivió cuatro fases. Dos carteras de campo con esquemas distintos lo destaparon en una tarde, y la segunda encontró además un bug de perímetro que la primera no podía encontrar.
- **Un campo capturado que nadie lee es una pregunta sin responder.** `projects.angular_precision_seconds` se captura desde la Fase 2 y hasta ahora solo se mostraba en la ficha. Ahora gobierna la dispersión entre lecturas. Conviene revisar qué otros campos están en ese estado.

### Cierre Fase 8 — Precisión y equipo por proceso (2026-09-18)

**Divergencias del PRD-de-fase respecto a lo implementado:**

- El PRD (sección «Informes y exportación» y criterio de aceptación `l`) habla de «los cuatro workbooks» de `src/lib/export/`. Solo hay tres: `polygonal-workbook.ts`, `leveling-workbook.ts`, `settlement-workbook.ts` — verificado contra el directorio y contra los exports (`buildPolygonalWorkbook`, `buildLevelingWorkbook`, `buildSettlementWorkbook`). Es un desliz de conteo en la propia redacción del PRD, no un módulo que faltara por tocar: los tres exportan el equipo del proceso.
- El backfill necesitó desactivar dos triggers de `settlement_visits` que el encargo original no nombraba. La tabla dispara tanto por visita cerrada (`settlement_visits_reject_update_on_closed`) como por *lugar* cerrado (`settlement_visits_reject_write_when_site_closed`), y cualquiera de los dos aborta el `UPDATE` del backfill si existe una visita o un lugar cerrado antes de aplicar la migración. Se corrigió antes de fusionar, verificado con un fixture real de visita cerrada y, por separado, de lugar cerrado — no había datos así en el seed de entonces, así que el defecto no se habría visto sin construir el caso a mano.

**Aprendizajes a llevar a fases siguientes:**

- **Un `Omit` sobre una columna que ya no existe es un no-op, y la intersección que sigue lo vuelve a poner: el tipo INVENTA el campo.** `Project`, en `src/types/project.ts`, intersectaba `precision_order: PrecisionOrder` sobre `Omit<Tables<"projects">, "precision_order" | "status">`, pero la migración de esta misma fase ya había borrado esa columna de `projects`. El `Omit` no quitaba nada — no había nada que quitar —, y la intersección volvía a añadir el campo sin que viniera de ningún lado: el tipo compilaba, `project.precision_order` type-checkeaba, y en producción era `undefined`. Quitar el campo fabricado hizo que el typecheck **subiera** de 12 a 17 errores: los cinco nuevos eran consumidores reales que el campo inventado llevaba escondiendo. Un `Omit` sobre una columna eliminada hay que verificarlo contra `database.ts`, nunca asumirlo por el nombre — y una corrección de tipos que sube el conteo de errores no es un paso atrás, es el conteo real saliendo a la luz.
- **Hacer editable un valor que antes era de solo lectura obliga a auditar a todos sus consumidores, no solo al que motivó el cambio.** Al añadir el selector de orden a los editores de poligonal y nivelación, el veredicto de cierre de ambos seguía leyendo un `precisionOrder` congelado en la carga de la página, mientras el selector nuevo editaba `config.precisionOrder` en vivo: la pantalla podía mostrar dos órdenes distintos a la vez, con el veredicto de cierre —el lado tranquilizador— mostrando el viejo. El de nivelación se corrigió dentro de la misma tarea que lo introdujo, citando el fix de poligonal como precedente; el de asentamientos se revisó por separado y se confirmó que no aplicaba, porque su orden no alimenta ningún cálculo de cierre. La lección no es «los editores tenían el bug»: es que cada consumidor se revisó uno por uno, y dos de los tres sí lo tenían.
- **Duplicar un proceso que no copia todos sus campos falla hacia el lado permisivo, y en silencio.** `duplicatePolygonalProcessAction` no copiaba precisión ni equipo al proceso nuevo: el duplicado nacía con el default `tercer_orden` y sin equipo. Un proceso de primer orden duplicado volvía como tercer orden —la tolerancia más laxa de las cuatro— sin ningún aviso ni error. Cuando duplicar toca muchos campos, la prueba correcta no es «compila y guarda»: es una lista explícita de qué se copia y qué no.
- **Un `as unknown as` no tapa un error de tipos: tapa la ausencia de una columna.** `settlement-workbook.ts` seguía declarando `VisitRow.equipment` después de que la migración la eliminara (se migró a `equipment_model`); la ruta de exportación hacía `visits as unknown as VisitRow[]` para que compilara igual. El resultado no era un error de compilación: era una celda «Equipo» vacía en el Excel de cada asentamiento, en cualquier estado, sin que nada lo señalara. Un `as unknown as` sobre un dato que sale de Supabase merece la misma sospecha que un `any`.
- **En un proyecto sobre trazabilidad de mediciones, el catálogo de equipos del seed también hay que verificarlo, no solo generarlo.** El seed nombraba modelos reales —Leica TS06 Plus, Trimble S9, Trimble/Zeiss DiNi 12— con cifras que no correspondían a su ficha técnica: el DiNi 12 sembrado a 1.5 mm/km declaraba una precisión que ese nivel no tiene (su cifra ISO 17123-2 real es 0.3 mm/km con mira de ínvar, 1.0 mm/km con mira corriente). Nombrar un instrumento real sin verificar su especificación es peor que inventar un nombre genérico, precisamente en una aplicación cuyo tema es la trazabilidad de la medición.
