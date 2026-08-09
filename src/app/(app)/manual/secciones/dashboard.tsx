import { Captura } from "../componentes/captura";
import { Seccion } from "../componentes/seccion";
import { CAPTURAS } from "../manual-data";

export function Dashboard() {
  return (
    <Seccion id="dashboard" titulo="3. El dashboard">
      <p>Es la pantalla de inicio tras entrar.</p>

      <Captura {...CAPTURAS.dashboard} />

      <p>Arriba, tres indicadores del estado general:</p>

      <ul className="ml-5 list-disc space-y-1">
        <li>
          <strong>Proyectos activos</strong> — cuántos proyectos tiene en curso.
        </li>
        <li>
          <strong>Procesos calculados</strong> — levantamientos resueltos,
          listos para revisar y cerrar.
        </li>
        <li>
          <strong>Fuera de tolerancia</strong> — procesos calculados que no
          alcanzan el orden de precisión de su proyecto. Requieren revisión
          antes del cierre.
        </li>
      </ul>

      <p>
        Debajo, sus proyectos. El selector <strong>Activos / Archivados</strong>{" "}
        filtra la lista. Cada tarjeta indica cuántos procesos tiene el proyecto.
      </p>

      <p>
        Use <strong>+ Nuevo Proyecto</strong> para crear uno.
      </p>
    </Seccion>
  );
}
