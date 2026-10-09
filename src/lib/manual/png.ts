/**
 * El tamaño de las capturas del manual (Fase 42). Puro: lee bytes, no
 * archivos.
 *
 * Las capturas se toman a `ESCALA_CAPTURAS` píxeles por píxel de pantalla y
 * el manual las muestra a su tamaño de pantalla: nítidas, sin agrandarlas. El
 * recorrido que las toma importa la misma constante.
 */

export const ESCALA_CAPTURAS = 2;

const FIRMA_PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/** Ancho y alto de un PNG, leídos de su cabecera IHDR. */
export function medidasPng(bytes: Uint8Array): { ancho: number; alto: number } {
  if (bytes.length < 24 || FIRMA_PNG.some((b, i) => bytes[i] !== b)) {
    throw new Error("No es un PNG");
  }
  const vista = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return { ancho: vista.getUint32(16), alto: vista.getUint32(20) };
}

/** El tamaño con que se muestra una captura: el de pantalla. */
export function tamanoEnPantalla(medidas: { ancho: number; alto: number }) {
  return {
    width: Math.round(medidas.ancho / ESCALA_CAPTURAS),
    height: Math.round(medidas.alto / ESCALA_CAPTURAS),
  };
}
