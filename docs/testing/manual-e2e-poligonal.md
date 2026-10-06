# Checklist manual end-to-end — Módulo poligonal

Recorrido paso a paso para verificar el módulo poligonal contra los datos
precargados por la seed. Cubre los criterios de aceptación del PRD-de-fase 35
(`docs/prds/34-ux-poligonal.md`: el alta en popup, la pantalla por pasos, la
captura por popups, el orden detectado y la poligonal que no se cierra),
usando la UI tal como la usaría un usuario, y lo que sigue en pie de fases
anteriores: el dibujo y los grados decimales (Fase 13), mínimos cuadrados
(14), la georreferenciación (15), el guardado atómico (23) y la barra fija
(33).

## Preparación

1. Con Supabase local activo (`npx supabase start`), sobre una base recién
   reseteada, correr:
   ```
   npx supabase db reset && npm run seed
   ```
   El script lee `SUPABASE_SECRET_KEY` desde `.env.local` y **solo funciona
   justo después del reset**: sobre una base con datos no puede borrar el
   usuario —sus nivelaciones, lugares y visitas cerrados son inmutables— y se
   detiene pidiendo el `db reset`. Si falla con `permission denied`, ver la
   advertencia del § 2 de `docs/tecnica/README.md`. Se imprimen credenciales y
   URL al final.
2. En otra terminal, levantar el dev server:
   ```
   npm run dev
   ```
3. Abrir `http://localhost:3000/sign-in` e iniciar sesión con **Entrar**:
   - Email: `topofieldsarf@gmail.com`
   - Password: `seed1234`

El seed crea tres proyectos: **Lote catastral**, **Red geodésica** y
**Edificio en monitoreo**. El cuarto, **Proyecto de ejemplo**, lo crea la
aplicación la primera vez que la cuenta entra (el seed deja
`profiles.demo_seeded_at` vacío): trae la V10 en tercer orden, la Vivero con
mínimos cuadrados, la Vivero en sistema local con los vértices **D1** y **D3**
en su catálogo, dos nivelaciones y una Torre Alameda cerrada.

Las 13 poligonales de **Lote catastral**, todas **calculadas** —la poligonal
no se cierra—:

| Poligonal | Para qué sirve |
|---|---|
| Pentágono — Caso 1 del marco teórico | Cerrada; los ángulos cierran, los lados no: 1:46, ningún orden |
| Cuadrado perfecto 100×4 | Cierra exacta: 1:∞, primer orden |
| Cuadrado con error 0.4 m (fixture clave) | 1:1.001; distingue Brújula de Tránsito y Crandall |
| Enlace P1-P3 con deflexión | Abierta con control, por deflexiones |
| Reconocimiento E1-E4 (sin cierre) | Abierta sin control, transcrita en grados decimales |
| Cuadrado oficial | Cierra exacta; alimenta el informe **Informe de cierre — Poligonal** |
| Cuadrado marginal (no cumple) | 1:1.001 con Tránsito: no alcanza ningún orden, y su informe lo alerta |
| Poligonal V10 — cartera TT4 — bowditch / — transit / — crandall | La cartera real TT4, amarrada a TT4 del catálogo, con tres métodos |
| Poligonal Famarena — Sede Vivero — bowditch / — least_squares | La cartera real de la Sede Vivero; la segunda, con los pesos de la hoja |
| Poligonal Famarena — Sede Vivero — sistema local | La Vivero en (1000, 2000) y azimut 0°, para georreferenciar |

**Red geodésica** tiene una: **Cuadrado de control 200×4 (red geodésica)**.

> Sugerencia: tener abiertos `docs/carteras/poligonales.xlsx` (la cartera TT4)
> y `docs/templates/poligonales.xlsx` para contrastar números. Ojo: la hoja
> **Cerrada** de la plantilla encadena los azimuts como Az + 180° − α, la
> poligonal recorrida en el otro sentido, así que sus azimuts salen espejados
> respecto de la app (paso 11); errores, perímetro y precisión coinciden.

> No hay botón **Guardar**: cada popup guarda al confirmar, y cambiar de método
> en el Ajuste también. Los pasos escriben en la base; para volver al estado
> inicial, repetir la preparación.

## Recorrido

### 1. Dashboard

- Tras iniciar sesión llegas a `/dashboard`.
- ✓ Aparecen 4 tarjetas de proyecto, de la más reciente a la más antigua:
  **Proyecto de ejemplo**, **Edificio en monitoreo**, **Red geodésica** y
  **Lote catastral**. Cada una dice cliente, ubicación, fecha y sus procesos
  por estado: Lote catastral, «15 procesos · 14 en curso · 1 cerrado» (la
  nivelación Circuito BM-2; ninguna poligonal está cerrada). La tarjeta no
  muestra el orden de precisión: es un dato por proceso.
- ✓ El KPI "Proyectos activos" muestra 4.
- ✓ La barra de arriba (Fase 33): 48 px, a todo el ancho, y fija al bajar.
  Tiene el logo, **Equipos** y **Manual** con icono —con su nombre desde 640
  px— y un círculo con la inicial del correo. En el dashboard no lleva ruta.
- Pulsar el círculo. ✓ El menú de cuenta muestra el correo, el tema
  (**Sistema**, **Claro**, **Oscuro**) y **Cerrar sesión**. Elegir **Oscuro**:
  ✓ el tema cambia al instante. Volver a **Sistema**. ✓ El menú se cierra con
  Esc y al tocar fuera.
- Abrir **Manual**. ✓ El enlace lleva la raya amarilla de la sección actual.
  Pulsar un apartado del índice: ✓ el título queda visible bajo la barra.

### 2. Hub del proyecto

- Hacer clic en **Lote catastral**.
- ✓ La cabecera es compacta: nombre, badge **Activo**, la línea «Cliente Demo
  · Bogotá · MAGNA-SIRGAS · Origen Bogotá» y **+ Nuevo Proceso**. La
  descripción y el resto de los datos están en Configuración. No muestra
  equipo ni precisión: cada poligonal declara su equipo (Leica TS06 Plus · s/n
  LCS-2026-001 en las de este proyecto) y su orden se detecta al calcularla.
- ✓ Las tres tabs aparecen: **Procesos**, **Informes**, **Configuración**.

### 3. Tab Procesos — el listado de poligonales

- En la tab **Procesos**:
- ✓ Chips de módulo: **Poligonales (13)** —el activo—, **Nivelaciones (2)** y
  **Control de Asentamientos (0)**.
- ✓ Barra de filtros: el buscador «Buscar proceso…», el selector **Todos los
  tipos** y los chips de estado **Todos (13)**, **Borradores (0)** y
  **Calculados (13)**. **No** hay chips **Cerrados** ni **Rechazados**: la
  poligonal no se cierra.
