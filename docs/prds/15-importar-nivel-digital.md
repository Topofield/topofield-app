# PRD-de-fase 16 — Importar lecturas de nivel digital

**Estado:** cerrada
**Fecha de apertura:** 2026-09-24
**Fecha de cierre:** 2026-09-24

**Rama:** `fase-16-importar-nivel-digital`
**Petición:** N4 de [`pendientes.md`](../pendientes.md)
**Archivo de referencia:** [`carteras/CRDUDO-TRAMO2.L`](../carteras/CRDUDO-TRAMO2.L),
analizado en [`carteras/analisis-crudo-nivel-digital.md`](../carteras/analisis-crudo-nivel-digital.md)
**Módulo:** nivelación

> **Divergencias de la implementación:**
>
> - **La plantilla no es un archivo estático.** Se descarga desde el diálogo
>   generada de `CSV_TEMPLATE`, la misma constante que prueban los tests: un
>   `public/plantillas/nivelacion.csv` sería una segunda copia que podía
>   divergir. Y sin la «línea de explicación»: el lector la rechazaría como
>   fila. La explicación está en el diálogo y en el manual.
> - **La forma intermedia** lleva `rawSights` y `declared` (la división y los
>   tipos que declara la plantilla), no previstos. `declared` manda también
>   cuando la plantilla **no** trae vuelta: un circuito corto A → B → A
>   «vuelve» a A y la detección lo tomaba por ida y vuelta. Se vio en pantalla.
> - **La vuelta se propone por defecto** cuando el archivo la trae o se
>   detecta; el usuario elige igual (decisión 2).
> - **La ruta de crear con lecturas se verificó en pantalla, no con un test**:
>   es E/S de Server Actions, la deuda que la § 11 de la doc técnica ya
>   registra. Si guardar las lecturas falla, se borra el proceso recién
>   creado.
> - **No había procesos cerrados afectados por el hallazgo 3** en la base
>   local. La nube no se revisó: no hay acceso desde esta sesión.
> - El resumen del diálogo se apila en móvil.

## Propósito

Un nivel digital entrega en un archivo la lectura y la distancia de cada
visual. Teclearlas a mano es transcribir lo que ya está en digital, con el
riesgo de error que eso trae. Esta fase deja **subir el archivo**, lo
convierte en filas de libreta y las muestra en una **previsualización
editable** antes de que entren al proceso.

El modelo no cambia: el modo `digital` de la Fase 9 ya captura lectura y
distancia sin hilos. N4 añade una puerta de entrada, no un modelo.

## Hallazgos que condicionan la fase

### 1. El crudo, leído con la redondez de la libreta

El análisis del crudo verificó el formato contra su línea `W`. Aquí se
rehízo el cálculo con lo que la libreta **guarda**: cada visual es el
promedio de sus dos repeticiones, redondeado a la resolución de sus columnas
(`decimal(6,4)` para la lectura, `decimal(8,3)` para la distancia).

| Recorrido | Armadas | Desnivel | Distancia |
|---|---|---|---|
| Ida C10 → C18 | 1-8 | +1.1636 m | 698.839 m |
| Vuelta C18 → C10 | 9-16 | −1.1640 m | 698.449 m |
| Circuito completo | 1-16 | −0.0004 m | 1397.288 m |

La línea `W` declara −0.0002 m y 1397.284 m. La diferencia es el redondeo de
promediar, del mismo orden que el que ya explicaba el análisis.

### 2. Dos formas de leer el mismo archivo

El recorrido va de C10 a C18 y **vuelve por los mismos puntos**. Admite dos
lecturas, y las dos existen en campo:

- **Un recorrido cerrado** de 16 armadas, C10 → C18 → C10. Cierra contra la
  cota de C10 con −0.4 mm y una tolerancia de 12·√1.397 = 14.18 mm.
- **Ida y vuelta**: armadas 1-8 a la ida y 9-16 a la vuelta. La discrepancia
  entre los dos desniveles es 0.4 mm, contra una tolerancia de
  12·√0.698·√2 = 14.18 mm.

El archivo no dice cuál es. Decide el usuario (decisión 2).

### 3. El motor arranca mal la vuelta de una nivelación abierta

