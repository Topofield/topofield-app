import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Logo, ThemeSelect, buttonClasses } from "@/components/design-system";
import { MencionUd } from "@/components/landing/mencion-ud";
import { PoligonalHero } from "@/components/landing/poligonal-hero";
import { APARTADOS } from "@/lib/landing/contenido";
import { poligonalEjemplo } from "@/lib/landing/poligonal-ejemplo";
import { readThemeChoice } from "@/lib/theme-server";

export const metadata: Metadata = {
  title: "TopoField — poligonales, nivelación y asentamientos",
  description:
    "Plataforma web para procesos topográficos: valida al capturar, calcula en vivo y entrega un informe por proceso. Trabajo de grado en Ingeniería Topográfica, Universidad Distrital Francisco José de Caldas.",
};

const ANCHO = "mx-auto w-full max-w-6xl px-4 sm:px-6";

/**
 * La página de presentación (Fase 45). Solo la ve quien no tiene sesión: con
 * sesión, `proxy.ts` lleva `/` al dashboard antes de llegar aquí.
 */
export default async function Home() {
  const theme = await readThemeChoice();
  const poligonal = poligonalEjemplo();

  return (
    <div className="flex min-h-screen flex-col">
      <header className={`${ANCHO} flex h-14 items-center justify-between`}>
        <Logo />
        <div className="flex items-center gap-2">
          <ThemeSelect initial={theme} />
          <Link href="/sign-in" className={buttonClasses({ variant: "secondary", size: "sm" })}>
            Iniciar sesión
          </Link>
        </div>
      </header>

      <main className="flex-1">
        <section
          className={`${ANCHO} grid items-center gap-x-14 gap-y-10 pt-8 pb-16 sm:pt-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,33rem)] lg:pb-20`}
        >
          <div className="min-w-0">
            <MencionUd />
            <h1 className="mt-8 max-w-[18ch] text-4xl leading-[1.05] font-bold text-balance sm:text-6xl sm:leading-[1.02] lg:text-[3.5rem]">
              La cartera de campo, calculada mientras se escribe.
            </h1>
            <p className="mt-6 max-w-[34rem] text-lg text-ink-2">
              TopoField lleva poligonales, nivelaciones y controles de
              asentamiento. Valida cada lectura al capturarla, ajusta y
              compensa en vivo, y deja un informe por proceso en PDF y en
              Excel con fórmulas.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link href="/sign-in" className={buttonClasses({ size: "lg" })}>
                Iniciar sesión
              </Link>
              <Link
                href="/sign-up"
                className={buttonClasses({ variant: "secondary", size: "lg" })}
              >
                Crear cuenta
              </Link>
            </div>
            <p className="mt-3 text-sm text-ink-2">
              Crear una cuenta pide un código de invitación.
            </p>
          </div>

          {poligonal && <PoligonalHero poligonal={poligonal} />}
        </section>

        <section className="border-t border-rule bg-card">
          <div className={`${ANCHO} py-14 lg:py-20`}>
            <h2 className="max-w-[22ch] text-3xl leading-tight font-semibold sm:text-4xl">
              Tres procesos de campo y el informe de cada uno
            </h2>
            <div className="mt-6">
              {APARTADOS.map((a) => (
                <article
                  key={a.titulo}
                  className="grid gap-x-12 gap-y-6 border-t border-rule py-10 first:border-t-0 lg:grid-cols-12"
                >
                  <div className="lg:col-span-4">
                    <h3 className="text-2xl font-semibold">{a.titulo}</h3>
                    <p className="mt-3 max-w-[34rem] text-ink-2">{a.texto}</p>
                  </div>
                  <div className="relative aspect-[16/10] overflow-hidden rounded-lg border border-rule bg-paper shadow-sm lg:col-span-8">
                    <Image
                      src={`/manual/${a.captura}`}
                      alt={a.alt}
                      fill
                      sizes="(min-width: 1024px) 45rem, 100vw"
                      className="object-cover object-top"
                    />
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="border-t border-rule">
          <div className={`${ANCHO} grid gap-8 py-14 lg:grid-cols-12 lg:items-end lg:py-20`}>
            <div className="lg:col-span-8">
              <h2 className="text-3xl leading-tight font-semibold sm:text-4xl">
                Contrastado con carteras de campo reales
              </h2>
              <p className="mt-4 max-w-[38rem] text-lg text-ink-2">
                El motor de cálculo se verificó contra carteras de poligonal,
                de nivelación y de asentamientos medidas en campo: los
                resultados de TopoField coinciden con los de sus hojas de
                cálculo.
              </p>
            </div>
            <div className="lg:col-span-4 lg:justify-self-end">
              <Link href="/sign-in" className={buttonClasses({ size: "lg" })}>
                Iniciar sesión
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-rule bg-card">
        <div
          className={`${ANCHO} flex flex-col gap-3 py-8 text-sm text-ink-2 sm:flex-row sm:items-center sm:justify-between`}
        >
          <Logo className="text-base" />
          <p className="sm:text-right">
            Trabajo de grado de Sebastián Alejandro Ruiz Franco, Ingeniería
            Topográfica.
            <span className="block">
              Universidad Distrital Francisco José de Caldas, Bogotá, 2026.
            </span>
          </p>
        </div>
      </footer>
    </div>
  );
}
