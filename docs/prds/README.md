# PRDs por fase

Esta carpeta contiene los **PRDs detallados de cada fase** del desarrollo de TopoField. Cada uno se redacta **justo antes** de implementar su fase, no antes. El método completo está en [`../method.md`](../method.md).

## Índice de fases

| # | Fase | Archivo | Estado |
|---|---|---|---|
| 1 | Setup técnico | `00-setup.md` | cerrada |
| 2 | Dashboard y Proyectos | `01-dashboard-proyectos.md` | cerrada |
| 3 | Módulo Poligonal | `02-poligonal.md` | cerrada |
| 4 | Módulo Nivelación | `03-nivelacion.md` | cerrada |
| 5 | Control de Asentamientos | `04-asentamientos.md` | cerrada |
| 6 | Cierre, Informes, Export | `05-cierre-informes-export.md` | cerrada |
| 7 | Motor y captura de poligonales | `06-motor-captura-poligonal.md` | cerrada |
| 8 | Precisión y equipo por proceso | `07-precision-equipo-por-proceso.md` | cerrada |
| 9 | Cadena de distancias de nivelación | `08-cadena-distancias-nivelacion.md` | cerrada |
| 10 | Nomenclatura de nivelación | `09-nomenclatura-nivelacion.md` | cerrada |
| 11 | Estado de los BMs | `10-estado-bms.md` | cerrada |
| 12 | Alerta por lectura desfasada | `11-lectura-desfasada.md` | cerrada |
| 13 | Canvas de poligonal | `12-canvas-poligonal.md` | cerrada |
| 14 | Ajuste por mínimos cuadrados | `13-minimos-cuadrados.md` | cerrada |
| 15 | Georreferenciación de levantamientos | `14-georreferenciacion.md` | cerrada |
| 16 | Importar lecturas de nivel digital | `15-importar-nivel-digital.md` | cerrada |
| 17 | Control ida-vuelta por puntos homólogos | `16-homologos-ida-vuelta.md` | cerrada |
| 18 | Libreta de nivelación y panel de asentamientos | `17-libreta-panel-asentamientos.md` | cerrada |
| 19 | Equilibrado por armada y compensación desde el origen | `18-equilibrado-y-compensacion.md` | cerrada |
| 20 | Identidad visual del prototipo y coma decimal | `19-identidad-visual-coma-decimal.md` | cerrada |
| 21 | La demo con las carteras reales | `20-demo-carteras-reales.md` | cerrada |
| 22 | El proceso en una pantalla | `21-proceso-en-una-pantalla.md` | cerrada |
| 23 | Integridad | `22-integridad.md` | cerrada |
| 24 | Pulido | `23-pulido.md` | cerrada |
| 25 | Catálogo de equipos | `24-catalogo-equipos.md` | cerrada |
| 26 | Correcciones del cálculo | `25-correcciones-calculo.md` | cerrada |
| 27 | Segundo pulido | `26-segundo-pulido.md` | cerrada |
| 28 | Ida y vuelta en la compensación | `27-desnivel-adoptado.md` | cerrada |
| 29 | Puntos de control sin posición | `28-puntos-sin-posicion.md` | cerrada |
| 30 | Estabilidad de los BMs | `29-estabilidad-bms.md` | cerrada |
| 31 | Avisos del cálculo | `30-avisos-del-calculo.md` | cerrada |
| 32 | Rigor estadístico | `31-rigor-estadistico.md` | cerrada |
| 33 | Header compacto | `32-header-compacto.md` | cerrada |
| 34 | Reabrir procesos | `33-reabrir-procesos.md` | cerrada |
| 35 | La poligonal como la mide el topógrafo | `34-ux-poligonal.md` | cerrada |
| 36 | La nivelación como la mide el topógrafo | `35-ux-nivelacion.md` | cerrada |
| 37 | Los asentamientos como los mide el topógrafo | `36-ux-asentamientos.md` | cerrada |
| 38 | El informe de cada proceso | `37-informe-por-proceso.md` | cerrada |
| 39 | Mínimos cuadrados: requisitos y precisión de cada punto | `38-precision-minimos-cuadrados.md` | cerrada |
| 40 | Informes entregables | `39-informes-entregables.md` | cerrada |
| 41 | El dibujo de la poligonal como un mapa | `40-visor-poligonal.md` | cerrada |
| 42 | El manual por capítulos | `41-manual-por-capitulos.md` | cerrada |

Estados: `pendiente` (sin redactar) · `en curso` (redactado, en implementación) · `cerrada` (criterios cumplidos, fase entregada).

Al cerrar una fase se actualizan también los documentos de handoff:
[`docs/tecnica/`](../tecnica/README.md) y [`docs/manual/`](../manual/README.md).

Las peticiones recogidas que **todavía no tienen fase** viven en
[`../pendientes.md`](../pendientes.md).

## Cómo leer esto

- ¿Vas a empezar a trabajar en algo? Lee primero [`../method.md`](../method.md) y luego el PRD de la fase actual.
- ¿No existe el archivo del PRD de tu fase? Significa que aún no se ha redactado. Hay que abrirlo siguiendo el ciclo descrito en `method.md` antes de tocar código de esa fase.
- ¿Hay un PRD pero `method.md` lo marca `cerrada`? Es histórico, no se modifica.
