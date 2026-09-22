# Prompt para continuar en otra sesión

Copia y pega lo de abajo.

---

Vengo de una sesión larga en TopoField. Antes de proponer nada, ponte en contexto:

1. Lee `CLAUDE.md` y `docs/method.md` — el método es por fases, cada una con su
   PRD en `docs/prds/` redactado ANTES de tocar código, y no se solapan.
2. Lee `docs/prds/README.md` para ver el estado de las 11 fases. Las 8 primeras
   están cerradas.
3. Lee `docs/pendientes.md` — son seis peticiones mías que todavía no tienen
   fase asignada.
4. Lee `docs/carteras/analisis-minimos-cuadrados.md` — el análisis de las
   carteras de campo reales contra las que se verificó el motor.

## Dónde quedó

Las fases 7 y 8 se cerraron en esa sesión y están mergeadas en `main`:

- **Fase 7** corrigió la convención de azimut del motor de poligonales: restaba
  el ángulo en vez de sumarlo, así que producía el polígono espejo mientras
  informaba que el cierre cumplía. Añadió amarre sobre punto conocido con azimut
  calculado, los dos esquemas de cierre de una cartera real, y captura de N
  lecturas por ángulo con promedio y dispersión.
- **Fase 8** sacó el orden de precisión y el equipo de `projects` y los puso en
  cada proceso, con los campos que su instrumento realmente tiene. De paso cerró
  un agujero: editar el equipo del proyecto reescribía informes ya emitidos,
  incluso de procesos cerrados.

Se verificaron cuatro hojas de Excel de carteras reales. **Solo una estaba
bien.** Están las versiones corregidas en `docs/carteras/*-corregido.xlsx`.

## Lo que sigue

Hay tres fases planificadas sin PRD (9 canvas, 10 mínimos cuadrados,
11 georreferenciación) y seis pendientes sin fase. Lo primero que quiero decidir
es **cómo se organizan los pendientes de nivelación y asentamientos en fases**,
porque el orden actual no los contempla y yo los quiero antes que el canvas.

De los pendientes, el que más me interesa entender primero es `N3`: la sumatoria
de distancias de nivelación no se genera sola, y de ese número depende la
tolerancia de cierre `K·√D`.

## Cómo trabajamos

- Brainstorming antes de diseñar, PRD de fase antes de código, y el plan de
  implementación con subagentes por tarea.
- Si encuentras un defecto en el plan o en la spec, dilo y corrígelo — en esa
  sesión los escaneos previos y las revisiones encontraron más errores en mis
  planes que en el código.
- Una fase que toca UI no se cierra sin levantar la app y mirar las capturas.
  Dos bugs de la fase 7 y dos de la 8 solo aparecieron al mirar la pantalla.
- Los commits van en español; el merge a `main` lo decido yo.

## Estado del repo

`main`, árbol limpio, 443 tests, typecheck y lint sin nada. Hay commits sin subir
a `origin/main`: pregúntame antes de empujar.
