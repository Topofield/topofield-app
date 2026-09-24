# Checklist manual end-to-end — Control de asentamientos

Recorrido paso a paso para verificar el módulo de control de asentamientos
contra los datos precargados por la seed. Cubre los criterios del PRD-de-fase 5
usando la UI tal como la usaría un usuario, y los de las fases 11, 12 y 18
(libreta de nivelación y panel del lugar, pasos 11 a 20).

## Preparación

1. Con Supabase local activo (`npx supabase start`), sobre una base recién
   reseteada, correr:
   ```
   npx supabase db reset && npm run seed
   ```
2. En otra terminal, levantar el dev server:
   ```
   npm run dev
   ```
3. Abrir `http://localhost:3000/sign-in` e iniciar sesión:
   - Email: `seed@topofield.local`
   - Password: `seed1234`

El monitoreo de la seed vive en el proyecto **Edificio en monitoreo**, con tres
lugares:

- **Edificio Torre Central** (abierto, 7 puntos × 6 visitas en **cotas
  directas**, con P-05 de baja y P-07 de alta);
- **Torre Alameda** (abierto, 8 puntos `TA-01`…`TA-08` × 14 visitas, todas
  con **libreta de nivelación**; las visitas 0–11 cerradas y la 12 y la 13
  calculadas; amarre en BM-1 salvo las visitas 5 y 11, en BM-2; la visita 9
  cierra fuera de tolerancia);
- **Edificio Norte** (cerrado, para el informe de asentamientos).

El proyecto tiene en su catálogo de puntos de referencia los dos BMs de amarre:
**BM-1** (100.0000) y **BM-2** (100.8450). **Red geodésica** no tiene puntos de
referencia: sirve para el arranque en frío (paso 19).

## Recorrido

### 1. Dashboard

- ✓ El dashboard lista **3** proyectos: Lote catastral, Red geodésica y
  **Edificio en monitoreo**.

### 2. Hub del proyecto de monitoreo

- Abrir **Edificio en monitoreo**.
- ✓ La tab de procesos/lugares muestra los tres lugares: **Edificio Torre
  Central** y **Torre Alameda** (activos) y **Edificio Norte** (cerrado).

### 3. Editor del lugar — catálogo de puntos

- Abrir **Edificio Torre Central**.
- ✓ La ficha del lugar muestra tipo de estructura **Edificio** y sus umbrales
  (velocidad 2 / 5 / 10 mm/mes, acumulado 25 / 50 / 75 mm, distorsión 1/500).
- ✓ El catálogo lista **7 puntos**. `P-01` a `P-06` tienen su descripción de
  ubicación, norte, este y cota inicial (100.0000).
- ✓ **P-05** figura **De baja desde el 1 de mayo de 2025**, con el motivo
  «Destruido por la obra del andén sur.», y en lugar de *Editar* ofrece
  **Deshacer baja**.
- ✓ **P-07** figura **Alta el 15 de marzo de 2025** y su cota C0 dice
  «Primera lectura».

### 4. Registro de visitas

- ✓ El lugar tiene **6 visitas** mensuales (2025-01-15 a 2025-06-15), todas en
  estado calculado. En la tabla **Visitas** del panel, la columna **Cierre**
  dice «—» en todas: son visitas en cotas directas sin error de cierre.
- Abrir la **visita 1** desde la tabla (`/settlement/[siteId]/visits/[visitId]`).
- ✓ La vista muestra nivelador, equipo y fecha, y en **Puntos de control** una
  fila por punto **vigente**: P-01 a P-06, sin P-07.
- ✓ No ofrece **Ver registro de nivelación**, y el indicador **Cierre de
  nivelación** dice «Cotas directas: cierre tecleado».
- **Editar**. ✓ *Captura de las cotas* dice **Cotas directas**, la tabla
  **Lecturas** tiene la **Cota medida** editable y hay un campo **Error de
  cierre (mm)**. Debajo de la tabla: «No se miden en esta visita: P-07 (alta
  el 15 de marzo de 2025).»
