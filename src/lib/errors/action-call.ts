// Llamar a una Server Action desde un popup sin perder lo tecleado (Fase 35).
//
// Una acción que responde `{ ok: false }` ya se muestra en el popup. Pero si la
// llamada misma falla —sin conexión, un despliegue a mitad, un 500—, la promesa
// se rechaza, React lo lleva al límite de error y la página se reemplaza: lo
// tecleado en el popup se pierde. Aquí ese rechazo vuelve como un error más.

export const NETWORK_ERROR = "No se pudo guardar: revisa la conexión e inténtalo de nuevo.";

/**
 * La respuesta de la acción, o `{ ok: false, error }` si la llamada falla. Las
 * señales de navegación de Next (`redirect`, `notFound`) no son fallos: siguen.
 */
export async function callAction<T>(call: () => Promise<T>): Promise<T | { ok: false; error: string }> {
  try {
    return await call();
  } catch (e) {
    const digest = (e as { digest?: unknown } | null)?.digest;
    if (typeof digest === "string" && digest.startsWith("NEXT_")) throw e;
    console.error("La llamada a la acción falló:", e);
    return { ok: false, error: NETWORK_ERROR };
  }
}
