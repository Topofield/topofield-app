# PRD-de-fase 31 — Avisos del cálculo

**Estado:** cerrada
**Fecha de apertura:** 2026-10-02
**Fecha de cierre:** 2026-10-02

**Rama:** `fase-31-avisos`
**Petición:** del usuario, 2026-10-02: «abre la fase 31 con CR4». Es CR4 de
`pendientes.md`, que reúne cuatro criterios de la auditoría del cálculo: D-4,
D-5, D-8 y D-10. Sobre D-4 y D-5 pidió: «consulta si eso es válido y útil, tal
vez ni necesitamos eso». Después de la consulta decidió quitar los dos.
**Módulo:** poligonal, nivelación y control de asentamientos — avisos,
promedio y tendencia

> **Divergencias de la implementación:**
>
> - **`Verdict.caveat` desaparece entero.** Solo existía para la nota de
>   equipo. `validateReadings` pierde también su `warning` y la precisión
>   angular que recibía.
> - **El `order` de los formularios de equipo** sale de toda la cadena: los
>   dos fieldsets, el selector del catálogo y los cuatro formularios que lo
>   pasaban.
> - **La estación «Genérica TS-5» sale también del catálogo de equipos del
>   seed**: era el equipo de la poligonal que se quitó.
> - **El manual explica ahora la regla de la tendencia**, que antes no
>   documentaba.
> - **Capturas:** la 02 (el dashboard: Red geodésica con una poligonal y 18
>   procesos listos para cerrar), la 15 (la tendencia de Torre Alameda) y la
>   31 (el catálogo de equipos).
> - **Verificación en pantalla** en local, a 1280 px en claro y a 390 px en
>   oscuro: 29 comprobaciones, sin desborde ni errores de página. La primera
>   pasada falló en dos, por la comprobación y no por la app: el título del
>   veredicto se pinta en mayúsculas por CSS.
> - **Consulta previa en producción** (solo lectura): ningún proceso ni
>   visita cumplía la regla vieja de equipo insuficiente, así que ninguno de
>   los tres informes emitidos llevaba el asterisco, y ninguno cambia.
> - **Producción, pendiente:** el merge. Sin `db push`.

## Propósito

Cuatro avisos o indicadores que la auditoría encontró mal calibrados:

| # | Qué | Hoy | Decisión |
|---|---|---|---|
| D-4 | Aviso de equipo insuficiente | σ del equipo ≤ K: le dice «alcanza» a un equipo que falla el cierre entre el 32 y el 48 % de las veces | **Se quita** |
| D-5 | Aviso de dispersión entre lecturas de un ángulo | Rango > 2σ: avisa en el 32–58 % de los datos correctos | **Se quita** |
| D-8 | Promedio de asentamientos | Media de los acumulados de la visita: una alta o una baja lo mueven sin que nada se asiente | **Encadenado** |
| D-10 | «Acelerando» | Cualquier aumento de velocidad: TA-01 y TA-02 salen acelerando por ruido | **Solo por encima del ruido** |

Todo se calcula en vivo. **Nada guardado cambia**: no hay migración, y lo
cerrado conserva sus resultados.

## Hallazgos que condicionan la fase

### 1. Lo que dice la norma sobre D-4 y D-5

Consultada la FGCS 1984 (*Standards and Specifications for Geodetic Control
Networks*):

- **El instrumento** se exige por orden con requisitos fijos, no comparando su
  σ con K:
  - poligonal: «least count» del teodolito de 0.2″ en primer orden y 1.0″ en
    los demás;
  - nivelación: repetibilidad de la línea de visual (0.25″ a 1.00″), tipo de
    mira y resolución de instrumento y mira.
- **Las lecturas repetidas** de una dirección tienen un «límite de rechazo
  respecto a la media»: 4″ en primer orden y 5″ en los demás.

La regla de la app para D-4 (σ ≤ K) no sale de ninguna norma y es indulgente.
Lo que decide si un trabajo cumple es el cierre contra la tolerancia, que la
app ya juzga. El control de D-5 sí es normativo, pero las cifras de la FGCS son
para teodolitos de 0.2–1″ y órdenes más estrictos que los de la app, y el
usuario prefirió no tenerlo.

