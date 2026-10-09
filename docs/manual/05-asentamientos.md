# Control de asentamientos

Cómo seguir el descenso de una estructura en el tiempo: crear el lugar, sus
puntos de control y sus BM, medir cada visita con la libreta y leer el panel.
El ejemplo es una cartera real: dieciséis puntos de un edificio y siete
visitas, de marzo a junio de 2022.

## Cómo se organiza

- **El lugar** es lo que se monitorea: un edificio, una presa, un terraplén.
  Tiene cuatro pestañas: **Panel**, **Puntos**, **BMs** e **Informe**.
- **Los puntos de control** son los que se miden en cada visita.
- **Los BM del lugar** son los puntos de cota conocida desde donde se nivela.
- **Cada visita** es una fecha en la que se releyeron los puntos. Tiene dos
  pasos: **1 · Libreta** y **2 · Resultados**. La primera visita es la **línea
  base** y lleva el número 0.

La visita **no se compensa**: la cota de cada punto es la de su lectura. Y nada
se cierra: si corrige un dato, todo lo que depende de él se recalcula.

## Crear el lugar

1. En el proyecto, pulse **+ Nuevo Proceso** y elija **Control de
   Asentamientos**.
2. Llene la ventana **Nuevo lugar**:
   - **Nombre**, el único obligatorio.
   - **Tipo de estructura**: edificio, presa, terraplén u otro. Carga los
     umbrales del semáforo típicos de esa estructura.
   - **Descripción**, opcional.
   - **Umbrales del semáforo**, plegados: puede ajustarlos si el caso lo pide.

   ![Ventana Nuevo lugar: nombre «Control de asentamiento estructural», tipo Edificio y la descripción](../../public/manual/asentamientos/01-nuevo-lugar.png)

3. Pulse **Crear lugar**. Se abre el lugar, todavía sin puntos.

   ![El lugar recién creado, con su cabecera, el botón + Nueva visita y las pestañas Panel, Puntos, BMs e Informe](../../public/manual/asentamientos/02-lugar-nuevo.png)

## Los puntos de control

1. Abra la pestaña **Puntos** y pulse **Agregar punto**.
2. Escriba el **Código** y la **Ubicación**. La **Cota C0** es opcional: si la
   deja vacía, la línea base del punto es su primera lectura.
3. Pulse **Guardar**. Repita por cada punto.

![Ventana Nuevo punto con el código A4(8-7A) y su ubicación](../../public/manual/asentamientos/03-nuevo-punto.png)

![La pestaña Puntos con los dieciséis puntos de la cartera, su ubicación, su C0 vacía y su estado Vigente](../../public/manual/asentamientos/04-puntos.png)

Los puntos no llevan coordenadas: el módulo mide cuánto baja cada punto, no
dónde está.

Cada punto tiene **Editar**, **Dar de baja** y **Eliminar**. Si cambia la C0 de
un punto ya medido, la aplicación le avisa en cuántas visitas cambia su
acumulado antes de guardar.

## Los BM del lugar

Cada lugar tiene sus propios BM. Son del lugar y no se sincronizan con nada.

1. Abra la pestaña **BMs** y pulse **+ BM**.
2. Escriba el **Código**, la **Cota (m)** y, si quiere, una descripción.
3. Pulse **Guardar**.

![Ventana Nuevo BM: PISCINA/BM con cota 156.299, el BM de la piscina](../../public/manual/asentamientos/05-nuevo-bm.png)

![La pestaña BMs con PISCINA/BM](../../public/manual/asentamientos/06-bms.png)

**Importar BM** los trae de una nivelación del proyecto (con su cota
ajustada) o de un archivo CSV con `codigo,cota,descripcion`. Los BM
importados son copias: si la nivelación cambia después, el BM no.

## Una visita

1. En la cabecera del lugar, pulse **+ Nueva visita**.
2. Escriba la **Fecha**, que tiene que ser posterior a la de la última visita,
   y el **Nivelador**. La **Nota** y el **equipo** son opcionales.
3. Pulse **Crear y empezar**.

![Ventana Nueva visita con la fecha 24 de marzo de 2022 y el nivelador](../../public/manual/asentamientos/07-nueva-visita.png)

