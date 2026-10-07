import type { Metadata } from "next";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";
import {
  AVISOS_LIBRETA,
  CAPTURAS,
  COLUMNAS_LISTADO,
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
        <p className="mt-2 max-w-2xl text-ink">
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
          dentro de un mismo proyecto. El orden de una poligonal o de una
          nivelación no se declara: se detecta al calcularla.
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
          <strong>Cierre.</strong> El acto de dar por terminada una visita o
          un lugar de asentamientos. Queda registrado con fecha, hora y autor,
          y{" "}
          <strong>
            a partir de ese momento las mediciones y el veredicto no se pueden
            modificar
          </strong>
          . Es lo que da trazabilidad al trabajo.{" "}
          <strong>La poligonal y la nivelación no se cierran</strong>: quedan
          calculadas, se corrigen cuando haga falta, y su informe dice qué
          orden de precisión alcanzaron (§ 5 y § 6).
        </p>

        <Nota titulo="Sobre la inmutabilidad">
          Un proceso cerrado no se puede editar ni eliminar, ni desde la
          interfaz ni por ninguna otra vía. La restricción está aplicada en la
          propia base de datos, no solo en la pantalla. Para corregirlo, se
          reabre (§ 8).
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
            <strong>Torre Alameda</strong>, un control de asentamientos
            simulado con catorce visitas y su libreta de nivelación en cada
            una.
          </li>
          <li>Un informe consolidado por módulo.</li>
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
            en una visita abierta. Requieren revisión.
          </li>
        </ul>

        <p>
          Debajo, sus proyectos. El selector{" "}
          <strong>Activos / Archivados</strong> filtra la lista. Cada tarjeta
          indica cuántos procesos tiene el proyecto y cuántos están en curso,
          cerrados o rechazados.
        </p>

        <p>
          Use <strong>+ Nuevo Proyecto</strong> para crear uno.
        </p>

        <Nota titulo="Empieza con un proyecto de ejemplo">
          La primera vez que entra, su cuenta ya trae un{" "}
          <strong>«Proyecto de ejemplo»</strong> con carteras de campo reales
          —poligonales y nivelaciones—, un lugar de control de asentamientos
          simulado y sus informes, para que explore la aplicación con datos
          reales (§ 2). Puede modificarlo o archivarlo cuando quiera.
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
          Van en cada proceso: cada visita de asentamiento declara su orden y
          su equipo, y cada poligonal y cada nivelación su equipo —su orden se
          detecta al calcularla—. Un mismo proyecto puede así tener
          trabajos de distinto orden, medidos con instrumentos distintos y en
          fechas distintas. Vea{" "}
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
          <strong>+ Nuevo Proceso</strong>. Debajo, tres pestañas:
        </p>

        <ul className="ml-5 list-disc space-y-1">
          <li>
            <strong>Procesos</strong> — el listado de levantamientos del
            proyecto. Se detalla en el apartado siguiente.
          </li>
          <li>
            <strong>Informes</strong> — los informes{" "}
            <strong>consolidados</strong>, que reúnen poligonales y
            nivelaciones calculadas y controles de asentamientos cerrados en un
            solo documento. Se detalla en «10. Informes». Cada proceso tiene
            además su propio informe, en su pantalla (4.4).
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
          Los que tienen cota sirven además como BM de sus nivelaciones y
          como <strong>BM de amarre</strong> de las visitas de asentamiento.
        </p>

        <p>
          <strong>Archivar o eliminar.</strong> Archivar oculta el proyecto de
          la lista activa del dashboard; puede restaurarlo cuando quiera.
          Eliminarlo lo borra con todo lo que contiene, y solo es posible si no
          tiene nada cerrado: un lugar o una visita de asentamientos cerrados
          son registros que no se borran. En ese caso la configuración dice
          cuántos tiene y propone archivarlo.
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
          nada. Pulse uno para ver solo ese grupo. En poligonales y
          nivelaciones los estados son <strong>Borradores</strong> y{" "}
          <strong>Calculados</strong>: no se cierran. En control de
          asentamientos, <strong>Activos</strong> y <strong>Cerrados</strong>.
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
          <strong>Acciones por fila.</strong> Cada fila ofrece:
        </p>

        <ul className="ml-5 list-disc space-y-1">
          <li>
            <strong>Duplicar</strong> — crea uno nuevo con la misma
            configuración, en borrador: una poligonal sin estaciones, una
            nivelación sin lecturas, un lugar con sus umbrales y su catálogo de
            puntos pero sin visitas.
          </li>
          <li>
            <strong>Renombrar</strong> — cambia el nombre sin abrirlo.
          </li>
          <li>
            <strong>Eliminar</strong> — lo borra con lo que contiene, con
            confirmación previa. Un lugar con alguna visita cerrada no se puede
            eliminar. Si lo que borra está en un informe consolidado —porque se
            reabrió después de emitirlo—, la confirmación lo avisa: el informe
            quedará sin esa sección.
          </li>
        </ul>

        <Nota titulo="Lo cerrado solo se puede duplicar">
          Un lugar cerrado no admite renombrarse ni eliminarse. Una poligonal
          o una nivelación siempre admite las tres acciones: no se cierran. Si
          necesita rehacer un levantamiento cerrado, duplíquelo: obtendrá una
          copia editable y el original queda intacto como constancia. Para
          corregir el mismo lugar, reábralo desde su pantalla (§ 8).
        </Nota>

        <p>
          En el teléfono, la tabla se convierte en tarjetas, una por fila, con
          las mismas acciones.
        </p>

        <h3 className="mt-4 text-lg font-semibold">
          4.4 La pantalla de un proceso
        </h3>

        <p>
          Los controles de asentamientos se abren en la pantalla de siempre. La
          poligonal y la nivelación tienen la suya, por pasos (
          <a href="#pantalla-por-pasos" className="underline">
            § 5.3
          </a>{" "}
          y{" "}
          <a href="#pantalla-por-pasos-nivelacion" className="underline">
            § 6.5
          </a>
          ).
        </p>

        <p>
          <strong>La cabecera.</strong> El nombre, el estado y el tipo del
          proceso, y dos acciones: <strong>Exportar a Excel</strong> (§ 11) y{" "}
          <strong>Ver informe</strong>. Si el proceso está cerrado, una
          tercera: <strong>Reabrir</strong> (§ 8). La ruta de la barra devuelve
          al listado del que vino.
        </p>

        <p>
          <strong>Las pestañas.</strong> <strong>Proceso</strong> reúne todo el
          trabajo: configuración, captura, cálculo, gráfico y análisis, que se
          recalculan mientras escribe. <strong>Informe</strong> muestra el
          informe de ese proceso, listo para{" "}
          <strong>Imprimir o guardar como PDF</strong> (§ 10). El control de
          asentamientos tiene tres: <strong>Panel</strong>,{" "}
          <strong>Puntos y lugar</strong> e <strong>Informe</strong> (§ 7); la
          poligonal, sus tres pasos: <strong>Datos</strong>,{" "}
          <strong>Ajuste</strong> e <strong>Informe</strong>, y la nivelación
          los suyos: <strong>Libreta</strong>,{" "}
          <strong>Compensación</strong> e <strong>Informe</strong>.
        </p>

        <Captura {...CAPTURAS.informeDelProceso} />

        <p>
          Mientras el proceso no esté cerrado, su informe lleva la marca{" "}
          <strong>«Borrador — el informe se emite al cerrar el proceso»</strong>,
          también en el PDF: sirve para revisar antes de cerrar. Si se cerró
          como rechazado, lleva en cambio la marca{" "}
          <strong>«Rechazado»</strong>: queda como constancia y no entra en
          informes consolidados. El de una poligonal o una nivelación no lleva
          marca: no se cierran. Debajo, fuera de la impresión, aparecen los
          informes consolidados que ya lo incluyen y, si puede entrar en uno
          —un lugar cerrado, o una poligonal o una nivelación calculadas—, un
          botón para generar uno nuevo con él.
        </p>

        <p>
          <strong>La barra de acciones.</strong> Mientras el proceso se puede
          editar, <strong>Guardar</strong> y <strong>Cerrar proceso</strong> van
          en una barra fija al pie de la pantalla, siempre a la vista. A su
          izquierda dice si hay <strong>cambios sin guardar</strong> o qué
          impide guardar. La poligonal y la nivelación no la tienen: cada
          popup guarda al confirmar.
        </p>

        <Nota titulo="Salir sin guardar pregunta">
          Si tiene cambios sin guardar y pulsa una miga, otra pestaña o
          cualquier enlace de la aplicación, un diálogo pregunta antes de
          salir; al recargar o cerrar la pestaña, pregunta el navegador. Los
          botones atrás y adelante del navegador no preguntan.
        </Nota>

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
            <strong>Cargo del responsable</strong>: salen en el informe y en el
            Excel.
          </li>
          <li>
            <strong>Tipo de poligonal</strong>, con una línea que explica cómo
            se verifica cada uno.
          </li>
          <li>
            <strong>Equipo</strong>, plegado y opcional: marca, modelo y número
            de serie de la estación total, o{" "}
            <strong>Tomar del catálogo</strong> (§ 12).
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
          <strong>Editar datos</strong>, <strong>Exportar a Excel</strong>{" "}
          (§ 11) y, bajo <strong>⋯</strong>, <strong>Duplicar</strong> y{" "}
          <strong>Eliminar</strong>.
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
          el nombre ya existe con otras coordenadas, el popup lo dice: tómelo
          del catálogo o use otro nombre, porque ese punto puede estar en uso
          en otra poligonal. Sin 0 atrás, la partida no va al catálogo: puede
          ser local.
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
          mediciones. Se guardan al salir del campo, cuando están los tres;
          mientras tanto el ajuste dice que faltan. Si cambia de método, los
          pesos se conservan para cuando vuelva.
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
          El informe de la poligonal, listo para{" "}
          <strong>Imprimir o guardar como PDF</strong> (§ 10). Es la misma
          sección que lleva en un informe consolidado:
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
            elegido, paso a paso, con sus fórmulas en notación matemática y las
            cifras de esta poligonal.
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
          la cabecera. Cambiar el tipo o un BM recalcula la libreta, y el popup
          lo avisa.
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
          <strong>Editar datos</strong>, <strong>Exportar a Excel</strong>{" "}
          (§ 11) y, bajo <strong>⋯</strong>, <strong>Duplicar</strong> y{" "}
          <strong>Eliminar</strong>. Debajo van los tres pasos y, a la
          derecha, <strong>Importar .L o CSV</strong> (§ 6.9).
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
          qué casilla marcar.
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
          El informe de la nivelación, listo para{" "}
          <strong>Imprimir o guardar como PDF</strong> (§ 10). Es la misma
          sección que lleva en un informe consolidado, y cambia según el tipo.
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
          Al abrir un lugar desde el proyecto se ve su pantalla (4.4), con tres
          pestañas: <strong>Panel</strong>, con el historial del monitoreo
          (7.4); <strong>Puntos y lugar</strong>, con los datos, los umbrales y
          el catálogo de puntos (7.2); e <strong>Informe</strong>. En la
          cabecera, <strong>+ Nueva visita</strong> (7.3),{" "}
          <strong>Exportar a Excel</strong> y <strong>Ver informe</strong>.
        </p>

        <h3 className="mt-4 text-lg font-semibold">
          7.2 Catalogar los puntos
        </h3>

        <Captura {...CAPTURAS.editorLugar} />

        <p>
          Ya creado el lugar, en su pestaña <strong>Puntos y lugar</strong>{" "}
          agregue sus <strong>puntos de control</strong>: código, ubicación
          y la <strong>cota inicial (C0)</strong> — la referencia contra la que
          se mide el asentamiento acumulado de todas las visitas futuras.
        </p>

        <p>
          Los puntos no llevan coordenadas: el módulo mide cuánto baja cada
          punto, no dónde está, así que no calcula distancias entre puntos,
          asentamientos diferenciales ni distorsión angular. Un lugar cerrado
          antes de este cambio tampoco los muestra ya.
        </p>

        <p>
          La C0 es opcional. Si la deja vacía, la{" "}
          <strong>línea base del punto es su primera lectura</strong>: esa
          lectura queda con acumulado 0 y las siguientes se miden contra ella.
        </p>

        <p>
          Cuando un punto ya se midió en una visita <strong>cerrada</strong>,
          su C0 queda fija: los asentamientos con que se cerró esa visita
          dependen de ella. El diálogo <strong>Editar</strong> la muestra
          bloqueada; el código y la ubicación se siguen pudiendo cambiar.
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
          no tiene velocidad, porque no hay una visita anterior contra la que
          compararla. Su acumulado es cero en los puntos cuya C0 es su lectura
          de esta visita; si la C0 viene de otra medición, la visita 0 muestra
          ya lo que el punto se movió desde entonces.
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
            <strong>Fecha</strong> y <strong>Nivelador</strong>. La fecha tiene
            que ser posterior a la de la última visita: dos visitas del mismo
            lugar no comparten fecha, y al editar una visita abierta su fecha
            tiene que quedar entre la de la anterior y la de la siguiente.
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

        <p>
          <strong>La libreta de nivelación.</strong> En una visita con
          libreta, las cotas de los puntos de control{" "}
          <strong>no se teclean: salen de la libreta</strong>. Es la libreta de
          la nivelación (§ 6.2 y § 6.3) —V+, V−, distancia a cada mira, hilos
          con nivel automático— y forma un{" "}
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
          cierre cumple la tolerancia del orden de la visita, es la cota{" "}
          <strong>compensada</strong> (§ 6.7); si no, la calculada: a
          diferencia de una nivelación, la visita no compensa un cierre fuera
          de tolerancia. La tabla{" "}
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
          <strong>Comprobar los BM.</strong> Todas las cotas de la visita salen
          del BM de amarre. Si ese BM se movió, todos los puntos parecen
          asentarse a la vez. Para detectarlo, haga pasar el circuito también
          por <strong>otro BM del catálogo</strong> (§ 4.2), por ejemplo como
          una lectura más de la primera armada. Es lo que recomienda el
          protocolo de campo: nivelar primero entre BMs.
        </p>

        <p>
          La aplicación compara la cota que la libreta le da a ese BM —la
          calculada, antes de compensar— con la del catálogo. La tolerancia es
          K·√L del orden de la visita, con L la distancia desde el amarre
          hasta ese BM.
        </p>

        <ul className="ml-5 list-disc space-y-1">
          <li>
            Si nivela, el resumen de la libreta lo dice: «BM-2 nivela con BM-1:
            -0.4 mm, tolerancia 2.0 mm.»
          </li>
          <li>
            Si no, avisa con las dos cotas. Uno de los dos BM pudo moverse, o
            hay un error en la libreta o en la cota del catálogo. Con dos BM
            no se sabe cuál se movió; con un tercero, comparándolos entre sí,
            sí.
          </li>
        </ul>

        <p>
          <strong>Solo avisa</strong>: la visita se guarda y se cierra igual.
          El aviso queda en el editor, junto al amarre en la tabla de visitas
          del panel, en la vista de la visita y al cerrarla.
        </p>

        <p>
          Cuentan los puntos de referencia de tipo BM, con cota y distintos
          del amarre. Un código que también es punto de control del lugar se
          trata como punto de control. Al guardar, la visita conserva la cota
          de catálogo con que se comparó: si después se corrige el catálogo,
          una visita cerrada no cambia.
        </p>

        <p>
          <strong>Importar la libreta.</strong> Con un nivel digital,{" "}
          <strong>Importar desde archivo</strong> pasa a la libreta el archivo{" "}
          <strong>.L de Leica</strong> o la <strong>plantilla CSV</strong> de
          TopoField, como en nivelación (§ 6.9), con dos diferencias: el
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
          El margen absorbe el ruido de medición de las dos cotas que se
          comparan y sale de la tolerancia de cierre del circuito de cada
          visita: de su orden de precisión y de la longitud de su libreta. Con
          dos circuitos de 112 m en tercer orden, como los de Torre Alameda,
          es de 2,8 mm; con dos de 1,5 km, de 10,4 mm. Una visita capturada
          sin libreta cuenta como un circuito de 500 m: entre dos visitas así,
          el margen es de 1,5 mm en primer orden, 3 en segundo, 6 en tercero y
          12 en ordinario. Moverse <strong>menos</strong> de lo previsto nunca
          avisa, porque un asentamiento por consolidación frena con el tiempo.
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
          Abrir el lugar desde el proyecto lleva a su pestaña{" "}
          <strong>Panel</strong>, que reúne el historial completo. La cabecera
          dice cuántos puntos de control tiene y la fecha de la lectura base;
          arriba del panel, la leyenda de los tres umbrales de acumulado que
          dibujan las gráficas.
        </p>

        <p>
          <strong>Indicadores.</strong> Cinco, sobre la última visita y el
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
          El <strong>promedio es encadenado</strong>: el de la visita anterior
          más la media de lo que se movieron los puntos medidos en las dos. Un
          punto dado de alta entra con acumulado 0 y uno dado de baja deja de
          contar; la media de los acumulados se movería con eso sin que nada
          se asentara, el encadenado no. Sin altas ni bajas, los dos
          coinciden.
        </p>

        <p>
          <strong>Visitas.</strong> De la más reciente a la más antigua; pulse
          una fila para abrir la visita (
          <a href="#vista-visita" className="underline">
            § 7.5
          </a>
          ). Por visita: el promedio y el máximo del acumulado, el BM de
          amarre con su cota —con <strong>⚠</strong> si otro BM de la
          libreta no nivela con él (§ 7.3)—, el <strong>mayor Δ</strong>{" "}
          desde la anterior,
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
          <strong>Tendencia.</strong> Desde la tercera visita de un punto, la
          columna dice si <strong>acelera</strong> —su velocidad crece más de
          lo que explica el error de las lecturas— o{" "}
          <strong>converge</strong>. Las dos velocidades salen de las tres
          últimas cotas del punto, así que el margen suma el ruido de las
          tres, con el circuito de cada visita: es unas √3 veces el del aviso
          de lectura fuera de tendencia. En Torre Alameda, 5,35 mm/mes. Un
          solo salto no basta para decir que un punto acelera.
        </p>

        <p>
          <strong>Un dato en alarma se registra con normalidad.</strong> El
          semáforo es un diagnóstico, no un control de captura: la aplicación{" "}
          <strong>nunca</strong> impide guardar una visita ni cerrarla por
          tener puntos en alerta o alarma. Un asentamiento alarmante es
          exactamente el hallazgo que este módulo existe para documentar;
          bloquearlo ocultaría el dato que más importa.
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
          con su diferencia frente a la visita anterior —la media de lo que se
          movieron los puntos medidos en las dos—; el mayor movimiento
          desde la anterior; los puntos en alerta, de los medidos; el{" "}
          <strong>cierre de nivelación</strong>, con la tolerancia y si
          cumple; y la peor alerta junto al estado de la visita. Si otro BM de
          la libreta no nivela con el amarre, un aviso debajo lo dice, con las
          dos cotas (§ 7.3).
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
          ΣV+, ΣV−, el error de cierre, la tolerancia y la comprobación de
          cada BM de control (§ 7.3). Las vistas intermedias
          de los puntos de control van resaltadas: de ellas sale la cota del
          punto. Se cierra con <strong>Cerrar</strong> o con Esc.
        </p>

        <Captura {...CAPTURAS.registroNivelacion} />

        <h3 className="mt-4 text-lg font-semibold">
          7.6 Cerrar una visita o el lugar
        </h3>

        <p>
          Cerrar una <strong>visita</strong> la deja en solo lectura: es el
          registro de campo de una fecha concreta, y mientras está cerrada
          no admite cambios. Se exige lectura de todos los puntos{" "}
          <strong>vigentes</strong> en su fecha; los de baja no.
        </p>

        <p>
          En una visita con libreta, el diálogo de cierre muestra además el
          cierre de la libreta.{" "}
          <strong>
            Si la comprobación aritmética no cuadra, no se puede cerrar
          </strong>
          : corrija la libreta. Si el cierre supera la tolerancia, solo avisa:
          la visita se cierra con sus cotas sin compensar. Lo mismo si otro BM
          no nivela con el amarre (§ 7.3): el diálogo lo recuerda y la visita
          se cierra igual.
        </p>

        <Nota titulo="Cierre las visitas en orden">
          El parcial, la velocidad y la alerta de cada punto se miden contra su
          lectura anterior, y un punto sin C0 acumula desde su primera lectura.
          Si la visita que tiene esas lecturas sigue abierta, la aplicación no
          deja cerrar las posteriores: «Cierra antes la visita 2: P-01, P-07 se
          calculan contra sus lecturas». Si esas lecturas siguieran editables,
          corregirlas movería lo que ya quedó cerrado.
        </Nota>

        <p>
          Cerrar el <strong>lugar</strong> termina el monitoreo por completo:
          el lugar y todas sus visitas —cerradas o no— quedan en solo
          lectura. Use el cierre del lugar cuando el seguimiento del sitio
          haya concluido, no visita por visita. El botón{" "}
          <strong>Cerrar lugar</strong> está en la barra de la pestaña{" "}
          <strong>Puntos y lugar</strong>.
        </p>

        <p>
          <strong>Eliminar una visita.</strong> Solo se puede eliminar la{" "}
          <strong>última</strong> visita del lugar, y solo si no está cerrada:
          el botón <strong>Eliminar</strong> aparece en su vista. Una visita
          intermedia no se borra, porque dejaría un hueco en la numeración y
          cambiaría el asentamiento parcial y la velocidad de la siguiente.
        </p>

        <p>
          <strong>Reabrir.</strong> Una visita cerrada se reabre con{" "}
          <strong>Reabrir</strong>, en su vista, y vuelve a editarse. Si el
          lugar está cerrado, primero se reabre el lugar: su botón{" "}
          <strong>Reabrir</strong> está en la cabecera, donde estaba{" "}
          <strong>Nueva visita</strong>. Reabrir el lugar no reabre sus
          visitas: las cerradas siguen cerradas. Si la visita tiene visitas
          posteriores, el diálogo lo recuerda: el parcial, la velocidad y la
          alerta de la siguiente se calculan contra sus lecturas, y cambian si
          cambian ellas.
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
          En control de asentamientos se cierran las <strong>visitas</strong> y
          el <strong>lugar</strong> (§ 7.6).{" "}
          <strong>La poligonal y la nivelación no se cierran</strong>: quedan
          calculadas y se corrigen cuando haga falta; su informe dice qué orden
          alcanzaron y alerta si no alcanzan ninguno (§ 5.7 y § 6.10).
        </p>

        <p>
          Cerrar deja el trabajo en solo lectura. El diálogo de cierre resume
          el resultado y la fecha, y debe marcar la confirmación
          explícitamente. Si la comprobación aritmética de la libreta de una
          visita no cuadra, no se puede cerrar: corrija la libreta. Cerrado, el
          trabajo se abre en solo lectura: los campos están deshabilitados y no
          hay barra de acciones. Su pestaña <strong>Informe</strong> ya no
          lleva la marca de borrador: es el informe del trabajo cerrado.
        </p>

        <p>
          <strong>Reabrir.</strong> Una visita o un lugar cerrados se reabren
          con <strong>Reabrir</strong>. Vuelven a editarse, y se cierran otra
          vez con el diálogo de siempre. Se borra su registro de cierre —fecha
          y responsable—, y el nuevo cierre escribe el suyo. Si el lugar está
          en un informe consolidado, el diálogo lo avisa: el informe mostrará
          los datos nuevos (§ 10).
        </p>
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

      {/* ── 10. Informes ───────────────────────────────────────────────── */}
      <Seccion id="informes" titulo="10. Informes">
        <p>Hay dos clases de informe:</p>
        <ul className="ml-5 list-disc space-y-1">
          <li>
            <strong>El informe de un proceso</strong> está en su pestaña{" "}
            <strong>Informe</strong> (4.4): no hay que generarlo. Mientras el
            proceso no esté cerrado sale como borrador; el de una poligonal o
            una nivelación, que no se cierran, sin marca.
          </li>
          <li>
            <strong>Un informe consolidado</strong> reúne varios trabajos ya
            terminados de un proyecto en un solo documento imprimible, con
            título, orden y observaciones propios. Se genera en la pestaña{" "}
            <strong>Informes</strong> del proyecto.
          </li>
        </ul>
        <p>
          Los dos llevan el registro de quién cerró cada cosa y cuándo, con el
          nombre de la persona. Las poligonales y las nivelaciones no tienen
          fila en él: no se cierran.
        </p>

        <h3 className="text-lg font-semibold text-ink">
          Qué puede incluirse
        </h3>
        <p>
          <strong>Poligonales y nivelaciones calculadas y lugares cerrados</strong>,
          en un informe consolidado. El informe no guarda una copia de las
          mediciones: las vuelve a leer cada vez que se abre. Solo guarda su
          título, sus observaciones, la lista de procesos y la portada del día
          en que se emitió.
        </p>
        <ul className="ml-5 list-disc space-y-1">
          <li>
            Un lugar <strong>cerrado</strong> no puede cambiar sus mediciones ni
            su veredicto mientras siga cerrado, así que su sección dice lo
            mismo hoy y dentro de un año. Si se reabre (§ 8), el informe
            muestra sus datos actuales y, mientras siga abierto, «—» en su
            registro de cierre, y el pie dice que se reabrió después de
            emitirlo.
          </li>
          <li>
            Una <strong>poligonal</strong> o una <strong>nivelación</strong> no
            se cierran: entran calculadas, cumplan o no un orden, y su sección
            muestra lo que tengan al abrir el informe. Si no alcanzan ningún
            orden, la sección lo alerta. Una nivelación con la libreta a medias
            no entra.
          </li>
        </ul>
        <p>Un PDF ya descargado no cambia.</p>
        <p>De ahí se sigue una consecuencia:</p>
        <ul className="ml-5 list-disc space-y-1">
          <li>
            En control de asentamientos se incluye el{" "}
            <strong>lugar cerrado</strong>, no una visita suelta: un lugar
            todavía activo admite visitas nuevas, así que su informe cambiaría
            solo.
          </li>
        </ul>
        <p>
          Si el proyecto no tiene nada que incluir, la pantalla se lo dice en
          vez de ofrecer un formulario que no llevaría a ninguna parte.
        </p>

        <h3 className="text-lg font-semibold text-ink">
          Generar un informe consolidado
        </h3>
        <p>
          En la pestaña <strong>Informes</strong> del proyecto, pulse{" "}
          <strong>Generar Nuevo Informe</strong>. Desde la pestaña{" "}
          <strong>Informe</strong> de un lugar cerrado o de una poligonal o una
          nivelación calculadas,{" "}
          <strong>Generar un informe consolidado con este proceso</strong> abre
          el mismo formulario con ese proceso ya marcado.
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

        <h3 className="text-lg font-semibold text-ink">
          Imprimir o guardar como PDF
        </h3>
        <p>
          Al generar, la aplicación abre el documento maquetado —también al
          pulsar un informe de la lista de la pestaña{" "}
          <strong>Informes</strong>—, y allí{" "}
          <strong>Imprimir o guardar como PDF</strong> abre el diálogo del
          navegador: elija «Guardar como PDF» como destino. La ruta de la barra
          vuelve al proyecto, y <strong>Eliminar informe</strong> lo borra: los
          procesos que incluye no cambian, y puede volver a generarlo. Un
          informe emitido no se edita: para corregirlo, elimínelo y genérelo
          de nuevo.
        </p>

        <Captura {...CAPTURAS.informeImprimible} />

        <p>
          El documento lleva portada con los datos del proyecto{" "}
          <strong>al emitirlo</strong> —si después cambian el nombre o el
          cliente del proyecto, la portada no—, índice, una sección por proceso
          con sus resultados <strong>y su equipo</strong> —en las poligonales,
          con la corrección por método y su dibujo (§ 5.7)—, el resumen
          consolidado de precisiones —con una columna de equipo y, en las
          poligonales, el orden alcanzado—, sus observaciones y el registro de
          cierre. El equipo ya no es un
          dato del proyecto: cada sección imprime el que declaró su propio
          proceso (en asentamientos, el de la visita más reciente).
        </p>
        <p className="text-sm text-ink-2">
          El PDF lo genera su navegador, no la aplicación. Los márgenes y los
          encabezados de página dependen de lo que usted elija en ese diálogo.
        </p>
      </Seccion>

      {/* ── 11. Exportar a Excel ───────────────────────────────────────── */}
      <Seccion id="export" titulo="11. Exportar a Excel">
        <p>
          Cada proceso tiene un botón <strong>Exportar a Excel</strong> en la
          cabecera de su pantalla —también el control de asentamientos—.
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
          En una nivelación, el libro lleva una cuarta hoja,{" "}
          <strong>«Cotas ajustadas»</strong>: una cota por punto, con cuántas
          lecturas la forman y de dónde sale (§ 6.7).
        </p>

        <p>
          En control de asentamientos, «Datos Crudos» añade un bloque{" "}
          <strong>«Visitas»</strong> con el modo de captura, el BM de amarre,
          el cierre y la tolerancia de cada una, y el libro lleva una cuarta
          hoja, <strong>«Libretas»</strong>: la libreta de cada visita que la
          tiene, con sus cotas calculadas y compensadas y la cota de catálogo
          de los BM de control (§ 7.3).
        </p>

        <p>
          A diferencia del informe, la exportación funciona{" "}
          <strong>en cualquier estado</strong>: también sobre un borrador. Las
          celdas que aún no se han calculado salen vacías, no en cero — en
          topografía un <code>0.000</code> es una posición, no un dato que
          falta.
        </p>
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

        <p>En el formulario de equipo de cada visita:</p>
        <ul className="ml-5 list-disc space-y-1">
          <li>
            <strong>Tomar del catálogo</strong> copia los datos del equipo
            elegido en los campos, que siguen editables.
          </li>
          <li>
            <strong>Guardar en el catálogo</strong> guarda lo que ha tecleado.
            Si el mismo aparato —misma marca, modelo y serie— ya está, el botón
            dice «Ya está en el catálogo».
          </li>
        </ul>

        <p>
          En una poligonal y en una nivelación, el equipo es solo su identidad
          —marca, modelo y número de serie—, y{" "}
          <strong>Tomar del catálogo</strong> la copia.
        </p>

        <Nota titulo="El catálogo es una plantilla">
          Cada proceso guarda su propia copia del equipo: corregir o eliminar
          un equipo del catálogo no cambia ningún proceso, visita ni informe
          ya hecho.
        </Nota>

        <p>
          <strong>Calibración de más de un año.</strong> La lista y el
          formulario avisan cuando la fecha de calibración tiene más de 12
          meses: en una visita, a la fecha de la visita. Es un aviso; la visita
          se guarda igual.
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
