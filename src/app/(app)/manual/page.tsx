import type { Metadata } from "next";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";
import {
  AVISOS_LIBRETA,
  CAPTURAS,
  COLUMNAS_LISTADO,
  DESENLACES_CIERRE,
  ESTADOS_PROCESO,
  METODOS_CORRECCION,
  CAMPOS_INFORME,
  HOJAS_EXCEL,
  INDICADORES_LUGAR,
  NIVELES_SEMAFORO,
  ORDENES_PRECISION,
  PREGUNTAS,
  SECCIONES,
  TIPOS_NIVELACION,
  TIPOS_POLIGONAL,
  TIPOS_PUNTO_NIVELACION,
  TOLERANCIA_NIVELACION,
  type Captura as DatosCaptura,
} from "./manual-data";

export const metadata: Metadata = {
  title: "Manual de usuario — TopoField",
  description:
    "Cómo usar TopoField: proyectos, poligonales, nivelación, control de asentamientos, cierre con trazabilidad y trabajo en campo.",
};

/**
 * Manual de usuario dentro de la aplicación.
 *
 * A diferencia de `/design-system`, esta página SÍ existe en producción: es
 * documentación para quien usa TopoField, no una herramienta de desarrollo.
 *
 * El texto viene de `manual-data.ts`, derivado de `docs/manual/README.md`. El
 * índice son anclas de HTML, sin JavaScript de cliente.
 */