La libreta llega **armada como la de la visita anterior**: las mismas armadas,
con sus BM y sus puntos, pero sin lecturas. La primera visita llega con una
armada desde el primer BM del lugar y todos los puntos. Solo queda escribir
las lecturas.

![La libreta de la primera visita, armada desde PISCINA/BM con los dieciséis puntos pendientes de leer](../../public/manual/asentamientos/08-libreta-plantilla.png)

## La libreta y la armada

1. Pulse **Retomar medición**, o **Editar** en la armada. Se abre su ventana.
2. En **Vista atrás · V+**, escriba la **Lectura** al BM. La distancia es
   opcional.
3. En **Vistas a los puntos**, escriba la lectura de cada punto. Cada lectura
   **se guarda al escribirla**: al salir del campo o con Enter, que además pasa
   al campo siguiente. Junto a cada una aparece su cota y un ✓ cuando quedó
   guardada.
4. En **Vista adelante · V−**, marque **Sin vista adelante** si la armada
   termina en los puntos, o escriba el punto, su lectura y su distancia.
5. Pulse **Terminar armada**.

![La armada de la primera visita: la V+ de 1.218 a PISCINA/BM y las dieciséis lecturas, cada una con su cota y su ✓](../../public/manual/asentamientos/09-armada.png)

Abajo, la ventana dice cuántos puntos van leídos. Los botones:

- **Seguir después** cierra la ventana. Lo leído ya está guardado; si falta
  algo, la visita queda **En medición**.
- **Terminar armada** la da por terminada.
- **Terminar y seguir…** termina y abre la armada siguiente.

> Una lectura fuera de 0 a 4 m no bloquea: la ventana avisa para que la
> revise. Una mira de 5 m da lecturas como 4.120.

**Varias armadas.** Si tuvo que cambiar el nivel de sitio, la vista adelante va
a un **punto de cambio** y la armada siguiente sale de él. Si la última vista
adelante cae en un BM del lugar, el tramo se **verifica**: la ventana muestra
el cierre y el orden alcanzado.

![La armada 2 de una visita de Torre Alameda: sale del punto de cambio CP-1 y vuelve a BM-1 con un cierre de −1.6 mm, segundo orden](../../public/manual/asentamientos/16-armada-punto-de-cambio.png)

![La libreta de una visita de Torre Alameda con dos armadas, por el punto de cambio CP-1, y el tramo que vuelve a BM-1](../../public/manual/asentamientos/15-dos-armadas.png)

## Importar la libreta

Con un nivel digital, **Importar .L o CSV**, a la derecha de los pasos, pasa a
la libreta el archivo **.L de Leica** o la **plantilla CSV**, como en la
nivelación. El archivo se lee como un solo tramo desde el BM de su primera
fila, que tiene que estar en los BM del lugar. Reemplaza la libreta de la
visita; si ya tenía lecturas, la ventana lo avisa.

## Cómo se calcula

La cota de cada punto sale de su lectura:

- **AI = cota del BM + V+**: la altura del instrumento de la armada.
- **Cota = AI − lectura** del punto.

Con la cota, la aplicación calcula al momento:

- **Parcial**: cuánto bajó (o subió) el punto desde la visita anterior, en mm.
- **Acumulado**: cuánto ha bajado desde su línea base, en mm.
- **Velocidad**: el parcial dividido por los **días reales** entre las dos
  visitas, en mm/mes.
