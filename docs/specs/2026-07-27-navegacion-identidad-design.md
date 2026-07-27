# Navegación e identidad visual

**Fecha:** 2026-07-27
**Alcance:** chrome global, navegación entre niveles y lenguaje visual del sistema
de diseño.
**Naturaleza:** mejora transversal sobre funcionalidad ya entregada. Complementa
`2026-07-27-listado-procesos-design.md`.

---

## 1. Diagnóstico de navegación

### 1.1 El hub del proyecto no tiene retorno

Auditoría de los retornos existentes:

| Pantalla | Retorno |
|---|---|
| Editor de poligonal | «← Volver al proyecto» |
| Nuevo proyecto | «← Volver al dashboard» |
| Nueva poligonal | «← Volver al proyecto» |
| Proyecto no encontrado | «Volver al dashboard» |
| **Hub del proyecto** | **ninguno** |

El hub es la pantalla donde más tiempo se pasa y la única sin salida explícita.
El único camino de vuelta es el logotipo del header, que no se presenta como
control de navegación.

### 1.2 No hay sentido de ubicación

La aplicación tiene tres niveles —Dashboard → Proyecto → Proceso— pero ninguna
pantalla muestra la ruta completa. Dentro del editor de un proceso no aparece a
qué proyecto pertenece: el contexto se pierde al descender.

Los cuatro retornos existentes son enlaces sueltos, redactados de forma
inconsistente y colocados en el cuerpo de cada página en vez de en el chrome.

### 1.3 Las pestañas descartan los parámetros de consulta

`Tabs` (`src/components/design-system/tabs.tsx:29`) enlaza a
`${basePath}?tab=${id}`, reemplazando la cadena de consulta completa. Cuando el
listado de procesos incorpore `?q=`, `?estado=` y `?orden=` (spec de listado),
cambiar de pestaña y volver perderá el filtro aplicado.

## 2. Diagnóstico visual

La interfaz es funcional y legible, pero indistinguible de cualquier panel
administrativo genérico. Las causas son concretas:

1. **Tipografía sin identidad.** Todo el texto usa `system-ui`. El único
   tratamiento tipográfico propio es la monoespaciada de datos, ya implementada.
2. **Sin marca.** `public/` contiene únicamente los SVG por defecto de Next
   (`next.svg`, `vercel.svg`, `globe.svg`, `file.svg`, `window.svg`). No hay
   logotipo, isotipo ni favicon propios.
3. **Una sola superficie.** Tarjetas de contenido, paneles de datos y contenedores
   de acción comparten `border-neutral-200` + `bg-white` + `shadow-sm`. Nada
   destaca porque todo pesa igual.
4. **Azul infrautilizado.** La paleta define `#0b3d5c` y `#1a7fb5`, pero solo
   aparecen en botones y enlaces. El azul es la marca y no se ve.
5. **Sin estados intermedios.** No hay skeletons de carga, el hover es un cambio
   de borde apenas perceptible y el foco depende del anillo por defecto.

## 3. Decisiones

Tomadas con el usuario:

| Eje | Decisión |
|---|---|
| Tipografía | Fuente propia para títulos; cuerpo en system-ui; datos en monoespaciada |
| Jerarquía de superficie | Sí |
| Acento topográfico | Sí, sutil |
| Microinteracciones y estados | Sí |
| Identidad de marca | Sí |

## 4. Diseño de navegación

### 4.1 Migas de pan en el chrome global

Sustituyen los cuatro enlaces «← Volver» dispersos por un único mecanismo,
alojado en `src/app/(app)/layout.tsx` bajo el header:

```
┌──────────────────────────────────────────────────────────────┐
│  ◈ TopoField                          usuario@…   Cerrar sesión│
├──────────────────────────────────────────────────────────────┤
│  Dashboard  ›  Lote catastral  ›  Cuadrado con error 0.4 m    │
└──────────────────────────────────────────────────────────────┘
```

Resuelve las tres carencias a la vez: da el retorno que falta, comunica la
ubicación y permite saltar a cualquier nivel sin pasar por el intermedio.

**Construcción.** Cada página declara su ruta; el layout la renderiza. Como el
layout es un Server Component que no conoce los datos de la página (nombre del
proyecto, nombre del proceso), la ruta se pasa desde cada página. Dos opciones de
implementación, a decidir en el plan:

