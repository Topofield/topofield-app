# Checklist manual end-to-end — El informe de cada proceso y su exportación

Recorrido paso a paso para verificar el informe de cada proceso y su
exportación (Fase 38) contra los datos precargados por la seed y por el
proyecto de ejemplo: el informe con **Exportar PDF** y **Exportar Excel** en
los tres módulos, que ningún otro paso exporta, el hub sin la pestaña
Informes, las rutas viejas de los informes consolidados y los libros de Excel
con fórmulas vivas.

## Preparación

1. Con Supabase local activo (`npx supabase start`), recrear la base y
   sembrarla:
   ```
   npx supabase db reset && npm run seed
   ```
   El seed no es idempotente: corre solo sobre una base recién reseteada.
2. En otra terminal, levantar el dev server:
   ```
   npm run dev
   ```
3. Abrir `http://localhost:3000/sign-in` e iniciar sesión con **Entrar**:
   - Email: `topofieldsarf@gmail.com`
   - Password: `seed1234`
4. ✓ El dashboard muestra 4 proyectos: los tres de la seed y el **Proyecto de
   ejemplo**, que la aplicación crea la primera vez que se entra.
5. Tener a mano Excel o LibreOffice Calc para abrir los libros.

Los procesos que usa el recorrido:

| Proyecto | Proceso | Para qué |
|---|---|---|
| Lote catastral | **Cuadrado oficial** | Poligonal cerrada exacta: 1:∞, Primer orden |
| Lote catastral | **Poligonal V10 — cartera TT4 — bowditch**, **— transit** y **— crandall** | Las hojas BRÚJULA, TRÁNSITO y CRANDALL |
| Lote catastral | **Poligonal Famarena — Sede Vivero — least_squares** | La hoja MÍNIMOS CUADRADOS |
| Lote catastral | **Enlace P1-P3 con deflexión** y **Reconocimiento E1-E4 (sin cierre)** | DEFLEXIÓN y la hoja ABIERTA SIN CONTROL |
| Lote catastral | **Circuito BM-1 (cerrado, tercer orden)** | Nivelación con hilos: −8.0 mm en 0.900 km, tercer orden |
| Proyecto de ejemplo | **El Verjón — ida y vuelta** | Contranivelación, discrepancia y «Cotas ajustadas» |
| Edificio en monitoreo | **Torre Alameda** | Libretas de dos armadas: la visita 12 cierra en −1.6 mm en BM-1 |
| Proyecto de ejemplo | **Control de asentamiento estructural** | Tramos sin verificación y los avisos de tendencia de B10 |

## Recorrido

### 1. El hub, sin Informes

- Abrir **Lote catastral**.
- ✓ Debajo de la cabecera hay solo dos pestañas: **Procesos** y
  **Configuración**.
- Añadir `?tab=reports` a la URL del proyecto. ✓ Abre en **Procesos**.

### 2. Las rutas viejas de los informes consolidados

Con el id de **Lote catastral** de la URL:

- `/projects/<id>/reports`. ✓ «No encontrado» (la página 404).
- `/projects/<id>/reports/new`. ✓ Igual.
- `/projects/<id>/reports/00000000-0000-0000-0000-000000000000/print`.
  ✓ Igual.

### 3. El informe de la poligonal

- Abrir **Cuadrado oficial** y su paso **3 · Informe**.
- ✓ La cabecera empieza con **Exportar PDF** y **Exportar Excel**; siguen
  **Editar datos** y **⋯**.
- ✓ Portada «TopoField — Informe técnico» con el nombre del proceso; Proyecto
  **Lote catastral**, Cliente «Cliente Demo», Ubicación Bogotá, Datum /
  proyección MAGNA-SIRGAS · Origen Bogotá y la «Fecha del informe».
- ✓ «Datos y resultados» con las cinco partes de la poligonal —1. Resultado,
  con Orden alcanzado **Primer orden**; 2. Datos de campo; 3. Corrección por
  método Brújula (Bowditch); 4. Poligonal ajustada, y 5. Coordenadas, con el
  dibujo—, el «Resumen de precisión», las «Observaciones» con las notas del
  proceso y el pie «Informe generado desde TopoField el <fecha>.».
- ✓ Sin marca de borrador ni registro de cierre, y nada debajo del pie: ni
  informes consolidados que lo incluyan ni un botón para generar uno.
- Pasar a **1 · Datos** y a **2 · Ajuste**. ✓ La cabecera no muestra
  **Exportar PDF** ni **Exportar Excel**.

### 4. El informe de la nivelación

- Abrir **Circuito BM-1 (cerrado, tercer orden)** y su paso **3 · Informe**.
  ✓ **Exportar PDF** y **Exportar Excel** al principio de la cabecera; el
  informe con su portada, «Datos y resultados», «Resumen de precisión» y pie.
