# PRD-de-fase 45 — La página de presentación

**Estado:** en curso
**Fecha de apertura:** 2026-11-21

**Rama:** `fase-45-landing`
**Petición:** del usuario, 2026-11-21: «quiero diseñar la landing page de
topofield, en el hero poner una mención a que es un trabajo para la universidad
distrital y pones el logo». Al preguntarle para quién era la página: «arranca
sin preguntar». Lo que la petición no dice lo decide este PRD, y cada decisión
va marcada como tal.
**Módulo:** la raíz del sitio (`/`), que hoy no pinta nada.

> **Divergencias de la implementación:**
>
> - **El amarillo «mira» marca solo el arranque del dibujo** (V10); los lados
>   van en tinta, como la ajustada en la aplicación.
> - **La guarda de notas de desarrollo** (`ui-sin-notas-de-desarrollo.test.ts`,
>   Fase 22) prohíbe la palabra «universidad» en la interfaz y saltó con la
>   mención. Se le levantó esa regla, y solo esa, a `app/page.tsx` y a
>   `components/landing/mencion-ud.tsx`.
> - **Las capturas de «Primeros pasos» se renumeran:** el recorrido empieza
>   en la presentación, que es la 01, y las siete que había pasan de 01–07 a
>   02–08 con los mismos bytes. La de inicio de sesión baja a «Entrar».
> - **Las capturas de la página van con `next/image`,** no con `<img>` como en
>   el manual: son de 2560 px y aquí se ven a 720.
> - **Verificación en pantalla** en local, sin sesión: claro y oscuro a 1280,
>   y a 390 y 320 px sin desborde; el trazo, con y sin «reducir movimiento»;
>   el orden del foco con teclado; los tres enlaces; el logo del inicio de
>   sesión vuelve a `/`, y con sesión `/` lleva al dashboard.

## Qué hay hoy

`/` no tiene página: `src/app/page.tsx` redirige a `/dashboard`, y sin sesión
el proxy lo lleva a `/sign-in`. Quien abre la dirección de TopoField sin cuenta
ve un formulario y nada que diga qué es la aplicación ni de dónde sale.

## Qué se construye

Una página pública en `/` que presenta TopoField a quien llega sin sesión: el
jurado y los profesores que abren la dirección de la monografía, y el topógrafo
que la recibe de un colega. Con sesión, `/` sigue llevando al dashboard.

### Decisiones

1. **Solo sin sesión.** El proxy ya deja pasar `/` sin sesión y ya lleva al
   dashboard a quien la tiene: no cambia. Cambia `src/app/page.tsx`, que deja
   de redirigir y pinta la página.
2. **La acción es «Iniciar sesión».** El registro pide código de invitación,
   así que la página no ofrece una cuenta abierta: el botón principal lleva a
   `/sign-in`, y el secundario, «Crear cuenta», a `/sign-up`, con la nota de
   que pide el código.
3. **La mención a la universidad va en el hero, antes del titular:** el escudo
   y, a su lado, en texto, «Trabajo de grado en Ingeniería Topográfica»,
   «Universidad Distrital Francisco José de Caldas» y la facultad. Los datos
   son los de la portada de la monografía.
4. **El escudo, sin su rótulo, a una tinta.** El archivo oficial trae el
   escudo y debajo el nombre de la universidad; al tamaño del hero ese rótulo
   no se lee, así que se recorta y el nombre va en texto. El escudo es negro
   sobre blanco: para que valga en el tema oscuro se guarda como trazo
   (`public/landing/escudo-ud.png`: la luminancia del original pasada a
   transparencia) y se pinta con el color de la tinta mediante una máscara de
   CSS. Sale oscuro en claro y claro en oscuro, sin un segundo archivo.
5. **El dibujo del hero lo calcula el motor.** A la derecha del titular va la
   poligonal V10 del proyecto de ejemplo (la cartera TT4, seis vértices): sus
   lados con azimut y distancia, el dibujo de la ajustada y su cierre. No son
   cifras escritas a mano: `src/lib/landing/poligonal-ejemplo.ts` pasa la
   cartera por `computePolygonalDetected` y `polygonalTraces` al pintar la
   página. Es lo más propio del oficio que la página puede enseñar, y si el
   motor cambia, la página cambia con él.
6. **Un solo movimiento:** al cargar, los lados se trazan en orden, de V10 a
   V10. Nada más se anima. Con «reducir movimiento», la regla global de
   `globals.css` lo deja quieto y completo.
