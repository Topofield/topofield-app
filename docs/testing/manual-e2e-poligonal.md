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
- ✓ Aparecen 3 tarjetas de proyecto: **Lote catastral**, **Red geodésica** y
  **Edificio en monitoreo**. Desde la Fase 8 la tarjeta no muestra el orden de
  precisión: es un dato por proceso, no del proyecto.
- ✓ El KPI "Proyectos activos" muestra 3.

### 2. Hub del proyecto

- Hacer clic en **Lote catastral**.
- ✓ El hub muestra el header con ubicación, coordenadas, fecha de creación,
  datum y proyección del proyecto. Desde la Fase 8 ya no muestra equipo ni
  precisión: cada proceso poligonal declara los suyos (Leica TS06 Plus,
  5″, 1.5 mm + 2 ppm en los procesos de este proyecto).
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
- ✓ Modal con tres opciones —**Poligonal**, **Nivelación** y
  **Asentamiento**—, todas habilitadas (los tres módulos están implementados).
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

### 15 bis. Dibujo de la poligonal (Fase 13)

- Abrir **Poligonal V10 — cartera TT4 — bowditch**.
- ✓ La tarjeta **Dibujo de la poligonal** muestra los vértices V10, D1…D5
  rotulados, la grilla con coordenadas sin separador de miles (`N 100140`,
  `E 101440`), la flecha de norte, la barra de escala y el amarre **TT4**
  con su línea de orientación.
- ✓ La leyenda dice **Sin compensar (desplazamientos ×100)** y el trazo
  discontinuo no cierra: queda un hueco junto a V10.
- Abrir el **Pentágono — Caso 1**. ✓ Factor **×1**: su error de 12 m ya se ve.
- Abrir **Reconocimiento E1-E4**. ✓ Sin trazo discontinuo: «Abierta sin
  control: no se compensa».
- En la TT4, pulsar **Acercar** dos veces, arrastrar el dibujo y pulsar
  **Restablecer**. ✓ Vuelve al encuadre completo. Los tres botones responden
  al teclado (Tab y Enter).
- Cambiar la distancia de la primera estación. ✓ El dibujo se mueve en vivo.
  Restaurarla.
- Con el navegador en ancho de teléfono (390 px), ✓ los rótulos del dibujo se
  leen: no se encogen con la pantalla.
- Abrir el **informe de poligonal** del proyecto e imprimir. ✓ Cada poligonal
  lleva su dibujo bajo la tabla de coordenadas.

### 15 ter. Ángulos en grados decimales (Fase 13, P1)

- En la TT4, desplegar las lecturas de una estación y pulsar **Grados
  decimales**. ✓ Todos los ángulos pasan a un solo campo con seis decimales
  (`124.495000°`). La columna **Azimut** sigue en DMS.
- Volver a **DMS (° ′ ″)**. ✓ Todos los valores son idénticos a los de
  antes: cambiar de formato no altera ninguno.
- En decimal, teclear `124.4950001` en una lectura. ✓ Aparece «Se guarda como
  124°29′42″ (a la décima de segundo)». Restaurar el valor.
- Recargar la página. ✓ El conmutador sigue en **Grados decimales**: el
  formato se recuerda por proceso. Volver a DMS.
- Abrir **Reconocimiento E1-E4**. ✓ Abre ya en **Grados decimales**.
- Abrir un proceso **cerrado** y pulsar **Grados decimales**. ✓ Cambia la
  vista y avisa «El proceso está cerrado: el formato solo cambia la vista y no
  se guarda». Al recargar vuelve a DMS.

### 16. RLS — aislamiento entre usuarios

- Cerrar sesión y registrar un segundo usuario nuevo (`otro@topofield.local`).
- Intentar navegar manualmente a la URL del proyecto **Lote catastral**
  (copiar el id del que se vio antes).
- ✓ El sistema devuelve 404 (RLS no deja ver proyectos ajenos).

## Resultado esperado

Si los 16 puntos pasan, el módulo poligonal cumple los criterios a-p del
PRD-de-fase 3 en su uso real. Los pasos 15 bis y 15 ter cubren el PRD-de-fase
13: el dibujo de la poligonal y la captura en grados decimales. Cualquier discrepancia entre los números de la
app, la hoja Excel y el reporte HTML debe documentarse y corregirse antes de
pasar a Fase 4.
