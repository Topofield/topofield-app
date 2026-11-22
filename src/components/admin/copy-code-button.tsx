"use client";

import { useState } from "react";
import { Button } from "@/components/design-system";

/** Copia el código de invitación, para pegarlo donde se le pase al invitado. */
export function CopyCodeButton({ code }: { code: string }) {
  const [copiado, setCopiado] = useState(false);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(code);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      // Sin permiso del portapapeles, el código sigue a la vista para copiarlo a mano.
    }
  }

  return (
    <Button variant="secondary" size="sm" onClick={copiar} aria-live="polite">
      {copiado ? "Copiado" : "Copiar"}
    </Button>
  );
}