### 2. Dónde vive el aviso de equipo insuficiente

- `tolerances.ts`: `totalStationMeetsOrder` y `levelMeetsOrder`.
- El formulario de equipo (`equipment-fields.tsx`): la poligonal, la
  nivelación y la visita.
- El veredicto verde de la poligonal (`closure-verdict.tsx`): una nota «El
  cierre cumple, pero el equipo declarado no alcanza…».
- El resumen de precisiones del informe consolidado
  (`lib/reports/summary.ts`, `precision-summary.tsx`): un «Sí» con asterisco y
  nota al pie.
- El seed: «Poligonal con equipo insuficiente (fixture del aviso)», en Red
  geodésica, existe solo para mostrarlo.

En la demo de producción ningún equipo dispara el aviso: la poligonal declara
una estación de 5″ en tercer orden, y la nivelación un nivel digital. Ningún
informe emitido pierde su asterisco; se confirma con una consulta de solo
lectura antes del merge.

### 3. Dónde vive el aviso de dispersión

`validateReadings` (`validators/polygonal.ts`) avisa con
`readingDispersionTolerance` (`tolerances.ts`, `READING_DISPERSION_FACTOR` =
2). Para eso, la precisión angular del equipo baja de la página de la
poligonal al editor y a la tabla de estaciones. El mismo validador da el error
de lecturas faltantes, que se queda. La dispersión (máx − mín) se sigue
mostrando como dato junto al promedio.

### 4. El promedio encadenado, en Torre Central

| Visita | Puntos | Media de acumulados (hoy) | Encadenado |
|---|---|---|---|
| 0 | 6 | 0.00 | 0.00 |
| 1 | 6 | −8.17 | −8.17 |
| 2 | 7 (alta de P-07) | −10.99 | −12.82 |
| 3 | 7 | −13.64 | −15.47 |
| 4 | 6 (baja de P-05) | −14.63 | −17.02 |
| 5 | 6 | −14.30 | −16.69 |

La media actual sube en la visita 2 porque P-07 entra con acumulado 0, y en la
5 baja menos porque P-05 salió. Torre Alameda no tiene altas ni bajas y no
cambia (diferencia de 10⁻¹⁵).

### 5. «Acelerando» con el margen de la Fase 12

La Fase 12 tiene un margen de ruido por orden para un parcial:
`trendDeviationMargin`, de 1.5, 3, 6 y 12 mm. La regla nueva lo usa para la
velocidad: un punto **acelera** si |v_última| − |v_anterior| > m/Δt, con m el
margen del orden de la última visita y Δt su intervalo en meses. Es decir, la
velocidad crece más de lo que el error de una lectura explica.

- **Torre Alameda:** ningún punto acelera. TA-02 pasa de 0.11 a 0.65 mm/mes,
  frente a un margen de 6.5 mm/mes.
- **Torre Central, P-04:** deja de salir «Acelerando». Su velocidad sube de
  1.12 a 6.87 mm/mes (5.75), frente a un margen de 5.89. Es el salto de +7 mm
  de la lectura mal tomada que siembra el seed, y la sigue marcando el aviso
  de lectura fuera de tendencia. Una sola lectura dudosa no es una
  aceleración: es justo lo que pide D-10.

## Alcance

### A. D-4: se quita el aviso de equipo insuficiente

- `tolerances.ts`: fuera `totalStationMeetsOrder` y `levelMeetsOrder`, con sus
  tests.
- `equipment-fields.tsx`: fuera el aviso de la estación total y el del nivel.
  `order` deja de hacer falta si solo servía al aviso.
- `closure-verdict.tsx`: fuera la nota y la prop `instrumentMeetsOrder`;
  `polygonal-editor.tsx` deja de calcularla.
- `lib/reports/summary.ts` y `precision-summary.tsx`: fuera el asterisco y la
  nota al pie, con sus tests.
- `scripts/seed.mjs`: fuera la «Poligonal con equipo insuficiente»; la nota
  del «Cuadrado de control» de primer orden con estación de 1″ deja de hablar
  del aviso.
- El equipo se sigue capturando, guardando y mostrando: es trazabilidad.

### B. D-5: se quita el aviso de dispersión

