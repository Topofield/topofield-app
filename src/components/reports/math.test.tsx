// Fase 35: una letra griega sola en <mi> se pasaría a la cursiva matemática
// (U+1D6FC…), que muchas fuentes no tienen: se vería un cuadro vacío.
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Formula, Mi } from "./math";

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

describe("Formula", () => {
  it("la leyenda dice qué es cada símbolo (Fase 41)", () => {
    const h = renderToStaticMarkup(
      <Formula
        legend={[
          [<>d<sub>i</sub></>, "longitud del lado i"],
          ["P", "perímetro"],
        ]}
      >
        <Mi>P</Mi>
      </Formula>,
    );
    expect(h).toContain('<p class="report-formula-legend">donde: d<sub>i</sub> — longitud del lado i · P — perímetro</p>');
  });

  it("sin leyenda no pinta nada", () => {
    expect(renderToStaticMarkup(<Formula><Mi>P</Mi></Formula>)).not.toContain("donde:");
  });
});
