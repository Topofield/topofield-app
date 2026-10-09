# PRD-de-fase 42 — El manual por capítulos

**Estado:** en curso (aprobado el 2026-10-08)
**Fecha de apertura:** 2026-10-08
**Rama:** `fase-42-manual`
**Petición:** del usuario, 2026-10-08: «El manual quiero rediseñarlo además su
ux/ui para que se pueda leer por secciones o capítulos, como los manuales
típicos, y que esté dividido por los flujos de usuario. […] Para cada flujo,
quiero que hagas el recorrido real, vayas tomando los pantallazos, y
guardándolos así como actualizando el manual. El manual debe tener un lenguaje
sencillo y fácil de entender.»
En la apertura eligió **una sola fuente**: el manual se escribe en Markdown,
un archivo por capítulo, y la app lo pinta. Se acaba el texto duplicado.
**Módulo:** el manual (`docs/manual/` y la ruta `/manual`). Ni la base ni el
motor cambian.

## Propósito

El producto está terminado y el manual es lo que lo explica. La monografía lo
llevará completo como anexo, y su capítulo 4 tomará de él las capturas de cada
flujo. Por eso tiene que leerse como un manual: por capítulos, un flujo por
capítulo, con un paso por acción y lo que se ve en pantalla en ese paso.

## Hoy

- **Una sola página larga**, `/manual`, con trece secciones. El índice es una fila de anclas.
- **El texto vive dos veces y a mano.** Está en `docs/manual/README.md` (1891 líneas) y en `src/app/(app)/manual/page.tsx` (3244 líneas) junto con `manual-data.ts` (658). Ninguna prueba compara las dos copias. Las tablas de `manual-data.ts` copian a mano constantes del código, como las tolerancias y las etiquetas.
- **Las capturas no siguen un recorrido.** `docs/manual/capturas.mjs` toma 33 capturas navegando a datos ya sembrados; no recorre ningún flujo. El ancho y el alto de cada una se copian a mano en `CAPTURAS`; la doc técnica anota que nueve se habían desviado.

## Decisiones

**Del usuario (2026-10-08):**

1. **Una sola fuente en Markdown**: un archivo por capítulo en `docs/manual/`, que `/manual` lee y pinta en el servidor. Se acepta una dependencia para leer Markdown, porque no es una librería de componentes.
2. **Capítulos por flujo de usuario**, como un manual típico: una portada con índice, y una página por capítulo.
3. **Capturas de un recorrido real**: cada flujo se hace en la app, como lo haría un usuario, y se captura paso a paso.
4. **Lenguaje sencillo.**

**De implementación (tomadas en la apertura; revisables):**

| # | Decisión | Por qué |
|---|---|---|
| 5 | **`marked` 18.0.14**, fijado exacto, con un recorredor propio que convierte sus tokens en React | Es un solo paquete sin dependencias y con tipos. Los mismos tokens sirven para pintar, para el índice del capítulo y para las pruebas. No necesita `dangerouslySetInnerHTML` ni JS de cliente, y la CSP no cambia. `react-markdown` con `remark-gfm` arrastra unos 80 paquetes |
| 6 | **Los `.md` se leen con `fs` y viajan con la función** (`outputFileTracingIncludes` en `next.config.ts`) | Las rutas de `(app)` son dinámicas por las cookies del layout. Fuente: `node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/output.md` |
| 7 | **El ancho y el alto de cada captura van en `docs/manual/capturas.json`**, que escribe el recorrido; una prueba lo contrasta con la cabecera de cada PNG | Así los PNG no tienen que viajar con la función, y ninguna medida vuelve a copiarse a mano |
| 8 | **Las capturas se toman a DPR 2 y se muestran a la mitad**: 1280×800 en escritorio, 390×844 en el teléfono | Se ven nítidas, y cada una ocupa su tamaño natural sin el indicador `angosta` |
| 9 | **El recorrido usa su propia cuenta**, `manual@topofield.local`. Antes de empezar se borra con la API de administración, como hace el seed, y se vuelve a crear **por el formulario de registro**, con el código de `.env.local`, confirmando el correo en el servidor local (Inbucket) | El registro también es un flujo del manual. Su dashboard es el de un usuario nuevo: solo el proyecto de ejemplo y lo que crea el recorrido |
| 10 | **Los enlaces internos se escriben entre archivos** (`03-poligonal.md#ajustar`) y las anclas usan el slug de GitHub | Así el mismo Markdown funciona en GitHub y en la app |