- ✓ La tabla tiene las columnas Nombre, Estado, Precisión, Cumple y Última
  actividad, ordenada por actividad reciente. Cada fila dice nombre y tipo
  («Poligonal cerrada») y su estado, **Calculado**: el Pentágono, 1:46, ✕; el
  Cuadrado perfecto, 1:∞, ✓; el Cuadrado marginal (no cumple), 1:1.001, ✕; el
  Reconocimiento, «Sin verificación», —.
- ✓ **Todas** las filas ofrecen **Duplicar**, **Renombrar** y **Eliminar**,
  también **Cuadrado oficial** y la Vivero en sistema local.
- Escribir `cuadrado` en el buscador. ✓ Quedan cuatro: perfecto, con error,
  oficial y marginal. Pulsar **Borradores**. ✓ «Ninguno coincide», y aparece
  **Limpiar filtros**. Pulsarlo.
- En **Todos los tipos**, elegir **Abierta con control**. ✓ Solo el Enlace
  P1-P3. Limpiar filtros.
- Abrir **Renombrar** y **Eliminar** de una fila y pulsar **Cancelar**. (No
  pulsar **Duplicar**: crea la copia al instante y cambia los conteos del
  resto del recorrido.)
- A 390 px, ✓ la tabla pasa a tarjetas, una por fila, con las mismas acciones.

Los conteos son los de la seed recién cargada: los pasos 4, 15 y 16 crean tres
poligonales más.

### 4. Crear una poligonal — el popup «Nueva poligonal»

- Pulsar **+ Nuevo Proceso**. ✓ Diálogo «Nuevo proceso» con **Poligonal**,
  **Nivelación** y **Control de Asentamientos**.
- Pulsar **Poligonal**. ✓ Se abre el popup **Nueva poligonal** sin salir del
  hub: **Título**, **Ubicación**, **Responsable**, **Cargo del responsable**,
  **Tipo de poligonal** (Cerrada · Abierta con control · Abierta sin control,
  con una línea que explica cómo se verifica cada uno) y, plegado, **Equipo ·
  opcional**. Al pie: «El orden de precisión se detecta al ajustar.»,
  **Cancelar** y **Crear y empezar**. No pide orden, tipo de ángulo ni
  lecturas mínimas. (Ya no existe la página `/polygonal/new`.)
- Pulsar **Crear y empezar** con el título vacío. ✓ «El título es
  obligatorio.», sin salir del popup.
- Llenar: Título `Prueba TT4`, Ubicación `Bogotá`, Responsable `Ana Pérez`,
  Cargo `Topógrafa`, tipo **Cerrada** (✓ «Vuelve al punto de partida: la app
  comprueba el cierre angular y el lineal.»). Desplegar **Equipo** y, en
  **Tomar del catálogo**, elegir «Leica TS06 Plus · s/n LCS-2026-001». ✓ Llena
  Marca, Modelo y N.º de serie.
- **Crear y empezar**. ✓ Lleva a la poligonal, en el paso **1 · Datos**
  (`?tab=datos`).
- ✓ La cabecera, en una tarjeta: los badges **Poligonal cerrada** y
  **Borrador**, sin badge de orden; el título; «Bogotá», «Ana Pérez ·
  Topógrafa», «Leica TS06 Plus · s/n LCS-2026-001» y «Guardado d/m/aaaa,
  hh:mm»; y **Editar datos**, **Exportar a Excel** y **⋯**. En la barra fija,
  la ruta Dashboard › Lote catastral › Prueba TT4.
- ✓ Debajo, los pasos **1 · Datos**, **2 · Ajuste** y **3 · Informe**, y a la
  derecha **Ángulos en: DMS (° ′ ″) | Grados decimales**.
- ✓ **Puntos de amarre** muestra «Empieza por el amarre», con **Ingresar
  puntos de amarre** y **Medir sin amarre, en coordenadas locales**.
  **Mediciones** dice «Todavía no hay mediciones.», y **+ Agregar punto** está
  deshabilitado con «Se activa con el amarre.». El **Dibujo** dice «Todavía no
  se puede dibujar…».
- Pulsar **2 · Ajuste**. ✓ «El ajuste aparece cuando la poligonal está
  completa. Termina la captura en Datos.»
- Pulsar **3 · Informe**. ✓ «La poligonal no está completa: el informe muestra
  lo capturado.» y, debajo, «Un informe consolidado incluye la poligonal
  cuando está calculada.» Volver a **1 · Datos**.

### 5. Los puntos de amarre — V10 y TT4

- Pulsar **Ingresar puntos de amarre**. ✓ Popup **Puntos de amarre** con
  **Estación de partida** (Tomar del catálogo, Nombre, Norte, Este) y
  **Referencia · 0° atrás** en tres modos: **Punto con coordenadas**, **Solo
  el azimut** y **Sin 0 atrás**. Sin **Llegada**: es una cerrada.
- Estación de partida: Nombre `V10`, Norte `100135.666`, Este `101440.525`
  (V10 no está en el catálogo: se teclea).
- Referencia, modo **Punto con coordenadas**: Nombre `TT4`, Norte
  `100142.000`, Este `101436.5` (un Norte equivocado a propósito). **Guardar
  el amarre**. ✓ El popup no se cierra: «TT4 ya está en el catálogo con otras
  coordenadas: tómalo del catálogo o usa otro nombre.»
- En el **Tomar del catálogo** de la referencia, elegir «TT4 · N 100142.809 ·
  E 101436.500». ✓ Llena las coordenadas y el popup muestra «Azimut V10 → TT4:
  330°35′57.2″».
- **Guardar el amarre**. ✓ La tarjeta resume «Estación de partida V10 · N
  100135.666 · E 101440.525» y «0° atrás TT4 · azimut 330°35′57.2″», con
  **Editar amarre**. **+ Agregar punto** se activa.
- ✓ **Mediciones** ya tiene la primera fila: **V10 → TT4** con el badge **0
  atrás**, ángulo 0°00′00″, distancia — y azimut 330°35′57.2″. El dibujo
  sigue en «Todavía no se puede dibujar…»: aparece con la primera medición.
- ✓ «Guardado» de la cabecera cambia de hora: el popup guardó.

### 6. Las mediciones de la cartera TT4

- Pulsar **+ Agregar punto**. ✓ Popup **Agregar medición** con «Estás en V10 ·
  atrás en TT4», **Punto siguiente**, **Lecturas del ángulo** (Lectura 1 y
  **+ Lectura**), **Distancia horizontal V10 → … (m)**, y **Cancelar**,
  **Terminar** y **Agregar y seguir en …**. Sin casilla de cierre: se ofrece
  desde la segunda medición.