- Abrir el editor de la **visita 5**. ✓ Sin fila de P-05 y con la nota «P-05
  (de baja desde el 1 de mayo de 2025)». P-07 tiene fila.
- ✓ Los parciales, acumulados y velocidad se calculan a partir de las cotas; no
  se teclean.

### 5. Panel de asentamientos — semáforo

- Ir al panel del lugar (`/settlement/[siteId]`).
- ✓ El **semáforo** no sale todo verde:
  - **P-06** (esquina SE, mayor carga) alcanza el nivel **alarma** (su velocidad
    en la primera visita, ≈ −23.6 mm/mes, supera el umbral de 10 mm/mes).
  - **P-05** (borde sur, intermedio) no aparece: está de baja y no tiene
    lectura en la última visita. Su historia sigue en la gráfica.
  - **P-04** sale en **alerta** por velocidad (≈ 6,9 mm/mes), con la marca
    **⚠ Lectura fuera de tendencia** y la tendencia **Acelerando**: en la
    visita 5 sube 7,0 mm cuando venía bajando. Es la lectura mal tomada que
    siembra el seed (Fase 12). Debajo de la marca se lee el aviso completo.
  - El resto (P-01…P-03 y P-07) queda en **normal**.
- ✓ El acumulado de **P-06** en la última visita es ≈ **−50.5 mm** (cruza el
  umbral de acumulado de 50 mm → alerta por acumulado).

### 6. Gráfica y tendencia

- ✓ **Evolución por punto** dibuja el acumulado de cada punto contra los días
  desde la lectura base; pulsar un chip resalta ese punto y atenúa los demás,
  y **Todos** vuelve a mostrarlos por igual.
- ✓ Los chips dicen **P-05 (de baja)** y **P-07 (alta 15 de marzo de 2025)**.
  En **Ver datos en tabla**, la serie de P-05 termina el 15/04 y la de P-07
  empieza en 0 el 15/03.
- ✓ En **diferenciales**, los pares con P-07 llevan debajo «desde el 15 de
  marzo de 2025», y sus dos columnas de asentamiento restadas dan el
  diferencial: **P-01 – P-07** muestra −2,8 y −5,0 y un diferencial de 2,2.
- ✓ El indicador de **tendencia** marca los puntos como **convergentes**: la
  magnitud de la velocidad decrece en cada visita sucesiva (serie de
  consolidación que se estabiliza). La excepción es P-04 (ver paso 5).

### 7. Registrar una visita nueva

- En el panel, **+ Nueva visita**. ✓ El nivelador, el orden y el equipo
  vienen de la visita 5, y la nota lo dice.
- Fecha posterior a la última y **Captura: Cotas directas**. ✓ El campo **BM
  de amarre** desaparece. **Crear y abrir**.
- ✓ Se abre el editor (`…/visits/[visitId]/editar`) en cotas directas.
  Teclear cotas para los 6 puntos vigentes (P-01…P-04, P-06 y P-07; por
  ejemplo, una décima de mm por debajo de la anterior) y un error de cierre de
  `1.5`.
- **Guardar visita**. ✓ La visita nace calculada y el panel recalcula
  parciales, velocidad y semáforo con la nueva medición; su columna
  **Cierre** dice +1.5, sin ⚠: en cotas directas no hay tolerancia.

### 7 bis. Lectura fuera de tendencia (Fase 12)

- Abrir la **visita 5**. ✓ En la vista, la alerta de P-04 lleva la marca
  **⚠ Lectura fuera de tendencia**. **Editar**. ✓ Bajo la cota de P-04: «Se
  sale de la tendencia: el punto venía bajando 1,1 mm/mes y esta lectura lo
  hace subir 7,0 mm. Verifica la lectura.»
- Cambiar la cota de **P-01** a `100.0000`. ✓ Aparece al instante el aviso
  bajo P-01 (sube 8,0 mm). Cambiarla a `99.9790`. ✓ El aviso pasa a «baja
  13,0 mm cuando su ritmo anterior preveía unos 0,9 mm». Restaurar
  `99.9915`. ✓ El aviso de P-01 desaparece.
