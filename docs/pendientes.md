# Pendientes

Peticiones recogidas que **no** tienen fase abierta todavía. Cada una se
convierte en fase —o entra en una ya planificada— cuando le llegue el turno,
siguiendo el ciclo de [`method.md`](./method.md).

No es un backlog de ideas: es lo que el usuario ya pidió explícitamente y está
esperando. Lo que se descarta se borra de aquí, con su razón anotada en el PRD
que lo descartó.

---

## Poligonales

### P1 · Captura de ángulos en grados decimales

Hoy los ángulos se capturan solo en DMS (`DmsInput`, tres casillas). Se necesita
poder digitarlos también en **grados decimales**, con las dos opciones
disponibles.

- El almacenamiento no cambia: `CLAUDE.md` fija que los ángulos van a la base
  como tres campos (`deg`, `min`, `sec`). Esto es una alternativa de **entrada**,
  no de modelo.
- `angles.ts` ya tiene `dmsToDecimal` y `decimalToDms`, así que la conversión
  existe. Lo que falta es el componente y dónde se recuerda la preferencia: por
  proceso, por usuario, o un conmutador de la celda.
- Afecta a la captura de lecturas múltiples de la Fase 7: si un ángulo se teclea
  en decimal, sus N lecturas también.

---

## Nivelación

### N1 · Renombrar vista atrás y vista adelante

La nomenclatura actual no es la que usa el topógrafo:

| Hoy | Debe ser |
|---|---|
| Vista atrás | **Vista más** (`b+` / `B+`) |
| Vista adelante | **Vista menos** (`b−`) |

Es coherente con el cálculo: la vista más se suma a la cota para obtener la
altura del instrumento, y la vista menos se resta. Toca la tabla de captura, el
panel de resultados, el export, el informe y el manual en sus dos copias.

### N2 · Taquimetría: distancia por los tres hilos

Con **nivel automático**, la distancia se obtiene leyendo los tres hilos
estadimétricos sobre la mira, sin cinta:

```
D = (HS − HI) · K        con K = 100 en instrumentos modernos
```

`HS` es el hilo superior y `HI` el inferior, en metros. No hace falta la
corrección por `cos²α` que llevaría un teodolito inclinado: en un nivel la
visual es horizontal por construcción.

**Validación que esto regala:** el hilo medio debe ser el promedio de los otros
dos, `m = (HS + HI)/2`. Si no cuadra dentro de la tolerancia de lectura, hay un
error de lectura o de transcripción. Es el mismo tipo de control que la
dispersión entre lecturas de la Fase 7.

Con **nivel electrónico / digital** el instrumento ya entrega la distancia, así
que no se leen hilos: se teclea o se importa el valor.

Esto conecta con la Fase 8: `level_type` (`automatico` | `digital`) es
justamente el campo que decide si la celda pide tres hilos o una distancia.

### N3 · Sumatoria automática de distancias

Hoy la suma de las distancias del recorrido no se genera sola. Debe calcularse
automáticamente a partir de las distancias por tramo, vengan de taquimetría o
del instrumento.

Importa más de lo que parece: `leveling_processes.total_distance_km` alimenta la
tolerancia de cierre `K·√D`. Si ese número se teclea a mano, la tolerancia
depende de un dato que nadie verifica.

---

## Control de asentamientos

### A1 · Alerta por lectura desfasada de la tendencia

Se necesita avisar cuando una lectura **se aleja mucho de la tendencia** del
punto: un valor atípico que probablemente sea error de lectura y no
asentamiento real.

Es distinto de los umbrales que ya existen. Los umbrales de velocidad y
acumulado (`sites.velocity_*`, `sites.accumulated_*`) miden **cuánto** se movió
el punto; esto mide si la **serie** es coherente consigo misma. Un punto puede
estar dentro de todos los umbrales y traer una campaña obviamente mal leída.

Queda por decidir el criterio —residuo contra la tendencia de las campañas
anteriores, y con qué margen— y si avisa o bloquea. Precedente aplicable: en
esta aplicación los controles de calidad de captura avisan, no bloquean.

### A2 · Estado de los BMs (dar de baja y dar de alta)

Los puntos que se miden se llaman **BMs**, y su conjunto no es fijo:

- Un BM **desaparece** —se destruye, se tapa, se pierde— y hay que dejar de
  medirlo sin borrar su historia, que sigue siendo válida hasta esa fecha.
- Hacen falta **BMs nuevos** incorporados a mitad del monitoreo, cuya línea base
  es su primera medición, no la campaña 0 del lugar.

Dos operaciones, entonces: dar de baja y dar de alta. La palabra está por
decidir —«desactivar», «dar de baja», «retirado»— pero **no** puede ser un
borrado: eliminar la fila se llevaría las lecturas históricas por cascada, y con
ellas la serie que justifica el monitoreo.

Consecuencias a resolver cuando se abra: qué hace `computeHistory` con un BM
retirado a media serie, qué muestra la gráfica, y si el informe lo lista.
