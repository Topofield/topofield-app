# PRD-de-fase 10 — Nomenclatura de nivelación

**Estado:** en curso
**Fecha de apertura:** 2026-09-23
**Fecha de cierre:** —

**Rama:** `fase-10-nomenclatura-nivelacion`
**Petición que recoge:** N1 de [`pendientes.md`](../pendientes.md)
**Cartera de referencia:** [`carteras/analisis-nivelacion-verjon.md`](../carteras/analisis-nivelacion-verjon.md)

## Propósito

Que la libreta de nivelación use la nomenclatura del topógrafo colombiano —
**vista más (`V+`)** y **vista menos (`V−`)**— en vez de «lectura atrás» y
«lectura adelante».

No es una preferencia de estilo: es la nomenclatura que trae la cartera de
campo real contra la que se verificó el motor. Un usuario que transcribe su
libreta a la aplicación encuentra hoy dos vocabularios distintos para la misma
columna.

## Por qué `V+` y `V−`

La nomenclatura es **coherente con el cálculo**, que es lo que la hace
memorable:

```
AI   = cota + V+      la vista más se SUMA
cota = AI   − V−      la vista menos se RESTA
```

«Atrás» y «adelante» describen hacia dónde mira el instrumento; `V+` y `V−`
describen qué hace el número. Para quien captura una libreta, lo segundo es lo
que importa.

**Confirmado contra la cartera real.** Los encabezados de
`TRABAJO NIVELACION EL VERJON.xlsx` son literalmente `V+`, `V-` y `VI` — no
«vista atrás». Ver el análisis de la cartera, tabla de la sección «Qué hace la
hoja».

## Alcance

### Qué cambia

Las **32 cadenas visibles** y los **43 comentarios en español**. Ninguna línea
ejecutable.

Las cifras están contadas, no estimadas — el criterio de aceptación 6 exige un
`grep` limpio al cerrar, y con un conteo mal hecho ese barrido daría por bueno
un renombrado parcial:

| Archivo | Cadenas |
|---|---|
| `readings-table.tsx` | 10 |
| `export/leveling-workbook.ts` | 8 |
| `validators/leveling.ts` | 3 |
| `results-panel.tsx` | 3 |
| `manual/page.tsx` | 3 |
| `demo/fixtures.ts` | 2 |
| `calculations/leveling.ts` | 1 |
| `calculations/leveling.test.ts` | 1 |
| `manual/manual-data.ts` | 1 |

| Hoy | Pasa a ser |
|---|---|
| `L.Atrás` | `V+` |
| `L.Adelante` | `V−` |
| `ΣL.Atrás` / `ΣL.Adelante` | `ΣV+` / `ΣV−` |
| `Lectura atrás` (aria-label) | `Vista más (V+)` |
| `Lectura adelante` (aria-label) | `Vista menos (V−)` |
| `Atrás (m)` / `Adelante (m)` (Excel) | `V+ (m)` / `V− (m)` |
| `HS atrás` / `HI atrás` | `HS V+` / `HI V+` |
| `HS adelante` / `HI adelante` | `HS V−` / `HI V−` |
| `Dist atrás (m)` / `Dist adelante (m)` | `Dist V+ (m)` / `Dist V− (m)` |

Y los **43 comentarios y JSDoc** que describen estas lecturas como «lectura
atrás» / `L.At`.

### Qué NO cambia, y por qué

| Se conserva | Razón |
|---|---|
| `backsight` / `foresight` en tipos, motor, validadores y Postgres | Es el vocabulario estándar de la topografía en inglés — el que usan las normas FGCS/NGS ya citadas en `tolerances.ts` y la documentación de los instrumentos. El proyecto **ya traduce en todas partes**: `pointType` ↔ «Tipo de punto», `closureError` ↔ «Error de cierre». Renombrarlos rompería ese patrón en vez de arreglarlo |
| Las columnas de la base | Renombrarlas exige columnas nuevas y backfill **sobre procesos cerrados**, por un cambio que ningún usuario ve. La Fase 9 midió ese precio: siete defectos en dos revisiones, cuatro de ellos en los propios arreglos |
| `AI` para altura del instrumento | Ya es inequívoco en pantalla y lleva seis fases ahí y en el manual |
| `HS` / `HI` para hilo superior e inferior | Como los dejó la Fase 9 |

**Sobre `AI` frente a `HI`:** la cartera de El Verjón usa `HI` para *altura del
instrumento*, mientras la aplicación usa `HI` para *hilo inferior* desde la
Fase 9. Se consideró alinearse con la cartera (`AI` → `HI`) y **se descartó**:
dejaría `HI` con dos significados en la misma pantalla, que es peor que la
divergencia que resolvería. `AI` se queda.

## Decisiones

| # | Decisión | Razón |
|---|---|---|
| 1 | Solo cambia la **superficie visible** y los comentarios | El código ya dice lo correcto en su idioma; traducir es el patrón del proyecto, no una deuda |
| 2 | Los **43 comentarios en español** sí entran | Describirían en la nomenclatura vieja lo que la pantalla llama `V+`. El cierre de la Fase 4 registró que un comentario caducado cuesta una ronda de corrección |
| 3 | El signo menos es **U+2212** (`−`), no guion | Es lo que ya usa `pendientes.md` (`b−`), y distingue la sigla de un rango |
| 4 | Los hilos se cualifican con la vista: `HS V+`, `HI V−` | Más corto que «HS atrás» y coherente con la nomenclatura nueva |
| 5 | Esta fase va **después** de la 9, no antes | La Fase 9 reescribió la tabla de captura entera; renombrar antes habría sido renombrar sobre texto que se sustituía |

