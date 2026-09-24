# PRD-de-fase 13 — Dibujo de la poligonal y ángulos en grados decimales

**Estado:** en curso
**Fecha de apertura:** 2026-09-23
**Fecha de cierre:** —

**Rama:** `fase-13-canvas-poligonal`
**Peticiones que recoge:** el canvas de visualización que la Fase 7 difirió
([`06-motor-captura-poligonal.md`](./06-motor-captura-poligonal.md), «Fuera»)
y P1 de [`pendientes.md`](../pendientes.md)
**Módulo:** poligonal

## Propósito

Dos cosas del editor de poligonal, que se entregan juntas porque tocan las
mismas pantallas:

1. **Dibujar la poligonal**: sus vértices a escala sobre una grilla de
   coordenadas, con la poligonal ajustada y cómo se desplazó respecto a la
   original. En el editor, en vivo, y en el informe imprimible.
2. **Capturar ángulos en grados decimales** además de en DMS (P1), con un
   conmutador que se recuerda por proceso.

## Hallazgos que originan la fase

### 1. «Original frente a ajustada» no se ve a escala real

La Fase 7 definió el canvas como «original vs ajustada, grilla, zoom». Pero en
una poligonal bien medida **la diferencia es invisible**. Medido sobre el seed:

| Poligonal | Error de cierre | Perímetro | Precisión |
|---|---|---|---|
| V10 — cartera TT4 (real) | 1.6 cm | 115.7 m | 1:7 045 |
| Famarena — Sede Vivero (real) | 1.0 cm | 246.0 m | 1:24 717 |
| Cuadrado con error (fixture) | 40 cm | 400.4 m | 1:1 001 |
| Pentágono, caso 1 del marco teórico | 12.17 m | 554.4 m | 1:46 |

En la TT4, 1.6 cm sobre una extensión de unos 40 m, dibujada en 600 px, ocupa
**0.2 px**. Las dos poligonales se superponen exactamente. Por eso el dibujo
exagera el desplazamiento (decisión 1).

### 2. Un ángulo decimal pierde precisión al guardarse

Los segundos se almacenan como `decimal(5,1)`: una décima de segundo, que son
0.0000278°. Un ángulo tecleado con más precisión que esa **se redondea a
0.1″** al guardarse. Es la misma resolución que ya tiene la captura en DMS, así
que no es una pérdida nueva, pero el usuario tiene que verla: al volver a
mostrar el ángulo en decimal no aparecerá la séptima cifra que tecleó.

Para que convertir DMS → decimal → DMS devuelva **el mismo** valor, el decimal
se muestra con **6 decimales**: 0.000001° = 0.0036″, muy por debajo de la
décima que se redondea.

### 3. Un proceso cerrado no admite `UPDATE`

La regla de inmutabilidad de `CLAUDE.md` impide persistir la preferencia de
formato en un proceso cerrado. El conmutador **sí funciona** en un proceso
cerrado —es solo una forma de mostrar—, pero ahí no se guarda.

### 4. Esto no es un mapa

`CLAUDE.md` deja fuera de alcance la «visualización geoespacial en mapa». El
dibujo de esta fase es otra cosa: el croquis de la poligonal en su propio
sistema de coordenadas planas, sin cartografía de fondo, sin tiles y sin
proyección. Es lo que el topógrafo dibuja a mano en la cartera. No entra en esa
exclusión.

## Decisiones

Las cuatro primeras las tomó el usuario al abrir la fase.

