import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Badge } from "@/components/design-system";
import { cn } from "@/lib/utils/cn";
import {
  CAPTURAS,
  COLUMNAS_LISTADO,
  DESENLACES_CIERRE,
  ESTADOS_PROCESO,
  METODOS_CORRECCION,
  MODULOS_PENDIENTES,
  ORDENES_PRECISION,
  PREGUNTAS,
  SECCIONES,
  TIPOS_POLIGONAL,
  type Captura as DatosCaptura,
} from "./manual-data";

export const metadata: Metadata = {
  title: "Manual de usuario — TopoField",
  description:
    "Cómo usar TopoField: proyectos, poligonales, cierre con trazabilidad y trabajo en campo.",
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

      {/* ── 6. Cerrar un proceso ───────────────────────────────────────── */}
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

      {/* ── 7. Trabajo en campo ────────────────────────────────────────── */}
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

      {/* ── 8. Módulos pendientes ──────────────────────────────────────── */}
      <Seccion id="pendientes" titulo="8. Módulos pendientes">
        <p>
          Los siguientes módulos están especificados en el PRD pero{" "}
          <strong>aún no implementados</strong>. Se listan aquí para que se vea
          el alcance completo previsto.
        </p>

        <ul className="flex flex-col gap-4">
          {MODULOS_PENDIENTES.map((modulo) => (
            // Sin nada accionable dentro: nadie debe creer que puede entrar a
            // un módulo que todavía no existe.
            <li
              key={modulo.nombre}
              className="rounded-lg border border-dashed border-neutral-200 bg-neutral-50 p-5"
            >
              <div className="flex flex-wrap items-center gap-3">
                <h3 className="font-semibold text-neutral-800">
                  {modulo.nombre}
                </h3>
                {/* El estado va escrito, no solo teñido. Tono neutral porque un
                    módulo por construir no es un problema. */}
                <Badge>Pendiente · fase {modulo.fase}</Badge>
              </div>
              <p className="mt-2 text-sm text-neutral-800">
                {modulo.descripcion}
              </p>
            </li>
          ))}
        </ul>

        <p>
          La pestaña <strong>Informes</strong> del proyecto está visible pero
          vacía hasta entonces.
        </p>
      </Seccion>

      {/* ── 9. Preguntas frecuentes ────────────────────────────────────── */}
      <Seccion id="faq" titulo="9. Preguntas frecuentes">
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
