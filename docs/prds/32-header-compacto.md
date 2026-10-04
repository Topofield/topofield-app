# PRD-de-fase 33 — Header compacto

**Estado:** en curso
**Fecha de apertura:** 2026-10-03

**Rama:** `fase-33-header-compacto`
**Petición:** del usuario, 2026-10-03: «ayúdame a iterar sobre la navegación y
el header. Una UX más moderna tipo app web, con fácil navegación y header
compacto». Después: «rediseña el header como recomiendes». Es HC1 de
`pendientes.md`.
**Módulo:** el chrome de las pantallas autenticadas: header, migas y cabecera
de página.

## Propósito

Hoy el header ocupa 61 px y se va con el scroll. Debajo, cada página apila sus
migas, el título y las pestañas. Navegar exige subir hasta las migas, y el
contenido empieza tarde.

| Medido en una poligonal | Escritorio (1280 px) | Móvil (390 px) |
|---|---|---|
| Header | 61 px | 61 px |
| Margen superior de la página | 32 px | 32 px |
| Fila de migas y su separación | 20 + 16 px | 24 + 16 px |
| **El título empieza en** | **129 px** | **133 px** |

La fase deja **una barra superior fija y compacta, de 48 px, con la ruta
dentro**:

- la ruta, el manual, los equipos y la cuenta están siempre a la vista, aunque
  se baje por una libreta larga;
- el título empieza en **72 px** en escritorio y en móvil, unos 60 px más
  arriba.

Sin cambios de datos ni de cálculo.

## El diseño

```
Escritorio
┌──────────────────────────────────────────────────────────────────────────┐
│ △ TopoField   Proyecto de ejemplo › Poligonal Famarena…   ⚙ Equipos  ? Manual  (K) │  48 px, fija
└──────────────────────────────────────────────────────────────────────────┘
   Poligonal Famarena — Sede Vivero  [Calculado]        [Exportar] [Ver informe]
   Poligonal cerrada · Tercer orden
   ─────────────────────────────────────────────────────────────────
   Proceso   Informe

Móvil
┌──────────────────────────────────┐
│ △  ‹ Proyecto de ejemplo   ⚙ ? (K) │  48 px, fija
└──────────────────────────────────┘
```

### 1. La barra

- **Fija arriba** (`sticky`, 48 px) y a todo el ancho de la ventana, como en
  una app web. El contenido sigue centrado en sus 1024 px.
- **Fondo:** la tarjeta, con un poco de transparencia y desenfoque, y la raya
  inferior de siempre.
- **A la izquierda**, el logo, que lleva al dashboard: el isotipo en el móvil
  y el logo completo desde 640 px, como hoy.
- **En el centro**, la ruta de la página: entera en escritorio, truncando los
  nombres largos, y en el móvil el «‹ nivel anterior» de siempre. En el
  dashboard no hay ruta.
- **A la derecha:**
  - **Equipos** y **Manual**, con icono, y con su texto a partir de 640 px. El
    Manual sigue visible en el móvil, que es donde más se necesita en campo;
  - el **menú de cuenta**.

### 2. El menú de cuenta

- **El botón:** un círculo con la inicial del correo, con nombre accesible
  «Cuenta».
- **El panel** (que sustituye al correo, al icono de tema y al botón «Cerrar
  sesión», sueltos en la barra) tiene:
  - el correo;
  - el tema: **Sistema**, **Claro** u **Oscuro**, con el selector actual, ahora
    visible con su etiqueta;
  - **Cerrar sesión**.
- **Sin JavaScript propio:** usa el atributo `popover` de HTML, que abre y
  cierra el panel, lo cierra al tocar fuera o con Esc, y lo pinta por encima
  de todo. Como el botón siempre está arriba a la derecha, el panel se coloca
  con CSS justo debajo.

### 3. La ruta dentro de la barra

Las migas llevan nombres —el del proyecto, el del proceso— que solo conoce
cada página, y la barra vive en el layout. Para que estén en la barra:

