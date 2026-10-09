import type { Metadata } from "next";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";
import {
  CAPTURAS,
  COLUMNAS_LISTADO,
  ESTADOS_PROCESO,
  METODOS_CORRECCION,
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
  VERIFICACION_TRAMO,
  type Captura as DatosCaptura,
} from "./manual-data";

export const metadata: Metadata = {
  title: "Manual de usuario — TopoField",
  description:
    "Cómo usar TopoField: proyectos, poligonales, nivelación, control de asentamientos, informes y trabajo en campo.",
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
        <p className="mt-2 max-w-2xl text-ink">
          Cómo registrar los datos de campo, calcularlos con validación en vivo
          e informarlos. Cubre lo que la aplicación permite hacer hoy, que es
          el alcance completo del proyecto: los tres módulos de proceso, el
          informe de cada uno y su exportación a PDF y a Excel.
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
                className="inline-block rounded-full border border-rule bg-card px-3 py-1 text-sm font-medium text-ink transition-colors hover:bg-sel"
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
          aquí: van en cada proceso —poligonal, nivelación, visita de
          asentamiento—, porque pueden cambiar de un levantamiento a otro
          dentro de un mismo proyecto. El orden no se declara: se detecta al
          calcular.
        </p>

        <p>
          <strong>Proceso.</strong> Un levantamiento concreto dentro de un
          proyecto: una poligonal, una nivelación, un control de asentamientos.
          La poligonal, la nivelación y cada visita de asentamientos pasan por
          estados:
        </p>

        <Tabla
          caption="Estados de un proceso"
          columnas={["Estado", "Significado"]}
        >
          {ESTADOS_PROCESO.map((e) => (
            <Fila key={e.estado} celdas={[e.estado, e.significado]} />
          ))}
        </Tabla>

        <p>El lugar de asentamientos no tiene estado: agrupa sus visitas.</p>

        <p>
          <strong>Cálculo en vivo.</strong> Ningún proceso se cierra (§ 8): lo
          que se captura se guarda al confirmarlo y todo se recalcula al
          momento. Corregir una lectura, la cota de un BM o la C0 de un punto
          cambia lo que depende de ellos, y la aplicación avisa antes cuánto
          cambia. El informe de cada proceso también se recalcula: muestra lo
          que tenga al abrirlo (§ 10).
        </p>
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
          <strong>proyecto de ejemplo</strong> hecho con{" "}
          <strong>carteras de campo reales</strong>, ya calculadas, para que
          pueda ver cómo funciona la aplicación sin capturar nada:
        </p>
        <ul className="ml-5 list-disc space-y-1">
          <li>
            Tres poligonales: la <strong>V10</strong>, amarrada a TT4, en
            tercer orden; la de la <strong>Sede Vivero</strong>, ajustada por
            mínimos cuadrados, y la misma en un sistema local, lista para{" "}
            <strong>georreferenciar</strong> con los vértices D1 y D3 del
            catálogo.
          </li>
          <li>
            Dos nivelaciones: la de <strong>El Verjón</strong>, con ida y vuelta
            por los mismos puntos —verá su discrepancia, la diferencia punto a
            punto entre ida y vuelta y la compensación del circuito—, y el{" "}
            <strong>tramo 2</strong>, leído del archivo de un nivel digital
            Leica.
          </li>
          <li>
            Dos controles de asentamientos: <strong>Torre Alameda</strong>,
            simulado, con catorce visitas, BM-1 y BM-2 como BM del lugar, la
            visita 9 sin verificación y la 13 con BM-2 desplazado; y la cartera
            real <strong>Control de asentamiento estructural</strong>: dieciséis
            puntos y siete visitas de una armada desde el BM de la piscina, de
            marzo a junio de 2022.
          </li>
        </ul>
        <p>Puede modificarlo o archivarlo cuando quiera.</p>
        <p>Cada usuario ve únicamente sus propios proyectos.</p>
        <p>
          <strong>La barra de arriba.</strong> Queda fija mientras baja por
          cualquier pantalla. A la izquierda, el logo vuelve al dashboard, y a
          su lado va la <strong>ruta</strong> de la pantalla —«Dashboard ›
          Proyecto de ejemplo › Poligonal Famarena…»—: cada nombre lleva a ese
          nivel. En el teléfono, la ruta se reduce al nivel anterior, con «‹».
          A la derecha, <strong>Equipos</strong> (§ 12) y{" "}
          <strong>Manual</strong>, y un círculo con la inicial de su correo: el{" "}
          <strong>menú de cuenta</strong>, con el correo, el tema y{" "}
          <strong>Cerrar sesión</strong>.
        </p>
        <p>
          <strong>Tema claro u oscuro.</strong> En el menú de cuenta —y con el
          icono de arriba a la derecha en la pantalla de inicio de sesión— se
          elige el tema: <strong>Sistema</strong> sigue la configuración del
          teléfono o del computador, y <strong>Claro</strong> u{" "}
          <strong>Oscuro</strong> lo fijan. La elección se recuerda en ese
          navegador. El informe impreso sale siempre en claro.
        </p>
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
            listos para revisar.
          </li>
          <li>
            <strong>Fuera de tolerancia</strong> — procesos calculados que no
            cumplen su tolerancia —una poligonal o una nivelación, si no
            alcanza ningún orden—, y lugares con algún punto en alerta o alarma
            en una visita calculada. Requieren revisión.
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
          <strong>«Proyecto de ejemplo»</strong> con carteras de campo reales
          —poligonales, nivelaciones y un control de asentamientos— y otro
          control de asentamientos simulado, para que explore la aplicación con
          datos reales (§ 2). Puede modificarlo o archivarlo cuando quiera.
        </Nota>
      </Seccion>

      {/* ── 4. Proyectos ───────────────────────────────────────────────── */}
      <Seccion id="proyectos" titulo="4. Proyectos">
        <h3 className="text-lg font-semibold">4.1 Crear un proyecto</h3>

        <Captura {...CAPTURAS.nuevoProyecto} />

        <p>
          El formulario reúne en una página los{" "}
          <strong>datos básicos</strong> —nombre, descripción, cliente,
          ubicación y, si quiere, las coordenadas geográficas en grados
          decimales— y el <strong>sistema de referencia</strong>: datum y
          proyección. El proyecto se crea al pulsar{" "}
          <strong>Crear proyecto</strong>.
        </p>

        <Nota titulo="El equipo y el orden de precisión no se piden aquí">
          Cada poligonal, cada nivelación y cada visita de asentamiento lleva
          su equipo, y su orden se detecta al calcularla. Un mismo proyecto
          puede así tener trabajos de distinto orden, medidos con instrumentos
          distintos y en fechas distintas. Vea{" "}
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
          La cabecera muestra el nombre y el estado del proyecto, su cliente,
          su ubicación y su sistema de referencia, y el botón{" "}
          <strong>+ Nuevo Proceso</strong>. Debajo, dos pestañas:
        </p>

        <ul className="ml-5 list-disc space-y-1">
          <li>
            <strong>Procesos</strong> — el listado de levantamientos del
            proyecto. Se detalla en el apartado siguiente. Cada proceso lleva
            su informe en su propia pantalla (4.4).
          </li>
          <li>
            <strong>Configuración</strong> — los datos del proyecto (también la
            descripción), los puntos de referencia, y archivar o eliminar el
            proyecto.
          </li>
        </ul>

        <Captura {...CAPTURAS.configuracionProyecto} />

        <p>
          Los <strong>puntos de referencia</strong> son coordenadas conocidas
          (vértices geodésicos, mojones) que puede reutilizar como punto de
          partida o de llegada de sus poligonales, sin volver a teclearlas.
          Las visitas de asentamiento no los usan: cada lugar tiene sus propios
          BM (§ 7.3).
        </p>

        <p>
          <strong>Archivar o eliminar.</strong> Archivar oculta el proyecto de
          la lista activa del dashboard; puede restaurarlo cuando quiera.
          Eliminarlo lo borra con todo lo que contiene, de forma permanente.
        </p>

        <h3 className="mt-4 text-lg font-semibold">
          4.3 El listado de procesos
        </h3>

        <p>
          Los chips <strong>Poligonales</strong>,{" "}
          <strong>Nivelaciones</strong> y{" "}
          <strong>Control de Asentamientos</strong> eligen el módulo, con
          cuántos tiene cada uno. Los tres listados funcionan igual, con una
          barra para encontrar lo que busca.
        </p>

        <p>
          <strong>Buscar.</strong> Filtra por nombre mientras escribe. No
          distingue mayúsculas ni acentos: «via» encuentra «Vía terciaria».
        </p>

        <p>
          <strong>Filtrar por estado.</strong> Los chips muestran cuántos hay
          en cada grupo, así que ve la distribución del proyecto sin desplegar
          nada. Pulse uno para ver solo ese grupo:{" "}
          <strong>Borradores</strong> o <strong>Calculados</strong>. El control
          de asentamientos no los tiene: el lugar no tiene estado.
        </p>

        <p>
          <strong>Filtrar por tipo.</strong> El selector acota a un tipo de
          poligonal, de nivelación o de estructura.
        </p>

        <p>
          Cuando hay algún filtro activo aparece{" "}
          <strong>Limpiar filtros</strong>, para volver a verlo todo de un clic.
        </p>

        <Nota>
          Cada listado recuerda el último filtro que usó en cada proyecto, así
          que al volver lo encuentra como lo dejó. Si abre un enlace que alguien le
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
          Pulse <strong>Nombre</strong>, la columna de resultado o{" "}
          <strong>Última actividad</strong> para ordenar por esa columna; pulsar
          de nuevo invierte el orden. Por defecto se ordena por actividad
          reciente, así que lo que está trabajando queda arriba.
        </p>

        <p>
          <strong>Acciones por fila.</strong> Cada fila ofrece siempre las
          tres, porque ningún proceso se cierra:
        </p>

        <ul className="ml-5 list-disc space-y-1">
          <li>
            <strong>Duplicar</strong> — crea uno nuevo con la misma
            configuración: una poligonal sin estaciones, una nivelación sin
            lecturas, un lugar con sus umbrales, su catálogo de puntos y sus BM
            pero sin visitas.
          </li>
          <li>
            <strong>Renombrar</strong> — cambia el nombre sin abrirlo.
          </li>
          <li>
            <strong>Eliminar</strong> — lo borra con lo que contiene, con
            confirmación previa.
          </li>
        </ul>

        <p>
          En el teléfono, la tabla se convierte en tarjetas, una por fila, con
          las mismas acciones.
        </p>

        <h3 className="mt-4 text-lg font-semibold">
          4.4 La pantalla de un proceso
        </h3>

        <p>
          Los tres módulos comparten la cabecera. Lleva sus rótulos —el tipo
          y, si lo tiene, el estado—, el nombre, sus datos y cuándo se guardó
          por última vez, y las acciones <strong>Editar datos</strong> y, bajo{" "}
          <strong>⋯</strong>, <strong>Duplicar</strong> y{" "}
          <strong>Eliminar</strong>. La ruta de la barra devuelve al listado
          del que vino.
        </p>

        <p>
          Debajo van los pasos de la poligonal —<strong>Datos</strong>,{" "}
          <strong>Ajuste</strong> e <strong>Informe</strong>— y de la
          nivelación —<strong>Libreta</strong>,{" "}
          <strong>Compensación</strong> e <strong>Informe</strong>— (
          <a href="#pantalla-por-pasos" className="underline">
            § 5.3
          </a>{" "}
          y{" "}
          <a href="#pantalla-por-pasos-nivelacion" className="underline">
            § 6.5
          </a>
          ), o las pestañas del lugar de asentamientos —
          <strong>Panel</strong>, <strong>Puntos</strong>,{" "}
          <strong>BMs</strong> e <strong>Informe</strong>—, cuya cabecera
          añade <strong>+ Nueva visita</strong> (
          <a href="#asentamientos" className="underline">
            § 7
          </a>
          ).
        </p>

        <p>
          <strong>No hay botón Guardar.</strong> Cada popup guarda al
          confirmar, y la libreta de una visita, lectura por lectura (
          <a href="#armada-visita" className="underline">
            § 7.7
          </a>
          ).
        </p>

        <p>
          <strong>El informe.</strong> El paso o la pestaña{" "}
          <strong>Informe</strong> muestra el informe de ese proceso (
          <a href="#informes" className="underline">
            § 10
          </a>
          ). Solo allí la cabecera empieza con dos botones,{" "}
          <strong>Exportar PDF</strong> y <strong>Exportar Excel</strong> (
          <a href="#export" className="underline">
            § 11
          </a>
          ): los demás pasos y pestañas no exportan.
        </p>

        <Captura {...CAPTURAS.informeDelProceso} />

        <p>
          No lleva marca de borrador ni registro de cierre: ningún proceso se
          cierra, y el informe muestra lo que tenga al abrirlo.
        </p>

        <VolverArriba />
      </Seccion>

      {/* ── 5. Poligonales ─────────────────────────────────────────────── */}
      <Seccion id="poligonales" titulo="5. Poligonales">
        <p>
          La poligonal se trabaja como la mide el topógrafo: un alta corta y
          tres pasos en una sola pantalla —<strong>1 · Datos</strong>,{" "}
          <strong>2 · Ajuste</strong> y <strong>3 · Informe</strong>—.{" "}
          <strong>No hay botón Guardar</strong>: cada popup guarda al
          confirmar. Y <strong>la poligonal no se cierra</strong>: queda
          calculada y se corrige cuando haga falta; su informe dice qué orden
          de precisión alcanzó.
        </p>

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
          Desde el proyecto, <strong>+ Nuevo Proceso → Poligonal</strong> abre
          un popup:
        </p>

        <ul className="ml-5 list-disc space-y-1">
          <li>
            <strong>Título</strong>, el único obligatorio.
          </li>
          <li>
            <strong>Ubicación</strong>, <strong>Responsable</strong> y{" "}
            <strong>Cargo del responsable</strong>: salen en el informe y en
            el Excel.
          </li>
          <li>
            <strong>Tipo de poligonal</strong>, con una línea que explica cómo
            se verifica cada uno.
          </li>
          <li>
            <strong>Equipo</strong>, plegado y opcional: marca, modelo y número
            de serie de la estación total, que se escriben.
          </li>
        </ul>

        <p>
          <strong>Crear y empezar</strong> lleva al paso de Datos. Lo que no se
          pide: el <strong>orden de precisión</strong> y el{" "}
          <strong>tipo de ángulo</strong> se detectan al calcular (§ 5.4 y
          § 5.5).
        </p>

        <p>
          Estos datos se cambian después con <strong>Editar datos</strong>, en
          la cabecera. Cambiar el tipo cuando ya hay mediciones las recalcula
          con el tipo nuevo, y el popup lo avisa.
        </p>

        <h3
          id="pantalla-por-pasos"
          className="mt-4 scroll-mt-6 text-lg font-semibold"
        >
          5.3 La pantalla por pasos
        </h3>

        <p>
          La <strong>cabecera</strong> lleva el tipo, el estado y el orden
          alcanzado; el título, la ubicación, el responsable, el equipo y
          cuándo se guardó por última vez; y las acciones{" "}
          <strong>Editar datos</strong> y, bajo <strong>⋯</strong>,{" "}
          <strong>Duplicar</strong> y <strong>Eliminar</strong>. En el paso
          Informe se suman, delante, <strong>Exportar PDF</strong> y{" "}
          <strong>Exportar Excel</strong> (§ 5.7).
        </p>

        <p>
          Debajo van los tres pasos y, a la derecha,{" "}
          <strong>Ángulos en</strong>: <strong>DMS (° ′ ″)</strong> o{" "}
          <strong>Grados decimales</strong>. El formato rige la tabla, el
          ajuste, el informe y los popups, y se recuerda por proceso.
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
        </ul>

        <h3 id="paso-datos" className="mt-4 scroll-mt-6 text-lg font-semibold">
          5.4 Paso 1 · Datos
        </h3>

        <Captura {...CAPTURAS.datosPoligonal} />

        <p>
          Dos columnas: a la izquierda, el amarre, las mediciones y el cierre
          angular; a la derecha, el dibujo, que se queda fijo mientras baja la
          página.
        </p>

        <p>
          <strong>Los puntos de amarre.</strong> Una poligonal nueva empieza
          por ellos: <strong>Ingresar puntos de amarre</strong> abre un popup
          con
        </p>

        <ul className="ml-5 list-disc space-y-1">
          <li>
            la <strong>estación de partida</strong>: nombre, Norte y Este, o{" "}
            <strong>Tomar del catálogo</strong>;
          </li>
          <li>
            la <strong>referencia, 0° atrás</strong>, de tres maneras:{" "}
            <strong>Punto con coordenadas</strong> —el azimut de partida se
            calcula solo y el popup lo muestra—,{" "}
            <strong>Solo el azimut</strong> —si no tiene sus coordenadas: el
            nombre y el azimut de la partida a la referencia— o{" "}
            <strong>Sin 0 atrás</strong>, con el azimut del primer lado;
          </li>
          <li>
            en la abierta con control, la <strong>llegada</strong>: el punto
            conocido, con su Norte y su Este, y el azimut de llegada si lo
            tiene. Con él se comprueba también el cierre angular.
          </li>
        </ul>

        <p>
          Los puntos con coordenadas se guardan en el catálogo del proyecto. Si
          el nombre ya existe con otras coordenadas, el punto toma las que
          usted tecleó: así se corrige el amarre, y la poligonal se recalcula
          con las mediciones que ya tiene, sin volver a medir. Antes de
          guardar, el popup avisa qué puntos cambian en el catálogo, con sus
          coordenadas de antes y las otras poligonales que los usan. Dos
          puntos del amarre no pueden llamarse igual con coordenadas
          distintas. Sin 0 atrás, la partida no va al catálogo: puede ser
          local.
        </p>

        <p>
          Con mediciones, el amarre se edita pero{" "}
          <strong>no se pone ni se quita el 0 atrás</strong>: cambiaría lo que
          significa el primer ángulo —de orientación a vértice, o al revés—. El
          popup pide deshacer las mediciones antes.
        </p>

        <p>
          Si levanta en un sistema local,{" "}
          <strong>Medir sin amarre, en coordenadas locales</strong> arranca en
          P1 (1000, 1000) con azimut 0°. Cuando tenga las coordenadas reales,
          edite el amarre o georreferencie (§ 5.6).
        </p>

        <p>
          <strong>Las mediciones.</strong> La tabla se lee como la cartera:
          cada fila va <strong>desde → hacia</strong> —«V10 → D1»—, con el
          ángulo medido en el punto de partida, la distancia y el{" "}
          <strong>azimut sin ajustar</strong>, encadenado con los ángulos tal
          como se midieron. La primera fila es el <strong>0 atrás</strong>; el
          lado que vuelve a la partida lleva la marca <strong>cierre</strong>,
          y la fila del cierre angular, <strong>cierre angular</strong>.
        </p>

        <p>
          <strong>+ Agregar punto</strong> abre el popup de medición:
        </p>

        <ul className="ml-5 list-disc space-y-1">
          <li>arriba, dónde está: «Estás en D1 · atrás en V10»;</li>
          <li>
            el <strong>punto siguiente</strong>;
          </li>
          <li>
            las <strong>lecturas del ángulo</strong>: una o varias, con{" "}
            <strong>+ Lectura</strong>. Con dos o más, el popup muestra el
            promedio y la dispersión entre ellas; el promedio es el ángulo que
            entra en el cálculo. La dispersión es un dato: la aplicación no la
            juzga;
          </li>
          <li>
            en la abierta con control, el <strong>sentido</strong> de la
            deflexión: derecha o izquierda;
          </li>
          <li>
            la <strong>distancia horizontal</strong> hasta el punto siguiente.
          </li>
        </ul>

        <p>
          <strong>Agregar y seguir en D2</strong> guarda y deja el popup listo
          para la medición siguiente; <strong>Terminar</strong> guarda y lo
          cierra. Sin 0 atrás, la primera medición no lleva ángulo.
        </p>

        <p>
          Desde la segunda medición de una cerrada aparece la casilla{" "}
          <strong>Cierre: este lado vuelve a V10</strong>, que fija como
          siguiente la estación de partida. Al agregar el cierre, el popup
          sigue con el <strong>cierre angular</strong>:
        </p>

        <ul className="ml-5 list-disc space-y-1">
          <li>
            amarrada, en la estación de partida: hacia la referencia —la
            cartera cierra contra el amarre, como la TT4— o, si desmarca la
            casilla, hacia el primer lado —el ángulo del vértice de arranque,
            como la cartera de la Sede Vivero—;
          </li>
          <li>
            sin amarre, el ángulo en P1, entre el último punto y P2: se mide al
            final, porque al empezar no había punto atrás.
          </li>
        </ul>

        <p>
          En la abierta con control la casilla es{" "}
          <strong>Llegada: este lado llega a …</strong>, y con azimut de
          llegada el cierre angular es la deflexión en el punto de llegada.
          Mientras falte el cierre angular,{" "}
          <strong>Medir el cierre angular</strong> ocupa el lugar de{" "}
          <strong>+ Agregar punto</strong>.
        </p>

        <p>
          El lápiz de cada fila abre el mismo popup para{" "}
          <strong>editarla</strong> —el ángulo, la distancia o el nombre del
          punto siguiente— o <strong>eliminarla</strong>. Eliminar una medición
          intermedia quita esa estación: el punto siguiente pasa a medirse
          desde el anterior, y el popup lo avisa.{" "}
          <strong>Deshacer la última medición</strong> retrocede de a una:
          primero el cierre angular, después el cierre y luego cada lado.
        </p>

        <p>
          Los errores se detectan al confirmar y se quedan en el popup, sin
          perder lo tecleado: un ángulo sin lecturas, minutos o segundos fuera
          de 0-59, segundos con más de una cifra decimal, una distancia de
          cero, mayor a 1000 m o con más de cuatro decimales, un punto sin
          nombre o repetido.
        </p>

        <p>
          <strong>El cierre angular</strong>, debajo de la tabla, resume la
          cerrada: vértices, <strong>tipo de ángulo</strong> con la marca{" "}
          <em>detectado</em>, ángulos en la condición, suma observada y
          teórica, error angular y la corrección que le toca a cada ángulo. En
          la abierta con control, el error contra el azimut de llegada.
        </p>

        <Nota titulo="El tipo de ángulo se detecta">
          Interiores y exteriores solo cambian la suma teórica —(n − 2)·180°
          frente a (n + 2)·180°— y difieren en 720°: la suma observada dice
          sin ambigüedad cuál midió.
        </Nota>

        <p>
          <strong>El dibujo</strong> muestra lo medido, sin ajustar, y crece
          con cada medición. En una cerrada, el último lado no llega
          exactamente a la partida: ese hueco es el error de cierre, a escala
          real. En el teléfono, un selector <strong>Tabla | Dibujo</strong>{" "}
          alterna entre las dos columnas (§ 9).
        </p>

        <h3 id="paso-ajuste" className="mt-4 scroll-mt-6 text-lg font-semibold">
          5.5 Paso 2 · Ajuste
        </h3>

        <Captura {...CAPTURAS.ajustePoligonal} />

        <p>
          <strong>El método.</strong> Arriba, el selector. Cambiarlo recalcula
          y guarda al instante.
        </p>

        <Tabla
          caption="Métodos de corrección"
          columnas={["Método", "Cómo reparte el error"]}
        >
          {METODOS_CORRECCION.map((m) => (
            <Fila key={m.metodo} celdas={[m.metodo, m.reparte]} />
          ))}
        </Tabla>

        <p>
          Una abierta sin control no tiene nada que ajustar: el paso muestra
          sus coordenadas encadenadas, sin selector.
        </p>

        <p>
          <strong>El orden alcanzado.</strong> Cuatro cifras: error angular,
          error de cierre lineal, precisión relativa y{" "}
          <strong>orden alcanzado</strong>, el más alto que cumple a la vez la
          tolerancia angular y la precisión relativa mínima de su orden.
        </p>

        <Captura {...CAPTURAS.ordenAlcanzado} />

        <p>
          <strong>Por qué</strong> despliega cada orden con su tolerancia y su
          precisión mínima, y si la poligonal las cumple:
        </p>

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

        <p>
          Donde <em>n</em> es el número de ángulos que entran en la condición:
          los vértices de una cerrada —más el de cierre si cierra contra el
          amarre— o las deflexiones de una abierta con control. En la cartera
          TT4, el error de 12″ cabe en segundo orden (13.2″), pero 1:7.045
          solo alcanza el tercero (1:5.000): <strong>tercer orden</strong>. Si
          no alcanza ni el ordinario, la cifra dice{" "}
          <strong>No alcanza ningún orden</strong> y el informe lo alerta.
        </p>

        <Nota titulo="El orden no se declara: se detecta">
          Es el mismo con cualquier método, porque se juzga con el error de la
          cartera tal como se midió, antes de corregir.
        </Nota>

        <p>
          <strong>La poligonal ajustada.</strong> La tabla al estilo de la hoja
          de cálculo: cada lado «desde → hacia» con el ángulo corregido, el
          azimut, la distancia, las proyecciones, las proyecciones corregidas y
          las coordenadas del punto al que llega. La fila <strong>Σ</strong>{" "}
          suma las proyecciones: en las crudas, el error de cierre; en las
          corregidas, cero. En el teléfono, la tabla se desplaza de lado.
        </p>

        <p>
          <strong>Corrección por método …</strong> resume cómo corrigió el
          método elegido: el reparto del error angular —en la TT4, −1.71″ en
          cada uno de los 7 ángulos, incluido el de orientación— y sus cifras
          propias:
        </p>

        <ul className="ml-5 list-disc space-y-1">
          <li>
            Brújula: las diferencias ΔN y ΔE, el perímetro y el factor −e/P de
            cada eje;
          </li>
          <li>
            Tránsito: la suma de proyecciones absolutas y la corrección
            unitaria de cada eje;
          </li>
          <li>
            Crandall: los multiplicadores λ₁ y λ₂ del ajuste de las
            distancias.
          </li>
        </ul>

        <p>
          <strong>Mínimos cuadrados.</strong> Los otros tres métodos reparten el
          error con una regla fija; este busca las correcciones más pequeñas
          —pesadas por la precisión de cada observación— que hacen cerrar la
          poligonal. Al elegirlo, el panel explica qué necesita y aparecen tres
          campos:
        </p>

        <ul className="ml-5 list-disc space-y-1">
          <li>
            <strong>σ angular (″)</strong>: la precisión de un ángulo, de la
            ficha de la estación total.
          </li>
          <li>
            <strong>σ de distancia (m)</strong>: la de una medición de
            distancia, también de la ficha.
          </li>
          <li>
            <strong>Veces que se midió cada distancia</strong>: 1 si la cartera
            anota una sola. Una distancia medida <em>n</em> veces pesa como σ/√
            <em>n</em>.
          </li>
        </ul>

        <p>
          <strong>No hacen falta más lecturas por punto</strong>: la
          comprobación la da el cierre, con 3 condiciones (2 si la abierta no
          tiene azimut de llegada). Todas las observaciones pesan igual. Los dos
          σ <strong>salen vacíos</strong>, porque dependen de su equipo: la
          aplicación no los supone por usted. «Veces que se midió cada
          distancia» empieza en 1. La hoja de la universidad usa, por ejemplo,
          2″, 0.011 m y 2 mediciones. Se guardan al salir del campo, cuando
          están los tres; mientras tanto, el ajuste dice cuáles faltan. Si
          cambia de método, los pesos se conservan para cuando vuelva.
        </p>

        <Captura {...CAPTURAS.minimosCuadrados} />

        <p>
          Con los pesos completos aparece la{" "}
          <strong>corrección de cada ángulo</strong>, en segundos, y de{" "}
          <strong>cada distancia</strong>, en milímetros, junto a la distancia
          ajustada. El ángulo de orientación no se ajusta: es el{" "}
          <strong>datum</strong>, porque un error suyo rota la poligonal entera
          sin afectar al cierre. Debajo aparece <strong>σ₀</strong>, que
          compara lo medido con los pesos que supuso. Con pesos correctos ronda
          1, pero con tan pocas condiciones fluctúa mucho; por eso se juzga con
          la <strong>prueba χ² al 95 %</strong> de su número de condiciones, r
          (3, o 2 sin azimut de llegada):
        </p>

        <ul className="ml-5 list-disc space-y-1">
          <li>
            <strong>Dentro del intervalo</strong> (de 0.268 a 1.765 con r =
            3; de 0.159 a 1.921 con r = 2): los pesos describen bien sus
            observaciones.
          </li>
          <li>
            <strong>Por encima</strong>: midió peor de lo supuesto, o hay un
            error grueso en la cartera.
          </li>
          <li>
            <strong>Por debajo</strong>: sus σ son pesimistas; midió mejor de
            lo declarado.
          </li>
        </ul>

        <p>
          Si los pesos están pero no hay ajuste posible, un aviso dice por qué:
          con un solo lado, por ejemplo, las condiciones de llegada dependen de
          una sola distancia y no hay nada que ajustar. σ₀ es información, no
          un criterio: el orden alcanzado no depende del método.
        </p>

        <p>
          <strong>La precisión de cada punto.</strong> Con mínimos cuadrados,
          la tarjeta «Precisión de cada punto» dice cuánto se puede confiar en
          cada coordenada ajustada:
        </p>

        <ul className="ml-5 list-disc space-y-1">
          <li>
            <strong>σ N y σ E</strong>: la desviación típica (1σ) del Norte y
            del Este, en milímetros.
          </li>
          <li>
            <strong>La elipse de error al 95 %</strong>: sus semiejes mayor y
            menor, en milímetros, y el azimut del mayor. El punto está dentro de
            ella con un 95 % de probabilidad.
          </li>
        </ul>

        <p>
          La elipse al 95 % es la estándar multiplicada por un factor c que
          depende del número de condiciones (Ghilani y Wolf, ec. 19.22):{" "}
          <strong>4.37</strong> con r = 3 y <strong>6.16</strong> con r = 2. Es
          grande porque una poligonal simple solo se comprueba con su cierre.
          La partida, la vuelta a ella y el punto de llegada son fijos y no
          tienen elipse. Un semieje menor de 0 es un punto que solo puede
          moverse a lo largo del primer lado, porque el azimut de ese lado es
          fijo: en Vivero, D1.
        </p>

        <Captura {...CAPTURAS.precisionDeCadaPunto} />

        <p>
          El dibujo las traza en verde, exageradas: son milímetros sobre lados
          de decenas de metros.
        </p>

        <Captura {...CAPTURAS.elipsesDeError} />

        <p>
          <strong>El dibujo ajustado.</strong> La poligonal a escala sobre una
          grilla de coordenadas, con flecha de norte, barra de escala y el
          amarre si lo tiene.
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
          <li>
            Con <strong>mínimos cuadrados</strong>, en verde, la{" "}
            <strong>elipse de error al 95 %</strong> de cada vértice, exagerada
            por el factor que indica la leyenda (×500 en Vivero): son
            milímetros sobre lados de decenas de metros. El factor se elige solo
            para que la mayor ocupe alrededor del 15 % del dibujo.
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

        <h3
          id="georreferenciar"
          className="mt-4 scroll-mt-6 text-lg font-semibold"
        >
          5.6 Georreferenciar
        </h3>

        <p>
          Un levantamiento suele arrancar en un sistema local —(1000, 2000) y
          un azimut supuesto— y recibir coordenadas reales después. El botón{" "}
          <strong>Georreferenciar</strong>, junto al dibujo del paso de
          Ajuste, lo lleva al sistema real con{" "}
          <strong>dos de sus estaciones</strong> de coordenadas conocidas.
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
          <li>Confirme.</li>
        </ol>

        <p>
          La poligonal se <strong>gira y se traslada</strong>, sin escala: las
          distancias y los ángulos medidos no cambian, y el{" "}
          <strong>orden alcanzado tampoco</strong>. Se recalcula con el nuevo
          arranque, así que coordenadas, azimuts y proyecciones quedan en el
          sistema real. Sobre el dibujo queda anotada la última
          georreferenciación: fecha, puntos, rotación y factor de escala. Puede
          georreferenciar otra vez para corregir una coordenada mal tecleada.
        </p>

        <p>
          Si lo que tiene son las coordenadas reales del{" "}
          <strong>punto de partida y de la referencia</strong>, no hace falta
          georreferenciar: edite el amarre (§ 5.4) y la poligonal se recalcula
          desde ellos.
        </p>

        <p>El diálogo avisa, sin impedirlo, en tres casos:</p>

        <ul className="ml-5 list-disc space-y-1">
          <li>
            <strong>El factor de escala se aparta de 1</strong> más de lo que
            admite el orden alcanzado: la distancia real entre A y B no
            concuerda con la medida. Revise las coordenadas. Si están en una
            proyección con factor de escala distinto de 1 (p. ej. CTM12), la
            diferencia puede ser de la proyección y no un error.
          </li>
          <li>
            <strong>El método es Tránsito.</strong> Tránsito reparte el error
            según la orientación, así que sus coordenadas cambian unos
            milímetros más allá del giro. El orden alcanzado no cambia.
          </li>
          <li>
            <strong>El amarre es del catálogo.</strong> Sus coordenadas siguen
            en el sistema anterior, así que pasa a amarre manual con el mismo
            código, y el dibujo deja de mostrarlo.
          </li>
        </ul>

        <h3 id="paso-informe" className="mt-4 scroll-mt-6 text-lg font-semibold">
          5.7 Paso 3 · Informe
        </h3>

        <p>
          El informe de la poligonal (§ 10), con{" "}
          <strong>Exportar PDF</strong> y <strong>Exportar Excel</strong>{" "}
          (§ 11) en la cabecera. Sus datos y resultados son:
        </p>

        <ol className="ml-5 list-decimal space-y-1">
          <li>
            <strong>Resultado</strong>: las cuatro cifras y por qué alcanza su
            orden. Si no alcanza ninguno, una alerta lo dice: «No alcanza la
            precisión de ningún orden».
          </li>
          <li>
            <strong>Datos de campo</strong>: el amarre, las mediciones «desde →
            hacia» y el cierre angular, con su tolerancia.
          </li>
          <li>
            <strong>Corrección por método …</strong>: cómo corrigió el método
            elegido, paso a paso, con las cifras de esta poligonal. El reparto
            del error angular se dice con su valor por ángulo; el método de
            ajuste —y, en mínimos cuadrados, la elipse de error— lleva su
            fórmula en notación matemática, con una línea «donde:» que dice qué
            es cada símbolo.
          </li>
          <li>
            <strong>Poligonal ajustada</strong>, con la fila Σ.
          </li>
          <li>
            <strong>Coordenadas</strong> y el dibujo.
          </li>
        </ol>

        <Captura {...CAPTURAS.correccionInforme} />

        <p>
          No lleva marca de borrador: la poligonal no se cierra, y el informe
          muestra lo que tenga al abrirlo. Los ángulos salen en el formato
          elegido.
        </p>

        <VolverArriba />
      </Seccion>

      {/* ── 6. Nivelación ───────────────────────────────────────────────── */}
      <Seccion id="nivelacion" titulo="6. Nivelación">
        <p>
          La nivelación se trabaja como la mide el topógrafo, igual que la
          poligonal (§ 5): un alta corta y tres pasos en una sola pantalla
          —<strong>1 · Libreta</strong>, <strong>2 · Compensación</strong> y{" "}
          <strong>3 · Informe</strong>—. Cada armada se captura en un popup y{" "}
          <strong>no hay botón Guardar</strong>: cada popup guarda al
          confirmar. El <strong>orden de precisión se detecta</strong> al
          compensar, y <strong>la nivelación no se cierra</strong>: queda
          calculada y se corrige cuando haga falta; su informe dice qué orden
          alcanzó.
        </p>

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
          Sin recorrido de vuelta, la nivelación abierta sirve solo para
          reconocimiento: calcula cotas, pero no hay forma de comprobar si son
          correctas, igual que la poligonal abierta sin control (§ 5.1). No
          tiene orden ni se compensa, y la aplicación la rotula{" "}
          <strong>Abierta sin control</strong>. Con vuelta, su veredicto es la
          discrepancia entre ida y vuelta (§ 6.8), y se rotula{" "}
          <strong>Abierta con ida y vuelta</strong>.
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
          Una <strong>armada</strong> es una posición del nivel: la V+ a un
          punto que ya tiene cota y la V− al siguiente, con las vistas
          intermedias que se lean desde ahí. Por eso la columna{" "}
          <strong>AI solo tiene valor en las filas que llevan V+</strong>: la
          altura de instrumento es un dato de la armada, no de la fila. En la
          aplicación se captura armada por armada, y cada lectura va a la fila
          de su punto (§ 6.6).
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
          queda fuera de la comprobación aritmética: un error en su lectura no
          contamina el resto del recorrido. En la compensación recibe la
          corrección de su armada, la de la distancia acumulada hasta el
          instrumento.
        </p>

        <h3 className="mt-4 text-lg font-semibold">
          6.4 Crear una nivelación
        </h3>

        <Captura {...CAPTURAS.nuevaNivelacion} />

        <p>
          Desde el proyecto, <strong>+ Nuevo Proceso → Nivelación</strong>{" "}
          abre un popup:
        </p>

        <ul className="ml-5 list-disc space-y-1">
          <li>
            <strong>Título</strong>, obligatorio.
          </li>
          <li>
            <strong>¿Cómo es el recorrido?</strong>: cerrada, de enlace o
            abierta, cada una con su recorrido dibujado.
          </li>
          <li>
            <strong>Con vuelta</strong>, si va a volver por los mismos puntos.
          </li>
          <li>
            El <strong>BM de partida</strong> y su{" "}
            <strong>cota conocida</strong>; en la de enlace, también el{" "}
            <strong>BM de llegada</strong> y la suya. El BM se teclea.
          </li>
          <li>
            Plegados y opcionales: <strong>Ubicación</strong>,{" "}
            <strong>Responsable</strong>,{" "}
            <strong>Cargo del responsable</strong> y el{" "}
            <strong>equipo</strong>: marca, modelo y número de serie del nivel,
            o <strong>Tomar del catálogo</strong> (§ 12).
          </li>
        </ul>

        <p>
          <strong>Crear y empezar</strong> lleva a la libreta. Lo que no se
          pide: el <strong>orden de precisión</strong>, que se detecta al
          compensar (§ 6.7), y el tipo de nivel, que no entra en ningún
          cálculo.
        </p>

        <p>
          Estos datos se cambian después con <strong>Editar datos</strong>, en
          la cabecera. Cambiar el tipo o un BM recalcula la libreta, y quitar
          la vuelta borra su libreta: el popup avisa de los dos, y en el
          segundo dice cuántas armadas se borran.
        </p>

        <h3
          id="pantalla-por-pasos-nivelacion"
          className="mt-4 scroll-mt-6 text-lg font-semibold"
        >
          6.5 La pantalla por pasos
        </h3>

        <p>
          La <strong>cabecera</strong> lleva el tipo, el estado y el orden
          alcanzado; el título, la ubicación, el responsable, el equipo y
          cuándo se guardó por última vez; y las acciones{" "}
          <strong>Editar datos</strong> y, bajo <strong>⋯</strong>,{" "}
          <strong>Duplicar</strong> y <strong>Eliminar</strong>. En el paso
          Informe se suman, delante, <strong>Exportar PDF</strong> y{" "}
          <strong>Exportar Excel</strong> (§ 6.10). Debajo van los tres pasos
          y, a la derecha, <strong>Importar .L o CSV</strong> (§ 6.9).
        </p>

        <h3
          id="paso-libreta"
          className="mt-4 scroll-mt-6 text-lg font-semibold"
        >
          6.6 Paso 1 · Libreta
        </h3>

        <Captura {...CAPTURAS.libretaNivelacion} />

        <p>
          Dos columnas: a la izquierda, el BM, la libreta y su comprobación
          aritmética; a la derecha, el perfil, que se queda fijo mientras baja
          la página.
        </p>

        <p>
          <strong>El BM.</strong> Una tarjeta con el código y la cota del BM de
          partida y hacia dónde va: el circuito de una cerrada, el BM de
          llegada de una de enlace o el final sin cota conocida de una abierta.{" "}
          <strong>Editar</strong> abre su popup: el código y la cota y, en la
          de enlace, los del BM de llegada. Cambiar la cota del BM recalcula
          todas las cotas de la libreta, y cambiar su código cambia también las
          filas de la libreta que lo llevan.
        </p>

        <p>
          <strong>La tabla de la hoja.</strong> Como la cartera:{" "}
          <strong>Punto</strong>, <strong>V+</strong> y su distancia,{" "}
          <strong>AI</strong>, <strong>V−</strong> y su distancia,{" "}
          <strong>VI</strong> —la lectura de una vista intermedia— y la{" "}
          <strong>cota</strong>, sin compensar. Los rótulos marcan el{" "}
          <strong>BM</strong>, las vistas <strong>intermedias</strong> y, en
          una abierta, el <strong>fin de la ida</strong>. Con vuelta, un
          selector <strong>Ida | Vuelta</strong> cambia de recorrido. Las
          lecturas van con tres decimales, o con cuatro si vienen de un nivel
          digital.
        </p>

        <p>
          La tabla es de solo lectura: el <strong>lápiz</strong> de cada fila
          abre la armada que esa fila cierra; el del BM de partida, la primera,
          y el de una vista intermedia, la suya.{" "}
          <strong>+ Agregar armada</strong> abre la siguiente. Cuando la ida
          llega a su fin y hay vuelta, <strong>Seguir con la vuelta</strong>{" "}
          abre la primera armada de la vuelta, que parte del BM de partida en
          una cerrada, del de llegada en una de enlace o del final de la ida en
          una abierta. Una libreta vacía muestra solo la fila del BM, con{" "}
          <strong>+ Agregar la primera armada</strong> e{" "}
          <strong>Importar .L o CSV</strong>.
        </p>

        <p>
          <strong>El popup de armada.</strong>
        </p>

        <Captura {...CAPTURAS.armadaNivelacion} />

        <ul className="ml-5 list-disc space-y-1">
          <li>
            Arriba, dónde está el nivel: «El nivel entre C 1, ya con cota, y el
            punto siguiente».
          </li>
          <li>
            <strong>Vista atrás · V+</strong>: la lectura y la distancia.
          </li>
          <li>
            <strong>Vista adelante · V−</strong>: el punto, su lectura y su
            distancia.
          </li>
          <li>
            En cada visual,{" "}
            <strong>+ Hilos superior e inferior (opcional)</strong>. Con los
            dos, la distancia sale de ellos —(superior − inferior) × 100— y el
            campo lo dice: «de los hilos». La aplicación comprueba además que
            la lectura sea el promedio de los dos hilos, a 2 mm. Sin hilos, la
            distancia se teclea.
          </li>
          <li>
            <strong>+ Vista intermedia</strong>: el punto y la lectura de una
            radiación de esta armada.
          </li>
          <li>
            En la última armada, la <strong>casilla de fin</strong>:{" "}
            <strong>Llega al BM</strong> en la cerrada, que fija el punto en el
            BM de partida; <strong>Llega a</strong> el BM de llegada en la de
            enlace; <strong>Fin de la ida</strong> en la abierta; y en la
            vuelta, <strong>Llega a</strong> el BM de partida.
          </li>
          <li>
            Abajo, en vivo: la <strong>altura del instrumento</strong>, la{" "}
            <strong>cota del punto adelante</strong> y las dos distancias.
          </li>
        </ul>

        <p>
          <strong>Guardar y seguir desde C 2</strong> guarda y abre la armada
          siguiente; <strong>Guardar</strong> guarda y cierra el popup. Con la
          casilla de fin marcada y vuelta por medir,{" "}
          <strong>Guardar y seguir con la vuelta</strong>. En la última
          armada, <strong>Quitar la armada</strong> la borra. Editar una armada
          del medio solo cambia sus filas: el punto de cambio que la cierra
          conserva su V+, que abre la siguiente.
        </p>

        <p>
          Los errores se detectan al confirmar y se quedan en el popup, sin
          perder lo tecleado: una lectura fuera de 0 a 4 m, una distancia que
          falta o es cero, un hilo superior que no es mayor que el inferior, un
          punto sin código, o llegar al BM sin marcar la casilla de fin.
        </p>

        <Nota titulo="La distancia a cada mira es obligatoria en los BM y en los puntos de cambio">
          Sin ella el recorrido no acumula, la distancia total sale menor de la
          real y el punto de cierre queda mal corregido. Los puntos
          intermedios no la necesitan: no acumulan distancia. La distancia
          acumulada y la total <strong>no se teclean</strong>: la aplicación
          las suma sola.
        </Nota>

        <Nota titulo="La libreta a medias se guarda">
          Cada armada se guarda al confirmar, aunque el recorrido no haya
          llegado a su BM. Mientras tanto la nivelación está{" "}
          <em>En progreso</em> y la compensación espera: se calcula cuando la
          ida —y la vuelta, si la hay— llega a su fin.
        </Nota>

        <p>
          <strong>El perfil.</strong> Lo medido, sin compensar: la cota de cada
          punto frente a la distancia y, por cada armada, la{" "}
          <strong>mira atrás</strong> (V+), la <strong>visual</strong> a la
          altura del instrumento con el nivel, y la{" "}
          <strong>mira adelante</strong> (V−). Con vuelta, las armadas del otro
          recorrido se dibujan <strong>tenues</strong>. El BM de partida va
          siempre a la izquierda; arriba, la exageración vertical. «Ver datos
          en tabla» da los mismos valores en texto.
        </p>

        <p>
          <strong>Comprobación aritmética.</strong> Bajo la tabla: ΣV+ − ΣV−
          frente a la cota final menos la inicial —<strong>cuadra</strong> si
          coinciden— y la distancia del recorrido. Es una verificación de
          gabinete: confirma que las sumas y traslados de la libreta son
          correctos,{" "}
          <strong>no dice nada sobre la calidad de la medición</strong> —cuadra
          igual con un nivel descolimado—. Los puntos intermedios quedan fuera
          de esta suma.
        </p>

        <p>
          En el teléfono, un selector <strong>Tabla | Perfil</strong> alterna
          entre las dos columnas, y la libreta se ve como una lista por armada
          (§ 9).
        </p>

        <h3
          id="paso-compensacion"
          className="mt-4 scroll-mt-6 text-lg font-semibold"
        >
          6.7 Paso 2 · Compensación
        </h3>

        <Captura {...CAPTURAS.compensacionNivelacion} />

        <p>
          <strong>El método.</strong> Corrección proporcional a la distancia,
          el único, con una frase que dice qué error se reparte según el tipo.
        </p>

        <p>
          <strong>El orden alcanzado.</strong> Cuatro cifras: el{" "}
          <strong>error de cierre</strong> —en una abierta con vuelta, la{" "}
          <strong>discrepancia</strong>—, la <strong>distancia</strong>, la{" "}
          <strong>tolerancia</strong> del orden alcanzado y el{" "}
          <strong>orden alcanzado</strong>: el más alto cuya tolerancia K·√D
          cumple el trabajo. D es la distancia del recorrido{" "}
          <strong>en un solo sentido</strong>, en kilómetros, y K depende del
          orden:
        </p>

        <Tabla caption="Coeficiente K de la tolerancia K·√D" columnas={["Orden", "K (mm)"]}>
          {TOLERANCIA_NIVELACION.map((t) => (
            <Fila key={t.orden} celdas={[t.orden, t.k]} />
          ))}
        </Tabla>

        <p>
          <strong>Por qué</strong> despliega los cuatro órdenes con su
          tolerancia y si el trabajo la cumple. En una cerrada o de enlace con
          vuelta, cada recorrido se juzga con su propia distancia y tienen que
          cumplir los dos. En una abierta con vuelta se juzga la discrepancia
          contra K·√D·√2, con D el más corto de los dos recorridos. En El
          Verjón, la discrepancia de 5.0 mm cabe en segundo orden (5.3 mm) y no
          en primero (2.6 mm): <strong>segundo orden</strong>. El tramo 2
          cierra en −0.4 mm frente a 3.5 mm: <strong>primer orden</strong>.
        </p>

        <Nota titulo="El orden no se declara: se detecta">
          Antes la nivelación declaraba su orden y, si no lo cumplía, no se
          compensaba. Ahora se compensa y se dice qué orden alcanzó, como en la
          poligonal.
        </Nota>

        <p>
          <strong>Se compensa siempre</strong> que haya contra qué cerrar: la
          cerrada, la de enlace y la abierta con vuelta. Si el trabajo no
          alcanza ni el ordinario, se compensa igual y un aviso lo dice: «No
          alcanza ningún orden: la compensación se aplicó igual. En la
          práctica, un trabajo fuera de tolerancia se repite».
        </p>

        <p>
          <strong>La tabla.</strong> Sin vuelta: <strong>Punto</strong>,{" "}
          <strong>Dist. acum.</strong>, <strong>Cota medida</strong>,{" "}
          <strong>Corrección (mm)</strong> y <strong>Cota ajustada</strong>.
          Con vuelta: la <strong>cota de la ida</strong> y la de la{" "}
          <strong>vuelta</strong> de cada punto, su diferencia
          —<strong>Vuelta − ida (mm)</strong>—, la corrección de cada recorrido
          y la cota ajustada. Un punto que se lee dos veces —el BM de una
          cerrada— va en sus dos filas.
        </p>

        <p>
          La corrección es proporcional a la distancia acumulada, que es el
          recorrido <strong>desde el origen hasta el punto</strong>: llega
          hasta su V− y no cuenta la V+ que sale de él hacia la armada
          siguiente. A mayor distancia del origen, mayor corrección.{" "}
          <strong>El BM de partida no se corrige</strong>: su cota es
          conocida. Y el <strong>punto de cierre cierra exacto</strong> contra
          la suya.
        </p>

        <p>
          <strong>La cota ajustada.</strong> Una por punto: el promedio de sus
          cotas compensadas si se leyó dos veces —en la ida y en la vuelta, o
          al ir y al volver de un mismo recorrido—, su cota compensada si se
          leyó una, y la cota conocida en el BM de partida y, en la de enlace,
          en el de llegada.
        </p>

        <p>
          <strong>El gráfico.</strong> Uno solo: la{" "}
          <strong>cota ajustada</strong>, a escala, y lo{" "}
          <strong>medido</strong> —la ida y, si la hay, la vuelta— separado de
          ella con la diferencia <strong>exagerada ×1000</strong>: 1 mm se
          dibuja como 1 m. Las cifras de los extremos son esa diferencia, en
          mm. En El Verjón, la ida va 1.0 mm por encima en C 1, la vuelta 6.0
          mm por debajo, y las dos llegan a D4 2.5 mm por debajo de su cota
          ajustada.
        </p>

        <p>
          Una <strong>abierta sin vuelta</strong> no se compensa: el paso dice{" "}
          <strong>Sin compensación</strong> y muestra la comprobación
          aritmética. Una libreta a medias dice qué recorrido falta terminar y
          qué casilla marcar. Una libreta que <strong>no encadena</strong> —un
          punto de cambio al que le falta la V+ o la V−, o una comprobación
          aritmética que no cuadra— tampoco se compensa: la libreta y este paso
          dicen qué fila revisar, porque sus cotas salen de una altura de
          instrumento equivocada.
        </p>

        <h3
          id="ida-y-vuelta"
          className="mt-4 scroll-mt-6 text-lg font-semibold"
        >
          6.8 Ida y vuelta
        </h3>

        <p>
          Ida y vuelta son <strong>mediciones independientes</strong>. En campo
          se hace de dos maneras: con puntos de cambio propios en cada sentido,
          o <strong>volviendo por los mismos puntos</strong>. La aplicación
          admite las dos.
        </p>

        <p>
          La aplicación compara los <strong>desniveles totales</strong> de
          ambos recorridos. La discrepancia entre ellos se contrasta contra{" "}
          <strong>T·√2</strong>, donde T es la misma tolerancia K·√D del
          cierre individual, con D la menor de las dos distancias.
        </p>

        <ul className="ml-5 list-disc space-y-1">
          <li>
            En una <strong>abierta</strong>, la discrepancia es el veredicto:
            decide el orden alcanzado, y la muestran la lista de procesos del
            proyecto y el informe.
          </li>
          <li>
            En una <strong>cerrada</strong> o <strong>de enlace</strong>, el
            veredicto es el cierre de <strong>cada recorrido</strong>, cada uno
            con su propia distancia. La discrepancia es un control más.
          </li>
        </ul>

        <p>
          <strong>Cómo se compensa con vuelta.</strong>
        </p>

        <ul className="ml-5 list-disc space-y-1">
          <li>
            En una <strong>abierta</strong>, ida y vuelta forman un{" "}
            <strong>circuito</strong> que sale del BM de partida y vuelve a
            él. Lo que la vuelta llega de más o de menos al BM es el error del
            circuito, y se reparte por distancia a lo largo de los dos
            recorridos, como en una cerrada.
          </li>
          <li>
            En una <strong>cerrada</strong> o <strong>de enlace</strong>, cada
            recorrido se compensa con su propio cierre: la ida contra su cota
            conocida y la vuelta contra la del BM de partida.
          </li>
        </ul>

        <p>
          <strong>La cota del BM de partida no cambia nunca</strong>, y
          tampoco la del BM de llegada en una de enlace: son datos, no
          mediciones.
        </p>

        <p>
          En El Verjón el circuito mide 781.9 m y cierra en −5.0 mm. D4 queda
          en 3315.0855, entre lo que dicen la ida (3315.083) y la vuelta
          (3315.088), y C 1 en 3289.4400, el promedio de sus dos cotas
          compensadas, 3289.4414 y 3289.4386. Lo mismo vale para un recorrido
          único que vuelve por sus propios puntos, como el tramo 2.
        </p>

        <p>
          <strong>Vuelta − ida, punto a punto.</strong> Si la vuelta pasa por
          los mismos puntos, la tabla de la compensación compara la cota de
          cada punto en los dos recorridos, con las cotas sin compensar. Los
          códigos se emparejan sin distinguir espacios ni mayúsculas (
          <code>AUX1</code> y <code>AUX 1</code> son el mismo punto). Un único
          número de discrepancia esconde lo que la serie deja ver:
        </p>

        <ul className="ml-5 list-disc space-y-1">
          <li>
            si la diferencia <strong>crece a lo largo del recorrido</strong>,
            hay un error sistemático repartido;
          </li>
          <li>
            si <strong>salta en un punto</strong>, revise ese punto.
          </li>
        </ul>

        <h3
          id="importar-nivelacion"
          className="mt-4 scroll-mt-6 text-lg font-semibold"
        >
          6.9 Importar desde archivo
        </h3>

        <p>
          Con un nivel digital, las lecturas y las distancias ya están en un
          archivo. <strong>Importar .L o CSV</strong> —a la derecha de los
          pasos, o en la libreta vacía— las pasa a la libreta sin teclearlas.
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
          Al aceptar, la libreta se reemplaza y <strong>se guarda</strong>, y
          se propone el tipo de proceso: <strong>cerrada</strong> si el
          recorrido vuelve a su BM, <strong>abierta con vuelta</strong> si es
          ida y vuelta. Después, cada armada se corrige con su lápiz.
        </p>

        <h3
          id="paso-informe-nivelacion"
          className="mt-4 scroll-mt-6 text-lg font-semibold"
        >
          6.10 Paso 3 · Informe
        </h3>

        <p>
          El informe de la nivelación (§ 10), con{" "}
          <strong>Exportar PDF</strong> y <strong>Exportar Excel</strong>{" "}
          (§ 11) en la cabecera. Sus datos y resultados cambian según el tipo.
        </p>

        <p>
          Arriba, el <strong>resumen</strong>: el tipo, los BM, la distancia y
          el equipo; las cifras del orden alcanzado, y por qué lo alcanza —«La
          discrepancia cabe en la tolerancia de segundo orden, no en la de
          primer orden (2.6 mm)»—. Si no alcanza ninguno, una alerta lo dice.
          Después:
        </p>

        <ol className="ml-5 list-decimal space-y-1">
          <li>
            <strong>Datos iniciales</strong>: la libreta —la ida y, si la hay,
            la vuelta— con sus lecturas, su distancia acumulada y la cota
            medida.
          </li>
          <li>
            <strong>Datos ajustados</strong>: el método en una frase, con el
            error que se repartió, y la cota ajustada de cada punto. Con
            vuelta, junto a la cota de la ida y la de la vuelta; en una cerrada
            que vuelve por sus puntos, junto a sus dos lecturas; en las demás,
            junto a la cota medida y su corrección.
          </li>
          <li>
            <strong>El gráfico</strong> de la compensación.
          </li>
        </ol>

        <p>
          Una abierta sin vuelta no tiene datos ajustados: el informe dice que
          no tiene verificación. No lleva marca de borrador: la nivelación no
          se cierra, y el informe muestra lo que tenga al abrirlo.
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

        <p>
          Se trabaja como lo mide el topógrafo, igual que la poligonal y la
          nivelación (§ 5 y § 6): el <strong>lugar</strong> se crea en un popup
          y tiene cuatro pestañas —<strong>Panel</strong>,{" "}
          <strong>Puntos</strong>, <strong>BMs</strong> e{" "}
          <strong>Informe</strong>—, y cada <strong>visita</strong>, dos pasos
          —<strong>1 · Libreta</strong> y <strong>2 · Resultados</strong>—.{" "}
          <strong>No hay botón Guardar</strong>: cada popup guarda al
          confirmar, y la libreta, lectura por lectura. La visita{" "}
          <strong>no se compensa</strong> —la cota de cada punto es la de su
          lectura— y <strong>nada se cierra</strong>: todo se recalcula en
          vivo.
        </p>

        <h3 id="lugar" className="scroll-mt-6 text-lg font-semibold">
          7.1 El lugar
        </h3>

        <p>
          Un <strong>lugar</strong> es el sitio que se monitorea: un
          edificio, una presa, un terraplén. Agrupa un catálogo de puntos de
          control, sus BM y sus visitas sucesivas —es el equivalente, para
          este módulo, a lo que una poligonal o una nivelación son para los
          otros dos—.
        </p>

        <Captura {...CAPTURAS.nuevoLugar} />

        <p>
          Desde el proyecto,{" "}
          <strong>+ Nuevo Proceso → Control de Asentamientos</strong> abre un
          popup:
        </p>

        <ul className="ml-5 list-disc space-y-1">
          <li>
            <strong>Nombre</strong>, el único obligatorio.
          </li>
          <li>
            <strong>Tipo de estructura</strong>: edificio, presa, terraplén u
            otro. Precarga los umbrales del semáforo, y cambiarlo los vuelve a
            precargar.
          </li>
          <li>
            <strong>Descripción</strong>, opcional.
          </li>
          <li>
            <strong>Umbrales del semáforo</strong>, plegados: los de velocidad
            y de asentamiento acumulado típicos del tipo de estructura, que
            puede editar si el caso lo requiere.
          </li>
        </ul>

        <p>
          <strong>Crear lugar</strong> lleva a su panel. Los puntos de control
          se agregan después, en la pestaña Puntos (§ 7.2). Estos datos se
          cambian con <strong>Editar datos</strong>, en la cabecera, que abre
          el mismo popup.
        </p>

        <p>
          <strong>La pantalla del lugar.</strong> La cabecera lleva el tipo de
          estructura, el nombre, cuántos puntos de control y BM tiene, la
          fecha de la lectura base y cuándo se guardó por última vez; y las
          acciones <strong>+ Nueva visita</strong> (§ 7.4),{" "}
          <strong>Editar datos</strong> y, bajo <strong>⋯</strong>,{" "}
          <strong>Duplicar</strong> y <strong>Eliminar</strong>. En la pestaña
          Informe se suman, delante, <strong>Exportar PDF</strong> y{" "}
          <strong>Exportar Excel</strong> (§ 7.12). Debajo, las pestañas{" "}
          <strong>Panel</strong> (§ 7.11), <strong>Puntos</strong> (§ 7.2),{" "}
          <strong>BMs</strong> (§ 7.3) e <strong>Informe</strong> (§ 7.12).
        </p>

        <p>
          El lugar <strong>no tiene estado</strong>: ni activo ni cerrado.
          Admite visitas siempre.
        </p>

        <h3 id="puntos-control" className="mt-4 scroll-mt-6 text-lg font-semibold">
          7.2 Los puntos de control
        </h3>

        <Captura {...CAPTURAS.editorLugar} />

        <p>
          En la pestaña <strong>Puntos</strong>,{" "}
          <strong>Agregar punto</strong> pide el <strong>código</strong>, la{" "}
          <strong>ubicación</strong> y la <strong>cota C0</strong>: la
          referencia contra la que se mide el asentamiento acumulado de todas
          las visitas.
        </p>

        <p>
          La C0 es opcional. Si la deja vacía, la{" "}
          <strong>línea base del punto es su primera lectura</strong>: esa
          lectura queda con acumulado 0 y las siguientes se miden contra ella.
        </p>

        <p>
          Los puntos no llevan coordenadas: el módulo mide cuánto baja cada
          punto, no dónde está, así que no calcula distancias entre puntos,
          asentamientos diferenciales ni distorsión angular.
        </p>

        <p>
          La tabla da el código, la ubicación, la C0 y el estado de cada punto
          —<strong>Vigente</strong>, <strong>Alta el …</strong> o{" "}
          <strong>De baja desde el …</strong>, con su motivo—, y sus acciones:{" "}
          <strong>Editar</strong>, <strong>Dar de baja</strong> y{" "}
          <strong>Eliminar</strong>.
        </p>

        <ul className="ml-5 list-disc space-y-1">
          <li>
            <strong>Editar</strong> cambia el código, la ubicación y la C0,
            aunque el punto ya tenga lecturas. Cambiar la <strong>C0</strong>{" "}
            de un punto medido cambia su acumulado en cada visita: el popup
            avisa en cuántas —«Cambiar la C0 cambia el acumulado de este punto
            en 7 visitas»— y, al guardar otra vez, todo se recalcula.
          </li>
          <li>
            <strong>Renombrar un punto</strong> cambia también su código en la
            libreta de todas las visitas, para que su cota siga saliendo de su
            fila.
          </li>
          <li>
            <strong>Eliminar</strong> un punto con lecturas pide confirmación,
            con cuántas se pierden: <strong>Eliminar de todos modos</strong>.
          </li>
        </ul>

        <p>
          El catálogo puede cambiar a mitad del monitoreo —un punto se
          destruye, otro se instala—; ver{" "}
          <a href="#baja-alta" className="underline">
            § 7.13
          </a>
          .
        </p>

        <h3 id="bms-lugar" className="mt-4 scroll-mt-6 text-lg font-semibold">
          7.3 Los BM del lugar
        </h3>

        <Captura {...CAPTURAS.bmsLugar} />

        <p>
          Cada lugar tiene su propio catálogo de <strong>BM</strong>: los
          puntos de cota conocida desde donde se arman las visitas. Son del
          lugar y no se sincronizan con nada. La visita no usa los puntos de
          referencia del proyecto (§ 4.2).
        </p>

        <p>
          La tabla da el <strong>código</strong>, la <strong>cota</strong>, la{" "}
          <strong>descripción</strong>, el <strong>origen</strong> —de dónde
          vino— y en cuántas <strong>visitas</strong> arranca un tramo
          —«Amarre en 12»—.
        </p>

        <ul className="ml-5 list-disc space-y-1">
          <li>
            <strong>+ BM</strong> agrega uno: código, cota y una descripción
            opcional. El código no puede repetir el de otro BM del lugar,
            aunque cambien las mayúsculas o los espacios: «bm-1» es el mismo BM
            que «BM-1».
          </li>
          <li>
            <strong>Editar</strong> cambia sus datos. Si el BM lo usan algunas
            visitas, cambiar su <strong>cota</strong> o su{" "}
            <strong>código</strong> avisa en cuántas —«BM-1 se usa en 14
            visitas: al guardar se recalculan sus cotas»— y{" "}
            <strong>Guardar y recalcular</strong> las recalcula. Un código
            nuevo cambia también en sus libretas.
          </li>
          <li>
            <strong>Eliminar</strong> solo se puede si ninguna visita lo usa.
          </li>
          <li>
            <strong>Importar BM</strong> los trae de dos fuentes:
            <ul className="ml-5 mt-1 list-[circle] space-y-1">
              <li>
                <strong>De una nivelación del proyecto</strong>: elija una
                nivelación calculada y marque sus puntos; entran con su{" "}
                <strong>cota ajustada</strong> de hoy (§ 6.7).
              </li>
              <li>
                <strong>De un CSV</strong>: una fila por BM con{" "}
                <code>codigo,cota,descripcion</code> —la descripción es
                opcional—, separada por coma o por punto y coma. Con punto y
                coma, la cota admite coma decimal.
              </li>
            </ul>
          </li>
        </ul>

        <Nota titulo="Los BM importados son copias">
          Anotan su origen, pero no siguen a su fuente: si la nivelación cambia
          después, el BM no. Se corrigen aquí. Un código que ya está en el
          lugar no se importa: quítelo de la importación o edítelo.
        </Nota>

        <p>
          Un BM también puede nacer en campo: el punto auxiliar donde termina
          una armada (§ 7.7).
        </p>

        <h3 id="nueva-visita" className="mt-4 scroll-mt-6 text-lg font-semibold">
          7.4 Una visita nueva
        </h3>

        <p>
          Cada <strong>visita</strong> es una fecha en la que se releyeron los
          puntos. La primera es la <strong>línea base</strong>: fija el punto
          de partida y no tiene velocidad, porque no hay una visita anterior
          contra la que compararla. Su acumulado es cero en los puntos cuya C0
          es su lectura de esta visita; si la C0 viene de otra medición, la
          primera visita muestra ya lo que el punto se movió desde entonces.
        </p>

        <Captura {...CAPTURAS.nuevaVisita} />

        <p>
          <strong>+ Nueva visita</strong>, en la cabecera del lugar, abre un
          popup:
        </p>

        <ul className="ml-5 list-disc space-y-1">
          <li>
            <strong>Fecha</strong>: posterior a la de la última visita. Dos
            visitas del mismo lugar no comparten fecha, y al editar una su
            fecha tiene que quedar entre la de la anterior y la de la
            siguiente.
          </li>
          <li>
            <strong>Nivelador</strong>.
          </li>
          <li>
            <strong>Nota</strong>, opcional: sale en los Resultados y en el
            informe.
          </li>
          <li>
            <strong>Equipo</strong>, plegado y opcional: marca, modelo y
            número de serie del nivel, o <strong>Tomar del catálogo</strong>{" "}
            (§ 12).
          </li>
        </ul>

        <p>
          <strong>No pide BM ni cómo se mide.</strong> La libreta llega{" "}
          <strong>armada como la de la visita anterior</strong>: las mismas
          armadas, con sus BM, sus puntos de cambio y sus puntos de control,
          sin lecturas; sin los puntos dados de baja y con los dados de alta.
          La primera visita llega con una armada desde el primer BM del lugar
          y todos los puntos vigentes. El popup dice cuál de las dos trae. Si
          el lugar no tiene BM, pide agregarlos antes en la pestaña BMs
          (§ 7.3).
        </p>

        <p>
          <strong>Crear y empezar</strong> abre la visita en su libreta. Solo
          queda teclear las lecturas.
        </p>

        <h3 id="pantalla-visita" className="mt-4 scroll-mt-6 text-lg font-semibold">
          7.5 La pantalla de la visita
        </h3>

        <p>
          La <strong>cabecera</strong> lleva cuántas <strong>armadas</strong>{" "}
          tiene la visita, su <strong>verificación</strong> —el orden que
          alcanza o <strong>Sin verificación</strong> (§ 7.9)— y su estado:{" "}
          <strong>En medición</strong> si falta alguna lectura,{" "}
          <strong>Calculada</strong> si no. Debajo, «Visita 12 · fecha», el
          nivelador, el equipo y cuándo se guardó por última vez. Las
          acciones:
        </p>

        <ul className="ml-5 list-disc space-y-1">
          <li>
            <strong>← →</strong> pasan a la visita anterior o a la siguiente,
            en el mismo paso.
          </li>
          <li>
            <strong>Editar datos</strong> abre el popup del alta: fecha,
            nivelador, nota y equipo.
          </li>
          <li>
            <strong>Eliminar</strong> borra la visita con su libreta y sus
            lecturas. Cualquier visita se elimina, también una del medio: el
            parcial y la velocidad de la siguiente se recalculan contra la
            anterior.
          </li>
        </ul>

        <p>
          Debajo van los dos pasos y, a la derecha,{" "}
          <strong>Importar .L o CSV</strong> (§ 7.8).
        </p>

        <h3
          id="paso-libreta-visita"
          className="mt-4 scroll-mt-6 text-lg font-semibold"
        >
          7.6 Paso 1 · Libreta
        </h3>

        <Captura {...CAPTURAS.editorVisita} />

        <p>
          Dos columnas: a la izquierda, la libreta; a la derecha, fijas
          mientras baja la página, las armadas, la verificación de cada tramo
          y el movimiento de cada punto desde la visita anterior.
        </p>

        <p>
          <strong>La tabla de la hoja.</strong> La de la nivelación (§ 6.6):{" "}
          <strong>Punto</strong>, <strong>V+</strong> y su distancia,{" "}
          <strong>AI</strong>, <strong>V−</strong> y su distancia,{" "}
          <strong>VI</strong> —la lectura a un punto de control— y la{" "}
          <strong>cota</strong>. Los rótulos marcan el{" "}
          <strong>BM del lugar</strong> donde arranca cada tramo, los{" "}
          <strong>puntos de cambio</strong>, el BM del lugar donde el tramo{" "}
          <strong>cierra</strong> o <strong>llega</strong>, un BM del lugar
          leído de paso con su diferencia —«BM · -0.4 mm»— y los puntos{" "}
          <strong>pendientes</strong> de leer. El lápiz de cada fila abre su
          armada (§ 7.7).
        </p>

        <p>
          <strong>Armadas.</strong> Una fila por armada —«Armada 1 · desde
          BM-1», con de dónde sale, cuántas vistas a puntos lleva y su V−— con{" "}
          <strong>Editar</strong>, o <strong>Retomar</strong> si le falta
          alguna lectura. <strong>+ Armada</strong> agrega la siguiente.
        </p>

        <p>
          <strong>Los tramos.</strong> Una tarjeta por tramo —«Tramo desde
          BM-1», «vuelve a BM-1»— con su <strong>Cierre</strong> y su{" "}
          <strong>Orden alcanzado</strong> (§ 7.9). Debajo, el aviso de cada BM
          del lugar leído de paso y la nota «Las cotas son las de la medida: el
          cierre comprueba, no se reparte.»
        </p>

        <p>
          <strong>Movimiento desde la visita anterior.</strong> Una barra por
          punto, en mm, y el aviso de cada lectura fuera de tendencia (§ 7.9):
          «B10 bajó 50.0 mm en 12 días; a su ritmo anterior serían unos 17.1
          mm. Verifica la lectura.»
        </p>

        <p>
          <strong>La medición a medias.</strong> Si falta alguna lectura, la
          visita queda <strong>En medición</strong> y la libreta lo dice
          arriba: <strong>La medición quedó a medias</strong>, con la armada y
          el punto que faltan. <strong>Retomar medición</strong> abre esa
          armada con el cursor en la primera lectura que falta. Nada se
          pierde: lo leído ya está guardado.
        </p>

        <p>
          <strong>Puntos sin lectura.</strong> Debajo de la libreta, un aviso
          nombra los puntos de control vigentes que no tienen fila —«P-05 no
          tiene lectura en la libreta: queda sin cota en esta visita.»—, por
          ejemplo tras importar un archivo al que le falta alguno. Otro avisa
          la lectura de un punto que no está vigente en la fecha de la visita:
          no se usa. Un punto con su fila por leer no avisa: eso es la medición
          a medias.
        </p>

        <p>
          Una visita sin armadas muestra{" "}
          <strong>+ Agregar la primera armada</strong>. Si el lugar no tiene
          BM, la libreta pide agregar uno en la pestaña <strong>BMs</strong>:
          cada armada sale de un BM del lugar o de un punto de cambio.
        </p>

        <p>
          En el teléfono, la libreta es la lista de armadas, con sus lecturas
          y sus cotas; pulsar una la abre (§ 9).
        </p>

        <h3 id="armada-visita" className="mt-4 scroll-mt-6 text-lg font-semibold">
          7.7 La armada
        </h3>

        <Captura {...CAPTURAS.armadaVisita} />

        <p>
          Una <strong>armada</strong> es una posición del nivel (§ 6.2): una
          vista atrás a un punto con cota, las vistas a los puntos de control
          y, si la hay, una vista adelante. Su popup —«Armada 2 · visita 12»—
          tiene tres partes:
        </p>

        <ul className="ml-5 list-disc space-y-1">
          <li>
            <strong>Vista atrás · V+.</strong> <strong>Desde</strong> dónde
            sale: <strong>Un BM del lugar</strong>, que se elige de la lista y
            empieza un tramo, o <strong>Un punto de cambio</strong>, la V− de
            la armada anterior, que solo se ofrece si esa armada terminó en
            uno. Se elige antes de la primera lectura guardada; después, y al
            editar, queda fijo. Luego, la lectura y la distancia,{" "}
            <strong>opcional</strong>, con{" "}
            <strong>+ Hilos superior e inferior (opcional)</strong> como en la
            nivelación.
          </li>
          <li>
            <strong>Vistas a los puntos.</strong> Una fila por punto, ya
            cargada con los de la plantilla: su <strong>lectura</strong> (VI),
            su <strong>cota</strong> en vivo y un <strong>✓</strong> cuando
            quedó guardada. <strong>+ Otro punto</strong> agrega uno con
            código libre.
          </li>
          <li>
            <strong>Vista adelante · V−.</strong>{" "}
            <strong>Sin vista adelante</strong> termina la armada en sus
            puntos. Si no, el <strong>punto</strong>, su{" "}
            <strong>lectura</strong> y su <strong>distancia</strong>, opcional:
            <ul className="ml-5 mt-1 list-[circle] space-y-1">
              <li>
                a un <strong>BM del lugar</strong>, con el rótulo{" "}
                <strong>cierra en un BM</strong>: el tramo que salió de su BM{" "}
                <strong>cierra</strong> en él, si es el mismo, o{" "}
                <strong>llega</strong>, si es otro, y se verifica. El popup
                muestra el <strong>Cierre</strong> o la{" "}
                <strong>Llegada</strong> y el <strong>Orden alcanzado</strong>;
              </li>
              <li>
                a <strong>otro punto</strong>, con el rótulo{" "}
                <strong>punto de cambio</strong>: la armada siguiente puede
                seguir desde él. Si no es punto de control ni BM del lugar, es
                un <strong>punto auxiliar</strong>.
              </li>
            </ul>
          </li>
        </ul>

        <p>
          Abajo, en vivo, la <strong>altura del instrumento</strong> y la cota
          del punto adelante.
        </p>

        <p>
          <strong>Cada lectura se guarda al escribirla</strong>: al salir del
          campo o con Enter, que además pasa al campo siguiente, como en la
          libreta de papel. Los guardados van en orden, y el pie dice cómo
          van: «Leídos 5 de 9 · guardado», «guardando…» o «sin guardar». Si la
          red falla, el error se queda en el popup con lo tecleado, y se
          reintenta con la lectura siguiente. Los errores de captura —una
          lectura fuera de 0 a 4 m, una distancia de cero, un punto sin
          código— también se quedan en el popup.
        </p>

        <p>Los botones:</p>

        <ul className="ml-5 list-disc space-y-1">
          <li>
            <strong>Seguir después</strong> cierra el popup. Lo leído ya está
            guardado; si falta algo, la visita queda En medición. Con un dato
            mal escrito no se cierra —tampoco con la X—: muestra el error hasta
            que lo corrija o lo borre.
          </li>
          <li>
            <strong>Terminar armada</strong> la da por terminada: los puntos
            que quedaron sin leer salen de la libreta.
          </li>
          <li>
            <strong>Terminar y seguir con la armada 3</strong> —si la libreta
            ya la trae—, <strong>Terminar y seguir desde CP-1</strong> —si la
            V− fue a un punto de cambio— o{" "}
            <strong>Terminar y agregar armada</strong>: termina y abre la
            siguiente.
          </li>
          <li>
            <strong>Quitar la armada</strong>, en la última, la borra.
          </li>
        </ul>

        <p>Dos preguntas al guardar:</p>

        <ul className="ml-5 list-disc space-y-1">
          <li>
            <strong>Un punto de control en dos armadas.</strong> Una visita da
            una cota por punto. El popup «TA-04 está en dos armadas» muestra
            las dos lecturas con su cota y su diferencia: elija la que se
            queda, y <strong>Eliminar la de la armada N</strong> borra la
            otra.
          </li>
          <li>
            <strong>Una V− a un punto auxiliar.</strong> Al terminar la
            armada, «¿Guardar CP-1 en los BM del lugar?», con su cota medida
            hoy y una descripción opcional.{" "}
            <strong>Guardar en los BM</strong> lo agrega al lugar (§ 7.3), y
            las próximas visitas pueden armarse desde él;{" "}
            <strong>Solo en esta visita</strong> lo deja como punto de cambio.
          </li>
        </ul>

        <p>
          En el teléfono, el popup ocupa la pantalla, con la barra de guardado
          fija abajo.
        </p>

        <h3 id="importar-visita" className="mt-4 scroll-mt-6 text-lg font-semibold">
          7.8 Importar la libreta
        </h3>

        <Captura {...CAPTURAS.importarLibretaVisita} />

        <p>
          Con un nivel digital, <strong>Importar .L o CSV</strong>, a la
          derecha de los pasos, pasa a la libreta el archivo{" "}
          <strong>.L de Leica</strong> o la <strong>plantilla CSV</strong> de
          TopoField, como en nivelación (§ 6.9), con tres diferencias:
        </p>

        <ul className="ml-5 list-disc space-y-1">
          <li>
            el archivo se lee como <strong>un solo tramo</strong> desde el BM
            de su primera fila, que{" "}
            <strong>tiene que estar en los BM del lugar</strong>; si no, el
            diálogo pide agregarlo antes en la pestaña BMs;
          </li>
          <li>
            se guardan las <strong>lecturas</strong>: la cota de cada punto
            sale de la medida, no del archivo;
          </li>
          <li>
            <strong>reemplaza la libreta</strong> de la visita, y el diálogo lo
            avisa si ya tenía lecturas.
          </li>
        </ul>

        <p>
          Revise el tipo de cada punto antes de aceptar: los puntos de control
          suelen ser vistas intermedias. <strong>Usar estas lecturas</strong>{" "}
          guarda la libreta. Si al archivo le falta algún punto del lugar, la
          libreta lo avisa (§ 7.6).
        </p>

        <h3 id="calculo-visita" className="mt-4 scroll-mt-6 text-lg font-semibold">
          7.9 El cálculo
        </h3>

        <p>
          La visita <strong>no compensa</strong>: el cierre de un tramo
          comprueba la medida, no se reparte. La cota de cada punto es la de
          su lectura:
        </p>

        <ul className="ml-5 list-disc space-y-1">
          <li>
            <strong>AI = cota + V+</strong>: la altura del instrumento de la
            armada, con la cota del BM del lugar o del punto de cambio de donde
            sale.
          </li>
          <li>
            <strong>Cota = AI − lectura</strong>: la VI de un punto de control,
            o la V− del punto adelante.
          </li>
        </ul>

        <p>
          <strong>Los tramos.</strong> Un tramo empieza en una armada que sale
          de un BM del lugar y sigue por sus puntos de cambio. Si su última V−
          cae en un BM del lugar, se <strong>verifica</strong>: en el mismo BM
          es un <strong>cierre</strong>; en otro, una{" "}
          <strong>llegada</strong>. El error se contrasta con la tolerancia
          K·√L de cada orden, con L la distancia del tramo en kilómetros y K la
          de la nivelación (§ 6.7), y el tramo alcanza el orden más alto que
          cumple.
        </p>

        <Tabla
          caption="Verificación de un tramo de la visita"
          columnas={["El tramo…", "Qué dice"]}
        >
          {VERIFICACION_TRAMO.map((t) => (
            <Fila key={t.tramo} celdas={[t.tramo, t.dice]} />
          ))}
        </Tabla>

        <p>
          La cartera real es una sola armada por visita, de radiaciones desde
          el BM de la piscina: sus tramos terminan en sus puntos y quedan sin
          verificación.
        </p>

        <p>
          <strong>La verificación de la visita</strong> es la de su tramo
          peor: si todos se verifican, el orden más bajo de ellos; si alguno
          no, <strong>Sin verificación</strong>. La llevan la cabecera de la
          visita, el informe y el Excel. En Torre Alameda, la visita 12, de dos
          armadas por CP-1, cierra en −1.6 mm en BM-1: segundo orden. La 9
          supera todas las tolerancias y queda sin verificación.
        </p>

        <p>
          <strong>Un BM del lugar leído de paso.</strong> Todas las cotas de un
          tramo salen de su BM de arranque: si ese BM se movió, todos los
          puntos parecen asentarse a la vez. Para detectarlo, haga pasar la
          libreta también por <strong>otro BM del lugar</strong>, como una
          vista más. Es lo que recomienda el protocolo de campo: nivelar
          primero entre BMs.
        </p>

        <p>
          La aplicación compara la cota que la libreta le da a ese BM con la
          suya en los BM del lugar, con la tolerancia de{" "}
          <strong>tercer orden</strong> sobre la distancia recorrida desde el
          arranque:
        </p>

        <ul className="ml-5 list-disc space-y-1">
          <li>
            si nivela, la libreta lo dice: «BM-2 nivela con BM-1: -0.4 mm,
            tolerancia 2.0 mm.»;
          </li>
          <li>
            si no, avisa con las dos cotas. Uno de los dos BM pudo moverse, o
            hay un error en la libreta o en la cota del BM. Con dos BM no se
            sabe cuál se movió; con un tercero, comparándolos entre sí, sí.
          </li>
        </ul>

        <p>
          <strong>Solo avisa.</strong> El aviso queda en la libreta, en el
          popup de la armada y con <strong>⚠</strong> junto a la fecha en la
          tabla de visitas del panel. En Torre Alameda, la visita 13 muestra
          BM-2 desplazado.
        </p>

        <p>
          <strong>Parcial, acumulado, velocidad y estado.</strong> Con la cota
          de cada punto, la aplicación calcula al instante:
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
              § 7.11
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
          La lectura de un punto que no está vigente en la fecha de la visita
          —de baja, o dado de alta después— no se usa.
        </p>

        <p>
          <strong>Lecturas fuera de tendencia.</strong> Desde la tercera
          lectura de un punto, la aplicación compara cada cota con la
          tendencia de ese punto y avisa si la lectura:
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
          El margen absorbe el ruido de medición de las dos cotas que se
          comparan, y es <strong>fijo: 6 mm</strong> entre dos visitas, sin
          depender del orden ni de la longitud de la libreta. Moverse{" "}
          <strong>menos</strong> de lo previsto nunca avisa, porque un
          asentamiento por consolidación frena con el tiempo. En la cartera
          real, B10 avisa en la visita 3 —baja 50.0 mm en 12 días, donde su
          ritmo preveía unos 17.1— y en la 4, contra su tendencia.
        </p>

        <p>
          El aviso sale en la libreta (§ 7.6), en los avisos del panel (§ 7.11)
          y en el informe.
        </p>

        <Nota titulo="El aviso no bloquea">
          Pide verificar la lectura en la libreta o volver a medir; una
          lectura atípica también puede ser real. Si dos visitas seguidas
          salen marcadas, casi siempre el error está en la primera: la
          segunda se compara contra una velocidad ya contaminada.
        </Nota>

        <h3 id="paso-resultados" className="mt-4 scroll-mt-6 text-lg font-semibold">
          7.10 Paso 2 · Resultados
        </h3>

        <Captura {...CAPTURAS.vistaVisita} />

        <p>
          <strong>Indicadores.</strong> Una franja con cuatro:
        </p>

        <ul className="ml-5 list-disc space-y-1">
          <li>
            <strong>Asentamiento máximo</strong>: el acumulado de mayor
            magnitud, con sus puntos.
          </li>
          <li>
            <strong>Promedio</strong>: el promedio encadenado de la visita
            (§ 7.11), con su cambio frente a la anterior.
          </li>
          <li>
            <strong>Mayor movimiento</strong>: el parcial de mayor magnitud,
            con sus puntos y los días desde la anterior.
          </li>
          <li>
            <strong>Alerta</strong>: la peor de la visita, y cuántos puntos
            están en precaución o más.
          </li>
        </ul>

        <p>
          <strong>Nota de la visita.</strong> La que se escribió en el alta o
          en <strong>Editar datos</strong>.
        </p>

        <p>
          <strong>Puntos de control.</strong> Por punto:{" "}
          <strong>Cota (m)</strong>, <strong>Parcial</strong>,{" "}
          <strong>Acumulado</strong>, <strong>Velocidad</strong>,{" "}
          <strong>Estado</strong> —el semáforo (§ 7.11)— y{" "}
          <strong>Tendencia</strong>: <strong>Acelera</strong> o{" "}
          <strong>Converge</strong>.
        </p>

        <p>
          <strong>Tendencia.</strong> Desde la tercera lectura de un punto,
          dice si <strong>acelera</strong> —su velocidad crece más de lo que
          explica el error de las lecturas— o <strong>converge</strong>. Las
          dos velocidades salen de las tres últimas cotas del punto, así que
          el margen suma el ruido de las tres: con visitas a intervalos
          iguales, es unas √3 veces el del aviso de lectura fuera de
          tendencia, dividido entre el intervalo. En Torre Alameda, con
          visitas cada 28 días, 11,3 mm/mes. Un solo salto no basta para decir
          que un punto acelera.
        </p>

        <p>
          <strong>El gráfico.</strong> Al lado, fijo:{" "}
          <strong>Acumulado</strong>, por punto, con las líneas de los
          umbrales, o <strong>Desde la anterior</strong>, el movimiento de cada
          punto.
        </p>

        <h3 id="panel-lugar" className="mt-4 scroll-mt-6 text-lg font-semibold">
          7.11 El panel del lugar
        </h3>

        <Captura {...CAPTURAS.panelAsentamientos} />

        <p>
          Abrir el lugar desde el proyecto lleva a su pestaña{" "}
          <strong>Panel</strong>, que reúne el historial completo.
        </p>

        <p>
          <strong>Indicadores.</strong> Cinco, en una franja, sobre la última
          visita y el histórico:
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
          El <strong>promedio es encadenado</strong>: el de la visita anterior
          más la media de lo que se movieron los puntos medidos en las dos. Un
          punto dado de alta entra con acumulado 0 y uno dado de baja deja de
          contar; la media de los acumulados se movería con eso sin que nada
          se asentara, el encadenado no. Sin altas ni bajas, los dos
          coinciden.
        </p>

        <p>
          <strong>Visitas.</strong> De la más reciente a la más antigua: la
          visita —con <strong>En medición</strong> si le falta alguna
          lectura—, la fecha —con <strong>⚠</strong> si un BM del lugar leído
          de paso no nivela (§ 7.9)—, el promedio y el máximo del acumulado, el{" "}
          <strong>mayor Δ</strong> desde la anterior y la peor alerta. Pulse
          una fila para resaltarla en la tendencia; el enlace de la visita la
          abre.
        </p>

        <p>
          <strong>Tendencia.</strong> Al lado, fija mientras baja la página,
          con dos vistas:
        </p>

        <ul className="ml-5 list-disc space-y-1">
          <li>
            <strong>Promedio</strong>: el promedio de los puntos en cada
            visita, con una banda que va del punto menos asentado al más
            asentado y las líneas de los umbrales. La visita elegida en la
            tabla va resaltada. El eje horizontal es el{" "}
            <strong>tiempo</strong>, no el número de visita: si las visitas
            pasan de quincenales a mensuales, la pendiente no se exagera.
          </li>
          <li>
            <strong>Por punto</strong>: el acumulado de cada punto de control
            según los días desde la lectura base. Los chips de arriba muestran
            el último valor de cada punto; pulse uno para resaltarlo y atenuar
            los demás, y <strong>Todos</strong> para volver. Cada punto se
            distingue por{" "}
            <strong>forma de marcador además de color</strong> (círculo,
            cuadrado, triángulo, rombo, cruz), y las marcas «(de baja)» y
            «(alta …)» señalan los puntos que salieron o entraron a mitad del
            monitoreo.
          </li>
        </ul>

        <p>
          Debajo, la última visita en una línea: cuántos puntos están normales
          y los tres más asentados. Bajo cada gráfica,{" "}
          <strong>Ver datos en tabla</strong> despliega los mismos valores en
          texto: la alternativa para cuando la gráfica no basta.
        </p>

        <p>
          <strong>Avisos.</strong> Las lecturas fuera de tendencia de todas las
          visitas, por punto y visita (§ 7.9).
        </p>

        <p>
          <strong>Semáforo por punto.</strong> El estado de cada punto, según
          sus umbrales de velocidad y de acumulado — gana el peor de los dos.
          La columna de alerta de las visitas da el peor de cada una, y la
          columna Estado de los Resultados, el de cada punto (§ 7.10). Tiene
          cuatro niveles:
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
          <strong>Un dato en alarma se registra con normalidad.</strong> El
          semáforo es un diagnóstico, no un control de captura: la aplicación{" "}
          <strong>nunca</strong> impide guardar una lectura por dejar un punto
          en alerta o alarma. Un asentamiento alarmante es exactamente el
          hallazgo que este módulo existe para documentar; bloquearlo
          ocultaría el dato que más importa.
        </p>

        <h3 id="informe-lugar" className="mt-4 scroll-mt-6 text-lg font-semibold">
          7.12 El informe del lugar
        </h3>

        <p>
          La pestaña <strong>Informe</strong> muestra el informe del lugar
          (§ 10), con <strong>Exportar PDF</strong> y{" "}
          <strong>Exportar Excel</strong> (§ 11) en la cabecera. Sus datos y
          resultados son:
        </p>

        <ol className="ml-5 list-decimal space-y-1">
          <li>
            Los datos del lugar: tipo de estructura, puntos de control —y
            cuáles están de baja—, visitas, y el BM de arranque y el equipo de
            la última.
          </li>
          <li>
            <strong>Veredicto</strong>: la peor alerta de la última visita y el
            mayor acumulado, con lo que le falta para el umbral siguiente, y si
            las visitas se verifican (§ 7.9).
          </li>
          <li>
            <strong>Cómo se calcula</strong>: en un párrafo, cómo salen la cota
            de cada punto, el acumulado y la velocidad —con un mes de 30.4375
            días—, y los umbrales del semáforo.
          </li>
          <li>
            <strong>Evolución</strong>: el acumulado de cada punto en el
            tiempo.
          </li>
          <li>
            <strong>Visitas</strong>: el promedio, el máximo, el mayor Δ, la
            verificación y la peor alerta de cada una.
          </li>
          <li>
            <strong>Puntos de la última visita</strong>: su acumulado, su
            velocidad y su estado.
          </li>
          <li>
            <strong>Notas de las visitas</strong> y <strong>avisos</strong> de
            lecturas fuera de tendencia.
          </li>
        </ol>

        <p>
          Informa las visitas <strong>calculadas</strong>: las que están en
          medición se nombran aparte, con su fecha, como no incluidas, y entran
          cuando se terminan. Una visita no
          tiene informe propio: sus resultados van en el del lugar.
        </p>

        <h3 id="baja-alta" className="mt-4 scroll-mt-6 text-lg font-semibold">
          7.13 Dar de baja y de alta un punto
        </h3>

        <p>
          Los puntos que se miden no son siempre los mismos durante todo el
          monitoreo. Un punto se destruye, se tapa o se pierde; otro se
          instala cuando la obra avanza.
        </p>

        <p>
          <strong>Dar de baja.</strong> En la pestaña Puntos,{" "}
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
          dice desde cuándo está de baja. Las visitas nuevas ya no lo traen en
          su libreta. Un punto de baja no se edita.
        </p>

        <p>
          <strong>Deshacer baja</strong> la quita, para corregir un error. Si un
          punto tapado aparece de nuevo, puede haberse movido: regístrelo como{" "}
          <strong>punto nuevo</strong>, con otro código y su propia línea base,
          no como la continuación de su serie.
        </p>

        <Nota titulo="Borrar no es dar de baja">
          Eliminar un punto se lleva sus lecturas de todas las visitas. Si se
          perdió en campo, dele de baja: su serie sigue en el análisis. Borrar
          queda para los puntos creados por error.
        </Nota>

        <p>
          <strong>Dar de alta.</strong> Un punto que se agrega cuando el lugar
          ya tiene visitas se da de alta: el formulario pide la{" "}
          <strong>fecha de alta</strong> en lugar de la C0, porque su línea
          base será su <strong>primera lectura</strong>, no la de la primera
          visita del lugar. Las visitas nuevas desde esa fecha lo traen en su
          libreta; a una que ya existe se agrega con{" "}
          <strong>+ Otro punto</strong> (§ 7.7).
        </p>

        <VolverArriba />
      </Seccion>

      {/* ── 8. Sin cierre ──────────────────────────────────────────────── */}
      <Seccion id="cierre" titulo="8. Sin cierre">
        <p>
          Ningún proceso se cierra: ni la poligonal (§ 5), ni la nivelación
          (§ 6), ni el lugar o la visita de asentamientos (§ 7). No hay{" "}
          <strong>Cerrar</strong> ni <strong>Reabrir</strong>, ni modo de solo
          lectura, ni registro de cierre, y un proyecto se puede eliminar
          siempre (§ 4.2).
        </p>

        <p>Lo que daba el cierre lo dan ahora tres cosas:</p>

        <ul className="ml-5 list-disc space-y-1">
          <li>
            <strong>Todo se recalcula en vivo.</strong> Corregir una lectura,
            la cota de un BM o la C0 de un punto recalcula lo que depende de
            ellos —en asentamientos, todas las visitas que los usan—, y la
            aplicación avisa antes cuánto cambia.
          </li>
          <li>
            <strong>El orden se detecta.</strong> La poligonal, la nivelación
            y cada tramo de una visita dicen qué orden de precisión
            alcanzaron, y su informe alerta si no alcanzan ninguno (§ 5.5,
            § 6.7 y § 7.9).
          </li>
          <li>
            <strong>El PDF guarda el momento.</strong> El informe de cada
            proceso muestra lo que tenga al abrirlo; el PDF que exporte de él
            (§ 10) queda como estaba ese día.
          </li>
        </ul>
      </Seccion>

      {/* ── 9. Trabajo en campo ────────────────────────────────────────── */}
      <Seccion id="campo" titulo="9. Trabajo en campo">
        <p>
          La aplicación está pensada para usarse también desde el teléfono, en
          sitio.
        </p>

        <Captura {...CAPTURAS.datosMovil} />

        <p>
          En el teléfono, el paso de Datos de una poligonal apila sus columnas
          y un selector <strong>Tabla | Dibujo</strong> alterna entre las
          mediciones y el dibujo. La tabla lleva el azimut bajo cada punto, sin
          desplazamiento lateral, y cada medición se captura en su popup, que
          ocupa el ancho de la pantalla. Los campos de grados, minutos y
          segundos son lo bastante amplios para usarse con guantes.
        </p>

        <p>
          La navegación se reduce a un retorno al nivel anterior, en lugar de la
          ruta completa.
        </p>

        <p>
          <strong>Una visita de asentamientos en el teléfono.</strong> La
          libreta es la lista de armadas, y el popup de la armada ocupa la
          pantalla, con la barra de guardado fija abajo. Cada lectura se guarda
          al salir del campo: si se pierde la señal, lo tecleado se queda en el
          popup y se guarda con la lectura siguiente; si hay que irse,{" "}
          <strong>Retomar medición</strong> sigue donde quedó (§ 7.6 y § 7.7).
        </p>

        <p>
          <strong>Coma o punto decimal.</strong> Las celdas numéricas aceptan
          los dos: <code>2541,7545</code> y <code>2541.7545</code> son el mismo
          número, y el teclado del teléfono ofrece el separador de su idioma.
          Lo que no se acepta es un separador de miles: <code>1.234,5</code> no
          se adivina. Si lo tecleado no es un número, la celda lo dice
          —<strong>«No es un número»</strong>— y la aplicación no guarda hasta
          corregirlo, para que un dato mal escrito no se pierda como si la
          celda estuviera vacía.
        </p>

        <p>
          <strong>A pleno sol</strong>, el tema claro se lee mejor; de noche o
          bajo techo, el oscuro cansa menos. Se cambia en el menú de cuenta
          (§ 2).
        </p>

        <Captura {...CAPTURAS.temaOscuro} />
      </Seccion>

      {/* ── 10. El informe de cada proceso ──────────────────────────────── */}
      <Seccion id="informes" titulo="10. El informe de cada proceso">
        <p>
          Cada proceso tiene su informe en su propia pantalla: el paso{" "}
          <strong>Informe</strong> de la poligonal (§ 5.7) y de la nivelación
          (§ 6.10), y la pestaña <strong>Informe</strong> del lugar de
          asentamientos (§ 7.12). Una visita no tiene informe propio: sus
          resultados van en el del lugar.
        </p>
        <p>
          No hay que generarlo: se arma con los datos del proceso cada vez que
          se abre, y no lleva marca de borrador, porque ningún proceso se
          cierra (§ 8). Lleva:
        </p>
        <ul className="ml-5 list-disc space-y-1">
          <li>
            <strong>Portada</strong>, con el nombre del proceso, los datos del
            proyecto —nombre, cliente, ubicación, datum y proyección, como estén
            al abrir el informe— y la fecha del informe.
          </li>
          <li>
            <strong>Datos y resultados</strong> del proceso, con su equipo
            (§ 5.7, § 6.10 y § 7.12).
          </li>
          <li>
            <strong>Resumen de precisión</strong>: el tipo, la precisión o el
            cierre, el equipo y si cumple.
          </li>
          <li>
            <strong>Observaciones</strong>: las notas del proceso —en un lugar,
            su descripción—, si las tiene.
          </li>
        </ul>
        <p>
          Es un documento para entregar: no nombra la aplicación ni habla de
          sus pantallas. Un proceso sin terminar se informa como tal
          —«Nivelación incompleta», «Poligonal incompleta»— con lo medido hasta
          ahí.
        </p>
        <p>
          <strong>Exportar PDF.</strong> Es el primer botón de la cabecera del
          informe. Abre el diálogo de impresión del navegador con el informe ya
          maquetado en A4: elija «Guardar como PDF» como destino. Lo impreso es
          solo el informe: la cabecera, los pasos y los botones no salen. Desde
          la segunda página, cada una lleva al pie el proyecto y el proceso, y
          «Página X de Y». El archivo se propone con el nombre del proceso y
          del proyecto.
        </p>
        <p>
          <strong>Exportar Excel</strong>, a su lado, descarga el libro del
          proceso (§ 11).
        </p>
        <Nota>
          El PDF lo genera su navegador, no la aplicación. La portada va sin
          márgenes para que el navegador no añada su propio encabezado ni su
          pie —la dirección de la página y la fecha—. Si aun así aparecen,
          desmarque «Encabezados y pies de página» en ese diálogo.
        </Nota>
      </Seccion>

      {/* ── 11. Exportar a Excel ───────────────────────────────────────── */}
      <Seccion id="export" titulo="11. Exportar a Excel">
        <p>
          <strong>Exportar Excel</strong>, en la cabecera de la página de
          informe de cada proceso (§ 10), descarga un <code>.xlsx</code> con la
          forma de las carteras de campo de su módulo, con mejor diseño y{" "}
          <strong>fórmulas vivas</strong>. Los demás pasos y pestañas no
          exportan.
        </p>

        <p>
          <strong>Datos en amarillo, cálculos con fórmulas.</strong>
        </p>
        <ul className="ml-5 list-disc space-y-1">
          <li>
            Las celdas con <strong>fondo amarillo</strong> son datos medidos o
            tecleados.
          </li>
          <li>
            El resto se calcula con fórmulas de Excel que dan el mismo valor
            que la aplicación: siguen sus reglas, no las de la cartera de
            campo. Cada celda guarda además el valor de la aplicación, así que
            el libro se ve completo en cualquier visor.
          </li>
          <li>Si cambia un dato, Excel recalcula lo que depende de él.</li>
          <li>
            Las tolerancias de cada orden son un bloque de celdas del libro, y
            las fórmulas se refieren a él.
          </li>
        </ul>

        <h3 className="mt-4 text-lg font-semibold">11.1 Nivelación</h3>
        <p>Tiene la forma de la cartera de El Verjón:</p>
        <Tabla
          caption="Hojas del libro de una nivelación"
          columnas={["Hoja", "Contiene"]}
        >
          {HOJAS_EXCEL.nivelacion.map((h) => (
            <Fila key={h.hoja} celdas={[h.hoja, h.contiene]} />
          ))}
        </Tabla>
        <ul className="ml-5 list-disc space-y-1">
          <li>
            <strong>Con hilos</strong>, cada lectura ocupa tres filas
            —superior, medio e inferior—, y la distancia es (superior −
            inferior) × 100.
          </li>
          <li>
            <strong>CORRECCIÓN y COTA AJUSTADA</strong> solo aparecen si la
            nivelación se compensó.
          </li>
          <li>
            <strong>El bloque «Cierre»</strong> da la distancia (km), la cota
            calculada de llegada, la cota conocida y el error de cierre (mm).
            En una abierta con vuelta, también el desnivel de cada recorrido,
            la discrepancia, el cierre del circuito y la distancia del par.
            Después, la tolerancia K·√km de cada orden, el{" "}
            <strong>Orden alcanzado</strong> y el <strong>Veredicto</strong>:
            CUMPLE o NO CUMPLE.
          </li>
        </ul>

        <h3 className="mt-4 text-lg font-semibold">11.2 Poligonal</h3>
        <p>
          Tiene la forma de la cartera de poligonales (
          <code>poligonales.xlsx</code>):
        </p>
        <Tabla
          caption="Hojas del libro de una poligonal"
          columnas={["Hoja", "Contiene"]}
        >
          {HOJAS_EXCEL.poligonal.map((h) => (
            <Fila key={h.hoja} celdas={[h.hoja, h.contiene]} />
          ))}
        </Tabla>
        <ul className="ml-5 list-disc space-y-1">
          <li>
            <strong>Las columnas</strong>: ESTACIÓN · VISADO · ÁNG. HORIZONTAL
            (G · M · S · DEC) —DEFLEXIÓN en la abierta con control— · CORR. ·
            ÁNG. CORREGIDO (G · M · S · DEC) · AZIMUT (G · M · S · DEC) · DIST.
            · PROYECCIONES (N-S · E-W) · CORRECCIÓN (N · E) · PROY. CORREGIDAS
            · COORDENADAS (N · E).
          </li>
          <li>
            <strong>A la derecha</strong>, las columnas auxiliares: DIR. y AZ.
            SIN CORREGIR en la abierta con control; |N-S| y |E-W| en Tránsito;
            d·cos², d·cos·sin, d·sin² y δd en Crandall.
          </li>
          <li>
            <strong>Debajo de la tabla</strong>, los bloques «Cierre angular» y
            «Cierre lineal» —error N, error E, error lineal, perímetro y
            precisión 1:X—, en Crandall «Crandall: sistema 2×2», las
            tolerancias de cada orden, el <strong>Orden alcanzado</strong> y el{" "}
            <strong>Veredicto</strong>. Si la poligonal se georreferenció, el
            bloque «Georreferenciación» lleva como datos la fecha, los puntos
            de control, la rotación y la escala.
          </li>
          <li>
            <strong>Con mínimos cuadrados</strong>, las correcciones v salen de
            la aplicación, y las distancias, los azimuts, las proyecciones y
            las coordenadas ajustados son fórmulas. El cierre de antes del
            ajuste —con el que se juzga el orden— y las matrices de la última
            iteración —observaciones l₀, Matriz A, Q, w, N = A·Q·Aᵀ, k y v— van
            como valores, porque la aplicación itera hasta converger. Debajo de
            ellas va la <strong>precisión de cada punto</strong> —σ N, σ E y la
            elipse al 95 %—, también como valores. Sin pesos, la hoja dice por
            qué no hay ajuste.
          </li>
        </ul>

        <h3 className="mt-4 text-lg font-semibold">
          11.3 Control de asentamientos
        </h3>
        <p>Tiene la forma de la cartera real, ordenada:</p>
        <Tabla
          caption="Hojas del libro de un lugar de asentamientos"
          columnas={["Hoja", "Contiene"]}
        >
          {HOJAS_EXCEL.asentamientos.map((h) => (
            <Fila key={h.hoja} celdas={[h.hoja, h.contiene]} />
          ))}
        </Tabla>
        <ul className="ml-5 list-disc space-y-1">
          <li>
            <strong>En «Libretas»</strong>, cada tramo sale de un BM del lugar
            y no se compensa, como en la aplicación (§ 7.9). Cada tramo lleva
            una línea de verificación: Cierre (mm), km y Orden, o «Sin
            verificación», «Sin distancias» o «A medias».
          </li>
          <li>
            <strong>En «Comparación»</strong>, la COTA apunta a su celda de
            «Libretas», y el SEMÁFORO dice Normal, Precaución, Alerta o
            Alarma, con su color. Un punto que no se midió en una visita deja
            sus celdas vacías, y su parcial siguiente se mide contra la última
            visita en que se midió.
          </li>
        </ul>
      </Seccion>

      <Seccion id="equipos" titulo="12. El catálogo de equipos">
        <Captura {...CAPTURAS.equipos} />

        <p>
          <strong>Equipos</strong>, en la barra de arriba, guarda sus estaciones
          totales y sus niveles para no teclearlos en cada proceso. Cada equipo
          lleva marca, modelo, número de serie, fecha de calibración y
          precisión: angular y de distancia en una estación total; tipo y
          desviación típica en un nivel. Cada sección tiene{" "}
          <strong>Agregar</strong>, y cada equipo <strong>Editar</strong> y{" "}
          <strong>Eliminar</strong>.
        </p>

        <p>
          En un proceso, el equipo es solo su identidad —marca, modelo y número
          de serie—. En una nivelación y en una visita de asentamientos,{" "}
          <strong>Tomar del catálogo</strong> copia los datos del nivel elegido
          en los campos, que siguen editables; en la poligonal se escriben.
        </p>

        <Nota titulo="El catálogo es una plantilla">
          Cada proceso guarda su propia copia del equipo: corregir o eliminar
          un equipo del catálogo no cambia ningún proceso, visita ni informe
          ya hecho.
        </Nota>

        <p>
          <strong>Calibración de más de un año.</strong> La lista avisa cuando
          la fecha de calibración tiene más de 12 meses. Es un aviso: el equipo
          se usa igual.
        </p>
      </Seccion>

      {/* ── 13. Preguntas frecuentes ───────────────────────────────────── */}
      <Seccion id="faq" titulo="13. Preguntas frecuentes">
        <dl className="flex flex-col gap-5">
          {PREGUNTAS.map((p) => (
            <div key={p.pregunta}>
              <dt className="font-semibold text-ink">{p.pregunta}</dt>
              <dd className="mt-1 text-ink">{p.respuesta}</dd>
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
      <h2 className="border-b border-rule pb-2 text-2xl font-bold">
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
        className="text-sm font-medium text-ink hover:text-ink"
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
    <aside className="rounded-md border-l-4 border-mira-strong bg-mira-bg px-4 py-3">
      {titulo && (
        <p className="text-sm font-semibold text-mira-ink">{titulo}</p>
      )}
      <div className="text-sm text-ink">{children}</div>
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
        // Solo la primera se carga de inmediato; las otras treinta suman 9,9 MB.
        loading={prioridad ? "eager" : "lazy"}
        decoding="async"
        className={cn(
          "h-auto w-full rounded-lg border border-rule bg-card shadow-sm",
          // La captura de teléfono es muy estrecha y alta: estirarla al ancho
          // del contenedor la dejaría enorme y borrosa.
          angosta && "mx-auto max-w-xs",
        )}
      />
      {pie && (
        <figcaption className="mt-2 text-sm text-ink-2">{pie}</figcaption>
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
    <div className="overflow-x-auto rounded-lg border border-rule bg-card">
      <table className="w-full text-sm">
        <caption className="px-4 pt-3 text-left text-sm font-medium text-ink">
          {caption}
        </caption>
        <thead>
          <tr className="border-b border-rule text-left">
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
    <tr className="border-b border-rule last:border-0">
      <th
        scope="row"
        className="px-4 py-2 text-left font-medium text-ink"
      >
        {primera}
      </th>
      {resto.map((celda, i) => (
        <td key={i} className="px-4 py-2 text-ink">
          {celda}
        </td>
      ))}
    </tr>
  );
}
