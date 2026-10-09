import type { Titulo } from "@/lib/manual/markdown";

/**
 * El índice de un capítulo: sus flujos (`##`). En escritorio va al lado del
 * texto y se queda fijo al bajar; en el teléfono va plegado arriba. Sin
 * JavaScript: `<details>` y anclas. No se imprime (todo `nav` se oculta).
 */
export function IndiceCapitulo({ secciones }: { secciones: Titulo[] }) {
  if (secciones.length === 0) return null;
  const lista = (
    <ul className="flex flex-col gap-1 text-sm">
      {secciones.map((s) => (
        <li key={s.id}>
          <a
            href={`#${s.id}`}
            className="block rounded px-2 py-1 text-ink-2 transition-colors hover:bg-sel hover:text-ink"
          >
            {s.texto}
          </a>
        </li>
      ))}
    </ul>
  );
  return (
    <>
      <nav aria-label="En este capítulo" className="lg:hidden">
        <details className="rounded-lg border border-rule bg-card">
          <summary className="cursor-pointer px-4 py-3 text-sm font-semibold">
            En este capítulo
          </summary>
          <div className="border-t border-rule px-2 py-2">{lista}</div>
        </details>
      </nav>
      <nav
        aria-label="En este capítulo"
        className="sticky top-[calc(var(--barra-alto)+1.5rem)] hidden max-h-[calc(100dvh-var(--barra-alto)-3rem)] self-start overflow-y-auto lg:block"
      >
        <p className="mb-2 px-2 text-xs font-semibold tracking-wide text-ink-3 uppercase">
          En este capítulo
        </p>
        {lista}
      </nav>
    </>
  );
}