- **Se siguen pintando en el servidor con su página**, en `Breadcrumbs`, como
  hoy. `PageHeader` y las seis páginas que las usan directamente no cambian de
  datos.
- **El CSS las coloca sobre la barra**: `position: fixed`, arriba, en el hueco
  entre el logo y los iconos. Ese hueco lo marcan tres variables CSS:
  `--barra-alto`, `--ruta-inicio` y `--ruta-fin`, distintas en móvil y en
  escritorio.
- **Resultado:** sin JavaScript, sin parpadeo al cargar y sin que el
  contenido salte.

**Alternativas descartadas:**

| Opción | Por qué no |
|---|---|
| Un portal de React desde la página a la barra | En el servidor no se pinta: las migas aparecerían al hidratar, y el contenido saltaría |
| Un contexto que la página rellena | Igual: la barra se pinta antes que la página |
| Migas desde la URL (`usePathname`, lo que propone la doc de Next) | La URL tiene ids, no nombres. Habría que pedirlos desde el cliente, y parpadearían |
| Rutas paralelas de Next (`@ruta`) | Duplica el árbol de rutas y las consultas de cada página, para una línea de texto |

**Lo que se acepta:** con el teclado, el foco recorre primero el logo y los
iconos de la barra, y después la ruta, porque en el documento va con la
página.

### 4. La cabecera de página

- **Sin fila de migas**, porque se van a la barra. El título queda arriba.
- **El margen superior de la página** baja de 32 a 24 px.
- **Lo demás no cambia:** el título, el estado, el subtítulo, las acciones, la
  raya y las pestañas.

### 5. Detalles

- **Anclas:** `scroll-padding-top` para que la barra fija no tape lo que
  enlaza el índice del manual.
- **Imprimir:** la barra y la ruta ya se ocultan (`globals.css` oculta todo
  `header` y `nav`). El panel de cuenta, cerrado, no se imprime.
- **Encima de todo:** las ventanas modales y el panel lateral siguen por
  encima de la barra.
- **Tema oscuro:** la barra usa los tokens del sistema de diseño.

## Alcance

- `src/app/(app)/layout.tsx`: la barra nueva.
- **Un componente nuevo de la barra** en `components/navigation/`: el menú de
  cuenta y los enlaces con icono, con SVG en línea porque no hay librería de
  iconos.
- **`components/design-system/`:**
  - `breadcrumbs.tsx`: la ruta colocada en la barra;
  - `page-header.tsx`: sin la fila de migas;
  - `theme-select.tsx`: visible, con su etiqueta, dentro del panel.
- `src/app/globals.css`: las variables de la barra, la posición de la ruta y
  `scroll-padding-top`.
- **Documentación:**
  - el manual, en sus dos copias: § 2 (la barra, el menú de cuenta y el tema)
    y las menciones a «las migas de arriba» y al «icono de la cabecera»;
  - **todas las capturas**, porque la barra sale en cada una;
  - las guías e2e donde se pulsa «Cerrar sesión», el tema o «‹ volver»;
  - la doc técnica: el sistema de diseño (§ 8), el estado de fases y la tabla
    de pruebas.

## Decisiones

| # | Decisión | Razón |
|---|---|---|
| 1 | Barra fija de 48 px a todo el ancho | Es lo que da la sensación de app y deja la navegación siempre a mano. A todo el ancho, el hueco de la ruta es el mismo en cualquier pantalla |
| 2 | La ruta va en la barra, no en la página | Es la navegación que más se usa: subir al proyecto o al lugar. Fija, está a un toque desde cualquier punto de una página larga |
| 3 | La ruta se coloca con CSS y se pinta en el servidor | Es la única opción sin parpadeo ni salto que no cambia las páginas ni duplica consultas (ver § 3) |
| 4 | Menú de cuenta con `popover` nativo | Agrupa lo que se usa poco (correo, tema, cerrar sesión) sin escribir un menú en JavaScript |
| 5 | Equipos y Manual siguen sueltos en la barra | Se usan a menudo, y el manual en campo. Con icono, caben en 390 px |
| 6 | El contenido sigue en 1024 px | Ensancharlo cambia tablas, informes y capturas. Es otra decisión, fuera de esta fase |

