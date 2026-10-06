// Fase 35: una letra griega sola en <mi> se pasaría a la cursiva matemática
// (U+1D6FC…), que muchas fuentes no tienen: se vería un cuadro vacío.
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Mi } from "./math";

describe("Mi", () => {
  it("las letras griegas van rectas", () => {
    for (const g of ["α", "λ", "δ", "σ", "Δ"]) {
      expect(renderToStaticMarkup(<Mi>{g}</Mi>)).toBe(`<mi mathvariant="normal">${g}</mi>`);
    }
  });

  it("las latinas, como siempre", () => {
    expect(renderToStaticMarkup(<Mi>e</Mi>)).toBe("<mi>e</mi>");
    expect(renderToStaticMarkup(<Mi>Az</Mi>)).toBe("<mi>Az</mi>");
  });
});