`computeLeveling` hace `returnStart = known ?? input.startElevation`: sin
cota de llegada conocida (tipo `open`), la vuelta arranca en la **cota de
partida** y no en la cota a la que llegó la ida. En el crudo leído como ida y
vuelta, todas las cotas de la vuelta saldrían **1.1636 m** más bajas: la
vuelta empieza en C18, que está a 2542.9181, no a 2541.7545.

La discrepancia no se ve afectada, porque compara desniveles, pero las cotas
mostradas, guardadas, impresas y exportadas de la vuelta sí. El caso ya
existía —una abierta con vuelta se puede crear a mano—, pero leer el crudo
como ida y vuelta lo vuelve el caso normal. **Se corrige en esta fase**: la
vuelta de una abierta parte de la cota final calculada de la ida.

### 4. El archivo no trae el tipo de punto

El instrumento no distingue un BM, un punto de cambio o una radiación, y la
cadena de la Fase 9 depende de ese dato. Se deduce de la posición en el
recorrido y el usuario lo confirma en la previsualización (decisión tomada
en N4).

## Decisiones

Las tres primeras las tomó el usuario al abrir la fase. Las demás vienen de
N4, que ya las había fijado.

| # | Decisión | Razón |
|---|---|---|
| 1 | Se importa **en los dos sitios**: en el editor de una nivelación no cerrada y al crear una nueva | Decisión del usuario. Las dos puertas comparten la lectura y la previsualización |
| 2 | **El usuario elige** en la previsualización: un recorrido, o ida y vuelta. Con ida y vuelta, elige **en qué armada gira**; se propone la detectada | Decisión del usuario. Detectar sin preguntar sería adivinar (hallazgo 2) |
| 3 | La **cota del BM** del archivo se **propone**: si el proceso no tiene cota de partida, la toma; si tiene otra, la previsualización muestra las dos y el usuario elige | Decisión del usuario |
| 4 | **Detector con lectores intercambiables**: cada lector reconoce su formato por el **contenido**, no por la extensión, y todos desembocan en una forma intermedia única | Añadir Trimble o Topcon es escribir un lector y registrarlo, sin tocar la previsualización ni la libreta |
| 5 | Dos formatos de salida: el **`.L` de Leica** y una **plantilla CSV** propia, descargable | Quien traiga un instrumento que no sabemos leer tiene una salida. Si nada reconoce el archivo, el mensaje dice qué formatos se entienden y ofrece la plantilla |
| 6 | Las **repeticiones se promedian** y se guarda una lectura, redondeada a la columna | Es lo que admite la libreta. La σ del instrumento se pierde; la previsualización muestra la mayor dispersión entre repeticiones y la mayor σ, como información |
| 7 | El **tipo de punto se deduce** y se confirma: la primera y la última fila de cada recorrido son BM; con V+ y V− es punto de cambio; solo con V− es radiación | Deducir sin confirmar sería adivinar; pedirlo todo a mano, renunciar a la comodidad de importar |
| 8 | Importar **no guarda**: llena la libreta y la configuración en el editor, y el usuario guarda como siempre. Al crear, se crea el proceso con sus lecturas en una sola acción | En el editor, el flujo de guardado y validación ya existe y no se duplica. Al crear no hay borrador que llenar |
| 9 | Importar **pone el modo `digital`** y propone el tipo de proceso: un recorrido que vuelve a su BM de partida es **cerrada**; ida y vuelta es **abierta con vuelta** | El archivo es de un nivel digital. Con ida y vuelta, la cerrada calcularía el cierre de la ida contra C10 y fallaría por 1.16 m. El usuario puede cambiar el tipo después |
| 10 | La importación **reemplaza** las lecturas del proceso, con aviso si ya tenía | Mezclar lecturas de un archivo con otras tecleadas no tiene un orden obvio |
| 11 | El archivo **no se guarda** | El producto no busca aún trazabilidad estricta. Tras importar, las lecturas son de la libreta como cualquier otra |

## Los formatos

### `.L` de Leica

Ancho fijo, CRLF, offsets medidos en el análisis del crudo. Se reconoce
porque la primera línea es de tipo `B` y las siguientes son `G`/`I` con las
columnas en su sitio.

- `B`: punto y cota de partida.
- `G` / `I`: visual atrás / adelante. De cada una: lectura, distancia,
  número de armada, σ y punto. El sufijo `B1`/`B2`/`F1`/`F2` numera las
  repeticiones.
- `W`: resumen. Se lee para mostrarlo, no para calcular.

