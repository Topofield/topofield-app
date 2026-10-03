# Checklist manual end-to-end — Módulo poligonal

Recorrido paso a paso para verificar el módulo poligonal contra los datos
precargados por la seed. Cubre los criterios de aceptación del PRD-de-fase 3
de cabo a rabo, usando la UI tal como la usaría un usuario, y lo que sumaron
las fases 13 a 15 (dibujo, grados decimales, mínimos cuadrados y
georreferenciación), la 22 (el proceso en una pantalla) y la 23 (guardado
atómico).

## Preparación

1. Con Supabase local activo (`npx supabase start`), sobre una base recién
   reseteada, correr:
   ```
   npx supabase db reset && npm run seed
   ```
   El script lee `SUPABASE_SECRET_KEY` desde `.env.local` y **solo funciona
   justo después del reset**: sobre una base con datos no puede borrar el
   usuario —sus procesos cerrados son inmutables— y se detiene pidiendo el
   `db reset`. Si falla con `permission denied`, ver la advertencia del § 2 de
   `docs/tecnica/README.md`. Se imprimen credenciales y URL al final.
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
`profiles.demo_seeded_at` vacío): trae la V10 cerrada, la Vivero con mínimos
cuadrados, la Vivero en sistema local con los vértices **D1** y **D3** en su
catálogo, dos nivelaciones y una Torre Alameda cerrada.

> Sugerencia: tener abierto `docs/templates/poligonales.xlsx` en paralelo para
> contrastar números. Ojo: la hoja **Cerrada** encadena los azimuts como
> Az + 180° − α, la poligonal recorrida en el otro sentido, así que sus
> azimuts salen espejados respecto de la app (paso 4); errores, perímetro y
> precisión coinciden.

## Recorrido

### 1. Dashboard

- Tras iniciar sesión llegas a `/dashboard`.
- ✓ Aparecen 4 tarjetas de proyecto, de la más reciente a la más antigua:
  **Proyecto de ejemplo**, **Edificio en monitoreo**, **Red geodésica** y
  **Lote catastral**. Cada una dice cliente, ubicación, fecha y cuántos
  procesos tiene (Lote catastral: 15 procesos). Desde la Fase 8 la tarjeta no
  muestra el orden de precisión: es un dato por proceso, no del proyecto.
- ✓ El KPI "Proyectos activos" muestra 4.

### 2. Hub del proyecto

- Hacer clic en **Lote catastral**.
- ✓ La cabecera es compacta (Fase 22): nombre, badge **Activo**, la línea
  «Cliente Demo · Bogotá · MAGNA-SIRGAS · Origen Bogotá» y **+ Nuevo
  Proceso**. La descripción y el resto de los datos están en Configuración.
  Desde la Fase 8 no muestra equipo ni precisión: cada proceso poligonal
  declara los suyos (Leica TS06 Plus, 5″, 1.5 mm + 2 ppm en los procesos de
  este proyecto).
- ✓ Las tres tabs aparecen: **Procesos**, **Informes**, **Configuración**.

### 3. Tab Procesos

- En la tab **Procesos**:
- ✓ Chips de módulo: **Poligonales (13)** —el activo—, **Nivelaciones (2)** y
  **Control de Asentamientos (0)**. Los tres listados funcionan igual.
- ✓ Barra de filtros: el buscador «Buscar proceso…», el selector **Todos los
  tipos** y los chips de estado **Todos (13)**, **Borradores (0)**,
  **Calculados (10)**, **Cerrados (2)** y **Rechazados (1)**. No hay secciones
  «En progreso» / «Cerrados»: el estado es un filtro.
- ✓ La tabla tiene las columnas Nombre, Estado, Precisión, Cumple y Última
  actividad, ordenada por actividad reciente. Cada fila dice nombre y tipo
  («Poligonal · Cerrada»): p. ej. el Pentágono sale Calculado, 1:46, ✕; el
  Cuadrado perfecto, 1:∞, ✓; el Reconocimiento, «Sin verificación», —.
- ✓ Las filas abiertas ofrecen **Duplicar**, **Renombrar** y **Eliminar**;
  **Cuadrado oficial (cerrado)**, **Cuadrado marginal (rechazado)** y
  **Poligonal Famarena — Sede Vivero — sistema local** (cerrada), solo
  **Duplicar**.
