import type { Metadata } from "next";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";
import {
  CAPTURAS,
  COLUMNAS_LISTADO,
  DESENLACES_CIERRE,
  ESTADOS_PROCESO,
  METODOS_CORRECCION,
  CAMPOS_INFORME,
  HOJAS_EXCEL,
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
          hoy; los módulos que faltan están listados al final.
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
          Guarda el cliente, la ubicación, el datum, la proyección, el equipo
          usado y —lo más importante— el <strong>orden de precisión</strong>,
          que determina qué tolerancias se exigirán a todos sus procesos.
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
            a partir de ese momento los datos no se pueden modificar
          </strong>
          .
        </p>

        <Nota titulo="Sobre la inmutabilidad">
          Un proceso cerrado no se puede editar ni eliminar, ni desde la
          interfaz ni por ninguna otra vía. La restricción está aplicada en la
          propia base de datos, no solo en la pantalla. Si necesita corregir un
          levantamiento cerrado, cree uno nuevo.
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
            alcanzan el orden de precisión de su proyecto. Requieren revisión
            antes del cierre.
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
          <strong>Paso 2 — Equipo y precisión.</strong> Datum, proyección, datos
          del instrumento y el <strong>orden de precisión</strong>.
        </p>

        <Nota titulo="El orden de precisión es la decisión más importante del proyecto">
          Define las tolerancias que se exigirán a cada poligonal. Al elegirlo,
          el formulario le muestra la tolerancia angular y la precisión relativa
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
            <Fila
              key={o.orden}
              celdas={[o.orden, o.angular, o.relativa, o.uso]}
            />
          ))}
        </Tabla>

        <p className="text-sm text-neutral-500">
          Donde <em>n</em> es el número de ángulos medidos.
        </p>

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
          Indique el nombre, el tipo y el punto de partida (código, Norte, Este
          y azimut inicial).
        </p>

        <p>
          Si el tipo es <em>abierta con control</em>, deberá indicar además el
          punto de llegada.
        </p>

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
          <strong>Configuración.</strong> Plegada cuando el proceso ya está
          calculado. Ábrala para cambiar el nombre, el tipo o el punto de
          partida.
        </p>

        <p>
          <strong>Estaciones.</strong> La tabla de captura. Por cada estación
          registra el código, el ángulo en grados-minutos-segundos y la
          distancia horizontal. A la derecha, la aplicación calcula en vivo el
          azimut, ΔN y ΔE.
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

        <h3 className="mt-4 text-lg font-semibold">5.4 Reasignar coordenadas</h3>

        <p>
          El botón <strong>Asignar coordenadas reales</strong> permite
          recalcular toda la poligonal desde un punto de partida distinto,
          conservando las mediciones. Es útil cuando levantó en un sistema local
          y después obtuvo las coordenadas oficiales del punto de arranque.
        </p>

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
            <strong>Lectura atrás (L.Atrás)</strong> — la primera que se toma
            tras estacionar el nivel. Con ella se <strong>abre la armada
            siguiente</strong>: fija la altura del instrumento (AI) que usarán
            las filas venideras.
          </li>
          <li>
            <strong>Lectura adelante (L.Adelante)</strong> —{" "}
            <strong>fija la cota del punto</strong> de la fila. Viene de la
            armada anterior: la resta de la AI vigente.
          </li>
        </ul>

        <p>
          Por eso la columna <strong>AI solo tiene valor en las filas que
          llevan lectura atrás</strong>: la altura de instrumento es un dato
          de la armada, no de la fila. Una fila con solo lectura adelante (que
          cierra una armada sin abrir la siguiente) no muestra AI propia; usa
          la de la armada en curso.
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
          cota) o teclearlo directamente si no lo tiene registrado.
        </p>

        <p>
          Si el tipo es <em>de enlace</em>, deberá indicar además el BM de
          llegada. Marque <strong>Incluye recorrido de vuelta</strong> si va a
          medir ida y vuelta.
        </p>

        <h3 className="mt-4 text-lg font-semibold">6.5 El editor</h3>

        <Captura {...CAPTURAS.editorNivelacion} />

        <p>
          La libreta se captura por fila: punto, tipo, lecturas atrás y
          adelante, distancia del tramo y <strong>distancia acumulada</strong>{" "}
          desde el origen.
        </p>

        <Nota titulo="La distancia acumulada es obligatoria en los BM y en los puntos de cambio">
          Sin ella la fila no recibe corrección: la aplicación no adivina a
          qué distancia del origen está un punto, así que un dato faltante
          deja esa cota sin corregir en silencio hasta que se complete.
        </Nota>

        <p>
          <strong>Comprobación aritmética.</strong> ΣL.Atrás − ΣL.Adelante
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
          orden de precisión del proyecto:
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
          Ida y vuelta son <strong>mediciones independientes</strong>: cada
          una tiene sus propios puntos de cambio, y no hace falta —de hecho
          es mejor no— reocupar los mismos puntos en los dos sentidos.
        </p>

        <p>
          La aplicación compara los <strong>desniveles totales</strong> de
          ambos recorridos. La discrepancia entre ellos se contrasta contra{" "}
          <strong>T·√2</strong>, donde T es la misma tolerancia K·√D del
          cierre individual.
        </p>

        <h3 className="mt-4 text-lg font-semibold">
          6.7 Cierre irreversible
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

        <h3 className="mt-4 text-lg font-semibold">
          7.3 Registrar una visita
        </h3>

        <p>
          Cada <strong>visita</strong> es una fecha en la que se releyeron
          los puntos del catálogo. La primera visita registrada es la{" "}
          <strong>visita 0 o línea base</strong>: fija el punto de partida y
          no tiene asentamiento ni velocidad propios, porque no hay una
          visita anterior contra la que compararla.
        </p>

        <Captura {...CAPTURAS.editorVisita} />

        <p>
          Por cada punto se captura la <strong>cota medida</strong>. La
          aplicación calcula al instante:
        </p>

        <ul className="ml-5 list-disc space-y-1">
          <li>
            <strong>Parcial</strong> — cuánto bajó (o subió) el punto desde la
            visita anterior, en mm.
          </li>
          <li>
            <strong>Acumulado</strong> — cuánto ha bajado desde la línea base
            (C0), en mm.
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
            semáforo explicado a continuación.
          </li>
        </ul>

        <p>
          Un valor positivo es un <strong>levantamiento</strong>, no un
          asentamiento, y se muestra como tal: es un hallazgo que vale la
          pena revisar, no un error de signo.
        </p>

        <h3 className="mt-4 text-lg font-semibold">
          7.4 El semáforo y la gráfica
        </h3>

        <Captura {...CAPTURAS.panelAsentamientos} />

        <p>El panel del lugar reúne el historial completo:</p>

        <p>
          <strong>Visitas.</strong> La lista cronológica, con la peor alerta
          de cada una.
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
          <strong>Gráfica de evolución.</strong> El asentamiento acumulado de
          cada punto a lo largo de las visitas. Puede activar o desactivar
          puntos con las casillas de arriba. Cada serie se distingue por{" "}
          <strong>forma de marcador además de color</strong> (círculo,
          cuadrado, triángulo, rombo, cruz), así que sigue siendo legible sin
          color. Debajo, la misma información en una{" "}
          <strong>tabla de datos</strong>: la alternativa textual para cuando
          la gráfica no basta.
        </p>

        <h3 className="mt-4 text-lg font-semibold">
          7.5 Cerrar una visita o el lugar
        </h3>

        <p>
          Cerrar una <strong>visita</strong> la deja en solo lectura: es el
          registro de campo de una fecha concreta, y una vez cerrada no
          admite más cambios.
        </p>

        <p>
          Cerrar el <strong>lugar</strong> termina el monitoreo por completo:
          el lugar y todas sus visitas —cerradas o no— quedan en solo
          lectura. Use el cierre del lugar cuando el seguimiento del sitio
          haya concluido, no visita por visita.
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
          deshabilitados y no hay botones de guardado.
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
          no puede cambiar, el informe dice siempre lo mismo — hoy y dentro de
          un año.
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
          El documento lleva portada con los datos del proyecto y el equipo,
          índice, una sección por proceso con sus resultados, el resumen
          consolidado de precisiones, sus observaciones y el registro de cierre.
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
          editor —y el control de asentamientos, en su panel de análisis—.
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
