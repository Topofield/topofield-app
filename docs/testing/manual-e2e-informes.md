# Checklist manual end-to-end — Informes y exportación

Recorrido paso a paso para verificar la generación de informes (§ 4.7) y la
exportación a Excel (§ 4.8) contra los datos precargados por la seed y por el
proyecto de ejemplo.

## Preparación

1. Con Supabase local activo (`npx supabase start`), recrear la base y
   sembrarla:
   ```
   npx supabase db reset
   npm run seed
   ```
   El seed solo funciona sobre una base recién reseteada: borra y recrea el
   usuario, y en una base con procesos cerrados ese borrado falla —lo cerrado
   es inmutable— y el script se detiene pidiendo el `db reset`.
2. En otra terminal, levantar el dev server:
   ```
   npm run dev
   ```
3. Abrir `http://localhost:3000/sign-in` e iniciar sesión con **Entrar**:
   - Email: `topofieldsarf@gmail.com`
   - Password: `seed1234`
4. ✓ El dashboard muestra 4 proyectos: los tres de la seed y el **Proyecto de
   ejemplo**, que la aplicación crea la primera vez que se entra.

La seed deja tres informes consolidados: dos en **Lote catastral** (poligonal
y nivelación) y uno en **Edificio en monitoreo** (asentamientos). El
**Proyecto de ejemplo** trae otros tres, uno por módulo.

Lo que cada proyecto puede incluir en un informe —solo lo cerrado—:

| Proyecto | Trabajos cerrados |
|---|---|
| Lote catastral | Poligonales **Cuadrado oficial (cerrado)** y **Poligonal Famarena — Sede Vivero — sistema local**; nivelación **Circuito BM-2 (cerrado oficialmente)** |
| Red geodésica | Ninguno: su poligonal está calculada |
| Edificio en monitoreo | Control de asentamientos **Edificio Norte** |
| Proyecto de ejemplo | **Poligonal V10 — cartera TT4**, **Tramo 2 — crudo del nivel digital Leica** y **Torre Alameda** |

## Recorrido

### 1. Tab Informes — informes precargados

- Abrir **Lote catastral** y entrar a la tab **Informes**.
- ✓ Arriba, el botón **Generar Nuevo Informe**; debajo, dos informes:
  **Informe de cierre — Poligonal** e **Informe de cierre — Nivelación**,
  cada uno con «1 proceso · ‹fecha›».

### 2. Abrir un informe

- Abrir **Informe de cierre — Poligonal**.
- ✓ Portada «TopoField — Informe técnico» con el título; Proyecto **Lote
  catastral**, Cliente «Cliente Demo», Ubicación Bogotá, Datum / proyección
  MAGNA-SIRGAS · Origen Bogotá y la fecha de emisión. Después, el índice de
  procesos incluidos.
- ✓ La sección **1. Cuadrado oficial (cerrado)** trae sus datos, el equipo
  (Leica TS06 Plus · s/n LCS-2026-001), la tabla de estaciones con
  coordenadas y el dibujo; siguen el resumen consolidado de precisiones, las
  observaciones del informe y el registro de cierre.
- ✓ El nombre del proceso mostrado es el que tenía al emitir (se congela en
  `included_processes`).

### 3. Ruta imprimible

- El informe se abre directo en la vista de impresión
  (`/projects/[id]/reports/[reportId]/print`, Fase 22); la ruta sin `/print`
  redirige a ella.
- ✓ Arriba, las migas (Dashboard › Lote catastral › título), **Eliminar
  informe** e **Imprimir o guardar como PDF**; nada de eso sale al imprimir.
- ✓ El registro de cierre nombra al responsable (Seed TopoField), no un
  identificador.
- ✓ Con el diálogo de impresión del navegador puede guardarse como PDF.

### 3 bis. El informe de un proceso (Fase 22)

- Abrir **Cuadrado oficial (cerrado)** y su pestaña **Informe**.
- ✓ En la cabecera, **Ver informe** se cambia por **Imprimir o guardar como
  PDF**.
- ✓ Portada (con «Fecha de cierre»), «Datos y resultados», resumen de
  precisión y registro de cierre, sin marca de borrador; debajo, fuera de la
  impresión, **Informe de cierre — Poligonal** como informe consolidado que
  lo incluye.
- ✓ **Generar un informe consolidado con este proceso** abre el alta con el
  proceso ya marcado (primero en «Orden de las secciones»).
- Abrir un proceso calculado (por ejemplo **Pentágono — Caso 1 del marco
  teórico**) y su pestaña **Informe**. ✓ Lleva la marca «Borrador — el
  informe se emite al cerrar el proceso», también en la vista de impresión
  del navegador, y en lugar del botón dice «Un informe consolidado solo
  incluye procesos cerrados.»
- ⚠ Un proceso **rechazado** (**Cuadrado marginal (rechazado)**) también
  lleva hoy esa marca de borrador, aunque el manual (§ 8) dice que ya no la
  lleva. Discrepancia conocida: anotarla, no es un fallo del probador.

### 4. Elegibilidad — solo procesos cerrados

- Volver a la tab Informes y clic **Generar Nuevo Informe**
  (`/reports/new`, título «Nuevo informe»).
- ✓ «Procesos cerrados a incluir» ofrece **solo trabajos cerrados**: en Lote
  catastral, las poligonales **Cuadrado oficial (cerrado)** y **Poligonal
  Famarena — Sede Vivero — sistema local**, y la nivelación **Circuito BM-2
  (cerrado oficialmente)**.
