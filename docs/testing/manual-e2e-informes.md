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
   usuario, y en una base con nivelaciones, lugares o visitas cerrados ese
   borrado falla —lo cerrado es inmutable— y el script se detiene pidiendo el
   `db reset`.
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

Lo que cada proyecto puede incluir en un informe —las poligonales
**calculadas**, cumplan o no un orden, y lo demás **cerrado**; desde la Fase 35
la poligonal no se cierra—:

| Proyecto | Trabajos que puede incluir |
|---|---|
| Lote catastral | Sus 13 poligonales, todas calculadas —entre ellas **Cuadrado oficial**, que cierra exacta, y **Cuadrado marginal (no cumple)**, que no alcanza ningún orden—; nivelación **Circuito BM-2 (cerrado oficialmente)** |
| Red geodésica | Poligonal **Cuadrado de control 200×4 (red geodésica)** |
| Edificio en monitoreo | Control de asentamientos **Edificio Norte** |
| Proyecto de ejemplo | Poligonales **Poligonal V10 — cartera TT4**, **Poligonal Famarena — Sede Vivero** y **Poligonal Famarena — Sede Vivero — sistema local**; **Tramo 2 — crudo del nivel digital Leica** y **Torre Alameda** |

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
- ✓ La sección **1. Cuadrado oficial** trae sus datos —tipo «Cerrada, ángulos
  interiores», método «Brújula (Bowditch)» y el equipo (Leica TS06 Plus · s/n
  LCS-2026-001)— y las cinco partes de la poligonal: 1. Resultado, con Orden
  alcanzado **Primer orden**; 2. Datos de campo; 3. Corrección por método
  Brújula (Bowditch); 4. Poligonal ajustada, y 5. Coordenadas, con el dibujo.
  Siguen el resumen consolidado de precisiones («1:∞ · Primer orden», «Sí») y las
  observaciones del informe.
- ✓ **No** hay registro de cierre: la poligonal no se cierra y no tiene fila,
  y un informe solo con poligonales no lo muestra. El pie dice «Informe
  emitido desde TopoField el <fecha>.», sin «con procesos cerrados».
- ✓ El nombre del proceso mostrado es el que tenía al emitir (se congela en
  `included_processes`).

### 3. Ruta imprimible

- El informe se abre directo en la vista de impresión
  (`/projects/[id]/reports/[reportId]/print`, Fase 22); la ruta sin `/print`
  redirige a ella.
- ✓ En la barra, la ruta (Dashboard › Lote catastral › título); arriba,
  **Eliminar informe** e **Imprimir o guardar como PDF**. Nada de eso sale al
  imprimir, tampoco la barra.
- Abrir **Informe de cierre — Nivelación**. ✓ El registro de cierre nombra al
  responsable (Seed TopoField), no un identificador.
- ✓ Con el diálogo de impresión del navegador puede guardarse como PDF.

### 3 bis. El informe de un proceso (Fase 22)

- Abrir **Cuadrado oficial** y su paso **3 · Informe**.
- ✓ Portada con «Fecha del informe», «Datos y resultados» y resumen de
  precisión, **sin** marca de borrador ni registro de cierre; el pie dice
  «Informe generado desde TopoField el <fecha>.» Debajo, fuera de la
  impresión, **Informe de cierre — Poligonal** como informe consolidado que
  lo incluye.
- ✓ **Generar un informe consolidado con este proceso** abre el alta con el
  proceso ya marcado (primero en «Orden de las secciones»).
- Abrir **Cuadrado marginal (no cumple)** → **3 · Informe**. ✓ Sin marca; en
  «1. Resultado», Orden alcanzado «Ninguno» y la alerta «No alcanza la
  precisión de ningún orden: el error angular o la precisión relativa supera
  las tolerancias del ordinario.» ✓ También ofrece **Generar un informe
  consolidado con este proceso**: una poligonal calculada entra aunque no
  cumpla.
- Abrir una nivelación calculada (**Circuito BM-1 (cerrado, tercer orden)**) y
  pulsar **Ver informe**. ✓ En la cabecera, **Ver informe** se cambia por
  **Imprimir o guardar como PDF**. El informe lleva la marca «Borrador — el
  informe se emite al cerrar el proceso», también en la vista de impresión
  del navegador, y en lugar del botón dice «Un informe consolidado solo
  incluye procesos cerrados.»

### 4. Elegibilidad — poligonales calculadas y lo demás cerrado

- Volver a la tab Informes y clic **Generar Nuevo Informe**
  (`/reports/new`, título «Nuevo informe», «Reúne poligonales calculadas y
  procesos cerrados del proyecto en un solo documento.»).
- ✓ «Procesos a incluir» ofrece, en Lote catastral, **las 13 poligonales**
  —también el Pentágono y el Cuadrado marginal (no cumple), que no alcanzan
  ningún orden— y la nivelación **Circuito BM-2 (cerrado oficialmente)**. Cada
  una lleva delante su tipo: «Poligonal», «Nivelación».
- ✓ **No** aparece la nivelación calculada **Circuito BM-1**: fuera de la
  poligonal, un informe solo incluye lo cerrado. Una poligonal en borrador o
  en progreso —la que deja **Duplicar**, por ejemplo— tampoco: tiene que estar
  calculada.