## Alcance

### A. Una sola fuente

- **La portada y el índice.** `docs/manual/README.md` lleva una introducción breve, la lista de capítulos y, al final, «Mantener este manual»: la guía de estilo y cómo regenerar las capturas. Esa última sección no se pinta en la app.
- **Los capítulos.** Cada uno es `docs/manual/NN-<slug>.md`:
  - un `#` con el título;
  - un primer párrafo, que es su resumen: va bajo el título y en la tarjeta de la portada;
  - un `##` por flujo, que entra en el índice del capítulo, y un `###` por subsección.

  La lista de capítulos sale de los nombres de archivo; no hay un registro aparte.
- **Las imágenes.** Se escriben `![alt](../../public/manual/<slug>/NN-<paso>.png "pie opcional")`, solas en su párrafo o en su paso. Se pintan como `<figure>`, con enlace al PNG a tamaño completo y `width`/`height` sacados del manifiesto. La primera se carga de inmediato; las demás, `lazy`.
- **Cómo se pinta cada elemento:**
  - Una lista numerada se pinta como pasos, con contador.
  - `>` es una nota.
  - Las tablas GFM llevan el estilo actual: scroll horizontal y `th scope`.
- **Lo que se prohíbe.** El HTML crudo, las imágenes externas y los enlaces que no resuelven hacen fallar las pruebas.
- **Lo que se borra:** `src/app/(app)/manual/manual-data.ts`, el `page.tsx` actual, `docs/manual/capturas.mjs` y los 33 PNG sueltos de `public/manual/`.

Archivos nuevos:

| Archivo | Qué hace |
|---|---|
| `src/lib/manual/markdown.ts` | Puro: lee los tokens, saca el slug de cada título, el índice del capítulo, y resuelve enlaces e imágenes |
| `src/lib/manual/png.ts` | Puro: lee el ancho y el alto de la cabecera IHDR de un PNG; exporta `ESCALA_CAPTURAS = 2` |
| `src/lib/manual/manual.ts` | Lee la portada, los capítulos y el manifiesto con `fs`, dentro de `cache()`; da `capitulo(slug)` y `vecinos(slug)` |
| `src/components/manual/markdown.tsx` | El recorredor de tokens a React: Figura, Nota, Tabla y Pasos |
| `src/components/manual/indice-capitulo.tsx` | El índice del capítulo: fijo al lado en escritorio, en `<details>` en el teléfono; sin JS |
| `src/components/manual/navegacion-capitulos.tsx` | Anterior, siguiente y «Volver al índice» |
| `src/app/(app)/manual/[capitulo]/page.tsx` | La página de un capítulo: metadatos, y `notFound()` si el slug no existe |

`src/app/(app)/manual/page.tsx` se reescribe: es la portada, con una tarjeta
por capítulo.

### B. La portada y la página de un capítulo

- **La portada.** El título «Manual de usuario», la introducción del README y una cuadrícula de tarjetas: número, título y resumen de cada capítulo.
- **La página de un capítulo:**
  - La ruta dice Dashboard › Manual › el capítulo, con una etiqueta «Capítulo N».
  - En escritorio, el índice va a la izquierda y fijo al bajar; en el teléfono, plegado arriba en «En este capítulo».
  - Al final, anterior y siguiente, más «Volver al índice».
- **Al imprimir** sale el título del capítulo con su contenido, sin la barra, el índice ni la navegación, y ninguna figura se parte entre páginas. Es lo que usa el anexo de la monografía.

### C. Los capítulos

Todo lo que hay hoy en el manual tiene un capítulo donde ir:

| # | Archivo | Capítulo | Flujos (`##`) | Sale de |
|---|---|---|---|---|
| 01 | `01-primeros-pasos.md` | Primeros pasos | Crear su cuenta · Entrar · El proyecto de ejemplo · El dashboard · Moverse por la aplicación · Elegir el tema · Cómo se organiza TopoField · Nada se cierra: todo se recalcula | § 1, 2, 3, 8 |
| 02 | `02-proyectos.md` | Proyectos | Crear un proyecto · El proyecto por dentro · Los puntos de referencia · Encontrar un proceso · Duplicar, renombrar o eliminar · Archivar o eliminar un proyecto | § 4 |
| 03 | `03-poligonal.md` | La poligonal | Los tres tipos · Crear la poligonal · El amarre · Las mediciones · Cerrar la poligonal · Ajustar · Mínimos cuadrados · Mover y acercar el dibujo · Georreferenciar · El informe | § 5 |
| 04 | `04-nivelacion.md` | La nivelación | Los tres tipos · Cómo se lee la libreta · Crear la nivelación · La libreta armada por armada · La vuelta · Compensar · Ida y vuelta · Importar un archivo .L o CSV · El informe | § 6 |
| 05 | `05-asentamientos.md` | Control de asentamientos | Cómo se organiza · Crear el lugar · Los puntos · Los BM del lugar · Una visita · La libreta y la armada · Importar la libreta · Cómo se calcula · Los resultados · El panel del lugar · Dar de baja o de alta un punto · El informe | § 7 |
| 06 | `06-informe-y-excel.md` | El informe y el Excel | Qué lleva el informe · Exportar PDF · Exportar Excel · El libro de cada proceso | § 10, 11 |
| 07 | `07-equipos.md` | El catálogo de equipos | Agregar un equipo · Usarlo en un proceso · Por qué es una plantilla · La calibración | § 12 |
| 08 | `08-en-campo.md` | En campo, con el teléfono | La poligonal en el teléfono · La visita en el teléfono · Coma o punto decimal | § 9 |
| 09 | `09-preguntas-frecuentes.md` | Preguntas frecuentes y glosario | Las preguntas por tema, una `###` cada una para poder enlazarla · Glosario | § 13 y nuevo |

Los nombres de los flujos son el punto de partida: se ajustan al escribir, a
lo que el recorrido muestra.

### D. Redacción

- **El trato.** Se trata al lector de «usted», como hoy.
- **Frases y pasos.** Frases cortas y una acción por paso. Cada paso dice qué pulsar o escribir y qué aparece después.
- **Términos técnicos.** Cada término se explica la primera vez que sale y además va al glosario: amarre, armada, V+, V−, cota ajustada, orden, BM…
- **Sin rastro del desarrollo.** Ningún capítulo dice «§», «Fase N» ni «PRD».
- **Avisos.** Lo que la app avisa se cuenta como un aviso: qué significa y qué hacer.
- **Al migrar.** Se comparan las dos copias actuales párrafo por párrafo. Se conservan los textos alternativos del TSX, más ricos que los del Markdown, y lo que una copia tenga y la otra no. Solo se quita lo que ya no es cierto.

### E. El recorrido real

En `docs/manual/recorridos/` se lanza con `npm run manual:capturas
[capítulo…]`, sobre `npx supabase db reset && npm run seed` y con el dev
corriendo.

- **`comun.mjs`, lo común a todos:**
  - Prepara la cuenta del recorrido (decisión 9): la borra si existe, la registra por el formulario, confirma el correo con el enlace que deja Inbucket y entra a la app, que crea el proyecto de ejemplo.
  - Da `sql()` e `idDe()`; esta última falla con un mensaje claro si no encuentra lo que busca.
  - Abre la ventana de escritorio o la de teléfono.
  - Oculta el overlay de desarrollo y el correo, y espera la hidratación.
  - `paso()` escribe `public/manual/<slug>/NN-<paso>.png` y su entrada en `capturas.json`.
- **Un script por capítulo**, que exporta `recorrer()`. `todos.mjs` los lanza en orden y se detiene en el primer fallo.
- **Lo que se hace desde cero, con las carteras reales** (los datos se importan de `src/lib/demo/carteras.ts` y `cartera-asentamientos.ts`):
  - la cuenta, el proyecto y sus puntos de referencia;
  - la **TT4**: amarre, mediciones, cierre, ajuste por Brújula y su informe;
  - el **Vivero**: sin amarre, ajustado por mínimos cuadrados, y georreferenciado con D1 y D3;
  - **El Verjón**: la ida, la vuelta y la compensación;
  - el **tramo 2**: se importa `docs/carteras/CRDUDO-TRAMO2.L`;
  - el **control estructural**: 16 puntos y sus siete visitas, con el aviso de B10, el panel y una baja;
  - un equipo, y «Tomar del catálogo».
- **Lo que se lee de la demo:**
  - **Torre Alameda:** la visita de dos armadas, la del BM desplazado y el diálogo de la plantilla CSV.
  - **Los filtros del listado.**
  - **El informe como sale impreso,** con `emulateMedia print`.

  El Excel no se captura: se comprueba que la descarga ocurre.