- Capturar las seis mediciones con **Agregar y seguir en …** (el botón toma el
  nombre del punto tecleado):

  | Estás en | Punto siguiente | Lectura | Distancia (m) |
  |---|---|---|---|
  | V10 | D1 | 211°15′07″ | 20.744 |
  | D1 | D2 | 124°29′42″ | 11.606 |
  | D2 | D3 | 148°41′40″ y, con **+ Lectura**, 148°41′42″ | 12.835 |
  | D3 | D4 | 91°01′01″ | 36.985 |
  | D4 | D5 | 100°27′43″ | 18.117 |
  | D5 | V10, con la casilla | 104°46′07″ | 15.425 |

- ✓ Tras cada una, el popup se vacía y dice dónde está ahora («Estás en D1 ·
  atrás en V10»…); la tabla y el dibujo crecen detrás, y el estado de la
  cabecera pasa a **En progreso**.
- ✓ Desde la segunda medición aparece la casilla **Cierre: este lado vuelve a
  V10**.
- En D2, con las dos lecturas: ✓ «Promedio 148°41′41″ · dispersión 2.0″». El
  promedio es el ángulo que entra en el cálculo.
- En D5, con la lectura y la distancia ya tecleadas, poner primero `V10` en
  **Punto siguiente** sin marcar la casilla y confirmar. ✓ «Para volver a V10,
  marca la casilla Cierre.», sin perder lo tecleado. Marcar **Cierre: este
  lado vuelve a V10**: ✓ el punto siguiente queda fijo en V10, **Terminar**
  desaparece y el botón dice **Agregar el cierre**. Pulsarlo.
- ✓ El popup sigue solo con el **Cierre angular**: «En V10 · atrás en D5», la
  casilla **El ángulo va hacia TT4, la referencia del amarre**, marcada, con
  «La cartera cierra contra el amarre.», y **Guardar el cierre angular**.
  Desmarcarla: ✓ «Si no, va hacia D1: el ángulo del vértice de arranque.»
  (el esquema de la Vivero). Volver a marcarla.
- Lectura `299°18′51″` y **Guardar el cierre angular**.

> **Guardado atómico (Fase 23).** Cada popup escribe la cabecera, las
> estaciones y sus lecturas en una sola transacción (`save_polygonal_process`):
> si algo falla, no queda nada a medias y el error se queda en el popup. El
> caso de fallo lo cubren las pruebas pgTAP (`npx supabase test db`,
> `supabase/tests/guardados_atomicos.test.sql`).

### 7. La tabla, el cierre angular y la recarga

- ✓ La tabla **Mediciones** se lee como la cartera:

  | # | Punto | Ángulo | Distancia (m) | Azimut |
  |---|---|---|---|---|
  | 1 | V10 → TT4 · **0 atrás** | 0°00′00″ | — | 330°35′57.2″ |
  | 2 | V10 → D1 | 211°15′07″ | 20.744 | 181°51′04.2″ |
  | 3 | D1 → D2 | 124°29′42″ | 11.606 | 126°20′46.2″ |
  | 4 | D2 → D3 | 148°41′41″ | 12.835 | 95°02′27.2″ |
  | 5 | D3 → D4 | 91°01′01″ | 36.985 | 6°03′28.2″ |
  | 6 | D4 → D5 | 100°27′43″ | 18.117 | 286°31′11.2″ |
  | 7 | D5 → V10 · **cierre** | 104°46′07″ | 15.425 | 211°17′18.2″ |
  | 8 | V10 → TT4 · **cierre angular** | 299°18′51″ | — | 330°36′09.2″ |

  El azimut es **sin ajustar**: el de la fila 8 se pasa 12″ del de partida.
  Cada fila lleva su lápiz **Editar medición N**.
- ✓ La tarjeta **Cierre angular**: N.º de vértices 6, Tipo de ángulo
  **Interiores** con la marca **detectado**, Ángulos en la condición 7, Suma
  observada 1080°00′12″, Suma teórica 1080°00′00″, Error angular **+12.0″** y
  Corrección por ángulo **−1.71″**.
- ✓ Ya no hay **+ Agregar punto** ni **Medir el cierre angular**: la poligonal
  está completa. Queda **Deshacer la última medición**.
- ✓ La cabecera dice **Calculado** y el badge **Tercer orden**.
- Recargar la página. ✓ Todo sigue igual: la fila 8 sigue siendo el cierre
  angular **hacia TT4** y la condición sigue teniendo 7 ángulos (el esquema de
  cierre contra el amarre se guarda, `has_closing_row`).
- Pulsar el lápiz de la fila 8. ✓ Popup **Cierre angular** con la casilla
  marcada, la lectura 299°18′51″ y **Quitar el cierre angular**. **Cancelar**.
- Pulsar el lápiz de la fila 4. ✓ **Editar medición**, «Medición desde D2 ·
  atrás en D1», con las dos lecturas, su promedio y **Eliminar medición**.
  **Cancelar**.
- Volver al hub. ✓ **Prueba TT4** sale **Calculado**, 1:7.045, ✓.

### 8. La cabecera: Editar datos, Guardado y ⋯

- En **Prueba TT4**, pulsar **Editar datos**. ✓ El mismo popup, titulado
  **Datos de la poligonal**, con los valores y el equipo desplegado, y
  **Guardar**.
- Cambiar Ubicación a `Bogotá, sector V10` y **Guardar**. ✓ La cabecera la
  muestra y «Guardado» cambia de hora.
- **Editar datos** otra vez y elegir **Abierta sin control**. ✓ «Cambiar el
  tipo recalcula la poligonal con las mediciones que ya tiene.» **Cancelar**.
- Abrir **⋯**. ✓ Solo **Duplicar** y **Eliminar**. Ni en la cabecera ni en
  ninguna otra parte hay **Cerrar proceso**, **Reabrir** ni barra de acciones
  al pie, y el estado nunca dice «Cerrado» ni «Rechazado».
- Pulsar **Eliminar**. ✓ «Se eliminará «Prueba TT4» con sus mediciones. Esta
  acción no se puede deshacer.» **Cancelar**.
- Abrir **Cuadrado oficial**, **⋯** → **Eliminar**. ✓ Además: «Está en el
  informe consolidado «Informe de cierre — Poligonal», que quedará sin esta
  sección.» **Cancelar**.
- Navegar por las migas o recargar en cualquier momento. ✓ Nunca pregunta por
  cambios sin guardar: no los hay.

### 9. Ángulos en DMS o en grados decimales