- Pasar a **1 · Libreta** y a **2 · Compensación**. ✓ Sin botones de
  exportar.

### 5. El informe del lugar y la visita

- Abrir **Torre Alameda** en **Edificio en monitoreo** y su pestaña
  **Informe**. ✓ La cabecera empieza con **Exportar PDF** y **Exportar
  Excel**, y sigue con **+ Nueva visita**, **Editar datos** y **⋯**.
- ✓ El informe lleva las visitas calculadas, con la gráfica de la evolución.
- Pasar a **Panel**, **Puntos** y **BMs**. ✓ Sin botones de exportar.
- Abrir la visita 12: **1 · Libreta** y **2 · Resultados**. ✓ Ninguno de los
  dos exporta; la visita no tiene informe propio.

### 6. Eliminar un proceso no habla de informes

- En **Cuadrado oficial**, **⋯ → Eliminar**. ✓ El diálogo dice qué se borra,
  sin mencionar informes consolidados. **Cancelar**.
- En el hub de **Lote catastral**, la acción de fila **Eliminar** de
  cualquier poligonal. ✓ Igual. **Cancelar**.

### 7. Exportar PDF

- En el informe de **Cuadrado oficial**, **Exportar PDF**.
- ✓ Se abre el diálogo de impresión del navegador, con la vista previa en A4.
- ✓ La vista previa es solo el informe: sin la barra de arriba, la cabecera,
  los pasos ni los botones. Con el tema oscuro elegido, sale igual en claro.
- Elegir «Guardar como PDF» como destino y guardar. ✓ El PDF tiene la
  portada, los datos y resultados, el resumen de precisión, las observaciones
  y el pie.
- Repetir en el informe de **El Verjón — ida y vuelta** y en el de **Torre
  Alameda**. ✓ Igual.

### 8. Exportar Excel — nivelación

- En el informe de **Circuito BM-1 (cerrado, tercer orden)**, **Exportar
  Excel**. ✓ Descarga un `.xlsx` que se abre sin avisos de reparación.
- ✓ Hojas «Nivelación», «Cotas ajustadas» y «Resumen»; sin
  «Contranivelación», porque no tiene vuelta.
- ✓ En «Nivelación», las columnas PUNTO · TIPO · V+ · AI · V− · VI · COTA ·
  DIST. V+ (m) · DIST. V− (m) · ACUM. (km) · CORRECCIÓN (m) · COTA AJUSTADA ·
  CLAVE. Con hilos, cada lectura ocupa tres filas —superior, medio e
  inferior— y la distancia es (superior − inferior) × 100: 150 m en cada
  visual.
- ✓ Las lecturas tienen fondo amarillo; las demás celdas calculadas muestran
  una fórmula en la barra de fórmulas.
- ✓ El bloque «Cierre», bajo la tabla: Distancia (km) 0.900, la cota
  calculada de llegada, la cota conocida 100.0000 y Error de cierre (mm)
  −8.0; la tolerancia K·√km de cada orden; Orden alcanzado **Tercer orden** y
  Veredicto **CUMPLE**. Coinciden con el paso **2 · Compensación**.
- **Recalcular:** cambiar la V− de la última lectura (BM-1, hilo medio) de
  0.808 a 0.800. ✓ El error de cierre pasa a 0.0 mm, el Orden alcanzado a
  **Primer orden** y las correcciones a cero.
- En el informe de **El Verjón — ida y vuelta**, **Exportar Excel**.
  ✓ Hojas «Nivelación», «Contranivelación», «Cotas ajustadas» y «Resumen».
  ✓ El cierre lleva el desnivel de cada recorrido, la discrepancia, el cierre
  del circuito y la distancia del par, y el Orden alcanzado **Segundo
  orden**, como el paso de Compensación. ✓ «Cotas ajustadas» tiene una fila
  por punto: la cota conocida en D1 y, en los demás, el promedio de sus cotas
  ajustadas en la ida y en la vuelta.

### 9. Exportar Excel — poligonal

- En el informe de **Cuadrado oficial**, **Exportar Excel**. ✓ Hojas
  «BRÚJULA» y «Resumen».
- ✓ Columnas ESTACIÓN · VISADO · ÁNG. HORIZONTAL (G · M · S · DEC) · CORR. ·
  ÁNG. CORREGIDO (G · M · S · DEC) · AZIMUT (G · M · S · DEC) · DIST. ·
  PROYECCIONES (N-S · E-W) · CORRECCIÓN (N · E) · PROY. CORREGIDAS ·
  COORDENADAS (N · E), y la fila SUMATORIA.