- **Revisión.** Miro cada captura y el texto se ajusta a lo que hay en pantalla. Si el recorrido destapa un fallo de la app, se anota en `docs/pendientes.md` y se consulta al usuario; no se arregla dentro de esta fase.

### F. Pruebas (Vitest)

| Archivo | Qué comprueba |
|---|---|
| `src/lib/manual/markdown.test.ts` | Slugs con tildes y duplicados; enlaces entre capítulos, anclas y externos; rutas de imagen; escape de `<` y `&`; que el HTML crudo falle |
| `src/lib/manual/png.test.ts` | Lee una cabecera PNG y rechaza lo que no lo es |
| `src/lib/manual/manual.test.ts` | Sobre los archivos reales: numeración desde 01 sin huecos y slugs únicos; el README enlaza cada capítulo, en orden; cada capítulo empieza con su `#` y su resumen; ids únicos; cada imagen existe, tiene alt, está en la carpeta de su capítulo y figura en el manifiesto con su tamaño real; ningún PNG huérfano; todo enlace y ancla resuelve; sin «§», «Fase N» ni «PRD»; cada capítulo se pinta sin error |
| `src/lib/manual/constantes.test.ts` | Las tablas del manual que copian el código coinciden con las constantes: órdenes y tolerancias (`ANGULAR_TOLERANCE_K`, `MIN_RELATIVE_PRECISION`, `LEVELING_TOLERANCE_K`), el semáforo y las etiquetas de tipos y estados |
| `src/components/manual/markdown.test.tsx` | Con `renderToStaticMarkup`: ninguna figura dentro de un párrafo, el tamaño a la mitad, los ids en los títulos, los enlaces reescritos, los pasos, la nota y `th scope` |

`src/lib/design/ui-sin-notas-de-desarrollo.test.ts` deja de excluir
`app/(app)/manual/`.

## Fuera de alcance

- **Abrir el manual sin sesión.** Sigue bajo `(app)`.
- **Un buscador.**
- **Vídeos o capturas animadas.**
- **Arreglar los fallos que destape el recorrido.** Se anotan y se consultan (§ E).

## Criterios de aceptación

1. `/manual` muestra la portada con los nueve capítulos en orden, cada uno con su título y su resumen.
2. `/manual/<slug>` muestra el capítulo con:
   - su índice, al lado en escritorio y plegado a 390 px;
   - anterior, siguiente y «Volver al índice».

   Un slug que no existe da 404.
3. El texto del manual vive solo en `docs/manual/*.md`: no queda `manual-data.ts` ni texto del manual en TSX. El README se lee en GitHub con sus imágenes y sus enlaces.
4. Cada flujo tiene sus pasos numerados con su captura. Todas salen del recorrido sobre una base recién sembrada, y `npm run manual:capturas` las regenera.
5. Todo el contenido actual que sigue siendo cierto tiene su lugar en un capítulo.
6. El lenguaje es el del § D, y el capítulo 09 trae el glosario.
7. Se ve bien en claro y oscuro, a 1280 y a 390 px, sin desborde horizontal.
8. Al imprimir un capítulo sale su título y su contenido, sin la barra, el índice ni la navegación.
9. Pasan las comprobaciones:
   - `npm run typecheck`, `npm run lint`, `npm test` y `npm run build`;
   - el `page.js.nft.json` del capítulo lista los `.md` y `capturas.json`;
   - si la vista previa de Vercel deja entrar, muestra la portada y un capítulo antes del merge; si no, la ruta se prueba con `npm run build && npm start`, y el `nft.json` es la garantía de que los archivos viajan a Vercel (`next start` no usa el tracing).

## Documentación al cerrar

- **`docs/tecnica/README.md`:**
  - § 12, reescrita entera: estructura, decisiones, tracing y cómo verificarlo, pruebas;
  - el árbol del § 3;
  - la tabla y los recuentos del § 9;
  - el paso del manual en el § 10;
  - en el § 11, las entradas que tocan el manual y sus capturas.
- **`CLAUDE.md`:**
  - la línea de `src/app/(app)/manual/`;
  - sale «el texto vive por duplicado»;
  - `capturas.mjs` pasa a ser `npm run manual:capturas`;
  - la regla de cierre pasa a «su capítulo y su recorrido».
- **`docs/method.md` § 3:** una viñeta para el cierre de cada fase. Si cambió algo visible, se actualizan su capítulo y su recorrido; `npm test` vigila los enlaces, las capturas y las tablas.
- **Los índices:** `docs/prds/README.md` y la tabla de `docs/method.md`.