- Un componente `<Breadcrumbs items={[…]} />` que cada página renderiza como
  primer elemento de su contenido, con estilo unificado.
- Un slot paralelo de Next (`@breadcrumbs`) en el layout.

La primera es más simple y suficiente; la segunda es más pura pero añade
estructura de rutas. **Se recomienda la primera.**

El último elemento es el actual: se muestra como texto, no como enlace, y lleva
`aria-current="page"`. El contenedor es un `<nav aria-label="Ruta de navegación">`
con lista ordenada, que es la semántica estándar para migas de pan.

En móvil, la ruta completa no cabe. Por debajo de 640 px se muestra solo el nivel
anterior con una flecha de retorno («‹ Lote catastral»), que es el control que
realmente se necesita en pantalla pequeña.

### 4.2 Rutas por pantalla

| Pantalla | Ruta |
|---|---|
| Dashboard | (ninguna; es la raíz) |
| Nuevo proyecto | Dashboard › Nuevo proyecto |
| Hub del proyecto | Dashboard › {nombre del proyecto} |
| Nueva poligonal | Dashboard › {proyecto} › Nueva poligonal |
| Editor de poligonal | Dashboard › {proyecto} › {nombre del proceso} |

Los nombres largos se truncan con elipsis por CSS, conservando el texto completo
en el atributo `title`.

### 4.3 El logotipo como enlace explícito

El logotipo del header conserva su enlace al dashboard, pero gana tratamiento de
control: estado hover, foco visible y `aria-label` descriptivo. Deja de ser la
única salida —esa función pasa a las migas— pero deja de ser también un enlace
invisible.

### 4.4 Las pestañas preservan la consulta

`Tabs` recibe los `searchParams` actuales y construye cada enlace conservando los
parámetros existentes, reemplazando únicamente `tab`. Sin esto, la spec del
listado de procesos pierde su estado al cambiar de pestaña y volver.

## 5. Diseño visual

### 5.1 Tipografía

| Rol | Familia | Uso |
|---|---|---|
| Títulos | **Space Grotesk** | `h1`–`h3`, cifra del veredicto, marca |
| Cuerpo | system-ui (actual) | Etiquetas, párrafos, formularios, botones |
| Datos | monoespaciada (actual) | Coordenadas, azimuts, precisiones |

**Por qué Space Grotesk.** Es una grotesca de construcción técnica: terminaciones
rectas, aberturas cerradas y dígitos de aire cartográfico. Evoca la rotulación de
instrumentos topográficos y de planchas catastrales sin recurrir a la serif
editorial de alto contraste, que es el recurso previsible para «dar carácter» y
que además chocaría con la densidad de datos de esta aplicación. Emparenta
visualmente con la monoespaciada ya presente en las tablas, de modo que títulos y
datos se leen como un mismo sistema y el cuerpo neutro queda entre ambos.

Se carga con `next/font/google`, que descarga y autohospeda la fuente durante el
build: sin peticiones a terceros en tiempo de ejecución, sin coste de privacidad
y sin dependencia de red del usuario. Verificado que la API de Google Fonts
responde en este entorno de build.

El cuerpo permanece en `system-ui` deliberadamente: los formularios densos y las
tablas de captura funcionan bien hoy, y cambiarlos arriesga legibilidad sin
ganancia de identidad, porque la personalidad se percibe en los títulos.

### 5.2 Jerarquía de superficie

Se introducen tres niveles, en lugar de la tarjeta blanca única:

| Nivel | Uso | Tratamiento |
|---|---|---|
| **Lienzo** | Fondo de página | `neutral-50`, con retícula sutil (§ 5.4) |
| **Panel** | Tarjetas de contenido, listados | `bg-white`, borde `neutral-200`, sombra suave |
| **Destacado** | Veredicto de cierre, KPI | Fondo teñido del color de estado, borde del mismo tono |

El veredicto de cierre ya usa el tercer nivel; esta spec lo formaliza como parte
del sistema en vez de como caso particular.

### 5.3 Color

La paleta no cambia: se usa lo que ya está definido y se aplica con más
intención.

- **`primary-600` (`#0b3d5c`)** pasa a ser el color de los títulos, en lugar del
  `neutral-900` actual. Es el cambio de mayor efecto y menor riesgo: tiñe toda la
  aplicación con la marca sin tocar la legibilidad del cuerpo.
