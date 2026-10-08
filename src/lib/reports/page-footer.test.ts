import { describe, expect, it } from "vitest";
import { cssString, pageFooterCss } from "./page-footer";

describe("pie de página del PDF (Fase 40)", () => {
  it("escapa las comillas y la barra invertida", () => {
    expect(cssString('Lote "B" \\ norte')).toBe('"Lote \\"B\\" \\\\ norte"');
  });

  it("convierte los saltos de línea en espacios", () => {
    expect(cssString("Torre\nAlameda")).toBe('"Torre Alameda"');
  });

  it("no deja cerrar el <style>", () => {
    const css = cssString("</style><script>");
    expect(css).not.toContain("<");
    expect(css).not.toContain(">");
  });

  it("une el proyecto y el proceso en el margen inferior izquierdo", () => {
    expect(pageFooterCss("Campus", "Poligonal V10")).toBe(
      '@media print { @page { @bottom-left { content: "Campus · Poligonal V10"; } } }',
    );
  });
});
