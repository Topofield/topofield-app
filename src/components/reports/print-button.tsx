"use client";

import { buttonClasses } from "@/components/design-system";

/**
 * «Exportar PDF» (Fase 38): dispara el diálogo de impresión del navegador,
 * desde el cual el usuario elige «Guardar como PDF».
 *
 * Va en la cabecera de la página, que `@media print` oculta, para que el botón
 * no salga dentro del PDF.
 *
 * Mientras imprime, la pestaña toma `documentTitle`: es el título que el
 * navegador pone al PDF y el nombre que propone para el archivo, en vez del
 * de la app (Fase 40).
 */
export function PrintButton({ size = "md", documentTitle }: { size?: "sm" | "md"; documentTitle: string }) {
  function print() {
    const previous = document.title;
    document.title = documentTitle;
    window.addEventListener("afterprint", () => (document.title = previous), { once: true });
    window.print();
  }

  return (
    <button
      type="button"
      onClick={print}
      className={buttonClasses({ variant: "primary", size })}
    >
      Exportar PDF
    </button>
  );
}