- Escribir `vivero` en el buscador. ✓ Quedan las tres Vivero. Pulsar
  **Cerrados**. ✓ Solo la de sistema local, y aparece **Limpiar filtros**.
  Pulsarlo.
- Abrir **Renombrar** y **Eliminar** de una fila abierta y pulsar
  **Cancelar**. (No pulsar **Duplicar**: crea la copia al instante y cambia
  los conteos del resto del recorrido.)
- A 390 px, ✓ la tabla pasa a tarjetas, una por fila, con las mismas acciones.

### 4. Cálculo en vivo — Pentágono

- Abrir **Pentágono — Caso 1 del marco teórico**.
- ✓ La pantalla del proceso (Fase 22): migas Dashboard › Lote catastral ›
  Pentágono…, badge **Calculado**, «Poligonal cerrada · Tercer orden»,
  **Exportar a Excel** y **Ver informe** en la cabecera, las pestañas
  **Proceso** e **Informe**, y la barra fija al pie con **Guardar** y **Cerrar
  proceso**.
- Desplegar **Configuración** (viene plegada: el proceso ya está calculado).
  ✓ Arranque A, Norte 1000, Este 1000, azimut de partida 45° 0′ 0″, tipo de
  ángulo Interiores.
- ✓ La tabla de estaciones tiene 5 filas (A–E) con sus ángulos y distancias.
- ✓ Los azimuts calculados en vivo son 45°0′0″, 333°15′0″, 265°15′0″,
  173°0′0″ y 129°30′0″. (La hoja **Cerrada** del Excel, que encadena
  Az + 180° − α, da los espejados: 116°45′, 184°45′, 277° y 320°30′.)
- ✓ El panel de resultados muestra:
  - Suma medida 540° 0′ 0″, error angular 0.0″, tolerancia angular 33.5″.
  - Error de cierre 12.1733 m, perímetro 554.350 m, precisión relativa 1:46.
- ✓ El veredicto es rojo: «NO CUMPLE TERCER ORDEN», 1:46, requerido 1:5.000.
  Los ángulos suman 540° exactos, pero los lados del caso del marco teórico no
  cierran: queda un error lineal de 12 m.
- Pulsar **Cerrar proceso**. ✓ El diálogo avisa «La precisión relativa no
  alcanza la tolerancia; solo puede cerrarse como rechazado.» Pulsar
  **Cancelar**.

### 5. Métodos de corrección — Cuadrado con error 0.4 m

- Volver al hub y abrir **Cuadrado con error 0.4 m (fixture clave)**.
- ✓ El veredicto dice error de cierre 0.4000 m y precisión 1:1.001.
- ✓ Es rojo: «NO CUMPLE TERCER ORDEN» (1:1.001 < 1:5.000).
- En **Resultados**, cambiar el selector **Método de corrección** a
  **Tránsito** y luego a **Crandall**.
- ✓ La tabla "Coordenadas corregidas" muestra:
  - **Bowditch**: N de B = **100.300**.
  - **Tránsito**: N de B = **100.200**.
  - **Crandall**: N de B = **100.200**.
- ✓ Los tres números coinciden con el ejemplo trabajado del reporte HTML
  (`docs/math/poligonales.html` § 5.4) y con la hoja **Cerrada** del Excel
  cargando este cuadrado.
- Volver a **Bowditch (brújula)**. ✓ La barra de acciones dice «Cambios sin
  guardar».

### 6. Reasignar coordenadas

- En el mismo proceso, clic en **Asignar coordenadas reales** (junto al
  dibujo).
- En el diálogo, cambiar **Norte de partida** a `5000` y **Este de partida** a
  `7000`. **Aplicar**.
- ✓ Las coordenadas de todas las estaciones se actualizan (la N de B pasa a
  `5100.300`, etc.) manteniendo los azimuts y deltas (en vivo).
- Volver al diálogo y restaurar los valores originales (0, 0). **Aplicar**.

### 7. Guardar

- ✓ La barra sigue diciendo «Cambios sin guardar».
- Pulsar la miga **Lote catastral**. ✓ Diálogo «Tienes cambios sin guardar»
  con **Seguir editando** y **Salir sin guardar**. Pulsar **Seguir editando**.
