"use client";

import { useCallback, useState } from "react";
import { callAction } from "@/lib/errors/action-call";

export interface DraftSaveResult {
  ok: boolean;
  error?: string;
}

/**
 * El borrador de un proceso que se guarda entero desde cada popup (Fases 35 y
 * 36). Lo último que se guardó desde aquí manda hasta que el servidor devuelve
 * la página revalidada: así una medición o una armada encadenada parte de la
 * anterior aunque la página tarde en refrescarse. Cuando llega, manda el
 * servidor (`updatedAt` cambia con cada guardado).
 *
 * `base` es el borrador armado con lo que mandó el servidor, ya memorizado por
 * quien llama; `persist`, la acción de guardado, estable entre pintadas. `X`
 * es lo que un guardado lleva además del borrador y no se queda en él: los
 * puntos del amarre que van al catálogo en la poligonal.
 */
export function useProcessDraft<D, X = never>(
  updatedAt: string,
  base: D,
  persist: (next: D, extra?: X) => Promise<DraftSaveResult>,
): { draft: D; save: (next: D, extra?: X) => Promise<DraftSaveResult> } {
  const [saved, setSaved] = useState<D | null>(null);
  const [seen, setSeen] = useState(updatedAt);
  if (seen !== updatedAt) {
    setSeen(updatedAt);
    setSaved(null);
  }
  const save = useCallback(
    async (next: D, extra?: X) => {
      // Un fallo de red vuelve como error al popup, sin perder lo tecleado.
      const response = await callAction(() => persist(next, extra));
      if (response.ok) setSaved(next);
      return response;
    },
    [persist],
  );
  return { draft: saved ?? base, save };
}
