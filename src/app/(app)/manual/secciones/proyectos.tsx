import { Captura } from "../componentes/captura";
import { Nota } from "../componentes/nota";
import { Seccion, VolverArriba } from "../componentes/seccion";
import { Fila, Tabla } from "../componentes/tabla";
import { CAPTURAS, COLUMNAS_LISTADO, ORDENES_PRECISION } from "../manual-data";

export function Proyectos() {
  return (
    <Seccion id="proyectos" titulo="4. Proyectos">
      <h3 className="text-lg font-semibold">4.1 Crear un proyecto</h3>

      <Captura {...CAPTURAS.nuevoProyecto} />

      <p>El formulario tiene dos pasos:</p>

      <p>
        <strong>Paso 1 — Datos básicos.</strong> Nombre, descripción, cliente,
        ubicación y, si quiere, las coordenadas geográficas en grados decimales.
      </p>

      <p>
        <strong>Paso 2 — Equipo y precisión.</strong> Datum, proyección, datos
        del instrumento y el <strong>orden de precisión</strong>.
      </p>

      <Nota titulo="El orden de precisión es la decisión más importante del proyecto">
        Define las tolerancias que se exigirán a cada poligonal. Al elegirlo, el
        formulario le muestra la tolerancia angular y la precisión relativa
        mínima que implica.
      </Nota>

      <Tabla
        caption="Órdenes de precisión y sus tolerancias"
        columnas={[
          "Orden",
          "Tolerancia angular",
          "Precisión relativa mínima",
          "Uso típico",
        ]}
      >
        {ORDENES_PRECISION.map((o) => (
          <Fila key={o.orden} celdas={[o.orden, o.angular, o.relativa, o.uso]} />
        ))}
      </Tabla>

      <p className="text-sm text-neutral-500">
        Donde <em>n</em> es el número de ángulos medidos.
      </p>

      <h3 className="mt-4 text-lg font-semibold">4.2 El proyecto por dentro</h3>

      <Captura {...CAPTURAS.hubProyecto} />

      <p>
        La ficha superior resume los datos del proyecto. Debajo, tres pestañas:
      </p>

      <ul className="ml-5 list-disc space-y-1">
        <li>
          <strong>Procesos</strong> — el listado de levantamientos del proyecto.
          Se detalla en el apartado siguiente.
        </li>
        <li>
          <strong>Informes</strong> — <em>pendiente de la fase 6.</em>
        </li>
        <li>
          <strong>Configuración</strong> — edición de los datos del proyecto y
          gestión de los puntos de referencia.
        </li>
      </ul>

      <Captura {...CAPTURAS.configuracionProyecto} />

      <p>
        Los <strong>puntos de referencia</strong> son coordenadas conocidas
        (vértices geodésicos, mojones) que puede reutilizar como punto de
        partida o de llegada de sus poligonales, sin volver a teclearlas.
      </p>

      <h3 className="mt-4 text-lg font-semibold">4.3 El listado de procesos</h3>

      <p>
        Todos los levantamientos del proyecto en una sola lista, con una barra
        para encontrar lo que busca.
      </p>

      <p>
        <strong>Buscar.</strong> Filtra por nombre mientras escribe. No distingue
        mayúsculas ni acentos: «via» encuentra «Vía terciaria».
      </p>

      <p>
        <strong>Filtrar por estado.</strong> Los chips muestran cuántos procesos
        hay en cada grupo, así que ve la distribución del proyecto sin desplegar
        nada. Pulse uno para ver solo ese grupo.
      </p>

      <p>
        <strong>Filtrar por tipo.</strong> El selector acota a un tipo de
        poligonal.
      </p>

      <p>
        Cuando hay algún filtro activo aparece <strong>Limpiar filtros</strong>,
        para volver a verlo todo de un clic.
      </p>

      <Nota>
        El listado recuerda el último filtro que usó en cada proyecto, así que al
        volver lo encuentra como lo dejó. Si abre un enlace que alguien le
        compartió, manda lo que traiga ese enlace: verá lo mismo que quien se lo
        envió.
      </Nota>

      <Tabla
        caption="Columnas del listado de procesos"
        columnas={["Columna", "Qué muestra"]}
      >
        {COLUMNAS_LISTADO.map((c) => (
          <Fila key={c.columna} celdas={[c.columna, c.muestra]} />
        ))}
      </Tabla>

      <p>
        La columna <strong>Cumple</strong> es la que evita abrir cada proceso
        para saber si el levantamiento sirve.
      </p>

      <p>
        Pulse <strong>Proceso</strong>, <strong>Precisión</strong> o{" "}
        <strong>Última actividad</strong> para ordenar por esa columna; pulsar de
        nuevo invierte el orden. Por defecto se ordena por actividad reciente,
        así que lo que está trabajando queda arriba.
      </p>

      <p>
        <strong>Acciones por proceso.</strong> Cada fila ofrece:
      </p>

      <ul className="ml-5 list-disc space-y-1">
        <li>
          <strong>Duplicar</strong> — crea un proceso nuevo con la misma
          configuración (tipo, punto de partida, método de corrección) pero sin
          estaciones, en estado Borrador.
        </li>
        <li>
          <strong>Renombrar</strong> — cambia el nombre sin abrir el editor.
        </li>
        <li>
          <strong>Eliminar</strong> — borra el proceso y sus estaciones, con
          confirmación previa.
        </li>
      </ul>

      <Nota titulo="Los procesos cerrados y rechazados solo se pueden duplicar">
        No admiten renombrarse ni eliminarse, porque son inmutables. Si necesita
        rehacer un levantamiento cerrado, duplíquelo: obtendrá una copia
        editable y el original queda intacto como constancia.
      </Nota>

      <p>En el teléfono, la tabla se convierte en tarjetas, una por proceso.</p>

      <VolverArriba />
    </Seccion>
  );
}