- Clic en **Guardar**.
- ✓ La barra dice «Proceso guardado.» y el badge sigue en "Calculado".

> **Guardado atómico (Fase 23).** Guardar escribe la cabecera, las estaciones
> y sus lecturas en una sola transacción (`save_polygonal_process`): si algo
> falla, no queda nada a medias. No hay nada que pulsar: basta con que el
> guardado de este paso funcione. El caso de fallo lo cubren las pruebas
> pgTAP (`npx supabase test db`, `supabase/tests/guardados_atomicos.test.sql`).

### 8. Cierre — flujo normal

- Volver al hub y abrir **Poligonal V10 — cartera TT4 — crandall** (cumple:
  1:7.045).
- Clic en **Cerrar proceso**.
- ✓ El modal muestra el resumen: tipo de poligonal Cerrada, perímetro
  115.712 m, error de cierre 0.0164 m, precisión relativa 1:7.045 y fecha y
  hora.
- Marcar la casilla "Confirmo que los datos son correctos."
- Clic **Confirmar cierre**.
- ✓ El proceso queda con badge "Cerrado" y el editor pasa a solo lectura
  (mensaje «Este proceso está cerrado; los datos son de solo lectura, salvo su
  posición, que se puede georreferenciar.»). La barra de acciones desaparece.

### 9. Cierre como rechazado

- Abrir **Cuadrado con error 0.4 m** (el de la sección 5).
- Clic en **Cerrar proceso**.
- ✓ El modal advierte: "La precisión relativa no alcanza la tolerancia; solo
  puede cerrarse como rechazado."
- ✓ El botón confirma **Cerrar como rechazado** (variante danger).
- Marcar la casilla y confirmar.
- ✓ El badge pasa a "Rechazado" y el aviso dice «Este proceso fue rechazado;
  los datos son de solo lectura, salvo su posición, que se puede
  georreferenciar.»

### 10. Inmutabilidad de procesos cerrados

- Abrir **Cuadrado oficial (cerrado)**.
- ✓ Mensaje «Este proceso está cerrado; los datos son de solo lectura, salvo
  su posición, que se puede georreferenciar.»
- ✓ Los campos de configuración, la tabla de estaciones y el selector de
  método están deshabilitados; no hay **Eliminar** por estación ni **+ Agregar
  estación**.
- ✓ No aparecen la barra con **Guardar** y **Cerrar proceso** ni **Asignar
  coordenadas reales**. Solo queda **Georreferenciar**.

### 11. Validación de captura — distancia fuera de rango

- Volver al hub y abrir **Cuadrado perfecto 100×4**.
- En la primera estación cambiar la distancia a `1500`.
- ✓ La celda se marca con borde rojo y aparece el mensaje "La distancia no
  puede superar los 1000 m."
- ✓ El botón **Guardar** se deshabilita y la barra dice "Corrige las celdas
  con error para poder guardar."
- Restaurar `100` para volver al estado válido.

### 12. Validación de captura — lectura de ángulo

- En la primera estación, pulsar el ángulo (`90°0′0″ · 1/1 ▾`) para desplegar
  sus lecturas.
- Cambiar los segundos de la lectura a `6x`.
- ✓ Borde rojo y mensaje «No es un número.»; la celda pasa a «Sin lecturas»
  con el aviso «Faltan lecturas: se exigen 1 y hay 0.», y **Guardar** queda
  bloqueado con «Corrige las celdas con error para poder guardar.»
- Cambiarlos a `65`. ✓ No se marca error: el ángulo de la estación es el
  promedio de sus lecturas, que se normaliza, y la celda muestra `90°1′5″`.
- Restaurar a `0`. ✓ Vuelve a `90°0′0″`. Al salir, **Salir sin guardar**.

### 13. Crear un proceso nuevo

- En la tab Procesos del hub, clic **+ Nuevo Proceso**.
- ✓ Diálogo «Nuevo proceso» con tres opciones —**Poligonal**, **Nivelación** y
  **Control de Asentamientos**—, todas habilitadas (los tres módulos están
  implementados).
- Clic **Poligonal**. Llega a `/projects/[id]/polygonal/new` («Nuevo proceso
  poligonal»).
