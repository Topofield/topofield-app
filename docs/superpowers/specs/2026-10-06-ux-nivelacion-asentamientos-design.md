# Rediseño de la UX de nivelación y asentamientos — diseño

**Fecha:** 2026-10-06
**Estado:** aprobado como hoja de ruta. Los lienzos se ajustan al verlos.
**Petición:** del usuario, 2026-10-06, con la Fase 35 ya en producción:
«podemos aplazar la siguiente fase, y mejor haz un plan para que repliquemos
este modelo de ux/ui para el caso de nivelaciones y control de asentamientos,
replicando lo que hicimos para refinar el diseño en el módulo de poligonales».
Sobre los lienzos: «por ahora sí, al verlos visualmente ajustamos».

Este documento es la hoja de ruta de dos fases. No es su PRD: cada fase
redacta el suyo en `docs/prds/` cuando el lienzo esté aprobado, como manda
[`method.md`](../../method.md).

## Decisiones tomadas

| # | Decisión | Por qué |
|---|---|---|
| 1 | **Dos fases, una por módulo, y nivelación primero** | La visita de asentamientos usa la libreta, el selector de BM y la importación de la nivelación (`ReadingsTable`, `BmSelector`, `RunPreview`). Rediseñada primero la captura de la nivelación, la visita la hereda |
| 2 | **El cierre se quita en los dos módulos**, como en la poligonal | Decisión del usuario: un solo modelo en toda la app. Nivelaciones, visitas y lugares siempre editables; los consolidados los incluyen calculados |
| 3 | **Los lienzos se proponen sin una descripción previa del usuario**, guiados por cómo trabajan las carteras de Excel | Decisión del usuario. Ejemplo suyo: en la nivelación, el gráfico de al lado puede dibujar el recorrido |
| 4 | **La cartera real de asentamientos entra en la fase de UX de asentamientos** | Decisión del usuario. Es la referencia del diseño de la visita y entra a la demo y al seed en la misma fase. Era la Fase 36 aplazada |
| 5 | **Lo común se extrae en la fase de nivelación**: la cabecera, los pasos y los popups de la poligonal pasan a componentes compartidos | Decisión del usuario. Se extrae cuando aparece el segundo módulo que los usa. La poligonal no cambia nada visible y asentamientos los hereda |

## Hoja de ruta

| Fase | Nombre | PRD | Rama |
|---|---|---|---|
| **36** | La nivelación como la mide el topógrafo | `prds/35-ux-nivelacion.md` | `fase-36-ux-nivelacion` |
| **37** | Los asentamientos como los mide el topógrafo | `prds/36-ux-asentamientos.md` | `fase-37-ux-asentamientos` |

- La 37 empieza cuando la 36 esté **integrada y desplegada**: usa su captura y
  sus componentes comunes.
- Al terminar la 37 **ningún módulo se cierra**. Desaparecen del todo
  «Reabrir» (Fase 34) y las funciones de inmutabilidad compartidas
  (`reject_update_on_closed_process`, `reject_delete_on_closed_process`,
  `is_reopening`). Las borra el paso 2 de la migración de la 37, porque hasta
  entonces asentamientos las sigue usando.
- Los informes emitidos **no cambian**: `reports` sigue sin admitir `UPDATE` y
  guarda su portada. Lo que deja de existir es el cierre de los procesos.

## La receta de cada fase

La misma que refinó la poligonal en la Fase 35:

| Etapa | Qué se hace | Qué deja | Quién da el visto bueno |
|---|---|---|---|
| 1 · Revisión | La pantalla actual (capturas), el código —qué entra en un cálculo y qué solo se muestra— y la cartera real | Los «Hallazgos», como los nueve de la poligonal | — |
| 2 · Lienzo | Maquetas en un lienzo como «Poligonal — rediseño de la UX», con los datos de la cartera real, variantes A/B de cada superficie clave y su versión móvil | El lienzo publicado | — |
| 3 · Revisión del lienzo | El usuario elige variantes y corrige sobre las maquetas, como con «Alta A, Datos A, Medición B», hasta aprobarlas | Las elecciones, anotadas | El usuario |
| 4 · PRD de la fase | Hallazgos, decisiones, alcance, criterios, pruebas, despliegue y riesgos. Su commit abre la fase | `docs/prds/NN-<slug>.md` | El usuario |
| 5 · Plan y ejecución | El plan de implementación (`docs/superpowers/plans/`), las pruebas primero, la verificación en pantalla con Playwright y la revisión de toda la rama | El código, con sus pruebas | El usuario elige cómo se ejecuta |
| 6 · Cierre | El manual en sus dos copias, las capturas, la doc técnica, los fundamentos de `docs/math/` y las divergencias en el PRD | La documentación al día | — |
| 7 · Despliegue | Paso 1 de la migración; PR y merge; Vercel en producción; paso 2; y la comparación de producción contra la cartera con el motor de la app | Las dos fases en producción, comparadas con sus carteras | El usuario, antes de cada `db push` |