- Abrir **Cerrar Visita** en la visita 5. ✓ El resumen incluye «Lecturas
  fuera de tendencia: P-04». El aviso no impide confirmar el cierre.

### 8. Cerrar una visita

- Abrir la **visita 3** e intentar **cerrarla**.
- ✓ Se rechaza: «Cierra antes la visita 2: contiene la primera lectura de
  P-07, que es su línea base.»
- Cerrar en orden las visitas **0, 1, 2 y 3**.
- ✓ Cada una queda en estado **cerrada** y sus lecturas pasan a solo lectura;
  el resto del lugar sigue admitiendo visitas nuevas.
- Cerrar la **visita 4**. ✓ Cierra sin lectura de P-05: está de baja desde el
  1 de mayo.

### 8 bis. Dar de baja y de alta (Fase 11)

- Volver al catálogo. ✓ P-05 ya no ofrece *Deshacer baja*: dice «La baja ya es
  definitiva: la visita 4 (15 de mayo de 2025), posterior a la baja, está
  cerrada.»
- **Dar de baja** P-01 con fecha **2025-06-01** y un motivo. ✓ Se rechaza: la
  fecha debe ser posterior a su última lectura (15 de junio de 2025).
- Repetir con **2025-06-20**. ✓ P-01 queda de baja y en su fila aparece
  **Deshacer baja** (la visita 5 sigue abierta). Deshacerla. ✓ Vuelve a
  **Vigente**.
- **Agregar punto** P-08. ✓ El formulario pide **Fecha de alta** en lugar de
  la C0. Con **2025-05-15** se rechaza (no es posterior a la última visita
  cerrada); con **2025-06-01** se crea sin C0.
- Intentar cerrar la **visita 5** (15/06). ✓ Se rechaza: «Faltan lecturas de:
  P-08.»
- **Eliminar** P-06. ✓ Se rechaza y propone la baja: «…no puede eliminarse. Si
  el BM se perdió o se destruyó, dalo de baja.»

### 9. Inmutabilidad — lugar cerrado

- Volver al hub y abrir **Edificio Norte** (cerrado).
- ✓ El lugar está en solo lectura: no se pueden editar sus puntos ni sus
  visitas, ni **registrar una visita nueva**.
- ✓ Su panel muestra la serie completa (4 puntos × 3 visitas) igual que un lugar
  abierto; lo único bloqueado es la escritura.

### 10. RLS — aislamiento entre usuarios

- Cerrar sesión y entrar con otra cuenta.
- Intentar navegar a la URL del lugar **Edificio Torre Central**.
- ✓ Devuelve 404: RLS no deja ver lugares de proyectos ajenos.

### 11. Panel del lugar con libreta — Torre Alameda (Fase 18)

- Abrir **Torre Alameda** desde el hub.
- ✓ Encabezado: «Control de asentamientos en 8 puntos de control. Lectura base
  el 7 de enero de 2025.», la leyenda Precaución −25 mm, Alerta −50 mm y
  Alarma −75 mm, y las acciones **+ Nueva visita**, **Exportar a Excel** y
  **Editar lugar**.
- ✓ Indicadores: **Asentamiento máximo** −29.0 mm (TA-07), **Promedio actual**
  −20.5 mm (8 puntos de control medidos), **Distorsión angular** 1/1.682
  (TA-07 – TA-08, dentro del límite 1/500), **Velocidad máxima**
  −0.65 mm/mes (TA-02), **Visitas en alerta** 13 de 14 y **Visitas** 14
  (base 7 ene 2025 · última 11 nov 2025).
- ✓ La tabla **Visitas** va de la 13 a la 0 («Visita 0 (base)»). La 13:
  11 nov 2025, promedio −20.5, máximo −29.0 TA-07, amarre BM-1 100.0000,
  mayor Δ −0.6 TA-02, cierre −2.3, Precaución, Calculada. Las visitas 5 y 11
  tienen amarre **BM-2 100.8450**. La **visita 9** muestra **⚠ +9.8** en
  Cierre.