- Llenar: Nombre del proceso "Prueba manual", Tipo de poligonal "Cerrada",
  Tipo de ángulo "Interiores" (no viene preseleccionado), Lecturas mínimas por
  ángulo `1`, Código "A", Norte `0`, Este `0` (vienen en 1000), Azimut de
  partida `0° 0′ 0″`. El orden viene en tercer orden; el equipo es opcional.
- **Crear proceso**. ✓ Redirige al editor del nuevo proceso (badge
  «Borrador», sin estaciones, con la Configuración desplegada).
- Agregar 4 estaciones replicando el cuadrado perfecto (A, B, C, D; 90° 0′ 0″
  en la primera lectura; 100 m). Guardar.
- ✓ El editor calcula en vivo y muestra cierre exacto («CUMPLE TERCER ORDEN»,
  1:∞). Status pasa a "Calculado".

### 14. Abierta sin control — caso de reconocimiento

- Volver al hub. Abrir **Reconocimiento E1-E4 (sin cierre)**.
- ✓ Abre en **Grados decimales** (lecturas 175.500000° y 192.250000°) y los
  azimuts calculados son **150°, 145°30', 157°45'** (idénticos al documento
  marco teórico y a la hoja **Abierta sin control** del Excel). E1 y E4, sin
  ángulo, avisan «Faltan lecturas: se exigen 1 y hay 0.»: es un aviso, no
  bloquea.
- ✓ El veredicto dice «SIN VERIFICACIÓN DE CIERRE» en gris, ni verde ni rojo.
- ✓ No hay selector de método de corrección (la abierta sin control no la
  admite) y el dibujo dice «Abierta sin control: no se compensa.»

### 15. Tab Configuración — puntos de referencia

- Volver al hub y entrar a la tab **Configuración**.
- ✓ La sección "Puntos de referencia" lista los 5 puntos precargados:
  **BM-01** y **BM-02** (BM), **GPS-1** (GPS), y **TT4** y **14_IS1**
  (Control, sin cota: los amarres de las carteras reales).
- **Agregar punto**: el diálogo «Nuevo punto de referencia» pide código, tipo
  (BM, Control, GPS o Detalle), norte, este, cota y descripción. Crear
  `BM-03`, tipo BM, N=2000, E=2000, cota=2632.5, y **Guardar**.
- ✓ Aparece en la tabla. Editar y borrar también funciona.
- ✓ En **Zona de peligro**, **Eliminar proyecto** no se ofrece: «Tiene 4
  registros cerrados (procesos, lugares o visitas)…» con los datos recién
  sembrados, 6 tras los pasos 8 y 9.

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
- En la TT4, pulsar **Acercar** dos veces, arrastrar el dibujo, usar las
  **flechas** y pulsar **Restablecer**. ✓ Vuelve al encuadre completo. Todos
  los botones responden al teclado (Tab y Enter).
- Vaciar el **Norte** del arranque en Configuración. ✓ El dibujo dice
  «Todavía no se puede dibujar». Restaurarlo.
- Cambiar la distancia de la primera estación. ✓ El dibujo se mueve en vivo.
  Restaurarla.
- Con el navegador en ancho de teléfono (390 px), ✓ los rótulos del dibujo se
  leen: no se encogen con la pantalla.
- Abrir la pestaña **Informe** de la TT4, o el informe **Informe de cierre —
  Poligonal** de la tab Informes del proyecto, e imprimir. ✓ Cada poligonal
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
- Abrir un proceso **cerrado** (p. ej. **Cuadrado oficial**) y pulsar
  **Grados decimales**. ✓ Cambia la vista, sin aviso y sin guardar nada: al
  recargar vuelve a DMS.

### 15 quater. Mínimos cuadrados (Fase 14)

- Abrir **Poligonal Famarena — Sede Vivero — least_squares**. ✓ El método es
  **Mínimos cuadrados** y los pesos son los de la hoja: 2, 0.011 y 2.
- ✓ La tabla **Correcciones del ajuste** da, en segundos, D1 +0.757, D2
  +0.771, D3 +0.876, D4 +0.855 y Famarena_5 +0.741; y en milímetros −3.93,
  −2.94, +1.86, +3.36 y −0.92. La orientación (primera fila) no tiene
  corrección angular.