| # | Decisión | Razón |
|---|---|---|
| 1 | La diferencia se ve con la **poligonal sin compensar exagerada ×k** | Hallazgo 1. Es la convención de los planos de ajuste. El factor se calcula solo y se rotula |
| 2 | El dibujo aparece en el **editor** (en vivo, con zoom) y en el **informe imprimible** (estático) | El informe ya incluye la gráfica de asentamientos (Fase 6); el entregable impreso debe mostrar la poligonal |
| 3 | **SVG propio**, reutilizando `chart-scale` | Precedente de la gráfica de asentamientos: se imprime nítido, es accesible y no añade librerías (`CLAUDE.md`) |
| 4 | P1: un **conmutador DMS / decimal** que convierte en pantalla. El almacenamiento sigue en DMS y la preferencia **se recuerda por proceso** | `CLAUDE.md` fija los ángulos en tres campos. Una cartera está entera en un formato, así que la preferencia es del proceso y no del usuario |
| 5 | La preferencia se **guarda al conmutar**, no con el botón Guardar, y solo en procesos abiertos | «Que persista» (petición del usuario). Esperar al Guardar la perdería si el usuario cambia de formato y sale. En uno cerrado, el conmutador solo cambia la vista (hallazgo 3) |
| 6 | El conmutador afecta **solo a los campos de captura** | Resultados, informe y Excel siguen mostrando DMS: `CLAUDE.md` fija «los ángulos en DMS» como convención de presentación |
| 7 | La poligonal sin compensar se **deriva de las proyecciones que el motor ya calcula** (`deltaNorth`, `deltaEast`), sin matemática nueva | Invariante verificable: en una cerrada, su último punto menos el arranque es exactamente el error de cierre `(errorNorth, errorEast)` |
| 8 | **Proporción 1:1** entre Norte y Este | Es un plano, no una gráfica. Escalar los ejes por separado deformaría los ángulos, que son lo que se midió |

## El dibujo

### Qué se dibuja

- **La poligonal ajustada**, en trazo continuo, con cada vértice marcado y
  rotulado con su código.
- **La poligonal sin compensar, exagerada ×k**, en trazo discontinuo: cada
  vértice se dibuja en `ajustado + k · (original − ajustado)`. En una cerrada,
  el trazo discontinuo **no cierra**, y el hueco que queda en el último vértice
  es el error de cierre exagerado.
- **El amarre**, si el proceso tiene punto de referencia con coordenadas: el
  punto y la línea de orientación hasta el arranque.
- **Grilla** de Norte y Este con marcas «redondas» (`niceTicks`) y sus
  coordenadas, **flecha de norte** y **barra de escala** en metros.
- **Leyenda**: «Ajustada», «Sin compensar (desplazamientos ×100)».

### El factor de exageración

```
k = el mayor número «redondo» (1, 2 o 5 × 10ⁿ) tal que
    k · (desplazamiento máximo) ≤ 5 % de la extensión mayor del dibujo
k ≥ 1
```

- Nunca menor que 1: el Pentágono del marco teórico (1:46) se dibuja sin
  exagerar, porque su error ya se ve.
- Si no hay desplazamiento (cierre perfecto) o el tipo no compensa (abierta
  sin control), **no hay trazo discontinuo**. La leyenda lo dice: «Sin
  correcciones» o «Abierta sin control: no se compensa».
- El 5 % queda como constante con nombre, igual que las decisiones de la
  Fase 12.

Con las extensiones y errores reales del seed:

| Poligonal | Extensión mayor | Error de cierre | 5 % / error | `k` |
|---|---|---|---|---|
| V10 — TT4 | 41.9 m | 1.64 cm | 128 | **100** |
| Famarena — Vivero | 90.3 m | 1.00 cm | 451 | **200** |
| Cuadrado con error | 100.3 m | 40 cm | 12.5 | **10** |
| Pentágono, caso 1 | 175.1 m | 12.17 m | 0.72 | **1** |

### Por tipo de poligonal

| Tipo | Ajustada | Sin compensar ×k |
|---|---|---|
| Cerrada | Sí | Sí, con el hueco de cierre en el último vértice |
| Abierta con control | Sí, hasta el punto de llegada conocido | Sí, termina lejos del punto de llegada |
| Abierta sin control | Sí (es la única que hay) | No: nada que compensar |

### Estados incompletos

El editor dibuja **lo que ya se puede calcular**. Si el motor todavía no tiene
coordenadas (faltan distancias, ángulos o el arranque), el dibujo muestra un
estado vacío que dice qué falta, igual que la tabla de diferenciales de
asentamientos. Un dibujo vacío sin explicación se leería como «no hay nada».

### Interacción (solo en el editor)

- Botones **acercar**, **alejar** y **restablecer**, y **arrastrar** para
  desplazar. Son botones reales, accesibles con el teclado.
- Sin zoom con la rueda del ratón: capturaría el desplazamiento de la página,
  que en el editor es largo.
- Al acercarse, la exageración **no cambia**: el factor se rotula y es parte
  de la lectura del dibujo.

### Accesibilidad

`role="img"` con un `aria-label` que resume el dibujo (número de vértices,
tipo, error de cierre y factor). Los datos exactos ya están en la tabla de
resultados, que es la alternativa textual (el mismo criterio que la gráfica de
asentamientos).

