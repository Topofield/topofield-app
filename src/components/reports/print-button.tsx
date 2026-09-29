"use client";

import { buttonClasses } from "@/components/design-system";

/**
 * Dispara el diálogo de impresión del navegador, desde el cual el usuario
 * elige «Guardar como PDF».
 *
 * Quien lo usa lo pone dentro de `.report-actions`, que `@media print` oculta
 * para que el botón no salga dentro del PDF.
 */
export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className={buttonClasses({ variant: "primary" })}
    >
      Imprimir o guardar como PDF
    </button>
  );
}
