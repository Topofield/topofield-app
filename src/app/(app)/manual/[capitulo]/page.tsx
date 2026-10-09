import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Badge, Breadcrumbs } from "@/components/design-system";
import { IndiceCapitulo } from "@/components/manual/indice-capitulo";
import { Markdown } from "@/components/manual/markdown";
import { NavegacionCapitulos } from "@/components/manual/navegacion-capitulos";
import { capituloConVecinos, leerManual } from "@/lib/manual/manual";

type Props = { params: Promise<{ capitulo: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { capitulo: slug } = await params;
  const datos = capituloConVecinos(await leerManual(), slug);
  if (!datos) return { title: "Manual de usuario — TopoField" };
  return {
    title: `${datos.capitulo.titulo} — Manual de TopoField`,
    description: datos.capitulo.resumen,
  };
}

/**
 * Un capítulo del manual (Fase 42): su texto viene de
 * `docs/manual/NN-<slug>.md`. El título no va en `PageHeader` porque su
 * `<header>` no se imprime, y el capítulo impreso es el anexo de la monografía.
 */
export default async function CapituloPage({ params }: Props) {
  const { capitulo: slug } = await params;
  const manual = await leerManual();
  const datos = capituloConVecinos(manual, slug);
  if (!datos) notFound();
  const { capitulo, anterior, siguiente } = datos;

  return (
    <div className="flex flex-col gap-6">
      <Breadcrumbs
        items={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Manual", href: "/manual" },
          { label: capitulo.titulo },
        ]}
      />
      <div className="border-b-2 border-ink pb-4">
        <Badge>Capítulo {capitulo.numero}</Badge>
        <h1 className="mt-2 text-2xl font-semibold">{capitulo.titulo}</h1>
        <p className="mt-1 max-w-3xl text-ink-2">{capitulo.resumen}</p>
      </div>
      <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[13rem_minmax(0,1fr)] lg:gap-10">
        <IndiceCapitulo secciones={capitulo.secciones} />
        <article className="flex min-w-0 flex-col gap-4">
          <Markdown tokens={capitulo.tokens} capturas={manual.capturas} />
          <NavegacionCapitulos anterior={anterior} siguiente={siguiente} />
        </article>
      </div>
    </div>
  );
}
