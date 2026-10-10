# PRD-de-fase 44 — Los últimos pendientes

**Estado:** en curso (aprobado el 2026-10-09)
**Fecha de apertura:** 2026-10-09
**Rama:** `fase-44-ultimos-pendientes`
**Petición:** del usuario, 2026-10-09. Ante las tres peticiones sin fase de
`pendientes.md` —el semáforo por velocidad, NC1 y HC2— contestó: «haz todo,
quiero quitar lo que sobre». Al aprobar el PRD eligió ignorar en el semáforo
los movimientos de hasta 6 mm, quitar «Tomar del catálogo» también de la
visita y, con eso, quitar del todo el catálogo de equipos.
**Módulo:** asentamientos (el semáforo, en el motor y en el Excel), el
catálogo de equipos (sale entero, con su tabla) y la barra de navegación.

## Propósito

Cerrar las tres peticiones que quedaban, para que `pendientes.md` quede sin
nada abierto.

## Hoy

1. **El semáforo alarma por ruido.** `classifyAlert`
   (`lib/calculations/settlement.ts`) clasifica cada lectura por la peor de dos
   cosas: su velocidad y su acumulado. La velocidad es el parcial dividido entre
   los meses entre visitas. Con visitas cada 7 días, 1 mm de parcial —el ruido
   de una mira que resuelve el milímetro— da 4.35 mm/mes, que es «Precaución»
   con los umbrales de edificio (2 · 5 · 10 mm/mes), y 3 mm dan «Alarma». En la
   cartera real, las visitas 1 a 4 salen en «Alarma». Los avisos de tendencia
   ya descuentan un margen de ruido fijo de **6 mm** entre dos visitas
   (`trendDeviationMargin`, Fase 37), pero el semáforo no lo aplica. El Excel
   repite la regla en `alertFormula` (`lib/export/settlement-workbook.ts`).
2. **NC1.** El alta de la nivelación (`leveling-details-dialog.tsx`) pide el
   equipo con `EquipmentIdentity`, que pone primero «Tomar del catálogo». La
   poligonal lo quitó en las correcciones de la Fase 35 (`TotalStationIdentity`)
   porque el selector, con solo el equipo de la demo, parecía la única forma
   de darlo. La segunda parte de NC1, poder cambiar o crear el BM desde el
   formulario, ya existe: `BmSelector` ofrece «Otro (entrada libre)».
3. **HC2.** La ruta de la barra (`design-system/breadcrumbs.tsx`) solo enlaza
   hacia arriba. Para pasar de un proceso a otro hay que volver al hub del
   proyecto, y para cambiar de proyecto, al dashboard. Además, entre 640 y unos
   860 px todas las migas se truncan por igual, y el nombre de la página
   actual es el que menos se lee.

## Decisiones

1. **El semáforo no juzga la velocidad de un movimiento que cabe en el
   ruido.** Si el parcial de una lectura no pasa de **6 mm** en valor
   absoluto —el mismo margen de los avisos de tendencia—, la velocidad no
   cuenta para el semáforo, y la lectura se clasifica solo por su acumulado.
   La velocidad se sigue calculando, guardando y mostrando igual.
   - En la cartera real: las visitas 1 a 3 siguen en «Alarma», porque tienen
     saltos reales (A2 +11 mm, B10 −50 y +45 mm); la 4 deja de estarlo
     (6.0 mm no pasa de 6), y la 5 y la 6 quedan en «Normal».
   - Es una constante con nombre en `tolerances.ts`, no un número suelto.
   - El Excel cambia la fórmula del semáforo para que siga al motor, y
     `formula-check.ts` lo comprueba.
   - *Alternativa descartada:* restar el margen al parcial antes de dividir
     («velocidad demostrable»). Da casi lo mismo, pero hace que la velocidad
     del semáforo no sea la que se muestra en pantalla.
