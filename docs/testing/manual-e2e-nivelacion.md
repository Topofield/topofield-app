# Checklist manual end-to-end — Módulo nivelación

Recorrido paso a paso para verificar el módulo de nivelación contra los datos
precargados por la seed y por el proyecto de ejemplo. Cubre los criterios de
aceptación del PRD-de-fase 4 y de las fases que lo ampliaron —distancias por
visual, importación de archivos, puntos homólogos y el veredicto de la
nivelación abierta con vuelta (Fase 23)— usando la UI tal como la usaría un
usuario.

## Preparación

1. Con Supabase local activo (`npx supabase start`), recrear la base y
   sembrarla:
   ```
   npx supabase db reset
   npm run seed
   ```
   El seed solo funciona sobre una base recién reseteada: borra y recrea el
   usuario, y en una base con procesos cerrados ese borrado falla —lo cerrado
   es inmutable— y el script se detiene pidiendo el `db reset`. Lee
   `SUPABASE_SECRET_KEY` desde `.env.local`.
2. En otra terminal, levantar el dev server:
   ```
   npm run dev
   ```
3. Abrir `http://localhost:3000/sign-in` e iniciar sesión con **Entrar**:
   - Email: `topofieldsarf@gmail.com`
   - Password: `seed1234`
4. ✓ El dashboard muestra 4 proyectos: los tres de la seed (**Lote
   catastral**, **Red geodésica**, **Edificio en monitoreo**) y el **Proyecto
   de ejemplo**, que la aplicación crea con carteras de campo reales la
   primera vez que se entra.

Las nivelaciones de la seed viven en **Lote catastral** (Circuito BM-1 y
Circuito BM-2); las de carteras reales, en **Proyecto de ejemplo** (El Verjón
— ida y vuelta y Tramo 2 — crudo del nivel digital Leica).

> Varios pasos escriben en la base: crear, guardar, cerrar. **Cerrar es
> irreversible.** Para volver al estado inicial, repetir la preparación
> (`db reset`, `npm run seed` y entrar de nuevo).

## Recorrido

### 1. Hub del proyecto

- Desde el dashboard, abrir **Lote catastral** y, en la tab **Procesos**,
  pulsar el chip **Nivelaciones (2)**.
- ✓ Barra de filtros: buscador «Buscar proceso…», selector de tipo (Todos los
  tipos / Cerrada / De enlace / Abierta sin control) y chips de estado
  **Todos (2) · Borradores (0) · Calculados (1) · Cerrados (1) · Rechazados
  (0)**.
- ✓ La tabla tiene las columnas Nombre, Estado, Cierre, Cumple y Última
  actividad, con dos filas:
  - **Circuito BM-2 (cerrado oficialmente)** — «Nivelación · Cerrada»,
    **Cerrado**, −8.0 mm, ✓. Solo ofrece **Duplicar**: lo cerrado no se
    renombra ni se elimina.
  - **Circuito BM-1 (cerrado, tercer orden)** — «Nivelación · Cerrada»,
    **Calculado**, −8.0 mm, ✓, con **Duplicar**, **Renombrar** y
    **Eliminar**.
- ✓ En un teléfono la tabla se convierte en tarjetas, con los mismos campos y
  acciones.

### 2. La pantalla del proceso — circuito cerrado calculado

- Abrir **Circuito BM-1 (cerrado, tercer orden)**.
- ✓ Cabecera: nombre, badge **Calculado**, «Nivelación cerrada · Tercer
  orden» y los botones **Exportar a Excel** y **Ver informe**; debajo, las
  pestañas **Proceso · Informe**. Las migas vuelven al listado de
  nivelaciones.
- ✓ Arriba, el veredicto: «Cumple tercer orden», **−8.0 mm**, «tolerancia
  ±11.4 mm», «Error de cierre sobre 0.900 km».
- ✓ **Configuración** aparece plegada (el proceso ya está calculado).
  Desplegarla: tipo **Cerrada**, orden **Tercer orden**, nivel Leica NA2
  (s/n LNA2-2025-003, calibrado 2025-11-10), tipo de nivel **Automático**,
  0.7 mm/km. **BM de partida**: «Otro (entrada libre)» —BM-1 no está en el
  catálogo del proyecto—, código **BM-1**, cota **100**.