- **Estado**: el semáforo del punto (vea [El panel del lugar](#el-panel-del-lugar)).

Un valor positivo es un **levantamiento** y se muestra como tal.

**La verificación de un tramo.** Si el tramo vuelve a su BM, su cierre se
compara con la tolerancia de cada orden. Si termina en sus puntos, como en esta
cartera, dice **Sin verificación**.

**Un BM leído de paso.** Si la libreta pasa también por otro BM del lugar, la
aplicación compara la cota medida con la suya. Si no coinciden, avisa: uno de
los dos BM pudo moverse.

![Visita 13 de Torre Alameda: BM-2 leído de paso da +7.4 mm, y el aviso «BM-2 no nivela con BM-1»](../../public/manual/asentamientos/17-bm-desplazado.png)

**Lecturas fuera de tendencia.** Desde la tercera lectura de un punto, la
aplicación avisa si una lectura va contra su tendencia o lo mueve mucho más
de lo que su ritmo preveía. En esta cartera, B10 baja 50 mm en 12 días donde su
ritmo preveía unos 17: la libreta lo avisa para que revise la lectura.

![Libreta de la visita 2 (12 de abril de 2022), con las lecturas de más de 4 m y el aviso «B10 bajó 50.0 mm en 12 días; a su ritmo anterior serían unos 17.1 mm»](../../public/manual/asentamientos/10-libreta-con-aviso.png)

> El aviso no bloquea. Pide revisar la lectura o volver a medir; una lectura
> atípica también puede ser real.

## Los resultados

El paso **2 · Resultados** de cada visita muestra sus indicadores (el
asentamiento máximo, el promedio, el mayor movimiento y la alerta) y, por
punto, la cota, el parcial, el acumulado, la velocidad, el estado y la
**tendencia**: **Acelera** o **Converge**.

![Resultados de la visita 6: los indicadores, la tabla de puntos con su cota, parcial, acumulado, velocidad, estado y tendencia, y el gráfico del acumulado](../../public/manual/asentamientos/11-resultados.png)

## El panel del lugar

La pestaña **Panel** reúne todo el historial:

- **Los indicadores**: el asentamiento máximo, el promedio actual, la
  velocidad máxima, cuántas visitas tienen alertas y los umbrales.
- **Las visitas**, de la más reciente a la más antigua, con su promedio, su
  máximo, su mayor movimiento y su peor alerta.
- **La tendencia**: el promedio de los puntos en el tiempo, o cada punto por
  separado con **Por punto**.
- **Los avisos** de lecturas fuera de tendencia.

![Panel de la cartera: los indicadores, la tabla de visitas de la 0 a la 6, la tendencia del promedio con sus umbrales y los avisos de B10](../../public/manual/asentamientos/12-panel.png)

**El semáforo.** Cada punto tiene un estado según sus umbrales de velocidad y
de acumulado; gana el peor de los dos:

| Nivel | Qué significa | Forma |
|---|---|---|
| **Normal** | Dentro de todos los umbrales | ● círculo |
| **Precaución** | Pasa el primer umbral: vigile la tendencia | ■ cuadrado |
| **Alerta** | Pasa el segundo umbral: revise el punto | ◆ rombo |
| **Alarma** | Pasa el umbral más alto: requiere atención inmediata | ▲ triángulo |

Cada nivel tiene su forma y su nombre, además del color: se reconoce con
daltonismo o impreso en blanco y negro.

> Un punto en alarma se guarda como cualquier otro. El semáforo es un
> diagnóstico, no un bloqueo: un asentamiento alarmante es justo lo que este
> módulo existe para documentar.

## Dar de baja o de alta un punto

Si un punto se destruye o se pierde, **no lo elimine**: dele de baja.

1. En la pestaña **Puntos**, pulse **Dar de baja** en su fila.
2. Escriba **De baja desde**, la primera fecha en que el punto ya no se mide, y
   el **Motivo**, que es obligatorio.
3. Pulse **Dar de baja**.

![Ventana Dar de baja B10, con la fecha y el motivo «Destruido por la ampliación de la cubierta»](../../public/manual/asentamientos/14-dar-de-baja.png)

La baja no borra nada: las lecturas anteriores siguen en el análisis, y las
visitas nuevas ya no traen el punto en su libreta. **Deshacer baja** la quita,
si fue un error.

Un punto que se agrega cuando el lugar ya tiene visitas se **da de alta**: el
formulario pide su **fecha de alta**, y su línea base es su primera lectura.

## El informe del lugar

La pestaña **Informe** muestra el informe del lugar:

1. **Los datos del lugar**: el tipo de estructura, los puntos, las visitas, el
   BM y el equipo.
2. **El veredicto**: la peor alerta de la última visita y el mayor acumulado.
3. **Cómo se calcula**, en un párrafo.
4. **La evolución** del acumulado de cada punto en el tiempo.
5. **Las visitas** y **los puntos de la última visita**.
6. **Las notas** y **los avisos**.

Informa las visitas calculadas; las que están en medición se nombran aparte.
Arriba están **Exportar PDF** y **Exportar Excel**. Vea
[El informe y el Excel](06-informe-y-excel.md).

![El informe del lugar con sus datos, el veredicto, la evolución y las visitas](../../public/manual/asentamientos/13-informe.png)
