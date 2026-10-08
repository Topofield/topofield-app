# PRD-de-fase 40 — Informes entregables

**Estado:** en curso
**Fecha de apertura:** 2026-10-08

**Rama:** `fase-40-informes-entregables`, desde `main`.
**Petición:** del usuario, 2026-10-08: «quiero que los informes sean
entregables que funcionen agnósticamente a lo que tenemos en la plataforma, es
decir no mencionar algo como "catálogo" o el enlace en el pie de página», y
«que en los informes solo aparezcan fórmulas que sí es necesario presentar,
como la de mínimos cuadrados en poligonales, no las de cómo calcular cotas en
control de asentamientos por ejemplo».
**Módulos:** el informe de los tres procesos (`components/reports/`,
`components/process/process-report.tsx`, `lib/reports/`), la hoja de impresión
de `globals.css`, la cabecera de los libros de Excel (`lib/export/`), una nota
de la demo y la documentación. **Sin cambios en la base ni en el motor.**

## Propósito

El informe es lo que el topógrafo entrega a su cliente o a su interventoría.
Tiene que leerse como un documento técnico propio, sin rastro de la
herramienta que lo produjo: ni su nombre, ni su URL, ni su vocabulario de
pantalla. Y sus fórmulas tienen que ser las que un revisor necesita para
entender o reproducir el ajuste, no la aritmética elemental del oficio.

## Hallazgos de la apertura

### 1. Menciones a la plataforma

| Dónde | Qué dice hoy |
|---|---|
| Portada (`report-cover.tsx`) | «TopoField — Informe técnico» |
| Pie del informe (`process-report.tsx`) | «Informe generado desde TopoField el …» |
| Encabezado y pie del PDF | La URL de la página, su título y la fecha: los imprime **el navegador** en los márgenes, no nuestro HTML |
| Cabecera de cada hoja del Excel (`cells.ts`) | «Exportado · fecha · Generado por TopoField» |
| Metadatos del Excel (`workbook.ts`) | `creator = "TopoField"` |

**«Catálogo»** no sale del código del informe: sale de las **Observaciones**
de la poligonal «Sede Vivero — sistema local» de la demo, que dicen «…con los
vértices D1 y D3 del catálogo (Georreferenciar, junto al dibujo)»
(`lib/demo/fixtures.ts`). Las observaciones son texto del usuario y el informe
las copia tal cual; la de la demo la escribimos nosotros.

### 2. Frases con el estado del proceso en la app

El informe de un proceso sin terminar habla como la pantalla:

- Nivelación: «**Libreta a medias.** La compensación se calcula cuando la
  libreta llega a su BM: el informe muestra lo medido.» El resumen de
  precisión dice «Libreta a medias» y «Libreta con errores».
- Asentamientos: «La visita 4 está en medición: entra al informe cuando se
  termine.»

### 3. Las fórmulas del informe

| Informe | Fórmula en bloque | ¿Hace falta? |
|---|---|---|
| Poligonal | Reparto angular e/n, con sus valores | No: es dividir entre n; el texto ya dice que el error «se repartió por igual» |
| Poligonal | Brújula (proporción a la longitud) | Sí: es el método de ajuste y justifica cada corrección |
| Poligonal | Tránsito (factor k por eje) | Sí, por lo mismo |
| Poligonal | Crandall (mínimos cuadrados en las distancias) | Sí, por lo mismo |
| Poligonal | Mínimos cuadrados (iteración) | Sí |
| Poligonal | Precisión de cada punto (elipse, factor c) | Sí: es la que da sentido a σ N, σ E y los semiejes |
| Nivelación | Ninguna en bloque; la tolerancia k·√K va en el texto | — |
| Asentamientos | AI = C_BM + V⁺ | No: aritmética de la nivelación geométrica |
| Asentamientos | C_i = AI − L_i | No |
| Asentamientos | S_i = (C_i − C_0)·1000 | No |
| Asentamientos | v = (S_i − S_i−1) / (días / 30.4375) | No como fórmula; sí su convención (mes de 30.4375 días) |

## Decisiones (del usuario, 2026-10-08)

1. **Pie propio en el PDF.** La hoja de impresión define las cajas de margen
   de `@page` (`@bottom-left`, `@bottom-right`, soportadas en Chrome desde la
   versión 131): a la izquierda, el proyecto y el proceso; a la derecha,
   «Página X de Y». Al definirlas, Chrome deja de imprimir su encabezado y su
   pie (URL, título, fecha). Se verifica al implementar.
2. **Fórmulas como en la tabla del hallazgo 3:** se quitan el reparto angular
   y las cuatro de asentamientos; se mantienen la del método de ajuste de la
   poligonal y la de la elipse.
