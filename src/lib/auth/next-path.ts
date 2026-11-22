// A dónde volver tras iniciar sesión (Fase 46). Puro.
//
// El correo de aviso al administrador enlaza a `/admin/invitaciones`; sin
// sesión, el proxy lo manda a `/sign-in?next=/admin/invitaciones` y, al
// entrar, vuelve ahí. Solo se aceptan rutas de esta misma aplicación: un
// `next` con otro dominio convertiría el inicio de sesión en un redireccionador
// abierto.

/** La ruta interna de `next`, o `null` si no es una ruta de la aplicación. */
export function safeNextPath(next: string | null | undefined): string | null {
  if (!next) return null;
  if (!next.startsWith("/")) return null;
  // `//dominio` y `/\dominio` son, para el navegador, otro dominio.
  if (next.startsWith("//") || next.startsWith("/\\")) return null;
  // Sin caracteres de control: un salto de línea podría partir la cabecera.
  if (/[\u0000-\u001f\u007f]/.test(next)) return null;
  return next;
}