- ✓ Coordenadas: D1 100117.464 / 101515.631, D3 100182.240 / 101581.781.
- ✓ σ₀ = **0.698** y «Los pesos supuestos describen bien las observaciones».
  Debajo: «Con r = 3 condiciones, la prueba χ² al 95 % espera σ₀ entre 0.27 y
  1.77» (Fase 32).
- ✓ El veredicto (error angular −4.0″, error lineal 0.0100, 1:24.717) es el
  mismo que en la Vivero con Bowditch.
- Cambiar σ angular a **4**. ✓ Las correcciones cambian en vivo y se cargan
  más en los ángulos (D3 +1.099″).
- Vaciar σ angular. ✓ «Faltan los pesos del ajuste», coordenadas en «—» y
  **Guardar** deshabilitado con el motivo en la barra. Restaurar 2.
- ✓ El dibujo sigue mostrando la ajustada y la sin compensar.
- Abrir **Enlace P1-P3 con deflexión** y elegir Mínimos cuadrados. ✓ Los tres
  campos salen **vacíos**. Con 2 / 0.011 / 2 aparece la tabla de correcciones
  (P2 +0.002″) y σ₀ 0.004: «Los σ supuestos son pesimistas: se midió mejor de
  lo declarado». Guardar y recargar: ✓ los pesos se conservan.
- Con σ angular **0**: ✓ el aviso explica que debe estar entre 0.01″ y
  9999.99″. Cambiar a Bowditch: ✓ se puede guardar (el peso inválido se
  descarta). Volver a Mínimos cuadrados con 2.
- Abrir **Reconocimiento E1-E4**. ✓ No hay selector de método.
- **Exportar a Excel** la Vivero. ✓ «Cálculos» trae «Corrección angular (″)» y
  «Distancia ajustada (m)»; «Resumen», la sección «Ajuste por mínimos
  cuadrados» con los pesos y σ₀ 0.698.
- En la pestaña **Informe** de la Vivero con el método, o en un informe
  consolidado que la incluya, ✓ aparecen «Pesos del ajuste» y σ₀.

### 15 quinquies. Georreferenciación (Fase 15)

- Abrir **Poligonal Famarena — Sede Vivero — sistema local** (cerrada). ✓ El
  aviso de solo lectura dice que la posición se puede georreferenciar, y el
  botón **Georreferenciar** está activo.
- Pulsarlo. Punto A: **D1**, Norte 100117.462, Este 101515.6333. Punto B:
  **D3**, Norte 100182.239, Este 101581.7814. (El catálogo de Lote catastral
  no tiene D1 ni D3: se teclean.)
- ✓ Vista previa: rotación **35° 00′ 07.8″**, traslación N 100467.9285 · E
  99279.5759, factor de escala 1.000000, residuos 0.0 mm. La tabla lleva
  Famarena_5 de 1000.000 / 2000.000 a 100139.844 / 101491.444.
- Cambiar el Norte de D3 a 100183.239. ✓ Aviso de factor de escala (1.007587).
  Restaurarlo.
- Pulsar **Reescribir coordenadas**. ✓ Sobre el dibujo: «Georreferenciado el
  <fecha> con D1 y D3 (rotación 35° 00′ 07.8″, factor de escala 1.000000)». El
  veredicto sigue en 1:24.717 y 0.0100 m. D3 queda en 100182.239 / 101581.781.
- Georreferenciar otra vez con D1 y **D4** (100193.8973, 101558.713). ✓ La
  línea muestra la última: D1 y D4, rotación 0° 00′ 00.0″.
- En el **Proyecto de ejemplo**, abrir **Poligonal Famarena — Sede Vivero —
  sistema local** (calculada) y pulsar **Georreferenciar**. ✓ **Tomar del
  catálogo** ofrece solo los puntos con coordenadas: 14_IS1, BM-1, BM-2, D1,
  D3 y TT4 (C10 no, que solo tiene cota). Punto A: estación **D1** y, del
  catálogo, **D1** (✓ llena 100117.462 / 101515.6333); punto B: **D3** y
  **D3** (100182.239 / 101581.7814).
- ✓ La misma vista previa: rotación 35° 00′ 07.8″, factor 1.000000, residuos
  D1 0.0 mm · D3 0.0 mm, sin aviso de amarre. El botón dice **Georreferenciar**
  (el proceso no está cerrado). Confirmar. ✓ «Georreferenciado el <fecha> con
  D1 y D3…» sobre el dibujo, y Famarena_5 en 100139.844 / 101491.444.