## Archivos

| Archivo | Qué cambia |
|---|---|
| `src/components/leveling/readings-table.tsx` | Cabeceras, `aria-label`, comentarios |
| `src/components/leveling/results-panel.tsx` | Sumatorias de la comprobación aritmética |
| `src/lib/validators/leveling.ts` | Dos mensajes de error visibles y sus comentarios |
| `src/lib/export/leveling-workbook.ts` | Cabeceras de la hoja «Datos Crudos» |
| `src/lib/calculations/leveling.ts` | Comentarios y JSDoc |
| `src/lib/demo/fixtures.ts` | JSDoc de `LecturaNivelacionDemo` |
| `src/components/leveling/leveling-editor.tsx` | Comentarios |
| `src/lib/calculations/leveling.test.ts` | Un comentario de fixture (`ΣL.At`) |
| `src/app/(app)/manual/page.tsx` + `manual-data.ts` | La copia del manual en la app |
| `docs/manual/README.md` | La otra copia, **en el mismo commit** |
| `docs/testing/manual-e2e-nivelacion.md` | **Guion de pruebas manuales.** Si queda con la nomenclatura vieja manda al probador a buscar una columna que ya no existe |
| `docs/tecnica/README.md` | Una mención, además del estado de fases |

## Pruebas

**Suite existente:** 492 tests. **Verificado**: los del export afirman
posiciones de celda (`raw.getCell("E4").value`) y valores numéricos, no
rótulos, así que el renombrado no los rompe. Las dos aserciones sobre texto
(`"Vuelta"`, `"Punto de cambio"`) son etiquetas de tipo, que esta fase no toca.

**Verificado también** que ningún script depende de los `aria-label` que se
renombran: `docs/manual/capturas.mjs` usa `[aria-label="Veredicto de cierre"]`
y `getByLabel("Título")`, ninguno de esta fase.

**El signo U+2212 es seguro**: sobrevive a `JSON.stringify`/`parse`, ExcelJS lo
escribe en UTF-8 (3 bytes) y es distinto del guion ASCII. No hay búsqueda ni
filtro sobre estos rótulos en la aplicación, así que la distinción no afecta a
ningún flujo de usuario.

**En pantalla, antes de cerrar:**

1. Tabla de captura en modo `automatico`, con y sin hilos desplegados.
2. Tabla en modo `digital`.
3. Panel de resultados con la comprobación aritmética.
4. Excel exportado, abierto para ver las cabeceras.
5. Informe imprimible.
6. La ruta `/manual`, que es la copia que ve el usuario final.

Las Fases 7, 8 y 9 dejaron dos bugs cada una que solo aparecieron al mirar la
pantalla.

## Criterios de aceptación

1. La tabla de captura usa `V+` y `V−` en cabeceras y `aria-label`.
2. El panel de resultados usa `ΣV+` y `ΣV−`.
3. Las cabeceras de hilos y distancias se cualifican con la vista
   (`HS V+`, `Dist V− (m)`).
4. El Excel exporta con la nomenclatura nueva.
5. Los mensajes de validación visibles usan la nomenclatura nueva.
6. Ningún comentario, JSDoc ni cadena visible del módulo de nivelación describe
   estas lecturas como «lectura atrás» / «lectura adelante» / `L.At` / `L.Ad`.
   Se comprueba con el barrido de cierre:

   ```bash
   grep -rn "L\.At\b\|L\.Ad\b\|ectura atrás\|ectura adelante\|ista atrás\|ista adelante\|ΣL\." \
     --include=*.ts --include=*.tsx --include=*.mjs --include=*.md \
     src/ scripts/ docs/manual/ docs/tecnica/ docs/testing/ | grep -v node_modules
   ```

   Debe salir vacío. Los PRDs y análisis históricos quedan fuera del barrido:
   el método los declara inmodificables.
7. `backsight` / `foresight` **siguen intactos** en tipos, motor, validadores y
   base de datos.
8. `AI`, `HS` y `HI` conservan su significado actual.
9. El signo menos es U+2212 en todas las cadenas nuevas.
10. `npm run typecheck`, `npm run lint` y `npm test` pasan limpios, con los
    mismos 492 tests.
11. Manual actualizado **en sus dos copias**, en el mismo commit, con capturas
    regeneradas por `node docs/manual/capturas.mjs`.
12. Doc técnica actualizada: estado de fases y la mención de nomenclatura.
13. `docs/testing/manual-e2e-nivelacion.md` actualizado: es el guion que sigue
    una persona con la aplicación delante.

## Fuera de alcance

- **Renombrar identificadores** (`backsight`/`foresight`) en TypeScript.
- **Renombrar columnas** de la base de datos.
- **Cambiar `AI`, `HS` o `HI`.**
- Los PRDs y documentos históricos ya cerrados, que conservan su texto: el
  método los declara inmodificables.

## Riesgos

- **Un renombrado parcial es peor que ninguno**: si la tabla dice `V+` y el
  informe sigue diciendo «L.Atrás», el usuario ve dos vocabularios donde antes
  veía uno. Mitigación: el criterio 6 exige un `grep` limpio, y la verificación
  de pantalla recorre los seis consumidores.
- **El signo menos tipográfico puede romper alineaciones** en la tabla y en el
  Excel, donde las cabeceras compiten por ancho. Mitigación: mirarlo, no
  razonarlo.