2. **Sale el catálogo de equipos.** El alta de la nivelación y la visita de
   asentamientos piden el equipo escribiendo, como la poligonal: marca, modelo
   y n.º de serie. Sin «Tomar del catálogo» en ningún formulario, el catálogo
   no lo usa nada, así que sale entero (decisión del usuario):
   - la página `/equipos`, su `loading` y sus acciones, y el ícono **Equipos**
     de la barra;
   - `components/equipment/` salvo los campos de identidad, que quedan como
     `equipment-identity.tsx`; `catalog-context.tsx` y su carga en el layout
     de `(app)`; `lib/equipment.ts`, `lib/validators/equipment.ts`,
     `types/equipment.ts`, `getEquipment`; los fieldsets de equipo del sistema
     de diseño (`equipment-fields.tsx`) y los tipos `TotalStationFields` y
     `LevelFields`, que solo usaba el catálogo; `CALIBRATION_MAX_MONTHS`;
   - los equipos de la demo (`insertar-equipos.ts`) y del seed;
   - la tabla `equipment`, con una migración que la borra. Va **después del
     merge** (doc técnica § 13): el código que hoy está en producción la lee.
     Su prueba pgTAP sale con ella.
   - el capítulo 7 del manual, «El catálogo de equipos», y su recorrido; los
     capítulos 8 y 9 pasan a ser el 7 y el 8.

   El equipo de cada proceso no cambia: sigue en sus columnas `equipment_*`,
   se escribe en su formulario y sale en el informe y en el Excel.
3. **Cada miga de la barra con hermanos abre un menú para saltar a otro**:
   - **El proyecto**: los demás proyectos de la cuenta.
   - **El proceso o el lugar**: los demás procesos del proyecto (poligonales,
     nivelaciones y lugares), con su tipo.
   - El menú usa el atributo `popover` de HTML, como el menú de cuenta: sin
     JavaScript propio, se cierra al tocar fuera o con Esc. Como no se puede
     anclar a la miga sin CSS que no todos los navegadores tienen, el panel se
     abre debajo de la barra, alineado con el inicio de la ruta.
   - Una miga sin hermanos sigue siendo texto o enlace. En el teléfono, la
     ruta sigue reducida al retorno, sin menús.
   - Las listas las consulta cada página en el servidor, con una consulta por
     lista, bajo RLS.
   - **Truncado:** la miga actual no se encoge antes que las demás; las
     anteriores se truncan primero.

## Criterios de aceptación

- Semáforo: las pruebas del motor fijan el borde (6.0 mm no cuenta, 6.1 sí),
  la cartera real queda con las visitas 4 a 6 en «Normal», y el Excel da el
  mismo semáforo que el motor (`formula-check`).
- Ni el alta de la nivelación ni la visita muestran «Tomar del catálogo»; el
  equipo se escribe, se guarda y sale en el informe.
- `/equipos` no existe y la barra no lo enlaza; ningún archivo importa lo que
  salió. Con la migración aplicada en local, `npx supabase test db` pasa.
- En una poligonal, la miga del proyecto lista los otros proyectos y la del
  proceso lista los procesos del proyecto; elegir uno navega allí. A 1280 y a
  390 px no hay desborde, y entre 640 y 860 px el nombre actual se lee.
- `npm run typecheck`, `npm run lint`, `npm test` y `npm run build` pasan.

## Al cerrar

- **Manual:** el semáforo en el capítulo de asentamientos; el equipo en los de
  nivelación y asentamientos; los menús de la ruta en primeros pasos; sin el
  capítulo de equipos. La barra pierde **Equipos** en casi todas las capturas,
  así que se regenera el manual completo.
- **Doc técnica:** § 4 (el modelo de datos sin `equipment`), § 6 (el
  semáforo), § 8 (la ruta y los fieldsets), § 13 (la migración después del
  merge), la tabla de pruebas y la § 11 (la entrada del semáforo por ruido se
  cierra).
- **Índices y estado:** `CLAUDE.md` («Van 44»; sin el catálogo en la
  arquitectura ni en las reglas), `PRD-TopoField.md` (su tabla de estado),
  `method.md`, `prds/README.md` y `pendientes.md`, que queda sin peticiones
  abiertas.
