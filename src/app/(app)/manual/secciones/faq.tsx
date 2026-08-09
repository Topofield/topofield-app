import { Seccion } from "../componentes/seccion";
import { PREGUNTAS } from "../manual-data";

export function Faq() {
  return (
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
  );
}
