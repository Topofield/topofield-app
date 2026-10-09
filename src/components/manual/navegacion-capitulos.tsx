import Link from "next/link";
import type { Capitulo } from "@/lib/manual/manual";

type Vecino = Pick<Capitulo, "numero" | "slug" | "titulo"> | null;

/** Al final de un capítulo: el anterior, el siguiente y la vuelta al índice. */
export function NavegacionCapitulos({ anterior, siguiente }: { anterior: Vecino; siguiente: Vecino }) {
  return (
    <nav aria-label="Capítulos" className="mt-12 flex flex-col gap-4 border-t border-rule pt-6">
      <div className="grid gap-3 sm:grid-cols-2">
        {anterior ? (
          <Link
            href={`/manual/${anterior.slug}`}
            className="flex flex-col rounded-lg border border-rule bg-card px-4 py-3 transition-colors hover:bg-sel"
          >
            <span className="text-xs text-ink-2">← Capítulo {anterior.numero}</span>
            <span className="font-semibold">{anterior.titulo}</span>
          </Link>
        ) : (
          <span className="hidden sm:block" />
        )}
        {siguiente && (
          <Link
            href={`/manual/${siguiente.slug}`}
            className="flex flex-col rounded-lg border border-rule bg-card px-4 py-3 text-right transition-colors hover:bg-sel"
          >
            <span className="text-xs text-ink-2">Capítulo {siguiente.numero} →</span>
            <span className="font-semibold">{siguiente.titulo}</span>
          </Link>
        )}
      </div>
      <Link href="/manual" className="self-center text-sm font-medium text-ink-2 hover:text-ink">
        Volver al índice del manual
      </Link>
    </nav>
  );
}
