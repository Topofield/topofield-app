# Checklist manual end-to-end — Control de asentamientos

Recorrido paso a paso para verificar el módulo de control de asentamientos
contra los datos precargados por la seed. Cubre los criterios del PRD-de-fase 5
usando la UI tal como la usaría un usuario.

## Preparación

1. Con Supabase local activo (`npx supabase start`), correr:
   ```
   npm run seed
   ```
2. En otra terminal, levantar el dev server:
   ```
   npm run dev
   ```
3. Abrir `http://localhost:3000/sign-in` e iniciar sesión:
   - Email: `seed@topofield.local`
   - Password: `seed1234`

El monitoreo de la seed vive en el proyecto **Edificio en monitoreo**, con dos
lugares: **Edificio Torre Central** (abierto, 7 puntos × 6 visitas, con P-05
de baja y P-07 de alta) y **Edificio Norte** (cerrado, para el informe de
asentamientos).

## Recorrido

### 1. Dashboard

- ✓ El dashboard lista **3** proyectos: Lote catastral, Red geodésica y
  **Edificio en monitoreo**.

### 2. Hub del proyecto de monitoreo

- Abrir **Edificio en monitoreo**.
- ✓ La tab de procesos/lugares muestra los dos lugares: **Edificio Torre
  Central** (activo) y **Edificio Norte** (cerrado).

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
  estado calculado.
- Abrir la **visita 1** (`/settlement/[siteId]/visits/[visitId]`).
- ✓ Muestra operador, equipo, fecha, y una fila por punto **vigente** con su
  cota medida: P-01 a P-06, sin P-07.
- ✓ Debajo de la tabla: «No se miden en esta visita: P-07 (alta el 15 de marzo
  de 2025).»
- Abrir la **visita 5**. ✓ Sin fila de P-05 y con la nota «P-05 (de baja desde
  el 1 de mayo de 2025)». P-07 tiene fila.
- ✓ Los parciales, acumulados y velocidad se calculan a partir de las cotas; no
  se teclean.

### 5. Panel de asentamientos — semáforo

- Ir al panel del lugar (`/settlement/[siteId]`).
- ✓ El **semáforo** no sale todo verde:
  - **P-06** (esquina SE, mayor carga) alcanza el nivel **alarma** (su velocidad
    en la primera visita, ≈ −23.6 mm/mes, supera el umbral de 10 mm/mes).
  - **P-05** (borde sur, intermedio) no aparece: está de baja y no tiene
    lectura en la última visita. Su historia sigue en la gráfica.
  - El resto (P-01…P-04 y P-07) queda en **normal**.
- ✓ El acumulado de **P-06** en la última visita es ≈ **−50.5 mm** (cruza el
  umbral de acumulado de 50 mm → alerta por acumulado).

### 6. Gráfica y tendencia

- ✓ La **gráfica** dibuja la serie temporal de asentamiento de cada punto; la
  selección por casillas permite mostrar u ocultar puntos.
- ✓ El selector dice **P-05 (de baja)** y **P-07 (alta 15 de marzo de 2025)**.
  La serie de P-05 termina el 15/04 y la de P-07 empieza en 0 el 15/03.
- ✓ En **diferenciales**, los pares con P-07 llevan debajo «desde el 15 de
  marzo de 2025», y sus dos columnas de asentamiento restadas dan el
  diferencial: **P-01 – P-07** muestra −2,8 y −5,0 y un diferencial de 2,2.
- ✓ El indicador de **tendencia** marca los puntos como **convergentes**: la
  magnitud de la velocidad decrece en cada visita sucesiva (serie de
  consolidación que se estabiliza).

### 7. Registrar una visita nueva

- En el panel, clic para **registrar una visita**.
- Fecha posterior a la última; teclear cotas para los 6 puntos vigentes
  (P-01…P-04, P-06 y P-07; por ejemplo, una décima de mm por debajo de la
  anterior).
- Guardar. ✓ La visita nace calculada y el panel recalcula parciales,
  velocidad y semáforo con la nueva medición.

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

## Resultado esperado

Si los puntos pasan, el módulo de control de asentamientos cumple los criterios
del PRD-de-fase 5 en su uso real: catálogo de puntos, registro de visitas,
cálculo de parciales/acumulados/velocidad, clasificación por semáforo,
tendencia, y cierre de visita y de lugar con inmutabilidad. El paso 8 bis
cubre el PRD-de-fase 11: baja, deshacer la baja, alta y la regla de cierre de
la línea base. Los niveles de
alerta anteriores están verificados a mano en el brief de la fase.
