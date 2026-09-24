# PRD-de-fase 17 — Control ida-vuelta por puntos homólogos

**Estado:** cerrada
**Fecha de apertura:** 2026-09-24
**Fecha de cierre:** 2026-09-24

**Rama:** `fase-17-homologos-ida-vuelta`
**Petición:** N6 de [`pendientes.md`](../pendientes.md)
**Carteras de referencia:** El Verjón
([`carteras/analisis-nivelacion-verjon.md`](../carteras/analisis-nivelacion-verjon.md))
y el crudo de nivel digital
([`carteras/analisis-crudo-nivel-digital.md`](../carteras/analisis-crudo-nivel-digital.md))
**Módulo:** nivelación

> **Divergencias de la implementación:**
>
> - **La etiqueta «= discrepancia» es condicional.** En una de enlace la vuelta
>   arranca en la cota conocida del BM de llegada y el último residuo no es la
>   discrepancia (decisión 7 la daba por cierta siempre). Se rotula solo cuando
>   coincide, y un test lo cubre.
> - Los tipos `HomologousPoint` y `HomologousComparison` viven en
>   `src/types/leveling.ts`, con el resto de contratos del motor, no en
>   `leveling.ts`.
> - La tercera comprobación en pantalla se hizo importando una plantilla con
>   puntos de cambio propios, en vez de teclearla.
> - **Hallado en la revisión:** no se compara si la vuelta no empieza en el
>   punto donde terminó la ida —el motor la arranca en esa cota y todos los
>   residuos saldrían desplazados—, ni una fila a medio capturar. La regla de
>   «= discrepancia» pasa al motor (`lastIsDiscrepancy`), con su test.

## Propósito

Cuando la ida y la vuelta pasan por **los mismos puntos**, se puede comparar la
cota de cada punto en los dos recorridos, no solo el desnivel total. Un único
número de discrepancia esconde una distinción que la serie de residuos deja
ver:

- si el residuo **crece a lo largo del recorrido**, hay un error sistemático
  repartido;
- si **salta en un punto**, ese punto está mal medido o mal asentado.

La comparación por sección de la Fase 4 **sigue siendo el veredicto**. Esta
fase añade una lectura informativa al lado.

## Hallazgos que condicionan la fase

### 1. Dos carteras reales reocupan los puntos

El Verjón (nivel automático, 12 puntos) y el crudo del Tramo 2 (nivel digital,
9 puntos) hacen lo mismo: la vuelta recorre en orden inverso los puntos de la
ida. Con dos instrumentos y dos carteras independientes, la práctica deja de
ser excepcional. El `§6.9` del PRD principal, enmendado en la Fase 4, supone lo
contrario («los puntos de cambio son provisionales y no se reocupan»).

### 2. Los residuos, recalculados con el motor

Residuo = **cota de la vuelta − cota de la ida**, con las cotas calculadas (sin
compensar), en el orden de la vuelta. La vuelta parte de la cota a la que llegó
la ida (Fase 16, hallazgo 3).

**El Verjón** reproduce la columna `P` de la hoja:

| Punto | C 8 | D3 | C 7 | C 6 | C 5 | C 4 | AUX 1 | C 3 | C 2 | C 1 | D1 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Residuo (mm) | −1 | −2 | −2 | −3 | −5 | −5 | −5 | −5 | −6 | −7 | −5 |

Crece casi monótono hasta −7 mm en C 1 y vuelve a −5 mm en D1: un error
sistemático repartido, que el tramo final compensa en parte.

**El crudo**, leído como ida y vuelta, con las lecturas promediadas y
redondeadas como las importa la Fase 16:

| Punto | C17 | C16 | C15 | C14 | C13 | C12 | C11 | C10 |
|---|---|---|---|---|---|---|---|---|
| Residuo (mm) | −2.4 | −2.1 | −4.5 | −5.2 | −5.2 | −3.5 | −2.0 | −0.4 |

Crece hasta −5.2 mm en el punto más alejado y vuelve a −0.4 mm al cerrar. La
discrepancia de la sección, 0.4 mm, esconde que a mitad del recorrido las dos
mediciones difieren en 5 mm.

En los dos casos, **el residuo del último punto es la discrepancia**: es el
mismo cierre visto desde el punto de partida.

### 3. Los códigos no coinciden al carácter

El Verjón escribe `AUX1` en la ida y `AUX 1` en la vuelta, y varios códigos
llevan espacios al final (`"C 3 "`). Con comparación exacta, `AUX 1` se
quedaría sin pareja.

### 4. Un código repetido dentro de un recorrido es ambiguo

En una cerrada, el BM de partida aparece al principio y al final de la ida.
Si la vuelta también pasa por él, no se sabe con cuál de las dos cotas de la
ida compararlo.

## Decisiones

Las cuatro primeras las tomó el usuario al abrir la fase.