- ✓ **Distancia total del recorrido (km)**: **0.900**, en solo lectura, con la
  nota «Se calcula sumando las distancias por visual de la libreta». No se
  teclea.
- ✓ La **Libreta — Ida** tiene 4 filas: `BM-1` (BM), `PC-1` y `PC-2` (Punto
  de cambio) y `BM-1` (BM), con sus V+ y V− y **150 m en cada visual** (Dist
  V+ / Dist V−).
- Marcar «Capturar los tres hilos». ✓ Aparecen HS/HI de cada visual (por
  ejemplo, V+ de BM-1: 2.25 / 0.75): (HS − HI) × 100 = 150 m.

### 3. Cálculo en vivo — cotas de la libreta

- ✓ Por fila (AI solo en las filas con V+):

  | Punto | AI | Dist acum (km) | Cota | Cota corregida |
  |---|---|---|---|---|
  | `BM-1` (partida) | 101.5000 | 0.000 | 100.0000 | 100.0000 |
  | `PC-1` | 102.3000 | 0.300 | 100.3000 | 100.3027 |
  | `PC-2` | 100.8000 | 0.600 | 99.8000 | 99.8053 |
  | `BM-1` (llegada) | — | 0.900 | 99.9920 | 100.0000 |

- ✓ **Comprobación aritmética**: ΣV+ 4.5000 − ΣV− 4.5080 = −0.0080, igual al
  desnivel total (ida) −0.0080.

### 4. Veredicto de cierre

- ✓ La tarjeta **Cierre** muestra:
  - Error de cierre = **−8.0 mm**.
  - Tolerancia (K·√D) = **11.4 mm** (12 · √0.9 km, tercer orden).
  - Cumplimiento: **Cumple** (|−8.0| < 11.4).
- ✓ **Cotas corregidas**: correcciones 0.0 / 2.7 / 5.3 / 8.0 mm. El BM de
  partida no se corrige y el BM de llegada cierra exacto en **100.0000**: con
  distancia acumulada igual a la total, recibe la corrección completa.

### 5. Método de corrección

- ✓ El método es **proporcional a la distancia** (único método de
  nivelación); no hay selector de métodos alternativos como en poligonal.

### 6. Inmutabilidad — proceso cerrado

- Volver al listado y abrir **Circuito BM-2 (cerrado oficialmente)**.
- ✓ Mensaje «Este proceso está cerrado; los datos son de solo lectura.»
- ✓ La configuración y la libreta están deshabilitadas; no hay barra de
  acciones (**Guardar**, **Cerrar proceso**), ni **Importar desde archivo**,
  ni **+ Agregar lectura**. Siguen **Exportar a Excel** y **Ver informe**.
- ✓ Sus números coinciden con los de BM-1 (mismo circuito): −8.0 mm,
  tolerancia ±11.4 mm, cumple.
- ✓ Su pestaña **Informe** no lleva marca de borrador y lista **Informe de
  cierre — Nivelación** entre los informes consolidados que lo incluyen.

### 7. Crear una nivelación nueva

- En el hub, **+ Nuevo Proceso** → **Nivelación**. Llega a
  `/projects/[id]/leveling/new` («Nuevo proceso de nivelación»).
- Llenar: nombre «Prueba nivelación», tipo **Cerrada**, orden **Tercer
  orden**, tipo de nivel **Automático**. En **BM de partida**, elegir «Otro
  (entrada libre)», código `BM-9`, cota `100`. (El selector ofrece también
  los BM del catálogo, BM-01 y BM-02, que rellenan código y cota solos.)
- **Crear proceso**. ✓ Abre la pantalla del nuevo proceso: badge
  **Borrador**, configuración desplegada, veredicto «Datos incompletos» y la
  libreta vacía («Aún no hay lecturas. Agrega la primera para empezar.»).
  (Si se deja sin tipo de nivel, la libreta no se habilita y pide elegirlo.)
- Con **+ Agregar lectura**, replicar la libreta de BM-1 con BM-9 como punto
  de partida y de llegada: BM-9 / PC-1 / PC-2 / BM-9, las mismas lecturas y
  150 m en cada visual. ✓ La primera fila no admite V− y la última (BM) no
  admite V+.
- ✓ La distancia total pasa sola a **0.900** y el veredicto, en vivo, a −8.0
  mm, cumple.
