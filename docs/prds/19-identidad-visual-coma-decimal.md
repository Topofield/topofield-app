# PRD-de-fase 20 — Identidad visual del prototipo y coma decimal

**Estado:** cerrada
**Fecha de apertura:** 2026-09-25
**Fecha de cierre:** 2026-09-25

**Rama:** `fase-20-identidad-visual-coma-decimal`
**Peticiones:** UI1 y UI2 de [`pendientes.md`](../pendientes.md), anotadas en
la Fase 18
**Módulo:** toda la interfaz (sistema de diseño, las pantallas de los tres
módulos, informe imprimible y manual)

> **Divergencias de la implementación:**
>
> - **Un solo bloque de tokens con `light-dark()`**, no un bloque oscuro
>   duplicado bajo la media query y bajo `data-theme`: el tema lo decide
>   `color-scheme`. Va en `@theme static`, porque Tailwind v4 solo emite las
>   variables que usa alguna utilidad y estas también se leen con `var()`. Se
>   reinicia además la paleta por defecto de Tailwind (`--color-*: initial`).
> - **El semáforo no cambia de valor** (decisión 5): los cuatro colores de la
>   Fase 5 cumplen 3:1 también sobre la tarjeta oscura. Van al bloque de los
>   tokens por rol, con un solo valor.
> - **UI2: la celda se marca a sí misma**, no el validador (decisión 11): así
>   funciona en las 45 celdas sin tocar ningún validador. Bloqueo con
>   `InvalidNumbersContext` en los editores y `setCustomValidity` en los
>   `<form>`. Más allá del inventario: cinco `Number()` sobre texto tecleado,
>   los umbrales —que guardaban números y borraban el separador— y cinco
>   celdas de texto que no marcaban lo inválido (pesos de mínimos cuadrados,
>   georreferenciación).
> - **El selector** es un icono con un `<select>` nativo transparente encima:
>   un `<select>` visible no cabe en la cabecera en 390 px. En las páginas de
>   acceso va arriba a la derecha.
> - **Hallado en la verificación en pantalla:**
>   - la poligonal ajustada se dibuja en **tinta**, no en `mira-strong`: con
>     el acento quedaba en el mismo tono que la sin compensar (`warning`);
>   - `text-rendering: geometricPrecision` en el `body`: Chromium en Linux
>     abría huecos dentro de las palabras con Barlow («Client e Demo»). Se vio
>     en las capturas del manual a doble densidad;
>   - las casillas nativas toman el acento con `accent-color` global: las
>     clases de color de texto que tenían no hacían nada;
>   - el aviso de hidratación en la pantalla de acceso durante el recorrido
>     era de Playwright: la captura añade `caret-color` a los campos y, si se
>     hace antes de hidratar, React lo ve como un atributo que el servidor no
>     puso. No es de la app.
> - **`/design-system`** muestra tokens y contraste por tema, y su registro de
>   decisiones anota que el contraste es ya un test.
> - **Manual:** además de los textos, una captura nueva del panel en el
>   teléfono con el tema oscuro (29), tomada con la cookie del selector.
> - **Doc técnica:** la regla de «qué entra en el sistema de diseño» se matizó
>   (cierra una entrada de la § 11 de la Fase 13); el Excel, que conserva la
>   paleta anterior, pasa a la § 11.

## Propósito

- **UI1.** La app adopta la identidad del prototipo de asentamientos
  ([`prototipos/Control de asentamientos, Torre Alameda.html`](../prototipos/Control%20de%20asentamientos%2C%20Torre%20Alameda.html)):
  las fuentes **Barlow** y **Barlow Semi Condensed**, la paleta papel/tinta,
  el acento amarillo **«mira»** y el **modo oscuro**. En toda la app, no solo
  en asentamientos. La Fase 18 llevó el layout del prototipo con los tokens de
  entonces (decisión 11 de su PRD) porque esto afecta a todo.
- **UI2.** Las celdas numéricas aceptan la **coma decimal** que teclea un
  usuario en español. Hoy son `type="number"`, que la rechaza.

## Decisiones del usuario (apertura)

1. **UI1 en toda la app, con modo oscuro.** La identidad nueva sustituye a la
   actual: el azul `primary`, Space Grotesk y la escala `neutral`.
