/**
 * Traducción de los mensajes de error de Supabase Auth a español Colombia.
 * Si el mensaje no está mapeado, se devuelve el original (mejor que silenciarlo).
 */
const TRANSLATIONS: Record<string, string> = {
  "Invalid login credentials": "Credenciales inválidas.",
  "Email not confirmed":
    "El correo aún no está confirmado. Revisa tu bandeja de entrada.",
  "User already registered":
    "El correo ya está registrado. Inicia sesión o usa otro.",
  "Password should be at least 6 characters":
    "La contraseña debe tener al menos 6 caracteres.",
  "Signup requires a valid password": "Ingresa una contraseña válida.",
  "Unable to validate email address: invalid format":
    "El formato del correo no es válido.",
  "Email rate limit exceeded":
    "Se enviaron demasiados correos. Espera unos minutos antes de intentar de nuevo.",
  "Database error saving new user":
    "Error al crear el usuario. Inténtalo de nuevo.",
};

export function translateAuthError(message: string): string {
  return TRANSLATIONS[message] ?? message;
}