- **Guardar**. ✓ «Proceso guardado.» y el estado pasa a **Calculado**.

### 8. Validación de captura

- En la nivelación de prueba, borrar la **Dist V− (m)** de PC-1.
  ✓ «Falta la distancia de la V−: sin ella el recorrido no acumula.» bajo la
  celda; la barra dice «Corrige las celdas con error para poder guardar.» y
  **Guardar** queda deshabilitado. Desde la Fase 9 la distancia es
  obligatoria en los BM y en los puntos de cambio; los intermedios no la
  llevan.
- Restaurarla y teclear `1,2x` en la V− de PC-1. ✓ «No es un número.» y
  **Guardar** deshabilitado (`1,2` con coma decimal sí vale).
- Dejar vacía la V− de PC-1. ✓ La celda no se marca, pero la **comprobación
  aritmética** no cuadra («La comprobación aritmética no cuadra»), el
  veredicto pasa a «No cumple tercer orden» (−308.0 mm) y la tarjeta Cierre
  avisa de que no cuadra, lo que bloquea el cierre. **Guardar** sigue
  habilitado: no guardar.
- Restaurar `1.2` para volver al estado válido.

### 9. Cierre — flujo normal

- En la nivelación de prueba (calculada, guardada y conforme), clic
  **Cerrar proceso**.
- ✓ El diálogo resume tipo de nivelación, error de cierre, tolerancia y fecha
  y hora. Con cambios sin guardar diría «Tienes cambios sin guardar.
  Guárdalos antes de cerrar el proceso.»
- Marcar «Confirmo que los datos son correctos.» y **Confirmar cierre**.
- ✓ El badge pasa a **Cerrado**, la pantalla queda en solo lectura y
  desaparece la barra de acciones.

### 10. Ida y vuelta por los mismos puntos — El Verjón

- Abrir **Proyecto de ejemplo** → chip **Nivelaciones (2)**.
- ✓ **El Verjón — ida y vuelta**: «Nivelación · Abierta sin control · ida y
  vuelta», **Calculado**, columna Cierre **Δ 5.0 mm**, ✓. **Tramo 2 — crudo
  del nivel digital Leica**: **Cerrado**, −0.4 mm, ✓.
- Abrir **El Verjón — ida y vuelta**. ✓ Veredicto «Cumple tercer orden»,
  **5.0 mm**, «tolerancia 10.5 mm», «Discrepancia entre ida y vuelta»: en
  una abierta con vuelta, la discrepancia es el veredicto (Fase 23).
- ✓ La libreta tiene las pestañas **Ida** (D1 → D4, 12 filas, con el
  intermedio AUX1) y **Vuelta** (D4 → D1, 12 filas, con AUX 1). La distancia
  total de la configuración, 0.384 km, es la de la ida; la vuelta acumula
  0.398 km.
- ✓ En la vuelta aparecen avisos de equilibrado, por ejemplo «Armada C 1 →
  D1: visuales desequilibradas, 19.7 m de diferencia; el límite del orden es
  4 m.» Avisan, no bloquean.
- ✓ No hay tarjeta Cierre. La tarjeta **Ida y vuelta** muestra: desnivel ida
  26.5830, desnivel vuelta −26.5880, errores de cierre «—» (abierta),
  **Discrepancia 5.0 mm**, **Tolerancia (T·√2) 10.5 mm** (T = 12 · √0.384,
  la menor de las dos distancias), desnivel adoptado 26.5855 y «Discrepancia
  dentro de tolerancia».
- ✓ **Puntos homólogos** (vuelta − ida, cotas sin compensar): D4 0.0, C 8
  −1.0, D3 −2.0, C 7 −2.0, C 6 −3.0, C 5 −5.0, C 4 −5.0, AUX 1 −5.0, C 3
  −5.0, C 2 −6.0, C 1 −7.0 y D1 −5.0 mm «= discrepancia». AUX1 y AUX 1 se
  emparejan pese al espacio.
- ✓ En **Cotas corregidas** todas las correcciones son 0.0: una abierta no
  se compensa.
- **Cerrar proceso** y leer, sin confirmar. ✓ Tipo «Abierta sin control»,
  **Discrepancia ida/vuelta 5.0 mm**, **Tolerancia de la discrepancia 10.5
  mm** y fecha y hora; sin filas de error de cierre. Pulsar **Cancelar**:
  cerrar la demo es irreversible.
