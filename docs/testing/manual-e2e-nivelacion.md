# Checklist manual end-to-end — Módulo nivelación

Recorrido paso a paso para verificar el módulo de nivelación contra los datos
precargados por la seed. Cubre los criterios de aceptación del PRD-de-fase 4
usando la UI tal como la usaría un usuario.

## Preparación

1. Con Supabase local activo (`npx supabase start`), correr:
   ```
   npm run seed
   ```
   El script lee `SUPABASE_SECRET_KEY` desde `.env.local`.
2. En otra terminal, levantar el dev server:
   ```
   npm run dev
   ```
3. Abrir `http://localhost:3000/sign-in` e iniciar sesión:
   - Email: `seed@topofield.local`
   - Password: `seed1234`

Los procesos de nivelación de la seed viven en el proyecto **Lote catastral**.

## Recorrido

### 1. Hub del proyecto

- Desde el dashboard, abrir **Lote catastral**.
- En la tab **Procesos**, la sección "Cerrados" incluye **Circuito BM-2 (cerrado
  oficialmente)**; la de "En progreso" incluye **Circuito BM-1 (cerrado, tercer
  orden)** en estado calculado.
- ✓ Cada tarjeta de nivelación muestra el badge de tipo (Nivelación) y su estado.

### 2. Editor — circuito cerrado calculado

- Abrir **Circuito BM-1 (cerrado, tercer orden)**.
- ✓ La configuración muestra tipo **Cerrada**, BM de salida **BM-1**, cota
  inicial **100.0000** y distancia total **0.9 km**.
- ✓ La libreta de ida tiene 4 filas: `BM-1`, `PC-1`, `PC-2`, `BM-1`, con sus
  lecturas atrás (L.At) y adelante (L.Ad).

### 3. Cálculo en vivo — cotas de la libreta

- ✓ Las cotas calculadas por fila son:
  - `BM-1` (salida): **100.0000**, altura de instrumento **101.500**.
  - `PC-1`: **100.3000**, altura de instrumento **102.300**.
  - `PC-2`: **99.8000**, altura de instrumento **100.800**.
  - `BM-1` (llegada): **99.9920** calculada, **100.0000** corregida.
- ✓ La comprobación aritmética cuadra: ΣL.At (4.500) − ΣL.Ad (4.508) = −0.008 m,
  igual al desnivel de cierre.

### 4. Veredicto de cierre

- ✓ El panel de resultados muestra:
  - Error de cierre = **−8.0 mm**.
  - Tolerancia = **11.4 mm** (K = 12 · √0.9 km, tercer orden).
  - Cumple: **sí** (|−8.0| < 11.4).
- ✓ El semáforo del panel es verde.
- ✓ La cota corregida del BM de llegada cierra exacto en **100.0000** (la
  corrección proporcional a la distancia reparte los −8 mm y el punto final,
  con distancia acumulada = distancia total, recibe la corrección completa).

### 5. Método de corrección

- ✓ El método es **proporcional a la distancia** (único método de nivelación);
  no hay selector de métodos alternativos como en poligonal.

### 6. Inmutabilidad — proceso cerrado

- Volver al hub y abrir **Circuito BM-2 (cerrado oficialmente)**.
- ✓ Mensaje "Este proceso está cerrado; los datos son de solo lectura."
- ✓ La configuración y la libreta están deshabilitadas.
- ✓ No aparecen los botones **Guardar** ni **Cerrar proceso**.
- ✓ Sus números coinciden con los de BM-1 (mismo circuito): error −8.0 mm,
  cumple.

### 7. Crear una nivelación nueva

- En la tab **Procesos**, clic **+ Nuevo Proceso** → **Nivelación**.
- Llega a `/projects/[id]/leveling/new`.
- Llenar: Nombre "Prueba nivelación", Tipo **Cerrada**, BM de salida "BM-9",
  cota `100`.
- Crear. ✓ Redirige al editor del nuevo proceso (status `draft`, libreta vacía).
- Replicar la libreta de BM-1 (BM-1/PC-1/PC-2/BM-1 con sus lecturas) y la
  distancia total 0.9 km. Guardar.
- ✓ El editor calcula en vivo el mismo cierre (−8.0 mm, cumple) y el status pasa
  a **Calculado**.

### 8. Validación de captura

- En el nuevo proceso, dejar una fila de punto de cambio sin lectura adelante.
- ✓ La celda se marca y aparece el aviso correspondiente; el botón **Guardar**
  se deshabilita mientras haya errores de captura.
- Restaurar la lectura para volver al estado válido.

### 9. Cierre — flujo normal

- En la nivelación de prueba (calculada y conforme), clic **Cerrar proceso**.
- ✓ El modal muestra el resumen (tipo, error de cierre, tolerancia, cumple,
  fecha).
- Marcar "Confirmo que los datos son correctos" y **Confirmar cierre**.
- ✓ El badge pasa a **Cerrado** y el editor queda en solo lectura.

### 10. Ida y vuelta (opcional)

- Al crear una nivelación, activar el recorrido de **vuelta**.
- ✓ La libreta muestra dos pestañas (Ida / Vuelta), mediciones independientes.
- ✓ El panel añade la discrepancia ida−vuelta y su tolerancia, además del error
  de cierre.

## Resultado esperado

Si los puntos pasan, el módulo de nivelación cumple los criterios del
PRD-de-fase 4 en su uso real: cálculo de cotas por libreta, corrección
proporcional a la distancia, veredicto de cierre contra tolerancia y cierre
irreversible. Cualquier discrepancia con los números anteriores (verificados a
mano en el brief de la fase) debe documentarse y corregirse.