## Ángulos en grados decimales (P1)

### El conmutador

- Un control **«DMS / Decimal»** en la cabecera del editor y en el formulario
  de proceso nuevo.
- Afecta a **todos los campos de captura de ángulos**: las lecturas de cada
  estación, los azimuts de partida y de llegada y el azimut del diálogo de
  reasignación de coordenadas.
- Al conmutar, **cada valor ya tecleado se convierte** en el acto. Un valor
  completo se convierte exacto (hallazgo 2). Un DMS incompleto, con los grados
  pero sin minutos o segundos, se toma con 0 en lo que falta. Un campo vacío
  queda vacío.
- El promedio de las N lecturas que muestra la celda de la estación sigue el
  formato elegido.

### El campo decimal

- Un solo campo numérico, con el sufijo `°`.
- Se valida el mismo rango que en DMS.
- Al guardar se convierte con `decimalToDms`, que redondea a 0.1″. Si el valor
  tecleado tenía más precisión, bajo el campo aparece: «Se guarda como
  45°30′15.3″ (a la décima de segundo)».

### Modelo

```sql
alter table public.polygonal_processes
  add column angle_input_format text not null default 'dms'
    check (angle_input_format in ('dms', 'decimal'));
```

Todos los procesos existentes quedan en `dms`. Ningún ángulo cambia de
almacenamiento. Una acción `setAngleInputFormatAction` guarda solo esa columna,
y la rechaza en un proceso cerrado o rechazado antes de llegar al trigger.

## Archivos

| Archivo | Qué cambia |
|---|---|
| `supabase/migrations/<ts>_angle_input_format.sql` | La columna |
| `src/types/database.ts` | Regenerado |
| `src/lib/calculations/polygonal.ts` | `unadjustedCoordinates(input, result)`, derivada de las proyecciones |
| `src/lib/calculations/angles.ts` | `formatDecimalDegrees` (6 decimales) y la conversión DMS ↔ decimal para los campos |
| `src/lib/design/polygonal-plot.ts` | Nuevo, puro: límites con proporción 1:1, factor de exageración, puntos exagerados |
| `src/components/polygonal/polygonal-plot.tsx` | Nuevo: el SVG, compartido por el editor y el informe |
| `src/components/polygonal/polygonal-editor.tsx` | Dibujo en vivo con zoom, conmutador de formato |
| `src/components/design-system/` | `AngleInput`: DMS o decimal según el formato, en lugar de `DmsInput` en los campos de captura |
| `src/components/polygonal/stations-table.tsx`, `polygonal-config-fields.tsx`, `reassign-coordinates-dialog.tsx`, `new-polygonal-form.tsx` | Usan `AngleInput` |
| `src/app/(app)/projects/[id]/polygonal/[pid]/actions.ts` | `setAngleInputFormatAction`; crear con el formato elegido |
| `src/app/(app)/projects/[id]/reports/[reportId]/print/page.tsx` | El dibujo en la sección de cada poligonal |
| `scripts/seed.mjs` | Un proceso abierto con formato `decimal` |
| `docs/manual/capturas.mjs` | Captura nueva del dibujo |
| `src/app/(app)/manual/page.tsx` + `docs/manual/README.md` | Dibujo y conmutador, en el mismo commit |
| `docs/testing/manual-e2e-poligonal.md` | Verificar el dibujo y el conmutador |
| `docs/tecnica/README.md` | Modelo, dibujo, estado de fases y tabla de pruebas regenerada |

## Pruebas

**Suite existente:** 557 tests.

**Nuevas, como mínimo:**

| Qué | Casos |
|---|---|
| `unadjustedCoordinates` | **Cerrada: último punto − arranque = `(errorNorth, errorEast)`**, en las carteras reales y en el Pentágono. Cierre perfecto: coincide con la ajustada. Abierta con control: termina a `(errorNorth, errorEast)` del punto de llegada. Abierta sin control: igual a la ajustada |
| Factor de exageración | Los cuatro valores de la tabla: TT4 ×100, Famarena ×200, Cuadrado ×10, Pentágono ×1. Un cierre perfecto no tiene factor |
| Límites | Proporción 1:1: el rango de Norte y el de Este en pantalla son iguales en metros por píxel. Un solo punto no divide por cero |
| Conversión de formato | Ida y vuelta DMS → decimal → DMS exacta en pasos de 0.1″ (muestreo que incluya 59.9″ y 0°). Un decimal con 7 cifras se redondea a 0.1″. Un DMS incompleto toma 0 en lo que falta. Un campo vacío queda vacío |
| `setAngleInputFormatAction` | La regla de rechazo en un proceso cerrado, como función pura |

