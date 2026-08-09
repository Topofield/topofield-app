import { Nota } from "../componentes/nota";
import { Seccion } from "../componentes/seccion";
import { Fila, Tabla } from "../componentes/tabla";
import { ESTADOS_PROCESO } from "../manual-data";

export function Conceptos() {
  return (
    <Seccion id="conceptos" titulo="1. Conceptos básicos">
      <p>Tres ideas ordenan toda la aplicación:</p>

      <p>
        <strong>Proyecto.</strong> El contenedor de un trabajo topográfico.
        Guarda el cliente, la ubicación, el datum, la proyección, el equipo
        usado y —lo más importante— el <strong>orden de precisión</strong>, que
        determina qué tolerancias se exigirán a todos sus procesos.
      </p>

      <p>
        <strong>Proceso.</strong> Un levantamiento concreto dentro de un
        proyecto: una poligonal, una nivelación, un control de asentamientos.
        Cada proceso pasa por estados:
      </p>

      <Tabla caption="Estados de un proceso" columnas={["Estado", "Significado"]}>
        {ESTADOS_PROCESO.map((e) => (
          <Fila key={e.estado} celdas={[e.estado, e.significado]} />
        ))}
      </Tabla>

      <p>
        <strong>Cierre.</strong> El acto de dar por terminado un proceso. Queda
        registrado con fecha, hora y autor, y{" "}
        <strong>
          a partir de ese momento los datos no se pueden modificar
        </strong>
        .
      </p>

      <Nota titulo="Sobre la inmutabilidad">
        Un proceso cerrado no se puede editar ni eliminar, ni desde la interfaz
        ni por ninguna otra vía. La restricción está aplicada en la propia base
        de datos, no solo en la pantalla. Si necesita corregir un levantamiento
        cerrado, cree uno nuevo.
      </Nota>
    </Seccion>
  );
}
