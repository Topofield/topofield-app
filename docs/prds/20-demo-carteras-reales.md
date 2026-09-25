# PRD-de-fase 21 — La demo con las carteras reales

**Estado:** en curso
**Fecha de apertura:** 2026-09-25
**Fecha de cierre:** —

**Rama:** `fase-21-demo-carteras-reales`
**Petición:** del usuario, 2026-09-25: «que la demo tenga su homólogo con las
carteras reales que hemos trabajado, exceptuando control de asentamientos,
donde usaremos la simulación del prototipo»; y revisar la app en producción
con capturas en los dos temas.
**Módulo:** el proyecto de ejemplo (`src/lib/demo/`), el seed y el manual

## Propósito

El «Proyecto de ejemplo» que recibe cada usuario nuevo está hecho de datos
sintéticos: cuadrados y rectángulos que cierran bajo cualquier convención, un
circuito de 0.9 km y un edificio de seis puntos. Desde la Fase 7 el proyecto
se valida contra **carteras de campo reales** (`docs/carteras/`), y son ellas
las que muestran lo que la aplicación hace de verdad: la TT4 con su fila de
cierre, la Vivero ajustada por mínimos cuadrados y georreferenciable, El Verjón
con ida y vuelta por los mismos puntos y visuales desequilibradas, el crudo de
un nivel digital Leica. El control de asentamientos no tiene cartera real: usa
la simulación del prototipo del usuario, **Torre Alameda**.

## Decisiones del usuario (apertura)

1. **Se sustituye el contenido de la demo**, no se añade un segundo proyecto.
   Los usuarios que ya tienen la demo conservan la suya.
2. **Producción:** los datos de la cuenta del usuario no importan; se puede
   rehacer lo que haga falta.

## Hallazgos que condicionan la fase

### 1. Producción tiene un solo usuario, y aún sin demo

Consultado en la nube (solo lectura): `topofieldsarf@gmail.com`, confirmado,
**0 proyectos** y `demo_seeded_at` nulo — se vació en la Fase 18. La demo se
crea en el primer acceso tras el despliegue, así que **no hay que borrar nada**:
basta desplegar y entrar.

### 2. Las carteras reales no están todas en `src/`

| Cartera | Dónde está hoy | Qué falta |
|---|---|---|
| TT4 y Vivero (poligonales) | `lib/demo/carteras.ts`, con sus tests | Nada |
| El Verjón (nivelación, ida y vuelta) | Solo en tests, **sin distancias**; completa en `docs/carteras/TRABAJO NIVELACION EL VERJON-corregido.xlsx` | Transcribir V+, V− y distancias por visual |
| Crudo Leica, tramo 2 (nivel digital) | `docs/carteras/CRDUDO-TRAMO2.L` (6.6 KB), fuera del bundle | Llevar el texto a `src/` |
| Torre Alameda (asentamientos) | La serie y sus BMs viven en `scripts/seed.mjs` | Llevarlos a `lib/demo/` |

`docs/` no se despliega: lo que la demo use en producción tiene que estar en
`src/`.

### 3. Los `insertar-*` de la demo se quedan cortos para datos reales

- `insertar-nivelacion.ts` calcula la vuelta pero **solo guarda la ida**.
- `insertar-poligonal.ts` fija `hasClosingRow: false` y no admite amarre a un
  punto de referencia ni pesos de mínimos cuadrados.
- `insertar-asentamiento.ts` admite **un** BM de amarre; Torre Alameda alterna
  dos.
- El seed ya hace todo eso, pero con su propio código (`scripts/seed.mjs`).

### 4. La demo pierde dos tipos de poligonal

Las carteras reales son **cerradas**. La demo actual enseña además una de
enlace y una abierta sin control, que ninguna cartera real cubre. Con la
sustitución, esos dos tipos solo se ven creando una poligonal nueva.

## Contenido de la demo nueva

**Proyecto:** «Proyecto de ejemplo», cliente «Carteras de campo reales»,
Bogotá, MAGNA-SIRGAS · Origen Bogotá. Descripción: de dónde sale cada
cartera. **Catálogo de puntos de referencia:** TT4, 14_IS1 (amarres), D1 y D3
(para georreferenciar la Vivero local), y los BMs de las nivelaciones.

**Lugar «Levantamientos de campo»** — poligonales y nivelaciones:

| Proceso | Cartera | Estado |
|---|---|---|
| Poligonal V10 — cartera TT4 | TT4, Bowditch, fila de cierre contra el amarre | **cerrada** (alimenta su informe) |
| Poligonal Famarena — Sede Vivero | Vivero, mínimos cuadrados con los pesos de la hoja (2″, 0.011 m, 2 mediciones) | calculada |
| Poligonal Famarena — Sede Vivero — sistema local | Vivero en (1000, 2000), azimut 0° | calculada, lista para georreferenciar con D1 y D3 |
| El Verjón — ida y vuelta | Ida y vuelta por los mismos puntos: puntos homólogos y avisos de equilibrado | calculada |
| Tramo 2 — crudo Leica | El `.L` leído por el importador de la Fase 16, como un recorrido cerrado C10 → C10 | **cerrada** (alimenta su informe) |

**Lugar «Torre Alameda»** — la simulación del prototipo, como en el seed: ocho
puntos, catorce visitas con libreta, BM-1 y BM-2 alternados, la visita 9 fuera
de tolerancia. **Cerrado** tras su última visita, para que tenga informe.

