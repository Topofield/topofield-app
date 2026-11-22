// El código de invitación (Fase 46). Puro: sin React ni Supabase.
//
// Ocho caracteres de un alfabeto sin los que se confunden al dictarlos o al
// leerlos en un teléfono (0/O, 1/I/L). Se muestra en dos grupos, `XXXX-XXXX`,
// y se guarda sin el guion. La base aplica la misma forma
// (`invitations.code`) y la misma normalización (`normalize_invite_code`).

export const INVITE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const INVITE_CODE_LENGTH = 8;

const FORMA = /^[A-HJKMNP-Z2-9]{8}$/;

/** Bytes aleatorios del generador criptográfico. Inyectable en las pruebas. */
export type RandomBytes = (n: number) => Uint8Array;

const bytesCriptograficos: RandomBytes = (n) =>
  globalThis.crypto.getRandomValues(new Uint8Array(n));

/**
 * Un código nuevo, normalizado. Descarta los bytes de 248 en adelante para
 * que cada carácter salga con la misma probabilidad (248 = 31 · 8): un `% 31`
 * sobre todo el byte favorecería a los primeros.
 */
export function generateInviteCode(random: RandomBytes = bytesCriptograficos): string {
  const tope = INVITE_ALPHABET.length * Math.floor(256 / INVITE_ALPHABET.length);
  let codigo = "";
  while (codigo.length < INVITE_CODE_LENGTH) {
    for (const b of random(INVITE_CODE_LENGTH * 2)) {
      if (b >= tope) continue;
      codigo += INVITE_ALPHABET[b % INVITE_ALPHABET.length];
      if (codigo.length === INVITE_CODE_LENGTH) break;
    }
  }
  return codigo;
}

/** Como lo guarda la base: mayúsculas, sin guion ni espacios. */
export function normalizeInviteCode(texto: string): string {
  return texto.replace(/[\s-]/g, "").toUpperCase();
}

/** ¿Tiene la forma de un código, una vez normalizado? */
export function isWellFormedInviteCode(texto: string): boolean {
  return FORMA.test(normalizeInviteCode(texto));
}

/** Para mostrarlo: `ABCD-EFGH`. */
export function formatInviteCode(codigo: string): string {
  const n = normalizeInviteCode(codigo);
  return n.length === INVITE_CODE_LENGTH ? `${n.slice(0, 4)}-${n.slice(4)}` : n;
}
