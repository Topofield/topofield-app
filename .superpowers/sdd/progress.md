# Progreso — Listado único de procesos

Plan: `docs/plans/2026-07-27-listado-procesos.md`
Spec: `docs/specs/2026-07-27-listado-procesos-design.md`
Rama: `feat/listado-procesos`
Base de rama: 891e1fb

Rondas anteriores, ya fusionadas a `main`: `ronda1-review-uiux/`,
`ronda2-navegacion/`.

## Tareas

- [x] Tarea 1: Lógica de filtrado y ordenamiento
- [x] Tarea 2: Fecha relativa
- [x] Tarea 3: Barra de control
- [x] Tarea 4: Tabla de procesos
- [x] Tarea 5: Integrar en el hub
- [x] Tarea 6: Acciones rápidas por fila
- [x] Tarea 7: Persistencia de filtros
- [x] Tarea 8: Verificación final y documentación

## Datos del entorno

- Credenciales: seed@topofield.local / seed1234
- Los IDs de proyecto y proceso cambian con cada `db reset`; consultarlos en la DB.
- Tras `db reset` puede hacer falta reaplicar los GRANTs a anon/authenticated/service_role.
- Suite al inicio de la ronda: 76 tests. Proyectada al final: 106.

## Hallazgos menores (para la revisión final)

- **`compareValues` declarada dentro de `filterProcesses`** (Minor, Tarea 1). Es una
  closure interna, mientras `normalize` y `matchesStatus` están a nivel de módulo.
  Inconsistencia estilística, sin efecto en corrección ni rendimiento a esta escala.

## Hallazgos menores adicionales

- **`Badge` tono success sigue en 4.20:1** (texto de 12px sobre fondo al 10%). Fuera del
  alcance aprobado; deuda conocida para cuando se revise `Badge` en general.
- **`SortLink` y `SortableHeader` duplican el cálculo de `activa`/`dir`** en
  `process-table.tsx`. Funciona; oportunidad de simplificación.

## Verificación pendiente para la Tarea 5

- **Comportamiento del buscador en el hub real.** El implementador verificó con
  Playwright que teclear no satura el historial, que los chips sí añaden entrada y que
  «Limpiar filtros» vacía el campo. El controlador no logró reproducirlo con rutas
  temporales: el patrón de `key` cambiante desprende el input del DOM entre teclas y el
  dev server de Turbopack se corrompió a mitad (se reinició limpiando `.next`).
  **Al integrar en la Tarea 5, verificar en el hub real:** delta de `history.length` al
  teclear (debe ser 0 o 1, no 8), que «Limpiar filtros» vacía el campo, y que tecleando
  rápido no se pierden caracteres ni el foco.
- **`aria-sort` en DOM vivo.** Verificado por lectura estática en la Tarea 4, porque la
  tabla no estaba montada. Confirmar en el hub real que el `<th>` de la columna activa
  expone `aria-sort` y las inactivas no.

## Registro
- Tarea 1: completa (commits cc54f01..8bdb77d, revisión limpia tras un ciclo de fix —
  brief ✅, calidad aprobada). HALLAZGO IMPORTANTE del revisor: el comparador hacía
  `Infinity - Infinity` = NaN, y sort con NaN es comportamiento no especificado por
  ECMA-262. NO era teórico: el seed tiene 2 procesos con `1:∞`. Corregido con
  comparación por signo y desempate por id. Verificado por el controlador con 50
  ordenaciones invirtiendo la entrada: resultado idéntico. Suite 76 → 104.
  NOTA: el plan decía «22 tests» en la Tarea 1; el código del brief tenía 23.
- Tarea 2: completa (commits 1e692a5..263325f, revisión limpia tras un ciclo de fix —
  brief ✅, calidad aprobada). Hallazgo Important, también de código prescrito por el
  plan: las fronteras daban «hace 4 semanas» (días 28-29) y «hace 12 meses» (363-364).
  Corregido con umbrales < 28 / < 360 más Math.max(1, floor(...)); mover solo el umbral
  no bastaba porque floor(28/30)=0. Verificado por controlador y revisor con barridos de
  1000 y 1500 días: cero anomalías. Suite 104 → 117.
