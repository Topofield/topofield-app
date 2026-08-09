import { Captura } from "../componentes/captura";
import { Seccion } from "../componentes/seccion";
import { CAPTURAS } from "../manual-data";

export function Acceso() {
  return (
    <Seccion id="acceso" titulo="2. Entrar a la aplicación">
      <Captura {...CAPTURAS.inicioSesion} prioridad />

      <p>
        Ingrese con su correo y contraseña. Si aún no tiene cuenta, use{" "}
        <strong>Regístrate</strong>.
      </p>

      <p>Cada usuario ve únicamente sus propios proyectos.</p>
    </Seccion>
  );
}
