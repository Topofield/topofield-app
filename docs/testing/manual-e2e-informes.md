# Checklist manual end-to-end — Informes y exportación

Recorrido paso a paso para verificar la generación de informes (§ 4.7) y la
exportación a Excel (§ 4.8) contra los datos precargados por la seed.

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

La seed deja tres informes: dos en **Lote catastral** (poligonal y nivelación) y
uno en **Edificio en monitoreo** (asentamientos).

## Recorrido

### 1. Tab Informes — informes precargados

- Abrir **Lote catastral** y entrar a la tab **Informes**.
- ✓ Aparecen dos informes: **Informe de cierre — Poligonal** e **Informe de
  cierre — Nivelación**.

### 2. Abrir un informe

- Abrir **Informe de cierre — Poligonal**.
- ✓ El documento incluye una sección con el proceso **Cuadrado oficial
  (cerrado)**: sus datos de cabecera, la tabla de estaciones con coordenadas, y
  las observaciones del informe.
- ✓ El nombre del proceso mostrado es el que tenía al emitir (se congela en
  `included_processes`).

### 3. Ruta imprimible

- Desde el informe, abrir la vista de impresión
  (`/projects/[id]/reports/[reportId]/print`).
- ✓ Se ve la maquetación imprimible (portada, secciones, tablas) sin la
  navegación de la app.
- ✓ Con el diálogo de impresión del navegador puede guardarse como PDF.

### 4. Elegibilidad — solo procesos cerrados

- Volver a la tab Informes y clic **Nuevo informe** (`/reports/new`).
- ✓ La lista de "procesos a incluir" ofrece **solo trabajos cerrados**: en Lote
  catastral, la poligonal **Cuadrado oficial** y la nivelación **Circuito BM-2**.
- ✓ **No** aparecen los procesos calculados (Pentágono, Cuadrado con error,
  Circuito BM-1…) ni el **rechazado** (Cuadrado marginal): un informe solo puede
  incluir lo inmutable.

### 5. Alta de un informe con orden de secciones

- Marcar la poligonal y la nivelación cerradas.
- ✓ Aparece la lista "Orden de las secciones" con botones **subir/bajar**;
  reordenar cambia el orden.
- Poner un título ("Informe de cierre — etapa 1") y observaciones. **Generar
  informe**.
- ✓ Redirige al informe recién creado, con las dos secciones en el orden
  elegido.

### 6. Informe de asentamientos — con gráfica

- Abrir **Edificio en monitoreo** → tab **Informes**.
- ✓ Existe **Informe de cierre — Control de asentamientos** (incluye el lugar
  cerrado **Edificio Norte**).
- Abrirlo y ver la ruta imprimible.
- ✓ La sección de asentamientos incluye la **gráfica** de la serie (SVG estático
  en el servidor), la leyenda y la tabla de valores: la información no depende
  solo del color.

### 7. Proyecto sin nada cerrado

- Abrir **Red geodésica** (sin procesos) → tab Informes → **Nuevo informe**.
- ✓ Muestra el estado vacío: "Todavía no hay procesos cerrados…", sin
  formulario.

### 8. Borrar un informe

- En un informe creado en el paso 5, usar **Eliminar**.
- ✓ Desaparece de la lista. No hay edición: un informe se borra y se rehace
  (los datos que refleja son inmutables, así que regenerarlo da lo mismo).

### 9. Exportar a Excel (§ 4.8)

- Abrir un proceso (por ejemplo la poligonal **Cuadrado oficial**) y usar
  **Exportar a Excel**.
- ✓ Descarga un `.xlsx` con las hojas del dominio (datos, estaciones/lecturas,
  metadatos del proyecto), con los códigos de punto —no UUIDs—, los decimales
  del dominio y la precisión relativa como `1:n` (o `1:∞`).
- ✓ Un proceso en borrador exporta con las celdas de resultado vacías, sin
  romper el libro.

## Resultado esperado

Si los puntos pasan, la generación de informes y la exportación cumplen los
criterios de la fase 6: elegibilidad restringida a lo cerrado, orden de
secciones, ruta imprimible reproducible (el informe se reconstruye al abrirlo,
no guarda copia), gráfica de asentamientos accesible, y export a Excel con el
vocabulario del dominio.