- Pestaña **Informe**. ✓ Marca «Borrador — el informe se emite al cerrar el
  proceso», «Discrepancia ida y vuelta: 5.0 mm (tolerancia 10.5 mm)», y en
  el resumen de precisión «Δ 5.0 mm (tol. 10.5)», ¿Cumple? Sí.
- **Exportar a Excel**. ✓ En la hoja «Resumen»: tipo Abierta sin control,
  ¿Tiene vuelta? Sí, distancia total 0.384, error de cierre y tolerancia
  vacíos, «Discrepancia ida/vuelta (mm)» 5.0, «Tolerancia de la discrepancia
  (mm)» 10.5 y «¿Cumple la discrepancia?» Sí.

### 11. Discrepancia fuera de tolerancia (Fase 23)

- En El Verjón, pestaña **Vuelta**, cambiar la V− de la última fila (D1) de
  `1.391` a `1.411` (+20 mm).
- ✓ En vivo: «No cumple tercer orden», **25.0 mm**, tolerancia 10.5 mm;
  desnivel vuelta −26.6080; «Discrepancia fuera de tolerancia»; en los
  homólogos, D1 −25.0 «= discrepancia». La barra dice «Cambios sin guardar».
- **Guardar**. ✓ En el listado del proyecto, El Verjón muestra **Δ 25.0 mm**
  y ✕, y el indicador «Fuera de tolerancia» del dashboard sube en uno.
- **Cerrar proceso**. ✓ Aviso «La discrepancia entre ida y vuelta (25.0 mm)
  supera T·√2 (10.5 mm); solo puede cerrarse como rechazado.» y el único
  botón es **Cerrar como rechazado**. Pulsar **Cancelar**.
- Devolver la V− a `1.391` y **Guardar**. ✓ Vuelve a Δ 5.0 mm, ✓.

> **No cierre El Verjón**: el cierre es irreversible y la demo perdería su
> ejemplo de ida y vuelta abierta. El cierre como rechazado se prueba en el
> paso 13, sobre un proceso desechable.

### 12. Sin distancias no se juzga ni se cierra (Fase 23)

- En El Verjón, pestaña **Vuelta**, borrar la **Dist V− (m)** de D1 (40.1).
  ✓ «Falta la distancia de la V−: sin ella el recorrido no acumula.»,
  «Corrige las celdas con error para poder guardar.» y **Guardar**
  deshabilitado: sin la distancia no se guarda ni se cierra. Recargar la
  página (el navegador pide confirmar) para descartar el cambio.
- Proceso desechable, en **Lote catastral**: **+ Nuevo Proceso** →
  **Nivelación** → **Importar desde archivo** →
  `docs/carteras/CRDUDO-TRAMO2.L`, **Ida y vuelta**, la vuelta en
  la **armada 9** → **Usar estas lecturas**. ✓ «Libreta importada: 9 filas
  de ida y 9 de vuelta.» Nombre «Prueba ida y vuelta» → **Crear proceso**.
  ✓ Abierta sin control con vuelta; veredicto 0.4 mm, tolerancia 14.2 mm,
  cumple.
- En su **Vuelta**, poner `0` en todas las Dist V+ y Dist V−. ✓ Veredicto
  «Datos incompletos» y, en Ida y vuelta, «Faltan distancias por visual en la
  libreta para evaluar la tolerancia.»
- **Guardar** y **Cerrar proceso**. ✓ «Faltan distancias por visual en la ida
  o en la vuelta para juzgar la discrepancia.» y **Confirmar cierre**
  deshabilitado. En el listado, Δ 0.4 mm y Cumple «—». **Cancelar**.

### 13. Cerrar como rechazado

- En «Prueba ida y vuelta», **Importar desde archivo** otra vez con el mismo
  archivo, **Ida y vuelta** y armada 9 (✓ avisa de que se reemplazan las
  lecturas) → **Usar estas lecturas**.
- En la **Vuelta**, cambiar la V− de la última fila (C10) de `1.7206` a
  `1.7406` (+20 mm). ✓ «No cumple tercer orden», 20.4 mm contra 14.2 mm.
