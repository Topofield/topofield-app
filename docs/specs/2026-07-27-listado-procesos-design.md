# Listado de procesos — búsqueda, filtros y densidad

**Fecha:** 2026-07-27
**Alcance:** hub del proyecto, pestaña «Procesos». Continúa el trabajo de
`2026-07-27-review-ui-ux-design.md`.
**Naturaleza:** mejora de UX sobre funcionalidad ya entregada.

---

## 1. Evidencia

El diagnóstico anterior se hizo con 7 procesos de seed, un volumen que no revela
los problemas de escala. Para esta spec se sembraron 34 procesos temporales
(41 en total, eliminados tras la medición) y se midió el hub resultante.

Resultado con 41 procesos, en viewport de 1440×900:

| Métrica | Valor |
|---|---|
| Alto de página | 3.713 px |
| Pantallas de scroll | 4,1 |
| Buscador | no existe |
| Filtros | no existen |

## 2. Diagnóstico

### 2.1 La agrupación fija pelea con la tarea

Las cuatro secciones por estado (`Borradores`, `Calculados`, `Cerrados`,
`Rechazados`) imponen un orden de lectura único. Un topógrafo que trabaja en
varios levantamientos a la vez no piensa por estado, sino por levantamiento: los
procesos de una misma manzana quedan repartidos entre secciones separadas por
más de 1.500 px de scroll.

La agrupación resuelve un problema real —distinguir desenlaces opuestos, que era
el objetivo de la spec anterior— pero lo resuelve como estructura rígida en vez
de como filtro.

### 2.2 Las tarjetas desperdician espacio vertical

Cada tarjeta ocupa unos 70 px de alto para mostrar cuatro datos: tipo, nombre,
precisión y fecha. En una rejilla de dos columnas, 41 procesos generan 3.700 px.

Una fila de tabla presenta la misma información en unos 40 px y, además, alinea
las precisiones en columna. La tipografía monoespaciada tabular que ya se
implementó existe precisamente para permitir esa comparación vertical; en la
rejilla de tarjetas no se aprovecha.

### 2.3 Falta el dato que decide

La tarjeta muestra «Precisión 1:4747», pero no si ese valor cumple el orden de
precisión exigido por el proyecto. El topógrafo debe abrir cada proceso para
saberlo. El veredicto de tolerancia —que la spec anterior identificó como el
producto de la aplicación— no está en el listado.

### 2.4 El orden por defecto ignora la actividad

El listado ordena por `created_at`. Un proceso creado hace un mes y editado ayer
aparece al fondo. La columna `updated_at` ya existe en la tabla y se mantiene
mediante el trigger `polygonal_processes_set_updated_at`, así que el dato está
disponible y no se usa.

### 2.5 No hay acciones sin abrir el proceso

Renombrar, duplicar o eliminar exige entrar al editor. Duplicar no existe en
absoluto, pese a que levantamientos de una misma campaña comparten configuración
(punto de partida, tipo, método de corrección).

## 3. Decisiones

Tomadas con el usuario:

| Eje | Decisión |
|---|---|
| Formato en escritorio | Tabla densa con columnas ordenables |
| Semáforo de tolerancia | Sí, columna dedicada |
| Orden por defecto | Actividad reciente (`updated_at`) |
| Acciones rápidas por fila | Sí: duplicar, renombrar, eliminar |
| Recordar filtros | Sí, entre visitas |

## 4. Diseño

### 4.1 Barra de control

Reemplaza los cuatro encabezados de sección por una barra persistente sobre el
listado:

```
┌─────────────────────────────────────────────────────────────┐
│  🔍 Buscar proceso…                          [+ Nuevo Proceso]│
│                                                               │
│  Todos (7)  Borradores (0)  Calculados (5)  Cerrados (1)      │
│  Rechazados (1)                         Tipo: Todos ▾         │
└─────────────────────────────────────────────────────────────┘
```

- **Búsqueda**: filtra por nombre, sin distinguir mayúsculas ni acentos. Filtrado
  en cliente sobre los procesos ya cargados; a la escala esperada de un proyecto
  (decenas, no miles) no justifica ida y vuelta al servidor.
- **Filtros de estado**: chips con conteo. El conteo comunica la distribución sin
  desplegar nada y elimina los mensajes «No hay borradores» que hoy ocupan
  espacio.
- **Filtro de tipo**: selector con los tres tipos de poligonal.

Los grupos de la spec anterior sobreviven como filtros, no como secciones.

### 4.2 Estado en la URL y persistencia

El estado de búsqueda y filtros vive en la URL
(`?q=&estado=&tipo=&orden=&dir=`), siguiendo el patrón que ya usa
`DashboardFilter` con `?status=`. Eso hace la vista compartible y recargable.

**Resolución del conflicto con «recordar filtros»:** la persistencia solo se
aplica cuando la URL no trae parámetros. Es decir:

- URL con parámetros → mandan los parámetros (enlace compartido, recarga).
- URL sin parámetros → se restaura el último filtro usado, guardado en
  `localStorage` por proyecto.

Sin esa regla, un enlace compartido mostraría los filtros de quien lo abre en vez
de los de quien lo envió.

