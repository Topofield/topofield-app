import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/design-system";
import { Markdown } from "@/components/manual/markdown";
import { leerManual } from "@/lib/manual/manual";

export const metadata: Metadata = {
  title: "Manual de usuario — TopoField",
  description:
    "Cómo usar TopoField, flujo por flujo: proyectos, poligonales, nivelación, control de asentamientos, el informe y el trabajo en campo.",
};

/**
 * La portada del manual de usuario (Fase 42): la introducción y un capítulo
 * por flujo. Todo el texto vive en `docs/manual/` —el README y un Markdown por
 * capítulo— y se lee en el servidor. Existe en producción: es documentación
 * para quien usa TopoField.
 */
export default async function ManualPage() {
  const manual = await leerManual();
  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Manual" }]}
        title="Manual de usuario"
      />
      <div className="flex max-w-3xl flex-col gap-4">
        <Markdown tokens={manual.intro} capturas={manual.capturas} />
      </div>
      <nav aria-label="Capítulos del manual">
        <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {manual.capitulos.map((c) => (
            <li key={c.slug}>
              <Link
                href={`/manual/${c.slug}`}
                className="flex h-full flex-col gap-2 rounded-lg border border-rule bg-card p-5 transition-colors hover:bg-sel"
              >
                <span className="text-xs font-semibold tracking-wide text-ink-3 uppercase">
                  Capítulo {c.numero}
                </span>
                <span className="text-lg font-semibold">{c.titulo}</span>
                <span className="text-sm text-ink-2">{c.resumen}</span>
              </Link>
            </li>
          ))}
        </ol>
      </nav>
    </div>
  );
}
