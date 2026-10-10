# Preguntas frecuentes y glosario

Las dudas más comunes, agrupadas por tema, y al final un glosario con las
palabras técnicas del manual.

## La cuenta y la aplicación

### La aplicación se ve oscura (o clara). ¿Cómo la cambio?

En el menú de cuenta (el círculo con su inicial, arriba a la derecha) elija
**Sistema**, **Claro** u **Oscuro**. Con **Sistema** sigue la configuración de
su teléfono o computador.

### ¿Otros usuarios pueden ver mis proyectos?

No. Cada usuario ve solo los suyos, y la base de datos lo garantiza.

### Salí de una pantalla y perdí lo que había escrito

No hay botón **Guardar**: cada ventana guarda al confirmar, y la libreta de una
visita guarda cada lectura al escribirla. Solo se pierde lo escrito en una
ventana que se cierra sin confirmar.

### ¿Puedo eliminar un proyecto?

Sí, en la pestaña **Configuración** del proyecto. Se borra con todo lo que
contiene, para siempre. Para ocultarlo sin borrarlo, archívelo.

## Los procesos

### ¿Cómo cierro un proceso?

No se cierra. La poligonal, la nivelación y el control de asentamientos quedan
calculados y se pueden corregir cuando haga falta. Cada uno dice qué orden de
precisión alcanzó, y su informe avisa si no alcanza ninguno.

### ¿Dónde pongo el equipo y el orden de precisión?

El equipo va en cada proceso, no en el proyecto: la poligonal y la nivelación
en su alta, y cada visita en la suya. El orden no se pone en ninguno: se
detecta al calcular. Si usa siempre el mismo equipo, guárdelo en el catálogo
(vea [El catálogo de equipos](07-equipos.md)).

### ¿La aplicación juzga si mi equipo da para el orden que necesito?

No. El equipo se registra para el informe. Lo que dice si el trabajo cumple es
su cierre comparado con la tolerancia de cada orden.

### ¿Dónde exporto el PDF o el Excel?

En la página de informe de cada proceso: el paso **Informe** de la poligonal o
de la nivelación, o la pestaña **Informe** del lugar. Vea
[El informe y el Excel](06-informe-y-excel.md).

## La poligonal

### ¿Por qué mi poligonal dice que no tiene verificación de cierre?

Porque es **abierta sin control**: no vuelve al punto de partida ni llega a un
punto conocido, así que no hay contra qué comparar el resultado.

### ¿Qué significa una precisión de 1:∞?

Que el cierre fue exacto: el error lineal es cero o muy pequeño. Pasa con
datos teóricos o con levantamientos muy precisos.

### Medí en un sistema local. ¿Puedo pasar a coordenadas reales?

Sí, con **Georreferenciar** y dos estaciones de coordenadas conocidas, o
editando el amarre con las coordenadas reales de la partida y de la
referencia. El orden alcanzado no cambia. Vea
[Georreferenciar](03-poligonal.md#georreferenciar).

## La nivelación

### Mi nivelación cuadra en la comprobación aritmética. ¿Ya está bien medida?

No. La comprobación aritmética solo dice que las sumas de la libreta están
bien hechas: cuadra igual con un nivel mal calibrado. La calidad de la medición
la juzga el error de cierre, en el paso **Compensación**.

### ¿Por qué mi nivelación dice «Sin compensación todavía»?

Porque la libreta no llegó a su fin: falta marcar la casilla de fin en la
última armada (**Llega al BM**, **Llega a …** o **Fin de la ida**) o terminar
la vuelta. El paso **Compensación** le dice qué falta.

### Mi nivelación no alcanza ningún orden. ¿Por qué se compensó?

Porque la nivelación se compensa siempre que haya contra qué cerrar, y avisa:
en la práctica, un trabajo fuera de tolerancia se repite.

## El control de asentamientos

### Un punto quedó en alarma. ¿Puedo seguir midiendo?

Sí. El semáforo es un diagnóstico, no un bloqueo: un punto en alerta o alarma
se guarda igual que cualquier otro. Es justamente lo que el control de
asentamientos busca detectar.

### ¿Por qué no puedo escribir directamente la cota de un punto en la visita?

Porque toda visita se mide con libreta: la cota sale de la lectura, AI −
lectura. Si midió con un nivel digital, importe su archivo .L o la plantilla
CSV.

### La medición de una visita quedó a medias. ¿Perdí algo?

No. Cada lectura se guarda al escribirla. La visita queda **En medición**, y
**Retomar medición** abre la armada en la primera lectura que falta.

### ¿Por qué dos visitas mensuales no dan la misma velocidad?

Porque la velocidad se calcula con los días reales entre las dos fechas, no con
«un mes» fijo. Un intervalo de 28 días y uno de 31 dan velocidades distintas
aunque el asentamiento sea el mismo.

### Un tramo de mi visita no alcanza ningún orden. ¿Qué pasa?

Nada se bloquea. La visita queda calculada con las cotas de la medida, y el
tramo y la visita dicen **Sin verificación**. Conviene revisar la libreta o
repetir la medición.

## Glosario

| Palabra | Qué significa |
|---|---|
| **Acumulado** | Cuánto ha bajado (o subido) un punto de control desde su línea base, en mm |
| **Altura del instrumento (AI)** | La cota de la visual del nivel en una armada: la cota del punto atrás más su V+ |
| **Amarre** | Los puntos conocidos de donde arranca una poligonal: la estación de partida y su referencia |
| **Armada** | Cada vez que se arma el nivel: una V+ a un punto con cota, las lecturas desde ahí y, si la hay, una V− |
| **Azimut** | El ángulo de una dirección medido desde el norte, en el sentido de las agujas del reloj |
| **BM** | Banco de nivel: un punto de cota conocida desde donde se nivela |
| **C0** | La cota base de un punto de control: la referencia de su acumulado |
| **Cierre angular** | La diferencia entre la suma de los ángulos medidos y la que deberían sumar |
| **Cota** | La altura de un punto, en metros |
| **Cota ajustada** | La cota de un punto después de compensar la nivelación |
| **Compensar** | Repartir el error de cierre entre las mediciones, para que el trabajo cierre exacto |
| **Discrepancia** | La diferencia entre el desnivel de la ida y el de la vuelta |
| **Elipse de error** | La zona alrededor de un punto ajustado donde está, con un 95 % de probabilidad, su posición verdadera |
| **Georreferenciar** | Llevar una poligonal medida en coordenadas locales al sistema real, girándola y trasladándola |
| **Línea base** | La primera lectura de un punto de control, o su C0 si la tiene: la referencia de sus asentamientos |
| **Orden de precisión** | La categoría de un trabajo según su error: primer orden, segundo, tercero u ordinario |
| **Parcial** | Cuánto bajó (o subió) un punto desde la visita anterior, en mm |
| **Precisión relativa** | El error de cierre lineal de una poligonal comparado con su perímetro, escrito 1:X |
| **Punto de cambio** | El punto que pasa la cota de una armada a la siguiente: lleva V− y V+ |
| **Radiación (vista intermedia)** | Un punto que se lee solo para conocer su cota, sin seguir el recorrido por él |
| **Tolerancia** | El error máximo que admite un orden de precisión |
| **Tramo** | En una visita, las armadas que salen de un BM del lugar y siguen por sus puntos de cambio |
| **V+ (vista más)** | La lectura hacia atrás, a un punto con cota: se suma |
| **V− (vista menos)** | La lectura hacia adelante, al punto siguiente: se resta |
| **Velocidad** | El parcial dividido por el tiempo entre las dos visitas, en mm/mes |