| # | Decisión | Razón |
|---|---|---|
| 1 | **Automática**: aparece siempre que ida y vuelta compartan puntos intermedios; si no, todo sigue como hoy | Sin configuración nueva. Con puntos de cambio provisionales, que es lo que asume la Fase 4, no aparece |
| 2 | **Solo informativa**: sin tolerancia por punto; el veredicto sigue siendo la discrepancia de la sección | No hay una norma clara para una tolerancia por punto, y la lectura que interesa es la forma de la serie |
| 3 | Los códigos se emparejan **ignorando espacios y mayúsculas** | `AUX1` y `AUX 1` son el mismo punto (hallazgo 3) |
| 4 | **Solo en el editor**, en el panel de resultados | Es una herramienta de revisión del topógrafo. El informe y el Excel no cambian |
| 5 | Residuo = **vuelta − ida**, con cotas **calculadas**, en el **orden de la vuelta** | Es la convención de la hoja de El Verjón. La compensación reparte el error de la ida y escondería justo lo que se quiere ver |
| 6 | **Aparece** si hay al menos un punto compartido **que no sea un extremo** de la vuelta | Con solo los BM extremos compartidos, la tabla repetiría la discrepancia |
| 7 | Se muestran **todos** los puntos emparejados, incluidos los extremos. El último se rotula como la discrepancia | Es lo que hace la hoja, y la vuelta del último punto a la discrepancia es parte de la lectura |
| 8 | Un código que se **repite dentro de un recorrido** no se empareja | No se sabe con cuál compararlo (hallazgo 4). Una nota dice cuáles se omitieron |
| 9 | Entran las **radiaciones** compartidas | El Verjón compara `AUX 1`, que es una radiación |

## Modelo

No cambia la base de datos. Todo se calcula en vivo desde el resultado del
motor.

```ts
// src/lib/calculations/leveling.ts
export interface HomologousPoint {
  pointCode: string;          // tal como aparece en la vuelta
  pointType: PointType;
  forwardElevation: number;
  returnElevation: number;
  residualMm: number;         // (vuelta − ida) · 1000
}
export interface HomologousComparison {
  points: HomologousPoint[];  // en el orden de la vuelta
  skippedCodes: string[];     // repetidos dentro de un recorrido
}

/** `null` si no hay vuelta o no comparten ningún punto intermedio. */
export function compareHomologousPoints(result: LevelingResult): HomologousComparison | null;

/** «AUX 1», «aux1» y «AUX1 » son el mismo punto. */
export function samePointCode(a: string, b: string): boolean;
```

Pura, en el motor, sobre `result.forward.readings` y `result.return.readings`
(`elevationCalculated`).

## Superficie

En el **panel de resultados** del editor de nivelación, debajo de la
discrepancia, una sección **«Puntos homólogos»**:

- Tabla: punto, tipo, cota de ida, cota de vuelta y residuo en mm con una
  décima. La última fila se marca como la discrepancia.
- Una nota con cómo leerla: si el residuo crece a lo largo del recorrido,
  error sistemático; si salta en un punto, revisar ese punto. Y que es
  informativa: el veredicto es la discrepancia de la sección.
- Si hay códigos omitidos por repetirse, se dicen.

## Archivos

| Archivo | Qué cambia |
|---|---|
| `src/lib/calculations/leveling.ts` | `compareHomologousPoints`, `samePointCode` |
| `src/components/leveling/results-panel.tsx` | La sección «Puntos homólogos» |
| `docs/prds/…` y `PRD-TopoField.md` `§6.9` | La enmienda: las dos prácticas existen |
| Manual (dos copias), guion de pruebas, doc técnica | Como en cada fase |

## Pruebas

**Suite existente:** 676 tests.

**Nuevas, como mínimo:**

| Qué | Casos |
|---|---|
| El Verjón | Las 12 lecturas de ida y vuelta de la hoja corregida como fixture: los 11 residuos de la tabla (más D4 en 0), `AUX1` emparejado con `AUX 1` |
| El crudo | Leído con el importador de la Fase 16 como ida y vuelta: los 8 residuos de la tabla, y el último igual a la discrepancia |
| Activación | Sin vuelta, `null`. Ida y vuelta que solo comparten los BM extremos, `null` |
| Códigos | `samePointCode` con espacios, mayúsculas y espacios al final |
| Repetidos | Una cerrada cuyo BM de partida aparece dos veces en la ida: se omite y se nombra en `skippedCodes` |

**En pantalla, antes de cerrar:**

1. Importar el crudo como ida y vuelta: la tabla con los residuos del crudo.
2. Importarlo como un recorrido: no aparece.
3. Una vuelta con puntos de cambio propios, tecleada en el Circuito BM-1 (el
   seed no trae ninguna nivelación con vuelta): no aparece.
4. La ruta `/manual`.

## Criterios de aceptación

1. Con ida y vuelta que comparten puntos intermedios, el editor muestra la
   tabla de homólogos; sin ellos, nada cambia.
2. Reproduce los residuos de El Verjón (la columna `P` de la hoja) y los del
   crudo.
3. `AUX1` y `AUX 1` se emparejan.
4. Los códigos repetidos dentro de un recorrido se omiten y se dicen.
5. El veredicto no cambia: sigue siendo la discrepancia de la sección.
6. El `§6.9` del PRD principal admite las dos prácticas.
7. `npm run typecheck`, `npm run lint` y `npm test` pasan limpios, con los
   tests nuevos sumados a los 676.
8. Manual en sus dos copias, en el mismo commit, con capturas regeneradas.
9. Doc técnica actualizada, con la tabla de pruebas regenerada desde la
   ejecución.
10. Guion de pruebas de nivelación con la comparación.

## Fuera de alcance

- **Tolerancia por punto** (decisión 2).
- **Informe imprimible y Excel** (decisión 4).
- **Usar los homólogos en la compensación** o en el desnivel adoptado.
- **Selector de punto** en lugar de texto libre para los códigos, que
  evitaría el problema de `AUX1` de raíz.
- **Gráfica** de la serie de residuos.

## Riesgos

- **Se lea la tabla como un veredicto.** Mitigación: la nota dice que es
  informativa, y no hay colores de cumple / no cumple.
- **La normalización empareja dos puntos distintos** (`C1` y `C 1` si fueran
  puntos diferentes). Mitigación: es poco probable en una misma libreta, y la
  tabla muestra el código de la vuelta tal cual para que se vea.