- ✓ **No** aparecen los procesos calculados (Pentágono, Cuadrado con error,
  Circuito BM-1, las otras variantes de V10 y Sede Vivero…) ni el
  **rechazado** (Cuadrado marginal): un informe solo puede incluir lo
  inmutable.
- ✓ En **Edificio en monitoreo** solo aparece el lugar cerrado **Edificio
  Norte** (no Edificio Torre Central ni Torre Alameda, activos). En
  **Proyecto de ejemplo**, Poligonal V10 — cartera TT4, Tramo 2 y Torre
  Alameda; no El Verjón ni las poligonales de la Sede Vivero, calculadas.

### 5. Alta de un informe con orden de secciones

- En Lote catastral, marcar **Cuadrado oficial (cerrado)** y **Circuito BM-2
  (cerrado oficialmente)**.
- ✓ Aparece «Orden de las secciones» con los botones **↑ ↓**; reordenar
  cambia el orden.
- Poner un título («Informe de cierre — etapa 1») y «Observaciones
  generales». **Generar informe**.
- ✓ Abre la vista de impresión del informe recién creado, con las dos
  secciones —y el índice— en el orden elegido.

### 6. Informe de asentamientos — con gráfica

- Abrir **Edificio en monitoreo** → tab **Informes**.
- ✓ Existe **Informe de cierre — Control de asentamientos** (incluye el lugar
  cerrado **Edificio Norte**: 4 puntos, 3 visitas).
- Abrirlo: se abre en la vista de impresión.
- ✓ La sección de asentamientos incluye la **gráfica** del acumulado (SVG
  estático en el servidor), la leyenda (N-01 a N-04) y las tablas «Visitas» y
  «Última visita»: la información no depende solo del color.
- ✓ El **Proyecto de ejemplo** tiene el mismo informe para **Torre Alameda**,
  con catorce visitas.

### 7. Proyecto sin nada cerrado

- Abrir **Red geodésica** (una poligonal calculada, nada cerrado) → tab
  Informes. ✓ «Aún no hay informes».
- **Generar Nuevo Informe**. ✓ Muestra el estado vacío «Todavía no hay
  procesos cerrados», sin formulario.

### 8. La portada se congela al emitir (Fase 23)

- En **Lote catastral** → tab **Configuración** → «Datos del proyecto»,
  cambiar el **Nombre del proyecto** a «Lote catastral (renombrado)» y
  **Guardar cambios**. ✓ «Cambios guardados.» y la cabecera del proyecto
  muestra el nombre nuevo.
- Tab **Informes** → abrir el informe del paso 5 (o **Informe de cierre —
  Poligonal**). ✓ La portada sigue diciendo Proyecto **Lote catastral**: se
  guardó al emitir (`reports.cover`: nombre, cliente, ubicación, datum y
  proyección). Las migas, que no se imprimen, sí muestran el nombre nuevo.
- Abrir **Cuadrado oficial (cerrado)** → pestaña **Informe**. ✓ Su portada
  dice **Lote catastral (renombrado)**: el informe de un proceso toma los
  datos del proyecto en vivo.
- Volver a **Configuración**, devolver el nombre a «Lote catastral» y
  **Guardar cambios**.

### 9. Borrar un informe

- En el informe creado en el paso 5, **Eliminar informe**. ✓ El diálogo
  avisa «Se eliminará el informe «Informe de cierre — etapa 1». Los procesos
  que incluye no cambian: puedes volver a generarlo cuando quieras.»
- **Eliminar**. ✓ Vuelve a la tab Informes y ya no aparece.
- ✓ No hay edición: un informe emitido se borra y se regenera. Las secciones
  saldrán iguales —los procesos son inmutables—, pero la portada tomará los
  datos que tenga el proyecto en ese momento.

### 10. Exportar a Excel (§ 4.8)

- Abrir un proceso (por ejemplo la poligonal **Cuadrado oficial**) y usar
  **Exportar a Excel**, en la cabecera de su pantalla.
- ✓ Descarga un `.xlsx` con tres hojas: «Datos Crudos», «Cálculos» y
  «Resumen» (con los datos del proyecto), con los códigos de punto —no
  UUIDs—, los decimales del dominio y la precisión relativa como `1:n` (aquí
  `1:∞`).
- ✓ En un control de asentamientos (por ejemplo **Edificio Norte**) el libro
  lleva una cuarta hoja, «Libretas».
- ✓ En **El Verjón — ida y vuelta** (Proyecto de ejemplo), «Resumen» trae la
  discrepancia ida/vuelta (5.0 mm), su tolerancia (10.5 mm) y «¿Cumple la
  discrepancia?» Sí.
- ✓ Un proceso en borrador (por ejemplo, la copia que deja **Duplicar**)
  exporta con las celdas de resultado vacías, sin romper el libro.

## Resultado esperado

Si los puntos pasan, la generación de informes y la exportación cumplen los
criterios de la fase 6 y de sus revisiones: elegibilidad restringida a lo
cerrado, orden de secciones, ruta imprimible reproducible (las secciones se
reconstruyen al abrirla a partir de procesos inmutables, y la portada queda
congelada al emitir, Fase 23), informes que no se editan —se eliminan y se
regeneran—, el informe propio de cada proceso, gráfica de asentamientos
accesible y export a Excel con el vocabulario del dominio.