- `tolerances.ts`: fuera `READING_DISPERSION_FACTOR` y
  `readingDispersionTolerance`, con sus tests.
- `validators/polygonal.ts`: `validateReadings` solo exige el mínimo de
  lecturas.
- La cadena que llevaba la precisión angular del equipo hasta la tabla de
  estaciones desaparece si no queda otro uso.
- La dispersión sigue a la vista como dato, sin juicio.

### C. D-8: promedio encadenado

- `settlement-summary.ts`: una función pura, `chainedMeans(visits)`. Para la
  primera visita con lecturas, la media de los acumulados. Para cada
  siguiente, la de la anterior con lecturas más la media de (cota − cota
  anterior) × 1000 de los puntos medidos en las dos. Si no hay ningún punto en
  común, la cadena se reinicia con la media de los acumulados. Una visita sin
  lecturas, null.
- `summarizeSite` usa el encadenado en `mean`. La vista de la visita toma su
  resumen y el de la anterior de `summarizeSite`, no de `summarizeVisit`, así
  que «frente a la anterior» es la media de los parciales comunes.
- Cambia en el KPI «Promedio actual», la tabla de visitas, la línea de
  tendencia y la vista. La banda mínimo–máximo de la tendencia sigue saliendo
  de los acumulados.

### D. D-10: «Acelerando» por encima del ruido

- `settlement.ts`: `computeTrends(visits, orders)` con la regla del hallazgo
  5. Recibe el orden de cada visita, como `detectTrendDeviations`. Si la
  última visita no tiene orden conocido, el punto no lleva tendencia: no se
  afirma lo que no se puede juzgar.
- `computeHistory` deja de calcular la tendencia: no conoce los órdenes.
  `SettlementHistory` pierde `trends`. La calculan el panel y el Excel, que sí
  tienen los órdenes de las visitas.
- Las etiquetas no cambian: «Acelerando» y «Convergente».

### E. Documentación

- **Manual, en sus dos copias:**
  - la configuración de poligonal, nivelación y visita, sin el aviso de
    equipo;
  - el editor de estaciones, sin el aviso de dispersión;
  - el panel y la vista de la visita, con el promedio encadenado y la regla
    de «Acelerando»;
  - las preguntas frecuentes («¿Qué pasa si el equipo que declaro no alcanza
    el orden…?»);
  - las capturas que cambien.
- **PRD principal:** § 5 y § 6.10–§ 6.11 donde nombren estos avisos, el
  promedio o la tendencia.
- **Doc técnica:** tolerancias, validación, motor de asentamientos, tabla de
  pruebas y § 11.
- **Auditoría:** D-4 y D-5 descartados, con su razón; D-8 y D-10 resueltos;
  la tabla de la § 6 (tolerancias y su fuente).
- **`pendientes.md`:** CR4 se cierra.
- **Guías e2e:** el paso 5 de asentamientos (P-04 ya no acelera) y lo que
  nombre la poligonal que se quita del seed (Red geodésica pasa a tener una
  poligonal).

## Decisiones del usuario (apertura)

1. **D-4 se quita.** Tras la consulta: la regla no tiene norma detrás, tranquiliza
   sin razón, y el cierre ya juzga el trabajo.
2. **D-5 se quita**, aunque la recomendación era conservarlo con el umbral
   corregido: sin control de lecturas repetidas, solo el cierre juzga la
   poligonal.
3. **D-8 y D-10, lo recomendado**: el usuario no tuvo preferencia.
4. **El diseño, tal cual**, incluida la poligonal del seed que se quita.

## Decisiones

| # | Decisión | Razón |
|---|---|---|
| 1 | La dispersión se sigue mostrando como dato | Quitar el juicio no obliga a esconder el dato; el topógrafo lo lee |
| 2 | El equipo se sigue capturando | Es trazabilidad del informe, no un control |
| 3 | Encadenado con los puntos medidos en las dos visitas | Es la definición de la auditoría (D-8); con altas o bajas, la media de acumulados mezcla líneas base |
| 4 | Reinicio de la cadena sin puntos comunes | Sin puntos comunes no hay parcial; la media de acumulados es lo único que queda |
| 5 | Ruido = margen de la Fase 12 sobre Δt | Un solo margen de ruido en todo el módulo, con su fuente; no un umbral nuevo |
| 6 | La tendencia sale de `computeHistory` | Necesita los órdenes, que `computeHistory` no recibe; así se hace con `detectTrendDeviations` |