2. **Tema: sistema + selector en la cabecera.** Por defecto sigue al sistema
   operativo. Un selector Sistema / Claro / Oscuro permite forzar uno —por
   ejemplo claro a pleno sol en campo—. La elección va en una cookie y el
   servidor pinta el tema correcto, sin parpadeo. Sin cambios en la base.
3. **UI2 solo al teclear.** Las celdas aceptan coma o punto. Resultados,
   informe, Excel y manual siguen mostrando punto (`100.3027`), como hoy y como
   las carteras.

## Hallazgos que condicionan la fase

### 1. El modo oscuro obliga a tokens semánticos

Hay **~800 clases de color en 88 archivos** y ningún `dark:`. Las más usadas:
`text-neutral-500` (227), `text-neutral-900` (67), `text-neutral-700` (66),
`border-neutral-200` (59), `bg-white` (39).

Invertir la escala actual en oscuro no sirve: `white` es a la vez fondo de
tarjeta y texto sobre botón, y `neutral-500` es texto secundario y relleno de
gráfica. Hace falta lo que hace el prototipo: tokens por **rol** (papel,
tarjeta, tinta, regla) que cambian de valor con el tema. Con ellos, el modo
oscuro es redefinir variables; sin ellos, son 800 `dark:` a mano.

Además hay colores fijos fuera de las clases: la gráfica del informe
(`reports/settlement-plot.tsx`, 5 `hex`), los colores de las series
(`lib/design/series-markers.ts`) y el semáforo de 4 niveles.

### 2. El prototipo no cumple el contraste en seis parejas

Medido con `lib/design/contrast.ts` sobre los valores del prototipo. Fallan
seis en claro; dos de ellas, también en oscuro:

| Pareja | Claro | Oscuro | Umbral |
|---|---|---|---|
| tinta 3 sobre tarjeta (texto terciario) | **3.03** | **4.04** | 4.5 |
| regla 2 sobre tarjeta (borde de control) | **1.57** | **1.59** | 3 |
| mira sobre tarjeta (foco, acento gráfico) | **2.06** | 9.00 | 3 |
| éxito sobre su tinte | **4.39** | 6.18 | 4.5 |
| alerta sobre tarjeta | **3.99** | 7.61 | 4.5 |
| alerta sobre su tinte | **3.51** | 6.59 | 4.5 |
| texto sobre botón mira | 8.32 | 9.78 | 4.5 |

El resto pasa: tinta 15.78 / 13.31, tinta 2 6.20 / 7.49, crítico 5.44 /
5.52. El amarillo sobre blanco era la sospecha de `pendientes.md`: no sirve de
anillo de foco en claro.

### 3. El contraste puede ser un test

La § 8 de la doc técnica y `/design-system` dicen que convertir la tabla de
parejas en prueba «exigiría jsdom». No es así: `parseThemeColors` es pura y
Vitest corre en `node`, con `fs`. Un test puede leer `globals.css` y medir
cada pareja **en los dos temas**. Con el modo oscuro las parejas se duplican,
y abrir la página a mano dejaría de ser un paso fiable.

`parseThemeColors` hoy recoge cualquier `--color-*` de la hoja: con dos temas,
el oscuro pisaría al claro. Tiene que leer cada bloque por separado.

### 4. Tema sin parpadeo: la cookie, leída en el servidor

La CSP permite scripts en línea (`'unsafe-inline'`), pero no hacen falta: el
layout raíz lee la cookie con `cookies()` y pone `data-theme` en `<html>`.
«Sistema» no pone atributo y decide la media query. Precio: las cinco rutas
que hoy se prerenderizan (`/`, `/sign-up`, `/sign-up/revisa-tu-correo`,
`/design-system`, `/_not-found`) pasan a dinámicas. Las de la app ya lo son,
porque leen la sesión.

### 5. UI2: 45 celdas, y hay que distinguir vacío de inválido