- ✓ En **Edificio en monitoreo** solo aparece el lugar cerrado **Edificio
  Norte** (no Edificio Torre Central ni Torre Alameda, activos). En
  **Proyecto de ejemplo**, sus tres poligonales, Tramo 2 y Torre Alameda; no
  El Verjón, nivelación calculada.

### 5. Alta de un informe con orden de secciones

- En Lote catastral, marcar **Cuadrado oficial** y **Circuito BM-2 (cerrado
  oficialmente)**.
- ✓ Aparece «Orden de las secciones» con los botones **↑ ↓**; reordenar
  cambia el orden.
- Poner un título («Informe de cierre — etapa 1») y «Observaciones
  generales». **Generar informe**.
- ✓ Abre la vista de impresión del informe recién creado, con las dos
  secciones —y el índice— en el orden elegido.
- ✓ El registro de cierre tiene una sola fila, la del Circuito BM-2: la
  poligonal no tiene fila. El pie dice «Informe emitido desde TopoField el
  <fecha>, con procesos cerrados.»

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

### 7. Proyecto sin nada que informar

- Abrir **Red geodésica** (una poligonal calculada, nada cerrado) → tab
  Informes. ✓ «Aún no hay informes».
- **Generar Nuevo Informe**. ✓ El formulario ofrece **Cuadrado de control
  200×4 (red geodésica)**: una poligonal calculada basta.
- Para ver el estado vacío, crear un proyecto `Prueba informes` desde el
  dashboard y, en su tab Informes, **Generar Nuevo Informe**. ✓ «Todavía no hay
  procesos para informar», sin formulario. Después, en su tab
  **Configuración**, eliminarlo: no tiene nada cerrado.

### 8. La portada se congela al emitir (Fase 23)

- En **Lote catastral** → tab **Configuración** → «Datos del proyecto»,
  cambiar el **Nombre del proyecto** a «Lote catastral (renombrado)» y
  **Guardar cambios**. ✓ «Cambios guardados.» y la cabecera del proyecto
  muestra el nombre nuevo.
- Tab **Informes** → abrir el informe del paso 5 (o **Informe de cierre —
  Poligonal**). ✓ La portada sigue diciendo Proyecto **Lote catastral**: se
  guardó al emitir (`reports.cover`: nombre, cliente, ubicación, datum y
  proyección). La ruta de la barra, que no se imprime, sí muestra el nombre
  nuevo.
- Abrir **Cuadrado oficial** → paso **3 · Informe**. ✓ Su portada dice **Lote
  catastral (renombrado)**: el informe de un proceso toma los datos del
  proyecto en vivo.
- Volver a **Configuración**, devolver el nombre a «Lote catastral» y
  **Guardar cambios**.

### 9. Borrar un informe

- En el informe creado en el paso 5, **Eliminar informe**. ✓ El diálogo
  avisa «Se eliminará el informe «Informe de cierre — etapa 1». Los procesos
  que incluye no cambian: puedes volver a generarlo cuando quieras.»
- **Eliminar**. ✓ Vuelve a la tab Informes y ya no aparece.
- ✓ No hay edición: un informe emitido se borra y se regenera. Las secciones
  de lo cerrado saldrán iguales, porque es inmutable; la de una poligonal, con
  lo que tenga al abrirla; y la portada tomará los datos que tenga el proyecto
  en ese momento.

### 10. Exportar a Excel (§ 4.8)

- Abrir un proceso (por ejemplo la poligonal **Cuadrado oficial**) y usar
  **Exportar a Excel**, en la cabecera de su pantalla.
- ✓ Descarga un `.xlsx` con tres hojas: «Datos Crudos», «Cálculos» y
  «Resumen» (con los datos del proyecto), con los códigos de punto —no
  UUIDs—, los decimales del dominio y la precisión relativa como `1:n` (aquí
  `1:∞`). En una poligonal, «Resumen» trae además el orden alcanzado
  (Primer orden) y el tipo de ángulo detectado, y no tiene fecha ni
  responsable de cierre.
- ✓ En un control de asentamientos (por ejemplo **Edificio Norte**) el libro
  lleva una cuarta hoja, «Libretas».
- ✓ En **El Verjón — ida y vuelta** (Proyecto de ejemplo), «Resumen» trae la
  discrepancia ida/vuelta (5.0 mm), su tolerancia (10.5 mm) y «¿Cumple la
  discrepancia?» Sí.
- ✓ Un proceso en borrador (por ejemplo, la copia que deja **Duplicar**)
  exporta con las celdas de resultado vacías, sin romper el libro.

## Resultado esperado

Si los puntos pasan, la generación de informes y la exportación cumplen los
criterios de la fase 6 y de sus revisiones: elegibilidad de las poligonales
calculadas y de lo demás cerrado (Fase 35, criterio l: una poligonal que no
cumple entra y su informe lo alerta), orden de secciones, ruta imprimible
reproducible (las secciones se reconstruyen al abrirla, las de lo cerrado a
partir de procesos inmutables, y la portada queda congelada al emitir, Fase
23), informes que no se editan —se eliminan y se regeneran—, el informe propio
de cada proceso, sin registro de cierre para las poligonales, gráfica de
asentamientos accesible y export a Excel con el vocabulario del dominio.