- En **Prueba TT4**, pulsar **Grados decimales**. ✓ La tabla pasa a seis
  decimales: V10 → D1, 211.251944° con azimut 181.851167°; el 0 atrás, azimut
  330.599222°. El amarre dice «azimut 330.599222°» y el cierre angular, Suma
  observada 1080.003333°. Los errores siguen en segundos (+12.0″, −1.71″).
- Pulsar el lápiz de la fila 3 (D1 → D2). ✓ La lectura es un solo campo,
  `124.495000` °. Teclear `124.4950001`: ✓ «Se guarda como 124°29′42″ (a la
  décima de segundo).» **Cancelar**.
- **Editar amarre**. ✓ «Azimut V10 → TT4: 330.599222°». **Cancelar**.
- Pulsar **2 · Ajuste** y **3 · Informe**. ✓ Los ángulos corregidos y los
  azimuts salen en decimal en los dos.
- Recargar. ✓ Sigue en **Grados decimales**: el formato se recuerda por
  proceso.
- Volver a **DMS (° ′ ″)**. ✓ Todos los valores son idénticos a los del paso 7:
  cambiar de formato no altera ninguno.
- Abrir **Reconocimiento E1-E4 (sin cierre)**. ✓ Abre ya en **Grados
  decimales** (paso 17).

### 10. Paso 2 · Ajuste — los cuatro métodos con la TT4

- Abrir **Poligonal V10 — cartera TT4 — bowditch** y pulsar **2 · Ajuste**.
- ✓ **Método de ajuste**: **Brújula (Bowditch)** · Tránsito · Crandall ·
  Mínimos cuadrados, con Brújula elegido.
- ✓ Cuatro cifras: Error angular **+12.0″**, Error de cierre lineal **0.016
  m**, Precisión relativa **1:7.045** y Orden alcanzado **Tercer orden**, en
  verde.
- Desplegar **Por qué tercer orden**. ✓ Una fila por orden, con n = 7:
  primer orden 2.6″ no · 1:100.000 no; segundo 13.2″ **sí** · 1:20.000 no;
  tercero 39.7″ sí · 1:5.000 sí (resaltado); ordinario 79.4″ sí · 1:3.000 sí.
  El error de 12″ cabe en segundo orden, pero la precisión solo alcanza el
  tercero.
- ✓ **Poligonal ajustada · Brújula (Bowditch)**: cada lado «desde → hacia»
  con ángulo corregido, azimut, distancia, proyecciones, corregidas y
  coordenadas. V10 → D1: ángulo corregido 211°15′05.3″, azimut
  **181°51′02.5″** y D1 en **N 100114.931, E 101439.858**, las de la hoja al
  milímetro. La fila **Σ** suma 0.008 y −0.014 en las proyecciones —el error
  de cierre— y 0.000 en las corregidas.
- ✓ **Corrección por método Brújula (Bowditch)**: «Corrección angular: −12.0″
  entre 7 ángulos, −1.71″ cada uno, incluido el de orientación.»; Diferencias
  ΔN · ΔE 0.008 · −0.014 m; Perímetro P 115.712 m; Factor −e / P · N · E
  −0.0000727 · +0.000122 m/m.
- Elegir **Tránsito**. ✓ Se recalcula y se guarda al instante («Guardado»
  cambia). D1 pasa a N 100114.931, E **101439.855**. La tarjeta, ahora
  **Corrección por método Tránsito**: Suma de proyecciones |N| · |E| 83.850 ·
  52.085 m y Corrección unitaria −0.0001 · +0.000271 m/m. ✓ El orden sigue en
  **Tercer orden**: se juzga con la cartera sin corregir.
- Elegir **Crandall**. ✓ D2 en N **100108.050**, E 101449.206 (con Tránsito,
  100108.052); Multiplicadores λ₁ · λ₂ −0.000112 · +0.000339.
- ✓ Abrir **— transit** y **— crandall**: dan las mismas cifras.
- Volver a la **— bowditch** y elegir **Mínimos cuadrados**. ✓ Aparecen σ
  angular (″), σ de distancia (m) y Mediciones por distancia, **vacíos**, con
  el aviso «Faltan los pesos del ajuste: σ angular, σ de distancia y número de
  mediciones.»; en lugar de la tabla, «El ajuste por mínimos cuadrados aparece
  con sus tres pesos.» Las cuatro cifras siguen ahí.
- Teclear `2`, `0.011` y `2`, y salir del último campo. ✓ Se guarda. V10 → D1
  sale con azimut **181°51′04.2″**: el ángulo de orientación no se corrige.
  La tarjeta dice «El ángulo de orientación en V10 fija el datum y no se
  corrige.», con la corrección de cada ángulo (V10, «—») y de cada distancia,
  y «σ₀ = 1.574. Los pesos supuestos describen bien las observaciones.» ✓ El
  orden sigue en **Tercer orden**.
- Volver a **Brújula (Bowditch)**. ✓ 181°51′02.5″ otra vez. Recargar: ✓ sigue
  en Brújula.

### 11. El orden alcanzado con los casos de la seed

- Abrir **Pentágono — Caso 1 del marco teórico**.
- ✓ En **1 · Datos**: el amarre dice «Sin 0 atrás · Azimut del primer lado
  45°00′00″»; la tabla, A → B … E → A (**cierre**), con azimuts 45°00′00″,
  333°15′00″, 265°15′00″, 173°00′00″ y 129°30′00″ (la hoja **Cerrada** de la
  plantilla da los espejados: 116°45′, 184°45′, 277° y 320°30′). El cierre
  angular: 5 vértices, interiores *detectado*, 540°00′00″ observada y
  teórica, error 0.0″.
- ✓ En **2 · Ajuste**: Error angular 0.0″, Error de cierre lineal 12.173 m,
  Precisión relativa 1:46 y Orden alcanzado **No alcanza ningún orden**, en
  ámbar; la cabecera lleva el mismo badge. **Por qué no alcanza ningún
  orden**: angular «sí» en los cuatro órdenes, lineal «no» en los cuatro. Los
  ángulos suman 540° exactos, pero los lados del caso no cierran.
- Abrir **Cuadrado con error 0.4 m (fixture clave)** → **2 · Ajuste**. ✓ 0.400
  m, 1:1.001, ningún orden. En la tabla, la fila **A → B** lleva B a:
  - **Brújula (Bowditch)**: Norte **100.300**;
  - **Tránsito**: **100.200**;
  - **Crandall**: **100.200**.
- ✓ Los tres coinciden con el ejemplo resuelto de `docs/math/poligonales.html`
  (§ 5.4). Volver a **Brújula (Bowditch)**.
- Abrir **Cuadrado perfecto 100×4** → **2 · Ajuste**. ✓ 0.000 m, 1:∞,
  **Primer orden**; el dibujo dice «Sin correcciones: la poligonal cierra
  exacta.»