- Pulsar la fila de la visita 12 (fuera del enlace). ✓ Abre su vista. Volver
  con **← Volver a Torre Alameda**.
- ✓ **Tendencia del asentamiento**: el promedio con su banda mínimo–máximo y
  las líneas de −25 y −50 mm; el eje horizontal va en fechas y los cuatro
  intervalos de 14 días del principio se ven más cortos que los de 28 que
  siguen. Pulsar el punto de la última visita. ✓ Abre la visita 13.
- ✓ **Evolución por punto**: chips **Todos** y TA-01…TA-08 con su último valor
  (TA-07 −29,0 mm). Pulsar **TA-07**. ✓ Se resalta y el resto se atenúa.
  **Ver datos en tabla** despliega los valores.
- ✓ Siguen **Semáforo por punto (última visita)** y **Asentamientos
  diferenciales y distorsión angular**.

### 12. Vista de una visita y registro de nivelación

- Abrir la **visita 12**.
- ✓ Título «Visita 12», «14 de octubre de 2025. Amarre en BM-1. Nivelación por
  J. Rodríguez con Trimble DiNi 12.»; flechas ← → (a la 11 y a la 13) y las
  acciones **Ver registro de nivelación**, **Editar** y **Cerrar visita**.
- ✓ Indicadores: asentamiento máximo −28.7 mm (TA-07), promedio −20.2 mm
  (−0.7 mm frente a la anterior), mayor movimiento −1.5 mm (TA-07), puntos en
  alerta 1 de 8 (TA-07), cierre de nivelación −1.6 mm «Dentro de tolerancia
  (±4.5 mm)» y estado Precaución · Calculada.
- Pulsar **TA-07** en **Puntos de control**. ✓ Al lado aparece su historial:
  acumulado −28.7 mm, velocidad −1.63 mm/mes, desde la anterior −1.5 mm, la
  gráfica hasta esta visita y «Le faltan 21.3 mm para el umbral de alerta
  (−50 mm).» Pulsar la barra de TA-03 en **Asentamiento acumulado por
  punto**. ✓ Pasa a TA-03.
- **Ver registro de nivelación**. ✓ Panel lateral con fecha, nivelador,
  equipo y «BM-1, cota 100.0000»; dos armadas (BM-1 y CP-1); las vistas
  intermedias de TA-01…TA-08 resaltadas; Σ vistas más 2.8187, Σ vistas menos
  2.8203, error de cierre −1.6 mm, «Dentro de tolerancia (±4.5 mm)». Esc lo
  cierra y devuelve el foco al botón.
- Flecha →. ✓ Visita 13. Flecha → otra vez. ✓ Deshabilitada.
- Abrir la **visita 3** (cerrada). ✓ Sin **Editar** ni **Cerrar visita**.
  Escribir a mano `…/visits/[visitId]/editar` en la URL. ✓ Redirige a la
  vista.

### 13. Crear una visita digitando la libreta

- En el panel, **+ Nueva visita**. ✓ Captura «Digitar la libreta de
  nivelación», BM de amarre **BM-1** con cota 100.0000, tercer orden y el
  Trimble DiNi 12, tomados de la visita 13; la nota lo dice.
- Fecha **2025-12-09**. Vaciar el BM (elegir «Selecciona un BM del
  catálogo…») y **Crear y abrir**. ✓ «Elige el BM de amarre de la visita, con
  su cota.» Volver a elegir BM-1 y **Crear y abrir**.
- ✓ El editor abre en **Libreta de nivelación** con la plantilla de la visita
  13: BM-1, TA-01…TA-04, CP-1, TA-05…TA-08 y BM-1, sin lecturas. Bajo el
  código, «BM de amarre» en la primera y la última fila y «Punto de control»
  en las TA.
- Escribir «TA» en el punto de una fila. ✓ El navegador sugiere los códigos
  del catálogo y BM-1. Dejar el código como estaba.
- **Insertar** en la fila de TA-04. ✓ Aparece una fila vacía debajo.
  **Eliminarla**.
