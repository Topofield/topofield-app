import { Captura } from "../componentes/captura";
import { Seccion } from "../componentes/seccion";
import { CAPTURAS } from "../manual-data";

export function Campo() {
  return (
    <Seccion id="campo" titulo="7. Trabajo en campo">
      <p>
        La aplicación está pensada para usarse también desde el teléfono, en
        sitio.
      </p>

      <Captura {...CAPTURAS.editorMovil} />

      <p>
        En pantallas pequeñas, la tabla de estaciones se convierte en{" "}
        <strong>tarjetas</strong>: una por estación, con sus campos apilados y
        el azimut, ΔN y ΔE visibles sin desplazamiento lateral. Los campos de
        grados, minutos y segundos son lo bastante amplios para usarse con
        guantes.
      </p>

      <p>
        La navegación se reduce a un retorno al nivel anterior, en lugar de la
        ruta completa.
      </p>
    </Seccion>
  );
}
