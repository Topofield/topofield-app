# Plantillas de verificación

## `poligonales.xlsx`

Libro de Excel con las mismas fórmulas que el módulo poligonal de la app
(`src/lib/calculations/polygonal.ts`). Sirve para verificar a mano cualquier
caso real y compararlo contra el resultado de la app.

Generador: `scripts/build-poligonal-excel.mjs`. Si las fórmulas cambian,
re-ejecutar `node scripts/build-poligonal-excel.mjs` y commitear el `.xlsx`
actualizado.

### Tres hojas

- **Cerrada** — pentágono de 5 vértices precargado (Caso 1 del marco teórico
  `mt-poligonales.docx`). Incluye verificación angular, cierre lineal y los tres
  métodos de corrección (Bowditch, Tránsito, Crandall) lado a lado.
- **Abierta con control** — tramo de enlace simple (3 estaciones). Verificación
  por cierre lineal contra punto de llegada conocido.
- **Abierta sin control** — Caso 3 del marco teórico (4 estaciones,
  reconocimiento). Solo encadena coordenadas; no admite corrección.

### Convención del libro (idéntica a la de la app)

- `startAzimuth` es el **azimut del primer lado**, no una dirección de
  referencia previa.
- En cada fila de la tabla de estaciones, la **distancia** es la del lado que
  sale de esa estación. La última fila no tiene distancia.
- En cerrada el ángulo es interno; en las abiertas es la deflexión o el ángulo
  horizontal medido en la estación.

> ⚠️ El documento marco teórico (`docs/marco-teorico/mt-poligonales.docx`)
> presenta los datos del Caso 2 con un layout ligeramente distinto: pone la
> distancia y la deflexión en la fila de la estación de llegada. Para reproducir
> ese caso en la app o en este Excel, hay que desplazarlos una fila hacia
> arriba (a la fila de la estación de salida). Ver § "Convención" del reporte
> `docs/math/poligonales.html`.

### Uso

1. Abre el libro en Excel, LibreOffice Calc o Google Sheets.
2. En la hoja del tipo de poligonal que corresponda, reemplaza los datos
   precargados por los del caso real (no toques las celdas con fórmulas: están
   sombreadas en gris claro).
3. Compara los valores calculados con los del editor de la app para el mismo
   proceso.