- Llenar la libreta (es la de la visita 12):

  | Punto | V+ | Dist V+ | V− | Dist V− |
  |---|---|---|---|---|
  | BM-1 | 1.7318 | 28.015 | | |
  | TA-01 | | | 1.1362 | |
  | TA-02 | | | 1.1650 | |
  | TA-03 | | | 1.2229 | |
  | TA-04 | | | 1.2518 | |
  | CP-1 | 1.0869 | 40.448 | 1.4187 | 38.673 |
  | TA-05 | | | 0.9601 | |
  | TA-06 | | | 0.9024 | |
  | TA-07 | | | 0.8639 | |
  | TA-08 | | | 0.8164 | |
  | BM-1 | | | 1.4016 | 34.270 |

- ✓ Resumen: Σ vistas más 2.8187, Σ vistas menos 2.8203, error de cierre
  −1.6 mm, «Dentro de tolerancia (±4.5 mm)». ✓ **Cotas de los puntos de
  control**, en solo lectura, repite las de la visita 12: TA-07 100.5373.
- **Guardar visita**. ✓ «Visita guardada.» **Ver la visita**: ✓ la vista
  ofrece **Ver registro de nivelación** con esa libreta.

### 14. Libreta fuera de tolerancia

- En el editor de la visita del paso 13, cambiar la V− del BM-1 de cierre a
  `1.3916`.
- ✓ Error de cierre +8.4 mm, «Fuera de tolerancia (±4.5 mm)» y el aviso «El
  cierre supera la tolerancia. La visita se guarda y se cierra igual, pero sus
  cotas no se compensan…». La cota de TA-07 pasa a **100.5361**, la calculada.
- **Guardar visita**. ✓ En el panel, su columna **Cierre** dice **⚠ +8.4**; en
  la vista, el indicador **Cierre de nivelación** dice «Fuera de tolerancia
  (±4.5 mm)».
- **Cerrar visita**. ✓ El diálogo muestra «Cierre de la libreta: +8.4 mm ·
  Fuera de tolerancia (±4.5 mm)» y el aviso de que se cierra con las cotas sin
  compensar; **Confirmar Cierre** se habilita al marcar la casilla. Confirmar.
  ✓ La visita queda **Cerrada**.
- La comprobación aritmética fallida, que sí bloquea el cierre, no se puede
  provocar desde la tabla (las sumas salen de las mismas lecturas): la cubren
  los tests de `validateVisitClose`.

### 15. Importar la libreta

- **+ Nueva visita** con **Captura: Importar la libreta desde un archivo**. ✓
  El BM de amarre pasa a ser opcional. Fecha posterior a la última, **Crear y
  abrir**. ✓ El editor abre con el diálogo **Importar la libreta de la visita**.
- **Descargar plantilla CSV** y reemplazar sus filas por la libreta del paso
  13 (`ida,BM-1,bm,1.7318,,28.015,`, `ida,TA-01,radiacion,,1.1362,,`, …,
  `ida,CP-1,pc,1.0869,1.4187,40.448,38.673`, …, `ida,BM-1,bm,,1.4016,,34.270`).
  Elegirla. ✓ Formato «Plantilla CSV de TopoField», 2 armadas · 12 visuales,
  BM de amarre BM-1 y las notas «BM de amarre» y «Punto de control». Sin aviso
  de reemplazo: la plantilla precargada no tiene lecturas.
- **Usar estas lecturas**. ✓ La libreta se llena y el resumen da −1.6 mm; nada
  se ha guardado todavía. **Guardar visita**.
- En otra visita abierta, **Importar desde archivo** con
  `docs/carteras/CRDUDO-TRAMO2.L`. ✓ «El archivo arranca en C10 y la visita
  tenía como amarre BM-1. Al aceptar, el amarre de la visita pasa a ser C10.»
  Aceptar. ✓ Amarre C10 = 2541.7545 y, bajo la libreta, «TA-01 no tiene vista
  menos en la libreta: queda sin cota.» para cada punto de control. **No
  guardar**: recargar la página y descartar los cambios.