Otra letra de línea se ignora con un aviso que dice cuántas.

### Plantilla CSV de TopoField

Una fila por fila de libreta, como la tabla de captura:

```
recorrido,punto,tipo,v_mas,v_menos,dist_mas,dist_menos
ida,C10,bm,1.6490,,48.843,
ida,C11,,1.7122,1.5261,42.218,46.853
```

- `recorrido`: `ida` o `vuelta`. `tipo` es opcional: vacío, se deduce.
- Separador `,` o `;`. Con `;` se acepta **coma decimal**, que es lo que
  exporta Excel en español.
- Primera fila de cabeceras, obligatoria y con esos nombres: es lo que
  distingue la plantilla de un CSV cualquiera.

## Forma intermedia

```ts
interface ImportedLevelingFile {
  format: "leica-l" | "topofield-csv";
  startPoint: { code: string; elevation: number | null } | null;
  /** Una armada: la visual atrás, las adelante (la última es la del punto de
   *  cambio; las demás, radiaciones). */
  setups: { back: Sight; fores: Sight[] }[];
  quality: { maxRepeatSpreadMm: number | null; maxSigmaMm: number | null };
  instrumentSummary: { heightDifference: number; distance: number } | null;
  warnings: string[];
}
interface Sight { point: string; reading: number; distance: number | null }
```

La plantilla CSV trae filas de libreta, no armadas: su lector las pasa a
armadas para que las dos entradas converjan. De la forma intermedia a la
libreta hay una sola función, con el modo (un recorrido, o ida y vuelta con su
armada de giro) como parámetro.

## Superficie

### Previsualización (común)

- Formato reconocido, armadas y visuales leídas, repeticiones promediadas y
  la calidad (mayor dispersión entre repeticiones y mayor σ).
- Elección **un recorrido / ida y vuelta**. Con ida y vuelta, un selector de
  la armada de giro, con la detectada por defecto: la armada donde el
  recorrido empieza a volver sobre sus puntos.
- Cota de partida: la del archivo y la del proceso, si difieren (decisión 3).
- La libreta resultante por recorrido, con el **tipo de punto editable**.
- El tipo de proceso que se propondrá y el paso a modo `digital`.
- Avisos: líneas ignoradas; el proceso ya tenía lecturas (se reemplazan).

### Editor

Botón **«Importar desde archivo»** junto a la libreta, en un proceso no
cerrado. Al aceptar la previsualización, se llenan la libreta y la
configuración, y queda la marca de cambios sin guardar.

### Nueva nivelación

Un paso opcional **«Desde archivo»** en el formulario. Al aceptar, se
rellenan el BM de partida, su cota, el tipo, la vuelta y el modo; el usuario
completa el resto —nombre, orden, equipo— y crea el proceso con sus lecturas.

### Plantilla

Enlace **«Descargar plantilla CSV»** en la previsualización y en el mensaje de
formato no reconocido: un archivo estático con las cabeceras, dos filas de
ejemplo y una línea de explicación.

## Archivos

| Archivo | Qué cambia |
|---|---|
| `src/lib/import/leveling/` | Nuevo, puro: forma intermedia, lectores (`leica-l.ts`, `topofield-csv.ts`), detector y paso a libreta |
| `src/lib/calculations/leveling.ts` | La vuelta de una abierta parte de la cota final de la ida (hallazgo 3) |
| `src/components/leveling/import-dialog.tsx` | Nuevo: subida y previsualización |
| `src/components/leveling/leveling-editor.tsx` · `new-leveling-form.tsx` | Las dos puertas |
| `src/app/(app)/projects/[id]/leveling/new/actions.ts` | Crear con lecturas |
| `public/plantillas/nivelacion.csv` | La plantilla |
| `docs/carteras/analisis-crudo-nivel-digital.md` | Remite a esta fase |
| Manual (dos copias), guion de pruebas, doc técnica | Como en cada fase |

## Pruebas

**Suite existente:** 652 tests.

**Valores esperados** (el crudo, promediado y redondeado a las columnas):

