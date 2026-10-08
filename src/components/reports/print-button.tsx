"use client";

import { buttonClasses } from "@/components/design-system";

/**
 * «Exportar PDF» (Fase 38): dispara el diálogo de impresión del navegador,
 * desde el cual el usuario elige «Guardar como PDF».
 *
 * Va en la cabecera de la página, que `@media print` oculta, para que el botón
 * no salga dentro del PDF.
 */
export function PrintButton({ size = "md" }: { size?: "sm" | "md" }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className={buttonClasses({ variant: "primary", size })}
    >
      Exportar PDF
    </button>
  );
}