## El modelo que se replica

Lo que la Fase 35 dejó en la poligonal:

- **Alta en popup** con lo que el topógrafo sabe al empezar. El equipo va
  plegado y queda en marca, modelo y n.º de serie, con «Tomar del catálogo».
- **Pantalla por pasos** con una cabecera en tarjeta: la tabla al estilo de la
  hoja y, fijo al lado, el gráfico. En el teléfono, un selector Tabla | Gráfico.
- **Captura por popups, sin botón Guardar:** cada popup guarda al confirmar,
  con la carga completa. Un fallo de red se queda en el popup (`callAction`).
- **Lo que se puede detectar no se pide:** el orden de precisión sale del
  resultado.
- **Un informe que explica el cálculo**, con las fórmulas en MathML.
- **Sin cierre:** siempre se puede modificar.

## Lo común que se extrae (Fase 36)

Candidatos, de `src/components/polygonal/`. El PRD de la 36 fija qué se
extrae y con qué nombre:

- La cabecera en tarjeta, con «Editar datos», «Guardado …» (`formatSavedAt`)
  y el botón de imprimir (`polygonal-header.tsx`).
- La barra de pasos con su selector de formato.
- El patrón del popup que guarda al confirmar: `callAction`, el error dentro
  del popup y el borrador guardado hasta que cambia `updated_at`
  (`use-polygonal-draft.ts`).

`ProcessShell` lo sigue usando asentamientos hasta la 37.

## Fase 36 — La nivelación como la mide el topógrafo

### Punto de partida

**Hallazgos preliminares de la revisión del 2026-10-06.** El PRD los confirma:

1. **El orden de precisión se puede detectar.** Es el más alto con |e| ≤ K·√D
   en la ida y en la vuelta (K = 3, 6, 12 y 24 mm). En la abierta con vuelta,
   la discrepancia frente a K·√D. Ejemplos:
   - El Verjón (Δ 5.0 mm sobre 0.3843 km) alcanza **segundo orden**.
   - El tramo 2 del nivel digital (0.2 mm en 1.397 km) alcanza **primer
     orden**.
   - La abierta sin vuelta no tiene orden.
2. **El orden decide hoy si se compensa** (`leveling.ts:385-389`): solo se
   compensa lo que cumple el orden declarado, y de eso salen las cotas
   adoptadas. Con el orden detectado, la regla pasaría a «se compensa si
   alcanza algún orden». El equilibrado de distancias por armada y por sección
   se juzgaría con ese orden (`validators/leveling.ts:177,227`).
3. **El tipo de nivel no entra en ningún cálculo.** Solo oculta la libreta
   mientras no se elige y limita los tres hilos al nivel automático.
4. **Del equipo, solo se muestran** marca, modelo y serie; la σ mm/km y la
   calibración solo se leen en el informe y el Excel. Es el hallazgo 1 de la
   poligonal.
5. **`correction_method` no lo lee nadie**: hay un solo método, la corrección
   proporcional a la distancia. Tampoco nadie escribe ni lee
   `has_warnings`/`warning_messages`.
6. **Una fila de la libreta es un punto**: su V− llega de la armada anterior y
   su V+ abre la siguiente. La hoja de El Verjón ocupa tres filas por punto
   (hilos superior, medio e inferior) y anota V+, AI, V−, VI, cota y las dos
   distancias de cada armada.
