# PRD-de-fase 43 — Las correcciones del recorrido

**Estado:** en curso (aprobado el 2026-10-09)
**Fecha de apertura:** 2026-10-09
**Rama:** `fase-43-correcciones-del-recorrido`
**Petición:** del usuario, 2026-10-09. Ante los tres hallazgos que dejó el
recorrido real del manual (Fase 42) en `pendientes.md`, contestó «ok» a
«las tres últimas son correcciones pequeñas; si quieres, las hago en una sola
fase».
**Módulo:** asentamientos (la demo y el panel del lugar) y nivelación (el
diálogo de importación). Ni la base ni el motor cambian.

## Propósito

Al teclear las carteras reales en la aplicación, el recorrido del manual
encontró tres detalles que no cambian ningún cálculo pero sí lo que se ve: una
numeración que no coincide, una columna cortada y un texto que nombra un botón
que no existe. Esta fase los corrige.

## Hoy

1. **La demo numera sus visitas desde 1.** La aplicación numera la primera
   visita de un lugar como la **0**, la línea base (`nextNumber` en
   `settlement/[siteId]/actions.ts`), y Torre Alameda también lo hace así
   (`insertar-asentamiento.ts`). En cambio, la cartera real («Control de
   asentamiento estructural») se inserta de la 1 a la 7
   (`insertar-cartera.ts`, `visitNumber: i + 1`). Ese módulo lo usan la demo y
   el seed. Si la misma cartera se teclea en la aplicación, queda de la 0 a la 6.
2. **La columna Alerta del panel se corta.** En la tabla de visitas del panel
   (`components/settlement/visits-table.tsx`), a 1280 px, la columna sale
   cortada («Norm», «Alarm»). El panel reparte el ancho `3fr_2fr`, y las
   columnas «Máximo» y «Mayor Δ» llevan en la misma línea el valor y el código
   del punto. Con códigos largos, como «A4(5A-4B)», la tabla no cabe en su
   tarjeta y se desplaza por dentro. Se ve en la captura
   `asentamientos/12-panel.png`.
3. **El diálogo de importación nombra un botón que no tiene.** «Importar
   libreta desde archivo» (`components/leveling/import-dialog.tsx`) dice «Nada
   se guarda hasta que pulse Guardar». Pero su botón es **Usar estas
   lecturas**, y es ese botón el que guarda la libreta importada.

## Decisiones

1. **La cartera de la demo se numera de la 0 a la 6**, igual que la
   aplicación: `visitNumber: i`.
   - La prueba `cartera-asentamientos.test.ts` se ajusta: los avisos de B10
     pasan a las visitas **2** («excesiva») y **3** («contraria»).
   - Las referencias de la doc técnica a «la visita 3 / 4» de B10 se
     reescriben con la numeración nueva y con su fecha, para que no dependan
     del número. Lo mismo vale para «las visitas 2 a 5» del semáforo por
     velocidad en `pendientes.md` y en la § 11.
   - **Producción:** la demo que ya existe conserva su numeración de la 1 a la
     7. Es solo una etiqueta: el histórico se ordena por fecha. Solo las demos
     nuevas salen desde 0. Si se quiere corregir la que ya está, basta un
     `UPDATE` de una línea sobre ese lugar; no va en esta fase, salvo que el
     usuario lo pida al aprobar.
2. **En «Máximo» y «Mayor Δ», el código del punto va debajo del valor**, en
   letra pequeña, en lugar de al lado. Así la tabla cabe en su tarjeta a
   1280 px sin cambiar el reparto del panel ni quitar información. La columna
   Alerta conserva su texto, porque el semáforo no se comunica solo por el
   color.
3. **El texto del diálogo pasa a ser «Nada se guarda hasta que pulse Usar
   estas lecturas»**, con el nombre del botón en negrita.

## Criterios de aceptación

- `db reset && seed`, y una demo nueva: las visitas de la cartera van de la 0
  (base) a la 6, y B10 avisa en las visitas 2 y 3.
- En el panel de la cartera, a 1280 × 800, el contenedor de la tabla no se
  desplaza en horizontal (`scrollWidth === clientWidth`) y la columna Alerta se
  lee entera. A 390 px, la página sigue sin desbordarse.
- El diálogo de importación nombra «Usar estas lecturas».
- `npm run typecheck`, `npm run lint`, `npm test` y `npm run build` pasan.

## Pruebas

- `cartera-asentamientos.test.ts`: la numeración desde 0 y los avisos de B10
  en las visitas 2 y 3.
- El resto se verifica en pantalla con las capturas del manual.

## Al cerrar

- **Manual:** se regeneran las capturas del capítulo de asentamientos y del
  de nivelación, y se commitean solo las que cambian (el panel y el diálogo de
  importación). Se ajusta el texto del capítulo si nombra algo que cambió.
- **Doc técnica:** el estado de las fases, la tabla de pruebas y la § 11.
- **Índices y estado:** `CLAUDE.md` («Van 43»), `method.md`, `prds/README.md`
  y `pendientes.md`, donde las tres peticiones quedan resueltas.
