# Checklist manual end-to-end — Módulo poligonal

Recorrido paso a paso para verificar el módulo poligonal contra los datos
precargados por la seed. Cubre los criterios de aceptación del PRD-de-fase 3
de cabo a rabo, usando la UI tal como la usaría un usuario.

## Preparación

1. Con Supabase local activo (`npx supabase start`), correr:
   ```
   npm run seed
   ```
   El script lee `SUPABASE_SECRET_KEY` desde `.env.local`. Se imprimen
   credenciales y URL al final.
2. En otra terminal, levantar el dev server:
   ```
   npm run dev
   ```
3. Abrir `http://localhost:3000/sign-in` e iniciar sesión:
   - Email: `seed@topofield.local`
   - Password: `seed1234`

> Sugerencia: tener abierto `docs/templates/poligonales.xlsx` en paralelo para
> contrastar números.

## Recorrido

### 1. Dashboard

- Tras iniciar sesión llegas a `/dashboard`.
- ✓ Aparecen 2 tarjetas de proyecto: **Lote catastral** (tercer_orden) y
  **Red geodésica** (primer_orden).
- ✓ El KPI "Proyectos activos" muestra 2.

### 2. Hub del proyecto

- Hacer clic en **Lote catastral**.
- ✓ El hub muestra el header con datos del proyecto y equipo (Leica TS06 Plus,
  precisión 5″/3+2ppm).
- ✓ Las tres tabs aparecen: **Procesos**, **Informes**, **Configuración**.

### 3. Tab Procesos

- En la tab **Procesos**:
- ✓ Sección "En progreso" lista 5 tarjetas (los 5 procesos `calculated`).
- ✓ Sección "Cerrados" lista 2 tarjetas (el cerrado y el rechazado).
- ✓ Cada tarjeta muestra tipo, nombre, fecha y badge de estado.

### 4. Cálculo en vivo — Pentágono

- Abrir **Pentágono — Caso 1 del marco teórico**.
- ✓ La zona de configuración muestra los datos (start A, N=1000, E=1000, Az 45°).
- ✓ La tabla de estaciones tiene 5 filas (A–E) con sus ángulos y distancias.
- ✓ Los azimuts calculados en vivo coinciden con los de la hoja **Cerrada** del Excel
  (cargar el mismo caso o usar los precargados).
- ✓ El panel de resultados muestra:
  - Σ ángulos = 540°, error angular ≈ 0″, cumple tolerancia.
  - Perímetro ≈ 554.35 m, precisión relativa razonable.
- ✓ El semáforo del panel es verde (cumple).

### 5. Métodos de corrección — Cuadrado con error 0.4 m

- Volver al hub y abrir **Cuadrado con error 0.4 m (fixture clave)**.
- ✓ El panel de resultados muestra error lineal = 0.400 m, precisión 1:1001.
- ✓ El semáforo es rojo (NO cumple tercer orden: 1:1001 < 1:5000).
- Cambiar el selector de método a **Tránsito** y luego a **Crandall**.
- ✓ La tabla "Coordenadas corregidas" muestra:
  - **Bowditch**: N de B = **100.300**.
  - **Tránsito**: N de B = **100.200**.
  - **Crandall**: N de B = **100.200**.
- ✓ Los tres números coinciden con la hoja **Cerrada** del Excel y con el
  ejemplo trabajado del reporte HTML (`docs/math/poligonales.html` § 5.4).

### 6. Reasignar coordenadas

- En el mismo proceso, clic en **Asignar coordenadas reales**.
- En el modal, cambiar Norte a `5000` y Este a `7000`. Aplicar.
- ✓ Las coordenadas de todas las estaciones se actualizan (la N de B pasa a
  `5100.300`, etc.) manteniendo los azimuts y deltas (en vivo).
- Volver al modal y restaurar los valores originales (0, 0). Aplicar.

### 7. Guardar

- Editar algún campo trivial (ej. añadir notas) y clic en **Guardar**.
- ✓ Aparece "Proceso guardado" y el badge sigue en "Calculado".

### 8. Cierre — flujo normal

