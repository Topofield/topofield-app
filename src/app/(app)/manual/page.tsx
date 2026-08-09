import type { Metadata } from "next";
import { construirIndice } from "./indice";
import { SECCIONES } from "./manual-data";
import { Conceptos } from "./secciones/conceptos";
import { Acceso } from "./secciones/acceso";
import { Dashboard } from "./secciones/dashboard";
import { Proyectos } from "./secciones/proyectos";
import { Poligonales } from "./secciones/poligonales";
import { Cierre } from "./secciones/cierre";
import { Campo } from "./secciones/campo";
import { Pendientes } from "./secciones/pendientes";
import { Faq } from "./secciones/faq";

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
 * El índice son anclas de HTML, sin JavaScript de cliente, igual que las
 * pestañas y los filtros del resto de la aplicación.
 */
export default function ManualPage() {
  const indice = construirIndice(SECCIONES);

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
          {indice.map((entrada) => (
            <li key={entrada.href}>
              <a
                href={entrada.href}
                className="inline-block rounded-full border border-neutral-200 bg-white px-3 py-1 text-sm font-medium text-primary-600 transition-colors hover:bg-primary-50"
              >
                {entrada.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <Conceptos />
      <Acceso />
      <Dashboard />
      <Proyectos />
      <Poligonales />
      <Cierre />
      <Campo />
      <Pendientes />
      <Faq />
    </div>
  );
}
