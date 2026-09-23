# PRD-de-fase 12 — Alerta por lectura desfasada

**Estado:** en curso
**Fecha de apertura:** 2026-09-23
**Fecha de cierre:** —

**Rama:** `fase-12-lectura-desfasada`
**Petición que recoge:** A1 de [`pendientes.md`](../pendientes.md)
**Módulo:** control de asentamientos (Fases 5 y 11)

## Propósito

Avisar cuando una lectura **se sale de la tendencia de su punto**: un valor que
probablemente sea un error de lectura o de transcripción y no un asentamiento
real.

Es distinto de lo que ya existe. Los umbrales de velocidad y acumulado miden
**cuánto** se movió el punto; el indicador de aceleración compara dos
velocidades. Esto mide si la **lectura es coherente con la serie**. Un punto
puede estar dentro de todos los umbrales y traer una visita obviamente mal
leída —por ejemplo, un punto que lleva meses bajando y de pronto sube 7 mm—.

## Hallazgos que originan la fase

### 1. El criterio obvio da falsos positivos en consolidación

«Predecir la cota con la velocidad anterior y avisar si el residuo supera un
margen» es lo primero que se ocurre, y falla en el caso típico del módulo. Un
asentamiento por consolidación **baja rápido y frena**: la velocidad de cada
visita es menor que la anterior. Extrapolar la anterior predice siempre de más.

En el seed, P-06 (la esquina más cargada) baja −24 mm el primer mes. La
extrapolación predice ≈ −22 mm para el segundo. La lectura real es −13 mm:
residuo de 8,7 mm, **lectura correcta marcada como desfasada**, en el punto
que más importa vigilar. Por eso se descartó.

### 2. Hoy un error de lectura se disfraza de aceleración

Una lectura mal tomada que exagera el descenso sube la velocidad de esa visita,
y `computeTrends` marca el punto como **«acelerando»**. El usuario lee una
aceleración real donde hay un error de campo. La fase no cambia el indicador de
aceleración, pero pone al lado un aviso que dice «verifica esta lectura», y así
se pueden distinguir las dos cosas.

## Decisiones

Las tres primeras las tomó el usuario al abrir la fase.

| # | Decisión | Razón |
|---|---|---|
| 1 | Criterio: **banda de dirección y ritmo** | Tolera que la consolidación frene, que es lo esperado. Verificado sin falsos positivos contra P-09 del marco teórico y las series del seed. Ver «Regla» |
| 2 | El margen sale del **orden de precisión de la visita** | La visita ya declara su orden desde la Fase 8. Sin migración ni campo nuevo |
| 3 | El aviso aparece en la **captura** y en el **panel**. Se calcula en vivo y no se persiste | Es un control de calidad de captura: avisa, no bloquea, como el de 1 m de desviación. No entra en el informe ni en el Excel |
| 4 | **No bloquea** ni el guardado ni el cierre | Precedente del proyecto: la capa estadística nunca bloquea (criterio de aceptación m de la Fase 5). Una lectura atípica puede ser real —un colapso local—, y bloquearla escondería justo el dato alarmante |
| 5 | Se evalúa desde la **tercera lectura** del punto | Hace falta una velocidad previa para saber la dirección y el ritmo. Con dos lecturas no hay tendencia que contrastar |
| 6 | No toca `computeTrends` ni el semáforo de 4 niveles | El aviso es otro eje: calidad del dato, no gravedad del movimiento. Mezclarlo con el semáforo haría que una lectura dudosa pareciera una alarma |
| 7 | La detección es una **función aparte** (`detectTrendDeviations`), no un campo de `computeSettlements` | Necesita el orden de cada visita, que `VisitInput` no lleva. Añadirlo tocaría los nueve sitios que construyen visitas. Solo dos consumidores (editor y panel) necesitan el aviso, y le pasan el orden por visita |

## Regla

Para la lectura `n` de un punto, con la lectura anterior de **ese punto** (la
última visita en que se midió, igual que el motor) y la velocidad de esa lectura
anterior `V_prev`:

```
parcial  = (cota_n − cota_prev) × 1000                  [mm]
Δt       = meses entre las dos lecturas                  (DAYS_PER_MONTH)
d        = signo de V_prev; si V_prev = 0, d = −1        (bajando)
m        = margen del orden de la visita n               [mm]

contrario   si  d · parcial < −m
excesivo    si  d · parcial >  2 · |V_prev| · Δt + m
```

En palabras:

- **Contrario:** el punto se mueve en sentido opuesto a su tendencia más que el
  margen. En un punto que se asienta, sube más de `m`.
- **Excesivo:** el punto se mueve en su sentido más del **doble** de lo que su
  ritmo anterior predice, más el margen.

La banda **admite que la consolidación frene hasta cero**: moverse menos de lo
previsto nunca avisa. La contrapartida es que una lectura que se quedó quieta
cuando debía bajar no se detecta. Se acepta: es el precio de no dar falsos
positivos en el caso típico.

