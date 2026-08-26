"use client";

import { buttonClasses } from "@/components/design-system";

/**
 * Dispara el diálogo de impresión del navegador, desde el cual el usuario
 * elige «Guardar como PDF».
 *
 * Es lo único que necesita ser cliente en toda la ruta imprimible, y se oculta
 * en la propia impresión (`.report-actions` en `@media print`) para que el
 * botón no salga dentro del PDF.
 */
export function PrintButton() {
  return (
    <div className="report-actions">
      <button
        type="button"
        onClick={() => window.print()}
        className={buttonClasses({ variant: "primary" })}
      >
        Imprimir o guardar como PDF
      </button>
    </div>
  );
}