- ✓ Debajo, «Cierre angular» y «Cierre lineal» —error N, error E, error
  lineal, perímetro y Precisión (1:X) «∞»—, las tolerancias de cada orden,
  Orden alcanzado **Primer orden** y Veredicto **CUMPLE**.
- **Recalcular:** cambiar la DIST. de la estación A de 100 a 100.4. ✓ El
  error lineal pasa a 0.400 m, el perímetro a 400.400 m, la precisión a 1001,
  el Orden alcanzado a Ninguno y el Veredicto a **NO CUMPLE**: lo que la app
  da para **Cuadrado con error 0.4 m (fixture clave)**, que tiene ese lado
  así.
- Exportar **Poligonal V10 — cartera TT4 — transit** y **— crandall**.
  ✓ Hojas «TRÁNSITO» y «CRANDALL», con las columnas auxiliares a la derecha:
  |N-S| y |E-W| en Tránsito; d·cos², d·cos·sin, d·sin² y δd en Crandall, que
  además lleva el bloque «Crandall: sistema 2×2». ✓ Las coordenadas
  coinciden con el paso **2 · Ajuste** de cada una.
- Exportar **Enlace P1-P3 con deflexión**. ✓ La columna de ángulos dice
  DEFLEXIÓN, y a la derecha van DIR. y AZ. SIN CORREGIR.
- Exportar **Reconocimiento E1-E4 (sin cierre)**. ✓ La hoja se llama
  «ABIERTA SIN CONTROL».
- Exportar **Poligonal Famarena — Sede Vivero — least_squares**. ✓ Hoja
  «MÍNIMOS CUADRADOS»: las correcciones v son valores; las distancias, los
  azimuts, las proyecciones y las coordenadas ajustados, fórmulas. ✓ El
  cierre de antes del ajuste y los bloques de la última iteración
  —observaciones l₀, Matriz A, Q, w, N = A·Q·Aᵀ, k y v— van como valores.
- **Georreferenciación** (cambia los datos del seed; dejarlo para el final):
  georreferenciar **Poligonal Famarena — Sede Vivero — sistema local** con D1
  y D3 (manual § 5.6) y exportarla. ✓ El bloque «Georreferenciación» trae la
  fecha, los puntos de control, la rotación y la escala como datos.

### 10. Exportar Excel — asentamientos

- En la pestaña **Informe** de **Torre Alameda** (Edificio en monitoreo),
  **Exportar Excel**. ✓ Hojas «Libretas», «Comparación» y «Resumen».
- ✓ «Libretas»: un bloque por visita, con su título «Visita N · fecha», el
  nivelador, el equipo y la nota, y las columnas PUNTO · V+ · AI · V− · VI ·
  COTA · DIST. V+ (m) · DIST. V− (m). En la visita 12, sus dos armadas, y la
  línea de verificación del tramo: Cierre (mm) −1.6, sus km y Orden
  **Segundo orden**.
- ✓ «Comparación»: arriba, los umbrales del lugar; una fila por punto
  —PUNTO, UBICACIÓN y C0— y, por visita, COTA · ACUM. (mm) · PARCIAL (mm) ·
  VEL. (mm/mes) · SEMÁFORO, con el semáforo coloreado. La COTA de cada visita
  apunta a su celda de «Libretas». Los valores coinciden con los
  **Resultados** de cada visita en la app.
- ✓ «Resumen»: el lugar y sus BM, BM-1 y BM-2.
- **Recalcular:** en el bloque de la visita 12 de «Libretas», sumar 0.010 a
  la lectura de TA-01. ✓ Su COTA baja 10 mm; en «Comparación», su ACUM. y su
  PARCIAL de la visita 12 cambian 10 mm, y su PARCIAL de la visita 13, en
  sentido contrario.
- En la pestaña **Informe** de **Control de asentamiento estructural**
  (Proyecto de ejemplo), **Exportar Excel**. ✓ Cada visita, una armada de
  radiaciones desde el BM de la piscina, con la línea «Sin verificación».
  ✓ Al pie de «Comparación», «Avisos de tendencia» nombra a B10 en las
  visitas 3 y 4.

## Resultado esperado

Si los puntos pasan, la Fase 38 cumple sus criterios: el informe de cada
proceso tiene **Exportar PDF** y **Exportar Excel** y ningún otro paso
exporta (a); el PDF sale del diálogo de impresión, sin botones (b); el hub
tiene solo Procesos y Configuración (c); las rutas de los consolidados dan
«no encontrado» (d); eliminar un proceso no habla de informes (e); los libros
de los tres módulos tienen sus hojas, sus encabezados y sus bloques de
cierre (g), con fórmulas que dan lo mismo que la app (h) y que se recalculan
al cambiar un dato (i).