**Probar la ruta:** los tests de `unadjustedCoordinates` parten de lo que
devuelve `computePolygonal` sobre las carteras reales del seed, no de
proyecciones armadas a mano.

**En pantalla, antes de cerrar:**

1. El dibujo de la cartera TT4: vértices rotulados, trazo discontinuo exagerado
   con su factor, hueco de cierre visible.
2. El Pentágono: sin exagerar (factor 1).
3. Una abierta con control y una sin control.
4. Zoom, desplazamiento y restablecer, con el teclado y con el ratón.
5. El dibujo en vivo: cambiar una distancia y ver moverse el vértice.
6. El conmutador: convertir a decimal y volver sin cambiar ningún valor;
   teclear un decimal de 7 cifras y ver el aviso de redondeo; recargar y
   encontrar el formato recordado; en un proceso cerrado, que conmuta y no
   guarda.
7. El informe imprimible con el dibujo.
8. La ruta `/manual`.

## Criterios de aceptación

1. El editor dibuja la poligonal ajustada a escala con proporción 1:1, grilla
   con coordenadas, flecha de norte, barra de escala y vértices rotulados.
2. La poligonal sin compensar se dibuja exagerada ×k, con el factor rotulado;
   en una cerrada, el hueco final es el error de cierre exagerado.
3. `k` es 1, 2 o 5 × 10ⁿ, nunca menor que 1, y no hay trazo discontinuo si no
   hay nada que compensar.
4. `unadjustedCoordinates` cumple el invariante del error de cierre en las
   carteras reales.
5. El dibujo se actualiza en vivo al capturar y tiene zoom, desplazamiento y
   restablecer accesibles con el teclado.
6. El informe imprimible incluye el dibujo de cada poligonal.
7. El conmutador DMS / decimal convierte todos los campos de captura sin
   alterar ningún valor en la ida y vuelta, y el almacenamiento sigue en DMS.
8. La preferencia se guarda al conmutar en un proceso abierto y no se guarda en
   uno cerrado o rechazado.
9. Un decimal con más precisión que 0.1″ avisa de cómo se guardará.
10. `npm run typecheck`, `npm run lint` y `npm test` pasan limpios, con los
    tests nuevos sumados a los 557.
11. Manual actualizado en sus dos copias, en el mismo commit, con capturas
    regeneradas y la del dibujo nueva.
12. Doc técnica actualizada y tabla de pruebas regenerada desde la ejecución.
13. `docs/testing/manual-e2e-poligonal.md` cubre el dibujo y el conmutador.

## Fuera de alcance

- **Mapa con cartografía de fondo**, proyecciones o tiles (hallazgo 4).
- **Exportar el dibujo** a DXF, PDF o imagen suelta. El informe imprimible ya
  sale como PDF desde el navegador.
- **Editar coordenadas arrastrando vértices.** El dibujo es de lectura.
- **Mostrar resultados, informe o Excel en decimal** (decisión 6).
- **Grados centesimales (gon).** La petición P1 habla de grados decimales
  sexagesimales.
- **Mínimos cuadrados** (Fase 14): el dibujo mostrará sus correcciones igual
  que las de Bowditch, pero eso es de esa fase.

## Riesgos

- **Un factor grande hace que el trazo discontinuo parezca un error grave.** El
  ×200 de Famarena dibuja su centímetro de error como 2 m sobre un lote de
  90 m. Mitigación: el factor va en la
  leyenda y en el `aria-label`, y el manual lo explica con la cartera TT4.
- **La conversión al conmutar puede alterar un valor si se hace mal.** Es el
  riesgo mayor de P1: cambiar de formato no puede cambiar una medición.
  Mitigación: la ida y vuelta exacta es un criterio de aceptación, con un
  muestreo de valores límite (59.9″, 0°, 359°59′59.9″).
- **El promedio de lecturas en decimal y en DMS debe ser el mismo ángulo.** Se
  calcula siempre en grados decimales internos, como ahora, y solo se formatea
  distinto.
- **Tres copias del formato de milímetros** (revisión de la Fase 12). Esta fase
  no añade una cuarta: el dibujo rotula en metros.