Cuando se restaura un filtro persistido, la barra debe indicarlo de forma
visible: un filtro activo invisible es una fuente clásica de confusión
(«no aparece el proceso que acabo de crear»). El chip activo ya lo comunica; se
añade además un control «Limpiar filtros» cuando hay alguno aplicado.

### 4.3 Tabla densa en escritorio

Por encima de 768 px:

| Columna | Contenido | Ordenable |
|---|---|---|
| Proceso | Nombre + tipo como texto secundario | sí (alfabético) |
| Estado | Badge, con la variante ámbar de fuera de tolerancia | no |
| Precisión | Valor tabular monoespaciado | sí (numérico) |
| Cumple | Indicador ✓ / ✕ / — | no |
| Última actividad | Fecha relativa («hace 2 días») con fecha exacta en `title` | sí |
| — | Menú de acciones | no |

Por debajo de 768 px se conservan tarjetas, con el mismo patrón validado en la
tabla de estaciones: la tabla se oculta y las tarjetas toman su lugar.

**Ordenamiento numérico de precisión.** `relative_precision` se persiste como
texto ya formateado (`"1:1001"`), lo que impide ordenar numéricamente de forma
correcta: orden lexicográfico pondría `1:46` después de `1:1001`. El
ordenamiento debe extraer el valor numérico de la cadena antes de comparar, y
tratar `1:∞` como el valor máximo. Esta es una consecuencia directa de la deuda
ya registrada sobre el formato de persistencia; se resuelve aquí en la capa de
presentación, sin cambiar el esquema.

### 4.4 Semáforo de tolerancia

Columna «Cumple» con tres estados:

| Condición | Indicador | Significado |
|---|---|---|
| `meets_tolerance === true` | ✓ verde | Cumple el orden del proyecto |
| `meets_tolerance === false` | ✕ rojo | No cumple |
| `null` | — neutro | Sin verificación de cierre, o sin calcular |

El dato ya está en `meets_tolerance`, persistido por `saveProcess`. No requiere
recalcular ni duplicar la lógica de `verdictFor`: basta con leer la columna.

El indicador debe tener texto accesible, no solo color: el color por sí solo no
es un canal de información suficiente.

### 4.5 Acciones rápidas por fila

Menú por proceso con tres acciones:

- **Duplicar**: crea un proceso nuevo con la misma configuración (tipo, punto de
  partida, azimut, método de corrección) y sin estaciones, en estado `draft`. El
  nombre se sufija con «(copia)».
- **Renombrar**: edición del nombre sin abrir el editor.
- **Eliminar**: con diálogo de confirmación, siguiendo el patrón de
  `delete-project-dialog.tsx`.

**Restricción de inmutabilidad.** Los procesos `closed` y `rejected` son
inmutables: para ellos solo se ofrece **Duplicar**. Renombrar y eliminar quedan
ocultos, no deshabilitados — una acción visible pero inerte invita a intentarla.
Esta regla debe verificarse tanto en la interfaz como en las Server Actions: la
guarda de servidor es la que cuenta.

### 4.6 Orden por defecto

`updated_at` descendente, en lugar de `created_at`. La columna existe y se
mantiene sola mediante trigger.

La columna se muestra como fecha relativa, que comunica mejor la recencia que
una fecha absoluta, con la fecha exacta disponible en el atributo `title`.

## 5. Fuera de alcance

- Paginación o carga incremental. A la escala de un proyecto (decenas de
  procesos) el filtrado en cliente basta; introducir paginación ahora añadiría
  complejidad sin beneficio observable.
- Selección múltiple y acciones en lote.
- Búsqueda por contenido de estaciones o por rango de precisión.
- Cambiar el esquema de `relative_precision` a numérico: queda como deuda
  registrada para la fase 4, y esta spec la sortea en presentación.

## 6. Criterios de aceptación

1. El hub muestra un listado único, sin secciones fijas por estado.
2. La búsqueda por nombre filtra sin distinguir mayúsculas ni acentos.
3. Los chips de estado muestran el conteo de cada grupo y filtran el listado.
4. El estado de búsqueda, filtros y orden se refleja en la URL y sobrevive a una
   recarga.
5. Una URL con parámetros de filtro prevalece sobre el filtro persistido.
6. Cuando hay un filtro activo, la interfaz lo comunica y ofrece limpiarlo.
7. En ≥768 px se muestra una tabla; por debajo, tarjetas. Ninguna columna queda
   fuera de vista en 390 px.
8. La columna «Cumple» refleja `meets_tolerance` con indicador accesible que no
   dependa solo del color.
9. El ordenamiento por precisión es numérico: `1:46` ordena antes que `1:1001`, y
   `1:∞` queda en el extremo correspondiente.
10. El listado ordena por `updated_at` descendente por defecto.
11. Los procesos `closed` y `rejected` solo ofrecen «Duplicar»; renombrar y
    eliminar no aparecen. Las Server Actions rechazan ambas operaciones sobre
    procesos cerrados, aunque se invoquen directamente.
12. Duplicar crea un proceso `draft` sin estaciones y no modifica el original.
13. `npm run typecheck`, `npm run lint` y `npm run test` pasan.