- Volver al hub y abrir **Pentágono — Caso 1** (no el oficial).
- Clic en **Cerrar proceso**.
- ✓ El modal muestra el resumen (tipo, perímetro, error, precisión, fecha).
- Marcar la casilla "Confirmo que los datos son correctos".
- Clic **Confirmar cierre**.
- ✓ El proceso queda con badge "Cerrado" y el editor pasa a solo lectura
  (mensaje "Este proceso está cerrado…").

### 9. Cierre como rechazado

- Abrir **Cuadrado con error 0.4 m** (el de la sección 5).
- Clic en **Cerrar proceso**.
- ✓ El modal advierte: "La precisión relativa no alcanza la tolerancia; solo
  puede cerrarse como rechazado."
- ✓ El botón confirma **Cerrar como rechazado** (variante danger).
- Marcar la casilla y confirmar.
- ✓ El badge pasa a "Rechazado".

### 10. Inmutabilidad de procesos cerrados

- Abrir **Pentágono oficial (cerrado)**.
- ✓ Mensaje "Este proceso está cerrado; los datos son de solo lectura."
- ✓ Los campos de configuración, la tabla de estaciones y el selector de
  método están deshabilitados.
- ✓ No aparecen los botones **Guardar**, **Asignar coordenadas reales** ni
  **Cerrar proceso**.

### 11. Validación de captura — distancia fuera de rango

- Volver al hub y abrir **Cuadrado perfecto**.
- En la primera estación cambiar la distancia a `1500`.
- ✓ La celda se marca con borde rojo y aparece el mensaje "La distancia no
  puede superar los 1000 m."
- ✓ El botón **Guardar** se deshabilita y aparece "Corrige las celdas con
  error para poder guardar."
- Restaurar `100` para volver al estado válido.

### 12. Validación de captura — segundos inválidos

- En la primera estación cambiar los segundos del ángulo a `65`.
- ✓ Borde rojo y mensaje "Los segundos deben estar entre 0 y 59."
- Restaurar a `0`.

### 13. Crear un proceso nuevo

- En la tab Procesos del hub, clic **+ Nuevo Proceso**.
- ✓ Modal con tres opciones; **Poligonal** activo, las otras dos
  ("Nivelación", "Asentamiento") deshabilitadas con tooltip "Disponible en una
  fase futura".
- Clic **Poligonal**. Llega a `/projects/[id]/polygonal/new`.
- Llenar: Nombre "Prueba manual", Tipo "Cerrada", Código "X", Norte `0`,
  Este `0`, Az `0°0'0"`.
- Crear. ✓ Redirige al editor del nuevo proceso (status `draft`, sin estaciones).
- Agregar 4 estaciones replicando el cuadrado perfecto. Guardar.
- ✓ El editor calcula en vivo y muestra cierre exacto. Status pasa a
  "Calculado".

### 14. Abierta sin control — caso de reconocimiento

- Volver al hub. Abrir **Reconocimiento E1-E4 (sin cierre)**.
- ✓ Los azimuts calculados son **150°, 145°30', 157°45'** (idénticos al
  documento marco teórico y a la hoja **Abierta sin control** del Excel).
- ✓ El panel muestra "Sin verificación de cierre" (amarillo).
- ✓ No hay selector de método de corrección (la abierta sin control no la
  admite).

### 15. Tab Configuración — puntos de referencia

- Volver al hub y entrar a la tab **Configuración**.
- ✓ La sección "Puntos de referencia" lista los 3 BMs precargados.
- Agregar un nuevo punto (`BM-03`, tipo BM, N=2000, E=2000, cota=2632.5).
- ✓ Aparece en la tabla. Editar y borrar también funciona.

### 16. RLS — aislamiento entre usuarios

- Cerrar sesión y registrar un segundo usuario nuevo (`otro@topofield.local`).
- Intentar navegar manualmente a la URL del proyecto **Lote catastral**
  (copiar el id del que se vio antes).
- ✓ El sistema devuelve 404 (RLS no deja ver proyectos ajenos).

## Resultado esperado

Si los 16 puntos pasan, el módulo poligonal cumple los criterios a-p del
PRD-de-fase 3 en su uso real. Cualquier discrepancia entre los números de la
app, la hoja Excel y el reporte HTML debe documentarse y corregirse antes de
pasar a Fase 4.