## Pruebas

| Qué | Cómo |
|---|---|
| Ruta | `resolveBreadcrumbs` no cambia y sus tests siguen. Sobre la barra, la ruta truncada no pisa los iconos: en pantalla, a 390, 640 y 1280 px |
| Cabecera de página | `page-header.test.ts`: sin migas en el flujo |
| Menú de cuenta | En pantalla: abre, cierra al tocar fuera y con Esc, cambia el tema y cierra la sesión |
| Guarda de cambios sin guardar | En pantalla: con un cambio sin guardar, un clic en la ruta de la barra sigue avisando (escucha los clics de todo el documento) |
| Anclas | En pantalla: un enlace del índice del manual deja la sección visible bajo la barra |

**En pantalla (local), claro y oscuro, a 1280 px y a 390 px:**
- el dashboard;
- el hub de un proyecto;
- una poligonal con scroll largo, con la barra y la ruta fijas;
- un lugar de asentamientos y una visita;
- el manual;
- la vista de impresión de un informe;
- sin desborde horizontal ni errores de página.

## Criterios de aceptación

1. La barra mide 48 px, queda fija al hacer scroll y está en todas las
   pantallas autenticadas.
2. La ruta de cada página está en la barra: entera en escritorio, «‹ nivel
   anterior» en el móvil. Aparece sin parpadeo al cargar.
3. El título de una página empieza a 72 px del borde superior, en escritorio y
   en móvil.
4. El correo, el tema y «Cerrar sesión» están en el menú de cuenta, que se usa
   con ratón, con el dedo y con el teclado.
5. Equipos y Manual se ven en la barra en el móvil.
6. Nada se desborda a 390 px. Las modales y el panel lateral quedan por encima
   de la barra, e imprimir no muestra la barra.
7. `npm run typecheck`, `npm run lint`, `npm test` y `npm run build` pasan
   limpios. El manual está en sus dos copias, con las capturas regeneradas.

## Fuera de alcance

- **Una barra lateral** con los proyectos y procesos: ocupa ancho y es un
  cambio de estructura mayor.
- **Selectores en la ruta** para saltar a otro proyecto o proceso sin pasar
  por el hub. Es la continuación natural si la barra funciona: queda anotada
  en `pendientes.md`.
- **Ensanchar el contenido** (decisión 6).
- **Una barra inferior** de navegación en el móvil.

## Riesgos

- **La ruta va colocada con `position: fixed`.** Si alguien cambia el ancho
  del logo o de los iconos, la ruta se los pisa. Mitigación: los tres anchos
  viven en variables CSS junto a la barra, con un comentario, y la
  verificación en pantalla mide el solape a tres anchos.
- **`popover` sube un poco el navegador mínimo.** Next 16 y Tailwind v4 ya
  exigen Chrome 111, Safari 16.4 y Firefox 128; `popover` pide Chrome 114 y
  Safari 17. En un navegador anterior el panel no abre, y la sesión no se
  podría cerrar desde ahí. Se acepta: son versiones de 2023.
- **Todas las capturas cambian.** Es esperado: se regeneran y se commitean
  todas.

## Tareas (en orden)

0. **Apertura:** este PRD, HC1 en `pendientes.md` y los estados en
   `method.md` y `prds/README.md`. Commit `docs:`. Rama.
1. **La barra** con el menú de cuenta y los enlaces con icono.
2. **La ruta en la barra** y la cabecera de página sin migas, con sus tests.
3. **Verificación en pantalla** en local.
4. **Cierre:**
   - documentación: manual (dos copias) y todas las capturas, guías e2e, doc
     técnica, `method.md`, `prds/README.md`, `pendientes.md` y `CLAUDE.md`;
   - revisión de código y PR.
5. **Producción:** el merge, que decide el usuario. Sin migración.