### 12. Mínimos cuadrados — Sede Vivero (Fase 14)

- Abrir **Poligonal Famarena — Sede Vivero — least_squares** → **2 · Ajuste**.
  ✓ El método es **Mínimos cuadrados** y los pesos son los de la hoja: 2,
  0.011 y 2.
- ✓ En **Corrección por método Mínimos cuadrados**, la corrección de cada
  ángulo, en segundos: D1 +0.757, D2 +0.771, D3 +0.876, D4 +0.855 y la última
  Famarena_5 +0.741; la de cada distancia, en milímetros: −3.93, −2.94, +1.86,
  +3.36 y −0.92. La primera fila (Famarena_5, la orientación) no tiene
  corrección angular: «El ángulo de orientación en Famarena_5 fija el datum y
  no se corrige.»
- ✓ Coordenadas: D1 100117.464 / 101515.631, D3 100182.240 / 101581.781.
- ✓ σ₀ = **0.698**, «Los pesos supuestos describen bien las observaciones.» y
  «Con r = 3 condiciones, la prueba χ² al 95 % espera σ₀ entre 0.268 y
  1.765».
- ✓ Las cifras (error angular −4.0″, 0.010 m, 1:24.717, **Segundo orden**)
  son las mismas que en la Vivero con Brújula.
- Cambiar σ angular a `4`. ✓ Las correcciones cambian en vivo y se cargan más
  en los ángulos (D3 +1.099″); al salir del campo, se guarda. Restaurar `2`.
- Vaciar σ angular y salir del campo. ✓ «Faltan los pesos del ajuste…», y no
  se guarda: al recargar vuelve el 2.
- Con σ angular `0`, al salir: ✓ «El σ angular debe estar entre 0.01″ y
  9999.99″, con dos decimales como mucho.» Restaurar `2`.
- Abrir **Enlace P1-P3 con deflexión** → **2 · Ajuste** y elegir **Mínimos
  cuadrados**. ✓ Los tres campos salen **vacíos**. Con `2` / `0.011` / `2`
  aparece la tabla de correcciones (P2 +0.002″) y σ₀ 0.004: «Los σ supuestos
  son pesimistas: se midió mejor de lo declarado.» Recargar: ✓ el método y los
  pesos se conservan.
- Elegir **Brújula (Bowditch)** y luego otra vez **Mínimos cuadrados**. ✓ Los
  pesos siguen ahí y se ajusta al instante: viajan con cualquier método.
  Dejarla en **Brújula (Bowditch)**.
- **Exportar a Excel** la Vivero least_squares. ✓ «Cálculos» trae «Corrección
  angular (″)» y «Distancia ajustada (m)»; «Resumen», el orden alcanzado, el
  tipo de ángulo detectado y la sección «Ajuste por mínimos cuadrados» con los
  pesos y σ₀ 0.698.

### 13. El dibujo (Fase 13)

- Abrir **Poligonal V10 — cartera TT4 — bowditch**.
- ✓ En **1 · Datos**, la tarjeta **Dibujo** («Sin ajustar: los ángulos y las
  distancias como se midieron.») queda fija a la derecha al bajar. Muestra
  los vértices V10, D1…D5 rotulados, la grilla con coordenadas sin separador
  de miles (`N 100140`, `E 101440`), la flecha de norte, la barra de escala y
  el amarre **TT4** con su línea de orientación. La leyenda dice **Como se
  midió, sin ajustar**, sin trazo discontinuo.
- ✓ En **2 · Ajuste**, el **Dibujo** junto a la tabla: la leyenda dice
  **Ajustada** y **Sin compensar (desplazamientos ×100)**, y el trazo
  discontinuo no cierra: queda un hueco junto a V10. **Georreferenciar** va en
  la cabecera de esa tarjeta.
- Abrir el **Pentágono** → **2 · Ajuste**. ✓ Factor **×1**: su error de 12 m ya
  se ve.
- Abrir **Reconocimiento E1-E4** → **2 · Ajuste**. ✓ Sin trazo discontinuo:
  «Abierta sin control: no se compensa.»
- En la TT4, pulsar **Acercar** dos veces, arrastrar el dibujo, usar las
  **flechas** y pulsar **Restablecer**. ✓ Vuelve al encuadre completo. Todos
  los botones responden al teclado (Tab y Enter).
- Con el navegador en ancho de teléfono (390 px), ✓ los rótulos del dibujo se
  leen: no se encogen con la pantalla.

### 14. Georreferenciación (Fase 15)

- Abrir **Poligonal Famarena — Sede Vivero — sistema local** → **2 · Ajuste**.
  ✓ **Georreferenciar** está activo junto al dibujo.
- Pulsarlo. ✓ Popup **Georreferenciar la poligonal**. Punto A: estación
  **D1**, Norte real 100117.462, Este real 101515.6333. Punto B: **D3**,
  100182.239, 101581.7814. (El catálogo de Lote catastral no tiene D1 ni D3:
  se teclean.)
- ✓ Vista previa: rotación **35° 00′ 07.8″**, traslación N 100467.9285 · E
  99279.5759, factor de escala 1.000000, residuos D1 0.0 mm · D3 0.0 mm. La
  tabla lleva Famarena_5 de 1000.000 / 2000.000 a 100139.844 / 101491.444.
- ✓ El popup no remite a **Asignar coordenadas reales**, que ya no existe:
  dice «Si conoce las coordenadas reales de la partida y de la referencia, no
  hace falta georreferenciar: edite el amarre en el paso de Datos.» (paso 15).
- Cambiar el Norte de D3 a 100183.239. ✓ «La distancia real entre D1 y D3 no
  concuerda con la medida (factor 1.007587)…». Restaurarlo.
- Pulsar **Georreferenciar** (el botón del popup). ✓ Sobre el dibujo:
  «Georreferenciado el <fecha> con D1 y D3 (rotación 35° 00′ 07.8″, factor de
  escala 1.000000).» Las cifras siguen en 0.010 m, 1:24.717 y **Segundo
  orden**: girar no cambia el orden. D3 queda en 100182.239 / 101581.781.
- ✓ En **1 · Datos**, el amarre ya parte de Famarena_5 · N 100139.844 · E
  101491.444: se reescribe la posición, no las mediciones.
- Georreferenciar otra vez con D1 y **D4** (100193.8973, 101558.713). ✓ La
  línea muestra la última: D1 y D4, rotación 0° 00′ 00.0″.
- **Exportar a Excel**. ✓ «Resumen» trae la sección «Georreferenciación», con
  la fecha, «D1 y D4», la rotación y el factor de escala. En **3 · Informe**,
  ✓ la sección 5 dice «Coordenadas georreferenciadas el <fecha> con D1 y D4…».