45 `type="number"` en 14 archivos: libreta de nivelación, libreta y lecturas
de la visita, estaciones y configuración de poligonal, `DmsInput`, equipo,
umbrales, catálogo de puntos, puntos de referencia, BM, reasignar coordenadas.
Casi todas pasan por `parseNumber` (`lib/utils/parse.ts`) en el cliente; los
puntos de referencia, por `parseCoordinate` en `validators/reference-point.ts`
en el servidor. La plantilla CSV ya acepta la coma (Fase 16).

Con `type="number"`, el navegador entrega `""` ante cualquier texto no
numérico, y la app lo trata como vacío. Con `type="text"` llegará el texto tal
cual: `"1,2,3"` o `"abc"` no pueden seguir tratándose como una celda vacía,
porque el aviso sería «falta el dato» cuando el dato está mal escrito.

## Decisiones

| # | Decisión | Razón |
|---|---|---|
| 1 | Tokens por **rol**, con los nombres del prototipo: `paper`, `card`, `ink`, `ink-2`, `ink-3`, `rule`, `rule-strong`, `mira`, `mira-strong`, `mira-bg`, `mira-ink`, `on-mira`, `sel`; y los de estado `success`, `warning`, `danger` con su `-bg` | Hallazgo 1. Se conservan `success`/`warning`/`danger` y no `ok`/`alert`/`crit` del prototipo: «alerta» ya es un nivel del semáforo de asentamientos |
| 2 | Los valores parten del prototipo; los seis que no cumplen **se ajustan conservando el matiz** hasta el umbral, en claro y en oscuro. `rule-strong` (borde de control) y `mira-strong` (foco y acento gráfico en claro) son tokens nuevos | Hallazgo 2. Los valores finales se fijan en la tarea 2 y se anotan en este PRD |
| 3 | Botón principal: fondo `mira`, texto `on-mira`. Foco: anillo `mira-strong`. Selección: fondo `sel` con filete `mira` a la izquierda, como el prototipo | Es la identidad del prototipo, y el hallazgo 2 muestra que el texto oscuro sobre mira cumple de sobra |
| 4 | Títulos en **Barlow Semi Condensed** 600; cuerpo en **Barlow**; datos en `--font-mono`, como hoy. Con `next/font/google`, auto-alojadas, así que la CSP no cambia | Prototipo. `font-src 'self'` ya basta |
| 5 | **Semáforo de 4 niveles**: se conservan los cuatro niveles, sus formas y sus nombres; sus colores se ajustan a la paleta nueva y se miden en los dos temas | El prototipo tiene tres estados; el dominio de la Fase 5 tiene cuatro |
| 6 | Tema: cookie `topofield-theme` (`light` \| `dark`; sin cookie = sistema), leída en el layout raíz; `color-scheme` en `<html>` para controles nativos y barras de desplazamiento | Decisión del usuario, hallazgo 4 |
| 7 | **El informe imprime siempre en claro**, con la identidad nueva | El papel es blanco. Los tokens oscuros se limitan a `@media screen` |
| 8 | **Se retiran los tokens viejos** (`primary-*`, `neutral-*`, la escala de `success`/`warning`/`danger`): al cerrar, ninguna clase los usa. Un test lo comprueba | Si conviven, el modo oscuro queda a medias en silencio donde alguien use uno viejo |
| 9 | **El contraste pasa a ser un test** de Vitest sobre `globals.css`, en los dos temas; `/design-system` sigue mostrando la tabla, ahora por tema | Hallazgo 3. Cierra la deuda de «no hay gate automático» |
| 10 | UI2: las celdas numéricas pasan a `type="text"` con `inputMode="decimal"`; el analizador acepta **un** separador decimal, coma o punto, y **rechaza separadores de miles** (`1.234,5` es inválido, no 1234.5). El valor tecleado no se reescribe | Decisión del usuario. Un separador de miles adivinado es un número equivocado sin aviso |
| 11 | El analizador distingue **vacío** de **inválido**, y lo inválido se marca en la celda con su propio mensaje | Hallazgo 5 |

## Diseño

### Tokens (`globals.css`)

- Cada token lleva sus dos valores en un **`light-dark(claro, oscuro)`**, en
  un bloque `@theme static`. El tema lo decide `color-scheme`: `light dark`
  en `:root` (sigue al sistema), `light` o `dark` con `data-theme` dentro de
  `@media screen`, y `light` en `@media print`. Es un solo bloque de tokens:
  la primera redacción duplicaba el oscuro bajo una media query y bajo
  `data-theme`, y dos copias paralelas acaban divergiendo.