export default function ManualPage() {
  return (
    <div className="flex flex-col">
      <header className="mb-8">
        <h1 className="text-3xl font-bold">Manual de usuario</h1>
        <p className="mt-2 max-w-2xl text-neutral-800">
          Cómo registrar los datos de campo, calcularlos con validación en vivo
          y cerrarlos con trazabilidad. Cubre lo que la aplicación permite hacer
          hoy, que es el alcance completo del proyecto: los tres módulos de
          proceso, el cierre con trazabilidad, los informes y la exportación a
          Excel.
        </p>
      </header>

      <nav
        id="indice"
        aria-label="Secciones del manual"
        className="mb-10 scroll-mt-6"
      >
        <ul className="flex flex-wrap gap-2">
          {SECCIONES.map((seccion) => (
            <li key={seccion.id}>
              <a
                href={`#${seccion.id}`}
                className="inline-block rounded-full border border-neutral-200 bg-white px-3 py-1 text-sm font-medium text-primary-600 transition-colors hover:bg-primary-50"
              >
                {seccion.titulo}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      {/* ── 1. Conceptos básicos ───────────────────────────────────────── */}
      <Seccion id="conceptos" titulo="1. Conceptos básicos">
        <p>Tres ideas ordenan toda la aplicación:</p>

        <p>
          <strong>Proyecto.</strong> El contenedor de un trabajo topográfico.
          Guarda el cliente, la ubicación, el datum y la proyección. El
          equipo usado y el <strong>orden de precisión</strong> no viven
          aquí: cada proceso —poligonal, nivelación, visita de
          asentamiento— declara los suyos, porque pueden cambiar de un
          levantamiento a otro dentro de un mismo proyecto.
        </p>

        <p>
          <strong>Proceso.</strong> Un levantamiento concreto dentro de un
          proyecto: una poligonal, una nivelación, un control de asentamientos.
          Cada proceso pasa por estados:
        </p>

        <Tabla
          caption="Estados de un proceso"
          columnas={["Estado", "Significado"]}
        >
          {ESTADOS_PROCESO.map((e) => (
            <Fila key={e.estado} celdas={[e.estado, e.significado]} />
          ))}
        </Tabla>

        <p>
          <strong>Cierre.</strong> El acto de dar por terminado un proceso.
          Queda registrado con fecha, hora y autor, y{" "}
          <strong>
            a partir de ese momento las mediciones y el veredicto no se pueden
            modificar
          </strong>
          . Es lo que da trazabilidad al trabajo.
        </p>

        <Nota titulo="Sobre la inmutabilidad">
          Un proceso cerrado no se puede editar ni eliminar, ni desde la
          interfaz ni por ninguna otra vía. La restricción está aplicada en la
          propia base de datos, no solo en la pantalla. Si necesita corregir un
          levantamiento cerrado, cree uno nuevo. La única excepción es la{" "}
          <strong>posición</strong> de una poligonal: se puede georreferenciar
          aunque esté cerrada (§ 5.5), porque girarla y trasladarla no cambia
          nada de lo que el cierre certificó.
        </Nota>
      </Seccion>

      {/* ── 2. Entrar a la aplicación ──────────────────────────────────── */}
      <Seccion id="acceso" titulo="2. Entrar a la aplicación">
        <Captura {...CAPTURAS.inicioSesion} prioridad />
        <p>
          Ingrese con su correo y contraseña. Si aún no tiene cuenta, use{" "}
          <strong>Regístrate</strong>.
        </p>
        <p>
          <strong>Para crear una cuenta necesita un código de invitación.</strong>{" "}
          Al registrarse se le pide, junto con su nombre, correo y contraseña.
          Después recibirá un mensaje para confirmar su dirección: hasta que
          pulse ese enlace no podrá entrar.
        </p>
        <p>
          La primera vez que entre encontrará un{" "}
          <strong>proyecto de ejemplo</strong> con cuatro poligonales ya
          calculadas, para que pueda ver cómo funciona la aplicación sin
          capturar nada. Puede modificarlo o eliminarlo cuando quiera.
        </p>
        <p>Cada usuario ve únicamente sus propios proyectos.</p>
      </Seccion>

      {/* ── 3. El dashboard ────────────────────────────────────────────── */}
      <Seccion id="dashboard" titulo="3. El dashboard">
        <p>Es la pantalla de inicio tras entrar.</p>

        <Captura {...CAPTURAS.dashboard} />

        <p>Arriba, tres indicadores del estado general:</p>

        <ul className="ml-5 list-disc space-y-1">
          <li>
            <strong>Proyectos activos</strong> — cuántos proyectos tiene en
            curso.
          </li>
          <li>
            <strong>Procesos calculados</strong> — levantamientos resueltos,
            listos para revisar y cerrar.
          </li>
          <li>
            <strong>Fuera de tolerancia</strong> — procesos calculados que no
            alcanzan el orden de precisión que ellos mismos declararon.
            Requieren revisión antes del cierre.
          </li>
        </ul>

        <p>
          Debajo, sus proyectos. El selector{" "}
          <strong>Activos / Archivados</strong> filtra la lista. Cada tarjeta
          indica cuántos procesos tiene el proyecto.
        </p>

        <p>
          Use <strong>+ Nuevo Proyecto</strong> para crear uno.
        </p>

        <Nota titulo="Empieza con un proyecto de ejemplo">
          La primera vez que entra, su cuenta ya trae un{" "}
          <strong>«Proyecto de ejemplo»</strong> con poligonales, una
          nivelación, un lugar de control de asentamientos y sus informes, para
          que explore la aplicación con datos reales. Puede modificarlo o
          eliminarlo cuando quiera.
        </Nota>
      </Seccion>

      {/* ── 4. Proyectos ───────────────────────────────────────────────── */}
      <Seccion id="proyectos" titulo="4. Proyectos">
        <h3 className="text-lg font-semibold">4.1 Crear un proyecto</h3>

        <Captura {...CAPTURAS.nuevoProyecto} />

        <p>El formulario tiene dos pasos:</p>

        <p>
          <strong>Paso 1 — Datos básicos.</strong> Nombre, descripción, cliente,
          ubicación y, si quiere, las coordenadas geográficas en grados
          decimales.
        </p>

        <p>
          <strong>Paso 2 — Datum y proyección.</strong> El sistema de
          referencia del proyecto.
        </p>

        <Nota titulo="El equipo y el orden de precisión no se piden aquí">
          Se declaran en cada proceso: cada poligonal, cada nivelación y cada
          visita de asentamiento tiene su propia configuración de orden y
          equipo, con los campos que corresponden a su tipo de instrumento.
          Un mismo proyecto puede así tener trabajos de distinto orden,
          medidos con instrumentos distintos y en fechas distintas. Vea{" "}
          <a href="#poligonales" className="underline">
            § 5
          </a>
          ,{" "}
          <a href="#nivelacion" className="underline">
            § 6
          </a>{" "}
          y{" "}
          <a href="#asentamientos" className="underline">
            § 7
          </a>
          .
        </Nota>

        <h3 className="mt-4 text-lg font-semibold">
          4.2 El proyecto por dentro
        </h3>

        <Captura {...CAPTURAS.hubProyecto} />

        <p>
          La ficha superior resume los datos del proyecto. Debajo, tres
          pestañas:
        </p>

        <ul className="ml-5 list-disc space-y-1">
          <li>
            <strong>Procesos</strong> — el listado de levantamientos del
            proyecto. Se detalla en el apartado siguiente.
          </li>
          <li>
            <strong>Informes</strong> — genera los informes de cierre del
            proyecto con los procesos ya cerrados, listos para imprimir o
            guardar como PDF. Se detalla en «10. Informes».
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
          Los que tienen cota sirven además como BM de sus nivelaciones y
          como <strong>BM de amarre</strong> de las visitas de asentamiento.
        </p>

        <h3 className="mt-4 text-lg font-semibold">
          4.3 El listado de procesos
        </h3>

        <p>
          Todos los levantamientos del proyecto en una sola lista, con una barra
          para encontrar lo que busca.
        </p>

        <p>
          <strong>Buscar.</strong> Filtra por nombre mientras escribe. No
          distingue mayúsculas ni acentos: «via» encuentra «Vía terciaria».
        </p>

        <p>
          <strong>Filtrar por estado.</strong> Los chips muestran cuántos
          procesos hay en cada grupo, así que ve la distribución del proyecto
          sin desplegar nada. Pulse uno para ver solo ese grupo.
        </p>

        <p>
          <strong>Filtrar por tipo.</strong> El selector acota a un tipo de
          poligonal.
        </p>

        <p>
          Cuando hay algún filtro activo aparece{" "}
          <strong>Limpiar filtros</strong>, para volver a verlo todo de un clic.
        </p>

        <Nota>
          El listado recuerda el último filtro que usó en cada proyecto, así que
          al volver lo encuentra como lo dejó. Si abre un enlace que alguien le
          compartió, manda lo que traiga ese enlace: verá lo mismo que quien se
          lo envió.
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
          <strong>Última actividad</strong> para ordenar por esa columna; pulsar
          de nuevo invierte el orden. Por defecto se ordena por actividad
          reciente, así que lo que está trabajando queda arriba.
        </p>

        <p>
          <strong>Acciones por proceso.</strong> Cada fila ofrece:
        </p>

        <ul className="ml-5 list-disc space-y-1">
          <li>
            <strong>Duplicar</strong> — crea un proceso nuevo con la misma
            configuración (tipo, punto de partida, método de corrección) pero
            sin estaciones, en estado Borrador.
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
          No admiten renombrarse ni eliminarse, porque son inmutables. Si
          necesita rehacer un levantamiento cerrado, duplíquelo: obtendrá una
          copia editable y el original queda intacto como constancia.
        </Nota>

        <p>
          En el teléfono, la tabla se convierte en tarjetas, una por proceso.
        </p>

        <VolverArriba />
      </Seccion>

      {/* ── 5. Poligonales ─────────────────────────────────────────────── */}
      <Seccion id="poligonales" titulo="5. Poligonales">
        <h3 className="text-lg font-semibold">5.1 Tipos</h3>

        <p>
          TopoField maneja tres tipos, y la diferencia determina cómo se
          verifica el trabajo:
        </p>

        <Tabla
          caption="Tipos de poligonal"
          columnas={["Tipo", "Descripción", "Cómo se verifica"]}
        >
          {TIPOS_POLIGONAL.map((t) => (
            <Fila key={t.tipo} celdas={[t.tipo, t.descripcion, t.verificacion]} />
          ))}
        </Tabla>

        <p>
          La poligonal abierta sin control sirve para reconocimiento: calcula
          coordenadas, pero no hay forma de comprobar si son correctas. La
          aplicación lo indica explícitamente en vez de mostrar una precisión
          inexistente.
        </p>

        <h3 className="mt-4 text-lg font-semibold">5.2 Crear una poligonal</h3>

        <Captura {...CAPTURAS.nuevaPoligonal} />

        <p>
          Desde el proyecto, <strong>+ Nuevo Proceso → Poligonal</strong>.
          Indique el nombre, el tipo, el punto de partida (código, Norte, Este
          y azimut inicial), el <strong>orden de precisión</strong> y los
          datos de la <strong>estación total</strong> con que va a medir:
          marca, modelo, número de serie, fecha de calibración, precisión
          angular (en segundos, ISO 17123-3) y precisión de distancia como
          término constante en mm más término proporcional en ppm (ISO
          17123-4).
        </p>

        <p>
          Si el tipo es <em>abierta con control</em>, deberá indicar además el
          punto de llegada.
        </p>

        <p>
          Arriba del formulario elige si tecleará los ángulos en{" "}
          <strong>DMS</strong> o en <strong>grados decimales</strong> (ver
          § 5.3).
        </p>

        <Nota titulo="El orden de precisión es la decisión más importante del proceso">
          Define las tolerancias que se le exigirán al cierre. Al elegirlo, el
          formulario le muestra la tolerancia angular y la precisión relativa
          mínima que implica:
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
            <Fila
              key={o.orden}
              celdas={[o.orden, o.angular, o.relativa, o.uso]}
            />
          ))}
        </Tabla>

        <p className="text-sm text-neutral-500">
          Donde <em>n</em> es el número de ángulos medidos.
        </p>

        <Nota>
          Si la precisión angular del equipo no alcanza para el orden
          elegido, la aplicación se lo advierte junto al campo de precisión
          angular — por ejemplo, una estación de 5″ con primer orden
          declarado (cuya tolerancia parte de 1″). Es un aviso, no un
          bloqueo: puede seguir capturando, porque la decisión de si el
          equipo basta es suya. Un equipo que cumple justo el orden (5″ con
          tercer orden, cuya tolerancia parte de 15″) no dispara el aviso.
        </Nota>

        <h3 className="mt-4 text-lg font-semibold">5.3 El editor</h3>

        <Captura {...CAPTURAS.editor} />

        <p>La pantalla se lee de arriba abajo:</p>

        <p>
          <strong>El veredicto.</strong> Lo primero y más visible: si el
          levantamiento cumple o no el orden de precisión exigido.
        </p>

        <Captura {...CAPTURAS.veredicto} />

        <p>
          Muestra la precisión alcanzada junto a la requerida, el error de
          cierre y el perímetro. El color lo resume, y el texto lo dice: verde
          cumple, rojo no cumple.
        </p>

        <p>
          <strong>Ángulos en DMS o en grados decimales.</strong> Bajo el
          veredicto, el conmutador <strong>Ángulos en</strong> elige cómo
          teclea los ángulos: en tres casillas (grados, minutos, segundos) o
          en un solo campo de grados decimales. Afecta a las lecturas de las
          estaciones, a los azimuts de partida y de llegada y al diálogo de
          reasignación.
        </p>

        <ul className="ml-5 list-disc space-y-1">
          <li>
            Cambiar de formato <strong>no altera ningún valor</strong>: la
            aplicación guarda los ángulos siempre en DMS y el decimal es solo
            otra forma de verlos, con seis decimales.
          </li>
          <li>
            Los ángulos se guardan a la <strong>décima de segundo</strong>. Si
            teclea un decimal con más precisión, bajo el campo aparece cómo se
            guardará —«Se guarda como 124°29′42″»—.
          </li>
          <li>
            El formato se recuerda por proceso: al volver a abrirlo, aparece
            como lo dejó. En un proceso cerrado el conmutador solo cambia la
            vista.
          </li>
          <li>Resultados, informe y Excel muestran siempre DMS.</li>
        </ul>

        <p>
          <strong>Configuración.</strong> Plegada cuando el proceso ya está
          calculado. Ábrala para cambiar el nombre, el tipo, el punto de
          partida, el orden de precisión o los datos de la estación total —
          los mismos campos del alta, editables mientras el proceso siga
          abierto.
        </p>

        <p>
          Ahí elige también el <strong>tipo de ángulo</strong> y el{" "}
          <strong>punto de amarre</strong>. TopoField no preselecciona el tipo
          de ángulo a propósito: si recorre el polígono en un sentido sus
          lecturas caen como interiores y en el otro como exteriores, y elegir
          por usted produciría un levantamiento espejado sin ningún aviso.
        </p>

        <p>
          El punto de amarre sale del catálogo de puntos del proyecto —solo
          aparecen los que tienen coordenadas—, y con él{" "}
          <strong>el azimut se calcula solo</strong> desde las coordenadas del
          arranque y las de la referencia. Si su cartera cierra visando de
          vuelta al amarre, marque la casilla correspondiente: la última fila
          será ese ángulo de cierre y no llevará distancia.
        </p>

        <p>
          <strong>Estaciones.</strong> La tabla de captura. Por cada estación
          registra el código, el ángulo y la distancia horizontal. A la derecha,
          la aplicación calcula en vivo el azimut, ΔN y ΔE.
        </p>

        <p>
          El ángulo se captura con <strong>varias lecturas</strong>. La celda
          muestra el promedio, la dispersión entre lecturas y cuántas lleva de
          las exigidas —por ejemplo <code>211°15&#39;7″ · ±3.0″ · 3/3</code>—; al
          pulsarla se despliegan las lecturas individuales y un botón para
          añadir más. El proceso exige un mínimo configurable, 3 por defecto, y
          el promedio es el que alimenta el cálculo.
        </p>

        <p>
          La dispersión avisa cuando supera lo que su equipo resuelve. Tres
          lecturas que difieren 40″ con un teodolito de 5″ no son
          repetibilidad: son un error de puntería o de tecleo. Es un aviso, no
          un bloqueo.
        </p>

        <p>
          Los errores de captura se marcan al momento: una distancia de cero o
          mayor a 1000 m, minutos o segundos fuera del rango 0-59. Un ángulo de
          0° o 360° genera una advertencia, no un bloqueo: es válido, pero suele
          indicar un error de tecleo.
        </p>

        <p>
          <strong>Resultados.</strong> El detalle completo: verificación angular
          (suma medida contra suma teórica, error y tolerancia), cierre lineal
          (error, perímetro, precisión relativa) y la tabla de coordenadas
          corregidas.
        </p>

        <p>
          Si su poligonal está amarrada aparece además el{" "}
          <strong>control de reorientación</strong>: el último azimut de la
          cadena debe volver al azimut de amarre. Es un control de calidad de su
          levantamiento, no un criterio de tolerancia, así que no impide cerrar
          el proceso.
        </p>

        <p>
          Aquí elige el <strong>método de corrección</strong>:
        </p>

        <Tabla
          caption="Métodos de corrección"
          columnas={["Método", "Cómo reparte el error"]}
        >
          {METODOS_CORRECCION.map((m) => (
            <Fila key={m.metodo} celdas={[m.metodo, m.reparte]} />
          ))}
        </Tabla>

        <p>Cambiar el método recalcula las coordenadas al instante.</p>

        <p>
          <strong>Mínimos cuadrados.</strong> Los otros tres métodos reparten el
          error con una regla fija; este busca las correcciones más pequeñas
          —pesadas por la precisión de cada observación— que hacen cerrar la
          poligonal. Al elegirlo aparecen tres campos:
        </p>

        <ul className="ml-5 list-disc space-y-1">
          <li>
            <strong>σ angular (″)</strong>: la desviación típica que supone
            para cada ángulo.
          </li>
          <li>
            <strong>σ de distancia (m)</strong>: la de una medición de
            distancia.
          </li>
          <li>
            <strong>Mediciones por distancia</strong>: cuántas veces midió cada
            lado. Una distancia medida <em>n</em> veces pesa como σ/√
            <em>n</em>.
          </li>
        </ul>

        <p>
          Todas las observaciones pesan igual. Los campos{" "}
          <strong>salen vacíos</strong>: la aplicación no supone pesos por
          usted. La hoja de la universidad usa, por ejemplo, 2″, 0.011 m y 2
          mediciones. Mientras falte alguno verá «Faltan los pesos del ajuste»,
          sin coordenadas, y no podrá guardar.
        </p>

        <Captura {...CAPTURAS.minimosCuadrados} />

        <p>
          Con los pesos completos, <strong>Resultados</strong> suma una tabla
          con la <strong>corrección de cada ángulo</strong>, en segundos, y de{" "}
          <strong>cada distancia</strong>, en milímetros, junto a la distancia
          ajustada. El ángulo de orientación no se ajusta: es el dato de
          partida. Debajo aparece <strong>σ₀</strong>, que compara lo medido
          con los pesos que supuso:
        </p>

        <ul className="ml-5 list-disc space-y-1">
          <li>
            <strong>Cerca de 1</strong> (entre 0.5 y 2): los pesos describen
            bien sus observaciones.
          </li>
          <li>
            <strong>Mayor que 2</strong>: midió peor de lo supuesto, o hay un
            error grueso en la cartera.
          </li>
          <li>
            <strong>Menor que 0.5</strong>: sus σ son pesimistas; midió mejor
            de lo declarado.
          </li>
        </ul>

        <p>
          Si los pesos están pero no hay ajuste posible, un aviso dice por qué:
          con un solo lado, por ejemplo, las condiciones de llegada dependen de
          una sola distancia y no hay nada que ajustar.
        </p>

        <p>
          σ₀ es información, no un criterio. El{" "}
          <strong>veredicto de cierre es el mismo</strong> con cualquier
          método: se juzga con el error de la cartera tal como se midió, antes
          de corregir.
        </p>

        <p>
          <strong>Dibujo de la poligonal.</strong> La poligonal a escala sobre
          una grilla de coordenadas, con flecha de norte, barra de escala y el
          amarre si lo tiene. Se actualiza en vivo mientras captura.
        </p>

        <Captura {...CAPTURAS.dibujoPoligonal} />

        <ul className="ml-5 list-disc space-y-1">
          <li>
            En <strong>trazo continuo</strong>, la poligonal{" "}
            <strong>ajustada</strong>.
          </li>
          <li>
            En <strong>trazo discontinuo</strong>, la poligonal{" "}
            <strong>sin compensar</strong>, con los desplazamientos{" "}
            <strong>exagerados</strong> por el factor que indica la leyenda
            (×100 en la imagen). En una cerrada no llega a cerrar: el hueco del
            último vértice es el error de cierre.
          </li>
        </ul>

        <Nota titulo="Por qué se exagera">
          En un buen levantamiento el error de cierre es de centímetros sobre
          cientos de metros: dibujado a escala real, ocupa menos de un píxel y
          las dos poligonales se verían idénticas. El factor se elige solo —1,
          2 o 5 × 10ⁿ— para que el mayor desplazamiento ocupe alrededor del 5 %
          del dibujo, y nunca es menor que 1. Una abierta sin control no tiene
          nada que compensar y no muestra trazo discontinuo.
        </Nota>

        <p>
          Con <strong>Acercar</strong>, <strong>Alejar</strong> y{" "}
          <strong>Restablecer</strong>, y con las <strong>flechas</strong> o
          arrastrando el dibujo, puede acercarse a un vértice; todos los
          controles funcionan con el teclado. Si el amarre está lejos, queda
          fuera del encuadre y solo se ve su línea de orientación: la leyenda
          lo indica. La rueda del ratón no hace zoom, para no
          interferir con el desplazamiento de la página. El factor de
          exageración no cambia al acercarse.
        </p>

        <h3 className="mt-4 text-lg font-semibold">5.4 Reasignar coordenadas</h3>

        <p>
          El botón <strong>Asignar coordenadas reales</strong> permite
          recalcular toda la poligonal desde un punto de partida distinto,
          conservando las mediciones. Es útil cuando levantó en un sistema local
          —1000, 1000— y después obtuvo las coordenadas oficiales.
        </p>

        <p>
          Si el proceso está amarrado, el diálogo pide también las coordenadas
          reales del punto de amarre y <strong>recalcula el azimut</strong> a
          partir de las dos: no hay que teclearlo.
        </p>

        <p>
          Lo que no cambia al reasignar: el error angular, el error de cierre y
          la precisión relativa. Girar y trasladar la poligonal no altera nada
          de lo que el cierre certifica; solo se mueven las coordenadas.
        </p>

        <p>
          Este diálogo es para un proceso <strong>sin cerrar</strong> y parte
          del punto de arranque. Si lo que tiene son las coordenadas reales de{" "}
          <strong>dos estaciones</strong> —medidas con GPS, por ejemplo—, o el
          proceso ya está cerrado, use <strong>Georreferenciar</strong>.
        </p>

        <h3 className="mt-4 text-lg font-semibold">5.5 Georreferenciar</h3>

        <p>
          Un levantamiento suele arrancar en un sistema local —(1000, 2000) y
          un azimut supuesto— y recibir coordenadas reales después, a veces con
          el proceso ya cerrado. El botón <strong>Georreferenciar</strong>,
          junto a <strong>Exportar a Excel</strong>, lo lleva al sistema real
          con <strong>dos de sus estaciones</strong> de coordenadas conocidas.
          Está disponible en cualquier estado, también cerrado o rechazado.
        </p>

        <Captura {...CAPTURAS.georreferenciar} />

        <ol className="ml-5 list-decimal space-y-1">
          <li>
            Elija la estación del <strong>punto A</strong> y teclee su Norte y
            Este reales, o tómelos de un punto del catálogo del proyecto.
          </li>
          <li>
            Lo mismo para el <strong>punto B</strong>. Use las dos estaciones{" "}
            <strong>más alejadas</strong> entre sí: con puntos cercanos, un
            error pequeño en sus coordenadas gira mucho la poligonal.
          </li>
          <li>
            Revise la vista previa: <strong>rotación</strong>,{" "}
            <strong>traslación</strong>, <strong>factor de escala</strong>,{" "}
            <strong>residuos</strong> en A y B, y las coordenadas actuales
            frente a las reales.
          </li>
          <li>
            Confirme. En un proceso cerrado el botón dice{" "}
            <strong>Reescribir coordenadas</strong>.
          </li>
        </ol>

        <p>
          La poligonal se <strong>gira y se traslada</strong>, sin escala: las
          distancias y los ángulos medidos no cambian, y el{" "}
          <strong>veredicto de cierre tampoco</strong>. Se recalcula con el
          nuevo arranque, así que coordenadas, azimuts y proyecciones quedan en
          el sistema real. Bajo el título queda anotada la última
          georreferenciación: fecha, puntos, rotación y factor de escala. Puede
          georreferenciar otra vez para corregir una coordenada mal tecleada.
        </p>

        <p>El diálogo avisa, sin impedirlo, en tres casos:</p>

        <ul className="ml-5 list-disc space-y-1">
          <li>
            <strong>El factor de escala se aparta de 1</strong> más de lo que
            admite el orden de precisión: la distancia real entre A y B no
            concuerda con la medida. Revise las coordenadas. Si están en una
            proyección con factor de escala distinto de 1 (p. ej. CTM12), la
            diferencia puede ser de la proyección y no un error.
          </li>
          <li>
            <strong>El método es Tránsito.</strong> Tránsito reparte el error
            según la orientación, así que sus coordenadas cambian unos
            milímetros más allá del giro. El veredicto no cambia.
          </li>
          <li>
            <strong>El amarre es del catálogo.</strong> Sus coordenadas siguen
            en el sistema anterior, así que pasa a amarre manual con el mismo
            código, y el dibujo deja de mostrarlo.
          </li>
        </ul>

        <VolverArriba />
      </Seccion>

      {/* ── 6. Nivelación ───────────────────────────────────────────────── */}
      <Seccion id="nivelacion" titulo="6. Nivelación">
        <h3 className="text-lg font-semibold">6.1 Tipos</h3>

        <p>TopoField maneja tres tipos de nivelación geométrica:</p>

        <Tabla
          caption="Tipos de nivelación"
          columnas={["Tipo", "Descripción", "Cómo se verifica"]}
        >
          {TIPOS_NIVELACION.map((t) => (
            <Fila key={t.tipo} celdas={[t.tipo, t.descripcion, t.verificacion]} />
          ))}
        </Tabla>

        <p>
          La nivelación abierta sin control sirve solo para reconocimiento:
          calcula cotas, pero no hay forma de comprobar si son correctas,
          igual que la poligonal abierta sin control. No se puede calcular
          error de cierre ni compensar.
        </p>

        <h3 className="mt-4 text-lg font-semibold">
          6.2 Cómo se llena la libreta
        </h3>

        <p>
          La libreta es una fila por punto. Cada fila puede llevar dos
          lecturas:
        </p>

        <ul className="ml-5 list-disc space-y-1">
          <li>
            <strong>Vista más (V+)</strong> — la primera que se toma tras
            estacionar el nivel. Con ella se <strong>abre la armada
            siguiente</strong>: fija la altura del instrumento (AI = cota + V+)
            que usarán las filas venideras.
          </li>
          <li>
            <strong>Vista menos (V−)</strong> —{" "}
            <strong>fija la cota del punto</strong> de la fila. Viene de la
            armada anterior: cota = AI − V−.
          </li>
        </ul>

        <p>
          Los nombres dicen qué hace cada número en la cuenta: la vista más se
          suma y la vista menos se resta. Son los de la cartera de campo.
        </p>

        <p>
          Por eso la columna <strong>AI solo tiene valor en las filas que
          llevan V+</strong>: la altura de instrumento es un dato de la
          armada, no de la fila. Una fila con solo V− (que cierra una armada
          sin abrir la siguiente) no muestra AI propia; usa la de la armada
          en curso.
        </p>

        <h3 className="mt-4 text-lg font-semibold">6.3 Tipos de punto</h3>

        <p>Cada fila indica de qué tipo es el punto que registra:</p>

        <Tabla
          caption="Tipos de punto de nivelación"
          columnas={["Tipo", "Qué hace", "Lecturas que lleva"]}
        >
          {TIPOS_PUNTO_NIVELACION.map((t) => (
            <Fila key={t.tipo} celdas={[t.tipo, t.hace, t.lecturas]} />
          ))}
        </Tabla>

        <p>
          El punto intermedio cuelga de la AI vigente pero{" "}
          <strong>no propaga cota ni abre una armada nueva</strong>, y por eso
          queda fuera de la comprobación aritmética y de la compensación: un
          error en su lectura no contamina el resto del recorrido, pero
          tampoco se corrige.
        </p>

        <h3 className="mt-4 text-lg font-semibold">
          6.4 Crear una nivelación
        </h3>

        <Captura {...CAPTURAS.nuevaNivelacion} />

        <p>
          Desde el proyecto, <strong>+ Nuevo Proceso → Nivelación</strong>.
          Indique el nombre, el tipo y el BM de partida: puede elegirlo del
          catálogo de puntos de referencia del proyecto (autocompleta código y
          cota) o teclearlo directamente si no lo tiene registrado. Indique
          también el <strong>orden de precisión</strong> y los datos del{" "}
          <strong>nivel</strong>: marca, modelo, número de serie, fecha de
          calibración, tipo (automático o digital) y desviación típica en mm
          por km de doble nivelación (ISO 17123-2).
        </p>

        <p>
          Si el tipo es <em>de enlace</em>, deberá indicar además el BM de
          llegada. Marque <strong>Incluye recorrido de vuelta</strong> si va a
          medir ida y vuelta.
        </p>

        <Nota>
          Si la desviación típica del nivel no alcanza para el orden elegido,
          la aplicación se lo advierte junto al campo de desviación típica —
          por ejemplo, un nivel de obra de 5.0 mm/km con primer orden
          declarado (cuya tolerancia parte de 3 mm/km). Es un aviso, no un
          bloqueo: 2.5 mm/km con primer orden es ajustado pero posible, y no
          lo dispara.
        </Nota>

        <h3 className="mt-4 text-lg font-semibold">6.5 El editor</h3>

        <Captura {...CAPTURAS.editorNivelacion} />

        <p>
          <strong>Configuración.</strong> Plegada cuando el proceso ya está
          calculado. Ábrala para cambiar el nombre, el tipo, los BM o el
          orden de precisión y el equipo de nivel — los mismos campos del
          alta, editables mientras el proceso siga abierto.
        </p>

        <p>
          La libreta se captura por fila: punto, tipo, V+ y V−, y la{" "}
          <strong>distancia a cada mira</strong>. La distancia
          acumulada y la distancia total del recorrido no se teclean: la
          aplicación las suma sola y las muestra en solo lectura.
        </p>

        <Nota titulo="La distancia a cada mira es obligatoria en los BM y en los puntos de cambio">
          Sin ella el recorrido no acumula, la distancia total sale menor de la
          real y el punto de cierre queda mal corregido — con el proceso
          informando que cumple. Los puntos intermedios no la necesitan: no
          entran en la compensación.
        </Nota>

        <p>
          <strong>Los tres hilos, con nivel automático.</strong> Si el proceso
          declara un nivel automático, la libreta ofrece capturar los tres
          hilos estadimétricos de cada visual. Marque «Capturar los tres
          hilos» y aparecerán las casillas del hilo superior y el inferior; la
          aplicación calcula entonces la distancia por taquimetría,{" "}
          <code>D = (HS − HI) × 100</code>, y rellena la lectura de mira con el
          hilo medio si aún está vacía.
        </p>

        <p>
          Son <strong>opcionales</strong>: si midió la distancia a cinta,
          teclee la distancia y deje los hilos en blanco. Y si ya anotó la
          lectura, teclear los hilos no la sobrescribe. Cuando están los tres,
          la aplicación comprueba que el hilo medio sea el promedio de los
          otros dos; si no cuadra, avisa: es un error de lectura o de
          transcripción.
        </p>

        <p>
          <strong>Equilibrado de visuales.</strong> Con las dos distancias de
          una armada, la aplicación avisa si la V+ y la V− quedaron a
          distancias muy distintas. Equilibrarlas cancela el error
          de colimación del nivel, así que es la regla de campo más importante
          de la nivelación de precisión. El límite depende del orden: 2 m en
          primer orden, 3 en segundo, 4 en tercero y 6 en ordinario.
        </p>

        <Nota titulo="Con nivel digital no se leen hilos">
          El instrumento entrega la distancia: se teclean la lectura y la
          distancia.
        </Nota>

        <p>
          <strong>Comprobación aritmética.</strong> ΣV+ − ΣV−
          debe coincidir con el desnivel total del recorrido. Es una
          verificación de gabinete: confirma que las sumas y traslados de la
          libreta son correctos,{" "}
          <strong>no dice nada sobre la calidad de la medición</strong> —
          cuadra igual con un nivel descolimado. Los puntos intermedios
          quedan fuera de esta suma.
        </p>

        <p>
          <strong>Cierre.</strong> El error de cierre se compara contra la
          tolerancia K·√D, donde D es la distancia del recorrido{" "}
          <strong>en un solo sentido</strong>, en kilómetros, y K depende del
          orden de precisión que declaró el proceso:
        </p>

        <Tabla caption="Coeficiente K de la tolerancia K·√D" columnas={["Orden", "K (mm)"]}>
          {TOLERANCIA_NIVELACION.map((t) => (
            <Fila key={t.orden} celdas={[t.orden, t.k]} />
          ))}
        </Tabla>

        <p>
          <strong>Corrección proporcional a la distancia.</strong> Si el
          cierre cumple la tolerancia, la aplicación reparte el error entre
          los puntos según su distancia acumulada: a mayor distancia del
          origen, mayor corrección. El resultado es que el{" "}
          <strong>BM final cierra exacto</strong> contra su cota conocida, con
          corrección igual y de signo opuesto al error de cierre.
        </p>

        <h3 className="mt-4 text-lg font-semibold">6.6 Ida y vuelta</h3>

        <p>
          Al activar el recorrido de vuelta, la libreta muestra dos pestañas.
          Ida y vuelta son <strong>mediciones independientes</strong>. En campo
          se hace de dos maneras: con puntos de cambio propios en cada
          sentido, o <strong>volviendo por los mismos puntos</strong>. La
          aplicación admite las dos.
        </p>

        <p>
          La aplicación compara los <strong>desniveles totales</strong> de
          ambos recorridos. La discrepancia entre ellos se contrasta contra{" "}
          <strong>T·√2</strong>, donde T es la misma tolerancia K·√D del
          cierre individual. Ese es el veredicto.
        </p>

        <p>
          <strong>Puntos homólogos.</strong> Si la ida y la vuelta pasan por
          los mismos puntos, Resultados añade una tabla que compara la cota de
          cada punto en los dos recorridos: cota de la vuelta menos cota de la
          ida, con las cotas sin compensar. Los códigos se emparejan sin
          distinguir espacios ni mayúsculas (<code>AUX1</code> y{" "}
          <code>AUX 1</code> son el mismo punto).
        </p>

        <Captura {...CAPTURAS.puntosHomologos} />

        <p>Un único número de discrepancia esconde lo que la serie deja ver:</p>

        <ul className="ml-5 list-disc space-y-1">
          <li>
            si el residuo <strong>crece a lo largo del recorrido</strong>, hay
            un error sistemático repartido;
          </li>
          <li>
            si <strong>salta en un punto</strong>, revise ese punto.
          </li>
        </ul>

        <p>
          En la imagen, la discrepancia es de 0.4 mm, pero a mitad del recorrido
          las dos mediciones difieren en 5 mm. La tabla es informativa: no
          cambia el veredicto. Un código que se repite dentro de un recorrido
          —el BM de partida de una cerrada— no se compara, porque no se sabe
          con cuál de sus cotas.
        </p>

        <h3 className="mt-4 text-lg font-semibold">
          6.7 Importar desde archivo
        </h3>

        <p>
          Con un nivel digital, las lecturas y las distancias ya están en un
          archivo. <strong>Importar desde archivo</strong> —en la libreta de
          una nivelación sin cerrar, o al crear una nueva— las pasa a la
          libreta sin teclearlas.
        </p>

        <Captura {...CAPTURAS.importarNivelacion} />

        <p>Se leen:</p>

        <ul className="ml-5 list-disc space-y-1">
          <li>
            el archivo <strong>.L de un nivel digital Leica</strong>;
          </li>
          <li>
            la <strong>plantilla CSV</strong> de TopoField, que se descarga
            desde el mismo diálogo, para cualquier otro instrumento: una fila
            por cada fila de la libreta, con <code>;</code> y coma decimal si
            viene de Excel en español.
          </li>
        </ul>

        <p>
          El formato se reconoce por el contenido, no por el nombre del
          archivo. Si no se reconoce, el diálogo dice qué formatos se leen.
        </p>

        <p>Antes de usar las lecturas, la previsualización deja decidir:</p>

        <ul className="ml-5 list-disc space-y-1">
          <li>
            <strong>Cómo se lee el recorrido.</strong> Un archivo que va y
            vuelve por los mismos puntos puede ser{" "}
            <strong>un recorrido cerrado</strong> o{" "}
            <strong>ida y vuelta</strong>. Con ida y vuelta, elija en qué
            armada empieza la vuelta; se propone la detectada.
          </li>
          <li>
            <strong>La cota del BM de partida</strong>, si la del archivo no
            coincide con la del proceso.
          </li>
          <li>
            <strong>El tipo de cada punto.</strong> El instrumento no distingue
            un BM de un punto de cambio o de una radiación: se deduce de su
            posición y usted lo corrige.
          </li>
        </ul>

        <p>
          El instrumento mide dos veces cada visual; se guarda el{" "}
          <strong>promedio</strong>, redondeado a 0.1 mm. El diálogo muestra
          la mayor diferencia entre las dos lecturas y la mayor desviación
          típica del instrumento, como control.
        </p>

        <p>
          Al aceptar, la libreta se reemplaza, el nivel pasa a{" "}
          <strong>digital</strong> y se propone el tipo de proceso:{" "}
          <strong>cerrada</strong> si el recorrido vuelve a su BM,{" "}
          <strong>abierta con vuelta</strong> si es ida y vuelta. En el editor{" "}
          <strong>no se guarda nada hasta que pulse Guardar</strong>; al crear,
          el proceso nace con sus lecturas.
        </p>

        <h3 className="mt-4 text-lg font-semibold">
          6.8 Cierre irreversible
        </h3>

        <p>
          Igual que en poligonales, cerrar una nivelación es{" "}
          <strong>irreversible</strong>. Un trabajo que no alcanza la
          tolerancia solo puede cerrarse como <strong>rechazado</strong>; no
          hay forma de cerrarlo como conforme si no cumple.
        </p>

        <VolverArriba />
      </Seccion>

      {/* ── 7. Control de Asentamientos ────────────────────────────────── */}
      <Seccion id="asentamientos" titulo="7. Control de Asentamientos">
        <p>
          El control de asentamientos sigue el descenso de una estructura en
          el tiempo: cada visita mide la cota de un conjunto de puntos, y la
          aplicación calcula cuánto ha bajado cada uno desde la visita
          anterior y desde el inicio.
        </p>

        <h3 className="text-lg font-semibold">7.1 El lugar</h3>

        <p>
          Un <strong>lugar</strong> es el sitio que se monitorea: un
          edificio, una presa, un terraplén. Agrupa un catálogo de puntos de
          control y sus visitas sucesivas — es el equivalente, para este
          módulo, a lo que una poligonal o una nivelación son para los otros
          dos.
        </p>

        <Captura {...CAPTURAS.nuevoLugar} />

        <p>
          Desde el proyecto,{" "}
          <strong>+ Nuevo Proceso → Control de Asentamientos</strong>.
          Indique el nombre y el <strong>tipo de estructura</strong>:
          edificio, presa, terraplén u otro. Elegir el tipo aplica un juego
          de <strong>umbrales de alerta</strong> típico para ese tipo de
          estructura —de velocidad y de asentamiento acumulado— que puede
          editar a continuación si el caso lo requiere.
        </p>

        <p>
          También define el <strong>límite de distorsión angular</strong>,
          expresado como <code>1/X</code>: un X menor es más severo (1/300 es
          peor que 1/500).
        </p>

        <h3 className="mt-4 text-lg font-semibold">
          7.2 Catalogar los puntos
        </h3>

        <Captura {...CAPTURAS.editorLugar} />

        <p>
          Ya creado el lugar, agregue sus <strong>puntos de control</strong>:
          código, ubicación, coordenadas Norte/Este (opcionales, pero
          necesarias para calcular distorsión angular entre puntos) y la{" "}
          <strong>cota inicial (C0)</strong> — la referencia contra la que se
          mide el asentamiento acumulado de todas las visitas futuras.
        </p>

        <p>
          La C0 es opcional. Si la deja vacía, la{" "}
          <strong>línea base del punto es su primera lectura</strong>: esa
          lectura queda con acumulado 0 y las siguientes se miden contra ella.
        </p>

        <p>
          <strong>Renombrar un punto</strong> cambia también su código en la
          libreta de las visitas <strong>abiertas</strong> (
          <a href="#registrar-visita" className="underline">
            § 7.3
          </a>
          ), para que su cota siga saliendo de su fila. Las visitas cerradas
          conservan el código con que se midieron.
        </p>

        <p>
          El catálogo puede cambiar a mitad del monitoreo —un punto se
          destruye, otro se instala—; ver{" "}
          <a href="#baja-alta" className="underline">
            § 7.7
          </a>
          .
        </p>

        <h3
          id="registrar-visita"
          className="mt-4 scroll-mt-6 text-lg font-semibold"
        >
          7.3 Registrar una visita
        </h3>

        <p>
          Cada <strong>visita</strong> es una fecha en la que se releyeron
          los puntos del catálogo. La primera visita registrada es la{" "}
          <strong>visita 0 o línea base</strong>: fija el punto de partida y
          no tiene asentamiento ni velocidad propios, porque no hay una
          visita anterior contra la que compararla.
        </p>

        <p>
          <strong>Crear la visita.</strong> En el panel del lugar (
          <a href="#panel-lugar" className="underline">
            § 7.4
          </a>
          ), <strong>+ Nueva visita</strong> pide:
        </p>

        <Captura {...CAPTURAS.nuevaVisita} />

        <ul className="ml-5 list-disc space-y-1">
          <li>
            <strong>Fecha</strong> y <strong>Nivelador</strong>.
          </li>
          <li>
            <strong>Captura</strong> — cómo llegan las cotas:{" "}
            <em>digitar la libreta de nivelación</em>,{" "}
            <em>importar la libreta desde un archivo</em> o{" "}
            <em>cotas directas</em>, para una nivelación calculada fuera de la
            aplicación.
          </li>
          <li>
            <strong>BM de amarre</strong> — el banco de nivel sobre el que se
            cierra la nivelación de la visita. Elíjalo del catálogo de puntos
            de referencia del proyecto (§ 4.2), que trae código y cota, o
            tecléelo con <strong>Otro (entrada libre)</strong> si el proyecto
            no lo tiene registrado. Para digitar es obligatorio; al importar
            puede dejarlo vacío, porque lo trae el archivo.
          </li>
          <li>
            El <strong>orden de precisión</strong> y los datos del{" "}
            <strong>nivel</strong>.
          </li>
        </ul>

        <p>
          El nivelador, el amarre, el orden y el equipo{" "}
          <strong>vienen de la visita anterior</strong>: cambie solo lo que no
          sea igual. <strong>Crear y abrir</strong> lleva al editor de la
          visita, con el diálogo de importación ya abierto si eligió importar.
        </p>

        <p>
          Cada visita declara también el <strong>orden de precisión</strong>{" "}
          con que se midió y los datos del <strong>nivel</strong> usado:
          marca, modelo, número de serie, fecha de calibración, tipo
          (automático o digital) y desviación típica en mm por km de doble
          nivelación (ISO 17123-2). El instrumento puede cambiar entre una
          visita y la siguiente —pueden pasar meses—, así que cada visita
          lleva su propio equipo, no el lugar.
        </p>

        <Nota>
          Si la desviación típica del nivel no alcanza para el orden que
          declaró la visita, la aplicación se lo advierte, con el mismo
          criterio que en nivelación (§ 6.5): un nivel de 5.0 mm/km con
          primer orden (K = 3) avisa; uno de 2.5 mm/km, ajustado pero
          posible, no. Es un aviso, no un bloqueo.
        </Nota>

        <p>
          <strong>La libreta de nivelación.</strong> En una visita con
          libreta, las cotas de los puntos de control{" "}
          <strong>no se teclean: salen de la libreta</strong>. Es la misma
          tabla de la nivelación (§ 6.2 a § 6.5) —V+, V−, distancia a cada
          mira, hilos con nivel automático— y forma un{" "}
          <strong>circuito cerrado sobre el BM de amarre</strong>: la primera
          y la última fila son el amarre.
        </p>

        <Captura {...CAPTURAS.editorVisita} />

        <p>
          Para capturar en campo, la libreta llega{" "}
          <strong>precargada</strong> con la secuencia de la visita anterior
          —códigos y tipos, sin lecturas— y el amarre de esta visita. Si no
          hay visita anterior con libreta, con el amarre, los puntos de
          control como intermedios y el amarre otra vez. Solo queda llenar las
          lecturas. Además:
        </p>

        <ul className="ml-5 list-disc space-y-1">
          <li>
            la casilla del punto <strong>sugiere</strong> los códigos del
            catálogo y el del amarre;
          </li>
          <li>
            <strong>Insertar</strong> añade una fila debajo de la actual, por
            ejemplo para un punto de cambio que la secuencia no traía;
          </li>
          <li>
            bajo el código, una nota marca las filas que son{" "}
            <strong>Punto de control</strong> o <strong>BM de amarre</strong>.
          </li>
        </ul>

        <p>
          Debajo de la tabla, el resumen: ΣV+, ΣV−, el error de cierre y la
          tolerancia K·√D del orden de la visita.
        </p>

        <p>
          <strong>De dónde sale la cota de cada punto.</strong> De la fila de
          la libreta con su código y con <strong>vista menos</strong>. Si el
          cierre cumple la tolerancia, es la cota{" "}
          <strong>compensada</strong>, como en nivelación (§ 6.5); si no, la
          calculada. La tabla{" "}
          <strong>Cotas de los puntos de control</strong>, bajo la libreta,
          las muestra en solo lectura, y el servidor las recalcula al pulsar{" "}
          <strong>Guardar visita</strong>.
        </p>

        <p>La libreta avisa de lo que no cuadra:</p>

        <Tabla
          caption="Avisos de la libreta de la visita"
          columnas={["Situación", "Qué ocurre"]}
        >
          {AVISOS_LIBRETA.map((a) => (
            <Fila key={a.situacion} celdas={[a.situacion, a.ocurre]} />
          ))}
        </Tabla>

        <Nota titulo="Fuera de tolerancia solo avisa">
          Un cierre que no alcanza la tolerancia es un resultado de campo, no
          un error de captura: se registra, y el aviso queda en el editor, en
          la columna Cierre del panel, en la vista de la visita y al cerrarla.
          Conviene revisar la libreta o repetir la nivelación. La comprobación
          aritmética sí bloquea el cierre, porque una suma que no cuadra es un
          error de la libreta.
        </Nota>

        <p>
          <strong>Importar la libreta.</strong> Con un nivel digital,{" "}
          <strong>Importar desde archivo</strong> pasa a la libreta el archivo{" "}
          <strong>.L de Leica</strong> o la <strong>plantilla CSV</strong> de
          TopoField, como en nivelación (§ 6.7), con dos diferencias: el
          archivo se lee siempre como <strong>un solo recorrido</strong> —el
          circuito cerrado sobre el amarre, sin ida y vuelta— y{" "}
          <strong>el amarre sale de su primera fila</strong>: si la visita no
          tenía o tenía otro, se propone el del archivo. Si la visita ya tenía
          libreta, se reemplaza, con aviso. Nada se guarda hasta pulsar{" "}
          <strong>Guardar visita</strong>.
        </p>

        <Captura {...CAPTURAS.importarLibretaVisita} />

        <p>
          <strong>Cotas directas.</strong> Para una nivelación procesada fuera
          de la aplicación, elija <strong>Cotas directas</strong> en{" "}
          <em>Captura de las cotas</em>: se teclea la{" "}
          <strong>cota medida</strong> de cada punto y el{" "}
          <strong>error de cierre (mm)</strong>, que se registra tal cual, sin
          tolerancia. Las visitas registradas antes de que existiera la
          libreta siguen en este modo. Al cambiar de modo, el editor avisa de
          lo que descartará al guardar: la libreta o las cotas tecleadas.
        </p>

        <p>
          <strong>El cálculo.</strong> En los dos modos, con la cota de cada
          punto, la aplicación calcula al instante:
        </p>

        <ul className="ml-5 list-disc space-y-1">
          <li>
            <strong>Parcial</strong> — cuánto bajó (o subió) el punto desde la
            visita anterior, en mm.
          </li>
          <li>
            <strong>Acumulado</strong> — cuánto ha bajado desde la línea base
            del punto —su C0 o, sin C0, su primera lectura—, en mm.
          </li>
          <li>
            <strong>Velocidad</strong> — el parcial dividido entre el tiempo
            transcurrido, en mm/mes.{" "}
            <strong>
              Se calcula con los días reales entre las dos visitas
            </strong>
            , no con «un mes» genérico: una visita a 28 días y otra a 31 no
            dan la misma velocidad aunque el parcial fuera igual.
          </li>
          <li>
            <strong>Estado</strong> — el nivel de alerta de ese punto,
            semáforo explicado en{" "}
            <a href="#panel-lugar" className="underline">
              § 7.4
            </a>
            .
          </li>
        </ul>

        <p>
          Un valor positivo es un <strong>levantamiento</strong>, no un
          asentamiento, y se muestra como tal: es un hallazgo que vale la
          pena revisar, no un error de signo.
        </p>

        <p>
          La tabla de cotas pide los puntos <strong>vigentes</strong> en la
          fecha de la visita. Un punto de baja, o dado de alta después de esa
          fecha, no aparece, y una nota debajo de la tabla dice cuál falta y
          por qué, para que la ausencia no parezca un olvido.
        </p>

        <p>
          <strong>Lecturas fuera de tendencia.</strong> Desde la tercera
          lectura de un punto, la aplicación compara cada cota con la
          tendencia de ese punto y avisa bajo la cota si la lectura:
        </p>

        <ul className="ml-5 list-disc space-y-1">
          <li>
            va <strong>contra</strong> su tendencia más que el margen —por
            ejemplo, un punto que viene bajando y de pronto sube—, o
          </li>
          <li>
            lo mueve <strong>más del doble</strong> de lo que su ritmo
            anterior preveía, más el margen.
          </li>
        </ul>

        <p>
          El margen absorbe el ruido de medición y depende del orden de
          precisión de la visita: 1,5 mm en primer orden, 3 en segundo, 6 en
          tercero y 12 en ordinario. Moverse <strong>menos</strong> de lo
          previsto nunca avisa, porque un asentamiento por consolidación
          frena con el tiempo.
        </p>

        <Nota titulo="El aviso no bloquea">
          Pide verificar la lectura en la libreta o volver a medir; una
          lectura atípica también puede ser real. Si dos visitas seguidas
          salen marcadas, casi siempre el error está en la primera: la
          segunda se compara contra una velocidad ya contaminada.
        </Nota>

        <h3 id="panel-lugar" className="mt-4 scroll-mt-6 text-lg font-semibold">
          7.4 El panel del lugar
        </h3>

        <Captura {...CAPTURAS.panelAsentamientos} />

        <p>
          Abrir el lugar desde el proyecto lleva a su panel, que reúne el
          historial completo. Arriba, cuántos puntos de control tiene, la
          fecha de la lectura base y la leyenda de los tres umbrales de
          acumulado que dibujan las gráficas. Las acciones:{" "}
          <strong>+ Nueva visita</strong> (§ 7.3),{" "}
          <strong>Exportar a Excel</strong> (§ 11) y{" "}
          <strong>Editar lugar</strong>, que lleva al catálogo.
        </p>

        <p>
          <strong>Indicadores.</strong> Seis, sobre la última visita y el
          histórico:
        </p>

        <Tabla
          caption="Indicadores del panel del lugar"
          columnas={["Indicador", "Qué muestra"]}
        >
          {INDICADORES_LUGAR.map((k) => (
            <Fila key={k.indicador} celdas={[k.indicador, k.muestra]} />
          ))}
        </Tabla>

        <p>
          Un punto dado de alta a mitad del monitoreo mide su acumulado desde
          su propia línea base, así que el promedio mezcla las dos.
        </p>

        <p>
          <strong>Visitas.</strong> De la más reciente a la más antigua; pulse
          una fila para abrir la visita (
          <a href="#vista-visita" className="underline">
            § 7.5
          </a>
          ). Por visita: el promedio y el máximo del acumulado, el BM de
          amarre con su cota, el <strong>mayor Δ</strong> desde la anterior,
          el <strong>cierre</strong> de la libreta en mm —con{" "}
          <strong>⚠</strong> si supera la tolerancia; en cotas directas, el
          tecleado—, la peor alerta y el estado: borrador, calculada o
          cerrada.
        </p>

        <p>
          <strong>Tendencia del asentamiento.</strong> El promedio de los
          puntos en cada visita, con una banda que va del punto menos asentado
          al más asentado y las líneas de los umbrales. El eje horizontal es
          el <strong>tiempo</strong>, no el número de visita: si las visitas
          pasan de quincenales a mensuales, la pendiente no se exagera. Pulse
          una visita en la línea para abrirla.
        </p>

        <p>
          <strong>Evolución por punto.</strong> El acumulado de cada punto de
          control según los días desde la lectura base. Los chips de arriba
          muestran el último valor de cada punto; pulse uno para resaltarlo y
          atenuar los demás, y <strong>Todos</strong> para volver. Cada punto
          se distingue por{" "}
          <strong>forma de marcador además de color</strong> (círculo,
          cuadrado, triángulo, rombo, cruz), y las marcas «(de baja)» y
          «(alta …)» señalan los puntos que salieron o entraron a mitad del
          monitoreo.
        </p>

        <p>
          Bajo cada gráfica, <strong>Ver datos en tabla</strong> despliega los
          mismos valores en texto: la alternativa para cuando la gráfica no
          basta.
        </p>

        <p>
          <strong>Semáforo por punto.</strong> El estado de cada punto en la
          última visita, según sus umbrales de velocidad y de acumulado —
          gana el peor de los dos. Tiene cuatro niveles:
        </p>

        <Tabla
          caption="Niveles del semáforo de asentamientos"
          columnas={["Nivel", "Significado", "Forma"]}
        >
          {NIVELES_SEMAFORO.map((n) => (
            <Fila key={n.nivel} celdas={[n.nivel, n.significado, n.forma]} />
          ))}
        </Tabla>

        <Nota titulo="El semáforo no se distingue solo por color">
          Cada nivel tiene además una forma propia y su nombre escrito junto
          al indicador, así que se reconoce igual con daltonismo o en una
          impresión en blanco y negro.
        </Nota>

        <p>
          La columna de estado del semáforo muestra además la marca{" "}
          <strong>⚠ Lectura fuera de tendencia</strong> cuando la lectura de
          la última visita la tuvo. No cambia el nivel del semáforo: es un
          aviso sobre la calidad del dato, no sobre la gravedad del
          movimiento. Es útil cuando el mismo punto sale en{" "}
          <strong>Alerta</strong> y <strong>Acelerando</strong>: la marca
          indica que lo más probable es una lectura mal tomada, no una
          aceleración real.
        </p>

        <p>
          <strong>Un dato en alarma se registra con normalidad.</strong> El
          semáforo es un diagnóstico, no un control de captura: la aplicación{" "}
          <strong>nunca</strong> impide guardar una visita ni cerrarla por
          tener puntos en alerta o alarma. Un asentamiento alarmante es
          exactamente el hallazgo que este módulo existe para documentar;
          bloquearlo ocultaría el dato que más importa.
        </p>

        <p>
          <strong>Diferenciales y distorsión angular.</strong> Compara cada
          par de puntos: cuánto difieren sus asentamientos acumulados y qué
          distorsión angular implica esa diferencia dada la distancia entre
          ellos, como <code>1/X</code>. Un par sin coordenadas capturadas
          queda fuera de esta tabla en vez de calcularse con una distancia de
          cero.
        </p>

        <p>
          Si uno de los dos puntos se dio de alta a mitad del monitoreo, los
          dos asentamientos se miden <strong>desde la fecha de ese alta</strong>{" "}
          —el periodo que ambos comparten— y la fila lo indica debajo del par
          («desde el 15 de marzo de 2025»). Comparar un punto que lleva meses
          bajando con uno recién instalado daría una distorsión que no
          significa nada.
        </p>

        <h3 id="vista-visita" className="mt-4 scroll-mt-6 text-lg font-semibold">
          7.5 La vista de una visita
        </h3>

        <Captura {...CAPTURAS.vistaVisita} />

        <p>
          Abrir una visita, desde la tabla o desde la tendencia, lleva a su
          vista, en solo lectura. Arriba, <strong>← Volver</strong> al lugar,
          la fecha, el amarre, el nivelador y el equipo, y las flechas{" "}
          <strong>← →</strong> para pasar a la visita anterior o a la
          siguiente. Las acciones: <strong>Ver registro de nivelación</strong>
          , en las visitas con libreta, y <strong>Editar</strong> y{" "}
          <strong>Cerrar visita</strong> mientras siga abierta. Una visita
          cerrada no se edita.
        </p>

        <p>
          <strong>Indicadores.</strong> El asentamiento máximo; el promedio,
          con su diferencia frente a la visita anterior; el mayor movimiento
          desde la anterior; los puntos en alerta, de los medidos; el{" "}
          <strong>cierre de nivelación</strong>, con la tolerancia y si
          cumple; y la peor alerta junto al estado de la visita.
        </p>

        <p>
          <strong>Puntos de control.</strong> Por punto: la cota base (su C0
          o su primera lectura), la cota actual, el acumulado, el Δ desde la
          anterior, la velocidad y la alerta, con la marca de lectura fuera de
          tendencia. Seleccione un punto para ver al lado —debajo, en
          pantallas angostas— su <strong>historial</strong>: el acumulado
          hasta esta visita frente a los umbrales, y cuánto le falta para el
          siguiente: «Le faltan 21.3 mm para el umbral de alerta (−50 mm)», o
          si ya superó el de alarma.
        </p>

        <p>
          <strong>Barras.</strong>{" "}
          <em>Asentamiento acumulado por punto</em>, con las líneas de los
          umbrales, y <em>Movimiento desde la visita anterior</em>. Pulse una
          barra para seleccionar su punto.
        </p>

        <p>
          <strong>Registro de nivelación.</strong> Un panel lateral con la
          libreta tal como se guardó: la fecha, el nivelador, el equipo y el
          BM de amarre; por fila, la armada, el punto, V+, AI, la vista
          intermedia (V. int.), V−, la cota y la cota compensada; y al pie
          ΣV+, ΣV−, el error de cierre y la tolerancia. Las vistas intermedias
          de los puntos de control van resaltadas: de ellas sale la cota del
          punto. Se cierra con <strong>Cerrar</strong> o con Esc.
        </p>

        <Captura {...CAPTURAS.registroNivelacion} />

        <h3 className="mt-4 text-lg font-semibold">
          7.6 Cerrar una visita o el lugar
        </h3>

        <p>
          Cerrar una <strong>visita</strong> la deja en solo lectura: es el
          registro de campo de una fecha concreta, y una vez cerrada no
          admite más cambios. Se exige lectura de todos los puntos{" "}
          <strong>vigentes</strong> en su fecha; los de baja no.
        </p>

        <p>
          En una visita con libreta, el diálogo de cierre muestra además el
          cierre de la libreta.{" "}
          <strong>
            Si la comprobación aritmética no cuadra, no se puede cerrar
          </strong>
          : corrija la libreta. Si el cierre supera la tolerancia, solo avisa:
          la visita se cierra con sus cotas sin compensar.
        </p>

        <Nota titulo="Cierre antes la visita de la línea base">
          Si un punto sin C0 tiene su primera lectura en una visita anterior
          que sigue abierta, la aplicación no deja cerrar las posteriores:
          «Cierra antes la visita 2: contiene la primera lectura de P-07, que
          es su línea base». Si esa primera lectura siguiera editable,
          cambiarla movería el acumulado de visitas ya cerradas.
        </Nota>

        <p>
          Cerrar el <strong>lugar</strong> termina el monitoreo por completo:
          el lugar y todas sus visitas —cerradas o no— quedan en solo
          lectura. Use el cierre del lugar cuando el seguimiento del sitio
          haya concluido, no visita por visita.
        </p>

        <h3 id="baja-alta" className="mt-4 scroll-mt-6 text-lg font-semibold">
          7.7 Dar de baja y de alta un punto
        </h3>

        <p>
          Los puntos que se miden no son siempre los mismos durante todo el
          monitoreo. Un BM se destruye, se tapa o se pierde; otro se instala
          cuando la obra avanza.
        </p>

        <p>
          <strong>Dar de baja.</strong> En el catálogo,{" "}
          <strong>Dar de baja</strong> pide dos datos:
        </p>

        <ul className="ml-5 list-disc space-y-1">
          <li>
            <strong>De baja desde</strong> — la primera fecha en que el punto
            ya <strong>no</strong> se mide. Debe ser posterior a su última
            lectura.
          </li>
          <li>
            <strong>Motivo</strong> — obligatorio: dentro de un año nadie
            recordará por qué el punto dejó de medirse.
          </li>
        </ul>

        <p>
          La baja <strong>no borra nada</strong>. Las lecturas anteriores
          siguen en el análisis, la gráfica muestra la serie hasta su última
          lectura con la marca «(de baja)», y el informe cuenta el punto y
          dice desde cuándo está de baja. Un punto de baja no se edita.
        </p>

        <p>
          <strong>Deshacer una baja</strong> solo sirve para corregir un
          error, y solo mientras ninguna visita cerrada tenga fecha igual o
          posterior a la baja. Después es definitiva, y el catálogo dice qué
          visita la hizo definitiva. Si un BM tapado aparece de nuevo, puede
          haberse movido: regístrelo como <strong>punto nuevo</strong>, con
          otro código y su propia línea base, no como la continuación de su
          serie.
        </p>

        <Nota titulo="Borrar no es dar de baja">
          Un punto con lecturas en visitas cerradas no se puede eliminar: es
          parte del registro del monitoreo. Borrar queda para los puntos
          creados por error.
        </Nota>

        <p>
          <strong>Dar de alta.</strong> Un punto que se agrega cuando el lugar
          ya tiene visitas se da de alta: el formulario pide la{" "}
          <strong>fecha de alta</strong> en lugar de la C0, porque su línea
          base será su <strong>primera lectura</strong>, no la visita 0 del
          lugar. La fecha debe ser posterior a la última visita cerrada, que
          se cerró sin él. El punto se exige en las visitas desde esa fecha y
          no en las anteriores.
        </p>

        <VolverArriba />
      </Seccion>

      {/* ── 8. Cerrar un proceso ───────────────────────────────────────── */}
      <Seccion id="cierre" titulo="8. Cerrar un proceso">
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
          deshabilitados y no hay botones de guardado. Lo único que sigue
          disponible es <strong>Georreferenciar</strong> (§ 5.5).
        </p>
      </Seccion>

      {/* ── 8. Trabajo en campo ────────────────────────────────────────── */}
      <Seccion id="campo" titulo="9. Trabajo en campo">
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

      {/* ── 10. Informes ───────────────────────────────────────────────── */}
      <Seccion id="informes" titulo="10. Informes">
        <p>
          Un informe reúne varios trabajos ya terminados de un proyecto en un
          solo documento imprimible, con su registro de quién cerró cada cosa y
          cuándo.
        </p>

        <h3 className="text-lg font-semibold text-neutral-900">
          Qué puede incluirse
        </h3>
        <p>
          <strong>Solo procesos cerrados.</strong> Es la regla principal y tiene
          una razón práctica: el informe no guarda una copia de los datos, sino
          que los vuelve a leer cada vez que se abre. Como un proceso cerrado ya
          no puede cambiar sus mediciones ni su veredicto, el informe dice lo
          mismo hoy y dentro de un año. La excepción es la{" "}
          <strong>posición</strong>: si georreferencia una poligonal después de
          emitir el informe, el informe muestra las coordenadas nuevas, con una
          nota de cuándo y con qué puntos se georreferenció.
        </p>
        <ul className="ml-5 list-disc space-y-1">
          <li>
            Un proceso <strong>rechazado no se puede incluir</strong>. Queda
            como constancia del trabajo, pero no se informa.
          </li>
          <li>
            En control de asentamientos se incluye el{" "}
            <strong>lugar cerrado</strong>, no una visita suelta: un lugar
            todavía activo admite visitas nuevas, así que su informe cambiaría
            solo.
          </li>
        </ul>
        <p>
          Si el proyecto no tiene nada cerrado, la pantalla se lo dice en vez de
          ofrecer un formulario que no llevaría a ninguna parte.
        </p>

        <h3 className="text-lg font-semibold text-neutral-900">
          Generar un informe
        </h3>
        <p>
          En la pestaña <strong>Informes</strong> del proyecto, pulse{" "}
          <strong>Generar Nuevo Informe</strong>.
        </p>

        <Captura {...CAPTURAS.nuevoInforme} />

        <Tabla
          caption="Campos del formulario de informe"
          columnas={["Campo", "Para qué"]}
        >
          {CAMPOS_INFORME.map((c) => (
            <Fila key={c.campo} celdas={[c.campo, c.para]} />
          ))}
        </Tabla>

        <h3 className="text-lg font-semibold text-neutral-900">
          Imprimir o guardar como PDF
        </h3>
        <p>
          Al generar, la aplicación abre el informe. El botón{" "}
          <strong>Ver e imprimir</strong> lleva al documento maquetado, y allí{" "}
          <strong>Imprimir o guardar como PDF</strong> abre el diálogo del
          navegador: elija «Guardar como PDF» como destino.
        </p>

        <Captura {...CAPTURAS.informeImprimible} />

        <p>
          El documento lleva portada con los datos del proyecto, índice, una
          sección por proceso con sus resultados <strong>y su equipo</strong>{" "}
          —en las poligonales, con su dibujo—,
          el resumen consolidado de precisiones —con una columna de equipo—,
          sus observaciones y el registro de cierre. El equipo ya no es un
          dato del proyecto: cada sección imprime el que declaró su propio
          proceso (en asentamientos, el de la visita más reciente).
        </p>
        <p className="text-sm text-neutral-500">
          El PDF lo genera su navegador, no la aplicación. Los márgenes y los
          encabezados de página dependen de lo que usted elija en ese diálogo.
        </p>
      </Seccion>

      {/* ── 11. Exportar a Excel ───────────────────────────────────────── */}
      <Seccion id="export" titulo="11. Exportar a Excel">
        <p>
          Cada proceso tiene un botón <strong>Exportar a Excel</strong> en su
          editor —y el control de asentamientos, en el panel del lugar—.
          Descarga un <code>.xlsx</code> con tres hojas:
        </p>

        <Tabla
          caption="Hojas del libro de Excel"
          columnas={["Hoja", "Contiene"]}
        >
          {HOJAS_EXCEL.map((h) => (
            <Fila key={h.hoja} celdas={[h.hoja, h.contiene]} />
          ))}
        </Tabla>

        <p>
          Con <strong>mínimos cuadrados</strong>, «Cálculos» añade la
          corrección de cada ángulo y la distancia ajustada, y «Resumen» los
          pesos y σ₀. El informe imprimible también indica los pesos y σ₀ de
          cada poligonal ajustada así. Si la poligonal se georreferenció,
          «Resumen» lleva además la sección «Georreferenciación», con la
          última.
        </p>

        <p>
          En control de asentamientos, «Datos Crudos» añade un bloque{" "}
          <strong>«Visitas»</strong> con el modo de captura, el BM de amarre,
          el cierre y la tolerancia de cada una, y el libro lleva una cuarta
          hoja, <strong>«Libretas»</strong>: la libreta de cada visita que la
          tiene, con sus cotas calculadas y compensadas.
        </p>

        <p>
          A diferencia del informe, la exportación funciona{" "}
          <strong>en cualquier estado</strong>: también sobre un borrador. Las
          celdas que aún no se han calculado salen vacías, no en cero — en
          topografía un <code>0.000</code> es una posición, no un dato que
          falta.
        </p>
      </Seccion>

      {/* ── 10. Preguntas frecuentes ───────────────────────────────────── */}
      <Seccion id="faq" titulo="12. Preguntas frecuentes">
        <dl className="flex flex-col gap-5">
          {PREGUNTAS.map((p) => (
            <div key={p.pregunta}>
              <dt className="font-semibold text-neutral-900">{p.pregunta}</dt>
              <dd className="mt-1 text-neutral-800">{p.respuesta}</dd>
            </div>
          ))}
        </dl>
      </Seccion>
    </div>
  );
}