**Informes:** uno por módulo, como hoy (TT4, crudo Leica, Torre Alameda).

## Decisiones

| # | Decisión | Razón |
|---|---|---|
| 1 | Los datos reales van a `src/lib/demo/`, **una sola copia** que usan la demo, el seed y los tests | Hallazgo 2. Es la regla de `carteras.ts`: si el seed replicara los números, dejaría de verificar lo mismo que los tests |
| 2 | El Verjón se transcribe **completo**, con distancias por visual, desde la hoja corregida | Sin distancias no hay equilibrado ni tolerancia, que es lo que la cartera enseña |
| 3 | El crudo Leica va a `src/` **como texto** y se lee con el importador de la Fase 16; un test comprueba que es idéntico a `docs/carteras/CRDUDO-TRAMO2.L` | Recorre el mismo camino que un usuario que importa el archivo, y no puede divergir del original |
| 4 | Los resultados los sigue calculando **el motor**, nunca el fixture | Estrategia de la demo desde su creación |
| 5 | Se amplían los `insertar-*` (vuelta, fila de cierre, amarre, mínimos cuadrados, dos BMs) en vez de copiar el seed | Hallazgo 3 |
| 6 | Equipo por proceso: el que declara la cartera cuando lo declara (el `.L` dice el instrumento); si no, el mismo que usa hoy el seed para esa cartera | Un instrumento real con su ficha, no inventado (aprendizaje de la Fase 8) |
| 7 | Quien ya tiene la demo **conserva la suya** | Decisión del usuario 1 |

## Producción (tras el merge)

1. El despliegue de `main` lleva la demo nueva. **Sin migraciones.**
2. **Cuenta de revisión temporal**, creada con la API de administración de
   Supabase, ya confirmada. Al entrar recibe la demo nueva: es lo que verá un
   usuario nuevo. **Capturas en los dos temas**, en 1280 y 390 px, del acceso,
   el dashboard, el proyecto, cada editor, el panel y una visita de Torre
   Alameda, los informes y el manual.
3. Al terminar se **borra** la cuenta de revisión y sus datos.
4. La cuenta del usuario no se toca: recibe la demo nueva en su próximo acceso.

No se entra con la cuenta del usuario: no se pide su contraseña ni se le abre
sesión por la puerta de administración.

## Pruebas

| Qué | Casos |
|---|---|
| Fixtures de la demo | Cada cartera, por el motor: TT4 cumple y cierra; Vivero por mínimos cuadrados converge; El Verjón da su discrepancia y sus puntos homólogos; el crudo Leica cierra en −0.4 mm sobre 1.397 km; Torre Alameda reproduce su serie a 0.1 mm con la visita 9 fuera de tolerancia |
| Crudo Leica | El texto de `src/` es idéntico al `.L` de `docs/carteras/` |
| El Verjón | Los tests que hoy tienen su propia copia usan la de `lib/demo/`, y siguen dando lo mismo |
| Seed | Sigue sembrando lo mismo, leyendo los datos de `lib/demo/` |

**En local:** un usuario nuevo recibe la demo al entrar; recorrido en pantalla
por sus procesos, en los dos temas.

## Criterios de aceptación

1. Un usuario nuevo recibe el «Proyecto de ejemplo» con las cinco carteras
   reales, Torre Alameda y tres informes, todo calculado por el motor.
2. Los datos reales viven una sola vez en `src/lib/demo/`, y los usan la demo,
   el seed y los tests.
3. `npm run typecheck`, `npm run lint`, `npm test` y `npm run build` limpios.
4. En producción: capturas en los dos temas con la cuenta de revisión, que
   después se borra.
5. Manual en sus dos copias (lo que trae la demo) y doc técnica al día.

## Fuera de alcance

- Recrear la demo de quien ya la tiene.
- Cambiar los proyectos del seed local.
- Ejemplos de poligonal de enlace y abierta en la demo (hallazgo 4).

## Riesgos

- **Datos en producción.** Crear y borrar la cuenta de revisión toca la nube.
  Mitigación: una cuenta con nombre inequívoco, borrada al terminar con sus
  datos (cascada desde `auth.users`), y comprobado que no queda nada.
- **La demo corre con el cliente del usuario, bajo RLS**, en el primer acceso.
  Más procesos y catorce visitas hacen más lenta esa primera carga. Mitigación:
  medir en local cuánto tarda; si pasa de unos segundos, insertar por lotes.
- **Un fallo a mitad deja la demo a medias**: la marca se reclama antes de
  crear. Es el comportamiento actual; no empeora.

## Tareas (en orden)

0. **Apertura:** este PRD, estados en `method.md` y `prds/README.md`. Commit
   `docs:`.
1. Datos reales a `src/lib/demo/`: El Verjón completo, el crudo Leica como
   texto, la serie de Torre Alameda; tests y seed pasan a usarlos.
2. `insertar-*` ampliados: vuelta, fila de cierre, amarre, mínimos cuadrados,
   catálogo de puntos, dos BMs de amarre.
3. Fixtures de la demo nueva y `crear-proyecto-demo.ts`; tests de fixtures.
4. Verificación en local: usuario nuevo, recorrido en pantalla en los dos temas.
5. Manual (dos copias) y doc técnica; cierre y PR.
6. Tras el merge, en producción: cuenta de revisión, capturas en los dos temas,
   borrado de la cuenta.