- En el **Proyecto de ejemplo**, abrir **Poligonal Famarena — Sede Vivero —
  sistema local** → **2 · Ajuste** → **Georreferenciar**. ✓ **Tomar del
  catálogo** ofrece solo los puntos con coordenadas: 14_IS1, D1, D3 y TT4 (no
  C10, BM-1 ni BM-2, que solo tienen cota). Punto A: estación **D1** y, del
  catálogo, **D1** (✓ llena 100117.462 / 101515.6333); punto B: **D3** y
  **D3** (100182.239 / 101581.7814).
- ✓ La misma vista previa: rotación 35° 00′ 07.8″, factor 1.000000, residuos
  D1 0.0 mm · D3 0.0 mm, sin aviso de amarre. Confirmar. ✓ «Georreferenciado
  el <fecha> con D1 y D3…» sobre el dibujo, y Famarena_5 en 100139.844 /
  101491.444.
- En Lote catastral, abrir **Poligonal Famarena — Sede Vivero — bowditch**
  (amarre del catálogo 14_IS1) y georreferenciar con D1 y D3. ✓ «El amarre
  14_IS1 es del catálogo, que no cambia: pasa a amarre manual, con el mismo
  código.» Confirmar y recargar: ✓ las coordenadas no vuelven atrás, y en
  **1 · Datos** el amarre sigue diciendo «0° atrás 14_IS1»; **Editar amarre**
  abre en **Solo el azimut**. **Cancelar**.
- En la **TT4 con Tránsito** (— transit), abrir el popup con dos puntos. ✓
  «Con Tránsito, las coordenadas corregidas cambian unos milímetros al girar
  la poligonal.» **Cancelar**.

La georreferenciación se escribe en una sola transacción
(`georeference_polygonal`): cabecera y estaciones juntas.

### 15. Cerrada sin amarre — «Medir sin amarre»

- En el hub, **+ Nuevo Proceso → Poligonal**: Título `Prueba sin amarre`,
  tipo **Cerrada**, **Crear y empezar**.
- Pulsar **Medir sin amarre, en coordenadas locales**. ✓ Sin popup: el amarre
  dice «Estación de partida P1 · N 1000.000 · E 1000.000» y «Sin 0 atrás ·
  Azimut del primer lado 0°00′00″».
- **+ Agregar punto**. ✓ «Estás en P1 · sin 0 atrás», **sin** lecturas del
  ángulo: sin referencia, la primera medición no lleva ángulo. Punto
  siguiente `P2`, distancia `100`, **Agregar y seguir en P2**.
- Seguir: P2 → `P3`, `90°00′00″`, `100`; P3 → `P4`, `90°00′00″`, `100`; en P4,
  `90°00′00″`, `100` y la casilla **Cierre: este lado vuelve a P1** →
  **Agregar el cierre**.
- ✓ Sigue el popup **Cierre angular**: «En P1 · atrás en P4» y «El ángulo en
  P1, entre P4 (atrás) y P2 (adelante).», sin casilla de referencia. Lectura
  `90°00′00″` y **Guardar el cierre angular**.
- ✓ Tabla: P1 → P2 (90°00′00″, el ángulo medido al final), P2 → P3, P3 → P4 y
  P4 → P1 **cierre**, sin fila de 0 atrás ni de cierre angular. Cierre
  angular: 4 vértices, interiores *detectado*, 360°00′00″, error 0.0″. Estado
  **Calculado**, badge **Primer orden**.
- **Deshacer la última medición**. ✓ Quita primero el cierre angular: la fila
  P1 → P2 vuelve a «—», reaparece **Medir el cierre angular** en lugar de
  **+ Agregar punto** y la tarjeta dice «El cierre angular aparece cuando la
  poligonal vuelve a P1 y se mide su cierre angular.» Pulsar **Medir el
  cierre angular**, `90°00′00″` y guardar.
- Pulsar el lápiz de la fila P2 → P3. ✓ «Al eliminarla, P3 pasa a medirse
  desde P1. Las filas siguientes se recalculan.» **Cancelar**.
- **Editar amarre**. ✓ Abre en **Sin 0 atrás**, con «Ya hay mediciones:
  cambiar el amarre recalcula la poligonal con ellas.» Cambiar Norte a
  `5000`, Este a `7000` y **Guardar el amarre**.
- ✓ En **2 · Ajuste**, P2 queda en 5100.000 / 7000.000: las coordenadas se
  trasladan, los ángulos y las distancias no cambian y el orden sigue en
  **Primer orden**. Es lo que antes hacía «Asignar coordenadas reales».
- **Editar amarre** otra vez, elegir **Punto con coordenadas** con TT4 del
  catálogo y **Guardar el amarre**. ✓ No se guarda: «Estas mediciones se
  tomaron sin 0 atrás: con él, el primer ángulo pasaría a ser de orientación.
  Deshaga las mediciones antes de poner la referencia.» **Cancelar**.

### 16. Abierta con control — llegada y deflexión

- **+ Nuevo Proceso → Poligonal**: Título `Prueba enlace`, tipo **Abierta con
  control** (✓ «Llega a un punto de coordenadas conocidas…»), **Crear y
  empezar**.
- ✓ La tarjeta vacía ofrece **Ingresar puntos de amarre**, pero **no** «Medir
  sin amarre».
- **Ingresar puntos de amarre**. ✓ Además de partida y referencia, la sección
  **Llegada**: **Punto de llegada** y **Azimut de llegada (opcional)**, con
  «Con el azimut de llegada se comprueba también el cierre angular.»
- Partida `P1`, `0`, `0`; referencia **Sin 0 atrás**, azimut del primer lado
  `90°00′00″`; llegada `P3`, Norte `-50`, Este `186.6025`, azimut de llegada
  `150°00′00″`. **Guardar el amarre**. ✓ La tarjeta suma «Llegada P3 · N
  -50.000 · E 186.602 · azimut de llegada 150°00′00″».
- **+ Agregar punto**: P1 → `P2`, `100` (sin ángulo ni sentido). Seguir en P2:
  ✓ «Lecturas de la deflexión» y **Sentido** (Derecha | Izquierda), y la
  casilla **Llegada: este lado llega a P3**. Marcarla, `30°00′00″`,
  **Derecha**, `100` → **Agregar la llegada**.
- ✓ Sigue el **Cierre angular**: «Deflexión en P3 · atrás en P2, hacia la
  dirección de llegada», con Sentido. `30°00′00″`, **Derecha**, **Guardar el
  cierre angular**.
