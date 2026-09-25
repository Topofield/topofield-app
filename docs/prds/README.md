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
| 21 | La demo con las carteras reales | `20-demo-carteras-reales.md` | en curso |

Estados: `pendiente` (sin redactar) · `en curso` (redactado, en implementación) · `cerrada` (criterios cumplidos, fase entregada).

Al cerrar una fase se actualizan también los documentos de handoff:
[`docs/tecnica/`](../tecnica/README.md) y [`docs/manual/`](../manual/README.md).

Las peticiones recogidas que **todavía no tienen fase** viven en
[`../pendientes.md`](../pendientes.md).

## Cómo leer esto

- ¿Vas a empezar a trabajar en algo? Lee primero [`../method.md`](../method.md) y luego el PRD de la fase actual.
- ¿No existe el archivo del PRD de tu fase? Significa que aún no se ha redactado. Hay que abrirlo siguiendo el ciclo descrito en `method.md` antes de tocar código de esa fase.
- ¿Hay un PRD pero `method.md` lo marca `cerrada`? Es histórico, no se modifica.