- Tarea 3: completa (commits 042d9b7..6a416a1, revisión limpia tras un ciclo de fix —
  brief ✅, calidad aprobada). Dos hallazgos Important: (1) router.push en cada tecleo
  saturaba el historial —medido: 8 letras = 8 entradas de «atrás»—, corregido con
  replace para el buscador y push para clics; (2) aria-pressed no comunicaba
  exclusividad, unificado a aria-current como dashboard-filter.tsx. Minor: el campo no
  se vaciaba al limpiar, resuelto con contador de generación en la key.
  El revisor confirma que el setState durante el render es el patrón oficial de React 19
  para «adjusting state when a prop changes», sin bucle ni render extra visible.
- CORRECCIÓN TRANSVERSAL (commit 2545498): --color-primary-500 pasó de #1a7fb5 a #187aae.
  El anterior daba 4.42:1 con texto blanco, bajo el mínimo AA de 4.5:1, y afectaba a
  TODOS los botones primarios de la app, no solo al chip nuevo. Ahora 4.74:1.
  Detectado por el implementador de la Tarea 3, aprobado por el humano.
- Tarea 4: completa (commits f529cf9..f5bd975, revisión limpia tras un ciclo de fix —
  brief ✅, calidad aprobada). Dos hallazgos Important: aria-sort estaba en el <Link>
  en vez del <th> (corregido con SortableHeader), y contraste insuficiente en los
  colores de estado.
