import { Captura } from "../componentes/captura";
import { Seccion } from "../componentes/seccion";
import { Fila, Tabla } from "../componentes/tabla";
import { CAPTURAS, DESENLACES_CIERRE } from "../manual-data";

export function Cierre() {
  return (
    <Seccion id="cierre" titulo="6. Cerrar un proceso">
      <p>
        Cerrar es <strong>irreversible</strong>. Antes de permitirlo, la
        aplicación comprueba el trabajo y decide el desenlace:
      </p>

      <Tabla
        caption="Desenlaces posibles al intentar cerrar"
        columnas={["Situación", "Qué ocurre"]}
      >
        {DESENLACES_CIERRE.map((d) => (
          <Fila key={d.situacion} celdas={[d.situacion, d.ocurre]} />
        ))}
      </Tabla>

      <p>
        La distinción importa: un error angular indica un fallo en la medición
        de ángulos, que invalida el levantamiento. Una precisión relativa
        insuficiente significa que el trabajo se hizo, pero no alcanza la
        calidad exigida — se documenta como rechazado y queda constancia.
      </p>

      <p>
        El diálogo de cierre resume el tipo, el perímetro, el error de cierre,
        la precisión y la fecha. Debe marcar la confirmación explícitamente.
      </p>

      <p>
        <strong>Proceso cerrado:</strong>
      </p>

      <Captura {...CAPTURAS.procesoCerrado} />

      <p>
        <strong>Proceso rechazado:</strong>
      </p>

      <Captura {...CAPTURAS.procesoRechazado} />

      <p>
        En ambos casos el editor se abre en solo lectura: los campos están
        deshabilitados y no hay botones de guardado.
      </p>
    </Seccion>
  );
}
