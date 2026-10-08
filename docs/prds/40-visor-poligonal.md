# PRD-de-fase 41 — El dibujo de la poligonal como un mapa

**Estado:** en curso
**Fecha de apertura:** 2026-10-08

**Rama:** `fase-41-visor-poligonal`
**Petición:** del usuario, 2026-10-08: «quiero una mejora de UI/UX a la
sección que visualiza la poligonal: quitar los botones con flechas, y los de
zoom meterlos en el viewport del dibujo, una UX parecida a la que usa Google
Maps». En la apertura eligió **Ctrl + rueda** para acercar (la rueda sola
sigue bajando la página) y el **teclado sobre el dibujo** en lugar de las
flechas.
**Módulo:** `PolygonalPlotViewer`, el dibujo de los pasos Datos y Ajuste de la
poligonal. El informe (`PolygonalPlot` estático) no cambia.

## Hoy

Encima del dibujo hay una fila de botones: Acercar, Alejar, Restablecer, cuatro
flechas de desplazamiento y un texto («Acercamiento ×4. Arrastra el dibujo o
usa las flechas…»). El zoom va por pasos ×2 y siempre alrededor del centro; la
rueda no hace nada (Fase 13: la página del editor es larga).

## Qué cambia

### Controles dentro del dibujo

- **Sale la fila de botones** completa, con las flechas y el texto de ayuda.
- **Abajo a la derecha, sobre el dibujo**, una columna flotante como la de
  Google Maps: un grupo **+ / −** (acercar ×2, alejar ×2) y, encima, un botón
  aparte de **encuadrar** (vuelve a la vista inicial, el antiguo
  Restablecer), que solo se ve cuando la vista se movió. Botones cuadrados con
  icono SVG en línea, fondo `card`, borde `rule` y sombra suave; cada uno con
  `aria-label` y `title`. Abajo a la izquierda sigue la barra de escala y
  arriba a la derecha la flecha de norte: la esquina libre es la de abajo a la
  derecha.
- Los controles quedan sobre el `<svg>`, no sobre la leyenda.

### Gestos

- **Arrastrar** desplaza, como hoy (ratón y un dedo).
- **Ctrl + rueda** (⌘ + rueda en Mac) acerca o aleja **hacia el cursor**, de
  forma continua. El pellizco del trackpad llega al navegador como Ctrl +
  rueda y funciona igual.
- **La rueda sola** no se captura: la página baja. Sobre el dibujo aparece un
  aviso centrado, «Usa Ctrl + rueda para acercar» (o «⌘ + rueda» en Mac), que
  se desvanece al poco, como Google Maps embebido.
- **Doble clic** acerca ×2 hacia el punto.
- **Pellizcar** con dos dedos acerca o aleja alrededor del punto medio.
- El acercamiento va de ×1 (todo a la vista) a ×256, como hoy.

### Teclado

El dibujo es enfocable (`tabIndex=0`, con anillo de foco y una etiqueta que
dice qué teclas usa). Con el foco en él: **flechas** desplazan un 20 % del
ancho; **+** y **−** acercan y alejan ×2 alrededor del centro; **0**
encuadra. Las flechas solo se capturan con el foco en el dibujo.

### Puro y probado

El acercamiento hacia un punto va a una función pura,
`zoomAt(view, factor, dx, dy)` en `src/lib/design/polygonal-plot.ts`, con
tests: el punto del dibujo bajo `(dx, dy)` —medido desde el centro— queda en
el mismo sitio de la pantalla, y el zoom se acota a [1, 256]. Acercar desde los
botones es `zoomAt` con `(0, 0)`.

## Fuera

- El informe impreso: no tiene controles.
- Cambiar el encuadre, la exageración o la leyenda.

## Documentación

- Manual (las dos copias, § 5.5): los controles dentro del dibujo, Ctrl +
  rueda, doble clic, pellizco y teclado; sale la frase de que la rueda no
  hace zoom.
- Captura `20-dibujo-poligonal.png`: se regenera porque ahora lleva los
  controles.
- Doc técnica: «Trazas y dibujo», estado de fases y la tabla de pruebas.

## Criterios de aceptación

1. No queda la fila de botones ni las flechas; los controles **+ / −** y
   encuadrar están dentro del dibujo, abajo a la derecha, en los pasos Datos
   y Ajuste.
2. Ctrl + rueda acerca hacia el cursor; la rueda sola baja la página y
   muestra el aviso.
3. Doble clic acerca hacia el punto; arrastrar desplaza; pellizcar acerca en
   un teléfono.
4. Con el foco en el dibujo, flechas, + / − y 0 funcionan; Tab llega a los
   botones flotantes.
5. Encuadrar solo aparece con la vista movida y la devuelve al inicio.
6. Se ve bien en claro y oscuro, a 1280 y 390 px.
7. `npm run typecheck`, `npm run lint` y `npm test` pasan.
