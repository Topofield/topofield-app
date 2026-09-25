/**
 * Un número tal como lo teclea un usuario en español: signo opcional, dígitos
 * y **un** separador decimal, coma o punto (Fase 20, UI2). `1,5` y `1.5` son lo
 * mismo; `,5` y `1,` también valen, porque son estados por los que pasa quien
 * teclea. Sin separador de miles: `1.234,5` no es 1234.5 sino un texto
 * inválido, porque adivinar el separador daría un número equivocado sin aviso.
 * Sin exponentes ni `Infinity`.
 */
const NUMBER_TEXT = /^[+-]?(?:\d+(?:[.,]\d*)?|[.,]\d+)$/;

/** Qué hay en una celda numérica: nada, un número, o texto que no lo es. */
export type NumberText =
  | { kind: "empty" }
  | { kind: "number"; value: number }
  | { kind: "invalid" };

export function readNumberText(value: string): NumberText {
  const trimmed = value.trim();
  if (trimmed === "") return { kind: "empty" };
  if (!NUMBER_TEXT.test(trimmed)) return { kind: "invalid" };
  const n = Number(trimmed.replace(",", "."));
  return Number.isFinite(n) ? { kind: "number", value: n } : { kind: "invalid" };
}

/**
 * Convierte el texto de un input a número, o `null` si está vacío **o no es
 * válido**. El `null` del texto inválido es deliberado: los validadores y el
 * motor comparan con `null`, y un `NaN` pasaría por ellos sin aviso. Quien
 * necesite distinguir los dos casos usa `isInvalidNumber` o `readNumberText`.
 */
export function parseNumber(value: string): number | null {
  const read = readNumberText(value);
  return read.kind === "number" ? read.value : null;
}

/** El texto no está vacío y no es un número: la celda debe marcarse. */
export function isInvalidNumber(value: string): boolean {
  return readNumberText(value).kind === "invalid";
}