- Abrir **Poligonal Famarena — Sede Vivero — bowditch** (calculada, amarre del
  catálogo 14_IS1) y georreferenciar. ✓ Aviso de que el amarre pasa a manual.
  Tras confirmar, **Guardar** y recargar: ✓ las coordenadas no vuelven atrás.
- En la **TT4 con Tránsito**, abrir el diálogo con dos puntos. ✓ Aviso de
  Tránsito. Cancelar.
- Con cambios sin guardar en un proceso abierto, ✓ el botón está deshabilitado
  y sobre el dibujo dice «Guarde los cambios antes de georreferenciar.»
- Incluir la Vivero local en un informe e imprimirlo. ✓ Nota «Coordenadas
  georreferenciadas el <fecha> con D1 y …». Exportar a Excel: ✓ «Resumen» trae
  la sección «Georreferenciación».
- A 390 px, ✓ la cabecera del editor envuelve y la página no desborda a lo
  ancho.

La georreferenciación también se escribe en una sola transacción desde la
Fase 23 (`georeference_polygonal`): cabecera y estaciones juntas.

**Contra la base** (`psql -h 127.0.0.1 -p 55322 -U postgres`, sobre un proceso
poligonal cerrado `<id>`):

```sql
update polygonal_stations set north = north where process_id = '<id>';          -- ✓ funciona
update polygonal_processes set start_north = start_north + 1 where id = '<id>'; -- ✓ funciona
update polygonal_processes set linear_error = linear_error + 1 where id = '<id>'; -- ✓ falla, 23001
update polygonal_stations set angle_deg = 1 where process_id = '<id>';          -- ✓ falla
update polygonal_processes set status = 'calculated' where id = '<id>';         -- ✓ falla
delete from polygonal_stations where process_id = '<id>';                       -- ✓ falla
```

Una nivelación cerrada sigue rechazando cualquier `UPDATE`.

### 15 sexies. Pestaña Informe (Fase 22)

- Abrir el **Pentágono** (calculado) y pulsar **Ver informe**. ✓ Se abre la
  pestaña **Informe** y la acción de la cabecera pasa a ser **Imprimir o
  guardar como PDF**.
- ✓ El informe lleva la marca «Borrador — el informe se emite al cerrar el
  proceso», los datos y resultados con el equipo, la tabla de coordenadas, el
  dibujo y el pie «Borrador generado desde TopoField el <fecha>. El proceso no
  está cerrado: sus datos todavía pueden cambiar.» Debajo, fuera de la
  impresión: «Este proceso no está en ningún informe consolidado.»
- Abrir la pestaña **Informe** de **Cuadrado oficial (cerrado)**. ✓ Sin marca
  de borrador, con «Fecha de cierre» y el **Registro de cierre** (Seed
  TopoField); debajo, «Informe de cierre — Poligonal · <fecha>» y el botón
  **Generar un informe consolidado con este proceso**.
- La V10 crandall cerrada en el paso 8 ✓ ya no lleva la marca de borrador.
- Con cambios sin guardar en **Proceso**, pulsar la pestaña **Informe**. ✓
  Pregunta «Tienes cambios sin guardar».

### 16. RLS — aislamiento entre usuarios

- Copiar la URL del proyecto **Lote catastral** y **Cerrar sesión**.
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

Si los 16 puntos pasan, el módulo poligonal cumple los criterios a-p del
PRD-de-fase 3 en su uso real. Los pasos 15 bis y 15 ter cubren el PRD-de-fase
13: el dibujo de la poligonal y la captura en grados decimales; el 15 quater,
el 14 (mínimos cuadrados), y el 15 quinquies, el 15 (georreferenciación,
también desde el catálogo del proyecto de ejemplo). Los pasos 3, 4, 7 y 15
sexies cubren el PRD-de-fase 22: el listado del hub, la pantalla del proceso
con su barra de acciones, la guarda de cambios sin guardar y la pestaña
Informe; la nota del paso 7, el guardado atómico de la Fase 23. Cualquier
discrepancia entre los números de la app, la hoja Excel y el reporte HTML
debe documentarse y corregirse antes de pasar a Fase 4.
