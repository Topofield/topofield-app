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
lugares: **Edificio Torre Central** (abierto, 6 puntos × 6 visitas) y **Edificio
Norte** (cerrado, para el informe de asentamientos).

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
- ✓ El catálogo lista **6 puntos** (`P-01` a `P-06`) con su descripción de
  ubicación, norte, este y cota inicial (100.0000).

### 4. Registro de visitas

- ✓ El lugar tiene **6 visitas** mensuales (2025-01-15 a 2025-06-15), todas en
  estado calculado.
- Abrir la **visita 1** (`/settlement/[siteId]/visits/[visitId]`).
- ✓ Muestra operador, equipo, fecha, y una fila por punto con su cota medida.
- ✓ Los parciales, acumulados y velocidad se calculan a partir de las cotas; no
  se teclean.

### 5. Panel de asentamientos — semáforo

- Ir al panel del lugar (`/settlement/[siteId]`).
- ✓ El **semáforo** no sale todo verde:
  - **P-06** (esquina SE, mayor carga) alcanza el nivel **alarma** (su velocidad
    en la primera visita, ≈ −23.6 mm/mes, supera el umbral de 10 mm/mes).
  - **P-05** (borde sur, intermedio) pasa por **alerta**.
  - El resto (P-01…P-04) queda en **precaución / normal**.
- ✓ El acumulado de **P-06** en la última visita es ≈ **−50.5 mm** (cruza el
  umbral de acumulado de 50 mm → alerta por acumulado).

### 6. Gráfica y tendencia

- ✓ La **gráfica** dibuja la serie temporal de asentamiento de cada punto; la
  selección por casillas permite mostrar u ocultar puntos.
- ✓ El indicador de **tendencia** marca los puntos como **convergentes**: la
  magnitud de la velocidad decrece en cada visita sucesiva (serie de
  consolidación que se estabiliza).

### 7. Registrar una visita nueva

- En el panel, clic para **registrar una visita**.
- Fecha posterior a la última; teclear cotas para los 6 puntos (por ejemplo,
  una décima de mm por debajo de la anterior).
- Guardar. ✓ La visita nace calculada y el panel recalcula parciales,
  velocidad y semáforo con la nueva medición.

### 8. Cerrar una visita

- Abrir una visita calculada y **cerrarla**.
- ✓ Queda en estado **cerrada** y sus lecturas pasan a solo lectura; el resto
  del lugar sigue admitiendo visitas nuevas.

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
tendencia, y cierre de visita y de lugar con inmutabilidad. Los niveles de
alerta anteriores están verificados a mano en el brief de la fase.