## Pruebas

| Qué | Cómo |
|---|---|
| D-4 | Los tests de `totalStationMeetsOrder` y `levelMeetsOrder` se van; el resumen de precisiones sin asterisco ni nota |
| D-5 | `validateReadings`: el mínimo de lecturas sigue dando error; ninguna dispersión da aviso |
| D-8 | `chainedMeans`: sin altas ni bajas, igual a la media de acumulados; Torre Central con las cifras del hallazgo 4; una visita sin lecturas, null; sin puntos comunes, se reinicia |
| D-10 | `computeTrends`: acelera por encima del margen, no por debajo, y en la frontera; sin orden conocido, sin tendencia; con menos de tres visitas, sin tendencia; P-04 de Torre Central, convergente |
| Excel | «Puntos con tendencia creciente» con la regla nueva |

**En pantalla (local), claro y oscuro, 1280 y 390 px:**
- el formulario de equipo sin aviso;
- el veredicto de la poligonal de primer orden con estación de 1″;
- la tabla de estaciones sin aviso de dispersión;
- el panel de Torre Central (promedio y tendencia) y la vista de su visita 5;
- el informe consolidado.

## Criterios de aceptación

1. Ninguna pantalla, informe ni Excel juzga si el equipo alcanza el orden;
   el equipo se sigue mostrando.
2. Ninguna dispersión entre lecturas da aviso; la falta de lecturas sigue
   siendo error.
3. El promedio de una visita es el encadenado en el KPI, la tabla, la
   tendencia y la vista; Torre Alameda no cambia.
4. «Acelerando» solo aparece cuando la velocidad crece más que el margen; en
   la demo y en el seed, ningún punto acelera.
5. Nada guardado cambia y no hay migración.
6. `npm run typecheck`, `npm run lint`, `npm test`, `npx supabase test db` y
   `npm run build` pasan limpios. El manual está en sus dos copias, con sus
   capturas, y la § 11 revisada.

## Fuera de alcance

- **D-3, D-6 y D-7** (CR3): el equilibrado acumulado, la prueba χ² y el margen
  derivado de la longitud de los circuitos. El margen de D-10 es el de hoy;
  si CR3 cambia el de la Fase 12, «Acelerando» lo sigue sin tocar nada.
- **Los requisitos de instrumento de la FGCS** (least count, repetibilidad):
  la app no los aplica.
- **Una etiqueta «Estable»** para la velocidad dentro del ruido.

## Riesgos

- **Un equipo de verdad insuficiente pasa sin aviso.** Mitigación: el cierre
  lo juzga. Si no cumple, el veredicto lo dice.
- **Una lectura repetida mal transcrita pasa sin aviso.** Mitigación: se ve
  en la dispersión que sigue a la vista, y si arrastra el cierre, el
  veredicto lo dice. Es la decisión 2 del usuario.
- **El promedio de visitas ya conocidas cambia de valor en pantalla** donde
  hubo altas o bajas. Mitigación: es justo la corrección; se anota en el
  manual. Ningún valor guardado cambia.

## Tareas (en orden)

0. **Apertura:** este PRD, los estados en `method.md` y `prds/README.md`, y
   CR4 en curso en `pendientes.md`. Commit `docs:`. Rama.
1. **A** — quitar el aviso de equipo, con sus tests y el seed.
2. **B** — quitar el aviso de dispersión, con sus tests.
3. **C** — el promedio encadenado, con sus tests.
4. **D** — «Acelerando» por encima del ruido, con sus tests.
5. **Verificación en pantalla** en local, con `db reset` y seed.
6. **Cierre:**
   - documentación: manual (dos copias) y capturas, PRD principal, doc
     técnica, auditoría, guías e2e, `method.md`, `prds/README.md` y
     `pendientes.md`;
   - revisión de código y PR.
7. **Producción:** la consulta de solo lectura de los informes emitidos y el
   merge, que decide el usuario. Sin `db push`.