- ✓ Tabla: P1 → P2, —, 100.000, 90°00′00″; P2 → P3, 30°00′00″ «Derecha»,
  100.000, 120°00′00″; P3 **cierre angular**, 30°00′00″ «Derecha», azimut
  150°00′00″. Cierre angular: Deflexiones en la condición 2, Error contra el
  azimut de llegada 0.0″. En **2 · Ajuste**: **Primer orden**.
- Abrir **Enlace P1-P3 con deflexión** (de la seed, sin azimut de llegada). ✓
  Tabla: P1 → P2 sin ángulo, P2 → P3 30°00′00″ «Derecha» con azimut
  120°00′00″, y **P3** con el badge **llegada**, sin lápiz. El cierre angular
  dice «Sin cierre angular: hace falta el azimut de llegada y la deflexión en
  el punto de llegada.»
- Pulsar el lápiz de P2 → P3. ✓ **Editar medición**, «Medición desde P2 ·
  atrás en P1», «Punto siguiente: P3» fijo, la deflexión 30°00′00″ y el
  **Sentido** en **Derecha**. **Guardar** sin cambiar nada. ✓ La fila sigue
  en «Derecha» y 120°00′00″, y el Ajuste en 0.000 m: editar no pierde el
  sentido.
- Editarla otra vez con **Izquierda**. ✓ El azimut pasa a 60°00′00″ y el
  Ajuste a 100.000 m, 1:2, **No alcanza ningún orden**. Devolverla a
  **Derecha**: ✓ 120°00′00″ y **Primer orden** otra vez.
- En **2 · Ajuste**, **Por qué primer orden**: ✓ la columna Angular dice «no
  aplica»: sin azimut de llegada, el orden se juzga por la precisión lineal.

### 17. Abierta sin control — Reconocimiento E1-E4

- Abrir **Reconocimiento E1-E4 (sin cierre)**.
- ✓ En **1 · Datos**, en grados decimales: el amarre, «Sin 0 atrás · Azimut
  del primer lado 150.000000°»; la tabla, E1 → E2 sin ángulo, 45.800,
  150.000000°; E2 → E3, 175.500000°, 62.300, 145.500000°; E3 → E4,
  192.250000°, 38.500, 157.750000°; y **E4** «pendiente»: desde él seguiría
  la captura. En DMS, los azimuts son 150°, 145°30′ y 157°45′, los del
  documento del marco teórico y la hoja **Abierta sin control** de la
  plantilla.
- ✓ El cierre angular dice «Sin cierre angular: la abierta sin control no
  llega a un punto conocido.»
- ✓ En **2 · Ajuste**, sin selector de método: «Sin verificación de cierre: la
  abierta sin control no llega a un punto conocido y no hay nada que
  ajustar…»; la tabla se titula **Coordenadas encadenadas**, sin columnas
  corregidas. La cabecera no lleva badge de orden.

### 18. Errores de captura — se quedan en el popup

- En **Prueba TT4**, pulsar el lápiz de la fila 2 (V10 → D1). En cada caso,
  cambiar un solo campo, pulsar **Guardar**, comprobar y restaurar:
  - Vaciar la lectura. ✓ «El ángulo es obligatorio: teclea al menos una
    lectura.»
  - Segundos `6x`. ✓ Bajo el campo, «No es un número.»; al guardar, «Lectura
    1: no es un número.»
  - Segundos `65`. ✓ «Lectura 1: Los segundos deben estar entre 0 y 59.»
  - Segundos `7.25`. ✓ «Lectura 1: Los segundos admiten una sola cifra
    decimal.»
  - Distancia `-3`. ✓ «La distancia debe ser mayor que cero.»
  - Distancia `1500`. ✓ «La distancia no puede superar los 1000 m.»
  - Distancia `20.74444`. ✓ «La distancia admite hasta cuatro decimales.»
  - Punto siguiente `D3`. ✓ «Ya hay un punto D3 en la poligonal.»; vacío, ✓
    «El punto siguiente necesita un nombre.»
- ✓ En todos, el error sale arriba del popup, el popup no se cierra y lo
  tecleado no se pierde.
- **Cancelar**. ✓ La fila sigue en 211°15′07″ y 20.744, y «Guardado» no cambió.
- **Editar amarre** y teclear en la referencia las coordenadas de V10
  (100135.666, 101440.525). **Guardar el amarre**. ✓ «La referencia no puede
  estar en el mismo sitio que la estación de partida.» **Cancelar**.

### 19. Teléfono (390 px)

- Con el navegador a 390 px de ancho, abrir **Prueba TT4**.
- ✓ La cabecera envuelve sus badges y acciones; los pasos y **Ángulos en**
  bajan de línea; la ruta de la barra se reduce a «‹ Lote catastral». La
  página no desborda a lo ancho.
- ✓ En **1 · Datos** las columnas se apilan y aparece el selector **Tabla |
  Dibujo**. La tabla oculta las columnas # y Azimut y lleva el azimut bajo
  cada punto («Az 181°51′04.2″»), sin desplazamiento lateral. **Dibujo**
  muestra el dibujo y oculta la tabla.
- Abrir **Reconocimiento E1-E4** y pulsar **+ Agregar punto** («Estás en E4 ·
  atrás en E3»). ✓ El popup ocupa el ancho de la pantalla y sus campos se
  tocan con holgura. `E5`, `180`, `10` y **Terminar**. ✓ La fila E4 → E5 entra
  sin desborde horizontal.
- **Deshacer la última medición**. ✓ E4 vuelve a quedar pendiente, como en la
  seed.
- ✓ En **2 · Ajuste** el selector de método se ordena en dos columnas, las
  cuatro cifras en dos, y la tabla ajustada se desplaza de lado dentro de su
  tarjeta, sin mover la página.

### 20. Paso 3 · Informe

- Abrir **Poligonal V10 — cartera TT4 — bowditch** → **3 · Informe**.
- ✓ Portada con el título y **Fecha del informe**; **sin** la marca
  «Borrador» y sin registro de cierre. Datos: Tipo «Cerrada, ángulos
  interiores», Método de ajuste «Brújula (Bowditch)» y el equipo.