- **Guardar** → **Cerrar proceso**. ✓ «La discrepancia entre ida y vuelta
  (20.4 mm) supera T·√2 (14.2 mm); solo puede cerrarse como rechazado.»
- Marcar la confirmación y **Cerrar como rechazado**. ✓ Badge **Rechazado**,
  «Este proceso fue rechazado; los datos son de solo lectura.», sin barra de
  acciones. En el listado, chip Rechazados (1) y la fila solo ofrece
  **Duplicar**. No aparece en **Nuevo informe**.

### 14. Importar desde archivo (Fase 16)

> **Guardar** en este paso reemplaza la libreta de la seed del Circuito BM-1:
> los pasos 2 a 5 dejan de cuadrar hasta volver a sembrar.

- En el **Circuito BM-1**, pulsar **Importar desde archivo** y elegir
  `docs/carteras/CRDUDO-TRAMO2.L`.
- ✓ Formato «Archivo .L de nivel digital Leica», 16 armadas · 64 visuales,
  según el instrumento Δ −0.0002 m · 1397.284 m, mayor dispersión 1.5 mm,
  mayor σ 2.3 mm. Propone **Ida y vuelta** con la vuelta en la **armada 9**
  («Detectada: armada 9…»), y la cota del BM ofrece la del archivo
  (C10 = 2541.7545) y la del proceso (BM-1 = 100.0000). Avisa de que se
  reemplazan las lecturas.
- Elegir **Un recorrido** y **Usar estas lecturas**. ✓ 17 filas de C10 a C10,
  tipo Cerrada, nivel digital, error de cierre −0.4 mm, tolerancia ±14.2 mm.
- Importar otra vez con **Ida y vuelta** y la armada 9. ✓ Tipo Abierta sin
  control con vuelta; ida C10 → C18 y vuelta C18 → C10; el veredicto es la
  discrepancia, 0.4 mm contra 14.2 mm. **Guardar** y recargar: ✓ C18 tiene
  cota 2542.9181 en la ida y en la vuelta.
- En **Nueva nivelación**, importar el mismo archivo como un recorrido. ✓ Se
  rellenan BM C10 («Otro (entrada libre)»), cota 2541.7545, tipo Cerrada y
  nivel digital, y «Libreta importada: 17 filas de ida.» Poner nombre y
  **Crear proceso**: ✓ el editor abre con las 17 filas y el cierre −0.4 mm.
- Importar un CSV cualquiera. ✓ «No se reconoce el formato del archivo. Se
  leen: Archivo .L de nivel digital Leica y Plantilla CSV de TopoField. Si su
  instrumento no es uno de esos, pase las lecturas a la plantilla CSV.», con
  el enlace **Descargar plantilla CSV** en el mismo diálogo.
- **Descargar plantilla CSV** (`plantilla-nivelacion.csv`), rellenarla con
  `;` y coma decimal y una radiación, e importarla. ✓ La radiación sale como
  Intermedio y el recorrido no se toma por ida y vuelta.

### 15. Puntos homólogos (Fase 17)

- En el **Circuito BM-1**, importar `docs/carteras/CRDUDO-TRAMO2.L` como
  **Ida y vuelta** (armada 9). ✓ Aparece **Puntos homólogos**: C18 0.0, C17
  −2.4, C16 −2.1, C15 −4.5, C14 −5.2, C13 −5.2, C12 −3.5, C11 −2.0 y C10
  −0.4 mm, esta última rotulada «= discrepancia».
- Importarlo como **Un recorrido**. ✓ La sección no aparece.
- Importar una plantilla con ida A → P1 → B y vuelta B → Q1 → A (puntos de
  cambio propios). ✓ Aparece la discrepancia, no los homólogos.
- No guardar: recargar (el navegador pide confirmar) deja el Circuito como
  quedó guardado en el paso 14.

## Resultado esperado

Si los puntos pasan, el módulo de nivelación cumple los criterios del
PRD-de-fase 4 y de sus ampliaciones en su uso real: cálculo de cotas por
libreta con la distancia derivada de las visuales, corrección proporcional a
la distancia, veredicto de cierre contra tolerancia —o, en una abierta con
vuelta, de la discrepancia contra T·√2—, importación de archivos de nivel
digital y cierre irreversible. Cualquier discrepancia con los números
anteriores (verificados a mano en el brief de la fase y contra la aplicación)
debe documentarse y corregirse.