### 16. Renombrar un punto con libretas abiertas

- En el catálogo de Torre Alameda (**Editar lugar**), **Editar** TA-08 y
  cambiar el código a `TA-08X`.
- Abrir el editor de la **visita 13**. ✓ La fila de la libreta dice TA-08X,
  con la nota «Punto de control». **Guardar visita**. ✓ La cota de TA-08X
  sigue en 100.5847.
- Abrir el **registro de nivelación** de la **visita 11** (cerrada). ✓ Conserva
  el código TA-08.
- Devolver el código a `TA-08`.

### 17. Cotas directas en un lugar con libreta

- En el editor de la visita 13, cambiar *Captura de las cotas* a **Cotas
  directas**. ✓ Aviso «Al guardar en cotas directas se descarta la libreta de
  esta visita.» Volver a **Libreta de nivelación** sin guardar. ✓ El aviso
  desaparece.
- El recorrido completo en cotas directas es el del paso 7, sobre Torre
  Central.

### 18. Excel

- **Exportar a Excel** en Torre Alameda. ✓ El libro tiene la hoja
  **«Libretas»** con una cabecera y las filas de cada visita, y «Datos Crudos»
  un bloque **«Visitas»** con captura, BM de amarre, cota, cierre y tolerancia.
- **Exportar a Excel** en Edificio Torre Central. ✓ «Libretas» dice «Ninguna
  visita de este lugar tiene libreta de nivelación.»

### 19. Arranque en frío: proyecto sin BMs de referencia

- En **Red geodésica** (sin puntos de referencia), crear un lugar con un punto
  `B-01` sin C0 y abrir su panel. ✓ Indicadores sin datos, la tabla dice «Aún
  no hay visitas registradas en este lugar.» y las gráficas, «Todavía no hay
  lecturas».
- **+ Nueva visita**. ✓ El selector de BM solo ofrece **Otro (entrada
  libre)**. Elegirlo, teclear `BM-X` y `100.0000`, fecha y **Crear y abrir**.
- ✓ Plantilla BM-X, B-01 (intermedio), BM-X. Llenar BM-X V+ `1.5000` dist
  `20`; B-01 V− `1.4000`; BM-X V− `1.5002` dist `20`. ✓ Cierre −0.2 mm dentro
  de tolerancia (±2.4 mm) y B-01 con cota ≈ 100.1000, acumulado 0: es su
  línea base. **Guardar visita**.

### 20. Teléfono (390 px)

- Con el ancho de ventana en 390 px, recorrer el panel de Torre Alameda, la
  vista de la visita 12 con TA-07 seleccionado, su registro de nivelación y
  su editor.
- ✓ Ninguna página se desplaza en horizontal
  (`document.documentElement.scrollWidth` = 390): las tablas se desplazan
  dentro de su tarjeta, el historial del punto pasa debajo de la tabla y el
  registro de nivelación ocupa el ancho de la pantalla.
- ✓ Las gráficas caben en el ancho y los chips de **Evolución por punto** se
  reparten en varias líneas.

## Resultado esperado

Si los puntos pasan, el módulo de control de asentamientos cumple los criterios
del PRD-de-fase 5 en su uso real: catálogo de puntos, registro de visitas,
cálculo de parciales/acumulados/velocidad, clasificación por semáforo,
tendencia, y cierre de visita y de lugar con inmutabilidad. El paso 8 bis
cubre el PRD-de-fase 11: baja, deshacer la baja, alta y la regla de cierre de
la línea base. El paso 7 bis cubre el PRD-de-fase 12: el aviso de lectura
fuera de tendencia. Los pasos 11 a 20 cubren el PRD-de-fase 18: el panel y la
vista de la visita, el registro de nivelación, la libreta digitada e
importada, el cierre fuera de tolerancia, el renombrado con libretas
abiertas, la hoja «Libretas», el arranque en frío y el teléfono. Los niveles de
alerta anteriores están verificados a mano en el brief de la fase.