- ✓ Secciones:
  1. **Resultado**: +12.0″, 0.016 m, 1:7.045 y Orden alcanzado **Tercer
     orden**, con «El error angular cabe en la tolerancia de segundo orden
     (13.2″), pero la precisión lineal de 1:7.045 solo alcanza la de tercer
     orden (1:5.000). El orden es el más alto que cumple las dos.»
  2. **Datos de campo**: el amarre (V10 «Estación de partida», TT4
     «Referencia, 0° atrás», con «Azimut de partida V10 → TT4: 330°35′57.2″,
     calculado de las coordenadas.»), las mediciones «desde → hacia» —«V10 →
     TT4 (0 atrás)», «D5 → V10 (cierre)», «V10 → TT4 (cierre angular)»— y el
     cierre angular con «Suma teórica (6 − 2)·180° + 360°» y «Tolerancia de
     tercer orden, 15″·√7» 39.7″.
  3. **Corrección por método Brújula (Bowditch)**: «Paso 1 · Ángulos» —«El
     error angular se repartió por igual entre los 7 ángulos de la condición,
     incluido el de orientación en V10 y el cierre contra TT4.»— y «Paso 2 ·
     Proyecciones», con las fórmulas en notación matemática (fracciones,
     subíndices, sumatorias), no en texto plano, y las cifras de esta
     poligonal.
  4. **Poligonal ajustada**, con la fila Σ y «El último azimut vuelve a
     330°35′57.2″, el de partida: el cierre angular cuadra.»
  5. **Coordenadas** (D1 100114.931 / 101439.858) y el dibujo debajo.
- ✓ El resumen de precisión dice «1:7.045 · Tercer orden», y el pie,
  «Informe generado desde TopoField el <fecha>.» Debajo, fuera de la
  impresión: «Este proceso no está en ningún informe consolidado.» y
  **Generar un informe consolidado con este proceso**.
- Cambiar a **Tránsito** en el Ajuste y volver al informe. ✓ La sección 3 se
  titula **Corrección por método Tránsito**: su paso 2 reparte el error en
  proporción a la proyección absoluta de cada lado, con la corrección
  unitaria. Con **Crandall**, ✓ el paso 2 es «Paso 2 · Distancias», con λ₁ y
  λ₂. En los tres, el paso 1 dice qué ángulos se corrigieron, y las cifras son
  las del paso 10. Volver a **Brújula (Bowditch)**.
- ✓ La cabecera ofrece **Imprimir o guardar como PDF** (solo en este paso).
  Pulsarlo. ✓ Sin cabecera, pasos ni barra; el dibujo va bajo la tabla de
  coordenadas.
- Abrir **Cuadrado marginal (no cumple)** → **3 · Informe**. ✓ Orden alcanzado
  «Ninguno» y la alerta «No alcanza la precisión de ningún orden: el error
  angular o la precisión relativa supera las tolerancias del ordinario.» ✓
  Aun así ofrece **Generar un informe consolidado con este proceso**: una
  poligonal calculada entra, cumpla o no.
- Abrir **Cuadrado oficial** → **3 · Informe**. ✓ Debajo, «Informe de cierre —
  Poligonal · <fecha>» como informe consolidado que lo incluye.
- Abrir la **Vivero least_squares** → **3 · Informe**. ✓ La sección 3,
  **Corrección por método Mínimos cuadrados**, trae «Pesos a priori», las
  correcciones a los ángulos y a las distancias y «Calidad del ajuste» con
  σ₀.

### 21. Tab Configuración — puntos de referencia

- Volver al hub de **Lote catastral** y entrar a la tab **Configuración**.
- ✓ La sección "Puntos de referencia" lista los 5 puntos de la seed —**BM-01**
  y **BM-02** (BM), **GPS-1** (GPS), y **TT4** y **14_IS1** (Control, sin
  cota)— y los que entraron con los amarres: **V10** (paso 5) y **P3** (paso
  16), de tipo Control. **P1** no está: sin 0 atrás, la partida no va al
  catálogo.
- **Agregar punto**: el diálogo «Nuevo punto de referencia» pide código, tipo
  (BM, Control, GPS o Detalle), norte, este, cota y descripción. Crear
  `BM-03`, tipo BM, N=2000, E=2000, cota=2632.5, y **Guardar**.
- ✓ Aparece en la tabla. Editar y borrar también funciona.
- ✓ En **Zona de peligro**, **Eliminar proyecto** no se ofrece: «Tiene 1
  registro cerrado (procesos, lugares o visitas), que no se pueden borrar. Si
  ya no lo usas, archívalo.» Es la nivelación Circuito BM-2: las poligonales
  no cuentan.

### 22. RLS — aislamiento entre usuarios

- Copiar la URL del proyecto **Lote catastral** y, en el menú de cuenta (el
  círculo con la inicial), **Cerrar sesión**.
- En la pantalla de inicio, **Regístrate**. Llenar **Código de invitación**
  con el valor de `SIGNUP_INVITE_CODE` de `.env.local` (sin esa variable el
  registro está bloqueado), nombre, apellido, un correo nuevo (p. ej.
  `otro@example.com`) y una contraseña de 6 caracteres o más. **Crear
  cuenta**. ✓ Pantalla «Revise su correo».
- Abrir Mailpit en `http://127.0.0.1:55324` (puerto `[inbucket]` de
  `supabase/config.toml`) y pulsar el enlace del mensaje de confirmación **en
  el mismo navegador** (el canje es PKCE: necesita la cookie del registro). ✓
  Llega al dashboard con un solo proyecto, su propio **Proyecto de ejemplo**.
- Pegar la URL del proyecto **Lote catastral**.
- ✓ El sistema devuelve 404, «Proyecto no encontrado» (RLS no deja ver
  proyectos ajenos).

## Resultado esperado

Si los 22 puntos pasan, la poligonal cumple en su uso real los criterios del
PRD-de-fase 35: el alta en popup (a, paso 4); la cartera TT4 capturada por
popups, con sus azimuts sin ajustar y el cierre angular de 12″ (b, pasos 5 a
7), que se conserva al recargar (c, paso 7); Brújula al milímetro y tercer
orden detectado (d, paso 10); las cifras de cada método en el Ajuste y en el
informe, con su factor propio y los ángulos que corrige (e y f, pasos 10 y
20); el formato DMS o decimal en todas partes (g, paso 9); la captura en el
teléfono (h, paso 19); la cerrada sin amarre, la abierta con control y la
abierta sin control (i, pasos 15 a 17); las poligonales de la seed y de la
demo con los mismos resultados (j, pasos 10 a 14), y ninguna con cerrar,
reabrir, «Cerrado» ni «Rechazado» (k, pasos 3 y 8). La otra mitad de k —que
las poligonales cerradas antes de la migración se editan— no se ve con una
seed recién cargada, que ya no cierra ninguna. El criterio l lo cubre
`manual-e2e-informes.md`, y el m, las guías de nivelación y de asentamientos.

De fases anteriores siguen cubiertos el dibujo y los grados decimales (Fase
13, pasos 9 y 13), mínimos cuadrados (14, paso 12), la georreferenciación
(15, paso 14, también desde el catálogo del proyecto de ejemplo), el guardado
atómico (23, nota del paso 6) y la barra fija con la ruta y el menú de cuenta
(33, pasos 1 y 4). Cualquier discrepancia entre los números de la app, la
hoja Excel y el reporte HTML debe documentarse y corregirse.