// ── Piezas de la página ───────────────────────────────────────────────────

function Seccion({
  id,
  titulo,
  children,
}: {
  id: string;
  titulo: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="mb-14 scroll-mt-6">
      <h2 className="border-b border-neutral-200 pb-2 text-2xl font-bold">
        {titulo}
      </h2>
      <div className="mt-6 flex flex-col gap-4">{children}</div>
    </section>
  );
}

/** Vuelve al índice. Útil tras una captura larga, sobre todo en el teléfono. */
function VolverArriba() {
  return (
    <p className="mt-2">
      <a
        href="#indice"
        className="text-sm font-medium text-primary-600 hover:text-primary-700"
      >
        ↑ Volver al índice
      </a>
    </p>
  );
}

/**
 * Bloque destacado: los `>` del Markdown original.
 *
 * No usa `Alert` a propósito: `Alert` lleva `role="alert"` siempre, y una nota
 * informativa de un manual no es una alerta activa.
 */
function Nota({ titulo, children }: { titulo?: string; children: ReactNode }) {
  return (
    <aside className="rounded-md border-l-4 border-primary-500 bg-primary-50 px-4 py-3">
      {titulo && (
        <p className="text-sm font-semibold text-primary-700">{titulo}</p>
      )}
      <div className="text-sm text-neutral-900">{children}</div>
    </aside>
  );
}