- `static` porque Tailwind v4 solo emite las variables que usa alguna
  utilidad, y estas también se leen con `var(--color-…)` en línea (muestras de
  `/design-system`, colores de las series).
- Lightning CSS transpila `light-dark()` a un polyfill con variables
  `--lightningcss-light/-dark` que sigue a `color-scheme`. Verificado en el
  navegador: sistema claro y oscuro, cada tema forzado contra el sistema
  contrario, e impresión con el oscuro forzado (sale en claro).
- Tailwind genera `bg-card`, `text-ink`, `border-rule`… como
  `var(--color-…)`, así que el cambio de tema no necesita ni un `dark:`.
- Los estados usan tintes explícitos (`success-bg`…) y no `/10`.

**Valores finales** (claro · oscuro). Parten del prototipo; los marcados
se ajustaron conservando el tono hasta su umbral, con un paso de margen:

| Token | Claro | Oscuro |
|---|---|---|
| `paper` · `card` | `#f4f6f5` · `#ffffff` | `#151a1c` · `#1d2427` |
| `ink` · `ink-2` | `#1c2427` · `#56636a` | `#e8edec` · `#a9b5b9` |
| `ink-3` | **`#677277`** (era `#8a969c`, 3.03) | **`#838f95`** (era `#76838a`, 4.04) |
| `rule` · `rule-strong` | `#dde3e2` · **`#838b8c`** (nuevo, 3:1) | `#2c3538` · **`#666f71`** |
| `sel` | `#eef3f2` | `#243034` |
| `mira` · `mira-strong` | `#e2ad0b` · **`#ab8308`** (nuevo: foco) | `#f0bd22` · `#f0bd22` |
| `mira-bg` · `mira-ink` · `on-mira` | `#fbf1d3` · `#6b5100` · `#231b00` | `#3a300f` · `#f5d67a` · `#231b00` |
| `success` · `-bg` | **`#2c7866`** (era `#2d7a68`) · `#e1f1ec` | `#5cc0a6` · `#16332c` |
| `warning` · `-bg` | **`#9e5f00`** (era `#b86e00`) · `#fcefd9` | `#f0a53a` · `#3b2b12` |
| `danger` · `-bg` · `on-danger` | `#c0392b` · `#fbe6e3` · `#ffffff` | `#ef7466` · `#3d1c19` · **`#1d0f0d`** |
| semáforo | los de la Fase 5, sin cambio | los mismos: cumplen 3:1 también en oscuro |

`on-danger` es nuevo: el blanco sobre el rojo claro del tema oscuro da 2.85.

**Correspondencia orientativa** para migrar (se revisa caso a caso, por rol y
no por nombre):

| Hoy | Rol | Nuevo |
|---|---|---|
| fondo de página (`neutral-50` + retícula) | papel | `paper` |
| `bg-white` en tarjetas, modales, tablas | tarjeta | `card` |
| `text-neutral-900` / `-800`, títulos `text-primary-600` | tinta | `ink` |
| `text-neutral-700` / `-600` / `-500` | texto secundario | `ink-2` |
| `text-neutral-400` / `-300` | terciario (solo donde cumple) | `ink-3` |
| `border-neutral-100` / `-200` | regla | `rule` |
| `border-neutral-300` / `-400` (controles) | borde de control | `rule-strong` |
| `bg-primary-500` + `text-white` (acción principal) | acento | `mira` + `on-mira` |
| `bg-primary-50` (selección, resaltado) | selección | `sel` |

### Tema (selector)

- `ThemeSelect` en la cabecera de `(app)/layout.tsx` y en las páginas de
  acceso: Sistema / Claro / Oscuro. Al elegir, fija `data-theme` en `<html>`
  al instante y escribe la cookie (un año, `SameSite=Lax`, sin `HttpOnly`
  porque la escribe el cliente).
- La lectura de la cookie es una función pura con test: un valor desconocido
  es «sistema».

### Gráficas

