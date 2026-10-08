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

## Sumado: las variables de las fórmulas del informe

**Petición:** del usuario, 2026-10-08, tras cerrar la Fase 40: «creo que
podemos agregar un texto pequeño para la convención de las variables de las
fórmulas en los informes». Aprobó una leyenda «donde:» bajo cada fórmula y,
de paso, corregir una frase de la app que la Fase 40 dejó. Eligió sumarlo a
esta fase. Va en su propia rama, `fase-41-leyendas`, desde la de la fase, y
se fusiona en ella. Toca `components/reports/math.tsx`,
`polygonal-correction.tsx`, `.report-formula-caption` y la documentación; no
toca el dibujo.

### Hoy

Desde la Fase 40 el informe solo lleva las fórmulas del ajuste, todas en la
poligonal, y casi ningún símbolo se explica:

| Fórmula | Símbolos | Se explican hoy |
|---|---|---|
| Brújula | C_N,i, C_E,i, e_N, e_E, d_i, P | e_N y e_E, en el texto |
| Tránsito | C_N,i, C_E,i, e_N, e_E, \|ΔN_i\|, \|ΔE_i\|, k_N, k_E | k, en el pie de la fórmula |
| Crandall | δd_i, d_i, Az_i, λ₁, λ₂, e_N, e_E | e_N y e_E, en el texto |
| Mínimos cuadrados | v, Q, A, w, σ_j, σ_d,ef, σ_d, n, σ₀, P, r | σ y n, en la tabla de pesos |
| Precisión de cada punto | Q_l̂, Q, A, Σ_NE, σ₀, J, c, F, r | c y r, en el texto |

La P vale dos cosas: el perímetro en la Brújula y la matriz de pesos en
mínimos cuadrados. Con una leyenda por fórmula no se confunden. Y la sección
de mínimos cuadrados todavía dice «Sin ajuste: … faltan los pesos del
ajuste.», que se dirige al usuario de la app.

### Qué cambia

- `Formula` recibe `legend?: [ReactNode, string][]`, pares de símbolo y
  significado, y pinta debajo de la fórmula —antes del `caption`— una línea
  «donde: símbolo — significado · …», en texto con `<sub>` y en el gris
  pequeño del `caption`, alineada a la izquierda. El `caption` de Tránsito
  («k: corrección unitaria de cada eje») pasa a la leyenda.
- Las leyendas:

| Fórmula | Leyenda |
|---|---|
| Brújula | C_N,i, C_E,i — corrección a las proyecciones norte y este del lado i · e_N, e_E — error de cierre en norte y este · d_i — longitud del lado i · P — perímetro, la suma de las longitudes |
| Tránsito | C_N,i, C_E,i — corrección a las proyecciones norte y este del lado i · e_N, e_E — error de cierre en norte y este · \|ΔN_i\|, \|ΔE_i\| — proyección absoluta del lado i en cada eje · k_N, k_E — corrección unitaria de cada eje |
| Crandall | δd_i — corrección a la longitud del lado i · d_i — longitud del lado i · Az_i — azimut del lado i, ya corregido · e_N, e_E — error de cierre en norte y este · λ₁, λ₂ — multiplicadores de Lagrange de las dos condiciones |
| Mínimos cuadrados | v — correcciones a las observaciones · Q — matriz cofactor de las observaciones · A — derivadas de las condiciones respecto a las observaciones · w — lo que falta para cumplir cada condición · σ_j — precisión a priori de la observación j · σ_d — precisión de una medición de distancia · n — veces que se midió cada distancia · P — matriz de pesos, Q⁻¹ · r — redundancia, el número de condiciones · σ₀ — error estándar de la unidad de peso |
| Precisión de cada punto | Q_l̂ — cofactor de las observaciones ajustadas · Σ_NE — covarianza de las coordenadas norte y este del punto · J — derivadas de las coordenadas del punto respecto a las observaciones · c — factor de la elipse al nivel de confianza · F — cuantil de la distribución F de Fisher · r — redundancia |

  En «Precisión de cada punto», Q, A y σ₀ ya se explicaron en la fórmula de
  mínimos cuadrados, justo arriba: no se repiten.
- «Sin ajuste: faltan los pesos del ajuste.» pasa a «Sin ajuste: no se
  declararon las precisiones a priori de los ángulos y las distancias.», como
  en la sección de resultado (Fase 40).
- Fuera: el Excel (no muestra fórmulas en notación) y `docs/math/` (ya
  define sus símbolos).

### Pruebas y documentación

- `math.test.tsx`: `Formula` con `legend` pinta «donde:» y cada par; sin
  `legend`, nada. `polygonal-correction.test.tsx`: la Brújula lleva
  «P — perímetro» y Tránsito «k<sub>N</sub>, k<sub>E</sub> — corrección
  unitaria»; mínimos cuadrados sin pesos no dice «faltan los pesos».
- En pantalla: el informe de la TT4 y el de Vivero.
- Manual (las dos copias, § 5.7): cada fórmula dice qué es cada símbolo.
  Capturas 10 y 21 si cambian. Doc técnica: la tabla de pruebas.

### Criterios de aceptación

8. Las cinco fórmulas del informe de la poligonal llevan su línea «donde:»
   con las leyendas de la tabla, en pantalla y en el PDF; Tránsito ya no
   lleva aparte el pie de k.
9. La sección de mínimos cuadrados sin pesos no dice «faltan los pesos».