- CORRECCIÓN TRANSVERSAL 2 (commits 72b6177, f5bd975): success-500 #27ae60 → #1a7a42 y
  danger-500 #e74c3c → #c0392b. Los anteriores daban 2.87:1 y 3.82:1 sobre blanco,
  afectando al veredicto de cierre y a TODOS los errores de formulario.
  El implementador reportó que el primer valor aprobado del verde (#1d8348) seguía
  fallando sobre fondos teñidos (4.21:1 en badge al 10%); el controlador lo verificó y
  ajustó a #1a7a42, que cumple en los tres contextos (5.38 / 4.69 / 5.02).
  El revisor confirmó además que Alert queda cubierto y que semaphore-* no se usa como texto.
- Tarea 5: completa (commit 5befdcf, revisión limpia SIN ciclo de fix — brief ✅,
  calidad aprobada sin hallazgos). El listado único ya funciona en el hub.
  VERIFICACIONES PENDIENTES CERRADAS por el controlador contra la app real:
  delta de historial 0 al teclear 8 letras (antes 8) · «Limpiar filtros» vacía el campo
  · aria-current en el chip activo · aria-sort solo en el <th> de la columna activa
  · orden numérico correcto (—, 1:46, 1:1001, 1:1001, 1:528479954, 1:∞, 1:∞)
  · 390px: 7 tarjetas, sin tabla, sin desbordamiento.
  NOTA DE ENTORNO: el dev server del puerto 3000 tiene la caché de Turbopack corrupta;
  usar http://localhost:3001 para las verificaciones restantes.
- Tarea 6: completa (commits 56f34da..0cac59d, revisión limpia tras un ciclo de fix —
  brief ✅, calidad aprobada). Cuatro hallazgos Important, todos del código del brief:
  duplicar fallaba en silencio (sin modal donde mostrar el error), errores sin role=alert,
  botones sin nombre accesible por fila, y notes no se copiaba al duplicar.
  INMUTABILIDAD VERIFICADA EN LAS TRES CAPAS por controlador y revisor: interfaz muestra
  solo «Duplicar» en cerrado y rechazado · Server Actions rechazan antes de tocar la base
  · triggers bloquean UPDATE y DELETE. La whitelist de duplicar excluye correctamente
  todos los campos de veredicto; solo se añadió notes.
- Tarea 7: completa (commits 824272d..HEAD, revisión limpia tras dos ciclos de fix —
  brief ✅, calidad aprobada). El implementador encontró un bug que el plan no previó:
  el efecto de persistencia pisaba localStorage antes de que la restauración lo leyera,
  así que el filtro NUNCA se restauraba. Lo resolvió reordenando los efectos; el revisor
  propuso además no guardar el filtro por defecto (con removeItem, para que «Limpiar»
  siga significando olvidar). En la segunda revisión detectó que los comentarios
  afirmaban una independencia del orden que no existe —invertirlos reintroduce el bug
  vía removeItem— y el controlador los corrigió para que adviertan de no reordenar.
  Verificado sin regresión: (a) restaura Cerrados · (b) URL explícita manda · (c) limpiar
  vuelve a Todos · (d) sin bucle de navegación.
- Tarea 8: completa (verificación y documentación por el controlador).
  typecheck, lint, test (117/117) y build limpios. Los 13 criterios verificados
  contra la app real. NOTA: el criterio 10 pareció fallar (aria-sort ascending por
  defecto) pero era el filtro persistido de pruebas previas; con localStorage limpio
  da descending, que es lo correcto — la persistencia funcionando.
  Datos del seed restaurados a los 7 fixtures originales tras las pruebas.
  Manual y doc técnica actualizados; capturas regeneradas.

## Revisión final de rama (opus) + correcciones

Veredicto: lista para integrar, sin hallazgos Critical. INMUTABILIDAD VERIFICADA con
seis vectores de ataque directo a la base (UPDATE, DELETE, reapertura de rejected, y
las tres operaciones sobre estaciones), todos rechazados; el control sobre un proceso
calculated pasó. La whitelist de duplicar excluye correctamente todos los campos de
veredicto.

Dos correcciones aprobadas por el humano y aplicadas:
- 43bc2fa: la tarjeta móvil mostraba created_at mientras la tabla mostraba updated_at
  —dos fechas distintas para el mismo proceso según el ancho— y no tenía el semáforo
  de tolerancia, que es justo lo que motivó la spec. Alineada con la tabla.
- eeb2842: warning-500 #f39c12 → #8a5806. Daba 2.19:1 como texto, muy bajo AA.
  Deuda preexistente que afectaba al badge «Cerrado fuera de tolerancia».
  Con esto los CUATRO tokens de color de la paleta cumplen AA.

## Deuda registrada para la fase 4

- Acciones por fila ausentes en móvil: la tarjeta es un <Link> que envuelve todo, y un
  botón dentro de un ancla es HTML inválido. Requiere reestructurarla.
- Los chips de estado usan <button> + router.push mientras dashboard-filter.tsx usa
  <Link> para el mismo problema. Converger a enlaces simplificaría el componente.
- Los filtros del listado se propagan a las otras pestañas (?estado=cerrados&tab=config).
  Preexistente de Tabs, pero se agrava con más pestañas y filtros.
- process-list.ts está tipado contra PolygonalProcess; nivelación y asentamientos
  necesitarán genéricos o un tipo base común.
- compareValues declarada dentro de filterProcesses; SortLink/SortableHeader duplican
  el cálculo de activa/dir.
- Semáforo de asentamientos: los cuatro tokens se oscurecieron para cumplir 3:1
  como indicador gráfico (fase de estabilización del sistema de diseño). El
  efecto colateral medido es que quedan a luminancia parecida y los niveles
  contiguos se separan poco: verde/amarillo 1.18, amarillo/naranja 1.15,
  naranja/rojo 1.01. No se pierde información —el semáforo siempre lleva texto,
  por la regla de que el color nunca es el único canal— pero de un vistazo se
  distinguen peor. Si al construir el módulo de asentamientos la lectura rápida
  resulta insuficiente, la alternativa es volver a los rellenos vivos añadiendo
  cuatro tokens de anillo oscuro (#0f5c2e, #7a6207, #8a4a0c, #8f2418, todos
  ≥5.8:1 sobre blanco), que aportan el límite sin tocar el tono.
