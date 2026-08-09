import { Badge } from "@/components/design-system";
import { Seccion } from "../componentes/seccion";
import { MODULOS_PENDIENTES } from "../manual-data";

export function Pendientes() {
  return (
    <Seccion id="pendientes" titulo="8. Módulos pendientes">
      <p>
        Los siguientes módulos están especificados en el PRD pero{" "}
        <strong>aún no implementados</strong>. Se listan aquí para que se vea el
        alcance completo previsto.
      </p>

      <ul className="flex flex-col gap-4">
        {MODULOS_PENDIENTES.map((modulo) => (
          <li
            key={modulo.nombre}
            // Sin elementos accionables dentro: nada debe sugerir que se puede
            // entrar a un módulo que todavía no existe.
            className="rounded-lg border border-dashed border-neutral-200 bg-neutral-50 p-5"
          >
            <div className="flex flex-wrap items-center gap-3">
              <h3 className="font-semibold text-neutral-800">
                {modulo.nombre}
              </h3>
              {/* El estado va escrito, no solo teñido: el color nunca es el
                  único canal. Tono neutral y no warning porque un módulo por
                  construir no es un problema. */}
              <Badge>Pendiente · fase {modulo.fase}</Badge>
            </div>
            <p className="mt-2 text-sm text-neutral-800">{modulo.descripcion}</p>
          </li>
        ))}
      </ul>

      <p>
        La pestaña <strong>Informes</strong> del proyecto está visible pero
        vacía hasta entonces.
      </p>
    </Seccion>
  );
}