| Qué | Valor |
|---|---|
| Armadas · visuales | 16 · 64, promediadas a 32 |
| Primera fila | C10, V+ 1.6490, dist+ 48.843 |
| Última fila | C10, V− 1.7206, dist− 46.983 |
| Ida (1-8) | Δ +1.1636 m · 698.839 m · C18 = 2542.9181 |
| Vuelta (9-16) | Δ −1.1640 m · 698.449 m |
| Discrepancia | 0.4 mm · tolerancia 14.18 mm (tercer orden) |
| Un recorrido | Cierre −0.4 mm · 1397.288 m · tolerancia 14.18 mm |
| Calidad | Mayor dispersión entre repeticiones 1.5 mm · mayor σ 2.3 mm |
| Armada de giro detectada | 9 |

**Nuevas, como mínimo:**

| Qué | Casos |
|---|---|
| Lector Leica | El crudo real, leído del archivo del repositorio: armadas, puntos, promedios redondeados y cabecera. Un `.L` recortado o con una línea desconocida da avisos, no una excepción |
| Detector | Reconoce el `.L` y la plantilla por el contenido, aunque se renombren; un archivo cualquiera da el mensaje con los formatos admitidos |
| Plantilla CSV | `,` y `;`, coma decimal, `tipo` vacío deducido, filas de ida y de vuelta |
| Paso a libreta | Un recorrido y ida y vuelta con los valores de la tabla, pasando por `computeLeveling`. Tipos deducidos. Radiación: una visual adelante que no es la del punto de cambio |
| Motor | Abierta con vuelta: la vuelta parte de la cota final de la ida (C18 = 2542.9181), y el caso cerrado y el enlazado no cambian |
| Ruta | La acción de crear con lecturas guarda lo que la previsualización mostró |

**En pantalla, antes de cerrar:**

1. Importar el crudo en el editor como **un recorrido**: la libreta, el cierre
   −0.4 mm y el tipo cerrada.
2. Importarlo como **ida y vuelta**, girando en la armada 9: las dos
   libretas, la discrepancia 0.4 mm y las cotas de la vuelta desde 2542.9181.
3. La cota del BM distinta de la del proceso: la elección.
4. Crear una nivelación **desde archivo**.
5. Un archivo no reconocido: el mensaje y la plantilla.
6. La plantilla rellenada con coma decimal.
7. La ruta `/manual`.

## Criterios de aceptación

1. El crudo real se importa en el editor y al crear, y reproduce la tabla de
   valores esperados.
2. El usuario elige un recorrido o ida y vuelta, y la armada de giro.
3. El tipo de punto se deduce y se puede corregir antes de aceptar.
4. La cota del archivo se propone y, si difiere, se elige.
5. Un formato no reconocido dice cuáles se entienden y ofrece la plantilla.
6. La plantilla CSV se descarga, y rellenada se importa.
7. La vuelta de una abierta parte de la cota final de la ida.
8. Importar en el editor no guarda: se guarda como siempre.
9. `npm run typecheck`, `npm run lint` y `npm test` pasan limpios, con los
   tests nuevos sumados a los 652.
10. Manual en sus dos copias, en el mismo commit, con capturas regeneradas.
11. Doc técnica actualizada, con la tabla de pruebas regenerada desde la
    ejecución.
12. Guion de pruebas de nivelación con la importación.

## Fuera de alcance

- **Modelar las repeticiones y su σ** en la libreta: es un cambio del modelo
  de nivelación, candidato a fase propia (lo que la Fase 7 hizo para
  poligonales).
- **N6**, el control por puntos homólogos: el crudo lo confirma por segunda
  vez, pero es otra petición.
- **Otros instrumentos** (Trimble, Topcon, GSI de Leica): la arquitectura los
  admite, pero no hay archivos para probarlos.
- **Guardar el archivo** o su procedencia (decisión 11).
- **Importar a un proceso cerrado**, o añadir lecturas a las existentes
  (decisión 10).

## Riesgos

- **Otro `.L` de otro modelo Leica con otras columnas.** Solo hay un archivo
  de muestra. Mitigación: el lector comprueba la forma de cada línea y avisa,
  y la previsualización deja ver lo leído antes de aceptarlo.
- **El giro detectado no es el real** cuando la vuelta no reocupa los puntos.
  Mitigación: se propone, no se impone, y el selector deja elegir.
- **Corregir el motor cambia cotas de vuelta ya guardadas** en abiertas con
  vuelta. Las no cerradas se recalculan al guardar. Las cerradas conservan las
  que tenían, que eran erróneas: se buscan en la base al implementar y, si hay,
  se anota en la doc técnica.
