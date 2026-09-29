"use client";

import { buttonClasses } from "@/components/design-system";

/**
 * Dispara el diálogo de impresión del navegador, desde el cual el usuario
 * elige «Guardar como PDF».
 *
 * Quien lo usa lo pone en una zona que `@media print` oculta —`.report-actions`
 * o la cabecera de página—, para que el botón no salga dentro del PDF.
 */
export function PrintButton({ size = "md" }: { size?: "sm" | "md" }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className={buttonClasses({ variant: "primary", size })}
    >
      Imprimir o guardar como PDF
    </button>
  );
}
