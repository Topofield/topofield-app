import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DmsInput } from "./dms-input";
import { NOT_A_NUMBER, NumberInput, withInvalidMark } from "./number-input";

// Fase 20, UI2. Sin jsdom los efectos no corren: se prueba lo que se pinta y
// la actualización del contador, que es pura.

const render = (props: Record<string, unknown>) =>
  renderToStaticMarkup(
    createElement(NumberInput, { "aria-label": "Cota", onChange: () => {}, ...props } as never),
  );

describe("NumberInput", () => {
  it("es una celda de texto con teclado decimal, no type=number", () => {
    const html = render({ value: "1,5" });
    expect(html).toContain('type="text"');
    expect(html).toContain('inputMode="decimal"');
    expect(html).not.toContain('type="number"');
    expect(html).toContain('value="1,5"');
  });

  it("entero: teclado numérico", () => {
    expect(render({ value: "3", integer: true })).toContain('inputMode="numeric"');
  });

  it("un número con coma no se marca", () => {
    const html = render({ value: "2541,7545" });
    expect(html).not.toContain(NOT_A_NUMBER);
    expect(html).not.toContain("aria-invalid");
  });

  it("un texto que no es número se marca con su mensaje, en vez del error del validador", () => {
    const html = render({ value: "1.234,5", error: "Falta la lectura." });
    expect(html).toContain(NOT_A_NUMBER);
    expect(html).not.toContain("Falta la lectura.");
    expect(html).toContain('aria-invalid="true"');
  });

  it("vacío deja pasar el error del validador", () => {
    expect(render({ value: "", error: "Falta la lectura." })).toContain("Falta la lectura.");
  });
});

describe("withInvalidMark — el contador de celdas inválidas del editor", () => {
  it("marca, desmarca y no duplica", () => {
    const a = withInvalidMark(new Set(), "c1", true);
    expect([...a]).toEqual(["c1"]);
    const b = withInvalidMark(a, "c2", true);
    expect(b.size).toBe(2);
    const c = withInvalidMark(b, "c1", false);
    expect([...c]).toEqual(["c2"]);
  });

  it("sin cambio devuelve el mismo conjunto, para no volver a renderizar", () => {
    const a = withInvalidMark(new Set(), "c1", true);
    expect(withInvalidMark(a, "c1", true)).toBe(a);
    const vacio = new Set<string>();
    expect(withInvalidMark(vacio, "c9", false)).toBe(vacio);
  });
});

describe("DmsInput", () => {
  it("tres celdas de texto: grados y minutos enteros, segundos con decimales", () => {
    const html = renderToStaticMarkup(
      createElement(DmsInput, {
        value: { deg: "45", min: "30", sec: "12,5" },
        onChange: () => {},
      }),
    );
    expect(html).not.toContain('type="number"');
    expect(html.match(/inputMode="numeric"/g)).toHaveLength(2);
    expect(html.match(/inputMode="decimal"/g)).toHaveLength(1);
    expect(html).toContain('value="12,5"');
  });
});
