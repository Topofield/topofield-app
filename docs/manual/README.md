# Manual de usuario — TopoField

TopoField es una plataforma web para los trabajos topográficos de todos los
días: la poligonal, la nivelación y el control de asentamientos. Usted escribe
los datos de campo como en la cartera, la aplicación los calcula al momento y
le entrega un informe listo para el cliente, en PDF y en Excel.

Este manual va por capítulos, uno por cada cosa que se hace en la aplicación.
Cada uno explica el camino paso a paso, con lo que se ve en la pantalla. Los
ejemplos son carteras de campo reales.

## Capítulos

1. [Primeros pasos](01-primeros-pasos.md): crear la cuenta, entrar y moverse por la aplicación.
2. [Proyectos](02-proyectos.md): crear un proyecto, sus puntos de referencia y sus procesos.
3. [La poligonal](03-poligonal.md): medir, ajustar, georreferenciar e informar una poligonal.
4. [La nivelación](04-nivelacion.md): la libreta por armadas, la vuelta, la compensación y la importación desde un nivel digital.
5. [Control de asentamientos](05-asentamientos.md): el lugar, sus puntos, sus BM, las visitas y el panel.
6. [El informe y el Excel](06-informe-y-excel.md): qué lleva el informe y cómo exportarlo.
7. [El catálogo de equipos](07-equipos.md): guardar las estaciones totales y los niveles.
8. [En campo, con el teléfono](08-en-campo.md): capturar en el sitio de trabajo.
9. [Preguntas frecuentes y glosario](09-preguntas-frecuentes.md): las dudas comunes y las palabras técnicas.

La aplicación está publicada en
[topofield-app.vercel.app](https://topofield-app.vercel.app). Este mismo texto
se lee dentro de ella, en **Manual**.

## Mantener este manual

**Una sola fuente.** Cada capítulo es un archivo `NN-<slug>.md` de esta
carpeta, y la ruta `/manual` de la aplicación los lee y los pinta. No hay otra
copia del texto. La lista de capítulos sale de los nombres de archivo; este
README los enlaza en orden y su introducción, lo que va antes de
«Capítulos», es la portada del manual en la aplicación. Esta sección no se
pinta allí.

**La forma de un capítulo:**

- Un `#` con el título y, debajo, un párrafo de resumen: va bajo el título y en
  la tarjeta de la portada.
- Un `##` por cada flujo, que entra en el índice del capítulo, y `###` para
  las subsecciones. Sin números ni «·» en los títulos: las anclas se arman
  como las de GitHub.
- Una lista numerada es una secuencia de pasos; una lista con viñetas, una
  enumeración. `>` es una nota.
- Las capturas van solas en su párrafo o en su paso, con un texto alternativo
  que describa lo que se ve:
  `![…](../../public/manual/<capitulo>/NN-<paso>.png "pie opcional")`.
- Los enlaces entre capítulos se escriben entre archivos:
  `[Georreferenciar](03-poligonal.md#georreferenciar)`.
- Sin HTML, sin «§», sin «Fase N» ni «PRD»: es para quien usa la aplicación.

**El lenguaje.** Se trata al lector de «usted». Frases cortas y una acción por
paso: qué pulsar o escribir, y qué aparece después. Cada palabra técnica se
explica la primera vez y va al glosario del capítulo 9.

**Las capturas** salen de un recorrido real de la aplicación:
`docs/manual/recorridos/`, un script por capítulo. Requieren la base local y
el servidor de desarrollo:

```bash
npx supabase start
npm run dev
npm run manual:capturas            # todos los capítulos
npm run manual:capturas poligonal  # uno solo
```

El recorrido usa su propia cuenta, `manual@topofield.local`, que vuelve a
registrar por el formulario: no toca la cuenta del seed. Escribe las capturas
en `public/manual/<capitulo>/` y su tamaño en `capturas.json`. Cada pasada
reescribe los PNG: commitee solo los que cambian por lo que tocó.

**Las pruebas** (`npm test`) comprueban que cada capítulo se pinta, que cada
captura existe y está en el manifiesto con su tamaño real, que no sobran PNG,
que todo enlace y ancla resuelve, y que las tablas que copian reglas del
cálculo (órdenes, tolerancias, semáforo) coinciden con el código.