/**
 * Captura de la aplicación real, servida desde `public/manual/`.
 *
 * `<img>` y no `next/image`: son PNG estáticos ya generados al tamaño correcto.
 * `width`/`height` llevan las dimensiones reales para que el navegador reserve
 * el espacio y la página no dé un salto al cargar.
 */
function Captura({
  src,
  alt,
  pie,
  width,
  height,
  angosta,
  prioridad,
}: DatosCaptura & { prioridad?: boolean }) {
  return (
    <figure className="my-2">
      {/* eslint-disable-next-line @next/next/no-img-element --
          Ver el comentario de arriba: activos estáticos, no imágenes que
          necesiten optimización en tiempo de ejecución. */}
      <img
        src={src}
        alt={alt}
        width={width}
        height={height}
        // Solo la primera se carga de inmediato; las otras diez suman 2,8 MB.
        loading={prioridad ? "eager" : "lazy"}
        decoding="async"
        className={cn(
          "h-auto w-full rounded-lg border border-neutral-200 bg-white shadow-sm",
          // La captura de teléfono es muy estrecha y alta: estirarla al ancho
          // del contenedor la dejaría enorme y borrosa.
          angosta && "mx-auto max-w-xs",
        )}
      />
      {pie && (
        <figcaption className="mt-2 text-sm text-neutral-500">{pie}</figcaption>
      )}
    </figure>
  );
}

/** Tabla del manual. Desplaza en horizontal para no desbordar en el teléfono. */
function Tabla({
  caption,
  columnas,
  children,
}: {
  caption: string;
  columnas: string[];
  children: ReactNode;
}) {
  return (
    <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white">
      <table className="w-full text-sm">
        <caption className="px-4 pt-3 text-left text-sm font-medium text-neutral-800">
          {caption}
        </caption>
        <thead>
          <tr className="border-b border-neutral-200 text-left">
            {columnas.map((columna) => (
              <th key={columna} scope="col" className="px-4 py-2 font-semibold">
                {columna}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

function Fila({ celdas }: { celdas: ReactNode[] }) {
  const [primera, ...resto] = celdas;
  return (
    <tr className="border-b border-neutral-100 last:border-0">
      <th
        scope="row"
        className="px-4 py-2 text-left font-medium text-neutral-900"
      >
        {primera}
      </th>
      {resto.map((celda, i) => (
        <td key={i} className="px-4 py-2 text-neutral-800">
          {celda}
        </td>
      ))}
    </tr>
  );
}