- Las SVG de asentamientos (`components/settlement/charts/`) y el dibujo de la
  poligonal ya usan clases: pasan a los tokens nuevos.
- `reports/settlement-plot.tsx` sustituye sus `hex` por tokens.
- `series-markers.ts` pasa de `hex` a nombres de token, resueltos por CSS, y
  sus cuatro colores se miden como gráfico (3:1) en los dos temas.

### UI2 (analizador y celdas)

- `readNumberText` (`lib/utils/parse.ts`) distingue vacío, número e inválido;
  acepta un solo separador, coma o punto, y los estados intermedios de quien
  teclea (`1,`, `,5`). `parseNumber` conserva su contrato: `null` para vacío
  **y** para inválido, nunca `NaN`, porque los validadores comparan con `null`
  y un `NaN` pasaría sin aviso (ya lo advertía `validators/settlement-book.ts`).
- **La celda se marca a sí misma**, no el validador de captura: `NumberInput`
  (sistema de diseño) es `type="text"` + `inputMode="decimal"` y, si el texto
  no es número, muestra «No es un número.» en lugar del error del validador.
  Así funciona igual en las 45 celdas sin tocar ningún validador.
- **Bloqueo del guardado.** Donde hay `<form>` (altas, catálogo, lugar),
  `setCustomValidity` hace que el navegador no envíe. Donde se guarda con un
  botón (editores de nivelación, poligonal y visita; diálogo de reasignar
  coordenadas), `InvalidNumbersContext` cuenta las celdas inválidas y el
  botón se desactiva. Una celda inválida y opcional —un hilo— se perdería
  sin aviso si no bloqueara.
- Las cinco celdas no controladas (coordenadas del proyecto y puntos de
  referencia) van por `FormData`: pasan a `type="text"` y las valida el
  servidor, con el mismo analizador.
- `DmsInput`: grados y minutos enteros; segundos con coma.
- **Hallado al migrar**, además de las 45 celdas: cinco sitios convertían el
  texto con `Number()`, que da `NaN` con coma —el azimut de reasignar
  coordenadas y el derivado del amarre, el autocompletado de distancia desde
  los hilos, el catálogo de puntos y la cota del BM—; tres celdas de pesos de
  mínimos cuadrados y dos de georreferenciación ya eran de texto pero no
  marcaban lo inválido; y los umbrales guardaban **números** en el estado, así
  que con una celda de texto el separador se borraba al teclearlo: cada
  umbral guarda ahora su texto.

## Archivos

| Archivo | Cambio |
|---|---|
| `src/app/globals.css` | Tokens por rol, en claro y oscuro; impresión en claro; retícula del fondo con `rule` |
| `src/app/layout.tsx` | Barlow + Barlow Semi Condensed; `data-theme` y `color-scheme` desde la cookie |
| `src/lib/design/contrast.ts`, `pairings.ts` | `parseThemeColors` por tema; parejas en los dos temas |
| `src/lib/design/pairings.test.ts` (nuevo) | Toda pareja cumple en claro y en oscuro |
| `src/lib/design/tokens-retirados.test.ts` (nuevo) | Ninguna clase usa un token retirado |
| `src/lib/theme.ts` (nuevo) + test | Lectura de la cookie de tema |
| `src/components/design-system/theme-select.tsx` (nuevo) | El selector |
| `src/components/design-system/*` | Los 18 componentes a tokens por rol |
| `src/components/**`, `src/app/**` | Las pantallas, módulo a módulo |
| `src/lib/design/series-markers.ts`, `src/components/reports/settlement-plot.tsx` | Colores por token |
| `src/lib/utils/parse.ts` + test, `src/lib/validators/reference-point.ts` | Coma decimal; vacío frente a inválido |
| Los 14 archivos con `type="number"` | `type="text"` + `inputMode="decimal"` |
| `src/app/design-system/page.tsx` | Tabla de contraste por tema; texto de la deuda cerrada |

## Pruebas