3. **Se reescriben las frases del hallazgo 2** en lenguaje de informe
   técnico.

## Alcance

### A. Sin marca

- La portada dice «Informe técnico».
- Se quita el pie «Informe generado desde TopoField el …» (la fecha ya está en
  la portada, «Fecha del informe»).
- El Excel: la fila de cabecera dice «Exportado · fecha», sin «Generado por
  TopoField»; `creator` queda vacío.
- La nota de «Sede Vivero — sistema local» en la demo: «La cartera Vivero en
  sistema local, para georreferenciar con los vértices D1 y D3.» Solo cambia
  en las demos que se creen desde ahora; la de producción ya existe y es del
  usuario.

### B. Pie propio del PDF

- En `globals.css`, dentro de `@media print`, `@page` lleva
  `@bottom-left { content: <proyecto · proceso> }` y
  `@bottom-right { content: "Página " counter(page) " de " counter(pages) }`,
  con la tipografía y el gris del informe.
- El texto del proyecto y del proceso cambia por informe: lo inyecta el propio
  informe con un `<style>` que escapa la cadena como cadena CSS (comillas,
  barras invertidas y saltos de línea). No puede ir en `globals.css`.
- El margen inferior de la página se agranda lo justo para el pie.

### C. Fórmulas

- Poligonal, paso 1 · Ángulos: sin `<Formula>`; el texto da el valor:
  «…se repartió por igual en los n ángulos de la condición: c ″ por ángulo».
- Asentamientos, «Cómo se calcula»: sin las cuatro `<Formula>`. Queda un
  párrafo: las cotas son AI − lectura desde el BM, sin compensar (el cierre de
  cada tramo comprueba, no se reparte); el acumulado, en mm, es la diferencia
  con la cota inicial del punto; la velocidad, en mm/mes, con un mes de
  30.4375 días; y los umbrales del semáforo, como hoy.
- Las que se quedan no cambian.

### D. Redacción de informe

| Hoy | Queda |
|---|---|
| «**Libreta a medias.** La compensación se calcula cuando la libreta llega a su BM: el informe muestra lo medido.» | «**Nivelación incompleta.** El recorrido no llega a su BM de cierre: se presentan las cotas medidas, sin compensar.» |
| Resumen: «Libreta a medias» | «Incompleta» |
| Resumen: «Libreta con errores» | «Cartera con errores» |
| «La visita N está en medición: entra al informe cuando se termine.» | «La visita N (fecha) no se incluye: su medición está incompleta.» (y su plural) |

En la apertura de la ejecución se repasa el resto del texto de los tres
informes con el mismo criterio. Lo que aparezca se anota aquí como
divergencia.

## Fuera de alcance

- El contenido del Excel más allá de su cabecera: sus hojas ya son la forma de
  las carteras, sin vocabulario de la app.
- Las observaciones que escribe el usuario: el informe las copia tal cual.
- `docs/math/`: no cambia ninguna fórmula del motor.

## Criterios de aceptación

1. Ni el informe en pantalla ni su PDF dicen «TopoField» en ninguno de los
   tres procesos; el Excel tampoco, ni en sus celdas ni en sus metadatos.
2. El PDF impreso desde Chrome no lleva la URL ni el título de la página en
   los márgenes, y cada página lleva al pie el proyecto y el proceso, y
   «Página X de Y».
3. El informe de la poligonal no tiene fórmula en el paso de los ángulos y
   conserva la de su método de ajuste y, con mínimos cuadrados, la de la
   elipse.
4. El informe del lugar no tiene fórmulas en bloque y dice la convención del
   mes de 30.4375 días.
5. Las frases de la tabla D aparecen con su redacción nueva.
6. `npm run typecheck`, `npm run lint` y `npm test` pasan.

## Pruebas

- Test de la cabecera del Excel: no contiene «TopoField».
- Test del escape de la cadena CSS del pie (comillas, barra invertida, salto
  de línea).
- Los tests existentes del informe que fijan textos se actualizan a la
  redacción nueva.
- En pantalla, con Playwright: el PDF de Vivero, de El Verjón y de Torre
  Alameda (`page.pdf` con `displayHeaderFooter: false` no prueba lo de Chrome:
  la comprobación del criterio 2 se hace con la vista previa de impresión del
  navegador, o leyendo el texto del PDF generado con las cajas de margen).

## Documentación al cerrar

- Manual (las dos copias), § 10: el informe ya no lleva pie con la fecha; el
  PDF trae su pie propio con la paginación, y deja de depender de la opción
  «Encabezados y pies de página» del navegador. Capturas: solo las del informe
  que cambien.
- Doc técnica: estado de fases, tabla de pruebas y § 11.