- **`primary-500` (`#1a7fb5`)** se mantiene para acciones e interactividad.
- **Ámbar (`warning-500`)** sigue reservado exclusivamente a «cerrado fuera de
  tolerancia», según la spec anterior.
- El contraste de cada combinación debe verificarse contra WCAG AA (4.5:1 para
  texto normal, 3:1 para texto grande).

### 5.4 Acento topográfico

Es el elemento distintivo del sistema, y por eso se aplica con restricción: dos
lugares, no más.

1. **Curvas de nivel en el encabezado del proyecto.** Un patrón SVG de líneas de
   nivel concéntricas, en `primary-500` a opacidad muy baja (≈0,04), alineado al
   borde derecho del `ProjectHeader`. Alude a la plancha topográfica sin competir
   con los datos.
2. **Retícula en el lienzo.** Una cuadrícula de 8 px en `neutral-200` a opacidad
   ≈0,4 sobre el fondo de página, como el papel milimetrado de una cartera de
   campo. Debe ser apenas perceptible: si se nota como textura, está mal
   calibrada.

Ambos son decorativos: `aria-hidden`, sin contenido semántico, y no deben
interferir con la legibilidad de ningún texto superpuesto.

**Lo que se descarta explícitamente:** ilustraciones de instrumentos, iconografía
de brújulas o teodolitos, y fondos con gradientes. Convertirían una herramienta
profesional en algo decorativo.

### 5.5 Marca

- **Isotipo**: marca geométrica derivada del símbolo de punto de control
  topográfico —un triángulo con vértice marcado, que es el signo convencional de
  vértice geodésico en cartografía—. SVG inline, sin dependencias.
- **Logotipo**: isotipo + «TopoField» en Space Grotesk.
- **Favicon**: el isotipo, en los tamaños que Next requiere vía `app/icon.svg`.
- Se eliminan los SVG por defecto de Next que quedaron en `public/`.

### 5.6 Microinteracciones y estados

- **Hover** en filas del listado y tarjetas: cambio de fondo, no solo de borde.
  Debe percibirse sin buscarlo.
- **Foco visible**: anillo de 2 px en `primary-500` con desplazamiento, coherente
  en todos los controles. Nunca `outline: none` sin sustituto.
- **Carga**: skeletons con la forma del contenido que reemplazan, usando los
  `loading.tsx` de App Router. Hoy no hay ninguno.
- **Transiciones**: 150–200 ms en color y fondo. Nada de animaciones de entrada,
  desplazamiento o escala.
- **`prefers-reduced-motion`**: respetado en todo lo anterior.

## 6. Fuera de alcance

- Modo oscuro.
- Rediseño de la paleta base.
- Animaciones de entrada de página o transiciones de ruta.
- Ilustraciones a medida para estados vacíos, más allá del isotipo.
- Cambiar la tipografía del cuerpo o de los datos.

## 7. Criterios de aceptación

1. Toda pantalla por debajo del dashboard muestra su ruta de navegación.
2. Cada nivel intermedio de la ruta es un enlace funcional; el último no es
   enlace y lleva `aria-current="page"`.
3. Las migas usan `<nav>` con lista y etiqueta accesible.
4. Por debajo de 640 px se muestra el retorno al nivel anterior en lugar de la
   ruta completa.
5. Los cuatro enlaces «← Volver» actuales quedan sustituidos por las migas, sin
   duplicación.
6. Cambiar de pestaña en el hub conserva los demás parámetros de consulta.
7. Los títulos usan Space Grotesk, autohospedada vía `next/font`, sin peticiones
   externas en tiempo de ejecución.
8. El cuerpo sigue en system-ui y los datos en la monoespaciada.
9. Existen tres niveles de superficie distinguibles.
10. El acento topográfico aparece únicamente en el encabezado de proyecto y en el
    lienzo, es `aria-hidden` y no reduce la legibilidad de ningún texto.
11. Existe isotipo propio y favicon; los SVG por defecto de Next fueron
    eliminados.
12. Todo control tiene foco visible; ningún `outline: none` sin sustituto.
13. Las combinaciones de color cumplen WCAG AA.
14. `prefers-reduced-motion` se respeta.
15. `npm run typecheck`, `npm run lint`, `npm run test` y `npm run build` pasan.