| Qué | Casos |
|---|---|
| `parseNumber` y el aviso de inválido | coma, punto, signo, espacios, vacío, `1,` y `,5`; `1,2,3`, `1.234,5`, `abc`, `1e3` inválidos |
| `parseCoordinate` | coma en norte, este y cota |
| Captura | `NumberInput`: texto con teclado decimal, lo inválido se marca en lugar del error del validador; el contador de celdas inválidas; `DmsInput` (render sin jsdom). En pantalla: con coma calcula igual que con punto, y lo inválido bloquea el guardado |
| Contraste | cada pareja de `pairings.ts`, en claro y en oscuro, sobre el `globals.css` real |
| Tokens retirados | ningún `.tsx`/`.ts` de `src/` usa `primary-*`, `neutral-*` ni la escala vieja de estado |
| Tema | cookie `light`, `dark`, ausente y valor desconocido |

**En pantalla, en los dos temas y en 390 px:** dashboard, hub de proyecto,
editores de poligonal y nivelación, panel y visita de asentamientos con su
registro, informe (pantalla e impresión), manual y acceso. Sin desborde
horizontal y sin errores de consola. La coma se prueba tecleándola en la
libreta de nivelación, en la de la visita y en una estación de poligonal.

## Criterios de aceptación

1. La app usa la identidad del prototipo en todas las pantallas: Barlow,
   papel/tinta, acento mira.
2. Hay modo oscuro completo. Sigue al sistema, y el selector lo fuerza sin
   parpadeo al recargar.
3. Toda pareja de colores cumple su umbral en los dos temas, y lo comprueba un
   test.
4. No queda ninguna clase con un token retirado, y lo comprueba un test.
5. El informe imprime en claro.
6. Las celdas numéricas aceptan coma o punto; un texto inválido se marca como
   inválido.
7. `npm run typecheck`, `npm run lint`, `npm test` y `npm run build` limpios.
8. Manual en sus dos copias —con el selector de tema y la coma decimal— y
   capturas regeneradas; doc técnica al día (§ 8 reescrita, CSP, rutas
   estáticas); UI1 y UI2 cerradas en `pendientes.md`.

## Fuera de alcance

- **Mostrar** números con coma (decisión del usuario 3).
- La preferencia de tema en el perfil (decisión del usuario 2).
- El estilo del **Excel** exportado y los correos de Supabase Auth: son
  documentos fuera de la app.
- Cambiar el **layout** de pantallas que no son de asentamientos: cambian
  color y tipografía, no la disposición.
- Separadores de miles al teclear.

## Riesgos

- **Tamaño.** 88 archivos. Mitigación: sistema de diseño primero, luego
  módulo a módulo con un commit cada uno, y el test de tokens retirados
  como red al final.
- **Migrar por nombre y no por rol.** `text-neutral-500` es a veces texto y a
  veces relleno de gráfica. Mitigación: la tabla de correspondencia es
  orientativa; se mira cada uso.
- **`@theme` y variables redefinidas.** Si algún token se declarase con
  `@theme inline`, Tailwind incrustaría el valor y el tema oscuro no lo
  cambiaría. Mitigación: se verifica en pantalla con el tema forzado.
- **El manual cambia entero.** Todas las capturas se regeneran; las que
  citan colores en el texto se revisan.
- **UI2 en celdas que hoy validaba el navegador** (`min`, `step`). Mitigación:
  los validadores de captura ya cubren los rangos; se revisa cada una de las
  45.

## Tareas (en orden)

0. **Apertura:** este PRD, estados en `method.md` y `prds/README.md`. Commit
   `docs:`.
1. **UI2:** analizador con coma y vacío frente a inválido, `parseCoordinate`,
   las 45 celdas; tests.
2. Tokens por rol en claro y oscuro, con los ajustes de contraste;
   `parseThemeColors` por tema; test de contraste; `/design-system` por tema.
3. Fuentes y layout raíz: Barlow, `data-theme` desde la cookie; `ThemeSelect`
   y su test.
4. Sistema de diseño (`components/design-system/`) a tokens por rol.
5. Pantallas, un commit por módulo: acceso y dashboard; proyecto; poligonal;
   nivelación; asentamientos; informes; manual.
6. Gráficas, series e informe imprimible.
7. Retirar los tokens viejos; test de tokens retirados.
8. Verificación en pantalla, en los dos temas y en móvil.
9. Manual (dos copias) y capturas, doc técnica, `pendientes.md`,
   aprendizajes; cierre y PR.