7. **Ningún otro módulo depende de que una nivelación esté cerrada.** Las
   cotas adoptadas (`reports/adopted.ts`) solo exigen que cumpla.
8. **El equilibrado de visuales también depende del orden**
   (`SIGHT_BALANCE_LIMIT_M`: 2, 5, 10 y 10 m). En El Verjón, 12 de las 20
   armadas pasan de los 5 m de segundo orden y la ida suma 53.3 m más atrás
   que adelante: el terreno sube 26.6 m en 384 m. Era un aviso; el usuario
   decidió quitarlo (revisión del lienzo, abajo).

### Lienzo «Nivelación — rediseño de la UX»

Con El Verjón: ida, contranivelación y tres hilos. Publicado el 2026-10-06
(<https://claude.ai/artifact/3XzPm9EFC8dXwwWGEAEvNs>), con los números del
motor de la app. Los dos gráficos de la libreta quedaron así: el croquis del
recorrido (A) y el perfil con las miras y las visuales de cada armada (B).

| Superficie | Variante A | Variante B |
|---|---|---|
| **Alta** (popup) | Título, ubicación, responsable, cargo, tipo (cerrada, de enlace o abierta), BM de partida del catálogo, BM de llegada si es de enlace y la casilla «con vuelta». El equipo plegado | Igual, con el BM de partida y su cota como primer paso, como el amarre de la poligonal |
| **1 · Libreta** | Tabla al estilo de la hoja (Punto, V+, AI, V−, VI, Cota, distancias) con Ida \| Vuelta y, fijo a la derecha, el **croquis del recorrido**: los puntos en planta esquemática y cada armada con sus dos distancias | La misma tabla, con el **perfil de cotas** a la derecha y cada armada marcada |
| **Popup de captura** | **Por armada:** «desde» (V+ y distancia) → «hacia» (V− y distancia), con intermedias opcionales y los hilos opcionales en cada visual. Lleva la casilla «Llega al BM» | **Por punto:** una fila como en la hoja, con su V−, su V+ y sus hilos |
| **2 · Compensación** | La tabla de la contranivelación de la hoja: corrección proporcional a la distancia, cotas compensadas, ida contra vuelta, homólogos, cotas adoptadas y la comprobación aritmética. El **orden alcanzado** con su «Por qué». Sin selector de método | — |
| **3 · Informe** | «Compensación proporcional a la distancia», con las fórmulas en MathML | — |
| **Móvil** | La libreta con Tabla \| Recorrido y el popup de captura | — |

**Revisión del lienzo (2026-10-06).** Lo que eligió el usuario:

| Superficie | Decisión |
|---|---|
| Alta | **B**, el tipo con el recorrido dibujado. La de enlace pide los dos BM, cada uno con código y cota |
| BM | **Sin catálogo**: el código y la cota se teclean. La nivelación deja de leer los puntos de referencia del proyecto; las visitas, que usan el mismo selector, se deciden en la 37 |
| Libreta | **B**, el perfil con las miras y las visuales de cada armada. Con vuelta, la contraparte —la vuelta al ver la ida y al revés— se dibuja tenue |
| Captura | **A**, por armada. La lectura y la distancia siempre; los hilos superior e inferior, opcionales: si están, la distancia sale de ellos y se comprueba el hilo medio. Sin el tipo de nivel |
| Compensación | Un solo gráfico: la cota ajustada a escala y lo medido separado de ella con la diferencia ×1000. Una versión por tipo: cerrada y de enlace (medida y ajustada), abierta con vuelta (ida, vuelta y ajustada) y abierta sin vuelta (sin compensación) |
| Nombre | **«Cota ajustada»**, no «adoptada», como en la poligonal |
| Equilibrado de visuales | **Se quita**: no es parte del ajuste. Eran los avisos por armada (Fase 19, N7) y por sección (Fase 32, D-3); quitarlos no cambia ninguna cota. La libreta de las visitas usa los mismos validadores |
| Informe | **Sencillo**: un resumen con el veredicto, los datos iniciales (la libreta), los datos ajustados y el gráfico comparado. El método en una frase, sin fórmulas paso a paso. Una versión por tipo; la abierta sin vuelta no tiene datos ajustados y dice que no tiene verificación |

La regla de compensación con el orden detectado (hallazgo 2): **se compensa
siempre**, sin limitantes, **con avisos** si no alcanza ningún orden («no
dejemos limitantes pero sí avisos»). La importación del `.L` y del CSV va en la
barra de pasos. El borrador del PRD está en `docs/prds/35-ux-nivelacion.md`.

### Lo que se quita con el cierre

- **Base:** los estados `closed` y `rejected`, `closed_at`, `closed_by` y
  los triggers `leveling_processes_reject_update_on_closed`,
  `leveling_processes_reject_delete_when_closed` y
  `leveling_readings_reject_write_when_closed`. Las funciones compartidas
  quedan para asentamientos.
- **Código:**
  - el diálogo y la acción de cerrar, `close-status.ts` y
    `evaluateLevelingClosure`;
  - reabrir y el modo solo lectura;
  - la marca de borrador y el registro de cierre del informe, y la
    elegibilidad del consolidado;
  - los chips del hub;
  - `getClosedWorkCount`;
  - el estado en el Excel, la demo (el tramo 2 cerrado) y el seed («Circuito
    BM-2 (cerrado oficialmente)»).
- **Migración en dos pasos**, como la 35: el paso 1 reabre a `calculated` y
  va antes del merge; el paso 2 borra las columnas y va después.

### Verificación en producción

El Verjón y el tramo 2 de la demo de producción, calculados con el motor
contra la hoja corregida de El Verjón y el análisis del crudo
(`carteras/analisis-nivelacion-verjon.md`, `carteras/analisis-crudo-nivel-digital.md`).

## Fase 37 — Los asentamientos como los mide el topógrafo

### Punto de partida

**Hallazgos preliminares de la revisión del 2026-10-06:**

1. **La cartera real es una sola armada con radiaciones** desde el BM de la
   piscina (156.299): V+ al BM, AI = cota + V+ y una lectura por punto,
   cota = AI − lectura. No tiene cierre, ni puntos de cambio, ni distancias.
   - Hoy solo entra como cotas tecleadas: la libreta exige cerrar en el amarre
     (`validators/settlement-book.ts:73-79`).
   - Visitas en columnas (7 bloques) y puntos en filas (16 más el BM).
   - La clasificación (ASENTAMIENTO, NO CAMBIA, REBOTE) es manual y no es
     consistente.
2. **El orden de precisión de la visita cambia sus cotas**: solo se compensa
   dentro de K·√L (`leveling.ts:385-389`), y además entra en la comprobación
   de BMs y en los márgenes de tendencia. Se puede detectar como en la
   nivelación.
3. **El clima y las notas de la visita no los lee nadie.**
4. **Lo que hoy se ancla en lo cerrado:**
   - la C0 fija (trigger en `settlement_points`);
   - «Cierra antes la visita N»;
   - borrar solo la última visita;
   - el alta y la baja de puntos;
   - borrar un punto con lecturas cerradas;
   - la caché de `alert_status`, que guarda alertas viejas en las visitas
     cerradas;
   - la propagación de cambios, que solo llega a las visitas abiertas;
   - la elegibilidad del informe;
   - el KPI de visitas `calculated` del dashboard.
5. **El diálogo de cerrar el lugar miente:** dice que las visitas abiertas
   «quedarán cerradas», y `closeSiteAction` solo cambia el lugar. Desaparece
   con el cierre.
6. **El panel salió del prototipo del usuario** (Fase 18) y se recalcula en
   vivo. Es lo que menos cambia. El editor de la visita es un formulario largo
   con la libreta inline, y es lo que más cambia.

### Lienzo «Asentamientos — rediseño de la UX»

Con la cartera real: 7 visitas, 16 puntos y el BM de la piscina.

| Superficie | Variante A | Variante B |
|---|---|---|
| **Alta del lugar** (popup) | Nombre y tipo de estructura, con los umbrales plegados y precargados según el tipo | — |
| **Lugar** | El panel como hoy, con la cabecera común | Dos columnas: la tabla de visitas y, fijo al lado, la tendencia |
| **Nueva visita** (popup) | Fecha, nivelador y BM de amarre, precargados de la anterior, y el equipo plegado. Sin orden, porque se detecta | — |
| **Visita · 1 Lecturas** | **Una armada con radiaciones**, como la cartera: V+ al BM y una lectura por punto | La libreta por armadas de la 36, con «radiación» como tipo de visual |
| **Visita · 2 Resultados** | Cota, parcial, acumulado, velocidad y semáforo, con el gráfico al lado | — |
| **Informe** | «Cómo se calcula»: acumulado, velocidad y umbrales, en MathML | — |
| **Móvil** | La captura en campo | — |

**Decisiones para la revisión del lienzo:**

- Qué sustituye a lo anclado en lo cerrado (hallazgo 4). Lo más simple:
  recalcular siempre en vivo, sin la caché de `alert_status`, y avisar al
  cambiar una C0 que ya tiene historia.
- Si la captura por radiación es un modo nuevo de la visita o un tipo de
  visual de la libreta.
- Quitar el clima y las notas de la visita.
- Si el lugar conserva algún estado sin el cierre.

### La cartera real a la demo y al seed

Con las decisiones ya tomadas por el usuario el 2026-10-03:

- es el 4.º lugar del proyecto «Edificio en monitoreo» del seed;
- la visita 7 es del **2022-06-05** (la celda `AF2` dice 2022-05-06 por el
  orden día/mes);
- «AA3» es el código correcto;
- B10 en la visita 3 va tal cual la cartera (lectura 4.120, cota 153.629,
  −50 mm);
- visitas `calculated`.

«Lugar abierto» deja de aplicar: sin cierre, el lugar no tiene ese estado. Si
el lienzo aprueba la captura por radiación, la cartera entra con sus lecturas
y no con las cotas tecleadas. El análisis ya anticipó dos efectos en la
pantalla:

- B10 sale «excesiva» en la visita 3 y «contraria» en la 4;
- el semáforo marca alarma por ruido en las visitas 2 a 5.

Lo segundo se anota en `pendientes.md` como petición aparte.

### Lo que se quita con el cierre

- **Base:**
  - los estados `closed` de visitas y lugares, con `closed_at` y `closed_by`;
  - los triggers de rechazo de visitas, lugares y lecturas;
  - los de lugar cerrado en visitas, lecturas, puntos y libreta;
  - el que fija la C0;
  - y, al final, las funciones compartidas y `is_reopening`.
- **Código:**
  - los diálogos de cerrar visita y lugar;
  - reabrir y los modos solo lectura;
  - las reglas de orden de la visita;
  - las guardas de borrado;
  - la elegibilidad y la marca de borrador del informe;
  - el hub;
  - `getClosedWorkCount`;
  - el Excel, la demo y el seed.
- **Migración en dos pasos**, como en la 35 y la 36.

### Verificación en producción

La cartera real en la demo de producción, calculada con el motor contra las
celdas de la hoja: cota, comparación con la primera visita y comparación con
la anterior.

## Fuera de alcance

- Cambiar las fórmulas del motor de nivelación o de asentamientos, salvo la
  regla de compensación con el orden detectado si el lienzo la aprueba.
- El margen de ruido en el semáforo por velocidad: se anota como petición
  aparte.
- Las lecturas múltiples del `.L` (la σ y las repeticiones), candidatas desde
  la Fase 16.

## Riesgos

- **La 37 es la más grande.** Quitar el cierre de asentamientos cambia el
  sentido de muchas reglas (hallazgo 4). Mitigación: el lienzo decide qué las
  sustituye antes del PRD, y el PRD lista cada regla con su destino.
- **Cambiar `ReadingsTable` en la 36 cambia la libreta de las visitas.**
  Mitigación: la 36 verifica en pantalla la visita con libreta, aunque no la
  rediseñe.
- **El orden detectado cambia resultados de nivelaciones guardadas.** Una que
  declaraba tercer orden y alcanza segundo dirá otro orden. Una que no
  cumplía el orden declarado, y por eso no se compensaba, se compensará si
  alcanza otro, y cambian sus cotas. Mitigación: contar en producción cuántas
  hay antes de la migración, y el hallazgo en el PRD.

## Siguiente paso

Las etapas 1 y 2 de la Fase 36: la revisión con capturas de la pantalla
actual y el lienzo «Nivelación — rediseño de la UX» con El Verjón.
