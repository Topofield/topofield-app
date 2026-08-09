import { Captura } from "../componentes/captura";
import { Seccion, VolverArriba } from "../componentes/seccion";
import { Fila, Tabla } from "../componentes/tabla";
import { CAPTURAS, METODOS_CORRECCION, TIPOS_POLIGONAL } from "../manual-data";

export function Poligonales() {
  return (
    <Seccion id="poligonales" titulo="5. Poligonales">
      <h3 className="text-lg font-semibold">5.1 Tipos</h3>

      <p>
        TopoField maneja tres tipos, y la diferencia determina cómo se verifica
        el trabajo:
      </p>

      <Tabla
        caption="Tipos de poligonal"
        columnas={["Tipo", "Descripción", "Cómo se verifica"]}
      >
        {TIPOS_POLIGONAL.map((t) => (
          <Fila
            key={t.tipo}
            celdas={[t.tipo, t.descripcion, t.verificacion]}
          />
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
        Desde el proyecto, <strong>+ Nuevo Proceso → Poligonal</strong>. Indique
        el nombre, el tipo y el punto de partida (código, Norte, Este y azimut
        inicial).
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
        Muestra la precisión alcanzada junto a la requerida, el error de cierre
        y el perímetro. El color lo resume, y el texto lo dice: verde cumple,
        rojo no cumple.
      </p>

      <p>
        <strong>Configuración.</strong> Plegada cuando el proceso ya está
        calculado. Ábrala para cambiar el nombre, el tipo o el punto de partida.
      </p>

      <p>
        <strong>Estaciones.</strong> La tabla de captura. Por cada estación
        registra el código, el ángulo en grados-minutos-segundos y la distancia
        horizontal. A la derecha, la aplicación calcula en vivo el azimut, ΔN y
        ΔE.
      </p>

      <p>
        Los errores de captura se marcan al momento: una distancia de cero o
        mayor a 1000 m, minutos o segundos fuera del rango 0-59. Un ángulo de 0°
        o 360° genera una advertencia, no un bloqueo: es válido, pero suele
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

      <h3 className="mt-4 text-lg font-semibold">
        5.4 Reasignar coordenadas
      </h3>

      <p>
        El botón <strong>Asignar coordenadas reales</strong> permite recalcular
        toda la poligonal desde un punto de partida distinto, conservando las
        mediciones. Es útil cuando levantó en un sistema local y después obtuvo
        las coordenadas oficiales del punto de arranque.
      </p>

      <VolverArriba />
    </Seccion>
  );
}
