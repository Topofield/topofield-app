import { describe, expect, it } from "vitest";
import { ESCALA_CAPTURAS, medidasPng, tamanoEnPantalla } from "./png";

/** La firma y una cabecera IHDR de `ancho` × `alto`. */
function cabecera(ancho: number, alto: number): Uint8Array {
  const b = new Uint8Array(24);
  b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const v = new DataView(b.buffer);
  v.setUint32(8, 13);
  b.set([0x49, 0x48, 0x44, 0x52], 12); // «IHDR»
  v.setUint32(16, ancho);
  v.setUint32(20, alto);
  return b;
}

describe("medidasPng", () => {
  it("lee el ancho y el alto de la cabecera", () => {
    expect(medidasPng(cabecera(2560, 1600))).toEqual({ ancho: 2560, alto: 1600 });
  });

  it("rechaza lo que no es un PNG", () => {
    expect(() => medidasPng(new Uint8Array(24))).toThrow("No es un PNG");
    expect(() => medidasPng(new Uint8Array(4))).toThrow("No es un PNG");
  });
});

describe("tamanoEnPantalla", () => {
  it("divide por la escala de captura", () => {
    expect(ESCALA_CAPTURAS).toBe(2);
    expect(tamanoEnPantalla({ ancho: 780, alto: 1689 })).toEqual({ width: 390, height: 845 });
  });
});