El factor 2 es deliberadamente holgado. Una aceleración real menor del doble es
asunto del indicador de aceleración y de los umbrales de velocidad, no de este
aviso. Queda como constante con nombre (`TREND_DEVIATION_RATE_FACTOR`).

**Sin aviso** si el punto tiene menos de dos lecturas previas, si `V_prev` es
null (dos visitas el mismo día) o si `Δt` es 0.

### El margen

```
m = K_orden · √D_ref,   D_ref = 0.25 km
```

`K_orden` es la constante de tolerancia de nivelación que ya existe
(`LEVELING_TOLERANCE_K`: 3 / 6 / 12 / 24 mm·√km). `D_ref` es la longitud de
referencia de un circuito de monitoreo alrededor de una estructura. El margen
es la tolerancia de cierre de ese circuito: la diferencia que el propio orden
declara admisible en una cota.

| Orden | Margen |
|---|---|
| Primer orden | 1.5 mm |
| Segundo orden | 3 mm |
| Tercer orden | 6 mm |
| Ordinario | 12 mm |

`D_ref` vive como constante con nombre en `tolerances.ts`, no dentro de la
fórmula, para que se vea que es una decisión y se pueda discutir.

### Verificación de la regla contra series reales

Hecha al redactar este PRD. Ninguna lectura marcada, **con ninguno de los
cuatro márgenes**:

| Serie | Parciales (mm) | Avisos |
|---|---|---|
| P-09, caso 1 del marco teórico, intervalos 31 a 92 días | −5.8, −5.1, −3.9, −2.9, −1.9, −1.1, −0.4 | 0 |
| P-06 del seed | −24, −13, −7, −4, −2.5 | 0 |
| P-01 del seed | −3.5, −2.2, −1.4, −0.9, −0.5 | 0 |

Estas series pasan a ser **tests de regresión**: si un cambio de la regla las
marca, el cambio está mal.

### Un error marca también la lectura siguiente

Si la lectura `n` es un error, la `n+1` se evalúa contra una velocidad
contaminada y puede salir marcada al volver a la tendencia. Se acepta y se
documenta en el manual: **un zigzag de dos avisos seguidos casi siempre señala
el primero**.

## Superficie

### Editor de visita

- Bajo la cota de la lectura marcada, un aviso con el mismo estilo que el de
  1 m de desviación:
  - contrario: «Se sale de la tendencia: el punto venía bajando 2,9 mm/mes y
    esta lectura lo hace subir 7,0 mm. Verifica la lectura.»
  - excesivo: «Se sale de la tendencia: baja 18,0 mm cuando su ritmo anterior
    preveía unos 5,8 mm. Verifica la lectura.»
- El diálogo de cierre suma una línea con las lecturas marcadas —«Lecturas
  fuera de tendencia: P-04»—, porque cerrar congela el dato. No bloquea.
- Se recalcula en vivo al teclear.

### Panel del lugar

- En el **semáforo por punto** (última visita), una marca «Lectura fuera de
  tendencia» junto al nivel, con forma y texto, nunca solo color (regla del
  sistema de diseño). No cambia el nivel del semáforo.
- La tabla de visitas no cambia.

### Fuera de la superficie

El informe imprimible y el Excel no cambian (decisión 3).

## Seed

Torre Central gana un caso visible: **P-04 sube 7,0 mm en la visita 5** en vez
de bajar 0,7. Es tercer orden, margen 6 mm, así que sale como «contrario».

Muestra de paso el hallazgo 2 en pantalla. La velocidad de esa visita
(+7,0 mm en 31 días ≈ 6,9 mm/mes) supera el umbral de alerta de velocidad
(5 mm/mes), así que el semáforo de P-04 pasa a **Alerta** y el indicador lo
marca **«acelerando»**. El aviso nuevo, al lado, dice que lo más probable es
una lectura mal tomada. Es exactamente la confusión que la fase viene a
deshacer. El guion de pruebas y el manual, que hoy dicen que P-01…P-04 quedan
en normal, se actualizan.

Las cotas, parciales y alertas los sigue calculando `computeHistory`.

## Archivos

| Archivo | Qué cambia |
|---|---|
| `src/lib/calculations/tolerances.ts` | `TREND_DEVIATION_REFERENCE_KM`, `TREND_DEVIATION_RATE_FACTOR`, `trendDeviationMargin(order)` |
| `src/lib/calculations/settlement.ts` | `detectTrendDeviations(visits, orderByVisit)` |
| `src/types/settlement.ts` | Tipo `TrendDeviation` |
| `src/components/settlement/visit-editor.tsx` + `readings-table.tsx` | Aviso en la celda |
| `src/components/settlement/close-visit-dialog.tsx` | Línea de lecturas marcadas |
| `src/components/settlement/analysis-panel.tsx` | Marca en el semáforo |
| `src/app/(app)/projects/[id]/settlement/[siteId]/page.tsx` | Pasa el orden por visita al panel |
| `scripts/seed.mjs` | El caso de P-04 |
| `src/app/(app)/manual/page.tsx` + `docs/manual/README.md` | El aviso, en el mismo commit |
| `docs/testing/manual-e2e-asentamientos.md` | Verificar el aviso de P-04 |
| `docs/tecnica/README.md` | Regla, margen, estado de fases y § 11 |