7. **Debajo del hero, lo que lleva la aplicación, con capturas reales:** la
   poligonal, la nivelación, los asentamientos y el informe, cada uno con dos
   o tres frases y una captura del manual (`public/manual/…`). No se generan
   capturas nuevas para la página: son las del manual, que ya se regeneran con
   él. Una prueba comprueba que las que usa siguen en `capturas.json`.
8. **Un cierre corto:** que el motor se contrastó con carteras de campo
   reales, y otra vez el botón de entrar. Al pie, el autor y la universidad.
   El nombre del autor ya es público en `PRD-TopoField.md`; el del director no
   está en el repositorio y no se añade.
9. **El logo de las pantallas de entrada enlaza a `/`,** para volver a la
   presentación desde el inicio de sesión y el registro.
10. **Sin enlace al manual:** `/manual` pide sesión y eso no cambia.

### El diseño

La identidad es la de la aplicación (Fase 20) y no se le añade nada: papel
cuadriculado, tinta, el amarillo «mira» solo en la acción principal y en el
arranque del dibujo, Barlow en el cuerpo y Barlow Semi Condensed en los títulos.
Ningún token nuevo.

```
┌──────────────────────────────────────────────────────────────────┐
│ △ TopoField                                  [tema] [Iniciar sesión] │
├──────────────────────────────────────────────────────────────────┤
│ [escudo] Trabajo de grado en Ingeniería Topográfica                │
│          Universidad Distrital Francisco José de Caldas            │
│          Facultad del Medio Ambiente y Recursos Naturales          │
│                                                                    │
│ La cartera de campo,               ┌──────────────────────────┐   │
│ calculada mientras                 │ Lado    Azimut    Dist.  │   │
│ se escribe.                        │ V10→D1  181°51′…  20.744 │   │
│                                    │ …            ⬠ dibujo    │   │
│ TopoField lleva poligonales, …     │ 12″ · 0.016 m · 1:7045   │   │
│ [Iniciar sesión] [Crear cuenta]    └──────────────────────────┘   │
├──────────────────────────────────────────────────────────────────┤
│ Poligonal      texto                 │ captura                     │
│ Nivelación     texto                 │ captura                     │
│ Asentamientos  texto                 │ captura                     │
│ Informe        texto                 │ captura                     │
├──────────────────────────────────────────────────────────────────┤
│ Contrastado con carteras de campo reales        [Iniciar sesión]   │
│ pie: autor · programa · universidad · Bogotá, 2026                 │
└──────────────────────────────────────────────────────────────────┘
```

Todo alineado a la izquierda, sobre una columna de 72 rem como máximo. En el
móvil, una sola columna: la mención, el titular, los botones, el dibujo.

## Qué no entra

- Registro abierto, formulario de contacto o lista de espera.
- El manual público.
- Analítica, SEO más allá del título y la descripción, imagen para redes.
- Una versión en otro idioma.

## Criterios de aceptación

- Sin sesión, `/` pinta la página; con sesión, lleva a `/dashboard`.
- El hero muestra el escudo de la Universidad Distrital y la mención del
  trabajo de grado, y ambos se leen en claro y en oscuro.
- Las cifras del dibujo del hero son las del motor: 12″ de error angular,
  1:7045 y tercer orden para la cartera TT4.
- «Iniciar sesión» lleva a `/sign-in` y «Crear cuenta» a `/sign-up`.
- A 390 px no hay desborde horizontal; a 1280 px el hero cabe en la primera
  pantalla.
- Navegable con teclado, con el foco visible; el escudo y el dibujo tienen
  nombre accesible.
- `npm run typecheck`, `npm run lint`, `npm test` y `npm run build` pasan.

## Pruebas mínimas

- `src/lib/landing/poligonal-ejemplo.test.ts`: la poligonal del hero sale del
  motor con el cierre de la cartera, seis lados, y el dibujo cierra en el
  arranque.
- `src/lib/landing/capturas.test.ts`: cada captura que la página enseña está
  en `docs/manual/capturas.json`.

## Documentación

- Manual, «Primeros pasos»: abrir TopoField lleva ahora a la presentación; el
  paso 1 lo dice, con su captura.
- Doc técnica: el mapa de rutas, la tabla de pruebas y el estado de fases.
- `CLAUDE.md`: la ruta raíz y `src/components/landing/` en la arquitectura.