## Pruebas

**Suite existente:** 529 tests.

**Nuevas, como mínimo:**

| Qué | Casos |
|---|---|
| Regresión | P-09 y las series del seed: **cero** avisos, con cada uno de los cuatro márgenes |
| Contrario | Un punto que baja y sube más que el margen: aviso. Justo en el margen: sin aviso (el límite es estricto) |
| Excesivo | Baja más del doble del ritmo previsto más el margen: aviso. Justo en el límite: sin aviso |
| Serie ascendente | Un punto que viene subiendo (V_prev > 0) y baja más del margen: contrario. La regla es simétrica |
| Historia insuficiente | Segunda lectura del punto: sin aviso. Tercera: evaluada |
| Huecos | Punto sin lectura en una visita intermedia: se compara con su última lectura real y con el Δt real |
| Alta y baja (Fase 11) | Un punto de alta se evalúa desde su tercera lectura propia. Uno de baja no aparece después de su baja |
| Margen por orden | La misma lectura avisa en primer orden y no en tercero |
| Velocidad previa null | Dos visitas el mismo día: sin aviso, sin `NaN` |
| `trendDeviationMargin` | Los cuatro valores de la tabla |

**Probar la ruta** (aprendizaje de la Fase 9): el aviso del panel y el del
editor salen de la misma función, y un test la llama con el histórico que
produce `computeHistory`, no con lecturas armadas a mano.

**En pantalla, antes de cerrar:**

1. Editor de la visita 5 de Torre Central: aviso bajo P-04.
2. Teclear en otra celda un valor que suba más de 6 mm: el aviso aparece en
   vivo. Corregirlo: desaparece.
3. Diálogo de cierre de la visita 5: la línea de lecturas marcadas.
4. Panel: marca en el semáforo de P-04, junto a «acelerando».
5. La ruta `/manual`.

## Criterios de aceptación

1. Una lectura que va contra la tendencia de su punto más que el margen de su
   orden muestra el aviso «contrario».
2. Una lectura que supera el doble del ritmo previsto más el margen muestra el
   aviso «excesivo».
3. Moverse menos de lo previsto no avisa nunca.
4. Las series de regresión (P-09 y el seed) no producen ningún aviso con ningún
   margen.
5. El aviso aparece en el editor de visita en vivo, en el diálogo de cierre y
   en el semáforo del panel. No aparece en el informe ni en el Excel.
6. El aviso no bloquea ni el guardado ni el cierre, y no cambia el nivel del
   semáforo.
7. El margen sale del orden de la visita, con `D_ref` como constante con
   nombre en `tolerances.ts`.
8. Sin migración: nada se persiste.
9. `npm run typecheck`, `npm run lint` y `npm test` pasan limpios, con los tests
   nuevos sumados a los 529.
10. Manual actualizado en sus dos copias, en el mismo commit, con capturas
    regeneradas.
11. Doc técnica actualizada: regla, margen, estado de fases y tabla de pruebas
    regenerada desde la ejecución (aprendizaje de la Fase 11).
12. `docs/testing/manual-e2e-asentamientos.md` cubre el aviso.

## Fuera de alcance

- **Detectar una lectura que se quedó quieta** cuando debía moverse. La banda
  lo admite a propósito (ver «Regla»).
- **Modelos de consolidación** (hiperbólico, Asaoka) para predecir la cota. La
  Fase 5 los descartó como geotecnia, no topografía (decisión 8), y el motivo
  sigue en pie.
- **Persistir el aviso** o llevarlo al informe y al Excel (decisión 3).
- **Margen editable por lugar** (decisión 2).
- **Cambiar el indicador de aceleración.** Sigue comparando dos velocidades
  (hallazgo 2).

## Riesgos

- **El margen de referencia es una decisión, no una norma.** `D_ref = 0.25 km`
  es razonable para un edificio y puede quedarse corto para una presa. Queda
  con nombre y documentado para cambiarlo sin tocar la regla, y la § 11 lo
  registra como candidato a hacerse editable si un usuario lo pide.
- **El factor 2 deja pasar errores moderados de exceso.** Es deliberado (ver
  «Regla»). Si en uso real se queda corto, el ajuste es una constante.
- **Un aviso que salta seguido se ignora.** Si la regla diera falsos positivos,
  el usuario dejaría de leerla. Por eso la verificación contra series reales
  es un criterio de aceptación y no un detalle.
